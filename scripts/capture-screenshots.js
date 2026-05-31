/**
 * capture-screenshots.js - auto-capture Help Center screenshots from the running
 * local merchant dashboard, using the seeded demo merchant (merchant@test.com).
 *
 * Each shot is best-effort (its own try/catch) so one failure never aborts the
 * rest. Output: website/public/help/screenshots/merchant/*.png
 *
 * Run:  node scripts/capture-screenshots.js
 */

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')).config({
  path: path.join(ROOT, 'backend', '.env'),
})
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))
const { PrismaClient } = require(path.join(ROOT, 'backend', 'node_modules', '@prisma/client'))

const prisma = new PrismaClient()
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
  await page.goto(MERCHANT_URL + '/login', { waitUntil: 'networkidle' })
  await page.locator('#email').fill(LOGIN.email)
  await page.locator('#password').fill(LOGIN.password)
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })

  const m = await prisma.merchant.findFirst({
    where: { OR: [{ email: LOGIN.email }, { user: { email: LOGIN.email } }] },
  })
  if (!m) throw new Error('demo merchant not found - run prisma seed first')
  const original = { lat: m.lat, lng: m.lng, address: m.address }

  let browser
  for (const channel of ['msedge', 'chrome', null]) {
    try {
      browser = await chromium.launch(channel ? { channel } : {})
      console.log('   launched browser channel: ' + (channel || 'bundled'))
      break
    } catch (e) {
      console.log('   channel ' + channel + ' unavailable: ' + e.message.split('\n')[0])
    }
  }
  if (!browser) throw new Error('No usable browser (msedge/chrome/bundled all failed)')
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  // ============ 1. Registration + OTP (public) ============
  const stamp = Date.now()
  const email = 'shot' + stamp + '@iprime.ng'
  const phone = '080' + String(stamp % 1e8).padStart(8, '0')
  try {
    await page.goto(MERCHANT_URL + '/register', { waitUntil: 'networkidle' })
    await page.getByPlaceholder('John', { exact: true }).fill('Amina')
    await page.getByPlaceholder('Doe', { exact: true }).fill('Bello')
    await page.getByPlaceholder('john@example.com').fill(email)
    await page.getByPlaceholder('08012345678').fill(phone)
    await page.getByPlaceholder('Min. 8 characters').fill('password123')
    await page.getByPlaceholder('Re-enter password').fill('password123')
    await shot(page, '01-signup-step1.png')

    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.waitForTimeout(600)
    await page.locator('button:has-text("Food")').first().click().catch(() => {})
    await page.getByPlaceholder('My Restaurant').fill('Amina Kitchen')
    await page.getByPlaceholder('08098765432').fill(phone)
    await page.getByPlaceholder('business@example.com').fill(email)
    await page.getByRole('button', { name: /^Next$/ }).click()
    await page.waitForTimeout(400)
    await page.getByRole('button', { name: /Complete Registration/i }).click()
    await page.getByText('Verify Your Email').waitFor({ timeout: 15000 })
    await shot(page, '02-verify-email.png')
  } catch (e) {
    fail.push('registration flow  (' + e.message.split('\n')[0] + ')')
    console.log('   FAILED registration flow -> ' + e.message.split('\n')[0])
  }

  // ============ 2. Onboarding wizard (location -> hours -> product) ============
  try {
    await prisma.merchant.update({ where: { id: m.id }, data: { lat: 0, lng: 0, address: 'Pending location' } })
    await login(page)
    await page.getByText('Setup Your Business').waitFor({ timeout: 20000 })
    await page.getByRole('button', { name: /^Next$/ }).click() // Welcome -> Location
    await page.getByText('Pin Your Business Location').waitFor({ timeout: 8000 })
    await page.waitForTimeout(1300)
    await shot(page, '03-wizard-location.png')

    // set a location via search to advance through the rest of the wizard
    await page.getByPlaceholder(/Search for a business or address/i).fill('Katsina')
    await page.locator('ul li button').first().waitFor({ timeout: 8000 })
    await page.locator('ul li button').first().click()
    await page.waitForTimeout(1800)
    await page.getByRole('button', { name: /^Next$/ }).click() // Location -> Product
    const addBtn = page.getByRole('button', { name: /Add your first product/i })
    await addBtn.waitFor({ state: 'visible', timeout: 8000 })
    await addBtn.click()
    await page.getByRole('heading', { name: /New product/i }).waitFor({ timeout: 8000 })
    await page.waitForTimeout(500)
    await shot(page, '05-wizard-product.png')
  } catch (e) {
    fail.push('wizard flow  (' + e.message.split('\n')[0] + ')')
    console.log('   FAILED wizard flow -> ' + e.message.split('\n')[0])
  } finally {
    await prisma.merchant.update({ where: { id: m.id }, data: original }) // restore real location
  }

  // ============ 3. Logged-in screens for the rest of the guides ============
  try {
    await login(page) // location restored, no wizard

    await shot(page, 'orders.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/orders', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1400)
    })

    await shot(page, 'products.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/menu', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1400)
    })

    await shot(page, 'products-new.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/menu', { waitUntil: 'networkidle' })
      await page.waitForSelector('button:has-text("New Product"):not([disabled])', { timeout: 12000 })
      await page.getByRole('button', { name: /New Product/i }).click()
      await page.getByRole('heading', { name: /New product/i }).waitFor({ timeout: 8000 })
      await page.waitForTimeout(500)
    })

    await shot(page, 'earnings.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/earnings', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
    })

    await shot(page, 'earnings-withdraw.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/earnings', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
      await page.getByRole('button', { name: /Request Withdrawal/i }).click()
      await page.getByRole('heading', { name: /Request Withdrawal/i }).waitFor({ timeout: 8000 })
      await page.waitForTimeout(400)
    })

    await shot(page, 'settings-profile.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1500)
    })

    await shot(page, 'settings-security.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/settings', { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: /^Security$/ }).click()
      await page.waitForTimeout(800)
    })

    await shot(page, 'support.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/support', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1400)
    })

    await shot(page, 'support-new-ticket.png', async () => {
      await page.goto(MERCHANT_URL + '/dashboard/support', { waitUntil: 'networkidle' })
      await page.waitForTimeout(1000)
      await page.getByRole('button', { name: /New ticket/i }).click()
      await page.getByRole('heading', { name: /New support ticket/i }).waitFor({ timeout: 8000 })
      await page.waitForTimeout(400)
    })
  } catch (e) {
    fail.push('logged-in flow  (' + e.message.split('\n')[0] + ')')
    console.log('   FAILED logged-in flow -> ' + e.message.split('\n')[0])
  }

  await browser.close()
  await prisma.$disconnect()

  console.log('\nDone. Captured ' + ok.length + ':\n  - ' + ok.join('\n  - '))
  if (fail.length) console.log('Not captured ' + fail.length + ':\n  - ' + fail.join('\n  - '))
  console.log('\nOutput: ' + OUT)
}

main().catch((e) => {
  console.error('FATAL', e)
  process.exit(1)
})
