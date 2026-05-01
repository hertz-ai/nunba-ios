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

const MediaCacheManager = {
  // Initialize cache directory and load index
  init: async () => {
    if (initialized) return;
    try {
      const dirExists = await RNFetchBlob.fs.isDir(CACHE_DIR);
      if (!dirExists) {
        await RNFetchBlob.fs.mkdir(CACHE_DIR);
      }
      const indexStr = await AsyncStorage.getItem(CACHE_INDEX_KEY);
      if (indexStr) {
        cacheIndex = JSON.parse(indexStr);
        // Prune expired entries on load
        await MediaCacheManager._pruneExpired();
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

  // Download and cache a file from URL
  download: async (mediaType, params, url, {onProgress} = {}) => {
    if (!initialized) await MediaCacheManager.init();

    const key = generateCacheKey(mediaType, params);
    const ext = getExtension(mediaType, url);
    const targetPath = `${CACHE_DIR}/${key}${ext}`;

    try {
      const res = await RNFetchBlob.config({path: targetPath})
        .fetch('GET', url, {})
        .progress((received, total) => {
          if (onProgress && total > 0) {
            onProgress(received / total);
          }
        });

      const stat = await RNFetchBlob.fs.stat(res.path());

      cacheIndex[key] = {
        path: res.path(),
        mediaType,
        params,
        size: parseInt(stat.size, 10),
        createdAt: Date.now(),
        lastAccessed: Date.now(),
      };

      await MediaCacheManager._persistIndex();

      // Check if eviction needed
      await MediaCacheManager._maybeEvict();

      return res.path();
    } catch (error) {
      // Clean up partial download
      try {
        await RNFetchBlob.fs.unlink(targetPath);
      } catch (_) {}
      throw error;
    }
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
