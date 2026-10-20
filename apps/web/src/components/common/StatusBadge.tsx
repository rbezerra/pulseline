import React from 'react';
import { CheckCircle2, AlertTriangle, AlertOctagon, XCircle, MinusCircle } from 'lucide-react';
import { LineHealthStatus, TestRunStatus } from '../../types/domain';

export const LineHealthBadge: React.FC<{ status: LineHealthStatus; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => {
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (status === 'HEALTHY') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <CheckCircle2 className="w-3.5 h-3.5" />
        HEALTHY
      </span>
    );
  }
  if (status === 'DEGRADED') {
    return (
      <span className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 ${sizeClasses}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
        <AlertTriangle className="w-3.5 h-3.5" />
        DEGRADED
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30 animate-pulse-fast ${sizeClasses}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
      <AlertOctagon className="w-3.5 h-3.5" />
      CRITICAL
    </span>
  );
};

export const RunStatusBadge: React.FC<{ status: TestRunStatus }> = ({ status }) => {
  if (status === 'PASSED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        <CheckCircle2 className="w-3 h-3" />
        PASSED
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-rose-500/15 text-rose-400 border border-rose-500/30">
        <XCircle className="w-3 h-3" />
        FAILED
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded bg-slate-500/15 text-slate-400 border border-slate-500/30">
      <MinusCircle className="w-3 h-3" />
      ABORTED
    </span>
  );
};
