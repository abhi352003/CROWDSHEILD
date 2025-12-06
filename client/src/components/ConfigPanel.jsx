import React, { useState } from 'react';
import { Video, Globe, Folder, Play } from 'lucide-react';

const ConfigPanel = () => {
    const [source, setSource] = useState('0');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            await fetch('http://localhost:5000/api/config/source', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ source })
            });
        } catch (err) {
            console.error(err);
        }
        setLoading(false);
    };

    return (
        <div className="bg-surface p-4 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 text-sm mb-4">Input Source</h3>
            <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                    type="text"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="0 or http://ip:port or file.mp4"
                    className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary"
                />
                <button
                    type="submit"
                    disabled={loading}
                    className="bg-primary hover:bg-blue-600 px-4 py-2 rounded-lg text-white disabled:opacity-50"
                >
                    {loading ? '...' : <Play className="w-4 h-4" />}
                </button>
            </form>
            <p className="text-xs text-slate-500 mt-2">
                Enter 0 for Webcam, or RSTP/HTTP URL for IP Camera.
            </p>
        </div>
    );
};

export default ConfigPanel;
