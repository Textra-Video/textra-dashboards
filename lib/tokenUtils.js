// localStorage.getItem returns the literal string "undefined" if a bad
// value was ever written, and that string is truthy - so guard for it.
// Still used for Xero, which remains client-managed (out of scope for the
// shared Zoho auth work).
export function isValidToken(value) {
  return Boolean(value) && value !== 'undefined' && value !== 'null';
}
