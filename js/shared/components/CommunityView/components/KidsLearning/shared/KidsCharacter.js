/**
 * KidsCharacter — Parameterized animated SVG character system for React Native.
 *
 * Generates thousands of unique characters from combinations of:
 *   - 10 species (owl, bunny, bear, cat, fox, robot, star, penguin, monkey, frog)
 *   - 12 color palettes
 *   - 6 expressions (happy, sad, thinking, excited, surprised, neutral)
 *   - 5 accessories (none, hat, glasses, bowtie, crown)
 *   - 6 animation states (idle, talk, celebrate, think, encourage, sleep)
 *
 * NOTE: Requires `react-native-svg` — install via:
 *   npm install react-native-svg
 *   cd ios && pod install  (iOS only)
 *
 * Usage:
 *   <KidsCharacter species="owl" color="purple" expression="happy" state="idle" size={120} />
 *   <KidsCharacter species="bunny" color="pink" accessory="crown" state="celebrate" />
 *   <KidsCharacter /> // random character
 *
 * Props:
 *   species:    string  (default: random)
 *   color:      string  (palette name, default: random)
 *   expression: string  (default: 'happy')
 *   accessory:  string  (default: 'none')
 *   state:      string  (animation state, default: 'idle')
 *   size:       number  (px, default: 96)
 *   talking:    boolean (mouth animates open/close, default: false)
 *   onClick:    func    (mapped to onPress in RN)
 *   seed:       string  (deterministic random)
 *   style:      object  (additional View style)
 */

import React, {useEffect, useMemo, useRef} from 'react';
import {Animated, Easing, StyleSheet, TouchableOpacity, View} from 'react-native';
import Svg, {Circle, Ellipse, G, Line, Path, Rect} from 'react-native-svg';

// ── Color palettes ──────────────────────────────────────────────
const PALETTES = {
  purple:  {body: '#6C63FF', belly: '#A29BFE', accent: '#4834D4', cheek: '#FFB8C6'},
  pink:    {body: '#FF6B81', belly: '#FFB8C6', accent: '#E84393', cheek: '#FFC9DE'},
  blue:    {body: '#54A0FF', belly: '#A3D8F4', accent: '#2E86DE', cheek: '#FFD1DC'},
  green:   {body: '#00B894', belly: '#81ECEC', accent: '#00A086', cheek: '#FFD1DC'},
  orange:  {body: '#FF9F43', belly: '#FECA57', accent: '#EE5A24', cheek: '#FFD1DC'},
  red:     {body: '#FF6B6B', belly: '#FFA3A3', accent: '#D63031', cheek: '#FFD1DC'},
  teal:    {body: '#4ECDC4', belly: '#88E8DF', accent: '#16A085', cheek: '#FFD1DC'},
  yellow:  {body: '#FECA57', belly: '#FFF3B0', accent: '#F39C12', cheek: '#FFD1DC'},
  coral:   {body: '#FD79A8', belly: '#FFC3D8', accent: '#E84393', cheek: '#FFE8F0'},
  mint:    {body: '#55EFC4', belly: '#B8F0DD', accent: '#00B894', cheek: '#FFD1DC'},
  slate:   {body: '#636E72', belly: '#B2BEC3', accent: '#2D3436', cheek: '#FFC3C3'},
  gold:    {body: '#FDCB6E', belly: '#FFF3B0', accent: '#F0932B', cheek: '#FFD1DC'},
};

const PALETTE_NAMES = Object.keys(PALETTES);

// ── Species list ────────────────────────────────────────────────
const SPECIES = ['owl', 'bunny', 'bear', 'cat', 'fox', 'robot', 'star', 'penguin', 'monkey', 'frog'];
const ACCESSORIES = ['none', 'hat', 'glasses', 'bowtie', 'crown'];
const EXPRESSIONS = ['happy', 'sad', 'thinking', 'excited', 'surprised', 'neutral'];
const STATES = ['idle', 'talk', 'celebrate', 'think', 'encourage', 'sleep'];

