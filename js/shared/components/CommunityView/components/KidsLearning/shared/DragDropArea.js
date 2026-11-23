import React, {useCallback, useRef} from 'react';
import {View, Text, StyleSheet, Animated, PanResponder} from 'react-native';
import {kidsColors, kidsSpacing, kidsBorderRadius, kidsFontSize, kidsFontWeight, kidsShadows} from '../../../../../theme/kidsColors';
import {SPRINGS} from './gameThemes';

/**
 * DragDropArea - Reusable drag-and-drop component for kids games.
 *
 * Props:
 * - items: [{ id, label, icon?, color? }] - draggable items
 * - zones: [{ id, label, color }] - drop target zones
 * - correctMapping: { itemId: zoneId } - correct answers
 * - onItemDropped: (itemId, zoneId, isCorrect) => void
 * - onAllPlaced: (results) => void - called when all items placed
 * - itemSize: number - size of draggable items (default 70)
 */
/**
 * One draggable tile.
 *
 * DECLARED AT MODULE SCOPE, and it has to stay here. It used to be defined
 * inside DragDropArea's body, which makes it a NEW component type on every
 * render of the parent - so React unmounted every tile and mounted a fresh one
 * each time, throwing away `pan`, `scale`, `placed` and the PanResponder along
 * with any gesture in progress. On a device that made the sorting games
 * unplayable: the parent re-renders while a finger is down (a zone highlights,
 * the character animates, feedback shows), the tile the child is holding is
 * destroyed mid-drag, and nothing can ever be dropped. Measured on an emulator
 * against the shipped build - a tile did not even lift under a five-second
 * press, while taps elsewhere in the same screen worked.
 *
 * Everything it needs is passed in, and the callbacks are read through a ref at
 * release time: the responder is created once now, so capturing the props from
 * that first render would be a fresh way to go stale.
 */
