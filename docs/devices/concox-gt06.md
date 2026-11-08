# Concox / Jimi IoT GT06 family

**Sentinel status:** Catalog only. GT06 is a broad, cloned protocol family;
support must be enabled per identified model and firmware, not for the family
name as a whole.

## Connection and format

| Property | Value |
|---|---|
| Transport | Raw TCP |
| Framing | Binary short frames start `0x7878`; extended frames commonly start `0x7979` |
| Integrity | Length, protocol number, information serial number, CRC-ITU and stop bytes `0x0D0A` |
| Identity | IMEI encoded as BCD in login protocol `0x01` |
| Platform representation | Normalized JSON only after a model-specific decoder validates the packet |
| HTTP/XML | The tracker does not call an HTTP, JSON, or XML API |

## Common packet types

| Protocol number | Message | Meaning / fields |
|---|---|---|
| `0x01` | Login | BCD IMEI and serial; server returns a matching acknowledgement. |
| `0x12` and variants `0x10`, `0x11`, `0x22` | GPS/LBS location | UTC time, satellite count, coordinates, speed, course/status, MCC/MNC/LAC/cell data depending on variant. |
| `0x13` | Heartbeat/status | Terminal flags, voltage level, GSM signal, alarm/language, serial and CRC. |
| `0x16` / `0x26` | Alarm | Location plus SOS, power cut, vibration, geofence or other model-specific alarm state. |
| `0x80` / `0x81` / `0x82` | Command/response family | Server text command and terminal response containers; exact layouts vary. |

The server must acknowledge login, heartbeat, and alarm packets using the same
protocol number and information serial. Treat undocumented protocol numbers as
unknown until fixtures identify the specific variant.

## Common device command categories

| Category | Typical purpose | Sentinel status |
|---|---|---|
| Server/APN setup | Set host, port, APN and credentials. | Catalog only; model syntax varies |
| Reporting interval | Set timed/distance upload cadence. | Catalog only |
| Status/location query | Request tracker status or one position. | Catalog only |
| Overspeed/movement/geofence | Configure alarm thresholds. | Catalog only |
| Power-cut/relay control | Control a wired output/relay. | **High risk; product-disabled** |
| Reboot/reset | Restart or restore configuration. | Disruptive; product-disabled |

There is no safe universal SMS or backend command string for all “GT06” devices.
The exact manufacturer command manual must be attached to the model before a
command definition can move beyond catalog-only.

## Sources

- [GT06 GPS Tracker Communication Protocol v1.8.1 (protocol PDF hosted by Traccar)](https://www.traccar.org/protocol/5023-gt06/GT06_GPS_Tracker_Communication_Protocol_v1.8.1.pdf)
- [Traccar GT06 decoder implementation](https://github.com/traccar/traccar/blob/master/src/main/java/org/traccar/protocol/Gt06ProtocolDecoder.java)
