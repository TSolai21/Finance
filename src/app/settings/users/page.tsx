"use client";

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Plus, User, Building, MapPin, Search, Edit2, Trash2 } from 'lucide-react'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'
import { SettingsHeader } from '@/components/ui/SettingsHeader'

const ROLE_OPTIONS = [
  { value: 'Staff', label: 'Staff – Maker' },
  { value: 'Manager', label: 'Manager – Checker' },
  { value: 'Admin', label: 'Admin – Control' }
]

function getRoleBadge(role: string) {
  switch (role) {
    case 'Admin':
      return { label: 'Admin – Control', badgeClass: 'bg-purple-100 text-purple-700 border border-purple-200' }
    case 'Manager':
      return { label: 'Manager – Checker', badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200' }
    case 'Staff':
    default:
      return { label: 'Staff – Maker', badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200' }
  }
}

export default function UserManagement() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  
  const [formData, setFormData] = useState({
    id: '',
    email: '',
    password: '',
    full_name: '',
    role: 'Staff',
    branch_id: '',
    center_id: ''
  })

  // Fetch profiles
  const { data: users, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, branches(name), centers(name)')
        
      if (error) throw error
      return data
    }
  })

  // Fetch branches and centers for assignments
  const { data: branches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*')
      return data || []
    }
  })

  const { data: centers } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const { data } = await supabase.from('centers').select('*')
      return data || []
    }
  })

  const createUser = useMutation({
    mutationFn: async (user: any) => {
      // Create user in Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: user.email,
        password: user.password,
      })
      if (authError) throw authError

      // Note: We're assuming the trigger isn't failing or we manually update it
      if (authData?.user?.id) {
        const payload: any = {
          full_name: user.full_name,
          role: user.role,
        }
        if (user.branch_id) payload.branch_id = user.branch_id
        if (user.center_id) payload.center_id = user.center_id

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert({ id: authData.user.id, ...payload })
          
        if (profileError) throw profileError
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsModalOpen(false)
      setFormData({ id: '', email: '', password: '', full_name: '', role: 'Staff', branch_id: '', center_id: '' })
    }
  })

  const updateUser = useMutation({
    mutationFn: async (user: any) => {
      const payload: any = {
        full_name: user.full_name,
        role: user.role,
        branch_id: user.role === 'Admin' ? null : (user.branch_id || null),
        center_id: user.role === 'Staff' ? (user.center_id || null) : null
      }
      
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', user.id)
        
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsModalOpen(false)
      setEditingUser(null)
      setFormData({ id: '', email: '', password: '', full_name: '', role: 'Staff', branch_id: '', center_id: '' })
    }
  })

  const handleEdit = (user: any) => {
    setEditingUser(user)
    setFormData({
      id: user.id,
      email: user.email || '', // We don't have email in profiles directly, but that's ok
      password: '',
      full_name: user.full_name,
      role: user.role,
      branch_id: user.branch_id || '',
      center_id: user.center_id || ''
    })
    setIsModalOpen(true)
  }

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', userId)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
    onError: (err: any) => {
      alert(`Failed to delete user: ${err.message || 'Cannot delete user with linked data'}`)
    }
  })

  const handleDelete = (user: any) => {
    if (confirm(`Are you sure you want to delete user "${user.full_name}"?`)) {
      deleteUser.mutate(user.id)
    }
  }

  const filteredUsers = users?.filter((u: any) => 
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SettingsHeader
        title="User Roles & Staff"
        description="Manage permissions and field staff assignments."
        breadcrumb="User Roles"
        action={
          <button 
            onClick={() => {
              setEditingUser(null)
              setFormData({ id: '', email: '', password: '', full_name: '', role: 'Staff', branch_id: '', center_id: '' })
              setIsModalOpen(true)
            }}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center shadow-xs active:scale-95"
          >
            <Plus size={18} className="mr-1.5" />
            <span>Add User</span>
          </button>
        }
      />

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50">
          <div className="relative max-w-md">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Search by name or role..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-slate-500">Loading users...</div>
        ) : (
          <div>
            {/* Native Mobile Cards View (< md) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {filteredUsers?.map((user: any) => (
                <div key={user.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-100 to-blue-100 text-indigo-700 flex items-center justify-center font-bold uppercase text-sm shrink-0 border border-indigo-200">
                      {user.full_name?.[0] || 'U'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm truncate">{user.full_name}</span>
                        {(() => {
                          const { label, badgeClass } = getRoleBadge(user.role)
                          return (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                              {label}
                            </span>
                          )
                        })()}
                      </div>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                        {user.branches?.name && (
                          <span className="flex items-center truncate">
                            <Building size={12} className="mr-1 text-slate-400 shrink-0" />
                            {user.branches.name}
                          </span>
                        )}
                        {user.centers?.name && (
                          <span className="flex items-center truncate">
                            <MapPin size={12} className="mr-1 text-slate-400 shrink-0" />
                            {user.centers.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => handleEdit(user)}
                      className="p-2 text-slate-400 hover:text-indigo-600 active:bg-indigo-50 rounded-xl transition-colors active-press"
                      title="Edit User"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(user)}
                      className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition-colors active-press"
                      title="Delete User"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
              {!filteredUsers?.length && (
                <div className="p-8 text-center text-slate-400 text-xs">No users matching search.</div>
              )}
            </div>

            {/* Desktop Full Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Branch Assignment</th>
                    <th className="px-6 py-4">Center Assignment</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredUsers?.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <div className="flex items-center">
                          <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-bold mr-3 uppercase">
                            {user.full_name?.[0] || 'U'}
                          </div>
                          {user.full_name}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {(() => {
                          const { label, badgeClass } = getRoleBadge(user.role)
                          return (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${badgeClass}`}>
                              {label}
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {user.branches?.name ? (
                          <span className="flex items-center"><Building size={14} className="mr-1 text-slate-400" /> {user.branches.name}</span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {user.centers?.name ? (
                          <span className="flex items-center"><MapPin size={14} className="mr-1 text-slate-400" /> {user.centers.name}</span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button onClick={() => handleEdit(user)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit User">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDelete(user)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete User">
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingUser ? 'Edit User' : 'Add New User'}</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input 
                  type="text" 
                  value={formData.full_name}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g. John Doe"
                />
              </div>
              
              {!editingUser && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="name@ramfinance.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <input 
                      type="password" 
                      value={formData.password}
                      onChange={e => setFormData({...formData, password: e.target.value})}
                      className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                      placeholder="Minimum 6 characters"
                    />
                  </div>
                </>
              )}
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                <Select
                  value={ROLE_OPTIONS.find(opt => opt.value === formData.role)}
                  options={ROLE_OPTIONS}
                  onChange={(opt) => {
                    const newRole = opt?.value || 'Staff'
                    setFormData({
                      ...formData,
                      role: newRole,
                      branch_id: newRole === 'Admin' ? '' : formData.branch_id,
                      center_id: newRole !== 'Staff' ? '' : formData.center_id
                    })
                  }}
                  styles={customSelectStyles}
                  isSearchable
                />
              </div>

              {(formData.role === 'Manager' || formData.role === 'Staff') && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Branch</label>
                  <Select
                    value={branches?.map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` })).find((opt: any) => opt.value === formData.branch_id) || null}
                    options={branches?.map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` })) || []}
                    onChange={(opt) => setFormData({ ...formData, branch_id: opt?.value || '', center_id: '' })}
                    placeholder="-- Select Branch --"
                    isClearable
                    isSearchable
                    styles={customSelectStyles}
                  />
                </div>
              )}

              {formData.role === 'Staff' && formData.branch_id && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Center</label>
                  <Select
                    value={centers?.filter((c: any) => c.branch_id === formData.branch_id).map((c: any) => ({ value: c.id, label: c.name })).find((opt: any) => opt.value === formData.center_id) || null}
                    options={centers?.filter((c: any) => c.branch_id === formData.branch_id).map((c: any) => ({ value: c.id, label: c.name })) || []}
                    onChange={(opt) => setFormData({ ...formData, center_id: opt?.value || '' })}
                    placeholder="-- Select Center --"
                    isClearable
                    isSearchable
                    styles={customSelectStyles}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button 
                onClick={() => { setIsModalOpen(false); setEditingUser(null); }} 
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => editingUser ? updateUser.mutate(formData) : createUser.mutate(formData)}
                disabled={(!editingUser && (!formData.email || !formData.password)) || !formData.full_name || createUser.isPending || updateUser.isPending}
                className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {createUser.isPending || updateUser.isPending ? 'Saving...' : 'Save User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
