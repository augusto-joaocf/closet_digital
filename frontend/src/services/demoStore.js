import { mockPieces } from '../data/mockPieces.js';
import { mockOutfits } from '../data/mockOutfits.js';
import { mockUser } from '../data/mockUser.js';
import { pieceOptions } from '../data/options.js';

export const STORAGE_KEY = 'closet-digital:demo:v1';
const SESSION_KEY = 'closet-digital:demo-session';

// Only whitelisted, non-sensitive metadata crosses the persistence boundary.
export function serializeMetadata(state) {
  return {
    user: { name: state.user.name, email: state.user.email },
    pieces: state.pieces.map(({ id, name, imageKey, favorite, ...piece }) => ({
      id, name, imageKey: ['jordan', 'cinza'].includes(imageKey) ? imageKey : '', favorite: Boolean(favorite),
      ...Object.fromEntries(Object.keys(pieceOptions).map((key) => [key, piece[key]])),
    })),
    outfits: state.outfits.map(({ id, name, pieceIds }) => ({ id, name, pieceIds: [...pieceIds] })),
  };
}

function validMetadata(data) {
  return data && typeof data.user?.name === 'string' && typeof data.user?.email === 'string'
    && Array.isArray(data.pieces) && Array.isArray(data.outfits)
    && data.pieces.every((p) => typeof p.id === 'string' && typeof p.name === 'string'
      && Object.entries(pieceOptions).every(([key, option]) => option.values.includes(p[key])))
    && data.outfits.every((o) => typeof o.id === 'string' && typeof o.name === 'string'
      && Array.isArray(o.pieceIds) && o.pieceIds.every((id) => typeof id === 'string'));
}

export function createDemoStore(storage, sessionStorage) {
  const initial = { user: { ...mockUser }, pieces: mockPieces.map((p) => ({ ...p })), outfits: mockOutfits.map((o) => ({ ...o, pieceIds: [...o.pieceIds] })) };
  let metadata = initial;
  let session = false;
  let storageWarning = '';
  try {
    const saved = JSON.parse(storage?.getItem(STORAGE_KEY) || 'null');
    if (validMetadata(saved)) metadata = serializeMetadata(saved);
    session = sessionStorage?.getItem(SESSION_KEY) === 'active';
  } catch { /* Invalid or disabled storage falls back to the in-memory demo. */ }
  let state = { ...metadata, user: { ...metadata.user, avatar: '' }, session, storageWarning };
  const listeners = new Set();
  return {
    getSnapshot: () => state,
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    update(updater) {
      const next = updater(state);
      try {
        storage?.setItem(STORAGE_KEY, JSON.stringify(serializeMetadata(next)));
        if (next.session) sessionStorage?.setItem(SESSION_KEY, 'active');
        else sessionStorage?.removeItem(SESSION_KEY);
        storageWarning = '';
      } catch { storageWarning = 'Os dados ficarão apenas nesta sessão: armazenamento local indisponível.'; }
      state = { ...next, storageWarning };
      listeners.forEach((listener) => listener());
      return state;
    },
  };
}

function browserStorage(name) {
  try { return typeof window === 'undefined' ? undefined : window[name]; } catch { return undefined; }
}
export const demoStore = createDemoStore(browserStorage('localStorage'), browserStorage('sessionStorage'));
