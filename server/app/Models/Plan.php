<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'user_id',
        'session_id',
        'plan_key',
        'experience_type',
        'title',
        'brief',
        'plan',
        'saved_at',
    ];

    protected $casts = [
        'plan' => 'array',
        'saved_at' => 'datetime',
    ];
}
