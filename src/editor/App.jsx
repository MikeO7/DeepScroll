
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

  return (
    <div className="min-h-screen bg-neutral-950 text-white font-sans selection:bg-purple-500/30 flex flex-col">
      <header className="fixed top-0 left-0 right-0 h-14 bg-black/50 backdrop-blur-md border-b border-white/10 flex items-center px-6 z-50">
        <div className="font-bold text-lg tracking-tight bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
          DeepScroll
        </div>
      </header>

      <main className="flex-1 pt-20 pb-32 px-4 flex justify-center overflow-auto items-start">
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

