import React, { useState, useEffect } from 'react';
import {
  FileText,
  Activity,
  ArrowDownCircle,
  ArrowUpCircle,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Info,
  AlertCircle,
  Clock,
  Radio,
  Gauge
} from 'lucide-react';
import { routerApi } from '../../services/routerApi.js';

export default function ModemLogsPage({ routerStatus }) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [serviceFlows, setServiceFlows] = useState([]);
  const [eventLogs, setEventLogs] = useState([]);
  const [filterPriority, setFilterPriority] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = async () => {
    try {
      setError(null);
      if (routerStatus.mockMode) {
        const mock = routerApi.getMockData();
        setServiceFlows(mock.serviceFlows || []);
        setEventLogs(mock.eventLog || []);
        return;
      }

      const [flowsRes, logsRes] = await Promise.all([
        routerApi.getServiceFlows(),
        routerApi.getEventLog()
      ]);

      if (flowsRes.data?.serviceFlows) {
        setServiceFlows(flowsRes.data.serviceFlows);
      }
      if (logsRes.data?.eventlog) {
        setEventLogs(logsRes.data.eventlog);
      }
    } catch (err) {
      console.error('Failed to load modem logs and flows:', err);
      setError(err.message || 'Error communicating with cable modem');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [routerStatus.mockMode, routerStatus.authenticated]);

  // Extract speeds
  const downstreamFlow = serviceFlows.find(f => (f.serviceFlow || f).direction === 'downstream');
  const upstreamFlow = serviceFlows.find(f => (f.serviceFlow || f).direction === 'upstream');

  const downRateBps = (downstreamFlow?.serviceFlow || downstreamFlow)?.maxTrafficRate || 0;
  const upRateBps = (upstreamFlow?.serviceFlow || upstreamFlow)?.maxTrafficRate || 0;

  const downMbps = (downRateBps / 1000000).toFixed(1);
  const upMbps = (upRateBps / 1000000).toFixed(1);

  // Filter logs
  const filteredLogs = eventLogs.filter(log => {
    const matchesFilter = filterPriority === 'all' || log.priority?.toLowerCase() === filterPriority;
    const matchesSearch = !searchQuery.trim() ||
      log.message?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.time?.includes(searchQuery);
    return matchesFilter && matchesSearch;
  });

  const getPriorityBadge = (priority) => {
    const p = (priority || '').toLowerCase();
    if (p === 'critical' || p === 'error') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center gap-1 w-fit">
          <AlertCircle className="w-3 h-3" />
          <span>{priority}</span>
        </span>
      );
    }
    if (p === 'warning') {
      return (
        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" />
          <span>{priority}</span>
        </span>
      );
    }
    return (
      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center gap-1 w-fit">
        <Info className="w-3 h-3" />
        <span>{priority || 'Notice'}</span>
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-5 h-5 text-rose-500" />
            <span>Modem Logs & DOCSIS Service Flows</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Provisioned broadband package speeds and live DOCSIS 3.1 cable modem event history.
          </p>
        </div>

        <button
          onClick={() => { setRefreshing(true); fetchData(); }}
          disabled={refreshing || loading}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700/80 flex items-center gap-2 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh Logs'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* Speed Flows / Broadband Tier Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
              <ArrowDownCircle className="w-4 h-4 text-emerald-400" />
              <span>Provisioned Downstream Bandwidth</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-1.5 pt-1">
              <span>{downMbps > 0 ? downMbps : '--'}</span>
              <span className="text-xs text-slate-400 font-normal">Mbps</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Flow ID: {(downstreamFlow?.serviceFlow || downstreamFlow)?.serviceFlowId || 'N/A'} (DOCSIS 3.1 Profile)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <Gauge className="w-6 h-6" />
          </div>
        </div>

        <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-slate-400 text-xs font-medium flex items-center gap-1.5">
              <ArrowUpCircle className="w-4 h-4 text-cyan-400" />
              <span>Provisioned Upstream Bandwidth</span>
            </div>
            <div className="text-2xl font-bold text-white font-mono flex items-baseline gap-1.5 pt-1">
              <span>{upMbps > 0 ? upMbps : '--'}</span>
              <span className="text-xs text-slate-400 font-normal">Mbps</span>
            </div>
            <p className="text-[11px] text-slate-500">
              Flow ID: {(upstreamFlow?.serviceFlow || upstreamFlow)?.serviceFlowId || 'N/A'} (SC-QAM & OFDMA)
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Gauge className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* DOCSIS Event Log Table */}
      <div className="p-6 rounded-xl bg-slate-900/80 border border-slate-800/80 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-2">
              <FileText className="w-4 h-4 text-rose-500" />
              <span>DOCSIS Event Log History ({filteredLogs.length})</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Hardware events, ranging synchronizations, DHCP warnings, and administrative logins.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search event logs..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-rose-500"
              />
            </div>

            {/* Filter Priority */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setFilterPriority('all')}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${filterPriority === 'all' ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterPriority('notice')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${filterPriority === 'notice' ? 'bg-cyan-500/20 text-cyan-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Notices
              </button>
              <button
                onClick={() => setFilterPriority('warning')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${filterPriority === 'warning' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Warnings
              </button>
              <button
                onClick={() => setFilterPriority('critical')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${filterPriority === 'critical' ? 'bg-rose-500/20 text-rose-300' : 'text-slate-400 hover:text-slate-200'
                  }`}
              >
                Critical
              </button>
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No events match your criteria.
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-800/80 sticky top-0 bg-slate-900 z-10">
                <tr>
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">Priority</th>
                  <th className="py-2.5 px-3">Diagnostic Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {filteredLogs.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 font-mono text-slate-400 whitespace-nowrap">
                      {item.time ? new Date(item.time).toLocaleString() : 'Unknown'}
                    </td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {getPriorityBadge(item.priority)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-slate-300 leading-relaxed">
                      {item.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

