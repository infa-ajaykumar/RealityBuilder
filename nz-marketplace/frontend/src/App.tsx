import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ListingsPage from './pages/ListingsPage';
import ListingDetailPage from './pages/ListingDetailPage';
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage';
import TermsAndConditionsPage from './pages/legal/TermsAndConditionsPage';
import ReturnsAndRefundsPolicyPage from './pages/legal/ReturnsAndRefundsPolicyPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/listings" element={<ListingsPage />} />
          <Route path="/listings/:id" element={<ListingDetailPage />} />
          <Route path="/legal/privacy" element={<PrivacyPolicyPage />} />
          <Route path="/legal/terms" element={<TermsAndConditionsPage />} />
          <Route path="/legal/returns" element={<ReturnsAndRefundsPolicyPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;