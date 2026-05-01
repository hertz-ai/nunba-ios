import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  kidsColors,
  kidsSpacing,
  kidsBorderRadius,
  kidsFontSize,
  kidsFontWeight,
  kidsShadows,
} from '../../../../../theme/kidsColors';
import OptionButton from '../shared/OptionButton';
import ProgressDots from '../shared/ProgressDots';
import FeedbackOverlay from '../shared/FeedbackOverlay';
import TimerBar from '../shared/TimerBar';
import {SPRINGS} from '../shared/gameThemes';

/**
 * SimulationTemplate - Interactive cause-and-effect scenario.
 *
 * Shows a wallet with remaining money and items to buy. Child taps items
 * to purchase. Evaluates choices (healthy vs unhealthy, savings).
 * Teaches budgeting, healthy choices, decision-making.
 *
 * Props:
 * - config: { content: { scenario: { title, concept, startingMoney, items, goal } } }
 * - onAnswer: (isCorrect, concept, responseTimeMs) => void
 * - onComplete: () => void
 */

const ITEM_BG_COLORS = [
  '#E8F5E9',
  '#FFF3E0',
  '#E3F2FD',
  '#FCE4EC',
  '#F3E5F5',
  '#E0F7FA',
  '#FFF9C4',
  '#EFEBE9',
];

