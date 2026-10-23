import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel, TODAY } from '../../pricing.js';
import {
  openAgreements,
  nextAgreements,
  agreementClashes,
  sharedLocations,
  namesOf,
  canCreateAgreement,
  takenOver,
  takeoverParts,
  joinAnd,
  overlaps,
  agreementScopeLabel,
  agreementTermLines,
  limitsAfterAgreement,
  agreementDatesLabel,
  expiringSoon,
  daysUntil,
  extendedEndDate,
  isLive,
  noTerms,
  termDateBadges,
  followsContractDates,
  fmtDay,
  PAST_STATUSES,
} from '../../agreements.js';
import { newConflicts } from '../../limits.js';
import { LimitConflictList } from '../LimitConflictList.jsx';
import { ContractVersionModal } from '../ContractVersionModal.jsx';
import { withCatalog } from '../LimitEditor.jsx';
import { Modal, wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Inactive: undefined, Expired: undefined, Ended: undefined };

function Line({ main, side, onClick }) {
  return (
    <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small">
      {onClick ? <s-link onClick={onClick}>{main}</s-link> : <s-text>{main}</s-text>}
      {side ? (
        <s-text color="subdued" fontSize="small">
          {side}
        </s-text>
      ) : null}
    </s-grid>
  );
}

// A key fact under the contract's title: a small tile with an icon and label.
function Fact({ icon, label, value }) {
  return (
    <s-box background="subdued" borderRadius="base" padding="small">
      <s-stack gap="small-400">
        <s-stack direction="inline" gap="small-300" alignItems="center">
          <s-icon type={icon} color="subdued" size="small" />
          <s-text color="subdued" fontSize="small">
            {label}
          </s-text>
        </s-stack>
        <s-text fontWeight="semibold">{value}</s-text>
      </s-stack>
    </s-box>
  );
}

// One kind of term (base pricing, quantity pricing, order limits) as a bordered
// list: a header with its count, then a row per term — name over its detail, and
// a side badge (a base pricing's priority). `flags`: where its own dates don't cover
// the contract ("Ends Aug 10, 2026"), beside its name.
function TermGroup({ icon, title, rows }) {
  return (
    <s-box border="base" borderRadius="base" overflow="hidden">
      <s-box background="subdued" paddingBlock="small-300" paddingInline="small">
        <s-stack direction="inline" gap="small-200" alignItems="center">
          <s-icon type={icon} color="subdued" />
          <s-text fontWeight="semibold">{title}</s-text>
          <s-badge>{String(rows.length)}</s-badge>
        </s-stack>
      </s-box>
      {rows.length ? (
        rows.map((r) => (
          <React.Fragment key={r.key}>
            <s-divider />
            <s-box paddingBlock="small-200" paddingInline="small">
              <s-grid gridTemplateColumns="minmax(0, 1fr) auto" alignItems="center" gap="small">
                <s-stack gap="small-500">
                  {r.flags?.length ? (
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <s-text fontWeight="medium">{r.name}</s-text>
                      {r.flags.map((f) => (
                        <s-badge key={f} tone="warning">
                          {f}
                        </s-badge>
                      ))}
                    </s-stack>
                  ) : (
                    <s-text fontWeight="medium">{r.name}</s-text>
                  )}
                  <s-text color="subdued" fontSize="small">
                    {r.detail}
                  </s-text>
                </s-stack>
                {r.side ? <s-badge>{r.side}</s-badge> : <span />}
              </s-grid>
            </s-box>
          </React.Fragment>
        ))
      ) : (
        <>
          <s-divider />
          <s-box paddingBlock="small-200" paddingInline="small">
            <s-text color="subdued">None</s-text>
          </s-box>
        </>
      )}
    </s-box>
  );
}

// Lists that grow over time (version history, past contracts) show the newest
// SHOWN; the link shows the rest, and hides them again.
const SHOWN = 3;
function ShowAllLink({ total, all, onToggle }) {
  return total > SHOWN ? <s-link onClick={onToggle}>{all ? 'Show less' : `Show all (${total})`}</s-link> : null;
}

