import { NextResponse } from 'next/server'
import { db, dbReady } from '@/db'
import { obligations, completions } from '@/db/schema'
import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { requireRole } from '@/lib/auth-helpers'
import { addDays, subDays, startOfDay, parseISO, differenceInDays } from 'date-fns'

export const dynamic = 'force-dynamic'

interface AnalyticsMetrics {
  overview: {
    totalObligations: number
    overdueCount: number
    dueThisWeek: number
    complianceScore: number
    completionRate: number
  }
  trends: {
    last30Days: TrendData
    last60Days: TrendData
    last90Days: TrendData
  }
  categoryPerformance: CategoryMetrics[]
  ownerPerformance: OwnerMetrics[]
  riskExposure: RiskMetrics[]
}

interface TrendData {
  completed: number
  overdue: number
  total: number
  completionRate: number
}

interface CategoryMetrics {
  category: string
  total: number
  completed: number
  overdue: number
  upcoming: number
  completionRate: number
}

interface OwnerMetrics {
  owner: string
  total: number
  completed: number
  overdue: number
  upcoming: number
  completionRate: number
  avgDaysToComplete: number
}

interface RiskMetrics {
  riskLevel: string
  total: number
  overdue: number
  upcoming: number
  percentage: number
}

export async function GET() {
  try {
    const { error: authError } = await requireRole('viewer')
    if (authError) return authError

    await dbReady
    const today = startOfDay(new Date())
    const todayStr = today.toISOString().split('T')[0]
    
    // Fetch all obligations
    const allObligations = await db.select().from(obligations)
    
    // Fetch all completions for trend analysis
    const allCompletions = await db.select().from(completions)
    
    // Calculate overview metrics
    const totalObligations = allObligations.length
    const overdueCount = allObligations.filter(o => {
      const dueDate = parseISO(o.nextDueDate)
      return dueDate < today && o.status !== 'completed'
    }).length
    
    const weekFromNow = addDays(today, 7)
    const dueThisWeek = allObligations.filter(o => {
      const dueDate = parseISO(o.nextDueDate)
      return dueDate >= today && dueDate <= weekFromNow
    }).length
    
    // Calculate completion rate (obligations completed on time in last 90 days)
    const ninetyDaysAgo = subDays(today, 90)
    const recentCompletions = allCompletions.filter(c => {
      const completedDate = parseISO(c.completedDate)
      return completedDate >= ninetyDaysAgo
    })
    
    let onTimeCompletions = 0
    for (const completion of recentCompletions) {
      const obligation = allObligations.find(o => o.id === completion.obligationId)
      if (obligation) {
        const completedDate = parseISO(completion.completedDate)
        const dueDate = parseISO(obligation.nextDueDate)
        if (completedDate <= dueDate) {
          onTimeCompletions++
        }
      }
    }
    
    const completionRate = recentCompletions.length > 0 
      ? Math.round((onTimeCompletions / recentCompletions.length) * 100)
      : 100
    
    // Calculate compliance score (weighted)
    // Score = (70% completion rate) + (20% no overdue) + (10% critical/high on time)
    const noOverdueScore = overdueCount === 0 ? 100 : Math.max(0, 100 - (overdueCount * 10))
    
    const criticalHighObligations = allObligations.filter(o => 
      o.riskLevel === 'critical' || o.riskLevel === 'high'
    )
    const criticalHighOverdue = criticalHighObligations.filter(o => {
      const dueDate = parseISO(o.nextDueDate)
      return dueDate < today && o.status !== 'completed'
    }).length
    const criticalScore = criticalHighObligations.length > 0
      ? Math.max(0, 100 - (criticalHighOverdue * 20))
      : 100
    
    const complianceScore = Math.round(
      (completionRate * 0.7) + (noOverdueScore * 0.2) + (criticalScore * 0.1)
    )
    
    // Calculate trend data
    const calculateTrend = (days: number): TrendData => {
      const startDate = subDays(today, days)
      const periodCompletions = allCompletions.filter(c => {
        const completedDate = parseISO(c.completedDate)
        return completedDate >= startDate && completedDate <= today
      })
      
      let periodOnTime = 0
      let periodOverdue = 0
      
      for (const completion of periodCompletions) {
        const obligation = allObligations.find(o => o.id === completion.obligationId)
        if (obligation) {
          const completedDate = parseISO(completion.completedDate)
          const dueDate = parseISO(obligation.nextDueDate)
          if (completedDate <= dueDate) {
            periodOnTime++
          } else {
            periodOverdue++
          }
        }
      }
      
      const total = periodCompletions.length
      const rate = total > 0 ? Math.round((periodOnTime / total) * 100) : 100
      
      return {
        completed: periodOnTime,
        overdue: periodOverdue,
        total,
        completionRate: rate
      }
    }
    
    const trends = {
      last30Days: calculateTrend(30),
      last60Days: calculateTrend(60),
      last90Days: calculateTrend(90)
    }
    
    // Calculate category performance
    const categories = Array.from(new Set(allObligations.map(o => o.category)))
    const categoryPerformance: CategoryMetrics[] = categories.map(category => {
      const categoryObs = allObligations.filter(o => o.category === category)
      const total = categoryObs.length
      
      const completed = categoryObs.filter(o => o.status === 'completed').length
      const overdue = categoryObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate < today && o.status !== 'completed'
      }).length
      const upcoming = categoryObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate >= today && dueDate <= weekFromNow
      }).length
      
      const categoryCompletions = allCompletions.filter(c => {
        const obligation = allObligations.find(o => o.id === c.obligationId && o.category === category)
        return obligation && parseISO(c.completedDate) >= ninetyDaysAgo
      })
      
      let onTime = 0
      for (const completion of categoryCompletions) {
        const obligation = allObligations.find(o => o.id === completion.obligationId)
        if (obligation) {
          const completedDate = parseISO(completion.completedDate)
          const dueDate = parseISO(obligation.nextDueDate)
          if (completedDate <= dueDate) onTime++
        }
      }
      
      const completionRate = categoryCompletions.length > 0
        ? Math.round((onTime / categoryCompletions.length) * 100)
        : 100
      
      return {
        category,
        total,
        completed,
        overdue,
        upcoming,
        completionRate
      }
    }).sort((a, b) => b.total - a.total)
    
    // Calculate owner performance
    const owners = Array.from(new Set(allObligations.map(o => o.owner)))
    const ownerPerformance: OwnerMetrics[] = owners.map(owner => {
      const ownerObs = allObligations.filter(o => o.owner === owner)
      const total = ownerObs.length
      
      const completed = ownerObs.filter(o => o.status === 'completed').length
      const overdue = ownerObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate < today && o.status !== 'completed'
      }).length
      const upcoming = ownerObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate >= today && dueDate <= weekFromNow
      }).length
      
      const ownerCompletions = allCompletions.filter(c => {
        const obligation = allObligations.find(o => o.id === c.obligationId && o.owner === owner)
        return obligation && parseISO(c.completedDate) >= ninetyDaysAgo
      })
      
      let onTime = 0
      let totalDays = 0
      for (const completion of ownerCompletions) {
        const obligation = allObligations.find(o => o.id === completion.obligationId)
        if (obligation) {
          const completedDate = parseISO(completion.completedDate)
          const dueDate = parseISO(obligation.nextDueDate)
          const days = differenceInDays(completedDate, dueDate)
          totalDays += days
          if (days <= 0) onTime++
        }
      }
      
      const completionRate = ownerCompletions.length > 0
        ? Math.round((onTime / ownerCompletions.length) * 100)
        : 100
      
      const avgDaysToComplete = ownerCompletions.length > 0
        ? Math.round(totalDays / ownerCompletions.length)
        : 0
      
      return {
        owner,
        total,
        completed,
        overdue,
        upcoming,
        completionRate,
        avgDaysToComplete
      }
    }).sort((a, b) => b.overdue - a.overdue || b.total - a.total)
    
    // Calculate risk exposure
    const riskLevels = ['critical', 'high', 'medium', 'low']
    const riskExposure: RiskMetrics[] = riskLevels.map(riskLevel => {
      const riskObs = allObligations.filter(o => o.riskLevel === riskLevel)
      const total = riskObs.length
      const overdue = riskObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate < today && o.status !== 'completed'
      }).length
      const upcoming = riskObs.filter(o => {
        const dueDate = parseISO(o.nextDueDate)
        return dueDate >= today && dueDate <= weekFromNow
      }).length
      
      const percentage = totalObligations > 0 
        ? Math.round((total / totalObligations) * 100)
        : 0
      
      return {
        riskLevel,
        total,
        overdue,
        upcoming,
        percentage
      }
    }).filter(r => r.total > 0)
    
    const analytics: AnalyticsMetrics = {
      overview: {
        totalObligations,
        overdueCount,
        dueThisWeek,
        complianceScore,
        completionRate
      },
      trends,
      categoryPerformance,
      ownerPerformance,
      riskExposure
    }
    
    return NextResponse.json(analytics)
  } catch (error) {
    console.error('Analytics API error:', error)
    return NextResponse.json(
      { error: 'Failed to compute analytics' },
      { status: 500 }
    )
  }
}
