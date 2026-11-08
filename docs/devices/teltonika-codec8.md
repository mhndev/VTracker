# Teltonika Codec 8 / Codec 8 Extended

**Sentinel status:** Catalog only. No binary Teltonika decoder, session adapter,
or command channel is enabled.

## Connection and format

| Property | Value |
|---|---|
| Transport | Raw TCP or UDP |
| Identity | TCP session begins with a two-byte IMEI length and ASCII IMEI; server accepts with `0x01` |
| Telemetry | Binary Codec 8 (`0x08`) or Codec 8 Extended (`0x8E`) AVL packets |
| Commands | Codec 12 (`0x0C`) GPRS command/response records on compatible models |
| Optional JSON | Teltonika documents a separate Codec JSON mode for compatible devices |
| XML | Not part of the documented AVL codecs |

TCP AVL packets contain a zero preamble, data-field length, codec ID, record
count, AVL records, repeated record count, and CRC-16. Each AVL record contains
a timestamp, priority, GPS element, and IO elements. Codec 8 uses smaller IO ID
and count widths; Codec 8E expands them.

## Message reference

| Message | Meaning / key fields | Required server response |
|---|---|---|
| IMEI login | Identifies/authenticates the tracker session. | One byte: `0x01` accept or `0x00` reject. |
| Codec 8 AVL data | Timestamp, priority, longitude, latitude, altitude, angle, satellites, speed and sized IO groups. | Four-byte count of accepted records. |
| Codec 8E AVL data | Same core GPS data with extended IO identifiers/counts and variable-length values. | Four-byte count of accepted records. |
| Codec 12 command response | Text response transported inside a binary command record. | Codec-specific record acknowledgement. |
| Codec JSON | JSON envelope documented by Teltonika for configured devices. | Per Codec JSON session rules. |

IO element meanings are model/firmware-specific and must be resolved against
Teltonika’s AVL ID list; the numeric ID must also be preserved for unknown IO.

## Command reference

| Command | Transport | Purpose | Sentinel status |
|---|---|---|---|
| `getinfo` | Codec 12 command | Return device information and runtime status on supported models. | Catalog only |
| `getver` | Codec 12 command | Return firmware/model information on supported models. | Catalog only |
| `getstatus` | Codec 12 command | Return modem/GNSS/IO status where firmware supports it. | Catalog only |
| `setparam <id>:<value>` | Codec 12 command | Change a configuration parameter. Parameter IDs are model-specific. | Catalog only; configuration risk |
| `getparam <id>` | Codec 12 command | Read a configuration parameter. | Catalog only |

This is the common backend command set, not a universal promise across every
Teltonika model. Model documentation is authoritative.

## Primary sources

- [Teltonika Codec overview](https://wiki.teltonika-gps.com/view/Codec)
- [Teltonika data-sending protocols](https://wiki.teltonika-gps.com/view/Teltonika_Data_Sending_Protocols)
- [Teltonika Codec JSON](https://wiki.teltonika-gps.com/view/Codec_JSON)
- [Teltonika universal device test guide](https://wiki.teltonika-gps.com/view/Universal_Device_Test_Guide)
