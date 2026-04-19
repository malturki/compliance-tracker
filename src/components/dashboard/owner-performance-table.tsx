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
    if (sortKey !== columnKey) return <ChevronDown className="w-3 h-3 text-steel/70 inline-block" />
    return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 text-graphite inline-block" /> : <ChevronDown className="w-3 h-3 text-graphite inline-block" />
  }
  
  return (
    <div className="border border-black/5 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-black/5">
        <h3 className="text-sm font-semibold text-graphite uppercase tracking-wider">Owner Performance</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full md:min-w-[640px] text-xs">
          <thead>
            <tr className="border-b border-silicon/40 text-steel">
              <th
                className="text-left py-2.5 px-3 font-medium cursor-pointer hover:text-graphite select-none"
                onClick={() => handleSort('owner')}
              >
                Owner <SortIcon columnKey="owner" />
              </th>
              <th
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-graphite select-none"
                onClick={() => handleSort('total')}
              >
                Total <SortIcon columnKey="total" />
              </th>
              <th
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-graphite select-none"
                onClick={() => handleSort('overdue')}
              >
                Overdue <SortIcon columnKey="overdue" />
              </th>
              <th className="text-center py-2.5 px-3 font-medium hidden md:table-cell">
                Upcoming
              </th>
              <th
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-graphite select-none"
                onClick={() => handleSort('completionRate')}
              >
                On-Time Rate <SortIcon columnKey="completionRate" />
              </th>
              <th
                className="text-center py-2.5 px-3 font-medium cursor-pointer hover:text-graphite select-none hidden md:table-cell"
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
                className={`border-b border-silicon/40 transition-colors ${idx % 2 === 0 ? '' : 'bg-canvas'} hover:bg-silicon/[0.18]`}
              >
                <td className="py-2 px-3 font-medium text-graphite">
                  {owner.owner}
                </td>
                <td className="py-2 px-3 text-center text-steel font-mono">
                  {owner.total}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`
                    inline-flex items-center justify-center px-2 py-0.5 text-[10px] font-mono font-semibold border
                    ${owner.overdue === 0 ? 'bg-success/10 text-success border-success/30' : 'bg-danger/10 text-danger border-danger/30'}
                  `}>
                    {owner.overdue}
                  </span>
                </td>
                <td className="py-2 px-3 text-center text-steel font-mono hidden md:table-cell">
                  {owner.upcoming}
                </td>
                <td className="py-2 px-3 text-center">
                  <span className={`
                    font-mono font-semibold
                    ${owner.completionRate >= 90 ? 'text-success' :
                      owner.completionRate >= 70 ? 'text-warning' :
                      'text-danger'}
                  `}>
                    {owner.completionRate}%
                  </span>
                </td>
                <td className="py-2 px-3 text-center hidden md:table-cell">
                  <span className={`
                    font-mono text-[11px]
                    ${owner.avgDaysToComplete <= 0 ? 'text-success' :
                      owner.avgDaysToComplete <= 3 ? 'text-warning' :
                      'text-danger'}
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
