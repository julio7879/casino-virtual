"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ParticipantInput, {
  PlayerParticipant,
  PARTICIPANT_COLORS,
  DEFAULT_COMPETITORS,
} from "./shared/participant-input";
import { sounds } from "@/lib/audio";
import { formatFichas } from "@/lib/format";
import { useWallet } from "@/lib/wallet-context";
import { getSavedTournamentNames } from "@/lib/tournament-roster";
import TournamentChallengeModal from "./shared/tournament-challenge-modal";

interface MarblePhysics {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  finished: boolean;
  finishRank: number | null;
  finishTime: number | null;
}

interface ObstaclePin {
  x: number;
  y: number;
  radius: number;
}

interface SpinnerObstacle {
  x: number;
  y: number;
  length: number;
  angle: number;
  speed: number; // radians per frame
}

interface SlantedWall {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface BumperObstacle {
  x: number;
  y: number;
  radius: number;
  hitAnim: number;
}

interface BoostPad {
  x: number;
  y: number;
  w: number;
  h: number;
}

const TOTAL_TRACK_HEIGHT = 15800;
const CANVAS_WIDTH = 480;
const VIEWPORT_HEIGHT = 640;

export default function MarbleRaceGame() {
  const { balance, placeBet, awardWin } = useWallet();

  const [participants, setParticipants] = useState<PlayerParticipant[]>(() =>
    DEFAULT_COMPETITORS.map((name, i) => ({
      id: `m-${i}-${Date.now()}`,
      name,
      color: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
    }))
  );

  const [betCandidateId, setBetCandidateId] = useState<string | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [racing, setRacing] = useState(false);
  const [podium, setPodium] = useState<MarblePhysics[]>([]);
  const [showPodiumModal, setShowPodiumModal] = useState(false);
  const [raceElapsedSec, setRaceElapsedSec] = useState(0);
  const [leaderboard, setLeaderboard] = useState<MarblePhysics[]>([]);
  const [challengeTargetRole, setChallengeTargetRole] = useState<"winner" | "loser">("winner");
  const [showChallengeModal, setShowChallengeModal] = useState(false);

  const animFrameRef = useRef<number | null>(null);
  const marblesRef = useRef<MarblePhysics[]>([]);
  const pinsRef = useRef<ObstaclePin[]>([]);
  const spinnersRef = useRef<SpinnerObstacle[]>([]);
  const wallsRef = useRef<SlantedWall[]>([]);
  const bumpersRef = useRef<BumperObstacle[]>([]);
  const boostPadsRef = useRef<BoostPad[]>([]);
  const finishOrderRef = useRef<MarblePhysics[]>([]);
  const lastSoundTickRef = useRef<number>(0);
  const cameraYRef = useRef<number>(0);
  const raceStartTimeRef = useRef<number>(0);

  // Sync participant colors
  const rebindParticipants = (list: { id: string; name: string }[]): PlayerParticipant[] => {
    return list.map((item, idx) => ({
      ...item,
      color: PARTICIPANT_COLORS[idx % PARTICIPANT_COLORS.length],
    }));
  };

  useEffect(() => {
    const saved = getSavedTournamentNames();
    if (saved && saved.length > 0) {
      setParticipants(
        rebindParticipants(saved.map((name, i) => ({ id: `m-${i}-${Date.now()}`, name })))
      );
    }
  }, []);

  const handleAdd = (name: string) => {
    setParticipants(rebindParticipants([...participants, { id: `m-${Date.now()}`, name }]));
  };

  const handleBulk = (names: string[]) => {
    setParticipants(
      rebindParticipants(names.map((name, i) => ({ id: `mb-${i}-${Date.now()}`, name })))
    );
  };

  const handleRemove = (id: string) => {
    setParticipants(rebindParticipants(participants.filter((p) => p.id !== id)));
    if (betCandidateId === id) setBetCandidateId(null);
  };

  const handleShuffle = () => {
    const shuf = [...participants].sort(() => Math.random() - 0.5);
    setParticipants(rebindParticipants(shuf));
  };

  const handleResetSample = () => {
    setParticipants(
      rebindParticipants(DEFAULT_COMPETITORS.map((name, i) => ({ id: `ms-${i}`, name })))
    );
    setPodium([]);
    setRaceElapsedSec(0);
  };

  const handleClear = () => {
    setParticipants([]);
    setPodium([]);
    setBetCandidateId(null);
    setRaceElapsedSec(0);
  };

  // Build the massive 15,800px obstacle race course
  const initTrack = useCallback(() => {
    const width = CANVAS_WIDTH;
    const pins: ObstaclePin[] = [];
    const spinners: SpinnerObstacle[] = [];
    const walls: SlantedWall[] = [];
    const bumpers: BumperObstacle[] = [];
    const boostPads: BoostPad[] = [];

    // Helper: Add pin grid zone
    const addPinZone = (startY: number, endY: number, rows: number, cols: number) => {
      const stepY = (endY - startY) / rows;
      for (let r = 0; r < rows; r++) {
        const y = startY + r * stepY;
        const currentCols = r % 2 === 0 ? cols : cols - 1;
        const stepX = (width - 70) / currentCols;
        const offsetX = r % 2 === 0 ? 35 : 35 + stepX / 2;
        for (let c = 0; c < currentCols; c++) {
          pins.push({
            x: offsetX + c * stepX,
            y,
            radius: 5,
          });
        }
      }
    };

    // Helper: Add funnel chokepoint
    const addFunnel = (startY: number, gapWidth = 48) => {
      const midY = startY + 180;
      // Left diagonal
      walls.push({ x1: 20, y1: startY, x2: width / 2 - gapWidth / 2, y2: midY });
      // Right diagonal
      walls.push({ x1: width - 20, y1: startY, x2: width / 2 + gapWidth / 2, y2: midY });
      // Short channel
      walls.push({ x1: width / 2 - gapWidth / 2, y1: midY, x2: width / 2 - gapWidth / 2, y2: midY + 80 });
      walls.push({ x1: width / 2 + gapWidth / 2, y1: midY, x2: width / 2 + gapWidth / 2, y2: midY + 80 });
    };

    // Helper: Add Slalom Ramps
    const addSlalom = (startY: number, count = 4) => {
      for (let i = 0; i < count; i++) {
        const y = startY + i * 220;
        if (i % 2 === 0) {
          // Slope from left down to right
          walls.push({ x1: 20, y1: y, x2: width - 90, y2: y + 90 });
        } else {
          // Slope from right down to left
          walls.push({ x1: width - 20, y1: y, x2: 90, y2: y + 90 });
        }
      }
    };

    // --- SECTION 1: Starting Gate & Warmup Pins (Y: 100 - 1,200) ---
    addPinZone(140, 1150, 12, 8);

    // --- SECTION 2: Spinning Windmills / Crossbars (Y: 1,300 - 2,500) ---
    spinners.push(
      { x: width * 0.3, y: 1450, length: 70, angle: 0, speed: 0.03 },
      { x: width * 0.7, y: 1700, length: 70, angle: Math.PI / 4, speed: -0.035 },
      { x: width * 0.35, y: 1950, length: 75, angle: Math.PI / 2, speed: 0.04 },
      { x: width * 0.65, y: 2200, length: 75, angle: 0, speed: -0.038 }
    );
    addPinZone(1300, 2400, 8, 4);

    // --- SECTION 3: Double Funnel Chokepoints (Y: 2,600 - 3,800) ---
    addFunnel(2600, 42);
    addFunnel(3200, 38);
    // Pinball bumpers inside recovery zones
    bumpers.push(
      { x: width * 0.25, y: 2950, radius: 18, hitAnim: 0 },
      { x: width * 0.75, y: 2950, radius: 18, hitAnim: 0 },
      { x: width * 0.5, y: 3550, radius: 22, hitAnim: 0 }
    );

    // --- SECTION 4: Slalom Zig-Zag Ramps (Y: 3,900 - 5,200) ---
    addSlalom(3900, 5);

    // --- SECTION 5: Bumper & Pinball Flipper Zone (Y: 5,300 - 6,600) ---
    for (let by = 5400; by <= 6500; by += 220) {
      bumpers.push(
        { x: width * 0.22, y: by, radius: 18, hitAnim: 0 },
        { x: width * 0.78, y: by + 60, radius: 18, hitAnim: 0 },
        { x: width * 0.5, y: by + 120, radius: 22, hitAnim: 0 }
      );
    }
    spinners.push(
      { x: width * 0.5, y: 5800, length: 85, angle: 0, speed: 0.045 },
      { x: width * 0.5, y: 6300, length: 85, angle: Math.PI / 3, speed: -0.045 }
    );

    // --- SECTION 6: Track Split & Speed Boosters (Y: 6,700 - 8,200) ---
    // Center divider wall
    walls.push({ x1: width / 2, y1: 6750, x2: width / 2, y2: 8050 });
    // Left side has Boost Pads
    boostPads.push(
      { x: 50, y: 6900, w: 70, h: 36 },
      { x: 80, y: 7300, w: 70, h: 36 },
      { x: 50, y: 7700, w: 70, h: 36 }
    );
    // Right side has dense pin maze
    addPinZone(6800, 8000, 12, 4);

    // --- SECTION 7: Pendulum Sweepers & Funnels (Y: 8,300 - 9,800) ---
    addFunnel(8350, 45);
    spinners.push(
      { x: width * 0.3, y: 8800, length: 90, angle: 0, speed: 0.04 },
      { x: width * 0.7, y: 9100, length: 90, angle: Math.PI / 2, speed: -0.04 },
      { x: width * 0.5, y: 9450, length: 95, angle: 0, speed: 0.05 }
    );
    addPinZone(9200, 9750, 6, 6);

    // --- SECTION 8: Mountain Switchbacks (Y: 9,900 - 11,500) ---
    addSlalom(9900, 6);
    bumpers.push(
      { x: width * 0.3, y: 10450, radius: 20, hitAnim: 0 },
      { x: width * 0.7, y: 10900, radius: 20, hitAnim: 0 }
    );

    // --- SECTION 9: Mega Pinfield & Final Boosters (Y: 11,600 - 13,800) ---
    addPinZone(11600, 13400, 20, 8);
    spinners.push(
      { x: width * 0.3, y: 12200, length: 80, angle: 0, speed: -0.04 },
      { x: width * 0.7, y: 12700, length: 80, angle: 0, speed: 0.04 },
      { x: width * 0.5, y: 13200, length: 80, angle: Math.PI / 4, speed: -0.045 }
    );
    boostPads.push(
      { x: width * 0.2, y: 13500, w: 60, h: 40 },
      { x: width * 0.6, y: 13500, w: 60, h: 40 },
      { x: width * 0.4, y: 13700, w: 80, h: 40 }
    );

    // --- SECTION 10: Final Sprint & Checkered Finish (Y: 13,900 - 15,400) ---
    addFunnel(13950, 55);
    addPinZone(14300, 15150, 9, 6);

    pinsRef.current = pins;
    spinnersRef.current = spinners;
    wallsRef.current = walls;
    bumpersRef.current = bumpers;
    boostPadsRef.current = boostPads;

    // Initialize Marbles
    const count = participants.length;
    const slotW = count > 1 ? (width - 80) / (count - 1) : width / 2;
    const marbles: MarblePhysics[] = participants.map((p, i) => ({
      id: p.id,
      name: p.name,
      color: p.color,
      x: count === 1 ? width / 2 : 40 + i * slotW,
      y: 45 + Math.random() * 25,
      vx: (Math.random() - 0.5) * 1.5,
      vy: 0.5,
      radius: Math.max(9, Math.min(13, 260 / Math.max(count, 10))),
      finished: false,
      finishRank: null,
      finishTime: null,
    }));
    marblesRef.current = marbles;
    finishOrderRef.current = [];
    cameraYRef.current = 0;
    setLeaderboard(marbles);
  }, [participants]);

  // Initial draw
  useEffect(() => {
    initTrack();
  }, [initTrack]);

  // Render Track & Marbles on Canvas
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const camY = cameraYRef.current;

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(0, -camY);

    // 1. Futuristic Race Track Background
    const bgGrad = ctx.createLinearGradient(0, camY, 0, camY + height);
    bgGrad.addColorStop(0, "#080b13");
    bgGrad.addColorStop(0.5, "#0d1322");
    bgGrad.addColorStop(1, "#070a10");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, camY, width, height);

