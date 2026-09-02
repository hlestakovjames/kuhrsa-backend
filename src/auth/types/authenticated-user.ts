export interface AuthenticatedUserRolePermission {
  permission?: {
    code: string;
  } | null;
}

export interface AuthenticatedUserRole {
  role: {
    id: string;
    name: string;
    code: string;
    rolePermissions?: AuthenticatedUserRolePermission[];
  };
}

export interface AuthenticatedUserOrganization {
  id: string;
  name: string;
  code: string;
}

export interface AuthenticatedUserMember {
  id: string;
  registrationNumber?: string | null;
  memberNumber: string;
  status: string;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;
  email: string;
  status: string;
  isSystemOwner: boolean;
  lastLoginAt?: Date | null;

  organization?: AuthenticatedUserOrganization | null;

  member?: AuthenticatedUserMember | null;

  userRoles?: AuthenticatedUserRole[];
}
