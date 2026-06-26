<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { Badge } from '@/components/ui/badge';
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { apiRequestJson } from '@/lib/apiClient';

const submissions = ref<any[]>([]);
const loading = ref(false);

const statCards = [
    { label: 'Total Claims', color: 'bg-blue-50', value: ref(0) },
    { label: 'Pending', color: 'bg-yellow-50', value: ref(0) },
    { label: 'Approved', color: 'bg-green-50', value: ref(0) },
    { label: 'Rejected', color: 'bg-red-50', value: ref(0) },
];

async function fetchClaims() {
    loading.value = true;
    try {
        const res = await apiRequestJson('/api/v1/billing-nhif/claims/submissions?perPage=20');
        submissions.value = res.data ?? [];
        statCards[0].value.value = submissions.value.length;
        statCards[1].value.value = submissions.value.filter((s: any) => s.status === 'pending').length;
        statCards[2].value.value = submissions.value.filter((s: any) => s.status === 'approved').length;
        statCards[3].value.value = submissions.value.filter((s: any) => s.status === 'rejected').length;
    } catch (e) {
        console.error('Failed to fetch claims', e);
    } finally {
        loading.value = false;
    }
}

onMounted(fetchClaims);
</script>

<template>
    <div class="space-y-6">
        <div class="grid grid-cols-4 gap-4">
            <Card v-for="stat in statCards" :key="stat.label" :class="stat.color">
                <CardHeader class="pb-2">
                    <CardTitle class="text-sm text-muted-foreground">{{ stat.label }}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div class="text-2xl font-bold">{{ stat.value.value }}</div>
                </CardContent>
            </Card>
        </div>

        <Card>
            <CardHeader>
                <CardTitle>Recent Submissions</CardTitle>
            </CardHeader>
            <CardContent>
                <div v-if="loading" class="text-muted-foreground py-8 text-center">Loading...</div>
                <div v-else-if="submissions.length === 0" class="text-muted-foreground py-8 text-center">No claims found</div>
                <div v-else class="space-y-2">
                    <div v-for="sub in submissions" :key="sub.id" class="flex items-center justify-between rounded-lg border p-3 text-sm">
                        <div>
                            <span class="font-medium">{{ sub.claimNumber || sub.id }}</span>
                            <span class="text-muted-foreground ml-2">{{ sub.patientName || sub.patientId }}</span>
                        </div>
                        <div class="flex items-center gap-2">
                            <span>{{ sub.amount }}</span>
                            <Badge>{{ sub.status }}</Badge>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>Quick Links</CardTitle>
            </CardHeader>
            <CardContent class="flex flex-wrap gap-4">
                <a href="/billing-service-catalog" class="text-sm underline">NHIF Tariff Catalog</a>
                <a href="/claims-insurance" class="text-sm underline">Insurance Workspace</a>
            </CardContent>
        </Card>
    </div>
</template>
