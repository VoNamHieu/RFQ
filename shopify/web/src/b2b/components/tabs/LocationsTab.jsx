import React, { useState } from 'react';
import { useStore } from '../../store.jsx';
import { shopifyCompanies } from '../../data/directory.js';
import { money } from '../../format.js';
import { Modal } from '../../../shared/wc.jsx';
import { CdSection, cdDate } from '../companyLayout.jsx';
import locationsArt from '../../assets/locations-empty.webp';
import { DevStrip } from '../../../shared/DevStrip.jsx';

// Prototype: the section's dev strip (preview its empty state) shows in production too.
const SHOW_DEV_TOOLS = true;

// Each location with its buyers, orders, all-time revenue and last purchase (its
// orders, as the overview's Sales counts them); the row opens the location.
export function LocationsTab({ company }) {
  const { dispatch } = useStore();
  const [addOpen, setAddOpen] = useState(false);
  // Dev: the section as it is with no locations yet (the company's stay as they are).
  const [devEmpty, setDevEmpty] = useState(false);
  const realLocations = company.locations || [];
  const locations = devEmpty ? [] : realLocations;

  const rows = locations.map((l, index) => {
    const buyers = typeof l.buyers === 'number' ? l.buyers : (company.contacts || []).filter((c) => c.locations === l.name).length;
    const orders = (company.orders || []).filter((o) => o.location === l.name);
    const revenue = orders.reduce((sum, o) => sum + (o.amount || 0), 0);
    const lastDate = orders.reduce((latest, o) => (o.date && String(o.date) > latest ? String(o.date) : latest), '');
    // The row opens the location; its name is the keyboard target (the click bubbles up).
    return (
      <tr key={l.id || index} className="cd-row-link" onClick={() => dispatch({ type: 'OPEN_LOCATION', companyId: company.id, locationId: l.id })}>
        <td>
          <span className="cd-inline">
            <button type="button" className="cd-link-button">{l.name}</button>
            {l.status === 'Deleted' ? <s-badge tone="critical">Deleted</s-badge> : null}
          </span>
        </td>
        <td className="cd-num">{buyers}</td>
        <td className="cd-num">{orders.length}</td>
        <td className="cd-num">{money(revenue)}</td>
        <td>{lastDate ? cdDate(lastDate) : '—'}</td>
      </tr>
    );
  });

  return (
    // Add location on the title row; with none yet, in the card under its grey line instead.
    <CdSection
      title={`Locations (${locations.length})`}
      controls={locations.length ? <s-button onClick={() => setAddOpen(true)}>Add location</s-button> : null}
    >
      {/* While the company has locations: Preview empty / Show data; a note only while
          previewing. */}
      {SHOW_DEV_TOOLS && realLocations.length > 0 ? (
        <DevStrip id="company-locations-empty" spaced>
          <s-stack direction="inline" gap="small-200" alignItems="center">
            <s-badge tone="info">Dev</s-badge>
            {devEmpty ? (
              <s-text fontSize="small" color="subdued">
                Previewing the empty state — this company’s locations still exist.
              </s-text>
            ) : null}
            <s-press-button pressed={devEmpty} onClick={() => setDevEmpty(!devEmpty)}>
              {devEmpty ? 'Show data' : 'Preview empty'}
            </s-press-button>
          </s-stack>
        </DevStrip>
      ) : null}
      {/* None yet: a grey line in the card, as the Orders section's, then Add location. */}
      <div className="cd-card">
        {locations.length ? (
          <div className="cd-table-scroll">
            <table className="cd-table">
              <thead>
                <tr>
                  <th>Location</th>
                  <th className="cd-num">Buyers</th>
                  <th className="cd-num">Orders</th>
                  <th className="cd-num">All-time revenue</th>
                  <th>Last purchase</th>
                </tr>
              </thead>
              <tbody>{rows}</tbody>
            </table>
          </div>
        ) : (
          <div className="cd-card__empty">
            <s-stack gap="small-200" alignItems="center">
              {/* The art at the empty states' size (EmptyBlock's). */}
              <img
                src={locationsArt}
                alt="A shop with a location pin"
                style={{ display: 'block', height: 140, width: 'auto', maxWidth: '100%', objectFit: 'contain', margin: '0 auto' }}
              />
              <span>No locations in this company yet.</span>
              <s-button variant="primary" onClick={() => setAddOpen(true)}>
                Add location
              </s-button>
            </s-stack>
          </div>
        )}
      </div>
      {addOpen && <AddFromShopifyModal company={company} onClose={() => setAddOpen(false)} />}
    </CdSection>
  );
}

