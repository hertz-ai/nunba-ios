// Cross-platform community-feed service for the iOS port.
//
// On Android these are native methods in OnboardingModule (getAllPosts /
// deletePost) that hit a plain Retrofit client (no auth interceptor) against
// BuildConfig.base_url_db and emit each post to JS as an 'AddPostKey' event.
// iOS has no native counterpart, so the same HTTP calls live here. Contract
// extracted from ~/AndroidStudioProjects/camera_branch_hevolve:
//   - api/GetAllPostsAPI.java        POST get-posts?page_number&num_rows&user_id -> AddPostResponse[]
//   - api/DeleteReportPostAPI.java   POST delete_post/{postid}?reason
//   - views/OnboardingModule.java getAllPosts() (AddPostResponse -> CommunityPost mapping)
//   - models/gson/{AddPostResponse,AddpostUserData,CommunityPost}.java
//   - managers/ResourcesManager.java DELIMITER = ":-:-:"
import axios from 'axios';

// = BuildConfig.base_url_db. These endpoints are NOT authenticated on Android
// (the call uses a bare OkHttpClient); user scoping is via the user_id query.
const BASE_URL = 'https://azurekong.hertzai.com/db/';

// Android splits the caption on this delimiter: caption[0] is the real
// caption, caption[1] is the media URL (overrides resource_url).
const DELIMITER = ':-:-:';

function formatRelativeTime(dateStr) {
  if (!dateStr) return '';
  const then = new Date(dateStr);
  if (isNaN(then.getTime())) return String(dateStr);
  const diffMs = Date.now() - then.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  const diffWk = Math.floor(diffDay / 7);
  if (diffWk < 5) return `${diffWk}w ago`;
  const diffMo = Math.floor(diffDay / 30);
  if (diffMo < 12) return `${diffMo}mo ago`;
  return `${Math.floor(diffMo / 12)}y ago`;
}

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// The media host serves files on standard HTTPS (443); the :8443 port in the
// stored URLs refuses connections, so images/posters never load (render black).
// Strip the dead port so media resolves over 443.
function fixMediaUrl(url) {
  if (!url) {
    return url;
  }
  return url.replace('azurekong.hertzai.com:8443', 'azurekong.hertzai.com');
}

// Maps the raw get-posts row (AddPostResponse, snake_case) into the shape the
// feed's <Post> component consumes (CommunityPost, camelCase), mirroring
// OnboardingModule.getAllPosts.
function mapPost(row) {
  if (!row) {
    return null;
  }
  let caption = row.caption ?? '';
  let resourceUri = row.resource_url ?? '';
  if (caption.indexOf(DELIMITER) !== -1) {
    const parts = caption.split(DELIMITER);
    caption = parts[0];
    if (parts.length > 1 && parts[1]) {
      resourceUri = parts[1];
    }
  }
  resourceUri = fixMediaUrl(resourceUri);
  return {
    id: String(row.post_id),
    userID: String(row.user_id),
    resourceUri,
    contentType: row.content_type,
    caption,
    likesCount: row.like_count ?? 0,
    shareCount: row.share_count ?? 0,
    commentsCount: row.comment_count ?? 0, // server field is comment_count
    viewsCount: row.view_count ?? 0,
    uploadDate: row.upload_date,
    user: row.user
      ? { ...row.user, imageUri: fixMediaUrl(row.user.imageUri), time: formatRelativeTime(row.user.time || row.upload_date) }
      : {
          username: '',
          imageUri: null,
          location: null,
          time: formatRelativeTime(row.upload_date),
          rating: null,
        },
  };
}

// Fetch one page of feed posts. Returns an array of mapped posts.
export async function getCommunityPosts({ pageNumber = 1, numRows = 10, userId = 0 }) {
  const { data } = await client.post('get-posts', null, {
    params: { page_number: pageNumber, num_rows: numRows, user_id: userId },
  });
  if (!Array.isArray(data)) {
    return [];
  }
  return data.map(mapPost).filter(Boolean);
}

// Delete (and report) a post. Mirrors DeleteReportPostAPI.deleteandreport.
export async function deleteCommunityPost(postId, reason) {
  await client.post(`delete_post/${postId}`, null, {
    params: { reason: reason ?? '' },
  });
}

// Create a post. Mirrors Android's OnboardingModule.sendRequestToAddPost ->
// AddPostApi (multipart POST makeit/add-post/ on BuildConfig.base_url, no auth).
// The server REQUIRES an image part ("No image file provided" 400 otherwise),
// so imageUri must be a local file uri (from the image picker). Returns the
// created post mapped to the feed's shape.
export async function createCommunityPost({ userId, caption, imageUri }) {
  const form = new FormData();
  form.append('user_id', String(userId ?? 0));
  form.append('content_type', 'image');
  form.append('caption', caption ?? '');
  if (imageUri) {
    form.append('image', {
      uri: imageUri,
      name: 'upload.jpg',
      type: 'image/jpeg',
    });
  }
  const { data } = await axios.post(
    'https://azurekong.hertzai.com/makeit/add-post/',
    form,
    { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 },
  );
  return mapPost(data);
}
