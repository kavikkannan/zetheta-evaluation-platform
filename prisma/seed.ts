import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  await prisma.score.deleteMany();
  await prisma.response.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.application.deleteMany();
  await prisma.mcqQuestion.deleteMany();
  await prisma.assessmentSession.deleteMany();
  await prisma.candidate.deleteMany();
  await prisma.rolePermission.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

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

  await prisma.candidate.createMany({
    data: [
      {
        email: "candidate1@example.com",
        passwordHash: "$2a$12$GQx5nYQxU0QxQxQxQxQxQe6m8JfBqQh9N8k3mQxQxQxQxQxQxQxQ2",
        name: "Candidate One",
        roleId: candidateRole.id,
      },
      {
        email: "candidate2@example.com",
        passwordHash: "$2a$12$L5x5nYQxU0QxQxQxQxQxQe6m8JfBqQh9N8k3mQxQxQxQxQxQxQxQ3",
        name: "Candidate Two",
        roleId: candidateRole.id,
      },
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