// Confirms removing locations from the app (the location page's Delete uses it too).
export function DeleteLocationsModal({ company, locationIds, onClose, onDeleted }) {
  const { dispatch } = useStore();
  const locs = (company.locations || []).filter((l) => locationIds.includes(l.id));
  const n = locs.length;
  return (
    <Modal onClose={onClose} heading={n === 1 ? `Delete ${locs[0].name}?` : `Delete ${n} locations?`}>
      <s-stack gap="small">
        <s-paragraph>
          {n === 1 ? 'This location is' : 'These locations are'} removed from the B2B app, with the pricing assigned to{' '}
          {n === 1 ? 'it' : 'them'}. Locations in Shopify aren't affected.
        </s-paragraph>
        {n > 1 ? (
          <s-unordered-list>
            {locs.map((l) => (
              <s-list-item key={l.id}>{l.name}</s-list-item>
            ))}
          </s-unordered-list>
        ) : null}
      </s-stack>
      <s-button
        slot="primary-action"
        variant="primary"
        tone="critical"
        onClick={() => {
          onClose();
          onDeleted?.();
          dispatch({ type: 'DELETE_LOCATIONS', companyId: company.id, locationIds });
        }}
      >
        {n === 1 ? 'Delete location' : 'Delete locations'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}

// Add location: pick from the company's Shopify locations not in the app yet
// (locations themselves are created in Shopify).
function AddFromShopifyModal({ company, onClose }) {
  const { state, dispatch } = useStore();
  const [picked, setPicked] = useState([]);
  const shp = shopifyCompanies(state.shopifyNewLocations).find((s) => s.id === company.shopifyCompanyId || s.name === company.name);
  const has = (l) => (company.locations || []).some((x) => x.id === l.id || x.name === l.name);
  const remaining = (shp?.locations || []).filter((l) => !has(l));
  // Checkbox handlers always SET from the checkbox's state (change can fire twice).
  const pick = (id, on) => setPicked((ids) => (on ? (ids.includes(id) ? ids : [...ids, id]) : ids.filter((x) => x !== id)));
  const n = picked.length;
  return (
    <Modal onClose={onClose} heading="Add locations from Shopify">
      {remaining.length ? (
        <s-stack gap="small">
          <s-stack gap="small-200">
            {remaining.map((l) => (
              <s-checkbox key={l.id} label={l.name} checked={picked.includes(l.id)} onChange={(e) => pick(l.id, e.currentTarget.checked)} />
            ))}
          </s-stack>
          <s-paragraph color="subdued" fontSize="small">
            All of a location’s information in Shopify syncs over when it’s added, including its contacts.
          </s-paragraph>
        </s-stack>
      ) : (
        <s-paragraph>
          {shp ? `Every Shopify location of ${company.name} is already in the app.` : `${company.name} has no locations in Shopify to add.`}
        </s-paragraph>
      )}
      <s-button
        slot="primary-action"
        variant="primary"
        disabled={n === 0}
        onClick={() => {
          dispatch({ type: 'ADD_SHOPIFY_LOCATIONS', companyId: company.id, shopifyLocationIds: picked });
          onClose();
        }}
      >
        {n > 1 ? `Add ${n} locations` : 'Add location'}
      </s-button>
      <s-button slot="secondary-actions" onClick={onClose}>
        Cancel
      </s-button>
    </Modal>
  );
}
