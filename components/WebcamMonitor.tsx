
import React, { useRef, useEffect, useState } from 'react';

interface WebcamMonitorProps {
  isActive: boolean;
  onFrameCapture: (frames: string[]) => void;
}

const WebcamMonitor: React.FC<WebcamMonitorProps> = ({ isActive, onFrameCapture }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPolicyBlocked, setIsPolicyBlocked] = useState(false);
  const [isCapturingBurst, setIsCapturingBurst] = useState(false);
  const [lastCaptureTime, setLastCaptureTime] = useState<number>(0);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    // If active but no stream, we wait for user to click start
    // If inactive, we clean up
    if (!isActive) {
      stopCapture();
    }
    return () => stopCapture();
  }, [isActive]);

  const startCapture = async () => {
    try {
      setError(null);
      setIsPolicyBlocked(false);
      
      // Use getDisplayMedia for Screen Sharing
      const mediaStream = await navigator.mediaDevices.getDisplayMedia({ 
        video: { 
          displaySurface: "window", // Encourages window selection over full screen
        },
        audio: false
      });
      
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }

      // Handle user stopping the share via browser UI
      mediaStream.getVideoTracks()[0].onended = () => {
        stopCapture();
      };

      // Start capture loop
      if (intervalRef.current) clearInterval(intervalRef.current);
      // Capture a snippet (burst) every 10 seconds to allow time for analysis
      intervalRef.current = window.setInterval(captureSnippet, 10000); 
      
      // Initial capture after a slight delay to let video warm up
      setTimeout(captureSnippet, 2000);

    } catch (err: any) {
      console.error("Error accessing screen:", err);
      let msg = "Screen share failed.";
      
      // Handle specific Permission Policy errors
      if (err.message && err.message.includes("disallowed by permissions policy")) {
        msg = "Screen sharing is blocked by the browser environment.";
        setIsPolicyBlocked(true);
      } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        msg = "Permission denied. Please allow screen sharing when prompted.";
      } else {
        msg = err.message || "Could not start screen capture.";
      }
      setError(msg);
    }
  };

  const stopCapture = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const getFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    
    // Ensure video is playing and has data
    if (video.readyState !== 4) return null;

    if (context && video.videoWidth > 0) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8); // High quality
      if (dataUrl.length < 1000) return null; // Ignore empty frames
      return dataUrl.split(',')[1];
    }
    return null;
  };

  const captureSnippet = async () => {
    if (isCapturingBurst || !stream) return;
    
    setIsCapturingBurst(true);
    const frames: string[] = [];

    // Burst Capture Logic: Take 3 frames spaced by 500ms
    // This creates a 1.5s "video snippet" for the AI to analyze
    for (let i = 0; i < 3; i++) {
        const frame = getFrame();
        if (frame) frames.push(frame);
        await new Promise(r => setTimeout(r, 500));
    }

    setIsCapturingBurst(false);

    if (frames.length > 0) {
        onFrameCapture(frames);
        setLastCaptureTime(Date.now());
    }
  };

  return (
    <div className={`relative rounded-xl overflow-hidden bg-black border-2 transition-all ${isActive ? 'border-cyan-500 shadow-[0_0_20px_rgba(6,182,212,0.4)]' : 'border-slate-700'}`}>
      
      {error ? (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-900 text-center p-6">
          <div className="text-red-500 text-4xl mb-2">🖥️❌</div>
          <h3 className="text-red-400 font-bold text-lg">Screen Capture Error</h3>
          <p className="text-slate-400 text-sm mt-2 max-w-md mx-auto">{error}</p>
          
          {isPolicyBlocked ? (
             <div className="mt-4 bg-slate-800/50 p-3 rounded border border-slate-700">
               <p className="text-yellow-400 text-xs">
                 ⚠️ The current environment restricts screen sharing. 
                 <br/>Please use the <strong>Manual Upload</strong> mode below.
               </p>
             </div>
          ) : (
            <>
              <p className="text-slate-500 text-xs mt-1 italic">
                Check OS settings: Privacy & Security {'>'} Screen Recording.
              </p>
              <button 
                onClick={() => startCapture()}
                className="mt-4 bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded text-xs font-bold uppercase"
              >
                Retry Selection
              </button>
            </>
          )}
        </div>
      ) : !stream && isActive ? (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-slate-900 text-center p-6 space-y-4">
           <div className="w-16 h-16 rounded-full bg-cyan-500/20 flex items-center justify-center mb-2 animate-pulse">
              <svg className="w-8 h-8 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
              </svg>
           </div>
           <div>
             <h3 className="text-white font-bold text-lg">Select Trading Window</h3>
             <p className="text-slate-400 text-sm">Share your chart window to begin auto-analysis</p>
           </div>
           <button 
             onClick={startCapture}
             className="bg-cyan-600 hover:bg-cyan-500 text-white px-6 py-3 rounded-lg font-bold uppercase tracking-wide text-sm shadow-lg shadow-cyan-500/20 transition-all transform hover:scale-105"
           >
             Start Screen Share
           </button>
        </div>
      ) : (
        <video 
          ref={videoRef} 
          autoPlay 
          playsInline 
          muted 
          className={`w-full h-64 object-cover ${isActive ? 'opacity-100' : 'opacity-20'}`}
        />
      )}

      <canvas ref={canvasRef} className="hidden" />
      
      {!isActive && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <span className="text-slate-500 font-mono text-sm border border-slate-700 px-4 py-2 rounded">MONITOR OFF</span>
        </div>
      )}
      
      {stream && isActive && !error && (
        <>
            <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
            <span className={`w-2 h-2 rounded-full ${isCapturingBurst ? 'bg-red-500 animate-ping' : 'bg-cyan-500 animate-pulse'}`}></span>
            <span className="text-cyan-400 text-xs font-bold bg-black/60 px-2 py-1 rounded backdrop-blur-sm border border-cyan-500/30">
                {isCapturingBurst ? 'RECORDING SNIPPET' : 'LIVE FEED'}
            </span>
            </div>
            {/* Heartbeat Flash */}
            <div 
                key={lastCaptureTime} 
                className="absolute bottom-0 left-0 w-full h-1 bg-emerald-400 animate-pulse-slow opacity-0 transition-opacity duration-500"
                style={{ opacity: Date.now() - lastCaptureTime < 2000 ? 1 : 0 }}
            />
        </>
      )}
    </div>
  );
};

export default WebcamMonitor;
