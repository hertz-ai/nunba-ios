import { Vibration, Platform } from 'react-native';
import useDeviceCapabilityStore from '../deviceCapabilityStore';
import { isFeatureAvailable } from './featureGates';

function canVibrate() {
  const { deviceType, capabilities } = useDeviceCapabilityStore.getState();
  return isFeatureAvailable('vibration', deviceType, capabilities || {});
}

/** Light tap feedback — 10ms */
export function hapticLight() {
  if (!canVibrate()) return;
  Vibration.vibrate(10);
}

/** Medium selection feedback — 20ms */
export function hapticMedium() {
  if (!canVibrate()) return;
  Vibration.vibrate(20);
}

/** Success celebration — pattern */
export function hapticSuccess() {
  if (!canVibrate()) return;
  if (Platform.OS === 'android') {
    Vibration.vibrate([0, 30, 50, 30]);
  } else {
    Vibration.vibrate(30);
  }
}

/** Warning/error — short buzz */
export function hapticWarning() {
  if (!canVibrate()) return;
  Vibration.vibrate(50);
}

export default { hapticLight, hapticMedium, hapticSuccess, hapticWarning };
