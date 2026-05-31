const path = require('path')
const ROOT = path.join(__dirname, '..')
try { require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(ROOT, 'backend', '.env') }) } catch {}
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))

const MERCHANT_URL = 'http://localhost:5174'
const OUT = path.join(ROOT, 'website', 'public', 'help', 'screenshots', 'merchant')

async function login(page) {
  await page.goto(MERCHANT_URL + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill('merchant@test.com')
  await page.locator('#password').fill('merchant123')
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
}

async function main() {
  let browser
  for (const channel of ['msedge', 'chrome', null]) { try { browser = await chromium.launch(channel ? { channel } : {}); break } catch {} }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await login(page)

  try {
    await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'domcontentloaded' })
    await page.getByText('Profile Information').waitFor({ timeout: 10000 })
    await page.getByRole('button', { name: 'Security', exact: true }).dispatchEvent('click')
    await page.getByText('Password Management').waitFor({ timeout: 10000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, 'settings-security.png') })
    console.log('captured settings-security.png')
  } catch (e) { console.log('settings-security FAILED: ' + e.message.split('\n')[0]) }

  try {
    await page.goto(MERCHANT_URL + '/dashboard/earnings', { waitUntil: 'domcontentloaded' })
    const wbtn = page.locator('button:has-text("Request Withdrawal")')
    await wbtn.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1500)
    await wbtn.dispatchEvent('click')
    await page.getByRole('heading', { name: /Request Withdrawal/i }).waitFor({ timeout: 10000 })
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, 'earnings-withdraw.png') })
    console.log('captured earnings-withdraw.png')
  } catch (e) { console.log('earnings-withdraw FAILED: ' + e.message.split('\n')[0]) }

  await browser.close()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
