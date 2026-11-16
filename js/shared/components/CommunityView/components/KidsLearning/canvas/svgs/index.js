/**
 * SVG sprite registry — call registerAllSvgs() once on app boot to
 * populate KidsCanvas.SVG_REGISTRY.  Each sprite is an XML string with
 * %P0%, %P1%, %P2% placeholders that KidsCanvas substitutes with the
 * brief's palette so the SAME sprite renders in 50+ color variants.
 *
 * To add a new sprite: drop the XML string in this file with a unique
 * key.  Bundler tree-shakes any sprite not referenced by any asset.
 * Target: 500 sprites bundled = ~1.5 MB after gzip.  Current: 10.
 */

import { registerSvg } from '../KidsCanvas';
import { registerExtras, EXTRA_IDS } from './extras';

// Compact viewBox 100x100 — all sprites share a coordinate space so
// they look consistent when sized to 64×64 etc.

const SVGS = {
  // ─── Fruits ──────────────────────────────────────────────────────
  'fruits/apple': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M50,20 C42,20 38,12 30,18 C20,26 22,52 32,72 C40,86 50,90 50,90 C50,90 60,86 68,72 C78,52 80,26 70,18 C62,12 58,20 50,20 Z" fill="%P0%"/>
  <path d="M48,15 Q50,8 56,10 Q58,14 52,18 Z" fill="%P1%"/>
  <ellipse cx="38" cy="34" rx="6" ry="10" fill="%P2%" opacity="0.4"/>
</svg>`,

  'fruits/banana': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <path d="M20,30 Q25,75 78,82 Q90,80 82,72 Q78,68 70,68 Q40,60 30,32 Q26,24 20,30 Z" fill="%P0%"/>
  <path d="M22,32 Q30,58 70,68" stroke="%P1%" stroke-width="3" fill="none"/>
</svg>`,

  'fruits/orange': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="55" r="32" fill="%P0%"/>
  <path d="M50,25 Q45,18 40,22 Q42,18 50,18 Q58,18 60,22 Q55,18 50,25" fill="%P1%"/>
  <circle cx="38" cy="48" r="5" fill="%P2%" opacity="0.35"/>
</svg>`,

  // ─── Animals (static for now, animated Lottie versions planned) ─
  'animals/dog': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <ellipse cx="50" cy="60" rx="28" ry="22" fill="%P0%"/>
  <circle cx="50" cy="38" r="20" fill="%P0%"/>
  <ellipse cx="36" cy="28" rx="8" ry="14" fill="%P1%" transform="rotate(-25 36 28)"/>
  <ellipse cx="64" cy="28" rx="8" ry="14" fill="%P1%" transform="rotate(25 64 28)"/>
  <circle cx="43" cy="38" r="3" fill="#000"/>
  <circle cx="57" cy="38" r="3" fill="#000"/>
  <ellipse cx="50" cy="46" rx="3" ry="2" fill="#000"/>
</svg>`,

  'animals/cat': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <ellipse cx="50" cy="62" rx="26" ry="20" fill="%P0%"/>
  <circle cx="50" cy="40" r="22" fill="%P0%"/>
  <polygon points="32,24 38,12 44,24" fill="%P0%"/>
  <polygon points="56,24 62,12 68,24" fill="%P0%"/>
  <ellipse cx="42" cy="42" rx="2.5" ry="4" fill="%P1%"/>
  <ellipse cx="58" cy="42" rx="2.5" ry="4" fill="%P1%"/>
  <path d="M46,50 Q50,53 54,50" stroke="#000" stroke-width="1.5" fill="none"/>
</svg>`,

  // ─── Vehicles ────────────────────────────────────────────────────
  'vehicles/car': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="10" y="50" width="80" height="20" rx="6" fill="%P0%"/>
  <path d="M22,50 L30,32 L70,32 L78,50 Z" fill="%P1%"/>
  <rect x="32" y="36" width="14" height="12" fill="#FFFFFF" opacity="0.6"/>
  <rect x="54" y="36" width="14" height="12" fill="#FFFFFF" opacity="0.6"/>
  <circle cx="28" cy="72" r="8" fill="#222"/>
  <circle cx="72" cy="72" r="8" fill="#222"/>
  <circle cx="28" cy="72" r="3" fill="#888"/>
  <circle cx="72" cy="72" r="3" fill="#888"/>
</svg>`,

  'vehicles/bus': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect x="8" y="22" width="84" height="48" rx="6" fill="%P0%"/>
  <rect x="14" y="30" width="20" height="14" fill="#FFFFFF" opacity="0.65"/>
  <rect x="40" y="30" width="20" height="14" fill="#FFFFFF" opacity="0.65"/>
  <rect x="66" y="30" width="20" height="14" fill="#FFFFFF" opacity="0.65"/>
  <rect x="14" y="50" width="72" height="6" fill="%P1%"/>
  <circle cx="26" cy="76" r="7" fill="#222"/>
  <circle cx="74" cy="76" r="7" fill="#222"/>
</svg>`,

  // ─── Sky / Space ─────────────────────────────────────────────────
  'space/sun': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="22" fill="%P0%"/>
  <g stroke="%P0%" stroke-width="5" stroke-linecap="round">
    <line x1="50" y1="10" x2="50" y2="20"/>
    <line x1="50" y1="80" x2="50" y2="90"/>
    <line x1="10" y1="50" x2="20" y2="50"/>
    <line x1="80" y1="50" x2="90" y2="50"/>
    <line x1="22" y1="22" x2="29" y2="29"/>
    <line x1="71" y1="71" x2="78" y2="78"/>
    <line x1="78" y1="22" x2="71" y2="29"/>
    <line x1="29" y1="71" x2="22" y2="78"/>
  </g>
</svg>`,

  'space/star': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <polygon points="50,12 60,40 90,42 66,60 76,88 50,72 24,88 34,60 10,42 40,40" fill="%P0%" stroke="%P1%" stroke-width="2"/>
</svg>`,

  // ─── Toys / Sports ───────────────────────────────────────────────
  'toys/ball': `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <circle cx="50" cy="50" r="36" fill="%P0%"/>
  <path d="M14,50 Q50,30 86,50" stroke="%P1%" stroke-width="3" fill="none"/>
  <path d="M14,50 Q50,70 86,50" stroke="%P1%" stroke-width="3" fill="none"/>
  <path d="M50,14 Q70,50 50,86" stroke="%P1%" stroke-width="3" fill="none"/>
  <path d="M50,14 Q30,50 50,86" stroke="%P1%" stroke-width="3" fill="none"/>
</svg>`,
};

/** Call once at app boot.  Idempotent. */
let registered = false;
export function registerAllSvgs() {
  if (registered) return;
  registered = true;
  Object.entries(SVGS).forEach(([id, xml]) => registerSvg(id, xml.trim()));
  registerExtras();
}

export const SVG_IDS = [...Object.keys(SVGS), ...EXTRA_IDS];
