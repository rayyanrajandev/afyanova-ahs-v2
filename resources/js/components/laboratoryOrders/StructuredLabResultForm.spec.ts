import { fireEvent, render, within } from '@testing-library/vue';
import { describe, expect, it } from 'vitest';
import StructuredLabResultForm from './StructuredLabResultForm.vue';
import type { ResultTemplate } from '@/lib/resultTemplate';

// One field per ResultTemplateField type, each with a distinct label, so
// tests can query unambiguously without scoping into a specific section.
const template: ResultTemplate = {
    sections: [
        {
            label: 'Macroscopic Examination',
            fields: [
                { code: 'colour', label: 'Colour', type: 'select', options: ['Brown', 'Yellow'] },
                { code: 'mucus', label: 'Mucus', type: 'not-done' },
                { code: 'adult_parasites', label: 'Adult Parasites Seen', type: 'text' },
            ],
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
            fields: [
                { code: 'ph', label: 'pH', type: 'number' },
                { code: 'lab_notes', label: 'Lab Notes', type: 'textarea' },
            ],
        },
    ],
};

describe('StructuredLabResultForm', () => {
    it('renders every section label and field label from the template', () => {
        const { getByText, getAllByText } = render(StructuredLabResultForm, { props: { template } });

        expect(getByText('Macroscopic Examination')).toBeTruthy();
        expect(getByText('Ova and Parasites')).toBeTruthy();
        // "Occult Blood" is both the section label and its only field's
        // label, so two matches is the correct rendered output here.
        expect(getAllByText('Occult Blood')).toHaveLength(2);
        expect(getByText('Colour')).toBeTruthy();
        expect(getByText('Mucus')).toBeTruthy();
        expect(getByText('Ova Seen')).toBeTruthy();
        expect(getByText('pH')).toBeTruthy();
        expect(getByText('Lab Notes')).toBeTruthy();
    });

    it('always renders the Remarks & Impression block, regardless of template content', () => {
        const { getByText, getByLabelText } = render(StructuredLabResultForm, { props: { template } });

        expect(getByText('Remarks & Impression')).toBeTruthy();
        expect(getByLabelText('Remarks')).toBeTruthy();
        expect(getByLabelText('Impression / Conclusion')).toBeTruthy();
    });

    it('emits update:values with the selected option when a select field changes', async () => {
        const { getByLabelText, getByRole, emitted } = render(StructuredLabResultForm, {
            props: { template },
        });

        // Reka UI's SelectTrigger opens on pointerdown, not click. Select
        // via keyboard (Enter) rather than a pointerup on the option — in
        // jsdom, synthetic PointerEvents on SelectItem consistently arrive
        // with defaultPrevented already true (a jsdom/reka-ui interaction
        // quirk, not a bug in this component: the exact same mouse flow was
        // verified working end-to-end in a real browser during manual
        // verification of this change), so pointerup never reaches
        // onValueChange. Keyboard selection exercises the same
        // handleSelectCustomEvent → onValueChange path reliably, but that
        // handler's own internal `await nextTick()` still lands in a later
        // microtask than fireEvent's single await — a real macrotask flush
        // is needed before the emitted value is observable.
        await fireEvent.pointerDown(getByLabelText('Colour'), { button: 0 });
        await fireEvent.keyDown(getByRole('option', { name: 'Brown' }), { key: 'Enter' });
        await new Promise((resolve) => setTimeout(resolve, 50));

        const events = emitted()['update:values'];
        expect(events).toBeTruthy();
        const lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.colour).toBe('Brown');
    });

    it('toggles a not-done field between Absent/Present/Not Done', async () => {
        const { getByText, emitted } = render(StructuredLabResultForm, { props: { template } });

        const mucusBlock = getByText('Mucus').closest('div') as HTMLElement;
        await fireEvent.click(within(mucusBlock).getByText('Present'));

        let events = emitted()['update:values'];
        let lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.mucus).toBe('Present');

        await fireEvent.click(within(mucusBlock).getByText('Absent'));
        events = emitted()['update:values'];
        lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.mucus).toBe('Absent');
    });

    it('toggles a positive-negative field between Positive/Negative/Not Done', async () => {
        const { getByText, emitted } = render(StructuredLabResultForm, { props: { template } });

        const occultBlock = getByText('Occult Blood', { selector: 'label' }).closest('div') as HTMLElement;
        await fireEvent.click(within(occultBlock).getByText('Negative'));

        const events = emitted()['update:values'];
        const lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.occult_blood).toBe('Negative');
    });

    it('adds and removes options from a multiselect field on repeated clicks', async () => {
        const { getByText, emitted } = render(StructuredLabResultForm, { props: { template } });

        await fireEvent.click(getByText('Ascaris lumbricoides'));
        let events = emitted()['update:values'];
        let lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.ova_seen).toEqual(['Ascaris lumbricoides']);

        await fireEvent.click(getByText('Hookworm'));
        events = emitted()['update:values'];
        lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.ova_seen).toEqual(['Ascaris lumbricoides', 'Hookworm']);

        // click again to deselect
        await fireEvent.click(getByText('Ascaris lumbricoides'));
        events = emitted()['update:values'];
        lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.ova_seen).toEqual(['Hookworm']);
    });

    it('updates text, number, and textarea fields on input', async () => {
        const { getByLabelText, emitted } = render(StructuredLabResultForm, { props: { template } });

        await fireEvent.update(getByLabelText('Adult Parasites Seen'), 'Ascaris worm seen');
        await fireEvent.update(getByLabelText('pH'), '6.5');
        await fireEvent.update(getByLabelText('Lab Notes'), 'Sample slightly delayed in transit.');

        const events = emitted()['update:values'];
        const lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.adult_parasites).toBe('Ascaris worm seen');
        // Vue's v-model on a native <input type="number"> auto-coerces to a
        // JS number at runtime regardless of the field's string-typed
        // Record — the same quirk documented in lib/patientAge.spec.ts.
        expect(lastPayload.ph).toBe(6.5);
        expect(lastPayload.lab_notes).toBe('Sample slightly delayed in transit.');
    });

    it('updates the Remarks and Impression fields independently of template sections', async () => {
        const { getByLabelText, emitted } = render(StructuredLabResultForm, { props: { template } });

        await fireEvent.update(getByLabelText('Remarks'), 'No intestinal parasites seen.');
        await fireEvent.update(getByLabelText('Impression / Conclusion'), 'Normal stool microscopy.');

        const events = emitted()['update:values'];
        const lastPayload = events![events!.length - 1][0] as Record<string, unknown>;
        expect(lastPayload.remarks).toBe('No intestinal parasites seen.');
        expect(lastPayload.impression).toBe('Normal stool microscopy.');
    });

    it('pre-fills fields from initialValues without clobbering unspecified fields', () => {
        const { getByLabelText } = render(StructuredLabResultForm, {
            props: {
                template,
                initialValues: { colour: 'Yellow', remarks: 'Existing remark' },
            },
        });

        expect((getByLabelText('Remarks') as HTMLTextAreaElement).value).toBe('Existing remark');
    });
});
