import React from 'react';
import { Database, CheckCircle2, XCircle, HardDrive, Cpu, ShieldCheck, RefreshCw, ArrowRight, Table, Layers } from 'lucide-react';
import { DbStatus } from '../types';

interface DbOverviewCardProps {
  dbStatus: DbStatus | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

export const DbOverviewCard: React.FC<DbOverviewCardProps> = ({
  dbStatus,
  loading,
  onRefresh,
  onNavigateTab,
}) => {
  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-6 shadow-xl relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-60 h-60 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <span className="p-2 bg-blue-600/10 text-blue-400 rounded border border-blue-500/20">
                <Database className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold text-gray-100">Cloud SQL PostgreSQL Dedicated Database</h1>
            </div>
            <p className="text-gray-400 text-sm max-w-2xl leading-relaxed">
              This environment hosts your clean PostgreSQL database instance. Store, query, and migrate data safely between your AI Studio web apps without file corruption or gzipped storage errors.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-[#0D1117] hover:bg-[#1C2128] text-gray-200 border border-[#30363D] rounded font-medium text-xs transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh Status</span>
            </button>
            <button
              onClick={() => onNavigateTab('data')}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded font-medium text-xs transition-all shadow"
            >
              <span>Manage App Records</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Status */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">Connection Status</span>
            {dbStatus?.connected ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <XCircle className="w-5 h-5 text-rose-400" />
            )}
          </div>
          <div className="text-2xl font-bold text-gray-100 mb-1">
            {dbStatus?.connected ? 'Connected' : 'Offline'}
          </div>
          <p className="text-xs text-gray-400">
            {dbStatus?.connected ? `Ping Latency: ${dbStatus.latencyMs}ms` : dbStatus?.error || 'Unable to connect'}
          </p>
        </div>

        {/* Database Name */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">Database Name</span>
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div className="text-lg font-bold font-mono text-gray-100 truncate mb-1">
            {dbStatus?.database || 'postgres'}
          </div>
          <p className="text-xs text-gray-400 font-mono">
            User: {dbStatus?.user || 'ai_studio'}
          </p>
        </div>

        {/* Total Tables */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">Managed Tables</span>
            <Table className="w-5 h-5 text-sky-400" />
          </div>
          <div className="text-2xl font-bold text-gray-100 mb-1">
            {dbStatus?.tables?.length || 0} Tables
          </div>
          <p className="text-xs text-gray-400">
            {dbStatus?.tables?.join(', ') || 'No public tables'}
          </p>
        </div>

        {/* Security & Engine */}
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-gray-400 font-medium">Auth & Proxy</span>
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
          </div>
          <div className="text-base font-bold text-gray-100 mb-1">
            Firebase + Auth Proxy
          </div>
          <p className="text-xs text-gray-400">
            Unix Domain Socket Proxy Active
          </p>
        </div>
      </div>

      {/* Feature / Migration Guide Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex flex-col justify-between hover:bg-[#1C2128] transition-colors">
          <div>
            <div className="flex items-center space-x-2 text-blue-400 text-sm font-semibold mb-2">
              <Layers className="w-4 h-4" />
              <span>1. Direct JSON Data Storage</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Store structured JSON payloads directly in PostgreSQL standard text/json columns. Prevents corruption and decoding errors common with local gzipped blob storage.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('data')}
            className="mt-4 text-xs font-medium text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <span>Go to Data Manager</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex flex-col justify-between hover:bg-[#1C2128] transition-colors">
          <div>
            <div className="flex items-center space-x-2 text-sky-400 text-sm font-semibold mb-2">
              <Cpu className="w-4 h-4" />
              <span>2. Interactive SQL Explorer</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Run custom SQL queries, verify schemas, create custom tables, or extract clean dataset dumps for use in your other Google AI Studio web apps.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('sql')}
            className="mt-4 text-xs font-medium text-sky-400 hover:text-sky-300 flex items-center space-x-1"
          >
            <span>Open SQL Explorer</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-[#161B22] border border-[#30363D] rounded-lg p-5 flex flex-col justify-between hover:bg-[#1C2128] transition-colors">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 text-sm font-semibold mb-2">
              <ShieldCheck className="w-4 h-4" />
              <span>3. Schema & Drizzle Kit</span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed">
              Drizzle ORM type-safe schemas are synced with Cloud SQL. Inspect column types, nullability, and primary keys live.
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('schema')}
            className="mt-4 text-xs font-medium text-emerald-400 hover:text-emerald-300 flex items-center space-x-1"
          >
            <span>Inspect Database Schema</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

      </div>
    </div>
  );
};
