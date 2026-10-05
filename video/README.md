# Video renderer (Remotion)

Turns the scene data the backend produces into an MP4. The AI supplies **what** a scene says;
the components here decide **how it looks**, which is what keeps every video in a channel
looking like the same channel.

## Render a teaser

```bash
cd video
npm install
npx tsx render.ts ../backend/generated/courses/<course-id>/marketing/teaser.json \
  --title "Course title" \
  --out out/teaser.mp4
```

First run downloads Chrome Headless Shell (~94 MB). A 28s vertical teaser renders in ~50s.

## Preview while editing

```bash
npm run studio
```

## How a beat becomes a scene

`TeaserVideo.tsx` maps each beat to a component by its label — never the AI's choice:

| Beat | Component |
| --- | --- |
| `hook`, `problem`, `outcome` | `StatementScene` — one short line, narration beneath |
| any beat whose on-screen text reads `a → b → c` | `PipelineScene` — numbered steps, staggered in |
| `call-to-action` | `OutroScene` — course title and CTA card |

Beat timings (`startSecond` / `endSecond`) come straight from `teaser.json`, so the video is
exactly as long as the script says.

## Current limits

- **No audio.** Voice generation is a later phase, so narration is burned in as a caption —
  otherwise the video would say nothing. Once a `VoiceService` exists the caption becomes an
  optional subtitle track.
- **Teasers only.** Lesson videos need a scene model richer than beats (code, terminal,
  diagram), which is Phase 2 proper.
- **Not wired to the API.** Rendering is slow and resource hungry, so it runs as its own entry
  point. Putting it behind a job is the next step.
