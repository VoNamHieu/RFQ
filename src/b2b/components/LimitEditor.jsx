import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, defaultLimitMessage, normalizeLimit, limitOverlaps, productRules, inheritedSetting, ruleSkus } from '../limits.js';
import { money } from '../format.js';
import { LimitOverlapBanner } from './LimitOverlapList.jsx';
import { LimitRulesCard } from './LimitRulesCard.jsx';
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
// the OPEN_LIMIT_EDITOR action). Name, then who it applies to, so the empty
// fields below show what those buyers inherit; status in the aside.
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
  const hasErrors = Object.keys(allErrors).length > 0;
  const save = () => {
    if (breaks.length) return undefined;
    if (hasErrors) return setTried(true);
    return dispatch({ type: 'SAVE_LIMIT' });
  };

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
  // each buyer's record is worked out once: what an empty field inherits. Over the
  // whole catalog, so a rule by tag, vendor or type finds the storefront's products too.
  const catalogDb = useMemo(() => withCatalog(state.db), [state.db]);
  const others = useMemo(() => ({ ...catalogDb, limits: (catalogDb.limits || []).filter((l) => l.id !== draft.id) }), [catalogDb, draft.id]);

  // Whether it overlaps other limits, read off the limits two at a time, so it
  // updates as the fields change. One message whatever it is (LimitOverlapBanner);
  // it never blocks saving. Shown once the limit knows who it's for.
  const checkable = Object.keys(allErrors).every((k) => k === 'name');
  const overlaps = useMemo(() => (checkable ? limitOverlaps(catalogDb, draft) : []), [catalogDb, draft, checkable]);

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
      primaryAction={{ content: isNew ? 'Create limit' : 'Save', onAction: save, disabled: breaks.length > 0 }}
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
        <LimitOverlapBanner overlaps={overlaps} />
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
            {moved.length ? (
              <s-banner tone="info" heading="Some products follow another rule now" data-field="rules-moved">
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
            />
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
            ? 'The most specific limit wins: a customer’s own, then their tag’s, then all customers. So you can give one customer a lower minimum than everyone else. A customer with several tags gets the newest of those tags’ limits.'
            : 'The most specific limit wins: a location’s own, then its company’s, then store-wide. So you can give one account a lower minimum than everyone else.'}
        </s-paragraph>
        <s-paragraph color="subdued" fontSize="small">
          At the same level, the stricter order setting applies. A product in two product limits takes the newer limit’s quantities.
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
