/**
 * Nunba Companion — iOS app entry point.
 */
console.log('[index.js] entry start');
import {AppRegistry} from 'react-native';
console.log('[index.js] react-native imported');
import App from './App';
console.log('[index.js] App imported');
import {name as appName} from './app.json';

AppRegistry.registerComponent(appName, () => App);
console.log('[index.js] AppRegistry.registerComponent done — app=' + appName);
