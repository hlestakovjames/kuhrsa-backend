import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be defined in .env');
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

const permissions = [
  ['system.manage', 'Manage system configuration'],
  ['users.view', 'View users'],
  ['users.create', 'Create users'],
  ['users.update', 'Update users'],
  ['users.delete', 'Delete users'],
  ['roles.view', 'View roles'],
  ['roles.manage', 'Manage roles and role assignments'],
  ['governance.positions.view', 'View governance positions'],
  ['governance.positions.manage', 'Create and manage governance positions'],
  ['governance.terms.view', 'View leadership terms'],
  ['governance.terms.manage', 'Create and manage leadership terms'],
  ['governance.assignments.view', 'View position assignments'],
  ['governance.assignments.manage', 'Create and manage position assignments'],
  ['members.view', 'View members'],
  ['members.manage', 'Manage membership records'],
  ['members.approve', 'Approve membership applications'],
  ['academic.view', 'View academic information'],
  ['academic.manage', 'Manage academic information'],
  ['finance.view', 'View financial information'],
  ['finance.manage', 'Manage financial information'],
  ['announcements.view', 'View announcements'],
  ['announcements.manage', 'Create and manage announcements'],
  ['notifications.manage', 'Manage notifications'],
  ['meetings.manage', 'Manage meetings'],
  ['migration.manage', 'Manage bulk migration and user creation'],
  ['audit.view', 'View system audit logs'],
] as const;

const roles = [
  {
    code: 'SUPER_ADMINISTRATOR',
    name: 'Super Administrator',
    description:
      'Highest administrative role below protected system ownership.',
  },
  {
    code: 'ADMINISTRATOR',
    name: 'Administrator',
    description: 'General system administration role.',
  },
  {
    code: 'EXECUTIVE',
    name: 'Executive',
    description: 'Executive-level organizational role.',
  },
  {
    code: 'MEMBER',
    name: 'Member',
    description: 'Standard KUHRSA member account.',
  },
];

const memberCategories = [
  'STUDENT',
  'ALUMNI',
  'LECTURER',
] as const;

const governancePositions = [
  {
    code: 'CHAIRPERSON',
    name: 'Chairperson',
    description: 'Head of the KUHRSA executive leadership.',
  },
  {
    code: 'VICE_CHAIRPERSON',
    name: 'Vice Chairperson',
    description: 'Deputy to the Chairperson and supports executive leadership.',
  },
  {
    code: 'SECRETARY_GENERAL',
    name: 'Secretary General',
    description: 'Leads official administration, records, and executive correspondence.',
  },
  {
    code: 'DEPUTY_SECRETARY_GENERAL',
    name: 'Deputy Secretary General',
    description: 'Supports the Secretary General in administrative responsibilities.',
  },
  {
    code: 'TREASURER',
    name: 'Treasurer',
    description: 'Leads KUHRSA financial administration and financial reporting.',
  },
  {
    code: 'DEPUTY_TREASURER',
    name: 'Deputy Treasurer',
    description: 'Supports the Treasurer in financial administration.',
  },
  {
    code: 'PUBLICITY_SECRETARY',
    name: 'Publicity Secretary',
    description: 'Leads KUHRSA publicity, communication, and public information.',
  },
  {
    code: 'DEPUTY_PUBLICITY_SECRETARY',
    name: 'Deputy Publicity Secretary',
    description: 'Supports the Publicity Secretary in communication and publicity.',
  },
  {
    code: 'ORGANIZING_SECRETARY',
    name: 'Organizing Secretary',
    description: 'Coordinates KUHRSA events, programs, and organizational activities.',
  },
  {
    code: 'DEPUTY_ORGANIZING_SECRETARY',
    name: 'Deputy Organizing Secretary',
    description: 'Supports the Organizing Secretary in coordination of activities.',
  },
  {
    code: 'LEGAL_AFFAIRS_OFFICER',
    name: 'Legal Affairs Officer',
    description: 'Oversees KUHRSA legal affairs and provides organizational legal guidance.',
  },
  {
    code: 'LEGAL_REPRESENTATIVE_YEAR_1',
    name: 'Legal Representative – Year 1',
    description: 'Represents Year 1 members in KUHRSA legal and representative matters.',
  },
  {
    code: 'LEGAL_REPRESENTATIVE_YEAR_2',
    name: 'Legal Representative – Year 2',
    description: 'Represents Year 2 members in KUHRSA legal and representative matters.',
  },
  {
    code: 'LEGAL_REPRESENTATIVE_YEAR_3',
    name: 'Legal Representative – Year 3',
    description: 'Represents Year 3 members in KUHRSA legal and representative matters.',
  },
  {
    code: 'LEGAL_REPRESENTATIVE_YEAR_4',
    name: 'Legal Representative – Year 4',
    description: 'Represents Year 4 members in KUHRSA legal and representative matters.',
  },
  {
    code: 'ICT_MANAGER',
    name: 'ICT Manager',
    description: 'Leads KUHRSA information technology, digital systems, and technical operations.',
  },
] as const;

