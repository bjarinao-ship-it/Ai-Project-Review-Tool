import React, { useState, useEffect } from 'react';
import { api } from '../api';
import StatusBadge from './StatusBadge';
import { 
  FolderPlus, PlusCircle, CheckCircle2, Clock, Calendar, 
  FileText, User, Upload, ArrowUpRight, Search, SlidersHorizontal, RefreshCw
} from 'lucide-react';

export default function AdminDashboard({ onSelectTask }) {
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // Form states
  const [newProject, setNewProject] = useState({ name: '', description: '' });
  const [newTask, setNewTask] = useState({
    project_id: '',
    module_id: '',
    title: '',
    description: '',
    tech_stack: '',
    deliverables: '',
    submission_deadline: '',
    review_datetime: '',
    passing_score: 70,
    candidate_name: '',
    candidate_email: '',
  });
  const [taskRefFile, setTaskRefFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Load data
  const loadData = async () => {
    try {
      setLoading(true);
      const [projData, taskData] = await Promise.all([
        api.getProjects(),
        api.getTasks()
      ]);
      setProjects(projData);
      setTasks(taskData);
      if (projData.length > 0 && !newTask.project_id) {
        setNewTask(prev => ({
          ...prev,
          project_id: projData[0].id,
          module_id: projData[0].modules?.[0]?.id || ''
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const created = await api.createProject(newProject.name, newProject.description);
      // Auto-create default module for convenience
      await api.createModule(created.id, 'Core Features', 'Default project module');
      setShowProjectModal(false);
      setNewProject({ name: '', description: '' });
      await loadData();
    } catch (err) {
      alert('Failed to create project: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!newTask.module_id) {
      alert('Please select or create a project module first.');
      return;
    }
    try {
      setSubmitting(true);
      const taskPayload = {
        module_id: parseInt(newTask.module_id),
        title: newTask.title,
        description: newTask.description,
        tech_stack: newTask.tech_stack,
        deliverables: newTask.deliverables,
        submission_deadline: newTask.submission_deadline ? new Date(newTask.submission_deadline).toISOString() : null,
        review_datetime: newTask.review_datetime ? new Date(newTask.review_datetime).toISOString() : null,
        passing_score: parseInt(newTask.passing_score) || 70,
        candidate_name: newTask.candidate_name,
        candidate_email: newTask.candidate_email,
      };

      const created = await api.createTask(taskPayload);

      // Upload reference file if selected
      if (taskRefFile) {
        await api.uploadReferenceDoc(created.id, taskRefFile);
      }

      setShowTaskModal(false);
      setTaskRefFile(null);
      setNewTask({
        project_id: projects[0]?.id || '',
        module_id: projects[0]?.modules?.[0]?.id || '',
        title: '',
        description: '',
        tech_stack: '',
        deliverables: '',
        submission_deadline: '',
        review_datetime: '',
        passing_score: 70,
        candidate_name: '',
        candidate_email: '',
      });
      await loadData();
    } catch (err) {
      alert('Failed to create task: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleMarkComplete = async (taskId, e) => {
    e.stopPropagation();
    if (!confirm('Mark this task as Completed?')) return;
    try {
      await api.updateTask(taskId, { status: 'Completed' });
      await loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    const matchesFilter = filterStatus === 'ALL' || t.status === filterStatus;
    const matchesSearch = searchQuery === '' || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tech_stack.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.assigned_candidate?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  // Calculate metrics
  const totalTasks = tasks.length;
  const submittedCount = tasks.filter(t => t.status === 'Submitted').length;
  const revisionCount = tasks.filter(t => t.status === 'Needs Revision').length;
  const completedCount = tasks.filter(t => t.status === 'Completed').length;

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Project Manager Console</h2>
          <p className="text-sm text-slate-500 mt-1">
            Oversee candidate assignments, requirements, AI reviews, and project milestones.
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setShowProjectModal(true)}
            className="inline-flex items-center px-4 py-2 border border-slate-300 rounded-xl text-sm font-semibold text-slate-700 bg-white hover:bg-slate-50 transition shadow-2xs"
          >
            <FolderPlus className="w-4 h-4 mr-2 text-slate-500" /> New Project
          </button>
          <button
            onClick={() => setShowTaskModal(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-semibold text-white transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4 mr-2" /> Assign New Task
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Total Tasks</span>
            <FileText className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-slate-900">{totalTasks}</div>
          <div className="mt-1 text-xs text-slate-500">{projects.length} Active Projects</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Submitted for Review</span>
            <Clock className="w-4 h-4 text-purple-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-purple-600">{submittedCount}</div>
          <div className="mt-1 text-xs text-slate-500">Awaiting PM signoff</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Needs Revision</span>
            <RefreshCw className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-rose-600">{revisionCount}</div>
          <div className="mt-1 text-xs text-slate-500">Below passing threshold</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-3xl font-extrabold text-emerald-600">{completedCount}</div>
          <div className="mt-1 text-xs text-slate-500">Validated by Admin</div>
        </div>
      </div>

      {/* Task Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Status filter pills */}
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full md:w-auto">
          {['ALL', 'Assigned', 'In Progress', 'Submitted', 'Needs Revision', 'Completed'].map(st => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap ${
                filterStatus === st 
                  ? 'bg-blue-600 text-white shadow-2xs' 
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks, tech, candidate..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>

      {/* Tasks Table / List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading tasks...</div>
        ) : filteredTasks.length === 0 ? (
          <div className="p-12 text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
            <p className="font-semibold text-slate-700">No tasks found</p>
            <p className="text-xs text-slate-500 mt-1">Create a new task to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-600 text-left text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-6">Task Title & Stack</th>
                  <th className="py-3.5 px-6">Assigned Candidate</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Deadlines & Review</th>
                  <th className="py-3.5 px-6">Passing Score</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm text-slate-800">
                {filteredTasks.map(task => (
                  <tr 
                    key={task.id} 
                    onClick={() => onSelectTask(task.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition"
                  >
                    <td className="py-4 px-6">
                      <div className="font-semibold text-slate-900 hover:text-blue-600 transition flex items-center">
                        {task.title}
                        <ArrowUpRight className="w-3.5 h-3.5 ml-1 text-slate-400" />
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5">
                        <span className="font-medium text-slate-600">{task.tech_stack || 'Standard Stack'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      {task.assigned_candidate ? (
                        <div>
                          <div className="font-medium text-slate-900">{task.assigned_candidate.name}</div>
                          <div className="text-xs text-slate-400">{task.assigned_candidate.email}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="py-4 px-6">
                      <StatusBadge status={task.status} />
                    </td>

                    <td className="py-4 px-6 text-xs text-slate-600 space-y-1">
                      <div className="flex items-center">
                        <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" />
                        <span>Due: {task.submission_deadline ? new Date(task.submission_deadline).toLocaleDateString() : 'None'}</span>
                      </div>
                      <div className="flex items-center text-blue-700 font-medium">
                        <Calendar className="w-3.5 h-3.5 mr-1 text-blue-500" />
                        <span>Review: {task.review_datetime ? new Date(task.review_datetime).toLocaleDateString() : 'Pending'}</span>
                      </div>
                    </td>

                    <td className="py-4 px-6">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-700">
                        {task.passing_score} / 100
                      </span>
                    </td>

                    <td className="py-4 px-6 text-right space-x-2">
                      {task.status !== 'Completed' && (
                        <button
                          onClick={(e) => handleMarkComplete(task.id, e)}
                          title="Mark task complete"
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition"
                        >
                          Complete
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectTask(task.id); }}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-600 hover:text-white transition"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE PROJECT MODAL */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Create New Project</h3>
            <form onSubmit={handleCreateProject} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Project Name</label>
                <input
                  type="text"
                  required
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  placeholder="e.g. Distributed Payment Gateway"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows="3"
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  placeholder="High-level project scope..."
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CREATE TASK MODAL */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 my-8">
            <h3 className="text-lg font-bold text-slate-900 mb-1">Create & Assign Project Task</h3>
            <p className="text-xs text-slate-500 mb-4">
              Configure task requirements, acceptance criteria, dates, candidate assignment, and reference files.
            </p>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Project</label>
                  <select
                    value={newTask.project_id}
                    onChange={(e) => {
                      const pid = parseInt(e.target.value);
                      const proj = projects.find(p => p.id === pid);
                      setNewTask({
                        ...newTask,
                        project_id: pid,
                        module_id: proj?.modules?.[0]?.id || ''
                      });
                    }}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Module</label>
                  <select
                    value={newTask.module_id}
                    onChange={(e) => setNewTask({ ...newTask, module_id: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 bg-white rounded-lg text-sm"
                  >
                    {projects.find(p => p.id === parseInt(newTask.project_id))?.modules?.map(m => (
                      <option key={m.id} value={m.id}>{m.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Task Title</label>
                <input
                  type="text"
                  required
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="e.g. Implement OAuth2 Refresh Token Flow"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Technology Stack</label>
                <input
                  type="text"
                  value={newTask.tech_stack}
                  onChange={(e) => setNewTask({ ...newTask, tech_stack: e.target.value })}
                  placeholder="e.g. Python, FastAPI, SQLite, React"
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Task Description & Requirements</label>
                <textarea
                  rows="3"
                  required
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Provide comprehensive instructions for the candidate..."
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Deliverables & Acceptance Criteria</label>
                <textarea
                  rows="3"
                  value={newTask.deliverables}
                  onChange={(e) => setNewTask({ ...newTask, deliverables: e.target.value })}
                  placeholder="List specific acceptance criteria, documentation expectations, test coverage..."
                  className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Submission Deadline</label>
                  <input
                    type="datetime-local"
                    value={newTask.submission_deadline}
                    onChange={(e) => setNewTask({ ...newTask, submission_deadline: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Review Date / Time</label>
                  <input
                    type="datetime-local"
                    value={newTask.review_datetime}
                    onChange={(e) => setNewTask({ ...newTask, review_datetime: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700">Passing Score (0-100)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newTask.passing_score}
                    onChange={(e) => setNewTask({ ...newTask, passing_score: e.target.value })}
                    className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  />
                </div>
              </div>

              {/* Candidate Assignment */}
              <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-3">
                <span className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center">
                  <User className="w-3.5 h-3.5 mr-1" /> Candidate Assignment & Email Dispatch
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Candidate Name</label>
                    <input
                      type="text"
                      value={newTask.candidate_name}
                      onChange={(e) => setNewTask({ ...newTask, candidate_name: e.target.value })}
                      placeholder="Alex Developer"
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-700">Candidate Email</label>
                    <input
                      type="email"
                      value={newTask.candidate_email}
                      onChange={(e) => setNewTask({ ...newTask, candidate_email: e.target.value })}
                      placeholder="candidate@example.com"
                      className="mt-1 w-full px-3 py-1.5 border border-slate-300 bg-white rounded-lg text-xs"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-blue-700">
                  An assignment email will be sent automatically via Gmail SMTP with task specs, deadlines, and link.
                </p>
              </div>

              {/* Reference Document Upload */}
              <div>
                <label className="block text-xs font-semibold text-slate-700">Task Reference Document (PDF, DOCX, TXT)</label>
                <input
                  type="file"
                  accept=".pdf,.docx,.doc,.txt,.md"
                  onChange={(e) => setTaskRefFile(e.target.files[0])}
                  className="mt-1 block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
                />
                <p className="text-[11px] text-slate-400 mt-1">Text will be extracted and injected into the AI Mentor context.</p>
              </div>

              <div className="flex justify-end space-x-2 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-xs"
                >
                  {submitting ? 'Creating & Dispatching...' : 'Assign & Create Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

