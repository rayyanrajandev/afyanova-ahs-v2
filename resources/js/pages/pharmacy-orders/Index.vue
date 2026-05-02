<script setup lang="ts">
import { Head, Link } from '@inertiajs/vue3';
import {
    computed,
    nextTick,
    onBeforeUnmount,
    onMounted,
    reactive,
    ref,
    watch,
} from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import LinkedContextLookupField from '@/components/context/LinkedContextLookupField.vue';
import DateRangeFilterPopover from '@/components/filters/DateRangeFilterPopover.vue';
import SearchableSelectField from '@/components/forms/SearchableSelectField.vue';
import ClinicalLifecycleActionDialog from '@/components/orders/ClinicalLifecycleActionDialog.vue';
import PatientLookupField from '@/components/patients/PatientLookupField.vue';
import WalkInServiceRequestsPanel from '@/components/service-requests/WalkInServiceRequestsPanel.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Drawer,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
} from '@/components/ui/drawer';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Kbd, KbdGroup } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import ConfirmationDialog from '@/components/workflow/ConfirmationDialog.vue';
import LeaveWorkflowDialog from '@/components/workflow/LeaveWorkflowDialog.vue';
import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
import { useLocalStorageBoolean } from '@/composables/useLocalStorageBoolean';
import { usePendingWorkflowLeaveGuard } from '@/composables/usePendingWorkflowLeaveGuard';
import { useWorkflowDraftPersistence } from '@/composables/useWorkflowDraftPersistence';
import AppLayout from '@/layouts/AppLayout.vue';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { patientChartHref } from '@/lib/patientChart';
import { type SearchableSelectOption } from '@/lib/patientLocations';
import { type BreadcrumbItem } from '@/types';

type ScopeData = {
    resolvedFrom: string;
    tenant: { code: string; name: string } | null;
    facility: { code: string; name: string } | null;
    userAccess?: { accessibleFacilityCount?: number };
};

type PharmacyOrder = {
    id: string;
    orderNumber: string | null;
    patientId: string | null;
    admissionId: string | null;
    appointmentId: string | null;
    orderSessionId: string | null;
    replacesOrderId: string | null;
    addOnToOrderId: string | null;
    orderedByUserId: number | null;
    orderedAt: string | null;
    approvedMedicineCatalogItemId: string | null;
    medicationCode: string | null;
    medicationName: string | null;
    dosageInstruction: string | null;
    clinicalIndication: string | null;
    quantityPrescribed: string | number | null;
    quantityDispensed: string | number | null;
    dispensingNotes: string | null;
    dispensedAt: string | null;
    verifiedAt: string | null;
    verifiedByUserId: number | null;
    verificationNote: string | null;
    formularyDecisionStatus: 'not_reviewed' | 'formulary' | 'non_formulary' | 'restricted' | string | null;
    formularyDecisionReason: string | null;
    formularyReviewedAt: string | null;
    formularyReviewedByUserId: number | null;
    substitutionAllowed: boolean | null;
    substitutionMade: boolean | null;
    substitutedMedicationCode: string | null;
    substitutedMedicationName: string | null;
    substitutionReason: string | null;
    substitutionApprovedAt: string | null;
    substitutionApprovedByUserId: number | null;
    reconciliationStatus: 'pending' | 'completed' | 'exception' | string | null;
    reconciliationDecision:
        | 'add_to_current_list'
        | 'continue_on_current_list'
        | 'short_course_only'
        | 'stop_from_current_list'
        | 'review_later'
        | string
        | null;
    reconciliationNote: string | null;
    reconciledAt: string | null;
    reconciledByUserId: number | null;
    entryState: 'draft' | 'active' | string | null;
    signedAt: string | null;
    signedByUserId: number | null;
    status:
        | 'pending'
        | 'in_preparation'
        | 'partially_dispensed'
        | 'dispensed'
        | 'cancelled'
        | string
        | null;
    statusReason: string | null;
    lifecycleReasonCode: string | null;
    enteredInErrorAt: string | null;
    enteredInErrorByUserId: number | null;
    lifecycleLockedAt: string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type PharmacyOrderListResponse = {
    data: PharmacyOrder[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type PharmacyOrderAuditLog = {
    id: string;
    pharmacyOrderId: string | null;
    actorId: number | null;
    action: string | null;
    changes: Record<string, unknown> | unknown[] | null;
    metadata: Record<string, unknown> | unknown[] | null;
    createdAt: string | null;
};

type PharmacyOrderAuditLogListResponse = {
    data: PharmacyOrderAuditLog[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type PharmacyOrderAuditExportJob = {
    id: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | string;
    rowCount: number | null;
    schemaVersion: string | null;
    errorMessage: string | null;
    createdAt: string | null;
    startedAt: string | null;
    completedAt: string | null;
    failedAt: string | null;
    downloadUrl: string | null;
};

type PharmacyOrderAuditExportJobResponse = {
    data: PharmacyOrderAuditExportJob;
};

type PharmacyOrderAuditExportJobListResponse = {
    data: PharmacyOrderAuditExportJob[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type AuditExportJobStatusSummary = {
    total: number;
    completed: number;
    failed: number;
    queued: number;
    processing: number;
    backlog: number;
    other: number;
};

type AuditExportStatusGroup = 'all' | 'failed' | 'backlog' | 'completed';

type PharmacyOrderStatusCounts = {
    pending: number;
    in_preparation: number;
    partially_dispensed: number;
    dispensed: number;
    cancelled: number;
    reconciliation_pending: number;
    reconciliation_completed: number;
    reconciliation_exception: number;
    other: number;
    total: number;
};

type PharmacyOrderStatusCountsResponse = {
    data: PharmacyOrderStatusCounts;
};

type PatientSummary = {
    id: string;
    patientNumber: string | null;
    firstName: string | null;
    middleName: string | null;
    lastName: string | null;
};

type PatientResponse = {
    data: PatientSummary;
};

type AppointmentSummary = {
    id: string;
    appointmentNumber: string | null;
    patientId: string | null;
    department: string | null;
    scheduledAt: string | null;
    durationMinutes: number | null;
    reason: string | null;
    status:
        | 'scheduled'
        | 'checked_in'
        | 'completed'
        | 'cancelled'
        | 'no_show'
        | string
        | null;
    statusReason: string | null;
};

type AdmissionSummary = {
    id: string;
    admissionNumber: string | null;
    patientId: string | null;
    ward: string | null;
    bed: string | null;
    admittedAt: string | null;
    status:
        | 'admitted'
        | 'discharged'
        | 'transferred'
        | 'cancelled'
        | string
        | null;
    statusReason: string | null;
};

type AppointmentResponse = {
    data: AppointmentSummary;
};

type AdmissionResponse = {
    data: AdmissionSummary;
};

type LinkedContextListResponse<T> = {
    data: T[];
    meta?: {
        currentPage?: number;
        perPage?: number;
        total?: number;
        lastPage?: number;
    };
};

type ValidationErrorResponse = {
    message?: string;
    errors?: Record<string, string[]>;
    code?: string;
};

type PatientAllergy = {
    id: string;
    substanceCode: string | null;
    substanceName: string | null;
    reaction: string | null;
    severity: string | null;
    status: string | null;
    notedAt: string | null;
    lastReactionAt: string | null;
    notes: string | null;
};

type PatientMedicationProfile = {
    id: string;
    medicationCode: string | null;
    medicationName: string | null;
    dose: string | null;
    route: string | null;
    frequency: string | null;
    source: string | null;
    status: string | null;
    startedAt: string | null;
    stoppedAt: string | null;
    indication: string | null;
    notes: string | null;
    lastReconciledAt: string | null;
    reconciliationNote: string | null;
};

type AuthPermissionsResponse = {
    data?: Array<{ name?: string | null }>;
    meta?: { total?: number | null };
};

type DuplicateCheckResponse<T> = {
    data: {
        severity: 'none' | 'warning' | 'critical' | string;
        messages: string[];
        sameEncounterDuplicates: T[];
        recentPatientDuplicates: T[];
    };
};

type MedicationSafetyRule = {
    code: string;
    severity: 'warning' | 'critical' | string;
    category: string;
    categoryLabel: string | null;
    message: string;
    suggestedAction: string | null;
    requiresOverride: boolean;
    source: MedicationSafetyRuleSource | null;
};

type MedicationSafetyOverrideOption = {
    code: string;
    label: string;
    description: string;
};

type MedicationSafetyRuleSource = {
    type: string | null;
    label: string | null;
    referenceId: string | null;
    referenceLabel: string | null;
    observedAt: string | null;
    flag: string | null;
};

type MedicationSafetyRuleGroup = {
    key: string;
    label: string;
    severity: 'warning' | 'critical' | string;
    count: number;
    ruleCodes: string[];
    sourceLabels: string[];
};

type MedicationSafetyPatientContext = {
    ageYears: number | null;
    ageMonths: number | null;
    weightKg: number | null;
    weightSource: string | null;
    isPediatric: boolean;
};

type MedicationInteractionConflict = {
    ruleCode: string;
    severity: 'warning' | 'critical' | string;
    category: string;
    message: string;
    clinicalEffect: string | null;
    recommendedAction: string | null;
    targetMedicationCode: string | null;
    targetMedicationName: string | null;
    interactingMedicationCode: string | null;
    interactingMedicationName: string | null;
    sourceType: string | null;
    sourceLabel: string | null;
};

type MedicationLaboratorySignal = {
    ruleCode: string;
    severity: 'warning' | 'critical' | string;
    category: string;
    message: string;
    clinicalEffect: string | null;
    recommendedAction: string | null;
    sourceOrderId: string | null;
    sourceTestCode: string | null;
    sourceTestName: string | null;
    sourceResultSummary: string | null;
    sourceVerifiedAt: string | null;
    sourceFlag: string | null;
};

type ApprovedMedicinePolicyRecommendation = {
    key: string;
    severity: 'info' | 'warning' | string;
    title: string;
    summary: string;
    suggestedDecisionStatus:
        | 'not_reviewed'
        | 'formulary'
        | 'non_formulary'
        | 'restricted'
        | string;
    suggestedDecisionReason: string | null;
    requiresDecisionReason: boolean;
    substitutionRecommended: boolean;
    suggestedSubstitutionSelectionMode:
        | 'approved'
        | 'outside_list'
        | string
        | null;
    preferredAlternatives: string[];
    indicationMatched: boolean | null;
    indicationKeywords: string[];
    restrictionNote: string | null;
};

type PolicyDialogTab = 'decision' | 'substitution' | 'guidance';

type PharmacyOrderSafetyReview = {
    severity: 'none' | 'warning' | 'critical' | string;
    blockers: string[];
    warnings: string[];
    rules: MedicationSafetyRule[];
    ruleGroups: MedicationSafetyRuleGroup[];
    overrideOptions: MedicationSafetyOverrideOption[];
    patientContext: MedicationSafetyPatientContext | null;
    allergyConflicts: PatientAllergy[];
    interactionConflicts: MedicationInteractionConflict[];
    laboratorySignals: MedicationLaboratorySignal[];
    policyRecommendation: ApprovedMedicinePolicyRecommendation | null;
    activeProfileMatches: PatientMedicationProfile[];
    matchingActiveOrders: PharmacyOrder[];
    sameEncounterDuplicates: PharmacyOrder[];
    recentPatientDuplicates: PharmacyOrder[];
    recentMedicationHistory: PharmacyOrder[];
    unreconciledReleasedOrders: PharmacyOrder[];
    dispenseInventory: InventoryItem | null;
};

type PharmacyOrderSafetyReviewResponse = {
    data: PharmacyOrderSafetyReview;
};

type PatientMedicationSafetySummary = {
    severity: 'none' | 'warning' | 'critical' | string;
    blockers: string[];
    warnings: string[];
    rules: MedicationSafetyRule[];
    ruleGroups: MedicationSafetyRuleGroup[];
    overrideOptions: MedicationSafetyOverrideOption[];
    patientContext: MedicationSafetyPatientContext | null;
    allergyConflicts: PatientAllergy[];
    interactionConflicts: MedicationInteractionConflict[];
    laboratorySignals: MedicationLaboratorySignal[];
    policyRecommendation: ApprovedMedicinePolicyRecommendation | null;
    activeProfileMatches: PatientMedicationProfile[];
    activeMedicationProfile: PatientMedicationProfile[];
    matchingActiveOrders: PharmacyOrder[];
    sameEncounterDuplicates: PharmacyOrder[];
    recentPatientDuplicates: PharmacyOrder[];
    unreconciledDispensedOrders: PharmacyOrder[];
    suggestedActions: string[];
};

type PatientMedicationSafetySummaryResponse = {
    data: PatientMedicationSafetySummary;
};

type PharmacyOrderStatusAction =
    | 'in_preparation'
    | 'partially_dispensed'
    | 'dispensed'
    | 'cancelled'
    | 'verify';

type PharmacyWorkspaceView = 'queue' | 'new';

type DetailsSheetTab = 'overview' | 'audit';
type DetailsSheetOverviewTab = 'summary' | 'workflow' | 'safety' | 'timeline';
type CreateMedicationSafetyReviewTab = 'summary' | 'clinical' | 'actions';
type ReconciliationDialogTab = 'status' | 'outcome' | 'notes';

type CreateContextLinkSource = 'none' | 'route' | 'auto' | 'manual';

type CreateContextEditorTab = 'patient' | 'appointment' | 'admission';

type PharmacyTimelineEvent = {
    id: string;
    label: string;
    detail: string;
    note: string | null;
    occurredAt: string | null;
    sortAt: number;
    variant: 'default' | 'secondary' | 'outline' | 'destructive';
    pending?: boolean;
};

type PharmacyWorkloadCardId =
    | 'preparation'
    | 'verification'
    | 'policy'
    | 'reconciliation';

type PharmacyWorkflowActionId =
    | 'policy'
    | 'preparation'
    | 'partial'
    | 'dispense'
    | 'verify'
    | 'reconciliation';

type PharmacyWorkflowActionButtonVariant =
    | 'default'
    | 'secondary'
    | 'outline'
    | 'destructive';

type PharmacyPrimaryWorkflowActionDefinition = {
    id: PharmacyWorkflowActionId;
    label: string;
    helper: string;
    buttonVariant: PharmacyWorkflowActionButtonVariant;
    surfaceVariant: PharmacyWorkflowActionButtonVariant;
};

type PharmacySupportingWorkflowActionDefinition = {
    id: PharmacyWorkflowActionId;
    title: string;
    helper: string;
    buttonLabel: string;
    buttonVariant: PharmacyWorkflowActionButtonVariant;
};

type PharmacyRowOverflowActionDefinition = {
    id: PharmacyWorkflowActionId | 'cancel';
    label: string;
    buttonVariant: PharmacyWorkflowActionButtonVariant;
    destructive?: boolean;
};

type PharmacyQueueRowActionState = {
    primary: PharmacyPrimaryWorkflowActionDefinition | null;
    overflow: PharmacyRowOverflowActionDefinition[];
};

type SearchForm = {
    q: string;
    patientId: string;
    status: string;
    from: string;
    to: string;
    sortBy: 'orderedAt' | 'orderNumber' | 'status' | 'updatedAt';
    sortDir: 'desc' | 'asc';
    perPage: number;
    page: number;
};

type CreateForm = {
    patientId: string;
    appointmentId: string;
    admissionId: string;
    approvedMedicineCatalogItemId: string;
    medicationCode: string;
    medicationName: string;
    dosageInstruction: string;
    clinicalIndication: string;
    quantityPrescribed: string | number;
    dispensingNotes: string;
};

type PharmacyOrderBasketItem = {
    clientKey: string;
    patientId: string;
    appointmentId: string;
    admissionId: string;
    approvedMedicineCatalogItemId: string;
    medicationCode: string;
    medicationName: string;
    dosageInstruction: string;
    clinicalIndication: string;
    quantityPrescribed: string;
    dispensingNotes: string;
};

type PharmacyCreateDraft = CreateForm & {
    basketItems: PharmacyOrderBasketItem[];
    serverDraftId: string;
};

type MedicationSafetyContinuationDecision = {
    acknowledged: boolean;
    overrideCode: string | null;
    overrideReason: string | null;
};

type PolicySubstitutionSelectionMode = 'approved' | 'outside_list';

type DetailsAuditLogsFilterForm = {
    q: string;
    action: string;
    actorType: string;
    actorId: string;
    from: string;
    to: string;
    perPage: number;
    page: number;
};

type DetailsAuditExportJobsFilterForm = {
    statusGroup: AuditExportStatusGroup;
    perPage: number;
    page: number;
};

type PharmacyAuditExportRetryHandoffContext = {
    targetOrderId: string;
    jobId: string;
    statusGroup: AuditExportStatusGroup;
    page: number;
    perPage: number;
    savedAt: string;
};

type PharmacyAuditExportRetryResumeTelemetry = {
    attempts: number;
    successes: number;
    failures: number;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastFailureAt: string | null;
    lastFailureReason: string | null;
};

type PharmacyAuditExportRetryResumeTelemetryEventContext = {
    targetResourceId: string;
    exportJobId: string;
    handoffStatusGroup: AuditExportStatusGroup;
    handoffPage: number;
    handoffPerPage: number;
};

type ClinicalCatalogItem = {
    id: string;
    code: string | null;
    name: string | null;
    category: string | null;
    unit: string | null;
    description: string | null;
    metadata: Record<string, unknown> | null;
    status: string | null;
};

type ClinicalCatalogItemListResponse = {
    data: ClinicalCatalogItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type InventoryItem = {
    id: string;
    itemCode: string | null;
    itemName: string | null;
    category: string | null;
    unit: string | null;
    currentStock: string | number | null;
    reorderLevel: string | number | null;
    maxStockLevel: string | number | null;
    status: string | null;
    stockState: 'out_of_stock' | 'low_stock' | 'healthy' | string | null;
    createdAt: string | null;
    updatedAt: string | null;
};

type InventoryItemListResponse = {
    data: InventoryItem[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

type PharmacyMedicationAvailabilityResponse = {
    data: InventoryItem | null;
};

type InventoryStockMovement = {
    id: string;
    itemId: string | null;
    movementType: string | null;
    adjustmentDirection: string | null;
    quantity: string | number | null;
    quantityDelta: string | number | null;
    stockBefore: string | number | null;
    stockAfter: string | number | null;
    reason: string | null;
    notes: string | null;
    metadata: Record<string, unknown> | null;
    occurredAt: string | null;
    createdAt: string | null;
    item: InventoryItem | null;
};

type InventoryStockMovementListResponse = {
    data: InventoryStockMovement[];
    meta: {
        currentPage: number;
        perPage: number;
        total: number;
        lastPage: number;
    };
};

const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Pharmacy Orders', href: '/pharmacy-orders' },
];

const pharmacyAuditActionOptions = [
    { value: 'pharmacy-order.created', label: 'Order Created' },
    { value: 'pharmacy-order.updated', label: 'Order Updated' },
    { value: 'pharmacy-order.status.updated', label: 'Status Updated' },
    { value: 'pharmacy-order.dispense.verified', label: 'Dispense Verified' },
] as const;
const STOCK_LEDGER_PREVIEW_COUNT = 3;

const pharmacyAuditActorTypeOptions = [
    { value: '', label: 'All' },
    { value: 'user', label: 'User' },
    { value: 'system', label: 'System' },
] as const;

const auditExportStatusGroupOptions: Array<{
    value: AuditExportStatusGroup;
    label: string;
}> = [
    { value: 'all', label: 'All Jobs' },
    { value: 'failed', label: 'Failed Only' },
    { value: 'backlog', label: 'Backlog (Queued/Processing)' },
    { value: 'completed', label: 'Completed Only' },
];

const pageLoading = ref(true);
const listLoading = ref(false);
const createLoading = ref(false);
const actionLoadingId = ref<string | null>(null);
const flashedOrderId = ref<string | null>(null);
let flashedOrderTimer: ReturnType<typeof setTimeout> | null = null;
const listErrors = ref<string[]>([]);
const actionMessage = ref<string | null>(null);
const createMessage = ref<string | null>(null);
const createServerDraftId = ref('');
const createErrors = ref<Record<string, string[]>>({});
const scope = ref<ScopeData | null>(null);
const orders = ref<PharmacyOrder[]>([]);
const pagination = ref<PharmacyOrderListResponse['meta'] | null>(null);
const pharmacyOrderStatusCounts = ref<PharmacyOrderStatusCounts | null>(null);
const patientDirectory = ref<Record<string, PatientSummary>>({});
const appointmentDirectory = ref<Record<string, AppointmentSummary>>({});
const admissionDirectory = ref<Record<string, AdmissionSummary>>({});
const canReadPharmacyOrders = ref(false);
const canCreatePharmacyOrders = ref(false);
const canReadApprovedMedicinesCatalog = ref(false);
const canReadInventoryProcurement = ref(false);
const canReadAppointments = ref(false);
const canReadAdmissions = ref(false);
const canReadMedicalRecords = ref(false);
const canReadLaboratoryOrders = ref(false);
const canReadTheatreProcedures = ref(false);
const canCreateTheatreProcedures = ref(false);
const canReadBillingInvoices = ref(false);
const canUpdatePharmacyOrderStatus = ref(false);
const canVerifyPharmacyDispense = ref(false);
const canUpdateServiceRequestStatus = ref(false);
const pharmacyWalkInPanelRef = ref<InstanceType<
    typeof WalkInServiceRequestsPanel
> | null>(null);
const isApprovedMedicinesCatalogReadPermissionResolved = ref(false);
const approvedMedicinesCatalogAccessDenied = ref(false);
const approvedMedicinesCatalogLoading = ref(false);
const approvedMedicinesCatalogError = ref<string | null>(null);
const approvedMedicinesCatalogItems = ref<ClinicalCatalogItem[]>([]);
const inventoryMedicationMatches = reactive<
    Record<string, InventoryItem | null | undefined>
>({});
const inventoryMedicationLoading = reactive<Record<string, boolean>>({});
const inventoryMedicationErrors = reactive<Record<string, string | null | undefined>>(
    {},
);
const createMedicationAvailabilityMatches = reactive<
    Record<string, InventoryItem | null | undefined>
>({});
const createMedicationAvailabilityLoading = reactive<Record<string, boolean>>({});
const createMedicationAvailabilityErrors = reactive<
    Record<string, string | null | undefined>
>({});
const inventoryStockMovementHistory = reactive<
    Record<string, InventoryStockMovement[] | undefined>
>({});
const inventoryStockMovementHistoryTotals = reactive<Record<string, number | undefined>>({});
const inventoryStockMovementHistoryLoading = reactive<Record<string, boolean>>({});
const inventoryStockMovementHistoryErrors = reactive<
    Record<string, string | null | undefined>
>({});
const canManagePharmacyPolicy = ref(false);
const canReconcilePharmacyOrders = ref(false);
const advancedFiltersSheetOpen = ref(false);
const mobileFiltersDrawerOpen = ref(false);
const compactQueueRows = useLocalStorageBoolean('opd.queueRows.compact', false);
const pharmacyQueueSearchInput = ref<HTMLInputElement | null>(null);
const pharmacyQueueCardRef = ref<HTMLElement | null>(null);
const pharmacyCreateCardRef = ref<HTMLElement | null>(null);
const detailsSheetOpen = ref(false);
const detailsSheetOrder = ref<PharmacyOrder | null>(null);
const detailsSheetTab = ref<DetailsSheetTab>('overview');
const detailsSheetOverviewTab = ref<DetailsSheetOverviewTab>('summary');
const detailsSheetAuditLogs = ref<PharmacyOrderAuditLog[]>([]);
const detailsSheetAuditLogsMeta = ref<PharmacyOrderAuditLogListResponse['meta'] | null>(
    null,
);
const detailsSheetAuditExportJobs = ref<PharmacyOrderAuditExportJob[]>([]);
const detailsSheetAuditExportJobsMeta = ref<PharmacyOrderAuditExportJobListResponse['meta'] | null>(
    null,
);
const detailsSheetAuditLogsLoading = ref(false);
const detailsSheetAuditLogsExporting = ref(false);
const detailsSheetAuditLogsError = ref<string | null>(null);
const detailsSheetAuditExportJobsLoading = ref(false);
const detailsSheetAuditExportJobsError = ref<string | null>(null);
const detailsSheetAuditExportRetryingJobId = ref<string | null>(null);
const detailsSheetAuditExportFocusJobId = ref<string | null>(null);
const detailsSheetAuditExportPinnedHandoffJob = ref<PharmacyOrderAuditExportJob | null>(
    null,
);
const detailsSheetAuditExportHandoffMessage = ref<string | null>(null);
const detailsSheetAuditExportHandoffError = ref(false);
const detailsSheetSafetyReview = ref<PharmacyOrderSafetyReview | null>(null);
const detailsSheetSafetyReviewLoading = ref(false);
const detailsSheetSafetyReviewError = ref<string | null>(null);
const detailsSheetAuditFiltersOpen = ref(false);
const detailsSheetAuditExpandedRows = reactive<Record<string, boolean>>({});
const detailsSheetAuditLogsFilters = reactive<DetailsAuditLogsFilterForm>({
    q: '',
    action: '',
    actorType: '',
    actorId: '',
    from: '',
    to: '',
    perPage: 20,
    page: 1,
});
const detailsSheetAuditExportJobsFilters = reactive<DetailsAuditExportJobsFilterForm>({
    statusGroup: 'all',
    perPage: 8,
    page: 1,
});
const canViewPharmacyOrderAuditLogs = ref(false);
const canOperatePharmacyWorkflow = computed(
    () =>
        canUpdatePharmacyOrderStatus.value ||
        canVerifyPharmacyDispense.value ||
        canManagePharmacyPolicy.value ||
        canReconcilePharmacyOrders.value,
);

const policyDialogOpen = ref(false);
const policyDialogOrder = ref<PharmacyOrder | null>(null);
const policyDialogError = ref<string | null>(null);
const policyDialogSafetyReview = ref<PharmacyOrderSafetyReview | null>(null);
const policyDialogSafetyReviewLoading = ref(false);
const policyDialogSafetyReviewError = ref<string | null>(null);
const policyDialogTab = ref<PolicyDialogTab>('decision');
const policyDialogForm = reactive({
    formularyDecisionStatus: 'not_reviewed',
    formularyDecisionReason: '',
    substitutionAllowed: false,
    substitutionMade: false,
    substitutionSelectionMode: 'approved' as PolicySubstitutionSelectionMode,
    substitutedMedicationCatalogItemId: '',
    substitutedMedicationCode: '',
    substitutedMedicationName: '',
    substitutionReason: '',
});

const reconciliationDialogOpen = ref(false);
const reconciliationDialogOrder = ref<PharmacyOrder | null>(null);
const reconciliationDialogError = ref<string | null>(null);
const reconciliationDialogTab = ref<ReconciliationDialogTab>('status');
const reconciliationDecisionOptions = [
    {
        value: 'add_to_current_list',
        label: 'Add to current medications',
        description: 'Use when the medicine should appear on the patient current medication list.',
    },
    {
        value: 'continue_on_current_list',
        label: 'Keep on current medications',
        description: 'Use when this order confirms an existing ongoing medicine should remain active.',
    },
    {
        value: 'short_course_only',
        label: 'Short course only',
        description: 'Use when the medicine was dispensed for this treatment only and should not stay on the ongoing list.',
    },
    {
        value: 'stop_from_current_list',
        label: 'Stop from current medications',
        description: 'Use when reconciliation confirms this medicine should be marked stopped on the ongoing list.',
    },
] as const;
const reconciliationDialogForm = reactive({
    reconciliationStatus: 'completed',
    reconciliationDecision: '',
    reconciliationNote: '',
});
const statusDialogOpen = ref(false);
const statusDialogOrder = ref<PharmacyOrder | null>(null);
const statusDialogAction = ref<PharmacyOrderStatusAction | null>(null);
const statusDialogReason = ref('');
const statusDialogQuantityDispensed = ref('');
const statusDialogDispensingNotes = ref('');
const statusDialogVerificationNote = ref('');
const statusDialogError = ref<string | null>(null);
const statusDialogSafetyReview = ref<PharmacyOrderSafetyReview | null>(null);
const statusDialogSafetyReviewLoading = ref(false);
const statusDialogSafetyReviewError = ref<string | null>(null);
const statusDialogVerifyPrescription = ref(true);
const statusDialogCounseledPatient = ref(false);
const statusDialogBatchLotNumber = ref('');
const statusDialogExpiryDate = ref('');
const statusDialogSubstitutionMade = ref(false);
const statusDialogSubstitutionNote = ref('');
const statusDialogFollowUpAdvice = ref('');
const lifecycleDialogOpen = ref(false);
const lifecycleDialogOrder = ref<PharmacyOrder | null>(null);
const lifecycleDialogAction = ref<'cancel' | 'discontinue' | 'entered_in_error' | null>(null);
const lifecycleDialogReason = ref('');
const lifecycleDialogError = ref<string | null>(null);
const pendingPatientLookupIds = new Set<string>();
const pendingAppointmentLookupIds = new Set<string>();
const pendingAdmissionLookupIds = new Set<string>();
let searchDebounceTimer: number | null = null;

const today = new Date().toISOString().slice(0, 10);

const searchForm = reactive<SearchForm>({
    q: queryParam('q'),
    patientId: queryParam('patientId'),
    status: queryParam('status'),
    from: queryDateParam('from', today),
    to: queryDateParam('to'),
    sortBy: 'orderedAt',
    sortDir: 'desc',
    perPage: 10,
    page: 1,
});

let queuePollingTimer: ReturnType<typeof setInterval> | null = null;
const QUEUE_POLL_INTERVAL_MS = 30_000;
const advancedFiltersDraft = reactive({
    patientId: searchForm.patientId,
    from: searchForm.from,
    to: searchForm.to,
});

watch(advancedFiltersSheetOpen, (open) => {
    if (!open) return;
    syncAdvancedFiltersDraftFromSearch();
});
const auditExportRetryHandoffJobId = queryParam('auditExportJobId');
const auditExportRetryHandoffAction = queryParam('auditAction').toLowerCase();
const auditExportRetryHandoffStatusGroup = parseAuditExportStatusGroup(
    queryParam('auditExportStatusGroup'),
);
const auditExportRetryHandoffPage = queryPositiveIntParam('auditExportPage', 1);
const auditExportRetryHandoffPerPage = queryPositiveIntParam(
    'auditExportPerPage',
    8,
    1,
    50,
);
const auditExportRetryHandoffPending = ref(
    auditExportRetryHandoffAction === 'retry' &&
        auditExportRetryHandoffJobId !== '',
);
const auditExportRetryHandoffCompletedMessage = ref<string | null>(null);
const pharmacyAuditExportRetryHandoffSessionKey =
    'opd.pharmacy.auditExportRetry.lastHandoff';
const pharmacyAuditExportRetryTelemetrySessionKey =
    'opd.pharmacy.auditExportRetry.resumeTelemetry';
const lastPharmacyAuditExportRetryHandoff = ref<PharmacyAuditExportRetryHandoffContext | null>(
    null,
);
const resumingPharmacyAuditExportRetryHandoff = ref(false);
const pharmacyAuditExportRetryResumeTelemetry = ref<PharmacyAuditExportRetryResumeTelemetry>(
    {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    },
);

function queryParam(name: string): string {
    if (typeof window === 'undefined') return '';
    return new URLSearchParams(window.location.search).get(name)?.trim() ?? '';
}

function queryDateParam(name: string, fallback = ''): string {
    const value = queryParam(name);
    return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}

function queryPositiveIntParam(
    name: string,
    fallback: number,
    min = 1,
    max = Number.POSITIVE_INFINITY,
): number {
    const raw = queryParam(name);
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed < min) return fallback;
    return Math.min(parsed, max);
}

function parseAuditExportStatusGroup(value: string): AuditExportStatusGroup {
    const normalized = value.toLowerCase();
    if (
        normalized === 'failed' ||
        normalized === 'backlog' ||
        normalized === 'completed'
    ) {
        return normalized;
    }
    return 'all';
}

function readPharmacyAuditExportRetryHandoffFromSession(): PharmacyAuditExportRetryHandoffContext | null {
    if (typeof window === 'undefined') return null;

    try {
        const raw = window.sessionStorage.getItem(
            pharmacyAuditExportRetryHandoffSessionKey,
        );
        if (!raw) return null;

        const parsed = JSON.parse(raw) as Partial<PharmacyAuditExportRetryHandoffContext>;
        if (!parsed || typeof parsed !== 'object') return null;
        if (!parsed.targetOrderId || !parsed.jobId) return null;

        return {
            targetOrderId: String(parsed.targetOrderId),
            jobId: String(parsed.jobId),
            statusGroup: parseAuditExportStatusGroup(String(parsed.statusGroup ?? 'all')),
            page: Math.max(Number(parsed.page) || 1, 1),
            perPage: Math.max(Math.min(Number(parsed.perPage) || 8, 50), 1),
            savedAt:
                typeof parsed.savedAt === 'string' && parsed.savedAt.trim() !== ''
                    ? parsed.savedAt
                    : new Date().toISOString(),
        };
    } catch {
        return null;
    }
}

function persistPharmacyAuditExportRetryHandoff(
    context: PharmacyAuditExportRetryHandoffContext,
) {
    if (typeof window === 'undefined') return;

    lastPharmacyAuditExportRetryHandoff.value = context;
    try {
        window.sessionStorage.setItem(
            pharmacyAuditExportRetryHandoffSessionKey,
            JSON.stringify(context),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function clearLastPharmacyAuditExportRetryHandoff() {
    lastPharmacyAuditExportRetryHandoff.value = null;
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.removeItem(pharmacyAuditExportRetryHandoffSessionKey);
    } catch {
        // Ignore storage cleanup failures.
    }
}

function readPharmacyAuditExportRetryResumeTelemetryFromSession(): PharmacyAuditExportRetryResumeTelemetry {
    if (typeof window === 'undefined') {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }

    try {
        const raw = window.sessionStorage.getItem(
            pharmacyAuditExportRetryTelemetrySessionKey,
        );
        if (!raw) {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        const parsed = JSON.parse(raw) as Partial<PharmacyAuditExportRetryResumeTelemetry>;
        if (!parsed || typeof parsed !== 'object') {
            return {
                attempts: 0,
                successes: 0,
                failures: 0,
                lastAttemptAt: null,
                lastSuccessAt: null,
                lastFailureAt: null,
                lastFailureReason: null,
            };
        }

        return {
            attempts: Math.max(Number(parsed.attempts) || 0, 0),
            successes: Math.max(Number(parsed.successes) || 0, 0),
            failures: Math.max(Number(parsed.failures) || 0, 0),
            lastAttemptAt:
                typeof parsed.lastAttemptAt === 'string'
                    ? parsed.lastAttemptAt
                    : null,
            lastSuccessAt:
                typeof parsed.lastSuccessAt === 'string'
                    ? parsed.lastSuccessAt
                    : null,
            lastFailureAt:
                typeof parsed.lastFailureAt === 'string'
                    ? parsed.lastFailureAt
                    : null,
            lastFailureReason:
                typeof parsed.lastFailureReason === 'string'
                    ? parsed.lastFailureReason
                    : null,
        };
    } catch {
        return {
            attempts: 0,
            successes: 0,
            failures: 0,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastFailureAt: null,
            lastFailureReason: null,
        };
    }
}

function persistPharmacyAuditExportRetryResumeTelemetry() {
    if (typeof window === 'undefined') return;

    try {
        window.sessionStorage.setItem(
            pharmacyAuditExportRetryTelemetrySessionKey,
            JSON.stringify(pharmacyAuditExportRetryResumeTelemetry.value),
        );
    } catch {
        // Ignore storage write failures and keep in-memory state.
    }
}

function publishPharmacyAuditExportRetryResumeTelemetryEvent(
    event: 'attempt' | 'success' | 'failure' | 'reset',
    failureReason?: string | null,
    context?: PharmacyAuditExportRetryResumeTelemetryEventContext | null,
) {
    void apiRequest('POST', '/platform/audit-export-jobs/retry-resume-telemetry/events', {
        body: {
            module: 'pharmacy',
            event,
            failureReason: failureReason ?? null,
            targetResourceId: context?.targetResourceId ?? null,
            exportJobId: context?.exportJobId ?? null,
            handoffStatusGroup: context?.handoffStatusGroup ?? null,
            handoffPage: context?.handoffPage ?? null,
            handoffPerPage: context?.handoffPerPage ?? null,
        },
    }).catch(() => {
        // Keep queue resume UX resilient if telemetry API is unavailable.
    });
}

function recordPharmacyAuditExportRetryResumeAttempt(
    context?: PharmacyAuditExportRetryResumeTelemetryEventContext | null,
) {
    pharmacyAuditExportRetryResumeTelemetry.value = {
        ...pharmacyAuditExportRetryResumeTelemetry.value,
        attempts: pharmacyAuditExportRetryResumeTelemetry.value.attempts + 1,
        lastAttemptAt: new Date().toISOString(),
    };
    persistPharmacyAuditExportRetryResumeTelemetry();
    publishPharmacyAuditExportRetryResumeTelemetryEvent('attempt', null, context);
}

function recordPharmacyAuditExportRetryResumeSuccess(
    context?: PharmacyAuditExportRetryResumeTelemetryEventContext | null,
) {
    pharmacyAuditExportRetryResumeTelemetry.value = {
        ...pharmacyAuditExportRetryResumeTelemetry.value,
        successes: pharmacyAuditExportRetryResumeTelemetry.value.successes + 1,
        lastSuccessAt: new Date().toISOString(),
        lastFailureReason: null,
    };
    persistPharmacyAuditExportRetryResumeTelemetry();
    publishPharmacyAuditExportRetryResumeTelemetryEvent('success', null, context);
}

function recordPharmacyAuditExportRetryResumeFailure(
    reason: string,
    context?: PharmacyAuditExportRetryResumeTelemetryEventContext | null,
) {
    pharmacyAuditExportRetryResumeTelemetry.value = {
        ...pharmacyAuditExportRetryResumeTelemetry.value,
        failures: pharmacyAuditExportRetryResumeTelemetry.value.failures + 1,
        lastFailureAt: new Date().toISOString(),
        lastFailureReason: reason,
    };
    persistPharmacyAuditExportRetryResumeTelemetry();
    publishPharmacyAuditExportRetryResumeTelemetryEvent('failure', reason, context);
}

function resetPharmacyAuditExportRetryResumeTelemetry() {
    pharmacyAuditExportRetryResumeTelemetry.value = {
        attempts: 0,
        successes: 0,
        failures: 0,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        lastFailureReason: null,
    };
    persistPharmacyAuditExportRetryResumeTelemetry();
    publishPharmacyAuditExportRetryResumeTelemetryEvent('reset');
}

lastPharmacyAuditExportRetryHandoff.value =
    readPharmacyAuditExportRetryHandoffFromSession();
pharmacyAuditExportRetryResumeTelemetry.value =
    readPharmacyAuditExportRetryResumeTelemetryFromSession();

const createForm = reactive<CreateForm>({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
    approvedMedicineCatalogItemId: '',
    medicationCode: '',
    medicationName: '',
    dosageInstruction: '',
    clinicalIndication: '',
    quantityPrescribed: '1',
    dispensingNotes: '',
});
const initialCreateRouteContext = Object.freeze({
    patientId: queryParam('patientId'),
    appointmentId: queryParam('appointmentId'),
    admissionId: queryParam('admissionId'),
});
const createLifecycleReplaceOrderId = ref(queryParam('reorderOfId'));
const createLifecycleAddOnOrderId = ref(queryParam('addOnToOrderId'));
const hasInitialCreateLifecycleQuery = Boolean(
    createLifecycleReplaceOrderId.value.trim() ||
    createLifecycleAddOnOrderId.value.trim(),
);
const createLifecycleSourceOrder = ref<PharmacyOrder | null>(null);
const createLifecycleSourceLoading = ref(false);
const createLifecycleSourceError = ref<string | null>(null);
const PHARMACY_CREATE_DRAFT_STORAGE_KEY =
    'ahs.pharmacy-orders.create-draft.v4';
const createOrderBasket = ref<PharmacyOrderBasketItem[]>([]);
let createOrderBasketItemCounter = 0;
const createMedicationSafetySummary = ref<PatientMedicationSafetySummary | null>(null);
const createMedicationSafetyLoading = ref(false);
const createMedicationSafetyError = ref<string | null>(null);
const createMedicationSafetyReviewDialogOpen = ref(false);
const createMedicationSafetyReviewSummary = ref<PatientMedicationSafetySummary | null>(null);
const createMedicationSafetyReviewTitle = ref('Medication safety review');
const createMedicationSafetyReviewContextLabel = ref('this medicine');
const createMedicationSafetyReviewTab = ref<CreateMedicationSafetyReviewTab>('summary');
const createMedicationSafetyReviewAcknowledged = ref(false);
const createMedicationSafetyReviewOverrideCode = ref('');
const createMedicationSafetyReviewOverrideReason = ref('');
const createMedicationSafetyReviewError = ref<string | null>(null);
let createMedicationSafetyRequestId = 0;
let createMedicationSafetyReviewResolver:
    | ((decision: MedicationSafetyContinuationDecision | null) => void)
    | null = null;

function normalizeCreateQuantityInput(
    value: string | number | null | undefined,
): string {
    return String(value ?? '').trim();
}

function isPharmacyOrderEnteredInError(order: PharmacyOrder | null): boolean {
    if (!order) return false;

    return Boolean(
        order.enteredInErrorAt
        || order.lifecycleReasonCode === 'entered_in_error',
    );
}

function canApplyPharmacyLifecycleAction(
    order: PharmacyOrder | null,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
): boolean {
    if (!order || !canCreatePharmacyOrders.value || isPharmacyOrderEnteredInError(order)) {
        return false;
    }

    const quantityDispensed = Number(order.quantityDispensed ?? 0);

    if (action === 'cancel') {
        return order.status !== 'cancelled'
            && order.status !== 'dispensed'
            && quantityDispensed <= 0;
    }

    if (action === 'discontinue') {
        return order.status !== 'cancelled' && order.status !== 'dispensed';
    }

    return true;
}

function canCreatePharmacyFollowOnOrder(order: PharmacyOrder | null): boolean {
    return Boolean(
        order
        && canCreatePharmacyOrders.value
        && order.patientId?.trim()
        && !isPharmacyOrderEnteredInError(order),
    );
}

function openPharmacyLifecycleDialog(
    order: PharmacyOrder,
    action: 'cancel' | 'discontinue' | 'entered_in_error',
): void {
    lifecycleDialogOrder.value = order;
    lifecycleDialogAction.value = action;
    lifecycleDialogReason.value =
        action === 'cancel' ? (order.statusReason ?? '') : '';
    lifecycleDialogError.value = null;
    lifecycleDialogOpen.value = true;
}

function closePharmacyLifecycleDialog(): void {
    lifecycleDialogOpen.value = false;
    lifecycleDialogOrder.value = null;
    lifecycleDialogAction.value = null;
    lifecycleDialogReason.value = '';
    lifecycleDialogError.value = null;
}

async function submitPharmacyLifecycleDialog(): Promise<void> {
    if (!lifecycleDialogOrder.value || !lifecycleDialogAction.value) return;

    const reason = lifecycleDialogReason.value.trim();
    if (!reason) {
        lifecycleDialogError.value = 'Clinical reason is required.';
        return;
    }

    lifecycleDialogError.value = null;
    actionLoadingId.value = lifecycleDialogOrder.value.id;

    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'POST',
            `/pharmacy-orders/${lifecycleDialogOrder.value.id}/lifecycle`,
            {
                body: {
                    action: lifecycleDialogAction.value,
                    reason,
                },
            },
        );

        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
        }
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }

        notifySuccess(
            lifecycleDialogAction.value === 'cancel'
                ? 'Pharmacy order cancelled.'
                : lifecycleDialogAction.value === 'discontinue'
                    ? 'Pharmacy order discontinued.'
                    : 'Pharmacy order marked entered in error.',
        );
        flashOrder(lifecycleDialogOrder.value.id);
        closePharmacyLifecycleDialog();
    } catch (error) {
        lifecycleDialogError.value = messageFromUnknown(
            error,
            'Unable to apply the lifecycle action.',
        );
        notifyError(lifecycleDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

function pharmacyCreateDraftMatchesInitialContext(
    draft: Pick<PharmacyCreateDraft, 'patientId' | 'appointmentId' | 'admissionId'>,
): boolean {
    if (
        initialCreateRouteContext.patientId
        && draft.patientId.trim() !== initialCreateRouteContext.patientId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.appointmentId
        && draft.appointmentId.trim() !== initialCreateRouteContext.appointmentId
    ) {
        return false;
    }

    if (
        initialCreateRouteContext.admissionId
        && draft.admissionId.trim() !== initialCreateRouteContext.admissionId
    ) {
        return false;
    }

    return true;
}

function contextCreateHref(path: string, options?: { includeTabNew?: boolean }) {
    const params = new URLSearchParams();
    const recordId = queryParam('recordId');

    if (path === '/medical-records' && recordId) {
        params.set('recordId', recordId);
    } else if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    const patientId = createForm.patientId.trim();
    const appointmentId = createForm.appointmentId.trim();
    const admissionId = createForm.admissionId.trim();

    if (patientId) params.set('patientId', patientId);
    if (appointmentId) params.set('appointmentId', appointmentId);
    if (admissionId) params.set('admissionId', admissionId);
    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const hasCreateMedicalRecordContext = computed(
    () => queryParam('recordId') !== '',
);

const consultationContextHref = computed(() =>
    contextCreateHref('/medical-records', {
        includeTabNew: true,
    }),
);

const consultationReturnLabel = computed(() =>
    hasCreateMedicalRecordContext.value
        ? 'Back to Current Consultation'
        : 'Back to Consultation',
);

function orderDetailsWorkflowHref(
    path: string,
    order: PharmacyOrder,
    options?: {
        includeTabNew?: boolean;
        focusAppointmentOnReturn?: boolean;
        reorderOfId?: string | null;
        addOnToOrderId?: string | null;
    },
) {
    const params = new URLSearchParams();
    const recordId = queryParam('recordId');

    if (path === '/medical-records' && recordId) {
        params.set('recordId', recordId);
    } else if (options?.includeTabNew) {
        params.set('tab', 'new');
    }

    const patientId = order.patientId?.trim() ?? '';
    const appointmentId = order.appointmentId?.trim() ?? '';
    const admissionId = order.admissionId?.trim() ?? '';

    if (patientId) params.set('patientId', patientId);
    if (admissionId) params.set('admissionId', admissionId);

    if (options?.focusAppointmentOnReturn) {
        if (appointmentId) params.set('focusAppointmentId', appointmentId);
    } else if (appointmentId) {
        params.set('appointmentId', appointmentId);
    }
    if (options?.reorderOfId?.trim()) {
        params.set('reorderOfId', options.reorderOfId.trim());
    }
    if (options?.addOnToOrderId?.trim()) {
        params.set('addOnToOrderId', options.addOnToOrderId.trim());
    }
    if (path === '/billing-invoices') {
        params.set('sourceWorkflowKind', 'pharmacy_order');
        params.set('sourceWorkflowId', order.id);
        const label =
            order.orderNumber?.trim()
            || order.medicationName?.trim()
            || order.medicationCode?.trim()
            || 'Pharmacy order';
        params.set('sourceWorkflowLabel', label);
    }
    if (recordId && path !== '/medical-records') params.set('recordId', recordId);
    if (openedFromPatientChart) params.set('from', 'patient-chart');

    const queryString = params.toString();
    return queryString ? `${path}?${queryString}` : path;
}

const PHARMACY_CREATE_LEAVE_TITLE = 'Leave pharmacy order?';
const PHARMACY_CREATE_LEAVE_DESCRIPTION = 'Pharmacy order entry is still in progress. Stay here to finish the request, or leave this page and restart it later.';
const hasPendingCreateWorkflow = computed(() => Boolean(
    createServerDraftId.value.trim() ||
    createOrderBasket.value.length > 0 ||
    createForm.approvedMedicineCatalogItemId.trim()
    || createForm.medicationCode.trim()
    || createForm.medicationName.trim()
    || createForm.dosageInstruction.trim()
    || createForm.clinicalIndication.trim()
    || createForm.dispensingNotes.trim()
    || normalizeCreateQuantityInput(createForm.quantityPrescribed) !== '1',
));
const {
    confirmOpen: createLeaveConfirmOpen,
    confirmLeave: confirmPendingCreateWorkflowLeave,
    cancelLeave: cancelPendingCreateWorkflowLeave,
} = usePendingWorkflowLeaveGuard({
    shouldBlock: hasPendingCreateWorkflow,
    isSubmitting: createLoading,
    blockBrowserUnload: false,
});
const {
    confirmationDialogState: duplicateConfirmDialogState,
    requestConfirmation: requestDuplicateConfirmation,
    updateConfirmationDialogOpen: updateDuplicateConfirmationDialogOpen,
    confirmDialogAction: confirmDuplicateDialogAction,
} = useConfirmationDialog();

const openedFromPatientChart = queryParam('from') === 'patient-chart';
const openedFromAppointments = queryParam('from') === 'appointments';
const patientChartQueueRouteContext = Object.freeze({
    patientId: initialCreateRouteContext.patientId.trim(),
    appointmentId: initialCreateRouteContext.appointmentId.trim(),
    admissionId: initialCreateRouteContext.admissionId.trim(),
});
const patientChartQueueFocusLocked = ref(
    openedFromPatientChart && patientChartQueueRouteContext.patientId !== '',
);
const createPatientChartHref = computed(() => patientChartHref(createForm.patientId.trim(), {
    tab: 'orders',
    appointmentId: createForm.appointmentId.trim() || null,
    admissionId: createForm.admissionId.trim() || null,
}));
const patientChartQueueReturnHref = computed(() => {
    if (!openedFromPatientChart || !patientChartQueueRouteContext.patientId) {
        return null;
    }

    return patientChartHref(patientChartQueueRouteContext.patientId, {
        tab: 'orders',
        appointmentId: patientChartQueueRouteContext.appointmentId || null,
        admissionId: patientChartQueueRouteContext.admissionId || null,
    });
});
const isPatientChartQueueFocusApplied = computed(() =>
    patientChartQueueFocusLocked.value &&
    patientChartQueueRouteContext.patientId !== '' &&
    searchForm.patientId.trim() === patientChartQueueRouteContext.patientId,
);

const openedFromClinicalContext = computed(
    () =>
        createForm.patientId.trim() !== '' &&
        (
            createForm.appointmentId.trim() !== '' ||
            createForm.admissionId.trim() !== '' ||
            hasCreateMedicalRecordContext.value ||
            openedFromPatientChart ||
            openedFromAppointments
        ),
);
function parsePharmacyWorkspaceView(value: string): PharmacyWorkspaceView {
    return value.toLowerCase() === 'new' ? 'new' : 'queue';
}
const initialPharmacyWorkspaceView =
    queryParam('tab').toLowerCase() === 'queue'
        ? 'queue'
        : queryParam('tab').toLowerCase() === 'new'
          ? 'new'
          : 'queue';
const createPatientContextLocked = ref(openedFromClinicalContext.value);
const pharmacyWorkspaceView = ref<PharmacyWorkspaceView>(
    parsePharmacyWorkspaceView(initialPharmacyWorkspaceView),
);
const createContextEditorTab = ref<CreateContextEditorTab>(
    !createForm.patientId.trim()
        ? 'patient'
        : createForm.admissionId.trim()
          ? 'admission'
          : createForm.appointmentId.trim()
            ? 'appointment'
            : 'patient',
);
const createContextDialogOpen = ref(false);
const createContextDialogInitialSelection = reactive({
    patientId: createForm.patientId.trim(),
    appointmentId: createForm.appointmentId.trim(),
    admissionId: createForm.admissionId.trim(),
});
const {
    clearPersistedDraft: clearPersistedPharmacyCreateDraft,
} = useWorkflowDraftPersistence<PharmacyCreateDraft>({
    key: PHARMACY_CREATE_DRAFT_STORAGE_KEY,
    shouldPersist: hasPendingCreateWorkflow,
    capture: () => ({
        patientId: createForm.patientId,
        appointmentId: createForm.appointmentId,
        admissionId: createForm.admissionId,
        serverDraftId: createServerDraftId.value,
        approvedMedicineCatalogItemId: createForm.approvedMedicineCatalogItemId,
        medicationCode: createForm.medicationCode,
        medicationName: createForm.medicationName,
        dosageInstruction: createForm.dosageInstruction,
        clinicalIndication: createForm.clinicalIndication,
        quantityPrescribed: normalizeCreateQuantityInput(
            createForm.quantityPrescribed,
        ),
        dispensingNotes: createForm.dispensingNotes,
        basketItems: createOrderBasket.value.map((item) => ({ ...item })),
    }),
    restore: (draft) => {
        createForm.patientId = draft.patientId;
        createForm.appointmentId = draft.appointmentId;
        createForm.admissionId = draft.admissionId;
        createServerDraftId.value = draft.serverDraftId?.trim?.() ?? '';
        createForm.approvedMedicineCatalogItemId =
            draft.approvedMedicineCatalogItemId;
        createForm.medicationCode = draft.medicationCode;
        createForm.medicationName = draft.medicationName;
        createForm.dosageInstruction = draft.dosageInstruction;
        createForm.clinicalIndication = draft.clinicalIndication ?? '';
        createForm.quantityPrescribed = draft.quantityPrescribed;
        createForm.dispensingNotes = draft.dispensingNotes;
        createOrderBasket.value = Array.isArray(draft.basketItems)
            ? draft.basketItems.map((item) => ({ ...item }))
            : [];
        createOrderBasketItemCounter = createOrderBasket.value.length;
    },
    canRestore: (draft) =>
        !hasInitialCreateLifecycleQuery &&
        pharmacyCreateDraftMatchesInitialContext(draft),
    onRestored: () => {
        const basketCount = createOrderBasket.value.length;
        if (createServerDraftId.value) {
            createMessage.value =
                'Restored your saved pharmacy draft on this device.';
        } else {
            createMessage.value = basketCount > 0
                ? `Restored your in-progress pharmacy basket (${basketCount} ${basketCount === 1 ? 'medicine' : 'medicines'}) on this device.`
                : 'Restored your in-progress pharmacy order draft on this device.';
        }
        setPharmacyWorkspaceView('new');
    },
});
const createAppointmentSummary = ref<AppointmentSummary | null>(null);
const createAppointmentSummaryLoading = ref(false);
const createAppointmentSummaryError = ref<string | null>(null);
const createAdmissionSummary = ref<AdmissionSummary | null>(null);
const createAdmissionSummaryLoading = ref(false);
const createAdmissionSummaryError = ref<string | null>(null);
const createAppointmentSuggestions = ref<AppointmentSummary[]>([]);
const createAdmissionSuggestions = ref<AdmissionSummary[]>([]);
const createAppointmentSuggestionsLoading = ref(false);
const createAdmissionSuggestionsLoading = ref(false);
const createAppointmentSuggestionsError = ref<string | null>(null);
const createAdmissionSuggestionsError = ref<string | null>(null);
const createAppointmentLinkSource = ref<CreateContextLinkSource>(
    createForm.appointmentId.trim() ? 'route' : 'none',
);
const createAdmissionLinkSource = ref<CreateContextLinkSource>(
    createForm.admissionId.trim() ? 'route' : 'none',
);
const createContextAutoLinkSuppressed = reactive({
    appointment: false,
    admission: false,
});
let createAppointmentSummaryRequestId = 0;
let createAdmissionSummaryRequestId = 0;
let createContextSuggestionsRequestId = 0;
let pendingCreateAppointmentLinkSource: CreateContextLinkSource | null = null;
let pendingCreateAdmissionLinkSource: CreateContextLinkSource | null = null;

if (createForm.patientId.trim()) {
    searchForm.patientId = createForm.patientId.trim();
    void hydratePatientSummary(createForm.patientId);
}

function csrfToken(): string | null {
    const element = document.querySelector<HTMLMetaElement>(
        'meta[name="csrf-token"]',
    );
    return element?.content ?? null;
}

async function apiRequest<T>(
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    options?: {
        query?: Record<string, string | number | null | undefined>;
        body?: Record<string, unknown>;
    },
): Promise<T> {
    const url = new URL(`/api/v1${path}`, window.location.origin);

    Object.entries(options?.query ?? {}).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return;
        url.searchParams.set(key, String(value));
    });

    const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    };

    let body: string | undefined;
    if (method !== 'GET') {
        headers['Content-Type'] = 'application/json';
        const token = csrfToken();
        if (token) headers['X-CSRF-TOKEN'] = token;
        body = JSON.stringify(options?.body ?? {});
    }

    const response = await fetch(url.toString(), {
        method,
        credentials: 'same-origin',
        headers,
        body,
    });

    const payload = (await response
        .json()
        .catch(() => ({}))) as ValidationErrorResponse;

    if (!response.ok) {
        const error = new Error(
            payload.message ?? `${response.status} ${response.statusText}`,
        ) as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        error.status = response.status;
        error.payload = payload;
        throw error;
    }

    return payload as T;
}

function clearSearchDebounce() {
    if (searchDebounceTimer !== null) {
        window.clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }
}

function createFieldError(key: string): string | null {
    return createErrors.value[key]?.[0] ?? null;
}

const hasCreateErrorFeedback = computed(
    () => Object.keys(createErrors.value).length > 0,
);

const hasCreateFeedback = computed(
    () => Boolean(createMessage.value) || hasCreateErrorFeedback.value,
);

const createErrorSummary = computed(() => {
    for (const messages of Object.values(createErrors.value)) {
        const firstMessage = messages?.[0]?.trim();
        if (firstMessage) return firstMessage;
    }

    return null;
});

function resetCreateMessages() {
    createMessage.value = null;
    createErrors.value = {};
}

function nextCreateOrderBasketItemKey(): string {
    createOrderBasketItemCounter += 1;
    return `pharmacy-create-basket-${createOrderBasketItemCounter}`;
}

function resetCreateOrderDraftFields() {
    createForm.approvedMedicineCatalogItemId = '';
    clearCreateApprovedMedicineDerivedFields();
    createForm.dosageInstruction = '';
    createForm.clinicalIndication = '';
    createForm.quantityPrescribed = '1';
    createForm.dispensingNotes = '';
}

function discardCurrentCreateOrderDraft() {
    resetCreateMessages();
    resetCreateOrderDraftFields();
}

function restoreCreateOrderDraftFromBasketItem(
    item: PharmacyOrderBasketItem,
): void {
    createForm.patientId = item.patientId;
    createForm.appointmentId = item.appointmentId;
    createForm.admissionId = item.admissionId;
    createForm.approvedMedicineCatalogItemId = item.approvedMedicineCatalogItemId;
    createForm.medicationCode = item.medicationCode;
    createForm.medicationName = item.medicationName;
    createForm.dosageInstruction = item.dosageInstruction;
    createForm.clinicalIndication = item.clinicalIndication;
    createForm.quantityPrescribed = item.quantityPrescribed;
    createForm.dispensingNotes = item.dispensingNotes;
}

function formatCreateLifecycleSourceOrderLabel(
    order: PharmacyOrder | null,
): string {
    if (!order) return 'the selected pharmacy order';

    const orderNumber = order.orderNumber?.trim();
    const medicationLabel =
        order.medicationName?.trim() || order.medicationCode?.trim();

    if (orderNumber && medicationLabel) {
        return `${orderNumber} (${medicationLabel})`;
    }

    return orderNumber || medicationLabel || 'the selected pharmacy order';
}

const createLifecycleSourceOrderId = computed(() =>
    createLifecycleReplaceOrderId.value.trim() ||
    createLifecycleAddOnOrderId.value.trim(),
);
const createLifecycleMode = computed<'reorder' | 'add_on' | null>(() => {
    if (createLifecycleReplaceOrderId.value.trim()) {
        return 'reorder';
    }

    if (createLifecycleAddOnOrderId.value.trim()) {
        return 'add_on';
    }

    return null;
});
const hasCreateLifecycleMode = computed(
    () => createLifecycleMode.value !== null,
);
const canUseCreateOrderBasket = computed(
    () => !hasCreateLifecycleMode.value,
);
const createLifecycleSourceOrderLabel = computed(() =>
    formatCreateLifecycleSourceOrderLabel(createLifecycleSourceOrder.value),
);
const createLifecycleAlertTitle = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Replacement medication order in progress';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Linked medication follow-up in progress';
    }

    return 'Medication follow-up in progress';
});
const createLifecycleAlertDescription = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return `This new medication order will replace ${createLifecycleSourceOrderLabel.value}. The original order remains in the chart history for audit.`;
    }

    if (createLifecycleMode.value === 'add_on') {
        return `This new medication order will be recorded as a linked follow-up to ${createLifecycleSourceOrderLabel.value}.`;
    }

    return '';
});
const createLifecycleClearActionLabel = computed(() => {
    if (createLifecycleMode.value === 'reorder') {
        return 'Start a new pharmacy order';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Start a new independent order';
    }

    return 'Clear follow-up mode';
});

function syncCreateLifecycleRouteState(): void {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const replaceOrderId = createLifecycleReplaceOrderId.value.trim();
    const addOnOrderId = createLifecycleAddOnOrderId.value.trim();

    if (replaceOrderId) {
        url.searchParams.set('reorderOfId', replaceOrderId);
    } else {
        url.searchParams.delete('reorderOfId');
    }

    if (addOnOrderId) {
        url.searchParams.set('addOnToOrderId', addOnOrderId);
    } else {
        url.searchParams.delete('addOnToOrderId');
    }

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function clearCreateLifecycleMode(): void {
    createLifecycleReplaceOrderId.value = '';
    createLifecycleAddOnOrderId.value = '';
    createLifecycleSourceOrder.value = null;
    createLifecycleSourceError.value = null;
    createLifecycleSourceLoading.value = false;
    syncCreateLifecycleRouteState();
}

function applyCreateLifecycleSourceOrder(order: PharmacyOrder): void {
    createOrderBasket.value = [];
    clearPersistedPharmacyCreateDraft();
    resetCreateMessages();
    createServerDraftId.value = '';

    createForm.patientId = order.patientId?.trim() ?? '';
    createForm.appointmentId = order.appointmentId?.trim() ?? '';
    createForm.admissionId = order.admissionId?.trim() ?? '';
    createForm.approvedMedicineCatalogItemId =
        order.approvedMedicineCatalogItemId?.trim() ?? '';
    createForm.medicationCode = order.medicationCode?.trim() ?? '';
    createForm.medicationName = order.medicationName?.trim() ?? '';
    createForm.dosageInstruction = order.dosageInstruction?.trim() ?? '';
    createForm.clinicalIndication = order.clinicalIndication?.trim() ?? '';
    createForm.quantityPrescribed = normalizeCreateQuantityInput(
        order.quantityPrescribed,
    ) || '1';
    createForm.dispensingNotes = order.dispensingNotes?.trim() ?? '';
    createPatientContextLocked.value = Boolean(
        createForm.patientId.trim() &&
        (
            createForm.appointmentId.trim() ||
            createForm.admissionId.trim()
        ),
    );

    if (createForm.approvedMedicineCatalogItemId.trim()) {
        syncCreateApprovedMedicineSelection();
    }

    void ensureCreateMedicationAvailabilityMatch(
        createForm.medicationCode,
        createForm.medicationName,
        { force: true },
    );
    setPharmacyWorkspaceView('new');
}

async function loadCreateLifecycleSourceOrder(): Promise<void> {
    const sourceOrderId = createLifecycleSourceOrderId.value.trim();

    if (!sourceOrderId) {
        createLifecycleSourceOrder.value = null;
        createLifecycleSourceError.value = null;
        createLifecycleSourceLoading.value = false;
        return;
    }

    createLifecycleSourceLoading.value = true;
    createLifecycleSourceError.value = null;
    createOrderBasket.value = [];
    clearPersistedPharmacyCreateDraft();
    setPharmacyWorkspaceView('new');

    try {
        await loadApprovedMedicinesCatalog();

        const response = await apiRequest<{ data: PharmacyOrder }>(
            'GET',
            `/pharmacy-orders/${sourceOrderId}`,
        );
        createLifecycleSourceOrder.value = response.data;
        applyCreateLifecycleSourceOrder(response.data);
    } catch (error) {
        createLifecycleSourceOrder.value = null;
        createLifecycleSourceError.value = messageFromUnknown(
            error,
            'Unable to load the source pharmacy order for this follow-up action.',
        );
    } finally {
        createLifecycleSourceLoading.value = false;
    }
}

function clinicalCatalogMetadataText(
    catalogItem: ClinicalCatalogItem | null,
    keys: string[],
): string | null {
    const metadata = catalogItem?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return null;
    }

    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === 'string' && value.trim() !== '') {
            return value.trim();
        }
    }

    return null;
}

function clinicalCatalogMetadataStringList(
    catalogItem: ClinicalCatalogItem | null,
    keys: string[],
): string[] {
    const metadata = catalogItem?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return [];
    }

    for (const key of keys) {
        const value = metadata[key];
        if (Array.isArray(value)) {
            return value
                .map((item) =>
                    typeof item === 'string' ? item.trim() : String(item).trim(),
                )
                .filter((item) => item.length > 0);
        }

        if (typeof value === 'string' && value.trim() !== '') {
            return value
                .split(',')
                .map((item) => item.trim())
                .filter((item) => item.length > 0);
        }
    }

    return [];
}

function clinicalCatalogMetadataBoolean(
    catalogItem: ClinicalCatalogItem | null,
    keys: string[],
): boolean {
    const metadata = catalogItem?.metadata;
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
        return false;
    }

    for (const key of keys) {
        const value = metadata[key];
        if (typeof value === 'boolean') {
            return value;
        }

        if (typeof value === 'string') {
            const normalized = value.trim().toLowerCase();
            if (['true', '1', 'yes'].includes(normalized)) return true;
            if (['false', '0', 'no'].includes(normalized)) return false;
        }
    }

    return false;
}

function approvedMedicineGovernanceProfile(catalogItem: ClinicalCatalogItem | null): {
    reviewMode: 'auto_formulary' | 'policy_review_required';
    formularyLabel: string;
    restrictionNote: string | null;
    substitutionAllowed: boolean;
    indicationKeywords: string[];
    preferredAlternatives: string[];
} {
    const reviewMode =
        clinicalCatalogMetadataText(catalogItem, [
            'reviewMode',
            'review_mode',
            'policyReviewMode',
            'policy_review_mode',
        ]) ?? 'auto_formulary';
    const formularyStatus =
        clinicalCatalogMetadataText(catalogItem, [
            'formularyStatus',
            'formulary_status',
            'formularyClassification',
            'formulary_classification',
        ]) ?? 'formulary';

    const requiresPolicyReview =
        reviewMode === 'policy_review_required' ||
        reviewMode === 'restricted' ||
        formularyStatus === 'restricted' ||
        formularyStatus === 'requires_review';

    return {
        reviewMode: requiresPolicyReview
            ? 'policy_review_required'
            : 'auto_formulary',
        formularyLabel: requiresPolicyReview
            ? 'Restricted review'
            : 'Formulary',
        restrictionNote: clinicalCatalogMetadataText(catalogItem, [
            'restrictionReason',
            'restriction_reason',
            'policyNote',
            'policy_note',
        ]),
        substitutionAllowed: clinicalCatalogMetadataBoolean(catalogItem, [
            'substitutionAllowed',
            'substitution_allowed',
        ]),
        indicationKeywords: clinicalCatalogMetadataStringList(catalogItem, [
            'indicationKeywords',
            'indication_keywords',
            'allowedIndicationKeywords',
            'allowed_indication_keywords',
        ]),
        preferredAlternatives: clinicalCatalogMetadataStringList(catalogItem, [
            'preferredAlternatives',
            'preferred_alternatives',
        ]),
    };
}

function approvedMedicineStrength(
    catalogItem: ClinicalCatalogItem | null,
): string | null {
    return clinicalCatalogMetadataText(catalogItem, [
        'strength',
        'strengthLabel',
        'strength_label',
    ]);
}

function approvedMedicineDosageForm(
    catalogItem: ClinicalCatalogItem | null,
): string | null {
    return clinicalCatalogMetadataText(catalogItem, [
        'dosageForm',
        'dosage_form',
        'form',
    ]);
}

function normalizeCatalogText(value: string | null | undefined): string {
    return (value ?? '').trim().toLowerCase();
}

function approvedMedicineDisplayUnitLabel(
    catalogItem: ClinicalCatalogItem | null,
): string | null {
    const unit = catalogItem?.unit?.trim();
    const unitLabel = unit ? formatEnumLabel(unit) : null;
    const dosageFormLabel = approvedMedicineDosageForm(catalogItem)
        ?.trim()
        .toLowerCase();

    if (
        unitLabel &&
        dosageFormLabel &&
        unitLabel.trim().toLowerCase() === dosageFormLabel
    ) {
        return null;
    }

    return unitLabel;
}

function findApprovedMedicineCatalogItem(
    code: string | null | undefined,
    name: string | null | undefined,
): ClinicalCatalogItem | null {
    const normalizedCode = normalizeCatalogText(code);
    const normalizedName = normalizeCatalogText(name);

    if (!normalizedCode && !normalizedName) {
        return null;
    }

    return (
        approvedMedicinesCatalogItems.value.find((item) => {
            const itemCode = normalizeCatalogText(item.code);
            const itemName = normalizeCatalogText(item.name);

            return (
                (normalizedCode && itemCode === normalizedCode) ||
                (normalizedName && itemName === normalizedName)
            );
        }) ?? null
    );
}

function inventoryMedicationLookupKey(
    code: string | null | undefined,
    name: string | null | undefined,
): string | null {
    const normalizedCode = normalizeCatalogText(code);
    const normalizedName = normalizeCatalogText(name);

    if (!normalizedCode && !normalizedName) {
        return null;
    }

    return `${normalizedCode}|${normalizedName}`;
}

function inventoryItemMatchScore(
    item: InventoryItem,
    code: string | null | undefined,
    name: string | null | undefined,
): number {
    const itemCode = normalizeCatalogText(item.itemCode);
    const itemName = normalizeCatalogText(item.itemName);
    const requestedCode = normalizeCatalogText(code);
    const requestedName = normalizeCatalogText(name);

    let score = 0;

    if (requestedCode) {
        if (itemCode === requestedCode) {
            score = Math.max(score, 700);
        } else if (itemCode.endsWith(`-${requestedCode}`)) {
            score = Math.max(score, 560);
        } else if (itemCode.includes(requestedCode)) {
            score = Math.max(score, 460);
        }
    }

    if (requestedName) {
        if (itemName === requestedName) {
            score = Math.max(score, 640);
        } else if (itemName.includes(requestedName) || requestedName.includes(itemName)) {
            score = Math.max(score, 420);
        }
    }

    return score;
}

function resolveInventoryMedicationMatch(
    items: InventoryItem[],
    code: string | null | undefined,
    name: string | null | undefined,
): InventoryItem | null {
    return (
        [...items]
            .map((item) => ({
                item,
                score: inventoryItemMatchScore(item, code, name),
            }))
            .filter((entry) => entry.score > 0)
            .sort((left, right) => {
                if (right.score !== left.score) {
                    return right.score - left.score;
                }

                return (left.item.itemName ?? '').localeCompare(
                    right.item.itemName ?? '',
                );
            })[0]?.item ?? null
    );
}

function inventoryMedicationMatch(
    code: string | null | undefined,
    name: string | null | undefined,
): InventoryItem | null {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return null;
    return inventoryMedicationMatches[key] ?? null;
}

function inventoryMedicationIsLoading(
    code: string | null | undefined,
    name: string | null | undefined,
): boolean {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return false;
    return inventoryMedicationLoading[key] ?? false;
}

function inventoryMedicationError(
    code: string | null | undefined,
    name: string | null | undefined,
): string | null {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return null;
    return inventoryMedicationErrors[key] ?? null;
}

function createMedicationAvailabilityMatch(
    code: string | null | undefined,
    name: string | null | undefined,
): InventoryItem | null {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return null;
    return createMedicationAvailabilityMatches[key] ?? null;
}

function createMedicationAvailabilityIsLoading(
    code: string | null | undefined,
    name: string | null | undefined,
): boolean {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return false;
    return createMedicationAvailabilityLoading[key] ?? false;
}

function createMedicationAvailabilityError(
    code: string | null | undefined,
    name: string | null | undefined,
): string | null {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return null;
    return createMedicationAvailabilityErrors[key] ?? null;
}

async function searchInventoryItems(query: string): Promise<InventoryItem[]> {
    const normalizedQuery = query.trim();
    if (!normalizedQuery) return [];

    const response = await apiRequest<InventoryItemListResponse>(
        'GET',
        '/inventory-procurement/items',
        {
            query: {
                q: normalizedQuery,
                page: 1,
                perPage: 25,
                sortBy: 'itemName',
                sortDir: 'asc',
            },
        },
    );

    return response.data ?? [];
}

async function fetchPharmacyMedicationAvailability(
    code: string | null | undefined,
    name: string | null | undefined,
): Promise<InventoryItem | null> {
    const response = await apiRequest<PharmacyMedicationAvailabilityResponse>(
        'GET',
        '/pharmacy-orders/availability',
        {
            query: {
                medicationCode: code?.trim() ?? '',
                medicationName: name?.trim() ?? '',
            },
        },
    );

    return response.data ?? null;
}

async function ensureInventoryMedicationMatch(
    code: string | null | undefined,
    name: string | null | undefined,
    options?: { force?: boolean },
) {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return;

    if (inventoryMedicationLoading[key]) return;
    if (
        !options?.force &&
        Object.prototype.hasOwnProperty.call(inventoryMedicationMatches, key)
    ) {
        return;
    }

    inventoryMedicationLoading[key] = true;
    inventoryMedicationErrors[key] = null;

    try {
        if (!canReadInventoryProcurement.value) {
            inventoryMedicationMatches[key] =
                await fetchPharmacyMedicationAvailability(code, name);
            return;
        }

        const queries = [
            code?.trim() ?? '',
            name?.trim() ?? '',
        ].filter(
            (query, index, collection) =>
                query !== '' &&
                collection.findIndex(
                    (candidate) =>
                        normalizeCatalogText(candidate) ===
                        normalizeCatalogText(query),
                ) === index,
        );

        const results = await Promise.all(queries.map((query) => searchInventoryItems(query)));
        const candidates = results
            .flat()
            .filter(
                (item, index, collection) =>
                    collection.findIndex((candidate) => candidate.id === item.id) ===
                    index,
            );

        inventoryMedicationMatches[key] = resolveInventoryMedicationMatch(
            candidates,
            code,
            name,
        );
    } catch (error) {
        inventoryMedicationMatches[key] = null;
        inventoryMedicationErrors[key] = messageFromUnknown(
            error,
            'Unable to load pharmacy stock.',
        );
    } finally {
        inventoryMedicationLoading[key] = false;
    }
}

async function ensureInventoryStockMovementHistory(
    itemId: string | null | undefined,
    options?: { force?: boolean; perPage?: number },
) {
    const normalizedItemId = itemId?.trim() ?? '';
    if (!normalizedItemId) return;

    if (!canReadInventoryProcurement.value) {
        inventoryStockMovementHistory[normalizedItemId] = [];
        inventoryStockMovementHistoryTotals[normalizedItemId] = 0;
        inventoryStockMovementHistoryErrors[normalizedItemId] = null;
        inventoryStockMovementHistoryLoading[normalizedItemId] = false;
        return;
    }

    if (inventoryStockMovementHistoryLoading[normalizedItemId]) return;
    if (
        !options?.force &&
        Object.prototype.hasOwnProperty.call(
            inventoryStockMovementHistory,
            normalizedItemId,
        )
    ) {
        return;
    }

    inventoryStockMovementHistoryLoading[normalizedItemId] = true;
    inventoryStockMovementHistoryErrors[normalizedItemId] = null;

    try {
        const response = await apiRequest<InventoryStockMovementListResponse>(
            'GET',
            '/inventory-procurement/stock-movements',
            {
                query: {
                    itemId: normalizedItemId,
                    page: 1,
                    perPage: options?.perPage ?? STOCK_LEDGER_PREVIEW_COUNT,
                    sortBy: 'occurredAt',
                    sortDir: 'desc',
                },
            },
        );

        inventoryStockMovementHistory[normalizedItemId] = response.data ?? [];
        inventoryStockMovementHistoryTotals[normalizedItemId] = Number(
            response.meta?.total ?? response.data?.length ?? 0,
        );
    } catch (error) {
        inventoryStockMovementHistory[normalizedItemId] = [];
        inventoryStockMovementHistoryTotals[normalizedItemId] = 0;
        inventoryStockMovementHistoryErrors[normalizedItemId] = messageFromUnknown(
            error,
            'Unable to load stock movement history.',
        );
    } finally {
        inventoryStockMovementHistoryLoading[normalizedItemId] = false;
    }
}

function inventoryStockStateLabel(state: string | null | undefined): string {
    const normalized = (state ?? '').trim().toLowerCase();
    if (normalized === 'out_of_stock') return 'Out of stock';
    if (normalized === 'low_stock') return 'Low stock';
    if (normalized === 'healthy') return 'Available';
    return 'Stock pending';
}

function inventoryStockStateVariant(
    state: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (state ?? '').trim().toLowerCase();
    if (normalized === 'out_of_stock') return 'destructive';
    if (normalized === 'low_stock') return 'secondary';
    if (normalized === 'healthy') return 'default';
    return 'outline';
}

function pharmacySafetyReviewVariant(
    severity: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (severity ?? '').trim().toLowerCase();
    if (normalized === 'critical') return 'destructive';
    if (normalized === 'warning') return 'secondary';
    return 'outline';
}

function pharmacySafetyReviewLabel(severity: string | null | undefined): string {
    const normalized = (severity ?? '').trim().toLowerCase();
    if (normalized === 'critical') return 'Critical review';
    if (normalized === 'warning') return 'Needs attention';
    return 'Clear';
}

function patientAllergySeverityVariant(
    severity: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (severity ?? '').trim().toLowerCase();
    if (normalized === 'life_threatening' || normalized === 'severe') {
        return 'destructive';
    }
    if (normalized === 'moderate') return 'secondary';
    return 'outline';
}

function medicationInteractionSeverityVariant(
    severity: string | null | undefined,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (severity ?? '').trim().toLowerCase();
    if (normalized === 'critical') return 'destructive';
    if (normalized === 'warning') return 'secondary';
    return 'outline';
}

function medicationInteractionLabel(conflict: MedicationInteractionConflict): string {
    return (
        conflict.interactingMedicationName?.trim() ||
        conflict.interactingMedicationCode?.trim() ||
        'Current therapy'
    );
}

function medicationLaboratorySignalLabel(signal: MedicationLaboratorySignal): string {
    return (
        signal.sourceTestName?.trim() ||
        signal.sourceTestCode?.trim() ||
        'Recent laboratory result'
    );
}

function medicationSafetyRuleSourceLabel(rule: MedicationSafetyRule): string {
    return (
        rule.source?.label?.trim() ||
        rule.categoryLabel?.trim() ||
        formatEnumLabel(rule.category || 'safety')
    );
}

function medicationSafetyRuleSourceDetail(rule: MedicationSafetyRule): string | null {
    const source = rule.source;
    if (!source) {
        return null;
    }

    const parts: string[] = [];

    if (source.referenceLabel?.trim()) {
        parts.push(source.referenceLabel.trim());
    } else if (source.referenceId?.trim()) {
        parts.push(source.referenceId.trim());
    }

    if (source.flag?.trim()) {
        parts.push(formatEnumLabel(source.flag));
    }

    if (source.observedAt?.trim()) {
        parts.push(`Observed ${formatDateTime(source.observedAt)}`);
    }

    return parts.length > 0 ? parts.join(' | ') : null;
}

function medicationSafetyGroupSourceSummary(group: MedicationSafetyRuleGroup): string {
    const labels = group.sourceLabels
        .map((label) => label.trim())
        .filter((label) => label.length > 0);

    if (labels.length === 0) {
        return 'Grouped from the current clinical safety review.';
    }

    if (labels.length === 1) {
        return labels[0];
    }

    if (labels.length === 2) {
        return `${labels[0]} and ${labels[1]}`;
    }

    return `${labels[0]}, ${labels[1]}, +${labels.length - 2} more`;
}

function medicationSafetyPatientAgeLabel(
    patientContext: MedicationSafetyPatientContext | null | undefined,
): string {
    if (!patientContext) return 'Age unavailable';

    if (
        patientContext.ageYears !== null &&
        patientContext.ageYears < 2 &&
        patientContext.ageMonths !== null
    ) {
        return `${patientContext.ageMonths} months`;
    }

    if (patientContext.ageYears !== null) {
        return `${patientContext.ageYears} years`;
    }

    if (patientContext.ageMonths !== null) {
        return `${patientContext.ageMonths} months`;
    }

    return 'Age unavailable';
}

function medicationSafetyPatientWeightLabel(
    patientContext: MedicationSafetyPatientContext | null | undefined,
): string {
    if (!patientContext || patientContext.weightKg === null) {
        return 'Weight not recorded';
    }

    return `${quantityText(patientContext.weightKg)} kg`;
}

function medicationSafetyPatientContextHelper(
    patientContext: MedicationSafetyPatientContext | null | undefined,
): string {
    if (!patientContext) {
        return 'No patient age or weight context was available for this review.';
    }

    if (patientContext.isPediatric && patientContext.weightKg !== null) {
        return 'Pediatric dose checks are using the recorded triage weight for this review.';
    }

    if (patientContext.isPediatric) {
        return 'Pediatric dose checks may stay conservative until a current weight is recorded.';
    }

    if (patientContext.weightKg !== null) {
        return 'A recent triage weight is available if weight-based medication review becomes necessary.';
    }

    return 'Age context is available, but no recent triage weight is linked to this review.';
}

function medicationProfileSummary(profile: PatientMedicationProfile): string {
    return [
        profile.dose?.trim() || null,
        profile.route?.trim() || null,
        profile.frequency?.trim() ? formatEnumLabel(profile.frequency) : null,
    ]
        .filter((value): value is string => Boolean(value))
        .join(' | ') || 'Current medication details not recorded';
}

function inventoryStockQuantityLabel(item: InventoryItem | null): string {
    if (!item) return 'Stock not linked';

    const unit = item.unit?.trim() ? formatEnumLabel(item.unit) : 'units';
    return `${quantityText(item.currentStock)} ${unit}`;
}

function inventoryReorderLevelLabel(item: InventoryItem | null): string {
    if (!item) return 'Not set';

    const unit = item.unit?.trim() ? formatEnumLabel(item.unit) : 'units';
    return `${quantityText(item.reorderLevel)} ${unit}`;
}

function inventoryMaxStockLabel(item: InventoryItem | null): string {
    if (!item) return 'Not set';

    if (
        item.maxStockLevel === null ||
        item.maxStockLevel === undefined ||
        item.maxStockLevel === ''
    ) {
        return 'Not set';
    }

    const unit = item.unit?.trim() ? formatEnumLabel(item.unit) : 'units';
    return `${quantityText(item.maxStockLevel)} ${unit}`;
}

function inventoryStockHelperText(item: InventoryItem | null): string {
    if (!item) {
        return 'No inventory item matched this medicine in the current facility scope.';
    }

    const stockState = (item.stockState ?? '').trim().toLowerCase();
    if (stockState === 'out_of_stock') {
        return 'Inventory shows no on-hand stock for this medicine.';
    }

    if (stockState === 'low_stock') {
        return 'Inventory is at or below the reorder level for this medicine.';
    }

    return 'Inventory shows enough on-hand stock for the current release path.';
}

function inventoryItemDisplay(item: InventoryItem | null): string {
    if (!item) return 'Not linked';

    return medicationDisplayLabel(item.itemCode, item.itemName, 'Inventory item');
}

function inventoryMovementTypeLabel(movementType: string | null): string {
    const normalized = (movementType ?? '').trim().toLowerCase();
    if (normalized === 'issue') return 'Issue';
    if (normalized === 'receive') return 'Receive';
    if (normalized === 'adjust') return 'Adjust';
    if (normalized === 'transfer') return 'Transfer';
    return formatEnumLabel(movementType || 'movement');
}

function inventoryMovementTypeVariant(
    movementType: string | null,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (movementType ?? '').trim().toLowerCase();
    if (normalized === 'receive') return 'default';
    if (normalized === 'issue') return 'secondary';
    if (normalized === 'adjust') return 'outline';
    if (normalized === 'transfer') return 'outline';
    return 'outline';
}

function inventoryMovementDeltaLabel(
    movement: InventoryStockMovement,
    unit: string | null | undefined,
): string {
    const delta = Number(movement.quantityDelta ?? 0);
    const normalizedUnit = unit?.trim() ? formatEnumLabel(unit) : 'units';
    const quantity = quantityText(Math.abs(delta));

    if (delta > 0) return `+${quantity} ${normalizedUnit}`;
    if (delta < 0) return `-${quantity} ${normalizedUnit}`;
    return `${quantityText(movement.quantity)} ${normalizedUnit}`;
}

function inventoryMovementStockPathLabel(
    movement: InventoryStockMovement,
    unit: string | null | undefined,
): string {
    const normalizedUnit = unit?.trim() ? formatEnumLabel(unit) : 'units';

    return `${quantityText(movement.stockBefore)} -> ${quantityText(movement.stockAfter)} ${normalizedUnit}`;
}

function inventoryMovementTraceLabel(movement: InventoryStockMovement): string {
    const metadata = movement.metadata ?? {};
    const sourceModule =
        typeof metadata.source_module === 'string' ? metadata.source_module.trim() : '';
    const orderNumber =
        typeof metadata.pharmacy_order_number === 'string'
            ? metadata.pharmacy_order_number.trim()
            : '';

    if (sourceModule === 'pharmacy' && orderNumber) {
        return `Pharmacy release | ${orderNumber}`;
    }

    if (sourceModule === 'pharmacy') {
        return 'Pharmacy release';
    }

    const reason = movement.reason?.trim() ?? '';
    if (reason) return reason;

    return inventoryMovementTypeLabel(movement.movementType);
}

function inventoryStockLedgerHref(itemId: string): string {
    const params = new URLSearchParams({
        section: 'stock-ledger',
        itemId,
    });

    return `/inventory-procurement?${params.toString()}#stock-ledger-card`;
}

function orderDispenseTargetMedicationCode(order: PharmacyOrder): string | null {
    if (hasSubstitutionInDispenseNotes(order)) {
        return order.substitutedMedicationCode;
    }

    return order.medicationCode;
}

function orderDispenseTargetMedicationName(order: PharmacyOrder): string | null {
    if (hasSubstitutionInDispenseNotes(order)) {
        return order.substitutedMedicationName;
    }

    return order.medicationName;
}

function clearCreateApprovedMedicineDerivedFields() {
    createForm.medicationCode = '';
    createForm.medicationName = '';
}

function syncCreateApprovedMedicineSelection() {
    const catalogItemId = createForm.approvedMedicineCatalogItemId.trim();
    if (!catalogItemId) {
        clearCreateApprovedMedicineDerivedFields();
        return;
    }

    const catalogItem =
        approvedMedicinesCatalogItems.value.find((item) => item.id === catalogItemId) ??
        null;
    if (catalogItem === null) return;

    createForm.medicationCode = catalogItem.code?.trim() ?? '';
    createForm.medicationName = catalogItem.name?.trim() ?? '';
}

function validateCurrentCreateOrderDraft(options?: {
    requireClinicalIndication?: boolean;
}): PharmacyOrderBasketItem | null {
    if (!createForm.patientId.trim()) {
        createErrors.value = {
            patientId: ['Select the patient before placing a pharmacy order.'],
        };
        openCreateContextDialogForValidationErrors(createErrors.value);
        return null;
    }

    if (approvedMedicinesCatalogAccessBlocked.value) {
        createErrors.value = {
            approvedMedicineCatalogItemId: [
                'This pharmacy account cannot open the approved medicines picker from this workspace.',
            ],
        };
        return null;
    }

    if (!selectedCreateApprovedMedicineItem.value) {
        createErrors.value = {
            approvedMedicineCatalogItemId: [
                'Select one active approved medicine from the STG/NEMLIT catalog.',
            ],
        };
        return null;
    }

    syncCreateApprovedMedicineSelection();

    if (!createForm.dosageInstruction.trim()) {
        createErrors.value = {
            dosageInstruction: ['Enter the dosage instruction for this medicine.'],
        };
        return null;
    }

    if (
        options?.requireClinicalIndication !== false
        && !createForm.clinicalIndication.trim()
    ) {
        createErrors.value = {
            clinicalIndication: ['Enter the clinical indication for this medicine.'],
        };
        return null;
    }

    const prescribedQuantity = Number(createForm.quantityPrescribed);
    if (!Number.isFinite(prescribedQuantity) || prescribedQuantity <= 0) {
        createErrors.value = {
            quantityPrescribed: ['Enter a prescribed quantity greater than zero.'],
        };
        return null;
    }

    const normalizedQuantity = normalizeCreateQuantityInput(
        createForm.quantityPrescribed,
    );

    return {
        clientKey: nextCreateOrderBasketItemKey(),
        patientId: createForm.patientId.trim(),
        appointmentId: createForm.appointmentId.trim(),
        admissionId: createForm.admissionId.trim(),
        approvedMedicineCatalogItemId:
            createForm.approvedMedicineCatalogItemId.trim(),
        medicationCode: createForm.medicationCode.trim(),
        medicationName: createForm.medicationName.trim(),
        dosageInstruction: createForm.dosageInstruction.trim(),
        clinicalIndication: createForm.clinicalIndication.trim(),
        quantityPrescribed: normalizedQuantity,
        dispensingNotes: createForm.dispensingNotes.trim(),
    };
}

function buildCreatePharmacyOrderPayload(
    item: PharmacyOrderBasketItem,
    options?: {
        orderSessionId?: string | null;
        replacesOrderId?: string | null;
        addOnToOrderId?: string | null;
        entryMode?: 'draft' | 'active';
    },
) {
    return {
        patientId: item.patientId,
        appointmentId: item.appointmentId || null,
        admissionId: item.admissionId || null,
        orderSessionId: options?.orderSessionId?.trim() || null,
        replacesOrderId: options?.replacesOrderId?.trim() || null,
        addOnToOrderId: options?.addOnToOrderId?.trim() || null,
        entryMode: options?.entryMode ?? 'active',
        approvedMedicineCatalogItemId: item.approvedMedicineCatalogItemId || null,
        medicationCode: item.medicationCode,
        medicationName: item.medicationName,
        dosageInstruction: item.dosageInstruction,
        clinicalIndication: item.clinicalIndication || null,
        quantityPrescribed: Number(item.quantityPrescribed),
        quantityDispensed: null,
        dispensingNotes: item.dispensingNotes || null,
    };
}

function generateClinicalOrderSessionId(prefix: string): string {
    if (typeof window !== 'undefined' && window.crypto?.randomUUID) {
        return window.crypto.randomUUID();
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

async function confirmPharmacyDuplicateOrdering(
    item: Pick<
        PharmacyOrderBasketItem,
        | 'patientId'
        | 'appointmentId'
        | 'admissionId'
        | 'approvedMedicineCatalogItemId'
        | 'medicationCode'
        | 'medicationName'
    >,
): Promise<boolean> {
    const response = await apiRequest<DuplicateCheckResponse<PharmacyOrder>>(
        'GET',
        '/pharmacy-orders/duplicate-check',
        {
            query: {
                patientId: item.patientId.trim(),
                appointmentId: item.appointmentId.trim() || null,
                admissionId: item.admissionId.trim() || null,
                approvedMedicineCatalogItemId: item.approvedMedicineCatalogItemId.trim() || null,
                medicationCode: item.medicationCode.trim() || null,
            },
        },
    );

    if (!response.data.messages.length) {
        return true;
    }

    const title = item.medicationName.trim() || item.medicationCode.trim() || 'this medicine';

    return requestDuplicateConfirmation({
        title: `Duplicate advisory for ${title}`,
        description:
            'An active medication order for this medicine already exists in the current encounter.',
        details: response.data.messages,
        cancelLabel: 'Review existing orders',
        confirmLabel: 'Continue ordering',
    });
}

function medicationSafetyContextLabel(input: {
    medicationName?: string | null;
    medicationCode?: string | null;
}): string {
    return input.medicationName?.trim() || input.medicationCode?.trim() || 'this medicine';
}

async function fetchPatientMedicationSafetySummary(input: {
    patientId: string;
    appointmentId?: string | null;
    admissionId?: string | null;
    approvedMedicineCatalogItemId?: string | null;
    medicationCode?: string | null;
    medicationName?: string | null;
    dosageInstruction?: string | null;
    clinicalIndication?: string | null;
    quantityPrescribed?: string | number | null;
    excludeOrderId?: string | null;
}): Promise<PatientMedicationSafetySummary | null> {
    const patientId = input.patientId.trim();
    const approvedMedicineCatalogItemId = input.approvedMedicineCatalogItemId?.trim() ?? '';
    const medicationCode = input.medicationCode?.trim() ?? '';
    const medicationName = input.medicationName?.trim() ?? '';
    const dosageInstruction = input.dosageInstruction?.trim() ?? '';
    const clinicalIndication = input.clinicalIndication?.trim() ?? '';
    const quantityPrescribed =
        input.quantityPrescribed === null || input.quantityPrescribed === undefined
            ? null
            : Number(input.quantityPrescribed);

    if (!patientId || (!approvedMedicineCatalogItemId && !medicationCode && !medicationName)) {
        return null;
    }

    const response = await apiRequest<PatientMedicationSafetySummaryResponse>(
        'GET',
        `/patients/${patientId}/medication-safety-summary`,
        {
            query: {
                appointmentId: input.appointmentId?.trim() || null,
                admissionId: input.admissionId?.trim() || null,
                approvedMedicineCatalogItemId: approvedMedicineCatalogItemId || null,
                medicationCode: medicationCode || null,
                medicationName: medicationName || null,
                dosageInstruction: dosageInstruction || null,
                clinicalIndication: clinicalIndication || null,
                quantityPrescribed:
                    quantityPrescribed !== null && Number.isFinite(quantityPrescribed)
                        ? quantityPrescribed
                        : null,
                excludeOrderId: input.excludeOrderId?.trim() || null,
            },
        },
    );

    return response.data;
}

async function loadCreateMedicationSafetySummary(): Promise<void> {
    const requestId = ++createMedicationSafetyRequestId;
    const patientId = createForm.patientId.trim();
    const approvedMedicineCatalogItemId =
        createForm.approvedMedicineCatalogItemId.trim();
    const medicationCode = createForm.medicationCode.trim();
    const medicationName = createForm.medicationName.trim();

    if (!patientId || (!approvedMedicineCatalogItemId && !medicationCode && !medicationName)) {
        createMedicationSafetySummary.value = null;
        createMedicationSafetyError.value = null;
        createMedicationSafetyLoading.value = false;
        return;
    }

    createMedicationSafetyLoading.value = true;
    createMedicationSafetyError.value = null;

    try {
        const summary = await fetchPatientMedicationSafetySummary({
            patientId,
            appointmentId: createForm.appointmentId,
            admissionId: createForm.admissionId,
            approvedMedicineCatalogItemId,
            medicationCode,
            medicationName,
            dosageInstruction: createForm.dosageInstruction,
            clinicalIndication: createForm.clinicalIndication,
            quantityPrescribed: createForm.quantityPrescribed,
            excludeOrderId: createServerDraftId.value.trim() || null,
        });

        if (requestId !== createMedicationSafetyRequestId) return;
        createMedicationSafetySummary.value = summary;
    } catch (error) {
        if (requestId !== createMedicationSafetyRequestId) return;
        createMedicationSafetySummary.value = null;
        createMedicationSafetyError.value = messageFromUnknown(
            error,
            'Unable to load patient medication safety guidance.',
        );
    } finally {
        if (requestId === createMedicationSafetyRequestId) {
            createMedicationSafetyLoading.value = false;
        }
    }
}

function resetCreateMedicationSafetyReviewDialogState(): void {
    createMedicationSafetyReviewSummary.value = null;
    createMedicationSafetyReviewTitle.value = 'Medication safety review';
    createMedicationSafetyReviewContextLabel.value = 'this medicine';
    createMedicationSafetyReviewTab.value = 'summary';
    createMedicationSafetyReviewAcknowledged.value = false;
    createMedicationSafetyReviewOverrideCode.value = '';
    createMedicationSafetyReviewOverrideReason.value = '';
    createMedicationSafetyReviewError.value = null;
}

const createMedicationSafetySelectedOverrideOption = computed(() =>
    createMedicationSafetyReviewSummary.value?.overrideOptions.find(
        (option) =>
            option.code === createMedicationSafetyReviewOverrideCode.value.trim(),
    ) ?? null,
);

function closeCreateMedicationSafetyReviewDialog(
    decision: MedicationSafetyContinuationDecision | null = null,
): void {
    createMedicationSafetyReviewDialogOpen.value = false;
    const resolver = createMedicationSafetyReviewResolver;
    createMedicationSafetyReviewResolver = null;
    resetCreateMedicationSafetyReviewDialogState();
    resolver?.(decision);
}

function confirmCreateMedicationSafetyReview(): void {
    const summary = createMedicationSafetyReviewSummary.value;
    if (!summary) {
        closeCreateMedicationSafetyReviewDialog(null);
        return;
    }

    if (
        summary.warnings.length > 0 &&
        !createMedicationSafetyReviewAcknowledged.value
    ) {
        createMedicationSafetyReviewError.value =
            'Acknowledge the medication safety review before continuing.';
        return;
    }

    const overrideCode = createMedicationSafetyReviewOverrideCode.value.trim();
    const overrideReason = createMedicationSafetyReviewOverrideReason.value.trim();
    if (summary.blockers.length > 0 && !overrideCode) {
        createMedicationSafetyReviewError.value =
            'Select a clinical override category for active safety blockers.';
        return;
    }

    if (summary.blockers.length > 0 && !overrideReason) {
        createMedicationSafetyReviewError.value =
            'Clinical override reason is required for active safety blockers.';
        return;
    }

    createMedicationSafetyReviewError.value = null;
    closeCreateMedicationSafetyReviewDialog({
        acknowledged:
            createMedicationSafetyReviewAcknowledged.value ||
            summary.warnings.length === 0,
        overrideCode: overrideCode || null,
        overrideReason: overrideReason || null,
    });
}

async function requestMedicationSafetyContinuationDecision(
    summary: PatientMedicationSafetySummary,
    contextLabel: string,
    title = 'Medication safety review required',
): Promise<MedicationSafetyContinuationDecision | null> {
    createMedicationSafetyReviewTitle.value = title;
    createMedicationSafetyReviewContextLabel.value = contextLabel;
    createMedicationSafetyReviewSummary.value = summary;
    createMedicationSafetyReviewAcknowledged.value = summary.warnings.length === 0;
    createMedicationSafetyReviewOverrideCode.value = '';
    createMedicationSafetyReviewOverrideReason.value = '';
    createMedicationSafetyReviewError.value = null;
    createMedicationSafetyReviewDialogOpen.value = true;
    createMedicationSafetyReviewTab.value = 'summary';

    return new Promise((resolve) => {
        createMedicationSafetyReviewResolver = resolve;
    });
}

async function ensureMedicationSafetyForActiveSubmission(input: {
    patientId: string;
    appointmentId?: string | null;
    admissionId?: string | null;
    approvedMedicineCatalogItemId?: string | null;
    medicationCode?: string | null;
    medicationName?: string | null;
    dosageInstruction?: string | null;
    clinicalIndication?: string | null;
    quantityPrescribed?: string | number | null;
    excludeOrderId?: string | null;
    dialogTitle?: string;
}): Promise<MedicationSafetyContinuationDecision | null> {
    const summary = await fetchPatientMedicationSafetySummary(input);
    if (!summary) {
        return {
            acknowledged: false,
            overrideCode: null,
            overrideReason: null,
        };
    }

    if (summary.blockers.length === 0 && summary.warnings.length === 0) {
        return {
            acknowledged: false,
            overrideCode: null,
            overrideReason: null,
        };
    }

    return requestMedicationSafetyContinuationDecision(
        summary,
        medicationSafetyContextLabel(input),
        input.dialogTitle ?? 'Medication safety review required',
    );
}

async function addCurrentCreateOrderToBasket(): Promise<void> {
    if (createLoading.value || !canUseCreateOrderBasket.value) return;

    resetCreateMessages();

    if (hasSavedCreateDraft.value) {
        notifyError(
            'Discard or sign the saved pharmacy draft before adding another medicine to the basket.',
        );
        return;
    }

    const draftItem = validateCurrentCreateOrderDraft({
        requireClinicalIndication: true,
    });
    if (!draftItem) return;

    if (!(await confirmPharmacyDuplicateOrdering(draftItem))) {
        return;
    }

    const duplicateItem = createOrderBasket.value.find((item) =>
        item.patientId === draftItem.patientId &&
        item.appointmentId === draftItem.appointmentId &&
        item.admissionId === draftItem.admissionId &&
        item.approvedMedicineCatalogItemId ===
            draftItem.approvedMedicineCatalogItemId &&
        item.dosageInstruction === draftItem.dosageInstruction &&
        item.quantityPrescribed === draftItem.quantityPrescribed &&
        item.dispensingNotes === draftItem.dispensingNotes,
    );

    if (duplicateItem) {
        createErrors.value = {
            approvedMedicineCatalogItemId: [
                'This medicine is already in the basket with the same instructions.',
            ],
        };
        return;
    }

    createOrderBasket.value = [...createOrderBasket.value, draftItem];
    createMessage.value = `Added ${draftItem.medicationName || draftItem.medicationCode || 'medicine'} to the basket.`;
    resetCreateOrderDraftFields();
}

function removeCreateOrderBasketItem(clientKey: string): void {
    createOrderBasket.value = createOrderBasket.value.filter(
        (item) => item.clientKey !== clientKey,
    );

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedPharmacyCreateDraft();
    }
}

async function ensureCreateMedicationAvailabilityMatch(
    code: string | null | undefined,
    name: string | null | undefined,
    options?: { force?: boolean },
) {
    const key = inventoryMedicationLookupKey(code, name);
    if (!key) return;

    if (createMedicationAvailabilityLoading[key]) return;
    if (
        !options?.force &&
        Object.prototype.hasOwnProperty.call(createMedicationAvailabilityMatches, key)
    ) {
        return;
    }

    createMedicationAvailabilityLoading[key] = true;
    createMedicationAvailabilityErrors[key] = null;

    try {
        createMedicationAvailabilityMatches[key] =
            await fetchPharmacyMedicationAvailability(code, name);
    } catch (error) {
        createMedicationAvailabilityMatches[key] = null;
        createMedicationAvailabilityErrors[key] = messageFromUnknown(
            error,
            'Unable to load pharmacy stock readiness.',
        );
    } finally {
        createMedicationAvailabilityLoading[key] = false;
    }
}

function clearCreateOrderBasket(): void {
    createOrderBasket.value = [];

    if (!hasPendingCreateWorkflow.value) {
        clearPersistedPharmacyCreateDraft();
    }
}

function unlockCreatePatientContext() {
    createPatientContextLocked.value = false;
    clearCreateClinicalLinks();
    createContextEditorTab.value = 'patient';
}

function openCreateContextDialog(
    tab: CreateContextEditorTab = 'patient',
    options?: { unlockPatient?: boolean },
) {
    if (options?.unlockPatient) {
        unlockCreatePatientContext();
    }

    createContextEditorTab.value = tab;
    createContextDialogOpen.value = true;
}

function openCreateContextDialogForValidationErrors(
    errors: Record<string, string[]>,
) {
    if (errors.patientId?.length) {
        openCreateContextDialog('patient');
        return;
    }

    if (errors.appointmentId?.length) {
        openCreateContextDialog('appointment');
        return;
    }

    if (errors.admissionId?.length) {
        openCreateContextDialog('admission');
    }
}

function closeCreateContextDialogAfterSelection(
    kind: 'patientId' | 'appointmentId' | 'admissionId',
    selected: { id: string } | null,
) {
    if (!createContextDialogOpen.value || !selected) return;

    const nextId = selected.id?.trim?.() ?? '';
    if (!nextId) return;
    if (createContextDialogInitialSelection[kind] === nextId) return;

    createContextDialogOpen.value = false;
}

function clearCreateClinicalLinks() {
    clearCreateAppointmentLink({ suppressAuto: false, focusEditor: false });
    clearCreateAdmissionLink({ suppressAuto: false, focusEditor: false });
}

function focusPharmacyQueueSearch() {
    nextTick(() => {
        pharmacyQueueSearchInput.value?.focus();
        pharmacyQueueSearchInput.value?.select();
    });
}

function scrollToPharmacyQueueCard() {
    nextTick(() => {
        pharmacyQueueCardRef.value?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        });
    });
}

function syncPharmacyWorkspaceViewToUrl(view: PharmacyWorkspaceView) {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    url.searchParams.set('tab', view);
    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

function focusCreateContextTrigger() {
    nextTick(() => {
        const element = document.getElementById('pha-open-context-dialog');
        if (element instanceof HTMLElement) {
            element.focus();
        }
    });
}

function setPharmacyWorkspaceView(
    view: PharmacyWorkspaceView,
    options?: { focusSearch?: boolean; focusCreate?: boolean },
) {
    pharmacyWorkspaceView.value = view;
    syncPharmacyWorkspaceViewToUrl(view);

    if (view === 'queue') {
        scrollToPharmacyQueueCard();
        if (options?.focusSearch) {
            focusPharmacyQueueSearch();
        }
        return;
    }

    if (options?.focusCreate) {
        focusCreateContextTrigger();
    }
}

async function loadScope() {
    try {
        const response = await apiRequest<{ data: ScopeData }>(
            'GET',
            '/platform/access-scope',
        );
        scope.value = response.data;
    } catch (error) {
        listErrors.value.push(
            `Scope: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
    }
}

async function loadPharmacyPermissions() {
    try {
        const response = await apiRequest<AuthPermissionsResponse>(
            'GET',
            '/auth/me/permissions',
        );
        const names = new Set(
            (response.data ?? [])
                .map((permission) => permission.name?.trim())
                .filter((name): name is string => Boolean(name)),
        );
        canReadPharmacyOrders.value = names.has('pharmacy.orders.read');
        canCreatePharmacyOrders.value = names.has('pharmacy.orders.create');
        canReadApprovedMedicinesCatalog.value =
            names.has('platform.clinical-catalog.read') ||
            names.has('pharmacy.orders.read') ||
            names.has('pharmacy.orders.create') ||
            names.has('pharmacy.orders.manage-policy') ||
            names.has('pharmacy.orders.update-status') ||
            names.has('pharmacy.orders.verify-dispense') ||
            names.has('pharmacy.orders.reconcile');
        canReadInventoryProcurement.value = names.has(
            'inventory.procurement.read',
        );
        canReadAppointments.value = names.has('appointments.read');
        canReadAdmissions.value = names.has('admissions.read');
        canReadMedicalRecords.value = names.has('medical.records.read');
        canReadLaboratoryOrders.value = names.has('laboratory.orders.read');
        canReadTheatreProcedures.value = names.has('theatre.procedures.read');
        canCreateTheatreProcedures.value = names.has('theatre.procedures.create');
        canReadBillingInvoices.value = names.has('billing.invoices.read');
        canUpdatePharmacyOrderStatus.value = names.has('pharmacy.orders.update-status');
        canVerifyPharmacyDispense.value = names.has('pharmacy.orders.verify-dispense');
        isApprovedMedicinesCatalogReadPermissionResolved.value = true;
        approvedMedicinesCatalogAccessDenied.value = false;
        canManagePharmacyPolicy.value = names.has('pharmacy.orders.manage-policy');
        canReconcilePharmacyOrders.value = names.has('pharmacy.orders.reconcile');
        canViewPharmacyOrderAuditLogs.value =
            names.has('pharmacy-orders.view-audit-logs') ||
            names.has('pharmacy.orders.view-audit-logs');
        canUpdateServiceRequestStatus.value = names.has('service.requests.update-status');

    } catch {
        canReadPharmacyOrders.value = false;
        canCreatePharmacyOrders.value = false;
        canReadApprovedMedicinesCatalog.value = false;
        canReadInventoryProcurement.value = false;
        canReadAppointments.value = false;
        canReadAdmissions.value = false;
        canReadMedicalRecords.value = false;
        canReadLaboratoryOrders.value = false;
        canReadTheatreProcedures.value = false;
        canCreateTheatreProcedures.value = false;
        canReadBillingInvoices.value = false;
        canUpdatePharmacyOrderStatus.value = false;
        canVerifyPharmacyDispense.value = false;
        isApprovedMedicinesCatalogReadPermissionResolved.value = true;
        approvedMedicinesCatalogAccessDenied.value = false;
        canManagePharmacyPolicy.value = false;
        canReconcilePharmacyOrders.value = false;
        canViewPharmacyOrderAuditLogs.value = false;
        canUpdateServiceRequestStatus.value = false;
    }
}

async function loadApprovedMedicinesCatalog(force = false) {
    if (approvedMedicinesCatalogLoading.value) return;
    if (!force && approvedMedicinesCatalogAccessDenied.value) return;
    if (!force && approvedMedicinesCatalogItems.value.length > 0) return;

    approvedMedicinesCatalogLoading.value = true;
    approvedMedicinesCatalogError.value = null;

    try {
        const response = await apiRequest<ClinicalCatalogItemListResponse>(
            'GET',
            '/pharmacy-orders/approved-medicines-catalog',
            {
                query: {
                    status: 'active',
                    sortBy: 'name',
                    sortDir: 'asc',
                    perPage: 100,
                    page: 1,
                },
            },
        );
        approvedMedicinesCatalogItems.value = response.data ?? [];
        canReadApprovedMedicinesCatalog.value = true;
        approvedMedicinesCatalogAccessDenied.value = false;
    } catch (error) {
        approvedMedicinesCatalogItems.value = [];
        if (isForbiddenError(error)) {
            canReadApprovedMedicinesCatalog.value = false;
            approvedMedicinesCatalogAccessDenied.value = true;
            approvedMedicinesCatalogError.value =
                'Approved medicines access is not available for this pharmacy account.';
        } else {
            approvedMedicinesCatalogAccessDenied.value = false;
            approvedMedicinesCatalogError.value = messageFromUnknown(
                error,
                'Unable to load approved medicines.',
            );
        }
    } finally {
        approvedMedicinesCatalogLoading.value = false;
        syncCreateApprovedMedicineSelection();
    }
}

async function hydrateVisiblePatients(rows: PharmacyOrder[]) {
    const ids = [
        ...new Set(
            rows
                .map((row) => row.patientId)
                .filter((id): id is string => Boolean(id)),
        ),
    ];
    const uncachedIds = ids.filter(
        (id) => !patientDirectory.value[id] && !pendingPatientLookupIds.has(id),
    );

    if (uncachedIds.length === 0) return;

    uncachedIds.forEach((id) => pendingPatientLookupIds.add(id));

    const results = await Promise.allSettled(
        uncachedIds.map((id) =>
            apiRequest<PatientResponse>('GET', `/patients/${id}`),
        ),
    );

    const nextDirectory = { ...patientDirectory.value };
    results.forEach((result, index) => {
        const id = uncachedIds[index];
        pendingPatientLookupIds.delete(id);
        if (result.status !== 'fulfilled') return;
        nextDirectory[id] = result.value.data;
    });
    patientDirectory.value = nextDirectory;
}

async function hydratePatientSummary(patientId: string) {
    const normalizedId = patientId.trim();
    if (!normalizedId) return;
    if (
        patientDirectory.value[normalizedId] ||
        pendingPatientLookupIds.has(normalizedId)
    ) {
        return;
    }

    pendingPatientLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<PatientResponse>(
            'GET',
            `/patients/${normalizedId}`,
        );
        patientDirectory.value = {
            ...patientDirectory.value,
            [normalizedId]: response.data,
        };
    } catch {
        // Keep create flow usable even if patient hydration fails.
    } finally {
        pendingPatientLookupIds.delete(normalizedId);
    }
}

async function hydrateAppointmentSummaryForDisplay(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    if (!normalizedId || !canReadAppointments.value) return;
    if (
        appointmentDirectory.value[normalizedId] ||
        pendingAppointmentLookupIds.has(normalizedId)
    ) {
        return;
    }

    pendingAppointmentLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<AppointmentResponse>(
            'GET',
            `/appointments/${normalizedId}`,
        );
        appointmentDirectory.value = {
            ...appointmentDirectory.value,
            [normalizedId]: response.data,
        };

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            void hydratePatientSummary(linkedPatientId);
        }
    } catch {
        // Keep details sheet usable even if appointment hydration fails.
    } finally {
        pendingAppointmentLookupIds.delete(normalizedId);
    }
}

async function hydrateAdmissionSummaryForDisplay(admissionId: string) {
    const normalizedId = admissionId.trim();
    if (!normalizedId || !canReadAdmissions.value) return;
    if (
        admissionDirectory.value[normalizedId] ||
        pendingAdmissionLookupIds.has(normalizedId)
    ) {
        return;
    }

    pendingAdmissionLookupIds.add(normalizedId);

    try {
        const response = await apiRequest<AdmissionResponse>(
            'GET',
            `/admissions/${normalizedId}`,
        );
        admissionDirectory.value = {
            ...admissionDirectory.value,
            [normalizedId]: response.data,
        };

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            void hydratePatientSummary(linkedPatientId);
        }
    } catch {
        // Keep details sheet usable even if admission hydration fails.
    } finally {
        pendingAdmissionLookupIds.delete(normalizedId);
    }
}

function isForbiddenError(error: unknown): boolean {
    return Boolean((error as { status?: number } | null)?.status === 403);
}

function setCreateAppointmentLink(
    value: string,
    source: CreateContextLinkSource,
) {
    pendingCreateAppointmentLinkSource = source;
    createForm.appointmentId = value;
}

function setCreateAdmissionLink(value: string, source: CreateContextLinkSource) {
    pendingCreateAdmissionLinkSource = source;
    createForm.admissionId = value;
}

function resetCreateContextSuggestions() {
    createAppointmentSuggestions.value = [];
    createAdmissionSuggestions.value = [];
    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;
}

function clearCreateAppointmentLink(options?: {
    suppressAuto?: boolean;
    focusEditor?: boolean;
}) {
    const shouldSuppress =
        options?.suppressAuto ?? createAppointmentLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.appointment = true;
    }

    createAppointmentSummary.value = null;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'appointment';
    }
}

function clearCreateAdmissionLink(options?: {
    suppressAuto?: boolean;
    focusEditor?: boolean;
}) {
    const shouldSuppress =
        options?.suppressAuto ?? createAdmissionLinkSource.value === 'auto';
    if (shouldSuppress) {
        createContextAutoLinkSuppressed.admission = true;
    }

    createAdmissionSummary.value = null;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink('', 'none');

    if (options?.focusEditor ?? true) {
        createContextEditorTab.value = 'admission';
    }
}

function selectSuggestedAppointment(
    appointment: AppointmentSummary,
    options?: {
        source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>;
        focusEditor?: boolean;
    },
) {
    createAppointmentSummary.value = appointment;
    createAppointmentSummaryError.value = null;
    createAppointmentSummaryLoading.value = false;
    setCreateAppointmentLink(appointment.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.appointment = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'appointment';
    }
}

function selectSuggestedAdmission(
    admission: AdmissionSummary,
    options?: {
        source?: Extract<CreateContextLinkSource, 'auto' | 'manual'>;
        focusEditor?: boolean;
    },
) {
    createAdmissionSummary.value = admission;
    createAdmissionSummaryError.value = null;
    createAdmissionSummaryLoading.value = false;
    setCreateAdmissionLink(admission.id, options?.source ?? 'manual');

    if (options?.source === 'auto') {
        createContextAutoLinkSuppressed.admission = false;
    }

    if (options?.focusEditor) {
        createContextEditorTab.value = 'admission';
    }
}

function maybeAutoLinkCreateContextSuggestions() {
    if (
        !createForm.appointmentId.trim() &&
        !createContextAutoLinkSuppressed.appointment &&
        createAppointmentSuggestions.value.length === 1
    ) {
        selectSuggestedAppointment(createAppointmentSuggestions.value[0], {
            source: 'auto',
        });
    }

    if (
        !createForm.admissionId.trim() &&
        !createContextAutoLinkSuppressed.admission &&
        createAdmissionSuggestions.value.length === 1
    ) {
        selectSuggestedAdmission(createAdmissionSuggestions.value[0], {
            source: 'auto',
        });
    }
}

async function loadCreateAppointmentSummary(appointmentId: string) {
    const normalizedId = appointmentId.trim();
    const requestId = ++createAppointmentSummaryRequestId;

    if (!normalizedId) {
        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = null;
        createAppointmentSummaryLoading.value = false;
        return;
    }

    if (
        createAppointmentSummary.value?.id === normalizedId &&
        !createAppointmentSummaryError.value
    ) {
        createAppointmentSummaryLoading.value = false;
        return;
    }

    createAppointmentSummaryLoading.value = true;
    createAppointmentSummaryError.value = null;

    try {
        const response = await apiRequest<AppointmentResponse>(
            'GET',
            `/appointments/${normalizedId}`,
        );

        if (requestId !== createAppointmentSummaryRequestId) return;

        createAppointmentSummary.value = response.data;

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            if (!createForm.patientId.trim()) {
                createForm.patientId = linkedPatientId;
            }
            void hydratePatientSummary(linkedPatientId);
        }
    } catch (error) {
        if (requestId !== createAppointmentSummaryRequestId) return;

        createAppointmentSummary.value = null;
        createAppointmentSummaryError.value = messageFromUnknown(
            error,
            'Unable to load appointment context.',
        );
    } finally {
        if (requestId === createAppointmentSummaryRequestId) {
            createAppointmentSummaryLoading.value = false;
        }
    }
}

async function loadCreateAdmissionSummary(admissionId: string) {
    const normalizedId = admissionId.trim();
    const requestId = ++createAdmissionSummaryRequestId;

    if (!normalizedId) {
        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = null;
        createAdmissionSummaryLoading.value = false;
        return;
    }

    if (
        createAdmissionSummary.value?.id === normalizedId &&
        !createAdmissionSummaryError.value
    ) {
        createAdmissionSummaryLoading.value = false;
        return;
    }

    createAdmissionSummaryLoading.value = true;
    createAdmissionSummaryError.value = null;

    try {
        const response = await apiRequest<AdmissionResponse>(
            'GET',
            `/admissions/${normalizedId}`,
        );

        if (requestId !== createAdmissionSummaryRequestId) return;

        createAdmissionSummary.value = response.data;

        const linkedPatientId = response.data.patientId?.trim() ?? '';
        if (linkedPatientId !== '') {
            if (!createForm.patientId.trim()) {
                createForm.patientId = linkedPatientId;
            }
            void hydratePatientSummary(linkedPatientId);
        }
    } catch (error) {
        if (requestId !== createAdmissionSummaryRequestId) return;

        createAdmissionSummary.value = null;
        createAdmissionSummaryError.value = messageFromUnknown(
            error,
            'Unable to load admission context.',
        );
    } finally {
        if (requestId === createAdmissionSummaryRequestId) {
            createAdmissionSummaryLoading.value = false;
        }
    }
}

async function loadCreateContextSuggestions(patientId: string) {
    const normalizedId = patientId.trim();
    const requestId = ++createContextSuggestionsRequestId;

    if (!normalizedId) {
        resetCreateContextSuggestions();
        return;
    }

    createAppointmentSuggestionsLoading.value = true;
    createAdmissionSuggestionsLoading.value = true;
    createAppointmentSuggestionsError.value = null;
    createAdmissionSuggestionsError.value = null;

    const [appointmentsResult, admissionsResult] = await Promise.allSettled([
        apiRequest<LinkedContextListResponse<AppointmentSummary>>(
            'GET',
            '/appointments',
            {
                query: {
                    patientId: normalizedId,
                    status: 'checked_in',
                    perPage: 3,
                    page: 1,
                    sortBy: 'scheduledAt',
                    sortDir: 'desc',
                },
            },
        ),
        apiRequest<LinkedContextListResponse<AdmissionSummary>>(
            'GET',
            '/admissions',
            {
                query: {
                    patientId: normalizedId,
                    status: 'admitted',
                    perPage: 3,
                    page: 1,
                    sortBy: 'admittedAt',
                    sortDir: 'desc',
                },
            },
        ),
    ]);

    if (requestId !== createContextSuggestionsRequestId) return;

    if (appointmentsResult.status === 'fulfilled') {
        createAppointmentSuggestions.value = (
            appointmentsResult.value.data ?? []
        ).filter(
            (appointment) =>
                (appointment.patientId?.trim() ?? '') === normalizedId &&
                (appointment.status?.trim().toLowerCase() ?? '') ===
                    'checked_in',
        );
        createAppointmentSuggestionsError.value = null;
    } else {
        createAppointmentSuggestions.value = [];
        createAppointmentSuggestionsError.value = isForbiddenError(
            appointmentsResult.reason,
        )
            ? null
            : messageFromUnknown(
                  appointmentsResult.reason,
                  'Unable to load appointment suggestions.',
              );
    }

    if (admissionsResult.status === 'fulfilled') {
        createAdmissionSuggestions.value = (
            admissionsResult.value.data ?? []
        ).filter(
            (admission) =>
                (admission.patientId?.trim() ?? '') === normalizedId &&
                (admission.status?.trim().toLowerCase() ?? '') === 'admitted',
        );
        createAdmissionSuggestionsError.value = null;
    } else {
        createAdmissionSuggestions.value = [];
        createAdmissionSuggestionsError.value = isForbiddenError(
            admissionsResult.reason,
        )
            ? null
            : messageFromUnknown(
                  admissionsResult.reason,
                  'Unable to load admission suggestions.',
              );
    }

    createAppointmentSuggestionsLoading.value = false;
    createAdmissionSuggestionsLoading.value = false;
    maybeAutoLinkCreateContextSuggestions();
}

async function loadOrders() {
    if (!canReadPharmacyOrders.value) {
        orders.value = [];
        pagination.value = null;
        listLoading.value = false;
        pageLoading.value = false;
        return;
    }

    listLoading.value = true;
    listErrors.value = [];

    try {
        const response = await apiRequest<PharmacyOrderListResponse>(
            'GET',
            '/pharmacy-orders',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    status: searchForm.status || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                    page: searchForm.page,
                    perPage: searchForm.perPage,
                    sortBy: searchForm.sortBy,
                    sortDir: searchForm.sortDir,
                },
            },
        );

        orders.value = response.data;
        pagination.value = response.meta;
        focusedQueueRowIndex.value = -1;
        void hydrateVisiblePatients(response.data);
    } catch (error) {
        orders.value = [];
        pagination.value = null;
        listErrors.value.push(
            error instanceof Error
                ? error.message
                : 'Unable to load pharmacy orders.',
        );
    } finally {
        listLoading.value = false;
        pageLoading.value = false;
    }
}

async function loadOrderStatusCounts() {
    if (!canReadPharmacyOrders.value) {
        pharmacyOrderStatusCounts.value = null;
        return;
    }

    try {
        const response = await apiRequest<PharmacyOrderStatusCountsResponse>(
            'GET',
            '/pharmacy-orders/status-counts',
            {
                query: {
                    q: searchForm.q.trim() || null,
                    patientId: searchForm.patientId.trim() || null,
                    from: searchForm.from
                        ? `${searchForm.from} 00:00:00`
                        : null,
                    to: searchForm.to ? `${searchForm.to} 23:59:59` : null,
                },
            },
        );
        pharmacyOrderStatusCounts.value = response.data;
    } catch {
        pharmacyOrderStatusCounts.value = null;
    }
}

function onPharmacyWalkInAcknowledged(payload: { patientId: string }): void {
    if (payload.patientId) {
        createForm.patientId = payload.patientId;
        createPatientContextLocked.value = false;
        void hydratePatientSummary(payload.patientId);
    }
    setPharmacyWorkspaceView('new', { focusCreate: true });
}

async function refreshPage() {
    clearSearchDebounce();
    await Promise.all([loadScope(), loadPharmacyPermissions()]);
    await Promise.all([
        loadOrders(),
        loadOrderStatusCounts(),
        loadApprovedMedicinesCatalog(),
        pharmacyWalkInPanelRef.value?.reload() ?? Promise.resolve(),
    ]);
    await applyPharmacyAuditExportRetryHandoff();
    await loadCreateLifecycleSourceOrder();
}

async function saveCreateDraftRequest(options?: {
    silent?: boolean;
    requireClinicalIndication?: boolean;
}): Promise<PharmacyOrder | null> {
    const draftItem = validateCurrentCreateOrderDraft({
        requireClinicalIndication: options?.requireClinicalIndication ?? false,
    });
    if (!draftItem) return null;
    if (!(await confirmPharmacyDuplicateOrdering(draftItem))) return null;

    const wasSavedDraft = hasSavedCreateDraft.value;
    try {
        const response = wasSavedDraft
            ? await apiRequest<{ data?: PharmacyOrder }>(
                'PATCH',
                `/pharmacy-orders/${createServerDraftId.value.trim()}`,
                {
                    body: {
                        approvedMedicineCatalogItemId:
                            draftItem.approvedMedicineCatalogItemId || null,
                        medicationCode: draftItem.medicationCode,
                        medicationName: draftItem.medicationName,
                        dosageInstruction: draftItem.dosageInstruction,
                        clinicalIndication: draftItem.clinicalIndication || null,
                        quantityPrescribed: Number(draftItem.quantityPrescribed),
                        dispensingNotes: draftItem.dispensingNotes,
                    },
                },
            )
            : await apiRequest<{ data?: PharmacyOrder }>(
                'POST',
                '/pharmacy-orders',
                {
                    body: buildCreatePharmacyOrderPayload(draftItem, {
                        replacesOrderId: createLifecycleReplaceOrderId.value || null,
                        addOnToOrderId: createLifecycleAddOnOrderId.value || null,
                        entryMode: 'draft',
                    }),
                },
            );

        const draft = response.data ?? null;
        createServerDraftId.value = draft?.id?.trim?.() ?? '';

        if (!options?.silent) {
            createMessage.value = wasSavedDraft
                ? 'Saved your pharmacy draft on this device. Sign it when you are ready.'
                : 'Pharmacy draft saved on this device. Sign it when you are ready.';
            notifySuccess('Pharmacy draft saved.');
        }

        return draft;
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }
        notifyError(
            messageFromUnknown(error, 'Unable to save pharmacy draft.'),
        );
        return null;
    }
}

async function createOrder() {
    if (createLoading.value) return;

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        const draft = await saveCreateDraftRequest({
            silent: true,
            requireClinicalIndication: true,
        });
        if (!draft?.id) return;

        const safetyDecision = await ensureMedicationSafetyForActiveSubmission({
            patientId: draft.patientId?.trim() ?? createForm.patientId.trim(),
            appointmentId: draft.appointmentId?.trim() ?? createForm.appointmentId.trim(),
            admissionId: draft.admissionId?.trim() ?? createForm.admissionId.trim(),
            approvedMedicineCatalogItemId:
                draft.approvedMedicineCatalogItemId?.trim() ??
                createForm.approvedMedicineCatalogItemId.trim(),
            medicationCode: draft.medicationCode?.trim() ?? createForm.medicationCode.trim(),
            medicationName: draft.medicationName?.trim() ?? createForm.medicationName.trim(),
            dosageInstruction:
                draft.dosageInstruction?.trim() ?? createForm.dosageInstruction.trim(),
            clinicalIndication:
                draft.clinicalIndication?.trim() ?? createForm.clinicalIndication.trim(),
            quantityPrescribed:
                draft.quantityPrescribed ?? createForm.quantityPrescribed,
            excludeOrderId: draft.id,
            dialogTitle: 'Review medication safety before signing',
        });

        if (safetyDecision === null) {
            createMessage.value =
                'Signing paused until the medication safety review is completed.';
            return;
        }

        const patientId = draft.patientId?.trim() ?? createForm.patientId.trim();
        const response = await apiRequest<{ data?: PharmacyOrder }>(
            'POST',
            `/pharmacy-orders/${draft.id}/sign`,
            {
                body: {
                    safetyAcknowledged: safetyDecision.acknowledged,
                    safetyOverrideCode: safetyDecision.overrideCode,
                    safetyOverrideReason: safetyDecision.overrideReason,
                },
            },
        );
        const signedOrder = response.data ?? draft;

        createMessage.value = `Signed ${signedOrder.orderNumber ?? 'pharmacy order'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        resetCreateOrderDraftFields();
        createServerDraftId.value = '';
        clearPersistedPharmacyCreateDraft();
        clearCreateLifecycleMode();
        searchForm.q =
            signedOrder.orderNumber?.trim() ||
            signedOrder.id ||
            '';
        searchForm.patientId = signedOrder.patientId?.trim() || patientId;
        searchForm.status = 'pending';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setPharmacyWorkspaceView('queue', { focusSearch: false });
        await Promise.all([loadOrders(), loadOrderStatusCounts()]);
        await nextTick();
        scrollToPharmacyQueueCard();
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        } else {
            notifyError(apiError.message ?? 'Unable to create pharmacy order.');
        }
    } finally {
        createLoading.value = false;
    }
}

async function saveCreateDraft(): Promise<void> {
    if (
        createLoading.value ||
        !canCreatePharmacyOrders.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceOrder.value === null
            )
        )
    ) {
        return;
    }

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        await saveCreateDraftRequest();
    } finally {
        createLoading.value = false;
    }
}

async function discardSavedCreateDraft(): Promise<void> {
    if (!hasSavedCreateDraft.value || createLoading.value) {
        return;
    }

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    try {
        await apiRequest(
            'DELETE',
            `/pharmacy-orders/${createServerDraftId.value.trim()}/draft`,
        );
        createServerDraftId.value = '';
        resetCreateOrderDraftFields();
        clearPersistedPharmacyCreateDraft();
        clearCreateLifecycleMode();
        createMessage.value = 'Discarded the saved pharmacy draft from this device.';
        notifySuccess('Pharmacy draft discarded.');
    } catch (error) {
        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }
        notifyError(
            messageFromUnknown(error, 'Unable to discard pharmacy draft.'),
        );
    } finally {
        createLoading.value = false;
    }
}

async function submitCreateOrderBasket() {
    if (
        createLoading.value ||
        !canUseCreateOrderBasket.value ||
        createOrderBasket.value.length === 0
    ) {
        return;
    }

    createLoading.value = true;
    resetCreateMessages();
    listErrors.value = [];

    const queuedItems = [...createOrderBasket.value];
    const safetyDecisions = new Map<string, MedicationSafetyContinuationDecision>();
    const createdOrders: PharmacyOrder[] = [];
    const orderSessionId = generateClinicalOrderSessionId('pharmacy-session');

    try {
        for (const item of queuedItems) {
            const decision = await ensureMedicationSafetyForActiveSubmission({
                patientId: item.patientId,
                appointmentId: item.appointmentId,
                admissionId: item.admissionId,
                approvedMedicineCatalogItemId: item.approvedMedicineCatalogItemId,
                medicationCode: item.medicationCode,
                medicationName: item.medicationName,
                dosageInstruction: item.dosageInstruction,
                clinicalIndication: item.clinicalIndication,
                quantityPrescribed: item.quantityPrescribed,
                dialogTitle: 'Review medication safety before basket submission',
            });

            if (decision === null) {
                createMessage.value =
                    'Pharmacy basket paused until the medication safety review is completed.';
                return;
            }

            safetyDecisions.set(item.clientKey, decision);
        }

        for (const item of queuedItems) {
            const decision = safetyDecisions.get(item.clientKey) ?? {
                acknowledged: false,
                overrideCode: null,
                overrideReason: null,
            };
            const response = await apiRequest<{ data: PharmacyOrder }>(
                'POST',
                '/pharmacy-orders',
                {
                    body: {
                        ...buildCreatePharmacyOrderPayload(item, {
                            orderSessionId,
                            entryMode: 'active',
                        }),
                        safetyAcknowledged: decision.acknowledged,
                        safetyOverrideCode: decision.overrideCode,
                        safetyOverrideReason: decision.overrideReason,
                    },
                },
            );

            createdOrders.push(response.data);
        }

        createOrderBasket.value = [];
        resetCreateOrderDraftFields();
        clearPersistedPharmacyCreateDraft();
        createMessage.value = `Created ${createdOrders.length} pharmacy ${createdOrders.length === 1 ? 'order' : 'orders'} successfully.`;
        if (createMessage.value) notifySuccess(createMessage.value);
        searchForm.q =
            createdOrders.length === 1
                ? createdOrders[0]?.orderNumber?.trim() ||
                  createdOrders[0]?.id ||
                  ''
                : '';
        searchForm.patientId = createdOrders[0]?.patientId?.trim() || '';
        searchForm.status = 'pending';
        searchForm.from = today;
        searchForm.to = '';
        searchForm.page = 1;
        setPharmacyWorkspaceView('queue', { focusSearch: false });
        await Promise.all([loadOrders(), loadOrderStatusCounts()]);
        await nextTick();
        scrollToPharmacyQueueCard();
    } catch (error) {
        const createdCount = createdOrders.length;
        const failedItem = queuedItems[createdCount] ?? null;
        const remainingItems = queuedItems.slice(createdCount + 1);
        createOrderBasket.value = remainingItems;

        if (failedItem) {
            restoreCreateOrderDraftFromBasketItem(failedItem);
        }

        const apiError = error as Error & {
            status?: number;
            payload?: ValidationErrorResponse;
        };
        if (apiError.status === 422 && apiError.payload?.errors) {
            createErrors.value = apiError.payload.errors;
            openCreateContextDialogForValidationErrors(apiError.payload.errors);
        }

        if (createdCount > 0) {
            createMessage.value = `Created ${createdCount} pharmacy ${createdCount === 1 ? 'order' : 'orders'} before the basket paused.`;
        }

        notifyError(
            createdCount > 0
                ? 'Pharmacy basket paused before all medicines were submitted.'
                : apiError.message ?? 'Unable to submit the pharmacy basket.',
        );

        if (!hasPendingCreateWorkflow.value) {
            clearPersistedPharmacyCreateDraft();
        }
    } finally {
        createLoading.value = false;
    }
}

async function openOrderDetailsSheet(
    order: PharmacyOrder,
    options?: {
        retryHandoffContext?: Pick<
            PharmacyAuditExportRetryHandoffContext,
            'statusGroup' | 'page' | 'perPage'
        >;
    },
) {
    resetDetailsAuditLogsFilters({ autoLoad: false });
    resetDetailsAuditExportJobsFilters({ autoLoad: false });
    resetDetailsAuditExpandedRows();
    detailsSheetAuditFiltersOpen.value = false;
    detailsSheetTab.value = 'overview';
    detailsSheetOverviewTab.value = 'summary';
    if (options?.retryHandoffContext) {
        applyPharmacyAuditExportRetryHandoffFilters(options.retryHandoffContext);
    }
    detailsSheetOrder.value = order;
    detailsSheetOpen.value = true;
    if (order.patientId?.trim()) {
        void hydratePatientSummary(order.patientId);
    }
    if (order.appointmentId?.trim()) {
        void hydrateAppointmentSummaryForDisplay(order.appointmentId);
    }
    if (order.admissionId?.trim()) {
        void hydrateAdmissionSummaryForDisplay(order.admissionId);
    }
    detailsSheetAuditLogs.value = [];
    detailsSheetAuditLogsMeta.value = null;
    detailsSheetAuditLogsError.value = null;
    detailsSheetAuditExportJobs.value = [];
    detailsSheetAuditExportJobsMeta.value = null;
    detailsSheetAuditExportJobsError.value = null;
    detailsSheetAuditExportFocusJobId.value = null;
    detailsSheetAuditExportPinnedHandoffJob.value = null;
    detailsSheetAuditExportHandoffMessage.value = null;
    detailsSheetAuditExportHandoffError.value = false;
    detailsSheetSafetyReview.value = null;
    detailsSheetSafetyReviewError.value = null;

    const detailLoads: Promise<unknown>[] = [];
    detailLoads.push(
        apiRequest<{ data: PharmacyOrder }>('GET', `/pharmacy-orders/${order.id}`)
            .then((response) => {
                if (detailsSheetOrder.value?.id !== order.id) return;

                detailsSheetOrder.value = response.data;

                return Promise.all([
                    ensureInventoryMedicationMatch(
                        response.data.medicationCode,
                        response.data.medicationName,
                        { force: true },
                    ),
                    ensureInventoryMedicationMatch(
                        orderDispenseTargetMedicationCode(response.data),
                        orderDispenseTargetMedicationName(response.data),
                        { force: true },
                    ),
                    response.data.patientId?.trim()
                        ? hydratePatientSummary(response.data.patientId)
                        : Promise.resolve(),
                    response.data.appointmentId?.trim()
                        ? hydrateAppointmentSummaryForDisplay(response.data.appointmentId)
                        : Promise.resolve(),
                    response.data.admissionId?.trim()
                        ? hydrateAdmissionSummaryForDisplay(response.data.admissionId)
                        : Promise.resolve(),
                ]);
            })
            .catch(() => null),
    );
    detailLoads.push(loadOrderSafetyReview(order.id));
    if (canViewPharmacyOrderAuditLogs.value) {
        detailLoads.push(loadOrderAuditLogs(order.id));
        detailLoads.push(loadOrderAuditExportJobs(order.id));
    }
    if (detailLoads.length > 0) {
        await Promise.allSettled(detailLoads);
    }
}

function closeOrderDetailsSheet() {
    detailsSheetOpen.value = false;
    detailsSheetOrder.value = null;
    detailsSheetTab.value = 'overview';
    detailsSheetOverviewTab.value = 'summary';
    resetDetailsAuditExpandedRows();
    detailsSheetAuditFiltersOpen.value = false;
    detailsSheetAuditLogs.value = [];
    detailsSheetAuditLogsMeta.value = null;
    detailsSheetAuditLogsError.value = null;
    detailsSheetAuditExportJobs.value = [];
    detailsSheetAuditExportJobsMeta.value = null;
    detailsSheetAuditExportJobsError.value = null;
    detailsSheetAuditExportRetryingJobId.value = null;
    detailsSheetAuditExportFocusJobId.value = null;
    detailsSheetAuditExportPinnedHandoffJob.value = null;
    detailsSheetAuditExportHandoffMessage.value = null;
    detailsSheetAuditExportHandoffError.value = false;
    detailsSheetSafetyReview.value = null;
    detailsSheetSafetyReviewError.value = null;
    detailsSheetSafetyReviewLoading.value = false;
}

async function loadOrderSafetyReview(orderId: string) {
    if (!orderId.trim()) return;

    detailsSheetSafetyReviewLoading.value = true;
    detailsSheetSafetyReviewError.value = null;

    try {
        const response = await apiRequest<PharmacyOrderSafetyReviewResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/safety-review`,
        );

        if (detailsSheetOrder.value?.id !== orderId) return;
        detailsSheetSafetyReview.value = response.data;
    } catch (error) {
        if (detailsSheetOrder.value?.id !== orderId) return;
        detailsSheetSafetyReviewError.value = messageFromUnknown(
            error,
            'Unable to load pharmacy safety review.',
        );
    } finally {
        if (detailsSheetOrder.value?.id === orderId) {
            detailsSheetSafetyReviewLoading.value = false;
        }
    }
}

async function loadStatusDialogSafetyReview(orderId: string) {
    if (!orderId.trim()) return;

    statusDialogSafetyReviewLoading.value = true;
    statusDialogSafetyReviewError.value = null;

    try {
        const response = await apiRequest<PharmacyOrderSafetyReviewResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/safety-review`,
        );

        if (statusDialogOrder.value?.id !== orderId) return;
        statusDialogSafetyReview.value = response.data;
    } catch (error) {
        if (statusDialogOrder.value?.id !== orderId) return;
        statusDialogSafetyReview.value = null;
        statusDialogSafetyReviewError.value = messageFromUnknown(
            error,
            'Unable to load safety review for this workflow step.',
        );
    } finally {
        if (statusDialogOrder.value?.id === orderId) {
            statusDialogSafetyReviewLoading.value = false;
        }
    }
}

async function loadPolicyDialogSafetyReview(orderId: string) {
    if (!orderId.trim()) return;

    policyDialogSafetyReviewLoading.value = true;
    policyDialogSafetyReviewError.value = null;

    try {
        const response = await apiRequest<PharmacyOrderSafetyReviewResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/safety-review`,
        );

        if (policyDialogOrder.value?.id !== orderId) return;
        policyDialogSafetyReview.value = response.data;
    } catch (error) {
        if (policyDialogOrder.value?.id !== orderId) return;
        policyDialogSafetyReview.value = null;
        policyDialogSafetyReviewError.value = messageFromUnknown(
            error,
            'Unable to load policy recommendation for this order.',
        );
    } finally {
        if (policyDialogOrder.value?.id === orderId) {
            policyDialogSafetyReviewLoading.value = false;
        }
    }
}

function detailsSheetAuditLogsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        q: detailsSheetAuditLogsFilters.q.trim() || null,
        action: detailsSheetAuditLogsFilters.action.trim() || null,
        actorType: detailsSheetAuditLogsFilters.actorType || null,
        actorId: detailsSheetAuditLogsFilters.actorId.trim() || null,
        from: detailsSheetAuditLogsFilters.from
            ? `${detailsSheetAuditLogsFilters.from} 00:00:00`
            : null,
        to: detailsSheetAuditLogsFilters.to
            ? `${detailsSheetAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function detailsSheetAuditLogsExportQuery() {
    return {
        q: detailsSheetAuditLogsFilters.q.trim() || null,
        action: detailsSheetAuditLogsFilters.action.trim() || null,
        actorType: detailsSheetAuditLogsFilters.actorType || null,
        actorId: detailsSheetAuditLogsFilters.actorId.trim() || null,
        from: detailsSheetAuditLogsFilters.from
            ? `${detailsSheetAuditLogsFilters.from} 00:00:00`
            : null,
        to: detailsSheetAuditLogsFilters.to
            ? `${detailsSheetAuditLogsFilters.to} 23:59:59`
            : null,
    };
}

function detailsSheetAuditExportJobsQuery(page: number, perPage: number) {
    return {
        page,
        perPage,
        statusGroup: detailsSheetAuditExportJobsFilters.statusGroup,
    };
}

async function loadOrderAuditLogs(orderId: string) {
    if (!canViewPharmacyOrderAuditLogs.value) {
        detailsSheetAuditLogsLoading.value = false;
        detailsSheetAuditLogsError.value = null;
        detailsSheetAuditLogs.value = [];
        detailsSheetAuditLogsMeta.value = null;
        return;
    }

    detailsSheetAuditLogsLoading.value = true;
    detailsSheetAuditLogsError.value = null;

    try {
        const response = await apiRequest<PharmacyOrderAuditLogListResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/audit-logs`,
            {
                query: detailsSheetAuditLogsQuery(
                    detailsSheetAuditLogsFilters.page,
                    detailsSheetAuditLogsFilters.perPage,
                ),
            },
        );

        detailsSheetAuditLogs.value = response.data;
        detailsSheetAuditLogsMeta.value = response.meta;
    } catch (error) {
        detailsSheetAuditLogs.value = [];
        detailsSheetAuditLogsMeta.value = null;
        detailsSheetAuditLogsError.value = messageFromUnknown(
            error,
            'Unable to load pharmacy audit trail.',
        );
    } finally {
        detailsSheetAuditLogsLoading.value = false;
    }
}

async function loadOrderAuditExportJobs(orderId: string) {
    if (!canViewPharmacyOrderAuditLogs.value) {
        detailsSheetAuditExportJobsLoading.value = false;
        detailsSheetAuditExportJobsError.value = null;
        detailsSheetAuditExportJobs.value = [];
        detailsSheetAuditExportJobsMeta.value = null;
        return;
    }

    detailsSheetAuditExportJobsLoading.value = true;
    detailsSheetAuditExportJobsError.value = null;

    try {
        const response = await apiRequest<PharmacyOrderAuditExportJobListResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/audit-logs/export-jobs`,
            {
                query: detailsSheetAuditExportJobsQuery(
                    detailsSheetAuditExportJobsFilters.page,
                    detailsSheetAuditExportJobsFilters.perPage,
                ),
            },
        );

        detailsSheetAuditExportJobs.value = response.data;
        detailsSheetAuditExportJobsMeta.value = response.meta;
        if (
            detailsSheetAuditExportPinnedHandoffJob.value &&
            response.data.some(
                (job) =>
                    job.id === detailsSheetAuditExportPinnedHandoffJob.value?.id,
            )
        ) {
            detailsSheetAuditExportPinnedHandoffJob.value = null;
        }
    } catch (error) {
        detailsSheetAuditExportJobs.value = [];
        detailsSheetAuditExportJobsMeta.value = null;
        detailsSheetAuditExportJobsError.value = messageFromUnknown(
            error,
            'Unable to load audit export jobs.',
        );
    } finally {
        detailsSheetAuditExportJobsLoading.value = false;
    }
}

async function fetchPharmacyAuditExportJobById(
    orderId: string,
    jobId: string,
): Promise<PharmacyOrderAuditExportJob | null> {
    try {
        const response = await apiRequest<PharmacyOrderAuditExportJobResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
        );
        return response.data;
    } catch {
        return null;
    }
}

function clearPharmacyAuditExportRetryHandoffQueryParams() {
    if (typeof window === 'undefined') return;

    const url = new URL(window.location.href);
    const keys = [
        'auditExportJobId',
        'auditAction',
        'auditExportStatusGroup',
        'auditExportPage',
        'auditExportPerPage',
    ];

    let changed = false;
    for (const key of keys) {
        if (!url.searchParams.has(key)) continue;
        url.searchParams.delete(key);
        changed = true;
    }

    if (!changed) return;

    const nextSearch = url.searchParams.toString();
    const nextUrl = `${url.pathname}${nextSearch ? `?${nextSearch}` : ''}${url.hash}`;
    window.history.replaceState(window.history.state, '', nextUrl);
}

async function focusPharmacyAuditExportRetryHandoff(
    jobId: string,
): Promise<boolean> {
    if (!jobId || !detailsSheetOrder.value) return false;

    const focusJob = detailsSheetAuditExportJobs.value.find(
        (job) => job.id === jobId,
    );
    if (focusJob) {
        detailsSheetAuditExportFocusJobId.value = focusJob.id;
        detailsSheetAuditExportPinnedHandoffJob.value = null;
        detailsSheetAuditExportHandoffError.value = false;
        detailsSheetAuditExportHandoffMessage.value =
            'Retry handoff active. Use the highlighted export job retry action.';

        await nextTick();
        const row = document.getElementById(`pha-audit-export-job-${focusJob.id}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const retryButton = row?.querySelector<HTMLButtonElement>(
            `[data-audit-export-retry-job-id="${focusJob.id}"]`,
        );
        retryButton?.focus();
        return true;
    }

    const resolvedJob = await fetchPharmacyAuditExportJobById(
        detailsSheetOrder.value.id,
        jobId,
    );
    if (!resolvedJob) {
        detailsSheetAuditExportFocusJobId.value = null;
        detailsSheetAuditExportPinnedHandoffJob.value = null;
        detailsSheetAuditExportHandoffError.value = true;
        detailsSheetAuditExportHandoffMessage.value =
            'Retry handoff loaded this order, but the target export job could not be resolved. Refresh jobs and retry from this order details sheet.';
        return false;
    }

    detailsSheetAuditExportPinnedHandoffJob.value = resolvedJob;
    detailsSheetAuditExportFocusJobId.value = resolvedJob.id;
    detailsSheetAuditExportHandoffError.value = false;
    detailsSheetAuditExportHandoffMessage.value =
        'Retry handoff resolved a job outside the current page. Use the pinned handoff row below.';

    await nextTick();
    const row = document.getElementById(
        `pha-audit-export-job-handoff-${resolvedJob.id}`,
    );
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const retryButton = row?.querySelector<HTMLButtonElement>(
        `[data-audit-export-retry-job-id="${resolvedJob.id}"]`,
    );
    retryButton?.focus();
    return true;
}

function applyPharmacyAuditExportRetryHandoffFilters(
    context: Pick<
        PharmacyAuditExportRetryHandoffContext,
        'statusGroup' | 'page' | 'perPage'
    >,
) {
    detailsSheetAuditExportJobsFilters.statusGroup = context.statusGroup;
    detailsSheetAuditExportJobsFilters.page = context.page;
    detailsSheetAuditExportJobsFilters.perPage = context.perPage;
}

async function fetchPharmacyOrderById(
    orderId: string,
): Promise<PharmacyOrder | null> {
    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'GET',
            `/pharmacy-orders/${orderId}`,
        );
        return response.data;
    } catch {
        return null;
    }
}

function clearQueryParamFromUrl(name: string) {
    const url = new URL(window.location.href);
    if (!url.searchParams.has(name)) return;
    url.searchParams.delete(name);
    window.history.replaceState(window.history.state, '', url.toString());
}

async function applyFocusedOrderFromQuery() {
    const orderId = queryParam('focusOrderId').trim();
    const workflowActionKey = queryParam('focusWorkflowActionKey').trim();
    if (!orderId) return;

    let targetOrder = orders.value.find((order) => order.id === orderId) ?? null;
    if (!targetOrder) {
        targetOrder = await fetchPharmacyOrderById(orderId);
    }

    if (targetOrder) {
        const workflowOpened = applyFocusedWorkflowActionFromQuery(
            targetOrder,
            workflowActionKey,
        );

        if (!workflowOpened) {
            await openOrderDetailsSheet(targetOrder);
        }
    } else {
        listErrors.value.push('Unable to open the requested pharmacy order from the patient chart.');
    }

    clearQueryParamFromUrl('focusOrderId');
    clearQueryParamFromUrl('focusWorkflowActionKey');
}

function applyFocusedWorkflowActionFromQuery(
    order: PharmacyOrder,
    actionKey: string,
): boolean {
    switch (actionKey) {
        case 'verify_dispense':
            if (canVerifyPharmacyDispense.value && orderNeedsVerification(order)) {
                openOrderStatusDialog(order, 'verify');
                return true;
            }
            return false;
        case 'review_reconciliation':
        case 'resolve_reconciliation':
            if (canReconcilePharmacyOrders.value && canOpenReconciliationAction(order)) {
                openReconciliationDialog(order);
                return true;
            }
            return false;
        case 'review_policy':
            if (canManagePharmacyPolicy.value && orderNeedsPolicyAttention(order)) {
                openPolicyDialog(order);
                return true;
            }
            return false;
        case 'start_preparation':
            if (
                canUpdatePharmacyOrderStatus.value &&
                (order.status ?? '').trim().toLowerCase() === 'pending'
            ) {
                openOrderStatusDialog(order, 'in_preparation');
                return true;
            }
            return false;
        case 'record_dispense':
            if (
                canUpdatePharmacyOrderStatus.value &&
                (order.status ?? '').trim().toLowerCase() === 'in_preparation'
            ) {
                openOrderStatusDialog(order, 'dispensed');
                return true;
            }
            return false;
        case 'complete_dispense':
            if (
                canUpdatePharmacyOrderStatus.value &&
                (order.status ?? '').trim().toLowerCase() === 'partially_dispensed'
            ) {
                openOrderStatusDialog(order, 'dispensed');
                return true;
            }
            return false;
        default:
            return false;
    }
}

async function applyPharmacyAuditExportRetryHandoff() {
    if (!auditExportRetryHandoffPending.value) return;
    auditExportRetryHandoffPending.value = false;
    auditExportRetryHandoffCompletedMessage.value = null;

    const targetOrderId = searchForm.q.trim();
    if (!targetOrderId) {
        listErrors.value.push(
            'Audit export retry handoff skipped: target pharmacy order was not provided.',
        );
        return;
    }

    let targetOrder = orders.value.find((order) => order.id === targetOrderId);
    if (!targetOrder) {
        targetOrder = await fetchPharmacyOrderById(targetOrderId);
        if (!targetOrder) {
            listErrors.value.push(
                'Audit export retry handoff target is not visible in current pharmacy queue results, and direct order lookup failed.',
            );
            return;
        }
    }

    const handoffContext: PharmacyAuditExportRetryHandoffContext = {
        targetOrderId,
        jobId: auditExportRetryHandoffJobId,
        statusGroup: auditExportRetryHandoffStatusGroup,
        page: auditExportRetryHandoffPage,
        perPage: auditExportRetryHandoffPerPage,
        savedAt: new Date().toISOString(),
    };

    await openOrderDetailsSheet(targetOrder, {
        retryHandoffContext: handoffContext,
    });
    const focused = await focusPharmacyAuditExportRetryHandoff(
        handoffContext.jobId,
    );
    if (focused) {
        clearPharmacyAuditExportRetryHandoffQueryParams();
        persistPharmacyAuditExportRetryHandoff(handoffContext);
        auditExportRetryHandoffCompletedMessage.value =
            `Retry handoff ready for pharmacy order ${targetOrder.id} (export job ${auditExportRetryHandoffJobId}).`;
    }
}

async function resumeLastPharmacyAuditExportRetryHandoff() {
    const context = lastPharmacyAuditExportRetryHandoff.value;
    if (!context || resumingPharmacyAuditExportRetryHandoff.value) return;

    const telemetryContext: PharmacyAuditExportRetryResumeTelemetryEventContext = {
        targetResourceId: context.targetOrderId,
        exportJobId: context.jobId,
        handoffStatusGroup: context.statusGroup,
        handoffPage: context.page,
        handoffPerPage: context.perPage,
    };

    resumingPharmacyAuditExportRetryHandoff.value = true;
    auditExportRetryHandoffCompletedMessage.value = null;
    recordPharmacyAuditExportRetryResumeAttempt(telemetryContext);

    try {
        let targetOrder = orders.value.find(
            (order) => order.id === context.targetOrderId,
        );
        if (!targetOrder) {
            targetOrder = await fetchPharmacyOrderById(context.targetOrderId);
            if (!targetOrder) {
                recordPharmacyAuditExportRetryResumeFailure(
                    'target_order_lookup_failed',
                    telemetryContext,
                );
                listErrors.value.push(
                    'Unable to resume last pharmacy retry handoff target. The order could not be loaded.',
                );
                return;
            }
        }

        const resumeContext: PharmacyAuditExportRetryHandoffContext = {
            ...context,
            savedAt: new Date().toISOString(),
        };

        await openOrderDetailsSheet(targetOrder, {
            retryHandoffContext: resumeContext,
        });
        const focused = await focusPharmacyAuditExportRetryHandoff(
            resumeContext.jobId,
        );
        if (!focused) {
            recordPharmacyAuditExportRetryResumeFailure(
                'target_export_job_focus_failed',
                telemetryContext,
            );
            listErrors.value.push(
                'Unable to resume last pharmacy retry handoff focus. The export job could not be resolved.',
            );
            return;
        }

        recordPharmacyAuditExportRetryResumeSuccess(telemetryContext);
        persistPharmacyAuditExportRetryHandoff(resumeContext);
        auditExportRetryHandoffCompletedMessage.value =
            `Resumed retry handoff for pharmacy order ${resumeContext.targetOrderId} (export job ${resumeContext.jobId}).`;
    } finally {
        resumingPharmacyAuditExportRetryHandoff.value = false;
    }
}

function resetDetailsAuditLogsFilters(options?: { autoLoad?: boolean }) {
    detailsSheetAuditLogsFilters.q = '';
    detailsSheetAuditLogsFilters.action = '';
    detailsSheetAuditLogsFilters.actorType = '';
    detailsSheetAuditLogsFilters.actorId = '';
    detailsSheetAuditLogsFilters.from = '';
    detailsSheetAuditLogsFilters.to = '';
    detailsSheetAuditLogsFilters.perPage = 20;
    detailsSheetAuditLogsFilters.page = 1;

    if (options?.autoLoad !== false && detailsSheetOrder.value) {
        void loadOrderAuditLogs(detailsSheetOrder.value.id);
    }
}

function submitDetailsAuditLogsFilters() {
    if (!detailsSheetOrder.value) return;
    detailsSheetAuditLogsFilters.page = 1;
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function resetDetailsAuditExportJobsFilters(options?: { autoLoad?: boolean }) {
    detailsSheetAuditExportJobsFilters.statusGroup = 'all';
    detailsSheetAuditExportJobsFilters.perPage = 8;
    detailsSheetAuditExportJobsFilters.page = 1;

    if (options?.autoLoad !== false && detailsSheetOrder.value) {
        void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
    }
}

function submitDetailsAuditExportJobsFilters() {
    if (!detailsSheetOrder.value) return;
    detailsSheetAuditExportJobsFilters.page = 1;
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function prevDetailsAuditExportJobsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditExportJobsMeta.value) return;
    if (detailsSheetAuditExportJobsMeta.value.currentPage <= 1) return;
    detailsSheetAuditExportJobsFilters.page = Math.max(
        detailsSheetAuditExportJobsMeta.value.currentPage - 1,
        1,
    );
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function nextDetailsAuditExportJobsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditExportJobsMeta.value) return;
    if (
        detailsSheetAuditExportJobsMeta.value.currentPage >=
        detailsSheetAuditExportJobsMeta.value.lastPage
    ) {
        return;
    }

    detailsSheetAuditExportJobsFilters.page = Math.min(
        detailsSheetAuditExportJobsMeta.value.currentPage + 1,
        detailsSheetAuditExportJobsMeta.value.lastPage,
    );
    void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
}

function prevDetailsAuditLogsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditLogsMeta.value) return;
    if (detailsSheetAuditLogsMeta.value.currentPage <= 1) return;
    detailsSheetAuditLogsFilters.page = Math.max(
        detailsSheetAuditLogsMeta.value.currentPage - 1,
        1,
    );
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function nextDetailsAuditLogsPage() {
    if (!detailsSheetOrder.value || !detailsSheetAuditLogsMeta.value) return;
    if (
        detailsSheetAuditLogsMeta.value.currentPage >=
        detailsSheetAuditLogsMeta.value.lastPage
    ) {
        return;
    }

    detailsSheetAuditLogsFilters.page = Math.min(
        detailsSheetAuditLogsMeta.value.currentPage + 1,
        detailsSheetAuditLogsMeta.value.lastPage,
    );
    void loadOrderAuditLogs(detailsSheetOrder.value.id);
}

function openPolicyDialog(order: PharmacyOrder) {
    if (!canManagePharmacyPolicy.value) {
        notifyError('Policy review requires pharmacy policy permission.');
        return;
    }

    const matchedSubstitutionItem = findApprovedMedicineCatalogItem(
        order.substitutedMedicationCode,
        order.substitutedMedicationName,
    );

    policyDialogOrder.value = order;
    policyDialogError.value = null;
    policyDialogSafetyReview.value = null;
    policyDialogSafetyReviewError.value = null;
    policyDialogSafetyReviewLoading.value = false;
    policyDialogForm.formularyDecisionStatus =
        (order.formularyDecisionStatus as string) || 'not_reviewed';
    policyDialogForm.formularyDecisionReason = order.formularyDecisionReason ?? '';
    policyDialogForm.substitutionAllowed = Boolean(order.substitutionAllowed);
    policyDialogForm.substitutionMade = Boolean(order.substitutionMade);
    policyDialogForm.substitutionSelectionMode =
        order.substitutionMade && matchedSubstitutionItem === null
            ? 'outside_list'
            : 'approved';
    policyDialogForm.substitutedMedicationCatalogItemId =
        matchedSubstitutionItem?.id ?? '';
    policyDialogForm.substitutedMedicationCode =
        order.substitutedMedicationCode ?? '';
    policyDialogForm.substitutedMedicationName =
        order.substitutedMedicationName ?? '';
    policyDialogForm.substitutionReason = order.substitutionReason ?? '';
    policyDialogTab.value = 'decision';
    void loadPolicyDialogSafetyReview(order.id);
    policyDialogOpen.value = true;
}

function closePolicyDialog() {
    policyDialogOpen.value = false;
    policyDialogSafetyReview.value = null;
    policyDialogSafetyReviewError.value = null;
    policyDialogSafetyReviewLoading.value = false;
    policyDialogError.value = null;
    policyDialogTab.value = 'decision';
}

function syncPolicyDialogSubstitutionSelection() {
    if (policyDialogForm.substitutionSelectionMode !== 'approved') {
        return;
    }

    const catalogItemId = policyDialogForm.substitutedMedicationCatalogItemId.trim();
    if (!catalogItemId) {
        policyDialogForm.substitutedMedicationCode = '';
        policyDialogForm.substitutedMedicationName = '';
        return;
    }

    const catalogItem =
        approvedMedicinesCatalogItems.value.find((item) => item.id === catalogItemId) ??
        null;
    if (catalogItem === null) return;

    policyDialogForm.substitutedMedicationCode = catalogItem.code?.trim() ?? '';
    policyDialogForm.substitutedMedicationName = catalogItem.name?.trim() ?? '';
}

function openReconciliationDialog(order: PharmacyOrder) {
    if (!canReconcilePharmacyOrders.value) {
        notifyError('Medication reconciliation requires pharmacy reconciliation permission.');
        return;
    }

    const normalizedStatus = (order.reconciliationStatus ?? '').trim().toLowerCase();

    reconciliationDialogOrder.value = order;
    reconciliationDialogError.value = null;
    reconciliationDialogForm.reconciliationStatus =
        normalizedStatus === 'exception'
            ? 'exception'
            : normalizedStatus === 'pending'
              ? 'pending'
              : 'completed';
    reconciliationDialogForm.reconciliationDecision =
        normalizedStatus === 'completed'
            ? ((order.reconciliationDecision ?? '').trim() as string)
            : '';
    reconciliationDialogForm.reconciliationNote = order.reconciliationNote ?? '';
    reconciliationDialogTab.value = 'status';
    reconciliationDialogOpen.value = true;
}

function closeReconciliationDialog() {
    reconciliationDialogOpen.value = false;
    reconciliationDialogOrder.value = null;
    reconciliationDialogError.value = null;
    reconciliationDialogForm.reconciliationStatus = 'completed';
    reconciliationDialogForm.reconciliationDecision = '';
    reconciliationDialogForm.reconciliationNote = '';
    reconciliationDialogTab.value = 'status';
}

function canOpenOrderStatusAction(status: PharmacyOrderStatusAction): boolean {
    return status === 'verify'
        ? canVerifyPharmacyDispense.value
        : canUpdatePharmacyOrderStatus.value;
}

function canExecutePharmacyWorkflowAction(
    actionId:
        | 'policy'
        | 'preparation'
        | 'partial'
        | 'dispense'
        | 'verify'
        | 'reconciliation',
): boolean {
    if (actionId === 'policy') return canManagePharmacyPolicy.value;
    if (actionId === 'reconciliation') return canReconcilePharmacyOrders.value;
    if (actionId === 'verify') return canVerifyPharmacyDispense.value;
    return canUpdatePharmacyOrderStatus.value;
}

function canShowPharmacyWorkloadCard(cardId: PharmacyWorkloadCardId): boolean {
    if (cardId === 'policy') return canManagePharmacyPolicy.value;
    if (cardId === 'reconciliation') return canReconcilePharmacyOrders.value;
    if (cardId === 'verification') return canVerifyPharmacyDispense.value;
    return canUpdatePharmacyOrderStatus.value;
}

function openOrderStatusDialog(
    order: PharmacyOrder,
    status: PharmacyOrderStatusAction,
) {
    if (!canOpenOrderStatusAction(status)) {
        notifyError(
            status === 'verify'
                ? 'Dispense verification requires pharmacy verification permission.'
                : 'Order status updates require pharmacy workflow permission.',
        );
        return;
    }

    statusDialogOrder.value = order;
    statusDialogAction.value = status;
    statusDialogError.value = null;
    statusDialogReason.value = status === 'cancelled' ? (order.statusReason ?? '') : '';
    statusDialogDispensingNotes.value = order.dispensingNotes ?? '';
    statusDialogVerificationNote.value =
        status === 'verify' ? (order.verificationNote ?? '') : '';
    statusDialogSafetyReview.value = null;
    statusDialogSafetyReviewError.value = null;
    statusDialogSafetyReviewLoading.value = false;

    if (canUpdatePharmacyOrderStatus.value && status === 'partially_dispensed') {
        statusDialogQuantityDispensed.value =
            order.quantityDispensed === null || order.quantityDispensed === undefined
                ? ''
                : String(order.quantityDispensed);
    } else if (status === 'dispensed') {
        statusDialogQuantityDispensed.value =
            order.quantityPrescribed === null || order.quantityPrescribed === undefined
                ? ''
                : String(order.quantityPrescribed);
    } else {
        statusDialogQuantityDispensed.value = '';
    }

    resetStructuredDispenseNoteComposer(order);
    void loadStatusDialogSafetyReview(order.id);
    statusDialogOpen.value = true;
}

function resetStructuredDispenseNoteComposer(order?: PharmacyOrder | null) {
    statusDialogVerifyPrescription.value = true;
    statusDialogCounseledPatient.value = false;
    statusDialogBatchLotNumber.value = '';
    statusDialogExpiryDate.value = '';
    statusDialogSubstitutionMade.value =
        Boolean(order?.substitutionMade) || Boolean(order && hasSubstitutionInDispenseNotes(order));
    statusDialogSubstitutionNote.value =
        order?.substitutionReason?.trim() ||
        [order?.substitutedMedicationCode, order?.substitutedMedicationName]
            .filter(Boolean)
            .join(' - ');
    statusDialogFollowUpAdvice.value = '';
}

function closeOrderStatusDialog() {
    statusDialogOpen.value = false;
    statusDialogError.value = null;
    statusDialogVerificationNote.value = '';
    statusDialogSafetyReview.value = null;
    statusDialogSafetyReviewError.value = null;
    statusDialogSafetyReviewLoading.value = false;
    resetStructuredDispenseNoteComposer();
}

const statusDialogTitle = computed(() => {
    const action = statusDialogAction.value;
    const order = statusDialogOrder.value;
    const hasSubstitution = order ? hasSubstitutionInDispenseNotes(order) : false;
    if (!action) return 'Update Pharmacy Order';
    if (action === 'in_preparation') return 'Start Preparation';
    if (action === 'partially_dispensed') {
        return hasSubstitution
            ? 'Record Partial Substitute Dispense'
            : 'Record Partial Dispense';
    }
    if (action === 'dispensed') {
        return hasSubstitution ? 'Dispense Substitute' : 'Dispense Medication';
    }
    if (action === 'verify') {
        return hasSubstitution ? 'Verify Substitute Release' : 'Verify + Release';
    }
    return 'Cancel Pharmacy Order';
});

const statusDialogDescription = computed(() => {
    const order = statusDialogOrder.value;
    const action = statusDialogAction.value;
    const label = order?.orderNumber ?? 'pharmacy order';
    const dispenseTarget = order ? orderDispenseTargetDisplay(order) : 'the medicine';
    const substitutionText = order ? orderSubstitutionHandoffText(order) : null;
    if (!action) return 'Update pharmacy order status.';
    if (action === 'in_preparation') return `Add an optional preparation note for ${label}.`;
    if (action === 'partially_dispensed')
        return substitutionText
            ? `Quantity dispensed is required for partial release on ${label}. ${substitutionText}`
            : `Quantity dispensed is required for partial dispense on ${label}.`;
    if (action === 'dispensed')
        return substitutionText
            ? `Record final dispense quantity and notes for ${label}. Release target: ${dispenseTarget}.`
            : `Record final dispense quantity and notes for ${label}.`;
    if (action === 'verify')
        return substitutionText
            ? `Review and verify the substitute medicine release for ${label}.`
            : `Review and verify the dispensed medication release for ${label}.`;
    return `Cancellation reason is required before cancelling ${label}.`;
});

const statusDialogSubstitutionHandoffSummary = computed(() => {
    if (!statusDialogOrder.value) return null;
    return orderSubstitutionHandoffText(statusDialogOrder.value);
});

const statusDialogNeedsReason = computed(
    () => statusDialogAction.value === 'cancelled',
);
const statusDialogShowsQuantity = computed(
    () =>
        statusDialogAction.value === 'partially_dispensed' ||
        statusDialogAction.value === 'dispensed',
);
const statusDialogQuantityRequired = computed(
    () => statusDialogAction.value === 'partially_dispensed',
);
const statusDialogShowsNotes = computed(
    () => statusDialogAction.value !== null && statusDialogAction.value !== 'verify',
);
const statusDialogNeedsVerificationNote = computed(
    () => statusDialogAction.value === 'verify',
);
const statusDialogSubstitutionVerificationNoteRequired = computed(() => {
    if (!statusDialogNeedsVerificationNote.value) return false;
    if (statusDialogOrder.value?.substitutionMade) return true;
    const notes = statusDialogOrder.value?.dispensingNotes ?? '';
    return notes.toLowerCase().includes('substitution: yes');
});
const statusDialogShowsStructuredDispenseComposer = computed(
    () =>
        statusDialogAction.value === 'partially_dispensed' ||
        statusDialogAction.value === 'dispensed',
);

const statusDialogStructuredDispenseSummary = computed(() => {
    if (!statusDialogShowsStructuredDispenseComposer.value) return '';

    const lines: string[] = [];
    const actionLabel =
        statusDialogAction.value === 'partially_dispensed'
            ? 'Partial dispense verification'
            : 'Dispense verification';
    lines.push(actionLabel);

    const quantity = statusDialogQuantityDispensed.value.trim();
    if (quantity) {
        lines.push(`Quantity dispensed: ${quantity}`);
    }

    const checks: string[] = [];
    if (statusDialogVerifyPrescription.value) checks.push('prescription verified');
    if (statusDialogCounseledPatient.value) checks.push('patient counseled');
    if (checks.length > 0) {
        lines.push(`Checks: ${checks.join(', ')}`);
    }

    const lot = statusDialogBatchLotNumber.value.trim();
    if (lot) {
        lines.push(`Batch/Lot: ${lot}`);
    }

    const expiryDate = statusDialogExpiryDate.value.trim();
    if (expiryDate) {
        lines.push(`Expiry date: ${expiryDate}`);
    }

    if (statusDialogSubstitutionMade.value) {
        const substitutionNote = statusDialogSubstitutionNote.value.trim();
        lines.push(
            substitutionNote
                ? `Substitution: yes (${substitutionNote})`
                : 'Substitution: yes',
        );
    }

    const followUpAdvice = statusDialogFollowUpAdvice.value.trim();
    if (followUpAdvice) {
        lines.push(`Counseling/Follow-up: ${followUpAdvice}`);
    }

    return lines.join('\n');
});

function applyStructuredDispenseSummaryToNotes(mode: 'replace' | 'append') {
    const summary = statusDialogStructuredDispenseSummary.value.trim();
    if (!summary) {
        statusDialogError.value =
            'Enter at least one dispense verification detail before generating notes.';
        return;
    }

    statusDialogError.value = null;

    if (mode === 'replace') {
        statusDialogDispensingNotes.value = summary;
        return;
    }

    const current = statusDialogDispensingNotes.value.trim();
    statusDialogDispensingNotes.value = current
        ? `${current}\n\n${summary}`
        : summary;
}

async function submitOrderStatusDialog() {
    if (!statusDialogOrder.value || !statusDialogAction.value) return;

    let reason: string | null = null;
    let quantityDispensed: number | null = null;
    let dispensingNotes: string | null = null;
    let verificationNote: string | null = null;

    if (statusDialogNeedsReason.value) {
        reason = statusDialogReason.value.trim();
        if (!reason) {
            statusDialogError.value = 'Cancellation reason is required.';
            return;
        }
    }

    if (statusDialogShowsQuantity.value) {
        const trimmed = statusDialogQuantityDispensed.value.trim();
        if (trimmed !== '') {
            const parsed = Number(trimmed);
            if (!Number.isFinite(parsed) || parsed < 0) {
                statusDialogError.value = 'Quantity dispensed must be a valid number.';
                return;
            }
            quantityDispensed = parsed;
        } else if (statusDialogQuantityRequired.value) {
            statusDialogError.value = 'Quantity dispensed is required for partial dispense.';
            return;
        }
    }

    if (statusDialogNeedsVerificationNote.value) {
        verificationNote = statusDialogVerificationNote.value.trim() || null;
        if (
            statusDialogSubstitutionVerificationNoteRequired.value &&
            !verificationNote
        ) {
            statusDialogError.value =
                'Verification note is required when a substitution was dispensed.';
            return;
        }
        statusDialogError.value = null;

        const success = await verifyDispenseRelease(
            statusDialogOrder.value,
            verificationNote,
        );

        if (success) {
            closeOrderStatusDialog();
        }
        return;
    }

    dispensingNotes = statusDialogDispensingNotes.value.trim() || null;
    statusDialogError.value = null;

    const success = await updateOrderStatus(
        statusDialogOrder.value,
        statusDialogAction.value,
        { reason, quantityDispensed, dispensingNotes },
    );

    if (success) {
        closeOrderStatusDialog();
    }
}

async function verifyDispenseRelease(
    order: PharmacyOrder,
    verificationNote: string | null,
) {
    if (actionLoadingId.value) return false;

    actionLoadingId.value = order.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'PATCH',
            `/pharmacy-orders/${order.id}/verify`,
            {
                body: { verificationNote },
            },
        );

        actionMessage.value = `Verified ${response.data.orderNumber ?? 'pharmacy order'} dispense release.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            if (canViewPharmacyOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }
        await Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            ensureInventoryMedicationMatch(
                response.data.medicationCode,
                response.data.medicationName,
                { force: true },
            ),
            ensureInventoryMedicationMatch(
                orderDispenseTargetMedicationCode(response.data),
                orderDispenseTargetMedicationName(response.data),
                { force: true },
            ),
        ]);
        flashOrder(order.id);
        return true;
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to verify pharmacy dispense.'),
        );
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

async function submitPolicyDialog() {
    if (!policyDialogOrder.value || actionLoadingId.value) return;

    if (
        policyDialogEffectiveNeedsFormularyReason.value &&
        !policyDialogForm.formularyDecisionReason.trim()
    ) {
        policyDialogError.value =
            policyDialogRecommendationNeedsDecisionReason.value
                ? 'A decision reason is required before this recommended policy path can be approved.'
                : 'A decision reason is required for outside-list or restricted decisions.';
        return;
    }

    if (policyDialogForm.substitutionMade) {
        if (!policyDialogForm.substitutionAllowed) {
            policyDialogError.value =
                'Substitution made cannot be set when substitution allowed is disabled.';
            return;
        }

        if (policyDialogForm.substitutionSelectionMode === 'approved') {
            if (approvedMedicinesCatalogAccessBlocked.value) {
                policyDialogError.value =
                    'This pharmacy account cannot open the approved medicines picker for substitution.';
                return;
            }

            if (!selectedPolicySubstitutionApprovedMedicineItem.value) {
                policyDialogError.value =
                    'Select the substituted medicine from the approved medicines list, or switch to the outside-list override.';
                return;
            }

            syncPolicyDialogSubstitutionSelection();
        } else if (
            !policyDialogForm.substitutedMedicationCode.trim() ||
            !policyDialogForm.substitutedMedicationName.trim()
        ) {
            policyDialogError.value =
                'Outside-list substitution requires substituted medication code and name.';
            return;
        }

        if (!policyDialogForm.substitutionReason.trim()) {
            policyDialogError.value =
                'Substitution reason is required when substitution is made.';
            return;
        }

        const requestedCode = (policyDialogOrder.value.medicationCode ?? '')
            .trim()
            .toLowerCase();
        const requestedName = (policyDialogOrder.value.medicationName ?? '')
            .trim()
            .toLowerCase();
        const substitutedCode = policyDialogForm.substitutedMedicationCode
            .trim()
            .toLowerCase();
        const substitutedName = policyDialogForm.substitutedMedicationName
            .trim()
            .toLowerCase();

        if (
            (requestedCode && substitutedCode && requestedCode === substitutedCode) ||
            (requestedName &&
                substitutedName &&
                requestedName === substitutedName)
        ) {
            policyDialogError.value =
                'Select a different medicine for substitution. The current substitute matches the original order item.';
            return;
        }
    }

    policyDialogError.value = null;
    actionLoadingId.value = policyDialogOrder.value.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'PATCH',
            `/pharmacy-orders/${policyDialogOrder.value.id}/policy`,
            {
                body: {
                    formularyDecisionStatus: policyDialogForm.formularyDecisionStatus,
                    formularyDecisionReason:
                        policyDialogForm.formularyDecisionReason.trim() || null,
                    substitutionAllowed: policyDialogForm.substitutionAllowed,
                    substitutionMade: policyDialogForm.substitutionMade,
                    substitutedMedicationCode: policyDialogForm.substitutionMade
                        ? policyDialogForm.substitutedMedicationCode.trim()
                        : null,
                    substitutedMedicationName: policyDialogForm.substitutionMade
                        ? policyDialogForm.substitutedMedicationName.trim()
                        : null,
                    substitutionReason: policyDialogForm.substitutionMade
                        ? policyDialogForm.substitutionReason.trim()
                        : null,
                },
            },
        );

        actionMessage.value = `Updated policy for ${response.data.orderNumber ?? 'pharmacy order'}.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            if (canViewPharmacyOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        await Promise.all([loadOrders(), loadOrderStatusCounts()]);
        closePolicyDialog();
    } catch (error) {
        policyDialogError.value = messageFromUnknown(
            error,
            'Unable to update pharmacy policy.',
        );
        notifyError(policyDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

async function submitReconciliationDialog() {
    if (!reconciliationDialogOrder.value || actionLoadingId.value) return;

    if (
        reconciliationDialogForm.reconciliationStatus === 'completed' &&
        !reconciliationDialogForm.reconciliationDecision.trim()
    ) {
        reconciliationDialogError.value =
            'Choose the final reconciliation outcome for the current medication list.';
        return;
    }

    if (
        reconciliationDialogForm.reconciliationStatus === 'exception' &&
        !reconciliationDialogForm.reconciliationNote.trim()
    ) {
        reconciliationDialogError.value =
            'Reconciliation note is required for reconciliation exceptions.';
        return;
    }

    reconciliationDialogError.value = null;
    actionLoadingId.value = reconciliationDialogOrder.value.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'PATCH',
            `/pharmacy-orders/${reconciliationDialogOrder.value.id}/reconciliation`,
            {
                body: {
                    reconciliationStatus:
                        reconciliationDialogForm.reconciliationStatus,
                    reconciliationDecision:
                        reconciliationDialogForm.reconciliationStatus === 'completed'
                            ? reconciliationDialogForm.reconciliationDecision.trim() || null
                            : null,
                    reconciliationNote:
                        reconciliationDialogForm.reconciliationNote.trim() || null,
                },
            },
        );

        actionMessage.value = `Updated reconciliation for ${response.data.orderNumber ?? 'pharmacy order'}.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            if (canViewPharmacyOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        await Promise.all([loadOrders(), loadOrderStatusCounts()]);
        closeReconciliationDialog();
    } catch (error) {
        reconciliationDialogError.value = messageFromUnknown(
            error,
            'Unable to update medication reconciliation.',
        );
        notifyError(reconciliationDialogError.value);
    } finally {
        actionLoadingId.value = null;
    }
}

function flashOrder(orderId: string) {
    if (flashedOrderTimer) clearTimeout(flashedOrderTimer);
    flashedOrderId.value = orderId;
    flashedOrderTimer = setTimeout(() => {
        flashedOrderId.value = null;
        flashedOrderTimer = null;
    }, 1500);
}

async function updateOrderStatus(
    order: PharmacyOrder,
    status: PharmacyOrderStatusAction,
    payload?: {
        reason?: string | null;
        quantityDispensed?: number | null;
        dispensingNotes?: string | null;
    },
) {
    if (actionLoadingId.value) return;

    const reason = payload?.reason ?? null;
    const quantityDispensed = payload?.quantityDispensed ?? null;
    const dispensingNotes = payload?.dispensingNotes ?? null;

    actionLoadingId.value = order.id;
    listErrors.value = [];
    actionMessage.value = null;

    try {
        const response = await apiRequest<{ data: PharmacyOrder }>(
            'PATCH',
            `/pharmacy-orders/${order.id}/status`,
            {
                body: { status, reason, quantityDispensed, dispensingNotes },
            },
        );

        actionMessage.value = `Updated ${response.data.orderNumber ?? 'pharmacy order'} to ${formatEnumLabel(status)}.`;
        if (actionMessage.value) notifySuccess(actionMessage.value);
        if (detailsSheetOrder.value?.id === response.data.id) {
            detailsSheetOrder.value = response.data;
            if (canViewPharmacyOrderAuditLogs.value) {
                void loadOrderAuditLogs(response.data.id);
            }
        }
        if (statusDialogOrder.value?.id === response.data.id) {
            statusDialogOrder.value = response.data;
        }
        await Promise.all([
            loadOrders(),
            loadOrderStatusCounts(),
            ensureInventoryMedicationMatch(
                response.data.medicationCode,
                response.data.medicationName,
                { force: true },
            ),
            ensureInventoryMedicationMatch(
                orderDispenseTargetMedicationCode(response.data),
                orderDispenseTargetMedicationName(response.data),
                { force: true },
            ),
        ]);
        flashOrder(order.id);
        return true;
    } catch (error) {
        notifyError(
            messageFromUnknown(error, 'Unable to update pharmacy order status.'),
        );
        return false;
    } finally {
        actionLoadingId.value = null;
    }
}

function submitSearch() {
    clearSearchDebounce();
    searchForm.page = 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function syncAdvancedFiltersDraftFromSearch() {
    advancedFiltersDraft.patientId = searchForm.patientId;
    advancedFiltersDraft.from = searchForm.from;
    advancedFiltersDraft.to = searchForm.to;
}

function applyAdvancedFilters() {
    clearSearchDebounce();
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : advancedFiltersDraft.patientId.trim();
    searchForm.from = advancedFiltersDraft.from.trim();
    searchForm.to = advancedFiltersDraft.to.trim();
    searchForm.page = 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function submitSearchFromFiltersSheet() {
    applyAdvancedFilters();
    advancedFiltersSheetOpen.value = false;
}

function submitSearchFromMobileDrawer() {
    submitSearch();
    mobileFiltersDrawerOpen.value = false;
}

function resetFilters() {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = '';
    searchForm.from = today;
    searchForm.to = '';
    searchForm.sortBy = 'orderedAt';
    searchForm.sortDir = 'desc';
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function openFullPharmacyQueue() {
    clearSearchDebounce();
    patientChartQueueFocusLocked.value = false;
    searchForm.patientId = '';
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function refocusPatientChartQueue() {
    if (!patientChartQueueRouteContext.patientId) return;
    clearSearchDebounce();
    patientChartQueueFocusLocked.value = true;
    searchForm.patientId = patientChartQueueRouteContext.patientId;
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function resetFiltersFromFiltersSheet() {
    resetFilters();
    advancedFiltersSheetOpen.value = false;
}

function resetFiltersFromMobileDrawer() {
    resetFilters();
    mobileFiltersDrawerOpen.value = false;
}
function prevPage() {
    if ((pagination.value?.currentPage ?? 1) <= 1) return;
    clearSearchDebounce();
    searchForm.page -= 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function nextPage() {
    if (
        !pagination.value ||
        pagination.value.currentPage >= pagination.value.lastPage
    ) {
        return;
    }
    clearSearchDebounce();
    searchForm.page += 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function goToPage(page: number) {
    const last = pagination.value?.lastPage ?? 1;
    const target = Math.max(1, Math.min(page, last));
    if (target === (pagination.value?.currentPage ?? 1)) return;
    clearSearchDebounce();
    searchForm.page = target;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

const paginationPages = computed<(number | '...')[]>(() => {
    const current = pagination.value?.currentPage ?? 1;
    const last = pagination.value?.lastPage ?? 1;
    if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
    const pages: (number | '...')[] = [1];
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(last - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < last - 2) pages.push('...');
    pages.push(last);
    return pages;
});

function shortId(value: string | null): string {
    if (!value) return 'N/A';
    return value.length > 10 ? `${value.slice(0, 8)}...` : value;
}

function formatDateTime(value: string | null): string {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat(undefined, {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
}

function statusVariant(status: string | null) {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'pending') return 'outline';
    if (normalized === 'in_preparation' || normalized === 'partially_dispensed')
        return 'secondary';
    if (normalized === 'dispensed') return 'default';
    if (normalized === 'cancelled') return 'destructive';
    return 'outline';
}

function quantityText(value: string | number | null): string {
    if (value === null || value === undefined || value === '') return 'N/A';
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return String(value);
    return Number.isInteger(numeric) ? String(numeric) : numeric.toFixed(2);
}

function dispenseProgressLabel(order: PharmacyOrder): string {
    return `${quantityText(order.quantityDispensed)} / ${quantityText(order.quantityPrescribed)}`;
}

function quantityBadgeVariant(order: PharmacyOrder) {
    const status = (order.status ?? '').toLowerCase();
    if (status === 'dispensed') return 'default';
    if (status === 'partially_dispensed') return 'secondary';
    return 'outline';
}

function pharmacyAccentClass(status: string | null): string {
    const normalized = (status ?? '').toLowerCase();
    if (normalized === 'pending') {
        return 'border-l-4 border-l-sky-500/80 dark:border-l-sky-400/80';
    }
    if (normalized === 'in_preparation') {
        return 'border-l-4 border-l-amber-500/80 dark:border-l-amber-400/80';
    }
    if (normalized === 'partially_dispensed') {
        return 'border-l-4 border-l-purple-500/80 dark:border-l-purple-400/80';
    }
    if (normalized === 'dispensed') {
        return 'border-l-4 border-l-emerald-500/80 dark:border-l-emerald-400/80';
    }
    if (normalized === 'cancelled') {
        return 'border-l-4 border-l-rose-500/80 dark:border-l-rose-400/80';
    }
    return '';
}

function pharmacyRowEnteredInErrorClass(order: PharmacyOrder): string {
    if (!isPharmacyOrderEnteredInError(order)) return '';
    return 'opacity-50 bg-destructive/5 border-l-4 !border-l-destructive/60 border-dashed';
}

function patientName(summary: PatientSummary): string {
    return (
        [summary.firstName, summary.middleName, summary.lastName]
            .filter(Boolean)
            .join(' ')
            .trim() ||
        summary.patientNumber ||
        shortId(summary.id)
    );
}

function orderPatientSummary(order: PharmacyOrder): PatientSummary | null {
    if (!order.patientId) return null;
    return patientDirectory.value[order.patientId] ?? null;
}

function orderPatientLabel(order: PharmacyOrder): string {
    const summary = orderPatientSummary(order);
    if (!summary) return shortId(order.patientId);
    return patientName(summary);
}

function orderPatientNumber(order: PharmacyOrder): string | null {
    return orderPatientSummary(order)?.patientNumber ?? null;
}

function orderAppointmentSummary(order: PharmacyOrder): AppointmentSummary | null {
    if (!order.appointmentId) return null;
    return appointmentDirectory.value[order.appointmentId] ?? null;
}

function orderAdmissionSummary(order: PharmacyOrder): AdmissionSummary | null {
    if (!order.admissionId) return null;
    return admissionDirectory.value[order.admissionId] ?? null;
}

function orderAppointmentDisplayLabel(order: PharmacyOrder): string {
    const summary = orderAppointmentSummary(order);
    const appointmentNumber = summary?.appointmentNumber?.trim();
    if (appointmentNumber) return appointmentNumber;
    if (order.appointmentId?.trim()) {
        return pendingAppointmentLookupIds.has(order.appointmentId)
            ? 'Loading appointment...'
            : 'Linked appointment';
    }
    return 'No appointment link';
}

function orderAdmissionDisplayLabel(order: PharmacyOrder): string {
    const summary = orderAdmissionSummary(order);
    const admissionNumber = summary?.admissionNumber?.trim();
    if (admissionNumber) return admissionNumber;
    if (order.admissionId?.trim()) {
        return pendingAdmissionLookupIds.has(order.admissionId)
            ? 'Loading admission...'
            : 'Linked admission';
    }
    return 'No admission link';
}

function medicationDisplayLabel(
    code: string | null,
    name: string | null,
    fallback = 'N/A',
): string {
    const codeValue = code?.trim() ?? '';
    const nameValue = name?.trim() ?? '';

    if (codeValue && nameValue) {
        return `${codeValue} - ${nameValue}`;
    }

    if (nameValue) return nameValue;
    if (codeValue) return codeValue;
    return fallback;
}

function orderRequestedMedicationDisplay(order: PharmacyOrder): string {
    return medicationDisplayLabel(
        order.medicationCode,
        order.medicationName,
        'No ordered medicine',
    );
}

function orderSubstitutedMedicationDisplay(order: PharmacyOrder): string | null {
    const value = medicationDisplayLabel(
        order.substitutedMedicationCode,
        order.substitutedMedicationName,
        '',
    ).trim();

    return value || null;
}

function orderDispenseTargetDisplay(order: PharmacyOrder): string {
    return medicationDisplayLabel(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
        'No dispense target',
    );
}

function orderSubstitutionHandoffText(order: PharmacyOrder): string | null {
    if (!hasSubstitutionInDispenseNotes(order)) return null;

    const substitute = orderSubstitutedMedicationDisplay(order);
    const ordered = orderRequestedMedicationDisplay(order);

    if (substitute) {
        return `Dispense substitute: ${substitute} instead of ${ordered}.`;
    }

    return `A substitute medicine is attached to this order instead of ${ordered}.`;
}

function hasSubstitutionInDispenseNotes(order: PharmacyOrder): boolean {
    if (order.substitutionMade) return true;
    return (order.dispensingNotes ?? '').toLowerCase().includes('substitution: yes');
}

function canOpenReconciliationAction(order: PharmacyOrder): boolean {
    if (order.status !== 'dispensed') return false;
    if (!order.verifiedAt) return false;
    return (order.reconciliationStatus ?? 'pending') !== 'completed';
}

function isAuditLogObject(
    value: Record<string, unknown> | unknown[] | null,
): value is Record<string, unknown> {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function auditLogEntries(
    value: Record<string, unknown> | unknown[] | null,
): Array<[string, unknown]> {
    if (!isAuditLogObject(value)) return [];
    return Object.entries(value);
}

function auditLogActorLabel(log: PharmacyOrderAuditLog): string {
    if (log.actorId === null || log.actorId === undefined) return 'System';
    return `User ID ${log.actorId}`;
}

function auditLogActionLabel(log: PharmacyOrderAuditLog): string {
    return formatEnumLabel(log.action || 'unknown');
}

function auditLogChangeKeys(log: PharmacyOrderAuditLog): string[] {
    return auditLogEntries(log.changes).map(([key]) => key);
}

function auditLogMetadataPreview(
    log: PharmacyOrderAuditLog,
): Array<{ key: string; value: string }> {
    return auditLogEntries(log.metadata)
        .slice(0, 3)
        .map(([key, value]) => ({
            key: formatEnumLabel(key),
            value: formatAuditLogValue(value),
        }));
}

function auditLogActorTypeLabel(log: PharmacyOrderAuditLog): string {
    return log.actorId === null || log.actorId === undefined ? 'System' : 'User';
}

function auditLogHasExpandableDetails(log: PharmacyOrderAuditLog): boolean {
    return (
        auditLogEntries(log.changes).length > 0 || auditLogEntries(log.metadata).length > 0
    );
}

function isDetailsAuditRowExpanded(logId: string): boolean {
    return detailsSheetAuditExpandedRows[logId] ?? false;
}

function toggleDetailsAuditRowExpanded(logId: string) {
    detailsSheetAuditExpandedRows[logId] = !isDetailsAuditRowExpanded(logId);
}

function resetDetailsAuditExpandedRows() {
    Object.keys(detailsSheetAuditExpandedRows).forEach((key) => {
        delete detailsSheetAuditExpandedRows[key];
    });
}

function formatAuditLogValue(value: unknown): string {
    if (value === null || value === undefined) return 'N/A';
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return 'N/A';
        return trimmed.length > 220 ? `${trimmed.slice(0, 217)}...` : trimmed;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    try {
        const json = JSON.stringify(value);
        if (!json) return 'N/A';
        return json.length > 220 ? `${json.slice(0, 217)}...` : json;
    } catch {
        return String(value);
    }
}

function parseDateTimeValue(value: string | null): number | null {
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isNaN(timestamp) ? null : timestamp;
}

function formularyDecisionVariant(
    status: string | null,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (status ?? 'not_reviewed').trim().toLowerCase();
    if (normalized === 'formulary') return 'default';
    if (normalized === 'restricted') return 'secondary';
    if (normalized === 'non_formulary') return 'destructive';
    return 'outline';
}

function approvedMedicineDecisionLabel(status: string | null): string {
    const normalized = (status ?? 'not_reviewed').trim().toLowerCase();
    if (normalized === 'formulary') return 'Approved medicine';
    if (normalized === 'non_formulary') return 'Outside approved list';
    if (normalized === 'restricted') return 'Restricted medicine';
    return 'Not reviewed';
}

function reconciliationStatusVariant(
    status: string | null,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const normalized = (status ?? 'pending').trim().toLowerCase();
    if (normalized === 'completed') return 'default';
    if (normalized === 'exception') return 'destructive';
    return 'outline';
}

function reconciliationDecisionLabel(decision: string | null): string | null {
    const normalized = (decision ?? '').trim().toLowerCase();
    if (!normalized) return null;

    if (normalized === 'add_to_current_list') return 'Add to current medications';
    if (normalized === 'continue_on_current_list') return 'Keep on current medications';
    if (normalized === 'short_course_only') return 'Short course only';
    if (normalized === 'stop_from_current_list') return 'Stop from current medications';
    if (normalized === 'review_later') return 'Review later';

    return formatEnumLabel(normalized);
}

function mergeSummaryLabelAndNote(
    summaryLabel: string | null,
    note: string | null,
    fallback: string,
): string {
    if (summaryLabel && note) return `${summaryLabel}. ${note}`;
    if (summaryLabel) return summaryLabel;
    if (note) return note;
    return fallback;
}

function reconciliationSummaryHelper(order: PharmacyOrder): string {
    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();
    const note = order.reconciliationNote?.trim() || null;
    const decisionLabel = reconciliationDecisionLabel(order.reconciliationDecision);

    if (reconciliation === 'completed') {
        return mergeSummaryLabelAndNote(
            decisionLabel,
            note,
            'Medication reconciliation is closed.',
        );
    }

    if (reconciliation === 'exception') {
        return note || 'A reconciliation exception still needs follow-up.';
    }

    if (decisionLabel === 'Review later') {
        return mergeSummaryLabelAndNote(
            decisionLabel,
            note,
            'Medication reconciliation was marked for follow-up later.',
        );
    }

    return note
        || (orderNeedsReconciliation(order)
            ? 'Complete after release verification.'
            : 'Will open after release verification.');
}

function reconciliationTimelineDetail(order: PharmacyOrder): string {
    const parts = [`Reconciliation: ${formatEnumLabel(order.reconciliationStatus || 'pending')}`];
    const decisionLabel = reconciliationDecisionLabel(order.reconciliationDecision);

    if (decisionLabel) {
        parts.push(`Outcome: ${decisionLabel}`);
    }

    return parts.join('. ');
}

function variantSurfaceClass(
    variant: 'default' | 'secondary' | 'outline' | 'destructive',
): string {
    if (variant === 'default') return 'border-primary/30 bg-primary/5';
    if (variant === 'secondary') return 'border-amber-500/30 bg-amber-500/5';
    if (variant === 'destructive') return 'border-destructive/30 bg-destructive/5';
    return 'border-border bg-background';
}

function variantDotClass(
    variant: 'default' | 'secondary' | 'outline' | 'destructive',
): string {
    if (variant === 'default') return 'bg-primary';
    if (variant === 'secondary') return 'bg-amber-500';
    if (variant === 'destructive') return 'bg-destructive';
    return 'bg-muted-foreground/50';
}

function policyNeedsReason(status: string | null): boolean {
    const normalized = (status ?? '').trim().toLowerCase();
    return normalized === 'non_formulary' || normalized === 'restricted';
}

function orderNeedsPolicyAttention(order: PharmacyOrder): boolean {
    const normalized = (order.formularyDecisionStatus ?? 'not_reviewed')
        .trim()
        .toLowerCase();

    return (
        normalized === 'not_reviewed' ||
        normalized === 'non_formulary' ||
        normalized === 'restricted'
    );
}

function orderNeedsBlockingPolicyReview(order: PharmacyOrder): boolean {
    const normalized = (order.formularyDecisionStatus ?? 'not_reviewed')
        .trim()
        .toLowerCase();
    const substitutionMade = Boolean(order.substitutionMade);

    if (normalized === 'non_formulary' && substitutionMade) {
        return false;
    }

    return (
        normalized === 'not_reviewed' ||
        normalized === 'non_formulary' ||
        normalized === 'restricted'
    );
}

function orderNeedsVerification(order: PharmacyOrder): boolean {
    return (order.status ?? '').trim().toLowerCase() === 'dispensed' && !order.verifiedAt;
}

function orderNeedsReconciliation(order: PharmacyOrder): boolean {
    return (
        (order.status ?? '').trim().toLowerCase() === 'dispensed' &&
        Boolean(order.verifiedAt) &&
        (order.reconciliationStatus ?? 'pending').trim().toLowerCase() !== 'completed'
    );
}

function orderReleaseStateLabel(order: PharmacyOrder): string | null {
    const status = (order.status ?? '').trim().toLowerCase();
    if (status !== 'dispensed') return null;
    if (order.verifiedAt) return 'Released';
    return hasSubstitutionInDispenseNotes(order) ? 'Release blocked' : 'Release pending';
}

function orderReleaseStateVariant(
    order: PharmacyOrder,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const label = orderReleaseStateLabel(order);
    if (label === 'Released') return 'secondary';
    if (label === 'Release blocked') return 'destructive';
    if (label === 'Release pending') return 'secondary';
    return 'outline';
}

function orderQueueAttentionLabel(order: PharmacyOrder): string | null {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();

    if (status === 'dispensed' && reconciliation === 'exception') {
        return 'Reconciliation exception';
    }
    if (status === 'dispensed' && order.verifiedAt && reconciliation !== 'completed') {
        return 'Reconciliation pending';
    }
    if (status !== 'cancelled' && status !== 'dispensed' && orderNeedsPolicyAttention(order)) {
        return 'Policy review';
    }
    return null;
}

function orderQueueAttentionVariant(
    order: PharmacyOrder,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const label = orderQueueAttentionLabel(order);
    if (label === 'Reconciliation exception') return 'destructive';
    if (label === 'Reconciliation pending') return 'secondary';
    if (label === 'Policy review') return 'secondary';
    return 'outline';
}

function orderQueueFocusSurfaceVariant(
    order: PharmacyOrder,
): 'default' | 'secondary' | 'outline' | 'destructive' {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();

    if (status === 'dispensed' && reconciliation === 'exception') return 'destructive';
    if (status === 'dispensed' && !order.verifiedAt && hasSubstitutionInDispenseNotes(order)) {
        return 'destructive';
    }
    if (status === 'dispensed' && (!order.verifiedAt || reconciliation !== 'completed')) {
        return 'secondary';
    }
    if (status !== 'cancelled' && status !== 'dispensed' && orderNeedsPolicyAttention(order)) {
        return 'secondary';
    }
    return 'outline';
}

function orderQueueFocusSurfaceClass(order: PharmacyOrder): string {
    return variantSurfaceClass(orderQueueFocusSurfaceVariant(order));
}

function orderQueueFocusTitle(order: PharmacyOrder): string | null {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();

    if (status === 'dispensed' && reconciliation === 'exception') {
        return 'Reconciliation exception needs follow-up';
    }
    if (status === 'dispensed' && !order.verifiedAt) {
        return hasSubstitutionInDispenseNotes(order)
            ? 'Substitute release needs pharmacist review'
            : 'Verify and release this dispense';
    }
    if (status === 'dispensed' && order.verifiedAt && reconciliation !== 'completed') {
        return 'Complete medication reconciliation';
    }
    if (status !== 'cancelled' && status !== 'dispensed' && orderNeedsPolicyAttention(order)) {
        return 'Policy review still needed';
    }
    return null;
}

function orderQueueFocusDetail(order: PharmacyOrder): string {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();
    const substitutionText = orderSubstitutionHandoffText(order);

    if (status === 'dispensed' && reconciliation === 'exception') {
        return (
            order.reconciliationNote?.trim() ||
            'Resolve the recorded reconciliation exception before the medication workflow can close cleanly.'
        );
    }
    if (status === 'dispensed' && !order.verifiedAt && hasSubstitutionInDispenseNotes(order)) {
        return (
            substitutionText ||
            'A substituted medicine was dispensed. Carry the substitution reason into pharmacist verification before release.'
        );
    }
    if (status === 'dispensed' && !order.verifiedAt) {
        return 'A pharmacist verification note is still needed before the release is complete.';
    }
    if (status === 'dispensed' && order.verifiedAt && reconciliation !== 'completed') {
        return reconciliation === 'exception'
            ? 'Resolve the reconciliation exception recorded after release.'
            : 'Release is verified. Finish medication reconciliation to close the order.';
    }
    if (status !== 'cancelled' && status !== 'dispensed' && orderNeedsPolicyAttention(order)) {
        return (
            substitutionText ||
            'Approved-medicines or substitution review is still needed before dispense work continues.'
        );
    }
    return orderNextWorkflowDetail(order);
}

function orderNextWorkflowLabel(order: PharmacyOrder): string {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending')
        .trim()
        .toLowerCase();

    if (status === 'cancelled') return 'Workflow closed';
    if (status === 'pending') return 'Start preparation';
    if (status === 'in_preparation') return 'Record dispense';
    if (status === 'partially_dispensed') return 'Complete dispense';
    if (status === 'dispensed' && !order.verifiedAt) return 'Verify + Release';
    if (status === 'dispensed' && reconciliation !== 'completed') {
        return reconciliation === 'exception'
            ? 'Resolve reconciliation exception'
            : 'Complete reconciliation';
    }

    return 'Workflow complete';
}

function orderNextWorkflowDetail(order: PharmacyOrder): string {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending')
        .trim()
        .toLowerCase();

    if (status === 'cancelled') {
        return 'This order is cancelled and no more dispense steps are expected.';
    }
    if (canUpdatePharmacyOrderStatus.value && status === 'pending') {
        return 'Move the order into preparation once stock and medication choice are ready.';
    }
    if (canUpdatePharmacyOrderStatus.value && status === 'in_preparation') {
        return 'Capture quantity dispensed and counseling notes when the medication is prepared.';
    }
    if (canUpdatePharmacyOrderStatus.value && status === 'partially_dispensed') {
        return 'A partial dispense was recorded. Review the remaining quantity before release.';
    }
    if (status === 'dispensed' && !order.verifiedAt) {
        return 'A pharmacist verification note is still needed before the release is complete.';
    }
    if (status === 'dispensed' && reconciliation === 'exception') {
        return 'Medication reconciliation is blocked by an exception that still needs follow-up.';
    }
    if (status === 'dispensed' && reconciliation !== 'completed') {
        return 'Reconciliation should be completed after pharmacist verification.';
    }

    return 'Dispense, verification, and reconciliation are all complete.';
}

function findAuditLogByAction(
    action: string,
    predicate?: (log: PharmacyOrderAuditLog) => boolean,
): PharmacyOrderAuditLog | null {
    const matches = detailsSheetAuditLogs.value
        .filter(
            (log) =>
                (log.action ?? '').trim().toLowerCase() === action &&
                (predicate ? predicate(log) : true),
        )
        .sort((left, right) => {
            const leftTime = parseDateTimeValue(left.createdAt) ?? Number.MAX_SAFE_INTEGER;
            const rightTime =
                parseDateTimeValue(right.createdAt) ?? Number.MAX_SAFE_INTEGER;
            return leftTime - rightTime;
        });

    return matches[0] ?? null;
}

function auditLogHasStatus(
    log: PharmacyOrderAuditLog,
    expectedStatus: string,
): boolean {
    if (!isAuditLogObject(log.changes)) return false;
    return (
        String(log.changes.status ?? '')
            .trim()
            .toLowerCase() === expectedStatus
    );
}

function buildPharmacyTimelineEvent(
    id: string,
    label: string,
    occurredAt: string | null,
    detail: string,
    options?: {
        note?: string | null;
        variant?: 'default' | 'secondary' | 'outline' | 'destructive';
        pending?: boolean;
        fallbackTimestamp?: number | null;
    },
): PharmacyTimelineEvent | null {
    const timestamp = parseDateTimeValue(occurredAt) ?? options?.fallbackTimestamp ?? null;

    if (!occurredAt && !options?.pending) return null;

    return {
        id,
        label,
        detail,
        note: options?.note ?? null,
        occurredAt,
        sortAt: timestamp ?? Number.MAX_SAFE_INTEGER,
        variant: options?.variant ?? 'outline',
        pending: options?.pending ?? false,
    };
}

const detailsSheetTimelineEvents = computed<PharmacyTimelineEvent[]>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return [];

    const events: PharmacyTimelineEvent[] = [];
    const orderedAt = order.orderedAt ?? order.createdAt;
    const preparationLog = findAuditLogByAction(
        'pharmacy-order.status.updated',
        (log) => auditLogHasStatus(log, 'in_preparation'),
    );
    const partialDispenseLog = findAuditLogByAction(
        'pharmacy-order.status.updated',
        (log) => auditLogHasStatus(log, 'partially_dispensed'),
    );
    const dispensedLog = findAuditLogByAction(
        'pharmacy-order.status.updated',
        (log) => auditLogHasStatus(log, 'dispensed'),
    );
    const cancelledLog = findAuditLogByAction(
        'pharmacy-order.status.updated',
        (log) => auditLogHasStatus(log, 'cancelled'),
    );
    const policyLog = findAuditLogByAction('pharmacy-order.policy.updated');
    const verifiedLog = findAuditLogByAction('pharmacy-order.dispense.verified');
    const reconciliationLog = findAuditLogByAction(
        'pharmacy-order.reconciliation.updated',
    );

    const orderedEvent = buildPharmacyTimelineEvent(
        'ordered',
        'Medication ordered',
        orderedAt,
        order.medicationName?.trim() || order.medicationCode?.trim() || 'Pharmacy order created',
        {
            variant: 'default',
            note: order.dosageInstruction?.trim() || null,
        },
    );
    if (orderedEvent) events.push(orderedEvent);

    const preparationEvent = buildPharmacyTimelineEvent(
        'preparation',
        'Preparation started',
        preparationLog?.createdAt ?? null,
        'The order moved from pending into active dispensing work.',
        {
            variant: 'secondary',
        },
    );
    if (preparationEvent) events.push(preparationEvent);

    const policyEvent = buildPharmacyTimelineEvent(
        'policy',
        'Approved medicines decision recorded',
        order.formularyReviewedAt ?? policyLog?.createdAt ?? null,
        `Approved medicines decision: ${approvedMedicineDecisionLabel(order.formularyDecisionStatus)}`,
        {
            variant: formularyDecisionVariant(order.formularyDecisionStatus),
            note: order.formularyDecisionReason?.trim() || null,
        },
    );
    if (policyEvent) events.push(policyEvent);

    const substitutionEvent = buildPharmacyTimelineEvent(
        'substitution',
        'Substitution recorded',
        order.substitutionApprovedAt ?? policyLog?.createdAt ?? null,
        orderSubstitutionHandoffText(order) ??
            'A substitution was recorded for this order.',
        {
            variant: 'destructive',
            note: order.substitutionReason?.trim() || null,
        },
    );
    if (order.substitutionMade && substitutionEvent) {
        events.push(substitutionEvent);
    }

    const partialEvent = buildPharmacyTimelineEvent(
        'partial-dispense',
        'Partial dispense recorded',
        partialDispenseLog?.createdAt ?? null,
        `Dispense progress: ${dispenseProgressLabel(order)}`,
        {
            variant: 'secondary',
            note:
                (order.status ?? '').trim().toLowerCase() === 'partially_dispensed'
                    ? order.dispensingNotes?.trim() || null
                    : null,
        },
    );
    if (partialEvent) events.push(partialEvent);

    const dispensedEvent = buildPharmacyTimelineEvent(
        'dispensed',
        'Medication dispensed',
        order.dispensedAt ?? dispensedLog?.createdAt ?? null,
        `Dispense progress: ${dispenseProgressLabel(order)}`,
        {
            variant: quantityBadgeVariant(order),
            note: order.dispensingNotes?.trim() || null,
        },
    );
    if (dispensedEvent) events.push(dispensedEvent);

    const verifiedEvent = buildPharmacyTimelineEvent(
        'verified',
        'Release verified',
        order.verifiedAt ?? verifiedLog?.createdAt ?? null,
        'A pharmacist verified the medication release.',
        {
            variant: 'default',
            note: order.verificationNote?.trim() || null,
        },
    );
    if (verifiedEvent) events.push(verifiedEvent);

    const reconciliationEvent = buildPharmacyTimelineEvent(
        'reconciliation',
        'Medication reconciliation updated',
        order.reconciledAt ?? reconciliationLog?.createdAt ?? null,
        reconciliationTimelineDetail(order),
        {
            variant: reconciliationStatusVariant(order.reconciliationStatus),
            note: order.reconciliationNote?.trim() || null,
        },
    );
    if (reconciliationEvent) events.push(reconciliationEvent);

    const cancelledEvent = buildPharmacyTimelineEvent(
        'cancelled',
        'Order cancelled',
        cancelledLog?.createdAt ?? order.updatedAt ?? null,
        'The dispense workflow was stopped for this order.',
        {
            variant: 'destructive',
            note: order.statusReason?.trim() || null,
        },
    );
    if ((order.status ?? '').trim().toLowerCase() === 'cancelled' && cancelledEvent) {
        events.push(cancelledEvent);
    }

    const nextWorkflowLabel = orderNextWorkflowLabel(order);
    const nextWorkflowCompleted = nextWorkflowLabel === 'Workflow complete';
    const nextWorkflowOccurredAt = nextWorkflowCompleted
        ? order.reconciledAt ?? order.verifiedAt ?? order.updatedAt ?? orderedAt
        : null;

    const nextStepEvent = buildPharmacyTimelineEvent(
        'next-step',
        nextWorkflowLabel,
        nextWorkflowOccurredAt,
        orderNextWorkflowDetail(order),
        {
            pending: !nextWorkflowCompleted,
            variant: nextWorkflowCompleted ? 'default' : 'outline',
            fallbackTimestamp:
                (parseDateTimeValue(order.updatedAt) ?? parseDateTimeValue(orderedAt) ?? 0) + 1,
        },
    );
    if (nextStepEvent) events.push(nextStepEvent);

    return events
        .filter(
            (event, index, collection) =>
                collection.findIndex((candidate) => candidate.id === event.id) === index,
        )
        .sort((left, right) => left.sortAt - right.sortAt);
});

const detailsSheetOrderedInventoryItem = computed<InventoryItem | null>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    return inventoryMedicationMatch(order.medicationCode, order.medicationName);
});

const detailsSheetOrderedInventoryLoading = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return false;

    return inventoryMedicationIsLoading(order.medicationCode, order.medicationName);
});

const detailsSheetOrderedInventoryError = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    return inventoryMedicationError(order.medicationCode, order.medicationName);
});

const detailsSheetDispenseTargetInventoryItem = computed<InventoryItem | null>(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    return inventoryMedicationMatch(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const detailsSheetDispenseTargetInventoryLoading = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return false;

    return inventoryMedicationIsLoading(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const detailsSheetDispenseTargetInventoryError = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    return inventoryMedicationError(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const detailsSheetStockMovementSections = computed(() => {
    if (!canReadInventoryProcurement.value) {
        return [];
    }

    const sections: Array<{
        key: string;
        title: string;
        item: InventoryItem;
        movements: InventoryStockMovement[];
        totalMovements: number;
        loading: boolean;
        error: string | null;
        ledgerHref: string;
    }> = [];
    const seen = new Set<string>();

    const pushSection = (title: string, item: InventoryItem | null) => {
        if (!item?.id || seen.has(item.id)) return;

        seen.add(item.id);
        sections.push({
            key: `${title}-${item.id}`,
            title,
            item,
            movements: inventoryStockMovementHistory[item.id] ?? [],
            totalMovements: Number(inventoryStockMovementHistoryTotals[item.id] ?? 0),
            loading: inventoryStockMovementHistoryLoading[item.id] ?? false,
            error: inventoryStockMovementHistoryErrors[item.id] ?? null,
            ledgerHref: inventoryStockLedgerHref(item.id),
        });
    };

    if (detailsSheetHasDifferentDispenseTarget.value) {
        pushSection('Ordered medicine ledger', detailsSheetOrderedInventoryItem.value);
        pushSection(
            'Dispense target ledger',
            detailsSheetDispenseTargetInventoryItem.value,
        );
    } else {
        pushSection(
            'Latest stock movements',
            detailsSheetOrderedInventoryItem.value ??
                detailsSheetDispenseTargetInventoryItem.value,
        );
    }

    return sections;
});

const detailsSheetHasDifferentDispenseTarget = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return false;

    return (
        inventoryMedicationLookupKey(order.medicationCode, order.medicationName) !==
        inventoryMedicationLookupKey(
            orderDispenseTargetMedicationCode(order),
            orderDispenseTargetMedicationName(order),
        )
    );
});

const statusDialogDispenseTargetInventoryItem = computed<InventoryItem | null>(() => {
    const order = statusDialogOrder.value;
    if (!order) return null;

    return inventoryMedicationMatch(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const statusDialogDispenseTargetInventoryLoading = computed(() => {
    const order = statusDialogOrder.value;
    if (!order) return false;

    return inventoryMedicationIsLoading(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const statusDialogDispenseTargetInventoryError = computed(() => {
    const order = statusDialogOrder.value;
    if (!order) return null;

    return inventoryMedicationError(
        orderDispenseTargetMedicationCode(order),
        orderDispenseTargetMedicationName(order),
    );
});

const detailsSheetOverviewCards = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return [];

    const dispenseInventoryItem = detailsSheetDispenseTargetInventoryItem.value;
    const dispenseInventoryError = detailsSheetDispenseTargetInventoryError.value;
    const dispenseInventoryLoading = detailsSheetDispenseTargetInventoryLoading.value;
    const releaseLabel = orderReleaseStateLabel(order);

    return [
        {
            id: 'policy',
            title: 'Approved medicines policy',
            value: approvedMedicineDecisionLabel(order.formularyDecisionStatus),
            helper: order.formularyDecisionReason?.trim()
                ? order.formularyDecisionReason
                : policyNeedsReason(order.formularyDecisionStatus)
                  ? 'A reason should stay attached to outside-list or restricted decisions.'
                  : 'Use policy review when approved-medicines or substitution rules change.',
            badgeVariant: formularyDecisionVariant(order.formularyDecisionStatus),
        },
        {
            id: 'release',
            title: 'Release verification',
            value: releaseLabel ?? 'Not released',
            helper: order.verifiedAt
                ? `Verified ${formatDateTime(order.verifiedAt)}`
                : releaseLabel === 'Release blocked'
                  ? 'Substituted dispense still needs pharmacist review before release.'
                  : releaseLabel === 'Release pending'
                    ? 'A pharmacist verification note is still expected before release.'
                    : 'Verification becomes available after the order is dispensed.',
            badgeVariant: orderReleaseStateVariant(order),
        },
        {
            id: 'stock',
            title: 'Dispense stock',
            value: dispenseInventoryLoading
                ? 'Loading'
                : dispenseInventoryError
                  ? 'Unavailable'
                  : dispenseInventoryItem
                    ? inventoryStockStateLabel(dispenseInventoryItem.stockState)
                    : 'Not linked',
            helper: dispenseInventoryLoading
                ? 'Loading current stock from inventory.'
                : dispenseInventoryError
                  ? dispenseInventoryError
                  : dispenseInventoryItem
                    ? `${inventoryStockQuantityLabel(dispenseInventoryItem)} on hand. ${inventoryStockHelperText(dispenseInventoryItem)}`
                    : 'No active stock match was found for the medicine that will be dispensed.',
            badgeVariant: dispenseInventoryLoading
                ? 'outline'
                : dispenseInventoryError
                  ? 'destructive'
                  : dispenseInventoryItem
                    ? inventoryStockStateVariant(dispenseInventoryItem.stockState)
                    : 'outline',
        },
        {
            id: 'reconciliation',
            title: 'Medication reconciliation',
            value: formatEnumLabel(order.reconciliationStatus || 'pending'),
            helper: reconciliationSummaryHelper(order),
            badgeVariant: reconciliationStatusVariant(order.reconciliationStatus),
        },
    ] as const;
});

const detailsSheetSafetyReviewSections = computed(() => {
    const review = detailsSheetSafetyReview.value;
    if (!review) return [];

    return [
        {
            id: 'encounter-duplicates',
            title: 'Same encounter duplicates',
            helper: 'Other active orders for the same medicine in this visit.',
            orders: review.sameEncounterDuplicates,
        },
        {
            id: 'recent-duplicates',
            title: 'Recent same-medicine history',
            helper: 'Recent patient orders for the same medicine across encounters.',
            orders: review.recentPatientDuplicates,
        },
        {
            id: 'reconciliation-follow-up',
            title: 'Outstanding reconciliation follow-up',
            helper: 'Previously dispensed releases that still need reconciliation closure.',
            orders: review.unreconciledReleasedOrders,
        },
    ].filter((section) => section.orders.length > 0);
});

function buildPrimaryPharmacyWorkflowAction(
    order: PharmacyOrder,
): PharmacyPrimaryWorkflowActionDefinition | null {
    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending')
        .trim()
        .toLowerCase();

    if (status === 'cancelled') return null;

    if (
        canManagePharmacyPolicy.value &&
        orderNeedsBlockingPolicyReview(order) &&
        status !== 'dispensed'
    ) {
        return {
            id: 'policy' as const,
            label: 'Review policy',
            helper:
                'Confirm the approved-medicines decision and any substitution before dispense work continues.',
            buttonVariant: 'outline' as const,
            surfaceVariant: 'destructive' as const,
        };
    }

    if (canUpdatePharmacyOrderStatus.value && status === 'pending') {
        return {
            id: 'preparation' as const,
            label: 'Start preparation',
            helper:
                'Move the order into preparation once stock and medicine choice are ready.',
            buttonVariant: 'default' as const,
            surfaceVariant: 'outline' as const,
        };
    }

    if (canUpdatePharmacyOrderStatus.value && status === 'in_preparation') {
        return {
            id: 'dispense' as const,
            label: hasSubstitutionInDispenseNotes(order)
                ? 'Dispense substitute'
                : 'Dispense medication',
            helper:
                'Record the release quantity and pharmacist note when the medicine is ready.',
            buttonVariant: 'default' as const,
            surfaceVariant: 'outline' as const,
        };
    }

    if (canUpdatePharmacyOrderStatus.value && status === 'partially_dispensed') {
        return {
            id: 'dispense' as const,
            label: 'Complete dispense',
            helper:
                'Finish the remaining dispense quantity and keep the release note updated.',
            buttonVariant: 'default' as const,
            surfaceVariant: 'secondary' as const,
        };
    }

    if (canVerifyPharmacyDispense.value && orderNeedsVerification(order)) {
        return {
            id: 'verify' as const,
            label: hasSubstitutionInDispenseNotes(order)
                ? 'Verify substitute'
                : 'Verify + Release',
            helper:
                'A pharmacist verification note is still needed before the release is complete.',
            buttonVariant: hasSubstitutionInDispenseNotes(order)
                ? ('destructive' as const)
                : ('default' as const),
            surfaceVariant: 'destructive' as const,
        };
    }

    if (canReconcilePharmacyOrders.value && canOpenReconciliationAction(order)) {
        return {
            id: 'reconciliation' as const,
            label:
                reconciliation === 'exception'
                    ? 'Resolve reconciliation exception'
                    : 'Complete reconciliation',
            helper:
                reconciliation === 'exception'
                    ? 'The recorded exception needs follow-up before the order can close cleanly.'
                    : 'Finish medication reconciliation after the release is verified.',
            buttonVariant:
                reconciliation === 'exception'
                    ? ('destructive' as const)
                    : ('secondary' as const),
            surfaceVariant:
                reconciliation === 'exception'
                    ? ('destructive' as const)
                    : ('secondary' as const),
        };
    }

    if (canManagePharmacyPolicy.value && orderNeedsPolicyAttention(order)) {
        return {
            id: 'policy' as const,
            label: 'Review policy',
            helper:
                'Capture the approved-medicines or substitution decision for the completed order.',
            buttonVariant: 'outline' as const,
            surfaceVariant: 'secondary' as const,
        };
    }

    return null;
}

function buildSupportingPharmacyWorkflowActions(
    order: PharmacyOrder,
): PharmacySupportingWorkflowActionDefinition[] {
    const primaryAction = buildPrimaryPharmacyWorkflowAction(order);
    const primaryActionId = primaryAction?.id ?? null;

    const status = (order.status ?? '').trim().toLowerCase();
    const reconciliation = (order.reconciliationStatus ?? 'pending')
        .trim()
        .toLowerCase();

    const actions: PharmacySupportingWorkflowActionDefinition[] = [];

    if (
        canManagePharmacyPolicy.value &&
        status !== 'cancelled' &&
        orderNeedsBlockingPolicyReview(order) &&
        primaryActionId !== 'policy'
    ) {
        actions.push({
            id: 'policy',
            title: 'Policy review',
            helper:
                status === 'dispensed'
                    ? 'Capture any late substitution or formulary review details that must stay attached to the completed order.'
                    : 'Approved-medicines or substitution review is still needed for this order.',
            buttonLabel: 'Review policy',
            buttonVariant: status === 'dispensed' ? 'outline' : 'destructive',
        });
    }

    if (
        canUpdatePharmacyOrderStatus.value &&
        status === 'in_preparation' &&
        primaryActionId !== 'partial'
    ) {
        actions.push({
            id: 'partial',
            title: 'Partial dispense',
            helper:
                'Capture an initial quantity when the full prescribed amount cannot be released yet.',
            buttonLabel: 'Record partial',
            buttonVariant: 'outline',
        });
    }

    if (
        canReconcilePharmacyOrders.value &&
        canOpenReconciliationAction(order) &&
        primaryActionId !== 'reconciliation'
    ) {
        actions.push({
            id: 'reconciliation',
            title: 'Medication reconciliation',
            helper:
                reconciliation === 'exception'
                    ? 'Resolve the reconciliation exception recorded after release.'
                    : 'Close medication reconciliation after the release is verified.',
            buttonLabel:
                reconciliation === 'exception'
                    ? 'Resolve exception'
                    : 'Reconcile order',
            buttonVariant:
                reconciliation === 'exception' ? 'destructive' : 'secondary',
        });
    }

    return actions;
}

function pharmacySafetyReviewOrderLabel(order: PharmacyOrder): string {
    const medication = orderRequestedMedicationDisplay(order);

    if (order.orderNumber?.trim()) {
        return `${order.orderNumber} • ${medication}`;
    }

    return medication;
}

function buildPharmacyRowOverflowActions(
    order: PharmacyOrder,
): PharmacyRowOverflowActionDefinition[] {
    const status = (order.status ?? '').trim().toLowerCase();
    const actions: PharmacyRowOverflowActionDefinition[] = buildSupportingPharmacyWorkflowActions(
        order,
    ).map((action) => ({
        id: action.id,
        label: action.buttonLabel,
        buttonVariant: action.buttonVariant,
        destructive: action.buttonVariant === 'destructive',
    }));

    if (
        canUpdatePharmacyOrderStatus.value &&
        status !== 'dispensed' &&
        status !== 'cancelled'
    ) {
        actions.push({
            id: 'cancel',
            label: 'Cancel order',
            buttonVariant: 'destructive',
            destructive: true,
        });
    }

    return actions;
}

const detailsSheetPrimaryWorkflowAction = computed(() => {
    const order = detailsSheetOrder.value;
    return order ? buildPrimaryPharmacyWorkflowAction(order) : null;
});

const detailsSheetWorkflowActions = computed(() => {
    const order = detailsSheetOrder.value;
    return order ? buildSupportingPharmacyWorkflowActions(order) : [];
});

const detailsSheetActionBanner = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return null;

    const primaryAction = detailsSheetPrimaryWorkflowAction.value;
    const queueTitle = orderQueueFocusTitle(order);
    const queueDetail = orderQueueFocusDetail(order);
    const queueVariant = orderQueueFocusSurfaceVariant(order);

    return {
        title: queueTitle ?? primaryAction?.label ?? orderNextWorkflowLabel(order),
        description:
            queueTitle !== null
                ? queueDetail
                : primaryAction?.helper ?? orderNextWorkflowDetail(order),
        variant:
            queueTitle !== null
                ? queueVariant
                : primaryAction?.surfaceVariant ??
                  (orderNeedsPolicyAttention(order) ||
                  orderNeedsVerification(order) ||
                  (order.reconciliationStatus ?? 'pending').trim().toLowerCase() === 'exception'
                      ? 'destructive'
                      : orderNeedsReconciliation(order)
                        ? 'secondary'
                        : 'outline'),
    } as const;
});

const detailsSheetWorkflowFocusHeading = computed(() =>
    canOperatePharmacyWorkflow.value ? 'Workflow focus' : 'Order summary',
);

const detailsSheetActionBannerVariant = computed(
    () => detailsSheetActionBanner.value?.variant ?? 'outline',
);

const detailsSheetActionBannerEyebrow = computed(() => {
    const variant = detailsSheetActionBannerVariant.value;
    if (variant === 'destructive') return 'Immediate attention';
    if (variant === 'secondary') return 'Active follow-up';
    if (variant === 'default') return 'Ready now';
    return 'Next workflow step';
});

const statusDialogSafetyWarnings = computed(() => {
    const order = statusDialogOrder.value;
    const action = statusDialogAction.value;
    if (!order || !action) return [];

    const warnings: Array<{
        id: string;
        title: string;
        description: string;
        variant: 'default' | 'secondary' | 'outline' | 'destructive';
    }> = [];

    if (
        (action === 'partially_dispensed' ||
            action === 'dispensed' ||
            action === 'verify') &&
        statusDialogSafetyReview.value
    ) {
        statusDialogSafetyReview.value.blockers.forEach((item, index) => {
            warnings.push({
                id: `safety-blocker-${index}`,
                title: 'Medication safety blocker',
                description: item,
                variant: 'destructive',
            });
        });

        statusDialogSafetyReview.value.warnings.forEach((item, index) => {
            warnings.push({
                id: `safety-warning-${index}`,
                title: 'Medication safety warning',
                description: item,
                variant: 'secondary',
            });
        });
    } else if (
        (action === 'partially_dispensed' ||
            action === 'dispensed' ||
            action === 'verify') &&
        statusDialogSafetyReviewError.value
    ) {
        warnings.push({
            id: 'safety-review-unavailable',
            title: 'Medication safety review unavailable',
            description: statusDialogSafetyReviewError.value,
            variant: 'outline',
        });
    } else if (
        (action === 'partially_dispensed' ||
            action === 'dispensed' ||
            action === 'verify') &&
        statusDialogSafetyReviewLoading.value
    ) {
        warnings.push({
            id: 'safety-review-loading',
            title: 'Medication safety review is loading',
            description:
                'Wait for the latest allergy, interaction, lab-result, duplicate, and reconciliation review before completing this workflow step.',
            variant: 'outline',
        });
    }

    if (statusDialogSubstitutionMade.value || hasSubstitutionInDispenseNotes(order)) {
        warnings.push({
            id: 'substitution-risk',
            title: 'Substitution needs explicit verification',
            description:
                statusDialogNeedsVerificationNote.value
                    ? 'A verification note is required because a substitution is attached to this dispense.'
                    : 'Carry the substitution reason forward in the dispensing and verification notes.',
            variant: 'destructive',
        });
    }

    if (
        (action === 'partially_dispensed' || action === 'dispensed') &&
        !statusDialogSafetyReview.value
    ) {
        if (statusDialogDispenseTargetInventoryError.value) {
            warnings.push({
                id: 'inventory-lookup-failed',
                title: 'Inventory stock could not be confirmed',
                description: statusDialogDispenseTargetInventoryError.value,
                variant: 'outline',
            });
        } else if (
            canReadInventoryProcurement.value &&
            !statusDialogDispenseTargetInventoryLoading.value &&
            !statusDialogDispenseTargetInventoryItem.value
        ) {
            warnings.push({
                id: 'inventory-unlinked',
                title: 'Dispense medicine is not linked to inventory',
                description:
                    'The medicine that will be dispensed does not have a matched inventory item in this facility scope.',
                variant: 'outline',
            });
        } else if (
            statusDialogDispenseTargetInventoryItem.value &&
            (statusDialogDispenseTargetInventoryItem.value.stockState ?? '')
                .trim()
                .toLowerCase() === 'out_of_stock'
        ) {
            warnings.push({
                id: 'inventory-out-of-stock',
                title: 'Inventory shows this medicine as out of stock',
                description:
                    'Review stock or substitution before completing the dispense step.',
                variant: 'destructive',
            });
        } else if (
            statusDialogDispenseTargetInventoryItem.value &&
            (statusDialogDispenseTargetInventoryItem.value.stockState ?? '')
                .trim()
                .toLowerCase() === 'low_stock'
        ) {
            warnings.push({
                id: 'inventory-low-stock',
                title: 'Inventory is low for this dispense medicine',
                description:
                    'Current stock is at or below the reorder level. Release should stay deliberate.',
                variant: 'secondary',
            });
        }
    }

    if (action === 'verify' && orderNeedsReconciliation(order)) {
        warnings.push({
            id: 'reconciliation-follow-up',
            title: 'Reconciliation follows verification',
            description:
                'This order still needs medication reconciliation after release verification.',
            variant: 'outline',
        });
    }

    return warnings;
});

const statusDialogActionButtonLabel = computed(() => {
    const action = statusDialogAction.value;
    const order = statusDialogOrder.value;
    const hasSubstitution = order ? hasSubstitutionInDispenseNotes(order) : false;

    if (action === 'in_preparation') return 'Start Prep';
    if (action === 'partially_dispensed') return 'Record Partial Dispense';
    if (action === 'dispensed') {
        return hasSubstitution ? 'Dispense Substitute' : 'Dispense Medication';
    }
    if (action === 'verify') {
        return hasSubstitution ? 'Verify Substitute' : 'Verify + Release';
    }

    return 'Cancel Order';
});

const statusDialogSize = computed<'3xl' | '5xl'>(() => {
    const action = statusDialogAction.value;

    if (
        action === 'dispensed'
        || action === 'partially_dispensed'
        || action === 'verify'
    ) {
        return '5xl';
    }

    return '3xl';
});

const statusDialogNextStepSummary = computed(() => {
    const action = statusDialogAction.value;
    if (!action) return 'Review the order workflow and save the right step.';
    if (action === 'in_preparation') {
        return 'Next: capture the dispense quantity and pharmacist notes when the medicine is ready.';
    }
    if (action === 'partially_dispensed') {
        return 'Next: return to complete the remaining dispense quantity, then verify and release.';
    }
    if (action === 'dispensed') {
        return 'Next: a pharmacist should verify and release this dispense, then complete reconciliation.';
    }
    if (action === 'verify') {
        return 'Next: complete medication reconciliation or resolve any reconciliation exception.';
    }

    return 'Next: the workflow closes and no more dispense actions remain.';
});

const statusDialogWorkflowSummaryCards = computed(() => {
    const order = statusDialogOrder.value;
    if (!order) return [];

    const releaseReady =
        (order.status ?? '').trim().toLowerCase() === 'dispensed' && !order.verifiedAt;
    const releaseState = order.verifiedAt
        ? {
              value: 'Released',
              helper: 'Verified ' + formatDateTime(order.verifiedAt),
              variant: 'default' as const,
          }
        : releaseReady
          ? {
                value: 'Verification pending',
                helper: 'A pharmacist note is still needed before release is complete.',
                variant: 'secondary' as const,
            }
          : {
                value: 'Not released',
                helper: 'Release happens after the dispense step is recorded.',
                variant: 'outline' as const,
            };

    const reconciliation = (order.reconciliationStatus ?? 'pending').trim().toLowerCase();
    const reconciliationState =
        reconciliation === 'completed'
            ? {
                  value: 'Completed',
                  helper: reconciliationSummaryHelper(order),
                  variant: 'default' as const,
              }
            : reconciliation === 'exception'
              ? {
                    value: 'Exception',
                    helper: reconciliationSummaryHelper(order),
                    variant: 'destructive' as const,
                }
              : {
                    value: 'Pending',
                    helper: reconciliationSummaryHelper(order),
                    variant: 'outline' as const,
                };

    return [
        {
            id: 'progress',
            title: 'Current step',
            value: formatEnumLabel(order.status || 'pending'),
            helper: dispenseProgressLabel(order),
            variant: statusVariant(order.status),
        },
        {
            id: 'release',
            title: 'Release state',
            ...releaseState,
        },
        {
            id: 'reconciliation',
            title: 'Reconciliation',
            ...reconciliationState,
        },
    ];
});

const reconciliationDialogTitle = computed(() => {
    const status = reconciliationDialogForm.reconciliationStatus.trim().toLowerCase();
    if (status === 'exception') return 'Resolve Reconciliation Exception';
    if (status === 'pending') return 'Review Reconciliation Later';
    return 'Complete Medication Reconciliation';
});

const reconciliationDialogDescription = computed(() => {
    const status = reconciliationDialogForm.reconciliationStatus.trim().toLowerCase();
    if (status === 'exception') {
        return 'Document the reconciliation issue clearly so the next pharmacist or clinician can follow up safely.';
    }
    if (status === 'pending') {
        return 'Keep reconciliation open and mark this dispensed medicine for review later.';
    }
    return 'Record how this dispensed medicine should affect the patient current medication list.';
});

const reconciliationDialogSummaryBadges = computed(() => {
    const order = reconciliationDialogOrder.value;
    if (!order) return [];

    const badges = [
        {
            id: 'status',
            label: formatEnumLabel(order.status || 'pending'),
            variant: statusVariant(order.status),
        },
        {
            id: 'release',
            label: order.verifiedAt ? 'Release verified' : 'Verification pending',
            variant: order.verifiedAt ? ('default' as const) : ('secondary' as const),
        },
        {
            id: 'reconciliation',
            label: formatEnumLabel(order.reconciliationStatus || 'pending'),
            variant: reconciliationStatusVariant(order.reconciliationStatus),
        },
    ];

    const decisionLabel = reconciliationDecisionLabel(order.reconciliationDecision);
    if (decisionLabel) {
        badges.push({
            id: 'reconciliation-decision',
            label: decisionLabel,
            variant:
                (order.reconciliationStatus ?? 'pending').trim().toLowerCase() === 'completed'
                    ? ('secondary' as const)
                    : ('outline' as const),
        });
    }

    return badges;
});

const reconciliationDialogDecisionRequired = computed(
    () => reconciliationDialogForm.reconciliationStatus.trim().toLowerCase() === 'completed',
);

const reconciliationDialogSelectedDecisionOption = computed(() =>
    reconciliationDecisionOptions.find(
        (option) => option.value === reconciliationDialogForm.reconciliationDecision.trim(),
    ) ?? null,
);

const reconciliationDialogDecisionGuidance = computed(() => {
    const status = reconciliationDialogForm.reconciliationStatus.trim().toLowerCase();

    if (status === 'completed') {
        return reconciliationDialogSelectedDecisionOption.value?.description
            ?? 'Choose the final outcome for the patient current medication list.';
    }

    if (status === 'exception') {
        return 'Use exception when reconciliation could not be closed safely and needs active follow-up.';
    }

    return 'Use pending when the medicine was released but reconciliation needs to be reviewed later.';
});

const reconciliationDialogNoteLabel = computed(() => {
    const status = reconciliationDialogForm.reconciliationStatus.trim().toLowerCase();
    if (status === 'exception') return 'Exception Note';
    if (status === 'pending') return 'Review Note';
    return 'Reconciliation Note';
});

const reconciliationDialogNotePlaceholder = computed(() => {
    const status = reconciliationDialogForm.reconciliationStatus.trim().toLowerCase();
    if (status === 'exception') {
        return 'Required. Explain what blocked reconciliation or what needs follow-up.';
    }
    if (status === 'pending') {
        return 'Optional. Add context for the pharmacist or clinician who will review this later.';
    }
    return 'Optional. Record supporting context for the chosen reconciliation outcome.';
});

watch(
    () => reconciliationDialogForm.reconciliationStatus,
    (status) => {
        if (status.trim().toLowerCase() !== 'completed') {
            reconciliationDialogForm.reconciliationDecision = '';
        }

        reconciliationDialogError.value = null;
    },
);

const selectedPolicySubstitutionApprovedMedicineItem = computed<ClinicalCatalogItem | null>(
    () => {
        const selectedId = policyDialogForm.substitutedMedicationCatalogItemId.trim();
        if (!selectedId) return null;

        return (
            approvedMedicinesCatalogItems.value.find((item) => item.id === selectedId) ??
            null
        );
    },
);

const policyDialogRequestedApprovedMedicineItem = computed<ClinicalCatalogItem | null>(
    () =>
        findApprovedMedicineCatalogItem(
            policyDialogOrder.value?.medicationCode,
            policyDialogOrder.value?.medicationName,
        ),
);

const policyDialogRequestedMedicineGovernance = computed(() =>
    approvedMedicineGovernanceProfile(policyDialogRequestedApprovedMedicineItem.value),
);

const policyDialogRequestedMedicinePreferredAlternativesLabel = computed(() => {
    const alternatives =
        policyDialogRequestedMedicineGovernance.value.preferredAlternatives;

    return alternatives.length > 0 ? alternatives.join(', ') : null;
});

const policyDialogPolicyRecommendation = computed<ApprovedMedicinePolicyRecommendation | null>(
    () => policyDialogSafetyReview.value?.policyRecommendation ?? null,
);

const selectedPolicySubstitutionCategoryLabel = computed(() => {
    const category =
        selectedPolicySubstitutionApprovedMedicineItem.value?.category?.trim();
    return category ? formatEnumLabel(category) : null;
});

const selectedPolicySubstitutionDosageForm = computed(() =>
    approvedMedicineDosageForm(selectedPolicySubstitutionApprovedMedicineItem.value),
);

const selectedPolicySubstitutionStrength = computed(() =>
    approvedMedicineStrength(selectedPolicySubstitutionApprovedMedicineItem.value),
);

const selectedPolicySubstitutionUnitLabel = computed(() =>
    approvedMedicineDisplayUnitLabel(
        selectedPolicySubstitutionApprovedMedicineItem.value,
    ),
);

const selectedPolicySubstitutionInventoryItem = computed<InventoryItem | null>(() =>
    inventoryMedicationMatch(
        policyDialogForm.substitutedMedicationCode,
        policyDialogForm.substitutedMedicationName,
    ),
);

const selectedPolicySubstitutionInventoryLoading = computed(() =>
    inventoryMedicationIsLoading(
        policyDialogForm.substitutedMedicationCode,
        policyDialogForm.substitutedMedicationName,
    ),
);

const selectedPolicySubstitutionInventoryError = computed(() =>
    inventoryMedicationError(
        policyDialogForm.substitutedMedicationCode,
        policyDialogForm.substitutedMedicationName,
    ),
);

const policyDialogUsesOutsideListOverride = computed(
    () => policyDialogForm.substitutionSelectionMode === 'outside_list',
);

const policyDialogRecommendationNeedsDecisionReason = computed(() => {
    const recommendation = policyDialogPolicyRecommendation.value;
    if (!recommendation) return false;

    return (
        recommendation.requiresDecisionReason &&
        policyDialogForm.formularyDecisionStatus ===
            recommendation.suggestedDecisionStatus
    );
});

const policyDialogEffectiveNeedsFormularyReason = computed(
    () =>
        policyNeedsReason(policyDialogForm.formularyDecisionStatus) ||
        policyDialogRecommendationNeedsDecisionReason.value,
);

const policyDialogSummaryBadges = computed(() => {
    const order = policyDialogOrder.value;
    if (!order) return [];

    return [
        {
            id: 'formulary',
            label: approvedMedicineDecisionLabel(order.formularyDecisionStatus),
            variant: formularyDecisionVariant(order.formularyDecisionStatus),
        },
        {
            id: 'substitution-allowed',
            label: order.substitutionAllowed ? 'Substitution allowed' : 'Substitution locked',
            variant: order.substitutionAllowed ? 'secondary' : 'outline',
        },
        {
            id: 'substitution-made',
            label: order.substitutionMade ? 'Substitution recorded' : 'No substitution',
            variant: order.substitutionMade ? 'destructive' : 'outline',
        },
    ] as const;
});

const policyDialogRecommendationAlertVariant = computed<
    'default' | 'secondary' | 'outline'
>(() => {
    const recommendation = policyDialogPolicyRecommendation.value;
    if (!recommendation) return 'outline';

    return recommendation.severity === 'warning' ? 'secondary' : 'outline';
});

const policyDialogRecommendationMatchesCurrentSelection = computed(() => {
    const recommendation = policyDialogPolicyRecommendation.value;
    if (!recommendation) return false;

    const decisionMatches =
        policyDialogForm.formularyDecisionStatus ===
        recommendation.suggestedDecisionStatus;
    const modeMatches =
        !recommendation.suggestedSubstitutionSelectionMode ||
        policyDialogForm.substitutionSelectionMode ===
            recommendation.suggestedSubstitutionSelectionMode;
    const substitutionMatches =
        !recommendation.substitutionRecommended ||
        policyDialogForm.substitutionAllowed;
    const reasonMatches = recommendation.requiresDecisionReason
        ? Boolean(policyDialogForm.formularyDecisionReason.trim())
        : true;

    return decisionMatches && modeMatches && substitutionMatches && reasonMatches;
});

const policyDialogGuidance = computed(() => {
    if (policyDialogForm.substitutionMade && !policyDialogForm.substitutionAllowed) {
        return {
            title: 'Substitution cannot stay recorded while substitution is locked.',
            description:
                'Enable substitution first, or clear the substitution before saving policy.',
            variant: 'destructive',
        } as const;
    }

    if (policyDialogEffectiveNeedsFormularyReason.value) {
        return {
            title: 'A policy reason is expected for this decision.',
            description:
                policyDialogRecommendationNeedsDecisionReason.value
                    ? 'This recommendation still needs a documented governance reason before the decision can be saved.'
                    : 'Outside-list and restricted medicines should keep a visible governance reason.',
            variant: 'secondary',
        } as const;
    }

    if (policyDialogForm.substitutionMade) {
        if (
            policyDialogForm.substitutionSelectionMode === 'approved' &&
            approvedMedicinesCatalogAccessBlocked.value
        ) {
            return {
                title: 'Approved medicines picker is unavailable.',
                description:
                    'This pharmacy account cannot open the approved medicines picker. Use the outside-list override only for a true exception.',
                variant: 'destructive',
            } as const;
        }

        if (
            policyDialogForm.substitutionSelectionMode === 'approved' &&
            !policyDialogForm.substitutedMedicationCatalogItemId.trim()
        ) {
            return {
                title: 'Choose the approved substitute medicine.',
                description:
                    'Select a substitute from the approved medicines list so code and display name stay canonical.',
                variant: 'outline',
            } as const;
        }

        if (policyDialogUsesOutsideListOverride.value) {
            return {
                title: 'Outside-list substitution should stay explicit.',
                description:
                    'Keep the outside-list substitute code, name, and exception reason visible on the order.',
                variant: 'secondary',
            } as const;
        }

        return {
            title: 'Capture the substituted medication and reason.',
            description:
                'The selected substitute and the clinical or availability reason should stay attached to the order.',
            variant: 'outline',
        } as const;
    }

    return {
        title: 'No active policy blockers.',
        description:
            'Use this panel when approved-medicines review or medication substitution changes the dispense path.',
        variant: 'outline',
    } as const;
});

function applyPolicyRecommendation() {
    const recommendation = policyDialogPolicyRecommendation.value;
    if (!recommendation) return;

    policyDialogForm.formularyDecisionStatus =
        recommendation.suggestedDecisionStatus;
    policyDialogForm.substitutionAllowed =
        recommendation.substitutionRecommended ||
        policyDialogRequestedMedicineGovernance.value.substitutionAllowed;

    if (recommendation.suggestedSubstitutionSelectionMode) {
        policyDialogForm.substitutionSelectionMode =
            recommendation.suggestedSubstitutionSelectionMode as PolicySubstitutionSelectionMode;
    }

    if (
        recommendation.suggestedDecisionReason &&
        !policyDialogForm.formularyDecisionReason.trim()
    ) {
        policyDialogForm.formularyDecisionReason =
            recommendation.suggestedDecisionReason;
    }
}

const pendingPreparationOrders = computed(() =>
    orders.value.filter((order) => (order.status ?? '').trim().toLowerCase() === 'pending'),
);

const verificationQueueOrders = computed(() =>
    orders.value.filter((order) => orderNeedsVerification(order)),
);

function runPharmacyWorkflowAction(order: PharmacyOrder, actionId: PharmacyWorkflowActionId) {
    switch (actionId) {
        case 'policy':
            openPolicyDialog(order);
            return;
        case 'preparation':
            openOrderStatusDialog(order, 'in_preparation');
            return;
        case 'partial':
            openOrderStatusDialog(order, 'partially_dispensed');
            return;
        case 'dispense':
            openOrderStatusDialog(order, 'dispensed');
            return;
        case 'verify':
            openOrderStatusDialog(order, 'verify');
            return;
        case 'reconciliation':
            openReconciliationDialog(order);
    }
}

function runDetailsSheetWorkflowAction(actionId: PharmacyWorkflowActionId) {
    const order = detailsSheetOrder.value;
    if (!order) return;

    runPharmacyWorkflowAction(order, actionId);
}

function runPharmacyRowOverflowAction(
    order: PharmacyOrder,
    actionId: PharmacyWorkflowActionId | 'cancel',
) {
    if (actionId === 'cancel') {
        openOrderStatusDialog(order, 'cancelled');
        return;
    }

    runPharmacyWorkflowAction(order, actionId);
}

const pharmacyQueueRowActions = computed<Record<string, PharmacyQueueRowActionState>>(() => {
    const rowActions: Record<string, PharmacyQueueRowActionState> = {};

    orders.value.forEach((order) => {
        rowActions[order.id] = {
            primary: buildPrimaryPharmacyWorkflowAction(order),
            overflow: buildPharmacyRowOverflowActions(order),
        };
    });

    return rowActions;
});

function pharmacyQueueRowActionState(order: PharmacyOrder): PharmacyQueueRowActionState {
    return pharmacyQueueRowActions.value[order.id] ?? {
        primary: null,
        overflow: [],
    };
}

const policyAttentionOrders = computed(() =>
    orders.value.filter((order) => orderNeedsPolicyAttention(order)),
);

const reconciliationFollowUpOrders = computed(() =>
    orders.value.filter((order) => orderNeedsReconciliation(order)),
);

const pharmacyWorkloadCards = computed<
    Array<{
        id: PharmacyWorkloadCardId;
        title: string;
        count: number;
        helper: string;
        nextOrderLabel: string;
        actionLabel: string;
        accentClass: string;
        order: PharmacyOrder | null;
        badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
        buttonVariant: 'default' | 'secondary' | 'outline' | 'destructive';
        focusLabel: string | null;
        focusDetail: string;
    }>
>(() => {
    const prepOrder = pendingPreparationOrders.value[0] ?? null;
    const verifyOrder = verificationQueueOrders.value[0] ?? null;
    const policyOrder = policyAttentionOrders.value[0] ?? null;
    const reconciliationOrder = reconciliationFollowUpOrders.value[0] ?? null;

    const nextOrderSummary = (order: PharmacyOrder | null) =>
        order
            ? `${order.orderNumber || 'Pharmacy Order'} | ${order.medicationName || order.medicationCode || 'Medication'}`
            : 'Nothing active in this focus';

    const cardFocus = (order: PharmacyOrder | null, fallback: string) => ({
        label: order ? orderQueueFocusTitle(order) ?? orderNextWorkflowLabel(order) : null,
        detail: order ? orderQueueFocusDetail(order) : fallback,
    });

    const prepFocus = cardFocus(prepOrder, 'Pending orders waiting to move into preparation.');
    const verifyFocus = cardFocus(
        verifyOrder,
        'Dispensed orders still waiting for pharmacist verification.',
    );
    const policyFocus = cardFocus(
        policyOrder,
        'Approved-medicines or substitution decisions that still need attention.',
    );
    const reconciliationFocus = cardFocus(
        reconciliationOrder,
        'Verified releases still waiting for reconciliation closure.',
    );

    return [
        {
            id: 'preparation',
            title: 'Preparation queue',
            count: pendingPreparationOrders.value.length,
            helper: 'Pending orders waiting to move into preparation.',
            nextOrderLabel: nextOrderSummary(prepOrder),
            actionLabel: 'Start next',
            accentClass: 'border-sky-500/60 bg-sky-500/5',
            order: prepOrder,
            badgeVariant: 'outline',
            buttonVariant: 'outline',
            focusLabel: prepFocus.label,
            focusDetail: prepFocus.detail,
        },
        {
            id: 'verification',
            title: 'Release verification',
            count: verificationQueueOrders.value.length,
            helper: 'Dispensed orders still waiting for pharmacist verification.',
            nextOrderLabel: nextOrderSummary(verifyOrder),
            actionLabel:
                verifyOrder && hasSubstitutionInDispenseNotes(verifyOrder)
                    ? 'Verify substitute'
                    : 'Verify next',
            accentClass:
                verifyOrder && hasSubstitutionInDispenseNotes(verifyOrder)
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-amber-500/60 bg-amber-500/5',
            order: verifyOrder,
            badgeVariant:
                verifyOrder && hasSubstitutionInDispenseNotes(verifyOrder)
                    ? 'destructive'
                    : 'secondary',
            buttonVariant:
                verifyOrder && hasSubstitutionInDispenseNotes(verifyOrder)
                    ? 'destructive'
                    : 'secondary',
            focusLabel: verifyFocus.label,
            focusDetail: verifyFocus.detail,
        },
        {
            id: 'policy',
            title: 'Policy review',
            count: policyAttentionOrders.value.length,
            helper: 'Approved-medicines or substitution decisions that still need attention.',
            nextOrderLabel: nextOrderSummary(policyOrder),
            actionLabel: 'Review next',
            accentClass: 'border-destructive/30 bg-destructive/5',
            order: policyOrder,
            badgeVariant: 'destructive',
            buttonVariant: 'destructive',
            focusLabel: policyFocus.label,
            focusDetail: policyFocus.detail,
        },
        {
            id: 'reconciliation',
            title: 'Reconciliation follow-up',
            count: reconciliationFollowUpOrders.value.length,
            helper: 'Verified releases still waiting for reconciliation closure.',
            nextOrderLabel: nextOrderSummary(reconciliationOrder),
            actionLabel:
                reconciliationOrder &&
                (reconciliationOrder.reconciliationStatus ?? 'pending').trim().toLowerCase() ===
                    'exception'
                    ? 'Resolve next'
                    : 'Reconcile next',
            accentClass:
                reconciliationOrder &&
                (reconciliationOrder.reconciliationStatus ?? 'pending').trim().toLowerCase() ===
                    'exception'
                    ? 'border-destructive/30 bg-destructive/5'
                    : 'border-primary/30 bg-primary/5',
            order: reconciliationOrder,
            badgeVariant:
                reconciliationOrder &&
                (reconciliationOrder.reconciliationStatus ?? 'pending').trim().toLowerCase() ===
                    'exception'
                    ? 'destructive'
                    : 'default',
            buttonVariant:
                reconciliationOrder &&
                (reconciliationOrder.reconciliationStatus ?? 'pending').trim().toLowerCase() ===
                    'exception'
                    ? 'destructive'
                    : 'secondary',
            focusLabel: reconciliationFocus.label,
            focusDetail: reconciliationFocus.detail,
        },
    ].filter((card) => canShowPharmacyWorkloadCard(card.id));
});

function handlePharmacyWorkloadCardAction(cardId: PharmacyWorkloadCardId) {
    switch (cardId) {
        case 'preparation':
            if (canUpdatePharmacyOrderStatus.value && pendingPreparationOrders.value[0]) {
                openOrderStatusDialog(pendingPreparationOrders.value[0], 'in_preparation');
                return;
            }
            applyPharmacyQueuePreset('pending');
            return;
        case 'verification':
            if (canVerifyPharmacyDispense.value && verificationQueueOrders.value[0]) {
                openOrderStatusDialog(verificationQueueOrders.value[0], 'verify');
                return;
            }
            applyPharmacySummaryFilter('dispensed');
            return;
        case 'policy':
            if (canManagePharmacyPolicy.value && policyAttentionOrders.value[0]) {
                openPolicyDialog(policyAttentionOrders.value[0]);
                return;
            }
            submitSearch();
            return;
        case 'reconciliation':
            if (canReconcilePharmacyOrders.value && reconciliationFollowUpOrders.value[0]) {
                openReconciliationDialog(reconciliationFollowUpOrders.value[0]);
                return;
            }
            applyPharmacySummaryFilter('dispensed');
    }
}

const canShowPharmacyWorkloadBoard = computed(
    () => canOperatePharmacyWorkflow.value && pharmacyWorkloadCards.value.length > 0,
);

const showPharmacyCareWorkflowFooter = computed(
    () =>
        canCreatePharmacyOrders.value ||
        canReadMedicalRecords.value ||
        canReadLaboratoryOrders.value ||
        canCreateTheatreProcedures.value ||
        canReadBillingInvoices.value,
);

const pharmacyDetailsSheetHasRelatedWorkflows = computed(() => {
    const order = detailsSheetOrder.value;
    if (!order) return false;

    return Boolean(
        (canReadAppointments.value && order.appointmentId) ||
            (canReadMedicalRecords.value && order.patientId) ||
            (canReadLaboratoryOrders.value && order.patientId) ||
            (canCreateTheatreProcedures.value && order.patientId) ||
            (canReadBillingInvoices.value && order.patientId),
    );
});

const pharmacyAuditExportPollAttempts = 20;
const pharmacyAuditExportPollDelayMs = 1500;

function triggerPharmacyAuditCsvDownload(downloadUrl: string) {
    const link = document.createElement('a');
    link.href = new URL(downloadUrl, window.location.origin).toString();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function waitMs(ms: number) {
    return new Promise<void>((resolve) => {
        window.setTimeout(resolve, ms);
    });
}

async function waitForPharmacyAuditExportJob(
    orderId: string,
    jobId: string,
): Promise<PharmacyOrderAuditExportJob> {
    let latest: PharmacyOrderAuditExportJob | null = null;

    for (let attempt = 0; attempt < pharmacyAuditExportPollAttempts; attempt += 1) {
        const response = await apiRequest<PharmacyOrderAuditExportJobResponse>(
            'GET',
            `/pharmacy-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
        );
        latest = response.data;
        if (latest.status === 'completed' || latest.status === 'failed') {
            return latest;
        }
        await waitMs(pharmacyAuditExportPollDelayMs);
    }

    return (
        latest ??
        (
            await apiRequest<PharmacyOrderAuditExportJobResponse>(
                'GET',
                `/pharmacy-orders/${orderId}/audit-logs/export-jobs/${jobId}`,
            )
        ).data
    );
}

function downloadPharmacyAuditExportJob(job: PharmacyOrderAuditExportJob) {
    if (!job.downloadUrl) return;
    triggerPharmacyAuditCsvDownload(job.downloadUrl);
}

async function retryPharmacyAuditExportJob(job: PharmacyOrderAuditExportJob) {
    if (!detailsSheetOrder.value) return;
    if (detailsSheetAuditExportRetryingJobId.value) return;
    const orderId = detailsSheetOrder.value.id;

    detailsSheetAuditExportRetryingJobId.value = job.id;
    try {
        const response = await apiRequest<PharmacyOrderAuditExportJobResponse>(
            'POST',
            `/pharmacy-orders/${orderId}/audit-logs/export-jobs/${job.id}/retry`,
        );
        notifySuccess('Audit export retry queued.');
        const createdJobId = response.data?.id ?? null;
        if (createdJobId) {
            const finalJob = await waitForPharmacyAuditExportJob(orderId, createdJobId);
            if (finalJob.status === 'completed' && finalJob.downloadUrl) {
                triggerPharmacyAuditCsvDownload(finalJob.downloadUrl);
                notifySuccess('Audit CSV export ready. Download started.');
            } else if (finalJob.status === 'failed') {
                throw new Error(finalJob.errorMessage || 'Audit export retry failed.');
            } else {
                notifySuccess('Audit export retry is processing.');
            }
        }
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to retry audit export job.'));
    } finally {
        detailsSheetAuditExportRetryingJobId.value = null;
        if (detailsSheetOrder.value) {
            void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
        }
    }
}

async function exportPharmacyAuditLogsCsv() {
    if (!detailsSheetOrder.value) return;
    if (detailsSheetAuditLogsExporting.value) return;

    detailsSheetAuditLogsExporting.value = true;

    try {
        const orderId = detailsSheetOrder.value.id;
        const createResponse = await apiRequest<PharmacyOrderAuditExportJobResponse>(
            'POST',
            `/pharmacy-orders/${orderId}/audit-logs/export-jobs`,
            {
                body: detailsSheetAuditLogsExportQuery(),
            },
        );
        const jobId = createResponse.data?.id;
        if (!jobId) {
            throw new Error('Unable to start audit export job.');
        }

        const finalJob = await waitForPharmacyAuditExportJob(orderId, jobId);
        if (finalJob.status === 'failed') {
            throw new Error(finalJob.errorMessage || 'Audit export job failed.');
        }
        if (finalJob.status !== 'completed' || !finalJob.downloadUrl) {
            notifySuccess('Audit CSV export queued. Retry in a moment if needed.');
            return;
        }

        triggerPharmacyAuditCsvDownload(finalJob.downloadUrl);
        notifySuccess('Audit CSV export ready. Download started.');
    } catch (error) {
        notifyError(messageFromUnknown(error, 'Unable to export audit entries.'));
    } finally {
        detailsSheetAuditLogsExporting.value = false;
        if (detailsSheetOrder.value) {
            void loadOrderAuditExportJobs(detailsSheetOrder.value.id);
        }
    }
}

function summarizeAuditExportJobs(
    jobs: Array<{ status: string | null | undefined }>,
): AuditExportJobStatusSummary {
    const summary: AuditExportJobStatusSummary = {
        total: 0,
        completed: 0,
        failed: 0,
        queued: 0,
        processing: 0,
        backlog: 0,
        other: 0,
    };

    for (const job of jobs) {
        summary.total += 1;
        const status = (job.status ?? '').toLowerCase();

        if (status === 'completed') {
            summary.completed += 1;
            continue;
        }
        if (status === 'failed') {
            summary.failed += 1;
            continue;
        }
        if (status === 'queued') {
            summary.queued += 1;
            continue;
        }
        if (status === 'processing') {
            summary.processing += 1;
            continue;
        }

        summary.other += 1;
    }

    summary.backlog = summary.queued + summary.processing;

    return summary;
}

const detailsSheetAuditExportJobSummary = computed(() =>
    summarizeAuditExportJobs(detailsSheetAuditExportJobs.value),
);

const detailsSheetAuditHasActiveFilters = computed(() =>
    Boolean(
        detailsSheetAuditLogsFilters.q.trim() ||
            detailsSheetAuditLogsFilters.action.trim() ||
            detailsSheetAuditLogsFilters.actorType ||
            detailsSheetAuditLogsFilters.actorId.trim() ||
            detailsSheetAuditLogsFilters.from ||
            detailsSheetAuditLogsFilters.to ||
            Number(detailsSheetAuditLogsFilters.perPage) !== 20,
    ),
);

const detailsSheetAuditSummary = computed(() => {
    const total = detailsSheetAuditLogsMeta.value?.total ?? detailsSheetAuditLogs.value.length;
    let changedEntries = 0;
    let userEntries = 0;

    for (const log of detailsSheetAuditLogs.value) {
        if (auditLogChangeKeys(log).length > 0) changedEntries += 1;
        if (log.actorId !== null && log.actorId !== undefined) userEntries += 1;
    }

    return {
        total,
        changedEntries,
        userEntries,
    };
});

const detailsSheetAuditExportOpsHint = computed(() => {
    const summary = detailsSheetAuditExportJobSummary.value;

    if (summary.total === 0) return null;

    if (summary.failed > 0 && summary.backlog > 0) {
        return `${summary.failed} failed and ${summary.backlog} queued/processing export jobs. Retry failed jobs once, and check queue workers if backlog persists.`;
    }
    if (summary.failed > 0) {
        return `${summary.failed} failed export jobs detected. Retry failed jobs once after confirming the current audit filters are correct.`;
    }
    if (summary.backlog > 0) {
        return `${summary.backlog} export jobs are still queued/processing. Avoid repeated retries while active jobs are still running.`;
    }

    return 'Export jobs look healthy. Use Download for completed jobs and Retry only for failed jobs.';
});

const scopeWarning = computed(() => {
    if (pageLoading.value) return null;
    if (!scope.value) return 'Platform access scope could not be loaded.';
    if (scope.value.resolvedFrom === 'none') {
        return 'No tenant/facility scope is resolved. Pharmacy order actions may be blocked by tenant isolation controls.';
    }
    return null;
});

const scopeStatusLabel = computed(() => {
    if (!scope.value) return 'Scope Unavailable';
    return scope.value.resolvedFrom === 'none' ? 'Scope Unresolved' : 'Scope Ready';
});

const visibleQueueCounts = computed(() => ({
    pending: orders.value.filter((order) => order.status === 'pending').length,
    inPreparation: orders.value.filter((order) => order.status === 'in_preparation')
        .length,
    partial: orders.value.filter((order) => order.status === 'partially_dispensed')
        .length,
    dispensed: orders.value.filter((order) => order.status === 'dispensed')
        .length,
    cancelled: orders.value.filter((order) => order.status === 'cancelled')
        .length,
    other: orders.value.filter(
        (order) =>
            order.status !== 'pending' &&
            order.status !== 'in_preparation' &&
            order.status !== 'partially_dispensed' &&
            order.status !== 'dispensed' &&
            order.status !== 'cancelled',
    )
        .length,
}));

const summaryQueueCounts = computed(() => {
    const fallbackTotal = Math.max(
        visibleQueueCounts.value.pending +
            visibleQueueCounts.value.inPreparation +
            visibleQueueCounts.value.partial +
            visibleQueueCounts.value.dispensed +
            visibleQueueCounts.value.cancelled +
            visibleQueueCounts.value.other,
        pagination.value?.total ?? 0,
    );

    if (!pharmacyOrderStatusCounts.value) {
        return {
            pending: visibleQueueCounts.value.pending,
            inPreparation: visibleQueueCounts.value.inPreparation,
            partial: visibleQueueCounts.value.partial,
            dispensed: visibleQueueCounts.value.dispensed,
            cancelled: visibleQueueCounts.value.cancelled,
            reconciliationPending: 0,
            reconciliationCompleted: 0,
            reconciliationException: 0,
            total: fallbackTotal,
        };
    }

    return {
        pending: pharmacyOrderStatusCounts.value.pending,
        inPreparation: pharmacyOrderStatusCounts.value.in_preparation,
        partial: pharmacyOrderStatusCounts.value.partially_dispensed,
        dispensed: pharmacyOrderStatusCounts.value.dispensed,
        cancelled: pharmacyOrderStatusCounts.value.cancelled,
        reconciliationPending:
            pharmacyOrderStatusCounts.value.reconciliation_pending ?? 0,
        reconciliationCompleted:
            pharmacyOrderStatusCounts.value.reconciliation_completed ?? 0,
        reconciliationException:
            pharmacyOrderStatusCounts.value.reconciliation_exception ?? 0,
        total: pharmacyOrderStatusCounts.value.total,
    };
});

const statusSelectValue = computed({
    get: () => searchForm.status || 'all',
    set: (v: string) => {
        searchForm.status = v === 'all' ? '' : v;
        searchForm.page = 1;
        void Promise.all([loadOrders(), loadOrderStatusCounts()]);
    },
});

const hasActiveFilters = computed(() =>
    Boolean(
            searchForm.q.trim() ||
            (
                searchForm.patientId.trim() &&
                !isPatientChartQueueFocusApplied.value
            ) ||
            searchForm.status ||
            searchForm.to ||
            searchForm.from !== today ||
            searchForm.sortBy !== 'orderedAt' ||
            searchForm.sortDir !== 'desc',
    ),
);

const hasAdvancedFilters = computed(() =>
    Boolean(searchForm.to || searchForm.from !== today),
);

function matchesPharmacyPreset(options: { status?: string }): boolean {
    if (searchForm.q.trim()) return false;
    if (searchForm.patientId.trim() && !isPatientChartQueueFocusApplied.value) return false;
    if (searchForm.to) return false;
    if (searchForm.from !== today) return false;
    return (options.status ?? '') === searchForm.status;
}

const pharmacyQueuePresetState = computed(() => ({
    pending: matchesPharmacyPreset({ status: 'pending' }),
    inPreparation: matchesPharmacyPreset({ status: 'in_preparation' }),
    partialDispense: matchesPharmacyPreset({ status: 'partially_dispensed' }),
}));

const activePharmacyQueuePresetLabel = computed(() => {
    if (pharmacyQueuePresetState.value.pending) return 'Pending';
    if (pharmacyQueuePresetState.value.inPreparation) return 'In Preparation';
    if (pharmacyQueuePresetState.value.partialDispense) return 'Partial Dispense';
    return null;
});

const activePharmacyStatusBadgeLabel = computed(() => {
    if (!searchForm.status) return null;
    if (
        (searchForm.status === 'pending' &&
            pharmacyQueuePresetState.value.pending) ||
        (searchForm.status === 'in_preparation' &&
            pharmacyQueuePresetState.value.inPreparation) ||
        (searchForm.status === 'partially_dispensed' &&
            pharmacyQueuePresetState.value.partialDispense)
    ) {
        return null;
    }

    return `Status: ${formatEnumLabel(searchForm.status)}`;
});

const activePharmacyOrderDateFilterBadgeLabel = computed(() => {
    if (!searchForm.to && searchForm.from === today) return null;
    if (activePharmacyQueuePresetLabel.value) return null;

    const from = searchForm.from.trim();
    const to = searchForm.to.trim();

    if (from && to && from === to) {
        return `Order Date: ${from}`;
    }

    return 'Order Date Active';
});

const pharmacyListBadgeLabel = computed(() => {
    return (
        activePharmacyQueuePresetLabel.value ||
        activePharmacyStatusBadgeLabel.value ||
        activePharmacyOrderDateFilterBadgeLabel.value ||
        (isPatientChartQueueFocusApplied.value
            ? 'Patient worklist'
            : activePatientSummary.value
              ? 'Patient Filter'
              : null) ||
        'Queue Today'
    );
});

const pharmacyToolbarStateLabel = computed(() => {
    const parts: string[] = [];

    if (hasActiveFilters.value || hasAdvancedFilters.value) {
        parts.push('Filtered');
    }

    if (compactQueueRows.value) {
        parts.push('Compact');
    }

    return parts.length > 0 ? parts.join(' | ') : null;
});

const emptyStateFilterChips = computed(() => {
    const chips: string[] = [];
    if (searchForm.q.trim()) chips.push(`Search: "${searchForm.q.trim()}"`);
    if (searchForm.status) chips.push(`Status: ${formatEnumLabel(searchForm.status)}`);
    if (searchForm.patientId.trim() && !isPatientChartQueueFocusApplied.value) {
        const summary = patientDirectory.value[searchForm.patientId];
        chips.push(`Patient: ${summary ? patientName(summary) : searchForm.patientId}`);
    }
    if (searchForm.from && searchForm.from !== today) chips.push(`From: ${searchForm.from}`);
    if (searchForm.to) chips.push(`To: ${searchForm.to}`);
    if (isPatientChartQueueFocusApplied.value) chips.push('Patient worklist');
    return chips;
});

function applyPharmacyQueuePreset(status = '') {
    clearSearchDebounce();
    searchForm.q = '';
    searchForm.patientId = patientChartQueueFocusLocked.value
        ? patientChartQueueRouteContext.patientId
        : '';
    searchForm.status = status;
    searchForm.from = today;
    searchForm.to = '';
    searchForm.sortBy = 'orderedAt';
    searchForm.sortDir = 'desc';
    searchForm.page = 1;
    syncAdvancedFiltersDraftFromSearch();
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function applyPharmacySummaryFilter(status: SearchForm['status']) {
    clearSearchDebounce();
    searchForm.status = status;
    searchForm.page = 1;
    void Promise.all([loadOrders(), loadOrderStatusCounts()]);
}

function isPharmacySummaryFilterActive(status: string): boolean {
    return (searchForm.status || '') === status;
}

const canPrev = computed(() => (pagination.value?.currentPage ?? 1) > 1);
const canNext = computed(() => {
    if (!pagination.value) return false;
    return pagination.value.currentPage < pagination.value.lastPage;
});

const activePatientSummary = computed<PatientSummary | null>(() => {
    const id = searchForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const createPatientSummary = computed<PatientSummary | null>(() => {
    const id = createForm.patientId.trim();
    if (!id) return null;
    return patientDirectory.value[id] ?? null;
});

const hasCreateAppointmentContext = computed(
    () => createForm.appointmentId.trim() !== '',
);

const hasCreateAdmissionContext = computed(
    () => createForm.admissionId.trim() !== '',
);

const showClinicalHandoffBanner = computed(
    () =>
        createPatientContextLocked.value ||
        createAppointmentLinkSource.value === 'route' ||
        createAdmissionLinkSource.value === 'route',
);

const hasCreateLinkedContext = computed(
    () => hasCreateAppointmentContext.value || hasCreateAdmissionContext.value,
);

const createOrderContextModeLabel = computed(() => {
    if (showClinicalHandoffBanner.value) return 'Clinical handoff';
    if (hasCreateLinkedContext.value) return 'Linked context';
    return 'Manual order';
});

const createOrderContextModeVariant = computed<
    'default' | 'secondary' | 'outline'
>(() => {
    if (showClinicalHandoffBanner.value) return 'default';
    if (hasCreateLinkedContext.value) return 'secondary';
    return 'outline';
});

const createContextActionLabel = computed(() => {
    if (!createForm.patientId.trim()) return 'Set context';
    if (showClinicalHandoffBanner.value || hasCreateLinkedContext.value) {
        return 'Review context';
    }
    return 'Change context';
});

const createOrderContextSummary = computed(() => {
    if (!createForm.patientId.trim()) {
        return 'Set the patient and any visit context before choosing the medicine.';
    }

    const linkedContexts: string[] = [];
    if (hasCreateAppointmentContext.value) linkedContexts.push('appointment');
    if (hasCreateAdmissionContext.value) linkedContexts.push('admission');

    const linkedSummary =
        linkedContexts.length === 2
            ? 'appointment and admission'
            : linkedContexts[0] ?? null;

    if (showClinicalHandoffBanner.value) {
        return linkedSummary
            ? `Ordering for this patient with ${linkedSummary} context.`
            : 'Ordering for this patient from the current clinical handoff.';
    }

    return linkedSummary
        ? `This order stays linked to this patient and ${linkedSummary}.`
        : 'This order stays linked to this patient.';
});

const createPatientContextLabel = computed(() => {
    if (!createPatientSummary.value) {
        return createForm.patientId.trim()
            ? 'Selected patient'
            : 'Patient not selected';
    }

    return patientName(createPatientSummary.value);
});

const createPatientContextMeta = computed(() => {
    const summary = createPatientSummary.value;
    if (!summary) {
        return 'Search and confirm the patient before entering dispensing details.';
    }

    const patientNumber = summary.patientNumber?.trim();
    return patientNumber
        ? `Patient No. ${patientNumber}`
        : 'Patient record selected';
});

const createAppointmentContextLabel = computed(() => {
    const appointmentNumber =
        createAppointmentSummary.value?.appointmentNumber?.trim();
    if (appointmentNumber) return appointmentNumber;
    if (hasCreateAppointmentContext.value) return 'Linked appointment';
    return 'No linked appointment';
});

const createAppointmentContextMeta = computed(() => {
    if (createAppointmentSummaryLoading.value) {
        return 'Loading appointment context...';
    }
    if (createAppointmentSummaryError.value) {
        return createAppointmentSummaryError.value;
    }

    if (!createAppointmentSummary.value) {
        return hasCreateAppointmentContext.value
            ? 'Appointment summary will appear once the link is resolved.'
            : createForm.patientId.trim()
              ? 'Link the checked-in appointment when this medication order comes directly from a consultation.'
              : 'Select a patient first, then optionally link the appointment.';
    }

    const parts = [
        createAppointmentSummary.value.scheduledAt
            ? formatDateTime(createAppointmentSummary.value.scheduledAt)
            : null,
        createAppointmentSummary.value.department?.trim() || null,
    ].filter(Boolean);

    if (createAppointmentLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAppointmentLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Linked appointment ready';
});

const createAppointmentContextReason = computed(() => {
    const value = createAppointmentSummary.value?.reason?.trim();
    return value ? `Reason: ${value}` : null;
});

const createAppointmentContextStatusLabel = computed(() => {
    if (createAppointmentSummaryLoading.value) return 'Loading';
    const status = createAppointmentSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAppointmentContext.value ? 'Linked' : null;
    }

    if (status.toLowerCase() === 'checked_in') return 'Checked In';
    return formatEnumLabel(status);
});

const createAppointmentContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const normalizedStatus =
        createAppointmentSummary.value?.status?.trim().toLowerCase() ?? '';

    if (normalizedStatus === 'checked_in') return 'default';
    if (normalizedStatus === 'scheduled') return 'secondary';
    if (normalizedStatus === 'cancelled' || normalizedStatus === 'no_show') {
        return 'destructive';
    }

    return 'outline';
});

const createAdmissionContextLabel = computed(() => {
    const admissionNumber = createAdmissionSummary.value?.admissionNumber?.trim();
    if (admissionNumber) return admissionNumber;
    if (hasCreateAdmissionContext.value) return 'Linked admission';
    return 'No linked admission';
});

const createAdmissionContextMeta = computed(() => {
    if (createAdmissionSummaryLoading.value) {
        return 'Loading admission context...';
    }
    if (createAdmissionSummaryError.value) {
        return createAdmissionSummaryError.value;
    }

    if (!createAdmissionSummary.value) {
        return hasCreateAdmissionContext.value
            ? 'Admission summary will appear once the link is resolved.'
            : createForm.patientId.trim()
              ? 'Link an active admission when the medication order belongs to an inpatient stay.'
              : 'Select a patient first, then optionally link the admission.';
    }

    const parts = [
        createAdmissionSummary.value.admittedAt
            ? formatDateTime(createAdmissionSummary.value.admittedAt)
            : null,
        createAdmissionSummary.value.ward?.trim() || null,
        createAdmissionSummary.value.bed?.trim() || null,
    ].filter(Boolean);

    if (createAdmissionLinkSource.value === 'auto') {
        parts.push('Auto-linked from active patient context');
    } else if (createAdmissionLinkSource.value === 'route') {
        parts.push('Linked from clinical handoff');
    }

    return parts.length > 0 ? parts.join(' | ') : 'Linked admission ready';
});

const createAdmissionContextReason = computed(() => {
    const value = createAdmissionSummary.value?.statusReason?.trim();
    return value ? `Status note: ${value}` : null;
});

const createAdmissionContextStatusLabel = computed(() => {
    if (createAdmissionSummaryLoading.value) return 'Loading';
    const status = createAdmissionSummary.value?.status?.trim();
    if (!status) {
        return hasCreateAdmissionContext.value ? 'Linked' : null;
    }

    if (status.toLowerCase() === 'admitted') return 'Admitted';
    return formatEnumLabel(status);
});

const createAdmissionContextStatusVariant = computed<
    'default' | 'secondary' | 'outline' | 'destructive'
>(() => {
    const normalizedStatus =
        createAdmissionSummary.value?.status?.trim().toLowerCase() ?? '';

    if (normalizedStatus === 'admitted') return 'default';
    if (normalizedStatus === 'discharged') return 'secondary';
    if (normalizedStatus === 'cancelled') return 'destructive';

    return 'outline';
});

const createAppointmentContextSourceLabel = computed(() => {
    if (!hasCreateAppointmentContext.value) return null;
    if (createAppointmentLinkSource.value === 'auto') return 'Auto-linked';
    if (createAppointmentLinkSource.value === 'route') return 'Route context';
    if (createAppointmentLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createAdmissionContextSourceLabel = computed(() => {
    if (!hasCreateAdmissionContext.value) return null;
    if (createAdmissionLinkSource.value === 'auto') return 'Auto-linked';
    if (createAdmissionLinkSource.value === 'route') return 'Route context';
    if (createAdmissionLinkSource.value === 'manual') return 'Chosen';
    return null;
});

const createContextEditorDescription = computed(() => {
    switch (createContextEditorTab.value) {
        case 'appointment':
            return createForm.patientId.trim()
                ? 'Review the checked-in appointment or search manually for a different outpatient handoff.'
                : 'Select a patient first, then optionally link the checked-in appointment.';
        case 'admission':
            return createForm.patientId.trim()
                ? 'Review the active admission or search manually for a different inpatient stay.'
                : 'Select a patient first, then optionally link the admission.';
        default:
            return createPatientContextLocked.value
                ? 'Patient is locked from the selected clinical handoff until you choose a different patient.'
                : 'Search and confirm the patient before entering medication details.';
    }
});

const createApprovedMedicineCatalogOptions = computed<SearchableSelectOption[]>(() => {
    return approvedMedicinesCatalogItems.value.map((item) => {
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : null;
        const unitLabel = item.unit?.trim() ? formatEnumLabel(item.unit) : null;
        const strengthLabel = approvedMedicineStrength(item);
        const dosageFormLabel = approvedMedicineDosageForm(item);
        const descriptionParts = [
            item.code?.trim() || null,
            strengthLabel,
            dosageFormLabel,
            unitLabel,
        ].filter((part): part is string => Boolean(part));

        return {
            value: item.id,
            label: item.name?.trim() || item.code?.trim() || 'Unnamed medicine',
            description:
                descriptionParts.join(' | ') || item.description?.trim() || null,
            keywords: [
                item.name?.trim() || null,
                item.code?.trim() || null,
                item.category?.trim() || null,
                item.unit?.trim() || null,
                strengthLabel,
                dosageFormLabel,
            ].filter((keyword): keyword is string => Boolean(keyword)),
            group: categoryLabel,
        };
    });
});

const createApprovedMedicinesCategorySummary = computed(() => {
    const counts = new Map<string, number>();

    approvedMedicinesCatalogItems.value.forEach((item) => {
        const categoryLabel = item.category?.trim()
            ? formatEnumLabel(item.category)
            : 'Other';
        counts.set(categoryLabel, (counts.get(categoryLabel) ?? 0) + 1);
    });

    return [...counts.entries()]
        .sort((left, right) => {
            if (right[1] !== left[1]) return right[1] - left[1];
            return left[0].localeCompare(right[0]);
        })
        .map(([label, count]) => ({ label, count }));
});

const selectedCreateApprovedMedicineItem = computed<ClinicalCatalogItem | null>(
    () => {
        const selectedId = createForm.approvedMedicineCatalogItemId.trim();
        if (!selectedId) return null;

        return (
            approvedMedicinesCatalogItems.value.find((item) => item.id === selectedId) ??
            null
        );
    },
);

const selectedCreateApprovedMedicineGovernance = computed(() =>
    approvedMedicineGovernanceProfile(selectedCreateApprovedMedicineItem.value),
);

const createApprovedMedicinePickerError = computed(() => {
    return (
        createFieldError('approvedMedicineCatalogItemId') ||
        createFieldError('medicationCode') ||
        createFieldError('medicationName')
    );
});

const createApprovedMedicineCatalogHelperText = computed(() => {
    return 'Search by medicine name, code, strength, dosage form, or category. Select one active approved medicine from STG/NEMLIT and the code and display name sync automatically.';
});

const selectedCreateApprovedMedicineCategoryLabel = computed(() => {
    const category = selectedCreateApprovedMedicineItem.value?.category?.trim();
    return category ? formatEnumLabel(category) : null;
});

const selectedCreateApprovedMedicineUnitLabel = computed(() => {
    return approvedMedicineDisplayUnitLabel(
        selectedCreateApprovedMedicineItem.value,
    );
});

const selectedCreateApprovedMedicineStrength = computed(() =>
    approvedMedicineStrength(selectedCreateApprovedMedicineItem.value),
);

const selectedCreateApprovedMedicineDosageForm = computed(() =>
    approvedMedicineDosageForm(selectedCreateApprovedMedicineItem.value),
);

const selectedCreateApprovedMedicinePreferredAlternativesLabel = computed(() => {
    const alternatives =
        selectedCreateApprovedMedicineGovernance.value.preferredAlternatives;

    return alternatives.length > 0 ? alternatives.join(', ') : null;
});

const selectedCreateInventoryItem = computed<InventoryItem | null>(() =>
    createMedicationAvailabilityMatch(
        createForm.medicationCode,
        createForm.medicationName,
    ),
);

const selectedCreateInventoryLoading = computed(() =>
    createMedicationAvailabilityIsLoading(
        createForm.medicationCode,
        createForm.medicationName,
    ),
);

const selectedCreateInventoryError = computed(() =>
    createMedicationAvailabilityError(
        createForm.medicationCode,
        createForm.medicationName,
    ),
);

const createMedicationSelectionLabel = computed(() =>
    medicationSafetyContextLabel({
        medicationName: createForm.medicationName,
        medicationCode: createForm.medicationCode,
    }),
);

const createMedicationSafetyStatusVariant = computed(() =>
    pharmacySafetyReviewVariant(createMedicationSafetySummary.value?.severity),
);

const createMedicationSafetyStatusLabel = computed(() =>
    pharmacySafetyReviewLabel(createMedicationSafetySummary.value?.severity),
);

const createMedicationSafetyIssueCount = computed(() => {
    const summary = createMedicationSafetySummary.value;
    if (!summary) return 0;
    return summary.blockers.length + summary.warnings.length;
});

const createMedicationSafetyPrimaryAction = computed(() => {
    const summary = createMedicationSafetySummary.value;
    if (!summary) return null;
    return summary.suggestedActions[0] ?? null;
});

const createRequestedQuantityValue = computed<number | null>(() => {
    const parsed = Number(createForm.quantityPrescribed);

    if (!Number.isFinite(parsed) || parsed <= 0) {
        return null;
    }

    return parsed;
});

const createInventoryOrderingWarning = computed<{
    tone: 'info' | 'success' | 'warning' | 'destructive';
    title: string;
    description: string;
    workflowLabel: string;
    nextStep: string;
    submitLabel: string;
} | null>(() => {
    if (!selectedCreateApprovedMedicineItem.value) {
        return null;
    }

    if (selectedCreateInventoryLoading.value || selectedCreateInventoryError.value) {
        return null;
    }

    if (!selectedCreateInventoryItem.value) {
        return {
            tone: 'warning',
            title: 'Pharmacy review is needed before release',
            description:
                'No active inventory item matched the selected medicine in this facility scope.',
            workflowLabel: 'Inventory mapping needed',
            nextStep:
                'You can still send the order, but pharmacy will need to map the medicine before preparation and dispense.',
            submitLabel: 'Send for Pharmacy Review',
        };
    }

    const inventoryItem = selectedCreateInventoryItem.value;
    const stockState = (inventoryItem.stockState ?? '').trim().toLowerCase();
    const requestedQuantity = createRequestedQuantityValue.value;
    const onHand = Number(inventoryItem.currentStock ?? 0);

    if (stockState === 'out_of_stock') {
        return {
            tone: 'destructive',
            title: 'Known stock issue before order',
            description:
                'Inventory shows no on-hand stock for this medicine.',
            workflowLabel: 'Known stock issue',
            nextStep:
                'If this medicine is still clinically necessary, send the order for pharmacist review so substitution or procurement can be decided.',
            submitLabel: 'Send for Pharmacy Review',
        };
    }

    if (
        requestedQuantity !== null &&
        Number.isFinite(onHand) &&
        requestedQuantity > onHand
    ) {
        return {
            tone: 'warning',
            title: 'Requested quantity exceeds stock on hand',
            description: `Requested ${quantityText(requestedQuantity)} but inventory shows ${inventoryStockQuantityLabel(inventoryItem)} on hand.`,
            workflowLabel: 'Partial stock only',
            nextStep:
                'Pharmacy may need partial dispense, substitution, or staged release for this quantity.',
            submitLabel: 'Send for Pharmacy Review',
        };
    }

    if (stockState === 'low_stock') {
        return {
            tone: 'warning',
            title: 'Low stock before order',
            description:
                'Inventory is at or below reorder level for this medicine.',
            workflowLabel: 'Limited stock available',
            nextStep:
                'Use the current medicine only if it remains clinically appropriate. Pharmacy may still need to review the release plan.',
            submitLabel: 'Send for Pharmacy Review',
        };
    }

    return {
        tone: 'success',
        title: 'Ready for routine pharmacy processing',
        description: 'Current inventory is available for the selected medicine.',
        workflowLabel: 'Stock checked',
        nextStep:
            'You can place the order and pharmacy can continue the normal preparation path.',
        submitLabel: 'Place Pharmacy Order',
    };
});

const approvedMedicinesCatalogAccessBlocked = computed(
    () => approvedMedicinesCatalogAccessDenied.value,
);

const createOrderActionDisabled = computed(() => {
    return (
        createLoading.value ||
        (
            hasCreateLifecycleMode.value &&
            (
                createLifecycleSourceLoading.value ||
                createLifecycleSourceOrder.value === null
            )
        ) ||
        !canCreatePharmacyOrders.value ||
        approvedMedicinesCatalogLoading.value ||
        approvedMedicinesCatalogAccessBlocked.value ||
        selectedCreateApprovedMedicineItem.value === null
    );
});

const hasCreateOrderBasketItems = computed(
    () => createOrderBasket.value.length > 0,
);
const hasSavedCreateDraft = computed(
    () => createServerDraftId.value.trim() !== '',
);
const showSaveCreateDraftAction = computed(
    () => !hasCreateOrderBasketItems.value && (
        hasSavedCreateDraft.value || hasPendingCreateWorkflow.value
    ),
);

const hasPendingCurrentCreateOrderDraft = computed(() => {
    return (
        hasSavedCreateDraft.value ||
        createForm.approvedMedicineCatalogItemId.trim() !== '' ||
        createForm.medicationCode.trim() !== '' ||
        createForm.medicationName.trim() !== '' ||
        createForm.dosageInstruction.trim() !== '' ||
        createForm.clinicalIndication.trim() !== '' ||
        createForm.dispensingNotes.trim() !== '' ||
        normalizeCreateQuantityInput(createForm.quantityPrescribed) !== '1'
    );
});

const submitCreateOrderBasketDisabled = computed(() => {
    return (
        createLoading.value ||
        !canUseCreateOrderBasket.value ||
        !canCreatePharmacyOrders.value ||
        createOrderBasket.value.length === 0 ||
        hasPendingCurrentCreateOrderDraft.value
    );
});
const useSingleCreateOrderAction = computed(
    () => hasCreateLifecycleMode.value || !hasCreateOrderBasketItems.value,
);

const createOrderBasketCountLabel = computed(() => {
    const count = createOrderBasket.value.length;
    return `${count} ${count === 1 ? 'medicine' : 'medicines'}`;
});

const createOrderPrimaryActionLabel = computed(() => {
    if (createLoading.value) {
        return hasSavedCreateDraft.value
            ? 'Signing...'
            : 'Preparing signature...';
    }

    if (hasCreateOrderBasketItems.value) {
        return `Submit basket to Pharmacy (${createOrderBasketCountLabel.value})`;
    }

    if (createLifecycleMode.value === 'reorder') {
        return 'Sign and send replacement order';
    }

    if (createLifecycleMode.value === 'add_on') {
        return 'Sign and send linked follow-up order';
    }

    const baseLabel =
        createInventoryOrderingWarning.value?.submitLabel ??
        'Send to Pharmacy';
    const normalizedLabel =
        baseLabel.charAt(0).toLowerCase() + baseLabel.slice(1);
    return `Sign and ${normalizedLabel}`;
});

const saveCreateDraftLabel = computed(() =>
    createLoading.value
        ? 'Saving draft...'
        : hasSavedCreateDraft.value
          ? 'Update saved draft'
          : 'Save draft',
);

watch(
    () => searchForm.q,
    (value, previousValue) => {
        const currentQuery = value.trim();
        const previousQuery = (previousValue ?? '').trim();
        if (currentQuery === previousQuery) return;

        clearSearchDebounce();
        searchDebounceTimer = window.setTimeout(() => {
            searchForm.page = 1;
            void Promise.all([loadOrders(), loadOrderStatusCounts()]);
            searchDebounceTimer = null;
        }, 350);
    },
);

watch(
    () => createForm.approvedMedicineCatalogItemId,
    () => {
        syncCreateApprovedMedicineSelection();
    },
    { immediate: true },
);

watch(
    [() => createForm.medicationCode, () => createForm.medicationName],
    ([code, name], [previousCode, previousName]) => {
        if (
            (code ?? '').trim() === (previousCode ?? '').trim() &&
            (name ?? '').trim() === (previousName ?? '').trim()
        ) {
            return;
        }

        void ensureCreateMedicationAvailabilityMatch(code, name, { force: true });
    },
    { immediate: true },
);

watch(
    [
        () => createForm.patientId,
        () => createForm.appointmentId,
        () => createForm.admissionId,
        () => createForm.approvedMedicineCatalogItemId,
        () => createForm.medicationCode,
        () => createForm.medicationName,
        () => createServerDraftId.value,
    ],
    () => {
        void loadCreateMedicationSafetySummary();
    },
    { immediate: true },
);

watch(
    () => policyDialogForm.substitutedMedicationCatalogItemId,
    () => {
        syncPolicyDialogSubstitutionSelection();
    },
);

watch(
    () => policyDialogForm.substitutionSelectionMode,
    (mode) => {
        if (mode === 'approved') {
            const matchedItem = findApprovedMedicineCatalogItem(
                policyDialogForm.substitutedMedicationCode,
                policyDialogForm.substitutedMedicationName,
            );

            policyDialogForm.substitutedMedicationCatalogItemId =
                matchedItem?.id ?? '';
            syncPolicyDialogSubstitutionSelection();
        }
    },
);

watch(
    [
        () => policyDialogForm.substitutionMade,
        () => policyDialogForm.substitutedMedicationCode,
        () => policyDialogForm.substitutedMedicationName,
    ],
    ([substitutionMade, code, name], [previousSubstitutionMade, previousCode, previousName]) => {
        if (
            substitutionMade === previousSubstitutionMade &&
            (code ?? '').trim() === (previousCode ?? '').trim() &&
            (name ?? '').trim() === (previousName ?? '').trim()
        ) {
            return;
        }

        if (!substitutionMade) return;

        void ensureInventoryMedicationMatch(code, name, { force: true });
    },
    { immediate: true },
);

watch(
    [
        () => detailsSheetOrder.value?.medicationCode ?? '',
        () => detailsSheetOrder.value?.medicationName ?? '',
        () =>
            detailsSheetOrder.value
                ? orderDispenseTargetMedicationCode(detailsSheetOrder.value) ?? ''
                : '',
        () =>
            detailsSheetOrder.value
                ? orderDispenseTargetMedicationName(detailsSheetOrder.value) ?? ''
                : '',
    ],
    (
        [orderedCode, orderedName, dispenseCode, dispenseName],
        [previousOrderedCode, previousOrderedName, previousDispenseCode, previousDispenseName],
    ) => {
        if (
            orderedCode.trim() === (previousOrderedCode ?? '').trim() &&
            orderedName.trim() === (previousOrderedName ?? '').trim() &&
            dispenseCode.trim() === (previousDispenseCode ?? '').trim() &&
            dispenseName.trim() === (previousDispenseName ?? '').trim()
        ) {
            return;
        }

        void ensureInventoryMedicationMatch(orderedCode, orderedName, { force: true });
        void ensureInventoryMedicationMatch(dispenseCode, dispenseName, { force: true });
    },
    { immediate: true },
);

watch(
    [
        () => detailsSheetOrderedInventoryItem.value?.id ?? '',
        () => detailsSheetDispenseTargetInventoryItem.value?.id ?? '',
    ],
    ([orderedItemId, dispenseItemId], [previousOrderedItemId, previousDispenseItemId]) => {
        if (
            orderedItemId === (previousOrderedItemId ?? '') &&
            dispenseItemId === (previousDispenseItemId ?? '')
        ) {
            return;
        }

        const itemIds = [...new Set([orderedItemId, dispenseItemId].filter(Boolean))];
        itemIds.forEach((itemId) => {
            void ensureInventoryStockMovementHistory(itemId, { force: true });
        });
    },
    { immediate: true },
);

watch(
    [
        () =>
            statusDialogOrder.value
                ? orderDispenseTargetMedicationCode(statusDialogOrder.value) ?? ''
                : '',
        () =>
            statusDialogOrder.value
                ? orderDispenseTargetMedicationName(statusDialogOrder.value) ?? ''
                : '',
    ],
    ([code, name], [previousCode, previousName]) => {
        if (
            code.trim() === (previousCode ?? '').trim() &&
            name.trim() === (previousName ?? '').trim()
        ) {
            return;
        }

        void ensureInventoryMedicationMatch(code, name, { force: true });
    },
    { immediate: true },
);

watch(
    () => canReadInventoryProcurement.value,
    (canRead, previousValue) => {
        if (!canRead || canRead === previousValue) return;

        void ensureInventoryMedicationMatch(
            createForm.medicationCode,
            createForm.medicationName,
            { force: true },
        );
        void ensureInventoryMedicationMatch(
            policyDialogForm.substitutedMedicationCode,
            policyDialogForm.substitutedMedicationName,
            { force: true },
        );

        if (detailsSheetOrder.value) {
            void ensureInventoryMedicationMatch(
                detailsSheetOrder.value.medicationCode,
                detailsSheetOrder.value.medicationName,
                { force: true },
            );
            void ensureInventoryMedicationMatch(
                orderDispenseTargetMedicationCode(detailsSheetOrder.value),
                orderDispenseTargetMedicationName(detailsSheetOrder.value),
                { force: true },
            );
        }

        if (statusDialogOrder.value) {
            void ensureInventoryMedicationMatch(
                orderDispenseTargetMedicationCode(statusDialogOrder.value),
                orderDispenseTargetMedicationName(statusDialogOrder.value),
                { force: true },
            );
        }
    },
);

watch(
    () => createForm.patientId,
    (value, previousValue) => {
        const patientId = value.trim();
        const previousPatientId = (previousValue ?? '').trim();
        if (patientId === previousPatientId) return;

        createContextAutoLinkSuppressed.appointment = false;
        createContextAutoLinkSuppressed.admission = false;

        if (!patientId) {
            clearCreateAppointmentLink({
                suppressAuto: false,
                focusEditor: false,
            });
            clearCreateAdmissionLink({
                suppressAuto: false,
                focusEditor: false,
            });
            resetCreateContextSuggestions();
            createContextEditorTab.value = 'patient';
            return;
        }

        if (previousPatientId && previousPatientId !== patientId) {
            clearCreateAppointmentLink({
                suppressAuto: false,
                focusEditor: false,
            });
            clearCreateAdmissionLink({
                suppressAuto: false,
                focusEditor: false,
            });
        }

        void hydratePatientSummary(patientId);
        void loadCreateContextSuggestions(patientId);
    },
    { immediate: true },
);

watch(
    () => createForm.appointmentId,
    (value, previousValue) => {
        const appointmentId = value.trim();
        if (appointmentId === (previousValue ?? '').trim()) return;

        if (pendingCreateAppointmentLinkSource !== null) {
            createAppointmentLinkSource.value =
                pendingCreateAppointmentLinkSource;
            pendingCreateAppointmentLinkSource = null;
        } else if (!appointmentId) {
            createAppointmentLinkSource.value = 'none';
        } else if (createAppointmentLinkSource.value !== 'route') {
            createAppointmentLinkSource.value = 'manual';
        }

        void loadCreateAppointmentSummary(appointmentId);
    },
    { immediate: true },
);

watch(
    () => createForm.admissionId,
    (value, previousValue) => {
        const admissionId = value.trim();
        if (admissionId === (previousValue ?? '').trim()) return;

        if (pendingCreateAdmissionLinkSource !== null) {
            createAdmissionLinkSource.value = pendingCreateAdmissionLinkSource;
            pendingCreateAdmissionLinkSource = null;
        } else if (!admissionId) {
            createAdmissionLinkSource.value = 'none';
        } else if (createAdmissionLinkSource.value !== 'route') {
            createAdmissionLinkSource.value = 'manual';
        }

        void loadCreateAdmissionSummary(admissionId);
    },
    { immediate: true },
);

watch(createContextDialogOpen, (isOpen) => {
    if (!isOpen) return;

    createContextDialogInitialSelection.patientId = createForm.patientId.trim();
    createContextDialogInitialSelection.appointmentId =
        createForm.appointmentId.trim();
    createContextDialogInitialSelection.admissionId =
        createForm.admissionId.trim();
});

const focusedQueueRowIndex = ref(-1);
const shortcutHintOpen = ref(false);

function isInputFocused(): boolean {
    const active = document.activeElement;
    if (!active) return false;
    const tag = active.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if ((active as HTMLElement).isContentEditable) return true;
    return false;
}

function isDialogOrSheetOpen(): boolean {
    return (
        detailsSheetOpen.value ||
        statusDialogOpen.value ||
        policyDialogOpen.value ||
        reconciliationDialogOpen.value ||
        lifecycleDialogOpen.value ||
        createMedicationSafetyReviewDialogOpen.value ||
        createContextDialogOpen.value ||
        createLeaveConfirmOpen.value ||
        advancedFiltersSheetOpen.value ||
        mobileFiltersDrawerOpen.value
    );
}

function moveFocusedQueueRow(delta: number): void {
    if (orders.value.length === 0) return;
    const next = focusedQueueRowIndex.value + delta;
    focusedQueueRowIndex.value = Math.max(0, Math.min(next, orders.value.length - 1));
    nextTick(() => {
        const row = document.querySelector(`[data-pharmacy-row-index="${focusedQueueRowIndex.value}"]`);
        if (row instanceof HTMLElement) {
            row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            row.focus({ preventScroll: true });
        }
    });
}

function handlePharmacyKeyboardShortcut(event: KeyboardEvent): void {
    const ctrl = event.ctrlKey || event.metaKey;
    const shift = event.shiftKey;
    const key = event.key;

    // Ctrl+Enter — submit current create form
    if (ctrl && key === 'Enter' && pharmacyWorkspaceView.value === 'new') {
        event.preventDefault();
        if (useSingleCreateOrderAction.value) {
            void createOrder();
        } else {
            void submitCreateOrderBasket();
        }
        return;
    }

    // Ctrl+Shift+N — new order
    if (ctrl && shift && (key === 'N' || key === 'n')) {
        event.preventDefault();
        if (canCreatePharmacyOrders.value) {
            setPharmacyWorkspaceView('new', { focusCreate: true });
        }
        return;
    }

    // Ctrl+Shift+R — refresh queue
    if (ctrl && shift && (key === 'R' || key === 'r')) {
        event.preventDefault();
        void refreshPage();
        return;
    }

    // ? — toggle shortcut hints
    if (key === '?' && !isInputFocused()) {
        event.preventDefault();
        shortcutHintOpen.value = !shortcutHintOpen.value;
        return;
    }

    // Escape — close overlays or go back to queue
    if (key === 'Escape') {
        if (isDialogOrSheetOpen()) return; // let the dialog/sheet handle its own Escape
        if (pharmacyWorkspaceView.value === 'new') {
            event.preventDefault();
            setPharmacyWorkspaceView('queue', { focusSearch: true });
            return;
        }
        if (focusedQueueRowIndex.value >= 0) {
            event.preventDefault();
            focusedQueueRowIndex.value = -1;
            focusPharmacyQueueSearch();
            return;
        }
        return;
    }

    // All shortcuts below are for when no input is focused
    if (isInputFocused()) return;

    // / — focus search
    if (key === '/') {
        event.preventDefault();
        if (pharmacyWorkspaceView.value !== 'queue') {
            setPharmacyWorkspaceView('queue');
        }
        focusPharmacyQueueSearch();
        return;
    }

    // j / ArrowDown — next queue row
    if ((key === 'j' || key === 'ArrowDown') && pharmacyWorkspaceView.value === 'queue') {
        event.preventDefault();
        moveFocusedQueueRow(1);
        return;
    }

    // k / ArrowUp — previous queue row
    if ((key === 'k' || key === 'ArrowUp') && pharmacyWorkspaceView.value === 'queue') {
        event.preventDefault();
        moveFocusedQueueRow(-1);
        return;
    }

    // Enter — open focused order details
    if (key === 'Enter' && pharmacyWorkspaceView.value === 'queue' && focusedQueueRowIndex.value >= 0) {
        event.preventDefault();
        const order = orders.value[focusedQueueRowIndex.value];
        if (order) {
            void openOrderDetailsSheet(order);
        }
        return;
    }

    // [ — previous page
    if (key === '[' && pharmacyWorkspaceView.value === 'queue' && canPrev.value) {
        event.preventDefault();
        prevPage();
        return;
    }

    // ] — next page
    if (key === ']' && pharmacyWorkspaceView.value === 'queue' && canNext.value) {
        event.preventDefault();
        nextPage();
        return;
    }
}

function startQueuePolling() {
    stopQueuePolling();
    queuePollingTimer = setInterval(() => {
        if (document.hidden) return;
        if (pharmacyWorkspaceView.value !== 'queue') return;
        if (listLoading.value || pageLoading.value) return;
        void Promise.all([loadOrders(), loadOrderStatusCounts()]);
    }, QUEUE_POLL_INTERVAL_MS);
}

function stopQueuePolling() {
    if (queuePollingTimer !== null) {
        clearInterval(queuePollingTimer);
        queuePollingTimer = null;
    }
}

onBeforeUnmount(() => {
    clearSearchDebounce();
    stopQueuePolling();
    if (flashedOrderTimer) clearTimeout(flashedOrderTimer);
    document.removeEventListener('keydown', handlePharmacyKeyboardShortcut);
});
onMounted(async () => {
    document.addEventListener('keydown', handlePharmacyKeyboardShortcut);
    await refreshPage();
    await applyFocusedOrderFromQuery();
    startQueuePolling();
});
</script>

<template>
    <Head title="Pharmacy Orders" />

    <AppLayout :breadcrumbs="breadcrumbs">
        <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto p-4 md:p-6">
            <!-- Page header -->
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                    <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
                        <AppIcon name="pill" class="size-7 text-primary" />
                        Pharmacy Orders
                    </h1>
                    <p class="mt-1 text-sm text-muted-foreground">
                        Create and track medication dispense orders from outpatient and consultation workflows.
                    </p>
                </div>
                <div class="flex flex-shrink-0 items-center gap-2">
                    <Popover>
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="h-8 px-2.5">
                                <Badge :variant="scopeWarning ? 'destructive' : 'secondary'">
                                    {{ scopeStatusLabel }}
                                </Badge>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-72 space-y-1 text-xs">
                            <p v-if="scope?.tenant">Tenant: {{ scope.tenant.name }} ({{ scope.tenant.code }})</p>
                            <p v-if="scope?.facility">Facility: {{ scope.facility.name }} ({{ scope.facility.code }})</p>
                            <p>Accessible facilities: {{ scope?.userAccess?.accessibleFacilityCount ?? 'N/A' }}</p>
                            <p v-if="!scope" class="text-destructive">Scope could not be loaded.</p>
                        </PopoverContent>
                    </Popover>
                    <Button variant="outline" size="sm" :disabled="listLoading" class="h-8 gap-1.5" @click="refreshPage">
                        <AppIcon name="activity" class="size-3.5" />
                        {{ listLoading ? 'Refreshing...' : 'Refresh' }}
                    </Button>
                    <Popover v-model:open="shortcutHintOpen">
                        <PopoverTrigger as-child>
                            <Button variant="outline" size="sm" class="h-8 w-8 p-0" title="Keyboard shortcuts (?)">
                                <Kbd>?</Kbd>
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent align="end" class="w-80 p-0">
                            <div class="border-b px-4 py-3">
                                <p class="text-sm font-medium">Keyboard shortcuts</p>
                                <p class="text-xs text-muted-foreground">Press <Kbd>?</Kbd> anywhere to toggle this panel</p>
                            </div>
                            <div class="divide-y text-xs">
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Focus search</span>
                                    <Kbd>/</Kbd>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">New order</span>
                                    <KbdGroup><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>N</Kbd></KbdGroup>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Submit form</span>
                                    <KbdGroup><Kbd>Ctrl</Kbd><Kbd>Enter</Kbd></KbdGroup>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Refresh queue</span>
                                    <KbdGroup><Kbd>Ctrl</Kbd><Kbd>Shift</Kbd><Kbd>R</Kbd></KbdGroup>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Navigate rows</span>
                                    <KbdGroup><Kbd>j</Kbd> <Kbd>k</Kbd></KbdGroup>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Open selected order</span>
                                    <Kbd>Enter</Kbd>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Previous / Next page</span>
                                    <KbdGroup><Kbd>[</Kbd> <Kbd>]</Kbd></KbdGroup>
                                </div>
                                <div class="flex items-center justify-between px-4 py-2">
                                    <span class="text-muted-foreground">Back to queue / Deselect</span>
                                    <Kbd>Esc</Kbd>
                                </div>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        v-if="
                            pharmacyWorkspaceView === 'new' ||
                            canCreatePharmacyOrders
                        "
                        :variant="
                            pharmacyWorkspaceView === 'new'
                                ? 'outline'
                                : 'default'
                        "
                        size="sm"
                        class="h-8 gap-1.5"
                        @click="
                            pharmacyWorkspaceView === 'new'
                                ? setPharmacyWorkspaceView('queue', {
                                      focusSearch: true,
                                  })
                                : setPharmacyWorkspaceView('new', {
                                      focusCreate: true,
                                  })
                        "
                    >
                        <AppIcon
                            :name="
                                pharmacyWorkspaceView === 'new'
                                    ? 'layout-list'
                                    : 'plus'
                            "
                            class="size-3.5"
                        />
                        {{
                            pharmacyWorkspaceView === 'new'
                                ? 'Pharmacy Queue'
                                : 'Create order'
                        }}
                    </Button>
                </div>
            </div>

            <Alert v-if="scopeWarning" variant="destructive">
                <AlertTitle>Scope warning</AlertTitle>
                <AlertDescription>{{ scopeWarning }}</AlertDescription>
            </Alert>
            <Alert v-if="listErrors.length" variant="destructive">
                <AlertTitle>Request error</AlertTitle>
                <AlertDescription>
                    <div class="space-y-1">
                        <p v-for="errorMessage in listErrors" :key="errorMessage" class="text-xs">{{ errorMessage }}</p>
                    </div>
                </AlertDescription>
            </Alert>
            <Alert v-if="canViewPharmacyOrderAuditLogs && lastPharmacyAuditExportRetryHandoff">
                <AlertTitle>Resume last handoff target</AlertTitle>
                <AlertDescription>
                    <div class="space-y-2">
                        <p class="text-xs">
                            Last pharmacy handoff: order {{ lastPharmacyAuditExportRetryHandoff.targetOrderId }}
                            | export job {{ lastPharmacyAuditExportRetryHandoff.jobId }} | saved
                            {{ formatDateTime(lastPharmacyAuditExportRetryHandoff.savedAt) }}
                        </p>
                        <p class="text-[11px] text-muted-foreground">
                            Resume telemetry: attempts {{ pharmacyAuditExportRetryResumeTelemetry.attempts }} |
                            success {{ pharmacyAuditExportRetryResumeTelemetry.successes }} |
                            failure {{ pharmacyAuditExportRetryResumeTelemetry.failures }}
                        </p>
                        <p v-if="pharmacyAuditExportRetryResumeTelemetry.lastFailureReason" class="text-[11px] text-muted-foreground">
                            Last failure: {{ pharmacyAuditExportRetryResumeTelemetry.lastFailureReason }}
                        </p>
                        <div class="flex flex-wrap gap-2">
                            <Button type="button" size="sm" :disabled="resumingPharmacyAuditExportRetryHandoff" @click="resumeLastPharmacyAuditExportRetryHandoff">
                                {{ resumingPharmacyAuditExportRetryHandoff ? 'Resuming...' : 'Resume Last Handoff' }}
                            </Button>
                            <Button type="button" size="sm" variant="ghost" @click="clearLastPharmacyAuditExportRetryHandoff">Clear</Button>
                            <Button type="button" size="sm" variant="ghost" @click="resetPharmacyAuditExportRetryResumeTelemetry">Reset Telemetry</Button>
                        </div>
                    </div>
                </AlertDescription>
            </Alert>
            <Alert v-if="canViewPharmacyOrderAuditLogs && auditExportRetryHandoffCompletedMessage">
                <AlertTitle>Retry handoff ready</AlertTitle>
                <AlertDescription>
                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs">{{ auditExportRetryHandoffCompletedMessage }}</p>
                        <Button type="button" size="sm" variant="ghost" @click="auditExportRetryHandoffCompletedMessage = null">Dismiss</Button>
                    </div>
                </AlertDescription>
            </Alert>

            <Alert v-if="!pageLoading && !canReadPharmacyOrders" variant="destructive">
                <AlertTitle>Queue read access restricted</AlertTitle>
                <AlertDescription>Request <code>pharmacy.orders.read</code> permission to view queue metrics and list results.</AlertDescription>
            </Alert>

            <WalkInServiceRequestsPanel
                ref="pharmacyWalkInPanelRef"
                service-type="pharmacy"
                :enabled="canUpdateServiceRequestStatus"
                panel-title="Walk-in patients awaiting pharmacy"
                @acknowledged="onPharmacyWalkInAcknowledged"
            />

            <div
                v-if="
                    canReadPharmacyOrders &&
                    pharmacyWorkspaceView === 'queue'
                "
                class="rounded-lg border bg-muted/30 px-3 py-2"
            >
                <div v-if="pageLoading" class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <Skeleton class="h-8 w-24 rounded-md" />
                        <Skeleton class="h-8 w-28 rounded-md" />
                        <Skeleton class="h-8 w-32 rounded-md" />
                        <Skeleton class="h-8 w-24 rounded-md" />
                        <Skeleton class="h-8 w-24 rounded-md" />
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <Skeleton class="h-8 w-28 rounded-md" />
                        <Skeleton class="h-8 w-24 rounded-md" />
                    </div>
                </div>
                <div v-else class="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
                    <div class="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isPharmacySummaryFilterActive('pending') ? 'border-primary bg-primary/10' : ''"
                            @click="applyPharmacySummaryFilter('pending')"
                        >
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.pending }}</span>
                            <span class="text-muted-foreground">Pending</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            v-if="canOperatePharmacyWorkflow"
                            :class="isPharmacySummaryFilterActive('in_preparation') ? 'border-primary bg-primary/10' : ''"
                            @click="applyPharmacySummaryFilter('in_preparation')"
                        >
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.inPreparation }}</span>
                            <span class="text-muted-foreground">In Preparation</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            v-if="canOperatePharmacyWorkflow"
                            :class="isPharmacySummaryFilterActive('partially_dispensed') ? 'border-primary bg-primary/10' : ''"
                            @click="applyPharmacySummaryFilter('partially_dispensed')"
                        >
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.partial }}</span>
                            <span class="text-muted-foreground">Partial Dispense</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isPharmacySummaryFilterActive('dispensed') ? 'border-primary bg-primary/10' : ''"
                            @click="applyPharmacySummaryFilter('dispensed')"
                        >
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.dispensed }}</span>
                            <span class="text-muted-foreground">Dispensed</span>
                        </button>
                        <button
                            type="button"
                            class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs transition-colors hover:bg-accent/50"
                            :class="isPharmacySummaryFilterActive('cancelled') ? 'border-primary bg-primary/10' : ''"
                            @click="applyPharmacySummaryFilter('cancelled')"
                        >
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.cancelled }}</span>
                            <span class="text-muted-foreground">Cancelled</span>
                        </button>
                        <span v-if="canOperatePharmacyWorkflow" class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs">
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.reconciliationPending }}</span>
                            <span class="text-muted-foreground">Recon Pending</span>
                        </span>
                        <span v-if="canOperatePharmacyWorkflow" class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs">
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.reconciliationCompleted }}</span>
                            <span class="text-muted-foreground">Recon Done</span>
                        </span>
                        <span v-if="canOperatePharmacyWorkflow" class="flex h-8 items-center gap-1 rounded-md border bg-background px-2.5 text-xs">
                            <span class="font-medium text-foreground">{{ summaryQueueCounts.reconciliationException }}</span>
                            <span class="text-muted-foreground">Recon Exception</span>
                        </span>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="matchesPharmacyPreset({}) ? 'default' : 'outline'"
                            @click="applyPharmacyQueuePreset()"
                        >
                            <AppIcon name="layout-list" class="size-3.5" />
                            Queue Today
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            :variant="pharmacyQueuePresetState.pending ? 'default' : 'outline'"
                            @click="applyPharmacyQueuePreset('pending')"
                        >
                            <AppIcon name="calendar-clock" class="size-3.5" />
                            Pending
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            v-if="canOperatePharmacyWorkflow"
                            :variant="pharmacyQueuePresetState.inPreparation ? 'default' : 'outline'"
                            @click="applyPharmacyQueuePreset('in_preparation')"
                        >
                            <AppIcon name="activity" class="size-3.5" />
                            In Preparation
                        </Button>
                        <Button
                            size="sm"
                            class="h-8 gap-1.5"
                            v-if="canOperatePharmacyWorkflow"
                            :variant="pharmacyQueuePresetState.partialDispense ? 'default' : 'outline'"
                            @click="applyPharmacyQueuePreset('partially_dispensed')"
                        >
                            <AppIcon name="package" class="size-3.5" />
                            Partial Dispense
                        </Button>
                    </div>
                </div>
            </div>

            <!-- Main list card -->
            <Card
                v-if="
                    canReadPharmacyOrders &&
                    pharmacyWorkspaceView === 'queue'
                "
                ref="pharmacyQueueCardRef"
                class="rounded-lg border-sidebar-border/70 flex min-h-0 flex-1 flex-col"
            >
                <CardHeader class="shrink-0 gap-2 pb-2">
                    <div class="space-y-3">
                        <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div class="min-w-0 flex-1 space-y-1">
                                <CardTitle class="flex items-center gap-2">
                                    <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                                    Pharmacy Orders Queue
                                </CardTitle>
                                <CardDescription>
                                    {{ orders.length }} orders on this page &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </CardDescription>
                                <div class="flex flex-wrap items-center gap-2">
                                    <Badge variant="secondary">{{ pharmacyListBadgeLabel }}</Badge>
                                    <Badge v-if="isPatientChartQueueFocusApplied" variant="outline">
                                        Patient chart handoff
                                    </Badge>
                                    <Badge v-if="pharmacyToolbarStateLabel" variant="outline">
                                        {{ pharmacyToolbarStateLabel }}
                                    </Badge>
                                </div>
                                <p
                                    v-if="activePatientSummary"
                                    class="text-xs text-muted-foreground"
                                >
                                    Patient in focus:
                                    {{ patientName(activePatientSummary) }} |
                                    No.
                                    {{
                                        activePatientSummary.patientNumber ||
                                        shortId(activePatientSummary.id)
                                    }}
                                </p>
                            </div>
                            <div
                                v-if="patientChartQueueReturnHref || patientChartQueueRouteContext.patientId"
                                class="flex shrink-0 flex-wrap items-center gap-2 lg:justify-end"
                            >
                                <Button
                                    v-if="patientChartQueueReturnHref"
                                    variant="outline"
                                    size="sm"
                                    as-child
                                >
                                    <Link :href="patientChartQueueReturnHref">
                                        Back to Patient Chart
                                    </Link>
                                </Button>
                                <Button
                                    v-if="isPatientChartQueueFocusApplied"
                                    variant="outline"
                                    size="sm"
                                    @click="openFullPharmacyQueue"
                                >
                                    Open Full Queue
                                </Button>
                                <Button
                                    v-else-if="openedFromPatientChart && patientChartQueueRouteContext.patientId"
                                    variant="outline"
                                    size="sm"
                                    @click="refocusPatientChartQueue"
                                >
                                    Refocus This Patient
                                </Button>
                            </div>
                        </div>
                        <div class="flex w-full flex-col gap-2">
                            <div class="flex w-full flex-col gap-2 xl:flex-row xl:items-center">
                                <div class="relative min-w-0 flex-1">
                                    <AppIcon
                                        name="search"
                                        class="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground"
                                    />
                                    <Input
                                        ref="pharmacyQueueSearchInput"
                                        id="pha-q"
                                        v-model="searchForm.q"
                                        placeholder="Search order number, medication code, or medication name"
                                        class="h-9 pl-9 pr-9"
                                        @keyup.enter="submitSearch"
                                    />
                                    <Kbd class="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2">/</Kbd>
                                </div>
                                <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:flex-nowrap">
                                    <Select v-model="statusSelectValue">
                                        <SelectTrigger
                                            class="h-9 w-full bg-background sm:w-44"
                                            aria-label="Filter pharmacy orders by status"
                                        >
                                            <SelectValue placeholder="All statuses" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All statuses</SelectItem>
                                            <SelectItem value="pending">Pending</SelectItem>
                                            <SelectItem value="in_preparation">In Preparation</SelectItem>
                                            <SelectItem value="partially_dispensed">Partially Dispensed</SelectItem>
                                            <SelectItem value="dispensed">Dispensed</SelectItem>
                                            <SelectItem value="cancelled">Cancelled</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="hidden h-9 gap-1.5 md:inline-flex"
                                        @click="advancedFiltersSheetOpen = true"
                                    >
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        All filters
                                        <Badge
                                            v-if="(!isPatientChartQueueFocusApplied && searchForm.patientId.trim()) || hasAdvancedFilters"
                                            variant="secondary"
                                            class="ml-1 text-[10px]"
                                        >
                                            Active
                                        </Badge>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        class="h-9 gap-1.5 md:hidden"
                                        @click="mobileFiltersDrawerOpen = true"
                                    >
                                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                                        All filters
                                    </Button>
                                    <Popover>
                                        <PopoverTrigger as-child>
                                            <Button variant="outline" size="sm" class="h-9 gap-1.5">
                                                <AppIcon name="layout-list" class="size-3.5" />
                                                View
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent align="end" class="w-72 space-y-4">
                                            <div class="grid gap-2">
                                                <Label for="pha-sort-view">Sort by</Label>
                                                <Select>
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent> {
                                                        const [field, dir] = (e.target as HTMLSelectElement).value.split(':');
                                                        searchForm.sortBy = field as SearchForm['sortBy'];
                                                        searchForm.sortDir = dir as SearchForm['sortDir'];
                                                        submitSearch();
                                                    }"
                                                >
                                                    <SelectItem value="orderedAt:desc">Newest first</SelectItem>
                                                    <SelectItem value="orderedAt:asc">Oldest first</SelectItem>
                                                    <SelectItem value="updatedAt:desc">Recently updated</SelectItem>
                                                    <SelectItem value="status:asc">Status A–Z</SelectItem>
                                                    <SelectItem value="orderNumber:asc">Order # ascending</SelectItem>
                                                    <SelectItem value="orderNumber:desc">Order # descending</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label for="pha-per-page-view">Results per page</Label>
                                                <Select :model-value="searchForm.perPage" @update:model-value="val => { searchForm.perPage = val; submitSearch }">
                                                    <SelectTrigger class="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                    <SelectItem value="10">10</SelectItem>
                                                    <SelectItem value="25">25</SelectItem>
                                                    <SelectItem value="50">50</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div class="grid gap-2">
                                                <Label>Row density</Label>
                                                <div class="grid grid-cols-2 gap-2">
                                                    <Button
                                                        size="sm"
                                                        :variant="compactQueueRows ? 'outline' : 'default'"
                                                        @click="compactQueueRows = false"
                                                    >
                                                        Comfortable
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        :variant="compactQueueRows ? 'default' : 'outline'"
                                                        @click="compactQueueRows = true"
                                                    >
                                                        Compact
                                                    </Button>
                                                </div>
                                            </div>
                                        </PopoverContent>
                                    </Popover>
                                    <Button
                                        v-if="hasActiveFilters"
                                        variant="ghost"
                                        size="sm"
                                        class="h-9 gap-1.5"
                                        :disabled="listLoading"
                                        @click="resetFilters"
                                    >
                                        Reset
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent class="px-0 pb-0">
                    <div v-if="canShowPharmacyWorkloadBoard" class="border-y bg-muted/20 px-4 py-4">
                        <div class="mb-3 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p class="text-sm font-medium">Dispensing workload board</p>
                                <p class="text-xs text-muted-foreground">
                                    Compact action rail for the current pharmacy queue scope.
                                </p>
                            </div>
                            <Badge variant="outline" class="w-fit">
                                Visible queue focus
                            </Badge>
                        </div>
                        <div class="grid gap-3 xl:grid-cols-4">
                            <div
                                v-for="card in pharmacyWorkloadCards"
                                :key="`pha-workload-${card.id}`"
                                class="rounded-lg border p-3"
                                :class="card.accentClass"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="text-sm font-medium text-foreground">
                                            {{ card.title }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ card.helper }}
                                        </p>
                                    </div>
                                    <Badge :variant="card.badgeVariant">
                                        {{ card.count }}
                                    </Badge>
                                </div>
                                <p class="mt-3 text-sm font-medium text-foreground">
                                    {{ card.nextOrderLabel }}
                                </p>
                                <p
                                    v-if="card.order"
                                    class="mt-1 text-xs text-muted-foreground"
                                >
                                    {{ orderPatientLabel(card.order) }}
                                    <span
                                        v-if="orderPatientNumber(card.order)"
                                        class="ml-1"
                                    >
                                        | {{ orderPatientNumber(card.order) }}
                                    </span>
                                </p>
                                <div
                                    v-if="card.focusLabel"
                                    class="mt-3 rounded-md border px-2.5 py-2"
                                    :class="card.accentClass"
                                >
                                    <p class="text-xs font-medium text-foreground">
                                        {{ card.focusLabel }}
                                    </p>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ card.focusDetail }}
                                    </p>
                                </div>
                                <Button
                                    size="sm"
                                    :variant="card.buttonVariant"
                                    class="mt-3 w-full"
                                    :disabled="card.count === 0"
                                    @click="handlePharmacyWorkloadCardAction(card.id)"
                                >
                                    {{ card.actionLabel }}
                                </Button>
                            </div>
                        </div>
                    </div>
                    <div class="min-h-[12rem]">
                        <div v-if="pageLoading || listLoading" class="space-y-2 px-4">
                                <Skeleton class="h-24 w-full" />
                                <Skeleton class="h-24 w-full" />
                                <Skeleton class="h-24 w-full" />
                            </div>
                            <div v-else-if="orders.length === 0" class="flex flex-col items-center justify-center rounded-lg border border-dashed p-10 text-center">
                                <div class="flex size-12 items-center justify-center rounded-full bg-muted">
                                    <AppIcon name="search" class="size-5 text-muted-foreground" />
                                </div>
                                <p class="mt-3 text-sm font-semibold">
                                    {{ hasActiveFilters || hasAdvancedFilters ? 'No matching orders' : 'Queue is empty' }}
                                </p>
                                <p class="mt-1 max-w-md text-xs text-muted-foreground">
                                    {{ hasActiveFilters || hasAdvancedFilters
                                        ? 'No pharmacy orders match the current filters. Broaden your criteria or reset to see all orders.'
                                        : 'There are no pharmacy orders for today. New orders will appear here once placed.'
                                    }}
                                </p>
                                <div v-if="emptyStateFilterChips.length" class="mt-3 flex flex-wrap items-center justify-center gap-1.5">
                                    <Badge
                                        v-for="chip in emptyStateFilterChips"
                                        :key="chip"
                                        variant="secondary"
                                        class="text-xs"
                                    >
                                        {{ chip }}
                                    </Badge>
                                </div>
                                <div class="mt-4 flex items-center gap-2">
                                    <Button
                                        v-if="hasActiveFilters || hasAdvancedFilters"
                                        size="sm"
                                        variant="outline"
                                        class="gap-1.5"
                                        @click="resetFilters"
                                    >
                                        <AppIcon name="x" class="size-3.5" />
                                        Reset Filters
                                    </Button>
                                    <Button
                                        v-if="canCreatePharmacyOrders"
                                        size="sm"
                                        :variant="hasActiveFilters || hasAdvancedFilters ? 'ghost' : 'outline'"
                                        class="gap-1.5"
                                        @click="
                                            setPharmacyWorkspaceView('new', {
                                                focusCreate: true,
                                            })
                                        "
                                    >
                                        <AppIcon name="plus" class="size-3.5" />
                                        Place Pharmacy Order
                                    </Button>
                                </div>
                            </div>
                            <div v-else :class="compactQueueRows ? 'space-y-2' : 'space-y-3'">
                                <div
                                    v-for="(order, orderIndex) in orders"
                                    :key="order.id"
                                    :data-pharmacy-row-index="orderIndex"
                                    :tabindex="orderIndex === focusedQueueRowIndex ? 0 : -1"
                                    class="rounded-lg border transition-colors outline-none"
                                    :class="[
                                        compactQueueRows ? 'p-2.5' : 'p-3',
                                        isPharmacyOrderEnteredInError(order)
                                            ? pharmacyRowEnteredInErrorClass(order)
                                            : pharmacyAccentClass(order.status),
                                        orderIndex === focusedQueueRowIndex ? 'ring-2 ring-primary/50 ring-offset-1' : '',
                                        flashedOrderId === order.id ? 'animate-pharmacy-row-flash' : '',
                                    ]"
                                >
                                    <div
                                        :class="
                                            compactQueueRows
                                                ? 'flex flex-col gap-2 md:flex-row md:items-start md:justify-between'
                                                : 'flex flex-col gap-3 md:flex-row md:items-start md:justify-between'
                                        "
                                    >
                                        <div :class="compactQueueRows ? 'space-y-1.5' : 'space-y-2'">
                                            <div class="flex flex-wrap items-center gap-2">
                                                <p
                                                    class="text-sm font-semibold"
                                                    :class="isPharmacyOrderEnteredInError(order) ? 'line-through text-muted-foreground' : ''"
                                                >
                                                    {{ order.orderNumber || 'Pharmacy Order' }}
                                                </p>
                                                <Badge
                                                    v-if="isPharmacyOrderEnteredInError(order)"
                                                    variant="destructive"
                                                    class="gap-1"
                                                >
                                                    <AppIcon name="circle-alert" class="size-3" />
                                                    Entered in Error
                                                </Badge>
                                                <Badge :variant="statusVariant(order.status)">
                                                    {{
                                                        formatEnumLabel(order.status)
                                                    }}
                                                </Badge>
                                                <Badge
                                                    v-if="orderReleaseStateLabel(order)"
                                                    :variant="orderReleaseStateVariant(order)"
                                                >
                                                    {{ orderReleaseStateLabel(order) }}
                                                </Badge>
                                                <Badge :variant="quantityBadgeVariant(order)">
                                                    {{ dispenseProgressLabel(order) }}
                                                </Badge>
                                                <Badge
                                                    v-if="hasSubstitutionInDispenseNotes(order)"
                                                    variant="secondary"
                                                >
                                                    Substitute
                                                </Badge>
                                                <Badge
                                                    v-if="orderQueueAttentionLabel(order)"
                                                    :variant="orderQueueAttentionVariant(order)"
                                                >
                                                    {{ orderQueueAttentionLabel(order) }}
                                                </Badge>
                                            </div>
                                            <details
                                                open
                                                class="rounded-md border border-dashed px-2 py-1.5 sm:border-0 sm:px-0 sm:py-0"
                                            >
                                                <summary
                                                    class="cursor-pointer text-xs font-medium text-muted-foreground sm:hidden"
                                                >
                                                    Patient & order details
                                                </summary>
                                                <div class="mt-2 grid gap-1 text-xs text-muted-foreground sm:mt-0 lg:grid-cols-2 lg:gap-x-6">
                                                    <p>
                                                        Patient: {{ orderPatientLabel(order) }}
                                                        <span
                                                            v-if="orderPatientNumber(order)"
                                                            class="ml-1"
                                                        >
                                                            ({{ orderPatientNumber(order) }})
                                                        </span>
                                                    </p>
                                                    <p>
                                                        Ordered: {{ formatDateTime(order.orderedAt) }}
                                                    </p>
                                                    <p>
                                                        Ordered medicine:
                                                        {{
                                                            orderRequestedMedicationDisplay(
                                                                order,
                                                            )
                                                        }}
                                                    </p>
                                                    <p v-if="order.clinicalIndication">
                                                        Indication: {{ order.clinicalIndication }}
                                                    </p>
                                                    <p
                                                        v-if="
                                                            orderSubstitutionHandoffText(
                                                                order,
                                                            )
                                                        "
                                                    >
                                                        Dispense now:
                                                        {{
                                                            orderDispenseTargetDisplay(
                                                                order,
                                                            )
                                                        }}
                                                    </p>
                                                    <p>
                                                        Dose:
                                                        {{ order.dosageInstruction || 'N/A' }}
                                                    </p>
                                                    <p>
                                                        Prescribed qty:
                                                        {{ quantityText(order.quantityPrescribed) }}
                                                    </p>
                                                    <p>
                                                        Appointment: {{ shortId(order.appointmentId) }}
                                                    </p>
                                                    <p>
                                                        Dispensed At:
                                                        {{ formatDateTime(order.dispensedAt) }}
                                                    </p>
                                                    <p>
                                                        Verified:
                                                        {{ formatDateTime(order.verifiedAt) }}
                                                    </p>
                                                </div>
                                            </details>
                                            <div
                                                v-if="orderQueueFocusTitle(order)"
                                                class="rounded-md border px-2.5 py-2"
                                                :class="orderQueueFocusSurfaceClass(order)"
                                            >
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <span
                                                        class="inline-flex size-2 rounded-full"
                                                        :class="variantDotClass(orderQueueFocusSurfaceVariant(order))"
                                                    />
                                                    <p class="text-xs font-medium text-foreground">
                                                        {{ orderQueueFocusTitle(order) }}
                                                    </p>
                                                </div>
                                                <p class="mt-1 text-xs text-muted-foreground">
                                                    {{ orderQueueFocusDetail(order) }}
                                                </p>
                                            </div>
                                            <p v-if="order.dispensingNotes" class="text-sm">
                                                {{ order.dispensingNotes }}
                                            </p>
                                            <p
                                                v-if="order.verificationNote"
                                                class="text-xs text-muted-foreground"
                                            >
                                                Verification note:
                                                {{ order.verificationNote }}
                                            </p>
                                            <p
                                                v-if="order.statusReason"
                                                class="text-xs text-muted-foreground"
                                            >
                                                Status note: {{ order.statusReason }}
                                            </p>
                                        </div>

                                        <div
                                            :class="
                                                compactQueueRows
                                                    ? 'flex flex-col items-stretch gap-1.5 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                                    : 'flex flex-col items-stretch gap-2 md:flex-row md:flex-wrap md:items-start md:max-w-[360px] md:justify-end'
                                            "
                                        >
                                            <template
                                                v-for="rowActionState in [pharmacyQueueRowActionState(order)]"
                                                :key="`pha-queue-row-actions-${order.id}`"
                                            >
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    class="w-full sm:w-auto"
                                                    @click="openOrderDetailsSheet(order)"
                                                >
                                                    {{ canUpdatePharmacyOrderStatus ? 'Open order' : 'Review' }}
                                                </Button>
                                                <Button
                                                    v-if="rowActionState.primary"
                                                    size="sm"
                                                    :variant="rowActionState.primary.buttonVariant"
                                                    class="w-full sm:w-auto"
                                                    :disabled="actionLoadingId === order.id"
                                                    @click="runPharmacyWorkflowAction(order, rowActionState.primary.id)"
                                                >
                                                    {{
                                                        actionLoadingId === order.id
                                                            ? 'Updating...'
                                                            : rowActionState.primary.label
                                                    }}
                                                </Button>
                                                <DropdownMenu
                                                    v-if="rowActionState.overflow.length > 0"
                                                >
                                                    <DropdownMenuTrigger :as-child="true">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            class="w-full sm:w-auto"
                                                            :disabled="actionLoadingId === order.id"
                                                        >
                                                            More
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end" class="w-52">
                                                        <DropdownMenuItem
                                                            v-for="action in rowActionState.overflow"
                                                            :key="`pha-row-overflow-${order.id}-${action.id}`"
                                                            :class="
                                                                action.destructive
                                                                    ? 'text-destructive focus:text-destructive'
                                                                    : ''
                                                            "
                                                            :disabled="actionLoadingId === order.id"
                                                            @select.prevent="
                                                                runPharmacyRowOverflowAction(
                                                                    order,
                                                                    action.id,
                                                                )
                                                            "
                                                        >
                                                            {{ action.label }}
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </template>
                                        </div>
                                </div>
                            </div>
                        </div>
                        <div class="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
                                <p class="text-xs text-muted-foreground">
                                    Showing {{ orders.length }} of {{ pagination?.total ?? 0 }} &middot; Page {{ pagination?.currentPage ?? 1 }} of {{ pagination?.lastPage ?? 1 }}
                                </p>
                                <div class="flex items-center gap-1">
                                    <Button variant="outline" size="sm" :disabled="!canPrev || listLoading" @click="prevPage">Previous</Button>
                                    <template v-for="pg in paginationPages" :key="typeof pg === 'number' ? `page-${pg}` : `ellipsis-${Math.random()}`">
                                        <span v-if="pg === '...'" class="px-1 text-xs text-muted-foreground">&hellip;</span>
                                        <Button
                                            v-else
                                            size="sm"
                                            :variant="pg === (pagination?.currentPage ?? 1) ? 'default' : 'outline'"
                                            class="h-8 w-8 p-0"
                                            :disabled="listLoading"
                                            @click="goToPage(pg)"
                                        >
                                            {{ pg }}
                                        </Button>
                                    </template>
                                    <Button variant="outline" size="sm" :disabled="!canNext || listLoading" @click="nextPage">Next</Button>
                                </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
            <Card
                v-else-if="!pageLoading && pharmacyWorkspaceView === 'queue'"
                class="rounded-lg border-sidebar-border/70"
            >
                <CardHeader>
                    <CardTitle class="flex items-center gap-2">
                        <AppIcon name="layout-list" class="size-5 text-muted-foreground" />
                        Pharmacy Orders Queue
                    </CardTitle>
                    <CardDescription>You do not have permission to view pharmacy queues.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Alert variant="destructive">
                        <AlertTitle>Read access restricted</AlertTitle>
                        <AlertDescription>Request <code>pharmacy.orders.read</code> permission to open pharmacy list and queue filters.</AlertDescription>
                    </Alert>
                </CardContent>
            </Card>

            <!-- Care workflow footer -->
            <div
                v-if="pharmacyWorkspaceView === 'queue' && showPharmacyCareWorkflowFooter"
                class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-2.5"
            >
                <span class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <AppIcon name="activity" class="size-3.5" />
                    Related workflows
                </span>
                <Button
                    v-if="canCreatePharmacyOrders"
                    size="sm"
                    variant="outline"
                    class="gap-1.5"
                    @click="
                        setPharmacyWorkspaceView('new', {
                            focusCreate: true,
                        })
                    "
                >
                    <AppIcon name="plus" class="size-3.5" />
                    Place Pharmacy Order
                </Button>
                <Button v-if="canReadMedicalRecords" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="consultationContextHref">
                        <AppIcon name="stethoscope" class="size-3.5" />
                        {{ consultationReturnLabel }}
                    </Link>
                </Button>
                <Button v-if="canReadLaboratoryOrders" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/laboratory-orders', { includeTabNew: true })">
                        <AppIcon name="flask-conical" class="size-3.5" />
                        New Lab Order
                    </Link>
                </Button>
                <Button v-if="canCreateTheatreProcedures" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/theatre-procedures', { includeTabNew: true })">
                        <AppIcon name="scissors" class="size-3.5" />
                        Schedule Procedure
                    </Link>
                </Button>
                <Button v-if="canReadBillingInvoices" size="sm" variant="outline" as-child class="gap-1.5">
                    <Link :href="contextCreateHref('/billing-invoices', { includeTabNew: true })">
                        <AppIcon name="receipt" class="size-3.5" />
                        New Billing Invoice
                    </Link>
                </Button>
            </div>

            <Card
                v-if="pharmacyWorkspaceView === 'new'"
                ref="pharmacyCreateCardRef"
                class="rounded-lg border-sidebar-border/70"
            >
                <CardHeader class="gap-3">
                    <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div class="min-w-0">
                            <CardTitle class="flex items-center gap-2">
                                <AppIcon name="plus" class="size-5 text-muted-foreground" />
                                Place Pharmacy Order
                            </CardTitle>
                            <CardDescription>
                                Use visit context when available, then send the medication request to Pharmacy for preparation and dispense.
                            </CardDescription>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                @click="
                                    setPharmacyWorkspaceView('queue', {
                                        focusSearch: true,
                                    })
                                "
                            >
                                Back to Queue
                            </Button>

                        </div>
                    </div>
                </CardHeader>
                <CardContent class="space-y-6">
                    <div class="space-y-3">
                        <Alert
                            v-if="hasCreateLifecycleMode && createLifecycleSourceError"
                            variant="destructive"
                            class="border-destructive/40 bg-destructive/5"
                        >
                            <AlertTitle>{{ createLifecycleAlertTitle }}</AlertTitle>
                            <AlertDescription class="space-y-3">
                                <p>{{ createLifecycleSourceError }}</p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    @click="clearCreateLifecycleMode"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                    {{ createLifecycleClearActionLabel }}
                                </Button>
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-else-if="hasCreateLifecycleMode"
                            class="border-primary/30 bg-primary/5"
                        >
                            <AlertTitle>{{
                                createLifecycleSourceLoading
                                    ? 'Loading lifecycle source'
                                    : createLifecycleAlertTitle
                            }}</AlertTitle>
                            <AlertDescription class="space-y-3">
                                <p>
                                    {{
                                        createLifecycleSourceLoading
                                            ? 'Loading the original pharmacy order so we can prefill this follow-up request safely.'
                                            : createLifecycleAlertDescription
                                    }}
                                </p>
                                <Button
                                    v-if="!createLifecycleSourceLoading"
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    class="gap-1.5"
                                    @click="clearCreateLifecycleMode"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                    {{ createLifecycleClearActionLabel }}
                                </Button>
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-if="!pageLoading && !canCreatePharmacyOrders"
                            variant="destructive"
                            class="border-destructive/40 bg-destructive/5"
                        >
                            <AlertTitle>Create access restricted</AlertTitle>
                            <AlertDescription>
                                Request <code>pharmacy.orders.create</code> permission to place a pharmacy order from this handoff.
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-if="createMessage"
                            class="border-primary/30 bg-primary/5"
                        >
                            <AlertTitle>Pharmacy draft updated</AlertTitle>
                            <AlertDescription>
                                {{ createMessage }}
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-if="hasCreateErrorFeedback && createErrorSummary"
                            variant="destructive"
                            class="border-destructive/40 bg-destructive/5"
                        >
                            <AlertTitle>Check this pharmacy draft</AlertTitle>
                            <AlertDescription>
                                {{ createErrorSummary }}
                            </AlertDescription>
                        </Alert>
                    </div>

                    <div class="rounded-lg border bg-muted/20 p-3">
                        <div class="space-y-3">
                            <div
                                class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between"
                            >
                                <div class="min-w-0 space-y-2">
                                    <div class="flex flex-wrap items-center gap-1.5">
                                        <Badge :variant="createOrderContextModeVariant">
                                            {{ createOrderContextModeLabel }}
                                        </Badge>
                                        <Badge
                                            v-if="createPatientContextLocked"
                                            variant="secondary"
                                            class="text-[10px]"
                                        >
                                            Locked patient
                                        </Badge>
                                        <Badge
                                            v-if="
                                                hasCreateAppointmentContext &&
                                                createAppointmentContextStatusLabel
                                            "
                                            :variant="createAppointmentContextStatusVariant"
                                            class="text-[10px]"
                                        >
                                            {{ createAppointmentContextStatusLabel }}
                                        </Badge>
                                        <Badge
                                            v-if="
                                                hasCreateAdmissionContext &&
                                                createAdmissionContextStatusLabel
                                            "
                                            :variant="createAdmissionContextStatusVariant"
                                            class="text-[10px]"
                                        >
                                            {{ createAdmissionContextStatusLabel }}
                                        </Badge>
                                    </div>
                                    <div class="flex min-w-0 flex-wrap items-center gap-2">
                                        <div class="flex min-w-0 items-center gap-2">
                                            <AppIcon
                                                name="user"
                                                class="size-3.5 shrink-0 text-muted-foreground"
                                            />
                                            <span
                                                class="truncate text-sm font-medium"
                                                :title="createPatientContextMeta"
                                            >
                                                {{ createPatientContextLabel }}
                                            </span>
                                        </div>
                                        <Badge
                                            v-if="createPatientSummary?.patientNumber"
                                            variant="outline"
                                            class="text-[10px]"
                                        >
                                            Patient No.
                                            {{ createPatientSummary?.patientNumber }}
                                        </Badge>
                                    </div>
                                    <p class="text-xs text-muted-foreground">
                                        {{ createOrderContextSummary }}
                                    </p>
                                </div>
                                <div class="flex flex-wrap gap-2 xl:justify-end">
                                    <Button
                                        v-if="openedFromPatientChart && createForm.patientId"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link :href="createPatientChartHref">
                                            Back to Patient Chart
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="
                                            canReadMedicalRecords &&
                                            createForm.patientId &&
                                            (
                                                createForm.appointmentId ||
                                                createForm.admissionId ||
                                                hasCreateMedicalRecordContext
                                            )
                                        "
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link :href="consultationContextHref">
                                            {{ consultationReturnLabel }}
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="canReadAppointments && createForm.appointmentId"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link
                                            :href="`/appointments?focusAppointmentId=${encodeURIComponent(createForm.appointmentId)}`"
                                        >
                                            Back to Appointments
                                        </Link>
                                    </Button>
                                    <Button
                                        v-if="canReadAdmissions && createForm.admissionId"
                                        variant="outline"
                                        size="sm"
                                        as-child
                                    >
                                        <Link :href="contextCreateHref('/admissions')">
                                            Back to Admissions
                                        </Link>
                                    </Button>
                                    <Button
                                        id="pha-open-context-dialog"
                                        variant="outline"
                                        size="sm"
                                        class="gap-1.5"
                                        :disabled="hasCreateOrderBasketItems"
                                        @click="
                                            openCreateContextDialog(
                                                createPatientContextLocked
                                                    ? 'patient'
                                                    : hasCreateAppointmentContext
                                                      ? 'appointment'
                                                      : hasCreateAdmissionContext
                                                        ? 'admission'
                                                        : 'patient',
                                                {
                                                    unlockPatient:
                                                        createPatientContextLocked,
                                                },
                                            )
                                        "
                                    >
                                        <AppIcon
                                            name="sliders-horizontal"
                                            class="size-3.5"
                                        />
                                        {{ createContextActionLabel }}
                                    </Button>
                                </div>
                            </div>
                            <div
                                v-if="
                                    hasCreateAppointmentContext ||
                                    hasCreateAdmissionContext
                                "
                                class="flex flex-wrap gap-2"
                            >
                                <div
                                    v-if="hasCreateAppointmentContext"
                                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                                    :title="
                                        [
                                            createAppointmentContextLabel,
                                            createAppointmentContextMeta,
                                            createAppointmentContextReason,
                                        ]
                                            .filter(Boolean)
                                            .join(' | ')
                                    "
                                >
                                    <AppIcon
                                        name="calendar-clock"
                                        class="size-3.5 text-muted-foreground"
                                    />
                                    <span class="font-medium">
                                        {{ createAppointmentContextLabel }}
                                    </span>
                                    <span
                                        v-if="createAppointmentContextSourceLabel"
                                        class="text-muted-foreground"
                                    >
                                        | {{ createAppointmentContextSourceLabel }}
                                    </span>
                                </div>
                                <div
                                    v-if="hasCreateAdmissionContext"
                                    class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2 py-1 text-xs"
                                    :title="
                                        [
                                            createAdmissionContextLabel,
                                            createAdmissionContextMeta,
                                            createAdmissionContextReason,
                                        ]
                                            .filter(Boolean)
                                            .join(' | ')
                                    "
                                >
                                    <AppIcon
                                        name="bed-double"
                                        class="size-3.5 text-muted-foreground"
                                    />
                                    <span class="font-medium">
                                        {{ createAdmissionContextLabel }}
                                    </span>
                                    <span
                                        v-if="createAdmissionContextSourceLabel"
                                        class="text-muted-foreground"
                                    >
                                        | {{ createAdmissionContextSourceLabel }}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="grid gap-4 xl:grid-cols-2 xl:items-stretch">
                        <div class="rounded-lg border bg-background p-4 xl:flex xl:h-full xl:flex-col">
                            <div class="space-y-4 xl:flex xl:h-full xl:flex-col">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">
                                        Requested medicine
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        Use the approved medicines list so Pharmacy works from the canonical Tanzania medication name and code every time.
                                    </p>
                                </div>

                                <SearchableSelectField
                                    input-id="pha-create-approved-medicine"
                                    v-model="
                                        createForm.approvedMedicineCatalogItemId
                                    "
                                    label="Approved medicine"
                                    :options="
                                        createApprovedMedicineCatalogOptions
                                    "
                                    placeholder="Select an approved medicine"
                                    search-placeholder="Search by medicine name, code, strength, dosage form, or category"
                                    :helper-text="
                                        createApprovedMedicineCatalogHelperText
                                    "
                                    :error-message="
                                        createApprovedMedicinePickerError
                                    "
                                    empty-text="No active approved medicine matched that search."
                                    :required="true"
                                    :disabled="
                                        approvedMedicinesCatalogLoading ||
                                        approvedMedicinesCatalogAccessBlocked
                                    "
                                />

                                <div
                                    v-if="
                                        approvedMedicinesCatalogLoading
                                    "
                                    class="rounded-lg border bg-muted/20 p-3"
                                >
                                    <div class="space-y-2">
                                        <Skeleton class="h-4 w-32" />
                                        <Skeleton class="h-9 w-full" />
                                        <Skeleton class="h-4 w-3/4" />
                                    </div>
                                </div>

                                <Alert
                                    v-else-if="
                                        approvedMedicinesCatalogError
                                    "
                                    variant="destructive"
                                    class="border-destructive/40 bg-destructive/5"
                                >
                                    <AppIcon
                                        name="alert-triangle"
                                        class="size-4"
                                    />
                                    <AlertTitle
                                        >Approved medicines lookup
                                        unavailable</AlertTitle
                                    >
                                    <AlertDescription
                                        class="space-y-3"
                                    >
                                        <p>
                                            {{
                                                approvedMedicinesCatalogError
                                            }}
                                        </p>
                                        <div
                                            class="flex flex-wrap items-center gap-2"
                                        >
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                @click="
                                                    void loadApprovedMedicinesCatalog(
                                                        true,
                                                    )
                                                "
                                            >
                                                Retry
                                            </Button>
                                            <Link
                                                href="/platform/admin/clinical-catalogs"
                                                class="text-xs font-medium text-foreground underline underline-offset-4"
                                            >
                                                Open Clinical Catalogs
                                            </Link>
                                        </div>
                                    </AlertDescription>
                                </Alert>

                                <div
                                    v-else-if="
                                        isApprovedMedicinesCatalogReadPermissionResolved &&
                                        approvedMedicinesCatalogAccessBlocked
                                    "
                                    class="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs text-foreground"
                                >
                                    <AppIcon
                                        name="shield-check"
                                        class="size-3.5 text-muted-foreground"
                                    />
                                    <span class="font-medium">Approved medicines picker unavailable</span>
                                    <span class="text-muted-foreground">
                                        This pharmacy account cannot open the approved medicines picker.
                                    </span>
                                </div>

                                <div
                                    v-else-if="
                                        isApprovedMedicinesCatalogReadPermissionResolved &&
                                        canReadApprovedMedicinesCatalog &&
                                        !approvedMedicinesCatalogItems.length
                                    "
                                    class="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-xs text-muted-foreground"
                                >
                                    <AppIcon
                                        name="pill"
                                        class="size-3.5 text-muted-foreground"
                                    />
                                    <span>No approved medicines are active yet.</span>
                                    <Link
                                        href="/platform/admin/clinical-catalogs"
                                        class="font-medium text-foreground underline underline-offset-4"
                                    >
                                        Open Clinical Catalogs
                                    </Link>
                                </div>

                                <div class="rounded-lg border bg-muted/20 p-3">
                                    <div class="flex flex-col gap-3">
                                        <div class="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                                            <div class="min-w-0 space-y-1">
                                                <div class="flex flex-wrap items-center gap-1.5">
                                                    <p
                                                        class="truncate text-sm font-medium text-foreground"
                                                        :title="
                                                            createForm.medicationName ||
                                                            'Select an approved medicine'
                                                        "
                                                    >
                                                        {{
                                                            createForm.medicationName ||
                                                            'Select an approved medicine'
                                                        }}
                                                    </p>
                                                    <Badge
                                                        v-if="createForm.medicationCode"
                                                        variant="outline"
                                                    >
                                                        Code {{ createForm.medicationCode }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="selectedCreateApprovedMedicineItem"
                                                        :variant="
                                                            selectedCreateApprovedMedicineGovernance.reviewMode ===
                                                            'policy_review_required'
                                                                ? 'secondary'
                                                                : 'default'
                                                        "
                                                    >
                                                        {{
                                                            selectedCreateApprovedMedicineGovernance.formularyLabel
                                                        }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="
                                                            selectedCreateInventoryItem &&
                                                            !selectedCreateInventoryLoading
                                                        "
                                                        :variant="
                                                            inventoryStockStateVariant(
                                                                selectedCreateInventoryItem.stockState,
                                                            )
                                                        "
                                                    >
                                                        {{
                                                            inventoryStockStateLabel(
                                                                selectedCreateInventoryItem.stockState,
                                                            )
                                                        }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="
                                                            selectedCreateInventoryItem &&
                                                            !selectedCreateInventoryLoading
                                                        "
                                                        variant="secondary"
                                                    >
                                                        On hand
                                                        {{
                                                            inventoryStockQuantityLabel(
                                                                selectedCreateInventoryItem,
                                                            )
                                                        }}
                                                    </Badge>
                                                </div>
                                                <p class="text-[11px] text-muted-foreground">
                                                    Approved medicine selection stays synced with the catalog, and stock guidance updates automatically.
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap gap-1.5">
                                                <Badge
                                                    v-if="
                                                        selectedCreateApprovedMedicineCategoryLabel
                                                    "
                                                    variant="secondary"
                                                >
                                                    {{
                                                        selectedCreateApprovedMedicineCategoryLabel
                                                    }}
                                                </Badge>
                                                <Badge
                                                    v-if="
                                                        selectedCreateApprovedMedicineDosageForm
                                                    "
                                                    variant="outline"
                                                >
                                                    {{
                                                        selectedCreateApprovedMedicineDosageForm
                                                    }}
                                                </Badge>
                                                <Badge
                                                    v-if="
                                                        selectedCreateApprovedMedicineStrength
                                                    "
                                                    variant="outline"
                                                >
                                                    {{
                                                        selectedCreateApprovedMedicineStrength
                                                    }}
                                                </Badge>
                                                <Badge
                                                    v-if="
                                                        selectedCreateApprovedMedicineUnitLabel
                                                    "
                                                    variant="outline"
                                                >
                                                    {{
                                                        selectedCreateApprovedMedicineUnitLabel
                                                    }}
                                                </Badge>
                                            </div>
                                        </div>

                                        <p
                                            v-if="
                                                selectedCreateApprovedMedicineItem &&
                                                selectedCreateApprovedMedicineItem.description
                                            "
                                            class="text-xs text-muted-foreground"
                                            :title="
                                                selectedCreateApprovedMedicineItem.description
                                            "
                                        >
                                            {{
                                                selectedCreateApprovedMedicineItem.description
                                            }}
                                        </p>

                                        <Alert
                                            v-if="
                                                selectedCreateApprovedMedicineItem &&
                                                (
                                                    selectedCreateApprovedMedicineGovernance.reviewMode ===
                                                        'policy_review_required' ||
                                                    selectedCreateApprovedMedicinePreferredAlternativesLabel
                                                )
                                            "
                                            :variant="
                                                selectedCreateApprovedMedicineGovernance.reviewMode ===
                                                'policy_review_required'
                                                    ? 'default'
                                                    : 'secondary'
                                            "
                                            class="py-3"
                                        >
                                            <AlertTitle>
                                                {{
                                                    selectedCreateApprovedMedicineGovernance.reviewMode ===
                                                    'policy_review_required'
                                                        ? 'Policy review will be required downstream'
                                                        : 'Preferred formulary guidance'
                                                }}
                                            </AlertTitle>
                                            <AlertDescription class="space-y-1">
                                                <p
                                                    v-if="
                                                        selectedCreateApprovedMedicineGovernance.restrictionNote
                                                    "
                                                >
                                                    {{
                                                        selectedCreateApprovedMedicineGovernance.restrictionNote
                                                    }}
                                                </p>
                                                <p
                                                    v-if="
                                                        selectedCreateApprovedMedicinePreferredAlternativesLabel
                                                    "
                                                >
                                                    Preferred alternatives:
                                                    <span class="font-medium text-foreground">
                                                        {{
                                                            selectedCreateApprovedMedicinePreferredAlternativesLabel
                                                        }}
                                                    </span>
                                                </p>
                                                <p
                                                    v-if="
                                                        selectedCreateApprovedMedicineGovernance.indicationKeywords
                                                            .length > 0
                                                    "
                                                >
                                                    Typical indication scope:
                                                    <span class="font-medium text-foreground">
                                                        {{
                                                            selectedCreateApprovedMedicineGovernance.indicationKeywords.join(
                                                                ', ',
                                                            )
                                                        }}
                                                    </span>
                                                </p>
                                            </AlertDescription>
                                        </Alert>

                                        <div
                                            v-if="selectedCreateInventoryLoading"
                                            class="grid gap-2 sm:grid-cols-3"
                                        >
                                            <Skeleton class="h-9 w-full" />
                                            <Skeleton class="h-9 w-full" />
                                            <Skeleton class="h-9 w-full" />
                                        </div>
                                        <Alert
                                            v-else-if="selectedCreateInventoryError"
                                            variant="destructive"
                                            class="py-2"
                                        >
                                            <AlertTitle>Inventory stock unavailable</AlertTitle>
                                            <AlertDescription>
                                                {{ selectedCreateInventoryError }}
                                            </AlertDescription>
                                        </Alert>
                                        <div
                                            v-else-if="selectedCreateInventoryItem"
                                            class="rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground"
                                        >
                                            <p>{{ inventoryStockHelperText(selectedCreateInventoryItem) }}</p>
                                            <p
                                                v-if="!canReadInventoryProcurement"
                                                class="mt-1 text-[11px]"
                                            >
                                                Detailed inventory controls stay in Pharmacy, while this availability snapshot supports prescribing.
                                            </p>
                                        </div>
                                        <div
                                            v-else
                                            class="rounded-md border bg-background/60 px-3 py-2 text-xs text-muted-foreground"
                                        >
                                            <span
                                                v-if="selectedCreateApprovedMedicineItem"
                                            >
                                                No active stock match was found for the selected medicine in this facility scope.
                                            </span>
                                            <span v-else>
                                                Select an approved medicine to load pharmacy availability guidance.
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-background p-4 xl:flex xl:h-full xl:flex-col">
                            <div class="space-y-4 xl:flex xl:h-full xl:flex-col">
                                <div class="space-y-1">
                                    <p class="text-sm font-medium">
                                        Order details
                                    </p>
                                            <p class="text-xs text-muted-foreground">
                                                Record the prescribing instruction, quantity, and any optional pharmacist note.
                                            </p>
                                        </div>

                                        <div
                                            v-if="
                                                createInventoryOrderingWarning &&
                                                createInventoryOrderingWarning.tone !== 'success'
                                            "
                                            class="rounded-md border px-3 py-2 text-xs"
                                            :class="
                                                createInventoryOrderingWarning.tone === 'destructive'
                                                    ? 'border-destructive/40 bg-destructive/5'
                                                    : 'border-amber-500/40 bg-amber-500/5'
                                            "
                                        >
                                            <div class="flex items-start gap-2">
                                                <AppIcon
                                                    name="alert-triangle"
                                                    class="mt-0.5 size-3.5 shrink-0"
                                                />
                                                <div class="space-y-1">
                                                    <p class="font-medium text-foreground">
                                                        {{ createInventoryOrderingWarning.title }}
                                                    </p>
                                                    <p class="text-muted-foreground">
                                                        {{ createInventoryOrderingWarning.description }}
                                                    </p>
                                                    <p class="text-[11px] text-muted-foreground">
                                                        {{ createInventoryOrderingWarning.nextStep }}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        <div class="rounded-lg border bg-muted/10 p-3">
                                            <div class="space-y-3">
                                                <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                    <div class="space-y-1">
                                                        <p class="text-sm font-medium text-foreground">
                                                            Patient-aware medication safety
                                                        </p>
                                                        <p class="text-xs text-muted-foreground">
                                                            Review allergies, interaction alerts, recent lab-result concerns, active therapy, duplicate orders, and reconciliation follow-up before the order goes active.
                                                        </p>
                                                    </div>
                                                    <Badge
                                                        v-if="createMedicationSafetySummary"
                                                        :variant="createMedicationSafetyStatusVariant"
                                                    >
                                                        {{ createMedicationSafetyStatusLabel }}
                                                    </Badge>
                                                </div>

                                                <div
                                                    v-if="createMedicationSafetyLoading"
                                                    class="space-y-2"
                                                >
                                                    <Skeleton class="h-4 w-40 rounded-md" />
                                                    <Skeleton class="h-16 w-full rounded-lg" />
                                                </div>

                                                <Alert
                                                    v-else-if="createMedicationSafetyError"
                                                    variant="destructive"
                                                    class="py-3"
                                                >
                                                    <AlertTitle>
                                                        Medication safety unavailable
                                                    </AlertTitle>
                                                    <AlertDescription>
                                                        {{ createMedicationSafetyError }}
                                                    </AlertDescription>
                                                </Alert>

                                                <div
                                                    v-else-if="createMedicationSafetySummary"
                                                    class="space-y-3"
                                                >
                                                    <p class="text-[11px] text-muted-foreground">
                                                        Safety review for
                                                        <span class="font-medium text-foreground">
                                                            {{ createMedicationSelectionLabel }}
                                                        </span>
                                                        in the current patient context.
                                                    </p>

                                                    <div
                                                        v-if="createMedicationSafetyIssueCount === 0"
                                                        class="rounded-md border bg-background/80 px-3 py-2 text-xs text-muted-foreground"
                                                    >
                                                        No active allergy conflict, interaction alert, laboratory-result concern, duplicate therapy, dosing concern, or reconciliation follow-up was detected for this patient.
                                                    </div>

                                                    <template v-else>
                                                        <div
                                                            v-if="createMedicationSafetySummary.blockers.length > 0"
                                                            class="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2"
                                                        >
                                                            <p class="text-xs font-medium text-foreground">
                                                                Safety blockers
                                                            </p>
                                                            <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
                                                                <li
                                                                    v-for="(item, index) in createMedicationSafetySummary.blockers"
                                                                    :key="`create-safety-blocker-${index}`"
                                                                >
                                                                    {{ item }}
                                                                </li>
                                                            </ul>
                                                        </div>

                                                        <div
                                                            v-if="createMedicationSafetySummary.warnings.length > 0"
                                                            class="rounded-md border border-amber-500/40 bg-amber-500/5 px-3 py-2"
                                                        >
                                                            <p class="text-xs font-medium text-foreground">
                                                                Review warnings
                                                            </p>
                                                            <ul class="mt-2 space-y-1 text-xs text-muted-foreground">
                                                                <li
                                                                    v-for="(item, index) in createMedicationSafetySummary.warnings"
                                                                    :key="`create-safety-warning-${index}`"
                                                                >
                                                                    {{ item }}
                                                                </li>
                                                            </ul>
                                                        </div>

                                                        <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Allergy matches
                                                                </p>
                                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                                    {{ createMedicationSafetySummary.allergyConflicts.length }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Active therapy matches
                                                                </p>
                                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                                    {{
                                                                        createMedicationSafetySummary.activeProfileMatches.length +
                                                                        createMedicationSafetySummary.matchingActiveOrders.length
                                                                    }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Interaction alerts
                                                                </p>
                                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                                    {{ createMedicationSafetySummary.interactionConflicts.length }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Result alerts
                                                                </p>
                                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                                    {{ createMedicationSafetySummary.laboratorySignals.length }}
                                                                </p>
                                                            </div>
                                                            <div class="rounded-md border bg-background/80 px-3 py-2">
                                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                    Reconciliation follow-up
                                                                </p>
                                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                                    {{ createMedicationSafetySummary.unreconciledDispensedOrders.length }}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div
                                                            v-if="createMedicationSafetySummary.patientContext"
                                                            class="rounded-md border bg-background/80 px-3 py-3"
                                                        >
                                                            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                                <div>
                                                                    <p class="text-sm font-medium text-foreground">
                                                                        Patient context used for safety rules
                                                                    </p>
                                                                    <p class="text-xs text-muted-foreground">
                                                                        {{ medicationSafetyPatientContextHelper(createMedicationSafetySummary.patientContext) }}
                                                                    </p>
                                                                </div>
                                                                <Badge
                                                                    :variant="
                                                                        createMedicationSafetySummary.patientContext.isPediatric
                                                                            ? 'secondary'
                                                                            : 'outline'
                                                                    "
                                                                >
                                                                    {{
                                                                        createMedicationSafetySummary.patientContext.isPediatric
                                                                            ? 'Pediatric context'
                                                                            : 'General context'
                                                                    }}
                                                                </Badge>
                                                            </div>
                                                            <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                                                <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                        Age
                                                                    </p>
                                                                    <p class="mt-1 text-sm font-semibold text-foreground">
                                                                        {{ medicationSafetyPatientAgeLabel(createMedicationSafetySummary.patientContext) }}
                                                                    </p>
                                                                </div>
                                                                <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                                    <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                        Triage weight
                                                                    </p>
                                                                    <p class="mt-1 text-sm font-semibold text-foreground">
                                                                        {{ medicationSafetyPatientWeightLabel(createMedicationSafetySummary.patientContext) }}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div
                                                            v-if="createMedicationSafetySummary.ruleGroups.length"
                                                            class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                                                        >
                                                            <div
                                                                v-for="group in createMedicationSafetySummary.ruleGroups"
                                                                :key="`create-safety-group-${group.key}`"
                                                                class="rounded-md border bg-background/80 px-3 py-3"
                                                            >
                                                                <div class="flex items-start justify-between gap-2">
                                                                    <div class="min-w-0">
                                                                        <p class="text-sm font-medium text-foreground">
                                                                            {{ group.label }}
                                                                        </p>
                                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                                            {{ medicationSafetyGroupSourceSummary(group) }}
                                                                        </p>
                                                                    </div>
                                                                    <Badge :variant="medicationInteractionSeverityVariant(group.severity)">
                                                                        {{ group.count }}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <p
                                                            v-if="createMedicationSafetyPrimaryAction"
                                                            class="text-[11px] text-muted-foreground"
                                                        >
                                                            <span class="font-medium text-foreground">
                                                                Next step:
                                                            </span>
                                                            {{ createMedicationSafetyPrimaryAction }}
                                                        </p>
                                                    </template>
                                                </div>

                                                <p
                                                    v-else
                                                    class="text-xs text-muted-foreground"
                                                >
                                                    Select patient and approved medicine to load medication safety and dosing guidance.
                                                </p>
                                            </div>
                                        </div>

                                        <div class="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_180px]">
                                            <div class="grid gap-2">
                                                <Label for="pha-create-dosage-instruction">Dosage instruction</Label>
                                                <Input
                                                    id="pha-create-dosage-instruction"
                                                    v-model="createForm.dosageInstruction"
                                                    placeholder="Take 1 tablet every 8 hours after meals"
                                                />
                                                <p
                                                    v-if="createFieldError('dosageInstruction')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('dosageInstruction') }}
                                                </p>
                                            </div>

                                            <div class="grid gap-2">
                                                <Label for="pha-create-clinical-indication">
                                                    Clinical indication
                                                </Label>
                                                <Input
                                                    id="pha-create-clinical-indication"
                                                    v-model="createForm.clinicalIndication"
                                                    placeholder="Fever, pain, hypertension, infection..."
                                                />
                                                <p class="text-[11px] text-muted-foreground">
                                                    Record why the patient needs this medicine.
                                                </p>
                                                <p
                                                    v-if="createFieldError('clinicalIndication')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('clinicalIndication') }}
                                                </p>
                                            </div>

                                            <div class="grid gap-2">
                                                <Label for="pha-create-quantity-prescribed">Quantity</Label>
                                                <Input
                                                    id="pha-create-quantity-prescribed"
                                                    v-model="createForm.quantityPrescribed"
                                                    type="number"
                                                    min="0.01"
                                                    step="0.01"
                                                />
                                                <p class="text-[11px] text-muted-foreground">
                                                    Final dispense is confirmed later.
                                                </p>
                                                <p
                                                    v-if="createFieldError('quantityPrescribed')"
                                                    class="text-xs text-destructive"
                                                >
                                                    {{ createFieldError('quantityPrescribed') }}
                                                </p>
                                            </div>
                                        </div>

                                        <div class="grid flex-1 gap-2">
                                            <Label for="pha-create-dispensing-notes">Note to Pharmacy (optional)</Label>
                                            <Textarea
                                                id="pha-create-dispensing-notes"
                                                v-model="createForm.dispensingNotes"
                                                placeholder="Substitution preference, stock handling note, or pharmacist review context..."
                                                class="min-h-20 xl:flex-1"
                                            />
                                            <p class="text-[11px] text-muted-foreground">
                                                Optional. Keep this for special handling only.
                                            </p>
                                            <p
                                                v-if="createFieldError('dispensingNotes')"
                                                class="text-xs text-destructive"
                                            >
                                                {{ createFieldError('dispensingNotes') }}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                    </div>

                    <div
                        v-if="!hasCreateLifecycleMode"
                        class="rounded-lg border bg-background p-4 xl:col-span-2"
                    >
                        <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                            <div class="space-y-1">
                                <p class="text-sm font-medium">Pharmacy basket</p>
                                <p class="text-xs text-muted-foreground">
                                    Queue several medicines for this same patient and send them together to Pharmacy without rebuilding the encounter context.
                                </p>
                            </div>
                            <div class="flex flex-wrap gap-2">
                                <Badge
                                    v-if="hasCreateOrderBasketItems"
                                    variant="secondary"
                                    class="text-[10px]"
                                >
                                    {{ createOrderBasketCountLabel }}
                                </Badge>
                                <Button
                                    v-if="hasCreateOrderBasketItems"
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    class="gap-1.5"
                                    :disabled="createLoading"
                                    @click="clearCreateOrderBasket"
                                >
                                    <AppIcon name="circle-x" class="size-3.5" />
                                    Clear basket
                                </Button>
                            </div>
                        </div>

                        <div
                            v-if="hasCreateOrderBasketItems"
                            class="mt-3 grid gap-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
                        >
                            <div
                                v-for="item in createOrderBasket"
                                :key="item.clientKey"
                                class="flex h-full flex-col rounded-lg border bg-muted/10 px-2.5 py-2"
                            >
                                <div class="flex h-full flex-col gap-1.5">
                                    <div class="flex items-start justify-between gap-2">
                                        <div class="min-w-0 space-y-0.5">
                                            <p
                                                class="truncate text-sm font-medium leading-5 text-foreground"
                                                :title="item.medicationName || item.medicationCode"
                                            >
                                                {{ item.medicationName || item.medicationCode }}
                                            </p>
                                            <div class="flex flex-wrap gap-1 text-[11px]">
                                                <Badge
                                                    variant="secondary"
                                                    class="px-1.5 py-0 text-[10px]"
                                                >
                                                    Code {{ item.medicationCode || 'Pending' }}
                                                </Badge>
                                                <Badge
                                                    variant="outline"
                                                    class="px-1.5 py-0 text-[10px]"
                                                >
                                                    Qty {{ item.quantityPrescribed }}
                                                </Badge>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            class="h-6 px-1.5 text-[10px]"
                                            :disabled="createLoading"
                                            @click="
                                                removeCreateOrderBasketItem(
                                                    item.clientKey,
                                                )
                                            "
                                        >
                                            Remove
                                        </Button>
                                    </div>
                                    <div class="rounded-md bg-background/80 px-2 py-1.5">
                                        <p class="text-[11px] leading-4 text-foreground">
                                            <span class="font-medium text-muted-foreground">Sig:</span>
                                            {{ item.dosageInstruction }}
                                        </p>
                                        <p
                                            v-if="item.clinicalIndication"
                                            class="mt-1 text-[11px] leading-4 text-muted-foreground"
                                        >
                                            <span class="font-medium">Indication:</span>
                                            {{ item.clinicalIndication }}
                                        </p>
                                    </div>
                                    <div
                                        v-if="item.dispensingNotes"
                                        class="rounded-md bg-background/60 px-2 py-1.5"
                                    >
                                        <p
                                            class="text-[11px] leading-4 text-muted-foreground"
                                            :title="item.dispensingNotes"
                                        >
                                            <span class="font-medium">Note:</span>
                                            {{ item.dispensingNotes }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p
                            v-if="hasCreateLifecycleMode"
                            class="mt-3 text-xs text-muted-foreground"
                        >
                            Replacement and linked follow-up medication orders are submitted one at a time, so basket mode is unavailable while this follow-up request is active.
                        </p>
                        <p
                            v-else-if="
                                hasCreateOrderBasketItems &&
                                hasPendingCurrentCreateOrderDraft
                            "
                            class="mt-3 text-xs text-muted-foreground"
                        >
                            {{
                                hasSavedCreateDraft
                                    ? 'A saved draft is not in the basket. Sign it or discard it before submitting.'
                                    : 'The current draft is not in the basket yet. Add it first, or discard it before submitting.'
                            }}
                        </p>
                        <p
                            v-else-if="!hasCreateOrderBasketItems"
                            class="mt-3 text-xs text-muted-foreground"
                        >
                            Basket is empty. Add one or more medicines, then send them to Pharmacy together.
                        </p>
                    </div>

                    <div class="flex flex-wrap items-center justify-end gap-2">
                        <Button
                            variant="outline"
                            :disabled="createLoading"
                            @click="
                                setPharmacyWorkspaceView('queue', {
                                    focusSearch: true,
                                })
                            "
                        >
                            Cancel
                        </Button>
                        <Button
                            v-if="hasCreateFeedback"
                            variant="outline"
                            class="gap-1.5"
                            :disabled="createLoading"
                            @click="resetCreateMessages"
                        >
                            <AppIcon name="circle-x" class="size-3.5" />
                            Dismiss alerts
                        </Button>
                        <Button
                            v-if="showSaveCreateDraftAction"
                            type="button"
                            variant="outline"
                            class="gap-1.5"
                            :disabled="
                                createLoading ||
                                (
                                    hasCreateLifecycleMode &&
                                    (
                                        createLifecycleSourceLoading ||
                                        createLifecycleSourceOrder === null
                                    )
                                )
                            "
                            @click="saveCreateDraft"
                        >
                            <AppIcon name="save" class="size-3.5" />
                            {{ saveCreateDraftLabel }}
                        </Button>
                        <Button
                            v-if="hasSavedCreateDraft"
                            type="button"
                            variant="outline"
                            class="gap-1.5"
                            :disabled="createLoading"
                            @click="discardSavedCreateDraft"
                        >
                            <AppIcon name="trash" class="size-3.5" />
                            Discard saved draft
                        </Button>
                        <Button
                            v-if="canUseCreateOrderBasket"
                            type="button"
                            variant="outline"
                            class="gap-1.5"
                            :disabled="createOrderActionDisabled || hasSavedCreateDraft"
                            @click="addCurrentCreateOrderToBasket"
                        >
                            <AppIcon name="plus" class="size-3.5" />
                            {{
                                hasCreateOrderBasketItems
                                    ? 'Add current medicine'
                                    : 'Add to basket'
                            }}
                        </Button>
                        <Button
                            v-if="
                                !hasCreateLifecycleMode &&
                                hasCreateOrderBasketItems &&
                                hasPendingCurrentCreateOrderDraft &&
                                !hasSavedCreateDraft
                            "
                            type="button"
                            variant="ghost"
                            class="gap-1.5"
                            :disabled="createLoading"
                            @click="discardCurrentCreateOrderDraft"
                        >
                            <AppIcon name="circle-x" class="size-3.5" />
                            Discard current draft
                        </Button>
                        <Button
                            :disabled="
                                useSingleCreateOrderAction
                                    ? createOrderActionDisabled
                                    : submitCreateOrderBasketDisabled
                            "
                            @click="
                                useSingleCreateOrderAction
                                    ? createOrder()
                                    : submitCreateOrderBasket()
                            "
                        >
                            {{ createOrderPrimaryActionLabel }}
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <Sheet
                :open="detailsSheetOpen"
                @update:open="
                    (open) =>
                        open ? (detailsSheetOpen = true) : closeOrderDetailsSheet()
                "
            >
                <SheetContent side="right" variant="workspace">
                    <Tabs
                        v-model="detailsSheetTab"
                        class="flex min-h-0 flex-1 flex-col"
                    >
                    <SheetHeader class="shrink-0 border-b px-6 py-4 text-left pr-12">
                        <SheetTitle>Pharmacy Order Details</SheetTitle>
                        <SheetDescription>
                            Review dispense and verification context while keeping the queue visible.
                        </SheetDescription>
                        <TabsList class="mt-4 grid h-auto w-full grid-cols-2">
                            <TabsTrigger value="overview">
                                Overview
                            </TabsTrigger>
                            <TabsTrigger value="audit">
                                Audit
                            </TabsTrigger>
                        </TabsList>
                    </SheetHeader>

                    <ScrollArea class="flex-1">
                        <div v-if="detailsSheetOrder" class="flex flex-col">
                            <TabsContent value="overview" class="mt-0">
                                <Tabs v-model="detailsSheetOverviewTab" class="space-y-4 px-6 py-6">
                                    <TabsList class="grid h-auto w-full grid-cols-2 gap-2 rounded-lg bg-muted/20 p-1 xl:grid-cols-4">
                                        <TabsTrigger value="summary">Summary</TabsTrigger>
                                        <TabsTrigger value="workflow">Workflow</TabsTrigger>
                                        <TabsTrigger value="safety">Safety</TabsTrigger>
                                        <TabsTrigger value="timeline">Timeline</TabsTrigger>
                                    </TabsList>
                                    <TabsContent value="summary" class="mt-0 space-y-4">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-1 pt-0">
                                                <div class="flex flex-wrap items-start justify-between gap-3">
                                                    <div class="space-y-1">
                                                        <CardTitle class="text-sm font-medium">
                                                            Medication handoff
                                                        </CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            Keep the ordered medicine, current dispense target, and release quantities aligned.
                                                        </CardDescription>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2">
                                                        <Badge :variant="statusVariant(detailsSheetOrder.status)">
                                                            {{ formatEnumLabel(detailsSheetOrder.status) }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="detailsSheetOrder.verifiedAt"
                                                            variant="secondary"
                                                        >
                                                            Verified
                                                        </Badge>
                                                        <Badge
                                                            v-if="hasSubstitutionInDispenseNotes(detailsSheetOrder)"
                                                            variant="destructive"
                                                        >
                                                            Substitution
                                                        </Badge>
                                                        <Badge :variant="quantityBadgeVariant(detailsSheetOrder)">
                                                            {{ dispenseProgressLabel(detailsSheetOrder) }}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CardContent class="space-y-4 px-4 pt-0">
                                                <div class="grid gap-3 sm:grid-cols-2">
                                                    <div class="rounded-lg border bg-muted/20 p-3">
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Ordered medicine
                                                        </p>
                                                        <p class="mt-2 text-sm font-medium text-foreground">
                                                            {{
                                                                orderRequestedMedicationDisplay(
                                                                    detailsSheetOrder,
                                                                )
                                                            }}
                                                        </p>
                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                            {{ detailsSheetOrder.orderNumber || 'Pharmacy order' }}
                                                        </p>
                                                    </div>
                                                    <div class="rounded-lg border bg-muted/20 p-3">
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Dispense now
                                                        </p>
                                                        <p class="mt-2 text-sm font-medium text-foreground">
                                                            {{
                                                                orderDispenseTargetDisplay(
                                                                    detailsSheetOrder,
                                                                )
                                                            }}
                                                        </p>
                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                            {{
                                                                orderSubstitutionHandoffText(
                                                                    detailsSheetOrder,
                                                                ) ||
                                                                'Dispense follows the ordered medicine for this order.'
                                                            }}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div class="grid gap-3 text-sm sm:grid-cols-2">
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Patient</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ orderPatientLabel(detailsSheetOrder) }}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Patient No.</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ orderPatientNumber(detailsSheetOrder) || 'N/A' }}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Prescribed qty</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ quantityText(detailsSheetOrder.quantityPrescribed) }}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Indication</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ detailsSheetOrder.clinicalIndication || 'Not documented' }}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Appointment handoff</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ orderAppointmentDisplayLabel(detailsSheetOrder) }}
                                                        </span>
                                                    </div>
                                                    <div class="flex justify-between gap-4">
                                                        <span class="text-muted-foreground">Admission handoff</span>
                                                        <span class="min-w-0 text-right font-medium">
                                                            {{ orderAdmissionDisplayLabel(detailsSheetOrder) }}
                                                        </span>
                                                    </div>
                                                </div>
                                                </CardContent>
                                            </Card>

                                            <Card class="rounded-lg !gap-4 !py-4">
                                                <CardHeader class="px-4 pb-1 pt-0">
                                                    <CardTitle class="text-sm font-medium">
                                                        Operational notes
                                                    </CardTitle>
                                                    <CardDescription class="mt-0.5 text-xs">
                                                        Dispense, verification, and status notes kept with the order.
                                                    </CardDescription>
                                                </CardHeader>
                                                <CardContent class="space-y-3 px-4 pt-0 text-sm">
                                                    <div
                                                        v-if="detailsSheetOrder.dispensingNotes"
                                                        class="space-y-1"
                                                    >
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Dispensing note
                                                        </p>
                                                        <p class="whitespace-pre-wrap text-sm text-foreground">
                                                            {{ detailsSheetOrder.dispensingNotes }}
                                                        </p>
                                                    </div>
                                                    <div
                                                        v-if="detailsSheetOrder.verificationNote"
                                                        class="space-y-1"
                                                    >
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Verification note
                                                        </p>
                                                        <p class="text-sm text-foreground">
                                                            {{ detailsSheetOrder.verificationNote }}
                                                        </p>
                                                    </div>
                                                    <div
                                                        v-if="detailsSheetOrder.statusReason"
                                                        class="space-y-1"
                                                    >
                                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                            Status note
                                                        </p>
                                                        <p class="text-sm text-foreground">
                                                            {{ detailsSheetOrder.statusReason }}
                                                        </p>
                                                    </div>
                                                    <p
                                                        v-if="
                                                            !detailsSheetOrder.dispensingNotes &&
                                                            !detailsSheetOrder.verificationNote &&
                                                            !detailsSheetOrder.statusReason
                                                        "
                                                        class="text-sm text-muted-foreground"
                                                    >
                                                        No operational notes have been recorded on this order.
                                                    </p>
                                                </CardContent>
                                        </Card>
                                    <Card class="rounded-lg !gap-4 !py-4">
                                        <CardHeader class="px-4 pb-1 pt-0">
                                            <div
                                                class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                            >
                                                <div>
                                                    <CardTitle class="text-sm font-medium">
                                                        Inventory stock
                                                    </CardTitle>
                                                    <CardDescription class="mt-0.5 text-xs">
                                                        Compare the ordered medicine with the current dispense target before release.
                                                    </CardDescription>
                                                </div>
                                                <Badge
                                                    v-if="
                                                        detailsSheetDispenseTargetInventoryItem &&
                                                        !detailsSheetDispenseTargetInventoryLoading
                                                    "
                                                    :variant="
                                                        inventoryStockStateVariant(
                                                            detailsSheetDispenseTargetInventoryItem.stockState,
                                                        )
                                                    "
                                                >
                                                    {{
                                                        inventoryStockStateLabel(
                                                            detailsSheetDispenseTargetInventoryItem.stockState,
                                                        )
                                                    }}
                                                </Badge>
                                            </div>
                                        </CardHeader>
                                        <CardContent class="px-4 pt-0">
                                            <div
                                                v-if="
                                                    detailsSheetOrderedInventoryLoading ||
                                                    detailsSheetDispenseTargetInventoryLoading
                                                "
                                                class="mt-4 grid gap-3 lg:grid-cols-2"
                                            >
                                                <Skeleton class="h-28 w-full" />
                                                <Skeleton class="h-28 w-full" />
                                            </div>
                                            <Alert
                                                v-else-if="
                                                    detailsSheetOrderedInventoryError ||
                                                    detailsSheetDispenseTargetInventoryError
                                                "
                                                variant="destructive"
                                                class="mt-4"
                                            >
                                                <AlertTitle>
                                                    Inventory stock unavailable
                                                </AlertTitle>
                                                <AlertDescription>
                                                    {{
                                                        detailsSheetDispenseTargetInventoryError ||
                                                        detailsSheetOrderedInventoryError
                                                    }}
                                                </AlertDescription>
                                            </Alert>
                                            <div
                                                v-else
                                                class="mt-4 grid gap-3"
                                                :class="
                                                    detailsSheetHasDifferentDispenseTarget
                                                        ? 'lg:grid-cols-2'
                                                        : 'lg:grid-cols-1'
                                                "
                                            >
                                                <div class="rounded-md border bg-muted/20 p-3">
                                                    <div
                                                        class="flex items-start justify-between gap-3"
                                                    >
                                                        <div class="space-y-1">
                                                            <p
                                                                class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                                            >
                                                                Ordered medicine stock
                                                            </p>
                                                            <p
                                                                class="text-sm font-medium text-foreground"
                                                            >
                                                                {{
                                                                    orderRequestedMedicationDisplay(
                                                                        detailsSheetOrder,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <Badge
                                                            v-if="detailsSheetOrderedInventoryItem"
                                                            :variant="
                                                                inventoryStockStateVariant(
                                                                    detailsSheetOrderedInventoryItem.stockState,
                                                                )
                                                            "
                                                        >
                                                            {{
                                                                inventoryStockStateLabel(
                                                                    detailsSheetOrderedInventoryItem.stockState,
                                                                )
                                                            }}
                                                        </Badge>
                                                    </div>
                                                    <div
                                                        v-if="detailsSheetOrderedInventoryItem"
                                                        class="mt-3 grid gap-2"
                                                        :class="
                                                            canReadInventoryProcurement
                                                                ? 'sm:grid-cols-3'
                                                                : 'sm:grid-cols-1'
                                                        "
                                                    >
                                                        <div class="rounded-md border bg-background px-3 py-2">
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                On hand
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryStockQuantityLabel(
                                                                        detailsSheetOrderedInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <div
                                                            v-if="canReadInventoryProcurement"
                                                            class="rounded-md border bg-background px-3 py-2"
                                                        >
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Reorder
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryReorderLevelLabel(
                                                                        detailsSheetOrderedInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <div
                                                            v-if="canReadInventoryProcurement"
                                                            class="rounded-md border bg-background px-3 py-2"
                                                        >
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Max
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryMaxStockLabel(
                                                                        detailsSheetOrderedInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <p
                                                            class="text-xs text-muted-foreground"
                                                            :class="
                                                                canReadInventoryProcurement
                                                                    ? 'sm:col-span-3'
                                                                    : 'sm:col-span-1'
                                                            "
                                                        >
                                                            {{
                                                                inventoryStockHelperText(
                                                                    detailsSheetOrderedInventoryItem,
                                                                )
                                                            }}
                                                        </p>
                                                        <p
                                                            v-if="!canReadInventoryProcurement"
                                                            class="text-[11px] text-muted-foreground"
                                                        >
                                                            Detailed inventory controls stay in Pharmacy, but this stock snapshot is available for clinical review.
                                                        </p>
                                                    </div>
                                                    <p
                                                        v-else
                                                        class="mt-3 text-xs text-muted-foreground"
                                                    >
                                                        No inventory item matched the ordered medicine in this facility scope.
                                                    </p>
                                                </div>

                                                <div
                                                    v-if="detailsSheetHasDifferentDispenseTarget"
                                                    class="rounded-md border bg-muted/20 p-3"
                                                >
                                                    <div
                                                        class="flex items-start justify-between gap-3"
                                                    >
                                                        <div class="space-y-1">
                                                            <p
                                                                class="text-xs font-medium uppercase tracking-wide text-muted-foreground"
                                                            >
                                                                Dispense target stock
                                                            </p>
                                                            <p
                                                                class="text-sm font-medium text-foreground"
                                                            >
                                                                {{
                                                                    orderDispenseTargetDisplay(
                                                                        detailsSheetOrder,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <Badge
                                                            v-if="detailsSheetDispenseTargetInventoryItem"
                                                            :variant="
                                                                inventoryStockStateVariant(
                                                                    detailsSheetDispenseTargetInventoryItem.stockState,
                                                                )
                                                            "
                                                        >
                                                            {{
                                                                inventoryStockStateLabel(
                                                                    detailsSheetDispenseTargetInventoryItem.stockState,
                                                                )
                                                            }}
                                                        </Badge>
                                                    </div>
                                                    <div
                                                        v-if="
                                                            detailsSheetDispenseTargetInventoryItem
                                                        "
                                                        class="mt-3 grid gap-2"
                                                        :class="
                                                            canReadInventoryProcurement
                                                                ? 'sm:grid-cols-3'
                                                                : 'sm:grid-cols-1'
                                                        "
                                                    >
                                                        <div class="rounded-md border bg-background px-3 py-2">
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                On hand
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryStockQuantityLabel(
                                                                        detailsSheetDispenseTargetInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <div
                                                            v-if="canReadInventoryProcurement"
                                                            class="rounded-md border bg-background px-3 py-2"
                                                        >
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Reorder
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryReorderLevelLabel(
                                                                        detailsSheetDispenseTargetInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <div
                                                            v-if="canReadInventoryProcurement"
                                                            class="rounded-md border bg-background px-3 py-2"
                                                        >
                                                            <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Max
                                                            </p>
                                                            <p class="mt-0.5 text-sm font-medium text-foreground">
                                                                {{
                                                                    inventoryMaxStockLabel(
                                                                        detailsSheetDispenseTargetInventoryItem,
                                                                    )
                                                                }}
                                                            </p>
                                                        </div>
                                                        <p
                                                            class="text-xs text-muted-foreground"
                                                            :class="
                                                                canReadInventoryProcurement
                                                                    ? 'sm:col-span-3'
                                                                    : 'sm:col-span-1'
                                                            "
                                                        >
                                                            {{
                                                                inventoryStockHelperText(
                                                                    detailsSheetDispenseTargetInventoryItem,
                                                                )
                                                            }}
                                                        </p>
                                                        <p
                                                            v-if="!canReadInventoryProcurement"
                                                            class="text-[11px] text-muted-foreground"
                                                        >
                                                            Detailed inventory controls stay in Pharmacy, while this stock snapshot supports dispensing decisions and clinical follow-up.
                                                        </p>
                                                    </div>
                                                    <p
                                                        v-else
                                                        class="mt-3 text-xs text-muted-foreground"
                                                    >
                                                        No inventory item matched the medicine that will be dispensed.
                                                    </p>
                                                </div>
                                            </div>

                                            <div
                                                v-if="detailsSheetStockMovementSections.length > 0"
                                                class="mt-4 border-t pt-4"
                                            >
                                                <div
                                                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div>
                                                        <p class="text-sm font-medium text-foreground">
                                                            Recent stock history
                                                        </p>
                                                        <p class="text-xs text-muted-foreground">
                                                            Show the latest stock changes here, then open the full inventory ledger for the complete trace.
                                                        </p>
                                                    </div>
                                                    <Badge variant="outline">
                                                        {{ detailsSheetStockMovementSections.length }}
                                                        {{
                                                            detailsSheetStockMovementSections.length === 1
                                                                ? 'ledger'
                                                                : 'ledgers'
                                                        }}
                                                    </Badge>
                                                </div>

                                                <div
                                                    class="mt-4 grid gap-3"
                                                    :class="
                                                        detailsSheetStockMovementSections.length > 1
                                                            ? 'xl:grid-cols-2'
                                                            : 'grid-cols-1'
                                                    "
                                                >
                                                    <div
                                                        v-for="section in detailsSheetStockMovementSections"
                                                        :key="section.key"
                                                        class="rounded-md border bg-muted/10 p-3"
                                                    >
                                                        <div
                                                            class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"
                                                        >
                                                            <div>
                                                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                                                    {{ section.title }}
                                                                </p>
                                                                <p class="mt-1 text-sm font-medium text-foreground">
                                                                    {{ inventoryItemDisplay(section.item) }}
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    Showing latest
                                                                    {{ Math.min(section.movements.length, STOCK_LEDGER_PREVIEW_COUNT) }}
                                                                    of {{ section.totalMovements }}
                                                                    {{
                                                                        section.totalMovements === 1
                                                                            ? 'movement'
                                                                            : 'movements'
                                                                    }}
                                                                </p>
                                                            </div>
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <Badge
                                                                    :variant="
                                                                        inventoryStockStateVariant(
                                                                            section.item.stockState,
                                                                        )
                                                                    "
                                                                >
                                                                    {{
                                                                        inventoryStockStateLabel(
                                                                            section.item.stockState,
                                                                        )
                                                                    }}
                                                                </Badge>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    as-child
                                                                    class="gap-1.5"
                                                                >
                                                                    <Link :href="section.ledgerHref">
                                                                        <AppIcon name="arrow-up-right" class="size-3.5" />
                                                                        View full ledger
                                                                    </Link>
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        <div
                                                            v-if="section.loading"
                                                            class="mt-3 space-y-2"
                                                        >
                                                            <Skeleton class="h-16 w-full" />
                                                            <Skeleton class="h-16 w-full" />
                                                        </div>
                                                        <Alert
                                                            v-else-if="section.error"
                                                            variant="destructive"
                                                            class="mt-3"
                                                        >
                                                            <AlertTitle>
                                                                Stock movement history unavailable
                                                            </AlertTitle>
                                                            <AlertDescription>
                                                                {{ section.error }}
                                                            </AlertDescription>
                                                        </Alert>
                                                        <div
                                                            v-else-if="section.movements.length > 0"
                                                            class="mt-3 space-y-2"
                                                        >
                                                            <div
                                                                v-for="movement in section.movements"
                                                                :key="movement.id"
                                                                class="rounded-md border bg-background px-3 py-2"
                                                            >
                                                                <div
                                                                    class="flex flex-wrap items-center justify-between gap-2"
                                                                >
                                                                    <div
                                                                        class="flex flex-wrap items-center gap-2"
                                                                    >
                                                                        <Badge
                                                                            :variant="
                                                                                inventoryMovementTypeVariant(
                                                                                    movement.movementType,
                                                                                )
                                                                            "
                                                                        >
                                                                            {{
                                                                                inventoryMovementTypeLabel(
                                                                                    movement.movementType,
                                                                                )
                                                                            }}
                                                                        </Badge>
                                                                        <span
                                                                            class="text-xs text-muted-foreground"
                                                                        >
                                                                            {{
                                                                                formatDateTime(
                                                                                    movement.occurredAt ||
                                                                                        movement.createdAt,
                                                                                )
                                                                            }}
                                                                        </span>
                                                                    </div>
                                                                    <span
                                                                        class="text-xs font-medium text-foreground"
                                                                    >
                                                                        {{
                                                                            inventoryMovementDeltaLabel(
                                                                                movement,
                                                                                section.item.unit,
                                                                            )
                                                                        }}
                                                                    </span>
                                                                </div>
                                                                <p
                                                                    class="mt-2 text-sm font-medium text-foreground"
                                                                >
                                                                    {{
                                                                        inventoryMovementStockPathLabel(
                                                                            movement,
                                                                            section.item.unit,
                                                                        )
                                                                    }}
                                                                </p>
                                                                <p
                                                                    class="mt-1 text-xs text-muted-foreground"
                                                                >
                                                                    {{
                                                                        inventoryMovementTraceLabel(
                                                                            movement,
                                                                        )
                                                                    }}
                                                                </p>
                                                            </div>
                                                            <p
                                                                v-if="
                                                                    section.totalMovements >
                                                                    section.movements.length
                                                                "
                                                                class="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground"
                                                            >
                                                                {{ section.totalMovements - section.movements.length }}
                                                                older
                                                                {{
                                                                    section.totalMovements - section.movements.length === 1
                                                                        ? 'movement remains in the full ledger.'
                                                                        : 'movements remain in the full ledger.'
                                                                }}
                                                            </p>
                                                        </div>
                                                        <p
                                                            v-else
                                                            class="mt-3 text-xs text-muted-foreground"
                                                        >
                                                            No stock movement history is available for this item yet.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                    </TabsContent>

                                    <TabsContent value="workflow" class="mt-0 space-y-4">
                                        <div
                                            class="relative overflow-hidden rounded-lg border p-4 pl-5"
                                            :class="
                                                detailsSheetActionBanner
                                                    ? variantSurfaceClass(detailsSheetActionBanner.variant)
                                                    : 'border-border bg-background'
                                            "
                                        >
                                            <span
                                                class="absolute inset-y-0 left-0 w-1"
                                                :class="variantDotClass(detailsSheetActionBannerVariant)"
                                            />
                                            <div class="flex flex-col gap-4">
                                                <div class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                                    <div class="min-w-0 flex-1 space-y-3">
                                                        <div class="flex flex-wrap items-center gap-2">
                                                            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                                                {{ detailsSheetWorkflowFocusHeading }}
                                                            </p>
                                                            <Badge :variant="detailsSheetActionBannerVariant" class="gap-1.5">
                                                                <span
                                                                    class="inline-flex size-2 rounded-full"
                                                                    :class="variantDotClass(detailsSheetActionBannerVariant)"
                                                                />
                                                                {{ detailsSheetActionBannerEyebrow }}
                                                            </Badge>
                                                        </div>
                                                        <div class="space-y-2">
                                                            <p class="text-xl font-semibold tracking-tight text-foreground">
                                                                {{ detailsSheetActionBanner?.title }}
                                                            </p>
                                                            <p class="max-w-2xl text-sm leading-6 text-muted-foreground">
                                                                {{ detailsSheetActionBanner?.description }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                    <div v-if="detailsSheetPrimaryWorkflowAction" class="flex w-full sm:w-auto sm:shrink-0">
                                                        <Button
                                                            size="sm"
                                                            :variant="detailsSheetPrimaryWorkflowAction.buttonVariant"
                                                            class="w-full gap-1.5 sm:w-auto"
                                                            :disabled="actionLoadingId === detailsSheetOrder.id"
                                                            @click="runDetailsSheetWorkflowAction(detailsSheetPrimaryWorkflowAction.id)"
                                                        >
                                                            {{
                                                                actionLoadingId === detailsSheetOrder.id
                                                                    ? 'Working...'
                                                                    : detailsSheetPrimaryWorkflowAction.label
                                                            }}
                                                        </Button>
                                                    </div>
                                                </div>
                                                <div class="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                                                    <Badge :variant="statusVariant(detailsSheetOrder.status)">
                                                        {{ formatEnumLabel(detailsSheetOrder.status) }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="orderReleaseStateLabel(detailsSheetOrder)"
                                                        :variant="orderReleaseStateVariant(detailsSheetOrder)"
                                                    >
                                                        {{ orderReleaseStateLabel(detailsSheetOrder) }}
                                                    </Badge>
                                                    <Badge :variant="quantityBadgeVariant(detailsSheetOrder)">
                                                        {{ dispenseProgressLabel(detailsSheetOrder) }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="hasSubstitutionInDispenseNotes(detailsSheetOrder)"
                                                        variant="secondary"
                                                    >
                                                        Substitute
                                                    </Badge>
                                                    <Badge
                                                        v-if="orderQueueAttentionLabel(detailsSheetOrder)"
                                                        :variant="orderQueueAttentionVariant(detailsSheetOrder)"
                                                    >
                                                        {{ orderQueueAttentionLabel(detailsSheetOrder) }}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                        <div v-if="canOperatePharmacyWorkflow" class="rounded-lg border p-4">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">Supporting actions</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Secondary workflow options stay here so the main next step remains clear.
                                                    </p>
                                                </div>
                                                <Badge variant="outline">
                                                    {{ detailsSheetWorkflowActions.length }} available
                                                </Badge>
                                            </div>
                                            <div class="mt-4 space-y-2">
                                                <div
                                                    v-if="detailsSheetWorkflowActions.length === 0"
                                                    class="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground"
                                                >
                                                    No supporting actions remain on this order.
                                                </div>
                                                <div
                                                    v-for="action in detailsSheetWorkflowActions"
                                                    :key="`pha-details-workflow-${action.id}`"
                                                    class="flex flex-col gap-3 rounded-md border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div class="min-w-0">
                                                        <p class="text-sm font-medium text-foreground">
                                                            {{ action.title }}
                                                        </p>
                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                            {{ action.helper }}
                                                        </p>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        :variant="action.buttonVariant"
                                                        class="shrink-0 gap-1.5"
                                                        :disabled="actionLoadingId === detailsSheetOrder.id"
                                                        @click="runDetailsSheetWorkflowAction(action.id)"
                                                    >
                                                        {{
                                                            actionLoadingId === detailsSheetOrder.id
                                                                ? 'Working...'
                                                                : action.buttonLabel
                                                        }}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>

                                        <div
                                            v-if="
                                                canCreatePharmacyFollowOnOrder(detailsSheetOrder)
                                                || canApplyPharmacyLifecycleAction(detailsSheetOrder, 'cancel')
                                                || canApplyPharmacyLifecycleAction(detailsSheetOrder, 'discontinue')
                                                || canApplyPharmacyLifecycleAction(detailsSheetOrder, 'entered_in_error')
                                            "
                                            class="rounded-lg border p-4"
                                        >
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">Clinical lifecycle</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Reorder, add a linked follow-up medication, or stop this order without overwriting the original chart record.
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-4 flex flex-wrap gap-2">
                                                <Button
                                                    v-if="canCreatePharmacyFollowOnOrder(detailsSheetOrder)"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link
                                                        :href="
                                                            orderDetailsWorkflowHref('/pharmacy-orders', detailsSheetOrder, {
                                                                includeTabNew: true,
                                                                reorderOfId: detailsSheetOrder.id,
                                                            })
                                                        "
                                                    >
                                                        <AppIcon name="rotate-cw" class="size-3.5" />
                                                        Reorder
                                                    </Link>
                                                </Button>
                                                <Button
                                                    v-if="canCreatePharmacyFollowOnOrder(detailsSheetOrder)"
                                                    size="sm"
                                                    variant="outline"
                                                    as-child
                                                    class="gap-1.5"
                                                >
                                                    <Link
                                                        :href="
                                                            orderDetailsWorkflowHref('/pharmacy-orders', detailsSheetOrder, {
                                                                includeTabNew: true,
                                                                addOnToOrderId: detailsSheetOrder.id,
                                                            })
                                                        "
                                                    >
                                                        <AppIcon name="plus" class="size-3.5" />
                                                        Add Linked Medication
                                                    </Link>
                                                </Button>
                                                <Button
                                                    v-if="canApplyPharmacyLifecycleAction(detailsSheetOrder, 'cancel')"
                                                    size="sm"
                                                    variant="outline"
                                                    class="gap-1.5"
                                                    :disabled="actionLoadingId === detailsSheetOrder.id"
                                                    @click="openPharmacyLifecycleDialog(detailsSheetOrder, 'cancel')"
                                                >
                                                    <AppIcon name="circle-slash-2" class="size-3.5" />
                                                    Cancel Order
                                                </Button>
                                                <Button
                                                    v-if="canApplyPharmacyLifecycleAction(detailsSheetOrder, 'discontinue')"
                                                    size="sm"
                                                    variant="outline"
                                                    class="gap-1.5"
                                                    :disabled="actionLoadingId === detailsSheetOrder.id"
                                                    @click="openPharmacyLifecycleDialog(detailsSheetOrder, 'discontinue')"
                                                >
                                                    <AppIcon name="circle-slash-2" class="size-3.5" />
                                                    Discontinue
                                                </Button>
                                                <Button
                                                    v-if="canApplyPharmacyLifecycleAction(detailsSheetOrder, 'entered_in_error')"
                                                    size="sm"
                                                    variant="destructive"
                                                    class="gap-1.5"
                                                    :disabled="actionLoadingId === detailsSheetOrder.id"
                                                    @click="openPharmacyLifecycleDialog(detailsSheetOrder, 'entered_in_error')"
                                                >
                                                    <AppIcon name="triangle-alert" class="size-3.5" />
                                                    Entered in Error
                                                </Button>
                                            </div>
                                        </div>

                                        <div class="rounded-lg border p-4">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">Workflow status</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Key checkpoints for policy, release, stock, and reconciliation on this order.
                                                    </p>
                                                </div>
                                            </div>
                                            <div class="mt-4 space-y-2">
                                                <div
                                                    v-for="card in detailsSheetOverviewCards"
                                                    :key="`pha-overview-card-${card.id}`"
                                                    class="flex flex-col gap-2 rounded-md border bg-background px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                                                >
                                                    <div class="min-w-0">
                                                        <p class="text-sm font-medium text-foreground">
                                                            {{ card.title }}
                                                        </p>
                                                        <p class="mt-1 text-xs text-muted-foreground">
                                                            {{ card.helper }}
                                                        </p>
                                                    </div>
                                                    <Badge :variant="card.badgeVariant" class="shrink-0">
                                                        {{ card.value }}
                                                    </Badge>
                                                </div>
                                            </div>
                                        </div>

                                    </TabsContent>

                                    <TabsContent value="safety" class="mt-0 space-y-4">
                                        <div class="rounded-lg border p-4">
                                            <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                                <div>
                                                    <p class="text-sm font-medium">Safety review</p>
                                                    <p class="text-xs text-muted-foreground">
                                                        Server-checked blockers, interaction alerts, recent lab-result context, duplicate context, and medication follow-up around this order.
                                                    </p>
                                                </div>
                                                <Badge
                                                    v-if="detailsSheetSafetyReview"
                                                    :variant="pharmacySafetyReviewVariant(detailsSheetSafetyReview.severity)"
                                                >
                                                    {{ pharmacySafetyReviewLabel(detailsSheetSafetyReview.severity) }}
                                                </Badge>
                                            </div>

                                            <div v-if="detailsSheetSafetyReviewLoading" class="mt-4 space-y-3">
                                                <Skeleton class="h-20 w-full" />
                                                <Skeleton class="h-24 w-full" />
                                            </div>
                                            <Alert
                                                v-else-if="detailsSheetSafetyReviewError"
                                                variant="destructive"
                                                class="mt-4"
                                            >
                                                <AlertTitle>Safety review unavailable</AlertTitle>
                                                <AlertDescription>
                                                    {{ detailsSheetSafetyReviewError }}
                                                </AlertDescription>
                                            </Alert>
                                            <div
                                                v-else-if="detailsSheetSafetyReview"
                                                class="mt-4 space-y-4"
                                            >
                                                <div class="rounded-md border bg-background px-3 py-3">
                                                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium text-foreground">
                                                                Patient context used for safety rules
                                                            </p>
                                                            <p class="text-xs text-muted-foreground">
                                                                {{ medicationSafetyPatientContextHelper(detailsSheetSafetyReview.patientContext) }}
                                                            </p>
                                                        </div>
                                                        <Badge
                                                            :variant="
                                                                detailsSheetSafetyReview.patientContext?.isPediatric
                                                                    ? 'secondary'
                                                                    : 'outline'
                                                            "
                                                        >
                                                            {{
                                                                detailsSheetSafetyReview.patientContext?.isPediatric
                                                                    ? 'Pediatric context'
                                                                    : 'General context'
                                                            }}
                                                        </Badge>
                                                    </div>
                                                    <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Age
                                                            </p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                                {{ medicationSafetyPatientAgeLabel(detailsSheetSafetyReview.patientContext) }}
                                                            </p>
                                                        </div>
                                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                                Triage weight
                                                            </p>
                                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                                {{ medicationSafetyPatientWeightLabel(detailsSheetSafetyReview.patientContext) }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="
                                                        detailsSheetSafetyReview.blockers.length ||
                                                        detailsSheetSafetyReview.warnings.length
                                                    "
                                                    class="grid gap-3 2xl:grid-cols-2"
                                                >
                                                    <div
                                                        v-if="detailsSheetSafetyReview.blockers.length"
                                                        class="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-3"
                                                    >
                                                        <div class="flex items-center gap-2">
                                                            <AppIcon name="shield-alert" class="size-4 text-destructive" />
                                                            <p class="text-sm font-medium text-foreground">
                                                                Blocking review items
                                                            </p>
                                                        </div>
                                                        <ul class="mt-3 space-y-1.5">
                                                            <li
                                                                v-for="(item, index) in detailsSheetSafetyReview.blockers"
                                                                :key="`pha-safety-blocker-${index}`"
                                                                class="flex gap-2 rounded-md bg-background/80 px-3 py-2.5"
                                                            >
                                                                <span class="mt-1 size-1.5 shrink-0 rounded-full bg-destructive/70" />
                                                                <span class="min-w-0 text-sm leading-5 text-muted-foreground">
                                                                    {{ item }}
                                                                </span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                    <div
                                                        v-if="detailsSheetSafetyReview.warnings.length"
                                                        class="rounded-md border border-border/70 bg-muted/20 px-3 py-3"
                                                    >
                                                        <div class="flex items-center gap-2">
                                                            <AppIcon name="triangle-alert" class="size-4 text-muted-foreground" />
                                                            <p class="text-sm font-medium text-foreground">
                                                                Review prompts
                                                            </p>
                                                        </div>
                                                        <ul class="mt-3 space-y-1.5">
                                                            <li
                                                                v-for="(item, index) in detailsSheetSafetyReview.warnings"
                                                                :key="`pha-safety-warning-${index}`"
                                                                class="flex gap-2 rounded-md bg-background/80 px-3 py-2.5"
                                                            >
                                                                <span class="mt-1 size-1.5 shrink-0 rounded-full bg-amber-500/80" />
                                                                <span class="min-w-0 text-sm leading-5 text-muted-foreground">
                                                                    {{ item }}
                                                                </span>
                                                            </li>
                                                        </ul>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="detailsSheetSafetyReview.ruleGroups.length"
                                                    class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                                                >
                                                    <div
                                                        v-for="group in detailsSheetSafetyReview.ruleGroups"
                                                        :key="`details-safety-group-${group.key}`"
                                                        class="rounded-md border bg-background px-3 py-3"
                                                    >
                                                        <div class="flex items-start justify-between gap-2">
                                                            <div class="min-w-0">
                                                                <p class="text-sm font-medium text-foreground">
                                                                    {{ group.label }}
                                                                </p>
                                                                <p class="mt-1 text-xs text-muted-foreground">
                                                                    {{ medicationSafetyGroupSourceSummary(group) }}
                                                                </p>
                                                            </div>
                                                            <Badge :variant="medicationInteractionSeverityVariant(group.severity)">
                                                                {{ group.count }}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="detailsSheetSafetyReview.interactionConflicts.length"
                                                    class="rounded-md border bg-background px-3 py-3"
                                                >
                                                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium text-foreground">
                                                                Interaction alerts
                                                            </p>
                                                            <p class="text-xs text-muted-foreground">
                                                                Current therapies that may interact with this dispense target.
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline">
                                                            {{ detailsSheetSafetyReview.interactionConflicts.length }} records
                                                        </Badge>
                                                    </div>
                                                    <div class="mt-3 space-y-2">
                                                        <div
                                                            v-for="conflict in detailsSheetSafetyReview.interactionConflicts"
                                                            :key="`${conflict.ruleCode}-${conflict.interactingMedicationCode || conflict.interactingMedicationName || 'interaction'}`"
                                                            class="rounded-md border bg-muted/10 px-3 py-3"
                                                        >
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="text-sm font-medium text-foreground">
                                                                    {{ medicationInteractionLabel(conflict) }}
                                                                </p>
                                                                <Badge
                                                                    :variant="medicationInteractionSeverityVariant(conflict.severity)"
                                                                >
                                                                    {{ formatEnumLabel(conflict.severity || 'warning') }}
                                                                </Badge>
                                                                <Badge variant="outline">
                                                                    {{ conflict.sourceLabel || 'Current therapy' }}
                                                                </Badge>
                                                            </div>
                                                            <p class="mt-2 text-sm text-muted-foreground">
                                                                {{ conflict.message }}
                                                            </p>
                                                            <p
                                                                v-if="conflict.clinicalEffect"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                Effect: {{ conflict.clinicalEffect }}
                                                            </p>
                                                            <p
                                                                v-if="conflict.recommendedAction"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                Action: {{ conflict.recommendedAction }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="detailsSheetSafetyReview.laboratorySignals.length"
                                                    class="rounded-md border bg-background px-3 py-3"
                                                >
                                                    <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                        <div>
                                                            <p class="text-sm font-medium text-foreground">
                                                                Recent lab-result alerts
                                                            </p>
                                                            <p class="text-xs text-muted-foreground">
                                                                Verified laboratory results that change how this medicine should be reviewed now.
                                                            </p>
                                                        </div>
                                                        <Badge variant="outline">
                                                            {{ detailsSheetSafetyReview.laboratorySignals.length }} records
                                                        </Badge>
                                                    </div>
                                                    <div class="mt-3 space-y-2">
                                                        <div
                                                            v-for="signal in detailsSheetSafetyReview.laboratorySignals"
                                                            :key="`${signal.ruleCode}-${signal.sourceOrderId || signal.sourceTestCode || 'lab'}`"
                                                            class="rounded-md border bg-muted/10 px-3 py-3"
                                                        >
                                                            <div class="flex flex-wrap items-center gap-2">
                                                                <p class="text-sm font-medium text-foreground">
                                                                    {{ medicationLaboratorySignalLabel(signal) }}
                                                                </p>
                                                                <Badge :variant="medicationInteractionSeverityVariant(signal.severity)">
                                                                    {{ formatEnumLabel(signal.severity || 'warning') }}
                                                                </Badge>
                                                                <Badge
                                                                    v-if="signal.sourceFlag"
                                                                    variant="outline"
                                                                >
                                                                    {{ formatEnumLabel(signal.sourceFlag) }}
                                                                </Badge>
                                                            </div>
                                                            <p
                                                                v-if="signal.sourceVerifiedAt"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                Verified {{ formatDateTime(signal.sourceVerifiedAt) }}
                                                            </p>
                                                            <p class="mt-2 text-sm text-muted-foreground">
                                                                {{ signal.message }}
                                                            </p>
                                                            <p
                                                                v-if="signal.sourceResultSummary"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                {{ signal.sourceResultSummary }}
                                                            </p>
                                                            <p
                                                                v-if="signal.clinicalEffect"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                Effect: {{ signal.clinicalEffect }}
                                                            </p>
                                                            <p
                                                                v-if="signal.recommendedAction"
                                                                class="mt-1 text-xs text-muted-foreground"
                                                            >
                                                                Action: {{ signal.recommendedAction }}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-if="detailsSheetSafetyReviewSections.length"
                                                    class="space-y-3"
                                                >
                                                    <div
                                                        v-for="section in detailsSheetSafetyReviewSections"
                                                        :key="`pha-safety-section-${section.id}`"
                                                        class="rounded-md border bg-background px-3 py-3"
                                                    >
                                                        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                                            <div>
                                                                <p class="text-sm font-medium text-foreground">
                                                                    {{ section.title }}
                                                                </p>
                                                                <p class="text-xs text-muted-foreground">
                                                                    {{ section.helper }}
                                                                </p>
                                                            </div>
                                                            <Badge variant="outline">
                                                                {{ section.orders.length }} records
                                                            </Badge>
                                                        </div>
                                                        <div class="mt-3 space-y-2">
                                                            <button
                                                                v-for="relatedOrder in section.orders"
                                                                :key="`pha-safety-order-${section.id}-${relatedOrder.id}`"
                                                                type="button"
                                                                class="flex w-full flex-col gap-2 rounded-md border bg-muted/10 px-3 py-3 text-left transition-colors hover:bg-muted/20"
                                                                @click="openOrderDetailsSheet(relatedOrder)"
                                                            >
                                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                                    <p class="text-sm font-medium text-foreground">
                                                                        {{ pharmacySafetyReviewOrderLabel(relatedOrder) }}
                                                                    </p>
                                                                    <Badge :variant="statusVariant(relatedOrder.status)">
                                                                        {{ formatEnumLabel(relatedOrder.status) }}
                                                                    </Badge>
                                                                </div>
                                                                <p class="text-xs text-muted-foreground">
                                                                    Ordered {{ formatDateTime(relatedOrder.orderedAt) }}
                                                                </p>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div
                                                    v-else-if="
                                                        !detailsSheetSafetyReview.blockers.length &&
                                                        !detailsSheetSafetyReview.warnings.length &&
                                                        !detailsSheetSafetyReview.interactionConflicts.length &&
                                                        !detailsSheetSafetyReview.laboratorySignals.length
                                                    "
                                                    class="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground"
                                                >
                                                    No active blockers, interaction alerts, lab-result concerns, duplicate risks, or reconciliation follow-up were found for this order.
                                                </div>
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="timeline" class="mt-0 space-y-4">
                                <div class="rounded-lg border p-4">
                                    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                        <div>
                                            <p class="text-sm font-medium">Medication timeline</p>
                                            <p class="text-xs text-muted-foreground">
                                                Ordered, policy, dispense, verification, and reconciliation events in one chronology.
                                            </p>
                                        </div>
                                        <Badge variant="outline">
                                            {{ detailsSheetTimelineEvents.length }} steps
                                        </Badge>
                                    </div>

                                    <div class="mt-4 space-y-0">
                                        <div
                                            v-for="(event, index) in detailsSheetTimelineEvents"
                                            :key="`pha-timeline-${event.id}`"
                                            class="flex gap-3"
                                        >
                                            <div class="flex w-5 flex-col items-center">
                                                <span
                                                    class="mt-1 size-2.5 rounded-full"
                                                    :class="variantDotClass(event.variant)"
                                                />
                                                <span
                                                    v-if="index < detailsSheetTimelineEvents.length - 1"
                                                    class="mt-1 w-px flex-1 bg-border"
                                                />
                                            </div>
                                            <div class="min-w-0 flex-1 pb-4">
                                                <div class="flex flex-wrap items-center gap-2">
                                                    <p class="text-sm font-medium text-foreground">
                                                        {{ event.label }}
                                                    </p>
                                                    <Badge :variant="event.variant">
                                                        {{
                                                            event.pending
                                                                ? 'Pending'
                                                                : formatDateTime(event.occurredAt)
                                                        }}
                                                    </Badge>
                                                </div>
                                                <p class="mt-1 text-sm text-muted-foreground">
                                                    {{ event.detail }}
                                                </p>
                                                <p
                                                    v-if="event.note"
                                                    class="mt-1 text-xs text-muted-foreground"
                                                >
                                                    {{ event.note }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div v-if="pharmacyDetailsSheetHasRelatedWorkflows" class="rounded-lg border p-4">
                                    <p class="text-sm font-medium">Related workflows</p>
                                    <p class="mb-3 text-xs text-muted-foreground">
                                        Open related workflows with patient and order context carried forward.
                                    </p>
                                    <div class="grid gap-2 sm:grid-cols-2">
                                        <Button
                                            v-if="canReadAppointments && detailsSheetOrder.appointmentId"
                                            variant="outline"
                                            class="justify-start"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    orderDetailsWorkflowHref(
                                                        '/appointments',
                                                        detailsSheetOrder,
                                                        { focusAppointmentOnReturn: true },
                                                    )
                                                "
                                            >
                                                Back to Appointments
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="
                                                canReadMedicalRecords &&
                                                detailsSheetOrder.patientId
                                            "
                                            variant="outline"
                                            class="justify-start"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    orderDetailsWorkflowHref(
                                                        '/medical-records',
                                                        detailsSheetOrder,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                {{ consultationReturnLabel }}
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canReadLaboratoryOrders && detailsSheetOrder.patientId"
                                            variant="outline"
                                            class="justify-start"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    orderDetailsWorkflowHref(
                                                        '/laboratory-orders',
                                                        detailsSheetOrder,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                New Lab Order
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canCreateTheatreProcedures && detailsSheetOrder.patientId"
                                            variant="outline"
                                            class="justify-start"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    orderDetailsWorkflowHref(
                                                        '/theatre-procedures',
                                                        detailsSheetOrder,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                Schedule Procedure
                                            </Link>
                                        </Button>
                                        <Button
                                            v-if="canReadBillingInvoices && detailsSheetOrder.patientId"
                                            variant="outline"
                                            class="justify-start"
                                            as-child
                                        >
                                            <Link
                                                :href="
                                                    orderDetailsWorkflowHref(
                                                        '/billing-invoices',
                                                        detailsSheetOrder,
                                                        { includeTabNew: true },
                                                    )
                                                "
                                            >
                                                New Billing Invoice
                                            </Link>
                                        </Button>
                                    </div>
                                </div>
                                    </TabsContent>
                                </Tabs>
                            </TabsContent>

                            <TabsContent value="audit" class="mt-0 space-y-4 px-6 py-6">
                                <div class="rounded-lg border p-4">
                                    <div
                                        class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                    >
                                        <div>
                                            <p class="text-sm font-medium">Audit trail</p>
                                            <p class="text-xs text-muted-foreground">
                                                Immutable lifecycle events and export jobs for this pharmacy order.
                                            </p>
                                        </div>
                                        <div class="flex items-center gap-2">
                                            <Badge
                                                v-if="canViewPharmacyOrderAuditLogs"
                                                variant="outline"
                                            >
                                                {{ detailsSheetAuditSummary.total }} entries
                                            </Badge>
                                            <Badge v-else variant="secondary">Audit Restricted</Badge>
                                            <Button
                                                v-if="canViewPharmacyOrderAuditLogs"
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                :disabled="detailsSheetAuditLogsLoading"
                                                @click="
                                                    detailsSheetOrder &&
                                                        loadOrderAuditLogs(detailsSheetOrder.id)
                                                "
                                            >
                                                {{
                                                    detailsSheetAuditLogsLoading
                                                        ? 'Refreshing...'
                                                        : 'Refresh Audit'
                                                }}
                                            </Button>
                                        </div>
                                    </div>
                                </div>

                                <Alert
                                    v-if="!canViewPharmacyOrderAuditLogs"
                                    variant="destructive"
                                >
                                    <AlertTitle>Audit access restricted</AlertTitle>
                                    <AlertDescription>
                                        Request <code>pharmacy.orders.view-audit-logs</code> permission.
                                    </AlertDescription>
                                </Alert>

                                <template v-else>
                                    <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                        <Card class="rounded-lg !gap-3 !py-3">
                                            <CardContent class="px-4 pt-0">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    Total entries
                                                </p>
                                                <p class="mt-2 text-2xl font-semibold">
                                                    {{ detailsSheetAuditSummary.total }}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-3 !py-3">
                                            <CardContent class="px-4 pt-0">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    Changed events
                                                </p>
                                                <p class="mt-2 text-2xl font-semibold">
                                                    {{ detailsSheetAuditSummary.changedEntries }}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-3 !py-3">
                                            <CardContent class="px-4 pt-0">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    User actions
                                                </p>
                                                <p class="mt-2 text-2xl font-semibold">
                                                    {{ detailsSheetAuditSummary.userEntries }}
                                                </p>
                                            </CardContent>
                                        </Card>
                                        <Card class="rounded-lg !gap-3 !py-3">
                                            <CardContent class="px-4 pt-0">
                                                <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                                    Current view
                                                </p>
                                                <p class="mt-2 text-sm font-medium">
                                                    {{ detailsSheetAuditHasActiveFilters ? 'Filtered' : 'All audit events' }}
                                                </p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Collapsible v-model:open="detailsSheetAuditFiltersOpen">
                                        <Card class="rounded-lg !gap-4 !py-4">
                                            <CardHeader class="px-4 pb-2 pt-0">
                                                <div class="flex flex-wrap items-center justify-between gap-2">
                                                    <div>
                                                        <CardTitle class="text-sm font-medium">Audit filters</CardTitle>
                                                        <CardDescription class="mt-0.5 text-xs">
                                                            {{ detailsSheetAuditSummary.total }} entries | Search by action, actor, or date range
                                                        </CardDescription>
                                                    </div>
                                                    <div class="flex items-center gap-2">
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            :disabled="
                                                                detailsSheetAuditLogsLoading ||
                                                                detailsSheetAuditLogsExporting ||
                                                                !detailsSheetOrder
                                                            "
                                                            @click="exportPharmacyAuditLogsCsv"
                                                        >
                                                            {{ detailsSheetAuditLogsExporting ? 'Preparing...' : 'Export CSV' }}
                                                        </Button>
                                                        <CollapsibleTrigger as-child>
                                                            <Button variant="secondary" size="sm" class="gap-1.5">
                                                                <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                                {{ detailsSheetAuditFiltersOpen ? 'Hide filters' : 'Show filters' }}
                                                            </Button>
                                                        </CollapsibleTrigger>
                                                    </div>
                                                </div>
                                            </CardHeader>
                                            <CollapsibleContent>
                                                <CardContent class="space-y-3 px-4 pt-0">
                                                    <div class="grid gap-3 sm:grid-cols-2">
                                                        <div class="grid gap-2 sm:col-span-2">
                                                            <Label for="pha-details-audit-q" class="text-xs">
                                                                Search
                                                            </Label>
                                                            <Input
                                                                id="pha-details-audit-q"
                                                                v-model="detailsSheetAuditLogsFilters.q"
                                                                placeholder="e.g. status.updated, verified, created..."
                                                                @keyup.enter="submitDetailsAuditLogsFilters"
                                                            />
                                                        </div>
                                                        <div class="grid gap-2">
                                                            <Label for="pha-details-audit-action" class="text-xs">
                                                                Action
                                                            </Label>
                                                            <Select v-model="detailsSheetAuditLogsFilters.action">
                                                                <SelectTrigger class="w-full">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                <SelectItem value="">
                                                                    All
                                                                </SelectItem>
                                                                <SelectItem
                                                                    v-for="option in pharmacyAuditActionOptions"
                                                                    :key="`pha-audit-action-${option.value}`"
                                                                    :value="option.value"
                                                                >
                                                                    {{ option.label }}
                                                                </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div class="grid gap-2">
                                                            <Label for="pha-details-audit-actor-type" class="text-xs">
                                                                Actor type
                                                            </Label>
                                                            <Select v-model="detailsSheetAuditLogsFilters.actorType">
                                                                <SelectTrigger class="w-full">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                <SelectItem
                                                                    v-for="option in pharmacyAuditActorTypeOptions"
                                                                    :key="`pha-audit-actor-type-${option.value || 'all'}`"
                                                                    :value="option.value"
                                                                >
                                                                    {{ option.label }}
                                                                </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div class="grid gap-2">
                                                            <Label for="pha-details-audit-actor-id" class="text-xs">
                                                                Actor user ID
                                                            </Label>
                                                            <Input
                                                                id="pha-details-audit-actor-id"
                                                                v-model="detailsSheetAuditLogsFilters.actorId"
                                                                inputmode="numeric"
                                                                placeholder="Optional user ID"
                                                                @keyup.enter="submitDetailsAuditLogsFilters"
                                                            />
                                                        </div>
                                                        <div class="grid gap-2 sm:col-span-2">
                                                            <DateRangeFilterPopover
                                                                input-base-id="pha-details-audit-date-range"
                                                                title="Audit Date"
                                                                helper-text="Filter audit events by created timestamp."
                                                                from-label="From"
                                                                to-label="To"
                                                                v-model:from="detailsSheetAuditLogsFilters.from"
                                                                v-model:to="detailsSheetAuditLogsFilters.to"
                                                            />
                                                        </div>
                                                        <div class="grid gap-2">
                                                            <Label for="pha-details-audit-per-page" class="text-xs">
                                                                Rows per page
                                                            </Label>
                                                            <Select :model-value="String(detailsSheetAuditLogsFilters.perPage)" @update:model-value="detailsSheetAuditLogsFilters.perPage = Number($event)">
                                                                <SelectTrigger class="w-full">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                <SelectItem value="10">10</SelectItem>
                                                                <SelectItem value="20">20</SelectItem>
                                                                <SelectItem value="50">50</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                    <div class="flex flex-wrap gap-2 border-t pt-3">
                                                        <Button
                                                            size="sm"
                                                            class="gap-1.5"
                                                            :disabled="detailsSheetAuditLogsLoading"
                                                            @click="submitDetailsAuditLogsFilters"
                                                        >
                                                            <AppIcon name="eye" class="size-3.5" />
                                                            {{ detailsSheetAuditLogsLoading ? 'Applying...' : 'Apply filters' }}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            class="gap-1.5"
                                                            :disabled="detailsSheetAuditLogsLoading"
                                                            @click="resetDetailsAuditLogsFilters()"
                                                        >
                                                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                                                            Reset
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </CollapsibleContent>
                                        </Card>
                                    </Collapsible>

                                    <div
                                        class="space-y-2 rounded-md border bg-background/70 p-3"
                                    >
                                <div
                                    class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
                                >
                                    <div>
                                        <p class="text-xs font-medium">Export Jobs</p>
                                        <p class="text-[11px] text-muted-foreground">
                                            Recent audit CSV jobs for this pharmacy order.
                                        </p>
                                    </div>
                                    <div class="flex items-center gap-2">
                                        <Badge variant="outline">
                                            {{ detailsSheetAuditExportJobsMeta?.total ?? 0 }} jobs
                                        </Badge>
                                        <Badge
                                            v-if="detailsSheetAuditExportJobSummary.backlog > 0"
                                            variant="secondary"
                                        >
                                            {{ detailsSheetAuditExportJobSummary.backlog }} backlog
                                        </Badge>
                                        <Badge
                                            v-if="detailsSheetAuditExportJobSummary.failed > 0"
                                            variant="destructive"
                                        >
                                            {{ detailsSheetAuditExportJobSummary.failed }} failed
                                        </Badge>
                                        <Badge
                                            v-if="detailsSheetAuditExportJobSummary.completed > 0"
                                            variant="outline"
                                        >
                                            {{ detailsSheetAuditExportJobSummary.completed }} completed
                                        </Badge>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            :disabled="
                                                detailsSheetAuditExportJobsLoading ||
                                                !detailsSheetOrder
                                            "
                                            @click="
                                                detailsSheetOrder &&
                                                    loadOrderAuditExportJobs(
                                                        detailsSheetOrder.id,
                                                    )
                                            "
                                        >
                                            {{
                                                detailsSheetAuditExportJobsLoading
                                                    ? 'Refreshing...'
                                                    : 'Refresh Jobs'
                                            }}
                                        </Button>
                                    </div>
                                </div>

                                <div
                                    class="grid gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,180px)_auto] sm:items-end"
                                >
                                    <div class="grid gap-2">
                                        <Label for="pha-details-audit-export-status">
                                            Job status
                                        </Label>
                                        <Select v-model="detailsSheetAuditExportJobsFilters.statusGroup">
                                            <SelectTrigger class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem
                                                v-for="option in auditExportStatusGroupOptions"
                                                :key="`pha-audit-export-status-${option.value}`"
                                                :value="option.value"
                                            >
                                                {{ option.label }}
                                            </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="grid gap-2">
                                        <Label for="pha-details-audit-export-per-page">
                                            Results per page
                                        </Label>
                                        <Select v-model="detailsSheetAuditExportJobsFilters.perPage">
                                            <SelectTrigger class="w-full">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                            <SelectItem value="8">8</SelectItem>
                                            <SelectItem value="12">12</SelectItem>
                                            <SelectItem value="20">20</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            :disabled="detailsSheetAuditExportJobsLoading"
                                            @click="submitDetailsAuditExportJobsFilters"
                                        >
                                            Apply Job Filters
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            :disabled="detailsSheetAuditExportJobsLoading"
                                            @click="resetDetailsAuditExportJobsFilters()"
                                        >
                                            Reset Job Filters
                                        </Button>
                                    </div>
                                </div>

                                <Alert
                                    v-if="
                                        !detailsSheetAuditExportJobsLoading &&
                                        !detailsSheetAuditExportJobsError &&
                                        detailsSheetAuditExportOpsHint
                                    "
                                    :variant="
                                        detailsSheetAuditExportJobSummary.failed > 0
                                            ? 'destructive'
                                            : 'default'
                                    "
                                >
                                    <AlertTitle>Export queue status</AlertTitle>
                                    <AlertDescription>
                                        {{ detailsSheetAuditExportOpsHint }}
                                    </AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="detailsSheetAuditExportHandoffMessage"
                                    :variant="
                                        detailsSheetAuditExportHandoffError
                                            ? 'destructive'
                                            : 'default'
                                    "
                                >
                                    <AlertTitle>Retry handoff</AlertTitle>
                                    <AlertDescription>
                                        {{ detailsSheetAuditExportHandoffMessage }}
                                    </AlertDescription>
                                </Alert>

                                <Alert
                                    v-if="detailsSheetAuditExportJobsError"
                                    variant="destructive"
                                >
                                    <AlertTitle>Export jobs unavailable</AlertTitle>
                                    <AlertDescription>
                                        {{ detailsSheetAuditExportJobsError }}
                                    </AlertDescription>
                                </Alert>

                                <div
                                    v-else-if="detailsSheetAuditExportJobsLoading"
                                    class="space-y-2"
                                >
                                    <Skeleton class="h-12 w-full" />
                                    <Skeleton class="h-12 w-full" />
                                </div>

                                <div
                                    v-else-if="detailsSheetAuditExportJobs.length === 0"
                                    class="rounded-md border border-dashed p-3 text-xs text-muted-foreground"
                                >
                                    No export jobs yet.
                                </div>

                                <div v-else class="space-y-2">
                                    <div
                                        v-if="detailsSheetAuditExportPinnedHandoffJob"
                                        :id="`pha-audit-export-job-handoff-${detailsSheetAuditExportPinnedHandoffJob.id}`"
                                        :class="[
                                            'rounded-md border border-dashed p-2',
                                            detailsSheetAuditExportFocusJobId ===
                                            detailsSheetAuditExportPinnedHandoffJob.id
                                                ? 'border-destructive/60 ring-1 ring-destructive/40'
                                                : '',
                                        ]"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div class="space-y-1">
                                                <div class="flex items-center gap-2">
                                                    <Badge variant="outline">Handoff Target</Badge>
                                                    <p class="text-xs font-medium">
                                                        {{
                                                            formatEnumLabel(
                                                                detailsSheetAuditExportPinnedHandoffJob.status ||
                                                                    'unknown',
                                                            )
                                                        }}
                                                    </p>
                                                </div>
                                                <p class="text-[11px] text-muted-foreground">
                                                    Created
                                                    {{
                                                        formatDateTime(
                                                            detailsSheetAuditExportPinnedHandoffJob.createdAt,
                                                        )
                                                    }}
                                                    | Rows
                                                    {{
                                                        detailsSheetAuditExportPinnedHandoffJob.rowCount ??
                                                        0
                                                    }}
                                                </p>
                                                <p
                                                    v-if="
                                                        detailsSheetAuditExportPinnedHandoffJob.errorMessage
                                                    "
                                                    class="text-[11px] text-destructive break-words"
                                                >
                                                    {{ detailsSheetAuditExportPinnedHandoffJob.errorMessage }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap gap-2">
                                                <Button
                                                    v-if="detailsSheetAuditExportPinnedHandoffJob.downloadUrl"
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    @click="
                                                        downloadPharmacyAuditExportJob(
                                                            detailsSheetAuditExportPinnedHandoffJob,
                                                        )
                                                    "
                                                >
                                                    Download
                                                </Button>
                                                <Button
                                                    v-if="
                                                        detailsSheetAuditExportPinnedHandoffJob.status ===
                                                        'failed'
                                                    "
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    :data-audit-export-retry-job-id="
                                                        detailsSheetAuditExportPinnedHandoffJob.id
                                                    "
                                                    :disabled="
                                                        detailsSheetAuditExportRetryingJobId ===
                                                        detailsSheetAuditExportPinnedHandoffJob.id
                                                    "
                                                    @click="
                                                        retryPharmacyAuditExportJob(
                                                            detailsSheetAuditExportPinnedHandoffJob,
                                                        )
                                                    "
                                                >
                                                    {{
                                                        detailsSheetAuditExportRetryingJobId ===
                                                            detailsSheetAuditExportPinnedHandoffJob.id
                                                            ? 'Retrying...'
                                                            : 'Retry'
                                                    }}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        v-for="job in detailsSheetAuditExportJobs"
                                        :key="`pha-audit-export-job-${job.id}`"
                                        :id="`pha-audit-export-job-${job.id}`"
                                        :class="[
                                            'rounded-md border p-2',
                                            detailsSheetAuditExportFocusJobId ===
                                            job.id
                                                ? 'border-destructive/60 ring-1 ring-destructive/40'
                                                : '',
                                        ]"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div class="space-y-1">
                                                <p class="text-xs font-medium">
                                                    {{ formatEnumLabel(job.status || 'unknown') }}
                                                </p>
                                                <p class="text-[11px] text-muted-foreground">
                                                    Created {{ formatDateTime(job.createdAt) }} |
                                                    Rows {{ job.rowCount ?? 0 }}
                                                </p>
                                                <p
                                                    v-if="job.errorMessage"
                                                    class="text-[11px] text-destructive break-words"
                                                >
                                                    {{ job.errorMessage }}
                                                </p>
                                            </div>
                                            <div class="flex flex-wrap gap-2">
                                                <Button
                                                    v-if="job.downloadUrl"
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    @click="downloadPharmacyAuditExportJob(job)"
                                                >
                                                    Download
                                                </Button>
                                                <Button
                                                    v-if="job.status === 'failed'"
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    :data-audit-export-retry-job-id="
                                                        job.id
                                                    "
                                                    :disabled="
                                                        detailsSheetAuditExportRetryingJobId ===
                                                        job.id
                                                    "
                                                    @click="retryPharmacyAuditExportJob(job)"
                                                >
                                                    {{
                                                        detailsSheetAuditExportRetryingJobId ===
                                                            job.id
                                                            ? 'Retrying...'
                                                            : 'Retry'
                                                    }}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        class="flex flex-wrap items-center justify-between gap-2 border-t pt-2"
                                    >
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            :disabled="
                                                detailsSheetAuditExportJobsLoading ||
                                                !detailsSheetAuditExportJobsMeta ||
                                                detailsSheetAuditExportJobsMeta.currentPage <= 1
                                            "
                                            @click="prevDetailsAuditExportJobsPage"
                                        >
                                            Previous
                                        </Button>
                                        <span class="text-[11px] text-muted-foreground">
                                            Page {{ detailsSheetAuditExportJobsMeta?.currentPage ?? 1 }} of
                                            {{ detailsSheetAuditExportJobsMeta?.lastPage ?? 1 }}
                                        </span>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            :disabled="
                                                detailsSheetAuditExportJobsLoading ||
                                                !detailsSheetAuditExportJobsMeta ||
                                                detailsSheetAuditExportJobsMeta.currentPage >=
                                                    detailsSheetAuditExportJobsMeta.lastPage
                                            "
                                            @click="nextDetailsAuditExportJobsPage"
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>

                                    <Alert
                                        v-if="detailsSheetAuditLogsError"
                                        variant="destructive"
                                    >
                                        <AlertTitle>Audit load issue</AlertTitle>
                                        <AlertDescription>
                                            {{ detailsSheetAuditLogsError }}
                                        </AlertDescription>
                                    </Alert>

                                    <div
                                        v-else-if="detailsSheetAuditLogsLoading"
                                        class="space-y-2"
                                    >
                                        <Skeleton class="h-12 w-full" />
                                        <Skeleton class="h-12 w-full" />
                                    </div>
                                    <div
                                        v-else-if="detailsSheetAuditLogs.length === 0"
                                        class="rounded-lg border border-dashed p-4 text-sm text-muted-foreground"
                                    >
                                        No audit logs found for current filters.
                                    </div>
                                    <div
                                        v-else
                                        class="space-y-2"
                                    >
                                        <div
                                            v-for="log in detailsSheetAuditLogs"
                                            :key="log.id"
                                            class="rounded-lg border p-3 text-sm"
                                        >
                                            <div class="flex flex-wrap items-start justify-between gap-2">
                                                <div class="space-y-1">
                                                    <p class="font-medium">
                                                        {{ auditLogActionLabel(log) }}
                                                    </p>
                                                    <p class="text-xs text-muted-foreground">
                                                        {{ formatDateTime(log.createdAt) }} | {{ auditLogActorLabel(log) }}
                                                    </p>
                                                </div>
                                                <div class="flex flex-wrap gap-1.5">
                                                    <Badge variant="outline">
                                                        {{ auditLogActorTypeLabel(log) }}
                                                    </Badge>
                                                    <Badge
                                                        v-if="auditLogChangeKeys(log).length > 0"
                                                        variant="secondary"
                                                    >
                                                        {{ auditLogChangeKeys(log).length }} fields changed
                                                    </Badge>
                                                    <Badge
                                                        v-if="auditLogEntries(log.metadata).length > 0"
                                                        variant="secondary"
                                                    >
                                                        {{ auditLogEntries(log.metadata).length }} metadata items
                                                    </Badge>
                                                    <Button
                                                        v-if="auditLogHasExpandableDetails(log)"
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        class="h-7 px-2 text-xs"
                                                        @click="toggleDetailsAuditRowExpanded(log.id)"
                                                    >
                                                        {{
                                                            isDetailsAuditRowExpanded(log.id)
                                                                ? 'Hide details'
                                                                : 'Show details'
                                                        }}
                                                    </Button>
                                                </div>
                                            </div>

                                            <div
                                                v-if="auditLogChangeKeys(log).length > 0"
                                                class="mt-3 flex flex-wrap gap-1.5"
                                            >
                                                <Badge
                                                    v-for="field in auditLogChangeKeys(log)"
                                                    :key="`${log.id}-field-${field}`"
                                                    variant="outline"
                                                >
                                                    {{ formatEnumLabel(field) }}
                                                </Badge>
                                            </div>

                                            <div
                                                v-if="
                                                    isDetailsAuditRowExpanded(log.id) &&
                                                    auditLogEntries(log.changes).length > 0
                                                "
                                                class="mt-3 grid gap-1 text-xs text-muted-foreground"
                                            >
                                                <p
                                                    v-for="[changeKey, changeValue] in auditLogEntries(log.changes)"
                                                    :key="`${log.id}-change-${changeKey}`"
                                                >
                                                    <span class="font-medium text-foreground">
                                                        {{ formatEnumLabel(changeKey) }}:
                                                    </span>
                                                    <span class="break-all font-mono text-[11px]">
                                                        {{ formatAuditLogValue(changeValue) }}
                                                    </span>
                                                </p>
                                            </div>

                                            <div
                                                v-if="
                                                    isDetailsAuditRowExpanded(log.id) &&
                                                    auditLogMetadataPreview(log).length > 0
                                                "
                                                class="mt-3 grid gap-1 text-xs text-muted-foreground"
                                            >
                                                <p
                                                    v-for="item in auditLogMetadataPreview(log)"
                                                    :key="`${log.id}-meta-${item.key}`"
                                                >
                                                    <span class="font-medium text-foreground">{{ item.key }}:</span>
                                                    <span class="break-all font-mono text-[11px]">
                                                        {{ item.value }}
                                                    </span>
                                                </p>
                                            </div>
                                        </div>

                                        <div class="flex items-center justify-between border-t pt-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                :disabled="
                                                    !detailsSheetAuditLogsMeta ||
                                                    detailsSheetAuditLogsMeta.currentPage <= 1 ||
                                                    detailsSheetAuditLogsLoading
                                                "
                                                @click="prevDetailsAuditLogsPage"
                                            >
                                                <AppIcon name="chevron-left" class="size-3.5" />
                                                Previous
                                            </Button>
                                            <p class="text-xs text-muted-foreground">
                                                Page {{ detailsSheetAuditLogsMeta?.currentPage ?? 1 }} of
                                                {{ detailsSheetAuditLogsMeta?.lastPage ?? 1 }} |
                                                {{ detailsSheetAuditLogsMeta?.total ?? detailsSheetAuditLogs.length }} logs
                                            </p>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                class="gap-1.5"
                                                :disabled="
                                                    !detailsSheetAuditLogsMeta ||
                                                    detailsSheetAuditLogsMeta.currentPage >=
                                                        detailsSheetAuditLogsMeta.lastPage ||
                                                    detailsSheetAuditLogsLoading
                                                "
                                                @click="nextDetailsAuditLogsPage"
                                            >
                                                <AppIcon name="chevron-right" class="size-3.5" />
                                                Next
                                            </Button>
                                        </div>
                                    </div>
                                </template>
                            </TabsContent>
                        </div>
                    </ScrollArea>

                    <SheetFooter class="border-t gap-2 px-6 py-4">
                        <Button variant="outline" @click="closeOrderDetailsSheet">
                            Close
                        </Button>
                    </SheetFooter>
                    </Tabs>
                </SheetContent>
            </Sheet>

            <Sheet
                v-if="
                    canReadPharmacyOrders &&
                    pharmacyWorkspaceView === 'queue'
                "
                :open="advancedFiltersSheetOpen"
                @update:open="advancedFiltersSheetOpen = $event"
            >
                <SheetContent side="right" variant="action" size="lg">
                    <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
                        <SheetTitle class="flex items-center gap-2">
                            <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
                            All filters
                        </SheetTitle>
                        <SheetDescription>
                            Narrow the pharmacy queue by patient and ordered date range without mixing in view settings.
                        </SheetDescription>
                    </SheetHeader>

                    <div class="space-y-4 px-4 py-4">
                        <PatientLookupField
                            input-id="pha-filter-patient-id-sheet"
                            v-model="advancedFiltersDraft.patientId"
                            label="Patient filter"
                            mode="filter"
                            placeholder="Patient name or number"
                            :helper-text="patientChartQueueFocusLocked ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.' : 'Optional exact patient filter for queue review.'"
                            :disabled="patientChartQueueFocusLocked"
                        />
                        <DateRangeFilterPopover
                            input-base-id="pha-ordered-date-range-sheet"
                            title="Ordered date range"
                            helper-text="Default starts from today. Add an end date to review previous orders."
                            from-label="From"
                            to-label="To"
                            inline
                            :number-of-months="1"
                            v-model:from="advancedFiltersDraft.from"
                            v-model:to="advancedFiltersDraft.to"
                        />
                    </div>

                    <SheetFooter class="gap-2">
                        <Button
                            variant="outline"
                            :disabled="listLoading && !hasActiveFilters"
                            @click="resetFiltersFromFiltersSheet"
                        >
                            Reset
                        </Button>
                        <Button :disabled="listLoading" @click="submitSearchFromFiltersSheet">
                            Apply filters
                        </Button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>

            <ClinicalLifecycleActionDialog
                :open="lifecycleDialogOpen"
                :action="lifecycleDialogAction"
                :order-label="lifecycleDialogOrder?.orderNumber || lifecycleDialogOrder?.medicationName || 'Pharmacy order'"
                subject-label="pharmacy order"
                :reason="lifecycleDialogReason"
                :loading="actionLoadingId === lifecycleDialogOrder?.id"
                :error="lifecycleDialogError"
                @update:open="(open) => (open ? (lifecycleDialogOpen = true) : closePharmacyLifecycleDialog())"
                @update:reason="lifecycleDialogReason = $event"
                @submit="submitPharmacyLifecycleDialog"
            />

            <Dialog
                :open="createContextDialogOpen"
                @update:open="createContextDialogOpen = $event"
            >
                <DialogContent variant="form" size="4xl" class="overflow-visible">
                    <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                        <DialogTitle class="flex items-center gap-2">
                            <AppIcon name="search" class="size-4 text-muted-foreground" />
                            Review or change context
                        </DialogTitle>
                        <DialogDescription>
                            Select the patient and linked visit context for this pharmacy order.
                        </DialogDescription>
                    </DialogHeader>

                    <div class="max-h-[calc(90vh-6rem)] space-y-4 overflow-y-auto px-6 py-4">
                        <div class="flex flex-wrap gap-2">
                            <Button
                                v-if="createPatientContextLocked"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="unlockCreatePatientContext()"
                            >
                                Unlock patient
                            </Button>
                            <Button
                                v-if="!createPatientContextLocked && (createForm.appointmentId || createForm.admissionId)"
                                type="button"
                                variant="outline"
                                size="sm"
                                class="gap-1.5"
                                @click="clearCreateClinicalLinks"
                            >
                                Unlink clinical context
                            </Button>
                        </div>

                        <Tabs v-model="createContextEditorTab" class="w-full">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 sm:grid-cols-3">
                                <TabsTrigger value="patient" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="user" class="size-3.5" />Patient</TabsTrigger>
                                <TabsTrigger value="appointment" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="calendar-clock" class="size-3.5" />Appointment</TabsTrigger>
                                <TabsTrigger value="admission" :disabled="!createForm.patientId.trim()" class="inline-flex min-h-10 items-center gap-1.5 text-xs sm:text-sm"><AppIcon name="bed-double" class="size-3.5" />Admission</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        <div class="rounded-lg border bg-muted/20 p-4">
                            <div v-show="createContextEditorTab === 'patient'" class="grid gap-3">
                                <PatientLookupField
                                    input-id="pha-create-patient-id"
                                    v-model="createForm.patientId"
                                    label="Patient"
                                    placeholder="Search patient by name, patient number, phone, email, or national ID"
                                    :helper-text="createPatientContextLocked ? 'Patient is locked from the clinical handoff. Use Unlock patient to change it.' : 'Select the patient for this dispensing order.'"
                                    :error-message="createFieldError('patientId')"
                                    patient-status="active"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('patientId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'appointment'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="pha-create-appointment-id"
                                    v-model="createForm.appointmentId"
                                    :patient-id="createForm.patientId"
                                    label="Appointment Link"
                                    resource="appointments"
                                    placeholder="Search linked appointment by number or department"
                                    helper-text="Optional. Link the checked-in appointment that started this dispensing request."
                                    :error-message="createFieldError('appointmentId')"
                                    :disabled="createPatientContextLocked"
                                    status="checked_in"
                                    @selected="closeCreateContextDialogAfterSelection('appointmentId', $event)"
                                />
                            </div>
                            <div v-show="createContextEditorTab === 'admission'" class="grid gap-3">
                                <LinkedContextLookupField
                                    input-id="pha-create-admission-id"
                                    v-model="createForm.admissionId"
                                    :patient-id="createForm.patientId"
                                    label="Admission Link"
                                    resource="admissions"
                                    placeholder="Search linked admission by number or ward"
                                    helper-text="Optional. Link an admission when this medication order belongs to an inpatient stay."
                                    :error-message="createFieldError('admissionId')"
                                    :disabled="createPatientContextLocked"
                                    @selected="closeCreateContextDialogAfterSelection('admissionId', $event)"
                                />
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <Drawer
                v-if="canReadPharmacyOrders"
                :open="mobileFiltersDrawerOpen"
                @update:open="mobileFiltersDrawerOpen = $event"
            >
                <DrawerContent class="max-h-[90vh]">
                    <DrawerHeader>
                        <DrawerTitle class="flex items-center gap-2">
                            <AppIcon
                                name="sliders-horizontal"
                                class="size-4 text-muted-foreground"
                            />
                            All filters
                        </DrawerTitle>
                        <DrawerDescription>
                            Filter pharmacy queues on mobile without leaving the order list.
                        </DrawerDescription>
                    </DrawerHeader>

                    <div class="space-y-4 overflow-y-auto px-4 pb-2">
                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Find Order / Patient</p>
                                <p class="text-xs text-muted-foreground">
                                    Search by order number, medication code, or medication name, then narrow by patient.
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="pha-q-mobile">Order Search</Label>
                                    <Input
                                        id="pha-q-mobile"
                                        v-model="searchForm.q"
                                        placeholder="Order number, medication code, medication name"
                                        @keyup.enter="submitSearchFromMobileDrawer"
                                    />
                                </div>
                                <PatientLookupField
                                    input-id="pha-filter-patient-id-mobile"
                                    v-model="searchForm.patientId"
                                    label="Patient Filter"
                                    placeholder="Search patient by name or patient number"
                                    :helper-text="patientChartQueueFocusLocked ? 'Patient scope is locked from the patient chart. Use Open Full Queue to review other patients.' : 'Optional exact patient filter.'"
                                    mode="filter"
                                    :disabled="patientChartQueueFocusLocked"
                                />
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Status</p>
                                <p class="text-xs text-muted-foreground">
                                    Filter by dispense workflow stage.
                                </p>
                            </div>
                            <div class="grid gap-2">
                                <Label for="pha-status-mobile">Status</Label>
                                <Select v-model="searchForm.status">
                                    <SelectTrigger class="w-full">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                    <SelectItem value="">All</SelectItem>
                                    <SelectItem value="pending">Pending</SelectItem>
                                    <SelectItem value="in_preparation">In Preparation</SelectItem>
                                    <SelectItem value="partially_dispensed">Partially Dispensed</SelectItem>
                                    <SelectItem value="dispensed">Dispensed</SelectItem>
                                    <SelectItem value="cancelled">Cancelled</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Ordered Date Range</p>
                                <p class="text-xs text-muted-foreground">
                                    Default starts from today. Add an end date to review previous orders.
                                </p>
                            </div>
                            <DateRangeFilterPopover
                                input-base-id="pha-ordered-date-range-mobile"
                                title="Ordered Date Range"
                                helper-text="Default starts from today. Add an end date to review previous orders."
                                from-label="From"
                                to-label="To"
                                v-model:from="searchForm.from"
                                v-model:to="searchForm.to"
                            />
                        </div>

                        <div class="rounded-lg border p-3">
                            <div class="mb-2">
                                <p class="text-sm font-medium">Results & View</p>
                                <p class="text-xs text-muted-foreground">
                                    Adjust the number of orders per page and row density for busy pharmacy queues.
                                </p>
                            </div>
                            <div class="grid gap-3">
                                <div class="grid gap-2">
                                    <Label for="pha-per-page-mobile">Results per page</Label>
                                    <Select v-model="searchForm.perPage">
                                        <SelectTrigger class="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="10">10</SelectItem>
                                        <SelectItem value="25">25</SelectItem>
                                        <SelectItem value="50">50</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="grid gap-2">
                                    <Label>Row density</Label>
                                    <div class="grid grid-cols-2 gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            :variant="
                                                compactQueueRows
                                                    ? 'outline'
                                                    : 'default'
                                            "
                                            @click="compactQueueRows = false"
                                        >
                                            Comfortable
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            :variant="
                                                compactQueueRows
                                                    ? 'default'
                                                    : 'outline'
                                            "
                                            @click="compactQueueRows = true"
                                        >
                                            Compact
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <DrawerFooter class="gap-2">
                        <Button
                            class="gap-1.5"
                            :disabled="listLoading"
                            @click="submitSearchFromMobileDrawer"
                        >
                            <AppIcon name="search" class="size-3.5" />
                            Search
                        </Button>
                        <Button
                            variant="outline"
                            :disabled="listLoading && !hasActiveFilters"
                            @click="resetFiltersFromMobileDrawer"
                        >
                            Reset Filters
                        </Button>
                    </DrawerFooter>
                </DrawerContent>
            </Drawer>

            <Dialog
                :open="statusDialogOpen"
                @update:open="(open) => (open ? (statusDialogOpen = true) : closeOrderStatusDialog())"
            >
                <DialogContent variant="workspace" :size="statusDialogSize">
                    <DialogHeader class="sticky top-0 z-10 shrink-0 border-b bg-background px-6 py-4">
                        <DialogTitle>{{ statusDialogTitle }}</DialogTitle>
                        <DialogDescription>{{ statusDialogDescription }}</DialogDescription>
                    </DialogHeader>

                    <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
                        <div
                            v-if="statusDialogOrder"
                            class="rounded-lg border p-3 text-xs text-muted-foreground"
                        >
                            <p>
                                Order:
                                <span class="font-medium text-foreground">
                                    {{ statusDialogOrder.orderNumber || 'Pharmacy Order' }}
                                </span>
                            </p>
                            <p>
                                Ordered medicine:
                                <span class="font-medium text-foreground">
                                    {{
                                        orderRequestedMedicationDisplay(
                                            statusDialogOrder,
                                        )
                                    }}
                                </span>
                            </p>
                            <p>
                                Prescribed qty:
                                <span class="font-medium text-foreground">
                                    {{ quantityText(statusDialogOrder.quantityPrescribed) }}
                                </span>
                            </p>
                            <p
                                v-if="
                                    statusDialogSubstitutionHandoffSummary
                                "
                            >
                                Dispense now:
                                <span class="font-medium text-foreground">
                                    {{
                                        orderDispenseTargetDisplay(
                                            statusDialogOrder,
                                        )
                                    }}
                                </span>
                            </p>
                            <p>
                                Progress:
                                <span class="font-medium text-foreground">
                                    {{ dispenseProgressLabel(statusDialogOrder) }}
                                </span>
                            </p>
                            <p>
                                Dispensed:
                                <span class="font-medium text-foreground">
                                    {{ formatDateTime(statusDialogOrder.dispensedAt) }}
                                </span>
                            </p>
                            <p>
                                Verified:
                                <span class="font-medium text-foreground">
                                    {{ formatDateTime(statusDialogOrder.verifiedAt) }}
                                </span>
                            </p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <Badge
                                    :variant="
                                        formularyDecisionVariant(
                                            statusDialogOrder.formularyDecisionStatus,
                                        )
                                    "
                                >
                                    {{
                                        approvedMedicineDecisionLabel(
                                            statusDialogOrder.formularyDecisionStatus,
                                        )
                                    }}
                                </Badge>
                                <Badge
                                    :variant="
                                        statusDialogOrder.substitutionMade
                                            ? 'destructive'
                                            : 'outline'
                                    "
                                >
                                    {{
                                        statusDialogOrder.substitutionMade
                                            ? 'Substitution recorded'
                                            : 'No substitution'
                                    }}
                                </Badge>
                            </div>
                            <div
                                v-if="statusDialogSubstitutionHandoffSummary"
                                class="mt-3 rounded-md border border-amber-500/40 bg-amber-500/5 p-2.5"
                            >
                                <p class="text-xs font-medium text-foreground">
                                    Substitute release path
                                </p>
                                <p class="mt-1 text-xs text-muted-foreground">
                                    {{ statusDialogSubstitutionHandoffSummary }}
                                </p>
                                <p
                                    v-if="statusDialogOrder.substitutionReason"
                                    class="mt-1 text-xs text-muted-foreground"
                                >
                                    Reason:
                                    {{ statusDialogOrder.substitutionReason }}
                                </p>
                            </div>
                            <div
                                v-if="canReadInventoryProcurement"
                                class="mt-3 rounded-md border bg-muted/20 p-2.5"
                            >
                                <div
                                    class="flex items-start justify-between gap-2"
                                >
                                    <div>
                                        <p class="text-xs font-medium text-foreground">
                                            Inventory stock
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{
                                                orderDispenseTargetDisplay(
                                                    statusDialogOrder,
                                                )
                                            }}
                                        </p>
                                    </div>
                                    <Badge
                                        v-if="
                                            statusDialogDispenseTargetInventoryItem &&
                                            !statusDialogDispenseTargetInventoryLoading
                                        "
                                        :variant="
                                            inventoryStockStateVariant(
                                                statusDialogDispenseTargetInventoryItem.stockState,
                                            )
                                        "
                                    >
                                        {{
                                            inventoryStockStateLabel(
                                                statusDialogDispenseTargetInventoryItem.stockState,
                                            )
                                        }}
                                    </Badge>
                                </div>
                                <div
                                    v-if="statusDialogDispenseTargetInventoryLoading"
                                    class="mt-2 space-y-2"
                                >
                                    <Skeleton class="h-10 w-full" />
                                </div>
                                <p
                                    v-else-if="statusDialogDispenseTargetInventoryError"
                                    class="mt-2 text-xs text-destructive"
                                >
                                    {{ statusDialogDispenseTargetInventoryError }}
                                </p>
                                <p
                                    v-else-if="statusDialogDispenseTargetInventoryItem"
                                    class="mt-2 text-xs text-muted-foreground"
                                >
                                    {{
                                        inventoryItemDisplay(
                                            statusDialogDispenseTargetInventoryItem,
                                        )
                                    }}
                                    |
                                    {{
                                        inventoryStockQuantityLabel(
                                            statusDialogDispenseTargetInventoryItem,
                                        )
                                    }}
                                    on hand
                                </p>
                                <p
                                    v-else
                                    class="mt-2 text-xs text-muted-foreground"
                                >
                                    No inventory item matched the current dispense medicine.
                                </p>
                            </div>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-3">
                            <div
                                v-for="card in statusDialogWorkflowSummaryCards"
                                :key="'pha-status-summary-' + card.id"
                                class="rounded-lg border p-3"
                                :class="variantSurfaceClass(card.variant)"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div class="min-w-0">
                                        <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                            {{ card.title }}
                                        </p>
                                        <p class="mt-2 text-sm font-semibold text-foreground">
                                            {{ card.value }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ card.helper }}
                                        </p>
                                    </div>
                                    <Badge :variant="card.variant">Current</Badge>
                                </div>
                            </div>
                        </div>

                        <div class="rounded-lg border bg-muted/20 p-3">
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                After this step
                            </p>
                            <p class="mt-2 text-sm text-foreground">
                                {{ statusDialogNextStepSummary }}
                            </p>
                        </div>

                        <div
                            v-if="statusDialogSafetyWarnings.length > 0"
                            class="grid gap-3"
                        >
                            <div
                                v-for="warning in statusDialogSafetyWarnings"
                                :key="`pha-status-warning-${warning.id}`"
                                class="rounded-lg border p-3"
                                :class="variantSurfaceClass(warning.variant)"
                            >
                                <div class="flex items-start justify-between gap-3">
                                    <div>
                                        <p class="text-sm font-medium text-foreground">
                                            {{ warning.title }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ warning.description }}
                                        </p>
                                    </div>
                                    <Badge :variant="warning.variant">
                                        Attention
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <div v-if="statusDialogShowsQuantity" class="grid gap-2">
                            <Label for="pha-status-quantity-dispensed">
                                {{
                                    statusDialogQuantityRequired
                                        ? 'Quantity Dispensed'
                                        : 'Quantity Dispensed (Optional)'
                                }}
                            </Label>
                            <Input
                                id="pha-status-quantity-dispensed"
                                v-model="statusDialogQuantityDispensed"
                                type="number"
                                min="0"
                                step="0.01"
                                :placeholder="
                                    statusDialogQuantityRequired
                                        ? 'Required'
                                        : 'Leave blank to use prescribed quantity'
                                "
                            />
                        </div>

                        <div
                            v-if="statusDialogShowsStructuredDispenseComposer"
                            class="space-y-3 rounded-lg border p-3"
                        >
                            <div class="space-y-1">
                                <p class="text-sm font-medium">
                                    Dispense workflow notes
                                </p>
                                <p class="text-xs text-muted-foreground">
                                    Keep the pharmacist release note structured while the server safety review carries allergy, interaction, recent lab-result, duplicate, and reconciliation context.
                                </p>
                            </div>

                                <div class="rounded-md border bg-background/70 p-3">
                                <div class="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p class="text-sm font-medium text-foreground">
                                            Server safety review
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            Pharmacy release uses current allergy, interaction, recent lab-result, active therapy, duplicate-order, and reconciliation context.
                                        </p>
                                    </div>
                                    <Badge
                                        v-if="statusDialogSafetyReview"
                                        :variant="
                                            pharmacySafetyReviewVariant(
                                                statusDialogSafetyReview.severity,
                                            )
                                        "
                                    >
                                        {{
                                            pharmacySafetyReviewLabel(
                                                statusDialogSafetyReview.severity,
                                            )
                                        }}
                                    </Badge>
                                </div>

                                <div
                                    v-if="statusDialogSafetyReviewLoading"
                                    class="mt-3 space-y-2"
                                >
                                    <Skeleton class="h-4 w-32 rounded-md" />
                                    <Skeleton class="h-12 w-full rounded-lg" />
                                </div>

                                <p
                                    v-else-if="statusDialogSafetyReviewError"
                                    class="mt-3 text-xs text-destructive"
                                >
                                    {{ statusDialogSafetyReviewError }}
                                </p>

                                <div
                                    v-else-if="statusDialogSafetyReview"
                                    class="mt-3 space-y-3"
                                >
                                    <div class="rounded-md border bg-background/80 px-3 py-3">
                                        <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                            <div>
                                                <p class="text-sm font-medium text-foreground">
                                                    Patient context used for safety rules
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    {{ medicationSafetyPatientContextHelper(statusDialogSafetyReview.patientContext) }}
                                                </p>
                                            </div>
                                            <Badge
                                                :variant="
                                                    statusDialogSafetyReview.patientContext?.isPediatric
                                                        ? 'secondary'
                                                        : 'outline'
                                                "
                                            >
                                                {{
                                                    statusDialogSafetyReview.patientContext?.isPediatric
                                                        ? 'Pediatric context'
                                                        : 'General context'
                                                }}
                                            </Badge>
                                        </div>
                                        <div class="mt-3 grid gap-2 sm:grid-cols-2">
                                            <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Age
                                                </p>
                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                    {{ medicationSafetyPatientAgeLabel(statusDialogSafetyReview.patientContext) }}
                                                </p>
                                            </div>
                                            <div class="rounded-md border bg-muted/20 px-3 py-2">
                                                <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Triage weight
                                                </p>
                                                <p class="mt-1 text-sm font-semibold text-foreground">
                                                    {{ medicationSafetyPatientWeightLabel(statusDialogSafetyReview.patientContext) }}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Allergy conflicts
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ statusDialogSafetyReview.allergyConflicts.length }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Active therapy matches
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{
                                                    statusDialogSafetyReview.activeProfileMatches.length +
                                                    statusDialogSafetyReview.matchingActiveOrders.length
                                                }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Interaction alerts
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ statusDialogSafetyReview.interactionConflicts.length }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Result alerts
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{ statusDialogSafetyReview.laboratorySignals.length }}
                                            </p>
                                        </div>
                                        <div class="rounded-md border bg-muted/20 px-3 py-2">
                                            <p class="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                                Reconciliation follow-up
                                            </p>
                                            <p class="mt-1 text-sm font-semibold text-foreground">
                                                {{
                                                    statusDialogSafetyReview.unreconciledReleasedOrders.length
                                                }}
                                            </p>
                                        </div>
                                    </div>

                                    <div
                                        v-if="statusDialogSafetyReview.ruleGroups.length"
                                        class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                                    >
                                        <div
                                            v-for="group in statusDialogSafetyReview.ruleGroups"
                                            :key="`status-dialog-safety-group-${group.key}`"
                                            class="rounded-md border bg-muted/20 px-3 py-3"
                                        >
                                            <div class="flex items-start justify-between gap-2">
                                                <div class="min-w-0">
                                                    <p class="text-sm font-medium text-foreground">
                                                        {{ group.label }}
                                                    </p>
                                                    <p class="mt-1 text-xs text-muted-foreground">
                                                        {{ medicationSafetyGroupSourceSummary(group) }}
                                                    </p>
                                                </div>
                                                <Badge :variant="medicationInteractionSeverityVariant(group.severity)">
                                                    {{ group.count }}
                                                </Badge>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="grid gap-3 sm:grid-cols-2">
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        v-model="statusDialogVerifyPrescription"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-input"
                                    />
                                    Prescription verified
                                </label>
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        v-model="statusDialogCounseledPatient"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-input"
                                    />
                                    Patient counseled
                                </label>
                            </div>

                            <div class="grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-2">
                                    <Label for="pha-status-batch-lot">
                                        Batch / Lot Number
                                    </Label>
                                    <Input
                                        id="pha-status-batch-lot"
                                        v-model="statusDialogBatchLotNumber"
                                        placeholder="Optional batch/lot"
                                    />
                                </div>
                                <div class="grid gap-2">
                                    <Label for="pha-status-expiry-date">
                                        Expiry Date
                                    </Label>
                                    <Input
                                        id="pha-status-expiry-date"
                                        v-model="statusDialogExpiryDate"
                                        type="date"
                                    />
                                </div>
                            </div>

                            <div class="space-y-2 rounded-md border p-3">
                                <label class="flex items-center gap-2 text-sm">
                                    <input
                                        v-model="statusDialogSubstitutionMade"
                                        type="checkbox"
                                        class="h-4 w-4 rounded border-input"
                                    />
                                    Substitution made
                                </label>
                                <div
                                    v-if="statusDialogSubstitutionMade"
                                    class="grid gap-2"
                                >
                                    <Label for="pha-status-substitution-note">
                                        Substitution Note
                                    </Label>
                                    <Input
                                        id="pha-status-substitution-note"
                                        v-model="statusDialogSubstitutionNote"
                                        placeholder="Brand/generic change or reason"
                                    />
                                </div>
                            </div>

                            <div class="grid gap-2">
                                <Label for="pha-status-follow-up-advice">
                                    Counseling / Follow-up Advice
                                </Label>
                                <Textarea
                                    id="pha-status-follow-up-advice"
                                    v-model="statusDialogFollowUpAdvice"
                                    class="min-h-20"
                                    placeholder="Optional counseling points or follow-up instructions"
                                />
                            </div>

                            <div class="space-y-2 rounded-md border p-3">
                                <div
                                    class="flex flex-wrap items-center justify-between gap-2"
                                >
                                    <p class="text-sm font-medium">
                                        Generated Summary Preview
                                    </p>
                                    <div class="flex flex-wrap gap-2">
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            @click="
                                                applyStructuredDispenseSummaryToNotes(
                                                    'replace',
                                                )
                                            "
                                        >
                                            Use as Notes
                                        </Button>
                                        <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            @click="
                                                applyStructuredDispenseSummaryToNotes(
                                                    'append',
                                                )
                                            "
                                        >
                                            Append to Notes
                                        </Button>
                                    </div>
                                </div>
                                <pre
                                    class="whitespace-pre-wrap break-words rounded-md bg-muted p-2 text-xs text-muted-foreground"
                                >{{ statusDialogStructuredDispenseSummary || 'Fill the fields above to generate a structured dispensing note summary.' }}</pre>
                            </div>
                        </div>

                        <div v-if="statusDialogNeedsReason" class="grid gap-2">
                            <Label for="pha-status-reason">Cancellation Reason</Label>
                            <Textarea
                                id="pha-status-reason"
                                v-model="statusDialogReason"
                                class="min-h-24"
                                placeholder="Required cancellation reason"
                            />
                        </div>

                        <Alert
                            v-if="
                                statusDialogNeedsVerificationNote &&
                                statusDialogSubstitutionVerificationNoteRequired
                            "
                            variant="destructive"
                        >
                            <AlertTitle>Verification note required</AlertTitle>
                            <AlertDescription>
                                This release is for the substitute medicine, not
                                the originally ordered one. Add a verification
                                note before verifying the release.
                            </AlertDescription>
                        </Alert>

                        <div
                            v-if="statusDialogNeedsVerificationNote"
                            class="grid gap-2"
                        >
                            <Label for="pha-status-verification-note">
                                {{
                                    statusDialogSubstitutionVerificationNoteRequired
                                        ? 'Verification Note (Required)'
                                        : 'Verification Note (Optional)'
                                }}
                            </Label>
                            <Textarea
                                id="pha-status-verification-note"
                                v-model="statusDialogVerificationNote"
                                class="min-h-24"
                                :placeholder="
                                    statusDialogSubstitutionVerificationNoteRequired
                                        ? 'Required verification note for substitution dispense'
                                        : 'Release review note or pharmacist verification remarks'
                                "
                            />
                        </div>

                        <div v-if="statusDialogShowsNotes" class="grid gap-2">
                            <Label for="pha-status-dispensing-notes">
                                {{
                                    statusDialogAction === 'in_preparation'
                                        ? 'Preparation Note (Optional)'
                                        : statusDialogAction === 'cancelled'
                                          ? 'Cancellation Note (Optional)'
                                          : 'Dispensing Notes (Optional)'
                                }}
                            </Label>
                            <Textarea
                                id="pha-status-dispensing-notes"
                                v-model="statusDialogDispensingNotes"
                                class="min-h-24"
                                placeholder="Optional notes"
                            />
                        </div>

                        <Alert v-if="statusDialogError" variant="destructive">
                            <AlertTitle>Action validation</AlertTitle>
                            <AlertDescription>{{ statusDialogError }}</AlertDescription>
                        </Alert>
                    </div>

                    <DialogFooter class="sticky bottom-0 z-10 shrink-0 border-t bg-background px-6 py-4">
                        <Button
                            variant="outline"
                            :disabled="Boolean(actionLoadingId)"
                            @click="closeOrderStatusDialog"
                        >
                            Cancel
                        </Button>
                        <Button
                            :variant="statusDialogAction === 'cancelled' ? 'destructive' : 'default'"
                            :disabled="Boolean(actionLoadingId)"
                            @click="submitOrderStatusDialog"
                        >
                            {{
                                actionLoadingId
                                    ? 'Updating...'
                                    : statusDialogActionButtonLabel
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog
                :open="createMedicationSafetyReviewDialogOpen"
                @update:open="
                    (open) =>
                        open
                            ? (createMedicationSafetyReviewDialogOpen = true)
                            : closeCreateMedicationSafetyReviewDialog(null)
                "
            >
                <DialogContent variant="workspace" size="6xl">
                    <DialogHeader class="shrink-0 border-b px-6 py-4">
                        <DialogTitle>
                            {{ createMedicationSafetyReviewTitle }}
                        </DialogTitle>
                        <DialogDescription>
                            Review patient-aware medication safety findings for
                            <span class="font-medium text-foreground">
                                {{ createMedicationSafetyReviewContextLabel }}
                            </span>
                            before this order becomes active.
                        </DialogDescription>
                    </DialogHeader>

                    <div
                        v-if="createMedicationSafetyReviewSummary"
                        class="min-h-0 flex-1 overflow-y-auto px-6 py-4"
                    >
                        <div class="space-y-4">
                        <div class="rounded-lg border px-3 py-3">
                        <div class="flex flex-wrap items-center gap-2">
                            <Badge
                                :variant="
                                    pharmacySafetyReviewVariant(
                                        createMedicationSafetyReviewSummary.severity,
                                    )
                                "
                            >
                                {{
                                    pharmacySafetyReviewLabel(
                                        createMedicationSafetyReviewSummary.severity,
                                    )
                                }}
                            </Badge>
                            <Badge
                                v-if="
                                    createMedicationSafetyReviewSummary.blockers.length >
                                    0
                                "
                                variant="destructive"
                            >
                                {{
                                    createMedicationSafetyReviewSummary.blockers.length
                                }}
                                blocker{{
                                    createMedicationSafetyReviewSummary.blockers.length ===
                                    1
                                        ? ''
                                        : 's'
                                }}
                            </Badge>
                            <Badge
                                v-if="
                                    createMedicationSafetyReviewSummary.warnings.length >
                                    0
                                "
                                variant="secondary"
                            >
                                {{
                                    createMedicationSafetyReviewSummary.warnings.length
                                }}
                                warning{{
                                    createMedicationSafetyReviewSummary.warnings.length ===
                                    1
                                        ? ''
                                        : 's'
                                }}
                            </Badge>
                        </div>
                        </div>

                        <Tabs v-model="createMedicationSafetyReviewTab" class="space-y-4">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-muted/20 p-1 sm:grid-cols-3">
                                <TabsTrigger value="summary">Summary</TabsTrigger>
                                <TabsTrigger value="clinical">Clinical context</TabsTrigger>
                                <TabsTrigger value="actions">Action</TabsTrigger>
                            </TabsList>

                            <TabsContent value="summary" class="mt-0 space-y-4">

                        <Alert
                            v-if="
                                createMedicationSafetyReviewSummary.blockers.length > 0
                            "
                            variant="destructive"
                        >
                            <AlertTitle>Safety blockers</AlertTitle>
                            <AlertDescription>
                                <ul class="mt-2 space-y-1">
                                    <li
                                        v-for="(item, index) in createMedicationSafetyReviewSummary.blockers"
                                        :key="`create-safety-review-blocker-${index}`"
                                    >
                                        {{ item }}
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>

                        <Alert
                            v-if="
                                createMedicationSafetyReviewSummary.warnings.length > 0
                            "
                            class="border-amber-500/40 bg-amber-500/5"
                        >
                            <AlertTitle>Warnings to acknowledge</AlertTitle>
                            <AlertDescription>
                                <ul class="mt-2 space-y-1">
                                    <li
                                        v-for="(item, index) in createMedicationSafetyReviewSummary.warnings"
                                        :key="`create-safety-review-warning-${index}`"
                                    >
                                        {{ item }}
                                    </li>
                                </ul>
                            </AlertDescription>
                        </Alert>

                        <div
                            v-if="createMedicationSafetyReviewSummary.ruleGroups.length > 0"
                            class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3"
                        >
                            <div
                                v-for="group in createMedicationSafetyReviewSummary.ruleGroups"
                                :key="`create-safety-review-group-${group.key}`"
                                class="rounded-lg border px-3 py-3"
                            >
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <p class="text-sm font-medium text-foreground">
                                            {{ group.label }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ medicationSafetyGroupSourceSummary(group) }}
                                        </p>
                                    </div>
                                    <Badge :variant="medicationInteractionSeverityVariant(group.severity)">
                                        {{ group.count }}
                                    </Badge>
                                </div>
                            </div>
                        </div>

                        <Alert
                            v-if="
                                createMedicationSafetyReviewSummary.policyRecommendation
                            "
                            :variant="
                                createMedicationSafetyReviewSummary
                                    .policyRecommendation.severity === 'warning'
                                    ? 'secondary'
                                    : 'outline'
                            "
                        >
                            <AlertTitle>
                                {{
                                    createMedicationSafetyReviewSummary
                                        .policyRecommendation.title
                                }}
                            </AlertTitle>
                            <AlertDescription class="space-y-3">
                                <p class="text-sm leading-5 text-foreground/90">
                                    {{
                                        createMedicationSafetyReviewSummary
                                            .policyRecommendation.summary
                                    }}
                                </p>
                                <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                    <span>Recommended decision</span>
                                    <Badge variant="outline" class="bg-background/70">
                                        {{
                                            approvedMedicineDecisionLabel(
                                                createMedicationSafetyReviewSummary
                                                    .policyRecommendation
                                                    .suggestedDecisionStatus,
                                            )
                                        }}
                                    </Badge>
                                </div>
                                <div
                                    v-if="
                                        createMedicationSafetyReviewSummary
                                            .policyRecommendation
                                            .preferredAlternatives.length > 0
                                    "
                                    class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                >
                                    <span>Preferred alternatives</span>
                                    <span class="font-medium text-foreground">
                                        {{
                                            createMedicationSafetyReviewSummary
                                                .policyRecommendation
                                                .preferredAlternatives.join(', ')
                                        }}
                                    </span>
                                </div>
                            </AlertDescription>
                        </Alert>

                        <div
                            v-if="createMedicationSafetyReviewSummary.rules.length > 0"
                            class="rounded-lg border px-3 py-3"
                        >
                            <div class="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                    <p class="text-sm font-medium text-foreground">
                                        Rule sources in this review
                                    </p>
                                    <p class="text-xs text-muted-foreground">
                                        The safety engine groups these findings from patient history, active therapy, approved-medicine policy, and recent results.
                                    </p>
                                </div>
                                <Badge variant="outline">
                                    {{ createMedicationSafetyReviewSummary.rules.length }} rules
                                </Badge>
                            </div>
                            <div class="mt-3 space-y-2">
                                <div
                                    v-for="rule in createMedicationSafetyReviewSummary.rules"
                                    :key="`create-safety-rule-${rule.code}`"
                                    class="rounded-md border bg-muted/20 px-3 py-3"
                                >
                                    <div class="flex flex-wrap items-center gap-2">
                                        <Badge :variant="medicationInteractionSeverityVariant(rule.severity)">
                                            {{ formatEnumLabel(rule.severity || 'warning') }}
                                        </Badge>
                                        <Badge variant="outline">
                                            {{ rule.categoryLabel || formatEnumLabel(rule.category || 'safety') }}
                                        </Badge>
                                        <Badge variant="outline">
                                            {{ medicationSafetyRuleSourceLabel(rule) }}
                                        </Badge>
                                    </div>
                                    <p class="mt-2 text-sm text-foreground">
                                        {{ rule.message }}
                                    </p>
                                    <p
                                        v-if="medicationSafetyRuleSourceDetail(rule)"
                                        class="mt-1 text-xs text-muted-foreground"
                                    >
                                        {{ medicationSafetyRuleSourceDetail(rule) }}
                                    </p>
                                    <p
                                        v-if="rule.suggestedAction"
                                        class="mt-1 text-xs text-muted-foreground"
                                    >
                                        Action: {{ rule.suggestedAction }}
                                    </p>
                                </div>
                            </div>
                        </div>

                            </TabsContent>

                            <TabsContent value="clinical" class="mt-0 space-y-4">

                        <div class="grid gap-3 sm:grid-cols-2">
                            <div
                                v-if="
                                    createMedicationSafetyReviewSummary.allergyConflicts.length >
                                    0
                                "
                                class="rounded-lg border px-3 py-3"
                            >
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Allergy conflicts
                                </p>
                                <div class="mt-2 space-y-2">
                                    <div
                                        v-for="allergy in createMedicationSafetyReviewSummary.allergyConflicts"
                                        :key="allergy.id"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ allergy.substanceName || 'Allergy entry' }}
                                            </p>
                                            <Badge
                                                :variant="
                                                    patientAllergySeverityVariant(
                                                        allergy.severity,
                                                    )
                                                "
                                            >
                                                {{
                                                    formatEnumLabel(
                                                        allergy.severity || 'unknown',
                                                    )
                                                }}
                                            </Badge>
                                        </div>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ allergy.reaction || 'Reaction not recorded' }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-if="
                                    createMedicationSafetyReviewSummary.activeProfileMatches.length >
                                        0 ||
                                    createMedicationSafetyReviewSummary.matchingActiveOrders.length >
                                        0
                                "
                                class="rounded-lg border px-3 py-3"
                            >
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Active therapy context
                                </p>
                                <div class="mt-2 space-y-2">
                                    <div
                                        v-for="profile in createMedicationSafetyReviewSummary.activeProfileMatches"
                                        :key="profile.id"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <p class="text-sm font-medium text-foreground">
                                            {{ profile.medicationName || 'Medication profile' }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ medicationProfileSummary(profile) }}
                                        </p>
                                    </div>
                                    <div
                                        v-for="order in createMedicationSafetyReviewSummary.matchingActiveOrders"
                                        :key="order.id"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ order.orderNumber || 'Active order' }}
                                            </p>
                                            <Badge :variant="statusVariant(order.status)">
                                                {{ formatEnumLabel(order.status || 'pending') }}
                                            </Badge>
                                        </div>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ order.medicationName || order.medicationCode || 'Medication' }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-if="
                                    createMedicationSafetyReviewSummary.interactionConflicts.length >
                                    0
                                "
                                class="rounded-lg border px-3 py-3"
                            >
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Interaction alerts
                                </p>
                                <div class="mt-2 space-y-2">
                                    <div
                                        v-for="conflict in createMedicationSafetyReviewSummary.interactionConflicts"
                                        :key="`${conflict.ruleCode}-${conflict.interactingMedicationCode || conflict.interactingMedicationName || 'interaction'}`"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ medicationInteractionLabel(conflict) }}
                                            </p>
                                            <Badge :variant="medicationInteractionSeverityVariant(conflict.severity)">
                                                {{ formatEnumLabel(conflict.severity || 'warning') }}
                                            </Badge>
                                            <Badge variant="outline">
                                                {{ conflict.sourceLabel || 'Current therapy' }}
                                            </Badge>
                                        </div>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ conflict.message }}
                                        </p>
                                        <p
                                            v-if="conflict.clinicalEffect"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Effect: {{ conflict.clinicalEffect }}
                                        </p>
                                        <p
                                            v-if="conflict.recommendedAction"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Action: {{ conflict.recommendedAction }}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div
                                v-if="
                                    createMedicationSafetyReviewSummary.laboratorySignals.length >
                                    0
                                "
                                class="rounded-lg border px-3 py-3"
                            >
                                <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                    Recent lab-result alerts
                                </p>
                                <div class="mt-2 space-y-2">
                                    <div
                                        v-for="signal in createMedicationSafetyReviewSummary.laboratorySignals"
                                        :key="`${signal.ruleCode}-${signal.sourceOrderId || signal.sourceTestCode || 'lab'}`"
                                        class="rounded-md border bg-muted/20 px-3 py-2"
                                    >
                                        <div class="flex flex-wrap items-center gap-2">
                                            <p class="text-sm font-medium text-foreground">
                                                {{ medicationLaboratorySignalLabel(signal) }}
                                            </p>
                                            <Badge :variant="medicationInteractionSeverityVariant(signal.severity)">
                                                {{ formatEnumLabel(signal.severity || 'warning') }}
                                            </Badge>
                                            <Badge
                                                v-if="signal.sourceFlag"
                                                variant="outline"
                                            >
                                                {{ formatEnumLabel(signal.sourceFlag) }}
                                            </Badge>
                                        </div>
                                        <p
                                            v-if="signal.sourceVerifiedAt"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Verified {{ formatDateTime(signal.sourceVerifiedAt) }}
                                        </p>
                                        <p class="mt-1 text-xs text-muted-foreground">
                                            {{ signal.message }}
                                        </p>
                                        <p
                                            v-if="signal.sourceResultSummary"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            {{ signal.sourceResultSummary }}
                                        </p>
                                        <p
                                            v-if="signal.clinicalEffect"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Effect: {{ signal.clinicalEffect }}
                                        </p>
                                        <p
                                            v-if="signal.recommendedAction"
                                            class="mt-1 text-xs text-muted-foreground"
                                        >
                                            Action: {{ signal.recommendedAction }}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div
                            v-if="
                                createMedicationSafetyReviewSummary.unreconciledDispensedOrders.length >
                                0
                            "
                            class="rounded-lg border px-3 py-3"
                        >
                            <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                                Reconciliation follow-up still open
                            </p>
                            <div class="mt-2 space-y-2">
                                <div
                                    v-for="order in createMedicationSafetyReviewSummary.unreconciledDispensedOrders"
                                    :key="order.id"
                                    class="rounded-md border bg-muted/20 px-3 py-2"
                                >
                                    <div class="flex flex-wrap items-center gap-2">
                                        <p class="text-sm font-medium text-foreground">
                                            {{ order.orderNumber || 'Dispensed order' }}
                                        </p>
                                        <Badge :variant="statusVariant(order.status)">
                                            {{ formatEnumLabel(order.status || 'dispensed') }}
                                        </Badge>
                                    </div>
                                    <p class="mt-1 text-xs text-muted-foreground">
                                        {{ order.medicationName || order.medicationCode || 'Medication' }}
                                    </p>
                                </div>
                            </div>
                        </div>

                            </TabsContent>

                            <TabsContent value="actions" class="mt-0 space-y-4">

                        <label
                            v-if="
                                createMedicationSafetyReviewSummary.warnings.length > 0
                            "
                            class="flex items-start gap-2 rounded-lg border px-3 py-3 text-sm"
                        >
                            <input
                                v-model="createMedicationSafetyReviewAcknowledged"
                                type="checkbox"
                                class="mt-0.5 h-4 w-4 rounded border-input"
                            />
                            <span class="space-y-1">
                                <span class="block font-medium text-foreground">
                                    I reviewed the medication safety warnings
                                </span>
                                <span class="block text-xs text-muted-foreground">
                                    Continue only if the therapy decision is still clinically appropriate.
                                </span>
                            </span>
                        </label>

                        <div
                            v-if="
                                createMedicationSafetyReviewSummary.blockers.length > 0
                            "
                            class="grid gap-2"
                        >
                            <Label for="pha-create-safety-override-code">
                                Override category
                            </Label>
                            <Select
                                v-model="createMedicationSafetyReviewOverrideCode"
                            >
                                <SelectTrigger id="pha-create-safety-override-code">
                                    <SelectValue placeholder="Select override category" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem
                                        v-for="option in createMedicationSafetyReviewSummary.overrideOptions"
                                        :key="option.code"
                                        :value="option.code"
                                    >
                                        {{ option.label }}
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                            <p
                                v-if="createMedicationSafetySelectedOverrideOption"
                                class="text-xs text-muted-foreground"
                            >
                                {{
                                    createMedicationSafetySelectedOverrideOption.description
                                }}
                            </p>
                            <Label for="pha-create-safety-override-reason">
                                Clinical explanation
                            </Label>
                            <Textarea
                                id="pha-create-safety-override-reason"
                                v-model="createMedicationSafetyReviewOverrideReason"
                                rows="3"
                                placeholder="Document the clinical rationale for proceeding despite the active blocker."
                            />
                        </div>

                        <p
                            v-if="
                                createMedicationSafetyReviewSummary.suggestedActions.length > 0
                            "
                            class="text-xs text-muted-foreground"
                        >
                            {{
                                createMedicationSafetyReviewSummary.suggestedActions[0]
                            }}
                        </p>

                        <Alert
                            v-if="createMedicationSafetyReviewError"
                            variant="destructive"
                        >
                            <AlertTitle>Safety review required</AlertTitle>
                            <AlertDescription>
                                {{ createMedicationSafetyReviewError }}
                            </AlertDescription>
                        </Alert>
                            </TabsContent>
                        </Tabs>
                    </div>
                    </div>

                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button
                            variant="outline"
                            @click="closeCreateMedicationSafetyReviewDialog(null)"
                        >
                            Cancel
                        </Button>
                        <Button @click="confirmCreateMedicationSafetyReview">
                            Continue with medication review
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="policyDialogOpen" @update:open="(open) => (open ? (policyDialogOpen = true) : closePolicyDialog())">
                <DialogContent variant="workspace" size="5xl">
                    <DialogHeader class="shrink-0 border-b px-6 py-4">
                        <DialogTitle>Approved Medicines Review</DialogTitle>
                        <DialogDescription>
                            Record whether this medication is within the approved medicines list (STG/NEMLIT) and whether substitution changed the dispense path.
                        </DialogDescription>
                    </DialogHeader>
                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-4">
                        <div v-if="policyDialogOrder" class="rounded-lg border p-3 text-xs text-muted-foreground">
                            <p>Order: <span class="font-medium text-foreground">{{ policyDialogOrder.orderNumber || 'Pharmacy Order' }}</span></p>
                            <p>Medication: <span class="font-medium text-foreground">{{ policyDialogOrder.medicationCode || 'N/A' }} - {{ policyDialogOrder.medicationName || 'N/A' }}</span></p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <Badge
                                    v-for="badge in policyDialogSummaryBadges"
                                    :key="`pha-policy-summary-${badge.id}`"
                                    :variant="badge.variant"
                                >
                                    {{ badge.label }}
                                </Badge>
                            </div>
                        </div>
                        <div v-if="policyDialogSafetyReviewLoading" class="grid gap-2">
                            <Skeleton class="h-20 w-full" />
                        </div>
                        <Alert
                            v-else-if="policyDialogSafetyReviewError"
                            variant="destructive"
                        >
                            <AlertTitle>Policy recommendation unavailable</AlertTitle>
                            <AlertDescription>
                                {{ policyDialogSafetyReviewError }}
                            </AlertDescription>
                        </Alert>
                        <Alert
                            v-else-if="policyDialogPolicyRecommendation"
                            :variant="policyDialogRecommendationAlertVariant"
                        >
                            <div class="col-start-2 min-w-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                                <div class="min-w-0 space-y-2">
                                    <p class="font-medium tracking-tight text-foreground">
                                        {{ policyDialogPolicyRecommendation.title }}
                                    </p>
                                    <div class="grid justify-items-start gap-2 text-sm text-muted-foreground [&_p]:leading-relaxed">
                                        <p class="text-sm leading-5 text-foreground/90">
                                            {{ policyDialogPolicyRecommendation.summary }}
                                        </p>
                                        <div class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                            <span>Suggested decision</span>
                                            <Badge variant="outline" class="bg-background/70">
                                                {{
                                                    approvedMedicineDecisionLabel(
                                                        policyDialogPolicyRecommendation.suggestedDecisionStatus,
                                                    )
                                                }}
                                            </Badge>
                                        </div>
                                        <div
                                            v-if="policyDialogPolicyRecommendation.preferredAlternatives.length > 0"
                                            class="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
                                        >
                                            <span>Preferred alternatives</span>
                                            <span class="font-medium text-foreground">
                                                {{
                                                    policyDialogPolicyRecommendation.preferredAlternatives.join(
                                                        ', ',
                                                    )
                                                }}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    class="w-full gap-1.5 xl:w-auto xl:shrink-0"
                                    :disabled="policyDialogRecommendationMatchesCurrentSelection"
                                    @click="applyPolicyRecommendation"
                                >
                                    Apply suggested path
                                </Button>
                            </div>
                        </Alert>
                        <Tabs v-model="policyDialogTab" class="space-y-4">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-muted/20 p-1 sm:grid-cols-3">
                                <TabsTrigger value="decision">Decision</TabsTrigger>
                                <TabsTrigger value="substitution">Substitution</TabsTrigger>
                                <TabsTrigger value="guidance">Guidance</TabsTrigger>
                            </TabsList>

                            <TabsContent value="decision" class="mt-0 space-y-4">
                                <div class="rounded-lg border p-4">
                                    <div class="mb-3">
                                        <p class="text-sm font-medium">Approved medicines decision</p>
                                        <p class="text-xs text-muted-foreground">
                                            Keep the STG/NEMLIT decision explicit before the dispense proceeds.
                                        </p>
                                    </div>
                                    <div class="grid gap-3 sm:grid-cols-2">
                                        <div class="grid gap-2">
                                            <Label for="pha-policy-formulary-status">Approved Medicines Decision</Label>
                                            <Select v-model="policyDialogForm.formularyDecisionStatus">
                                                <SelectTrigger id="pha-policy-formulary-status" class="w-full">
                                                    <SelectValue placeholder="Choose decision" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="not_reviewed">Not Reviewed</SelectItem>
                                                    <SelectItem value="formulary">Approved Medicine</SelectItem>
                                                    <SelectItem value="non_formulary">Outside Approved List</SelectItem>
                                                    <SelectItem value="restricted">Restricted Medicine</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="pha-policy-formulary-reason">
                                                {{
                                                    policyDialogEffectiveNeedsFormularyReason
                                                        ? 'Decision Reason (Required)'
                                                        : 'Decision Reason'
                                                }}
                                            </Label>
                                            <Input
                                                id="pha-policy-formulary-reason"
                                                v-model="policyDialogForm.formularyDecisionReason"
                                                :placeholder="
                                                    policyDialogEffectiveNeedsFormularyReason
                                                        ? 'Required for the selected or recommended policy decision'
                                                        : 'Optional policy note'
                                                "
                                            />
                                        </div>
                                    </div>
                                </div>
                            </TabsContent>

                            <TabsContent value="substitution" class="mt-0 space-y-4">
                                <div class="rounded-lg border p-4">
                            <div class="mb-3">
                                <p class="text-sm font-medium">Substitution decision</p>
                                <p class="text-xs text-muted-foreground">
                                    Record whether substitution is allowed and, if used, exactly what changed.
                                </p>
                            </div>
                            <div class="grid gap-3 sm:grid-cols-2">
                                <label class="flex items-center gap-2 rounded-lg border p-3 text-sm">
                                    <input v-model="policyDialogForm.substitutionAllowed" type="checkbox" class="h-4 w-4 rounded border-input" />
                                    Substitution allowed
                                </label>
                                <label class="flex items-center gap-2 rounded-lg border p-3 text-sm">
                                    <input v-model="policyDialogForm.substitutionMade" type="checkbox" class="h-4 w-4 rounded border-input" />
                                    Substitution made
                                </label>
                            </div>
                            <div v-if="policyDialogForm.substitutionMade" class="mt-3 grid gap-3 sm:grid-cols-2">
                                <div class="grid gap-3 sm:col-span-2">
                                    <div class="grid gap-2 sm:grid-cols-2">
                                        <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
                                            <input
                                                v-model="policyDialogForm.substitutionSelectionMode"
                                                type="radio"
                                                class="mt-0.5 h-4 w-4 border-input"
                                                value="approved"
                                            />
                                            <span class="space-y-1">
                                                <span class="block font-medium">
                                                    Approved medicine
                                                </span>
                                                <span class="block text-xs text-muted-foreground">
                                                    Select the substitute from the approved medicines list.
                                                </span>
                                            </span>
                                        </label>
                                        <label class="flex items-start gap-2 rounded-lg border p-3 text-sm">
                                            <input
                                                v-model="policyDialogForm.substitutionSelectionMode"
                                                type="radio"
                                                class="mt-0.5 h-4 w-4 border-input"
                                                value="outside_list"
                                            />
                                            <span class="space-y-1">
                                                <span class="block font-medium">
                                                    Outside approved list
                                                </span>
                                                <span class="block text-xs text-muted-foreground">
                                                    Use only when the substitute is a documented exception.
                                                </span>
                                            </span>
                                        </label>
                                    </div>

                                    <div
                                        v-if="!policyDialogUsesOutsideListOverride"
                                        class="grid gap-3"
                                    >
                                        <SearchableSelectField
                                            input-id="pha-policy-sub-approved-medicine"
                                            v-model="
                                                policyDialogForm.substitutedMedicationCatalogItemId
                                            "
                                            label="Substituted approved medicine"
                                            :options="
                                                createApprovedMedicineCatalogOptions
                                            "
                                            placeholder="Select approved substitute"
                                            search-placeholder="Search by medicine name, code, strength, dosage form, or category"
                                            helper-text="Select the approved substitute medicine. The stored code and name sync automatically."
                                            empty-text="No active approved medicine matched that search."
                                            :required="true"
                                            :disabled="
                                                approvedMedicinesCatalogLoading ||
                                                approvedMedicinesCatalogAccessBlocked
                                            "
                                        />

                                        <Alert
                                            v-if="
                                                approvedMedicinesCatalogAccessBlocked
                                            "
                                            class="border-amber-500/40 bg-amber-500/5"
                                        >
                                            <AlertTitle>
                                                Approved medicines picker unavailable
                                            </AlertTitle>
                                            <AlertDescription>
                                                This pharmacy account cannot open the approved medicines picker. Use the outside-list override only when this is a true exception.
                                            </AlertDescription>
                                        </Alert>

                                        <div
                                            v-else
                                            class="grid gap-2 lg:grid-cols-3"
                                        >
                                            <div class="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Substitute name
                                                </p>
                                                <p
                                                    class="mt-0.5 truncate text-sm font-medium text-foreground"
                                                    :title="
                                                        policyDialogForm.substitutedMedicationName ||
                                                        'Select an approved substitute'
                                                    "
                                                >
                                                    {{
                                                        policyDialogForm.substitutedMedicationName ||
                                                        'Select an approved substitute'
                                                    }}
                                                </p>
                                            </div>
                                            <div class="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Substitute code
                                                </p>
                                                <p
                                                    class="mt-0.5 truncate text-sm font-medium text-foreground"
                                                    :title="
                                                        policyDialogForm.substitutedMedicationCode ||
                                                        'Code will sync after selection'
                                                    "
                                                >
                                                    {{
                                                        policyDialogForm.substitutedMedicationCode ||
                                                        'Code will sync after selection'
                                                    }}
                                                </p>
                                            </div>
                                            <div class="min-w-0 rounded-md border bg-muted/20 px-3 py-2">
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Substitute profile
                                                </p>
                                                <div
                                                    v-if="
                                                        selectedPolicySubstitutionApprovedMedicineItem
                                                    "
                                                    class="mt-1 space-y-2"
                                                >
                                                    <div class="flex flex-wrap gap-1.5">
                                                        <Badge
                                                            v-if="
                                                                selectedPolicySubstitutionCategoryLabel
                                                            "
                                                            variant="secondary"
                                                        >
                                                            {{
                                                                selectedPolicySubstitutionCategoryLabel
                                                            }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="
                                                                selectedPolicySubstitutionDosageForm
                                                            "
                                                            variant="outline"
                                                        >
                                                            {{
                                                                selectedPolicySubstitutionDosageForm
                                                            }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="
                                                                selectedPolicySubstitutionStrength
                                                            "
                                                            variant="outline"
                                                        >
                                                            {{
                                                                selectedPolicySubstitutionStrength
                                                            }}
                                                        </Badge>
                                                        <Badge
                                                            v-if="
                                                                selectedPolicySubstitutionUnitLabel
                                                            "
                                                            variant="outline"
                                                        >
                                                            {{
                                                                selectedPolicySubstitutionUnitLabel
                                                            }}
                                                        </Badge>
                                                    </div>
                                                </div>
                                                <p
                                                    v-else
                                                    class="mt-1 text-xs text-muted-foreground"
                                                >
                                                    Profile appears after selection.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div
                                        v-else
                                        class="grid gap-3 sm:grid-cols-2"
                                    >
                                        <div class="grid gap-2">
                                            <Label for="pha-policy-sub-code">Substituted Medication Code</Label>
                                            <Input id="pha-policy-sub-code" v-model="policyDialogForm.substitutedMedicationCode" placeholder="ATC/code or local code" />
                                        </div>
                                        <div class="grid gap-2">
                                            <Label for="pha-policy-sub-name">Substituted Medication Name</Label>
                                            <Input id="pha-policy-sub-name" v-model="policyDialogForm.substitutedMedicationName" placeholder="Medication name" />
                                        </div>
                                    </div>

                                    <div
                                        v-if="
                                            policyDialogForm.substitutionMade &&
                                            (
                                                policyDialogForm.substitutedMedicationCode.trim() ||
                                                policyDialogForm.substitutedMedicationName.trim()
                                            )
                                        "
                                        class="rounded-md border bg-muted/20 p-3 sm:col-span-2"
                                    >
                                        <div
                                            class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
                                        >
                                            <div>
                                                <p class="text-sm font-medium">
                                                    Substitute stock
                                                </p>
                                                <p class="text-xs text-muted-foreground">
                                                    Confirm the substitute against inventory before saving the policy decision.
                                                </p>
                                            </div>
                                            <Badge
                                                v-if="
                                                    selectedPolicySubstitutionInventoryItem &&
                                                    !selectedPolicySubstitutionInventoryLoading
                                                "
                                                :variant="
                                                    inventoryStockStateVariant(
                                                        selectedPolicySubstitutionInventoryItem.stockState,
                                                    )
                                                "
                                            >
                                                {{
                                                    inventoryStockStateLabel(
                                                        selectedPolicySubstitutionInventoryItem.stockState,
                                                    )
                                                }}
                                            </Badge>
                                        </div>

                                        <div
                                            v-if="
                                                selectedPolicySubstitutionInventoryLoading
                                            "
                                            class="mt-3 grid gap-2 sm:grid-cols-3"
                                        >
                                            <Skeleton class="h-16 w-full" />
                                            <Skeleton class="h-16 w-full" />
                                            <Skeleton class="h-16 w-full" />
                                        </div>
                                        <Alert
                                            v-else-if="
                                                selectedPolicySubstitutionInventoryError
                                            "
                                            variant="destructive"
                                            class="mt-3"
                                        >
                                            <AlertTitle>
                                                Inventory stock unavailable
                                            </AlertTitle>
                                            <AlertDescription>
                                                {{
                                                    selectedPolicySubstitutionInventoryError
                                                }}
                                            </AlertDescription>
                                        </Alert>
                                        <div
                                            v-else-if="
                                                selectedPolicySubstitutionInventoryItem
                                            "
                                            class="mt-3 grid gap-2"
                                            :class="
                                                canReadInventoryProcurement
                                                    ? 'sm:grid-cols-3'
                                                    : 'sm:grid-cols-2'
                                            "
                                        >
                                            <div class="rounded-md border bg-background px-3 py-2">
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Inventory item
                                                </p>
                                                <p class="mt-0.5 text-sm font-medium text-foreground">
                                                    {{
                                                        inventoryItemDisplay(
                                                            selectedPolicySubstitutionInventoryItem,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                            <div class="rounded-md border bg-background px-3 py-2">
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    On hand
                                                </p>
                                                <p class="mt-0.5 text-sm font-medium text-foreground">
                                                    {{
                                                        inventoryStockQuantityLabel(
                                                            selectedPolicySubstitutionInventoryItem,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                            <div
                                                v-if="canReadInventoryProcurement"
                                                class="rounded-md border bg-background px-3 py-2"
                                            >
                                                <p class="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                                    Reorder / Max
                                                </p>
                                                <p class="mt-0.5 text-sm font-medium text-foreground">
                                                    {{
                                                        inventoryReorderLevelLabel(
                                                            selectedPolicySubstitutionInventoryItem,
                                                        )
                                                    }}
                                                    /
                                                    {{
                                                        inventoryMaxStockLabel(
                                                            selectedPolicySubstitutionInventoryItem,
                                                        )
                                                    }}
                                                </p>
                                            </div>
                                            <p
                                                class="text-xs text-muted-foreground"
                                                :class="
                                                    canReadInventoryProcurement
                                                        ? 'sm:col-span-3'
                                                        : 'sm:col-span-2'
                                                "
                                            >
                                                {{
                                                    inventoryStockHelperText(
                                                        selectedPolicySubstitutionInventoryItem,
                                                    )
                                                }}
                                            </p>
                                            <p
                                                v-if="!canReadInventoryProcurement"
                                                class="text-[11px] text-muted-foreground sm:col-span-2"
                                            >
                                                Detailed inventory controls stay in Pharmacy, but this stock snapshot is available during policy review.
                                            </p>
                                        </div>
                                        <div
                                            v-else
                                            class="mt-3 rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground"
                                        >
                                            No inventory item matched the substitute medicine in this facility scope.
                                        </div>
                                    </div>
                                </div>
                                <div class="grid gap-2 sm:col-span-2">
                                    <Label for="pha-policy-sub-reason">Substitution Reason</Label>
                                    <Textarea id="pha-policy-sub-reason" v-model="policyDialogForm.substitutionReason" rows="3" placeholder="Clinical, availability, or governance reason for substitution" />
                                </div>
                            </div>
                        </div>

                            </TabsContent>

                            <TabsContent value="guidance" class="mt-0 space-y-4">
                                <Alert
                                    v-if="
                                        policyDialogRequestedApprovedMedicineItem &&
                                        (
                                            policyDialogRequestedMedicineGovernance.reviewMode ===
                                                'policy_review_required' ||
                                            policyDialogRequestedMedicinePreferredAlternativesLabel
                                        )
                                    "
                                    :variant="
                                        policyDialogRequestedMedicineGovernance.reviewMode ===
                                        'policy_review_required'
                                            ? 'default'
                                            : 'secondary'
                                    "
                                >
                                    <AlertTitle>
                                        {{
                                            policyDialogRequestedMedicineGovernance.reviewMode ===
                                            'policy_review_required'
                                                ? 'Restricted-use policy guidance'
                                                : 'Preferred formulary guidance'
                                        }}
                                    </AlertTitle>
                                    <AlertDescription class="space-y-1">
                                        <p v-if="policyDialogRequestedMedicineGovernance.restrictionNote">
                                            {{
                                                policyDialogRequestedMedicineGovernance.restrictionNote
                                            }}
                                        </p>
                                        <p v-if="policyDialogRequestedMedicinePreferredAlternativesLabel">
                                            Preferred alternatives:
                                            <span class="font-medium text-foreground">
                                                {{
                                                    policyDialogRequestedMedicinePreferredAlternativesLabel
                                                }}
                                            </span>
                                        </p>
                                    </AlertDescription>
                                </Alert>
                                <Alert :variant="policyDialogGuidance.variant">
                                    <AlertTitle>{{ policyDialogGuidance.title }}</AlertTitle>
                                    <AlertDescription>{{ policyDialogGuidance.description }}</AlertDescription>
                                </Alert>
                                <div class="rounded-lg border bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
                                    <p class="font-medium text-foreground">Review focus</p>
                                    <p class="mt-1 leading-6">
                                        Keep the approved-medicines decision explicit, record any substitution clearly, and use this guidance section for restriction notes, preferred alternatives, and validation support before saving.
                                    </p>
                                </div>
                            </TabsContent>
                        </Tabs>
                        <Alert v-if="policyDialogError" variant="destructive">
                            <AlertTitle>Policy validation</AlertTitle>
                            <AlertDescription>{{ policyDialogError }}</AlertDescription>
                        </Alert>
                    </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button variant="outline" :disabled="Boolean(actionLoadingId)" @click="closePolicyDialog">Cancel</Button>
                        <Button :disabled="Boolean(actionLoadingId)" @click="submitPolicyDialog">
                            {{ actionLoadingId ? 'Saving...' : 'Save Policy' }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog :open="reconciliationDialogOpen" @update:open="(open) => (open ? (reconciliationDialogOpen = true) : closeReconciliationDialog())">
                <DialogContent variant="workspace" size="2xl" class="max-h-[88vh]">
                    <DialogHeader class="shrink-0 border-b px-6 py-4">
                        <DialogTitle>{{ reconciliationDialogTitle }}</DialogTitle>
                        <DialogDescription>
                            {{ reconciliationDialogDescription }}
                        </DialogDescription>
                    </DialogHeader>
                    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-4">
                    <div class="space-y-4">
                        <div v-if="reconciliationDialogOrder" class="rounded-lg border p-3 text-xs text-muted-foreground">
                            <p>Order: <span class="font-medium text-foreground">{{ reconciliationDialogOrder.orderNumber || 'Pharmacy Order' }}</span></p>
                            <p>Verified: <span class="font-medium text-foreground">{{ formatDateTime(reconciliationDialogOrder.verifiedAt) }}</span></p>
                            <div class="mt-3 flex flex-wrap gap-2">
                                <Badge
                                    v-for="badge in reconciliationDialogSummaryBadges"
                                    :key="'pha-reconciliation-badge-' + badge.id"
                                    :variant="badge.variant"
                                >
                                    {{ badge.label }}
                                </Badge>
                            </div>
                        </div>
                        <Tabs v-model="reconciliationDialogTab" class="space-y-4">
                            <TabsList class="grid h-auto w-full grid-cols-1 gap-1 rounded-lg bg-muted/20 p-1 sm:grid-cols-3">
                                <TabsTrigger value="status">Status</TabsTrigger>
                                <TabsTrigger value="outcome">Outcome</TabsTrigger>
                                <TabsTrigger value="notes">Notes</TabsTrigger>
                            </TabsList>
                            <TabsContent value="status" class="mt-0 space-y-4">
                                <div class="grid gap-2">
                                    <Label for="pha-recon-status">Reconciliation Status</Label>
                                    <Select v-model="reconciliationDialogForm.reconciliationStatus">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="completed">Completed</SelectItem>
                                        <SelectItem value="exception">Exception</SelectItem>
                                        <SelectItem value="pending">Pending</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                    {{ reconciliationDialogDecisionGuidance }}
                                </div>
                            </TabsContent>
                            <TabsContent value="outcome" class="mt-0 space-y-4">
                                <div v-if="reconciliationDialogDecisionRequired" class="grid gap-2">
                                    <Label for="pha-recon-decision">Reconciliation Outcome</Label>
                                    <Select v-model="reconciliationDialogForm.reconciliationDecision">
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                        <SelectItem value="">Select outcome</SelectItem>
                                        <SelectItem
                                            v-for="option in reconciliationDecisionOptions"
                                            :key="'pha-recon-decision-' + option.value"
                                            :value="option.value"
                                        >
                                            {{ option.label }}
                                        </SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <div class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                                        {{ reconciliationDialogDecisionGuidance }}
                                    </div>
                                </div>
                                <div
                                    v-else
                                    class="rounded-lg border bg-muted/20 px-3 py-3 text-sm text-muted-foreground"
                                >
                                    Outcome selection is only needed when reconciliation status is set to completed.
                                </div>
                            </TabsContent>
                            <TabsContent value="notes" class="mt-0 space-y-4">
                                <div class="grid gap-2">
                                    <Label for="pha-recon-note">{{ reconciliationDialogNoteLabel }}</Label>
                                    <Textarea
                                        id="pha-recon-note"
                                        v-model="reconciliationDialogForm.reconciliationNote"
                                        rows="3"
                                        :placeholder="reconciliationDialogNotePlaceholder"
                                    />
                                </div>
                            </TabsContent>
                        </Tabs>
                        <Alert v-if="reconciliationDialogError" variant="destructive">
                            <AlertTitle>Reconciliation validation</AlertTitle>
                            <AlertDescription>{{ reconciliationDialogError }}</AlertDescription>
                        </Alert>
                    </div>
                    </div>
                    <DialogFooter class="shrink-0 border-t bg-background px-6 py-4">
                        <Button variant="outline" :disabled="Boolean(actionLoadingId)" @click="closeReconciliationDialog">Cancel</Button>
                        <Button :disabled="Boolean(actionLoadingId)" @click="submitReconciliationDialog">
                            {{
                                actionLoadingId
                                    ? 'Saving...'
                                    : reconciliationDialogForm.reconciliationStatus === 'exception'
                                      ? 'Save Exception'
                                      : reconciliationDialogForm.reconciliationStatus === 'pending'
                                        ? 'Save Review Later'
                                      : 'Save Reconciliation'
                            }}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
            <LeaveWorkflowDialog
                :open="createLeaveConfirmOpen"
                :title="PHARMACY_CREATE_LEAVE_TITLE"
                :description="PHARMACY_CREATE_LEAVE_DESCRIPTION"
                stay-label="Stay on order"
                leave-label="Leave page"
                @update:open="(open) => (open ? (createLeaveConfirmOpen = true) : cancelPendingCreateWorkflowLeave())"
                @confirm="confirmPendingCreateWorkflowLeave"
            />
            <ConfirmationDialog
                :open="duplicateConfirmDialogState.open"
                :title="duplicateConfirmDialogState.title"
                :description="duplicateConfirmDialogState.description"
                :details="duplicateConfirmDialogState.details"
                :cancel-label="duplicateConfirmDialogState.cancelLabel"
                :confirm-label="duplicateConfirmDialogState.confirmLabel"
                :confirm-variant="duplicateConfirmDialogState.confirmVariant"
                :content-class="duplicateConfirmDialogState.contentClass"
                @update:open="updateDuplicateConfirmationDialogOpen"
                @confirm="confirmDuplicateDialogAction"
            />
    </AppLayout>
</template>

<style scoped>
@keyframes pharmacy-row-flash {
    0% { background-color: hsl(var(--primary) / 0.15); }
    100% { background-color: transparent; }
}
.animate-pharmacy-row-flash {
    animation: pharmacy-row-flash 1.5s ease-out;
}
</style>
