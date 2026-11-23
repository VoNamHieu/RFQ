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
  changeRequestBatch,
  cancelRequestOf,
  openRequestOf,
  liveChangeRequestOf,
  endRequestOf,
  endDeclinedOf,
  versionDeclinedOf,
  canEndAgreement,
  canDeleteAgreement,
  pendingVersionOf,
  nextVersionNumber,
  entryKey,
  editedOf,
  versionEntry,
  unapprovedState,
  approvedTakeovers,
  joinAnd,
  pendingNote,
  DEFAULT_START_TIME,
  DEFAULT_END_TIME,
} from '../agreements.js';
import { TODAY } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';
import { PricePreviewDialog } from './PricePreviewDialog.jsx';
import { SelectCompaniesModal, companyPicks } from './AssignmentCard.jsx';
import { TermGroup, VersionTimeline, EndContractModal, DeleteContractModal, ActivitiesLogModal } from './ContractParts.jsx';
import { activitiesOf } from '../portalContracts.js';
import { MenuButton, Modal, Tip, useWcId, SaveBar, leaveWithConfirmation } from '../../shared/wc.jsx';
import { CdPageHead, editorBackLabel } from './companyLayout.jsx';
import { TIMEZONES, storeTimezone } from '../timezones.js';
import { latestBuyerResponse } from '../buyerEvents.js';

// Main column + side column side by side once the page is wide enough (as the pricing editor's).
const MAIN_ASIDE = '@container (inline-size > 700px) 2fr 1fr, 1fr';

