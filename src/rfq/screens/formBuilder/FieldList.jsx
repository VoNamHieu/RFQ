import React, { useEffect, useRef, useState } from 'react';
import { Modal } from '../../../shared/wc.jsx';
import {
  STEP_1,
  STEP_2,
  ADD_FIELD_OPTIONS,
  NEW_FIELD,
  fieldIcon,
  TEXT_FIELD_TYPES,
  TEXT_TYPE_LABEL,
  TEXT_TYPE_PLACEHOLDER,
  DEFAULT_VALUE_OPTIONS,
  FIELD_WIDTHS,
  DATE_FORMATS,
  fieldFormType,
  operatorOptions,
  operatorShowsValue,
} from './data.js';
import { COUNTRIES } from './lists.js';
import { useBuilder, fieldsWithText, newId, defaultLang } from './model.js';
import { PlainIconButton, Segmented } from './ui.jsx';

// Custom fields of a step — production Note.jsx (step 2 "Note") and
// InformationFormSetting.jsx (step 1 "Product note"): a draggable list of
// FormItem rows, each opening the AddFieldTranslation editor, plus "Add Field".
export function FieldList({ step }) {
  const { form, edit, ui, setUi, lang } = useBuilder();
  const isStep1 = step === 1;
  const v = ui.variant;
  const [openId, setOpenId] = useState(0);
  const [deleteId, setDeleteId] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);

  useEffect(() => {
    const s = isStep1 ? STEP_1 : STEP_2;
    if (ui.step !== s) setUi({ step: s });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // productNoteFieldId: a failed save opens the field whose label is missing.
  useEffect(() => {
    if (ui.openFieldId) {
      setOpenId(ui.openFieldId);
      setUi({ openFieldId: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ui.openFieldId]);

  const fields = fieldsWithText(form, isStep1 ? STEP_1 : STEP_2, v, lang);

  // The base field list and every language's text map for this step.
  const access = (f) =>
    isStep1
      ? {
          list: () => f.multiple_form[v].information_setting,
          setList: (list) => {
            f.multiple_form[v].information_setting = list;
          },
          textMaps: () => Object.values(f.multiple_form[v].languages).map((l) => (l.information_setting = l.information_setting || {})),
          textMap: (code) => {
            const langs = f.multiple_form[v].languages;
            langs[code] = langs[code] || structuredClone(langs[Object.keys(langs)[0]]);
            langs[code].information_setting = langs[code].information_setting || {};
            return langs[code].information_setting;
          },
        }
      : {
          list: () => f.quote_form_information.form_data,
          setList: (list) => {
            f.quote_form_information.form_data = list;
          },
          textMaps: () => Object.values(f.translations).map((t) => t.form_step_2.quote_form_information.form_data),
          textMap: (code) => f.translations[code].form_step_2.quote_form_information.form_data,
        };

  const addField = (type) => {
    const id = newId();
    const asTextarea = isStep1 && type === 'file';
    const field = { ...NEW_FIELD[asTextarea ? 'text' : type](), id };
    if (asTextarea) {
      Object.assign(field, { label: 'Upload files', type: 'textarea', placeholder: 'Convert files to a URL and paste the link here', is_file: 1 });
    }
    edit((f) => {
      const a = access(f);
      a.setList([...a.list(), field]);
      a.textMaps().forEach((map) => {
        map[id] = { label: field.label || '', placeholder: field.placeholder || '', content: field.content || '', choices: field.choices ? structuredClone(field.choices) : [] };
      });
    });
    setOpenId(id);
  };

  const removeField = () => {
    edit((f) => {
      const a = access(f);
      a.setList(a.list().filter((x) => x.id !== deleteId));
      a.textMaps().forEach((map) => {
        delete map[deleteId];
      });
    });
    setDeleteId(null);
  };

  const move = (fromId, toId) => {
    if (!fromId || fromId === toId) return;
    edit((f) => {
      const a = access(f);
      const list = [...a.list()];
      const from = list.findIndex((x) => x.id === fromId);
      const to = list.findIndex((x) => x.id === toId);
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      a.setList(list);
    });
  };

  return (
    <div className="qfb-panel qfb-panel--fields">
      <div className="qfb-fields">
        {fields.map((field, index) => (
          <div
            key={field.id}
            className={`qfb-field${dragId === field.id ? ' qfb-field--dragging' : ''}${overId === field.id && dragId !== field.id ? ' qfb-field--over' : ''}`}
            draggable={openId !== field.id}
            onDragStart={(e) => {
              setDragId(field.id);
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(field.id));
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (overId !== field.id) setOverId(field.id);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOverId(null);
            }}
            onDrop={(e) => {
              e.preventDefault();
              move(dragId ?? Number(e.dataTransfer.getData('text/plain')), field.id);
              setDragId(null);
              setOverId(null);
            }}
          >
            {index !== 0 && <s-divider />}
            <div className={`qfb-field__head${index === 0 ? ' qfb-field__head--first' : ''}`}>
              <div className="qfb-field__title">
                <s-icon type={fieldIcon(field)} />
                <span className="qfb-truncate">
                  <s-text>{field.label || field.content}</s-text>
                </span>
                {field.use_condition ? <s-badge tone="info">Conditional</s-badge> : null}
              </div>
              <s-stack direction="inline" gap="none">
                <s-button variant="tertiary" icon="edit" accessibilityLabel={`Edit ${field.label || field.content}`} onClick={() => setOpenId(openId === field.id ? 0 : field.id)} />
                <s-button variant="tertiary" icon="delete" accessibilityLabel={`Delete ${field.label || field.content}`} onClick={() => setDeleteId(field.id)} />
              </s-stack>
            </div>
            {openId === field.id && (
              <FieldEditor
                field={field}
                fields={fields}
                isStep1={isStep1}
                showErrors={ui.errors.labels || ui.errors.server}
                onChange={(patch, textPatch) =>
                  edit((f) => {
                    const a = access(f);
                    const isDefault = lang === defaultLang(f);
                    if (textPatch) {
                      const map = a.textMap(lang);
                      map[field.id] = { ...(map[field.id] || {}), ...textPatch };
                    }
                    const base = { ...(patch || {}), ...(textPatch && isDefault ? textPatch : {}) };
                    if (Object.keys(base).length) {
                      a.setList(a.list().map((x) => (x.id === field.id ? { ...x, ...base } : x)));
                    }
                    if (patch?.choices && !textPatch) {
                      // choice count changed (add / delete option): keep every language in step
                      a.textMaps().forEach((map) => {
                        const cur = map[field.id] || {};
                        const prev = cur.choices || [];
                        map[field.id] = { ...cur, choices: patch.choices.map((c, i) => prev[i] || { ...c }) };
                      });
                    }
                  })
                }
                onDeleteChoice={(index2) =>
                  edit((f) => {
                    const a = access(f);
                    a.setList(a.list().map((x) => (x.id === field.id ? { ...x, choices: x.choices.filter((_, i) => i !== index2) } : x)));
                    a.textMaps().forEach((map) => {
                      if (map[field.id]?.choices) map[field.id].choices = map[field.id].choices.filter((_, i) => i !== index2);
                    });
                  })
                }
              />
            )}
          </div>
        ))}
      </div>
      <AddFieldMenu onAdd={addField} />
      {deleteId !== null && (
        <Modal heading="Do you want to delete this field?" size="small" onClose={() => setDeleteId(null)}>
          <s-paragraph>This field is currently linked to PDF, email, and integration settings. Do you want to continue?</s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={removeField}>
            Delete
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeleteId(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

// "Add Field" — plain button + full-width popover of field types (Popover fullWidth + ActionList).
function AddFieldMenu({ onAdd }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className={`qfb-add-field${open ? ' qfb-add-field--active' : ''}`} ref={ref}>
      <PlainIconButton icon="plus-circle" onClick={() => setOpen(!open)}>
        Add Field
      </PlainIconButton>
      {open && (
        <div className="qfb-add-menu" role="menu" aria-label="Add Field">
          {ADD_FIELD_OPTIONS.map((o) => (
            <button
              key={o.name}
              type="button"
              role="menuitem"
              className="qfb-add-menu__item"
              onClick={() => {
                setOpen(false);
                onAdd(o.name);
              }}
            >
              <s-icon type={o.icon} />
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const NONE = '__none__';

// AddFieldTranslation.jsx — the inline field editor.
function FieldEditor({ field, fields, isStep1, showErrors, onChange, onDeleteChoice }) {
  const { input, type } = field;
  const others = fields.filter((x) => x.id !== field.id && x.input !== 'simple');
  const hasTextType = input === 'text' && !['phone', 'country'].includes(type);
  const hasDefault = ['text', 'select', 'date'].includes(input);
  const hasOptions = ['radio', 'select', 'checkbox'].includes(input);
  const hasWidth = input !== 'file';
  const hasLabel = input !== 'simple';
  const hasPlaceholder = !['simple', 'checkbox', 'radio', 'file'].includes(input);
  const hasMinMax = input === 'text' && type === 'number';
  const choices = field.choices || [];
  const text = (key) => (e) => onChange(null, { [key]: e.currentTarget.value });

  return (
    <div className="qfb-field__editor">
      <s-stack gap="small-200">
        {hasTextType && (
          <s-select
            label="Type of Text Field"
            value={type}
            onChange={(e) => {
              const t = e.currentTarget.value;
              if (t === type) return;
              // handleChangeTextFieldType rewrites the base field only; the
              // language texts (what the editor shows) keep their wording.
              onChange({ type: t, label: TEXT_TYPE_LABEL[t], placeholder: TEXT_TYPE_PLACEHOLDER[t] });
            }}
          >
            {TEXT_FIELD_TYPES.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
        )}
        {hasLabel && (
          <s-text-field
            label="Label"
            placeholder="Enter label"
            required
            value={field.label ?? ''}
            error={showErrors && !field.label?.trim() ? 'This field is required.' : undefined}
            onInput={text('label')}
          />
        )}
        {hasPlaceholder && <s-text-field label="Placeholder" placeholder="Enter placeholder" value={field.placeholder ?? ''} onInput={text('placeholder')} />}
        {input === 'simple' && <s-text-area label="Content" placeholder="Enter content" rows={3} value={field.content ?? ''} onInput={text('content')} />}
        {hasMinMax && (
          <>
            <s-number-field label="Min Digit" placeholder="Enter min digit" min={0} max={100} value={String(field.min ?? '')} onInput={(e) => onChange({ min: Number(e.currentTarget.value) })} />
            <s-number-field label="Max Digit" placeholder="Enter max digit" min={1} max={100} value={String(field.max ?? '')} onInput={(e) => onChange({ max: Number(e.currentTarget.value) })} />
          </>
        )}
        {hasDefault && (
          <s-select
            label="Default Value"
            value={field.defaultValue || NONE}
            onChange={(e) => {
              const val = e.currentTarget.value === NONE ? '' : e.currentTarget.value;
              if (val !== (field.defaultValue || '')) onChange({ defaultValue: val });
            }}
          >
            {DEFAULT_VALUE_OPTIONS.map((o) => (
              <s-option key={o.value || NONE} value={o.value || NONE}>
                {o.label}
              </s-option>
            ))}
          </s-select>
        )}
        {hasOptions && (
          <s-stack gap="small-100">
            <s-text>Options value</s-text>
            {choices.map((c, i) => (
              <s-grid key={i} gridTemplateColumns="1fr auto" gap="small-200" alignItems="center">
                <s-text-field
                  label={`Option ${i + 1}`}
                  labelAccessibilityVisibility="exclusive"
                  placeholder="Enter value"
                  value={c.label}
                  error={showErrors && !c.label?.trim() ? 'Please enter your option' : undefined}
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    const next = choices.map((x, j) => (j === i ? { ...x, label: val } : x));
                    onChange(null, { choices: next });
                  }}
                />
                <s-button variant="tertiary" icon="delete" accessibilityLabel={`Delete option ${i + 1}`} onClick={() => onDeleteChoice(i)} />
              </s-grid>
            ))}
            <div className="qfb-mt-4">
              <s-button
                icon="plus"
                tone={!choices.length ? 'critical' : undefined}
                onClick={() => {
                  const label = choices.length ? `New option ${choices.length + 1}` : 'New option';
                  onChange({ choices: [...choices.map((x) => ({ label: x.label, sel: 0 })), { label, sel: 0 }] });
                }}
              >
                New Option
              </s-button>
            </div>
          </s-stack>
        )}
        {hasWidth && <Segmented label="Field Width" options={FIELD_WIDTHS} value={Number(field.width)} onChange={(w) => onChange({ width: w })} />}
        {input === 'file' && (
          <s-checkbox label="Upload multiple files" checked={!!Number(field.multi)} onChange={(e) => onChange({ multi: e.currentTarget.checked ? 1 : 0 })} />
        )}
        {input === 'date' && (
          <s-select label="Date Format" value={field.dateFormat || 'F j, Y'} onChange={(e) => onChange({ dateFormat: e.currentTarget.value })}>
            {DATE_FORMATS.map((o) => (
              <s-option key={o.value} value={o.value}>
                {o.label}
              </s-option>
            ))}
          </s-select>
        )}
        {input === 'date' && (
          <s-checkbox label="Allow date before" checked={field.allowDateBefore !== false} onChange={(e) => onChange({ allowDateBefore: e.currentTarget.checked })} />
        )}
        {input !== 'simple' && (
          <s-checkbox label="Required field" checked={!!Number(field.req)} onChange={(e) => onChange({ req: e.currentTarget.checked ? 1 : 0 })} />
        )}
        {!isStep1 && (
          <>
            <s-checkbox
              label="Set condition to display"
              checked={!!Number(field.use_condition)}
              disabled={!others.length}
              onChange={(e) => {
                const on = e.currentTarget.checked ? 1 : 0;
                if (on && !(field.conditions || []).length) onChange({ use_condition: 1, conditions: [[defaultCondition(others)]] });
                else onChange({ use_condition: on });
              }}
            />
            {!!Number(field.use_condition) && (
              <FieldConditions
                conditions={field.conditions || []}
                others={others}
                onChange={(conditions) => onChange(conditions.length ? { conditions } : { conditions, use_condition: 0 })}
              />
            )}
          </>
        )}
      </s-stack>
    </div>
  );
}

function defaultCondition(others) {
  const f = others[0];
  const t = fieldFormType(f);
  return { formId: f.id, formType: t, operator: operatorOptions(t)[0].value, conditionValue: '' };
}

// Condition.jsx getFieldOptions: "<field type> (<label>)".
function conditionFieldLabel(f) {
  const t = f.is_file ? 'file' : f.input === 'text' ? (['phone', 'country'].includes(f.type) ? f.type : 'text') : f.input;
  const typeText = ADD_FIELD_OPTIONS.find((o) => o.name === t)?.label || '';
  return `${typeText} (${f.label || f.content})`;
}

// FormItem/Condition.jsx — "Select field" / "that" / value, joined by AND.
function FieldConditions({ conditions, others, onChange }) {
  const update = (io, ia, patch) => onChange(conditions.map((g, i) => (i !== io ? g : g.map((c, j) => (j !== ia ? c : { ...c, ...patch })))));
  const remove = (io, ia) => onChange(conditions.map((g, i) => (i !== io ? g : g.filter((_, j) => j !== ia))).filter((g) => g.length));
  const addAnd = (io) => onChange(conditions.map((g, i) => (i !== io ? g : [...g, defaultCondition(others)])));
  return (
    <div className="qfb-conds">
      {conditions.map((group, io) => (
        <div key={io}>
          {io !== 0 && <div className="qfb-conds__join">OR</div>}
          {group.map((c, ia) => {
            const target = others.find((o) => o.id === c.formId) || others[0];
            const isCountry = c.formType === 'country';
            const valueOptions = isCountry
              ? COUNTRIES.map(([value, label]) => ({ value, label }))
              : (target?.choices || []).map((x) => ({ value: x.label, label: x.label }));
            return (
              <div key={ia} className="qfb-conds__item">
                {ia !== 0 && <div className="qfb-conds__join">AND</div>}
                <s-stack gap="small-400">
                  <div className="qfb-conds__field">
                    <s-select
                      label="Select field"
                      value={String(c.formId)}
                      onChange={(e) => {
                        const id = Number(e.currentTarget.value);
                        if (id === c.formId) return;
                        const f = others.find((o) => o.id === id);
                        const t = fieldFormType(f);
                        update(io, ia, { formId: id, formType: t, operator: operatorOptions(t)[0].value, conditionValue: '' });
                      }}
                    >
                      {others.map((o) => (
                        <s-option key={o.id} value={String(o.id)}>
                          {conditionFieldLabel(o)}
                        </s-option>
                      ))}
                    </s-select>
                    <div className="qfb-conds__delete">
                      <s-link tone="critical" onClick={() => remove(io, ia)}>
                        Delete
                      </s-link>
                    </div>
                  </div>
                  <s-select
                    label={c.formType === 'date' ? 'that is' : 'that'}
                    value={c.operator}
                    onChange={(e) => {
                      const op = e.currentTarget.value;
                      if (op !== c.operator) update(io, ia, { operator: op, conditionValue: '' });
                    }}
                  >
                    {operatorOptions(c.formType).map((o) => (
                      <s-option key={o.value} value={o.value}>
                        {o.label}
                      </s-option>
                    ))}
                  </s-select>
                  {operatorShowsValue(c.formType, c.operator) &&
                    (c.formType === 'date' ? (
                      c.operator === 'in_the_next_x_days' ? (
                        <s-number-field
                          label="Enter duration"
                          suffix="days"
                          min={0}
                          inputMode="numeric"
                          value={String(c.conditionValue ?? '')}
                          onInput={(e) => update(io, ia, { conditionValue: Math.max(0, Number(e.currentTarget.value) || 0) })}
                        />
                      ) : (
                        <s-date-field label="Select time" value={c.conditionValue || ''} onChange={(e) => update(io, ia, { conditionValue: e.currentTarget.value })} />
                      )
                    ) : (
                      <ValuePicker
                        options={valueOptions}
                        checkAllLabel={isCountry ? 'Any country' : ''}
                        selected={Array.isArray(c.conditionValue) ? c.conditionValue : []}
                        onChange={(v) => update(io, ia, { conditionValue: v })}
                      />
                    ))}
                  {ia === group.length - 1 && (
                    <div className="qfb-mt-4">
                      <s-button icon="plus" onClick={() => addAnd(io)}>
                        AND
                      </s-button>
                    </div>
                  )}
                </s-stack>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// core/SelectPopover.jsx — a search box (Combobox) listing the values to pick
// (multi-select; "Any country" first for a country field), picked ones as tags.
function ValuePicker({ options, checkAllLabel, selected, onChange }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const all = checkAllLabel ? [{ value: 'all', label: checkAllLabel }, ...options] : options;
  const shown = query ? all.filter((o) => o.label.toLowerCase().includes(query.toLowerCase())) : all;
  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const toggle = (value) => {
    let next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
    if (checkAllLabel && value !== 'all') {
      next = next.filter((v) => v !== 'all');
      if (next.length === options.length) next.push('all');
    }
    onChange(next);
    setQuery('');
  };
  const labelOf = (v) => all.find((o) => o.value === v)?.label || '';
  const tags = checkAllLabel && selected.includes('all') ? ['all'] : selected;
  return (
    <s-stack gap="small">
      <div className="qfb-combo" ref={ref}>
        <s-search-field
          label="Search value"
          placeholder="Search for values"
          value={query}
          onFocus={() => setOpen(true)}
          onInput={(e) => {
            setQuery(e.currentTarget.value);
            setOpen(true);
          }}
        />
        {open && shown.length > 0 && (
          <div className="qfb-combo__list" role="listbox" aria-multiselectable="true" aria-label="Search value">
            {shown.map((o) => {
              const on = selected.includes(o.value) || selected.includes('all');
              return (
                <button
                  key={o.value}
                  type="button"
                  role="option"
                  aria-selected={on}
                  className={`qfb-combo__option${on ? ' qfb-combo__option--selected' : ''}`}
                  onClick={() => toggle(o.value)}
                >
                  <span>{o.label}</span>
                  {on ? <s-icon type="check" /> : null}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {tags.length > 0 && (
        <s-stack direction="inline" gap="small-200">
          {tags.map((v) => (
            <s-clickable-chip key={v} removable accessibilityLabel={`Remove ${labelOf(v)}`} onRemove={() => toggle(v)}>
              {labelOf(v)}
            </s-clickable-chip>
          ))}
        </s-stack>
      )}
    </s-stack>
  );
}
