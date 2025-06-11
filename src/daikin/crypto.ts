import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES encryption/decryption utilities for Daikin AC communication
 * Based on the Go implementation using AES-CFB mode
 */

/**
 * Encrypts data using AES-256-CFB mode
 * @param data - The data to encrypt
 * @param key - The secret key (32 bytes for AES-256)
 * @param iv - The initialization vector (16 bytes)
 * @returns The encrypted data
 */
export function aesEncrypt(data: Buffer, key: Buffer, iv: Buffer): Buffer {
  const cipher = createCipheriv('aes-256-cfb', key, iv);
  cipher.setAutoPadding(false);
  
  const encrypted = Buffer.concat([
    cipher.update(data),
    cipher.final(),
  ]);
  
  return encrypted;
}

/**
 * Decrypts data using AES-256-CFB mode
 * @param encryptedData - The encrypted data to decrypt
 * @param key - The secret key (32 bytes for AES-256)
 * @param iv - The initialization vector (16 bytes)
 * @returns The decrypted data
 */
export function aesDecrypt(encryptedData: Buffer, key: Buffer, iv: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-cfb', key, iv);
  decipher.setAutoPadding(false);
  
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  
  return decrypted;
}

/**
 * Generates a random initialization vector
 * @returns A 16-byte random IV
 */
export function generateIV(): Buffer {
  return randomBytes(16);
}

/**
 * Converts a hex string to a Buffer
 * @param hex - The hex string to convert
 * @returns The Buffer representation
 */
export function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, 'hex');
}

/**
 * Converts a Buffer to a hex string
 * @param buffer - The Buffer to convert
 * @returns The hex string representation
 */
export function bufferToHex(buffer: Buffer): string {
  return buffer.toString('hex');
}
