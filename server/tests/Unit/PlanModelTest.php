<?php

namespace Tests\Unit;

use App\Models\ChatSession;
use App\Models\Plan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PlanModelTest extends TestCase
{
    use RefreshDatabase;

    private function makePlan(array $overrides = []): Plan
    {
        return Plan::create(array_merge([
            'plan_key' => 'key-' . uniqid(),
            'title'    => 'Test Plan',
            'brief'    => 'A brief',
            'plan'     => ['title' => 'Test Plan', 'total_price' => 300],
            'saved_at' => now(),
        ], $overrides));
    }

    public function test_fillable_fields_are_saved(): void
    {
        $plan = $this->makePlan(['title' => 'Bali Trip', 'brief' => 'Sun and sand']);

        $this->assertEquals('Bali Trip', $plan->title);
        $this->assertEquals('Sun and sand', $plan->brief);
    }

    public function test_plan_field_is_cast_to_array(): void
    {
        $plan = $this->makePlan([
            'plan' => ['title' => 'Bali', 'total_price' => 500, 'places' => ['Tanah Lot']],
        ]);

        $fresh = $plan->fresh();
        $this->assertIsArray($fresh->plan);
        $this->assertEquals(500, $fresh->plan['total_price']);
        $this->assertContains('Tanah Lot', $fresh->plan['places']);
    }

    public function test_saved_at_is_cast_to_datetime(): void
    {
        $plan = $this->makePlan(['saved_at' => '2025-09-15 10:00:00']);

        $this->assertInstanceOf(\Illuminate\Support\Carbon::class, $plan->fresh()->saved_at);
    }

    public function test_plan_key_is_unique(): void
    {
        $this->makePlan(['plan_key' => 'duplicate-key']);

        $this->expectException(\Illuminate\Database\QueryException::class);
        $this->makePlan(['plan_key' => 'duplicate-key']);
    }

    public function test_session_id_is_nullable(): void
    {
        $plan = $this->makePlan(['session_id' => null]);

        $this->assertNull($plan->session_id);
    }

    public function test_session_id_references_chat_session(): void
    {
        $session = ChatSession::create(['title' => 'Trip']);
        $plan = $this->makePlan(['session_id' => $session->id]);

        $this->assertEquals($session->id, $plan->fresh()->session_id);
    }

    public function test_session_id_nulled_on_session_delete(): void
    {
        $session = ChatSession::create(['title' => 'Trip']);
        $plan = $this->makePlan(['session_id' => $session->id]);

        $session->delete();

        $this->assertNull($plan->fresh()->session_id);
    }
}
