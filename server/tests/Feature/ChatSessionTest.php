<?php

namespace Tests\Feature;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class ChatSessionTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    private function makeSession(array $attrs = []): ChatSession
    {
        return ChatSession::create(array_merge(['user_id' => $this->user->id, 'title' => 'Trip'], $attrs));
    }

    // ── GET /api/sessions ─────────────────────────────────────────────────────

    public function test_index_returns_empty_array_when_no_sessions(): void
    {
        $this->getJson('/api/sessions')
            ->assertOk()
            ->assertJson([]);
    }

    public function test_index_returns_sessions_ordered_by_updated_at_desc(): void
    {
        $older = $this->makeSession(['title' => 'Older']);
        DB::table('chat_sessions')->where('id', $older->id)->update(['updated_at' => now()->subHour()]);

        $this->makeSession(['title' => 'Newer']);

        $response = $this->getJson('/api/sessions');

        $response->assertOk();
        $data = $response->json();
        $this->assertCount(2, $data);
        $this->assertEquals('Newer', $data[0]['title']);
        $this->assertEquals('Older', $data[1]['title']);
    }

    public function test_index_returns_only_required_fields(): void
    {
        $this->makeSession(['title' => 'Test']);

        $response = $this->getJson('/api/sessions');

        $response->assertOk();
        $item = $response->json()[0];
        $this->assertArrayHasKey('id', $item);
        $this->assertArrayHasKey('title', $item);
        $this->assertArrayHasKey('updated_at', $item);
    }

    public function test_index_does_not_return_other_users_sessions(): void
    {
        $other = User::factory()->create();
        ChatSession::create(['user_id' => $other->id, 'title' => 'Other session']);

        $this->getJson('/api/sessions')
            ->assertOk()
            ->assertJson([]);
    }

    // ── POST /api/sessions ────────────────────────────────────────────────────

    public function test_store_creates_session_with_default_title(): void
    {
        $this->postJson('/api/sessions', [])
            ->assertCreated();

        $this->assertDatabaseHas('chat_sessions', ['title' => 'New chat', 'user_id' => $this->user->id]);
    }

    public function test_store_creates_session_with_provided_title(): void
    {
        $this->postJson('/api/sessions', ['title' => 'Bali trip'])
            ->assertCreated()
            ->assertJsonFragment(['title' => 'Bali trip']);

        $this->assertDatabaseHas('chat_sessions', ['title' => 'Bali trip']);
    }

    public function test_store_rejects_title_exceeding_max_length(): void
    {
        $this->postJson('/api/sessions', ['title' => str_repeat('x', 161)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    }

    public function test_store_returns_uuid_id(): void
    {
        $response = $this->postJson('/api/sessions', []);

        $response->assertCreated();
        $id = $response->json('id');
        $this->assertMatchesRegularExpression(
            '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/',
            $id
        );
    }

    // ── GET /api/sessions/{id} ────────────────────────────────────────────────

    public function test_show_returns_session_with_messages(): void
    {
        $session = $this->makeSession(['title' => 'Trip']);
        ChatMessage::create([
            'session_id' => $session->id,
            'parent_id'  => null,
            'role'        => 'user',
            'content'     => 'Hello',
        ]);

        $this->getJson("/api/sessions/{$session->id}")
            ->assertOk()
            ->assertJsonFragment(['title' => 'Trip'])
            ->assertJsonFragment(['content' => 'Hello']);
    }

    public function test_show_returns_messages_ordered_by_id(): void
    {
        $session = $this->makeSession(['title' => 'Trip']);
        $first  = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'First']);
        ChatMessage::create(['session_id' => $session->id, 'parent_id' => $first->id, 'role' => 'assistant', 'content' => 'Second']);

        $response = $this->getJson("/api/sessions/{$session->id}");

        $messages = $response->json('messages');
        $this->assertEquals('First', $messages[0]['content']);
        $this->assertEquals('Second', $messages[1]['content']);
    }

    public function test_show_returns_404_for_unknown_session(): void
    {
        $this->getJson('/api/sessions/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }

    public function test_show_returns_403_for_other_users_session(): void
    {
        $other   = User::factory()->create();
        $session = ChatSession::create(['user_id' => $other->id, 'title' => 'Private']);

        $this->getJson("/api/sessions/{$session->id}")
            ->assertForbidden();
    }

    // ── PATCH /api/sessions/{id} ──────────────────────────────────────────────

    public function test_update_changes_title(): void
    {
        $session = $this->makeSession(['title' => 'Old']);

        $this->patchJson("/api/sessions/{$session->id}", ['title' => 'New'])
            ->assertOk()
            ->assertJsonFragment(['title' => 'New']);

        $this->assertDatabaseHas('chat_sessions', ['id' => $session->id, 'title' => 'New']);
    }

    public function test_update_sets_head_message_id(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Hi']);

        $this->patchJson("/api/sessions/{$session->id}", ['head_message_id' => $msg->id])
            ->assertOk()
            ->assertJsonFragment(['head_message_id' => $msg->id]);

        $this->assertDatabaseHas('chat_sessions', ['id' => $session->id, 'head_message_id' => $msg->id]);
    }

    public function test_update_rejects_nonexistent_head_message_id(): void
    {
        $session = $this->makeSession();

        $this->patchJson("/api/sessions/{$session->id}", ['head_message_id' => 99999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['head_message_id']);
    }

    public function test_update_accepts_null_head_message_id(): void
    {
        $session = $this->makeSession();

        $this->patchJson("/api/sessions/{$session->id}", ['head_message_id' => null])
            ->assertOk();
    }

    // ── DELETE /api/sessions/{id} ─────────────────────────────────────────────

    public function test_destroy_deletes_session(): void
    {
        $session = $this->makeSession(['title' => 'To delete']);

        $this->deleteJson("/api/sessions/{$session->id}")
            ->assertOk()
            ->assertJson(['deleted' => true]);

        $this->assertDatabaseMissing('chat_sessions', ['id' => $session->id]);
    }

    public function test_destroy_cascades_to_messages(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Hi']);

        $this->deleteJson("/api/sessions/{$session->id}")->assertOk();

        $this->assertDatabaseMissing('chat_messages', ['id' => $msg->id]);
    }

    public function test_destroy_returns_404_for_unknown_session(): void
    {
        $this->deleteJson('/api/sessions/00000000-0000-0000-0000-000000000000')
            ->assertNotFound();
    }
}
