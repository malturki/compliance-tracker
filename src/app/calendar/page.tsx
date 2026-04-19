'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { formatDate, getCategoryLabel, getRiskColor } from '@/lib/utils'
import type { Obligation } from '@/lib/types'
import { ChevronLeft, ChevronRight, MousePointerClick } from 'lucide-react'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import Link from 'next/link'

type ObligationWithStatus = Obligation & { computedStatus: string }

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [items, setItems] = useState<ObligationWithStatus[]>([])
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)

  const loadObligations = () => {
    setLoading(true)
    fetch('/api/obligations')
      .then(r => {
        if (!r.ok) throw new Error('Failed to fetch')
        return r.json()
      })
      .then(data => {
        setItems(data.map((d: any) => ({ ...d, computedStatus: d.status })))
      })
      .catch(() =>
        toast.error('Failed to load obligations', {
          action: { label: 'Retry', onClick: () => loadObligations() },
        }),
      )
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadObligations()
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
      <div className="flex items-baseline justify-between mb-6 border-b border-black/5 pb-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.02em] text-graphite">Calendar View</h1>
          <p className="text-xs text-steel mt-0.5 font-mono">Obligations by due date</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-silicon/[0.18] text-graphite transition-colors rounded"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-graphite w-36 text-center">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1.5 hover:bg-silicon/[0.18] text-graphite transition-colors rounded"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setCurrentMonth(new Date()); setSelectedDate(null) }}
            className="text-xs text-graphite hover:underline ml-2"
          >
            Today
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {/* Calendar grid */}
        <div className="col-span-5">
          <div className={`bg-white border border-black/5 rounded-card shadow-card overflow-hidden relative transition-opacity ${loading ? 'opacity-60' : ''}`}>
            {loading && (
              <div className="absolute top-2 right-2 z-10 text-[10px] font-mono text-steel flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-light-steel animate-pulse" />
                loading
              </div>
            )}
            {/* Day headers */}
            <div className="grid grid-cols-7 text-[10px] uppercase tracking-[0.18em] text-steel border-b border-black/5">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="px-2 py-2 text-center font-semibold">
                  {day}
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="grid grid-cols-7">
                {week.map((day, di) => {
                  if (!day) {
                    return <div key={di} className="border-t border-l border-silicon/40 bg-canvas text-steel/60" />
                  }
                  const dateKey = format(day, 'yyyy-MM-dd')
                  const dayItems = obligationsByDate.get(dateKey) || []
                  const isToday = isSameDay(day, today)
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const inMonth = isSameMonth(day, currentMonth)

                  return (
                    <div
                      key={di}
                      onClick={() => setSelectedDate(day)}
                      className={`border-t border-l border-silicon/40 p-2 min-h-[100px] cursor-pointer transition-colors relative
                        ${isSelected ? 'bg-light-steel/[0.28] border-light-steel' : isToday ? 'bg-light-steel/[0.18] border-light-steel' : 'bg-white hover:bg-silicon/[0.18]'}
                        ${!inMonth ? 'bg-canvas text-steel/60' : ''}
                      `}
                    >
                      <div className={`text-xs font-mono mb-1 ${isToday ? 'text-graphite font-semibold' : 'text-steel'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayItems.slice(0, 3).map(item => {
                          const isOverdue = item.computedStatus === 'overdue'
                          const isUpcoming = item.computedStatus === 'upcoming'
                          const chipClasses = isOverdue
                            ? 'bg-danger/10 text-danger border border-danger/30'
                            : isUpcoming
                              ? 'bg-warning/10 text-warning border border-warning/30'
                              : 'bg-white text-graphite border border-black/10'
                          return (
                            <div
                              key={item.id}
                              className={`text-[10px] leading-tight truncate px-1.5 py-0.5 rounded ${chipClasses}`}
                              title={item.title}
                            >
                              {item.title}
                            </div>
                          )
                        })}
                        {dayItems.length > 3 && (
                          <div className="text-[9px] text-graphite font-mono hover:underline transition-colors">
                            +{dayItems.length - 3} more →
                          </div>
                        )}
                      </div>
                      {isToday && (
                        <div className="absolute top-1 right-1">
                          <div className="w-1.5 h-1.5 bg-graphite rounded-full animate-pulse" />
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
            <div className="text-steel">Status:</div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-danger" />
              <span className="text-steel">Overdue</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-warning" />
              <span className="text-steel">Upcoming</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white border border-black/10" />
              <span className="text-steel">Future</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-light-steel/[0.18] border border-light-steel" />
              <span className="text-steel">Today</span>
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="col-span-2">
          {selectedDate ? (
            <div className="bg-white border border-black/5 rounded-card shadow-card overflow-hidden">
              <div className="px-4 py-3 border-b border-black/5 bg-canvas">
                <div className="text-sm font-semibold text-graphite">
                  {format(selectedDate, 'EEEE, MMM d')}
                </div>
                <div className="text-xs text-steel mt-0.5 font-mono">
                  {selectedItems.length} obligation{selectedItems.length !== 1 ? 's' : ''}
                </div>
              </div>
              <div className="p-3 space-y-2 max-h-[600px] overflow-y-auto">
                {selectedItems.length === 0 ? (
                  <div className="text-xs text-steel text-center py-8">No obligations due</div>
                ) : (
                  selectedItems.map(item => (
                    <Link
                      key={item.id}
                      href={`/obligations?id=${item.id}`}
                      className="block border border-black/5 bg-white p-2.5 hover:bg-silicon/[0.18] transition-colors rounded"
                    >
                      <div className="text-xs font-medium text-graphite leading-tight mb-1">
                        {item.title}
                      </div>
                      <div className="flex items-center justify-between text-[10px]">
                        <span className="text-steel">{getCategoryLabel(item.category)}</span>
                        <span className={`inline-flex px-1.5 py-0.5 font-mono font-semibold border ${getRiskColor(item.riskLevel as any)}`}>
                          {item.riskLevel}
                        </span>
                      </div>
                      {item.owner && (
                        <div className="text-[10px] text-steel mt-1">{item.owner}</div>
                      )}
                    </Link>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border border-black/5 rounded-card shadow-card p-8 text-center">
              <div className="inline-flex items-center justify-center w-8 h-8 rounded bg-light-steel/[0.18] border border-light-steel/40 mb-3">
                <MousePointerClick className="w-4 h-4 text-graphite" />
              </div>
              <div className="text-sm font-medium text-graphite mb-1">Pick a date</div>
              <div className="text-xs text-steel leading-relaxed">
                Click any day on the calendar to see obligations due that day.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
