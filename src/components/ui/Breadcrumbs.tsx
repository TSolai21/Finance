"use client";

import Link from 'next/link'
import React from 'react'

export interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
  className?: string
}

export function Breadcrumbs({ items, className = '' }: BreadcrumbsProps) {
  if (!items || items.length === 0) return null

  return (
    <nav className={`flex items-center gap-1.5 text-xs font-semibold text-slate-400 mb-1.5 ${className}`} aria-label="Breadcrumb">
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <React.Fragment key={index}>
            {item.href && !isLast ? (
              <Link href={item.href} className="hover:text-indigo-600 transition-colors">
                {item.label}
              </Link>
            ) : (
              <span className={isLast ? "text-slate-700 truncate" : ""}>{item.label}</span>
            )}
            {!isLast && <span className="text-slate-300">/</span>}
          </React.Fragment>
        )
      })}
    </nav>
  )
}
