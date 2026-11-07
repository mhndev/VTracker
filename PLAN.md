# GPS Tracker 303FG-2-V3.4 Implementation Plan

This plan details the full implementation of the **GPS Tracker 303FG-2-V3.4 GPS Locator (Coban GPS303FG / BAANOOL IOT)** telematics gateway and its integration into the **Sentinel Fleet Platform**, using an **ngrok TCP tunnel** for local development and real hardware communication.

---

## 1. Hardware & Feature Overview

Based on the official manual (`GPS Tracker 303FG-2-V3.4`), the device provides the following hardware specifications, wiring capabilities, and communication features:

### 1.1 Technical Specifications
- **Model**: 303FG-2-V3.4 (Coban GPS 303FG)
- **Cellular Radio**: GSM / GPRS quad-band (850 / 900 / 1800 / 1900 MHz)
- **Positioning**: GPS sensitivity -165 dBm, 5 m accuracy, cold start 45s, warm 35s, hot 1s
- **Power Supply**: 12V–24V DC vehicle main power + internal rechargeable 3.7V 350 mAh Li-ion backup battery
- **Storage**: Internal flash + optional MicroSD expansion for offline buffered tracks

### 1.2 12-PIN Wiring Harness & Physical Signals
| Pin Wire Color | Function | Description / Circuit Connection |
|---|---|---|
| **Red** | Power (+) | Connects to vehicle battery 12V–24V (with 3A inline fuse) |
| **Black** | Power (-) | Connects to vehicle chassis / ground |
| **White** | ACC (Ignition) | Ignition detection signal (detects Engine ON vs Engine OFF) |
| **Green** | Door Trigger (+) | Positive trigger door switch input |
| **Blue** | Door Trigger (-) | Negative trigger door switch input |
| **Pink** | Siren Output (+) | Connects to vehicle alarm siren / horn (beeps on arm/tamper) |
| **Yellow** | Relay Control | Connects to fuel pump / engine starter relay to cut fuel/power |
| **Brown & White/Black** | Fuel Sensor | Analog input (0–5V) for fuel level monitoring |
| **Orange** | Microphone (MIC) | External audio pickup for remote listening |
| **Violet** | SOS Button | Hidden panic button (press for 3 seconds triggers SOS alarm) |

### 1.3 Device Status Indicators (LEDs)
- **Red LED (Power / Charging)**:
  - Solid ON: Internal battery charging
  - OFF: Fully charged
  - Fast flash: Low battery warning (< 3.55V)
- **Green LED (GSM / GPRS)**:
  - 1s flash: GSM network connected (SMS mode)
  - 3s flash: GPRS data mode active (connected to telematics server)
  - Solid ON: No GSM cellular signal
- **Blue LED (GPS Fix)**:
  - 1s flash: Normal GPS fix acquired
  - 3 flashes/sec: Very strong GPS fix
  - OFF: GPS signal lost / searching satellites

### 1.4 Functions to Implement in Software
1. **Real-Time GPS Location Tracking**:
   - Automatic continuous location reporting (e.g. 10s–30s when moving, 1h when stopped).
   - Coordinate conversion (Degrees + Decimal Minutes `ddmm.mmmm` -> Decimal Degrees).
   - Speed calculation (Knots -> km/h) and heading direction (0°–360°).
   - GPS fix validation (`A` = Valid, `V` = Invalid/Void).
2. **Vehicle State & Telemetry Monitoring**:
   - **Ignition Status (ACC)**: Real-time Engine ON / Engine OFF detection.
   - **Door State**: Door opened / closed.
   - **Main Power State**: External 12V/24V power connected vs disconnected.
   - **Backup Battery**: Battery percentage and low-voltage alerts.
   - **Fuel Level**: Analog fuel sensor input (0–5V) mapped to 0%–100% capacity.
