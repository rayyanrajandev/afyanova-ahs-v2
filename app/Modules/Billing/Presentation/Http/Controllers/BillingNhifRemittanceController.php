<?php

namespace App\Modules\Billing\Presentation\Http\Controllers;

use App\Modules\Billing\Infrastructure\Integrations\NHIF\NhifRemittanceProcessor;
use App\Modules\Billing\Infrastructure\Models\BillingNhifRemittanceModel;
use App\Modules\Platform\Domain\Services\CurrentPlatformScopeContextInterface;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;

class BillingNhifRemittanceController extends Controller
{
    public function __construct(
        private readonly NhifRemittanceProcessor $remittanceProcessor,
        private readonly CurrentPlatformScopeContextInterface $scopeContext,
    ) {}

    public function upload(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'file' => 'required|file|mimes:csv,txt,json|max:10240',
            'format' => 'nullable|string|in:csv,json',
        ]);

        $file = $request->file('file');
        $format = $validated['format'] ?? $file->getClientOriginalExtension();

        $result = $this->remittanceProcessor->processFile(
            filePath: $file->getPathname(),
            tenantId: $this->scopeContext->tenantId(),
            facilityId: $this->scopeContext->facilityId(),
            format: $format === 'json' ? 'json' : 'csv',
            originalFilename: $file->getClientOriginalName(),
            userId: $request->user()?->id,
        );

        $isDuplicate = $result->message === 'Remittance already processed';
        $statusCode = $result->success ? 200 : ($isDuplicate ? 409 : 422);

        return response()->json([
            'success' => $result->success,
            'message' => $result->message,
            'data' => [
                'remittance_reference' => $result->remittanceReference,
                'total_claims' => $result->totalClaims,
                'matched_claims' => $result->matchedClaims,
                'total_amount' => $result->totalAmount,
                'matched_amount' => $result->matchedAmount,
                'unmatched_amount' => $result->unmatchedAmount,
                'errors' => $result->errors,
            ],
        ], $statusCode);
    }

    public function history(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'per_page' => 'nullable|integer|min:1|max:100',
            'status' => 'nullable|string|in:pending,completed,partial,failed',
        ]);

        $query = BillingNhifRemittanceModel::query()
            ->where('tenant_id', $this->scopeContext->tenantId())
            ->where('facility_id', $this->scopeContext->facilityId());

        if (!empty($validated['status'])) {
            $query->where('status', $validated['status']);
        }

        $perPage = min((int) ($validated['per_page'] ?? 20), 100);

        return response()->json([
            'data' => $query->orderByDesc('created_at')->paginate($perPage),
        ]);
    }

    public function show(Request $request, string $remittanceId): JsonResponse
    {
        $remittance = BillingNhifRemittanceModel::query()
            ->where('id', $remittanceId)
            ->where('tenant_id', $this->scopeContext->tenantId())
            ->where('facility_id', $this->scopeContext->facilityId())
            ->with('items')
            ->first();

        if (!$remittance) {
            return response()->json(['message' => 'Remittance not found'], 404);
        }

        return response()->json(['data' => $remittance]);
    }
}
