import React from 'react';
import { ChevronDown, ChevronUp, Layers, Compass, Loader2, CheckCircle2 } from 'lucide-react';

const DEPTH_STOPS = [
  { depth: 0, label: '0m', desc: 'Sea Surface' },
  { depth: 25, label: '25m', desc: 'Mixed Layer' },
  { depth: 50, label: '50m', desc: 'Upper Thermocline' },
  { depth: 100, label: '100m', desc: 'Main Thermocline' },
  { depth: 250, label: '250m', desc: 'Current Core' },
  { depth: 500, label: '500m', desc: 'Intermediate Water' },
  { depth: 1000, label: '1000m', desc: 'Argo Park Depth' },
  { depth: 2000, label: '2000m', desc: 'Argo Max Profile' },
  { depth: 'bed', label: 'Bed', desc: 'Ocean Bed Seafloor' }
];

export default function DepthArrowScrubber({
  currentDepth = 0,
  onDepthChange,
  showOceanBed,
  onToggleOceanBed,
  isLoadingChunk = false
}) {
  const activeStop = DEPTH_STOPS.find(s => s.depth === currentDepth) || {
    depth: currentDepth,
    label: `${currentDepth}m`,
    desc: 'Intermediate Depth'
  };

  const handleStep = (direction) => {
    const currentIndex = DEPTH_STOPS.findIndex(s => s.depth === currentDepth);
    if (direction === 'up' && currentIndex > 0) {
      onDepthChange(DEPTH_STOPS[currentIndex - 1].depth);
    } else if (direction === 'down' && currentIndex < DEPTH_STOPS.length - 1) {
      onDepthChange(DEPTH_STOPS[currentIndex + 1].depth);
    }
  };

  return (
    <div className="ocean-glass rounded-2xl p-3.5 flex flex-col items-center gap-2 select-none shadow-2xl border-2 border-slate-300 min-w-[155px] text-slate-900">
      {/* Title & Step Up Arrow */}
      <div className="flex flex-col items-center w-full pb-2 border-b border-slate-200">
        <div className="text-sm font-black tracking-wide text-slate-950 uppercase flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-blue-600 stroke-[2.5]" />
          <span>Depth Layer</span>
        </div>
        <button
          onClick={() => handleStep('up')}
          className="p-1.5 mt-1 text-slate-700 hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          title="Ascend Depth Layer"
        >
          <ChevronUp className="w-5 h-5 stroke-[2.5]" />
        </button>
      </div>

      {/* Vertical Slider Track with Depth Stop Nodes */}
      <div className="flex items-center gap-2 py-1 w-full">
        <div className="flex flex-col justify-between h-72 text-sm w-full space-y-1">
          {DEPTH_STOPS.map((stop) => {
            const isBed = stop.depth === 'bed';
            const isSelected = isBed ? showOceanBed : currentDepth === stop.depth;
            return (
              <button
                key={stop.label}
                onClick={() => {
                  if (isBed) {
                    onToggleOceanBed(!showOceanBed);
                  } else {
                    onDepthChange(stop.depth);
                  }
                }}
                className={`flex items-center justify-between gap-1.5 px-3 py-1.5 rounded-lg text-left transition-all group w-full cursor-pointer ${
                  isSelected
                    ? isBed
                      ? 'bg-blue-800 text-white font-black shadow-md translate-x-1'
                      : 'bg-blue-600 text-white font-black shadow-md translate-x-1'
                    : 'text-slate-900 hover:text-black hover:bg-slate-100 font-bold'
                }`}
                title={stop.desc}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2.5 h-2.5 rounded-full transition-transform ${
                      isSelected
                        ? 'bg-white scale-125'
                        : 'bg-slate-400 group-hover:bg-blue-600'
                    }`}
                  />
                  <span className="font-bold text-xs">{stop.label}</span>
                </div>

                {isSelected && !isBed && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-emerald-600 text-white uppercase tracking-tight font-black shadow-xs">
                    {isLoadingChunk ? '...' : 'OK'}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Step Down Arrow */}
      <button
        onClick={() => handleStep('down')}
        className="p-1 text-slate-700 hover:text-black hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
        title="Descend Depth Layer"
      >
        <ChevronDown className="w-5 h-5 stroke-[2.5]" />
      </button>

      {/* Active Layer Status & Chunk Loading Badge */}
      <div className="w-full pt-2 border-t border-slate-200 flex flex-col items-center text-center">
        {isLoadingChunk ? (
          <div className="flex items-center gap-1.5 text-xs text-blue-700 animate-pulse font-mono font-black">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
            <span>Loading...</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 text-xs font-mono text-emerald-800 font-black">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
            <span>
              {currentDepth === 'bed' ? 'Bed Active' : `${currentDepth}m Active`}
            </span>
          </div>
        )}
        <div className="text-xs text-slate-900 font-bold leading-tight max-w-[120px] truncate mt-0.5" title={activeStop.desc}>
          {activeStop.desc}
        </div>
      </div>
    </div>
  );
}