3. **Security, Arming & Alarm System**:
   - **Arm / Silent Arm / Disarm**: Remote command and remote control support.
   - **Door Open Alarm**: Triggered when door opens while armed.
   - **ACC Ignition Alarm**: Triggered when engine starts while armed.
   - **Shock / Vibration Alarm**: 3 sensitivity levels with 3-minute cooldown.
   - **SOS Alarm**: 3s emergency panic button trigger.
   - **External Power Disconnection Alarm**: Main battery cut alert.
   - **Low Battery Alarm**: 3.55V threshold alert.
   - **Over-Speed Alarm**: Speed limit exceeded alert.
   - **Movement / Geofence Alarm**: Drift radius exceeded alert.
   - **Fuel Theft / Leakage Alarm**: Abnormal drop in fuel level.
4. **Remote Downlink Controls**:
   - **Engine Immobilizer (Fuel & Power Cut)**:
     - `stop`: Delayed cut (triggers once vehicle speed drops below 20 km/h for safety).
     - `quickstop`: Immediate cut.
     - `resume`: Restore fuel pump and engine power.
   - **Arming Control**: `arm`, `silent`, `disarm`.
   - **Tracking Schedule**: `fix+020s+002h+***n+password` / `nofix`.
   - **Fuel Tank Calibration**: `oilzero` (calibrate 0%) and `oilfull` (calibrate 100%).
   - **Diagnostics & Status Queries**: `check`, `imei`, `position`.

---

## 2. ngrok TCP Tunneling Architecture

Because cellular GPRS trackers cannot reach private local network addresses (`127.0.0.1` or `localhost`), an **ngrok TCP tunnel** acts as a public ingress relay to your local development machine:

```
+------------------------------------+
| GPS Tracker 303FG (SIM Card)       |
| GPRS TCP Client                    |
+------------------+-----------------+
                   |
                   | 2G / GPRS Cellular Network
                   v
+------------------------------------+
| ngrok Cloud Relay                  |
| e.g. 0.tcp.ngrok.io:14822          |
+------------------+-----------------+
                   |
                   | Secure TCP Tunnel
                   v
+------------------------------------+
| Local Laptop                       |
| ngrok agent forwarding to:         |
| 127.0.0.1:8090                     |
+------------------+-----------------+
                   |
                   v
+------------------------------------+
| Sentinel Coban TCP Server          |
| Ingestion & Command Engine         |
+------------------------------------+
```

### 2.1 Starting ngrok TCP Tunnel
```bash
ngrok tcp 8090
```
This outputs a public endpoint, for example:
```text
Forwarding   tcp://0.tcp.ngrok.io:14822 -> localhost:8090
```

### 2.2 Device Setup via SMS (Step-by-Step)
Send the following SMS messages to the SIM card inside the tracker (default password is `123456`):

1. **Factory Initialization** (optional, recommended for clean setup):
   ```text
   begin123456
   ```
   *Expected reply:* `begin ok`

2. **Configure Cellular APN**:
   ```text
   apn123456 <your_sim_apn>
   ```
   *(e.g., `apn123456 internet` or carrier specific)*  
   *Expected reply:* `apn ok`

3. **Switch to GPRS Data Mode**:
   ```text
   gprs123456
   ```
   *Expected reply:* `GPRS ok`

4. **Switch to TCP Protocol**:
   ```text
   tcp123456
   ```
   *Expected reply:* `tcp ok`

5. **Set Server DNS Host & Port (Point to ngrok)**:
   According to page 13 of the manual:
   ```text
   adminip123456 0.tcp.ngrok.io 14822
   ```
   *(Alternatively on some firmware variants: `dns123456 0.tcp.ngrok.io 14822`)*  
   *Expected reply:* `adminip ok`

6. **Set Continuous Tracking Interval**:
   Report every 20 seconds while moving, every 2 hours when stopped, unlimited times:
   ```text
   fix020s002h***n123456
   ```
   *Expected reply:* `fix ok`

7. **Set Master Phone Number** (for emergency SMS notifications):
   ```text
   admin123456 +1234567890
   ```
   *Expected reply:* `admin ok`

8. **Verify Tracker Status**:
   ```text
   check123456
   ```
   *Expected reply:* Battery, GPS signal, GSM signal, GPRS status, APN, IP, Port.

