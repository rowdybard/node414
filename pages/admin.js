import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Hash, ShieldAlert, Trash2, Loader2 } from 'lucide-react';

const ADMIN_PASSWORD = 'Getit123!';

const Admin = () => {
  const [authed, setAuthed] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);
  const [logs, setLogs] = useState([]);
  const [deletingId, setDeletingId] = useState(null);
  const scrollRef = useRef(null);

  const appId = process.env.NEXT_PUBLIC_APP_ID || 'vehicle-node-414';

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthed(true);
      setPasswordError(false);
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

  useEffect(() => {
    if (!authed) return;

    const fetchLogs = async () => {
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .eq('app_id', appId)
        .order('created_at', { ascending: false });
      if (!error) setLogs(data || []);
    };

    fetchLogs();

    const channel = supabase
      .channel('admin_logs_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'logs', filter: `app_id=eq.${appId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setLogs(current => [payload.new, ...current]);
          } else if (payload.eventType === 'UPDATE') {
            setLogs(current => current.map(log => log.id === payload.new.id ? payload.new : log));
          } else if (payload.eventType === 'DELETE') {
            setLogs(current => current.filter(log => log.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [authed, appId]);

  const observeLogs = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;
    const entries = container.querySelectorAll('.log-entry');
    const observer = new IntersectionObserver(
      (observed) => {
        observed.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.remove('hidden');
            entry.target.classList.add('visible');
          } else {
            entry.target.classList.remove('visible');
            entry.target.classList.add('hidden');
          }
        });
      },
      { root: container, threshold: 0.15 }
    );
    entries.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [logs]);

  useEffect(() => {
    if (authed) {
      const cleanup = observeLogs();
      return cleanup;
    }
  }, [authed, logs, observeLogs]);

  const deleteLog = async (logId) => {
    setDeletingId(logId);
    try {
      const { error } = await supabase
        .from('logs')
        .delete()
        .eq('id', logId);
      if (!error) {
        setLogs(current => current.filter(log => log.id !== logId));
      }
    } catch (_) {
    } finally {
      setDeletingId(null);
    }
  };

  const CRTOverlay = () => (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,4px_100%]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_70%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );

  if (!authed) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono flex flex-col justify-center items-center p-8">
        <CRTOverlay />
        <div className="w-full max-w-xs space-y-6 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Hash size={20} className="terminal-glow" />
              <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414</h1>
            </div>
            <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold">ADMIN_ACCESS</span>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-green-700">AUTH_KEY</label>
              <input
                type="password"
                autoFocus
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                className="w-full bg-[#080808] border-2 border-green-900 focus:border-[#4ade80] p-4 text-[#4ade80] font-mono text-sm outline-none rounded-none"
                placeholder="••••••••"
              />
              {passwordError && (
                <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">ACCESS_DENIED</p>
              )}
            </div>
            <button
              type="submit"
              className="w-full bg-[#4ade80] text-black py-4 font-black uppercase text-xs tracking-[0.4em] hover:brightness-110 active:scale-95 transition-all"
            >
              AUTHENTICATE
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono p-4 flex flex-col relative overflow-hidden selection:bg-[#4ade80] selection:text-black">
      <CRTOverlay />
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col relative z-10 min-h-0">
        <div className="flex justify-between items-start mb-8 pt-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Hash size={20} className="text-[#4ade80] terminal-glow" />
              <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414</h1>
            </div>
            <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold mt-1">ADMIN_CONSOLE</span>
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-2 border border-green-900 rounded-sm text-[9px] text-green-700 font-bold tracking-[0.2em] uppercase">
            <ShieldAlert size={12} />
            <span>ROOT_ACCESS</span>
          </div>
        </div>

        <div className="flex justify-between items-center mb-6 text-[10px] font-bold">
          <span className="opacity-60 uppercase tracking-widest">{logs.length} RECORDS_ONLINE</span>
          <button
            onClick={() => setAuthed(false)}
            className="text-red-500/60 border border-red-900/40 px-4 py-1.5 hover:bg-red-900/20 transition-all uppercase tracking-widest"
          >
            [ LOGOUT ]
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar pr-1 pb-8">
          {logs.map((log) => (
            <div key={log.id} className="log-entry border-l-4 border-green-900/60 pl-6 py-4 space-y-4 bg-green-950/5">
              <div className="flex justify-between items-center text-[10px] font-bold text-green-700 uppercase tracking-widest">
                <span>STAMP: {log.created_at ? new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'SYNCING'}</span>
                <div className="flex items-center gap-2">
                  <span className="border border-green-900/40 px-3 py-1 bg-green-950/20">VOUCH: {log.upvotes || 0}</span>
                  <button
                    onClick={() => deleteLog(log.id)}
                    disabled={deletingId === log.id}
                    className="flex items-center gap-1 border border-red-900/60 px-3 py-1 bg-red-950/20 text-red-500/70 hover:text-red-400 hover:border-red-500/60 hover:bg-red-950/40 transition-all disabled:opacity-40"
                  >
                    {deletingId === log.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                    DELETE
                  </button>
                </div>
              </div>
              <p className="text-lg leading-relaxed text-green-50 font-medium terminal-glow">{log.text}</p>
              <p className="text-[9px] text-green-900 uppercase tracking-widest">ID: {log.id} • AUTH: {log.author_id?.substring(0, 12)}...</p>
            </div>
          ))}
          {logs.length === 0 && (
            <div className="text-center py-20 opacity-30 text-sm italic tracking-[0.3em] uppercase font-bold">
              -- NO_DATA_STREAM_DETECTED --
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
