// Factory functions for editable working copies (the pricing "builder" the editor
// mutates, and a new conditional rule). Kept separate from the store so screens
// can import a fresh builder without pulling in the whole reducer.

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
    productAdjustments: {},
    explicitEnabled: false,
    conditionalRules: [],
    fallback: 'keep',
    validityType: 'evergreen',
    startDate: '',
    endDate: '',
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
