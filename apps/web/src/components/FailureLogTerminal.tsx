import React from 'react';
import { Terminal } from 'lucide-react';
import { FailureLog } from '../types/domain';

interface FailureLogTerminalProps {
  logs?: FailureLog[];
}

export const FailureLogTerminal: React.FC<FailureLogTerminalProps> = ({ logs = [] }) => {
  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toISOString().substring(11, 23);
    } catch {
      return ts;
    }
  };

  return (
    <div className="rounded-lg bg-black border border-slate-800 font-mono text-xs overflow-hidden shadow-inner mb-4">
      <div className="bg-slate-900/90 px-3 py-1.5 border-b border-slate-800 flex items-center justify-between text-slate-400">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-[11px] tracking-wider uppercase">FAILURE LOGS STREAM</span>
          <span className="text-[10px] text-slate-500">({logs.length} entries)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block" />
        </div>
      </div>

      <div className="p-3 max-h-56 overflow-y-auto space-y-2">
        {logs.length === 0 ? (
          <div className="text-slate-600 text-xs py-4 text-center">
            No diagnostic Failure Logs recorded for this Test Run.
          </div>
        ) : (
          logs.map((log) => {
            const isFatal = log.severity === 'FATAL';
            const isError = log.severity === 'ERROR';
            const isStation = log.source === 'STATION_INSTRUMENT';

            return (
              <div
                key={log.id}
                className={`p-2 rounded border font-mono text-[11px] leading-relaxed ${
                  isFatal
                    ? 'bg-rose-950/40 border-rose-700/60 text-rose-200'
                    : isError
                    ? 'bg-rose-950/20 border-rose-900/40 text-rose-300'
                    : 'bg-amber-950/20 border-amber-900/40 text-amber-300'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1 text-[10px]">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">{formatTime(log.timestamp)}</span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold ${
                        isStation ? 'bg-purple-900/60 text-purple-300' : 'bg-cyan-900/60 text-cyan-300'
                      }`}
                    >
                      {log.source}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded font-bold ${
                        isFatal ? 'bg-red-700 text-white' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {log.severity}
                    </span>
                  </div>
                  <span className="font-bold text-slate-400">{log.errorCode}</span>
                </div>
                <div className="text-slate-200 break-words whitespace-pre-wrap">{log.message}</div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
