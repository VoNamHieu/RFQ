import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, defaultLimitMessage, normalizeLimit, limitConflicts, newConflicts, productRules, newProductRule, inheritedSetting, blockingOf, notesOf } from '../limits.js';
import { money } from '../format.js';
import { LimitConflictList } from './LimitConflictList.jsx';
import { ProductScopeFields } from './pricingEditorCards.jsx';
import { SelectCompaniesModal, CustomerTargetsBox, companyPicks } from './AssignmentCard.jsx';
import { Modal, useWcId, PageHeader } from '../../shared/wc.jsx';
import { limitCatalog, withCatalog } from '../limitCatalog.js';
import { contractsHolding, contractNames, newlyBroken } from '../agreements.js';

const str = (v) => (v == null ? '' : String(v));
// An empty field's placeholder: what the buyers get from the wider limits (see inheritedSetting).
const inheritedHint = (h, show) =>
  h == null ? 'No limit' : h === 'varies' ? 'Inherited, varies' : h.mode === 'none' ? `Inherited: none · ${h.limit.name}` : `Inherited: ${show(h.value)} · ${h.limit.name}`;

// Shared with the list and the agreement screens (see limitCatalog.js).
export { limitCatalog, withCatalog };
// Errors that only mean "not filled in yet" wait for a save attempt; the rest
// (min above max, not a multiple…) show as soon as they're true.
const REQUIRED = ['name', 'order', 'targets'];
// A product rule's "set a quantity" / "pick products" wait for a save attempt too.
const isRequired = (k) => REQUIRED.includes(k) || /^rule-\d+(-products)?$/.test(k);

