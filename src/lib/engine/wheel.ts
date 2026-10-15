export type WheelSegment = {
  value: number; // multiplier e.g. 1, 2, 5, 10, 20, 40
  color: string;
  textColor: string;
  label: string;
  isJackpot?: boolean;
};

// 54 segments classic casino wheel distribution
// 1x: 24 segments
// 2x: 15 segments
// 5x: 7 segments
// 10x: 4 segments
// 20x: 2 segments
// 40x: 1 segment
// JACKPOT 100x: 1 segment
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 5, color: "#7c3aed", textColor: "#ffffff", label: "5X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 10, color: "#d97706", textColor: "#ffffff", label: "10X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 5, color: "#7c3aed", textColor: "#ffffff", label: "5X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 20, color: "#dc2626", textColor: "#ffffff", label: "20X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 5, color: "#7c3aed", textColor: "#ffffff", label: "5X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 10, color: "#d97706", textColor: "#ffffff", label: "10X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 100, color: "#eab308", textColor: "#000000", label: "JACKPOT", isJackpot: true },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 5, color: "#7c3aed", textColor: "#ffffff", label: "5X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 40, color: "#059669", textColor: "#ffffff", label: "40X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 5, color: "#7c3aed", textColor: "#ffffff", label: "5X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
  { value: 10, color: "#d97706", textColor: "#ffffff", label: "10X" },
  { value: 1, color: "#475569", textColor: "#ffffff", label: "1X" },
  { value: 2, color: "#2563eb", textColor: "#ffffff", label: "2X" },
];

export function spinWheel(): { segmentIndex: number; segment: WheelSegment } {
  const segmentIndex = Math.floor(Math.random() * WHEEL_SEGMENTS.length);
  return { segmentIndex, segment: WHEEL_SEGMENTS[segmentIndex] };
}
