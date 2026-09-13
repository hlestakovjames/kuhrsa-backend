import { allSeedPermissions } from "./permissions";
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

const permissions = allSeedPermissions.map((item) => [item.code, item.description] as const);

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

  /*
   * Administrators receive broad operational access across the KUHRSA
   * management platform.
   *
   * Super Administrator remains the only role that receives every
   * permission, including protected system administration capabilities.
   */
  const administratorPermissions = [
    // Membership
    'membership.members.view',
    'membership.members.create',
    'membership.members.update',
    'membership.pending.view',
    'membership.pending.review',
    'membership.pending.approve',
    'membership.activation.view',
    'membership.activation.process',
    'membership.renewal.view',
    'membership.renewal.process',
    'membership.migration.view',
    'membership.migration.import',
    'membership.migration.review',
    'membership.cards.view',
    'membership.cards.issue',
    'membership.verification.view',
    'membership.verification.verify',
    'membership.documents.view',
    'membership.documents.manage',
    'membership.requests.view',
    'membership.requests.manage',
    'membership.history.view',

    // Governance
    'governance.positions.view',
    'governance.positions.manage',
    'governance.terms.view',
    'governance.terms.manage',
    'governance.office_bearers.view',
    'governance.office_bearers.manage',
    'governance.executive.view',
    'governance.committees.view',
    'governance.committees.manage',
    'governance.meetings.view',
    'governance.meetings.create',
    'governance.meetings.update',
    'governance.meetings.cancel',
    'governance.agendas.view',
    'governance.agendas.manage',
    'governance.attendance.view',
    'governance.attendance.manage',
    'governance.minutes.view',
    'governance.minutes.manage',
    'governance.resolutions.view',
    'governance.resolutions.manage',
    'governance.actions.view',
    'governance.actions.manage',
    'governance.records.view',
    'governance.assignments.view',
    'governance.assignments.create',
    'governance.assignments.update',
    'governance.assignments.activate',
    'governance.assignments.end',
    'governance.assignments.revoke',

    // Secretariat
    'secretariat.correspondence.view',
    'secretariat.correspondence.manage',
    'secretariat.incoming.view',
    'secretariat.incoming.manage',
    'secretariat.outgoing.view',
    'secretariat.outgoing.manage',
    'secretariat.letters.view',
    'secretariat.letters.create',
    'secretariat.letters.update',
    'secretariat.letters.issue',
    'secretariat.notices.view',
    'secretariat.notices.manage',
    'secretariat.requests.view',
    'secretariat.requests.manage',
    'secretariat.documents.view',
    'secretariat.documents.manage',
    'secretariat.reports.view',

    // Events
    'events.events.view',
    'events.events.create',
    'events.events.update',
    'events.events.delete',
    'events.registration.view',
    'events.registration.manage',
    'events.participants.view',
    'events.participants.manage',
    'events.attendance.view',
    'events.attendance.manage',
    'events.qr_checkin.view',
    'events.qr_checkin.scan',
    'events.venues.view',
    'events.venues.manage',
    'events.logistics.view',
    'events.logistics.manage',
    'events.tasks.view',
    'events.tasks.manage',
    'events.documents.view',
    'events.documents.manage',
    'events.reports.view',

    // Activities
    'activities.activities.view',
    'activities.activities.create',
    'activities.activities.update',
    'activities.activities.delete',
    'activities.registration.view',
    'activities.registration.manage',

    // Finance
    'finance.fees.view',
    'finance.fees.manage',
    'finance.payments.view',
    'finance.payments.manage',
    'finance.history.view',
    'finance.mpesa.view',
    'finance.mpesa.manage',
    'finance.reconciliation.view',
    'finance.reconciliation.reconcile',
    'finance.receipts.view',
    'finance.receipts.issue',
    'finance.receipts.manage',
    'finance.refunds.view',
    'finance.refunds.review',
    'finance.refunds.approve',
    'finance.refunds.process',
    'finance.expenses.view',
    'finance.expenses.create',
    'finance.expenses.update',
    'finance.expenses.approve',
    'finance.budgets.view',
    'finance.budgets.manage',
    'finance.ledger.view',
    'finance.reports.view',

    // Elections
    'elections.elections.view',
    'elections.elections.create',
    'elections.elections.update',
    'elections.elections.manage',
    'elections.positions.view',
    'elections.positions.manage',
    'elections.candidates.view',
    'elections.candidates.review',
    'elections.candidates.approve',
    'elections.eligibility.view',
    'elections.eligibility.manage',
    'elections.voters.view',
    'elections.voters.manage',
    'elections.voting.view',
    'elections.voting.manage',
    'elections.results.view',
    'elections.results.finalize',
    'elections.reports.view',
    'elections.audit.view',

    // Content
    'content.pages.view',
    'content.pages.manage',
    'content.publishing.view',
    'content.publishing.review',
    'content.publishing.schedule',
    'content.publishing.publish',
    'content.publishing.unpublish',
    'content.news.view',
    'content.news.create',
    'content.news.update',
    'content.news.delete',
    'content.announcements.view',
    'content.announcements.create',
    'content.announcements.update',
    'content.announcements.publish',
    'content.articles.view',
    'content.articles.manage',
    'content.activities.view',
    'content.activities.manage',
    'content.events.view',
    'content.events.manage',
    'content.media.view',
    'content.media.manage',
    'content.gallery.view',
    'content.gallery.manage',
    'content.banners.view',
    'content.banners.manage',
    'content.social.view',
    'content.social.manage',
    'content.homepage.view',
    'content.homepage.manage',

    // Communication
    'communication.notifications.view',
    'communication.notifications.manage',
    'communication.messages.view',
    'communication.messages.manage',
    'communication.member_communications.view',
    'communication.member_communications.manage',
    'communication.email.view',
    'communication.email.send',
    'communication.sms.view',
    'communication.sms.send',
    'communication.templates.view',
    'communication.templates.manage',
    'communication.campaigns.view',
    'communication.campaigns.manage',
    'communication.campaigns.send',
    'communication.history.view',

    // Resources
    'resources.documents.view',
    'resources.documents.manage',
    'resources.downloads.view',
    'resources.certificates.view',
    'resources.certificates.issue',
    'resources.certificates.manage',
    'resources.certificate_verification.view',
    'resources.certificate_verification.verify',
    'resources.member_documents.view',
    'resources.member_documents.review',
    'resources.member_documents.manage',
    'resources.templates.view',
    'resources.templates.manage',
    'resources.categories.view',
    'resources.categories.manage',

    // Reports
    'reports.membership.view',
    'reports.membership.generate',
    'reports.finance.view',
    'reports.finance.generate',
    'reports.payments.view',
    'reports.payments.generate',
    'reports.events.view',
    'reports.events.generate',
    'reports.activities.view',
    'reports.activities.generate',
    'reports.elections.view',
    'reports.elections.generate',
    'reports.communication.view',
    'reports.communication.generate',
    'reports.analytics.view',
    'reports.custom.view',
    'reports.custom.create',
    'reports.custom.generate',

    // User & Access
    'users.users.view',
    'users.users.create',
    'users.users.update',
    'users.users.suspend',
    'users.users.restore',
    'users.roles.view',
    'users.roles.create',
    'users.roles.update',
    'users.roles.delete',
    'users.roles.assign',
    'users.permissions.view',
    'users.permissions.manage',
    'users.access_rules.view',
    'users.access_rules.manage',
    'users.delegation.view',
    'users.delegation.create',
    'users.delegation.revoke',
    'users.access_reviews.view',
    'users.access_reviews.review',
    'users.access_reviews.approve',
    'users.access_logs.view',

    // ICT
    'ict.website.view',
    'ict.website.manage',
    'ict.support.view',
    'ict.support.manage',
    'ict.support.resolve',
    'ict.scanning.view',
    'ict.scanning.manage',
    'ict.scanning.scan',
    'ict.qr.view',
    'ict.qr.manage',
    'ict.qr_verification.view',
    'ict.qr_verification.verify',
    'ict.integrations.view',
    'ict.integrations.manage',
    'ict.health.view',
    'ict.backups.view',
    'ict.backups.manage',
    'ict.logs.view',

    // System — ordinary administrators do not receive
    // Super Administrator management capabilities.
    'system.configuration.view',
    'system.configuration.manage',
    'system.security.view',
    'system.security.manage',
    'system.database.view',
    'system.database.manage',
    'system.maintenance.view',
    'system.maintenance.manage',
    'system.audit.view',
    'system.settings.view',
    'system.settings.manage',
    'system.health.view',
  ];

  for (const code of administratorPermissions) {
    const permission = permissionRecords.get(code);

    if (!permission) {
      throw new Error(
        `Administrator seed permission not found: ${code}`,
      );
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

  console.log(
    `Administrator permissions assigned: ${administratorPermissions.length}`,
  );

  // 6b. Executive baseline permissions
  //
  // Executive access is intentionally limited to common organizational
  // capabilities. Position-specific management authority will be assigned
  // through PositionAssignmentRole as executive offices are configured.
  const executive = roleRecords.get('EXECUTIVE');

  if (!executive) {
    throw new Error('Executive role was not created.');
  }

  const executivePermissions = [
    'membership.members.view',
    'membership.verification.view',
    'membership.history.view',

    'governance.executive.view',
    'governance.office_bearers.view',
    'governance.positions.view',
    'governance.terms.view',
    'governance.committees.view',
    'governance.meetings.view',
    'governance.agendas.view',
    'governance.attendance.view',
    'governance.minutes.view',
    'governance.resolutions.view',
    'governance.actions.view',
    'governance.records.view',
    'governance.assignments.view',

    'events.events.view',
    'events.registration.view',
    'events.participants.view',
    'events.attendance.view',
    'events.qr_checkin.view',
    'events.venues.view',
    'events.logistics.view',
    'events.tasks.view',
    'events.documents.view',
    'events.reports.view',

    'activities.activities.view',
    'activities.registration.view',

    'communication.notifications.view',
    'communication.messages.view',
    'communication.member_communications.view',
    'communication.history.view',

    'content.pages.view',
    'content.news.view',
    'content.announcements.view',
    'content.articles.view',
    'content.activities.view',
    'content.events.view',
    'content.media.view',
    'content.gallery.view',

    'resources.documents.view',
    'resources.downloads.view',
    'resources.certificates.view',
    'resources.certificate_verification.view',
    'resources.member_documents.view',
    'resources.templates.view',
    'resources.categories.view',

    'reports.membership.view',
    'reports.finance.view',
    'reports.payments.view',
    'reports.events.view',
    'reports.activities.view',
    'reports.elections.view',
    'reports.communication.view',
    'reports.analytics.view',
  ];

  for (const code of executivePermissions) {
    const permission = permissionRecords.get(code);

    if (!permission) {
      throw new Error(
        `Executive seed permission not found: ${code}`,
      );
    }

    await prisma.rolePermission.upsert({
      where: {
        roleId_permissionId: {
          roleId: executive.id,
          permissionId: permission.id,
        },
      },
      update: {},
      create: {
        roleId: executive.id,
        permissionId: permission.id,
      },
    });
  }

  console.log(
    `Executive baseline permissions assigned: ${executivePermissions.length}`,
  );

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
