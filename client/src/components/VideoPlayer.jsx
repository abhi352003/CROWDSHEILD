import React, { useRef, useEffect } from 'react';

const VideoPlayer = ({ showHeatmap }) => {
    // We use a simple IMG tag for MJPEG streaming.
    // The backend URL is http://localhost:5000/video_feed
    const streamUrl = "http://localhost:5000/video_feed";
    const heatmapUrl = "http://localhost:5000/heatmap_feed";

    return (
        <div className="w-full h-full bg-black flex items-center justify-center relative">
            <img
                src={streamUrl}
                alt="Live Stream"
                className="w-full h-full object-contain absolute inset-0"
                onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentNode.children[2].style.display = 'flex';
                }}
            />
            {showHeatmap && (
                <img
                    src={heatmapUrl}
                    alt="Heatmap Overlay"
                    className="w-full h-full object-contain absolute inset-0 opacity-60 mix-blend-screen"
                />
            )}
            <div className="hidden absolute inset-0 flex-col items-center justify-center text-slate-500 z-0">
                <p className="mb-2">Stream Offline</p>
                <p className="text-xs">Checking connection...</p>
            </div>
        </div>
    );
};

export default VideoPlayer;
