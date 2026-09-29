import React from 'react';
import { Waves, GitCompare, Radio, ShieldAlert, Database, Bot, Sparkles } from 'lucide-react';

export default function TopNavbar({
  activeTab,
  onSelectTab,
  onOpenDataModal,
  onOpenAskModal,
  activeVariable,
  activeDepth
}) {
  const navTabs = [
    { id: '3d', label: '3D Ocean Explorer', icon: Waves },
    { id: 'compare', label: 'Model vs Argo', icon: GitCompare },
    { id: 'observations', label: 'In-Situ Floats', icon: Radio },
    { id: 'hazards', label: 'Disaster Hazards', icon: ShieldAlert }
  ];

  return (
    <header className="h-16 border-b-2 border-slate-300 bg-white px-5 flex items-center justify-between z-30 select-none sticky top-0 w-full shadow-sm text-slate-950">
      {/* Brand & Theme */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
          <Waves className="w-5 h-5 text-white stroke-[2.5]" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="font-black text-xl tracking-tight text-slate-950">OceanX</span>
          </div>
          <div className="text-xs text-slate-900 font-bold">
            3D Ocean Intelligence • Disaster Management
          </div>
        </div>
      </div>

      {/* Clean Mode Tabs */}
      <nav className="flex items-center gap-1.5 bg-white p-1 rounded-xl border-2 border-slate-300 shadow-sm">
        {navTabs.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-blue-600 text-white font-black shadow-sm'
                  : 'text-slate-800 font-bold hover:text-black hover:bg-slate-100'
              }`}
            >
              <Icon className={`w-4 h-4 stroke-[2.2] ${isActive ? 'text-white' : 'text-slate-700'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Action Tools */}
      <div className="flex items-center gap-2.5">
        <button
          onClick={onOpenDataModal}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-bold text-slate-900 bg-white hover:bg-slate-50 border-2 border-slate-300 hover:border-slate-400 shadow-xs transition-all cursor-pointer"
          title="Data Pipeline & Ingestion"
        >
          <Database className="w-4 h-4 text-blue-600 stroke-[2.2]" />
          <span className="hidden sm:inline">Data Pipeline</span>
        </button>

        <button
          onClick={onOpenAskModal}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-black text-white bg-blue-600 hover:bg-blue-700 shadow-md transition-all cursor-pointer"
        >
          <Bot className="w-4 h-4 stroke-[2.2]" />
          <span>Ask OceanX</span>
          <Sparkles className="w-3.5 h-3.5 text-[#CBF3BB] animate-pulse" />
        </button>
      </div>
    </header>
  );
}
