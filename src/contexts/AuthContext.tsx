import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Profile } from '@/types'
import { profileService } from '@/services/profileService'

interface AuthContextType {
  user: User | { id: string; email?: string } | null
  session: Session | null
  loading: boolean
  profile: Profile | null
  isDemoMode: boolean
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string, shopName?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Profile>) => Promise<{ error: string | null }>
  demoLogin: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const DEMO_USER_ID = 'demo-shopkeeper-001'
const DEMO_USER = {
  id: DEMO_USER_ID,
  email: 'shopkeeper@khatamatch.in',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | { id: string; email?: string } | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [isDemoMode, setIsDemoMode] = useState(false)

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await profileService.getProfile(userId)
      if (data && !error) {
        setProfile(data)
      }
    } catch (err) {
      console.error('Failed to load profile:', err)
    }
  }

  useEffect(() => {
    let mounted = true

    // Check if demo user was active
    const savedDemo = localStorage.getItem('khatamatch_demo_session')
    if (savedDemo === 'true') {
      setUser(DEMO_USER as any)
      setIsDemoMode(true)
      loadProfile(DEMO_USER_ID)
      setLoading(false)
      return
    }

    if (!isSupabaseConfigured) {
      // If Supabase keys are not set yet, automatically initiate demo user so app is instantly ready
      setUser(DEMO_USER as any)
      setIsDemoMode(true)
      loadProfile(DEMO_USER_ID)
      setLoading(false)
      return
    }

    // Get initial Supabase session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        loadProfile(session.user.id)
      }
      setLoading(false)
    })

    // Listen to Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await loadProfile(session.user.id)
        } else {
          setProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        // Mock login
        setUser(DEMO_USER as any)
        setIsDemoMode(true)
        localStorage.setItem('khatamatch_demo_session', 'true')
        await loadProfile(DEMO_USER_ID)
        setLoading(false)
        return { error: null }
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setLoading(false)
        return { error: error.message || 'Unable to connect to your account. Please check credentials.' }
      }

      if (data.user) {
        setUser(data.user)
        setSession(data.session)
        await loadProfile(data.user.id)
      }
      setLoading(false)
      return { error: null }
    } catch (err: any) {
      setLoading(false)
      return { error: err.message || 'An unexpected error occurred during login.' }
    }
  }

  const signUp = async (email: string, password: string, shopName?: string): Promise<{ error: string | null }> => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        setUser(DEMO_USER as any)
        setIsDemoMode(true)
        localStorage.setItem('khatamatch_demo_session', 'true')
        if (shopName) {
          await profileService.updateProfile(DEMO_USER_ID, { shop_name: shopName })
        }
        await loadProfile(DEMO_USER_ID)
        setLoading(false)
        return { error: null }
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            shop_name: shopName || '',
          }
        }
      })

      if (error) {
        setLoading(false)
        return { error: error.message || 'Unable to create account. Please try again.' }
      }

      if (data.user) {
        setUser(data.user)
        setSession(data.session)
        if (shopName) {
          await profileService.updateProfile(data.user.id, { shop_name: shopName })
        }
        await loadProfile(data.user.id)
      }
      setLoading(false)
      return { error: null }
    } catch (err: any) {
      setLoading(false)
      return { error: err.message || 'An unexpected error occurred during signup.' }
    }
  }

  const signOut = async () => {
    setLoading(true)
    try {
      localStorage.removeItem('khatamatch_demo_session')
      setIsDemoMode(false)
      if (isSupabaseConfigured) {
        await supabase.auth.signOut()
      }
      setUser(null)
      setSession(null)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }

  const demoLogin = () => {
    localStorage.setItem('khatamatch_demo_session', 'true')
    setUser(DEMO_USER as any)
    setIsDemoMode(true)
    loadProfile(DEMO_USER_ID)
  }

  const refreshProfile = async () => {
    if (user?.id) {
      await loadProfile(user.id)
    }
  }

  const updateProfile = async (updates: Partial<Profile>): Promise<{ error: string | null }> => {
    if (!user?.id) return { error: 'No authenticated user found.' }
    const { data, error } = await profileService.updateProfile(user.id, updates)
    if (error) {
      return { error: error.message }
    }
    if (data) {
      setProfile(data)
    }
    return { error: null }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        profile,
        isDemoMode,
        signIn,
        signUp,
        signOut,
        refreshProfile,
        updateProfile,
        demoLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
