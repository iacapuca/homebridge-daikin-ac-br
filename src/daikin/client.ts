import { request } from 'http'
import { URL } from 'url'
import { createMessage, parseResponse } from './protocol.js'
import type { DaikinDevice, ACState, DeviceResponse } from './types.js'

/**
 * HTTP client for communicating with Daikin AC units
 * Handles the non-standard HTTP responses from Daikin devices
 */

/**
 * Daikin AC HTTP client
 */
export class DaikinClient {
  private device: DaikinDevice
  private secretKey: string

  constructor (device: DaikinDevice, secretKey: string) {
    this.device = device
    this.secretKey = secretKey
  }

  /**
   * Gets the base URL for the device
   */
  private getBaseUrl (): string {
    return `http://${this.device.ip}:${this.device.port}`
  }

  /**
   * Makes an HTTP request to the device
   * @param path - The request path
   * @param data - Optional data to send
   * @returns Promise that resolves to the response string
   */
  private makeRequest (path: string, data?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(path, this.getBaseUrl())

      const headers: Record<string, string> = {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'DaikinOnlineController/2.3.1'
      }

      if (data) {
        headers['Content-Length'] = Buffer.byteLength(data).toString()
      }

      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: data ? 'POST' : 'GET',
        headers
      }

      const req = request(options, res => {
        let responseData = ''

        res.on('data', chunk => {
          responseData += chunk
        })

        res.on('end', () => {
          resolve(responseData)
        })
      })

      req.on('error', error => {
        reject(error)
      })

      if (data) {
        req.write(data)
      }

      req.end()
    })
  }

  /**
   * Sends a command to the AC unit
   * @param command - The command string to send
   * @returns Promise that resolves to the response string
   */
  private async sendCommand (command: string): Promise<string> {
    const encodedMessage = createMessage(command, this.secretKey)
    const postData = `m=${encodeURIComponent(encodedMessage)}`

    const response = await this.makeRequest('/ac.cgi', postData)

    // Parse the response
    const decodedResponse = parseResponse(response, this.secretKey)
    if (decodedResponse === null) {
      throw new Error('Failed to decode response from AC unit')
    }

    return decodedResponse
  }

  /**
   * Gets the current state of the AC unit
   * @returns Promise that resolves to the device response
   */
  async getState (): Promise<DeviceResponse> {
    const response = await this.sendCommand('M1')

    try {
      return JSON.parse(response) as DeviceResponse
    } catch (error) {
      throw new Error(`Failed to parse AC state response: ${error}`)
    }
  }

  /**
   * Sets the state of the AC unit
   * @param state - Partial state to update
   * @returns Promise that resolves to the updated device response
   */
  async setState (state: Partial<ACState>): Promise<DeviceResponse> {
    // First get current state
    const currentResponse = await this.getState()
    const currentState = currentResponse.port1

    // Merge with new state
    const newState = { ...currentState, ...state }

    // Create command string
    const command = `M1${JSON.stringify({
      port1: newState,
      idu: currentResponse.idu
    })}`

    const response = await this.sendCommand(command)

    try {
      return JSON.parse(response) as DeviceResponse
    } catch (error) {
      throw new Error(`Failed to parse AC state response: ${error}`)
    }
  }

  /**
   * Turns the AC unit on
   */
  async turnOn (): Promise<DeviceResponse> {
    return this.setState({ power: 1 })
  }

  /**
   * Turns the AC unit off
   */
  async turnOff (): Promise<DeviceResponse> {
    return this.setState({ power: 0 })
  }

  /**
   * Sets the target temperature
   * @param temperature - Target temperature (16-32°C)
   */
  async setTemperature (temperature: number): Promise<DeviceResponse> {
    if (temperature < 16 || temperature > 32) {
      throw new Error('Temperature must be between 16 and 32 degrees Celsius')
    }
    return this.setState({ temperature })
  }

  /**
   * Sets the operating mode
   * @param mode - The operating mode
   */
  async setMode (mode: number): Promise<DeviceResponse> {
    return this.setState({ mode })
  }

  /**
   * Sets the fan speed
   * @param fanSpeed - The fan speed
   */
  async setFanSpeed (fanSpeed: number): Promise<DeviceResponse> {
    return this.setState({ fan: fanSpeed })
  }

  /**
   * Tests connectivity to the device
   * @returns Promise that resolves to true if device is reachable
   */
  async testConnection (): Promise<boolean> {
    try {
      await this.getState()
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Gets device information
   */
  getDeviceInfo (): DaikinDevice {
    return { ...this.device }
  }
}
