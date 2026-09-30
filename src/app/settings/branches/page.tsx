"use client";

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { Plus, Building, MapPin, Search, Edit2, Trash2 } from 'lucide-react'
import Select from 'react-select'
import { customSelectStyles } from '@/components/ui/SelectStyles'
import { SettingsHeader } from '@/components/ui/SettingsHeader'

const MEETING_DAY_OPTIONS = [
  { value: 'Monday', label: 'Monday' },
  { value: 'Tuesday', label: 'Tuesday' },
  { value: 'Wednesday', label: 'Wednesday' },
  { value: 'Thursday', label: 'Thursday' },
  { value: 'Friday', label: 'Friday' },
  { value: 'Saturday', label: 'Saturday' },
  { value: 'Sunday', label: 'Sunday' }
]

export default function BranchManagement() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<'branches' | 'centers'>('branches')
  
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false)
  const [editingBranch, setEditingBranch] = useState<any>(null)
  const [branchData, setBranchData] = useState({ id: '', name: '', code: '' })

  const [isCenterModalOpen, setIsCenterModalOpen] = useState(false)
  const [editingCenter, setEditingCenter] = useState<any>(null)
  const [centerData, setCenterData] = useState({ id: '', name: '', branch_id: '', meeting_day: '' })

  const { data: branches, isLoading: loadingBranches } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data } = await supabase.from('branches').select('*').order('name')
      return data || []
    }
  })

  const { data: centers, isLoading: loadingCenters } = useQuery({
    queryKey: ['centers'],
    queryFn: async () => {
      const { data } = await supabase.from('centers').select('*, branches(name)').order('name')
      return data || []
    }
  })

  const saveBranch = useMutation({
    mutationFn: async (branch: any) => {
      const payload = { name: branch.name, code: branch.code }
      if (branch.id) {
        await supabase.from('branches').update(payload).eq('id', branch.id)
      } else {
        await supabase.from('branches').insert(payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] })
      setIsBranchModalOpen(false)
    }
  })

  const saveCenter = useMutation({
    mutationFn: async (center: any) => {
      const payload = { name: center.name, branch_id: center.branch_id, meeting_day: center.meeting_day }
      if (center.id) {
        await supabase.from('centers').update(payload).eq('id', center.id)
      } else {
        await supabase.from('centers').insert(payload)
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['centers'] })
      setIsCenterModalOpen(false)
    }
  })

  const openBranchModal = (branch: any = null) => {
    if (branch) {
      setEditingBranch(branch)
      setBranchData(branch)
    } else {
      setEditingBranch(null)
      setBranchData({ id: '', name: '', code: '' })
    }
    setIsBranchModalOpen(true)
  }

  const openCenterModal = (center: any = null) => {
    if (center) {
      setEditingCenter(center)
      setCenterData({ id: center.id, name: center.name, branch_id: center.branch_id, meeting_day: center.meeting_day })
    } else {
      setEditingCenter(null)
      setCenterData({ id: '', name: '', branch_id: '', meeting_day: 'Monday' })
    }
    setIsCenterModalOpen(true)
  }

  const deleteBranch = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['branches'] }),
    onError: (err: any) => alert(`Failed to delete branch: ${err.message || 'Cannot delete branch with active centers or staff'}`)
  })

  const handleDeleteBranch = (branch: any) => {
    if (confirm(`Are you sure you want to delete branch "${branch.name}" (${branch.code})? This will also remove its associated centers.`)) {
      deleteBranch.mutate(branch.id)
    }
  }

  const deleteCenter = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('centers').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['centers'] }),
    onError: (err: any) => alert(`Failed to delete center: ${err.message || 'Cannot delete center with active loans or customers'}`)
  })

  const handleDeleteCenter = (center: any) => {
    if (confirm(`Are you sure you want to delete center "${center.name}"?`)) {
      deleteCenter.mutate(center.id)
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <SettingsHeader
        title="Branches & Centers"
        description="Manage the hierarchy of branches and center meeting details."
        breadcrumb="Branches & Centers"
        action={
          <button 
            onClick={() => activeTab === 'branches' ? openBranchModal() : openCenterModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-semibold transition-all flex items-center shadow-xs active:scale-95"
          >
            <Plus size={18} className="mr-1.5" />
            <span>{activeTab === 'branches' ? 'Add Branch' : 'Add Center'}</span>
          </button>
        }
      />

      <div className="flex space-x-2 border-b border-slate-200">
        <button onClick={() => setActiveTab('branches')} className={`pb-3 px-4 text-sm font-medium relative ${activeTab === 'branches' ? 'text-indigo-600' : 'text-slate-500'}`}>
          Branches
          {activeTab === 'branches' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
        </button>
        <button onClick={() => setActiveTab('centers')} className={`pb-3 px-4 text-sm font-medium relative ${activeTab === 'centers' ? 'text-indigo-600' : 'text-slate-500'}`}>
          Centers
          {activeTab === 'centers' && <span className="absolute bottom-0 left-0 w-full h-0.5 bg-indigo-600 rounded-t-full"></span>}
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden min-h-[400px]">
        {activeTab === 'branches' && (
          <div>
            {/* Native Mobile Cards View (< md) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {branches?.map((branch: any) => (
                <div key={branch.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
                      <Building size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-slate-900 text-sm truncate">{branch.name}</span>
                        <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 shrink-0">
                          {branch.code}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {centers?.filter((c:any) => c.branch_id === branch.id).length || 0} Centers assigned
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => openBranchModal(branch)}
                      className="p-2 text-slate-400 hover:text-indigo-600 active:bg-indigo-50 rounded-xl transition-colors active-press"
                      title="Edit Branch"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteBranch(branch)}
                      className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition-colors active-press"
                      title="Delete Branch"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Branch Code</th>
                    <th className="px-6 py-4">Branch Name</th>
                    <th className="px-6 py-4">Centers Count</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {branches?.map((branch: any) => (
                    <tr key={branch.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-700">{branch.code}</td>
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <span className="flex items-center"><Building size={16} className="mr-2 text-indigo-500" /> {branch.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">
                        {centers?.filter((c:any) => c.branch_id === branch.id).length || 0} centers
                      </td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button onClick={() => openBranchModal(branch)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Branch">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteBranch(branch)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Branch">
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

        {activeTab === 'centers' && (
          <div>
            {/* Native Mobile Cards View (< md) */}
            <div className="divide-y divide-slate-100 md:hidden">
              {centers?.map((center: any) => (
                <div key={center.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors">
                  <div className="flex items-center space-x-3 min-w-0">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
                      <MapPin size={18} />
                    </div>
                    <div className="min-w-0">
                      <span className="font-bold text-slate-900 text-sm block truncate">{center.name}</span>
                      <div className="flex items-center space-x-2 text-xs text-slate-500 mt-0.5">
                        <span className="truncate">{center.branches?.name}</span>
                        <span>•</span>
                        <span className="font-medium text-indigo-600">{center.meeting_day}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    <button
                      onClick={() => openCenterModal(center)}
                      className="p-2 text-slate-400 hover:text-indigo-600 active:bg-indigo-50 rounded-xl transition-colors active-press"
                      title="Edit Center"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDeleteCenter(center)}
                      className="p-2 text-slate-400 hover:text-rose-600 active:bg-rose-50 rounded-xl transition-colors active-press"
                      title="Delete Center"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                  <tr>
                    <th className="px-6 py-4">Center Name</th>
                    <th className="px-6 py-4">Branch</th>
                    <th className="px-6 py-4">Meeting Day</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {centers?.map((center: any) => (
                    <tr key={center.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-800">
                        <span className="flex items-center"><MapPin size={16} className="mr-2 text-emerald-500" /> {center.name}</span>
                      </td>
                      <td className="px-6 py-4 text-slate-600">{center.branches?.name}</td>
                      <td className="px-6 py-4 text-slate-600">{center.meeting_day}</td>
                      <td className="px-6 py-4 text-right space-x-1">
                        <button onClick={() => openCenterModal(center)} className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Edit Center">
                          <Edit2 size={16} />
                        </button>
                        <button onClick={() => handleDeleteCenter(center)} className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors" title="Delete Center">
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

      {isBranchModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingBranch ? 'Edit Branch' : 'Add New Branch'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Code</label>
                <input 
                  type="text" 
                  value={branchData.code}
                  onChange={e => setBranchData({...branchData, code: e.target.value.toUpperCase()})}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase"
                  placeholder="e.g. BR01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch Name</label>
                <input 
                  type="text" 
                  value={branchData.name}
                  onChange={e => setBranchData({...branchData, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g. North District"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setIsBranchModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button 
                onClick={() => saveBranch.mutate(branchData)}
                disabled={!branchData.code || !branchData.name || saveBranch.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveBranch.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isCenterModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingCenter ? 'Edit Center' : 'Add New Center'}</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Center Name</label>
                <input 
                  type="text" 
                  value={centerData.name}
                  onChange={e => setCenterData({...centerData, name: e.target.value})}
                  className="w-full border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                  placeholder="e.g. Market Center"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Branch</label>
                <Select
                  value={branches?.map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` })).find((opt: any) => opt.value === centerData.branch_id) || null}
                  options={branches?.map((b: any) => ({ value: b.id, label: `${b.name} (${b.code})` })) || []}
                  onChange={(opt) => setCenterData({ ...centerData, branch_id: opt?.value || '' })}
                  placeholder="-- Select a branch --"
                  isClearable
                  isSearchable
                  styles={customSelectStyles}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Meeting Day</label>
                <Select
                  value={MEETING_DAY_OPTIONS.find(opt => opt.value === centerData.meeting_day) || null}
                  options={MEETING_DAY_OPTIONS}
                  onChange={(opt) => setCenterData({ ...centerData, meeting_day: opt?.value || 'Monday' })}
                  placeholder="-- Select Meeting Day --"
                  isSearchable={false}
                  styles={customSelectStyles}
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button onClick={() => setIsCenterModalOpen(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">Cancel</button>
              <button 
                onClick={() => saveCenter.mutate(centerData)}
                disabled={!centerData.name || !centerData.branch_id || saveCenter.isPending}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {saveCenter.isPending ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
