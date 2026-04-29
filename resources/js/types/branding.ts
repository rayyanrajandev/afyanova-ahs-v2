export type SharedBranding = {
    systemName: string;
    shortName: string | null;
    displayName: string;
    logoUrl: string | null;
    hasCustomLogo: boolean;
    appIconUrl: string;
    hasCustomAppIcon: boolean;
};

export type SharedMailBranding = {
    fromName: string;
    fromAddress: string;
    replyToAddress: string | null;
    footerText: string;
    usesCustomFromName: boolean;
    usesCustomFromAddress: boolean;
    usesCustomFooterText: boolean;
    defaults: {
        fromAddress: string;
    };
};
