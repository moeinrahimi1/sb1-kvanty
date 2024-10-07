import create from 'zustand';
import axios from 'axios';

interface User {
  id: string;
  username: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const API_URL = 'http://localhost:3000/api';

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: false,
  token: null,
  login: async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/login`, { username, password });
      const { token } = response.data;
      const user = { id: '1', username }; // We should decode the token to get user info
      set({ user, isAuthenticated: true, token });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Login failed: ${error.message}`);
      } else {
        throw new Error('Login failed: An unknown error occurred');
      }
    }
  },
  register: async (username, password) => {
    try {
      const response = await axios.post(`${API_URL}/register`, { username, password });
      const { token } = response.data;
      const user = { id: '1', username }; // We should decode the token to get user info
      set({ user, isAuthenticated: true, token });
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Registration failed: ${error.message}`);
      } else {
        throw new Error('Registration failed: An unknown error occurred');
      }
    }
  },
  logout: () => {
    set({ user: null, isAuthenticated: false, token: null });
    delete axios.defaults.headers.common['Authorization'];
  },
}));