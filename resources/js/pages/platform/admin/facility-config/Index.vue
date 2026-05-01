
<script setup lang="ts">
import { Head } from '@inertiajs/vue3';
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import AppIcon from '@/components/AppIcon.vue';
import FormFieldShell from '@/components/forms/FormFieldShell.vue';
import SingleDatePopoverField from '@/components/forms/SingleDatePopoverField.vue';
import TimePopoverField from '@/components/forms/TimePopoverField.vue';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input, SearchInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePlatformAccess } from '@/composables/usePlatformAccess';
import { usePlatformCountryProfile } from '@/composables/usePlatformCountryProfile';
import AppLayout from '@/layouts/AppLayout.vue';
import type { AppIconName } from '@/lib/icons';
import { formatEnumLabel } from '@/lib/labels';
import { messageFromUnknown, notifyError, notifySuccess } from '@/lib/notify';
import { type BreadcrumbItem } from '@/types';

type Facility = {
  id: string | null; code: string | null; name: string | null; facilityType: string | null; timezone: string | null;
  facilityTier?: string | null;
  tenantCode: string | null; tenantName: string | null; tenantCountryCode: string | null; tenantAllowedCountryCodes: string[];
  status: 'active' | 'inactive' | null; statusReason: string | null;
  operationsOwnerUserId: number | null; clinicalOwnerUserId: number | null; administrativeOwnerUserId: number | null;
  operationsOwner?: PlatformUser | null; clinicalOwner?: PlatformUser | null; administrativeOwner?: PlatformUser | null;
  updatedAt: string | null;
};
type SubscriptionPlanEntitlement = {
  id: string | null;
  key: string | null;
  label: string | null;
  group: string | null;
  type: string | null;
  limitValue: number | null;
  enabled: boolean;
};
type SubscriptionPlan = {
  id: string;
  code: string | null;
  name: string | null;
  description: string | null;
  billingCycle: string | null;
  priceAmount: string | number | null;
  currencyCode: string | null;
  status: string | null;
  entitlements: SubscriptionPlanEntitlement[];
};
type FacilitySubscription = {
  id: string | null;
  facilityId: string | null;
  planId: string | null;
  plan: SubscriptionPlan | null;
  status: string | null;
  billingCycle: string | null;
  priceAmount: string | number | null;
  currencyCode: string | null;
  trialEndsAt: string | null;
  currentPeriodStartsAt: string | null;
  currentPeriodEndsAt: string | null;
  nextInvoiceAt: string | null;
  gracePeriodEndsAt: string | null;
  suspendedAt: string | null;
  cancellationEffectiveAt: string | null;
  statusReason: string | null;
  entitlementKeys: string[];
  accessEnabled: boolean;
  accessState: string | null;
  updatedAt: string | null;
};
type Pagination = { currentPage: number; perPage: number; total: number; lastPage: number };
type VError = { message?: string; errors?: Record<string, string[]> };
type AuditLog = {
  id: string; action: string | null; actionLabel?: string | null; createdAt: string | null;
  actorId: number | null; actorType?: 'system' | 'user' | null; actor?: { displayName?: string | null } | null;
  changes?: Record<string, unknown>;
};
type PlatformUser = {
  id: number | null;
  name: string | null;
  email: string | null;
  status: string | null;
  roles?: Array<{ id: string | null; code: string | null; name: string | null }>;
};
type FacilityAdminInviteMeta = {
  userId?: number | null;
  message?: string | null;
  previewUrl?: string | null;
  deliveryMode?: string | null;
};
type FacilityCreateResponse = {
  data: Facility;
  meta?: {
    facilityAdminUserId?: number | null;
    createdFacilityAdminUserId?: number | null;
    facilityAdminInvite?: FacilityAdminInviteMeta | null;
    facilityAdminInviteError?: string | null;
  };
};
type OwnerSlotKey = 'operationsOwnerUserId' | 'clinicalOwnerUserId' | 'administrativeOwnerUserId';
type OwnerSearchState = {
  query: string;
  candidates: PlatformUser[];
  loading: boolean;
  error: string | null;
  requestId: number;
  timer: number | null;
};
type OwnerSlot = {
  key: OwnerSlotKey;
  label: string;
  description: string;
  icon: AppIconName;
  searchPlaceholder: string;
};
type FacilityWorkspaceTab = 'profile' | 'subscription' | 'audit';
type SubscriptionDateTimeField = 'trialEndsAt' | 'currentPeriodStartsAt' | 'currentPeriodEndsAt' | 'nextInvoiceAt' | 'gracePeriodEndsAt';
type SubscriptionVisibilityTone = 'outline' | 'secondary' | 'destructive';

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Platform Admin', href: '/platform/admin/facility-config' },
  { title: 'Facility Configuration', href: '/platform/admin/facility-config' },
];
const SELECT_ALL_VALUE = '__all__';

const { permissionNames, permissionState } = usePlatformAccess();
const { countryProfileFullCatalog, loadCountryProfile } = usePlatformCountryProfile();
const permissionsResolved = computed(() => permissionNames.value !== null);
const canRead = computed(() => permissionState('platform.facilities.read') === 'allowed');
const canCreate = computed(() => permissionState('platform.facilities.create') === 'allowed');
const canUpdate = computed(() => permissionState('platform.facilities.update') === 'allowed');
const canUpdateStatus = computed(() => permissionState('platform.facilities.update-status') === 'allowed');
const canManageOwners = computed(() => permissionState('platform.facilities.manage-owners') === 'allowed');
const canManageSubscriptions = computed(() => permissionState('platform.facilities.manage-subscriptions') === 'allowed');
const canViewAudit = computed(() => permissionState('platform.facilities.view-audit-logs') === 'allowed');
const canReadUsers = computed(() => permissionState('platform.users.read') === 'allowed');

const loading = ref(true);
const listLoading = ref(false);
const listError = ref<string | null>(null);
const facilities = ref<Facility[]>([]);
const page = ref<Pagination | null>(null);
const filters = reactive({ q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc' as 'asc' | 'desc', perPage: 20, page: 1 });
const facilityFiltersSheetOpen = ref(false);
const ownerFilterSearch = ref('');
const ownerFilterCandidates = ref<PlatformUser[]>([]);
const ownerFilterUser = ref<PlatformUser | null>(null);
const ownerFilterLoading = ref(false);
const ownerFilterError = ref<string | null>(null);
let facilitySearchDebounceTimer: number | null = null;
let ownerFilterSearchDebounceTimer: number | null = null;
let ownerFilterSearchRequestId = 0;

const createOpen = ref(false);
const createSaving = ref(false);
const createErrors = ref<Record<string, string[]>>({});
const createAdminMode = ref<'select' | 'create'>('select');
const facilityAdminInviteNotice = ref<{ message: string; previewUrl: string | null; tone: 'success' | 'warning' } | null>(null);
const createForm = reactive({
  tenantCode: '',
  tenantName: '',
  tenantCountryCode: 'TZ',
  tenantAllowedCountryCodes: ['TZ'] as string[],
  facilityCode: '',
  facilityName: '',
  facilityType: '',
  facilityTier: '',
  timezone: 'Africa/Dar_es_Salaam',
  facilityAdminUserId: null as number | null,
});
const createAdminForm = reactive({ name: '', email: '' });
const adminSearch = ref('');
const adminCandidates = ref<PlatformUser[]>([]);
const adminCandidatesLoading = ref(false);
const adminCandidatesError = ref<string | null>(null);
let adminSearchDebounceTimer: number | null = null;
let adminSearchRequestId = 0;

const detailsOpen = ref(false);
const detailsLoading = ref(false);
const detailsError = ref<string | null>(null);
const detailsWorkspaceTab = ref<FacilityWorkspaceTab>('profile');
const selected = ref<Facility | null>(null);

const configForm = reactive({ code: '', name: '', facilityType: '', timezone: '' });
const tenantPolicyForm = reactive({ allowedCountryCodes: [] as string[] });
const statusForm = reactive({ status: 'active', reason: '' });
const subscriptionPlans = ref<SubscriptionPlan[]>([]);
const subscription = ref<FacilitySubscription | null>(null);
const subscriptionLoading = ref(false);
const subscriptionSaving = ref(false);
const subscriptionError = ref<string | null>(null);
const subscriptionErrors = ref<Record<string, string[]>>({});
const subscriptionForm = reactive({
  planId: '',
  status: 'trial',
  billingCycle: 'monthly',
  priceAmount: '',
  currencyCode: 'TZS',
  trialEndsAt: '',
  currentPeriodStartsAt: '',
  currentPeriodEndsAt: '',
  nextInvoiceAt: '',
  gracePeriodEndsAt: '',
  statusReason: '',
});
const ownerForm = reactive({ operationsOwnerUserId: '', clinicalOwnerUserId: '', administrativeOwnerUserId: '' });
const ownerSlots: OwnerSlot[] = [
  {
    key: 'operationsOwnerUserId',
    label: 'Operations owner',
    description: 'Accountable for front desk, billing handoffs, queues, and daily facility operations.',
    icon: 'clipboard-list',
    searchPlaceholder: 'Search operations lead',
  },
  {
    key: 'clinicalOwnerUserId',
    label: 'Clinical owner',
    description: 'Accountable for clinical governance, care workflows, and service readiness.',
    icon: 'stethoscope',
    searchPlaceholder: 'Search clinical lead',
  },
  {
    key: 'administrativeOwnerUserId',
    label: 'Facility admin',
    description: 'Accountable for local administration, user onboarding, and facility-level controls. Only eligible Facility Administrators are listed.',
    icon: 'shield-check',
    searchPlaceholder: 'Search eligible facility admin',
  },
];
const ownerUsers = reactive<Record<OwnerSlotKey, PlatformUser | null>>({
  operationsOwnerUserId: null,
  clinicalOwnerUserId: null,
  administrativeOwnerUserId: null,
});
const ownerSearchStates = reactive<Record<OwnerSlotKey, OwnerSearchState>>({
  operationsOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
  clinicalOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
  administrativeOwnerUserId: { query: '', candidates: [], loading: false, error: null, requestId: 0, timer: null },
});
const configErrors = ref<Record<string, string[]>>({});
const tenantPolicyErrors = ref<Record<string, string[]>>({});
const statusErrors = ref<Record<string, string[]>>({});
const ownerErrors = ref<Record<string, string[]>>({});
const configSaving = ref(false);
const tenantPolicySaving = ref(false);
const statusSaving = ref(false);
const ownersSaving = ref(false);

const auditLoading = ref(false);
const auditExporting = ref(false);
const auditError = ref<string | null>(null);
const audit = ref<AuditLog[]>([]);
const auditMeta = ref<Pagination | null>(null);
const auditFilters = reactive({ q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
const auditActorTypeSelectValue = computed({
  get: () => auditFilters.actorType || SELECT_ALL_VALUE,
  set: (value: string) => { auditFilters.actorType = fromSelectAllValue(value); },
});
const auditPerPageSelectValue = computed({
  get: () => String(auditFilters.perPage),
  set: (value: string) => {
    const parsed = Number.parseInt(value, 10);
    auditFilters.perPage = [10, 20, 50].includes(parsed) ? parsed : 20;
  },
});
const auditFromDate = computed({
  get: () => datePartFromDateTimeInput(auditFilters.from),
  set: (value: string) => {
    auditFilters.from = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.from), '00:00');
  },
});
const auditFromTime = computed({
  get: () => timePartFromDateTimeInput(auditFilters.from),
  set: (value: string) => {
    auditFilters.from = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.from), value, '00:00');
  },
});
const auditToDate = computed({
  get: () => datePartFromDateTimeInput(auditFilters.to),
  set: (value: string) => {
    auditFilters.to = mergeDateAndTimeInput(value, timePartFromDateTimeInput(auditFilters.to), '23:59');
  },
});
const auditToTime = computed({
  get: () => timePartFromDateTimeInput(auditFilters.to),
  set: (value: string) => {
    auditFilters.to = mergeDateAndTimeInput(datePartFromDateTimeInput(auditFilters.to), value, '23:59');
  },
});
const subscriptionStatusOptions = [
  { value: 'trial', label: 'Trial' },
  { value: 'active', label: 'Active' },
  { value: 'past_due', label: 'Past due' },
  { value: 'grace_period', label: 'Grace period' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'cancelled', label: 'Cancelled' },
];
const subscriptionAccessOpenStatuses = ['trial', 'active', 'grace_period'];
function firstError(e: Record<string, string[]> | null | undefined, k: string): string | null { return e?.[k]?.[0] ?? null; }
function csrfToken(): string | null { return document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content ?? null; }
function toApiDateTime(v: string): string | null { const t = v.trim(); if (!t) return null; const d = new Date(t); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
function fmt(v: string | null): string { if (!v) return 'N/A'; const d = new Date(v); return Number.isNaN(d.getTime()) ? v : d.toLocaleString('en-GB', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:false }); }
function vStatus(s: string | null): 'outline' | 'secondary' | 'destructive' { if (s === 'active') return 'secondary'; if (s === 'inactive') return 'destructive'; return 'outline'; }
function subscriptionStatusVariant(s: string | null): 'outline' | 'secondary' | 'destructive' {
  if (s === 'active' || s === 'trial' || s === 'grace_period') return 'secondary';
  if (s === 'past_due' || s === 'suspended' || s === 'cancelled') return 'destructive';
  return 'outline';
}
function isPastDateTimeInput(value: string): boolean {
  const apiValue = toApiDateTime(value);
  if (!apiValue) return false;

  const date = new Date(apiValue);
  return !Number.isNaN(date.getTime()) && date.getTime() < Date.now();
}
function actorLabel(l: AuditLog): string { return l.actor?.displayName?.trim() || (l.actorType === 'system' ? 'System' : l.actorId !== null ? `User #${l.actorId}` : 'Unknown actor'); }
function parseUid(v: string): number | null | 'invalid' { const t = v.trim(); if (!t) return null; const n = Number.parseInt(t, 10); return Number.isFinite(n) && n > 0 ? n : 'invalid'; }
function normalizeCountryCodes(v: string[]): string[] { return Array.from(new Set(v.map((x) => x.trim().toUpperCase()).filter(Boolean))); }
function setTenantPolicyCountryAllowed(code: string, checked: boolean): void {
  const normalizedCode = code.trim().toUpperCase();
  const nextCodes = checked
    ? [...tenantPolicyForm.allowedCountryCodes, normalizedCode]
    : tenantPolicyForm.allowedCountryCodes.filter((entry) => entry !== normalizedCode);
  const nextSet = new Set(normalizeCountryCodes(nextCodes));

  tenantPolicyForm.allowedCountryCodes = tenantCountryOptions.value.length
    ? tenantCountryOptions.value.filter((option) => nextSet.has(option.code)).map((option) => option.code)
    : Array.from(nextSet);
  tenantPolicyErrors.value = { ...tenantPolicyErrors.value, tenantAllowedCountryCodes: [], 'tenantAllowedCountryCodes.0': [] };
}
function countryOptionLabel(code: string | null | undefined, name: string | null | undefined): string {
  const normalizedCode = String(code ?? '').trim().toUpperCase();
  const normalizedName = String(name ?? '').trim();
  if (!normalizedCode) return normalizedName || 'Unknown country';
  return normalizedName ? `${normalizedCode} - ${normalizedName}` : normalizedCode;
}
function tenantCountryPolicySummary(facility: Facility): string {
  const baseCountry = String(facility.tenantCountryCode ?? '').trim().toUpperCase();
  const allowedCountries = normalizeCountryCodes(Array.isArray(facility.tenantAllowedCountryCodes) ? facility.tenantAllowedCountryCodes : []);

  if (allowedCountries.length === 0) return 'Global country policy';
  if (allowedCountries.length === 1 && allowedCountries[0] === baseCountry) return 'Base country only';

  return `Allowed profiles: ${allowedCountries.join(', ')}`;
}
function toDateTimeInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (part: number): string => String(part).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function splitSubscriptionDateTime(value: string): { date: string; time: string } {
  const normalized = value.trim().replace(' ', 'T');
  const [date = '', rawTime = ''] = normalized.split('T');
  const time = rawTime.match(/^(\d{2}):(\d{2})/)?.[0] ?? '';

  return {
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    time,
  };
}

