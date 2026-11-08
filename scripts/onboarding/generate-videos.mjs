import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rawDirectory = path.join(repositoryRoot, 'output/onboarding/raw');
const publicDirectory = path.join(repositoryRoot, 'src/apps/admin/public/onboarding');
const voice = process.env.ONBOARDING_VOICE || 'Rocko (English (US))';
const portalUrl = process.env.ONBOARDING_PORTAL_URL || 'http://127.0.0.1:15173';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

const flows = [
  {
    slug: 'customer-fleet-monitoring',
    narration: 'Welcome to Sentinel Fleet. The customer overview shows fleet health without hiding privacy controls. Refresh positions to create a new demo telemetry snapshot, then open the live map. From the vehicle directory, choose Telematics to inspect the saved current state, trip history, and decoded device logs. These views stay useful even when a tracker goes offline.',
    run: async page => {
      await openPortal(page);
      await pause();
      await page.getByRole('button', { name: 'Refresh positions' }).click();
      await page.getByText(/live positions updated/i).waitFor();
      await pause();
      await page.getByRole('button', { name: 'Live map' }).click();
      await page.getByRole('heading', { name: 'Live fleet map' }).waitFor();
      await pause();
      await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
      await page.locator('#vehicle-vehicle-1').getByRole('button', { name: 'Telematics' }).click();
      await page.getByRole('dialog').waitFor();
      await pause();
      await page.getByRole('dialog').getByRole('button', { name: 'Trips' }).click();
      await pause();
      await page.getByRole('dialog').getByRole('button', { name: 'Logs' }).click();
      await pause(1800);
    }
  },
  {
    slug: 'customer-location-sharing',
    narration: 'Location sharing is always controlled by the customer. Open Privacy and Access, choose the vehicle, duration, and support purpose, then grant temporary access. When the portal switches to reseller support, the granted map shows only approved vehicles. Other customer locations remain protected, and the access event is available to the audit trail.',
    run: async page => {
      await openPortal(page);
      await page.getByRole('button', { name: 'Privacy & access' }).click();
      await pause();
      const builder = page.locator('.grant-builder').filter({ hasText: 'Grant temporary access' });
      await builder.getByLabel('Vehicle').selectOption('vehicle-2');
      await builder.getByLabel('Duration').selectOption('4');
      await builder.getByLabel('Purpose').fill('Onboarding support diagnosis');
      await pause();
      await builder.getByRole('button', { name: 'Create secure grant' }).click();
      await page.getByText('Temporary location access granted.').waitFor();
      await pause();
      await page.getByLabel('Switch portal role').selectOption('user-reseller-support');
      await page.getByRole('heading', { name: /Good morning, Noah Fischer/ }).waitFor();
      await pause();
      await page.getByRole('button', { name: 'Granted map' }).click();
      await page.getByRole('heading', { name: 'Granted location map' }).waitFor();
      await pause(1800);
    }
  },
  {
    slug: 'reseller-customer-fleet',
    narration: 'Reseller administrators start in the customer directory. Open a customer workspace to work inside that tenant scope, then choose Customer Fleet. Delegated fleet management allows the reseller to add a vehicle and select its map appearance. Location access does not come with fleet management; customers still control every location grant.',
    run: async page => {
      await openPortal(page);
      await page.getByLabel('Switch portal role').selectOption('user-reseller-admin');
      await page.getByRole('heading', { name: 'Customers' }).waitFor();
      await pause();
      const customer = page.locator('.customer-card').filter({ hasText: 'Berlin Field Logistics' });
      await customer.getByRole('button', { name: /Open the permitted operational workspace for Berlin Field Logistics/ }).click();
      await page.getByRole('heading', { name: /Good morning, Leila Haddad/ }).waitFor();
      await pause();
      await page.getByRole('button', { name: 'Customer fleet' }).click();
      await page.getByRole('button', { name: 'Add customer vehicle' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Vehicle name').fill('Onboarding Support Van');
      await dialog.getByLabel('Registration plate').fill('ONBOARD-01');
      await dialog.getByRole('button', { name: 'Van' }).click();
      await pause();
      await dialog.getByRole('button', { name: 'Create vehicle' }).click();
      await page.getByText('Vehicle created', { exact: true }).waitFor();
      await pause(1800);
    }
  }
];

async function pause(milliseconds = 1200) {
  await new Promise(resolve => setTimeout(resolve, milliseconds));
}

async function openPortal(page) {
  await page.goto(portalUrl);
  await page.getByRole('heading', { name: 'Good morning, Maya.' }).waitFor();
}

async function waitForUrl(url, timeout = 120_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeout) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Services are still starting.
    }
    await pause(500);
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    let output = '';
    child.stdout.on('data', chunk => { output += chunk; });
    child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve(output) : reject(new Error(`${command} exited with ${code}\n${output}`)));
  });
}