async function main() {
  console.log('Starting KUHRSA database bootstrap...');

  const ownerEmail = process.env.SYSTEM_OWNER_EMAIL;
  const ownerPassword = process.env.SYSTEM_OWNER_PASSWORD;

  if (!ownerEmail || !ownerPassword) {
    throw new Error(
      'SYSTEM_OWNER_EMAIL and SYSTEM_OWNER_PASSWORD must be defined in .env',
    );
  }

  // 1. Organization
  const organization = await prisma.organization.upsert({
    where: {
      code: 'KUHRSA',
    },
    update: {
      name: 'KUHRSA',
    },
    create: {
      name: 'KUHRSA',
      code: 'KUHRSA',
    },
  });

  console.log(`Organization ready: ${organization.name}`);

  // 2. Member number sequences
  for (const category of memberCategories) {
    await prisma.memberNumberSequence.upsert({
      where: {
        category,
      },
      update: {},
      create: {
        category,
        currentNumber: 0,
      },
    });
  }

  console.log('Member number sequences ready.');

  // 3. Permissions
  const permissionRecords = new Map<
    string,
    { id: string; code: string }
  >();

  for (const [code, description] of permissions) {
    const permission = await prisma.permission.upsert({
      where: {
        code,
      },
      update: {
        description,
      },
      create: {
        code,
        name: code
          .split('.')
          .map(
            (part) => part.charAt(0).toUpperCase() + part.slice(1),
          )
          .join(' '),
        description,
      },
    });

    permissionRecords.set(code, permission);
  }

  console.log(`Permissions ready: ${permissionRecords.size}`);

  // 4. System Roles
  const roleRecords = new Map<
    string,
    { id: string; code: string }
  >();

  for (const roleData of roles) {
    const role = await prisma.role.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: roleData.code,
        },
      },
      update: {
        name: roleData.name,
        description: roleData.description,
        isSystemRole: true,
      },
      create: {
        organizationId: organization.id,
        code: roleData.code,
        name: roleData.name,
        description: roleData.description,
        isSystemRole: true,
      },
    });

    roleRecords.set(roleData.code, role);
  }

  console.log(`System roles ready: ${roleRecords.size}`);

  // 5. Super Administrator gets all permissions
  const superAdmin = roleRecords.get('SUPER_ADMINISTRATOR');

  if (!superAdmin) {
    throw new Error('Super Administrator role was not created.');
  }

  for (const permission of permissionRecords.values()) {
    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: superAdmin.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: superAdmin.id,
        permissionId: permission.id,
      },
    });
  }

  console.log('Super Administrator permissions assigned.');

  // 6. Administrator permissions
  const administrator = roleRecords.get('ADMINISTRATOR');

  if (!administrator) {
    throw new Error('Administrator role was not created.');
  }

  const administratorPermissions = [
    'users.view',
    'users.create',
    'users.update',
    'roles.view',
    'governance.positions.view',
    'governance.positions.manage',
    'governance.terms.view',
    'governance.terms.manage',
    'governance.assignments.view',
    'governance.assignments.manage',
    'members.view',
    'members.manage',
    'members.approve',
    'academic.view',
    'academic.manage',
    'finance.view',
    'finance.manage',
    'announcements.view',
    'announcements.manage',
    'notifications.manage',
    'meetings.manage',
    'migration.manage',
    'audit.view',
  ];

  for (const code of administratorPermissions) {
    const permission = permissionRecords.get(code);

    if (!permission) {
      continue;
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: administrator.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: administrator.id,
        permissionId: permission.id,
      },
    });
  }

  console.log('Administrator permissions assigned.');

  // 7. Official KUHRSA governance positions
  for (const positionData of governancePositions) {
    await prisma.position.upsert({
      where: {
        organizationId_code: {
          organizationId: organization.id,
          code: positionData.code,
        },
      },
      update: {
        name: positionData.name,
        description: positionData.description,
        isExecutive: true,
      },
      create: {
        organizationId: organization.id,
        name: positionData.name,
        code: positionData.code,
        description: positionData.description,
        status: 'ACTIVE',
        isExecutive: true,
      },
    });
  }

  console.log(
    `Governance positions ready: ${governancePositions.length}`,
  );

  // 8. Create or update protected System Owner
  const passwordHash = await bcrypt.hash(ownerPassword, 12);

  const owner = await prisma.user.upsert({
    where: {
      email: ownerEmail.toLowerCase().trim(),
    },
    update: {
      organizationId: organization.id,
      isSystemOwner: true,
      status: 'ACTIVE',
      passwordHash,
    },
    create: {
      organizationId: organization.id,
      email: ownerEmail.toLowerCase().trim(),
      passwordHash,
      status: 'ACTIVE',
      isSystemOwner: true,
    },
  });

  console.log(`System Owner ready: ${owner.email}`);

  // 9. Assign Super Administrator role to System Owner
  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: owner.id,
        roleId: superAdmin.id,
      },
    },
    update: {},
    create: {
      userId: owner.id,
      roleId: superAdmin.id,
    },
  });

  console.log('System Owner Super Administrator role assigned.');

  console.log('KUHRSA database bootstrap completed successfully.');
}

main()
  .catch((error) => {
    console.error('KUHRSA bootstrap failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
