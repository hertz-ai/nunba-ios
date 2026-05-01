import React, {useRef} from 'react';
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
const DragDropArea = ({items, zones, correctMapping, onItemDropped, onAllPlaced, itemSize = 70}) => {
  const placements = useRef({});
  const zoneLayouts = useRef({});

  const DraggableItem = ({item, index}) => {
    const pan = useRef(new Animated.ValueXY()).current;
    const scale = useRef(new Animated.Value(1)).current;
    const placed = useRef(false);

    const panResponder = useRef(
      PanResponder.create({
        onStartShouldSetPanResponder: () => !placed.current,
        onPanResponderGrant: () => {
          Animated.spring(scale, {toValue: 1.15, ...SPRINGS.playful}).start();
        },
        onPanResponderMove: Animated.event([null, {dx: pan.x, dy: pan.y}], {useNativeDriver: false}),
        onPanResponderRelease: (_, gesture) => {
          Animated.spring(scale, {toValue: 1, ...SPRINGS.playful}).start();

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
            const isCorrect = correctMapping[item.id] === droppedZone;

            if (onItemDropped) onItemDropped(item.id, droppedZone, isCorrect);

            if (isCorrect) {
              placed.current = true;
              placements.current[item.id] = {zoneId: droppedZone, isCorrect};

              // Check if all items correctly placed
              if (Object.keys(placements.current).length === items.length) {
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

  return (
    <View style={styles.container}>
      {/* Drop Zones */}
      <View style={styles.zonesContainer}>
        {zones.map(zone => (
          <View
            key={zone.id}
            style={[styles.zone, {borderColor: zone.color || kidsColors.accent}]}
            onLayout={(e) => {
              e.target.measureInWindow((x, y, width, height) => {
                zoneLayouts.current[zone.id] = {x, y, width, height};
              });
            }}
          >
            <Text style={[styles.zoneLabel, {color: zone.color || kidsColors.accent}]}>
              {zone.label}
            </Text>
          </View>
        ))}
      </View>

      {/* Draggable Items */}
      <View style={styles.itemsContainer}>
        {items.map((item, index) => (
          <DraggableItem key={item.id} item={item} index={index} />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: kidsSpacing.md,
  },
  zonesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    marginBottom: kidsSpacing.xl,
  },
  zone: {
    width: 140,
    height: 160,
    borderWidth: 3,
    borderStyle: 'dashed',
    borderRadius: kidsBorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: kidsColors.card,
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
