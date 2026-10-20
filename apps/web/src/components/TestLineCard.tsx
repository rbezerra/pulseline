import React from 'react';
import { Clock, Cpu, AlertOctagon, Layers } from 'lucide-react';
import { TestLine } from '../types/domain';
import { LineHealthBadge } from './common/StatusBadge';

interface TestLineCardProps {
  line: TestLine;
  isSelected: boolean;
  onSelect: () => void;
}

export const TestLineCard: React.FC<TestLineCardProps> = ({ line, isSelected, onSelect }) => {
  const sortedStations = [...(line.stations || [])].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const getYieldColor = (yieldVal: number) => {
    if (yieldVal >= 90) return 'text-emerald-400 border-emerald-500/30 bg-emerald-950/20';
    if (yieldVal >= 75) return 'text-amber-400 border-amber-500/30 bg-amber-950/20';
    return 'text-rose-400 border-rose-500/30 bg-rose-950/20';
  };

  return (
    <div
      onClick={onSelect}
      className={`relative rounded-xl bg-slate-900/80 border transition cursor-pointer p-4 hover:border-slate-600 ${
        isSelected
          ? 'border-cyan-500 ring-1 ring-cyan-500/40 shadow-lg shadow-cyan-950/40'
          : line.healthStatus === 'CRITICAL'
          ? 'border-rose-500/60 shadow-lg shadow-rose-950/30'
          : 'border-slate-800'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-semibold border border-slate-700">
              {line.code}
            </span>
            <h3 className="font-semibold text-slate-100 text-sm">{line.name}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">{line.description}</p>
        </div>
        <LineHealthBadge status={line.healthStatus} />
      </div>

      <div className="grid grid-cols-4 gap-2 mb-4">
        <div className={`p-2 rounded-lg border flex flex-col items-center justify-center ${getYieldColor(line.yieldPercentage)}`}>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">Yield</span>
          <span className="text-lg font-bold font-mono">{line.yieldPercentage.toFixed(1)}%</span>
        </div>

        <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col items-center justify-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5" /> DUT
          </span>
          <span className="text-xs font-bold font-mono text-slate-200 truncate max-w-full">
            {line.activeDutSerial || 'IDLE'}
          </span>
        </div>

        <div className="p-2 rounded-lg border border-slate-800 bg-slate-950/60 flex flex-col items-center justify-center">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <Clock className="w-2.5 h-2.5" /> Latency
          </span>
          <span className="text-xs font-bold font-mono text-slate-200">
            {line.lastCycleLatencyMs} <span className="text-[10px] font-normal text-slate-400">ms</span>
          </span>
        </div>

        <div className={`p-2 rounded-lg border flex flex-col items-center justify-center ${
          line.consecutiveFailures > 0
            ? 'border-rose-500/40 bg-rose-950/30 text-rose-300'
            : 'border-slate-800 bg-slate-950/60 text-slate-300'
        }`}>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 flex items-center gap-1">
            <AlertOctagon className="w-2.5 h-2.5" /> Failures
          </span>
          <span className="text-xs font-bold font-mono">
            {line.consecutiveFailures}
          </span>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 mb-1.5">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3 text-cyan-400" />
            Test Stations ({sortedStations.length})
          </span>
          <span className="text-[10px] text-slate-500">Pipeline Flow &rarr;</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          {sortedStations.map((station, idx) => (
            <React.Fragment key={station.id}>
              <div
                className="flex-shrink-0 px-2 py-1.5 rounded bg-slate-950 border border-slate-800 text-[11px] font-mono flex flex-col min-w-[110px]"
                title={`${station.name} (${station.instrumentModel})`}
              >
                <div className="flex items-center justify-between gap-1 text-slate-300">
                  <span className="text-cyan-400 font-bold">#{station.sequenceOrder}</span>
                  <span className="truncate">{station.code}</span>
                </div>
                <span className="text-[9px] text-slate-500 truncate mt-0.5">{station.instrumentModel}</span>
              </div>
              {idx < sortedStations.length - 1 && (
                <span className="text-slate-600 text-xs font-bold">&rarr;</span>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
