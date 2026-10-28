import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { X, Bell, RefreshCw, CheckCircle, AlertCircle, Clock, Mail, Send, Settings, Key, ShieldCheck } from 'lucide-react';

export default function LogsModal({ isOpen, onClose }) {
  const [logs, setLogs] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [activeTab, setActiveTab] = useState('smtp'); // 'smtp' | 'emails' | 'reminders'
  const [loading, setLoading] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [resultMsg, setResultMsg] = useState('');

  // SMTP Settings State
  const [smtpStatus, setSmtpStatus] = useState(null);
  const [smtpForm, setSmtpForm] = useState({
    smtp_user: '',
    smtp_pass: '',
    smtp_host: 'smtp.gmail.com',
    smtp_port: 587,
    email_from: '',
  });
  const [testEmail, setTestEmail] = useState('');
  const [savingSmtp, setSavingSmtp] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [emailData, remData, status] = await Promise.all([
        api.getEmailLogs(),
        api.getReminderRecords(),
        api.getSmtpStatus()
      ]);
      setLogs(emailData);
      setReminders(remData);
      setSmtpStatus(status);
      if (status.full_smtp_user) {
        setSmtpForm(prev => ({
          ...prev,
          smtp_user: status.full_smtp_user,
          email_from: status.email_from || status.full_smtp_user,
        }));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setResultMsg('');
      setTestResult(null);
    }
  }, [isOpen]);

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    try {
      setSavingSmtp(true);
      const res = await api.saveSmtpSettings(smtpForm);
      setTestResult({ type: 'success', text: res.message });
      await loadData();
    } catch (err) {
      setTestResult({ type: 'error', text: 'Failed to save SMTP: ' + err.message });
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleSendTestEmail = async () => {
    if (!testEmail) {
      alert('Please enter a recipient email to send the test email to.');
      return;
    }
    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await api.sendTestEmail(testEmail);
      if (res.success) {
        setTestResult({ type: 'success', text: `Test email successfully sent to ${testEmail}! Check your inbox.` });
      } else {
        setTestResult({ type: 'error', text: `SMTP Delivery Failed: ${res.error}` });
      }
      await loadData();
    } catch (err) {
      setTestResult({ type: 'error', text: 'Error dispatching test email: ' + err.message });
    } finally {
      setSendingTest(false);
    }
  };

  const handleTriggerCheck = async () => {
    try {
      setTriggering(true);
      const res = await api.triggerReminderCheck();
      setResultMsg(`Scheduler scan complete. Dispatched ${res.processed_reminders} pending reminders.`);
      await loadData();
    } catch (err) {
      setResultMsg('Trigger failed: ' + err.message);
    } finally {
      setTriggering(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-4xl w-full h-[680px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center space-x-2">
            <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Email SMTP Configuration & Audit Logs</h3>
              <p className="text-xs text-slate-500">Configure Gmail SMTP, test live email delivery, and view dispatch history.</p>
            </div>
          </div>
          
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status notice */}
        {resultMsg && (
          <div className="px-6 py-2.5 bg-blue-50 border-b border-blue-100 text-xs font-medium text-blue-800">
            {resultMsg}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-slate-200 px-6 bg-white space-x-4">
          <button
            onClick={() => setActiveTab('smtp')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center ${
              activeTab === 'smtp' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Settings className="w-3.5 h-3.5 mr-1.5" /> Gmail SMTP Configuration
          </button>
          <button
            onClick={() => setActiveTab('emails')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center ${
              activeTab === 'emails' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Mail className="w-3.5 h-3.5 mr-1.5" /> Delivery Audit Logs ({logs.length})
          </button>
          <button
            onClick={() => setActiveTab('reminders')}
            className={`py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition flex items-center ${
              activeTab === 'reminders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500'
            }`}
          >
            <Clock className="w-3.5 h-3.5 mr-1.5" /> Reminder Records ({reminders.length})
          </button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-6">
          
          {/* TAB 1: SMTP CONFIGURATION & LIVE TEST */}
          {activeTab === 'smtp' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              
              {/* Status Banner */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                smtpStatus?.is_configured 
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
                  : 'bg-amber-50 border-amber-200 text-amber-800'
              }`}>
                <div className="flex items-center space-x-2">
                  {smtpStatus?.is_configured ? (
                    <CheckCircle className="w-5 h-5 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600" />
                  )}
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wider">
                      SMTP Status: {smtpStatus?.is_configured ? 'Active & Configured' : 'Not Configured'}
                    </div>
                    <div className="text-xs mt-0.5">
                      {smtpStatus?.is_configured
                        ? `Sending via ${smtpStatus?.smtp_user} (Host: ${smtpStatus?.smtp_host}:${smtpStatus?.smtp_port})`
                        : 'Emails are currently simulated. Enter your Gmail and App Password below to enable actual delivery.'}
                    </div>
                  </div>
                </div>
              </div>

              {testResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-medium ${
                  testResult.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}>
                  {testResult.text}
                </div>
              )}

              {/* Form to update SMTP */}
              <form onSubmit={handleSaveSmtp} className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h4 className="text-sm font-bold text-slate-900 flex items-center">
                  <Key className="w-4 h-4 mr-1.5 text-blue-600" /> Gmail SMTP Credentials
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Gmail Address</label>
                    <input
                      type="email"
                      required
                      placeholder="yourname@gmail.com"
                      value={smtpForm.smtp_user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_user: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Gmail App Password</label>
                    <input
                      type="password"
                      required
                      placeholder="16-character App Password"
                      value={smtpForm.smtp_pass}
                      onChange={(e) => setSmtpForm({ ...smtpForm, smtp_pass: e.target.value })}
                      className="mt-1 w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      Generate at: <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" className="text-blue-600 underline">Google Account App Passwords</a>
                    </p>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingSmtp}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition disabled:opacity-50"
                  >
                    {savingSmtp ? 'Saving...' : 'Save & Update SMTP Credentials'}
                  </button>
                </div>
              </form>

              {/* Live Test Email Tool */}
              <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-sm font-bold text-slate-900 flex items-center">
                  <Send className="w-4 h-4 mr-1.5 text-purple-600" /> Send Live Test Email
                </h4>
                <p className="text-xs text-slate-500">
                  Verify that Gmail SMTP accepts your credentials and successfully forwards emails to your destination inbox.
                </p>

                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    placeholder="Enter recipient email (e.g. your personal email)"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    disabled={sendingTest || !testEmail}
                    onClick={handleSendTestEmail}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-bold transition disabled:opacity-50 flex items-center"
                  >
                    {sendingTest ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1 animate-spin" /> Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5 mr-1" /> Send Test Email
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* TAB 2: DELIVERY LOGS */}
          {activeTab === 'emails' && (
            loading ? (
              <div className="text-center py-12 text-slate-400 text-sm">Loading logs...</div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-xs">No email logs found.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                    <tr>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Recipient</th>
                      <th className="py-2.5 px-3">Subject</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Sent / Attempted At</th>
                      <th className="py-2.5 px-3">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {logs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-semibold uppercase text-[10px] text-slate-700">
                          {log.email_type}
                        </td>
                        <td className="py-3 px-3 font-medium text-slate-900">{log.recipient_email}</td>
                        <td className="py-3 px-3 text-slate-600 max-w-xs truncate">{log.subject}</td>
                        <td className="py-3 px-3 whitespace-nowrap">
                          {log.status === 'SENT' ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <CheckCircle className="w-3 h-3 mr-1" /> SENT
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800">
                              <AlertCircle className="w-3 h-3 mr-1" /> FAILED
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {new Date(log.sent_at).toLocaleString()}
                        </td>
                        <td className="py-3 px-3 text-slate-500 max-w-xs truncate">
                          {log.error_message || 'Delivered'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          )}

          {/* TAB 3: REMINDER RECORDS */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <p className="text-xs text-slate-500">Automated deadline and review reminders scheduled in the database.</p>
                <button
                  onClick={handleTriggerCheck}
                  disabled={triggering}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold flex items-center transition disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${triggering ? 'animate-spin' : ''}`} />
                  Run Scheduler Scan Now
                </button>
              </div>

              {reminders.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">No scheduled reminder records found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-200 text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold text-left">
                      <tr>
                        <th className="py-2.5 px-3">Task Title</th>
                        <th className="py-2.5 px-3">Reminder Type</th>
                        <th className="py-2.5 px-3">Scheduled For</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Sent At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {reminders.map(rem => (
                        <tr key={rem.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-3 font-semibold text-slate-900">{rem.task_title}</td>
                          <td className="py-3 px-3 font-medium text-slate-600 uppercase text-[10px]">{rem.reminder_type}</td>
                          <td className="py-3 px-3 text-slate-600">{new Date(rem.scheduled_for).toLocaleString()}</td>
                          <td className="py-3 px-3 whitespace-nowrap">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              rem.status === 'SENT' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {rem.status}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">
                            {rem.sent_at ? new Date(rem.sent_at).toLocaleString() : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded-lg text-xs font-semibold transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
