import {
  DeviceCommandDefinition,
  DeviceMessageDefinition,
  DeviceProtocolProfile
} from '../models/index.js';

const profiles = [
  {
    id: 'protocol-coban-gps103', vendor: 'Shenzhen Coban Electronics', family: 'GPS103/303',
    displayName: 'Coban GPS103 / GPS303 ASCII', transport: 'TCP_UDP_SMS', frameFormat: 'ASCII_DELIMITED',
    implementationStatus: 'ACTIVE',
    identificationStrategy: {
      loginSignature: '^##,imei:(\\d+),A;', identifier: 'IMEI', acknowledgement: 'LOAD',
      firmwareQuery: '**,imei:{imei},vv;', firmwareResponseKeyword: 'vvt'
    },
    documentationUrl: 'https://www.scribd.com/document/998077724/GpsTracker-Terminal-and-Monitoring-Center-Communication-Protocol-Alphabet-Edition-Edition-3rd-Version-20231227',
    notes: 'Active adapter. Covers the current 303FG and compatible GPS103/TK103 ASCII variants.'
  },
  {
    id: 'protocol-teltonika-codec8', vendor: 'Teltonika Telematics', family: 'Codec 8 / Codec 8 Extended',
    displayName: 'Teltonika AVL Codec 8 / 8E', transport: 'TCP_UDP', frameFormat: 'BINARY_LENGTH_PREFIXED',
    implementationStatus: 'CATALOG_ONLY',
    identificationStrategy: {
      loginSignature: '2-byte IMEI length followed by ASCII IMEI', identifier: 'IMEI', acknowledgement: 'single byte 0x01',
      codecIds: ['0x08', '0x8E'], commandCodec: '0x0C'
    },
    documentationUrl: 'https://wiki.teltonika-gps.com/view/Teltonika_AVL_Protocols',
    notes: 'Catalogued from the manufacturer protocol documentation; binary runtime adapter is not enabled yet.'
  },
  {
    id: 'protocol-gt06', vendor: 'Concox / Jimi IoT and compatible vendors', family: 'GT06',
    displayName: 'GT06 binary family', transport: 'TCP', frameFormat: 'BINARY_HEADER_LENGTH_CRC',
    implementationStatus: 'CATALOG_ONLY',
    identificationStrategy: {
      loginSignature: '0x7878 or 0x7979 header with protocol 0x01', identifier: 'BCD IMEI',
      acknowledgement: 'protocol-specific serial acknowledgement', framingHeaders: ['7878', '7979']
    },
    documentationUrl: 'https://github.com/traccar/traccar/blob/master/src/main/java/org/traccar/protocol/Gt06ProtocolDecoder.java',
    notes: 'The family contains many vendor variants; model-specific capability flags are required before enabling commands.'
  },
  {
    id: 'protocol-queclink-gv300', vendor: 'Queclink Wireless Solutions', family: 'GV300 / @Track',
    displayName: 'Queclink GV300 @Track', transport: 'TCP_UDP_SMS', frameFormat: 'ASCII_COMMA_DELIMITED',
    implementationStatus: 'CATALOG_ONLY',
    identificationStrategy: {
      loginSignature: '+RESP:GT... or +BUFF:GT...', identifier: 'IMEI',
      acknowledgement: '+SACK:G... command acknowledgement', framingTerminator: '$'
    },
    documentationUrl: 'https://cdn-s3.queclink.com/linkresource/file/GV300SeriesSpec20180907_1781785955189.pdf',
    notes: 'Well-known fleet tracker family. Catalogued for planning; no @Track runtime decoder or command adapter is enabled.'
  }
] as const;

