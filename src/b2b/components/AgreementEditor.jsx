import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel, baseInScope, policyPriceBreakdown, resolveDetail, withContractPricing } from '../pricing.js';
import { limitSummary, isD2CLimit, newConflicts, blockingOf, notesOf } from '../limits.js';
import { LimitConflictList } from './LimitConflictList.jsx';
import { withCatalog } from './LimitEditor.jsx';
import {
  agreementChanges,
  limitsAfterAgreement,
  companyAfterAgreement,
  isLive,
  liveStatus,
  fmtDay,
  sharedLocations,
  namesOf,
  joinAnd,
  takeoverParts,
  sameAgreement,
  termWarnings,
  agreementClashes,
  contractPricingAfter,
  contractDatesAfter,
  followsContractDates,
  termDateWarnings,
  coverFrom,
  canCreateAgreement,
  defaultStartDate,
  agreementScopeLabel,
  agreementDatesLabel,
  appliesAt,
} from '../agreements.js';
import { TODAY } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';
import { Modal, PageHeader } from '../../shared/wc.jsx';

// Create / edit a company's agreement — an in-frame page in the Agreements view
// (OPEN_AGREEMENT_EDITOR). Terms are picked from the Pricing and Order limits
// libraries; who gets them is all of the company's locations or some, picked like a
// pricing's or order limit's companies (one company per contract). An inactive one
// is activated here; an active agreement saves as its next version, applied at once.
// A location is in one contract at a time: an inactive one can't overlap the Active or
// Scheduled ones at its locations (clashesAt) — where Active ones apply, it takes those
// locations over when it starts, after they end. Drafts don't clash with each other.
// Any location can be picked; saving says which contracts it overlaps, to change one
// of them. Created from Contracts, the company is picked here too (`pickCompany`);
// otherwise only its locations are.
export function AgreementEditor() {
  const { state, dispatch } = useStore();
  const draft = state.agreementEditor.draft;
  const pickCompany = !!state.agreementEditor.pickCompany;
  const company = state.db.companies.find((c) => c.id === draft.companyId);
  // The name used in the help text before a company is picked.
  const who = company?.name || 'the company';
  const saved = (state.db.agreements || []).find((a) => a.id === draft.id);
  // Live = activated (Scheduled or Active); started = Active, so its start date is fixed.
  const live = isLive(saved);
  const started = saved?.status === 'Active';
  const startsLater = liveStatus(draft) === 'Scheduled';
  // What it does when it starts to the Active contracts at its locations ("replaces
  // CT-301", "takes Hanoi from CT-310"); '' when there are none.
  const takeover = started ? '' : joinAnd(takeoverParts(state.db, draft));
  // How the company's pricing and limits change when it goes live: a started one's
  // live version comes off and the new one goes on; otherwise it takes effect.
  const change = started ? { off: saved, on: draft } : { start: draft };
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const patch = (p) => dispatch({ type: 'AGREEMENT_EDITOR_PATCH', patch: p });
  // A term taken out drops its "Use the contract’s dates" too.
  const setTerms = (p) => {
    const terms = { ...draft.terms, ...p };
    const ids = [...terms.base, ...terms.quantity, ...terms.limits];
    patch({ terms, followDates: (draft.followDates || []).filter((id) => ids.includes(id)) });
  };
  const setFollow = (id, on) =>
    patch({ followDates: on ? [...new Set([...(draft.followDates || []), id])] : (draft.followDates || []).filter((x) => x !== id) });
  const close = () => dispatch({ type: 'CLOSE_AGREEMENT_EDITOR' });
  // Any company can get one. A new contract's untouched start date follows the Active
  // and Scheduled contracts at its locations.
  const canPick = (c) => (pickCompany ? c.id === draft.companyId || canCreateAgreement(state.db, c.id) : c.id === draft.companyId);
  const followStart = (companyId, locationIds) =>
    !saved && draft.startDate === defaultStartDate(state.db, draft.companyId, draft.locationIds) ? { startDate: defaultStartDate(state.db, companyId, locationIds) } : {};
  const setCompany = (id, locationIds) => patch({ companyId: id, locationIds, ...followStart(id, locationIds) });
  // The contract's company and locations as the picker's picks: the whole company,
  // or `companyId::locationId` keys for some of its locations.
  const picks = companyPicks(
    state.db,
    draft.companyId && !draft.locationIds ? [draft.companyId] : [],
    draft.companyId && draft.locationIds ? draft.locationIds.map((l) => `${draft.companyId}::${l}`) : [],
    ({ companyIds, locationKeys }) => {
      const picked = [...new Set([...companyIds, ...locationKeys.map((k) => k.split('::')[0])])];
      // One company per contract: ticking another replaces it. Unticked, a company
      // given by the caller stays, with no locations.
      const id = picked.find((x) => x !== draft.companyId) || picked[0] || (pickCompany ? '' : draft.companyId);
      const locationIds = !id ? null : companyIds.includes(id) ? null : locationKeys.filter((k) => k.startsWith(`${id}::`)).map((k) => k.split('::')[1]);
      if (id !== draft.companyId) setCompany(id, locationIds);
      else patch({ locationIds, ...followStart(id, locationIds) });
    },
  );

  const b2b = state.db.policies.filter((p) => p.audienceType !== 'd2c');
  const bases = b2b.filter((p) => kindOf(p) === 'base');
  // The store's default for all companies, picked as a base pricing: while the
  // contract runs it can't be turned off or deleted — for every company on it.
  const defaultBase = draft.terms.base.includes(state.db.defaults?.b2bPolicyId) ? bases.find((p) => p.id === state.db.defaults.b2bPolicyId) : null;
  const quantities = b2b.filter((p) => kindOf(p) === 'quantity');
  // Store-wide limits already reach every company and D2C ones never reach one, so
  // they aren't offered here.
  const limits = (state.db.limits || []).filter((l) => !l.storeWide && !isD2CLimit(l));

  const errors = {};
  if (!draft.companyId) errors.company = 'Choose a company';
  if (!(draft.name || '').trim()) errors.name = 'Name is required';
  // A live contract can't be saved empty: it can be ended instead.
  if (!draft.terms.base.length && !draft.terms.quantity.length && !draft.terms.limits.length) {
    errors.terms = live
      ? 'Add at least one pricing or order limit. To stop it instead, use End contract on the company’s Contract tab.'
      : 'Add at least one pricing or order limit';
  }
  if (Array.isArray(draft.locationIds) && !draft.locationIds.length) errors.scope = 'Pick at least one location';
  if (!draft.startDate) errors.startDate = 'Choose a start date';
  else if (!started && draft.startDate < TODAY) errors.startDate = 'Can’t be before today';
  if (draft.endDate && draft.startDate && draft.endDate < draft.startDate) errors.endDate = 'Must be after the start date';
  else if (draft.endDate && draft.endDate < TODAY) errors.endDate = 'This date has passed';
  // A location is in one contract at a time (clashesAt): overlapping an Active or
  // Scheduled contract there keeps it from being saved at all, not only activated —
  // saving says so.
  const clash = company ? agreementClashes(state.db, draft, started) : [];
  const clashLine = (a) => {
    const shared = sharedLocations(company, a, draft);
    const where = shared.length ? namesOf(shared) : company.name;
    const is = shared.length <= 1 ? 'is' : 'are';
    if (a.status === 'Scheduled') return `${where} ${is} in ${a.number} from ${fmtDay(a.startDate)}${a.endDate ? ` until ${fmtDay(a.endDate)}` : ''}`;
    if (started) return `${where} ${is} already in ${a.number}`;
    return a.endDate ? `${where} ${is} in ${a.number} until ${fmtDay(a.endDate)}` : `${where} ${is} in ${a.number}, which has no end date`;
  };
  if (clash.length) errors.overlap = `${clash.map(clashLine).join('. ')}. A location can be in one contract at a time.`;
  const valid = !Object.keys(errors).length;
  const shown = (k) => (tried ? errors[k] : undefined);

  // Activating, or saving a live agreement, changes what the company gets — confirm first.
  const goLive = () => (valid ? setConfirm(true) : setTried(true));
  const save = () => (draft.companyId && !errors.overlap && (valid || (draft.name || '').trim()) ? dispatch({ type: 'SAVE_AGREEMENT' }) : setTried(true));
  const nextVersion = (saved?.version || 0) + 1;
  // Saving a live contract unchanged would only add an empty version.
  const unchanged = live && sameAgreement(saved, draft, state.db);
  // The order-limit conflicts going live would cause (the live version — or the
  // contracts it takes locations over from — come off first).
  const goLiveConflicts = confirm ? newConflicts(withCatalog(state.db), limitsAfterAgreement(state.db, change)) : [];
  // Terms that won't apply for the whole contract (turned off, or dated).
  const warnings = confirm ? termWarnings(state.db, draft) : [];
  const when = startsLater ? `on ${fmtDay(draft.startDate)}` : 'right away';
  const until = draft.endDate ? ` They come off after ${fmtDay(draft.endDate)}, unless you extend it.` : '';
  // Overview: the contract at a glance, from the draft, so unsaved edits count.
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const covered = contractProducts(state.db, draft);
  const overview = [
    ['organization', 'Company', company?.name || 'Not picked'],
    ['location', 'Applies to', company ? agreementScopeLabel(company, draft) || 'No locations' : '—'],
    ['calendar', 'Dates', agreementDatesLabel(draft)],
    ['receipt-dollar', 'Pricing', `${draft.terms.base.length} base · ${draft.terms.quantity.length} quantity`],
    ['order', 'Order limits', count(draft.terms.limits.length, 'limit')],
    ['product', 'Products', count(covered.length, 'product')],
  ];

  return (
    <>
    <PageHeader
      heading={saved ? `${draft.number} · ${saved.name}` : `New contract ${draft.number}`}
      subtitle={company?.name}
      backAction={{ content: 'Contracts', onAction: close }}
      primaryAction={{ content: live ? `Save as version ${nextVersion}` : 'Activate', onAction: goLive, disabled: unchanged }}
      secondaryActions={[...(live ? [] : [{ content: 'Save', onAction: save }]), { content: 'Cancel', onAction: close }]}
    />
    <s-page>
      <s-stack gap="base">
        {shown('overlap') && (
          <s-banner tone="critical" heading={`Overlaps ${joinAnd(clash.map((a) => a.number))}`}>
            <s-stack gap="small-200">
              <s-unordered-list>
                {clash.map((a) => (
                  <s-list-item key={a.id}>{`${clashLine(a)}.`}</s-list-item>
                ))}
              </s-unordered-list>
              <s-paragraph>{`To save, adjust one of them: change this contract’s dates or locations, or change ${joinAnd(clash.map((a) => a.number))}.`}</s-paragraph>
            </s-stack>
          </s-banner>
        )}
        <s-section>
          <s-text-field
            label="Contract name"
            required
            value={draft.name}
            onInput={(e) => patch({ name: e.currentTarget.value })}
            error={shown('name')}
            placeholder="e.g. 2027 distributor terms"
            details="Buyers see this name in their account."
            autocomplete="off"
          />
        </s-section>

        <s-section heading="Dates">
          <s-stack gap="small">
            <s-query-container>
              <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
                {/* Date fields commit on change (typing emits partial dates on input). */}
                <s-date-field
                  label="Start date"
                  value={draft.startDate || ''}
                  disabled={started}
                  onChange={(e) => patch({ startDate: e.currentTarget.value })}
                  error={shown('startDate')}
                  details={started ? 'It has started, so this can’t change.' : undefined}
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
            <s-paragraph color="subdued" fontSize="small">
              {takeover
                ? `It starts and ends on its own. On the start date it ${takeover}. After the end date, ${who} goes back to the pricing and limits outside the contract.`
                : `It starts and ends on its own. After the end date, ${who} goes back to the pricing and limits outside the contract.`}
            </s-paragraph>
          </s-stack>
        </s-section>

        <s-section>
          <s-stack gap="base">
            <s-stack gap="small-200">
              <s-heading>Base pricing</s-heading>
              <PricingCombobox
                label="Base pricing"
                labelHidden
                placeholder="Search base pricing"
                candidates={bases}
                selectedIds={draft.terms.base}
                onChange={(ids) => setTerms({ base: ids })}
                optionLabel={(p) => `${p.name} · Priority ${p.priority ?? 0}`}
              />
              {defaultBase ? (
                <s-paragraph color="subdued" fontSize="small">
                  {`${defaultBase.name} is your default pricing for all companies. While this contract runs, it can’t be turned off or deleted — and that applies to every company using it as their default.`}
                </s-paragraph>
              ) : null}
              <DatesCheck draft={draft} terms={pickedOf(draft.terms.base, state.db.policies)} onToggle={setFollow} />
            </s-stack>
            <s-stack gap="small-200">
              <s-heading>Quantity pricing</s-heading>
              <PricingCombobox
                label="Quantity pricing"
                labelHidden
                placeholder="Search quantity pricing"
                candidates={quantities}
                selectedIds={draft.terms.quantity}
                onChange={(ids) => setTerms({ quantity: ids })}
                optionLabel={(p) => `${p.name} · ${scopeLabel(p)}`}
              />
              <DatesCheck draft={draft} terms={pickedOf(draft.terms.quantity, state.db.policies)} onToggle={setFollow} />
            </s-stack>
            <s-stack gap="small-200">
              <s-heading>Order limits</s-heading>
              <PricingCombobox
                label="Order limits"
                labelHidden
                placeholder="Search order limits"
                candidates={limits}
                selectedIds={draft.terms.limits}
                onChange={(ids) => setTerms({ limits: ids })}
                optionLabel={(l) => `${l.name} · ${limitSummary(l, state.db)}`}
                emptyText="No order limits to add. Store-wide limits already apply to every company."
              />
              <DatesCheck draft={draft} terms={pickedOf(draft.terms.limits, state.db.limits)} onToggle={setFollow} />
            </s-stack>
            {shown('terms') && (
              <s-paragraph tone="critical" id="agreement-terms">
                {errors.terms}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>

        <s-section heading="Applies to">
          <s-stack gap="small-200">
            {pickCompany && (
              <s-text color="subdued" fontSize="small">
                A location can be in one contract at a time: this one can’t overlap the Active or Scheduled contracts at its locations.
              </s-text>
            )}
            {/* Like the pricing and order limit editors: opens on click / Enter, not on
                focus — closing the modal hands focus back to this field. */}
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
                  <s-clickable-chip
                    key={c.id}
                    removable={pickCompany}
                    accessibilityLabel={pickCompany ? `Remove ${picks.tagLabel(c)}` : picks.tagLabel(c)}
                    onRemove={() => picks.setTicked(c, [])}
                  >
                    {picks.tagLabel(c)}
                  </s-clickable-chip>
                ))}
              </s-stack>
            ) : null}
            {(shown('company') || shown('scope') || shown('overlap')) && (
              <s-paragraph tone="critical" id="agreement-scope">
                {shown('company') || shown('scope') || shown('overlap')}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>
      </s-stack>

      <s-section slot="aside" heading="Status">
        <s-stack gap="small-200">
          <div>
            <s-badge tone={started ? 'success' : live ? 'info' : undefined}>{live ? `${saved.status} · version ${saved.version}` : 'Inactive'}</s-badge>
          </div>
          {/* While the Overlaps banner is up it can't be saved, so nothing on what saving does. */}
          {shown('overlap') ? (
            live ? null : (
              <s-paragraph color="subdued" fontSize="small">
                Nothing is applied yet.
              </s-paragraph>
            )
          ) : (
            <s-paragraph color="subdued" fontSize="small">
              {live
                ? `Saving gives ${company?.name} your changes ${when}, as version ${nextVersion}.`
                : takeover
                  ? `Nothing is applied yet. Once activated, it ${takeover} ${startsLater ? `on ${fmtDay(draft.startDate)}` : 'right away'}.`
                  : `Nothing is applied yet. Activate to give ${who} these terms ${startsLater ? `from ${fmtDay(draft.startDate)}` : 'right away'}.`}
            </s-paragraph>
          )}
        </s-stack>
      </s-section>
      <s-section slot="aside" heading="Overview">
        <s-stack gap="small">
          <s-stack gap="small-300">
            {overview.map(([icon, label, value]) => (
              <s-grid key={label} gridTemplateColumns="auto 88px minmax(0, 1fr)" gap="small-200" alignItems="start">
                <s-icon type={icon} color="subdued" />
                <s-text color="subdued">{`${label}:`}</s-text>
                <s-text>{value}</s-text>
              </s-grid>
            ))}
          </s-stack>
          <s-divider />
          <s-paragraph color="subdued">{company ? 'See what buyers pay for the products in this contract.' : 'Pick a company to preview prices.'}</s-paragraph>
          <s-button icon="view" inlineSize="fill" disabled={!company} onClick={() => setPreviewOpen(true)}>
            Preview prices
          </s-button>
        </s-stack>
      </s-section>
      {previewOpen && company && (
        <ContractPricePreview draft={draft} change={change} products={covered} onClose={() => setPreviewOpen(false)} />
      )}
      <SelectCompaniesModal
        open={companyModal}
        companies={picks.companies.filter(canPick)}
        tickedOf={picks.tickedOf}
        onToggleCompany={picks.toggleCompany}
        onToggleLocation={picks.toggleLocation}
        onClose={() => setCompanyModal(false)}
        single
      />

      {confirm && (
        <Modal onClose={() => setConfirm(false)} heading={live ? `Save ${draft.number} as version ${nextVersion}?` : `Activate ${draft.number}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {live
                ? `${agreementChanges(saved, draft, state.db)}. ${company?.name} gets the new terms ${when}.${until}`
                : takeover
                  ? `Its pricing and order limits are assigned to ${company?.name} ${when}: it ${takeover}.${until}`
                  : `Its pricing and order limits are assigned to ${company?.name} ${when}.${until}`}
            </s-paragraph>
            {warnings.length ? (
              <>
                <s-paragraph>These terms won’t apply for the whole contract:</s-paragraph>
                <s-unordered-list>
                  {warnings.map((w) => (
                    <s-list-item key={w}>{w}</s-list-item>
                  ))}
                </s-unordered-list>
              </>
            ) : null}
            {/* Order limits that would stop orders block it; notes don't. */}
            {blockingOf(goLiveConflicts).length ? (
              <>
                <s-paragraph>{`${startsLater ? 'When it starts, its' : 'Its'} order limits would stop orders, so it can’t be ${live ? 'saved' : 'activated'}. Change the limits first:`}</s-paragraph>
                <LimitConflictList conflicts={blockingOf(goLiveConflicts)} />
              </>
            ) : null}
            {notesOf(goLiveConflicts).length ? (
              <>
                <s-paragraph>{startsLater ? 'When it starts, how its order limits work with others:' : 'How its order limits work with others:'}</s-paragraph>
                <LimitConflictList conflicts={notesOf(goLiveConflicts)} />
              </>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            disabled={blockingOf(goLiveConflicts).length > 0}
            onClick={() => {
              setConfirm(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            }}
          >
            {live ? 'Save and apply' : 'Activate'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}

const pickedOf = (ids, list) => ids.map((id) => (list || []).find((x) => x.id === id)).filter(Boolean);

// Picked terms whose own dates don't cover the contract (from its start, or from
// today once it has started), each with the choice to apply it on the contract's
// dates here instead — off unless ticked. One already on them stays listed so it
// can be switched back.
function DatesCheck({ draft, terms, onToggle }) {
  const from = coverFrom(draft);
  const rows = terms
    .map((x) => ({ x, gaps: termDateWarnings(x, draft, from) }))
    .filter(({ x, gaps }) => gaps.length || followsContractDates(draft, x.id));
  if (!rows.length) return null;
  return (
    <s-stack gap="small-200">
      {rows.map(({ x, gaps }) => (
        <s-checkbox
          key={x.id}
          label={`Use the contract’s dates for ${x.name}`}
          details={gaps.length ? `${gaps.join('. ')}.` : undefined}
          checked={followsContractDates(draft, x.id)}
          onChange={(e) => onToggle(x.id, e.currentTarget.checked)}
        />
      ))}
    </s-stack>
  );
}

// The products the contract's pricing covers: a base pricing's product scope, a
// quantity pricing's.
function contractProducts(db, ag) {
  const pricing = [...ag.terms.base, ...ag.terms.quantity].map((id) => db.policies.find((p) => p.id === id)).filter(Boolean);
  const covers = (p, product) => (kindOf(p) === 'base' ? baseInScope(p, product.sku) : policyPriceBreakdown(p, product)?.inScope);
  return db.products.filter((product) => pricing.some((p) => covers(p, product)));
}

// "Preview prices": what a buyer pays for each product in the contract once it
// applies (`change`: the version it saves over, or the contracts it takes
// locations over from, come off first), and which pricing decided it — from the
// draft, so unsaved edits count. The contract's pricing applies first (pricing.js);
// pricing outside it decides only the products it doesn't cover. One of the
// contract's locations at a time. Same modal as the company page's Preview prices
// (PricePreviewDialog).
function ContractPricePreview({ draft, change, products, onClose }) {
  const { state } = useStore();
  const [locationId, setLocationId] = useState(null);
  const company = companyAfterAgreement(state.db, change, draft.companyId);
  const locations = (company?.locations || []).filter((l) => appliesAt(company, draft, l.id));
  const location = locations.find((l) => l.id === locationId) || locations[0] || null;
  // Resolved with this contract in force, so its pricing comes first (on the
  // contract's dates where ticked).
  const entries = withContractPricing(
    contractPricingAfter(state.db, change, draft),
    () =>
      products.map((p) => {
        const d = resolveDetail(company, p, state.db.policies, undefined, location);
        return { product: p, shopify: p.list, final: d.price, decidedBy: d.decidedBy, priority: d.policy ? d.policy.priority ?? 0 : null };
      }),
    contractDatesAfter(state.db, change, draft),
  );
  const hasPricing = draft.terms.base.length || draft.terms.quantity.length;

  return (
    <PricePreviewDialog
      title={`Preview prices · ${draft.number}`}
      description={`What a buyer at ${location?.name || company?.name} pays for each product in this contract once it applies. The contract’s pricing comes first; pricing outside it applies only to products it doesn’t cover.`}
      entries={entries}
      emptyLabel={hasPricing ? 'The contract’s pricing covers no products.' : 'Add pricing to the contract to preview prices.'}
      toolbar={
        locations.length > 1 ? (
          <div style={{ width: 220, flex: '0 0 auto' }}>
            <s-select
              label="Location"
              labelAccessibilityVisibility="exclusive"
              icon="location"
              value={location?.id || ''}
              onChange={(e) => setLocationId(e.currentTarget.value)}
            >
              {locations.map((l) => (
                <s-option key={l.id} value={l.id}>
                  {l.name}
                </s-option>
              ))}
            </s-select>
          </div>
        ) : null
      }
      onClose={onClose}
    />
  );
}
