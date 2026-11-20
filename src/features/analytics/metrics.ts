import { endOfWeek, format, startOfMonth, startOfWeek, subMonths, subWeeks } from 'date-fns';
import type { ContentItem, Coverage, Project, SocialSnapshot, Task } from '@/lib/types';
import { engagementOf } from '@/lib/domain';
import { monthKey } from '@/lib/utils';

/** Completed tasks per week for the last n weeks (oldest first). */
export function completedByWeek(tasks: Task[], n = 12) {
  const out: { label: string; start: number; completed: number; created: number }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = startOfWeek(subWeeks(new Date(), i), { weekStartsOn: 1 });
    const e = endOfWeek(s, { weekStartsOn: 1 });
    out.push({
      label: format(s, 'd MMM'),
      start: s.getTime(),
      completed: tasks.filter((t) => t.completedAt && t.completedAt >= s.getTime() && t.completedAt <= e.getTime()).length,
      created: tasks.filter((t) => t.createdAt >= s.getTime() && t.createdAt <= e.getTime()).length,
    });
  }
  return out;
}

export function lastMonths(n: number) {
  return Array.from({ length: n }, (_, i) => monthKey(subMonths(startOfMonth(new Date()), n - 1 - i)));
}

export function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number);
  return format(new Date(y, m - 1, 1), 'MMM');
}

export function publishedByMonth(content: ContentItem[], months = 6) {
  const keys = lastMonths(months);
  const platforms = [...new Set(content.filter((c) => c.status === 'published').map((c) => c.platform))];
  return {
    platforms,
    data: keys.map((k) => {
      const row: Record<string, string | number> = { month: monthLabel(k) };
      for (const p of platforms) row[p] = content.filter((c) => c.status === 'published' && c.platform === p && c.publishDate?.startsWith(k)).length;
      return row;
    }),
  };
}

export function coverageByMonth(coverage: Coverage[], months = 6) {
  return lastMonths(months).map((k) => {
    const list = coverage.filter((c) => c.date?.startsWith(k));
    return { month: monthLabel(k), pieces: list.length, reach: list.reduce((s, c) => s + (c.reach ?? 0), 0) };
  });
}

export function projectsCompletedByMonth(projects: Project[], months = 6) {
  return lastMonths(months).map((k) => ({
    month: monthLabel(k),
    completed: projects.filter((p) => p.status === 'completed' && p.completedAt && monthKey(new Date(p.completedAt)) === k).length,
  }));
}

/** Latest snapshot per platform and the change vs ~30 days earlier. */
export function socialSummary(snaps: SocialSnapshot[]) {
  const byPlatform = new Map<string, SocialSnapshot[]>();
  for (const s of snaps) (byPlatform.get(s.platform) ?? byPlatform.set(s.platform, []).get(s.platform)!).push(s);
  return [...byPlatform.entries()].map(([platform, list]) => {
    const sorted = list.sort((a, b) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const cutoff = format(subMonths(new Date(latest.date), 1), 'yyyy-MM-dd');
    const prev = [...sorted].reverse().find((s) => s.date <= cutoff) ?? sorted[0];
    return {
      platform,
      latest,
      followers: latest.followers ?? null,
      followerChange: latest.followers != null && prev.followers != null && prev !== latest ? latest.followers - prev.followers : null,
      series: sorted,
    };
  });
}

export function contentTotals(items: ContentItem[]) {
  const pub = items.filter((c) => c.status === 'published');
  const reach = pub.reduce((s, c) => s + (c.metrics.reach ?? 0), 0);
  const eng = pub.reduce((s, c) => s + engagementOf(c.metrics), 0);
  const views = pub.reduce((s, c) => s + (c.metrics.views ?? 0), 0);
  return { published: pub.length, reach, engagement: eng, views, rate: reach ? (eng / reach) * 100 : null };
}

export function isThisMonth(ts?: number | null) {
  return !!ts && monthKey(new Date(ts)) === monthKey(new Date());
}
