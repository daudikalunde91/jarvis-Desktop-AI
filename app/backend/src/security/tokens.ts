import { InjectionToken } from '@backend/shared/types/Token';
import type { IPermissionManager } from '@backend/security/interfaces/IPermissionManager';

export const SECURITY_TOKENS = {
  PermissionManager: new InjectionToken<IPermissionManager>('PermissionManager'),
} as const;
