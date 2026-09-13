import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, QuadraticBezierLine, Stars, Float } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { TasteItem } from '../services/musicIntelligenceService';

export type DnaNodeCategory = 'genre' | 'artist' | 'mood';

export interface DnaNode {
  id: string;
  category: DnaNodeCategory;
  item: TasteItem;
}

const CATEGORY_COLOR: Record<DnaNodeCategory, string> = {
  genre: '#ff6a43',
  artist: '#e8b04f',
  mood: '#6fcf9e',
};

const CATEGORY_BAND: Record<DnaNodeCategory, [number, number]> = {
  genre: [1.0, 2.0],
  artist: [1.8, 2.8],
  mood: [2.6, 3.6],
};

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function fibonacciPoint(index: number, total: number): [number, number, number] {
  const y = total <= 1 ? 0 : 1 - (index / (total - 1)) * 2;
  const radiusAtY = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = GOLDEN_ANGLE * index;
  return [Math.cos(theta) * radiusAtY, y, Math.sin(theta) * radiusAtY];
}

function buildPositions(nodes: DnaNode[]): Map<string, [number, number, number]> {
  const positions = new Map<string, [number, number, number]>();
  const byCategory: Record<DnaNodeCategory, DnaNode[]> = { genre: [], artist: [], mood: [] };
  nodes.forEach((n) => byCategory[n.category].push(n));

  (Object.keys(byCategory) as DnaNodeCategory[]).forEach((category) => {
    const list = byCategory[category];
    const [minR, maxR] = CATEGORY_BAND[category];
    list.forEach((node, i) => {
      const [ux, uy, uz] = fibonacciPoint(i, list.length);
      const score = Math.max(0.05, Math.min(1, node.item.score ?? 0.5));
      const radius = maxR - score * (maxR - minR);
      positions.set(node.id, [ux * radius, uy * radius * 0.75, uz * radius]);
    });
  });

  return positions;
}

// Each category reads as a distinct "kind of matter" in the constellation —
// genres are the broad, rounded masses; artists are faceted crystals; moods
// are open rings drifting further out. Swapping in per-category geometry
// (instead of one repeated low-poly icosahedron everywhere) is what makes
// the scene read as a structured system rather than a scatter of identical gems.
const CategoryGeometry: React.FC<{ category: DnaNodeCategory; size: number }> = ({ category, size }) => {
  switch (category) {
    case 'genre':
      return <icosahedronGeometry args={[size, 3]} />;
    case 'artist':
      return <octahedronGeometry args={[size * 1.15, 0]} />;
    case 'mood':
    default:
      return <torusGeometry args={[size * 0.9, size * 0.34, 12, 28]} />;
  }
};

interface NodeMeshProps {
  node: DnaNode;
  position: [number, number, number];
  isHovered: boolean;
  isSelected: boolean;
  dimmed: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const NodeMesh: React.FC<NodeMeshProps> = ({ node, position, isHovered, isSelected, dimmed, onHover, onSelect }) => {
  const score = Math.max(0.05, Math.min(1, node.item.score ?? 0.5));
  const size = 0.1 + score * 0.17;
  const color = CATEGORY_COLOR[node.category];
  const emphasis = isHovered || isSelected;
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    if (!meshRef.current) return;
    meshRef.current.rotation.y += delta * (node.category === 'artist' ? 0.35 : 0.15);
    meshRef.current.rotation.x = Math.sin(clock.getElapsedTime() * 0.4 + position[0]) * 0.15;
  });

  const origin = useMemo<[number, number, number]>(() => [0, 0, 0], []);
  const mid = useMemo<[number, number, number]>(
    () => [position[0] * 0.5, position[1] * 0.5 + 0.25, position[2] * 0.5],
    [position]
  );

  return (
    <group position={position}>
      <QuadraticBezierLine
        start={[-position[0], -position[1], -position[2]]}
        end={origin}
        mid={[mid[0] - position[0], mid[1] - position[1], mid[2] - position[2]]}
        color={color}
        transparent
        opacity={dimmed ? 0.04 : 0.1 + score * 0.22}
        lineWidth={emphasis ? 1.6 : 0.8}
      />
      <Float speed={1.4} rotationIntensity={0.2} floatIntensity={0.6}>
        <mesh
          ref={meshRef}
          scale={emphasis ? 1.45 : 1}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover(node.id);
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            onHover(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(node.id);
          }}
        >
          <CategoryGeometry category={node.category} size={size} />
          <meshPhysicalMaterial
            color={color}
            emissive={color}
            emissiveIntensity={emphasis ? 1.4 : dimmed ? 0.15 : 0.5 + score * 0.4}
            roughness={0.25}
            metalness={0.15}
            clearcoat={0.6}
            clearcoatRoughness={0.3}
            transparent
            opacity={dimmed ? 0.35 : 1}
          />
        </mesh>
      </Float>
    </group>
  );
};

