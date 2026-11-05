import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '../../../prisma/prisma.service';

import { FeeSchedulesService } from './fee-schedules.service';

describe('FeeSchedulesService', () => {
  let service: FeeSchedulesService;
  let feeScheduleFindMany: jest.Mock;

  beforeEach(async () => {
    feeScheduleFindMany = jest.fn().mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeeSchedulesService,
        {
          provide: PrismaService,
          useValue: {
            feeSchedule: {
              findMany: feeScheduleFindMany,
            },
          },
        },
      ],
    }).compile();

    service = module.get<FeeSchedulesService>(FeeSchedulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('lists schedules only for the requested fee definition and organization', async () => {
    await service.findAll('org-1', 'fee-definition-1');

    expect(feeScheduleFindMany).toHaveBeenCalledWith({
      where: {
        organizationId: 'org-1',
        feeDefinitionId: 'fee-definition-1',
      },
      orderBy: {
        effectiveFrom: 'desc',
      },
      include: {
        feeDefinition: true,
      },
    });
  });
});
