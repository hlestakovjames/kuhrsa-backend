import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';

describe('PermissionsGuard', () => {
  it('should be defined', () => {
    const guard = new PermissionsGuard(new Reflector());

    expect(guard).toBeDefined();
  });
});