const CoreNode: React.FC<{ spin: boolean }> = ({ spin }) => {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const ringARef = useRef<THREE.Mesh>(null);
  const ringBRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();
    if (coreRef.current) {
      const s = 1 + Math.sin(t * 1.2) * 0.05;
      coreRef.current.scale.setScalar(s);
    }
    if (shellRef.current && spin) {
      shellRef.current.rotation.y += delta * 0.12;
      shellRef.current.rotation.x += delta * 0.05;
    }
    // Two counter-rotating rings suggest a double-helix strand orbiting the
    // core — a much stronger "this is your DNA" read than a static sphere.
    if (ringARef.current && spin) ringARef.current.rotation.y += delta * 0.5;
    if (ringBRef.current && spin) ringBRef.current.rotation.y -= delta * 0.5;
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[0.32, 4]} />
        <meshPhysicalMaterial
          color="#ff6a43"
          emissive="#ff6a43"
          emissiveIntensity={0.85}
          roughness={0.15}
          metalness={0.2}
          clearcoat={1}
        />
      </mesh>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.46, 1]} />
        <meshBasicMaterial color="#ffb08a" wireframe transparent opacity={0.25} />
      </mesh>
      <mesh ref={ringARef} rotation={[Math.PI / 2.3, 0, 0]}>
        <torusGeometry args={[0.62, 0.008, 8, 64]} />
        <meshBasicMaterial color="#ff8a5c" transparent opacity={0.55} />
      </mesh>
      <mesh ref={ringBRef} rotation={[Math.PI / 2.3, Math.PI / 2, 0]}>
        <torusGeometry args={[0.62, 0.008, 8, 64]} />
        <meshBasicMaterial color="#d9a15b" transparent opacity={0.4} />
      </mesh>
    </group>
  );
};

const Scene: React.FC<{
  nodes: DnaNode[];
  spin: boolean;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}> = ({ nodes, spin, hoveredId, selectedId, onHover, onSelect }) => {
  const positions = useMemo(() => buildPositions(nodes), [nodes]);
  const groupRef = useRef<THREE.Group>(null);
  const activeId = hoveredId || selectedId;

  useFrame((_, delta) => {
    if (groupRef.current && spin) {
      groupRef.current.rotation.y += delta * 0.06;
    }
  });

  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[4, 4, 4]} intensity={45} color="#ffe0d0" />
      <pointLight position={[-4, -3, -3]} intensity={18} color="#d9a15b" />
      <pointLight position={[0, 0, 0]} intensity={12} color="#ff8a5c" distance={4} />
      <Stars radius={7} depth={12} count={900} factor={0.7} saturation={0} fade speed={0.4} />
      <group ref={groupRef}>
        <CoreNode spin={spin} />
        {nodes.map((node) => {
          const pos = positions.get(node.id);
          if (!pos) return null;
          return (
            <NodeMesh
              key={node.id}
              node={node}
              position={pos}
              isHovered={hoveredId === node.id}
              isSelected={selectedId === node.id}
              dimmed={Boolean(activeId) && activeId !== node.id}
              onHover={onHover}
              onSelect={onSelect}
            />
          );
        })}
      </group>
      <OrbitControls enablePan={false} enableZoom minDistance={3.2} maxDistance={7} autoRotate={false} />
      <EffectComposer>
        <Bloom intensity={0.55} luminanceThreshold={0.2} luminanceSmoothing={0.35} mipmapBlur radius={0.6} />
        <Vignette eskil={false} offset={0.15} darkness={0.6} />
      </EffectComposer>
    </>
  );
};

interface MusicDnaConstellationProps {
  nodes: DnaNode[];
  reducedMotion: boolean;
  hoveredId: string | null;
  selectedId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

export const MusicDnaConstellation: React.FC<MusicDnaConstellationProps> = ({
  nodes,
  reducedMotion,
  hoveredId,
  selectedId,
  onHover,
  onSelect,
}) => {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 5.2], fov: 45 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <color attach="background" args={['#0c0a09']} />
      <fog attach="fog" args={['#0c0a09', 6, 11]} />
      <Scene
        nodes={nodes}
        spin={!reducedMotion}
        hoveredId={hoveredId}
        selectedId={selectedId}
        onHover={onHover}
        onSelect={onSelect}
      />
    </Canvas>
  );
};
