import React, { useState, useEffect } from 'react';
import { supabase, initializeDatabase } from '../lib/supabase';
import { Terminal, Send, History, Hash, ShieldAlert, X, ChevronRight, HelpCircle, Loader2 } from 'lucide-react';

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('BOOT'); 
  const [logs, setLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [bootProgress, setBootProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const appId = process.env.NEXT_PUBLIC_APP_ID || 'vehicle-node-414';

  // 1. AUTHENTICATION & DATABASE INITIALIZATION
  useEffect(() => {
    const initAuth = async () => {
      try {
        // Initialize database
        await initializeDatabase();
        
        // Skip authentication entirely and use anonymous user
        setUser({ id: `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` });
        
      } catch (error) {
        // Fallback to temporary user - suppress console errors
        setUser({ id: `temp_${Date.now()}` });
      } finally {
        setIsLoading(false);
      }
    };

    initAuth();
  }, []);

  // 2. DATA FETCHING
  useEffect(() => {
    if (!user || isLoading) return;

    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .eq('app_id', appId)
          .order('created_at', { ascending: false });

        if (error) {
          console.error("Fetch error:", error);
          return;
        }

        setLogs(data || []);
      } catch (error) {
        console.error("Unexpected fetch error:", error);
      }
    };

    fetchLogs();

    // Set up real-time subscription
    const channel = supabase
      .channel('logs_changes')
      .on('postgres_changes', 
        { 
          event: '*', 
          schema: 'public', 
          table: 'logs',
          filter: `app_id=eq.${appId}`
        }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLogs(current => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setLogs(current => 
              current.map(log => 
                log.id === payload.new.id ? payload.new : log
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, appId, isLoading]);

  // 3. BOOT SEQUENCE (PRESERVED EXACTLY)
  useEffect(() => {
    if (view === 'BOOT') {
      const interval = setInterval(() => {
        setBootProgress(prev => {
          if (prev >= 100) {
            clearInterval(interval);
            setTimeout(() => setView('MENU'), 600);
            return 100;
          }
          return prev + Math.floor(Math.random() * 15) + 5;
        });
      }, 80);
      return () => clearInterval(interval);
    }
  }, [view]);

  const handleAddLog = async (e) => {
    e.preventDefault();
    if (!inputText.trim() || !user || isTransmitting) return;
    
    setIsTransmitting(true);
    try {
      const { error } = await supabase
        .from('logs')
        .insert([
          {
            text: inputText,
            app_id: appId,
            upvotes: 0,
            author_id: user.id,
            created_at: new Date().toISOString()
          }
        ]);

      if (error) {
        console.error("Transmission Failed:", error);
        return;
      }

      setInputText('');
      setView('READ');
    } catch (error) {
      console.error("Unexpected transmission error:", error);
    } finally {
      setIsTransmitting(false);
    }
  };

  const upvoteLog = async (logId) => {
    if (!user) return;
    try {
      // First get the current upvote count
      const { data: currentLog, error: fetchError } = await supabase
        .from('logs')
        .select('upvotes')
        .eq('id', logId)
        .single();

      if (fetchError) {
        console.error("Fetch failed:", fetchError);
        return;
      }

      // Then update with incremented value
      const { error } = await supabase
        .from('logs')
        .update({ upvotes: (currentLog.upvotes || 0) + 1 })
        .eq('id', logId);

      if (error) {
        console.error("Vouch failed:", error);
      }
    } catch (error) {
      console.error("Unexpected vouch error:", error);
    }
  };

  // --- UI COMPONENTS (PRESERVED EXACTLY) ---
  const CRTOverlay = () => (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.1)_50%),linear-gradient(90deg,rgba(255,0,0,0.03),rgba(0,255,0,0.01),rgba(0,0,255,0.03))] bg-[length:100%_3px,3px_100%]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_60%,rgba(0,0,0,0.3)_100%)]" />
    </div>
  );

  // Show loading during initial boot
  if (isLoading || view === 'BOOT') {
    return (
      <div className="min-h-screen bg-black text-green-500 font-mono p-8 flex flex-col justify-center items-center">
        <CRTOverlay />
        <div className="w-full max-w-xs space-y-4">
          <div className="text-xs animate-pulse text-center h-4">
            {bootProgress < 30 ? "> MOUNTING CLOUD_NODE..." : 
             bootProgress < 70 ? "> SYNCHRONIZING_DATA..." :
             "> CONNECTION STABLE."}
          </div>
          <div className="h-2 w-full border border-green-900">
            <div className="h-full bg-green-500 transition-all duration-100" style={{ width: `${bootProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-green-500 font-mono p-4 flex flex-col relative overflow-hidden">
      <CRTOverlay />
      
      {showHelp && (
        <div className="fixed inset-0 z-[60] bg-black/95 p-6 flex flex-col justify-center animate-fade-in animate-zoom-in duration-200">
          <div className="border border-green-500 p-6 space-y-4 relative">
            <button onClick={() => setShowHelp(false)} className="absolute top-2 right-2 p-2"><X size={20}/></button>
            <h2 className="text-xl font-bold border-b border-green-900 pb-2 tracking-tighter uppercase">Operations Manual</h2>
            <p className="text-sm leading-relaxed opacity-80">
              Welcome to the local network for <span className="text-green-400">Node 414</span>.
              <br/><br/>
              This is a persistent digital logbook. You are reading real messages left by people who sat in this car before you.
              <br/><br/>
              • <span className="text-white">ACCESS:</span> Review historical data.
              <br/>
              • <span className="text-white">APPEND:</span> Leave your own anonymous mark.
            </p>
            <button onClick={() => setShowHelp(false)} className="w-full bg-green-500 text-black font-bold py-3 mt-4 uppercase text-sm">Return to Node</button>
          </div>
        </div>
      )}

      <div className="max-w-lg mx-auto w-full flex-1 flex flex-col relative z-10 px-2">
        <div className="flex justify-between items-start mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-2 text-green-300">
              <Hash size={18} />
              <h1 className="text-2xl md:text-lg font-black tracking-tighter text-white">NODE_414</h1>
              {!user && <Loader2 size={14} className="animate-spin opacity-50" />}
            </div>
            <span className="text-sm md:text-[9px] opacity-60 uppercase tracking-[0.2em] text-green-200">Lansing Sector • Mobile Unit</span>
          </div>
          <button onClick={() => setShowHelp(true)} className="p-2 border border-green-900 hover:border-green-400 transition-colors">
            <HelpCircle size={18} />
          </button>
        </div>

        {view === 'MENU' && (
          <div className="flex-1 flex flex-col justify-center space-y-4 animate-fade-in animate-slide-in-from-bottom-4">
            <button onClick={() => setView('READ')} className="flex items-center justify-between border-2 border-green-500 p-6 hover:bg-green-500 hover:text-black transition-all group active:scale-95">
              <div className="flex items-center gap-4">
                <History size={24} />
                <span className="text-xl font-bold uppercase tracking-tight">Access Logs</span>
              </div>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button onClick={() => setView('WRITE')} className="flex items-center justify-between border-2 border-green-500 p-6 hover:bg-green-500 hover:text-black transition-all group active:scale-95">
              <div className="flex items-center gap-4">
                <Terminal size={24} />
                <span className="text-xl font-bold uppercase tracking-tight">Append Data</span>
              </div>
              <ChevronRight className="group-hover:translate-x-1 transition-transform" />
            </button>
            <div className="pt-8 flex flex-col items-center gap-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 border border-green-900 rounded-full text-[9px] text-green-800 tracking-widest">
                <ShieldAlert size={10} />
                <span>USER_ID: {user?.id?.substring(0, 8)}...</span>
              </div>
            </div>
          </div>
        )}

        {view === 'READ' && (
          <div className="flex-1 flex flex-col animate-fade-in animate-slide-in-from-right-4 duration-300 overflow-hidden">
            <div className="flex justify-between items-center mb-4 text-base md:text-[10px] opacity-70">
              <button onClick={() => setView('MENU')} className="hover:underline text-green-300 font-bold">[ BACK ]</button>
              <span>{logs.length} RECORDS FOUND</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-1">
              {logs.map((log) => (
                <div key={log.id} className="border border-green-900/40 p-4 space-y-3 bg-green-950/5">
                  <div className="flex justify-between items-center text-base md:text-[9px] opacity-60 text-green-200">
                    <span>
                      {log.created_at ? 
                        new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 
                        'PENDING...'
                      }
                    </span>
                    <button onClick={() => upvoteLog(log.id)} className="flex items-center gap-1 hover:text-green-300 transition-colors text-green-100">
                      [ VOUCH: {log.upvotes || 0} ]
                    </button>
                  </div>
                  <p className="text-lg md:text-sm leading-relaxed text-white font-medium">{log.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 pb-2">
              <button onClick={() => setView('WRITE')} className="w-full bg-green-500 text-black py-4 font-bold uppercase text-sm tracking-widest hover:bg-green-400 active:scale-95 transition-all">
                + Append My Data
              </button>
            </div>
          </div>
        )}

        {view === 'WRITE' && (
          <div className="flex-1 flex flex-col animate-fade-in animate-slide-in-from-top-4 duration-300">
            <button onClick={() => setView('MENU')} className="text-base md:text-[10px] text-green-300 mb-6 hover:underline">[ ABORT_ENTRY ]</button>
            <div className="flex-1 flex flex-col gap-4">
              <textarea 
                autoFocus
                className="flex-1 w-full bg-black border-2 border-green-400 p-4 text-green-100 focus:outline-none focus:ring-2 focus:ring-green-300 font-mono text-lg md:text-sm leading-relaxed"
                placeholder="Leave a secret, a joke, or advice for the next person..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTransmitting}
              />
              <button 
                onClick={handleAddLog}
                disabled={isTransmitting || !inputText.trim()}
                className="w-full flex items-center justify-center gap-2 bg-green-400 text-black py-4 font-bold disabled:bg-green-800 disabled:text-green-600 transition-all uppercase tracking-widest text-lg md:text-sm"
              >
                {isTransmitting ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                {isTransmitting ? 'Transmitting...' : 'Confirm Transmission'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
