import { PrismaClient } from "../packages/database-client/generated";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log("Seeding database (robust idempotent mode)...");

  // 1. Roles
  const roles = ["candidate", "employer", "admin"];
  const createdRoles: Record<string, any> = {};
  
  for (const roleName of roles) {
    createdRoles[roleName] = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }

  // 2. Permissions
  const permissions = ["read:assessment", "create:submission", "read:dashboard", "read:scores", "manage:roles"];
  const createdPerms: Record<string, any> = {};

  for (const permName of permissions) {
    createdPerms[permName] = await prisma.permission.upsert({
      where: { name: permName },
      update: {},
      create: { name: permName },
    });
  }

  // 3. Role Permissions
  const rolePermissionMap = [
    { role: "candidate", perms: ["read:assessment", "create:submission"] },
    { role: "employer", perms: ["read:dashboard", "read:scores"] },
    { role: "admin", perms: ["manage:roles", "read:dashboard", "read:scores"] },
  ];

  for (const mapping of rolePermissionMap) {
    const roleId = createdRoles[mapping.role].id;
    for (const permName of mapping.perms) {
      const permissionId = createdPerms[permName].id;
      const existing = await prisma.rolePermission.findUnique({
        where: {
          roleId_permissionId: { roleId, permissionId }
        },
      });
      if (!existing) {
        await prisma.rolePermission.create({
          data: { roleId, permissionId },
        });
      }
    }
  }

  // 4. Assessment Session
  let assessmentSession = await prisma.assessmentSession.findFirst({
    where: { title: "Foundations Assessment" },
  });

  if (!assessmentSession) {
    assessmentSession = await prisma.assessmentSession.create({
      data: {
        title: "Foundations Assessment",
        description: "Core CS and backend fundamentals",
        timeLimitMinutes: 30,
      },
    });
  } else {
    assessmentSession = await prisma.assessmentSession.update({
      where: { id: assessmentSession.id },
      data: {
        description: "Core CS and backend fundamentals",
        timeLimitMinutes: 30,
      },
    });
  }

  // 5. MCQ Questions
  const questionData = [
    {
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
  ];

  for (const q of questionData) {
    const existing = await prisma.mcqQuestion.findFirst({
      where: { assessmentSessionId: assessmentSession.id, sequence: q.sequence },
    });
    if (!existing) {
      await prisma.mcqQuestion.create({
        data: {
          assessmentSessionId: assessmentSession.id,
          ...q,
        },
      });
    } else {
      await prisma.mcqQuestion.update({
        where: { id: existing.id },
        data: q,
      });
    }
  }

  // 6. Candidates
  const passwordHash = await bcrypt.hash("password123", 12);
  const candidateEmails = [
    "candidate1@example.com",
    "candidate2@example.com",
    "candidate3@example.com",
    "candidate4@example.com",
    "candidate5@example.com",
  ];

  const candidateMap: Record<string, any> = {};

  for (let i = 0; i < candidateEmails.length; i++) {
    const email = candidateEmails[i];
    candidateMap[email] = await prisma.candidate.upsert({
      where: { email },
      update: {},
      create: {
        email,
        passwordHash,
        name: `Candidate ${i + 1}`,
        roleId: createdRoles["candidate"].id,
      },
    });
  }

  // 7. Employer Admin
  const employerEmail = "employer@example.com";
  await prisma.candidate.upsert({
    where: { email: employerEmail },
    update: {},
    create: {
      email: employerEmail,
      passwordHash,
      name: "Employer Admin",
      roleId: createdRoles["employer"].id,
    },
  });

  // 8. Applications
  const applications = [
    { email: "candidate1@example.com", status: "applied" },
    { email: "candidate2@example.com", status: "evaluated" },
    { email: "candidate3@example.com", status: "applied" },
    { email: "candidate4@example.com", status: "applied" },
    { email: "candidate5@example.com", status: "applied" },
  ];

  const createdApps: Record<string, any> = {};

  for (const app of applications) {
    const candidateId = candidateMap[app.email].id;
    const existing = await prisma.application.findFirst({
      where: { candidateId },
    });
    if (!existing) {
      createdApps[app.email] = await prisma.application.create({
        data: { candidateId, status: app.status as any },
      });
    } else {
      createdApps[app.email] = await prisma.application.update({
        where: { id: existing.id },
        data: { status: app.status as any },
      });
    }
  }

  // 9. Submission & Score for Candidate 2
  const c2Email = "candidate2@example.com";
  const app2Id = createdApps[c2Email].id;

  const existingSub = await prisma.submission.findFirst({
    where: { applicationId: app2Id },
  });

  if (!existingSub) {
    console.log("Adding submission for candidate 2...");
    const questions = await prisma.mcqQuestion.findMany({
      where: { assessmentSessionId: assessmentSession.id },
      orderBy: { sequence: "asc" },
    });

    const s2 = await prisma.submission.create({
      data: {
        applicationId: app2Id,
        submittedAt: new Date(),
      },
    });

    // Add responses
    await prisma.response.createMany({
      data: [
        { submissionId: s2.id, questionId: questions[0].id, answer: questions[0].correctAnswer },
        { submissionId: s2.id, questionId: questions[1].id, answer: questions[1].correctAnswer },
        { submissionId: s2.id, questionId: questions[2].id, answer: questions[2].correctAnswer },
        { submissionId: s2.id, questionId: questions[3].id, answer: questions[3].correctAnswer },
        { submissionId: s2.id, questionId: questions[4].id, answer: "B" }, // Wrong answer
      ],
    });

    await prisma.score.create({
      data: {
        submissionId: s2.id,
        score: 4,
        maxScore: 5,
        evaluatedAt: new Date(),
      },
    });
  }

  console.log("Seed completed successfully (robust idempotent mode).");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
