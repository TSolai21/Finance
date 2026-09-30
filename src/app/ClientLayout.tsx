"use client";
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { Layout } from '@/components/layout/Layout'
import Login from './login/page'
import { useRouter, usePathname } from 'next/navigation'

export function ClientLayout({ children }: { children: React.ReactNode }) {
  const user = useAppStore(state => state.user)
  const setUser = useAppStore(state => state.setUser)
  const [loading, setLoading] = useState(true)

  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [setUser])

  useEffect(() => {
    if (!loading && user && pathname === '/login') {
      router.replace('/')
    }
  }, [user, loading, pathname, router])

  if (loading) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>
  }

  if (!user) {
    return <Login />
  }

  if (pathname === '/login') {
    return <div className="h-screen bg-slate-50"></div> // Wait for redirect
  }

  return <Layout>{children}</Layout>
}