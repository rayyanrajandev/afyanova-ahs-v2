import type { AppIconName } from '@/lib/icons';

export type NavSectionKey =
    | 'front_office'
    | 'clinical_care'
    | 'diagnostics'
    | 'billing'
    | 'stores'
    | 'people'
    | 'facility_setup'
    | 'system_access';

export type AppNavCatalogItem = {
    id?: string;
    title: string;
    href: string;
    iconName: AppIconName;
    section: NavSectionKey;
    subGroup?: string;
    permissionPrefixes: string[];
    /** Short description on Help & Shortcuts quick links */
    helpNote?: string;
};

export const navSectionLabels: Record<NavSectionKey, string> = {
    front_office: 'Registration & visits',
    clinical_care: 'Clinical care',
    diagnostics: 'Diagnostics & pharmacy',
    billing: 'Billing & insurance',
    stores: 'Stores & supply',
    people: 'People & credentials',
    facility_setup: 'Facility setup',
    system_access: 'Users & system',
};

export const navSectionOrder: NavSectionKey[] = [
    'front_office',
    'clinical_care',
    'diagnostics',
    'billing',
    'stores',
    'people',
    'facility_setup',
    'system_access',
];

/** Primary icon for Help & Shortcuts section headers */
export const navSectionIcons: Record<NavSectionKey, AppIconName> = {
    front_office: 'calendar-clock',
    clinical_care: 'heart-pulse',
    diagnostics: 'stethoscope',
    billing: 'circle-check-big',
    stores: 'package',
    people: 'users',
    facility_setup: 'building-2',
    system_access: 'shield-check',
};

export const navSubGroupLabels: Partial<
    Record<NavSectionKey, Record<string, string>>
> = {
    billing: {
        operations: 'Operations',
        rates: 'Coverage & rates',
        reports: 'Reporting',
    },
    stores: {
        transactions: 'Transactions',
        admin: 'Administration',
    },
};

