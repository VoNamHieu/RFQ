import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, normalizeLimit, limitOverlaps, productRules, ruleSkus, canReview, isLimitAssigned, limitTargetsLabel, isD2CLimit } from '../limits.js';
import { money } from '../format.js';
import { LimitOverlapMessage } from './LimitOverlapList.jsx';
import { LimitRulesCard } from './LimitRulesCard.jsx';
import { SelectCompaniesModal, CustomerTargetsBox, companyPicks } from './AssignmentCard.jsx';
import { Modal, useWcId, PageHeader } from '../../shared/wc.jsx';
import { limitCatalog, withCatalog } from '../limitCatalog.js';
import { isContractTerm } from '../agreements.js';
import { versionFlags } from '../../shared/versions.js';
import { TIMEZONES, storeTimezone } from '../timezones.js';

const str = (v) => (v == null ? '' : String(v));

// Shared with the list and the agreement screens (see limitCatalog.js).
export { limitCatalog, withCatalog };
// A limit's delete confirmation, like pricing's: "This deletes the limit and
// unassigns it from ABC Construction. …" (here and in the Order limits list). Store-wide
// and all / logged-in / non-logged-in customers read in lower case mid-sentence.
export function deleteLimitText(l, db) {
  if (!isLimitAssigned(l)) return 'This deletes the limit.';
  const label = limitTargetsLabel(l, db);
  const where = l.storeWide ? 'all companies' : isD2CLimit(l) && !['specific', 'tags'].includes(l.customerTarget) ? label.toLowerCase() : label;
  return `This deletes the limit and unassigns it from ${where}. Buyers there can check out without it right away.`;
}
// Errors that only mean "not filled in yet" wait for a save attempt; the rest
// (min above max, not a multiple…) show as soon as they're true.
const REQUIRED = ['name', 'order', 'targets'];
// A product rule's "set a quantity" / "pick products" wait for a save attempt too.
const isRequired = (k) => REQUIRED.includes(k) || /^rule-\d+(-products)?$/.test(k);

