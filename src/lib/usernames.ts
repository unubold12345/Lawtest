import { prisma } from "./prisma";

/** Next sequential display name: user01, user02, ... (min 2 digits, grows naturally) */
export async function nextUserName(): Promise<string> {
  const users = await prisma.user.findMany({
    where: { name: { startsWith: "user" } },
    select: { name: true },
  });
  let max = 0;
  for (const u of users) {
    const m = u.name ? /^user(\d+)$/.exec(u.name.trim()) : null;
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  // loop-guard against collisions (e.g. parallel registrations)
  for (let n = max + 1; ; n++) {
    const name = `user${String(n).padStart(2, "0")}`;
    const taken = await prisma.user.findFirst({ where: { name } });
    if (!taken) return name;
  }
}

/** True if the stored name is a phone number (legacy) rather than a userNN display name */
export function isPhoneName(name: string | null | undefined): boolean {
  if (!name) return true;
  return /^[+\d]/.test(name.trim());
}
