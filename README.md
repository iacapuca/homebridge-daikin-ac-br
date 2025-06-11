<p align="center">

<img src="https://github.com/homebridge/branding/raw/latest/logos/homebridge-wordmark-logo-vertical.png" width="150">

</p>

<span align="center">

# Homebridge Daikin AC Brazil

</span>

A Homebridge plugin for controlling Daikin Split EcoSwing Smart R-32 and Split EcoSwing Smart Gold R-32 air conditioners in the Brazilian market.

This plugin is based on the reverse engineering work from [crossworth/daikin](https://github.com/crossworth/daikin) and provides native HomeKit integration for Daikin smart AC units.

## Features

- **Automatic Device Discovery**: Finds Daikin AC units on your local network
- **Complete AC Control**: Power, temperature, mode (cool/heat/auto), and fan speed
- **Real-time Status**: Displays current temperature and operating state
- **HomeKit Integration**: Works with Apple Home, Siri, and other HomeKit apps
- **Local Communication**: Direct communication with AC units (no cloud required)

## Compatible Devices

This plugin should work with all Daikin AC units that use the **Daikin Smart AC - Brasil** mobile app, including:

### Daikin Split EcoSwing Smart R-32
- FTKP09Q5VL, FTKP12Q5VL, FTKP18Q5VL, FTKP24Q5VL
- FTHP09Q5VL, FTHP12Q5VL, FTHP18Q5VL, FTHP24Q5VL

### Daikin Split EcoSwing Smart Gold R-32
- FTKP09S5VL, FTKP12S5VL, FTKP18S5VL, FTKP24S5VL
- FTHP09S5VL, FTHP12S5VL, FTHP18S5VL, FTHP24S5VL

## Prerequisites

1. **Daikin AC Setup**: Your AC unit must be configured and working with the official Daikin Smart AC - Brasil app
2. **Secret Key**: You need to extract the secret key from your Daikin account
3. **Network**: Your Homebridge server and AC units must be on the same local network

## Getting Your Secret Key

The secret key is generated when you set up your AC unit with the official app. You can extract it using one of these methods:

### Method 1: Online Service (Recommended)
Visit [https://daikin-extract-secret-key.fly.dev/](https://daikin-extract-secret-key.fly.dev/) and enter your Daikin app credentials. This service runs the same code as this plugin and doesn't store your information.

### Method 2: Manual Extraction
If you're comfortable with network analysis, you can inspect the HTTP requests made by the official app to the endpoint `https://dmb.iotalabs.co.in/devices/thinginfo/managething`.

## Installation

### Via Homebridge UI (Recommended)
1. Open the Homebridge UI
2. Go to the "Plugins" tab
3. Search for "homebridge-daikin-ac-br"
4. Click "Install"

### Via Command Line
```bash
npm install -g homebridge-daikin-ac-br
```

## Configuration

Add the platform to your Homebridge `config.json`:

```json
{
  "platforms": [
    {
      "name": "Daikin AC Brazil",
      "secretKey": "your-secret-key-here",
      "discoveryTimeout": 10,
      "pollInterval": 30,
      "platform": "DaikinACBrazil"
    }
  ]
}
```

### Configuration Options

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `name` | Yes | - | Name for the platform |
| `secretKey` | Yes | - | Your Daikin secret key |
| `discoveryTimeout` | No | 10 | Device discovery timeout (seconds) |
| `pollInterval` | No | 30 | Status polling interval (seconds) |

## Usage

Once configured, the plugin will:

1. **Discover** all Daikin AC units on your network
2. **Register** them as HeaterCooler accessories in HomeKit
3. **Poll** for status updates at the configured interval

### HomeKit Controls

- **Power**: Turn AC on/off
- **Mode**: Auto, Cool, Heat
- **Temperature**: Set target temperature (16-32°C)
- **Fan Speed**: 5 levels plus auto and quiet modes
- **Current Temperature**: Displays room temperature from AC sensor

## Troubleshooting

### No Devices Found
- Ensure your AC units are powered on and connected to WiFi
- Check that Homebridge and AC units are on the same network
- Verify the secret key is correct
- Try increasing the discovery timeout

### Connection Issues
- Check network connectivity between Homebridge and AC units
- Ensure no firewall is blocking communication on port 15914
- Verify AC units are responding to the official app

### Performance Issues
- Increase the poll interval to reduce network traffic
- Check for network congestion or interference

## Development

This plugin is based on the excellent reverse engineering work by [crossworth](https://github.com/crossworth/daikin). The implementation includes:

- **Device Discovery**: UDP broadcast to find AC units
- **Encryption**: AES-256-CFB encryption for secure communication
- **Protocol**: Custom message format with CRC16 checksums
- **HTTP Client**: Non-standard HTTP implementation for AC communication

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

## License

This project is licensed under the Apache License 2.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [crossworth/daikin](https://github.com/crossworth/daikin) - Original reverse engineering work
- [Homebridge](https://homebridge.io/) - HomeKit integration platform
- Daikin - For making great AC units (even if the app could be better 😉)
