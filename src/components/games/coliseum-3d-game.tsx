"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import ParticipantInput, {
  PlayerParticipant,
  PARTICIPANT_COLORS,
  DEFAULT_COMPETITORS,
} from "@/components/games/shared/participant-input";
import { sounds } from "@/lib/audio";
import { useWallet } from "@/lib/wallet-context";
import { formatFichas } from "@/lib/format";

/* ─── Gladiator Types ─── */
interface Gladiator extends PlayerParticipant {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  title: string;
  isAlive: boolean;
  rank?: number;
  kills: number;
  rage: number;
  // 3D references
  mesh?: THREE.Group;
  swordMesh?: THREE.Mesh;
  shieldMesh?: THREE.Mesh;
  rightArm?: THREE.Group;
  leftArm?: THREE.Group;
  leftLeg?: THREE.Group;
  rightLeg?: THREE.Group;
  targetPos: THREE.Vector3;
  targetGladiator?: Gladiator | null;
  attackCooldown: number;
  isAttacking: boolean;
  attackProgress: number;
  isBlocking: boolean;
  hitFlashTime: number;
  deathTime: number;
  walkCycle: number;
}

type Phase = "setup" | "intro" | "tournament" | "ceremony";
type CamMode = "orbit" | "action" | "overhead" | "hero";

const TITLES = [
  "El Destructor",
  "Furia del Norte",
  "Espada de Oro",
  "El Inmortal",
  "Coloso de Roma",
  "Sombra Letal",
  "Martillo Imperial",
  "El Centurión",
  "Halcón Sangriento",
  "Titán del Trueno",
  "León de Arena",
  "La Tempestad",
];

