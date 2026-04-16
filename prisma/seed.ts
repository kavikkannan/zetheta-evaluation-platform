import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Cleaning up database...");
  try {
    process.stdout.write("  - Deleting scores... ");
    await prisma.score.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting responses... ");
    await prisma.response.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting submissions... ");
    await prisma.submission.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting applications... ");
    await prisma.application.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting questions... ");
    await prisma.mcqQuestion.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting assessment sessions... ");
    await prisma.assessmentSession.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting candidates... ");
    await prisma.candidate.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting role permissions... ");
    await prisma.rolePermission.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting permissions... ");
    await prisma.permission.deleteMany();
    console.log("OK");

    process.stdout.write("  - Deleting roles... ");
    await prisma.role.deleteMany();
    console.log("OK");
  } catch (err) {
    console.error("\nFailed during cleanup phase:");
    throw err;
  }

  const [candidateRole, employerRole, adminRole] = await Promise.all([
    prisma.role.create({ data: { name: "candidate" } }),
    prisma.role.create({ data: { name: "employer" } }),
    prisma.role.create({ data: { name: "admin" } }),
  ]);

  const [readAssessment, createSubmission, readDashboard, readScores, manageRoles] =
    await Promise.all([
      prisma.permission.create({ data: { name: "read:assessment" } }),
      prisma.permission.create({ data: { name: "create:submission" } }),
      prisma.permission.create({ data: { name: "read:dashboard" } }),
      prisma.permission.create({ data: { name: "read:scores" } }),
      prisma.permission.create({ data: { name: "manage:roles" } }),
    ]);

  await prisma.rolePermission.createMany({
    data: [
      { roleId: candidateRole.id, permissionId: readAssessment.id },
      { roleId: candidateRole.id, permissionId: createSubmission.id },
      { roleId: employerRole.id, permissionId: readDashboard.id },
      { roleId: employerRole.id, permissionId: readScores.id },
      { roleId: adminRole.id, permissionId: manageRoles.id },
      { roleId: adminRole.id, permissionId: readDashboard.id },
      { roleId: adminRole.id, permissionId: readScores.id },
    ],
  });

  const assessmentSession = await prisma.assessmentSession.create({
    data: {
      title: "Foundations Assessment",
      description: "Core CS and backend fundamentals",
      timeLimitMinutes: 30,
    },
  });

  await prisma.mcqQuestion.createMany({
    data: [
      {
        assessmentSessionId: assessmentSession.id,
        sequence: 1,
        questionText: "What is the time complexity of binary search?",
        options: [
          { label: "A", text: "O(n)" },
          { label: "B", text: "O(log n)" },
          { label: "C", text: "O(n log n)" },
          { label: "D", text: "O(1)" },
        ],
        correctAnswer: "B",
      },
      {
        assessmentSessionId: assessmentSession.id,
        sequence: 2,
        questionText: "Which HTTP status code means Accepted?",
        options: [
          { label: "A", text: "200" },
          { label: "B", text: "201" },
          { label: "C", text: "202" },
          { label: "D", text: "204" },
        ],
        correctAnswer: "C",
      },
      {
        assessmentSessionId: assessmentSession.id,
        sequence: 3,
        questionText: "Which data structure is FIFO?",
        options: [
          { label: "A", text: "Stack" },
          { label: "B", text: "Queue" },
          { label: "C", text: "Heap" },
          { label: "D", text: "Tree" },
        ],
        correctAnswer: "B",
      },
      {
        assessmentSessionId: assessmentSession.id,
        sequence: 4,
        questionText: "Which SQL command is used to add rows?",
        options: [
          { label: "A", text: "SELECT" },
          { label: "B", text: "UPDATE" },
          { label: "C", text: "INSERT" },
          { label: "D", text: "ALTER" },
        ],
        correctAnswer: "C",
      },
      {
        assessmentSessionId: assessmentSession.id,
        sequence: 5,
        questionText: "What does ACID stand for in databases?",
        options: [
          { label: "A", text: "Atomicity, Consistency, Isolation, Durability" },
          { label: "B", text: "Availability, Consistency, Integrity, Durability" },
          { label: "C", text: "Atomicity, Concurrency, Isolation, Distribution" },
          { label: "D", text: "Access, Consistency, Isolation, Dependency" },
        ],
        correctAnswer: "A",
      },
    ],
  });

  const passwordHash = await bcrypt.hash("password123", 12);

  console.log("Creating candidates...");
  const c1 = await prisma.candidate.create({
    data: {
      email: "candidate1@example.com",
      passwordHash,
      name: "Candidate One",
      roleId: candidateRole.id,
    },
  });

  const c2 = await prisma.candidate.create({
    data: {
      email: "candidate2@example.com",
      passwordHash,
      name: "Candidate Two",
      roleId: candidateRole.id,
    },
  });

  const c3 = await prisma.candidate.create({
    data: {
      email: "candidate3@example.com",
      passwordHash,
      name: "Candidate Three",
      roleId: candidateRole.id,
    },
  });

  const c4 = await prisma.candidate.create({
    data: {
      email: "candidate4@example.com",
      passwordHash,
      name: "Candidate Four",
      roleId: candidateRole.id,
    },
  });

  const c5 = await prisma.candidate.create({
    data: {
      email: "candidate5@example.com",
      passwordHash,
      name: "Candidate Five",
      roleId: candidateRole.id,
    },
  });

  console.log("Creating employer admin...");
  await prisma.role.update({
    where: { id: employerRole.id },
    data: {
      candidates: {
        create: {
          email: "employer@example.com",
          passwordHash,
          name: "Employer Admin",
        },
      },
    },
  });

  // Create applications so candidates have something to see
  await prisma.application.createMany({
    data: [
      { candidateId: c1.id, status: "applied" },
      { candidateId: c2.id, status: "attempted" },
      { candidateId: c3.id, status: "applied" },
      { candidateId: c4.id, status: "applied" },
      { candidateId: c5.id, status: "applied" },
    ],
  });

  console.log("Seed completed successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