export const appNavCatalog: AppNavCatalogItem[] = [
    {
        title: 'Patient registry',
        href: '/patients',
        iconName: 'users',
        section: 'front_office',
        permissionPrefixes: ['patients.'],
        helpNote: 'Front desk lookup, registration, and duplicate checks',
    },
    {
        title: 'Walk-in service desk',
        href: '/walk-in-service-requests',
        iconName: 'layout-list',
        section: 'front_office',
        permissionPrefixes: ['service.requests.'],
        helpNote: 'Direct service requests and walk-in handoffs',
    },
    {
        title: 'OPD appointments',
        href: '/appointments',
        iconName: 'calendar-clock',
        section: 'front_office',
        permissionPrefixes: ['appointments.'],
        helpNote: 'Check-in queue, triage, and quick booking',
    },
    {
        title: 'Inpatient admissions',
        href: '/admissions',
        iconName: 'bed-double',
        section: 'front_office',
        permissionPrefixes: ['admissions.'],
        helpNote: 'Admission list, bed assignment, and status transitions',
    },
    {
        title: 'Emergency & triage',
        href: '/emergency-triage',
        iconName: 'alert-triangle',
        section: 'clinical_care',
        permissionPrefixes: ['emergency.triage.'],
        helpNote: 'Rapid intake, triage category, and transfer desk',
    },
    {
        title: 'Ward management',
        href: '/inpatient-ward',
        iconName: 'clipboard-list',
        section: 'clinical_care',
        permissionPrefixes: ['inpatient.ward.'],
        helpNote: 'Ward census, nursing tasks, and bedside workflow',
    },
    {
        title: 'Operating theatre',
        href: '/theatre-procedures',
        iconName: 'scissors',
        section: 'clinical_care',
        permissionPrefixes: ['theatre.procedures.'],
        helpNote: 'Procedure scheduling and perioperative workflow',
    },
    {
        title: 'Clinical records',
        href: '/medical-records',
        iconName: 'file-text',
        section: 'clinical_care',
        permissionPrefixes: ['medical.records.', 'medical-records.'],
        helpNote: 'Consultation workspace and clinical documentation',
    },
    {
        title: 'Laboratory',
        href: '/laboratory-orders',
        iconName: 'flask-conical',
        section: 'diagnostics',
        permissionPrefixes: ['laboratory.orders.', 'laboratory-orders.'],
        helpNote: 'Lab order queue and result status updates',
    },
    {
        title: 'Imaging & radiology',
        href: '/radiology-orders',
        iconName: 'activity',
        section: 'diagnostics',
        permissionPrefixes: ['radiology.orders.'],
        helpNote: 'Imaging orders across modalities',
    },
    {
        title: 'Pharmacy & dispensing',
        href: '/pharmacy-orders',
        iconName: 'pill',
        section: 'diagnostics',
        permissionPrefixes: ['pharmacy.orders.', 'pharmacy-orders.'],
        helpNote: 'Dispense queue and medication fulfillment',
    },
    {
        title: 'Invoices & billing',
        href: '/billing-invoices',
        iconName: 'receipt',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.', 'billing-invoices.'],
        helpNote: 'Invoice queue, settlement, and adjustments',
    },
    {
        title: 'Cashier',
        href: '/billing-cash',
        iconName: 'receipt',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.cash-accounts.'],
        helpNote: 'Cash accounts, receipts, and cashier closeout',
    },
    {
        title: 'POS counter',
        href: '/pos',
        iconName: 'receipt',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['pos.'],
        helpNote: 'Point-of-sale receipts and shift controls',
    },
    {
        title: 'Credit/Debit Notes',
        href: '/billing-adjustments',
        iconName: 'receipt',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.invoices.'],
        helpNote: 'Invoice adjustments, credit notes, and debit notes',
    },
    {
        title: 'Daily Revenue Close',
        href: '/billing-daily-close',
        iconName: 'receipt',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.financial-controls.'],
        helpNote: 'Daily cashier settlement and revenue reconciliation',
    },
    {
        title: 'Write-Offs & Bad Debt',
        href: '/billing-write-offs',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.invoices.'],
        helpNote: 'Uncollectible balance write-off approvals',
    },
    {
        title: 'Tariffs & services',
        href: '/billing-service-catalog',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'rates',
        permissionPrefixes: ['billing.service-catalog.'],
        helpNote: 'Billable services, tariffs, and pricing history',
    },
    {
        title: 'NHIF & insurance',
        href: '/claims-insurance',
        iconName: 'shield-check',
        section: 'billing',
        subGroup: 'rates',
        permissionPrefixes: ['claims.insurance.'],
        helpNote: 'NHIF, private payers, pre-auth, and claim adjudication',
    },
    {
        title: 'Payer contracts',
        href: '/billing-payer-contracts',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'rates',
        permissionPrefixes: ['billing.payer-contracts.'],
        helpNote: 'Payer contract terms and coverage rules',
    },
    {
        title: 'Refunds',
        href: '/billing-refunds',
        iconName: 'rotate-ccw',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.refunds.'],
        helpNote: 'Refund requests and approval workflow',
    },
    {
        title: 'Discount policies',
        href: '/billing-discounts',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'operations',
        permissionPrefixes: ['billing.discounts.'],
        helpNote: 'Discount rules and authorization policies',
    },
    {
        title: 'Financial reports',
        href: '/billing-financial-reports',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'reports',
        permissionPrefixes: ['billing.financial-controls.'],
        helpNote: 'Financial controls and management reports',
    },
    {
        title: 'AR Aging Report',
        href: '/billing-aging-report',
        iconName: 'file-text',
        section: 'billing',
        subGroup: 'reports',
        permissionPrefixes: ['billing.financial-controls.'],
        helpNote: 'Aged accounts receivable balances',
    },
    {
        title: 'Supply chain',
        href: '/inventory-procurement',
        iconName: 'package',
        section: 'stores',
        subGroup: 'transactions',
        permissionPrefixes: ['inventory.procurement.'],
        helpNote: 'Hospital stores, procurement, and stock tasks',
    },
    {
        title: 'Pending approvals',
        href: '/inventory-procurement/pending-approvals',
        iconName: 'clipboard-list',
        section: 'stores',
        subGroup: 'transactions',
        permissionPrefixes: ['inventory.approve-requisition.'],
        helpNote: 'Approve or reject requisitions in your department approval queue',
    },
    {
        title: 'Receive stock',
        href: '/inventory-procurement/receive',
        iconName: 'package',
        section: 'stores',
        subGroup: 'transactions',
        permissionPrefixes: ['inventory.procurement.create-movement'],
        helpNote: 'Receive deliveries and post store stock',
    },
    {
        title: 'Issue stock',
        href: '/inventory-procurement/issue',
        iconName: 'package',
        section: 'stores',
        subGroup: 'transactions',
        permissionPrefixes: ['inventory.procurement.create-movement'],
        helpNote: 'Issue stock to wards and departments',
    },
    {
        title: 'Cycle count',
        href: '/inventory-procurement/count',
        iconName: 'shield-check',
        section: 'stores',
        subGroup: 'transactions',
        permissionPrefixes: [
            'inventory.procurement.reconcile-stock',
            'inventory.procurement.create-movement',
        ],
        helpNote: 'Count physical stock and post governed variances',
    },
    {
        title: 'Workspace',
        href: '/inventory-procurement/workspace',
        iconName: 'layout-grid',
        section: 'stores',
        subGroup: 'admin',
        permissionPrefixes: ['inventory.procurement.'],
        helpNote:
            'Supervisor workspace for item master, procurement, ledger, requisitions, MSD, and analytics',
    },
    {
        title: 'Warehouses',
        href: '/inventory-procurement/warehouses',
        iconName: 'building-2',
        section: 'stores',
        subGroup: 'admin',
        permissionPrefixes: ['inventory.procurement.manage-warehouses'],
        helpNote: 'Warehouse registry and status management',
    },
    {
        title: 'Suppliers',
        href: '/inventory-procurement/suppliers',
        iconName: 'package',
        section: 'stores',
        subGroup: 'admin',
        permissionPrefixes: ['inventory.procurement.manage-suppliers'],
        helpNote: 'Supplier registry and vendor management',
    },
    {
        title: 'Staff directory',
        href: '/staff',
        iconName: 'users',
        section: 'people',
        permissionPrefixes: ['staff.'],
        helpNote: 'Staff profiles and employment status',
    },
    {
        title: 'Staff attendance',
        href: '/staff-attendance',
        iconName: 'clock',
        section: 'people',
        permissionPrefixes: ['staff.attendance.'],
        helpNote: 'Biometric attendance logs from ZKTeco devices',
    },
    {
        title: 'Staff credentialing',
        href: '/staff-credentialing',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.credentialing.'],
        helpNote: 'Licences, documents, and credentialing queue',
    },
    {
        title: 'Clinical privileges',
        href: '/staff-privileges',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.privileges.', 'staff.privileges'],
        helpNote: 'Privilege grants, coverage board, and approvals',
    },
    {
        title: 'Privilege catalog',
        href: '/platform/admin/privilege-catalogs',
        iconName: 'shield-check',
        section: 'people',
        permissionPrefixes: ['staff.privileges.'],
        helpNote: 'Master privilege definitions for the facility',
    },
    {
        title: 'Facility setup',
        href: '/platform/admin/facility-config',
        iconName: 'building-2',
        section: 'facility_setup',
        permissionPrefixes: [
            'platform.facilities.',
            'platform.multi-facility.',
            'platform.resources.',
            'platform.clinical-catalog.',
            'platform.subscription-plans.',
            'platform.settings.',
            'departments.',
            'specialties.',
            'billing.service-catalog.',
            'platform.users.manage-facilities',
        ],
        helpNote:
            'Facility foundation, departments, resources, catalogs, subscriptions, and access',
    },
    {
        title: 'Subscription plans',
        href: '/platform/admin/service-plans',
        iconName: 'receipt',
        section: 'facility_setup',
        permissionPrefixes: ['platform.subscription-plans.'],
        helpNote: 'Module packages, fees, and entitlements',
    },
    {
        title: 'Facility rollouts',
        href: '/platform/admin/facility-rollouts',
        iconName: 'clipboard-list',
        section: 'facility_setup',
        permissionPrefixes: ['platform.multi-facility.'],
        helpNote: 'Multi-facility rollout queue and command centre',
    },
    {
        title: 'Departments',
        href: '/platform/admin/departments',
        iconName: 'building-2',
        section: 'facility_setup',
        permissionPrefixes: ['departments.'],
        helpNote: 'Department master data administration',
    },
    {
        title: 'Service points',
        href: '/platform/admin/service-points',
        iconName: 'map-pin',
        section: 'facility_setup',
        permissionPrefixes: ['platform.resources.'],
        helpNote: 'Clinics, counters, and service point resources',
    },
    {
        title: 'Wards & beds',
        href: '/platform/admin/ward-beds',
        iconName: 'bed-double',
        section: 'facility_setup',
        permissionPrefixes: ['platform.resources.'],
        helpNote: 'Ward and bed capacity registry',
    },
    {
        title: 'Clinical specialties',
        href: '/platform/admin/specialties',
        iconName: 'activity',
        section: 'facility_setup',
        permissionPrefixes: ['specialties.', 'staff.specialties.'],
        helpNote: 'Specialty registry and staff assignments',
    },
    {
        title: 'Clinical service catalog',
        href: '/platform/admin/clinical-catalogs',
        iconName: 'book-open',
        section: 'facility_setup',
        permissionPrefixes: [
            'platform.clinical-catalog.',
            'laboratory.orders.',
            'radiology.orders.',
            'pharmacy.orders.',
            'billing.service-catalog.',
        ],
        helpNote: 'Orderables, services, and catalog governance',
    },
    {
        title: 'Branding',
        href: '/platform/admin/branding',
        iconName: 'pencil',
        section: 'facility_setup',
        permissionPrefixes: ['platform.settings.'],
        helpNote: 'Facility logo, colours, and print branding',
    },
    {
        title: 'Users & access',
        href: '/platform/admin/users',
        iconName: 'user',
        section: 'system_access',
        permissionPrefixes: ['platform.users.'],
        helpNote: 'User lifecycle, roles, and facility assignments',
    },
    {
        title: 'Access approvals',
        href: '/platform/admin/user-approval-cases',
        iconName: 'clipboard-list',
        section: 'system_access',
        permissionPrefixes: ['platform.users.approval-cases.'],
        helpNote: 'Sensitive access change approval queue',
    },
    {
        title: 'Roles & permissions',
        href: '/platform/admin/roles',
        iconName: 'shield-check',
        section: 'system_access',
        permissionPrefixes: ['platform.rbac.'],
        helpNote: 'Role and permission administration (RBAC)',
    },
];

