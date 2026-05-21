<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('chat_messages', function (Blueprint $table) {
            $table->id();
            $table->uuid('session_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->enum('role', ['user', 'assistant']);
            $table->mediumText('content');
            $table->json('plan_snapshot')->nullable();
            $table->json('state_snapshot')->nullable();
            $table->unsignedBigInteger('edited_from_id')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('session_id')->references('id')->on('chat_sessions')->cascadeOnDelete();
            $table->foreign('parent_id')->references('id')->on('chat_messages')->nullOnDelete();
            $table->foreign('edited_from_id')->references('id')->on('chat_messages')->nullOnDelete();

            $table->index(['session_id', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chat_messages');
    }
};
