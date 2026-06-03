import { Image } from 'react-native';

/**
 * imageCache — fire-and-forget Image.prefetch wrapper with a seen-set.
 *
 * Why this exists:
 *   Default <Image source={{uri:...}}/> on Android has NO disk cache.
 *   Every FlatList row recycle re-downloads the same avatar / story
 *   poster / post image.  Same root-cause as the video re-download
 *   bug (#386).  Calling Image.prefetch warms the in-memory Glide
 *   cache native-side so the next <Image> mount for that URL is
 *   instant.  We dedupe via a Set so we never prefetch the same URL
 *   twice in a session.
 *
 * Usage:
 *   import { prefetch, prefetchMany } from 'services/imageCache';
 *   prefetch(uri);                  // single URL, fire-and-forget
 *   prefetchMany([uri1, uri2]);     // bulk
 *
 * Phone-perf invariant (per user feedback): zero impact on the main
 * thread.  Image.prefetch is async + native-threaded; calls return
 * a Promise we intentionally don't await.
 */

const seen = new Set();

const isValid = (uri) =>
  typeof uri === 'string' &&
  uri.length > 0 &&
  (uri.startsWith('http://') || uri.startsWith('https://') || uri.startsWith('file://'));

export const prefetch = (uri) => {
  if (!isValid(uri) || seen.has(uri)) return;
  seen.add(uri);
  // Fire-and-forget. Errors (404, network) silently drop the URL from
  // the seen set so a later retry can still fetch.
  Image.prefetch(uri).catch(() => {
    seen.delete(uri);
  });
};

export const prefetchMany = (uris) => {
  if (!Array.isArray(uris)) return;
  for (const uri of uris) prefetch(uri);
};

export const hasBeenPrefetched = (uri) => seen.has(uri);

export const _resetForTests = () => seen.clear();

export default { prefetch, prefetchMany, hasBeenPrefetched };
