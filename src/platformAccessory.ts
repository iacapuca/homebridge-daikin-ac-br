import type {
  CharacteristicValue,
  PlatformAccessory,
  Service
} from 'homebridge'

import type { DaikinPlatform } from './platform.js'
import { DaikinClient, ACMode, FanSpeed } from './daikin/index.js'
import type { ACState } from './daikin/index.js'

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class DaikinPlatformAccessory {
  private service: Service
  private currentState: ACState | null = null
  private pollInterval: NodeJS.Timeout | null = null

  constructor (
    private readonly platform: DaikinPlatform,
    private readonly accessory: PlatformAccessory,
    private readonly client: DaikinClient
  ) {
    // Set accessory information
    const device = this.accessory.context.device
    this.accessory
      .getService(this.platform.Service.AccessoryInformation)!
      .setCharacteristic(this.platform.Characteristic.Manufacturer, 'Daikin')
      .setCharacteristic(
        this.platform.Characteristic.Model,
        device.model || 'Daikin AC'
      )
      .setCharacteristic(
        this.platform.Characteristic.SerialNumber,
        device.mac || device.ip
      )
      .setCharacteristic(
        this.platform.Characteristic.FirmwareRevision,
        device.firmwareVersion || '1.0.0'
      )

    // Get or create the HeaterCooler service (perfect for AC units)
    this.service =
      this.accessory.getService(this.platform.Service.HeaterCooler) ||
      this.accessory.addService(this.platform.Service.HeaterCooler)

    // Set the service name
    this.service.setCharacteristic(
      this.platform.Characteristic.Name,
      this.accessory.displayName
    )

    // Configure HeaterCooler characteristics
    // Active (required) - whether the device is on/off
    this.service
      .getCharacteristic(this.platform.Characteristic.Active)
      .onSet(this.setActive.bind(this))
      .onGet(this.getActive.bind(this))

    // Current Heater Cooler State (required) - current operating state
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentHeaterCoolerState)
      .onGet(this.getCurrentHeaterCoolerState.bind(this))

    // Target Heater Cooler State (required) - desired operating mode
    this.service
      .getCharacteristic(this.platform.Characteristic.TargetHeaterCoolerState)
      .onSet(this.setTargetHeaterCoolerState.bind(this))
      .onGet(this.getTargetHeaterCoolerState.bind(this))

    // Current Temperature (required) - current room temperature
    this.service
      .getCharacteristic(this.platform.Characteristic.CurrentTemperature)
      .onGet(this.getCurrentTemperature.bind(this))

    // Cooling Threshold Temperature - target temperature when cooling
    this.service
      .getCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature
      )
      .setProps({
        minValue: 16,
        maxValue: 32,
        minStep: 1
      })
      .onSet(this.setCoolingThresholdTemperature.bind(this))
      .onGet(this.getCoolingThresholdTemperature.bind(this))

    // Heating Threshold Temperature - target temperature when heating
    this.service
      .getCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature
      )
      .setProps({
        minValue: 16,
        maxValue: 32,
        minStep: 1
      })
      .onSet(this.setHeatingThresholdTemperature.bind(this))
      .onGet(this.getHeatingThresholdTemperature.bind(this))

    // Rotation Speed - fan speed
    this.service
      .getCharacteristic(this.platform.Characteristic.RotationSpeed)
      .setProps({
        minValue: 0,
        maxValue: 100,
        minStep: 20 // 5 levels: 0, 20, 40, 60, 80, 100
      })
      .onSet(this.setRotationSpeed.bind(this))
      .onGet(this.getRotationSpeed.bind(this))

    // Start polling for status updates
    this.startPolling()

    // Initial state fetch
    this.updateDeviceState()
  }

  /**
   * Starts polling the device for status updates
   */
  private startPolling () {
    const pollIntervalSeconds = this.platform.daikinConfig.pollInterval || 30

    this.pollInterval = setInterval(async () => {
      try {
        await this.updateDeviceState()
      } catch (error) {
        this.platform.log.error('Error polling device state:', error)
      }
    }, pollIntervalSeconds * 1000)
  }

  /**
   * Stops polling the device
   */
  private stopPolling () {
    if (this.pollInterval) {
      clearInterval(this.pollInterval)
      this.pollInterval = null
    }
  }

  /**
   * Updates the device state from the AC unit
   */
  private async updateDeviceState () {
    try {
      const response = await this.client.getState()
      this.currentState = response.port1

      // Update HomeKit characteristics with current values
      this.service.updateCharacteristic(
        this.platform.Characteristic.Active,
        this.currentState.power
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentTemperature,
        this.currentState.sensors.room_temp
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.CurrentHeaterCoolerState,
        this.mapACModeToCurrentState(
          this.currentState.mode,
          this.currentState.power
        )
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.TargetHeaterCoolerState,
        this.mapACModeToTargetState(this.currentState.mode)
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.CoolingThresholdTemperature,
        this.currentState.temperature
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.HeatingThresholdTemperature,
        this.currentState.temperature
      )

      this.service.updateCharacteristic(
        this.platform.Characteristic.RotationSpeed,
        this.mapFanSpeedToRotationSpeed(this.currentState.fan)
      )
    } catch (error) {
      this.platform.log.error('Failed to update device state:', error)
    }
  }

  // Mapping helper methods
  private mapACModeToCurrentState (mode: ACMode, power: number): number {
    if (!power) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE
    }

    switch (mode) {
      case ACMode.COOL:
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING
      case ACMode.HEAT:
        return this.platform.Characteristic.CurrentHeaterCoolerState.HEATING
      case ACMode.AUTO:
        // For auto mode, we'll assume cooling for now
        return this.platform.Characteristic.CurrentHeaterCoolerState.COOLING
      default:
        return this.platform.Characteristic.CurrentHeaterCoolerState.IDLE
    }
  }

  private mapACModeToTargetState (mode: ACMode): number {
    switch (mode) {
      case ACMode.COOL:
        return this.platform.Characteristic.TargetHeaterCoolerState.COOL
      case ACMode.HEAT:
        return this.platform.Characteristic.TargetHeaterCoolerState.HEAT
      case ACMode.AUTO:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO
      default:
        return this.platform.Characteristic.TargetHeaterCoolerState.AUTO
    }
  }

  private mapTargetStateToACMode (targetState: number): ACMode {
    switch (targetState) {
      case this.platform.Characteristic.TargetHeaterCoolerState.COOL:
        return ACMode.COOL
      case this.platform.Characteristic.TargetHeaterCoolerState.HEAT:
        return ACMode.HEAT
      case this.platform.Characteristic.TargetHeaterCoolerState.AUTO:
        return ACMode.AUTO
      default:
        return ACMode.AUTO
    }
  }

  private mapFanSpeedToRotationSpeed (fanSpeed: FanSpeed): number {
    switch (fanSpeed) {
      case FanSpeed.AUTO:
        return 0
      case FanSpeed.QUIET:
        return 10
      case FanSpeed.LEVEL_1:
        return 20
      case FanSpeed.LEVEL_2:
        return 40
      case FanSpeed.LEVEL_3:
        return 60
      case FanSpeed.LEVEL_4:
        return 80
      case FanSpeed.LEVEL_5:
        return 100
      default:
        return 0
    }
  }

  private mapRotationSpeedToFanSpeed (rotationSpeed: number): FanSpeed {
    if (rotationSpeed === 0) return FanSpeed.AUTO
    if (rotationSpeed <= 15) return FanSpeed.QUIET
    if (rotationSpeed <= 30) return FanSpeed.LEVEL_1
    if (rotationSpeed <= 50) return FanSpeed.LEVEL_2
    if (rotationSpeed <= 70) return FanSpeed.LEVEL_3
    if (rotationSpeed <= 90) return FanSpeed.LEVEL_4
    return FanSpeed.LEVEL_5
  }

  // Characteristic handlers
  async setActive (value: CharacteristicValue) {
    const active = value as number
    this.platform.log.debug('Set Active ->', active)

    try {
      if (active) {
        await this.client.turnOn()
      } else {
        await this.client.turnOff()
      }
    } catch (error) {
      this.platform.log.error('Failed to set active state:', error)
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      )
    }
  }

  async getActive (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return 0
    }
    return this.currentState.power
  }

  async getCurrentHeaterCoolerState (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return this.platform.Characteristic.CurrentHeaterCoolerState.INACTIVE
    }
    return this.mapACModeToCurrentState(
      this.currentState.mode,
      this.currentState.power
    )
  }

  async setTargetHeaterCoolerState (value: CharacteristicValue) {
    const targetState = value as number
    this.platform.log.debug('Set Target Heater Cooler State ->', targetState)

    try {
      const mode = this.mapTargetStateToACMode(targetState)
      await this.client.setMode(mode)
    } catch (error) {
      this.platform.log.error(
        'Failed to set target heater cooler state:',
        error
      )
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      )
    }
  }

  async getTargetHeaterCoolerState (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return this.platform.Characteristic.TargetHeaterCoolerState.AUTO
    }
    return this.mapACModeToTargetState(this.currentState.mode)
  }

  async getCurrentTemperature (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return 20 // Default temperature
    }
    return this.currentState.sensors.room_temp
  }

  async setCoolingThresholdTemperature (value: CharacteristicValue) {
    const temperature = value as number
    this.platform.log.debug('Set Cooling Threshold Temperature ->', temperature)

    try {
      await this.client.setTemperature(temperature)
    } catch (error) {
      this.platform.log.error(
        'Failed to set cooling threshold temperature:',
        error
      )
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      )
    }
  }

  async getCoolingThresholdTemperature (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return 24 // Default temperature
    }
    return this.currentState.temperature
  }

  async setHeatingThresholdTemperature (value: CharacteristicValue) {
    const temperature = value as number
    this.platform.log.debug('Set Heating Threshold Temperature ->', temperature)

    try {
      await this.client.setTemperature(temperature)
    } catch (error) {
      this.platform.log.error(
        'Failed to set heating threshold temperature:',
        error
      )
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      )
    }
  }

  async getHeatingThresholdTemperature (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return 24 // Default temperature
    }
    return this.currentState.temperature
  }

  async setRotationSpeed (value: CharacteristicValue) {
    const rotationSpeed = value as number
    this.platform.log.debug('Set Rotation Speed ->', rotationSpeed)

    try {
      const fanSpeed = this.mapRotationSpeedToFanSpeed(rotationSpeed)
      await this.client.setFanSpeed(fanSpeed)
    } catch (error) {
      this.platform.log.error('Failed to set rotation speed:', error)
      throw new this.platform.api.hap.HapStatusError(
        this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE
      )
    }
  }

  async getRotationSpeed (): Promise<CharacteristicValue> {
    if (!this.currentState) {
      return 0
    }
    return this.mapFanSpeedToRotationSpeed(this.currentState.fan)
  }
}
