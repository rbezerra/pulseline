/**
 * Ubiquitous Domain Terminology matching GLOSSARY.md and contracts.ts
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
  updatedAt: string;
  stations?: TestStation[];
}

export interface FailureLog {
  id: string;
  timestamp: string;
  source: 'DUT' | 'STATION_INSTRUMENT';
  severity: 'WARN' | 'ERROR' | 'FATAL';
  errorCode: string;
  message: string;
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
  createdAt: string;
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
  startedAt: string;
  completedAt: string;
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
}

export interface SimulatorStatus {
  running: boolean;
  intervalMs: number;
  activeProvider: string;
}