    // Track grid lines for speed perception
    ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
    ctx.lineWidth = 1;
    const startGridY = Math.floor(camY / 40) * 40;
    for (let gy = startGridY; gy < camY + height; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(18, gy);
      ctx.lineTo(width - 18, gy);
      ctx.stroke();
    }

    // Glowing Side Rails (Bumpers)
    const railGradL = ctx.createLinearGradient(0, 0, 18, 0);
    railGradL.addColorStop(0, "#1e293b");
    railGradL.addColorStop(1, "#334155");
    ctx.fillStyle = railGradL;
    ctx.fillRect(0, camY, 18, height);

    const railGradR = ctx.createLinearGradient(width - 18, 0, width, 0);
    railGradR.addColorStop(0, "#334155");
    railGradR.addColorStop(1, "#1e293b");
    ctx.fillStyle = railGradR;
    ctx.fillRect(width - 18, camY, 18, height);

    // Neon edge stripes
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(18, camY);
    ctx.lineTo(18, camY + height);
    ctx.stroke();

    ctx.strokeStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(width - 18, camY);
    ctx.lineTo(width - 18, camY + height);
    ctx.stroke();

    // 2. Starting Gate
    if (camY < 200) {
      ctx.strokeStyle = "rgba(234, 179, 8, 0.7)";
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(18, 80);
      ctx.lineTo(width - 18, 80);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#eab308";
      ctx.font = "bold 12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🚀 LÍNEA DE SALIDA (15,800m)", width / 2, 70);
    }

    // 3. Boost Pads
    for (const pad of boostPadsRef.current) {
      if (pad.y + pad.h < camY || pad.y > camY + height) continue;
      ctx.save();
      ctx.fillStyle = "rgba(16, 185, 129, 0.25)";
      ctx.fillRect(pad.x, pad.y, pad.w, pad.h);
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.strokeRect(pad.x, pad.y, pad.w, pad.h);

      // Arrow chevrons
      ctx.fillStyle = "#34d399";
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("▼▼▼", pad.x + pad.w / 2, pad.y + pad.h / 2 + 5);
      ctx.restore();
    }

    // 4. Slanted Walls / Funnel Obstacles
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 6;
    ctx.lineCap = "round";
    for (const w of wallsRef.current) {
      const minY = Math.min(w.y1, w.y2);
      const maxY = Math.max(w.y1, w.y2);
      if (maxY < camY || minY > camY + height) continue;

      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();

      // Glowing cap line
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(w.x1, w.y1);
      ctx.lineTo(w.x2, w.y2);
      ctx.stroke();
      ctx.strokeStyle = "#94a3b8";
      ctx.lineWidth = 6;
    }

    // 5. Pinball Bumpers
    for (const b of bumpersRef.current) {
      if (b.y + b.radius < camY || b.y - b.radius > camY + height) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      const bGrad = ctx.createRadialGradient(b.x, b.y, 2, b.x, b.y, b.radius);
      bGrad.addColorStop(0, b.hitAnim > 0 ? "#ffffff" : "#f43f5e");
      bGrad.addColorStop(1, "#881337");
      ctx.fillStyle = bGrad;
      ctx.fill();
      ctx.strokeStyle = "#fb7185";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 10px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("BUMP", b.x, b.y + 3);
      ctx.restore();
    }

    // 6. Spinning Windmills / Crossbars
    for (const s of spinnersRef.current) {
      if (s.y + s.length < camY || s.y - s.length > camY + height) continue;
      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(s.angle);

      // Central pivot
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // 4 blades
      for (let arm = 0; arm < 4; arm++) {
        ctx.rotate(Math.PI / 2);
        ctx.fillStyle = arm % 2 === 0 ? "#ea580c" : "#f97316";
        ctx.fillRect(-4, 0, 8, s.length);
        ctx.strokeStyle = "#fed7aa";
        ctx.lineWidth = 1;
        ctx.strokeRect(-4, 0, 8, s.length);
      }
      ctx.restore();
    }

    // 7. Obstacle Pins (Pegs)
    for (const p of pinsRef.current) {
      if (p.y + p.radius < camY || p.y - p.radius > camY + height) continue;
      ctx.save();
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      const pinGrad = ctx.createRadialGradient(p.x - 1, p.y - 1, 1, p.x, p.y, p.radius);
      pinGrad.addColorStop(0, "#fde047");
      pinGrad.addColorStop(1, "#a16207");
      ctx.fillStyle = pinGrad;
      ctx.fill();
      ctx.strokeStyle = "#fef08a";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    // 8. Checkered Finish Line
    const finishY = TOTAL_TRACK_HEIGHT - 350;
    if (finishY >= camY && finishY <= camY + height + 100) {
      const checkW = 16;
      for (let x = 18; x < width - 18; x += checkW) {
        ctx.fillStyle = Math.floor(x / checkW) % 2 === 0 ? "#ffffff" : "#000000";
        ctx.fillRect(x, finishY, checkW, 20);
      }
      ctx.fillStyle = "#22c55e";
      ctx.font = "black 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("🏁 META FINAL 🏁", width / 2, finishY + 45);
    }

    // 9. Marbles
    for (const m of marblesRef.current) {
      if (m.y + m.radius < camY - 20 || m.y - m.radius > camY + height + 20) continue;

      ctx.save();
      // Drop Shadow
      ctx.beginPath();
      ctx.ellipse(m.x + 2, m.y + 4, m.radius * 1.1, m.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fill();

      // 3D Spherical Marble Body
      ctx.beginPath();
      ctx.arc(m.x, m.y, m.radius, 0, Math.PI * 2);
      const mGrad = ctx.createRadialGradient(
        m.x - m.radius * 0.35,
        m.y - m.radius * 0.35,
        m.radius * 0.1,
        m.x,
        m.y,
        m.radius
      );
      mGrad.addColorStop(0, "#ffffff");
      mGrad.addColorStop(0.3, m.color);
      mGrad.addColorStop(1, "#090d16");
      ctx.fillStyle = mGrad;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.3;
      ctx.stroke();

      // Name Tag
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 9px sans-serif";
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.9)";
      ctx.shadowBlur = 4;
      let displayName = m.name;
      if (displayName.length > 7) displayName = displayName.substring(0, 6) + "…";
      ctx.fillText(displayName, m.x, m.y - m.radius - 4);

      // Finish Rank Badge
      if (m.finishRank !== null) {
        ctx.fillStyle =
          m.finishRank === 1 ? "#fbbf24" : m.finishRank === 2 ? "#e2e8f0" : m.finishRank === 3 ? "#d97706" : "#64748b";
        ctx.beginPath();
        ctx.arc(m.x, m.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000000";
        ctx.font = "bold 9px sans-serif";
        ctx.fillText(String(m.finishRank), m.x, m.y + 3);
      }

      ctx.restore();
    }

    ctx.restore();
  }, []);

  // Update physics in animation loop
  const updatePhysics = useCallback(() => {
    const marbles = marblesRef.current;
    const pins = pinsRef.current;
    const spinners = spinnersRef.current;
    const walls = wallsRef.current;
    const bumpers = bumpersRef.current;
    const boostPads = boostPadsRef.current;
    const finishY = TOTAL_TRACK_HEIGHT - 350;
    const now = performance.now();

    // Elapsed Race Time
    const elapsedMs = now - raceStartTimeRef.current;
    setRaceElapsedSec(elapsedMs / 1000);

    // Rotate Spinners
    for (const s of spinners) {
      s.angle += s.speed;
    }

    // Decay Bumper hit animations
    for (const b of bumpers) {
      if (b.hitAnim > 0) b.hitAnim -= 0.05;
    }

    // Physics constants tuned for ~90s duration
    const gravity = 0.052;
    const maxVy = 3.8;
    let anyUnfinished = false;

    for (const m of marbles) {
      if (m.finished) {
        m.vy *= 0.96;
        m.vx *= 0.96;
        m.y += m.vy;
        m.x += m.vx;
        continue;
      }

      anyUnfinished = true;
      m.vy += gravity;
      m.vx += (Math.random() - 0.5) * 0.12;
      m.vx *= 0.985;
      if (m.vy > maxVy) m.vy = maxVy;

      m.x += m.vx;
      m.y += m.vy;

      // Wall Collisions (Left & Right boundaries)
      if (m.x - m.radius < 20) {
        m.x = 20 + m.radius;
        m.vx = Math.abs(m.vx) * 0.75 + 0.5;
      } else if (m.x + m.radius > CANVAS_WIDTH - 20) {
        m.x = CANVAS_WIDTH - 20 - m.radius;
        m.vx = -Math.abs(m.vx) * 0.75 - 0.5;
      }

      // Boost Pad collisions
      for (const pad of boostPads) {
        if (
          m.x >= pad.x &&
          m.x <= pad.x + pad.w &&
          m.y >= pad.y &&
          m.y <= pad.y + pad.h
        ) {
          m.vy = Math.min(m.vy + 1.2, 5.5);
          if (now - lastSoundTickRef.current > 120) {
            sounds.playChip();
            lastSoundTickRef.current = now;
          }
        }
      }

      // Pin Collisions
      for (const p of pins) {
        // Fast bounding box check
        if (Math.abs(m.y - p.y) > 20 || Math.abs(m.x - p.x) > 20) continue;
        const dx = m.x - p.x;
        const dy = m.y - p.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + p.radius;

        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          m.x = p.x + Math.cos(angle) * minDist;
          m.y = p.y + Math.sin(angle) * minDist;

          const speed = Math.hypot(m.vx, m.vy);
          const bounceSpeed = Math.max(speed * 0.7, 1.4);
          m.vx = Math.cos(angle) * bounceSpeed + (Math.random() - 0.5) * 0.8;
          m.vy = Math.sin(angle) * bounceSpeed * 0.8 + 0.3;

          if (now - lastSoundTickRef.current > 70) {
            sounds.playChip();
            lastSoundTickRef.current = now;
          }
        }
      }

      // Bumper Collisions
      for (const b of bumpers) {
        if (Math.abs(m.y - b.y) > 30 || Math.abs(m.x - b.x) > 30) continue;
        const dx = m.x - b.x;
        const dy = m.y - b.y;
        const dist = Math.hypot(dx, dy);
        const minDist = m.radius + b.radius;

        if (dist < minDist) {
          const angle = Math.atan2(dy, dx);
          m.x = b.x + Math.cos(angle) * minDist;
          m.y = b.y + Math.sin(angle) * minDist;
          b.hitAnim = 1;

          // Strong restitution
          m.vx = Math.cos(angle) * 3.6;
          m.vy = Math.sin(angle) * 3.2;

          sounds.playCrash();
        }
      }

      // Slanted Walls Collisions (Line segment vs Circle)
      for (const w of walls) {
        const segVx = w.x2 - w.x1;
        const segVy = w.y2 - w.y1;
        const segLenSq = segVx * segVx + segVy * segVy;
        if (segLenSq === 0) continue;

        let t = ((m.x - w.x1) * segVx + (m.y - w.y1) * segVy) / segLenSq;
        t = Math.max(0, Math.min(1, t));

        const closestX = w.x1 + t * segVx;
        const closestY = w.y1 + t * segVy;
        const dist = Math.hypot(m.x - closestX, m.y - closestY);

        if (dist < m.radius + 3) {
          const nx = (m.x - closestX) / (dist || 1);
          const ny = (m.y - closestY) / (dist || 1);
          m.x = closestX + nx * (m.radius + 3.2);
          m.y = closestY + ny * (m.radius + 3.2);

          const dot = m.vx * nx + m.vy * ny;
          if (dot < 0) {
            m.vx = (m.vx - 1.8 * dot * nx) * 0.8;
            m.vy = (m.vy - 1.8 * dot * ny) * 0.8;
          }
        }
      }

      // Spinner Crossbar Collisions
      for (const s of spinners) {
        if (Math.abs(m.y - s.y) > s.length + 15 || Math.abs(m.x - s.x) > s.length + 15) continue;
        for (let arm = 0; arm < 4; arm++) {
          const armAngle = s.angle + (arm * Math.PI) / 2;
          const tipX = s.x + Math.cos(armAngle) * s.length;
          const tipY = s.y + Math.sin(armAngle) * s.length;

          const segVx = tipX - s.x;
          const segVy = tipY - s.y;
          const segLenSq = segVx * segVx + segVy * segVy;
          let t = ((m.x - s.x) * segVx + (m.y - s.y) * segVy) / segLenSq;
          t = Math.max(0, Math.min(1, t));

          const cx = s.x + t * segVx;
          const cy = s.y + t * segVy;
          const dist = Math.hypot(m.x - cx, m.y - cy);

          if (dist < m.radius + 4) {
            const pushAngle = armAngle + Math.PI / 2 * Math.sign(s.speed);
            m.vx += Math.cos(pushAngle) * 2.2;
            m.vy += Math.sin(pushAngle) * 1.5;
            m.x += Math.cos(pushAngle) * 4;
            m.y += Math.sin(pushAngle) * 4;
          }
        }
      }

      // Finish line crossed!
      if (m.y >= finishY && !m.finished) {
        m.finished = true;
        finishOrderRef.current.push(m);
        m.finishRank = finishOrderRef.current.length;
        m.finishTime = elapsedMs / 1000;

        if (finishOrderRef.current.length === 1) {
          sounds.playWin();
        }
      }
    }

    // Camera follow the leaders smoothly
    const activeMarbles = marbles.filter((m) => !m.finished);
    const targetY =
      activeMarbles.length > 0
        ? Math.max(...activeMarbles.map((m) => m.y)) - VIEWPORT_HEIGHT * 0.5
        : finishY - VIEWPORT_HEIGHT * 0.5;

    cameraYRef.current += (Math.max(0, targetY) - cameraYRef.current) * 0.08;

    // Update Live Leaderboard ranking
    const sorted = [...marbles].sort((a, b) => {
      if (a.finishRank !== null && b.finishRank !== null) return a.finishRank - b.finishRank;
      if (a.finishRank !== null) return -1;
      if (b.finishRank !== null) return 1;
      return b.y - a.y;
    });
    setLeaderboard(sorted);

    renderFrame();

    // End condition: when all marbles have finished OR top 3 finished and 100 seconds elapsed
    if (anyUnfinished && finishOrderRef.current.length < marbles.length) {
      animFrameRef.current = requestAnimationFrame(updatePhysics);
    } else {
      // Race Complete!
      setRacing(false);
      const finalPodium = finishOrderRef.current;
      setPodium(finalPodium);
      setShowPodiumModal(true);
      sounds.playBigWin();

      // Check Bet payout
      if (betAmount > 0 && betCandidateId && finalPodium.length > 0) {
        if (finalPodium[0].id === betCandidateId) {
          const mult = participants.length;
          const payout = betAmount * mult;
          awardWin(payout, "carrera-canicas", "Carrera de Canicas Royale", mult);
        } else {
          sounds.playLose();
        }
      }
    }
  }, [renderFrame, betAmount, betCandidateId, balance, participants.length, awardWin]);

  // Start Race Simulation
  const handleStartRace = () => {
    if (racing || participants.length < 2) return;

    if (betAmount > 0 && betCandidateId) {
      if (betAmount > balance) {
        sounds.playLose();
        alert("Saldo insuficiente para esta apuesta.");
        return;
      }
      const ok = placeBet(betAmount, "carrera-canicas", "Carrera de Canicas Royale");
      if (!ok) return;
    }

    setRacing(true);
    setPodium([]);
    setShowPodiumModal(false);
    setRaceElapsedSec(0);
    raceStartTimeRef.current = performance.now();

    initTrack();
    animFrameRef.current = requestAnimationFrame(updatePhysics);
  };

  useEffect(() => {
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  // Format mm:ss.ms
  const formatTimer = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const secs = Math.floor(sec % 60);
    const ms = Math.floor((sec % 1) * 10);
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${ms}`;
  };

  // Selected target for the English Challenge
  const challengeParticipant =
    podium.length > 0
      ? challengeTargetRole === "winner"
        ? podium[0]
        : podium[podium.length - 1]
      : null;

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-gradient-to-r from-[#111928] via-[#152038] to-[#0f1422] border border-neutral-800 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-2xl">
            🔮
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              Carrera de Canicas Royale 2.0
              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                CIRCUITO LARGO (1:30 MIN)
              </span>
            </h2>
            <p className="text-xs text-neutral-400">
              Pista vertical masiva de 15,800m con molinetes, embudos, zig-zag, rebotadores y reto de preguntas al final.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Race Timer HUD */}
          <div className="px-4 py-2.5 rounded-2xl bg-black/60 border border-amber-500/30 flex items-center gap-2">
            <span className="text-sm">⏱️</span>
            <div>
              <span className="text-[9px] uppercase font-bold text-neutral-400 block leading-none">
                Tiempo de Carrera
              </span>
              <span className="text-base font-mono font-black text-amber-300">
                {formatTimer(raceElapsedSec)}
              </span>
            </div>
          </div>

          <button
            onClick={handleStartRace}
            disabled={racing || participants.length < 2}
            className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-black font-black text-sm transition shadow-xl shadow-amber-500/25 disabled:opacity-40 active:scale-95 flex items-center gap-2"
          >
            <span>{racing ? "🏁" : "🚀"}</span>
            <span>{racing ? "¡COMPITIENDO EN VIVO...!" : "¡LARGAR CARRERA (1:30 MIN)!"}</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Track Canvas (7 cols) + Participants & Live Telemetry (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Track Canvas with Mini-Progress Map overlay */}
        <div className="lg:col-span-7 bg-[#0b0e17] border border-neutral-800 rounded-3xl p-4 sm:p-6 shadow-2xl flex items-center justify-center relative overflow-hidden">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={VIEWPORT_HEIGHT}
              className="max-w-full h-auto rounded-2xl border border-neutral-800 shadow-2xl bg-[#080b13]"
            />

            {/* Vertical Minimap / Track Progress Rail on Right */}
            <div className="absolute top-4 right-3 bottom-4 w-5 bg-black/60 backdrop-blur-md border border-neutral-700/60 rounded-full flex flex-col justify-between items-center py-2 z-10">
              <span className="text-[9px] font-bold text-amber-400">0%</span>
              <div className="w-1.5 flex-1 relative my-1 bg-neutral-800 rounded-full overflow-hidden">
                {marblesRef.current.map((m) => {
                  const pct = Math.min(100, Math.max(0, (m.y / (TOTAL_TRACK_HEIGHT - 350)) * 100));
                  return (
                    <div
                      key={m.id}
                      className="absolute left-0 w-full h-2 rounded-full transition-all duration-75"
                      style={{
                        top: `${pct}%`,
                        backgroundColor: m.color,
                        boxShadow: `0 0 4px ${m.color}`,
                      }}
                      title={`${m.name}: ${pct.toFixed(0)}%`}
                    />
                  );
                })}
              </div>
              <span className="text-[9px] font-bold text-emerald-400">100%</span>
            </div>
          </div>
        </div>

        {/* Live Leaderboard + Participant Manager */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {/* Live Leaderboard Telemetry Card */}
          <div className="p-4 rounded-3xl bg-[#0f1422] border border-neutral-800 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center gap-2">
                <span className="text-base">🏆</span>
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-400">
                  Posiciones en Vivo
                </h4>
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                {marblesRef.current.filter((m) => m.finished).length} / {participants.length} en meta
              </span>
            </div>

            <div className="space-y-1.5 max-h-52 overflow-y-auto custom-scroll pr-1">
              {leaderboard.map((m, idx) => {
                const isWinner = m.finishRank === 1;
                const isTop3 = (m.finishRank ?? idx + 1) <= 3;
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-all ${
                      isWinner
                        ? "bg-amber-500/20 border border-amber-500/50"
                        : "bg-[#141b2c] border border-neutral-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 h-5 rounded-lg flex items-center justify-center font-black text-[10px] ${
                          idx === 0
                            ? "bg-amber-500 text-black"
                            : idx === 1
                            ? "bg-slate-300 text-black"
                            : idx === 2
                            ? "bg-amber-700 text-white"
                            : "bg-neutral-800 text-neutral-400"
                        }`}
                      >
                        {m.finishRank ?? idx + 1}
                      </span>
                      <span
                        className="w-2.5 h-2.5 rounded-full"
                        style={{ backgroundColor: m.color }}
                      />
                      <span className="font-bold text-white truncate max-w-[120px]">{m.name}</span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-mono">
                      {m.finished ? (
                        <span className="text-emerald-400 font-bold">
                          🏁 {m.finishTime?.toFixed(1)}s
                        </span>
                      ) : (
                        <span className="text-neutral-400">
                          {((m.y / (TOTAL_TRACK_HEIGHT - 350)) * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Participant Manager */}
          <ParticipantInput
            participants={participants}
            onAddParticipant={handleAdd}
            onImportBulk={handleBulk}
            onRemoveParticipant={handleRemove}
            onShuffle={handleShuffle}
            onResetSample={handleResetSample}
            onClearAll={handleClear}
            disabled={racing}
            betCandidateId={betCandidateId}
            onSelectCandidate={setBetCandidateId}
            betAmount={betAmount}
            onChangeBetAmount={setBetAmount}
          />
        </div>
      </div>

      {/* Podium Modal with English Challenge Launcher */}
      {showPodiumModal && podium.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg bg-gradient-to-b from-[#182035] to-[#0c101c] border-2 border-amber-500/50 rounded-3xl p-6 sm:p-8 shadow-2xl text-center relative overflow-hidden animate-in zoom-in-95">
            <div className="text-5xl mb-2 animate-bounce">🏆</div>
            <span className="text-xs uppercase font-extrabold tracking-widest text-amber-400">
              ¡PODIO DE LA CARRERA DE CANICAS!
            </span>
            <p className="text-xs text-neutral-400 mt-1">
              Carrera completada en {formatTimer(raceElapsedSec)}
            </p>

            {/* 1st Place Champion */}
            <div className="my-5 p-5 rounded-2xl bg-[#111728] border border-amber-500/40 shadow-inner flex flex-col items-center">
              <span className="text-3xl mb-1">🥇</span>
              <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                ¡1er Lugar Campeón!
              </span>
              <span className="text-2xl font-black text-white mt-1" style={{ color: podium[0].color }}>
                {podium[0].name}
              </span>
              <span className="text-xs text-neutral-400 mt-1">
                Tiempo: {podium[0].finishTime?.toFixed(2)}s
              </span>
            </div>

            {/* 2nd and 3rd Places */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              {podium.length > 1 && (
                <div className="p-3 rounded-xl bg-[#13192c] border border-neutral-700 text-center">
                  <span className="text-xl">🥈 2° Lugar</span>
                  <p className="text-sm font-bold text-white mt-1 truncate" style={{ color: podium[1].color }}>
                    {podium[1].name}
                  </p>
                </div>
              )}
              {podium.length > 2 && (
                <div className="p-3 rounded-xl bg-[#13192c] border border-neutral-700 text-center">
                  <span className="text-xl">🥉 3° Lugar</span>
                  <p className="text-sm font-bold text-white mt-1 truncate" style={{ color: podium[2].color }}>
                    {podium[2].name}
                  </p>
                </div>
              )}
            </div>

            {/* Challenge Target Selector (Winner or Loser) */}
            <div className="p-3 rounded-xl bg-[#111728] border border-neutral-800 mb-5 flex items-center justify-between">
              <span className="text-xs text-neutral-300 font-bold">Aplicar Reto de Inglés a:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setChallengeTargetRole("winner")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    challengeTargetRole === "winner"
                      ? "bg-amber-500 text-black"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  👑 Ganador
                </button>
                <button
                  onClick={() => setChallengeTargetRole("loser")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                    challengeTargetRole === "loser"
                      ? "bg-rose-500 text-white"
                      : "bg-neutral-800 text-neutral-400 hover:text-white"
                  }`}
                >
                  ⚡ Último (Penitencia)
                </button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowChallengeModal(true)}
                className="flex-1 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-black font-black text-sm transition shadow-lg shadow-emerald-500/25 active:scale-95 flex items-center justify-center gap-2"
              >
                <span>📜</span>
                <span>Resolver Reto de Inglés</span>
              </button>
              <button
                onClick={() => setShowPodiumModal(false)}
                className="px-6 py-3.5 rounded-2xl bg-neutral-800 hover:bg-neutral-700 text-white font-bold text-sm transition active:scale-95"
              >
                Cerrar Podio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* English Challenge Modal */}
      {challengeParticipant && (
        <TournamentChallengeModal
          isOpen={showChallengeModal}
          participantName={challengeParticipant.name}
          participantColor={challengeParticipant.color}
          role={challengeTargetRole}
          gameTitle="Carrera de Canicas Royale"
          onClose={() => setShowChallengeModal(false)}
        />
      )}
    </div>
  );
}
