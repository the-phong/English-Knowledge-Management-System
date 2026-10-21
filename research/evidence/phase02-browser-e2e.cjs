const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { chromium } = require('playwright');

const origin = 'http://127.0.0.1:3000';
const email = `p02-browser-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
const responses = [];
let browser;
let created = false;

async function run() {
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ baseURL: origin });
    const page = await context.newPage();
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.startsWith('/api/v1/')) {
        responses.push({ path: url.pathname, status: response.status() });
      }
    });

    await page.goto('/app');
    await page.waitForURL('**/auth');
    assert.equal(await page.getByText('Welcome back').count(), 0);

    await page.getByRole('button', { name: 'Create an account' }).click();
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill(password);
    const registered = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/auth/register'),
    );
    await page.getByRole('button', { name: 'Create account' }).click();
    assert.equal((await registered).status(), 201);
    created = true;
    await page.getByText('Account created. Sign in to continue.').waitFor();

    await page.getByLabel('Password').fill(password);
    const loggedIn = page.waitForResponse((response) =>
      response.url().endsWith('/api/v1/auth/login'),
    );
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    assert.equal((await loggedIn).status(), 201);
    await page.waitForURL('**/app');
    await page.getByText(`Signed in as ${email}.`).waitFor();

    const authCookieUrl = `${origin}/api/v1/auth/refresh`;
    const cookie = (await context.cookies(authCookieUrl)).find(
      (item) => item.name === 'ekms_refresh',
    );
    assert.ok(cookie);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, 'Lax');
    assert.equal(cookie.path, '/api/v1/auth');
    assert.equal(cookie.secure, false);

    const beforeReload = responses.length;
    await page.reload();
    await page.getByText(`Signed in as ${email}.`).waitFor();
    const restoration = responses.slice(beforeReload);
    assert.ok(
      restoration.some(
        (item) => item.path === '/api/v1/auth/refresh' && item.status === 201,
      ),
    );
    assert.ok(
      restoration.some(
        (item) => item.path === '/api/v1/me' && item.status === 200,
      ),
    );

    const secondTab = await context.newPage();
    await Promise.all([page.reload(), secondTab.goto('/app')]);
    await Promise.all([
      page.getByText(`Signed in as ${email}.`).waitFor(),
      secondTab.getByText(`Signed in as ${email}.`).waitFor(),
    ]);
    await secondTab.close();

    await page.getByRole('link', { name: 'Account and security' }).click();
    await page.getByRole('heading', { name: 'Account and security' }).waitFor();
    await page.getByText('This session', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await page.waitForURL('**/auth');
    assert.equal(
      (await context.cookies(authCookieUrl)).filter(
        (item) => item.name === 'ekms_refresh',
      ).length,
      0,
    );
    await page.goto('/app');
    await page.waitForURL('**/auth');
    assert.equal(await page.getByText('Welcome back').count(), 0);

    const fallbackContext = await browser.newContext({ baseURL: origin });
    await fallbackContext.addInitScript(() => {
      Object.defineProperty(navigator, 'locks', {
        configurable: true,
        value: undefined,
      });
    });
    const fallbackPage = await fallbackContext.newPage();
    await fallbackPage.goto('/auth');
    assert.equal(
      await fallbackPage.evaluate(() => navigator.locks === undefined),
      true,
    );
    await fallbackPage.getByLabel('Email').fill(email);
    await fallbackPage.getByLabel('Password').fill(password);
    await fallbackPage
      .getByRole('button', { name: 'Sign in', exact: true })
      .click();
    await fallbackPage.waitForURL('**/app');
    await fallbackPage.reload();
    await fallbackPage.getByText(`Signed in as ${email}.`).waitFor();
    await fallbackPage.close();
    await fallbackContext.close();

    for (const path of [
      '/api/v1/auth/register',
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/me',
      '/api/v1/auth/sessions',
      '/api/v1/auth/logout',
    ]) {
      const result = responses.find(
        (item) => item.path === path && item.status < 400,
      );
      assert.ok(result, `Missing successful browser request for ${path}`);
      process.stdout.write(`${path}=${result.status}\n`);
    }
    process.stdout.write('reload_restoration=PASS\n');
    process.stdout.write('two_tab_restoration=PASS\n');
    process.stdout.write('web_locks_unavailable_single_tab=PASS\n');
    process.stdout.write('cookie_policy=PASS\n');
    process.stdout.write('protected_navigation_after_logout=DENIED\n');
  } finally {
    await browser?.close();
    if (created) {
      const result = spawnSync(
        'docker',
        [
          'compose',
          'exec',
          '-T',
          '-e',
          `SMOKE_EMAIL=${email}`,
          'postgres',
          'sh',
          '-lc',
          'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v target="$SMOKE_EMAIL" -v ON_ERROR_STOP=1',
        ],
        {
          input: "DELETE FROM users WHERE normalized_email = :'target';\n",
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        },
      );
      assert.equal(result.status, 0, 'browser user cleanup failed');
      assert.match(result.stdout, /DELETE 1/);
      process.stdout.write('browser_user_cleanup=1\n');
    }
  }
}

void run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Browser test failed'}\n`,
  );
  process.exitCode = 1;
});
