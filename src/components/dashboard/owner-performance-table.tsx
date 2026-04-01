'use client'

import { useState } from 'react'

interface OwnerMetrics {
  owner: string
  total: number
  completed: number
  overdue: number
  upcoming: number
  completionRate: number
  avgDaysToComplete: number
}

interface Props {
  owners: OwnerMetrics[]
}

type SortKey = 'owner' | 'total' | 'overdue' | 'completionRate' | 'avgDaysToComplete'
type SortOrder = 'asc' | 'desc'

export function OwnerPerformanceTable({ owners }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>('overdue')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }
  
  const sortedOwners = [...owners].sort((a, b) => {
    const aVal = a[sortKey]
    const bVal = b[sortKey]
    
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortOrder === 'asc' 
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal)
    }
    
    return sortOrder === 'asc' 
      ? (aVal as number) - (bVal as number)
      : (bVal as number) - (aVal as number)
  })
  
  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return <span className="text-slate-400">↕</span>
    return <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
  }
  
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">Owner Performance</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th 
                className="text-left py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('owner')}
              >
                Owner <SortIcon columnKey="owner" />
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('total')}
              >
                Total <SortIcon columnKey="total" />
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('overdue')}
              >
                Overdue <SortIcon columnKey="overdue" />
              </th>
              <th className="text-center py-3 px-4 font-semibold text-slate-700">
                Upcoming
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('completionRate')}
              >
                On-Time Rate <SortIcon columnKey="completionRate" />
              </th>
              <th 
                className="text-center py-3 px-4 font-semibold text-slate-700 cursor-pointer hover:bg-slate-50"
                onClick={() => handleSort('avgDaysToComplete')}
              >
                Avg Days <SortIcon columnKey="avgDaysToComplete" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedOwners.map((owner, idx) => (
              <tr 
                key={owner.owner}
                className={`border-b border-slate-100 ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}
              >
                <td className="py-3 px-4 font-medium text-slate-900">
                  {owner.owner}
                </td>
                <td className="py-3 px-4 text-center text-slate-700">
                  {owner.total}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`
                    inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold
                    ${owner.overdue === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}
                  `}>
                    {owner.overdue}
                  </span>
                </td>
                <td className="py-3 px-4 text-center text-slate-700">
                  {owner.upcoming}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`
                    font-semibold
                    ${owner.completionRate >= 90 ? 'text-green-600' : 
                      owner.completionRate >= 70 ? 'text-amber-600' : 
                      'text-red-600'}
                  `}>
                    {owner.completionRate}%
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`
                    font-mono text-xs
                    ${owner.avgDaysToComplete <= 0 ? 'text-green-600' :
                      owner.avgDaysToComplete <= 3 ? 'text-amber-600' :
                      'text-red-600'}
                  `}>
                    {owner.avgDaysToComplete > 0 ? '+' : ''}{owner.avgDaysToComplete}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
