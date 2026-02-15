import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import {
  getStoredUser,
  setStoredUser,
  getStoredProfile,
  setStoredProfile,
  createNewProfile,
  type LocalUser,
  type LocalProfile,
} from '../lib/local-storage';

interface AuthContextType {
  user: LocalUser | null;
  profile: LocalProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [profile, setProfile] = useState<LocalProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount, restore session from localStorage
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      const storedProfile = getStoredProfile();
      if (storedProfile) {
        setProfile(storedProfile);
      } else {
        // Profile missing, recreate it
        const newProfile = createNewProfile(storedUser);
        setProfile(newProfile);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async () => {
    // Create a local user session (simulated auth with localStorage)
    const localUser: LocalUser = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      email: 'miner@bixgain.com',
      displayName: 'BixGain Miner',
    };

    setStoredUser(localUser);
    setUser(localUser);

    // Create profile
    const newProfile = createNewProfile(localUser);
    setProfile(newProfile);
  };

  const logout = async () => {
    setStoredUser(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    const storedProfile = getStoredProfile();
    if (storedProfile) {
      setProfile({ ...storedProfile });
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
