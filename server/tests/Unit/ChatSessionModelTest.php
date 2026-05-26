<?php

namespace Tests\Unit;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatSessionModelTest extends TestCase
{
    use RefreshDatabase;

    public function test_uses_uuid_primary_key(): void
    {
        $session = ChatSession::create(['title' => 'Test']);

        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $session->id
        );
    }

    public function test_fillable_fields(): void
    {
        $session = ChatSession::create([
            'title'           => 'Bali Trip',
            'head_message_id' => null,
        ]);

        $this->assertEquals('Bali Trip', $session->title);
        $this->assertNull($session->head_message_id);
    }

    public function test_default_title_is_new_chat(): void
    {
        // The default lives in the DB schema; test via round-trip.
        $session = ChatSession::create([]);

        $this->assertEquals('New chat', $session->fresh()->title);
    }

    public function test_messages_relationship_returns_has_many(): void
    {
        $session = ChatSession::create(['title' => 'Trip']);
        ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Hi']);

        $this->assertCount(1, $session->messages);
    }

    public function test_messages_are_ordered_by_id(): void
    {
        $session = ChatSession::create(['title' => 'Trip']);
        $first  = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user',      'content' => 'A']);
        $second = ChatMessage::create(['session_id' => $session->id, 'parent_id' => $first->id, 'role' => 'assistant', 'content' => 'B']);

        $messages = $session->messages()->get();
        $this->assertEquals('A', $messages[0]->content);
        $this->assertEquals('B', $messages[1]->content);
    }

    public function test_two_sessions_have_different_uuids(): void
    {
        $a = ChatSession::create(['title' => 'A']);
        $b = ChatSession::create(['title' => 'B']);

        $this->assertNotEquals($a->id, $b->id);
    }
}
