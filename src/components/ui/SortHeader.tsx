import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

interface SortHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null | undefined;
  sortDirection: 'asc' | 'desc' | null;
  onSort: (key: string) => void;
  className?: string;
}

export function SortHeader({ label, sortKey, currentSortKey, sortDirection, onSort, className = "px-6 py-4" }: SortHeaderProps) {
  const isActive = currentSortKey === sortKey;
  
  return (
    <th 
      className={`cursor-pointer hover:bg-slate-100 transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center space-x-1">
        <span>{label}</span>
        <span className="text-slate-400">
          {!isActive && <ChevronsUpDown size={14} />}
          {isActive && sortDirection === 'asc' && <ChevronUp size={14} className="text-indigo-600" />}
          {isActive && sortDirection === 'desc' && <ChevronDown size={14} className="text-indigo-600" />}
        </span>
      </div>
    </th>
  );
}
