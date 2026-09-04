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
  admissionNumber?: string | null;

  memberNumber: string;
  category: string;

  yearOfStudy?: number | null;
  graduationYear?: number | null;

  nationalId?: string | null;
  staffNumber?: string | null;
  position?: string | null;

  programme?: string | null;
  faculty?: string | null;
  department?: string | null;

  status: string;
  source: string;
  activationStatus: string;
}

export interface AuthenticatedUser {
  id: string;
  organizationId: string;

  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;

  email: string;
  status: string;

  isSystemOwner: boolean;
  lastLoginAt?: Date | null;

  organization?: AuthenticatedUserOrganization | null;
  member?: AuthenticatedUserMember | null;

  userRoles?: AuthenticatedUserRole[];
}
