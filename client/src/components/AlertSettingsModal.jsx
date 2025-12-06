import React, { useState, useEffect } from 'react';
import { X, Bell, Phone, Key, Activity, Save, AlertTriangle, Send } from 'lucide-react';

const AlertSettingsModal = ({ isOpen, onClose }) => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [testStatus, setTestStatus] = useState(null);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen]);

    const fetchConfig = async () => {
        try {
            setLoading(true);
            const res = await fetch('http://localhost:5000/api/config/alerts');
            const data = await res.json();
            setConfig(data);
        } catch (e) {
            console.error("Failed to fetch alert config", e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            const res = await fetch('http://localhost:5000/api/config/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            if (res.ok) {
                onClose();
            }
        } catch (e) {
            console.error("Failed to save config", e);
        }
    };

    const handleTest = async () => {
        setTestStatus("Sending...");
        try {
            const res = await fetch('http://localhost:5000/api/test_alert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone: config.PHONE_NUMBER, auth_token: config.TWILIO_AUTH_TOKEN })
            });
            const data = await res.json();
            setTestStatus(data.status || "Check Backend Log");
            setTimeout(() => setTestStatus(null), 3000);
        } catch (e) {
            setTestStatus("Failed");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">

                {/* Header */}
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-900/50">
                    <div className="flex items-center gap-2 text-primary font-bold">
                        <Bell className="w-5 h-5" />
                        <h3>Smart Alert Settings</h3>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-700/50 rounded-full transition-colors text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                    {loading ? (
                        <div className="text-center text-slate-400">Loading Configuration...</div>
                    ) : (
                        <>
                            {/* Master Switch */}
                            <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700">
                                <span className="font-medium text-slate-200">Enable WhatsApp Alerts</span>
                                <button
                                    onClick={() => setConfig({ ...config, ENABLED: !config.ENABLED })}
                                    className={`w-12 h-6 rounded-full transition-colors relative ${config.ENABLED ? 'bg-green-500' : 'bg-slate-600'}`}
                                >
                                    <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-transform ${config.ENABLED ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>

                            {/* Triggers Section */}
                            <div className="space-y-4">
                                <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Trigger Conditions</h4>

                                <div className="space-y-2">
                                    <label className="text-sm text-slate-300 flex justify-between">
                                        Max Crowd Threshold
                                        <span className="text-primary font-mono">{config.MAX_CROWD}</span>
                                    </label>
                                    <input
                                        type="range" min="5" max="50"
                                        value={config.MAX_CROWD}
                                        onChange={(e) => setConfig({ ...config, MAX_CROWD: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-slate-300 flex justify-between">
                                        Max Violations Allowance
                                        <span className="text-yellow-400 font-mono">{config.MAX_VIOLATIONS}</span>
                                    </label>
                                    <input
                                        type="range" min="1" max="20"
                                        value={config.MAX_VIOLATIONS}
                                        onChange={(e) => setConfig({ ...config, MAX_VIOLATIONS: parseInt(e.target.value) })}
                                        className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                                    />
                                </div>

                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        checked={config.ABNORMAL_TRIGGER}
                                        onChange={(e) => setConfig({ ...config, ABNORMAL_TRIGGER: e.target.checked })}
                                        className="w-4 h-4 rounded border-slate-600 bg-slate-700 text-red-500 focus:ring-red-500"
                                    />
                                    <span className="text-sm text-slate-300">Stampede / Panic Detection (Running Analysis)</span>
                                </div>
                            </div>

                            {/* Credentials Section */}
                            <div className="space-y-4 pt-4 border-t border-slate-700">
                                <h4 className="text-xs uppercase font-bold text-slate-500 tracking-wider">Recipient Configuration</h4>

                                <div className="space-y-2">
                                    <label className="text-xs text-slate-400 flex items-center gap-1">
                                        <Phone className="w-3 h-3" /> WhatsApp Number (Include Country Code)
                                    </label>
                                    <input
                                        type="text"
                                        value={config.PHONE_NUMBER}
                                        onChange={(e) => setConfig({ ...config, PHONE_NUMBER: e.target.value })}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
                                        placeholder="+1234567890"
                                    />
                                </div>

                                <label className="text-xs text-slate-400 flex items-center gap-1">
                                    <Key className="w-3 h-3" /> Twilio Auth Token
                                </label>
                                <input
                                    type="text"
                                    value={config.TWILIO_AUTH_TOKEN || ''}
                                    onChange={(e) => setConfig({ ...config, TWILIO_AUTH_TOKEN: e.target.value })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-primary"
                                    placeholder="Enter Auth Token"
                                />
                            </div>
                        </>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 bg-slate-900/50 border-t border-slate-700 flex justify-between items-center gap-3">
                    <button
                        onClick={handleTest}
                        disabled={loading || !config?.ENABLED}
                        className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                        <Send className="w-4 h-4" />
                        {testStatus || "Test Alert"}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 px-4 py-2 rounded-lg bg-primary hover:bg-blue-600 text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                        <Save className="w-4 h-4" />
                        Save Changes
                    </button>
                </div>

            </div>
        </div>
    );
};

export default AlertSettingsModal;
