import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import AppLayout from '@/components/Layout/AppLayout';
import LoginPage from '@/pages/Auth/LoginPage';

// Pages — lazy loaded
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const ForecastPage = lazy(() => import('@/pages/Forecast/ForecastPage'));
const SOWPage = lazy(() => import('@/pages/SOW/SOWPage'));
const POPage = lazy(() => import('@/pages/PO/POPage'));
const InvoicePage = lazy(() => import('@/pages/Invoice/InvoicePage'));
const PaymentPage = lazy(() => import('@/pages/Payment/PaymentPage'));
const CashflowPage = lazy(() => import('@/pages/Cashflow/CashflowPage'));
const RepositoryPage = lazy(() => import('@/pages/Repository/RepositoryPage'));
const BulkUploadPage = lazy(() => import('@/pages/BulkUpload/BulkUploadPage'));
const ReportsPage = lazy(() => import('@/pages/Reports/ReportsPage'));
const AdminPage = lazy(() => import('@/pages/Admin/AdminPage'));

const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
    <Spin size="large" />
  </div>
);

// Protected route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

// Public route wrapper (redirect to dashboard if already logged in)
const PublicRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return !isAuthenticated ? <>{children}</> : <Navigate to="/dashboard" replace />;
};

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public routes */}
        <Route
          path="/login"
          element={
            <PublicRoute>
              <LoginPage />
            </PublicRoute>
          }
        />

        {/* Protected routes — wrapped in main layout */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <AppLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<PageLoader />}>
                <DashboardPage />
              </Suspense>
            }
          />
          <Route
            path="forecast/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <ForecastPage />
              </Suspense>
            }
          />
          <Route
            path="sow/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <SOWPage />
              </Suspense>
            }
          />
          <Route
            path="po/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <POPage />
              </Suspense>
            }
          />
          <Route
            path="invoices/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <InvoicePage />
              </Suspense>
            }
          />
          <Route
            path="payments/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <PaymentPage />
              </Suspense>
            }
          />
          <Route
            path="cashflow"
            element={
              <Suspense fallback={<PageLoader />}>
                <CashflowPage />
              </Suspense>
            }
          />
          <Route
            path="repository/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <RepositoryPage />
              </Suspense>
            }
          />
          <Route
            path="bulk-upload/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <BulkUploadPage />
              </Suspense>
            }
          />
          <Route
            path="reports/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <ReportsPage />
              </Suspense>
            }
          />
          <Route
            path="admin/*"
            element={
              <Suspense fallback={<PageLoader />}>
                <AdminPage />
              </Suspense>
            }
          />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
