import { describe, expect, it, vi } from 'vitest';
import {
  IAiTriagePort,
  IPulseLineRepository,
  TestLine,
  TestRun,
  TriageDiagnosis,
} from '../domain/contracts';
import { TelemetrySimulatorService } from './telemetry-simulator.service';
import { TelemetryService } from './telemetry.service';

describe('TelemetryService', () => {
  const mockRepo = {
    createTestRun: vi.fn(),
    getRecentTestRuns: vi.fn(),
    getTestLineById: vi.fn(),
    updateTestLineMetrics: vi.fn(),
    getTestLines: vi.fn(),
    getStationsByLine: vi.fn(),
    getStationById: vi.fn(),
    getTestRunById: vi.fn(),
    getAllRunbooks: vi.fn(),
    getTriageDiagnosisByRunId: vi.fn(),
    saveTriageDiagnosis: vi.fn(),
    searchRunbooksByVector: vi.fn(),
    upsertRunbookEmbedding: vi.fn(),
  } as unknown as IPulseLineRepository;

  const mockAiTriage: IAiTriagePort = {
    providerName: 'mock',
    embedText: vi.fn(),
    diagnoseTestRunFailure: vi.fn(),
  };

  const mockPubSub = {
    publish: vi.fn(),
    asyncIterator: vi.fn(),
  };

  const service = new TelemetryService(
    mockRepo,
    mockAiTriage,
    mockPubSub as any,
  );

  it('correctly calculates metrics for a PASSED run with normal latency (HEALTHY)', async () => {
    const existingLine: TestLine = {
      id: 'line-1',
      name: 'Line RF 01',
      code: 'LINE-RF-01',
      description: 'RF Test Line',
      healthStatus: 'HEALTHY',
      yieldPercentage: 100,
      activeDutSerial: 'DUT-001',
      lastCycleLatencyMs: 600,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    };

    const createdRun: TestRun = {
      id: 'run-1',
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-002',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'PASSED',
      latencyMs: 800,
      errorCode: null,
      stepFailed: null,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    (mockRepo.createTestRun as any).mockResolvedValue(createdRun);
    (mockRepo.getTestLineById as any).mockResolvedValue(existingLine);
    (mockRepo.getRecentTestRuns as any).mockResolvedValue([
      createdRun,
      { status: 'PASSED' },
      { status: 'PASSED' },
      { status: 'PASSED' },
    ]);
    (mockRepo.updateTestLineMetrics as any).mockImplementation((_id: string, update: any) =>
      Promise.resolve({ ...existingLine, ...update }),
    );

    const result = await service.ingestTestRun({
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-002',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'PASSED',
      latencyMs: 800,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(result).toBe(createdRun);
    expect(mockRepo.updateTestLineMetrics).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        healthStatus: 'HEALTHY',
        consecutiveFailures: 0,
        yieldPercentage: 100,
        activeDutSerial: 'DUT-002',
        lastCycleLatencyMs: 800,
      }),
    );
    expect(mockPubSub.publish).toHaveBeenCalledWith('TEST_RUN_COMPLETED', {
      testRunCompleted: createdRun,
    });
    expect(mockPubSub.publish).toHaveBeenCalledWith(
      'LINE_HEALTH_UPDATED',
      expect.objectContaining({
        lineHealthUpdated: expect.objectContaining({ healthStatus: 'HEALTHY' }),
      }),
    );
  });

  it('marks line DEGRADED if 1 consecutive failure occurs', async () => {
    const existingLine: TestLine = {
      id: 'line-1',
      name: 'Line RF 01',
      code: 'LINE-RF-01',
      description: 'RF Test Line',
      healthStatus: 'HEALTHY',
      yieldPercentage: 100,
      activeDutSerial: 'DUT-001',
      lastCycleLatencyMs: 600,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    };

    const failedRun: TestRun = {
      id: 'run-2',
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-003',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'FAILED',
      latencyMs: 1200,
      errorCode: 'ERR_RF_PA_GAIN_LOW',
      stepFailed: 'RF_TX_SWEEP_2400MHZ',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    (mockRepo.createTestRun as any).mockResolvedValue(failedRun);
    (mockRepo.getTestLineById as any).mockResolvedValue(existingLine);
    (mockRepo.getRecentTestRuns as any).mockResolvedValue([
      failedRun,
      { status: 'PASSED' },
      { status: 'PASSED' },
      { status: 'PASSED' },
    ]);
    (mockRepo.updateTestLineMetrics as any).mockImplementation((_id: string, update: any) =>
      Promise.resolve({ ...existingLine, ...update }),
    );

    await service.ingestTestRun({
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-003',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'FAILED',
      latencyMs: 1200,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(mockRepo.updateTestLineMetrics).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        healthStatus: 'DEGRADED',
        consecutiveFailures: 1,
        yieldPercentage: 75,
      }),
    );
  });

  it('marks line CRITICAL if 3 consecutive failures occur', async () => {
    const existingLine: TestLine = {
      id: 'line-1',
      name: 'Line RF 01',
      code: 'LINE-RF-01',
      description: 'RF Test Line',
      healthStatus: 'DEGRADED',
      yieldPercentage: 50,
      activeDutSerial: 'DUT-002',
      lastCycleLatencyMs: 1200,
      consecutiveFailures: 2,
      updatedAt: new Date(),
    };

    const thirdFailure: TestRun = {
      id: 'run-3',
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-004',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'FAILED',
      latencyMs: 1100,
      errorCode: 'ERR_RF_PA_GAIN_LOW',
      stepFailed: 'RF_TX_SWEEP_2400MHZ',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    (mockRepo.createTestRun as any).mockResolvedValue(thirdFailure);
    (mockRepo.getTestLineById as any).mockResolvedValue(existingLine);
    (mockRepo.getRecentTestRuns as any).mockResolvedValue([
      thirdFailure,
      { status: 'FAILED' },
      { status: 'FAILED' },
      { status: 'PASSED' },
    ]);
    (mockRepo.updateTestLineMetrics as any).mockImplementation((_id: string, update: any) =>
      Promise.resolve({ ...existingLine, ...update }),
    );

    await service.ingestTestRun({
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-004',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'FAILED',
      latencyMs: 1100,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(mockRepo.updateTestLineMetrics).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        healthStatus: 'CRITICAL',
        consecutiveFailures: 3,
        yieldPercentage: 25,
      }),
    );
  });

  it('marks line DEGRADED if passed but latency > 1800ms', async () => {
    const existingLine: TestLine = {
      id: 'line-1',
      name: 'Line RF 01',
      code: 'LINE-RF-01',
      description: 'RF Test Line',
      healthStatus: 'HEALTHY',
      yieldPercentage: 100,
      activeDutSerial: 'DUT-001',
      lastCycleLatencyMs: 600,
      consecutiveFailures: 0,
      updatedAt: new Date(),
    };

    const slowRun: TestRun = {
      id: 'run-slow',
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-005',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'PASSED',
      latencyMs: 1950,
      errorCode: null,
      stepFailed: null,
      startedAt: new Date(),
      completedAt: new Date(),
    };

    (mockRepo.createTestRun as any).mockResolvedValue(slowRun);
    (mockRepo.getTestLineById as any).mockResolvedValue(existingLine);
    (mockRepo.getRecentTestRuns as any).mockResolvedValue([slowRun, { status: 'PASSED' }]);
    (mockRepo.updateTestLineMetrics as any).mockImplementation((_id: string, update: any) =>
      Promise.resolve({ ...existingLine, ...update }),
    );

    await service.ingestTestRun({
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-005',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'PASSED',
      latencyMs: 1950,
      startedAt: new Date(),
      completedAt: new Date(),
    });

    expect(mockRepo.updateTestLineMetrics).toHaveBeenCalledWith(
      'line-1',
      expect.objectContaining({
        healthStatus: 'DEGRADED',
        consecutiveFailures: 0,
        yieldPercentage: 100,
        lastCycleLatencyMs: 1950,
      }),
    );
  });

  it('triggers AI triage and publishes updated test run with diagnosis attached', async () => {
    const existingRun: TestRun = {
      id: 'run-failed-1',
      lineId: 'line-1',
      stationId: 'st-1',
      dutSerial: 'DUT-003',
      dutModel: 'PulseNode-RF',
      firmwareVersion: 'fw-v4.12.0',
      status: 'FAILED',
      latencyMs: 1250,
      errorCode: 'ERR_RF_PA_GAIN_LOW',
      stepFailed: 'RF_TX_SWEEP_2400MHZ',
      startedAt: new Date(),
      completedAt: new Date(),
    };

    const diagnosis: TriageDiagnosis = {
      id: 'diag-1',
      testRunId: 'run-failed-1',
      providerUsed: 'mock',
      rootCauseScope: 'DUT_HARDWARE',
      confidence: 0.94,
      summary: 'Open solder joint on Skyworks RF PA rail',
      matchedRunbook: {
        runbookId: 'rb-1',
        code: 'RB-RF-001',
        title: 'RF PA Power Gain Drop',
        similarityScore: 0.91,
      },
      recommendedActions: ['Rework solder joint on pin 14'],
      evidenceLogs: ['Skyworks FEM PA current collapsed'],
      toolCallsExecuted: ['searchRunbooksByVector'],
      createdAt: new Date(),
    };

    (mockAiTriage.diagnoseTestRunFailure as any).mockResolvedValue(diagnosis);
    (mockRepo.getTestRunById as any).mockResolvedValue(existingRun);

    const result = await service.triggerAiTriage('run-failed-1');
    expect(result).toBe(diagnosis);
    expect(mockPubSub.publish).toHaveBeenCalledWith('TEST_RUN_COMPLETED', {
      testRunCompleted: {
        ...existingRun,
        triageDiagnosis: diagnosis,
      },
    });
  });
});

