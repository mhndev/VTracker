# Coban GPS103 / GPS303

**Sentinel status:** Active. This is the only device family supported by the
current runtime gateway. The active adapter targets the GPS303FG and compatible
GPS103/TK103 “alphabet edition” ASCII variants; firmware differences still need
to be verified per installation.

## Connection and format

| Property | Value |
|---|---|
| Transport | Raw TCP or UDP over GPRS; SMS for device administration |
| Framing | ASCII records, normally comma-delimited and terminated by `;` |
| Identity | IMEI in login and report frames |
| Login | `##,imei:<imei>,A;` |
| Server acknowledgement | `LOAD` for login; `ON` for heartbeat |
| Platform representation | Normalized JSON after the gateway decodes the ASCII frame |
| HTTP/XML | The tracker does not call an HTTP or XML API |

## Messages accepted by Sentinel

| Message | Recognizer | Meaning / decoded fields |
|---|---|---|
| Login | `##,imei:<imei>,A;` | Opens the device session and identifies the IMEI. |
| Heartbeat | IMEI-only frame | Keeps the session fresh; server replies `ON`. |
| Location | `imei:<imei>,tracker,...;` | NMEA coordinates, UTC time, validity, speed in knots, heading, ignition/door/power/fuel state when supplied by the variant. |
| Status sync | `imei:<imei>,status,...;` | Sleep mode, moving/stationary reporting intervals, armed state, speed alarm and related configuration. |
| Device information | `imei:<imei>,vvt,...;` | Firmware version, product/model identifier, protocol/version codes. |

The gateway preserves the raw inbound/outbound record in device logs and stores
decoded fields separately. Unknown fields are retained in the human-readable
details instead of being silently discarded.

## Command reference

| Command | Wire form | Purpose | Product status |
|---|---|---|---|
| Device information | `**,imei:{imei},vv;` | Request model, protocol and firmware information. | Read-only adapter function |
| Current position | `position{password};` | Request one immediate location report. | Read-only adapter function |
| Hardware check | `check{password};` | Request power, battery, GSM/GPRS and GPS status. | Read-only adapter function |
| Reporting interval | `fix{moving}{stopped}{times}{password};` | Configure moving/stationary report cadence and repeat count. | Configuration; policy-controlled |
| Immobilize | `stop{password};` | Ask a compatible wired relay to interrupt fuel/power after its safe-speed condition. | **High risk; product-disabled** |
| Resume | `resume{password};` | Restore a compatible relay output. | **High risk; product-disabled** |

Passwords are redacted in stored and returned logs. Do not assume a command is
safe merely because a device acknowledges it.

## Sources and limitations

- The catalog’s protocol reference is the *GPS Tracker Terminal and Monitoring
  Center Communication Protocol — Alphabet Edition, 3rd edition* (vendor-family
  document; mirrored at the URL stored in `device_protocol_profiles`).
- Coban-compatible products frequently reuse names while changing firmware and
  field order. Confirm captured frames and device wiring before provisioning.
