export class EmailCodeError extends Error {
  code: string;
  constructor(code: string, message?: string);
}

export type EmailCodeKv = {
  get<T = any>(key: string): Promise<T | null>;
  set(key: string, value: any, options?: { ex?: number }): Promise<any>;
  del(key: string): Promise<any>;
};

export type EmailCodeServiceOptions = {
  kv: EmailCodeKv;
  now?: () => number;
  ttlMs?: number;
  cooldownMs?: number;
  maxAttempts?: number;
  codeFactory?: () => string;
};

export function generateEmailCode(): string;
export function normalizeEmailValue(email: string): string;
export function createEmailCodeService(options: EmailCodeServiceOptions): {
  create(email: string): Promise<{ email: string; code: string; countdown: number; expiresIn: number }>;
  verify(email: string, code: string): Promise<boolean>;
};

export const DEFAULT_TTL_MS: number;
export const DEFAULT_COOLDOWN_MS: number;
export const DEFAULT_MAX_ATTEMPTS: number;
