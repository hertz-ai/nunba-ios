import { getUserAuthHeaders } from './apiHelpers';
import { getApiBaseUrl } from './endpointResolver';

/**
 * Store a secret in the Nunba vault (Fernet-encrypted, machine-locked).
 * @param {{ key_type: string, key_name: string, value: string, channel_type?: string }} data
 */
export const vaultStore = async (data) => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/vault/store`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  return res.json();
};

/** List stored key names (never returns values). */
export const vaultKeys = async () => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const res = await fetch(`${base}/api/vault/keys`, {
    method: 'GET',
    headers,
  });
  return res.json();
};

/** Check if a specific key exists in the vault. */
export const vaultHas = async (keyName, channelType) => {
  const headers = await getUserAuthHeaders();
  const base = await getApiBaseUrl();
  const params = `key_name=${encodeURIComponent(keyName)}${
    channelType ? `&channel_type=${encodeURIComponent(channelType)}` : ''
  }`;
  const res = await fetch(`${base}/api/vault/has?${params}`, {
    method: 'GET',
    headers,
  });
  return res.json();
};