---

## 3. Coban GPS303 / TK103 Protocol Specification

The Coban 303FG communicates over TCP using ASCII text frames. Frames are terminated with either semicolons (`;`) or carriage-return/newlines (`\r\n`).

### 3.1 Handshake / Login Packet (Device -> Server)
When the tracker establishes a TCP connection, it transmits its IMEI:
```text
##,imei:358123049582103,A;
```
**Server Response**:
The server must acknowledge immediately to keep the TCP socket open:
```text
LOAD
```
*(or `ON` depending on tracker firmware revision).*

### 3.2 Heartbeat / Keep-Alive Packet (Device -> Server)
Sent periodically (e.g., every 1–3 minutes) to maintain the cellular NAT binding:
```text
##,imei:358123049582103,B;
```
**Server Response**:
The server replies with acknowledgment (e.g., `ON` or TCP ACK).

### 3.3 Telemetry & Location Report Packet (Device -> Server)
Format:
```text
imei:358123049582103,tracker,2611071005,,F,100532.000,A,5230.1234,N,01323.5678,E,024.5,180.0,0.00,00000000,L,00000000,00000000,000;
```
*or in standard TK103 format:*
```text
123456BP05261107A5230.1234N01323.5678E024.5100532180.0000000000L00000000
```

#### Field-by-Field Breakdown:
| Field | Value | Meaning |
|---|---|---|
| **IMEI** | `358123049582103` | 15-digit unique hardware identifier |
| **Message Type** | `tracker` or `BP05` | Periodic position tracking packet |
| **Date** | `261107` | YYMMDD format (November 7, 2026) |
| **Time** | `100532` | UTC HHMMSS (10:05:32 UTC) |
| **Fix Status** | `A` | `A` = Valid GPS fix, `V` = Void / No satellite fix |
| **Latitude** | `5230.1234,N` | 52° 30.1234' North -> $52 + 30.1234/60 = 52.502057^\circ$ |
| **Longitude** | `01323.5678,E` | 013° 23.5678' East -> $13 + 23.5678/60 = 13.392797^\circ$ |
| **Speed** | `024.5` | Speed in knots -> $24.5 \times 1.852 = 45.37\text{ km/h}$ |
| **Heading** | `180.0` | Direction course in degrees (180° = South) |
| **ACC / Status** | `00000000` | Digital input status bitmask (ACC, door, power, relay) |
| **Fuel Reading** | `0.00` | Fuel sensor input voltage (0.00V–5.00V) or calibrated percentage |

### 3.4 Alarm Packets (Device -> Server)
When an alarm triggers, the event identifier indicates the exact alert:
- `help!` / `sos`: Driver pressed the physical SOS button for 3 seconds.
- `acc alarm`: ACC wire detected ignition while in the ARMED state.
- `door alarm`: Positive or negative door wire triggered while ARMED.
- `sensor alarm`: Shock / vibration sensor triggered while ARMED.
- `low battery`: Built-in backup battery dropped below 3.55V.
- `power off`: External 12V/24V car battery disconnected.
- `speed`: Vehicle exceeded the configured overspeed limit.
- `move`: Vehicle exited the stationary geofence radius.
- `oil`: Abnormal drop in fuel level detected (theft / leakage).

### 3.5 Downlink Commands (Server -> Device over TCP)
Commands are plain text sent through the active TCP socket, terminated with `\r\n` or `;`:
- **Delayed Engine Immobilize**: `stop123456` (will cut relay when speed < 20 km/h)
- **Immediate Engine Immobilize**: `quickstop123456`
- **Restore Engine / Fuel**: `resume123456`
- **Arm System**: `arm123456`
- **Silent Arm**: `silent123456`
- **Disarm System**: `disarm123456`
- **Query Status**: `check123456`
- **Query Location**: `position123456`
- **Calibrate Fuel 0%**: `oilzero123456`
- **Calibrate Fuel 100%**: `oilfull123456`
- **Adjust Shock Sensitivity**: `sensitivity123456 2` (values: 1, 2, 3)

