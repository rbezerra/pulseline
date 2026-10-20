import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client';
import {
  GET_TEST_LINES,
  GET_RECENT_TEST_RUNS,
  GET_RUNBOOKS,
  GET_SIMULATOR_STATUS,
  TOGGLE_SIMULATOR,
  INJECT_FAILURE_SCENARIO,
  RUN_AI_TRIAGE,
  ON_TEST_RUN_COMPLETED,
  ON_LINE_HEALTH_UPDATED,
} from './apollo/operations';
import { TestLine, TestRun, Runbook, SimulatorStatus, ScenarioCode } from './types/domain';
import { HeaderControlBar } from './components/HeaderControlBar';
import { TestLinesGrid } from './components/TestLinesGrid';
import { TestRunFeed } from './components/TestRunFeed';
import { TriagePanel } from './components/TriagePanel';
import { RunbooksModal } from './components/RunbooksModal';

export const App: React.FC = () => {
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [isRunbooksOpen, setIsRunbooksOpen] = useState(false);

  const { data: linesData, refetch: refetchLines } = useQuery<{ testLines: TestLine[] }>(GET_TEST_LINES, {
    pollInterval: 10000,
  });

  const { data: runsData, refetch: refetchRuns } = useQuery<{ recentTestRuns: TestRun[] }>(GET_RECENT_TEST_RUNS, {
    variables: { limit: 60 },
  });

  const { data: runbooksData } = useQuery<{ runbooks: Runbook[] }>(GET_RUNBOOKS);
  const { data: simData, refetch: refetchSim } = useQuery<{ simulatorStatus: SimulatorStatus }>(GET_SIMULATOR_STATUS, {
    pollInterval: 5000,
  });

  const [testLines, setTestLines] = useState<TestLine[]>([]);
  const [testRuns, setTestRuns] = useState<TestRun[]>([]);

  useEffect(() => {
    if (linesData?.testLines) {
      setTestLines(linesData.testLines);
    }
  }, [linesData]);

  useEffect(() => {
    if (runsData?.recentTestRuns) {
      setTestRuns(runsData.recentTestRuns);
      if (!selectedRunId && runsData.recentTestRuns.length > 0) {
        setSelectedRunId(runsData.recentTestRuns[0].id);
      }
    }
  }, [runsData]);

  useSubscription<{ testRunCompleted: TestRun }>(ON_TEST_RUN_COMPLETED, {
    onData: ({ data }) => {
      const newRun = data.data?.testRunCompleted;
      if (newRun) {
        setTestRuns((prev) => {
          const filtered = prev.filter((r) => r.id !== newRun.id);
          return [newRun, ...filtered].slice(0, 80);
        });
      }
    },
  });

  useSubscription<{ lineHealthUpdated: TestLine }>(ON_LINE_HEALTH_UPDATED, {
    onData: ({ data }) => {
      const updatedLine = data.data?.lineHealthUpdated;
      if (updatedLine) {
        setTestLines((prev) => {
          const index = prev.findIndex((l) => l.id === updatedLine.id);
          if (index >= 0) {
            const next = [...prev];
            next[index] = updatedLine;
            return next;
          }
          return [...prev, updatedLine];
        });
      }
    },
  });

  const [toggleSimulatorMutation] = useMutation(TOGGLE_SIMULATOR);
  const [injectScenarioMutation] = useMutation(INJECT_FAILURE_SCENARIO);
  const [runAiTriageMutation] = useMutation(RUN_AI_TRIAGE);

  const handleToggleSimulator = async (running: boolean) => {
    await toggleSimulatorMutation({ variables: { running } });
    await refetchSim();
  };

  const handleInjectScenario = async (scenarioCode: ScenarioCode, lineId?: string) => {
    const res = await injectScenarioMutation({ variables: { scenarioCode, lineId } });
    const injectedRuns = res.data?.injectFailureScenario;
    if (injectedRuns && injectedRuns.length > 0) {
      setSelectedRunId(injectedRuns[injectedRuns.length - 1].id);
    }
    await refetchLines();
    await refetchRuns();
  };

  const handleRunAiTriage = async (testRunId: string) => {
    const res = await runAiTriageMutation({ variables: { testRunId } });
    const diagnosis = res.data?.runAiTriage;
    if (diagnosis) {
      setTestRuns((prev) =>
        prev.map((r) => (r.id === testRunId ? { ...r, triageDiagnosis: diagnosis } : r))
      );
    }
  };

  const selectedRun = testRuns.find((r) => r.id === selectedRunId) || null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col telemetry-grid">
      <HeaderControlBar
        simulatorStatus={simData?.simulatorStatus}
        lines={testLines}
        selectedLineId={selectedLineId}
        onSelectLineId={setSelectedLineId}
        onToggleSimulator={handleToggleSimulator}
        onInjectScenario={handleInjectScenario}
        onOpenRunbooks={() => setIsRunbooksOpen(true)}
      />

      <main className="flex-1 max-w-[1720px] w-full mx-auto p-4 md:p-6 flex flex-col">
        <TestLinesGrid
          lines={testLines}
          selectedLineId={selectedLineId}
          onSelectLine={setSelectedLineId}
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
          <div className="lg:col-span-6 xl:col-span-5">
            <TestRunFeed
              runs={testRuns}
              lines={testLines}
              selectedRunId={selectedRunId}
              onSelectRunId={setSelectedRunId}
              selectedLineId={selectedLineId}
              onSelectLineId={setSelectedLineId}
            />
          </div>

          <div className="lg:col-span-6 xl:col-span-7">
            <TriagePanel
              run={selectedRun}
              onRunTriage={handleRunAiTriage}
            />
          </div>
        </div>
      </main>

      <RunbooksModal
        isOpen={isRunbooksOpen}
        onClose={() => setIsRunbooksOpen(false)}
        runbooks={runbooksData?.runbooks || []}
      />
    </div>
  );
};
