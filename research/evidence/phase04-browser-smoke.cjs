const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.EKMS_BROWSER_ORIGIN ?? 'http://127.0.0.1:3000';
const output = path.join(__dirname, 'phase04-visual');
const axePath = require.resolve('axe-core/axe.min.js');
const password = randomBytes(24).toString('base64url');
const emails = [0, 1].map(() => `p04-browser-${randomUUID()}@example.test`);
const created = [];
const viewports = [375, 390, 768, 1280, 1440];
let browser;
let layoutChecks = 0;
let accessibilityChecks = 0;
let pageErrors = 0;

async function inspect(page, name, width, axe = false) {
  await page.setViewportSize({ width, height: width < 500 ? 820 : 900 });
  const layout = await page.evaluate(() => ({
    viewport: innerWidth,
    document: document.documentElement.scrollWidth,
    h1: document.querySelectorAll('h1').length,
    offscreen: [...document.querySelectorAll('button, nav a, input, select')]
      .filter((element) => element.getClientRects().length)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth + 1;
      }).length,
  }));
  assert.equal(layout.viewport, width);
  assert.ok(layout.document <= width + 1, `${name}@${width}: horizontal overflow`);
  assert.equal(layout.h1, 1, `${name}@${width}: heading count`);
  assert.equal(layout.offscreen, 0, `${name}@${width}: offscreen controls`);
  layoutChecks++;
  if (axe) {
    await page.addScriptTag({ path: axePath });
    const violations = await page.evaluate(async () => {
      const result = await window.axe.run(document, {
        runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] },
      });
      return result.violations.map((entry) => entry.id);
    });
    assert.deepEqual(violations, [], `${name}@${width}: axe violations`);
    accessibilityChecks++;
  }
}

async function screenshot(page, name) {
  await page.screenshot({ path: path.join(output, name), fullPage: true, animations: 'disabled' });
}

