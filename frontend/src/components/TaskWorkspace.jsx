import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import StatusBadge from './StatusBadge';
import { 
  ArrowLeft, Send, Sparkles, FileText, CheckCircle2, XCircle, 
  AlertTriangle, HelpCircle, UploadCloud, Clock, Calendar, 
  Award, RefreshCw, Paperclip, ChevronRight, User, ShieldCheck
} from 'lucide-react';

export default function TaskWorkspace({ taskId, onBack }) {
  const { user } = useAuth();
  const [task, setTask] = useState(null);
  const [activeTab, setActiveTab] = useState('mentor'); // 'specs', 'mentor', 'reviews'
  const [loading, setLoading] = useState(true);

  // Mentor Chat state
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [sendingChat, setSendingChat] = useState(false);
  const chatEndRef = useRef(null);

  // Upload & Review state
  const [selectedFile, setSelectedFile] = useState(null);
  const [submittingDoc, setSubmittingDoc] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [selectedReview, setSelectedReview] = useState(null);
  const [notificationMsg, setNotificationMsg] = useState(null);

  // Admin controls
  const [isEditingScore, setIsEditingScore] = useState(false);
  const [newScore, setNewScore] = useState(70);

  // Load task and data
  const loadTaskData = async () => {
    try {
      setLoading(true);
      const [taskData, revData] = await Promise.all([
        api.getTask(taskId),
        api.getTaskReviews(taskId)
      ]);
      setTask(taskData);
      setNewScore(taskData.passing_score);
      setReviews(revData);
      if (revData.length > 0) {
        setSelectedReview(revData[0]);
      }
    } catch (err) {
      alert('Error loading task: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Load mentor messages
  const loadMentorMessages = async () => {
    try {
      const msgs = await api.getMentorMessages(taskId);
      setMessages(msgs);
    } catch (err) {
      console.error('Error fetching mentor messages', err);
    }
  };

  useEffect(() => {
    loadTaskData();
    loadMentorMessages();
  }, [taskId]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message to AI mentor
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || sendingChat) return;

    const userText = chatInput.trim();
    setChatInput('');
    // Optimistic user message
    const tempUserMsg = {
      id: Date.now(),
      sender_type: 'candidate',
      content: userText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);
    setSendingChat(true);

    try {
      const reply = await api.sendMentorMessage(taskId, userText);
      setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, reply]);
    } catch (err) {
      alert('Failed to get response from AI Mentor: ' + err.message);
    } finally {
      setSendingChat(false);
    }
  };

  // Submit documentation for review
  const handleSubmitDocument = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    try {
      setSubmittingDoc(true);
      setNotificationMsg(null);
      const result = await api.submitDocument(taskId, selectedFile);
      setSelectedFile(null);
      
      // Refresh task status & reviews
      const [updatedTask, updatedReviews] = await Promise.all([
        api.getTask(taskId),
        api.getTaskReviews(taskId)
      ]);
      setTask(updatedTask);
      setReviews(updatedReviews);
      setSelectedReview(result.review_report);

      if (result.email_notification?.status === 'SENT') {
        setNotificationMsg({ type: 'success', text: 'AI review report generated & email confirmation dispatched to candidate!' });
      } else {
        setNotificationMsg({ type: 'info', text: 'AI review generated. (Email dispatch note: ' + (result.email_notification?.error || 'Simulated') + ')' });
      }
    } catch (err) {
      alert('Evaluation failed: ' + err.message);
    } finally {
      setSubmittingDoc(false);
    }
  };

  // Status updates
  const handleStatusChange = async (newStatus) => {
    try {
      const updated = await api.updateTask(taskId, { status: newStatus });
      setTask(updated);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdatePassingScore = async () => {
    try {
      const updated = await api.updateTask(taskId, { passing_score: parseInt(newScore) });
      setTask(updated);
      setIsEditingScore(false);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading || !task) {
    return (
      <div className="bg-white p-12 rounded-2xl border border-slate-200 text-center text-slate-500">
        Loading task workspace...
      </div>
    );
  }

  const isCandidate = user?.role === 'candidate';
  const isAdmin = user?.role === 'admin';

  return (
    <div className="space-y-6">
      
      {/* Top Header Card */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
        <button
          onClick={onBack}
          className="inline-flex items-center text-xs font-semibold text-slate-500 hover:text-slate-900 transition mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Dashboard
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2 mb-2">
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-200">
                {task.module?.project?.name || 'Project'} &bull; {task.module?.name || 'Module'}
              </span>
              <StatusBadge status={task.status} />
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900">{task.title}</h2>
            <p className="text-xs text-slate-500 mt-1">
              Stack: <strong className="text-slate-700">{task.tech_stack || 'Not specified'}</strong>
            </p>
          </div>

          {/* Quick status & passing score controls */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Candidate: Mark In Progress */}
            {isCandidate && task.status === 'Assigned' && (
              <button
                onClick={() => handleStatusChange('In Progress')}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Start Working (Mark In Progress)
              </button>
            )}

            {/* Admin: Mark Completed */}
            {isAdmin && task.status !== 'Completed' && (
              <button
                onClick={() => handleStatusChange('Completed')}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs"
              >
                Mark Completed
              </button>
            )}

            {/* Passing Score Display / Edit */}
            <div className="bg-slate-50 px-3.5 py-1.5 rounded-xl border border-slate-200 flex items-center space-x-2 text-xs">
              <span className="text-slate-500 font-medium">Passing Threshold:</span>
              {isAdmin && isEditingScore ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newScore}
                    onChange={(e) => setNewScore(e.target.value)}
                    className="w-16 px-1.5 py-0.5 border border-slate-300 rounded text-xs text-center"
                  />
                  <button
                    onClick={handleUpdatePassingScore}
                    className="px-2 py-0.5 bg-blue-600 text-white rounded text-[11px] font-bold"
                  >
                    Save
                  </button>
                </div>
              ) : (
                <span 
                  onClick={() => isAdmin && setIsEditingScore(true)}
                  className={`font-bold text-slate-900 ${isAdmin ? 'cursor-pointer underline decoration-dotted text-blue-600' : ''}`}
                  title={isAdmin ? 'Click to adjust passing score' : ''}
                >
                  {task.passing_score}% {isAdmin && '(Edit)'}
                </span>
              )}
            </div>

          </div>
        </div>

        {/* Schedule Strip */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center text-slate-600">
            <Clock className="w-4 h-4 mr-2 text-slate-400" />
            <span>Submission Deadline: <strong>{task.submission_deadline ? new Date(task.submission_deadline).toLocaleString() : 'Not Set'}</strong></span>
          </div>
          <div className="flex items-center text-blue-700">
            <Calendar className="w-4 h-4 mr-2 text-blue-500" />
            <span>Scheduled Review Meeting: <strong>{task.review_datetime ? new Date(task.review_datetime).toLocaleString() : 'Not Scheduled'}</strong></span>
          </div>
          <div className="flex items-center text-slate-600">
            <User className="w-4 h-4 mr-2 text-slate-400" />
            <span>Assigned Candidate: <strong>{task.assigned_candidate?.name || 'Unassigned'}</strong></span>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex border-b border-slate-200 space-x-2">
        <button
          onClick={() => setActiveTab('mentor')}
          className={`flex items-center py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
            activeTab === 'mentor'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 mr-2 text-blue-500" /> AI Project Mentor
        </button>

        <button
          onClick={() => setActiveTab('reviews')}
          className={`flex items-center py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
            activeTab === 'reviews'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Award className="w-4 h-4 mr-2 text-purple-500" /> Submit & AI Review Reports ({reviews.length})
        </button>

        <button
          onClick={() => setActiveTab('specs')}
          className={`flex items-center py-3 px-4 font-bold text-xs uppercase tracking-wider border-b-2 transition ${
            activeTab === 'specs'
              ? 'border-blue-600 text-blue-600 bg-white rounded-t-xl'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4 mr-2 text-slate-500" /> Specifications & Reference Docs ({task.reference_docs?.length || 0})
        </button>
      </div>

      {/* TAB CONTENT 1: AI PROJECT MENTOR */}
      {activeTab === 'mentor' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden flex flex-col h-[650px]">
          
          {/* Chat Header */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">AI Senior Engineering Mentor</h4>
                <p className="text-[11px] text-slate-500">Autonomous guidance covering implementation plans, database architecture, testing, and checklists.</p>
              </div>
            </div>
            <button
              onClick={loadMentorMessages}
              title="Refresh conversation"
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/40">
            {messages.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <Sparkles className="w-8 h-8 mx-auto text-blue-400 mb-2 animate-pulse" />
                <p className="text-sm font-semibold text-slate-700">Connecting with AI Mentor...</p>
                <p className="text-xs text-slate-500 mt-1">Generating full kickoff guidance from task specifications.</p>
              </div>
            ) : (
              messages.map((m, idx) => {
                const isMentor = m.sender_type === 'mentor';
                return (
                  <div key={m.id || idx} className={`flex ${isMentor ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-3xl rounded-2xl p-4 sm:p-5 shadow-2xs ${
                      isMentor
                        ? 'bg-white border border-slate-200 text-slate-800'
                        : 'bg-blue-600 text-white font-medium'
                    }`}>
                      <div className="flex items-center justify-between mb-1.5 text-xs">
                        <span className={`font-bold ${isMentor ? 'text-blue-700' : 'text-blue-100'}`}>
                          {isMentor ? 'AI Mentor' : user?.name || 'You'}
                        </span>
                        <span className={`text-[10px] ${isMentor ? 'text-slate-400' : 'text-blue-200'}`}>
                          {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <div className="text-sm leading-relaxed whitespace-pre-wrap font-sans">
                        {m.content}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            {sendingChat && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 flex items-center space-x-2 shadow-2xs">
                  <Sparkles className="w-4 h-4 text-blue-600 animate-spin" />
                  <span>AI Mentor is thinking and composing advice...</span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Chat Input */}
          <form onSubmit={handleSendMessage} className="p-4 bg-white border-t border-slate-200 flex items-center space-x-2">
            <input
              type="text"
              value={chatInput}
              disabled={sendingChat}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="Ask the AI Mentor anything (e.g. database schema, testing strategy, error resolution)..."
              className="flex-1 px-4 py-2.5 border border-slate-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="submit"
              disabled={sendingChat || !chatInput.trim()}
              className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition flex items-center shadow-xs"
            >
              <Send className="w-4 h-4 mr-1.5" /> Send
            </button>
          </form>

        </div>
      )}

      {/* TAB CONTENT 2: SUBMIT & AI REVIEW REPORTS */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          
          {/* Notification banner */}
          {notificationMsg && (
            <div className={`p-4 rounded-xl border text-xs font-semibold ${
              notificationMsg.type === 'success' 
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              {notificationMsg.text}
            </div>
          )}

          {/* Document Upload Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
            <h3 className="text-base font-bold text-slate-900 mb-1">
              Upload Completed Project Documentation
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              Submit your project report, architectural specs, and test proof (.pdf, .docx, or .txt). 
              The AI Reviewer will evaluate your submission against each requirement, generate a structured score card, and email notifications.
            </p>

            <form onSubmit={handleSubmitDocument} className="flex flex-col sm:flex-row items-center gap-3">
              <input
                type="file"
                required
                accept=".pdf,.docx,.doc,.txt,.md"
                onChange={(e) => setSelectedFile(e.target.files[0])}
                className="block w-full text-xs text-slate-500 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-slate-200 rounded-xl p-1"
              />
              <button
                type="submit"
                disabled={submittingDoc || !selectedFile}
                className="w-full sm:w-auto whitespace-nowrap px-6 py-2.5 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition shadow-xs flex items-center justify-center"
              >
                {submittingDoc ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Evaluating with AI...
                  </>
                ) : (
                  <>
                    <UploadCloud className="w-4 h-4 mr-2" /> Upload & Generate Review
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Submissions & Reviews History */}
          {reviews.length > 0 && (
            <div className="flex items-center space-x-2 overflow-x-auto pb-1">
              <span className="text-xs font-semibold text-slate-500 mr-1">Review History:</span>
              {reviews.map((rev, idx) => {
                const isSelected = selectedReview?.id === rev.id;
                const isPass = rev.overall_score >= task.passing_score;
                return (
                  <button
                    key={rev.id}
                    onClick={() => setSelectedReview(rev)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-slate-900 text-white shadow-2xs'
                        : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>Version {reviews.length - idx}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                      isPass ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {rev.overall_score}%
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Structured Review Report Display */}
          {selectedReview ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
              
              {/* Score & Verdict Banner */}
              <div className="p-6 bg-slate-50 border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      AI Review Report &bull; {new Date(selectedReview.created_at).toLocaleString()}
                    </span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mt-1">
                    Evaluation Result: {selectedReview.overall_score >= task.passing_score ? (
                      <span className="text-emerald-600">Passed Threshold</span>
                    ) : (
                      <span className="text-rose-600">Revision Required</span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-600 mt-1 max-w-xl">
                    Passing threshold is {task.passing_score}/100. Admin reserves final completion approval.
                  </p>
                </div>

                {/* Score badge */}
                <div className="flex items-center space-x-4">
                  <div className="text-right">
                    <div className="text-xs font-semibold text-slate-500 uppercase">Overall Score</div>
                    <div className="text-xs text-slate-400">Passing: {task.passing_score}</div>
                  </div>
                  <div className={`w-20 h-20 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-md ${
                    selectedReview.overall_score >= task.passing_score ? 'bg-emerald-600' : 'bg-rose-600'
                  }`}>
                    {selectedReview.overall_score}
                  </div>
                </div>
              </div>

              {/* Requirement-by-Requirement Table */}
              <div className="p-6 border-b border-slate-200">
                <h4 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
                  Requirement-by-Requirement Verification
                </h4>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 text-left font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Requirement</th>
                        <th className="py-2.5 px-4">Verification Status</th>
                        <th className="py-2.5 px-4">Evidence Identified in Documentation</th>
                        <th className="py-2.5 px-4">Evaluator Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedReview.requirement_statuses?.map((req, rIdx) => {
                        let statusColor = 'bg-gray-100 text-gray-700';
                        let Icon = HelpCircle;
                        if (req.status === 'Met') {
                          statusColor = 'bg-emerald-100 text-emerald-800 border border-emerald-200';
                          Icon = CheckCircle2;
                        } else if (req.status === 'Partially Met') {
                          statusColor = 'bg-amber-100 text-amber-800 border border-amber-200';
                          Icon = AlertTriangle;
                        } else if (req.status === 'Not Met') {
                          statusColor = 'bg-rose-100 text-rose-800 border border-rose-200';
                          Icon = XCircle;
                        } else if (req.status === 'Unable to Verify') {
                          statusColor = 'bg-blue-50 text-blue-800 border border-blue-200';
                          Icon = HelpCircle;
                        }

                        return (
                          <tr key={rIdx} className="hover:bg-slate-50/50">
                            <td className="py-3 px-4 font-semibold text-slate-800">{req.requirement}</td>
                            <td className="py-3 px-4 whitespace-nowrap">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full font-bold ${statusColor}`}>
                                <Icon className="w-3 h-3 mr-1" /> {req.status}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-slate-600 max-w-xs">{req.evidence || 'N/A'}</td>
                            <td className="py-3 px-4 text-slate-500 max-w-xs">{req.notes || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Strengths, Weaknesses, Improvements */}
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Strengths */}
                <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-100">
                  <h5 className="text-xs font-bold text-emerald-900 uppercase tracking-wider mb-2 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-1.5 text-emerald-600" /> Key Strengths
                  </h5>
                  <ul className="space-y-1.5 text-xs text-emerald-900 list-disc list-inside">
                    {selectedReview.strengths?.length > 0 ? (
                      selectedReview.strengths.map((str, i) => <li key={i}>{str}</li>)
                    ) : (
                      <li className="text-slate-400">No specific strengths recorded.</li>
                    )}
                  </ul>
                </div>

                {/* Weaknesses */}
                <div className="bg-rose-50/60 p-4 rounded-xl border border-rose-100">
                  <h5 className="text-xs font-bold text-rose-900 uppercase tracking-wider mb-2 flex items-center">
                    <XCircle className="w-4 h-4 mr-1.5 text-rose-600" /> Key Gaps & Missing Items
                  </h5>
                  <ul className="space-y-1.5 text-xs text-rose-900 list-disc list-inside">
                    {selectedReview.weaknesses?.length > 0 ? (
                      selectedReview.weaknesses.map((w, i) => <li key={i}>{w}</li>)
                    ) : (
                      <li className="text-slate-400">None identified.</li>
                    )}
                  </ul>
                </div>

                {/* Specific Improvement Suggestions */}
                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                  <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-2 flex items-center">
                    <Sparkles className="w-4 h-4 mr-1.5 text-blue-600" /> Actionable Improvement Suggestions
                  </h5>
                  <ul className="space-y-1.5 text-xs text-blue-900 list-disc list-inside">
                    {selectedReview.improvement_suggestions?.length > 0 ? (
                      selectedReview.improvement_suggestions.map((sug, i) => <li key={i}>{sug}</li>)
                    ) : (
                      <li className="text-slate-400">Standard implementation.</li>
                    )}
                  </ul>
                </div>

                {/* Recommended Next Steps */}
                <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-100">
                  <h5 className="text-xs font-bold text-purple-900 uppercase tracking-wider mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-1.5 text-purple-600" /> Recommended Next Steps Before Review
                  </h5>
                  <ul className="space-y-1.5 text-xs text-purple-900 list-disc list-inside">
                    {selectedReview.recommended_next_steps?.length > 0 ? (
                      selectedReview.recommended_next_steps.map((stp, i) => <li key={i}>{stp}</li>)
                    ) : (
                      <li className="text-slate-400">Prepare for meeting.</li>
                    )}
                  </ul>
                </div>

              </div>

            </div>
          ) : (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
              <Award className="w-10 h-10 mx-auto text-slate-300 mb-2" />
              <p className="font-bold text-slate-700 text-sm">No documentation submitted yet</p>
              <p className="text-xs text-slate-500 mt-1">
                Upload a project documentation file above to generate an instant AI verification report.
              </p>
            </div>
          )}

        </div>
      )}

      {/* TAB CONTENT 3: SPECIFICATIONS & REFERENCE DOCS */}
      {activeTab === 'specs' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Left Column: Requirements & Deliverables */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs space-y-4">
              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Task Description</h4>
                <div className="mt-2 text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-slate-50 p-4 rounded-xl border border-slate-100">
                  {task.description}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Required Deliverables & Acceptance Criteria</h4>
                <div className="mt-2 text-sm text-slate-800 leading-relaxed whitespace-pre-line bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                  {task.deliverables || 'Check specifications above.'}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Reference Documents */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-2xs">
              <h4 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
                <Paperclip className="w-4 h-4 mr-1.5 text-slate-500" /> Reference Documents
              </h4>

              {task.reference_docs?.length > 0 ? (
                <div className="space-y-2">
                  {task.reference_docs.map(doc => (
                    <div key={doc.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-blue-500" />
                        <span className="font-semibold text-slate-800 truncate max-w-[180px]">{doc.filename}</span>
                      </div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 bg-slate-200 px-1.5 py-0.5 rounded">
                        {doc.file_type}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No reference documents attached.</p>
              )}

              {/* Admin reference doc uploader */}
              {isAdmin && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Add Reference Doc</label>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md"
                    onChange={async (e) => {
                      if (e.target.files[0]) {
                        await api.uploadReferenceDoc(task.id, e.target.files[0]);
                        loadTaskData();
                      }
                    }}
                    className="text-xs text-slate-500 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-100"
                  />
                </div>
              )}

            </div>
          </div>

        </div>
      )}

    </div>
  );
}

