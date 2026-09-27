const cache = new Map<string, number[]>();

function mulberry32(seed: number) {
  let s = seed;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedOf(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function optionOrder(id: string, count: number): number[] {
  const key = `${id}#${count}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const order = Array.from({ length: count }, (_, i) => i);
  const rand = mulberry32(seedOf(id));
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = order[i];
    order[i] = order[j];
    order[j] = t;
  }
  cache.set(key, order);
  return order;
}
