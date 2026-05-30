/** Default session lifetime — cookie maxAge and JWT `expiresIn` stay in sync. */
const SESSION_MAX_AGE_DAYS = Math.max(
  1,
  parseInt(process.env.SESSION_MAX_AGE_DAYS || '365', 10) || 365,
)

export const SESSION_MAX_AGE_MS = SESSION_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
export const SESSION_JWT_EXPIRES_IN = `${SESSION_MAX_AGE_DAYS}d`
