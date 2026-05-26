<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatMessageTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    private function makeSession(string $title = 'Trip'): ChatSession
    {
        return ChatSession::create(['user_id' => $this->user->id, 'title' => $title]);
    }

    // ── POST /api/sessions/{id}/messages ──────────────────────────────────────

    public function test_store_creates_user_message(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'    => 'user',
            'content' => 'Plan a trip to Bali',
        ])->assertCreated()
            ->assertJsonFragment(['role' => 'user', 'content' => 'Plan a trip to Bali']);

        $this->assertDatabaseHas('chat_messages', [
            'session_id' => $session->id,
            'role'       => 'user',
            'content'    => 'Plan a trip to Bali',
        ]);
    }

    public function test_store_creates_assistant_message_with_snapshots(): void
    {
        $session = $this->makeSession();

        $plan  = ['title' => 'Bali Beach', 'total_price' => 500];
        $state = ['selected_plan' => $plan, 'trip_context' => [], 'cached_options' => []];

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'           => 'assistant',
            'content'        => 'Here is your plan',
            'plan_snapshot'  => [$plan],
            'state_snapshot' => $state,
        ])->assertCreated();

        $this->assertDatabaseHas('chat_messages', [
            'session_id' => $session->id,
            'role'       => 'assistant',
        ]);
    }

    public function test_store_sets_parent_id(): void
    {
        $session = $this->makeSession();
        $parent = ChatMessage::create([
            'session_id' => $session->id,
            'parent_id'  => null,
            'role'       => 'user',
            'content'    => 'First',
        ]);

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'      => 'assistant',
            'content'   => 'Reply',
            'parent_id' => $parent->id,
        ])->assertCreated()
            ->assertJsonFragment(['parent_id' => $parent->id]);
    }

    public function test_store_rejects_missing_role(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'content' => 'Hello',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_store_rejects_invalid_role(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'    => 'system',
            'content' => 'Hello',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['role']);
    }

    public function test_store_rejects_missing_content(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role' => 'user',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['content']);
    }

    public function test_store_rejects_nonexistent_parent_id(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'      => 'user',
            'content'   => 'Hi',
            'parent_id' => 99999,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['parent_id']);
    }

    public function test_store_returns_404_for_unknown_session(): void
    {
        $this->postJson('/api/sessions/00000000-0000-0000-0000-000000000000/messages', [
            'role'    => 'user',
            'content' => 'Hello',
        ])->assertNotFound();
    }

    public function test_store_touches_session_updated_at(): void
    {
        $session = $this->makeSession();
        $before = $session->updated_at;

        $this->travel(2)->seconds();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'    => 'user',
            'content' => 'New message',
        ]);

        $this->assertGreaterThan($before, $session->fresh()->updated_at);
    }

    public function test_store_accepts_null_plan_and_state_snapshots(): void
    {
        $session = $this->makeSession();

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'           => 'user',
            'content'        => 'Hello',
            'plan_snapshot'  => null,
            'state_snapshot' => null,
        ])->assertCreated();
    }

    public function test_store_accepts_edited_from_id(): void
    {
        $session = $this->makeSession();
        $original = ChatMessage::create([
            'session_id' => $session->id,
            'parent_id'  => null,
            'role'       => 'user',
            'content'    => 'Original',
        ]);

        $this->postJson("/api/sessions/{$session->id}/messages", [
            'role'           => 'user',
            'content'        => 'Edited',
            'parent_id'      => null,
            'edited_from_id' => $original->id,
        ])->assertCreated()
            ->assertJsonFragment(['edited_from_id' => $original->id]);
    }
}