function defaultSubscriptionTime(field: SubscriptionDateTimeField): string {
  if (field === 'nextInvoiceAt') return '08:00';
  if (field === 'currentPeriodStartsAt') return '00:00';

  return '23:59';
}

function subscriptionDatePart(field: SubscriptionDateTimeField): string {
  return splitSubscriptionDateTime(subscriptionForm[field]).date;
}

function subscriptionTimePart(field: SubscriptionDateTimeField): string {
  return splitSubscriptionDateTime(subscriptionForm[field]).time;
}

function datePartFromDateTimeInput(value: string): string {
  return splitSubscriptionDateTime(value).date;
}

function timePartFromDateTimeInput(value: string): string {
  return splitSubscriptionDateTime(value).time;
}

function mergeDateAndTimeInput(datePart: string, timePart: string, fallbackTime: string): string {
  const date = datePart.trim();
  if (!date) return '';

  const time = timePart.trim() || fallbackTime;
  return `${date}T${time}`;
}

function updateSubscriptionDatePart(field: SubscriptionDateTimeField, value: string): void {
  const date = value.trim();
  if (!date) {
    subscriptionForm[field] = '';
    return;
  }

  const time = subscriptionTimePart(field) || defaultSubscriptionTime(field);
  subscriptionForm[field] = `${date}T${time}`;
}

function updateSubscriptionTimePart(field: SubscriptionDateTimeField, value: string): void {
  const date = subscriptionDatePart(field);
  if (!date) return;

  const time = value.trim() || defaultSubscriptionTime(field);
  subscriptionForm[field] = `${date}T${time}`;
}

function moneyLabel(amount: string | number | null | undefined, currencyCode: string | null | undefined): string {
  if (amount === null || amount === undefined || amount === '') return 'Fee not set';
  const numeric = Number(amount);
  const currency = (currencyCode || 'TZS').toUpperCase();
  if (!Number.isFinite(numeric)) return `${currency} ${amount}`;

  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency }).format(numeric);
  } catch {
    return `${currency} ${numeric.toFixed(2)}`;
  }
}

const tenantCountryOptions = computed(() =>
  countryProfileFullCatalog.value
    .map((profile) => {
      const code = String(profile.code ?? '').trim().toUpperCase();
      if (!code) return null;
      return {
        code,
        label: countryOptionLabel(code, profile.name ?? null),
      };
    })
    .filter((option): option is { code: string; label: string } => option !== null),
);

const createCountryOptions = computed(() =>
  tenantCountryOptions.value.length > 0
    ? tenantCountryOptions.value
    : [
        { code: 'TZ', label: 'TZ - Tanzania' },
        { code: 'KE', label: 'KE - Kenya' },
        { code: 'UG', label: 'UG - Uganda' },
      ],
);

const selectedFacilityAdmin = computed(() =>
  adminCandidates.value.find((user) => user.id === createForm.facilityAdminUserId) ?? null,
);
const selectedSubscriptionPlan = computed(() =>
  subscriptionPlans.value.find((plan) => plan.id === subscriptionForm.planId)
    ?? subscription.value?.plan
    ?? null,
);
const selectedSubscriptionEntitlementKeys = computed(() =>
  new Set(
    (selectedSubscriptionPlan.value?.entitlements ?? [])
      .filter((entitlement) => entitlement.enabled && entitlement.key)
      .map((entitlement) => String(entitlement.key)),
  ),
);
const allSubscriptionEntitlements = computed(() => {
  const entitlements = new Map<string, SubscriptionPlanEntitlement>();

  subscriptionPlans.value.forEach((plan) => {
    plan.entitlements
      .filter((entitlement) => entitlement.enabled && entitlement.key)
      .forEach((entitlement) => {
        const key = String(entitlement.key);
        if (!entitlements.has(key)) {
          entitlements.set(key, entitlement);
        }
      });
  });

  return Array.from(entitlements.values()).sort((a, b) =>
    String(a.group ?? '').localeCompare(String(b.group ?? ''))
      || String(a.label ?? a.key ?? '').localeCompare(String(b.label ?? b.key ?? '')),
  );
});
const enabledAccessEntitlements = computed(() =>
  (selectedSubscriptionPlan.value?.entitlements ?? []).filter((entitlement) => entitlement.enabled),
);
const restrictedAccessEntitlements = computed(() =>
  allSubscriptionEntitlements.value.filter((entitlement) =>
    entitlement.key ? !selectedSubscriptionEntitlementKeys.value.has(String(entitlement.key)) : false,
  ),
);
const subscriptionDraftExpired = computed(() => {
  if (subscriptionForm.status === 'trial') return isPastDateTimeInput(subscriptionForm.trialEndsAt);
  if (subscriptionForm.status === 'grace_period') return isPastDateTimeInput(subscriptionForm.gracePeriodEndsAt);
  if (subscriptionForm.status === 'active') return isPastDateTimeInput(subscriptionForm.currentPeriodEndsAt);

  return false;
});
const subscriptionDraftAccessEnabled = computed(() =>
  Boolean(subscriptionForm.planId)
  && subscriptionAccessOpenStatuses.includes(subscriptionForm.status)
  && !subscriptionDraftExpired.value,
);
const subscriptionDraftAccessState = computed(() => {
  if (!subscriptionForm.planId) return 'not_configured';
  if (subscriptionDraftAccessEnabled.value) return 'enabled';
  if (subscriptionDraftExpired.value && subscriptionAccessOpenStatuses.includes(subscriptionForm.status)) return 'expired';
  if (['past_due', 'suspended', 'cancelled'].includes(subscriptionForm.status)) return 'restricted';

  return 'pending';
});
const subscriptionCoveragePercent = computed(() => {
  const total = allSubscriptionEntitlements.value.length;
  if (total === 0) return 0;

  return Math.round((enabledAccessEntitlements.value.length / total) * 100);
});
const subscriptionAccessSummary = computed(() => {
  if (!subscriptionForm.planId) {
    return {
      label: 'Not configured',
      tone: 'outline' as SubscriptionVisibilityTone,
      description: 'Assign a service plan before live facility testing.',
    };
  }

  if (subscriptionDraftAccessEnabled.value) {
    return {
      label: 'Access enabled',
      tone: 'secondary' as SubscriptionVisibilityTone,
      description: 'Allowed modules will be open for this facility after saving.',
    };
  }

  return {
    label: formatEnumLabel(subscriptionDraftAccessState.value),
    tone: (['expired', 'restricted'].includes(subscriptionDraftAccessState.value) ? 'destructive' : 'outline') as SubscriptionVisibilityTone,
    description: subscriptionDraftAccessState.value === 'expired'
      ? 'The selected access period has expired.'
      : 'Subscription state is restricting service access.',
  };
});
const subscriptionRenewalRisk = computed(() => {
  const status = subscriptionForm.status;

  if (!subscriptionForm.planId) {
    return {
      label: 'No plan',
      tone: 'outline' as SubscriptionVisibilityTone,
      description: 'Plan assignment is required.',
    };
  }

  if (['past_due', 'suspended', 'cancelled'].includes(status)) {
    return {
      label: formatEnumLabel(status),
      tone: 'destructive' as SubscriptionVisibilityTone,
      description: 'Access is restricted or requires billing action.',
    };
  }

  const graceDays = daysUntil(subscriptionForm.gracePeriodEndsAt);
  if (status === 'grace_period') {
    return {
      label: graceDays !== null && graceDays >= 0 ? `Grace ${dateDistanceLabel(subscriptionForm.gracePeriodEndsAt)}` : 'Grace expired',
      tone: (graceDays !== null && graceDays >= 0 ? 'outline' : 'destructive') as SubscriptionVisibilityTone,
      description: 'Resolve payment before grace ends.',
    };
  }

  const periodDays = daysUntil(subscriptionForm.currentPeriodEndsAt);
  if (periodDays !== null && periodDays < 0) {
    return {
      label: 'Period expired',
      tone: 'destructive' as SubscriptionVisibilityTone,
      description: 'Renewal is overdue.',
    };
  }
  if (periodDays !== null && periodDays <= 7) {
    return {
      label: `Renews ${dateDistanceLabel(subscriptionForm.currentPeriodEndsAt)}`,
      tone: 'outline' as SubscriptionVisibilityTone,
      description: 'Renewal is near.',
    };
  }

  const trialDays = daysUntil(subscriptionForm.trialEndsAt);
  if (status === 'trial' && trialDays !== null && trialDays <= 7) {
    return {
      label: `Trial ${dateDistanceLabel(subscriptionForm.trialEndsAt)}`,
      tone: 'outline' as SubscriptionVisibilityTone,
      description: 'Trial conversion should be prepared.',
    };
  }

  return {
    label: 'Healthy',
    tone: 'secondary' as SubscriptionVisibilityTone,
    description: 'No immediate subscription risk.',
  };
});
const subscriptionTimeline = computed(() => [
  { label: 'Trial ends', value: subscriptionForm.trialEndsAt },
  { label: 'Period starts', value: subscriptionForm.currentPeriodStartsAt },
  { label: 'Period ends', value: subscriptionForm.currentPeriodEndsAt },
  { label: 'Next invoice', value: subscriptionForm.nextInvoiceAt },
  { label: 'Grace ends', value: subscriptionForm.gracePeriodEndsAt },
]);

const facilityTypeOptions = [
  { value: 'hospital', label: 'Hospital' },
  { value: 'dispensary', label: 'Dispensary' },
  { value: 'clinic', label: 'Clinic' },
  { value: 'diagnostic_center', label: 'Diagnostic center' },
];

function ownerRelationKey(slotKey: OwnerSlotKey): 'operationsOwner' | 'clinicalOwner' | 'administrativeOwner' {
  if (slotKey === 'operationsOwnerUserId') return 'operationsOwner';
  if (slotKey === 'clinicalOwnerUserId') return 'clinicalOwner';
  return 'administrativeOwner';
}

function facilityOwnerUser(facility: Facility, slotKey: OwnerSlotKey): PlatformUser | null {
  return facility[ownerRelationKey(slotKey)] ?? null;
}

function ownerSummaryLabel(user: PlatformUser | null, id: number | null): string {
  if (user?.name?.trim()) return user.name.trim();
  if (user?.email?.trim()) return user.email.trim();
  return id ? `User #${id}` : 'Unassigned';
}

function facilityOwnerCoverage(facility: Facility): number {
  return [
    facility.operationsOwnerUserId,
    facility.clinicalOwnerUserId,
    facility.administrativeOwnerUserId,
  ].filter((id) => id !== null).length;
}

function facilityMissingOwnerSummary(facility: Facility): string {
  const missing = ownerSlots
    .filter((slot) => facility[slot.key] === null)
    .map((slot) => slot.label);

  return missing.length === 0 ? 'All accountable roles assigned.' : `Missing ${missing.join(', ')}.`;
}

function facilityOwnerQueueLabel(facility: Facility, slotKey: OwnerSlotKey): string {
  const id = facility[slotKey];
  return ownerSummaryLabel(facilityOwnerUser(facility, slotKey), id);
}

function facilitySortLabel(): string {
  const sortLabels: Record<string, string> = {
    name: 'Name',
    code: 'Code',
    facilityType: 'Facility type',
    timezone: 'Timezone',
    status: 'Status',
    updatedAt: 'Updated',
  };

  return `${sortLabels[filters.sortBy] ?? 'Name'} ${filters.sortDir === 'desc' ? 'descending' : 'ascending'}`;
}

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null;

  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;

  const today = new Date();
  const millisecondsPerDay = 24 * 60 * 60 * 1000;

  return Math.ceil((target.getTime() - today.getTime()) / millisecondsPerDay);
}

function dateDistanceLabel(value: string | null | undefined): string {
  const days = daysUntil(value);
  if (days === null) return 'not set';
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days > 1) return `in ${days} days`;
  if (days === -1) return 'yesterday';

  return `${Math.abs(days)} days ago`;
}

const facilityFilterChips = computed<string[]>(() => {
  const chips: string[] = [];
  if (filters.q.trim()) chips.push(`Search: ${filters.q.trim()}`);
  if (filters.status) chips.push(`Status: ${formatEnumLabel(filters.status)}`);
  if (filters.facilityType.trim()) chips.push(`Type: ${formatEnumLabel(filters.facilityType)}`);
  if (filters.ownerUserId.trim()) chips.push(`Owner: ${ownerSummaryLabel(ownerFilterUser.value, Number(filters.ownerUserId))}`);
  if (filters.sortBy !== 'name' || filters.sortDir !== 'asc') chips.push(`Sort: ${facilitySortLabel()}`);
  if (filters.perPage !== 20) chips.push(`${filters.perPage} rows`);
  return chips;
});
const hasActiveFacilityFilters = computed(() => facilityFilterChips.value.length > 0);
const activeFacilityStatusPresetLabel = computed(() => {
  if (filters.status === 'active') return 'Active facilities';
  if (filters.status === 'inactive') return 'Inactive facilities';
  return 'All facility statuses';
});

function ownerId(slotKey: OwnerSlotKey): number | null {
  const parsed = parseUid(ownerForm[slotKey]);
  return parsed === 'invalid' ? null : parsed;
}

function ownerDisplayName(slotKey: OwnerSlotKey): string {
  const user = ownerUsers[slotKey];
  const id = ownerId(slotKey);
  return user?.name?.trim() || (id ? `User #${id}` : 'Not assigned');
}

function ownerDisplayMeta(slotKey: OwnerSlotKey): string {
  const user = ownerUsers[slotKey];
  const id = ownerId(slotKey);
  if (user) return `${user.email || 'No email'} | ${userRoleLabel(user)}`;
  if (id) return canReadUsers.value ? 'Profile is loading or unavailable.' : 'User profile hidden by permission.';
  return 'No user selected for this owner slot.';
}

function ownerSearchLockedReason(slotKey: OwnerSlotKey): string | null {
  if (!canReadUsers.value) return 'User lookup needs platform.users.read.';
  if (slotKey === 'administrativeOwnerUserId' && !canCreate.value) return 'Facility admin lookup needs platform.facilities.create.';
  return null;
}

