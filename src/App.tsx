import React from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { Home } from './components/Home';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { Lobby } from './components/Lobby';
import { GameRoom } from './components/GameRoom';
import { Navbar } from './components/Navbar';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-900 text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/game/:roomId" element={<GameRoom />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;