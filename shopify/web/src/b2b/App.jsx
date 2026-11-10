import React, { useEffect } from 'react';
import { AdminFrame } from '../shared/AdminFrame.jsx';
import { Toast } from '../shared/wc.jsx';
import { useStore } from './store.jsx';
import { Home } from './screens/Home.jsx';
import { CompaniesList } from './screens/CompaniesList.jsx';
import { CompanyDetail } from './screens/CompanyDetail.jsx';
import { QuoteDetail } from './screens/QuoteDetail.jsx';
import { LocationDetail } from './screens/LocationDetail.jsx';
import { OrderDetail } from './screens/OrderDetail.jsx';
import { PricingLibrary } from './screens/PricingLibrary.jsx';
import { Analytics } from './screens/Analytics.jsx';
import { Settings } from './screens/Settings.jsx';
import { FormSettings } from './screens/FormSettings.jsx';
import { Registrations } from './screens/Registrations.jsx';
import { RegistrationDetail } from './screens/RegistrationDetail.jsx';
import { pendingCount } from './registrations.js';
import { EMBEDDED } from './initialState.js';
import { shopifyLinkFor, shopifyHref, shopifyScreenFor, shopifyScreenExists } from './shopifyRoutes.js';
import { PricingEditor } from './components/PricingEditor.jsx';
import { BuildFromQuotes } from './components/BuildFromQuotes.jsx';
import { PriceBoard } from './components/PriceBoard.jsx';
import { AssignModal } from './components/AssignModal.jsx';
import { MultiAssignModal } from './components/MultiAssignModal.jsx';
import { AddCompanyWizard } from './components/AddCompanyWizard.jsx';
import { versionFlags, withVersion } from '../shared/versions.js';
import { OrderLimits } from './screens/OrderLimits.jsx';
import { LimitTestConsole } from './screens/LimitTestConsole.jsx';
import { Agreements } from './screens/Agreements.jsx';
import { ManualOrders } from './screens/manualOrders/ManualOrders.jsx';
import { Discounts } from './screens/discounts/Discounts.jsx';
import { Others } from './screens/others/Others.jsx';
import { TERMS_HEADING, OrdersAndRules } from './screens/ContractsAndLimits.jsx';

const flags = versionFlags();

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
    case 'order':
      return <OrderDetail />;
    case 'pricing':
      return <PricingLibrary />;
    case 'limits':
      return flags.orderLimits ? <OrderLimits /> : <CompaniesList />;
    // Test console for order limits (no nav item: open #/b2b/order-limit-tests).
    case 'limitTests':
      return flags.orderLimits ? <LimitTestConsole /> : <CompaniesList />;
    case 'agreements':
      return flags.agreements ? <Agreements /> : <CompaniesList />;
    // The Orders & rules menu item: one page with a section for each list.
    case 'terms':
      return <OrdersAndRules />;
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
    case 'manualOrders':
      return <ManualOrders />;
    case 'discounts':
      return <Discounts />;
    case 'others':
      return <Others />;
    case 'customers':
    default:
      return <CompaniesList />;
  }
}

export function App() {
  const { state, dispatch } = useStore();
  // Inside Shopify admin: the screen's own link follows the screen (a new history entry
  // per screen, so Back works), and Back / Forward open the screen of the link.
  const shopifyLink = EMBEDDED === 'shopify' ? shopifyLinkFor(state) : null;
  const shopifyTarget = shopifyLink ? shopifyHref(shopifyLink, window.location.search) : null;
  useEffect(() => {
    if (!shopifyTarget || `${window.location.pathname}${window.location.search}` === shopifyTarget) return;
    window.history.pushState(null, '', shopifyTarget);
  }, [shopifyTarget]);
  useEffect(() => {
    if (EMBEDDED !== 'shopify') return undefined;
    const onPop = () => {
      const screen = shopifyScreenFor(window.location.pathname, window.location.search);
      if (screen && shopifyScreenExists(screen, state.db)) dispatch({ type: 'NAVIGATE', view: screen.view, patch: screen.patch });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [state.db, dispatch]);
  const companyActive = ['customers', 'company', 'quote', 'location', 'order'].includes(state.view);
  // Registrations holds the submissions list, one registration's review, and the form builder.
  const registrationsActive = ['registrations', 'registration', 'form'].includes(state.view);
  const pending = pendingCount(state.db);
  // The editor shows as an in-frame page only when opened from the Pricing screen.
  const editorAsPage = !!state.builder && state.view === 'pricing';

  const sections = [
    {
      items: [
        { label: 'Home', icon: 'home', onClick: () => {} },
        { label: 'Orders', icon: 'order', badge: '16', onClick: () => {} },
        { label: 'Products', icon: 'product', onClick: () => {} },
        { label: 'Customers', icon: 'person', onClick: () => {} },
        { label: 'Discounts', icon: 'discount', onClick: () => {} },
        { label: 'Analytics', icon: 'chart-vertical', onClick: () => {} },
      ],
    },
    {
      title: 'Apps',
      items: [
        { label: 'Storefront', icon: 'view', url: '#/storefront', onClick: () => { window.location.href = withVersion('/storefront'); } },
        { label: 'O:Request a Quote', icon: 'clipboard', url: '#/rfq-app', onClick: () => { window.location.href = withVersion('/'); } },
        {
          label: 'Wholesale B2B Solution',
          icon: 'store',
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
            // One item for contracts, order limits, manual orders and discounts: a page
            // with a section each (ContractsAndLimits).
            {
              label: TERMS_HEADING,
              url: '#/b2b/orders-and-rules',
              matches: ['terms', 'agreements', 'limits', 'manualOrders', 'discounts'].includes(state.view),
              onClick: () => dispatch({ type: 'NAVIGATE', view: 'terms' }),
            },
            ...(flags.analytics
              ? [{ label: 'Analytics', url: '#/b2b/analytics', matches: state.view === 'analytics', onClick: () => dispatch({ type: 'NAVIGATE', view: 'analytics' }) }]
              : []),
            { label: 'Settings', url: '#/b2b/others', matches: state.view === 'others', onClick: () => dispatch({ type: 'NAVIGATE', view: 'others' }) },
          ],
        },
      ],
    },
    {
      items: [
        { label: 'Settings', icon: 'settings', url: '#/b2b/settings', matches: state.view === 'settings', onClick: () => dispatch({ type: 'NAVIGATE', view: 'settings' }) },
      ],
    },
  ];

  return (
    <AdminFrame app="b2b" sections={sections} searchPlaceholder="Search customers, prices and issues" bare={!!EMBEDDED}>
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
