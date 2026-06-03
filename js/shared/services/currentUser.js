import { NativeModules } from 'react-native';
import { authApi } from './socialApi';

let cache = { id: null, username: null, email: null, name: null, phone: null };
let nativeStarted = false;
let serverStarted = false;
let serverPromise = null;
const subscribers = new Set();

const notify = () => {
  for (const cb of subscribers) {
    try { cb(cache); } catch (_) {}
  }
};

const startNative = () => {
  if (nativeStarted) return;
  nativeStarted = true;
  const { OnboardingModule } = NativeModules;
  if (!OnboardingModule) return;
  try {
    if (typeof OnboardingModule.getUser_id === 'function') {
      OnboardingModule.getUser_id((id) => {
        if (id && Number(id) > 0) {
          cache.id = Number(id);
          notify();
        }
      });
    }
  } catch (_) {}
  try {
    if (typeof OnboardingModule.getStudentNameAndEmail === 'function') {
      OnboardingModule.getStudentNameAndEmail((n, e, p) => {
        let changed = false;
        if (n && !cache.name) { cache.name = String(n); changed = true; }
        if (e && !cache.email) { cache.email = String(e); changed = true; }
        if (p && !cache.phone) { cache.phone = String(p); changed = true; }
        if (changed) notify();
      });
    }
  } catch (_) {}
};

const startServer = () => {
  if (serverStarted) return serverPromise;
  serverStarted = true;
  serverPromise = (async () => {
    try {
      const me = await authApi.me();
      const u = me?.user || me;
      if (u) {
        let changed = false;
        if (u.id && !cache.id) { cache.id = Number(u.id); changed = true; }
        if (u.username && !cache.username) { cache.username = String(u.username); changed = true; }
        if (u.email && !cache.email) { cache.email = String(u.email); changed = true; }
        if (u.full_name && !cache.name) { cache.name = String(u.full_name); changed = true; }
        if (changed) notify();
      }
    } catch (_) {}
  })();
  return serverPromise;
};

export const ensureCurrentUser = () => {
  startNative();
  startServer();
  return cache;
};

export const getCurrentUser = () => cache;

export const subscribeCurrentUser = (cb) => {
  subscribers.add(cb);
  if (cache.id || cache.email || cache.username) {
    try { cb(cache); } catch (_) {}
  }
  return () => subscribers.delete(cb);
};
