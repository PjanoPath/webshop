'use client';

import { useEffect, useState } from 'react';

// One shared pool every shape draws from - a vivid autumn range plus a few still-green tones,
// since not every leaf has turned yet. Any shape can land on any color here (maple leaves can
// come up green, the green-leaf shape can come up orange, etc.) rather than each shape being
// locked to its own subset.
const LEAF_COLORS = [
  '#F4A825',
  '#E8720C',
  '#C1440E',
  '#8B2E1F',
  '#A64B2A',
  '#D9A441',
  '#8FA968',
  '#A9C46C',
  '#6E8B3D',
  '#B9CB8B',
];

type Leaf = {
  id: number;
  left: number;
  size: number;
  drift: number; // overall sideways push for the whole fall, in vw - the "wind"
  sway: number; // flutter amplitude, in px
  swayDuration: number; // flutter's own (short) period, independent of the fall
  rotation: number;
  spinDuration: number; // tumble's own (independent) period
  fallDuration: number;
  fallDelay: number;
  colorA: string;
  colorB: string;
  shape: number;
  flip: boolean;
};

// Real leaf silhouettes traced from Twemoji (CC-BY 4.0, twemoji.twitter.com - credited in the
// footer) instead of hand-drawn shapes - an actual five-point maple leaf and a simple rounded
// leaf, both a proper illustrator's outline rather than a geometric guess. Twemoji's own flat
// fill colors are dropped in favor of the per-leaf gradient below, since the goal here is
// variety across leaves, not matching the source emoji's exact colorway.
const LEAF_PATHS = [
  'M36 20.917c0-.688-2.895-.5-3.125-1s3.208-4.584 2.708-5.5-5.086 1.167-5.375.708c-.288-.458.292-3.5-.208-3.875s-5.25 4.916-5.917 4.292c-.666-.625 1.542-10.5 1.086-10.698-.456-.198-3.419 1.365-3.793 1.282C21.002 6.042 18.682 0 18 0s-3.002 6.042-3.376 6.125c-.374.083-3.337-1.48-3.793-1.282-.456.198 1.752 10.073 1.085 10.698C11.25 16.166 6.5 10.875 6 11.25s.08 3.417-.208 3.875c-.289.458-4.875-1.625-5.375-.708s2.939 5 2.708 5.5-3.125.312-3.125 1 8.438 5.235 9 5.771c.562.535-2.914 2.802-2.417 3.229.576.496 3.839-.83 10.417-.957V35c0 .553.448 1 1 1 .553 0 1-.447 1-1v-6.04c6.577.127 9.841 1.453 10.417.957.496-.428-2.979-2.694-2.417-3.229.562-.536 9-5.084 9-5.771z',
  'M14 20c0 4.418-2 12.562-13.062 13C3.562 29.125 0 24.418 0 20c0-4.418 2.582-8 7-8s7 3.582 7 8z',
  // The main blade of Twemoji's "leaf fluttering in wind" (the wind-swirl lines and the darker
  // vein overlay from that same emoji are dropped) - a broader, simpler leaf silhouette than
  // the maple, natural to pair with a still-green color.
  'M6.401 28.55c5.006 5.006 16.502 11.969 29.533-.07-7.366-1.417-8.662-10.789-13.669-15.794-5.006-5.007-11.991-6.139-16.998-1.133-5.006 5.006-3.873 11.99 1.134 16.997z',
];
// The maple leaf fills its whole native 36x36 canvas, but the rounded leaf was cropped out of a
// larger two-leaf illustration and only occupies a small corner of that same canvas - reused as
// a 0 0 36 36 viewBox, it rendered tiny and mostly empty, so the dark drop-shadow around its
// sliver of actual fill dominated and read as a dull green-olive smudge rather than a leaf.
// Each shape gets its own tight viewBox (matching its real path bounds) instead. The third
// shape, like the maple, was drawn to fill its source emoji's own 36x36 canvas already.
const LEAF_VIEWBOXES = ['0 0 36 36', '0 12 14 21', '0 0 36 36'];

