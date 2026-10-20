# PulseLine

Real-time operational telemetry and AI-assisted failure triage platform for hardware and device validation test lines.

## Language

**Test Line**:
A logical or physical sequence of test stations dedicated to executing validation suites against devices under test.
_Avoid_: Pipeline, production line, service, cluster

**Test Station**:
An individual execution rig or host within a Test Line that runs test steps and collects measurements from a device.
_Avoid_: Machine, node, worker, server

**DUT (Device Under Test)**:
The physical hardware unit, board, or embedded device undergoing automated validation on a Test Station.
_Avoid_: Product, item, target, client, sample

**Test Run**:
A single execution of a validation suite against one DUT on a Test Station, recording cycle latency and a final status (`PASSED`, `FAILED`, or `ABORTED`).
_Avoid_: Job, task, session, execution, build

**Line Health Status**:
The operational condition of a Test Line derived from recent Test Runs: `HEALTHY` (normal operation within latency thresholds), `DEGRADED` (isolated DUT failure or elevated latency), or `CRITICAL` (consecutive failures on a Test Station indicating a systemic line or batch problem).
_Avoid_: Machine state, service status, alert level

**Yield**:
The percentage of completed Test Runs on a Test Line that resulted in a `PASSED` outcome over a rolling window.
_Avoid_: Success rate, pass ratio, uptime

**Failure Log**:
A diagnostic log entry captured from the DUT or the Test Station instrumentation during an unsuccessful Test Run.
_Avoid_: Error message, trace, exception, event log

**Runbook**:
A documented troubleshooting procedure indexed for semantic retrieval that maps known failure signatures to root causes and corrective actions.
_Avoid_: Playbook, manual, wiki page, knowledge base article

**Triage Diagnosis**:
A structured root-cause hypothesis and remediation plan produced by correlating a failed Test Run's Failure Logs and recent station history with matching Runbooks.
_Avoid_: AI response, suggestion, report, prediction

**Root Cause Scope**:
The classification within a Triage Diagnosis that attributes a failure to `DUT_HARDWARE` (physical defect in the unit), `DUT_FIRMWARE` (software/firmware regression on the unit), or `TEST_STATION_RIG` (faulty cabling, sensor, or instrumentation on the station).
_Avoid_: Error type, bug category, fault class
