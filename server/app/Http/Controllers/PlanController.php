<?php

namespace App\Http\Controllers;

use App\Models\Plan;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $plans = Plan::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('saved_at')
            ->get();

        return response()->json($plans);
    }

    public function myPlans(Request $request): JsonResponse
    {
        return $this->index($request);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'session_id'      => 'nullable|uuid|exists:chat_sessions,id',
            'plan_key'        => 'required|string|max:255',
            'experience_type' => 'nullable|string|max:50',
            'title'           => 'required|string|max:255',
            'brief'           => 'nullable|string',
            'plan'            => 'required|array',
        ]);

        $existing = Plan::where('plan_key', $data['plan_key'])->first();
        if ($existing) {
            return response()->json($existing, 200);
        }

        $data['user_id']       = $request->user()->id;
        $data['saved_at']      = now();
        $data['experience_type'] = $data['experience_type'] ?? 'balanced';
        $plan = Plan::create($data);

        return response()->json($plan, 201);
    }

    public function destroy(Request $request, Plan $plan): JsonResponse
    {
        if ($plan->user_id !== null && $plan->user_id !== $request->user()->id) {
            abort(403, 'Forbidden');
        }

        $plan->delete();

        return response()->json(['deleted' => true]);
    }
}
