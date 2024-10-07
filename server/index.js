import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import Database from 'better-sqlite3';
import poker from 'pokersolver';
console.log(poker)
const Hand = poker.Hand
const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

const JWT_SECRET = 'your-secret-key';
const db = new Database('poker.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT
  );

  CREATE TABLE IF NOT EXISTS tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    max_players INTEGER
  );

  CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    table_id INTEGER,
    chips INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (table_id) REFERENCES tables(id)
  );
`);

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token == null) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
};

// Routes
app.post('/api/register', async (req, res) => {
  const { username, password } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const stmt = db.prepare('INSERT INTO users (username, password) VALUES (?, ?)');
    const result = stmt.run(username, hashedPassword);
    
    const token = jwt.sign({ id: result.lastInsertRowid, username }, JWT_SECRET);
    res.json({ token });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(400).json({ message: 'Username already exists' });
    } else {
      res.status(500).json({ message: 'Server error' });
    }
  }
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  
  const stmt = db.prepare('SELECT * FROM users WHERE username = ?');
  const user = stmt.get(username);

  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
  res.json({ token });
});

app.get('/api/tables', authenticateToken, (req, res) => {
  const stmt = db.prepare(`
    SELECT t.*, COUNT(p.id) as player_count
    FROM tables t
    LEFT JOIN players p ON t.id = p.table_id
    GROUP BY t.id
  `);
  const tables = stmt.all();
  res.json(tables);
});

app.post('/api/tables', authenticateToken, (req, res) => {
  const { name, maxPlayers } = req.body;
  const stmt = db.prepare('INSERT INTO tables (name, max_players) VALUES (?, ?)');
  const result = stmt.run(name, maxPlayers);
  res.status(201).json({ id: result.lastInsertRowid, name, maxPlayers });
});

// Game state
const games = new Map();

class PokerGame {
  constructor(tableId, players) {
    this.tableId = tableId;
    this.players = players;
    this.deck = this.createDeck();
    this.communityCards = [];
    this.pot = 0;
    this.currentPlayerIndex = 0;
    this.phase = 'preflop';
    this.bets = new Array(players.length).fill(0);
    this.smallBlindIndex = 0;
    this.bigBlindIndex = 1;
  }

  createDeck() {
    const suits = ['h', 'd', 'c', 's'];
    const values = ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'];
    const deck = [];
    for (const suit of suits) {
      for (const value of values) {
        deck.push(value + suit);
      }
    }
    return this.shuffle(deck);
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  dealCards() {
    for (const player of this.players) {
      player.cards = [this.deck.pop(), this.deck.pop()];
    }
  }

  nextPhase() {
    switch (this.phase) {
      case 'preflop':
        this.phase = 'flop';
        this.communityCards = [this.deck.pop(), this.deck.pop(), this.deck.pop()];
        break;
      case 'flop':
        this.phase = 'turn';
        this.communityCards.push(this.deck.pop());
        break;
      case 'turn':
        this.phase = 'river';
        this.communityCards.push(this.deck.pop());
        break;
      case 'river':
        this.phase = 'showdown';
        this.determineWinner();
        break;
    }
    this.bets.fill(0);
    this.currentPlayerIndex = (this.smallBlindIndex + 2) % this.players.length;
  }

  determineWinner() {
    const hands = this.players.map(player => {
      const hand = Hand.solve(player.cards.concat(this.communityCards));
      return { player, hand };
    });
    const winners = Hand.winners(hands.map(h => h.hand));
    const winningPlayers = hands.filter(h => winners.includes(h.hand)).map(h => h.player);
    const winAmount = Math.floor(this.pot / winningPlayers.length);
    for (const player of winningPlayers) {
      player.chips += winAmount;
    }
    return winningPlayers;
  }

  placeBet(playerIndex, amount) {
    const player = this.players[playerIndex];
    const actualBet = Math.min(amount, player.chips);
    player.chips -= actualBet;
    this.bets[playerIndex] += actualBet;
    this.pot += actualBet;
  }

  getGameState() {
    return {
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        chips: p.chips,
        cards: p.cards,
        bet: this.bets[this.players.indexOf(p)]
      })),
      communityCards: this.communityCards,
      pot: this.pot,
      currentPlayerIndex: this.currentPlayerIndex,
      phase: this.phase
    };
  }
}

// Socket.io
io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('joinTable', (tableId, userId) => {
    const stmt = db.prepare('SELECT * FROM tables WHERE id = ?');
    const table = stmt.get(tableId);
    
    if (table) {
      const playerStmt = db.prepare('INSERT INTO players (user_id, table_id, chips) VALUES (?, ?, ?)');
      playerStmt.run(userId, tableId, 1000); // Start with 1000 chips
      
      socket.join(`table-${tableId}`);
      
      const playersStmt = db.prepare('SELECT * FROM players WHERE table_id = ?');
      const players = playersStmt.all(tableId);
      
      if (players.length === 2) { // Start the game when 2 players join
        const game = new PokerGame(tableId, players);
        games.set(tableId, game);
        game.dealCards();
        io.to(`table-${tableId}`).emit('gameUpdate', game.getGameState());
      } else {
        io.to(`table-${tableId}`).emit('tableUpdate', { id: table.id, name: table.name, players });
      }
    }
  });

  socket.on('leaveTable', (tableId, userId) => {
    const stmt = db.prepare('DELETE FROM players WHERE user_id = ? AND table_id = ?');
    stmt.run(userId, tableId);
    
    socket.leave(`table-${tableId}`);
    
    const playersStmt = db.prepare('SELECT * FROM players WHERE table_id = ?');
    const players = playersStmt.all(tableId);
    
    io.to(`table-${tableId}`).emit('tableUpdate', { id: tableId, players });
    
    if (players.length < 2) {
      games.delete(tableId);
    }
  });

  socket.on('gameAction', (tableId, action, userId, amount) => {
    const game = games.get(tableId);
    if (game && game.players[game.currentPlayerIndex].id === userId) {
      switch (action) {
        case 'fold':
          // Remove player from current round
          game.players.splice(game.currentPlayerIndex, 1);
          if (game.players.length === 1) {
            // End the game if only one player left
            game.players[0].chips += game.pot;
            game.pot = 0;
            game.phase = 'showdown';
          } else {
            game.currentPlayerIndex = game.currentPlayerIndex % game.players.length;
          }
          break;
        case 'check':
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          break;
        case 'call':
          const callAmount = Math.max(...game.bets) - game.bets[game.currentPlayerIndex];
          game.placeBet(game.currentPlayerIndex, callAmount);
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          break;
        case 'raise':
          game.placeBet(game.currentPlayerIndex, amount);
          game.currentPlayerIndex = (game.currentPlayerIndex + 1) % game.players.length;
          break;
      }

      if (game.bets.every(bet => bet === game.bets[0]) && game.currentPlayerIndex === game.smallBlindIndex) {
        game.nextPhase();
      }

      io.to(`table-${tableId}`).emit('gameUpdate', game.getGameState());
    }
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});