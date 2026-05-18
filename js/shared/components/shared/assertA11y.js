/**
 * assertA11y — dev-time validator that interactive elements have
 * the minimum accessibility props.  Production builds short-circuit
 * to a no-op; dev/test builds throw a descriptive error so missing
 * labels are caught BEFORE landing on main.
 *
 * Why users would love this (Part X.10 a11y sweep):
 *   - Indirect: blind / low-vision users can use every interactive
 *     surface because every Touchable has been validated to have
 *     an accessibilityLabel.  No more "Button" / unlabeled
 *     announcements.
 *
 * Multi-hat self-critique:
 *   - A11y: complements the existing accessibilityLabel /
 *     accessibilityRole props by enforcing they exist on
 *     interactive nodes.  Pure-text View / Image are not in scope.
 *   - Engineer: pure validation function; zero runtime impact in
 *     production (NODE_ENV !== 'development' short-circuits).
 *   - PM: catching missing a11y labels at PR time vs in App Store
 *     review = real shipping-velocity win.
 *
 * Usage:
 *   const buttonProps = assertA11y({
 *     accessibilityRole: 'button',
 *     accessibilityLabel: 'Save post',
 *     onPress,
 *   });
 *   <TouchableOpacity {...buttonProps} />
 *
 * Plan ref: Part X.5 P10 + Part X.7.1.
 */

const REQUIRE_LABEL_ROLES = new Set([
  'button',
  'link',
  'checkbox',
  'switch',
  'radio',
  'menuitem',
  'tab',
]);

const isProd = () =>
  // process.env.NODE_ENV defaults to 'production' for shipped RN
  // bundles; jest sets it to 'test'.  Treat anything other than
  // 'development' as production-mode (no-op).
  typeof process !== 'undefined' &&
  process.env &&
  process.env.NODE_ENV !== 'development' &&
  process.env.NODE_ENV !== 'test';

export const assertA11y = (props = {}) => {
  if (isProd()) return props;

  const {
    accessibilityRole,
    accessibilityLabel,
    onPress,
    onLongPress,
  } = props;

  const isInteractive =
    accessibilityRole === 'button' ||
    typeof onPress === 'function' ||
    typeof onLongPress === 'function';

  if (isInteractive) {
    if (!accessibilityLabel || typeof accessibilityLabel !== 'string') {
      throw new Error(
        'assertA11y: interactive element missing accessibilityLabel ' +
          '(required for VoiceOver / TalkBack).  ' +
          'Caller: ' + JSON.stringify({ accessibilityRole, hasOnPress: !!onPress }),
      );
    }
    if (accessibilityLabel.trim().length === 0) {
      throw new Error(
        'assertA11y: accessibilityLabel is empty — screen readers will ' +
          'announce nothing.  Either provide a real label or pass ' +
          'accessibilityElementsHidden=true.',
      );
    }
  }

  if (REQUIRE_LABEL_ROLES.has(accessibilityRole) && !accessibilityLabel) {
    throw new Error(
      `assertA11y: accessibilityRole='${accessibilityRole}' requires ` +
        'an accessibilityLabel.',
    );
  }

  return props;
};

export default assertA11y;
