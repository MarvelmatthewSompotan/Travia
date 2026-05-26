<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthTest extends TestCase
{
    use RefreshDatabase;

    // ── register ─────────────────────────────────────────────────────────────

    public function test_register_creates_user_and_returns_token(): void
    {
        $res = $this->postJson('/api/auth/register', [
            'name'     => 'Alice',
            'email'    => 'alice@example.com',
            'password' => 'secret123',
        ]);

        $res->assertStatus(201)
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);

        $this->assertDatabaseHas('users', ['email' => 'alice@example.com']);
    }

    public function test_register_requires_email(): void
    {
        $this->postJson('/api/auth/register', [
            'name'     => 'Alice',
            'password' => 'secret123',
        ])->assertStatus(422);
    }

    public function test_register_requires_unique_email(): void
    {
        User::factory()->create(['email' => 'dup@example.com']);

        $this->postJson('/api/auth/register', [
            'name'     => 'Bob',
            'email'    => 'dup@example.com',
            'password' => 'secret123',
        ])->assertStatus(422);
    }

    public function test_register_requires_password_min_8_chars(): void
    {
        $this->postJson('/api/auth/register', [
            'name'     => 'Alice',
            'email'    => 'alice@example.com',
            'password' => 'short',
        ])->assertStatus(422);
    }

    // ── login ─────────────────────────────────────────────────────────────────

    public function test_login_returns_token_for_valid_credentials(): void
    {
        User::factory()->create([
            'email'    => 'bob@example.com',
            'password' => 'password123',
        ]);

        $res = $this->postJson('/api/auth/login', [
            'email'    => 'bob@example.com',
            'password' => 'password123',
        ]);

        $res->assertOk()
            ->assertJsonStructure(['token', 'user' => ['id', 'name', 'email']]);
    }

    public function test_login_rejects_wrong_password(): void
    {
        User::factory()->create([
            'email'    => 'bob@example.com',
            'password' => 'password123',
        ]);

        $this->postJson('/api/auth/login', [
            'email'    => 'bob@example.com',
            'password' => 'wrongpassword',
        ])->assertStatus(401);
    }

    public function test_login_rejects_unknown_email(): void
    {
        $this->postJson('/api/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'whatever',
        ])->assertStatus(401);
    }

    // ── me ────────────────────────────────────────────────────────────────────

    public function test_me_returns_authenticated_user(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('email', $user->email);
    }

    public function test_me_requires_authentication(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();
    }

    // ── logout ────────────────────────────────────────────────────────────────

    public function test_logout_deletes_current_token(): void
    {
        $user  = User::factory()->create();
        $token = $user->createToken('test')->plainTextToken;

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk()
            ->assertJson(['message' => 'Logged out']);

        // Token row is gone from the DB
        $this->assertDatabaseEmpty('personal_access_tokens');
    }

    public function test_logout_requires_authentication(): void
    {
        $this->postJson('/api/auth/logout')->assertUnauthorized();
    }

    // ── protected routes require token ────────────────────────────────────────

    public function test_sessions_index_requires_authentication(): void
    {
        $this->getJson('/api/sessions')->assertUnauthorized();
    }

    public function test_plans_index_requires_authentication(): void
    {
        $this->getJson('/api/plans')->assertUnauthorized();
    }
}