export const generalHelpTips: string[] = [
    'Use header "Create workflow" chips to move between consultation, lab, pharmacy, and billing without losing visit context.',
    'Use "Back to consultation" and "Back to appointments" links to return with appointment focus preserved.',
    'Use compact rows in busy queues for faster scanning. The preference is shared across OPD queues.',
    'Use advanced filters only when needed; each page remembers whether advanced filters were expanded.',
    'The sidebar and this page hide modules excluded from your facility subscription, even when your role grants permissions.',
];

export const helpTipsBySection: Record<NavSectionKey, string[]> = {
    front_office: [
        'Walk-in patients without a booked slot show an amber walk-in badge in the OPD appointments queue.',
        'Use quick booking in OPD appointments to add a slot without leaving the queue.',
        'Update patient demographics and NHIF or insurance details from the patient registry at any time.',
        'After a clinician orders admission, complete bed assignment from inpatient admissions.',
    ],
    clinical_care: [
        'Triage categories (P1–P5) sort the appointments queue automatically — P1 critical patients appear first.',
        'The emergency dashboard preset shows a critical alert when any P1 patient is waiting.',
        'Record triage in OPD appointments before the provider opens the consultation workspace.',
        'Lab, imaging, pharmacy, and theatre work linked to a visit appear in the visit side panel.',
    ],
    diagnostics: [
        'Laboratory and imaging queues support status transitions from ordered through completed.',
        'Pharmacy dispensing follows the same visit context when orders originate from consultation.',
        'Use stock pre-check warnings before confirming high-risk dispenses when shown.',
    ],
    billing: [
        'The POS counter handles cash and card receipts for walk-in payments and OTC sales.',
        'Use the billing queue preset on the dashboard for invoices awaiting settlement.',
        'NHIF and insurance workspace tracks pre-authorisation, submission, and adjudication status.',
        'Tariffs and services is the master price list — changes affect new invoices and quotes.',
    ],
    stores: [
        'Stores and procurement covers stock levels, requisitions, and goods receipt.',
        'Warehouse and supplier screens are available when your role includes those admin permissions.',
        'Department requisitions may be available without full storekeeper access depending on your role.',
        'Pending approvals shows requisitions awaiting your decision in the approval workflow.',
    ],
    people: [
        'Staff directory is the starting point for profiles, assignments, and status changes.',
        'Credentialing queue highlights expired or missing licences and mandatory documents.',
        'Clinical privileges must be granted before sensitive procedures appear in ordering workflows.',
    ],
    facility_setup: [
        'Facility setup links tenants, facilities, owners, and active subscription plans.',
        'Subscription plan entitlements control which sidebar modules appear for the facility.',
        'Service points, wards, beds, and departments should be configured before go-live scheduling.',
        'Clinical service catalog feeds orderables used across lab, imaging, pharmacy, and billing.',
    ],
    system_access: [
        'Users and access manages identity lifecycle, facility assignments, and role mapping.',
        'Access approvals are required for sensitive user changes when governance mode is enabled.',
        'Roles and permissions (RBAC) define what each hospital role can do across modules.',
    ],
};

