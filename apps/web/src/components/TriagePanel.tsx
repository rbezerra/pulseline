import React, { useState } from 'react';
import { Sparkles, Brain, CheckSquare, Square, ShieldCheck, RotateCw, BookOpen } from 'lucide-react';
import { TestRun } from '../types/domain';
import { ScopeBadge } from './common/ScopeBadge';
import { ToolCallChip } from './common/ToolCallChip';
import { FailureLogTerminal } from './FailureLogTerminal';

interface TriagePanelProps {
  run: TestRun | null;
  onRunTriage: (testRunId: string) => Promise<void>;
}

export const TriagePanel: React.FC<TriagePanelProps> = ({ run, onRunTriage }) => {
  const [isRunningTriage, setIsRunningTriage] = useState(false);
  const [triageStep, setTriageStep] = useState<string>('');
  const [checkedActions, setCheckedActions] = useState<Record<string, boolean>>({});

  if (!run) {
    return (
      <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-8 h-[740px] flex flex-col items-center justify-center text-center text-slate-500 font-mono text-xs">
        <Brain className="w-12 h-12 text-slate-700 mb-3" />
        <h4 className="font-bold text-sm text-slate-400">NO TEST RUN SELECTED</h4>
        <p className="mt-1 max-w-xs text-slate-600">Select any Test Run from the live feed to inspect its Failure Logs and execute AI Incident Triage.</p>
      </div>
    );
  }

  const handleExecuteTriage = async () => {
    try {
      setIsRunningTriage(true);
      setTriageStep('Executing searchRunbooks (pgvector 768-dim similarity)...');
      setTimeout(() => {
        setTriageStep('Correlating getStationRecentRuns & history...');
      }, 400);
      setTimeout(() => {
        setTriageStep('Synthesizing Root Cause Scope & Remediation...');
      }, 800);

      await onRunTriage(run.id);
    } finally {
      setIsRunningTriage(false);
      setTriageStep('');
    }
  };

  const toggleAction = (idx: number) => {
    setCheckedActions((prev) => ({
      ...prev,
      [`${run.id}-${idx}`]: !prev[`${run.id}-${idx}`],
    }));
  };

  const diagnosis = run.triageDiagnosis;

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 h-[740px] flex flex-col overflow-y-auto">
      <div className="pb-3 border-b border-slate-800 mb-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-bold text-slate-100">{run.dutSerial}</span>
              <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">{run.dutModel}</span>
              <span className="font-mono text-xs text-slate-500">FW: {run.firmwareVersion}</span>
            </div>
            <div className="text-xs font-mono text-slate-400 mt-1">
              Station ID: <span className="text-slate-300">{run.stationId}</span> &bull; Cycle Latency: <span className="text-slate-300">{run.latencyMs}ms</span>
            </div>
          </div>

          {run.stepFailed && (
            <div className="text-right">
              <span className="text-[10px] font-mono text-slate-500 uppercase block">Step Failed</span>
              <span className="text-xs font-mono text-rose-400 font-bold">{run.stepFailed}</span>
            </div>
          )}
        </div>
      </div>

      <FailureLogTerminal logs={run.failureLogs} />

      <div className="mt-2 flex-1">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-200">
              AI Incident Triage
            </h4>
          </div>

          {diagnosis && (
            <button
              onClick={handleExecuteTriage}
              disabled={isRunningTriage}
              className="inline-flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 underline disabled:opacity-50"
            >
              <RotateCw className={`w-3 h-3 ${isRunningTriage ? 'animate-spin' : ''}`} />
              Re-run Triage
            </button>
          )}
        </div>

        {!diagnosis && (
          <div className="p-6 rounded-xl border border-slate-800 bg-slate-950/80 text-center flex flex-col items-center justify-center">
            <Brain className="w-10 h-10 text-cyan-400 mb-2 animate-pulse" />
            <h5 className="font-bold text-sm text-slate-200 mb-1">Incident Root Cause Diagnosis</h5>
            <p className="text-xs text-slate-400 max-w-md mb-4">
              Autonomous correlation of Failure Logs against 768-dim pgvector Runbook embeddings and recent station telemetry.
            </p>

            <button
              onClick={handleExecuteTriage}
              disabled={isRunningTriage}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-mono font-bold text-xs shadow-lg shadow-cyan-950/50 transition disabled:opacity-50"
            >
              <Sparkles className={`w-4 h-4 ${isRunningTriage ? 'animate-spin' : ''}`} />
              {isRunningTriage ? 'EXECUTING AI TRIAGE...' : 'RUN AI INCIDENT TRIAGE'}
            </button>

            {isRunningTriage && (
              <div className="mt-3 text-xs font-mono text-cyan-400 animate-pulse">
                {triageStep}
              </div>
            )}
          </div>
        )}

        {diagnosis && (
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-slate-400">Root Cause Scope:</span>
                  <ScopeBadge scope={diagnosis.rootCauseScope} />
                </div>
                <span className="text-[11px] font-mono text-slate-500">
                  Provider: <strong className="text-slate-300">{diagnosis.providerUsed}</strong>
                </span>
              </div>

              <div className="mt-3">
                <div className="flex items-center justify-between text-xs font-mono mb-1">
                  <span className="text-slate-400">Diagnosis Confidence</span>
                  <span className="text-cyan-400 font-bold">{(diagnosis.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.max(0, diagnosis.confidence * 100))}%` }}
                  />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-slate-800/80">
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block mb-1">
                  Executive Summary
                </span>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{diagnosis.summary}</p>
              </div>
            </div>

            {diagnosis.matchedRunbook && (
              <div className="p-3.5 rounded-lg bg-slate-950/70 border border-cyan-800/40">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-mono text-cyan-300 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    Matched Runbook
                  </span>
                  <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-semibold">
                    {(diagnosis.matchedRunbook.similarityScore * 100).toFixed(1)}% Cosine Match
                  </span>
                </div>
                <div className="font-mono text-xs text-slate-200 font-semibold">
                  {diagnosis.matchedRunbook.code}: {diagnosis.matchedRunbook.title}
                </div>
              </div>
            )}

            {diagnosis.toolCallsExecuted && diagnosis.toolCallsExecuted.length > 0 && (
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block mb-1.5">
                  Tool Calls Executed by Agent
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {diagnosis.toolCallsExecuted.map((tc, idx) => (
                    <ToolCallChip key={idx} name={tc} />
                  ))}
                </div>
              </div>
            )}

            {diagnosis.evidenceLogs && diagnosis.evidenceLogs.length > 0 && (
              <div>
                <span className="text-[10px] font-mono uppercase text-slate-500 tracking-wider block mb-1.5">
                  Evidence Log Citations
                </span>
                <div className="space-y-1">
                  {diagnosis.evidenceLogs.map((log, idx) => (
                    <div key={idx} className="p-2 rounded bg-slate-950 border border-slate-800 font-mono text-[11px] text-amber-200/90">
                      {log}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diagnosis.recommendedActions && diagnosis.recommendedActions.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block mb-2 font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Recommended Operator Actions Checklist
                </span>
                <div className="space-y-2">
                  {diagnosis.recommendedActions.map((action, idx) => {
                    const isChecked = !!checkedActions[`${run.id}-${idx}`];
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleAction(idx)}
                        className={`flex items-start gap-2.5 p-2 rounded cursor-pointer transition text-xs font-mono ${
                          isChecked
                            ? 'bg-emerald-950/20 text-slate-400 line-through'
                            : 'bg-slate-900/80 text-slate-200 hover:bg-slate-900'
                        }`}
                      >
                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-500 flex-shrink-0 mt-0.5" />
                        )}
                        <span>{action}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
