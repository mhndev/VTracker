import type { DownlinkCommandType } from './types.js';

export interface CommandOptions {
  password?: string;
  movingSeconds?: string; // e.g. '020s'
  stoppedHours?: string;  // e.g. '002h'
  times?: string;         // e.g. '***n'
  sensitivityLevel?: 1 | 2 | 3;
  speedLimit?: number;    // e.g. 80
  moveRadius?: number;    // meters e.g. 200
  rawCommand?: string;
}

/**
 * Encodes a downlink command string for the Coban 303FG GPS Tracker.
 * Standard Coban commands are sent as ASCII strings terminated by newline or semicolon.
 */
export function encodeCobanCommand(
  type: DownlinkCommandType,
  options: CommandOptions = {}
): string {
  const pwd = options.password || '123456';

  let cmd = '';
  switch (type) {
    case 'STOP':
      // Delayed immobilizing: waits until speed < 20 km/h for safety
      cmd = `stop${pwd}`;
      break;

    case 'QUICKSTOP':
      // Immediate immobilizing: cuts relay immediately
      cmd = `quickstop${pwd}`;
      break;

    case 'RESUME':
      // Restore fuel and power relay
      cmd = `resume${pwd}`;
      break;

    case 'ARM':
      cmd = `arm${pwd}`;
      break;

    case 'SILENT':
      cmd = `silent${pwd}`;
      break;

    case 'DISARM':
      cmd = `disarm${pwd}`;
      break;

    case 'CHECK':
      cmd = `check${pwd}`;
      break;

    case 'POSITION':
      cmd = `position${pwd}`;
      break;

    case 'OIL_ZERO':
      cmd = `oilzero${pwd}`;
      break;

    case 'OIL_FULL':
      cmd = `oilfull${pwd}`;
      break;

    case 'FIX': {
      const moving = options.movingSeconds || '020s';
      const stopped = options.stoppedHours || '002h';
      const count = options.times || '***n';
      cmd = `fix${moving}${stopped}${count}${pwd}`;
      break;
    }

    case 'CUSTOM':
      cmd = options.rawCommand ? `${options.rawCommand}${pwd}` : `check${pwd}`;
      break;

    default:
      cmd = `check${pwd}`;
      break;
  }

  // Terminate with carriage-return and newline
  return `${cmd};\r\n`;
}
