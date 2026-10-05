import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import {
  DemoCode,
  DemoComparison,
  DemoCta,
  DemoOutcome,
  DemoProblem,
  DemoTerminal,
  DemoTitle,
} from './scenes/DemoScenes';
import { ProgressBar } from './scenes/_shared';
import { theme } from './theme';
import type { DemoScene, DemoVideoProps } from './sceneTypes';

/**
 * Plays a demo script.
 *
 * Each scene declares its own duration, so the running time is whatever the
 * script says. Which component draws a scene is decided here by its `type` —
 * the AI picks the type and supplies the content, never the appearance.
 */
export function DemoVideo({ script, courseTitle }: DemoVideoProps) {
  const { fps } = useVideoConfig();
  let cursor = 0;

  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {script.scenes.map((scene, index) => {
        const from = cursor;
        const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
        cursor += durationInFrames;

        return (
          <Sequence key={index} from={from} durationInFrames={durationInFrames}>
            {renderScene(scene, courseTitle)}
          </Sequence>
        );
      })}
      <ProgressBar accent={theme.colors.accent} />
    </AbsoluteFill>
  );
}

function renderScene(scene: DemoScene, courseTitle: string) {
  switch (scene.type) {
    case 'title':
      return <DemoTitle scene={scene} />;
    case 'problem':
      return <DemoProblem scene={scene} />;
    case 'terminal':
      return <DemoTerminal scene={scene} />;
    case 'code':
      return <DemoCode scene={scene} />;
    case 'comparison':
      return <DemoComparison scene={scene} />;
    case 'outcome':
      return <DemoOutcome scene={scene} />;
    case 'cta':
      return <DemoCta scene={scene} courseTitle={courseTitle} />;
    default:
      return null;
  }
}

export function totalFrames(script: DemoVideoProps['script'], fps: number): number {
  return script.scenes.reduce(
    (sum, scene) => sum + Math.max(1, Math.round(scene.durationSeconds * fps)),
    0,
  );
}
