import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import type { Packaging, TeaserData } from './src/types';
import type { DemoScript } from './src/sceneTypes';
import type { ProductionKit, SegmentName } from './src/kitTypes';

/**
 * Renders a video to MP4.
 *
 *   # the demo — shows the problem and the tool fixing it
 *   tsx render.ts --scenes <demo.json> --title "Course title" --out out/demo.mp4
 *
 *   # the teaser — the 15-30s promo
 *   tsx render.ts <teaser.json> --title "Course title" [--packaging topic.json]
 *
 * Standalone on purpose: rendering is slow and resource hungry, so it has to
 * be runnable and debuggable without the API in the loop.
 */
const args = process.argv.slice(2);

function flag(name: string, fallback = ''): string {
  const index = args.indexOf(`--${name}`);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), 'utf8')) as T;
}

async function main() {
  // --kit renders the cards that get cut into a screen recording.
  const kitPath = flag('kit');
  if (kitPath) {
    await renderSegments(kitPath, flag('out', 'out'));
    return;
  }

  const scenesPath = flag('scenes');
  const teaserPath = args.find((arg) => !arg.startsWith('--') && args[args.indexOf(arg) - 1]?.startsWith('--') === false);
  const positional = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--'));
  const teaserFile = positional[0] ?? teaserPath;

  if (!scenesPath && !teaserFile) {
    console.error(
      'usage:\n' +
        '  tsx render.ts --scenes <demo.json> --title "..." [--out file.mp4]\n' +
        '  tsx render.ts <teaser.json> --title "..." [--packaging topic.json] [--out file.mp4]',
    );
    process.exit(1);
  }

  const courseTitle = flag('title', 'AI Content & Course Factory');
  const isDemo = Boolean(scenesPath);
  const outPath = path.resolve(flag('out', path.join('out', isDemo ? 'demo.mp4' : 'teaser.mp4')));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });

  let compositionId: string;
  let inputProps: Record<string, unknown>;

  if (isDemo) {
    const script = readJson<DemoScript>(scenesPath);

    // Remotion serves media from public/, so narration recorded by the backend
    // is copied in and each scene is pointed at its copy.
    const narrated = copyAudioIntoPublic(script, path.dirname(path.resolve(scenesPath)));

    compositionId = 'Demo';
    inputProps = { script, courseTitle };
    if (narrated) console.log(`audio:    ${narrated} narrated scene(s)`);
    else console.log('audio:    none — run POST /api/courses/<id>/voiceover first');
    console.log(`demo:     ${scenesPath}`);
    console.log(
      `scenes:   ${script.scenes.length} — ${script.scenes.map((scene) => scene.type).join(' → ')}`,
    );
  } else {
    const teaser = readJson<TeaserData>(teaserFile as string);
    const packagingPath = flag('packaging');
    let packaging: Packaging | undefined;
    if (packagingPath) {
      const topic = readJson<Record<string, string>>(packagingPath);
      packaging = {
        titleArabic: topic.videoTitleArabic ?? '',
        titleEnglish: topic.videoTitleEnglish ?? '',
        thumbnailText: topic.thumbnailText ?? '',
        hookLine: topic.hookLine ?? '',
      };
    }
    compositionId = 'Teaser';
    inputProps = { teaser, courseTitle, ...(packaging ? { packaging } : {}) };
    console.log(`teaser:   ${teaserFile}`);
    console.log(`duration: ${teaser.durationSeconds}s · ${teaser.beats.length} beats`);
  }

  console.log(`output:   ${outPath}\n`);
  const started = Date.now();

  console.log('bundling...');
  const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });

  const composition = await selectComposition({ serveUrl, id: compositionId, inputProps });
  console.log(
    `  ${composition.width}x${composition.height} @ ${composition.fps}fps, ` +
      `${composition.durationInFrames} frames (${(composition.durationInFrames / composition.fps).toFixed(0)}s)`,
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
      if (percent >= lastReported + 20) {
        lastReported = percent;
        process.stdout.write(`  ${percent}%\n`);
      }
    },
  });

  const bytes = fs.statSync(outPath).size;
  console.log(
    `\ndone in ${((Date.now() - started) / 1000).toFixed(0)}s — ${(bytes / 1024 / 1024).toFixed(2)} MB`,
  );
  console.log(outPath);
}

/**
 * Renders the intro, scoreboard and outro cards as separate files, so they
 * drop straight onto an editing timeline beside the screen recording.
 */
async function renderSegments(kitPath: string, outDir: string) {
  const kit = readJson<ProductionKit>(kitPath);
  const segments: SegmentName[] = ['intro', 'scoreboard', 'outro'];

  console.log(`kit:      ${kitPath}`);
  console.log(`title:    ${kit.titleArabic}`);
  console.log(`segments: ${segments.join(', ')}\n`);

  fs.mkdirSync(path.resolve(outDir), { recursive: true });
  const serveUrl = await bundle({ entryPoint: path.resolve('src/index.ts') });

  for (const segment of segments) {
    const inputProps = { kit, segment };
    const composition = await selectComposition({ serveUrl, id: 'Segment', inputProps });
    const outputLocation = path.resolve(outDir, `segment-${segment}.mp4`);

    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation,
      inputProps,
      concurrency: Math.max(1, Math.min(4, os.cpus().length - 2)),
    });

    const seconds = (composition.durationInFrames / composition.fps).toFixed(1);
    console.log(`  ${segment.padEnd(11)} ${seconds}s  ${outputLocation}`);
  }
}

/**
 * Copies each scene's narration into public/ and rewrites its path to the
 * public-relative name Remotion's staticFile() expects.
 */
function copyAudioIntoPublic(script: DemoScript, scenesDir: string): number {
  const publicDir = path.resolve('public', 'audio');
  let copied = 0;

  for (const scene of script.scenes) {
    const audioPath = (scene as { audioPath?: string }).audioPath;
    if (!audioPath) continue;

    // audioPath is relative to the generated root; scenes live beside audio.
    const source = path.resolve(scenesDir, '..', 'audio', path.basename(audioPath));
    if (!fs.existsSync(source)) {
      console.warn(`  missing narration: ${source}`);
      continue;
    }

    fs.mkdirSync(publicDir, { recursive: true });
    const name = `${path.basename(path.dirname(path.dirname(audioPath)))}-${path.basename(audioPath)}`;
    fs.copyFileSync(source, path.join(publicDir, name));
    scene.audioSrc = `audio/${name}`;
    copied += 1;
  }

  return copied;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
