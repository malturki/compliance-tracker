'use client'

import { useEffect, useState } from 'react'
import { formatDate, getCategoryLabel, getRiskColor } from '@/lib/utils'
import type { Obligation } from '@/lib/types'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import Link from 'next/link'

type ObligationWithStatus = Obligation & { computedStatus: string }

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [items, setItems] = useState<ObligationWithStatus[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/obligations')
      .then(r => r.json())
      .then(data => {
        setItems(data.map((d: any) => ({ ...d, computedStatus: d.status })))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Pad to start on Sunday
  const startDay = monthStart.getDay()
  const paddedDays: (Date | null)[] = [...Array(startDay).fill(null), ...days]

  // Pad to full weeks
  while (paddedDays.length % 7 !== 0) {
    paddedDays.push(null)
  }

  const weeks: (Date | null)[][] = []
  for (let i = 0; i < paddedDays.length; i += 7) {
    weeks.push(paddedDays.slice(i, i + 7))
  }

  const obligationsByDate = new Map<string, ObligationWithStatus[]>()
  items.forEach(item => {
    const key = item.nextDueDate
    if (!obligationsByDate.has(key)) obligationsByDate.set(key, [])
    obligationsByDate.get(key)!.push(item)
  })

  const selectedItems = selectedDate
    ? obligationsByDate.get(format(selectedDate, 'yyyy-MM-dd')) || []
    : []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return (
    <div className="p-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex items-baseline justify-between mb-6 border-b border-[#1e2d47] pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Calendar View</h1>
          <p className="text-xs text-slate-500 mt-0.5 font-mono">Obligations by due date</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-[#1e2d47] text-slate-400 hover:text-slate-200 transition-colors rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-200 w-36 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-[#1e2d47] text-slate-400 hover:text-slate-200 transition-colors rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentMonth(new Date()); setSelectedDate(null) }}
            className="text-xs text-amber-400 hover:text-amber-300 ml-2"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {/* Calendar grid */}
        <div className="col-span-5">
          <div className={`border border-[#1e2d47] bg-[#0f1629] overflow-hidden relative transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {loading && (
              <div className="absolute top-2 right-2 z-10 text-[10px] font-mono text-slate-500 flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-amber-500/60 animate-pulse" />
                loading
              </div>
            )}
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[#1e2d47] bg-[#0a0e1a]">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {day}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 border-b border-[#1e2d47] last:border-b-0">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="border-r border-[#1e2d47] last:border-r-0 bg-[#0a0e1a]/50" />
                  }
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const dayItems = obligationsByDate.get(dateKey) || []
                  const isToday = isSameDay(day, today)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const hasOverdue = dayItems.some(i => i.computedStatus === 'overdue')
                  const hasUpcoming = dayItems.some(i => i.computedStatus === 'upcoming')

                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDate(day)}
                      className={`border-r border-[#1e2d47] last:border-r-0 p-2 min-h-[100px] cursor-pointer transition-colors relative
                        ${isSelected ? 'bg-amber-950/30 border-2 border-amber-500/50' : 'hover:bg-[#162035]'}
                        ${!isSameMonth(day, currentMonth) ? 'opacity-40' : ''}
                      `}
                    >
                      <div className={`text-xs font-mono mb-1 ${isToday ? 'text-amber-400 font-semibold' : 'text-slate-400'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map(item => {
                          const riskColors = {
                            critical: 'bg-red-500',
                            high: 'bg-orange-500',
                            medium: 'bg-amber-500',
                            low: 'bg-emerald-500',
                          }
                          const bgColor = riskColors[item.riskLevel as keyof typeof riskColors] || 'bg-slate-500'
                          return (
                            <div
                              key={item.id}
                              className="text-[10px] leading-tight text-slate-300 truncate"
                              title={item.title}
                            >
                              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${bgColor}`} />
                              {item.title}
                            </div>
                          )
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[9px] text-amber-500/80 font-mono hover:text-amber-400 transition-colors">
                            +{dayItems.length - 3} more →
                          </div>
                        )}
                      </div>
                      {isToday && (
                        <div className="absolute top-1 right-1">
                          <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3 text-xs">
            <div className="text-slate-500">Risk levels:</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-slate-400">Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              <span className="text-slate-400">High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span className="text-slate-400">Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span className="text-slate-400">Low</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-2">
          {selectedDate ? (
            <div className="border border-[#1e2d47] bg-[#0f1629] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#1e2d47] bg-[#0a0e1a]">
                <div className="text-sm font-semibold text-slate-100">
                  {format(selectedDate, 'EEEE, MMM d')}
                </div>
                <div className="text-xs text-slate-500 mt-0.5 font-mono">
                  {selectedItems.length} obligation{selectedItems.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <div className="text-xs text-slate-500 text-center py-8">No obligations due</div>
                ) : (
                  selectedItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/obligations?id=${item.id}`}
                      className="block border border-[#1e2d47] bg-[#0a0e1a] p-2.5 hover:bg-[#162035] transition-colors"
                    >
                      <div className="text-xs font-medium text-slate-200 leading-tight mb-1">
                        {item.title}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">{getCategoryLabel(item.category)}</span>
                        <span className={`inline-flex px-1.5 py-0.5 font-mono font-semibold border ${getRiskColor(item.riskLevel as any)}`}>
                          {item.riskLevel}
                        </span>
                      </div>
                      {item.owner && (
                        <div className="text-[10px] text-slate-500 mt-1">{item.owner}</div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="border border-[#1e2d47] bg-[#0f1629] p-8 text-center">
              <div className="text-sm text-slate-500">Select a date to view obligations</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
