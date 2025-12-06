import React from 'react';

const StatsCard = ({ label, value, icon: Icon, color, alert }) => {
    return (
        <div className={`bg-surface p-6 rounded-xl border ${alert ? 'border-red-500/50 animate-pulse' : 'border-slate-700'} transition-all`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm mb-1">{label}</p>
                    <h2 className={`text-3xl font-bold ${color}`}>{value}</h2>
                </div>
                <div className={`p-3 rounded-lg bg-slate-900/50 ${color}`}>
                    <Icon className="w-6 h-6" />
                </div>
            </div>
        </div>
    );
};

export default StatsCard;
