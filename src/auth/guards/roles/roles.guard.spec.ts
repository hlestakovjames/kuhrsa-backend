import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';

describe('RolesGuard', () => {
  it('should be defined', () => {
    const guard = new RolesGuard(new Reflector());

    expect(guard).toBeDefined();
  });
});