import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles } from '@react-three/drei';
import type * as THREE from 'three';

interface OrganismProps {
  color: string;
  distortIntensity: number;
  speed: number;
  sparkleCount: number;
  spin: boolean;
}

const Organism: React.FC<OrganismProps> = ({ color, distortIntensity, speed, sparkleCount, spin }) => {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current && spin) {
      groupRef.current.rotation.y += delta * 0.15;
      groupRef.current.rotation.x += delta * 0.03;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <icosahedronGeometry args={[1.4, 6]} />
        <MeshDistortMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.3}
          roughness={0.35}
          metalness={0.1}
          distort={distortIntensity}
          speed={speed}
        />
      </mesh>
      <Sparkles count={sparkleCount} scale={4.5} size={2.5} speed={0.25} color={color} opacity={0.6} />
    </group>
  );
};

interface MusicTwinOrganismProps {
  color: string;
  distortIntensity: number;
  speed: number;
  sparkleCount: number;
  reducedMotion: boolean;
}

export const MusicTwinOrganism: React.FC<MusicTwinOrganismProps> = ({
  color,
  distortIntensity,
  speed,
  sparkleCount,
  reducedMotion,
}) => {
  return (
    <Canvas camera={{ position: [0, 0, 4.2], fov: 42 }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'low-power' }}>
      <ambientLight intensity={0.6} />
      <pointLight position={[3, 3, 3]} intensity={30} color="#ffe0d0" />
      <pointLight position={[-3, -2, -2]} intensity={12} color="#d9a15b" />
      <Organism
        color={color}
        distortIntensity={distortIntensity}
        speed={reducedMotion ? 0 : speed}
        sparkleCount={sparkleCount}
        spin={!reducedMotion}
      />
    </Canvas>
  );
};
