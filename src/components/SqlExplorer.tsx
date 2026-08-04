import React, { useState } from 'react';
import { Play, Terminal, Sparkles, Clock, FileSpreadsheet, Copy, Check, AlertCircle } from 'lucide-react';
import { SqlQueryResult } from '../types';

export const SqlExplorer: React.FC = () => {
  const [query, setQuery] = useState<string>('SELECT * FROM app_items ORDER BY id DESC LIMIT 10;');
  const [result, setResult] = useState<SqlQueryResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  const templateQueries = [
    { label: 'View App Items', sql: 'SELECT * FROM app_items ORDER BY id DESC LIMIT 10;' },
    { label: 'List Projects', sql: 'SELECT * FROM projects ORDER BY id DESC;' },
    { label: 'List Users', sql: 'SELECT * FROM users ORDER BY id DESC;' },
    { label: 'System Audit Logs', sql: 'SELECT * FROM db_logs ORDER BY id DESC LIMIT 10;' },
    { label: 'Table Column Counts', sql: 'SELECT table_name, count(*) FROM information_schema.columns WHERE table_schema=\'public\' GROUP BY table_name;' },
  ];

  const handleRunQuery = async (queryToRun?: string) => {
    const q = queryToRun || query;
    if (!q.trim()) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/db/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      setResult(data);
    } catch (err: any) {
      setResult({
        success: false,
        error: err?.message || 'Network error running SQL query',
      });
    } finally {
      setLoading(false);
    }
  };

  const copyResultsAsJson = () => {
    if (!result?.rows) return;
    navigator.clipboard.writeText(JSON.stringify(result.rows, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Editor Card */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 shadow-xl space-y-4">
        
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5 text-blue-400" />
            <h2 className="text-lg font-bold text-gray-100">PostgreSQL SQL Explorer</h2>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => handleRunQuery()}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center space-x-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-semibold text-xs transition-all shadow disabled:opacity-50"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{loading ? 'Running...' : 'Execute SQL'}</span>
            </button>
          </div>
        </div>

        {/* Quick Query Templates */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-[#30363D]">
          <span className="text-xs text-gray-400 flex items-center space-x-1 py-1">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>Templates:</span>
          </span>
          {templateQueries.map((item, idx) => (
            <button
              key={idx}
              onClick={() => {
                setQuery(item.sql);
                handleRunQuery(item.sql);
              }}
              className="px-2.5 py-1 bg-[#0D1117] hover:bg-[#1C2128] text-gray-300 border border-[#30363D] rounded text-xs font-mono transition-colors"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Text Area Code Editor */}
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Write SQL query here..."
            rows={4}
            className="w-full bg-[#0D1117] text-blue-300 font-mono text-sm p-4 rounded border border-[#30363D] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Query Result Output */}
      {result && (
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden shadow-xl">
          {/* Result Header */}
          <div className="bg-[#0D1117] px-5 py-3 border-b border-[#30363D] flex items-center justify-between">
            <div className="flex items-center space-x-3 text-xs">
              <span className={`font-semibold ${result.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                {result.success ? 'Query Executed Successfully' : 'Query Failed'}
              </span>
              {result.executionTimeMs !== undefined && (
                <span className="text-gray-400 flex items-center space-x-1 font-mono">
                  <Clock className="w-3 h-3" />
                  <span>{result.executionTimeMs}ms</span>
                </span>
              )}
              {result.rowCount !== undefined && (
                <span className="text-gray-400 font-mono">
                  Rows: {result.rowCount}
                </span>
              )}
            </div>

            {result.rows && result.rows.length > 0 && (
              <button
                onClick={copyResultsAsJson}
                className="flex items-center space-x-1 px-3 py-1 bg-[#161B22] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied JSON' : 'Export JSON'}</span>
              </button>
            )}
          </div>

          {/* Error Message */}
          {!result.success && result.error && (
            <div className="p-4 bg-rose-950/60 text-rose-300 font-mono text-xs flex items-start space-x-2 border-b border-[#30363D]">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold mb-1">SQL Syntax or Execution Error:</p>
                <p>{result.error}</p>
              </div>
            </div>
          )}

          {/* Table Data Render */}
          {result.success && result.rows && (
            <div className="overflow-x-auto max-h-[500px]">
              {result.rows.length === 0 ? (
                <div className="p-8 text-center text-gray-400 text-xs">
                  Query returned 0 rows.
                </div>
              ) : (
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0D1117] text-gray-400 font-mono uppercase text-[10px] tracking-wider sticky top-0 border-b border-[#30363D]">
                    <tr>
                      {result.fields?.map((field) => (
                        <th key={field} className="px-4 py-2.5 border-b border-[#30363D] font-medium">
                          {field}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363D] font-mono">
                    {result.rows.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#1C2128] transition-colors">
                        {result.fields?.map((field) => (
                          <td key={field} className="px-4 py-2.5 max-w-xs truncate text-gray-200">
                            {typeof row[field] === 'object'
                              ? JSON.stringify(row[field])
                              : String(row[field] ?? 'NULL')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
