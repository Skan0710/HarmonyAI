import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { MeshDistortMaterial, Sparkles, OrbitControls, Float } from '@react-three/drei';
import * as THREE from 'three';

interface OrganismProps {
  primaryColor: string;
  secondaryColor: string;
  coreColor: string;
  distortIntensity: number;
  speed: number;
  sparkleCount: number;
  diversityFactor: number;
  reducedMotion: boolean;
}

const OrganismContent: React.FC<OrganismProps> = ({
  primaryColor,
  secondaryColor,
  coreColor,
  distortIntensity,
  speed,
  sparkleCount,
  diversityFactor,
  reducedMotion,
}) => {
  const mainGroupRef = useRef<THREE.Group>(null);
  const coreRef = useRef<THREE.Mesh>(null);
  const wireframeRef = useRef<THREE.Mesh>(null);
  const ring1Ref = useRef<THREE.Group>(null);
  const ring2Ref = useRef<THREE.Group>(null);
  const satellitesRef = useRef<THREE.Group>(null);

  // Satellite node data
  const satellites = useMemo(
    () => [
      { radius: 2.1, speed: 0.8, offset: 0, size: 0.08, color: secondaryColor },
      { radius: 2.3, speed: -0.6, offset: Math.PI * 0.6, size: 0.065, color: primaryColor },
      { radius: 2.5, speed: 0.5, offset: Math.PI * 1.3, size: 0.075, color: coreColor },
    ],
    [primaryColor, secondaryColor, coreColor]
  );

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();

    if (!reducedMotion) {
      // Main rotation
      if (mainGroupRef.current) {
        mainGroupRef.current.rotation.y += delta * 0.12;
      }

      // Nucleus rhythmic pulse (breathing acoustic core)
      if (coreRef.current) {
        const pulse = 0.72 + Math.sin(elapsed * speed * 2.2) * 0.06;
        coreRef.current.scale.set(pulse, pulse, pulse);
      }

      // Wireframe counter-rotation
      if (wireframeRef.current) {
        wireframeRef.current.rotation.y -= delta * 0.08;
        wireframeRef.current.rotation.z += delta * 0.04;
      }

      // Harmonic orbital rings rotation
      if (ring1Ref.current) {
        ring1Ref.current.rotation.z += delta * 0.25;
      }
      if (ring2Ref.current) {
        ring2Ref.current.rotation.z -= delta * 0.18;
      }

      // Satellites orbital position
      if (satellitesRef.current) {
        satellitesRef.current.children.forEach((child, i) => {
          const sat = satellites[i];
          if (sat) {
            const angle = elapsed * sat.speed + sat.offset;
            child.position.x = Math.cos(angle) * sat.radius;
            child.position.z = Math.sin(angle) * sat.radius;
            child.position.y = Math.sin(angle * 2) * 0.35;
            child.rotation.x += delta * 1.2;
            child.rotation.y += delta * 0.8;
          }
        });
      }
    }
  });

  return (
    <group ref={mainGroupRef}>
      {/* 1. Inner Acoustic Nucleus (Pulsing Energy Core) */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.7, 32, 32]} />
        <meshStandardMaterial
          color={coreColor}
          emissive={coreColor}
          emissiveIntensity={0.85}
          roughness={0.2}
          metalness={0.4}
        />
      </mesh>

      {/* 2. Fluid Organic Biomembrane (Exploration Distortion) */}
      <Float speed={reducedMotion ? 0 : 1.5} rotationIntensity={0.2} floatIntensity={0.3}>
        <mesh>
          <icosahedronGeometry args={[1.38, 7]} />
          <MeshDistortMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={0.35}
            roughness={0.25}
            metalness={0.2}
            distort={distortIntensity}
            speed={reducedMotion ? 0 : speed * 1.2}
          />
        </mesh>
      </Float>

      {/* 3. Ethereal Geodesic Resonance Grid (Acoustic Wireframe) */}
      <mesh ref={wireframeRef}>
        <icosahedronGeometry args={[1.45, 3]} />
        <meshBasicMaterial
          color={secondaryColor}
          wireframe
          transparent
          opacity={0.16}
        />
      </mesh>

      {/* 4. Primary Harmonic Resonance Ring (Exploration Dimension) */}
      <group ref={ring1Ref} rotation={[Math.PI / 4, Math.PI / 6, 0]}>
        <mesh>
          <torusGeometry args={[2.08, 0.014, 16, 96]} />
          <meshStandardMaterial
            color={secondaryColor}
            emissive={secondaryColor}
            emissiveIntensity={0.7}
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>

      {/* 5. Secondary Harmonic Resonance Ring (Taste Diversity Dimension) */}
      <group ref={ring2Ref} rotation={[-Math.PI / 3, -Math.PI / 5, 0]}>
        <mesh>
          <torusGeometry args={[2.35, 0.012, 16, 96]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={0.6}
            transparent
            opacity={0.45 * (0.6 + diversityFactor * 0.4)}
          />
        </mesh>
      </group>

      {/* 6. Orbiting Taste Satellites */}
      <group ref={satellitesRef}>
        {satellites.map((sat, i) => (
          <mesh key={i}>
            <octahedronGeometry args={[sat.size, 0]} />
            <meshStandardMaterial
              color={sat.color}
              emissive={sat.color}
              emissiveIntensity={0.9}
              roughness={0.2}
            />
          </mesh>
        ))}
      </group>

      {/* 7. Ambient Particle Atmosphere (Rarity Stardust) */}
      <Sparkles
        count={sparkleCount}
        scale={4.8}
        size={2.4}
        speed={reducedMotion ? 0 : 0.35}
        color={secondaryColor}
        opacity={0.7}
      />
    </group>
  );
};

export interface MusicTwinOrganismProps {
  color?: string;
  secondaryColor?: string;
  coreColor?: string;
  distortIntensity: number;
  speed: number;
  sparkleCount: number;
  diversityFactor?: number;
  reducedMotion: boolean;
}

export const MusicTwinOrganism: React.FC<MusicTwinOrganismProps> = ({
  color = '#ff6a43',
  secondaryColor = '#ffd166',
  coreColor = '#ff3366',
  distortIntensity,
  speed,
  sparkleCount,
  diversityFactor = 0.7,
  reducedMotion,
}) => {
  return (
    <Canvas
      camera={{ position: [0, 0, 4.4], fov: 42 }}
      dpr={[1, 1.75]}
      gl={{ antialias: true, powerPreference: 'low-power' }}
    >
      <ambientLight intensity={0.55} />
      {/* Dynamic Key & Rim Lights for Depth & Dimension */}
      <pointLight position={[3.5, 3.5, 3]} intensity={35} color="#fff1e6" />
      <pointLight position={[-3.5, -2, -2.5]} intensity={18} color={secondaryColor} />
      <pointLight position={[0, -3.5, 2]} intensity={15} color={coreColor} />

      <OrganismContent
        primaryColor={color}
        secondaryColor={secondaryColor}
        coreColor={coreColor}
        distortIntensity={distortIntensity}
        speed={speed}
        sparkleCount={sparkleCount}
        diversityFactor={diversityFactor}
        reducedMotion={reducedMotion}
      />

      <OrbitControls
        enableZoom={false}
        enablePan={false}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.5}
        maxPolarAngle={Math.PI * 0.75}
        minPolarAngle={Math.PI * 0.25}
      />
    </Canvas>
  );
};
