const assert = require('node:assert/strict');

const { createEmailCodeService, generateEmailCode } = require('../src/lib/emailCode.js');

function createMemoryKv() {
  const store = new Map();
  return {
    async get(key) { return store.get(key) ?? null; },
    async set(key, value) { store.set(key, value); },
    async del(key) { store.delete(key); },
  };
}

async function testGenerateCode() {
  for (let i = 0; i < 20; i++) {
    const code = generateEmailCode();
    assert.match(code, /^\d{6}$/);
  }
}

async function testCooldownAndVerificationLifecycle() {
  let now = 1_700_000_000_000;
  const service = createEmailCodeService({ kv: createMemoryKv(), now: () => now, ttlMs: 15 * 60_000, cooldownMs: 60_000, maxAttempts: 5 });

  const first = await service.create('User@Example.com');
  assert.equal(first.email, 'user@example.com');
  assert.match(first.code, /^\d{6}$/);
  assert.equal(first.countdown, 60);

  await assert.rejects(() => service.create('user@example.com'), /VERIFY_CODE_TOO_FREQUENT/);

  await assert.rejects(() => service.verify('user@example.com', '000000'), /INVALID_VERIFY_CODE/);
  await assert.doesNotReject(() => service.verify('USER@example.com', first.code));
  await assert.rejects(() => service.verify('user@example.com', first.code), /INVALID_VERIFY_CODE/);
}

async function testMaxAttemptsAndExpiry() {
  let now = 1_700_000_000_000;
  const service = createEmailCodeService({ kv: createMemoryKv(), now: () => now, ttlMs: 1000, cooldownMs: 10, maxAttempts: 2 });
  const item = await service.create('a@example.com');
  await assert.rejects(() => service.verify('a@example.com', '111111'), /INVALID_VERIFY_CODE/);
  await assert.rejects(() => service.verify('a@example.com', '222222'), /VERIFY_CODE_MAX_ATTEMPTS/);
  await assert.rejects(() => service.verify('a@example.com', item.code), /VERIFY_CODE_MAX_ATTEMPTS/);

  now += 20;
  const expiring = await service.create('b@example.com');
  now += 1001;
  await assert.rejects(() => service.verify('b@example.com', expiring.code), /INVALID_VERIFY_CODE/);
}

(async () => {
  await testGenerateCode();
  await testCooldownAndVerificationLifecycle();
  await testMaxAttemptsAndExpiry();
  console.log('email-code tests passed');
})().catch(err => {
  console.error(err);
  process.exit(1);
});