// ── Deterministic pseudo-random from string seed ────────────────
function hashSeed(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

// ── Eye shapes by expression ────────────────────────────────────
function renderEyes(expression, bodyColor, cx, cy, scale) {
  const s = scale;
  const eyeW = 8 * s;
  const eyeH = expression === 'surprised' ? 10 * s : 8 * s;
  const pupilR = expression === 'excited' ? 3.5 * s : 3 * s;
  const sparkleR = 1.2 * s;

  const lx = cx - 10 * s;
  const rx = cx + 10 * s;

  const closedEye = (x, key) => (
    <Path
      key={key}
      d={`M${x - eyeW / 2},${cy} Q${x},${cy - 4 * s} ${x + eyeW / 2},${cy}`}
      stroke="#2D3436"
      strokeWidth={2 * s}
      strokeLinecap="round"
      fill="none"
    />
  );

  if (expression === 'sad') {
    return [closedEye(lx, 'eye-l'), closedEye(rx, 'eye-r')];
  }

  if (expression === 'thinking') {
    return [
      closedEye(lx, 'eye-l'),
      <Ellipse key="eye-r" cx={rx} cy={cy} rx={eyeW / 2} ry={eyeH / 2} fill="white" stroke="#2D3436" strokeWidth={1.5 * s} />,
      <Circle key="pupil-r" cx={rx + 1.5 * s} cy={cy - 1.5 * s} r={pupilR} fill="#2D3436" />,
      <Circle key="sparkle-r" cx={rx + 3 * s} cy={cy - 3 * s} r={sparkleR} fill="white" />,
    ];
  }

  return [lx, rx].flatMap((x, i) => [
    <Ellipse key={`eye-${i}`} cx={x} cy={cy} rx={eyeW / 2} ry={eyeH / 2} fill="white" stroke="#2D3436" strokeWidth={1.5 * s} />,
    <Circle key={`pupil-${i}`} cx={x} cy={cy} r={pupilR} fill="#2D3436" />,
    <Circle key={`sparkle-${i}`} cx={x + 2 * s} cy={cy - 2 * s} r={sparkleR} fill="white" />,
  ]);
}

// ── Mouth by expression ─────────────────────────────────────────
// NOTE: In RN, the talking mouth is rendered with a static open ellipse.
// The talk animation toggles overall opacity via the Animated wrapper.
function renderMouth(expression, talking, cx, cy, scale) {
  const s = scale;

  if (talking) {
    return (
      <Ellipse
        cx={cx}
        cy={cy + 2 * s}
        rx={5 * s}
        ry={4 * s}
        fill="#2D3436"
      />
    );
  }

  switch (expression) {
    case 'happy':
    case 'excited':
      return (
        <Path
          d={`M${cx - 7 * s},${cy} Q${cx},${cy + 8 * s} ${cx + 7 * s},${cy}`}
          stroke="#2D3436"
          strokeWidth={2 * s}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'sad':
      return (
        <Path
          d={`M${cx - 6 * s},${cy + 4 * s} Q${cx},${cy - 2 * s} ${cx + 6 * s},${cy + 4 * s}`}
          stroke="#2D3436"
          strokeWidth={2 * s}
          strokeLinecap="round"
          fill="none"
        />
      );
    case 'surprised':
      return (
        <Ellipse cx={cx} cy={cy + 2 * s} rx={4 * s} ry={5 * s} fill="#2D3436" />
      );
    case 'thinking':
      return (
        <Path
          d={`M${cx - 5 * s},${cy + 2 * s} L${cx + 5 * s},${cy + 2 * s}`}
          stroke="#2D3436"
          strokeWidth={2 * s}
          strokeLinecap="round"
        />
      );
    default: // neutral
      return (
        <Path
          d={`M${cx - 5 * s},${cy + 2 * s} Q${cx},${cy + 4 * s} ${cx + 5 * s},${cy + 2 * s}`}
          stroke="#2D3436"
          strokeWidth={2 * s}
          strokeLinecap="round"
          fill="none"
        />
      );
  }
}

// ── Cheeks ──────────────────────────────────────────────────────
function renderCheeks(expression, cheekColor, cx, cy, scale) {
  const s = scale;
  if (expression === 'sad' || expression === 'neutral') return null;
  return (
    <G>
      <Ellipse cx={cx - 16 * s} cy={cy + 4 * s} rx={4 * s} ry={3 * s} fill={cheekColor} opacity={0.6} />
      <Ellipse cx={cx + 16 * s} cy={cy + 4 * s} rx={4 * s} ry={3 * s} fill={cheekColor} opacity={0.6} />
    </G>
  );
}

// ── Accessory rendering ─────────────────────────────────────────
function renderAccessory(accessory, cx, topY, scale, accentColor) {
  const s = scale;

  switch (accessory) {
    case 'hat':
      return (
        <G key="hat">
          <Rect x={cx - 14 * s} y={topY - 6 * s} width={28 * s} height={4 * s} rx={2 * s} fill={accentColor} />
          <Rect x={cx - 9 * s} y={topY - 18 * s} width={18 * s} height={14 * s} rx={4 * s} fill={accentColor} />
          <Circle cx={cx} cy={topY - 19 * s} r={3 * s} fill="#FECA57" />
        </G>
      );
    case 'crown':
      return (
        <G key="crown">
          <Path
            d={`M${cx - 12 * s},${topY - 2 * s} L${cx - 14 * s},${topY - 14 * s} L${cx - 6 * s},${topY - 8 * s} L${cx},${topY - 16 * s} L${cx + 6 * s},${topY - 8 * s} L${cx + 14 * s},${topY - 14 * s} L${cx + 12 * s},${topY - 2 * s} Z`}
            fill="#FDCB6E"
            stroke="#F0932B"
            strokeWidth={1.5 * s}
          />
          <Circle cx={cx} cy={topY - 12 * s} r={2 * s} fill="#E17055" />
          <Circle cx={cx - 8 * s} cy={topY - 9 * s} r={1.5 * s} fill="#00B894" />
          <Circle cx={cx + 8 * s} cy={topY - 9 * s} r={1.5 * s} fill="#6C63FF" />
        </G>
      );
    case 'glasses':
      return (
        <G key="glasses">
          <Circle cx={cx - 10 * s} cy={topY + 22 * s} r={7 * s} fill="none" stroke="#2D3436" strokeWidth={2 * s} />
          <Circle cx={cx + 10 * s} cy={topY + 22 * s} r={7 * s} fill="none" stroke="#2D3436" strokeWidth={2 * s} />
          <Line x1={cx - 3 * s} y1={topY + 22 * s} x2={cx + 3 * s} y2={topY + 22 * s} stroke="#2D3436" strokeWidth={2 * s} />
          <Line x1={cx - 17 * s} y1={topY + 22 * s} x2={cx - 20 * s} y2={topY + 20 * s} stroke="#2D3436" strokeWidth={2 * s} />
          <Line x1={cx + 17 * s} y1={topY + 22 * s} x2={cx + 20 * s} y2={topY + 20 * s} stroke="#2D3436" strokeWidth={2 * s} />
        </G>
      );
    case 'bowtie':
      return (
        <G key="bowtie">
          <Path
            d={`M${cx},${topY + 42 * s} L${cx - 10 * s},${topY + 36 * s} L${cx - 10 * s},${topY + 48 * s} Z`}
            fill={accentColor}
          />
          <Path
            d={`M${cx},${topY + 42 * s} L${cx + 10 * s},${topY + 36 * s} L${cx + 10 * s},${topY + 48 * s} Z`}
            fill={accentColor}
          />
          <Circle cx={cx} cy={topY + 42 * s} r={2.5 * s} fill="#FECA57" />
        </G>
      );
    default:
      return null;
  }
}

// ── Species body templates ──────────────────────────────────────
// Each returns react-native-svg elements for head + body + features.

function renderOwl(p, cx, cy, s) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 20 * s} rx={20 * s} ry={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 24 * s} rx={13 * s} ry={14 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 6 * s} r={22 * s} fill={p.body} />
      <Path d={`M${cx - 16 * s},${cy - 22 * s} L${cx - 22 * s},${cy - 38 * s} L${cx - 8 * s},${cy - 24 * s}`} fill={p.accent} />
      <Path d={`M${cx + 16 * s},${cy - 22 * s} L${cx + 22 * s},${cy - 38 * s} L${cx + 8 * s},${cy - 24 * s}`} fill={p.accent} />
      <Ellipse cx={cx} cy={cy - 2 * s} rx={18 * s} ry={16 * s} fill={p.belly} opacity={0.5} />
      <Path d={`M${cx},${cy + 4 * s} L${cx - 3 * s},${cy + 10 * s} L${cx + 3 * s},${cy + 10 * s} Z`} fill="#F0932B" />
      <Ellipse cx={cx - 24 * s} cy={cy + 16 * s} rx={8 * s} ry={16 * s} fill={p.accent} />
      <Ellipse cx={cx + 24 * s} cy={cy + 16 * s} rx={8 * s} ry={16 * s} fill={p.accent} />
      <Ellipse cx={cx - 8 * s} cy={cy + 42 * s} rx={6 * s} ry={3 * s} fill="#F0932B" />
      <Ellipse cx={cx + 8 * s} cy={cy + 42 * s} rx={6 * s} ry={3 * s} fill="#F0932B" />
    </G>
  );
}