// The version history as a timeline, newest first. A version that kept a snapshot
// opens as it was.
function VersionTimeline({ history, onView }) {
  const [all, setAll] = useState(false);
  const shown = all ? history : history.slice(0, SHOWN);
  return (
    <s-stack gap="small">
      <s-heading>Version history</s-heading>
      <div>
        {shown.map((h, i) => {
          const last = i === shown.length - 1;
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '12px minmax(0, 1fr)', columnGap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span
                  style={{
                    width: 10,
                    height: 10,
                    marginTop: 5,
                    borderRadius: '50%',
                    flex: '0 0 auto',
                    background: i === 0 ? 'var(--p-color-bg-fill-brand)' : 'var(--p-color-bg-surface)',
                    border: `2px solid ${i === 0 ? 'var(--p-color-bg-fill-brand)' : 'var(--p-color-input-border)'}`,
                  }}
                />
                {last ? null : <span style={{ flex: 1, width: 2, marginBlock: 4, background: 'var(--p-color-border)' }} />}
              </div>
              <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0 }}>
                <s-stack gap="small-500">
                  <s-grid gridTemplateColumns="minmax(0, 1fr) auto" gap="small-200" alignItems="center">
                    {h.snapshot ? <s-link onClick={() => onView(h.version)}>{`Version ${h.version}`}</s-link> : <s-text fontWeight="medium">{`Version ${h.version}`}</s-text>}
                    <s-text color="subdued" fontSize="small">
                      {fmtDay(h.date)}
                    </s-text>
                  </s-grid>
                  <s-text color="subdued">{h.note}</s-text>
                </s-stack>
              </div>
            </div>
          );
        })}
      </div>
      {/* Lined up with the entries' text, past the dots. */}
      <div style={{ paddingLeft: 24 }}>
        <ShowAllLink total={history.length} all={all} onToggle={() => setAll(!all)} />
      </div>
    </s-stack>
  );
}

