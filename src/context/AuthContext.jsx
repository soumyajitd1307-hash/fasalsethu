import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { setAuthHooks } from '../services/apiClient'
import * as authService from '../services/authService'

/**
 * Authentication context.
 *
 * Owns the React-visible session: `status`, `user`, `role` and the in-memory
 * access token. All token mechanics live in authService; this layer only
 * orchestrates and mirrors them into React state.
 *
 * `status` is deliberately three-state. `restoring` exists so a page reload with
 * a valid session never flashes the login form before the session is known.
 */

const AuthContext = createContext(null)

const ANONYMOUS = Object.freeze({ status: 'anonymous', user: null, role: null, accessToken: null })

export function AuthProvider({ children }) {
  const [state, setState] = useState({
    status: 'restoring',
    user: null,
    role: null,
    accessToken: null,
  })

  // Mirror authService's session into React without duplicating token state.
  const applySession = useCallback((meta) => {
    if (!meta) {
      setState(ANONYMOUS)
      return
    }
    setState((prev) => ({
      ...prev,
      role: meta.role,
      accessToken: authService.getAccessToken(),
      status: 'authenticated',
    }))
  }, [])

  /**
   * Resolve the current profile from the server. `/me` is the authority for
   * identity and role; nothing is inferred from the route or from storage.
   */
  const loadProfile = useCallback(async (token) => {
    const identity = await authService.me(token)
    return {
      user: identity.profile || null,
      role: identity.role,
      userId: identity.user_id,
    }
  }, [])

  /* ── boot: restore a session from the stored refresh token ── */
  useEffect(() => {
    let cancelled = false

    async function restore() {
      if (!authService.hasStoredSession()) {
        if (!cancelled) setState(ANONYMOUS)
        return
      }
      try {
        // One rotation on boot, then confirm identity with the new token.
        const rotated = await authService.refresh()
        const identity = await loadProfile(rotated.access_token)
        if (cancelled) return
        setState({
          status: 'authenticated',
          user: identity.user,
          role: identity.role,
          accessToken: rotated.access_token,
        })
      } catch {
        // Any failure ends the session; never leave a half-restored state.
        authService.clearSession()
        if (!cancelled) setState(ANONYMOUS)
      }
    }

    restore()

    return () => {
      cancelled = true
    }
  }, [loadProfile])

  /* ── let apiClient read the token, refresh once, and report expiry ── */
  useEffect(() => {
    setAuthHooks({
      getAccessToken: () => authService.getAccessToken(),
      // Single-flight lives in authService, so concurrent 401s cannot each
      // rotate the token (the backend would treat the second as reuse).
      refreshAccessToken: () => authService.refresh(),
      onSessionExpired: () => {
        authService.clearSession()
        setState(ANONYMOUS)
      },
    })
    const unsubscribe = authService.subscribeToSession(applySession)
    return () => {
      setAuthHooks(null)
      unsubscribe()
    }
  }, [applySession])

  const login = useCallback(
    async (role, identifier, password) => {
      const data = await authService.login(role, identifier, password)
      // The login response already carries the profile; /me is not needed here
      // and an extra round trip would only add a failure mode.
      setState({
        status: 'authenticated',
        user: data.profile || null,
        role: data.role,
        accessToken: data.access_token,
      })
      return data
    },
    []
  )

  const register = useCallback(async (role, payload) => authService.register(role, payload), [])

  const logout = useCallback(async () => {
    // Clears local state even if the backend call fails.
    await authService.logout()
    setState(ANONYMOUS)
  }, [])

  /**
   * Explicitly re-establish the session (used after a forced sign-out or on
   * demand). Mirrors the boot sequence.
   */
  const refreshSession = useCallback(async () => {
    if (!authService.hasStoredSession()) {
      setState(ANONYMOUS)
      return null
    }
    try {
      const rotated = await authService.refresh()
      const identity = await loadProfile(rotated.access_token)
      setState({
        status: 'authenticated',
        user: identity.user,
        role: identity.role,
        accessToken: rotated.access_token,
      })
      return identity
    } catch {
      authService.clearSession()
      setState(ANONYMOUS)
      return null
    }
  }, [loadProfile])

  const value = useMemo(
    () => ({
      status: state.status,
      user: state.user,
      role: state.role,
      accessToken: state.accessToken,
      isAuthenticated: state.status === 'authenticated',
      isRestoring: state.status === 'restoring',
      login,
      register,
      logout,
      refreshSession,
    }),
    [state, login, register, logout, refreshSession]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export default AuthContext
