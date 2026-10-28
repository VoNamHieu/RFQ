import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { LIMIT_KINDS, limitErrors, defaultLimitMessage, normalizeLimit, productRules, newProductRule, inheritedSetting, isD2CLimit } from '../limits.js';
import { money } from '../format.js';
import { ProductScopeFields } from './pricingEditorCards.jsx';
import { SelectCompaniesModal, CustomerTargetsBox, companyPicks, ContractKeptNote } from './AssignmentCard.jsx';
import { Modal, useWcId, PageHeader } from '../../shared/wc.jsx';
import { limitCatalog, withCatalog } from '../limitCatalog.js';
import {
  contractsHolding,
  keptByContracts,
  contractNames,
  newlyBroken,
  termChanged,
  openContractsHolding,
  lastTermOf,
} from '../agreements.js';
import { useContractLock, LeavingContracts, DraftsLosingIt, SwitchToD2CAsNew } from './ContractLock.jsx';

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
// applies to in the aside, like the pricing editor. Limits that contradict each
// other aren't checked or shown here: where they apply, the limit checks settle them
// (limits.js buildRecord, cartProblems).

export function LimitEditor() {
  const { state, dispatch } = useStore();
  const draft = state.limitEditor.draft;
  const [tried, setTried] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Save dialog for a limit live contracts hold: override it (a version in each), or
  // save the changes as a new limit.
  const [contractConfirm, setContractConfirm] = useState(false);
  // Save dialog for switching it to D2C Wholesale while contracts hold it.
  const [sideConfirm, setSideConfirm] = useState(false);
  // Switched to D2C Wholesale while live contracts hold it: only Save as new limit.
  const [d2cConfirm, setD2cConfirm] = useState(false);
  // Changes that would stop it applying where an Active contract applies: only Save as new limit.
  const [breakConfirm, setBreakConfirm] = useState(false);
  // Turning it off or deleting it while live contracts hold it goes through them.
  const [showLock, lockModal] = useContractLock();
  const scopeName = useWcId('limit-scope');
  const patch = (p) => dispatch({ type: 'LIMIT_EDITOR_PATCH', patch: p });
  const close = () => dispatch({ type: 'CLOSE_LIMIT_EDITOR' });

  const isNew = !draft.id;
  const kind = LIMIT_KINDS[draft.kind];
  const allErrors = limitErrors(draft);
  const errors = Object.fromEntries(Object.entries(allErrors).filter(([k]) => tried || !isRequired(k)));
  // Live contracts holding it: editing what it sets adds a version to them; it must
  // stay on and keep reaching where they apply. `breaks`: the ones the changes would
  // leave without it — then they save only as a new limit.
  const held = isNew ? [] : contractsHolding(state.db, draft.id);
  const saved = isNew ? null : (state.db.limits || []).find((l) => l.id === draft.id) || null;
  const edited = normalizeLimit(draft);
  // Switched to D2C Wholesale: with live contracts holding it, it saves only as a new
  // D2C limit (this one stays as it is). Only drafts holding it: a dialog names them
  // first, and the ones left with no terms.
  const toD2C = !!saved && !isD2CLimit(saved) && isD2CLimit(edited);
  const leaving = toD2C ? openContractsHolding(state.db, draft.id) : [];
  const emptied = toD2C ? lastTermOf(state.db, draft.id) : [];
  const breaks = held.length && !toD2C
    ? newlyBroken(state.db, { ...state.db, limits: (state.db.limits || []).map((l) => (l.id === draft.id ? edited : l)) })
    : [];
  // Saving onto it adds a version to the live contracts holding it (when what it sets,
  // or its name, changed — not its dates: in a contract it follows the contract's):
  // confirm first.
  const versionsContracts = !toD2C && held.length > 0 && !!saved && termChanged(state.db, saved, edited, true);
  const hasErrors = Object.keys(allErrors).length > 0;
  const save = () => {
    if (hasErrors) return setTried(true);
    if (breaks.length) return setBreakConfirm(true);
    if (toD2C && held.length) return setD2cConfirm(true);
    if (leaving.length) return setSideConfirm(true);
    if (versionsContracts) return setContractConfirm(true);
    return dispatch({ type: 'SAVE_LIMIT' });
  };
  const locked = (verb) => showLock({ name: saved?.name || draft.name, count: held.length, verb });

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

  // The companies and locations Active contracts give it to: they stay in "Applies
  // to" (taking it off them goes through the contract).
  const kept = isNew ? {} : keptByContracts(state.db, draft.id);
  const picks = companyPicks(
    state.db,
    draft.companyIds || [],
    draft.locationKeys || [],
    ({ companyIds, locationKeys }) => patch({ companyIds, locationKeys }),
    kept,
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
      primaryAction={{ content: isNew ? 'Create limit' : 'Save', onAction: save }}
      secondaryActions={[
        ...(isNew ? [] : [{ content: 'Delete', destructive: true, onAction: () => (held.length ? locked('delete') : setConfirmDelete(true)) }]),
        { content: 'Cancel', onAction: close },
      ]}
    />
    <s-page>
      <s-stack gap="base">
        {held.length ? (
          <s-banner tone="warning" heading={`Part of ${contractNames(state.db, held)}`}>
            <s-paragraph>A change to what it sets updates the contract, kept as a new version. To turn it off or delete it, edit the contract.</s-paragraph>
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
                          <s-clickable-chip key={c.id} removable={!picks.allKept(c)} accessibilityLabel={`Remove ${picks.tagLabel(c)}`} onRemove={() => picks.setTicked(c, [])}>
                            {picks.tagLabel(c)}
                          </s-clickable-chip>
                        ))}
                      </s-stack>
                    ) : null}
                    <ContractKeptNote db={state.db} keep={kept} what="limit" />
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
          {held.length ? (
            <s-paragraph color="subdued" fontSize="small">
              {`In contracts (${held.map((a) => a.number).join(', ')}), it follows the contract’s dates.`}
            </s-paragraph>
          ) : null}
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
        <s-select
          data-field="status"
          label="Status"
          value={draft.status}
          onChange={(e) => {
            // Inactive while live contracts hold it: the lock box, and it stays as it was.
            if (e.currentTarget.value === 'Inactive' && held.length && !toD2C) {
              e.currentTarget.value = draft.status;
              locked('turn off');
            } else patch({ status: e.currentTarget.value });
          }}
        >
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
        keep={kept}
      />

      {confirmDelete && (
        <Modal onClose={() => setConfirmDelete(false)} heading={`Delete ${draft.name}?`}>
          <s-stack gap="small">
            <s-paragraph>Buyers it applies to can check out without it right away. This can’t be undone.</s-paragraph>
            <DraftsLosingIt db={state.db} id={draft.id} />
          </s-stack>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={() => dispatch({ type: 'DELETE_LIMIT', id: draft.id })}>
            Delete limit
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(false)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {sideConfirm && (
        <Modal onClose={() => setSideConfirm(false)} heading="Change who this limit applies to?">
          <LeavingContracts db={state.db} leaving={leaving} emptied={emptied} />
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setSideConfirm(false);
              dispatch({ type: 'SAVE_LIMIT' });
            }}
          >
            Save changes
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setSideConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {/* No Cancel: closing it (X) saves nothing. */}
      {d2cConfirm && (
        <Modal onClose={() => setD2cConfirm(false)} heading="Change who this limit applies to?">
          <SwitchToD2CAsNew db={state.db} name={saved.name} what="limit" held={held} />
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setD2cConfirm(false);
              dispatch({ type: 'SAVE_LIMIT', asNew: true });
            }}
          >
            Save as new limit
          </s-button>
        </Modal>
      )}
      {/* No Cancel: closing it (X) saves nothing. */}
      {breakConfirm && (
        <Modal onClose={() => setBreakConfirm(false)} heading={`Save changes to ${saved.name}?`}>
          <s-paragraph>
            {`${saved.name} is part of ${contractNames(state.db, breaks)}, and these changes would stop it applying where ${
              breaks.length === 1 ? 'the contract applies' : 'those contracts apply'
            }. Save them as a new order limit instead: it takes ${saved.name}’s place for every company and location outside ${
              breaks.length === 1 ? 'the contract' : 'these contracts'
            }, and ${saved.name} stays as it is, only in ${breaks.length === 1 ? 'the contract' : 'these contracts'}.`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setBreakConfirm(false);
              dispatch({ type: 'SAVE_LIMIT', asNew: true });
            }}
          >
            Save as new limit
          </s-button>
        </Modal>
      )}
      {lockModal}

      {/* No Cancel: closing it (X) saves nothing. */}
      {contractConfirm && (
        <Modal onClose={() => setContractConfirm(false)} heading={`Save changes to ${saved.name}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {held.length === 1
                ? `${saved.name} is assigned to ${contractNames(state.db, held)}. Changing it adds a new version to the contract. You can also save your changes as a new order limit: it takes ${saved.name}’s place for every company and location outside the contract, and ${saved.name} stays as it is, only in the contract.`
                : `${saved.name} is assigned to ${held.length} contracts: ${contractNames(state.db, held)}. Changing it adds a new version to each of them. You can also save your changes as a new order limit: it takes ${saved.name}’s place for every company and location outside these contracts, and ${saved.name} stays as it is, only in these contracts.`}
            </s-paragraph>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setContractConfirm(false);
              dispatch({ type: 'SAVE_LIMIT' });
            }}
          >
            Override
          </s-button>
          <s-button
            slot="secondary-actions"
            onClick={() => {
              setContractConfirm(false);
              dispatch({ type: 'SAVE_LIMIT', asNew: true });
            }}
          >
            Save as new limit
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}
