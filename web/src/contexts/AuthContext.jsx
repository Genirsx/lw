import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("charity-token");
    if (!token) {
      setLoading(false);
      return;
    }

    apiFetch("/api/auth/me")
      .then((data) => setUser(data))
      .catch(() => {
        localStorage.removeItem("charity-token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await apiFetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });

    localStorage.setItem("charity-token", data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (username, email, password) =>
    apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password })
    });

  const logout = () => {
    localStorage.removeItem("charity-token");
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
