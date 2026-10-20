import { gql } from '@apollo/client';

export const GET_TEST_LINES = gql`
  query GetTestLines {
    testLines {
      id
      name
      code
      description
      healthStatus
      yieldPercentage
      activeDutSerial
      lastCycleLatencyMs
      consecutiveFailures
      updatedAt
      stations {
        id
        lineId
        name
        code
        sequenceOrder
        instrumentModel
      }
    }
  }
`;

export const GET_RECENT_TEST_RUNS = gql`
  query GetRecentTestRuns($lineId: String, $status: String, $limit: Int) {
    recentTestRuns(lineId: $lineId, status: $status, limit: $limit) {
      id
      lineId
      stationId
      dutSerial
      dutModel
      firmwareVersion
      status
      latencyMs
      errorCode
      stepFailed
      startedAt
      completedAt
      failureLogs {
        id
        timestamp
        source
        severity
        errorCode
        message
      }
      triageDiagnosis {
        id
        testRunId
        providerUsed
        rootCauseScope
        confidence
        summary
        matchedRunbook {
          runbookId
          code
          title
          similarityScore
        }
        recommendedActions
        evidenceLogs
        toolCallsExecuted
        createdAt
      }
    }
  }
`;

export const GET_RUNBOOKS = gql`
  query GetRunbooks {
    runbooks {
      id
      code
      title
      symptomSignature
      rootCauseScope
      technicalExplanation
      remediationSteps
    }
  }
`;

export const GET_SIMULATOR_STATUS = gql`
  query GetSimulatorStatus {
    simulatorStatus {
      running
      intervalMs
      activeProvider
    }
  }
`;

export const TOGGLE_SIMULATOR = gql`
  mutation ToggleSimulator($running: Boolean!) {
    toggleSimulator(running: $running) {
      running
      intervalMs
      activeProvider
    }
  }
`;

export const INJECT_FAILURE_SCENARIO = gql`
  mutation InjectFailureScenario($scenarioCode: String!, $lineId: String) {
    injectFailureScenario(scenarioCode: $scenarioCode, lineId: $lineId) {
      id
      lineId
      stationId
      dutSerial
      status
      errorCode
      stepFailed
      latencyMs
      completedAt
    }
  }
`;

export const RUN_AI_TRIAGE = gql`
  mutation RunAiTriage($testRunId: ID!) {
    runAiTriage(testRunId: $testRunId) {
      id
      testRunId
      providerUsed
      rootCauseScope
      confidence
      summary
      matchedRunbook {
        runbookId
        code
        title
        similarityScore
      }
      recommendedActions
      evidenceLogs
      toolCallsExecuted
      createdAt
    }
  }
`;

export const ON_TEST_RUN_COMPLETED = gql`
  subscription OnTestRunCompleted {
    testRunCompleted {
      id
      lineId
      stationId
      dutSerial
      dutModel
      firmwareVersion
      status
      latencyMs
      errorCode
      stepFailed
      startedAt
      completedAt
      failureLogs {
        id
        timestamp
        source
        severity
        errorCode
        message
      }
      triageDiagnosis {
        id
        testRunId
        providerUsed
        rootCauseScope
        confidence
        summary
        matchedRunbook {
          runbookId
          code
          title
          similarityScore
        }
        recommendedActions
        evidenceLogs
        toolCallsExecuted
        createdAt
      }
    }
  }
`;

export const ON_LINE_HEALTH_UPDATED = gql`
  subscription OnLineHealthUpdated {
    lineHealthUpdated {
      id
      name
      code
      description
      healthStatus
      yieldPercentage
      activeDutSerial
      lastCycleLatencyMs
      consecutiveFailures
      updatedAt
      stations {
        id
        lineId
        name
        code
        sequenceOrder
        instrumentModel
      }
    }
  }
`;
