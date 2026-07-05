import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';

import Splash from './pages/Splash';
import Home from './pages/Home';
import Quiz from './pages/Quiz';
import Results from './pages/Results';
import Leaderboard from './pages/Leaderboard';
import MainLayout from './layouts/MainLayout';

function App() {
  return (
    <BrowserRouter>
      <AnimatePresence mode="wait">
        <Routes>
          <Route path="/" element={<Splash />} />
          
          {/* Main App Routes with Sidebar/Topbar */}
          <Route element={<MainLayout />}>
            <Route path="/home" element={<Home />} />
            <Route path="/leaderboard" element={<Leaderboard />} />
            {/* Other sidebar routes would go here (Categories, etc.) */}
          </Route>
          
          {/* Full screen routes */}
          <Route path="/quiz" element={<Quiz />} />
          <Route path="/results" element={<Results />} />
        </Routes>
      </AnimatePresence>
    </BrowserRouter>
  );
}

export default App;
