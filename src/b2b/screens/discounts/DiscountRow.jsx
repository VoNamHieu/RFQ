import React from 'react';
import { Tip } from '../../../shared/wc.jsx';
import { StatusDot } from '../../components/companyLayout.jsx';
import { DISCOUNT_TYPE_OPTIONS, STATUS_LABEL } from './data.js';

// The status dot's tone (production: on → success, scheduled → attention, off → none).
const DOT_TONE = { on: 'success', scheduled: 'attention' };

// One discount row (production: features/Discount/components/List/DiscountRow.tsx +
// DiscountRowActions.tsx), in the company page's table look.

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
    <tr className="cd-row-link" onClick={() => onSelect(item.id, !isSelected)}>
      <td className="cd-check" onClick={(e) => e.stopPropagation()}>
        <s-checkbox
          accessibilityLabel={`Select ${item.name}`}
          checked={isSelected}
          onChange={(e) => onSelect(item.id, e.currentTarget.checked)}
        />
      </td>
      <td>
        <div className="discounts-name cd-primary">
          <Tip content={item.name}>{item.name}</Tip>
        </div>
      </td>
      <td>
        <StatusDot tone={DOT_TONE[displayStatus]}>{STATUS_LABEL[displayStatus] ?? displayStatus}</StatusDot>
      </td>
      <td>
        <div className="discounts-code-cell">
          <span>{item.code}</span>
          <span className="discounts-code-copy">
            <s-clickable accessibilityLabel="Copy code" interestFor={`${tipId}-copy`} onClick={(e) => act(e, () => onCopy(item.code))}>
              <s-icon type="clipboard" />
            </s-clickable>
          </span>
          <s-tooltip id={`${tipId}-copy`}>Copy code</s-tooltip>
        </div>
      </td>
      <td className="cd-nowrap">{formatCreated(item.created_at)}</td>
      <td className="cd-nowrap">{typeLabel(item.discount_type)}</td>
      <td className="cd-num">{item.used_count}</td>
      <td className="cd-actions cd-num" onClick={(e) => e.stopPropagation()}>
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
      </td>
    </tr>
  );
}
