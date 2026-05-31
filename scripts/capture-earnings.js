const path = require('path')
const ROOT = path.join(__dirname, '..')
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))
const OUT = path.join(ROOT, 'website', 'public', 'help', 'screenshots', 'merchant')

async function main() {
  let browser
  for (const channel of ['msedge', 'chrome', null]) { try { browser = await chromium.launch(channel ? { channel } : {}); break } catch {} }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await page.goto('http://localhost:5174/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill('merchant@test.com')
  await page.locator('#password').fill('merchant123')
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
  await page.goto('http://localhost:5174/dashboard/earnings', { waitUntil: 'domcontentloaded' })
  await page.getByText('Available Balance').first().waitFor({ timeout: 12000 })
  await page.waitForTimeout(1800)
  await page.screenshot({ path: path.join(OUT, 'earnings.png') })
  console.log('captured earnings.png')
  await browser.close()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