---

## 4. Architecture & System Design

To integrate the Coban 303FG cleanly with Sentinel Fleet, we introduce a dedicated telematics gateway module while preserving Sentinel Fleet's security and policy invariants:

```
                             +------------------------+
                             |   GPS 303FG Tracker    |
                             +-----------+------------+
                                         |
                                         | TCP over ngrok (Port 8090)
                                         v
+---------------------------------------------------------------------------------+
| Sentinel Telematics Gateway (src/apps/api/src/telematics/)                     |
|                                                                                 |
|  +--------------------+    +-----------------------+    +--------------------+  |
|  |  CobanTcpServer    | -> |  CobanProtocolDecoder | -> | Ingestion Pipeline |  |
|  |  (Node net.Server) |    |  (Parser & Validator) |    |                    |  |
|  +---------+----------+    +-----------------------+    +---------+----------+  |
|            ^                                                      |             |
|            | Downlink Commands                                    |             |
|  +---------+----------+                                           |             |
|  | DeviceSessionStore |                                           v             |
|  | (Active Sockets)   |                           +--------------------------+  |
|  +--------------------+                           | Sequelize Models & DB    |  |
|            ^                                      | - Device                 |  |
|            |                                      | - DeviceAssignment       |  |
|  +---------+----------+                           | - Vehicle                |  |
|  | Command Controller |                           | - TelemetryEvent         |  |
|  | (POST /commands)   |                           | - LatestPosition         |  |
|  +--------------------+                           | - Alert                  |  |
+---------------------------------------------------| - AuditEvent             |--+
                                                    +-------------+------------+
                                                                  |
                                                                  v
                                                    +--------------------------+
                                                    | Sentinel Portal Web UI   |
                                                    | - Live Map Tracking      |
                                                    | - Real-Time Telemetry HUD|
                                                    | - Immobilizer & Arming   |
                                                    | - Alarm Feed & Sounds    |
                                                    +--------------------------+
```

### 4.1 Gateway Components
1. **`CobanTcpServer` (`src/apps/api/src/telematics/server.ts`)**:
   - Manages TCP socket lifecycle on port `8090` (configurable via `TELEMATICS_PORT`).
   - Handles buffer chunking, packet framing, and socket errors.
2. **`CobanProtocolDecoder` (`src/apps/api/src/telematics/decoder.ts`)**:
   - Parses raw frames (login, heartbeat, position, alarm, command response).
   - Validates coordinates and checksums.
   - Converts NMEA degree-minutes to decimal degrees.
   - Extracts ACC ignition, door, power, arming, and fuel telemetry.
3. **`DeviceSessionStore` (`src/apps/api/src/telematics/session.ts`)**:
   - Stores active TCP socket connections indexed by IMEI.
   - Provides methods: `sendDeviceCommand(imei, command, timeoutMs)`.
   - Tracks online/offline connection state and socket keep-alive timers.
4. **`TelematicsIngestionService` (`src/apps/api/src/telematics/ingestion.ts`)**:
   - Resolves incoming IMEI against `Device.serial`.
   - Finds active `DeviceAssignment` and target `Vehicle`.
   - Writes immutable `TelemetryEvent` rows (`source: 'COBAN_303FG'`).
   - Updates `LatestPosition` mutable projection.
   - Updates `Device` status (`batteryPercent`, `signalQuality`, `lastCommunicationAt`, `status: 'ACTIVE'`).
   - Generates `Alert` records for alarms (SOS, ACC breach, door trigger, power cut, low battery).
   - Emits events over the internal event bus.
5. **Real-time Server-Sent Events (SSE) Stream (`src/apps/api/src/routes/telematics.routes.ts`)**:
   - Endpoint: `GET /api/telematics/stream` allowing the web portal to receive live position updates, telemetry state changes, and alert toasts in real time.
