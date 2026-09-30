"use client";

import { Building, Users, Settings2, ShieldCheck, MessageCircle, Activity, ChevronRight, Lock } from 'lucide-react'
import Link from 'next/link'

export default function Settings() {
  const sections = [
    { title: 'Branches & Centers', desc: 'Manage branch hierarchies and center meetings.', icon: <Building size={24} />, href: '/settings/branches', color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600' },
    { title: 'User Roles & Staff', desc: 'Manage permissions and field staff assignments.', icon: <Users size={24} />, href: '/settings/users', color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { title: 'Product Configs', desc: 'Update loan terms, EWI structures, and fees.', icon: <Settings2 size={24} />, color: 'from-amber-400 to-orange-500', bg: 'bg-orange-50', text: 'text-orange-600' },
    { title: 'Security & Access', desc: 'Device limits, offline controls, and backups.', icon: <ShieldCheck size={24} />, href: '/settings/security', color: 'from-rose-400 to-rose-600', bg: 'bg-rose-50', text: 'text-rose-600' },
    { title: 'Activity Logs', desc: 'Audit trail of user actions across the platform.', icon: <Activity size={24} />, href: '/settings/activity', color: 'from-purple-400 to-purple-600', bg: 'bg-purple-50', text: 'text-purple-600' },
    { title: 'WhatsApp Integration', desc: 'Configure SMS reminders and templates.', icon: <MessageCircle size={24} />, color: 'from-teal-400 to-emerald-500', bg: 'bg-teal-50', text: 'text-teal-600' },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-slate-800 tracking-tight">System Settings</h1>
          <p className="text-slate-500 mt-2 text-sm md:text-base max-w-xl">Configure RAM Finance application rules, manage permissions, and track system-wide activity.</p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold text-slate-400 bg-slate-100 px-3 py-1.5 rounded-full w-fit">
          <Lock size={14} className="text-slate-400" />
          <span>Admin Access Only</span>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
        {sections.map((section, idx) => {
          const CardWrapper = section.href ? Link : 'div'
          
          return (
            <CardWrapper
              key={idx}
              href={section.href || '#'}
              className={`group relative bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-xl hover:shadow-${section.text.split('-')[1]}-500/10 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer active:scale-[0.98]`}
            >
              {/* Decorative Background Gradient (visible on hover) */}
              <div className={`absolute inset-0 bg-gradient-to-br ${section.color} opacity-0 group-hover:opacity-[0.03] transition-opacity duration-500`} />
              
              <div className="flex items-start justify-between mb-4 relative z-10">
                <div className={`w-14 h-14 rounded-2xl ${section.bg} ${section.text} flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 ease-out`}>
                  {section.icon}
                </div>
                
                <div className="w-8 h-8 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-slate-800 group-hover:text-white group-hover:border-slate-800 transition-all duration-300 shadow-sm">
                  <ChevronRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              
              <div className="relative z-10 flex-1 flex flex-col">
                <h3 className="text-lg font-bold text-slate-800 group-hover:text-slate-900 mb-2">{section.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed group-hover:text-slate-600">{section.desc}</p>
                
                {!section.href && (
                  <span className="inline-block mt-4 text-[10px] uppercase font-bold tracking-wider text-slate-400 bg-slate-100 px-2 py-1 rounded w-fit">
                    Coming Soon
                  </span>
                )}
              </div>
            </CardWrapper>
          )
        })}
      </div>
    </div>
  )
}
