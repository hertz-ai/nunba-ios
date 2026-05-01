//
//  FleetCommandReceiver.m
//  Objective-C bridge for FleetCommandEventEmitter.swift.
//
//  RN's bridge factory will instantiate FleetCommandEventEmitter on
//  startObserving; that instance registers itself with the
//  process-wide FleetCommandDispatcher. AppDelegate routes APNs
//  payloads to the dispatcher; the dispatcher fans out to every
//  registered emitter; each emitter calls sendEvent on its bridge.
//
//  Module name "FleetCommandReceiver" preserved so JS-side
//  DeviceEventEmitter listeners (services/fleetCommandHandler.js)
//  don't need to change.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_REMAP_MODULE(FleetCommandReceiver, FleetCommandEventEmitter, RCTEventEmitter)

// No callable methods from JS — fleet commands flow IN to the
// dispatcher from APNs/WAMP and OUT to JS via supportedEvents=["fleetCommand"].

@end
