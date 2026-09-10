// Factory functions for editable working copies (the pricing "builder" the editor
// mutates, and a new conditional rule). Kept separate from the store so screens
// can import a fresh builder without pulling in the whole reducer.
import { TODAY } from './pricing.js';

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
    timezone: '(GMT+07:00) Indochina Time - Bangkok',
    startDate: TODAY,
    startTime: '12:00 AM',
    hasEndDate: false,
    endDate: '',
    // Storefront appearance (god-file appearanceEditor): a display title and a price
    // badge. Presentation only — no effect on price calculation or assignment.
    appearanceTitle: 'Wholesale pricing',
    appearanceLabel: 'Special price',
    // Who this pricing serves (god-file assignmentAdapter). B2B → the Companies
    // that get it; D2C → a customer target (all/logged_in/logged_out/specific/tags)
    // plus the specific customer/tag ids. Applied to the db on save.
    b2bCompanyIds: [],
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
