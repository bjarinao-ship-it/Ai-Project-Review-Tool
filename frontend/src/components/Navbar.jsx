import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { LayoutDashboard, UserCheck, LogOut, ArrowRightLeft, Sparkles, Bell } from 'lucide-react';

export default function Navbar({ onOpenLogs, currentView, setCurrentView }) {
  const { user, logout, loginAsDemo } = useAuth();
  const [demoUsers, setDemoUsers] = useState([]);
  const [switching, setSwitching] = useState(false);

  useEffect(() => {
    api.getDemoUsers().then(setDemoUsers).catch(() => {});
  }, []);

  const handleQuickSwitch = async (email) => {
    try {
      setSwitching(true);
      await loginAsDemo(email);
    } catch (e) {
      alert('Error switching user: ' + e.message);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand */}
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-tight">AI Project Review Tool</h1>
            <p className="text-xs text-slate-500">Autonomous Evaluation & Mentorship Platform</p>
          </div>
        </div>

        {/* User context & actions */}
        <div className="flex items-center space-x-4">
          
          {/* Email / Notification Logs (Admin only) */}
          {user?.role === 'admin' && (
            <button
              onClick={onOpenLogs}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 transition"
              title="View Email & Notification Logs"
            >
              <Bell className="w-4 h-4 text-slate-500" />
              <span className="hidden sm:inline">Audit Logs</span>
            </button>
          )}

          {/* Quick Demo Switcher */}
          {demoUsers.length > 1 && (
            <div className="hidden md:flex items-center space-x-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <span className="px-2 text-slate-500 flex items-center font-medium">
                <ArrowRightLeft className="w-3.5 h-3.5 mr-1" /> Switch:
              </span>
              {demoUsers.map((u) => {
                const isActive = user?.email === u.email;
                return (
                  <button
                    key={u.id}
                    disabled={isActive || switching}
                    onClick={() => handleQuickSwitch(u.email)}
                    className={`px-2.5 py-1 rounded-md font-medium transition ${
                      isActive
                        ? 'bg-white text-blue-700 shadow-xs border border-slate-200'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
                    }`}
                  >
                    {u.role === 'admin' ? 'Admin' : u.name.split(' ')[0]}
                  </button>
                );
              })}
            </div>
          )}

          {/* User badge */}
          <div className="flex items-center space-x-2 pl-2 border-l border-slate-200">
            <div className="text-right">
              <div className="text-sm font-semibold text-slate-800 leading-none">{user?.name}</div>
              <span className={`inline-block text-[11px] font-bold uppercase tracking-wider mt-0.5 px-1.5 py-0.2 rounded ${
                user?.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
              }`}>
                {user?.role}
              </span>
            </div>

            {/* Logout button */}
            <button
              onClick={logout}
              title="Sign Out"
              className="p-2 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}

