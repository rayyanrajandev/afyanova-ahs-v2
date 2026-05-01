export type User = {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    email_verified_at: string | null;
    created_at: string;
    updated_at: string;
    [key: string]: unknown;
};

export type Auth = {
    user: User | null;
    permissions: string[];
    /** Active role codes (uppercase); prefer server-sent list for preset inference without an extra round-trip. */
    roleCodes?: string[];
    isFacilitySuperAdmin?: boolean;
    isPlatformSuperAdmin?: boolean;
};

export type TwoFactorConfigContent = {
    title: string;
    description: string;
    buttonText: string;
};
