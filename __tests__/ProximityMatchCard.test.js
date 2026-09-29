/**
 * ProximityMatchCard — viewer-relative reveal state.
 *
 * Regression coverage for the bug where both sides of a proximity match
 * got stuck showing "You revealed yourself / Waiting for them" forever:
 * `status` ('revealed_a'/'revealed_b') names which literal DB row-side
 * revealed, not which viewer did. The card used to check that raw string
 * directly, so whichever side wasn't the one named in `status` also saw
 * the waiting UI instead of their own Reveal button, and a match could
 * never complete. The fix keys off the server's viewer-relative
 * `you_revealed`/`other_revealed` fields instead.
 */
import React from 'react';
import {create, act} from 'react-test-renderer';
import ProximityMatchCard from '../js/shared/components/CommunityView/components/Encounters/ProximityMatchCard';

jest.mock('react-native', () => {
  const React = require('react');
  const stub = (name) => React.forwardRef(({children, ...p}, ref) =>
    React.createElement(name, {...p, ref}, children));
  return {
    View: stub('View'),
    Text: stub('Text'),
    TouchableOpacity: stub('TouchableOpacity'),
    ActivityIndicator: stub('ActivityIndicator'),
    StyleSheet: {create: (s) => s},
  };
});
jest.mock('react-native-responsive-screen', () => ({
  widthPercentageToDP: (n) => parseFloat(n) || 0,
  heightPercentageToDP: (n) => parseFloat(n) || 0,
}));
jest.mock('react-native-vector-icons/Ionicons', () => {
  const React = require('react');
  const Icon = (props) => React.createElement('Ionicons', props);
  return Icon;
});

const findText = (tree, text) =>
  tree.root.findAll((n) => n.children.includes(text));

test('viewer who has not revealed sees the Reveal button, even if the other side already has (status=revealed_a, viewer=b)', async () => {
  const match = {
    id: 'm1', status: 'revealed_a', you_revealed: false, other_revealed: true,
  };
  let tree;
  await act(async () => { tree = create(<ProximityMatchCard match={match} currentUserId="b" />); });
  expect(findText(tree, 'Reveal Yourself').length).toBeGreaterThan(0);
  expect(findText(tree, 'Waiting for them...').length).toBe(0);
});

test('viewer who already revealed sees the waiting state, not their own Reveal button again', async () => {
  const match = {
    id: 'm1', status: 'revealed_a', you_revealed: true, other_revealed: false,
  };
  let tree;
  await act(async () => { tree = create(<ProximityMatchCard match={match} currentUserId="a" />); });
  expect(findText(tree, 'You revealed yourself').length).toBeGreaterThan(0);
  expect(findText(tree, 'Waiting for them...').length).toBeGreaterThan(0);
  expect(findText(tree, 'Reveal Yourself').length).toBe(0);
});

test('a fresh match with nobody revealed yet shows the Reveal button', async () => {
  const match = {
    id: 'm1', status: 'pending', you_revealed: false, other_revealed: false,
  };
  let tree;
  await act(async () => { tree = create(<ProximityMatchCard match={match} currentUserId="a" />); });
  expect(findText(tree, 'Reveal Yourself').length).toBeGreaterThan(0);
});

test('matched status shows the Matched UI regardless of the revealed fields', async () => {
  const match = {
    id: 'm1', status: 'matched', user_a: {id: 'a'}, user_b: {id: 'b'},
    display_name_a: 'Alex', display_name_b: 'Sam',
  };
  let tree;
  await act(async () => { tree = create(<ProximityMatchCard match={match} currentUserId="a" />); });
  expect(findText(tree, 'Matched!').length).toBeGreaterThan(0);
});

test('Start Chat resolves the OTHER user\'s id, not the {id} object itself (regression: user_a/user_b are objects, not strings)', async () => {
  const match = {
    id: 'm1', status: 'matched', user_a: {id: 'a'}, user_b: {id: 'b'},
    display_name_a: 'Alex', display_name_b: 'Sam',
  };
  const onChat = jest.fn();
  let tree;
  await act(async () => {
    tree = create(<ProximityMatchCard match={match} currentUserId="a" onChat={onChat} />);
  });
  const button = tree.root.findByType('TouchableOpacity');
  await act(async () => { button.props.onPress(); });
  expect(onChat).toHaveBeenCalledWith('b');
});
