import React from 'react';
import { Modal, BlockStack, InlineStack, Box, Text, Badge, TextField, Divider, Banner, Button, Icon, Avatar, Tooltip, Checkbox } from '@shopify/polaris';
import { SearchIcon, PlusIcon, EditIcon, XIcon, ArrowLeftIcon } from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
import { shopifyCompanyDirectory } from '../data/directory.js';
import { kindOf, scopeTypeLabel } from '../pricing.js';
import { PricingCombobox } from './PricingCombobox.jsx';

// Add a Shopify company to B2B — mirrors the god file's two-modal flow
// ("Add company from Shopify" → "Set up Shopify company"). The Company's Shopify
// Locations all come with it. The Location step is a hub: tick locations → Assign
// pricing → Save returns to the hub, as many rounds as needed, then Review.
// Ticking all gives every location the same pricing (held by the company).
const KIND_META = {
  base: { name: 'Base pricing', purpose: 'The list price B2B buyers pay before quantity breaks.' },
  quantity: { name: 'Quantity pricing', purpose: 'An extra discount as the order quantity grows.' },
};
const kindName = (k) => KIND_META[k].name;
const kindPurpose = (k) => KIND_META[k].purpose;
// Two-letter monogram for the company avatar (e.g. "Watson Co" → "Wa").
const initialsOf = (name) => {
  const clean = (name || '').trim();
  return clean ? clean[0].toUpperCase() + (clean[1] || '').toLowerCase() : '?';
};

