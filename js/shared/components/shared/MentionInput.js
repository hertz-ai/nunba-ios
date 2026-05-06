/**
 * MentionInput — drop-in replacement for <TextInput> with @-mention
 * autocomplete. Built once, used everywhere a user composes text:
 * post composer, comment composer, chat input, conversation input.
 *
 * Plan reference: sunny-gliding-eich.md, Part D.3 + Part F.3.
 *
 * Design contract:
 *   - Pure JS — no native pod work. Works on Android + iOS without
 *     platform-specific imports beyond core react-native.
 *   - Honors no-parallel-paths principle: composers swap their
 *     <TextInput> for <MentionInput> with the same props (value,
 *     onChangeText, multiline, etc). Existing styling unchanged.
 *   - Server-flag-gated: the autocomplete endpoint returns [] when
 *     the `mentions_autocomplete` feature flag is off, so the
 *     dropdown stays empty in dev / unflipped tenants. Safe to ship
 *     before the server flag flips.
 *
 * Behavior:
 *   1. As the user types, watch for an "@" character that begins a
 *      mention token. Token spans from the "@" to the next
 *      whitespace, newline, or end of string.
 *   2. While in a mention token, debounce 200 ms then fetch
 *      mentionsApi.autocomplete(prefix, scope).
 *   3. Render the result list as an inline floating dropdown above
 *      the input (or below if input is at the top of the screen).
 *   4. Tap a row → replace the @prefix in the text with @<username>
 *      and append a ref to the in-memory mentions array, exposed
 *      via the optional onMentionsChange prop.
 *   5. Esc / blur / tap-away closes the dropdown.
 *
 * Privacy:
 *   The autocomplete endpoint is tenant-scoped server-side
 *   (auth.py + Phase 7a). The client passes scope = { community_id
 *   or conversation_id } so members of that scope rank first.
 *
 * Mention ref shape (passed to onMentionsChange):
 *   { id, username, display_name, agent_kind, agent_owner_id }
 */
import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import {mentionsApi} from '../../services/socialApi';

// Mirrors the server-side regex in
// integrations/social/mention_service.py (Phase 7b).
const USERNAME_PATTERN = /(?<!\w)@([a-zA-Z0-9_.-]{0,40})$/;

const DEBOUNCE_MS = 200;
const MAX_SUGGESTIONS = 10;

