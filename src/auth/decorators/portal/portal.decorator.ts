import { SetMetadata } from '@nestjs/common';

export const PORTAL_KEY = 'portal';

export type PortalType = 'member' | 'executive' | 'administration';

export const Portal = (portal: PortalType) => SetMetadata(PORTAL_KEY, portal);
