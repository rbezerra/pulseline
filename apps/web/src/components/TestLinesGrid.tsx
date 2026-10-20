import React from 'react';
import { Layers } from 'lucide-react';
import { TestLine } from '../types/domain';
import { TestLineCard } from './TestLineCard';

interface TestLinesGridProps {
  lines: TestLine[];
  selectedLineId: string | null;
  onSelectLine: (lineId: string | null) => void;
}

export const TestLinesGrid: React.FC<TestLinesGridProps> = ({ lines, selectedLineId, onSelectLine }) => {
  return (
    <section className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-cyan-400" />
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-slate-300">
            Active Validation Test Lines ({lines.length})
          </h2>
        </div>
        {selectedLineId && (
          <button
            onClick={() => onSelectLine(null)}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 underline"
          >
            Clear line filter (Show all)
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lines.map((line) => (
          <TestLineCard
            key={line.id}
            line={line}
            isSelected={selectedLineId === line.id}
            onSelect={() => onSelectLine(selectedLineId === line.id ? null : line.id)}
          />
        ))}
      </div>
    </section>
  );
};