export function AddCompanyWizard() {
  const { state, dispatch } = useStore();
  const ac = state.addCompany;
  // Hide the wizard while the pricing editor is open (a "Create a new price"
  // from the Assign pricing step); it reappears on that step once the editor saves or closes.
  if (!ac || state.builder) return null;

  const linkedNames = new Set(state.db.companies.map((c) => c.name));
  const available = Object.values(shopifyCompanyDirectory).filter((shp) => !linkedNames.has(shp.name));
  const chosen = ac.shopifyId ? Object.values(shopifyCompanyDirectory).find((s) => s.id === ac.shopifyId) : null;
  const isEmpty = available.length === 0;
  const hiddenCount = Object.values(shopifyCompanyDirectory).length - available.length;

  const q = (ac.search || '').trim().toLowerCase();
  const filtered = q
    ? available.filter((shp) =>
        [shp.name, ...(shp.locations || []).map((l) => l.name), ...(shp.contacts || []).map((c) => c.email)]
          .join(' ')
          .toLowerCase()
          .includes(q),
      )
    : available;

  const b2bBy = (kind) => state.db.policies.filter((p) => p.audienceType === 'b2b' && kindOf(p) === kind);
  const setupPolicy = (id) => (id ? state.db.policies.find((p) => p.id === id) || null : null);
  const policyName = (id) => setupPolicy(id)?.name || '';

  // Assign-pricing state: base and quantity pricing each hold MANY profiles
  // (multi-select). `createdIds` are profiles built in this flow (they show Edit).
  // `addKind` is the open chooser; its ticked, not-yet-added profiles are `draftIds`.
  const baseIds = ac.baseIds || [];
  const quantityIds = ac.quantityIds || [];
  const idsOf = (k) => (k === 'quantity' ? quantityIds : baseIds);
  const idsKey = (k) => (k === 'quantity' ? 'quantityIds' : 'baseIds');
  const createdIds = ac.createdIds || [];
  const addKind = ac.addKind || null;
  const draftIds = ac.draftIds || [];
  const anyPricing = baseIds.length > 0 || quantityIds.length > 0;
  // An open chooser with an uncommitted selection blocks Continue — Add or Discard first.
  const pending = !!addKind && draftIds.length > 0;

  const patch = (p) => dispatch({ type: 'ADD_COMPANY_PATCH', patch: p });
  const setStep = (step) => dispatch({ type: 'ADD_COMPANY_STEP', step });
  const close = () => dispatch({ type: 'CLOSE_ADD_COMPANY' });
  const openEditor = (policy, k) =>
    dispatch({ type: 'OPEN_EDITOR', policy, kind: k, context: { setupKind: k } });

  // Either kind: open its chooser, add the ticked profiles, remove / edit one.
  // "Create a new" builds exactly one, which joins the list straight away.
  const openAdd = (k) => patch({ addKind: k, draftIds: [] });
  const discardAdd = () => patch({ addKind: null, draftIds: [] });
  const saveAdd = () => patch({ [idsKey(addKind)]: [...new Set([...idsOf(addKind), ...draftIds])], addKind: null, draftIds: [] });
  const removePricing = (k, id) => patch({ [idsKey(k)]: idsOf(k).filter((x) => x !== id), createdIds: createdIds.filter((x) => x !== id) });
  const editPricing = (k, id) => openEditor(setupPolicy(id), k);
  const createNew = (k) => openEditor(null, k);

  const locs = chosen?.locations || [];
  // Locations and their pricing (2+ locations). `locationIds` are the ticked
  // locations the next Assign-pricing round applies to (pre-ticked in step 1, all
  // by default). Each saved round lands in `allPricing` (all ticked: the company
  // holds it, so locations added later get it too) or `locPricing[id]` (some
  // ticked: each of them holds it, over the all-locations one). A company with one
  // location has nothing to pick: step 3's pricing is the company's.
  const multiLoc = locs.length > 1;
  const pickedIds = (ac.locationIds || []).filter((id) => locs.some((l) => l.id === id));
  const allPicked = multiLoc && pickedIds.length === locs.length;
  const allPricing = ac.allPricing || null;
  const locPricing = ac.locPricing || {};
  const hasPricing = (p) => !!p && ((p.baseIds || []).length > 0 || (p.quantityIds || []).length > 0);
  // What a location ends up with, per kind (as the pricing engine resolves it): its
  // own list of a kind if it has one, else the all-locations list of that kind.
  const effectiveOf = (id) => {
    const own = locPricing[id] || {};
    const all = allPricing || {};
    const pick = (k) => ((own[k] || []).length ? own[k] : all[k] || []);
    const p = { baseIds: pick('baseIds'), quantityIds: pick('quantityIds') };
    return hasPricing(p) ? p : null;
  };
  const pricingKey = (p) => (hasPricing(p) ? `${p.baseIds.join(',')}|${p.quantityIds.join(',')}` : '');
  const pricingIds = (p) => [...(p.baseIds || []), ...(p.quantityIds || [])];
  const pricingNames = (p) => pricingIds(p).map(policyName).filter(Boolean).join(' · ');
  const pricedCount = locs.filter((l) => effectiveOf(l.id)).length;
  // Review: locations with identical pricing grouped (in location order).
  const reviewGroups = [];
  locs.forEach((l) => {
    const p = effectiveOf(l.id) || { baseIds: [], quantityIds: [] };
    const key = pricingKey(p);
    let g = reviewGroups.find((x) => x.key === key);
    if (!g) reviewGroups.push((g = { key, pricing: p, locs: [] }));
    g.locs.push(l);
  });
  const toggleLocation = (id, on) =>
    patch({ locationIds: on ? [...new Set([...pickedIds, id])] : pickedIds.filter((x) => x !== id) });
  const toggleAll = (on) => patch({ locationIds: on ? locs.map((l) => l.id) : [] });
  const resetDraft = { baseIds: [], quantityIds: [], addKind: null, draftIds: [] };
  // Open Assign pricing for these locations. When they all hold the same pricing
  // (an Edit, or re-ticking locations on one price), start from it; otherwise from empty.
  const openPricingFor = (ids) => {
    const shared = new Set(ids.map((id) => pricingKey(effectiveOf(id)))).size === 1 ? effectiveOf(ids[0]) : null;
    patch({ ...resetDraft, locationIds: ids, baseIds: shared ? [...shared.baseIds] : [], quantityIds: shared ? [...shared.quantityIds] : [], step: 3 });
  };
  // Edit on a hub row: that location only, starting from its pricing. Saving gives
  // it its own pricing; the other locations keep theirs.
  const editLocationPricing = (id) => openPricingFor([id]);
  // Ticked locations holding different pricing: saving overwrites theirs.
  const replacedNames =
    new Set(pickedIds.map((id) => pricingKey(effectiveOf(id)))).size > 1
      ? locs.filter((l) => pickedIds.includes(l.id) && effectiveOf(l.id)).map((l) => l.name)
      : [];
  // Saving an empty round removes pricing: all ticked clears everything; some
  // ticked clears only their own (they fall back to the all-locations pricing).
  const canRemove = allPicked ? pickedIds.some((id) => effectiveOf(id)) : pickedIds.some((id) => hasPricing(locPricing[id]));
  // Save this round onto the ticked locations, then back to the hub with nothing
  // ticked. All ticked: one company-wide pricing, clearing per-location ones.
  const savePricing = () => {
    const draft = anyPricing ? { baseIds, quantityIds } : null;
    const nextLoc = allPicked ? {} : { ...locPricing };
    if (!allPicked)
      pickedIds.forEach((id) => {
        if (draft) nextLoc[id] = draft;
        else delete nextLoc[id];
      });
    patch({ ...resetDraft, allPricing: allPicked ? draft : allPricing, locPricing: nextLoc, locationIds: [], step: 2 });
    dispatch({ type: 'TOAST', message: draft ? 'Pricing saved' : 'Pricing removed' });
  };
  const cancelPricing = () => patch({ ...resetDraft, step: 2 });
  // Back to step 1 from the hub: a saved round leaves nothing ticked, which would
  // show the company's locations all unticked there — re-tick them all instead.
  const backToCompany = () => patch({ step: 1, locationIds: pickedIds.length ? pickedIds : locs.map((l) => l.id) });
  // A chosen company with one location skips the Location step (Company → Assign
  // pricing → Review). Step numbers stay 1–4 internally.
  const hasLocationStep = !chosen || multiLoc;
  const finalAnyPricing = multiLoc ? pricedCount > 0 : anyPricing;

  // Each step after the first opens with a header row — Back arrow, then title —
  // so the footer holds at most two buttons. Assign pricing for locations has
  // Cancel in the footer instead of Back.
  let header = null;
  let primaryAction;
  let secondaryActions = [];
  if (ac.step === 1) {
    primaryAction = { content: 'Continue', onAction: () => setStep(hasLocationStep ? 2 : 3), disabled: !ac.shopifyId };
    secondaryActions = [{ content: 'Cancel', onAction: close }];
  } else if (ac.step === 2) {
    const n = pickedIds.length;
    const toReview = { content: pricedCount ? 'Review setup' : 'Continue without pricing', onAction: () => setStep(4) };
    primaryAction = n
      ? { content: allPicked ? 'Set pricing for all locations' : `Set pricing for ${n} location${n === 1 ? '' : 's'}`, onAction: () => openPricingFor(pickedIds) }
      : toReview;
    // Ticking some locations means pricing them next — no way around it but
    // Set pricing. Skipping on to Review sits beside it only when all are ticked.
    secondaryActions = allPicked ? [toReview] : [];
    header = { title: chosen?.name, subtitle: 'Set pricing for all locations at once, or a few at a time.', onBack: backToCompany };
  } else if (ac.step === 3 && multiLoc) {
    primaryAction = {
      content: anyPricing ? 'Save pricing' : 'Remove pricing',
      destructive: !anyPricing,
      onAction: savePricing,
      disabled: pending || (!anyPricing && !canRemove),
    };
    secondaryActions = [{ content: 'Cancel', onAction: cancelPricing }];
    header = allPicked
      ? { title: 'Pricing for all locations', subtitle: `${locs.length} locations, including ones added later` }
      : {
          title: `Pricing for ${locs.filter((l) => pickedIds.includes(l.id)).map((l) => l.name).join(', ')}`,
          subtitle: `${pickedIds.length} of ${locs.length} locations`,
        };
  } else if (ac.step === 3) {
    primaryAction = {
      content: anyPricing ? 'Review setup' : 'Continue without pricing',
      onAction: () => setStep(4),
      disabled: pending,
    };
    header = { title: chosen?.name, subtitle: 'Base and quantity pricing can each hold several.', onBack: () => setStep(hasLocationStep ? 2 : 1) };
  } else {
    primaryAction = {
      content: finalAnyPricing ? 'Add company and apply pricing' : 'Add company without pricing',
      onAction: () => dispatch({ type: 'ADD_COMPANY_CONFIRM' }),
    };
    header = { title: 'Review setup', onBack: () => setStep(hasLocationStep ? 2 : 3) };
  }

  return (
    <Modal
      open
      onClose={close}
      title="Set up Shopify company"
      primaryAction={primaryAction}
      secondaryActions={secondaryActions}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {header ? (
            <StepHeader
              title={header.title}
              subtitle={header.subtitle}
              onBack={header.onBack || null}
            />
          ) : null}

          {/* STEP 1 — pick a Shopify company (searchable directory) */}
          {ac.step === 1 &&
            (isEmpty ? (
              <Banner tone="info">Every Shopify company is already in the B2B app.</Banner>
            ) : (
              <BlockStack gap="400">
                {hiddenCount > 0 ? (
                  <Banner tone="info">
                    {`${hiddenCount} ${hiddenCount === 1 ? 'company' : 'companies'} already added ${hiddenCount === 1 ? 'is' : 'are'} hidden.`}
                  </Banner>
                ) : null}
                <TextField
                  label="Search"
                  labelHidden
                  placeholder="Search by company name"
                  value={ac.search || ''}
                  onChange={(v) => patch({ search: v })}
                  prefix={<Icon source={SearchIcon} tone="subdued" />}
                  autoComplete="off"
                />
                <div>
                  <Box paddingBlockEnd="200">
                    <Text as="span" tone="subdued" variant="bodySm">
                      {`Showing ${filtered.length} ${filtered.length === 1 ? 'company' : 'companies'}`}
                    </Text>
                  </Box>
                  <Divider />
                  {filtered.length === 0 ? (
                    <Box paddingBlockStart="300">
                      <Text as="p" tone="subdued">No Shopify company matches your search.</Text>
                    </Box>
                  ) : (
                    filtered.map((shp, idx) => {
                      const sel = ac.shopifyId === shp.id;
                      const main = (shp.contacts || [])[0] || null;
                      const nLoc = (shp.locations || []).length;
                      const nCon = (shp.contacts || []).length;
                      return (
                        <React.Fragment key={shp.id}>
                          {idx > 0 ? <Divider /> : null}
                          <button
                            type="button"
                            onClick={() =>
                              patch(sel ? {} : { shopifyId: shp.id, locationIds: (shp.locations || []).map((l) => l.id), allPricing: null, locPricing: {} })
                            }
                            style={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%' }}
                          >
                            <Box paddingBlock="300">
                              <InlineStack gap="300" blockAlign="center" wrap={false}>
                                <Radio checked={sel} />
                                <Avatar size="md" initials={initialsOf(shp.name)} name={shp.name} />
                                <BlockStack gap="050">
                                  <Text as="span" variant="bodyMd" fontWeight="semibold">{shp.name}</Text>
                                  {main ? (
                                    <Text as="span" tone="subdued" variant="bodySm">{`${main.name} · ${main.email}`}</Text>
                                  ) : null}
                                  <Text as="span" tone="subdued" variant="bodySm">
                                    {`${nLoc} location${nLoc === 1 ? '' : 's'} · ${nCon} contact${nCon === 1 ? '' : 's'}`}
                                  </Text>
                                </BlockStack>
                              </InlineStack>
                            </Box>
                          </button>
                          {/* Location picker under the selected company — pre-ticks the
                              first pricing round. Lined up with the row's text
                              (radio 18 + gap 12 + avatar 32 + gap 12). */}
                          {sel && nLoc > 1 ? (
                            <div style={{ paddingLeft: 74, paddingBottom: 12 }}>
                              <LocationPicker locs={locs} pickedIds={pickedIds} onToggle={toggleLocation} />
                            </div>
                          ) : null}
                        </React.Fragment>
                      );
                    })
                  )}
                  <Divider />
                </div>
                <Text as="p" tone="subdued" variant="bodySm">
                  Select a company to link. You assign its pricing in the next step.
                </Text>
              </BlockStack>
            ))}

          {/* STEP 2 — location hub: tick → Set pricing → Save comes back here */}
          {ac.step === 2 && chosen && (
            <BlockStack gap="300">
              <LocationPicker
                locs={locs}
                pickedIds={pickedIds}
                onToggle={toggleLocation}
                onToggleAll={toggleAll}
                statusOf={(id) => {
                  const p = effectiveOf(id);
                  if (!p) return 'No pricing';
                  return hasPricing(locPricing[id]) ? pricingNames(p) : `${pricingNames(p)} · All locations`;
                }}
                canEdit={(id) => !!effectiveOf(id)}
                onEdit={editLocationPricing}
                note={`${pricedCount} of ${locs.length} with pricing`}
              />
            </BlockStack>
          )}

          {/* STEP 3 — assign pricing (the company's, or the ticked locations') */}
          {ac.step === 3 && (
            <BlockStack gap="300">
              {replacedNames.length ? (
                <Text as="p" tone="caution" variant="bodySm">
                  {`Saving replaces the pricing on ${replacedNames.join(', ')}.`}
                </Text>
              ) : null}
              {multiLoc ? (
                <Text as="p" tone="subdued" variant="bodySm">
                  Base and quantity pricing can each hold several.
                </Text>
              ) : null}

              {/* Added profiles per kind — one compact, scrollable list each (a
                  company can hold many, so keep it dense instead of a card per profile). */}
              {['base', 'quantity'].map((k) =>
                idsOf(k).length > 0 ? (
                  <BlockStack key={k} gap="150">
                    <Text as="span" tone="subdued" variant="bodySm">
                      {`${kindName(k)} · ${idsOf(k).length} pricing`}
                    </Text>
                    <Box borderWidth="025" borderColor="border" borderRadius="200">
                      <div style={{ maxHeight: 224, overflowY: 'auto' }}>
                        {idsOf(k).map((id, idx) => {
                          const p = setupPolicy(id);
                          if (!p) return null;
                          return (
                            <React.Fragment key={id}>
                              {idx > 0 ? <Divider /> : null}
                              <Box paddingInline="300" paddingBlock="200">
                                <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
                                  <Text as="span" variant="bodyMd" fontWeight="medium" truncate>{p.name}</Text>
                                  <InlineStack gap="050" blockAlign="center" wrap={false}>
                                    {createdIds.includes(id) ? (
                                      <Button icon={EditIcon} variant="tertiary" size="micro" accessibilityLabel={`Edit ${p.name}`} onClick={() => editPricing(k, id)} />
                                    ) : null}
                                    <Button icon={XIcon} variant="tertiary" size="micro" tone="critical" accessibilityLabel={`Remove ${p.name}`} onClick={() => removePricing(k, id)} />
                                  </InlineStack>
                                </InlineStack>
                              </Box>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    </Box>
                  </BlockStack>
                ) : null,
              )}

              {/* Chooser | type cards */}
              {addKind ? (
                <PricingChooser
                  kind={addKind}
                  options={b2bBy(addKind).filter((p) => !idsOf(addKind).includes(p.id))}
                  selected={draftIds}
                  onChange={(ids) => patch({ draftIds: ids })}
                  onDiscard={discardAdd}
                  onSave={saveAdd}
                  onCreateNew={() => createNew(addKind)}
                />
              ) : (
                // Grid, so both cards stretch to the taller one's height. Both
                // kinds stay addable — each can hold several.
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                  {['base', 'quantity'].map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => openAdd(k)}
                      style={{ all: 'unset', display: 'block', boxSizing: 'border-box', height: '100%', cursor: 'pointer' }}
                    >
                      <Box padding="300" minHeight="100%" borderWidth="025" borderRadius="200" borderColor="border">
                        <BlockStack gap="050">
                          <Text as="span" variant="bodyMd" fontWeight="medium">{`+ ${kindName(k)}`}</Text>
                          <Text as="span" tone="subdued" variant="bodySm">{kindPurpose(k)}</Text>
                        </BlockStack>
                      </Box>
                    </button>
                  ))}
                </div>
              )}

            </BlockStack>
          )}

          {/* STEP 4 — review */}
          {ac.step === 4 && chosen && (
            <BlockStack gap="300">
              <ReviewBlock head="Company and locations">
                <BlockStack gap="100">
                  <Text as="span" variant="bodyMd" fontWeight="semibold">{chosen.name}</Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {`${locs.length} location${locs.length === 1 ? '' : 's'}, ${(chosen.contacts || []).length} contact${(chosen.contacts || []).length === 1 ? '' : 's'}`}
                  </Text>
                  <Text as="span" tone="subdued" variant="bodySm">
                    {chosen.contacts?.[0]
                      ? `Main contact: ${chosen.contacts[0].name}${chosen.contacts[0].email ? ` (${chosen.contacts[0].email})` : ''}`
                      : 'Main contact: None on this company'}
                  </Text>
                </BlockStack>
              </ReviewBlock>

              <ReviewBlock head="Pricing setup">
                {/* Same shape for every group: who it applies to, then Base and
                    Quantity rows. Locations holding identical pricing share a group,
                    so dozens of locations stay a few groups; past that, it scrolls. */}
                {multiLoc ? (
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    <BlockStack gap="300">
                      {reviewGroups.map((g, i) => (
                        <React.Fragment key={g.key || 'none'}>
                          {i > 0 ? <Divider /> : null}
                          <BlockStack gap="200">
                            <GroupLabel locs={g.locs} total={locs.length} />
                            <PricingRows baseIds={g.pricing.baseIds} quantityIds={g.pricing.quantityIds} policyName={policyName} />
                          </BlockStack>
                        </React.Fragment>
                      ))}
                    </BlockStack>
                  </div>
                ) : (
                  <BlockStack gap="200">
                    <PricingRows baseIds={baseIds} quantityIds={quantityIds} policyName={policyName} />
                  </BlockStack>
                )}
              </ReviewBlock>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// Chooser for either kind: a company can hold several profiles of each, so this
// reuses the company section's multi-select dropdown (PricingCombobox — checkable
// options + removable tags). "Create a new" still builds exactly one and drops it
// straight into the added list.
function PricingChooser({ kind, options, selected, onChange, onDiscard, onSave, onCreateNew }) {
  const label = kindName(kind).toLowerCase();
  const optionLabel = (p) => `${p.name} · Priority ${p.priority ?? '—'} · ${scopeTypeLabel(p)}`;
  return (
    <Box padding="300" background="bg-surface-secondary" borderWidth="025" borderColor="border" borderRadius="200">
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="center" gap="200">
          <Text as="h3" variant="headingSm">{`Add ${label}`}</Text>
          <InlineStack gap="100">
            <Button size="slim" onClick={onDiscard}>Discard</Button>
            <Button variant="primary" size="slim" disabled={!selected.length} onClick={onSave}>
              {selected.length > 1 ? `Add ${selected.length}` : 'Add'}
            </Button>
          </InlineStack>
        </InlineStack>

        {options.length ? (
          <>
            <PricingCombobox
              label={`Use an existing ${label}`}
              placeholder={`Select ${label}`}
              candidates={options}
              selectedIds={selected}
              onChange={onChange}
              optionLabel={optionLabel}
              emptyText={`No matching ${label}`}
            />
            <Text as="p" tone="subdued" variant="bodySm">Pick one or more — the lowest priority applies first.</Text>
          </>
        ) : (
          <Text as="span" tone="subdued" variant="bodySm">
            {`No ${label} serves companies yet, or every one is already added. Create a new one below.`}
          </Text>
        )}

        <BlockStack gap="150">
          {options.length ? (
            <InlineStack align="center">
              <Text as="span" tone="subdued" variant="bodySm">or</Text>
            </InlineStack>
          ) : null}
          <Button icon={PlusIcon} onClick={onCreateNew}>{`Create a new ${label}`}</Button>
        </BlockStack>
      </BlockStack>
    </Box>
  );
}

// Checkbox list of the chosen company's locations. Step 1 uses it to pre-tick the
// first pricing round (picking the company already ticks them all, so no Select
// all there); the Location hub adds Select all (onToggleAll) with a `note`, and
// each location's pricing (statusOf) on the right of its row, with an Edit for
// locations that have some.
function LocationPicker({ locs, pickedIds, onToggle, onToggleAll, note, statusOf, canEdit, onEdit }) {
  const n = pickedIds.length;
  const all = n === locs.length;
  return (
    <Box borderWidth="025" borderColor="border" borderRadius="200" overflowX="hidden" overflowY="hidden">
      {onToggleAll ? (
        <Box paddingInline="300" paddingBlock="200" background="bg-surface-secondary">
          <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
            <Checkbox label="Select all" checked={all ? true : n ? 'indeterminate' : false} onChange={() => onToggleAll(!all)} />
            {note ? <Text as="span" tone="subdued" variant="bodySm">{note}</Text> : null}
          </InlineStack>
        </Box>
      ) : null}
      <div style={{ maxHeight: 280, overflowY: 'auto' }}>
        {locs.map((l, idx) => (
          <React.Fragment key={l.id}>
            {onToggleAll || idx > 0 ? <Divider /> : null}
            <Box paddingInline="300" paddingBlock="200">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                  <Checkbox label={l.name} checked={pickedIds.includes(l.id)} onChange={(on) => onToggle(l.id, on)} />
                </div>
                {statusOf ? (
                  <div style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '60%', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Text as="span" tone="subdued" variant="bodySm" truncate>{statusOf(l.id)}</Text>
                    {onEdit && canEdit(l.id) ? (
                      <Button variant="plain" onClick={() => onEdit(l.id)} accessibilityLabel={`Edit pricing for ${l.name}`}>
                        Edit
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </Box>
          </React.Fragment>
        ))}
      </div>
    </Box>
  );
}

// Back arrow (left) then the title, opening each step after the first — the
// Shopify admin page back-action pattern.
function StepHeader({ title, subtitle, onBack }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {onBack ? (
        <div style={{ flex: '0 0 auto' }}>
          <Button icon={ArrowLeftIcon} variant="tertiary" accessibilityLabel="Back" onClick={onBack} />
        </div>
      ) : null}
      <div style={{ minWidth: 0 }}>
        <BlockStack gap="050">
          <Text as="h2" variant="headingSm" truncate>{title}</Text>
          {subtitle ? <Text as="p" tone="subdued" variant="bodySm">{subtitle}</Text> : null}
        </BlockStack>
      </div>
    </div>
  );
}

// Up to three pricing badges, then +N — the rest show on hover.
function PolicyBadges({ ids, policyName }) {
  return (
    <InlineStack gap="100" blockAlign="center" wrap={false}>
      {ids.slice(0, 3).map((id) => (
        <Badge key={id} tone="success">{policyName(id)}</Badge>
      ))}
      {ids.length > 3 ? (
        <Tooltip content={ids.slice(3).map((id) => policyName(id)).join(', ')}>
          <span style={{ display: 'inline-flex', cursor: 'default' }}>
            <Badge>{`+${ids.length - 3}`}</Badge>
          </span>
        </Tooltip>
      ) : null}
    </InlineStack>
  );
}

// Who a Review group applies to: "All locations (N)", or up to three location
// names, then +N more (the rest on hover).
function GroupLabel({ locs, total }) {
  if (locs.length === total) {
    return <Text as="span" variant="bodyMd" fontWeight="semibold">{`All locations (${total})`}</Text>;
  }
  const rest = locs.slice(3);
  return (
    <InlineStack gap="100" blockAlign="center">
      <Text as="span" variant="bodyMd" fontWeight="semibold">
        {locs.slice(0, 3).map((l) => l.name).join(', ')}
      </Text>
      {rest.length ? (
        <Tooltip content={rest.map((l) => l.name).join(', ')}>
          <span style={{ display: 'inline-flex', cursor: 'default' }}>
            <Badge>{`+${rest.length} more`}</Badge>
          </span>
        </Tooltip>
      ) : null}
    </InlineStack>
  );
}

// Base / Quantity rows for the Review step.
function PricingRows({ baseIds, quantityIds, policyName }) {
  return (
    <>
      <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
        <Text as="span" variant="bodyMd">Base pricing</Text>
        {baseIds.length ? <PolicyBadges ids={baseIds} policyName={policyName} /> : <Badge>Not set</Badge>}
      </InlineStack>
      <InlineStack align="space-between" blockAlign="center" gap="200" wrap={false}>
        <Text as="span" variant="bodyMd">Quantity pricing</Text>
        {quantityIds.length ? <PolicyBadges ids={quantityIds} policyName={policyName} /> : <Badge>Not set</Badge>}
      </InlineStack>
    </>
  );
}

function ReviewBlock({ head, children }) {
  return (
    <Box padding="300" borderWidth="025" borderColor="border" borderRadius="200">
      <BlockStack gap="200">
        <Text as="h3" variant="headingSm">
          {head}
        </Text>
        {children}
      </BlockStack>
    </Box>
  );
}

// Visual-only radio dot for the company rows (the row's <button> owns the click).
function Radio({ checked }) {
  const color = checked ? 'var(--p-color-input-border-active, #303030)' : 'var(--p-color-input-border, #8a8a8a)';
  return (
    <span
      aria-hidden="true"
      style={{
        width: 18,
        height: 18,
        flex: '0 0 auto',
        boxSizing: 'border-box',
        borderRadius: '50%',
        border: `2px solid ${color}`,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} /> : null}
    </span>
  );
}