function ownerSearchDisabled(slotKey: OwnerSlotKey): boolean {
  return !canManageOwners.value || ownersSaving.value || ownerSearchLockedReason(slotKey) !== null;
}

function resetOwnerSearchState(slotKey: OwnerSlotKey): void {
  const state = ownerSearchStates[slotKey];
  if (state.timer !== null) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }
  state.query = '';
  state.candidates = [];
  state.loading = false;
  state.error = null;
  state.requestId += 1;
}

function clearOwnerSearchDebounces(): void {
  ownerSlots.forEach((slot) => {
    const state = ownerSearchStates[slot.key];
    if (state.timer !== null) {
      window.clearTimeout(state.timer);
      state.timer = null;
    }
  });
}

async function loadOwnerSummaries(): Promise<void> {
  ownerSlots.forEach((slot) => {
    if (!ownerId(slot.key)) ownerUsers[slot.key] = null;
  });

  if (!canReadUsers.value) return;

  await Promise.all(ownerSlots.map(async (slot) => {
    const id = ownerId(slot.key);
    if (!id) return;

    try {
      const response = await api<{ data: PlatformUser }>('GET', `/platform/admin/users/${id}`);
      ownerUsers[slot.key] = response.data ?? null;
    } catch {
      ownerUsers[slot.key] = null;
    }
  }));
}

async function loadOwnerCandidates(slotKey: OwnerSlotKey): Promise<void> {
  const state = ownerSearchStates[slotKey];
  const query = state.query.trim();

  if (!canReadUsers.value) {
    state.candidates = [];
    state.error = 'Missing permission: platform.users.read.';
    state.loading = false;
    return;
  }
  if (slotKey === 'administrativeOwnerUserId' && !canCreate.value) {
    state.candidates = [];
    state.error = 'Missing permission: platform.facilities.create.';
    state.loading = false;
    return;
  }

  if (query.length < 2) {
    state.candidates = [];
    state.error = null;
    state.loading = false;
    return;
  }

  state.loading = true;
  state.error = null;
  const requestId = ++state.requestId;

  try {
    const response = slotKey === 'administrativeOwnerUserId'
      ? await api<{ data: PlatformUser[] }>('GET', '/platform/admin/facility-admin-candidates', {
          query: {
            q: query,
            limit: 8,
            tenantCode: selected.value?.tenantCode?.trim().toUpperCase() || null,
          },
        })
      : await api<{ data: PlatformUser[] }>('GET', '/platform/admin/users', {
          query: {
            q: query,
            status: 'active',
            perPage: 8,
            page: 1,
            sortBy: 'name',
            sortDir: 'asc',
          },
        });
    if (requestId !== state.requestId) return;
    state.candidates = response.data ?? [];
  } catch (e) {
    if (requestId !== state.requestId) return;
    state.candidates = [];
    state.error = messageFromUnknown(e, 'Unable to load owner candidates.');
  } finally {
    if (requestId === state.requestId) state.loading = false;
  }
}

function scheduleOwnerSearch(slotKey: OwnerSlotKey): void {
  const state = ownerSearchStates[slotKey];
  if (state.timer !== null) {
    window.clearTimeout(state.timer);
    state.timer = null;
  }

  if (state.query.trim().length < 2) {
    state.candidates = [];
    state.error = null;
    state.loading = false;
    state.requestId += 1;
    return;
  }

  state.loading = true;
  state.timer = window.setTimeout(() => {
    void loadOwnerCandidates(slotKey);
    state.timer = null;
  }, 300);
}

function selectOwner(slotKey: OwnerSlotKey, user: PlatformUser): void {
  if (user.id === null) return;
  ownerForm[slotKey] = String(user.id);
  ownerUsers[slotKey] = user;
  ownerErrors.value = { ...ownerErrors.value, [slotKey]: [] };
  resetOwnerSearchState(slotKey);
}

function clearOwner(slotKey: OwnerSlotKey): void {
  ownerForm[slotKey] = '';
  ownerUsers[slotKey] = null;
  ownerErrors.value = { ...ownerErrors.value, [slotKey]: [] };
  resetOwnerSearchState(slotKey);
}

function hydrate(f: Facility): void {
  configForm.code = f.code ?? '';
  configForm.name = f.name ?? '';
  configForm.facilityType = f.facilityType ?? '';
  configForm.timezone = f.timezone ?? '';
  tenantPolicyForm.allowedCountryCodes = normalizeCountryCodes(Array.isArray(f.tenantAllowedCountryCodes) ? f.tenantAllowedCountryCodes : []);
  statusForm.status = (f.status ?? 'active') as 'active' | 'inactive';
  statusForm.reason = f.statusReason ?? '';
  ownerForm.operationsOwnerUserId = f.operationsOwnerUserId === null ? '' : String(f.operationsOwnerUserId);
  ownerForm.clinicalOwnerUserId = f.clinicalOwnerUserId === null ? '' : String(f.clinicalOwnerUserId);
  ownerForm.administrativeOwnerUserId = f.administrativeOwnerUserId === null ? '' : String(f.administrativeOwnerUserId);
  ownerSlots.forEach((slot) => {
    ownerUsers[slot.key] = ownerForm[slot.key] ? facilityOwnerUser(f, slot.key) : null;
  });
}

function hydrateSubscription(nextSubscription: FacilitySubscription): void {
  subscription.value = nextSubscription;
  const fallbackPlan = nextSubscription.plan ?? subscriptionPlans.value[0] ?? null;
  const isConfigured = nextSubscription.status !== 'not_configured';

  subscriptionForm.planId = nextSubscription.planId ?? fallbackPlan?.id ?? '';
  subscriptionForm.status = isConfigured ? (nextSubscription.status ?? 'trial') : 'trial';
  subscriptionForm.billingCycle = fallbackPlan?.billingCycle ?? nextSubscription.billingCycle ?? 'monthly';
  subscriptionForm.priceAmount = String(fallbackPlan?.priceAmount ?? nextSubscription.priceAmount ?? '');
  subscriptionForm.currencyCode = (fallbackPlan?.currencyCode ?? nextSubscription.currencyCode ?? 'TZS').toUpperCase();
  subscriptionForm.trialEndsAt = toDateTimeInputValue(nextSubscription.trialEndsAt);
  subscriptionForm.currentPeriodStartsAt = toDateTimeInputValue(nextSubscription.currentPeriodStartsAt);
  subscriptionForm.currentPeriodEndsAt = toDateTimeInputValue(nextSubscription.currentPeriodEndsAt);
  subscriptionForm.nextInvoiceAt = toDateTimeInputValue(nextSubscription.nextInvoiceAt);
  subscriptionForm.gracePeriodEndsAt = toDateTimeInputValue(nextSubscription.gracePeriodEndsAt);
  subscriptionForm.statusReason = nextSubscription.statusReason ?? '';
}

function applySubscriptionPlanDefaults(planId: string): void {
  subscriptionForm.planId = planId;
  const plan = subscriptionPlans.value.find((entry) => entry.id === planId);
  if (!plan) return;

  subscriptionForm.billingCycle = plan.billingCycle ?? 'monthly';
  subscriptionForm.currencyCode = (plan.currencyCode ?? 'TZS').toUpperCase();
  subscriptionForm.priceAmount = String(plan.priceAmount ?? '');

  subscriptionErrors.value = { ...subscriptionErrors.value, planId: [] };
}

async function loadSubscriptionWorkspace(id: string): Promise<void> {
  subscriptionLoading.value = true;
  subscriptionError.value = null;
  subscriptionErrors.value = {};

  try {
    const [plansResponse, subscriptionResponse] = await Promise.all([
      subscriptionPlans.value.length > 0
        ? Promise.resolve({ data: subscriptionPlans.value })
        : api<{ data: SubscriptionPlan[] }>('GET', '/platform/admin/facility-subscription-plans'),
      api<{ data: FacilitySubscription }>('GET', `/platform/admin/facilities/${id}/subscription`),
    ]);

    subscriptionPlans.value = plansResponse.data ?? [];
    hydrateSubscription(subscriptionResponse.data);
  } catch (e) {
    subscription.value = null;
    subscriptionError.value = messageFromUnknown(e, 'Unable to load facility subscription.');
  } finally {
    subscriptionLoading.value = false;
  }
}

function syncInQueue(f: Facility): void { const i = facilities.value.findIndex((x) => x.id === f.id); if (i >= 0) facilities.value[i] = f; }

