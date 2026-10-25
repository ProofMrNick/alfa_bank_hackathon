
import { Routes, Route } from 'react-router-dom';

import Login from './components/Login.jsx';
import ClientDashboard from './components/ClientDashboard.jsx';
import SmartSelection from './components/SmartSelection.jsx';
import './styles/App.css';


function App() {
  return (
    <Routes> 
      <Route path="/" element={<ClientDashboard />} />
      <Route path="/login" element={<Login />} />
      <Route path="/smart-selection" element={<SmartSelection />} />
    </Routes>
  )
}

export default App