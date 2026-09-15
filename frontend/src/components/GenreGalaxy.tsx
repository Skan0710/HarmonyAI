import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, OrbitControls, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

interface GenreDatum {
  name: string;
  score: number;
}

// Curated high-contrast palette — distinct hues to avoid visual overlap
const PALETTE = [
  '#ff6a43', // 1. Warm Tangerine / Coral (Top genre)
  '#d9a15b', // 2. Golden Amber
  '#38bdf8', // 3. Electric Sky Blue
  '#a855f7', // 4. Royal Purple
  '#10b981', // 5. Emerald Green
  '#f43f5e', // 6. Vivid Rose Pink
  '#eab308', // 7. Solar Yellow
];

const formatName = (name: string): string =>
  name.replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// Crisp, glowing orbit line circle
const OrbitRing: React.FC<{ radius: number; color: string }> = ({ radius, color }) => {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[radius - 0.012, radius + 0.012, 128]} />
      <meshBasicMaterial color={color} transparent opacity={0.38} side={THREE.DoubleSide} />
    </mesh>
  );
};

interface OrbProps {
  genre: GenreDatum;
  index: number;
  maxScore: number;
  radius: number;
  color: string;
  reducedMotion: boolean;
  isTop: boolean;
}

const GenreOrb: React.FC<OrbProps> = ({
  genre,
  index,
  maxScore,
  radius,
  color,
  reducedMotion,
  isTop,
}) => {
  const groupRef = useRef<THREE.Group>(null);
  const size = 0.2 + (genre.score / maxScore) * 0.32;

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    // Subtle float along Y axis while maintaining strict radial alignment along X axis
    groupRef.current.position.y = Math.sin(clock.getElapsedTime() * 1.6 + index * 0.8) * 0.04;
  });

  return (
    <group ref={groupRef} position={[radius, 0, 0]}>
      <Float speed={reducedMotion ? 0 : 1.2} floatIntensity={0.25} rotationIntensity={0.1}>
        <mesh>
          <sphereGeometry args={[size, 32, 32]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={isTop ? 0.9 : 0.55}
            roughness={0.25}
            metalness={0.3}
          />
        </mesh>
        <Html center distanceFactor={7.5} style={{ pointerEvents: 'none' }}>
          <div
            style={{
              fontSize: isTop ? 13 : 11,
              fontWeight: 700,
              color: '#ffffff',
              textShadow: '0 2px 6px rgba(0,0,0,0.95)',
              whiteSpace: 'nowrap',
              transform: 'translateY(26px)',
              background: 'rgba(15, 12, 10, 0.88)',
              padding: '2px 8px',
              borderRadius: '6px',
              border: `1px solid ${color}88`,
              boxShadow: `0 2px 8px rgba(0,0,0,0.6)`,
            }}
          >
            {formatName(genre.name)}
          </div>
        </Html>
      </Float>
    </group>
  );
};

// Center ball clearly labeled and designated as YOU
const CoreNode: React.FC<{ reducedMotion: boolean }> = ({ reducedMotion }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current || reducedMotion) return;
    const pulse = 1 + Math.sin(clock.getElapsedTime() * 2.2) * 0.05;
    groupRef.current.scale.set(pulse, pulse, pulse);
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* Inner luminous core */}
      <mesh>
        <sphereGeometry args={[0.36, 32, 32]} />
        <meshStandardMaterial
          color="#ff6a43"
          emissive="#ff6a43"
          emissiveIntensity={1.3}
          roughness={0.15}
          metalness={0.2}
        />
      </mesh>

      {/* Outer subtle shield */}
      <mesh>
        <sphereGeometry args={[0.45, 18, 18]} />
        <meshStandardMaterial
          color="#ff8c6b"
          emissive="#ff6a43"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* Prominent YOU Label Badge */}
      <Html center distanceFactor={7.5} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'linear-gradient(135deg, #ff6a43, #d9a15b)',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: 12,
            letterSpacing: '0.15em',
            padding: '2.5px 9px',
            borderRadius: '9999px',
            boxShadow: '0 0 16px rgba(255, 106, 67, 0.85), 0 2px 6px rgba(0,0,0,0.8)',
            border: '1.5px solid rgba(255, 255, 255, 0.65)',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            transform: 'translateY(-28px)',
          }}
        >
          YOU
        </div>
      </Html>
    </group>
  );
};

export interface GenreGalaxyProps {
  genres: GenreDatum[];
  reducedMotion: boolean;
}

export const GenreGalaxy: React.FC<GenreGalaxyProps> = ({ genres, reducedMotion }) => {
  const top = useMemo(() => genres.filter((g) => g.name).slice(0, 7), [genres]);
  const maxScore = useMemo(() => Math.max(...top.map((g) => g.score), 0.0001), [top]);

  // Radii for concentric orbits starting from YOU in the center with generous separation
  const orbits = useMemo(() => {
    return top.map((_, i) => 1.35 + i * 1.1);
  }, [top]);

  if (top.length === 0) return null;

  return (
    <Canvas
      camera={{ position: [0, 4.4, 5.8], fov: 46 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={0.7} />
      <pointLight position={[0, 6, 0]} intensity={34} color="#fff1e6" />
      <pointLight position={[-3, -2, -2]} intensity={18} color="#d9a15b" />

      {/* Orbit lines for each genre planet */}
      {top.map((_, i) => (
        <OrbitRing
          key={`orbit-${i}`}
          radius={orbits[i]}
          color={PALETTE[i % PALETTE.length]}
        />
      ))}

      {/* Center core labeled as YOU */}
      <CoreNode reducedMotion={reducedMotion} />

      {/* Planets aligned along one line extending outward from YOU */}
      {top.map((g, i) => (
        <GenreOrb
          key={g.name}
          genre={g}
          index={i}
          maxScore={maxScore}
          radius={orbits[i]}
          color={PALETTE[i % PALETTE.length]}
          reducedMotion={reducedMotion}
          isTop={i === 0}
        />
      ))}

      <Sparkles count={45} scale={6} size={1.6} speed={reducedMotion ? 0 : 0.2} color="#d9a15b" opacity={0.45} />

      <OrbitControls
        target={[top.length > 1 ? 1.2 : 0, 0, 0]}
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        maxPolarAngle={Math.PI * 0.65}
        minPolarAngle={Math.PI * 0.25}
      />
    </Canvas>
  );
};
