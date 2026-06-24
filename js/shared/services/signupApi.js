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
