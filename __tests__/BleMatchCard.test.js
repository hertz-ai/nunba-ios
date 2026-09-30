/**
 * BleMatchCard tests — RN parity for the web SPA's
 * landing-page/src/__tests__/components/Social/Encounters/shared/BleMatchCard.test.jsx
 * (commit 7dadd6bc).  PRODUCT_MAP J204/J209/J210/J211.
 *
 * Style mirrors __tests__/Encounters/EncountersScreen.discovery.test.js
 * (jest.mock react-native, react-test-renderer create+act).
 */

jest.mock('react-native', () => {
  const React = require('react');
  const View = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('View', { ...p, ref }, children),
  );
  const Text = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('Text', { ...p, ref }, children),
  );
  const TouchableOpacity = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('TouchableOpacity', { ...p, ref }, children),
  );
  return {
    StyleSheet: { create: (s) => s, flatten: (s) => s },
    View,
    Text,
    TouchableOpacity,
  };
});

jest.mock('react-native-responsive-screen', () => ({
  widthPercentageToDP: (v) => parseFloat(v) || 0,
  heightPercentageToDP: (v) => parseFloat(v) || 0,
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => {
  const React = require('react');
  const Icon = (props) => React.createElement('MaterialIcons', props);
  Icon.getImageSource = () => Promise.resolve({});
  Icon.loadFont = () => Promise.resolve();
  return Icon;
});

const React = require('react');
const { create, act } = require('react-test-renderer');
const BleMatchCard =
  require('../js/shared/components/CommunityView/components/Encounters/BleMatchCard').default;

const findNode = (json, predicate) => {
  if (!json) return null;
  if (predicate(json)) return json;
  if (Array.isArray(json.children)) {
    for (const c of json.children) {
      if (typeof c === 'object' && c !== null) {
        const f = findNode(c, predicate);
        if (f) return f;
      }
    }
  }
  return null;
};

const sampleMatch = {
  id: 'match-1',
  user_a: 'user-a',
  user_b: 'user-b',
  matched_at: Math.floor(Date.now() / 1000) - 120, // 2 min ago
  icebreaker_a_status: 'pending',
  icebreaker_b_status: 'pending',
  lat: 12.97,
  lng: 77.59,
  map_pin_visible: true,
};

describe('BleMatchCard', () => {
  test('renders Mutual encounter / Both said yes copy', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: sampleMatch,
          currentUserId: 'user-a',
          onIcebreaker: jest.fn(),
          onHide: jest.fn(),
        }),
      );
    });
    const json = tree.toJSON();
    const title = findNode(
      json,
      (n) =>
        n.type === 'Text' &&
        Array.isArray(n.children) &&
        n.children.includes('Mutual encounter'),
    );
    expect(title).not.toBeNull();
    const subtle = findNode(
      json,
      (n) =>
        n.type === 'Text' &&
        Array.isArray(n.children) &&
        n.children.some(
          (c) => typeof c === 'string' && c.startsWith('Both said yes'),
        ),
    );
    expect(subtle).not.toBeNull();
  });

  test('viewer sees the OTHER party initial (never own)', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: sampleMatch,
          currentUserId: 'user-a',
          onIcebreaker: jest.fn(),
          onHide: jest.fn(),
        }),
      );
    });
    const initial = findNode(
      tree.toJSON(),
      (n) =>
        n.type === 'Text' &&
        Array.isArray(n.children) &&
        n.children.includes('U'),
    );
    expect(initial).not.toBeNull();
  });

  test('Send icebreaker button calls onIcebreaker(match)', async () => {
    const onIcebreaker = jest.fn();
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: sampleMatch,
          currentUserId: 'user-a',
          onIcebreaker,
          onHide: jest.fn(),
        }),
      );
    });
    const sendBtn = findNode(
      tree.toJSON(),
      (n) =>
        n.type === 'TouchableOpacity' &&
        n.props &&
        n.props.accessibilityLabel === 'Send icebreaker',
    );
    expect(sendBtn).not.toBeNull();
    await act(async () => {
      sendBtn.props.onPress();
    });
    expect(onIcebreaker).toHaveBeenCalledTimes(1);
    expect(onIcebreaker).toHaveBeenCalledWith(sampleMatch);
  });

  test('Send disabled when viewer has already sent', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: { ...sampleMatch, icebreaker_a_status: 'sent' },
          currentUserId: 'user-a',
          onIcebreaker: jest.fn(),
          onHide: jest.fn(),
        }),
      );
    });
    const sendBtn = findNode(
      tree.toJSON(),
      (n) =>
        n.type === 'TouchableOpacity' &&
        n.props &&
        n.props.accessibilityLabel === 'Send icebreaker',
    );
    expect(sendBtn.props.disabled).toBe(true);
    expect(sendBtn.props.accessibilityState).toEqual({ disabled: true });
  });

  const sendButton = (tree) =>
    findNode(
      tree.toJSON(),
      (n) =>
        n.type === 'TouchableOpacity' &&
        n.props &&
        n.props.accessibilityLabel === 'Send icebreaker',
    );

  test('viewer on side b reads their own status from icebreaker_b_status', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: { ...sampleMatch, icebreaker_b_status: 'sent' },
          currentUserId: 'user-b',
          onIcebreaker: jest.fn(),
          onHide: jest.fn(),
        }),
      );
    });
    expect(sendButton(tree).props.disabled).toBe(true);
  });

  test("unknown viewer: no guessed side, so the other side's status never disables Send", async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: { ...sampleMatch, icebreaker_b_status: 'sent' },
          currentUserId: null,
          onIcebreaker: jest.fn(),
          onHide: jest.fn(),
        }),
      );
    });
    expect(sendButton(tree).props.disabled).toBe(false);
    const initial = findNode(
      tree.toJSON(),
      (n) => n.type === 'Text' && Array.isArray(n.children) && n.children.includes('?'),
    );
    expect(initial).not.toBeNull();
  });

  test('Hide button calls onHide(match)', async () => {
    const onHide = jest.fn();
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(BleMatchCard, {
          match: sampleMatch,
          currentUserId: 'user-a',
          onIcebreaker: jest.fn(),
          onHide,
        }),
      );
    });
    const hideBtn = findNode(
      tree.toJSON(),
      (n) =>
        n.type === 'TouchableOpacity' &&
        n.props &&
        n.props.accessibilityLabel === 'Hide from map',
    );
    expect(hideBtn).not.toBeNull();
    await act(async () => {
      hideBtn.props.onPress();
    });
    expect(onHide).toHaveBeenCalledWith(sampleMatch);
  });
});
