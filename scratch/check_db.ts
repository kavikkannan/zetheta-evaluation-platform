import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function run() {
  const email = "employer@example.com";
  const user = await prisma.candidate.findUnique({ where: { email } });
  
  if (!user) {
    console.log("❌ USER NOT FOUND:", email);
    return;
  }
  
  console.log("✅ USER FOUND:", user.email);
  console.log("HASH IN DB:", user.passwordHash);
  
  const match = await bcrypt.compare("password123", user.passwordHash);
  console.log("PASSWORD MATCH ('password123'):", match);
}

run()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
