import React, { useState } from 'react';
import {
  Terminal,
  Play,
  RotateCw,
  HardDriveDownload,
  ShieldAlert,
  CheckCircle2,
  Info,
  Layers,
  Activity,
  Trash2,
  StopCircle,
  AlertTriangle,
  Code
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function ToolsPage() {
  const [activeTool, setActiveTool] = useState('ping'); // 'ping', 'traceroute', 'system'
  const [targetHost, setTargetHost] = useState('1.1.1.1');
  const [pingCount, setPingCount] = useState(4);
  const [dataBlockSize, setDataBlockSize] = useState(64);
  const [maxHops, setMaxHops] = useState(30);

  const [isRunning, setIsRunning] = useState(false);
  const [currentJobId, setCurrentJobId] = useState(null);
  const [consoleOutput, setConsoleOutput] = useState([
    'Virgin Media Hub 5 Diagnostics Console ready.',
    'Endpoints: /rest/v1/system/diagnostics/ping/jobs & /rest/v1/system/diagnostics/traceroute/jobs',
    'Enter target IP or domain and press "Run Diagnostic".'
  ]);

  const [rebootModal, setRebootModal] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [rebootSuccess, setRebootSuccess] = useState(false);

  // Inspector
  const [showInspector, setShowInspector] = useState(false);
  const [lastRawResult, setLastRawResult] = useState(null);

  // Helper to add lines to terminal
  const appendConsole = (text) => {
    setConsoleOutput(prev => [...prev, text]);
  };

  // Run Real Hub 5 Ping Job
  const handleRunPing = async () => {
    if (!targetHost.trim()) return;
    setIsRunning(true);
    appendConsole(`\n[Hub 5] Requesting ICMP Ping job for ${targetHost} (${pingCount} packets, ${dataBlockSize} bytes)...`);

    try {
      const createRes = await routerApi.startPingJob(targetHost.trim(), pingCount, dataBlockSize);
      if (!createRes.success) {
        appendConsole(`[Error] Failed to create Ping job: ${createRes.error || (createRes.data?.message || 'Server returned ' + createRes.status)}`);
        setIsRunning(false);
        return;
      }

      const jobId = createRes.data?.created?.id || 1;
      setCurrentJobId(jobId);
      appendConsole(`[Hub 5] Job #${jobId} dispatched. Waiting for DOCSIS network response...`);

      // Poll until complete
      let attempts = 0;
      let completed = false;

      while (attempts < 15 && !completed) {
        await new Promise(r => setTimeout(r, 1500));
        attempts++;
        const stateRes = await routerApi.getPingJobState(jobId);
        const state = stateRes.data?.pingJob?.state;
        appendConsole(`[Hub 5] Job #${jobId} status: ${state || 'processing'}...`);

        if (state === 'complete') {
          completed = true;
          break;
        }
      }

      // Fetch full result
      const resultRes = await routerApi.getPingJobResult(jobId);
      setLastRawResult(resultRes.data);

      if (resultRes.success && resultRes.data?.pingJob?.results) {
        const r = resultRes.data.pingJob.results;
        const p = resultRes.data.pingJob.parameters || {};
        appendConsole(`\n--- ${p.host || targetHost} ping statistics ---`);
        appendConsole(`${p.numberOfPings || pingCount} packets transmitted, ${r.successCount} received, ${r.failureCount} failed.`);
        if (r.averageResponseTimeMs) {
          appendConsole(`rtt min/avg/max = ${r.minimumResponseTimeMs}/${r.averageResponseTimeMs}/${r.maximumResponseTimeMs} ms`);
        }
      } else {
        appendConsole(`[Hub 5] Raw Output: ${JSON.stringify(resultRes.data || resultRes)}`);
      }

      // Cleanup job
      await routerApi.deletePingJob(jobId);
      setCurrentJobId(null);
    } catch (err) {
      appendConsole(`[Error] Diagnostic exception: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Run Real Hub 5 Traceroute Job
  const handleRunTraceroute = async () => {
    if (!targetHost.trim()) return;
    setIsRunning(true);
    appendConsole(`\n[Hub 5] Requesting Traceroute job to ${targetHost} (max ${maxHops} hops)...`);

    try {
      const createRes = await routerApi.startTracerouteJob(targetHost.trim(), maxHops);
      if (!createRes.success) {
        appendConsole(`[Error] Failed to create Traceroute job: ${createRes.error || (createRes.data?.message || 'Server error ' + createRes.status)}`);
        setIsRunning(false);
        return;
      }

      const jobId = createRes.data?.created?.id || 1;
      setCurrentJobId(jobId);
      appendConsole(`[Hub 5] Traceroute Job #${jobId} initialized. Tracing route...`);

      let attempts = 0;
      let completed = false;

      while (attempts < 20 && !completed) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;
        const stateRes = await routerApi.getTracerouteJobState(jobId);
        const state = stateRes.data?.traceRouteJob?.state;
        appendConsole(`[Hub 5] Hop analysis: ${state || 'in progress'} (probe ${attempts})...`);

        if (state === 'complete') {
          completed = true;
          break;
        }
      }

      // Fetch full hop results
      const resultRes = await routerApi.getTracerouteJobResult(jobId);
      setLastRawResult(resultRes.data);

      if (resultRes.success && resultRes.data?.traceRouteJob?.routeHops) {
        const hops = resultRes.data.traceRouteJob.routeHops;
        appendConsole(`\n--- Traceroute results (${hops.length} hops recorded) ---`);
        hops.forEach((hop, idx) => {
          appendConsole(` ${idx + 1}  ${hop.host || hop.hostAddress || '*'} (${hop.hostAddress || '*'})  ${hop.responseTimeMs ? hop.responseTimeMs + ' ms' : '*'}`);
        });
      } else {
        appendConsole(`[Hub 5] Output: ${JSON.stringify(resultRes.data || resultRes)}`);
      }

      // Cleanup job
      await routerApi.deleteTracerouteJob(jobId);
      setCurrentJobId(null);
    } catch (err) {
      appendConsole(`[Error] Traceroute exception: ${err.message}`);
    } finally {
      setIsRunning(false);
    }
  };

  // Reboot Virgin Media Hub 5
  const handleConfirmReboot = async () => {
    setIsRebooting(true);
    try {
      const res = await routerApi.rebootRouter('Reboot requested via Hub 5 Desktop App');
      if (res.success) {
        setRebootSuccess(true);
        appendConsole('\n[Hub 5] REBOOT COMMAND ACCEPTED. System is restarting now (DOCSIS link will reset)...');
      } else {
        appendConsole(`\n[Hub 5] Reboot error: ${res.error || res.status}`);
      }
    } catch (err) {
      appendConsole(`\n[Hub 5] Reboot exception: ${err.message}`);
    } finally {
      setIsRebooting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Endpoints Strip */}
      <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-rose-500/10 text-rose-400 mt-0.5">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-200 flex items-center gap-2">
              <span>Virgin Media Hub 5 Network Diagnostics Engine</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono">
                Job Engine Active
              </span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex flex-wrap gap-x-3 gap-y-1 font-mono">
              <span className="text-slate-300">POST /system/diagnostics/ping/jobs</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">POST /system/diagnostics/traceroute/jobs</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-300">POST /system/reboot</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setShowInspector(!showInspector)}
          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 shrink-0"
        >
          <Code className="w-3.5 h-3.5 text-purple-400" />
          <span>{showInspector ? 'Hide Raw JSON' : 'Inspect Last Result'}</span>
        </button>
      </div>

      {showInspector && lastRawResult && (
        <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
          <span className="text-xs font-semibold text-slate-300 font-mono">Raw Diagnostics Job Result</span>
          <pre className="text-slate-300 max-h-52 overflow-y-auto p-3 bg-slate-900/90 rounded border border-slate-800 font-mono text-[11px] select-text">
            {JSON.stringify(lastRawResult, null, 2)}
          </pre>
        </div>
      )}

      {/* Selector Tabs */}
      <div className="flex border-b border-slate-800 gap-6 text-xs font-medium">
        <button
          onClick={() => setActiveTool('ping')}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${activeTool === 'ping'
              ? 'border-rose-500 text-rose-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <Activity className="w-4 h-4" />
          <span>ICMP Ping Utility</span>
        </button>

        <button
          onClick={() => setActiveTool('traceroute')}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${activeTool === 'traceroute'
              ? 'border-rose-500 text-rose-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <Layers className="w-4 h-4" />
          <span>Traceroute Route Analysis</span>
        </button>

        <button
          onClick={() => setActiveTool('system')}
          className={`pb-3 transition-colors flex items-center gap-2 border-b-2 ${activeTool === 'system'
              ? 'border-rose-500 text-rose-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
        >
          <RotateCw className="w-4 h-4" />
          <span>Hub 5 Power & Reboot</span>
        </button>
      </div>

      {/* Tool Content */}
      {activeTool === 'system' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Reboot Box */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <RotateCw className="w-4 h-4 text-amber-400" />
              <span>Reboot Virgin Media Hub 5</span>
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Triggers <code className="text-rose-300 font-mono">POST /rest/v1/system/reboot</code> with payload <code className="text-slate-300 font-mono">&#123; "reboot": &#123; "enable": true &#125; &#125;</code>.
              This will restart the cable gateway and all LAN/Wi-Fi devices will briefly disconnect while the DOCSIS connection establishes.
            </p>
            <div className="pt-2">
              <button
                onClick={() => {
                  setRebootSuccess(false);
                  setRebootModal(true);
                }}
                className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 shadow-lg shadow-rose-900/20 transition-colors"
              >
                <RotateCw className="w-4 h-4" />
                <span>Reboot Router Now</span>
              </button>
            </div>
          </div>

          {/* DOCSIS Link Status */}
          <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2 border-b border-slate-800 pb-3">
              <ShieldAlert className="w-4 h-4 text-cyan-400" />
              <span>Maintenance Status</span>
            </h3>
            <div className="text-xs space-y-2 text-slate-400">
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>DOCSIS Subsystem</span>
                <span className="text-emerald-400 font-mono">DOCSIS 3.1 Synchronized</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Hardware</span>
                <span className="text-slate-200 font-mono">Sagemcom Hub 5</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-800/60">
                <span>Scheduled Reset</span>
                <span className="text-slate-200 font-mono">None</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div>
                <label className="block text-slate-400 text-[11px] mb-1 font-medium">Target Hostname or IP</label>
                <input
                  type="text"
                  value={targetHost}
                  onChange={(e) => setTargetHost(e.target.value)}
                  placeholder="1.1.1.1 or virginmedia.com"
                  className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs w-60 focus:outline-none focus:border-rose-500"
                />
              </div>

              {activeTool === 'ping' ? (
                <>
                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">Packet Count</label>
                    <select
                      value={pingCount}
                      onChange={(e) => setPingCount(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-rose-500"
                    >
                      <option value={3}>3 Packets</option>
                      <option value={5}>5 Packets</option>
                      <option value={10}>10 Packets</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 text-[11px] mb-1 font-medium">Data Block Size (64–1518)</label>
                    <input
                      type="number"
                      min={64}
                      max={1518}
                      value={dataBlockSize}
                      onChange={(e) => setDataBlockSize(Number(e.target.value))}
                      className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs w-24 focus:outline-none focus:border-rose-500"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-slate-400 text-[11px] mb-1 font-medium">Max Hops (1–30)</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={maxHops}
                    onChange={(e) => setMaxHops(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 font-mono text-xs w-24 focus:outline-none focus:border-rose-500"
                  />
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConsoleOutput(['Console output cleared.'])}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-xs border border-slate-700"
                title="Clear Output"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={activeTool === 'ping' ? handleRunPing : handleRunTraceroute}
                disabled={isRunning}
                className="px-5 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center gap-2 disabled:opacity-50 transition-colors shadow-lg shadow-rose-900/20"
              >
                {isRunning ? (
                  <RotateCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Play className="w-3.5 h-3.5" />
                )}
                <span>{isRunning ? 'Running on Hub 5...' : `Run ${activeTool === 'ping' ? 'Ping' : 'Traceroute'}`}</span>
              </button>
            </div>
          </div>

          {/* Interactive Shell Output Screen */}
          <div className="rounded-xl bg-slate-950 border border-slate-800 shadow-2xl overflow-hidden">
            <div className="px-4 py-2 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between text-[11px] text-slate-400 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 inline-block"></span>
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 inline-block"></span>
                <span className="ml-2 text-slate-300">Virgin Media Hub 5 Diagnostic Engine</span>
              </div>
              <span className={isRunning ? 'text-amber-400 font-semibold animate-pulse' : 'text-slate-500'}>
                {isRunning ? 'RUNNING JOB' : 'IDLE'}
              </span>
            </div>

            <div className="p-4 font-mono text-xs text-emerald-400 space-y-1 h-80 overflow-y-auto select-text">
              {consoleOutput.map((line, idx) => (
                <div key={idx} className="whitespace-pre-wrap">{line}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Reboot Modal */}
      {rebootModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <h4 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Confirm Virgin Media Hub 5 Reboot
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Are you sure you want to reboot the Hub 5? All active broadband, Wi-Fi, and VoIP telephone services will disconnect for 2–3 minutes while the DOCSIS 3.1 connection re-locks.
            </p>

            {rebootSuccess ? (
              <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs">
                Reboot signal sent! The router is currently restarting.
              </div>
            ) : null}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setRebootModal(false)}
                disabled={isRebooting}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium"
              >
                {rebootSuccess ? 'Close' : 'Cancel'}
              </button>
              {!rebootSuccess && (
                <button
                  onClick={handleConfirmReboot}
                  disabled={isRebooting}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-medium flex items-center gap-2"
                >
                  {isRebooting && <RotateCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRebooting ? 'Sending Signal...' : 'Confirm Reboot'}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
