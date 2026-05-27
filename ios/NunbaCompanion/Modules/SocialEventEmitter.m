//
//  SocialEventEmitter.m
//  Objective-C bridge for SocialEventEmitter.swift (#50, 2026-05-27).
//
//  Module name "SocialEventEmitter" — JS-side listeners use
//  DeviceEventEmitter.addListener('socialEvent', ...) to consume rows
//  published to com.hertzai.hevolve.social.{userId}: notifications,
//  notification.read fan-out, post/comment lifecycle events.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SocialEventEmitter, RCTEventEmitter)

// No callable methods from JS — events flow IN from WAMP via
// AutobahnConnectionManager and OUT to JS via supportedEvents=["socialEvent"].

@end
