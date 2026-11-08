# Browser test scenarios and onboarding flows

The Playwright suite is deterministic and runs against a fresh in-memory SQLite database. It does not call an AI model, external map search, or any paid service. One Chromium worker keeps the few state-changing scenarios ordered and makes a normal local run short and repeatable.

## Main product flows

| Priority | Audience | Flow | Automated coverage |
| --- | --- | --- | --- |
| P0 | Customer admin | Monitor the fleet, refresh demo telemetry, open the live map, and inspect Current state, Trips, and Logs for a tracker | `customer monitors the fleet and inspects saved telematics` |
| P0 | Customer + reseller support | Customer grants time-limited location access; reseller sees granted positions while other vehicles remain protected | `customer grants scoped location access and reseller sees only granted locations` |
| P0 | Reseller admin | Open a managed customer workspace and add a vehicle under delegated fleet-management scope | `reseller opens a customer workspace and adds a fleet vehicle` |
| P0 | Platform support | Open the isolated admin console, confirm the coordinate boundary, and load the onboarding library | `admin exposes onboarding videos without weakening the coordinate boundary` |
| P1 | Device lab operator | Open the isolated Coban simulator and verify the connection workflow is ready | `device simulator loads independently for lab workflows` |

The API integration suite continues to own exhaustive policy, audit, validation, retention, protocol, and tenant-isolation cases. The browser suite intentionally stays focused on a small number of high-value journeys so it remains fast after every change.

## Commands

```bash
# One-time browser installation
npx playwright install chromium

# Fast headless regression suite; starts and stops an isolated local stack
npm run test:e2e

# Interactive Playwright runner for debugging
npm run test:e2e:ui

# Re-record the three onboarding videos with macOS Rocko TTS
npm run onboarding:videos
```

Failures retain a screenshot, trace, and browser video under `output/playwright/`. Generated raw recording files also stay under ignored `output/`; finalized MP4 and VTT assets are written to `src/apps/admin/public/onboarding/` for the admin build.

## Recording behavior

`npm run onboarding:videos` starts the same isolated stack, drives the top three workflows with Playwright, records a 1280×720 browser video, creates narration with the free macOS `say` voice `Rocko (English (US))`, and muxes the tracks with the local `ffmpeg-static` development dependency. Set `ONBOARDING_VOICE` to another installed macOS voice when needed.

The recording script is separate from `npm run test:e2e`: ordinary regression runs never regenerate media and never invoke text-to-speech.