async function account(page, email) {
  await page.goto('/auth');
  await page.getByRole('button', { name: 'Create an account' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(password);
  const registered = page.waitForResponse((res) => res.url().endsWith('/api/v1/auth/register'));
  await page.getByRole('button', { name: 'Create account' }).click();
  assert.equal((await registered).status(), 201);
  created.push(email);
  await page.getByText('Account created. Sign in to continue.').waitFor();
  await page.getByLabel('Password').fill(password);
  const loggedIn = page.waitForResponse((res) => res.url().endsWith('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  assert.equal((await loggedIn).status(), 201);
  await page.waitForURL('**/app');
}

async function run() {
  mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: origin, viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on('pageerror', () => pageErrors++);
    await page.goto('/vocabulary');
    await page.waitForURL('**/auth');
    assert.equal(await page.getByText('Personal library').count(), 0);
    await account(page, emails[0]);
    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Vocabulary' }).click();
    await page.getByRole('heading', { name: 'My words' }).waitFor();
    await page.getByText('Your library is empty').waitFor();
    for (const width of viewports) await inspect(page, 'empty', width, width === 390 || width === 1440);
    await page.setViewportSize({ width: 1440, height: 900 });
    await screenshot(page, 'empty-library-desktop-1440.png');

    await page.getByRole('button', { name: 'Quick Add' }).focus();
    await page.keyboard.press('Enter');
    await page.getByRole('heading', { name: 'Quick Add' }).waitFor();
    await page.getByLabel('English word or phrase').fill('issue');
    await page.getByLabel('Part of speech').selectOption('NOUN');
    await page.getByLabel('Your target meaning').fill('một vấn đề');
    assert.ok(await page.getByLabel(/Source context/).count());
    await inspect(page, 'quick-add', 1440, true);
    await screenshot(page, 'quick-add-desktop-1440.png');
    await inspect(page, 'quick-add', 390, true);
    await screenshot(page, 'quick-add-mobile-390.png');
    const saved = page.waitForResponse((res) => res.url().endsWith('/api/v1/vocabulary') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save word' }).click();
    assert.equal((await saved).status(), 201);
    await page.getByText('Word saved.').waitFor();
    await page.getByText('No source context saved.').waitFor();
    for (const width of viewports) await inspect(page, 'populated', width, width === 375 || width === 1280);
    await screenshot(page, 'populated-library-desktop-1440.png');
    await inspect(page, 'detail', 375, true);
    await screenshot(page, 'detail-mobile-375.png');
    await page.setViewportSize({ width: 1440, height: 900 });
    await screenshot(page, 'detail-desktop-1440.png');

    await page.getByLabel('New tag').fill('Study topic');
    await page.getByRole('button', { name: 'Add tag' }).click();
    await page.getByRole('listitem').getByText('Study topic', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Edit word' }).click();
    await page.getByLabel(/Source context/).fill('I encountered this issue in a report.');
    await page.getByLabel('Personal note').fill('Review this meaning.');
    await page.getByRole('checkbox', { name: 'Study topic' }).check();
    await inspect(page, 'editing', 1440, true);
    await screenshot(page, 'editing-desktop-1440.png');
    await page.getByRole('button', { name: 'Save changes' }).click();
    await page.getByText('Review this meaning.').waitFor();
    await page.getByText('I encountered this issue in a report.').waitFor();
    await page.getByLabel('Filter by tag').selectOption({ label: 'Study topic' });
    await page.getByRole('button', { name: /issue.*một vấn đề/i }).waitFor();
    await page.getByLabel('Search words or meanings').fill('issue');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('button', { name: /issue.*một vấn đề/i }).waitFor();
    await page.getByLabel('Filter by tag').selectOption('');

    await page.getByRole('button', { name: 'Quick Add' }).click();
    await page.getByLabel('English word or phrase').fill('issue');
    await page.getByLabel('Part of speech').selectOption('NOUN');
    await page.getByLabel('Your target meaning').fill('một vấn đề');
    const duplicate = page.waitForResponse((res) => res.url().endsWith('/api/v1/vocabulary') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save word' }).click();
    assert.equal((await duplicate).status(), 200);
    await page.getByText(/already saved/).waitFor();

    await page.getByRole('button', { name: 'Quick Add' }).click();
    await page.getByLabel('English word or phrase').fill('issue');
    await page.getByLabel('Part of speech').selectOption('NOUN');
    await page.getByLabel('Your target meaning').fill('bản phát hành');
    const second = page.waitForResponse((res) => res.url().endsWith('/api/v1/vocabulary') && res.request().method() === 'POST');
    await page.getByRole('button', { name: 'Save word' }).click();
    assert.equal((await second).status(), 201);
    await page.getByText('bản phát hành').first().waitFor();
    await page.getByRole('button', { name: 'Archive word' }).click();
    await page.getByRole('button', { name: 'Confirm archive' }).click();
    await page.getByText(/Archived\. Restore this sense/).waitFor();
    await page.getByLabel('Library status').selectOption('archived');
    await page.getByRole('button', { name: /issue.*bản phát hành/i }).click();
    await page.getByRole('button', { name: 'Restore word' }).waitFor();
    await inspect(page, 'archived', 1440, true);
    await screenshot(page, 'archived-library-desktop-1440.png');
    await page.getByRole('button', { name: 'Restore word' }).click();
    await page.getByRole('button', { name: 'Confirm restore' }).click();
    await page.getByLabel('Library status').selectOption('active');
    await page.reload();
    await page.getByRole('heading', { name: 'My words' }).waitFor();
    await page.getByRole('button', { name: /issue.*một vấn đề/i }).waitFor();
    await page.getByRole('button', { name: /issue.*bản phát hành/i }).waitFor();

    const secondContext = await browser.newContext({ baseURL: origin });
    const other = await secondContext.newPage();
    await account(other, emails[1]);
    await other.goto('/vocabulary');
    await other.getByText('Your library is empty').waitFor();
    assert.equal(await other.getByRole('button', { name: /issue.*một vấn đề/i }).count(), 0);
    await secondContext.close();

    await page.getByRole('navigation', { name: 'Workspace' }).getByRole('link', { name: 'Account and security' }).click();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/auth');
    await page.goto('/vocabulary');
    await page.waitForURL('**/auth');
    assert.equal(await page.getByText('Personal library').count(), 0);
    assert.equal(pageErrors, 0);
    console.log(JSON.stringify({ layoutChecks, accessibilityChecks, accessibilityViolations: 0, pageErrors, manualWithoutContext: 'PASS', duplicateOpenedExisting: 'PASS', secondSense: 'PASS', tagAndFilter: 'PASS', archiveRestore: 'PASS', reloadPersistence: 'PASS', secondAccountIsolation: 'PASS', logoutProtection: 'PASS' }));
    await context.close();
  } finally {
    await browser?.close();
    for (const email of created) {
      const cleanup = spawnSync('docker', [
        'compose', 'exec', '-T', '-e', `SMOKE_EMAIL=${email}`, 'postgres', 'sh', '-lc',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v target="$SMOKE_EMAIL" -v ON_ERROR_STOP=1',
      ], { input: "DELETE FROM users WHERE normalized_email = :'target';\n", encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal(cleanup.status, 0, 'Temporary browser account cleanup failed');
      assert.match(cleanup.stdout, /DELETE 1/);
    }
    console.log(`temporary_browser_users_deleted=${created.length}`);
  }
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Browser smoke failed');
  process.exitCode = 1;
});
