<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ChatSession extends Model
{
    use HasUuids;

    protected $fillable = ['id', 'user_id', 'title', 'head_message_id'];

    protected $keyType = 'string';
    public $incrementing = false;

    public function messages(): HasMany
    {
        return $this->hasMany(ChatMessage::class, 'session_id')->orderBy('id');
    }
}
