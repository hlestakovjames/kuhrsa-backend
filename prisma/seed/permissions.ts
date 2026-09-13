export type PermissionDefinition = {
  code: string;
  name: string;
  description: string;
  module: string;
  feature: string;
  action: string;
};

const permission = (
  module: string,
  feature: string,
  action: string,
  description: string,
): PermissionDefinition => ({
  code: `${module}.${feature}.${action}`,
  name: `${module} ${feature} ${action}`
    .split('.')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' '),
  description,
  module,
  feature,
  action,
});

export const canonicalPermissions: PermissionDefinition[] = [
  // ============================================================
  // 01. MEMBERSHIP
  // ============================================================

  permission('membership', 'members', 'view', 'View membership records.'),
  permission('membership', 'members', 'create', 'Create membership records.'),
  permission('membership', 'members', 'update', 'Update membership records.'),

  permission('membership', 'students', 'view', 'View student membership records.'),
  permission('membership', 'alumni', 'view', 'View alumni membership records.'),
  permission('membership', 'lecturers', 'view', 'View lecturer membership records.'),
  permission('membership', 'active', 'view', 'View active members.'),
  permission('membership', 'pending', 'view', 'View pending membership applications.'),
  permission('membership', 'pending', 'review', 'Review pending membership applications.'),
  permission('membership', 'pending', 'approve', 'Approve membership applications.'),

  permission('membership', 'expired', 'view', 'View expired membership records.'),
  permission('membership', 'suspended', 'view', 'View suspended membership records.'),

  permission('membership', 'activation', 'view', 'View membership activation workflows.'),
  permission('membership', 'activation', 'process', 'Process eligible membership activation.'),

  permission('membership', 'renewal', 'view', 'View membership renewal workflows.'),
  permission('membership', 'renewal', 'process', 'Process membership renewals.'),

  permission('membership', 'migration', 'view', 'View membership migration records.'),
  permission('membership', 'migration', 'import', 'Import legacy membership records.'),
  permission('membership', 'migration', 'review', 'Review migrated membership records.'),

  permission('membership', 'cards', 'view', 'View membership card records.'),
  permission('membership', 'cards', 'issue', 'Issue membership cards.'),

  permission('membership', 'verification', 'view', 'View membership verification tools.'),
  permission('membership', 'verification', 'verify', 'Verify member identity and membership status.'),

  permission('membership', 'documents', 'view', 'View membership documents.'),
  permission('membership', 'documents', 'manage', 'Manage membership documents.'),

  permission('membership', 'requests', 'view', 'View member requests.'),
  permission('membership', 'requests', 'manage', 'Manage member requests.'),

  permission('membership', 'history', 'view', 'View membership history.'),

  // ============================================================
  // 02. GOVERNANCE & LEADERSHIP
  // ============================================================

  permission('governance', 'positions', 'view', 'View governance positions.'),
  permission('governance', 'positions', 'manage', 'Manage governance positions.'),

  permission('governance', 'terms', 'view', 'View leadership terms.'),
  permission('governance', 'terms', 'manage', 'Manage leadership terms.'),

  permission('governance', 'office_bearers', 'view', 'View appointed office bearers.'),
  permission('governance', 'office_bearers', 'manage', 'Manage office bearer records.'),

  permission('governance', 'executive', 'view', 'View the current executive leadership structure.'),

  permission('governance', 'committees', 'view', 'View governance committees.'),
  permission('governance', 'committees', 'manage', 'Manage governance committees.'),

  permission('governance', 'meetings', 'view', 'View governance meetings.'),
  permission('governance', 'meetings', 'create', 'Create governance meetings.'),
  permission('governance', 'meetings', 'update', 'Update governance meetings.'),
  permission('governance', 'meetings', 'cancel', 'Cancel governance meetings.'),

  permission('governance', 'agendas', 'view', 'View meeting agendas.'),
  permission('governance', 'agendas', 'manage', 'Manage meeting agendas.'),

  permission('governance', 'attendance', 'view', 'View governance meeting attendance.'),
  permission('governance', 'attendance', 'manage', 'Manage governance meeting attendance.'),

  permission('governance', 'minutes', 'view', 'View governance meeting minutes.'),
  permission('governance', 'minutes', 'manage', 'Manage governance meeting minutes.'),

  permission('governance', 'resolutions', 'view', 'View governance resolutions.'),
  permission('governance', 'resolutions', 'manage', 'Manage governance resolutions.'),

  permission('governance', 'actions', 'view', 'View governance action items.'),
  permission('governance', 'actions', 'manage', 'Manage governance action items.'),

  permission('governance', 'records', 'view', 'View governance records.'),

  permission('governance', 'assignments', 'view', 'View position assignments.'),
  permission('governance', 'assignments', 'create', 'Create position assignments.'),
  permission('governance', 'assignments', 'update', 'Update pending position assignments.'),
  permission('governance', 'assignments', 'activate', 'Activate position assignments.'),
  permission('governance', 'assignments', 'end', 'End active position assignments.'),
  permission('governance', 'assignments', 'revoke', 'Revoke position assignments.'),

  // ============================================================
  // 03. SECRETARIAT
  // ============================================================

  permission('secretariat', 'correspondence', 'view', 'View official correspondence.'),
  permission('secretariat', 'correspondence', 'manage', 'Manage official correspondence.'),

  permission('secretariat', 'incoming', 'view', 'View incoming correspondence.'),
  permission('secretariat', 'incoming', 'manage', 'Manage incoming correspondence.'),

  permission('secretariat', 'outgoing', 'view', 'View outgoing correspondence.'),
  permission('secretariat', 'outgoing', 'manage', 'Manage outgoing correspondence.'),

  permission('secretariat', 'letters', 'view', 'View official letters.'),
  permission('secretariat', 'letters', 'create', 'Create official letters.'),
  permission('secretariat', 'letters', 'update', 'Update official letters.'),
  permission('secretariat', 'letters', 'issue', 'Issue official letters.'),

  permission('secretariat', 'notices', 'view', 'View official notices.'),
  permission('secretariat', 'notices', 'manage', 'Manage official notices.'),

  permission('secretariat', 'requests', 'view', 'View administrative requests.'),
  permission('secretariat', 'requests', 'manage', 'Manage administrative requests.'),

  permission('secretariat', 'documents', 'view', 'View Secretariat documents.'),
  permission('secretariat', 'documents', 'manage', 'Manage Secretariat documents.'),

  permission('secretariat', 'reports', 'view', 'View Secretariat reports.'),

  // ============================================================
  // 04. EVENTS
  // ============================================================

  permission('events', 'events', 'view', 'View KUHRSA events.'),
  permission('events', 'events', 'create', 'Create events.'),
  permission('events', 'events', 'update', 'Update events.'),
  permission('events', 'events', 'delete', 'Delete events.'),

  permission('events', 'registration', 'view', 'View event registration records.'),
  permission('events', 'registration', 'manage', 'Manage event registration.'),

  permission('events', 'participants', 'view', 'View event participants.'),
  permission('events', 'participants', 'manage', 'Manage event participants.'),

  permission('events', 'attendance', 'view', 'View event attendance.'),
  permission('events', 'attendance', 'manage', 'Manage event attendance.'),

  permission('events', 'qr_checkin', 'view', 'View event QR check-in tools.'),
  permission('events', 'qr_checkin', 'scan', 'Scan event attendance QR codes.'),

  permission('events', 'venues', 'view', 'View event venues.'),
  permission('events', 'venues', 'manage', 'Manage event venues.'),

  permission('events', 'logistics', 'view', 'View event logistics.'),
  permission('events', 'logistics', 'manage', 'Manage event logistics.'),

  permission('events', 'tasks', 'view', 'View event tasks.'),
  permission('events', 'tasks', 'manage', 'Manage event tasks.'),

  permission('events', 'documents', 'view', 'View event documents.'),
  permission('events', 'documents', 'manage', 'Manage event documents.'),

  permission('events', 'reports', 'view', 'View event reports.'),

  // ============================================================
  // 05. ACTIVITIES
  // ============================================================

  permission('activities', 'activities', 'view', 'View KUHRSA activities.'),
  permission('activities', 'activities', 'create', 'Create activities.'),
  permission('activities', 'activities', 'update', 'Update activities.'),
  permission('activities', 'activities', 'delete', 'Delete activities.'),

  permission('activities', 'registration', 'view', 'View activity registration.'),
  permission('activities', 'registration', 'manage', 'Manage activity registration.'),

  // ============================================================
  // 06. FINANCE
  // ============================================================

  permission('finance', 'fees', 'view', 'View membership fee structures.'),
  permission('finance', 'fees', 'manage', 'Manage membership fee structures.'),

  permission('finance', 'payments', 'view', 'View payment transactions.'),
  permission('finance', 'payments', 'manage', 'Manage payment records.'),

  permission('finance', 'history', 'view', 'View financial transaction history.'),

  permission('finance', 'mpesa', 'view', 'View M-Pesa transactions.'),
  permission('finance', 'mpesa', 'manage', 'Manage M-Pesa transaction records.'),

  permission('finance', 'reconciliation', 'view', 'View payment reconciliation.'),
  permission('finance', 'reconciliation', 'reconcile', 'Reconcile incoming payments.'),

  permission('finance', 'receipts', 'view', 'View payment receipts.'),
  permission('finance', 'receipts', 'issue', 'Issue payment receipts.'),
  permission('finance', 'receipts', 'manage', 'Manage payment receipt records.'),

  permission('finance', 'refunds', 'view', 'View refund requests and records.'),
  permission('finance', 'refunds', 'review', 'Review refund requests.'),
  permission('finance', 'refunds', 'approve', 'Approve refunds.'),
  permission('finance', 'refunds', 'process', 'Process approved refunds.'),

  permission('finance', 'expenses', 'view', 'View operational expenditures.'),
  permission('finance', 'expenses', 'create', 'Create expense records.'),
  permission('finance', 'expenses', 'update', 'Update expense records.'),
  permission('finance', 'expenses', 'approve', 'Approve expenses.'),

  permission('finance', 'budgets', 'view', 'View budgets.'),
  permission('finance', 'budgets', 'manage', 'Manage budgets.'),

  permission('finance', 'ledger', 'view', 'View the financial ledger.'),

  permission('finance', 'reports', 'view', 'View financial reports.'),

  // ============================================================
  // 07. ELECTIONS
  // ============================================================

  permission('elections', 'elections', 'view', 'View election cycles.'),
  permission('elections', 'elections', 'create', 'Create election cycles.'),
  permission('elections', 'elections', 'update', 'Update election cycles.'),
  permission('elections', 'elections', 'manage', 'Manage election configuration.'),

  permission('elections', 'positions', 'view', 'View election positions.'),
  permission('elections', 'positions', 'manage', 'Manage election positions.'),

  permission('elections', 'candidates', 'view', 'View election candidates.'),
  permission('elections', 'candidates', 'review', 'Review election candidates.'),
  permission('elections', 'candidates', 'approve', 'Approve election candidates.'),

  permission('elections', 'eligibility', 'view', 'View election eligibility rules.'),
  permission('elections', 'eligibility', 'manage', 'Manage election eligibility rules.'),

  permission('elections', 'voters', 'view', 'View the election voter register.'),
  permission('elections', 'voters', 'manage', 'Manage the election voter register.'),

  permission('elections', 'voting', 'view', 'View election voting status.'),
  permission('elections', 'voting', 'manage', 'Manage active election voting controls.'),

  permission('elections', 'results', 'view', 'View election results.'),
  permission('elections', 'results', 'finalize', 'Finalize election results.'),

  permission('elections', 'reports', 'view', 'View election reports.'),

  permission('elections', 'audit', 'view', 'View election audit records.'),

  // ============================================================
  // 08. CONTENT
  // ============================================================

  permission('content', 'pages', 'view', 'View public website pages.'),
  permission('content', 'pages', 'manage', 'Manage public website pages.'),

  permission('content', 'publishing', 'view', 'View content publishing workflows.'),
  permission('content', 'publishing', 'review', 'Review content for publication.'),
  permission('content', 'publishing', 'schedule', 'Schedule content publication.'),
  permission('content', 'publishing', 'publish', 'Publish approved content.'),
  permission('content', 'publishing', 'unpublish', 'Unpublish published content.'),

  permission('content', 'news', 'view', 'View KUHRSA news content.'),
  permission('content', 'news', 'create', 'Create news content.'),
  permission('content', 'news', 'update', 'Update news content.'),
  permission('content', 'news', 'delete', 'Delete news content.'),

  permission('content', 'announcements', 'view', 'View KUHRSA announcements.'),
  permission('content', 'announcements', 'create', 'Create announcements.'),
  permission('content', 'announcements', 'update', 'Update announcements.'),
  permission('content', 'announcements', 'publish', 'Publish announcements.'),

  permission('content', 'articles', 'view', 'View editorial articles.'),
  permission('content', 'articles', 'manage', 'Manage editorial articles.'),

  permission('content', 'activities', 'view', 'View activity content.'),
  permission('content', 'activities', 'manage', 'Manage activity content.'),

  permission('content', 'events', 'view', 'View event content.'),
  permission('content', 'events', 'manage', 'Manage event content.'),

  permission('content', 'media', 'view', 'View the media library.'),
  permission('content', 'media', 'manage', 'Manage approved media assets.'),

  permission('content', 'gallery', 'view', 'View public galleries.'),
  permission('content', 'gallery', 'manage', 'Manage public galleries.'),

  permission('content', 'banners', 'view', 'View promotional banners.'),
  permission('content', 'banners', 'manage', 'Manage promotional banners.'),

  permission('content', 'social', 'view', 'View social content.'),
  permission('content', 'social', 'manage', 'Manage social content.'),

  permission('content', 'homepage', 'view', 'View homepage content configuration.'),
  permission('content', 'homepage', 'manage', 'Manage homepage sections and featured content.'),

  // ============================================================
  // 09. COMMUNICATION
  // ============================================================

  permission('communication', 'notifications', 'view', 'View administrative notifications.'),
  permission('communication', 'notifications', 'manage', 'Manage administrative notifications.'),

  permission('communication', 'messages', 'view', 'View communication messages.'),
  permission('communication', 'messages', 'manage', 'Manage communication messages.'),

  permission('communication', 'member_communications', 'view', 'View member communications.'),
  permission('communication', 'member_communications', 'manage', 'Manage member communications.'),

  permission('communication', 'email', 'view', 'View email communication activity.'),
  permission('communication', 'email', 'send', 'Send KUHRSA email communications.'),

  permission('communication', 'sms', 'view', 'View SMS communication activity.'),
  permission('communication', 'sms', 'send', 'Send KUHRSA SMS communications.'),

  permission('communication', 'templates', 'view', 'View communication templates.'),
  permission('communication', 'templates', 'manage', 'Manage communication templates.'),

  permission('communication', 'campaigns', 'view', 'View communication campaigns.'),
  permission('communication', 'campaigns', 'manage', 'Manage communication campaigns.'),
  permission('communication', 'campaigns', 'send', 'Send communication campaigns.'),

  permission('communication', 'history', 'view', 'View communication history.'),

  // ============================================================
  // 10. RESOURCES
  // ============================================================

  permission('resources', 'documents', 'view', 'View official KUHRSA documents.'),
  permission('resources', 'documents', 'manage', 'Manage official KUHRSA documents.'),

  permission('resources', 'downloads', 'view', 'View downloadable resources.'),
  permission('resources', 'downloads', 'manage', 'Manage downloadable resources.'),

  permission('resources', 'certificates', 'view', 'View certificates.'),
  permission('resources', 'certificates', 'issue', 'Issue certificates.'),
  permission('resources', 'certificates', 'manage', 'Manage certificates.'),

  permission('resources', 'certificate_verification', 'view', 'View certificate verification tools.'),
  permission('resources', 'certificate_verification', 'verify', 'Verify certificate references.'),

  permission('resources', 'member_documents', 'view', 'View member documents.'),
  permission('resources', 'member_documents', 'review', 'Review member documents.'),
  permission('resources', 'member_documents', 'manage', 'Manage member documents.'),

  permission('resources', 'templates', 'view', 'View reusable resource templates.'),
  permission('resources', 'templates', 'manage', 'Manage reusable resource templates.'),

  permission('resources', 'categories', 'view', 'View resource categories.'),
  permission('resources', 'categories', 'manage', 'Manage resource categories.'),

  // ============================================================
  // 11. REPORTS & ANALYTICS
  // ============================================================

  permission('reports', 'membership', 'view', 'View membership reports.'),
  permission('reports', 'membership', 'generate', 'Generate membership reports.'),

  permission('reports', 'finance', 'view', 'View finance reports.'),
  permission('reports', 'finance', 'generate', 'Generate finance reports.'),

  permission('reports', 'payments', 'view', 'View payment reports.'),
  permission('reports', 'payments', 'generate', 'Generate payment reports.'),

  permission('reports', 'events', 'view', 'View event reports.'),
  permission('reports', 'events', 'generate', 'Generate event reports.'),

  permission('reports', 'activities', 'view', 'View activity reports.'),
  permission('reports', 'activities', 'generate', 'Generate activity reports.'),

  permission('reports', 'elections', 'view', 'View election reports.'),
  permission('reports', 'elections', 'generate', 'Generate election reports.'),

  permission('reports', 'communication', 'view', 'View communication reports.'),
  permission('reports', 'communication', 'generate', 'Generate communication reports.'),

  permission('reports', 'analytics', 'view', 'View membership and operational analytics.'),

  permission('reports', 'custom', 'view', 'View custom report tools.'),
  permission('reports', 'custom', 'create', 'Create custom report definitions.'),
  permission('reports', 'custom', 'generate', 'Generate custom reports.'),

  // ============================================================
  // 12. USER & ACCESS
  // ============================================================

  permission('users', 'users', 'view', 'View KUHRSA system users.'),
  permission('users', 'users', 'create', 'Create system users.'),
  permission('users', 'users', 'update', 'Update system users.'),
  permission('users', 'users', 'suspend', 'Suspend system users.'),
  permission('users', 'users', 'restore', 'Restore suspended system users.'),

  permission('users', 'roles', 'view', 'View access roles.'),
  permission('users', 'roles', 'create', 'Create access roles.'),
  permission('users', 'roles', 'update', 'Update access roles.'),
  permission('users', 'roles', 'delete', 'Delete access roles.'),
  permission('users', 'roles', 'assign', 'Assign roles to authorized users.'),

  permission('users', 'permissions', 'view', 'View available permissions.'),
  permission('users', 'permissions', 'manage', 'Manage permission definitions.'),

  permission('users', 'access_rules', 'view', 'View access rules.'),
  permission('users', 'access_rules', 'manage', 'Manage access rules.'),

  permission('users', 'delegation', 'view', 'View delegated access.'),
  permission('users', 'delegation', 'create', 'Create delegated access.'),
  permission('users', 'delegation', 'revoke', 'Revoke delegated access.'),

  permission('users', 'access_reviews', 'view', 'View access reviews.'),
  permission('users', 'access_reviews', 'review', 'Review user access.'),
  permission('users', 'access_reviews', 'approve', 'Approve access reviews.'),

  permission('users', 'access_logs', 'view', 'View access and authorization logs.'),

  // ============================================================
  // 13. ICT
  // ============================================================

  permission('ict', 'website', 'view', 'View website technical management.'),
  permission('ict', 'website', 'manage', 'Manage website technical configuration.'),

  permission('ict', 'support', 'view', 'View technical support requests.'),
  permission('ict', 'support', 'manage', 'Manage technical support requests.'),
  permission('ict', 'support', 'resolve', 'Resolve technical support requests.'),

  permission('ict', 'scanning', 'view', 'View scanning services.'),
  permission('ict', 'scanning', 'manage', 'Manage scanning services.'),
  permission('ict', 'scanning', 'scan', 'Perform authorized scanning operations.'),

  permission('ict', 'qr', 'view', 'View QR code configuration.'),
  permission('ict', 'qr', 'manage', 'Manage QR code configuration.'),

  permission('ict', 'qr_verification', 'view', 'View QR verification activity.'),
  permission('ict', 'qr_verification', 'verify', 'Perform QR verification.'),

  permission('ict', 'integrations', 'view', 'View system integrations.'),
  permission('ict', 'integrations', 'manage', 'Manage system integrations.'),

  permission('ict', 'health', 'view', 'View system health information.'),

  permission('ict', 'backups', 'view', 'View backup operations.'),
  permission('ict', 'backups', 'manage', 'Manage backup operations.'),

  permission('ict', 'logs', 'view', 'View technical logs.'),

  // ============================================================
  // 14. SYSTEM ADMINISTRATION
  // ============================================================

  permission('system', 'super_administrators', 'view', 'View Super Administrator accounts.'),
  permission('system', 'super_administrators', 'manage', 'Manage Super Administrator accounts.'),

  permission('system', 'administrators', 'view', 'View Administrator accounts.'),
  permission('system', 'administrators', 'manage', 'Manage Administrator accounts.'),

  permission('system', 'configuration', 'view', 'View system configuration.'),
  permission('system', 'configuration', 'manage', 'Manage system configuration.'),

  permission('system', 'security', 'view', 'View system security controls.'),
  permission('system', 'security', 'manage', 'Manage system security controls.'),

  permission('system', 'database', 'view', 'View database status and information.'),
  permission('system', 'database', 'manage', 'Manage authorized database administration.'),

  permission('system', 'maintenance', 'view', 'View system maintenance activities.'),
  permission('system', 'maintenance', 'manage', 'Manage scheduled system maintenance.'),

  permission('system', 'audit', 'view', 'View system administration audit logs.'),

  permission('system', 'settings', 'view', 'View system settings.'),
  permission('system', 'settings', 'manage', 'Manage system settings.'),

  permission('system', 'health', 'view', 'View system health information.'),
];

export const allSeedPermissions = [
  ...canonicalPermissions,
];
