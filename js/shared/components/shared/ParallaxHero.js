/**
 * ParallaxHero — cover image + avatar block that responds to a
 * caller-supplied scrollY Animated.Value with magazine-style
 * parallax + bounce-zone scale.
 *
 * Visual behaviour (driven by scrollY):
 *   - Cover translateY = scrollY * 0.5  →  scrolls at HALF the rate
 *     of the rest of the content, so the cover lags behind = parallax.
 *   - Cover scale = scrollY < 0 ? 1 + |scrollY|/300 : 1
 *     →  when the user pulls down past the top (bounce zone), the
 *     cover scales UP to fill the over-pull.  No empty white above.
 *   - Avatar opacity fades 1 → 0.7 as scrollY crosses 80–160 px so
 *     the avatar gradually recedes as the user gets into content.
 *
 * Why users would love this (Part X.4.3 Identity surface):
 *   - Profile feels alive, not flat.  Magazine apps (Apple News,
 *     NYT) use this; social apps that don't (old Twitter web) feel
 *     dated.
 *   - Pulling-down to refresh has a visual payoff (cover zooms)
 *     instead of yanking a static block.
 *
 * Multi-hat self-critique (Part X.2):
 *   - Designer: only the COVER moves at a different rate — name,
 *     bio, counts scroll naturally.  Avoid making everything move
 *     independently (looks like jelly).
 *   - PM: profile visit = identity moment; richer hero = "this user
 *     curated their profile" feeling = engagement.
 *   - A11y: cover image is decorative when there's a name+bio below;
 *     accessibilityLabel='' so screen readers skip it.
 *   - Engineer: useNativeDriver=true on transforms.  Caller passes
 *     scrollY as Animated.Value; we never mutate it.
 *   - Trust & Safety: cover image is user-controlled — should be
 *     content-moderated by the upload pipeline (out of scope here).
 *
 * Props:
 *   - scrollY      : Animated.Value (required)  caller's scroll tracker
 *   - coverUri     : string  cover image URL (background)
 *   - avatarUri    : string  avatar image URL (foreground)
 *   - name         : string  display name (renders below avatar)
 *   - subtitle?    : string  @handle / role / bio first line
 *   - height?      : number  hero block height (default 200)
 *   - children?    : ReactNode  extra content (badges, counts) below name
 *
 * Plan ref: Part X.4.3 + Part X.7.1 (P5 tests).
 */
import React, { useMemo } from 'react';
import { View, Text, Image, Animated, StyleSheet } from 'react-native';

const DEFAULT_HEIGHT = 200;
const COVER_PARALLAX_FACTOR = 0.5;
const BOUNCE_SCALE_FACTOR = 300;

const ParallaxHero = ({
  scrollY,
  coverUri,
  avatarUri,
  name,
  subtitle,
  height = DEFAULT_HEIGHT,
  children,
  testID = 'ParallaxHero',
}) => {
  // Interpolate the cover's transforms from scrollY.  When
  // scrollY < 0 (bounce zone), scale up so the cover fills the
  // over-pull instead of leaving white above.  When scrollY > 0,
  // translateY at half-speed for the parallax lag.
  const coverTransforms = useMemo(() => {
    if (!scrollY || typeof scrollY.interpolate !== 'function') {
      return null;
    }
    const translateY = scrollY.interpolate({
      inputRange: [-height, 0, height * 2],
      outputRange: [0, 0, height * COVER_PARALLAX_FACTOR],
      extrapolate: 'clamp',
    });
    const scale = scrollY.interpolate({
      inputRange: [-height, 0, height * 2],
      outputRange: [1 + height / BOUNCE_SCALE_FACTOR, 1, 1],
      extrapolate: 'clamp',
    });
    return [{ translateY }, { scale }];
  }, [scrollY, height]);

  // Avatar fades subtly as the user scrolls past the hero.
  const avatarOpacity = useMemo(() => {
    if (!scrollY || typeof scrollY.interpolate !== 'function') return 1;
    return scrollY.interpolate({
      inputRange: [0, 80, 160],
      outputRange: [1, 1, 0.7],
      extrapolate: 'clamp',
    });
  }, [scrollY]);

  return (
    <View style={[styles.wrap, { height: height + 60 }]} testID={testID}>
      {/* Cover layer — parallaxed + bounce-scaled */}
      <Animated.View
        style={[
          styles.cover,
          { height },
          coverTransforms ? { transform: coverTransforms } : null,
        ]}
        testID={`${testID}.cover`}
      >
        {coverUri ? (
          <Image
            source={{ uri: coverUri }}
            style={styles.coverImage}
            resizeMode="cover"
            accessibilityLabel=""
          />
        ) : (
          <View style={[styles.coverImage, styles.coverPlaceholder]} />
        )}
      </Animated.View>

      {/* Avatar + name layer — sits on top, slight opacity fade */}
      <Animated.View
        style={[styles.avatarBlock, { top: height - 36, opacity: avatarOpacity }]}
        testID={`${testID}.avatarBlock`}
      >
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarInitial}>
              {(name || '?').slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
        <Text style={styles.name} numberOfLines={1} testID={`${testID}.name`}>
          {name || ''}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1} testID={`${testID}.subtitle`}>
            {subtitle}
          </Text>
        ) : null}
        {children}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#0E1114',
  },
  cover: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  coverPlaceholder: {
    backgroundColor: '#1A1A2E',
  },
  avatarBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
    borderColor: '#0E1114',
    backgroundColor: '#1A1A2E',
  },
  avatarPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: {
    color: '#FFF',
    fontSize: 36,
    fontWeight: '800',
  },
  name: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginTop: 8,
  },
  subtitle: {
    color: '#AAAAAA',
    fontSize: 13,
    marginTop: 2,
  },
});

export default ParallaxHero;
