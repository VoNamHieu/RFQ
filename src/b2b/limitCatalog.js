import { PRODUCTS as STOREFRONT_PRODUCTS } from '../storefront/data/products.js';

// The products limits are picked from and checked against: the app's, plus the
// storefront's (so a product limit can be checked there). The same list for the
// same app catalog, so what's worked out from it (the price index) is kept.
const catalogs = new WeakMap();
export function limitCatalog(db) {
  if (!catalogs.has(db.products)) catalogs.set(db.products, [...db.products, ...STOREFRONT_PRODUCTS.filter((p) => !db.products.some((x) => x.sku === p.sku))]);
  return catalogs.get(db.products);
}
export const withCatalog = (db) => ({ ...db, products: limitCatalog(db) });
