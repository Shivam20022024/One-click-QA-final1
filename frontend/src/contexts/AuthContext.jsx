import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../utils/supabase";
import { useToast } from "./ToastContext";
import { api } from "../utils/api";

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const { triggerToast } = useToast();

  useEffect(() => {
    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user ?? null);
      if (session?.access_token) {
        api.setToken(session.access_token);
      }
      setAuthLoading(false);
    });

    // Listen for changes on auth state (log in, log out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
      if (session?.access_token) {
        api.setToken(session.access_token);
      } else {
        api.setToken(null);
      }
      setAuthLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
      triggerToast("Login successful!");
      return data;
    } catch (error) {
      triggerToast(error.message, true);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const signup = async (email, password, name, role) => {
    setAuthLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name,
            role: role
          }
        }
      });

      if (error) throw error;
      triggerToast("Account registered! Please check your email for verification.");
      return data;
    } catch (error) {
      triggerToast(error.message, true);
      throw error;
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      triggerToast("Logged out successfully.");
    } catch (error) {
      triggerToast(error.message, true);
    }
  };

  return (
    <AuthContext.Provider value={{ currentUser, authLoading, login, signup, logout }}>
      {!authLoading && children}
    </AuthContext.Provider>
  );
};
