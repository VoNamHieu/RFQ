import '@shopify/ui-extensions/preact';
import {render} from 'preact';
import {useEffect, useState} from 'preact/hooks';
import {getRegistration, submitRegistration} from './api.js';

export default async () => {
  render(<RegistrationPage />, document.body);
};

function RegistrationPage() {
  const purchasingCompany = shopify.authenticatedAccount.purchasingCompany.value;
  const [registration, setRegistration] = useState(null);
  const [legalName, setLegalName] = useState('');
  const [taxId, setTaxId] = useState('');
  const [businessType, setBusinessType] = useState('Distributor');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    getRegistration()
      .then((value) => active && setRegistration(value))
      .catch((err) => active && setError(err.message || 'Unable to load registration status.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  async function onSubmit() {
    if (!legalName.trim() || !taxId.trim() || !terms) {
      setError('Enter the company name and tax ID, then accept the declaration.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const result = await submitRegistration({legalName: legalName.trim(), taxId: taxId.trim(), businessType, notes: notes.trim()});
      setRegistration(result);
    } catch (err) {
      setError(err.message || 'Unable to submit the registration.');
    } finally {
      setSaving(false);
    }
  }

  if (purchasingCompany) {
    return (
      <s-page heading="Business registration" subheading="Your account is already connected to a business">
        <s-stack direction="block" gap="base">
          <s-banner tone="success" heading="Business account active">
            You are purchasing for {purchasingCompany.company.name}{purchasingCompany.location?.name ? ` · ${purchasingCompany.location.name}` : ''}.
          </s-banner>
          <s-button variant="primary" onClick={() => shopify.navigation.navigate('shopify:customer-account/profile')}>
            View business profile
          </s-button>
        </s-stack>
      </s-page>
    );
  }

  if (loading) {
    return <s-page heading="Business registration"><s-spinner accessibilityLabel="Loading registration" /></s-page>;
  }

  if (registration?.status === 'pending') {
    return (
      <s-page heading="Business registration" subheading="Application status">
        <s-stack direction="block" gap="base">
          <s-banner tone="info" heading="Pending review">
            We will email you when your business account has been reviewed.
          </s-banner>
          <s-section>
            <s-stack direction="block" gap="small">
              <s-heading>{registration.application?.legalName || 'Business application'}</s-heading>
              <s-text>Application {registration.application?.id || ''}</s-text>
              <s-text>Submitted {registration.application?.submittedAt || ''}</s-text>
            </s-stack>
          </s-section>
          <s-button onClick={() => shopify.navigation.navigate('extension:qs-b2b-portal')}>Back to B2B Portal</s-button>
        </s-stack>
      </s-page>
    );
  }

  return (
    <s-page heading="Business registration" subheading="Apply for company pricing and B2B purchasing">
      <s-button slot="breadcrumb-actions" accessibilityLabel="Back to B2B Portal" onClick={() => shopify.navigation.navigate('extension:qs-b2b-portal')}>
        B2B Portal
      </s-button>
      <s-stack direction="block" gap="base">
        {error ? <s-banner tone="critical">{error}</s-banner> : null}
        <s-section>
          <s-stack direction="block" gap="base">
            <s-heading>Company information</s-heading>
            <s-text-field label="Legal company name" value={legalName} required onInput={(event) => setLegalName(event.target.value)} />
            <s-text-field label="Tax / VAT ID" value={taxId} required onInput={(event) => setTaxId(event.target.value)} />
            <s-select label="Business type" value={businessType} onChange={(event) => setBusinessType(event.target.value)}>
              <s-option value="Distributor">Distributor</s-option>
              <s-option value="Retailer">Retailer</s-option>
              <s-option value="Manufacturer">Manufacturer</s-option>
              <s-option value="Other">Other</s-option>
            </s-select>
            <s-text-field label="Notes (optional)" value={notes} onInput={(event) => setNotes(event.target.value)} />
            <s-checkbox
              label="I confirm that I am authorized to submit this business information."
              checked={terms}
              onChange={(event) => setTerms(event.target.checked)}
            />
            <s-button variant="primary" loading={saving} onClick={onSubmit}>Submit application</s-button>
          </s-stack>
        </s-section>
      </s-stack>
    </s-page>
  );
}
