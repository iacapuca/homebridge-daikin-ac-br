import type {
  API,
  Characteristic,
  DynamicPlatformPlugin,
  Logging,
  PlatformAccessory,
  PlatformConfig,
  Service
} from 'homebridge'

import { DaikinPlatformAccessory } from './platformAccessory.js'
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js'
import {
  discoverDevices,
  DaikinClient,
  type DaikinDevice,
  type DaikinPlatformConfig
} from './daikin/index.js'

// This is only required when using Custom Services and Characteristics not support by HomeKit
import { EveHomeKitTypes } from 'homebridge-lib/EveHomeKitTypes'

/**
 * DaikinPlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class DaikinPlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service
  public readonly Characteristic: typeof Characteristic

  // this is used to track restored cached accessories
  public readonly accessories: Map<string, PlatformAccessory> = new Map()
  public readonly discoveredCacheUUIDs: string[] = []

  // Daikin-specific properties
  public readonly daikinConfig: DaikinPlatformConfig
  public readonly clients: Map<string, DaikinClient> = new Map()

  // This is only required when using Custom Services and Characteristics not support by HomeKit
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomServices: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public readonly CustomCharacteristics: any

  constructor (
    public readonly log: Logging,
    public readonly config: PlatformConfig,
    public readonly api: API
  ) {
    this.Service = api.hap.Service
    this.Characteristic = api.hap.Characteristic

    // Parse and validate Daikin configuration
    this.daikinConfig = this.config as unknown as DaikinPlatformConfig

    if (!this.daikinConfig.secretKey) {
      this.log.error('Secret key is required in the platform configuration')
      throw new Error('Secret key is required')
    }

    // This is only required when using Custom Services and Characteristics not support by HomeKit
    this.CustomServices = new EveHomeKitTypes(this.api).Services
    this.CustomCharacteristics = new EveHomeKitTypes(this.api).Characteristics

    this.log.debug('Finished initializing platform:', this.config.name)

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback')
      // run the method to discover / register your devices as accessories
      this.discoverDevices()
    })
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to set up event handlers for characteristics and update respective values.
   */
  configureAccessory (accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName)

    // add the restored accessory to the accessories cache, so we can track if it has already been registered
    this.accessories.set(accessory.UUID, accessory)
  }

  /**
   * Discovers Daikin AC devices on the local network and registers them as accessories.
   */
  async discoverDevices () {
    this.log.info('Starting Daikin device discovery...')

    try {
      const timeoutMs = (this.daikinConfig.discoveryTimeout || 10) * 1000
      const devices = await discoverDevices(timeoutMs)

      this.log.info(`Found ${devices.length} Daikin device(s)`)

      if (devices.length === 0) {
        this.log.warn(
          'No Daikin devices found on the network. Make sure your AC units are connected and powered on.'
        )
        return
      }

      // Process each discovered device
      for (const device of devices) {
        await this.registerDevice(device)
      }
    } catch (error) {
      this.log.error('Error during device discovery:', error)
    }

    // Remove accessories that are no longer present
    for (const [uuid, accessory] of this.accessories) {
      if (!this.discoveredCacheUUIDs.includes(uuid)) {
        this.log.info(
          'Removing existing accessory from cache:',
          accessory.displayName
        )
        this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
          accessory
        ])
      }
    }
  }

  /**
   * Registers a Daikin device as a Homebridge accessory
   */
  private async registerDevice (device: DaikinDevice) {
    // Generate UUID from device IP (most stable identifier)
    const uuid = this.api.hap.uuid.generate(device.ip)

    // Create client for this device
    const client = new DaikinClient(device, this.daikinConfig.secretKey)

    // Test connection to device
    try {
      const isConnected = await client.testConnection()
      if (!isConnected) {
        this.log.warn(`Cannot connect to device at ${device.ip}:${device.port}`)
        return
      }
    } catch (error) {
      this.log.warn(
        `Failed to test connection to device at ${device.ip}:${device.port}:`,
        error
      )
      return
    }

    // Store client for later use
    this.clients.set(uuid, client)

    // Check if accessory already exists
    const existingAccessory = this.accessories.get(uuid)

    if (existingAccessory) {
      // Update existing accessory
      this.log.info(
        'Restoring existing accessory from cache:',
        existingAccessory.displayName
      )

      // Update context with latest device info
      existingAccessory.context.device = device
      this.api.updatePlatformAccessories([existingAccessory])

      // Create accessory handler
      new DaikinPlatformAccessory(this, existingAccessory, client)
    } else {
      // Create new accessory
      const displayName = `Daikin AC (${device.ip})`
      this.log.info('Adding new accessory:', displayName)

      const accessory = new this.api.platformAccessory(displayName, uuid)
      accessory.context.device = device

      // Create accessory handler
      new DaikinPlatformAccessory(this, accessory, client)

      // Register with Homebridge
      this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
        accessory
      ])
    }

    // Track discovered device
    this.discoveredCacheUUIDs.push(uuid)
  }
}
