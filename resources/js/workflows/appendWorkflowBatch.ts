import type { ApiEnvelope, DashboardBatchEntry, DashboardLoaderDeps } from '@/workflows/types';

export function appendWorkflowBatchEntries(
    preset: string,
    batch: DashboardBatchEntry[],
    deps: DashboardLoaderDeps,
): void {
    const { guardedRequest, apiGet, currentUserId } = deps;
    const clinicianAppointmentQuery = currentUserId !== null ? { clinicianUserId: currentUserId } : {};

    switch (preset) {

        case 'front_desk':
            batch.push(
                ['patientCounts', () => guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts'))],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                [
                    'scheduledAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Scheduled appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'scheduled', perPage: 8, sortBy: 'scheduledAt', sortDir: 'asc' }),
                        ),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 5, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'clinician':
            batch.push(
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () =>
                        apiGet('/appointments/status-counts', clinicianAppointmentQuery),
                    ),
                ],
                ['medicalRecordCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Medical record counts', 'medical.records.read', () => apiGet('/medical-records/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                [
                    'waitingProviderAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Waiting provider appointments', 'appointments.read', () =>
                            apiGet('/appointments', {
                                ...clinicianAppointmentQuery,
                                status: 'waiting_provider',
                                perPage: 5,
                                sortBy: 'checkedInAt',
                                sortDir: 'asc',
                            }),
                        ),
                ],
                [
                    'inConsultationAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('In-consultation appointments', 'appointments.read', () =>
                            apiGet('/appointments', {
                                ...clinicianAppointmentQuery,
                                status: 'in_consultation',
                                perPage: 3,
                                sortBy: 'updatedAt',
                                sortDir: 'desc',
                            }),
                        ),
                ],
                [
                    'clinicalDirectory',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Clinical directory', 'staff.clinical-directory.read', () =>
                            apiGet('/staff/clinical-directory', {
                                status: 'active',
                                clinicalOnly: 'true',
                                page: 1,
                                perPage: 200,
                            }),
                        ),
                ],
            );
            break;
        case 'direct_service':
            batch.push(
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                ['radiologyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology counts', 'radiology.orders.read', () => apiGet('/radiology-orders/status-counts')),
                ],
                ['radiologyOpenOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology open worklist', 'radiology.orders.read', () =>
                        apiGet('/radiology-orders', { worklistScope: 'open', perPage: 40, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['radiologyOrderedOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology ordered worklist', 'radiology.orders.read', () =>
                        apiGet('/radiology-orders', { status: 'ordered', perPage: 4, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['radiologyScheduledOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology scheduled worklist', 'radiology.orders.read', () =>
                        apiGet('/radiology-orders', { status: 'scheduled', perPage: 4, sortBy: 'scheduledFor', sortDir: 'asc' }),
                    ),
                ],
                ['radiologyInProgressOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Radiology active worklist', 'radiology.orders.read', () =>
                        apiGet('/radiology-orders', { status: 'in_progress', perPage: 4, sortBy: 'updatedAt', sortDir: 'asc' }),
                    ),
                ],
                ['laboratoryOrderedOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory ordered worklist', 'laboratory.orders.read', () =>
                        apiGet('/laboratory-orders', { status: 'ordered', perPage: 4, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['laboratoryOpenOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory open worklist', 'laboratory.orders.read', () =>
                        apiGet('/laboratory-orders', { worklistScope: 'open', perPage: 40, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['laboratoryCollectedOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory collected worklist', 'laboratory.orders.read', () =>
                        apiGet('/laboratory-orders', { status: 'collected', perPage: 4, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['laboratoryInProgressOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory active worklist', 'laboratory.orders.read', () =>
                        apiGet('/laboratory-orders', { status: 'in_progress', perPage: 4, sortBy: 'updatedAt', sortDir: 'asc' }),
                    ),
                ],
                ['pharmacyPendingOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy pending worklist', 'pharmacy.orders.read', () =>
                        apiGet('/pharmacy-orders', { status: 'pending', perPage: 4, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['pharmacyOpenOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy open worklist', 'pharmacy.orders.read', () =>
                        apiGet('/pharmacy-orders', { worklistScope: 'open', perPage: 40, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['pharmacyInPreparationOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy preparation worklist', 'pharmacy.orders.read', () =>
                        apiGet('/pharmacy-orders', { status: 'in_preparation', perPage: 4, sortBy: 'orderedAt', sortDir: 'asc' }),
                    ),
                ],
                ['pharmacyPartiallyDispensedOrders', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy partial dispense worklist', 'pharmacy.orders.read', () =>
                        apiGet('/pharmacy-orders', { status: 'partially_dispensed', perPage: 4, sortBy: 'updatedAt', sortDir: 'asc' }),
                    ),
                ],
            );
            break;
        case 'nursing':
            batch.push(
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                ['wardTaskCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward task counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/task-status-counts')),
                ],
                ['wardCarePlanCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward care plan counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/care-plan-status-counts')),
                ],
                ['wardDischargeChecklistCounts', () =>
                    guardedRequest<ApiEnvelope<any>>(
                        'Ward discharge checklist counts',
                        'inpatient.ward.read',
                        () => apiGet('/inpatient-ward/discharge-checklist-status-counts'),
                    ),
                ],
                ['vitalsOverdueCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Vitals overdue summary', 'inpatient.ward.read', () => apiGet('/patient-vitals/overdue-summary')),
                ],
                [
                    'admissions',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Admissions', 'admissions.read', () =>
                            apiGet('/admissions', { status: 'admitted', perPage: 2, sortBy: 'admittedAt', sortDir: 'desc' }),
                        ),
                ],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Checked-in appointments', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 5, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'emergency':
            batch.push(
                ['patientCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts')),
                ],
                ['appointmentCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Appointment counts', 'appointments.read', () => apiGet('/appointments/status-counts')),
                ],
                ['admissionCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Admission counts', 'admissions.read', () => apiGet('/admissions/status-counts')),
                ],
                ['laboratoryCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Laboratory counts', 'laboratory.orders.read', () => apiGet('/laboratory-orders/status-counts')),
                ],
                ['pharmacyCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Pharmacy counts', 'pharmacy.orders.read', () => apiGet('/pharmacy-orders/status-counts')),
                ],
                ['emergencyTriageCaseCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Emergency triage case counts', 'emergency.triage.read', () => apiGet('/emergency-triage-cases/status-counts')),
                ],
                ['wardBedCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward bed counts', 'platform.resources.view-ward-beds', () => apiGet('/platform/admin/ward-beds/status-counts')),
                ],
                ['operationalFlagsCounts', () =>
                    safeRequest<ApiEnvelope<any>>('Operational flags', () => apiGet('/platform/operational-flags')),
                ],
                [
                    'checkedInAppointments',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Triage queue', 'appointments.read', () =>
                            apiGet('/appointments', { status: 'checked_in', perPage: 10, sortBy: 'checkedInAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'cashier':
            batch.push(
                ['billingCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Billing counts', 'billing.invoices.read', () => apiGet('/billing-invoices/status-counts')),
                ],
                [
                    'claimOpenCounts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Open claim exceptions', 'claims.insurance.read', () =>
                            apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'open' }),
                        ),
                ],
                [
                    'claimResolvedCounts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Resolved claim exceptions', 'claims.insurance.read', () =>
                            apiGet('/claims-insurance/status-counts', { reconciliationExceptionStatus: 'resolved' }),
                        ),
                ],
                [
                    'draftInvoices',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Draft invoices', 'billing.invoices.read', () =>
                            apiGet('/billing-invoices', { status: 'draft', perPage: 3 }),
                        ),
                ],
            );
            break;
        case 'operations':
            batch.push(
                ['staffStatusCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Staff status counts', 'staff.read', () => apiGet('/staff/status-counts')),
                ],
                [
                    'credentialingAlerts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Credentialing alerts', 'staff.credentialing.read', () =>
                            apiGet('/staff/credentialing-alerts', { perPage: 8, page: 1 }),
                        ),
                ],
                [
                    'privilegeCoverageBoard',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Privilege coverage board', 'staff.privileges.read', () =>
                            apiGet('/staff/privileges/coverage-board', { maxStaff: 120 }),
                        ),
                ],
            );
            break;
        case 'records':
            batch.push(
                ['patientCounts', () => guardedRequest<ApiEnvelope<any>>('Patient counts', 'patients.read', () => apiGet('/patients/status-counts'))],
                ['medicalRecordCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Medical record counts', 'medical.records.read', () => apiGet('/medical-records/status-counts')),
                ],
                [
                    'draftMedicalRecords',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Draft medical records', 'medical.records.read', () =>
                            apiGet('/medical-records', { status: 'draft', perPage: 8, sortBy: 'updatedAt', sortDir: 'desc' }),
                        ),
                ],
            );
            break;
        case 'supply':
            batch.push(
                [
                    'inventoryStockAlerts',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Inventory stock alerts', 'inventory.procurement.read', () =>
                            apiGet('/inventory-procurement/stock-alert-counts'),
                        ),
                ],
                [
                    'procurementRequests',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Procurement requests', 'inventory.procurement.read', () =>
                            apiGet('/inventory-procurement/procurement-requests', { perPage: 8, page: 1, sortBy: 'updatedAt', sortDir: 'desc' }),
                        ),
                ],
            );
            break;
        case 'theatre':
            batch.push(
                ['theatreProcedureCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Theatre procedure counts', 'theatre.procedures.read', () =>
                        apiGet('/theatre-procedures/status-counts'),
                    ),
                ],
                [
                    'theatreProcedures',
                    () =>
                        guardedRequest<ApiEnvelope<any>>('Theatre procedures', 'theatre.procedures.read', () =>
                            apiGet('/theatre-procedures', { perPage: 5, sortBy: 'scheduledAt', sortDir: 'asc' }),
                        ),
                ],
            );
            break;
        case 'admin':
            batch.push(
                ['wardTaskCounts', () =>
                    guardedRequest<ApiEnvelope<any>>('Ward task counts', 'inpatient.ward.read', () => apiGet('/inpatient-ward/task-status-counts')),
                ],
            );
            break;
    }
}