function renderBunny(p, cx, cy, s) {
  return (
    <G>
      <Ellipse cx={cx - 8 * s} cy={cy - 34 * s} rx={6 * s} ry={18 * s} fill={p.body} />
      <Ellipse cx={cx - 8 * s} cy={cy - 34 * s} rx={3.5 * s} ry={14 * s} fill={p.belly} />
      <Ellipse cx={cx + 8 * s} cy={cy - 34 * s} rx={6 * s} ry={18 * s} fill={p.body} />
      <Ellipse cx={cx + 8 * s} cy={cy - 34 * s} rx={3.5 * s} ry={14 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={18 * s} ry={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 22 * s} rx={12 * s} ry={14 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 4 * s} r={20 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 2 * s} rx={3 * s} ry={2 * s} fill={p.accent} />
      <Line x1={cx - 18 * s} y1={cy + 1 * s} x2={cx - 6 * s} y2={cy + 3 * s} stroke={p.accent} strokeWidth={1 * s} opacity={0.5} />
      <Line x1={cx - 17 * s} y1={cy + 5 * s} x2={cx - 6 * s} y2={cy + 4 * s} stroke={p.accent} strokeWidth={1 * s} opacity={0.5} />
      <Line x1={cx + 18 * s} y1={cy + 1 * s} x2={cx + 6 * s} y2={cy + 3 * s} stroke={p.accent} strokeWidth={1 * s} opacity={0.5} />
      <Line x1={cx + 17 * s} y1={cy + 5 * s} x2={cx + 6 * s} y2={cy + 4 * s} stroke={p.accent} strokeWidth={1 * s} opacity={0.5} />
      <Ellipse cx={cx - 10 * s} cy={cy + 38 * s} rx={6 * s} ry={4 * s} fill={p.belly} />
      <Ellipse cx={cx + 10 * s} cy={cy + 38 * s} rx={6 * s} ry={4 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy + 38 * s} r={5 * s} fill={p.belly} />
    </G>
  );
}

function renderBear(p, cx, cy, s) {
  return (
    <G>
      <Circle cx={cx - 16 * s} cy={cy - 20 * s} r={8 * s} fill={p.body} />
      <Circle cx={cx - 16 * s} cy={cy - 20 * s} r={4.5 * s} fill={p.belly} />
      <Circle cx={cx + 16 * s} cy={cy - 20 * s} r={8 * s} fill={p.body} />
      <Circle cx={cx + 16 * s} cy={cy - 20 * s} r={4.5 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={20 * s} ry={24 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 22 * s} rx={14 * s} ry={16 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 4 * s} r={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 4 * s} rx={10 * s} ry={7 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 1 * s} rx={4 * s} ry={3 * s} fill="#2D3436" />
      <Ellipse cx={cx - 22 * s} cy={cy + 14 * s} rx={7 * s} ry={14 * s} fill={p.body} />
      <Ellipse cx={cx + 22 * s} cy={cy + 14 * s} rx={7 * s} ry={14 * s} fill={p.body} />
      <Ellipse cx={cx - 10 * s} cy={cy + 40 * s} rx={7 * s} ry={4 * s} fill={p.accent} />
      <Ellipse cx={cx + 10 * s} cy={cy + 40 * s} rx={7 * s} ry={4 * s} fill={p.accent} />
    </G>
  );
}

function renderCat(p, cx, cy, s) {
  return (
    <G>
      <Path d={`M${cx - 16 * s},${cy - 14 * s} L${cx - 22 * s},${cy - 34 * s} L${cx - 4 * s},${cy - 20 * s} Z`} fill={p.body} />
      <Path d={`M${cx - 16 * s},${cy - 16 * s} L${cx - 19 * s},${cy - 30 * s} L${cx - 7 * s},${cy - 20 * s} Z`} fill={p.belly} />
      <Path d={`M${cx + 16 * s},${cy - 14 * s} L${cx + 22 * s},${cy - 34 * s} L${cx + 4 * s},${cy - 20 * s} Z`} fill={p.body} />
      <Path d={`M${cx + 16 * s},${cy - 16 * s} L${cx + 19 * s},${cy - 30 * s} L${cx + 7 * s},${cy - 20 * s} Z`} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={16 * s} ry={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 22 * s} rx={10 * s} ry={14 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 4 * s} r={20 * s} fill={p.body} />
      <Path d={`M${cx},${cy + 1 * s} L${cx - 2.5 * s},${cy + 4 * s} L${cx + 2.5 * s},${cy + 4 * s} Z`} fill={p.accent} />
      <Line x1={cx - 20 * s} y1={cy + 2 * s} x2={cx - 6 * s} y2={cy + 4 * s} stroke="#636E72" strokeWidth={1 * s} />
      <Line x1={cx - 19 * s} y1={cy + 6 * s} x2={cx - 6 * s} y2={cy + 5 * s} stroke="#636E72" strokeWidth={1 * s} />
      <Line x1={cx + 20 * s} y1={cy + 2 * s} x2={cx + 6 * s} y2={cy + 4 * s} stroke="#636E72" strokeWidth={1 * s} />
      <Line x1={cx + 19 * s} y1={cy + 6 * s} x2={cx + 6 * s} y2={cy + 5 * s} stroke="#636E72" strokeWidth={1 * s} />
      <Path d={`M${cx + 14 * s},${cy + 34 * s} Q${cx + 28 * s},${cy + 20 * s} ${cx + 22 * s},${cy + 10 * s}`} stroke={p.body} strokeWidth={5 * s} strokeLinecap="round" fill="none" />
      <Ellipse cx={cx - 8 * s} cy={cy + 38 * s} rx={5 * s} ry={3 * s} fill={p.belly} />
      <Ellipse cx={cx + 8 * s} cy={cy + 38 * s} rx={5 * s} ry={3 * s} fill={p.belly} />
    </G>
  );
}

function renderFox(p, cx, cy, s) {
  return (
    <G>
      <Path d={`M${cx - 14 * s},${cy - 14 * s} L${cx - 20 * s},${cy - 36 * s} L${cx - 2 * s},${cy - 18 * s} Z`} fill={p.body} />
      <Path d={`M${cx - 13 * s},${cy - 18 * s} L${cx - 17 * s},${cy - 30 * s} L${cx - 5 * s},${cy - 20 * s} Z`} fill={p.belly} />
      <Path d={`M${cx + 14 * s},${cy - 14 * s} L${cx + 20 * s},${cy - 36 * s} L${cx + 2 * s},${cy - 18 * s} Z`} fill={p.body} />
      <Path d={`M${cx + 13 * s},${cy - 18 * s} L${cx + 17 * s},${cy - 30 * s} L${cx + 5 * s},${cy - 20 * s} Z`} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={17 * s} ry={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 24 * s} rx={11 * s} ry={12 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy - 2 * s} rx={20 * s} ry={18 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 4 * s} rx={12 * s} ry={10 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 1 * s} rx={3 * s} ry={2.5 * s} fill="#2D3436" />
      <Path d={`M${cx + 14 * s},${cy + 30 * s} Q${cx + 30 * s},${cy + 14 * s} ${cx + 24 * s},${cy + 4 * s}`} stroke={p.body} strokeWidth={7 * s} strokeLinecap="round" fill="none" />
      <Circle cx={cx + 24 * s} cy={cy + 4 * s} r={4 * s} fill={p.belly} />
      <Ellipse cx={cx - 8 * s} cy={cy + 38 * s} rx={5 * s} ry={3 * s} fill="#2D3436" />
      <Ellipse cx={cx + 8 * s} cy={cy + 38 * s} rx={5 * s} ry={3 * s} fill="#2D3436" />
    </G>
  );
}

function renderRobot(p, cx, cy, s) {
  return (
    <G>
      <Line x1={cx} y1={cy - 28 * s} x2={cx} y2={cy - 38 * s} stroke={p.accent} strokeWidth={2.5 * s} />
      <Circle cx={cx} cy={cy - 40 * s} r={4 * s} fill="#FECA57" />
      <Rect x={cx - 20 * s} y={cy - 26 * s} width={40 * s} height={32 * s} rx={8 * s} fill={p.body} />
      <Rect x={cx - 16 * s} y={cy - 22 * s} width={32 * s} height={24 * s} rx={4 * s} fill={p.belly} />
      <Rect x={cx - 18 * s} y={cy + 8 * s} width={36 * s} height={28 * s} rx={6 * s} fill={p.body} />
      <Rect x={cx - 10 * s} y={cy + 14 * s} width={20 * s} height={16 * s} rx={3 * s} fill={p.belly} />
      <Circle cx={cx - 4 * s} cy={cy + 20 * s} r={2 * s} fill={p.accent} />
      <Circle cx={cx + 4 * s} cy={cy + 20 * s} r={2 * s} fill="#FECA57" />
      <Circle cx={cx} cy={cy + 26 * s} r={2 * s} fill="#FF6B6B" />
      <Rect x={cx - 26 * s} y={cy + 10 * s} width={6 * s} height={20 * s} rx={3 * s} fill={p.accent} />
      <Rect x={cx + 20 * s} y={cy + 10 * s} width={6 * s} height={20 * s} rx={3 * s} fill={p.accent} />
      <Rect x={cx - 10 * s} y={cy + 36 * s} width={7 * s} height={8 * s} rx={3 * s} fill={p.accent} />
      <Rect x={cx + 3 * s} y={cy + 36 * s} width={7 * s} height={8 * s} rx={3 * s} fill={p.accent} />
    </G>
  );
}

function renderStar(p, cx, cy, s) {
  const points = 5;
  const outerR = 28 * s;
  const innerR = 14 * s;
  let d = '';
  for (let i = 0; i < points * 2; i++) {
    const angle = (Math.PI / points) * i - Math.PI / 2;
    const r = i % 2 === 0 ? outerR : innerR;
    const x = cx + r * Math.cos(angle);
    const y = (cy + 4 * s) + r * Math.sin(angle);
    d += (i === 0 ? 'M' : 'L') + `${x},${y}`;
  }
  d += 'Z';
  return (
    <G>
      <Path d={d} fill={p.body} stroke={p.accent} strokeWidth={2 * s} />
      <Circle cx={cx} cy={cy + 4 * s} r={10 * s} fill={p.belly} opacity={0.5} />
      <Ellipse cx={cx - 22 * s} cy={cy + 6 * s} rx={4 * s} ry={2 * s} fill={p.accent} />
      <Ellipse cx={cx + 22 * s} cy={cy + 6 * s} rx={4 * s} ry={2 * s} fill={p.accent} />
    </G>
  );
}

function renderPenguin(p, cx, cy, s) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 14 * s} rx={20 * s} ry={28 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={14 * s} ry={20 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 10 * s} r={18 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy - 6 * s} rx={13 * s} ry={10 * s} fill={p.belly} />
      <Path d={`M${cx - 4 * s},${cy + 2 * s} L${cx},${cy + 7 * s} L${cx + 4 * s},${cy + 2 * s}`} fill="#F0932B" />
      <Ellipse cx={cx - 22 * s} cy={cy + 10 * s} rx={6 * s} ry={16 * s} fill={p.accent} />
      <Ellipse cx={cx + 22 * s} cy={cy + 10 * s} rx={6 * s} ry={16 * s} fill={p.accent} />
      <Ellipse cx={cx - 8 * s} cy={cy + 40 * s} rx={7 * s} ry={3 * s} fill="#F0932B" />
      <Ellipse cx={cx + 8 * s} cy={cy + 40 * s} rx={7 * s} ry={3 * s} fill="#F0932B" />
    </G>
  );
}

