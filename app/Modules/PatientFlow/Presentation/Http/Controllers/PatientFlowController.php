<?php

namespace App\Modules\PatientFlow\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\PatientFlow\Application\UseCases\GetActiveVisitJourneyUseCase;
use App\Modules\PatientFlow\Application\UseCases\GetOrderCompletionNotificationsForClinicianUseCase;
use App\Modules\PatientFlow\Presentation\Http\Transformers\OrderCompletionNotificationResponseTransformer;
use App\Modules\PatientFlow\Presentation\Http\Transformers\VisitJourneyEntryResponseTransformer;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PatientFlowController extends Controller
{
    public function board(GetActiveVisitJourneyUseCase $useCase): JsonResponse
    {
        return response()->json([
            'data' => array_map(
                [VisitJourneyEntryResponseTransformer::class, 'transform'],
                $useCase->execute(),
            ),
        ]);
    }

    public function notifications(Request $request, GetOrderCompletionNotificationsForClinicianUseCase $useCase): JsonResponse
    {
        $userId = $request->user()?->id;

        return response()->json([
            'data' => $userId === null ? [] : array_map(
                [OrderCompletionNotificationResponseTransformer::class, 'transform'],
                $useCase->execute($userId),
            ),
        ]);
    }
}
