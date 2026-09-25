import React, { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei'
import * as THREE from 'three'

/* Floating organic orb */
function GreenOrb({ position, scale, speed = 1, distort = 0.4, color = '#22c55e' }) {
  const meshRef = useRef()
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = clock.elapsedTime * 0.2 * speed
      meshRef.current.rotation.y = clock.elapsedTime * 0.3 * speed
    }
  })
  return (
    <Float speed={speed} rotationIntensity={0.5} floatIntensity={2}>
      <Sphere ref={meshRef} args={[1, 64, 64]} position={position} scale={scale}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={distort}
          speed={2}
          roughness={0}
          metalness={0.1}
          transparent
          opacity={0.25}
        />
      </Sphere>
    </Float>
  )
}

/* Animated torus ring */
function AnimatedRing({ position, rotation, color }) {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.x = clock.elapsedTime * 0.15
      ref.current.rotation.z = clock.elapsedTime * 0.1
    }
  })
  return (
    <mesh ref={ref} position={position} rotation={rotation}>
      <torusGeometry args={[2, 0.04, 16, 100]} />
      <meshStandardMaterial color={color} transparent opacity={0.2} />
    </mesh>
  )
}

/* Floating leaf particles */
function Particles({ count = 60 }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3]     = (Math.random() - 0.5) * 20
      arr[i * 3 + 1] = (Math.random() - 0.5) * 10
      arr[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return arr
  }, [count])

  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) {
      ref.current.rotation.y = clock.elapsedTime * 0.04
      ref.current.rotation.x = Math.sin(clock.elapsedTime * 0.02) * 0.1
    }
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={positions}
          count={count}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        color="#4ade80"
        size={0.06}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  )
}

export default function Scene3D({ className = '' }) {
  return (
    <div className={`w-full h-full ${className}`} style={{ pointerEvents: 'none' }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.3} color="#22c55e" />
        <directionalLight position={[5, 5, 5]} intensity={0.8} color="#86efac" />
        <pointLight position={[-5, 3, 0]} intensity={0.5} color="#4ade80" />

        <Stars radius={80} depth={50} count={3000} factor={4} saturation={0} fade speed={1} />
        <Particles count={80} />

        <GreenOrb position={[-3.5, 1, -2]} scale={2.2} speed={0.8} color="#16a34a" distort={0.5} />
        <GreenOrb position={[4, -1, -3]} scale={1.6} speed={1.2} color="#22c55e" distort={0.3} />
        <GreenOrb position={[0.5, 2.5, -4]} scale={1.2} speed={0.6} color="#4ade80" distort={0.6} />
        <GreenOrb position={[-1, -2, -1]} scale={0.8} speed={1.5} color="#a3e635" distort={0.4} />

        <AnimatedRing position={[-2, 0, -3]} rotation={[0.5, 0, 0]} color="#22c55e" />
        <AnimatedRing position={[3, 1, -5]} rotation={[0.3, 0.5, 0]} color="#4ade80" />
      </Canvas>
    </div>
  )
}
