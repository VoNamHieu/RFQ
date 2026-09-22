// USD money format, matching the storefront's list prices (whole-dollar values in
// the shared catalog, cents where a B2B price needs them).
export function money(n) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n) || 0);
}
