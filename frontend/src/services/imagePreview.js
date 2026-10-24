import { demoStore } from './demoStore.js';

export function releaseUnusedPreview(url) {
  if (!url?.startsWith('blob:')) return;
  const state = demoStore.getSnapshot();
  if (state.user.avatar !== url && !state.pieces.some((piece) => piece.image === url)) URL.revokeObjectURL(url);
}