// Create / edit one order limit — an in-frame page in the Order limits view (see
// the OPEN_LIMIT_EDITOR action). Settings in the main column; status and who it
// applies to in the aside, like the pricing editor.
// Deleting a limit: what it leaves between other limits (it can stop covering a
// clash). Ones that stop orders block the delete until those limits change.
// Shared with the list.
export function deleteCheck(db, id) {
  const left = newConflicts(withCatalog(db), (db.limits || []).filter((l) => l.id !== id));
  return { blocking: blockingOf(left), notes: notesOf(left) };
}
export function DeleteLimitConflicts({ check }) {
  return (
    <>
      {check.blocking.length ? (
        <>
          <s-paragraph>Without it, other limits stop orders. Change those limits before deleting it:</s-paragraph>
          <LimitConflictList conflicts={check.blocking} />
        </>
      ) : null}
      {check.notes.length ? (
        <>
          <s-paragraph>Without it:</s-paragraph>
          <LimitConflictList conflicts={check.notes} />
        </>
      ) : null}
    </>
  );
}

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
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || !isRequired(k)));
  // Live contracts holding it: editing what it sets adds a version to them; it must
  // stay on and keep reaching where they apply (changing that goes through them).
  const held = isNew ? [] : contractsHolding(state.db, draft.id);
  const breaks = held.length
    ? newlyBroken(state.db, { ...state.db, limits: (state.db.limits || []).map((l) => (l.id === draft.id ? normalizeLimit(draft) : l)) })
    : [];
  // What saving it would do with the other limits, worked out a moment after each
  // change. Conflicts that stop orders block saving: change the limit, or set it
  // to Inactive. Notes (orders still go through) don't.
  const [check, setCheck] = useState({ blocking: [], notes: [] });
  const hasErrors = Object.keys(allErrors).length > 0;
  useEffect(() => {
    if (hasErrors) {
      setCheck({ blocking: [], notes: [] });
      return undefined;
    }
    const t = setTimeout(() => {
      const found = limitConflicts(withCatalog(state.db), draft);
      setCheck({ blocking: blockingOf(found), notes: notesOf(found) });
    }, 250);
    return () => clearTimeout(t);
  }, [draft, state.db, hasErrors]);
  // The ones this limit is part of, or only ones it leaves between other limits.
  const ownBlock = check.blocking.some((c) => (c.ids || []).includes(draft.id || 'new'));
  const save = () => {
    if (breaks.length) return undefined;
    if (hasErrors) return setTried(true);
    const found = limitConflicts(withCatalog(state.db), draft);
    if (blockingOf(found).length) return setCheck({ blocking: blockingOf(found), notes: notesOf(found) });
    return dispatch({ type: 'SAVE_LIMIT' });
  };
  const delCheck = confirmDelete ? deleteCheck(state.db, draft.id) : null;

  // Who it's for, like pricing: Company-based B2B or D2C Wholesale. Switching side
  // clears the other side's picks; D2C can't send an order for review, so its
  // maximum blocks checkout.
  const isD2C = draft.audienceType === 'd2c';
  const setSide = (side) =>
    side === 'd2c'
      ? patch({ audienceType: 'd2c', companyIds: [], locationKeys: [], maxAction: 'block' })
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

  const picks = companyPicks(state.db, draft.companyIds || [], draft.locationKeys || [], ({ companyIds, locationKeys }) =>
    patch({ companyIds, locationKeys }),
  );

  // The other limits (without this one's saved version), the same while editing so
  // each buyer's record is worked out once: what an empty field inherits.
  const others = useMemo(() => ({ ...state.db, limits: (state.db.limits || []).filter((l) => l.id !== draft.id) }), [state.db, draft.id]);

  // A product limit's rules: each picks its products and their quantities.
  const rules = draft.kind === 'product' ? productRules(draft) : [];
  const limitProducts = limitCatalog(state.db);
  const patchRule = (i, p) =>
    patch({
      rules: rules.map((r, j) => (j === i ? { ...r, ...p } : r)),
    });
  const ruleField = (i, key, label) => (
    <s-number-field
      data-field={`rule-${i}-${key}`}
      label={label}
      min={key === 'min' ? 0 : 1}
      step={1}
      inputMode="numeric"
      value={str(rules[i][key])}
      onInput={(e) => patchRule(i, { [key]: e.currentTarget.value })}
      error={errors[`rule-${i}-${key}`]}
      placeholder={inheritedHint(inheritedSetting(others, draft, key, rules[i]), String)}
      autocomplete="off"
    />
  );

  const numberField = (key, label, opts = {}) => (
    <s-number-field
      data-field={key}
      label={label}
      min={opts.step === 1 && !key.startsWith('min') ? 1 : 0}
      step={opts.step}
      inputMode={opts.step === 1 ? 'numeric' : 'decimal'}
      prefix={opts.money ? '$' : undefined}
      suffix={opts.suffix}
      value={str(draft[key])}
      onInput={(e) => patch({ [key]: e.currentTarget.value })}
      error={errors[key]}
      details={opts.helpText}
      placeholder={inheritedHint(inheritedSetting(others, draft, key), opts.money ? money : String)}
      autocomplete="off"
    />
  );

  return (
    <>
    <PageHeader
      heading={isNew ? `Create ${kind.label.toLowerCase()}` : `Edit limit: ${draft.name}`}
      backAction={{ content: 'Order limits', onAction: close }}
      primaryAction={{ content: isNew ? 'Create limit' : 'Save', onAction: save, disabled: breaks.length > 0 || check.blocking.length > 0 }}
      secondaryActions={[
        ...(isNew ? [] : [{ content: 'Delete', destructive: true, disabled: held.length > 0, onAction: () => setConfirmDelete(true) }]),
        { content: 'Cancel', onAction: close },
      ]}
    />
    <s-page>
      <s-stack gap="base">
        {breaks.length ? (
          <s-banner tone="critical" heading={`Part of ${contractNames(state.db, breaks)}`}>
            <s-paragraph>It has to stay on and keep applying where the contract applies. To change that, or to delete it, edit the contract.</s-paragraph>
          </s-banner>
        ) : held.length ? (
          <s-banner tone="warning" heading={`Part of ${contractNames(state.db, held)}`}>
            <s-paragraph>A change to what it sets updates the contract, kept as a new version. To turn it off or delete it, edit the contract.</s-paragraph>
          </s-banner>
        ) : null}
        {check.blocking.length ? (
          <s-banner data-field="conflicts-blocking" tone="critical" heading={ownBlock ? 'This limit stops orders, so it can’t be saved' : 'Saving this would leave other limits that stop orders'}>
            <s-stack gap="small-200">
              <LimitConflictList conflicts={check.blocking} />
              <s-paragraph>{ownBlock ? 'Change it so these orders can go through, or set its status to Inactive.' : 'Change those limits first.'}</s-paragraph>
            </s-stack>
          </s-banner>
        ) : null}
        {check.notes.length ? (
          <s-banner data-field="conflicts-notes" tone="warning" heading="How it works with other limits">
            <s-stack gap="small-200">
              <LimitConflictList conflicts={check.notes} />
              <s-paragraph>These don’t stop orders, so you can save.</s-paragraph>
            </s-stack>
          </s-banner>
        ) : null}
        <s-section>
          <s-stack gap="small">
            <s-stack gap="small-400">
              <s-heading>{kind.label}</s-heading>
              <s-paragraph color="subdued" fontSize="small">
                {kind.description}
              </s-paragraph>
            </s-stack>
            <s-text-field
              data-field="name"
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
                  {numberField('minValue', 'Minimum', { money: true, helpText: 'Enter 0 for no minimum.' })}
                  {numberField('maxValue', 'Maximum', { money: true })}
                </s-grid>
                <s-paragraph color="subdued" fontSize="small">
                  The cart subtotal at the {isD2C ? 'customer’s' : 'buyer’s B2B'} prices, before tax, shipping and order discounts. In your store currency, converted for buyers who pay in another.
                </s-paragraph>
                {!isD2C && str(draft.maxValue) !== '' && (
                  <s-choice-list
                    data-field="maxAction"
                    label="When an order is over the maximum"
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
                )}
              </s-stack>
              <s-stack gap="small-200">
                <s-heading>Order quantity</s-heading>
                <s-grid gridTemplateColumns="repeat(2, minmax(0, 1fr))" gap="small">
                  {numberField('minQty', 'Minimum', { step: 1, suffix: 'units', helpText: 'Enter 0 for no minimum.' })}
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
            {rules.map((r, i) => (
              <s-section key={r.id} data-field={`rule-${i}`}>
                <s-stack gap="small">
                  <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small" alignItems="center">
                    <s-heading>{`Rule ${i + 1}`}</s-heading>
                    {rules.length > 1 ? (
                      <s-button
                        icon="delete"
                        variant="tertiary"
                        tone="critical"
                        accessibilityLabel={`Remove rule ${i + 1}`}
                        onClick={() => patch({ rules: rules.filter((_, j) => j !== i) })}
                      />
                    ) : null}
                  </s-grid>
                  {/* The storefront's catalog too, so a product limit can be checked there. */}
                  <ProductScopeFields builder={r} patch={(p) => patchRule(i, p)} products={limitProducts} />
                  {errors[`rule-${i}-products`] && (
                    <s-paragraph tone="critical">{errors[`rule-${i}-products`]}</s-paragraph>
                  )}
                  <s-query-container>
                    <s-grid gridTemplateColumns="@container (inline-size > 490px) 1fr 1fr 1fr, 1fr" gap="small">
                      {ruleField(i, 'min', 'Minimum')}
                      {ruleField(i, 'max', 'Maximum')}
                      {ruleField(i, 'increment', 'Sold in multiples of')}
                    </s-grid>
                  </s-query-container>
                  {errors[`rule-${i}`] && <s-paragraph tone="critical">{errors[`rule-${i}`]}</s-paragraph>}
                </s-stack>
              </s-section>
            ))}
            <s-stack gap="small-200">
              <s-stack direction="inline">
                <s-button icon="plus" onClick={() => patch({ rules: [...rules, newProductRule()] })}>
                  Add rule
                </s-button>
              </s-stack>
              {errors.rules && <s-paragraph tone="critical">{errors.rules}</s-paragraph>}
              <s-paragraph color="subdued" fontSize="small">
                Counted per variant, like Shopify’s quantity rules. Use multiples for case packs, e.g. 12. The minimum and maximum must be multiples of it. Leave a field empty to keep what wider limits set; 0 is no minimum and 1 no pack size.
              </s-paragraph>
            </s-stack>
          </>
        )}

        <s-section heading="Buyer message">
          <s-text-area
            data-field="message"
            label="Message buyers see"
            rows={2}
            value={draft.message || ''}
            onInput={(e) => patch({ message: e.currentTarget.value })}
            placeholder={defaultLimitMessage(normalizeLimit(draft))}
            details="Shown in the cart and at checkout when an order breaks this limit. Leave it empty to use the suggested message. When the limit sets more than one thing, buyers see the suggested message for the one they broke."
            autocomplete="off"
          />
        </s-section>

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
                  data-field="appliesTo"
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
                      data-field="targets"
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

        <s-section heading="Dates">
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
              {/* Date fields commit on change (typing emits partial dates on input). */}
              <s-date-field
                data-field="startDate"
                label="Start date"
                value={draft.startDate || ''}
                onChange={(e) => patch({ startDate: e.currentTarget.value })}
                details="Leave empty to start right away."
              />
              <s-date-field
                data-field="endDate"
                label="End date"
                value={draft.endDate || ''}
                onChange={(e) => patch({ endDate: e.currentTarget.value })}
                error={errors.endDate}
                details="Leave empty for no end date."
              />
            </s-grid>
          </s-query-container>
        </s-section>

        {/* A maximum order value per week or month, so splitting an order doesn't get around it. */}
        {draft.kind === 'order' && (
          <s-section heading="Advanced">
            <s-select
              data-field="period"
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

      <s-section slot="aside">
        <s-select data-field="status" label="Status" value={draft.status} onChange={(e) => patch({ status: e.currentTarget.value })}>
          <s-option value="Active">Active</s-option>
          <s-option value="Inactive">Inactive</s-option>
        </s-select>
      </s-section>

      <s-section slot="aside" heading="When limits overlap">
        <s-paragraph color="subdued" fontSize="small">
          {isD2C
            ? 'The most specific limit wins: a customer’s own, then their tag’s, then all customers. So you can give one customer a lower minimum than everyone else.'
            : 'The most specific limit wins: a location’s own, then its company’s, then store-wide. So you can give one account a lower minimum than everyone else.'}
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
          <s-stack gap="small">
            <s-paragraph>Buyers it applies to can check out without it right away. This can’t be undone.</s-paragraph>
            <DeleteLimitConflicts check={delCheck} />
          </s-stack>
          <s-button slot="primary-action" variant="primary" tone="critical" disabled={delCheck.blocking.length > 0} onClick={() => dispatch({ type: 'DELETE_LIMIT', id: draft.id })}>
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