export type HelpKeyboardShortcut = {
    action: string;
    keys: string[];
    notes?: string;
    permissionPrefixes: string[];
};

/** Shown when the user has any matching permission prefix (empty = everyone). */
export const helpKeyboardShortcuts: HelpKeyboardShortcut[] = [
    {
        action: 'Open OPD quick command palette',
        keys: ['Ctrl', 'K'],
        notes: 'On Mac use Cmd + K. Available on OPD and queue workspaces you can access.',
        permissionPrefixes: [
            'appointments.',
            'patients.',
            'medical.records.',
            'service.requests.',
            'laboratory.orders.',
            'pharmacy.orders.',
            'billing.',
        ],
    },
    {
        action: 'Search queue records quickly',
        keys: ['Type in search field'],
        notes: 'Search auto-runs after a short pause on list and queue screens.',
        permissionPrefixes: [],
    },
    {
        action: 'Run queue preset from command palette',
        keys: ['Ctrl', 'K'],
        notes: 'Use presets for scheduled, checked-in, lab, pharmacy, and billing states.',
        permissionPrefixes: [
            'appointments.',
            'patients.',
            'medical.records.',
            'laboratory.orders.',
            'pharmacy.orders.',
            'billing.',
        ],
    },
];

export type HelpDocLink = {
    label: string;
    href: string;
    permissionPrefixes: string[];
};

