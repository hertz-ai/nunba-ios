//
//  NunbaCompanion-Bridging-Header.h
//  Use this file to import Objective-C / RN-Core headers into Swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>
#import <React/RCTBridge.h>
#import <React/RCTUtils.h>
#import <React/RCTLog.h>

// RN 0.81 codegen produces RCTAppDependencyProvider as part of the
// ReactAppDependencyProvider pod. AppDelegate.swift instantiates it
// (`self.dependencyProvider = RCTAppDependencyProvider()`) so the
// Swift compiler needs to see its declaration via the bridging
// header. Without this import: "cannot find 'RCTAppDependencyProvider'
// in scope".
#import <ReactAppDependencyProvider/RCTAppDependencyProvider.h>

// React-RCTAppDelegate exposes RCTReactNativeFactory and the
// RCTAppDelegate base class. RCTAppDelegate is the legacy path
// (deprecated as of RN 0.81 in favor of RCTReactNativeFactory) but
// still works — keep importing while we plan migration.
#import <React-RCTAppDelegate/RCTAppDelegate.h>
