import React, { useEffect, useMemo, useState } from 'react';
import { useStore } from '../../store.jsx';
import { Modal, SaveBar, useWcId } from '../../../shared/wc.jsx';
import { TABS, STEP_1, STEP_2, EMPTY_STATE, AGENT_PANELS, initialForms } from './data.js';
import { BuilderContext, findSaveError, normalizeRedirectUrl, resolveLang } from './model.js';
import { ElementTab } from './ElementTab.jsx';
import { AfterSubmitTab, AppearanceTab, TranslationTab } from './tabs.jsx';
import { LanguagePopover } from './ui.jsx';
import { Preview } from './Preview.jsx';
import './formBuilder.css';

// "Quote form builder" — production pages/FormSettingPage.jsx → components/FormSetting
// (the A/B variant every current merchant gets: the DTC/B2B split builder with
// multi-language forms). A full-screen editor: a bar with the DTC / B2B form
// switch, desktop / mobile preview and the language picker; a left icon rail
// (Element · After submit · Translation · Form appearance); the settings column;
// and the live preview, which re-renders from the same local settings object.
// Saving uses the contextual save bar like production.

const NO_ERRORS = { labels: false, country: false, url: false, server: false };

// `?tab=fields|after_submit|translation|appearance&panel=customerInfo|…` (agent targets).
function initialUi(forms) {
  let tab = 0;
  let detail = null;
  try {
    const q = new URLSearchParams(window.location.search);
    const t = TABS.findIndex((x) => x.id === q.get('tab'));
    if (t >= 0) tab = t;
    if (AGENT_PANELS.includes(q.get('panel'))) detail = q.get('panel');
  } catch {
    /* no URL params */
  }
  const step = detail === 'emptyState' ? EMPTY_STATE : tab === 2 || detail || !forms.dtc.multiple_form.length ? STEP_2 : STEP_1;
  // quoteForm slice: previewLoggedIn starts true; it only flips when a tab / panel / form is picked.
  return {
    tab: detail ? 0 : tab,
    step,
    detail,
    variant: 0,
    loggedIn: true,
    screen: 'desktop',
    fullPreview: false,
    errors: NO_ERRORS,
    openFieldId: null,
  };
}

