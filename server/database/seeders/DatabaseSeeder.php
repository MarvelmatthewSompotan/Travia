<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        User::firstOrCreate(
            ['email' => env('SEED_USER_EMAIL', 'john@gmail.com')],
            [
                'name'     => env('SEED_USER_NAME', 'John'),
                'password' => env('SEED_USER_PASSWORD', 'John123!'),
            ]
        );
    }
}
