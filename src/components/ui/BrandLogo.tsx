import React from 'react'
import { Activity } from 'lucide-react'

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg'
  orientation?: 'horizontal' | 'vertical'
  showText?: boolean
  subtitle?: string
  className?: string
  textClassName?: string
}

export function BrandLogo({
  size = 'sm',
  orientation = 'horizontal',
  showText = true,
  subtitle,
  className = '',
  textClassName = ''
}: BrandLogoProps) {
  const getDimensions = () => {
    switch (size) {
      case 'lg':
        return {
          box: 'h-16 w-16 rounded-2xl shadow-xl shadow-indigo-500/25',
          icon: 32,
          text: 'text-3xl font-extrabold'
        }
      case 'md':
        return {
          box: 'h-10 w-10 rounded-xl shadow-md shadow-indigo-500/20',
          icon: 22,
          text: 'text-xl font-bold'
        }
      case 'sm':
      default:
        return {
          box: 'h-8 w-8 rounded-xl shadow-md shadow-indigo-500/20',
          icon: 18,
          text: 'text-lg font-bold'
        }
    }
  }

  const { box, icon, text } = getDimensions()
  const isVertical = orientation === 'vertical'

  return (
    <div
      className={`flex ${
        isVertical ? 'flex-col items-center text-center space-y-3' : 'items-center space-x-2.5'
      } ${className}`}
    >
      <div
        className={`${box} bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white transform -rotate-6 shrink-0 transition-transform duration-200 hover:rotate-0`}
      >
        <Activity size={icon} className="text-white transform rotate-6" />
      </div>
      {showText && (
        <div className="leading-tight overflow-hidden">
          <span
            className={`${text} bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent tracking-tight whitespace-nowrap block ${textClassName}`}
          >
            RAM Finance
          </span>
          {subtitle && (
            <span className="text-[10px] text-indigo-600 font-semibold uppercase tracking-wider whitespace-nowrap block mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
