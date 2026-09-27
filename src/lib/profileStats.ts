export type RawAttempt = {
  id: string;
  category: string;
  mode: string;
  score: number;
  total: number;
  elapsed: number;
  createdAt: string;
};

export function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h} цаг ${mm} мин` : `${h} цаг`;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

export function computeStats(attempts: RawAttempt[]) {
  const n = attempts.length;
  let totalScore = 0;
  let totalQuestions = 0;
  let totalElapsed = 0;
  let bestPct = 0;
  let passCount = 0;
  let examCount = 0;
  let studyCount = 0;
  let examTime = 0;
  let studyTime = 0;
  let longest = 0;
  let fastest = Infinity;
  let mostQuestions = 0;
  let firstDate: Date | null = null;
  let lastDate: Date | null = null;
  const catMap = new Map<string, { count: number; score: number; total: number; elapsed: number }>();
  const daySet = new Set<string>();

  for (const a of attempts) {
    const t = a.total > 0 ? a.total : 1;
    const pct = (a.score / t) * 100;
    totalScore += a.score;
    totalQuestions += a.total;
    totalElapsed += a.elapsed;
    if (a.total > 0) bestPct = Math.max(bestPct, pct);
    if (pct >= 60) passCount++;
    if (a.mode === "study") {
      studyCount++;
      studyTime += a.elapsed;
    } else {
      examCount++;
      examTime += a.elapsed;
    }
    longest = Math.max(longest, a.elapsed);
    if (a.elapsed > 0) fastest = Math.min(fastest, a.elapsed);
    mostQuestions = Math.max(mostQuestions, a.total);
    const c = catMap.get(a.category) || { count: 0, score: 0, total: 0, elapsed: 0 };
    c.count++;
    c.score += a.score;
    c.total += a.total;
    c.elapsed += a.elapsed;
    catMap.set(a.category, c);
    const d = new Date(a.createdAt);
    daySet.add(dayKey(d));
    if (!firstDate || d < firstDate) firstDate = d;
    if (!lastDate || d > lastDate) lastDate = d;
  }

  const addDays = (d: Date, num: number) => {
    const c = new Date(d);
    c.setDate(c.getDate() + num);
    return c;
  };
  let streak = 0;
  let day = new Date();
  if (!daySet.has(dayKey(day))) day = addDays(day, -1);
  while (daySet.has(dayKey(day))) {
    streak++;
    day = addDays(day, -1);
  }
  let longestStreak = 0;
  let run = 0;
  let prevT: number | null = null;
  const sortedDays = [...daySet]
    .map((k) => k.split("-").map(Number))
    .sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
  for (const k of sortedDays) {
    const t = new Date(k[0], k[1], k[2]).getTime();
    if (prevT !== null && (t - prevT) / 86400000 === 1) run++;
    else run = 1;
    longestStreak = Math.max(longestStreak, run);
    prevT = t;
  }

  const weeks: { key: string; label: string; count: number; score: number; total: number }[] = [];
  const mondayOf = (d: Date) => {
    const c = new Date(d);
    c.setHours(0, 0, 0, 0);
    c.setDate(c.getDate() - ((c.getDay() + 6) % 7));
    return c;
  };
  const thisMonday = mondayOf(new Date());
  for (let i = 7; i >= 0; i--) {
    const w = addDays(thisMonday, -i * 7);
    weeks.push({
      key: w.toISOString().slice(0, 10),
      label: `${w.getMonth() + 1}/${w.getDate()}`,
      count: 0,
      score: 0,
      total: 0,
    });
  }
  const weekIdx = new Map(weeks.map((w, i) => [w.key, i]));
  let thisWeekCount = 0;
  let thisWeekTime = 0;
  let thisWeekScore = 0;
  let thisWeekTotal = 0;
  for (const a of attempts) {
    const wk = mondayOf(new Date(a.createdAt)).toISOString().slice(0, 10);
    const i = weekIdx.get(wk);
    if (i !== undefined) {
      weeks[i].count++;
      weeks[i].score += a.score;
      weeks[i].total += a.total;
    }
    if (wk === thisMonday.toISOString().slice(0, 10)) {
      thisWeekCount++;
      thisWeekTime += a.elapsed;
      thisWeekScore += a.score;
      thisWeekTotal += a.total;
    }
  }

  const topCategories = [...catMap.entries()]
    .map(([category, c]) => ({ category, ...c, avgPct: c.total > 0 ? Math.round((c.score / c.total) * 100) : null }))
    .sort((x, y) => y.count - x.count)
    .slice(0, 6);
  const maxCatCount = topCategories.length ? topCategories[0].count : 0;

  return {
    n,
    totalScore,
    totalQuestions,
    totalElapsed,
    avgPct: totalQuestions > 0 ? Math.round((totalScore / totalQuestions) * 100) : null,
    bestPct: n > 0 ? Math.round(bestPct) : null,
    passRate: n > 0 ? Math.round((passCount / n) * 100) : null,
    passCount,
    examCount,
    studyCount,
    examTime,
    studyTime,
    longest,
    fastest: fastest === Infinity ? null : fastest,
    mostQuestions,
    firstDate: firstDate ? firstDate.toISOString() : null,
    lastDate: lastDate ? lastDate.toISOString() : null,
    streak,
    longestStreak,
    avgElapsed: n > 0 ? Math.round(totalElapsed / n) : 0,
    weeks,
    maxWeekCount: Math.max(1, ...weeks.map((w) => w.count)),
    topCategories,
    maxCatCount,
    thisWeekCount,
    thisWeekTime,
    thisWeekAvgPct: thisWeekTotal > 0 ? Math.round((thisWeekScore / thisWeekTotal) * 100) : null,
  };
}
