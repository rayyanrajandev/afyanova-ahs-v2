import { QueryClient, VueQueryPlugin } from '@tanstack/vue-query';
import { flushPromises } from '@vue/test-utils';
import { render } from '@testing-library/vue';
import { defineComponent, h } from 'vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as apiClient from '@/lib/apiClient';
import { formatDiffValue, useMedicalRecordVersions, versionLabel } from './useMedicalRecordVersions';

async function mount(build: () => ReturnType<typeof useMedicalRecordVersions>) {
    let composable!: ReturnType<typeof useMedicalRecordVersions>;
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const TestComponent = defineComponent({
        setup() {
            composable = build();
            return () => h('div');
        },
    });

    render(TestComponent, { global: { plugins: [[VueQueryPlugin, { queryClient }]] } });
    await flushPromises();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await flushPromises();

    return composable;
}

describe('useMedicalRecordVersions', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('selects the most recent version by default and loads its diff against the previous version', async () => {
        vi.spyOn(apiClient, 'apiGet').mockImplementation(async (path: string) => {
            if (path === '/medical-records/rec-1/versions') {
                return {
                    data: [
                        { id: 'v2', medicalRecordId: 'rec-1', versionNumber: 2, snapshot: {}, changedFields: ['plan'], createdByUserId: 1, createdAt: '2026-01-02T00:00:00Z' },
                        { id: 'v1', medicalRecordId: 'rec-1', versionNumber: 1, snapshot: {}, changedFields: [], createdByUserId: 1, createdAt: '2026-01-01T00:00:00Z' },
                    ],
                };
            }
            return {
                data: {
                    targetVersion: null,
                    baseVersion: null,
                    diff: [{ field: 'plan', before: 'A', after: 'B' }],
                    summary: { changedFieldCount: 1 },
                },
            };
        });

        const versions = await mount(() => useMedicalRecordVersions(() => 'rec-1'));

        expect(versions.selectedVersionId.value).toBe('v2');
        expect(versions.diff.value?.summary.changedFieldCount).toBe(1);
    });

    it('formats a version label with its number and date', () => {
        const label = versionLabel(
            { id: 'v1', medicalRecordId: null, versionNumber: 3, snapshot: {}, changedFields: [], createdByUserId: null, createdAt: '2026-01-01T00:00:00Z' },
            (value) => (value ? `formatted(${value})` : 'N/A'),
        );
        expect(label).toBe('v3 (formatted(2026-01-01T00:00:00Z))');
    });

    it('formats diff values for display, including null and objects', () => {
        expect(formatDiffValue(null)).toBe('null');
        expect(formatDiffValue('')).toBe("''");
        expect(formatDiffValue('text')).toBe('text');
        expect(formatDiffValue(42)).toBe('42');
        expect(formatDiffValue({ a: 1 })).toBe('{"a":1}');
    });
});
