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

  it('filters protected permissions and roles from governance-derived access summaries while retaining direct-role permissions', async () => {
    prisma.user = {
      findFirst: jest.fn().mockResolvedValue({
        id: 'user-id',
        firstName: 'Test',
        lastName: 'Member',
        email: 'member@example.test',
        member: {
          id: 'member-id',
          memberNumber: 'KUH-001',
          registrationNumber: 'REG-001',
          positionAssignments: [
            {
              id: 'assignment-id',
              status: 'ACTIVE',
              startsAt: new Date('2026-01-01T00:00:00.000Z'),
              endsAt: new Date('2027-01-01T00:00:00.000Z'),
              assignedAt: new Date('2026-01-01T00:00:00.000Z'),
              endedAt: null,
              revokedAt: null,
              notes: null,
              position: { id: 'position-id', code: 'TREASURER', name: 'Treasurer', description: null, status: 'ACTIVE', isExecutive: true },
              term: { id: 'term-id', code: 'TERM-1', name: 'Term 1', status: 'ACTIVE', startsAt: new Date('2026-01-01T00:00:00.000Z'), endsAt: new Date('2027-01-01T00:00:00.000Z') },
              roles: [
                {
                  role: {
                    id: 'custom-role-id',
                    code: 'CUSTOM_EXECUTIVE',
                    name: 'Custom Executive',
                    description: null,
                    rolePermissions: [
                      { permission: { code: 'finance.payments.view' } },
                      { permission: { code: 'users.roles.assign' } },
                      { permission: { code: 'system.settings.manage' } },
                      { permission: { code: 'governance.assignments.revoke' } },
                    ],
                  },
                },
                {
                  role: {
                    id: 'admin-role-id',
                    code: 'ADMINISTRATOR',
                    name: 'Administrator',
                    description: null,
                    rolePermissions: [
                      { permission: { code: 'users.roles.assign' } },
                    ],
                  },
                },
              ],
            },
          ],
        },
        userRoles: [
          {
            id: 'direct-admin-assignment',
            startsAt: new Date('2026-01-01T00:00:00.000Z'),
            endsAt: null,
            role: {
              id: 'direct-admin-role-id',
              code: 'ADMINISTRATOR',
              name: 'Administrator',
              rolePermissions: [
                { permission: { code: 'users.roles.assign' } },
              ],
            },
          },
        ],
      }),
    };

    const result = await service.findMyGovernance('user-id', 'org-id');

    expect(result.access.roles.map((role) => role.code)).toEqual([
      'ADMINISTRATOR',
      'CUSTOM_EXECUTIVE',
    ]);
    expect(result.access.permissions).toEqual([
      'finance.payments.view',
      'users.roles.assign',
    ]);
  });

  it('rejects role IDs outside the organization', async () => {
    prisma.role.findMany.mockResolvedValue([]);

    await expect(
      (service as any).validatePositionAssignmentRoles('org-id', ['foreign-id']),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
