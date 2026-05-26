<?php

namespace App\Http\Controllers;

use App\Models\ChatSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatSessionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $sessions = ChatSession::query()
            ->where('user_id', $request->user()->id)
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
            'user_id' => $request->user()->id,
            'title'   => $data['title'] ?? 'New chat',
        ]);

        return response()->json($session, 201);
    }

    public function show(Request $request, ChatSession $session): JsonResponse
    {
        $this->authorizeSession($request, $session);
        $session->load('messages');

        return response()->json($session);
    }

    public function update(Request $request, ChatSession $session): JsonResponse
    {
        $this->authorizeSession($request, $session);

        $data = $request->validate([
            'title'           => 'sometimes|string|max:160',
            'head_message_id' => 'sometimes|nullable|integer|exists:chat_messages,id',
        ]);

        $session->update($data);

        return response()->json($session);
    }

    public function destroy(Request $request, ChatSession $session): JsonResponse
    {
        $this->authorizeSession($request, $session);
        $session->delete();

        return response()->json(['deleted' => true]);
    }

    private function authorizeSession(Request $request, ChatSession $session): void
    {
        if ($session->user_id !== null && $session->user_id !== $request->user()->id) {
            abort(403, 'Forbidden');
        }
    }
}
