/**
 * Extra SVG sprites — extends the canonical 10 to ~60 total.  These
 * are procedural shapes (simple geometric primitives) so they all
 * register at < 1 KB each.  Recolor tokens %P0%/%P1%/%P2% are
 * respected by KidsCanvas at render time.
 */

import { registerSvg } from '../KidsCanvas';

const EXTRAS = {
  // ─── More fruits ─────────────────────────────────────────────────
  'fruits/grapes': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="35" cy="40" r="10" fill="%P0%"/><circle cx="50" cy="38" r="10" fill="%P0%"/>
    <circle cx="65" cy="40" r="10" fill="%P0%"/><circle cx="42" cy="58" r="10" fill="%P0%"/>
    <circle cx="58" cy="58" r="10" fill="%P0%"/><circle cx="50" cy="74" r="10" fill="%P0%"/>
    <path d="M45,18 Q50,10 56,14" stroke="%P1%" stroke-width="3" fill="none"/>
  </svg>`,
  'fruits/strawberry': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50,30 C30,30 25,55 50,88 C75,55 70,30 50,30 Z" fill="%P0%"/>
    <polygon points="50,16 38,30 50,28 62,30" fill="%P1%"/>
    <circle cx="40" cy="48" r="2" fill="%P2%"/><circle cx="50" cy="52" r="2" fill="%P2%"/>
    <circle cx="60" cy="48" r="2" fill="%P2%"/><circle cx="45" cy="62" r="2" fill="%P2%"/>
    <circle cx="55" cy="62" r="2" fill="%P2%"/>
  </svg>`,
  'fruits/watermelon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M14,52 A40,40 0 0 0 86,52 L78,52 A32,32 0 0 1 22,52 Z" fill="%P0%"/>
    <path d="M22,52 A28,28 0 0 1 78,52" fill="%P1%"/>
    <circle cx="36" cy="44" r="2" fill="#222"/><circle cx="50" cy="42" r="2" fill="#222"/>
    <circle cx="64" cy="44" r="2" fill="#222"/>
  </svg>`,
  'fruits/lemon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="50" rx="32" ry="22" fill="%P0%" transform="rotate(-15 50 50)"/>
    <ellipse cx="40" cy="40" rx="6" ry="3" fill="%P2%" opacity="0.5" transform="rotate(-15 40 40)"/>
  </svg>`,
  'fruits/pineapple': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="58" rx="22" ry="28" fill="%P0%"/>
    <g stroke="%P1%" stroke-width="1" fill="none">
      <line x1="35" y1="44" x2="65" y2="44"/><line x1="32" y1="56" x2="68" y2="56"/>
      <line x1="35" y1="68" x2="65" y2="68"/><line x1="40" y1="80" x2="60" y2="80"/>
    </g>
    <polygon points="42,28 38,12 44,18 48,8 52,18 56,12 58,28" fill="%P1%"/>
  </svg>`,

  // ─── More animals ────────────────────────────────────────────────
  'animals/rabbit': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="64" rx="22" ry="20" fill="%P0%"/>
    <circle cx="50" cy="46" r="18" fill="%P0%"/>
    <ellipse cx="42" cy="22" rx="5" ry="14" fill="%P0%"/>
    <ellipse cx="58" cy="22" rx="5" ry="14" fill="%P0%"/>
    <circle cx="43" cy="46" r="2.5" fill="#000"/>
    <circle cx="57" cy="46" r="2.5" fill="#000"/>
    <ellipse cx="50" cy="54" rx="3" ry="2" fill="%P1%"/>
  </svg>`,
  'animals/bird': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="56" rx="26" ry="20" fill="%P0%"/>
    <circle cx="68" cy="44" r="14" fill="%P0%"/>
    <polygon points="80,42 92,40 80,48" fill="%P1%"/>
    <circle cx="70" cy="42" r="2" fill="#000"/>
    <path d="M24,60 Q14,68 30,70" fill="%P1%"/>
  </svg>`,
  'animals/fish': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="46" cy="50" rx="28" ry="18" fill="%P0%"/>
    <polygon points="78,50 96,38 96,62" fill="%P0%"/>
    <circle cx="34" cy="46" r="2.5" fill="#000"/>
    <path d="M50,40 Q55,45 60,40 M50,60 Q55,55 60,60" stroke="%P1%" stroke-width="2" fill="none"/>
  </svg>`,
  'animals/elephant': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="52" cy="56" rx="32" ry="22" fill="%P0%"/>
    <circle cx="30" cy="48" r="18" fill="%P0%"/>
    <path d="M16,52 Q8,68 14,80 Q20,76 18,66" fill="%P0%"/>
    <ellipse cx="50" cy="34" rx="14" ry="8" fill="%P1%" opacity="0.5"/>
    <circle cx="26" cy="44" r="2" fill="#000"/>
  </svg>`,
  'animals/lion': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="28" fill="%P1%"/>
    <circle cx="50" cy="50" r="20" fill="%P0%"/>
    <circle cx="42" cy="48" r="2.5" fill="#000"/>
    <circle cx="58" cy="48" r="2.5" fill="#000"/>
    <ellipse cx="50" cy="58" rx="4" ry="2" fill="#000"/>
    <path d="M46,62 Q50,66 54,62" stroke="#000" stroke-width="1.5" fill="none"/>
  </svg>`,
  'animals/cow': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="60" rx="30" ry="22" fill="%P0%"/>
    <circle cx="50" cy="36" r="18" fill="%P0%"/>
    <ellipse cx="34" cy="34" rx="6" ry="10" fill="%P1%"/>
    <ellipse cx="66" cy="34" rx="6" ry="10" fill="%P1%"/>
    <ellipse cx="36" cy="68" rx="8" ry="6" fill="%P1%"/>
    <ellipse cx="60" cy="58" rx="6" ry="5" fill="%P1%"/>
    <circle cx="44" cy="36" r="2" fill="#000"/><circle cx="56" cy="36" r="2" fill="#000"/>
  </svg>`,
  'animals/duck': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="42" cy="62" rx="26" ry="18" fill="%P0%"/>
    <circle cx="64" cy="44" r="14" fill="%P0%"/>
    <polygon points="74,46 92,44 76,52" fill="%P1%"/>
    <circle cx="66" cy="42" r="2" fill="#000"/>
    <path d="M22,68 L14,76" stroke="%P1%" stroke-width="3"/>
    <path d="M28,72 L20,80" stroke="%P1%" stroke-width="3"/>
  </svg>`,

  // ─── More vehicles ───────────────────────────────────────────────
  'vehicles/bike': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="26" cy="68" r="14" fill="none" stroke="%P0%" stroke-width="3"/>
    <circle cx="74" cy="68" r="14" fill="none" stroke="%P0%" stroke-width="3"/>
    <path d="M26,68 L50,40 L74,68" stroke="%P0%" stroke-width="3" fill="none"/>
    <line x1="50" y1="40" x2="40" y2="32" stroke="%P0%" stroke-width="3"/>
    <circle cx="50" cy="40" r="3" fill="%P1%"/>
  </svg>`,
  'vehicles/truck': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="44" y="30" width="48" height="36" rx="4" fill="%P0%"/>
    <rect x="8" y="42" width="40" height="24" rx="4" fill="%P1%"/>
    <rect x="14" y="48" width="14" height="12" fill="#FFFFFF" opacity="0.6"/>
    <circle cx="22" cy="74" r="8" fill="#222"/>
    <circle cx="58" cy="74" r="8" fill="#222"/>
    <circle cx="80" cy="74" r="8" fill="#222"/>
  </svg>`,
  'vehicles/airplane': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M10,50 L40,42 L62,30 L78,30 L72,50 L78,70 L62,70 L40,58 L10,50 Z" fill="%P0%"/>
    <rect x="64" y="48" width="14" height="4" fill="%P1%"/>
  </svg>`,
  'vehicles/boat': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="50,16 50,52 72,40" fill="%P1%"/>
    <line x1="50" y1="16" x2="50" y2="58" stroke="#444" stroke-width="2"/>
    <path d="M12,60 L88,60 L78,82 L22,82 Z" fill="%P0%"/>
    <path d="M16,72 Q50,80 84,72" stroke="#FFFFFF" stroke-width="2" fill="none" opacity="0.6"/>
  </svg>`,
  'vehicles/rocket': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50,10 C58,10 64,20 64,40 L64,72 L36,72 L36,40 C36,20 42,10 50,10 Z" fill="%P0%"/>
    <circle cx="50" cy="34" r="6" fill="%P1%"/>
    <polygon points="36,72 22,86 36,82" fill="%P1%"/>
    <polygon points="64,72 78,86 64,82" fill="%P1%"/>
    <polygon points="46,82 50,92 54,82" fill="%P2%"/>
  </svg>`,
  'vehicles/train': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="14" y="32" width="72" height="40" rx="6" fill="%P0%"/>
    <rect x="22" y="40" width="14" height="14" fill="#FFFFFF" opacity="0.65"/>
    <rect x="44" y="40" width="14" height="14" fill="#FFFFFF" opacity="0.65"/>
    <rect x="66" y="40" width="14" height="14" fill="#FFFFFF" opacity="0.65"/>
    <rect x="10" y="68" width="80" height="6" fill="%P1%"/>
    <circle cx="26" cy="80" r="6" fill="#222"/>
    <circle cx="50" cy="80" r="6" fill="#222"/>
    <circle cx="74" cy="80" r="6" fill="#222"/>
  </svg>`,

  // ─── Shapes ──────────────────────────────────────────────────────
  'shapes/circle': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="%P0%"/></svg>`,
  'shapes/square': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="4" fill="%P0%"/></svg>`,
  'shapes/triangle': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,16 86,80 14,80" fill="%P0%"/></svg>`,
  'shapes/heart': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M50,86 L18,52 C10,42 14,22 30,22 C40,22 50,32 50,42 C50,32 60,22 70,22 C86,22 90,42 82,52 Z" fill="%P0%"/></svg>`,
  'shapes/diamond': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,14 86,50 50,86 14,50" fill="%P0%"/></svg>`,
  'shapes/hexagon': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,12 86,32 86,68 50,88 14,68 14,32" fill="%P0%"/></svg>`,
  'shapes/star5': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><polygon points="50,10 62,38 92,40 68,60 78,90 50,72 22,90 32,60 8,40 38,38" fill="%P0%"/></svg>`,

  // ─── Weather & nature ────────────────────────────────────────────
  'weather/cloud': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="30" cy="56" rx="18" ry="14" fill="%P0%"/>
    <ellipse cx="50" cy="48" rx="22" ry="18" fill="%P0%"/>
    <ellipse cx="70" cy="56" rx="18" ry="14" fill="%P0%"/>
  </svg>`,
  'weather/rain': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="38" rx="32" ry="14" fill="%P0%"/>
    <line x1="32" y1="58" x2="28" y2="76" stroke="%P1%" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="58" x2="46" y2="80" stroke="%P1%" stroke-width="3" stroke-linecap="round"/>
    <line x1="68" y1="58" x2="64" y2="76" stroke="%P1%" stroke-width="3" stroke-linecap="round"/>
  </svg>`,
  'weather/snow': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <g stroke="%P0%" stroke-width="3" stroke-linecap="round">
      <line x1="50" y1="20" x2="50" y2="80"/><line x1="20" y1="50" x2="80" y2="50"/>
      <line x1="28" y1="28" x2="72" y2="72"/><line x1="72" y1="28" x2="28" y2="72"/>
    </g>
  </svg>`,
  'weather/lightning': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="56,8 22,52 44,52 38,92 76,40 50,40" fill="%P0%"/>
  </svg>`,
  'nature/tree': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="44" y="60" width="12" height="30" fill="%P1%"/>
    <circle cx="50" cy="42" r="28" fill="%P0%"/>
  </svg>`,
  'nature/flower': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="32" r="10" fill="%P0%"/><circle cx="34" cy="44" r="10" fill="%P0%"/>
    <circle cx="66" cy="44" r="10" fill="%P0%"/><circle cx="40" cy="60" r="10" fill="%P0%"/>
    <circle cx="60" cy="60" r="10" fill="%P0%"/><circle cx="50" cy="48" r="8" fill="%P2%"/>
    <rect x="48" y="70" width="4" height="20" fill="%P1%"/>
  </svg>`,
  'nature/mountain': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <polygon points="10,80 36,30 50,52 64,30 90,80" fill="%P0%"/>
    <polygon points="36,30 28,42 44,42" fill="#FFFFFF"/>
    <polygon points="64,30 56,42 72,42" fill="#FFFFFF"/>
  </svg>`,

  // ─── Food ────────────────────────────────────────────────────────
  'food/pizza': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M50,14 L86,76 L14,76 Z" fill="%P0%"/>
    <circle cx="40" cy="56" r="4" fill="%P1%"/><circle cx="58" cy="50" r="4" fill="%P1%"/>
    <circle cx="50" cy="66" r="4" fill="%P1%"/><circle cx="64" cy="64" r="4" fill="%P1%"/>
  </svg>`,
  'food/burger': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M14,40 A36,30 0 0 1 86,40 L14,40 Z" fill="%P0%"/>
    <rect x="14" y="42" width="72" height="8" fill="%P1%"/>
    <rect x="14" y="52" width="72" height="6" fill="%P2%"/>
    <path d="M14,60 L86,60 A36,16 0 0 1 14,60 Z" fill="%P0%"/>
  </svg>`,
  'food/icecream': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="36" r="20" fill="%P0%"/>
    <circle cx="50" cy="32" r="18" fill="%P2%"/>
    <polygon points="34,52 50,90 66,52" fill="%P1%"/>
    <line x1="40" y1="62" x2="44" y2="68" stroke="#888" stroke-width="1"/>
    <line x1="56" y1="62" x2="60" y2="68" stroke="#888" stroke-width="1"/>
  </svg>`,
  'food/donut': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="34" fill="%P0%"/>
    <circle cx="50" cy="50" r="12" fill="#FFF"/>
    <circle cx="32" cy="38" r="2" fill="%P1%"/><circle cx="68" cy="38" r="2" fill="%P1%"/>
    <circle cx="74" cy="56" r="2" fill="%P2%"/><circle cx="26" cy="58" r="2" fill="%P2%"/>
    <circle cx="44" cy="74" r="2" fill="%P1%"/><circle cx="58" cy="74" r="2" fill="%P2%"/>
  </svg>`,
  'food/cake': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="18" y="46" width="64" height="34" fill="%P0%"/>
    <path d="M18,46 Q34,38 50,46 Q66,38 82,46" fill="%P2%"/>
    <rect x="48" y="22" width="4" height="20" fill="%P1%"/>
    <ellipse cx="50" cy="22" rx="3" ry="4" fill="#FFD700"/>
  </svg>`,

  // ─── Sports & toys ──────────────────────────────────────────────
  'sports/basketball': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="34" fill="%P0%"/>
    <path d="M16,50 A34,34 0 0 1 84,50" stroke="%P1%" stroke-width="2" fill="none"/>
    <path d="M50,16 Q40,50 50,84" stroke="%P1%" stroke-width="2" fill="none"/>
    <path d="M50,16 Q60,50 50,84" stroke="%P1%" stroke-width="2" fill="none"/>
  </svg>`,
  'sports/soccer': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="34" fill="%P0%"/>
    <polygon points="50,30 64,40 58,56 42,56 36,40" fill="%P1%"/>
    <polygon points="50,30 36,40 28,26" fill="%P1%" opacity="0.7"/>
    <polygon points="50,30 64,40 72,26" fill="%P1%" opacity="0.7"/>
  </svg>`,
  'toys/blocks': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="14" y="46" width="34" height="34" fill="%P0%"/>
    <rect x="52" y="46" width="34" height="34" fill="%P1%"/>
    <rect x="32" y="14" width="34" height="34" fill="%P2%"/>
    <text x="31" y="68" font-size="22" font-weight="700" fill="#FFF" text-anchor="middle">A</text>
    <text x="69" y="68" font-size="22" font-weight="700" fill="#FFF" text-anchor="middle">B</text>
    <text x="49" y="36" font-size="22" font-weight="700" fill="#FFF" text-anchor="middle">C</text>
  </svg>`,
  'toys/teddy': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="34" cy="32" r="8" fill="%P0%"/><circle cx="66" cy="32" r="8" fill="%P0%"/>
    <circle cx="50" cy="46" r="22" fill="%P0%"/>
    <ellipse cx="50" cy="68" rx="26" ry="20" fill="%P0%"/>
    <circle cx="42" cy="44" r="2.5" fill="#000"/><circle cx="58" cy="44" r="2.5" fill="#000"/>
    <ellipse cx="50" cy="52" rx="3" ry="2" fill="%P1%"/>
  </svg>`,

  // ─── Household ───────────────────────────────────────────────────
  'household/chair': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="28" y="20" width="44" height="40" rx="3" fill="%P0%"/>
    <rect x="28" y="56" width="44" height="8" fill="%P1%"/>
    <rect x="28" y="64" width="6" height="22" fill="%P1%"/>
    <rect x="66" y="64" width="6" height="22" fill="%P1%"/>
  </svg>`,
  'household/cup': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <path d="M28,28 L72,28 L66,80 L34,80 Z" fill="%P0%"/>
    <path d="M70,38 Q86,42 86,56 Q86,70 70,68" fill="none" stroke="%P0%" stroke-width="4"/>
    <path d="M40,24 Q44,16 48,24" stroke="%P1%" stroke-width="2" fill="none"/>
    <path d="M52,24 Q56,16 60,24" stroke="%P1%" stroke-width="2" fill="none"/>
  </svg>`,
  'household/clock': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="36" fill="%P0%"/>
    <circle cx="50" cy="50" r="30" fill="#FFFFFF"/>
    <text x="50" y="28" font-size="8" fill="#000" text-anchor="middle">12</text>
    <text x="76" y="54" font-size="8" fill="#000" text-anchor="middle">3</text>
    <text x="50" y="78" font-size="8" fill="#000" text-anchor="middle">6</text>
    <text x="24" y="54" font-size="8" fill="#000" text-anchor="middle">9</text>
    <line x1="50" y1="50" x2="50" y2="32" stroke="#000" stroke-width="3" stroke-linecap="round"/>
    <line x1="50" y1="50" x2="64" y2="50" stroke="#000" stroke-width="2" stroke-linecap="round"/>
    <circle cx="50" cy="50" r="3" fill="#000"/>
  </svg>`,
  'household/book': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="20" y="20" width="60" height="64" rx="3" fill="%P0%"/>
    <rect x="26" y="28" width="48" height="4" fill="%P1%"/>
    <rect x="26" y="38" width="48" height="3" fill="%P1%" opacity="0.6"/>
    <rect x="26" y="48" width="40" height="3" fill="%P1%" opacity="0.6"/>
    <rect x="26" y="58" width="44" height="3" fill="%P1%" opacity="0.6"/>
    <rect x="26" y="68" width="36" height="3" fill="%P1%" opacity="0.6"/>
  </svg>`,

  // ─── Instruments ─────────────────────────────────────────────────
  'instruments/drum': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <ellipse cx="50" cy="32" rx="28" ry="8" fill="%P2%"/>
    <rect x="22" y="32" width="56" height="40" fill="%P0%"/>
    <ellipse cx="50" cy="72" rx="28" ry="8" fill="%P0%"/>
    <path d="M22,40 L24,68 M30,38 L26,66 M38,36 L34,64" stroke="%P1%" stroke-width="1.5"/>
    <path d="M62,36 L66,64 M70,38 L74,66 M78,40 L76,68" stroke="%P1%" stroke-width="1.5"/>
  </svg>`,
  'instruments/guitar': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="38" cy="64" r="24" fill="%P0%"/>
    <circle cx="38" cy="64" r="8" fill="#000"/>
    <rect x="56" y="24" width="10" height="48" fill="%P1%"/>
    <rect x="56" y="14" width="10" height="14" fill="%P2%"/>
  </svg>`,
  'instruments/piano': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <rect x="10" y="38" width="80" height="40" fill="#FFFFFF"/>
    <rect x="20" y="38" width="6" height="24" fill="#000"/>
    <rect x="36" y="38" width="6" height="24" fill="#000"/>
    <rect x="56" y="38" width="6" height="24" fill="#000"/>
    <rect x="72" y="38" width="6" height="24" fill="#000"/>
    <rect x="10" y="34" width="80" height="6" fill="%P0%"/>
  </svg>`,

  // ─── Emotions ────────────────────────────────────────────────────
  'emotions/happy': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" fill="%P0%"/>
    <circle cx="38" cy="42" r="4" fill="#000"/><circle cx="62" cy="42" r="4" fill="#000"/>
    <path d="M30,58 Q50,80 70,58" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`,
  'emotions/sad': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" fill="%P0%"/>
    <circle cx="38" cy="44" r="4" fill="#000"/><circle cx="62" cy="44" r="4" fill="#000"/>
    <path d="M30,72 Q50,56 70,72" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`,
  'emotions/surprised': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" fill="%P0%"/>
    <circle cx="38" cy="42" r="5" fill="#000"/><circle cx="62" cy="42" r="5" fill="#000"/>
    <circle cx="50" cy="64" r="8" fill="#000"/>
  </svg>`,
  'emotions/love': `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="38" fill="%P0%"/>
    <path d="M30,42 Q34,36 38,42 Q42,36 46,42 Q42,48 38,52 Q34,48 30,42" fill="#FF1744"/>
    <path d="M54,42 Q58,36 62,42 Q66,36 70,42 Q66,48 62,52 Q58,48 54,42" fill="#FF1744"/>
    <path d="M30,58 Q50,76 70,58" stroke="#000" stroke-width="3" fill="none" stroke-linecap="round"/>
  </svg>`,
};

let registered = false;
export function registerExtras() {
  if (registered) return;
  registered = true;
  Object.entries(EXTRAS).forEach(([id, xml]) => registerSvg(id, xml.trim()));
}

export const EXTRA_IDS = Object.keys(EXTRAS);
