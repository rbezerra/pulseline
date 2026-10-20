import {
  pgTable,
  text,
  integer,
  real,
  timestamp,
  jsonb,
  vector,
} from 'drizzle-orm/pg-core';
import {
  LineHealthStatus,
  TestRunStatus,
  RootCauseScope,
  MatchedRunbookRef,
} from '../domain/contracts';

/**
 * PulseLine Drizzle ORM Table Schemas
 * Aligned with GLOSSARY.md and ADR-0001 (768-dimension vector embeddings).
 */

export const testLines = pgTable('test_lines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  description: text('description').notNull(),
  healthStatus: text('health_status').$type<LineHealthStatus>().notNull(),
  yieldPercentage: real('yield_percentage').notNull(),
  activeDutSerial: text('active_dut_serial'),
  lastCycleLatencyMs: integer('last_cycle_latency_ms').notNull(),
  consecutiveFailures: integer('consecutive_failures').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const testStations = pgTable('test_stations', {
  id: text('id').primaryKey(),
  lineId: text('line_id')
    .notNull()
    .references(() => testLines.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  sequenceOrder: integer('sequence_order').notNull(),
  instrumentModel: text('instrument_model').notNull(),
});

export const testRuns = pgTable('test_runs', {
  id: text('id').primaryKey(),
  lineId: text('line_id')
    .notNull()
    .references(() => testLines.id, { onDelete: 'cascade' }),
  stationId: text('station_id')
    .notNull()
    .references(() => testStations.id, { onDelete: 'cascade' }),
  dutSerial: text('dut_serial').notNull(),
  dutModel: text('dut_model').notNull(),
  firmwareVersion: text('firmware_version').notNull(),
  status: text('status').$type<TestRunStatus>().notNull(),
  latencyMs: integer('latency_ms').notNull(),
  errorCode: text('error_code'),
  stepFailed: text('step_failed'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true }).notNull(),
});

export const failureLogs = pgTable('failure_logs', {
  id: text('id').primaryKey(),
  testRunId: text('test_run_id')
    .notNull()
    .references(() => testRuns.id, { onDelete: 'cascade' }),
  timestamp: timestamp('timestamp', { withTimezone: true }).notNull(),
  source: text('source').$type<'DUT' | 'STATION_INSTRUMENT'>().notNull(),
  severity: text('severity').$type<'WARN' | 'ERROR' | 'FATAL'>().notNull(),
  errorCode: text('error_code').notNull(),
  message: text('message').notNull(),
  rawPayload: jsonb('raw_payload').$type<Record<string, unknown>>(),
});

export const runbooks = pgTable('runbooks', {
  id: text('id').primaryKey(),
  code: text('code').notNull().unique(),
  title: text('title').notNull(),
  symptomSignature: text('symptom_signature').notNull(),
  rootCauseScope: text('root_cause_scope').$type<RootCauseScope>().notNull(),
  technicalExplanation: text('technical_explanation').notNull(),
  remediationSteps: jsonb('remediation_steps').$type<string[]>().notNull(),
  embedding: vector('embedding', { dimensions: 768 }),
});

export const triageDiagnoses = pgTable('triage_diagnoses', {
  id: text('id').primaryKey(),
  testRunId: text('test_run_id')
    .notNull()
    .references(() => testRuns.id, { onDelete: 'cascade' }),
  providerUsed: text('provider_used').notNull(),
  rootCauseScope: text('root_cause_scope').$type<RootCauseScope>().notNull(),
  confidence: real('confidence').notNull(),
  summary: text('summary').notNull(),
  matchedRunbook: jsonb('matched_runbook').$type<MatchedRunbookRef | null>(),
  recommendedActions: jsonb('recommended_actions').$type<string[]>().notNull(),
  evidenceLogs: jsonb('evidence_logs').$type<string[]>().notNull(),
  toolCallsExecuted: jsonb('tool_calls_executed').$type<string[]>().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type TestLineRow = typeof testLines.$inferSelect;
export type InsertTestLineRow = typeof testLines.$inferInsert;

export type TestStationRow = typeof testStations.$inferSelect;
export type InsertTestStationRow = typeof testStations.$inferInsert;

export type TestRunRow = typeof testRuns.$inferSelect;
export type InsertTestRunRow = typeof testRuns.$inferInsert;

export type FailureLogRow = typeof failureLogs.$inferSelect;
export type InsertFailureLogRow = typeof failureLogs.$inferInsert;

export type RunbookRow = typeof runbooks.$inferSelect;
export type InsertRunbookRow = typeof runbooks.$inferInsert;

export type TriageDiagnosisRow = typeof triageDiagnoses.$inferSelect;
export type InsertTriageDiagnosisRow = typeof triageDiagnoses.$inferInsert;