function renderMonkey(p, cx, cy, s) {
  return (
    <G>
      <Circle cx={cx - 22 * s} cy={cy - 4 * s} r={8 * s} fill={p.body} />
      <Circle cx={cx - 22 * s} cy={cy - 4 * s} r={5 * s} fill={p.belly} />
      <Circle cx={cx + 22 * s} cy={cy - 4 * s} r={8 * s} fill={p.body} />
      <Circle cx={cx + 22 * s} cy={cy - 4 * s} r={5 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy + 18 * s} rx={18 * s} ry={22 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 22 * s} rx={12 * s} ry={14 * s} fill={p.belly} />
      <Circle cx={cx} cy={cy - 4 * s} r={20 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 2 * s} rx={14 * s} ry={11 * s} fill={p.belly} />
      <Ellipse cx={cx - 3 * s} cy={cy + 2 * s} rx={2 * s} ry={1.5 * s} fill="#2D3436" />
      <Ellipse cx={cx + 3 * s} cy={cy + 2 * s} rx={2 * s} ry={1.5 * s} fill="#2D3436" />
      <Ellipse cx={cx - 22 * s} cy={cy + 14 * s} rx={6 * s} ry={16 * s} fill={p.body} />
      <Ellipse cx={cx + 22 * s} cy={cy + 14 * s} rx={6 * s} ry={16 * s} fill={p.body} />
      <Path d={`M${cx + 16 * s},${cy + 34 * s} Q${cx + 32 * s},${cy + 28 * s} ${cx + 28 * s},${cy + 12 * s} Q${cx + 26 * s},${cy + 6 * s} ${cx + 30 * s},${cy + 2 * s}`}
        stroke={p.body} strokeWidth={4 * s} strokeLinecap="round" fill="none" />
      <Ellipse cx={cx - 8 * s} cy={cy + 38 * s} rx={6 * s} ry={4 * s} fill={p.accent} />
      <Ellipse cx={cx + 8 * s} cy={cy + 38 * s} rx={6 * s} ry={4 * s} fill={p.accent} />
    </G>
  );
}

