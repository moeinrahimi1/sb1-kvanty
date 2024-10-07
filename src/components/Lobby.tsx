import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { Plus, Users } from 'lucide-react';
import axios from 'axios';
import { io } from 'socket.io-client';

interface Table {
  id: string;
  name: string;
  player_count: number;
  max_players: number;
}

const API_URL = 'http://localhost:3000/api';
const socket = io('http://localhost:3000');

export const Lobby: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [newTableName, setNewTableName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
    } else {
      fetchTables();
      socket.on('tableUpdate', (updatedTable: Table) => {
        setTables(prevTables => 
          prevTables.map(table => 
            table.id === updatedTable.id ? updatedTable : table
          )
        );
      });
    }
    return () => {
      socket.off('tableUpdate');
    };
  }, [isAuthenticated, navigate]);

  const fetchTables = async () => {
    try {
      const response = await axios.get(`${API_URL}/tables`);
      setTables(response.data);
    } catch (error) {
      console.error('Failed to fetch tables:', error);
    }
  };

  const createTable = async () => {
    try {
      const response = await axios.post(`${API_URL}/tables`, { name: newTableName, maxPlayers: 7 });
      setNewTableName('');
      fetchTables();
    } catch (error) {
      console.error('Failed to create table:', error);
    }
  };

  const joinTable = async (tableId: string) => {
    if (user) {
      socket.emit('joinTable', tableId, user.id);
      navigate(`/game/${tableId}`);
    }
  };

  const joinByCode = async () => {
    if (user) {
      socket.emit('joinTable', joinCode, user.id);
      navigate(`/game/${joinCode}`);
    }
    setJoinCode('');
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Lobby</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Available Tables</h2>
          <div className="space-y-4">
            {tables.map((table) => (
              <div key={table.id} className="bg-gray-800 p-4 rounded-lg flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold">{table.name}</h3>
                  <p className="text-gray-400">
                    <Users size={16} className="inline mr-1" />
                    {table.player_count}/{table.max_players} players
                  </p>
                </div>
                <button
                  onClick={() => joinTable(table.id)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
                  disabled={table.player_count === table.max_players}
                >
                  {table.player_count === table.max_players ? 'Full' : 'Join'}
                </button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-semibold mb-4">Create New Table</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <input
              type="text"
              value={newTableName}
              onChange={(e) => setNewTableName(e.target.value)}
              placeholder="Table Name"
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
            />
            <button
              onClick={createTable}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded w-full flex items-center justify-center"
            >
              <Plus size={20} className="mr-2" /> Create Table
            </button>
          </div>
          <h2 className="text-2xl font-semibold mt-8 mb-4">Join by Code</h2>
          <div className="bg-gray-800 p-4 rounded-lg">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Enter Room Code"
              className="w-full p-2 mb-4 bg-gray-700 text-white rounded"
            />
            <button
              onClick={joinByCode}
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded w-full"
            >
              Join Table
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};