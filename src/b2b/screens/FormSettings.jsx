import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Page, Card, Box, BlockStack, InlineStack, InlineGrid, Text, Button, Badge,
  TextField, Icon, Popover, Divider, Checkbox, RadioButton, Tooltip, Banner, Collapsible, InlineError,
} from '@shopify/polaris';
import {
  TextTitleIcon, TextFontIcon, TextBlockIcon, EmailIcon, KeyIcon, StoreIcon,
  PhoneIcon, LocationIcon, CursorIcon, DragHandleIcon, DeleteIcon, PlusIcon,
  CalendarIcon, UploadIcon, CheckboxIcon, HashtagIcon, CaretDownIcon,
  ListBulletedIcon, NotificationIcon, SearchIcon, ChevronRightIcon, ChevronLeftIcon,
  InfoIcon, TextAlignLeftIcon, TextAlignCenterIcon, TextAlignRightIcon,
  ClipboardIcon, ExternalSmallIcon, CheckCircleIcon, MaximizeIcon, XIcon, ViewIcon,
  ChevronUpIcon, ChevronDownIcon,
} from '@shopify/polaris-icons';
import { useStore } from '../store.jsx';
// The storefront's own Dawn icons, so the page preview matches the real store.
import {
  SearchIcon as SfSearchIcon, AccountIcon as SfAccountIcon, CartIcon as SfCartIcon, BuildingIcon as SfBuildingIcon,
} from '../../storefront/components/icons.jsx';
import { PRODUCTS } from '../../storefront/data/products.js';

// "Form settings" — the merchant-side builder for the storefront B2B registration
// form (the admin counterpart of the storefront apply flow). Three steps:
// empty → pick a template → the two-pane editor (Form details + Fields, with a
// live Preview). Faithful to the Wholesale-B2B reference; field config is local
// prototype state.

const ICON = {
  heading: TextTitleIcon, text: TextFontIcon, company: StoreIcon, email: EmailIcon,
  password: KeyIcon, phone: PhoneIcon, country: LocationIcon, state: LocationIcon, location: LocationIcon,
  submit: CursorIcon, dropdown: CaretDownIcon, checkbox: CheckboxIcon, radio: ListBulletedIcon,
  textarea: TextBlockIcon, number: HashtagIcon, date: CalendarIcon, upload: UploadIcon,
};

// Every built-in field in its canonical form order. A built-in is either in the
// form or offered in "Add field": removing one makes it re-addable, and adding
// it puts it in its place in this order.
const BUILTIN_FIELDS = [
  { id: 'contactHeading', kind: 'heading', label: 'Contact information' },
  { id: 'firstName', kind: 'text', label: 'First name', required: true, half: true },
  { id: 'lastName', kind: 'text', label: 'Last name', required: true, half: true },
  { id: 'email', kind: 'email', label: 'Business email', required: true },
  { id: 'password', kind: 'password', label: 'Password', required: true },
  { id: 'phone', kind: 'phone', label: 'Phone number' },
  { id: 'businessHeading', kind: 'heading', label: 'Business information' },
  { id: 'company', kind: 'company', label: 'Company name', required: true },
  { id: 'country', kind: 'country', label: 'Country', required: true },
  { id: 'state', kind: 'state', label: 'State' },
  { id: 'taxId', kind: 'text', label: 'Tax / VAT ID' },
  { id: 'address', kind: 'location', label: 'Address' },
  { id: 'apartment', kind: 'location', label: 'Apartment' },
  { id: 'city', kind: 'location', label: 'City' },
  { id: 'zip', kind: 'location', label: 'Zip code' },
  { id: 'aboutHeading', kind: 'heading', label: 'Tell us about your business (optional)' },
  { id: 'message', kind: 'textarea', label: 'Message / business details' },
  { id: 'marketing', kind: 'checkbox', label: 'Subscribe to our marketing emails' },
  { id: 'submit', kind: 'submit', label: 'Submit B2B application', required: true },
];
const BUILTIN_ORDER = BUILTIN_FIELDS.map((f) => f.id);

// The starter form: only what the merchant needs to decide "do I approve this
// buyer, and which company do they belong to?". It reads as a B2B application,
// not a customer sign-up, so there's no password; address details are a layer
// merchants add when they need them.
const DEFAULT_FIELD_IDS = [
  'contactHeading', 'firstName', 'lastName', 'email',
  'businessHeading', 'company', 'country', 'taxId',
  'aboutHeading', 'message', 'submit',
];
const TEMPLATE_FIELDS = BUILTIN_FIELDS.filter((f) => DEFAULT_FIELD_IDS.includes(f.id));

const MENU_ICON = { apartment: StoreIcon, marketing: NotificationIcon };
const menuSection = (f) => (f.kind === 'submit' || f.kind === 'checkbox' ? 'Others' : 'Information fields');

const CUSTOM_TYPES = [
  { kind: 'dropdown', label: 'Dropdown' },
  { kind: 'checkbox', label: 'Multiple checkbox' },
  { kind: 'radio', label: 'Radio options' },
  { kind: 'text', label: 'Text fields' },
  { kind: 'textarea', label: 'Text area' },
  { kind: 'heading', label: 'Heading' },
  { kind: 'number', label: 'Number' },
  { kind: 'date', label: 'Date field' },
  { kind: 'upload', label: 'Upload files' },
];

// `entry` = 'editor' when opened from Registrations ("Edit form"): skip the
// first-run steps and go straight to the editor, whose Back returns there.
export function FormSettings({ entry }) {
  const { dispatch } = useStore();
  const toast = (m) => dispatch({ type: 'TOAST', message: m });
  const [step, setStep] = useState(entry === 'editor' ? 'editor' : 'empty'); // 'empty' | 'create' | 'editor'
  const toRegistrations = () => dispatch({ type: 'NAVIGATE', view: 'registrations', patch: { formEntry: null } });

  if (step === 'create') return <CreateStep toast={toast} onBack={() => setStep('empty')} onCreate={() => setStep('editor')} />;
  if (step === 'editor') {
    return entry === 'editor'
      ? <EditorStep toast={toast} onBack={toRegistrations} title="B2B registration form" />
      : <EditorStep toast={toast} onBack={() => setStep('create')} />;
  }
  return <EmptyStep toast={toast} onCreate={() => setStep('create')} onManageList={toRegistrations} />;
}

// ── Step 1 — empty ────────────────────────────────────────────────────────────
function EmptyStep({ toast, onCreate, onManageList }) {
  return (
    <Page title="Form settings">
      <Card>
        <Box padding="800">
          <BlockStack gap="300" inlineAlign="center">
            <DocIllustration />
            <Text as="h3" variant="headingMd" alignment="center">Manage your registration form</Text>
            <Box maxWidth="360px">
              <Text as="p" tone="subdued" alignment="center">Track and control registrations in one place.</Text>
            </Box>
            <Box paddingBlockStart="200">
              <InlineStack gap="300" align="center">
                <Button onClick={onManageList}>Manage list</Button>
                <Button variant="primary" onClick={onCreate}>Create form</Button>
              </InlineStack>
            </Box>
          </BlockStack>
        </Box>
      </Card>
      <LearnMore toast={toast} />
    </Page>
  );
}

// ── Step 2 — pick a template ──────────────────────────────────────────────────
function CreateStep({ toast, onBack, onCreate }) {
  return (
    <Page title="Create from" backAction={{ content: 'Back', onAction: onBack }}>
      <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
        <TemplateCard
          title="B2B registration form"
          desc="Streamline sign-ups for B2B businesses working with wholesalers, retailers, or end customers using a single-step form"
          action={<Button onClick={onCreate}>Create form</Button>}
          footer="Shown on all storefront pages. Ideal for legacy customer accounts"
        />
        <TemplateCard
          title="Multi-step form"
          badge="Coming soon"
          desc="Multi-step forms capture detailed information about potential wholesalers, retailers, or end customers"
          action={<Button disabled>Create form</Button>}
          footer="Shown on Customer Account after login"
        />
      </InlineGrid>
      <LearnMore toast={toast} />
    </Page>
  );
}

