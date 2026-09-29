import React, { useState, useEffect } from 'react';
import TopNavbar from './components/TopNavbar';
import OceanViewer3D from './components/OceanViewer3D';
import ModelVsArgoView from './components/ModelVsArgoView';
import ObservationsView from './components/ObservationsView';
import HazardsView from './components/HazardsView';
import AskOceanXDrawer from './components/AskOceanXDrawer';
import DataPipelineModal from './components/DataPipelineModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('3d');
  const [activeVariable, setActiveVariable] = useState('temperature');
  const [activeDepth, setActiveDepth] = useState(0);
  const [activeTimeIndex, setActiveTimeIndex] = useState(0);

  const [observations, setObservations] = useState([]);
  const [selectedObservation, setSelectedObservation] = useState(null);

  const [sliceData, setSliceData] = useState(null);
  const [isLoadingChunk, setIsLoadingChunk] = useState(false);

  const [isDataModalOpen, setIsDataModalOpen] = useState(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState(false);

  // 1. Fetch In-Situ Observations on mount
  useEffect(() => {
    async function loadObservations() {
      try {
        const res = await fetch('/api/observations');
        if (res.ok) {
          const data = await res.json();
          setObservations(data);
          // Preselect first float for comparison convenience
          if (data.length > 0 && !selectedObservation) {
            setSelectedObservation(data[0]);
          }
        }
      } catch (err) {
        console.error('Failed to load observations', err);
      }
    }
    loadObservations();
  }, []);

  // 2. Fetch Depth Chunk / Slice when variable, depth, or time changes
  useEffect(() => {
    let isCancelled = false;

    async function loadSliceChunk() {
      if (activeDepth === 'bed') {
        // Bed is rendered by the bathymetric surface mesh
        return;
      }

      setIsLoadingChunk(true);
      try {
        const res = await fetch(
          `/api/ocean/slice?variable=${activeVariable}&depth=${activeDepth}&time_index=${activeTimeIndex}`
        );
        if (res.ok && !isCancelled) {
          const data = await res.json();
          setSliceData(data);
        }
      } catch (err) {
        console.error('Failed to load depth slice chunk', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingChunk(false);
        }
      }
    }

    loadSliceChunk();

    return () => {
      isCancelled = true;
    };
  }, [activeVariable, activeDepth, activeTimeIndex]);

  // Handler to open comparison for a specific float
  const handleOpenCompare = (floatId) => {
    const found = observations.find(o => o.id === floatId);
    if (found) setSelectedObservation(found);
    setActiveTab('compare');
  };

  // Handler for OceanX Assistant action dispatch
  const handleDispatchAction = (action) => {
    if (!action) return;
    switch (action.action) {
      case 'visualize':
        if (action.variable) setActiveVariable(action.variable);
        if (action.depth !== undefined) setActiveDepth(action.depth);
        setActiveTab('3d');
        break;
      case 'compare':
        if (action.observation) {
          const found = observations.find(o => o.id === action.observation);
          if (found) setSelectedObservation(found);
        }
        setActiveTab('compare');
        break;
      case 'show_anomaly_layer':
      case 'show_hazards':
        setActiveTab('hazards');
        break;
      case 'show_currents':
        setActiveVariable('currents');
        if (action.depth !== undefined) setActiveDepth(action.depth);
        setActiveTab('3d');
        break;
      default:
        break;
    }
  };

  return (
    <div className="w-screen min-h-screen bg-[#ECF4E8] text-[#0f2922] flex flex-col overflow-x-hidden font-sans">
      {/* Top Clean Navbar */}
      <TopNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenDataModal={() => setIsDataModalOpen(true)}
        onOpenAskModal={() => setIsAskDrawerOpen(true)}
        activeVariable={activeVariable}
        activeDepth={activeDepth}
      />

      {/* Main Content Area based on Active Tab */}
      <main className="flex-1 w-full relative">
        {activeTab === '3d' && (
          <OceanViewer3D
            activeVariable={activeVariable}
            onSelectVariable={setActiveVariable}
            activeDepth={activeDepth}
            onDepthChange={setActiveDepth}
            activeTimeIndex={activeTimeIndex}
            onTimeChange={setActiveTimeIndex}
            observations={observations}
            selectedObservation={selectedObservation}
            onSelectObservation={setSelectedObservation}
            onOpenCompare={handleOpenCompare}
            sliceData={sliceData}
            isLoadingChunk={isLoadingChunk}
          />
        )}

        {activeTab === 'compare' && (
          <ModelVsArgoView
            selectedFloatId={selectedObservation?.id || 'ARGO-2902145'}
            observations={observations}
            onSelectFloat={(id) => {
              const found = observations.find(o => o.id === id);
              if (found) setSelectedObservation(found);
            }}
          />
        )}

        {activeTab === 'observations' && (
          <ObservationsView
            observations={observations}
            onSelectObservation={setSelectedObservation}
            onSwitchTo3D={() => setActiveTab('3d')}
          />
        )}

        {activeTab === 'hazards' && (
          <HazardsView />
        )}
      </main>

      {/* Slide-out AI Query Drawer */}
      <AskOceanXDrawer
        isOpen={isAskDrawerOpen}
        onClose={() => setIsAskDrawerOpen(false)}
        onDispatchAction={handleDispatchAction}
        activeVariable={activeVariable}
        activeDepth={activeDepth}
        activeTimeIndex={activeTimeIndex}
        selectedObservation={selectedObservation}
      />

      {/* Data Ingestion Pipeline Modal */}
      <DataPipelineModal
        isOpen={isDataModalOpen}
        onClose={() => setIsDataModalOpen(false)}
      />
    </div>
  );
}