function renderFrog(p, cx, cy, s) {
  return (
    <G>
      <Ellipse cx={cx} cy={cy + 16 * s} rx={22 * s} ry={20 * s} fill={p.body} />
      <Ellipse cx={cx} cy={cy + 20 * s} rx={16 * s} ry={14 * s} fill={p.belly} />
      <Ellipse cx={cx} cy={cy - 4 * s} rx={22 * s} ry={16 * s} fill={p.body} />
      <Circle cx={cx - 12 * s} cy={cy - 16 * s} r={8 * s} fill={p.body} />
      <Circle cx={cx + 12 * s} cy={cy - 16 * s} r={8 * s} fill={p.body} />
      <Path d={`M${cx - 14 * s},${cy + 6 * s} Q${cx},${cy + 12 * s} ${cx + 14 * s},${cy + 6 * s}`}
        stroke={p.accent} strokeWidth={2 * s} strokeLinecap="round" fill="none" />
      <Ellipse cx={cx - 20 * s} cy={cy + 30 * s} rx={6 * s} ry={4 * s} fill={p.accent} />
      <Ellipse cx={cx + 20 * s} cy={cy + 30 * s} rx={6 * s} ry={4 * s} fill={p.accent} />
      <Ellipse cx={cx - 16 * s} cy={cy + 36 * s} rx={8 * s} ry={4 * s} fill={p.body} />
      <Ellipse cx={cx + 16 * s} cy={cy + 36 * s} rx={8 * s} ry={4 * s} fill={p.body} />
    </G>
  );
}

