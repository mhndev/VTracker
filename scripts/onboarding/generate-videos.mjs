import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import ffmpegPath from 'ffmpeg-static';
import { chromium } from '@playwright/test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const rawDirectory = path.join(repositoryRoot, 'output/onboarding/raw');
const publicDirectory = path.join(repositoryRoot, 'src/apps/admin/public/onboarding');
const modelDirectory = path.join(repositoryRoot, '.data/onboarding/kokoro');
const kokoroModel = path.join(modelDirectory, 'kokoro-v1.0.onnx');
const kokoroVoices = path.join(modelDirectory, 'voices-v1.0.bin');
const kokoroVoice = process.env.ONBOARDING_VOICE || 'af_heart';
const kokoroSpeed = process.env.ONBOARDING_VOICE_SPEED || '0.96';
const portalUrl = process.env.ONBOARDING_PORTAL_URL || 'http://127.0.0.1:15173';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const uvCommand = process.env.UV || 'uv';
const MODEL_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/kokoro-v1.0.onnx';
const VOICES_URL = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.1/voices-v1.0.bin';

const flows = [
  {
    slug: 'customer-fleet-monitoring',
    waitUnits: 6.5,
    narration: 'Welcome to Sentinel Fleet. Let’s take a quick look at your fleet. The overview brings vehicle health, open alerts, and visible locations into one place. Refresh positions for a new demo update, then open the live map. For more detail, go to Vehicles and choose Telematics. Current state, trips, and tracker logs stay available—even if a vehicle later goes offline.',
    run: async (page, wait) => {
      await openPortal(page);
      await wait();
      await page.getByRole('button', { name: 'Refresh positions' }).click();
      await page.getByText(/live positions updated/i).waitFor();
      await wait();
      await page.getByRole('button', { name: 'Live map' }).click();
      await page.getByRole('heading', { name: 'Live fleet map' }).waitFor();
      await wait();
      await page.getByRole('button', { name: 'Vehicles', exact: true }).click();
      await page.locator('#vehicle-vehicle-1').getByRole('button', { name: 'Telematics' }).click();
      await page.getByRole('dialog').waitFor();
      await wait();
      await page.getByRole('dialog').getByRole('button', { name: 'Trips' }).click();
      await wait();
      await page.getByRole('dialog').getByRole('button', { name: 'Logs' }).click();
      await wait(1.5);
    }
  },
  {
    slug: 'customer-location-sharing',
    waitUnits: 5.5,
    narration: 'Location sharing always stays under the customer’s control. Open Privacy and Access, then choose the vehicle, duration, and support purpose. Create the secure, time-limited grant. Now switch to reseller support and open the granted map. Only approved vehicles reveal their location; the rest remain protected, and every access event is recorded for audit.',
    run: async (page, wait) => {
      await openPortal(page);
      await page.getByRole('button', { name: 'Privacy & access' }).click();
      await wait();
      const builder = page.locator('.grant-builder').filter({ hasText: 'Grant temporary access' });
      await builder.getByLabel('Vehicle').selectOption('vehicle-2');
      await builder.getByLabel('Duration').selectOption('4');
      await builder.getByLabel('Purpose').fill('Onboarding support diagnosis');
      await wait();
      await builder.getByRole('button', { name: 'Create secure grant' }).click();
      await page.getByText('Temporary location access granted.').waitFor();
      await wait();
      await page.getByLabel('Switch portal role').selectOption('user-reseller-support');
      await page.getByRole('heading', { name: /Good morning, Noah Fischer/ }).waitFor();
      await wait();
      await page.getByRole('button', { name: 'Granted map' }).click();
      await page.getByRole('heading', { name: 'Granted location map' }).waitFor();
      await wait(1.5);
    }
  },
  {
    slug: 'reseller-customer-fleet',
    waitUnits: 4.75,
    narration: 'Reseller administrators begin in the customer directory. Open a customer workspace to enter that tenant’s permitted scope, then choose Customer Fleet. Delegated fleet management lets you add a vehicle and choose how it appears on the map. Notice that location access is still separate: the customer continues to control every location grant.',
    run: async (page, wait) => {
      await openPortal(page);
      await page.getByLabel('Switch portal role').selectOption('user-reseller-admin');
      await page.getByRole('heading', { name: 'Customers' }).waitFor();
      await wait();
      const customer = page.locator('.customer-card').filter({ hasText: 'Berlin Field Logistics' });
      await customer.getByRole('button', { name: /Open the permitted operational workspace for Berlin Field Logistics/ }).click();
      await page.getByRole('heading', { name: /Good morning, Leila Haddad/ }).waitFor();
      await wait();
      await page.getByRole('button', { name: 'Customer fleet' }).click();
      await page.getByRole('button', { name: 'Add customer vehicle' }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByLabel('Vehicle name').fill('Onboarding Support Van');
      await dialog.getByLabel('Registration plate').fill('ONBOARD-01');
      await dialog.getByRole('button', { name: 'Van' }).click();
      await wait();
      await dialog.getByRole('button', { name: 'Create vehicle' }).click();
      await page.getByText('Vehicle created', { exact: true }).waitFor();
      await wait(1.75);
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

async function ensureDownload(url, destination, minimumBytes) {
  try {
    const stat = await fs.stat(destination);
    if (stat.size >= minimumBytes) return;
  } catch {
    // Download the missing local model asset below.
  }
  const temporary = `${destination}.download`;
  console.log(`Downloading ${path.basename(destination)} for local Kokoro narration…`);
  const response = await fetch(url);
  if (!response.ok || !response.body) throw new Error(`Could not download ${url} (${response.status})`);
  await pipeline(Readable.fromWeb(response.body), createWriteStream(temporary));
  await fs.rename(temporary, destination);
}

async function createVoiceover(output, narration) {
  await run(uvCommand, [
    'run', '--quiet', '--python', '3.12', '--with', 'kokoro-onnx==0.6.1', '--with', 'soundfile>=0.13.0',
    path.join(repositoryRoot, 'scripts/onboarding/kokoro_voiceover.py'),
    '--model', kokoroModel,
    '--voices', kokoroVoices,
    '--voice', kokoroVoice,
    '--speed', kokoroSpeed,
    '--output', output,
    '--text', narration
  ]);
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
  const audio = path.join(rawDirectory, `${flow.slug}.wav`);
  await createVoiceover(audio, flow.narration);
  const duration = await mediaDuration(audio);
  const stepMilliseconds = Math.max(1400, (duration * 1000 - 500) / flow.waitUnits);
  const wait = (units = 1) => pause(stepMilliseconds * units);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: { dir: rawDirectory, size: { width: 1920, height: 1080 } },
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  await flow.run(page, wait);
  const video = page.video();
  await page.close();
  const rawVideo = path.join(rawDirectory, `${flow.slug}.webm`);
  await video.saveAs(rawVideo);
  await context.close();

  const output = path.join(publicDirectory, `${flow.slug}.mp4`);
  await run(ffmpegPath, [
    '-y', '-i', rawVideo, '-i', audio,
    '-filter_complex', '[0:v]tpad=stop_mode=clone:stop_duration=5,scale=1920:1080:flags=lanczos[v];[1:a]highpass=f=70,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=48000,afade=t=in:d=0.08,apad=pad_dur=0.35[a]',
    '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.1',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', output
  ]);
  await writeCaptions(path.join(publicDirectory, `${flow.slug}.vtt`), flow.narration, duration);
  console.log(`Created ${path.relative(repositoryRoot, output)}`);
}

await fs.mkdir(rawDirectory, { recursive: true });
await fs.mkdir(publicDirectory, { recursive: true });
await fs.mkdir(modelDirectory, { recursive: true });
await ensureDownload(MODEL_URL, kokoroModel, 300_000_000);
await ensureDownload(VOICES_URL, kokoroVoices, 20_000_000);

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
