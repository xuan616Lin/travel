import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import TripDetails from './pages/TripDetails'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import ResetPassword from './pages/ResetPassword'
import Memoir from './pages/Memoir'

// Protected Route Component
const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuth()

  if (loading) return null // Or a loading spinner

  return user ? children : <Navigate to="/auth" />
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/" element={
            <PrivateRoute>
              <Dashboard />
            </PrivateRoute>
          } />
          <Route path="/trip/:id" element={
            <PrivateRoute>
              <TripDetails />
            </PrivateRoute>
          } />
          <Route path="/trip/:id/memoir" element={
            <PrivateRoute>
              <Memoir />
            </PrivateRoute>
          } />
          <Route path="/profile" element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          } />
          <Route path="/settings" element={
            <PrivateRoute>
              <Settings />
            </PrivateRoute>
          } />
        </Routes>
      </Router>
    </AuthProvider>
  )
}

export default App