const SPECIES_RENDERERS = {
  owl: renderOwl,
  bunny: renderBunny,
  bear: renderBear,
  cat: renderCat,
  fox: renderFox,
  robot: renderRobot,
  star: renderStar,
  penguin: renderPenguin,
  monkey: renderMonkey,
  frog: renderFrog,
};

// ── Animation hooks ─────────────────────────────────────────────

/**
 * Idle: gentle bouncing translateY
 */
function useIdleAnimation() {
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(translateY, {toValue: -6, duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        Animated.timing(translateY, {toValue: 0, duration: 1250, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
      ]),
    );
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [translateY]);

  return {transform: [{translateY}]};
}

/**
 * Celebrate: scale + rotate burst
 */
function useCelebrateAnimation() {
  const scale = useRef(new Animated.Value(1)).current;
  const rotate = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.sequence([
      Animated.parallel([
        Animated.timing(translateY, {toValue: -20, duration: 225, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: -8, duration: 225, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1.15, duration: 225, useNativeDriver: true}),
      ]),
      Animated.parallel([
        Animated.timing(translateY, {toValue: -12, duration: 225, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: 8, duration: 225, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1.1, duration: 225, useNativeDriver: true}),
      ]),
      Animated.parallel([
        Animated.timing(translateY, {toValue: -4, duration: 225, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: -3, duration: 225, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1.05, duration: 225, useNativeDriver: true}),
      ]),
      Animated.parallel([
        Animated.timing(translateY, {toValue: 0, duration: 225, useNativeDriver: true}),
        Animated.timing(rotate, {toValue: 0, duration: 225, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 225, useNativeDriver: true}),
      ]),
    ]);
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [scale, rotate, translateY]);

  const rotateInterp = rotate.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return {transform: [{translateY}, {scale}, {rotate: rotateInterp}]};
}

