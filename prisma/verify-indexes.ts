import { PrismaClient } from "@zetheta/database-client";

type PlanJson = {
  Plan?: {
    Node Type?: string;
    Plans?: PlanJson["Plan"][];
  };
};

const prisma = new PrismaClient();

function planUsesIndex(node: PlanJson["Plan"] | undefined): boolean {
  if (!node) {
    return false;
  }

  const nodeType = node["Node Type"] ?? "";
  if (nodeType.includes("Index")) {
    return true;
  }

  return (node.Plans ?? []).some((child) => planUsesIndex(child));
}

async function main(): Promise<void> {
  const candidateRole = await prisma.role.findFirstOrThrow({
    where: { name: "candidate" },
  });

  const question = await prisma.mcqQuestion.findFirstOrThrow({
    orderBy: { sequence: "asc" },
  });

  const candidate = await prisma.candidate.create({
    data: {
      email: `integration-${Date.now()}@example.com`,
      passwordHash: "integration-password-hash",
      name: "Integration Candidate",
      roleId: candidateRole.id,
    },
  });

  const application = await prisma.application.create({
    data: {
      candidateId: candidate.id,
      status: "attempted",
      startedAt: new Date(),
    },
  });

  const submission = await prisma.submission.create({
    data: {
      applicationId: application.id,
      responses: {
        create: [
          {
            questionId: question.id,
            answer: "A",
          },
        ],
      },
    },
    include: { responses: true },
  });

  const responsesPlanRows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
    `EXPLAIN (FORMAT JSON) SELECT * FROM responses WHERE submission_id = '${submission.id}'`,
  );

  const applicationsPlanRows = await prisma.$queryRawUnsafe<Array<{ "QUERY PLAN": unknown }>>(
    `EXPLAIN (FORMAT JSON) SELECT * FROM applications WHERE candidate_id = '${candidate.id}'`,
  );

  const responsesPlan = responsesPlanRows[0]?.["QUERY PLAN"] as PlanJson[];
  const applicationsPlan = applicationsPlanRows[0]?.["QUERY PLAN"] as PlanJson[];

  const responsesUseIndex = planUsesIndex(responsesPlan?.[0]?.Plan);
  const applicationsUseIndex = planUsesIndex(applicationsPlan?.[0]?.Plan);

  if (!responsesUseIndex || !applicationsUseIndex) {
    throw new Error(
      `Index verification failed. responsesUseIndex=${responsesUseIndex}, applicationsUseIndex=${applicationsUseIndex}`,
    );
  }

  console.log("Index verification passed.");
  console.log(`responses.submission_id uses index: ${responsesUseIndex}`);
  console.log(`applications.candidate_id uses index: ${applicationsUseIndex}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

