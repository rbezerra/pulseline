import { Inject, Injectable } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import {
  AI_TRIAGE_PORT,
  FailureLog,
  IAiTriagePort,
  IPulseLineRepository,
  LineHealthStatus,
  PULSELINE_REPOSITORY,
  Runbook,
  TestLine,
  TestRun,
  TestRunStatus,
  TestStation,
  TriageDiagnosis,
} from '../domain/contracts';
import { IngestTestRunInput } from './graphql.models';

@Injectable()
export class TelemetryService {
  constructor(
    @Inject(PULSELINE_REPOSITORY) private readonly repo: IPulseLineRepository,
    @Inject(AI_TRIAGE_PORT) private readonly aiTriage: IAiTriagePort,
    @Inject('PUB_SUB') private readonly pubSub: PubSub,
  ) {}

  /**
   * Ingest a completed TestRun, recalculate rolling line health metrics,
   * persist metrics to database, and broadcast updates to GraphQL subscribers.
   */
  async ingestTestRun(input: IngestTestRunInput): Promise<TestRun> {
    const runPayload: Omit<TestRun, 'id' | 'failureLogs' | 'triageDiagnosis'> = {
      lineId: input.lineId,
      stationId: input.stationId,
      dutSerial: input.dutSerial,
      dutModel: input.dutModel,
      firmwareVersion: input.firmwareVersion,
      status: input.status,
      latencyMs: input.latencyMs,
      errorCode: input.errorCode ?? null,
      stepFailed: input.stepFailed ?? null,
      startedAt: new Date(input.startedAt),
      completedAt: new Date(input.completedAt),
    };

    const logsPayload: Array<Omit<FailureLog, 'id' | 'testRunId'>> = (input.failureLogs || []).map((log) => {
      let rawPayload: Record<string, unknown> | undefined;
      if (log.rawPayload) {
        if (typeof log.rawPayload === 'string') {
          try {
            rawPayload = JSON.parse(log.rawPayload);
          } catch {
            rawPayload = { raw: log.rawPayload };
          }
        } else if (typeof log.rawPayload === 'object') {
          rawPayload = log.rawPayload as Record<string, unknown>;
        }
      }

      return {
        timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        source: log.source,
        severity: log.severity,
        errorCode: log.errorCode,
        message: log.message,
        rawPayload,
      };
    });

    // 1. Persist the TestRun and associated FailureLog entries
    const createdRun = await this.repo.createTestRun(runPayload, logsPayload);

    // 2. Fetch rolling window of recent runs (last 20) on this TestLine
    const recentRuns = await this.repo.getRecentTestRuns({ lineId: input.lineId, limit: 20 });
    const totalRuns = recentRuns.length > 0 ? recentRuns.length : 1;
    const passedCount = recentRuns.filter((r) => r.status === 'PASSED').length;

    // Yield percentage: percentage of PASSED runs in the last 20 runs, rounded to 1 decimal place
    const yieldPercentage = Math.round((passedCount / totalRuns) * 1000) / 10;

    // Consecutive failures: reset to 0 if PASSED, otherwise increment current count
    const existingLine = await this.repo.getTestLineById(input.lineId);
    const previousFailures = existingLine ? existingLine.consecutiveFailures : 0;
    const consecutiveFailures = input.status === 'PASSED' ? 0 : previousFailures + 1;

    // Line Health Status evaluation per Q7 domain rules:
    // - CRITICAL: consecutiveFailures >= 3
    // - DEGRADED: consecutiveFailures === 1 || consecutiveFailures === 2 || input.latencyMs > 1800
    // - HEALTHY:  consecutiveFailures === 0 && input.latencyMs <= 1800
    let healthStatus: LineHealthStatus;
    if (consecutiveFailures >= 3) {
      healthStatus = 'CRITICAL';
    } else if (consecutiveFailures === 1 || consecutiveFailures === 2 || input.latencyMs > 1800) {
      healthStatus = 'DEGRADED';
    } else {
      healthStatus = 'HEALTHY';
    }

    // 3. Update the TestLine metrics
    const updatedLine = await this.repo.updateTestLineMetrics(input.lineId, {
      healthStatus,
      yieldPercentage,
      activeDutSerial: input.dutSerial,
      lastCycleLatencyMs: input.latencyMs,
      consecutiveFailures,
    });

    // 4. Publish GraphQL Subscription events
    await this.pubSub.publish('TEST_RUN_COMPLETED', { testRunCompleted: createdRun });
    await this.pubSub.publish('LINE_HEALTH_UPDATED', { lineHealthUpdated: updatedLine });

    return createdRun;
  }

  /**
   * Retrieve all TestLines with current health status and operational metrics.
   */
  async getTestLines(): Promise<TestLine[]> {
    return this.repo.getTestLines();
  }

  /**
   * Retrieve TestStations belonging to a specific TestLine.
   */
  async getStationsByLine(lineId: string): Promise<TestStation[]> {
    return this.repo.getStationsByLine(lineId);
  }

  /**
   * Retrieve recent TestRuns with optional filtering by line, station, status, and limit.
   */
  async getRecentTestRuns(filter?: {
    lineId?: string;
    stationId?: string;
    status?: TestRunStatus;
    limit?: number;
  }): Promise<TestRun[]> {
    return this.repo.getRecentTestRuns(filter);
  }

  /**
   * Retrieve a specific TestRun by ID.
   */
  async getTestRunById(id: string): Promise<TestRun | null> {
    return this.repo.getTestRunById(id);
  }

  /**
   * Retrieve all registered Runbooks for diagnostic reference.
   */
  async getRunbooks(): Promise<Runbook[]> {
    return this.repo.getAllRunbooks();
  }

  /**
   * Retrieve an existing TriageDiagnosis by TestRun ID.
   */
  async getTriageDiagnosisByRunId(testRunId: string): Promise<TriageDiagnosis | null> {
    return this.repo.getTriageDiagnosisByRunId(testRunId);
  }

  /**
   * Trigger AI Triage for a failed TestRun, record the diagnosis,
   * and broadcast the updated TestRun with attached diagnosis to all active dashboard subscribers.
   */
  async triggerAiTriage(testRunId: string): Promise<TriageDiagnosis> {
    const diagnosis = await this.aiTriage.diagnoseTestRunFailure(testRunId);
    const existingRun = await this.repo.getTestRunById(testRunId);

    if (existingRun) {
      const runWithDiagnosis: TestRun = {
        ...existingRun,
        triageDiagnosis: diagnosis,
      };
      await this.pubSub.publish('TEST_RUN_COMPLETED', { testRunCompleted: runWithDiagnosis });
    }

    return diagnosis;
  }

  /**
   * Returns the name of the currently active AI provider (gemini, openai, ollama, mock).
   */
  getActiveAiProvider(): string {
    return this.aiTriage.providerName;
  }
}
