export type SharedPlatformTenant = {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    countryCode?: string | null;
    status?: string | null;
} | null;

export type SharedPlatformFacility = {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    facilityType?: string | null;
    timezone?: string | null;
    isPrimary?: boolean;
    assignmentRole?: string | null;
} | null;

export type SharedPlatformAccessibleFacility = {
    id?: string | null;
    code?: string | null;
    name?: string | null;
    facilityType?: string | null;
    timezone?: string | null;
    isPrimary?: boolean;
    assignmentRole?: string | null;
    tenantId?: string | null;
    tenantCode?: string | null;
    tenantName?: string | null;
};

export type SharedPlatformScope = {
    resolvedFrom: string;
    tenant: SharedPlatformTenant;
    facility: SharedPlatformFacility;
    headers?: {
        tenantCode?: string | null;
        facilityCode?: string | null;
    };
    userAccess?: {
        accessibleFacilityCount?: number;
        facilities?: SharedPlatformAccessibleFacility[];
    };
} | null;

export type SharedPlatformFeatureFlags = {
    multiTenantIsolation: boolean;
    multiFacilityScoping: boolean;
};

export type SharedPlatformMail = {
    defaultMailer?: string | null;
    fromName?: string | null;
    fromAddress?: string | null;
    replyToAddress?: string | null;
    deliversExternally?: boolean;
    supportsCredentialLinkPreview?: boolean;
    warning?: string | null;
};

export type SharedPlatformUploadLimits = {
    documentMaxBytes?: number | null;
    documentMaxLabel?: string | null;
};

export type SharedPlatformContext = {
    scope: SharedPlatformScope;
    featureFlags: SharedPlatformFeatureFlags;
    mail?: SharedPlatformMail;
    uploadLimits?: SharedPlatformUploadLimits;
};

