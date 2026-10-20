import React from 'react';
import { Clock, Sparkles, ChevronRight } from 'lucide-react';
import { TestRun } from '../types/domain';
import { RunStatusBadge } from './common/StatusBadge';
import { ScopeBadge } from './common/ScopeBadge';

interface TestRunCardProps {
  run: TestRun;
  isSelected: boolean;
  onSelect: () => void;
}

export const TestRunCard: React.FC<TestRunCardProps> = ({ run, isSelected, onSelect }) => {
  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return iso;
    }
  };

  return (
    <div
      onClick={onSelect}
      className={`p-3 rounded-lg border transition cursor-pointer mb-2 flex items-center justify-between gap-3 ${
        isSelected
          ? 'bg-slate-800/90 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
          : run.status === 'FAILED'
          ? 'bg-rose-950/20 hover:bg-rose-950/30 border-rose-900/50 hover:border-rose-700/60'
          : 'bg-slate-900/60 hover:bg-slate-900 border-slate-800/80 hover:border-slate-700'
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <RunStatusBadge status={run.status} />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-xs text-slate-100 truncate">{run.dutSerial}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">{run.dutModel}</span>
            <span className="text-[10px] font-mono text-slate-500">{run.firmwareVersion}</span>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 mt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" />
              {run.latencyMs}ms
            </span>
            <span>&bull;</span>
            <span className="text-slate-500">{formatTime(run.completedAt || run.startedAt)}</span>
            {run.errorCode && (
              <>
                <span>&bull;</span>
                <span className="text-rose-400 font-bold truncate">ERR: {run.errorCode}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {run.triageDiagnosis ? (
          <div className="flex items-center gap-1.5">
            <ScopeBadge scope={run.triageDiagnosis.rootCauseScope} showLabel={false} />
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 flex items-center gap-1">
              <Sparkles className="w-2.5 h-2.5" />
              {(run.triageDiagnosis.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ) : run.status === 'FAILED' ? (
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/60">
            Triage Available
          </span>
        ) : null}

        <ChevronRight className={`w-4 h-4 ${isSelected ? 'text-cyan-400' : 'text-slate-600'}`} />
      </div>
    </div>
  );
};
