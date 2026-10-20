import React, { useState } from 'react';
import { BookOpen, Search, X, Database, ChevronRight } from 'lucide-react';
import { Runbook } from '../types/domain';
import { ScopeBadge } from './common/ScopeBadge';

interface RunbooksModalProps {
  isOpen: boolean;
  onClose: () => void;
  runbooks: Runbook[];
}

export const RunbooksModal: React.FC<RunbooksModalProps> = ({ isOpen, onClose, runbooks }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState<string>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (!isOpen) return null;

  const filtered = runbooks.filter((rb) => {
    if (scopeFilter !== 'ALL' && rb.rootCauseScope !== scopeFilter) return false;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        rb.title.toLowerCase().includes(term) ||
        rb.code.toLowerCase().includes(term) ||
        rb.symptomSignature.toLowerCase().includes(term) ||
        rb.technicalExplanation.toLowerCase().includes(term)
      );
    }
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-5 h-5 text-cyan-400" />
            <div>
              <h3 className="font-bold text-base text-slate-100 font-mono">Runbooks Knowledge Base</h3>
              <p className="text-xs text-slate-400">Vector(768) Indexed Troubleshooting Procedures per ADR-0001</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-800 bg-slate-950/50 flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by code, title, or symptom..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 font-mono"
            />
          </div>

          <div className="flex items-center gap-1 text-xs font-mono">
            {['ALL', 'DUT_HARDWARE', 'DUT_FIRMWARE', 'TEST_STATION_RIG'].map((scope) => (
              <button
                key={scope}
                onClick={() => setScopeFilter(scope)}
                className={`px-2.5 py-1.5 rounded-lg transition ${
                  scopeFilter === scope
                    ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                {scope}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 overflow-y-auto space-y-3 flex-1">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-slate-500 font-mono text-xs">
              No matching runbooks found.
            </div>
          ) : (
            filtered.map((rb) => {
              const isExpanded = expandedId === rb.id;
              return (
                <div
                  key={rb.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 transition hover:border-slate-700"
                >
                  <div
                    className="flex items-start justify-between gap-3 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : rb.id)}
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                          {rb.code}
                        </span>
                        <h4 className="font-semibold text-slate-200 text-sm">{rb.title}</h4>
                      </div>
                      <p className="text-xs text-slate-400 font-mono mt-1">
                        <span className="text-slate-500">Symptom:</span> {rb.symptomSignature}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <ScopeBadge scope={rb.rootCauseScope} />
                      <ChevronRight
                        className={`w-4 h-4 text-slate-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-4 pt-4 border-t border-slate-800 text-xs font-sans space-y-3">
                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                          Technical Explanation
                        </span>
                        <p className="text-slate-300 leading-relaxed">{rb.technicalExplanation}</p>
                      </div>

                      <div>
                        <span className="font-mono text-[11px] uppercase tracking-wider text-slate-400 font-bold block mb-1">
                          Remediation Steps
                        </span>
                        <ol className="list-decimal list-inside space-y-1 font-mono text-slate-300">
                          {rb.remediationSteps.map((step, idx) => (
                            <li key={idx} className="leading-relaxed">
                              {step}
                            </li>
                          ))}
                        </ol>
                      </div>

                      <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 border-t border-slate-900">
                        <span className="flex items-center gap-1">
                          <Database className="w-3 h-3 text-cyan-500" />
                          Indexed in pgvector (768 dimensions)
                        </span>
                        <span>ID: {rb.id}</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
