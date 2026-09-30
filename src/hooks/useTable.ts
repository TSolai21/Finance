import { useState, useMemo } from 'react';

type SortConfig<T> = {
  key: keyof T;
  direction: 'asc' | 'desc';
} | null;

export function useTable<T>(
  data: T[] | undefined,
  options?: {
    itemsPerPage?: number;
    initialSort?: { key: keyof T; direction: 'asc' | 'desc' };
  }
) {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>(options?.initialSort || null);
  const itemsPerPage = options?.itemsPerPage || 10;

  const sortedData = useMemo(() => {
    let sortableItems = data ? [...data] : [];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedData.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedData, currentPage, itemsPerPage]);

  const requestSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    setCurrentPage(1); // Reset to first page when sorting
  };

  const getSortDirection = (key: keyof T) => {
    if (!sortConfig || sortConfig.key !== key) return null;
    return sortConfig.direction;
  };

  return {
    paginatedData,
    currentPage,
    totalPages,
    setCurrentPage,
    requestSort,
    getSortDirection,
    totalItems: sortedData.length
  };
}
