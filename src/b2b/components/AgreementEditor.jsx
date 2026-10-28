import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel, baseInScope, policyPriceBreakdown, resolveDetail, withContractPricing } from '../pricing.js';
import { limitSummary, contractLimitConflicts } from '../limits.js';
import {
  agreementChanges,
  companyAfterAgreement,
  isLive,
  liveStatus,
  fmtDay,
  sameAgreement,
  termWarnings,
  overlapHandover,
  contractPricingAfter,
  addsLaterLocations,
  canCreateAgreement,
  defaultStartDate,
  agreementScopeLabel,
  agreementAppliesToLabel,
  agreementDatesLabel,
  appliesAt,
  isContractTerm,
  overlapLines,
  overlapsHeading,
} from '../agreements.js';
import { TODAY } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';
import { Modal, PageHeader, useWcId } from '../../shared/wc.jsx';

// Create / edit a company's agreement — an in-frame page in the Agreements view
// (OPEN_AGREEMENT_EDITOR). Terms are picked from the Pricing and Order limits
// libraries; who gets them is all of the company's locations or some, picked like a
// pricing's or order limit's companies (one company per contract). An inactive one
// is activated here; an active agreement saves as its next version, applied at once.
// A location is in one contract at a time: activating one, or saving a version of it,
// over the Active or Scheduled ones at its locations (clashesAt) first says what
// happens to them in the Overlaps box — those locations are this one's from its start
// date (handOver). A draft is saved overlapping anything. Created from Contracts, the
// company is picked here too (`pickCompany`); otherwise only its locations are.
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
  // How the company's pricing and limits change when it goes live: a started one's
  // live version comes off and the new one goes on; otherwise it takes effect.
  const change = started ? { off: saved, on: draft } : { start: draft };
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Activate / Save as version over Active or Scheduled contracts at its locations.
  const [overlapBox, setOverlapBox] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const scopeTipId = useWcId('scope-tip');
  const patch = (p) => dispatch({ type: 'AGREEMENT_EDITOR_PATCH', patch: p });
  const setTerms = (p) => patch({ terms: { ...draft.terms, ...p } });
  const close = () => dispatch({ type: 'CLOSE_AGREEMENT_EDITOR' });
  // Any company can get one. A new contract's untouched start date follows the Active
  // and Scheduled contracts at its locations.
  const canPick = (c) => (pickCompany ? c.id === draft.companyId || canCreateAgreement(state.db, c.id) : c.id === draft.companyId);
  const followStart = (companyId, locationIds) =>
    !saved && draft.startDate === defaultStartDate(state.db, draft.companyId, draft.locationIds) ? { startDate: defaultStartDate(state.db, companyId, locationIds) } : {};
  // "Automatically apply this contract to locations added later": ticked by default
  // for all locations, unticked for some; the merchant can change either.
  const laterFor = (locationIds) => ({ applyLater: locationIds === null });
  // Shown only for a company with Auto-add locations on — in the company modal, the one
  // ticked there (ticking one picks it), so none before a company is ticked. Hidden, it
  // keeps its value, so turning Auto-add back on shows it as it was.
  const laterShown = !!company?.autoAddLocations;
  const setCompany = (id, locationIds) => patch({ companyId: id, locationIds, ...laterFor(locationIds), ...followStart(id, locationIds) });
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
      else patch({ locationIds, ...((locationIds === null) !== (draft.locationIds === null) ? laterFor(locationIds) : {}), ...followStart(id, locationIds) });
    },
  );

  // Only contract pricing and contract limits are offered; anything else picked before
  // stays listed, so it can be taken out. Each picker's list starts with Create
  // contract pricing / limit: the new one goes into this contract once saved.
  const picked = [...draft.terms.base, ...draft.terms.quantity, ...draft.terms.limits];
  const terms = state.db.policies.filter((p) => isContractTerm(p) || picked.includes(p.id));
  const bases = terms.filter((p) => kindOf(p) === 'base');
  const quantities = terms.filter((p) => kindOf(p) === 'quantity');
  const limits = (state.db.limits || []).filter((l) => isContractTerm(l) || picked.includes(l.id));
  const createPricing = (kind) => ({
    content: 'Create contract pricing',
    onAction: () => dispatch({ type: 'OPEN_EDITOR', policy: null, kind, forContracts: true, context: { mode: `add-${kind}`, addToAgreement: kind } }),
  });
  const createLimit = {
    content: 'Create contract limit',
    onAction: () => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { limitChooser: { returnTo: { view: 'agreements' } } } }),
  };
  // The limits picked for it that contradict each other (a warning: it still saves).
  // Worked out again only when the limits change.
  const limitConflicts = useMemo(
    () => contractLimitConflicts(state.db, pickedOf(draft.terms.limits, state.db.limits)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.db.limits, state.db.products, draft.terms.limits],
  );

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
  const valid = !Object.keys(errors).length;
  const shown = (k) => (tried ? errors[k] : undefined);

  // A location is in one contract at a time (clashesAt): going live over Active or
  // Scheduled contracts there moves those locations to this one (overlapHandover).
  // A live one's earlier saves already did for the ones it still overlaps the same
  // way: only new overlaps open the Overlaps box.
  const handover = company ? overlapHandover(state.db, draft, started) : [];
  const handedOver = live ? overlapHandover(state.db, saved, started) : [];
  const overlapsNow = handover.filter((h) => {
    const was = handedOver.find((x) => x.old.id === h.old.id);
    return !was || was.from !== h.from || h.shared.some((l) => !was.shared.some((x) => x.id === l.id));
  });
  // One line per contract, two at most (overlapLines). The box says what saving does.
  const overlapList = company ? overlapLines(company, overlapsNow) : [];

  // Activating, or saving a live agreement, changes what the company gets — confirm
  // first (in the Overlaps box when it overlaps other contracts).
  const goLive = () => (!valid ? setTried(true) : overlapsNow.length ? setOverlapBox(true) : setConfirm(true));
  const save = () => (draft.companyId && (valid || (draft.name || '').trim()) ? dispatch({ type: 'SAVE_AGREEMENT' }) : setTried(true));
  const nextVersion = (saved?.version || 0) + 1;
  // Saving a live contract unchanged would only add an empty version.
  const unchanged = live && sameAgreement(saved, draft, state.db);
  // Only "Automatically apply this contract to locations added later" changed: the
  // confirm says just what that does (nothing is applied now).
  const onlyLater =
    live && addsLaterLocations(saved) !== addsLaterLocations(draft) && sameAgreement(saved, { ...draft, applyLater: addsLaterLocations(saved) }, state.db);
  // Terms that won't apply for the whole contract: turned off.
  const warnings = confirm ? termWarnings(state.db, draft) : [];
  const when = startsLater ? `on ${fmtDay(draft.startDate)}` : 'right away';
  // The Activate / Save as version box and an Inactive one's Status: "ABC gets these
  // terms right away, until Oct 31, 2026."
  const getsTerms = `${company?.name || 'The company'} gets these terms ${when}${draft.endDate ? `, until ${fmtDay(draft.endDate)}` : ''}.`;
  // Overview: the contract at a glance, from the draft, so unsaved edits count.
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const covered = contractProducts(state.db, draft);
  const overview = [
    ['organization', 'Company', company?.name || 'Not picked'],
    ['location', 'Applies to', company ? (agreementScopeLabel(company, draft) ? agreementAppliesToLabel(company, draft) : 'No locations') : '—'],
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
              {`It starts and ends on its own. After the end date, ${who} goes back to the pricing and limits outside the contract.`}
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
                action={createPricing('base')}
              />
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
                action={createPricing('quantity')}
              />
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
                action={createLimit}
              />
              {limitConflicts.length ? (
                <s-banner tone="warning" heading="Some of these limits contradict each other">
                  <s-unordered-list>
                    {limitConflicts.map((c, i) => (
                      <s-list-item key={i}>{c}</s-list-item>
                    ))}
                  </s-unordered-list>
                </s-banner>
              ) : null}
            </s-stack>
            <s-text color="subdued" fontSize="small">
              Only contract pricing and contract limits show here.
            </s-text>
            {shown('terms') && (
              <s-paragraph tone="critical" id="agreement-terms">
                {errors.terms}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>

        <s-section>
          <s-stack gap="small-200">
            <s-stack direction="inline" gap="small-400" alignItems="center">
              <s-heading>Applies to</s-heading>
              {pickCompany && (
                <>
                  <span style={{ display: 'inline-flex', cursor: 'help' }}>
                    <s-icon type="info" color="subdued" interestFor={scopeTipId} />
                  </span>
                  <s-tooltip id={scopeTipId}>
                    <s-paragraph fontSize="small">
                      A location can be in one contract at a time: this one can’t overlap the Active or Scheduled contracts at its locations.
                    </s-paragraph>
                  </s-tooltip>
                </>
              )}
            </s-stack>
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
            {/* Here and in the company modal, while the company auto-adds locations. */}
            {laterShown && (
              <s-checkbox
                label="Automatically apply this contract to locations added later"
                checked={addsLaterLocations(draft)}
                onChange={(e) => patch({ applyLater: e.currentTarget.checked })}
              />
            )}
            {(shown('company') || shown('scope')) && (
              <s-paragraph tone="critical" id="agreement-scope">
                {shown('company') || shown('scope')}
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
          <s-paragraph color="subdued" fontSize="small">
            {live
              ? `Saving gives ${company?.name} your changes ${when}, as version ${nextVersion}.`
              : `Nothing is applied yet. ${getsTerms}`}
          </s-paragraph>
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
        // The same checkbox as under Applies to.
        applyLater={addsLaterLocations(draft)}
        onApplyLaterChange={laterShown ? (on) => patch({ applyLater: on }) : undefined}
        laterLabel="Automatically apply this contract to locations added later"
        laterDetails=""
      />

      {overlapBox && (
        <Modal onClose={() => setOverlapBox(false)} heading={overlapsHeading(overlapsNow.length)}>
          <s-stack gap="small">
            <s-paragraph>{`These overlap with ${draft.number}:`}</s-paragraph>
            <s-unordered-list>
              {overlapList.map((line) => (
                <s-list-item key={line}>{line}</s-list-item>
              ))}
            </s-unordered-list>
            <s-paragraph>If you save, the contract that starts later runs where they overlap, and the other one ends or gives up those locations.</s-paragraph>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setOverlapBox(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            }}
          >
            Save
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setOverlapBox(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(false)} heading={live ? `Save ${draft.number} as version ${nextVersion}?` : `Activate ${draft.number}?`}>
          {onlyLater ? (
            <s-paragraph>
              {addsLaterLocations(draft)
                ? `From now on, locations added to ${company?.name} join ${draft.number} automatically.`
                : `From now on, locations added to ${company?.name} won’t join ${draft.number} automatically. Locations already in it stay.`}
            </s-paragraph>
          ) : (
            <s-stack gap="small">
              <s-paragraph>
                {live ? `${agreementChanges(saved, draft, state.db)}. ${getsTerms}` : getsTerms}
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
            </s-stack>
          )}
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setConfirm(false);
              dispatch({ type: 'SAVE_AGREEMENT', activate: true });
            }}
          >
            {onlyLater ? 'Save' : live ? 'Save and apply' : 'Activate'}
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
  // Resolved with this contract in force, so its pricing comes first, on its dates.
  const entries = withContractPricing(
    contractPricingAfter(state.db, change, draft),
    () =>
      products.map((p) => {
        const d = resolveDetail(company, p, state.db.policies, undefined, location);
        return { product: p, shopify: p.list, final: d.price, decidedBy: d.decidedBy, priority: d.policy ? d.policy.priority ?? 0 : null };
      }),
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
