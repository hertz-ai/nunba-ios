//
//  NunbaCompanion-Bridging-Header.h
//  Use this file to import Objective-C / RN-Core headers into Swift.
//
//  RN React-* and ReactAppDependencyProvider are imported via Swift
//  module imports in AppDelegate.swift (`import React_RCTAppDelegate`,
//  `import ReactAppDependencyProvider`). Don't bracket-import them
//  here — the dash-vs-underscore framework-name translation in
//  CocoaPods static-framework mode makes those paths fragile and
//  the build errored with "file not found".
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridge.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>
#import <React/RCTLinkingManager.h>

// On-device LLM via llama.cpp — exposed to Swift only when the
// xcframework is dropped under ios/Frameworks/.  The CI workflow
// at .github/workflows/ios-llama-xcframework.yml builds the
// framework on macos-latest weekly; consumers run
//   gh run download --name llama-xcframework-<sha> --dir ios/Frameworks/
//   unzip ios/Frameworks/llama-xcframework.zip -d ios/Frameworks/
// before `pod install` and the local Xcode build picks it up.
//
// __has_include guards keep dev/CI builds without the framework
// green — LocalInferenceEngine.swift still compiles via its
// scaffold placeholders, only the real llama_decode loop stays
// dormant until the header is visible.
#if __has_include(<llama/llama.h>)
#import <llama/llama.h>
#endif
#if __has_include(<ggml/ggml.h>)
#import <ggml/ggml.h>
#endif
