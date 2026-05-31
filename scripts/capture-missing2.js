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

  // --- settings security (force click the tab) ---
  try {
    await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'domcontentloaded' })
    const sec = page.getByRole('button', { name: 'Security', exact: true })
    await sec.waitFor({ state: 'visible', timeout: 10000 })
    await sec.click({ force: true })
    await page.getByText('Password Management').waitFor({ timeout: 8000 })
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, 'settings-security.png') })
    console.log('captured settings-security.png')
  } catch (e) { console.log('settings-security FAILED: ' + e.message.split('\n')[0]) }

  // --- earnings withdraw (diagnose disabled vs intercepted) ---
  try {
    await page.goto(MERCHANT_URL + '/dashboard/earnings', { waitUntil: 'domcontentloaded' })
    const wbtn = page.locator('button:has-text("Request Withdrawal")')
    await wbtn.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1500)
    const disabled = await wbtn.isDisabled()
    console.log('Request Withdrawal disabled? ' + disabled)
    if (disabled) {
      const bal = await page.locator('text=Available Balance').locator('xpath=following::p[1]').innerText().catch(() => '?')
      console.log('Available Balance shows: ' + bal)
    } else {
      await wbtn.click({ force: true })
      await page.getByRole('heading', { name: /Request Withdrawal/i }).waitFor({ timeout: 8000 })
      await page.waitForTimeout(500)
      await page.screenshot({ path: path.join(OUT, 'earnings-withdraw.png') })
      console.log('captured earnings-withdraw.png')
    }
  } catch (e) { console.log('earnings-withdraw FAILED: ' + e.message.split('\n')[0]) }

  await browser.close()
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
