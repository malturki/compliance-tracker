import { z } from 'zod'

/**
 * Format a Zod safeParse error as a single human-readable string. Joins all
 * issue paths and messages, e.g. `category: Invalid enum value, owner: Required`.
 *
 * Used by API route handlers so the error response shape is always
 * `{ error: string, issues?: ZodIssue[] }` rather than mixing string and
 * array shapes across endpoints. The structured `issues` array is preserved
 * for clients/tests that want to introspect.
 */
export function formatZodError(error: z.ZodError): { error: string; issues: z.ZodIssue[] } {
  const message = error.issues
    .map(i => {
      const path = i.path.join('.')
      return path ? `${path}: ${i.message}` : i.message
    })
    .join(', ')
  return { error: message || 'Invalid request', issues: error.issues }
}

export const createObligationSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().optional(),
  category: z.enum([
    'tax',
    'investor',
    'equity',
    'state',
    'federal',
    'contract',
    'insurance',
    'benefits',
    'governance',
    'vendor',
  ]),
  subcategory: z.string().optional(),
  frequency: z.enum(['annual', 'quarterly', 'monthly', 'weekly', 'one-time', 'event-triggered']),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  owner: z.string().min(1),
  ownerEmail: z.string().email().optional().or(z.literal('')).nullable(),
  assignee: z.string().optional().nullable(),
  assigneeEmail: z.string().email().optional().or(z.literal('')).nullable(),
  status: z.enum(['current', 'upcoming', 'overdue', 'completed', 'blocked', 'unknown', 'not-applicable']).optional(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']).default('medium'),
  alertDays: z.array(z.number()).optional().default([]),
  sourceDocument: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  entity: z.string().default('Pi Squared Inc.'),
  counterparty: z.string().max(200).optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  autoRecur: z.boolean().optional().default(false),
  parentId: z.string().optional().nullable(),
  sequence: z.number().int().nonnegative().optional().nullable(),
  blockerReason: z.string().max(1000).optional().nullable(),
  nextRecommendedAction: z.string().max(500).optional().nullable(),
}).refine(
  data => data.status !== 'blocked' || (data.blockerReason && data.blockerReason.trim().length > 0),
  { message: 'blockerReason is required when status is "blocked"', path: ['blockerReason'] },
)

export const updateObligationSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().optional().nullable(),
  category: z.enum([
    'tax',
    'investor',
    'equity',
    'state',
    'federal',
    'contract',
    'insurance',
    'benefits',
    'governance',
    'vendor',
  ]).optional(),
  subcategory: z.string().optional().nullable(),
  frequency: z.enum(['annual', 'quarterly', 'monthly', 'weekly', 'one-time', 'event-triggered']).optional(),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional(),
  lastCompletedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  owner: z.string().min(1).optional(),
  ownerEmail: z.string().email().optional().or(z.literal('')).nullable(),
  assignee: z.string().optional().nullable(),
  assigneeEmail: z.string().email().optional().or(z.literal('')).nullable(),
  status: z.enum(['current', 'upcoming', 'overdue', 'completed', 'blocked', 'unknown', 'not-applicable']).optional(),
  riskLevel: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  alertDays: z.array(z.number()).optional(),
  sourceDocument: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  entity: z.string().optional(),
  counterparty: z.string().max(200).optional().nullable(),
  jurisdiction: z.string().optional().nullable(),
  amount: z.number().optional().nullable(),
  autoRecur: z.boolean().optional(),
  parentId: z.string().optional().nullable(),
  sequence: z.number().int().nonnegative().optional().nullable(),
  blockerReason: z.string().max(1000).optional().nullable(),
  nextRecommendedAction: z.string().max(500).optional().nullable(),
})

export const completeObligationSchema = z.object({
  completedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format'),
  completedBy: z.string().min(1),
  evidenceUrl: z.string().url().optional().or(z.literal('')).nullable(),
  notes: z.string().optional().nullable(),
  // Evidence packet fields — all optional; completionroute populates evidenceUrl and evidenceUrls together.
  approvedBy: z.string().optional().nullable(),
  approvedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format').optional().nullable(),
  verificationStatus: z.enum(['unverified', 'self-verified', 'approved', 'audited']).optional(),
  summary: z.string().max(5000).optional().nullable(),
  evidenceUrls: z.array(z.string().url()).optional().nullable(),
}).refine(
  data => !data.approvedDate || data.approvedDate >= data.completedDate,
  { message: 'approvedDate must not precede completedDate', path: ['approvedDate'] },
)
