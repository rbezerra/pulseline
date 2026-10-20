/**
 * Shared Domain Contracts aligned with GLOSSARY.md and ADR-0001.
 * All modules (DB, AI, Telemetry, GraphQL) MUST use these canonical types and interfaces.
 */

export type LineHealthStatus = 'HEALTHY' | 'DEGRADED' | 'CRITICAL';

export type TestRunStatus = 'PASSED' | 'FAILED' | 'ABORTED';

export type RootCauseScope = 'DUT_HARDWARE' | 'DUT_FIRMWARE' | 'TEST_STATION_RIG';

export type ScenarioCode =
  | 'RF_PA_GAIN_OUT_OF_BOUNDS'
  | 'BASEBAND_MODEM_KERNEL_PANIC'
  | 'USB_ADB_ENUMERATION_TIMEOUT'
  | 'THERMAL_CHAMBER_SENSOR_DRIFT';

export interface TestStation {
  id: string;
  lineId: string;
  name: string;
  code: string;
  sequenceOrder: number;
  instrumentModel: string;
}

export interface TestLine {
  id: string;
  name: string;
  code: string;
  description: string;
  healthStatus: LineHealthStatus;
  yieldPercentage: number;
  activeDutSerial: string | null;
  lastCycleLatencyMs: number;
  consecutiveFailures: number;
  updatedAt: Date;
  stations?: TestStation[];
}

export interface FailureLog {
  id: string;
  testRunId: string;
  timestamp: Date;
  source: 'DUT' | 'STATION_INSTRUMENT';
  severity: 'WARN' | 'ERROR' | 'FATAL';
  errorCode: string;
  message: string;
  rawPayload?: Record<string, unknown>;
}

export interface TestRun {
  id: string;
  lineId: string;
  stationId: string;
  dutSerial: string;
  dutModel: string;
  firmwareVersion: string;
  status: TestRunStatus;
  latencyMs: number;
  errorCode: string | null;
  stepFailed: string | null;
  startedAt: Date;
  completedAt: Date;
  failureLogs?: FailureLog[];
  triageDiagnosis?: TriageDiagnosis | null;
}

export interface Runbook {
  id: string;
  code: string;
  title: string;
  symptomSignature: string;
  rootCauseScope: RootCauseScope;
  technicalExplanation: string;
  remediationSteps: string[];
  embedding?: number[];
}

export interface MatchedRunbookRef {
  runbookId: string;
  code: string;
  title: string;
  similarityScore: number;
}

export interface TriageDiagnosis {
  id: string;
  testRunId: string;
  providerUsed: string;
  rootCauseScope: RootCauseScope;
  confidence: number;
  summary: string;
  matchedRunbook: MatchedRunbookRef | null;
  recommendedActions: string[];
  evidenceLogs: string[];
  toolCallsExecuted: string[];
  createdAt: Date;
}

export interface RunbookSearchMatch {
  runbook: Runbook;
  similarityScore: number;
}

/**
 * Repository Port implemented by the Database Module (`src/db`)
 */
export const PULSELINE_REPOSITORY = Symbol('PULSELINE_REPOSITORY');

export interface IPulseLineRepository {
  getTestLines(): Promise<TestLine[]>;
  getTestLineById(lineId: string): Promise<TestLine | null>;
  updateTestLineMetrics(
    lineId: string,
    update: Partial<Pick<TestLine, 'healthStatus' | 'yieldPercentage' | 'activeDutSerial' | 'lastCycleLatencyMs' | 'consecutiveFailures'>>
  ): Promise<TestLine>;

  getStationsByLine(lineId: string): Promise<TestStation[]>;
  getStationById(stationId: string): Promise<TestStation | null>;

  createTestRun(
    run: Omit<TestRun, 'id' | 'failureLogs' | 'triageDiagnosis'>,
    logs: Array<Omit<FailureLog, 'id' | 'testRunId'>>
  ): Promise<TestRun>;
  getTestRunById(testRunId: string): Promise<TestRun | null>;
  getRecentTestRuns(options?: { lineId?: string; stationId?: string; status?: TestRunStatus; limit?: number }): Promise<TestRun[]>;

  searchRunbooksByVector(embedding: number[], limit?: number, errorCodeHint?: string): Promise<RunbookSearchMatch[]>;
  getAllRunbooks(): Promise<Runbook[]>;
  upsertRunbookEmbedding(runbookId: string, embedding: number[]): Promise<void>;

  saveTriageDiagnosis(diagnosis: Omit<TriageDiagnosis, 'id' | 'createdAt'>): Promise<TriageDiagnosis>;
  getTriageDiagnosisByRunId(testRunId: string): Promise<TriageDiagnosis | null>;
}

/**
 * Vendor-Agnostic AI Port implemented by the AI Module (`src/ai`) per ADR-0001
 */
export const AI_TRIAGE_PORT = Symbol('AI_TRIAGE_PORT');

export interface IAiTriagePort {
  readonly providerName: string;
  embedText(text: string): Promise<number[]>;
  diagnoseTestRunFailure(testRunId: string): Promise<TriageDiagnosis>;
}
