import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { HostelModeProvider } from './context/HostelModeContext';
import Register from './pages/Register';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Marketplace from './pages/Marketplace';
import CreateListing from './pages/CreateListing';
import ListingDetail from './pages/ListingDetail';
import EditListing from './pages/EditListing';
import MyPurchases from './pages/MyPurchases';
import SellerRequests from './pages/SellerRequests';
import Chat from './pages/Chat';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <AuthProvider>
      <HostelModeProvider>
        <Router>
          <Routes>
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route 
            path="/profile" 
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/marketplace" 
            element={
              <ProtectedRoute>
                <Marketplace />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/listings/create" 
            element={
              <ProtectedRoute>
                <CreateListing />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/listings/:id" 
            element={
              <ProtectedRoute>
                <ListingDetail />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/listings/:id/edit" 
            element={
              <ProtectedRoute>
                <EditListing />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/my-purchases" 
            element={
              <ProtectedRoute>
                <MyPurchases />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/seller-requests" 
            element={
              <ProtectedRoute>
                <SellerRequests />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/chat/:conversationId" 
            element={
              <ProtectedRoute>
                <Chat />
              </ProtectedRoute>
            } 
          />
        </Routes>
      </Router>
      </HostelModeProvider>
    </AuthProvider>
  );
}

export default App;