function TemplateCard({ title, badge, desc, action, footer }) {
  return (
    <Card padding="0">
      <Box padding="400">
        <BlockStack gap="200">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h3" variant="headingSm">{title}</Text>
            {badge ? <Badge tone="new">{badge}</Badge> : null}
          </InlineStack>
          <Text as="p" tone="subdued">{desc}</Text>
          <Box paddingBlockStart="200">{action}</Box>
        </BlockStack>
      </Box>
      <div style={{ background: '#f4f1fe', padding: '12px 16px' }}>
        <Text as="span" tone="magic" variant="bodySm" fontWeight="medium">{footer}</Text>
      </div>
    </Card>
  );
}

// ── Step 3 — editor ───────────────────────────────────────────────────────────
// Four tabs, each answering one merchant question: what buyers fill in · how
// registrations are reviewed · how it looks (optional) · where it goes live.
const EDITOR_TABS = ['Form', 'Review process', 'Design', 'Publish form'];

function EditorStep({ toast, onBack, title: pageTitle = 'Create B2B registration form' }) {
  const [tab, setTab] = useState('Form');
  const [fullPreview, setFullPreview] = useState(false);
  // Form
  const [title, setTitle] = useState('B2B registration form');
  const [fields, setFields] = useState(TEMPLATE_FIELDS);
  const [expandedId, setExpandedId] = useState(null);
  const [slug, setSlug] = useState('b2b-registration');
  // Review process
  const [approval, setApproval] = useState('manual');
  const [afterSubmit, setAfterSubmit] = useState('message');
  const [message, setMessage] = useState('Thank you for completing your registration. Our team will connect with you as soon as possible');
  const [redirectUrl, setRedirectUrl] = useState('');
  const [tags, setTags] = useState('');
  // Design
  const [appr, setAppr] = useState({
    headingAlign: 'center', headingFmt: 'B', labelSize: '13', helpSize: '12', fieldRadius: '8',
    fieldFmt: '', btnSize: '13', btnFmt: 'B', btnAlign: 'center', btnRadius: '8',
    borderThickness: '0', dropShadow: false, hover: false,
  });
  const setA = (k) => (v) => setAppr((p) => ({ ...p, [k]: v }));
  // Publish form — where the form goes, and each place's progress
  // (create: 'none' → 'pageCreated' → 'live'; product / account: 'none' → 'live').
  const [places, setPlaces] = useState(['create']); // any of 'create' | 'product' | 'account'
  const [status, setStatus] = useState({ create: 'none', product: 'none', account: 'none' });
  // How the form shows on product pages: in a modal, or as a link to a page.
  const [productMode, setProductMode] = useState('modal'); // 'modal' | 'link'
  const [productLink, setProductLink] = useState(() => `https://${SHOP_PAGES}${slug}`);
  const [productLinkText, setProductLinkText] = useState(APPLY_CTA);
  // Which storefront surface the preview shows. The eye buttons on the Publish
  // tab switch it; elsewhere the preview is always the registration page.
  const [previewOn, setPreviewOn] = useState('page'); // 'page' | 'product-modal' | 'product-link' | 'account'
  const shownOn = tab === 'Publish form' ? previewOn : 'page';
  const [accountStep, setAccountStep] = useState('profile'); // account preview: 'profile' | 'form'
  // Copy of the "apply" card on the account page (title also heads the form screen).
  const [accountCopy, setAccountCopy] = useState({ title: APPLY_CTA, description: ACCOUNT_CTA_DESC, cta: 'Apply' });
  const preview = { on: shownOn, slug, fields, productLink, productLinkText, accountStep, setAccountStep, accountCopy };

  // Removed built-ins keep their edits (label, required) so re-adding restores them as they were.
  const [removed, setRemoved] = useState({});
  const available = BUILTIN_FIELDS
    .filter((b) => !fields.some((f) => f.id === b.id))
    .map((b) => ({ ...b, ...removed[b.id] }));

  const setField = (id, patch) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeField = (id) => {
    const field = fields.find((f) => f.id === id);
    if (field && BUILTIN_ORDER.includes(id)) setRemoved((r) => ({ ...r, [id]: field }));
    setFields((fs) => fs.filter((f) => f.id !== id));
  };
  const addField = (type) => {
    if (BUILTIN_ORDER.includes(type.id)) {
      // Back in front of the next built-in that follows it, else at the end.
      const later = BUILTIN_ORDER.slice(BUILTIN_ORDER.indexOf(type.id) + 1);
      setFields((fs) => {
        const at = fs.findIndex((f) => later.includes(f.id));
        const i = at === -1 ? fs.length : at;
        return [...fs.slice(0, i), type, ...fs.slice(i)];
      });
      return;
    }
    const id = `n${Date.now()}`;
    setFields((fs) => {
      const at = fs.findIndex((f) => f.kind === 'submit');
      const i = at === -1 ? fs.length : at;
      return [...fs.slice(0, i), { id, kind: type.kind, label: type.label }, ...fs.slice(i)];
    });
    setExpandedId(id);
  };

  return (
    <Page
      title={pageTitle}
      titleMetadata={<Badge tone="success">Active</Badge>}
      backAction={{ content: 'Back', onAction: onBack }}
      secondaryActions={[{ content: 'Turn form off', onAction: () => toast('Form turned off') }]}
    >
      <BlockStack gap="400">
        <InlineStack gap="100">
          {EDITOR_TABS.map((t) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>{t}</button>
          ))}
        </InlineStack>

        <InlineGrid columns={{ xs: 1, lg: 'minmax(0, 1fr) 340px' }} gap="400">
          <BlockStack gap="400">
            {tab === 'Form' && (
              <FormTab
                title={title} setTitle={setTitle} fields={fields} expandedId={expandedId}
                setExpandedId={setExpandedId} setField={setField} removeField={removeField} addField={addField}
                available={available}
              />
            )}
            {tab === 'Review process' && (
              <ReviewTab
                approval={approval} setApproval={setApproval} afterSubmit={afterSubmit} setAfterSubmit={setAfterSubmit}
                message={message} setMessage={setMessage} redirectUrl={redirectUrl} setRedirectUrl={setRedirectUrl}
                tags={tags} setTags={setTags}
              />
            )}
            {tab === 'Design' && <DesignTab appr={appr} setA={setA} />}
            {tab === 'Publish form' && (
              <PublishTab
                slug={slug} setSlug={setSlug} places={places} setPlaces={setPlaces} status={status} setStatus={setStatus}
                productMode={productMode} setProductMode={setProductMode} productLink={productLink} setProductLink={setProductLink}
                productLinkText={productLinkText} setProductLinkText={setProductLinkText}
                accountCopy={accountCopy} setAccountCopy={setAccountCopy}
                previewOn={previewOn} setPreviewOn={setPreviewOn} toast={toast}
              />
            )}
          </BlockStack>

          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center" wrap={false}>
                <Text as="span" tone="subdued" variant="bodySm">{PREVIEW_TITLE[shownOn]}</Text>
                <Button icon={MaximizeIcon} variant="tertiary" size="slim" onClick={() => setFullPreview(true)}
                  accessibilityLabel="Open full-screen desktop preview">Desktop</Button>
              </InlineStack>
              <StorefrontPreview {...preview} />
            </BlockStack>
          </Card>
          {fullPreview && <DesktopPreview {...preview} onClose={() => setFullPreview(false)} />}
        </InlineGrid>
      </BlockStack>
    </Page>
  );
}

function tabBtn(active) {
  return {
    padding: '6px 14px', borderRadius: 8, border: 'none', fontFamily: 'inherit',
    background: active ? '#e3e3e3' : 'transparent', color: '#303030',
    fontSize: 13, fontWeight: active ? 600 : 500, cursor: 'pointer',
  };
}

