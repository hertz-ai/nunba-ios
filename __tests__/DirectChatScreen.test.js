/**
 * DirectChatScreen — a 1:1 conversation from /api/social/conversations.
 *
 * Drives the real screen with string-stubbed RN primitives and a mocked
 * socialApi (the {success, data, error} envelope HARTOS answers with, as
 * measured against a local HARTOS on 2026-09-30).
 */

jest.mock('react-native', () => ({
  View: 'View', Text: 'Text', Image: 'Image',
  TouchableOpacity: 'TouchableOpacity', TextInput: 'TextInput',
  StatusBar: 'StatusBar', KeyboardAvoidingView: 'KeyboardAvoidingView',
  FlatList: 'FlatList', ActivityIndicator: 'ActivityIndicator',
  Platform: { OS: 'android' },
  StyleSheet: { create: (s) => s },
}));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: 'SafeAreaView' }));
jest.mock('react-native-vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-responsive-screen', () => ({
  widthPercentageToDP: () => 10, heightPercentageToDP: () => 10,
}));
jest.mock('../js/shared/components/shared/EmptyState', () => ({ __esModule: true, default: 'EmptyState' }));
jest.mock('../js/shared/components/shared/listPerf', () => ({ flatListVirtualizationProps: () => ({}) }));

const mockGoBack = jest.fn();
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
  useRoute: () => ({ params: mockParams }),
}));

const mockApi = { me: jest.fn(), messages: jest.fn(), send: jest.fn() };
jest.mock('../js/shared/services/socialApi', () => ({
  authApi: { me: (...a) => mockApi.me(...a) },
  conversationsApi: {
    messages: (...a) => mockApi.messages(...a),
    send: (...a) => mockApi.send(...a),
  },
}));

// React Native provides this globally; the jest environment does not.
global.requestAnimationFrame = (cb) => cb();

const React = require('react');
const { create, act } = require('react-test-renderer');
const DirectChatScreen = require('../js/shared/components/CommunityView/screens/DirectChatScreen').default;
const { POLL_MS } = require('../js/shared/components/CommunityView/screens/DirectChatScreen');

const ME = 'me-1';
const THEM = 'them-2';
const msg = (id, author, content) => ({ id, author_id: author, content, created_at: '2026-09-30' });

const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

const render = async () => {
  let tree;
  await act(async () => { tree = create(React.createElement(DirectChatScreen)); });
  await flush();
  return tree;
};

const list = (tree) => tree.root.findByType('FlatList');
const input = (tree) => tree.root.findByType('TextInput');
const sendBtn = (tree) =>
  tree.root.find((n) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === 'Send message');
// FlatList is a string stub, so it never calls renderItem: render the rows
// ourselves to see the bubbles people would see.
const rows = (tree) => {
  const fl = list(tree);
  return (fl.props.data || []).map((item) => {
    let r;
    act(() => { r = create(fl.props.renderItem({ item })); });
    return r.root;
  });
};
const textsIn = (root) =>
  root.findAll((n) => n.type === 'Text').map((n) => [].concat(n.props.children).join(''));
const texts = (tree) => textsIn(tree.root);
const rowTexts = (tree) => rows(tree).flatMap(textsIn);

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  mockParams = { conversation_id: 'conv-1', name: 'Ktest' };
  mockApi.me.mockResolvedValue({ success: true, data: { id: ME } });
  mockApi.messages.mockResolvedValue({ success: true, data: [] });
  mockApi.send.mockReset();
  mockGoBack.mockReset();
});
afterEach(() => jest.useRealTimers());

test('shows the other person in the header', async () => {
  const tree = await render();
  expect(texts(tree)).toEqual(expect.arrayContaining(['Ktest', 'Direct message']));
});

test('server newest-first list is shown oldest-first, mine vs theirs by author', async () => {
  mockApi.messages.mockResolvedValue({
    success: true,
    data: [msg('m2', THEM, 'Hi!'), msg('m1', ME, 'Hello')],
  });
  const tree = await render();
  const data = list(tree).props.data;
  expect(data.map((m) => m.content)).toEqual(['Hello', 'Hi!']);
  expect(data.map((m) => m.mine)).toEqual([true, false]);
});

