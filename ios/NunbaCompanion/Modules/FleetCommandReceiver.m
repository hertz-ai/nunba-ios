//
//  FleetCommandReceiver.m
//  Objective-C bridge for FleetCommandReceiver.swift (RCTEventEmitter).
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(FleetCommandReceiver, RCTEventEmitter)

// No callable methods from JS — fleet commands flow IN to the module
// from APNs and OUT to JS via supportedEvents=["fleetCommand"].
// startObserving / stopObserving are inherited from RCTEventEmitter
// and don't need to be re-declared here.

@end
