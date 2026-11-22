import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { CanvasTexture, SRGBColorSpace } from 'three';

const states = {
  ready: 'En cola', running: 'Ejecutando', io: 'I/O pendiente', blocked: 'Hilo bloqueado',
  done: 'Terminada', switch: 'Cambio de contexto', idle: 'Ocioso',
};
export const colors = ['#4885ee', '#eb7356', '#39ad86', '#be74e6', '#e6ad3f', '#45aabe'];
export const status = (state, show) => state === 'switch' && !show ? 'Preparando' : states[state];

function Label({ text, position }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const context = canvas.getContext('2d');
    context.fillStyle = '#20354a';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#ffffff';
    context.font = 'bold 49px sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 42);
    const label = new CanvasTexture(canvas);
    label.colorSpace = SRGBColorSpace;
    return label;
  }, [text]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <sprite position={position} scale={[.9, .28, 1]}>
    <spriteMaterial map={texture} depthTest={false} toneMapped={false} />
  </sprite>;
}

function Token({ id, state, x, z }) {
  const mesh = useRef();
  const start = useRef([x, .55, z]);
  useFrame((_, delta) => {
    mesh.current.position.x += (x - mesh.current.position.x) * (1 - Math.exp(-12 * delta));
    mesh.current.position.z += (z - mesh.current.position.z) * (1 - Math.exp(-12 * delta));
    if (state === 'running') mesh.current.rotation.y += delta * 1.25;
  });
  return (
    <mesh ref={mesh} position={start.current} onUpdate={(object) => {
      object.position.y = .55;
    }}>
      <boxGeometry args={[.53, .53, .53]} />
      <meshStandardMaterial color={colors[id]} />
      <Label position={[0, .62, 0]} text={`T${id + 1}`} />
    </mesh>
  );
}

export default function Scene({ frame, reduced, show }) {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (reduced) return;
    try {
      const gl = document.createElement('canvas').getContext('webgl2');
      setAvailable(Boolean(gl));
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    } catch {
      setAvailable(false);
    }
  }, [reduced]);

  const slotX = (index) => (index - (frame.slots.length - 1) / 2) * 1.5;
  return (
    <>
      {available && !reduced && (
        <div className="sim-scene">
          <Canvas camera={{ position: [5, 6, 8], fov: 40 }} fallback={null}>
            <ambientLight intensity={1.5} />
            <directionalLight position={[3, 5, 2]} intensity={2} />
            {frame.slots.map(({ state }, index) => (
              <mesh key={index} position={[slotX(index), 0, 0]}>
                <boxGeometry args={[1.22, .25, 1.12]} />
                <meshStandardMaterial color={state === 'blocked' ? '#aa412d' : '#345473'} />
                <Label position={[0, .42, -.68]} text={`CPU ${index + 1}`} />
              </mesh>
            ))}
            {frame.tasks.map(({ state }, id) => {
              const lane = frame.slots.findIndex((slot) => slot.id === id);
              const row = state === 'io' ? -2.2 : state === 'done' ? 2.6 : 1.45;
              return <Token key={id} id={id} state={state}
                x={lane >= 0 ? slotX(lane) : (id - (frame.tasks.length - 1) / 2) * .88}
                z={lane >= 0 ? 0 : row} />;
            })}
            <OrbitControls minDistance={3} maxDistance={17} enablePan={false} />
          </Canvas>
        </div>
      )}
      <div className="sim-states">
        {frame.slots.map(({ id, state }, index) => (
          <span className="sim-chip" key={index}>CPU {index + 1} · {id === undefined ? '' : `T${id + 1} · `}{status(state, show)}</span>
        ))}
      </div>
    </>
  );
}

