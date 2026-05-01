import { getAuthHeaders } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';

const getBaseUrl = async () => {
  const base = await getApiBaseUrl();
  return `${base}/api/social/sync`;
};

export const linkDevice = async (deviceId, deviceName, formFactor, capabilities) => {
  try {
    const headers = await getAuthHeaders();
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/link-device`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        device_id: deviceId,
        device_name: deviceName,
        platform: 'android',
        form_factor: formFactor,
        capabilities,
      }),
    });
    return await response.json();
  } catch (err) {
    console.warn('linkDevice failed:', err);
    return { success: false };
  }
};

export const listDevices = async () => {
  try {
    const headers = await getAuthHeaders();
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/devices`, {
      method: 'GET',
      headers,
    });
    return await response.json();
  } catch (err) {
    console.warn('listDevices failed:', err);
    return { success: false };
  }
};

export const ackFleetCommand = async (commandId, success, resultMessage = '') => {
  try {
    const headers = await getAuthHeaders();
    const baseUrl = await getBaseUrl();
    const response = await fetch(`${baseUrl}/fleet-commands/ack`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        command_id: commandId,
        success,
        result_message: resultMessage,
      }),
    });
    return await response.json();
  } catch (err) {
    console.warn('ackFleetCommand failed:', err);
    return { success: false };
  }
};

export const pollFleetCommands = async (deviceId) => {
  try {
    const headers = await getAuthHeaders();
    const baseUrl = await getBaseUrl();
    const response = await fetch(
      `${baseUrl}/fleet-commands?device_id=${encodeURIComponent(deviceId)}`,
      { method: 'GET', headers },
    );
    return await response.json();
  } catch (err) {
    console.warn('pollFleetCommands failed:', err);
    return { success: false };
  }
};
