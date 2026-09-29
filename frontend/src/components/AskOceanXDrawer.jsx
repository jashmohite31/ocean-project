import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Bot, Send, Sparkles, X, ChevronRight, CheckCircle2,
  Waves, Zap, RotateCcw, Copy, Check, AlertTriangle,
  Eye, BarChart2, Navigation, ThermometerSun, Droplets
} from 'lucide-react';

// ─── Suggested queries ────────────────────────────────────────────────────────
const SUGGESTED_QUERIES = [
  { icon: BarChart2,     label: "Model vs Argo",       text: "Where does the numerical model differ most from Argo observations?" },
  { icon: ThermometerSun, label: "Marine Heatwaves",   text: "Are there any active marine heatwaves detected in the Arabian Sea?" },
  { icon: Droplets,      label: "Barrier Layer",        text: "Explain the subsurface salinity barrier layer in the Bay of Bengal." },
  { icon: Navigation,    label: "Strong Currents",      text: "Where are the strongest surface currents right now?" },
  { icon: AlertTriangle, label: "Anomalies",            text: "Show me all anomalous regions in the current dataset." },
  { icon: Eye,           label: "100m Temperature",     text: "Show temperature at 100m depth across the North Indian Ocean." },
];

// ─── Action → readable label mapping ─────────────────────────────────────────
const ACTION_LABELS = {
  visualize:          { icon: Eye,           color: '#0284c7', label: 'Visualize Layer' },
  compare:            { icon: BarChart2,     color: '#7c3aed', label: 'Compare Model & Argo' },
  show_anomaly_layer: { icon: AlertTriangle, color: '#d97706', label: 'Show Anomalies' },
  show_hazards:       { icon: AlertTriangle, color: '#dc2626', label: 'Show Hazards' },
  show_currents:      { icon: Navigation,    color: '#0891b2', label: 'Show Currents' },
};

