import React, { createContext, useContext, useState, useEffect } from 'react'
import {
  registerUser,
  loginUser,
  loginWithGoogle,
  logoutUser,
  sendPasswordReset,
  subscribeToAuthState,
  mapAuthError,
} from '../firebase/auth'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [role, setRole] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(state => {
      setUser(state.user)
      setRole(state.role)
      setProfile(state.profile)
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  // Action wrappers with clean error formatting
  async function login({ emailOrPhone, password, expectedRole }) {
    try {
      const result = await loginUser({ emailOrPhone, password, expectedRole })
      setUser(result.user)
      setRole(result.profile?.role || expectedRole)
      setProfile(result.profile)
      return { success: true, user: result.user, profile: result.profile }
    } catch (err) {
      return { success: false, error: mapAuthError(err) }
    }
  }

  async function register(userData) {
    try {
      const result = await registerUser(userData)
      setUser(result.user)
      setRole(result.profile?.role || userData.role)
      setProfile(result.profile)
      return { success: true, user: result.user, profile: result.profile }
    } catch (err) {
      return { success: false, error: mapAuthError(err) }
    }
  }

  async function loginGoogle(expectedRole) {
    try {
      const result = await loginWithGoogle(expectedRole)
      setUser(result.user)
      setRole(result.profile?.role || expectedRole)
      setProfile(result.profile)
      return { success: true, user: result.user, profile: result.profile }
    } catch (err) {
      return { success: false, error: mapAuthError(err) }
    }
  }

  async function logout() {
    await logoutUser()
    setUser(null)
    setRole(null)
    setProfile(null)
  }

  async function resetPassword(email) {
    try {
      await sendPasswordReset(email)
      return { success: true }
    } catch (err) {
      return { success: false, error: mapAuthError(err) }
    }
  }

  const value = {
    user,
    role,
    profile,
    loading,
    isAuthenticated: Boolean(user),
    isFarmer: role === 'farmer',
    isBuyer: role === 'buyer',
    login,
    register,
    loginGoogle,
    logout,
    resetPassword,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
