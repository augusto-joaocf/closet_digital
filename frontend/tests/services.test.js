import test from 'node:test';
import assert from 'node:assert/strict';
import { createDemoStore, STORAGE_KEY } from '../src/services/demoStore.js';
import { createPiecesService, filterPieces } from '../src/services/piecesService.js';
import { createOutfitsService, outfitAvailable } from '../src/services/outfitsService.js';
import { createAuthService, DEMO_CODE } from '../src/services/authService.js';
import { validateCredentials, validatePasswords } from '../src/services/validation.js';

function memoryStorage() {
  const data = new Map();
  return { getItem: (key) => data.get(key) || null, setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) };
}
function setup() {
  const storage = memoryStorage();
  const session = memoryStorage();
  const store = createDemoStore(storage, session);
  return { storage, session, store, pieces: createPiecesService(store), outfits: createOutfitsService(store), auth: createAuthService(store) };
}
const validPiece = { name: 'Camisa nova', type: 'Camiseta', occasion: 'Casual', climate: 'Calor', period: 'Dia', color: 'Azul', status: 'Disponível' };

test('pesquisa combina critérios, ignora acentos e esconde indisponíveis por padrão', () => {
  const { store } = setup();
  const data = store.getSnapshot().pieces;
  assert.equal(filterPieces(data, { search: 'BASICA', filters: { type: 'Camiseta', color: 'Cinza' } }).length, 1);
  assert.equal(filterPieces(data, { filters: { color: 'Cinza', occasion: 'Festa' } }).length, 0);
  assert.equal(filterPieces(data).some((p) => p.id === 'casaco-bege'), false);
  assert.deepEqual(filterPieces(data, { filters: { status: 'Indisponível' } }).map((p) => p.id), ['casaco-bege']);
});

test('criação, edição, favorito e exclusão atualizam o estado e os vínculos', async () => {
  const { store, pieces, outfits } = setup();
  await assert.rejects(pieces.create({ name: '' }));
  const piece = await pieces.create(validPiece);
  await pieces.toggleFavorite(piece.id);
  assert.equal(store.getSnapshot().pieces.find((p) => p.id === piece.id).favorite, true);
  assert.equal(filterPieces(store.getSnapshot().pieces, { favorites: true }).length, 2);
  const outfit = await outfits.save({ name: 'Meu conjunto', pieceIds: [piece.id, 'jordan'] });
  await pieces.update(piece.id, { ...validPiece, name: 'Nome atualizado', status: 'Indisponível' });
  assert.equal(outfitAvailable(outfit, store.getSnapshot().pieces), false);
  await pieces.update(piece.id, validPiece);
  assert.equal(outfitAvailable(outfit, store.getSnapshot().pieces), true);
  await pieces.remove(piece.id);
  assert.deepEqual(store.getSnapshot().outfits.find((o) => o.id === outfit.id).pieceIds, ['jordan']);
  assert.equal(store.getSnapshot().pieces.some((p) => p.id === piece.id), false);
});

test('conjunto exige nome e peças existentes, elimina duplicação e permite edição/exclusão', async () => {
  const { store, outfits } = setup();
  await assert.rejects(outfits.save({ name: '', pieceIds: [] }));
  await assert.rejects(outfits.save({ name: 'Falha', pieceIds: ['inexistente'] }));
  const outfit = await outfits.save({ name: 'Novo', pieceIds: ['jordan', 'jordan'] });
  assert.deepEqual(outfit.pieceIds, ['jordan']);
  await outfits.save({ name: 'Editado', pieceIds: ['nike-cinza'] }, outfit.id);
  assert.equal(store.getSnapshot().outfits.find((o) => o.id === outfit.id).name, 'Editado');
  await outfits.remove(outfit.id);
  assert.equal(store.getSnapshot().outfits.some((o) => o.id === outfit.id), false);
});

test('um conjunto sem peças fica indisponível após a exclusão da última peça', async () => {
  const { store, pieces, outfits } = setup();
  const outfit = await outfits.save({ name: 'Uma peça', pieceIds: ['jordan'] });
  await pieces.remove('jordan');
  assert.equal(outfitAvailable(store.getSnapshot().outfits.find((o) => o.id === outfit.id), store.getSnapshot().pieces), false);
});

test('persistência contém somente metadados: exclui imagens, senhas e campos desconhecidos', async () => {
  const { storage, session, store, pieces, auth } = setup();
  await pieces.create({ ...validPiece, image: 'blob:imagem-temporaria', password: 'nao-salvar', token: 'nao-salvar', imageKey: 'data:image/png;base64,nao-salvar' });
  await auth.register({ name: 'Ana', email: 'ana@exemplo.com', password: 'segredo123', confirmPassword: 'segredo123' });
  await auth.updateProfile({ name: 'Ana', email: 'ana@exemplo.com', avatar: 'blob:avatar' });
  const saved = storage.getItem(STORAGE_KEY);
  for (const forbidden of ['blob:', 'base64', 'segredo123', 'password', 'token', 'avatar']) assert.equal(saved.includes(forbidden), false, forbidden);
  const reloaded = createDemoStore(storage, session).getSnapshot();
  assert.equal(reloaded.session, true);
  assert.equal(reloaded.user.avatar, '');
  assert.equal(reloaded.pieces.at(-1).image, undefined);
  assert.equal(store.getSnapshot().pieces.at(-1).image, 'blob:imagem-temporaria');
  await auth.logout();
  assert.equal(createDemoStore(storage, session).getSnapshot().session, false);
});

test('metadados vazios sobrevivem à recarga; armazenamento corrompido ou bloqueado não quebra o app', async () => {
  const { storage, session, store, pieces, outfits } = setup();
  for (const piece of [...store.getSnapshot().pieces]) await pieces.remove(piece.id);
  for (const outfit of [...store.getSnapshot().outfits]) await outfits.remove(outfit.id);
  assert.equal(createDemoStore(storage, session).getSnapshot().pieces.length, 0);
  assert.equal(createDemoStore(storage, session).getSnapshot().outfits.length, 0);
  storage.setItem(STORAGE_KEY, 'invalid-json');
  assert.equal(createDemoStore(storage).getSnapshot().pieces.length, 5);
  const blocked = createDemoStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.update((s) => ({ ...s, session: true }));
  assert.equal(blocked.getSnapshot().session, true);
  assert.match(blocked.getSnapshot().storageWarning, /sessão/);
});

test('valida cadastro e alteração de senha; recuperação exige código correto e não guarda credenciais', async () => {
  const { auth, store } = setup();
  const bad = validateCredentials({ name: '', email: 'invalido', password: '123', confirmPassword: '456' }, { register: true });
  assert.deepEqual(Object.keys(bad).sort(), ['confirmPassword', 'email', 'name', 'password']);
  assert.ok(validatePasswords({ currentPassword: '', password: '12345678', confirmPassword: 'diferente' }, true).currentPassword);
  await assert.rejects(auth.verifyCode(DEMO_CODE));
  await assert.rejects(auth.startRecovery('invalido'));
  await auth.startRecovery('ana@exemplo.com');
  await assert.rejects(auth.verifyCode('00000'));
  await assert.rejects(auth.resetPassword({ password: '12345678', confirmPassword: '12345678' }));
  assert.equal(await auth.resendCode(), DEMO_CODE);
  await auth.verifyCode(DEMO_CODE);
  await auth.resetPassword({ password: 'novasenha123', confirmPassword: 'novasenha123' });
  assert.equal(auth.getRecovery(), null);
  assert.equal(JSON.stringify(store.getSnapshot()).includes('novasenha123'), false);
});