// One contract as a collapsible row. Closed: its name, status, where it applies,
// dates and version. Open: what isn't applied yet, its key facts, terms and version
// history, with its actions.
function ContractRow({ ag, company, open, onToggle, onEdit, onEnd, onDelete, onView, onDuplicate }) {
  const { state } = useStore();
  const terms = agreementTermLines(state.db, ag);
  const live = isLive(ag);
  const scope = agreementScopeLabel(company, ag);
  // A next contract: what it does to the Active ones at its locations when it starts.
  const takeover = ag.status === 'Active' ? '' : joinAnd(takeoverParts(state.db, ag));
  const when = ag.startDate > TODAY ? `on ${fmtDay(ag.startDate)}` : 'right away';
  const note =
    ag.status === 'Scheduled'
      ? takeover
        ? `On ${fmtDay(ag.startDate)} it ${takeover}.`
        : `Starts ${fmtDay(ag.startDate)}, not applied yet.`
      : ag.status === 'Inactive'
        ? takeover
          ? `Not applied yet. Once activated, it ${takeover} ${when}.`
          : 'Not applied yet.'
        : null;
  const summary = [scope, agreementDatesLabel(ag), ag.version ? `Version ${ag.version}` : null].filter(Boolean).join(' · ');
  const history = ag.history || [];
  const title = `${ag.number} · ${ag.name || 'Untitled contract'}`;
  // A term whose own dates don't cover the contract is marked — it stays in the
  // contract, nothing is blocked and no version is added. One applied on the
  // contract's dates instead says so in its detail.
  const flags = (x) => termDateBadges(x, ag);
  const detail = (x, d) => (followsContractDates(ag, x.id) ? `${d} · Uses the contract’s dates` : d);

  return (
    <s-stack gap="base">
      <s-grid gridTemplateColumns="auto minmax(0, 1fr) auto" alignItems="center" gap="small-200">
        <s-button
          variant="tertiary"
          icon={open ? 'chevron-down' : 'chevron-right'}
          accessibilityLabel={open ? `Collapse ${ag.number}` : `Expand ${ag.number}`}
          onClick={onToggle}
        />
        {/* The title toggles too; the chevron is its keyboard-reachable control. */}
        <div role="presentation" onClick={onToggle} style={{ cursor: 'pointer', minWidth: 0 }}>
          <s-stack gap="small-500">
            <s-stack direction="inline" gap="small-200" alignItems="center">
              <s-text fontWeight="semibold">{title}</s-text>
              <s-badge tone={wcTone(STATUS_TONE[ag.status])}>{ag.status}</s-badge>
              {noTerms(ag) ? <s-badge tone="warning">No terms</s-badge> : null}
            </s-stack>
            {open ? null : (
              <s-text color="subdued" fontSize="small">
                {summary}
              </s-text>
            )}
          </s-stack>
        </div>
        {open ? (
          <s-stack direction="inline" gap="small-200">
            {live ? (
              <s-button tone="critical" variant="tertiary" onClick={() => onEnd(ag)}>
                End contract
              </s-button>
            ) : (
              <s-button tone="critical" variant="tertiary" onClick={() => onDelete(ag)}>
                Delete contract
              </s-button>
            )}
            <s-button onClick={() => onDuplicate(ag)}>Duplicate</s-button>
            {live ? (
              <s-button onClick={() => onEdit(ag)}>Edit</s-button>
            ) : (
              <s-button variant="primary" onClick={() => onEdit(ag)}>
                Review and activate
              </s-button>
            )}
          </s-stack>
        ) : (
          <span />
        )}
      </s-grid>

      {open ? (
        <s-stack gap="base">
          {note ? <s-paragraph color="subdued">{note}</s-paragraph> : null}
          <s-query-container>
            <s-grid gridTemplateColumns="@container (inline-size > 480px) 1fr 1fr 1fr, 1fr" gap="small">
              <Fact icon="clock" label="Version" value={ag.version ? String(ag.version) : '—'} />
              <Fact icon="location" label="Applies to" value={scope} />
              <Fact icon="calendar" label="Dates" value={agreementDatesLabel(ag)} />
            </s-grid>
          </s-query-container>

          <s-query-container>
            <s-grid gridTemplateColumns={history.length ? '@container (inline-size > 760px) 2fr 1fr, 1fr' : '1fr'} gap="large">
              <s-stack gap="small">
                <s-heading>Terms</s-heading>
                <TermGroup
                  icon="receipt-dollar"
                  title="Base pricing"
                  rows={terms.base.map((p) => ({ key: p.id, name: p.name, detail: detail(p, scopeLabel(p)), side: `Priority ${p.priority ?? 0}`, flags: flags(p) }))}
                />
                <TermGroup
                  icon="discount"
                  title="Quantity pricing"
                  rows={terms.quantity.map((p) => ({ key: p.id, name: p.name, detail: detail(p, scopeLabel(p)), flags: flags(p) }))}
                />
                <TermGroup
                  icon="order"
                  title="Order limits"
                  rows={terms.limits.map(({ limit, summary: s }) => ({ key: limit.id, name: limit.name, detail: detail(limit, s), flags: flags(limit) }))}
                />
              </s-stack>
              {history.length ? <VersionTimeline history={history} onView={(version) => onView(ag, version)} /> : null}
            </s-grid>
          </s-query-container>
        </s-stack>
      ) : null}
    </s-stack>
  );
}

