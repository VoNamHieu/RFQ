import '@shopify/ui-extensions';

//@ts-ignore
declare module './src/ProfileRegistration.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.profile.block.render').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/CompanyPurchasingSummary.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.profile.company-details.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/LocationPurchasingTerms.jsx' {
  const shopify: import('@shopify/ui-extensions/customer-account.profile.company-location-payment.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/api.js' {
  const shopify:
    | import('@shopify/ui-extensions/customer-account.profile.block.render').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-details.render-after').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-location-payment.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/config.js' {
  const shopify:
    | import('@shopify/ui-extensions/customer-account.profile.block.render').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-details.render-after').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-location-payment.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}

//@ts-ignore
declare module './src/http.js' {
  const shopify:
    | import('@shopify/ui-extensions/customer-account.profile.block.render').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-details.render-after').Api
    | import('@shopify/ui-extensions/customer-account.profile.company-location-payment.render-after').Api;
  const globalThis: { shopify: typeof shopify };
}
