import React, { useEffect, useState } from 'react';
import { Modal, useWcId } from '../../../shared/wc.jsx';
import { STEP_1, STEP_2, EMPTY_STATE, STEP1_ATTRIBUTES, STEP2_SECTIONS, CONDITION_TYPE_LABEL, PANEL_TITLES } from './data.js';
import { useBuilder, step2, step1Lang, newId } from './model.js';
import { DetailHeader, PlainIconButton } from './ui.jsx';
import {
  DisplayConditionPanel,
  ProductFieldsPanel,
  ButtonStep1Panel,
  SubmitButtonPanel,
  CustomerInfoPanel,
  FormAttributePanel,
  EmptyStatePanel,
  BehaviorPanel,
} from './panels.jsx';
import { FieldList } from './FieldList.jsx';

// Element tab (FormSetting/ElementSetting): the "Form Elements" tree, or the
// detail panel of the element the merchant opened.
export function ElementTab() {
  const { ui } = useBuilder();
  return ui.detail ? <SettingDetail /> : <FormElements />;
}

function FormElements() {
  const { form, edit, ui, setUi, lang, openPanel } = useBuilder();
  const [open, setOpen] = useState(ui.step);
  const [hoverStep1, setHoverStep1] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => setOpen(ui.step), [ui.step]);

  const hasStep1 = form.multiple_form.length > 0;
  const s1 = step1Lang(form, 0, lang);
  const items = [
    { id: STEP_1, title: s1?.quote_form_header.popup_header_list_quote ?? 'Step 1: Product Inquiry', chevron: true },
    { id: STEP_2, title: step2(form, lang).quote_form_header.popup_header_list_quote ?? 'Step 2: Contact Info', chevron: true },
    { id: EMPTY_STATE, title: 'Empty state', chevron: false },
  ];

  // ElementSetting handleAddVariant — the first form shows for any product.
  const addStep1 = () => {
    edit((f) => {
      const languages = {};
      Object.keys(f.translations).forEach((code) => {
        languages[code] = {
          footer_setting: { submitting_quote_mess: 'Submit Request' },
          quote_form_header: { popup_shopping_mess: 'Continue Shopping', popup_header_list_quote: 'Step 1: Product Inquiry' },
          information_setting: {},
        };
      });
      f.multiple_form.push({
        id: newId(),
        name: 'Form 1',
        is_default: 1,
        type_condition: 'all',
        manual_condition: [],
        automatically_condition: [],
        quote_form_bottom: { submitting_position: 'right' },
        display_setting: { type_form: 'popup' },
        information_setting: [],
        languages,
      });
    });
    // handleAddVariant only resets the variant: the open section stays as it was.
    setUi({ variant: 0 });
  };

  const deleteStep1 = () => {
    edit((f) => {
      f.multiple_form = [];
    });
    setConfirmDelete(false);
    if (ui.step === STEP_1) setUi({ step: STEP_2 });
  };

  return (
    <div className="qfb-pad">
      <s-heading>Form Elements</s-heading>
      <div className="qfb-elements">
        {items.map((item) =>
          item.id === STEP_1 && !hasStep1 ? (
            <div key={item.id} className="qfb-el-item">
              <s-stack gap="base">
                <s-paragraph color="subdued">
                  Adding step 1 if you need customers to fill detail inquiry for products before adding to quote
                </s-paragraph>
                <div>
                  <PlainIconButton icon="plus-circle" onClick={addStep1}>
                    Add step 1
                  </PlainIconButton>
                </div>
              </s-stack>
            </div>
          ) : (
            <div key={item.id} className="qfb-el-item">
              <div
                className="qfb-step-title"
                role="button"
                tabIndex={0}
                aria-expanded={item.chevron ? open === item.id : undefined}
                onMouseEnter={() => item.id === STEP_1 && setHoverStep1(true)}
                onMouseLeave={() => item.id === STEP_1 && setHoverStep1(false)}
                onClick={() => {
                  if (item.id === EMPTY_STATE) {
                    setUi({ step: EMPTY_STATE });
                    openPanel('emptyState');
                    return;
                  }
                  setOpen(open === item.id ? null : item.id);
                  setUi({ step: item.id });
                }}
              >
                <span className="qfb-chev">{item.chevron ? <s-icon type={open === item.id ? 'chevron-up' : 'chevron-down'} /> : null}</span>
                <s-icon type="folder" />
                <span className="qfb-step-title__text">
                  <s-text fontWeight="medium">{item.title}</s-text>
                </span>
                {item.id === STEP_1 && hoverStep1 ? (
                  <span onClick={(e) => e.stopPropagation()}>
                    <s-button variant="tertiary" tone="critical" icon="delete" accessibilityLabel="Delete step 1" onClick={() => setConfirmDelete(true)} />
                  </span>
                ) : null}
              </div>
              {item.id === STEP_1 && open === STEP_1 && <Step1Forms />}
              {item.id === STEP_2 && open === STEP_2 && <Step2Sections />}
            </div>
          ),
        )}
      </div>
      {confirmDelete && (
        <Modal heading="Do you want to delete Step 1?" size="small" onClose={() => setConfirmDelete(false)}>
          <s-paragraph>
            This action may modify certain settings beyond your storefront and cannot be undone. Please proceed with caution.
          </s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={deleteStep1}>
            Delete
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setConfirmDelete(false)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </div>
  );
}

// ElementSetting/Step1 — the step-1 forms (one per product group) and their attributes.
function Step1Forms() {
  const { form, edit, ui, setUi, openPanel } = useBuilder();
  const tipId = useWcId('qfb-s1');
  const [expanded, setExpanded] = useState(true);
  const [deleteIndex, setDeleteIndex] = useState(null);
  const forms = form.multiple_form;

  const nameOf = (mf, i) => (mf.name !== '' ? mf.name : `Form ${i + 1}`);

  const addForm = () => {
    edit((f) => {
      const first = f.multiple_form[0];
      const languages = {};
      Object.keys(f.translations).forEach((code) => {
        const h = first?.languages?.[code]?.quote_form_header;
        languages[code] = {
          footer_setting: { submitting_quote_mess: 'Add To Quote' },
          quote_form_header: {
            popup_shopping_mess: h?.popup_shopping_mess ?? 'Continue Shopping',
            popup_header_list_quote: h?.popup_header_list_quote ?? 'Step 1: Product Inquiry',
          },
          information_setting: {},
        };
      });
      f.multiple_form.push({
        id: newId(),
        name: `Form ${f.multiple_form.length + 1}`,
        is_default: 0,
        type_condition: 'selected',
        manual_condition: [],
        automatically_condition: [],
        quote_form_bottom: { submitting_position: 'right' },
        display_setting: { type_form: 'popup' },
        information_setting: [],
        languages,
      });
    });
    setUi({ variant: 0 });
  };

  const duplicate = (index) => {
    edit((f) => {
      const copy = structuredClone(f.multiple_form[index]);
      copy.id = newId();
      copy.is_default = 0;
      copy.name = `Form ${f.multiple_form.length + 1}`;
      f.multiple_form.push(copy);
    });
    setUi({ variant: 0 });
  };

  const confirmDelete = () => {
    edit((f) => {
      f.multiple_form.splice(deleteIndex, 1);
    });
    setDeleteIndex(null);
    setUi({ variant: 0 });
  };

  const selectForm = (index) => {
    setExpanded(index === ui.variant ? !expanded : true);
    setUi({ variant: index, step: STEP_1 });
  };

  return (
    <>
      <div className="qfb-forms-scroll">
        {forms.map((mf, index) => (
          <div key={mf.id ?? `unsaved-form-${index}`} className="qfb-el-item qfb-indent">
            <div className="qfb-step-title" role="button" tabIndex={0} aria-expanded={expanded && index === ui.variant} onClick={() => selectForm(index)}>
              <span className="qfb-chev">
                <s-icon type={expanded && index === ui.variant ? 'chevron-up' : 'chevron-down'} />
              </span>
              <s-icon type="folder" />
              <span className="qfb-step-title__text">
                <s-text interestFor={`${tipId}-${index}`}>{nameOf(mf, index)}</s-text>
              </span>
              <s-tooltip id={`${tipId}-${index}`}>{nameOf(mf, index)}</s-tooltip>
              <s-badge tone="info">{CONDITION_TYPE_LABEL[mf.type_condition] || 'Group products'}</s-badge>
              {index !== 0 ? (
                <span className="qfb-row-actions" onClick={(e) => e.stopPropagation()}>
                  <s-button variant="tertiary" icon="duplicate" accessibilityLabel="Duplicate" interestFor={`${tipId}-dup-${index}`} onClick={() => duplicate(index)} />
                  <s-tooltip id={`${tipId}-dup-${index}`}>Duplicate</s-tooltip>
                  <s-button variant="tertiary" icon="delete" accessibilityLabel="Delete" interestFor={`${tipId}-del-${index}`} onClick={() => setDeleteIndex(index)} />
                  <s-tooltip id={`${tipId}-del-${index}`}>Delete</s-tooltip>
                </span>
              ) : null}
            </div>
            {expanded && index === ui.variant && (
              <div className="qfb-attrs">
                {STEP1_ATTRIBUTES.map((a) => (
                  <button
                    key={a.panel}
                    type="button"
                    className="qfb-attr"
                    onClick={() => openPanel(a.panel, { step: STEP_1, variant: index })}
                  >
                    <span className="qfb-attr__icon">
                      <s-icon type={a.icon} />
                    </span>
                    <s-text>{a.title}</s-text>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="qfb-step1-foot">
        <s-stack gap="small-200">
          <div>
            <PlainIconButton icon="plus-circle" onClick={addForm}>
              Add form
            </PlainIconButton>
          </div>
          <s-paragraph color="subdued">
            Adding variants of step 1 if you need separate inquiry form for separate products. Each variant can display for different products.
          </s-paragraph>
          <Step1Title />
        </s-stack>
      </div>
      {deleteIndex !== null && (
        <Modal heading="Do you want to delete this form?" size="small" onClose={() => setDeleteIndex(null)}>
          <s-paragraph>This action might modify certain settings beyond your storefront.</s-paragraph>
          <s-button slot="primary-action" variant="primary" tone="critical" onClick={confirmDelete}>
            Delete
          </s-button>
          <s-button slot="secondary-actions" onClick={() => setDeleteIndex(null)}>
            Cancel
          </s-button>
        </Modal>
      )}
    </>
  );
}

// FormHeaderStep1Translation — the step-1 title is shared by every step-1 form.
function Step1Title() {
  const { form, edit, lang, ui } = useBuilder();
  const value = step1Lang(form, 0, lang)?.quote_form_header.popup_header_list_quote ?? '';
  return (
    <div className="qfb-title-field">
      <s-text-field
        label="Title"
        placeholder="Enter header text"
        required
        value={value}
        error={ui.errors.server && !value.trim() ? 'Request list title is required' : undefined}
        onInput={(e) => {
          const v = e.currentTarget.value;
          edit((f) =>
            f.multiple_form.forEach((mf) => {
              mf.languages[lang] = mf.languages[lang] || structuredClone(mf.languages[Object.keys(mf.languages)[0]]);
              mf.languages[lang].quote_form_header.popup_header_list_quote = v;
            }),
          );
        }}
      />
    </div>
  );
}

// ElementSetting/Step2 — the contact step's sections + its title.
function Step2Sections() {
  const { form, edit, lang, openPanel, ui } = useBuilder();
  const value = step2(form, lang).quote_form_header.popup_header_list_quote ?? '';
  return (
    <div className="qfb-el-item qfb-indent">
      <s-stack gap="small-200">
        {STEP2_SECTIONS.map((s) => (
          <button key={s.panel} type="button" className="qfb-step-title qfb-step2-row" onClick={() => openPanel(s.panel, { step: STEP_2 })}>
            <span className="qfb-chev" />
            <s-icon type={s.icon} />
            <s-text>{s.title}</s-text>
          </button>
        ))}
        <div className="qfb-title-field">
          <s-text-field
            label="Title"
            placeholder="Enter header text"
            required
            value={value}
            error={ui.errors.server && !value.trim() ? 'Request list title is required' : undefined}
            onInput={(e) => {
              const v = e.currentTarget.value;
              edit((f) => {
                f.translations[lang].form_step_2.quote_form_header.popup_header_list_quote = v;
              });
            }}
          />
        </div>
      </s-stack>
    </div>
  );
}

// SettingDetail.jsx — back row + the panel of the selected element.
function SettingDetail() {
  const { form, ui, closePanel } = useBuilder();
  const mf = form.multiple_form[ui.variant];
  const panel = ui.detail;
  const title = PANEL_TITLES[panel] || '';

  let body = null;
  switch (panel) {
    case 'display_condition':
      body = mf ? <DisplayConditionPanel /> : null;
      break;
    case 'product_info':
      body = <ProductFieldsPanel step={1} />;
      break;
    case 'productList':
      body = <ProductFieldsPanel step={2} />;
      break;
    case 'product_note':
      body = mf ? <FieldList step={1} /> : null;
      break;
    case 'note':
      body = <FieldList step={2} />;
      break;
    case 'button_step_1':
      body = mf ? <ButtonStep1Panel /> : null;
      break;
    case 'submitButton':
      body = <SubmitButtonPanel />;
      break;
    case 'customerInfo':
      body = <CustomerInfoPanel />;
      break;
    case 'formAttribute':
      body = mf ? <FormAttributePanel /> : null;
      break;
    case 'emptyState':
      body = <EmptyStatePanel />;
      break;
    case 'behavior':
      body = <BehaviorPanel />;
      break;
    default:
      body = null;
  }

  return (
    <div>
      <DetailHeader title={title} onBack={closePanel} />
      {body}
    </div>
  );
}