describe('TelemetrySimulatorService', () => {
  it('injects 3 consecutive failures for USB_ADB_ENUMERATION_TIMEOUT scenario', async () => {
    const mockRepo = {
      getTestLines: vi.fn().mockResolvedValue([
        { id: 'line-bb', code: 'LINE-BB-02', name: 'Baseband Line' },
      ]),
      getStationsByLine: vi.fn().mockResolvedValue([{ id: 'station-bb-1' }]),
    } as unknown as IPulseLineRepository;

    const mockAiTriage = {
      providerName: 'mock',
      embedText: vi.fn(),
      diagnoseTestRunFailure: vi.fn(),
    } as IAiTriagePort;

    const mockTelemetryService = {
      ingestTestRun: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: `run-${Math.random()}`,
          ...input,
        }),
      ),
    } as unknown as TelemetryService;

    const simulator = new TelemetrySimulatorService(
      mockTelemetryService,
      mockRepo,
      mockAiTriage,
    );

    const runs = await simulator.injectFailureScenario('USB_ADB_ENUMERATION_TIMEOUT');
    expect(runs).toHaveLength(3);
    expect(mockTelemetryService.ingestTestRun).toHaveBeenCalledTimes(3);
    expect(runs[0].stepFailed).toBe('ADB_BRIDGE_INIT');
    expect(runs[0].stationId).toBe('station-bb-1');
  });

  it('injects 3 consecutive failures for THERMAL_CHAMBER_SENSOR_DRIFT scenario', async () => {
    const mockRepo = {
      getTestLines: vi.fn().mockResolvedValue([
        { id: 'line-th', code: 'LINE-TH-03', name: 'Thermal Line' },
      ]),
      getStationsByLine: vi.fn().mockResolvedValue([{ id: 'station-th-1' }]),
    } as unknown as IPulseLineRepository;

    const mockAiTriage = {
      providerName: 'mock',
      embedText: vi.fn(),
      diagnoseTestRunFailure: vi.fn(),
    } as IAiTriagePort;

    const mockTelemetryService = {
      ingestTestRun: vi.fn().mockImplementation((input) =>
        Promise.resolve({
          id: `run-${Math.random()}`,
          ...input,
        }),
      ),
    } as unknown as TelemetryService;

    const simulator = new TelemetrySimulatorService(
      mockTelemetryService,
      mockRepo,
      mockAiTriage,
    );

    const runs = await simulator.injectFailureScenario('THERMAL_CHAMBER_SENSOR_DRIFT');
    expect(runs).toHaveLength(3);
    expect(mockTelemetryService.ingestTestRun).toHaveBeenCalledTimes(3);
    expect(runs[0].stepFailed).toBe('THERMAL_SOAK_65C_BATTERY_CHECK');
    expect(runs[0].stationId).toBe('station-th-1');
  });
});
