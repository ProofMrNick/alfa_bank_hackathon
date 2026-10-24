
import { Routes, Route } from 'react-router-dom';

import Login from './components/Login.jsx'
import ClientDashboard from './components/ClientDashboard.jsx'
import './styles/App.css'


function App() {
  return (
    <Routes> 
      <Route path="/" element={<ClientDashboard />} />
      <Route path="/login" element={<Login />} />
    </Routes>
  )
}

export default App