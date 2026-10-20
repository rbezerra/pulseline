import React, { useState } from 'react';
import { Activity, Play, Pause, Sparkles, BookOpen, Wifi, WifiOff, AlertTriangle, Flame, ShieldAlert, Cpu } from 'lucide-react';
import { useWsStatus } from '../apollo/client';
import { SimulatorStatus, ScenarioCode, TestLine } from '../types/domain';

interface HeaderControlBarProps {
  simulatorStatus?: SimulatorStatus;
  lines: TestLine[];
  selectedLineId: string | null;
  onSelectLineId: (lineId: string | null) => void;
  onToggleSimulator: (running: boolean) => Promise<void>;
  onInjectScenario: (code: ScenarioCode, lineId?: string) => Promise<void>;
  onOpenRunbooks: () => void;
}

export const HeaderControlBar: React.FC<HeaderControlBarProps> = ({
  simulatorStatus,
  lines,
  selectedLineId,
  onSelectLineId,
  onToggleSimulator,
  onInjectScenario,
  onOpenRunbooks,
}) => {
  const wsConnected = useWsStatus();
  const [isInjecting, setIsInjecting] = useState<string | null>(null);

  const handleInject = async (code: ScenarioCode) => {
    try {
      setIsInjecting(code);
      await onInjectScenario(code, selectedLineId || undefined);
    } finally {
      setIsInjecting(null);
    }
  };

  return (
    <header className="bg-slate-900/90 border-b border-slate-800 backdrop-blur sticky top-0 z-40 px-4 py-3">
      <div className="max-w-[1720px] mx-auto flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-950/80 border border-cyan-500/40 text-cyan-400 shadow-inner">
            <Activity className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-wider text-slate-100 font-mono">PULSE<span className="text-cyan-400">LINE</span></span>
              <span className="text-[10px] uppercase font-bold tracking-widest px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">MISSION CONTROL</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Hardware Validation & AI Incident Triage Platform</p>
          </div>

          <div className="ml-2 pl-3 border-l border-slate-800 hidden md:flex items-center gap-2">
            {wsConnected ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded bg-emerald-950/50 text-emerald-400 border border-emerald-700/50">
                <Wifi className="w-3 h-3 text-emerald-400" />
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                LIVE WS CONNECTED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded bg-rose-950/50 text-rose-400 border border-rose-700/50">
                <WifiOff className="w-3 h-3 text-rose-400" />
                WS DISCONNECTED
              </span>
            )}

            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-mono rounded bg-indigo-950/50 text-indigo-300 border border-indigo-700/50">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              AI: <strong className="text-cyan-300 uppercase">{simulatorStatus?.activeProvider || 'MOCK'}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-xs">
            <span className="text-slate-400 font-mono">TARGET:</span>
            <select
              value={selectedLineId || ''}
              onChange={(e) => onSelectLineId(e.target.value ? e.target.value : null)}
              className="bg-transparent text-slate-200 font-mono text-xs focus:outline-none cursor-pointer"
            >
              <option value="" className="bg-slate-900">All Test Lines</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id} className="bg-slate-900">
                  {l.code} ({l.name})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => onToggleSimulator(!simulatorStatus?.running)}
            className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-mono font-bold transition shadow ${
              simulatorStatus?.running
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                : 'bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30'
            }`}
          >
            {simulatorStatus?.running ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                <span>SIMULATOR: RUNNING</span>
                <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                <span>SIMULATOR: PAUSED</span>
              </>
            )}
          </button>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider hidden lg:block mr-1">
            Inject Scenario:
          </div>

          <button
            disabled={isInjecting !== null}
            onClick={() => handleInject('RF_PA_GAIN_OUT_OF_BOUNDS')}
            title="Inject RF PA Gain Out of Bounds (DUT_HARDWARE Defect)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-600/50 text-amber-300 text-xs font-mono transition disabled:opacity-50"
          >
            <Cpu className="w-3 h-3 text-amber-400" />
            <span>RF PA Gain</span>
          </button>

          <button
            disabled={isInjecting !== null}
            onClick={() => handleInject('BASEBAND_MODEM_KERNEL_PANIC')}
            title="Inject Baseband Modem Kernel Panic (DUT_FIRMWARE Regression)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-indigo-950/60 hover:bg-indigo-900/80 border border-indigo-600/50 text-indigo-300 text-xs font-mono transition disabled:opacity-50"
          >
            <AlertTriangle className="w-3 h-3 text-indigo-400" />
            <span>Modem Panic</span>
          </button>

          <button
            disabled={isInjecting !== null}
            onClick={() => handleInject('USB_ADB_ENUMERATION_TIMEOUT')}
            title="Inject USB/ADB Enumeration Timeout 3x (TEST_STATION_RIG -> triggers CRITICAL)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/50 text-rose-300 text-xs font-mono transition disabled:opacity-50"
          >
            <Flame className="w-3 h-3 text-rose-400" />
            <span>USB/ADB Timeout (3x)</span>
          </button>

          <button
            disabled={isInjecting !== null}
            onClick={() => handleInject('THERMAL_CHAMBER_SENSOR_DRIFT')}
            title="Inject Thermal Chamber Sensor Drift 3x (TEST_STATION_RIG -> triggers CRITICAL)"
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-rose-950/60 hover:bg-rose-900/80 border border-rose-600/50 text-rose-300 text-xs font-mono transition disabled:opacity-50"
          >
            <ShieldAlert className="w-3 h-3 text-rose-400" />
            <span>Sensor Drift (3x)</span>
          </button>

          <button
            onClick={onOpenRunbooks}
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-mono transition"
          >
            <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
            <span>Runbooks KB</span>
          </button>
        </div>
      </div>
    </header>
  );
};
