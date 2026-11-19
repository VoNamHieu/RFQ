// Contracts (shown as "Contracts"; called agreements in code): a company's terms —
// its pricing (base + quantity) and order limits — set up and applied together,
// for all its locations or some, from a start date to an optional end date. Saving a
// new one puts it in force: Active, or Scheduled until its start date.
//   Proposed  — sent to the buyer to approve (a contract with Buyer must approve this
//               contract ticked in its editor, `approval`): nothing of it applies. The buyer
//               answers it from their B2B Portal — Approve, or Request changes
//               (buyerEvents.js); once they approve its version, the merchant
//               activates it (Active, or Scheduled until its start date). Saved
//               again, it goes back to them as a new version. Its start date passing
//               first, it expires.
//   Scheduled — saved with a start date still to come; applied on that date —
//               unless its buyers' request to cancel it is still open then: it
//               expires instead. One saved with Buyer must approve keeps the
//               version they approved: changed, the change goes to them as its next
//               version (pendingVersionOf), which takes its place once they approve
//               it — not approved by its start date, the approved one starts and the
//               new one keeps waiting (applied once they approve it). Its buyers can ask for changes to the version they
//               approved (liveChangeRequestOf). A request to cancel it is for the whole
//               contract: a new version waiting for them closes (it can only cross
//               from an out-of-date page — while one waits, Request adjustment is
//               disabled).
//   Active    — its pricing and limits are assigned to the company. Saving an
//               active contract applies the change right away as a new version —
//               or, one saved with Buyer must approve, sends it to the buyers first
//               (pendingVersionOf): it applies once they approve it. Its buyers
//               can ask for changes to the version in force (liveChangeRequestOf), or
//               to cancel it (cancelRequestOf): it stays in force until the merchant
//               answers — End contract (it ends right away, at their request: Ended)
//               or Decline request.
//   Expired   — the end date passed: its terms came off and the company is back
//               on the pricing and limits outside the contract.
//   Ended     — ended by hand, or replaced by the next contract; its terms came
//               off. One saved with Buyer must approve isn't ended by hand: the
//               merchant asks its buyers to end it (End contract, with why), and it
//               ends once they approve (endRequestOf).
//   Cancelled — its buyers asked to cancel it before it started (Proposed or
//               Scheduled) and the merchant cancelled it (Cancel contract): none of its
//               terms apply, and it leaves their B2B Portal. One that had started is
//               Ended at their request instead. Expired, Ended and Cancelled stay as
//               history.
// A company can have several contracts, each for all its locations or some. A
// location is in one contract at a time: one saved, or saved as a version, over Active
// or Scheduled ones there in time (clashesAt) is allowed — where they overlap, the one
// that starts later runs from its start date (handOver); starting the same day as a
// Scheduled one, the one saved last does (`takesOver`).
// On its start date a contract takes its locations over from the Active ones there,
// whatever their end dates, and from the Scheduled ones starting that day it was saved
// over: one left with no locations ends ("Replaced by …", "… before it started"), one
// with others left keeps those, as a new version.
// Every version keeps a snapshot of its terms as they were then (names and what
// each sets), so any version — and contracts that are over — can be read again.
// A contract's pricing and limits are its own (`forContracts`, `contractId`): made in
// the contract editor, new or copied from the Pricing and Order limits lists
// (copyTerms), with no dates, status or assignments of their own — the contract
// decides who gets them and when. They aren't in those lists, and each is in one
// contract only. They're edited in the contract editor, staged there (`staged`) and
// saved with the contract (saveStagedTerms): saving a live one applies the edits as a
// new version. Elsewhere they can't be taken off where it applies (missingTerms /
// newlyBroken); editing one from a company or location page opens its contract.
// In production a daily job starts and expires contracts (syncContractDates) and
// reminds the merchant reminderDays before the end date; Extend moves the end date
// and keeps the terms, as a new version. The demo's "today" is TODAY.
// Ending a contract takes off only what it added.
import { addPricingToLocations, removeCompanySlot, companySlotArray, demoPolicyId } from './dbHelpers.js';
import { hasOwnSlot, slotIds, scopeLabel, ruleAdjustmentLabel, ruleValuesSummary, ruleValues, ruleField, productVariants, TODAY } from './pricing.js';
import { money2 } from './format.js';
import { limitKey, limitSummary, limitLevel, isD2CLimit, limitRules, defaultLimitMessage } from './limits.js';
import { versionFlags } from '../shared/versions.js';

const KINDS = ['base', 'quantity'];
const termIds = (ag) => [...ag.terms.base, ...ag.terms.quantity, ...ag.terms.limits];

// Contracts are numbered from CT-1000 on, and a number is never given out again:
// `db.contractSeq` keeps the highest one saved, even once that contract is deleted
// (recordContractNumber).
const numberOf = (number) => Number(String(number).replace(/\D/g, '')) || 0;
export function nextAgreementNumber(db) {
  const max = (db.agreements || []).reduce((m, a) => Math.max(m, numberOf(a.number)), Math.max(999, db.contractSeq || 0));
  return `CT-${max + 1}`;
}
export function recordContractNumber(db, ag) {
  db.contractSeq = Math.max(db.contractSeq || 0, numberOf(ag.number));
}

// ── Dates ─────────────────────────────────────────────────────────────────────
// Dates are YYYY-MM-DD, so string comparison matches date order.
export const RENEW_NOTICE_DAYS = 30;
// A contract shorter than this gets no renewal reminder.
export const MIN_REMINDER_DAYS = 7;
export const fmtDay = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const daysBetween = (from, to) => Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000);
export const daysUntil = (iso) => daysBetween(TODAY, iso);
export function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const addDay = (iso) => addDays(iso, 1);
// How long a contract runs, its start and end dates included.
export const termDays = (ag) => daysBetween(ag.startDate, ag.endDate) + 1;
// Extend's default end date: the contract runs one more term of the same length.
export const extendedEndDate = (ag) => addDays(ag.endDate, termDays(ag));
// The renewal reminder starts RENEW_NOTICE_DAYS before the end date, or halfway
// through a contract shorter than twice that; one shorter than MIN_REMINDER_DAYS
// gets none (0).
export function reminderDays(ag) {
  const days = termDays(ag);
  return days < MIN_REMINDER_DAYS ? 0 : Math.min(RENEW_NOTICE_DAYS, Math.floor(days / 2));
}
// Do two contracts' dates overlap? No end date runs on.
export const datesOverlap = (a, b) =>
  (!a.endDate || !b.startDate || b.startDate <= a.endDate) && (!b.endDate || !a.startDate || a.startDate <= b.endDate);
// What going live gives it: Scheduled while its start date is still to come.
export const liveStatus = (ag) => (ag.startDate && ag.startDate > TODAY ? 'Scheduled' : 'Active');
// `between` joins the two dates: " – " by default, " to " where the copy says so
// (the contract viewer).
export function agreementDatesLabel(ag, between = ' – ') {
  if (!ag.startDate) return ag.endDate ? `Until ${fmtDay(ag.endDate)}` : 'No dates';
  return ag.endDate ? `${fmtDay(ag.startDate)}${between}${fmtDay(ag.endDate)}` : `From ${fmtDay(ag.startDate)}, no end date`;
}

export const PAST_STATUSES = ['Expired', 'Ended', 'Cancelled'];
// A contract that's over stays in its buyers' B2B Portal (read-only, with how it ended)
// when they approved it at least once, or it was in force (Active) before it ended — a
// proposal never approved, or one cancelled (or replaced) before it started that nobody
// approved, leaves it.
export function shownWhenOver(ag) {
  if (!PAST_STATUSES.includes(ag?.status)) return false;
  const note = String(ag.history?.[0]?.note || '');
  const wasInForce = (ag.status === 'Ended' && !/^Cancelled before|before it started$/.test(note)) || (ag.status === 'Expired' && !/^Expired before/.test(note));
  return wasInForce || (ag.buyerResponses || []).some((r) => r.kind === 'approve');
}
// Activated: Scheduled or Active.
export const isLive = (ag) => ag?.status === 'Active' || ag?.status === 'Scheduled';
// A buyer answer by what it says — its version, day, kind, note and who — so a decline
// can name the request it declines (answers carry no id of their own).
// (Its revision only when it has one, so answers from before revisions keep their key.)
export const responseKey = (r) => (r ? [r.version, ...(r.revision ? [`r${r.revision}`] : []), r.at, r.kind, r.message || '', r.email || r.buyer || ''].join('|') : '');
// One thing waits at a time on a contract: something for its buyers to answer (a
// proposal, a new version, the merchant's request to end it) or something for the
// merchant (their request for changes, or to cancel it) — answered, the next can open
// (canEndAgreement, sellerBusyOf; in the B2B Portal, a new version waiting disables
// Request adjustment on the contract they approved: they answer the new version —
// Approve, Request changes, or Decline it, keeping the one they approved).
// Any of its buyers at a location it applies to can answer it, so answers can cross: the first approval of a version settles it — it's approved, whatever came
// before or after — and an approval answers no request: requests for changes (or to
// cancel it) stay open until the merchant answers them (declines them, or sends it
// again), on the contract the approval activated if it did.
// Its buyers' answers to its version (and revision), oldest first.
const answersTo = (ag) => (ag?.buyerResponses || []).filter((r) => r.version === ag.version && (r.revision || 0) === (ag.revision || 0));
// The first approval of its version, or null.
export const approvalOf = (ag) => answersTo(ag).find((r) => r.kind === 'approve') || null;
// A new version's first final answer — approved, or declined (Decline: they keep the
// version they approved) — or null. The first one settles it.
export const finalAnswerOf = (ag) => answersTo(ag).find((r) => r.kind === 'approve' || r.kind === 'decline') || null;
const FINAL = ['approve', 'decline'];
// Their latest request to its version — for changes, or to cancel it — or null.
export const latestRequestOf = (ag) => [...answersTo(ag)].reverse().find((r) => !FINAL.includes(r.kind)) || null;
// That request while the merchant hasn't declined it, or null.
export const openRequestOf = (ag) => (latestRequestOf(ag) && !declineOf(ag) ? latestRequestOf(ag) : null);
// The merchant's decline of the buyer's latest request — for changes (Decline request,
// with a reply the buyer sees) or to cancel it (Decline request, with a reply they see):
// { responseKey, version, at, message }, or null — kept on the contract in `declines`.
// Declined, the contract is as it was before the request: a proposal waits for the
// buyer again, a Scheduled one stays scheduled.
export function declineOf(ag) {
  const r = latestRequestOf(ag);
  if (!r) return null;
  return [...(ag.declines || [])].reverse().find((d) => d.responseKey === responseKey(r)) || null;
}
// The buyers' requests for changes to its version sent one after another with no
// answer from the seller in between — while one waits, they can send more — oldest
// first: the seller sees them all and answers them together (Decline request, or
// sending it again). Their latest request's run: [] when that isn't one for changes. An
// approval between them doesn't break it (it answers none of them).
export function changeRequestBatch(ag) {
  const mine = answersTo(ag).filter((r) => !FINAL.includes(r.kind));
  const latest = mine[mine.length - 1];
  if (!latest || latest.kind !== 'changes') return [];
  // Declined together, a run shares its decline (same reply, same time).
  const tag = (r) => {
    const d = (ag.declines || []).find((x) => x.responseKey === responseKey(r));
    return d ? `${d.time || ''}|${d.at}|${d.message}` : '';
  };
  const run = [];
  for (let i = mine.length - 1; i >= 0 && mine[i].kind === 'changes' && tag(mine[i]) === tag(latest); i -= 1) run.unshift(mine[i]);
  return run;
}
// The ones still waiting for the seller (none once they declined them).
export const openChangeRequests = (ag) => (declineOf(ag) ? [] : changeRequestBatch(ag));
// The buyers' open request to cancel a contract that hasn't started (Proposed or
// Scheduled; Request cancellation in their B2B Portal, with why): their latest answer
// to its version, when it's that and the merchant hasn't declined it — or null. While
// it's open, the merchant cancels the contract (Cancel contract) or rejects the request
// (Decline request); nothing else.
// An Active one saved with Buyer must approve can be asked to be cancelled too: the
// merchant ends it at their request (End contract: Ended, no asking them again) or
// rejects the request; it stays in force meanwhile, its status Active.
export function cancelRequestOf(ag) {
  if (ag?.status !== 'Proposed' && ag?.status !== 'Scheduled' && !(ag?.status === 'Active' && ag.approval)) return null;
  const r = openRequestOf(ag);
  return r?.kind === 'cancel' ? r : null;
}
// The buyers' open request for changes to a contract they approved — Scheduled or
// Active, saved with Buyer must approve (Request changes on its Upcoming contract or
// Contract card in their B2B Portal): their latest answer to the version they
// approved, while the merchant hasn't declined it and hasn't sent them a new version
// since (pendingVersionOf) — or null. That version stays meanwhile (still starts on its
// date, or stays in force); the merchant sends a new version (Send to buyer) or
// declines the request (Decline request, with a reply they see). It doesn't change its
// status: it's noted beside it (pendingNote). Ended or expired, it closes with it.
export function liveChangeRequestOf(ag) {
  if (!isLive(ag) || !ag.approval || ag.pending) return null;
  const r = openRequestOf(ag);
  return r?.kind === 'changes' ? r : null;
}
// The buyers' requests for changes waiting for the merchant — to a Proposed one, its
// version waiting for them (pendingVersionOf) or the version they approved of a
// Scheduled or Active one (liveChangeRequestOf) — oldest first; [] when none is. Declined, all go together
// (Decline request); sent the contract again (Send to buyer), all are answered, with the
// merchant's message when they add one (`replies`, as a decline's reply).
export function changesToAnswer(ag) {
  const asked = pendingVersionOf(ag) || ag;
  return proposalState(asked) === 'changes' || liveChangeRequestOf(asked) ? openChangeRequests(asked) : [];
}
// Delete contract, while it hasn't started (Scheduled or Proposed). Never one saved
// with Buyer must approve, before or after it's cancelled. A Draft (saved, never
// activated or sent) always.
export const canDeleteAgreement = (ag) => ag?.status === 'Draft' || ((ag?.status === 'Scheduled' || ag?.status === 'Proposed') && !ag.approval);
// Cancel contract: only while its buyers' request to cancel it is open — it's
// Cancelled right away (kept as history) and leaves their B2B Portal.
export const canCancelAgreement = (ag) => !!cancelRequestOf(ag);
// End contract: an Active one, or a Scheduled one its buyers didn't have to approve.
// One they approved can't be ended before it starts (it's cancelled at their request:
// Cancel contract). An Active one saved with Buyer must approve isn't ended by hand:
// End contract asks its buyers to end it (endRequestOf) — not again while they haven't
// answered.
// Nor while a new version or their request for changes waits (one thing at a time) —
// their request to cancel it is answered by ending it.
// One they approved that hasn't started is the same: Cancel contract asks them to cancel
// it (mirroring End contract) — not while their own request to cancel it is open (Cancel
// contract answers that).
export const canEndAgreement = (ag) =>
  (ag?.status === 'Active' && !endRequestOf(ag) && !(ag.approval && (ag.pending || liveChangeRequestOf(ag)))) ||
  (ag?.status === 'Scheduled' && (!ag.approval || (!endRequestOf(ag) && !ag.pending && !liveChangeRequestOf(ag) && !cancelRequestOf(ag))));
