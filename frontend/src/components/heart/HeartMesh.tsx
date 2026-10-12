import { useRef, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, invalidate } from '@react-three/fiber';
import { useGLTF, Center, Html } from '@react-three/drei';

interface HeartMeshProps {
  cardiacCycleAnimation?: boolean;
  slowRotate?: boolean;
  viewMode: 'tissue' | 'vascular' | 'hologram' | 'xray';
  selectedArtery: 'LAD' | 'RCA' | 'LCX' | null;
  onSelectArtery: (artery: 'LAD' | 'RCA' | 'LCX') => void;
  showLabels: boolean;
  showConnections: boolean;
  xrayEnabled?: boolean;
  xrayOpacity?: number;
}

// Anatomical color groups based on mesh index (39 meshes total)
// Interior view model: group meshes by anatomical region via index heuristics
const MESH_COLORS: Record<number, string> = {
  0:  '#c0392b', // outer wall / myocardium (dark red)
  1:  '#c0392b',
  2:  '#8b1a1a', // inner chamber wall (deeper red)
  3:  '#8b1a1a',
  4:  '#b03060', // septum area (maroon-red) — meshes 4-17 share material_4
  5:  '#b03060',
  6:  '#b03060',
  7:  '#b03060',
  8:  '#b03060',
  9:  '#b03060',
  10: '#b03060',
  11: '#b03060',
  12: '#b03060',
  13: '#b03060',
  14: '#b03060',
  15: '#b03060',
  16: '#b03060',
  17: '#b03060',
  18: '#3498db', // pulmonary vein / blue vessels
  19: '#2980b9',
  20: '#1abc9c', // valve leaflets (teal)
  21: '#16a085',
  22: '#e74c3c', // aorta / great vessel (bright red)
  23: '#c0392b',
  24: '#f39c12', // chordae / connective tissue (amber)
  25: '#f39c12',
  26: '#f39c12',
  27: '#e67e22', // papillary muscle (orange)
  28: '#3498db', // pulmonary artery (blue)
  29: '#3498db',
  30: '#3498db',
  31: '#e74c3c', // aortic arch
  32: '#c0392b',
  33: '#2c3e50', // pericardium / outer (dark)
  34: '#2c3e50',
  35: '#95a5a6', // fat / adipose tissue (silver-grey)
  36: '#95a5a6',
  37: '#27ae60', // veins (dark green)
  38: '#1e8449',
};

