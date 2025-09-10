import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { trpc } from '@/utils/trpc';
import type { User } from '../../../server/src/schema';

interface GoogleAuthData {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (googleData: GoogleAuthData) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check for existing session on app load
    const checkSession = async () => {
      try {
        const sessionToken = localStorage.getItem('session_token');
        if (sessionToken) {
          const userData = await trpc.validateSession.query({ sessionToken });
          if (userData) {
            setUser(userData);
          } else {
            localStorage.removeItem('session_token');
          }
        }
      } catch (error) {
        console.error('Session validation failed:', error);
        localStorage.removeItem('session_token');
      } finally {
        setLoading(false);
      }
    };

    checkSession();
  }, []);

  const login = async (email: string, password: string) => {
    const session = await trpc.loginUser.mutate({ email, password });
    // Get user data separately since loginUser returns UserSession
    const userData = await trpc.getUserProfile.query({ userId: session.user_id });
    setUser(userData);
    localStorage.setItem('session_token', session.session_token);
  };

  const loginWithGoogle = async (googleData: GoogleAuthData) => {
    const session = await trpc.googleAuth.mutate({
      google_id: googleData.sub,
      email: googleData.email,
      display_name: googleData.name,
      avatar_url: googleData.picture || null
    });
    // Get user data separately since googleAuth returns UserSession
    const userData = await trpc.getUserProfile.query({ userId: session.user_id });
    setUser(userData);
    localStorage.setItem('session_token', session.session_token);
  };

  const register = async (email: string, password: string, displayName: string) => {
    const userData = await trpc.createUser.mutate({
      email,
      password,
      display_name: displayName
    });
    setUser(userData);
    
    // In a real implementation, createUser should also create and return a session
    // For now, we'll simulate a login after registration
    try {
      const session = await trpc.loginUser.mutate({ email, password });
      localStorage.setItem('session_token', session.session_token);
    } catch {
      // If login fails, use temporary session
      localStorage.setItem('session_token', 'temp_session_' + userData.id);
    }
  };

  const logout = async () => {
    try {
      const sessionToken = localStorage.getItem('session_token');
      if (sessionToken) {
        await trpc.logoutUser.mutate({ sessionToken });
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setUser(null);
      localStorage.removeItem('session_token');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    register,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}