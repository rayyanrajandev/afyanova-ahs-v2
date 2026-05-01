<?php

namespace App\Modules\Platform\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Platform\Application\Services\PlatformSubscriptionPlanCatalogService;
use App\Modules\Platform\Presentation\Http\Requests\UpdatePlatformSubscriptionPlanEntitlementRequest;
use App\Modules\Platform\Presentation\Http\Requests\UpdatePlatformSubscriptionPlanRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlatformSubscriptionPlanController extends Controller
{
    public function index(Request $request, PlatformSubscriptionPlanCatalogService $service): JsonResponse
    {
        return response()->json($service->list($request->all()));
    }

    public function show(string $id, PlatformSubscriptionPlanCatalogService $service): JsonResponse
    {
        $plan = $service->show($id);
        abort_if($plan === null, 404, 'Service plan not found.');

        return response()->json(['data' => $plan]);
    }

    public function update(
        string $id,
        UpdatePlatformSubscriptionPlanRequest $request,
        PlatformSubscriptionPlanCatalogService $service
    ): JsonResponse {
        $plan = $service->update(
            id: $id,
            payload: $request->validated(),
            actorId: $request->user()?->id,
        );

        abort_if($plan === null, 404, 'Service plan not found.');

        return response()->json(['data' => $plan]);
    }

    public function updateEntitlement(
        string $id,
        string $entitlementId,
        UpdatePlatformSubscriptionPlanEntitlementRequest $request,
        PlatformSubscriptionPlanCatalogService $service
    ): JsonResponse {
        $plan = $service->updateEntitlement(
            id: $id,
            entitlementId: $entitlementId,
            payload: $request->validated(),
            actorId: $request->user()?->id,
        );

        abort_if($plan === null, 404, 'Service plan entitlement not found.');

        return response()->json(['data' => $plan]);
    }

    public function auditLogs(
        string $id,
        Request $request,
        PlatformSubscriptionPlanCatalogService $service
    ): JsonResponse {
        $result = $service->auditLogs($id, $request->all());
        abort_if($result === null, 404, 'Service plan not found.');

        return response()->json($result);
    }
}