// ── Form tab (form details + the field builder) ───────────────────────────────
function FormTab({ title, setTitle, fields, expandedId, setExpandedId, setField, removeField, addField, available }) {
  return (
    <>
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingSm">Form details</Text>
          <TextField label="Title" value={title} onChange={setTitle} maxLength={255} showCharacterCount
            autoComplete="off" requiredIndicator helpText="This title is displayed internally" />
        </BlockStack>
      </Card>
      <Card padding="0">
        <Box padding="400" paddingBlockEnd="0"><Text as="h2" variant="headingSm">Fields</Text></Box>
        <Box padding="400">
          <div style={{ border: '1px solid #e3e3e3', borderRadius: 12, overflow: 'hidden' }}>
            {fields.map((f, i) => (
              <FieldRow key={f.id} field={f} first={i === 0} expanded={expandedId === f.id}
                onToggle={() => setExpandedId(expandedId === f.id ? null : f.id)}
                onChange={(patch) => setField(f.id, patch)} onRemove={() => removeField(f.id)} />
            ))}
          </div>
          <Box paddingBlockStart="300"><AddFieldButton available={available} onAdd={addField} /></Box>
        </Box>
      </Card>
    </>
  );
}

// ── Review process tab (approval + after-submit experience) ───────────────────
const dropzone = { border: '1px dashed #8a8a8a', borderRadius: 8, padding: '2.4rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 };

function ReviewTab({ approval, setApproval, afterSubmit, setAfterSubmit, message, setMessage, redirectUrl, setRedirectUrl, tags, setTags }) {
  return (
    <>
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">Approval method</Text>
          <RadioRow label="Manual approval after registration" info="You review and approve each registration before the account is activated." checked={approval === 'manual'} onChange={() => setApproval('manual')} />
          <RadioRow label="Auto-approval after registration" info="Accounts are approved automatically on submit." checked={approval === 'auto'} onChange={() => setApproval('auto')} />
        </BlockStack>
      </Card>
      <AfterSubmitCard afterSubmit={afterSubmit} setAfterSubmit={setAfterSubmit} message={message} setMessage={setMessage}
        redirectUrl={redirectUrl} setRedirectUrl={setRedirectUrl} />
      <Card>
        <BlockStack gap="200">
          <Text as="h2" variant="headingSm">Tags</Text>
          <Text as="p" tone="subdued">Apply tag to registered customers after admin approval</Text>
          <TextField label="Tags" labelHidden placeholder="Enter tags" autoComplete="off" value={tags} onChange={setTags}
            helpText="You can add multiple tags and separate them by commas. Ex: tagA,tagB,tagC" />
        </BlockStack>
      </Card>
    </>
  );
}

function AfterSubmitCard({ afterSubmit, setAfterSubmit, message, setMessage, redirectUrl, setRedirectUrl }) {
  return (
    <Card>
      <BlockStack gap="300">
        <BlockStack gap="100">
          <Text as="h2" variant="headingSm">After submit</Text>
          <Text as="p" tone="subdued">What customers see after they submit the form</Text>
        </BlockStack>
        <RadioButton label="Display success message" id="as-msg" name="afterSubmit" checked={afterSubmit === 'message'} onChange={() => setAfterSubmit('message')} />
        {afterSubmit === 'message' && (
          <Box paddingInlineStart="600">
            <BlockStack gap="300">
              <TextField label="Message label" requiredIndicator multiline={3} maxLength={1000} showCharacterCount autoComplete="off" value={message} onChange={setMessage} />
              <BlockStack gap="150">
                <Text as="span" variant="bodyMd">Illustration image</Text>
                <div style={dropzone}>
                  <Button>Add files</Button>
                  <Text as="span" tone="subdued" variant="bodySm">Accepts .gif, .jpg, and .png</Text>
                </div>
              </BlockStack>
            </BlockStack>
          </Box>
        )}
        <RadioButton label="Redirect to login page" id="as-login" name="afterSubmit" checked={afterSubmit === 'login'} disabled onChange={() => {}} />
        <RadioButton label="Redirect to URL" id="as-url" name="afterSubmit" checked={afterSubmit === 'url'} onChange={() => setAfterSubmit('url')} />
        {afterSubmit === 'url' && (
          <Box paddingInlineStart="600"><TextField label="URL" labelHidden placeholder="https://" autoComplete="off" value={redirectUrl} onChange={setRedirectUrl} /></Box>
        )}
      </BlockStack>
    </Card>
  );
}

function RadioRow({ label, info, checked, onChange }) {
  return (
    <InlineStack gap="150" blockAlign="center" wrap={false}>
      <RadioButton label={label} checked={checked} onChange={onChange} />
      {info ? (
        <Tooltip content={info}><span style={{ display: 'inline-flex' }}><Icon source={InfoIcon} tone="subdued" /></span></Tooltip>
      ) : null}
    </InlineStack>
  );
}

// ── Design tab (optional styling) ─────────────────────────────────────────────
function DesignTab({ appr, setA }) {
  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="100">
          <InlineStack gap="200" blockAlign="center">
            <Text as="h2" variant="headingSm">Design</Text>
            <Badge>Optional</Badge>
          </InlineStack>
          <Text as="p" tone="subdued">The form follows your theme's defaults. Adjust colors, font sizes, borders, and shadows only if you need to.</Text>
        </BlockStack>

        <SubHead>Form style</SubHead>
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <ColorField label="Background" hex="#FFFFFF" />
          <ColorField label="Heading" hex="#303030" />
          <SegField label="Heading alignment"><AlignSeg value={appr.headingAlign} onChange={setA('headingAlign')} /></SegField>
          <SegField label="Heading format"><FmtSeg value={appr.headingFmt} onChange={setA('headingFmt')} /></SegField>
        </InlineGrid>
        <Divider />

        <SubHead>Field size</SubHead>
        <InlineGrid columns={{ xs: 2, md: 3 }} gap="400">
          <PxField label="Label" value={appr.labelSize} onChange={setA('labelSize')} />
          <PxField label="Help text" value={appr.helpSize} onChange={setA('helpSize')} />
          <PxField label="Corner radius" value={appr.fieldRadius} onChange={setA('fieldRadius')} />
        </InlineGrid>
        <Divider />

        <SubHead>Field style</SubHead>
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <ColorField label="Label" hex="#303030" />
          <ColorField label="Help text" hex="#616161" />
          <ColorField label="Border" hex="#8A8A8A" />
          <SegField label="Field format"><FmtSeg value={appr.fieldFmt} onChange={setA('fieldFmt')} /></SegField>
        </InlineGrid>
        <Divider />

        <SubHead>Button style</SubHead>
        <InlineGrid columns={{ xs: 2, md: 4 }} gap="400">
          <PxField label="Font size" value={appr.btnSize} onChange={setA('btnSize')} />
          <SegField label="Button format"><FmtSeg value={appr.btnFmt} onChange={setA('btnFmt')} /></SegField>
          <SegField label="Button alignment"><AlignSeg value={appr.btnAlign} onChange={setA('btnAlign')} /></SegField>
          <PxField label="Corner radius" value={appr.btnRadius} onChange={setA('btnRadius')} />
        </InlineGrid>
        <InlineGrid columns={{ xs: 2, md: 3 }} gap="400">
          <PxField label="Border thickness" value={appr.borderThickness} onChange={setA('borderThickness')} />
          <ColorField label="Button background" hex="#F8D846" />
          <ColorField label="Button text" hex="#303030" />
        </InlineGrid>
        <Divider />

        <BlockStack gap="200">
          <Checkbox label="Drop shadow" checked={appr.dropShadow} onChange={setA('dropShadow')} />
          <Checkbox label="Hover" checked={appr.hover} onChange={setA('hover')} />
        </BlockStack>
      </BlockStack>
    </Card>
  );
}

