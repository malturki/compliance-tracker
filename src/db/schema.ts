import { text, integer, real, sqliteTable } from 'drizzle-orm/sqlite-core'

export const obligations = sqliteTable('obligations', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  category: text('category').notNull(),
  subcategory: text('subcategory'),
  frequency: text('frequency').notNull(),
  nextDueDate: text('next_due_date').notNull(),
  lastCompletedDate: text('last_completed_date'),
  owner: text('owner').notNull(),
  assignee: text('assignee'),
  status: text('status').notNull().default('current'),
  riskLevel: text('risk_level').notNull().default('medium'),
  alertDays: text('alert_days').default('[]'),
  sourceDocument: text('source_document'),
  notes: text('notes'),
  entity: text('entity').default('Pi Squared Inc.'),
  jurisdiction: text('jurisdiction'),
  amount: real('amount'),
  autoRecur: integer('auto_recur', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})

export const completions = sqliteTable('completions', {
  id: text('id').primaryKey(),
  obligationId: text('obligation_id').notNull().references(() => obligations.id),
  completedDate: text('completed_date').notNull(),
  completedBy: text('completed_by').notNull(),
  evidenceUrl: text('evidence_url'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
})
