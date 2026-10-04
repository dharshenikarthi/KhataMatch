import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Profile } from '@/types'

const LOCAL_STORAGE_PROFILE_KEY = 'khatamatch_user_profile'

export const profileService = {
  async getProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
    const getLocal = (): Profile => {
      try {
        const local = localStorage.getItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`)
        if (local) return JSON.parse(local)
      } catch {}
      const defaultProfile: Profile = {
        id: userId,
        shop_name: 'Murugan General Stores',
        preferred_language: 'english',
        tone: 'polite',
        created_at: new Date().toISOString(),
      }
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`, JSON.stringify(defaultProfile))
      } catch {}
      return defaultProfile
    }

    if (!isSupabaseConfigured) {
      return { data: getLocal(), error: null }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        const defaultProfile: Partial<Profile> = {
          id: userId,
          shop_name: '',
          preferred_language: 'english',
          tone: 'polite',
        }
        const { data: created, error: insertError } = await supabase
          .from('profiles')
          .insert(defaultProfile)
          .select()
          .single()

        if (created) return { data: created as Profile, error: null }
        return { data: getLocal(), error: null }
      }

      if (error || !data) {
        return { data: getLocal(), error: null }
      }

      return { data: data as Profile, error: null }
    } catch (err: any) {
      return { data: getLocal(), error: null }
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: Error | null }> {
    const saveLocal = (baseProfile?: Profile | null): Profile => {
      const updated: Profile = {
        ...(baseProfile || { id: userId, shop_name: '', preferred_language: 'english', tone: 'polite' }),
        ...updates,
      }
      try {
        localStorage.setItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`, JSON.stringify(updated))
      } catch (e) {
        console.warn('LocalStorage save error:', e)
      }
      return updated
    }

    if (!isSupabaseConfigured) {
      const current = await this.getProfile(userId)
      return { data: saveLocal(current.data), error: null }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          ...updates,
        })
        .select()
        .single()

      if (error || !data) {
        console.warn('Supabase profile upsert error (using local storage):', error?.message)
        const current = await this.getProfile(userId)
        return { data: saveLocal(current.data), error: null }
      }

      return { data: data as Profile, error: null }
    } catch (err: any) {
      console.warn('Supabase profile exception (using local storage):', err)
      const current = await this.getProfile(userId)
      return { data: saveLocal(current.data), error: null }
    }
  },
}