function SubHead({ children }) { return <Text as="h3" variant="headingSm">{children}</Text>; }
function SegField({ label, children }) {
  return <BlockStack gap="150"><Text as="span" variant="bodyMd">{label}</Text>{children}</BlockStack>;
}
function PxField({ label, value, onChange }) {
  return <TextField label={label} value={value} onChange={onChange} suffix="px" type="number" autoComplete="off" />;
}
function ColorField({ label, hex }) {
  return (
    <BlockStack gap="150">
      <Text as="span" variant="bodyMd">{label}</Text>
      <InlineStack gap="200" blockAlign="center" wrap={false}>
        <span style={{ width: 32, height: 32, borderRadius: '50%', background: hex, border: '1px solid #d9d9d9', flex: '0 0 auto' }} />
        <BlockStack gap="0">
          <Text as="span" variant="bodySm">{hex}</Text>
          <Text as="span" variant="bodySm" tone="subdued">100%</Text>
        </BlockStack>
      </InlineStack>
    </BlockStack>
  );
}
function Seg({ items, value, onChange }) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
      {items.map((it, i) => (
        <button key={it.key} onClick={() => onChange(it.key)} style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 34,
          border: 'none', borderLeft: i > 0 ? '1px solid #d9d9d9' : 'none', cursor: 'pointer',
          background: value === it.key ? '#e3e3e3' : '#fff',
        }}>{it.node}</button>
      ))}
    </div>
  );
}
function AlignSeg({ value, onChange }) {
  const items = [
    { key: 'left', node: <Icon source={TextAlignLeftIcon} tone="subdued" /> },
    { key: 'center', node: <Icon source={TextAlignCenterIcon} tone="subdued" /> },
    { key: 'right', node: <Icon source={TextAlignRightIcon} tone="subdued" /> },
  ];
  return <Seg items={items} value={value} onChange={onChange} />;
}
function FmtSeg({ value, onChange }) {
  const items = [
    { key: 'B', node: <span style={{ fontWeight: 700, fontSize: 14 }}>B</span> },
    { key: 'I', node: <span style={{ fontStyle: 'italic', fontSize: 14 }}>I</span> },
    { key: 'U', node: <span style={{ textDecoration: 'underline', fontSize: 14 }}>U</span> },
  ];
  // Format is a toggle: clicking the active one clears it.
  return <Seg items={items} value={value} onChange={(k) => onChange(value === k ? '' : k)} />;
}

// ── Publish form tab ──────────────────────────────────────────────────────────
// The places to publish to — any mix of Create page / Product page / Account
// page, each with its own next step. The app creates the page itself; for every
// place the merchant only confirms the app block in the Theme Editor (a theme app
// extension can't add it). The fully manual route is a collapsed fallback.
const SHOP_PAGES = '221baker.myshopify.com/pages/';
const PLACE_LABEL = { create: 'Create page', product: 'Product page', account: 'Account page' };
const PLACE_HINT = {
  product: 'Show the form on your product pages.',
  account: 'Show the form on the customer account page.',
};

