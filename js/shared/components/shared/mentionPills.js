/**
 * mentionPills — pure-JS helper to render text with @-mentions
 * styled as inline pills. Used by post body rendering, comment
 * rendering, and chat message rendering anywhere the server
 * returns content with embedded `@username` tokens.
 *
 * Plan reference: sunny-gliding-eich.md, Part F.5 + Part D.2.
 *
 * Why a helper, not a component: mentions appear inside Text
 * elements (paragraphs of post body, comment lines) where wrapping
 * each pill in a separate component breaks Text inheritance.
 * This returns an array of <Text> children that the caller drops
 * directly into its own <Text> wrapper.
 *
 * Usage:
 *   import {parseMentionPills} from '../../shared/mentionPills';
 *
 *   <Text style={styles.body}>
 *     {parseMentionPills(post.content, {
 *       mentions: post.mentions,  // optional — server-resolved refs
 *       onPress: (ref) => navigation.navigate('Profile', {userId: ref.id}),
 *     })}
 *   </Text>
 *
 * Color convention (matches MentionInput dropdown):
 *   - human mention: green (#5d8a6b)
 *   - agent mention: purple (#a78bfa)
 *   - unresolved (no ref provided): plain inline @text in body color
 */
import React from 'react';
import {Text} from 'react-native';

// Mirror of integrations/social/mention_service.py USERNAME_PATTERN.
const USERNAME_PATTERN = /(^|[^\w])(@[a-zA-Z0-9_.-]{2,40})/g;

const HUMAN_COLOR = '#5d8a6b';
const AGENT_COLOR = '#a78bfa';

/**
 * Parse `content` and return an array of Text fragments.
 * Strings + <Text> nodes interleaved in original order.
 *
 * @param {string} content
 * @param {object} [opts]
 * @param {Array<{username, kind, id, agent_owner_id}>} [opts.mentions]
 *   Server-resolved mention refs. When provided, pills are coloured
 *   by kind and wired with onPress.
 * @param {(ref: object) => void} [opts.onPress]
 *   Tap handler receiving the matched mention ref. Called only for
 *   mentions present in opts.mentions; unresolved @-tokens stay
 *   plain text.
 * @param {object} [opts.style]  Optional override for pill style.
 * @returns {React.ReactNode[]}
 */
export function parseMentionPills(content, opts = {}) {
  if (!content) return [];

  const refsByName = new Map();
  if (Array.isArray(opts.mentions)) {
    for (const m of opts.mentions) {
      if (m && m.username) {
        refsByName.set(String(m.username).toLowerCase(), m);
      }
    }
  }

  const fragments = [];
  let lastIndex = 0;
  let key = 0;
  // Reset regex state per call (it's a /g regex shared across calls).
  USERNAME_PATTERN.lastIndex = 0;

  let match;
  while ((match = USERNAME_PATTERN.exec(content)) !== null) {
    const lead = match[1] || '';
    const token = match[2]; // includes the leading '@'
    const username = token.slice(1).toLowerCase();
    // Push everything between last match and this one (incl. lead char)
    const start = match.index;
    if (start > lastIndex) {
      fragments.push(content.slice(lastIndex, start));
    }
    if (lead) fragments.push(lead);

    const ref = refsByName.get(username);
    if (ref) {
      const color =
        ref.kind === 'agent' || ref.agent_kind === 'agent'
          ? AGENT_COLOR
          : HUMAN_COLOR;
      fragments.push(
        <Text
          key={`mention-${key++}`}
          style={[{color, fontWeight: '600'}, opts.style]}
          onPress={
            opts.onPress
              ? () => opts.onPress(ref)
              : undefined
          }
        >
          {token}
        </Text>,
      );
    } else {
      // No server resolution — render as plain text. Don't fake
      // a pill since we can't validate the username exists.
      fragments.push(token);
    }
    lastIndex = start + match[0].length;
  }
  if (lastIndex < content.length) {
    fragments.push(content.slice(lastIndex));
  }
  return fragments;
}

export default parseMentionPills;
