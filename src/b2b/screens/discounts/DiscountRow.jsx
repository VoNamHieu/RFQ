import React from 'react';
import { Tip, wcTone } from '../../../shared/wc.jsx';
import { DISCOUNT_TYPE_OPTIONS, STATUS_LABEL, STATUS_TONE } from './data.js';

// One discount row (production: features/Discount/components/List/DiscountRow.tsx +
// DiscountRowActions.tsx).

const toDate = (s) => (s ? new Date(s.endsWith('Z') ? s : `${s}Z`) : null);

// The badge status: the merchant's switch plus the schedule (utils/scheduleStatus.ts).
export function deriveDisplayStatus(item, now = new Date()) {
  if (item.status === 'off') return 'off';
  const start = toDate(item.start_date);
  const end = toDate(item.end_date);
  if (start && start > now) return 'scheduled';
  if (end && end < now) return 'off';
  return 'on';
}

// Switched on but past its end date: it can only come back by editing the schedule.
export function isDiscountExpired(item, displayStatus, now = new Date()) {
  const end = toDate(item.end_date);
  return displayStatus === 'off' && end !== null && end < now;
}

export function typeLabel(type) {
  return DISCOUNT_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? type;
}

// Row buttons must not reach the row (its click selects the row).
const act = (e, fn) => {
  e.preventDefault();
  e.stopPropagation();
  fn();
};

const formatCreated = (s) =>
  toDate(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

function RowActions({ id, tipId, displayStatus, isExpired, isToggling, onToggle, onEdit, onDelete }) {
  const toggleLabel = isExpired ? 'Update schedule to enable' : displayStatus === 'off' ? 'Turn on' : 'Turn off';
  return (
    <div className="discounts-actions">
      {isToggling ? (
        <span className="discounts-action-spinner" onClick={(e) => e.stopPropagation()}>
          <s-spinner size="base" accessibilityLabel={toggleLabel} />
        </span>
      ) : isExpired ? (
        // Disabled controls don't raise tooltips, so the locked toggle is a plain icon
        // (a click on it, like on the disabled button, doesn't select the row).
        <span className="discounts-action-locked" onClick={(e) => e.stopPropagation()}>
          <Tip content={toggleLabel}>
            <s-icon type="toggle-off" color="subdued" />
          </Tip>
        </span>
      ) : (
        <>
          <s-clickable accessibilityLabel={toggleLabel} interestFor={`${tipId}-toggle`} onClick={(e) => act(e, () => onToggle(id))}>
            <s-icon type={displayStatus === 'off' ? 'toggle-off' : 'toggle-on'} />
          </s-clickable>
          <s-tooltip id={`${tipId}-toggle`}>{toggleLabel}</s-tooltip>
        </>
      )}
      <s-clickable accessibilityLabel="Edit" interestFor={`${tipId}-edit`} onClick={(e) => act(e, () => onEdit(id))}>
        <s-icon type="edit" />
      </s-clickable>
      <s-tooltip id={`${tipId}-edit`}>Edit</s-tooltip>
      <s-clickable accessibilityLabel="Delete" interestFor={`${tipId}-delete`} onClick={(e) => act(e, () => onDelete(id))}>
        <s-icon type="delete" />
      </s-clickable>
      <s-tooltip id={`${tipId}-delete`}>Delete</s-tooltip>
    </div>
  );
}

export function DiscountRow({ item, tipId, isSelected, onSelect, isToggling, onToggle, onEdit, onDelete, onCopy }) {
  const displayStatus = item.displayStatus;
  return (
    // Like IndexTable.Row with selection on: clicking the row toggles its checkbox.
    <s-table-row clickDelegate={`${tipId}-select`}>
      <s-table-cell>
        <s-checkbox
          id={`${tipId}-select`}
          accessibilityLabel={`Select ${item.name}`}
          checked={isSelected}
          onChange={(e) => onSelect(item.id, e.currentTarget.checked)}
        />
      </s-table-cell>
      <s-table-cell>
        <div className="discounts-name">
          <Tip content={item.name}>{item.name}</Tip>
        </div>
      </s-table-cell>
      <s-table-cell>
        <s-badge tone={wcTone(STATUS_TONE[displayStatus])}>{STATUS_LABEL[displayStatus] ?? displayStatus}</s-badge>
      </s-table-cell>
      <s-table-cell>
        <div className="discounts-code-cell">
          <s-text>{item.code}</s-text>
          <span className="discounts-code-copy">
            <s-clickable accessibilityLabel="Copy code" interestFor={`${tipId}-copy`} onClick={(e) => act(e, () => onCopy(item.code))}>
              <s-icon type="clipboard" />
            </s-clickable>
          </span>
          <s-tooltip id={`${tipId}-copy`}>Copy code</s-tooltip>
        </div>
      </s-table-cell>
      <s-table-cell>
        <span className="discounts-nowrap">{formatCreated(item.created_at)}</span>
      </s-table-cell>
      <s-table-cell>
        <span className="discounts-nowrap">{typeLabel(item.discount_type)}</span>
      </s-table-cell>
      <s-table-cell>{item.used_count}</s-table-cell>
      <s-table-cell>
        <RowActions
          id={item.id}
          tipId={tipId}
          displayStatus={displayStatus}
          isExpired={item.isExpired}
          isToggling={isToggling}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      </s-table-cell>
    </s-table-row>
  );
}
