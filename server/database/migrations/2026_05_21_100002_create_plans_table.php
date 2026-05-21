<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->uuid('session_id')->nullable();
            $table->string('plan_key', 255);
            $table->string('title', 255);
            $table->text('brief')->nullable();
            $table->json('plan');
            $table->timestamp('saved_at')->useCurrent();

            $table->foreign('session_id')->references('id')->on('chat_sessions')->nullOnDelete();
            $table->unique('plan_key');
            $table->index('saved_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
