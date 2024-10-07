import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { io } from 'socket.io-client';

interface Player {
  id: string;
  name: string;
  chips: number;
  cards: string[];
  bet: number;
}

interface GameState {
  players: Player[];
  communityCards: string[];
  pot: number;
  currentPlayerIndex: number;
  phase: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
}

const socket = io('http://localhost:3000');

export const GameRoom: React.FC = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [gameState, setGameState] = useState<GameState | null>(null);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && roomId) {
      socket.emit('joinTable', roomId, user.id);

      socket.on('tableUpdate', (updatedTable) => {
        console.log('Table updated:', updatedTable);
      });

      socket.on('gameUpdate', (newGameState: GameState) => {
        setGameState(newGameState);
      });
    }

    return () => {
      if (user && roomId) {
        socket.emit('leaveTable', roomId, user.id);
      }
      socket.off('tableUpdate');
      socket.off('gameUpdate');
    };
  }, [roomId, user]);

  const handleAction = (action: 'fold' | 'check' | 'call' | 'raise', amount?: number) => {
    if (user && roomId) {
      socket.emit('gameAction', roomId, action, user.id, amount);
    }
  };

  if (!gameState) {
    return <div>Waiting for players...</div>;
  }

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isCurrentPlayer = currentPlayer && user && currentPlayer.id === user.id;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Texas Hold'em - Room {roomId}</h1>
      <div className="bg-green-800 p-8 rounded-lg shadow-lg">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Community Cards</h2>
          <div className="flex space-x-2">
            {gameState.communityCards.map((card, index) => (
              <div key={index} className="bg-white text-black font-bold p-2 rounded">
                {card}
              </div>
            ))}
          </div>
        </div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Players</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {gameState.players.map((player, index) => (
              <div key={player.id} className={`bg-gray-800 p-4 rounded-lg ${index === gameState.currentPlayerIndex ? 'ring-2 ring-yellow-500' : ''}`}>
                <h3 className="text-xl font-semibold">{player.name}</h3>
                <p>Chips: {player.chips}</p>
                <p>Bet: {player.bet}</p>
                <div className="flex space-x-2 mt-2">
                  {player.cards.map((card, cardIndex) => (
                    <div key={cardIndex} className="bg-white text-black font-bold p-2 rounded">
                      {player.id === user?.id ? card : '?'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-4">Pot: ${gameState.pot}</h2>
          <p>Current phase: {gameState.phase}</p>
        </div>
        {isCurrentPlayer && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">Your Turn</h2>
            <div className="flex space-x-4">
              <button onClick={() => handleAction('fold')} className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded">
                Fold
              </button>
              <button onClick={() => handleAction('check')} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
                Check
              </button>
              <button onClick={() => handleAction('call')} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded">
                Call
              </button>
              <button onClick={() => handleAction('raise', 100)} className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-2 px-4 rounded">
                Raise $100
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};