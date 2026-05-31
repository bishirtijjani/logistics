/**
 * capture-missing.js - robustly capture the logged-in Help Center screenshots
 * that the main script's networkidle waits made flaky (Settings/Earnings have a
 * live map + websocket that never go "idle"). Uses domcontentloaded + explicit
 * element waits instead.
 *
 * Run:  node scripts/capture-missing.js
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
try {
  require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(ROOT, 'backend', '.env') })
} catch {}
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))

const MERCHANT_URL = 'http://localhost:5174'
const LOGIN = { email: 'merchant@test.com', password: 'merchant123' }
const OUT = path.join(ROOT, 'website', 'public', 'help', 'screenshots', 'merchant')

const ok = []
const fail = []
async function shot(page, name, prep) {
  try {
    if (prep) await prep()
    await page.waitForTimeout(700)
    await page.screenshot({ path: path.join(OUT, name) })
    ok.push(name)
    console.log('   captured ' + name)
  } catch (e) {
    fail.push(name + '  (' + e.message.split('\n')[0] + ')')
    console.log('   FAILED  ' + name + '  -> ' + e.message.split('\n')[0])
  }
}

async function login(page) {
  await page.goto(MERCHANT_URL + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill(LOGIN.email)
  await page.locator('#password').fill(LOGIN.password)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
}

async function main() {
  // The product modal is the exact same component the wizard uses, so reuse it.
  try {
    fs.copyFileSync(path.join(OUT, '05-wizard-product.png'), path.join(OUT, 'products-new.png'))
    ok.push('products-new.png (copied from wizard)')
    console.log('   copied 05-wizard-product.png -> products-new.png')
  } catch (e) {
    console.log('   could not copy product modal: ' + e.message)
  }

  let browser
  for (const channel of ['msedge', 'chrome', null]) {
    try { browser = await chromium.launch(channel ? { channel } : {}); break } catch {}
  }
  if (!browser) throw new Error('no browser')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  await login(page)

  await shot(page, 'earnings-withdraw.png', async () => {
    await page.goto(MERCHANT_URL + '/dashboard/earnings', { waitUntil: 'domcontentloaded' })
    const btn = page.getByRole('button', { name: /Request Withdrawal/i })
    await btn.waitFor({ state: 'visible', timeout: 15000 })
    await page.waitForTimeout(1800) // let the wallet load so the button enables
    await btn.click()
    await page.getByRole('heading', { name: /Request Withdrawal/i }).waitFor({ timeout: 8000 })
  })

  await shot(page, 'settings-profile.png', async () => {
    await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'domcontentloaded' })
    await page.getByText('Profile Information').waitFor({ timeout: 12000 })
    await page.waitForTimeout(1800) // let the map settle
  })

  await shot(page, 'settings-security.png', async () => {
    await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /^Security$/ }).click()
    await page.getByText('Password Management').waitFor({ timeout: 8000 })
    await page.waitForTimeout(600)
  })

  await shot(page, 'support-new-ticket.png', async () => {
    await page.goto(MERCHANT_URL + '/dashboard/support', { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: /New ticket/i }).click()
    await page.getByRole('heading', { name: /New support ticket/i }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(500)
  })

  await browser.close()
  console.log('\nDone. ' + ok.length + ' ok:\n  - ' + ok.join('\n  - '))
  if (fail.length) console.log(fail.length + ' failed:\n  - ' + fail.join('\n  - '))
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
