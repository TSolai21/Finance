"use client";

import { useQuery } from '@tanstack/react-query'
import { Activity as ActivityIcon, User } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { SettingsHeader } from '@/components/ui/SettingsHeader'

export default function ActivityLogs() {
  const { data: logs, isLoading } = useQuery({
    queryKey: ['activity_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*, profiles(full_name, role)')
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (error) throw error
      return data
    }
  })

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      <SettingsHeader
        title="System Activity Logs"
        description="Audit trail of user actions across the platform."
        breadcrumb="Activity Logs"
      />

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden min-h-[400px]">
        {isLoading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
          </div>
        ) : logs && logs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 uppercase text-xs font-semibold">
                <tr>
                  <th className="px-6 py-4">Timestamp</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Action</th>
                  <th className="px-6 py-4">Description</th>
                  <th className="px-6 py-4">Target ID</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 font-medium text-slate-800">
                      <div className="flex items-center">
                        <User size={14} className="mr-2 text-slate-400" />
                        {log.profiles?.full_name || 'System'}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 rounded bg-slate-100 text-slate-600 font-mono text-xs">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{log.description || '-'}</td>
                    <td className="px-6 py-4 text-slate-400 font-mono text-xs truncate max-w-[150px]" title={log.target_id}>
                      {log.target_id || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-[400px] text-center text-slate-500">
             <ActivityIcon size={48} className="mx-auto mb-4 text-slate-300" />
             <p className="text-lg font-medium text-slate-700 mb-1">No activity recorded yet</p>
             <p className="text-sm">Logs will appear here as users interact with the system.</p>
          </div>
        )}
      </div>
    </div>
  )
}
