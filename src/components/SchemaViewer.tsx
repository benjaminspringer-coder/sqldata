import React, { useState, useEffect } from 'react';
import { Database, Table, Columns, RefreshCw, Key, Hash, Check, Copy } from 'lucide-react';
import { SchemaInfo, ColumnInfo } from '../types';

export const SchemaViewer: React.FC = () => {
  const [schema, setSchema] = useState<SchemaInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedTable, setCopiedTable] = useState<string | null>(null);

  const fetchSchema = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/db/schema-info');
      const data = await res.json();
      if (data.success) {
        setSchema(data.schema);
      } else {
        setError(data.error || 'Failed to load schema');
      }
    } catch (err: any) {
      setError(err?.message || 'Error fetching schema');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchema();
  }, []);

  const copyTableSchema = (tableName: string, columns: any[]) => {
    const text = `Table: ${tableName}\nColumns:\n` + columns.map(c => `  - ${c.name} (${c.type}, nullable: ${c.nullable})`).join('\n');
    navigator.clipboard.writeText(text);
    setCopiedTable(tableName);
    setTimeout(() => setCopiedTable(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
            <Database className="w-5 h-5 text-blue-400" />
            <span>PostgreSQL Database Schema Inspector</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Live metadata pulled from PostgreSQL `information_schema.columns`. Verify table structures and column types.
          </p>
        </div>

        <button
          onClick={fetchSchema}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Schema</span>
        </button>
      </div>

      {loading && (
        <div className="p-12 text-center bg-[#161B22] border border-[#30363D] rounded-lg">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-300">Scanning PostgreSQL schema...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-950/50 border border-rose-800/80 rounded-lg text-rose-300 text-sm">
          Failed to load schema: {error}
        </div>
      )}

      {!loading && !error && schema && Object.keys(schema).length === 0 && (
        <div className="p-8 text-center bg-[#161B22] border border-[#30363D] rounded-lg text-gray-400">
          No public tables found in database.
        </div>
      )}

      {!loading && !error && schema && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(Object.entries(schema) as [string, ColumnInfo[]][]).map(([tableName, columns]) => (
            <div key={tableName} className="bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden shadow-lg">
              {/* Table header */}
              <div className="bg-[#0D1117] px-4 py-3 border-b border-[#30363D] flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Table className="w-4 h-4 text-blue-400" />
                  <span className="font-mono text-sm font-bold text-gray-100">{tableName}</span>
                  <span className="text-[10px] px-2 py-0.5 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-full font-mono">
                    {columns.length} columns
                  </span>
                </div>

                <button
                  onClick={() => copyTableSchema(tableName, columns)}
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1C2128] rounded transition-colors"
                  title="Copy Schema"
                >
                  {copiedTable === tableName ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>

              {/* Columns Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-gray-300">
                  <thead className="bg-[#0D1117] text-gray-400 font-mono text-[11px] uppercase tracking-wider border-b border-[#30363D]">
                    <tr>
                      <th className="px-4 py-2 font-medium">Column</th>
                      <th className="px-4 py-2 font-medium">Data Type</th>
                      <th className="px-4 py-2 font-medium text-right">Nullable</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363D] font-mono">
                    {columns.map((col) => (
                      <tr key={col.name} className="hover:bg-[#1C2128] transition-colors">
                        <td className="px-4 py-2.5 font-semibold text-gray-200 flex items-center space-x-1.5">
                          {col.name === 'id' ? (
                            <Key className="w-3 h-3 text-amber-400" />
                          ) : (
                            <Hash className="w-3 h-3 text-gray-500" />
                          )}
                          <span>{col.name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-blue-300">{col.type}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] rounded ${
                              col.nullable === 'YES'
                                ? 'bg-[#0D1117] text-gray-400 border border-[#30363D]'
                                : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                            }`}
                          >
                            {col.nullable === 'YES' ? 'NULL' : 'NOT NULL'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