// Create / edit a company's agreement — an in-frame page in the Agreements view
// (OPEN_AGREEMENT_EDITOR). Its pricing and limits are its own: created here, or copied
// from the Pricing and Order limits lists (Copy existing). Each opens in the pricing
// or limit editor on top; what's saved there is staged here (`staged`) and goes in
// with the contract — saving a live one applies it as a new version, and going back drops
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
  const record = (state.db.agreements || []).find((a) => a.id === draft.id);
  // A Draft (saved here with the save bar, never activated or sent) is still a new one.
  const draftRecord = record?.status === 'Draft' ? record : null;
  const saved = draftRecord ? undefined : record;
  // An Active one saved with Buyer must approve: the new version waiting for its buyers
  // (sent from here; the editor opens on it), read as a proposal — the version in force
  // stays until they approve it.
  const waiting = pendingVersionOf(saved);
  // The buyer's answer to this version (Approve / Request changes on their Upcoming contract card)
  // — their open request to cancel it first, a new version waiting or not (it's on hold).
  // An open request before an approval (it answers none).
  const buyerResponse = cancelRequestOf(saved) || openRequestOf(waiting || saved) || latestBuyerResponse(waiting || saved);
  // Who answered and when: "Vo Hieu · Nov 9, 2026".
  const answeredBy = buyerResponse ? [buyerResponse.buyer || buyerResponse.email, fmtDay(buyerResponse.at)].filter(Boolean).join(' · ') : '';
  // The buyer's note (sent with Request changes or Request cancellation), opened from
  // its own section. Their latest request for changes can be declined (Decline
  // request in the header, with a reply they see): the contract then waits for them
  // again.
  const [noteOpen, setNoteOpen] = useState(false);
  // "Set end date", as in pricing: ticked while it has one, and its End date shows.
  // Deleting the date in the field doesn't clear it (Polaris puts it back on blur), so
  // unticking does. `wantsEnd`: ticked, its End date not picked yet.
  const [wantsEnd, setWantsEnd] = useState(false);
  const hasEnd = !!draft.endDate || wantsEnd;
  // Their message with a decline (of a new version, or of your request to end it),
  // opened from the Status (Buyer's message): the answer it came with.
  const [buyerMessage, setBuyerMessage] = useState(null);
  const [declining, setDeclining] = useState(false);
  const [reply, setReply] = useState('');
  const declined = declineOf(waiting || saved);
  // What the Buyer note shows: requests for changes sent one after another (all of them,
  // oldest first — they can send more while one waits), or their latest answer.
  const notes = buyerResponse?.kind === 'changes' ? changeRequestBatch(waiting || saved) : buyerResponse ? [buyerResponse] : [];
  const byLine = (r) => [r.buyer || r.email, fmtDay(r.at)].filter(Boolean).join(' · ');
  // Its buyers asked to cancel it (Proposed or Scheduled) and the request is open: the
  // only actions are Decline request (with a reply they see) and Cancel contract. To
  // change its terms, the merchant rejects the request first.
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
  const proposal = proposalState(waiting || saved); // 'waiting' | 'approved' | 'changes' | null
  // A Scheduled or Active one's buyers asked for changes to the version they approved
  // (Request changes on their Upcoming contract or Contract card): it stays — still
  // starts on its date, or stays in force; the merchant sends a new version or declines.
  const liveRequest = liveChangeRequestOf(saved);
  // A request for changes waiting for the merchant: Decline request is offered.
  const changesAsked = proposal === 'changes' || !!liveRequest;
  // Your request to end it (an Active one saved with Buyer must approve: End contract asks
  // its buyers), waiting for them — or their decline of the latest one.
  const endAsked = endRequestOf(saved);
  const endDeclined = !endAsked && isLive(saved) ? endDeclinedOf(saved) : null;
  // Their decline of the new version you sent (Decline in their B2B Portal): the version
  // they approved stays.
  const versionDeclined = versionDeclinedOf(saved);
  // One thing at a time: End contract waits while a new version, their request for
  // changes or your request to end it waits (disabled, the Status says why).
  const endWaits = live && !!saved?.approval && !cancelRequest && !canEndAgreement(saved);
  const [sending, setSending] = useState(false);
  // A version picked in its Version history while something here is edited and not sent
  // or saved: asked first, since going to it drops those changes.
  const [switching, setSwitching] = useState(null);
  const edited = !!state.agreementEditor.pristine && editedOf(state.agreementEditor) !== state.agreementEditor.pristine;
  const loadVersion = (h) => dispatch({ type: 'LOAD_AGREEMENT_VERSION', key: entryKey(h) });
  // Activities log (beside Version history): everything between the merchant and its
  // buyers on it, as their B2B Portal lists it — for the version waiting for them, when
  // there's one. Its link shows once there's something in it.
  const activities = saved ? activitiesOf(waiting || saved) : [];
  const [logOpen, setLogOpen] = useState(false);
  // Send to buyer in answer to their requests for changes: an optional message they
  // read with their requests in their B2B Portal (the seller's reply).
  const [sendNote, setSendNote] = useState('');
  const closeSending = () => {
    setSending(false);
    setSendNote('');
  };
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
  // End contract (a live one) or Delete contract (a Scheduled one), from the header,
  // as on the company's Contract tab. Ended, the editor closes.
  const [ending, setEnding] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Decline request / Cancel contract, while its buyers' request to cancel it is open.
  const [rejecting, setRejecting] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const scopeTipId = useWcId('scope-tip');
  const datesTipId = useWcId('dates-tip');
  const laterTipId = useWcId('later-tip');
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
  // "Set end date" ticked: it needs one — nothing saves without it, the save bar's Save too.
  const endMissing = hasEnd && !draft.endDate;
  if (endMissing) errors.endDate = 'Choose an end date';
  const valid = !Object.keys(errors).length;
  // Save on the save bar ('save'): a new one needs its company and name only (and its
  // End date, with "No end date" unticked).
  const shown = (k) => (tried === 'save' ? (k === 'company' || k === 'name' || k === 'endDate' ? errors[k] : undefined) : tried ? errors[k] : undefined);
  // Save (save bar): what's edited is kept, not applied or sent (SAVE_AGREEMENT_DRAFT).
  const saveDraft = () => ((!saved && (errors.company || errors.name)) || endMissing ? setTried('save') : dispatch({ type: 'SAVE_AGREEMENT_DRAFT' }));

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
  // Over a contract its buyers approved, it can't be saved or sent (approvedTakeovers):
  // ending or changing that one needs their approval. Said at the top, Save/Send off.
  const approvedTaken = company ? approvedTakeovers(state.db, draft, saved, started) : [];
  const takenLine = approvedTaken.length
    ? `${joinAnd(approvedTaken.map((h) => h.old.number))} ${approvedTaken.length === 1 ? 'was' : 'were'} approved by ${who}’s buyers. This contract would take over ${joinAnd(
        [...new Set(approvedTaken.flatMap((h) => h.shared.map((l) => l.name)))],
      )}, which needs their approval. Send them a new version of ${approvedTaken.length === 1 ? approvedTaken[0].old.number : 'those contracts'} first${
        // Only an Active one can be asked to end (End contract).
        approvedTaken.every((h) => h.old.status === 'Active') ? `, or ask them to end ${approvedTaken.length === 1 ? 'it' : 'them'}` : ''
      }.`
    : null;

  // Saving changes what the company gets (a new one goes in force: Active, or Scheduled
  // until its start date) — once everything it needs is there (name, company, a pricing
  // or order limit, locations, a start date not before today), confirm first: in the
  // Overlaps box when it overlaps other contracts.
  const goLive = () => (!valid ? setTried(true) : overlapsNow.length ? setOverlapBox(true) : setConfirm(true));
  // Not Scheduled or Active yet (Proposed): sending it again keeps its version.
  // Every version sent or saved has its own number (nextVersionNumber): after one its
  // buyers declined, the next is a new one.
  const nextVersion = waiting ? waiting.version : proposed ? saved.version : saved ? nextVersionNumber(saved) : 1;
  // Saving a live contract unchanged would only add an empty version.
  const unchanged = live && !approvalChanged && sameAgreement(saved, draft, db, state.db);
  const proposalUnchanged = proposed && sameAgreement(saved, draft, db, state.db);
  // The version waiting for its buyers, as sent.
  const waitingUnchanged = !!waiting && sameAgreement(waiting, draft, db, withStagedTerms(state.db, saved.pending.staged));
  // One thing at a time: while its buyers haven't answered it, it can't be changed and
  // sent again — Send to buyer waits for their answer.
  const waitingUnanswered = !!waiting && proposal === 'waiting';
  // Meanwhile it's locked: its fields, terms and locations read as they are (Preview
  // prices and Version history still open). So it is while your request to end it (or
  // to cancel it) waits for them: nothing can be sent until they answer or you withdraw it.
  // A proposal sent to its buyers is the same (one thing at a time): locked until they
  // answer — Request changes opens it again (sent again, it keeps its version).
  const proposalWaits = proposed && proposal === 'waiting';
  const locked = waitingUnanswered || !!endAsked || proposalWaits;
  // Who approved it last and when (Approve in their B2B Portal), for its Status once it's
  // Scheduled or Active and unchanged: "Approved by John Nguyen on Jul 28, 2026. "; ''
  // without a record of it.
  const approvedBy = [...(saved?.buyerResponses || [])].reverse().find((r) => r.kind === 'approve');
  const approvedLine = approvedBy ? `Approved by ${approvedBy.buyer || approvedBy.email || 'the buyer'} on ${fmtDay(approvedBy.at)}. ` : '';
  // An Active one saved with Buyer must approve goes to its buyers too, as its next version.
  const sends = approval && (!saved || proposed || saved.status === 'Scheduled' || (started && !!saved.approval));
  // Scheduled or Active, saved with Buyer must approve: the version they approved stays
  // (still starts on its date, or stays in force) while a new one waits for them.
  const keeps = live && !!saved.approval;
  const startsOn = saved ? fmtDay(saved.startDate) : '';
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
  // On a version other than the one in force (picked in its Version history, or the one
  // its buyers declined, which it opens on): the Overview says which, and which is in
  // force — "Showing version 2 (declined). Version 1 is in force."
  const loadedEntry = saved && state.agreementEditor.loaded ? (saved.history || []).find((h) => entryKey(h) === state.agreementEditor.loaded) || null : null;
  const shownState = loadedEntry ? unapprovedState(saved, loadedEntry) : null;
  const showingLine =
    loadedEntry && loadedEntry !== versionEntry(saved, saved.version)
      ? `Showing version ${loadedEntry.version}${shownState ? ` (${shownState.toLowerCase()})` : ''}. ${
          saved.status === 'Active' ? `Version ${saved.version} is in force.` : saved.status === 'Scheduled' ? `Version ${saved.version} starts ${fmtDay(saved.startDate)}.` : ''
        }`.trim()
      : null;
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

  // Your request to end it (or to cancel it) waiting for them: Withdraw is the only action.
  const withdrawing = endAsked ? { content: endAsked.cancel ? 'Withdraw cancel request' : 'Withdraw end request', onAction: () => dispatch({ type: 'WITHDRAW_END_REQUEST', id: saved.id }), disabled: edited } : null;
  // While something here is edited and not saved (the save bar), the actions wait: saved,
  // they go on from what was saved. A new one is saved first (Save, a Draft).
  const unsaved = edited || !record;
  const primary = cancelRequest
    ? { content: 'Decline request', onAction: () => setRejecting(true), disabled: edited }
    : withdrawing
    ? withdrawing
    : canActivate
    ? { content: 'Activate', onAction: goLive, disabled: !!takenLine || edited }
    : sends
      ? { content: 'Send to buyer', onAction: goSend, disabled: unsaved || !!takenLine || !!endAsked || proposalWaits || (proposed ? proposalUnchanged && !approvalChanged : waiting ? waitingUnchanged || waitingUnanswered : unchanged) }
      : { content: proposed || !live ? 'Activate' : `Save as version ${nextVersion}`, onAction: goLive, disabled: unsaved || !!takenLine || unchanged };
  // Its buyers' request to cancel it open: Cancel contract only, in place of End
  // contract (no End contract or Delete contract until it's rejected).
  const secondary = (
    cancelRequest
      ? [{ content: started ? 'End contract' : 'Cancel contract', destructive: true, disabled: edited, onAction: () => setCancelling(true) }]
      : withdrawing
      ? []
      : [
          // One that hasn't started: Cancel contract (one its buyers approved: it asks them to
          // cancel it). While their request for changes is open it can't be used: not shown then.
          (canEndAgreement(saved) || (endWaits && !liveRequest)) && {
            content: started ? 'End contract' : 'Cancel contract',
            destructive: true,
            disabled: endWaits || edited,
            onAction: () => setEnding(true),
          },
          // Decline request while the buyer's request for changes waits. Delete contract,
          // when it can be (canDeleteAgreement), is under More actions.
          changesAsked && { content: 'Decline request', destructive: true, disabled: edited, onAction: () => setDeclining(true) },
        ]
  ).filter(Boolean);

  // The company page's look, as the pricing editor's: back (named as the page it returns
  // to) with the actions on top, then the title and the company; the cards below are as
  // they were, the main column and the side column (Status, Buyer note, Overview,
  // versions) side by side.
  return (
    <div className="cd-page">
    {/* Edited and not saved: Save keeps it (not applied or sent), Discard goes back. Not
        while its pricing editor is open on top (that one's save bar shows). */}
    {edited && !state.builder ? <SaveBar onSave={saveDraft} onDiscard={() => dispatch({ type: 'AGREEMENT_EDITOR_DISCARD' })} /> : null}
    <CdPageHead
      title={record ? `${draft.number} · ${record.name}` : `New contract ${draft.number}`}
      subtitle={company?.name}
      // With unsaved changes, inside Shopify admin the admin asks first.
      back={{ label: editorBackLabel(state, state.agreementEditor.returnTo, 'Contracts'), onAction: () => leaveWithConfirmation(close) }}
      actionsOnTop
      actions={
        <>
          {/* As the company and location pages: More actions, with Delete contract. */}
          {(draftRecord || canDeleteAgreement(saved)) && !cancelRequest ? (
            <MenuButton disabled={edited} items={[{ content: 'Delete contract', destructive: true, onAction: () => setDeleting(true) }]}>More actions</MenuButton>
          ) : null}
          {secondary.map((a) => (
            <s-button key={a.content} tone={a.destructive ? 'critical' : undefined} disabled={a.disabled} onClick={a.onAction}>
              {a.content}
            </s-button>
          ))}
          <s-button variant="primary" disabled={primary.disabled} onClick={primary.onAction}>
            {primary.content}
          </s-button>
        </>
      }
    />
    <s-query-container>
    <s-grid gridTemplateColumns={MAIN_ASIDE} gap="base" alignItems="start">
      <s-stack gap="base">
        {takenLine ? <s-banner tone="critical">{takenLine}</s-banner> : null}
        <s-section>
          <s-text-field
            label="Contract name"
            required
            value={draft.name}
            onInput={(e) => patch({ name: e.currentTarget.value })}
            disabled={locked}
            error={shown('name')}
            placeholder="e.g. 2027 distributor terms"
            details="Buyers see this name in their account."
            autocomplete="off"
          />
        </s-section>

        <s-section>
          <s-stack gap="small">
            {/* What the dates do, in the heading's ⓘ (as Applies to's). */}
            <s-stack direction="inline" gap="small-400" alignItems="center">
              <s-heading>Dates</s-heading>
              <span style={{ display: 'inline-flex', cursor: 'help' }}>
                <s-icon type="info" color="subdued" interestFor={datesTipId} />
              </span>
              <s-tooltip id={datesTipId}>
                <s-paragraph fontSize="small">
                  {`It starts and ends on its own. After the end date, ${who} goes back to the pricing and limits outside the contract.`}
                </s-paragraph>
              </s-tooltip>
            </s-stack>
            {/* Timezone: the store's until one is picked. */}
            <s-select label="Timezone" value={draft.timezone || storeTimezone(state.db)} disabled={locked} onChange={(e) => patch({ timezone: e.currentTarget.value })}>
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
                  disabled={started || locked}
                  onChange={(e) => patch({ startDate: e.currentTarget.value })}
                  error={shown('startDate')}
                  details={started ? 'It has started, so this can’t change.' : undefined}
                />
                {/* Times as in pricing's Active dates. */}
                <s-text-field
                  label="Start time"
                  value={draft.startTime || DEFAULT_START_TIME}
                  disabled={started || locked}
                  onInput={(e) => patch({ startTime: e.currentTarget.value })}
                  autocomplete="off"
                />
              </s-grid>
            </s-query-container>
            {/* As in pricing's Active dates: the End date shows while this is ticked. */}
            <s-checkbox
              label="Set end date"
              checked={hasEnd}
              disabled={locked}
              onChange={(e) => {
                const on = e.currentTarget.checked;
                setWantsEnd(on);
                if (!on) patch({ endDate: '', endTime: undefined });
              }}
            />
            {hasEnd && (
              <s-query-container>
                <s-grid gridTemplateColumns="@container (inline-size > 400px) 1fr 1fr, 1fr" gap="small">
                  <s-date-field
                    label="End date"
                    value={draft.endDate || ''}
                    disabled={locked}
                    onChange={(e) => patch({ endDate: e.currentTarget.value })}
                    // "Choose an end date" once a save is tried; a wrong date right away.
                    error={endMissing ? shown('endDate') : errors.endDate}
                  />
                  <s-text-field
                    label="End time"
                    value={draft.endTime || DEFAULT_END_TIME}
                    disabled={locked}
                    onInput={(e) => patch({ endTime: e.currentTarget.value })}
                    autocomplete="off"
                  />
                </s-grid>
              </s-query-container>
            )}
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
              action={locked ? null : <AddTerm onCreate={() => createPricing('base')} onCopy={() => setCopying('base')} />}
              rows={pickedOf(draft.terms.base, db.policies).map((p) => ({
                key: p.id,
                name: p.name,
                // What it prices and how, as the pricing editor's summary (Products ·
                // Calculation): "Vendor: Manchester City FC · 20% off Shopify price".
                detail: `${basePricingProductsLabel(p, db.products || [])} · ${basePricingCalculationLabel(p, db.products || [])}`,
                side: `Priority ${p.priority ?? 0}`,
                onOpen: locked ? undefined : () => editPricing(p),
                actions: locked ? null : <TermActions name={p.name} onEdit={() => editPricing(p)} onRemove={() => remove('base', p.id)} />,
              }))}
            />
            <TermGroup
              icon="discount"
              title="Quantity pricing"
              action={locked ? null : <AddTerm onCreate={() => createPricing('quantity')} onCopy={() => setCopying('quantity')} />}
              rows={pickedOf(draft.terms.quantity, db.policies).map((p) => ({
                key: p.id,
                name: p.name,
                detail: scopeLabel(p),
                side: `Priority ${p.priority ?? 0}`,
                onOpen: locked ? undefined : () => editPricing(p),
                actions: locked ? null : <TermActions name={p.name} onEdit={() => editPricing(p)} onRemove={() => remove('quantity', p.id)} />,
              }))}
            />
            <TermGroup
              icon="order"
              title="Order limits"
              action={locked ? null : <AddTerm onCreate={createLimit} onCopy={() => setCopying('limits')} />}
              rows={pickedOf(draft.terms.limits, db.limits).map((l) => ({
                key: l.id,
                name: l.name,
                detail: limitSummary(l, db),
                onOpen: locked ? undefined : () => editLimit(l),
                actions: locked ? null : <TermActions name={l.name} onEdit={() => editLimit(l)} onRemove={() => remove('limits', l.id)} />,
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
              disabled={locked}
              onClick={() => !locked && setCompanyModal(true)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !locked) setCompanyModal(true);
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
            {/* How new locations move between contracts, in its ⓘ. */}
            {laterShown && (
              <s-stack direction="inline" gap="small-300" alignItems="center">
                <s-checkbox
                  label="Automatically apply this contract to locations added later"
                  checked={addsLaterLocations(draft)}
                  disabled={locked}
                  onChange={(e) => patch({ applyLater: e.currentTarget.checked })}
                />
                <span style={{ display: 'inline-flex', cursor: 'help' }}>
                  <s-icon type="info" color="subdued" interestFor={laterTipId} />
                </span>
                <s-tooltip id={laterTipId}>
                  <s-paragraph fontSize="small">
                    When multiple contracts apply to locations added later, a new location moves to each new contract as soon as it starts, even if the previous one is still active.
                  </s-paragraph>
                </s-tooltip>
              </s-stack>
            )}
            {(shown('company') || shown('scope')) && (
              <s-paragraph tone="critical" id="agreement-scope">
                {shown('company') || shown('scope')}
              </s-paragraph>
            )}
          </s-stack>
        </s-section>
      </s-stack>

      <s-stack gap="base">
      <s-section heading="Status">
        <s-stack gap="small-200">
          {live || proposed ? (
            <div>
              <s-stack direction="inline" gap="small-200">
                <s-badge tone={started ? 'success' : proposed ? 'attention' : 'info'}>{statusLabel(saved)}</s-badge>
                {/* A request waiting beside its status, which stays (pendingNote) — as in
                    the Contracts list and their B2B Portal. */}
                {pendingNote(saved) ? <s-badge>{pendingNote(saved)}</s-badge> : null}
              </s-stack>
            </div>
          ) : null}
          {/* Its status stays whatever its buyers asked; the request is beside it (and in
              the sentence's ⓘ). Each is in Buyer note, below; an approval is in the
              sentence ("Approved by … on …"). What to do next, and what changes for the
              buyers, stay in the sentence; the rest (what stays the same, where things
              show, what's locked) is in its ⓘ. */}
          <StatusLine
            parts={
              cancelRequest
                ? started
                  ? ['End the contract, or decline the request.', `It stays in force until you answer. ${who}’s buyers see your reply in their B2B Portal.`]
                  : [
                      // Not answered by its start date, one that hasn't started expires (syncContractDates).
                      `Cancel the contract, or decline the request.${saved.startDate ? ` It expires on ${fmtDay(saved.startDate)} if you don’t answer.` : ''}`,
                      `${who}’s buyers see your reply in their B2B Portal.`,
                    ]
                : proposed
                ? !proposalUnchanged
                  ? [`Sending gives ${who}’s buyers your changes to approve.`, `It stays version ${saved.version}; the changes go in its Activities log.`]
                  : canActivate
                    ? [`Activating gives ${who} these terms ${when}${proposal === 'approved' ? '' : '. Its buyers haven’t approved it'}.`]
                    : proposal === 'changes'
                      ? ['Change it and send it again. Nothing applies until they approve it.']
                      : [
                          `Waiting for ${who}’s buyers to approve it. It expires on ${fmtDay(saved.startDate)} if they don’t.`,
                          'It’s activated once they approve it. You can change it once they answer.',
                        ]
                : keeps && sends
                  ? waiting && (waitingUnchanged || waitingUnanswered)
                    ? proposal === 'changes'
                      ? [
                          'Change it and send it again, or decline the request.',
                          `${who}’s buyers asked for changes to version ${waiting.version}. ${
                            started ? `Version ${saved.version} stays in force.` : `Until they approve version ${waiting.version}, version ${saved.version} starts ${startsOn}.`
                          }`,
                        ]
                      : started
                        ? [`Version ${saved.version} stays in force until they approve version ${waiting.version}.`, 'You can change it once they answer.']
                        : [
                            `Version ${saved.version} starts ${startsOn}. Version ${waiting.version} applies once they approve it.`,
                            `If they haven’t approved it by then, version ${saved.version} starts as it is and version ${waiting.version} keeps waiting. You can change it once they answer.`,
                          ]
                    : !waiting && unchanged
                      ? liveRequest
                        ? [
                            'Change it and send it to them, or decline the request.',
                            `${who}’s buyers asked for changes to version ${saved.version}. ${started ? `Version ${saved.version} stays in force.` : `It still starts ${startsOn}.`}`,
                          ]
                        : started
                          ? [`${approvedLine}Version ${saved.version} is in force.`]
                          : [`${approvedLine}It starts ${startsOn}.`]
                      : started
                        ? [`Sending gives ${who}’s buyers your changes as version ${nextVersion} to approve.`, `Version ${saved.version} stays in force until they approve it.`]
                        : [`Sending gives ${who}’s buyers your changes as version ${nextVersion} to approve.`, `Until they approve it, version ${saved.version} starts ${startsOn}.`]
                  : sends
                    ? saved
                      ? unchanged
                        ? [`${approvedLine}It starts ${fmtDay(saved.startDate)}.`]
                        : [`Sending gives ${who}’s buyers your changes as version ${nextVersion} to approve. It won’t start until they approve it.`]
                      : [`Nothing is applied yet. It’s activated once ${who}’s buyers approve it.`, 'They approve it in their B2B Portal.']
                    : live
                      ? [`Saving gives ${company?.name} your changes ${when}, as version ${nextVersion}.`]
                      : [`Nothing is applied yet. Activating gives ${who} these terms${draft.startDate ? ` from ${fmtDay(draft.startDate)}` : ''}.`]
            }
          />
          {endAsked ? (
            <StatusLine
              parts={
                endAsked.cancel
                  ? [
                      `It still starts ${startsOn} unless they approve before then.`,
                      `You asked ${who}’s buyers to cancel it on ${fmtDay(endAsked.at)}. You can’t send changes until they answer or you withdraw it.`,
                    ]
                  : [
                      'It stays in force until they approve.',
                      `You asked ${who}’s buyers to end it on ${fmtDay(endAsked.at)}. You can’t send changes until they answer or you withdraw it.`,
                    ]
              }
            />
          ) : versionDeclined ? (
            <s-stack gap="small-300">
              <s-paragraph color="subdued" fontSize="small">
                {`${who}’s buyers declined version ${versionDeclined.version} on ${fmtDay(versionDeclined.at)}. Version ${saved.version} ${
                  started ? 'stays in force' : `still starts ${startsOn}`
                }.`}
              </s-paragraph>
              {/* Their message with it, in its own modal (Buyer's message). */}
              {versionDeclined.message ? (
                <div>
                  <s-link onClick={() => setBuyerMessage(versionDeclined)}>Buyer’s message</s-link>
                </div>
              ) : null}
            </s-stack>
          ) : endDeclined ? (
            <s-stack gap="small-300">
              <s-paragraph color="subdued" fontSize="small">
                {`${who}’s buyers declined ${endDeclined.req.cancel ? 'cancelling' : 'ending'} it on ${fmtDay(endDeclined.answer.at)}.`}
              </s-paragraph>
              {endDeclined.answer.message ? (
                <div>
                  <s-link onClick={() => setBuyerMessage(endDeclined.answer)}>Buyer’s message</s-link>
                </div>
              ) : null}
            </s-stack>
          ) : null}
        </s-stack>
      </s-section>
      {/* What the buyer wrote with Request changes or Request cancellation: who and
          when, and the note itself in a modal (View note). */}
      {buyerResponse?.message ? (
        <s-section heading="Buyer note">
          <s-stack gap="small-300">
            <s-link onClick={() => setNoteOpen(true)}>{notes.length > 1 ? `View notes (${notes.length})` : 'View note'}</s-link>
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
      <s-section heading="Overview">
        <s-stack gap="small">
          {showingLine ? <s-banner tone="info">{showingLine}</s-banner> : null}
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
        <s-section>
          {/* A version picked there: the editor goes on from it (LOAD_AGREEMENT_VERSION) —
              the one waiting for its buyers, one they declined, the one in force… */}
          <VersionTimeline
            history={saved.history}
            current={state.agreementEditor.loaded || saved.version}
            onView={(version, h) => (edited ? setSwitching(h) : loadVersion(h))}
            aside={activities.length ? <s-link onClick={() => setLogOpen(true)}>Activities log</s-link> : null}
          />
        </s-section>
      ) : null}
      </s-stack>
    </s-grid>
    </s-query-container>
      {buyerMessage ? (
        <Modal onClose={() => setBuyerMessage(null)} heading="Buyer’s message">
          <s-stack gap="small">
            <s-paragraph>{buyerMessage.message}</s-paragraph>
            <s-paragraph color="subdued">{byLine(buyerMessage)}</s-paragraph>
          </s-stack>
          <s-button slot="secondary-actions" onClick={() => setBuyerMessage(null)}>
            Close
          </s-button>
        </Modal>
      ) : null}
      {noteOpen && buyerResponse?.message ? (
        <Modal onClose={() => setNoteOpen(false)} heading={notes.length > 1 ? 'Buyer notes' : 'Buyer note'}>
          <s-stack gap="small">
            {notes.map((n, i) => (
              <React.Fragment key={i}>
                {i ? <s-divider /> : null}
                <s-paragraph>{n.message}</s-paragraph>
                <s-paragraph color="subdued">{byLine(n)}</s-paragraph>
              </React.Fragment>
            ))}
            {declined ? (
              <>
                <s-divider />
                <s-paragraph>{`Your reply: ${declined.message}`}</s-paragraph>
                <s-paragraph color="subdued">{`Declined · ${fmtDay(declined.at)}`}</s-paragraph>
              </>
            ) : null}
          </s-stack>
          {changesAsked ? (
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
            <s-paragraph>
              {waiting
                ? `Version ${waiting.version} stays as it is. ${who}’s buyers can approve it or ask for changes again.`
                : liveRequest
                  ? `${started ? `Version ${saved.version} stays in force.` : `Version ${saved.version} still starts ${startsOn}.`} ${who}’s buyers can ask for changes again.`
                  : `${saved.number} stays as it is (version ${saved.version}). ${who}’s buyers can approve it or ask for changes again.`}
            </s-paragraph>
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
      {logOpen && saved ? <ActivitiesLogModal number={saved.number} activities={activities} onClose={() => setLogOpen(false)} /> : null}
      {deleting && record && <DeleteContractModal ag={record} onClose={() => setDeleting(false)} />}
      {ending && saved && <EndContractModal ag={saved} onClose={() => setEnding(false)} onDone={close} />}
      {/* Decline request (to cancel it): a reply is required; it goes back to the status
          it had before the request, at the same version. */}
      {switching ? (
        <Modal onClose={() => setSwitching(null)} heading={`Open version ${switching.version}?`}>
          <s-paragraph>Changes you haven’t sent or saved will be lost.</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              loadVersion(switching);
              setSwitching(null);
            }}
          >
            {`Open version ${switching.version}`}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setSwitching(null)}>
            Cancel
          </s-button>
        </Modal>
      ) : null}
      {rejecting && saved ? (
        <Modal onClose={() => setRejecting(false)} heading="Decline the cancellation request?">
          <s-stack gap="small">
            <s-paragraph>
              {saved.status === 'Scheduled' || started
                ? `${saved.number} ${started ? 'stays in force' : `stays scheduled to start ${fmtDay(saved.startDate)}`}.${
                    waiting ? ` Version ${waiting.version} waits for ${who}’s buyers to approve it again.` : ''
                  }`
                : `${saved.number} stays as it is (version ${saved.version}), waiting for ${who}’s buyers to approve it.`}
            </s-paragraph>
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
              dispatch({ type: 'REJECT_CANCELLATION', id: saved.id, message: reply });
              setRejecting(false);
              setReply('');
            }}
          >
            Decline request
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setRejecting(false)}>
            Cancel
          </s-button>
        </Modal>
      ) : null}
      {/* Cancel contract: Cancelled right away; the editor closes. */}
      {cancelling && saved ? (
        <Modal onClose={() => setCancelling(false)} heading={`${started ? 'End' : 'Cancel'} ${saved.number}?`}>
          <s-paragraph>
            {`${who}’s buyers asked to cancel it. ${
              started ? 'It ends now, at their request: its pricing and order limits come off right away' : 'It’s cancelled now: none of its terms apply'
            }, and it leaves their B2B Portal. You can’t undo this.`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              setCancelling(false);
              dispatch({ type: 'CANCEL_AGREEMENT', id: saved.id });
            }}
          >
            {started ? 'End contract' : 'Cancel contract'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setCancelling(false)}>
            Keep contract
          </s-button>
        </Modal>
      ) : null}
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
            <s-paragraph>{`If you ${proposed || !live ? 'activate it' : 'save'}, the contract that starts later runs where they overlap, and the other one ends or gives up those locations.`}</s-paragraph>
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              setOverlapBox(false);
              dispatch({ type: 'SAVE_AGREEMENT', sameVersion: proposalUnchanged });
            }}
          >
            {proposed || !live ? 'Activate' : 'Save'}
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
            {onlyLater ? 'Save' : proposed || !live ? 'Activate' : 'Save and apply'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
      {/* Send to buyer: it goes to their B2B Portal to approve; nothing applies yet. */}
      {sending && (
        <Modal onClose={closeSending} heading={saved ? `Send version ${nextVersion} to the buyer?` : `Send ${draft.number} to the buyer?`}>
          <s-stack gap="small">
            {saved ? (
              <s-paragraph>{`${waiting ? agreementChanges(waiting, draft, db, withStagedTerms(state.db, saved.pending.staged)) : agreementChanges(saved, draft, db, state.db)}.`}</s-paragraph>
            ) : null}
            {started ? (
              <s-paragraph>{`${who}’s buyers see it in their B2B Portal and can approve or decline it. Version ${saved.version} stays in force until they approve it; then version ${nextVersion} applies right away.`}</s-paragraph>
            ) : keeps ? (
              <>
                <s-paragraph>{`${who}’s buyers see it in their B2B Portal and can approve or decline it. Version ${saved.version} stays scheduled until they approve it; then version ${nextVersion} takes its place${
                  draft.startDate !== saved.startDate ? `, starting ${fmtDay(draft.startDate)}` : ''
                }.`}</s-paragraph>
                <s-paragraph>{`If they haven’t approved it by ${startsOn}, version ${saved.version} starts as it is; version ${nextVersion} keeps waiting and applies once they approve it.`}</s-paragraph>
              </>
            ) : (
              <>
                <s-paragraph>{`${who}’s buyers see it in their B2B Portal and can approve it or request changes. It’s activated once they approve it: Scheduled if it starts later, Active if it starts today.`}</s-paragraph>
                {saved?.status === 'Scheduled' ? <s-paragraph>{`It won’t start on ${fmtDay(saved.startDate)} until then.`}</s-paragraph> : null}
                <s-paragraph>{`If they don’t approve it by ${fmtDay(draft.startDate)}, it expires.`}</s-paragraph>
              </>
            )}
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
            {/* Always (optional): with their request when it answers one, else with what's
                sent — their Seller's message in their B2B Portal. */}
            <s-text-area
              label="Message to the buyer"
              details={changesAsked ? 'Optional. They see it with their request in their B2B Portal.' : 'Optional. They see it with this version in their B2B Portal.'}
              rows={3}
              value={sendNote}
              onInput={(e) => setSendNote(e.currentTarget.value)}
            />
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            onClick={() => {
              dispatch({ type: 'SEND_PROPOSAL', message: sendNote });
              closeSending();
            }}
          >
            Send to buyer
          </s-button>
          <s-button slot="secondary-actions" onClick={closeSending}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

const pickedOf = (ids, list) => ids.map((id) => (list || []).find((x) => x.id === id)).filter(Boolean);

// A line of the Status: `parts` [what to do next and what changes for the buyers,
// the rest (optional) in an ⓘ tooltip at its end].
function StatusLine({ parts: [main, more] }) {
  return (
    <s-paragraph color="subdued" fontSize="small">
      {main}
      {more ? (
        <>
          {' '}
          <Tip content={more}>
            <s-icon type="info" size="small" color="subdued" />
          </Tip>
        </>
      ) : null}
    </s-paragraph>
  );
}

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
