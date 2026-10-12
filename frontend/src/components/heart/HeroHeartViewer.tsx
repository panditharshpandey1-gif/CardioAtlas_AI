import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Center, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { Group } from 'three';
import { Heart, Rotate3D } from 'lucide-react';
import { ModelErrorBoundary } from './ErrorBoundary';

function checkWebGL() {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch { return false; }
}

function HeartObject({ spinning }: { spinning: boolean }) {
  const { scene } = useGLTF('/models/realistic_human_heart.glb');
  const root = useRef<Group>(null);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    cloned.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });
  }, [cloned]);
  useFrame((state, delta) => {
    if (!root.current) return;
    if (spinning) root.current.rotation.y += Math.min(delta, 0.05) * 0.13;
    root.current.position.y = Math.sin(state.clock.elapsedTime * 1.2) * 0.035;
    const beat = 1 + Math.pow(Math.max(0, Math.sin(state.clock.elapsedTime * Math.PI * 1.1)), 12) * 0.014;
    root.current.scale.setScalar(beat);
  });
  return (
    <group ref={root} rotation={[0.12, -0.28, -0.05]}>
      <Center><primitive object={cloned} scale={1.62} /></Center>
    </group>
  );
}

export function HeroHeartViewer() {
  const [spin, setSpin] = useState(true);
  const [supported] = useState(checkWebGL);
  if (!supported) {
    return (
      <div className="hero-heart-fallback">
        <Heart size={130} strokeWidth={0.7} />
        <span>3D visualization available in a WebGL-enabled browser</span>
      </div>
    );
  }
  return (
    <div className="hero-model-wrap" aria-label="Interactive rotating anatomical heart model">
      <ModelErrorBoundary onRetry={() => setSpin(true)}>
        <Suspense fallback={<div className="hero-heart-loading"><span className="heart-loader"/><p>Preparing anatomy...</p></div>}>
          <Canvas camera={{ position: [0, 0.2, 3.3], fov: 42 }} dpr={[1, 1.75]} gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}>
            <ambientLight intensity={1.45} />
            <hemisphereLight args={['#dde5ff', '#181129', 1.65]} />
            <spotLight position={[3, 5, 5]} angle={0.5} penumbra={1} intensity={80} color="#fff3e9" />
            <directionalLight position={[-4, 1, 2]} intensity={2.5} color="#ff708f" />
            <directionalLight position={[3, -2, -3]} intensity={1.9} color="#8c9dff" />
            <HeartObject spinning={spin} />
            <OrbitControls enablePan={false} enableZoom minDistance={2.3} maxDistance={5} enableDamping dampingFactor={0.08} onStart={() => setSpin(false)} />
          </Canvas>
        </Suspense>
      </ModelErrorBoundary>
      <button className="hero-rotate-btn" onClick={() => setSpin(!spin)} type="button" title="Toggle anatomical rotation">
        <Rotate3D size={15} /> {spin ? 'Pause rotation' : 'Auto rotate'}
      </button>
    </div>
  );
}

useGLTF.preload('/models/realistic_human_heart.glb');