export function HeartMesh({
  cardiacCycleAnimation = false,
  slowRotate = false,
  viewMode,
  selectedArtery,
  onSelectArtery,
  showLabels,
  showConnections,
  xrayEnabled,
  xrayOpacity,
}: HeartMeshProps) {
  const { scene } = useGLTF('/models/Human_Heart_Interior_View.glb');

  const groupRef = useRef<THREE.Group>(null);
  const pulseRef = useRef(0);

  const palette = useMemo(() => ({
    hologramColor: new THREE.Color('#00D2FF'),
    hologramEmissive: new THREE.Color('#0043CE'),
  }), []);

  const clonedScene = useMemo(() => {
    const clone = scene.clone(true);
    let meshIndex = 0;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Assign mesh index for color mapping
        (mesh as THREE.Mesh & { _anatomyIndex: number })._anatomyIndex = meshIndex++;
        if (Array.isArray(mesh.material)) {
          mesh.material = mesh.material.map(m => m.clone());
        } else if (mesh.material) {
          mesh.material = mesh.material.clone();
        }
      }
    });
    return clone;
  }, [scene]);

  // Cleanup
  useEffect(() => {
    return () => {
      clonedScene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const mesh = child as THREE.Mesh;
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else if (mesh.material) {
            mesh.material.dispose();
          }
        }
      });
    };
  }, [clonedScene]);

  // Apply materials based on viewMode
  useEffect(() => {
    clonedScene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh & { _anatomyIndex: number };
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

        mats.forEach((mat) => {
          const m = mat as THREE.MeshStandardMaterial;
          if (!m || !m.isMeshStandardMaterial) return;

          const anatomyColor = MESH_COLORS[mesh._anatomyIndex] ?? '#cc2222';

          if (viewMode === 'hologram') {
            m.wireframe = true;
            m.color.copy(palette.hologramColor);
            m.emissive.copy(palette.hologramEmissive);
            m.emissiveIntensity = 0.5;
            m.transparent = true;
            m.opacity = 0.75;
            m.side = THREE.FrontSide;
            m.depthWrite = true;
          } else if (viewMode === 'tissue') {
            m.wireframe = false;
            m.color.set(anatomyColor);
            m.emissive.set(anatomyColor);
            m.emissiveIntensity = 0.08;
            m.roughness = 0.55;
            m.metalness = 0.05;
            m.transparent = false;
            m.opacity = 1.0;
            m.side = THREE.FrontSide;
            m.depthWrite = true;
          } else if (viewMode === 'xray') {
            m.wireframe = false;
            m.color.set(anatomyColor);
            m.emissive.set(anatomyColor);
            m.emissiveIntensity = 0.25;
            m.roughness = 0.4;
            m.metalness = 0.0;
            m.transparent = true;
            m.opacity = typeof xrayOpacity === 'number' ? xrayOpacity : 0.4;
            m.side = THREE.DoubleSide;
            m.depthWrite = false;
          } else {
            // vascular — anatomical colors, original textures preserved
            m.wireframe = false;
            m.color.set(anatomyColor);
            m.emissive.set('#000000');
            m.emissiveIntensity = 0;
            m.roughness = 0.55;
            m.metalness = 0.05;
            m.transparent = false;
            m.opacity = 1.0;
            m.side = THREE.FrontSide;
            m.depthWrite = true;
          }

          // showConnections: highlight vessel meshes (blue/green ones by index)
          if (showConnections) {
            const idx = mesh._anatomyIndex;
            // Vessel groups: 18-19 (pulm veins), 22-23 (aorta), 28-30 (pulm artery), 37-38 (veins)
            const isVessel = [18,19,22,23,28,29,30,37,38].includes(idx);
            if (isVessel) {
              m.transparent = true;
              m.opacity = 0.92;
              m.emissive.set('#00ffcc');
              m.emissiveIntensity = 0.7;
            }
          }

          m.needsUpdate = true;
        });
      }
    });
    invalidate();
  }, [clonedScene, viewMode, palette, xrayOpacity, showConnections]);

  useEffect(() => {
    invalidate();
  }, [selectedArtery, showLabels]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (cardiacCycleAnimation) {
      pulseRef.current += delta * (Math.PI * 2);
      const sinVal = Math.sin(pulseRef.current);
      const pulseScale = sinVal * sinVal * 0.015;
      groupRef.current.scale.set(1 + pulseScale, 1 + pulseScale, 1 + pulseScale);
    } else if (groupRef.current.scale.x !== 1) {
      groupRef.current.scale.set(1, 1, 1);
      pulseRef.current = 0;
      invalidate();
    }

    if (slowRotate) {
      groupRef.current.rotation.y += delta * 0.15;
    } else if (groupRef.current.rotation.y !== 0) {
      groupRef.current.rotation.y = 0;
      invalidate();
    }
  });

  return (
    <group ref={groupRef}>
      <Center scale={1.1}>
        <primitive object={clonedScene} />
      </Center>

      {showLabels && (
        <>
          {/* LAD */}
          <group position={[-0.22, -0.05, 0.72]}>
            <Html distanceFactor={4.5} center>
              <button
                id="pin-lad"
                type="button"
                onClick={() => onSelectArtery('LAD')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-sans font-medium transition-colors cursor-pointer shadow-sm ${
                  selectedArtery === 'LAD'
                    ? 'bg-accent text-canvas border border-accent font-semibold ring-2 ring-accent/30'
                    : 'bg-surface text-text border border-border hover:border-border-strong'
                }`}
                title="Illustrative reference: Left anterior descending artery"
              >
                <span className={`w-2 h-2 rounded-full ${selectedArtery === 'LAD' ? 'bg-canvas' : 'bg-accent'}`} />
                <span>LAD</span>
              </button>
            </Html>
          </group>

          {/* RCA */}
          <group position={[0.62, 0.05, 0.42]}>
            <Html distanceFactor={4.5} center>
              <button
                id="pin-rca"
                type="button"
                onClick={() => onSelectArtery('RCA')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-sans font-medium transition-colors cursor-pointer shadow-sm ${
                  selectedArtery === 'RCA'
                    ? 'bg-accent text-canvas border border-accent font-semibold ring-2 ring-accent/30'
                    : 'bg-surface text-text border border-border hover:border-border-strong'
                }`}
                title="Illustrative reference: Right coronary artery"
              >
                <span className={`w-2 h-2 rounded-full ${selectedArtery === 'RCA' ? 'bg-canvas' : 'bg-accent'}`} />
                <span>RCA</span>
              </button>
            </Html>
          </group>

          {/* LCX */}
          <group position={[-0.72, 0.18, 0.15]}>
            <Html distanceFactor={4.5} center>
              <button
                id="pin-lcx"
                type="button"
                onClick={() => onSelectArtery('LCX')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-caption font-sans font-medium transition-colors cursor-pointer shadow-sm ${
                  selectedArtery === 'LCX'
                    ? 'bg-accent text-canvas border border-accent font-semibold ring-2 ring-accent/30'
                    : 'bg-surface text-text border border-border hover:border-border-strong'
                }`}
                title="Illustrative reference: Left circumflex artery"
              >
                <span className={`w-2 h-2 rounded-full ${selectedArtery === 'LCX' ? 'bg-canvas' : 'bg-accent'}`} />
                <span>LCX</span>
              </button>
            </Html>
          </group>

          {/* Aorta */}
          <group position={[0.08, 0.88, -0.05]}>
            <Html distanceFactor={4.5} center>
              <div
                id="label-aortic-root"
                className="bg-surface text-text border border-border px-2 py-0.5 rounded text-caption font-sans font-medium pointer-events-none shadow-xs"
              >
                Aortic root
              </div>
            </Html>
          </group>

          {/* LV Apex */}
          <group position={[-0.25, -0.85, 0.22]}>
            <Html distanceFactor={4.5} center>
              <div
                id="label-lv-apex"
                className="bg-surface text-text border border-border px-2 py-0.5 rounded text-caption font-sans font-medium pointer-events-none shadow-xs"
              >
                LV Apex
              </div>
            </Html>
          </group>

          {/* Interior label */}
          <group position={[0.0, 0.1, 0.6]}>
            <Html distanceFactor={4.5} center>
              <div
                id="label-interior"
                className="bg-surface/80 text-text border border-border px-2 py-0.5 rounded text-caption font-sans pointer-events-none shadow-xs"
              >
                Interior View
              </div>
            </Html>
          </group>
        </>
      )}
    </group>
  );
}

useGLTF.preload('/models/Human_Heart_Interior_View.glb');
