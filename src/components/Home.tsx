import React from 'react';
import { Link } from 'react-router-dom';
import { Spade, Heart, Diamond, Club } from 'lucide-react';

export const Home: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white">
      <h1 className="text-6xl font-bold mb-8">Texas Hold'em</h1>
      <div className="flex space-x-4 mb-8">
        <Spade size={48} className="text-white" />
        <Heart size={48} className="text-red-500" />
        <Diamond size={48} className="text-red-500" />
        <Club size={48} className="text-white" />
      </div>
      <p className="text-xl mb-8">Experience the thrill of poker online!</p>
      <div className="space-x-4">
        <Link to="/login" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
          Login
        </Link>
        <Link to="/register" className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
          Register
        </Link>
      </div>
    </div>
  );
};