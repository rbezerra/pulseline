import React from 'react';
import { Terminal, Database, Activity } from 'lucide-react';

export const ToolCallChip: React.FC<{ name: string }> = ({ name }) => {
  const getIcon = () => {
    if (name.includes('Runbook') || name.includes('vector')) return <Database className="w-3 h-3 text-cyan-400" />;
    if (name.includes('Station') || name.includes('Runs')) return <Activity className="w-3 h-3 text-emerald-400" />;
    return <Terminal className="w-3 h-3 text-indigo-400" />;
  };

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-900 border border-slate-700/80 text-xs font-mono text-slate-300 shadow-sm">
      {getIcon()}
      <span>{name}</span>
    </span>
  );
};
