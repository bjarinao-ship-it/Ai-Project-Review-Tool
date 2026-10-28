import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthView from './components/AuthView';
import AdminDashboard from './components/AdminDashboard';
import CandidateDashboard from './components/CandidateDashboard';
import TaskWorkspace from './components/TaskWorkspace';
import LogsModal from './components/LogsModal';

export default function App() {
  const { user, loading } = useAuth();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showLogsModal, setShowLogsModal] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="flex items-center space-x-3">
          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-sm font-semibold">Loading AI Project Review Tool...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthView />;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar
        onOpenLogs={() => setShowLogsModal(true)}
        setCurrentView={(view) => {
          if (view === 'dashboard') setSelectedTaskId(null);
        }}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {selectedTaskId ? (
          <TaskWorkspace
            taskId={selectedTaskId}
            onBack={() => setSelectedTaskId(null)}
          />
        ) : user.role === 'admin' ? (
          <AdminDashboard
            onSelectTask={(id) => setSelectedTaskId(id)}
          />
        ) : (
          <CandidateDashboard
            onSelectTask={(id) => setSelectedTaskId(id)}
          />
        )}
      </main>

      {/* Admin Audit Logs Modal */}
      <LogsModal
        isOpen={showLogsModal}
        onClose={() => setShowLogsModal(false)}
      />
    </div>
  );
}
