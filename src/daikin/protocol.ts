import { aesEncrypt, aesDecrypt, generateIV, hexToBuffer } from './crypto.js';
import { calculateCRC16, crc16ToBuffer, bufferToCRC16 } from './crc16.js';
import type { DaikinMessage } from './types.js';

/**
 * Daikin communication protocol implementation
 * Handles message encoding/decoding with AES encryption and CRC16 checksums
 */

/**
 * Encodes a message for Daikin AC communication
 * @param payload - The payload to encode
 * @param secretKey - The secret key (hex string)
 * @returns The encoded message ready for transmission
 */
export function encodeMessage(payload: string, secretKey: string): string {
  // Convert secret key from hex to buffer (32 bytes for AES-256)
  const key = hexToBuffer(secretKey);
  
  // Generate random IV (16 bytes)
  const iv = generateIV();
  
  // Add "BZ" suffix to payload as required by Daikin protocol
  const payloadWithSuffix = payload + 'BZ';
  const payloadBuffer = Buffer.from(payloadWithSuffix, 'utf8');
  
  // Calculate CRC16 of the payload
  const crc = calculateCRC16(payloadBuffer);
  const crcBuffer = crc16ToBuffer(crc);
  
  // Encrypt the payload + CRC
  const dataToEncrypt = Buffer.concat([payloadBuffer, crcBuffer]);
  const encryptedData = aesEncrypt(dataToEncrypt, key, iv);
  
  // Combine IV + encrypted data
  const fullMessage = Buffer.concat([iv, encryptedData]);
  
  // Return as base64
  return fullMessage.toString('base64');
}

/**
 * Decodes a message from Daikin AC
 * @param encodedMessage - The base64 encoded message
 * @param secretKey - The secret key (hex string)
 * @returns The decoded message structure
 */
export function decodeMessage(encodedMessage: string, secretKey: string): DaikinMessage {
  // Convert secret key from hex to buffer
  const key = hexToBuffer(secretKey);
  
  // Decode from base64
  const fullMessage = Buffer.from(encodedMessage, 'base64');
  
  // Extract IV (first 16 bytes)
  const iv = fullMessage.subarray(0, 16);
  
  // Extract encrypted data (remaining bytes)
  const encryptedData = fullMessage.subarray(16);
  
  // Decrypt the data
  const decryptedData = aesDecrypt(encryptedData, key, iv);
  
  // Extract CRC (last 2 bytes)
  const crc = decryptedData.subarray(-2);
  
  // Extract payload (all but last 2 bytes)
  const payload = decryptedData.subarray(0, -2);
  
  return {
    iv,
    payload,
    crc,
  };
}

/**
 * Validates the CRC16 checksum of a decoded message
 * @param message - The decoded message
 * @returns True if CRC is valid, false otherwise
 */
export function validateCRC(message: DaikinMessage): boolean {
  const calculatedCRC = calculateCRC16(message.payload);
  const receivedCRC = bufferToCRC16(message.crc);
  return calculatedCRC === receivedCRC;
}

/**
 * Extracts the payload string from a decoded message
 * @param message - The decoded message
 * @returns The payload as a string (with "BZ" suffix removed if present)
 */
export function extractPayload(message: DaikinMessage): string {
  let payloadStr = message.payload.toString('utf8');
  
  // Remove "BZ" suffix if present
  if (payloadStr.endsWith('BZ')) {
    payloadStr = payloadStr.slice(0, -2);
  }
  
  return payloadStr;
}

/**
 * Creates a complete encoded message from a payload string
 * @param payload - The payload string
 * @param secretKey - The secret key (hex string)
 * @returns The base64 encoded message ready for HTTP transmission
 */
export function createMessage(payload: string, secretKey: string): string {
  return encodeMessage(payload, secretKey);
}

/**
 * Parses a complete response message
 * @param encodedResponse - The base64 encoded response
 * @param secretKey - The secret key (hex string)
 * @returns The decoded payload string or null if invalid
 */
export function parseResponse(encodedResponse: string, secretKey: string): string | null {
  try {
    const message = decodeMessage(encodedResponse, secretKey);
    
    if (!validateCRC(message)) {
      return null;
    }
    
    return extractPayload(message);
  } catch (error) {
    return null;
  }
}