// The merchant's request to end an Active contract saved with Buyer must approve (End
// contract, with why — kept in `endRequests` { version, at, time, message }), while its
// buyers haven't answered it — or null. They answer it in their B2B Portal (`endResponses`
// { kind: 'end-approve' | 'end-decline', requestAt: its time, message, buyer, at }):
// approved, it ends right away (activateApproved) — a version waiting for them and a
// request of theirs go with it; declined, it stays in force. Meanwhile it stays in force.
// The merchant can withdraw it while they haven't answered (`withdrawnAt`, its time): it
// closes, and their B2B Portal no longer asks them.
// A Scheduled one's the same, asked to cancel it (`cancel: true`): approved, it's
// cancelled and won't start; not answered by its start date, the request lapses
// (`lapsedAt`) and it starts.
export function endRequestOf(ag) {
  if (!isLive(ag) || !ag.approval) return null;
  const req = (ag.endRequests || []).at(-1);
  return req && !req.withdrawnAt && !req.lapsedAt && !endAnswerOf(ag, req) ? req : null;
}
// Their answer to a request to end it, or null.
export const endAnswerOf = (ag, req) => (req ? (ag.endResponses || []).find((r) => r.requestAt === req.time) || null : null);
// The seller's latest message on a contract to its buyers — their reply declining a
// request (for changes, or to cancel it), or the message sent with the contract (or a
// new version): in answer to their requests (`replies`), or on its own (`sentMessages`
// { version, at, time, message }) — while it's the latest word: they haven't answered
// since. { message, at, time, kind } or null. (Their request to end it has its own:
// endRequestOf.) The B2B Portal opens it from the card (Seller's message).
export function sellerMessageOf(ag) {
  const t = (x) => String(x.time || `${String(x.at || '').slice(0, 10)}T00:00:00.000Z`);
  const said = [...(ag?.declines || []), ...(ag?.replies || []), ...(ag?.sentMessages || [])].filter((x) => x.message).sort((a, b) => t(a).localeCompare(t(b))).pop();
  if (!said || (ag.buyerResponses || []).some((r) => t(r) > t(said))) return null;
  // `kind`: 'declined-changes' / 'declined-cancel' (their request the seller declined), or
  // 'sent' (with the contract or a version).
  const declinedOne = (ag.declines || []).includes(said) ? (ag.buyerResponses || []).find((r) => responseKey(r) === said.responseKey) : null;
  const kind = (ag.declines || []).includes(said) ? (declinedOne?.kind === 'cancel' ? 'declined-cancel' : 'declined-changes') : 'sent';
  // A decline is over once the seller moved on: asked to end (or cancel) it, sent a new
  // version, or sent the contract again since.
  if (kind !== 'sent') {
    const since = [...(ag.endRequests || []).map((q) => q.time), ag.pending?.sentAt, ...(ag.sellerUpdates || []).map((u) => u.at), ...(ag.history || []).filter((h) => h.unapproved === 'sent').map((h) => h.sentAt)];
    if (since.filter(Boolean).some((x) => String(x) > t(said))) return null;
  }
  return { message: said.message, at: said.at, time: said.time || null, kind };
}
// Its latest request to end it, when they declined it: { req, answer }, or null.
export function endDeclinedOf(ag) {
  const req = (ag?.endRequests || []).at(-1);
  const answer = endAnswerOf(ag, req);
  return answer?.kind === 'end-decline' ? { req, answer } : null;
}

// ── A new version waiting for the buyers (Active, Buyer must approve) ─────────
// The time now on the app's day (TODAY: the demo's in the prototype), as the B2B Portal
// stamps the buyers' answers (storefront answerContract) — so the seller's changes and
// the buyers' answers read in order in its Activities log.
const nowOnToday = () => `${TODAY}T${new Date().toISOString().slice(11)}`;

// Changing an Active contract saved with Buyer must approve sends the change to its
// buyers as its next version (`pending`: { draft, staged, revision }) — the version in
// force stays until they approve it, then the new one applies right away
// (activateApproved) — by its end date: then it expires, the new one with it. Extend
// sends its new end date the same way. A Scheduled one's the same way: the version they approved stays
// scheduled until they approve the new one, which then takes its place (starting on
// its own date); not approved by the start date, the approved one starts and the new
// one keeps waiting, as an Active one's (syncContractDates). `draft`: the version's own fields (PENDING_FIELDS); `staged`: its
// pricing and limits as edited, kept out of the lists until then. Sent again, it keeps
// its version number and gets a new revision, as a proposal does.
const PENDING_FIELDS = ['name', 'startDate', 'endDate', 'locationIds', 'applyLater', 'timezone', 'terms'];
const pickPending = (x) => Object.fromEntries(PENDING_FIELDS.filter((k) => k in x).map((k) => [k, copyOf(x[k])]));
// The version waiting for its buyers, read as a proposal (status Proposed, its version
// and revision) — the buyers' answers, declines and seller updates are the contract's.
// Null when there's none.
export const pendingVersionOf = (ag) =>
  isLive(ag) && ag.pending ? { ...ag, ...ag.pending.draft, status: 'Proposed', version: ag.pending.version || (ag.version || 0) + 1, revision: ag.pending.revision || 0 } : null;
// The number the next version sent or saved gets: every one has its own, so after one
// its buyers declined (or that expired), the next is a new number — version 2 declined,
// version 3 sent. The version in force goes from 1 to 3 then.
export const nextVersionNumber = (ag) =>
  Math.max(ag?.version || 0, ...(ag?.history || []).map((h) => h.version || 0), ...(ag?.buyerResponses || []).map((r) => r.version || 0), ag?.pending?.version || 0) + 1;
