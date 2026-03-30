import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Terminal, Send, History, Hash, ShieldAlert, X, ChevronRight, HelpCircle, Loader2, Trash2 } from 'lucide-react';

const ADMIN_HASH = process.env.NEXT_PUBLIC_ADMIN_HASH;
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('BOOT'); 
  const [logs, setLogs] = useState([]);
  const [inputText, setInputText] = useState('');
  const [bootProgress, setBootProgress] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const scrollRef = useRef(null);
  const adminScrollRef = useRef(null);

  // Admin state
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [adminAuthed, setAdminAuthed] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [adminPasswordError, setAdminPasswordError] = useState(false);
  const [adminAttempts, setAdminAttempts] = useState(0);
  const [adminLockedUntil, setAdminLockedUntil] = useState(null);
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminNow, setAdminNow] = useState(Date.now());
  const [deletingId, setDeletingId] = useState(null);
  const [seeding, setSeeding] = useState(false);
  const [votedLogs, setVotedLogs] = useState([]);
  const [vouchingId, setVouchingId] = useState(null);
  const [moderationError, setModerationError] = useState('');

  const appId = process.env.NEXT_PUBLIC_APP_ID || 'vehicle-node-414';

  useEffect(() => {
    let userId = localStorage.getItem('node414_user_id');
    if (!userId) {
      userId = `anon_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
      localStorage.setItem('node414_user_id', userId);
    }
    setUser({ id: userId });
    try {
      const stored = localStorage.getItem('node414_voted_logs');
      if (stored) setVotedLogs(JSON.parse(stored));
    } catch (_) {}
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
          } else if (payload.eventType === 'DELETE') {
            setLogs(current => current.filter(log => log.id !== payload.old.id));
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

  const moderateContent = async (text) => {
    try {
      const response = await fetch('/api/moderate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      return data || { flagged: false };
    } catch (_) {
      return { flagged: false };
    }
  };

  const handleAddLog = async () => {
    if (!inputText.trim() || !user || isTransmitting) return;
    setIsTransmitting(true);
    setModerationError('');
    try {
      const modResult = await moderateContent(inputText);
      if (modResult.flagged) {
        setModerationError('CONTENT_REJECTED: MESSAGE_VIOLATES_COMMUNITY_STANDARDS');
        setIsTransmitting(false);
        return;
      }
      const { error } = await supabase
        .from('logs')
        .insert([{ text: inputText, app_id: appId, upvotes: 0, author_id: user.id, created_at: new Date().toISOString() }]);
      if (error) return;
      setInputText('');
      setModerationError('');
      setView('READ');
    } catch (_) {
    } finally {
      setIsTransmitting(false);
    }
  };

  const upvoteLog = async (logId) => {
    if (!user || votedLogs.includes(logId) || vouchingId === logId) return;
    setVouchingId(logId);
    try {
      const { data: currentLog, error: fetchError } = await supabase
        .from('logs').select('upvotes').eq('id', logId).single();
      if (fetchError) return;
      const { error } = await supabase
        .from('logs').update({ upvotes: (currentLog.upvotes || 0) + 1 }).eq('id', logId);
      if (!error) {
        const next = [...votedLogs, logId];
        setVotedLogs(next);
        localStorage.setItem('node414_voted_logs', JSON.stringify(next));
      }
    } catch (_) {
    } finally {
      setVouchingId(null);
    }
  };

  // Detect /admin path client-side
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.pathname.startsWith('/admin')) {
      setIsAdminMode(true);
    }
  }, []);

  // Lockout countdown ticker
  useEffect(() => {
    if (!adminLockedUntil) return;
    const timer = setInterval(() => setAdminNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [adminLockedUntil]);

  const adminIsLocked = adminLockedUntil && adminNow < adminLockedUntil;
  const adminRemainingSeconds = adminIsLocked ? Math.ceil((adminLockedUntil - adminNow) / 1000) : 0;

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (adminIsLocked || adminChecking) return;
    setAdminChecking(true);
    try {
      const hash = await hashPassword(adminPasswordInput);
      if (hash === ADMIN_HASH) {
        setAdminAuthed(true);
        setAdminAttempts(0);
        setAdminPasswordError(false);
      } else {
        const next = adminAttempts + 1;
        setAdminAttempts(next);
        setAdminPasswordError(true);
        setAdminPasswordInput('');
        if (next >= MAX_ATTEMPTS) {
          setAdminLockedUntil(Date.now() + LOCKOUT_MS);
          setAdminAttempts(0);
        }
      }
    } finally {
      setAdminChecking(false);
    }
  };

  const deleteLog = async (logId) => {
    setDeletingId(logId);
    try {
      const { error } = await supabase.from('logs').delete().eq('id', logId);
      if (!error) setLogs(current => current.filter(log => log.id !== logId));
    } catch (_) {
    } finally {
      setDeletingId(null);
    }
  };

  const seedDatabase = async () => {
    setSeeding(true);
    try {
      const now = Date.now();
      const h = 60 * 60 * 1000;
      const m = 60 * 1000;
      const seeds = [
        { text: "whoever was just in here before me left the door unlocked lol", upvotes: 47, created_at: new Date(now - 12 * h).toISOString() },
        { text: "nah why does this feel like i wasn't the first one reading this tonight", upvotes: 23, created_at: new Date(now - 9 * h).toISOString() },
        { text: "driver hasn't said a word the whole ride. kinda respect it", upvotes: 31, created_at: new Date(now - 7 * h).toISOString() },
        { text: "someone said don't sit on the right side\u2026 i'm on the right side", upvotes: 15, created_at: new Date(now - 5 * h).toISOString() },
        { text: "this is way more interesting than my conversation rn", upvotes: 52, created_at: new Date(now - 3 * h).toISOString() },
        { text: "i feel like people are leaving messages for each other but missing every time", upvotes: 8, created_at: new Date(now - 90 * m).toISOString() },
        { text: "if you're reading this later\u2014yes it was loud as hell on grand river tonight", upvotes: 19, created_at: new Date(now - 20 * m).toISOString() },
        { text: "3 min ago: 'don't open this'\nyeah ok", upvotes: 6, created_at: new Date(now - 3 * m).toISOString() },
      ];
      await supabase.from('logs').delete().eq('app_id', appId);
      await supabase.from('logs').insert(seeds.map(s => ({ ...s, app_id: appId, author_id: 'seed_system' })));
      const { data } = await supabase.from('logs').select('*').eq('app_id', appId).order('created_at', { ascending: false });
      setLogs(data || []);
    } catch (_) {
    } finally {
      setSeeding(false);
    }
  };

  const observeAdminLogs = useCallback(() => {
    const container = adminScrollRef.current;
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
    if (adminAuthed) {
      const cleanup = observeAdminLogs();
      return cleanup;
    }
  }, [adminAuthed, logs, observeAdminLogs]);

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
    if (view === 'READ') {
      const cleanup = observeLogs();
      return cleanup;
    }
  }, [view, logs, observeLogs]);

  const CRTOverlay = () => (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,4px_100%]" />
      <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_70%,rgba(0,0,0,0.4)_100%)]" />
    </div>
  );

  if (isAdminMode) {
    const CRTOverlayAdmin = () => (
      <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden select-none">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.05)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_4px,4px_100%]" />
        <div className="absolute inset-0 bg-[radial-gradient(rgba(18,16,16,0)_70%,rgba(0,0,0,0.4)_100%)]" />
      </div>
    );

    if (!adminAuthed) {
      return (
        <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono flex flex-col justify-center items-center p-8">
          <CRTOverlayAdmin />
          <div className="w-full max-w-xs space-y-6 relative z-10">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Hash size={20} className="terminal-glow" />
                <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414</h1>
              </div>
              <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold">SECURE_ACCESS</span>
            </div>
            <form onSubmit={handleAdminLogin} className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] uppercase tracking-[0.3em] font-bold text-green-400">AUTH_KEY</label>
                <input
                  type="password"
                  autoFocus
                  value={adminPasswordInput}
                  onChange={(e) => { setAdminPasswordInput(e.target.value); setAdminPasswordError(false); }}
                  disabled={adminIsLocked || adminChecking}
                  className="w-full bg-[#080808] border-2 border-green-900 focus:border-[#4ade80] p-4 text-[#4ade80] font-mono text-sm outline-none rounded-none disabled:opacity-40 disabled:cursor-not-allowed"
                  placeholder="••••••••"
                />
                {adminIsLocked && (
                  <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">
                    LOCKED — {Math.floor(adminRemainingSeconds / 60)}:{String(adminRemainingSeconds % 60).padStart(2, '0')} REMAINING
                  </p>
                )}
                {!adminIsLocked && adminPasswordError && (
                  <p className="text-red-500 text-[10px] uppercase tracking-widest font-bold">
                    ACCESS_DENIED — {MAX_ATTEMPTS - adminAttempts} ATTEMPTS REMAINING
                  </p>
                )}
              </div>
              <button
                type="submit"
                disabled={adminIsLocked || adminChecking}
                className="w-full bg-[#4ade80] text-black py-4 font-black uppercase text-xs tracking-[0.4em] hover:brightness-110 active:scale-95 transition-all disabled:bg-green-950 disabled:text-green-900 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {adminChecking ? <><Loader2 size={14} className="animate-spin" /> VERIFYING...</> : 'AUTHENTICATE'}
              </button>
            </form>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-[#050505] text-[#4ade80] font-mono p-4 flex flex-col relative overflow-hidden selection:bg-[#4ade80] selection:text-black">
        <CRTOverlayAdmin />
        <div className="max-w-md mx-auto w-full flex-1 flex flex-col relative z-10 min-h-0">
          <div className="flex justify-between items-start mb-8 pt-2">
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <Hash size={20} className="text-[#4ade80] terminal-glow" />
                <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414</h1>
              </div>
              <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold mt-1">ROOT_CONSOLE</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-2 border border-green-900 text-[9px] text-green-700 font-bold tracking-[0.2em] uppercase">
                <ShieldAlert size={12} />
                <span className="text-green-400">ROOT_ACCESS</span>
              </div>
              <button onClick={() => setAdminAuthed(false)} className="text-red-500/60 border border-red-900/40 px-3 py-2 text-[9px] hover:bg-red-900/20 transition-all uppercase tracking-widest font-bold">LOGOUT</button>
            </div>
          </div>
          <div className="flex justify-between items-center mb-6 text-[10px] font-bold">
            <span className="opacity-60 uppercase tracking-widest">{logs.length} RECORDS_ONLINE</span>
            <button
              onClick={seedDatabase}
              disabled={seeding}
              className="flex items-center gap-1 border border-yellow-900/60 px-3 py-1 bg-yellow-950/20 text-yellow-500/70 hover:text-yellow-400 hover:border-yellow-500/60 transition-all disabled:opacity-40 text-[9px] uppercase tracking-widest font-bold"
            >
              {seeding && <Loader2 size={10} className="animate-spin" />}
              {seeding ? 'SEEDING...' : 'SEED_DB'}
            </button>
          </div>
          <div ref={adminScrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar pr-1 pb-8">
            {logs.map((log) => (
              <div key={log.id} className="log-entry border-l-4 border-green-900/60 pl-6 py-4 space-y-4 bg-green-950/5">
                <div className="flex justify-between items-center text-[10px] font-bold text-green-400 uppercase tracking-widest">
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
                <p className="text-[9px] uppercase tracking-widest"><span className="text-[#22c55e] terminal-glow">ID: {log.id}</span> <span className="text-green-400">• AUTH: {log.author_id?.substring(0, 12)}...</span></p>
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
  }

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
        <div className="fixed inset-0 z-[60] bg-black/98 p-6 flex flex-col justify-center">
          <div className="bg-[#050505] border-2 border-[#4ade80] p-6 space-y-6 relative shadow-[0_0_20px_rgba(34,197,94,0.1)] max-w-md mx-auto w-full">
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

      <div className="max-w-md mx-auto w-full flex-1 flex flex-col relative z-10 min-h-0">
        <div className="flex justify-between items-start mb-8 pt-2">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Hash size={20} className="text-[#4ade80] terminal-glow" />
              <h1 className="text-2xl font-black tracking-tighter italic terminal-glow">NODE_414 // ACTIVE</h1>
              {!user && <Loader2 size={16} className="animate-spin opacity-50" />}
            </div>
            <div className="flex gap-3 mt-1">
              <span className="text-[10px] opacity-60 uppercase tracking-[0.3em] font-bold">SECTOR: LANSING</span>
              <span className="text-[10px] opacity-30 uppercase tracking-[0.3em] font-bold">PUBLIC LOG STREAM</span>
            </div>
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
                <span className="text-green-400">USER_AUTH: {user?.id?.substring(0, 8)}</span>
              </div>
            </div>
          </div>
        )}

        {view === 'READ' && (
          <div className="flex-1 flex flex-col animate-in fade-in slide-in-from-right-6 duration-300 overflow-hidden min-h-0">
            <div className="flex justify-between items-center mb-6 text-[10px] font-bold">
              <button onClick={() => setView('MENU')} className="text-[#4ade80] border border-green-900 px-4 py-1.5 hover:bg-green-900/30 transition-all uppercase tracking-widest">[ BACK ]</button>
              <span className="opacity-60 uppercase tracking-widest">{logs.length} RECORDS_ONLINE</span>
            </div>
            <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto space-y-6 custom-scrollbar pr-1 pb-24">
              {logs.map((log) => (
                <div key={log.id} className="log-entry border-l-4 border-green-900/60 pl-6 py-4 space-y-4 bg-green-950/5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-green-400 uppercase tracking-widest">
                    <span>STAMP: {log.created_at ? new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : 'SYNCING'}</span>
                    <button
                      onClick={() => upvoteLog(log.id)}
                      disabled={votedLogs.includes(log.id) || vouchingId === log.id}
                      className={`flex items-center gap-2 transition-all border px-3 py-1 ${
                        votedLogs.includes(log.id)
                          ? 'text-[#22c55e] border-[#22c55e]/60 bg-green-950/50 cursor-default shadow-[0_0_8px_rgba(34,197,94,0.3)]'
                          : vouchingId === log.id
                          ? 'text-[#22c55e] border-[#22c55e]/40 bg-green-950/30 animate-pulse'
                          : 'hover:text-[#22c55e] border-green-800/60 bg-green-950/20 text-green-400'
                      }`}
                    >
                      {vouchingId === log.id ? (
                        <><Loader2 size={10} className="animate-spin" /> VOUCHING...</>
                      ) : votedLogs.includes(log.id) ? (
                        <>✓ VOUCHED: {log.upvotes || 0}</>
                      ) : (
                        <>[ VOUCH: {log.upvotes || 0} ]</>
                      )}
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
              <div className="text-[10px] text-green-400 uppercase tracking-[0.3em] font-black">
                {"> ESTABLISHING_ANONYMOUS_UPLINK..."}
              </div>
              {moderationError && (
                <div className="bg-red-950/30 border border-red-900/60 p-4 text-red-400 text-[10px] uppercase tracking-widest font-bold animate-pulse">
                  {moderationError}
                </div>
              )}
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
