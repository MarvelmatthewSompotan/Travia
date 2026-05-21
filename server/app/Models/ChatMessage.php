<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ChatMessage extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'parent_id',
        'role',
        'content',
        'plan_snapshot',
        'state_snapshot',
        'edited_from_id',
    ];

    protected $casts = [
        'plan_snapshot' => 'array',
        'state_snapshot' => 'array',
        'created_at' => 'datetime',
    ];

    public function session(): BelongsTo
    {
        return $this->belongsTo(ChatSession::class, 'session_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(ChatMessage::class, 'parent_id');
    }
}
