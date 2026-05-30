<?php

namespace App\Modules\Platform\Application\Services;

use App\Modules\Platform\Domain\ValueObjects\DashboardSessionContext;

/**
 * Server source of truth for dashboard workflow landing (roles + effective permissions).
 */
final class DashboardWorkflowRegistry
{
    public const WORKFLOW_ADMIN = 'admin';

    public const WORKFLOW_EMERGENCY = 'emergency';

    public const WORKFLOW_OPERATIONS = 'operations';

    public const WORKFLOW_CASHIER = 'cashier';

    public const WORKFLOW_CLINICIAN = 'clinician';

    public const WORKFLOW_RECORDS = 'records';

    public const WORKFLOW_NURSING = 'nursing';

    public const WORKFLOW_THEATRE = 'theatre';

    public const WORKFLOW_DIRECT_SERVICE = 'direct_service';

    public const WORKFLOW_SUPPLY = 'supply';

    public const WORKFLOW_FRONT_DESK = 'front_desk';

    /**
     * @var array<int, string>
     */
    public const PRIORITY_ORDER = [
        self::WORKFLOW_ADMIN,
        self::WORKFLOW_EMERGENCY,
        self::WORKFLOW_OPERATIONS,
        self::WORKFLOW_CASHIER,
        self::WORKFLOW_CLINICIAN,
        self::WORKFLOW_RECORDS,
        self::WORKFLOW_NURSING,
        self::WORKFLOW_THEATRE,
        self::WORKFLOW_DIRECT_SERVICE,
        self::WORKFLOW_SUPPLY,
        self::WORKFLOW_FRONT_DESK,
    ];

    /**
     * @var array<int, string>
     */
    private const ADMIN_ROLE_CODES = [
        'PLATFORM.USER.ADMIN',
        'PLATFORM.RBAC.ADMIN',
        'PLATFORM.SUBSCRIPTION.ADMIN',
        'HOSPITAL.FACILITY.ADMIN',
        'HOSPITAL.DEPARTMENT.HEAD',
    ];

    /**
     * @var array<int, string>
     */
    private const CASHIER_ROLE_CODES = [
        'HOSPITAL.BILLING.CASHIER',
        'HOSPITAL.BILLING.OFFICER',
        'HOSPITAL.FINANCE.CONTROLLER',
    ];

    /**
     * @var array<int, string>
     */
    private const CLINICIAN_ROLE_CODES = [
        'HOSPITAL.CLINICAL.USER',
        'HOSPITAL.CLINICIAN.ORDERING',
    ];

    /**
     * @var array<int, string>
     */
    private const NURSING_ROLE_CODES = [
        'HOSPITAL.NURSING.USER',
    ];

    /**
     * @var array<int, string>
     */
    private const EMERGENCY_ROLE_CODES = [
        'HOSPITAL.EMERGENCY.USER',
        'HOSPITAL.EMERGENCY.NURSE',
        'HOSPITAL.TRIAGE.USER',
    ];

    /**
     * @var array<int, string>
     */
    private const DIRECT_SERVICE_ROLE_CODES = [
        'HOSPITAL.LABORATORY.USER',
        'HOSPITAL.PHARMACY.USER',
        'HOSPITAL.RADIOLOGY.USER',
    ];

    /**
     * @var array<int, string>
     */
    private const FRONT_DESK_ROLE_CODES = [
        'HOSPITAL.REGISTRATION.CLERK',
    ];

    /**
     * @var array<int, string>
     */
    private const OPERATIONS_ROLE_CODES = [
        'HOSPITAL.STAFF.ADMIN',
        'HOSPITAL.CREDENTIALING.OFFICER',
        'HOSPITAL.PRIVILEGING.REVIEWER',
        'HOSPITAL.PRIVILEGING.APPROVER',
    ];

    /**
     * @var array<int, string>
     */
    private const RECORDS_ROLE_CODES = [
        'HOSPITAL.MEDICAL.RECORDS.OFFICER',
    ];

