import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StatusBadge from './StatusBadge';
import { 
  CheckCircle2, Clock, Calendar, ArrowRight, 
  MessageSquare, UploadCloud, AlertCircle, FileText
} from 'lucide-react';

export default function CandidateDashboard({ onSelectTask }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadMyTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getTasks();
      setTasks(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMyTasks();
  }, []);

  return (
    <div className="space-y-6">
      
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 rounded-2xl p-6 sm:p-8 text-white shadow-md">
        <div className="max-w-3xl">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/30 text-blue-100 border border-blue-400/30 mb-3">
            Candidate Workspace
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Welcome, {user?.name}!
          </h2>
          <p className="mt-2 text-sm sm:text-base text-blue-100 leading-relaxed">
            Review your assigned project deliverables, access AI mentorship, upload documentation,
            and inspect automated code reviews.
          </p>
        </div>
      </div>

      {/* Assigned Tasks Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-slate-900">Your Assigned Tasks</h3>
          <p className="text-xs text-slate-500">Tasks assigned specifically to you by your project manager.</p>
        </div>
        <span className="text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-3 py-1 rounded-full">
          {tasks.length} {tasks.length === 1 ? 'Assignment' : 'Assignments'}
        </span>
      </div>

      {/* Task Cards */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 text-sm bg-white rounded-2xl border border-slate-200">
          Loading assigned tasks...
        </div>
      ) : tasks.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
          <FileText className="w-12 h-12 mx-auto text-slate-300 mb-3" />
          <h4 className="font-bold text-slate-800 text-base">No tasks assigned yet</h4>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            You do not currently have any active assignments. Your project manager will assign tasks with instructions and deadlines.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tasks.map(task => {
            const isDueSoon = task.submission_deadline && (new Date(task.submission_deadline) - new Date() < 86400000);
            return (
              <div 
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                className="bg-white rounded-2xl p-6 border border-slate-200 hover:border-blue-400 shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                      Target Stack: {task.tech_stack || 'General'}
                    </span>
                    <StatusBadge status={task.status} />
                  </div>

                  <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-600 transition line-clamp-1">
                    {task.title}
                  </h4>

                  <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                    {task.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                  
                  {/* Deadlines and Review schedule */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                      <div className="text-slate-400 flex items-center font-medium mb-1">
                        <Clock className="w-3.5 h-3.5 mr-1" /> Deadline
                      </div>
                      <div className={`font-semibold ${isDueSoon ? 'text-amber-600' : 'text-slate-800'}`}>
                        {task.submission_deadline ? new Date(task.submission_deadline).toLocaleDateString() : 'Flexible'}
                      </div>
                    </div>

                    <div className="bg-blue-50/60 p-2.5 rounded-xl border border-blue-100">
                      <div className="text-blue-600 flex items-center font-medium mb-1">
                        <Calendar className="w-3.5 h-3.5 mr-1" /> Next Review
                      </div>
                      <div className="font-semibold text-blue-900">
                        {task.review_datetime ? new Date(task.review_datetime).toLocaleDateString() : 'TBD'}
                      </div>
                    </div>
                  </div>

                  {/* Passing Score & Action */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs text-slate-500">
                      Passing score: <strong className="text-slate-800">{task.passing_score}%</strong>
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
                      className="inline-flex items-center text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                    >
                      Open Workspace <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </button>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}

