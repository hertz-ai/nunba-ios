import RNFetchBlob from 'rn-fetch-blob';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_INDEX_KEY = '@kidsMedia:cacheIndex';
const CACHE_DIR = `${RNFetchBlob.fs.dirs.CacheDir}/kids_media`;
const MAX_CACHE_SIZE_BYTES = 200 * 1024 * 1024; // 200MB

// TTL per media type (milliseconds)
const TTL = {
  tts: 14 * 24 * 60 * 60 * 1000,    // 14 days
  music: 30 * 24 * 60 * 60 * 1000,   // 30 days
  video: 7 * 24 * 60 * 60 * 1000,    // 7 days
  sfx: 30 * 24 * 60 * 60 * 1000,     // 30 days
  image: 14 * 24 * 60 * 60 * 1000,   // 14 days
};

// djb2 hash for deterministic cache keys
const generateCacheKey = (mediaType, params) => {
  const input = `${mediaType}:${JSON.stringify(params)}`;
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) & 0xffffffff;
  }
  // Convert to unsigned hex string
  return (hash >>> 0).toString(16);
};

// Extension map for media types
const getExtension = (mediaType, url) => {
  if (url) {
    const match = url.match(/\.(\w{2,5})(\?|$)/);
    if (match) return `.${match[1]}`;
  }
  const extMap = {tts: '.mp3', music: '.mp3', video: '.mp4', sfx: '.mp3', image: '.png'};
  return extMap[mediaType] || '.bin';
};

// In-memory cache index (synced with AsyncStorage)
let cacheIndex = {};
let initialized = false;

// In-flight download dedup: cache-key → Promise.
// Without this, two concurrent download() calls for the same URL both
// write to the same targetPath and race — when navigation interrupts a
// feed-row mid-download and the row re-mounts, the corrupt half-written
// file gets registered as "cached" and every future mount of the URL
// hands a broken file:// to MediaPlayer.
const inFlight = new Map();

// Minimum size we will register as a valid cache entry.  Anything smaller
// is treated as a partial / failed download and discarded.  Videos under
// 4 KB are not videos.
const MIN_VALID_BYTES = 4096;

