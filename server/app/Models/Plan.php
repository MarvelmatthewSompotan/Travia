<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Plan extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'plan_key',
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
