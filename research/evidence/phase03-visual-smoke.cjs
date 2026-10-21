const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const origin = process.env.EKMS_BROWSER_ORIGIN ?? 'http://127.0.0.1:3000';
const output = path.join(__dirname, 'phase03-visual');
const axePath = require.resolve('axe-core/axe.min.js');
const email = `p03-visual-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
const viewports = [375, 390, 768, 1280, 1440];
const visualChecks = [];
const accessibility = [];
const requests = [];
const pageErrors = [];
let browser;
let created = false;

async function checkLayout(page, route, width) {
  const result = await page.evaluate(() => {
    const actual = document.documentElement.scrollWidth;
    const viewport = window.innerWidth;
    const overflowedControls = [...document.querySelectorAll('button, nav a')]
      .filter((element) => element.getClientRects().length > 0)
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > viewport + 1 || rect.left < -1;
      }).length;
    return {
      viewport,
      documentWidth: actual,
      headingCount: document.querySelectorAll('h1').length,
      overflowedControls,
    };
  });
  assert.equal(result.viewport, width);
  assert.ok(
    result.documentWidth <= width + 1,
    `${route}@${width} overflow ${result.documentWidth}`,
  );
  assert.equal(result.headingCount, 1, `${route}@${width} h1 count`);
  assert.equal(
    result.overflowedControls,
    0,
    `${route}@${width} controls offscreen`,
  );
  visualChecks.push(`${route}@${width}=PASS`);
}

async function checkAxe(page, route, width) {
  await page.addScriptTag({ path: axePath });
  const result = await page.evaluate(async () => {
    const scan = await window.axe.run(document, {
      runOnly: {
        type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'],
      },
    });
    return scan.violations.map((item) => ({
      id: item.id,
      impact: item.impact,
      targets: item.nodes.map((node) => node.target.join(' ')).slice(0, 4),
    }));
  });
  accessibility.push({ route, width, violations: result });
  assert.deepEqual(
    result,
    [],
    `${route}@${width} axe violations: ${JSON.stringify(result)}`,
  );
}

async function capture(page, name) {
  await page.screenshot({
    path: path.join(output, name),
    fullPage: true,
    animations: 'disabled',
  });
}

async function run() {
  mkdirSync(output, { recursive: true });
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      baseURL: origin,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    page.on('pageerror', (error) => pageErrors.push(error.message));
    page.on('response', (response) => {
      const url = new URL(response.url());
      if (url.origin === origin && url.pathname.startsWith('/api/v1/')) {
        requests.push({ path: url.pathname, status: response.status() });
      }
    });

    await page.goto('/app');
    await page.waitForURL('**/auth');
    assert.equal(
      await page.getByRole('heading', { name: 'Welcome back' }).count(),
      0,
    );

    for (const width of viewports) {
      await page.setViewportSize({ width, height: width < 500 ? 820 : 900 });
      await page.goto('/');
      await page
        .getByRole('heading', { name: /Make room for better learning/ })
        .waitFor();
      await checkLayout(page, '/', width);
      if (width === 1440) await capture(page, 'desktop-landing-1440.png');
      if (width === 375) await capture(page, 'mobile-landing-375.png');
      if (width === 1440 || width === 375) await checkAxe(page, '/', width);

      await page.goto('/auth');
      await page.getByLabel('Email').waitFor();
      await checkLayout(page, '/auth-login', width);
      if (width === 1440) await capture(page, 'desktop-login-1440.png');
      if (width === 375) await capture(page, 'mobile-login-375.png');
      if (width === 1440 || width === 375)
        await checkAxe(page, '/auth-login', width);
      await page.getByRole('button', { name: 'Create an account' }).click();
      await page.getByRole('heading', { name: 'Create an account' }).waitFor();
      await checkLayout(page, '/auth-register', width);
      if (width === 1440) await capture(page, 'desktop-register-1440.png');
      if (width === 390) await capture(page, 'mobile-register-390.png');
      if (width === 390) await checkAxe(page, '/auth-register', width);
    }

    await page.setViewportSize({ width: 1440, height: 900 });
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
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();

    const cookie = (
      await context.cookies(`${origin}/api/v1/auth/refresh`)
    ).find((item) => item.name === 'ekms_refresh');
    assert.ok(
      cookie &&
        cookie.httpOnly &&
        cookie.sameSite === 'Lax' &&
        cookie.path === '/api/v1/auth',
    );
    const beforeReload = requests.length;
    await page.reload();
    await page.getByRole('heading', { name: 'Welcome back' }).waitFor();
    assert.ok(
      requests
        .slice(beforeReload)
        .some(
          (item) => item.path === '/api/v1/auth/refresh' && item.status === 201,
        ),
    );
    assert.ok(
      requests
        .slice(beforeReload)
        .some((item) => item.path === '/api/v1/me' && item.status === 200),
    );

    for (const width of viewports) {
      await page.setViewportSize({ width, height: width < 500 ? 820 : 900 });
      await checkLayout(page, '/app', width);
      const nav = page.getByRole('navigation', { name: 'Workspace' });
      assert.equal(await nav.getByRole('link', { name: 'Home' }).count(), 1);
      assert.equal(
        await nav.getByRole('link', { name: 'Account and security' }).count(),
        1,
      );
      if (width === 1280) await capture(page, 'desktop-app-1280.png');
      if (width === 375) await capture(page, 'mobile-app-375.png');
      if (width === 1280 || width === 375) await checkAxe(page, '/app', width);
    }

    const secondContext = await browser.newContext({ baseURL: origin });
    const secondPage = await secondContext.newPage();
    await secondPage.goto('/auth');
    await secondPage.getByLabel('Email').fill(email);
    await secondPage.getByLabel('Password').fill(password);
    await secondPage
      .getByRole('button', { name: 'Sign in', exact: true })
      .click();
    await secondPage.waitForURL('**/app');

    await page
      .getByRole('navigation', { name: 'Workspace' })
      .getByRole('link', { name: 'Account and security' })
      .click();
    await page.getByRole('heading', { name: 'Account and security' }).waitFor();
    await page.getByText('Other session', { exact: false }).waitFor();
    for (const width of viewports) {
      await page.setViewportSize({ width, height: width < 500 ? 820 : 900 });
      await checkLayout(page, '/account', width);
      if (width === 1440) await capture(page, 'desktop-account-1440.png');
      if (width === 390) await capture(page, 'mobile-account-390.png');
      if (width === 768) await capture(page, 'tablet-account-768.png');
      if (width === 1440 || width === 390)
        await checkAxe(page, '/account', width);
    }

    await page.setViewportSize({ width: 390, height: 820 });
    await page
      .locator('.session-row')
      .filter({ hasText: 'Other session' })
      .getByRole('button', { name: 'Revoke', exact: true })
      .click();
    const confirmRevoke = page.getByRole('button', { name: 'Confirm revoke' });
    await confirmRevoke.waitFor();
    assert.equal(
      await confirmRevoke.evaluate(
        (element) => element === document.activeElement,
      ),
      true,
    );
    await confirmRevoke.click();
    await page.getByText('Session revoked.').waitFor();
    await secondPage.reload();
    await secondPage.waitForURL('**/auth');
    await secondContext.close();

    await page.getByRole('button', { name: 'Sign out everywhere' }).click();
    const confirmAll = page.getByRole('button', {
      name: 'Confirm sign out everywhere',
    });
    await confirmAll.waitFor();
    assert.equal(
      await confirmAll.evaluate(
        (element) => element === document.activeElement,
      ),
      true,
    );
    await confirmAll.click();
    await page.waitForURL('**/auth');
    await page.goto('/app');
    await page.waitForURL('**/auth');
    assert.equal(
      await page.getByRole('heading', { name: 'Welcome back' }).count(),
      0,
    );

    await page.getByLabel('Email').focus();
    await page.keyboard.press('Tab');
    assert.equal(
      await page
        .getByLabel('Password')
        .evaluate((element) => element === document.activeElement),
      true,
    );
    assert.equal(pageErrors.length, 0, `page errors: ${pageErrors.length}`);
    console.log(
      JSON.stringify(
        {
          visualChecks,
          accessibilityChecks: accessibility.length,
          accessibilityViolations: 0,
          browserPageErrors: pageErrors.length,
          cookiePolicy: 'PASS',
          restoration: 'PASS',
          sessionRevocation: 'PASS',
          logoutAll: 'PASS',
          protectedRouteAfterLogout: 'DENIED',
        },
        null,
        2,
      ),
    );
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
      assert.equal(result.status, 0, 'temporary browser user cleanup failed');
      assert.match(result.stdout, /DELETE 1/);
      console.log('temporary_browser_user_cleanup=1');
    }
  }
}

void run().catch((error) => {
  console.error(
    error instanceof Error ? error.message : 'Browser smoke failed',
  );
  process.exitCode = 1;
});
