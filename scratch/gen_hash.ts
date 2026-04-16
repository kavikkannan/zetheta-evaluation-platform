import bcrypt from "bcryptjs";

async function run() {
  const hash = await bcrypt.hash("password123", 12);
  console.log("HASH:", hash);
  const match = await bcrypt.compare("password123", hash);
  console.log("MATCH:", match);
}

run().catch(console.error);
