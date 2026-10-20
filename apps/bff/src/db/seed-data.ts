import { TestLine, TestStation, Runbook } from '../domain/contracts';

/**
 * PulseLine Seed Data
 * 3 TestLines, 9 TestStations (3 per line), and 4 Runbooks for failure scenarios.
 * Aligned with GLOSSARY.md and ADR-0001.
 */

export const seedTestLines: Omit<TestLine, 'stations'>[] = [
  {
    id: 'line-rf-01',
    name: 'High-Frequency RF Calibration Line',
    code: 'LINE-RF-01',
    description:
      'Multi-band sub-6GHz and mmWave transceiver validation, gain profiling, and automated calibration line.',
    healthStatus: 'HEALTHY',
    yieldPercentage: 98.5,
    activeDutSerial: 'DUT-RF-88219',
    lastCycleLatencyMs: 1420,
    consecutiveFailures: 0,
    updatedAt: new Date('2026-10-20T12:00:00Z'),
  },
  {
    id: 'line-bb-02',
    name: 'Baseband & Modem Validation Line',
    code: 'LINE-BB-02',
    description:
      'Cellular protocol stack validation, modem throughput benchmarking, and kernel stability verification line.',
    healthStatus: 'HEALTHY',
    yieldPercentage: 96.2,
    activeDutSerial: 'DUT-BB-41093',
    lastCycleLatencyMs: 2310,
    consecutiveFailures: 0,
    updatedAt: new Date('2026-10-20T12:00:00Z'),
  },
  {
    id: 'line-th-03',
    name: 'Thermal & Power Stress Line',
    code: 'LINE-TH-03',
    description:
      'Accelerated lifecycle environmental chamber stress testing and power rail transient profiling line.',
    healthStatus: 'HEALTHY',
    yieldPercentage: 99.1,
    activeDutSerial: 'DUT-TH-10245',
    lastCycleLatencyMs: 4890,
    consecutiveFailures: 0,
    updatedAt: new Date('2026-10-20T12:00:00Z'),
  },
];

export const seedTestStations: TestStation[] = [
  // Line RF-01 Stations
  {
    id: 'station-rf-01',
    lineId: 'line-rf-01',
    name: 'Sub-6GHz RF Front-End Station',
    code: 'STATION-RF-01',
    sequenceOrder: 1,
    instrumentModel: 'Rohde & Schwarz CMW500 Wideband Radio Communication Tester',
  },
  {
    id: 'station-rf-02',
    lineId: 'line-rf-01',
    name: 'Power Amplifier S-Parameter Station',
    code: 'STATION-RF-02',
    sequenceOrder: 2,
    instrumentModel: 'Keysight N5242B PNA-X Microwave Network Analyzer',
  },
  {
    id: 'station-rf-03',
    lineId: 'line-rf-01',
    name: 'mmWave Over-The-Air Chamber Station',
    code: 'STATION-RF-03',
    sequenceOrder: 3,
    instrumentModel: 'Anritsu MT8000A Radio Communication Test Station',
  },

  // Line BB-02 Stations
  {
    id: 'station-bb-01',
    lineId: 'line-bb-02',
    name: 'High-Speed USB/ADB Enumeration Rig',
    code: 'STATION-BB-01',
    sequenceOrder: 1,
    instrumentModel: 'Teledyne LeCroy Summit T54 Protocol Analyzer',
  },
  {
    id: 'station-bb-02',
    lineId: 'line-bb-02',
    name: 'Baseband DSP & Memory BIST Station',
    code: 'STATION-BB-02',
    sequenceOrder: 2,
    instrumentModel: 'Advantest V93000 SoC Test System',
  },
  {
    id: 'station-bb-03',
    lineId: 'line-bb-02',
    name: 'Modem Protocol Stack Rig',
    code: 'STATION-BB-03',
    sequenceOrder: 3,
    instrumentModel: 'Rohde & Schwarz CMX500 5G One-Box Tester',
  },

  // Line TH-03 Stations
  {
    id: 'station-th-01',
    lineId: 'line-th-03',
    name: 'Programmable DC Power Profiling Station',
    code: 'STATION-TH-01',
    sequenceOrder: 1,
    instrumentModel: 'Keysight E36313A Triple Output DC Power Supply',
  },
  {
    id: 'station-th-02',
    lineId: 'line-th-03',
    name: 'Thermal Chamber Cycling Rig',
    code: 'STATION-TH-02',
    sequenceOrder: 2,
    instrumentModel: 'ESPEC Benchtop Chamber SH-242',
  },
  {
    id: 'station-th-03',
    lineId: 'line-th-03',
    name: 'Thermal Imaging & IR Sensor Rig',
    code: 'STATION-TH-03',
    sequenceOrder: 3,
    instrumentModel: 'FLIR A655sc High-Resolution Thermal Imaging Rig',
  },
];

