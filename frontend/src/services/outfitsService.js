import { demoStore } from './demoStore.js';
import { assertValid } from './validation.js';

export function outfitAvailable(outfit, pieces) {
  return outfit.pieceIds.length > 0 && outfit.pieceIds.every((id) => pieces.some((p) => p.id === id && p.status === 'Disponível'));
}
export function validateOutfit(values, pieces) {
  const errors = {};
  if (!values.name?.trim()) errors.name = 'Informe o nome do conjunto.';
  if (!values.pieceIds?.length) errors.pieceIds = 'Adicione pelo menos uma peça.';
  else if (values.pieceIds.some((id) => !pieces.some((p) => p.id === id))) errors.pieceIds = 'Uma das peças foi excluída. Selecione novamente.';
  return errors;
}
export function createOutfitsService(store) {
  return {
    async save(values, id) {
      assertValid(validateOutfit(values, store.getSnapshot().pieces));
      if (id && !store.getSnapshot().outfits.some((o) => o.id === id)) throw new Error('Conjunto não encontrado.');
      const outfit = { id: id || crypto.randomUUID(), name: values.name.trim(), pieceIds: [...new Set(values.pieceIds)] };
      store.update((state) => ({ ...state, outfits: id ? state.outfits.map((o) => o.id === id ? outfit : o) : [...state.outfits, outfit] }));
      return outfit;
    },
    async remove(id) { store.update((state) => ({ ...state, outfits: state.outfits.filter((o) => o.id !== id) })); },
  };
}
export const outfitsService = createOutfitsService(demoStore);
