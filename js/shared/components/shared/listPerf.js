/**
 * listPerf — FlatList performance helpers.
 *
 *   getItemLayoutFactory(rowHeight, [separatorHeight])
 *       Returns a function suitable for FlatList's `getItemLayout`
 *       prop.  When set, FlatList SKIPS measuring rows at scroll
 *       time — perf wins compound on large lists (100+ rows).  No
 *       measurement passes = smoother 60fps scroll.
 *
 *   flatListVirtualizationProps(rowHeight)
 *       Returns the bundle of FlatList props that consistently
 *       deliver smooth scroll on Hevolve_RN's lists:
 *         - getItemLayout (derived from rowHeight)
 *         - removeClippedSubviews: true
 *         - maxToRenderPerBatch: 8
 *         - initialNumToRender: 12
 *         - windowSize: 11
 *
 * Why users would love this (Part X.10 a11y+perf sweep):
 *   - 60fps scroll on 100-item lists vs the current sluggish
 *     mid-scroll measurement passes.  Animations feel smoother;
 *     no dropped frames during the scroll.
 *   - Memory holds steady on long inbox / feed scrolls because
 *     off-screen views are removed (Android only — iOS already
 *     does this implicitly).
 *
 * Multi-hat self-critique:
 *   - PM: scroll perf = perceived speed = retention.  Cheapest
 *     win possible.
 *   - Designer: no visual change; users see a smoother experience
 *     on the same screens.
 *   - Engineer: rowHeight must be FIXED.  Use ONLY for lists where
 *     rows have stable height (InboxScreen ListRowCard, FriendsScreen,
 *     etc.).  Don't use for the feed (Post heights vary).
 *   - A11y: VoiceOver / TalkBack benefit from virtualization — fewer
 *     nodes for the screen reader's accessibility tree to walk.
 *
 * Plan ref: Part X.5 P10 + Part X.7.1 (P10 tests).
 */

/**
 * Build a getItemLayout callback for FlatList.
 *
 *   const getItemLayout = getItemLayoutFactory(80);
 *   <FlatList getItemLayout={getItemLayout} ... />
 *
 * @param {number} rowHeight    pixel height of one row (including margin)
 * @param {number} separatorHeight  optional extra px between rows (default 0)
 * @returns {function} a (data, index) => {length, offset, index} callback
 */
export const getItemLayoutFactory = (rowHeight, separatorHeight = 0) => {
  if (typeof rowHeight !== 'number' || rowHeight <= 0) {
    throw new TypeError(
      'getItemLayoutFactory: rowHeight must be a positive number',
    );
  }
  const total = rowHeight + (typeof separatorHeight === 'number' ? separatorHeight : 0);
  return (_data, index) => ({
    length: rowHeight,
    offset: total * index,
    index,
  });
};

/**
 * Bundle of FlatList virtualization + clipping props that improve
 * scroll perf on lists where rows have stable height.
 *
 * @param {number} rowHeight  fixed row height
 * @returns {object} spread into <FlatList {...flatListVirtualizationProps(80)} />
 */
export const flatListVirtualizationProps = (rowHeight) => ({
  getItemLayout: getItemLayoutFactory(rowHeight),
  removeClippedSubviews: true,
  maxToRenderPerBatch: 8,
  initialNumToRender: 12,
  windowSize: 11,
});

export default { getItemLayoutFactory, flatListVirtualizationProps };