test('sending shows the message at once, then keeps the server copy', async () => {
  mockApi.send.mockResolvedValue({ success: true, data: msg('m9', ME, 'Hey there') });
  const tree = await render();
  await act(async () => { input(tree).props.onChangeText('  Hey there  '); });
  await act(async () => { sendBtn(tree).props.onPress(); });
  await flush();
  expect(mockApi.send).toHaveBeenCalledWith('conv-1', 'Hey there');
  const data = list(tree).props.data;
  expect(data).toHaveLength(1);
  expect(data[0]).toMatchObject({ id: 'm9', content: 'Hey there', mine: true });
  expect(input(tree).props.value).toBe('');
});

test('a failed send stays on screen as "Not sent", and tapping retries it', async () => {
  mockApi.send.mockRejectedValueOnce(new Error('Network request failed'));
  const tree = await render();
  await act(async () => { input(tree).props.onChangeText('Are you there?'); });
  await act(async () => { sendBtn(tree).props.onPress(); });
  await flush();
  expect(list(tree).props.data[0]).toMatchObject({ content: 'Are you there?', failed: true });
  expect(rowTexts(tree)).toContain('Not sent · Tap to retry');

  mockApi.send.mockResolvedValueOnce({ success: true, data: msg('m5', ME, 'Are you there?') });
  const bubble = rows(tree)[0].find(
    (n) => n.type === 'TouchableOpacity' && n.props.accessibilityLabel === 'Message not sent. Tap to retry.');
  await act(async () => { bubble.props.onPress(); });
  await flush();
  expect(mockApi.send).toHaveBeenCalledTimes(2);
  expect(list(tree).props.data).toEqual([expect.objectContaining({ id: 'm5', mine: true })]);
});

test('messaging switched off: a plain-language banner, and the composer is disabled', async () => {
  mockApi.messages.mockResolvedValue({ success: false, error: 'conversations feature flag is off' });
  const tree = await render();
  expect(texts(tree)).toContain("Messaging isn't switched on yet. Try again later.");
  expect(texts(tree).join(' ')).not.toMatch(/feature flag/);
  expect(input(tree).props.editable).toBe(false);
  expect(sendBtn(tree).props.disabled).toBe(true);
});

test('not a member of the conversation', async () => {
  mockApi.messages.mockResolvedValue({ success: false, error: 'not a conversation member' });
  const tree = await render();
  expect(texts(tree)).toContain("You're not part of this conversation.");
});

test('polls for new messages, and stops polling when the screen closes', async () => {
  const tree = await render();
  expect(mockApi.messages).toHaveBeenCalledTimes(1);
  mockApi.messages.mockResolvedValue({ success: true, data: [msg('m3', THEM, 'New one')] });
  await act(async () => { jest.advanceTimersByTime(POLL_MS); });
  await flush();
  expect(mockApi.messages).toHaveBeenCalledTimes(2);
  expect(list(tree).props.data.map((m) => m.content)).toEqual(['New one']);

  await act(async () => { tree.unmount(); });
  jest.advanceTimersByTime(POLL_MS * 3);
  expect(mockApi.messages).toHaveBeenCalledTimes(2);
});

test('a network blip during a poll keeps the messages on screen', async () => {
  mockApi.messages.mockResolvedValueOnce({ success: true, data: [msg('m1', THEM, 'Still here')] });
  const tree = await render();
  mockApi.messages.mockRejectedValueOnce(new Error('Network request failed'));
  await act(async () => { jest.advanceTimersByTime(POLL_MS); });
  await flush();
  expect(list(tree).props.data.map((m) => m.content)).toEqual(['Still here']);
  expect(input(tree).props.editable).toBe(true);
});

test('empty or whitespace text is not sent', async () => {
  const tree = await render();
  await act(async () => { input(tree).props.onChangeText('   '); });
  expect(sendBtn(tree).props.disabled).toBe(true);
  expect(mockApi.send).not.toHaveBeenCalled();
});

test('route is registered', () => {
  const routes = require('fs').readFileSync(
    require('path').resolve(__dirname, '../js/shared/components/CommunityView/router/home.routes.js'), 'utf8');
  expect(routes).toContain('name="DirectChat" component={DirectChatScreen}');
});
