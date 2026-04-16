const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function run() {
  const hash = await bcrypt.hash("password123", 10);
  const result = await prisma.candidate.updateMany({
    data: { passwordHash: hash }
  });
  console.log(`✅ Reset ${result.count} passwords to 'password123'`);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
