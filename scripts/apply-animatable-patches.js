#!/usr/bin/env node
/**
 * apply-animatable-patches — runs from npm postinstall.
 *
 * react-native-animatable 1.4.0's fading/bouncing/sliding/zooming "In"
 * definitions start at opacity 0 and animate to opacity 1.  On RN 0.81
 * the animation never fires for many JS-thread paths, leaving wrapped
 * Views permanently invisible (the 71-file regression first observed
 * on AllFeaturesScreen + KidsHub + NotificationsScreen rows).
 *
 * The patches in /patches replace the entrance definitions with
 * already-visible from-and-to states.  Animations no-op visually but
 * the content is guaranteed to render.  Reanimated-driven entrance
 * polish can be reintroduced per-screen later.
 */
const fs = require('fs');
const path = require('path');

const MAP = [
  ['patches/animatable-fading-entrances.js',   'node_modules/react-native-animatable/definitions/fading-entrances.js'],
  ['patches/animatable-bouncing-entrances.js', 'node_modules/react-native-animatable/definitions/bouncing-entrances.js'],
  ['patches/animatable-sliding-entrances.js',  'node_modules/react-native-animatable/definitions/sliding-entrances.js'],
  ['patches/animatable-zooming-entrances.js',  'node_modules/react-native-animatable/definitions/zooming-entrances.js'],
];

const root = path.resolve(__dirname, '..');
let applied = 0;
let skipped = 0;
for (const [src, dst] of MAP) {
  const srcPath = path.join(root, src);
  const dstPath = path.join(root, dst);
  if (!fs.existsSync(srcPath)) {
    console.warn(`[animatable-patches] missing source: ${src}`);
    skipped += 1;
    continue;
  }
  if (!fs.existsSync(dstPath)) {
    console.warn(`[animatable-patches] missing target (package not installed?): ${dst}`);
    skipped += 1;
    continue;
  }
  fs.copyFileSync(srcPath, dstPath);
  applied += 1;
}
console.log(`[animatable-patches] applied ${applied} skipped ${skipped}`);