// The contract editor opened on it: the waiting version, as last sent.
export const pendingDraft = (ag) => (ag?.pending ? { ...copyOf(ag), ...copyOf(ag.pending.draft) } : copyOf(ag));
// Send to buyer on an Active contract (mutates `ag`): `draft` and `staged` become the
// version waiting for its buyers. Sent again, the change goes in its Activities log
// (`sellerUpdates`) as a new revision; their answers so far no longer count. `before`:
// the db as it was, `db` with `staged` in place.
export function sendPendingVersion(ag, draft, staged, db, before) {
  // One thing at a time: none is sent while one waits for its buyers.
  if (ag.pending) return;
  // On the app's day, as the buyers' answers and the seller's other steps are stamped.
  const at = nowOnToday();
  // `version`: its own number (nextVersionNumber); `sentAt`: when it went to the buyers
  // (the B2B Portal lists the newest first).
  ag.pending = { draft: pickPending(draft), staged: copyOf(staged || noStagedTerms()), version: nextVersionNumber(ag), revision: 0, sentAt: at };
  logSentVersion(ag, agreementChanges(ag, draft, db, before), db);
  ag.updatedAt = at;
}
// The version waiting for its buyers is in its version history before they approve it
// (admin only: `unapproved`, the B2B Portal's history leaves it out), with its snapshot
// — to read again, or to go on editing from, approved or not: "Version 2 · Sent to
// buyer · Now ends Dec 31, 2027" (`unapproved: 'sent'`, `sentAt` naming it). Declined or
// expired, a line says so under its number (closeVersion); the entry stays. `changes`:
// against the version in force. Mutates `ag`.
function logSentVersion(ag, changes, db) {
  const v = pendingVersionOf(ag);
  const note = `Sent to buyer${changes && changes !== 'No changes to terms' ? ` · ${changes}` : ''}`;
  ag.history = [{ version: v.version, date: TODAY, note, unapproved: 'sent', sentAt: ag.pending.sentAt, snapshot: snapshotTerms(db, v) }, ...(ag.history || [])];
}
// New pricing and limits of the waiting version whose ids something else took since
// it was sent get new ones (mutates `terms` and `staged`).
function freshPendingIds(db, ag, terms, staged) {
  ['base', 'quantity', 'limits'].forEach((key) => {
    const isLimit = key === 'limits';
    const map = staged[isLimit ? 'limits' : 'policies'];
    terms[key] = terms[key].map((id) => {
      const taken = ((isLimit ? db.limits : db.policies) || []).some((x) => x.id === id && x.contractId !== ag.id);
      if (!taken || !map[id]) return id;
      const all = withStagedTerms(db, staged);
      const fresh = isLimit ? newLimitId(all) : demoPolicyId(all);
      map[fresh] = { ...map[id], id: fresh };
      delete map[id];
      return fresh;
    });
  });
}
// Buyers approved the waiting version (`r`): it applies right away as the contract's
// next version, as Save as version does — the version in force comes off, the new one
// goes on. A Scheduled one's takes the approved version's place: nothing of it applied
// yet, it's scheduled for its own start date (or starts, that date come) (mutates `db`).
function applyPendingVersion(db, ag, r) {
  // It keeps the number it was sent with.
  const number = pendingVersionOf(ag).version;
  const staged = copyOf(ag.pending.staged || noStagedTerms());
  const fields = copyOf(ag.pending.draft);
  freshPendingIds(db, ag, fields.terms, staged);
  // The lists as they were (saveStagedTerms replaces their entries), for what changed.
  const was = { ...db, policies: [...(db.policies || [])], limits: [...(db.limits || [])] };
  const draft = { ...copyOf(ag), ...fields, status: 'Active', revision: ag.pending.revision || 0 };
  delete draft.pending;
  db.agreements = db.agreements.map((a) => (a.id === ag.id ? draft : a));
  saveStagedTerms(db, draft, staged);
  const changes = agreementChanges(ag, draft, db, was);
  const also = changes === 'No changes to terms' ? '' : ` · ${changes}`;
  if (ag.status === 'Scheduled') {
    // What it takes over is worked out again for its new dates and locations.
    draft.status = 'Scheduled';
    delete draft.takesOver;
    handOver(db, draft, false);
    const later = liveStatus(draft) === 'Scheduled';
    if (!later) takeEffect(db, draft);
    // What changed, when anything did (its dates among them); else when it starts.
    addVersion(db, draft, later ? `Approved by buyer${also || `, starts ${fmtDay(draft.startDate)}`}` : `Approved by buyer, activated${also}`, r.at || TODAY, number);
    dropOwnTerms(db, draft);
    return;
  }
  unapplyAgreement(db, ag);
  handOver(db, draft, true);
  applyAgreement(db, draft);
  addVersion(db, draft, `Approved by buyer${also}`, r.at || TODAY, number);
  dropOwnTerms(db, draft);
}
// A Proposed contract's state, from the buyer's latest answer to its version:
// 'waiting' (none yet, or their request for changes or to cancel it was declined),
// 'approved', 'changes' or 'cancel' (they asked to cancel it); null for any other.
// Approved by anyone at the company, it's 'approved' — a request beside it stays open on
// the contract once it's activated (approvalOf).
export function proposalState(ag) {
  if (ag?.status !== 'Proposed') return null;
  if (approvalOf(ag)) return 'approved';
  const r = openRequestOf(ag);
  return !r ? 'waiting' : r.kind === 'cancel' ? 'cancel' : 'changes';
}
export const PROPOSAL_LABEL = { waiting: 'Awaiting buyer', approved: 'Buyer approved', changes: 'Changes requested', cancel: 'Cancellation requested' };
// What a contract sent for its buyers' approval (Proposed, or an Active one's version
// waiting for them: pendingVersionOf) needs from them — the B2B Portal's Action needed:
// 'approve' (not answered yet: a new one, or sent again since they asked for changes),
// 'declined' (the seller declined their request for changes) or 'cancel-declined' (the seller
// declined their request to cancel it) — either way it's theirs to answer again; null
// when it needs nothing from them.
export function buyerActionOf(ag) {
  if (proposalState(ag) !== 'waiting') return null;
  const d = declineOf(ag);
  return !d ? 'approve' : latestRequestOf(ag)?.kind === 'cancel' ? 'cancel-declined' : 'declined';
}
// What a buyer's answer is to, or why it can't be sent — as the B2B Portal offers it and
// the B2B app applies it (buyerEvents.js: one that couldn't have been sent is dropped).
// Any of its buyers at a location it applies to can answer it (the B2B Portal shows a
// buyer the locations they buy for); one thing at a time, on both sides; the first final
// answer settles a version.
//   approve: a proposal (Proposed, not expired) or the new version waiting for them —
//     not while a request of the company's on it is with the seller;
//   decline: the new version waiting for them (it closes; they keep the one they approved);
//   changes: a proposal, or a Scheduled or Active one they approved (saved with Buyer
//     must approve) — not while a new version, a request to cancel it or the seller's
//     request to end it waits;
//   cancel: the same, with why — not while their request for changes waits;
//   end-approve, end-decline: the seller's request to end an Active one (`requestAt`
//     naming it).
// `ag`: the contract, `body` { version, revision, requestAt }, `today` 'YYYY-MM-DD'.
// → { asked } (the contract, or its version waiting for them) or { status, error }.
export function contractAnswer(ag, kind, body, today) {
  const no = (status, error) => ({ status, error });
  const pending = pendingVersionOf(ag);
  // A waiting version keeps waiting until the contract's end date (a Scheduled one's
  // version approved meanwhile starts, then it waits as an Active one's).
  const stillWaiting = !!pending && (!ag.endDate || ag.endDate >= today);
  const expired = ag.status === 'Proposed' && ag.startDate && ag.startDate < today;
  const sameVersion = (x) =>
    Number(body.version) !== (x.version || 1)
      ? no(409, 'The seller sent a new version. Reload to see it.')
      : Number(body.revision || 0) !== (x.revision || 0)
        ? no(409, 'The seller updated this contract. Reload to see it.')
        : null;
  if (kind === 'end-approve' || kind === 'end-decline') {
    const req = endRequestOf(ag);
    if (!req) {
      // The request they answered (`requestAt`), or the latest: one to cancel it reads so.
      const theirs = (ag.endRequests || []).find((q) => q.time === body.requestAt) || (ag.endRequests || []).at(-1);
      const cancel = theirs ? !!theirs.cancel : ag.status === 'Scheduled';
      return no(409, `The seller isn’t waiting for your answer on ${cancel ? 'cancelling' : 'ending'} it. Reload to see where it stands.`);
    }
    if (body.requestAt !== req.time) return no(409, 'The seller changed their request. Reload to see it.');
    return { asked: ag };
  }
  if (kind === 'approve' || kind === 'decline') {
    const asked = stillWaiting ? pending : kind === 'approve' && ag.status === 'Proposed' && !expired ? ag : null;
    if (!asked) return no(expired ? 409 : 404, expired ? 'This proposal has expired' : 'This contract isn’t waiting for your answer');
    const stale = sameVersion(asked);
    if (stale) return stale;
    if (finalAnswerOf(asked)) return no(409, 'Someone at your company already answered this version. Reload to see it.');
    if (openRequestOf(asked)) return no(409, 'A request from your company is with the seller. Wait for their answer.');
    return { asked };
  }
  if (kind !== 'changes' && kind !== 'cancel') return no(400, 'Not an answer to a contract');
  if (expired) return no(409, 'This proposal has expired');
  const proposal = ag.status === 'Proposed';
  if (!proposal && !(isLive(ag) && ag.approval)) return no(404, kind === 'cancel' ? 'This contract can’t be cancelled from here' : 'This contract can’t be changed from here');
  if (!proposal && ag.pending) return no(409, `Version ${pending.version} is waiting for your answer. Approve or decline it first.`);
  if (endRequestOf(ag)) return no(409, 'The seller asked to end this contract. Answer that first.');
  if (cancelRequestOf(ag)) return no(409, 'You asked to cancel it. Wait for the seller’s answer.');
  if (kind === 'cancel' && openRequestOf(ag)?.kind === 'changes') return no(409, 'Your request for changes is with the seller. Wait for their answer.');
  const stale = sameVersion(ag);
  if (stale) return stale;
  return { asked: ag };
}
// Its line where the buyers see what needs them (the B2B Portal link block): "CT-1000 ·
// Version 2 is waiting for your approval", "CT-1000 · The seller declined your request
// for changes" or "CT-1000 · The seller declined your cancellation request"; '' when
// nothing does. `action`: buyerActionOf's.
export const buyerActionText = (ag, action = buyerActionOf(ag)) =>
  !action
    ? ''
    : action === 'end'
      ? `${ag.number} · The seller asked to ${ag.status === 'Scheduled' || ag.endAsked?.cancel ? 'cancel' : 'end'} this contract`
      : action === 'declined'
      ? `${ag.number} · The seller declined your request for changes`
      : action === 'cancel-declined'
        ? `${ag.number} · The seller declined your cancellation request`
        : `${ag.number} · Version ${ag.version || 1} is waiting for your approval`;
