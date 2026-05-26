<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ChatMessageController;
use App\Http\Controllers\ChatSessionController;
use App\Http\Controllers\PlanController;
use Illuminate\Support\Facades\Route;

// ── Public auth routes ────────────────────────────────────────────────────────
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login',    [AuthController::class, 'login']);

// ── Protected routes ──────────────────────────────────────────────────────────
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me',      [AuthController::class, 'me']);

    Route::get('/sessions',                    [ChatSessionController::class, 'index']);
    Route::post('/sessions',                   [ChatSessionController::class, 'store']);
    Route::get('/sessions/{session}',          [ChatSessionController::class, 'show']);
    Route::patch('/sessions/{session}',        [ChatSessionController::class, 'update']);
    Route::delete('/sessions/{session}',       [ChatSessionController::class, 'destroy']);

    Route::post('/sessions/{session}/messages', [ChatMessageController::class, 'store']);

    Route::get('/plans',                        [PlanController::class, 'index']);
    Route::post('/plans',                       [PlanController::class, 'store']);
    Route::delete('/plans/{plan}',              [PlanController::class, 'destroy']);

    Route::get('/my-plans',                     [PlanController::class, 'myPlans']);
});