async function api<T>(method: 'GET' | 'POST' | 'PATCH', path: string, options?: { query?: Record<string, string | number | null>; body?: Record<string, unknown> }): Promise<T> {
  const url = new URL(`/api/v1${path}`, window.location.origin);
  Object.entries(options?.query ?? {}).forEach(([k, v]) => { if (v !== null && v !== '') url.searchParams.set(k, String(v)); });
  const headers: Record<string, string> = { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' };
  let body: string | undefined;
  if (method !== 'GET') { headers['Content-Type'] = 'application/json'; const token = csrfToken(); if (token) headers['X-CSRF-TOKEN'] = token; body = JSON.stringify(options?.body ?? {}); }
  const res = await fetch(url.toString(), { method, credentials: 'same-origin', headers, body });
  const payload = (await res.json().catch(() => ({}))) as VError;
  if (!res.ok) {
    const err = new Error(payload.message ?? `${res.status} ${res.statusText}`) as Error & { status?: number; payload?: VError };
    err.status = res.status; err.payload = payload; throw err;
  }
  return payload as T;
}
async function loadList(): Promise<void> {
  if (!canRead.value) { facilities.value = []; page.value = null; loading.value = false; return; }
  listLoading.value = true; listError.value = null;
  try {
    const r = await api<{ data: Facility[]; meta: Pagination }>('GET', '/platform/admin/facilities', { query: {
      q: filters.q.trim() || null, status: filters.status || null, facilityType: filters.facilityType.trim() || null,
      ownerUserId: filters.ownerUserId.trim() || null, sortBy: filters.sortBy, sortDir: filters.sortDir, perPage: filters.perPage, page: filters.page,
    } });
    facilities.value = r.data ?? []; page.value = r.meta ?? null;
  } catch (e) { listError.value = messageFromUnknown(e, 'Unable to load facilities.'); facilities.value = []; page.value = null; }
  finally { listLoading.value = false; loading.value = false; }
}
function clearFacilitySearchDebounce(): void {
  if (facilitySearchDebounceTimer !== null) {
    window.clearTimeout(facilitySearchDebounceTimer);
    facilitySearchDebounceTimer = null;
  }
}

function clearOwnerFilterSearchDebounce(): void {
  if (ownerFilterSearchDebounceTimer !== null) {
    window.clearTimeout(ownerFilterSearchDebounceTimer);
    ownerFilterSearchDebounceTimer = null;
  }
}

function applyFacilityFilters(): void {
  clearFacilitySearchDebounce();
  filters.page = 1;
  void loadList();
}

function updateFacilityQuery(value: string | number): void {
  filters.q = String(value ?? '');
  clearFacilitySearchDebounce();
  facilitySearchDebounceTimer = window.setTimeout(() => {
    filters.page = 1;
    void loadList();
    facilitySearchDebounceTimer = null;
  }, 350);
}

function setFacilityStatusFilter(status: string): void {
  if (filters.status === status) return;
  filters.status = status;
  applyFacilityFilters();
}

function setFacilityTypeFilter(value: string): void {
  filters.facilityType = value;
  applyFacilityFilters();
}

function setFacilitySortBy(value: string): void {
  filters.sortBy = value;
  applyFacilityFilters();
}

function setFacilitySortDir(value: string): void {
  filters.sortDir = value === 'desc' ? 'desc' : 'asc';
  applyFacilityFilters();
}

function setFacilityPerPage(value: string | number): void {
  const nextPerPage = Number(value);
  filters.perPage = Number.isFinite(nextPerPage) && nextPerPage > 0 ? nextPerPage : 20;
  applyFacilityFilters();
}

function fromSelectAllValue(value: string | number | null | undefined): string {
  const normalized = String(value ?? SELECT_ALL_VALUE);
  return normalized === SELECT_ALL_VALUE ? '' : normalized;
}

async function loadOwnerFilterCandidates(): Promise<void> {
  const query = ownerFilterSearch.value.trim();

  if (!canReadUsers.value) {
    ownerFilterCandidates.value = [];
    ownerFilterError.value = 'Owner lookup needs platform.users.read.';
    ownerFilterLoading.value = false;
    return;
  }

  if (query.length < 2) {
    ownerFilterCandidates.value = [];
    ownerFilterError.value = null;
    ownerFilterLoading.value = false;
    return;
  }

  ownerFilterLoading.value = true;
  ownerFilterError.value = null;
  const requestId = ++ownerFilterSearchRequestId;

  try {
    const response = await api<{ data: PlatformUser[] }>('GET', '/platform/admin/users', {
      query: {
        q: query,
        status: 'active',
        perPage: 8,
        page: 1,
        sortBy: 'name',
        sortDir: 'asc',
      },
    });
    if (requestId !== ownerFilterSearchRequestId) return;
    ownerFilterCandidates.value = response.data ?? [];
  } catch (e) {
    if (requestId !== ownerFilterSearchRequestId) return;
    ownerFilterCandidates.value = [];
    ownerFilterError.value = messageFromUnknown(e, 'Unable to load owner candidates.');
  } finally {
    if (requestId === ownerFilterSearchRequestId) ownerFilterLoading.value = false;
  }
}

function updateOwnerFilterSearch(value: string | number): void {
  ownerFilterSearch.value = String(value ?? '');
  clearOwnerFilterSearchDebounce();

  if (ownerFilterSearch.value.trim().length < 2) {
    ownerFilterCandidates.value = [];
    ownerFilterError.value = null;
    ownerFilterLoading.value = false;
    ownerFilterSearchRequestId += 1;
    return;
  }

  ownerFilterLoading.value = true;
  ownerFilterSearchDebounceTimer = window.setTimeout(() => {
    void loadOwnerFilterCandidates();
    ownerFilterSearchDebounceTimer = null;
  }, 300);
}

function selectOwnerFilter(user: PlatformUser): void {
  if (user.id === null) return;
  filters.ownerUserId = String(user.id);
  ownerFilterUser.value = user;
  ownerFilterSearch.value = '';
  ownerFilterCandidates.value = [];
  ownerFilterError.value = null;
  ownerFilterSearchRequestId += 1;
  clearOwnerFilterSearchDebounce();
  applyFacilityFilters();
}

function clearOwnerFilter(): void {
  filters.ownerUserId = '';
  ownerFilterUser.value = null;
  ownerFilterSearch.value = '';
  ownerFilterCandidates.value = [];
  ownerFilterError.value = null;
  ownerFilterSearchRequestId += 1;
  clearOwnerFilterSearchDebounce();
  applyFacilityFilters();
}

function resetFilters(): void {
  clearFacilitySearchDebounce();
  clearOwnerFilterSearchDebounce();
  Object.assign(filters, { q: '', status: '', facilityType: '', ownerUserId: '', sortBy: 'name', sortDir: 'asc', perPage: 20, page: 1 });
  ownerFilterUser.value = null;
  ownerFilterSearch.value = '';
  ownerFilterCandidates.value = [];
  ownerFilterError.value = null;
  ownerFilterLoading.value = false;
  ownerFilterSearchRequestId += 1;
  void loadList();
}
function prevPage(): void { if ((page.value?.currentPage ?? 1) <= 1) return; filters.page -= 1; void loadList(); }
function nextPage(): void { if (!page.value || page.value.currentPage >= page.value.lastPage) return; filters.page += 1; void loadList(); }

async function loadDetails(id: string): Promise<void> {
  detailsLoading.value = true; detailsError.value = null;
  try {
    const r = await api<{ data: Facility }>('GET', `/platform/admin/facilities/${id}`);
    selected.value = r.data; hydrate(r.data);
    await Promise.all([
      loadOwnerSummaries(),
      loadSubscriptionWorkspace(id),
      canViewAudit.value ? loadAudit(1) : Promise.resolve(),
    ]);
  } catch (e) { selected.value = null; detailsError.value = messageFromUnknown(e, 'Unable to load facility details.'); }
  finally { detailsLoading.value = false; }
}
function openDetails(f: Facility): void {
  const id = String(f.id ?? '').trim(); if (!id) return;
  detailsOpen.value = true; detailsWorkspaceTab.value = 'profile'; detailsError.value = null; selected.value = null;
  configErrors.value = {}; tenantPolicyErrors.value = {}; statusErrors.value = {}; ownerErrors.value = {}; subscriptionErrors.value = {}; subscriptionError.value = null; subscription.value = null; audit.value = []; auditMeta.value = null; auditError.value = null;
  ownerSlots.forEach((slot) => {
    ownerUsers[slot.key] = null;
    resetOwnerSearchState(slot.key);
  });
  Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
  void loadDetails(id);
}
function closeDetails(): void {
  detailsOpen.value = false;
  selected.value = null;
  ownerSlots.forEach((slot) => resetOwnerSearchState(slot.key));
}

function resetCreateForm(): void {
  Object.assign(createForm, {
    tenantCode: '',
    tenantName: '',
    tenantCountryCode: 'TZ',
    tenantAllowedCountryCodes: ['TZ'],
    facilityCode: '',
    facilityName: '',
    facilityType: '',
    facilityTier: '',
    timezone: 'Africa/Dar_es_Salaam',
    facilityAdminUserId: null,
  });
  createAdminMode.value = 'select';
  createAdminForm.name = '';
  createAdminForm.email = '';
  adminSearch.value = '';
  adminCandidates.value = [];
  adminCandidatesError.value = null;
  facilityAdminInviteNotice.value = null;
  createErrors.value = {};
}

function openCreate(): void {
  if (!canCreate.value) return;
  resetCreateForm();
  createOpen.value = true;
}

function closeCreate(): void {
  if (createSaving.value) return;
  clearAdminSearchDebounce();
  adminSearchRequestId += 1;
  adminCandidatesLoading.value = false;
  createOpen.value = false;
  createErrors.value = {};
}

function userRoleLabel(user: PlatformUser): string {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  const roleNames = roles.map((role) => role.name || role.code).filter(Boolean);
  return roleNames.length > 0 ? roleNames.slice(0, 2).join(', ') : 'No role assigned';
}

async function loadAdminCandidates(): Promise<void> {
  const query = adminSearch.value.trim();
  if (!canReadUsers.value) {
    adminCandidates.value = [];
    adminCandidatesError.value = 'Missing permission: platform.users.read.';
    return;
  }
  if (query.length < 2) {
    adminCandidates.value = [];
    adminCandidatesError.value = null;
    return;
  }

  adminCandidatesLoading.value = true;
  adminCandidatesError.value = null;
  const requestId = ++adminSearchRequestId;
  try {
    const r = await api<{ data: PlatformUser[] }>('GET', '/platform/admin/facility-admin-candidates', {
      query: {
        q: query,
        limit: 8,
        tenantCode: createForm.tenantCode.trim().toUpperCase() || null,
      },
    });
    if (requestId !== adminSearchRequestId) return;
    adminCandidates.value = r.data ?? [];
  } catch (e) {
    if (requestId !== adminSearchRequestId) return;
    adminCandidates.value = [];
    adminCandidatesError.value = messageFromUnknown(e, 'Unable to load admin candidates.');
  } finally {
    if (requestId === adminSearchRequestId) adminCandidatesLoading.value = false;
  }
}

function selectFacilityAdmin(user: PlatformUser): void {
  if (user.id === null) return;
  createForm.facilityAdminUserId = user.id;
  createErrors.value = { ...createErrors.value, facilityAdminUserId: [] };
}

function clearFacilityAdmin(): void {
  createForm.facilityAdminUserId = null;
}

function clearAdminSearchDebounce(): void {
  if (adminSearchDebounceTimer !== null) {
    window.clearTimeout(adminSearchDebounceTimer);
    adminSearchDebounceTimer = null;
  }
}

watch(adminSearch, (value) => {
  clearAdminSearchDebounce();
  if (value.trim().length < 2) {
    adminCandidates.value = [];
    adminCandidatesError.value = null;
    adminCandidatesLoading.value = false;
    adminSearchRequestId += 1;
    return;
  }

  adminCandidatesLoading.value = true;
  adminSearchDebounceTimer = window.setTimeout(() => {
    void loadAdminCandidates();
    adminSearchDebounceTimer = null;
  }, 300);
});

watch(() => createForm.tenantCode, () => {
  createForm.facilityAdminUserId = null;
  adminCandidates.value = [];
  adminCandidatesError.value = null;
  adminSearchRequestId += 1;
  clearAdminSearchDebounce();

  if (adminSearch.value.trim().length < 2) {
    adminCandidatesLoading.value = false;
    return;
  }

  adminCandidatesLoading.value = true;
  adminSearchDebounceTimer = window.setTimeout(() => {
    void loadAdminCandidates();
    adminSearchDebounceTimer = null;
  }, 300);
});

watch(createAdminMode, () => {
  createErrors.value = {
    ...createErrors.value,
    facilityAdmin: [],
    facilityAdminUserId: [],
    'facilityAdmin.name': [],
    'facilityAdmin.email': [],
  };
});

async function createFacility(): Promise<void> {
  if (!canCreate.value || createSaving.value) return;
  createSaving.value = true; createErrors.value = {};
  if (createAdminMode.value === 'select' && createForm.facilityAdminUserId === null) {
    createErrors.value = { facilityAdmin: ['Select an eligible Facility Administrator.'] };
    createSaving.value = false;
    return;
  }
  if (createAdminMode.value === 'create') {
    const adminName = createAdminForm.name.trim();
    const adminEmail = createAdminForm.email.trim();
    const errors: Record<string, string[]> = {};
    if (!adminName) errors['facilityAdmin.name'] = ['Name is required.'];
    if (!adminEmail) errors['facilityAdmin.email'] = ['Email is required.'];
    if (Object.keys(errors).length > 0) {
      createErrors.value = errors;
      createSaving.value = false;
      return;
    }
  }
  try {
    const r = await api<FacilityCreateResponse>('POST', '/platform/admin/facilities', {
      body: {
        tenantCode: createForm.tenantCode.trim(),
        tenantName: createForm.tenantName.trim(),
        tenantCountryCode: createForm.tenantCountryCode.trim().toUpperCase(),
        tenantAllowedCountryCodes: normalizeCountryCodes(createForm.tenantAllowedCountryCodes),
        facilityCode: createForm.facilityCode.trim(),
        facilityName: createForm.facilityName.trim(),
        facilityType: createForm.facilityType.trim() || null,
        facilityTier: createForm.facilityTier.trim() || null,
        timezone: createForm.timezone.trim() || null,
        facilityAdminUserId: createAdminMode.value === 'select' ? createForm.facilityAdminUserId : null,
        facilityAdmin: createAdminMode.value === 'create'
          ? { name: createAdminForm.name.trim(), email: createAdminForm.email.trim() }
          : null,
      },
    });
    facilities.value = [r.data, ...facilities.value.filter((entry) => entry.id !== r.data.id)];
    const invite = r.meta?.facilityAdminInvite ?? null;
    const inviteError = r.meta?.facilityAdminInviteError ?? null;
    const successMessage = createAdminMode.value === 'create'
      ? invite?.deliveryMode === 'email'
        ? 'Organization, facility, and facility admin created. Invite link sent.'
        : invite?.previewUrl
          ? 'Organization, facility, and facility admin created. Invite link generated for local preview.'
          : inviteError
            ? `Organization, facility, and facility admin created. Invite was not dispatched: ${inviteError}. Retry from Platform Users.`
            : 'Organization, facility, and facility admin created.'
      : 'Organization and facility created.';
    facilityAdminInviteNotice.value = createAdminMode.value === 'create'
      ? {
          message: successMessage,
          previewUrl: invite?.previewUrl ?? null,
          tone: inviteError ? 'warning' : 'success',
        }
      : null;
    if (inviteError) notifyError(successMessage);
    else notifySuccess(successMessage);
    createOpen.value = false;
    void loadList();
    openDetails(r.data);
  } catch (e) {
    const er = e as Error & { status?: number; payload?: VError };
    if (er.status === 422 && er.payload?.errors) createErrors.value = er.payload.errors;
    else notifyError(messageFromUnknown(e, 'Unable to create facility.'));
  } finally { createSaving.value = false; }
}

async function saveConfig(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdate.value || configSaving.value) return;
  configSaving.value = true; configErrors.value = {};
  const code = configForm.code.trim(); const name = configForm.name.trim();
  if (!code || !name) { configErrors.value = { ...(code ? {} : { code: ['Code is required.'] }), ...(name ? {} : { name: ['Name is required.'] }) }; configSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, { body: { code, name, facilityType: configForm.facilityType.trim() || null, timezone: configForm.timezone.trim() || null } });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Facility configuration updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) configErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save configuration.')); }
  finally { configSaving.value = false; }
}

async function saveTenantPolicy(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdate.value || tenantPolicySaving.value) return;
  tenantPolicySaving.value = true; tenantPolicyErrors.value = {};
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}`, {
      body: { tenantAllowedCountryCodes: normalizeCountryCodes(tenantPolicyForm.allowedCountryCodes) },
    });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Tenant country policy updated.');
  } catch (e) {
    const er = e as Error & { status?: number; payload?: VError };
    if (er.status === 422 && er.payload?.errors) tenantPolicyErrors.value = er.payload.errors;
    else notifyError(messageFromUnknown(e, 'Unable to save tenant country policy.'));
  } finally { tenantPolicySaving.value = false; }
}

async function saveStatus(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canUpdateStatus.value || statusSaving.value) return;
  statusSaving.value = true; statusErrors.value = {}; const reason = statusForm.reason.trim();
  if (statusForm.status === 'inactive' && !reason) { statusErrors.value = { reason: ['Reason is required when status is inactive.'] }; statusSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/status`, { body: { status: statusForm.status, reason: statusForm.status === 'inactive' ? reason : null } });
    selected.value = r.data; hydrate(r.data); syncInQueue(r.data); notifySuccess('Facility status updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) statusErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save status.')); }
  finally { statusSaving.value = false; }
}

async function saveSubscription(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim();
  if (!id || !canManageSubscriptions.value || subscriptionSaving.value) return;

  subscriptionSaving.value = true;
  subscriptionErrors.value = {};

  const reason = subscriptionForm.statusReason.trim();
  const errors: Record<string, string[]> = {};
  if (!subscriptionForm.planId) errors.planId = ['Select a service plan.'];
  if (['past_due', 'suspended', 'cancelled'].includes(subscriptionForm.status) && !reason) {
    errors.statusReason = ['Reason is required for restricted subscription states.'];
  }
  if (Object.keys(errors).length > 0) {
    subscriptionErrors.value = errors;
    subscriptionSaving.value = false;
    return;
  }

  try {
    const response = await api<{ data: FacilitySubscription }>('PATCH', `/platform/admin/facilities/${id}/subscription`, {
      body: {
        planId: subscriptionForm.planId,
        status: subscriptionForm.status,
        trialEndsAt: toApiDateTime(subscriptionForm.trialEndsAt),
        currentPeriodStartsAt: toApiDateTime(subscriptionForm.currentPeriodStartsAt),
        currentPeriodEndsAt: toApiDateTime(subscriptionForm.currentPeriodEndsAt),
        nextInvoiceAt: toApiDateTime(subscriptionForm.nextInvoiceAt),
        gracePeriodEndsAt: toApiDateTime(subscriptionForm.gracePeriodEndsAt),
        statusReason: reason || null,
      },
    });

    hydrateSubscription(response.data);
    notifySuccess('Facility subscription updated.');
    if (canViewAudit.value) void loadAudit(1);
  } catch (e) {
    const error = e as Error & { status?: number; payload?: VError };
    if (error.status === 422 && error.payload?.errors) subscriptionErrors.value = error.payload.errors;
    else notifyError(messageFromUnknown(e, 'Unable to save facility subscription.'));
  } finally {
    subscriptionSaving.value = false;
  }
}

async function saveOwners(): Promise<void> {
  const id = String(selected.value?.id ?? '').trim(); if (!id || !canManageOwners.value || ownersSaving.value) return;
  ownersSaving.value = true; ownerErrors.value = {};
  const ops = parseUid(ownerForm.operationsOwnerUserId); const cli = parseUid(ownerForm.clinicalOwnerUserId); const adm = parseUid(ownerForm.administrativeOwnerUserId);
  const err: Record<string, string[]> = {};
  if (ops === 'invalid') err.operationsOwnerUserId = ['Must be a positive integer.'];
  if (cli === 'invalid') err.clinicalOwnerUserId = ['Must be a positive integer.'];
  if (adm === 'invalid') err.administrativeOwnerUserId = ['Must be a positive integer.'];
  if (Object.keys(err).length > 0) { ownerErrors.value = err; ownersSaving.value = false; return; }
  try {
    const r = await api<{ data: Facility }>('PATCH', `/platform/admin/facilities/${id}/owners`, { body: { operationsOwnerUserId: ops, clinicalOwnerUserId: cli, administrativeOwnerUserId: adm } });
    selected.value = r.data; hydrate(r.data); await loadOwnerSummaries(); syncInQueue(r.data); notifySuccess('Facility owners updated.');
  } catch (e) { const er = e as Error & { status?: number; payload?: VError }; if (er.status === 422 && er.payload?.errors) ownerErrors.value = er.payload.errors; else notifyError(messageFromUnknown(e, 'Unable to save owners.')); }
  finally { ownersSaving.value = false; }
}

async function loadAudit(pageNo = 1): Promise<void> {
  if (!canViewAudit.value) return;
  const id = String(selected.value?.id ?? '').trim(); if (!id) return;
  auditLoading.value = true; auditError.value = null; auditFilters.page = pageNo;
  try {
    const r = await api<{ data: AuditLog[]; meta: Pagination }>('GET', `/platform/admin/facilities/${id}/audit-logs`, { query: {
      q: auditFilters.q.trim() || null, action: auditFilters.action.trim() || null, actorType: auditFilters.actorType || null, actorId: auditFilters.actorId.trim() || null,
      from: toApiDateTime(auditFilters.from), to: toApiDateTime(auditFilters.to), perPage: auditFilters.perPage, page: pageNo,
    } });
    audit.value = r.data ?? []; auditMeta.value = r.meta ?? null;
  } catch (e) { auditError.value = messageFromUnknown(e, 'Unable to load audit logs.'); audit.value = []; auditMeta.value = null; }
  finally { auditLoading.value = false; }
}

