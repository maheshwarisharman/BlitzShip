import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

/**
 * Lazily resolves the 32-byte encryption key from ENV_ENCRYPTION_SECRET.
 * Throws a clear error at call-time (not import-time) so unit tests that
 * don't touch crypto still start cleanly.
 */
function getKey(): Buffer {
  const secret = process.env.ENV_ENCRYPTION_SECRET;
  if (!secret || secret.length !== 64) {
    throw new Error(
      'ENV_ENCRYPTION_SECRET must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(secret, 'hex');
}

/**
 * Encrypts a plaintext string value using AES-256-GCM.
 * Each call uses a fresh 96-bit IV, so identical plaintexts produce
 * different ciphertexts — no value correlation across the DB.
 *
 * Returns a compact string: "<iv_hex>:<authTag_hex>:<ciphertext_hex>"
 */
export function encryptValue(plaintext: string): string {
  const iv = randomBytes(12); // 96-bit IV recommended for GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag(); // 128-bit authentication tag
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypts a value previously produced by encryptValue().
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decryptValue(ciphertext: string): string {
  const parts = ciphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format — expected "<iv>:<authTag>:<data>"');
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const data = Buffer.from(dataHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * Encrypts all values in an env map, leaving keys plaintext.
 * { DATABASE_URL: "postgres://..." } → { DATABASE_URL: "<encrypted>" }
 */
export function encryptEnvMap(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, encryptValue(v)])
  );
}

/**
 * Decrypts all values in an env map previously encrypted by encryptEnvMap().
 * { DATABASE_URL: "<encrypted>" } → { DATABASE_URL: "postgres://..." }
 */
export function decryptEnvMap(env: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([k, v]) => [k, decryptValue(v)])
  );
}