let gradientSeq = 0;

function LeafShape({ colorA, colorB, shape, flip }: { colorA: string; colorB: string; shape: number; flip: boolean }) {
  const [gradId] = useState(() => `leaf-grad-${gradientSeq++}`);
  return (
    <svg
      viewBox={LEAF_VIEWBOXES[shape]}
      width="100%"
      height="100%"
      style={{
        filter: 'drop-shadow(0 1px 1.5px rgba(43,48,28,0.22))',
        transform: flip ? 'scaleX(-1)' : undefined,
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={colorA} />
          <stop offset="100%" stopColor={colorB} />
        </linearGradient>
      </defs>
      <path d={LEAF_PATHS[shape]} fill={`url(#${gradId})`} />
    </svg>
  );
}

function makeLeaves(count: number): Leaf[] {
  return Array.from({ length: count }, (_, id) => {
    const shape = Math.floor(Math.random() * LEAF_PATHS.length);
    const colorA = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
    let colorB = LEAF_COLORS[Math.floor(Math.random() * LEAF_COLORS.length)];
    if (colorB === colorA) colorB = LEAF_COLORS[(LEAF_COLORS.indexOf(colorA) + 1) % LEAF_COLORS.length];
    return {
      id,
      left: Math.random() * 100,
      size: 18 + Math.random() * 14,
      // vw, not px, so the wind push is proportional to screen width and stays visible on any
      // display; direction is random so leaves don't all drift the same way.
      drift: (Math.random() - 0.5) * 2 * (6 + Math.random() * 10),
      sway: 16 + Math.random() * 24,
      swayDuration: 1.8 + Math.random() * 2.2, // several swings per fall, not one long pass
      rotation: (Math.random() < 0.5 ? -1 : 1) * (220 + Math.random() * 260),
      spinDuration: 3 + Math.random() * 4,
      fallDuration: 11 + Math.random() * 10,
      fallDelay: -Math.random() * 20, // negative so leaves are already mid-fall on load, not bunched at top
      colorA,
      colorB,
      shape,
      flip: Math.random() < 0.5,
    };
  });
}

// Starts empty (matches what the server renders) and only fills in the randomized leaves
// after mount - the random per-leaf values would otherwise differ between server and client
// render and trigger a hydration mismatch, for a purely decorative effect that doesn't need
// to exist during SSR anyway.
export default function AutumnLeaves() {
  const [leaves, setLeaves] = useState<Leaf[]>([]);

  useEffect(() => {
    // Still sparse - each leaf's own independently-timed drift/sway/spin already gives sane
    // variety without needing a large flock to make it noticeable.
    setLeaves(makeLeaves(4)); // was 7, halved
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {leaves.map((leaf) => (
        // Three independent animations nested inside each other - see the comment in
        // globals.css for why splitting fall/sway/spin into separate loops (instead of one
        // keyframe covering all of it) is what actually makes the motion read as natural.
        <div
          key={leaf.id}
          className="leaf-drop"
          style={{
            left: `${leaf.left}%`,
            width: leaf.size,
            height: leaf.size,
            animationDuration: `${leaf.fallDuration}s`,
            animationDelay: `${leaf.fallDelay}s`,
            ['--drift' as string]: `${leaf.drift}vw`,
          }}
        >
          <div
            className="leaf-sway"
            style={{
              width: '100%',
              height: '100%',
              animationDuration: `${leaf.swayDuration}s`,
              ['--sway' as string]: `${leaf.sway}px`,
            }}
          >
            <div
              className="leaf-spin"
              style={{
                width: '100%',
                height: '100%',
                animationDuration: `${leaf.spinDuration}s`,
                ['--rot' as string]: `${leaf.rotation}deg`,
              }}
            >
              <LeafShape colorA={leaf.colorA} colorB={leaf.colorB} shape={leaf.shape} flip={leaf.flip} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
