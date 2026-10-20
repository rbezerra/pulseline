import React from 'react';
import { Cpu, FileCode, Wrench } from 'lucide-react';
import { RootCauseScope } from '../../types/domain';

export const ScopeBadge: React.FC<{ scope: RootCauseScope; showLabel?: boolean }> = ({ scope, showLabel = true }) => {
  if (scope === 'DUT_HARDWARE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30">
        <Cpu className="w-3.5 h-3.5 text-amber-400" />
        {showLabel ? 'DUT Hardware Defect' : 'DUT_HARDWARE'}
      </span>
    );
  }
  if (scope === 'DUT_FIRMWARE') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
        {showLabel ? 'DUT Firmware Regression' : 'DUT_FIRMWARE'}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-500/15 text-rose-300 border border-rose-500/30">
      <Wrench className="w-3.5 h-3.5 text-rose-400" />
      {showLabel ? 'Test Station Rig / Instrumentation' : 'TEST_STATION_RIG'}
    </span>
  );
};
