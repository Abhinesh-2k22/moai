import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import Analysis from './pages/Analysis';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import Settlements from './pages/Settlements';
import Notes from './pages/Notes';
import Contacts from './pages/Contacts';
import PaymentMethods from './pages/PaymentMethods';

import Navbar from './components/Navbar';

const PrivateLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900 transition-colors duration-300">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <Outlet />
      </div>
    </div>
  );
};

const PrivateRoute = () => {
  const { user, loading } = React.useContext(AuthContext);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

const App = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            
            {/* Private Layout wrapper with Auth Guard */}
            <Route element={<PrivateRoute />}>
              <Route element={<PrivateLayout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/groups" element={<Groups />} />
                <Route path="/groups/:id" element={<GroupDetail />} />
                <Route path="/analysis" element={<Analysis />} />
                <Route path="/settlements" element={<Settlements />} />
                <Route path="/contacts" element={<Contacts />} />
                <Route path="/payment-methods" element={<PaymentMethods />} />
                <Route path="/notes" element={<Notes />} />
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;

