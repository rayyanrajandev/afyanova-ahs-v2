<?php

namespace App\Modules\MedicalRecord\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\MedicalRecord\Application\UseCases\GetMedicalRecordUseCase;
use App\Modules\MedicalRecord\Domain\Repositories\MedicalRecordAuditLogRepositoryInterface;
use App\Modules\MedicalRecord\Presentation\Http\Transformers\MedicalRecordResponseTransformer;
use App\Support\Branding\SystemBrandingManager;
use App\Support\Documents\BrandedPdfDocumentManager;
use App\Support\Documents\ClinicalDocumentLookup;
use App\Support\Documents\DocumentAuditTrailManager;
use App\Support\Documents\DocumentContextLookup;
use Illuminate\Http\Request;
use Illuminate\Http\Response as HttpResponse;
use Inertia\Inertia;
use Inertia\Response;

class MedicalRecordDocumentController extends Controller
{
    public function show(
        string $id,
        Request $request,
        GetMedicalRecordUseCase $recordUseCase,
        DocumentContextLookup $documentContextLookup,
        ClinicalDocumentLookup $clinicalDocumentLookup,
        SystemBrandingManager $brandingManager,
    ): Response {
        return Inertia::render('medical-records/Print', $this->buildPayload(
            id: $id,
            request: $request,
            recordUseCase: $recordUseCase,
            documentContextLookup: $documentContextLookup,
            clinicalDocumentLookup: $clinicalDocumentLookup,
            brandingManager: $brandingManager,
        ));
    }

    public function downloadPdf(
        string $id,
        Request $request,
        GetMedicalRecordUseCase $recordUseCase,
        DocumentContextLookup $documentContextLookup,
        ClinicalDocumentLookup $clinicalDocumentLookup,
        SystemBrandingManager $brandingManager,
        BrandedPdfDocumentManager $pdfDocumentManager,
        DocumentAuditTrailManager $documentAuditTrailManager,
        MedicalRecordAuditLogRepositoryInterface $auditLogRepository,
    ): HttpResponse {
        $payload = $this->buildPayload(
            id: $id,
            request: $request,
            recordUseCase: $recordUseCase,
            documentContextLookup: $documentContextLookup,
            clinicalDocumentLookup: $clinicalDocumentLookup,
            brandingManager: $brandingManager,
        );
        $payload['documentBranding'] = $brandingManager->documentPdfBranding();

        $safeIdentifier = $pdfDocumentManager->sanitizeIdentifier(
            (string) ($payload['record']['recordNumber'] ?? $id),
            'medical_record',
        );
        $filename = $pdfDocumentManager->makeBrandedFilename('medical_record_'.$safeIdentifier);

        $response = $pdfDocumentManager->downloadView(
            view: 'documents.medical-record',
            data: $payload,
            baseName: 'medical_record_'.$safeIdentifier,
            extraHeaders: [
                'X-Document-Source' => 'medical-record',
                'X-Document-Source-Id' => (string) ($payload['record']['id'] ?? $id),
            ],
        );

        $documentAuditTrailManager->recordPdfDownload(
            request: $request,
            action: 'medical-record.document.pdf.downloaded',
            source: 'medical-record',
            sourceId: (string) ($payload['record']['id'] ?? $id),
            filename: $filename,
            writer: static function (string $action, ?int $actorId, array $changes, array $metadata) use ($auditLogRepository, $payload, $id): void {
                $auditLogRepository->write(
                    medicalRecordId: (string) ($payload['record']['id'] ?? $id),
                    action: $action,
                    actorId: $actorId,
                    changes: $changes,
                    metadata: $metadata,
                );
            },
            extraMetadata: [
                'document_number' => $payload['record']['recordNumber'] ?? null,
                'patient_id' => $payload['patient']['id'] ?? null,
                'appointment_id' => $payload['appointment']['id'] ?? null,
                'admission_id' => $payload['admission']['id'] ?? null,
                'appointment_referral_id' => $payload['appointmentReferral']['id'] ?? null,
                'theatre_procedure_id' => $payload['theatreProcedure']['id'] ?? null,
            ],
        );

        return $response;
    }

    /**
     * @return array<string, mixed>
     */
    private function buildPayload(
        string $id,
        Request $request,
        GetMedicalRecordUseCase $recordUseCase,
        DocumentContextLookup $documentContextLookup,
        ClinicalDocumentLookup $clinicalDocumentLookup,
        SystemBrandingManager $brandingManager,
    ): array {
        $record = $recordUseCase->execute($id);
        abort_if($record === null, 404, 'Medical record not found.');

        $canViewEncounterOrders = [
            'laboratory' => (bool) $request->user()?->can('laboratory.orders.read'),
            'pharmacy' => (bool) $request->user()?->can('pharmacy.orders.read'),
            'radiology' => (bool) $request->user()?->can('radiology.orders.read'),
            'theatre' => (bool) $request->user()?->can('theatre.procedures.read'),
        ];

        return [
            'record' => MedicalRecordResponseTransformer::transform($record),
            'patient' => $documentContextLookup->patientSummary($record['patient_id'] ?? null),
            'appointment' => $documentContextLookup->appointmentSummary($record['appointment_id'] ?? null),
            'admission' => $documentContextLookup->admissionSummary($record['admission_id'] ?? null),
            'appointmentReferral' => $documentContextLookup->appointmentReferralSummary($record['appointment_referral_id'] ?? null),
            'theatreProcedure' => $documentContextLookup->theatreProcedureSummary($record['theatre_procedure_id'] ?? null),
            'author' => $documentContextLookup->userSummary($record['author_user_id'] ?? null),
            'signer' => $documentContextLookup->userSummary($record['signed_by_user_id'] ?? null),
            'diagnosis' => $clinicalDocumentLookup->diagnosisSummary($record['diagnosis_code'] ?? null),
            'attestations' => $clinicalDocumentLookup->medicalRecordAttestations($id),
            'versionSummary' => $clinicalDocumentLookup->medicalRecordVersionSummary($id),
            'encounterResources' => [
                'laboratory' => $canViewEncounterOrders['laboratory']
                    ? $clinicalDocumentLookup->encounterLaboratoryOrders(
                        $record['patient_id'] ?? null,
                        $record['appointment_id'] ?? null,
                        $record['admission_id'] ?? null,
                    )
                    : [],
                'pharmacy' => $canViewEncounterOrders['pharmacy']
                    ? $clinicalDocumentLookup->encounterPharmacyOrders(
                        $record['patient_id'] ?? null,
                        $record['appointment_id'] ?? null,
                        $record['admission_id'] ?? null,
                    )
                    : [],
                'radiology' => $canViewEncounterOrders['radiology']
                    ? $clinicalDocumentLookup->encounterRadiologyOrders(
                        $record['patient_id'] ?? null,
                        $record['appointment_id'] ?? null,
                        $record['admission_id'] ?? null,
                    )
                    : [],
                'theatre' => $canViewEncounterOrders['theatre']
                    ? $clinicalDocumentLookup->encounterTheatreProcedures(
                        $record['patient_id'] ?? null,
                        $record['appointment_id'] ?? null,
                        $record['admission_id'] ?? null,
                    )
                    : [],
            ],
            'canViewEncounterOrders' => $canViewEncounterOrders,
            'documentBranding' => $brandingManager->documentBranding(),
            'generatedAt' => now()->toISOString(),
        ];
    }
}
