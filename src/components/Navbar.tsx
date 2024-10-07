import React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { isAuthenticated, logout } = useAuthStore();

  return (
    <nav className="bg-gray-800 p-4">
      <div className="container mx-auto flex justify-between items-center">
        <Link to="/" className="text-white text-2xl font-bold">Texas Hold'em</Link>
        <div>
          {isAuthenticated ? (
            <>
              <Link to="/lobby" className="text-white mr-4">Lobby</Link>
              <button onClick={logout} className="text-white flex items-center">
                <LogOut size={18} className="mr-1" /> Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-white mr-4">Login</Link>
              <Link to="/register" className="text-white">Register</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
};