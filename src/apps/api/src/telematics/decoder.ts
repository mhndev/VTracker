import type { CobanAlarmData, CobanAlarmType, CobanLocationData, ParsedPacket } from './types.js';

/**
 * Converts NMEA latitude (ddmm.mmmm) + hemisphere (N/S) to signed decimal degrees.
 * Example: "5230.1234", "N" -> 52 + 30.1234/60 = 52.502057
 */
export function nmeaToDecimalLat(val: string, hem: string): number {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  const degrees = Math.floor(num / 100);
  const minutes = num - (degrees * 100);
  let dec = degrees + (minutes / 60);
  if (hem?.toUpperCase() === 'S') dec = -dec;
  return Number(dec.toFixed(6));
}

/**
 * Converts NMEA longitude (dddmm.mmmm) + hemisphere (E/W) to signed decimal degrees.
 * Example: "01323.5678", "E" -> 13 + 23.5678/60 = 13.392797
 */
export function nmeaToDecimalLon(val: string, hem: string): number {
  const num = parseFloat(val);
  if (isNaN(num)) return 0;
  const degrees = Math.floor(num / 100);
  const minutes = num - (degrees * 100);
  let dec = degrees + (minutes / 60);
  if (hem?.toUpperCase() === 'W') dec = -dec;
  return Number(dec.toFixed(6));
}

/**
 * Converts speed in knots to kilometers per hour.
 * 1 knot = 1.852 km/h
 */
export function knotsToKph(knotsStr: string): number {
  const knots = parseFloat(knotsStr);
  if (isNaN(knots)) return 0;
  return Number((knots * 1.852).toFixed(1));
}

/**
 * Parses YYMMDD and HHMMSS (or HHMMSS.sss) into a UTC Date.
 */
export function parseCobanDateTime(dateStr: string, timeStr: string): Date {
  try {
    if (!dateStr || dateStr.length < 6 || !timeStr || timeStr.length < 6) {
      return new Date();
    }
    const year = 2000 + parseInt(dateStr.slice(0, 2), 10);
    const month = parseInt(dateStr.slice(2, 4), 10) - 1;
    const day = parseInt(dateStr.slice(4, 6), 10);

    const hour = parseInt(timeStr.slice(0, 2), 10);
    const min = parseInt(timeStr.slice(2, 4), 10);
    const sec = parseInt(timeStr.slice(4, 6), 10);

    const d = new Date(Date.UTC(year, month, day, hour, min, sec));
    return isNaN(d.getTime()) ? new Date() : d;
  } catch {
    return new Date();
  }
}

/**
 * Parses status bitmask string from Coban payload (e.g. "10010000").
 * Bit 0: ACC (1=ON, 0=OFF)
 * Bit 1: Armed (1=Armed, 0=Disarmed)
 * Bit 2: Immobilized (1=Fuel cut, 0=Normal)
 * Bit 3: External Power (1=Connected, 0=Disconnected)
 * Bit 4: Door (1=Open, 0=Closed)
 */
export function parseStatusMask(maskStr: string | undefined): {
  ignitionOn: boolean;
  armed: boolean;
  immobilized: boolean;
  externalPower: boolean;
  doorOpen: boolean;
} {
  if (!maskStr || typeof maskStr !== 'string') {
    return {
      ignitionOn: true,
      armed: false,
      immobilized: false,
      externalPower: true,
      doorOpen: false
    };
  }

  const chars = maskStr.padEnd(8, '0');
  return {
    ignitionOn: chars[0] === '1',
    armed: chars[1] === '1',
    immobilized: chars[2] === '1',
    externalPower: chars[3] !== '0', // Defaults to true unless explicitly '0'
    doorOpen: chars[4] === '1'
  };
}

/**
 * Maps alarm tags to internal alarm types.
 */
