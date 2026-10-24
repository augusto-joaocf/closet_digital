import { demoStore } from './demoStore.js';
import { assertValid, validatePiece } from './validation.js';
import { releaseUnusedPreview } from './imagePreview.js';

export const normalize = (text) => String(text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
export function filterPieces(pieces, { search = '', filters = {}, favorites = false } = {}) {
  return pieces.filter((piece) => (!favorites || piece.favorite)
    && normalize(piece.name).includes(normalize(search.trim()))
    && piece.status === (filters.status || 'Disponível')
    && Object.entries(filters).every(([key, value]) => !value || piece[key] === value));
}
export function createPiecesService(store) {
  return {
    async create(values) {
      assertValid(validatePiece(values));
      const piece = { ...values, name: values.name.trim(), id: crypto.randomUUID() };
      store.update((state) => ({ ...state, pieces: [...state.pieces, piece] }));
      return piece;
    },
    async update(id, values) {
      assertValid(validatePiece(values));
      const original = store.getSnapshot().pieces.find((p) => p.id === id);
      if (!original) throw new Error('Peça não encontrada.');
      store.update((state) => ({ ...state, pieces: state.pieces.map((p) => p.id === id ? { ...p, ...values, id, name: values.name.trim() } : p) }));
      releaseUnusedPreview(original.image);
    },
    async remove(id) {
      const original = store.getSnapshot().pieces.find((p) => p.id === id);
      store.update((state) => ({ ...state,
        pieces: state.pieces.filter((p) => p.id !== id),
        outfits: state.outfits.map((o) => ({ ...o, pieceIds: o.pieceIds.filter((pieceId) => pieceId !== id) })),
      }));
      releaseUnusedPreview(original?.image);
    },
    async toggleFavorite(id) {
      store.update((state) => ({ ...state, pieces: state.pieces.map((p) => p.id === id ? { ...p, favorite: !p.favorite } : p) }));
    },
  };
}
export const piecesService = createPiecesService(demoStore);