6. **Command Dispatch API (`POST /api/telematics/commands`)**:
   - Customer fleet managers can issue immobilize (`stop`/`quickstop`/`resume`), arm/disarm (`arm`/`silent`/`disarm`), interval tuning (`fix`), and status queries (`check`).
   - Logs `AUDIT_EVENT` for every dispatched hardware control action.

---

## 5. Step-by-Step Implementation Roadmap

### Phase 1: ngrok Tooling & Setup Scripts
- [ ] Create `scripts/telematics-tunnel.mjs`:
  - Starts or monitors `ngrok tcp 8090`.
  - Queries local ngrok API (`http://127.0.0.1:4040/api/tunnels`) to fetch the active public hostname and port.
  - Automatically prints formatted SMS commands ready to copy/paste directly to the tracker SIM card.
- [ ] Create `scripts/mock-coban-tracker.mjs`:
  - Standalone simulator script that connects to `127.0.0.1:8090` (or ngrok TCP).
  - Emulates full Coban 303FG behavior: Handshake (`##,imei:...,A;`), heartbeats, periodic GPS tracks, simulated ACC on/off, fuel sensor voltage, and triggers mock alarms (SOS, door, power cut) to verify the server before plugging in physical hardware.

### Phase 2: TCP Server & Protocol Codec
- [ ] Implement `src/apps/api/src/telematics/types.ts`:
  - Types for parsed packets: `ParsedLocationPacket`, `ParsedAlarmPacket`, `DeviceStatusFlags`, `DownlinkCommand`.
- [ ] Implement `src/apps/api/src/telematics/decoder.ts`:
  - Framing buffer handler (slices data by `;` and `\r\n`).
  - Regex parsers for Coban login (`##,imei:(\d+),A;`), heartbeat (`##,imei:(\d+),B;`), location, and alarm formats.
  - Coordinate converter: `ddmm.mmmm,N` -> decimal degrees float.
  - Speed converter: knots -> km/h.
  - ACC / Door / Arm / Fuel status bitmask parser.
- [ ] Implement `src/apps/api/src/telematics/session.ts`:
  - Active TCP socket registry keyed by IMEI.
  - Safe command transmitter with timeout and promise resolution.
- [ ] Implement `src/apps/api/src/telematics/server.ts`:
  - Standalone `net.createServer` listening on `TELEMATICS_PORT` (default 8090).
  - Integrates with the API lifecycle in `src/apps/api/src/server.ts`.

### Phase 3: Database & Telemetry Ingestion Pipeline
- [ ] Enhance data models to support hardware-specific telemetry fields:
  - Add optional telemetry attributes to `TelemetryEvent` and `LatestPosition`:
    - `ignitionOn`: boolean (ACC status)
    - `doorOpen`: boolean
    - `externalPower`: boolean (true = 12V/24V, false = backup battery)
    - `fuelPercent`: number (0%–100%)
    - `armed`: boolean
  - Or store full sensor telemetry payload in a structured `attributes` JSON field.
- [ ] Implement `src/apps/api/src/telematics/ingestion.ts`:
  - Look up device by serial (IMEI). If not present, auto-create in pending/quarantined or active state based on organization settings.
  - Locate vehicle via `DeviceAssignment.findOne({ where: { deviceId, unassignedAt: null } })`.
  - Transactional persistence of `TelemetryEvent` and update of `LatestPosition`.
  - Create `Alert` for critical hardware events:
    - `SOS`: severity `CRITICAL`
    - `ACC_ALARM` / `DOOR_ALARM` / `SHOCK_ALARM`: severity `HIGH`
    - `POWER_DISCONNECTED` / `LOW_BATTERY`: severity `MEDIUM`
    - `OVERSPEED` / `MOVEMENT`: severity `LOW`
  - Record `AuditEvent` for administrative actions.

