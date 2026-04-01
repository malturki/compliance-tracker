/**
 * Email templates for compliance alerts and digests
 */

export interface Obligation {
  id: string
  title: string
  category: string
  nextDueDate: string
  owner: string
  ownerEmail?: string | null
  assignee?: string | null
  assigneeEmail?: string | null
  riskLevel: string
  status: string
  notes?: string | null
}

interface AlertEmailData {
  obligation: Obligation
  daysUntilDue: number
}

interface DigestEmailData {
  overdue: Obligation[]
  dueThisWeek: Obligation[]
  dueNextWeek: Obligation[]
  period: string
}

/**
 * Generate alert email for a single obligation
 */
export function generateAlertEmail(data: AlertEmailData): { subject: string; html: string; text: string } {
  const { obligation, daysUntilDue } = data
  const urgencyLevel = daysUntilDue <= 3 ? 'URGENT' : daysUntilDue <= 7 ? 'Important' : 'Upcoming'
  const urgencyColor = daysUntilDue <= 3 ? '#dc2626' : daysUntilDue <= 7 ? '#f59e0b' : '#3b82f6'

  const subject = `${urgencyLevel}: ${obligation.title} - Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="max-width: 600px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 24px; text-align: center;">
      <h1 style="margin: 0; color: white; font-size: 24px; font-weight: 600;">Compliance Alert</h1>
    </div>

    <!-- Urgency Banner -->
    <div style="background-color: ${urgencyColor}; color: white; padding: 12px 24px; text-align: center; font-weight: 600; font-size: 14px;">
      ${urgencyLevel.toUpperCase()} - Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px;">${obligation.title}</h2>
      
      <div style="background-color: #f1f5f9; border-left: 4px solid ${urgencyColor}; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <div style="margin-bottom: 12px;">
          <strong style="color: #475569;">Due Date:</strong> 
          <span style="color: #0f172a;">${new Date(obligation.nextDueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #475569;">Category:</strong> 
          <span style="color: #0f172a;">${obligation.category}</span>
        </div>
        <div style="margin-bottom: 12px;">
          <strong style="color: #475569;">Owner:</strong> 
          <span style="color: #0f172a;">${obligation.owner}</span>
        </div>
        ${obligation.assignee ? `
        <div style="margin-bottom: 12px;">
          <strong style="color: #475569;">Assignee:</strong> 
          <span style="color: #0f172a;">${obligation.assignee}</span>
        </div>
        ` : ''}
        <div>
          <strong style="color: #475569;">Risk Level:</strong> 
          <span style="color: #0f172a; text-transform: capitalize;">${obligation.riskLevel}</span>
        </div>
      </div>

      ${obligation.notes ? `
      <div style="margin: 16px 0;">
        <strong style="color: #475569;">Notes:</strong>
        <p style="margin: 8px 0 0 0; color: #64748b;">${obligation.notes}</p>
      </div>
      ` : ''}

      <div style="margin-top: 24px; text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/obligations" 
           style="display: inline-block; background-color: #0f172a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          View in Compliance Tracker
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">
        This is an automated alert from your Compliance Tracker system.
      </p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
${urgencyLevel.toUpperCase()}: ${obligation.title}

Due in ${daysUntilDue} day${daysUntilDue === 1 ? '' : 's'}

Due Date: ${new Date(obligation.nextDueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Category: ${obligation.category}
Owner: ${obligation.owner}
${obligation.assignee ? `Assignee: ${obligation.assignee}\n` : ''}Risk Level: ${obligation.riskLevel}

${obligation.notes ? `Notes: ${obligation.notes}\n\n` : ''}
View in Compliance Tracker: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/obligations

---
This is an automated alert from your Compliance Tracker system.
  `

  return { subject, html, text }
}

/**
 * Generate weekly digest email
 */
