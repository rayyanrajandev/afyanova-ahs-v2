import { describe, expect, it } from 'vitest';
import {
    buildResultParametersFromTemplate,
    buildResultSummaryFromTemplate,
    IMPRESSION_FIELD_CODE,
    REMARKS_FIELD_CODE,
    REMARKS_IMPRESSION_SECTION_LABEL,
    type ResultTemplateSection,
} from './resultTemplate';

// Mirrors LAB-STOOL-001 in LaboratoryClinicalCatalogSeeder.php — exercises
// every ResultTemplateField type (select, not-done, text, positive-negative,
// number, multiselect).
const stoolSections: ResultTemplateSection[] = [
    {
        label: 'Macroscopic Examination',
        fields: [
            { code: 'colour', label: 'Colour', type: 'select', options: ['Brown', 'Yellow'] },
            { code: 'mucus', label: 'Mucus', type: 'not-done' },
            { code: 'adult_parasites', label: 'Adult Parasites Seen', type: 'text' },
        ],
    },
    {
        label: 'Microscopic Examination',
        fields: [{ code: 'rbc', label: 'Red Blood Cells (RBC)', type: 'text' }],
    },
    {
        label: 'Ova and Parasites',
        fields: [
            {
                code: 'ova_seen',
                label: 'Ova Seen',
                type: 'multiselect',
                options: ['None Seen', 'Ascaris lumbricoides', 'Hookworm'],
            },
        ],
    },
    {
        label: 'Occult Blood',
        fields: [{ code: 'occult_blood', label: 'Occult Blood', type: 'positive-negative' }],
    },
    {
        label: 'Additional Tests',
        fields: [{ code: 'ph', label: 'pH', type: 'number' }],
    },
];

describe('buildResultSummaryFromTemplate', () => {
    it('renders every section with its fields, using an em dash for unset values', () => {
        const summary = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            colour: 'Brown',
            occult_blood: 'Negative',
        });

        expect(summary).toContain('STOOL ANALYSIS');
        expect(summary).toContain('Macroscopic Examination');
        expect(summary).toContain('Colour: Brown');
        expect(summary).toContain('Mucus: —');
        expect(summary).toContain('Occult Blood: Negative');
        expect(summary).toContain('pH: —');
    });

    it('joins multiselect values with a comma, or "None seen" when empty', () => {
        const withOva = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            ova_seen: ['Ascaris lumbricoides', 'Hookworm'],
        });
        expect(withOva).toContain('Ova Seen: Ascaris lumbricoides, Hookworm');

        const withoutOva = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            ova_seen: [],
        });
        expect(withoutOva).toContain('Ova Seen: None seen');
    });

    it('appends a Remarks & Impression block only when either field has content', () => {
        const empty = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {});
        expect(empty).not.toContain('Remarks & Impression');

        const withRemarks = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            [REMARKS_FIELD_CODE]: 'Suggest stool culture if clinically indicated.',
        });
        expect(withRemarks).toContain('Remarks & Impression');
        expect(withRemarks).toContain('Remarks: Suggest stool culture if clinically indicated.');
        expect(withRemarks).not.toContain('Impression:');

        const withImpression = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            [IMPRESSION_FIELD_CODE]: 'Normal stool microscopy.',
        });
        expect(withImpression).toContain('Impression: Normal stool microscopy.');
    });

    it('treats whitespace-only remarks/impression as absent', () => {
        const summary = buildResultSummaryFromTemplate('Stool Analysis', stoolSections, {
            [REMARKS_FIELD_CODE]: '   ',
            [IMPRESSION_FIELD_CODE]: '',
        });
        expect(summary).not.toContain('Remarks & Impression');
    });
});

describe('buildResultParametersFromTemplate', () => {
    it('skips fields with no value, undefined, or empty string', () => {
        const params = buildResultParametersFromTemplate(stoolSections, {
            colour: 'Brown',
            mucus: '',
            rbc: undefined as unknown as string,
        });

        expect(params.map((p) => p.code)).toEqual(['colour']);
    });

    it('carries the section label on every field-derived parameter', () => {
        const params = buildResultParametersFromTemplate(stoolSections, {
            colour: 'Brown',
            occult_blood: 'Negative',
        });

        expect(params.find((p) => p.code === 'colour')?.section).toBe('Macroscopic Examination');
        expect(params.find((p) => p.code === 'occult_blood')?.section).toBe('Occult Blood');
    });

    it('joins multiselect arrays into a comma-separated value string', () => {
        const params = buildResultParametersFromTemplate(stoolSections, {
            ova_seen: ['Ascaris lumbricoides', 'Hookworm'],
        });

        expect(params.find((p) => p.code === 'ova_seen')?.value).toBe('Ascaris lumbricoides, Hookworm');
    });

    it('sets unit/flag/referenceRange to null for template-derived parameters', () => {
        const params = buildResultParametersFromTemplate(stoolSections, { colour: 'Brown' });
        const colour = params.find((p) => p.code === 'colour');

        expect(colour).toMatchObject({ unit: null, flag: null, referenceRange: null });
    });

    it('appends Remarks/Impression as their own parameters under a shared section label', () => {
        const params = buildResultParametersFromTemplate(stoolSections, {
            [REMARKS_FIELD_CODE]: 'No parasites seen.',
            [IMPRESSION_FIELD_CODE]: 'Normal stool microscopy.',
        });

        const remarks = params.find((p) => p.code === REMARKS_FIELD_CODE);
        const impression = params.find((p) => p.code === IMPRESSION_FIELD_CODE);

        expect(remarks).toMatchObject({
            name: 'Remarks',
            value: 'No parasites seen.',
            section: REMARKS_IMPRESSION_SECTION_LABEL,
        });
        expect(impression).toMatchObject({
            name: 'Impression',
            value: 'Normal stool microscopy.',
            section: REMARKS_IMPRESSION_SECTION_LABEL,
        });
    });

    it('omits Remarks/Impression parameters when both are blank', () => {
        const params = buildResultParametersFromTemplate(stoolSections, { colour: 'Brown' });

        expect(params.some((p) => p.code === REMARKS_FIELD_CODE)).toBe(false);
        expect(params.some((p) => p.code === IMPRESSION_FIELD_CODE)).toBe(false);
    });
});
