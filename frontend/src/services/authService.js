import { demoStore } from './demoStore.js';
import { assertValid, isEmail, validateCredentials, validatePasswords } from './validation.js';
import { releaseUnusedPreview } from './imagePreview.js';

export const DEMO_CODE = '12345';
export function createAuthService(store) {
  let recovery = null;
  return {
    async login(values) {
      assertValid(validateCredentials(values));
      // This session marker only enables UI navigation. No credential is retained.
      store.update((state) => ({ ...state, session: true, user: { ...state.user, email: values.email.trim() } }));
    },
    async register(values) {
      assertValid(validateCredentials(values, { register: true }));
      store.update((state) => ({ ...state, session: true, user: { name: values.name.trim(), email: values.email.trim(), avatar: '' } }));
    },
    async logout() { recovery = null; store.update((state) => ({ ...state, session: false })); },
    async updateProfile(values) {
      const errors = {};
      if (!values.name.trim()) errors.name = 'Informe seu nome.';
      if (!isEmail(values.email)) errors.email = 'Informe um e-mail válido.';
      assertValid(errors);
      const previousAvatar = store.getSnapshot().user.avatar;
      store.update((state) => ({ ...state, user: { name: values.name.trim(), email: values.email.trim(), avatar: values.avatar || '' } }));
      releaseUnusedPreview(previousAvatar);
    },
    async changePassword(values) { assertValid(validatePasswords(values, true)); },
    async startRecovery(email) {
      assertValid(isEmail(email) ? {} : { email: 'Informe um e-mail válido.' });
      recovery = { email: email.trim(), verified: false };
    },
    getRecovery: () => recovery,
    async resendCode() {
      if (!recovery) throw new Error('Informe seu e-mail primeiro.');
      recovery = { ...recovery, verified: false };
      return DEMO_CODE;
    },
    async verifyCode(code) {
      if (!recovery) throw new Error('Informe seu e-mail primeiro.');
      if (code !== DEMO_CODE) throw new Error(`Use os cinco dígitos do código demonstrativo: ${DEMO_CODE}.`);
      recovery = { ...recovery, verified: true };
    },
    async resetPassword(values) {
      if (!recovery?.verified) throw new Error('Confirme o código primeiro.');
      assertValid(validatePasswords(values));
      recovery = null;
    },
  };
}
export const authService = createAuthService(demoStore);
