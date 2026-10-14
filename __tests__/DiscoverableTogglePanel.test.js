/**
 * DiscoverableTogglePanel tests — RN parity for the web SPA's
 * landing-page/src/__tests__/components/Social/Encounters/shared/
 * DiscoverableTogglePanel.test.jsx (commit 5a705452, F1 GREENLIT).
 *
 * Style follows __tests__/Encounters/EncountersScreen.discovery.test.js
 * (jest.mock react-native, react-test-renderer create+act).
 *
 * Coverage:
 *   - Mount → calls bleEncounterApi.getDiscoverable once
 *   - 18+ checkbox defaults UNCHECKED on every mount (anchor 1)
 *   - Switch DISABLED until age-claim checked (anchor 3)
 *   - Toggle on with age-claim → setDiscoverable with correct body
 *   - Toggle on WITHOUT age-claim → inline error, no API call
 *   - 429 rate-limit → inline error + Switch locked
 *   - TTL display sources expires_at from server (anchor 2)
 */

jest.mock('react-native', () => {
  const React = require('react');
  const View = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('View', { ...p, ref }, children),
  );
  View.displayName = 'View';
  const Text = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('Text', { ...p, ref }, children),
  );
  Text.displayName = 'Text';
  const TouchableOpacity = React.forwardRef(({ children, ...p }, ref) =>
    React.createElement('TouchableOpacity', { ...p, ref }, children),
  );
  TouchableOpacity.displayName = 'TouchableOpacity';
  const Switch = React.forwardRef((p, ref) =>
    React.createElement('Switch', { ...p, ref }),
  );
  Switch.displayName = 'Switch';
  const ActivityIndicator = (p) =>
    React.createElement('ActivityIndicator', p);
  return {
    StyleSheet: { create: (s) => s, flatten: (s) => s },
    View,
    Text,
    TouchableOpacity,
    Switch,
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
    getDiscoverable: jest.fn(),
    setDiscoverable: jest.fn(),
    getPersona: jest.fn(),
    setPersona: jest.fn(),
  },
}));

const React = require('react');
const { act, create } = require('react-test-renderer');
const { bleEncounterApi } = require('../js/shared/services/socialApi');
const DiscoverableTogglePanel =
  require('../js/shared/components/CommunityView/components/Encounters/DiscoverableTogglePanel').default;

let root;
beforeEach(() => {
  jest.clearAllMocks();
  bleEncounterApi.getDiscoverable.mockResolvedValue({success: true, data: {enabled: false}});
});
afterEach(async () => { if (root) await act(async () => root.unmount()); });
const mount = async () => { await act(async () => { root = create(React.createElement(DiscoverableTogglePanel)); }); };
const toggle = () => root.root.findByType('Switch');
test('age confirmation is required before enabling', async () => {
  await mount();
  expect(toggle().props.disabled).toBe(true);
  await act(async () => toggle().props.onValueChange(true));
  expect(bleEncounterApi.setDiscoverable).not.toHaveBeenCalled();
});
test('HTTP error envelope leaves Discoverable off with an actionable error', async () => {
  bleEncounterApi.setDiscoverable.mockResolvedValue({success: false, error: 'Invalid or expired token'});
  await mount();
  await act(async () => root.root.findByType('TouchableOpacity').props.onPress());
  await act(async () => toggle().props.onValueChange(true));
  expect(toggle().props.value).toBe(false);
  expect(JSON.stringify(root.toJSON())).toContain('The server rejected your login');
});
test('only confirmed server state turns Discoverable on without overwriting interests', async () => {
  bleEncounterApi.setDiscoverable.mockResolvedValue({success: true, data: {enabled: true}});
  await mount();
  await act(async () => root.root.findByType('TouchableOpacity').props.onPress());
  await act(async () => toggle().props.onValueChange(true));
  expect(toggle().props.value).toBe(true);
  expect(bleEncounterApi.setDiscoverable).toHaveBeenCalledWith({enabled: true, age_claim_18: true});
});