async function mediaDuration(file) {
  let output = '';
  try {
    output = await run(ffmpegPath, ['-i', file, '-f', 'null', '-']);
  } catch (error) {
    output = error.message;
  }
  const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
  if (match) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
  throw new Error(`Could not read media duration for ${file}`);
}

function timestamp(seconds) {
  const milliseconds = Math.max(0, Math.round(seconds * 1000));
  const hours = String(Math.floor(milliseconds / 3_600_000)).padStart(2, '0');
  const minutes = String(Math.floor(milliseconds % 3_600_000 / 60_000)).padStart(2, '0');
  const secs = String(Math.floor(milliseconds % 60_000 / 1000)).padStart(2, '0');
  const millis = String(milliseconds % 1000).padStart(3, '0');
  return `${hours}:${minutes}:${secs}.${millis}`;
}

async function writeCaptions(file, narration, duration) {
  const sentences = narration.match(/[^.!?]+[.!?]+/g) || [narration];
  const totalWeight = sentences.reduce((total, sentence) => total + sentence.trim().split(/\s+/).length, 0);
  let cursor = 0;
  const cues = sentences.map((sentence, index) => {
    const weight = sentence.trim().split(/\s+/).length;
    const start = cursor;
    cursor += duration * weight / totalWeight;
    return `${index + 1}\n${timestamp(start)} --> ${timestamp(index === sentences.length - 1 ? duration : cursor)}\n${sentence.trim()}\n`;
  });
  await fs.writeFile(file, `WEBVTT\n\n${cues.join('\n')}`, 'utf8');
}

async function recordFlow(browser, flow) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: rawDirectory, size: { width: 1280, height: 720 } },
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  await flow.run(page);
  const video = page.video();
  await page.close();
  const rawVideo = path.join(rawDirectory, `${flow.slug}.webm`);
  await video.saveAs(rawVideo);
  await context.close();

  const audio = path.join(rawDirectory, `${flow.slug}.aiff`);
  await run('/usr/bin/say', ['-v', voice, '-o', audio, flow.narration]);
  const duration = await mediaDuration(audio);
  const output = path.join(publicDirectory, `${flow.slug}.mp4`);
  await run(ffmpegPath, [
    '-y', '-i', rawVideo, '-i', audio,
    '-filter_complex', '[0:v]tpad=stop_mode=clone:stop_duration=60,scale=1280:720[v]',
    '-map', '[v]', '-map', '1:a', '-c:v', 'libx264', '-preset', 'fast', '-crf', '23',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', output
  ]);
  await writeCaptions(path.join(publicDirectory, `${flow.slug}.vtt`), flow.narration, duration);
  console.log(`Created ${path.relative(repositoryRoot, output)}`);
}

await fs.mkdir(rawDirectory, { recursive: true });
await fs.mkdir(publicDirectory, { recursive: true });

const server = spawn(npmCommand, ['run', 'dev:services'], {
  cwd: repositoryRoot,
  detached: process.platform !== 'win32',
  env: {
    ...process.env,
    DATABASE_DIALECT: 'sqlite',
    DATABASE_URL: '',
    DATABASE_STORAGE: ':memory:',
    DATABASE_LOGGING: 'false',
    API_PORT: '18787',
    PORTAL_PORT: '15173',
    ADMIN_PORT: '15174',
    SIMULATOR_PORT: '15175',
    SIMULATOR_CONTROL_PORT: '15176',
    TELEMATICS_PORT: '18090',
    VITE_API_BASE: 'http://127.0.0.1:18787',
    CORS_ORIGIN: 'http://127.0.0.1:15173,http://127.0.0.1:15174,http://127.0.0.1:15175'
  },
  stdio: 'ignore'
});

let browser;
try {
  await waitForUrl(portalUrl);
  await waitForUrl('http://127.0.0.1:18787/api/health');
  browser = await chromium.launch({ headless: true });
  for (const flow of flows) await recordFlow(browser, flow);
} finally {
  await browser?.close();
  if (server.pid) {
    try {
      process.kill(process.platform === 'win32' ? server.pid : -server.pid, 'SIGTERM');
    } catch {
      // The development stack already exited.
    }
  }
}
