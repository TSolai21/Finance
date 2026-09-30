import { create } from 'zustand'
import { supabase } from '@/lib/supabase'

interface AppState {
  user: any | null
  profile: any | null
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  setUser: (user: any | null) => void
  setProfile: (profile: any | null) => void
  signOut: () => Promise<void>
}

export const useAppStore = create<AppState>((set) => ({
  user: null,
  profile: null,
  sidebarOpen: true,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, profile: null })
  }
}))