const SimulationTemplate = ({config, onAnswer, onComplete}) => {
  const content = config?.content || {};
  const scenario = content.scenario || {};
  const title = scenario.title || 'Shopping Trip';
  const concept = scenario.concept || 'money:shopping';
  const startingMoney = scenario.startingMoney || 10;
  const items = scenario.items || [];
  const goal = scenario.goal || 'Make wise choices!';

  // Game state
  const [money, setMoney] = useState(startingMoney);
  const [purchasedItems, setPurchasedItems] = useState([]); // Array of item objects
  const [isFinished, setIsFinished] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackCorrect, setFeedbackCorrect] = useState(true);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [cantAffordItem, setCantAffordItem] = useState(null);

  // Adaptive state
  const consecutiveBad = useRef(0);
  const purchaseStartTime = useRef(Date.now());
  const totalGoodPurchases = useRef(0);
  const totalBadPurchases = useRef(0);
  const mountedRef = useRef(true);
  const completedRef = useRef(false);

  useEffect(() => () => { mountedRef.current = false; }, []);

  // Animations
  const walletAnim = useRef(new Animated.Value(1)).current;
  const moneyAnim = useRef(new Animated.Value(0)).current;
  const itemAnims = useRef(items.map(() => new Animated.Value(0))).current;
  const cartBounce = useRef(new Animated.Value(1)).current;

  // Entrance animations
  useEffect(() => {
    purchaseStartTime.current = Date.now();

    // Stagger item card entrance
    items.forEach((_, i) => {
      Animated.spring(itemAnims[i] || new Animated.Value(1), {
        toValue: 1,
        ...SPRINGS.snappy,
        delay: 200 + i * 100,
      }).start();
    });
  }, []);

  // Wallet shake when purchase happens
  const animateWallet = useCallback(
    (isGood) => {
      Animated.sequence([
        Animated.spring(walletAnim, {
          toValue: 0.9,
          ...SPRINGS.quick,
        }),
        Animated.spring(walletAnim, {
          toValue: 1,
          ...SPRINGS.playful,
        }),
      ]).start();

      // Money fly animation
      moneyAnim.setValue(1);
      Animated.timing(moneyAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }).start();
    },
    [walletAnim, moneyAnim],
  );

  // Cart bounce
  const animateCart = useCallback(() => {
    Animated.sequence([
      Animated.spring(cartBounce, {
        toValue: 1.2,
        ...SPRINGS.quick,
      }),
      Animated.spring(cartBounce, {
        toValue: 1,
        ...SPRINGS.playful,
      }),
    ]).start();
  }, [cartBounce]);

  // Handle purchase
  const handleBuy = useCallback(
    (item) => {
      if (isFinished) return;

      // Check if can afford
      if (item.price > money) {
        setCantAffordItem(item.name);
        setTimeout(() => {
          if (mountedRef.current) setCantAffordItem(null);
        }, 1500);
        return;
      }

      const responseTimeMs = Date.now() - purchaseStartTime.current;
      purchaseStartTime.current = Date.now();
      const isGood = item.isGood !== false;

      // Deduct money
      setMoney(prev => prev - item.price);
      setPurchasedItems(prev => [...prev, item]);
      animateWallet(isGood);
      animateCart();

      // Track good/bad
      if (isGood) {
        totalGoodPurchases.current += 1;
        consecutiveBad.current = 0;
        setShowHint(false);
        setFeedbackMessage('Nice choice!');
      } else {
        totalBadPurchases.current += 1;
        consecutiveBad.current += 1;
        setFeedbackMessage('Hmm, is that the best choice?');

        // Adapt: show hints after consecutive bad purchases
        if (consecutiveBad.current >= 3) {
          setShowHint(true);
        }
      }

      setFeedbackCorrect(isGood);
      setShowFeedback(true);

      // Report answer
      if (onAnswer) {
        onAnswer(isGood, concept, responseTimeMs);
      }

      // Auto-dismiss feedback
      setTimeout(() => {
        if (mountedRef.current) setShowFeedback(false);
      }, 800);
    },
    [money, isFinished, concept, onAnswer, animateWallet, animateCart],
  );

  // Finish shopping
  const handleDone = useCallback(() => {
    setIsFinished(true);
  }, []);

  // Complete
  const handleFinish = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (onComplete) {
      onComplete();
    }
  }, [onComplete]);

  // Calculate final score
  const getEvaluation = useCallback(() => {
    const moneyLeft = money;
    const goodCount = totalGoodPurchases.current;
    const badCount = totalBadPurchases.current;
    const totalPurchased = purchasedItems.length;
    const totalSpent = startingMoney - moneyLeft;

    let stars = 0;
    let message = '';

    // Star calculation
    if (goodCount > badCount) stars += 1;
    if (badCount === 0) stars += 1;
    if (moneyLeft > 0) stars += 1;

    if (stars === 3) {
      message = 'Amazing! You made all great choices and saved money too!';
    } else if (stars === 2) {
      message = 'Good job! You made mostly smart choices.';
    } else if (stars === 1) {
      message = 'Not bad! Try to pick healthier or wiser options next time.';
    } else {
      message = 'Keep practicing! Think about what you really need vs want.';
    }

    return {moneyLeft, goodCount, badCount, totalPurchased, totalSpent, stars, message};
  }, [money, purchasedItems, startingMoney]);

  // Render finished screen
  if (isFinished) {
    const evaluation = getEvaluation();
    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.evalContainer}>
          <Icon name="cart-check" size={70} color={kidsColors.correct} />
          <Text style={styles.evalTitle}>Shopping Complete!</Text>

          {/* Stars */}
          <View style={styles.starsRow}>
            {[0, 1, 2].map(i => (
              <Icon
                key={i}
                name={i < evaluation.stars ? 'star' : 'star-outline'}
                size={40}
                color={
                  i < evaluation.stars
                    ? kidsColors.starGold
                    : kidsColors.textMuted
                }
              />
            ))}
          </View>

          <Text style={styles.evalMessage}>{evaluation.message}</Text>

          {/* Stats */}
          <View style={styles.evalStatsCard}>
            <View style={styles.evalStatRow}>
              <Icon name="wallet" size={22} color={kidsColors.accent} />
              <Text style={styles.evalStatLabel}>Money left:</Text>
              <Text style={styles.evalStatValue}>
                ${evaluation.moneyLeft}
              </Text>
            </View>
            <View style={styles.evalStatRow}>
              <Icon name="cash" size={22} color={kidsColors.incorrect} />
              <Text style={styles.evalStatLabel}>Spent:</Text>
              <Text style={styles.evalStatValue}>
                ${evaluation.totalSpent}
              </Text>
            </View>
            <View style={styles.evalStatRow}>
              <Icon name="thumb-up" size={22} color={kidsColors.correct} />
              <Text style={styles.evalStatLabel}>Good picks:</Text>
              <Text style={[styles.evalStatValue, {color: kidsColors.correct}]}>
                {evaluation.goodCount}
              </Text>
            </View>
            <View style={styles.evalStatRow}>
              <Icon name="thumb-down" size={22} color={kidsColors.incorrect} />
              <Text style={styles.evalStatLabel}>Not-so-good:</Text>
              <Text
                style={[styles.evalStatValue, {color: kidsColors.incorrect}]}>
                {evaluation.badCount}
              </Text>
            </View>
          </View>

          {/* Purchased items list */}
          {purchasedItems.length > 0 && (
            <View style={styles.receiptCard}>
              <Text style={styles.receiptTitle}>Your Receipt:</Text>
              {purchasedItems.map((item, i) => (
                <View key={i} style={styles.receiptRow}>
                  <Icon
                    name={item.icon || 'package'}
                    size={18}
                    color={
                      item.isGood ? kidsColors.correct : kidsColors.incorrect
                    }
                  />
                  <Text style={styles.receiptName}>{item.name}</Text>
                  <Text style={styles.receiptPrice}>${item.price}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.finishButton}
            onPress={handleFinish}
            activeOpacity={0.8}>
            <Text style={styles.finishButtonText}>Continue</Text>
            <Icon
              name="arrow-right"
              size={24}
              color={kidsColors.textOnDark}
            />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  // Render shopping screen
  const availableItems = items.filter(
    item => !purchasedItems.find(p => p.name === item.name),
  );

  return (
    <View style={styles.container}>
      {/* Feedback overlay */}
      <FeedbackOverlay
        visible={showFeedback}
        isCorrect={feedbackCorrect}
        message={feedbackMessage}
        onDismiss={() => {}}
      />

      {/* Header: Goal */}
      <View style={styles.goalBanner}>
        <Icon name="target" size={20} color={kidsColors.accent} />
        <Text style={styles.goalText}>{goal}</Text>
      </View>

      {/* Wallet */}
      <Animated.View
        style={[styles.walletCard, {transform: [{scale: walletAnim}]}]}>
        <View style={styles.walletLeft}>
          <Icon name="wallet" size={36} color={kidsColors.accent} />
          <View>
            <Text style={styles.walletLabel}>Your Money</Text>
            <Text
              style={[
                styles.walletAmount,
                money <= 2 && {color: kidsColors.incorrect},
              ]}>
              ${money}
            </Text>
          </View>
        </View>
        <Animated.View style={[styles.walletRight, {transform: [{scale: cartBounce}]}]}>
          <Icon name="cart" size={28} color={kidsColors.textSecondary} />
          <Text style={styles.cartCount}>{purchasedItems.length}</Text>
        </Animated.View>
      </Animated.View>

      {/* Money fly animation */}
      <Animated.View
        style={[
          styles.moneyFly,
          {
            opacity: moneyAnim,
            transform: [
              {
                translateY: moneyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -30],
                }),
              },
            ],
          },
        ]}
        pointerEvents="none">
        <Text style={styles.moneyFlyText}>-$</Text>
      </Animated.View>

      {/* Hint banner */}
      {showHint && (
        <View style={styles.hintBanner}>
          <Icon name="lightbulb-on" size={18} color={kidsColors.star} />
          <Text style={styles.hintText}>
            Look for items marked with a heart - those are the healthier
            choices!
          </Text>
        </View>
      )}

      {/* Can't afford message */}
      {cantAffordItem && (
        <View style={styles.cantAffordBanner}>
          <Icon name="alert-circle" size={18} color={kidsColors.incorrect} />
          <Text style={styles.cantAffordText}>
            Not enough money for {cantAffordItem}!
          </Text>
        </View>
      )}

      {/* Items Grid */}
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.itemsGrid}>
        {availableItems.map((item, index) => {
          const animVal = itemAnims[items.indexOf(item)] || new Animated.Value(1);
          const canAfford = money >= item.price;
          const bgColor =
            ITEM_BG_COLORS[index % ITEM_BG_COLORS.length];

          return (
            <Animated.View
              key={item.name}
              style={[
                styles.itemCardWrapper,
                {
                  transform: [
                    {
                      scale: animVal.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.5, 1],
                      }),
                    },
                  ],
                  opacity: animVal,
                },
              ]}>
              <TouchableOpacity
                style={[
                  styles.itemCard,
                  {backgroundColor: bgColor},
                  !canAfford && styles.itemCardDisabled,
                ]}
                onPress={() => handleBuy(item)}
                disabled={!canAfford}
                activeOpacity={0.7}>
                <Icon
                  name={item.icon || 'package'}
                  size={40}
                  color={
                    canAfford ? kidsColors.textPrimary : kidsColors.textMuted
                  }
                />
                <Text
                  style={[
                    styles.itemName,
                    !canAfford && styles.itemNameDisabled,
                  ]}>
                  {item.name}
                </Text>
                <View style={styles.priceTag}>
                  <Icon
                    name="currency-usd"
                    size={16}
                    color={
                      canAfford
                        ? kidsColors.textOnDark
                        : kidsColors.textMuted
                    }
                  />
                  <Text
                    style={[
                      styles.priceText,
                      !canAfford && {color: kidsColors.textMuted},
                    ]}>
                    {item.price}
                  </Text>
                </View>
                {/* Subtle hint for good items */}
                {showHint && item.isGood && (
                  <View style={styles.goodBadge}>
                    <Icon name="heart" size={14} color={kidsColors.correct} />
                  </View>
                )}
                {!canAfford && (
                  <View style={styles.soldOutBadge}>
                    <Text style={styles.soldOutText}>Can't afford</Text>
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          );
        })}
      </ScrollView>

      {/* Done Shopping Button */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[
            styles.doneButton,
            purchasedItems.length === 0 && styles.doneButtonDisabled,
          ]}
          onPress={handleDone}
          disabled={purchasedItems.length === 0}
          activeOpacity={0.8}>
          <Icon name="check" size={22} color={kidsColors.textOnDark} />
          <Text style={styles.doneButtonText}>Done Shopping</Text>
        </TouchableOpacity>
        {availableItems.length === 0 && (
          <Text style={styles.allBoughtText}>
            You bought everything! Tap "Done Shopping" to see your results.
          </Text>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: kidsColors.background,
  },
  // Goal
  goalBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    marginHorizontal: kidsSpacing.lg,
    marginTop: kidsSpacing.md,
    padding: kidsSpacing.md,
    borderRadius: kidsBorderRadius.lg,
    gap: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  goalText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.semibold,
    color: kidsColors.textPrimary,
    flex: 1,
  },
  // Wallet
  walletCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
    marginHorizontal: kidsSpacing.lg,
    marginTop: kidsSpacing.md,
    padding: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.xl,
    ...kidsShadows.float,
  },
  walletLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.md,
  },
  walletLabel: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
  },
  walletAmount: {
    fontSize: kidsFontSize.xxl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
  },
  walletRight: {
    alignItems: 'center',
  },
  cartCount: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
    marginTop: 2,
  },
  // Money fly
  moneyFly: {
    position: 'absolute',
    top: 140,
    right: 60,
    zIndex: 50,
  },
  moneyFlyText: {
    fontSize: kidsFontSize.xl,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.incorrect,
  },
  // Hint
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.hintBg,
    marginHorizontal: kidsSpacing.lg,
    marginTop: kidsSpacing.sm,
    padding: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.md,
    gap: kidsSpacing.sm,
    borderWidth: 1,
    borderColor: kidsColors.star,
  },
  hintText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    flex: 1,
  },
  // Can't afford
  cantAffordBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.incorrectLight,
    marginHorizontal: kidsSpacing.lg,
    marginTop: kidsSpacing.sm,
    padding: kidsSpacing.sm,
    borderRadius: kidsBorderRadius.md,
    gap: kidsSpacing.sm,
  },
  cantAffordText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.incorrect,
    fontWeight: kidsFontWeight.semibold,
  },
  // Items
  scrollArea: {
    flex: 1,
    marginTop: kidsSpacing.md,
  },
  itemsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    paddingHorizontal: kidsSpacing.md,
    gap: kidsSpacing.md,
    paddingBottom: kidsSpacing.lg,
  },
  itemCardWrapper: {
    width: '45%',
  },
  itemCard: {
    alignItems: 'center',
    padding: kidsSpacing.lg,
    borderRadius: kidsBorderRadius.xl,
    ...kidsShadows.card,
    position: 'relative',
  },
  itemCardDisabled: {
    opacity: 0.5,
  },
  itemName: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    marginTop: kidsSpacing.sm,
    textAlign: 'center',
  },
  itemNameDisabled: {
    color: kidsColors.textMuted,
  },
  priceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: kidsColors.accent,
    paddingHorizontal: kidsSpacing.md,
    paddingVertical: kidsSpacing.xs,
    borderRadius: kidsBorderRadius.full,
    marginTop: kidsSpacing.sm,
  },
  priceText: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textOnDark,
  },
  goodBadge: {
    position: 'absolute',
    top: kidsSpacing.sm,
    right: kidsSpacing.sm,
    backgroundColor: kidsColors.correctLight,
    padding: 4,
    borderRadius: kidsBorderRadius.full,
  },
  soldOutBadge: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.6)',
    borderRadius: kidsBorderRadius.xl,
  },
  soldOutText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textMuted,
  },
  // Bottom bar
  bottomBar: {
    padding: kidsSpacing.lg,
    backgroundColor: kidsColors.card,
    borderTopWidth: 1,
    borderTopColor: kidsColors.border,
    alignItems: 'center',
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kidsColors.correct,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.sm,
    ...kidsShadows.button,
    width: '100%',
  },
  doneButtonDisabled: {
    backgroundColor: kidsColors.textMuted,
  },
  doneButtonText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
  allBoughtText: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textSecondary,
    marginTop: kidsSpacing.sm,
    textAlign: 'center',
  },
  // Evaluation screen
  evalContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.xl,
    paddingBottom: kidsSpacing.xxl,
  },
  evalTitle: {
    fontSize: kidsFontSize.display,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.correct,
    marginTop: kidsSpacing.md,
    marginBottom: kidsSpacing.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.md,
  },
  evalMessage: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.medium,
    color: kidsColors.textPrimary,
    textAlign: 'center',
    lineHeight: 28,
    marginBottom: kidsSpacing.lg,
    paddingHorizontal: kidsSpacing.md,
  },
  evalStatsCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    ...kidsShadows.card,
    width: '100%',
    gap: kidsSpacing.md,
    marginBottom: kidsSpacing.lg,
  },
  evalStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
  },
  evalStatLabel: {
    fontSize: kidsFontSize.md,
    color: kidsColors.textSecondary,
    flex: 1,
  },
  evalStatValue: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.extrabold,
    color: kidsColors.textPrimary,
  },
  receiptCard: {
    backgroundColor: kidsColors.card,
    borderRadius: kidsBorderRadius.xl,
    padding: kidsSpacing.lg,
    ...kidsShadows.card,
    width: '100%',
    marginBottom: kidsSpacing.lg,
  },
  receiptTitle: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textPrimary,
    marginBottom: kidsSpacing.md,
  },
  receiptRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: kidsSpacing.sm,
    paddingVertical: kidsSpacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: kidsColors.border,
  },
  receiptName: {
    fontSize: kidsFontSize.sm,
    color: kidsColors.textPrimary,
    flex: 1,
  },
  receiptPrice: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textSecondary,
  },
  finishButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: kidsColors.accent,
    paddingVertical: kidsSpacing.md,
    paddingHorizontal: kidsSpacing.xl,
    borderRadius: kidsBorderRadius.xl,
    gap: kidsSpacing.sm,
    ...kidsShadows.button,
  },
  finishButtonText: {
    fontSize: kidsFontSize.lg,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
  },
});

export default SimulationTemplate;