// A company's contracts: every one that isn't over (Active, Scheduled ones that don't
// overlap at a location, and any number of drafts), each collapsed until opened — a
// company's only contract starts open — then the past ones.
export function AgreementTab({ company }) {
  const { state, dispatch } = useStore();
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null); // { ag, version }
  const [renewing, setRenewing] = useState(null); // { ag, endDate } while renewing
  const [allPast, setAllPast] = useState(false);
  const [flipped, setFlipped] = useState([]); // contracts opened or closed from how they start
  const contracts = openAgreements(state.db, company.id);
  const isOpen = (id) => (contracts.length === 1) !== flipped.includes(id);
  // Most recently over first: by the date of its last history entry (when it ended or expired).
  const past = (state.db.agreements || [])
    .filter((a) => a.companyId === company.id && PAST_STATUSES.includes(a.status))
    .sort((a, b) => String(b.history?.[0]?.date || '').localeCompare(String(a.history?.[0]?.date || '')));
  const returnTo = { view: 'company', selectedCompany: company.id, companyTab: 'agreement' };
  const edit = (ag) => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', agreementId: ag.id, returnTo });
  const duplicate = (ag) => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', duplicateOf: ag.id, returnTo });
  const view = (ag, version) => setViewing({ ag, version });
  const toggle = (id) => setFlipped((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));
  // A new contract starts with all locations, from the day after the Active and
  // Scheduled contracts there end (defaultStartDate).
  const createContract = () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo });
  // The order-limit conflicts ending it would leave (its limits can stop covering a clash).
  const endConflicts = ending?.status === 'Active' ? newConflicts(withCatalog(state.db), limitsAfterAgreement(state.db, { off: ending })) : [];

  const pastCard = past.length ? (
    <s-section heading="Past contracts">
      <s-stack gap="small-200">
        {(allPast ? past : past.slice(0, SHOWN)).map((a) => (
          <Line key={a.id} main={`${a.number} · ${a.name}`} side={`${a.status} ${fmtDay(a.history?.[0]?.date)} · version ${a.version}`} onClick={() => view(a, a.version)} />
        ))}
        <ShowAllLink total={past.length} all={allPast} onToggle={() => setAllPast(!allPast)} />
      </s-stack>
    </s-section>
  ) : null;
  const viewModal = viewing && (
    <ContractVersionModal ag={viewing.ag} version={viewing.version} onClose={() => setViewing(null)} onDuplicate={duplicate} />
  );

  if (!contracts.length) {
    return (
      <s-stack gap="base">
        <s-section>
          <EmptyBlock
            heading="No contract yet"
            action={{ content: 'Create contract', onAction: () => dispatch({ type: 'OPEN_AGREEMENT_EDITOR', companyId: company.id, returnTo }) }}
          >
            {`Put ${company.name}’s pricing and order limits in one contract. Activating it applies them together, and every change is kept as a version.`}
          </EmptyBlock>
        </s-section>
        {pastCard}
        {viewModal}
      </s-stack>
    );
  }

  const expiring = contracts.filter((a) => expiringSoon(a, state.db));
  // Renewing can't run into a contract set up to start at its locations: a location is
  // in one contract at a time.
  const renewClash = renewing
    ? agreementClashes(state.db, renewing.ag, true, { ...renewing.ag, endDate: renewing.endDate }).filter((a) => a.status === 'Scheduled')
    : [];
  const renewClashLine = (a) => {
    const shared = sharedLocations(company, a, renewing.ag);
    const where = shared.length ? namesOf(shared) : company.name;
    return `${where} ${shared.length > 1 ? 'are' : 'is'} in ${a.number} from ${fmtDay(a.startDate)}. Pick an earlier date, or change ${a.number} first.`;
  };
  const renewError =
    renewing && !(renewing.endDate > renewing.ag.endDate)
      ? 'Must be after the current end date'
      : renewClash.length
        ? renewClashLine(renewClash[0])
        : undefined;
  // Where an ending contract's terms come off: the company, or the locations it has.
  const whereOf = (ag) => (agreementScopeLabel(company, ag) === 'All locations' ? company.name : agreementScopeLabel(company, ag));
  // Ending an Active contract: Scheduled ones at its locations still start. Ending a
  // Scheduled one: the Active ones it would have taken over from stay.
  const stillStarting = ending ? nextAgreements(state.db, company.id).filter((n) => n.status === 'Scheduled' && n.id !== ending.id && overlaps(company, n, ending)) : [];
  const staying = ending?.status === 'Scheduled' ? takenOver(state.db, ending) : [];

  return (
    <s-stack gap="base">
      {/* A live contract left with no terms (No terms): it keeps running, giving nothing. */}
      {contracts.filter(noTerms).map((a) => (
        <s-banner key={`no-terms-${a.id}`} tone="warning" heading={`${a.number} has no terms`}>
          <s-paragraph>{`It has no pricing or order limits left, so it gives ${whereOf(a)} nothing. Add pricing or an order limit to it, or end the contract.`}</s-paragraph>
        </s-banner>
      ))}
      {/* The renewal reminder, per contract: shown from reminderDays before the end
          date, unless a next contract is set to take over. */}
      {expiring.map((a) => {
        const days = daysUntil(a.endDate);
        return (
          <s-banner key={a.id} tone="warning" heading={`${a.number} ends ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`}`}>
            <s-paragraph>{`After ${fmtDay(a.endDate)}, ${whereOf(a)} goes back to the pricing and limits outside the contract. Extend it to keep these terms.`}</s-paragraph>
            <s-button slot="secondary-actions" onClick={() => setRenewing({ ag: a, endDate: extendedEndDate(a) })}>
              Extend
            </s-button>
          </s-banner>
        );
      })}

      <s-section>
        <s-stack gap="small">
          <s-grid gridTemplateColumns="1fr auto" alignItems="center" gap="small-200">
            <s-heading>{`Contracts (${contracts.length})`}</s-heading>
            <s-button disabled={!canCreateAgreement(state.db, company.id)} onClick={createContract}>
              Create contract
            </s-button>
          </s-grid>
          {contracts.map((a, i) => (
            <React.Fragment key={a.id}>
              {i > 0 && <s-divider />}
              <ContractRow
                ag={a}
                company={company}
                open={isOpen(a.id)}
                onToggle={() => toggle(a.id)}
                onEdit={edit}
                onEnd={setEnding}
                onDelete={setDeleting}
                onView={view}
                onDuplicate={duplicate}
              />
            </React.Fragment>
          ))}
        </s-stack>
      </s-section>

      {pastCard}
      {viewModal}

      {renewing && (
        <Modal onClose={() => setRenewing(null)} heading={`Extend ${renewing.ag.number}`}>
          <s-date-field
            label="New end date"
            value={renewing.endDate}
            onChange={(e) => setRenewing({ ...renewing, endDate: e.currentTarget.value })}
            error={renewError}
            details={`The terms stay the same. Saved as version ${renewing.ag.version + 1}.`}
          />
          <s-button
            slot="primary-action"
            variant="primary"
            disabled={!!renewError || !renewing.endDate}
            onClick={() => {
              dispatch({ type: 'RENEW_AGREEMENT', id: renewing.ag.id, endDate: renewing.endDate });
              setRenewing(null);
            }}
          >
            Extend
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setRenewing(null)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {ending && (
        <Modal onClose={() => setEnding(null)} heading={`End ${ending.number}?`}>
          <s-stack gap="small">
            <s-paragraph>
              {ending.status === 'Active'
                ? `Its pricing and order limits come off ${whereOf(ending)} right away. Anything assigned outside the contract stays.${stillStarting
                    .map((n) => ` ${n.number} still starts on ${fmtDay(n.startDate)}.`)
                    .join('')}`
                : `It won’t start on ${fmtDay(ending.startDate)}, and nothing changes for ${company.name}${
                    staying.length ? `: ${joinAnd(staying.map((a) => a.number))} ${staying.length === 1 ? 'stays' : 'stay'} in place` : ''
                  }.`}
            </s-paragraph>
            {endConflicts.length ? (
              <>
                <s-paragraph>Without them, these order limits conflict:</s-paragraph>
                <LimitConflictList conflicts={endConflicts} />
              </>
            ) : null}
          </s-stack>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'END_AGREEMENT', id: ending.id });
              setEnding(null);
            }}
          >
            End contract
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setEnding(null)}>
            Cancel
          </s-button>
        </Modal>
      )}

      {deleting && (
        <Modal onClose={() => setDeleting(null)} heading={`Delete ${deleting.number}?`}>
          <s-paragraph>{`The contract is deleted. Nothing changes for ${company.name}.`}</s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: 'DELETE_AGREEMENT', id: deleting.id });
              setDeleting(null);
            }}
          >
            Delete contract
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeleting(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </s-stack>
  );
}