const DraggableItem = ({
  item,
  index,
  itemSize,
  zoneLayouts,
  remeasureZones,
  placements,
  itemCount,
  handlers,
  onDragActive,
}) => {
  const pan = useRef(new Animated.ValueXY()).current;
  const scale = useRef(new Animated.Value(1)).current;
  const placed = useRef(false);

  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !placed.current,
      onPanResponderGrant: () => {
        // Freeze the board while the tile is held.
        //
        // onPanResponderTerminationRequest is NOT enough on Android. It only
        // governs the JS responder negotiation, and the ScrollView the board
        // now lives in is a NATIVE ScrollView that intercepts a vertical drag
        // through onInterceptTouchEvent, outside that system entirely.
        // Measured: a drag started, the tile lifted, and the BOARD scrolled
        // instead of the item moving - the tray slid from y=2056 to y=1528 and
        // nothing was ever dropped. The template turns scrollEnabled off while
        // this is true.
        if (onDragActive) onDragActive(true);
        // Re-measure the zones every time a drag STARTS.
        //
        // measureInWindow gives a position in the window, and onLayout fires
        // once - so the moment the board is scrolled (it has to scroll; it
        // does not fit a phone) every cached rect is wrong by the scroll
        // offset and drops are tested against where the zones USED to be.
        // Nothing lands, silently. Re-measuring on grant costs one pass per
        // drag and is finished long before the finger is lifted.
        remeasureZones();
        // useNativeDriver FALSE, deliberately, overriding the preset.
        //
        // `scale` shares one transform with `pan`, and `pan` cannot go native:
        // it is driven by Animated.event from the gesture and sprung back on a
        // miss. SPRINGS.playful carries useNativeDriver:true, so lifting the
        // tile moved that transform onto the native driver and the next
        // JS-driven touch of it threw
        //   "Attempting to run JS driven animation on animated node that has
        //    been moved to native earlier"
        // which took the whole app down - measured, VM exiting with result
        // code 2, on the first drop into the WRONG zone (the only path that
        // springs `pan` back). It stayed hidden while DraggableItem was being
        // remounted every render, because no drag ever reached its release.
        Animated.spring(scale, {
          toValue: 1.15, ...SPRINGS.playful, useNativeDriver: false,
        }).start();
      },
      onPanResponderMove: Animated.event([null, {dx: pan.x, dy: pan.y}], {useNativeDriver: false}),
      // Once a tile is picked up it KEEPS the gesture. The board sits in a
      // ScrollView now (it does not fit a phone), and without this the
      // ScrollView can take the drag away mid-move: the child's finger scrolls
      // the page instead of carrying the item.
      onPanResponderTerminationRequest: () => false,
      // If the gesture is taken away anyway - the app backgrounds, the system
      // cancels the touch - put the tile back. There was no terminate handler,
      // so a cancelled drag left the item stranded wherever the finger was,
      // lifted and off its grid slot, for the rest of the game. Seen on a
      // device: three tiles floating mid-board, none of them droppable again.
      onPanResponderTerminate: () => {
        if (onDragActive) onDragActive(false);
        Animated.spring(scale, {
          toValue: 1, ...SPRINGS.playful, useNativeDriver: false,
        }).start();
        Animated.spring(pan, {
          toValue: {x: 0, y: 0}, ...SPRINGS.playful, useNativeDriver: false,
        }).start();
      },
      onPanResponderRelease: (_, gesture) => {
        if (onDragActive) onDragActive(false);
        Animated.spring(scale, {
          toValue: 1, ...SPRINGS.playful, useNativeDriver: false,
        }).start();
        const {correctMapping, onItemDropped, onAllPlaced} = handlersRef.current;

        // Check if dropped on a zone
        let droppedZone = null;
        for (const [zoneId, layout] of Object.entries(zoneLayouts.current)) {
          if (
            gesture.moveX >= layout.x &&
            gesture.moveX <= layout.x + layout.width &&
            gesture.moveY >= layout.y &&
            gesture.moveY <= layout.y + layout.height
          ) {
            droppedZone = zoneId;
            break;
          }
        }

        if (droppedZone) {
          const isCorrect = (correctMapping || {})[item.id] === droppedZone;

          if (onItemDropped) onItemDropped(item.id, droppedZone, isCorrect);

          if (isCorrect) {
            placed.current = true;
            placements.current[item.id] = {zoneId: droppedZone, isCorrect};

            // Check if all items correctly placed
            if (Object.keys(placements.current).length === itemCount) {
              if (onAllPlaced) onAllPlaced(placements.current);
            }
          } else {
            // Wrong zone -> bounce back
            Animated.spring(pan, {toValue: {x: 0, y: 0}, ...SPRINGS.playful, useNativeDriver: false}).start();
          }
        } else {
          // Not on any zone, bounce back
          Animated.spring(pan, {toValue: {x: 0, y: 0}, ...SPRINGS.playful, useNativeDriver: false}).start();
        }
      },
    }),
  ).current;

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[
        styles.draggableItem,
        {
          width: itemSize,
          height: itemSize,
          backgroundColor: item.color || kidsColors.palette[index % kidsColors.palette.length],
          transform: [{translateX: pan.x}, {translateY: pan.y}, {scale}],
        },
      ]}
    >
      <Text style={styles.itemText} numberOfLines={2}>{item.label}</Text>
    </Animated.View>
  );
};

