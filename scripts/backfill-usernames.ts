import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, phone: true, email: true },
  });
  const used = new Set<string>();
  for (const u of users) {
    if (u.name && /^user\d+$/.test(u.name.trim())) used.add(u.name.trim());
  }
  let n = 1;
  const next = () => {
    for (;; n++) {
      const name = `user${String(n).padStart(2, "0")}`;
      if (!used.has(name)) {
        used.add(name);
        n++;
        return name;
      }
    }
  };
  let fixed = 0;
  for (const u of users) {
    const name = (u.name || "").trim();
    if (name && /^user\d+$/.test(name)) continue; // already good
    const display = next();
    await prisma.user.update({ where: { id: u.id }, data: { name: display } });
    console.log(`${u.phone || u.email}  ->  ${display}`);
    fixed++;
  }
  console.log(fixed === 0 ? "Nothing to backfill." : `Backfilled ${fixed} user(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
