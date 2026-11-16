import React, { useState } from 'react';
import { useStore } from '../store.jsx';
import { companyNeedsPrice } from '../pricing.js';
import { REG_STATUS, fullName, fmtDate, registrationDuplicates, isD2CRegistration, registrationLabel } from '../registrations.js';
import { readRegistrationForm, BUILTIN_FIELDS, withoutOptionalNote } from '../../shared/registrationForm.js';
import { ROLE_OPTIONS } from '../components/LocationModals.jsx';
import { Modal } from '../../shared/wc.jsx';
import { CdPageHead, CdSection, StatusDot, SideBlock, SideRow, CardBanner } from '../components/companyLayout.jsx';

// Reviewing one registration: registration → identify buyer → approve (activate)
// → configure pricing. The application is shown in the form's own sections; the
// right column is the decision — approving creates a new Company for the buyer.
// Matches with existing records (see registrationDuplicates) turn the decision into
// a choice: 1. same email, same company → Merge or Decline; 2. same email, another
// company → Merge into it or create the new one (the contact moves — an email
// belongs to one Company only); 3. same company name, new email → Merge or create a
// new company anyway. Every Merge picks a location and a role. A Shopify customer
// with the email is just noted — Approve reuses it.

export function RegistrationDetail() {
  const { state, dispatch } = useStore();
  const reg = (state.db.registrations || []).find((r) => r.id === state.selectedRegistration);
  const [confirm, setConfirm] = useState(null); // 'decline' | 'delete'
  // Match decision: 'merge' | 'create' (cases 2–3), and where a merge lands. The
  // decision buttons (Decline + the primary one) sit at the bottom of the side card.
  const [choice, setChoice] = useState('merge');
  const [mergeCompanyId, setMergeCompanyId] = useState(null);
  const [mergeLocationId, setMergeLocationId] = useState(null);
  const [mergeRole, setMergeRole] = useState(null);

  const back = () => dispatch({ type: 'NAVIGATE', view: 'registrations' });
  if (!reg) {
    return (
      <div className="cd-page">
        <CdPageHead title="Registration" back={{ label: 'Registrations', onAction: back }} />
        <div className="cd-card">
          <div className="cd-card__empty">This registration no longer exists.</div>
        </div>
      </div>
    );
  }

  const name = fullName(reg);
  const label = registrationLabel(reg);
  const d2c = isD2CRegistration(reg);
  const status = REG_STATUS[reg.status];
  const pending = reg.status === 'pending';
  const approve = () => dispatch({ type: 'APPROVE_REGISTRATION', id: reg.id });
  const dup = pending ? registrationDuplicates(state.db, reg) : null;
  // Merge: into which Company (the email's first), at which location, with which role.
  // An email that's already a contact keeps its role (no Role choice); only a new
  // email (case 3) picks one. An existing contact starts from their current location.
  const merge = (() => {
    if (!dup?.blocking) return null;
    const company = dup.mergeTargets.find((c) => c.id === mergeCompanyId) || dup.mergeTargets[0];
    const email = (reg.email || '').trim().toLowerCase();
    const current = (company.contacts || []).find((ct) => (ct.email || '').trim().toLowerCase() === email) || null;
    const locations = company.locations || [];
    const location =
      locations.find((l) => l.id === mergeLocationId) || locations.find((l) => l.name === current?.locations) || locations[0] || null;
    const email0 = (reg.email || '').trim().toLowerCase();
    const existingRole = dup.contactOf
      ? (dup.contactOf.contacts || []).find((ct) => (ct.email || '').trim().toLowerCase() === email0)?.role
      : null;
    const role = existingRole || mergeRole || 'Ordering only';
    return { company, current, location, role };
  })();
  const doMerge = () =>
    dispatch({ type: 'MERGE_REGISTRATION', id: reg.id, companyId: merge.company.id, locationId: merge.location?.id, role: merge.role });
  const primary = !pending
    ? undefined
    : !dup.blocking
      ? { content: 'Approve', onAction: approve }
      : choice === 'create' && dup.kind !== 'same'
          ? { content: d2c ? 'Create D2C customer' : `Create ${reg.company}`, onAction: () => dispatch({ type: 'APPROVE_REGISTRATION', id: reg.id, createNew: true }) }
          : { content: 'Merge', onAction: doMerge };

  // The order page's layout: back (to Registrations) and Delete on top, then two columns
  // — the application on the left, titled above a bordered card; the decision on the side.
  return (
    <div className="cd-page">
      <div className="cd-topbar">
        <button type="button" className="cd-back" onClick={back}>
          <span className="cd-back__circle">
            <s-icon type="chevron-left" />
          </span>
          Registrations
        </button>
        <div className="cd-list-head__actions">
          <s-button tone="critical" onClick={() => setConfirm('delete')}>
            Delete
          </s-button>
        </div>
      </div>

      <div className="cd-layout">
        <div className="cd-main">
          <div className="cd-intro">
            <div>
              <div className="cd-inline">
                <h1 className="cd-title">{label}</h1>
                <StatusDot tone={status.tone}>{status.label}</StatusDot>
              </div>
              <p className="cd-subtitle">{`${d2c ? 'D2C · no company' : name} · submitted ${fmtDate(reg.submittedAt)} from the ${reg.source.toLowerCase()}`}</p>
            </div>
          </div>

          <CdSection title="Application">
            <div className="cd-card">
              {applicationSections(reg).map((sec) => (
                <Section key={sec.key} title={sec.title}>
                  {sec.fields.map((f) => (f.id === 'marketing' ? (
                    <Row key={f.id} label="Email marketing">
                      <s-badge tone="success" icon="email">Subscribed</s-badge>
                    </Row>
                  ) : f.kind === 'textarea' ? (
                    <div key={f.id}>
                      {sec.fields.length > 1 && <span className="cd-row__label">{f.label}</span>}
                      <p className={`cd-answer__text${answerOf(reg, f) ? '' : ' cd-muted'}`}>{answerOf(reg, f) || 'No answer'}</p>
                    </div>
                  ) : (
                    <Row key={f.id} label={f.label} value={answerOf(reg, f)} />
                  )))}
                </Section>
              ))}
            </div>
          </CdSection>
        </div>

        <div className="cd-side">
          {pending && dup.blocking ? (
            <MatchCard
              reg={reg}
              dup={dup}
              choice={choice}
              onChoice={setChoice}
              merge={merge}
              onCompany={(id) => { setMergeCompanyId(id); setMergeLocationId(null); setMergeRole(null); }}
              onLocation={setMergeLocationId}
              onRole={setMergeRole}
              actions={<DecisionActions primary={primary} onDecline={() => setConfirm('decline')} />}
            />
          ) : pending && d2c ? (
            <SideBlock title="Customer">
              <div className="cd-decision">
                <p className="cd-muted">{`No company name, so approving makes ${reg.firstName} a D2C customer in Shopify. No company is created.`}</p>
                <div>
                  <span className="cd-primary">{name}</span>
                  <span className="cd-sub">{reg.email}</span>
                </div>
                {dup.customer ? (
                  <CardBanner>{`Uses the existing Shopify customer ${dup.customer.name} (${reg.email}). Their order history is kept.`}</CardBanner>
                ) : null}
                <DecisionActions primary={primary} onDecline={() => setConfirm('decline')} />
              </div>
            </SideBlock>
          ) : pending ? (
            <SideBlock title="Company">
              <div className="cd-decision">
                <p className="cd-muted">Approving gives {reg.firstName} B2B access through a new company.</p>
                <div>
                  <span className="cd-primary">{reg.company}</span>
                  <span className="cd-sub">{`${name} as the main contact.`}</span>
                </div>
                {dup.customer ? (
                  <CardBanner>{`Uses the existing Shopify customer ${dup.customer.name} (${reg.email}). Their order history is kept.`}</CardBanner>
                ) : null}
                <p className="cd-note">You’ll set up the company’s pricing after approving.</p>
                <DecisionActions primary={primary} onDecline={() => setConfirm('decline')} />
              </div>
            </SideBlock>
          ) : reg.status === 'approved' ? (
            <ApprovedCard reg={reg} />
          ) : (
            <SideBlock title="Decision">
              <SideRow label="Declined">{fmtDate(reg.decidedAt)}</SideRow>
              <p className="cd-side-block__note cd-decision__after">{`${reg.firstName} doesn’t get B2B access or pricing.`}</p>
            </SideBlock>
          )}
        </div>
      </div>

      {confirm && (
        <Modal
          onClose={() => setConfirm(null)}
          heading={confirm === 'decline' ? `Decline ${label}’s registration?` : `Delete ${label}’s registration?`}
        >
          <s-paragraph>
            {confirm === 'decline'
              ? `${name} won’t get B2B access or pricing. The registration moves to Declined.`
              : `This removes the submission from Registrations.${reg.status === 'approved' ? (reg.customerId ? ' The customer it created is kept.' : ' The company it was approved into is kept.') : ''}`}
          </s-paragraph>
          <s-button
            slot="primary-action"
            variant="primary"
            tone="critical"
            onClick={() => {
              dispatch({ type: confirm === 'decline' ? 'DECLINE_REGISTRATIONS' : 'DELETE_REGISTRATIONS', ids: [reg.id] });
              setConfirm(null);
            }}
          >
            {confirm === 'decline' ? 'Decline' : 'Delete'}
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirm(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

// A registration matching existing records — what matches, and the choice:
//   1 'same'    same email, same company  → Merge (or the card's Decline)
//   2 'contact' same email, other company → Merge into it, or create the new company
//                                           (the contact moves — one company per email)
//   3 'company' same name, new email      → Merge into it, or create a new company
// A Merge picks the company (when there are two to choose from), location and role.
function MatchCard({ reg, dup, choice, onChoice, merge, onCompany, onLocation, onRole, actions }) {
  const name = fullName(reg);
  // Same email and company: merge or decline only. A D2C buyer who's a company
  // contact can also leave the company and become a D2C customer.
  const single = dup.kind === 'same';
  const title =
    dup.kind === 'same'
      ? `${name} is already a contact at ${dup.contactOf.name}`
      : dup.kind === 'contact'
        ? `${reg.email} is already a contact at ${dup.contactOf.name}`
        : dup.sameName.length > 1
          ? `${dup.sameName.length} companies named “${dup.company.name}” already exist`
          : `A company named “${dup.company.name}” already exists`;
  const mergeFields = (
    <s-stack gap="small-200">
      {/* Several to pick from (e.g. companies sharing a name): "Company · main contact". */}
      {dup.mergeTargets.length > 1 ? (
        <s-select label="Company" value={merge.company.id} onChange={(e) => onCompany(e.currentTarget.value)}>
          {dup.mergeTargets.map((c) => (
            <s-option key={c.id} value={c.id}>
              {`${c.name} · ${c.mainContact || 'No main contact'}`}
            </s-option>
          ))}
        </s-select>
      ) : null}
      {/* Already a contact there → they keep their location (and role); only someone
          new to this company picks where they land. */}
      {!merge.current && (merge.company.locations || []).length ? (
        <s-select label="Location" value={merge.location?.id || ''} onChange={(e) => onLocation(e.currentTarget.value)}>
          {merge.company.locations.map((l) => (
            <s-option key={l.id} value={l.id}>
              {l.name}
            </s-option>
          ))}
        </s-select>
      ) : null}
      {/* A new email picks a role; an existing contact keeps theirs. */}
      {!dup.contactOf ? (
        <s-select label="Role" value={merge.role} onChange={(e) => onRole(e.currentTarget.value)}>
          {ROLE_OPTIONS.map((r) => (
            <s-option key={r} value={r}>
              {r}
            </s-option>
          ))}
        </s-select>
      ) : null}
      {dup.contactOf && dup.contactOf.id !== merge.company.id ? (
        <CardBanner tone="warning">{`${name} is removed from ${dup.contactOf.name}. An email can only belong to one company.`}</CardBanner>
      ) : null}
    </s-stack>
  );
  const mergeHelp = merge.current
    ? `${reg.firstName} stays at ${merge.company.name}${merge.current.locations ? ` · ${merge.current.locations}` : ''} as ${merge.role}. No new company is created.`
    : dup.contactOf
      ? `${reg.firstName} joins ${merge.company.name} as ${merge.role}. No new company is created.`
      : `${reg.firstName} joins ${merge.company.name} as a contact. No new company is created.`;
  // Nothing to pick when they're already a contact there and there's one company.
  const showMergeFields = dup.mergeTargets.length > 1 || !merge.current;
  const other = isD2CRegistration(reg)
    ? {
        label: 'Create a D2C customer',
        value: 'create',
        renderChildren: (on) =>
          on ? (
            <CardBanner tone="warning">
              {`${name} is removed from ${dup.contactOf.name} and becomes a D2C customer in Shopify, in no company. An email can only belong to one company.`}
            </CardBanner>
          ) : null,
      }
    : dup.kind === 'contact'
        ? {
            label: `Create ${reg.company}`,
            value: 'create',
            renderChildren: (on) =>
              on ? (
                <CardBanner tone="warning">
                  {`${name} is removed from ${dup.contactOf.name} and becomes the main contact of ${reg.company}. An email can only belong to one company.`}
                </CardBanner>
              ) : null,
          }
        : {
            label: `Create a new company named ${reg.company}`,
            value: 'create',
            helpText: `Shopify allows several companies with the same name. ${reg.firstName} becomes its main contact.`,
          };
  const choices = [
    {
      label: 'Merge',
      value: 'merge',
      helpText: mergeHelp,
      renderChildren: (on) => (on && showMergeFields ? mergeFields : null),
    },
    other,
  ];
  return (
    <SideBlock title="Company">
      <div className="cd-decision">
        <CardBanner tone="warning">
          <span className="cd-primary">{title}</span>
          {single ? 'Merge it into their company, or decline it.' : 'Choose how to handle this registration.'}
        </CardBanner>
        {single ? (
          // One path: merge (or Decline, below).
          <s-stack gap="small-200">
            <p>{mergeHelp}</p>
            {showMergeFields ? mergeFields : null}
          </s-stack>
        ) : (
          <s-choice-list
            label="Handle as"
            labelAccessibilityVisibility="exclusive"
            name={`handle-${reg.id}`}
            onChange={(e) => {
              const v = e.currentTarget.values?.[0];
              if (v) onChoice(v);
            }}
          >
            {choices.map((c) => {
              const extra = c.renderChildren ? c.renderChildren(choice === c.value) : null;
              return (
                <s-choice key={c.value} value={c.value} selected={choice === c.value}>
                  {c.label}
                  {c.helpText ? <s-text slot="details">{c.helpText}</s-text> : null}
                  {extra ? (
                    <div slot="secondary-content" style={{ paddingBlockStart: 8 }}>
                      {extra}
                    </div>
                  ) : null}
                </s-choice>
              );
            })}
          </s-choice-list>
        )}
        {actions}
      </div>
    </SideBlock>
  );
}

// The decision, side by side at the bottom of the side card: Decline, then the
// primary action (Approve / Merge / Create …).
function DecisionActions({ primary, onDecline }) {
  return (
    <div className="cd-decision__actions">
      <s-button tone="critical" onClick={onDecline}>
        Decline
      </s-button>
      <s-button variant="primary" onClick={primary.onAction}>
        {primary.content}
      </s-button>
    </div>
  );
}

// After approval: which Company the buyer landed in, and the next step —
// pricing, if the Company doesn't resolve a price yet.
function ApprovedCard({ reg }) {
  const { state, dispatch } = useStore();
  if (reg.customerId) {
    const customer = (state.db.customers || []).find((c) => c.id === reg.customerId);
    return (
      <SideBlock title="Customer">
        <SideRow label="Customer">{customer ? customer.name : fullName(reg)}</SideRow>
        <SideRow label="Approved">{fmtDate(reg.decidedAt)}</SideRow>
        <p className="cd-side-block__note cd-decision__after">
          {customer ? 'D2C customer in Shopify, in no company.' : 'The customer has since been removed.'}
        </p>
      </SideBlock>
    );
  }
  const company = state.db.companies.find((c) => c.id === reg.companyId);
  const openCompany = (tab) => dispatch({ type: 'OPEN_COMPANY', id: company.id, tab });
  const needsPrice = company && companyNeedsPrice(company, state.db.policies, state.db.defaults);
  return (
    <SideBlock title="Company">
      {company ? (
        <>
          <SideRow label="Company">
            <button type="button" className="cd-text-link cd-text-link--body" onClick={() => openCompany('contacts')}>
              {company.name}
            </button>
          </SideRow>
          <SideRow label="Approved">{fmtDate(reg.decidedAt)}</SideRow>
          <div className="cd-decision">
            {needsPrice ? (
              <CardBanner tone="warning" textAction action={{ label: 'Set up pricing', onAction: () => openCompany('pricing') }}>
                <span className="cd-primary">No pricing yet</span>
                {`${reg.firstName} can sign in, but pays storefront prices until this company has pricing.`}
              </CardBanner>
            ) : (
              <s-stack direction="inline">
                <s-button onClick={() => openCompany('pricing')}>Open company</s-button>
              </s-stack>
            )}
          </div>
        </>
      ) : (
        <>
          <SideRow label="Approved">{fmtDate(reg.decidedAt)}</SideRow>
          <p className="cd-side-block__note cd-decision__after">The company has since been removed.</p>
        </>
      )}
    </SideBlock>
  );
}

// The application laid out by the saved registration form — the same config the
// storefront renders — so whatever the merchant put on the form (phone, address,
// custom fields) is what gets reviewed. Headings become sections; answers to
// fields since taken off the form are kept under "Other answers". Email marketing
// shows whenever the buyer ticked it, on the form or not, right under their email.
function applicationSections(reg) {
  const subscribed = answerOf(reg, { id: 'marketing' }) === 'Yes';
  const fields = readRegistrationForm().fields.filter((f) => f.kind !== 'submit' && f.kind !== 'password' && f.id !== 'marketing');
  const sections = [];
  fields.forEach((f) => {
    if (f.kind === 'heading') {
      sections.push({ key: f.id, title: withoutOptionalNote(f.label), fields: [] });
    } else {
      if (!sections.length) sections.push({ key: 'top', title: null, fields: [] });
      sections[sections.length - 1].fields.push(f);
    }
  });
  if (subscribed) {
    if (!sections.length) sections.push({ key: 'top', title: null, fields: [] });
    const sec = sections.find((s) => s.fields.some((f) => f.id === 'email')) || sections[sections.length - 1];
    const at = sec.fields.findIndex((f) => f.id === 'email');
    sec.fields.splice(at === -1 ? sec.fields.length : at + 1, 0, { id: 'marketing', kind: 'checkbox' });
  }
  const onForm = new Set(fields.map((f) => f.id));
  const extra = BUILTIN_FIELDS.filter((f) => !['heading', 'submit', 'password'].includes(f.kind)
    && f.id !== 'marketing' && !onForm.has(f.id) && answerOf(reg, f));
  if (extra.length) sections.push({ key: 'other', title: 'Other answers', fields: extra });
  return sections.filter((sec) => sec.fields.length);
}

// A buyer's answer to one field: storefront submissions carry `values` keyed by
// field id; seeded rows keep the built-in answers at the top level.
function answerOf(reg, f) {
  const v = reg.values?.[f.id] ?? reg[f.id];
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return v == null ? '' : String(v);
}

// One of the form's sections in the application's card, split from the next by a hairline.
function Section({ title, children }) {
  return (
    <div className="cd-answers">
      {title && <h3 className="cd-answers__title">{title}</h3>}
      {children}
    </div>
  );
}

// An answer: its label in grey on the left, the answer on the right.
function Row({ label, value, children }) {
  return (
    <div className="cd-answer">
      <span className="cd-muted">{label}</span>
      <div className="cd-answer__value">{children || <span className={value ? undefined : 'cd-muted'}>{value || '—'}</span>}</div>
    </div>
  );
}