/**
 * Encourage: gentle sway left/right
 */
function useEncourageAnimation() {
  const rotate = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.sequence([
      Animated.timing(rotate, {toValue: -8, duration: 300, useNativeDriver: true}),
      Animated.timing(rotate, {toValue: 8, duration: 600, useNativeDriver: true}),
      Animated.timing(rotate, {toValue: 0, duration: 300, useNativeDriver: true}),
    ]);
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [rotate]);

  const rotateInterp = rotate.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return {transform: [{rotate: rotateInterp}]};
}

/**
 * Talk: looping opacity toggle to simulate mouth movement.
 * The whole character pulses subtly.
 */
function useTalkAnimation() {
  const scale = useRef(new Animated.Value(1)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {toValue: 1.02, duration: 200, useNativeDriver: true}),
        Animated.timing(scale, {toValue: 1, duration: 200, useNativeDriver: true}),
      ]),
    );
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [scale]);

  return {transform: [{scale}]};
}

/**
 * Think: head tilt + slight bounce
 */
function useThinkAnimation() {
  const rotate = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(rotate, {toValue: 5, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
          Animated.timing(translateY, {toValue: -3, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(rotate, {toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
          Animated.timing(translateY, {toValue: 0, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        ]),
      ]),
    );
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [rotate, translateY]);

  const rotateInterp = rotate.interpolate({
    inputRange: [-180, 180],
    outputRange: ['-180deg', '180deg'],
  });

  return {transform: [{translateY}, {rotate: rotateInterp}]};
}

/**
 * Sleep: slow subtle breathing scale
 */
function useSleepAnimation() {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const animRef = useRef(null);

  useEffect(() => {
    animRef.current = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {toValue: 0.98, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
          Animated.timing(translateY, {toValue: 2, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        ]),
        Animated.parallel([
          Animated.timing(scale, {toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
          Animated.timing(translateY, {toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true}),
        ]),
      ]),
    );
    animRef.current.start();
    return () => animRef.current && animRef.current.stop();
  }, [scale, translateY]);

  return {transform: [{translateY}, {scale}]};
}

function useNoAnimation() {
  return {};
}

const ANIMATION_HOOKS = {
  idle: useIdleAnimation,
  talk: useTalkAnimation,
  celebrate: useCelebrateAnimation,
  think: useThinkAnimation,
  encourage: useEncourageAnimation,
  sleep: useSleepAnimation,
};

// ── Celebrate sparkles (static positioned circles rendered once) ─
function CelebrateSparkles({cx, cy, svgScale}) {
  const sparkleColors = ['#FECA57', '#FF6B6B', '#6C63FF', '#00B894', '#FD79A8', '#54A0FF'];
  const r = 32 * svgScale;

  return (
    <G>
      {sparkleColors.map((color, i) => {
        const angle = (Math.PI * 2 / 6) * i;
        const sx = cx + r * Math.cos(angle);
        const sy = cy + r * Math.sin(angle);
        return (
          <Circle key={i} cx={sx} cy={sy} r={2 * svgScale} fill={color} opacity={0.8} />
        );
      })}
    </G>
  );
}

// ── Main Component ──────────────────────────────────────────────
function KidsCharacterInner({
  species,
  color,
  expression = 'happy',
  accessory = 'none',
  state = 'idle',
  size = 96,
  talking = false,
  onClick,
  seed,
  style,
}) {
  // Deterministic random selection from seed
  const resolved = useMemo(() => {
    const s = seed || `${species || ''}${color || ''}`;
    const h = hashSeed(s || String(Math.random()));
    return {
      species: species || SPECIES[h % SPECIES.length],
      color: color || PALETTE_NAMES[(h >> 4) % PALETTE_NAMES.length],
      accessory: accessory !== 'none' ? accessory : ACCESSORIES[(h >> 8) % ACCESSORIES.length],
    };
  }, [species, color, accessory, seed]);

  const palette = PALETTES[resolved.color] || PALETTES.purple;
  const vbW = 80;
  const vbH = 100;
  const cx = vbW / 2;
  const cy = vbH / 2 - 4;
  const svgScale = 1;

  const renderSpecies = SPECIES_RENDERERS[resolved.species] || renderOwl;

  // Effective animation state
  const effectiveState = talking ? 'talk' : state;

  // Use the appropriate animation hook
  // We call all hooks but only use the relevant one's result, to satisfy
  // React's rules of hooks (same number of hooks every render).
  const idleStyle = useIdleAnimation();
  const talkStyle = useTalkAnimation();
  const celebrateStyle = useCelebrateAnimation();
  const thinkStyle = useThinkAnimation();
  const encourageStyle = useEncourageAnimation();
  const sleepStyle = useSleepAnimation();

  const animStyleMap = {
    idle: idleStyle,
    talk: talkStyle,
    celebrate: celebrateStyle,
    think: thinkStyle,
    encourage: encourageStyle,
    sleep: sleepStyle,
  };

  const animStyle = animStyleMap[effectiveState] || {};

  const eyeY = resolved.species === 'frog' ? cy - 16 : resolved.species === 'robot' ? cy - 10 : cy - 8;
  const mouthY = resolved.species === 'robot' ? cy + 0 : cy + 6;
  const accTopY = cy - 26;

  const svgContent = (
    <Svg
      width={size}
      height={size * (vbH / vbW)}
      viewBox={`0 0 ${vbW} ${vbH}`}>
      {/* Species body */}
      {renderSpecies(palette, cx, cy, svgScale)}

      {/* Eyes */}
      <G>
        {renderEyes(expression, palette.body, cx, eyeY, svgScale)}
      </G>

      {/* Mouth */}
      {renderMouth(expression, talking, cx, mouthY, svgScale)}

      {/* Cheeks */}
      {renderCheeks(expression, palette.cheek, cx, eyeY, svgScale)}

      {/* Accessory */}
      {renderAccessory(resolved.accessory, cx, accTopY, svgScale, palette.accent)}

      {/* Celebrate sparkles */}
      {effectiveState === 'celebrate' && (
        <CelebrateSparkles cx={cx} cy={cy} svgScale={svgScale} />
      )}
    </Svg>
  );

  const wrapper = (
    <Animated.View style={[styles.container, animStyle, style]}>
      {svgContent}
    </Animated.View>
  );

  if (onClick) {
    return (
      <TouchableOpacity onPress={onClick} activeOpacity={0.7}>
        {wrapper}
      </TouchableOpacity>
    );
  }

  return wrapper;
}

// We wrap in a memo for performance since character rendering is expensive
const KidsCharacter = React.memo(KidsCharacterInner);
export default KidsCharacter;

// ── Static helpers for external use ─────────────────────────────
KidsCharacter.SPECIES = SPECIES;
KidsCharacter.PALETTES = PALETTE_NAMES;
KidsCharacter.ACCESSORIES = ACCESSORIES;
KidsCharacter.EXPRESSIONS = EXPRESSIONS;
KidsCharacter.STATES = STATES;

/**
 * Get a deterministic unique character for a given seed string.
 * Returns { species, color, accessory } that can be spread as props.
 */
KidsCharacter.fromSeed = function fromSeed(seedStr) {
  const h = hashSeed(seedStr);
  return {
    species: SPECIES[h % SPECIES.length],
    color: PALETTE_NAMES[(h >> 4) % PALETTE_NAMES.length],
    accessory: ACCESSORIES[(h >> 8) % ACCESSORIES.length],
  };
};

// ── Styles ──────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
  },
});
