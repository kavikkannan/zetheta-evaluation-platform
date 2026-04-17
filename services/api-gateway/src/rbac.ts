import type { PrismaClient } from "@zetheta/database-client";

export async function roleHasPermission(params: {
  prisma: PrismaClient;
  roleName: string;
  permissionName: string;
}): Promise<boolean> {
  const { prisma, roleName, permissionName } = params;

  const mapping = await prisma.rolePermission.findFirst({
    where: {
      role: { name: roleName },
      permission: { name: permissionName },
    },
    select: { roleId: true },
  });

  return mapping !== null;
}

