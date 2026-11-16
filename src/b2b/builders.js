// Factory functions for editable working copies (the pricing "builder" the editor
// mutates, and a new conditional rule). Kept separate from the store so screens
// can import a fresh builder without pulling in the whole reducer.
import { TODAY, ruleIsComplete } from './pricing.js';

let _ruleSeq = 1;
export function newRule(field) {
  return {
    id: `crn${_ruleSeq++}`,
    conditions: [{ field, operator: 'is', values: [] }],
    match: 'ALL',
    rule: 'decrease',
    valueType: 'percentage',
    value: 10,
  };
}

export function newBaseBuilder() {
  return {
    id: null,
    name: 'New base pricing',
    priority: 99,
    priceKind: 'base',
    audienceType: 'b2b',
    status: 'Active',
    type: 'Reusable',
    scopeType: 'all',
    collection: 'All B2B products',
    selectedProducts: [],
    pricingRule: 'keep',
    valueType: 'percentage',
    value: 0,
    variantAdjustments: {},
    explicitEnabled: false,
    conditionalRules: [],
    timezone: null, // the store's (storeTimezone) until one is picked
    startDate: TODAY,
    startTime: '12:00 AM',
    hasEndDate: false,
    endDate: '',
    // Storefront appearance (god-file appearanceEditor): a display title and a price
    // badge. Presentation only — no effect on price calculation or assignment.
    appearanceTitle: 'Wholesale pricing',
    appearanceLabel: 'Special price',
    // Who this pricing serves (god-file assignmentAdapter). B2B → the Companies
    // that get it (all their locations), or — for a company only partly ticked —
    // its ticked locations as `companyId::locationId` keys; D2C → a customer target
    // (all/logged_in/logged_out/specific/tags) plus the specific customer/tag ids.
    // Applied to the db on save.
    b2bCompanyIds: [],
    b2bLocationKeys: [],
    customerTarget: 'none',
    assignmentTargetIds: [],
  };
}

export function newQuantityBuilder() {
  return {
    ...newBaseBuilder(),
    name: 'New quantity pricing',
    priceKind: 'quantity',
    scopeType: 'products',
    volumeRanges: [
      { from: 1, to: 9, valueType: 'percentage', value: 0 },
      { from: 10, to: null, valueType: 'percentage', value: 10 },
    ],
    volumeBasis: 'shopify', // 'shopify' | 'base'
    quantityBasis: 'all_selected', // all_selected | per_product | per_variant
  };
}

// What saving a builder stores: conditional rules with no chosen value or no real
// adjustment pruned (legacy validConditionalRule; the editor's Save stops on such a
// rule first, see PricingEditor) — an All products rule needs no value — and
// explicitEnabled derived from the overrides.
export function builderDraft(b) {
  const conditionalRules = (b.conditionalRules || []).filter(ruleIsComplete);
  return { ...b, conditionalRules, explicitEnabled: Object.keys(b.variantAdjustments || {}).length > 0 };
}
