<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
</script>

<template>
    <Card class="rounded-lg border-sidebar-border/70">
        <CardHeader>
            <CardTitle>Create Billing Draft</CardTitle>
            <CardDescription>
                You do not have permission to create billing drafts.
            </CardDescription>
        </CardHeader>
        <CardContent>
            <Alert variant="destructive">
                <AlertTitle>Create access restricted</AlertTitle>
                <AlertDescription>
                    Request <code>billing.invoices.create</code> permission to open
                    cashier invoice creation workflows.
                </AlertDescription>
            </Alert>
        </CardContent>
    </Card>
</template>
