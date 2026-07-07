// Cross-platform signup + OTP service for the iOS port.
//
// On Android these two calls live in native Java (SignLoginApi Retrofit,
// driven by OnboardingModule.signUp + the SignUpOTPVerification Activity).
// There is no native equivalent on iOS, so the flow is implemented here as
// plain HTTP and is shared by both platforms. Contract extracted from
// ~/AndroidStudioProjects/camera_branch_hevolve:
//   - api/SignLoginApi.java                 (endpoints)
//   - views/OnboardingModule.java signUp()  (register_student body)
//   - views/SignUpOTPVerification.java       (varify_otp body)
//   - models/gson/OtpResponse.java           (verify response)
//   - android/app/build.gradle               (base_url_SignLogin)
import axios from 'axios';

// = BuildConfig.base_url_SignLogin on Android. The signup/verify endpoints
// are pre-auth (no Bearer); the access_token is what verify returns.
const BASE_URL = 'https://azurekong.hertzai.com/data/';

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 60000,
  headers: { 'Content-Type': 'application/json' },
});

// Registering the student is what triggers the OTP send. The server (FastAPI)
// rejects explicit null with 422 "none is not an allowed value", and an empty
// email with a 500 — it wants the field OMITTED when unset. Android sends this
// same body via org.json, whose put(key, null) silently drops the key, so only
// populated fields ever reach the server. We mirror that by omitting any
// null/undefined/empty value. Required by the server: name, phone_number,
// email_address, is_active, client_id, client_secret.
export async function registerStudent({ name, email, phone }) {
  const body = omitEmpty({
    name,
    email_address: email,
    phone_number: phone,
    is_active: 'true',
    client_id: 0,
    client_secret: 'none',
  });
  const { data } = await client.post('register_student', body);
  // RegistrationDTO: { response, detail, verification_method }
  return data || {};
}

// Drop null/undefined/empty-string values so they are omitted from the JSON
// body entirely (matching Android's org.json behaviour). 0 is kept.
function omitEmpty(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === null || v === undefined) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

// Verify the 4-digit code. `identifier` is the phone number, OR the email
// address when register_student reported verification_method === 'email'.
export async function verifyOtp({ identifier, otp }) {
  const body = { phone_number: identifier, otp };
  const { data } = await client.post('varify_otp', body); // endpoint is spelled "varify"
  // OtpResponse: { access_token, token_type, expires_in, refresh_token,
  //   user_id, favorite_teacher_id, preferred_language, name, detail,
  //   email_address, dob, phone_number }
  return data || {};
}

// A verify is successful iff the server returned a user_id. On failure it
// returns detail = "Wrong OTP" / "OTP Expired" and no user_id.
export function isVerifySuccess(otpResponse) {
  return !!otpResponse && otpResponse.user_id != null;
}

// Silently mint a fresh access_token for an already-verified user, no OTP
// needed. There is no `refresh_token` STRING to redeem (client_credentials
// grants never issue one — see get_access_token in Hevolve's sql/otp.py),
// but the server exposes /refresh_tokens (plural) keyed by user_id alone:
// it just re-runs the same client_credentials call with that user's stored
// client_id/secret. 403 ("Please login first") if the account isn't
// verified — caller should fall back to sendLoginOtp in that case.
export async function refreshAccessToken(userId) {
  const { data } = await client.post('refresh_tokens', { user_id: Number(userId) });
  return data || {};
}

// Re-authenticate via OTP — fallback when refreshAccessToken() isn't
// available (e.g. account not yet verified). Re-sends an OTP to the
// identifier on file, verified via the same varify_otp call signup uses.
// Response is a plain detail string, e.g. "OTP sent to your email
// address ... and your phone number ...".
export async function sendLoginOtp(identifier) {
  const { data } = await client.post('login', { phone_number: identifier });
  return data || {};
}

// Bridge a Hevolve-OTP-verified identity into a HARTOS-native token for
// /api/social/* calls. See HARTOS integrations/social/api.py link_hevolve —
// trust-on-first-use, no independent re-verification of the opaque Hevolve
// access_token; the client only calls this after OTP verify already
// succeeded. Idempotent on email — safe to call again from the silent
// SessionExpired refresh path. Targets HARTOS's resolved base URL, not this
// file's Hevolve_Database BASE_URL.
export async function linkHevolveAccount({ hevolveUserId, phoneNumber, name, email }) {
  const endpointResolver = require('./endpointResolver').default;
  const base = await endpointResolver.getApiBaseUrl();
  const body = omitEmpty({
    hevolve_user_id: hevolveUserId,
    phone_number: phoneNumber,
    name,
    email,
  });
  const response = await fetch(`${base}/api/social/auth/link-hevolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await response.json().catch(() => null);
  if (!response.ok || !json || !json.success) {
    throw new Error((json && json.error) || `link-hevolve failed (${response.status})`);
  }
  return json.data; // { user, token }
}
