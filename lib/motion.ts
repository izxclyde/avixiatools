// House motion system — Apple fluid interfaces, translated for the web.
// damping 1.0 default (no overshoot); bounce only when a flick preceded it.
// ponytail: one module covers springs + projection + rubberband + velocity.

export const SPRINGS = {
  // Critically damped default — graceful, non-distracting (§4)
  default: { type: "spring", bounce: 0, duration: 0.4 } as const,
  // Momentum interaction — slight bounce, only because a flick preceded it (§4)
  flick: { type: "spring", bounce: 0.2, duration: 0.4 } as const,
  // Drawer / sheet preset (damping ~0.8, response 0.3)
  sheet: { type: "spring", bounce: 0.2, duration: 0.3 } as const,
} as const;

// Apple's exact momentum projection (Designing Fluid Interfaces sample code, §6).
// decelerationRate ≈ 0.998 normal scroll feel; 0.99 snappier.
export function project(
  initialVelocity: number /* px/s */,
  decelerationRate = 0.998
): number {
  return ((initialVelocity / 1000) * decelerationRate) / (1 - decelerationRate);
}

// Soft boundary — progressive resistance instead of a hard stop (§9).
export function rubberband(
  overshoot: number,
  dimension: number,
  constant = 0.55
): number {
  return (
    (overshoot * dimension * constant) /
    (dimension + constant * Math.abs(overshoot))
  );
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function")
    return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export type VelocitySample = { x: number; y: number; t: number };

// Track a short position history, derive release velocity (§2, §5).
// Keep last ~5 samples; velocity = distance / time over the window.
export function velocityFromHistory(samples: VelocitySample[]): {
  vx: number;
  vy: number;
} {
  const n = samples.length;
  if (n < 2) return { vx: 0, vy: 0 };
  const first = samples[Math.max(0, n - 5)];
  const last = samples[n - 1];
  const dt = (last.t - first.t) / 1000;
  if (dt <= 0) return { vx: 0, vy: 0 };
  return { vx: (last.x - first.x) / dt, vy: (last.y - first.y) / dt };
}

// Choose the snap target nearest the projected resting point (§6).
export function nearestSnapIndex(
  currentPosition: number,
  releaseVelocity: number,
  snapPositions: number[]
): number {
  if (snapPositions.length === 0) return 0;
  const projected = currentPosition + project(releaseVelocity);
  let best = 0;
  let bestDist = Math.abs(snapPositions[0] - projected);
  for (let i = 1; i < snapPositions.length; i++) {
    const d = Math.abs(snapPositions[i] - projected);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}
