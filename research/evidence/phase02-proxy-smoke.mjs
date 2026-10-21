import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const origin = 'http://127.0.0.1:3000';
const email = `p02-smoke-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
let created = false;

async function call(path, method = 'GET', body, extraHeaders = {}) {
  const response = await fetch(`${origin}/api/v1${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...extraHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: response.status,
    headers: response.headers,
    body: await response.json(),
  };
}

try {
  const registered = await call('/auth/register', 'POST', { email, password });
  assert.equal(registered.status, 201);
  created = true;
  const loggedIn = await call('/auth/login', 'POST', { email, password });
  assert.equal(loggedIn.status, 201);
  const firstCookie = loggedIn.headers.get('set-cookie');
  assert.match(firstCookie ?? '', /^ekms_refresh=/);
  assert.match(firstCookie ?? '', /HttpOnly;.*SameSite=Lax/i);
  assert.match(firstCookie ?? '', /Path=\/api\/v1\/auth/i);
  const initial = await call('/me', 'GET', undefined, {
    Authorization: `Bearer ${loggedIn.body.data.accessToken}`,
  });
  assert.equal(initial.status, 200);
  const rotated = await call('/auth/refresh', 'POST', undefined, {
    Cookie: firstCookie.split(';')[0],
  });
  assert.equal(rotated.status, 201);
  assert.match(rotated.headers.get('set-cookie') ?? '', /^ekms_refresh=/);
  const replay = await call('/auth/refresh', 'POST', undefined, {
    Cookie: firstCookie.split(';')[0],
  });
  assert.equal(replay.status, 401);
  assert.equal(replay.body.error.code, 'AUTH_REFRESH_REUSE_DETECTED');
  assert.match(replay.headers.get('set-cookie') ?? '', /^ekms_refresh=;/);
  assert.match(
    replay.headers.get('set-cookie') ?? '',
    /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
  );
  const revoked = await call('/me', 'GET', undefined, {
    Authorization: `Bearer ${rotated.body.data.accessToken}`,
  });
  assert.equal(revoked.status, 401);
  const malicious = await call('/auth/refresh', 'POST', undefined, {
    Origin: 'https://evil.example',
  });
  assert.equal(malicious.status, 403);
  const secondLogin = await call('/auth/login', 'POST', { email, password });
  assert.equal(secondLogin.status, 201);
  const secondAccess = secondLogin.body.data.accessToken;
  const sessions = await call('/auth/sessions', 'GET', undefined, {
    Authorization: `Bearer ${secondAccess}`,
  });
  assert.equal(sessions.status, 200);
  const current = sessions.body.data.find((session) => session.current);
  assert.ok(current?.id);
  const sessionRevocation = await call(
    `/auth/sessions/${current.id}`,
    'DELETE',
    undefined,
    { Authorization: `Bearer ${secondAccess}` },
  );
  assert.equal(sessionRevocation.status, 200);
  const afterSessionRevocation = await call('/me', 'GET', undefined, {
    Authorization: `Bearer ${secondAccess}`,
  });
  assert.equal(afterSessionRevocation.status, 401);
  const thirdLogin = await call('/auth/login', 'POST', { email, password });
  assert.equal(thirdLogin.status, 201);
  const thirdAccess = thirdLogin.body.data.accessToken;
  const thirdCookie = thirdLogin.headers.get('set-cookie');
  assert.ok(thirdCookie);
  const logout = await call('/auth/logout', 'POST', undefined, {
    Cookie: thirdCookie.split(';')[0],
    Authorization: `Bearer ${thirdAccess}`,
  });
  assert.equal(logout.status, 201);
  assert.match(logout.headers.get('set-cookie') ?? '', /^ekms_refresh=;/);
  assert.match(
    logout.headers.get('set-cookie') ?? '',
    /Expires=Thu, 01 Jan 1970 00:00:00 GMT/,
  );
  const afterLogout = await call('/me', 'GET', undefined, {
    Authorization: `Bearer ${thirdAccess}`,
  });
  assert.equal(afterLogout.status, 401);
  for (const [name, value] of Object.entries({
    register: registered.status,
    login: loggedIn.status,
    me: initial.status,
    refresh: rotated.status,
    replay: replay.status,
    revoked: revoked.status,
    maliciousOrigin: malicious.status,
    sessionList: sessions.status,
    sessionRevocation: sessionRevocation.status,
    revokedSessionAccess: afterSessionRevocation.status,
    logout: logout.status,
    loggedOutAccess: afterLogout.status,
  })) {
    process.stdout.write(`${name}=${value}\n`);
  }
} finally {
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
    assert.equal(result.status, 0, 'smoke user cleanup failed');
    assert.match(result.stdout, /DELETE 1/);
    process.stdout.write('smoke_user_cleanup=1\n');
  }
}