export function mapAlarmType(tag: string): CobanAlarmType | null {
  const lower = (tag || '').toLowerCase().trim();
  if (lower.includes('help') || lower.includes('sos')) return 'SOS';
  if (lower.includes('acc alarm') || lower.includes('acc on')) return 'ACC_ALARM';
  if (lower.includes('door alarm')) return 'DOOR_ALARM';
  if (lower.includes('sensor alarm') || lower.includes('shock')) return 'SENSOR_ALARM';
  if (lower.includes('low battery')) return 'LOW_BATTERY';
  if (lower.includes('power off') || lower.includes('power cut') || lower.includes('extpower')) return 'POWER_OFF';
  if (lower.includes('speed')) return 'OVERSPEED';
  if (lower.includes('move')) return 'MOVEMENT';
  if (lower.includes('oil')) return 'FUEL_THEFT';
  return null;
}

/**
 * Parses a single raw ASCII frame received from the tracker.
 */
export function decodeCobanPacket(rawFrame: string, activeImei?: string): ParsedPacket {
  const trimmed = rawFrame.trim();
  if (!trimmed) return { type: 'UNKNOWN', raw: rawFrame };

  // 1. Handshake Login Packet: ##,imei:358123049582103,A;
  const loginMatch = trimmed.match(/^##,imei:(\d+),A/i);
  if (loginMatch && loginMatch[1]) {
    return { type: 'LOGIN', imei: loginMatch[1], raw: trimmed };
  }

  // 2. Heartbeat Packet: ##,imei:358123049582103,B;
  const heartbeatMatch = trimmed.match(/^##,imei:(\d+),B/i);
  if (heartbeatMatch && heartbeatMatch[1]) {
    return { type: 'HEARTBEAT', imei: heartbeatMatch[1], raw: trimmed };
  }

  // 3. Command Responses e.g. "stop ok", "resume ok", "Tracker is activated"
  const responseKeywords = [
    'ok', 'stop ok', 'quickstop ok', 'resume ok', 'silent ok',
    'tracker is activated', 'tracker is deactivated',
    'set up fail', 'password ok', 'admin ok', 'begin ok', 'gprs ok', 'tcp ok', 'battery:'
  ];
  const isCommandResponse = responseKeywords.some(keyword => trimmed.toLowerCase().includes(keyword));
  if (isCommandResponse && !trimmed.startsWith('imei:') && !trimmed.startsWith('##')) {
    return { type: 'COMMAND_RESPONSE', imei: activeImei, response: trimmed, raw: trimmed };
  }

  // 4. Coban 303 standard telemetry / position frame:
  // Format: imei:358123049582103,tracker,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,024.5,180.0,0.00,00000000...
  if (trimmed.startsWith('imei:')) {
    const parts = trimmed.split(',');
    if (parts[0] && parts[1]?.trim().toLowerCase() === 'vvt') {
      return {
        type: 'DEVICE_INFO',
        imei: parts[0].replace(/^imei:/i, '').trim(),
        firmwareVersion: parts[2]?.trim() || undefined,
        detectedModel: parts[3]?.trim() || undefined,
        protocolVersion: parts[4]?.trim() || undefined,
        variantVersion: parts[5]?.replace(/;$/, '').trim() || undefined,
        raw: trimmed
      };
    }
    if (parts.length >= 12 && parts[0]) {
      const imei = parts[0].replace('imei:', '').trim();
      const alarmTag = parts[1]?.trim() || 'tracker';

      // Telemetry fields
      const datePart = parts[2]?.trim() || '';
      const timePart = parts[5]?.trim() || '';
      const fixStatus = parts[6]?.trim().toUpperCase() || 'A';
      const rawLat = parts[7]?.trim() || '';
      const latHem = parts[8]?.trim() || 'N';
      const rawLon = parts[9]?.trim() || '';
      const lonHem = parts[10]?.trim() || 'E';
      const speedKnots = parts[11]?.trim() || '0';
      const headingDeg = parseFloat(parts[12]?.trim() || '0') || 0;
      const fuelVal = parseFloat(parts[13]?.trim() || '0') || 0;
      const statusMask = parts[14]?.trim() || '10010000';

      // Some 303FG status/diagnostic frames also start with "imei:" and contain
      // enough comma-separated fields to resemble telemetry. Reject those before
      // positional parsing so they cannot overwrite a real GPS fix.
      const hasTelemetryShape = /^\d{6}/.test(datePart)
        && /^\d{6}(?:\.\d+)?$/.test(timePart)
        && /^[AV]$/.test(fixStatus)
        && /^\d{4}\.\d+$/.test(rawLat)
        && /^[NS]$/.test(latHem.toUpperCase())
        && /^\d{5}\.\d+$/.test(rawLon)
        && /^[EW]$/.test(lonHem.toUpperCase());
      if (!hasTelemetryShape) return { type: 'UNKNOWN', raw: trimmed };

      const validFix = fixStatus === 'A';
      const latitude = nmeaToDecimalLat(rawLat, latHem);
      const longitude = nmeaToDecimalLon(rawLon, lonHem);
      const speedKph = knotsToKph(speedKnots);
      const occurredAt = parseCobanDateTime(datePart.slice(0, 6), timePart);
      const flags = parseStatusMask(statusMask);

      // Map fuel sensor (0-5V -> 0-100%)
      const fuelPercent = Number(Math.min(100, Math.max(0, (fuelVal / 5.0) * 100)).toFixed(1));

      const locationData: CobanLocationData = {
        imei,
        occurredAt,
        validFix,
        latitude,
        longitude,
        speedKph,
        heading: headingDeg,
        fuelVoltage: fuelVal,
        fuelPercent,
        ignitionOn: flags.ignitionOn,
        doorOpen: flags.doorOpen,
        externalPower: flags.externalPower,
        armed: flags.armed,
        immobilized: flags.immobilized,
        rawStatusMask: statusMask
      };

      const alarmType = mapAlarmType(alarmTag);
      if (alarmType) {
        return {
          type: 'ALARM',
          data: {
            imei,
            alarmType,
            rawAlarmTag: alarmTag,
            occurredAt,
            location: locationData
          },
          raw: trimmed
        };
      }

      return { type: 'LOCATION', data: locationData, raw: trimmed };
    }
  }

  // 5. TK103 legacy format fallback:
  // e.g. (013612345678BP05261107A5230.1234N01323.5678E024.5100532180.0000000000L00000000)
  const tk103Match = trimmed.match(/(\d{11,15})BP05(\d{6})([AV])(\d{4}\.\d{4})([NS])(\d{5}\.\d{4})([EW])(\d{3}\.\d)(\d{6})(\d{3}\.\d)/i);
  if (tk103Match && tk103Match[1] && tk103Match[2] && tk103Match[3] && tk103Match[4] && tk103Match[5] && tk103Match[6] && tk103Match[7] && tk103Match[8] && tk103Match[9] && tk103Match[10]) {
    const [, imei, dateStr, fix, latVal, latHem, lonVal, lonHem, speedKnots, timeStr, headingStr] = tk103Match;
    const locationData: CobanLocationData = {
      imei: imei || '',
      occurredAt: parseCobanDateTime(dateStr || '', timeStr || ''),
      validFix: (fix || '').toUpperCase() === 'A',
      latitude: nmeaToDecimalLat(latVal || '', latHem || 'N'),
      longitude: nmeaToDecimalLon(lonVal || '', lonHem || 'E'),
      speedKph: knotsToKph(speedKnots || '0'),
      heading: parseFloat(headingStr || '0') || 0,
      ignitionOn: true,
      doorOpen: false,
      externalPower: true,
      armed: false,
      immobilized: false
    };
    return { type: 'LOCATION', data: locationData, raw: trimmed };
  }

  return { type: 'UNKNOWN', raw: trimmed };
}
