<?php

namespace App\Http\Controllers;

use Inertia\Inertia;
use App\Support\RoleDetection;

class DashboardController extends Controller
{
    public function index()
    {
        $user = auth()->user();
        
        // Get user permissions
        $permissions = $user->permissionNames();
        
        // Detect primary role
        $primaryRole = RoleDetection::detectPrimaryRole($permissions);
        
        // If role detected, redirect to role dashboard
        if ($primaryRole) {
            $routeName = 'dashboard.' . str_replace('_', '-', $primaryRole);
            return redirect()->route($routeName);
        }
        
        // Fallback to generic dashboard for users without specific role
        return Inertia::render('Dashboard');
    }
}
