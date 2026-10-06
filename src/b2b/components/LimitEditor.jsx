import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, defaultLimitMessage, normalizeLimit } from '../limits.js';
import { ProductScopeCard } from './pricingEditorCards.jsx';
import { COLLECTIONS } from '../data/constants.js';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';
import { Modal, useWcId, PageHeader } from '../../shared/wc.jsx';

const str = (v) => (v == null ? '' : String(v));
// Errors that only mean "not filled in yet" wait for a save attempt; the rest
// (min above max, not a multiple…) show as soon as they're true.
const REQUIRED = ['name', 'order', 'product', 'products', 'threshold', 'targets'];

// Create / edit one order limit — an in-frame page in the Order limits view (see
// the OPEN_LIMIT_EDITOR action). Settings in the main column; status and who it
// applies to in the aside, like the pricing editor.
export function LimitEditor() {
  const { state, dispatch } = useStore();
  const draft = state.limitEditor.draft;
  const [tried, setTried] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const scopeName = useWcId('limit-scope');
  const patch = (p) => dispatch({ type: 'LIMIT_EDITOR_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_LIMIT_EDITOR' });

  const isNew = !draft.id;
  const kind = LIMIT_KINDS[draft.kind];
  const allErrors = limitErrors(draft);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || !REQUIRED.includes(k)));
  const save = () => (Object.keys(allErrors).length ? setTried(true) : dispatch({ type: 'SAVE_LIMIT' }));

  const picks = companyPicks(state.db, draft.companyIds || [], draft.locationKeys || [], ({ companyIds, locationKeys }) =>
    patch({ companyIds, locationKeys }),
  );

  const numberField = (key, label, opts = {}) => (
    <s-number-field
      label={label}
      min={opts.step === 1 ? 1 : 0}
      step={opts.step}
      inputMode={opts.step === 1 ? 'numeric' : 'decimal'}
      prefix={opts.money ? '$' : undefined}
      suffix={opts.suffix}
      value={str(draft[key])}
      onInput={(e) => patch({ [key]: e.currentTarget.value })}
      error={errors[key]}
      details={opts.helpText}
      placeholder={opts.placeholder ?? 'No limit'}
      autocomplete="off"
    />
  );

  return (
    <>
    <PageHeader
      heading={isNew ? `Create ${kind.label.toLowerCase()}` : `Edit limit: ${draft.name}`}
      backAction={{ content: 'Order limits', onAction: close }}
      primaryAction={{ content: isNew ? 'Create limit' : 'Save', onAction: save }}
      secondaryActions={[
        ...(isNew ? [] : [{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]),
        { content: 'Cancel', onAction: close },
      ]}
    />
    <s-page>
      <s-stack gap="base">
        <s-section>
          <s-stack gap="small">
            <s-stack gap="small-400">
              <s-heading>{kind.label}</s-heading>
              <s-paragraph color="subdued" fontSize="small">
                {kind.description}
              </s-paragraph>
            </s-stack>
            <s-text-field
              label="Name"
              required
              value={draft.name}
              onInput={(e) => patch({ name: e.currentTarget.value })}
              error={errors.name}
              details="Only you see this."
              maxLength={255}
              autocomplete="off"
            />
          </s-stack>
        </s-section>

        {draft.kind === 'order' && (
          <s-section>
            <s-stack gap="base">
              <s-stack gap="small-200">
                <s-heading>Order value</s-heading>
                <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="small">
                  {numberField('minValue', 'Minimum', { money: true })}
                  {numberField('maxValue', 'Maximum', { money: true })}
                </s-grid>
                <s-paragraph color="subdued" fontSize="small">
                  The cart subtotal at the buyer’s B2B prices, before tax and shipping.
                </s-paragraph>
              </s-stack>
              <s-stack gap="small-200">
                <s-heading>Order quantity</s-heading>
                <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="small">
                  {numberField('minQty', 'Minimum', { step: 1, suffix: 'units' })}
                  {numberField('maxQty', 'Maximum', { step: 1, suffix: 'units' })}
                </s-grid>
                <s-paragraph color="subdued" fontSize="small">
                  All items in the cart added together.
                </s-paragraph>
              </s-stack>
              {errors.order && (
                <s-paragraph tone="critical" id="order-limits">
                  {errors.order}
                </s-paragraph>
              )}
            </s-stack>
          </s-section>
        )}

        {draft.kind === 'product' && (
          <>
            <ProductScopeCard
              builder={draft}
              // Switching to a collection picks the first one, as the select shows it.
              patch={(p) => patch(p.scopeType === 'collection' && !draft.collection ? { ...p, collection: Object.keys(COLLECTIONS)[0] } : p)}
              products={state.db.products}
            />
            {errors.products && (
              <s-paragraph tone="critical" id="limit-products">
                {errors.products}
              </s-paragraph>
            )}
            <s-section heading="Quantity per product">
              <s-stack gap="small">
                <s-query-container>
                  <s-grid gridTemplateColumns="@container (inline-size > 490px) 1fr 1fr 1fr, 1fr" gap="small">
                    {numberField('min', 'Minimum', { step: 1 })}
                    {numberField('max', 'Maximum', { step: 1 })}
                    {numberField('increment', 'Sold in multiples of', { step: 1, placeholder: '1' })}
                  </s-grid>
                </s-query-container>
                <s-paragraph color="subdued" fontSize="small">
                  Counted per variant, like Shopify’s quantity rules. Use multiples for case packs, e.g. 12. The minimum and maximum must be multiples of it.
                </s-paragraph>
                {errors.product && (
                  <s-paragraph tone="critical" id="limit-product-qty">
                    {errors.product}
                  </s-paragraph>
                )}
              </s-stack>
            </s-section>
          </>
        )}

        {draft.kind === 'review' && (
          <s-section heading="Amount">
            {numberField('threshold', 'Review orders above', {
              money: true,
              placeholder: '',
              helpText: 'Buyers can’t check out above this amount. They send the order to you instead, and it arrives as a draft order for you to approve or edit.',
            })}
          </s-section>
        )}

        <s-section heading="Buyer message">
          <s-text-area
            label="Message buyers see"
            rows={2}
            value={draft.message || ''}
            onInput={(e) => patch({ message: e.currentTarget.value })}
            placeholder={defaultLimitMessage(normalizeLimit(draft))}
            details="Shown in the cart and at checkout when an order breaks this limit. Leave it empty to use the suggested message."
            autocomplete="off"
          />
        </s-section>
      </s-stack>

      <s-section slot="aside">
        <s-select label="Status" value={draft.status} onChange={(e) => patch({ status: e.currentTarget.value })}>
          <s-option value="Active">Active</s-option>
          <s-option value="Inactive">Inactive</s-option>
        </s-select>
      </s-section>

      <s-section slot="aside" heading="Applies to">
        <s-stack gap="small">
          <s-choice-list
            label="Applies to"
            labelAccessibilityVisibility="exclusive"
            name={scopeName}
            onChange={(e) => {
              const v = e.currentTarget.values?.[0];
              if (v) patch({ storeWide: v === 'store' });
            }}
          >
            <s-choice value="store" selected={!!draft.storeWide}>
              Store-wide
              <s-text slot="details">Every B2B company and location.</s-text>
            </s-choice>
            <s-choice value="specific" selected={!draft.storeWide}>
              Specific companies and locations
            </s-choice>
          </s-choice-list>
          {!draft.storeWide && (
            <s-stack gap="small-200">
              <s-button icon="search" inlineSize="fill" onClick={() => setCompanyModal(true)}>
                Select companies
              </s-button>
              {picks.selectedCompanies.length ? (
                <s-stack direction="inline" gap="small-300">
                  {picks.selectedCompanies.map((c) => (
                    <s-clickable-chip key={c.id} removable onRemove={() => picks.setTicked(c, [])}>
                      {picks.tagLabel(c)}
                    </s-clickable-chip>
                  ))}
                </s-stack>
              ) : null}
              {errors.targets && (
                <s-paragraph tone="critical" id="limit-targets">
                  {errors.targets}
                </s-paragraph>
              )}
            </s-stack>
          )}
        </s-stack>
      </s-section>

      <s-section slot="aside" heading="When limits overlap">
        <s-paragraph color="subdued" fontSize="small">
          The most specific limit wins: a location’s own, then its company’s, then store-wide. So you can give one account a lower minimum than everyone else.
        </s-paragraph>
      </s-section>

      <SelectCompaniesModal
        open={companyModal}
        companies={picks.companies}
        tickedOf={picks.tickedOf}
        onToggleCompany={picks.toggleCompany}
        onToggleLocation={picks.toggleLocation}
        onClose={() => setCompanyModal(false)}
      />

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} heading={`Delete ${draft.name}?`}>
          <s-paragraph>Buyers it applies to can check out without it right away. This can’t be undone.</s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={() => dispatch({ type: 'DELETE_LIMIT', id: draft.id })}>
            Delete limit
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}
