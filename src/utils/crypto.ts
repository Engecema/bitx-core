import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import { HDKey } from '@scure/bip32';
import { sha256 } from '@noble/hashes/sha2.js';
import { ripemd160 } from '@noble/hashes/legacy.js';
import { bech32 } from '@scure/base';

export const STORAGE_KEY = 'bitx-mainnet-wallet-v1';
export const REGTEST_STORAGE_KEY = 'bitx-regtest-wallet-v1';
export const DERIVATION_PATH = "m/84'/0'/0'";
export const REGTEST_DERIVATION_PATH = "m/84'/1'/0'";
export const PBKDF2_ITERATIONS = 310000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface EncryptedWalletRecord {
  version: number;
  network: 'mainnet' | 'regtest';
  kdf: string;
  iterations: number;
  cipher: string;
  salt: string;
  iv: string;
  ciphertext: string;
  receiveIndex: number;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let value = '';
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value);
}

export function base64ToBytes(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
}

async function deriveEncryptionKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const passwordBytes = encoder.encode(password);
  const material = await crypto.subtle.importKey(
    'raw',
    passwordBytes.buffer as ArrayBuffer,
    'PBKDF2',
    false,
    ['deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptMnemonic(
  mnemonic: string,
  password: string,
  network: 'mainnet' | 'regtest' = 'mainnet'
): Promise<EncryptedWalletRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveEncryptionKey(password, salt);
  const data = encoder.encode(mnemonic);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv.buffer as ArrayBuffer },
    key,
    data.buffer as ArrayBuffer
  );
  return {
    version: 1,
    network,
    kdf: 'PBKDF2-SHA256',
    iterations: PBKDF2_ITERATIONS,
    cipher: 'AES-256-GCM',
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
    receiveIndex: 0,
  };
}

export async function decryptMnemonic(record: EncryptedWalletRecord, password: string): Promise<string> {
  if (
    record.version !== 1 ||
    (record.network !== 'regtest' && record.network !== 'mainnet') ||
    record.kdf !== 'PBKDF2-SHA256'
  ) {
    throw new Error('Formato de carteira não reconhecido.');
  }
  const saltBytes = base64ToBytes(record.salt);
  const ivBytes = base64ToBytes(record.iv);
  const cipherBytes = base64ToBytes(record.ciphertext);

  const key = await deriveEncryptionKey(password, saltBytes);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes.buffer as ArrayBuffer },
    key,
    cipherBytes.buffer as ArrayBuffer
  );
  return decoder.decode(plaintext);
}

export function readStoredWallet(): EncryptedWalletRecord | null {
  try {
    let value = localStorage.getItem(STORAGE_KEY);
    if (!value) {
      value = localStorage.getItem(REGTEST_STORAGE_KEY);
    }
    if (!value) return null;
    const record = JSON.parse(value);
    if (typeof record.ciphertext !== 'string') return null;
    return record;
  } catch {
    return null;
  }
}

export function saveStoredWallet(record: EncryptedWalletRecord) {
  const key = record.network === 'regtest' ? REGTEST_STORAGE_KEY : STORAGE_KEY;
  localStorage.setItem(key, JSON.stringify(record));
}

export function removeStoredWallet() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(REGTEST_STORAGE_KEY);
}

export function generateMnemonicPhrase(): string {
  return bip39.generateMnemonic(wordlist, 128);
}

export function validateMnemonicPhrase(phrase: string): boolean {
  return bip39.validateMnemonic(phrase.trim().toLowerCase().replace(/\s+/g, ' '), wordlist);
}

export async function deriveAddressFromMnemonic(
  mnemonic: string,
  branch = 0,
  index = 0,
  network: 'mainnet' | 'regtest' = 'mainnet'
): Promise<string> {
  const seed = await bip39.mnemonicToSeed(mnemonic);
  const master = HDKey.fromMasterSeed(seed);
  const path =
    network === 'mainnet'
      ? `m/84'/0'/0'/${branch}/${index}`
      : `m/84'/1'/0'/${branch}/${index}`;
  const child = master.derive(path);
  if (!child.publicKey) throw new Error(`Não foi possível derivar o endereço ${network}.`);
  const sha = sha256(child.publicKey);
  const ripe = ripemd160(sha);
  const words = [0, ...bech32.toWords(ripe)];
  const hrp = network === 'mainnet' ? 'btxc' : 'bxrt';
  return bech32.encode(hrp, words);
}
