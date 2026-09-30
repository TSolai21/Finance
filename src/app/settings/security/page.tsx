"use client";

import { useState } from 'react'
import { Key, Shield, Smartphone } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SettingsHeader } from '@/components/ui/SettingsHeader'

export default function SecuritySettings() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState({ text: '', type: '' })

  const handlePasswordUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setMessage({ text: "Passwords don't match.", type: 'error' })
      return
    }
    
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    
    if (error) {
      setMessage({ text: error.message, type: 'error' })
    } else {
      setMessage({ text: 'Password successfully updated!', type: 'success' })
      setPassword('')
      setConfirmPassword('')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <SettingsHeader
        title="Security & Access"
        description="Manage passwords, sessions, and device security."
        breadcrumb="Security & Access"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Password Management */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
            <div className="flex items-center mb-4 border-b border-slate-100 pb-4">
              <div className="h-10 w-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mr-4">
                <Key size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Change Password</h2>
                <p className="text-sm text-slate-500">Update your account password securely.</p>
              </div>
            </div>
            
            <form onSubmit={handlePasswordUpdate} className="space-y-4">
              {message.text && (
                <div className={`p-3 rounded-lg text-sm font-medium ${message.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                  {message.text}
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Minimum 6 characters"
                  required
                  minLength={6}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <input 
                  type="password" 
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Re-type new password"
                  required
                  minLength={6}
                />
              </div>
              
              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={loading || !password || !confirmPassword}
                  className="bg-indigo-600 text-white px-5 py-2.5 rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </section>

          {/* Session Management Placeholder */}
          <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm opacity-60">
            <div className="flex items-center mb-4">
              <div className="h-10 w-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600 mr-4">
                <Smartphone size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Active Sessions (Coming Soon)</h2>
                <p className="text-sm text-slate-500">Review and revoke active devices.</p>
              </div>
            </div>
          </section>
        </div>

        {/* Security Info Panel */}
        <div className="md:col-span-1">
          <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-xl p-6 text-white shadow-lg">
            <Shield className="text-indigo-400 mb-4 h-8 w-8" />
            <h3 className="font-semibold text-lg mb-2">Security Posture</h3>
            <p className="text-slate-300 text-sm mb-4">Your connection is secured with end-to-end encryption. Supabase handles token rotation automatically.</p>
            <ul className="space-y-3 text-sm text-slate-300">
              <li className="flex items-start">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 flex-shrink-0"></div>
                Auth Tokens expire every hour
              </li>
              <li className="flex items-start">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 mt-1.5 mr-2 flex-shrink-0"></div>
                Role-Based Access Control Active
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