function PublishTab({
  slug, setSlug, places, setPlaces, status, setStatus,
  productMode, setProductMode, productLink, setProductLink, productLinkText, setProductLinkText,
  accountCopy, setAccountCopy,
  previewOn, setPreviewOn, toast,
}) {
  const formId = '01a0c21c-dffa-76e8-8d86-062f0ffd24f4';
  const [manualOpen, setManualOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(true);

  // A place can move on only once its own inputs are filled in.
  const ready = {
    create: !!slug.trim(),
    product: productMode === 'modal' || (!!productLink.trim() && !!productLinkText.trim()),
    account: !!accountCopy.title.trim() && !!accountCopy.cta.trim(),
  };
  const allLive = places.length > 0 && places.every((p) => status[p] === 'live');

  const setPlaceStatus = (place, s) => setStatus((st) => ({ ...st, [place]: s }));
  // Real app: reuse the page if the handle already exists, otherwise Admin
  // GraphQL `pageCreate` (write_online_store_pages) creates it.
  const createPage = () => { setPlaceStatus('create', 'pageCreated'); toast('Registration page created'); };
  // Real app: deep-links into the Theme Editor on that place's template (page /
  // product / customer account) with the app block ready to add, and flips to
  // live once the merchant saves. The prototype skips the round trip.
  const addToTheme = (place) => { setPlaceStatus(place, 'live'); toast('Opening Theme Editor'); };

  // Product page settings (two options + link fields) collapse behind a chevron
  // that's always there — open it to compare/preview the options before ticking.
  // It starts open only if Product page is already picked; ticking it opens it.
  const [productOpen, setProductOpen] = useState(() => places.includes('product'));
  const togglePlace = (place, on) => {
    setPlaces((ps) => (on ? [...ps, place] : ps.filter((p) => p !== place)));
    if (on && place === 'product') setProductOpen(true);
  };
  // Eyes swap the preview to a surface: Create page → the registration page,
  // Account page → the account portal, each product option → that product view.
  // The surface being previewed hides its own eye, so only the others show.
  const eye = (target) => previewOn !== target && <PreviewEye target={target} onShow={setPreviewOn} />;

  const setCopy = (k) => (v) => setAccountCopy((c) => ({ ...c, [k]: v }));

  const placeSettings = (place, picked) => (
    <PlaceStep place={place} picked={picked} status={status[place]} ready={ready[place]}
      onCreatePage={createPage} onAddToTheme={() => addToTheme(place)} onView={() => toast('Opening storefront')}>
      {place === 'create' && (
        // The handle is locked once the page exists on the online store.
        <TextField label="Page URL" requiredIndicator value={slug} onChange={setSlug} prefix={SHOP_PAGES}
          autoComplete="off" disabled={status.create !== 'none'}
          helpText={status.create !== 'none'
            ? 'This page has been created on your online store.'
            : 'Customers will access your B2B registration form from this page.'} />
      )}
      {place === 'product' && (
        <BlockStack gap="100">
          <InlineStack align="space-between" blockAlign="start" wrap={false}>
            <RadioButton label="Open modal" id="pp-modal" name="productMode" checked={productMode === 'modal'}
              helpText="The form opens in a pop-up on the product page." onChange={() => setProductMode('modal')} />
            {eye('product-modal')}
          </InlineStack>
          <InlineStack align="space-between" blockAlign="start" wrap={false}>
            <RadioButton label="Add redirect link" id="pp-link" name="productMode" checked={productMode === 'link'}
              helpText="A link on the product page takes buyers to your registration form." onChange={() => setProductMode('link')} />
            {eye('product-link')}
          </InlineStack>
          {productMode === 'link' && (
            <Box paddingInlineStart="600">
              <BlockStack gap="200">
                <TextField label="Link text" requiredIndicator autoComplete="off" maxLength={80}
                  value={productLinkText} onChange={setProductLinkText} />
                <TextField label="Redirect link" requiredIndicator placeholder="https://" autoComplete="off"
                  value={productLink} onChange={setProductLink} />
              </BlockStack>
            </Box>
          )}
        </BlockStack>
      )}
      {place === 'account' && (
        <BlockStack gap="200">
          <TextField label="Title" requiredIndicator autoComplete="off" maxLength={80}
            value={accountCopy.title} onChange={setCopy('title')} />
          <TextField label="Description" autoComplete="off" multiline={2} maxLength={200}
            value={accountCopy.description} onChange={setCopy('description')} />
          <TextField label="Button text" requiredIndicator autoComplete="off" maxLength={40}
            value={accountCopy.cta} onChange={setCopy('cta')} />
        </BlockStack>
      )}
    </PlaceStep>
  );

  return (
    <Card>
      <BlockStack gap="400">
        <BlockStack gap="300">
          {['create', 'product', 'account'].map((place) => {
            const checked = places.includes(place);
            // Product page's options stay reachable (in its collapsible) even unticked.
            const settings = (checked || place === 'product') && (
              <Box paddingInlineStart="600">{placeSettings(place, checked)}</Box>
            );
            return (
              <BlockStack key={place} gap="100">
                <InlineStack align="space-between" blockAlign="center" wrap={false}>
                  <Checkbox label={PLACE_LABEL[place]} checked={checked} onChange={(v) => togglePlace(place, v)} />
                  {place === 'create' && eye('page')}
                  {place === 'account' && eye('account')}
                  {place === 'product' && (
                    <Button icon={productOpen ? ChevronUpIcon : ChevronDownIcon} variant="tertiary"
                      onClick={() => setProductOpen((v) => !v)}
                      accessibilityLabel={productOpen ? 'Collapse product page settings' : 'Expand product page settings'} />
                  )}
                </InlineStack>
                {place === 'product'
                  ? <Collapsible open={productOpen} id="product-page-settings">{settings}</Collapsible>
                  : settings}
              </BlockStack>
            );
          })}
          {places.length === 0 && <InlineError message="Select at least one place" fieldID="publish-places" />}
        </BlockStack>
        {/* Fallback only — hidden once every chosen place is live. */}
        {!allLive && <Divider />}
        {!allLive && (
        <BlockStack gap="300">
          <InlineStack>
            <Button variant="plain" disclosure={manualOpen ? 'up' : 'down'} onClick={() => setManualOpen((v) => !v)}>
              Install manually instead
            </Button>
          </InlineStack>
          <Collapsible open={manualOpen} id="manual-install">
            <BlockStack gap="300">
              <Text as="p" tone="subdued">Place the form in a specific section of any page using the theme editor:</Text>
              <BlockStack gap="200">
                <StepLine n="Step 1:">
                  <Text as="span" variant="bodyMd">Open</Text>
                  <Button variant="plain" onClick={() => toast('Opening app embed block settings')}>app embed block settings</Button>
                  <span style={{ display: 'inline-flex' }}><Icon source={ExternalSmallIcon} tone="subdued" /></span>
                </StepLine>
                <StepLine n="Step 2:"><Text as="span" variant="bodyMd">Choose a page you want to add the form</Text></StepLine>
                <StepLine n="Step 3:"><Text as="span" variant="bodyMd">Add the "Registration form" block to a specific section</Text></StepLine>
                <StepLine n="Step 4:">
                  <Text as="span" variant="bodyMd">Copy the form ID</Text>
                  <IdChip id={formId} onCopy={() => toast('Form ID copied')} />
                </StepLine>
                <StepLine n="Step 5:"><Text as="span" variant="bodyMd">Fill in form ID from the app and click Save</Text></StepLine>
              </BlockStack>
              {noteOpen && (
                <Banner tone="info" onDismiss={() => setNoteOpen(false)}>
                  Note: If you add the form to "Customer register page", make sure you hide the "Shopify registration block".
                </Banner>
              )}
            </BlockStack>
          </Collapsible>
        </BlockStack>
        )}
      </BlockStack>
    </Card>
  );
}

// Eye that swaps the preview to a storefront surface.
function PreviewEye({ target, onShow }) {
  return (
    <Tooltip content={PREVIEW_TITLE[target]}>
      <Button icon={ViewIcon} variant="tertiary" onClick={() => onShow(target)} accessibilityLabel={PREVIEW_TITLE[target]} />
    </Tooltip>
  );
}

// One chosen place's progress + next step, nested under its checkbox. `children`
// holds any per-place settings (e.g. how the form shows on product pages).
// `picked` = the place is ticked; only then does it get its status + next step.
function PlaceStep({ place, picked, status, ready, onCreatePage, onAddToTheme, onView, children }) {
  const done = status === 'live' ? 'Live' : status === 'pageCreated' ? 'Registration page created' : null;
  return (
    <Box paddingBlockStart="100">
      <BlockStack gap="200">
        {PLACE_HINT[place] && <Text as="p" variant="bodySm" tone="subdued">{PLACE_HINT[place]}</Text>}
        {children}
        {picked && done && (
          <InlineStack gap="100" blockAlign="center" wrap={false}>
            <span style={{ display: 'inline-flex' }}><Icon source={CheckCircleIcon} tone="success" /></span>
            <Text as="span" variant="bodyMd" fontWeight="medium">{done}</Text>
          </InlineStack>
        )}
        {picked && <InlineStack>
          {status === 'live' ? (
            <Button onClick={onView}>View storefront</Button>
          ) : place === 'create' && status === 'none' ? (
            <Button variant="primary" onClick={onCreatePage} disabled={!ready}>Add registration page</Button>
          ) : (
            // Product / account pages get an entry button (or link) in the theme;
            // the created page gets the form itself.
            <Button variant="primary" onClick={onAddToTheme} disabled={!ready}>
              {place === 'create' ? 'Add form to theme →' : 'Add button'}
            </Button>
          )}
        </InlineStack>}
      </BlockStack>
    </Box>
  );
}

function StepLine({ n, children }) {
  return (
    <InlineStack gap="150" blockAlign="center" wrap={false}>
      <Text as="span" variant="bodyMd" tone="subdued">{n}</Text>
      <InlineStack gap="100" blockAlign="center" wrap={false}>{children}</InlineStack>
    </InlineStack>
  );
}
function IdChip({ id, onCopy }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid #d9d9d9', borderRadius: 8, padding: '4px 10px' }}>
      <button onClick={onCopy} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', padding: 0 }} aria-label="Copy form ID">
        <Icon source={ClipboardIcon} tone="subdued" />
      </button>
      <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{id}</span>
    </span>
  );
}

function FieldRow({ field, first, expanded, onToggle, onChange, onRemove }) {
  const editableLabel = !['submit'].includes(field.kind);
  const canRequire = !['heading', 'submit'].includes(field.kind);
  return (
    <div style={{ borderTop: first ? 'none' : '1px solid #e3e3e3', background: expanded ? '#f7f7f7' : '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
        <span style={{ display: 'inline-flex', cursor: 'grab', color: '#8a8a8a' }}><Icon source={DragHandleIcon} tone="subdued" /></span>
        <span style={{ display: 'inline-flex' }}><Icon source={ICON[field.kind] || TextFontIcon} tone="subdued" /></span>
        <button
          onClick={onToggle}
          style={{ flex: 1, textAlign: 'left', background: 'none', border: 'none', padding: 0, cursor: 'pointer', font: 'inherit' }}
        >
          <Text as="span" variant="bodyMd">
            {field.label}{field.required ? <span style={{ color: '#d72c0d' }}> *</span> : null}
          </Text>
        </button>
        <Button variant="tertiary" icon={DeleteIcon} accessibilityLabel="Remove field" onClick={onRemove} />
      </div>
      {expanded && (editableLabel || canRequire) ? (
        <Box padding="300" paddingBlockStart="0">
          <BlockStack gap="200">
            {editableLabel ? (
              <TextField label="Label" labelHidden value={field.label} onChange={(v) => onChange({ label: v })} autoComplete="off" />
            ) : null}
            {canRequire ? (
              <Checkbox label="Required" checked={!!field.required} onChange={(v) => onChange({ required: v })} />
            ) : null}
          </BlockStack>
        </Box>
      ) : null}
    </div>
  );
}

function AddFieldButton({ available, onAdd }) {
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState('root'); // 'root' | 'custom'
  const [q, setQ] = useState('');
  const close = () => { setOpen(false); setMenu('root'); setQ(''); };
  const pick = (type) => { onAdd(type); close(); };

  // Built-ins not in the form (incl. removed ones), grouped; empty sections hide.
  const matches = available.filter((f) => f.label.toLowerCase().includes(q.toLowerCase()));
  const groups = ['Information fields', 'Others']
    .map((section) => ({ section, items: matches.filter((f) => menuSection(f) === section) }))
    .filter((g) => g.items.length > 0);

  return (
    <Popover
      active={open}
      onClose={close}
      activator={<Button icon={PlusIcon} fullWidth onClick={() => setOpen((v) => !v)}>Add field</Button>}
    >
      <div style={{ width: 320 }}>
        <Box padding="200">
          <TextField label="Search" labelHidden value={q} onChange={setQ} placeholder="Search" autoComplete="off" prefix={<Icon source={SearchIcon} tone="subdued" />} />
        </Box>
        <Divider />
        <div style={{ maxHeight: 320, overflowY: 'auto' }}>
          {menu === 'root' ? (
            <>
              {groups.map((g) => (
                <React.Fragment key={g.section}>
                  <Box padding="200" paddingBlockEnd="100"><Text as="span" variant="headingXs" tone="subdued">{g.section}</Text></Box>
                  {g.items.map((f) => (
                    <MenuItem key={f.id} icon={MENU_ICON[f.id] || ICON[f.kind]} label={f.label} onClick={() => pick(f)} />
                  ))}
                </React.Fragment>
              ))}
              {groups.length > 0 && <Divider />}
              <button onClick={() => setMenu('custom')} style={rowBtn}>
                <Text as="span" variant="bodyMd" fontWeight="medium">Custom fields</Text>
                <Icon source={ChevronRightIcon} tone="subdued" />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setMenu('root')} style={{ ...itemBtn, gap: 6 }}>
                <span style={{ display: 'inline-flex', flex: '0 0 auto' }}><Icon source={ChevronLeftIcon} tone="subdued" /></span>
                <Text as="span" variant="bodyMd" fontWeight="medium">Custom fields</Text>
              </button>
              <Divider />
              {CUSTOM_TYPES.filter((t) => t.label.toLowerCase().includes(q.toLowerCase())).map((t) => (
                <MenuItem key={t.label} icon={ICON[t.kind]} label={t.label} onClick={() => pick(t)} />
              ))}
            </>
          )}
        </div>
      </div>
    </Popover>
  );
}

const rowBtn = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', padding: '8px 12px', background: 'none', border: 'none',
  cursor: 'pointer', font: 'inherit', textAlign: 'left',
};

