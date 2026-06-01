/**
 * BookmarkButton — save/unsave a post.  Caller-controlled state
 * (isSaved + onToggle) lets Footer/Post wire to whatever store +
 * server contract becomes canonical in P2 without re-shipping the
 * primitive itself.
 *
 * Internally, the tap is routed through `services/optimistic` so the
 * UI flips immediately and reverts silently on failure — the caller's
 * `onToggle` returns a Promise that resolves on success / rejects on
 * failure.  The optimistic helper handles haptics + error toast.
 *
 * Visual:
 *   - bookmark-outline → bookmark filled, accent color when saved.
 *   - 44 × 44 hit slop ensures the WCAG / HIG minimum tap target even
 *     when the visual icon is smaller.
 *
 * Plan ref: Part X.3.2 (sunny-gliding-eich.md).  Wiring into the
 * Post Footer + the server-side /api/social/saved endpoint contract
 * land in Pass P2 (Part X.5).
 */
import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { optimistic } from '../../../../../../services/optimistic';

const ACCENT = '#6C63FF';
const MUTED = '#888888';

const BookmarkButton = ({
  isSaved = false,
  onToggle,
  size = 22,
  applyLocal,
  rollbackLocal,
}) => {
  const handlePress = useCallback(() => {
    const next = !isSaved;
    optimistic({
      apply: () => {
        if (typeof applyLocal === 'function') applyLocal(next);
      },
      request: () => {
        if (typeof onToggle === 'function') {
          const result = onToggle(next);
          return result && typeof result.then === 'function'
            ? result
            : Promise.resolve(result);
        }
        return Promise.resolve();
      },
      rollback: () => {
        if (typeof rollbackLocal === 'function') {
          rollbackLocal(isSaved);
        } else if (typeof applyLocal === 'function') {
          applyLocal(isSaved);
        }
      },
      errorToast: next
        ? "Couldn't save — try again"
        : "Couldn't unsave — try again",
      successHaptic: next ? 'light' : null,
    });
  }, [isSaved, onToggle, applyLocal, rollbackLocal]);

  return (
    <TouchableOpacity
      onPress={handlePress}
      hitSlop={{ top: 11, bottom: 11, left: 11, right: 11 }}
      accessibilityRole="button"
      accessibilityLabel={isSaved ? 'Unsave post' : 'Save post'}
      accessibilityState={{ selected: isSaved }}
      style={styles.btn}
      testID={isSaved ? 'BookmarkButton.saved' : 'BookmarkButton.unsaved'}
    >
      <MaterialCommunityIcons
        name={isSaved ? 'bookmark' : 'bookmark-outline'}
        size={size}
        color={isSaved ? ACCENT : MUTED}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  btn: {
    padding: 8,
  },
});

export default BookmarkButton;
