// Timezones for the dates of a pricing, an order limit and a contract: the list their
// Timezone select offers (the B2B god file's Active dates card), and the store's — what
// each starts on until one is picked.
export const TIMEZONES = [
  '(GMT+07:00) Indochina Time - Bangkok',
  '(GMT+00:00) UTC',
  '(GMT-05:00) Eastern Time - New York',
  '(GMT+10:00) AEST - Sydney',
];

// The store's timezone (Shopify: Settings › General › Time zone); the prototype's store
// is in Vietnam. `db.storeTimezone` overrides it.
export const STORE_TIMEZONE = '(GMT+07:00) Indochina Time - Bangkok';
export const storeTimezone = (db) => db?.storeTimezone || STORE_TIMEZONE;
