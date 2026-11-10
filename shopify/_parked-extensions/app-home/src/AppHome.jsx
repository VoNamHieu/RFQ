import {render} from 'preact';
import {LocationProvider, ErrorBoundary, Router, Route} from 'preact-iso';

import HomePage from './pages/HomePage.jsx';
import FaqPage from './pages/FaqPage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import CompanyPage, {CompanyQuotesPage, CompanyOrdersPage} from './pages/company/CompanyPage.jsx';

export default async () => {
  render(<App />, document.body);
};

function App() {
  return (
    <LocationProvider>
      <s-app-nav>
        <s-link href="/settings">Settings</s-link>
        <s-link href="/company">Company</s-link>
      </s-app-nav>
      <ErrorBoundary>
        <Router>
          <Route path="/" component={HomePage} />
          <Route path="/faq/:id" component={FaqPage} />
          <Route path="/settings" component={SettingsPage} />
          <Route path="/company" component={CompanyPage} />
          <Route path="/company/quotes" component={CompanyQuotesPage} />
          <Route path="/company/orders" component={CompanyOrdersPage} />
          <Route default component={NotFoundPage} />
        </Router>
      </ErrorBoundary>
    </LocationProvider>
  );
}
