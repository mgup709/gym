# Taper

A personal body recomposition tracker that works on your phone and offline. It covers food logging, meal timing, a 5-day training program with double progression, recovery and cycle context, weekly measurements and photos, and long-term trends. It is built to answer two questions:

- **"What should I do today?"** (the Today tab)
- **"Is my current diet and training actually moving me toward my goal?"** (the Progress tab and the weekly check-in)

The goal is a narrower front-view waist, bigger and rounder glutes, visible abs, and staying properly nourished. Body weight is not the main measure, and no screen treats food as good or bad.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # engine tests (vitest)
npm run build    # static build in dist/
npm run e2e      # browser test of the core workflows (after build; uses the preinstalled Chromium)
```

`.github/workflows/pages.yml` deploys `main` to GitHub Pages. To install it on a phone, open the page and choose "Add to Home Screen".

## Architecture

| Layer | Where | Notes |
|---|---|---|
| UI | `src/views/*`, `src/components/*` | React 19 + TypeScript, Tailwind v4, shadcn-style primitives (`components/ui`), Recharts, lucide icons. Hash routing, so the back gesture works in the installed app. |
| Data | `src/lib/db.ts` | IndexedDB via Dexie. Local-first, with `navigator.storage.persist()` requested so the browser doesn't clear it. |
| Writes | `src/lib/repo.ts` | Enforces the rules that protect history (below). |
| Engines | `src/lib/*.ts` | Pure functions with unit tests: `nutrition`, `progression`, `mealtiming`, `suggest`, `trends`, `review`, `recovery`, `cycle`, `measurements`, `insights`. |
| Seed data | `src/lib/seed-foods.ts`, `seed-program.ts`, `seed.ts` | Your regular foods, recipes, meal templates, program, baseline measurements and strength benchmarks. |
| PWA | `public/manifest.webmanifest`, `public/sw.js` | Installable. Offline shell; data never leaves the device. |

**Rules that protect history**

- Every date stores the targets that applied that day (`DayLog.targets`). Changing targets later only affects today and future days.
- Food entries store their own copy of the nutrition values. Editing a food updates the recipes and meals that use it, but not days you already logged.
- Daily totals are always recomputed from the entries, so editing or deleting an old entry updates that day immediately.
- Days you haven't logged, or have marked incomplete, are left out of averages rather than counted as zero.

## Spec audit (QA checklist)

✅ implemented · 🟡 partial · ❌ missing

| # | Area | Status | Notes |
|---|---|---|---|
| 1–3 | Philosophy, goals, health constraints | ✅ | Neutral wording throughout. No "cheat", "failed" or "burned off". No calories-from-exercise and nothing to "eat back". |
| 4–5 | Baseline and primary variables | ✅ | All baseline circumferences and front widths are seeded as the baseline measurement. |
| 6–14 | Program — v2 leg hypertrophy (Mon Lower A glutes · Tue Upper + core · Wed Lower B quads + glutes · Thu Lower C glute volume · Fri dance only) | ✅ | Every lower-body exercise has **Pain / discomfort**. Pain in 2 of the last 3 sessions flags the exercise and suggests alternatives (swap for one session or permanently). |
| 7 | Strength baseline | ✅ | Hip thrust 130×9, RDL 74×9, abduction 85×10×3, face pull 20×12×3, curl 10×12×3 pre-fill the first session. |
| 15 | Double progression | ✅ | Keep the load and add reps → add load once every set reaches the top of the range at the planned RIR. Pain holds progression. Reaching the top while grinding means repeat before adding load. Two sessions below the range suggest a small reduction. |
| 16 | Rest periods | ✅ | A rest timer starts when a set is marked done (based on the exercise's rest time), with +30 s and skip. |
| 17–21 | Targets per day type, as ranges | ✅ | Editable. Optional "steady intake" mode. Rest-day carbs fill the remaining calories. |
| 22–24 | Meal timing | ✅ | Adapts to wake time, training time (10 AM / 4 PM / 7 PM patterns) and the Friday dance. Shows the next meal and what to aim for. |
| 25–26 | Micronutrients and whole-food goals | ✅ | Tracked on the Food tab (today and 7-day average) and in trends; not on the Today screen. Fruit, vegetable and calcium-rich servings. |
| 27–41 | Your regular foods | ✅ | Pancakes (calculated from ingredients: ~239 kcal, 28 g protein), both Oats Overnight flavours with soy milk, eggs + sourdough, both Chobani yogurts, yogurt + fruit, the Creami, fruit, poke bowl (light/white rice, extra salmon or edamame, extra or no mayo), Jersey Mike's bowl, pasta recipes, baked tomatoes, sauces and oils, and seafood meal ideas. |
| 42–43 | "What should I eat next?" | ✅ | Suggests 2–4 foods from your own library using the time, training time, what you've already eaten, remaining macros, fiber, fruit and hunger. Shows only stored values. |
| 44–45 | Quick Log checkboxes | ✅ | Tap logs a real entry, tap again removes it (with Undo). The stepper changes the quantity instead of creating a duplicate. |
| 46–47 | Saved meals, recipes, favorites, recent, frequent, duplicate meal/day, custom foods | ✅ | "Frequently eaten" is ranked from your real logs (7 days, 30 days, time of day). |
| 48, 76, 87 | Today dashboard | ✅ | No measurements, photo prompts or long-term charts. |
| 49 | Workout logging | ✅ | Last session's sets and the suggested load pre-fill. "+N total reps vs last session". Summary shows duration, volume, load and rep PRs, and next-time suggestions. Finished sessions can be edited. |
| 50–51 | Recovery and trend warnings | ✅ | Private 1–5 ratings plus binge/loss-of-control levels. A 14-day vs prior-14-day trend check shows a gentle card on Today when intake or recovery may be too aggressive. |
| 52 | Cycle | ✅ | Optional. Cycle day comes from logged period starts. Measurements show their cycle day, a same-phase comparison is shown, and the retention window holds the weekly decision. |
| 53–54 | Weekly measurements and ratios | ✅ | Three required measures plus optional ones and front widths. ±0.25 buttons start from last week's value, so entry takes about a minute. Compared against baseline, last week, 4 weeks ago and the start of the month. Changes under 0.25 in show as ±0. |
| 55–56 | Progress photos | ✅ | Front, side, back and other side. Weekly or every 4 weeks. Last photo shown faintly as a pose guide. Side-by-side, swipe and overlay comparisons. Private (IndexedDB). No scoring. |
| 57–63 | Nutrition trend charts | ✅ | Daily bars, 7-day average line, optional 30-day average, target band. 7d/30d/3m/6m/1y/All; longer ranges use weekly or monthly averages. Tap a day to open it. |
| 64–66 | Monthly summaries, month vs month, intake by day type | ✅ | |
| 67 | Nutrition + physique | ✅ | Small charts on a shared weekly axis (no dual axes), plus "the intake at which your waist trended down while strength held", described as co-occurring, not causal. |
| 68 | Consistency calendar | ✅ | P/W/F/R letters, and calories shown as neutral below/within/above marks. |
| 69 | Insights | ✅ | Each insight appears only once the data supports it (minimum-day thresholds). |
| 70–72 | Weekly check-in and decision engine | ✅ | Four outcomes. Needs about 3 weeks of data. Recovery problems take priority. Cycle or one-off jumps lead to Hold. Never changes targets automatically: applying ±100 kcal is always your choice. |
| 73–74 | Oct 31 and Dec 25 checkpoints | ✅ | Objective stats plus your own ratings. No required waist number. |
| 75–80 | Navigation, tabs, settings | ✅ | Settings cover targets, schedule and times, a workout editor with custom exercises, Quick Log contents and order, measurement day, photo frequency, units, theme, cycle and checkpoints. |
| 81–82 | Data model, export | ✅ | CSV zip (daily nutrition with that day's targets, food log, foods, meals, workouts, sets, measurements, recovery, cycle, reviews), JSON backup (optionally with photos), and restore. |
| 83 | Tech stack | 🟡 | Kept **Vite** instead of Next.js: a static, local-first PWA fits GitHub Pages hosting and doesn't need a server. UI components are written in shadcn style rather than installed with its CLI. |
| 83 | Supabase cloud sync | ❌ | Not built — the local-first path was chosen. Use JSON backup/restore to move between devices. |
| 84 | PWA | ✅ | Manifest, icons, service worker, offline shell. |
| 80 | Notifications | 🟡 | The weekly check-in shows as a dot on Progress. The device notification fires when you open the app on measurement day. There are no background pushes, because there is no server. |

**Estimates to check against your labels.** Oats Overnight packets, Core Power, ISO100, the Good Culture serving, and the restaurant bowls are typical-label or USDA estimates. They carry an "Estimated" tag. Edit a food once and every recipe and meal that uses it updates.

## Training week (v2)

Aimed at glute and quad size for the hourglass shape. Glutes get 3 sessions a week and quads 2–3. There's no lifting on dance night: a glute workout plus 2 hours of salsa/bachata the same day leaves little glycogen for either.

| Day | Session | Focus |
|---|---|---|
| Mon | Lower A | Heavy hip thrust, RDL, glute-biased split squat, abduction, hamstring curl |
| Tue | Upper + core | Back, arms and posture (maintenance, no lateral-delt work) plus cable crunch and reverse crunch |
| Wed | Lower B | Leg press / hack squat, reverse lunge, glute bridge, leg extension, hamstring curl, abduction |
| Thu | Lower C | Moderate-load hip thrust, cable kickback, 45° back extension, abduction, light leg extension, dead bug |
| Fri | Dance night | No lifting. Higher-carb targets. One tap logs the dancing, or it's detected from an Apple Watch dance workout. |

The optional "Core + recovery" session is still in the library for weekends. Upgrading an existing install moves you onto this schedule. Days already logged keep their original day type and targets, and your old Friday targets carry over to dance night.

## Editing nutrition

- **A food's default values:** tap ⋯ on any Quick Log item → *Edit default nutrition*. You can also go to Food → Your foods.
- **Recipes and meals:** these are calculated from their ingredients by default. Switch on *Set nutrition totals myself* to use the numbers from a label or restaurant instead.
- **Restore defaults:** *Restore the app's default values* puts back the preloaded numbers.
- **One logged entry only:** open the entry → *Correct the numbers for this entry only*.

Editing an entry's time, meal or quantity keeps the nutrition values that were saved when you logged it.

## Apple Watch / Apple Health

A website can't read HealthKit, so data comes in two ways:

- **Import link:** `…/#/import?workout=Strength&start=16:05&min=55&hr=128&sleep=7.5&rhr=58`. Repeat `w=Type~start~minutes~avgHR` for more than one workout. An iOS Shortcut can build this link and open it, including on a time-of-day automation. Step-by-step instructions are in Settings → Apple Watch & Health.
- **CSV import** from a Health export app. Columns are detected automatically, and re-importing updates rather than duplicates.

Imported workouts show on Today, in the workout summary and in the Workout tab. Sleep hours and resting heart rate fill in the daily check-in. Calories burned are never imported. Fully automatic background sync would need a native iPhone app.

## Automated tests

- `src/test/engine.test.ts` (33 tests, including the v2 migration, manual meal totals, and the Apple Health link and CSV parsing): recipe math, history snapshots and target changes, edit behaviour, add-ons and modifiers, double progression, pain flags and PRs, the meal-timing examples from the spec, suggestions, moving averages, all four weekly decision outcomes, cycle day, and the zip CRC.
- `scripts/e2e.mjs`: runs in a real browser at phone size. Covers setup, quick log and uncheck and undo, the no-duplicate stepper, a customized poke bowl, suggestions, workout set, rest timer and summary, and the weekly check-in and recommendation. It also fails on any console error.
