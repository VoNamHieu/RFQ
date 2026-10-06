// Pull the real product catalog of a Shopify store into the repo so the
// storefront prototype can render real titles, prices, variants and images.
//
//   node scripts/pull-products.mjs [store-domain]
//
// Uses the Admin API through Shopify CLI (`shopify store execute`), so it works
// on password-protected dev stores. Authenticate once beforehand with:
//   shopify store auth --store <store>.myshopify.com --scopes read_products
// Output: src/storefront/data/shopifyProducts.json
import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';

const STORE = process.argv[2] || process.env.SHOPIFY_STORE || '221jumpstreet.myshopify.com';
const OUT = new URL('../src/storefront/data/shopifyProducts.json', import.meta.url);
// Kept small so each page stays under the Admin API's 1000-point query cost cap.
const PAGE_SIZE = 5;

const QUERY = `query Products($first: Int!, $after: String) {
  products(first: $first, after: $after, sortKey: TITLE) {
    pageInfo { hasNextPage endCursor }
    nodes {
      id title handle vendor productType status tags descriptionHtml onlineStoreUrl
      featuredMedia { preview { image { url altText width height } } }
      media(first: 10) { nodes { ... on MediaImage { image { url altText width height } } } }
      options { name optionValues { name } }
      priceRangeV2 { minVariantPrice { amount currencyCode } maxVariantPrice { amount currencyCode } }
      variants(first: 50) {
        pageInfo { hasNextPage }
        nodes {
          id title sku price compareAtPrice availableForSale
          selectedOptions { name value }
          media(first: 1) { nodes { preview { image { url altText } } } }
        }
      }
    }
  }
}`;

function execute(variables) {
  const out = execFileSync(
    'shopify',
    ['store', 'execute', '--store', STORE, '--json', '--query', QUERY, '--variables', JSON.stringify(variables)],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }, // CLI stderr surfaces in the thrown error on failure

  );
  const res = JSON.parse(out);
  if (res.errors?.length) throw new Error(JSON.stringify(res.errors, null, 2));
  return res.data ?? res;
}

const money = (m) => (m ? Number(m.amount) : null);

function normalize(p) {
  if (p.variants.pageInfo.hasNextPage) console.warn(`! ${p.handle}: more than 50 variants, extra ones skipped`);
  return {
    id: p.id,
    handle: p.handle,
    title: p.title,
    vendor: p.vendor,
    productType: p.productType,
    status: p.status,
    tags: p.tags,
    descriptionHtml: p.descriptionHtml,
    url: p.onlineStoreUrl,
    image: p.featuredMedia?.preview?.image ?? null,
    images: p.media.nodes.map((m) => m.image).filter(Boolean),
    options: p.options.map((o) => ({ name: o.name, values: o.optionValues.map((v) => v.name) })),
    currency: p.priceRangeV2.minVariantPrice.currencyCode,
    priceMin: money(p.priceRangeV2.minVariantPrice),
    priceMax: money(p.priceRangeV2.maxVariantPrice),
    variants: p.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: Number(v.price),
      compareAtPrice: v.compareAtPrice == null ? null : Number(v.compareAtPrice),
      available: v.availableForSale,
      options: Object.fromEntries(v.selectedOptions.map((o) => [o.name, o.value])),
      image: v.media.nodes[0]?.preview?.image ?? null,
    })),
  };
}

const products = [];
let after = null;
do {
  const { products: page } = execute({ first: PAGE_SIZE, after });
  products.push(...page.nodes.map(normalize));
  after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  process.stdout.write(`\rPulled ${products.length} products…`);
} while (after);

await writeFile(OUT, JSON.stringify({ store: STORE, pulledAt: new Date().toISOString(), products }, null, 2) + '\n');
console.log(`\nSaved ${products.length} products → src/storefront/data/shopifyProducts.json`);
