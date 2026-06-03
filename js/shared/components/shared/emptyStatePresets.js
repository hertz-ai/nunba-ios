/**
 * emptyStatePresets — curated EmptyState configurations for the
 * community surfaces.  Each preset is a tone-reviewed (icon, title,
 * body, ctaLabel) tuple that callers pass to <EmptyState {...preset}/>.
 *
 * Why this exists (Part X.4.x empty-state sweep):
 *   - 22+ community screens were each inventing their own empty-list
 *     copy.  Result: inconsistent voice ("Nothing here yet" vs
 *     "No posts" vs "—"), missing CTAs, no warmth.
 *   - Curated presets give every screen the SAME tone (warm,
 *     conversational, one clear next-step) without each screen
 *     duplicating decision-making.
 *
 * Multi-hat self-critique on the COPY:
 *   - PM: every preset has exactly ONE CTA — no choice paralysis.
 *     Re-engagement loops are explicit.
 *   - Designer: title ≤ 6 words, body ≤ 14 words, CTA ≤ 3 words.
 *     Same constraints across all presets → visual consistency.
 *   - A11y: copy uses sentence case, no all-caps; CTA verbs are
 *     unambiguous ("Find friends" not "Discover people you may know").
 *   - Trust & Safety: no presets imply success / progress that
 *     doesn't exist; the user knows the list is empty.
 *   - USER POV: "When I open my inbox and it's empty, I want to
 *     know what to do next, not just be told the list is empty."
 *
 * Usage:
 *   import EmptyState from 'shared/EmptyState';
 *   import { emptyStatePreset } from 'shared/emptyStatePresets';
 *
 *   <EmptyState {...emptyStatePreset('inbox-empty')} onCta={...} />
 *
 * The caller wires onCta — preset doesn't carry navigation logic.
 *
 * Plan ref: Part X.4.x + Part X.7.1 (P7 tests).
 */

const PRESETS = Object.freeze({
  'inbox-empty': {
    icon: 'inbox-arrow-down-outline',
    title: 'Inbox zero',
    body: 'New mentions, messages, and invites land here.',
    ctaLabel: 'Find friends',
  },
  'inbox-filtered': {
    icon: 'magnify',
    title: 'Nothing here',
    body: 'Try a different filter or pull to refresh.',
    ctaLabel: 'Clear filters',
  },
  'no-friends': {
    icon: 'account-multiple-outline',
    title: 'No friends yet',
    body: 'Add people you know — they\'ll see your friends-only posts.',
    ctaLabel: 'Add friends',
  },
  'no-pending': {
    icon: 'clock-outline',
    title: 'No pending requests',
    body: 'When someone sends you a friend request, it\'ll appear here.',
    ctaLabel: null,
  },
  'no-blocked': {
    icon: 'shield-check-outline',
    title: 'No blocks',
    body: 'Blocked users won\'t see your posts or message you.',
    ctaLabel: null,
  },
  'no-notifications': {
    icon: 'bell-outline',
    title: 'All caught up',
    body: 'Likes, replies, and mentions will show up here.',
    ctaLabel: null,
  },
  'no-search-results': {
    icon: 'magnify-remove-outline',
    title: 'No matches',
    body: 'Try a different word or check your spelling.',
    ctaLabel: 'Clear search',
  },
  'no-posts': {
    icon: 'post-outline',
    title: 'No posts yet',
    body: 'Share what\'s on your mind — your community will see it.',
    ctaLabel: 'Create a post',
  },
  'no-communities': {
    icon: 'account-group-outline',
    title: 'No communities',
    body: 'Join one to see posts from people who share your interests.',
    ctaLabel: 'Browse communities',
  },
  'no-encounters': {
    icon: 'map-marker-radius-outline',
    title: 'No one nearby',
    body: 'Turn on Discoverable and head somewhere with people.',
    ctaLabel: null,
  },
  'no-invites': {
    icon: 'email-outline',
    title: 'No invites',
    body: 'When someone invites you to a community, it\'ll be here.',
    ctaLabel: null,
  },
  'no-saved': {
    icon: 'bookmark-outline',
    title: 'Nothing saved',
    body: 'Tap the bookmark on any post to save it for later.',
    ctaLabel: null,
  },
  'no-reactions': {
    icon: 'heart-outline',
    title: 'No reactions yet',
    body: 'Your reactions to posts will show up here.',
    ctaLabel: null,
  },
  'no-channels': {
    icon: 'connection',
    title: 'No channels yet',
    body: 'Connect Telegram, Discord, Slack, and 28 more to chat from one place.',
    ctaLabel: 'Add channel',
  },
  'no-tasks': {
    icon: 'clipboard-text-outline',
    title: 'No tasks',
    body: 'Tasks your agents are working on will show up here.',
    ctaLabel: null,
  },
  'no-recipes': {
    icon: 'code-braces-box',
    title: 'No shared recipes',
    body: 'Recipes shared in your network will appear here.',
    ctaLabel: null,
  },
  'no-conversation-history': {
    icon: 'chat-outline',
    title: 'No history yet',
    body: 'Conversations across your connected channels will show up here.',
    ctaLabel: null,
  },
  'no-regions': {
    icon: 'map-search',
    title: 'No regions found',
    body: 'Try a different filter or search term.',
    ctaLabel: 'Clear filters',
  },
  // Polish round 3 2026-06-03: gamification screens were still using
  // raw "No X found" Text — bleak vs the rest of the conversational
  // catalogue.  Three new presets that match the existing tone.
  'no-achievements': {
    icon: 'trophy-outline',
    title: 'No trophies yet',
    body: 'Complete a challenge or hit a streak — they\'ll land here.',
    ctaLabel: 'See challenges',
  },
  'no-resonance-history': {
    icon: 'history',
    title: 'Nothing to recap',
    body: 'Posts, reactions, and helpful comments add to your score.',
    ctaLabel: 'Create a post',
  },
  'no-leaderboard': {
    icon: 'podium',
    title: 'Leaderboard\'s warming up',
    body: 'Once your community gets going, top movers show up here.',
    ctaLabel: null,
  },
});

/**
 * Get a curated EmptyState preset by key.  Returns a copy so callers
 * can override fields without mutating the registry.
 */
export const emptyStatePreset = (key) => {
  const preset = PRESETS[key];
  if (!preset) {
    // Fall through to a neutral default — better than crashing or
    // returning an empty object that produces an unstyled empty state.
    return {
      icon: 'inbox-outline',
      title: 'Nothing here yet',
      body: null,
      ctaLabel: null,
    };
  }
  return { ...preset };
};

/**
 * Listing for tooling / docs / test assertions.
 */
export const listEmptyStatePresets = () => Object.keys(PRESETS);

export default emptyStatePreset;
