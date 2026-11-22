import { memo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Generative cover art — a signature element of Work OS.
 *
 * Every project/campaign gets a deterministic abstract composition (derived
 * from its id) in the house palette, like a series of printed studio covers.
 * The user can override the motif and palette; the choice is stored in the
 * record's existing `color` field as "motif|palette".
 */

export const MOTIFS = ['horizon', 'orbit', 'stripes', 'blocks', 'grid', 'arch'] as const;
export type Motif = (typeof MOTIFS)[number];

export const PALETTES: Record<string, { name: string; bg: string; a: string; b: string; c: string }> = {
  sage: { name: 'Sage', bg: '#DCE3D3', a: '#6E8B6A', b: '#2F3A31', c: '#F2EDE2' },
  clay: { name: 'Clay', bg: '#EAD6C6', a: '#B66E4E', b: '#3A2A22', c: '#F6EDE3' },
  ochre: { name: 'Ochre', bg: '#EFE1BF', a: '#BF923F', b: '#3B3020', c: '#FAF4E4' },
  slate: { name: 'Slate', bg: '#D6DEE6', a: '#5F7A96', b: '#25303B', c: '#F1F2EE' },
  plum: { name: 'Plum', bg: '#E5D7DF', a: '#8C6481', b: '#352833', c: '#F6EEF0' },
  ink: { name: 'Ink', bg: '#2C2E2A', a: '#C9B99A', b: '#8FA58A', c: '#EAE3D4' },
  sand: { name: 'Sand', bg: '#ECE4D4', a: '#A89A7E', b: '#4B463C', c: '#F8F4EA' },
};
const PALETTE_KEYS = Object.keys(PALETTES);

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function parseCover(seed: string, color?: string | null): { motif: Motif; palette: string; h: number } {
  const h = hash(seed);
  const [m, p] = (color ?? '').split('|');
  return {
    motif: (MOTIFS as readonly string[]).includes(m) ? (m as Motif) : MOTIFS[h % MOTIFS.length],
    palette: PALETTES[p] ? p : PALETTE_KEYS[(h >> 5) % PALETTE_KEYS.length],
    h,
  };
}

export function coverAccent(seed: string, color?: string | null) {
  return PALETTES[parseCover(seed, color).palette].a;
}

export const Cover = memo(function Cover({ seed, color, className, rounded = true }: { seed: string; color?: string | null; className?: string; rounded?: boolean }) {
  const { motif, palette, h } = parseCover(seed, color);
  const P = PALETTES[palette];
  const r = (n: number) => ((h >> n) & 0xff) / 255; // 0..1 pseudo-random from hash bits
  return (
    <div className={cn('relative overflow-hidden', rounded && 'rounded-lg', className)} style={{ background: P.bg }} aria-hidden>
      <svg viewBox="0 0 200 120" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        {motif === 'horizon' && (
          <>
            <circle cx={60 + r(3) * 80} cy={78} r={34 + r(7) * 10} fill={P.a} />
            {Array.from({ length: 6 }, (_, i) => (
              <rect key={i} x={0} y={82 + i * 7} width={200} height={3.2} fill={P.b} opacity={0.9 - i * 0.12} />
            ))}
          </>
        )}
        {motif === 'orbit' && (
          <>
            <circle cx={120 + r(2) * 40} cy={60} r={46} fill="none" stroke={P.b} strokeWidth={1.2} />
            <circle cx={120 + r(2) * 40} cy={60} r={30} fill="none" stroke={P.b} strokeWidth={1.2} opacity={0.6} />
            <circle cx={70 + r(9) * 30} cy={52 + r(4) * 20} r={22} fill={P.a} />
            <circle cx={150 + r(6) * 20} cy={30 + r(1) * 30} r={5} fill={P.b} />
          </>
        )}
        {motif === 'stripes' && (
          <g transform={`rotate(${-28 + r(4) * 20} 100 60)`}>
            {Array.from({ length: 9 }, (_, i) => (
              <rect key={i} x={-40 + i * 34} y={-60} width={i % 3 === 0 ? 18 : 6} height={260} fill={i % 3 === 0 ? P.a : P.b} opacity={i % 3 === 0 ? 1 : 0.75} />
            ))}
          </g>
        )}
        {motif === 'blocks' && (
          <>
            <rect x={20 + r(1) * 20} y={18} width={70} height={84} fill={P.a} />
            <rect x={100} y={18 + r(5) * 20} width={80} height={40} fill={P.b} />
            <circle cx={140} cy={88} r={18} fill={P.c} />
            <rect x={100} y={70} width={8} height={32} fill={P.b} />
          </>
        )}
        {motif === 'grid' && (
          <>
            {Array.from({ length: 10 }, (_, x) =>
              Array.from({ length: 6 }, (_, y) => {
                const on = ((h >> ((x * 6 + y) % 28)) & 3) === 0;
                return <circle key={`${x}-${y}`} cx={14 + x * 19.5} cy={14 + y * 19} r={on ? 6.5 : 2} fill={on ? P.a : P.b} opacity={on ? 1 : 0.55} />;
              }),
            )}
          </>
        )}
        {motif === 'arch' && (
          <>
            <path d={`M ${40 + r(3) * 20} 120 V 70 a 40 40 0 0 1 80 0 V 120 Z`} fill={P.a} />
            <path d={`M ${70 + r(3) * 20} 120 V 82 a 20 20 0 0 1 40 0 V 120 Z`} fill={P.b} />
            <circle cx={170} cy={26} r={10} fill={P.b} opacity={0.8} />
          </>
        )}
      </svg>
      <div className="grain absolute inset-0" />
    </div>
  );
});

export function CoverPicker({ seed, value, onChange }: { seed: string; value?: string | null; onChange: (v: string) => void }) {
  const cur = parseCover(seed, value);
  return (
    <div className="space-y-3">
      <div>
        <span className="label">Motif</span>
        <div className="grid grid-cols-6 gap-1.5">
          {MOTIFS.map((m) => (
            <button key={m} onClick={() => onChange(`${m}|${cur.palette}`)} className={cn('rounded-md p-0.5 transition', cur.motif === m ? 'ring-2 ring-fg/60' : 'opacity-80 hover:opacity-100')} title={m} aria-label={`Motif ${m}`}>
              <Cover seed={seed} color={`${m}|${cur.palette}`} className="aspect-[5/3]" rounded />
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="label">Palette</span>
        <div className="flex flex-wrap gap-1.5">
          {PALETTE_KEYS.map((p) => (
            <button key={p} onClick={() => onChange(`${cur.motif}|${p}`)} className={cn('flex h-7 items-center gap-1.5 rounded-full pl-1 pr-2.5 text-xs transition', cur.palette === p ? 'bg-ink text-ink-fg' : 'bg-sunken text-muted hover:text-fg')}>
              <span className="h-5 w-5 rounded-full" style={{ background: `linear-gradient(135deg, ${PALETTES[p].bg} 50%, ${PALETTES[p].a} 50%)` }} />
              {PALETTES[p].name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
