
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';

import Login from './components/Login.jsx';
import ClientDashboard from './components/ClientDashboard.jsx';
import SmartSelection from './components/SmartSelection.jsx';
import ApplicationDetails from './components/ApplicationDetails.jsx';
import BankDashboard from './components/BankDashboard.jsx';
import BankApplicationDetails from './components/BankApplicationDetails.jsx';


// role can be stored either with quotes "" or without them; checking both cases
function getRole() {
  const raw = localStorage.getItem('role')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    return raw
  }
}


function App() {
  const location = useLocation();

  const token = localStorage.getItem("token")
  const role = getRole()
  const isAuthed = !!token && token !== "undefined" && role !== null

  if (!isAuthed) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }

  // EMPLOYEE
  if (role === "EMPLOYEE") {
    return (
      <Routes>
        <Route path="/bank" element={<BankDashboard />} />
        <Route
          path="/bank/applications/:applId"
          element={<BankApplicationDetails />}
        />
        <Route
          path="*"
          element={<Navigate to="/bank" replace />}
        />
      </Routes>
    )
  }

  // CLIENT
  return (
    <Routes>
      <Route path="/" element={<ClientDashboard />} />
      <Route path="/smart-selection" element={<SmartSelection />} />
      <Route path="/applications/:id" element={<ApplicationDetails />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default App