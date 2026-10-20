import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PubSub } from 'graphql-subscriptions';
import { PulseLineRepository } from './db/pulseline.repository';
import { AiTriageService } from './ai/ai-triage.service';
import { TelemetryService } from './telemetry/telemetry.service';
import { TelemetrySimulatorService } from './telemetry/telemetry-simulator.service';

describe('PulseLine BFF End-to-End Integration (pgvector + AI Triage + Telemetry)', () => {
  let repo: PulseLineRepository;
  let aiService: AiTriageService;
  let telemetryService: TelemetryService;
  let simulatorService: TelemetrySimulatorService;
  let pubSub: PubSub;

  beforeAll(async () => {
    process.env.AI_PROVIDER = 'mock';
    delete process.env.DATABASE_URL; // Use embedded PGlite + pgvector(768)

    repo = new PulseLineRepository();
    await repo.onModuleInit();

    aiService = new AiTriageService(repo);
    await aiService.onModuleInit();

    pubSub = new PubSub();
    telemetryService = new TelemetryService(repo, aiService, pubSub);
    simulatorService = new TelemetrySimulatorService(telemetryService, repo, aiService);
  });

  afterAll(async () => {
    simulatorService.onModuleDestroy();
    await repo.onModuleDestroy();
  });

  it('seeds 3 Test Lines, 9 Test Stations, and 4 Runbooks with 768-dim vectors in pgvector', async () => {
    const lines = await telemetryService.getTestLines();
    expect(lines.length).toBe(3);

    const runbooks = await repo.getAllRunbooks();
    expect(runbooks.length).toBe(4);
    for (const rb of runbooks) {
      expect(rb.embedding).toBeDefined();
      expect(rb.embedding?.length).toBe(768);
    }
  });

  it('diagnoses isolated DUT_HARDWARE failure (RF_PA_GAIN_OUT_OF_BOUNDS) via pgvector cosine similarity', async () => {
    const runs = await simulatorService.injectFailureScenario('RF_PA_GAIN_OUT_OF_BOUNDS');
    expect(runs.length).toBe(1);
    const failedRun = runs[0];
    expect(failedRun.status).toBe('FAILED');

    const diagnosis = await telemetryService.triggerAiTriage(failedRun.id);
    expect(diagnosis.rootCauseScope).toBe('DUT_HARDWARE');
    expect(diagnosis.matchedRunbook?.code).toBe('RF_PA_GAIN_OUT_OF_BOUNDS');
    expect(diagnosis.matchedRunbook?.similarityScore).toBeGreaterThan(0.5);
    expect(diagnosis.toolCallsExecuted).toContain('searchRunbooks');
    expect(diagnosis.toolCallsExecuted).toContain('getStationRecentRuns');
  });

  it('diagnoses systemic TEST_STATION_RIG failure (USB_ADB_ENUMERATION_TIMEOUT) after 3 consecutive failures drive line to CRITICAL', async () => {
    const runs = await simulatorService.injectFailureScenario('USB_ADB_ENUMERATION_TIMEOUT');
    expect(runs.length).toBe(3);

    const lastRun = runs[runs.length - 1];
    const line = await repo.getTestLineById(lastRun.lineId);
    expect(line?.healthStatus).toBe('CRITICAL');
    expect(line?.consecutiveFailures).toBeGreaterThanOrEqual(3);

    const diagnosis = await telemetryService.triggerAiTriage(lastRun.id);
    expect(diagnosis.rootCauseScope).toBe('TEST_STATION_RIG');
    expect(diagnosis.matchedRunbook?.code).toBe('USB_ADB_ENUMERATION_TIMEOUT');
    expect(diagnosis.recommendedActions.length).toBeGreaterThan(0);
  });
});
