<?php

namespace App\Http\Controllers;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ChatMessageController extends Controller
{
    public function store(Request $request, ChatSession $session): JsonResponse
    {
        $data = $request->validate([
            'parent_id' => 'nullable|integer|exists:chat_messages,id',
            'role' => 'required|in:user,assistant',
            'content' => 'required|string',
            'plan_snapshot' => 'nullable|array',
            'state_snapshot' => 'nullable|array',
            'edited_from_id' => 'nullable|integer|exists:chat_messages,id',
        ]);

        $data['session_id'] = $session->id;

        $message = ChatMessage::create($data);

        $session->touch();

        return response()->json($message, 201);
    }
}
