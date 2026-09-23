# Lower-Body Hourglass

A personal training, nutrition and progress app built around one goal: a **lower-body-dominant hourglass silhouette**. That means a small-looking upper body, shoulders kept as small as possible, a narrow waist, and fuller glutes, hips and thighs.

> Build the bottom while keeping the top small. Never build the top to "balance" the bottom.

It runs entirely in the browser. Data stays on your device (localStorage, plus IndexedDB for photos). The optional AI coach sends your data only to the Anthropic API, and only when you add your own key.

## Use it on GitHub Pages

Every push builds and deploys the app with `.github/workflows/pages.yml`. One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions**. The app is then at `https://mgup709.github.io/gym/`.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests (vitest)
npm run build    # static build in dist/
```

## What's inside

| Screen | What it does |
|---|---|
| **Today** | Day type and objective, calorie/macro targets, next meal, workout list, steps, knee status, cycle phase, and shortcuts (Start workout · Log food · Log measurements · Knee check-in · Ask coach). |
| **Train** | For each exercise: purpose, sets × reps, RIR, rest, last session, today's target and knee demand. You log sets and a 0–5 knee response. A swap button keeps the same training effect, and each workout ends with deep-core exercises. |
| **Body** | Proportion dashboard: front-view silhouette, descriptive ratios (hip ÷ waist, shoulder ÷ hip, …), priority measurements against the baseline, trends, measurement logging, and progress photos (front/side/back). |
| **Food** | Macros for the day type, meals timed around your training time, quick-add of flavourful meals, and the week ahead. |
| **Cycle** | Cycle sync: phase estimate, symptom logging, readiness, luteal-phase calorie adjustment, water-retention flags for measurements, and knee response by phase. |
| **Weekly** | Lower-body scorecard (effective sets per muscle), the Lower-Body Width Engine, the weekly check-in, and the plan review. |
| **Coach** | Claude, with full context from your data. Without an API key, a rule-based offline coach answers the common questions. |
| **Knees** | Knee check-ins, red-flag advice, and the knee-tolerance memory (per-exercise glute/quad stimulus, knee response and your preference). |

## How the engines decide

- **Program** (`src/data/program.ts`): Glutes + hamstrings / upper maintenance + core / recovery / glutes + thighs / glute accessory + core / optional / rest. The priority order shows up in weekly volume: glute max ≈ 24 sets, upper/side glutes ≈ 17, hamstrings ≈ 14, adductors ≈ 7.5, quads ≈ 7, deltoids ≈ 0.5. Lateral raises, overhead pressing and shrugs are never programmed; they're in the library only so the coach can explain why.
- **Progression** (`src/engine/progression.ts`): double progression. Add reps until every set reaches the top of the range, then add load. Knee response of 2+, poor form, cycle symptoms or fatigue hold progression, and knee response of 4+ reduces the load. Upper-body progression is conservative, because maintenance counts as success there.
- **Knee memory and substitution** (`src/engine/knee.ts`): an exercise with repeated 3+/5 knee scores is automatically replaced by one that trains the same target muscles. The replacement is ranked on knee demand, your history and your preference, and comes with an explanation (original purpose, why it changed, the replacement, what it still trains). A "modify today" knee check-in swaps out knee-dominant work for that day. Swelling, instability, or persistent or worsening pain triggers a recommendation to get a professional assessment.
- **Nutrition** (`src/engine/nutrition.ts`): Mifflin-St Jeor with a modest deficit, never below about 1.2× BMR. Protein is the same every day. Carbs shift toward lower-body days while the weekly total stays balanced.
- **Cycle sync** (`src/engine/cycle.ts`): evidence doesn't support rigid phase-based programming, so the plan itself doesn't change. What changes: symptoms can hold progression for a day, the luteal phase gets a small calorie bump, and measurements taken in water-retention windows are flagged. With hormonal contraception it switches to symptom-only mode.
- **Plan review** (`src/engine/adjust.ts`): if the waist is down, glutes and thighs are steady or up, and shoulders are steady, it changes nothing. If shoulders are growing, it runs an immediate upper-body audit. If the lower body is flat, it works through a checklist in this order: progression, volume, effort, exercise selection, protein, calories, carbs, sleep, recovery, consistency.

None of the metrics are beauty or attractiveness scores. Muscle can't change pelvic bone width, only the muscular fullness around it.

## Baseline

Your baseline measurements (Sept 2026) are in `src/data/baseline.ts`: 15.5 in shoulders → 9.75 in waist → 13.75 in hips (front width), and 35 / 28 / 37 in (circumference).
