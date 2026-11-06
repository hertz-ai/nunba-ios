import { getAuthHeaders } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';
import { safeJson } from './httpJson';
import { emitApiError, reportFailure } from './apiFailure';
import { TRANSPORT_ERROR_STATUS } from './apiErrorMessages';

// Every call here runs in the background (the start-up device link, the
// 30 s fleet poll, command acks): no screen shows its result, so a failure
// raises no banner.  It still goes through socialApi's reporter, so a 5xx or
// a transport failure fails over to the next peer exactly as a social call
// does.
const BACKGROUND = { quiet: true };

/**
 * The response body as HARTOS's {success, data|error} envelope.
 *
 * A non-OK answer is reported (peer failover on 5xx).  A body that is not
 * JSON (an HTML error page) becomes {success: false}, never a throw.
 */
const readEnvelope = async (path, method, response) => {
  const json = await safeJson(response);
  reportFailure(path, response, json, method, BACKGROUND);
  if (json === null) {
    console.warn(`${method} ${path}: non-JSON answer (HTTP ${response.status})`);
    return { success: false };
  }
  return json;
};

const getBaseUrl = async () => {
  const base = await getApiBaseUrl();
  return `${base}/api/social/sync`;
};

/**
 * Send one request; the Response, or null when there is none.
 *
 * Only a request that was sent and never reached a server is a transport
 * failure that fails over to the next peer.  Failing to build the request
 * (no auth headers, no base URL) says nothing about the peer, so it is
 * logged and reported to nobody.
 */
const send = async (path, method, suffix, body) => {
  let headers;
  let baseUrl;
  try {
    headers = await getAuthHeaders();
    baseUrl = await getBaseUrl();
  } catch (err) {
    console.warn(`${method} ${path}: could not prepare the request:`, err);
    return null;
  }
  try {
    return await fetch(`${baseUrl}${suffix}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (err) {
    console.warn(`${method} ${path} failed:`, err);
    emitApiError(path, TRANSPORT_ERROR_STATUS, method, BACKGROUND);
    return null;
  }
};

export const linkDevice = async (deviceId, deviceName, formFactor, capabilities) => {
  const path = '/sync/link-device';
  const response = await send(path, 'POST', '/link-device', {
    device_id: deviceId,
    device_name: deviceName,
    platform: 'android',
    form_factor: formFactor,
    capabilities,
  });
  return response ? readEnvelope(path, 'POST', response) : { success: false };
};

export const listDevices = async () => {
  const path = '/sync/devices';
  const response = await send(path, 'GET', '/devices');
  return response ? readEnvelope(path, 'GET', response) : { success: false };
};

export const ackFleetCommand = async (commandId, success, resultMessage = '') => {
  const path = '/sync/fleet-commands/ack';
  const response = await send(path, 'POST', '/fleet-commands/ack', {
    command_id: commandId,
    success,
    result_message: resultMessage,
  });
  return response ? readEnvelope(path, 'POST', response) : { success: false };
};

export const pollFleetCommands = async (deviceId) => {
  const path = '/sync/fleet-commands';
  const response = await send(
    path, 'GET', `/fleet-commands?device_id=${encodeURIComponent(deviceId)}`);
  if (!response) return { success: false };
  // No API base serves this route yet (2026-10-14: HARTOS and central both
  // answer an HTML 404).  That is "nothing to poll here", not a failure:
  // the caller stops polling this base instead of parsing the 404 page
  // every 30 s.  The Wear OS poller (FleetCommandPoller.kt) does the same.
  if (response.status === 404) {
    return { success: false, unsupported: true };
  }
  return readEnvelope(path, 'GET', response);
};
