# Video renderer (Remotion)

Two compositions:

| Composition | Input | What it is |
| --- | --- | --- |
| **Demo** | `scenes/demo.json` | Shows the problem and the tool fixing it — real commands typing out with their real output, real code, real before/after numbers. ~45-60s |
| **Teaser** | `marketing/teaser.json` | The 15-30s promo. Statements and a pipeline, no demonstration |

```bash
# the demo
npx tsx render.ts --scenes ../backend/generated/courses/<id>/scenes/demo.json \
  --title "Course title" --out out/demo.mp4
```


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

## How a demo scene becomes a picture

`DemoVideo.tsx` maps each scene to a component by its `type`. The AI picks the type and writes
the content; it never decides how the scene looks.

| Scene type | Component | What it draws |
| --- | --- | --- |
| `title` | `DemoTitle` | headline plus thumbnail chips |
| `problem` | `DemoProblem` | the real manual steps, numbered, with what they cost today |
| `terminal` | `DemoTerminal` | the command types out character by character, then its real output appears; lines matching error/warning wording are highlighted |
| `code` | `DemoCode` | real code with line numbers and the important lines highlighted |
| `comparison` | `DemoComparison` | the two numbers, before in red and after in green |
| `outcome` | `DemoOutcome` | what the viewer can now do |
| `cta` | `DemoCta` | course title and call to action |

Each scene declares its own `durationSeconds`, so the running time is whatever the script says.

## How a teaser beat becomes a scene

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
