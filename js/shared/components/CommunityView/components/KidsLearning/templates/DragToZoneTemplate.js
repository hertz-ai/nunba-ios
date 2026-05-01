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
import {GameSounds} from '../shared/SoundManager';
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
 * - After 3+ consecutive wrong: highlights the correct zone with a glow
 * - After fast correct streak: shuffles remaining items for extra challenge
 * - Shows per-item feedback overlay on each drop
 */
const DragToZoneTemplate = ({config, onAnswer, onComplete}) => {
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
  const [consecutiveWrong, setConsecutiveWrong] = useState(0);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const [adaptiveMode, setAdaptiveMode] = useState('normal');
  const [highlightedZone, setHighlightedZone] = useState(null);

  // Visual overhaul state
  const [lives, setLives] = useState(3);
  const [charState, setCharState] = useState('idle');
  const [showVisualHint, setShowVisualHint] = useState(true);

  // Animation refs
  const containerAnim = useRef(new Animated.Value(0)).current;
  const highlightAnim = useRef(new Animated.Value(0)).current;
  const startTimeRef = useRef(Date.now());
  const currentItemRef = useRef(null);
  const completedRef = useRef(false);
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
    }
  }, [config]);

  // Update adaptive mode
  useEffect(() => {
    if (consecutiveWrong >= 3) {
      setAdaptiveMode('easy');
    } else if (consecutiveCorrect >= 4) {
      setAdaptiveMode('hard');
    } else {
      setAdaptiveMode('normal');
    }
  }, [consecutiveWrong, consecutiveCorrect]);

  // Highlight pulse animation in easy mode
  useEffect(() => {
    if (highlightedZone) {
      highlightAnim.setValue(0);
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
      highlightAnim.setValue(0);
    }
  }, [highlightedZone]);

  // In easy mode, when a new item is being considered, highlight its correct zone
  const updateHintHighlight = useCallback((itemId) => {
    if (adaptiveMode === 'easy' && itemId) {
      const item = items.find(i => i.id === itemId);
      if (item) {
        setHighlightedZone(item.zone);
      }
    } else {
      setHighlightedZone(null);
    }
  }, [adaptiveMode, items]);

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
    setShowFeedback(true);

    // Update adaptive tracking + character animation
    if (isCorrect) {
      GameSounds.dragDrop();
      setConsecutiveWrong(0);
      setConsecutiveCorrect(prev => prev + 1);
      setPlacedItems(prev => ({...prev, [itemId]: zoneId}));
      setHighlightedZone(null);
      setCharState('celebrate');
      setTimeout(() => {
        if (mountedRef.current) setCharState('idle');
      }, 1500);
    } else {
      setConsecutiveCorrect(0);
      setConsecutiveWrong(prev => prev + 1);
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
  }, [items, onAnswer]);

  const handleAllPlaced = useCallback((placements) => {
    // Completion is handled by handleFeedbackDismiss to avoid double-call
  }, []);

  const handleFeedbackDismiss = useCallback(() => {
    setShowFeedback(false);

    // Check if all items correctly placed
    if (Object.keys(placedItems).length >= totalItems && totalItems > 0 && !completedRef.current) {
      completedRef.current = true;
      setTimeout(() => {
        if (mountedRef.current && onComplete) onComplete();
      }, 300);
    }
  }, [placedItems, totalItems, onComplete]);

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
        streak={consecutiveCorrect}
      />

      {/* Character */}
      <View style={{alignItems: 'center', marginBottom: 8}}>
        <KidsCharacter seed="drag-game" state={charState} size={72} />
      </View>

      {/* Visual Hint */}
      <VisualHint type="drag" visible={showVisualHint && correctCount === 0} onDismiss={() => setShowVisualHint(false)} />

      {/* Adaptive mode indicator */}
      {adaptiveMode === 'easy' && (
        <View style={styles.adaptiveBanner}>
          <Icon name="lightbulb-on-outline" size={16} color={kidsColors.star} />
          <Text style={styles.adaptiveText}>Look for the glowing zone!</Text>
        </View>
      )}
      {adaptiveMode === 'hard' && (
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

      <Animated.View
        style={[
          styles.gameArea,
          {transform: [{scale: containerScale}], opacity: containerAnim},
        ]}
      >
        {/* Drop Zones with optional highlighting */}
        <View style={styles.zonesRow}>
          {zones.map(zone => {
            const isHighlighted = highlightedZone === zone.id;
            const placedHere = Object.entries(placedItems)
              .filter(([_, zId]) => zId === zone.id)
              .map(([itemId]) => items.find(i => i.id === itemId))
              .filter(Boolean);

            return (
              <View
                key={zone.id}
                style={[
                  styles.zone,
                  {borderColor: zone.color || kidsColors.accent},
                  isHighlighted && {
                    borderWidth: 5,
                    borderColor: kidsColors.star,
                    backgroundColor: kidsColors.star + '15',
                  },
                ]}
              >
                <Text style={{fontSize: 28, textAlign: 'center', marginBottom: 4}}>
                  {getEmojiForText(zone.label) || '📦'}
                </Text>
                <Text style={[styles.zoneLabel, {color: zone.color || kidsColors.accent}]}>
                  {zone.label}
                </Text>
                {/* Placed items badges */}
                <View style={styles.placedItems}>
                  {placedHere.map(item => (
                    <View
                      key={item.id}
                      style={[styles.placedBadge, {backgroundColor: zone.color || kidsColors.correct}]}
                    >
                      <Text style={{fontSize: 16}}>{getEmojiForText(item.label) || ''}</Text>
                      <Text style={styles.placedBadgeText}>{item.label}</Text>
                    </View>
                  ))}
                </View>
                {isHighlighted && (
                  <Icon
                    name="arrow-down-bold"
                    size={24}
                    color={kidsColors.star}
                    style={styles.hintArrow}
                  />
                )}
              </View>
            );
          })}
        </View>

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
          />
        ) : (
          <View style={styles.completeMessage}>
            <Icon name="party-popper" size={48} color={kidsColors.star} />
            <Text style={styles.completeText}>All sorted!</Text>
          </View>
        )}
      </Animated.View>

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
    flex: 1,
  },
  zonesRow: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: kidsSpacing.md,
    marginBottom: kidsSpacing.md,
  },
  zone: {
    width: 140,
    minHeight: 120,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: kidsBorderRadius.lg,
    justifyContent: 'flex-start',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    padding: kidsSpacing.sm,
  },
  zoneLabel: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    textAlign: 'center',
    marginBottom: kidsSpacing.xs,
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
