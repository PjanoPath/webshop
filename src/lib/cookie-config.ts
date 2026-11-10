// Secure cookies require HTTPS. Defaults on in production, but can be disabled via
// COOKIE_SECURE=false for a bare-HTTP deployment (e.g. no reverse proxy / TLS yet) —
// browsers silently drop Secure cookies over plain HTTP on real domains/IPs, which
// would otherwise make login look broken with no visible error.
export const secureCookie =
  process.env.COOKIE_SECURE !== undefined
    ? process.env.COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
