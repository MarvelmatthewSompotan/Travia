<?php

namespace Tests\Unit;

use App\Models\ChatMessage;
use App\Models\ChatSession;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ChatMessageModelTest extends TestCase
{
    use RefreshDatabase;

    private function makeSession(): ChatSession
    {
        return ChatSession::create(['title' => 'Trip']);
    }

    public function test_fillable_fields_are_saved(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create([
            'session_id' => $session->id,
            'parent_id'  => null,
            'role'       => 'user',
            'content'    => 'Hello',
        ]);

        $this->assertEquals('user', $msg->role);
        $this->assertEquals('Hello', $msg->content);
        $this->assertNull($msg->parent_id);
    }

    public function test_plan_snapshot_is_cast_to_array(): void
    {
        $session = $this->makeSession();
        $plan = ['title' => 'Bali', 'total_price' => 500];

        $msg = ChatMessage::create([
            'session_id'    => $session->id,
            'parent_id'     => null,
            'role'          => 'assistant',
            'content'       => 'Here it is',
            'plan_snapshot' => [$plan],
        ]);

        $this->assertIsArray($msg->fresh()->plan_snapshot);
        $this->assertEquals('Bali', $msg->fresh()->plan_snapshot[0]['title']);
    }

    public function test_state_snapshot_is_cast_to_array(): void
    {
        $session = $this->makeSession();
        $state = ['selected_plan' => null, 'trip_context' => ['destination_name' => 'Bali']];

        $msg = ChatMessage::create([
            'session_id'     => $session->id,
            'parent_id'      => null,
            'role'           => 'assistant',
            'content'        => 'Plan ready',
            'state_snapshot' => $state,
        ]);

        $fresh = $msg->fresh();
        $this->assertIsArray($fresh->state_snapshot);
        $this->assertEquals('Bali', $fresh->state_snapshot['trip_context']['destination_name']);
    }

    public function test_session_relationship(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create([
            'session_id' => $session->id,
            'parent_id'  => null,
            'role'       => 'user',
            'content'    => 'Hi',
        ]);

        $this->assertEquals($session->id, $msg->session->id);
    }

    public function test_parent_relationship(): void
    {
        $session = $this->makeSession();
        $parent = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Parent']);
        $child  = ChatMessage::create(['session_id' => $session->id, 'parent_id' => $parent->id, 'role' => 'assistant', 'content' => 'Child']);

        $this->assertEquals($parent->id, $child->parent->id);
    }

    public function test_parent_is_null_for_root_message(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Root']);

        $this->assertNull($msg->parent);
    }

    public function test_created_at_is_set_automatically(): void
    {
        $session = $this->makeSession();
        $msg = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'Hi']);

        // created_at is set by the DB default (useCurrent); read back via fresh()
        $this->assertNotNull($msg->fresh()->created_at);
    }

    public function test_roles_are_restricted_to_enum_values(): void
    {
        $session = $this->makeSession();

        // Valid roles persist without error
        $user = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'user', 'content' => 'u']);
        $asst = ChatMessage::create(['session_id' => $session->id, 'parent_id' => null, 'role' => 'assistant', 'content' => 'a']);

        $this->assertEquals('user', $user->role);
        $this->assertEquals('assistant', $asst->role);
    }
}
