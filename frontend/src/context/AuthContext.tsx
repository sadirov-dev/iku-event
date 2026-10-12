import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import i18n from '../i18n'
import { api, tokenStore } from '../lib/api'
import type { User } from '../lib/types'

interface AuthContextValue {
  user: User | null
  /** True while the stored token is being checked on first load. */
  isLoading: boolean
  signIn: (token: string, user: User) => void
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [token, setToken] = useState(tokenStore.get)

  const me = useQuery({
    queryKey: ['me'],
    queryFn: api.me,
    enabled: !!token,
    staleTime: 30_000,
    // Pick up role changes made by an admin (e.g. promoted to organizer) when the tab regains focus.
    refetchOnWindowFocus: true,
    retry: false,
  })

  // The API interceptor fires this when a token is rejected (expired, logged out elsewhere, blocked).
  useEffect(() => {
    const onExpired = () => {
      setToken(null)
      queryClient.removeQueries({ queryKey: ['me'] })
    }
    window.addEventListener('auth:expired', onExpired)
    return () => window.removeEventListener('auth:expired', onExpired)
  }, [queryClient])

  const signIn = useCallback(
    (newToken: string, user: User) => {
      tokenStore.set(newToken)
      setToken(newToken)
      queryClient.setQueryData(['me'], user)
      // Personal data (registrations, notifications) must be refetched for the new user.
      queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] !== 'me' })
      if (user.language && user.language !== i18n.resolvedLanguage) i18n.changeLanguage(user.language)
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    try {
      await api.logout()
    } catch {
      /* the token is discarded locally either way */
    }
    tokenStore.set(null)
    setToken(null)
    queryClient.clear()
  }, [queryClient])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: token ? (me.data ?? null) : null,
      isLoading: !!token && me.isPending,
      signIn,
      signOut,
    }),
    [token, me.data, me.isPending, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
