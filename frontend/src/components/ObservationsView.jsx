import React, { useState } from 'react';
import { Radio, MapPin, Gauge, Droplets, Thermometer, Layers, ExternalLink } from 'lucide-react';
import { getSeafloorDepth } from '../utils/bathymetry';

export default function ObservationsView({
  observations = [],
  onSelectObservation,
  onSwitchTo3D
}) {
  const [filterType, setFilterType] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = observations.filter(obs => {
    const matchesType = filterType === 'ALL' || obs.type === filterType;
    const matchesSearch = obs.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          obs.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#ECF4E8] p-6 text-[#0f2922] overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header & Filter Controls */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#93BFC7]/30">
          <div>
            <div className="flex items-center gap-2">
              <Radio className="w-5 h-5 text-[#0284c7]" />
              <h1 className="text-xl font-bold text-[#0f2922] tracking-tight">In-Situ Ocean Observing Fleet</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#CBF3BB] text-[#0f2922] border border-[#ABE7B2] font-bold">
                {observations.length} Platforms Active
              </span>
            </div>
            <p className="text-xs text-[#2d5246] mt-1">
              Autonomous profiling Argo floats, deep ocean gliders, CTD stations, and biogeochemical sensors deployed across the North Indian Ocean.
            </p>
          </div>

          {/* Type Filter Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {['ALL', 'ARGO', 'GLIDER', 'CTD', 'BGC'].map(t => (
              <button
                key={t}
                onClick={() => setFilterType(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterType === t
                    ? 'bg-[#0284c7] text-white font-bold shadow-md shadow-[#0284c7]/20'
                    : 'bg-white/80 text-[#2d5246] hover:text-[#0f2922] hover:bg-white border border-[#93BFC7]/40'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* Fleet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(obs => {
            const seafloor = getSeafloorDepth(obs.latitude, obs.longitude);
            return (
              <div
                key={obs.id}
                className="ocean-glass rounded-2xl p-4 border border-[#93BFC7]/40 hover:border-[#0284c7]/50 transition-all flex flex-col justify-between group shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                      obs.type === 'ARGO' ? 'bg-[#93BFC7]/30 text-[#0369a1] border border-[#93BFC7]' :
                      obs.type === 'GLIDER' ? 'bg-[#CBF3BB]/60 text-[#1b4332] border border-[#ABE7B2]' :
                      obs.type === 'CTD' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                      'bg-purple-100 text-purple-800 border border-purple-300'
                    }`}>
                      {obs.type}
                    </span>
                    <span className="text-[10px] text-[#059669] font-mono flex items-center gap-1 font-bold">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#059669] animate-pulse"></span>
                      ACTIVE
                    </span>
                  </div>

                  <h3 className="text-sm font-bold text-[#0f2922] mt-2 group-hover:text-[#0284c7] transition-colors">
                    {obs.name}
                  </h3>
                  <div className="text-[11px] font-mono text-[#335c50] mt-0.5 font-semibold">
                    ID: {obs.id}
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[#93BFC7]/30 text-xs">
                    <div className="flex items-center gap-1.5 text-[#2d5246]">
                      <MapPin className="w-3.5 h-3.5 text-[#0284c7]" />
                      <span className="font-mono text-[#0f2922] font-semibold">{obs.latitude.toFixed(1)}°N, {obs.longitude.toFixed(1)}°E</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#2d5246]">
                      <Layers className="w-3.5 h-3.5 text-[#0369a1]" />
                      <span className="font-mono text-[#0369a1] font-bold">Bed: ~{seafloor}m</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#2d5246]">
                      <Thermometer className="w-3.5 h-3.5 text-[#d97706]" />
                      <span className="font-mono text-[#0284c7] font-bold">{obs.surface_temp} °C</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-[#2d5246]">
                      <Droplets className="w-3.5 h-3.5 text-[#059669]" />
                      <span className="font-mono text-[#059669] font-bold">{obs.surface_salinity} PSU</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-[#93BFC7]/30 flex items-center gap-2">
                  <button
                    onClick={() => {
                      onSelectObservation(obs);
                      onSwitchTo3D();
                    }}
                    className="flex-1 py-1.5 rounded-lg text-xs font-bold text-[#0f2922] bg-[#CBF3BB] hover:bg-[#ABE7B2] border border-[#ABE7B2] transition-all flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <span>Locate in 3D Bed</span>
                    <ExternalLink className="w-3 h-3 text-[#0284c7]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
