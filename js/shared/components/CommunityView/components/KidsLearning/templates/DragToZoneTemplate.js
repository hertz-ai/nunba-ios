import React, {useState, useEffect, useRef, useCallback} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import DragDropArea from '../shared/DragDropArea';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import GameLivesBar from '../shared/GameLivesBar';
import KidsCharacter from '../shared/KidsCharacter';
import VisualHint from '../shared/VisualHint';
import {getEmojiForText} from '../shared/emojiMap';
import {STEP, LEVEL, dragToZone as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';
import {SPRINGS} from '../shared/gameThemes';

/**
 * DragToZoneTemplate - Drag items into correct category zones.
 *
 * Props:
 * - config: { content: { zones: [{id, label, color}], items: [{id, label, zone, concept}] } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 *
 * Intelligence features:
 * - Tracks response time per item drag
 * - At the shell's easiest level: the correct zone glows
 * - After fast correct streak: shuffles remaining items for extra challenge
 * - Shows per-item feedback overlay on each drop
 */
// How many answers in a row were right, for the lives bar's streak.
const trailingRight = (results) => {
  let n = 0;
  for (let i = results.length - 1; i >= 0 && results[i]; i--) n++;
  return n;
};

const DragToZoneTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  const [items, setItems] = useState([]);
  const [zones, setZones] = useState([]);
  const [placedItems, setPlacedItems] = useState({});
  const [results, setResults] = useState([]);
  const [totalItems, setTotalItems] = useState(0);

  // Feedback state
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');

  // Adaptive difficulty state
  // Difficulty is the shell's one ladder (shared/gameGuide): at LEVEL.MIN the
  // right zone glows.  This template's own ladder is gone.
  const difficulty = level <= LEVEL.MIN ? 'easy' : level >= LEVEL.MAX ? 'hard' : 'normal';
  const [highlightedZone, setHighlightedZone] = useState(null);

  // Visual overhaul state
  const [lives, setLives] = useState(3);
  // True while a tile is held. The board scrolls (it does not fit a phone),
  // and a NATIVE Android ScrollView intercepts a vertical drag through
  // onInterceptTouchEvent - outside the JS responder system, so
  // onPanResponderTerminationRequest cannot stop it. Measured: the tile
  // lifted and the BOARD scrolled instead, tray sliding 2056 -> 1528, and
  // nothing could be dropped. Scrolling is switched off while dragging.
  const [isDragging, setIsDragging] = useState(false);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Animation refs
  const containerAnim = useRef(new Animated.Value(1)).current;
  const highlightAnim = useRef(new Animated.Value(1)).current;
  const startTimeRef = useRef(Date.now());
  const currentItemRef = useRef(null);
  const completedRef = useRef(false);
  // The placements as they stand RIGHT NOW, for the completion check below.
  //
  // Nothing locks this board while the feedback overlay is up: a child can
  // drop the next item before the last "Correct!" has faded. That second drop
  // only sets an already-true showFeedback, so FeedbackOverlay - whose dismiss
  // is armed in an effect keyed on `visible` alone - does not re-arm, and the
  // one standing timeout calls the handleFeedbackDismiss captured when the
  // overlay first appeared. That closure holds placedItems from the FIRST
  // drop. Since that handler is what reports completion, a child who placed
  // the last item while the previous message was still showing finished the
  // board and the game never ended.
  //
  // Fixed here rather than in FeedbackOverlay: making the overlay call the
  // latest callback was measured and REVERTED - it cost multiple-choice 0 -> 1
  // to 5 games failing to complete across three runs, because fourteen other
  // templates depend on that dismiss running the handler it was armed with.
  const placedRef = useRef({});
  const mountedRef = useRef(true);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Initialize
  useEffect(() => {
    if (config?.content) {
      const {zones: configZones, items: configItems} = config.content;
      setZones(configZones || []);
      // Shuffle items
      const shuffled = [...(configItems || [])].sort(() => Math.random() - 0.5);
      setItems(shuffled);
      setTotalItems(shuffled.length);

      Animated.spring(containerAnim, {
        toValue: 1,
        ...SPRINGS.standard,
      }).start();

      startTimeRef.current = Date.now();
      if (onStep) {
        // Each item's "goes in" line is prepared up front, so a drop is named at once.
        const zones = config.content.zones || [];
        const zoneLabel = (id) => zones.find((z) => z.id === id)?.label || '';
        onStep({kind: STEP.ASKED, itemId: `drag:${config.id || 'board'}`,
                say: guide.ask(zones),
                prepare: (config.content.items || []).map((it) => guide.right(it.label, zoneLabel(it.zone)))});
      }
    }
  }, [config]);

  // Highlight pulse animation in easy mode
  useEffect(() => {
    if (highlightedZone) {
      highlightAnim.setValue(1);
      const highlightLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(highlightAnim, {toValue: 1, duration: 800, useNativeDriver: false}),
          Animated.timing(highlightAnim, {toValue: 0, duration: 800, useNativeDriver: false}),
        ]),
      );
      highlightLoop.start();
      return () => highlightLoop.stop();
    } else {
      highlightAnim.stopAnimation();
      highlightAnim.setValue(1);
    }
  }, [highlightedZone]);

  // In easy mode, when a new item is being considered, highlight its correct zone
  const updateHintHighlight = useCallback((itemId) => {
    if (difficulty === 'easy' && itemId) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        setHighlightedZone(item.zone);
      }
    } else {
      setHighlightedZone(null);
    }
  }, [difficulty, items]);

  const buildCorrectMapping = useCallback(() => {
    const mapping = {};
    items.forEach(item => {
      mapping[item.id] = item.zone;
    });
    return mapping;
  }, [items]);

  const handleItemDropped = useCallback((itemId, zoneId, isCorrect) => {
    const responseTimeMs = Date.now() - startTimeRef.current;
    const item = items.find(i => i.id === itemId);
    const concept = item?.concept || `drag:${itemId}`;

    // Show feedback
    setFeedbackCorrect(isCorrect);
    if (isCorrect) {
      if (responseTimeMs < 2000) {
        setFeedbackMessage('Lightning fast!');
      } else {
        setFeedbackMessage('');
      }
    } else {
      setFeedbackMessage('');
    }
    // Guided, the board stays in view (and playable) while the voice names
    // the drop; the overlay covered it on every drop and the last one ended
    // the game when the card closed.  Unguided keeps the overlay.
    if (!onStep) setShowFeedback(true);

    if (onStep) {
      const zones = config?.content?.zones || [];
      const zoneLabel = (id) => zones.find((z) => z.id === id)?.label || '';
      const spoken = onStep(isCorrect
        ? {kind: STEP.RIGHT, itemId: concept, concept, cue: 'dragDrop',
           say: guide.right(item?.label, zoneLabel(zoneId))}
        : {kind: STEP.WRONG, itemId: concept, chosen: zoneLabel(zoneId),
           wanted: zoneLabel(item?.zone),
           say: guide.explainMiss(item?.label, zoneLabel(zoneId))});
      holdUntilSpoken(spoken, () => advanceRef.current(), () => mountedRef.current);
    }
    if (isCorrect) {
      setPlacedItems(prev => {
        const next = {...prev, [itemId]: zoneId};
        placedRef.current = next;
        return next;
      });
      setHighlightedZone(null);
      setCharState('celebrate');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
    } else {
      setCharState('encourage');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
      setLives(prev => Math.max(0, prev - 1));
    }

    setResults(prev => [...prev, isCorrect]);

    // Report to parent
    if (onAnswer) {
      onAnswer(isCorrect, concept, responseTimeMs);
    }

    // Reset timer for next item
    startTimeRef.current = Date.now();
  }, [items, onAnswer, onStep, config]);

  const handleAllPlaced = useCallback((placements) => {
    // Completion is handled by handleFeedbackDismiss to avoid double-call
  }, []);

  const advanceRef = useRef(null);
  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);

    // Check if all items correctly placed
    // Read through the ref so the count is what is on the board now, not what
    // it was when this particular closure was made.
    if (Object.keys(placedRef.current).length >= totalItems && totalItems > 0 && !completedRef.current) {
      completedRef.current = true;
      setTimeout(() => {
        if (mountedRef.current && onComplete) onComplete();
      }, 300);
    }
  }, [placedItems, totalItems, onComplete]);
  advanceRef.current = handleFeedbackDismiss;

  // Remaining items (not placed correctly yet)
  const remainingItems = items.filter(item => !placedItems[item.id]);
  const correctCount = Object.keys(placedItems).length;

  // --- Render ---
  if (zones.length === 0 || items.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  const containerScale = containerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.9, 1],
  });

  const highlightBorderWidth = highlightAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [3, 6],
  });

  return (
    <View style={styles.container}>
      {/* Lives / Score Bar */}
      <GameLivesBar
        lives={lives}
        score={correctCount}
        currentLevel={correctCount + 1}
        totalLevels={totalItems}
        streak={trailingRight(results)}
      />

      {/* Character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed="drag-game" state={charState} size={72} />
      </View>

      {/* Visual Hint */}
      <VisualHint type="drag" visible={showVisualHint && correctCount === 0} onDismiss={() => setShowVisualHint(false)} />

      {/* Adaptive mode indicator */}
      {difficulty === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Look for the glowing zone!</Text>
        </View>
      )}
      {difficulty === 'hard' && (
        <View style={[styles.adaptiveBanner, {backgroundColor: kidsColors.accentLight + '20'}]}>
          <Icon name="fire" size={16} color={kidsColors.streak} />
          <Text style={[styles.adaptiveText, {color: kidsColors.streak}]}>You are on fire!</Text>
        </View>
      )}

      {/* Score */}
      <View style={styles.scoreRow}>
        <Text style={{fontSize: 20}}>📦</Text>
        <Text style={styles.scoreText}>{correctCount} / {totalItems}</Text>
      </View>

      {/* The board SCROLLS.
        *
        * It does not fit a phone. At 1080x2340 the content needs about 550dp
        * below the character - a row of display zones, the drop zones, and
        * three rows of tiles - against roughly 443dp of room, so the third row
        * of tiles starts BELOW the screen on the very first render. It then
        * gets worse: each chip that lands grows its zone and pushes the tray
        * down again. Measured on a device: with six of twelve items placed the
        * remaining tiles sat half off the bottom with their centres inside the
        * system gesture strip, where a swipe is taken by the navigation
        * gesture and never reaches the game. A child could not finish it.
        *
        * A ScrollView is safe around the draggables: DraggableItem grants the
        * responder on touch START (onStartShouldSetPanResponder), so it holds
        * the gesture and the ScrollView cannot steal it mid-drag.
        */}
      <ScrollView
        style={styles.gameScroll}
        contentContainerStyle={styles.gameScrollContent}
        keyboardShouldPersistTaps="handled"
        // scrollEnabled is deliberately NOT tied to isDragging. Flipping it
        // mid-gesture makes Android cancel the touch stream, which fires the
        // tile's own onPanResponderTerminate and springs it home - measured,
        // three items placed per run before, ZERO after.
      >
      <Animated.View
        style={[
          styles.gameArea,
          {transform: [{scale: containerScale}], opacity: containerAnim},
        ]}
      >
        {/* The zones are drawn by DragDropArea, which owns the drop targets.
          * This template used to draw a SECOND, identical row above them: the
          * same two labels, only one of which took a drop, and about 120dp
          * that GREW with every chip. That is what pushed the board past the
          * height of a phone and forced in the ScrollView. Placed items are
          * shown inside the real zones instead. */}
        {/* Remaining draggable items */}
        {remainingItems.length > 0 ? (
          <DragDropArea
            items={remainingItems.map((item, idx) => ({
              id: item.id,
              label: item.label,
              emoji: getEmojiForText(item.label) || '▪️',
              color: kidsColors.palette[idx % kidsColors.palette.length],
            }))}
            zones={zones}
            correctMapping={buildCorrectMapping()}
            onItemDropped={handleItemDropped}
            onAllPlaced={handleAllPlaced}
            onDragActive={setIsDragging}
            placedItems={placedItems}
            allItems={items}
            highlightedZone={highlightedZone}
          />
        ) : (
          <View style={styles.completeMessage}>
            <Icon name="party-popper" size={48} color={kidsColors.star} />
            <Text style={styles.completeText}>All sorted!</Text>
          </View>
        )}
      </Animated.View>
      </ScrollView>

      {/* Feedback Overlay */}
      <FeedbackOverlay
        visible={showFeedback}
        isCorrect={feedbackCorrect}
        message={feedbackMessage}
        onDismiss={handleFeedbackDismiss}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
    paddingTop: kidsSpacing.md,
  },
  loadingText: {
    fontSize: kidsFontSize.lg,
    color: kidsColors.textSecondary,
    textAlign: 'center',
    marginTop: kidsSpacing.xxl,
  },
  adaptiveBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    paddingVertical: kidsSpacing.xs,
    backgroundColor: kidsColors.star + '20',
    marginHorizontal: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.sm,
    marginBottom: kidsSpacing.sm,
  },
  adaptiveText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.star,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: kidsSpacing.xs,
    marginBottom: kidsSpacing.sm,
  },
  scoreText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
  },
  gameArea: {
    // NOT flex:1 - inside a ScrollView that collapses to zero height. The
    // board sizes to its content and the ScrollView provides the reach.
    flexGrow: 1,
  },
  gameScroll: {
    flex: 1,
  },
  gameScrollContent: {
    flexGrow: 1,
    paddingBottom: kidsSpacing.xxl,
  },
  placedItems: {
    gap: kidsSpacing.xs,
    alignItems: 'center',
    width: '100%',
  },
  placedBadge: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.sm,
    width: '100%',
    alignItems: 'center',
  },
  placedBadgeText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  hintArrow: {
    marginTop: kidsSpacing.xs,
  },
  completeMessage: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: kidsSpacing.xxl,
    gap: kidsSpacing.md,
  },
  completeText: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
  },
});

export default DragToZoneTemplate;
