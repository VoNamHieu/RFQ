import React, { useMemo, useState } from 'react';
import { useStore } from '../store.jsx';
import { kindOf, scopeLabel, baseInScope, policyPriceBreakdown, resolveDetail, withContractPricing, basePricingProductsLabel, basePricingCalculationLabel } from '../pricing.js';
import { limitSummary, contractLimitConflicts, isD2CLimit } from '../limits.js';
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
  withStagedTerms,
  proposalState,
  statusLabel,
  declineOf,
  cancelRequestOf,
  canDeleteAgreement,
} from '../agreements.js';
import { TODAY } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';
import { TermGroup, VersionTimeline, EndContractModal, DeleteContractModal } from './ContractParts.jsx';
import { ContractVersionModal } from './ContractVersionModal.jsx';
import { MenuButton, Modal, PageHeader, Tip, useWcId } from '../../shared/wc.jsx';
import { TIMEZONES, storeTimezone } from '../timezones.js';
import { latestBuyerResponse } from '../buyerEvents.js';

// Create / edit a company's agreement — an in-frame page in the Agreements view
// (OPEN_AGREEMENT_EDITOR). Its pricing and limits are its own: created here, or copied
// from the Pricing and Order limits lists (Copy existing). Each opens in the pricing
// or limit editor on top; what's saved there is staged here (`staged`) and goes in
// with the contract — saving a live one applies it as a new version, and Cancel drops
// it. Who gets them is all of the company's locations or some, picked like a
// pricing's or order limit's companies (one company per contract). Saving a new one
// puts it in force (Active, or Scheduled until its start date); a live one saves as
// its next version, applied at once.
// A location is in one contract at a time: saving one, or a version of it, over the
// Active or Scheduled ones at its locations (clashesAt) first says what happens to
// them in the Overlaps box — those locations are this one's from its start date
// (handOver). Created from Contracts, the company is picked here too (`pickCompany`);
// otherwise only its locations are.
export function AgreementEditor() {
  const { state, dispatch } = useStore();
  const draft = state.agreementEditor.draft;
  // The pricing and limits as edited here, not saved yet.
  const db = useMemo(() => withStagedTerms(state.db, state.agreementEditor.staged), [state.db, state.agreementEditor.staged]);
  const pickCompany = !!state.agreementEditor.pickCompany;
  const company = state.db.companies.find((c) => c.id === draft.companyId);
  // The name used in the help text before a company is picked.
  const who = company?.name || 'the company';
  const saved = (state.db.agreements || []).find((a) => a.id === draft.id);
  // The buyer's answer to this version (Approve / Request changes on their Upcoming contract card).
  const buyerResponse = latestBuyerResponse(saved);
  // Who answered and when: "Vo Hieu · Nov 9, 2026".
  const answeredBy = buyerResponse ? [buyerResponse.buyer || buyerResponse.email, fmtDay(buyerResponse.at)].filter(Boolean).join(' · ') : '';
  // The buyer's note (sent with Request changes or Request cancellation), opened from
  // its own section. Their latest request for changes can be declined (Decline
  // request in the header, with a reply they see): the contract then waits for them
  // again.
  const [noteOpen, setNoteOpen] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [reply, setReply] = useState('');
  const declined = declineOf(saved);
  // Its buyers asked to cancel it: one they must approve can be deleted only then.
  const cancelRequest = cancelRequestOf(saved);
  // Live = saved (Scheduled or Active); started = Active, so its start date is fixed.
  const live = isLive(saved);
  const started = saved?.status === 'Active';
  const startsLater = liveStatus(draft) === 'Scheduled';
  // Buyer must approve this contract (ticked here, before it starts): a new one goes
  // to the company's buyers first (Send to buyer, Proposed), and so does a Scheduled
  // one saved with it ticked. A Proposed one goes again when changed, and is activated
  // once they approved its version. Saved ticked, it can't be unticked (`approvalLocked`).
  const approval = !!draft.approval;
  const approvalLocked = !!saved?.approval;
  const approvalChanged = !!saved && !!saved.approval !== approval;
  const proposed = saved?.status === 'Proposed';
  const proposal = proposalState(saved); // 'waiting' | 'approved' | 'changes' | null
  const [sending, setSending] = useState(false);
  // How the company's pricing and limits change when it goes live: a started one's
  // live version comes off and the new one goes on; otherwise it takes effect.
  const change = started ? { off: saved, on: draft } : { start: draft };
  const [tried, setTried] = useState(false);
  const [confirm, setConfirm] = useState(false);
  // Save / Save as version over Active or Scheduled contracts at its locations.
  const [overlapBox, setOverlapBox] = useState(false);
  const [companyModal, setCompanyModal] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  // Copy existing: the terms' key (base, quantity or limits) being copied into it.
  const [copying, setCopying] = useState(null);
  // A version from its history, read as it was.
  const [viewing, setViewing] = useState(null);
  // End contract (a live one) or Delete contract (a Scheduled one), from the header,
  // as on the company's Contract tab. Ended, the editor closes.
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
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

  // Its pricing and limits: each opens in its editor on top (Edit), or comes out
  // (Remove). Add creates a new one there, or copies existing ones from the Pricing and
  // Order limits lists — B2B ones, not another contract's.
  const editPricing = (p) => dispatch({ type: 'OPEN_EDITOR', policy: p, context: { mode: 'edit', contractTerm: true } });
  const editLimit = (l) => dispatch({ type: 'OPEN_LIMIT_EDITOR', limit: l, returnTo: { view: 'agreements' }, contractTerm: true });
  const createPricing = (kind) => dispatch({ type: 'OPEN_EDITOR', policy: null, kind, context: { mode: `add-${kind}`, contractTerm: true } });
  const createLimit = () => dispatch({ type: 'NAVIGATE', view: 'limits', patch: { limitChooser: { returnTo: { view: 'agreements' } } } });
  const remove = (key, id) => setTerms({ [key]: draft.terms[key].filter((x) => x !== id) });
  // Copy existing offers the regular ones (B2B) first, then other contracts' own ones —
  // running or over, each badged "In other contract".
  const ownerOf = (x) => (isContractTerm(x) ? (state.db.agreements || []).find((a) => a.id === x.contractId) || null : null);
  const copyable = (x) => !isContractTerm(x) || (!!ownerOf(x) && ownerOf(x).id !== draft.id);
  const regularFirst = (a, b) => Number(!!ownerOf(a)) - Number(!!ownerOf(b)) || String(ownerOf(a)?.number || '').localeCompare(String(ownerOf(b)?.number || ''));
  const library = {
    base: db.policies.filter((p) => copyable(p) && p.audienceType !== 'd2c' && kindOf(p) === 'base').sort(regularFirst),
    quantity: db.policies.filter((p) => copyable(p) && p.audienceType !== 'd2c' && kindOf(p) === 'quantity').sort(regularFirst),
    limits: (db.limits || []).filter((l) => copyable(l) && !isD2CLimit(l)).sort(regularFirst),
  };
  const contractBadge = (x) => (ownerOf(x) ? 'In other contract' : null);
  // The limits picked for it that contradict each other (a warning: it still saves).
  // Worked out again only when the limits change.
  const limitConflicts = useMemo(
    () => contractLimitConflicts(db, pickedOf(draft.terms.limits, db.limits)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [db.limits, db.products, draft.terms.limits],
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

  // Saving changes what the company gets (a new one goes in force: Active, or Scheduled
  // until its start date) — once everything it needs is there (name, company, a pricing
  // or order limit, locations, a start date not before today), confirm first: in the
  // Overlaps box when it overlaps other contracts.
  const goLive = () => (!valid ? setTried(true) : overlapsNow.length ? setOverlapBox(true) : setConfirm(true));
  const nextVersion = (saved?.version || 0) + 1;
  // Saving a live contract unchanged would only add an empty version.
  const unchanged = live && !approvalChanged && sameAgreement(saved, draft, db, state.db);
  const proposalUnchanged = proposed && sameAgreement(saved, draft, db, state.db);
  const sends = approval && (!saved || proposed || saved.status === 'Scheduled');
  const canActivate = proposalUnchanged && (proposal === 'approved' || !approval);
  const goSend = () => (!valid ? setTried(true) : setSending(true));
  // Only "Automatically apply this contract to locations added later" changed: the
  // confirm says just what that does (nothing is applied now).
  const onlyLater =
    live && addsLaterLocations(saved) !== addsLaterLocations(draft) && sameAgreement(saved, { ...draft, applyLater: addsLaterLocations(saved) }, db, state.db);
  // Terms that won't apply for the whole contract: turned off.
  const warnings = confirm ? termWarnings(db, draft) : [];
  const when = startsLater ? `on ${fmtDay(draft.startDate)}` : 'right away';
  // The Save / Save as version box: "ABC gets these terms right away, until Oct 31, 2026."
  const getsTerms = `${company?.name || 'The company'} gets these terms ${when}${draft.endDate ? `, until ${fmtDay(draft.endDate)}` : ''}.`;
  // Overview: the contract at a glance, from the draft, so unsaved edits count.
  const count = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;
  const covered = contractProducts(db, draft);
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
      primaryAction={
        canActivate
          ? { content: 'Activate', onAction: goLive }
          : sends
            ? { content: 'Send to buyer', onAction: goSend, disabled: proposed ? proposalUnchanged && !approvalChanged : unchanged }
            : { content: proposed ? 'Activate' : live ? `Save as version ${nextVersion}` : 'Save', onAction: goLive, disabled: unchanged }
      }
      secondaryActions={[
        live && { content: 'End contract', destructive: true, onAction: () => setEnding(true) },
        // Where Delete contract is: Decline request while the buyer's request for
        // changes waits; Delete contract only when it can be (canDeleteAgreement).
        proposal === 'changes' && { content: 'Decline request', destructive: true, onAction: () => setDeclining(true) },
        canDeleteAgreement(saved) && { content: 'Delete contract', destructive: true, onAction: () => setDeleting(true) },
        { content: 'Cancel', onAction: close },
      ]}
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

        {/* Laid out like the company's Contract tab, with Add, Edit and Remove. */}
        <s-section>
          <s-stack gap="small">
            {/* That they're the contract's own, on hover of the info icon. */}
            <s-stack direction="inline" gap="small-300" alignItems="center">
              <s-heading>Terms</s-heading>
              <Tip content="Pricing and order limits here are used only in this contract. They don’t show in Pricing or Order limits with your regular pricing and limits.">
                <s-icon type="info" color="subdued" />
              </Tip>
            </s-stack>
            <TermGroup
              icon="receipt-dollar"
              title="Base pricing"
              action={<AddTerm onCreate={() => createPricing('base')} onCopy={() => setCopying('base')} />}
              rows={pickedOf(draft.terms.base, db.policies).map((p) => ({
                key: p.id,
                name: p.name,
                // What it prices and how, as the pricing editor's summary (Products ·
                // Calculation): "Vendor: Manchester City FC · 20% off Shopify price".
                detail: `${basePricingProductsLabel(p, db.products || [])} · ${basePricingCalculationLabel(p, db.products || [])}`,
                side: `Priority ${p.priority ?? 0}`,
                onOpen: () => editPricing(p),
                actions: <TermActions name={p.name} onEdit={() => editPricing(p)} onRemove={() => remove('base', p.id)} />,
              }))}
            />
            <TermGroup
              icon="discount"
              title="Quantity pricing"
              action={<AddTerm onCreate={() => createPricing('quantity')} onCopy={() => setCopying('quantity')} />}
              rows={pickedOf(draft.terms.quantity, db.policies).map((p) => ({
                key: p.id,
                name: p.name,
                detail: scopeLabel(p),
                onOpen: () => editPricing(p),
                actions: <TermActions name={p.name} onEdit={() => editPricing(p)} onRemove={() => remove('quantity', p.id)} />,
              }))}
            />
            <TermGroup
              icon="order"
              title="Order limits"
              action={<AddTerm onCreate={createLimit} onCopy={() => setCopying('limits')} />}
              rows={pickedOf(draft.terms.limits, db.limits).map((l) => ({
                key: l.id,
                name: l.name,
                detail: limitSummary(l, db),
                onOpen: () => editLimit(l),
                actions: <TermActions name={l.name} onEdit={() => editLimit(l)} onRemove={() => remove('limits', l.id)} />,
              }))}
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
            {shown('terms') && (
              <s-paragraph tone="critical" id="agreement-terms">
                {errors.terms}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>

        {/* Before it starts: whether it goes to the company's buyers to approve first. */}
        {!started ? (
          <s-section heading="Buyer approval">
            <s-checkbox
              label="Buyer must approve this contract"
              details={
                approvalLocked
                  ? 'Saved with buyer approval, so it can’t be turned off. Each version goes to the company’s buyers and is activated once they approve it.'
                  : 'It goes to the company’s buyers in their B2B Portal first and is activated once they approve it.'
              }
              checked={approval}
              disabled={approvalLocked}
              onChange={(e) => patch({ approval: e.currentTarget.checked })}
            />
          </s-section>
        ) : null}

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
                      A location can be in one contract at a time. Where dates overlap, the contract that starts later takes over.
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
          {live || proposed ? (
            <div>
              <s-badge tone={started ? 'success' : proposal === 'changes' || cancelRequest ? 'warning' : proposed ? 'attention' : 'info'}>{`${statusLabel(saved)} · version ${saved.version}`}</s-badge>
            </div>
          ) : null}
          {/* A request for changes is its status, above, and in Buyer note, below. */}
          {buyerResponse?.kind === 'approve' ? (
            <s-stack gap="small-300">
              <div>
                <s-badge tone={buyerResponse.kind === 'approve' ? 'success' : 'warning'}>
                  {buyerResponse.kind === 'approve' ? 'Buyer approved' : 'Buyer requested changes'}
                </s-badge>
              </div>
              {buyerResponse.message ? null : (
                <s-paragraph color="subdued" fontSize="small">
                  {answeredBy}
                </s-paragraph>
              )}
            </s-stack>
          ) : null}
          <s-paragraph color="subdued" fontSize="small">
            {cancelRequest && (proposed ? proposalUnchanged : unchanged)
              ? `${who}’s buyers asked to cancel it. You can delete it, or change it and send it again as version ${nextVersion}.`
              : proposed
              ? !proposalUnchanged
                ? `Sending gives ${who}’s buyers your changes as version ${nextVersion} to approve.`
                : canActivate
                  ? `Activating gives ${who} these terms ${when}${proposal === 'approved' ? '' : '. Its buyers haven’t approved it'}.`
                  : proposal === 'changes'
                    ? `Change it and send it again as version ${nextVersion}. Nothing applies until they approve it.`
                    : `Waiting for ${who}’s buyers to approve it. It’s activated once they do. It expires if they don’t approve it by ${fmtDay(saved.startDate)}.`
              : sends
                ? saved
                  ? `Sending gives ${who}’s buyers your changes as version ${nextVersion} to approve. It won’t start until they approve it.`
                  : `Nothing is applied yet. ${who}’s buyers approve it first in their B2B Portal, and it’s activated once they do.`
                : live
                  ? `Saving gives ${company?.name} your changes ${when}, as version ${nextVersion}.`
                  : `Nothing is applied yet. Saving gives ${who} these terms${draft.startDate ? ` from ${fmtDay(draft.startDate)}` : ''}.`}
          </s-paragraph>
        </s-stack>
      </s-section>
      {/* What the buyer wrote with Request changes or Request cancellation: who and
          when, and the note itself in a modal (View note). */}
      {buyerResponse?.message ? (
        <s-section slot="aside" heading="Buyer note">
          <s-stack gap="small-300">
            <s-link onClick={() => setNoteOpen(true)}>View note</s-link>
            <s-paragraph color="subdued" fontSize="small">
              {answeredBy}
            </s-paragraph>
            {declined ? (
              <s-paragraph color="subdued" fontSize="small">
                {`You declined it · ${fmtDay(declined.at)}`}
              </s-paragraph>
            ) : null}
          </s-stack>
        </s-section>
      ) : null}
      {noteOpen && buyerResponse?.message ? (
        <Modal onClose={() => setNoteOpen(false)} heading="Buyer note">
          <s-stack gap="small">
            <s-paragraph>{buyerResponse.message}</s-paragraph>
            <s-paragraph color="subdued">{answeredBy}</s-paragraph>
            {declined ? (
              <>
                <s-divider />
                <s-paragraph>{`Your reply: ${declined.message}`}</s-paragraph>
                <s-paragraph color="subdued">{`Declined · ${fmtDay(declined.at)}`}</s-paragraph>
              </>
            ) : null}
          </s-stack>
          {proposal === 'changes' ? (
            <s-button
              slot="secondary-actions"
              tone="critical"
              onClick={() => {
                setNoteOpen(false);
                setDeclining(true);
              }}
            >
              Decline request
            </s-button>
          ) : null}
          <s-button slot="secondary-actions" onClick={() => setNoteOpen(false)}>
            Close
          </s-button>
        </Modal>
      ) : null}
      {/* Decline request: a reply is required; the contract stays as it is and waits. */}
      {declining && saved ? (
        <Modal onClose={() => setDeclining(false)} heading="Decline the buyer’s request?">
          <s-stack gap="small">
            <s-paragraph>{`${saved.number} stays as it is (version ${saved.version}). ${who}’s buyers can approve it or ask for changes again.`}</s-paragraph>
            <s-text-area
              label="Reply to the buyer"
              details="They see it in their B2B Portal."
              rows={3}
              value={reply}
              onInput={(e) => setReply(e.currentTarget.value)}
            />
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            disabled={!reply.trim()}
            onClick={() => {
              dispatch({ type: 'DECLINE_CHANGES', id: saved.id, message: reply });
              setDeclining(false);
              setReply('');
            }}
          >
            Decline request
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeclining(false)}>
            Cancel
          </s-button>
        </Modal>
      ) : null}
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
      {/* A saved one's version history, like on the company's Contract tab. */}
      {saved?.history?.length ? (
        <s-section slot="aside">
          <VersionTimeline history={saved.history} onView={setViewing} />
        </s-section>
      ) : null}
      {viewing != null && saved && <ContractVersionModal ag={saved} version={viewing} onClose={() => setViewing(null)} />}
      {ending && saved && <EndContractModal ag={saved} onClose={() => setEnding(false)} onDone={close} />}
      {deleting && saved && <DeleteContractModal ag={saved} onClose={() => setDeleting(false)} />}
      {previewOpen && company && (
        <ContractPricePreview db={db} draft={draft} change={change} products={covered} onClose={() => setPreviewOpen(false)} />
      )}
      {copying && (
        <CopyTermsModal
          key={copying}
          kind={copying}
          candidates={library[copying]}
          optionLabel={copying === 'limits' ? (l) => `${l.name} · ${limitSummary(l, db)}` : copying === 'base' ? (p) => `${p.name} · Priority ${p.priority ?? 0}` : (p) => `${p.name} · ${scopeLabel(p)}`}
          optionBadge={contractBadge}
          onCopy={(ids) => {
            setCopying(null);
            dispatch({ type: 'COPY_INTO_AGREEMENT', key: copying, ids });
          }}
          onClose={() => setCopying(null)}
        />
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
            <s-paragraph>{`If you ${proposed ? 'activate it' : 'save'}, the contract that starts later runs where they overlap, and the other one ends or gives up those locations.`}</s-paragraph>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setOverlapBox(false);
              dispatch({ type: 'SAVE_AGREEMENT', sameVersion: proposalUnchanged });
            }}
          >
            {proposed ? 'Activate' : 'Save'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setOverlapBox(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {confirm && (
        <Modal onClose={() => setConfirm(false)} heading={live ? `Save ${draft.number} as version ${nextVersion}?` : proposed ? `Activate ${draft.number}?` : `Save ${draft.number}?`}>
          {onlyLater ? (
            <s-paragraph>
              {addsLaterLocations(draft)
                ? `From now on, locations added to ${company?.name} join ${draft.number} automatically.`
                : `From now on, locations added to ${company?.name} won’t join ${draft.number} automatically. Locations already in it stay.`}
            </s-paragraph>
          ) : (
            <s-stack gap="small">
              {/* Save as version: what changed on its own line first. */}
              {live ? <s-paragraph>{`${agreementChanges(saved, draft, db, state.db)}.`}</s-paragraph> : null}
              <s-paragraph>{getsTerms}</s-paragraph>
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
              dispatch({ type: 'SAVE_AGREEMENT', sameVersion: proposalUnchanged });
            }}
          >
            {onlyLater ? 'Save' : proposed ? 'Activate' : 'Save and apply'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {/* Send to buyer: it goes to their B2B Portal to approve; nothing applies yet. */}
      {sending && (
        <Modal onClose={() => setSending(false)} heading={saved ? `Send version ${nextVersion} to the buyer?` : `Send ${draft.number} to the buyer?`}>
          <s-stack gap="small">
            {saved ? <s-paragraph>{`${agreementChanges(saved, draft, db, state.db)}.`}</s-paragraph> : null}
            <s-paragraph>{`${who}’s buyers see it in their B2B Portal and can approve it or request changes. It’s activated once they approve it: Scheduled if it starts later, Active if it starts today.`}</s-paragraph>
            {saved?.status === 'Scheduled' ? <s-paragraph>{`It won’t start on ${fmtDay(saved.startDate)} until then.`}</s-paragraph> : null}
            <s-paragraph>{`If they don’t approve it by ${fmtDay(draft.startDate)}, it expires.`}</s-paragraph>
            {overlapList.length ? (
              <>
                <s-paragraph>When they approve it, it overlaps:</s-paragraph>
                <s-unordered-list>
                  {overlapList.map((line) => (
                    <s-list-item key={line}>{line}</s-list-item>
                  ))}
                </s-unordered-list>
              </>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setSending(false);
              dispatch({ type: 'SEND_PROPOSAL' });
            }}
          >
            Send to buyer
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setSending(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-page>
    </>
  );
}

const pickedOf = (ids, list) => ids.map((id) => (list || []).find((x) => x.id === id)).filter(Boolean);

// A term group's Add: Create new, or Copy existing.
function AddTerm({ onCreate, onCopy }) {
  return (
    <MenuButton
      icon="plus"
      variant="tertiary"
      items={[
        { content: 'Create new', onAction: onCreate },
        { content: 'Copy existing', onAction: onCopy },
      ]}
    >
      Add
    </MenuButton>
  );
}

// A term's Edit and Remove.
function TermActions({ name, onEdit, onRemove }) {
  return (
    <s-stack direction="inline" gap="small-400" alignItems="center">
      <s-button icon="edit" variant="tertiary" accessibilityLabel={`Edit ${name}`} onClick={onEdit} />
      <s-button icon="x-circle" variant="tertiary" tone="critical" accessibilityLabel={`Remove ${name}`} onClick={onRemove} />
    </s-stack>
  );
}

// Copy existing: pick pricing or limits from the Pricing or Order limits list, or from
// other contracts (badged "In other contract"); the contract gets its own copy of each.
const COPY_NOUN = { base: 'base pricing', quantity: 'quantity pricing', limits: 'order limits' };
function CopyTermsModal({ kind, candidates, optionLabel, optionBadge, onCopy, onClose }) {
  const [ids, setIds] = useState([]);
  const noun = COPY_NOUN[kind];
  return (
    <Modal onClose={onClose} heading={`Copy existing ${noun}`}>
      <s-stack gap="small">
        <s-paragraph>The contract gets its own copy. Changing it here doesn’t change the original.</s-paragraph>
        <PricingCombobox
          label={`Search ${noun}`}
          labelHidden
          placeholder={`Search ${noun}`}
          candidates={candidates}
          selectedIds={ids}
          onChange={setIds}
          optionLabel={optionLabel}
          optionBadge={optionBadge}
        />
      </s-stack>
      <s-button slot="primary-action" variant="primary" disabled={!ids.length} onClick={() => onCopy(ids)}>
        Copy to contract
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// The products the contract's pricing covers: a base pricing's product scope, a
// quantity pricing's.
function contractProducts(db, ag) {
  const pricing = [...ag.terms.base, ...ag.terms.quantity].map((id) => db.policies.find((p) => p.id === id)).filter(Boolean);
  const covers = (p, product) => (kindOf(p) === 'base' ? baseInScope(p, product) : policyPriceBreakdown(p, product)?.inScope);
  return db.products.filter((product) => pricing.some((p) => covers(p, product)));
}

// "Preview prices": what a buyer pays for each product in the contract once it
// applies (`change`: the version it saves over, or the contracts it takes
// locations over from, come off first), and which pricing decided it — from the
// draft and its pricing as edited, so unsaved edits count. The contract's pricing
// applies first (pricing.js);
// pricing outside it decides only the products it doesn't cover. One of the
// contract's locations at a time. Same modal as the company page's Preview prices
// (PricePreviewDialog).
function ContractPricePreview({ db, draft, change, products, onClose }) {
  const [locationId, setLocationId] = useState(null);
  const company = companyAfterAgreement(db, change, draft.companyId);
  const locations = (company?.locations || []).filter((l) => appliesAt(company, draft, l.id));
  const location = locations.find((l) => l.id === locationId) || locations[0] || null;
  // Resolved with this contract in force, so its pricing comes first, on its dates.
  const entries = withContractPricing(
    contractPricingAfter(db, change, draft),
    () =>
      products.map((p) => {
        const d = resolveDetail(company, p, db.policies, undefined, location);
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
