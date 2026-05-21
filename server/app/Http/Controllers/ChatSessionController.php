<?php

namespace App\Http\Controllers;

use App\Models\ChatSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatSessionController extends Controller
{
    public function index(): JsonResponse
    {
        $sessions = ChatSession::query()
            ->orderByDesc('updated_at')
            ->get(['id', 'title', 'head_message_id', 'updated_at']);

        return response()->json($sessions);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:160',
        ]);

        $session = ChatSession::create([
            'title' => $data['title'] ?? 'New chat',
        ]);

        return response()->json($session, 201);
    }

    public function show(ChatSession $session): JsonResponse
    {
        $session->load('messages');

        return response()->json($session);
    }

    public function update(Request $request, ChatSession $session): JsonResponse
    {
        $data = $request->validate([
            'title' => 'sometimes|string|max:160',
            'head_message_id' => 'sometimes|nullable|integer|exists:chat_messages,id',
        ]);

        $session->update($data);

        return response()->json($session);
    }

    public function destroy(ChatSession $session): JsonResponse
    {
        $session->delete();

        return response()->json(['deleted' => true]);
    }
}
