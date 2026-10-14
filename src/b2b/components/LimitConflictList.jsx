import React from 'react';
import { fmtDay } from '../agreements.js';

// The order-limit conflicts a change would cause (see newConflicts in limits.js),
// one per line with where it happens — and from when, if it starts on a later day
// (a limit's start or end date). Shown before saving, turning on or off or
// deleting a limit, and before activating, saving or ending an agreement.
export function LimitConflictList({ conflicts }) {
  return (
    <s-unordered-list>
      {conflicts.map((c) => (
        <s-list-item key={`${c.audience}-${c.text}-${c.from || ''}`}>
          {c.text}{' '}
          <s-text color="subdued">
            {c.from ? `From ${fmtDay(c.from)}, at` : 'At'} {c.where.length > 3 ? `${c.where.length} ${c.audience === 'd2c' ? 'customer groups' : 'locations'}` : c.where.join(', ')}.
          </s-text>
        </s-list-item>
      ))}
    </s-unordered-list>
  );
}
