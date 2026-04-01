'use client'

import { useState } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'

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
    if (sortKey !== columnKey) return <ChevronDown className="w-3 h-3 text-slate-600 inline-block" />
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-amber-400 inline-block" /> : <ChevronDown className="w-3 h-3 text-amber-400 inline-block" />
  }
  
  return (
    <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
      <div className="px-4 py-3 border-b border-[#1e2d47]">
        <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Owner Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[#1e2d47] text-slate-500">
              <th 
                className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-slate-300 select-none"
                onClick={() => handleSort('owner')}
              >
                Owner <SortIcon columnKey="owner" />
              </th>
              <th 
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-slate-300 select-none"
                onClick={() => handleSort('total')}
              >
                Total <SortIcon columnKey="total" />
              </th>
              <th 
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-slate-300 select-none"
                onClick={() => handleSort('overdue')}
              >
                Overdue <SortIcon columnKey="overdue" />
              </th>
              <th className="text-center py-2.5 px-3 font-medium">
                Upcoming
              </th>
              <th 
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-slate-300 select-none"
                onClick={() => handleSort('completionRate')}
              >
                On-Time Rate <SortIcon columnKey="completionRate" />
              </th>
              <th 
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-slate-300 select-none"
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
                className={`border-b border-[#1e2d47]/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-[#0a0e1a]/30'} hover:bg-[#162035]`}
              >
                <td className="py-2 px-3 font-medium text-slate-200">
                  {owner.owner}
                </td>
                <td className="py-2 px-3 text-center text-slate-400 font-mono">
                  {owner.total}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`
                    inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-semibold border
                    ${owner.overdue === 0 ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900/40' : 'bg-red-950/40 text-red-400 border-red-900/40'}
                  `}>
                    {owner.overdue}
                  </span>
                </td>
                <td className="py-2 px-3 text-center text-slate-400 font-mono">
                  {owner.upcoming}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`
                    font-mono font-semibold
                    ${owner.completionRate >= 90 ? 'text-emerald-400' : 
                      owner.completionRate >= 70 ? 'text-amber-400' : 
                      'text-red-400'}
                  `}>
                    {owner.completionRate}%
                  </span>
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`
                    font-mono text-[11px]
                    ${owner.avgDaysToComplete <= 0 ? 'text-emerald-400' :
                      owner.avgDaysToComplete <= 3 ? 'text-amber-400' :
                      'text-red-400'}
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
