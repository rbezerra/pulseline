import React, { useState } from 'react';
import { Activity, Filter } from 'lucide-react';
import { TestRun, TestLine } from '../types/domain';
import { TestRunCard } from './TestRunCard';

interface TestRunFeedProps {
  runs: TestRun[];
  lines: TestLine[];
  selectedRunId: string | null;
  onSelectRunId: (id: string) => void;
  selectedLineId: string | null;
  onSelectLineId: (lineId: string | null) => void;
}

export const TestRunFeed: React.FC<TestRunFeedProps> = ({
  runs,
  lines,
  selectedRunId,
  onSelectRunId,
  selectedLineId,
  onSelectLineId,
}) => {
  const [filterFailedOnly, setFilterFailedOnly] = useState(false);

  const filteredRuns = runs.filter((r) => {
    if (filterFailedOnly && r.status !== 'FAILED') return false;
    if (selectedLineId && r.lineId !== selectedLineId) return false;
    return true;
  });

  return (
    <div className="bg-slate-900/60 rounded-xl border border-slate-800 p-4 flex flex-col h-[740px]">
      <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400 animate-pulse" />
          <h3 className="text-sm font-bold font-mono uppercase tracking-wider text-slate-200">
            Real-Time Test Run Feed
          </h3>
          <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
            {filteredRuns.length}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-950 p-1 border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setFilterFailedOnly(false)}
              className={`px-2.5 py-1 rounded transition ${
                !filterFailedOnly ? 'bg-slate-800 text-slate-100 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              ALL
            </button>
            <button
              onClick={() => setFilterFailedOnly(true)}
              className={`px-2.5 py-1 rounded transition ${
                filterFailedOnly ? 'bg-rose-950/80 text-rose-300 font-bold border border-rose-800/60' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              FAILED ONLY
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded border border-slate-800 text-xs font-mono">
            <Filter className="w-3 h-3 text-slate-400" />
            <select
              value={selectedLineId || ''}
              onChange={(e) => onSelectLineId(e.target.value || null)}
              className="bg-transparent text-slate-300 text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">All Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900">
                  {l.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {filteredRuns.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-500 font-mono text-xs">
            <p>No Test Runs match the selected filters.</p>
            <p className="mt-1 text-slate-600">Waiting for live telemetry stream...</p>
          </div>
        ) : (
          filteredRuns.map((run) => (
            <TestRunCard
              key={run.id}
              run={run}
              isSelected={selectedRunId === run.id}
              onSelect={() => onSelectRunId(run.id)}
            />
          ))
        )}
      </div>
    </div>
  );
};
