import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {View, Text, TouchableOpacity, Animated, StyleSheet, Dimensions} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import {STEP, LEVEL, spotDifference as guide} from '../shared/gameGuide';
import holdUntilSpoken from '../shared/holdUntilSpoken';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const SCENE_SIZE = SCREEN_WIDTH * 0.45;

// Generate a grid of icons representing a scene
const generateScene = (sceneIcon, sceneColor, differences, isSecond) => {
  const GRID = 4;
  const icons = [
    'pencil', 'book-open-variant', 'desk-lamp', 'apple',
    'star', 'heart', 'flower', 'tree',
    'clock-outline', 'palette', 'music-note', 'football',
    'cat', 'fish', 'bird', 'leaf',
  ];
  const cells = [];
  for (let r = 0; r < GRID; r++) {
    for (let c = 0; c < GRID; c++) {
      const idx = r * GRID + c;
      const cellX = (c / GRID) * 100;
      const cellY = (r / GRID) * 100;
      let icon = icons[idx % icons.length];
      let color = sceneColor;

      if (isSecond) {
        const diff = differences.find(d => {
          const dx = Math.abs(d.x - cellX);
          const dy = Math.abs(d.y - cellY);
          return dx < 30 && dy < 30;
        });
        if (diff) {
          // This cell is different in scene 2
          icon = diff.altIcon || 'help-circle-outline';
          color = diff.altColor || '#999';
        }
      }
      cells.push({r, c, icon, color, x: cellX, y: cellY});
    }
  }
  return cells;
};

