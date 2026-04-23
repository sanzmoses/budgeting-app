<?php

/**
 * Database connection helper.
 *
 * Returns a shared PDO instance configured for MySQL.
 * Relies on the DB_* constants defined in config.php.
 *
 * Usage:
 *   require_once __DIR__ . '/db.php';
 *   $pdo = db();
 *   $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
 *   $stmt->execute([$id]);
 *   $user = $stmt->fetch();
 */

function db(): PDO
{
    static $pdo = null;

    if ($pdo === null) {
        if (DB_NAME === '' || DB_USER === '') {
            http_response_code(500);
            echo json_encode(['error' => 'Database is not configured. Set DB_NAME and DB_USER in your environment.']);
            exit;
        }

        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
            DB_HOST,
            DB_PORT,
            DB_NAME
        );

        $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    }

    return $pdo;
}
