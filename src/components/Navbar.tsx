import React from 'react';
import { Database, Shield, Server, Terminal, FileCode2, History, LogIn, LogOut, Activity, Trophy } from 'lucide-react';
import { DbStatus } from '../types';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  dbStatus: DbStatus | null;
  user: any;
  onLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  dbStatus,
  user,
  onLogin,
  onLogout,
}) => {
  const tabs = [
    { id: 'bsc', label: 'BSC Brackets & Drafts', icon: Trophy },
    { id: 'overview', label: 'Overview', icon: Server },
    { id: 'data', label: 'Data & Projects', icon: FileCode2 },
    { id: 'sql', label: 'SQL Explorer', icon: Terminal },
    { id: 'schema', label: 'Schema Inspection', icon: Database },
    { id: 'logs', label: 'Audit Logs', icon: History },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0D1117] border-b border-[#30363D] text-gray-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Connection Badge */}
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-600/10 text-blue-400 rounded border border-blue-500/20">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-gray-100">
                  CloudSQL Hub
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                  PostgreSQL
                </span>
              </div>
              <p className="text-xs text-gray-400 hidden sm:block">
                Dedicated database manager for AI Studio web apps
              </p>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                      : 'text-gray-400 hover:bg-[#161B22] hover:text-gray-100'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Status & Auth Actions */}
          <div className="flex items-center space-x-3">
            {/* DB Health indicator */}
            <div className="hidden lg:flex items-center space-x-2 text-xs px-3 py-1.5 rounded-md bg-[#161B22] border border-[#30363D]">
              <Activity className={`w-3.5 h-3.5 ${dbStatus?.connected ? 'text-emerald-400 animate-pulse' : 'text-rose-400'}`} />
              <span className="text-gray-300 font-mono">
                {dbStatus?.connected ? `${dbStatus.latencyMs}ms` : 'Offline'}
              </span>
            </div>

            {/* User Auth */}
            {user ? (
              <div className="flex items-center space-x-2">
                <div className="text-right text-xs hidden sm:block">
                  <p className="font-medium text-gray-200">{user.displayName || user.email}</p>
                  <p className="text-gray-500 text-[10px] font-mono">UID: {user.uid?.slice(0, 8)}...</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-2 text-gray-400 hover:text-white hover:bg-[#161B22] rounded-md transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogin}
                className="flex items-center space-x-1.5 px-3.5 py-1.5 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-all shadow"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Google Sign-In</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="md:hidden flex overflow-x-auto border-t border-[#30363D] px-2 py-1.5 space-x-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap ${
                isActive ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20' : 'text-gray-400 hover:bg-[#161B22]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
};