const MediaCacheManager = {
  // Initialize cache directory and load index.
  //
  // Self-heal: the previous build wrote download bytes directly to the
  // final target path with no atomic-rename, so a navigation that
  // interrupted a mid-flight RNFetchBlob fetch could leave a
  // half-written file registered in the index with size > 0.  Every
  // subsequent mount of that URL then handed a corrupt file:// to
  // MediaPlayer, fired onError, and hid the post forever.  On init we
  // verify each entry's on-disk file is still present and at least
  // MIN_VALID_BYTES; orphaned / partial entries get dropped so the next
  // mount can re-download cleanly.
  init: async () => {
    if (initialized) return;
    try {
      const dirExists = await RNFetchBlob.fs.isDir(CACHE_DIR);
      if (!dirExists) {
        await RNFetchBlob.fs.mkdir(CACHE_DIR);
      }
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (indexStr) {
        try {
          cacheIndex = JSON.parse(indexStr) || {};
        } catch (_) {
          cacheIndex = {};
        }
        await MediaCacheManager._pruneExpired();
        await MediaCacheManager._pruneInvalid();
      }
      initialized = true;
    } catch (e) {
      initialized = true;
    }
  },

  // Check if media is cached and valid
  has: (mediaType, params) => {
    const key = generateCacheKey(mediaType, params);
    const entry = cacheIndex[key];
    if (!entry) return false;
    const ttl = TTL[mediaType] || TTL.image;
    const isExpired = Date.now() - entry.createdAt > ttl;
    return !isExpired;
  },

  // Get cached file path (returns null if not cached or expired)
  get: (mediaType, params) => {
    const key = generateCacheKey(mediaType, params);
    const entry = cacheIndex[key];
    if (!entry) return null;
    const ttl = TTL[mediaType] || TTL.image;
    if (Date.now() - entry.createdAt > ttl) {
      // Expired - schedule cleanup
      MediaCacheManager.evict(mediaType, params).catch(() => {});
      return null;
    }
    // Update last accessed for LRU
    entry.lastAccessed = Date.now();
    return entry.path;
  },

  // Download and cache a file from URL.
  //
  // Two correctness properties matter here:
  //
  //   1. Concurrent calls for the same (mediaType, params) share ONE
  //      download.  Without this, FlatList row recycle + tap-during-load
  //      navigation triggers a second download to the same targetPath
  //      while the first is still writing, the two race, and the cache
  //      ends up indexing a half-written file (#386 follow-up).
  //
  //   2. We write to a `.tmp` path and only rename to the final path
  //      after a size sanity check.  Aborted / partial downloads never
  //      become indexed cache entries.
  download: async (mediaType, params, url, {onProgress, headers} = {}) => {
    if (!initialized) await MediaCacheManager.init();

    const key = generateCacheKey(mediaType, params);

    const existing = inFlight.get(key);
    if (existing) return existing;

    const ext = getExtension(mediaType, url);
    const targetPath = `${CACHE_DIR}/${key}${ext}`;
    const tmpPath = `${targetPath}.tmp`;

    const job = (async () => {
      try {
        // Clean any leftover tmp from a previous interrupted run.
        try { await RNFetchBlob.fs.unlink(tmpPath); } catch (_) {}

        const res = await RNFetchBlob.config({path: tmpPath})
          .fetch('GET', url, headers || {})
          .progress((received, total) => {
            if (onProgress && total > 0) {
              onProgress(received / total);
            }
          });

        const stat = await RNFetchBlob.fs.stat(res.path());
        const size = parseInt(stat.size, 10);
        if (!size || size < MIN_VALID_BYTES) {
          try { await RNFetchBlob.fs.unlink(tmpPath); } catch (_) {}
          throw new Error(`partial-download:${size || 0}`);
        }

        // Atomic-ish swap: remove any prior final file, then rename tmp.
        try { await RNFetchBlob.fs.unlink(targetPath); } catch (_) {}
        try {
          await RNFetchBlob.fs.mv(tmpPath, targetPath);
        } catch (_) {
          // mv unavailable on this platform — fall back to read+write.
          const data = await RNFetchBlob.fs.readFile(tmpPath, 'base64');
          await RNFetchBlob.fs.writeFile(targetPath, data, 'base64');
          try { await RNFetchBlob.fs.unlink(tmpPath); } catch (__) {}
        }

        cacheIndex[key] = {
          path: targetPath,
          mediaType,
          params,
          size,
          createdAt: Date.now(),
          lastAccessed: Date.now(),
        };

        await MediaCacheManager._persistIndex();
        await MediaCacheManager._maybeEvict();

        return targetPath;
      } catch (error) {
        try { await RNFetchBlob.fs.unlink(tmpPath); } catch (_) {}
        throw error;
      } finally {
        inFlight.delete(key);
      }
    })();

    inFlight.set(key, job);
    return job;
  },

  // Store base64-encoded data to cache
  storeBase64: async (mediaType, params, base64Data, ext) => {
    if (!initialized) await MediaCacheManager.init();

    const key = generateCacheKey(mediaType, params);
    const extension = ext || getExtension(mediaType);
    const targetPath = `${CACHE_DIR}/${key}${extension}`;

    try {
      await RNFetchBlob.fs.writeFile(targetPath, base64Data, 'base64');
      const stat = await RNFetchBlob.fs.stat(targetPath);

      cacheIndex[key] = {
        path: targetPath,
        mediaType,
        params,
        size: parseInt(stat.size, 10),
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      await MediaCacheManager._persistIndex();
      await MediaCacheManager._maybeEvict();

      return targetPath;
    } catch (error) {
      try {
        await RNFetchBlob.fs.unlink(targetPath);
      } catch (_) {}
      throw error;
    }
  },

  // Store small inline data (JSON/text) in AsyncStorage directly
  storeInline: async (mediaType, params, data) => {
    const key = generateCacheKey(mediaType, params);
    const storageKey = `@kidsMedia:inline:${key}`;
    try {
      await AsyncStorage.setItem(storageKey, JSON.stringify({
        data,
        mediaType,
        createdAt: Date.now(),
      }));
    } catch (_) {}
  },

  // Get inline data from AsyncStorage
  getInline: async (mediaType, params) => {
    const key = generateCacheKey(mediaType, params);
    const storageKey = `@kidsMedia:inline:${key}`;
    try {
      const str = await AsyncStorage.getItem(storageKey);
      if (!str) return null;
      const entry = JSON.parse(str);
      const ttl = TTL[mediaType] || TTL.image;
      if (Date.now() - entry.createdAt > ttl) {
        AsyncStorage.removeItem(storageKey).catch(() => {});
        return null;
      }
      return entry.data;
    } catch (_) {
      return null;
    }
  },

  // Evict a specific cached entry
  evict: async (mediaType, params) => {
    const key = generateCacheKey(mediaType, params);
    const entry = cacheIndex[key];
    if (!entry) return;

    try {
      await RNFetchBlob.fs.unlink(entry.path);
    } catch (_) {}

    delete cacheIndex[key];
    await MediaCacheManager._persistIndex();
  },

  // Get total cache size in bytes
  getCacheSize: () => {
    let total = 0;
    for (const key in cacheIndex) {
      total += cacheIndex[key].size || 0;
    }
    return total;
  },

  // Get cache stats by media type
  getCacheStats: () => {
    const stats = {totalSize: 0, ttsCount: 0, musicCount: 0, videoCount: 0, sfxCount: 0, imageCount: 0};
    for (const key in cacheIndex) {
      const entry = cacheIndex[key];
      stats.totalSize += entry.size || 0;
      const type = entry.mediaType;
      if (type === 'tts') stats.ttsCount++;
      else if (type === 'music') stats.musicCount++;
      else if (type === 'video') stats.videoCount++;
      else if (type === 'sfx') stats.sfxCount++;
      else if (type === 'image') stats.imageCount++;
    }
    return stats;
  },

  // Clear all cached media
  clearAll: async () => {
    try {
      // Remove all files in cache dir
      const exists = await RNFetchBlob.fs.isDir(CACHE_DIR);
      if (exists) {
        await RNFetchBlob.fs.unlink(CACHE_DIR);
        await RNFetchBlob.fs.mkdir(CACHE_DIR);
      }
      cacheIndex = {};
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(cacheIndex));
    } catch (_) {}
  },

  // Clear cached media by type
  clearByType: async (mediaType) => {
    const keysToRemove = [];
    for (const key in cacheIndex) {
      if (cacheIndex[key].mediaType === mediaType) {
        keysToRemove.push(key);
      }
    }

    for (const key of keysToRemove) {
      try {
        await RNFetchBlob.fs.unlink(cacheIndex[key].path);
      } catch (_) {}
      delete cacheIndex[key];
    }

    await MediaCacheManager._persistIndex();
  },

  // Internal: persist index to AsyncStorage
  _persistIndex: async () => {
    try {
      await AsyncStorage.setItem(CACHE_INDEX_KEY, JSON.stringify(cacheIndex));
    } catch (_) {}
  },

  // Internal: drop entries whose on-disk file is missing or too small.
  // Recovers users stuck on partial-file index entries written by the
  // previous build's racy download path.
  _pruneInvalid: async () => {
    let changed = false;
    for (const key of Object.keys(cacheIndex)) {
      const entry = cacheIndex[key];
      let valid = false;
      try {
        const stat = await RNFetchBlob.fs.stat(entry.path);
        const size = parseInt(stat.size, 10);
        valid = size && size >= MIN_VALID_BYTES;
      } catch (_) {
        valid = false;
      }
      if (!valid) {
        try { await RNFetchBlob.fs.unlink(entry.path); } catch (_) {}
        delete cacheIndex[key];
        changed = true;
      }
    }
    if (changed) await MediaCacheManager._persistIndex();
  },

  // Internal: prune expired entries
  _pruneExpired: async () => {
    const now = Date.now();
    let changed = false;
    for (const key in cacheIndex) {
      const entry = cacheIndex[key];
      const ttl = TTL[entry.mediaType] || TTL.image;
      if (now - entry.createdAt > ttl) {
        try {
          await RNFetchBlob.fs.unlink(entry.path);
        } catch (_) {}
        delete cacheIndex[key];
        changed = true;
      }
    }
    if (changed) {
      await MediaCacheManager._persistIndex();
    }
  },

  // Internal: LRU eviction when cache exceeds max size
  _maybeEvict: async () => {
    let totalSize = MediaCacheManager.getCacheSize();
    if (totalSize <= MAX_CACHE_SIZE_BYTES) return;

    // Sort entries by lastAccessed (oldest first)
    const entries = Object.entries(cacheIndex)
      .map(([key, entry]) => ({key, ...entry}))
      .sort((a, b) => (a.lastAccessed || 0) - (b.lastAccessed || 0));

    for (const entry of entries) {
      if (totalSize <= MAX_CACHE_SIZE_BYTES) break;
      try {
        await RNFetchBlob.fs.unlink(entry.path);
      } catch (_) {}
      totalSize -= entry.size || 0;
      delete cacheIndex[entry.key];
    }

    await MediaCacheManager._persistIndex();
  },

  // Exposed for testing
  generateCacheKey,
};

export default MediaCacheManager;