// Create / edit one order limit — an in-frame page in the Order limits view (see
// the OPEN_LIMIT_EDITOR action). Name, who it applies to (it decides what the
// settings below offer), what it sets; status in the aside. Limits never combine,
// so an empty field is no limit. A contract's own limit (opened from its contract
// editor) has no Applies to, dates or status — the contract decides who gets it and
// when; saving keeps it in the contract editor, which applies it when the contract
// is saved.
export function LimitEditor() {
  const { state, dispatch } = useStore();
  const draft = state.limitEditor.draft;
  const [tried, setTried] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSave, setConfirmSave] = useState(false);
  const scopeName = useWcId('limit-scope');
  const patch = (p) => dispatch({ type: 'LIMIT_EDITOR_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_LIMIT_EDITOR' });

  const isNew = !draft.id;
  const kind = LIMIT_KINDS[draft.kind];
  const forContracts = isContractTerm(draft);
  const contract = state.limitEditor.contractTerm ? state.agreementEditor?.draft : null;
  const allErrors = limitErrors(draft);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || !isRequired(k)));
  const saved = isNew ? null : (state.db.limits || []).find((l) => l.id === draft.id) || null;
  const hasErrors = Object.keys(allErrors).length > 0;
  // Saving a regular limit that overlaps other limits (limitOverlaps) shows one
  // message first, as turning one on does — a note, it still saves. A contract's
  // own limits are checked in the contract editor.
  const save = () => {
    if (hasErrors) return setTried(true);
    if (!forContracts && limitOverlaps(catalogDb, draft).length) return setConfirmSave(true);
    return dispatch({ type: 'SAVE_LIMIT' });
  };

  // Who it's for, like pricing: Company-based B2B or D2C Wholesale. Switching side
  // clears the other side's picks; without D2C order requests (canReview), a D2C
  // maximum blocks checkout.
  const isD2C = draft.audienceType === 'd2c';
  const reviewable = canReview(draft);
  const setSide = (side) =>
    side === 'd2c'
      ? patch({ audienceType: 'd2c', companyIds: [], locationKeys: [], ...(canReview({ audienceType: 'd2c' }) ? {} : { maxAction: 'block' }) })
      : patch({ audienceType: 'b2b', customerTarget: 'all', customerTargetIds: [] });
  const side = (value, label) => (
    <button type="button" className="wc-plain-button wc-segmented__item" aria-pressed={(isD2C ? 'd2c' : 'b2b') === value} onClick={() => setSide(value)}>
      {label}
    </button>
  );
  const setTarget = (t) => patch({ customerTarget: t, customerTargetIds: t === draft.customerTarget ? draft.customerTargetIds || [] : [] });
  const setCustomerId = (id, on) => {
    const cur = draft.customerTargetIds || [];
    patch({ customerTargetIds: on ? [...new Set([...cur, id])] : cur.filter((x) => x !== id) });
  };

  const picks = companyPicks(
    state.db,
    draft.companyIds || [],
    draft.locationKeys || [],
    ({ companyIds, locationKeys }) => patch({ companyIds, locationKeys }),
  );

  // Over the whole catalog, so a rule by tag, vendor or type finds the storefront's products too.
  const catalogDb = useMemo(() => withCatalog(state.db), [state.db]);

  // A product limit's rules: each picks its products and their quantities.
  const rules = draft.kind === 'product' ? productRules(draft) : [];
  const limitProducts = limitCatalog(state.db);
  const patchRule = (i, p) =>
    patch({
      rules: rules.map((r, j) => (j === i ? { ...r, ...p } : r)),
    });
  const titleOf = (sku) => limitProducts.find((p) => p.sku === sku)?.title || sku;
  // Product titles can hold commas ("Industrial filter, XL"), so a list uses semicolons.
  const someTitles = (skus) => {
    const names = skus.slice(0, 3).map(titleOf);
    if (skus.length > 3) return `${names.join('; ')} and ${skus.length - 3} more`;
    return names.length > 1 ? `${names.slice(0, -1).join('; ')} and ${names.at(-1)}` : names[0];
  };
  // Products the rules as they are now give to a different rule than the saved limit
  // did (moving a rule, or changing which products a rule has).
  const ownerOf = (l) => {
    const owner = new Map();
    for (const r of productRules(l)) {
      const skus = r.scopeType === 'all' ? limitProducts.map((p) => p.sku) : ruleSkus(r, catalogDb);
      skus.forEach((sku) => { if (!owner.has(sku)) owner.set(sku, r.id); });
      if (r.scopeType === 'all') break; // every product is taken
    }
    return owner;
  };
  const savedLimit = draft.kind === 'product' && draft.id ? (state.db.limits || []).find((l) => l.id === draft.id) : null;
  const moved = savedLimit
    ? (() => {
        const before = ownerOf(savedLimit);
        const after = ownerOf(draft);
        return [...after].filter(([sku, id]) => before.has(sku) && before.get(sku) !== id).map(([sku]) => sku);
      })()
    : [];
  const ruleField = (i, key, label) => (
    <s-number-field
      label={label}
      min={key === 'min' ? 0 : 1}
      step={1}
      inputMode="numeric"
      value={str(rules[i][key])}
      onInput={(e) => patchRule(i, { [key]: e.currentTarget.value })}
      error={errors[`rule-${i}-${key}`]}
      placeholder="No limit"
      autocomplete="off"
    />
  );

  // Over a maximum (the order value or quantity, or a product rule's): block
  // checkout, or let the buyer send an order request (see canReview).
  const maxActionChoice = (label) => (
    <s-choice-list
      label={label}
      name={`${scopeName}-max-action`}
      onChange={(e) => {
        const v = e.currentTarget.values?.[0];
        if (v) patch({ maxAction: v });
      }}
    >
      <s-choice value="block" selected={draft.maxAction !== 'review'}>
        Block checkout
      </s-choice>
      <s-choice value="review" selected={draft.maxAction === 'review'}>
        Let the buyer send an order request for your review
      </s-choice>
    </s-choice-list>
  );

  const numberField = (key, label, opts = {}) => (
    <s-number-field
      label={label}
      min={opts.step === 1 && !key.startsWith('min') ? 1 : 0}
      step={opts.step}
      inputMode={opts.step === 1 ? 'numeric' : 'decimal'}
      prefix={opts.money ? '$' : undefined}
      suffix={opts.suffix}
      value={str(draft[key])}
      onInput={(e) => patch({ [key]: e.currentTarget.value })}
      error={errors[key]}
      placeholder="No limit"
      autocomplete="off"
    />
  );

  return (
    <>
    <PageHeader
      heading={isNew ? `Create ${kind.label.toLowerCase()}` : `Edit limit: ${draft.name}`}
      // In a contract: its number by the title, and saving or going back returns to it.
      titleMetadata={contract ? <s-badge>{`Contract ${contract.number}`}</s-badge> : null}
      backAction={{ content: contract ? contract.number : 'Order limits', onAction: close }}
      primaryAction={{ content: contract ? (isNew ? 'Add to contract' : 'Done') : isNew ? 'Create limit' : 'Save', onAction: save }}
      secondaryActions={[
        // A contract's own limit comes out of it in the contract editor.
        ...(isNew || contract ? [] : [{ content: 'Delete', destructive: true, onAction: () => setConfirmDelete(true) }]),
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

        {!forContracts && (
        <s-section heading="Applies to">
          <s-stack gap="small">
            <div className="wc-segmented" role="group" aria-label="Applies to">
              {side('b2b', 'Company-based B2B')}
              {side('d2c', 'D2C Wholesale')}
            </div>
            {isD2C ? (
              <s-stack gap="small-200">
                <s-text color="subdued" fontSize="small">
                  B2B buyers get their company’s limits, so they are never covered here.
                </s-text>
                <CustomerTargetsBox
                  db={state.db}
                  target={draft.customerTarget || 'all'}
                  ids={draft.customerTargetIds || []}
                  onTarget={setTarget}
                  onSetId={setCustomerId}
                  name={`${scopeName}-customers`}
                />
                {errors.targets && (
                  <s-paragraph tone="critical" id="limit-targets">
                    {errors.targets}
                  </s-paragraph>
                )}
              </s-stack>
            ) : (
              <>
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
                    {/* Like the pricing editor's: opens on click / Enter, not on focus —
                        closing the modal hands focus back to this field. */}
                    <s-search-field
                      label="Search companies"
                      labelAccessibilityVisibility="exclusive"
                      placeholder="Search companies"
                      value=""
                      onClick={() => setCompanyModal(true)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') setCompanyModal(true);
                      }}
                    />
                    {picks.selectedCompanies.length ? (
                      <s-stack direction="inline" gap="small-300">
                        {picks.selectedCompanies.map((c) => (
                          <s-clickable-chip key={c.id} removable accessibilityLabel={`Remove ${picks.tagLabel(c)}`} onRemove={() => picks.setTicked(c, [])}>
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
              </>
            )}
          </s-stack>
        </s-section>
        )}

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
                  The cart subtotal at the {isD2C ? 'customer’s' : 'buyer’s B2B'} prices, before tax, shipping and order discounts. In your store currency, converted for buyers who pay in another.
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
              {reviewable && (str(draft.maxValue) !== '' || str(draft.maxQty) !== '') && maxActionChoice('When an order is over the maximum')}
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
            {moved.length ? (
              <s-banner tone="info" heading="Some products follow another rule now">
                {`Compared with the saved limit, ${moved.length} product${moved.length === 1 ? '' : 's'} now take${moved.length === 1 ? 's' : ''} ${moved.length === 1 ? 'its' : 'their'} quantities from a different rule: ${someTitles(moved)}. Check them before you save.`}
              </s-banner>
            ) : null}
            <LimitRulesCard
              rules={rules}
              setRules={(next) => patch({ rules: next })}
              ruleField={ruleField}
              errors={errors}
              products={limitProducts}
              db={catalogDb}
              startOpen={draft.id ? null : 0}
            >
              {reviewable && rules.some((r) => str(r.max) !== '') && maxActionChoice('When a product is over its maximum')}
            </LimitRulesCard>
          </>
        )}

        <s-section heading="Buyer message">
          <s-text-area
            label="Message buyers see"
            rows={2}
            value={draft.message || ''}
            onInput={(e) => patch({ message: e.currentTarget.value })}
            placeholder={
              draft.kind === 'product'
                ? 'Some products in your cart are outside their quantity limits.'
                : 'Your order doesn’t meet the order limits for your account.'
            }
            details="Shown in the cart and at checkout when an order breaks this limit. Leave it empty to use the suggested message. When the limit sets more than one thing, buyers see the suggested message for the one they broke."
            autocomplete="off"
          />
        </s-section>

        {!forContracts && (
        <s-section heading="Dates">
          <s-stack gap="small">
            {/* Timezone: the store's until one is picked. */}
            <s-select label="Timezone" value={draft.timezone || storeTimezone(state.db)} onChange={(e) => patch({ timezone: e.currentTarget.value })}>
              {TIMEZONES.map((tz) => (
                <s-option key={tz} value={tz}>
                  {tz}
                </s-option>
              ))}
            </s-select>
            <s-query-container>
              <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
                {/* Date fields commit on change (typing emits partial dates on input). */}
                <s-date-field
                  label="Start date"
                  value={draft.startDate || ''}
                  onChange={(e) => patch({ startDate: e.currentTarget.value })}
                  details="Leave empty to start right away."
                />
                <s-date-field
                  label="End date"
                  value={draft.endDate || ''}
                  onChange={(e) => patch({ endDate: e.currentTarget.value })}
                  error={errors.endDate}
                  details="Leave empty for no end date."
                />
              </s-grid>
            </s-query-container>
          </s-stack>
        </s-section>
        )}

        {/* A maximum order value per week or month, so splitting an order doesn't get
            around it. Hidden behind the limitPeriods flag (versions.js) for now. */}
        {draft.kind === 'order' && versionFlags().limitPeriods && (
          <s-section heading="Advanced">
            <s-select
              label="Count the maximum order value"
              value={draft.period || 'order'}
              onChange={(e) => patch({ period: e.currentTarget.value })}
              details="Weekly and monthly maximums add up the buyer’s orders in that period, including ones waiting for review, so splitting an order doesn’t get around them."
            >
              <s-option value="order">Per order</s-option>
              <s-option value="week">Per week (Monday to Sunday)</s-option>
              <s-option value="month">Per month</s-option>
            </s-select>
          </s-section>
        )}
      </s-stack>

      {/* A contract's own limit has no Status: an empty aside keeps the page's two
          columns, like the other limits' (s-page lays out an aside column only when the
          slot has something). */}
      {forContracts ? (
        <div slot="aside" />
      ) : (
        <s-section slot="aside">
          <s-select label="Status" value={draft.status} onChange={(e) => patch({ status: e.currentTarget.value })}>
            <s-option value="Active">Active</s-option>
            <s-option value="Inactive">Inactive</s-option>
          </s-select>
        </s-section>
      )}

      <SelectCompaniesModal
        needsLocation
        open={companyModal}
        companies={picks.companies}
        tickedOf={picks.tickedOf}
        onToggleCompany={picks.toggleCompany}
        onToggleLocation={picks.toggleLocation}
        onClose={() => setCompanyModal(false)}
      />

      {confirmSave && (
        <Modal onClose={() => setConfirmSave(false)} heading={`${isNew ? 'Create' : 'Save'} ${draft.name}?`}>
          <LimitOverlapMessage />
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setConfirmSave(false);
              dispatch({ type: 'SAVE_LIMIT' });
            }}
          >
            {isNew ? 'Create limit' : 'Save'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmSave(false)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} heading={`Delete ${draft.name}?`}>
          <s-stack gap="small">
            <s-paragraph>{deleteLimitText(saved || normalizeLimit(draft), state.db)}</s-paragraph>
          </s-stack>
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
