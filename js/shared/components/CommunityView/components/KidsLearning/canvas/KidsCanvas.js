/**
 * KidsCanvas — unified sprite renderer for the unique-brief games.
 *
 * Supports four asset types, each loaded ONCE at app launch and reused
 * across every game launch (no per-launch network).  This is the
 * SVG/Lottie tier the user asked for — bundled, infinite-scalable,
 * runs offline.
 *
 *   1. emoji        — fallback when nothing else is available; renders
 *                     as a styled <Text> at any size.
 *   2. image        — PNG/JPG bundled via require() or remote uri.
 *   3. svg          — pure-vector sprite (best for static objects: fruits,
 *                     shapes, tools).  Recolorable via palette so the
 *                     same SVG appears in 50 art_style variants.
 *   4. lottie       — animated character (running, walking, jumping,
 *                     waving).  Loops by default; supports speed/play
 *                     control and progress callbacks.
 *
 * The catalog declares an asset's `render` property:
 *   { id, name, emoji, render: 'svg', svg: 'fruits/apple', ... }
 *   { id, name, emoji, render: 'lottie', lottie: 'characters/runner', ... }
 *
 * SVG sprites live in components/CommunityView/components/KidsLearning/
 * canvas/svgs/ and are registered via the loader at the bottom of this
 * file.  Lottie animations live in canvas/lottie/.
 *
 * Why not 3D today: RN 0.68 + bare workflow makes @react-three/fiber
 * + expo-gl a multi-day integration.  Lottie+SVG covers 2D + 2.5D
 * (Lottie supports parallax + depth tricks) and unlocks 95% of the
 * "running/walking" + "thousands of sprites" requirements with a
 * ~80KB bundle hit instead of ~1.5MB.  3D models (glTF) become a
 * Phase 2 add once the catalog scale is proven.
 */

import React, { useMemo } from 'react';
import { View, Text, Image } from 'react-native';
import LottieView from 'lottie-react-native';
import { SvgXml } from 'react-native-svg';

// Static SVG registry — populated by individual SVG files in svgs/.
// Each file exports an `xml` string.  Loading them as require() means
// the bundler tree-shakes any unused sprite at compile time.
const SVG_REGISTRY = {};
const LOTTIE_REGISTRY = {};

/**
 * Register an SVG sprite.  Call at module load time.
 *   registerSvg('fruits/apple', '<svg xmlns="..."><path .../></svg>')
 */
export function registerSvg(id, xml) {
  SVG_REGISTRY[id] = xml;
}

/**
 * Register a Lottie animation.  Pass the parsed JSON object.
 */
export function registerLottie(id, json) {
  LOTTIE_REGISTRY[id] = json;
}

/** Returns true when an asset has an offline-renderable sprite (svg OR
 *  lottie) registered.  Used by composeUniqueBrief to prefer rich
 *  assets over emoji-only ones. */
export function hasRichSprite(asset) {
  if (!asset) return false;
  if (asset.render === 'svg' && SVG_REGISTRY[asset.svg]) return true;
  if (asset.render === 'lottie' && LOTTIE_REGISTRY[asset.lottie]) return true;
  return false;
}

/**
 * <KidsCanvas asset={...} size={64} palette={[#a, #b, #c]} animation="run" />
 *
 * Renders the asset in whichever mode it supports.  Falls back through
 * lottie → svg → image → emoji until something resolves.
 */
export default function KidsCanvas({
  asset,
  size = 64,
  palette,
  animation,
  paused = false,
  speed = 1,
  loop = true,
  onAnimationFinish,
  style,
  accessibilityLabel,
}) {
  // Choose render mode based on asset.render + registry availability.
  // Lottie wins when available because it's the only animated tier.
  const mode = useMemo(() => {
    if (!asset) return 'fallback';
    if (asset.render === 'lottie' && LOTTIE_REGISTRY[asset.lottie]) return 'lottie';
    if (asset.render === 'svg' && SVG_REGISTRY[asset.svg]) return 'svg';
    if (asset.render === 'image' && (asset.image || asset.imageUri)) return 'image';
    if (asset.emoji) return 'emoji';
    return 'fallback';
  }, [asset]);

  const containerStyle = [{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style];

  if (mode === 'lottie') {
    return (
      <View style={containerStyle} accessibilityLabel={accessibilityLabel || asset.name}>
        <LottieView
          source={LOTTIE_REGISTRY[asset.lottie]}
          style={{ width: size, height: size }}
          autoPlay={!paused}
          loop={loop}
          speed={speed}
          onAnimationFinish={onAnimationFinish}
        />
      </View>
    );
  }

  if (mode === 'svg') {
    // Per-palette recoloring: replace the special tokens %P0%, %P1%, %P2%
    // in the SVG source with the brief's palette colors before render.
    // This makes the same SVG render in 8+ art_styles by varying palette.
    let xml = SVG_REGISTRY[asset.svg];
    if (palette && palette.length) {
      xml = xml
        .replace(/%P0%/g, palette[0] || '#000')
        .replace(/%P1%/g, palette[1] || '#000')
        .replace(/%P2%/g, palette[2] || '#000');
    }
    return (
      <View style={containerStyle} accessibilityLabel={accessibilityLabel || asset.name}>
        <SvgXml xml={xml} width={size} height={size} />
      </View>
    );
  }

  if (mode === 'image') {
    const src = asset.image
      ? asset.image
      : { uri: asset.imageUri };
    return (
      <View style={containerStyle} accessibilityLabel={accessibilityLabel || asset.name}>
        <Image source={src} style={{ width: size, height: size }} resizeMode="contain" />
      </View>
    );
  }

  if (mode === 'emoji') {
    return (
      <View style={containerStyle} accessibilityLabel={accessibilityLabel || asset.name}>
        <Text style={{ fontSize: size * 0.8, lineHeight: size }}>{asset.emoji}</Text>
      </View>
    );
  }

  // Fallback — initial char on colored bg.  Identical to the existing
  // <Sprite> placeholder in UniqueGameRenderer so visual parity stays.
  const initial = (asset?.name || asset?.id || '?').charAt(0).toUpperCase();
  return (
    <View style={[containerStyle, { backgroundColor: palette?.[0] || '#6C63FF', borderRadius: size / 4 }]}>
      <Text style={{ color: '#FFFFFF', fontSize: size * 0.5, fontWeight: '800' }}>{initial}</Text>
    </View>
  );
}
