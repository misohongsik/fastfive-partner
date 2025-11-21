import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import PortfolioIndex from './pages/PortfolioIndex';
import CafePage from './pages/CafePage';
import GymPage from './pages/GymPage';
import StartupPage from './pages/StartupPage';
import RealEstatePage from './pages/RealEstatePage';
import AcademyPage from './pages/AcademyPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PortfolioIndex />} />
        <Route path="/cafe" element={<CafePage />} />
        <Route path="/gym" element={<GymPage />} />
        <Route path="/startup" element={<StartupPage />} />
        <Route path="/realestate" element={<RealEstatePage />} />
        <Route path="/academy" element={<AcademyPage />} />
      </Routes>
    </Router>
  );
}

export default App;
