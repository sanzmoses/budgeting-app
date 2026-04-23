<?php

/**
 * Config loader.
 *
 * Reads values from environment variables.
 * For local development, set these in a .env file loaded by your dev server,
 * or export them in your shell before running PHP's built-in server.
 *
 * On Hostinger, set these via the hosting panel or an .env file that is
 * NOT committed to git.
 */

$envFile = __DIR__ . '/.env';
if (is_file($envFile) && is_readable($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#') || !str_contains($line, '=')) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        $value = trim($value);

        if ($key !== '' && getenv($key) === false) {
            putenv($key . '=' . $value);
            $_ENV[$key] = $value;
            $_SERVER[$key] = $value;
        }
    }
}

function config(string $key, string $default = ''): string
{
    $value = getenv($key);
    return $value !== false ? $value : $default;
}

define('APP_ENV',  config('APP_ENV',  'development'));
define('APP_NAME', config('APP_NAME', 'budgeting-api'));
define('APP_URL',  config('APP_URL',  'http://localhost:8000'));

define('DB_HOST',     config('DB_HOST',     '127.0.0.1'));
define('DB_PORT',     config('DB_PORT',     '3306'));
define('DB_NAME',     config('DB_NAME',     ''));
define('DB_USER',     config('DB_USER',     ''));
define('DB_PASSWORD', config('DB_PASSWORD', ''));

define('JWT_SECRET', config('JWT_SECRET', ''));

define('CORS_ALLOWED_ORIGINS', config('CORS_ALLOWED_ORIGINS', 'http://localhost:3000'));
