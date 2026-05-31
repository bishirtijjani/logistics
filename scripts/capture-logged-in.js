/**
 * capture-logged-in.js - definitive, clean capture of all logged-in merchant
 * screens for the Help Center.
 *
 * The onboarding wizard auto-opens on every page load when a product/location
 * check briefly races, and page.goto reloads the app each time - so we DISMISS
 * the wizard (via a real React click on its close button) after every
 * navigation, before screenshotting. Uses domcontentloaded + dispatchEvent so
 * nothing hangs on networkidle or gets intercepted.
 *
 * Run:  node scripts/capture-logged-in.js
 */

const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
try { require(path.join(ROOT, 'backend', 'node_modules', 'dotenv')).config({ path: path.join(ROOT, 'backend', '.env') }) } catch {}
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))
const { PrismaClient } = require(path.join(ROOT, 'backend', 'node_modules', '@prisma/client'))

const prisma = new PrismaClient()
const MERCHANT_URL = 'http://localhost:5174'
const OUT = path.join(ROOT, 'website', 'public', 'help', 'screenshots', 'merchant')
const ok = [], fail = []

async function dismissWizard(page) {
  // Click the wizard's close (X) button directly in the DOM so React's onClick
  // (handleSkip) fires regardless of overlays. No-op if the wizard isn't open.
  await page.evaluate(() => {
    const h = [...document.querySelectorAll('h2')].find((e) => e.textContent.trim() === 'Setup Your Business')
    if (!h) return
    const row = h.closest('div.justify-between') || (h.parentElement && h.parentElement.parentElement && h.parentElement.parentElement.parentElement)
    const btn = row && row.querySelector('button')
    if (btn) btn.click()
  })
  await page.waitForTimeout(400)
}

async function gotoClean(page, url, readyText) {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  if (readyText) await page.getByText(readyText).first().waitFor({ timeout: 12000 })
  await page.waitForTimeout(1600) // give the wizard a chance to auto-open...
  await dismissWizard(page) // ...then close it
  await page.waitForTimeout(500)
}

async function shot(page, name, prep) {
  try {
    await prep()
    await page.waitForTimeout(500)
    await page.screenshot({ path: path.join(OUT, name) })
    ok.push(name); console.log('   captured ' + name)
  } catch (e) { fail.push(name); console.log('   FAILED ' + name + ' -> ' + e.message.split('\n')[0]) }
}

async function login(page) {
  await page.goto(MERCHANT_URL + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill('merchant@test.com')
  await page.locator('#password').fill('merchant123')
  await page.getByRole('button', { name: /Sign In/i }).click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 })
}

async function main() {
  // Make sure the demo merchant has a real location + open status.
  const m = await prisma.merchant.findFirst({ where: { OR: [{ email: 'merchant@test.com' }, { user: { email: 'merchant@test.com' } }] } })
  await prisma.merchant.update({ where: { id: m.id }, data: { lat: 13.0059, lng: 7.6017, address: '123 Test Street, Katsina', isOpen: true } })
  await prisma.$disconnect()

  let browser
  for (const channel of ['msedge', 'chrome', null]) { try { browser = await chromium.launch(channel ? { channel } : {}); break } catch {} }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await login(page)

  await shot(page, 'orders.png', () => gotoClean(page, MERCHANT_URL + '/dashboard/orders', 'Manage incoming and ongoing orders'))
  await shot(page, 'products.png', () => gotoClean(page, MERCHANT_URL + '/dashboard/menu', 'Add and manage everything you sell'))
  await shot(page, 'products-new.png', async () => {
    await gotoClean(page, MERCHANT_URL + '/dashboard/menu', 'Add and manage everything you sell')
    await page.locator('button:has-text("New Product")').dispatchEvent('click')
    await page.getByRole('heading', { name: /New product/i }).waitFor({ timeout: 10000 })
  })
  await shot(page, 'earnings.png', () => gotoClean(page, MERCHANT_URL + '/dashboard/earnings', 'Available Balance'))
  await shot(page, 'earnings-withdraw.png', async () => {
    await gotoClean(page, MERCHANT_URL + '/dashboard/earnings', 'Available Balance')
    await page.locator('button:has-text("Request Withdrawal")').dispatchEvent('click')
    await page.getByRole('heading', { name: /Request Withdrawal/i }).waitFor({ timeout: 10000 })
  })
  await shot(page, 'settings-profile.png', () => gotoClean(page, MERCHANT_URL + '/dashboard/settings', 'Profile Information'))
  await shot(page, 'settings-security.png', async () => {
    await gotoClean(page, MERCHANT_URL + '/dashboard/settings', 'Profile Information')
    await page.getByRole('button', { name: 'Security', exact: true }).dispatchEvent('click')
    await page.getByText('Password Management').waitFor({ timeout: 10000 })
  })
  await shot(page, 'support.png', () => gotoClean(page, MERCHANT_URL + '/dashboard/support', 'Raise issues with the platform team'))
  await shot(page, 'support-new-ticket.png', async () => {
    await gotoClean(page, MERCHANT_URL + '/dashboard/support', 'Raise issues with the platform team')
    await page.locator('button:has-text("New ticket")').dispatchEvent('click')
    await page.getByRole('heading', { name: /New support ticket/i }).waitFor({ timeout: 10000 })
  })

  await browser.close()
  console.log('\nDone. ' + ok.length + ' ok: ' + ok.join(', '))
  if (fail.length) console.log('Failed: ' + fail.join(', '))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