    /**
     * @var array<int, string>
     */
    private const SUPPLY_ROLE_CODES = [
        'HOSPITAL.INVENTORY.STOREKEEPER',
    ];

    /**
     * @var array<int, string>
     */
    private const THEATRE_ROLE_CODES = [
        'HOSPITAL.THEATRE.USER',
    ];

    /**
     * Facility plan entitlements required to surface a workflow (aligned with routes/web.php).
     *
     * @var array<string, array{all?: array<int, string>, any?: array<int, string>}>
     */
    private const WORKFLOW_FACILITY_ENTITLEMENTS = [
        self::WORKFLOW_FRONT_DESK => [
            'all' => ['patients.search', 'appointments.scheduling'],
        ],
        self::WORKFLOW_CLINICIAN => [
            'any' => ['medical_records.core', 'appointments.scheduling'],
        ],
        self::WORKFLOW_NURSING => [
            'any' => ['inpatient.ward', 'appointments.scheduling'],
        ],
        self::WORKFLOW_EMERGENCY => [
            'any' => ['emergency.triage', 'appointments.scheduling'],
        ],
        self::WORKFLOW_DIRECT_SERVICE => [
            'any' => ['laboratory.orders', 'pharmacy.orders', 'radiology.orders'],
        ],
        self::WORKFLOW_CASHIER => [
            'any' => ['billing.invoices', 'claims.insurance'],
        ],
        self::WORKFLOW_OPERATIONS => [
            'any' => ['staff.profiles', 'staff.credentialing', 'staff.privileges'],
        ],
        self::WORKFLOW_RECORDS => [
            'all' => ['medical_records.core'],
        ],
        self::WORKFLOW_SUPPLY => [
            'all' => ['inventory.procurement'],
        ],
        self::WORKFLOW_THEATRE => [
            'all' => ['theatre.procedures'],
        ],
    ];