// ─── Simple inline markdown renderer with high contrast ──────────────────────
function renderMarkdown(text) {
  if (!text) return null;

  const lines = text.split('\n');
  const elements = [];
  let tableBuffer = [];
  let inTable = false;

  function flushTable() {
    if (tableBuffer.length < 2) {
      tableBuffer.forEach((l, i) => elements.push(<p key={`tp${i}`} className="leading-relaxed text-slate-900 my-1 font-medium">{l}</p>));
      tableBuffer = [];
      inTable = false;
      return;
    }
    const headers = tableBuffer[0].split('|').filter(c => c.trim() !== '');
    const rows = tableBuffer.slice(2).map(r => r.split('|').filter(c => c.trim() !== ''));
    elements.push(
      <div key={`tbl${elements.length}`} className="overflow-x-auto my-2 rounded-lg border-2 border-slate-300">
        <table className="w-full text-xs">
          <thead className="bg-slate-100 border-b border-slate-300">
            <tr>{headers.map((h, i) => <th key={i} className="px-3 py-1.5 text-left font-bold text-slate-900">{h.trim()}</th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {rows.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {row.map((cell, ci) => <td key={ci} className="px-3 py-1.5 text-slate-900 font-semibold">{inlineMd(cell.trim())}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
    inTable = false;
  }

  function inlineMd(s) {
    // bold **text**
    const parts = s.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((p, i) => {
      if (p.startsWith('**') && p.endsWith('**')) {
        return <strong key={i} className="font-bold text-slate-950">{p.slice(2, -2)}</strong>;
      }
      // italic *text*
      const iparts = p.split(/(\*[^*]+\*)/g);
      return iparts.map((ip, j) =>
        ip.startsWith('*') && ip.endsWith('*') && ip.length > 2
          ? <em key={j} className="text-slate-800">{ip.slice(1, -1)}</em>
          : ip
      );
    });
  }

  lines.forEach((line, idx) => {
    // Table detection
    if (line.includes('|')) {
      if (!inTable) inTable = true;
      tableBuffer.push(line);
      return;
    } else if (inTable) {
      flushTable();
    }

    // Blockquote
    if (line.startsWith('> ')) {
      elements.push(
        <blockquote key={idx} className="border-l-4 border-[#0284c7] pl-3 my-2 text-xs sm:text-[13px] text-slate-800 italic bg-sky-50/80 py-1.5 rounded-r-lg font-medium">
          {inlineMd(line.slice(2))}
        </blockquote>
      );
      return;
    }

    // Headings
    if (line.startsWith('### ')) {
      elements.push(<h4 key={idx} className="font-bold text-slate-950 text-xs sm:text-[13px] mt-2.5 mb-1">{inlineMd(line.slice(4))}</h4>);
      return;
    }
    if (line.startsWith('## ')) {
      elements.push(<h3 key={idx} className="font-extrabold text-slate-950 text-sm mt-3 mb-1">{inlineMd(line.slice(3))}</h3>);
      return;
    }
    if (line.startsWith('# ')) {
      elements.push(<h2 key={idx} className="font-extrabold text-slate-950 text-base mt-3 mb-1.5">{inlineMd(line.slice(2))}</h2>);
      return;
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      elements.push(
        <li key={idx} className="ml-2 list-none flex gap-2 my-1 text-slate-800 text-xs sm:text-[13px] font-medium leading-relaxed">
          <span className="text-[#0284c7] font-extrabold flex-shrink-0">•</span>
          <span>{inlineMd(line.slice(2))}</span>
        </li>
      );
      return;
    }

    // Numbered list
    if (line.match(/^\d+\.\s/)) {
      const num = line.match(/^(\d+)\.\s/)[1];
      elements.push(
        <li key={idx} className="ml-2 list-none flex gap-2 my-1 text-slate-800 text-xs sm:text-[13px] font-medium leading-relaxed">
          <span className="text-[#0284c7] font-bold flex-shrink-0">{num}.</span>
          <span>{inlineMd(line.replace(/^\d+\.\s/, ''))}</span>
        </li>
      );
      return;
    }

    // Empty lines
    if (!line.trim()) {
      elements.push(<div key={idx} className="h-1.5" />);
      return;
    }

    // Plain text
    elements.push(<p key={idx} className="leading-relaxed my-1 text-slate-900 text-xs sm:text-[13px] font-medium">{inlineMd(line)}</p>);
  });

  if (inTable) flushTable();

  return <>{elements}</>;
}

// ─── Action Chip ──────────────────────────────────────────────────────────────
function ActionChip({ action, onDispatch }) {
  if (!action?.action) return null;
  const meta = ACTION_LABELS[action.action] || { icon: Eye, color: '#475569', label: action.action };
  const Icon = meta.icon;

  const buildLabel = () => {
    let label = meta.label;
    if (action.variable) label += ` · ${action.variable}`;
    if (action.depth !== undefined) label += ` @ ${action.depth}m`;
    return label;
  };

  return (
    <button
      onClick={() => onDispatch && onDispatch(action)}
      className="mt-2.5 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border-2 hover:scale-[1.02] active:scale-95 shadow-xs cursor-pointer"
      style={{
        borderColor: meta.color,
        backgroundColor: meta.color + '15',
        color: meta.color
      }}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{buildLabel()}</span>
      <ChevronRight className="w-3.5 h-3.5 opacity-70" />
    </button>
  );
}

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const handle = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  };
  return (
    <button onClick={handle} className="p-1 rounded text-slate-400 hover:text-slate-800 transition-colors cursor-pointer" title="Copy text">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// ─── Source Badge ─────────────────────────────────────────────────────────────
function SourceBadge({ source, dataSource }) {
  const isGemini = source?.includes('gemini');
  return (
    <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-200">
      <span
        className="px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 shadow-xs"
        style={{
          background: isGemini ? '#eff6ff' : '#CBF3BB',
          color: isGemini ? '#1d4ed8' : '#14532d',
          border: `1px solid ${isGemini ? '#93c5fd' : '#ABE7B2'}`
        }}
      >
        {isGemini ? <Sparkles className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
        {isGemini ? 'Gemini AI Grounded' : '3D Intelligence Grounded'}
      </span>
      {dataSource && (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1">
          <Waves className="w-3 h-3 text-[#0284c7]" />
          {dataSource}
        </span>
      )}
    </div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white w-fit border-2 border-slate-200 shadow-sm">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-[#0284c7]"
          style={{
            animation: 'oceanxBounce 1.2s ease-in-out infinite',
            animationDelay: `${i * 0.2}s`
          }}
        />
      ))}
    </div>
  );
}

// ─── Main Drawer ──────────────────────────────────────────────────────────────
export default function AskOceanXDrawer({
  isOpen,
  onClose,
  onDispatchAction,
  activeVariable = 'temperature',
  activeDepth = 0,
  activeTimeIndex = 0,
  selectedObservation = null
}) {
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 0,
      sender: 'ai',
      text: 'Hello! I\'m **OceanLense Assistant**. Ask me about ocean temperature, salinity, currents, Argo floats, or marine hazards in the North Indian Ocean.',
      source: '3D-Intelligence-Engine',
      dataSource: '3D Ocean Model',
      action: null,
    }
  ]);
  const [loading, setLoading] = useState(false);
  const [conversationHistory, setConversationHistory] = useState([]);
  const [msgIdCounter, setMsgIdCounter] = useState(1);

  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, loading]);

  // Focus input when drawer opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [isOpen]);

  const nextId = useCallback(() => {
    setMsgIdCounter(c => c + 1);
    return msgIdCounter + 1;
  }, [msgIdCounter]);

  const handleSend = useCallback(async (qText) => {
    const textToSend = (qText || query).trim();
    if (!textToSend || loading) return;

    const userMsgId = nextId();
    setMessages(prev => [...prev, { id: userMsgId, sender: 'user', text: textToSend }]);
    setQuery('');
    setLoading(true);

    try {
      const res = await fetch('/api/nlp/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: textToSend,
          conversation_history: conversationHistory,
          context: {
            active_variable: activeVariable,
            active_depth: activeDepth,
            active_time_index: activeTimeIndex,
            selected_observation: selectedObservation?.id || 'ARGO-2902145'
          }
        })
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data = await res.json();

      if (data.conversation_history) {
        setConversationHistory(data.conversation_history);
      }

      const aiMsgId = nextId();
      setMessages(prev => [
        ...prev,
        {
          id: aiMsgId,
          sender: 'ai',
          text: data.answer || data.response || 'Query processed.',
          action: data.action || null,
          source: data.source || null,
          dataSource: data.data_source || null,
        }
      ]);

      // Auto-dispatch visualization action if present
      if (data.action && onDispatchAction) {
        onDispatchAction(data.action);
      }
    } catch (err) {
      const errId = nextId();
      setMessages(prev => [
        ...prev,
        {
          id: errId,
          sender: 'ai',
          text: '**OceanLense 3D Intelligence Analysis:**\n\nUnable to reach server. Please ensure the backend is active at `http://127.0.0.1:8000`.',
          action: null,
          source: 'error',
          dataSource: null,
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [query, loading, conversationHistory, onDispatchAction, nextId, activeVariable, activeDepth, activeTimeIndex, selectedObservation]);

  const handleReset = () => {
    setMessages([{
      id: 0,
      sender: 'ai',
      text: 'Conversation reset. What aspect of the 3D ocean model would you like to explore?',
      source: '3D-Intelligence-Engine', dataSource: null, action: null,
    }]);
    setConversationHistory([]);
    setMsgIdCounter(1);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Bounce animation keyframes */}
      <style>{`
        @keyframes oceanxBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.4; }
          40% { transform: translateY(-5px); opacity: 1; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
        .oceanx-drawer { animation: slideInRight 0.28s cubic-bezier(0.22,1,0.36,1) both; }
      `}</style>

      <div className="fixed inset-0 z-50 flex justify-end" onClick={e => e.target === e.currentTarget && onClose()}>
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/50" onClick={onClose} />

        {/* Drawer panel */}
        <div className="oceanx-drawer relative w-full max-w-[440px] bg-[#ECF4E8] border-l-2 border-slate-300 h-full flex flex-col shadow-2xl text-slate-900 overflow-hidden font-sans">

          {/* ── Clean Header (No manual API key inputs - uses environment) ── */}
          <div className="flex-shrink-0 px-4 py-3.5 border-b-2 border-slate-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#0284c7] to-[#059669] flex items-center justify-center shadow-md shadow-[#0284c7]/20">
                    <Bot className="w-4 h-4 text-white" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" title="Active" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    OceanLense Assistant
                    <Sparkles className="w-3.5 h-3.5 text-[#0284c7]" />
                  </h2>
                  <p className="text-[11px] text-slate-600 font-semibold">Grounded in 3D Ocean Model & In-Situ Fleet</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 text-xs font-bold shadow-xs">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>3D Grounded</span>
                </div>
                <button
                  onClick={handleReset}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Clear conversation"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                  title="Close Assistant"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ── Message list ─────────────────────────────────────────────── */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5 text-xs sm:text-[13px]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.sender === 'ai' && (
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0284c7] to-[#059669] flex items-center justify-center flex-shrink-0 shadow-xs">
                      <Waves className="w-3 h-3 text-white" />
                    </div>
                    <span className="text-xs text-slate-800 font-bold">OceanLense Assistant</span>
                  </div>
                )}

                <div
                  className={`rounded-2xl px-4 py-3 max-w-[92%] shadow-sm ${
                    msg.sender === 'user'
                      ? 'bg-[#0284c7] text-white font-medium shadow-md shadow-[#0284c7]/20 rounded-tr-sm text-xs sm:text-[13px] leading-relaxed'
                      : 'bg-white text-slate-900 border-2 border-slate-300 rounded-tl-sm text-xs sm:text-[13px] leading-relaxed'
                  }`}
                >
                  {msg.sender === 'user'
                    ? <p className="leading-relaxed font-medium">{msg.text}</p>
                    : (
                      <>
                        <div className="leading-relaxed text-slate-900 font-medium">{renderMarkdown(msg.text)}</div>
                        {msg.action && (
                          <ActionChip action={msg.action} onDispatch={onDispatchAction} />
                        )}
                        {(msg.source || msg.dataSource) && (
                          <SourceBadge source={msg.source} dataSource={msg.dataSource} />
                        )}
                      </>
                    )
                  }
                </div>

                {msg.sender === 'ai' && msg.text && (
                  <div className="flex items-center gap-1 mt-1 ml-1 opacity-0 hover:opacity-100 transition-opacity group-hover:opacity-100">
                    <CopyButton text={msg.text} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex flex-col items-start gap-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#0284c7] to-[#059669] flex items-center justify-center shadow-xs">
                    <Waves className="w-3 h-3 text-white" />
                  </div>
                  <span className="text-xs text-slate-800 font-bold">OceanLense Assistant</span>
                </div>
                <TypingIndicator />
              </div>
            )}
          </div>

          {/* ── Suggested queries (only when at start) ── */}
          {messages.length <= 1 && !loading && (
            <div className="flex-shrink-0 px-4 pb-3 border-t-2 border-slate-200 bg-white">
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider pt-3 pb-2">
                Suggested Inquiries
              </p>
              <div className="grid grid-cols-2 gap-2">
                {SUGGESTED_QUERIES.map((sq, i) => {
                  const Icon = sq.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => handleSend(sq.text)}
                      className="text-left text-xs text-slate-900 hover:text-[#0284c7] bg-slate-50 hover:bg-sky-50 p-2.5 rounded-xl transition-all border border-slate-200 hover:border-[#0284c7]/50 shadow-xs flex items-center gap-2 group cursor-pointer"
                    >
                      <Icon className="w-4 h-4 text-[#0284c7] flex-shrink-0 group-hover:scale-110 transition-transform" />
                      <span className="leading-tight font-bold text-slate-900">{sq.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Input bar ────────────────────────────────────────────────── */}
          <div className="flex-shrink-0 p-3.5 border-t-2 border-slate-200 bg-white">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                placeholder="Ask about water column, 3D model, Argo floats, heatwaves…"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={loading}
                className="flex-1 bg-slate-50 border-2 border-slate-300 text-xs sm:text-sm text-slate-900 font-semibold rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#0284c7]/40 focus:border-[#0284c7] placeholder:text-slate-500 placeholder:font-normal disabled:opacity-50 transition-all shadow-inner"
              />
              <button
                onClick={() => handleSend()}
                disabled={!query.trim() || loading}
                className="p-2.5 rounded-xl bg-[#0284c7] hover:bg-[#0369a1] text-white transition-all font-bold cursor-pointer shadow-md shadow-[#0284c7]/30 disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 flex-shrink-0"
                title="Send message"
              >
                {loading
                  ? <Zap className="w-4 h-4 animate-pulse" />
                  : <Send className="w-4 h-4" />
                }
              </button>
            </div>
            <p className="text-[11px] text-center text-slate-600 mt-2 font-medium">
              OceanLense Assistant · Grounded in active 3D model & in-situ fleet · Not a certified warning system
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
