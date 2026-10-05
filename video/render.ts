import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { TeaserData } from './src/types';

/**
 * Renders one teaser.json to an MP4.
 *
 *   npx tsx render.ts <teaser.json> [--title "Course title"] [--out <file>]
 *
 * Kept as a standalone entry point: rendering is slow and resource hungry, so
 * it must be runnable (and debuggable) without the API in the loop. Wiring it
 * behind a job is the next step, not a prerequisite.
 */
async function main() {
  const args = process.argv.slice(2);
  const teaserPath = args.find((arg) => !arg.startsWith('--'));
  if (!teaserPath) {
    console.error('usage: tsx render.ts <path to teaser.json> [--title "..."] [--out out.mp4]');
    process.exit(1);
  }

  function flag(name: string, fallback: string): string {
    const index = args.indexOf(`--${name}`);
    return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
  }

  const teaser = JSON.parse(fs.readFileSync(path.resolve(teaserPath), 'utf8')) as TeaserData;
  const courseTitle = flag('title', 'AI Content & Course Factory');
  const outPath = path.resolve(flag('out', path.join('out', 'teaser.mp4')));

  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  console.log(`teaser:   ${teaserPath}`);
  console.log(`duration: ${teaser.durationSeconds}s · ${teaser.beats.length} beats`);
  console.log(`output:   ${outPath}\n`);

  const started = Date.now();

  console.log('bundling...');
  const serveUrl = await bundle({
    entryPoint: path.resolve('src/index.ts'),
    onProgress: (progress) => {
      if (progress % 25 === 0) process.stdout.write(`  bundle ${progress}%\n`);
    },
  });

  const inputProps = { teaser, courseTitle };

  console.log('selecting composition...');
  const composition = await selectComposition({ serveUrl, id: 'Teaser', inputProps });
  console.log(
    `  ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`,
  );

  console.log('rendering...');
  let lastReported = -1;
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: outPath,
    inputProps,
    concurrency: Math.max(1, Math.min(4, os.cpus().length - 2)),
    onProgress: ({ progress }) => {
      const percent = Math.floor(progress * 100);
      if (percent >= lastReported + 10) {
        lastReported = percent;
        process.stdout.write(`  render ${percent}%\n`);
      }
    },
  });

  const bytes = fs.statSync(outPath).size;
  console.log(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(0)}s — ${(bytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(outPath);

}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
