import CryptoJS from "crypto-js";
import * as ExpoCrypto from "expo-crypto";

// A static app-level salt. Combined with the user's UID to derive a unique
// per-user AES-256 key. This means the same key is reproduced on any device
// the user logs into — no key storage required.
const APP_SALT = "paisa-v5-enc-2024";
const CIPHERTEXT_PREFIX = "U2FsdGVkX1";

// ---------------------------------------------------------------------------
// Polyfill: override CryptoJS's random with expo-crypto so AES encryption
// works on React Native / Hermes without a native crypto module.
// ---------------------------------------------------------------------------
(CryptoJS.lib.WordArray as any).random = (nBytes: number): CryptoJS.lib.WordArray => {
  const bytes = ExpoCrypto.getRandomBytes(nBytes);
  const words: number[] = [];
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(
      ((bytes[i] ?? 0) << 24) |
      ((bytes[i + 1] ?? 0) << 16) |
      ((bytes[i + 2] ?? 0) << 8) |
      (bytes[i + 3] ?? 0)
    );
  }
  return CryptoJS.lib.WordArray.create(words, nBytes);
};

/**
 * Derives a deterministic passphrase from the user's UID.
 * Returns a 64-character hex string used as the AES passphrase.
 */
export const deriveKey = (uid: string): string =>
  CryptoJS.SHA256(uid + APP_SALT).toString();

// ---------------------------------------------------------------------------
// Core field-level helpers
// ---------------------------------------------------------------------------

export const encryptField = (value: string | number, key: string): string =>
  CryptoJS.AES.encrypt(String(value), key).toString();

export const decryptField = (ciphertext: string, key: string): string =>
  CryptoJS.AES.decrypt(ciphertext, key).toString(CryptoJS.enc.Utf8);

export const decryptNumber = (ciphertext: string, key: string): number =>
  Number(decryptField(ciphertext, key));

// ---------------------------------------------------------------------------
// Field lists — defines what gets encrypted per collection
// ---------------------------------------------------------------------------

export const TRANSACTION_STRING_FIELDS = ["category", "description"] as const;
export const TRANSACTION_NUMERIC_FIELDS = ["amount"] as const;
export const WALLET_STRING_FIELDS = ["name"] as const;
// "amount" is kept for backward-compat decryption of old wallet docs (pre-v3 schema).
// New wallets use "currentBalance", "creditLimit", "pendingAmount" instead.
export const WALLET_NUMERIC_FIELDS = [
  "amount",
  "currentBalance",
  "creditLimit",
  "pendingAmount",
  "totalIncome",
  "totalExpenses",
] as const;
export const USER_STRING_FIELDS = ["name"] as const;

// ---------------------------------------------------------------------------
// Document-level helpers
// Only touches fields that are present & non-null in the document.
// ---------------------------------------------------------------------------

export const encryptDocument = <T extends object>(
  doc: T,
  stringFields: readonly string[],
  numericFields: readonly string[],
  key: string
): T => {
  const result = { ...doc } as any;
  for (const f of [...stringFields, ...numericFields]) {
    if (result[f] !== undefined && result[f] !== null) {
      result[f] = encryptField(result[f], key);
    }
  }
  return result as T;
};

export const decryptDocument = <T extends object>(
  doc: T,
  stringFields: readonly string[],
  numericFields: readonly string[],
  key: string
): T => {
  const result = { ...doc } as any;
  for (const f of stringFields) {
    if (result[f] !== undefined && result[f] !== null) {
      if (!isEncrypted(result[f])) {
        continue;
      }
      try {
        result[f] = decryptField(result[f], key);
      } catch {
        // Leave as-is on failure
      }
    }
  }
  for (const f of numericFields) {
    if (result[f] !== undefined && result[f] !== null) {
      if (typeof result[f] === "number") {
        // Already plaintext (pre-migration data) — leave as-is
        continue;
      }
      try {
        result[f] = decryptNumber(result[f], key);
      } catch {
        // Leave as-is on failure
      }
    }
  }
  return result as T;
};

/**
 * Returns true if a field value looks like a CryptoJS AES ciphertext.
 * CryptoJS Base64 output is a string; plaintext numbers are JS numbers.
 * This is used by the migration utility to detect un-encrypted documents.
 */
export const isEncrypted = (value: unknown): boolean =>
  typeof value === "string" && value.startsWith(CIPHERTEXT_PREFIX);
