import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './components/LandingPage';
import SignupPage from './components/SignupPage';
import UpgradePage from './components/UpgradePage';
import SubscriptionGuard from './components/SubscriptionGuard';
import LoginPage from './components/LoginPage';
import DashboardLayout from './components/DashboardLayout';
import DashboardHome from './components/DashboardHome';
import CustomerWallet from './components/CustomerWallet';
import RewardsPage from './components/RewardsPage';
import DebugAuth from './components/DebugAuth';
import MenuItemsPage from './components/MenuItemsPage';
import LoyaltyConfigPage from './components/LoyaltyConfigPage';
import BranchManagement from './components/BranchManagement';
import StaffUI from './components/StaffUI';
import SuperAdminUI from './components/SuperAdminUI';
import SupportUI from './components/SupportUI';
import SuperAdminLogin from './components/SuperAdminLogin';
import PrivacyPage from './components/PrivacyPage';
import TermsPage from './components/TermsPage';
import BillingPage from './components/BillingPage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-[#1E2A78] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
          <p className="text-xs text-gray-400 mt-2">If this takes too long, check the console for errors</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <SubscriptionGuard>
      {children}
    </SubscriptionGuard>
  );
};

const PublicRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/upgrade" element={<UpgradePage />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route path="/terms" element={<TermsPage />} />
          <Route path="/debug" element={<DebugAuth />} />
          
          <Route 
            path="/login" 
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            } 
          />
          
          <Route 
            path="/wallet/:restaurantSlug?" 
            element={<CustomerWallet />}
          />
          
          <Route 
            path="/staff" 
            element={<StaffUI />}
          />
          
          <Route 
            path="/super-admin" 
            element={
              <SuperAdminUI />
            }
          />
          
          <Route 
            path="/super-admin-login" 
            element={<SuperAdminLogin />}
          />
          
          <Route 
            path="/dashboard" 
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="customers" element={<div className="p-8 text-center text-gray-500">Customers page coming soon...</div>} />
            <Route path="rewards" element={<RewardsPage />} />
            <Route path="menu-items" element={<MenuItemsPage />} />
            <Route path="loyalty-config" element={<LoyaltyConfigPage />} />
            <Route path="branches" element={<BranchManagement />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="support" element={<SupportUI />} />
            <Route path="qr" element={<div className="p-8 text-center text-gray-500">QR Codes page coming soon...</div>} />
            <Route path="analytics" element={<div className="p-8 text-center text-gray-500">Analytics page coming soon...</div>} />
            <Route path="settings" element={<div className="p-8 text-center text-gray-500">Settings page coming soon...</div>} />
          </Route>
          
          <Route path="/app" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
