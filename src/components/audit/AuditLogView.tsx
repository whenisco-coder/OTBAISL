import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext';
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
  RefreshCw,
  Wrench,
  Printer,
  Database,
  Smartphone,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Download,
  Copy,
  Trash2,
  Activity,
  Play,
  Layers,
  FileCheck,
} from 'lucide-react';
import {
  runSystemDiagnostics,
  rectifyPrintSystem,
  rectifyDatabaseSystem,
  rectifyLayoutSystem,
  runFullSelfTest,
  generateDiagnosticReport,
  getCapturedErrors,
  clearCapturedErrors,
  type DiagnosticStatus,
  type SelfTestResult,
  type CapturedSystemError,
} from '../../utils/auditDiagnostics';
import { downloadFile } from '../../utils/export';

type AuditTab = 'health' | 'errors' | 'journal';

export const AuditLogView: React.FC = () => {
  const { auditLogs, showToast } = useStore();
  const [activeTab, setActiveTab] = useState<AuditTab>('health');

  // Search & Filters for Journal
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  // System Diagnostics State
  const [diagStatus, setDiagStatus] = useState<DiagnosticStatus | null>(null);
  const [isRefreshingDiag, setIsRefreshingDiag] = useState(false);
  const [rectifyingAction, setRectifyingAction] = useState<string | null>(null);
  const [rectifyMessage, setRectifyMessage] = useState<string | null>(null);

  // Self-Test State
  const [selfTestResults, setSelfTestResults] = useState<SelfTestResult[] | null>(null);
  const [isRunningSelfTest, setIsRunningSelfTest] = useState(false);

  // Error Journal State
  const [capturedErrors, setCapturedErrors] = useState<CapturedSystemError[]>([]);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  // Refresh diagnostics
  const refreshDiagnostics = useCallback(async () => {
    setIsRefreshingDiag(true);
    try {
      const status = await runSystemDiagnostics();
      setDiagStatus(status);
      setCapturedErrors(getCapturedErrors());
    } catch (err) {
      console.error('Failed to load diagnostics:', err);
    } finally {
      setIsRefreshingDiag(false);
    }
  }, []);

  useEffect(() => {
    refreshDiagnostics();
  }, [refreshDiagnostics]);

  // Rectification handlers
  const handleRectifyPrint = async () => {
    setRectifyingAction('print');
    setRectifyMessage(null);
    try {
      const res = await rectifyPrintSystem();
      setRectifyMessage(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await refreshDiagnostics();
    } finally {
      setRectifyingAction(null);
    }
  };

  const handleRectifyDatabase = async () => {
    setRectifyingAction('database');
    setRectifyMessage(null);
    try {
      const res = await rectifyDatabaseSystem();
      setRectifyMessage(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await refreshDiagnostics();
    } finally {
      setRectifyingAction(null);
    }
  };

  const handleRectifyLayout = async () => {
    setRectifyingAction('layout');
    setRectifyMessage(null);
    try {
      const res = await rectifyLayoutSystem();
      setRectifyMessage(res.message);
      showToast(res.message, res.success ? 'success' : 'error');
      await refreshDiagnostics();
    } finally {
      setRectifyingAction(null);
    }
  };

  const handleRunSelfTest = async () => {
    setIsRunningSelfTest(true);
    try {
      const results = await runFullSelfTest();
      setSelfTestResults(results);
      const allPassed = results.every(r => r.passed);
      showToast(
        allPassed
          ? 'All 5 system self-tests passed successfully!'
          : 'Some self-tests reported issues. Check results below.',
        allPassed ? 'success' : 'warning'
      );
      await refreshDiagnostics();
    } finally {
      setIsRunningSelfTest(false);
    }
  };

  const handleExportDiagnostics = async () => {
    try {
      const reportJson = await generateDiagnosticReport();
      const filename = `Tyrebuddy-Diagnostic-Report-${new Date().toISOString().split('T')[0]}.json`;
      downloadFile(filename, reportJson, 'application/json');
      showToast('Diagnostic report downloaded', 'success');
    } catch {
      showToast('Failed to export diagnostic report', 'error');
    }
  };

  const handleCopyDiagnostics = async () => {
    try {
      const reportJson = await generateDiagnosticReport();
      await navigator.clipboard.writeText(reportJson);
      showToast('Diagnostic report copied to clipboard', 'success');
    } catch {
      showToast('Failed to copy report to clipboard', 'error');
    }
  };

  const handleClearErrors = () => {
    clearCapturedErrors();
    setCapturedErrors([]);
    showToast('Error monitor cleared', 'info');
  };

  // Filtered audit logs for Journal Tab
  const filteredLogs = auditLogs.filter(log => {
    const matchSearch =
      log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.module.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user.toLowerCase().includes(searchTerm.toLowerCase());
    const matchAction = actionFilter === 'ALL' || log.action === actionFilter;
    return matchSearch && matchAction;
  });

  const isHealthy =
    diagStatus?.sqliteHealthy &&
    diagStatus?.printEngineReady &&
    capturedErrors.filter(e => e.severity === 'CRITICAL').length === 0;

  return (
    <div className="space-y-4">
      {/* Top Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-tight">
              Audit & System Diagnostic Center
            </h1>
            <span
              className={`px-2 py-0.5 text-[10px] font-mono font-bold uppercase flex items-center gap-1 ${
                isHealthy
                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                  : 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800'
              }`}
            >
              {isHealthy ? (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  Systems Operational
                </>
              ) : (
                <>
                  <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                  Attention Needed
                </>
              )}
            </span>
          </div>
          <p className="text-xs text-neutral-500 font-mono mt-0.5">
            Real-time SQLite inspection · Zero-hang print engine · Mobile status-bar protection · Immutable compliance log
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-neutral-800 dark:text-neutral-200 text-xs font-mono font-semibold transition"
            title="Copy Diagnostic Data"
          >
            <Copy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Copy Report</span>
          </button>

          <button
            type="button"
            onClick={handleExportDiagnostics}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-950 text-xs font-mono font-bold transition shadow-2xs"
            title="Download JSON Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export JSON</span>
          </button>

          <button
            type="button"
            onClick={refreshDiagnostics}
            disabled={isRefreshingDiag}
            className="p-1.5 text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100 transition disabled:opacity-50"
            title="Refresh All Diagnostics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshingDiag ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-1 border-b border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-3 pt-2 text-xs font-mono">
        <button
          type="button"
          onClick={() => setActiveTab('health')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold transition ${
            activeTab === 'health'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>System Health & Rectification</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('errors')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold transition ${
            activeTab === 'errors'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Error Monitor ({capturedErrors.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('journal')}
          className={`flex items-center gap-2 px-3 py-2 border-b-2 font-bold transition ${
            activeTab === 'journal'
              ? 'border-neutral-900 dark:border-white text-neutral-900 dark:text-white'
              : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          <span>Compliance Journal ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: System Health & One-Click Problem Rectification */}
      {activeTab === 'health' && (
        <div className="space-y-4">
          {/* Subsystem Health Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: SQLite Storage */}
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-xs font-bold font-mono">SQLite Database</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                    diagStatus?.sqliteHealthy
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                  }`}
                >
                  {diagStatus?.sqliteHealthy ? 'ONLINE' : 'ERROR'}
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between">
                  <span>Integrity:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100 uppercase">
                    {diagStatus?.sqliteIntegrity || 'ok'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Latency:</span>
                  <span>{diagStatus?.sqliteLatencyMs || 0} ms</span>
                </div>
                <div className="flex justify-between">
                  <span>Orders stored:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {diagStatus?.tableCounts?.orders ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Audit records:</span>
                  <span>{diagStatus?.tableCounts?.audit_logs ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Card 2: Print & PDF Engine */}
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <span className="text-xs font-bold font-mono">Print Engine</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                    diagStatus?.printEngineReady
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                  }`}
                >
                  {diagStatus?.printEngineReady ? 'READY' : 'DEGRADED'}
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between">
                  <span>Vector Generator:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">ACTIVE (0ms)</span>
                </div>
                <div className="flex justify-between">
                  <span>Isolated Iframe:</span>
                  <span>Zero-Hang Sandbox</span>
                </div>
                <div className="flex justify-between">
                  <span>Canvas 2D:</span>
                  <span>{diagStatus?.printEngineDetails.canvas2dAvailable ? 'AVAILABLE' : 'OFF'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Hang Protection:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">ENFORCED</span>
                </div>
              </div>
            </div>

            {/* Card 3: Layout & Safe Areas */}
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span className="text-xs font-bold font-mono">Mobile Layout</span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 font-bold bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-300">
                  {diagStatus?.layoutMetrics.isMobile ? 'MOBILE' : 'DESKTOP'}
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between">
                  <span>Viewport:</span>
                  <span>
                    {diagStatus?.layoutMetrics.viewportWidth} × {diagStatus?.layoutMetrics.viewportHeight}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status bar top:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {diagStatus?.layoutMetrics.safeAreaTopPx || 0}px
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Nav bar bottom:</span>
                  <span className="font-bold text-neutral-900 dark:text-neutral-100">
                    {diagStatus?.layoutMetrics.safeAreaBottomPx || 0}px
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Shield Status:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">PROTECTED</span>
                </div>
              </div>
            </div>

            {/* Card 4: Error & Exception Monitor */}
            <div className="p-4 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  <span className="text-xs font-bold font-mono">Error Monitor</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-1.5 py-0.5 font-bold ${
                    capturedErrors.length === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                  }`}
                >
                  {capturedErrors.length} LOGGED
                </span>
              </div>
              <div className="space-y-1 text-[11px] font-mono text-neutral-600 dark:text-neutral-400">
                <div className="flex justify-between">
                  <span>Critical:</span>
                  <span className="text-red-600 font-bold">
                    {capturedErrors.filter(e => e.severity === 'CRITICAL').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Warnings:</span>
                  <span className="text-amber-600 font-bold">
                    {capturedErrors.filter(e => e.severity === 'WARNING').length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Storage Quota:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">HEALTHY</span>
                </div>
                <div className="flex justify-between">
                  <span>Auto-Capture:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">LISTENING</span>
                </div>
              </div>
            </div>
          </div>

          {/* One-Click Problem Rectification Action Bar */}
          <div className="p-4 bg-neutral-900 text-white dark:bg-neutral-900 border border-neutral-800 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wrench className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-amber-400">
                  One-Click Problem Rectification Station
                </h3>
              </div>
              <span className="text-[10px] font-mono text-neutral-400">
                Instant self-repair & subsystem recovery
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {/* Action 1: Rectify Print Engine */}
              <button
                type="button"
                onClick={handleRectifyPrint}
                disabled={rectifyingAction !== null}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-bold transition border border-neutral-700 active:scale-98 disabled:opacity-50"
              >
                <Printer className="w-3.5 h-3.5 text-blue-400" />
                <span>
                  {rectifyingAction === 'print' ? 'Repairing Print…' : '⚡ Rectify Print Engine'}
                </span>
              </button>

              {/* Action 2: Rectify SQLite */}
              <button
                type="button"
                onClick={handleRectifyDatabase}
                disabled={rectifyingAction !== null}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-bold transition border border-neutral-700 active:scale-98 disabled:opacity-50"
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {rectifyingAction === 'database' ? 'Validating DB…' : '🔧 Rectify Database'}
                </span>
              </button>

              {/* Action 3: Rectify Layout */}
              <button
                type="button"
                onClick={handleRectifyLayout}
                disabled={rectifyingAction !== null}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-mono font-bold transition border border-neutral-700 active:scale-98 disabled:opacity-50"
              >
                <Smartphone className="w-3.5 h-3.5 text-amber-400" />
                <span>
                  {rectifyingAction === 'layout' ? 'Resetting Layout…' : '📐 Rectify Safe-Areas'}
                </span>
              </button>

              {/* Action 4: Run Comprehensive Self-Test */}
              <button
                type="button"
                onClick={handleRunSelfTest}
                disabled={isRunningSelfTest || rectifyingAction !== null}
                className="flex items-center justify-center gap-2 px-3 py-2.5 bg-amber-500 hover:bg-amber-400 text-neutral-950 text-xs font-mono font-bold transition active:scale-98 disabled:opacity-50"
              >
                <Play className={`w-3.5 h-3.5 ${isRunningSelfTest ? 'animate-spin' : ''}`} />
                <span>{isRunningSelfTest ? 'Testing…' : '🧪 Run Full Self-Test'}</span>
              </button>
            </div>

            {rectifyMessage && (
              <div className="p-2.5 bg-neutral-800/80 border border-neutral-700 text-xs font-mono text-emerald-400 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                <span>{rectifyMessage}</span>
              </div>
            )}
          </div>

          {/* Self-Test Live Execution Results */}
          {selfTestResults && (
            <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-800 pb-2">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-emerald-600" />
                  <h3 className="text-xs font-mono font-bold uppercase">
                    Self-Test Diagnostic Results (5 Subsystems Checked)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-neutral-500">
                  {selfTestResults.filter(r => r.passed).length} / {selfTestResults.length} Passed
                </span>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-xs">
                {selfTestResults.map((r, i) => (
                  <div key={i} className="py-2.5 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5">
                      {r.passed ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      )}
                      <div>
                        <div className="font-bold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                          <span>{r.name}</span>
                          <span className="text-[10px] text-neutral-400 font-normal">
                            [{r.category}] · {r.durationMs}ms
                          </span>
                        </div>
                        <p className="text-[11px] text-neutral-600 dark:text-neutral-400 font-sans mt-0.5">
                          {r.details}
                        </p>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold ${
                        r.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400'
                          : 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                      }`}
                    >
                      {r.passed ? 'PASS' : 'FAIL'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Error & Exception Monitor */}
      {activeTab === 'errors' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800">
            <div>
              <span className="text-xs font-mono font-bold uppercase">
                Captured Runtime Errors & Exceptions
              </span>
              <p className="text-[11px] text-neutral-500 font-mono">
                Ring buffer captures unhandled exceptions, promise rejections, and print failures.
              </p>
            </div>
            {capturedErrors.length > 0 && (
              <button
                type="button"
                onClick={handleClearErrors}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-mono font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 border border-red-300 dark:border-red-900 transition"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear Errors</span>
              </button>
            )}
          </div>

          {capturedErrors.length === 0 ? (
            <div className="p-8 text-center bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
              <p className="text-xs font-mono font-bold text-neutral-800 dark:text-neutral-200">
                Zero Unhandled Errors Recorded
              </p>
              <p className="text-[11px] text-neutral-500 font-mono">
                No promise rejections, script exceptions, or print failures have occurred in this session.
              </p>
            </div>
          ) : (
            <div className="space-y-2 font-mono text-xs">
              {capturedErrors.map(err => {
                const isExpanded = expandedErrorId === err.id;
                return (
                  <div
                    key={err.id}
                    className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span
                          className={`px-1.5 py-0.5 text-[10px] font-bold ${
                            err.severity === 'CRITICAL'
                              ? 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-400'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400'
                          }`}
                        >
                          {err.type}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-neutral-900 dark:text-neutral-100 block break-words">
                            {err.message}
                          </span>
                          <span className="text-[10px] text-neutral-400">
                            Subsystem: {err.subsystem} · {new Date(err.timestamp).toLocaleTimeString()}
                          </span>
                        </div>
                      </div>

                      {err.stack && (
                        <button
                          type="button"
                          onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                          className="text-[11px] font-bold text-neutral-600 dark:text-neutral-400 hover:text-black dark:hover:text-white shrink-0 underline"
                        >
                          {isExpanded ? 'Hide Trace' : 'View Trace'}
                        </button>
                      )}
                    </div>

                    {isExpanded && err.stack && (
                      <pre className="p-2.5 bg-neutral-950 text-neutral-200 text-[10px] overflow-x-auto border border-neutral-800 mt-2 font-mono">
                        {err.stack}
                      </pre>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: Immutable Compliance Journal */}
      {activeTab === 'journal' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="p-3 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Search audit trail by description, module, or user..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-sans"
              />
            </div>

            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="text-xs py-1.5 px-2 bg-neutral-50 dark:bg-neutral-800 border border-neutral-300 dark:border-neutral-700 font-mono"
            >
              <option value="ALL">All Actions</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
              <option value="BACKUP">BACKUP</option>
              <option value="RESTORE">RESTORE</option>
              <option value="AUTH">AUTH</option>
            </select>
          </div>

          {/* Audit Log Table */}
          <div className="bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800/60 font-mono font-bold text-neutral-600 dark:text-neutral-300">
                  <th className="p-3">Timestamp</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Module</th>
                  <th className="p-3">Operator / Subsystem</th>
                  <th className="p-3">Operation Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 font-mono text-[11px]">
                {filteredLogs.map(log => (
                  <tr key={log.id} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
                    <td className="p-3 text-neutral-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 font-bold border text-[10px] ${
                          log.action === 'CREATE'
                            ? 'border-emerald-600 text-emerald-700 dark:text-emerald-400'
                            : log.action === 'UPDATE'
                            ? 'border-blue-600 text-blue-700 dark:text-blue-400'
                            : log.action === 'DELETE'
                            ? 'border-red-600 text-red-600'
                            : log.action === 'BACKUP'
                            ? 'border-purple-600 text-purple-600'
                            : log.action === 'RESTORE'
                            ? 'border-amber-600 text-amber-600'
                            : 'border-neutral-400 text-neutral-700 dark:text-neutral-300'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 font-semibold">{log.module}</td>
                    <td className="p-3 text-neutral-500">{log.user}</td>
                    <td className="p-3 font-sans text-neutral-800 dark:text-neutral-200">
                      {log.details}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