function resetAuditFilters(): void {
  Object.assign(auditFilters, { q: '', action: '', actorType: '', actorId: '', from: '', to: '', perPage: 20, page: 1 });
  void loadAudit(1);
}

async function exportAudit(): Promise<void> {
  if (!canViewAudit.value || auditExporting.value) return;
  const id = String(selected.value?.id ?? '').trim(); if (!id) return;
  auditExporting.value = true;
  try {
    const url = new URL(`/api/v1/platform/admin/facilities/${id}/audit-logs/export`, window.location.origin);
    const q = { q: auditFilters.q.trim() || null, action: auditFilters.action.trim() || null, actorType: auditFilters.actorType || null, actorId: auditFilters.actorId.trim() || null, from: toApiDateTime(auditFilters.from), to: toApiDateTime(auditFilters.to) };
    Object.entries(q).forEach(([k, v]) => { if (v) url.searchParams.set(k, v); });
    const h: Record<string, string> = { Accept: 'text/csv,application/json', 'X-Requested-With': 'XMLHttpRequest' }; const t = csrfToken(); if (t) h['X-CSRF-TOKEN'] = t;
    const res = await fetch(url.toString(), { method: 'GET', credentials: 'same-origin', headers: h });
    if (!res.ok) { const p = (await res.json().catch(() => ({}))) as VError; throw new Error(p.message ?? `${res.status} ${res.statusText}`); }
    const blob = await res.blob(); const cd = res.headers.get('Content-Disposition') ?? ''; const m = cd.match(/filename="?([^";]+)"?/i); const name = m?.[1] ?? `facility-audit-${id}.csv`;
    const obj = window.URL.createObjectURL(blob); const a = document.createElement('a'); a.href = obj; a.download = name; document.body.append(a); a.click(); a.remove(); window.URL.revokeObjectURL(obj);
    notifySuccess('Audit CSV prepared.');
  } catch (e) { notifyError(messageFromUnknown(e, 'Unable to export audit CSV.')); }
  finally { auditExporting.value = false; }
}

onMounted(() => { void Promise.all([loadList(), loadCountryProfile()]); });
onBeforeUnmount(() => {
  clearFacilitySearchDebounce();
  clearOwnerFilterSearchDebounce();
  clearAdminSearchDebounce();
  clearOwnerSearchDebounces();
});
</script>

