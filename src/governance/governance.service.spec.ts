import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GovernanceService } from './governance.service';

describe('GovernanceService role assignment safeguards', () => {
  let service: GovernanceService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      role: {
        findMany: jest.fn(),
      },
    };
    service = new GovernanceService(prisma);
  });

  it('rejects direct attachment of administrative roles', async () => {
    prisma.role.findMany.mockResolvedValue([
      { id: 'admin-id', code: 'ADMINISTRATOR', rolePermissions: [] },
    ]);

    await expect(
      (service as any).validatePositionAssignmentRoles('org-id', ['admin-id']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects custom roles carrying user or system administration permissions', async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'custom-id',
        code: 'EXECUTIVE_FINANCE',
        rolePermissions: [
          { permission: { code: 'finance.payments.view' } },
          { permission: { code: 'users.roles.assign' } },
        ],
      },
    ]);

    await expect(
      (service as any).validatePositionAssignmentRoles('org-id', ['custom-id']),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('allows non-privileged executive roles', async () => {
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'executive-id',
        code: 'EXECUTIVE',
        rolePermissions: [
          { permission: { code: 'governance.executive.view' } },
          { permission: { code: 'finance.payments.view' } },
        ],
      },
    ]);

    await expect(
      (service as any).validatePositionAssignmentRoles('org-id', ['executive-id']),
    ).resolves.toBeUndefined();
  });

  it('rejects role IDs outside the organization', async () => {
    prisma.role.findMany.mockResolvedValue([]);

    await expect(
      (service as any).validatePositionAssignmentRoles('org-id', ['foreign-id']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
