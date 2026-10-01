/**
 * IcebreakerDraftSheet tests — RN parity for the web SPA's
 * landing-page/src/__tests__/components/Social/Encounters/shared/IcebreakerDraftSheet.test.jsx
 * (commit a3398905).  PRODUCT_MAP J207-J210.
 *
 * Smoke + state-machine coverage:
 *   - mount with open=true → calls bleEncounterApi.draftIcebreaker
 *   - draft response → shows 3 draft options + edit input
 *   - Send → calls approveIcebreaker(match.id, edited_text)
 *   - Decline opens reason picker; reason → calls declineIcebreaker
 *   - Mission anchor: AI never auto-sends; modal stays closed when
 *     open=false even with match prop
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
  const Pressable = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('Pressable', { ...p, ref }, children),
  );
  const TextInput = React.forwardRef((p, ref) =>
    React.createElement('TextInput', { ...p, ref }),
  );
  const Modal = React.forwardRef(({ children, visible, ...p }, ref) =>
    visible ? React.createElement('Modal', { ...p, ref }, children) : null,
  );
  const ScrollView = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('ScrollView', { ...p, ref }, children),
  );
  const ActivityIndicator = (p) =>
    React.createElement('ActivityIndicator', p);
  return {
    StyleSheet: { create: (s) => s, flatten: (s) => s },
    View,
    Text,
    TouchableOpacity,
    Pressable,
    TextInput,
    Modal,
    ScrollView,
    ActivityIndicator,
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

jest.mock('../js/shared/services/socialApi', () => ({
  bleEncounterApi: {
    draftIcebreaker: jest.fn(),
    approveIcebreaker: jest.fn(),
    declineIcebreaker: jest.fn(),
  },
}));

const React = require('react');
const { create, act } = require('react-test-renderer');
const { bleEncounterApi } = require('../js/shared/services/socialApi');
const IcebreakerDraftSheet =
  require('../js/shared/components/CommunityView/components/Encounters/IcebreakerDraftSheet').default;

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

const findByTestID = (json, testID) =>
  findNode(json, (n) => n && n.props && n.props.testID === testID);

const sampleMatch = { id: 'match-1', user_a: 'user-a', user_b: 'user-b' };

beforeEach(() => {
  jest.clearAllMocks();
  bleEncounterApi.draftIcebreaker.mockResolvedValue({
    success: true,
    data: {
      draft: 'Hi, I noticed we both like jazz.',
      alt_drafts: [
        'Saw you at the bookstore — Borges fan?',
        'Coffee + indie books on a Saturday: my kind of weekend.',
      ],
      rationale: 'anchored on shared interest "indie books"',
      length: 32,
      shared_tag: 'indie books',
      source: 'template',
    },
  });
  bleEncounterApi.approveIcebreaker.mockResolvedValue({ success: true });
  bleEncounterApi.declineIcebreaker.mockResolvedValue({ success: true });
});

describe('IcebreakerDraftSheet', () => {
  test('open=false → modal not rendered, no draft fetch', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: false,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent: jest.fn(),
        }),
      );
    });
    expect(tree.toJSON()).toBeNull();
    expect(bleEncounterApi.draftIcebreaker).not.toHaveBeenCalled();
  });

  test('open=true → fetches draft once for the match', async () => {
    await act(async () => {
      create(
        React.createElement(IcebreakerDraftSheet, {
          open: true,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent: jest.fn(),
        }),
      );
    });
    expect(bleEncounterApi.draftIcebreaker).toHaveBeenCalledTimes(1);
    // A match with no kind is BLE: the server's default, so no kind is sent.
    expect(bleEncounterApi.draftIcebreaker).toHaveBeenCalledWith('match-1', undefined);
  });

  test('draft response renders 3 draft options + edit input', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: true,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent: jest.fn(),
        }),
      );
    });
    // Allow the mocked promise to resolve.
    await act(async () => {
      await Promise.resolve();
    });
    const json = tree.toJSON();
    expect(findByTestID(json, 'icebreaker-draft-option-0')).not.toBeNull();
    expect(findByTestID(json, 'icebreaker-draft-option-1')).not.toBeNull();
    expect(findByTestID(json, 'icebreaker-draft-option-2')).not.toBeNull();
    expect(findByTestID(json, 'icebreaker-edit-input')).not.toBeNull();
    expect(findByTestID(json, 'icebreaker-send')).not.toBeNull();
  });

  test('Send calls approveIcebreaker(match.id, edited_text)', async () => {
    const onSent = jest.fn();
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: true,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent,
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    // Edit text — drive onChangeText directly.
    const input = findByTestID(tree.toJSON(), 'icebreaker-edit-input');
    await act(async () => {
      input.props.onChangeText('My edited icebreaker');
    });
    const sendBtn = findByTestID(tree.toJSON(), 'icebreaker-send');
    await act(async () => {
      await sendBtn.props.onPress();
    });
    expect(bleEncounterApi.approveIcebreaker).toHaveBeenCalledTimes(1);
    expect(bleEncounterApi.approveIcebreaker).toHaveBeenCalledWith(
      'match-1',
      'My edited icebreaker',
      undefined,
    );
  });

  test('Decline → reason picker → declineIcebreaker(match.id, reason)', async () => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: true,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent: jest.fn(),
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const declineBtn = findByTestID(tree.toJSON(), 'icebreaker-decline');
    await act(async () => {
      declineBtn.props.onPress();
    });
    const reasonBtn = findByTestID(
      tree.toJSON(),
      'icebreaker-decline-Not feeling it',
    );
    expect(reasonBtn).not.toBeNull();
    await act(async () => {
      await reasonBtn.props.onPress();
    });
    expect(bleEncounterApi.declineIcebreaker).toHaveBeenCalledWith(
      'match-1',
      'Not feeling it',
      undefined,
    );
  });

  test('403 cloud_capability error → friendly inline message', async () => {
    bleEncounterApi.draftIcebreaker.mockRejectedValueOnce(
      new Error('403 cloud_capability'),
    );
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: true,
          match: sampleMatch,
          onClose: jest.fn(),
          onSent: jest.fn(),
        }),
      );
    });
    await act(async () => {
      await Promise.resolve();
    });
    const json = tree.toJSON();
    const errorState = findByTestID(json, 'icebreaker-state-error');
    expect(errorState).not.toBeNull();
    const cloudMsg = findNode(
      json,
      (n) =>
        n.type === 'Text' &&
        Array.isArray(n.children) &&
        n.children.some(
          (c) =>
            typeof c === 'string' &&
            c.toLowerCase().includes('consent-gated'),
        ),
    );
    expect(cloudMsg).not.toBeNull();
  });
});

describe('IcebreakerDraftSheet — Break the ice on a GPS match', () => {
  const gpsMatch = { id: 'pm-1', status: 'matched', kind: 'proximity', peerName: 'Sam' };
  const mount = async (props) => {
    let tree;
    await act(async () => {
      tree = create(
        React.createElement(IcebreakerDraftSheet, {
          open: true, match: gpsMatch, onClose: jest.fn(), onSent: jest.fn(), ...props,
        }),
      );
    });
    await act(async () => { await Promise.resolve(); });
    return tree;
  };

  test('asks the server for a draft of the GPS match', async () => {
    await mount();
    expect(bleEncounterApi.draftIcebreaker).toHaveBeenCalledWith('pm-1', 'proximity');
  });

  test('send: the approved text goes out as the GPS match, and onSent gets the DM it landed in', async () => {
    bleEncounterApi.approveIcebreaker.mockResolvedValue({
      success: true, data: { match_id: 'pm-1', status: 'sent', conversation_id: 'conv-9' },
    });
    const onSent = jest.fn();
    const tree = await mount({ onSent });
    const sendBtn = findByTestID(tree.toJSON(), 'icebreaker-send');
    await act(async () => { await sendBtn.props.onPress(); });
    expect(bleEncounterApi.approveIcebreaker).toHaveBeenCalledWith(
      'pm-1', 'Hi, I noticed we both like jazz.', 'proximity',
    );
    expect(onSent).toHaveBeenCalledWith(gpsMatch, 'conv-9');
  });

  test('already broke the ice: opens that chat instead of drafting a second opener', async () => {
    bleEncounterApi.draftIcebreaker.mockResolvedValue({
      success: true,
      data: { draft: 'Hi again', alt_drafts: [], conversation_id: 'conv-9' },
    });
    const onOpenChat = jest.fn();
    const tree = await mount({ onOpenChat });
    expect(onOpenChat).toHaveBeenCalledWith('conv-9');
    expect(findByTestID(tree.toJSON(), 'icebreaker-send')).toBeNull();
  });

  test('decline on a GPS match says which kind it is', async () => {
    const tree = await mount();
    await act(async () => { findByTestID(tree.toJSON(), 'icebreaker-decline').props.onPress(); });
    const reasonBtn = findByTestID(tree.toJSON(), 'icebreaker-decline-Not feeling it');
    await act(async () => { await reasonBtn.props.onPress(); });
    expect(bleEncounterApi.declineIcebreaker).toHaveBeenCalledWith('pm-1', 'Not feeling it', 'proximity');
  });
});
