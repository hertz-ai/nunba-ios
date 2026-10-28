/**
 * UniqueGameRenderer — single renderer that consumes a server-composed
 * brief and renders one of 12 mechanic shapes.  Crucially: every brief
 * differs in (mechanic, art_style, palette, character, asset set),
 * so two visits never look alike.  No template registry, no shared
 * layout across briefs.
 *
 * Brief shape (produced by services/kidsAssetGen.composeUniqueBrief):
 *   {
 *     id, source, theme, category, mechanic, mechanic_name, art_style,
 *     palette: { id, colors:[hex,...] },
 *     character: { id, name, emoji, vibe },
 *     bgm: { mood, duration, url? },
 *     assets: [{ id, name, emoji, art_style, palette, tags }, ...],
 *     objective, instructions_tts,
 *     stage: { timer_sec, win_condition },
 *     reward: { animation, sfx, tts },
 *   }
 *
 * Mechanic dispatch is internal to this file — adding a 13th mechanic
 * means adding a small render fn here, not creating a new template
 * file.  By construction, the renderer can never go monotonous because
 * every brief drives layout, palette, motion, character, and BGM.
 *
 * Speech Companion invariants honored (per HARTOS goal_seeding.py:1479
 * `bootstrap_speech_companion` recipe):
 *   - never show "Wrong" / "almost" / "not quite"
 *   - never display score/streak/percent to the child
 *   - every attempt is a win; PhoneticSimilarity.encouragement() picks
 *     the response
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import useSpeechRecognition from '../../../../hooks/useSpeechRecognition';
import useMicAmplitude, { MIC_STATUS } from '../../../../hooks/useMicAmplitude';
import GameSounds, { GAME_BGM, SoundEvents } from './shared/SoundManager';
import { similarity, encouragement } from './shared/PhoneticSimilarity';
import { spriteUrl, briefSignature } from '../../../../services/kidsAssetGen';
import KidsCanvas, { hasRichSprite } from './canvas/KidsCanvas';
import { registerAllSvgs } from './canvas/svgs';

// One-time registration of bundled SVG sprites at module load.
// Idempotent: subsequent calls are no-ops.
registerAllSvgs();
import { kidsColors, kidsFontSize, kidsSpacing } from '../../../../theme/kidsColors';
import useLiquidOverlayStore from '../../../../liquidOverlayStore';

// Speech Companion is the HARTOS recipe at goal_seeding.py:1479
// (nunba_agent_id 'local_speech_companion').  When wired here, the
// agent surface (LiquidOverlay) takes over from the renderer for
// in-the-moment messaging: every encouragement, gentle prompt, and
// completion celebration flows through the agent's surface so the
// child experiences ONE consistent companion across all 12 mechanics.
// Per the recipe's invariants we NEVER push "wrong" / "almost" /
// "not quite" and NEVER push a score or percent — the renderer trusts
// PhoneticSimilarity.encouragement() to stay inside that contract.
const COMPANION_AGENT_NAME = 'Speech Companion';
const COMPANION_AGENT_ID = 'local_speech_companion';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');
const STAGE_W = SCREEN_W;
const STAGE_H = Math.min(SCREEN_H * 0.7, 640);

// ─── Helpers ──────────────────────────────────────────────────────────

const safeColors = (brief) => {
  const p = brief?.palette?.colors;
  if (Array.isArray(p) && p.length >= 2) return p;
  return [kidsColors.primary || '#FF8C42', kidsColors.background || '#FFFDF5'];
};

const styleBorderRadius = (artStyle) => {
  switch (artStyle) {
    case 'pixel': return 0;
    case 'minecraft': return 4;
    case 'origami': return 6;
    case 'clay': return 28;
    case 'painterly': return 32;
    case 'vector': return 18;
    case 'photo':
    default: return 14;
  }
};

const styleBorderColor = (artStyle, palette) => {
  if (artStyle === 'pixel' || artStyle === 'minecraft') return '#0a0a0a';
  if (artStyle === 'origami') return palette[1] || '#3A2618';
  return 'transparent';
};

// ─── Asset sprite ────────────────────────────────────────────────────

// 2026-06-16: route through KidsCanvas when the asset has a registered
// SVG or Lottie sprite (offline-bundled), falling back to the existing
// remote-image + emoji path otherwise.  This is what unlocks the
// "thousands of bundled sprites" tier: no network, instant, recolored
// per palette.  Lottie support also gives us running/walking/jumping
// animations for free on assets marked render:'lottie'.
const Sprite = React.memo(function Sprite({ asset, size = 96, artStyle }) {
  const [imgUrl, setImgUrl] = useState(null);
  const [imgFailed, setImgFailed] = useState(false);

  const useCanvas = asset && hasRichSprite(asset);

  useEffect(() => {
    if (useCanvas) return undefined;
    let active = true;
    spriteUrl(asset, artStyle).then((u) => {
      if (active) setImgUrl(u);
    }).catch(() => {});
    return () => { active = false; };
  }, [asset.id, asset.name, artStyle, useCanvas]);

  const borderRadius = styleBorderRadius(artStyle);
  const borderColor = styleBorderColor(artStyle, asset.palette || []);
  const borderWidth = borderColor !== 'transparent' ? (artStyle === 'pixel' ? 2 : 1) : 0;

  if (useCanvas) {
    return (
      <View style={[spriteStyles.wrap, { width: size, height: size, borderRadius, borderColor, borderWidth, backgroundColor: (asset.palette && asset.palette[1]) || 'rgba(255,255,255,0.6)' }]}>
        <KidsCanvas asset={asset} size={size - 4} palette={asset.palette} />
      </View>
    );
  }

  return (
    <View style={[spriteStyles.wrap, { width: size, height: size, borderRadius, borderColor, borderWidth, backgroundColor: (asset.palette && asset.palette[1]) || 'rgba(255,255,255,0.6)' }]}>
      {imgUrl && !imgFailed ? (
        <Image
          source={{ uri: imgUrl }}
          style={{ width: size - 4, height: size - 4, borderRadius }}
          resizeMode="contain"
          onError={() => setImgFailed(true)}
        />
      ) : (
        <Text style={{ fontSize: Math.floor(size * 0.62), textAlign: 'center' }}>
          {asset.emoji || '✨'}
        </Text>
      )}
    </View>
  );
});

const spriteStyles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
    overflow: 'hidden',
  },
});

// ─── Character mascot ────────────────────────────────────────────────

const Mascot = React.memo(function Mascot({ character, palette }) {
  const bob = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
      Animated.timing(bob, { toValue: 0, duration: 1400, useNativeDriver: true, easing: Easing.inOut(Easing.quad) }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [bob]);
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  return (
    <Animated.View style={[mascotStyles.row, { transform: [{ translateY }] }]}>
      <Text style={{ fontSize: 44 }}>{character?.emoji || '🌟'}</Text>
      <View style={[mascotStyles.bubble, { backgroundColor: (palette && palette[2]) || '#fff' }]}>
        <Text style={mascotStyles.name}>{character?.name || 'Friend'}</Text>
      </View>
    </Animated.View>
  );
});

const mascotStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  bubble: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, marginLeft: 8 },
  name: { fontSize: kidsFontSize.md, fontWeight: '700', color: '#2A2A2A' },
});

// ─── Mechanic renderers ──────────────────────────────────────────────

function TapSequenceStage({ brief, assets, onWin }) {
  const order = useMemo(() => assets.map((_, i) => i), [assets]);
  const [progress, setProgress] = useState(0);
  const positions = useMemo(() => assets.map(() => ({
    left: 24 + Math.random() * (STAGE_W - 120),
    top: 60 + Math.random() * (STAGE_H - 200),
  })), [assets]);
  return (
    <View style={[stageStyles.canvas, { height: STAGE_H }]}>
      {assets.map((a, i) => {
        const consumed = i < progress;
        const expected = i === progress;
        return (
          <TouchableOpacity
            key={a.id}
            disabled={consumed}
            onPress={() => {
              if (!expected) return;
              const next = progress + 1;
              setProgress(next);
              GameSounds.tap?.();
              if (next >= order.length) onWin();
            }}
            activeOpacity={0.85}
            style={[stageStyles.absolute, positions[i], { opacity: consumed ? 0.2 : 1 }]}
          >
            <Sprite asset={a} size={84} artStyle={brief.art_style} />
            {expected ? <View style={stageStyles.glowRing} pointerEvents="none" /> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function DragSortStage({ brief, assets, onWin }) {
  // Simple drag-free fallback for compactness: tap an asset, then tap a
  // bucket.  Two buckets derived from the two most-common tags.
  const tagCounts = useMemo(() => {
    const counts = {};
    for (const a of assets) (a.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(e => e[0]);
  }, [assets]);
  const buckets = useMemo(() => (tagCounts.length >= 2 ? [tagCounts[0], tagCounts[1]] : [brief.category, 'other']), [tagCounts, brief.category]);
  const [held, setHeld] = useState(null);
  const [placed, setPlaced] = useState({});
  const remaining = assets.filter(a => !placed[a.id]);
  const palette = safeColors(brief);

  useEffect(() => { if (Object.keys(placed).length === assets.length) onWin(); }, [placed, assets.length, onWin]);

  return (
    <View style={{ height: STAGE_H }}>
      <View style={stageStyles.bucketRow}>
        {buckets.map((b, i) => (
          <TouchableOpacity
            key={b}
            disabled={!held}
            onPress={() => {
              if (!held) return;
              setPlaced(p => ({ ...p, [held.id]: b }));
              setHeld(null);
              GameSounds.tap?.();
            }}
            style={[stageStyles.bucket, { backgroundColor: palette[i % palette.length] + '33', borderColor: palette[i % palette.length] }]}
          >
            <Text style={stageStyles.bucketLabel}>{b}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={stageStyles.assetTray}>
        {remaining.map(a => (
          <TouchableOpacity
            key={a.id}
            onPress={() => setHeld(a)}
            style={[stageStyles.trayItem, held?.id === a.id ? { transform: [{ scale: 1.15 }] } : null]}
            activeOpacity={0.8}
          >
            <Sprite asset={a} size={74} artStyle={brief.art_style} />
          </TouchableOpacity>
        ))}
      </View>
      {held ? <Text style={stageStyles.hint}>Tap a circle to place {held.name}</Text> : null}
    </View>
  );
}

function RepeatTTSStage({ brief, assets, onWin }) {
  const [idx, setIdx] = useState(0);
  const [say, setSay] = useState('');
  const current = assets[idx];
  const { transcript, isListening, startListening, stopListening, resetTranscript } = useSpeechRecognition({
    language: 'en',
    onResult: (text) => {
      const score = similarity(current?.name || '', text);
      setSay(encouragement(score));
      if (score >= 0.7) {
        setTimeout(() => {
          if (idx + 1 >= assets.length) onWin();
          else { setIdx(idx + 1); setSay(''); resetTranscript(); }
        }, 900);
      }
    },
  });
  useEffect(() => {
    const intro = `Can you say… ${current?.name || ''}?`;
    GameSounds.speakText?.(intro);
  }, [idx, current?.name]);

  return (
    <View style={{ height: STAGE_H, alignItems: 'center', justifyContent: 'center' }}>
      <Sprite asset={current} size={160} artStyle={brief.art_style} />
      <Text style={stageStyles.bigPrompt}>Say "{current?.name}"</Text>
      <TouchableOpacity
        onPress={() => (isListening ? stopListening() : startListening())}
        style={[stageStyles.micBtn, { backgroundColor: isListening ? '#E63946' : (safeColors(brief)[0]) }]}
      >
        <Text style={stageStyles.micBtnText}>{isListening ? '⏹ Stop' : '🎤 Tap to speak'}</Text>
      </TouchableOpacity>
      {transcript ? <Text style={stageStyles.heardText}>I heard: {transcript}</Text> : null}
      {say ? <Text style={stageStyles.encouragement}>{say}</Text> : null}
    </View>
  );
}

function BlowActionStage({ brief, assets, onWin }) {
  const { amplitude, status, startListening, stopListening } = useMicAmplitude(1.5);
  const [progress, setProgress] = useState(0);
  const targetIdx = Math.min(Math.floor(progress * assets.length), assets.length - 1);
  // #408 root-cause fix (2026-06-16): the prior effect had [status,
  // startListening, stopListening] in its deps with stopListening() in
  // the cleanup.  Every status transition (IDLE → REQUESTING → STARTING
  // → LISTENING) caused the effect to clean up (stop) and re-run
  // (start) — racing the permission flow forever, leaving the user
  // stuck on "Getting the mic ready…".  Mount-once + unmount-cleanup
  // is the right shape; the inner status check handles the case where
  // a previous startListening already won.
  useEffect(() => {
    startListening();
    return () => { stopListening(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (amplitude > 0.4) setProgress(p => Math.min(1, p + 0.012));
  }, [amplitude]);
  useEffect(() => { if (progress >= 1) onWin(); }, [progress, onWin]);

  const palette = safeColors(brief);
  return (
    <View style={{ height: STAGE_H, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={stageStyles.bigPrompt}>Blow to send {assets[targetIdx]?.name} flying!</Text>
      <View style={{ marginVertical: 16 }}>
        <Sprite asset={assets[targetIdx]} size={140 + amplitude * 60} artStyle={brief.art_style} />
      </View>
      <View style={[stageStyles.meterTrack, { backgroundColor: palette[1] + '55' }]}>
        <View style={[stageStyles.meterFill, { width: `${progress * 100}%`, backgroundColor: palette[0] }]} />
      </View>
      {status !== MIC_STATUS.LISTENING ? <Text style={stageStyles.hint}>Getting the mic ready…</Text> : null}
    </View>
  );
}

function ConveyorPickStage({ brief, assets, onWin }) {
  const [picked, setPicked] = useState([]);
  const need = Math.min(5, assets.length);
  const tx = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(tx, { toValue: 1, duration: 8000, useNativeDriver: true, easing: Easing.linear }));
    loop.start();
    return () => loop.stop();
  }, [tx]);
  useEffect(() => { if (picked.length >= need) onWin(); }, [picked, need, onWin]);
  const translateX = tx.interpolate({ inputRange: [0, 1], outputRange: [STAGE_W, -STAGE_W] });
  const palette = safeColors(brief);

  return (
    <View style={{ height: STAGE_H }}>
      <Text style={stageStyles.bigPrompt}>Tap {need} {brief.category}!</Text>
      <View style={[stageStyles.beltStrip, { backgroundColor: palette[1] + '55' }]}>
        <Animated.View style={[stageStyles.beltRow, { transform: [{ translateX }] }]}>
          {assets.concat(assets).map((a, i) => (
            <TouchableOpacity
              key={`${a.id}_${i}`}
              onPress={() => { setPicked(p => p.concat(a.id)); GameSounds.tap?.(); }}
              style={{ marginHorizontal: 12 }}
            >
              <Sprite asset={a} size={80} artStyle={brief.art_style} />
            </TouchableOpacity>
          ))}
        </Animated.View>
      </View>
      <Text style={stageStyles.hint}>{picked.length} / {need}</Text>
    </View>
  );
}

function FindHiddenStage({ brief, assets, onWin }) {
  const target = useMemo(() => assets[Math.floor(Math.random() * assets.length)], [assets]);
  const positions = useMemo(() => assets.map(() => ({
    left: 12 + Math.random() * (STAGE_W - 90),
    top: 60 + Math.random() * (STAGE_H - 200),
    rot: Math.random() * 30 - 15,
  })), [assets]);
  const [found, setFound] = useState(false);
  return (
    <View style={[stageStyles.canvas, { height: STAGE_H }]}>
      <Text style={stageStyles.bigPrompt}>Find the {target?.name}!</Text>
      {assets.map((a, i) => {
        const isTarget = a.id === target.id;
        return (
          <TouchableOpacity
            key={a.id}
            disabled={found}
            onPress={() => {
              if (isTarget) { setFound(true); GameSounds.success?.(); setTimeout(onWin, 600); }
              else { GameSounds.tap?.(); }
            }}
            style={[stageStyles.absolute, positions[i], { transform: [{ rotate: `${positions[i].rot}deg` }] }]}
          >
            <Sprite asset={a} size={66} artStyle={brief.art_style} />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── New mechanics added 2026-06-16 (closes gap toward 10+) ──────────

// balloon-pop: balloons float upward; target asset is the correct one;
// distractors are wrong.  Tap correct → pop sound + score; tap wrong →
// penalty.  Reach N correct pops to win.
function BalloonPopStage({ brief, assets, onWin }) {
  const target = useMemo(() => assets[Math.floor(Math.random() * assets.length)], [assets]);
  const [score, setScore] = useState(0);
  const need = 5;
  const [balloons, setBalloons] = useState(() => {
    return Array.from({ length: 8 }).map((_, i) => ({
      key: `b${i}`,
      asset: assets[Math.floor(Math.random() * assets.length)],
      left: 20 + Math.random() * (STAGE_W - 100),
      delay: Math.random() * 2000,
      // Color of the balloon shell from palette so tile is candy-colored.
      color: safeColors(brief)[i % safeColors(brief).length],
    }));
  });
  const palette = safeColors(brief);

  useEffect(() => { if (score >= need) onWin(); }, [score, need, onWin]);

  const pop = useCallback((b) => {
    if (b.asset.id === target.id) {
      try { GameSounds.success?.(); } catch (_) {}
      setScore(s => s + 1);
    } else {
      try { GameSounds.error?.(); } catch (_) {}
    }
    // Respawn with a new random asset so the screen keeps moving.
    setBalloons(prev => prev.map(p => p.key === b.key
      ? { ...p, asset: assets[Math.floor(Math.random() * assets.length)],
              left: 20 + Math.random() * (STAGE_W - 100),
              delay: 0, color: palette[Math.floor(Math.random()*palette.length)] }
      : p));
  }, [assets, target.id, palette]);

  return (
    <View style={[stageStyles.canvas, { height: STAGE_H }]}>
      <Text style={stageStyles.bigPrompt}>Pop the {target?.name}!</Text>
      <Text style={stageStyles.hint}>{score} / {need}</Text>
      {balloons.map(b => (
        <FloatingBalloon key={b.key} balloon={b} onPop={() => pop(b)} brief={brief} />
      ))}
    </View>
  );
}

function FloatingBalloon({ balloon, onPop, brief }) {
  const y = useRef(new Animated.Value(STAGE_H + 80)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(balloon.delay || 0),
      Animated.timing(y, { toValue: -120, duration: 5500 + Math.random() * 2500, useNativeDriver: true }),
      Animated.timing(y, { toValue: STAGE_H + 80, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balloon.key]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: balloon.left,
        transform: [{ translateY: y }],
        alignItems: 'center',
      }}
    >
      <TouchableOpacity onPress={onPop} activeOpacity={0.7}
        style={{
          width: 88, height: 96, borderRadius: 44,
          backgroundColor: balloon.color + 'DD',
          alignItems: 'center', justifyContent: 'center',
          shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 6,
          elevation: 4,
        }}>
        <Sprite asset={balloon.asset} size={58} artStyle={brief.art_style} />
      </TouchableOpacity>
      <View style={{ width: 2, height: 24, backgroundColor: '#FFFFFF77' }} />
    </Animated.View>
  );
}

// phonics-highlight: TTS speaks the target word letter-by-letter; each
// letter animates color from white→primary at its time slot; kid taps
// each letter as it's highlighted to score.  Builds letter→sound
// association.  Uses brief.target_word or falls back to asset name.
function PhonicsHighlightStage({ brief, assets, onWin }) {
  const target = useMemo(() => assets[Math.floor(Math.random() * assets.length)], [assets]);
  const word = (brief?.target_word || target?.name || 'cat').toUpperCase();
  const letters = word.split('');
  const [tappedAt, setTappedAt] = useState(-1);
  const [activeIndex, setActiveIndex] = useState(-1);
  const palette = safeColors(brief);
  // 700ms per letter, plus a 400ms intro
  useEffect(() => {
    let i = 0;
    setActiveIndex(0);
    try { GameSounds.speakText?.(word); } catch (_) {}
    const tick = setInterval(() => {
      i += 1;
      if (i >= letters.length) {
        clearInterval(tick);
        setActiveIndex(-1);
        // Win when all letters tapped in sequence
        if (tappedAt === letters.length - 1) onWin();
      } else {
        setActiveIndex(i);
      }
    }, 700);
    return () => clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [word]);

  const tapLetter = (i) => {
    if (i === tappedAt + 1) {
      setTappedAt(i);
      try { GameSounds.success?.(); } catch (_) {}
      if (i === letters.length - 1) setTimeout(onWin, 500);
    } else {
      try { GameSounds.error?.(); } catch (_) {}
    }
  };

  return (
    <View style={[stageStyles.canvas, { height: STAGE_H }]}>
      <Text style={stageStyles.bigPrompt}>Tap each letter!</Text>
      <View style={{ alignItems: 'center', marginTop: 20 }}>
        <Sprite asset={target} size={120} artStyle={brief.art_style} />
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
        {letters.map((L, i) => {
          const isActive = i === activeIndex;
          const isDone = i <= tappedAt;
          return (
            <TouchableOpacity key={`${L}_${i}`} onPress={() => tapLetter(i)}
              style={{
                width: 56, height: 72, margin: 6, borderRadius: 12,
                backgroundColor: isDone ? palette[1] : (isActive ? palette[0] + '88' : '#1B1530'),
                justifyContent: 'center', alignItems: 'center',
                borderWidth: isActive ? 2 : 0, borderColor: '#FFFFFF',
              }}>
              <Text style={{
                color: isDone || isActive ? '#FFFFFF' : '#888888',
                fontSize: 32, fontWeight: '800',
              }}>{L}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={stageStyles.hint}>{tappedAt + 1} / {letters.length}</Text>
    </View>
  );
}

// gesture-catch: assets fall down from top; kid swipes them into the
// correct labeled basket at the bottom (left for category-A, right for
// category-B).  Uses a PanResponder per asset; simple but feels active.
// Win after N correct catches.
function GestureCatchStage({ brief, assets, onWin }) {
  const [score, setScore] = useState(0);
  const need = 5;
  const palette = safeColors(brief);
  useEffect(() => { if (score >= need) onWin(); }, [score, onWin]);

  const onCatch = (correct) => {
    if (correct) {
      try { GameSounds.success?.(); } catch (_) {}
      setScore(s => s + 1);
    } else {
      try { GameSounds.error?.(); } catch (_) {}
    }
  };

  // For simplicity: assets are 6 falling tiles; tap LEFT half = put in
  // left basket, RIGHT half = right basket.  Correctness depends on
  // asset.category split into half.
  const half = Math.ceil(assets.length / 2);
  const leftSet = new Set(assets.slice(0, half).map(a => a.id));
  const [falling, setFalling] = useState(() => assets.slice(0, 6).map((a, i) => ({
    key: `f${i}`, asset: a, left: 20 + i * 60, delay: i * 600,
  })));

  return (
    <View style={[stageStyles.canvas, { height: STAGE_H }]}>
      <Text style={stageStyles.bigPrompt}>Tap LEFT or RIGHT to catch!</Text>
      <Text style={stageStyles.hint}>{score} / {need}</Text>
      {falling.map(f => (
        <FallingTile key={f.key} item={f} brief={brief}
          onSide={(side) => {
            const correct = (side === 'left') === leftSet.has(f.asset.id);
            onCatch(correct);
            setFalling(prev => prev.map(p => p.key === f.key
              ? { ...p, asset: assets[Math.floor(Math.random() * assets.length)], delay: 0 }
              : p));
          }}
        />
      ))}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        flexDirection: 'row', height: 64,
      }}>
        <View style={{ flex: 1, backgroundColor: palette[0] + '88', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>LEFT</Text>
        </View>
        <View style={{ flex: 1, backgroundColor: palette[1] + '88', justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 18 }}>RIGHT</Text>
        </View>
      </View>
    </View>
  );
}

function FallingTile({ item, brief, onSide }) {
  const y = useRef(new Animated.Value(-60)).current;
  useEffect(() => {
    const anim = Animated.loop(Animated.sequence([
      Animated.delay(item.delay || 0),
      Animated.timing(y, { toValue: STAGE_H - 80, duration: 4000, useNativeDriver: true }),
      Animated.timing(y, { toValue: -60, duration: 0, useNativeDriver: true }),
    ]));
    anim.start();
    return () => anim.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.key]);
  return (
    <Animated.View style={{
      position: 'absolute', left: item.left,
      transform: [{ translateY: y }],
    }}>
      <View style={{ flexDirection: 'row' }}>
        <TouchableOpacity onPress={() => onSide('left')}
          style={{ paddingHorizontal: 4 }}>
          <Sprite asset={item.asset} size={48} artStyle={brief.art_style} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

// ─── Mechanic dispatch ───────────────────────────────────────────────

const MECHANIC_RENDERERS = {
  'tap-sequence':    TapSequenceStage,
  'drag-sort':       DragSortStage,
  'repeat-tts':      RepeatTTSStage,
  'blow-action':     BlowActionStage,
  'conveyor-pick':   ConveyorPickStage,
  'find-hidden':     FindHiddenStage,
  // Net-new 2026-06-16:
  'balloon-pop':     BalloonPopStage,
  'phonics-highlight': PhonicsHighlightStage,
  'gesture-catch':   GestureCatchStage,
  // Stub fallback for mechanics not yet implemented: re-route to a safe
  // default so the brief always renders SOMETHING and never hangs.
  'swipe-direction': GestureCatchStage,
  'shake-mix':       BalloonPopStage,
  'sing-summon':     RepeatTTSStage,
  'trace-shape':     PhonicsHighlightStage,
  'balance-tilt':    BlowActionStage,
  'rhythm-tap':      TapSequenceStage,
};

// ─── Reward + complete overlay ───────────────────────────────────────

function WinOverlay({ brief, onContinue }) {
  const scale = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start();
    GameSounds.celebration?.();
    if (brief?.reward?.tts) GameSounds.speakText?.(brief.reward.tts);
  }, [scale, brief]);
  const palette = safeColors(brief);
  return (
    <View style={overlayStyles.fill}>
      <Animated.View style={[overlayStyles.card, { backgroundColor: palette[2] || '#fff', transform: [{ scale }] }]}>
        <Text style={overlayStyles.emoji}>🎉</Text>
        <Text style={overlayStyles.title}>{brief?.reward?.tts || 'You did it!'}</Text>
        <Text style={overlayStyles.subtitle}>{brief?.character?.name || 'Friend'} is so proud of you.</Text>
        <TouchableOpacity onPress={onContinue} style={[overlayStyles.btn, { backgroundColor: palette[0] }]}>
          <Text style={overlayStyles.btnText}>Play another</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

// ─── Main renderer ───────────────────────────────────────────────────

/**
 * @param {Object} props
 * @param {Object} props.brief          server-composed brief (see header docstring)
 * @param {string[]} [props.recentSignatures]  if brief signature collides, the renderer
 *                                             surfaces a re-roll CTA instead of mounting
 * @param {Function} [props.onComplete] called with (briefId, briefSignature) on win
 * @param {Function} [props.onRequestReroll] called when user wants a different game
 */
