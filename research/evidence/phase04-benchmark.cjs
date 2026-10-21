const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Local synthetic workload only. The created account is deleted in finally.
const api = process.env.EKMS_BENCH_API ?? 'http://127.0.0.1:3001/api/v1';
const origin = process.env.EKMS_BENCH_ORIGIN ?? 'http://127.0.0.1:3000';
const email = `p04-bench-${randomUUID()}@example.test`;
const password = randomBytes(24).toString('base64url');
const count = 25;
const measurements = Object.fromEntries(
  ['quickAdd', 'list', 'search', 'detail', 'tagFilter', 'archive', 'restore'].map((name) => [name, []]),
);
let registered = false;
let token;

async function call(method, path, body, idempotencyKey) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.ok(response.ok, `${method} ${path}: HTTP ${response.status} ${result.error?.code ?? ''}`);
  return result.data;
}

async function measured(name, callback) {
  const start = process.hrtime.bigint();
  const result = await callback();
  measurements[name].push(Number(process.hrtime.bigint() - start) / 1e6);
  return result;
}

function summary(samples) {
  const ordered = [...samples].sort((a, b) => a - b);
  const percentile = (p) => Number(ordered[Math.ceil((p / 100) * ordered.length) - 1].toFixed(2));
  return { n: ordered.length, p50Ms: percentile(50), p95Ms: percentile(95), p99Ms: percentile(99) };
}

async function run() {
  try {
    await call('POST', '/auth/register', { email, password });
    registered = true;
    token = (await call('POST', '/auth/login', { email, password })).accessToken;
    const tag = (await call('POST', '/tags', { name: 'Synthetic benchmark' }, randomUUID())).tag;
    const ids = [];
    for (let i = 0; i < count; i++) {
      const result = await measured('quickAdd', () =>
        call('POST', '/vocabulary', {
          lemma: `benchmark phrase ${i}`,
          partOfSpeech: 'NOUN',
          definition: `Locally authored synthetic meaning ${i}`,
          tagIds: [tag.id],
        }, randomUUID()),
      );
      ids.push(result.item.id);
    }
    for (let i = 0; i < count; i++) {
      await measured('list', () => call('GET', '/vocabulary?limit=20'));
      await measured('search', () => call('GET', `/vocabulary?q=benchmark%20phrase%20${i}&limit=20`));
      await measured('detail', () => call('GET', `/vocabulary/${ids[i]}`));
      await measured('tagFilter', () => call('GET', `/vocabulary?tag=${tag.id}&limit=20`));
      const current = await call('GET', `/vocabulary/${ids[i]}`);
      const archived = await measured('archive', () =>
        call('POST', `/vocabulary/${ids[i]}/archive`, { expectedVersion: current.version }, randomUUID()),
      );
      await measured('restore', () =>
        call('POST', `/vocabulary/${ids[i]}/restore`, { expectedVersion: archived.version }, randomUUID()),
      );
    }
    console.log(JSON.stringify({
      environment: 'local Docker Compose, temporary account in owned EKMS development database',
      sampleSizePerOperation: count,
      results: Object.fromEntries(Object.entries(measurements).map(([name, samples]) => [name, summary(samples)])),
      caveat: 'Sequential local requests; these numbers are not a production SLA.',
    }, null, 2));
  } finally {
    if (registered) {
      const cleanup = spawnSync('docker', [
        'compose', 'exec', '-T', '-e', `SMOKE_EMAIL=${email}`, 'postgres', 'sh', '-lc',
        'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v target="$SMOKE_EMAIL" -v ON_ERROR_STOP=1',
      ], { input: "DELETE FROM users WHERE normalized_email = :'target';\n", encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      assert.equal(cleanup.status, 0, 'temporary benchmark user cleanup failed');
      assert.match(cleanup.stdout, /DELETE 1/, 'temporary benchmark user was not deleted');
      console.log('temporary_benchmark_user_deleted=1');
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
