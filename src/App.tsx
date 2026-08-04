import React, { useState, useEffect } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from './lib/firebase';
import { Navbar } from './components/Navbar';
import { BscDraftDashboard } from './components/BscDraftDashboard';
import { DbOverviewCard } from './components/DbOverviewCard';
import { SchemaViewer } from './components/SchemaViewer';
import { SqlExplorer } from './components/SqlExplorer';
import { DataManagement } from './components/DataManagement';
import { AuditLogs } from './components/AuditLogs';
import { AuthModal } from './components/AuthModal';
import { DbStatus } from './types';

export default function App() {
  const [activeTab, setActiveTab] = useState<string>('bsc');
  const [dbStatus, setDbStatus] = useState<DbStatus | null>(null);
  const [loadingDb, setLoadingDb] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [showAuthModal, setShowAuthModal] = useState<boolean>(false);

  // Monitor Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // Sync user with backend
        currentUser.getIdToken().then((token) => {
          fetch('/api/auth/sync', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          }).catch(console.error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch Database Connection Status
  const fetchDbStatus = async () => {
    setLoadingDb(true);
    try {
      const res = await fetch('/api/db/status');
      const data = await res.json();
      setDbStatus(data);
    } catch (error: any) {
      setDbStatus({
        connected: false,
        error: error?.message || 'Database server unreachable',
      });
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();
  }, []);

  return (
    <div className="min-h-screen bg-[#0B0E14] text-gray-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      
      {/* Navigation Header */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dbStatus={dbStatus}
        user={user}
        onLogin={() => setShowAuthModal(true)}
        onLogout={() => auth.signOut()}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {activeTab === 'bsc' && (
          <BscDraftDashboard />
        )}

        {activeTab === 'overview' && (
          <DbOverviewCard
            dbStatus={dbStatus}
            loading={loadingDb}
            onRefresh={fetchDbStatus}
            onNavigateTab={setActiveTab}
          />
        )}

        {activeTab === 'data' && (
          <DataManagement />
        )}

        {activeTab === 'sql' && (
          <SqlExplorer />
        )}

        {activeTab === 'schema' && (
          <SchemaViewer />
        )}

        {activeTab === 'logs' && (
          <AuditLogs />
        )}

      </main>

      {/* Footer */}
      <footer className="border-t border-[#30363D] bg-[#0D1117] py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© Google AI Studio - Cloud SQL PostgreSQL Instance</p>
          <div className="flex items-center space-x-4">
            <span>Drizzle ORM</span>
            <span>•</span>
            <span>Firebase Auth</span>
            <span>•</span>
            <span>Europe-West1</span>
          </div>
        </div>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        user={user}
      />

    </div>
  );
}