export default function UniqueGameRenderer({ brief, recentSignatures = [], onComplete, onRequestReroll, liquidEnabled = true }) {
  const [won, setWon] = useState(false);
  const setAgent = useLiquidOverlayStore((s) => s.setAgent);
  const pushMessage = useLiquidOverlayStore((s) => s.pushMessage);
  const showLiquid = useLiquidOverlayStore((s) => s.show);
  const dismissLiquid = useLiquidOverlayStore((s) => s.dismiss);

  useEffect(() => {
    if (!brief?.bgm?.mood) return;
    GameSounds.startBGM?.(GAME_BGM?.[brief.bgm.mood] || brief.bgm.mood, { fadeIn: true });
    return () => { GameSounds.stopBGM?.({ fadeOut: true }); };
  }, [brief?.bgm?.mood]);

  useEffect(() => {
    if (brief?.instructions_tts) GameSounds.speakText?.(brief.instructions_tts);
  }, [brief?.instructions_tts]);

  // Liquid UI lifecycle wire: when a brief mounts, the Speech Companion
  // takes over the floating agent surface and seeds it with the brief's
  // intro.  HARTOS can subscribe to brief.id over WAMP and push richer
  // companion-authored messages live (replaceDraft pattern) — until then
  // we show a safe local intro that respects the recipe's invariants.
  useEffect(() => {
    if (!liquidEnabled || !brief) return undefined;
    setAgent(COMPANION_AGENT_NAME, COMPANION_AGENT_ID);
    showLiquid('game_start', {
      brief_id: brief.id,
      theme: brief.theme,
      character: brief.character?.name,
      mechanic: brief.mechanic_name || brief.mechanic,
    }, COMPANION_AGENT_NAME);
    pushMessage({
      role: 'assistant',
      text: brief.instructions_tts || `Let's play with ${brief.theme}!`,
      ts: Date.now(),
      source: 'local-companion',
      brief_id: brief.id,
    });
    return () => { dismissLiquid(); };
  }, [brief?.id, liquidEnabled, setAgent, showLiquid, dismissLiquid, pushMessage, brief]);

  const palette = safeColors(brief);
  const Mechanic = brief?.mechanic && MECHANIC_RENDERERS[brief.mechanic] ? MECHANIC_RENDERERS[brief.mechanic] : MECHANIC_RENDERERS['tap-sequence'];
  const onWin = useCallback(() => {
    setWon(true);
    if (liquidEnabled) {
      pushMessage({
        role: 'assistant',
        text: brief?.reward?.tts || 'You did it!',
        ts: Date.now(),
        source: 'local-companion',
        brief_id: brief?.id,
        event: 'win',
      });
    }
    if (onComplete && brief) onComplete(brief.id, briefSignature(brief));
  }, [brief, onComplete, liquidEnabled, pushMessage]);

  if (!brief || !Array.isArray(brief.assets) || brief.assets.length === 0) {
    return (
      <View style={rendererStyles.loading}>
        <ActivityIndicator size="large" />
        <Text style={rendererStyles.loadingText}>Composing your game…</Text>
      </View>
    );
  }

  const signatureCollision = recentSignatures.includes(briefSignature(brief));
  if (signatureCollision && onRequestReroll) {
    return (
      <View style={rendererStyles.loading}>
        <Text style={rendererStyles.loadingText}>Picking a fresh one for you…</Text>
        <TouchableOpacity onPress={onRequestReroll} style={[overlayStyles.btn, { backgroundColor: palette[0] }]}>
          <Text style={overlayStyles.btnText}>New game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[rendererStyles.fill, { backgroundColor: palette[3] || palette[1] || '#FFFDF5' }]}>
      <View style={rendererStyles.header}>
        <Mascot character={brief.character} palette={palette} />
        <View style={rendererStyles.themeBadge}>
          <Text style={rendererStyles.themeText}>{brief.theme}</Text>
        </View>
      </View>
      <Text style={rendererStyles.objective}>{brief.objective}</Text>
      <View style={[rendererStyles.stageHost, { backgroundColor: palette[1] + '22' }]}>
        <Mechanic brief={brief} assets={brief.assets} onWin={onWin} />
      </View>
      {won ? <WinOverlay brief={brief} onContinue={onRequestReroll} /> : null}
    </View>
  );
}

