import React from 'react';
import { Toast } from '@shopify/polaris';
import {
  HomeIcon,
  OrderIcon,
  ProductIcon,
  PersonIcon,
  DiscountIcon,
  ChartVerticalIcon,
  StoreIcon,
  PriceListIcon,
  MenuHorizontalIcon,
  SettingsIcon,
  ClipboardIcon,
  ViewIcon,
} from '@shopify/polaris-icons';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { useStore } from './store.jsx';
import { Home } from './screens/Home.jsx';
import { CompaniesList } from './screens/CompaniesList.jsx';
import { CompanyDetail } from './screens/CompanyDetail.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';
import { LocationDetail } from './screens/LocationDetail.jsx';
import { PricingLibrary } from './screens/PricingLibrary.jsx';
import { Analytics } from './screens/Analytics.jsx';
import { Settings } from './screens/Settings.jsx';
import { FormSettings } from './screens/FormSettings.jsx';
import { Registrations } from './screens/Registrations.jsx';
import { RegistrationDetail } from './screens/RegistrationDetail.jsx';
import { pendingCount } from './registrations.js';
import { PricingEditor } from './components/PricingEditor.jsx';
import { BuildFromQuotes } from './components/BuildFromQuotes.jsx';
import { PriceBoard } from './components/PriceBoard.jsx';
import { AssignModal } from './components/AssignModal.jsx';
import { MultiAssignModal } from './components/MultiAssignModal.jsx';
import { AddCompanyWizard } from './components/AddCompanyWizard.jsx';
import { versionFlags, activeVersion } from '../shared/versions.js';

const flags = versionFlags();
const withV = (path) => (activeVersion() === 'latest' ? path : `${path}?v=${activeVersion()}`);

function CurrentView() {
  const { state } = useStore();
  switch (state.view) {
    case 'home':
      return <Home />;
    case 'company':
      return <CompanyDetail />;
    case 'quote':
      return <QuoteDetail />;
    case 'location':
      return <LocationDetail />;
    case 'pricing':
      return <PricingLibrary />;
    case 'registrations':
      return <Registrations />;
    case 'registration':
      return <RegistrationDetail key={state.selectedRegistration} />;
    case 'form':
      return <FormSettings entry={state.formEntry} />;
    case 'analytics':
      return flags.analytics ? <Analytics /> : <CompaniesList />;
    case 'settings':
      return <Settings />;
    case 'customers':
    default:
      return <CompaniesList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  const companyActive = ['customers', 'company', 'quote', 'location'].includes(state.view);
  // Registrations holds the submissions list, one registration's review, and the form builder.
  const registrationsActive = ['registrations', 'registration', 'form'].includes(state.view);
  const pending = pendingCount(state.db);
  // The editor shows as an in-frame page only when opened from the Pricing screen.
  const editorAsPage = !!state.builder && state.view === 'pricing';

  const sections = [
    {
      items: [
        { label: 'Home', icon: HomeIcon, onClick: () => {} },
        { label: 'Orders', icon: OrderIcon, badge: '16', onClick: () => {} },
        { label: 'Products', icon: ProductIcon, onClick: () => {} },
        { label: 'Customers', icon: PersonIcon, onClick: () => {} },
        { label: 'Discounts', icon: DiscountIcon, onClick: () => {} },
        { label: 'Analytics', icon: ChartVerticalIcon, onClick: () => {} },
      ],
    },
    {
      title: 'Apps',
      items: [
        { label: 'Storefront', icon: ViewIcon, url: '#/storefront', onClick: () => { window.location.href = '/storefront'; } },
        { label: 'O:Request a Quote', icon: ClipboardIcon, url: '#/rfq-app', onClick: () => { window.location.href = withV('/'); } },
        {
          label: 'Wholesale B2B Solution',
          icon: StoreIcon,
          url: '#/b2b',
          onClick: () => dispatch({ type: 'NAVIGATE', view: 'home' }),
          subNavigationItems: [
            {
              // Count = registrations waiting for review (sub-nav items take no badge).
              label: pending ? `Registrations (${pending})` : 'Registrations',
              url: '#/b2b/registrations',
              matches: registrationsActive,
              onClick: () => dispatch({ type: 'NAVIGATE', view: 'registrations' }),
            },
            { label: `B2B Company (${state.db.companies.length})`, url: '#/b2b/company', matches: companyActive, onClick: () => dispatch({ type: 'NAVIGATE', view: 'customers' }) },
            { label: `Pricing (${state.db.policies.length})`, url: '#/b2b/pricing', matches: state.view === 'pricing', onClick: () => dispatch({ type: 'NAVIGATE', view: 'pricing' }) },
            ...(flags.analytics
              ? [{ label: 'Analytics', url: '#/b2b/analytics', matches: state.view === 'analytics', onClick: () => dispatch({ type: 'NAVIGATE', view: 'analytics' }) }]
              : []),
            { label: 'Manual Order', url: '#/b2b/manual-order', matches: false, onClick: () => {} },
            { label: 'Discount', url: '#/b2b/discount', matches: false, onClick: () => {} },
            { label: 'Others', url: '#/b2b/others', matches: false, onClick: () => {} },
          ],
        },
      ],
    },
    {
      items: [
        { label: 'Settings', icon: SettingsIcon, url: '#/b2b/settings', matches: state.view === 'settings', onClick: () => dispatch({ type: 'NAVIGATE', view: 'settings' }) },
      ],
    },
  ];

  return (
    <AdminFrame app="b2b" location="#/b2b/company" sections={sections} searchPlaceholder="Search customers, prices and issues">
      {/* Opened from the Pricing screen, the editor is an in-frame page that
          replaces the current view; opened from a button on any other screen it
          stays a full-screen overlay on top of that screen. */}
      {editorAsPage ? <PricingEditor asPage /> : <CurrentView />}
      {!editorAsPage && <PricingEditor />}
      <BuildFromQuotes />
      <PriceBoard />
      <AssignModal />
      {/* Mount only while open so its props-derived initial state (target type by
          audience) initializes from the actual policy, not a stale null. */}
      {state.assignMulti && <MultiAssignModal />}
      <AddCompanyWizard />
      {state.toast && <Toast content={state.toast} onDismiss={() => dispatch({ type: 'CLEAR_TOAST' })} />}
    </AdminFrame>
  );
}
