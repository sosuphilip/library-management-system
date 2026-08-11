import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import { RequireAuth, RequireRole, RequireStaff } from './components/guards';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import CatalogPage from './pages/CatalogPage';
import BookDetailPage from './pages/BookDetailPage';
import BookFormPage from './pages/BookFormPage';
import MyAccountPage from './pages/MyAccountPage';
import CirculationPage from './pages/CirculationPage';
import MembersPage from './pages/MembersPage';
import MemberDetailPage from './pages/MemberDetailPage';
import ReportsPage from './pages/ReportsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/catalog" element={<CatalogPage />} />
        <Route
          path="/catalog/new"
          element={
            <RequireStaff>
              <BookFormPage />
            </RequireStaff>
          }
        />
        <Route path="/catalog/:id" element={<BookDetailPage />} />
        <Route
          path="/catalog/:id/edit"
          element={
            <RequireStaff>
              <BookFormPage />
            </RequireStaff>
          }
        />
        <Route
          path="/my"
          element={
            <RequireRole roles={['MEMBER']}>
              <MyAccountPage />
            </RequireRole>
          }
        />
        <Route
          path="/circulation"
          element={
            <RequireStaff>
              <CirculationPage />
            </RequireStaff>
          }
        />
        <Route
          path="/members"
          element={
            <RequireStaff>
              <MembersPage />
            </RequireStaff>
          }
        />
        <Route
          path="/members/:id"
          element={
            <RequireStaff>
              <MemberDetailPage />
            </RequireStaff>
          }
        />
        <Route
          path="/reports"
          element={
            <RequireStaff>
              <ReportsPage />
            </RequireStaff>
          }
        />
        <Route path="*" element={<Navigate to="/catalog" replace />} />
      </Route>
    </Routes>
  );
}
