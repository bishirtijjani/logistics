/**
 * capture-admin.js - capture Help Center screenshots from the admin dashboard.
 * Output: website/public/help/screenshots/admin/*.png
 * Run:  node scripts/capture-admin.js
 */
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..')
const { chromium } = require(path.join(ROOT, 'node_modules', 'playwright'))

const ADMIN = 'http://localhost:3001'
const OUT = path.join(ROOT, 'website', 'public', 'help', 'screenshots', 'admin')
const ok = [], fail = []

const PAGES = [
  ['dashboard', 'Dashboard', 'dashboard.png'],
  ['merchants', 'Merchant Management', 'merchants.png'],
  ['riders', 'Riders Management', 'riders.png'],
  ['requests', 'Requests', 'requests.png'],
  ['disputes', 'Order Disputes', 'disputes.png'],
  ['support', 'Support Tickets', 'support.png'],
  ['customers', 'Customers', 'customers.png'],
  ['transactions', 'Transactions', 'transactions.png'],
  ['financial', 'Financial Operations', 'financial.png'],
  ['categories', 'Merchant Categories', 'categories.png'],
  ['vtu-plans', 'VTU Pricing', 'vtu-plans.png'],
  ['vtu-networks', 'VTU Networks', 'vtu-networks.png'],
  ['marketing', 'Marketing Oversight', 'marketing.png'],
  ['settings', 'Settings', 'settings.png'],
  ['analytics', 'Platform Analytics', 'analytics.png'],
  ['safety', 'Safety & Compliance', 'safety.png'],
  ['waitlist', 'Pre-launch Waitlist', 'waitlist.png'],
  ['audit-logs', 'Audit Logs', 'audit-logs.png'],
]

async function shot(page, name, prep) {
  try {
    await prep()
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(OUT, name) })
    ok.push(name); console.log('   captured ' + name)
  } catch (e) { fail.push(name); console.log('   FAILED ' + name + ' -> ' + e.message.split('\n')[0]) }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  let browser
  for (const ch of ['msedge', 'chrome', null]) { try { browser = await chromium.launch(ch ? { channel: ch } : {}); break } catch {} }
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })

  // login
  await page.goto(ADMIN + '/login', { waitUntil: 'domcontentloaded' })
  await page.locator('#email').fill('admin@vtulogistics.com')
  await page.locator('#password').fill('admin123456')
  await page.locator('button[type="submit"]').click()
  await page.waitForURL('**/dashboard**', { timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(1200)

  for (const [route, h1, file] of PAGES) {
    await shot(page, file, async () => {
      await page.goto(ADMIN + '/' + route, { waitUntil: 'domcontentloaded' })
      await page.getByRole('heading', { name: h1, exact: true }).first().waitFor({ timeout: 12000 })
      await page.waitForTimeout(1600)
    })
  }

  await browser.close()
  console.log('\nDone. ' + ok.length + '/' + PAGES.length + ' captured.')
  if (fail.length) console.log('Failed: ' + fail.join(', '))
}
main().catch((e) => { console.error('FATAL', e); process.exit(1) })
