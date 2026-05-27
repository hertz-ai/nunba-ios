//
//  APNsTokenStore.swift
//  NunbaCompanion
//
//  Tiny holder for the APNs device token captured by AppDelegate's
//  didRegisterForRemoteNotificationsWithDeviceToken callback.
//
//  P3c (2026-05-26): closes the long-standing TODO that left iOS
//  invisible to the backend.  When the token is captured AND a
//  persisted user_id exists, we POST {user_id, token} to the
//  canonical Hevolve_Database endpoint /update_fcm_token (the same
//  endpoint Android's MyFirebaseMessagingService.sendRegistrationToServer
//  uses for FCM tokens — Firebase wraps APNs and treats both as
//  fungible push tokens for the same identity).  Fire-and-forget;
//  retries on next app launch via the init() rehydration path.
//

import Foundation

final class APNsTokenStore {
  static let shared = APNsTokenStore()

  private static let defaultsKey = "com.hertzai.nunbacompanion.apnsToken"

  /// Backend host for the Hevolve_Database update_fcm_token endpoint.
  /// Override at build time via Info.plist key "HevolveDatabaseHost"
  /// for staging / on-prem; cloud falls through to the canonical
  /// production host used elsewhere in the app (PeerLinkModule).
  private static var backendHost: String {
    if let v = Bundle.main.object(forInfoDictionaryKey: "HevolveDatabaseHost") as? String,
       !v.isEmpty {
      return v
    }
    return "https://azurekong.hertzai.com"
  }

  private let q = DispatchQueue(label: "com.hertzai.nunbacompanion.apnsToken")
  private var _token: String?

  init() {
    _token = UserDefaults.standard.string(forKey: Self.defaultsKey)
    // P3c: try to register the rehydrated token on cold start so a
    // user who installed before the bridge was wired still surfaces
    // to the backend on the next launch.
    if let t = _token {
      registerWithBackendIfPossible(token: t)
    }
  }

  var token: String? {
    get { q.sync { _token } }
    set {
      q.sync {
        _token = newValue
        if let v = newValue {
          UserDefaults.standard.set(v, forKey: Self.defaultsKey)
        } else {
          UserDefaults.standard.removeObject(forKey: Self.defaultsKey)
        }
      }
      // P3c: register every time the token rotates.  APNs may issue
      // a new token after a restore / reinstall — the backend has to
      // see the new one or pushes silently drop.
      if let v = newValue {
        registerWithBackendIfPossible(token: v)
      }
    }
  }

  /// POST {user_id, token} to /update_fcm_token if a persisted
  /// user_id exists.  No-op if the user hasn't onboarded yet — we
  /// re-attempt on next token set or next cold start.
  func registerWithBackendIfPossible(token: String) {
    guard let userIdStr = OnboardingModule.persistedUserId(),
          !userIdStr.isEmpty else {
      NSLog("[APNsTokenStore] no persisted user_id yet — deferring register")
      return
    }
    // The endpoint expects int user_id (matches Hevolve_Database
    // schemas.UpdateFcmTokebn: user_id: int).  If the persisted id
    // isn't numeric, we POST it as a string anyway and let the
    // server-side validator do its thing — the alternative would
    // be a silent drop which is worse for diagnosis.
    let userIdAny: Any = Int(userIdStr) ?? userIdStr
    let body: [String: Any] = ["user_id": userIdAny, "token": token]
    guard let data = try? JSONSerialization.data(withJSONObject: body),
          let url = URL(string: "\(Self.backendHost)/update_fcm_token") else {
      NSLog("[APNsTokenStore] failed to build register request")
      return
    }
    var req = URLRequest(url: url)
    req.httpMethod = "POST"
    req.setValue("application/json", forHTTPHeaderField: "Content-Type")
    req.httpBody = data
    req.timeoutInterval = 10
    URLSession.shared.dataTask(with: req) { _, response, error in
      if let error {
        NSLog("[APNsTokenStore] register failed: \(error.localizedDescription)")
        return
      }
      if let http = response as? HTTPURLResponse {
        NSLog("[APNsTokenStore] register status=\(http.statusCode) user=\(userIdStr)")
      }
    }.resume()
  }
}
