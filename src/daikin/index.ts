/**
 * Daikin AC SDK for Node.js
 *
 * This SDK provides functionality to discover and control Daikin Split EcoSwing Smart R-32
 * and Split EcoSwing Smart Gold R-32 air conditioners on the local network.
 *
 * Based on the reverse engineering work from: https://github.com/crossworth/daikin
 */

// Export types
export type {
  DaikinDevice,
  ACState,
  DeviceResponse,
  DiscoveryResponse,
  DaikinPlatformConfig,
  DaikinMessage
} from './types.js'

export { ACMode, FanSpeed, SwingMode } from './types.js'

// Export crypto utilities
export {
  aesEncrypt,
  aesDecrypt,
  generateIV,
  hexToBuffer,
  bufferToHex
} from './crypto.js'

// Export CRC utilities
export { calculateCRC16, crc16ToBuffer, bufferToCRC16 } from './crc16.js'

// Export protocol utilities
export {
  encodeMessage,
  decodeMessage,
  validateCRC,
  extractPayload,
  createMessage,
  parseResponse
} from './protocol.js'

// Export discovery functions
export { discoverDevices, discoverDeviceByIP } from './discovery.js'

// Export client
export { DaikinClient } from './client.js'

// Import the actual classes and functions
import { DaikinClient } from './client.js'
import { discoverDevices } from './discovery.js'
import type { DaikinDevice } from './types.js'

/**
 * Convenience function to create a Daikin client
 * @param device - The device information
 * @param secretKey - The secret key for the device
 * @returns A new DaikinClient instance
 */
export function createClient (
  device: DaikinDevice,
  secretKey: string
): DaikinClient {
  return new DaikinClient(device, secretKey)
}

/**
 * Convenience function to discover devices and create clients
 * @param secretKey - The secret key for the devices
 * @param timeoutMs - Discovery timeout in milliseconds
 * @returns Promise that resolves to an array of DaikinClient instances
 */
export async function discoverAndCreateClients (
  secretKey: string,
  timeoutMs?: number
): Promise<DaikinClient[]> {
  const devices = await discoverDevices(timeoutMs)
  return devices.map(device => new DaikinClient(device, secretKey))
}
