// Builds a single self-contained HTML file (all JS/CSS inlined) at dist-single/hourglass.html.
import { execSync } from 'node:child_process'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'

execSync('npx vite build', { stdio: 'inherit', env: { ...process.env, SINGLE_FILE: '1' } })
const dir = 'dist-single/assets'
const files = readdirSync(dir)
const js = files.filter((f) => f.endsWith('.js'))
if (js.length !== 1) throw new Error(`Expected one JS chunk, got ${js.join(', ')}`)
const script = readFileSync(`${dir}/${js[0]}`, 'utf8').replace(/<\/script/gi, '<\\/script')
const css = files.filter((f) => f.endsWith('.css')).map((f) => readFileSync(`${dir}/${f}`, 'utf8')).join('\n')

const html = `<title>Lower-Body Hourglass</title>
<meta name="theme-color" content="#b24a6b">
<style>${css}</style>
<div id="root"></div>
<script type="module">${script}</script>
`
writeFileSync('dist-single/hourglass.html', html)
console.log(`dist-single/hourglass.html  ${(html.length / 1024).toFixed(0)} kB`)
