<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index(): JsonResponse
    {
        $plans = Plan::query()
            ->orderByDesc('saved_at')
            ->get();

        return response()->json($plans);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id' => 'nullable|uuid|exists:chat_sessions,id',
            'plan_key' => 'required|string|max:255',
            'title' => 'required|string|max:255',
            'brief' => 'nullable|string',
            'plan' => 'required|array',
        ]);

        $existing = Plan::where('plan_key', $data['plan_key'])->first();
        if ($existing) {
            return response()->json($existing, 200);
        }

        $data['saved_at'] = now();
        $plan = Plan::create($data);

        return response()->json($plan, 201);
    }

    public function destroy(Plan $plan): JsonResponse
    {
        $plan->delete();
        return response()->json(['deleted' => true]);
    }
}
