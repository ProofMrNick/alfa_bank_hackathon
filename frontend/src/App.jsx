
import { Routes, Route } from 'react-router-dom';

import Login from './components/Login.jsx';
import ClientDashboard from './components/ClientDashboard.jsx';
import SmartSelection from './components/SmartSelection.jsx';
import ApplicationDetails from './components/ApplicationDetails.jsx';
import BankDashboard from './components/BankDashboard.jsx';
import BankApplicationDetails from './components/BankApplicationDetails.jsx';

import './styles/App.css';


function App() {
  return (
    <Routes> 
      {/* CLIENT ROUTES */}
      <Route path="/" element={<ClientDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/smart-selection" element={<SmartSelection />} />
      <Route path="/applications/:id" element={<ApplicationDetails />} />
      {/* BANK ROUTES */}
      <Route path="/bank" element={<BankDashboard />} />
      <Route path="/bank/application/:id" element={<BankApplicationDetails />} />
    </Routes>
  )
}

export default App