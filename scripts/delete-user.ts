import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

function normalizePhone(raw: string) {
  let p = raw.replace(/[^\d+]/g, "");
  if (p.startsWith("8") && p.length === 8) p = "+976" + p;
  else if (p.startsWith("976") && !p.startsWith("+")) p = "+" + p;
  else if (!p.startsWith("+")) p = "+" + p.replace(/^0+/, "");
  return p;
}

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Usage: npx tsx scripts/delete-user.ts <phone>   e.g. +97699112233 or 99112233");
    process.exit(1);
  }
  const phone = normalizePhone(raw);
  let user = await prisma.user.findFirst({ where: { phone } });
  if (!user) {
    const email = `${phone.replace("+", "")}@phone.local`;
    user = await prisma.user.findUnique({ where: { email } });
  }
  if (!user) {
    console.error(`User not found for phone ${phone}`);
    process.exit(1);
  }
  const deleted = await prisma.user.delete({ where: { id: user.id } });
  console.log(`Deleted ${phone} (${deleted.email}, role ${deleted.role}) — all related data cascaded`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