export function generateDigestEmail(data: DigestEmailData): { subject: string; html: string; text: string } {
  const { overdue, dueThisWeek, dueNextWeek, period } = data
  const totalItems = overdue.length + dueThisWeek.length + dueNextWeek.length

  const subject = `Compliance Digest: ${totalItems} obligation${totalItems === 1 ? '' : 's'} requiring attention`

  const renderObligationRow = (obl: Obligation, showStatus: boolean = false) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 12px 8px;">
        <strong style="color: #0f172a;">${obl.title}</strong>
        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">${obl.category}</div>
      </td>
      <td style="padding: 12px 8px; text-align: center;">
        ${new Date(obl.nextDueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
      </td>
      <td style="padding: 12px 8px; text-align: center;">
        ${obl.owner}
      </td>
      <td style="padding: 12px 8px; text-align: center; text-transform: capitalize;">
        ${obl.riskLevel}
      </td>
    </tr>
  `

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; margin: 0; padding: 0; background-color: #f8fafc;">
  <div style="max-width: 800px; margin: 40px auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px 24px; text-align: center;">
      <h1 style="margin: 0 0 8px 0; color: white; font-size: 28px; font-weight: 600;">Compliance Digest</h1>
      <p style="margin: 0; color: #94a3b8; font-size: 14px;">${period}</p>
    </div>

    <!-- Summary Stats -->
    <div style="display: flex; padding: 24px; background-color: #f8fafc; border-bottom: 1px solid #e2e8f0;">
      <div style="flex: 1; text-align: center; padding: 0 16px;">
        <div style="font-size: 32px; font-weight: 700; color: #dc2626;">${overdue.length}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Overdue</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 0 16px; border-left: 1px solid #e2e8f0;">
        <div style="font-size: 32px; font-weight: 700; color: #f59e0b;">${dueThisWeek.length}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">This Week</div>
      </div>
      <div style="flex: 1; text-align: center; padding: 0 16px; border-left: 1px solid #e2e8f0;">
        <div style="font-size: 32px; font-weight: 700; color: #3b82f6;">${dueNextWeek.length}</div>
        <div style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Next Week</div>
      </div>
    </div>

    <!-- Content -->
    <div style="padding: 32px 24px;">
      
      ${overdue.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #dc2626; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
          <span style="display: inline-block; width: 8px; height: 8px; background-color: #dc2626; border-radius: 50%; margin-right: 8px;"></span>
          Overdue (${overdue.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #fef2f2; border-bottom: 2px solid #fecaca;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; color: #991b1b; text-transform: uppercase;">Obligation</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #991b1b; text-transform: uppercase;">Due Date</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #991b1b; text-transform: uppercase;">Owner</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #991b1b; text-transform: uppercase;">Risk</th>
            </tr>
          </thead>
          <tbody>
            ${overdue.map(obl => renderObligationRow(obl)).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${dueThisWeek.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #f59e0b; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
          <span style="display: inline-block; width: 8px; height: 8px; background-color: #f59e0b; border-radius: 50%; margin-right: 8px;"></span>
          Due This Week (${dueThisWeek.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #fffbeb; border-bottom: 2px solid #fde68a;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; color: #92400e; text-transform: uppercase;">Obligation</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #92400e; text-transform: uppercase;">Due Date</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #92400e; text-transform: uppercase;">Owner</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #92400e; text-transform: uppercase;">Risk</th>
            </tr>
          </thead>
          <tbody>
            ${dueThisWeek.map(obl => renderObligationRow(obl)).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${dueNextWeek.length > 0 ? `
      <div style="margin-bottom: 32px;">
        <h2 style="margin: 0 0 16px 0; color: #3b82f6; font-size: 18px; font-weight: 600; display: flex; align-items: center;">
          <span style="display: inline-block; width: 8px; height: 8px; background-color: #3b82f6; border-radius: 50%; margin-right: 8px;"></span>
          Due Next Week (${dueNextWeek.length})
        </h2>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background-color: #eff6ff; border-bottom: 2px solid #bfdbfe;">
              <th style="padding: 12px 8px; text-align: left; font-size: 12px; color: #1e40af; text-transform: uppercase;">Obligation</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #1e40af; text-transform: uppercase;">Due Date</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #1e40af; text-transform: uppercase;">Owner</th>
              <th style="padding: 12px 8px; text-align: center; font-size: 12px; color: #1e40af; text-transform: uppercase;">Risk</th>
            </tr>
          </thead>
          <tbody>
            ${dueNextWeek.map(obl => renderObligationRow(obl)).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      ${totalItems === 0 ? `
      <div style="text-align: center; padding: 32px; color: #64748b;">
        <p style="font-size: 18px; margin: 0;">✅ All obligations are on track!</p>
        <p style="margin: 8px 0 0 0;">No items requiring immediate attention.</p>
      </div>
      ` : ''}

      <div style="margin-top: 32px; text-align: center;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}" 
           style="display: inline-block; background-color: #0f172a; color: white; padding: 12px 32px; text-decoration: none; border-radius: 6px; font-weight: 600;">
          Open Compliance Tracker
        </a>
      </div>
    </div>

    <!-- Footer -->
    <div style="background-color: #f8fafc; padding: 16px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
      <p style="margin: 0; color: #64748b; font-size: 12px;">
        This is an automated digest from your Compliance Tracker system.
      </p>
    </div>
  </div>
</body>
</html>
  `

  const text = `
COMPLIANCE DIGEST - ${period}

Summary:
- Overdue: ${overdue.length}
- Due This Week: ${dueThisWeek.length}
- Due Next Week: ${dueNextWeek.length}

${overdue.length > 0 ? `
OVERDUE (${overdue.length}):
${overdue.map(obl => `- ${obl.title} (${obl.category}) - Due: ${new Date(obl.nextDueDate).toLocaleDateString()} - Owner: ${obl.owner}`).join('\n')}
` : ''}

${dueThisWeek.length > 0 ? `
DUE THIS WEEK (${dueThisWeek.length}):
${dueThisWeek.map(obl => `- ${obl.title} (${obl.category}) - Due: ${new Date(obl.nextDueDate).toLocaleDateString()} - Owner: ${obl.owner}`).join('\n')}
` : ''}

${dueNextWeek.length > 0 ? `
DUE NEXT WEEK (${dueNextWeek.length}):
${dueNextWeek.map(obl => `- ${obl.title} (${obl.category}) - Due: ${new Date(obl.nextDueDate).toLocaleDateString()} - Owner: ${obl.owner}`).join('\n')}
` : ''}

${totalItems === 0 ? '✅ All obligations are on track! No items requiring immediate attention.' : ''}

View full details: ${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}

---
This is an automated digest from your Compliance Tracker system.
  `

  return { subject, html, text }
}
