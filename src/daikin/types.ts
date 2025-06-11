/**
 * Type definitions for Daikin AC communication
 */

/**
 * Daikin AC device information
 */
export interface DaikinDevice {
  /** Device IP address */
  ip: string;
  /** Device port (usually 15914) */
  port: number;
  /** Device MAC address */
  mac?: string;
  /** Device model */
  model?: string;
  /** Device firmware version */
  firmwareVersion?: string;
  /** Device unique identifier */
  deviceId?: string;
}

/**
 * AC operating modes
 */
export enum ACMode {
  AUTO = 0,
  COOL = 1,
  DRY = 2,
  HEAT = 3,
  FAN = 4,
}

/**
 * Fan speed settings
 */
export enum FanSpeed {
  AUTO = 17,
  QUIET = 18,
  LEVEL_1 = 3,
  LEVEL_2 = 5,
  LEVEL_3 = 7,
  LEVEL_4 = 9,
  LEVEL_5 = 11,
}

/**
 * Swing settings
 */
export enum SwingMode {
  OFF = 0,
  ON = 1,
}

/**
 * AC unit state
 */
export interface ACState {
  /** Power state (0 = off, 1 = on) */
  power: number;
  /** Operating mode */
  mode: ACMode;
  /** Target temperature (16-32°C) */
  temperature: number;
  /** Fan speed */
  fan: FanSpeed;
  /** Horizontal swing */
  h_swing: SwingMode;
  /** Vertical swing */
  v_swing: SwingMode;
  /** Coanda effect */
  coanda: number;
  /** Economy mode */
  econo: number;
  /** Power chill mode */
  powerchill: number;
  /** Good sleep mode */
  good_sleep: number;
  /** Streamer mode */
  streamer: number;
  /** Outdoor unit quiet mode */
  out_quite: number;
  /** On timer set */
  on_timer_set: number;
  /** On timer value */
  on_timer_value: number;
  /** Off timer set */
  off_timer_set: number;
  /** Off timer value */
  off_timer_value: number;
  /** Sensor readings */
  sensors: {
    /** Room temperature */
    room_temp: number;
    /** Outdoor temperature */
    out_temp: number;
  };
  /** Reset reason */
  rst_r: number;
  /** Firmware version */
  fw_ver: string;
}

/**
 * Complete device response including port information
 */
export interface DeviceResponse {
  /** Port 1 state (main AC unit) */
  port1: ACState;
  /** Indoor unit identifier */
  idu: number;
}

/**
 * Discovery response from UDP broadcast
 */
export interface DiscoveryResponse {
  /** Device information */
  device: DaikinDevice;
  /** Raw response data */
  rawData: Buffer;
}

/**
 * Configuration for Daikin platform
 */
export interface DaikinPlatformConfig {
  /** Platform name */
  name: string;
  /** Secret key for device communication */
  secretKey: string;
  /** Discovery timeout in seconds */
  discoveryTimeout?: number;
  /** Status poll interval in seconds */
  pollInterval?: number;
}

/**
 * Message structure for Daikin communication
 */
export interface DaikinMessage {
  /** Initialization vector (16 bytes) */
  iv: Buffer;
  /** Encrypted payload */
  payload: Buffer;
  /** CRC16 checksum (2 bytes) */
  crc: Buffer;
}
