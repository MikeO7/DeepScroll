
import React, { useEffect, useState } from 'react';
import Canvas from './Canvas';
import Toolbar from './Toolbar';
import { getSlice } from '../utils/db';

export default function App() {
  const [slices, setSlices] = useState([]);
  const [loading, setLoading] = useState(true);

  // Editor State
  const [isBeautified, setIsBeautified] = useState(false);
  const [hasFooter, setHasFooter] = useState(false);
  const [activeTool, setActiveTool] = useState('select');
  const [historyState, setHistoryState] = useState({ canUndo: false, canRedo: false });

  const [metadata, setMetadata] = useState(null);

  useEffect(() => {
    loadSlices();
  }, []);

  async function loadSlices() {
    try {
      const hash = window.location.hash.substring(1);
      if (!hash) {
        console.warn("No slice IDs found in hash");
        setLoading(false);
        return;
      }

      const json = decodeURIComponent(hash);
      const data = JSON.parse(json);

      let ids = [];
      let meta = null;

      // Handle legacy (array) vs new (object) format
      if (Array.isArray(data)) {
        ids = data;
      } else {
        ids = data.ids;
        meta = data.meta;
        setMetadata(meta);
      }

      const loadedSlices = [];
      for (const id of ids) {
        const slice = await getSlice(id);
        if (slice) loadedSlices.push(slice);
      }

      setSlices(loadedSlices);
    } catch (err) {
      console.error("Failed to load slices:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- Actions ---
  const handleDownload = () => {
    // Logic delegated to Canvas or separate utility using ref? 
    // Need a way to extract the final image. 
    // Maybe pass a ref down to Canvas?
    const event = new CustomEvent('DEEPSCROLL_EXPORT', { detail: { format: 'png' } });
    window.dispatchEvent(event);
  };

  const handleCopy = () => {
    const event = new CustomEvent('DEEPSCROLL_EXPORT', { detail: { toClipboard: true } });
    window.dispatchEvent(event);
  };

  // Toast State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const toastTimeoutRef = React.useRef(null);

  useEffect(() => {
    const handleToast = (e) => {
      const { message, type = 'success' } = e.detail;

      // Clear existing timer to prevent premature hiding
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }

      setToast({ show: true, message, type });

      // Set new timer
      toastTimeoutRef.current = setTimeout(() => {
        setToast(prev => ({ ...prev, show: false }));
      }, 3000);
    };

    window.addEventListener('DEEPSCROLL_TOAST', handleToast);
    return () => {
      window.removeEventListener('DEEPSCROLL_TOAST', handleToast);
      if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30 flex flex-col relative">
      <main className="flex-1 pt-8 pb-32 px-4 flex justify-center overflow-auto items-start">
        {loading ? (
          <div className="text-neutral-400 animate-pulse mt-20">Loading Capture...</div>
        ) : slices.length > 0 ? (
          <div className={`transition - all duration - 500 ease - out ${isBeautified ? 'p-10 scale-95' : 'p-0'} `}>
            <div
              className={`
                    relative transition - all duration - 500 
                    ${isBeautified ? 'shadow-2xl shadow-black/50 rounded-lg overflow-hidden ring-1 ring-white/10' : ''}
`}
            >
              {/* Background Wrapper for Beautify Colors */}
              {isBeautified && (
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 -z-10" />
              )}

              <Canvas
                slices={slices}
                metadata={metadata}
                activeTool={activeTool}
                hasFooter={hasFooter}
                isBeautified={isBeautified}
                onHistoryChange={setHistoryState}
              />
            </div>
          </div>
        ) : (
          <div className="text-neutral-500 mt-20">No capture data found.</div>
        )}
      </main>

      {/* Toast Notification */}
      <div
        className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70] transition-all duration-300 transform 
          ${toast.show ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0 pointer-events-none'}
        `}
      >
        <div className={`
          px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 backdrop-blur-md border
          ${toast.type === 'error'
            ? 'bg-red-500/10 border-red-500/20 text-red-200'
            : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
          }
        `}>
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span className="font-medium text-sm">{toast.message}</span>
        </div>
      </div>

      <Toolbar
        activeTool={activeTool}
        canUndo={historyState.canUndo}
        canRedo={historyState.canRedo}
        onToolSelect={setActiveTool}
        isBeautified={isBeautified}
        onToggleBeautify={() => setIsBeautified(!isBeautified)}
        hasFooter={hasFooter}
        onToggleFooter={() => setHasFooter(!hasFooter)}
        onDownload={handleDownload}
        onCopy={handleCopy}
      />
    </div>
  );
}

