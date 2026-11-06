import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { MemberDirectoryService } from './member-directory.service';

describe('MemberDirectoryService', () => {
  let service: MemberDirectoryService;
  const findMany = jest.fn();

  beforeEach(async () => {
    findMany.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberDirectoryService,
        {
          provide: PrismaService,
          useValue: {
            member: { findMany },
          },
        },
      ],
    }).compile();

    service = module.get<MemberDirectoryService>(MemberDirectoryService);
  });

  it('returns directory fields without sensitive member identifiers or contact details', async () => {
    const directoryRecords = [
      {
        id: 'member-1',
        memberNumber: 'KUHRSA-001',
        category: 'STUDENT',
        yearOfStudy: 2,
        programme: 'BSc ICT',
        faculty: 'Computing',
        department: 'ICT',
        position: null,
        email: 'member@example.com',
        status: 'ACTIVE',
        activationStatus: 'COMPLETED',
        user: {
          firstName: 'Test',
          middleName: null,
          lastName: 'Member',
          email: 'member@example.com',
          status: 'ACTIVE',
        },
      },
    ];

    findMany.mockResolvedValue(directoryRecords);

    const result = await service.findAll('organization-1');

    expect(result).toEqual(directoryRecords);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'organization-1' },
        select: expect.not.objectContaining({
          nationalId: expect.anything(),
          staffNumber: expect.anything(),
          phone: expect.anything(),
          address: expect.anything(),
          county: expect.anything(),
          registrationNumber: expect.anything(),
          admissionNumber: expect.anything(),
        }),
      }),
    );
  });
});
