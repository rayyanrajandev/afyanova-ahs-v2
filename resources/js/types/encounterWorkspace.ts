export type EncounterWorkspaceStatusItem = {
    id: string;
    label: string;
    value: string;
    detail?: string | null;
    variant?: 'default' | 'secondary' | 'outline' | 'destructive';
};

export type EncounterWorkspacePaneFocus = 'both' | 'note' | 'care';

export type EncounterComposerSectionItem = {
    id: string;
    label: string;
    complete: boolean;
};