const messages = [
  ['coban-login', 'protocol-coban-gps103', 'LOGIN', 'Device login', 'UPLINK', 'IMEI authentication and session opening.', { regex: '^##,imei:(\\d+),A;' }, [{ name: 'imei', type: 'string' }], '##,imei:359586015829802,A;'],
  ['coban-heartbeat', 'protocol-coban-gps103', 'HEARTBEAT', 'Online heartbeat', 'BIDIRECTIONAL', 'Three-minute keepalive; server responds ON.', { regex: '^\\d{12,18};?$' }, [{ name: 'imei', type: 'string' }], '359586015829802'],
  ['coban-location', 'protocol-coban-gps103', 'LOCATION', 'GPS location', 'UPLINK', 'NMEA-style position, motion and vehicle state.', { keyword: 'tracker' }, [{ name: 'latitude', type: 'nmea' }, { name: 'longitude', type: 'nmea' }, { name: 'speed', unit: 'knots' }, { name: 'heading', unit: 'degrees' }], 'imei:...,tracker,...;'],
  ['coban-status', 'protocol-coban-gps103', 'STATUS_SYNC', 'Configuration synchronization', 'UPLINK', 'Reporting, alarm and vehicle-control configuration.', { keyword: 'status' }, [{ name: 'sleepMode' }, { name: 'movingIntervalSeconds' }, { name: 'stationaryIntervalSeconds' }, { name: 'armed' }, { name: 'speedAlarmKph' }], 'imei:...,status,0,10,3600,...;'],
  ['coban-device-info', 'protocol-coban-gps103', 'DEVICE_INFO', 'Model and firmware response', 'UPLINK', 'Response to the vv identification query.', { keyword: 'vvt' }, [{ name: 'firmwareVersion' }, { name: 'productId' }, { name: 'versionCode' }, { name: 'variantVersion' }], 'imei:...,vvt,<version>,<product>,<code>,<variant>;'],
  ['teltonika-login', 'protocol-teltonika-codec8', 'LOGIN', 'IMEI login', 'UPLINK', 'Two-byte length followed by the ASCII IMEI.', { binary: 'imei-length-prefix' }, [{ name: 'imei', type: 'ascii' }], null],
  ['teltonika-avl', 'protocol-teltonika-codec8', 'AVL_DATA', 'AVL telemetry packet', 'UPLINK', 'Codec 8 or Codec 8 Extended AVL records with GPS and IO elements.', { codecIds: [8, 142] }, [{ name: 'timestamp' }, { name: 'priority' }, { name: 'gps' }, { name: 'ioElements' }], null],
  ['gt06-login', 'protocol-gt06', 'LOGIN', 'GT06 login', 'UPLINK', 'BCD IMEI login using protocol number 0x01.', { protocolNumber: 1 }, [{ name: 'imei', type: 'bcd' }, { name: 'serial' }, { name: 'crc' }], null],
  ['gt06-gps', 'protocol-gt06', 'LOCATION', 'GT06 GPS/LBS location', 'UPLINK', 'Binary GPS and optional cell-tower location variants.', { protocolNumbers: [16, 17, 18, 34] }, [{ name: 'timestamp' }, { name: 'satellites' }, { name: 'latitude' }, { name: 'longitude' }, { name: 'speed' }, { name: 'courseStatus' }], null],
  ['gt06-status', 'protocol-gt06', 'STATUS', 'GT06 terminal status', 'UPLINK', 'Ignition, charging, blocked state, alarm, voltage and GSM signal.', { protocolNumber: 19 }, [{ name: 'terminalInfo' }, { name: 'voltage' }, { name: 'gsmSignal' }, { name: 'alarm' }], null]
  ,['gt06-heartbeat', 'protocol-gt06', 'HEARTBEAT', 'GT06 heartbeat', 'BIDIRECTIONAL', 'Periodic terminal status heartbeat; the server returns a matching serial acknowledgement.', { protocolNumber: 19 }, [{ name: 'terminalInfo' }, { name: 'voltage' }, { name: 'gsmSignal' }, { name: 'serial' }, { name: 'crc' }], null]
  ,['gt06-alarm', 'protocol-gt06', 'ALARM', 'GT06 alarm packet', 'BIDIRECTIONAL', 'GPS/LBS data plus alarm and terminal status; common variants use protocol 0x16 or 0x26.', { protocolNumbers: [22, 38] }, [{ name: 'gps' }, { name: 'lbs' }, { name: 'terminalInfo' }, { name: 'alarm' }, { name: 'serial' }], null]
  ,['queclink-position', 'protocol-queclink-gv300', 'LOCATION', 'Periodic/fixed position report', 'UPLINK', 'GTFRI reports time, fix, coordinates, speed, heading, altitude, cellular data, mileage and device state.', { prefixes: ['+RESP:GTFRI', '+BUFF:GTFRI'] }, [{ name: 'imei' }, { name: 'timestamp' }, { name: 'latitude' }, { name: 'longitude' }, { name: 'speedKph' }, { name: 'heading' }, { name: 'mileage' }], '+RESP:GTFRI,...$']
  ,['queclink-ignition', 'protocol-queclink-gv300', 'IGNITION', 'Ignition state report', 'UPLINK', 'GTIGN and GTIGF indicate ignition-on and ignition-off transitions.', { prefixes: ['+RESP:GTIGN', '+RESP:GTIGF'] }, [{ name: 'imei' }, { name: 'ignitionOn' }, { name: 'duration' }, { name: 'gps' }, { name: 'timestamp' }], '+RESP:GTIGN,...$']
  ,['queclink-alarm', 'protocol-queclink-gv300', 'ALARM', 'Motion, tow, SOS and geofence reports', 'UPLINK', 'Event reports include GTTOW, GTSOS, GTGEO, GTVGN/GTVGF and related model-dependent alarms.', { prefixes: ['+RESP:GTTOW', '+RESP:GTSOS', '+RESP:GTGEO', '+RESP:GTVGN', '+RESP:GTVGF'] }, [{ name: 'imei' }, { name: 'event' }, { name: 'gps' }, { name: 'timestamp' }], '+RESP:GTTOW,...$']
  ,['queclink-device-info', 'protocol-queclink-gv300', 'DEVICE_INFO', 'Device information response', 'UPLINK', 'GTINF reports firmware, battery, external power, GSM and configuration state.', { prefixes: ['+RESP:GTINF'] }, [{ name: 'imei' }, { name: 'firmware' }, { name: 'batteryPercent' }, { name: 'externalPower' }, { name: 'gsmSignal' }], '+RESP:GTINF,...$']
  ,['queclink-command-ack', 'protocol-queclink-gv300', 'COMMAND_ACK', 'Command acknowledgement', 'UPLINK', 'SACK frames confirm accepted backend configuration commands.', { prefixes: ['+SACK:'] }, [{ name: 'command' }, { name: 'result' }, { name: 'serial' }], '+SACK:GTCFG,...$']
] as const;

