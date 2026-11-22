import { useEffect, useState } from 'react';

/**
 * Bridges design tokens (CSS custom properties) into places that cannot read
 * CSS variables themselves — SVG chart attributes, <meta theme-color>, canvas.
 * Values are never duplicated here: they are read from the live stylesheet.
 */

/** A semantic colour role from themes.css, e.g. 'accent', 'teal', 'clay'. */
export type ColorRole =
  | 'accent' | 'accent-deep' | 'accent-soft' | 'teal' | 'violet' | 'clay' | 'ochre'
  | 'info' | 'ok' | 'warn' | 'danger' | 'fg' | 'muted' | 'faint' | 'sunken' | 'line' | 'bg' | 'surface' | 'raised' | 'ink';

/** CSS colour string for a role — use in `style` props (it follows the theme live). */
export const roleColor = (role: ColorRole, alpha?: number) => (alpha === undefined ? `rgb(var(--${role}))` : `rgb(var(--${role}) / ${alpha})`);

let probe: HTMLSpanElement | null = null;

/** Resolves any CSS colour (including `rgb(var(--x))`) to a concrete `rgb(...)` string. */
export function resolveColor(css: string): string {
  if (typeof document === 'undefined' || !css.includes('var(')) return css;
  if (!probe) {
    probe = document.createElement('span');
    probe.style.display = 'none';
    document.body.appendChild(probe);
  }
  probe.style.color = '';
  probe.style.color = css;
  return getComputedStyle(probe).color || css;
}

/**
 * Chart series order (DESIGN.md §12). Sage leads; teal, warm and info follow;
 * violet is reserved for the 5th+ series so it stays rare.
 */
export const CHART_ROLES: ColorRole[] = ['accent', 'teal', 'clay', 'info', 'violet', 'accent-deep'];

/** Re-renders when the theme or accent changes, so resolved colours stay correct. */
export function useThemeVersion() {
  const [v, setV] = useState(0);
  useEffect(() => {
    const el = document.documentElement;
    const obs = new MutationObserver(() => setV((x) => x + 1));
    obs.observe(el, { attributes: true, attributeFilter: ['class', 'data-accent'] });
    return () => obs.disconnect();
  }, []);
  return v;
}

/** Resolved chart palette for the current theme. */
export function useChartColors() {
  useThemeVersion();
  return {
    series: CHART_ROLES.map((r) => resolveColor(roleColor(r))),
    resolve: (css: string) => resolveColor(css),
    grid: resolveColor('rgb(var(--line) / var(--line-alpha))'),
    muted: resolveColor(roleColor('sunken')),
  };
}
