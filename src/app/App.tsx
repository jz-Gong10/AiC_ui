import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { Workspace } from './Workspace';
import { BrandLoading } from '../shared/BrandLoader';
const AuthLanding = lazy(() => import('../features/landing/AuthLanding').then(module => ({ default: module.AuthLanding })));

export function App() {
  const { user, loading } = useAuth();
  if (loading) return <div className="boot-screen"><BrandLoading variant="horizontal" size="hero" className="brand-loader-boot" label="正在连接…" /></div>;
  return <Routes>
    <Route path="/login" element={user ? <Navigate to="/projects" replace /> : <Suspense fallback={<div className="boot-screen"><BrandLoading variant="horizontal" size="hero" className="brand-loader-boot" label="正在加载…" /></div>}><AuthLanding /></Suspense>} />
    <Route path="/projects" element={user ? <Workspace /> : <Navigate to="/login" replace />} />
    <Route path="/projects/:projectId/*" element={user ? <Workspace /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={user ? '/projects' : '/login'} replace />} />
  </Routes>;
}
