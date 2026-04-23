import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read API key from .env
const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf8');
const apiKeyMatch = envContent.match(/KIE_API_KEY=(.+)/);
if (!apiKeyMatch) { console.error('KIE_API_KEY not found in .env'); process.exit(1); }
const API_KEY = apiKeyMatch[1].trim();

const BASE_URL = 'https://api.kie.ai/api/v1/jobs';

async function createTask(prompt, imageSize = '16:9') {
  const res = await fetch(`${BASE_URL}/createTask`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'google/nano-banana', input: { prompt, image_size: imageSize } })
  });
  const data = await res.json();
  if (data.code !== 200) throw new Error(`Task creation failed: ${JSON.stringify(data)}`);
  return data.data.taskId;
}

async function pollTask(taskId, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000));
    const res = await fetch(`${BASE_URL}/recordInfo?taskId=${taskId}`, {
      headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const data = await res.json();
    const state = data.data?.state;
    console.log(`  [${i + 1}/${maxAttempts}] state: ${state}`);
    if (state === 'success') {
      const result = JSON.parse(data.data.resultJson);
      return result.resultUrls[0];
    }
    if (state === 'fail') throw new Error(`Task failed: ${data.data.failMsg}`);
  }
  throw new Error('Timeout waiting for image generation');
}

async function downloadImage(url, destPath) {
  const res = await fetch(url);
  const buffer = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(destPath, buffer);
  console.log(`  Saved → ${destPath}`);
}

async function generateImage(name, prompt, imageSize, destFile) {
  console.log(`\nGenerating: ${name}`);
  console.log(`Prompt: "${prompt.slice(0, 80)}..."`);
  const taskId = await createTask(prompt, imageSize);
  console.log(`Task ID: ${taskId}`);
  const imageUrl = await pollTask(taskId);
  console.log(`  URL: ${imageUrl.slice(0, 60)}...`);
  const destPath = path.join(__dirname, 'brand_assets', destFile);
  await downloadImage(imageUrl, destPath);
}

const images = [
  {
    name: 'Hero Background',
    prompt: 'Cinematic dark photography, two BJJ grapplers silhouettes on white tatami mats in a dimly lit dojo, dramatic overhead spotlights creating chiaroscuro contrast, deep shadows, smoke haze atmosphere, Japanese martial arts gym aesthetic, ultra-wide angle, editorial sports photography, dark moody, professional',
    size: '16:9',
    file: 'hero-bg.jpg'
  },
  {
    name: 'Dark Texture',
    prompt: 'Abstract dark textured background, rough concrete surface with subtle noise grain, deep charcoal and near-black tones, faint geometric micro-lines, minimal industrial aesthetic, no people, no text, no objects, seamless',
    size: '16:9',
    file: 'texture-dark.jpg'
  }
];

(async () => {
  for (const img of images) {
    await generateImage(img.name, img.prompt, img.size, img.file);
  }
  console.log('\nAll images generated successfully.');
})();
