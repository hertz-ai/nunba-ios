//
//  APNsTokenStore.swift
//  NunbaCompanion
//
//  Tiny holder for the APNs device token captured by AppDelegate's
//  didRegisterForRemoteNotificationsWithDeviceToken callback.
//
//  JS-side deviceApi.js reads this via a future bridge method to
//  register the install with the HARTOS backend. Until that bridge
//  exists, the token is just held in memory + persisted to
//  UserDefaults so a cold start can still surface it.
//

import Foundation

final class APNsTokenStore {
  static let shared = APNsTokenStore()

  private static let defaultsKey = "com.hertzai.nunbacompanion.apnsToken"

  private let q = DispatchQueue(label: "com.hertzai.nunbacompanion.apnsToken")
  private var _token: String?

  init() {
    _token = UserDefaults.standard.string(forKey: Self.defaultsKey)
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
    }
  }
}
