import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, Users, Activity, Settings, Play, Square, Video, Bell } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Components
import VideoPlayer from './components/VideoPlayer';
import StatsCard from './components/StatsCard';
import ConfigPanel from './components/ConfigPanel';
import AlertSettingsModal from './components/AlertSettingsModal';

function App() {
  const [stats, setStats] = useState(null);
  const [history, setHistory] = useState([]);
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isAlertsOpen, setIsAlertsOpen] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(false);

  useEffect(() => {
    const interval = setInterval(fetchStats, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('http://localhost:5000/api/stats');
      const data = await res.json();
      setStats(data);

      setHistory(prev => {
        const newPoint = {
          time: data.time,
          count: data.human_count,
          energy: data.abnormal_activity ? 100 : Math.random() * 20 // Simulated energy for demo if missing
        };
        const newHist = [...prev, newPoint];
        if (newHist.length > 20) newHist.shift();
        return newHist;
      });
    } catch (e) {
      console.error("Fetch stats failed", e);
    }
  };

  return (
    <div className="min-h-screen p-6">
      {/* Header */}
      <header className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-primary/20 rounded-xl">
            <Shield className="w-8 h-8 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
              CrowdShield AI
            </h1>
            <p className="text-slate-400 text-sm">Stampede Prevention System</p>
          </div>
        </div>
        <div className="flex gap-4">
          <button
            onClick={() => setIsAlertsOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border bg-surface border-slate-700 text-slate-300 hover:text-white hover:border-primary"
          >
            <Bell className="w-5 h-5" />
            <span className="hidden md:inline">Smart Alerts</span>
          </button>

          <button
            onClick={() => setShowHeatmap(!showHeatmap)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors border ${showHeatmap ? 'bg-primary border-primary text-white' : 'bg-surface border-slate-700 text-slate-300'}`}
          >
            <Activity className="w-5 h-5" />
            {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
          </button>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            className="p-3 bg-surface hover:bg-slate-700 rounded-lg transition-colors border border-slate-700"
          >
            <Settings className="w-6 h-6 text-slate-300" />
          </button>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-140px)]">

        {/* Left: Video & Controls */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-surface rounded-2xl overflow-hidden shadow-2xl border border-slate-700 aspect-video relative group">
            <VideoPlayer showHeatmap={showHeatmap} />

            {/* Overlay Stats */}
            <div className="absolute top-4 left-4 flex gap-2">
              <span className="px-3 py-1 bg-black/50 backdrop-blur rounded-full text-xs font-mono text-green-400 flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                LIVE FEED
              </span>
              {stats?.restricted_entry && (
                <span className="px-3 py-1 bg-red-500/80 backdrop-blur rounded-full text-xs font-bold text-white animate-bounce">
                  RESTRICTED ENTRY
                </span>
              )}
            </div>
          </div>

          {/* Bottom Charts */}
          <div className="grid grid-cols-2 gap-6 h-full min-h-[200px]">
            <div className="bg-surface p-4 rounded-xl border border-slate-700">
              <h3 className="text-slate-400 text-sm mb-4 flex items-center gap-2">
                <Users className="w-4 h-4" /> Crowd Activity
              </h3>
              <ResponsiveContainer width="100%" height="80%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                  <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-surface p-4 rounded-xl border border-slate-700">
              <h3 className="text-slate-400 text-sm mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4" /> Anomaly Energy
              </h3>
              <ResponsiveContainer width="100%" height="80%">
                <AreaChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: 'none' }} />
                  <Area type="monotone" dataKey="energy" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right: Stats & Logs */}
        <div className="flex flex-col gap-6">
          <StatsCard
            label="Total Count"
            value={stats?.human_count || 0}
            icon={Users}
            color="text-blue-400"
          />
          <StatsCard
            label="Dist. Violations"
            value={stats?.violation_count || 0}
            icon={AlertTriangle}
            color="text-yellow-400"
            alert={stats?.violation_count > 0}
          />
          <StatsCard
            label="Abnormal Activity"
            value={stats?.abnormal_activity ? "DETECTED" : "Normal"}
            icon={Activity}
            color={stats?.abnormal_activity ? "text-red-500" : "text-green-500"}
            alert={stats?.abnormal_activity}
          />

          {isConfigOpen && <ConfigPanel />}

          <div className="bg-surface rounded-xl border border-slate-700 flex-1 p-4">
            <h3 className="text-slate-400 text-sm mb-4">System Log</h3>
            <div className="space-y-2 text-xs font-mono text-slate-300">
              {history.slice().reverse().map((log, i) => (
                <div key={i} className="flex justify-between border-b border-slate-700/50 pb-1">
                  <span>{log.time}</span>
                  <span>Count: {log.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>

      {/* Modals */}
      <AlertSettingsModal isOpen={isAlertsOpen} onClose={() => setIsAlertsOpen(false)} />

    </div>
  );
}

export default App;
