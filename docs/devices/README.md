# Device protocol catalog

This directory is the human-readable companion to the `device_protocol_profiles`,
`device_message_definitions`, `device_command_definitions`, and
`reseller_device_protocol_availability` database tables.

## Support matrix

| Family | Typical transport | Device payload | Runtime support |
|---|---|---|---|
| [Coban GPS103 / GPS303](coban-gps103-303.md) | TCP, UDP, SMS | Delimited ASCII | **Active — the only supported family today** |
| [Teltonika Codec 8 / 8E](teltonika-codec8.md) | TCP or UDP | Length-prefixed binary; optional Codec JSON on supported devices | Catalog only |
| [Concox/Jimi GT06](concox-gt06.md) | TCP | Header/length/CRC binary | Catalog only |
| [Queclink GV300 / @Track](queclink-gv300.md) | TCP, UDP, SMS | Comma-delimited ASCII | Catalog only |

“Catalog only” means that documentation is available for planning and device
selection. It does **not** mean Sentinel can ingest the protocol or send its
commands. A runtime decoder, test vectors, acknowledgement handling, and a
security review are required before changing a profile to `ACTIVE`.

## API terminology

The trackers normally do not call an HTTP JSON/XML API. They open a raw TCP or
UDP socket (or use SMS) and send vendor-specific frames. Sentinel decodes a
supported frame and exposes normalized JSON through its authenticated REST API.
XML is not used by any family in the current catalog.

Command tables are protocol references, not a promise that remote commands are
enabled. High-risk output, relay, immobilization, and reset operations remain
blocked by the platform safety policy.

## Keeping the catalog accurate

1. Record a manufacturer or protocol reference URL in every profile.
2. Add every message/command exposed in the admin UI to the matching document.
3. Treat model and firmware variations as separate capability decisions.
4. Never mark a family active based only on compatible-looking packets.
5. Add decoder fixtures and integration tests before enabling a new adapter.