const SpotDifferenceTemplate = ({config, onAnswer, onComplete, onStep, level = LEVEL.START}) => {
  // `config` arrives from a fetch after this component mounts, so it is null
  // on the first render. Destructuring it threw "Cannot read properties of
  // null (reading 'content')" and crashed all four spot-the-difference games.
  // Every sibling template already guards this way.
  const content = config?.content || {};
  const rounds = content.rounds || [];

  const [currentRound, setCurrentRound] = useState(0);
  const [foundDiffs, setFoundDiffs] = useState([]);
  const [results, setResults] = useState([]);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(false);
  // The shell's one ladder (shared/gameGuide): at LEVEL.MIN the differences
  // left pulse.  This template's own three-misses count is gone.
  const showHint = level <= LEVEL.MIN;
  // The lesson of a round's last find opens the next round's line, so the
  // next question does not cut it off.
  const lessonRef = useRef('');
  const startTimeRef = useRef(Date.now());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const round = rounds[currentRound] || null;
  const differences = round?.differences || [];
  // Hooks must be called before any early return (React Rules of Hooks)
  // Depend on the round itself, not just its index. `config` arrives from a
  // fetch after mount, so on the first render `round` is null and both scenes
  // memoise to []. currentRound is 0 before AND after the config lands, so
  // keying on it alone meant the memo never recomputed and the board stayed
  // permanently empty — the same stale-derived-value bug as FillBlankTemplate's
  // answer options. `round` is a stable reference out of the config, so this
  // still recomputes exactly once per round.
  const scene1 = useMemo(() => round ? generateScene(round.sceneIcon, round.sceneColor, differences, false) : [], [round, differences]);
  const scene2 = useMemo(() => round ? generateScene(round.sceneIcon, round.sceneColor, differences, true) : [], [round, differences]);

  // Hint pulse animation
  useEffect(() => {
    if (showHint) {
      const pulseLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {toValue: 1.3, duration: 600, useNativeDriver: true}),
          Animated.timing(pulseAnim, {toValue: 1, duration: 600, useNativeDriver: true}),
        ]),
      );
      pulseLoop.start();
      return () => pulseLoop.stop();
    }
  }, [showHint]);

  // Each round is asked when it appears (after the last round's lesson).
  useEffect(() => {
    if (!round || !onStep) return;
    const lesson = lessonRef.current;
    lessonRef.current = '';
    onStep({kind: STEP.ASKED, itemId: round.concept || `spot:${currentRound}`,
      say: `${lesson ? `${lesson} ` : ''}${guide.ask(round)}`});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round]);

  const handleCellPress = useCallback((cellX, cellY, isScene2) => {
    if (!isScene2) return; // Only tap on scene 2 to find differences

    const responseTime = Date.now() - startTimeRef.current;

    // Check if tapped near a difference
    const matched = differences.find(d => {
      const dx = Math.abs(d.x - cellX);
      const dy = Math.abs(d.y - cellY);
      return dx < 30 && dy < 30 && !foundDiffs.includes(d.label);
    });

    if (matched) {
      const newFound = [...foundDiffs, matched.label];
      setFoundDiffs(newFound);
      setFeedbackCorrect(true);
      // Guided, the scene stays in view while the voice names the find; the
      // overlay covered it on every tap.  Unguided keeps the overlay.
      if (!onStep) setShowFeedback(true);

      const concept = round.concept || `observe:diff-${currentRound}`;
      let spoken;
      if (onStep) {
        // The difference's label is the lesson; a round's last find hands it
        // to the next round's line instead of being cut off by it.
        const roundDone = newFound.length >= differences.length;
        const handOn = roundDone && currentRound + 1 < rounds.length;
        if (handOn) lessonRef.current = guide.right(matched);
        spoken = onStep({kind: STEP.RIGHT, itemId: matched.label, concept, say: handOn ? undefined : guide.right(matched)});
      }
      onAnswer(true, concept, responseTime);

      // Check if all differences found
      if (newFound.length >= differences.length) {
        setResults([...results, true]);
        const finish = () => {
          if (!mountedRef.current) return;
          if (currentRound + 1 < rounds.length) {
            setCurrentRound(currentRound + 1);
            setFoundDiffs([]);
            startTimeRef.current = Date.now();
          } else if (!completedRef.current) {
            completedRef.current = true;
            onComplete();
          }
        };
        // The last find of the last round has no next round to hand its line
        // to; guided, the game ends once that line has been said, not 1s in.
        if (onStep && currentRound + 1 >= rounds.length) {
          holdUntilSpoken(spoken, finish, () => mountedRef.current);
        } else {
          setTimeout(finish, 1000);
        }
      }
    } else {
      setFeedbackCorrect(false);
      if (!onStep) setShowFeedback(true);
      if (onStep) onStep({kind: STEP.WRONG, itemId: round.concept || `spot:${currentRound}`, say: guide.explainMiss()});
      onAnswer(false, round.concept || `observe:diff-${currentRound}`, responseTime);
    }
    startTimeRef.current = Date.now();
  }, [foundDiffs, differences, currentRound, rounds.length, results, round, onAnswer, onComplete, onStep]);

  // Early return after all hooks have been called
  if (!round) return null;

  const renderScene = (cells, isScene2) => (
    <View style={styles.scene}>
      <Text style={styles.sceneLabel}>{isScene2 ? 'Scene B' : 'Scene A'}</Text>
      <View style={styles.sceneGrid}>
        {cells.map((cell, i) => {
          const isFound = isScene2 && differences.some(d => {
            const dx = Math.abs(d.x - cell.x);
            const dy = Math.abs(d.y - cell.y);
            return dx < 30 && dy < 30 && foundDiffs.includes(d.label);
          });

          const isHinted = showHint && isScene2 && differences.some(d => {
            const dx = Math.abs(d.x - cell.x);
            const dy = Math.abs(d.y - cell.y);
            return dx < 30 && dy < 30 && !foundDiffs.includes(d.label);
          });

          return (
            <TouchableOpacity
              key={i}
              style={[
                styles.cell,
                isFound && styles.cellFound,
                isHinted && styles.cellHinted,
              ]}
              onPress={() => handleCellPress(cell.x, cell.y, isScene2)}
              disabled={!isScene2}
              activeOpacity={isScene2 ? 0.6 : 1}
            >
              {isHinted ? (
                <Animated.View style={{transform: [{scale: pulseAnim}]}}>
                  <Icon name={cell.icon} size={22} color={cell.color} />
                </Animated.View>
              ) : (
                <Icon name={cell.icon} size={22} color={isFound ? kidsColors.correct : cell.color} />
              )}
              {isFound && (
                <View style={styles.foundCircle}>
                  <Icon name="check" size={12} color={kidsColors.textOnDark} />
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{round.title || 'Spot the Differences!'}</Text>

      <ProgressDots
        total={differences.length}
        current={foundDiffs.length}
        results={differences.map((d) => foundDiffs.includes(d.label))}
      />

      <Text style={styles.counter}>
        Found: {foundDiffs.length} / {differences.length}
      </Text>

      {showHint && (
        <View style={styles.hintBanner}>
          <Icon name="lightbulb-on" size={16} color={kidsColors.star} />
          <Text style={styles.hintText}>Look for the pulsing icons!</Text>
        </View>
      )}

      <View style={styles.scenesRow}>
        {renderScene(scene1, false)}
        {renderScene(scene2, true)}
      </View>

      <Text style={styles.instruction}>Tap differences in Scene B</Text>

      <FeedbackOverlay
        visible={showFeedback}
        isCorrect={feedbackCorrect}
        onDismiss={() => setShowFeedback(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, padding: kidsSpacing.md, backgroundColor: kidsColors.background},
  title: {
    fontSize: kidsFontSize.lg, fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary, textAlign: 'center', marginBottom: kidsSpacing.sm,
  },
  counter: {
    fontSize: kidsFontSize.md, fontWeight: kidsFontWeight.semibold,
    color: kidsColors.accent, textAlign: 'center', marginBottom: kidsSpacing.sm,
  },
  hintBanner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: kidsSpacing.xs, backgroundColor: kidsColors.backgroundTertiary,
    paddingVertical: kidsSpacing.xs, borderRadius: kidsBorderRadius.sm, marginBottom: kidsSpacing.sm,
  },
  hintText: {fontSize: kidsFontSize.xs, fontWeight: kidsFontWeight.semibold, color: kidsColors.star},
  scenesRow: {
    flexDirection: 'row', justifyContent: 'space-between', gap: kidsSpacing.sm,
  },
  scene: {flex: 1, alignItems: 'center'},
  sceneLabel: {
    fontSize: kidsFontSize.xs, fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary, marginBottom: kidsSpacing.xs,
  },
  sceneGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    backgroundColor: kidsColors.card, borderRadius: kidsBorderRadius.md,
    padding: kidsSpacing.xs, ...kidsShadows.card, width: '100%', aspectRatio: 1,
  },
  cell: {
    width: '25%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center',
    borderWidth: 0.5, borderColor: kidsColors.border,
  },
  cellFound: {backgroundColor: kidsColors.correctLight},
  cellHinted: {backgroundColor: kidsColors.backgroundTertiary},
  foundCircle: {
    position: 'absolute', bottom: 1, right: 1,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: kidsColors.correct, justifyContent: 'center', alignItems: 'center',
  },
  instruction: {
    fontSize: kidsFontSize.sm, color: kidsColors.textMuted,
    textAlign: 'center', marginTop: kidsSpacing.md,
  },
});

export default SpotDifferenceTemplate;