const MentionInput = forwardRef(function MentionInput(
  {
    value = '',
    onChangeText,
    onMentionsChange,
    scope = {},
    placeholder,
    placeholderTextColor,
    style,
    multiline = false,
    onFocus,
    onBlur,
    ...textInputProps
  },
  ref,
) {
  const inputRef = useRef(null);
  // Forward the ref so parents can call .focus(), .blur() etc.
  React.useImperativeHandle(ref, () => inputRef.current);

  const [selection, setSelection] = useState({start: 0, end: 0});
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  // Tracks accepted mentions so callers can persist them with the
  // post / message body. Keyed by user id; deduped automatically.
  const mentionsRef = useRef(new Map());
  const debounceRef = useRef(null);
  const requestIdRef = useRef(0);

  // Compute the active @-token (if any) at the caret position.
  const activeQuery = useMemo(() => {
    if (!value || selection.start <= 0) return null;
    const before = value.slice(0, selection.start);
    const match = USERNAME_PATTERN.exec(before);
    if (!match) return null;
    return {
      prefix: match[1] || '',
      tokenStart: before.length - match[0].length, // index of '@'
      tokenEnd: before.length,                     // exclusive
    };
  }, [value, selection.start]);

  // Fetch suggestions when active query changes (debounced).
  useEffect(() => {
    if (!activeQuery) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    setLoading(true);
    const myId = ++requestIdRef.current;
    debounceRef.current = setTimeout(async () => {
      try {
        const params = {};
        if (scope?.community_id) params.community_id = scope.community_id;
        if (scope?.conversation_id) params.conversation_id = scope.conversation_id;
        if (scope?.kind) params.kind = scope.kind;
        const resp = await mentionsApi.autocomplete(activeQuery.prefix, params);
        if (myId !== requestIdRef.current) return; // stale
        const data = Array.isArray(resp?.data) ? resp.data : [];
        setSuggestions(data.slice(0, MAX_SUGGESTIONS));
      } catch (_err) {
        // Network / auth errors: silently degrade — typing the
        // mention manually still works; server will resolve on
        // submit.
        if (myId === requestIdRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (myId === requestIdRef.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [activeQuery, scope?.community_id, scope?.conversation_id, scope?.kind]);

  const insertMention = useCallback(
    (suggestion) => {
      if (!activeQuery) return;
      const before = value.slice(0, activeQuery.tokenStart);
      const after = value.slice(activeQuery.tokenEnd);
      const insert = `@${suggestion.username} `;
      const newValue = before + insert + after;
      onChangeText && onChangeText(newValue);

      // Track the mention ref for the caller.
      mentionsRef.current.set(suggestion.id, {
        id: suggestion.id,
        username: suggestion.username,
        display_name: suggestion.display_name,
        agent_kind: suggestion.agent_kind,
        agent_owner_id: suggestion.agent_owner_id,
      });
      if (onMentionsChange) {
        onMentionsChange(Array.from(mentionsRef.current.values()));
      }

      // Move caret to just after the inserted mention.
      const newCaret = activeQuery.tokenStart + insert.length;
      // Defer setSelection until next tick so the underlying
      // TextInput has a chance to commit the value first.
      setTimeout(() => {
        setSelection({start: newCaret, end: newCaret});
      }, 0);
      setSuggestions([]);
    },
    [activeQuery, onChangeText, onMentionsChange, value],
  );

  const showDropdown = !!activeQuery && (loading || suggestions.length > 0);

  return (
    <View style={styles.wrapper}>
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={onChangeText}
        onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
        placeholder={placeholder}
        placeholderTextColor={placeholderTextColor}
        style={style}
        multiline={multiline}
        onFocus={onFocus}
        onBlur={(e) => {
          // Defer hiding the dropdown so a tap on a suggestion has
          // time to fire onPress before blur dismisses it.
          setTimeout(() => setSuggestions([]), 150);
          onBlur && onBlur(e);
        }}
        {...textInputProps}
      />
      {showDropdown && (
        <View style={styles.dropdown}>
          {loading && suggestions.length === 0 ? (
            <View style={styles.row}>
              <ActivityIndicator size="small" color="#888" />
              <Text style={styles.loadingText}>Looking…</Text>
            </View>
          ) : (
            <FlatList
              keyboardShouldPersistTaps="handled"
              data={suggestions}
              keyExtractor={(item) => String(item.id)}
              renderItem={({item}) => (
                <TouchableOpacity
                  onPress={() => insertMention(item)}
                  style={styles.row}
                  activeOpacity={0.6}
                >
                  {item.avatar_url ? (
                    <Image
                      source={{uri: item.avatar_url}}
                      style={styles.avatar}
                    />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback]}>
                      <Text style={styles.avatarFallbackText}>
                        {(item.display_name || item.username || '?')
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View style={styles.rowText}>
                    <Text style={styles.displayName} numberOfLines={1}>
                      {item.display_name || item.username}
                      {item.agent_kind === 'agent' ? (
                        <Text style={styles.agentBadge}> ⚡ agent</Text>
                      ) : null}
                    </Text>
                    <Text style={styles.username} numberOfLines={1}>
                      @{item.username}
                      {item.is_member ? (
                        <Text style={styles.contextHint}> · in this space</Text>
                      ) : item.is_friend ? (
                        <Text style={styles.contextHint}> · friend</Text>
                      ) : null}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
              style={styles.dropdownList}
            />
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
    flex: 1,
  },
  // Floats above the input. The composer's parent is responsible
  // for clipping if needed; we use a generous max height so the
  // dropdown doesn't push other content.
  dropdown: {
    position: 'absolute',
    bottom: '100%',
    left: 0,
    right: 0,
    marginBottom: 4,
    backgroundColor: '#1a1a1f',
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#2c2c34',
    maxHeight: 240,
    overflow: 'hidden',
    // Light shadow so it reads as floating
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 4},
        shadowOpacity: 0.25,
        shadowRadius: 6,
      },
      android: {elevation: 6},
    }),
    zIndex: 1000,
  },
  dropdownList: {flexGrow: 0},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2c2c34',
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  rowText: {marginLeft: 10, flex: 1},
  displayName: {color: '#fff', fontSize: 14, fontWeight: '600'},
  username: {color: '#888', fontSize: 12, marginTop: 2},
  agentBadge: {color: '#a78bfa', fontWeight: '500'},
  contextHint: {color: '#5d8a6b'},
  loadingText: {color: '#888', marginLeft: 8, fontSize: 13},
});

export default MentionInput;
