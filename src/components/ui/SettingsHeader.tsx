"use client";

import React from 'react'
import { Breadcrumbs } from './Breadcrumbs'

interface SettingsHeaderProps {
  title: string
  description?: string
  breadcrumb?: string
  action?: React.ReactNode
}

export function SettingsHeader({
  title,
  description,
  breadcrumb,
  action
}: SettingsHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-5">
      <div className="min-w-0">
        <Breadcrumbs
          items={[
            { label: 'Settings', href: '/settings' },
            { label: breadcrumb || title }
          ]}
        />
        <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-slate-500 text-xs sm:text-sm mt-0.5">
            {description}
          </p>
        )}
      </div>
      {action && (
        <div className="shrink-0 flex items-center">
          {action}
        </div>
      )}
    </div>
  )
}
