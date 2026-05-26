<?php

namespace Tests\Feature;

use App\Models\ChatSession;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanTest extends TestCase
{
    use RefreshDatabase;

    private User $user;

    protected function setUp(): void
    {
        parent::setUp();
        $this->user = User::factory()->create();
        $this->actingAs($this->user);
    }

    private function planPayload(array $overrides = []): array
    {
        return array_merge([
            'plan_key'        => 'session-1::balanced::1000000000000',
            'experience_type' => 'balanced',
            'title'           => 'Bali Beach Trip',
            'brief'           => 'Beaches and temples',
            'plan'            => ['title' => 'Bali Beach Trip', 'total_price' => 500, 'flight' => null, 'hotel' => null, 'places' => []],
        ], $overrides);
    }

    // ── GET /api/plans ────────────────────────────────────────────────────────

    public function test_index_returns_empty_array_when_no_plans(): void
    {
        $this->getJson('/api/plans')
            ->assertOk()
            ->assertJson([]);
    }

    public function test_index_returns_plans_ordered_by_saved_at_desc(): void
    {
        Plan::create(array_merge($this->planPayload(['plan_key' => 'k1', 'title' => 'Older']), [
            'user_id'  => $this->user->id,
            'saved_at' => now()->subHour(),
        ]));
        Plan::create(array_merge($this->planPayload(['plan_key' => 'k2', 'title' => 'Newer']), [
            'user_id'  => $this->user->id,
            'saved_at' => now(),
        ]));

        $data = $this->getJson('/api/plans')->assertOk()->json();

        $this->assertCount(2, $data);
        $this->assertEquals('Newer', $data[0]['title']);
        $this->assertEquals('Older', $data[1]['title']);
    }

    public function test_index_does_not_return_other_users_plans(): void
    {
        $other = User::factory()->create();
        Plan::create(array_merge($this->planPayload(), ['user_id' => $other->id, 'saved_at' => now()]));

        $this->getJson('/api/plans')
            ->assertOk()
            ->assertJson([]);
    }

    // ── POST /api/plans ───────────────────────────────────────────────────────

    public function test_store_creates_plan(): void
    {
        $this->postJson('/api/plans', $this->planPayload())
            ->assertCreated()
            ->assertJsonFragment(['title' => 'Bali Beach Trip']);

        $this->assertDatabaseHas('plans', [
            'plan_key' => 'session-1::balanced::1000000000000',
            'user_id'  => $this->user->id,
        ]);
    }

    public function test_store_is_idempotent_on_duplicate_plan_key(): void
    {
        $this->postJson('/api/plans', $this->planPayload())->assertCreated();
        $this->postJson('/api/plans', $this->planPayload())->assertOk();

        $this->assertDatabaseCount('plans', 1);
    }

    public function test_store_links_to_session_when_session_id_provided(): void
    {
        $session = ChatSession::create(['user_id' => $this->user->id, 'title' => 'My Trip']);

        $this->postJson('/api/plans', $this->planPayload(['session_id' => $session->id]))
            ->assertCreated()
            ->assertJsonFragment(['session_id' => $session->id]);
    }

    public function test_store_accepts_null_session_id(): void
    {
        $this->postJson('/api/plans', $this->planPayload(['session_id' => null]))
            ->assertCreated();
    }

    public function test_store_rejects_missing_plan_key(): void
    {
        $payload = $this->planPayload();
        unset($payload['plan_key']);

        $this->postJson('/api/plans', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['plan_key']);
    }

    public function test_store_rejects_missing_title(): void
    {
        $payload = $this->planPayload();
        unset($payload['title']);

        $this->postJson('/api/plans', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['title']);
    }

    public function test_store_rejects_missing_plan_object(): void
    {
        $payload = $this->planPayload();
        unset($payload['plan']);

        $this->postJson('/api/plans', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['plan']);
    }

    public function test_store_rejects_nonexistent_session_id(): void
    {
        $this->postJson('/api/plans', $this->planPayload([
            'session_id' => '00000000-0000-0000-0000-000000000000',
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['session_id']);
    }

    public function test_store_sets_saved_at(): void
    {
        $response = $this->postJson('/api/plans', $this->planPayload());

        $response->assertCreated();
        $this->assertNotNull($response->json('saved_at'));
    }

    public function test_store_saves_experience_type(): void
    {
        $this->postJson('/api/plans', $this->planPayload(['experience_type' => 'luxury']))
            ->assertCreated()
            ->assertJsonFragment(['experience_type' => 'luxury']);

        $this->assertDatabaseHas('plans', ['experience_type' => 'luxury']);
    }

    public function test_store_defaults_experience_type_to_balanced(): void
    {
        $payload = $this->planPayload();
        unset($payload['experience_type']);

        $this->postJson('/api/plans', $payload)
            ->assertCreated()
            ->assertJsonFragment(['experience_type' => 'balanced']);
    }

    // ── DELETE /api/plans/{id} ────────────────────────────────────────────────

    public function test_destroy_deletes_plan(): void
    {
        $plan = Plan::create(array_merge($this->planPayload(), ['user_id' => $this->user->id, 'saved_at' => now()]));

        $this->deleteJson("/api/plans/{$plan->id}")
            ->assertOk()
            ->assertJson(['deleted' => true]);

        $this->assertDatabaseMissing('plans', ['id' => $plan->id]);
    }

    public function test_destroy_returns_404_for_unknown_plan(): void
    {
        $this->deleteJson('/api/plans/99999')
            ->assertNotFound();
    }

    public function test_plan_survives_session_deletion(): void
    {
        $session = ChatSession::create(['user_id' => $this->user->id, 'title' => 'Trip']);
        $plan = Plan::create(array_merge($this->planPayload(['session_id' => $session->id]), [
            'user_id'  => $this->user->id,
            'saved_at' => now(),
        ]));

        $session->delete();

        $this->assertDatabaseHas('plans', ['id' => $plan->id]);
        $this->assertNull($plan->fresh()->session_id);
    }
}