export default function Coliseum3DGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<Phase>("setup");
  const [camMode, setCamMode] = useState<CamMode>("orbit");
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);
  const [roundLabel, setRoundLabel] = useState<string>("Ronda Preliminar");
  const [flashBanner, setFlashBanner] = useState<string | null>(null);

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({
      id: `c3d-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);
  const [champion, setChampion] = useState<Gladiator | null>(null);
  const [standings, setStandings] = useState<Gladiator[]>([]);
  const [commentary, setCommentary] = useState<{ text: string; color: string; id: number }[]>([]);

  // Three.js refs
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gladiatorsRef = useRef<Gladiator[]>([]);
  const torchesRef = useRef<THREE.PointLight[]>([]);
  const fireParticlesRef = useRef<THREE.Points[]>([]);
  const sparksRef = useRef<{ mesh: THREE.Mesh; vel: THREE.Vector3; life: number }[]>([]);
  const animFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(typeof performance !== "undefined" ? performance.now() : 0);

  // Tournament flow ref
  const tournamentStateRef = useRef<{
    active: boolean;
    phase: Phase;
    currentDuel?: [Gladiator, Gladiator];
    duelStep: number;
    speed: number;
  }>({
    active: false,
    phase: "setup",
    duelStep: 0,
    speed: 1,
  });

  const addComment = useCallback((text: string, color = "#fbbf24") => {
    setCommentary((prev) => [{ text, color, id: Date.now() + Math.random() }, ...prev.slice(0, 11)]);
  }, []);

  /* ─── Participant Handlers ─── */
  const rebind = (list: { id: string; name: string }[]) => {
    return list.slice(0, 16).map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  const handleAdd = (name: string) => {
    if (participants.length >= 16) return;
    setParticipants((p) => rebind([...p, { id: `c3d-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(rebind(names.map((name, i) => ({ id: `c3db-${i}-${Date.now()}`, name }))));
  };

  const handleRemove = (id: string) => {
    setParticipants((p) => rebind(p.filter((x) => x.id !== id)));
    if (betCandidateId === id) setBetCandidateId(null);
  };

  const handleShuffle = () => {
    setParticipants((p) => rebind([...p].sort(() => Math.random() - 0.5)));
  };

  const handleResetSample = () => {
    setParticipants(
      rebind(DEFAULT_COMPETITORS.slice(0, 8).map((name, i) => ({ id: `c3ds-${i}`, name })))
    );
    setChampion(null);
  };

  const handleClear = () => {
    setParticipants([]);
    setChampion(null);
    setBetCandidateId(null);
  };

  /* ─── Build Gladiator 3D Character Rig ─── */
  const buildGladiatorRig = (g: Gladiator): THREE.Group => {
    const root = new THREE.Group();
    root.name = `gladiator-${g.id}`;

    // Color materials
    const armorColor = new THREE.Color(g.color);
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0xcccccc,
      metalness: 0.85,
      roughness: 0.25,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.9,
      roughness: 0.2,
    });
    const armorMat = new THREE.MeshStandardMaterial({
      color: armorColor,
      metalness: 0.6,
      roughness: 0.35,
    });
    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x4a2511,
      roughness: 0.75,
    });
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xd2996e,
      roughness: 0.6,
    });
    const plumeMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      roughness: 0.5,
    });

    // 1. Torso / Breastplate
    const torsoGeo = new THREE.CylinderGeometry(0.38, 0.3, 0.95, 12);
    const torso = new THREE.Mesh(torsoGeo, armorMat);
    torso.position.y = 1.35;
    torso.castShadow = true;
    torso.receiveShadow = true;
    root.add(torso);

    // Belt & Pteruges (Roman leather strips)
    const beltGeo = new THREE.CylinderGeometry(0.33, 0.33, 0.15, 12);
    const belt = new THREE.Mesh(beltGeo, goldMat);
    belt.position.y = 0.88;
    root.add(belt);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const stripGeo = new THREE.BoxGeometry(0.12, 0.45, 0.04);
      const strip = new THREE.Mesh(stripGeo, leatherMat);
      strip.position.set(Math.cos(angle) * 0.3, 0.65, Math.sin(angle) * 0.3);
      strip.rotation.y = angle;
      root.add(strip);
    }

    // 2. Head & Helmet (Galea)
    const headPivot = new THREE.Group();
    headPivot.position.y = 2.05;

    const headGeo = new THREE.SphereGeometry(0.24, 16, 16);
    const head = new THREE.Mesh(headGeo, skinMat);
    headPivot.add(head);

    const helmetGeo = new THREE.SphereGeometry(0.26, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.65);
    const helmet = new THREE.Mesh(helmetGeo, goldMat);
    helmet.rotation.x = -0.15;
    headPivot.add(helmet);

    // Helmet Crest (Crista / Plume)
    const crestBaseGeo = new THREE.BoxGeometry(0.06, 0.1, 0.42);
    const crestBase = new THREE.Mesh(crestBaseGeo, goldMat);
    crestBase.position.set(0, 0.28, 0.02);
    headPivot.add(crestBase);

    const plumeGeo = new THREE.BoxGeometry(0.08, 0.22, 0.44);
    const plume = new THREE.Mesh(plumeGeo, plumeMat);
    plume.position.set(0, 0.4, 0.02);
    headPivot.add(plume);

    // Visor grille
    const visorGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.15, 12, 1, true, -Math.PI * 0.3, Math.PI * 0.6);
    const visor = new THREE.Mesh(visorGeo, metalMat);
    visor.position.set(0, 0, 0.05);
    headPivot.add(visor);

    root.add(headPivot);

    // 3. Legs
    const makeLeg = (xOff: number) => {
      const legGroup = new THREE.Group();
      legGroup.position.set(xOff, 0.8, 0);

      const thighGeo = new THREE.CylinderGeometry(0.13, 0.1, 0.5, 10);
      const thigh = new THREE.Mesh(thighGeo, skinMat);
      thigh.position.y = -0.22;
      thigh.castShadow = true;
      legGroup.add(thigh);

      const greaveGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.48, 10);
      const greave = new THREE.Mesh(greaveGeo, goldMat);
      greave.position.y = -0.58;
      greave.castShadow = true;
      legGroup.add(greave);

      const footGeo = new THREE.BoxGeometry(0.16, 0.1, 0.28);
      const foot = new THREE.Mesh(footGeo, leatherMat);
      foot.position.set(0, -0.82, 0.06);
      legGroup.add(foot);

      return legGroup;
    };

    const leftLeg = makeLeg(-0.2);
    const rightLeg = makeLeg(0.2);
    root.add(leftLeg);
    root.add(rightLeg);
    g.leftLeg = leftLeg;
    g.rightLeg = rightLeg;

    // 4. Arms
    // Right Arm (Sword arm)
    const rightArm = new THREE.Group();
    rightArm.position.set(0.48, 1.7, 0);

    const pauldronGeo = new THREE.SphereGeometry(0.2, 10, 10, 0, Math.PI * 2, 0, Math.PI * 0.6);
    const pauldronR = new THREE.Mesh(pauldronGeo, goldMat);
    pauldronR.rotation.z = -Math.PI * 0.25;
    rightArm.add(pauldronR);

    const rUpperGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.45, 10);
    const rUpper = new THREE.Mesh(rUpperGeo, skinMat);
    rUpper.position.y = -0.25;
    rightArm.add(rUpper);

    const rBracerGeo = new THREE.CylinderGeometry(0.1, 0.08, 0.4, 10);
    const rBracer = new THREE.Mesh(rBracerGeo, leatherMat);
    rBracer.position.y = -0.55;
    rightArm.add(rBracer);

    // Gladius (Roman Sword)
    const swordGroup = new THREE.Group();
    swordGroup.position.set(0, -0.75, 0.1);

    const bladeGeo = new THREE.BoxGeometry(0.08, 0.95, 0.03);
    const blade = new THREE.Mesh(bladeGeo, metalMat);
    blade.position.y = 0.45;
    blade.castShadow = true;
    swordGroup.add(blade);

    const guardGeo = new THREE.BoxGeometry(0.3, 0.06, 0.08);
    const guard = new THREE.Mesh(guardGeo, goldMat);
    guard.position.y = 0.0;
    swordGroup.add(guard);

    const pommelGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const pommel = new THREE.Mesh(pommelGeo, goldMat);
    pommel.position.y = -0.22;
    swordGroup.add(pommel);

    rightArm.add(swordGroup);
    root.add(rightArm);
    g.rightArm = rightArm;
    g.swordMesh = blade;

    // Left Arm (Shield arm)
    const leftArm = new THREE.Group();
    leftArm.position.set(-0.48, 1.7, 0);

    const pauldronL = new THREE.Mesh(pauldronGeo, goldMat);
    pauldronL.rotation.z = Math.PI * 0.25;
    leftArm.add(pauldronL);

    const lUpperGeo = new THREE.CylinderGeometry(0.11, 0.09, 0.45, 10);
    const lUpper = new THREE.Mesh(lUpperGeo, skinMat);
    lUpper.position.y = -0.25;
    leftArm.add(lUpper);

    // Scutum (Roman Shield)
    const shieldGeo = new THREE.CylinderGeometry(0.48, 0.48, 1.1, 16, 1, true, -Math.PI * 0.35, Math.PI * 0.7);
    const shield = new THREE.Mesh(shieldGeo, armorMat);
    shield.position.set(-0.15, -0.4, 0.25);
    shield.rotation.y = -Math.PI * 0.35;
    shield.castShadow = true;

    // Umbo (Shield center metal boss)
    const umboGeo = new THREE.SphereGeometry(0.14, 10, 10);
    const umbo = new THREE.Mesh(umboGeo, goldMat);
    umbo.position.set(0, 0, 0.45);
    shield.add(umbo);

    leftArm.add(shield);
    root.add(leftArm);
    g.leftArm = leftArm;
    g.shieldMesh = shield;

    // Shadow blob
    const shadowGeo = new THREE.CircleGeometry(0.65, 16);
    const shadowMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.45,
    });
    const shadowBlob = new THREE.Mesh(shadowGeo, shadowMat);
    shadowBlob.rotation.x = -Math.PI / 2;
    shadowBlob.position.y = 0.02;
    root.add(shadowBlob);

    root.scale.set(1.45, 1.45, 1.45);
    g.mesh = root;
    return root;
  };

  /* ─── Sparks Particle System ─── */
  const spawnSparks = (pos: THREE.Vector3, isBlock: boolean) => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const count = isBlock ? 14 : 9;
    const sparkColor = isBlock ? 0x60a5fa : 0xfbbf24;
    const sparkMat = new THREE.MeshBasicMaterial({ color: sparkColor });
    const sparkGeo = new THREE.SphereGeometry(0.09, 6, 6);

    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(sparkGeo, sparkMat);
      mesh.position.copy(pos);
      scene.add(mesh);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 7,
        Math.random() * 5 + 2,
        (Math.random() - 0.5) * 7
      );
      sparksRef.current.push({ mesh, vel, life: 0.42 });
    }
  };

  /* ─── Build Roman Coliseum 3D Environment ─── */
  const buildColiseumScene = (scene: THREE.Scene) => {
    // 1. Sky & Atmosphere
    scene.background = new THREE.Color(0x1a0d08);
    scene.fog = new THREE.FogExp2(0x1c0f0a, 0.015);

    // 2. Sand Arena Floor
    const arenaRadius = 18;
    const floorGeo = new THREE.CircleGeometry(arenaRadius, 64);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x9e6c38,
      roughness: 0.85,
      metalness: 0.05,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);

    // Center arena emblem / golden ring
    const ringGeo = new THREE.RingGeometry(4.8, 5.1, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4af37, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    scene.add(ring);

    const innerRingGeo = new THREE.RingGeometry(9.2, 9.4, 48);
    const innerRingMat = new THREE.MeshBasicMaterial({ color: 0x8b0000, side: THREE.DoubleSide });
    const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
    innerRing.rotation.x = -Math.PI / 2;
    innerRing.position.y = 0.02;
    scene.add(innerRing);

    // Outer stone rim curb
    const curbGeo = new THREE.TorusGeometry(arenaRadius, 0.45, 12, 48);
    const stoneMat = new THREE.MeshStandardMaterial({ color: 0x473322, roughness: 0.9 });
    const curb = new THREE.Mesh(curbGeo, stoneMat);
    curb.rotation.x = Math.PI / 2;
    curb.position.y = 0.2;
    curb.receiveShadow = true;
    scene.add(curb);

    // 3. Coliseum Tiered Walls & Columns
    const wallRadius = arenaRadius + 1.2;
    const wallHeight = 8;
    const wallGeo = new THREE.CylinderGeometry(wallRadius + 4, wallRadius, wallHeight, 36, 1, true);
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x3d2719,
      roughness: 0.95,
      side: THREE.BackSide,
    });
    const wall = new THREE.Mesh(wallGeo, wallMat);
    wall.position.y = wallHeight / 2;
    wall.receiveShadow = true;
    scene.add(wall);

    // 24 Corinthian Columns with torches
    const columnCount = 20;
    const colMat = new THREE.MeshStandardMaterial({ color: 0x6e4a2d, roughness: 0.8 });
    const bannerMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, roughness: 0.7 });

    for (let i = 0; i < columnCount; i++) {
      const angle = (i / columnCount) * Math.PI * 2;
      const x = Math.cos(angle) * wallRadius;
      const z = Math.sin(angle) * wallRadius;

      // Column
      const colGeo = new THREE.CylinderGeometry(0.45, 0.55, wallHeight + 1, 16);
      const col = new THREE.Mesh(colGeo, colMat);
      col.position.set(x, (wallHeight + 1) / 2, z);
      col.castShadow = true;
      col.receiveShadow = true;
      scene.add(col);

      // Capital & Base
      const capGeo = new THREE.BoxGeometry(1.3, 0.4, 1.3);
      const cap = new THREE.Mesh(capGeo, stoneMat);
      cap.position.set(x, wallHeight + 0.6, z);
      scene.add(cap);

      // Roman Vexillum Banners every 4 columns
      if (i % 4 === 0) {
        const banGeo = new THREE.PlaneGeometry(1.8, 3.5);
        const banner = new THREE.Mesh(banGeo, bannerMat);
        banner.position.set(x * 0.94, wallHeight - 1.8, z * 0.94);
        banner.rotation.y = angle + Math.PI / 2;
        scene.add(banner);
      }

      // Torches every 2 columns
      if (i % 2 === 0) {
        // Torch bracket
        const brazierGeo = new THREE.ConeGeometry(0.35, 0.45, 8);
        const brazierMat = new THREE.MeshStandardMaterial({ color: 0x1f1712, metalness: 0.8 });
        const brazier = new THREE.Mesh(brazierGeo, brazierMat);
        brazier.rotation.x = Math.PI;
        brazier.position.set(x * 0.92, 3.2, z * 0.92);
        scene.add(brazier);

        // Point light for torch
        const torchLight = new THREE.PointLight(0xff6b1a, 2.5, 14, 1.2);
        torchLight.position.set(x * 0.92, 3.6, z * 0.92);
        scene.add(torchLight);
        torchesRef.current.push(torchLight);
      }
    }

    // 4. Lights
    // Dramatic golden sunlight
    const sunLight = new THREE.DirectionalLight(0xffeedd, 2.8);
    sunLight.position.set(25, 35, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 70;
    sunLight.shadow.camera.left = -22;
    sunLight.shadow.camera.right = 22;
    sunLight.shadow.camera.top = 22;
    sunLight.shadow.camera.bottom = -22;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);

    // Warm ambient light & blue hemisphere rim
    const hemiLight = new THREE.HemisphereLight(0xff9944, 0x1a0f2b, 0.9);
    scene.add(hemiLight);

    const ambientLight = new THREE.AmbientLight(0x2d170a, 0.7);
    scene.add(ambientLight);
  };

  /* ─── Initialize Three.js Viewport ─── */
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Dimensions
    const width = container.clientWidth || 900;
    const height = Math.min(width * 0.62, 540);

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 120);
    camera.position.set(0, 16, 28);
    camera.lookAt(0, 1, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;

    container.innerHTML = "";
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    buildColiseumScene(scene);

    // Spawn sample gladiators in circle
    const count = participants.length;
    const initialGladiators: Gladiator[] = participants.map((p, idx) => {
      const angle = (idx / count) * Math.PI * 2;
      const radius = 9.5;
      const g: Gladiator = {
        ...p,
        hp: 100,
        maxHp: 100,
        atk: 18 + Math.floor(Math.random() * 12),
        def: 8 + Math.floor(Math.random() * 8),
        spd: 1.5 + Math.random() * 0.8,
        title: TITLES[idx % TITLES.length],
        isAlive: true,
        kills: 0,
        rage: 0,
        targetPos: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        attackCooldown: 0,
        isAttacking: false,
        attackProgress: 0,
        isBlocking: false,
        hitFlashTime: 0,
        deathTime: 0,
        walkCycle: 0,
      };
      const rig = buildGladiatorRig(g);
      rig.position.copy(g.targetPos);
      rig.lookAt(0, 0, 0);
      scene.add(rig);
      return g;
    });

    gladiatorsRef.current = initialGladiators;

    // Handle Window Resize
    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const w = container.clientWidth;
      const h = Math.min(w * 0.62, 540);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener("resize", handleResize);

    // ─── Main Render Loop ───
    let camAngle = 0;

    const animateLoop = () => {
      animFrameRef.current = requestAnimationFrame(animateLoop);
      const now = performance.now();
      const delta = Math.min((now - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = now;
      const time = now * 0.001;
      const simDelta = delta * tournamentStateRef.current.speed;

      // 1. Torch light flickering
      torchesRef.current.forEach((torch, idx) => {
        torch.intensity = 2.2 + Math.sin(time * 8 + idx * 2.3) * 0.65;
      });

      // 2. Animate Gladiators
      gladiatorsRef.current.forEach((g) => {
        if (!g.mesh) return;

        if (g.isAlive) {
          // Walk animation & position interpolation
          const curPos = g.mesh.position;
          const distToTarget = curPos.distanceTo(g.targetPos);

          if (distToTarget > 0.15) {
            const moveDir = new THREE.Vector3().subVectors(g.targetPos, curPos).normalize();
            curPos.addScaledVector(moveDir, g.spd * 4.2 * simDelta);
            g.mesh.lookAt(g.targetPos.x, curPos.y, g.targetPos.z);

            g.walkCycle += simDelta * 12 * g.spd;
            if (g.leftLeg && g.rightLeg) {
              g.leftLeg.rotation.x = Math.sin(g.walkCycle) * 0.65;
              g.rightLeg.rotation.x = -Math.sin(g.walkCycle) * 0.65;
            }
            if (g.leftArm && !g.isBlocking) {
              g.leftArm.rotation.x = -Math.sin(g.walkCycle) * 0.45;
            }
          } else {
            // Idle breathing
            if (g.leftLeg && g.rightLeg) {
              g.leftLeg.rotation.x = 0;
              g.rightLeg.rotation.x = 0;
            }
            g.mesh.position.y = Math.sin(time * 3 + g.id.charCodeAt(0)) * 0.04;
          }

          // Attack animation
          if (g.isAttacking && g.rightArm) {
            g.attackProgress += simDelta * 7;
            const swing = Math.sin(g.attackProgress * Math.PI);
            g.rightArm.rotation.x = -swing * 1.5;
            g.rightArm.rotation.z = swing * 0.8;

            if (g.attackProgress >= 1) {
              g.isAttacking = false;
              g.attackProgress = 0;
              g.rightArm.rotation.set(0, 0, 0);
            }
          }

          // Shield block stance
          if (g.leftArm) {
            if (g.isBlocking) {
              g.leftArm.rotation.y = THREE.MathUtils.lerp(g.leftArm.rotation.y, 0.9, 0.15);
              g.leftArm.position.z = THREE.MathUtils.lerp(g.leftArm.position.z, 0.2, 0.15);
            } else {
              g.leftArm.rotation.y = THREE.MathUtils.lerp(g.leftArm.rotation.y, 0, 0.15);
              g.leftArm.position.z = THREE.MathUtils.lerp(g.leftArm.position.z, 0, 0.15);
            }
          }

          // Hit flash
          if (g.hitFlashTime > 0) {
            g.hitFlashTime -= simDelta;
          }
        } else {
          // Death animation: collapse to sand
          if (g.deathTime < 1) {
            g.deathTime += simDelta * 2.2;
            g.mesh.rotation.x = THREE.MathUtils.lerp(0, Math.PI / 2, g.deathTime);
            g.mesh.position.y = THREE.MathUtils.lerp(0, 0.3, g.deathTime);
          }
        }
      });

      // Animate Sparks
      if (sceneRef.current) {
        const scene = sceneRef.current;
        for (let i = sparksRef.current.length - 1; i >= 0; i--) {
          const s = sparksRef.current[i];
          s.life -= simDelta;
          s.mesh.position.addScaledVector(s.vel, simDelta);
          s.vel.y -= 14 * simDelta;
          s.mesh.scale.multiplyScalar(0.92);
          if (s.life <= 0) {
            scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            sparksRef.current.splice(i, 1);
          }
        }
      }

      // 3. Camera Modes
      if (cameraRef.current) {
        const cam = cameraRef.current;
        const currentMode = camMode;

        if (currentMode === "orbit") {
          camAngle += 0.0035 * tournamentStateRef.current.speed;
          const radius = 17;
          cam.position.x = Math.cos(camAngle) * radius;
          cam.position.z = Math.sin(camAngle) * radius;
          cam.position.y = 8 + Math.sin(camAngle * 2) * 1.5;
          cam.lookAt(0, 1.8, 0);
        } else if (currentMode === "action") {
          // Track active gladiators closely with dynamic cinematic angles
          const alive = gladiatorsRef.current.filter((g) => g.isAlive);
          if (alive.length >= 2 && alive[0].mesh && alive[1].mesh) {
            const midpoint = new THREE.Vector3()
              .addVectors(alive[0].mesh.position, alive[1].mesh.position)
              .multiplyScalar(0.5);
            const targetCamPos = new THREE.Vector3(midpoint.x, midpoint.y + 3.2, midpoint.z + 8.5);
            cam.position.lerp(targetCamPos, 0.08);
            cam.lookAt(midpoint.x, midpoint.y + 1.8, midpoint.z);
          } else {
            cam.position.lerp(new THREE.Vector3(0, 9, 15), 0.06);
            cam.lookAt(0, 1.8, 0);
          }
        } else if (currentMode === "overhead") {
          cam.position.lerp(new THREE.Vector3(0, 24, 1), 0.08);
          cam.lookAt(0, 0, 0);
        } else if (currentMode === "hero") {
          const leader = champion || gladiatorsRef.current.find((g) => g.isAlive);
          if (leader?.mesh) {
            const pos = leader.mesh.position;
            cam.position.lerp(new THREE.Vector3(pos.x + 3.5, pos.y + 2.5, pos.z + 4.5), 0.08);
            cam.lookAt(pos.x, pos.y + 1.6, pos.z);
          }
        }
      }

      renderer.render(scene, camera);
    };

    animateLoop();

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
    };
  }, []);

  /* ─── Sync Participants to 3D Scene when edited in setup ─── */
  useEffect(() => {
    if (phase !== "setup" || !sceneRef.current) return;
    const scene = sceneRef.current;

    // Remove existing meshes
    gladiatorsRef.current.forEach((g) => {
      if (g.mesh) scene.remove(g.mesh);
    });

    const count = participants.length;
    const newGladiators: Gladiator[] = participants.map((p, idx) => {
      const angle = (idx / Math.max(count, 1)) * Math.PI * 2;
      const radius = 9.5;
      const g: Gladiator = {
        ...p,
        hp: 100,
        maxHp: 100,
        atk: 18 + Math.floor(Math.random() * 12),
        def: 8 + Math.floor(Math.random() * 8),
        spd: 1.5 + Math.random() * 0.8,
        title: TITLES[idx % TITLES.length],
        isAlive: true,
        kills: 0,
        rage: 0,
        targetPos: new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius),
        attackCooldown: 0,
        isAttacking: false,
        attackProgress: 0,
        isBlocking: false,
        hitFlashTime: 0,
        deathTime: 0,
        walkCycle: 0,
      };
      const rig = buildGladiatorRig(g);
      rig.position.copy(g.targetPos);
      rig.lookAt(0, 0, 0);
      scene.add(rig);
      return g;
    });

    gladiatorsRef.current = newGladiators;
  }, [participants, phase]);

  /* ─── Sleep helper ─── */
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms / tournamentStateRef.current.speed));

  /* ─── Execute 1v1 Gladiator Duel ─── */
  const conductDuel = async (g1: Gladiator, g2: Gladiator): Promise<Gladiator> => {
    setRoundLabel(`Duelo: ${g1.name} vs ${g2.name}`);
    addComment(`⚔️ ¡Comienza el enfrentamiento entre ${g1.name} y ${g2.name}!`, "#fbbf24");
    sounds.playChip();

    // Position fighters facing each other in the arena center with close melee combat distance
    g1.targetPos.set(-1.6, 0, 0);
    g2.targetPos.set(1.6, 0, 0);
    await delay(1200);

    return new Promise((resolve) => {
      const duelInterval = setInterval(() => {
        if (!tournamentStateRef.current.active) {
          clearInterval(duelInterval);
          resolve(g1);
          return;
        }

        // Determine who attacks
        const attacker = Math.random() > 0.5 ? g1 : g2;
        const defender = attacker === g1 ? g2 : g1;

        attacker.isAttacking = true;
        attacker.attackProgress = 0;

        // Face each other directly and lunge
        if (attacker.mesh && defender.mesh) {
          attacker.mesh.lookAt(defender.mesh.position.x, attacker.mesh.position.y, defender.mesh.position.z);
          defender.mesh.lookAt(attacker.mesh.position.x, attacker.mesh.position.y, attacker.mesh.position.z);

          const lungeDir = new THREE.Vector3().subVectors(defender.mesh.position, attacker.mesh.position).normalize();
          attacker.mesh.position.addScaledVector(lungeDir, 0.45);
        }

        // Defender block chance
        const isBlock = Math.random() < 0.35;
        defender.isBlocking = isBlock;

        const rawDmg = Math.floor(attacker.atk * (0.8 + Math.random() * 0.5));
        const effectiveDmg = isBlock ? Math.max(3, Math.floor(rawDmg * 0.3)) : Math.max(8, rawDmg - defender.def * 0.4);

        defender.hp = Math.max(0, defender.hp - effectiveDmg);
        defender.hitFlashTime = 0.35;
        attacker.rage = Math.min(100, attacker.rage + 18);

        // Spawn impact sparks
        if (defender.mesh) {
          const impactPos = defender.mesh.position.clone();
          impactPos.y += 1.8;
          spawnSparks(impactPos, isBlock);

          // Defender knockback stumble
          if (attacker.mesh) {
            const knockDir = new THREE.Vector3().subVectors(defender.mesh.position, attacker.mesh.position).normalize();
            defender.mesh.position.addScaledVector(knockDir, isBlock ? 0.2 : 0.45);
          }
        }

        // Sound effect
        if (isBlock) {
          sounds.playChip();
          addComment(`🛡️ ${defender.name} bloquea el impacto con su escudo Scutum (-${effectiveDmg} HP)`, "#38bdf8");
        } else {
          sounds.playCrash();
          addComment(`💥 ¡${attacker.name} conecta un feroz tajo a ${defender.name}! (-${effectiveDmg} HP)`, "#ef4444");
        }

        // Check if defender eliminated
        if (defender.hp <= 0) {
          clearInterval(duelInterval);
          defender.isAlive = false;
          attacker.kills++;
          attacker.isBlocking = false;
          defender.isBlocking = false;

          sounds.playLose();
          addComment(`💀 ¡${defender.name} cae derrotado en la arena del Coliseo!`, "#f87171");

          // Reset victor pos
          setTimeout(() => {
            attacker.targetPos.set(0, 0, 0);
            attacker.hp = attacker.maxHp; // Heals for next round
            resolve(attacker);
          }, 1500 / tournamentStateRef.current.speed);
        }
      }, 750 / tournamentStateRef.current.speed);
    });
  };

  /* ─── Full Tournament Engine ─── */
  const startTournament = async () => {
    if (participants.length < 2) return;

    if (betCandidateId && betAmount > 0) {
      const ok = placeBet(betAmount, "coliseo-3d", "Coliseo 3D");
      if (!ok) return;
    }

    tournamentStateRef.current.active = true;
    tournamentStateRef.current.speed = speedMultiplier;
    setPhase("tournament");
    setChampion(null);
    setStandings([]);
    setCommentary([]);
    setCamMode("action");

    // Intro presentation
    setFlashBanner("⚔️ ¡QUE COMIENCEN LOS JUEGOS DEL COLISEO! ⚔️");
    sounds.playChip();
    addComment("🎺 Las trompetas romanas resuenan en las gradas imperiales.", "#f59e0b");
    await delay(2800);
    setFlashBanner(null);

    // Initial pool
    let activeFighters = [...gladiatorsRef.current];
    let currentRound = 1;

    while (activeFighters.length > 1 && tournamentStateRef.current.active) {
      const roundName =
        activeFighters.length === 2
          ? "👑 GRAN FINAL DEL IMPERIO 👑"
          : activeFighters.length <= 4
          ? `🏆 SEMIFINALES (Ronda ${currentRound})`
          : `⚔️ CUARTOS DE FINAL (Ronda ${currentRound})`;

      setRoundLabel(roundName);
      setFlashBanner(roundName);
      await delay(2000);
      setFlashBanner(null);

      const nextRoundFighters: Gladiator[] = [];

      for (let i = 0; i < activeFighters.length; i += 2) {
        if (!tournamentStateRef.current.active) return;

        if (i + 1 < activeFighters.length) {
          const f1 = activeFighters[i];
          const f2 = activeFighters[i + 1];
          const winner = await conductDuel(f1, f2);
          nextRoundFighters.push(winner);
          await delay(1000);
        } else {
          // Odd contestant gets a bye
          addComment(`⭐ ${activeFighters[i].name} avanza directamente por sorteo imperial.`, "#a3e635");
          nextRoundFighters.push(activeFighters[i]);
        }
      }

      activeFighters = nextRoundFighters;
      currentRound++;
    }

    // Winner Ceremony
    if (activeFighters.length === 1) {
      const victor = activeFighters[0];
      victor.rank = 1;
      setChampion(victor);
      setPhase("ceremony");
      setCamMode("hero");
      setFlashBanner(`🏆 ¡GLORIA ETERNA A ${victor.name.toUpperCase()}! 🏆`);

      sounds.playWin();
      addComment(`👑 ¡${victor.name} "${victor.title}" es coronado Máximo Gladiador del Coliseo!`, "#fbbf24");

      // Pay bet if won
      if (betCandidateId && victor.id === betCandidateId && betAmount > 0) {
        const payout = betAmount * participants.length;
        awardWin(payout, "coliseo-3d", "Coliseo 3D", participants.length);
      }

      const allSorted = [...gladiatorsRef.current].sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0) || b.kills - a.kills);
      setStandings(allSorted);
    }
  };

  const resetTournament = () => {
    tournamentStateRef.current.active = false;
    setPhase("setup");
    setChampion(null);
    setFlashBanner(null);
    setRoundLabel("Ronda Preliminar");
    setCamMode("orbit");
    setCommentary([]);
  };

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-4">
      {/* 3D WebGL Canvas Viewport with Overlays */}
      <div className="relative w-full rounded-2xl overflow-hidden border border-amber-900/40 shadow-2xl bg-[#0d0604]">
        <div ref={containerRef} className="w-full h-[380px] sm:h-[480px] lg:h-[530px]" />

        {/* Top Broadcast HUD */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-black/70 backdrop-blur-md border border-amber-500/30">
            <span className="text-xl">🏟️</span>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-amber-400 block">Coliseo Romano 3D</span>
              <span className="text-xs sm:text-sm font-extrabold text-white">{roundLabel}</span>
            </div>
          </div>

          {/* Camera & Speed Controls */}
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <div className="hidden sm:flex bg-black/70 backdrop-blur-md border border-amber-900/50 rounded-xl p-1 gap-1">
              {(
                [
                  { id: "orbit", label: "🎥 Órbita" },
                  { id: "action", label: "⚔️ Acción" },
                  { id: "overhead", label: "🏟️ Aérea" },
                  { id: "hero", label: "👤 Héroe" },
                ] as const
              ).map((cam) => (
                <button
                  key={cam.id}
                  onClick={() => setCamMode(cam.id)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-bold transition-all ${
                    camMode === cam.id
                      ? "bg-amber-500 text-black shadow-md shadow-amber-500/30"
                      : "text-amber-300/70 hover:text-white hover:bg-neutral-800/60"
                  }`}
                >
                  {cam.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => {
                const nextSpeed = speedMultiplier === 1 ? 1.5 : speedMultiplier === 1.5 ? 2 : 1;
                setSpeedMultiplier(nextSpeed);
                tournamentStateRef.current.speed = nextSpeed;
              }}
              className="px-3 py-1.5 rounded-xl bg-amber-950/80 border border-amber-600/40 text-amber-300 font-mono text-xs font-bold hover:bg-amber-800 transition"
              title="Velocidad de combate"
            >
              ⚡ {speedMultiplier}x
            </button>
          </div>
        </div>

        {/* Center Flash Banner */}
        {flashBanner && (
          <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none bg-black/40 backdrop-blur-sm animate-in fade-in">
            <div className="bg-gradient-to-r from-amber-950/90 via-black/95 to-amber-950/90 border-2 border-amber-500/80 px-8 py-5 rounded-2xl shadow-2xl text-center max-w-lg">
              <span className="text-xl sm:text-2xl font-black text-amber-400 tracking-wide block animate-pulse">
                {flashBanner}
              </span>
            </div>
          </div>
        )}

        {/* Bottom Duel Health HUD during combat */}
        {phase === "tournament" && (
          <div className="absolute bottom-3 left-3 right-3 flex justify-center pointer-events-none">
            <div className="w-full max-w-xl bg-black/75 backdrop-blur-md border border-amber-800/40 rounded-2xl p-3 flex items-center justify-between gap-4">
              {gladiatorsRef.current
                .filter((g) => g.isAlive)
                .slice(0, 2)
                .map((g, i) => (
                  <div key={g.id} className={`flex-1 flex flex-col ${i === 1 ? "items-end text-right" : ""}`}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="w-3 h-3 rounded-full" style={{ background: g.color }} />
                      <span className="font-extrabold text-xs text-white truncate">{g.name}</span>
                      <span className="text-[10px] text-amber-400 font-mono">⚔️{g.kills}</span>
                    </div>
                    <div className="w-full h-2.5 bg-neutral-900 rounded-full overflow-hidden border border-neutral-700">
                      <div
                        className="h-full rounded-full transition-all duration-200"
                        style={{
                          width: `${(g.hp / g.maxHp) * 100}%`,
                          background: g.hp > 50 ? "#22c55e" : g.hp > 25 ? "#eab308" : "#ef4444",
                        }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Interactive Controls / Tournament Layout */}
      {phase === "setup" ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Tournament Description & Quick Rules */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#1c0f0a] to-[#0d0705] border border-amber-900/40 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-3xl">⚔️</span>
                <div>
                  <h3 className="text-lg font-black text-amber-400 uppercase tracking-wide">
                    Reglas del Coliseo 3D
                  </h3>
                  <p className="text-xs text-amber-200/60">Simulación WebGL con físicas y cámara orbital</p>
                </div>
              </div>
              <ul className="space-y-2.5 text-xs text-neutral-300 mt-4">
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">1.</span>
                  <span><strong>Emparejamientos Dinámicos:</strong> Los gladiadores combaten en duelos de eliminación directa en la arena.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">2.</span>
                  <span><strong>Armamento Romano:</strong> Espada Gladius y escudo Scutum con probabilidad de bloqueo y golpes críticos.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">3.</span>
                  <span><strong>Cámaras de Transmisión:</strong> Cambia en tiempo real entre vista orbital, acción cuerpo a cuerpo o vista aérea táctica.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-500 font-bold">4.</span>
                  <span><strong>Apuesta al Campeón:</strong> Si tu gladiador gana el torneo, recibes el pozo multiplicado por todos los participantes.</span>
                </li>
              </ul>
            </div>

            <button
              onClick={startTournament}
              disabled={participants.length < 2}
              className="mt-6 w-full py-4 rounded-xl font-black text-base uppercase tracking-wider text-black transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-40 disabled:pointer-events-none"
              style={{
                background: "linear-gradient(135deg, #f59e0b, #d97706, #b45309)",
                boxShadow: "0 0 35px rgba(245, 158, 11, 0.4)",
              }}
            >
              ⚔️ ¡INICIAR TORNEO DEL COLISEO! ⚔️
            </button>
          </div>

          {/* Right: Participant Manager Panel */}
          <div className="lg:col-span-7">
            <ParticipantInput
              participants={participants}
              onAddParticipant={handleAdd}
              onImportBulk={handleBulk}
              onRemoveParticipant={handleRemove}
              onShuffle={handleShuffle}
              onResetSample={handleResetSample}
              onClearAll={handleClear}
              disabled={phase !== "setup"}
              betCandidateId={betCandidateId}
              onSelectCandidate={setBetCandidateId}
              betAmount={betAmount}
              onChangeBetAmount={setBetAmount}
            />
          </div>
        </div>
      ) : (
        /* Tournament Active & Ceremony Dashboard */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Live Scoreboard */}
          <div className="lg:col-span-5 bg-gradient-to-b from-[#1a0e09] to-[#0c0604] border border-amber-900/40 rounded-2xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3 flex items-center justify-between">
              <span>🏟️ Tabla de Gladiadores</span>
              <span className="text-neutral-400 font-mono">{gladiatorsRef.current.filter((g) => g.isAlive).length} activos</span>
            </h4>
            <div className="space-y-1.5 max-h-64 overflow-y-auto custom-scroll pr-1">
              {[...gladiatorsRef.current]
                .sort((a, b) => (b.isAlive ? 1 : 0) - (a.isAlive ? 1 : 0) || b.hp - a.hp)
                .map((g, i) => (
                  <div
                    key={g.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: g.isAlive ? `linear-gradient(90deg, ${g.color}15, transparent)` : "rgba(0,0,0,0.4)",
                      border: `1px solid ${g.isAlive ? g.color + "35" : "#262626"}`,
                      opacity: g.isAlive ? 1 : 0.4,
                    }}
                  >
                    <span className="text-xs text-neutral-500 w-4 font-mono font-bold">#{i + 1}</span>
                    <span className="w-3.5 h-3.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-extrabold text-white truncate">{g.name}</p>
                      <p className="text-[10px] text-amber-300/60 truncate">{g.title}</p>
                    </div>
                    {g.isAlive ? (
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-green-400">{Math.round(g.hp)} HP</span>
                        {g.kills > 0 && <span className="text-[10px] text-amber-400 ml-1.5">⚔️{g.kills}</span>}
                      </div>
                    ) : (
                      <span className="text-[10px] font-bold text-red-500">💀 KO</span>
                    )}
                  </div>
                ))}
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800 flex justify-between items-center">
              <button
                onClick={resetTournament}
                className="px-4 py-2 rounded-xl text-xs font-bold text-neutral-400 hover:text-white bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 transition"
              >
                ✕ Reiniciar Torneo
              </button>
            </div>
          </div>

          {/* Live Commentary Feed */}
          <div className="lg:col-span-7 bg-gradient-to-b from-[#1a0e09] to-[#0c0604] border border-amber-900/40 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-widest text-amber-500 mb-3">
                📢 Narración Épica del Coliseo
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto custom-scroll pr-1">
                {commentary.map((c, i) => (
                  <div
                    key={c.id}
                    className="text-xs px-3 py-2 rounded-xl transition-all"
                    style={{
                      background: i === 0 ? "rgba(245,158,11,0.12)" : "rgba(0,0,0,0.4)",
                      borderLeft: `3px solid ${c.color}`,
                      color: i === 0 ? c.color : "#9ca3af",
                      fontWeight: i === 0 ? "700" : "400",
                    }}
                  >
                    {c.text}
                  </div>
                ))}
                {commentary.length === 0 && (
                  <p className="text-neutral-600 text-xs italic">El narrador imperial espera la primera orden de combate…</p>
                )}
              </div>
            </div>

            {/* Champion Podium Announcement */}
            {phase === "ceremony" && champion && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-950/80 via-black to-amber-950/80 border border-amber-500/60 text-center animate-in zoom-in-95">
                <span className="text-3xl block mb-1">👑</span>
                <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
                  ¡CAMPEÓN SUPREMO DEL COLISEO!
                </span>
                <h3 className="text-2xl font-black text-white mt-1 mb-2">{champion.name}</h3>
                <p className="text-xs text-amber-200/70 mb-4">{champion.title}</p>
                <button
                  onClick={resetTournament}
                  className="px-6 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider text-black"
                  style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
                >
                  ⚔️ Organizar Nuevo Torneo
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
