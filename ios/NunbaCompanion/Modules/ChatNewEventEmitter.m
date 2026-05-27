//
//  ChatNewEventEmitter.m
//  Objective-C bridge for ChatNewEventEmitter.swift (P2-S5).
//
//  Module name "ChatNewEventEmitter" — JS-side listeners use
//  DeviceEventEmitter.addListener('chatNew', ...) to consume rows
//  published by HARTOS chat_messages.publish_new.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(ChatNewEventEmitter, RCTEventEmitter)

// No callable methods from JS — chat.new flows IN from WAMP via
// AutobahnConnectionManager and OUT to JS via supportedEvents=["chatNew"].

@end
