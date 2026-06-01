import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Spin } from 'antd';

const AdminHomePage      = lazy(() => import('./AdminHomePage'));
const EntityListPage     = lazy(() => import('./EntityListPage'));
const CustomerListPage   = lazy(() => import('./CustomerListPage'));
const CustomerDetailPage = lazy(() => import('./CustomerDetailPage'));
const UserListPage       = lazy(() => import('./UserListPage'));

const Loader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
    <Spin size="large" />
  </div>
);

export default function AdminPage() {
  return (
    <Routes>
      <Route index element={<Suspense fallback={<Loader />}><AdminHomePage /></Suspense>} />
      <Route path="customers" element={<Suspense fallback={<Loader />}><CustomerListPage /></Suspense>} />
      <Route path="customers/:customerId" element={<Suspense fallback={<Loader />}><CustomerDetailPage /></Suspense>} />
      <Route path="entities" element={<Suspense fallback={<Loader />}><EntityListPage /></Suspense>} />
      <Route path="users" element={<Suspense fallback={<Loader />}><UserListPage /></Suspense>} />
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
