import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
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
  artist: '#d9a15b',
  mood: '#7ba98a',
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

interface NodeMeshProps {
  node: DnaNode;
  position: [number, number, number];
  isHovered: boolean;
  isSelected: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string) => void;
}

const NodeMesh: React.FC<NodeMeshProps> = ({ node, position, isHovered, isSelected, onHover, onSelect }) => {
  const score = Math.max(0.05, Math.min(1, node.item.score ?? 0.5));
  const size = 0.09 + score * 0.16;
  const color = CATEGORY_COLOR[node.category];
  const emphasis = isHovered || isSelected;

  return (
    <group position={position}>
      <Line points={[[0, 0, 0], [-position[0], -position[1], -position[2]]]} color={color} transparent opacity={0.08 + score * 0.18} lineWidth={1} />
      <mesh
        scale={emphasis ? 1.4 : 1}
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
        <icosahedronGeometry args={[size, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={emphasis ? 0.9 : 0.25 + score * 0.3}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
};

const CoreNode: React.FC<{ spin: boolean }> = ({ spin }) => {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current || !spin) return;
    const t = clock.getElapsedTime();
    const s = 1 + Math.sin(t * 1.2) * 0.04;
    ref.current.scale.setScalar(s);
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.34, 1]} />
      <meshStandardMaterial color="#ff6a43" emissive="#ff6a43" emissiveIntensity={0.6} roughness={0.3} />
    </mesh>
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

  useFrame((_, delta) => {
    if (groupRef.current && spin) {
      groupRef.current.rotation.y += delta * 0.06;
    }
  });

  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[4, 4, 4]} intensity={40} color="#ffe0d0" />
      <pointLight position={[-4, -3, -3]} intensity={15} color="#d9a15b" />
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
              onHover={onHover}
              onSelect={onSelect}
            />
          );
        })}
      </group>
      <OrbitControls
        enablePan={false}
        enableZoom={true}
        minDistance={3.2}
        maxDistance={7}
        autoRotate={false}
      />
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
