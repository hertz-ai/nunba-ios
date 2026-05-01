//
//  OnboardingModule.m
//  NunbaCompanion
//
//  Objective-C bridge that exposes OnboardingModule.swift's methods to
//  the React Native bridge. Required because RN's bridge macros don't
//  yet work directly on @objc Swift classes — declaring the module +
//  methods here is the canonical pattern (RN docs).
//

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(OnboardingModule, NSObject)

RCT_EXTERN_METHOD(getUser_id:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(getAccessToken:(RCTResponseSenderBlock)callback)
RCT_EXTERN_METHOD(publishToWamp:(NSString *)topic payload:(NSString *)payload)

@end
