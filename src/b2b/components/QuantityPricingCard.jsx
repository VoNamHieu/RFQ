import React from 'react';
import { useStore } from '../store.jsx';
import { companyQuantityEntries, locationOnlyEntries, pricingLocationsLabel, policyStatus, scopeTypeLabel } from '../pricing.js';
import { LocationOnlyActions, ApplyLaterSwitch } from './BasePricingCard.jsx';
import { EmptyBlock } from '../../shared/EmptyBlock.jsx';
import { wcTone } from '../../shared/wc.jsx';
import quantityPricingArt from '../assets/quantity-pricing-empty.webp';

export function QuantityPricingCard({ company }) {
  const { state, dispatch } = useStore();
  // A company can hold several quantity pricings (lowest priority applies first).
  // The company's own list plus pricing only some locations get (labelled with them),
  // in priority order — the stable sort keeps the company's own tie-breaks.
  const entries = [...companyQuantityEntries(company, state.db.policies), ...locationOnlyEntries(company, state.db.policies, 'quantity')].sort((a, b) => a.priority - b.priority);
  const policies = entries.map((e) => e.policy);
  const openAdd = () => dispatch({ type: 'OPEN_ASSIGN', companyId: company.id, kind: 'quantity', mode: 'add' });
  const autoApply = !!company.autoAddLocations;

  // No quantity pricing yet — a proper empty state so the Add action is obvious
  // (mirrors the Base pricing card) instead of a "Not set" row with a bare +.
  if (!policies.length) {
    return (
      <s-section heading="Quantity pricing">
        <EmptyBlock
          image={quantityPricingArt}
          imageAlt="Growing box stacks with the unit price dropping from $10 to $9 to $8"
          heading="No quantity pricing yet"
          action={{ content: 'Add quantity pricing', onAction: openAdd }}
        >
          Add a quantity pricing to give buyers a discount as the order quantity grows.
        </EmptyBlock>
      </s-section>
    );
  }

  return (
    <s-section padding="none">
      <s-box padding="small" paddingBlockEnd="small-200">
        <s-stack direction="inline" justifyContent="space-between" alignItems="center" gap="small-200">
          <s-heading>Quantity pricing</s-heading>
          <s-text color="subdued" fontSize="small">
            How the price changes with quantity
          </s-text>
        </s-stack>
      </s-box>
      <s-table>
        <s-table-header-row>
          <s-table-header listSlot="primary">Pricing</s-table-header>
          <s-table-header listSlot="labeled">Location</s-table-header>
          {autoApply && <s-table-header listSlot="labeled">Auto-apply to new locations</s-table-header>}
          <s-table-header listSlot="labeled">Products</s-table-header>
          <s-table-header listSlot="secondary">Status</s-table-header>
          <s-table-header listSlot="inline">
            <s-text accessibilityVisibility="exclusive">Actions</s-text>
          </s-table-header>
        </s-table-header-row>
        <s-table-body>
          {entries.map((entry) => {
            const policy = entry.policy;
            const st = policyStatus(policy, state.db);
            return (
              <s-table-row key={policy.id}>
                <s-table-cell>
                  <s-text fontWeight="medium">{policy.name}</s-text>
                </s-table-cell>
                <s-table-cell>{pricingLocationsLabel(company, 'quantity', policy.id)}</s-table-cell>
                {autoApply && (
                  <s-table-cell>
                    <ApplyLaterSwitch company={company} kind="quantity" policy={policy} />
                  </s-table-cell>
                )}
                <s-table-cell>
                  <s-text color="subdued">{scopeTypeLabel(policy)}</s-text>
                </s-table-cell>
                <s-table-cell>
                  <s-badge tone={wcTone(st.tone)}>{st.label}</s-badge>
                </s-table-cell>
                <s-table-cell>
                  {entry.locations ? (
                    <LocationOnlyActions company={company} kind="quantity" entry={entry} />
                  ) : (
                    <s-stack direction="inline" gap="small-400" justifyContent="end" alignItems="center">
                      <s-button icon="edit" variant="tertiary" accessibilityLabel="Edit pricing" onClick={() => dispatch({ type: 'OPEN_EDITOR', policy, context: { mode: 'edit', companyId: company.id } })} />
                      <s-button icon="x-circle" variant="tertiary" tone="critical" accessibilityLabel="Remove" onClick={() => dispatch({ type: 'REMOVE_COMPANY_QUANTITY', companyId: company.id, policyId: policy.id })} />
                    </s-stack>
                  )}
                </s-table-cell>
              </s-table-row>
            );
          })}
        </s-table-body>
      </s-table>
      <s-box padding="small">
        <s-button icon="plus" onClick={openAdd}>
          Add quantity pricing
        </s-button>
      </s-box>
    </s-section>
  );
}
