import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'screenshots');
const BASE = 'http://localhost:5299';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14 Pro

// Seed localStorage with Maria Lopez (chores_done: 0)
await page.goto(BASE, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('memberId', 'member-uuid-1'));

// --- HOME (Maria, 0 chores) ---
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: join(OUT, '01-home-maria.png') });

// --- EVENTS ---
await page.goto(`${BASE}/events`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '02-events.png') });

// --- CIRCLE ---
await page.goto(`${BASE}/circle`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '03-circle.png') });

// --- CHORES (David Kim, chores_done: 3 — celebration) ---
await page.evaluate(() => localStorage.setItem('memberId', 'member-uuid-4'));
await page.goto(`${BASE}/chores`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.screenshot({ path: join(OUT, '04-chores-celebrate.png') });

// --- HOME (David, celebration) ---
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
await page.screenshot({ path: join(OUT, '05-home-david.png') });

// --- PROFILE ---
await page.evaluate(() => localStorage.setItem('memberId', 'member-uuid-1'));
await page.goto(`${BASE}/profile`, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.screenshot({ path: join(OUT, '06-profile.png') });

// --- LOGIN ---
await page.evaluate(() => localStorage.removeItem('memberId'));
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
await page.screenshot({ path: join(OUT, '07-login.png') });

await browser.close();
console.log('Done — 7 screenshots written to /screenshots/');
