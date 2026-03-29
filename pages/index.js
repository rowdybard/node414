import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
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

  useEffect(() => {
    setUser({ id: `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}` });
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!user || isLoading) return;

    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .eq('app_id', appId)
          .order('created_at', { ascending: false });

        if (error) return;
        setLogs(data || []);
      } catch (_) {}
    };

    fetchLogs();

    const channel = supabase
      .channel('logs_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'logs', filter: `app_id=eq.${appId}` }, 
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLogs(current => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setLogs(current => current.map(log => log.id === payload.new.id ? payload.new : log));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, appId, isLoading]);

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
        .insert([{ text: inputText, app_id: appId, upvotes: 0, author_id: user.id, created_at: new Date().toISOString() }]);
      if (error) return;
      setInputText('');
      setView('READ');
    } catch (_) {
    } finally {
      setIsTransmitting(false);
    }
  };

  const upvoteLog = async (logId) => {
    if (!user) return;
    try {
      const { data: currentLog, error: fetchError } = await supabase
        .from('logs').select('upvotes').eq('id', logId).single();
      if (fetchError) return;
      await supabase
        .from('logs').update({ upvotes: (currentLog.upvotes || 0) + 1 }).eq('id', logId);
    } catch (_) {}
  };

  const CRTOverlay = () => (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,4px_100%]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_70%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );

  if (isLoading || view === 'BOOT') {
    return (
      <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono p-8 flex flex-col justify-center items-center">
        <CRTOverlay />
        <div className="w-full max-w-xs space-y-6">
          <div className="text-sm font-bold animate-pulse text-center h-4 tracking-[0.2em] terminal-glow">
            {bootProgress < 30 ? "> INITIALIZING_NODE..." : 
             bootProgress < 70 ? "> SYNCING_LOG_STREAM..." :
             "> NODE_414_ONLINE"}
          </div>
          <div className="h-2 w-full border border-green-900 bg-green-950/20">
            <div className="h-full bg-[#4ade80] shadow-[0_0_15px_#22c55e]" style={{ width: `${bootProgress}%` }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono p-4 flex flex-col relative overflow-hidden selection:bg-[#4ade80] selection:text-black">
      <CRTOverlay />
      
      {showHelp && (
        <div className="fixed inset-0 z-[60] bg-black/98 p-6 flex flex-col justify-center animate-in fade-in zoom-in duration-200">
          <div className="border-2 border-[#4ade80] p-6 space-y-6 relative shadow-[0_0_20px_rgba(34,197,94,0.1)]">
            <button onClick={() => setShowHelp(false)} className="absolute top-2 right-2 p-2 hover:text-white"><X size={24}/></button>
            <h2 className="text-2xl font-black border-b border-green-900 pb-3 tracking-tighter uppercase terminal-glow">SYSTEM_MANUAL</h2>
            <div className="text-sm leading-relaxed opacity-90 space-y-4">
              <p>Welcome to <span className="text-white font-bold">Node 414</span>.</p>
              <p>You are accessing a localized digital archive. This data is persistent and anonymous.</p>
              <div className="bg-green-950/30 p-4 border-l-2 border-[#4ade80]">
                <p className="text-xs">• <span className="text-white font-bold">ACCESS:</span> Read the history of this seat.</p>
                <p className="text-xs mt-2">• <span className="text-white font-bold">APPEND:</span> Leave a trace for the next rider.</p>
              </div>
            </div>
            <button onClick={() => setShowHelp(false)} className="w-full bg-[#4ade80] text-black font-black py-4 mt-4 uppercase text-xs tracking-widest hover:brightness-110 active:scale-95 transition-all">CLOSE_MANUAL</button>
          </div>
        </div>
      )}

      <div className="max-w-md mx-auto w-full flex-1 flex flex-col relative z-10">
        <div className="flex justify-between items-start mb-8 pt-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Hash size={20} className="text-[#4ade80] terminal-glow" />
              <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414</h1>
              {!user && <Loader2 size={16} className="animate-spin opacity-50" />}
            </div>
            <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold mt-1">LANSING_SECTOR_MOBILE</span>
          </div>
          <button onClick={() => setShowHelp(true)} className="p-3 border border-green-900 hover:border-[#4ade80] hover:bg-green-900/20 transition-all rounded-sm">
            <HelpCircle size={20} />
          </button>
        </div>

        {view === 'MENU' && (
          <div className="flex-1 flex flex-col justify-center space-y-5 animate-in fade-in slide-in-from-bottom-6 duration-500">
            <button onClick={() => setView('READ')} className="flex items-center justify-between border-2 border-[#4ade80] p-8 hover:bg-[#4ade80] hover:text-black transition-all group active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.05)]">
              <div className="flex items-center gap-5">
                <History size={32} />
                <span className="text-2xl font-black uppercase tracking-tight">Access_Logs</span>
              </div>
              <ChevronRight className="group-hover:translate-x-2 transition-transform" size={28} />
            </button>
            <button onClick={() => setView('WRITE')} className="flex items-center justify-between border-2 border-[#4ade80] p-8 hover:bg-[#4ade80] hover:text-black transition-all group active:scale-95 shadow-[0_0_15px_rgba(34,197,94,0.05)]">
              <div className="flex items-center gap-5">
                <Terminal size={32} />
                <span className="text-2xl font-black uppercase tracking-tight">Append_Data</span>
              </div>
              <ChevronRight className="group-hover:translate-x-2 transition-transform" size={28} />
            </button>
            <div className="pt-12 flex flex-col items-center gap-4">
              <div className="inline-flex items-center gap-2 px-4 py-2 border border-green-900 rounded-sm text-[9px] text-green-700 font-bold tracking-[0.2em] uppercase">
                <ShieldAlert size={12} />
                <span>USER_AUTH: {user?.id?.substring(0, 8)}</span>
              </div>
            </div>
          </div>
        )}

        {view === 'READ' && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-6 duration-300 overflow-hidden">
            <div className="flex justify-between items-center mb-6 text-[10px] font-bold">
              <button onClick={() => setView('MENU')} className="text-[#4ade80] border border-green-900 px-4 py-1.5 hover:bg-green-900/30 transition-all uppercase tracking-widest">[ BACK ]</button>
              <span className="opacity-60 uppercase tracking-widest">{logs.length} RECORDS_ONLINE</span>
            </div>
            <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pr-1 pb-24">
              {logs.map((log) => (
                <div key={log.id} className="border-l-4 border-green-900/60 pl-6 py-4 space-y-4 bg-green-950/5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-green-700 uppercase tracking-widest">
                    <span>STAMP: {log.created_at ? new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'SYNCING'}</span>
                    <button onClick={() => upvoteLog(log.id)} className="flex items-center gap-2 hover:text-[#4ade80] transition-colors border border-green-900/40 px-3 py-1 bg-green-950/20">
                      [ VOUCH: {log.upvotes || 0} ]
                    </button>
                  </div>
                  <p className="text-lg leading-relaxed text-green-50 font-medium terminal-glow">{log.text}</p>
                </div>
              ))}
              {logs.length === 0 && (
                <div className="text-center py-20 opacity-30 text-sm italic tracking-[0.3em] uppercase font-bold">
                  -- NO_DATA_STREAM_DETECTED --
                </div>
              )}
            </div>
            <div className="fixed bottom-6 left-4 right-4 max-w-md mx-auto z-20">
              <button onClick={() => setView('WRITE')} className="w-full bg-[#4ade80] text-black py-6 font-black uppercase text-sm tracking-[0.4em] shadow-[0_0_40px_rgba(34,197,94,0.3)] hover:brightness-110 active:scale-95 transition-all">
                + APPEND_MY_TRACE
              </button>
            </div>
          </div>
        )}

        {view === 'WRITE' && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-top-6 duration-300">
            <button onClick={() => setView('MENU')} className="text-xs text-[#4ade80] mb-8 hover:text-white transition-colors font-bold uppercase tracking-[0.2em]">[ ABORT_ENTRY ]</button>
            <div className="flex-1 flex flex-col gap-6">
              <div className="text-[10px] text-green-700 uppercase tracking-[0.3em] font-black">
                {"> ESTABLISHING_ANONYMOUS_UPLINK..."}
              </div>
              <textarea 
                autoFocus
                className="flex-1 w-full bg-[#080808] border-2 border-green-900 p-6 text-[#4ade80] focus:outline-none focus:border-[#4ade80] font-mono text-lg leading-relaxed resize-none rounded-none placeholder:text-green-950 terminal-glow"
                placeholder="Leave a secret, a joke, or advice for the next person..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={isTransmitting}
              />
              <button 
                onClick={handleAddLog}
                disabled={isTransmitting || !inputText.trim()}
                className="w-full flex items-center justify-center gap-4 bg-[#4ade80] text-black py-8 font-black disabled:bg-green-950 disabled:text-green-900 transition-all uppercase tracking-[0.4em] text-sm shadow-[0_0_30px_rgba(34,197,94,0.2)]"
              >
                {isTransmitting ? <Loader2 size={24} className="animate-spin" /> : <Send size={24} />}
                {isTransmitting ? 'TRANSMITTING...' : 'CONFIRM_TRACE'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
