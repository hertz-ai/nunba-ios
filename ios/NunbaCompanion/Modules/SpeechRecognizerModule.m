//
//  SpeechRecognizerModule.m
//  Objective-C bridge for SpeechRecognizerModule.swift.
//

#import <React/RCTBridgeModule.h>
#import <React/RCTEventEmitter.h>

@interface RCT_EXTERN_MODULE(SpeechRecognizerModule, RCTEventEmitter)

RCT_EXTERN_METHOD(start:(NSString *)locale)
RCT_EXTERN_METHOD(stop)

@end
