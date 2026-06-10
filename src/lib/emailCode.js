const crypto = require('crypto');

const DEFAULT_TTL_MS = 15 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 5;

class EmailCodeError extends Error {
  constructor(code, message) {
    super(message ? `${code}: ${message}` : code);
    this.name = 'EmailCodeError';
    this.code = code;
  }
}

function normalizeEmailValue(email) {
  return String(email || '').trim().toLowerCase();
}

function generateEmailCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function createEmailCodeService(options) {
  const kv = options.kv;
  const now = options.now || (() => Date.now());
  const ttlMs = options.ttlMs || DEFAULT_TTL_MS;
  const cooldownMs = options.cooldownMs || DEFAULT_COOLDOWN_MS;
  const maxAttempts = options.maxAttempts || DEFAULT_MAX_ATTEMPTS;
  const codeFactory = options.codeFactory || generateEmailCode;

  const keyFor = (email) => `email-code:${normalizeEmailValue(email)}`;

  return {
    async create(email) {
      const normalizedEmail = normalizeEmailValue(email);
      if (!normalizedEmail) throw new EmailCodeError('EMAIL_REQUIRED', 'email is required');
      const key = keyFor(normalizedEmail);
      const existing = await kv.get(key);
      const current = now();
      if (existing && current - Number(existing.createdAt || 0) < cooldownMs) {
        throw new EmailCodeError('VERIFY_CODE_TOO_FREQUENT', 'please wait before requesting a new code');
      }
      const code = codeFactory();
      const data = { code, attempts: 0, createdAt: current, expiresAt: current + ttlMs };
      await kv.set(key, data, { ex: Math.ceil(ttlMs / 1000) });
      return { email: normalizedEmail, code, countdown: Math.ceil(cooldownMs / 1000), expiresIn: Math.ceil(ttlMs / 1000) };
    },

    async verify(email, code) {
      const normalizedEmail = normalizeEmailValue(email);
      const key = keyFor(normalizedEmail);
      const data = await kv.get(key);
      const current = now();
      if (!data || current > Number(data.expiresAt || 0)) {
        await kv.del(key).catch(() => undefined);
        throw new EmailCodeError('INVALID_VERIFY_CODE', 'invalid or expired verification code');
      }
      if (Number(data.attempts || 0) >= maxAttempts) {
        throw new EmailCodeError('VERIFY_CODE_MAX_ATTEMPTS', 'too many failed attempts, please request a new code');
      }
      if (!safeEqual(data.code, String(code || '').trim())) {
        data.attempts = Number(data.attempts || 0) + 1;
        const remainingMs = Math.max(1, Number(data.expiresAt || 0) - current);
        await kv.set(key, data, { ex: Math.ceil(remainingMs / 1000) }).catch(() => undefined);
        if (data.attempts >= maxAttempts) {
          throw new EmailCodeError('VERIFY_CODE_MAX_ATTEMPTS', 'too many failed attempts, please request a new code');
        }
        throw new EmailCodeError('INVALID_VERIFY_CODE', 'invalid or expired verification code');
      }
      await kv.del(key).catch(() => undefined);
      return true;
    },
  };
}

module.exports = {
  EmailCodeError,
  createEmailCodeService,
  generateEmailCode,
  normalizeEmailValue,
  DEFAULT_TTL_MS,
  DEFAULT_COOLDOWN_MS,
  DEFAULT_MAX_ATTEMPTS,
};