// When a contract — or its version waiting for its buyers (pendingVersionOf) — last
// changed, for the B2B Portal to list the newest first: the latest of when the seller
// last saved or sent it (`updatedAt`; a waiting version: when it was sent), its Version
// history and its Activities log (the seller's changes and declines, the buyers'
// answers) for its versions — by the time each has (`time`), else its day. An ISO time
// or a date; '' for none.
// (A day alone reads as that day's start, before any time on it: the precise times
// decide between changes made the same day.)
export function lastUpdateOf(ag) {
  if (!ag) return '';
  const waiting = ag.status === 'Proposed' && !!ag.pending;
  const its = (x) => (waiting ? x.version === ag.version : (x.version || 1) <= (ag.version || 1));
  return (
    [
      // An Active one's `updatedAt` is its waiting version's once one was sent.
      ...(waiting ? [ag.pending.sentAt || ag.updatedAt] : [ag.pending ? null : ag.updatedAt, ...(ag.history || []).map((h) => h.date)]),
      ...[...(ag.sellerUpdates || []), ...(ag.declines || []), ...(ag.buyerResponses || [])].filter(its).map((x) => x.time || x.at),
      // A request to end it, and their answer.
      ...(waiting ? [] : [...(ag.endRequests || []), ...(ag.endResponses || [])].flatMap((x) => [x.time || x.at, x.withdrawnAt])),
    ]
      .filter(Boolean)
      .map(String)
      .sort()
      .pop() || ''
  );
}
// Buyers approved a proposal (their latest answer to its version, on or before its
// start date): it's activated as the version they approved — Scheduled when it starts
// later, Active when it starts today or has started — as Activate in its editor does.
// Run wherever buyers' answers are applied (buyerEvents.js applyBuyerEvents), so the
// B2B app, the B2B Portal's backend and the prototype all do it the same way.
// Mutates `db`; returns whether any was activated.
export function activateApproved(db) {
  let any = false;
  (db.agreements || [])
    .filter((ag) => ag.status === 'Proposed')
    .forEach((ag) => {
      // The first approval of its version, whatever else its buyers sent (approvalOf).
      const r = approvalOf(ag);
      if (!r || (ag.startDate && r.at && r.at > ag.startDate)) return;
      handOver(db, ag, false);
      const later = liveStatus(ag) === 'Scheduled';
      if (later) ag.status = 'Scheduled';
      else takeEffect(db, ag);
      ag.history = [{ version: ag.version, date: r.at || TODAY, note: later ? `Approved by buyer, starts ${fmtDay(ag.startDate)}` : 'Approved by buyer, activated' }, ...(ag.history || [])];
      any = true;
    });
  // A request to end an Active one, approved: it ends right away (a version waiting for
  // them goes with it). A Scheduled one's, to cancel it: it's cancelled.
  (db.agreements || [])
    .filter((ag) => isLive(ag) && ag.approval)
    .forEach((ag) => {
      const req = (ag.endRequests || []).at(-1);
      const r = endAnswerOf(ag, req);
      if (r?.kind !== 'end-approve') return;
      // Withdrawn before they approved it (an out-of-date page): it doesn't count.
      if (req.withdrawnAt && !(r.time && r.time < req.withdrawnAt)) return;
      if (ag.status === 'Scheduled') closeAgreement(db, ag, 'Cancelled', 'Cancelled · approved by buyer', r.at || TODAY);
      else closeAgreement(db, ag, 'Ended', 'Ended · approved by buyer', r.at || TODAY);
      any = true;
    });
  // A new version of an Active one, approved: it applies right away. A Scheduled one's
  // takes the approved version's place (approved after its start date, once it has
  // started — syncContractDates — it applies right away as an Active one's).
  (db.agreements || [])
    .filter((ag) => pendingVersionOf(ag))
    .forEach((ag) => {
      const r = finalAnswerOf(pendingVersionOf(ag));
      if (!r) return;
      // Declined: it closes, the version they approved stays (declineVersion).
      if (r.kind === 'decline') {
        declineVersion(ag, r);
        any = true;
        return;
      }
      // An Active one's, approved after its end date: it expired (syncContractDates).
      if (ag.status === 'Active' && ag.endDate && r.at && r.at > ag.endDate) return;
      applyPendingVersion(db, ag, r);
      any = true;
    });
  return any;
}
// Its buyers declined the new version waiting for them (`r`, with their message if any):
// it closes, and the version they approved stays — in force, or still starting on its
// date (an extension declined: it ends on its end date). Its version history says so
// ("Version 2 · Declined by buyer"); the version as sent stays there
// (logSentVersion), and the contract editor opens on it (editorStartOf). The next
// version sent gets a new number (nextVersionNumber). Mutates `ag`.
function declineVersion(ag, r) {
  closeVersion(ag, r.at || TODAY, 'Declined by buyer', 'declined');
}
// The new version waiting for its buyers closes, with a line under its number in its
// version history (`unapproved`: 'declined' or 'expired').
function closeVersion(ag, date, note, outcome) {
  const v = pendingVersionOf(ag).version;
  delete ag.pending;
  ag.history = [{ version: v, date, note, unapproved: outcome }, ...(ag.history || [])];
}
// Their latest decline of a new version, while no other is waiting: the response
// ({ version, at, message, buyer }), or null — the contract page says so.
export function versionDeclinedOf(ag) {
  if (!isLive(ag) || ag.pending) return null;
  return [...(ag.buyerResponses || [])].reverse().find((r) => r.kind === 'decline' && r.version > (ag.version || 1)) || null;
}
// What the merchant waits on before opening anything else on a contract saved with Buyer
// must approve (one thing at a time): their request (for changes, or to cancel it), a
// new version waiting for them, or the request to end it — 'request' | 'version' | 'end',
// or null.
export function sellerBusyOf(ag) {
  if (!isLive(ag) || !ag.approval) return null;
  if (liveChangeRequestOf(ag) || cancelRequestOf(ag) || proposalState(pendingVersionOf(ag)) === 'changes') return 'request';
  if (endRequestOf(ag)) return 'end';
  if (ag.pending) return 'version';
  return null;
}
// A Scheduled or Active contract's request waiting for the merchant, as the Contracts
// list and the company page's chip note it beside its status (which stays): its new
// version waiting for its buyers (pendingVersionOf) — "Version 2 awaiting buyer", or
// "Changes requested" once they asked for changes to it — or their request for changes
// to the version they approved (liveChangeRequestOf): "Changes requested"; '' for none.
// A request to end it waiting for its buyers adds "End requested" (endRequestOf).
// A Proposed one's request from its buyers reads the same way: its status stays
// Proposed, "Changes requested" / "Cancellation requested" beside it (as the B2B Portal
// keeps Proposed with the request as a tag).
export function pendingNote(ag) {
  if (ag?.status === 'Proposed') {
    const state = proposalState(ag);
    return state === 'changes' ? 'Changes requested' : state === 'cancel' ? 'Cancellation requested' : '';
  }
  const v = pendingVersionOf(ag);
  const asked = !v ? (liveChangeRequestOf(ag) ? 'Changes requested' : '') : proposalState(v) === 'changes' ? 'Changes requested' : `Version ${v.version} awaiting buyer`;
  // A Scheduled or Active one its buyers asked to cancel: "Cancellation requested" (its status stays).
  const cancel = isLive(ag) && cancelRequestOf(ag) ? 'Cancellation requested' : '';
  return [asked, cancel, endRequestOf(ag) ? (ag.status === 'Scheduled' ? 'Asked to cancel' : 'End requested') : ''].filter(Boolean).join(' · ');
}
// Its status as it reads: its status, whatever its buyers asked — Proposed, Scheduled or
// Active keeps it, the request beside it (pendingNote), as in their B2B Portal.
export const statusLabel = (ag) => ag?.status;
// The company's contracts sent to its buyers that aren't activated yet.
export const proposedAgreements = (db, companyId) =>
  (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Proposed').sort((a, b) => String(a.number).localeCompare(String(b.number)));

const companyOf = (db, ag) => (db.companies || []).find((c) => c.id === ag.companyId) || null;
// The company's Active contracts, and its next ones (Scheduled).
export const activeAgreements = (db, companyId) => (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Active');
export const nextAgreements = (db, companyId) => (db.agreements || []).filter((a) => a.companyId === companyId && a.status === 'Scheduled');
// The company's contracts that aren't over: Active first, then Scheduled.
const OPEN_ORDER = { Active: 0, Scheduled: 1 };
export const openAgreements = (db, companyId) =>
  [...activeAgreements(db, companyId), ...nextAgreements(db, companyId)].sort(
    (a, b) => OPEN_ORDER[a.status] - OPEN_ORDER[b.status] || String(a.number).localeCompare(String(b.number)),
  );
// When it last changed: saved or given a new version (`updatedAt`), or, for a seeded
// one, its latest version entry.
export const lastChange = (ag) => ag.updatedAt || ag.history?.[0]?.date || '';
// The Active contract at a location.
export const activeAt = (db, company, locationId) => activeAgreements(db, company.id).find((a) => appliesAt(company, a, locationId)) || null;
// A new contract can always be set up: one overlapping Active or Scheduled contracts at
// its locations takes those locations over when it goes live (handOver).
export const canCreateAgreement = (db, companyId) => (db.companies || []).some((c) => c.id === companyId);

// The company's other contracts that keep `ag` from having a location — a location
// is in one contract at a time (null: a company without locations). A started one
// (`started`): another Active one there, or a Scheduled one in its dates. Any other:
// an Active or Scheduled one there in force on its dates — it can only start after
// that one ends. `dates` stands in for its own dates.
export function clashesAt(db, company, ag, locationId, started, dates = ag) {
  const here = (a) => a.id !== ag.id && appliesAt(company, a, locationId);
  const active = activeAgreements(db, company.id).filter(here);
  const scheduled = nextAgreements(db, company.id).filter((a) => here(a) && a.status === 'Scheduled' && datesOverlap(a, dates));
  return started ? [...active, ...scheduled] : [...active.filter((a) => datesOverlap(a, dates)), ...scheduled];
}
// The contracts `ag` clashes with at any of its locations, each once.
export function agreementClashes(db, ag, started, dates = ag) {
  const c = companyOf(db, ag);
  if (!c) return [];
  const ids = (c.locations || []).length ? scopeLocations(c, ag).map((l) => l.id) : [null];
  return [...new Set(ids.flatMap((id) => clashesAt(db, c, ag, id, started, dates)))];
}

// Saving `ag` (a new one, or a version of it) over the contracts it overlaps
// (agreementClashes): where they overlap, the one that starts later runs, and the one
// before it runs until that day. `from` is `ag`'s start date, or today once it has
// started. Neither's end date changes: on the later start date (takeEffect) the one
// before, left with no other locations, ends ("Replaced by …"), otherwise it keeps
// those and the shared ones move. A Scheduled one starting on `from` too (`before`):
// `ag`, saved last, runs there — on that day that one ends before it started, or
// gives those locations up.
export function overlapHandover(db, ag, started) {
  const c = companyOf(db, ag);
  if (!c) return [];
  const from = started ? TODAY : ag.startDate;
  return agreementClashes(db, ag, started).map((old) => ({
    old,
    shared: sharedLocations(c, old, ag),
    kept: keptLocations(c, old, ag),
    from,
    before: old.status === 'Scheduled' && old.startDate === from,
  }));
}
// A contract its buyers approved (saved with Buyer must approve) isn't ended or changed
// without them — End contract asks them, a change goes to them as a new version. So
// saving or sending one that would newly take its locations over (overlapHandover) is
// blocked: those overlaps, [] for none. `saved`: the contract as it is (its own
// overlaps from before don't count again); `started`: as overlapHandover's.
export function approvedTakeovers(db, ag, saved, started) {
  const was = saved && isLive(saved) ? overlapHandover(db, saved, started) : [];
  const same = (h, x) => x.old.id === h.old.id && x.from === h.from && h.shared.every((l) => x.shared.some((y) => y.id === l.id));
  return overlapHandover(db, ag, started).filter((h) => h.old.approval && h.old.id !== ag.id && !was.some((x) => same(h, x)));
}
// Saving it over them, before its own terms go on (mutates `db`): what happens today
// — an Active one it replaces right away. A later start date is takeEffect's, on that
// day; a Scheduled one starting the same day is noted (`takesOver`, taken off that
// one's) for then.
export function handOver(db, ag, started) {
  overlapHandover(db, ag, started).forEach(({ old, shared, kept, from, before }) => {
    if (before) {
      ag.takesOver = [...new Set([...(ag.takesOver || []), old.id])];
      old.takesOver = (old.takesOver || []).filter((id) => id !== ag.id);
      return;
    }
    if (old.status !== 'Active' || from > TODAY) return;
    if (!kept.length) {
      closeAgreement(db, old, 'Ended', `Replaced by ${ag.number}`);
      return;
    }
    unapplyAgreement(db, old);
    old.locationIds = kept.map((l) => l.id);
    applyAgreement(db, old);
    addVersion(db, old, `${namesOf(shared)} moved to ${ag.number}`);
  });
}

// The Overlaps box (Activate / Save as version) and Extend's Overlaps banner: one line
// per contract — where they share locations, and its dates there ("Hanoi is in CT-301
// until Aug 20, 2026.", "Can Tho is in CT-304 from Feb 1, 2027 until Jan 31, 2028.");
// two at most, then "… and N more". `list`: [{ old, shared }].
export function overlapLines(company, list) {
  const line = ({ old, shared }) => {
    const where = shared.length ? namesOf(shared) : company.name;
    const is = shared.length <= 1 ? 'is' : 'are';
    if (old.status === 'Scheduled') return `${where} ${is} in ${old.number} from ${fmtDay(old.startDate)}${old.endDate ? ` until ${fmtDay(old.endDate)}` : ''}.`;
    return old.endDate ? `${where} ${is} in ${old.number} until ${fmtDay(old.endDate)}.` : `${where} ${is} in ${old.number}, which has no end date.`;
  };
  return list.length > 2 ? [...list.slice(0, 2).map(line), `… and ${list.length - 2} more`] : list.map(line);
}
// "Overlaps 1 contract", "Overlaps 3 contracts".
export const overlapsHeading = (n) => `Overlaps ${n} contract${n === 1 ? '' : 's'}`;

// The Active contracts sharing a location with `ag` and still in force on its start
// date: when it starts, it takes those locations over.
export function takenOver(db, ag) {
  const c = companyOf(db, ag);
  if (!c) return [];
  return activeAgreements(db, ag.companyId).filter(
    (a) => a.id !== ag.id && overlaps(c, a, ag) && (!a.endDate || !ag.startDate || ag.startDate <= addDay(a.endDate)),
  );
}
// "a", "a and b", "a, b and c".
export const joinAnd = (parts) => (parts.length < 2 ? parts[0] || '' : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`);

// A new contract. Where Active or Scheduled contracts hold its locations, it starts
// the day after the last of them ends, so it overlaps none (today when one there has
// no end date). `company` is null when it's picked in the editor.
export function defaultStartDate(db, companyId, locationIds = null) {
  const c = companyOf(db, { companyId });
  if (!c) return TODAY;
  const probe = { id: null, companyId, locationIds };
  const live = (db.agreements || []).filter((a) => a.companyId === companyId && isLive(a) && overlaps(c, a, probe));
  if (live.some((a) => !a.endDate)) return TODAY;
  const ends = live.map((a) => addDay(a.endDate)).filter((d) => d > TODAY).sort();
  return ends[ends.length - 1] || TODAY;
}
export function newAgreement(db, company) {
  return {
    id: null,
    number: nextAgreementNumber(db),
    name: '',
    companyId: company?.id || '',
    locationIds: null, // null = all locations; array = only those
    // "Automatically apply this contract to locations added later" (from Shopify or
    // by hand): on by default for all locations, off for some.
    applyLater: true,
    // Buyer must approve this contract: it goes to the company's buyers first
    // (Proposed), and is activated once they approve it. Off by default; saved on, it
    // stays on (the editor locks it).
    approval: false,
    status: null, // not saved yet: saving makes it Active or Scheduled — or Proposed
    startDate: defaultStartDate(db, company?.id),
    endDate: '', // '' = no end date
    version: 0,
    // Its pricing and limits apply on its dates, whatever their own.
    terms: { base: [], quantity: [], limits: [] },
    history: [],
  };
}
// Do locations added to its company later join it? Contracts saved before the choice
// existed: those on all locations do.
export const addsLaterLocations = (ag) => ag.applyLater ?? !ag.locationIds;

// A new contract with another one's terms and locations — `ag` can be open or over:
// its own copies of that one's pricing and limits (staged until it's saved), and the
// locations its company still has. Its start date follows the Active contracts at
// those locations, as a new one's does; no end date. { draft, staged }
export function duplicateAgreement(db, ag) {
  const c = companyOf(db, ag);
  const locationIds = ag.locationIds ? ag.locationIds.filter((id) => (c?.locations || []).some((l) => l.id === id)) : null;
  const draft = {
    ...newAgreement(db, c),
    name: ag.name ? `Copy of ${ag.name}` : '',
    locationIds,
    applyLater: addsLaterLocations(ag),
    startDate: defaultStartDate(db, ag.companyId, locationIds),
  };
  const staged = noStagedTerms();
  ['base', 'quantity', 'limits'].forEach((key) => copyTerms(db, draft, staged, key, ag.terms[key]));
  return { draft, staged };
}

// ── A contract's own pricing and limits ───────────────────────────────────────
// What a pricing or limit has of its own that the contract decides instead: dates,
// status and who gets it.
const CONTRACT_PRICING = { forContracts: true, audienceType: 'b2b', status: 'Active', validityType: 'evergreen', startDate: '', hasEndDate: false, endDate: '', b2bCompanyIds: [], b2bLocationKeys: [], customerTarget: 'none', assignmentTargetIds: [] };
const CONTRACT_LIMIT = { forContracts: true, audienceType: 'b2b', storeWide: false, companyIds: [], locationKeys: [], contractAt: {}, customerTarget: 'all', customerTargetIds: [], status: 'Active', startDate: null, endDate: null };
const copyOf = (x) => JSON.parse(JSON.stringify(x));
export const asContractPricing = (p) => ({ ...copyOf(p), ...CONTRACT_PRICING });
export const asContractLimit = (l) => ({ ...copyOf(l), ...CONTRACT_LIMIT, createdAt: TODAY, updatedAt: TODAY });
// The contract editor's pricing and limits not saved yet: id → the term as edited,
// or a new one.
export const noStagedTerms = () => ({ policies: {}, limits: {} });
// The db with those in place, as the contract editor shows them.
export function withStagedTerms(db, staged) {
  const over = (list, map) => {
    const terms = Object.values(map || {});
    if (!terms.length) return list;
    return [...list.map((x) => map[x.id] || x), ...terms.filter((x) => !list.some((y) => y.id === x.id))];
  };
  return staged ? { ...db, policies: over(db.policies || [], staged.policies), limits: over(db.limits || [], staged.limits) } : db;
}
// A new pricing of a contract's own, staged in its editor: an id for good, as a limit's
// (newLimitId) — kept in a contract's saved changes (`unsent`) before it's in the lists,
// the next one can't get the same.
export function newContractPricingId(db) {
  let n = Date.now();
  while ((db.policies || []).some((p) => p.id === `pc${n}`)) n += 1;
  return `pc${n}`;
}
export function newLimitId(db) {
  let n = Date.now();
  while ((db.limits || []).some((l) => l.id === `ol${n}`)) n += 1;
  return `ol${n}`;
}
// Copies of pricing or limits (`ids`, in the terms' `key`: base, quantity or limits)
// as the draft's own, staged until it's saved (mutates `draft` and `staged`).
export function copyTerms(db, draft, staged, key, ids) {
  const isLimit = key === 'limits';
  ids.forEach((id) => {
    const all = withStagedTerms(db, staged);
    const from = (isLimit ? all.limits : all.policies).find((x) => x.id === id);
    if (!from) return;
    const copy = isLimit ? { ...asContractLimit(from), id: newLimitId(all) } : { ...asContractPricing(from), id: newContractPricingId(all) };
    delete copy.contractId;
    staged[isLimit ? 'limits' : 'policies'][copy.id] = copy;
    draft.terms = { ...draft.terms, [key]: [...draft.terms[key], copy.id] };
  });
}
// Saving the contract: its staged pricing and limits go in the lists as its own — the
// ones its terms still name. A limit keeps where the contract put it (its companies
// and locations), which the editor doesn't set. Then its own ones it no longer names
// (taken out in the editor) go. Mutates `db`.
export function saveStagedTerms(db, ag, staged) {
  const ids = termIds(ag);
  const put = (key, map, placed = []) =>
    Object.values(map || {})
      .filter((x) => ids.includes(x.id))
      .forEach((x) => {
        const list = db[key] || (db[key] = []);
        const i = list.findIndex((y) => y.id === x.id);
        const term = { ...copyOf(x), forContracts: true, contractId: ag.id };
        if (i < 0) return list.push(term);
        placed.forEach((k) => {
          term[k] = list[i][k];
        });
        list[i] = term;
      });
  put('policies', staged?.policies);
  put('limits', staged?.limits, ['companyIds', 'locationKeys', 'contractAt']);
}
export function dropOwnTerms(db, ag, keep = termIds(ag)) {
  const gone = (x) => x.contractId === ag.id && !keep.includes(x.id);
  db.policies = (db.policies || []).filter((p) => !gone(p));
  db.limits = (db.limits || []).filter((l) => !gone(l));
}
// The contract a pricing or limit is in (its own: one at most).
export const contractOf = (db, id) => (db.agreements || []).find((a) => termIds(a).includes(id)) || null;
// The seed's contracts share some pricing and limits: each gets its own copies, so
// every contract's terms are its own — in its versions too, the one waiting for its
// buyers with them (mutates `db`).
export function ownContractTerms(db) {
  if (!versionFlags().agreements) return db;
  const claimed = new Set();
  (db.agreements || []).forEach((ag) => {
    const moved = {};
    ['base', 'quantity', 'limits'].forEach((key) => {
      const isLimit = key === 'limits';
      if (isLimit && !db.limits) db.limits = [];
      const list = isLimit ? db.limits : db.policies;
      ag.terms[key].forEach((id) => {
        const x = list.find((y) => y.id === id);
        if (!x) return;
        if (x.forContracts && !claimed.has(id)) {
          claimed.add(id);
          x.contractId = ag.id;
          return;
        }
        const copy = { ...(isLimit ? asContractLimit(x) : asContractPricing(x)), id: `${id}-${String(ag.number).toLowerCase()}`, contractId: ag.id };
        list.push(copy);
        claimed.add(copy.id);
        moved[id] = copy.id;
      });
    });
    [ag.terms, ag.pending?.draft?.terms, ...(ag.history || []).map((h) => h.terms)].filter(Boolean).forEach((t) =>
      ['base', 'quantity', 'limits'].forEach((k) => {
        t[k] = (t[k] || []).map((id) => moved[id] || id);
      }),
    );
  });
  return db;
}

// A Scheduled contract that takes over (some of) an Active one's locations by the
// day after it ends (or at any time, when it has no end date), if any.
export function takeoverOf(db, ag) {
  const c = companyOf(db, ag);
  return (
    nextAgreements(db, ag.companyId).find(
      (n) => n.status === 'Scheduled' && c && overlaps(c, n, ag) && (!ag.endDate || n.startDate <= addDay(ag.endDate)),
    ) || null
  );
}
// An active contract ending within its reminderDays with nothing set to take over:
// the merchant gets a reminder.
export const expiringSoon = (ag, db) =>
  ag?.status === 'Active' && !!ag.endDate && reminderDays(ag) > 0 && daysUntil(ag.endDate) <= reminderDays(ag) && !takeoverOf(db, ag);

// ── Scope ─────────────────────────────────────────────────────────────────────
// Picking every location counts as all.
function scopeLocationIds(company, ag) {
  const locs = company.locations || [];
  return ag.locationIds && ag.locationIds.length < locs.length ? ag.locationIds : null;
}
const scopeLocations = (company, ag) => {
  const ids = scopeLocationIds(company, ag);
  return (company.locations || []).filter((l) => !ids || ids.includes(l.id));
};
// Does the contract apply at this location of its company?
export const appliesAt = (company, ag, locationId) => {
  const ids = scopeLocationIds(company, ag);
  return !ids || ids.includes(locationId);
};
// The locations two of a company's contracts share, and those `a` keeps beside `b`.
export const sharedLocations = (company, a, b) => scopeLocations(company, a).filter((l) => appliesAt(company, b, l.id));
export const keptLocations = (company, a, b) => scopeLocations(company, a).filter((l) => !appliesAt(company, b, l.id));
// Do they share a location? (A company without locations: always.)
export const overlaps = (company, a, b) => !(company.locations || []).length || sharedLocations(company, a, b).length > 0;
export const namesOf = (locations) => joinAnd(locations.map((l) => l.name));

export function agreementScopeLabel(company, ag) {
  const ids = scopeLocationIds(company, ag);
  if (!ids) return 'All locations';
  return (company.locations || []).filter((l) => ids.includes(l.id)).map((l) => l.name).join(', ');
}
// The same, saying whether locations added later (from Shopify or by hand) join it,
// for the contract list, the editor's Overview and the Contract tab: "All locations"
// (every location today, and new ones), "Hanoi, Bac Ninh site + new locations" (some,
// and new ones), or only the names when new ones don't join — every location today
// included — as "3 locations" past two.
export function agreementAppliesToLabel(company, ag) {
  if (!(company.locations || []).length) return agreementScopeLabel(company, ag);
  const later = addsLaterLocations(ag);
  if (later && !scopeLocationIds(company, ag)) return 'All locations';
  const names = scopeLocations(company, ag).map((l) => l.name);
  if (later) return `${names.join(', ')} + new locations`;
  return names.length > 2 ? `${names.length} locations` : names.join(', ');
}

// ── Applying ──────────────────────────────────────────────────────────────────
// Assign an agreement's pricing and limits to its company (mutates `db`).
export function applyAgreement(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  if (!c) return;
  const locIds = scopeLocationIds(c, ag);
  // Remember what this adds — to the company's list and to each location's own
  // list (`created`: the location got its own list for it; `inherited`: it already
  // had the pricing from the company) — so ending it takes off only that.
  ag.pricingAdded = { base: {}, quantity: {} };
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const policy = db.policies.find((p) => p.id === id);
    const hadCompany = slotIds(c, kind).includes(id);
    const hadOwn = Object.fromEntries((c.locations || []).map((l) => [l.id, hasOwnSlot(l, kind) ? slotIds(l, kind).includes(id) : null]));
    // All locations: the company's list, so locations added later get it too. Some:
    // only their own lists — not the company's, so locations outside the contract
    // (and ones added later) never get it, and keep following the company's list.
    addPricingToLocations(c, kind, id, policy?.priority, locIds, !locIds);
    ag.pricingAdded[kind][id] = {
      company: !hadCompany && slotIds(c, kind).includes(id),
      locations: (c.locations || [])
        .filter((l) => hadOwn[l.id] !== true && hasOwnSlot(l, kind) && slotIds(l, kind).includes(id))
        .map((l) => ({ id: l.id, created: hadOwn[l.id] === null, inherited: hadOwn[l.id] === null && hadCompany })),
    };
  }));
  // Remember what this adds to each limit, so ending it takes off only that.
  ag.limitsAdded = {};
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    const added = locIds
      ? { companyIds: [], locationKeys: locIds.map((lid) => limitKey(c.id, lid)).filter((k) => !(l.locationKeys || []).includes(k)) }
      : { companyIds: (l.companyIds || []).includes(c.id) ? [] : [c.id], locationKeys: [] };
    l.companyIds = [...(l.companyIds || []), ...added.companyIds];
    l.locationKeys = [...(l.locationKeys || []), ...added.locationKeys];
    ag.limitsAdded[id] = added;
  });
}

// Take an agreement's pricing and limits off its company again (mutates `db`).
export function unapplyAgreement(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  if (!c) return;
  const locIds = scopeLocationIds(c, ag);
  const locs = (c.locations || []).filter((l) => !locIds || locIds.includes(l.id));
  const sameIds = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const added = ag.pricingAdded?.[kind]?.[id];
    if (!added) {
      // Activated before this was tracked: take it off the company and every location's own list.
      if (!locIds) removeCompanySlot(c, kind, id);
      locs.forEach((l) => {
        if (!hasOwnSlot(l, kind)) return;
        const own = l.pricing[kind];
        l.pricing[kind] = (Array.isArray(own) ? own : [{ id: own, priority: 1 }]).filter((e) => ((e && e.id) || e) !== id);
      });
      return;
    }
    if (added.company) removeCompanySlot(c, kind, id);
    added.locations.forEach((a) => {
      const l = (c.locations || []).find((x) => x.id === a.id);
      if (!l || !hasOwnSlot(l, kind)) return;
      const keep = a.inherited ? companySlotArray(l, kind) : companySlotArray(l, kind).filter((e) => e.id !== id);
      // An own list made only for this goes back to inheriting the company's, if it still matches.
      l.pricing[kind] = a.created && sameIds(keep.map((e) => e.id), slotIds(c, kind)) ? null : keep;
    });
  }));
  // Only what activating it added: a company or location the limit had before
  // stays. (An agreement activated before this was tracked takes off all of it.)
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    if (!l) return;
    const added = ag.limitsAdded?.[id] || (locIds ? { companyIds: [], locationKeys: locIds.map((lid) => limitKey(c.id, lid)) } : { companyIds: [c.id], locationKeys: [] });
    l.companyIds = (l.companyIds || []).filter((x) => !added.companyIds.includes(x));
    l.locationKeys = (l.locationKeys || []).filter((k) => !added.locationKeys.includes(k));
  });
}

// Locations added to a company later (auto-added from Shopify, or added in the
// app): they join the company's contracts that apply to locations added later; the
// others keep the locations they had (one on all locations now lists them). With
// Auto-add locations off they join none, whatever the contracts say. An
// Active contract they join gives them its terms right away, as a new version
// ("Added <location>"); a Scheduled one adds a version too and gives them its terms
// when it starts. They join the Active and Scheduled ones in that order, leaving out
// one whose dates would overlap a contract they already joined (mutates `db`).
export function joinLaterLocations(db, c, locations) {
  if (!versionFlags().agreements) {
    c.locations = [...(c.locations || []), ...locations];
    return;
  }
  const open = (db.agreements || []).filter((a) => a.companyId === c.id && isLive(a));
  const active = open.filter((a) => a.status === 'Active');
  // Off first: one on all locations sits on the company's list, which the new
  // location would inherit.
  active.forEach((a) => unapplyAgreement(db, a));
  const had = (c.locations || []).map((l) => l.id);
  c.locations = [...(c.locations || []), ...locations];
  const rank = { Active: 0, Scheduled: 1 };
  const meet = (a, b) => a.startDate <= (b.endDate || '9999-12-31') && b.startDate <= (a.endDate || '9999-12-31');
  const joined = [];
  [...open]
    .sort((a, b) => rank[a.status] - rank[b.status] || String(a.startDate).localeCompare(String(b.startDate)))
    .forEach((a) => {
      const joins = !!c.autoAddLocations && addsLaterLocations(a) && !joined.some((x) => meet(a, x));
      // A version waiting for its buyers (pendingVersionOf) gets the same locations.
      const waiting = a.pending?.draft;
      if (joins) {
        if (a.locationIds) a.locationIds = [...a.locationIds, ...locations.map((l) => l.id)];
        if (waiting?.locationIds) waiting.locationIds = [...waiting.locationIds, ...locations.map((l) => l.id)];
        joined.push(a);
      } else {
        if (!a.locationIds) a.locationIds = had;
        if (waiting && !waiting.locationIds) waiting.locationIds = had;
      }
    });
  active.forEach((a) => applyAgreement(db, a));
  joined.filter(isLive).forEach((a) => addVersion(db, a, `Added ${joinAnd(locations.map((l) => l.name))}`));
}

// The companies and order limits as they'd be after taking `off` off its company
// and putting `on` on (either can be null) — or after `start` takes effect, taking
// its locations over from the Active contracts there — on a copy.
function afterAgreement(db, { off = null, on = null, start = null }) {
  const copy = JSON.parse(JSON.stringify({ companies: db.companies, policies: db.policies, limits: db.limits || [], agreements: db.agreements || [] }));
  if (off) unapplyAgreement(copy, JSON.parse(JSON.stringify(off)));
  if (on) applyAgreement(copy, JSON.parse(JSON.stringify(on)));
  if (start) takeEffect(copy, JSON.parse(JSON.stringify(start)));
  return copy;
}
// Pricing each company and location gets from its Active contracts, picked by
// `idsOf(contract)`: holder id (company or location) → pricing ids. None in a
// version without Contracts.
function contractHolderMap(db, idsOf) {
  const map = {};
  if (!versionFlags().agreements) return map;
  const add = (holderId, ids) => {
    map[holderId] = [...(map[holderId] || []), ...ids];
  };
  (db.agreements || [])
    .filter((a) => a.status === 'Active')
    .forEach((a) => {
      const c = companyOf(db, a);
      const ids = idsOf(a);
      if (!c || !ids.length) return;
      // All locations: the company's list, and any location keeping its own.
      if (!scopeLocationIds(c, a)) add(c.id, ids);
      scopeLocations(c, a).forEach((l) => add(l.id, ids));
    });
  return map;
}
// All of it applies before any other pricing there, on the contract's dates whatever
// its own (pricing.js setContractPricing).
export const liveContractPricing = (db) => contractHolderMap(db, (a) => [...a.terms.base, ...a.terms.quantity]);
// The same once the change happens, with `draft` in force (Active).
const withDraftInForce = (db, change, draft) => {
  const copy = afterAgreement(db, change);
  return { ...copy, agreements: [...copy.agreements.filter((a) => a.id !== draft.id), { ...draft, status: 'Active' }] };
};
export const contractPricingAfter = (db, change, draft) => liveContractPricing(withDraftInForce(db, change, draft));
// Where Active contracts give each order limit — location keys, or `companyId::*` for
// all of a company's — with the contract's number (`contractAt`): the limit checks
// rank those above every other limit there (limits.js). Worked out from the
// contracts after every change; a new list only when something moved.
export function stampContractLimits(db) {
  const want = new Map();
  if (versionFlags().agreements) {
    (db.agreements || [])
      .filter((a) => a.status === 'Active')
      .forEach((a) => {
        const c = companyOf(db, a);
        if (!c) return;
        const ids = scopeLocationIds(c, a);
        const keys = ids ? ids.map((lid) => limitKey(c.id, lid)) : [`${c.id}::*`];
        a.terms.limits.forEach((id) => {
          const at = want.get(id) || {};
          keys.forEach((k) => {
            at[k] = a.number;
          });
          want.set(id, at);
        });
      });
  }
  let moved = false;
  const limits = (db.limits || []).map((l) => {
    const at = want.get(l.id) || {};
    if (JSON.stringify(at) === JSON.stringify(l.contractAt || {})) return l;
    moved = true;
    return { ...l, contractAt: at };
  });
  return moved ? { ...db, limits } : db;
}
// The company after the change — to preview what its buyers would pay.
export const companyAfterAgreement = (db, change, companyId) => afterAgreement(db, change).companies.find((c) => c.id === companyId) || null;

// ── Versions ──────────────────────────────────────────────────────────────────
// What a pricing or limit sets, in one line — kept in each version's snapshot. Not
// its own dates: in a contract it follows the contract's.
const range = (r) => `${r.from}${r.to ? `–${r.to}` : '+'} units`;
export function pricingTermSummary(p) {
  const parts =
    p.priceKind === 'quantity'
      ? [
          scopeLabel(p),
          (p.volumeRanges || [])
            .filter((r) => Number(r.value))
            .map((r) => `${range(r)}: ${ruleAdjustmentLabel({ rule: 'decrease', valueType: r.valueType, value: r.value })}`)
            .join(', '),
        ]
      : [
          `${ruleAdjustmentLabel({ rule: p.pricingRule, valueType: p.valueType, value: p.value })} · ${scopeLabel(p)}`,
          (p.conditionalRules || []).map((r) => `${ruleValuesSummary(r)}: ${ruleAdjustmentLabel(r)}`).join(', '),
          Object.entries(p.variantAdjustments || {}).map(([v, a]) => `${v}: ${ruleAdjustmentLabel(a)}`).join(', '),
          `Priority ${p.priority ?? 0}`,
        ];
  return [...parts, p.status === 'Inactive' && 'Turned off'].filter(Boolean).join(' · ');
}
export const limitTermSummary = (l, db) => [limitSummary(l, db), l.status !== 'Active' && 'Turned off'].filter(Boolean).join(' · ');

// The contract's terms as they are now, for a version's snapshot: names, what each
// sets in a line, and the whole pricing or limit (`config`, see termSettings), so a
// version — and a contract that's over — can be read again in full.
export function snapshotTerms(db, ag) {
  const c = db.companies.find((x) => x.id === ag.companyId);
  const pol = (id) => db.policies.find((p) => p.id === id);
  const lim = (id) => (db.limits || []).find((l) => l.id === id);
  return {
    name: ag.name,
    startDate: ag.startDate,
    endDate: ag.endDate,
    // Its locations (null: all), for the contract editor going on from it (draftFromEntry).
    locationIds: ag.locationIds ? [...ag.locationIds] : null,
    scope: c ? agreementScopeLabel(c, ag) : '',
    base: ag.terms.base.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p), config: copyOf(p) })),
    quantity: ag.terms.quantity.map(pol).filter(Boolean).map((p) => ({ id: p.id, name: p.name, summary: pricingTermSummary(p), config: copyOf(p) })),
    limits: ag.terms.limits.map(lim).filter(Boolean).map((l) => ({ id: l.id, name: l.name, summary: limitTermSummary(l, db), config: copyOf(l) })),
  };
}
// ── Reading a version's terms (ContractVersionModal) ─────────────────────────
// An adjustment as plain text, amounts with cents: "10% off", "$6.90 off", "+5%",
// "Set to $50.00" — or for a fixed price (`fixed`) the price alone, "$6.90".
function adjustText(a, fixed = false) {
  if (!a || a.rule === 'keep' || !Number(a.value)) return 'No change';
  const amount = a.valueType === 'amount' ? money2(a.value) : `${a.value}%`;
  if (a.rule === 'set') return fixed ? amount : `Set to ${amount}`;
  return a.rule === 'increase' ? `+${amount}` : `${amount} off`;
}
// What a pricing covers, mid-sentence: "all products", "3 products", "Contractor assortment".
function scopePhrase(p) {
  const st = p.scopeType || (p.priceKind === 'quantity' ? 'products' : 'all');
  if (st === 'all') return 'all products';
  if (st === 'products') {
    const n = (p.selectedProducts || []).length;
    return `${n} product${n === 1 ? '' : 's'}`;
  }
  return scopeLabel(p);
}
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const capital = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const isFixed = (a) => a?.rule === 'set';
// A quantity range: "1 to 9 units", "50 units or more".
const rangeText = (r) => (r.to ? `${r.from} to ${r.to} units` : `${r.from} units or more`);

// What a pricing or limit does, in one line, so a contract reads at a glance:
// "10% off all products, 12 rules, 5 fixed prices".
export function termSummary(db, x, isLimit) {
  if (isLimit) return limitSummary(x, db);
  if (x.priceKind === 'quantity') {
    const ranges = (x.volumeRanges || []).filter((r) => Number(r.value));
    const top = ranges.reduce((m, r) => (!m || Number(r.value) > Number(m.value) ? r : m), null);
    return capital([plural((x.volumeRanges || []).length, 'quantity range'), top ? `up to ${adjustText({ rule: 'decrease', valueType: top.valueType, value: top.value })}` : 'no discounts', scopePhrase(x)].join(', '));
  }
  const overrides = Object.values(x.variantAdjustments || {});
  const fixed = overrides.filter(isFixed).length;
  const parts = [
    x.pricingRule && x.pricingRule !== 'keep' ? `${adjustText({ rule: x.pricingRule, valueType: x.valueType, value: x.value })} ${scopePhrase(x)}` : null,
    (x.conditionalRules || []).length ? plural(x.conditionalRules.length, 'rule') : null,
    fixed ? plural(fixed, 'fixed price') : null,
    overrides.length - fixed ? plural(overrides.length - fixed, 'product discount') : null,
  ].filter(Boolean);
  return capital(parts.join(', ')) || 'Shopify prices';
}

// A pricing's or limit's settings, as sections of lines (`text`, under it a `note`,
// and its `value` on the right) — what its editor sets, for reading a version's terms
// in full. A base pricing has two: its pricing rules (the default price first, then
// each rule in order, noted with what it targets) and its product overrides.
const RULE_TARGET = { collection: 'Collection', tag: 'Product tag', vendor: 'Vendor', productType: 'Product type' };
export function termSettings(db, x, isLimit) {
  const section = (label, items) => (items.length ? { label, items } : null);
  if (isLimit) {
    const message = x.message || defaultLimitMessage(x);
    return [
      section('Sets', limitRules(x, db).map((r) => ({ text: r.text }))),
      section('Buyer message', message ? [{ text: `“${message}”`, note: x.message ? null : 'Suggested message' }] : []),
    ].filter(Boolean);
  }
  if (x.priceKind === 'quantity') {
    return [
      section('Products', [{ text: capital(scopePhrase(x)) }]),
      section('Quantity ranges', (x.volumeRanges || []).map((r) => ({ text: rangeText(r), value: adjustText({ rule: 'decrease', valueType: r.valueType, value: r.value }) }))),
      section('Discount off', [{ text: x.volumeBasis === 'base' ? 'The base price' : 'The Shopify price' }]),
    ].filter(Boolean);
  }
  // A product override is keyed by its variant: "Industrial filter, XL · Heavy-duty".
  const variantName = (id) => {
    const product = (db.products || []).find((p) => productVariants(p).some((v) => v.id === id));
    const v = productVariants(product).find((y) => y.id === id);
    return product ? `${product.title}${v && v.title !== 'Default' && productVariants(product).length > 1 ? ` · ${v.title}` : ''}` : id;
  };
  const rules = x.conditionalRules || [];
  const overrides = Object.entries(x.variantAdjustments || {});
  return [
    section('Pricing rules', [
      ...(x.pricingRule && x.pricingRule !== 'keep'
        ? [{ text: capital(scopePhrase(x)), note: 'Default price', value: adjustText({ rule: x.pricingRule, valueType: x.valueType, value: x.value }) }]
        : []),
      ...rules.map((r) =>
        ruleField(r) === 'all'
          ? { text: 'All products', value: adjustText(r) }
          : { text: ruleValues(r).join(', ') || 'Nothing selected', note: RULE_TARGET[ruleField(r)], value: adjustText(r) },
      ),
    ]),
    // A fixed price reads as the price ("$6.90"), a discount as one ("12% off").
    section('Product overrides', overrides.map(([id, a]) => ({ text: variantName(id), value: adjustText(a, true) }))),
  ].filter(Boolean);
}
// A new version: its number, the note and a snapshot of the terms (mutates `ag`).
// `version`: its number — by default the next one (a version sent to the buyers and
// approved keeps the number it was sent with).
export function addVersion(db, ag, note, date = TODAY, version = (ag.version || 0) + 1) {
  ag.version = version;
  ag.updatedAt = new Date().toISOString();
  ag.history = [{ version: ag.version, date, note, snapshot: snapshotTerms(db, ag) }, ...(ag.history || [])];
}
// A change to a contract not activated yet (Proposed) — sent to its buyers again, or
// activated with new terms: no new version. Its version takes the new terms (its
// snapshot is taken again), the change goes in its Activities log (`sellerUpdates`
// { version, revision, at, note } — the buyers see it in their B2B Portal), and it
// gets a new revision: the buyers' answers so far no longer count
// (answersTo). Mutates `ag`.
export function logProposalUpdate(db, ag, note) {
  ag.revision = (ag.revision || 0) + 1;
  ag.updatedAt = new Date().toISOString();
  ag.sellerUpdates = [...(ag.sellerUpdates || []), { version: ag.version, revision: ag.revision, at: nowOnToday(), note }];
  const snapshot = snapshotTerms(db, ag);
  ag.history = (ag.history || []).map((h) => (h.version === ag.version && h.snapshot ? { ...h, snapshot } : h));
}
// A version's latest entry with a snapshot — the one that made it (later ones of the
// same version — started, expired, ended, declined — don't carry one); a number sent to
// the buyers again after one they declined, the latest: approved, the one that made it.
export const versionEntry = (ag, version) => (ag?.history || []).find((h) => h.version === version && h.snapshot) || null;
export const versionSnapshot = (ag, version) => versionEntry(ag, version)?.snapshot || null;
// A version history entry's key (its place changes as entries come in).
export const entryKey = (h) => [h.version, h.date, h.note, h.sentAt || ''].join('|');
// A version its buyers didn't approve (logSentVersion), as its entry `h` reads: 'Waiting
// for buyer', 'Declined', 'Expired' — or 'Sent to buyer' (approved since, its entry
// above); null for a version that was in force.
const OUTCOME = { declined: 'Declined', expired: 'Expired' };
export function unapprovedState(ag, h) {
  if (h?.unapproved !== 'sent') return null;
  const list = ag.history || [];
  const newer = list.slice(0, list.findIndex((x) => entryKey(x) === entryKey(h))).reverse();
  const end = newer.find((x) => x.version === h.version && (x.snapshot || OUTCOME[x.unapproved]));
  if (end && !end.snapshot) return OUTCOME[end.unapproved];
  return ag.pending && ag.pending.sentAt === h.sentAt ? 'Waiting for buyer' : 'Sent to buyer';
}
// The contract editor on a version from its version history (`h`, with a snapshot), to
// go on editing from — the version waiting for its buyers as sent, the one in force as
// it is, any other as its snapshot kept it: its name, dates (a started one's start date
// stays), locations and its pricing and limits, staged as the editor's own. What isn't
// in a snapshot stays as it is. { draft, staged, loaded: its key }.
export function draftFromEntry(ag, h) {
  if (h.unapproved === 'sent' && ag.pending?.sentAt === h.sentAt) return { draft: pendingDraft(ag), staged: copyOf(ag.pending.staged || noStagedTerms()), loaded: entryKey(h) };
  if (!h.unapproved && versionEntry(ag, ag.version) === h) return { draft: copyOf(ag), staged: noStagedTerms(), loaded: entryKey(h) };
  const snap = h.snapshot;
  const staged = noStagedTerms();
  const idsOf = (items, map) =>
    (items || []).filter((t) => t.config).map((t) => {
      map[t.id] = { ...copyOf(t.config), contractId: ag.id };
      return t.id;
    });
  const draft = {
    ...pendingDraft(ag),
    name: snap.name,
    ...(ag.status === 'Active' ? {} : { startDate: snap.startDate }),
    endDate: snap.endDate || '',
    ...('locationIds' in snap ? { locationIds: copyOf(snap.locationIds) } : {}),
    terms: { base: idsOf(snap.base, staged.policies), quantity: idsOf(snap.quantity, staged.policies), limits: idsOf(snap.limits, staged.limits) },
  };
  return { draft, staged, loaded: entryKey(h) };
}
// What the contract editor has as edited (its fields and staged pricing and limits), to
// tell whether anything changed since it opened or was last saved (`pristine`).
const EDITED = ['name', 'companyId', 'locationIds', 'applyLater', 'approval', 'startDate', 'endDate', 'timezone', 'terms'];
export const editedOf = (ed) => JSON.stringify({ ...Object.fromEntries(EDITED.map((k) => [k, ed?.draft?.[k] ?? null])), staged: ed?.staged || null });
// The editor's fields as edited, for its saved changes (`unsent`).
export const editedFields = (draft) => copyOf(Object.fromEntries(EDITED.map((k) => [k, draft?.[k] ?? null])));
// Saved in its editor (Save on the save bar) and not activated, saved as a version or
// sent to its buyers yet: `unsent` { fields, staged, at } — what's edited, with its
// pricing and limits as edited. Nothing of it applies and its buyers don't see it; the
// editor opens on it, and Activate, Save as version or Send to buyer go on from it. A
// new contract saved so is a Draft (its status) until then.
// The contract editor opens on its saved changes, over where it would open otherwise
// (editorBaseOf).
export function editorStartOf(ag) {
  const start = editorBaseOf(ag);
  delete start.draft.unsent;
  if (!ag.unsent) return start;
  return { ...start, draft: { ...start.draft, ...copyOf(ag.unsent.fields) }, staged: copyOf(ag.unsent.staged || noStagedTerms()) };
}
// Where the contract editor opens without saved changes: its latest version in its
// version history — the one waiting for its buyers, or one they didn't approve since the
// version in force (declined, closed or expired) — to go on from, else the version in
// force.
export function editorBaseOf(ag) {
  if (ag.pending) {
    const sent = (ag.history || []).find((x) => x.unapproved === 'sent' && x.sentAt === ag.pending.sentAt);
    return { draft: pendingDraft(ag), staged: copyOf(ag.pending.staged || noStagedTerms()), loaded: sent ? entryKey(sent) : null };
  }
  const h = (ag.history || []).find((x) => x.snapshot);
  if (isLive(ag) && h?.unapproved) return draftFromEntry(ag, h);
  return { draft: copyOf(ag), staged: noStagedTerms(), loaded: null };
}
// The seed's version entries name their terms by id: snapshot them on load — a version
// waiting for its buyers with its own fields (`fields`).
export function seedSnapshots(db) {
  (db.agreements || []).forEach((ag) =>
    (ag.history || []).forEach((h) => {
      if (!h.terms || h.snapshot) return;
      h.snapshot = snapshotTerms(db, { ...ag, ...(h.fields || {}), terms: h.terms });
      delete h.terms;
      delete h.fields;
    }),
  );
  return db;
}

// ── Starting and ending ───────────────────────────────────────────────────────
// Take a contract's terms off and close it (mutates `db`).
export function closeAgreement(db, ag, status, note, date = TODAY) {
  if (ag.status === 'Active') unapplyAgreement(db, ag);
  // A version still waiting for its buyers goes with it.
  delete ag.pending;
  ag.status = status;
  ag.history = [{ version: ag.version, date, note }, ...(ag.history || [])];
}
// A contract taking effect: it takes its locations over from the company's Active
// contracts there — one left with none ends (expired already if its end date came
// first), one with others left keeps those as a new version — and its terms go on
// (mutates `db`).
export function takeEffect(db, ag, date = TODAY) {
  const c = companyOf(db, ag);
  activeAgreements(db, ag.companyId)
    .filter((old) => old.id !== ag.id && c && overlaps(c, old, ag))
    .forEach((old) => {
      if (old.endDate && addDay(old.endDate) < date) return closeAgreement(db, old, 'Expired', 'Expired', addDay(old.endDate));
      const kept = keptLocations(c, old, ag);
      if (!kept.length) return closeAgreement(db, old, 'Ended', `Replaced by ${ag.number}`, date);
      // Run out by then: it expires as it is (syncContractDates), with all its locations.
      if (old.endDate && old.endDate < date) return;
      const moved = sharedLocations(c, old, ag);
      unapplyAgreement(db, old);
      old.locationIds = kept.map((l) => l.id);
      applyAgreement(db, old);
      addVersion(db, old, `${namesOf(moved)} moved to ${ag.number}`, date);
    });
  // Scheduled ones starting that day it was saved over (`takesOver`): it runs there —
  // one left with no locations ends before it started, one with others keeps those.
  (ag.takesOver || []).forEach((id) => {
    const old = (db.agreements || []).find((a) => a.id === id);
    if (!c || !old || old.status !== 'Scheduled' || !overlaps(c, old, ag)) return;
    const kept = keptLocations(c, old, ag);
    if (!kept.length) return closeAgreement(db, old, 'Ended', `Replaced by ${ag.number} before it started`, date);
    const moved = sharedLocations(c, old, ag);
    old.locationIds = kept.map((l) => l.id);
    addVersion(db, old, `${namesOf(moved)} moved to ${ag.number}`, date);
  });
  delete ag.takesOver;
  applyAgreement(db, ag);
  ag.status = 'Active';
}

// An Active contract's end date passed: "Expired", and what its buyers didn't approve
// by then — "Expired · extension to Mar 31, 2027 not approved", "Expired · version 3 not
// approved".
function expiredNote(ag) {
  const v = pendingVersionOf(ag);
  if (!v) return 'Expired';
  return v.endDate !== ag.endDate && (!v.endDate || !ag.endDate || v.endDate > ag.endDate)
    ? `Expired · extension to ${v.endDate ? fmtDay(v.endDate) : 'no end date'} not approved`
    : `Expired · version ${v.version} not approved`;
}
// The daily job: start Scheduled contracts whose start date has come (replacing the
// Active one; a new version waiting for their buyers expires) — or expire them, when
// their buyers' request to cancel is still open — expire Active ones whose end date has passed (their terms come off),
// and Proposed ones whose start date passed before they were activated. Mutates `db`.
export function syncContractDates(db) {
  // By start date; on the same day, the ones saved over others first (takesOver).
  (db.agreements || [])
    .filter((ag) => ag.status === 'Scheduled' && liveStatus(ag) === 'Active')
    .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate)) || (b.takesOver?.length ? 1 : 0) - (a.takesOver?.length ? 1 : 0))
    .forEach((ag) => {
      if (ag.status !== 'Scheduled') return; // ended before it started, by one that took over
      // Its buyers' request to cancel it still open on its start date: it doesn't start —
      // it expires (nothing of it applied) and leaves their B2B Portal.
      if (cancelRequestOf(ag)) return closeAgreement(db, ag, 'Expired', 'Expired before it started', ag.startDate);
      // A new version they haven't answered by then keeps waiting: the version they
      // approved starts as it is, and the new one applies once they approve it (as an
      // Active one's) — on the contract as it started (its start date, now fixed).
      if (ag.pending) ag.pending.draft.startDate = ag.startDate;
      // The merchant's request to cancel it, not answered by then, lapses: it starts.
      const asked = endRequestOf(ag);
      if (asked) asked.lapsedAt = ag.startDate;
      takeEffect(db, ag, ag.startDate);
      ag.history = [{ version: ag.version, date: ag.startDate, note: 'Started' }, ...(ag.history || [])];
    });
  (db.agreements || []).forEach((ag) => {
    // A new version waiting for its buyers then goes with it — an extension, or other
    // changes, they didn't approve by its end date.
    if (ag.status === 'Active' && ag.endDate && ag.endDate < TODAY) closeAgreement(db, ag, 'Expired', expiredNote(ag), addDay(ag.endDate));
    // A proposal not activated by its start date expires (nothing of it applied).
    if (ag.status === 'Proposed' && ag.startDate && ag.startDate < TODAY) closeAgreement(db, ag, 'Expired', 'Expired before it was activated', ag.startDate);
  });
  return db;
}

// ── Terms held elsewhere ──────────────────────────────────────────────────────
const locationGets = (c, l, kind, id) => (hasOwnSlot(l, kind) ? slotIds(l, kind) : slotIds(c, kind)).includes(id);
// A live contract's terms that aren't in place: deleted or turned off, or — once
// it's Active — no longer reaching every location it applies to.
export function missingTerms(db, ag) {
  const c = (db.companies || []).find((x) => x.id === ag.companyId);
  if (!c) return [];
  const locs = scopeLocations(c, ag);
  const active = ag.status === 'Active';
  const missing = [];
  KINDS.forEach((kind) => ag.terms[kind].forEach((id) => {
    const p = (db.policies || []).find((x) => x.id === id);
    const reaches = locs.length ? locs.every((l) => locationGets(c, l, kind, id)) : slotIds(c, kind).includes(id);
    if (!p || p.status === 'Inactive' || (active && !reaches)) missing.push(id);
  }));
  ag.terms.limits.forEach((id) => {
    const l = (db.limits || []).find((x) => x.id === id);
    const reaches = (loc) => ['company', 'location'].includes(limitLevel(l, c.id, loc.id));
    const covered = l && (locs.length ? locs.every(reaches) : (l.companyIds || []).includes(c.id));
    if (!l || l.status !== 'Active' || isD2CLimit(l) || (active && !covered)) missing.push(id);
  });
  return missing;
}
// The live contracts `next` leaves without a term `prev` had in place — a pricing or
// limit taken off, turned off or deleted outside the contract.
export function newlyBroken(prev, next) {
  return (next.agreements || []).filter(isLive).filter((ag) => {
    const before = (prev.agreements || []).find((a) => a.id === ag.id);
    const was = before && isLive(before) ? missingTerms(prev, before) : [];
    return missingTerms(next, ag).some((id) => !was.includes(id));
  });
}
// The live contracts holding a pricing or limit. None in a version without
// Contracts, so nothing outside them shows or locks for one.
export const contractsHolding = (db, id) =>
  versionFlags().agreements ? (db.agreements || []).filter((a) => isLive(a) && termIds(a).includes(id)) : [];
// The Active contracts giving a company — or any of these locations — a pricing.
export function contractsGiving(db, company, id, locationIds = null) {
  if (!versionFlags().agreements) return [];
  return (db.agreements || []).filter(
    (a) => a.status === 'Active' && a.companyId === company.id && termIds(a).includes(id) && (!locationIds || locationIds.some((l) => appliesAt(company, a, l))),
  );
}
// The Active contract giving a company — or one of its locations — a pricing or limit.
export function contractGiving(db, company, id, locationId = null) {
  if (!versionFlags().agreements) return null;
  return (
    (db.agreements || []).find(
      (a) => a.status === 'Active' && a.companyId === company.id && termIds(a).includes(id) && (!locationId || appliesAt(company, a, locationId)),
    ) || null
  );
}
// "CT-301 · ABC Construction", for the contracts holding something.
export const contractNames = (db, list) =>
  list.map((a) => `${a.number} · ${(db.companies || []).find((c) => c.id === a.companyId)?.name || 'Company'}`).join(', ');
// A contract's own pricing or limit? None in a version without Contracts.
export const isContractTerm = (x) => !!x?.forContracts && !!versionFlags().agreements;
// The same pricing or limit, leaving out what its contract sets (where a limit applies).
const TERM_PLACED = ['companyIds', 'locationKeys', 'contractAt', 'contractId', 'createdAt', 'updatedAt'];
const canon = (v) =>
  Array.isArray(v)
    ? v.map(canon)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.keys(v).sort().filter((k) => v[k] !== undefined).map((k) => [k, canon(v[k])]))
      : v;
export const sameTerm = (a, b) => {
  const strip = (x) => Object.fromEntries(Object.entries(x).filter(([k]) => !TERM_PLACED.includes(k)));
  return JSON.stringify(canon(strip(a))) === JSON.stringify(canon(strip(b)));
};

// Terms that won't apply for the contract: turned off. (Their own dates don't
// count: they apply on the contract's.)
export function termWarnings(db, ag) {
  const out = [];
  const check = (x) => {
    if (x && (x.status || 'Active') === 'Inactive') out.push(`${x.name} is turned off`);
  };
  [...ag.terms.base, ...ag.terms.quantity].forEach((id) => check(db.policies.find((p) => p.id === id)));
  ag.terms.limits.forEach((id) => check((db.limits || []).find((l) => l.id === id)));
  return out;
}

// What the storefront shows a buyer: each Active contract, the names of its pricing
// and the ids of its order limits — all of them for the contract's whole term,
// whatever their own dates — published by the B2B app, see persistence.js.
export function storefrontContracts(db) {
  return (db.agreements || [])
    .filter((a) => a.status === 'Active')
    .map((a) => {
      const c = (db.companies || []).find((x) => x.id === a.companyId);
      return {
        number: a.number,
        name: a.name,
        version: a.version,
        companyId: a.companyId,
        locationIds: c ? scopeLocationIds(c, a) : a.locationIds,
        dates: agreementDatesLabel(a),
        startDate: a.startDate || null,
        endDate: a.endDate || null,
        pricing: [...a.terms.base, ...a.terms.quantity].map((id) => (db.policies || []).find((p) => p.id === id)).filter(Boolean).map((p) => p.name),
        limitIds: a.terms.limits.filter((id) => (db.limits || []).some((l) => l.id === id)),
      };
    });
}

const nameOf = (list, id) => (list || []).find((x) => x.id === id)?.name || id;

// One line on what changed between two versions, for the version history. `db` has
// `next`'s pricing and limits as edited, `before` `prev`'s.
export function agreementChanges(prev, next, db, before = db) {
  const parts = [];
  // Kept ones edited in the contract editor: "Changed Contract Base", or with its new
  // name "Changed Contract Base (now 2027 Base)".
  const edited = (ids, list, was) =>
    ids.flatMap((id) => {
      const now = (list || []).find((x) => x.id === id);
      const then = (was || []).find((x) => x.id === id);
      if (!now || !then || sameTerm(now, then)) return [];
      return [now.name === then.name ? now.name : `${then.name} (now ${now.name})`];
    });
  const diff = (a, b, list, was) => ({
    added: b.filter((x) => !a.includes(x)).map((x) => nameOf(list, x)),
    removed: a.filter((x) => !b.includes(x)).map((x) => nameOf(was, x)),
    changed: edited(a.filter((x) => b.includes(x)), list, was),
  });
  const all = [
    diff([...prev.terms.base, ...prev.terms.quantity], [...next.terms.base, ...next.terms.quantity], db.policies, before.policies),
    diff(prev.terms.limits, next.terms.limits, db.limits, before.limits),
  ];
  const added = all.flatMap((d) => d.added);
  const removed = all.flatMap((d) => d.removed);
  const changed = all.flatMap((d) => d.changed);
  if (added.length) parts.push(`Added ${added.join(', ')}`);
  if (removed.length) parts.push(`Removed ${removed.join(', ')}`);
  if (changed.length) parts.push(`Changed ${changed.join(', ')}`);
  const c = db.companies.find((x) => x.id === next.companyId);
  if (c && agreementScopeLabel(c, prev) !== agreementScopeLabel(c, next)) parts.push(`Now applies to ${agreementScopeLabel(c, next)}`);
  if (addsLaterLocations(prev) !== addsLaterLocations(next)) {
    parts.push(addsLaterLocations(next) ? 'Enabled auto-apply for new locations' : 'Disabled auto-apply for new locations');
  }
  if (prev.name !== next.name) parts.push(`Renamed to ${next.name}`);
  if ((prev.startDate || '') !== (next.startDate || '')) parts.push(`Now starts ${fmtDay(next.startDate)}`);
  if ((prev.endDate || '') !== (next.endDate || '')) parts.push(next.endDate ? `Now ends ${fmtDay(next.endDate)}` : 'No end date now');
  return parts.join(' · ') || 'No changes to terms';
}
// Saving would change nothing: same name, dates, locations and terms.
export function sameAgreement(a, b, db, before = db) {
  const c = db.companies.find((x) => x.id === b.companyId);
  return agreementChanges(a, b, db, before) === 'No changes to terms' && (!c || agreementScopeLabel(c, a) === agreementScopeLabel(c, b));
}

// Short lines describing the terms, for the agreement document and lists.
export function agreementTermLines(db, ag) {
  const pol = (id) => db.policies.find((p) => p.id === id);
  return {
    base: ag.terms.base.map(pol).filter(Boolean).sort((a, b) => (a.priority || 0) - (b.priority || 0)),
    quantity: ag.terms.quantity.map(pol).filter(Boolean),
    limits: ag.terms.limits.map((id) => (db.limits || []).find((l) => l.id === id)).filter(Boolean).map((l) => ({ limit: l, summary: limitSummary(l, db) })),
  };
}

// "3 pricings · 1 limit" — the terms still in the libraries.
export function agreementTermCount(db, ag) {
  // A Draft's pricing and limits are in its saved changes until it's activated or sent.
  const t = agreementTermLines(ag?.status === 'Draft' ? withStagedTerms(db, ag.unsent?.staged) : db, ag);
  const pricing = t.base.length + t.quantity.length;
  const limits = t.limits.length;
  return [`${pricing} pricing${pricing === 1 ? '' : 's'}`, `${limits} limit${limits === 1 ? '' : 's'}`].join(' · ');
}
