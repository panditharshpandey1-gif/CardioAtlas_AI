import { Html } from '@react-three/drei';
import type { ClinicalSignal, ClinicalSignalId } from '../../features/heart-intelligence/clinicalSignals';

interface Props {
  signals: ClinicalSignal[];
  selectedId: ClinicalSignalId | null;
  onSelect: (id: ClinicalSignalId) => void;
  modelScore?: number | null;
}

/** Schematic callouts orbit the generic heart reference. None of the marker
 * positions indicate the anatomic site of a disease or an artery obstruction. */
export function PatientSignalOverlay3D({ signals, selectedId, onSelect, modelScore }: Props) {
  const haloColor = modelScore == null ? '#61c4d3' : modelScore >= 66 ? '#ff5c83' : modelScore >= 33 ? '#ffb56a' : '#5ce3c4';
  return <group>
    <mesh rotation={[Math.PI / 2.35, 0, .1]}>
      <torusGeometry args={[1.23, .006, 6, 128]}/>
      <meshBasicMaterial color={haloColor} transparent opacity={0.56} depthWrite={false}/>
    </mesh>
    <mesh rotation={[Math.PI / 2.75, .12, -.45]}>
      <torusGeometry args={[1.37, .003, 6, 128]}/>
      <meshBasicMaterial color={haloColor} transparent opacity={0.25} depthWrite={false}/>
    </mesh>
    {signals.map(signal => <group key={signal.id} position={signal.position}>
      <mesh>
        <sphereGeometry args={[selectedId === signal.id ? .047 : .032, 16, 12]}/>
        <meshBasicMaterial color={signal.flagged ? '#ff6984' : '#73efcf'}/>
      </mesh>
      <Html center distanceFactor={5.5} zIndexRange={[30, 3]}>
        <button
          className={`atlas-3d-signal ${signal.flagged ? 'is-watch' : 'is-context'} ${selectedId === signal.id ? 'is-selected' : ''}`}
          type="button" title={`Schematic data callout: ${signal.label}. Not a lesion location.`}
          aria-label={`${signal.label}: ${signal.reading}. View details`}
          onClick={event => { event.stopPropagation(); onSelect(signal.id); }}
        >
          <i aria-hidden="true"/>
          <span>{signal.shortLabel}</span>
          <strong>{signal.reading}</strong>
        </button>
      </Html>
    </group>)}
  </group>;
}