### Phase 4: Downlink Vehicle Commands API
- [ ] Create `src/apps/api/src/controllers/telematics.controller.ts` & `src/apps/api/src/routes/telematics.routes.ts`:
  - `POST /api/telematics/commands/immobilize`:
    - Parameters: `{ vehicleId, mode: 'delayed' | 'immediate' }`
    - Sends `stop123456` or `quickstop123456` over the active socket.
  - `POST /api/telematics/commands/resume`:
    - Sends `resume123456`.
  - `POST /api/telematics/commands/arm`:
    - Parameters: `{ vehicleId, silent: boolean }`
    - Sends `arm123456` or `silent123456`.
  - `POST /api/telematics/commands/disarm`:
    - Sends `disarm123456`.
  - `POST /api/telematics/commands/calibrate-fuel`:
    - Parameters: `{ vehicleId, level: '0%' | '100%' }`
    - Sends `oilzero123456` or `oilfull123456`.
  - `POST /api/telematics/commands/custom`:
    - Sends diagnostic text commands (`check`, `sensitivity`, etc.).
  - Security & Authorization:
    - Enforced by `policy.service.ts` (customer `ORG_ADMIN` / `FLEET_MANAGER` only).
    - Every command logged in `AuditEvent`.

### Phase 5: Portal UI — Live Map, Controls & Hardware HUD
- [ ] Add Real-Time Stream Consumer to `src/apps/portal/src/PortalApp.tsx`:
  - Connects to SSE endpoint `/api/telematics/stream`.
  - Dynamically updates vehicle positions on the Leaflet map without page refreshes.
- [ ] Build **Hardware Telemetry HUD** in the vehicle details drawer:
  - **Engine State**: Green badge for "Ignition ON (ACC)" / Gray for "Ignition OFF".
  - **Power Source**: "Main Battery (12V/24V)" vs "Backup Battery" with percentage bar.
  - **Doors & Arming**: Door status (Open/Closed) and Alarm status (Armed/Silent/Disarmed).
  - **Fuel Gauge**: Circular or linear progress meter showing calibrated 0%–100% fuel level.
- [ ] Build **Remote Vehicle Controls Panel**:
  - **Engine Cut / Immobilizer Switch**:
    - Safety confirmation modal ("Confirm fuel pump relay shutoff").
    - Option for Delayed Cut (safe: executes when speed < 20 km/h) vs Immediate Cut.
    - One-click "Restore Fuel & Engine" button.
  - **Arming Quick Controls**:
    - Arm, Silent Arm, Disarm buttons.
  - **Diagnostics Drawer**:
    - "Check Device Status" button (displays raw response: battery, GSM, GPS, IP).
    - Fuel calibration triggers (0% empty, 100% full).
- [ ] Real-Time Alarm Notifications:
  - Floating toast alerts and optional audible chime when an SOS or tamper alarm arrives.

### Phase 6: Field Testing & Verification
- [ ] Local loop testing using `scripts/mock-coban-tracker.mjs` against `127.0.0.1:8090`.
- [ ] Start `ngrok tcp 8090` and run `scripts/telematics-tunnel.mjs`.
- [ ] Send SMS setup commands to the physical GPS Tracker 303FG.
- [ ] Observe live connection handshake in server logs.
- [ ] Verify real GPS coordinates rendering on the Sentinel Fleet portal map.
- [ ] Test ACC wire trigger (turn vehicle ignition key on/off) and observe instantaneous status update in the UI.
- [ ] Test SOS button press and confirm critical alarm creation and notification toast.
- [ ] Test remote immobilize command and measure relay click / cut-off response time.

---

## 6. Safety & Operational Precautions

> [!WARNING]
> **Vehicle Immobilization Safety**:
> Never execute an immediate engine cut (`quickstop`) while a vehicle is in active transit on high-speed roads. The delayed command (`stop`) is designed specifically to wait until the GPS tracker detects vehicle speed falling below 20 km/h before tripping the fuel pump relay.

> [!NOTE]
> **ngrok Free Tier Notice**:
> On the free tier of ngrok, restarting `ngrok tcp 8090` assigns a new random port number (e.g. `0.tcp.ngrok.io:XXXXX`). When this happens, an updated `adminip` SMS must be sent to the device. For production or long-term bench testing, an ngrok static TCP domain (or a fixed cloud VM IP with port forwarding) is recommended.
