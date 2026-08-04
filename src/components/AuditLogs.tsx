import React, { useState, useEffect } from 'react';
import { History, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { DbLog } from '../types';

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<DbLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/db/logs');
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs);
      }
    } catch (e) {
      console.error('Failed to fetch logs', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-100 flex items-center space-x-2">
            <History className="w-5 h-5 text-blue-400" />
            <span>Database Operations & Audit Logs</span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Real-time activity log stored directly in PostgreSQL `db_logs` table.
          </p>
        </div>

        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center space-x-2 px-3 py-1.5 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded text-xs font-medium transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Logs</span>
        </button>
      </div>

      <div className="bg-[#161B22] border border-[#30363D] rounded-lg overflow-hidden shadow-xl">
        {loading ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            Loading database operation logs...
          </div>
        ) : logs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-xs">
            No audit logs recorded yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-300">
              <thead className="bg-[#0D1117] text-gray-400 font-mono uppercase text-[10px] tracking-wider border-b border-[#30363D]">
                <tr>
                  <th className="px-4 py-2.5 font-medium">ID</th>
                  <th className="px-4 py-2.5 font-medium">Action</th>
                  <th className="px-4 py-2.5 font-medium">Details</th>
                  <th className="px-4 py-2.5 font-medium">Executed By</th>
                  <th className="px-4 py-2.5 font-medium text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#30363D] font-mono">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-[#1C2128] transition-colors">
                    <td className="px-4 py-3 text-gray-400">#{log.id}</td>
                    <td className="px-4 py-3 font-semibold text-blue-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 text-gray-200 max-w-md truncate">
                      {log.details}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {log.executedBy || 'system'}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