<template>
  <Head title="Facility Configuration" />
  <AppLayout :breadcrumbs="breadcrumbs">
    <div class="flex h-full flex-1 flex-col gap-4 overflow-x-auto rounded-lg p-4 md:p-6">
      <div class="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div class="flex flex-col gap-1">
          <h1 class="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <AppIcon name="building-2" class="size-7 text-primary" /> Facility Configuration and Ownership
          </h1>
          <p class="text-sm text-muted-foreground">Organizations, hospitals, facility administrators, status, and audit workflows.</p>
        </div>
        <Button v-if="canCreate" class="gap-2" @click="openCreate">
          <AppIcon name="plus" class="size-4" />
          New Facility
        </Button>
      </div>

      <Alert v-if="!permissionsResolved">
        <AlertTitle>Resolving access</AlertTitle>
        <AlertDescription>Loading permission context.</AlertDescription>
      </Alert>
      <Alert v-else-if="!canRead" variant="destructive">
        <AlertTitle>Access denied</AlertTitle>
        <AlertDescription>Missing permission: `platform.facilities.read`.</AlertDescription>
      </Alert>
      <Alert
        v-if="facilityAdminInviteNotice"
        :variant="facilityAdminInviteNotice.tone === 'warning' ? 'destructive' : 'default'"
      >
        <AlertTitle>Facility admin invite</AlertTitle>
        <AlertDescription class="space-y-2">
          <p>{{ facilityAdminInviteNotice.message }}</p>
          <a
            v-if="facilityAdminInviteNotice.previewUrl"
            :href="facilityAdminInviteNotice.previewUrl"
            target="_blank"
            rel="noreferrer"
            class="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open local invite link
          </a>
        </AlertDescription>
      </Alert>

      <div v-if="canRead" class="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 px-4 py-3">
        <button
          type="button"
          class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          :class="{ 'border-primary bg-primary/5': filters.status === '' }"
          @click="setFacilityStatusFilter('')"
        >
          <span class="inline-block h-2 w-2 rounded-full bg-slate-400" />
          <span class="text-muted-foreground">All</span>
        </button>
        <button
          type="button"
          class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          :class="{ 'border-primary bg-primary/5': filters.status === 'active' }"
          @click="setFacilityStatusFilter('active')"
        >
          <span class="inline-block h-2 w-2 rounded-full bg-emerald-500" />
          <span class="text-muted-foreground">Active</span>
        </button>
        <button
          type="button"
          class="group flex items-center gap-2 rounded-md border bg-background px-3 py-1.5 text-sm transition-colors hover:bg-accent"
          :class="{ 'border-primary bg-primary/5': filters.status === 'inactive' }"
          @click="setFacilityStatusFilter('inactive')"
        >
          <span class="inline-block h-2 w-2 rounded-full bg-rose-500" />
          <span class="text-muted-foreground">Inactive</span>
        </button>

        <div class="ml-auto flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{{ activeFacilityStatusPresetLabel }}</Badge>
          <Button
            v-if="hasActiveFacilityFilters"
            variant="ghost"
            size="sm"
            class="h-7 gap-1.5 text-xs"
            :disabled="listLoading"
            @click="resetFilters"
          >
            <AppIcon name="sliders-horizontal" class="size-3" />
            Reset
          </Button>
        </div>
      </div>

      <Card v-if="canRead" class="rounded-lg border-sidebar-border/70">
        <CardHeader class="gap-4">
          <div class="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div class="min-w-0 space-y-2">
              <div>
                <CardTitle class="flex items-center gap-2">
                  <AppIcon name="building-2" class="size-5 text-muted-foreground" />
                  Facility Queue
                </CardTitle>
                <CardDescription>Facility readiness, ownership coverage, tenant scope, and operational state.</CardDescription>
              </div>
              <div class="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary">{{ page?.total ?? facilities.length }} facilities</Badge>
                <Badge v-if="filters.facilityType" variant="outline">{{ formatEnumLabel(filters.facilityType) }}</Badge>
                <Badge v-if="filters.ownerUserId" variant="outline">{{ ownerSummaryLabel(ownerFilterUser, Number(filters.ownerUserId)) }}</Badge>
                <Badge v-if="filters.sortBy !== 'name' || filters.sortDir !== 'asc'" variant="outline">{{ facilitySortLabel() }}</Badge>
              </div>
            </div>

            <div class="flex w-full flex-col gap-2 sm:flex-row sm:items-center xl:max-w-2xl">
              <SearchInput
                id="facility-search-q"
                :model-value="filters.q"
                placeholder="Search code, name, type, timezone"
                class="min-w-0 flex-1"
                :disabled="listLoading"
                @update:model-value="updateFacilityQuery"
                @keyup.enter="applyFacilityFilters"
              />
              <Button variant="outline" size="sm" class="h-9 gap-1.5 rounded-lg text-xs" @click="facilityFiltersSheetOpen = true">
                <AppIcon name="sliders-horizontal" class="size-3.5" />
                Filters
                <Badge v-if="facilityFilterChips.length > 0" variant="secondary" class="ml-1 h-5 px-1.5 text-[10px]">
                  {{ facilityFilterChips.length }}
                </Badge>
              </Button>
            </div>
          </div>
          <div v-if="facilityFilterChips.length > 0" class="flex flex-wrap gap-1.5">
            <Badge v-for="chip in facilityFilterChips" :key="chip" variant="outline">{{ chip }}</Badge>
          </div>
        </CardHeader>
        <CardContent class="space-y-3">
          <Alert v-if="listError" variant="destructive"><AlertTitle>Queue load issue</AlertTitle><AlertDescription>{{ listError }}</AlertDescription></Alert>
          <div v-else-if="loading || listLoading" class="space-y-2"><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /><Skeleton class="h-12 w-full" /></div>
          <div v-else-if="facilities.length === 0" class="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">No facilities matched current filters.</div>
          <div v-else class="space-y-2">
            <div v-for="f in facilities" :key="String(f.id)" class="rounded-lg border p-3">
              <div class="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2"><p class="text-sm font-medium">{{ f.code || 'NO-CODE' }} - {{ f.name || 'Unnamed Facility' }}</p><Badge :variant="vStatus(f.status)">{{ formatEnumLabel(f.status) }}</Badge></div>
                  <p class="text-xs text-muted-foreground">Type {{ f.facilityType ? formatEnumLabel(f.facilityType) : 'N/A' }} | Timezone {{ f.timezone || 'N/A' }} | Updated {{ fmt(f.updatedAt) }}</p>
                  <div class="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <Badge variant="outline">Owners {{ facilityOwnerCoverage(f) }}/3</Badge>
                    <span>Ops: {{ facilityOwnerQueueLabel(f, 'operationsOwnerUserId') }}</span>
                    <span class="hidden text-muted-foreground/50 sm:inline">|</span>
                    <span>Clinical: {{ facilityOwnerQueueLabel(f, 'clinicalOwnerUserId') }}</span>
                    <span class="hidden text-muted-foreground/50 sm:inline">|</span>
                    <span>Admin: {{ facilityOwnerQueueLabel(f, 'administrativeOwnerUserId') }}</span>
                  </div>
                </div>
                <Button size="sm" class="gap-1.5" @click="openDetails(f)">
                  <AppIcon name="eye" class="size-3.5" />
                  Open
                </Button>
              </div>
            </div>
          </div>
          <div class="flex items-center justify-between border-t pt-2">
            <Button variant="outline" size="sm" :disabled="listLoading || (page?.currentPage ?? 1) <= 1" @click="prevPage">Previous</Button>
            <p class="text-xs text-muted-foreground">Page {{ page?.currentPage ?? 1 }} of {{ page?.lastPage ?? 1 }}<span v-if="page"> | {{ page.total }} total</span></p>
            <Button variant="outline" size="sm" :disabled="listLoading || !page || page.currentPage >= page.lastPage" @click="nextPage">Next</Button>
          </div>
        </CardContent>
      </Card>

      <Sheet v-if="canRead" :open="facilityFiltersSheetOpen" @update:open="facilityFiltersSheetOpen = $event">
        <SheetContent side="right" variant="form" size="md" class="flex h-full min-h-0 flex-col">
          <SheetHeader>
            <SheetTitle class="flex items-center gap-2">
              <AppIcon name="sliders-horizontal" class="size-4 text-muted-foreground" />
              Facility Filters
            </SheetTitle>
            <SheetDescription>Facility queue controls for status, ownership, type, and sorting.</SheetDescription>
          </SheetHeader>

          <div class="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <div class="rounded-lg border p-3">
              <div class="grid gap-3">
                <div class="grid gap-2">
                  <Label for="facility-search-q-sheet">Search</Label>
                  <SearchInput
                    id="facility-search-q-sheet"
                    :model-value="filters.q"
                    placeholder="Search code, name, type, timezone"
                    :disabled="listLoading"
                    @update:model-value="updateFacilityQuery"
                    @keyup.enter="applyFacilityFilters"
                  />
                </div>

                <div class="grid gap-2">
                  <Label for="facility-status-sheet">Status</Label>
                  <Select
                    :model-value="filters.status || SELECT_ALL_VALUE"
                    @update:model-value="setFacilityStatusFilter(fromSelectAllValue($event))"
                  >
                    <SelectTrigger id="facility-status-sheet" class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="SELECT_ALL_VALUE">All statuses</SelectItem>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div class="grid gap-2">
                  <Label for="facility-type-sheet">Facility type</Label>
                  <Select
                    :model-value="filters.facilityType || SELECT_ALL_VALUE"
                    @update:model-value="setFacilityTypeFilter(fromSelectAllValue($event))"
                  >
                    <SelectTrigger id="facility-type-sheet" class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem :value="SELECT_ALL_VALUE">All facility types</SelectItem>
                      <SelectItem v-for="option in facilityTypeOptions" :key="option.value" :value="option.value">{{ option.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Separator />

                <div class="grid gap-2">
                  <Label for="facility-owner-filter">Owner</Label>
                  <div v-if="filters.ownerUserId" class="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 p-3">
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">{{ ownerSummaryLabel(ownerFilterUser, Number(filters.ownerUserId)) }}</p>
                      <p class="truncate text-xs text-muted-foreground">{{ ownerFilterUser?.email || 'Any ownership slot' }}</p>
                    </div>
                    <Button variant="outline" size="sm" :disabled="listLoading" @click="clearOwnerFilter">Clear</Button>
                  </div>
                  <div class="relative">
                    <Input
                      id="facility-owner-filter"
                      :model-value="ownerFilterSearch"
                      placeholder="Search owner by name or email"
                      class="pr-10"
                      :disabled="listLoading || !canReadUsers"
                      @update:model-value="updateOwnerFilterSearch"
                    />
                    <AppIcon v-if="ownerFilterLoading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                    <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  </div>
                  <p v-if="!canReadUsers" class="text-xs text-muted-foreground">Owner lookup needs platform.users.read.</p>
                  <p v-else-if="ownerFilterError" class="text-xs text-destructive">{{ ownerFilterError }}</p>
                  <div v-else-if="ownerFilterLoading" class="space-y-2">
                    <Skeleton class="h-11 w-full" />
                    <Skeleton class="h-11 w-full" />
                  </div>
                  <div v-else-if="ownerFilterSearch.trim().length >= 2 && ownerFilterCandidates.length === 0" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    No active owner matched this search.
                  </div>
                  <div v-else-if="ownerFilterSearch.trim().length < 2 && !filters.ownerUserId" class="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                    Type at least two characters to filter by an assigned owner.
                  </div>
                  <div v-else class="grid gap-2">
                    <button
                      v-for="user in ownerFilterCandidates"
                      :key="`owner-filter-${user.id}`"
                      type="button"
                      class="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                      :disabled="listLoading"
                      @click="selectOwnerFilter(user)"
                    >
                      <span class="min-w-0">
                        <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                        <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                      </span>
                      <Badge :variant="vStatus(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                    </button>
                  </div>
                </div>

                <Separator />

                <div class="grid gap-2">
                  <Label for="facility-sort-by-sheet">Sort by</Label>
                  <Select :model-value="filters.sortBy" @update:model-value="setFacilitySortBy(String($event ?? 'name'))">
                    <SelectTrigger id="facility-sort-by-sheet" class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name</SelectItem>
                      <SelectItem value="code">Code</SelectItem>
                      <SelectItem value="facilityType">Facility type</SelectItem>
                      <SelectItem value="timezone">Timezone</SelectItem>
                      <SelectItem value="status">Status</SelectItem>
                      <SelectItem value="updatedAt">Updated</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <Label for="facility-sort-dir-sheet">Sort direction</Label>
                  <Select :model-value="filters.sortDir" @update:model-value="setFacilitySortDir(String($event ?? 'asc'))">
                    <SelectTrigger id="facility-sort-dir-sheet" class="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="asc">Ascending</SelectItem>
                      <SelectItem value="desc">Descending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div class="grid gap-2">
                  <Label for="facility-per-page-sheet">Rows per page</Label>
                  <Select :model-value="String(filters.perPage)" @update:model-value="setFacilityPerPage">
                    <SelectTrigger id="facility-per-page-sheet" class="w-full">
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
            </div>
          </div>

          <SheetFooter class="gap-2 border-t px-4 py-3">
            <Button variant="outline" :disabled="listLoading && !hasActiveFacilityFilters" @click="resetFilters">
              Reset Filters
            </Button>
            <Button :disabled="listLoading" @click="facilityFiltersSheetOpen = false">
              Done
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet :open="detailsOpen" @update:open="(o) => (o ? (detailsOpen = true) : closeDetails())">
        <SheetContent side="right" variant="workspace" size="5xl" class="flex h-full min-h-0 flex-col">
          <SheetHeader class="shrink-0 border-b bg-background px-4 py-3 text-left pr-12">
            <SheetTitle class="flex min-w-0 flex-wrap items-center gap-2">
              <AppIcon name="building-2" class="size-5 text-muted-foreground" />
              <span class="min-w-0 truncate">{{ selected?.name || selected?.code || 'Facility Details' }}</span>
              <Badge v-if="selected?.code" variant="outline" class="shrink-0 font-normal">{{ selected.code }}</Badge>
            </SheetTitle>
            <SheetDescription>
              {{ selected?.tenantName || 'Organization not set' }} | {{ selected?.facilityType ? formatEnumLabel(selected.facilityType) : 'Facility type not set' }} | {{ selected?.timezone || 'Timezone not set' }}
            </SheetDescription>
          </SheetHeader>
          <div class="min-h-0 flex flex-1 flex-col overflow-hidden">
            <div v-if="detailsLoading" class="space-y-2 p-4"><Skeleton class="h-14 w-full" /><Skeleton class="h-14 w-full" /></div>
            <Alert v-else-if="detailsError" variant="destructive" class="m-4"><AlertTitle>Details load issue</AlertTitle><AlertDescription>{{ detailsError }}</AlertDescription></Alert>
            <Tabs v-else-if="selected" v-model="detailsWorkspaceTab" class="flex h-full min-h-0 flex-col">
              <div class="shrink-0 border-b bg-muted/5 px-4 py-2.5">
                <div class="space-y-4">
                  <div class="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                      <div class="flex flex-wrap items-start justify-between gap-2">
                        <div class="min-w-0">
                          <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Facility</p>
                          <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ selected.name || selected.code || 'Facility' }}</p>
                          <p class="truncate text-xs leading-4 text-muted-foreground">{{ selected.facilityType ? formatEnumLabel(selected.facilityType) : 'Type not set' }} | {{ selected.timezone || 'Timezone not set' }}</p>
                        </div>
                        <Badge :variant="vStatus(selected.status)" class="shrink-0">{{ formatEnumLabel(selected.status) }}</Badge>
                      </div>
                    </div>
                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Ownership</p>
                        <Badge variant="outline">{{ facilityOwnerCoverage(selected) }}/3</Badge>
                      </div>
                      <p class="mt-0.5 line-clamp-1 text-sm font-semibold leading-4">{{ facilityMissingOwnerSummary(selected) }}</p>
                      <p class="truncate text-xs leading-4 text-muted-foreground">{{ tenantCountryPolicySummary(selected) }}</p>
                    </div>
                    <div class="min-w-0 rounded-lg border bg-background/70 px-3 py-1.5">
                      <div class="flex items-center justify-between gap-2">
                        <p class="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Service access</p>
                        <Badge :variant="subscriptionAccessSummary.tone">{{ subscriptionAccessSummary.label }}</Badge>
                      </div>
                      <p class="mt-0.5 truncate text-sm font-semibold leading-4">{{ selectedSubscriptionPlan?.name || 'No plan selected' }}</p>
                      <p class="truncate text-xs leading-4 text-muted-foreground">{{ subscriptionCoveragePercent }}% coverage | {{ subscriptionRenewalRisk.label }}</p>
                    </div>
                  </div>

                  <div class="pb-1">
                    <TabsList class="flex h-auto w-full flex-wrap justify-start gap-2 rounded-lg bg-transparent p-0">
                      <TabsTrigger value="profile" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                        <AppIcon name="sliders-horizontal" class="size-3.5" />
                        Profile
                      </TabsTrigger>
                      <TabsTrigger value="subscription" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                        <AppIcon name="receipt" class="size-3.5" />
                        Subscription
                      </TabsTrigger>
                      <TabsTrigger v-if="canViewAudit" value="audit" class="gap-1.5 rounded-md border px-3 py-1.5 data-[state=active]:border-primary/40 data-[state=active]:bg-background">
                        <AppIcon name="file-text" class="size-3.5" />
                        Audit
                      </TabsTrigger>
                    </TabsList>
                  </div>
                </div>
              </div>
              <ScrollArea class="min-h-0 flex-1" viewport-class="pb-6">
                <TabsContent value="profile" class="m-0">
                  <div class="grid gap-4 px-6 py-4">

                <fieldset class="grid gap-3 rounded-lg border p-3">
                  <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Identity</legend>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <p class="text-sm font-medium">Core operating profile</p>
                      <p class="max-w-2xl text-xs text-muted-foreground">
                        Keep the facility code, display name, type, and timezone aligned with the real site before clinical testing starts.
                      </p>
                    </div>
                    <Button v-if="canUpdate" size="sm" class="gap-1.5" :disabled="configSaving" @click="saveConfig">
                      <AppIcon name="circle-check-big" class="size-3.5" />
                      {{ configSaving ? 'Saving...' : 'Save Identity' }}
                    </Button>
                  </div>
                  <div class="grid gap-3 sm:grid-cols-2">
                    <FormFieldShell input-id="details-facility-code" label="Facility code" required :error-message="firstError(configErrors, 'code')">
                      <Input id="details-facility-code" v-model="configForm.code" :disabled="!canUpdate || configSaving" />
                    </FormFieldShell>
                    <FormFieldShell input-id="details-facility-name" label="Facility name" required :error-message="firstError(configErrors, 'name')">
                      <Input id="details-facility-name" v-model="configForm.name" :disabled="!canUpdate || configSaving" />
                    </FormFieldShell>
                    <FormFieldShell input-id="details-facility-type" label="Facility type">
                      <Input id="details-facility-type" v-model="configForm.facilityType" placeholder="hospital, dispensary, clinic" :disabled="!canUpdate || configSaving" />
                    </FormFieldShell>
                    <FormFieldShell input-id="details-facility-timezone" label="Timezone">
                      <Input id="details-facility-timezone" v-model="configForm.timezone" placeholder="Africa/Dar_es_Salaam" :disabled="!canUpdate || configSaving" />
                    </FormFieldShell>
                  </div>
                </fieldset>

                <fieldset class="grid gap-3 rounded-lg border p-3">
                  <legend class="px-2 text-sm font-medium text-muted-foreground">Organization Policy</legend>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <p class="text-sm font-medium">{{ selected.tenantName || selected.tenantCode || 'Tenant' }} country profile</p>
                      <p class="max-w-2xl text-xs text-muted-foreground">
                        Controls the country profiles available to intake, identifiers, phone formats, and country-aware defaults for this organization.
                      </p>
                      <p class="text-xs text-muted-foreground">
                        Tenant code {{ selected.tenantCode || 'N/A' }} | Base country {{ selected.tenantCountryCode || 'N/A' }}
                      </p>
                    </div>
                    <Button v-if="canUpdate" size="sm" class="gap-1.5" :disabled="tenantPolicySaving" @click="saveTenantPolicy">
                      <AppIcon name="shield-check" class="size-3.5" />
                      {{ tenantPolicySaving ? 'Saving...' : 'Save Policy' }}
                    </Button>
                  </div>
                  <Alert>
                    <AlertTitle>Policy behavior</AlertTitle>
                    <AlertDescription>Leave all countries unchecked to clear the tenant override and fall back to the global config policy.</AlertDescription>
                  </Alert>
                  <div v-if="tenantCountryOptions.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Country catalog is unavailable right now. Current tenant policy:
                    {{ tenantPolicyForm.allowedCountryCodes.length ? tenantPolicyForm.allowedCountryCodes.join(', ') : 'fallback to global config' }}.
                  </div>
                  <div v-else class="grid gap-3 sm:grid-cols-2">
                    <label
                      v-for="option in tenantCountryOptions"
                      :key="option.code"
                      class="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-muted/40"
                      :class="{ 'cursor-not-allowed opacity-60': !canUpdate || tenantPolicySaving }"
                    >
                      <Checkbox
                        :id="`tenant-policy-country-${option.code}`"
                        :model-value="tenantPolicyForm.allowedCountryCodes.includes(option.code)"
                        class="mt-1"
                        :disabled="!canUpdate || tenantPolicySaving"
                        @update:model-value="(checked) => setTenantPolicyCountryAllowed(option.code, checked === true)"
                      />
                      <span class="space-y-1">
                        <span class="flex flex-wrap items-center gap-2">
                          <span class="font-medium">{{ option.label }}</span>
                          <Badge v-if="option.code === selected.tenantCountryCode" variant="outline">Tenant base country</Badge>
                        </span>
                        <span class="block text-xs text-muted-foreground">Allow this country profile for organization-wide workflows.</span>
                      </span>
                    </label>
                  </div>
                  <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes') }}</p>
                  <p v-if="firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0')" class="text-xs text-destructive">{{ firstError(tenantPolicyErrors, 'tenantAllowedCountryCodes.0') }}</p>
                </fieldset>

                <fieldset class="grid gap-3 rounded-lg border p-3">
                  <legend class="px-2 text-sm font-medium text-muted-foreground">Status Control</legend>
                  <div class="grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div class="h-full rounded-lg border bg-muted/20 p-3">
                      <p class="text-xs text-muted-foreground">Current status</p>
                      <div class="mt-2 flex flex-wrap items-center gap-2">
                        <Badge :variant="vStatus(selected.status)">{{ formatEnumLabel(selected.status) }}</Badge>
                        <span class="text-xs text-muted-foreground">Updated {{ fmt(selected.updatedAt) }}</span>
                      </div>
                      <p v-if="selected.statusReason" class="mt-3 text-xs text-muted-foreground">{{ selected.statusReason }}</p>
                    </div>
                    <div class="grid h-full gap-3 rounded-lg border bg-background p-3">
                      <FormFieldShell input-id="details-status-target" label="Target status">
                        <Select v-model="statusForm.status">
                          <SelectTrigger id="details-status-target" class="w-full" :disabled="!canUpdateStatus || statusSaving"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldShell>
                      <FormFieldShell input-id="details-status-reason" label="Reason" :error-message="firstError(statusErrors, 'reason')">
                        <Textarea id="details-status-reason" v-model="statusForm.reason" class="min-h-24" :disabled="!canUpdateStatus || statusSaving" placeholder="Required when inactivating a facility" />
                      </FormFieldShell>
                    </div>
                  </div>
                  <div class="flex justify-end border-t pt-3">
                    <Button v-if="canUpdateStatus" size="sm" class="gap-1.5" :disabled="statusSaving" @click="saveStatus">
                      <AppIcon name="circle-check-big" class="size-3.5" />
                      {{ statusSaving ? 'Saving...' : 'Save Status' }}
                    </Button>
                  </div>
                </fieldset>

                <Separator />

                <fieldset class="grid gap-3 rounded-lg border p-3">
                  <legend class="px-2 text-sm font-medium text-muted-foreground">Operational Ownership</legend>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <p class="text-sm font-medium">Named accountable users</p>
                      <p class="max-w-2xl text-xs text-muted-foreground">
                        Assign active users to the operational, clinical, and administrative owner slots. Search starts after two characters.
                      </p>
                    </div>
                    <Button v-if="canManageOwners" size="sm" class="gap-1.5" :disabled="ownersSaving" @click="saveOwners">
                      <AppIcon name="users" class="size-3.5" />
                      {{ ownersSaving ? 'Saving...' : 'Save Owners' }}
                    </Button>
                  </div>
                  <Alert v-if="!canReadUsers && canManageOwners">
                    <AlertTitle>User lookup is restricted</AlertTitle>
                    <AlertDescription>Owner selection needs `platform.users.read` so names can be searched instead of entering user IDs.</AlertDescription>
                  </Alert>
                  <div class="grid gap-3 lg:grid-cols-3">
                    <div v-for="slot in ownerSlots" :key="slot.key" class="flex min-h-[18rem] flex-col gap-3 rounded-lg border bg-muted/20 p-3">
                      <div class="flex items-start gap-2">
                        <span class="rounded-md border bg-background p-2 text-muted-foreground">
                          <AppIcon :name="slot.icon" class="size-4" />
                        </span>
                        <span class="min-w-0">
                          <span class="block text-sm font-medium">{{ slot.label }}</span>
                          <span class="block text-xs text-muted-foreground">{{ slot.description }}</span>
                        </span>
                      </div>
                      <div class="rounded-md border bg-background p-3">
                        <div class="flex items-start justify-between gap-2">
                          <div class="min-w-0">
                            <p class="truncate text-sm font-medium">{{ ownerDisplayName(slot.key) }}</p>
                            <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{{ ownerDisplayMeta(slot.key) }}</p>
                          </div>
                          <Button v-if="ownerId(slot.key) && canManageOwners" type="button" size="sm" variant="ghost" class="h-8 shrink-0 px-2" :disabled="ownersSaving" @click="clearOwner(slot.key)">Clear</Button>
                        </div>
                      </div>
                      <div class="grid gap-2">
                        <div class="relative">
                          <Input
                            :id="`owner-search-${slot.key}`"
                            v-model="ownerSearchStates[slot.key].query"
                            :placeholder="slot.searchPlaceholder"
                            class="pr-10"
                            :disabled="ownerSearchDisabled(slot.key)"
                            @input="scheduleOwnerSearch(slot.key)"
                          />
                          <AppIcon v-if="ownerSearchStates[slot.key].loading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                          <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        </div>
                        <p v-if="firstError(ownerErrors, slot.key)" class="text-xs text-destructive">{{ firstError(ownerErrors, slot.key) }}</p>
                        <p v-else-if="ownerSearchStates[slot.key].error" class="text-xs text-destructive">{{ ownerSearchStates[slot.key].error }}</p>
                        <p v-else-if="ownerSearchLockedReason(slot.key)" class="text-xs text-muted-foreground">{{ ownerSearchLockedReason(slot.key) }}</p>
                      </div>
                      <div class="min-h-0 flex-1 space-y-2">
                        <div v-if="ownerSearchStates[slot.key].loading" class="space-y-2">
                          <Skeleton class="h-11 w-full" />
                          <Skeleton class="h-11 w-full" />
                        </div>
                        <div v-else-if="ownerSearchStates[slot.key].query.trim().length >= 2 && ownerSearchStates[slot.key].candidates.length === 0" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                          No active user matched this search.
                        </div>
                        <div v-else-if="ownerSearchStates[slot.key].query.trim().length < 2" class="rounded-md border border-dashed bg-background p-3 text-xs text-muted-foreground">
                          Type at least two characters to search active users.
                        </div>
                        <button
                          v-for="user in ownerSearchStates[slot.key].candidates"
                          :key="`${slot.key}-${user.id}`"
                          type="button"
                          class="flex w-full items-center justify-between gap-3 rounded-md border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                          :disabled="ownersSaving"
                          @click="selectOwner(slot.key, user)"
                        >
                          <span class="min-w-0">
                            <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                            <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                          </span>
                          <Badge :variant="vStatus(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                        </button>
                      </div>
                    </div>
                  </div>
                </fieldset>

                  </div>
                </TabsContent>

                <TabsContent value="subscription" class="m-0">
                  <div class="grid gap-4 px-6 py-4">
                <fieldset class="grid gap-3 rounded-lg border p-3">
                  <legend class="px-2 text-sm font-medium text-muted-foreground">Subscription and Service Access</legend>
                  <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div class="space-y-1">
                      <p class="text-sm font-medium">{{ selectedSubscriptionPlan?.name || 'No service plan selected' }}</p>
                      <div class="flex flex-wrap items-center gap-1.5">
                        <Badge :variant="subscriptionStatusVariant(subscriptionForm.planId ? subscriptionForm.status : 'not_configured')">
                          {{ formatEnumLabel(subscriptionForm.planId ? subscriptionForm.status : 'not_configured') }}
                        </Badge>
                        <Badge :variant="subscriptionDraftAccessEnabled ? 'secondary' : 'outline'">
                          {{ subscriptionDraftAccessEnabled ? 'Access enabled' : formatEnumLabel(subscriptionDraftAccessState) }}
                        </Badge>
                        <Badge variant="outline">{{ moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode) }}</Badge>
                      </div>
                    </div>
                    <Button v-if="canManageSubscriptions" size="sm" class="gap-1.5" :disabled="subscriptionSaving || subscriptionLoading || subscriptionPlans.length === 0" @click="saveSubscription">
                      <AppIcon name="circle-check-big" class="size-3.5" />
                      {{ subscriptionSaving ? 'Saving...' : 'Save Subscription' }}
                    </Button>
                  </div>

                  <Alert v-if="!canManageSubscriptions">
                    <AlertTitle>Subscription control is restricted</AlertTitle>
                    <AlertDescription>Missing permission: `platform.facilities.manage-subscriptions`.</AlertDescription>
                  </Alert>
                  <Alert v-if="subscriptionError" variant="destructive">
                    <AlertTitle>Subscription load issue</AlertTitle>
                    <AlertDescription>{{ subscriptionError }}</AlertDescription>
                  </Alert>

                  <div class="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div class="rounded-lg border bg-background p-3">
                      <p class="text-xs font-medium uppercase text-muted-foreground">Access state</p>
                      <div class="mt-2 flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">{{ subscriptionAccessSummary.label }}</p>
                        <Badge :variant="subscriptionAccessSummary.tone">
                          {{ !subscriptionForm.planId ? 'Setup needed' : subscriptionDraftAccessEnabled ? 'Open' : 'Restricted' }}
                        </Badge>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">{{ subscriptionAccessSummary.description }}</p>
                    </div>
                    <div class="rounded-lg border bg-background p-3">
                      <p class="text-xs font-medium uppercase text-muted-foreground">Renewal risk</p>
                      <div class="mt-2 flex items-center justify-between gap-2">
                        <p class="text-sm font-semibold">{{ subscriptionRenewalRisk.label }}</p>
                        <Badge :variant="subscriptionRenewalRisk.tone">{{ formatEnumLabel(subscriptionForm.status) }}</Badge>
                      </div>
                      <p class="mt-1 text-xs text-muted-foreground">{{ subscriptionRenewalRisk.description }}</p>
                    </div>
                    <div class="rounded-lg border bg-background p-3">
                      <p class="text-xs font-medium uppercase text-muted-foreground">Fee source</p>
                      <p class="mt-2 text-sm font-semibold">{{ moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode) }}</p>
                      <p class="mt-1 text-xs text-muted-foreground">Derived from {{ selectedSubscriptionPlan?.name || 'selected plan' }}.</p>
                    </div>
                    <div class="rounded-lg border bg-background p-3">
                      <p class="text-xs font-medium uppercase text-muted-foreground">Coverage</p>
                      <p class="mt-2 text-sm font-semibold">{{ subscriptionCoveragePercent }}%</p>
                      <p class="mt-1 text-xs text-muted-foreground">
                        {{ enabledAccessEntitlements.length }} allowed, {{ restrictedAccessEntitlements.length }} restricted.
                      </p>
                    </div>
                  </div>

                  <div v-if="subscriptionLoading" class="grid gap-3">
                    <Skeleton class="h-48 w-full" />
                    <Skeleton class="h-48 w-full" />
                  </div>
                  <div v-else-if="subscriptionPlans.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    No active subscription plans are configured.
                  </div>
                  <div v-else class="grid items-start gap-3">
                    <div class="grid gap-3 rounded-lg border bg-muted/20 p-3">
                      <FormFieldShell input-id="details-subscription-plan" label="Service plan" required :error-message="firstError(subscriptionErrors, 'planId')">
                        <Select
                          :model-value="subscriptionForm.planId || undefined"
                          @update:model-value="applySubscriptionPlanDefaults(String($event ?? ''))"
                        >
                          <SelectTrigger id="details-subscription-plan" class="w-full" :disabled="!canManageSubscriptions || subscriptionSaving">
                            <SelectValue placeholder="Select service plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem v-for="plan in subscriptionPlans" :key="plan.id" :value="plan.id">
                              {{ plan.name || plan.code || 'Unnamed plan' }}
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </FormFieldShell>
                      <div class="rounded-md border bg-background p-3">
                        <p class="text-sm font-medium">{{ selectedSubscriptionPlan?.name || 'Plan not selected' }}</p>
                        <p class="mt-1 text-xs text-muted-foreground">{{ selectedSubscriptionPlan?.description || 'Service plan description not configured.' }}</p>
                        <div class="mt-3 flex flex-wrap gap-1.5">
                          <Badge variant="outline">{{ formatEnumLabel(selectedSubscriptionPlan?.billingCycle ?? 'monthly') }}</Badge>
                          <Badge variant="outline">{{ moneyLabel(selectedSubscriptionPlan?.priceAmount ?? null, selectedSubscriptionPlan?.currencyCode ?? 'TZS') }}</Badge>
                        </div>
                      </div>
                      <div class="grid gap-3 lg:grid-cols-2">
                        <div class="rounded-md border bg-background p-3">
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-xs font-medium uppercase text-muted-foreground">Allowed modules</p>
                            <Badge variant="secondary">{{ enabledAccessEntitlements.length }}</Badge>
                          </div>
                          <div class="mt-2 flex flex-wrap gap-1.5">
                            <Badge
                              v-for="entitlement in enabledAccessEntitlements"
                              :key="`allowed-${entitlement.key || entitlement.id || entitlement.label}`"
                              variant="secondary"
                            >
                              {{ entitlement.label || entitlement.key }}
                            </Badge>
                          </div>
                          <p v-if="enabledAccessEntitlements.length === 0" class="mt-2 text-xs text-muted-foreground">No enabled entitlements on this plan.</p>
                        </div>
                        <div class="rounded-md border bg-background p-3">
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-xs font-medium uppercase text-muted-foreground">Restricted by plan</p>
                            <Badge variant="outline">{{ restrictedAccessEntitlements.length }}</Badge>
                          </div>
                          <div class="mt-2 flex flex-wrap gap-1.5">
                            <Badge
                              v-for="entitlement in restrictedAccessEntitlements.slice(0, 12)"
                              :key="`restricted-${entitlement.key || entitlement.id || entitlement.label}`"
                              variant="outline"
                            >
                              {{ entitlement.label || entitlement.key }}
                            </Badge>
                          </div>
                          <p v-if="restrictedAccessEntitlements.length === 0" class="mt-2 text-xs text-muted-foreground">This plan includes every configured service entitlement.</p>
                          <p v-else-if="restrictedAccessEntitlements.length > 12" class="mt-2 text-xs text-muted-foreground">
                            {{ restrictedAccessEntitlements.length - 12 }} more restricted entitlements are hidden for scanning.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div class="grid gap-3 rounded-lg border p-3">
                      <div class="grid gap-2 rounded-md border bg-muted/20 p-3 sm:grid-cols-5">
                        <div v-for="item in subscriptionTimeline" :key="item.label" class="min-w-0">
                          <p class="text-xs font-medium uppercase text-muted-foreground">{{ item.label }}</p>
                          <p class="mt-1 truncate text-sm font-semibold">{{ dateDistanceLabel(item.value) }}</p>
                          <p class="truncate text-xs text-muted-foreground">{{ fmt(toApiDateTime(item.value)) }}</p>
                        </div>
                      </div>
                      <div class="grid gap-3 sm:grid-cols-2">
                        <FormFieldShell input-id="details-subscription-status" label="Subscription status" required :error-message="firstError(subscriptionErrors, 'status')">
                          <Select v-model="subscriptionForm.status">
                            <SelectTrigger id="details-subscription-status" class="w-full" :disabled="!canManageSubscriptions || subscriptionSaving">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem v-for="status in subscriptionStatusOptions" :key="status.value" :value="status.value">
                                {{ status.label }}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-cycle" label="Billing cycle" helper-text="Derived from the selected service plan.">
                          <Input id="details-subscription-cycle" :model-value="formatEnumLabel(subscriptionForm.billingCycle)" disabled />
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-price" label="Plan fee" helper-text="Changing the plan changes the facility fee.">
                          <Input id="details-subscription-price" :model-value="moneyLabel(subscriptionForm.priceAmount, subscriptionForm.currencyCode)" disabled />
                        </FormFieldShell>
                        <FormFieldShell input-id="details-subscription-currency" label="Currency" helper-text="Derived from the selected service plan.">
                          <Input id="details-subscription-currency" :model-value="subscriptionForm.currencyCode" disabled />
                        </FormFieldShell>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <SingleDatePopoverField
                            input-id="details-subscription-period-start-date"
                            label="Period start date"
                            :model-value="subscriptionDatePart('currentPeriodStartsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving"
                            :error-message="firstError(subscriptionErrors, 'currentPeriodStartsAt')"
                            @update:model-value="(value) => updateSubscriptionDatePart('currentPeriodStartsAt', value)"
                          />
                          <TimePopoverField
                            input-id="details-subscription-period-start-time"
                            label="Period start time"
                            :model-value="subscriptionTimePart('currentPeriodStartsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving || !subscriptionDatePart('currentPeriodStartsAt')"
                            @update:model-value="(value) => updateSubscriptionTimePart('currentPeriodStartsAt', value)"
                          />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <SingleDatePopoverField
                            input-id="details-subscription-period-end-date"
                            label="Period end date"
                            :model-value="subscriptionDatePart('currentPeriodEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving"
                            :error-message="firstError(subscriptionErrors, 'currentPeriodEndsAt')"
                            @update:model-value="(value) => updateSubscriptionDatePart('currentPeriodEndsAt', value)"
                          />
                          <TimePopoverField
                            input-id="details-subscription-period-end-time"
                            label="Period end time"
                            :model-value="subscriptionTimePart('currentPeriodEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving || !subscriptionDatePart('currentPeriodEndsAt')"
                            @update:model-value="(value) => updateSubscriptionTimePart('currentPeriodEndsAt', value)"
                          />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <SingleDatePopoverField
                            input-id="details-subscription-next-invoice-date"
                            label="Next invoice date"
                            :model-value="subscriptionDatePart('nextInvoiceAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving"
                            @update:model-value="(value) => updateSubscriptionDatePart('nextInvoiceAt', value)"
                          />
                          <TimePopoverField
                            input-id="details-subscription-next-invoice-time"
                            label="Next invoice time"
                            :model-value="subscriptionTimePart('nextInvoiceAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving || !subscriptionDatePart('nextInvoiceAt')"
                            @update:model-value="(value) => updateSubscriptionTimePart('nextInvoiceAt', value)"
                          />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <SingleDatePopoverField
                            input-id="details-subscription-trial-end-date"
                            label="Trial end date"
                            :model-value="subscriptionDatePart('trialEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving"
                            :error-message="firstError(subscriptionErrors, 'trialEndsAt')"
                            @update:model-value="(value) => updateSubscriptionDatePart('trialEndsAt', value)"
                          />
                          <TimePopoverField
                            input-id="details-subscription-trial-end-time"
                            label="Trial end time"
                            :model-value="subscriptionTimePart('trialEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving || !subscriptionDatePart('trialEndsAt')"
                            @update:model-value="(value) => updateSubscriptionTimePart('trialEndsAt', value)"
                          />
                        </div>
                        <div class="grid gap-3 sm:col-span-2 sm:grid-cols-2">
                          <SingleDatePopoverField
                            input-id="details-subscription-grace-end-date"
                            label="Grace end date"
                            :model-value="subscriptionDatePart('gracePeriodEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving"
                            :error-message="firstError(subscriptionErrors, 'gracePeriodEndsAt')"
                            @update:model-value="(value) => updateSubscriptionDatePart('gracePeriodEndsAt', value)"
                          />
                          <TimePopoverField
                            input-id="details-subscription-grace-end-time"
                            label="Grace end time"
                            :model-value="subscriptionTimePart('gracePeriodEndsAt')"
                            :disabled="!canManageSubscriptions || subscriptionSaving || !subscriptionDatePart('gracePeriodEndsAt')"
                            @update:model-value="(value) => updateSubscriptionTimePart('gracePeriodEndsAt', value)"
                          />
                        </div>
                        <FormFieldShell input-id="details-subscription-reason" label="Status reason" container-class="sm:col-span-2" :error-message="firstError(subscriptionErrors, 'statusReason')">
                          <Textarea id="details-subscription-reason" v-model="subscriptionForm.statusReason" class="min-h-20" :disabled="!canManageSubscriptions || subscriptionSaving" />
                        </FormFieldShell>
                      </div>
                    </div>
                  </div>
                </fieldset>
                  </div>
                </TabsContent>

                <TabsContent v-if="canViewAudit" value="audit" class="m-0">
                  <div class="grid gap-4 px-6 py-4">
                    <fieldset class="grid gap-4 rounded-lg border p-3">
                      <legend class="px-2 text-sm font-medium text-muted-foreground">Audit Trail</legend>
                      <div class="space-y-1">
                        <p class="text-sm font-medium">Facility change history</p>
                        <p class="max-w-2xl text-xs text-muted-foreground">Review configuration, ownership, status, and policy changes for this facility.</p>
                      </div>

                      <div class="grid gap-4 rounded-lg border bg-muted/10 p-3">
                        <FormFieldShell input-id="details-audit-search" label="Text search" :reserve-message-space="false">
                          <Input id="details-audit-search" v-model="auditFilters.q" placeholder="created, owner updated, status..." />
                        </FormFieldShell>

                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <FormFieldShell input-id="details-audit-action" label="Action">
                            <Input id="details-audit-action" v-model="auditFilters.action" placeholder="status.updated" />
                          </FormFieldShell>
                          <FormFieldShell input-id="details-audit-actor-type" label="Actor type">
                            <Select v-model="auditActorTypeSelectValue">
                              <SelectTrigger id="details-audit-actor-type" class="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem :value="SELECT_ALL_VALUE">All actors</SelectItem>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="system">System</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldShell>
                          <FormFieldShell input-id="details-audit-actor-id" label="Actor ID">
                            <Input id="details-audit-actor-id" v-model="auditFilters.actorId" inputmode="numeric" placeholder="User ID" />
                          </FormFieldShell>
                          <FormFieldShell input-id="details-audit-per-page" label="Rows">
                            <Select v-model="auditPerPageSelectValue">
                              <SelectTrigger id="details-audit-per-page" class="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="10">10 rows</SelectItem>
                                <SelectItem value="20">20 rows</SelectItem>
                                <SelectItem value="50">50 rows</SelectItem>
                              </SelectContent>
                            </Select>
                          </FormFieldShell>
                        </div>

                        <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <SingleDatePopoverField input-id="details-audit-from-date" label="From date" v-model="auditFromDate" />
                          <TimePopoverField input-id="details-audit-from-time" label="From time" v-model="auditFromTime" :disabled="!auditFromDate" />
                          <SingleDatePopoverField input-id="details-audit-to-date" label="To date" v-model="auditToDate" />
                          <TimePopoverField input-id="details-audit-to-time" label="To time" v-model="auditToTime" :disabled="!auditToDate" />
                        </div>
                      </div>

                      <div class="flex flex-col gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
                        <p class="text-xs text-muted-foreground">Export respects the current audit filters.</p>
                        <div class="flex flex-wrap items-center gap-2">
                          <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditLoading" @click="resetAuditFilters">
                            <AppIcon name="refresh-cw" class="size-3.5" />
                            Reset
                          </Button>
                          <Button size="sm" class="gap-1.5" :disabled="auditLoading" @click="loadAudit(1)">
                            <AppIcon name="sliders-horizontal" class="size-3.5" />
                            {{ auditLoading ? 'Applying...' : 'Apply filters' }}
                          </Button>
                          <Button variant="outline" size="sm" class="gap-1.5" :disabled="auditExporting" @click="exportAudit">
                            <AppIcon name="download" class="size-3.5" />
                            {{ auditExporting ? 'Preparing...' : 'Export CSV' }}
                          </Button>
                        </div>
                      </div>
                      <Alert v-if="auditError" variant="destructive"><AlertTitle>Audit load issue</AlertTitle><AlertDescription>{{ auditError }}</AlertDescription></Alert>
                      <div v-else-if="auditLoading" class="space-y-2"><Skeleton class="h-10 w-full" /><Skeleton class="h-10 w-full" /></div>
                      <div v-else-if="audit.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">No audit logs found.</div>
                      <div v-else class="space-y-2">
                        <div v-for="log in audit" :key="log.id" class="rounded-md border p-3 text-sm">
                          <p class="font-medium">{{ log.actionLabel || log.action || 'event' }}</p>
                          <p class="text-xs text-muted-foreground">{{ fmt(log.createdAt) }} | {{ actorLabel(log) }}</p>
                        </div>
                      </div>
                      <div class="flex items-center justify-between border-t pt-2">
                        <Button variant="outline" size="sm" :disabled="auditLoading || (auditMeta?.currentPage ?? 1) <= 1" @click="loadAudit((auditMeta?.currentPage ?? 1) - 1)">Previous</Button>
                        <p class="text-xs text-muted-foreground">Page {{ auditMeta?.currentPage ?? 1 }} of {{ auditMeta?.lastPage ?? 1 }}</p>
                        <Button variant="outline" size="sm" :disabled="auditLoading || !auditMeta || auditMeta.currentPage >= auditMeta.lastPage" @click="loadAudit((auditMeta?.currentPage ?? 1) + 1)">Next</Button>
                      </div>
                    </fieldset>
                  </div>
                </TabsContent>
              </ScrollArea>
            </Tabs>
          </div>
          <SheetFooter class="shrink-0 border-t bg-background px-4 py-3"><Button variant="outline" @click="closeDetails">Close</Button></SheetFooter>
        </SheetContent>
      </Sheet>

      <Sheet :open="createOpen" @update:open="(open) => (open ? (createOpen = true) : closeCreate())">
        <SheetContent side="right" variant="form" size="4xl">
          <SheetHeader class="shrink-0 border-b px-4 py-3 text-left pr-12">
            <SheetTitle class="flex items-center gap-2">
              <AppIcon name="building-2" class="size-5 text-muted-foreground" />
              Create Facility
            </SheetTitle>
            <SheetDescription>Create the hospital foundation and assign its first facility admin.</SheetDescription>
          </SheetHeader>

          <ScrollArea class="min-h-0 flex-1">
            <div class="grid gap-4 px-6 py-4">
              <div class="flex flex-col gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div class="min-w-0">
                  <p class="font-medium">{{ createForm.facilityName || 'New facility' }}</p>
                  <p class="text-muted-foreground">{{ createForm.tenantName || 'Organization' }} | {{ createForm.tenantCountryCode || 'Country' }}</p>
                </div>
                <div class="flex flex-wrap gap-1.5">
                  <Badge variant="outline">{{ createForm.facilityType ? formatEnumLabel(createForm.facilityType) : 'Facility type' }}</Badge>
                  <Badge variant="outline">{{ createForm.facilityTier ? formatEnumLabel(createForm.facilityTier) : 'Facility tier' }}</Badge>
                </div>
              </div>

              <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <legend class="px-2 text-sm font-medium text-muted-foreground">Organization Foundation</legend>
                <FormFieldShell
                  input-id="facility-create-tenant-code"
                  label="Organization code"
                  required
                  :error-message="firstError(createErrors, 'tenantCode')"
                >
                  <Input id="facility-create-tenant-code" v-model="createForm.tenantCode" :disabled="createSaving" />
                </FormFieldShell>
                <FormFieldShell
                  input-id="facility-create-tenant-name"
                  label="Organization name"
                  required
                  :error-message="firstError(createErrors, 'tenantName')"
                >
                  <Input id="facility-create-tenant-name" v-model="createForm.tenantName" :disabled="createSaving" />
                </FormFieldShell>
                <FormFieldShell
                  input-id="facility-create-tenant-country"
                  label="Country"
                  required
                  :error-message="firstError(createErrors, 'tenantCountryCode')"
                >
                  <Select
                    :model-value="createForm.tenantCountryCode || undefined"
                    @update:model-value="createForm.tenantCountryCode = String($event ?? '')"
                  >
                    <SelectTrigger id="facility-create-tenant-country" class="w-full" :disabled="createSaving">
                      <SelectValue placeholder="Select country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="option in createCountryOptions" :key="option.code" :value="option.code">{{ option.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldShell>
                <FormFieldShell
                  input-id="facility-create-tenant-country-profile"
                  label="Allowed country profile"
                  :error-message="firstError(createErrors, 'tenantAllowedCountryCodes') || firstError(createErrors, 'tenantAllowedCountryCodes.0')"
                >
                  <Select
                    :model-value="createForm.tenantAllowedCountryCodes[0] ?? undefined"
                    @update:model-value="createForm.tenantAllowedCountryCodes = $event ? [String($event)] : []"
                  >
                    <SelectTrigger id="facility-create-tenant-country-profile" class="w-full" :disabled="createSaving">
                      <SelectValue placeholder="Select profile" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem v-for="option in createCountryOptions" :key="`allowed-${option.code}`" :value="option.code">{{ option.label }}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldShell>
              </fieldset>

              <fieldset class="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
                <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Profile</legend>
                <FormFieldShell
                  input-id="facility-create-code"
                  label="Facility code"
                  required
                  :error-message="firstError(createErrors, 'facilityCode')"
                >
                  <Input id="facility-create-code" v-model="createForm.facilityCode" :disabled="createSaving" />
                </FormFieldShell>
                <FormFieldShell
                  input-id="facility-create-name"
                  label="Facility name"
                  required
                  :error-message="firstError(createErrors, 'facilityName')"
                >
                  <Input id="facility-create-name" v-model="createForm.facilityName" :disabled="createSaving" />
                </FormFieldShell>
                <FormFieldShell input-id="facility-create-type" label="Facility type">
                  <Select
                    :model-value="createForm.facilityType || undefined"
                    @update:model-value="createForm.facilityType = String($event ?? '')"
                  >
                    <SelectTrigger id="facility-create-type" class="w-full" :disabled="createSaving"><SelectValue placeholder="Select facility type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hospital">Hospital</SelectItem>
                      <SelectItem value="dispensary">Dispensary</SelectItem>
                      <SelectItem value="clinic">Clinic</SelectItem>
                      <SelectItem value="diagnostic_center">Diagnostic center</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldShell>
                <FormFieldShell input-id="facility-create-tier" label="Facility tier">
                  <Select
                    :model-value="createForm.facilityTier || undefined"
                    @update:model-value="createForm.facilityTier = String($event ?? '')"
                  >
                    <SelectTrigger id="facility-create-tier" class="w-full" :disabled="createSaving"><SelectValue placeholder="Select facility tier" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="primary_care">Primary care</SelectItem>
                      <SelectItem value="secondary_care">Secondary care</SelectItem>
                      <SelectItem value="tertiary_care">Tertiary care</SelectItem>
                      <SelectItem value="specialist">Specialist</SelectItem>
                    </SelectContent>
                  </Select>
                </FormFieldShell>
                <FormFieldShell
                  input-id="facility-create-timezone"
                  label="Timezone"
                  container-class="sm:col-span-2"
                >
                  <Input id="facility-create-timezone" v-model="createForm.timezone" :disabled="createSaving" />
                </FormFieldShell>
              </fieldset>

              <fieldset class="grid gap-3 rounded-lg border p-3">
                <legend class="px-2 text-sm font-medium text-muted-foreground">Facility Admin Assignment</legend>

                <div class="inline-flex w-fit rounded-md border bg-muted/20 p-1">
                  <Button
                    type="button"
                    size="sm"
                    :variant="createAdminMode === 'select' ? 'secondary' : 'ghost'"
                    :disabled="createSaving"
                    @click="createAdminMode = 'select'"
                  >
                    Select existing
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    :variant="createAdminMode === 'create' ? 'secondary' : 'ghost'"
                    :disabled="createSaving"
                    @click="createAdminMode = 'create'"
                  >
                    Create new
                  </Button>
                </div>

                <div v-if="createAdminMode === 'select'" class="grid gap-3">
                  <div v-if="selectedFacilityAdmin" class="flex flex-col gap-2 rounded-lg border bg-muted/30 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p class="text-sm font-medium">{{ selectedFacilityAdmin.name || 'Unnamed user' }}</p>
                      <p class="text-xs text-muted-foreground">{{ selectedFacilityAdmin.email || 'No email' }} | {{ userRoleLabel(selectedFacilityAdmin) }}</p>
                    </div>
                    <Button variant="outline" size="sm" :disabled="createSaving" @click="clearFacilityAdmin">Change</Button>
                  </div>

                  <div v-else class="grid gap-3">
                    <FormFieldShell
                      input-id="facility-create-admin-search"
                      label="Eligible Facility Administrator"
                      :error-message="firstError(createErrors, 'facilityAdminUserId')"
                      :reserve-message-space="false"
                    >
                      <div class="relative">
                        <Input
                          id="facility-create-admin-search"
                          v-model="adminSearch"
                          placeholder="Search by name or email"
                          :disabled="createSaving"
                          class="pr-10"
                        />
                        <AppIcon v-if="adminCandidatesLoading" name="refresh-cw" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                        <AppIcon v-else name="search" class="absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                      </div>
                    </FormFieldShell>
                    <Alert v-if="adminCandidatesError" variant="destructive">
                      <AlertTitle>Admin search issue</AlertTitle>
                      <AlertDescription>{{ adminCandidatesError }}</AlertDescription>
                    </Alert>
                    <div v-else-if="adminCandidatesLoading" class="space-y-2">
                      <Skeleton class="h-12 w-full" />
                      <Skeleton class="h-12 w-full" />
                    </div>
                    <div v-else-if="adminCandidates.length === 0" class="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                      {{ adminSearch.trim().length < 2 ? 'Start typing to search eligible Facility Administrators.' : 'No eligible Facility Administrator matched this search.' }}
                    </div>
                    <div v-else class="grid gap-2">
                      <button
                        v-for="user in adminCandidates"
                        :key="String(user.id)"
                        type="button"
                        class="flex items-center justify-between gap-3 rounded-lg border bg-background px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                        :disabled="createSaving"
                        @click="selectFacilityAdmin(user)"
                      >
                        <span class="min-w-0">
                          <span class="block truncate font-medium">{{ user.name || 'Unnamed user' }}</span>
                          <span class="block truncate text-xs text-muted-foreground">{{ user.email || 'No email' }} | {{ userRoleLabel(user) }}</span>
                        </span>
                        <Badge :variant="vStatus(user.status)">{{ formatEnumLabel(user.status) }}</Badge>
                      </button>
                    </div>
                  </div>
                </div>

                <div v-else class="grid gap-3 md:grid-cols-2">
                  <FormFieldShell
                    input-id="facility-create-admin-name"
                    label="Admin name"
                    required
                    :error-message="firstError(createErrors, 'facilityAdmin.name')"
                  >
                    <Input id="facility-create-admin-name" v-model="createAdminForm.name" :disabled="createSaving" />
                  </FormFieldShell>
                  <FormFieldShell
                    input-id="facility-create-admin-email"
                    label="Admin email"
                    required
                    :error-message="firstError(createErrors, 'facilityAdmin.email')"
                  >
                    <Input id="facility-create-admin-email" v-model="createAdminForm.email" type="email" :disabled="createSaving" />
                  </FormFieldShell>
                  <div class="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground md:col-span-2">
                    <AppIcon name="shield-check" class="mt-0.5 size-4 shrink-0" />
                    <span>The new user will be created as an active Facility Administrator for this organization.</span>
                  </div>
                </div>
                <p v-if="firstError(createErrors, 'facilityAdmin')" class="text-xs text-destructive">{{ firstError(createErrors, 'facilityAdmin') }}</p>
              </fieldset>
            </div>
          </ScrollArea>

          <SheetFooter class="shrink-0 border-t bg-background px-4 py-3">
            <div class="flex w-full flex-wrap items-center justify-between gap-2">
              <p class="text-xs text-muted-foreground">
                {{ createForm.facilityName || 'Facility' }} will be created under {{ createForm.tenantName || 'the organization' }}.
              </p>
              <div class="flex items-center gap-2">
                <Button variant="outline" :disabled="createSaving" @click="closeCreate">Cancel</Button>
                <Button :disabled="createSaving" class="gap-1.5" @click="createFacility">
                  <AppIcon name="plus" class="size-3.5" />
                  {{ createSaving ? 'Creating...' : 'Create Facility' }}
                </Button>
              </div>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  </AppLayout>
</template>
