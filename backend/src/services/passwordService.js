import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';

export async function createPasswordService(rounds) {
  // Equal-cost comparison when an e-mail does not exist. This is not an account credential.
  const dummyHash = await bcrypt.hash(randomBytes(32).toString('base64url'), rounds);
  return {
    hash: (password) => bcrypt.hash(password, rounds),
    compare: (password, hash) => bcrypt.compare(password, hash || dummyHash),
  };
}
