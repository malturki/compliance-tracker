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
  ownerEmail: text('owner_email'),
  assignee: text('assignee'),
  assigneeEmail: text('assignee_email'),
  status: text('status').notNull().default('current'),
  riskLevel: text('risk_level').notNull().default('medium'),
  alertDays: text('alert_days').default('[]'),
  lastAlertSent: text('last_alert_sent'),
  sourceDocument: text('source_document'),
  notes: text('notes'),
  entity: text('entity').default('Acme Corp'),
  jurisdiction: text('jurisdiction'),
  amount: real('amount'),
  autoRecur: integer('auto_recur', { mode: 'boolean' }).default(false),
  templateId: text('template_id'), // Track which template created this obligation
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

export const auditLog = sqliteTable('audit_log', {
  id: text('id').primaryKey(),
  ts: text('ts').notNull(),
  eventType: text('event_type').notNull(),
  actor: text('actor').notNull(),
  actorSource: text('actor_source').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  summary: text('summary').notNull(),
  diff: text('diff'),
  metadata: text('metadata'),
})

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  role: text('role').notNull().default('viewer'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
})
