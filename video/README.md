# Video renderer (Remotion)

Turns the scene data the backend produces into an MP4. The AI supplies **what** a scene says;
the components here decide **how it looks**, which is what keeps every video in a channel
looking like the same channel.

## Render a teaser

```bash
cd video
npm install

# fetch the topic so the video can open on its real title card
curl -s localhost:4500/api/topics/<topic-id> | python3 -c 'import sys,json;json.dump(json.load(sys.stdin)["data"],open("/tmp/topic.json","w"))'

npx tsx render.ts ../backend/generated/courses/<course-id>/marketing/teaser.json \
  --title "Course title" \
  --packaging /tmp/topic.json \
  --out out/teaser.mp4
```

`--packaging` is optional. With it the video opens on a 3-second title card built from the
topic's own `videoTitleArabic`, `thumbnailText` and `hookLine` — the same card the viewer would
have clicked. Without it the video starts straight at the first beat.

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
| (prepended, when `--packaging` is given) | `TitleCardScene` — thumbnail chips, Arabic + English title, spoken hook |

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
