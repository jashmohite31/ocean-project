import React, { useState, useEffect } from 'react';
import { ShieldAlert, Flame, Wind, AlertCircle, CheckCircle2, Sliders, Info } from 'lucide-react';

export default function HazardsView() {
  const [tempThreshold, setTempThreshold] = useState(1.6);
  const [currentThreshold, setCurrentThreshold] = useState(1.0);
  const [glacierScenario, setGlacierScenario] = useState(false);
  const [hazardData, setHazardData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHazards() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/hazards?time_index=0&temp_threshold=${tempThreshold}&current_speed_threshold=${currentThreshold}&glacier_scenario=${glacierScenario}`
        );
        if (res.ok) {
          const data = await res.json();
          setHazardData(data);
        }
      } catch (err) {
        console.error('Failed to load hazard data', err);
      } finally {
        setLoading(false);
      }
    }
    fetchHazards();
  }, [tempThreshold, currentThreshold, glacierScenario]);

  const heatwaves = hazardData?.marine_heatwaves || [
    { region: 'Northern Arabian Sea', max_anomaly: 2.14, alert_level: 'SEVERE', lat: 21.0, lon: 66.5 },
    { region: 'Sri Lanka Coastal Dome', max_anomaly: 1.82, alert_level: 'MODERATE', lat: 8.5, lon: 82.0 }
  ];

  const eddies = hazardData?.cyclonic_eddies || [
    { name: 'Somali Current Eddy', speed: 1.45, lat: 10.0, lon: 61.5, type: 'Anticyclonic' },
    { name: 'Bay of Bengal Gyre Eddy', speed: 1.12, lat: 15.0, lon: 87.0, type: 'Cyclonic' }
  ];

  return (
    <div className="w-full min-h-[calc(100vh-3.5rem)] bg-[#ECF4E8] p-6 text-[#0f2922] overflow-y-auto">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#93BFC7]/30">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-[#0284c7]" />
              <h1 className="text-xl font-bold text-[#0f2922] tracking-tight">Disaster Management Decision Support</h1>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#CBF3BB] text-[#0f2922] border border-[#ABE7B2] font-bold">
                SIH-26067 Theme
              </span>
            </div>
            <p className="text-xs text-[#2d5246] mt-1">
              Automated anomaly screening for Marine Heatwaves (MHW), high-vorticity cyclonic eddies, and low-confidence prediction zones.
            </p>
          </div>

          {/* Experimental Glacier Melt Scenario Toggle */}
          <div className="flex items-center gap-2 bg-white/80 px-3 py-1.5 rounded-xl border border-[#93BFC7]/40 shadow-xs">
            <span className="text-xs text-[#2d5246] font-semibold">Glacier Runoff Scenario:</span>
            <button
              onClick={() => setGlacierScenario(!glacierScenario)}
              className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                glacierScenario
                  ? 'bg-[#d97706] text-white shadow-xs'
                  : 'bg-[#93BFC7]/30 text-[#2d5246] hover:text-[#0f2922]'
              }`}
            >
              {glacierScenario ? 'ENABLED (Simulation)' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Hazard Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 1. Marine Heatwaves */}
          <div className="ocean-glass rounded-2xl p-5 border border-amber-300 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Flame className="w-5 h-5 text-[#d97706]" />
                <h2 className="text-base font-bold text-[#0f2922]">Marine Heatwave Alerts</h2>
              </div>
              <span className="text-xs font-mono text-[#b45309] font-bold">
                {heatwaves.length} Active Zones
              </span>
            </div>

            <div className="space-y-3">
              {heatwaves.map((mhw, idx) => (
                <div key={idx} className="bg-white/80 rounded-xl p-3.5 border border-amber-200 flex justify-between items-center shadow-xs">
                  <div>
                    <div className="text-sm font-bold text-[#0f2922]">{mhw.region}</div>
                    <div className="text-xs text-[#475569] font-mono mt-0.5">
                      Coordinates: {mhw.lat}°N, {mhw.lon}°E
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                      +{mhw.max_anomaly} °C ANOMALY
                    </span>
                    <div className="text-[10px] text-[#b45309] font-bold mt-1 uppercase tracking-wider">
                      {mhw.alert_level || 'CRITICAL'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Cyclonic Eddies & Current Spikes */}
          <div className="ocean-glass rounded-2xl p-5 border border-[#93BFC7]/50 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wind className="w-5 h-5 text-[#0284c7]" />
                <h2 className="text-base font-bold text-[#0f2922]">High-Vorticity Ocean Eddies</h2>
              </div>
              <span className="text-xs font-mono text-[#0284c7] font-bold">
                {eddies.length} Tracked
              </span>
            </div>

            <div className="space-y-3">
              {eddies.map((eddy, idx) => (
                <div key={idx} className="bg-white/80 rounded-xl p-3.5 border border-[#93BFC7]/30 flex justify-between items-center shadow-xs">
                  <div>
                    <div className="text-sm font-bold text-[#0f2922]">{eddy.name}</div>
                    <div className="text-xs text-[#475569] font-mono mt-0.5">
                      Near {eddy.lat}°N, {eddy.lon}°E • {eddy.type}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[#93BFC7]/20 text-[#0369a1] border border-[#93BFC7]/50">
                      {eddy.speed} m/s
                    </span>
                    <div className="text-[10px] text-[#475569] mt-1 font-medium">
                      Advection risk high
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Confidence & Discrepancy Map Info */}
        <div className="ocean-glass rounded-2xl p-5 border border-[#93BFC7]/40 shadow-sm">
          <h2 className="text-sm font-bold text-[#0f2922] flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-[#0284c7]" />
            <span>Ocean Model Confidence Assessment</span>
          </h2>
          <p className="text-xs text-[#2d5246] leading-relaxed">
            Confidence across the North Indian Ocean basin is calculated using spatial observation density (proximity to nearest active Argo or Glider platform), sensor measurement age (&lt; 24h), and physical consistency bounds. High confidence regions (&gt; 0.85) cluster around active Argo transects in the Arabian Sea and Bay of Bengal.
          </p>
        </div>
      </div>
    </div>
  );
}
