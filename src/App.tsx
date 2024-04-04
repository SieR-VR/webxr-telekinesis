import React, { RefObject, useEffect, useRef, useState } from "react";
import {
  Box3,
  ColorRepresentation,
  Euler,
  LineSegments,
  Mesh,
  Ray,
  Vector3,
} from "three";
import { Physics, useBox, usePlane } from "@react-three/cannon";
import { Canvas, useFrame } from "@react-three/fiber";
import { Box, Line, Sky } from "@react-three/drei";
import {
  Controllers,
  VRButton,
  XR,
  useController,
  useXR,
} from "@react-three/xr";

function eulerToRay(origin: Vector3, euler: Euler): Ray {
  const forward = new Vector3(0, 0, -1);

  return new Ray(origin, forward.applyEuler(euler));
}

function ButtonIndicator({ hand }: { hand: "left" | "right" }) {
  const { player } = useXR();
  const controller = useController(hand);
  const [meshRef, api] = useBox<Mesh>(() => ({
    mass: 10,
    scale: [0.5, 0.5, 0.5],
    position: [0, 1, 0],
  }));

  const [intersects, setIntersects] = useState(false);
  const [controllerRay, setControllerRay] = useState<Ray | null>(null);

  const recentControllerPosList = useRef<Vector3[]>([]);
  const averageSpeedRef = useRef(new Vector3(0, 0, 0));
  const velocityRef = useRef([0, 0, 0] as [number, number, number]);

  const color = intersects ? "red" : "green";

  useEffect(() => api.velocity.subscribe((v) => velocityRef.current = v), [])
  useEffect(() => api.position.subscribe((v) => {
    if (!meshRef.current) return;
    meshRef.current.position.fromArray(v);
    meshRef.current.geometry.computeBoundingBox();
  }), [])

  useFrame(() => {
    if (!meshRef.current) return;

    const [camera] = player.children;
    const mesh = meshRef.current;

    const ray = eulerToRay(camera.position, camera.rotation);

    const intersects = ray.intersectsBox(new Box3().setFromObject(mesh));
    setIntersects(intersects);
  });

  useFrame(() => {
    if (!meshRef.current) return;

    if (intersects) {
      const updated = new Vector3().fromArray(velocityRef.current).add(averageSpeedRef.current);

      api.velocity.copy(updated);
    }
  });

  useFrame((_, dt) => {
    if (!controller) return;
    const [con] = controller.children;
    setControllerRay(eulerToRay(con.position, con.rotation));

    // Store five recent controller positions
    recentControllerPosList.current.push(con.position.clone());
    if (recentControllerPosList.current.length > 5) {
      recentControllerPosList.current.shift();
    }

    // Calculate the average speed of the controller
    const averageSpeed = recentControllerPosList.current
      .map((v, i, arr) => {
        if (i === 0) return new Vector3(0, 0, 0);
        return v
          .clone()
          .sub(arr[i - 1])
          .divideScalar(dt);
      })
      .reduce((acc, cur) => acc.add(cur), new Vector3(0, 0, 0))
      .divideScalar(recentControllerPosList.current.length);

    averageSpeedRef.current = averageSpeed.divideScalar(10);
  });

  return (
    <>
      <mesh ref={meshRef}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </>
  );
}

function Plane() {
  const [ref] = usePlane<Mesh>(() => ({ rotation: [-Math.PI / 2, 0, 0] }));

  return (
    <mesh ref={ref}>
      <planeGeometry args={[40, 40]} />
      <meshStandardMaterial color="lightblue" />
    </mesh>
  );
}

export default function App() {
  return (
    <>
      <VRButton />
      <Canvas camera={{ position: [0, 5, 0] }}>
        <XR>
          <Physics gravity={[0, 0, 0]}>
            <Sky sunPosition={[0, 1, 0]} />
            <Controllers />
            <ambientLight intensity={Math.PI / 2} />
            <Plane />
            <ButtonIndicator hand="right" />
          </Physics>
        </XR>
      </Canvas>
    </>
  );
}
