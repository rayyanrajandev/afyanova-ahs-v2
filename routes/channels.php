<?php

use App\Modules\PatientFlow\Application\Services\PatientFlowBoardChannelAuthorizer;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

// Patient-Flow Board live updates (Phase 2 of the board's roadmap) — one
// facility-scoped private channel. Authorization logic lives in
// PatientFlowBoardChannelAuthorizer (directly unit-tested there) rather than
// inline here, since the test suite forces BROADCAST_CONNECTION=null.
Broadcast::channel(
    'patient-flow.{facilityId}',
    fn ($user, string $facilityId): bool => app(PatientFlowBoardChannelAuthorizer::class)->authorize($user, $facilityId),
);

Broadcast::channel(
    'notifications.{userId}',
    fn ($user, int $userId): bool => $user->id === $userId,
);