    /**
     * @return array<int, array{key: string, label: string, description: string, modules: array<int, string>, widgets: array<int, array{id: string, label: string, permission: string}>}>
     */
    public function workflowCatalog(): array
    {
        return [
            [
                'key' => self::WORKFLOW_FRONT_DESK,
                'label' => 'Front Desk',
                'description' => 'Keep arrivals, registration, and appointment handoffs moving without losing queue context.',
                'modules' => ['Patients', 'Appointments', 'Admissions'],
                'widgets' => [
                    ['id' => 'patients', 'label' => 'Patient census', 'permission' => 'patients.read'],
                    ['id' => 'appointments', 'label' => 'Appointment queue', 'permission' => 'appointments.read'],
                    ['id' => 'admissions', 'label' => 'Admissions', 'permission' => 'admissions.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_CLINICIAN,
                'label' => 'Clinician',
                'description' => 'Stay focused on consultation-ready encounters, open notes, and inpatient follow-up load.',
                'modules' => ['Appointments', 'Medical Records', 'Admissions'],
                'widgets' => [
                    ['id' => 'appointments', 'label' => 'Consultation queue', 'permission' => 'appointments.read'],
                    ['id' => 'medical_records', 'label' => 'Medical records', 'permission' => 'medical.records.read'],
                    ['id' => 'orders', 'label' => 'Downstream orders', 'permission' => 'laboratory.orders.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_NURSING,
                'label' => 'Nursing',
                'description' => 'Monitor triage queue, inpatient movement, and downstream orders that block bedside care.',
                'modules' => ['Triage', 'Admissions', 'Inpatient Ward'],
                'widgets' => [
                    ['id' => 'triage', 'label' => 'Triage queue', 'permission' => 'appointments.read'],
                    ['id' => 'ward', 'label' => 'Inpatient ward', 'permission' => 'inpatient.ward.read'],
                    ['id' => 'orders', 'label' => 'Stat orders', 'permission' => 'laboratory.orders.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_EMERGENCY,
                'label' => 'Emergency',
                'description' => 'Triage queue sorted by arrival time, stat orders, and real-time admission load for emergency and acute-care staff.',
                'modules' => ['Triage', 'Admissions', 'Laboratory', 'Pharmacy'],
                'widgets' => [
                    ['id' => 'triage', 'label' => 'ED triage', 'permission' => 'emergency.triage.read'],
                    ['id' => 'admissions', 'label' => 'Admissions', 'permission' => 'admissions.read'],
                    ['id' => 'orders', 'label' => 'Stat orders', 'permission' => 'laboratory.orders.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_DIRECT_SERVICE,
                'label' => 'Direct Service',
                'description' => 'Watch laboratory, pharmacy, and radiology queues without borrowing nursing-only census signals.',
                'modules' => ['Laboratory', 'Pharmacy', 'Radiology'],
                'widgets' => [
                    ['id' => 'laboratory', 'label' => 'Laboratory', 'permission' => 'laboratory.orders.read'],
                    ['id' => 'pharmacy', 'label' => 'Pharmacy', 'permission' => 'pharmacy.orders.read'],
                    ['id' => 'radiology', 'label' => 'Radiology', 'permission' => 'radiology.orders.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_CASHIER,
                'label' => 'Cashier',
                'description' => 'Prioritize invoice follow-up and payer exception handling from a single landing view.',
                'modules' => ['Billing', 'Claims', 'Pharmacy'],
                'widgets' => [
                    ['id' => 'billing', 'label' => 'Billing drafts', 'permission' => 'billing.invoices.read'],
                    ['id' => 'claims', 'label' => 'Claim exceptions', 'permission' => 'claims.insurance.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_ADMIN,
                'label' => 'Admin',
                'description' => 'Monitor platform health, scope coverage, and operational controls across modules.',
                'modules' => ['Audit Export', 'Users', 'Facility Config'],
                'widgets' => [
                    ['id' => 'audit_export', 'label' => 'Audit export health', 'permission' => 'platform.users.read'],
                    ['id' => 'scope', 'label' => 'Facility scope', 'permission' => 'platform.facilities.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_OPERATIONS,
                'label' => 'Operations',
                'description' => 'Staff directory, credentialing compliance, and privileging queues for HR and quality teams.',
                'modules' => ['Staff', 'Credentialing', 'Privileges'],
                'widgets' => [
                    ['id' => 'staff', 'label' => 'Staff census', 'permission' => 'staff.read'],
                    ['id' => 'credentialing', 'label' => 'Credentialing alerts', 'permission' => 'staff.credentialing.read'],
                    ['id' => 'privileges', 'label' => 'Privileging queue', 'permission' => 'staff.privileges.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_RECORDS,
                'label' => 'Medical Records',
                'description' => 'Health information workflows focused on chart completeness, release, and record governance.',
                'modules' => ['Medical Records', 'Patients', 'Audit'],
                'widgets' => [
                    ['id' => 'draft_records', 'label' => 'Draft records', 'permission' => 'medical.records.read'],
                    ['id' => 'patients', 'label' => 'Patient lookup', 'permission' => 'patients.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_SUPPLY,
                'label' => 'Supply Chain',
                'description' => 'Inventory alerts, stock movement, and procurement requests for storekeepers.',
                'modules' => ['Inventory', 'Procurement', 'Suppliers'],
                'widgets' => [
                    ['id' => 'stock_alerts', 'label' => 'Stock alerts', 'permission' => 'inventory.procurement.read'],
                    ['id' => 'procurement', 'label' => 'Procurement requests', 'permission' => 'inventory.procurement.read'],
                ],
            ],
            [
                'key' => self::WORKFLOW_THEATRE,
                'label' => 'Theatre',
                'description' => 'Procedure scheduling, OR resource allocation, and perioperative status at a glance.',
                'modules' => ['Theatre Procedures', 'Resource Allocation'],
                'widgets' => [
                    ['id' => 'schedule', 'label' => 'Procedure schedule', 'permission' => 'theatre.procedures.read'],
                    ['id' => 'status', 'label' => 'Status counts', 'permission' => 'theatre.procedures.read'],
                ],
            ],
        ];
    }

    /**
     * @return array<int, string>
     */
    public function eligibleWorkflowKeys(DashboardSessionContext $context): array
    {
        $allow = [];

        if (
            $context->isFacilitySuperAdmin
            || $context->isPlatformSuperAdmin
            || $context->matchesAnyRole(self::ADMIN_ROLE_CODES)
        ) {
            $allow[self::WORKFLOW_ADMIN] = true;
        }

        if ($context->matchesAnyRole(self::CASHIER_ROLE_CODES)) {
            $allow[self::WORKFLOW_CASHIER] = true;
        }

        if (
            $context->hasPermission('billing.invoices.read')
            || $context->hasPermission('claims.insurance.read')
        ) {
            $allow[self::WORKFLOW_CASHIER] = true;
        }

        $holdsRecordsRole = $context->matchesAnyRole(self::RECORDS_ROLE_CODES);

        if ($context->matchesAnyRole(self::CLINICIAN_ROLE_CODES)) {
            $allow[self::WORKFLOW_CLINICIAN] = true;
        }

        $holdsNursingRole = $context->matchesAnyRole(self::NURSING_ROLE_CODES);

        if ($context->hasPermission('medical.records.read') && ! $holdsNursingRole && ! $holdsRecordsRole) {
            $allow[self::WORKFLOW_CLINICIAN] = true;
        }

        if ($holdsNursingRole) {
            $allow[self::WORKFLOW_NURSING] = true;
        }

        $holdsEmergencyRole = $context->matchesAnyRole(self::EMERGENCY_ROLE_CODES);

        if ($holdsEmergencyRole) {
            $allow[self::WORKFLOW_EMERGENCY] = true;
        }

        if ($context->hasPermission('inpatient.ward.read') && ! $holdsEmergencyRole) {
            $allow[self::WORKFLOW_NURSING] = true;
        }

        if ($this->isOperationsEligible($context)) {
            $allow[self::WORKFLOW_OPERATIONS] = true;
        }

        if ($this->isRecordsEligible($context, $holdsNursingRole, $holdsEmergencyRole)) {
            $allow[self::WORKFLOW_RECORDS] = true;
        }

        if ($this->isSupplyEligible($context)) {
            $allow[self::WORKFLOW_SUPPLY] = true;
        }

        if ($this->isTheatreEligible($context)) {
            $allow[self::WORKFLOW_THEATRE] = true;
        }

        if ($context->matchesAnyRole(self::DIRECT_SERVICE_ROLE_CODES)) {
            $allow[self::WORKFLOW_DIRECT_SERVICE] = true;
        }

        if (
            $context->hasPermission('laboratory.orders.read')
            || $context->hasPermission('pharmacy.orders.read')
            || $context->hasPermission('radiology.orders.read')
        ) {
            $allow[self::WORKFLOW_DIRECT_SERVICE] = true;
        }

        if ($context->matchesAnyRole(self::FRONT_DESK_ROLE_CODES)) {
            $allow[self::WORKFLOW_FRONT_DESK] = true;
        }

        if (
            $context->hasPermission('patients.read')
            && $context->hasPermission('appointments.read')
        ) {
            $allow[self::WORKFLOW_FRONT_DESK] = true;
        }

        $ordered = [];
        foreach (self::PRIORITY_ORDER as $key) {
            if (isset($allow[$key])) {
                $ordered[] = $key;
            }
        }

        return $ordered !== [] ? $ordered : [self::WORKFLOW_FRONT_DESK];
    }

    public function defaultWorkflowKey(DashboardSessionContext $context): string
    {
        $ordered = $this->eligibleWorkflowKeys($context);

        return $ordered[0] ?? self::WORKFLOW_FRONT_DESK;
    }

    /**
     * @param  array<int, string>  $workflowKeys
     * @param  array<int, string>  $grantedEntitlementsLower
     * @return array<int, string>
     */
    public function filterWorkflowKeysByFacilitySubscription(
        array $workflowKeys,
        array $grantedEntitlementsLower,
        bool $bypassFilter,
    ): array {
        if ($bypassFilter || $grantedEntitlementsLower === []) {
            return $workflowKeys;
        }

        $granted = array_flip($grantedEntitlementsLower);

        return array_values(array_filter(
            $workflowKeys,
            fn (string $key): bool => $this->workflowPassesFacilityEntitlements($key, $granted),
        ));
    }

    /**
     * @return array<int, array{key: string, label: string, description: string, modules: array<int, string>, widgets: array<int, array{id: string, label: string, permission: string}>}>
     */
    public function eligibleWorkflowDefinitions(DashboardSessionContext $context): array
    {
        $eligible = array_flip($this->eligibleWorkflowKeys($context));
        $definitions = [];

        foreach ($this->workflowCatalog() as $workflow) {
            if (! isset($eligible[$workflow['key']])) {
                continue;
            }

            $widgets = array_values(array_filter(
                $workflow['widgets'] ?? [],
                fn (array $widget): bool => $context->hasPermission((string) ($widget['permission'] ?? '')),
            ));

            $definitions[] = [
                'key' => $workflow['key'],
                'label' => $workflow['label'],
                'description' => $workflow['description'],
                'modules' => $workflow['modules'],
                'widgets' => $widgets,
            ];
        }

        return $definitions;
    }

    /**
     * @param  array<string, bool>  $grantedEntitlementsLower
     */
    private function workflowPassesFacilityEntitlements(string $workflowKey, array $grantedEntitlementsLower): bool
    {
        if ($workflowKey === self::WORKFLOW_ADMIN) {
            return true;
        }

        $rule = self::WORKFLOW_FACILITY_ENTITLEMENTS[$workflowKey] ?? null;
        if ($rule === null) {
            return true;
        }

        if (isset($rule['all'])) {
            foreach ($rule['all'] as $entitlement) {
                if (! isset($grantedEntitlementsLower[strtolower($entitlement)])) {
                    return false;
                }
            }

            return true;
        }

        if (isset($rule['any'])) {
            foreach ($rule['any'] as $entitlement) {
                if (isset($grantedEntitlementsLower[strtolower($entitlement)])) {
                    return true;
                }
            }

            return false;
        }

        return true;
    }

    private function isOperationsEligible(DashboardSessionContext $context): bool
    {
        if ($context->matchesAnyRole(self::OPERATIONS_ROLE_CODES)) {
            return true;
        }

        if (! $context->hasPermission('staff.read')) {
            return false;
        }

        return $context->hasPermission('staff.credentialing.read')
            || $context->hasPermission('staff.privileges.read');
    }

    private function isRecordsEligible(
        DashboardSessionContext $context,
        bool $holdsNursingRole,
        bool $holdsEmergencyRole,
    ): bool {
        if ($context->matchesAnyRole(self::RECORDS_ROLE_CODES)) {
            return true;
        }

        if (! $context->hasPermission('medical.records.read')) {
            return false;
        }

        if ($holdsNursingRole || $holdsEmergencyRole || $context->matchesAnyRole(self::CLINICIAN_ROLE_CODES)) {
            return false;
        }

        return true;
    }

    private function isSupplyEligible(DashboardSessionContext $context): bool
    {
        if ($context->matchesAnyRole(self::SUPPLY_ROLE_CODES)) {
            return true;
        }

        return $context->hasPermission('inventory.procurement.read');
    }

    private function isTheatreEligible(DashboardSessionContext $context): bool
    {
        if ($context->matchesAnyRole(self::THEATRE_ROLE_CODES)) {
            return true;
        }

        return $context->hasPermission('theatre.procedures.read');
    }
}
