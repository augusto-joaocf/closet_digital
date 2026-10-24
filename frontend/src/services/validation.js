import { pieceOptions } from '../data/options.js';

export const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export function validateCredentials({ name, email, password, confirmPassword }, { register = false } = {}) {
  const errors = {};
  if (register && !name?.trim()) errors.name = 'Informe seu nome.';
  if (!isEmail(email || '')) errors.email = 'Informe um e-mail válido.';
  if (!password || password.length < 8) errors.password = 'Use pelo menos 8 caracteres.';
  if (register && (!confirmPassword || confirmPassword !== password)) errors.confirmPassword = 'As senhas não coincidem.';
  return errors;
}
export function validatePasswords({ currentPassword, password, confirmPassword }, requireCurrent = false) {
  const errors = {};
  if (requireCurrent && !currentPassword?.trim()) errors.currentPassword = 'Informe a senha atual.';
  if (!password || password.length < 8) errors.password = 'Use pelo menos 8 caracteres.';
  if (!confirmPassword || confirmPassword !== password) errors.confirmPassword = 'As senhas não coincidem.';
  return errors;
}
export function validatePiece(piece) {
  const errors = {};
  if (!piece.name?.trim()) errors.name = 'Informe o nome da peça.';
  Object.entries(pieceOptions).forEach(([key, option]) => {
    if (!option.values.includes(piece[key])) errors[key] = `Selecione ${option.label.toLowerCase()}.`;
  });
  return errors;
}
export function assertValid(errors) {
  if (Object.keys(errors).length) {
    const error = new Error(Object.values(errors)[0]);
    error.fields = errors;
    throw error;
  }
}
