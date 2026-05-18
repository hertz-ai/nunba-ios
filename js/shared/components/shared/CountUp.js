/**
 * CountUp — animates a number from 0 (or `from`) to `value` over
 * `duration` ms.  Used for resonance scores, achievement counts,
 * streaks, season ranks — anywhere a number should ARRIVE with
 * weight rather than just appearing.
 *
 * Why users would love this (Part X.4.5 Gamification surface):
 *   - A score that ticks up from 0 → 847 feels EARNED.  A score
 *     that just appears feels like a number.  Same delta, very
 *     different psychological weight.
 *   - Reddit / Duolingo / Strava all do this on stat surfaces;
 *     it's the cheap micro-interaction that signals "this number
 *     matters."
 *
 * Multi-hat self-critique:
 *   - Designer: ease-out interpolation so the animation slows as it
 *     approaches the target (vs linear).  Locale-aware formatting
 *     via toLocaleString so 1247 renders as 1,247.
 *   - A11y: TalkBack/VoiceOver gets the FINAL value as
 *     accessibilityLabel — not the intermediate ticks (which would
 *     spam the screen reader).  Animation is purely visual.
 *   - Engineer: uses setInterval with a frame budget (~60fps target)
 *     + clears on unmount.  No native dep.
 *   - Trust & Safety: numbers shown are what the server returns;
 *     this only animates the reveal.
 *
 * Props:
 *   - value      : target number
 *   - from?      : starting number (default 0)
 *   - duration?  : ms (default 800)
 *   - format?    : (n: number) => string (default: toLocaleString)
 *   - style?     : Text style
 *   - testID?
 *
 * Plan ref: Part X.4.5 + Part X.7.1 (P6 tests).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Text } from 'react-native';

const DEFAULT_DURATION = 800;

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

const CountUp = ({
  value = 0,
  from = 0,
  duration = DEFAULT_DURATION,
  format,
  style,
  testID = 'CountUp',
}) => {
  const [current, setCurrent] = useState(from);
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  useEffect(() => {
    // Trivial cases: instant set + done.
    if (from === value || duration <= 0) {
      setCurrent(value);
      return undefined;
    }
    const startTime = Date.now();
    const startValue = from;
    const delta = value - startValue;

    const tick = () => {
      if (!mountedRef.current) return;
      const elapsed = Date.now() - startTime;
      const t = Math.min(1, elapsed / duration);
      const eased = easeOut(t);
      const next = Math.round(startValue + delta * eased);
      setCurrent(next);
      if (t < 1) {
        rafRef.current = setTimeout(tick, 16); // ~60fps
      }
    };
    const rafRef = { current: setTimeout(tick, 16) };
    return () => {
      if (rafRef.current) clearTimeout(rafRef.current);
    };
  }, [value, from, duration]);

  const text = typeof format === 'function'
    ? format(current)
    : (current || 0).toLocaleString();

  return (
    <Text
      style={style}
      accessibilityLabel={(value || 0).toLocaleString()}
      testID={testID}
    >
      {text}
    </Text>
  );
};

export default CountUp;