// useScreen(SCREEN_SM): ≤ 768px windows get the "Version Restricted" modal.
function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth <= 768);
  useEffect(() => {
    const onResize = () => setMobile(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return mobile;
}

export function FormBuilder() {
  const { dispatch } = useStore();
  const toast = (message) => dispatch({ type: 'TOAST', message });
  const [forms, setForms] = useState(initialForms);
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(forms));
  const [typeForm, setTypeForm] = useState('dtc');
  const [langCode, setLang] = useState('EN');
  const [ui, setUiState] = useState(() => initialUi(forms));
  const setUi = (patch) => setUiState((u) => ({ ...u, ...(typeof patch === 'function' ? patch(u) : patch) }));
  const isMobile = useIsMobile();

  const form = forms[typeForm];
  const lang = resolveLang(form, langCode);
  const dirty = JSON.stringify(forms) !== savedJson;

  // Mutate a copy of the selected form's settings (DTC or B2B).
  const edit = (fn) =>
    setForms((fs) => {
      const next = structuredClone(fs[typeForm]);
      fn(next);
      return { ...fs, [typeForm]: next };
    });
  // A change production saves on the spot (multi-language on/off): applied to the
  // saved copy too, so it never raises the save bar.
  const commit = (fn) => {
    edit(fn);
    setSavedJson((s) => {
      const saved = JSON.parse(s);
      fn(saved[typeForm]);
      return JSON.stringify(saved);
    });
  };

  const openPanel = (panel, patch = {}) => setUi({ detail: panel, ...patch });
  const closePanel = () => setUi({ detail: null });

  const ctx = { forms, form, typeForm, lang, setLang, edit, commit, ui, setUi, openPanel, closePanel, toast };

  // handleChangeTab
  const changeTab = (index) => {
    const patch = { tab: index };
    if (index === 0) {
      patch.step = form.multiple_form.length ? STEP_1 : STEP_2;
      patch.loggedIn = false;
      patch.detail = null;
    }
    if (index === 2) {
      patch.step = STEP_2;
      patch.loggedIn = false; // TranslationSetting flips it back on for the B2B form
    }
    setUi(patch);
  };

  // handleSelectCustomerMode
  const selectCustomerMode = (type) => {
    if (type === typeForm) return;
    const next = forms[type];
    setUi((u) => {
      const patch = { variant: 0 };
      if (u.tab === 0 && u.step === STEP_1) {
        if (u.detail) patch.detail = null;
        if (!next.multiple_form.length) patch.step = STEP_2;
      }
      if (type === 'b2b') patch.loggedIn = true;
      return patch;
    });
    setLang((l) => resolveLang(next, l));
    setTypeForm(type);
  };

  // handleSaveSettings: client checks (field labels, country restriction, redirect
  // URL), then the API's required texts — the first problem opens where it lives.
  const save = () => {
    const err = findSaveError(forms);
    if (err) {
      const errors = { ...NO_ERRORS, [err.kind]: true };
      if (err.kind !== 'url') {
        if (err.type !== typeForm) setTypeForm(err.type);
        setLang((l) => err.lang || resolveLang(forms[err.type], l));
      }
      const patch = { errors, tab: err.tab };
      if (err.tab === 0) {
        patch.step = err.step;
        patch.detail = err.detail;
        if (err.variant !== undefined) patch.variant = err.variant;
        if (err.fieldId) patch.openFieldId = err.fieldId;
      }
      setUi(patch);
      return;
    }
    const normalized = structuredClone(forms);
    Object.values(normalized).forEach((f) => {
      if (f.request_submit.type === 'direct-to-url' && f.request_submit.redirect_url) {
        f.request_submit.redirect_url = normalizeRedirectUrl(f.request_submit.redirect_url);
      }
    });
    setForms(normalized);
    setSavedJson(JSON.stringify(normalized));
    setUi({ errors: NO_ERRORS });
    toast('Settings updated');
  };

  // handleDiscardChanges
  const discard = () => {
    const saved = JSON.parse(savedJson);
    setForms(saved);
    setLang((l) => resolveLang(saved[typeForm], l));
    setUi((u) =>
      u.step === STEP_1 && saved[typeForm].multiple_form.length
        ? { detail: null, errors: NO_ERRORS, step: STEP_1, variant: 0 }
        : { detail: null, errors: NO_ERRORS, step: STEP_2 },
    );
  };

  return (
    <BuilderContext.Provider value={ctx}>
      {dirty && <SaveBar onSave={save} onDiscard={discard} />}
      <div className="qfb">
        <TopBar
          typeForm={typeForm}
          onSelect={selectCustomerMode}
          screen={ui.screen}
          onScreen={(screen) => setUi({ screen })}
          showScreen={ui.step !== EMPTY_STATE}
          onBack={() => dispatch({ type: 'NAVIGATE', view: 'submissionList' })}
        />
        <div className="qfb-body">
          <Rail active={ui.tab} onChange={changeTab} />
          <div className="qfb-settings">
            {ui.tab === 0 && <ElementTab />}
            {ui.tab === 1 && <AfterSubmitTab />}
            {ui.tab === 2 && <TranslationTab />}
            {ui.tab === 3 && <AppearanceTab />}
          </div>
          <div className="qfb-preview">
            <Preview />
          </div>
        </div>
      </div>
      <div className="qfb-footer-help">
        <s-text>
          Learn more about{' '}
          <s-link href="https://help.omegatheme.com/en/article/7-quote-form-builder-1cd6sb4/" target="_blank">
            Form setting
          </s-link>
        </s-text>
      </div>
      {isMobile && (
        <Modal heading="Version Restricted" onClose={() => dispatch({ type: 'NAVIGATE', view: 'quoteSettings' })}>
          <div className="qfb-mobile-msg">
            <s-heading>
              This feature is optimized for the PC version. Please switch to the PC version for seamless operation and enhanced visuals.
            </s-heading>
          </div>
        </Modal>
      )}
    </BuilderContext.Provider>
  );
}

// Polaris FullscreenBar: Back (92px, lines up with the rail) · "Quote Form" ·
// DTC / B2B switch · desktop / mobile · language picker.
function TopBar({ typeForm, onSelect, screen, onScreen, showScreen, onBack }) {
  // A press button flips itself on click; the picked side stays pressed.
  const press = (fn) => (e) => {
    e.currentTarget.pressed = true;
    fn();
  };
  return (
    <div className="qfb-bar">
      <button type="button" className="qfb-bar__back" onClick={onBack} aria-label="Exit fullscreen mode">
        <s-icon type="exit" />
        <span>Back</span>
      </button>
      <div className="qfb-bar__main">
        <s-heading fontSize="large">Quote Form</s-heading>
        <s-stack direction="inline" gap="small-400" alignItems="center">
          <s-button-group gap="none" accessibilityLabel="Customer type">
            <s-press-button slot="secondary-actions" pressed={typeForm === 'dtc'} onClick={press(() => onSelect('dtc'))}>
              DTC customer
            </s-press-button>
            <s-press-button slot="secondary-actions" pressed={typeForm === 'b2b'} onClick={press(() => onSelect('b2b'))}>
              B2B customer
            </s-press-button>
          </s-button-group>
          {showScreen && (
            <s-button-group gap="none" accessibilityLabel="Preview device">
              <s-press-button
                slot="secondary-actions"
                icon="desktop"
                accessibilityLabel="Desktop"
                pressed={screen === 'desktop'}
                onClick={press(() => onScreen('desktop'))}
              />
              <s-press-button
                slot="secondary-actions"
                icon="mobile"
                accessibilityLabel="Mobile"
                pressed={screen === 'mobi'}
                onClick={press(() => onScreen('mobi'))}
              />
            </s-button-group>
          )}
          <LanguagePopover />
        </s-stack>
      </div>
    </div>
  );
}

// The 92px icon rail (production Box area="menu" with Tooltip-wrapped tab items).
function Rail({ active, onChange }) {
  const id = useWcId('qfb-rail');
  const items = useMemo(() => TABS, []);
  return (
    <div className="qfb-rail" role="tablist" aria-label="Form settings">
      {items.map((tab, index) => (
        <React.Fragment key={tab.id}>
          <button
            type="button"
            role="tab"
            aria-selected={index === active}
            aria-label={tab.tooltip}
            className={`qfb-rail__item${index === active ? ' qfb-rail__item--active' : ''}`}
            onClick={() => onChange(index)}
          >
            <s-icon type={tab.icon} tone={index === active ? 'info' : undefined} interestFor={`${id}-${tab.id}`} />
          </button>
          <s-tooltip id={`${id}-${tab.id}`}>{tab.tooltip}</s-tooltip>
        </React.Fragment>
      ))}
    </div>
  );
}
