"use client";

import { useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Activity,
  Users,
  FileText,
  CreditCard,
  Menu,
  Bell,
  Search,
  Home,
  Settings,
  CheckCircle2,
  LogOut,
  PlusCircle,
  X,
  DollarSign,
  User
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAppStore } from '@/store/appStore'
import { BrandLogo } from '@/components/ui/BrandLogo'

export function Layout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<{ customers: any[]; loans: any[] } | null>(null)
  const [isSearching, setIsSearching] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  
  const router = useRouter()
  const pathname = usePathname()
  const signOut = useAppStore(state => state.signOut)
  const user = useAppStore(state => state.user)
  const setProfile = useAppStore(state => state.setProfile)

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      const { data } = await supabase.from('profiles').select('role, full_name, branch_id, center_id').eq('id', user.id).single()
      return data
    },
    enabled: !!user?.id
  })

  const role = profile?.role || 'Staff'

  useEffect(() => {
    if (profile) {
      setProfile(profile)
    }
  }, [profile, setProfile])

  // Global search handler
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null)
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const q = searchQuery.trim()

      const [custRes, loanRes] = await Promise.all([
        supabase
          .from('customers')
          .select('id, client_id, full_name, mobile_number')
          .or(`full_name.ilike.%${q}%,client_id.ilike.%${q}%,mobile_number.ilike.%${q}%`)
          .limit(5),
        supabase
          .from('loans')
          .select('id, loan_id, principal_amount, status, customers(full_name, client_id)')
          .ilike('loan_id', `%${q}%`)
          .limit(5)
      ])

      setSearchResults({
        customers: custRes.data || [],
        loans: loanRes.data || []
      })
      setIsSearching(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [searchQuery])

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Desktop Sidebar */}
      <aside
        className={`bg-white border-r border-slate-200 flex flex-col transition-[width] duration-300 ease-in-out relative z-30 hidden md:flex shrink-0 shadow-sm overflow-x-hidden ${
          sidebarOpen ? 'w-64' : 'w-20'
        }`}
      >
        <div
          className={`h-16 flex items-center px-4 border-b border-slate-200 transition-all duration-300 ${
            sidebarOpen ? 'justify-between' : 'justify-center'
          }`}
        >
          <div
            className={`flex items-center min-w-0 overflow-hidden transition-all duration-200 ${
              sidebarOpen
                ? 'opacity-100 max-w-[180px] pointer-events-auto'
                : 'opacity-0 max-w-0 pointer-events-none'
            }`}
          >
            <Link href="/" className="hover:opacity-95 transition-opacity whitespace-nowrap">
              <BrandLogo size="sm" />
            </Link>
          </div>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 active-press transition-colors shrink-0"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto overflow-x-hidden">
          <NavItem to="/" icon={<Home size={20} />} label="Dashboard" isOpen={sidebarOpen} />
          <NavItem to="/customers" icon={<Users size={20} />} label="Customers" isOpen={sidebarOpen} />
          <NavItem to="/loans" icon={<FileText size={20} />} label="Loans" isOpen={sidebarOpen} />
          <NavItem to="/collections" icon={<CreditCard size={20} />} label="Collections" isOpen={sidebarOpen} />
          {(role === 'Manager' || role === 'Admin') && (
            <NavItem to="/cash-management" icon={<DollarSign size={20} />} label="Cash Desk" isOpen={sidebarOpen} />
          )}
          {(role === 'Manager' || role === 'Admin') && (
            <NavItem to="/approvals" icon={<CheckCircle2 size={20} />} label="Approvals" isOpen={sidebarOpen} />
          )}
          <NavItem to="/reports" icon={<Activity size={20} />} label="Reports" isOpen={sidebarOpen} />
        </nav>
        
        <div className="px-3 py-3 border-t border-slate-200">
          {role === 'Admin' && (
            <NavItem to="/settings" icon={<Settings size={20} />} label="Settings" isOpen={sidebarOpen} />
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative bg-slate-50/70">
        {/* Native Mobile App Bar & Desktop Header */}
        <header className="pt-[env(safe-area-inset-top,0px)] h-[calc(56px+env(safe-area-inset-top,0px))] md:h-16 bg-white/85 backdrop-blur-xl border-b border-slate-200/80 flex items-center justify-between px-3.5 md:px-8 shrink-0 z-30 shadow-xs transition-all">
          {/* Mobile Brand & Avatar */}
          <div className="flex items-center space-x-2 md:hidden">
            <Link href="/" className="hover:opacity-95 transition-opacity">
              <BrandLogo size="sm" subtitle={role} />
            </Link>
          </div>

          {/* Global Search Input */}
          <div className="relative flex-1 max-w-xs md:max-w-md mx-2.5 md:mx-4">
            <div className="flex items-center bg-slate-100/90 rounded-full px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:bg-white transition-all border border-slate-200/60 shadow-xs">
              <Search size={15} className="text-slate-400 mr-2 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search Client ID, Loan ID, or Name..."
                className="bg-transparent border-none outline-none w-full text-xs md:text-sm text-slate-800 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-slate-400 hover:text-slate-600 p-0.5 active:scale-90">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Search Dropdown Results */}
            {searchQuery.trim() && (
              <div className="absolute top-12 left-0 right-0 bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl overflow-hidden z-50 p-2.5 max-h-96 overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                {isSearching ? (
                  <div className="p-4 text-center text-xs text-slate-400 font-medium">Searching...</div>
                ) : (
                  <>
                    <div className="mb-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 tracking-wider">Customers</p>
                      {searchResults?.customers.length ? (
                        searchResults.customers.map(c => (
                          <div
                            key={c.id}
                            onClick={() => {
                              router.push(`/customers/${c.id}`)
                              setSearchQuery('')
                            }}
                            className="px-3 py-2.5 hover:bg-indigo-50/70 active:bg-indigo-100 rounded-xl cursor-pointer flex justify-between items-center transition-colors active-press"
                          >
                            <span className="font-semibold text-slate-800 text-xs md:text-sm">{c.full_name}</span>
                            <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">{c.client_id}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 px-3 py-1">No matching customers</p>
                      )}
                    </div>

                    <div className="border-t border-slate-100 pt-2">
                      <p className="text-[10px] uppercase font-bold text-slate-400 px-3 py-1 tracking-wider">Loans</p>
                      {searchResults?.loans.length ? (
                        searchResults.loans.map(l => (
                          <div
                            key={l.id}
                            onClick={() => {
                              router.push(`/loans/${l.id}`)
                              setSearchQuery('')
                            }}
                            className="px-3 py-2.5 hover:bg-indigo-50/70 active:bg-indigo-100 rounded-xl cursor-pointer flex justify-between items-center transition-colors active-press"
                          >
                            <div>
                              <span className="font-bold text-slate-800 text-xs md:text-sm font-mono text-indigo-700">{l.loan_id}</span>
                              <span className="text-xs text-slate-500 ml-2 font-medium">({(l.customers as any)?.full_name})</span>
                            </div>
                            <span className="text-xs font-bold text-slate-800">₹{l.principal_amount?.toLocaleString()}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-xs text-slate-400 px-3 py-1">No matching loans</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
          
          {/* Header Profile Actions */}
          <div className="flex items-center space-x-2">
            <span className="hidden sm:inline-block text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {role}
            </span>
            <button
              onClick={() => setIsProfileModalOpen(true)}
              className="h-8 w-8 rounded-full bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-xs shadow-sm uppercase cursor-pointer ring-2 ring-indigo-100 active-press transition-transform"
              title={`${profile?.full_name || 'User'} (${role})`}
            >
              {profile?.full_name ? profile.full_name[0] : (user?.email ? user.email[0] : 'U')}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content with Native iOS/Android Touch Inertia */}
        <div className="flex-1 overflow-auto touch-scroll p-3.5 sm:p-6 md:p-8 pb-[calc(82px+env(safe-area-inset-bottom,0px))] md:pb-8">
          {children}
        </div>

        {/* Mobile-First Native Floating Dock Tab Bar */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-[calc(62px+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] bg-white/92 backdrop-blur-xl border-t border-slate-200/80 flex items-center justify-around px-2 z-40 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]">
          <MobileNavItem to="/" icon={<Home size={20} />} label="Home" active={pathname === '/'} />
          <MobileNavItem to="/customers" icon={<Users size={20} />} label="Customers" active={pathname.startsWith('/customers')} />
          
          {/* Elevated Center Action FAB Button */}
          <Link
            href="/collections/new"
            className="flex flex-col items-center justify-center -mt-6 bg-gradient-to-tr from-indigo-600 via-indigo-600 to-blue-600 text-white w-13 h-13 rounded-full shadow-lg shadow-indigo-400/40 border-4 border-slate-50 active-press transition-transform"
            title="Record Collection"
          >
            <CreditCard size={21} className="drop-shadow-sm" />
          </Link>

          <MobileNavItem to="/loans" icon={<FileText size={20} />} label="Loans" active={pathname.startsWith('/loans')} />
          
          {role === 'Manager' || role === 'Admin' ? (
            <MobileNavItem to="/approvals" icon={<CheckCircle2 size={20} />} label="Approvals" active={pathname.startsWith('/approvals')} />
          ) : (
            <MobileNavItem to="/reports" icon={<Activity size={20} />} label="Reports" active={pathname.startsWith('/reports')} />
          )}
        </nav>

        {/* Profile Modal (Bottom Sheet style on Mobile) */}
        {isProfileModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsProfileModalOpen(false)}>
            <div className="w-full sm:w-[400px] bg-white rounded-t-[32px] sm:rounded-[32px] p-6 pb-8 animate-in slide-in-from-bottom-10 sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-200 shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-8 sm:hidden" />
              
              <div className="flex flex-col items-center">
                {/* Big Avatar */}
                <div className="h-24 w-24 rounded-[28px] bg-gradient-to-tr from-indigo-600 to-blue-500 text-white flex items-center justify-center font-bold text-[40px] shadow-sm ring-4 ring-white mb-2">
                  {profile?.full_name ? profile.full_name[0] : (user?.email ? user.email[0] : 'U')}
                </div>
                
                <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-3 uppercase">Account Profile</p>
                <h2 className="text-2xl font-black text-slate-900 mt-1">{profile?.full_name || 'User'}</h2>
                <p className="text-sm text-slate-500 mt-0.5 font-medium">{user?.email}</p>
                
                {/* Role Badges */}
                <div className="flex items-center justify-center space-x-2 mt-4">
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200 tracking-wider">
                    {role === 'Staff' ? 'Staff – Maker' : role === 'Manager' ? 'Manager – Checker' : role === 'Admin' ? 'Admin – Control' : role}
                  </span>
                  <span className="px-3 py-1.5 bg-slate-100 text-slate-700 text-[10px] font-bold uppercase rounded-lg border border-slate-200 tracking-wider">
                    {profile?.branch_id || 'MAIN BRANCH'}
                  </span>
                </div>
                
                {/* Action Button */}
                <div className="w-full mt-8">
                  <button onClick={signOut} className="w-full bg-rose-50 text-rose-600 hover:bg-rose-100 py-4 rounded-2xl flex items-center justify-center font-bold text-sm transition-colors active-press tracking-wide border border-rose-100">
                    <LogOut size={18} className="mr-2 stroke-[2.5]" /> SIGN OUT
                  </button>
                </div>
                
                <button onClick={() => setIsProfileModalOpen(false)} className="w-full mt-5 text-center text-slate-400 hover:text-slate-600 font-bold text-[11px] tracking-wider uppercase py-2 active-press transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

function NavItem({ to, icon, label, isOpen }: { to: string, icon: React.ReactNode, label: string, isOpen: boolean }) {
  const pathname = usePathname()
  const active = pathname === to || (to !== '/' && pathname.startsWith(to))

  return (
    <Link
      href={to}
      title={!isOpen ? label : undefined}
      className={`group relative flex items-center h-11 rounded-xl transition-all duration-150 ${
        isOpen ? 'px-3' : 'justify-center px-0'
      } ${
        active
          ? 'bg-indigo-50 text-indigo-700 font-semibold'
          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
      }`}
    >
      <span
        className={`w-5 h-5 flex items-center justify-center shrink-0 transition-colors ${
          active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
        }`}
      >
        {icon}
      </span>
      <span
        className={`ml-3 text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ease-in-out ${
          isOpen
            ? 'opacity-100 max-w-[170px] translate-x-0'
            : 'opacity-0 max-w-0 -translate-x-2 pointer-events-none ml-0'
        }`}
      >
        {label}
      </span>

      {/* Floating Tooltip when collapsed */}
      {!isOpen && (
        <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs font-medium rounded-lg shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
          {label}
        </div>
      )}
    </Link>
  )
}

function MobileNavItem({ to, icon, label, active }: { to: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link href={to} className={`flex flex-col items-center justify-center py-1 px-3 active-press transition-all relative ${active ? 'text-indigo-600 font-bold' : 'text-slate-500 hover:text-slate-800'}`}>
      <span className={`${active ? 'scale-110 text-indigo-600 transition-transform' : 'text-slate-500'}`}>
        {icon}
      </span>
      <span className={`text-[10px] mt-0.5 tracking-tight ${active ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}`}>
        {label}
      </span>
      {active && (
        <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 -mb-1 mt-0.5" />
      )}
    </Link>
  )
}
