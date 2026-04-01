import { NextResponse } from 'next/server'
import OpenAI from 'openai'

export const dynamic = 'force-dynamic'

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null

export async function POST(request: Request) {
  try {
    const analyticsData = await request.json()
    
    // If no OpenAI key, return graceful fallback
    if (!openai) {
      return NextResponse.json({
        summary: generateFallbackSummary(analyticsData),
        isAI: false
      })
    }
    
    // Generate AI summary using GPT-4
    const prompt = `You are a compliance analyst. Generate a brief executive summary (2-3 sentences) of this compliance data:

Overview:
- Total obligations: ${analyticsData.overview.totalObligations}
- Overdue: ${analyticsData.overview.overdueCount}
- Due this week: ${analyticsData.overview.dueThisWeek}
- Compliance score: ${analyticsData.overview.complianceScore}/100
- Completion rate: ${analyticsData.overview.completionRate}%

Trends (last 30 days):
- Completed: ${analyticsData.trends.last30Days.completed}
- Overdue: ${analyticsData.trends.last30Days.overdue}
- Completion rate: ${analyticsData.trends.last30Days.completionRate}%

Top issues:
${analyticsData.ownerPerformance.slice(0, 3).map((o: any) => 
  `- ${o.owner}: ${o.overdue} overdue, ${o.completionRate}% on-time rate`
).join('\n')}

Risk exposure:
${analyticsData.riskExposure.map((r: any) => 
  `- ${r.riskLevel}: ${r.total} obligations (${r.overdue} overdue)`
).join('\n')}

Focus on actionable insights and areas needing attention. Be concise and professional.`

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a compliance analyst providing executive summaries. Be brief, factual, and actionable.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 300
    })
    
    const summary = completion.choices[0]?.message?.content || generateFallbackSummary(analyticsData)
    
    return NextResponse.json({
      summary,
      isAI: true
    })
  } catch (error) {
    console.error('AI Summary API error:', error)
    
    // Return fallback on error
    try {
      const analyticsData = await request.json()
      return NextResponse.json({
        summary: generateFallbackSummary(analyticsData),
        isAI: false,
        error: 'AI generation failed, showing fallback summary'
      })
    } catch {
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      )
    }
  }
}

function generateFallbackSummary(data: any): string {
  const { overview, ownerPerformance } = data
  const { complianceScore, overdueCount, dueThisWeek, completionRate } = overview
  
  let summary = `Compliance score: ${complianceScore}/100. `
  
  if (overdueCount === 0) {
    summary += 'All obligations are current. '
  } else if (overdueCount === 1) {
    summary += '1 obligation is overdue. '
  } else {
    summary += `${overdueCount} obligations are overdue. `
  }
  
  if (dueThisWeek > 0) {
    summary += `${dueThisWeek} due this week. `
  }
  
  if (completionRate >= 90) {
    summary += `Strong completion rate (${completionRate}%).`
  } else if (completionRate >= 70) {
    summary += `Moderate completion rate (${completionRate}%).`
  } else {
    summary += `Low completion rate (${completionRate}%) - action needed.`
  }
  
  // Highlight worst performer
  if (ownerPerformance && ownerPerformance.length > 0) {
    const worst = ownerPerformance.find((o: any) => o.overdue > 0)
    if (worst) {
      summary += ` ${worst.owner} has ${worst.overdue} overdue items.`
    }
  }
  
  return summary
}
