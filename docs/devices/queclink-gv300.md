# Queclink GV300 / @Track

**Sentinel status:** Catalog only. No @Track frame decoder, buffered-report
handling, or command adapter is enabled.

## Connection and format

| Property | Value |
|---|---|
| Transport | TCP, UDP, or SMS |
| Framing | Printable ASCII, comma-delimited, terminated by `$` |
| Uplink prefixes | `+RESP:` for live reports and `+BUFF:` for buffered reports |
| Command acknowledgement | `+SACK:` records |
| Commands | `AT+GT...=` ASCII configuration records |
| Platform representation | Normalized JSON after decoding |
| HTTP/XML | The device does not call an HTTP or XML API |

## Common reports

| Report | Meaning / important fields |
|---|---|
| `GTFRI` | Periodic/fixed report: protocol version, IMEI, fix, coordinates, speed, heading, altitude, cellular data, mileage, timestamp and serial. |
| `GTIGN` / `GTIGF` | Ignition-on / ignition-off transition and duration with position. |
| `GTTOW` | Tow/motion alarm. |
| `GTSOS` | SOS input alarm. |
| `GTGEO` | Geofence entry/exit event. |
| `GTVGN` / `GTVGF` | Virtual ignition transition on applicable configurations. |
| `GTINF` | Firmware, battery, external power, GSM and device/configuration information. |
| `+SACK:GT...` | Backend command acknowledgement, including command name/result and serial fields. |

Buffered (`+BUFF`) events must retain their device timestamp and should not make
an old position look current merely because it arrived later.

## Command reference

| Command family | Purpose | Sentinel status |
|---|---|---|
| `AT+GTFRI` | Configure periodic/time/distance position reporting. | Catalog only |
| `AT+GTINF` | Request device information/status report. | Catalog only, read-only |
| `AT+GTTOW` | Configure tow/motion detection. | Catalog only |
| `AT+GTGEO` | Configure geofence behavior. | Catalog only |
| `AT+GTSOS` | Configure SOS inputs/reporting. | Catalog only |
| `AT+GTOUT` | Control digital output. | **High risk; product-disabled** |
| `AT+GTRTO` | Reboot/reset operation selected by its parameter. | Disruptive; product-disabled |

Field counts and password/serial positions differ by protocol revision. Generate
commands only from an exact model/revision schema, never from this summary.

## Sources

- [Official Queclink GV300 series specification](https://cdn-s3.queclink.com/linkresource/file/GV300SeriesSpec20180907_1781785955189.pdf)
- [GV300 @Track Air Interface Protocol mirror](https://www.controlsatperu.com/Manuales/GV300%202/SMS%20comandos%20GV300%20quecklink.pdf)