const DragDropArea = ({items, zones, correctMapping, onItemDropped, onAllPlaced, onDragActive,
                       placedItems = {}, allItems = [], highlightedZone = null, itemSize = 70}) => {
  const placements = useRef({});
  const zoneLayouts = useRef({});
  const zoneRefs = useRef({});
  const handlers = {correctMapping, onItemDropped, onAllPlaced};

  const remeasureZones = useCallback(() => {
    Object.entries(zoneRefs.current).forEach(([zoneId, node]) => {
      if (node && node.measureInWindow) {
        node.measureInWindow((x, y, width, height) => {
          zoneLayouts.current[zoneId] = {x, y, width, height};
        });
      }
    });
  }, []);

  return (
    <View style={styles.container}>
      {/* Drop Zones */}
      <View style={styles.zonesContainer}>
        {zones.map(zone => (
          <View
            key={zone.id}
            ref={(node) => { zoneRefs.current[zone.id] = node; }}
            style={[
              styles.zone,
              {borderColor: zone.color || kidsColors.accent},
              highlightedZone === zone.id && styles.zoneHighlighted,
            ]}
            onLayout={(e) => {
              e.target.measureInWindow((x, y, width, height) => {
                zoneLayouts.current[zone.id] = {x, y, width, height};
              });
            }}
          >
            <Text style={[styles.zoneLabel, {color: zone.color || kidsColors.accent}]}>
              {zone.label}
            </Text>
            {/* What has been sorted here, shown INSIDE the real drop zone. The
              * template used to draw a second, identical row of zones above
              * these purely to hold them, which doubled the board's height and
              * left two boxes with the same label where only one took a drop. */}
            {Object.entries(placedItems)
              .filter(([, zId]) => zId === zone.id)
              .map(([itemId]) => allItems.find((i) => i.id === itemId))
              .filter(Boolean)
              .map((placed) => (
                <View
                  key={placed.id}
                  style={[styles.placedChip, {backgroundColor: zone.color || kidsColors.accent}]}
                >
                  <Text style={styles.placedChipText} numberOfLines={1}>{placed.label}</Text>
                </View>
              ))}
          </View>
        ))}
      </View>

      {/* Draggable Items */}
      <View style={styles.itemsContainer}>
        {items.map((item, index) => (
          <DraggableItem
            key={item.id}
            item={item}
            index={index}
            itemSize={itemSize}
            zoneLayouts={zoneLayouts}
            remeasureZones={remeasureZones}
            placements={placements}
            itemCount={items.length}
            handlers={handlers}
            onDragActive={onDragActive}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Sizes to its content, NOT flex:1. Its only caller now scrolls the board
    // (the content does not fit a phone), and flex:1 collapses to nothing
    // inside a ScrollView.
    padding: kidsSpacing.md,
  },
  zonesContainer: {
    flexDirection: 'row',
    // WRAPS. The decks are not uniform - they ship with 2, 3 and 4 zones -
    // and a row of fixed 140dp zones needs 420dp at three and 560dp at four,
    // against ~328dp of usable width on a 360dp phone. React Native defaults
    // flexShrink to 0 (web CSS defaults it to 1), so without this the extra
    // zones simply ran off the right edge and could never be dropped on: ten
    // of the fifteen decks, including every 4-zone one. A drive harness
    // cannot catch it because a test renderer performs no layout.
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: kidsSpacing.sm,
    marginBottom: kidsSpacing.xl,
  },
  zone: {
    // Shrink before wrapping: three zones squeeze to ~109dp and stay on one
    // row, four fall to two rows rather than going below a tappable width.
    flexBasis: 140,
    flexShrink: 1,
    minWidth: 96,
    maxWidth: 140,
    minHeight: 160,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: kidsBorderRadius.lg,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingVertical: kidsSpacing.sm,
    backgroundColor: kidsColors.card,
  },
  zoneHighlighted: {
    borderWidth: 5,
  },
  placedChip: {
    borderRadius: kidsBorderRadius.sm,
    paddingVertical: 4,
    paddingHorizontal: kidsSpacing.sm,
    marginTop: 4,
    width: '92%',
  },
  placedChipText: {
    fontSize: kidsFontSize.xs,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
    textAlign: 'center',
  },
  zoneLabel: {
    fontSize: kidsFontSize.md,
    fontWeight: kidsFontWeight.bold,
    textAlign: 'center',
  },
  itemsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: kidsSpacing.md,
  },
  draggableItem: {
    borderRadius: kidsBorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    padding: kidsSpacing.sm,
    ...kidsShadows.card,
  },
  itemText: {
    fontSize: kidsFontSize.sm,
    fontWeight: kidsFontWeight.bold,
    color: kidsColors.textOnDark,
    textAlign: 'center',
  },
});

export default DragDropArea;
