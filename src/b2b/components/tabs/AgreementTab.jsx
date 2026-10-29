import React, { useState } from 'react';
import { EmptyBlock } from '../../../shared/EmptyBlock.jsx';
import { useStore } from '../../store.jsx';
import { scopeLabel } from '../../pricing.js';
import {
  openAgreements,
  lastChange,
  agreementClashes,
  sharedLocations,
  canCreateAgreement,
  agreementAppliesToLabel,
  agreementTermLines,
  agreementDatesLabel,
  expiringSoon,
  daysUntil,
  extendedEndDate,
  isLive,
  fmtDay,
  overlapLines,
  overlapsHeading,
  PAST_STATUSES,
} from '../../agreements.js';
import { ContractVersionModal } from '../ContractVersionModal.jsx';
import { Fact, TermGroup, VersionTimeline, ShowAllLink, SHOWN, EndContractModal, DeleteContractModal } from '../ContractParts.jsx';
import { MenuButton, Modal, wcTone } from '../../../shared/wc.jsx';

const STATUS_TONE = { Active: 'success', Scheduled: 'info', Expired: undefined, Ended: undefined };

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


// One contract as a collapsible row. Closed: its name, status, where it applies,
// dates and version. Open: what isn't applied yet, its key facts, terms and version
// history, with its actions.
function ContractRow({ ag, company, open, onToggle, onEdit, onEnd, onDelete, onView, onDuplicate, onExtend }) {
  const { state } = useStore();
  // The renewal reminder, on the contract it's about: from reminderDays before its end
  // date, unless a next contract is set to take over — a badge by its title while it's
  // closed, and under its dates with Extend once it's open.
  const soon = expiringSoon(ag, state.db);
  const days = soon ? daysUntil(ag.endDate) : null;
  const endsIn = days === 0 ? 'Ends today' : days === 1 ? 'Ends tomorrow' : `Ends in ${days} days`;
  const terms = agreementTermLines(state.db, ag);
  const live = isLive(ag);
  const scope = agreementAppliesToLabel(company, ag);
  // A next contract: when it starts — "Starts Feb 1, 2027, not applied yet."
  const note = ag.status === 'Scheduled' ? `Starts ${fmtDay(ag.startDate)}, not applied yet.` : null;
  const summary = [scope, agreementDatesLabel(ag), ag.version ? `Version ${ag.version}` : null].filter(Boolean).join(' · ');
  const history = ag.history || [];
  const title = `${ag.number} · ${ag.name || 'Untitled contract'}`;

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
              {soon && !open ? <s-badge tone="warning">{endsIn}</s-badge> : null}
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
            {/* End contract, and for a Scheduled one (nothing is applied yet) Delete
                contract too, under "…". */}
            {live ? (
              <MenuButton
                icon="menu-horizontal"
                variant="tertiary"
                accessibilityLabel={`More actions for ${ag.number}`}
                items={[
                  { content: 'End contract', destructive: true, onAction: () => onEnd(ag) },
                  ag.status === 'Scheduled' && { content: 'Delete contract', destructive: true, onAction: () => onDelete(ag) },
                ]}
              />
            ) : null}
            <s-button onClick={() => onDuplicate(ag)}>Duplicate</s-button>
            <s-button onClick={() => onEdit(ag)}>Edit</s-button>
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
              <Fact icon="calendar" label="Dates" value={agreementDatesLabel(ag)}>
                {soon ? (
                  <s-stack direction="inline" gap="small-200" alignItems="center">
                    <s-badge tone="warning">{endsIn}</s-badge>
                    <s-link onClick={() => onExtend(ag)}>Extend</s-link>
                  </s-stack>
                ) : null}
              </Fact>
            </s-grid>
          </s-query-container>

          <s-query-container>
            <s-grid gridTemplateColumns={history.length ? '@container (inline-size > 760px) 2fr 1fr, 1fr' : '1fr'} gap="large">
              <s-stack gap="small">
                <s-heading>Terms</s-heading>
                <TermGroup
                  icon="receipt-dollar"
                  title="Base pricing"
                  rows={terms.base.map((p) => ({ key: p.id, name: p.name, detail: scopeLabel(p), side: `Priority ${p.priority ?? 0}` }))}
                />
                <TermGroup
                  icon="discount"
                  title="Quantity pricing"
                  rows={terms.quantity.map((p) => ({ key: p.id, name: p.name, detail: scopeLabel(p) }))}
                />
                <TermGroup
                  icon="order"
                  title="Order limits"
                  rows={terms.limits.map(({ limit, summary: s }) => ({ key: limit.id, name: limit.name, detail: s }))}
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

// A company's contracts: every one that isn't over (Active and Scheduled), each
// collapsed until opened — a company's only contract starts open — then the past ones.
export function AgreementTab({ company }) {
  const { state, dispatch } = useStore();
  const [ending, setEnding] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [viewing, setViewing] = useState(null); // { ag, version }
  const [renewing, setRenewing] = useState(null); // { ag, endDate } while renewing
  const [allPast, setAllPast] = useState(false);
  const [flipped, setFlipped] = useState([]); // contracts opened or closed from how they start
  // Active ones first, then the rest; each by latest change, newest first.
  const contracts = openAgreements(state.db, company.id).sort(
    (a, b) => (b.status === 'Active') - (a.status === 'Active') || lastChange(b).localeCompare(lastChange(a)),
  );
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

  // Extending into a contract set up to start at its locations is allowed: a yellow
  // Overlaps banner says so — the one that starts later runs there from its start date
  // (takeEffect), and this one ends or gives up those locations then.
  const renewOverlaps = renewing
    ? agreementClashes(state.db, renewing.ag, true, { ...renewing.ag, endDate: renewing.endDate })
        .filter((a) => a.status === 'Scheduled')
        .map((a) => ({ old: a, shared: sharedLocations(company, a, renewing.ag) }))
    : [];
  const renewError = renewing && !(renewing.endDate > renewing.ag.endDate) ? 'Must be after the current end date' : undefined;

  return (
    <s-stack gap="base">
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
                onExtend={(ag) => setRenewing({ ag, endDate: extendedEndDate(ag) })}
              />
            </React.Fragment>
          ))}
        </s-stack>
      </s-section>

      {pastCard}
      {viewModal}

      {renewing && (
        <Modal onClose={() => setRenewing(null)} heading={`Extend ${renewing.ag.number}`}>
          <s-stack gap="base">
            <s-date-field
              label="New end date"
              value={renewing.endDate}
              onChange={(e) => setRenewing({ ...renewing, endDate: e.currentTarget.value })}
              error={renewError}
              details={`The terms stay the same. Saved as version ${renewing.ag.version + 1}.`}
            />
            {renewOverlaps.length ? (
              <s-banner tone="warning" heading={overlapsHeading(renewOverlaps.length)}>
                <s-stack gap="small-200">
                  <s-paragraph>{`These overlap with ${renewing.ag.number}:`}</s-paragraph>
                  <s-unordered-list>
                    {overlapLines(company, renewOverlaps).map((line) => (
                      <s-list-item key={line}>{line}</s-list-item>
                    ))}
                  </s-unordered-list>
                  <s-paragraph>If you extend it, the contract that starts later runs where they overlap, and the other one ends or gives up those locations.</s-paragraph>
                </s-stack>
              </s-banner>
            ) : null}
          </s-stack>
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

      {ending && <EndContractModal ag={ending} onClose={() => setEnding(null)} />}
      {deleting && <DeleteContractModal ag={deleting} onClose={() => setDeleting(null)} />}
    </s-stack>
  );
}
