import { createSocket, Socket } from 'dgram'
import { networkInterfaces } from 'os'
import type { DaikinDevice } from './types.js'

/**
 * Daikin device discovery using UDP broadcast
 * Based on the Go implementation for finding devices on the local network
 */

const DISCOVERY_PORT = 15914
const DISCOVERY_MESSAGE = 'DAIKIN_UDP/common/basic_info'
const DISCOVERY_TIMEOUT = 10000 // 10 seconds default

/**
 * Gets all local network interfaces and their broadcast addresses
 * @returns Array of broadcast addresses
 */
function getBroadcastAddresses (): string[] {
  const interfaces = networkInterfaces()
  const broadcastAddresses: string[] = []

  for (const interfaceName in interfaces) {
    const interfaceInfo = interfaces[interfaceName]
    if (!interfaceInfo) continue

    for (const info of interfaceInfo) {
      if (info.family === 'IPv4' && !info.internal) {
        // Calculate broadcast address
        const ip = info.address.split('.').map(Number)
        const netmask = info.netmask.split('.').map(Number)

        const broadcast = ip
          .map((octet, index) => {
            return octet | (~netmask[index] & 0xff)
          })
          .join('.')

        broadcastAddresses.push(broadcast)
      }
    }
  }

  return broadcastAddresses
}

/**
 * Parses a Daikin device response
 * @param data - The response data
 * @param remoteAddress - The IP address of the responding device
 * @returns Parsed device information or null if invalid
 */
function parseDeviceResponse (
  data: Buffer,
  remoteAddress: string
): DaikinDevice | null {
  try {
    const response = data.toString('utf8')

    // Basic validation - should contain device info
    if (!response.includes('ret=OK')) {
      return null
    }

    // Parse key-value pairs
    const params = new Map<string, string>()
    const pairs = response.split(',')

    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      if (key && value) {
        params.set(key, value)
      }
    }

    // Extract device information
    const device: DaikinDevice = {
      ip: remoteAddress,
      port: DISCOVERY_PORT,
      mac: params.get('mac'),
      model: params.get('type'),
      firmwareVersion: params.get('ver')
    }

    return device
  } catch (error) {
    return null
  }
}

/**
 * Discovers Daikin devices on the local network
 * @param timeoutMs - Discovery timeout in milliseconds
 * @returns Promise that resolves to an array of discovered devices
 */
export function discoverDevices (
  timeoutMs: number = DISCOVERY_TIMEOUT
): Promise<DaikinDevice[]> {
  return new Promise((resolve, reject) => {
    const devices: DaikinDevice[] = []
    const broadcastAddresses = getBroadcastAddresses()

    if (broadcastAddresses.length === 0) {
      reject(new Error('No network interfaces found for discovery'))
      return
    }

    const socket: Socket = createSocket('udp4')
    let timeoutHandle: NodeJS.Timeout

    // Set up message handler
    socket.on('message', (data: Buffer, rinfo) => {
      const device = parseDeviceResponse(data, rinfo.address)
      if (device) {
        // Check if device already discovered (by IP)
        const existing = devices.find(d => d.ip === device.ip)
        if (!existing) {
          devices.push(device)
        }
      }
    })

    // Set up error handler
    socket.on('error', error => {
      clearTimeout(timeoutHandle)
      socket.close()
      reject(error)
    })

    // Set up socket
    socket.bind(() => {
      socket.setBroadcast(true)

      // Send discovery message to all broadcast addresses
      const message = Buffer.from(DISCOVERY_MESSAGE, 'utf8')

      for (const broadcastAddr of broadcastAddresses) {
        socket.send(message, DISCOVERY_PORT, broadcastAddr, error => {
          if (error) {
            console.warn(
              `Failed to send discovery to ${broadcastAddr}:`,
              error.message
            )
          }
        })
      }

      // Set timeout
      timeoutHandle = setTimeout(() => {
        socket.close()
        resolve(devices)
      }, timeoutMs)
    })
  })
}

/**
 * Discovers a single device by IP address
 * @param ipAddress - The IP address to check
 * @param timeoutMs - Timeout in milliseconds
 * @returns Promise that resolves to device info or null if not found
 */
export function discoverDeviceByIP (
  ipAddress: string,
  timeoutMs: number = 5000
): Promise<DaikinDevice | null> {
  return new Promise((resolve, reject) => {
    const socket: Socket = createSocket('udp4')
    let timeoutHandle: NodeJS.Timeout
    let resolved = false

    // Set up message handler
    socket.on('message', (data: Buffer, rinfo) => {
      if (resolved) return

      const device = parseDeviceResponse(data, rinfo.address)
      if (device && device.ip === ipAddress) {
        resolved = true
        clearTimeout(timeoutHandle)
        socket.close()
        resolve(device)
      }
    })

    // Set up error handler
    socket.on('error', error => {
      if (resolved) return
      resolved = true
      clearTimeout(timeoutHandle)
      socket.close()
      reject(error)
    })

    // Set up socket and send message
    socket.bind(() => {
      const message = Buffer.from(DISCOVERY_MESSAGE, 'utf8')

      socket.send(message, DISCOVERY_PORT, ipAddress, error => {
        if (error && !resolved) {
          resolved = true
          clearTimeout(timeoutHandle)
          socket.close()
          reject(error)
        }
      })

      // Set timeout
      timeoutHandle = setTimeout(() => {
        if (!resolved) {
          resolved = true
          socket.close()
          resolve(null)
        }
      }, timeoutMs)
    })
  })
}