const commands = [
  ['coban-version', 'protocol-coban-gps103', 'DEVICE_INFO', 'Request model and firmware', 'Ask the tracker for version, product and firmware identifiers.', '**,imei:{imei},vv;\r\n', { keyword: 'vvt' }, {}, 'READ_ONLY', 'ACTIVE'],
  ['coban-position', 'protocol-coban-gps103', 'POSITION', 'Request current location', 'Ask for a single GPS position.', 'position{password};\r\n', { keyword: 'tracker' }, {}, 'READ_ONLY', 'ACTIVE'],
  ['coban-check', 'protocol-coban-gps103', 'CHECK', 'Request hardware status', 'Ask for battery, GPS, GSM, GPRS and network status.', 'check{password};\r\n', { contains: ['Power:', 'GPRS:', 'GPS:'] }, {}, 'READ_ONLY', 'ACTIVE'],
  ['coban-fix', 'protocol-coban-gps103', 'FIX', 'Set reporting intervals', 'Configure moving and stationary reporting intervals.', 'fix{moving}{stopped}{times}{password};\r\n', { keyword: 'fix' }, { moving: 'duration', stopped: 'duration', times: 'count' }, 'CONFIGURATION', 'ACTIVE'],
  ['coban-stop', 'protocol-coban-gps103', 'STOP', 'Safe immobilization', 'Cut the fuel relay after the vehicle slows below the safe threshold.', 'stop{password};\r\n', { contains: ['stop ok'] }, {}, 'HIGH_RISK', 'DISABLED'],
  ['coban-resume', 'protocol-coban-gps103', 'RESUME', 'Restore fuel supply', 'Restore the fuel and power relay.', 'resume{password};\r\n', { contains: ['resume ok'] }, {}, 'HIGH_RISK', 'DISABLED'],
  ['teltonika-getinfo', 'protocol-teltonika-codec8', 'GET_INFO', 'Request device information', 'Codec 12 command used by supported Teltonika models to return device information.', 'getinfo', { codec: 12 }, {}, 'READ_ONLY', 'CATALOG_ONLY'],
  ['gt06-command', 'protocol-gt06', 'VENDOR_COMMAND', 'Vendor text command', 'GT06 command packets vary by manufacturer and model; enable only after model identification.', null, { protocolNumbers: [128, 129, 130] }, {}, 'CONFIGURATION', 'CATALOG_ONLY']
  ,['queclink-report', 'protocol-queclink-gv300', 'REPORTING', 'Configure periodic reports', 'Configure GTFRI time/distance reporting using AT+GTFRI.', 'AT+GTFRI=<password>,<parameters>$', { prefix: '+SACK:GTFRI' }, { parameters: 'model-specific comma-separated fields' }, 'CONFIGURATION', 'CATALOG_ONLY']
  ,['queclink-info', 'protocol-queclink-gv300', 'GET_INFO', 'Request device information', 'Request the device information report with AT+GTINF.', 'AT+GTINF=<password>,<parameters>$', { prefix: '+RESP:GTINF' }, {}, 'READ_ONLY', 'CATALOG_ONLY']
  ,['queclink-reboot', 'protocol-queclink-gv300', 'REBOOT', 'Restart device', 'Restart the tracker. Exact parameters depend on firmware.', 'AT+GTRTO=<password>,3,,,,,,<serial>$', { prefix: '+SACK:GTRTO' }, {}, 'DISRUPTIVE', 'CATALOG_ONLY']
  ,['queclink-output', 'protocol-queclink-gv300', 'DIGITAL_OUTPUT', 'Control digital output', 'Set a digital output. Wiring and safe-use policy must be verified per installation.', 'AT+GTOUT=<password>,<parameters>$', { prefix: '+SACK:GTOUT' }, { parameters: 'model-specific output configuration' }, 'HIGH_RISK', 'CATALOG_ONLY']
] as const;

export async function seedProtocolCatalog(): Promise<void> {
  for (const profile of profiles) await DeviceProtocolProfile.upsert(profile);
  for (const [id, protocolProfileId, messageType, displayName, direction, description, matcher, fieldSchema, example] of messages) {
    await DeviceMessageDefinition.upsert({ id, protocolProfileId, messageType, displayName, direction, description, matcher, fieldSchema, example });
  }
  for (const [id, protocolProfileId, commandKey, displayName, description, wireTemplate, responseMatcher, optionsSchema, riskLevel, implementationStatus] of commands) {
    await DeviceCommandDefinition.upsert({ id, protocolProfileId, commandKey, displayName, description, wireTemplate, responseMatcher, optionsSchema, riskLevel, implementationStatus });
  }
}