const itemBtn = {
  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  padding: '8px 12px', background: 'none', border: 'none',
  cursor: 'pointer', font: 'inherit', textAlign: 'left',
};

function MenuItem({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={itemBtn}>
      <span style={{ display: 'inline-flex', flex: '0 0 auto' }}><Icon source={icon} tone="subdued" /></span>
      <Text as="span" variant="bodyMd">{label}</Text>
    </button>
  );
}

// ── Live preview (the form in place, as buyers see it on the storefront) ──────
// Three storefront surfaces, matching the storefront sub-app's look:
//   page    — the registration page the app creates (Dawn chrome + page title)
//   product — a product page, with the form in a modal or as a redirect link
//   account — the customer account portal (Profile), with the form embedded
// Mobile layout in the side panel; desktop layout in the full-screen preview.
const STORE_FONT = "'Assistant', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const SHOP = '221baker.myshopify.com';
const PREVIEW_PRODUCT = PRODUCTS[0];
const APPLY_CTA = 'Apply for a business account';
const ACCOUNT_CTA_DESC = 'Ordering for a business? Unlock contract pricing, volume discounts and quote requests.';
const MUTED = 'rgba(18,18,18,.6)';
const HAIRLINE = '1px solid rgba(18,18,18,.08)';

const pgBase = {
  frame: { border: '1px solid #e3e3e3', borderRadius: 10, overflow: 'hidden', background: '#fff', fontFamily: STORE_FONT, color: '#121212' },
  bar: { display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: '#f1f1f1', borderBottom: '1px solid #e3e3e3' },
  dot: (c) => ({ width: 8, height: 8, borderRadius: '50%', background: c, flex: '0 0 auto' }),
  url: { flex: 1, minWidth: 0, background: '#fff', borderRadius: 6, padding: '3px 8px', fontSize: 11, color: '#616161', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'inherit' },
  stack: { display: 'grid' },
  layer: { gridArea: '1 / 1', minWidth: 0 },
  // Dawn chrome
  announce: { background: '#121212', color: '#fff', fontSize: 10, textAlign: 'center', padding: '5px 8px' },
  header: { display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', padding: '10px 12px', borderBottom: HAIRLINE },
  logo: { fontWeight: 700, fontSize: 15, letterSpacing: '.02em' },
  nav: { display: 'flex', gap: 24, justifyContent: 'center', fontSize: 15 },
  icons: { display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' },
  icon: { width: 16, height: 16, display: 'block' },
  body: { padding: '18px 12px 22px' },
  column: {},
  title: { fontSize: 22, fontWeight: 400, lineHeight: 1.2, margin: '0 0 14px' },
  footer: { borderTop: HAIRLINE, padding: '10px 12px', fontSize: 10, color: MUTED, display: 'flex', justifyContent: 'space-between', gap: 8 },
  // Product page
  pdp: { display: 'grid', gap: 14 },
  media: { aspectRatio: '1 / 1', background: '#f3f3f3', overflow: 'hidden' },
  img: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  vendor: { textTransform: 'uppercase', letterSpacing: '.08em', color: MUTED, fontSize: 10 },
  pTitle: { fontSize: 20, fontWeight: 400, lineHeight: 1.2, margin: '4px 0 6px' },
  price: { fontSize: 15, margin: '0 0 14px' },
  btn: { display: 'block', textAlign: 'center', background: '#121212', color: '#fff', padding: '10px 0', fontSize: 13 },
  btnOutline: { display: 'block', textAlign: 'center', border: '1px solid rgba(18,18,18,.55)', padding: '9px 0', fontSize: 13, marginTop: 8 },
  applyLink: { display: 'inline-block', marginTop: 12, fontSize: 13, textDecoration: 'underline', textUnderlineOffset: 3 },
  desc: { borderTop: HAIRLINE, marginTop: 16, paddingTop: 14, fontSize: 12, color: 'rgba(18,18,18,.85)', lineHeight: 1.5 },
  // Modal over the product page
  dim: { gridArea: '1 / 1', background: 'rgba(18,18,18,.45)', padding: '36px 10px 16px', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' },
  modal: { position: 'relative', width: '100%', background: '#fff', borderRadius: 8, padding: '30px 12px 14px', boxShadow: '0 12px 32px rgba(0,0,0,.25)' },
  modalTitle: { fontSize: 16, fontWeight: 400, margin: '0 0 4px' },
  modalClose: { position: 'absolute', top: 8, right: 12, fontSize: 18, lineHeight: 1 },
  // Customer account portal
  acctHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', borderBottom: '1px solid #ececec' },
  avatar: { width: 24, height: 24, borderRadius: '50%', border: '1px solid #dcdcdc', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600 },
  acctBody: { padding: '14px 12px 22px' },
  acctGrid: {},
  acctNav: { display: 'flex', gap: 16, fontSize: 13, color: MUTED, marginBottom: 14 },
  acctNavActive: { color: '#121212', fontWeight: 700 },
  acctCard: { border: '1px solid #e5e5e5', borderRadius: 10, padding: '10px 12px', fontSize: 12, marginBottom: 14 },
  acctCta: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid rgba(42,91,215,.3)', background: '#eef2fd', borderRadius: 10, padding: '10px 12px', fontSize: 12 },
  acctCtaIcon: { width: 28, height: 28, borderRadius: 6, background: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none' },
  acctCtaSvg: { width: 16, height: 16, color: '#2a5bd7' },
  acctCtaMain: { flex: 1, minWidth: 140 },
  acctApply: { flex: 'none', background: '#2a5bd7', color: '#fff', border: 'none', padding: '7px 16px', fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' },
  backLink: { display: 'block', background: 'none', border: 'none', padding: 0, marginBottom: 10, fontFamily: 'inherit', fontSize: 12, color: '#2a5bd7', cursor: 'pointer' },
};
// Desktop mirrors the storefront's Dawn templates: logo · centred nav · actions,
// page content in a narrow centred column, product media | info side by side.
const pgDesktop = {
  ...pgBase,
  frame: { ...pgBase.frame, maxWidth: 1280, margin: '0 auto', boxShadow: '0 8px 24px rgba(0,0,0,.08)' },
  url: { ...pgBase.url, fontSize: 12, maxWidth: 520 },
  announce: { ...pgBase.announce, fontSize: 13, padding: '9px 16px' },
  header: { ...pgBase.header, gridTemplateColumns: 'auto 1fr auto', gap: 32, padding: '20px 48px' },
  logo: { ...pgBase.logo, fontSize: 22 },
  icons: { ...pgBase.icons, gap: 16 },
  icon: { width: 20, height: 20, display: 'block' },
  body: { padding: '56px 48px 80px' },
  column: { maxWidth: 640, margin: '0 auto' },
  title: { ...pgBase.title, fontSize: 40, margin: '0 0 32px' },
  footer: { ...pgBase.footer, padding: '24px 48px', fontSize: 13 },
  pdp: { display: 'grid', gridTemplateColumns: '55fr 45fr', gap: 48, alignItems: 'start' },
  vendor: { ...pgBase.vendor, fontSize: 13 },
  pTitle: { ...pgBase.pTitle, fontSize: 36, margin: '6px 0 10px' },
  price: { ...pgBase.price, fontSize: 20, margin: '0 0 24px' },
  btn: { ...pgBase.btn, padding: '14px 0', fontSize: 15 },
  btnOutline: { ...pgBase.btnOutline, padding: '13px 0', fontSize: 15, marginTop: 10 },
  applyLink: { ...pgBase.applyLink, fontSize: 15, marginTop: 16 },
  desc: { ...pgBase.desc, fontSize: 15, marginTop: 24, paddingTop: 24 },
  dim: { ...pgBase.dim, padding: '64px 24px 48px' },
  modal: { ...pgBase.modal, maxWidth: 560, padding: '40px 32px 28px' },
  modalTitle: { ...pgBase.modalTitle, fontSize: 24, margin: '0 0 8px' },
  modalClose: { ...pgBase.modalClose, top: 14, right: 18, fontSize: 22 },
  acctHeader: { ...pgBase.acctHeader, padding: '20px 48px' },
  avatar: { ...pgBase.avatar, width: 36, height: 36, fontSize: 15 },
  acctBody: { padding: '28px 48px 80px' },
  acctGrid: { display: 'grid', gridTemplateColumns: '200px minmax(0, 640px)', gap: 40, alignItems: 'start' },
  acctNav: { display: 'flex', flexDirection: 'column', gap: 14, fontSize: 17, color: MUTED },
  acctCard: { ...pgBase.acctCard, fontSize: 15, padding: '16px 20px', marginBottom: 24 },
  acctCta: { ...pgBase.acctCta, gap: 14, padding: '16px 18px', fontSize: 15 },
  acctCtaIcon: { ...pgBase.acctCtaIcon, width: 40, height: 40, borderRadius: 8 },
  acctCtaSvg: { ...pgBase.acctCtaSvg, width: 22, height: 22 },
  acctApply: { ...pgBase.acctApply, padding: '10px 20px', fontSize: 14 },
  backLink: { ...pgBase.backLink, fontSize: 15, marginBottom: 16 },
};

const PREVIEW_TITLE = {
  page: 'Preview on registration page',
  'product-modal': 'Preview on product page · Modal',
  'product-link': 'Preview on product page · Redirect link',
  account: 'Preview on account page',
};

// The storefront surface a place renders on, with the form placed in it.
function StorefrontPreview({ on, desktop, slug, fields, productLink, productLinkText, accountStep, setAccountStep, accountCopy }) {
  // Product previews carry their own mode ('product-modal' / 'product-link'), so
  // either option can be previewed whichever one is selected.
  const productMode = on === 'product-link' ? 'link' : 'modal';
  const pg = desktop ? pgDesktop : pgBase;
  const form = <FormPreview fields={fields} />;
  const onProduct = on === 'product-modal' || on === 'product-link';
  const url = onProduct ? `${SHOP}/products/${PREVIEW_PRODUCT.handle}`
    : on === 'account' ? `${SHOP}/account`
      : `${SHOP_PAGES}${slug}`;

  let content;
  if (on === 'account') {
    content = <AccountSurface pg={pg} step={accountStep} setStep={setAccountStep} copy={accountCopy}>{form}</AccountSurface>;
  } else if (onProduct) {
    const modal = productMode === 'modal' && (
      <div style={pg.dim}>
        <div style={pg.modal}>
          <span style={pg.modalClose}>×</span>
          <h2 style={pg.modalTitle}>{APPLY_CTA}</h2>
          <FormPreview fields={fields} plain />
        </div>
      </div>
    );
    content = (
      <DawnSurface pg={pg} desktop={desktop} overlay={modal}>
        <ProductBody pg={pg} productMode={productMode} productLink={productLink} productLinkText={productLinkText} />
      </DawnSurface>
    );
  } else {
    content = (
      <DawnSurface pg={pg} desktop={desktop}>
        <div style={pg.column}>
          <h1 style={pg.title}>B2B Registration</h1>
          {form}
        </div>
      </DawnSurface>
    );
  }

  return (
    <div style={pg.frame}>
      <div style={pg.bar}>
        <span style={pg.dot('#ff5f57')} /><span style={pg.dot('#febc2e')} /><span style={pg.dot('#28c840')} />
        <span style={pg.url}>{url}</span>
      </div>
      {content}
    </div>
  );
}

// Online-store page: announcement · header · body · footer. `overlay` (e.g. a
// modal with its dimmed backdrop) stacks over the whole page in the same grid
// cell, so the page grows to fit whichever is taller.
function DawnSurface({ pg, desktop, overlay, children }) {
  return (
    <div style={pg.stack}>
      <div style={pg.layer}>
        <div style={pg.announce}>Free shipping on orders over $250</div>
        <div style={pg.header}>
          {desktop ? <span style={pg.logo}>221 Baker</span> : <MenuGlyph style={pg.icon} />}
          {desktop ? (
            <nav style={pg.nav}><span>Home</span><span>Catalog</span><span>About</span><span>Contact</span></nav>
          ) : <span style={pg.logo}>221 Baker</span>}
          <span style={pg.icons}>
            <SfSearchIcon style={pg.icon} /><SfAccountIcon style={pg.icon} /><SfCartIcon style={pg.icon} />
          </span>
        </div>
        <div style={pg.body}>{children}</div>
        <div style={pg.footer}>
          <span>© {new Date().getFullYear()} 221 Baker. Powered by Shopify</span>
          {desktop && <span>Visa · Mastercard · Amex · Shop Pay</span>}
        </div>
      </div>
      {overlay}
    </div>
  );
}

function ProductBody({ pg, productMode, productLink, productLinkText }) {
  const p = PREVIEW_PRODUCT;
  return (
    <div style={pg.pdp}>
      <div style={pg.media}><img src={p.image} alt="" style={pg.img} /></div>
      <div>
        <div style={pg.vendor}>{p.vendor}</div>
        <h1 style={pg.pTitle}>{p.title}</h1>
        <div style={pg.price}>${Number(p.list).toFixed(2)} USD</div>
        <span style={pg.btn}>Add to cart</span>
        {productMode === 'modal' ? (
          <span style={pg.btnOutline}>{APPLY_CTA}</span>
        ) : (
          <span style={pg.applyLink} title={productLink}>{productLinkText}</span>
        )}
        {p.description && <div style={pg.desc}>{p.description}</div>}
      </div>
    </div>
  );
}

// Shopify's customer account portal, previewed as the buyer's two screens:
//   profile — Profile with the storefront's "Apply for a business account" card
//   form    — after clicking Apply, the registration form (← Back returns)
// The screen is clickable right in the preview, and shared by the side panel and
// the desktop view so both show the same one.
function AccountSurface({ pg, step, setStep, copy, children }) {
  return (
    <>
      <div style={pg.acctHeader}>
        <span style={pg.logo}>221baker</span>
        <span style={pg.avatar}>W</span>
      </div>
      <div style={pg.acctBody}>
        <div style={pg.acctGrid}>
          <nav style={pg.acctNav}><span>Orders</span><span style={pg.acctNavActive}>Profile</span></nav>
          {step === 'form' ? (
            <div>
              <button type="button" style={pg.backLink} onClick={() => setStep('profile')}>← Back to profile</button>
              <h1 style={pg.title}>{copy.title}</h1>
              {children}
            </div>
          ) : (
            <div>
              <h1 style={pg.title}>Profile</h1>
              <div style={pg.acctCard}>
                <div style={{ fontWeight: 600 }}>Watson James</div>
                <div style={{ color: MUTED }}>watson@watsonco.com</div>
              </div>
              <div style={pg.acctCta}>
                <span style={pg.acctCtaIcon}><SfBuildingIcon style={pg.acctCtaSvg} /></span>
                <div style={pg.acctCtaMain}>
                  <div style={{ fontWeight: 600 }}>{copy.title}</div>
                  {copy.description && <div style={{ color: MUTED }}>{copy.description}</div>}
                </div>
                <button type="button" style={pg.acctApply} onClick={() => setStep('form')}>{copy.cta}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Full-screen desktop preview, portaled to <body> so the admin nav and top bar
// don't paint over it (same pattern as Analytics' expanded tables).
function DesktopPreview({ onClose, ...preview }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 519, display: 'flex', flexDirection: 'column', background: 'var(--p-color-bg, #f1f1f1)' }}>
      <Box background="bg-surface" borderColor="border" borderBlockEndWidth="025" padding="400">
        <InlineStack align="space-between" blockAlign="center" gap="400">
          <BlockStack gap="050">
            <Text as="h2" variant="headingMd">{PREVIEW_TITLE[preview.on]}</Text>
            <Text as="span" tone="subdued" variant="bodySm">Desktop</Text>
          </BlockStack>
          <Button icon={XIcon} variant="tertiary" onClick={onClose} accessibilityLabel="Close full-screen preview" />
        </InlineStack>
      </Box>
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        <StorefrontPreview {...preview} desktop />
      </div>
    </div>,
    document.body,
  );
}

function MenuGlyph(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const pv = {
  card: { border: '1px solid #e3e3e3', borderRadius: 12, background: '#fff', padding: 16 },
  h: { fontWeight: 700, fontSize: 18, textAlign: 'center', margin: '14px 0 10px' },
  label: { fontSize: 13, fontWeight: 500, margin: '10px 0 4px', display: 'block', color: '#303030' },
  req: { color: '#d72c0d' },
  input: { width: '100%', border: '1px solid #8a8a8a', borderRadius: 8, height: 36, padding: '0 10px', boxSizing: 'border-box', background: '#fff' },
  area: { width: '100%', border: '1px solid #8a8a8a', borderRadius: 8, height: 64, padding: 10, boxSizing: 'border-box', background: '#fff' },
  select: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#616161', border: '1px solid #8a8a8a', borderRadius: 8, height: 36, padding: '0 10px', boxSizing: 'border-box' },
  flag: { display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #8a8a8a', borderRadius: 8, height: 36, padding: '0 10px', whiteSpace: 'nowrap' },
  submit: { width: '100%', background: '#f4c000', border: 'none', borderRadius: 8, height: 44, fontWeight: 700, letterSpacing: '.04em', marginTop: 16, cursor: 'default' },
  dashed: { width: '100%', border: '1px dashed #8a8a8a', borderRadius: 8, minHeight: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#616161', fontSize: 13 },
};

function Lbl({ f }) {
  return <label style={pv.label}>{f.label}{f.required ? <span style={pv.req}> *</span> : null}</label>;
}

// `plain` drops the form's own card frame (used inside the product-page modal).
function FormPreview({ fields, plain }) {
  // Group consecutive half-width fields (e.g. First / Last name) into one row.
  const rows = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    const n = fields[i + 1];
    if (f.half && n && n.half) { rows.push([f, n]); i++; } else { rows.push([f]); }
  }
  return (
    <div style={plain ? undefined : pv.card}>
      {rows.map((row, i) => row.length === 2 ? (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {row.map((f) => <div key={f.id}><Lbl f={f} /><input style={pv.input} readOnly /></div>)}
        </div>
      ) : <PreviewField key={row[0].id} f={row[0]} />)}
    </div>
  );
}

function PreviewField({ f }) {
  switch (f.kind) {
    case 'heading':
      return <div style={pv.h}>{f.label}</div>;
    case 'password':
      return (
        <div>
          <Lbl f={f} />
          <div style={{ position: 'relative' }}>
            <input style={pv.input} type="password" readOnly />
            <span style={{ position: 'absolute', right: 10, top: 9, opacity: 0.5, fontSize: 14 }}>⦸</span>
          </div>
        </div>
      );
    case 'phone':
      return (
        <div>
          <Lbl f={f} />
          <div style={{ display: 'flex', gap: 8 }}>
            <span style={pv.flag}>🇻🇳 ▾</span>
            <input style={{ ...pv.input, flex: 1 }} readOnly />
          </div>
        </div>
      );
    case 'country':
      return <div><Lbl f={f} /><div style={pv.select}><span>Select country</span><span>⌄</span></div></div>;
    case 'state':
      return <div><Lbl f={f} /><div style={pv.select}><span>Select state</span><span>⌄</span></div></div>;
    case 'dropdown':
    case 'radio':
      return <div><Lbl f={f} /><div style={pv.select}><span>Select an option</span><span>⌄</span></div></div>;
    case 'checkbox':
      return <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '12px 0 2px' }}><input type="checkbox" readOnly /><span style={{ fontSize: 13 }}>{f.label}</span></div>;
    case 'textarea':
      return <div><Lbl f={f} /><textarea style={pv.area} readOnly /></div>;
    case 'date':
      return <div><Lbl f={f} /><div style={pv.select}><span>DD / MM / YYYY</span><span>📅</span></div></div>;
    case 'upload':
      return <div><Lbl f={f} /><div style={pv.dashed}>Click to upload files</div></div>;
    case 'submit':
      return <button style={pv.submit}>{f.label}</button>;
    default: // text, email, number, company, location
      return <div><Lbl f={f} /><input style={pv.input} type={f.kind === 'email' ? 'email' : f.kind === 'number' ? 'number' : 'text'} readOnly /></div>;
  }
}

// ── bits ──────────────────────────────────────────────────────────────────────
function LearnMore({ toast }) {
  return (
    <Box paddingBlockStart="400">
      <InlineStack align="center" gap="100">
        <Text as="span" tone="subdued">Learn more about</Text>
        <Button variant="plain" onClick={() => toast('Opening docs: registration form')}>registration form</Button>
      </InlineStack>
    </Box>
  );
}

function DocIllustration() {
  return (
    <svg width="128" height="128" viewBox="0 0 128 128" fill="none" aria-hidden="true">
      <circle cx="64" cy="64" r="60" fill="#f1f1f1" />
      <rect x="40" y="30" width="48" height="64" rx="4" fill="#fff" stroke="#c9c9c9" strokeWidth="2" />
      <rect x="48" y="40" width="16" height="16" rx="2" fill="#f4a020" />
      <rect x="48" y="62" width="32" height="3" rx="1.5" fill="#d9d9d9" />
      <rect x="48" y="70" width="32" height="3" rx="1.5" fill="#d9d9d9" />
      <rect x="48" y="78" width="22" height="3" rx="1.5" fill="#d9d9d9" />
    </svg>
  );
}