export const helpDocLinks: HelpDocLink[] = [
    {
        label: 'Project Plan',
        href: '/docs/project-restructure-plan',
        permissionPrefixes: ['platform.facilities.', 'platform.users.'],
    },
    {
        label: 'Breadth Plan',
        href: '/docs/controlled-breadth-first-plan',
        permissionPrefixes: ['platform.facilities.', 'platform.users.'],
    },
    {
        label: 'Emergency & Triage',
        href: '/docs/emergency-triage-v1-contract',
        permissionPrefixes: ['emergency.triage.'],
    },
    {
        label: 'Inpatient Ward',
        href: '/docs/inpatient-ward-operations-v1-contract',
        permissionPrefixes: ['inpatient.ward.'],
    },
    {
        label: 'Theatre/Procedure',
        href: '/docs/theatre-procedure-workflow-v1-contract',
        permissionPrefixes: ['theatre.procedures.'],
    },
    {
        label: 'Claims/Insurance',
        href: '/docs/claims-insurance-adjudication-v1-contract',
        permissionPrefixes: ['claims.insurance.'],
    },
    {
        label: 'Inventory/Procurement',
        href: '/docs/inventory-procurement-stores-v1-contract',
        permissionPrefixes: ['inventory.procurement.'],
    },
    {
        label: 'Supplier Management',
        href: '/docs/supplier-management-v1-contract',
        permissionPrefixes: ['inventory.procurement.'],
    },
    {
        label: 'Warehouse Management',
        href: '/docs/warehouse-management-v1-contract',
        permissionPrefixes: ['inventory.procurement.'],
    },
    {
        label: 'Clinical Specialties',
        href: '/docs/clinical-specialty-registry-v1-contract',
        permissionPrefixes: ['specialties.', 'staff.specialties.'],
    },
    {
        label: 'Departments',
        href: '/docs/department-management-v1-contract',
        permissionPrefixes: ['departments.'],
    },
    {
        label: 'Service/Ward Resources',
        href: '/docs/service-point-ward-resource-registry-v1-contract',
        permissionPrefixes: ['platform.resources.'],
    },
    {
        label: 'Facility Rollouts',
        href: '/docs/platform-multi-facility-rollout-operations-v1-contract',
        permissionPrefixes: ['platform.multi-facility.'],
    },
];
