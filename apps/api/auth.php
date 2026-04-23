<?php

/**
 * Auth helpers — Phase 2.
 *
 * Token strategy: generate a random 32-byte token, return the raw value to
 * the client, store only the SHA-256 hash in auth_tokens. This means a
 * compromised database row cannot be replayed without the original token.
 *
 * Usage (protecting a route):
 *   require_once __DIR__ . '/auth.php';
 *   $user = require_auth(); // exits with 401 if not authenticated
 */

// ---------------------------------------------------------------------------
// Token generation
// ---------------------------------------------------------------------------

function generate_token(): string
{
    return bin2hex(random_bytes(32));
}

// ---------------------------------------------------------------------------
// Extract bearer token from Authorization header
// ---------------------------------------------------------------------------

function get_bearer_token(): ?string
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (stripos($header, 'Bearer ') === 0) {
        return substr($header, 7);
    }
    return null;
}

// ---------------------------------------------------------------------------
// Validate bearer token and return user row (or null)
// ---------------------------------------------------------------------------

function auth_user(): ?array
{
    $raw = get_bearer_token();
    if ($raw === null || $raw === '') {
        return null;
    }

    $hash = hash('sha256', $raw);

    $stmt = db()->prepare(
        'SELECT u.id, u.name, u.username, u.is_active
         FROM auth_tokens t
         JOIN users u ON u.id = t.user_id
         WHERE t.token_hash = ?
           AND t.expires_at > NOW()
           AND u.is_active = 1
         LIMIT 1'
    );
    $stmt->execute([$hash]);
    $row = $stmt->fetch();

    return $row ?: null;
}

// ---------------------------------------------------------------------------
// Require auth — exits with 401 if unauthenticated, returns user row on success
// ---------------------------------------------------------------------------

function require_auth(): array
{
    $user = auth_user();
    if ($user === null) {
        http_response_code(401);
        echo json_encode(['error' => 'Unauthorized']);
        exit;
    }
    return $user;
}
