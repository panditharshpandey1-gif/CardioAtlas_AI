import { useState, useRef, useMemo, useEffect, Suspense } from 'react';
import { Canvas, invalidate } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { HeartMesh } from './HeartMesh';
import { PatientSignalOverlay3D } from './PatientSignalOverlay3D';
import type { ClinicalSignal, ClinicalSignalId } from '../../features/heart-intelligence/clinicalSignals';
import { ModelErrorBoundary } from './ErrorBoundary';
import { 
  Heart, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Compass, 
  RefreshCw, 
  Layers 
} from 'lucide-react';

function checkWebGLSupport(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

interface HeartViewer3DProps {
  initialArtery?: 'LAD' | 'RCA' | 'LCX' | null;
  onArterySelect?: (artery: 'LAD' | 'RCA' | 'LCX' | null) => void;
  className?: string;
  clinicalSignals?: ClinicalSignal[];
  selectedSignalId?: ClinicalSignalId | null;
  onSignalSelect?: (id: ClinicalSignalId) => void;
  showSignalOverlay?: boolean;
  modelScore?: number | null;
}

export function HeartViewer3D({
  initialArtery = null,
  onArterySelect,
  className = '',
  clinicalSignals = [],
  selectedSignalId = null,
  onSignalSelect,
  showSignalOverlay = false,
  modelScore = null,
}: HeartViewer3DProps) {
  const [selectedArtery, setSelectedArtery] = useState<'LAD' | 'RCA' | 'LCX' | null>(initialArtery);
  const [prevInitialArtery, setPrevInitialArtery] = useState<'LAD' | 'RCA' | 'LCX' | null>(initialArtery);
  const [viewMode, setViewMode] = useState<'tissue' | 'vascular' | 'hologram' | 'xray'>('vascular');
  const [cardiacCycleAnimation, setCardiacCycleAnimation] = useState<boolean>(false);
  const [slowRotate, setSlowRotate] = useState<boolean>(false);
  const [showLabels, setShowLabels] = useState<boolean>(true);
  const [showConnections, setShowConnections] = useState<boolean>(false);
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [retryKey, setRetryKey] = useState<number>(0);
  const [xrayEnabled, setXrayEnabled] = useState<boolean>(false);
  const [xrayOpacity, setXrayOpacity] = useState<number>(0.5); // default 50% opacity


  const controlsRef = useRef<OrbitControlsImpl>(null);
  const interactionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isWebGLSupported = useMemo(() => checkWebGLSupport(), []);

  // Synchronize state from prop during render without cascading renders
  if (initialArtery !== prevInitialArtery) {
    setPrevInitialArtery(initialArtery);
    setSelectedArtery(initialArtery);
  }

  // Synchronize 3D camera orientation with external system when artery changes
  useEffect(() => {
    if (controlsRef.current && selectedArtery) {
      if (selectedArtery === 'LAD') {
        controlsRef.current.setAzimuthalAngle(0.15);
        controlsRef.current.setPolarAngle(Math.PI / 2.3);
      } else if (selectedArtery === 'RCA') {
        controlsRef.current.setAzimuthalAngle(-0.95);
        controlsRef.current.setPolarAngle(Math.PI / 2.2);
      } else if (selectedArtery === 'LCX') {
        controlsRef.current.setAzimuthalAngle(1.15);
        controlsRef.current.setPolarAngle(Math.PI / 2.4);
      }
      controlsRef.current.update();
      invalidate();
    }
  }, [selectedArtery]);

  // Clean up interaction timer on unmount
  useEffect(() => {
    return () => {
      if (interactionTimerRef.current) {
        clearTimeout(interactionTimerRef.current);
      }
    };
  }, []);

  const handleInteractionStart = () => {
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
      interactionTimerRef.current = null;
    }
    setIsInteracting(true);
  };

  const handleInteractionEnd = () => {
    if (interactionTimerRef.current) {
      clearTimeout(interactionTimerRef.current);
    }
    // Allow damping inertia to settle smoothly before returning to demand frameloop
    interactionTimerRef.current = setTimeout(() => {
      setIsInteracting(false);
    }, 600);
  };

  const handleSelectArtery = (artery: 'LAD' | 'RCA' | 'LCX') => {
    const next = selectedArtery === artery ? null : artery;
    setSelectedArtery(next);
    if (onArterySelect) onArterySelect(next);

    // Stop continuous turntable rotation when inspecting specific vessels
    if (next && slowRotate) {
      setSlowRotate(false);
    }
  };

  const handleResetCamera = () => {
    setSlowRotate(false);
    if (controlsRef.current) {
      controlsRef.current.reset();
      controlsRef.current.setAzimuthalAngle(0.3);
      controlsRef.current.setPolarAngle(Math.PI / 2.4);
      controlsRef.current.update();
      invalidate();
    }
    setSelectedArtery(null);
    if (onArterySelect) onArterySelect(null);
  };

  const setPresetAngle = (azimuth: number, polar: number) => {
    if (slowRotate) {
      setSlowRotate(false);
    }
    if (controlsRef.current) {
      controlsRef.current.setAzimuthalAngle(azimuth);
      controlsRef.current.setPolarAngle(polar);
      controlsRef.current.update();
      invalidate();
    }
  };

  const handleRetryStage = () => {
    setRetryKey((k) => k + 1);
  };

  const isAnimating = cardiacCycleAnimation || slowRotate || isInteracting;
  const hasSignalOverlay = showSignalOverlay && clinicalSignals.length > 0;

  if (!isWebGLSupported) {
    return (
      <div className={`relative flex flex-col rounded border border-border bg-viewport-bg p-6 text-center ${className}`}>
        <div className="flex items-center gap-2 mb-4 text-caption font-semibold text-text border-b border-border pb-2">
          <Compass className="w-4 h-4 text-accent shrink-0" />
          <span>3D Coronary Anatomy Viewport (WebGL Fallback)</span>
        </div>
        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-surface-alt border border-border flex items-center justify-center text-accent">
            <Heart className="w-6 h-6 text-accent" />
          </div>
          <h4 className="text-body font-bold text-text">WebGL Hardware Acceleration Unavailable</h4>
          <p className="text-caption text-text-secondary max-w-md">
            Your browser environment does not have WebGL acceleration enabled. Standard coronary anatomical structures (LAD, RCA, LCX, Aorta, LV Apex) can still be selected via the interactive structure panel on the right.
          </p>
        </div>
        <div className="px-3 py-1.5 border-t border-border bg-surface-alt/60 text-caption text-text-tertiary flex items-center justify-between">
          <span>Educational reference model — not patient-specific anatomy.</span>
          <span>CC BY 4.0 neshallads (Sketchfab)</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col rounded border border-border bg-viewport-bg overflow-hidden ${className}`}>
      {/* 1. Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-border bg-surface-alt/80 z-10 text-caption">
        <div className="flex items-center gap-1.5">
          <Compass className="w-4 h-4 text-accent shrink-0" />
          <span className="font-semibold text-text">{hasSignalOverlay ? 'Patient-linked 3D signal map' : '3D Coronary Anatomy Viewport'}</span>
          <span className="ml-1 px-1.5 py-0.2 rounded text-[10px] bg-surface text-text-secondary border border-border">
            Illustrative
          </span>
        </div>

        {/* Action Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Mode Selector */}
          <div className="flex items-center rounded-xs border border-border bg-surface p-0.5 text-[11px]">
            <span className="px-1 text-text-tertiary flex items-center" title="Shading mode">
              <Layers className="w-3 h-3" />
            </span>
            <button
              id="btn-view-natural"
              type="button"
              onClick={() => {
                setViewMode('vascular');
                invalidate();
              }}
              className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                viewMode === 'vascular'
                  ? 'bg-accent text-white font-medium'
                  : 'text-text-secondary hover:text-text'
              }`}
              title="Natural realistic texture"
            >
              Natural
            </button>
            <button
              id="btn-view-tissue"
              type="button"
              onClick={() => {
                setViewMode('tissue');
                invalidate();
              }}
              className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                viewMode === 'tissue'
                  ? 'bg-accent text-white font-medium'
                  : 'text-text-secondary hover:text-text'
              }`}
              title="Myocardial tissue highlight"
            >
              Tissue
            </button>
            <button
              id="btn-view-hologram"
              type="button"
              onClick={() => {
                setViewMode('hologram');
                invalidate();
              }}
              className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                viewMode === 'hologram'
                  ? 'bg-accent text-white font-medium'
                  : 'text-text-secondary hover:text-text'
              }`}
              title="Cyan wireframe hologram mode"
            >
              Hologram
            </button>
            {/* X-Ray Vision Toggle */}
            <button
              id="btn-view-xray"
              type="button"
              onClick={() => {
                setViewMode('xray');
                // Ensure opacity state has a default if undefined
                if (xrayOpacity === undefined) setXrayOpacity(0.5);
                invalidate();
              }}
              className={`px-1.5 py-0.5 rounded-xs transition-colors cursor-pointer ${
                viewMode === 'xray'
                  ? 'bg-accent text-white font-medium'
                  : 'text-text-secondary hover:text-text'
              }`}
              title="X-Ray semi-transparent mode"
            >
              X‑Ray
            </button>
            {viewMode === 'xray' && (
              <div className="flex items-center gap-2 px-2 py-1">
                <span className="text-xs text-text-secondary">Opacity</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={Math.round((xrayOpacity ?? 0.5) * 100)}
                  onChange={(e) => {
                    setXrayOpacity(Number(e.target.value) / 100);
                    invalidate();
                  }}
                  className="w-24"
                />
                <span className="text-xs text-text">{Math.round((xrayOpacity ?? 0.5) * 100)}%</span>
              </div>
            )}
          </div>

          {/* Cardiac Cycle Animation Toggle (default OFF) */}
          <button
            id="btn-toggle-pulse"
            type="button"
            onClick={() => {
              setCardiacCycleAnimation(!cardiacCycleAnimation);
              invalidate();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xs border text-caption transition-colors cursor-pointer ${
              cardiacCycleAnimation
                ? 'bg-accent/20 border-accent text-accent font-semibold'
                : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-alt'
            }`}
            title="Toggle gentle 60 BPM cardiac cycle pulse (default off)"
          >
            <Heart className="w-3.5 h-3.5" />
            <span>Cycle {cardiacCycleAnimation ? 'ON (60 BPM)' : 'OFF'}</span>
          </button>

          {/* Slow Rotate Toggle (default OFF) */}
          <button
            id="btn-toggle-rotate"
            type="button"
            onClick={() => {
              setSlowRotate(!slowRotate);
              invalidate();
            }}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-xs border text-caption transition-colors cursor-pointer ${
              slowRotate
                ? 'bg-accent/20 border-accent text-accent font-semibold'
                : 'bg-surface border-border text-text-secondary hover:text-text hover:bg-surface-alt'
            }`}
            title="Toggle slow turntable rotation (0.15 rad/s)"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Rotate {slowRotate ? 'ON' : 'OFF'}</span>
          </button>

          {/* Toggle Pins */}
          <button
            id="btn-toggle-pins"
            type="button"
            onClick={() => {
              setShowLabels(!showLabels);
              invalidate();
            }}
            className={`flex items-center gap-1 px-2 py-1 rounded-xs border text-caption transition-colors cursor-pointer ${
              showLabels
                ? 'bg-surface border-border text-text font-medium'
                : 'bg-surface border-border text-text-tertiary'
            }`}
            title="Toggle anatomical marker pins"
          >
            {showLabels ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            <span>Pins</span>
          </button>

          {/* Anterior / Posterior Presets */}
          <button
            id="btn-preset-anterior"
            type="button"
            onClick={() => setPresetAngle(0, Math.PI / 2.3)}
            className="px-2 py-1 rounded-xs border border-border bg-surface text-text-secondary hover:text-text text-caption cursor-pointer"
            title="Orient view to anterior aspect"
          >
            Anterior
          </button>
          <button
            id="btn-preset-posterior"
            type="button"
            onClick={() => setPresetAngle(Math.PI, Math.PI / 2.2)}
            className="px-2 py-1 rounded-xs border border-border bg-surface text-text-secondary hover:text-text text-caption cursor-pointer"
            title="Orient view to posterior aspect"
          >
            Posterior
          </button>

          {/* Reset Camera */}
          <button
            id="btn-reset-camera"
            type="button"
            onClick={handleResetCamera}
            className="flex items-center gap-1 px-2 py-1 rounded-xs border border-border bg-surface text-text-secondary hover:text-text text-caption cursor-pointer"
            title="Reset view to canonical orientation"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>
        </div>
      </div>

      {/* 2. Three.js Canvas Stage */}
      <div className="relative w-full h-[460px] sm:h-[500px] min-h-[460px] bg-viewport-bg">
        <ModelErrorBoundary key={retryKey} onRetry={handleRetryStage}>
          <Suspense fallback={
            <div className="w-full h-full min-h-[460px] flex flex-col items-center justify-center text-text-secondary gap-3 bg-viewport-bg">
              <div className="w-10 h-10 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-body font-mono text-text">Loading 3D Heart Geometry...</span>
              <span className="text-caption text-text-tertiary">Standard illustrative reference model</span>
            </div>
          }>
            <Canvas
              dpr={[1, 2]}
              resize={{ scroll: false, debounce: { scroll: 50, resize: 0 } }}
              gl={{
                antialias: true,
                alpha: true,
                powerPreference: 'high-performance',
              }}
              camera={{ position: [0, 0.1, 3.4], fov: 45 }}
              frameloop={isAnimating ? 'always' : 'demand'}
              onCreated={({ gl }) => {
                const domEl = gl.domElement;
                domEl.addEventListener('webglcontextlost', (e: Event) => {
                  e.preventDefault();
                });
                domEl.addEventListener('webglcontextrestored', () => {
                  invalidate();
                });
              }}
            >
              <PerspectiveCamera makeDefault position={[0, 0.1, 3.4]} fov={45} />
              <OrbitControls
                ref={controlsRef}
                makeDefault
                enableDamping
                dampingFactor={0.06}
                minDistance={1.8}
                maxDistance={6.0}
                autoRotate={false}
                onStart={handleInteractionStart}
                onEnd={handleInteractionEnd}
                onChange={() => invalidate()}
              />

              {/* Neutral Studio Lighting */}
              <ambientLight intensity={1.2} />
              <directionalLight position={[4, 6, 4]} intensity={1.6} color="#ffffff" castShadow />
              <directionalLight position={[-4, 2, -3]} intensity={0.9} color="#94A3B8" />
              <pointLight position={[0, -2, 2]} intensity={0.5} color="#00D2FF" />

              <HeartMesh
                cardiacCycleAnimation={cardiacCycleAnimation}
                slowRotate={slowRotate}
                viewMode={viewMode}
                selectedArtery={selectedArtery}
                onSelectArtery={handleSelectArtery}
                showLabels={showLabels && !hasSignalOverlay} showConnections={showConnections}
                xrayEnabled={xrayEnabled}
                xrayOpacity={xrayOpacity}
              />
              {hasSignalOverlay && <PatientSignalOverlay3D
                signals={clinicalSignals}
                selectedId={selectedSignalId}
                onSelect={id => onSignalSelect?.(id)}
                modelScore={modelScore}
              />}
            </Canvas>
          </Suspense>
        </ModelErrorBoundary>
      </div>

      {/* 3. Footer Credit & Educational Attribution */}
      <div className="px-3 py-1.5 border-t border-border bg-surface-alt/60 text-caption text-text-tertiary flex items-center justify-between">
        <span>Educational reference model — not patient-specific anatomy or fluoroscopic angiograms.</span>
        <span>CC BY 4.0 neshallads (Sketchfab)</span>
      </div>
    </div>
  );
}