const rendererStyles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: kidsSpacing.md },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: kidsSpacing.md },
  loadingText: { fontSize: kidsFontSize.lg, fontWeight: '600', color: kidsColors.text || '#3A3A3A' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: kidsSpacing.md },
  themeBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.7)' },
  themeText: { fontSize: kidsFontSize.md, fontWeight: '700', color: '#2A2A2A' },
  objective: { fontSize: kidsFontSize.md, textAlign: 'center', color: kidsColors.text || '#3A3A3A', marginBottom: kidsSpacing.sm },
  stageHost: { borderRadius: 24, overflow: 'hidden', padding: kidsSpacing.sm },
});

const stageStyles = StyleSheet.create({
  canvas: { width: '100%', position: 'relative' },
  absolute: { position: 'absolute' },
  glowRing: { position: 'absolute', top: -8, left: -8, right: -8, bottom: -8, borderRadius: 999, borderWidth: 3, borderColor: '#FFC300' },
  bucketRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: kidsSpacing.sm },
  bucket: { width: 130, height: 130, borderRadius: 999, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  bucketLabel: { fontSize: kidsFontSize.md, fontWeight: '700', color: '#2A2A2A', textAlign: 'center' },
  assetTray: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', padding: kidsSpacing.sm, gap: 6 },
  trayItem: { padding: 4 },
  hint: { textAlign: 'center', fontSize: kidsFontSize.md, color: kidsColors.textMuted || '#7A7A7A', marginTop: 8 },
  bigPrompt: { fontSize: kidsFontSize.xl, fontWeight: '700', color: '#2A2A2A', textAlign: 'center', marginVertical: 12 },
  micBtn: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 999, marginTop: kidsSpacing.md },
  micBtnText: { color: '#fff', fontSize: kidsFontSize.lg, fontWeight: '700' },
  heardText: { fontSize: kidsFontSize.md, color: kidsColors.textMuted || '#7A7A7A', marginTop: 8 },
  encouragement: { fontSize: kidsFontSize.lg, color: kidsColors.primary || '#FF8C42', fontWeight: '700', marginTop: 8 },
  meterTrack: { width: 240, height: 18, borderRadius: 999, overflow: 'hidden', marginTop: 12 },
  meterFill: { height: '100%' },
  beltStrip: { height: 130, overflow: 'hidden', justifyContent: 'center', marginVertical: 16, borderRadius: 24 },
  beltRow: { flexDirection: 'row', alignItems: 'center' },
});

const overlayStyles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: kidsSpacing.lg },
  card: { padding: kidsSpacing.xl, borderRadius: 28, alignItems: 'center', gap: kidsSpacing.md, maxWidth: 360 },
  emoji: { fontSize: 72 },
  title: { fontSize: kidsFontSize.xl, fontWeight: '700', color: '#2A2A2A', textAlign: 'center' },
  subtitle: { fontSize: kidsFontSize.md, color: kidsColors.textMuted || '#7A7A7A', textAlign: 'center' },
  btn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  btnText: { color: '#fff', fontSize: kidsFontSize.lg, fontWeight: '700' },
});
