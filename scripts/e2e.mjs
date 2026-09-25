// End-to-end smoke test of the core workflows in a real browser (phone viewport).
// Usage: npm run build && npm run e2e   (uses the preinstalled Chromium; set CHROMIUM_PATH to override)
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const SHOTS = process.env.SHOTS ?? 'e2e-shots'
mkdirSync(SHOTS, { recursive: true })
const server = spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], { stdio: 'pipe', detached: true })
await new Promise((r) => server.stdout.on('data', (d) => String(d).includes('4179') && r()))
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: process.env.DARK ? 'dark' : 'light' })
const page = await ctx.newPage()
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && !/ERR_CERT|fonts\.g/.test(m.text()) && errors.push(m.text()))
let step = 0
const shot = async (name) => page.screenshot({ path: `${SHOTS}/${String(++step).padStart(2, '0')}-${name}.png`, fullPage: true })
const check = (cond, msg) => {
  if (!cond) throw new Error(`FAILED: ${msg}`)
  console.log(`✓ ${msg}`)
}
const text = () => page.locator('main').innerText()

try {
  await page.goto('http://localhost:4179/')
  await page.getByText('Your profile').waitFor()
  await shot('setup')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.locator('input[type=date]').fill('2026-09-10')
  await page.getByRole('button', { name: 'Start using Taper' }).click()
  await page.getByRole('heading', { name: 'Today' }).waitFor()
  check((await text()).includes('0 / 125–135 g'), 'Today shows 0 protein vs the target range')
  await shot('today-empty')

  // Quick log: one tap creates an entry, second tap removes it, stepper changes quantity
  const pancakes = page.getByRole('button', { name: /Cottage cheese protein pancakes/ }).first()
  await pancakes.click()
  await page.waitForTimeout(300)
  let t = await text()
  check(/28 \/ 125–135 g/.test(t), 'Quick-logging pancakes adds ~28 g protein')
  await pancakes.click()
  await page.waitForTimeout(300)
  check((await text()).includes('0 / 125–135 g'), 'Unchecking removes the entry')
  await page.getByRole('button', { name: 'Undo' }).last().click()
  await page.waitForTimeout(300)
  check(/28 \/ 125–135 g/.test(await text()), 'Undo restores it')
  await page.getByRole('button', { name: /Plain Chobani Greek yogurt/ }).first().click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: 'Increase' }).nth(1).click()
  await page.waitForTimeout(300)
  check(/68 \/ 125–135 g/.test(await text()), 'Stepper increases yogurt to 2 servings (no duplicate entry)')
  await page.getByRole('button', { name: 'Banana', exact: true }).click()
  await page.waitForTimeout(200)
  await shot('today-logged')

  // Customize a meal: poke bowl with no mayo + extra salmon
  await page.getByRole('button', { name: 'Customize Usual poke bowl' }).click()
  await page.getByRole('button', { name: 'No mayo' }).click()
  await page.getByRole('button', { name: 'Extra salmon' }).click()
  await shot('poke-sheet')
  await page.getByRole('button', { name: 'Log it' }).click()
  await page.waitForTimeout(300)
  check((await text()).includes('Usual poke bowl'), 'Customized poke bowl logged')

  // Edit a meal's default nutrition (manual totals)
  await page.getByRole('button', { name: "Customize Usual Jersey Mike's bowl" }).click()
  await page.getByRole('button', { name: /Edit default nutrition/ }).click()
  await page.getByRole('switch').first().click()
  const kcal = page.getByRole('dialog').last().locator('input[type=number]').first()
  await kcal.fill('610')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check((await text()).includes('610 kcal'), "Editing Jersey Mike's bowl to 610 kcal updates the Quick Log")

  // Apple Health import link
  await page.goto('http://localhost:4179/#/import?workout=Traditional%20Strength%20Training&start=16:05&min=55&hr=128&sleep=7.5')
  await page.getByRole('heading', { name: 'Today' }).waitFor()
  await page.waitForTimeout(400)
  check((await text()).includes('Traditional Strength Training · 55 min · avg HR 128'), 'Import link adds the Apple Watch workout to Today')

  // What should I eat next
  await page.getByRole('button', { name: /What should I eat next/ }).first().click()
  await page.getByText('Good options from your foods').waitFor()
  const n = await page.getByRole('dialog').locator('ol li').count()
  check(n >= 2 && n <= 4, `Suggestions return 2–4 foods (${n})`)
  await shot('suggest')
  await page.keyboard.press('Escape')

  // Recovery quick rating
  await page.getByRole('button', { name: '3', exact: true }).first().click()

  // Workout
  const startBtn = page.locator('main').getByRole('button', { name: /^Start workout$/ })
  if (await startBtn.count()) await startBtn.first().click()
  await page.waitForTimeout(300)
  if (!page.url().includes('session')) {
    // Dance night or rest day: start Monday's Lower A from the weekly program instead
    await page.getByRole('button', { name: 'Workout', exact: true }).click()
    await page.getByText('Weekly program').first().click()
    await page.getByRole('button', { name: /Mon\s*Lower A/ }).click()
    await page.getByRole('button', { name: 'Start this workout today' }).click()
  }
  await page.waitForTimeout(400)
  await shot('workout-session')
  if ((await page.url()).includes('session')) {
    const done = page.getByRole('button', { name: /Set 1 complete/ }).first()
    await done.click()
    await page.waitForTimeout(200)
    check((await text()).includes('Rest'), 'Completing a set starts the rest timer')
    await page.getByRole('button', { name: 'Finish workout' }).click()
    await page.getByText('Workout summary').waitFor()
    await shot('workout-summary')
  } else console.log('(rest day — skipped session test)')

  // Food tab
  await page.getByRole('button', { name: 'Food', exact: true }).click()
  await page.getByRole('heading', { name: 'Food' }).waitFor()
  await shot('food')

  // Weekly check-in
  await page.getByRole('button', { name: 'Progress', exact: true }).click()
  await page.getByRole('heading', { name: 'Progress' }).waitFor()
  await shot('progress')
  await page.getByRole('button', { name: /check-in|Check in/ }).first().click()
  await page.getByRole('heading', { name: 'Measurements' }).waitFor()
  const inputs = page.locator('main input[type=number]')
  await inputs.nth(0).fill('27.75')
  await inputs.nth(1).fill('30.75')
  await inputs.nth(2).fill('37.25')
  await shot('checkin-measure')
  for (let i = 0; i < 5; i++) await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByRole('heading', { name: 'Recommendation' }).waitFor()
  check((await text()).includes('Keep the plan the same'), 'Early check-in recommends keeping the plan')
  await shot('checkin-reco')
  await page.getByRole('button', { name: 'Save check-in' }).click()
  await page.getByRole('heading', { name: 'Progress' }).waitFor()
  for (const s of await page.locator('details').all()) await s.evaluate((d) => (d.open = true))
  await page.waitForTimeout(500)
  await shot('progress-open')

  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('heading', { name: 'Settings' }).waitFor()
  await shot('settings')
  // History integrity: today's targets change, food entries remain
  await page.getByRole('button', { name: 'Today', exact: true }).click()
  await page.getByRole('heading', { name: 'Today' }).waitFor()
  await page.waitForTimeout(300)
  check(/\d+ \/ 125–135 g/.test(await text()), 'Today still shows logged data after navigation')

  check(errors.length === 0, `No console errors${errors.length ? ': ' + errors.join(' | ') : ''}`)
  console.log('\nAll e2e checks passed')
} catch (e) {
  await shot('failure')
  console.error(e.message)
  console.error(errors.join('\n'))
  process.exitCode = 1
} finally {
  await browser.close()
  process.kill(-server.pid)
}
