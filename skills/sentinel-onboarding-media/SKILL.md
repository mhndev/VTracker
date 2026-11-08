---
name: sentinel-onboarding-media
description: Regenerate or improve Sentinel Fleet's admin onboarding videos, captions, local Kokoro narration, and recording pipeline.
---

# Sentinel Fleet Onboarding Media

Read `AGENTS.md`, `docs/TEST_SCENARIOS.md`, and `scripts/onboarding/generate-videos.mjs` before editing the media workflow.

Run `npm run onboarding:videos` to record the three approved customer and reseller journeys. The script starts an isolated in-memory stack, drives the UI with Playwright, synthesizes narration locally with Kokoro ONNX, and stops the stack when complete. It must remain free of cloud inference and API keys.

Keep final assets at `src/apps/admin/public/onboarding/` as 1920×1080 H.264 MP4 files with 48 kHz AAC narration and matching WebVTT captions. Model files in `.data/onboarding/` and raw recordings in `output/onboarding/` are caches and must not be committed.

Use conversational narration and leave enough time after each meaningful UI action for viewers to follow it. Preserve the product's privacy boundaries in every recording; never reveal customer coordinates to a platform actor or an ungranted reseller.

After regeneration, inspect the MP4 stream metadata, update the durations in `src/apps/admin/src/AdminApp.tsx` if needed, build the admin, and run the onboarding Playwright journey. Commit the finalized MP4/VTT assets with the pipeline changes.
