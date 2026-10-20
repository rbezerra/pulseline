import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import {
  AI_TRIAGE_PORT,
  IAiTriagePort,
  IPulseLineRepository,
  PULSELINE_REPOSITORY,
  ScenarioCode,
  TestRun,
} from '../domain/contracts';
import { IngestFailureLogInput, SimulatorStatusModel } from './graphql.models';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class TelemetrySimulatorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetrySimulatorService.name);
  private running: boolean = true;
  private readonly intervalMs: number = 3500;
  private timerHandle: NodeJS.Timeout | null = null;
  private currentLineIndex = 0;

  constructor(
    @Inject(TelemetryService) private readonly telemetryService: TelemetryService,
    @Inject(PULSELINE_REPOSITORY) private readonly repo: IPulseLineRepository,
    @Inject(AI_TRIAGE_PORT) private readonly aiTriage: IAiTriagePort,
  ) {}

  onModuleInit(): void {
    this.startPulseTimer();
    this.logger.log(`Telemetry Simulator started (heartbeat interval: ${this.intervalMs}ms)`);
  }

  onModuleDestroy(): void {
    this.stopPulseTimer();
    this.logger.log('Telemetry Simulator stopped');
  }

  /**
   * Return the current operational state of the telemetry simulator.
   */
  getStatus(): SimulatorStatusModel {
    return {
      running: this.running,
      intervalMs: this.intervalMs,
      activeProvider: this.aiTriage.providerName,
    };
  }

  /**
   * Start or pause background heartbeat telemetry generation.
   */
  setRunning(running: boolean): SimulatorStatusModel {
    if (running && !this.running) {
      this.running = true;
      this.startPulseTimer();
      this.logger.log('Telemetry simulator resumed');
    } else if (!running && this.running) {
      this.running = false;
      this.stopPulseTimer();
      this.logger.log('Telemetry simulator paused');
    }
    return this.getStatus();
  }

  /**
   * Inject one of the 4 canonical hardware/firmware/rig failure scenarios:
   * 1. RF_PA_GAIN_OUT_OF_BOUNDS (1 failed run on LINE-RF-01)
   * 2. BASEBAND_MODEM_KERNEL_PANIC (1 failed run on LINE-BB-02)
   * 3. USB_ADB_ENUMERATION_TIMEOUT (3 consecutive failed runs driving line to CRITICAL)
   * 4. THERMAL_CHAMBER_SENSOR_DRIFT (3 consecutive failed runs driving line to CRITICAL)
   */
  async injectFailureScenario(scenarioCode: ScenarioCode, lineId?: string): Promise<TestRun[]> {
    const lines = await this.repo.getTestLines();

    const defaultCodes: Record<ScenarioCode, string> = {
      RF_PA_GAIN_OUT_OF_BOUNDS: 'LINE-RF-01',
      BASEBAND_MODEM_KERNEL_PANIC: 'LINE-BB-02',
      USB_ADB_ENUMERATION_TIMEOUT: 'LINE-BB-02',
      THERMAL_CHAMBER_SENSOR_DRIFT: 'LINE-TH-03',
    };

    const targetCode = defaultCodes[scenarioCode];
    const targetLine = lines.find((l) =>
      lineId ? l.id === lineId || l.code === lineId : l.code === targetCode || l.id === targetCode,
    );
    const resolvedLineId = targetLine ? targetLine.id : lineId || targetCode;

    // Resolve station on target line
    let stationId = `${targetLine?.code || resolvedLineId}-ST01`;
    if (targetLine) {
      const stations = await this.repo.getStationsByLine(targetLine.id);
      if (stations.length > 0) {
        stationId = stations[0].id;
      }
    }

    const createdRuns: TestRun[] = [];

    switch (scenarioCode) {
      case 'RF_PA_GAIN_OUT_OF_BOUNDS': {
        const dutSerial = `DUT-VX9-${Math.floor(10000 + Math.random() * 90000)}`;
        const latencyMs = 1250;
        const now = new Date();
        const logs: IngestFailureLogInput[] = [
          {
            timestamp: new Date(now.getTime() - 400),
            source: 'STATION_INSTRUMENT',
            severity: 'ERROR',
            errorCode: 'ERR_RF_TX_GAIN',
            message:
              'RF power meter measured TX gain -14.8 dBm at 2400MHz vs expected +21.0 dBm (tolerance +/- 1.5 dBm). Threshold violation.',
            rawPayload: JSON.stringify({
              frequencyMhz: 2400,
              measuredGainDbm: -14.8,
              expectedGainDbm: 21.0,
              toleranceDbm: 1.5,
            }),
          },
          {
            timestamp: now,
            source: 'DUT',
            severity: 'FATAL',
            errorCode: 'ERR_PA_COLLAPSE',
            message:
              'Skyworks FEM PA current collapsed from 450mA to 12mA during high-power sweep. Hardware telemetry indicates open solder joint on RF PA VCC rail.',
            rawPayload: JSON.stringify({
              component: 'SKYWORKS_FEM_77651',
              paCurrentMa: 12,
              nominalCurrentMa: 450,
              rail: 'VCC_RF_PA_3V3',
            }),
          },
        ];

        const run = await this.telemetryService.ingestTestRun({
          lineId: resolvedLineId,
          stationId,
          dutSerial,
          dutModel: 'PulseNode-RF',
          firmwareVersion: 'fw-v4.12.0',
          status: 'FAILED',
          latencyMs,
          errorCode: 'ERR_RF_PA_GAIN_LOW',
          stepFailed: 'RF_TX_SWEEP_2400MHZ',
          startedAt: new Date(now.getTime() - latencyMs),
          completedAt: now,
          failureLogs: logs,
        });
        createdRuns.push(run);
        break;
      }

      case 'BASEBAND_MODEM_KERNEL_PANIC': {
        const dutSerial = `DUT-VX9-${Math.floor(10000 + Math.random() * 90000)}`;
        const latencyMs = 1950;
        const now = new Date();
        const logs: IngestFailureLogInput[] = [
          {
            timestamp: new Date(now.getTime() - 800),
            source: 'DUT',
            severity: 'FATAL',
            errorCode: 'ERR_MODEM_DSP_CRASH',
            message:
              'Subsystem restart: modem_dsp crash at ipc_router_tx+0x44. Watchdog bite in modem kernel context.',
            rawPayload: JSON.stringify({
              subsystem: 'modem_dsp',
              pc: 'ipc_router_tx+0x44',
              crashType: 'kernel_panic_watchdog',
            }),
          },
          {
            timestamp: new Date(now.getTime() - 500),
            source: 'DUT',
            severity: 'ERROR',
            errorCode: 'ERR_NVRAM_CRC_MISMATCH',
            message:
              'NVRAM calibration CRC mismatch after fw-v4.12.0-rc3 flash. RF calibration block 0x04 corrupted.',
            rawPayload: JSON.stringify({
              block: '0x04',
              expectedCrc: '0x8F4C',
              computedCrc: '0x0000',
              flashedFw: 'fw-v4.12.0-rc3',
            }),
          },
          {
            timestamp: now,
            source: 'STATION_INSTRUMENT',
            severity: 'WARN',
            errorCode: 'ERR_LTE_ATTACH_TIMEOUT',
            message:
              'Baseband cellular simulator timed out waiting for RRC Connection Setup Complete after 5000ms.',
            rawPayload: JSON.stringify({
              timeoutMs: 5000,
              protocolState: 'RRC_WAIT_SETUP_COMPLETE',
            }),
          },
        ];

        const run = await this.telemetryService.ingestTestRun({
          lineId: resolvedLineId,
          stationId,
          dutSerial,
          dutModel: 'PulsePhone-5G',
          firmwareVersion: 'fw-v4.12.0-rc3',
          status: 'FAILED',
          latencyMs,
          errorCode: 'ERR_MODEM_PANIC',
          stepFailed: 'MODEM_LTE_ATTACH_HANDSHAKE',
          startedAt: new Date(now.getTime() - latencyMs),
          completedAt: now,
          failureLogs: logs,
        });
        createdRuns.push(run);
        break;
      }

      case 'USB_ADB_ENUMERATION_TIMEOUT': {
        // 3 consecutive failed runs on the same TestStation across 3 different DUT serials
        const baseSerialNum = 88421;
        for (let i = 0; i < 3; i++) {
          const dutSerial = `DUT-VX9-${baseSerialNum + i}`;
          const latencyMs = 1450 + i * 25;
          const now = new Date(Date.now() + i * 200);
          const logs: IngestFailureLogInput[] = [
            {
              timestamp: new Date(now.getTime() - 600),
              source: 'STATION_INSTRUMENT',
              severity: 'ERROR',
              errorCode: 'ERR_USB_ENUM_FAIL',
              message:
                'usb 2-1.4: device descriptor read/64, error -110. Host controller failed to enumerate attached device.',
              rawPayload: JSON.stringify({
                usbPort: '2-1.4',
                kernError: -110,
                desc: 'descriptor_read_failure',
              }),
            },
            {
              timestamp: new Date(now.getTime() - 200),
              source: 'STATION_INSTRUMENT',
              severity: 'FATAL',
              errorCode: 'ERR_XHCI_RESET_TIMEOUT',
              message:
                'xhci_hcd port reset timeout on station rig USB hub port 4. Test station rig hardware hub unresponsive.',
              rawPayload: JSON.stringify({
                hubPort: 4,
                controller: 'xhci_hcd',
                status: 'port_reset_timeout',
              }),
            },
            {
              timestamp: now,
              source: 'DUT',
              severity: 'WARN',
              errorCode: 'ERR_USB_PHY_SUSPEND',
              message:
                'USB PHY entered suspend mode: no VBUS pulse detected from station fixture cable.',
              rawPayload: JSON.stringify({
                phyState: 'SUSPEND',
                vbusVoltage: 0.12,
              }),
            },
          ];

          const run = await this.telemetryService.ingestTestRun({
            lineId: resolvedLineId,
            stationId,
            dutSerial,
            dutModel: 'PulsePhone-5G',
            firmwareVersion: 'fw-v4.12.0',
            status: 'FAILED',
            latencyMs,
            errorCode: 'ERR_ADB_ENUM_TIMEOUT',
            stepFailed: 'ADB_BRIDGE_INIT',
            startedAt: new Date(now.getTime() - latencyMs),
            completedAt: now,
            failureLogs: logs,
          });
          createdRuns.push(run);
        }
        break;
      }

      case 'THERMAL_CHAMBER_SENSOR_DRIFT': {
        // 3 consecutive failed runs on the same TestStation of LINE-TH-03
        const baseSerialNum = 89510;
        for (let i = 0; i < 3; i++) {
          const dutSerial = `DUT-VX9-${baseSerialNum + i}`;
          const latencyMs = 1520 + i * 20;
          const now = new Date(Date.now() + i * 200);
          const logs: IngestFailureLogInput[] = [
            {
              timestamp: new Date(now.getTime() - 700),
              source: 'STATION_INSTRUMENT',
              severity: 'FATAL',
              errorCode: 'ERR_TEMP_OVERSHOOT',
              message:
                'Chamber PT100 probe reading +78.4C vs setpoint +65.0C (+13.4C deviation exceeds max threshold 2.0C). Emergency thermal cutoff engaged.',
              rawPayload: JSON.stringify({
                probeReadingC: 78.4,
                setpointC: 65.0,
                errorDeltaC: 13.4,
                maxToleranceC: 2.0,
              }),
            },
            {
              timestamp: new Date(now.getTime() - 300),
              source: 'STATION_INSTRUMENT',
              severity: 'ERROR',
              errorCode: 'ERR_PID_SATURATION',
              message:
                'PID loop saturation warning on ESPEC controller: solid state relay output clamped at 100% duty cycle for >180s.',
              rawPayload: JSON.stringify({
                controller: 'ESPEC_SU_242',
                outputDutyCycle: 100,
                clampedDurationSec: 184,
              }),
            },
            {
              timestamp: now,
              source: 'DUT',
              severity: 'WARN',
              errorCode: 'ERR_BATTERY_THERMAL_ALERT',
              message:
                'Internal PMIC temperature sensor alert: battery pack thermistor reached +76.8C during soak step.',
              rawPayload: JSON.stringify({
                pmicTempC: 76.8,
                maxOperatingC: 68.0,
              }),
            },
          ];

          const run = await this.telemetryService.ingestTestRun({
            lineId: resolvedLineId,
            stationId,
            dutSerial,
            dutModel: 'PulseStation-Pro',
            firmwareVersion: 'fw-v4.12.0',
            status: 'FAILED',
            latencyMs,
            errorCode: 'ERR_CHAMBER_TEMP_OUT_OF_SPEC',
            stepFailed: 'THERMAL_SOAK_65C_BATTERY_CHECK',
            startedAt: new Date(now.getTime() - latencyMs),
            completedAt: now,
            failureLogs: logs,
          });
          createdRuns.push(run);
        }
        break;
      }
    }

    return createdRuns;
  }

  private startPulseTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
    }

    this.timerHandle = setInterval(async () => {
      if (!this.running) return;

      try {
        await this.generatePulse();
      } catch (err) {
        this.logger.warn(`Simulator heartbeat generation failed: ${(err as Error).message}`);
      }
    }, this.intervalMs);
  }

  private stopPulseTimer(): void {
    if (this.timerHandle) {
      clearInterval(this.timerHandle);
      this.timerHandle = null;
    }
  }

  private async generatePulse(): Promise<void> {
    const lines = await this.repo.getTestLines();
    if (!lines || lines.length === 0) {
      return;
    }

    const line = lines[this.currentLineIndex % lines.length];
    this.currentLineIndex++;

    const stations = await this.repo.getStationsByLine(line.id);
    const stationId = stations.length > 0 ? stations[0].id : `${line.code || line.id}-ST01`;

    const dutSerial = `DUT-VX9-${Math.floor(10000 + Math.random() * 90000)}`;
    const dutModel =
      line.code === 'LINE-RF-01'
        ? 'PulseNode-RF'
        : line.code === 'LINE-BB-02'
          ? 'PulsePhone-5G'
          : 'PulseStation-Pro';

    // Normal baseline latency with mild jitter, staying well below degraded threshold (1800ms)
    const baseLatency = 550 + Math.floor(Math.random() * 450);
    const latencyVariation = Math.random() < 0.2 ? 350 : 0;
    const latencyMs = baseLatency + latencyVariation;

    const completedAt = new Date();
    const startedAt = new Date(completedAt.getTime() - latencyMs);

    await this.telemetryService.ingestTestRun({
      lineId: line.id,
      stationId,
      dutSerial,
      dutModel,
      firmwareVersion: 'fw-v4.12.0',
      status: 'PASSED',
      latencyMs,
      errorCode: null,
      stepFailed: null,
      startedAt,
      completedAt,
      failureLogs: [],
    });
  }
}