export const seedRunbooks: Runbook[] = [
  {
    id: 'rb-rf-pa-gain',
    code: 'RF_PA_GAIN_OUT_OF_BOUNDS',
    title: 'RF Power Amplifier Gain Out-Of-Bounds Triage and Mitigation',
    rootCauseScope: 'DUT_HARDWARE',
    symptomSignature:
      'RF power amplifier output gain compression exceeds ±3.5dB tolerance under high-band carrier aggregation. Step failed: RF_CAL_SWEEP_B41. Observed error codes: ERR_RF_GAIN_DELTA, PA_GAIN_COMPRESSION_ERR. Station spectrum analyzer detects spurious harmonic emissions and power droop across 2.5GHz-2.7GHz bands.',
    technicalExplanation:
      'Physical silicon or substrate defect in the Gallium Nitride (GaN) or GaAs Power Amplifier module on the DUT. Voiding in the die-attach solder layer or delamination causes localized junction thermal spiking, leading to rapid gain droop and non-linear compression during high-duty-cycle TX sweeps. Decoupling capacitor micro-fractures on the VDD_PA rail can also trigger intermittent supply collapse under peak current load.',
    remediationSteps: [
      'Quarantine the failed DUT immediately and mark serial for physical failure analysis (FA).',
      'Inspect DUT under high-magnification optical microscope and X-ray for voiding in the PA die-attach solder balls.',
      'Verify VDD_PA power rail impedance and check ceramic decoupling capacitors (C2104, C2105) for micro-cracks.',
      'Check the RF cable assembly and attenuator calibration on Station RF-02 using a Golden Calibration DUT to rule out test fixture degradation.',
      'If the issue reproduces on the Golden DUT, clean or replace the N-type RF coaxial patch cable and recalibrate the Keysight PNA-X analyzer.',
    ],
  },
  {
    id: 'rb-bb-modem-panic',
    code: 'BASEBAND_MODEM_KERNEL_PANIC',
    title: 'Baseband Modem Subsystem Kernel Panic and Watchdog Timeout',
    rootCauseScope: 'DUT_FIRMWARE',
    symptomSignature:
      'Modem subsystem (MSS) watchdog timer expiration triggering whole-system kernel panic during 5G NR Standalone cell attachment. Error codes: ERR_MODEM_CRASH, SEC_WDOG_BITE, MODEM_SUBSYS_RESTART. Failure step: 5G_NR_SA_ATTACH. Console outputs crash dump with memory address NULL pointer dereference in q6_qmi_rx_cb.',
    technicalExplanation:
      'Firmware race condition in the Hexagon DSP modem driver stack during concurrent reception of RRC Connection Reconfiguration and NAS Authentication requests. An unhandled null pointer dereference inside the Qualcomm Messaging Interface (QMI) asynchronous receive handler blocks the RTOS thread, starving the hardware watchdog timer (WDOG) and causing a hardware reset.',
    remediationSteps: [
      'Extract modem ramdump via crash dump collection tool (QDLoader / QPST) for ELF symbol analysis.',
      'Cross-reference firmware build version against known issue tracker for modem patch regression.',
      'Flash DUT with certified stable firmware baseline (e.g., FW-BB-v2.4.12-rel) to confirm if the regression is isolated to the candidate firmware build.',
      'Re-execute the 5G NR SA attachment test sequence.',
      'File high-priority P0 firmware regression ticket attaching the modem ramdump and stack trace log.',
    ],
  },
  {
    id: 'rb-usb-adb-timeout',
    code: 'USB_ADB_ENUMERATION_TIMEOUT',
    title: 'Test Station USB-ADB Device Enumeration Timeout & Rig Connection Failure',
    rootCauseScope: 'TEST_STATION_RIG',
    symptomSignature:
      'Test station controller fails to establish ADB communication handshake with DUT over high-speed USB interface within 15000ms. Error codes: ERR_ADB_DEVICE_OFFLINE, USB_ENUM_TIMEOUT, HOST_EP0_STALL. Station host dmesg indicates device descriptor read error (error -110 or -71) on USB root hub port.',
    technicalExplanation:
      'Mechanical or electrical degradation in the test station rig’s USB interface hardware. Common causes include worn pogo pins in the automated DUT mechanical fixture, an overwhelmed or locked-up powered USB hub controller (e.g., GL3523 hub IC buffer overflow), ground loop voltage offset between station chassis and programmable DC power supply, or damaged USB 3.0 Type-C pigtail cabling.',
    remediationSteps: [
      'Inspect the mechanical fixture pogo pin array for bent, oxidized, or recessed USB D+/D- and CC pins.',
      'Trigger an automated USB hub power cycle using the station’s programmable power distribution unit (uhubctl -a cycle).',
      'Restart the host adb daemon service (adb kill-server && adb start-server) and reset the host xHCI USB controller.',
      'Verify ground continuity between the station fixture chassis and the Keysight DC power supply earth terminal (< 0.1 Ohm).',
      'Replace the sacrificial USB Type-C connector patch cable if continuity test shows intermittent connection under mechanical vibration.',
    ],
  },
  {
    id: 'rb-thermal-sensor-drift',
    code: 'THERMAL_CHAMBER_SENSOR_DRIFT',
    title: 'Thermal Chamber PT100/Thermocouple Sensor Drift and Temperature Rate Failure',
    rootCauseScope: 'TEST_STATION_RIG',
    symptomSignature:
      'Thermal profile step aborts due to temperature delta exceeding ±5.0°C between chamber setpoint (+85°C) and station primary monitoring thermocouple. Error codes: ERR_THERMAL_RAMP_TIMEOUT, SENSOR_DRIFT_EXCEEDED, TEMP_OVERSHOOT_WARN. Chamber ramp rate falls below required 2.5°C/minute.',
    technicalExplanation:
      'Sensor calibration drift or poor thermal contact in the test station rig’s ESPEC benchtop thermal chamber. RTD (PT100) resistance probe terminal oxidation, degraded thermal interface material (TIM) between sensor probe and fixture plate, or refrigerant line pressure loss in the cooling compressor causes inaccurate temperature telemetry and failure to reach target thermal steady-state.',
    remediationSteps: [
      'Verify thermal chamber door seal integrity and inspect latch gasket for air leakage or frost buildup.',
      'Check the mechanical seating of the primary thermocouple probe on the DUT heat spreader plate.',
      'Perform 2-point reference calibration check of the chamber PT100 sensor using a calibrated Fluke 724 temperature calibrator.',
      'Inspect the compressor coolant level gauge and air filter on the ESPEC chamber base unit.',
      'Recalibrate chamber PID temperature controller loop parameters if thermal overshoot persists after probe reseating.',
    ],
  },
];
