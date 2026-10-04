import { supabase, isSupabaseConfigured } from '@/lib/supabase'
import { Profile } from '@/types'

const LOCAL_STORAGE_PROFILE_KEY = 'khatamatch_user_profile'

export const profileService = {
  async getProfile(userId: string): Promise<{ data: Profile | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const local = localStorage.getItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`)
      if (local) {
        return { data: JSON.parse(local), error: null }
      }
      const defaultProfile: Profile = {
        id: userId,
        shop_name: 'Murugan General Stores',
        preferred_language: 'english',
        tone: 'polite',
        created_at: new Date().toISOString(),
      }
      localStorage.setItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`, JSON.stringify(defaultProfile))
      return { data: defaultProfile, error: null }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error && error.code === 'PGRST116') {
        // Record doesn't exist yet, create default
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

        return { data: created as Profile, error: insertError ? new Error(insertError.message) : null }
      }

      if (error) {
        return { data: null, error: new Error("Unable to retrieve shop profile. Please try again.") }
      }

      return { data: data as Profile, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || "Failed to load profile.") }
    }
  },

  async updateProfile(userId: string, updates: Partial<Profile>): Promise<{ data: Profile | null; error: Error | null }> {
    if (!isSupabaseConfigured) {
      const current = await this.getProfile(userId)
      const updated: Profile = {
        ...(current.data || { id: userId, shop_name: '', preferred_language: 'english', tone: 'polite' }),
        ...updates,
      }
      localStorage.setItem(`${LOCAL_STORAGE_PROFILE_KEY}_${userId}`, JSON.stringify(updated))
      return { data: updated, error: null }
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

      if (error) {
        return { data: null, error: new Error("Unable to update profile settings. Please try again.") }
      }

      return { data: data as Profile, error: null }
    } catch (err: any) {
      return { data: null, error: new Error(err.message || "Failed to update profile.") }
    }
  },
}
