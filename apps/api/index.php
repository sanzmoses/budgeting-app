<?php

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------

$origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowed = array_map('trim', explode(',', CORS_ALLOWED_ORIGINS));

if (in_array($origin, $allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Vary: Origin');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

header('Content-Type: application/json');

$path   = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
$path   = rtrim($path, '/') ?: '/';
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// GET /health
if ($method === 'GET' && $path === '/health') {
    echo json_encode([
        'status' => 'ok',
        'app'    => APP_NAME,
        'env'    => APP_ENV,
        'time'   => date('c'),
        'php'    => PHP_VERSION,
    ]);
    exit;
}

// GET /
if ($method === 'GET' && $path === '/') {
    echo json_encode([
        'app'     => APP_NAME,
        'version' => '0.4.0',
        'phase'   => 4,
        'status'  => 'Phase 4 — transaction management and balances',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /auth/login
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/auth/login') {
    $body     = json_decode(file_get_contents('php://input'), true) ?? [];
    $username = trim($body['username'] ?? '');
    $password = $body['password'] ?? '';

    if ($username === '' || $password === '') {
        http_response_code(400);
        echo json_encode(['error' => 'Username and password are required']);
        exit;
    }

    $stmt = db()->prepare(
        'SELECT id, name, username, password_hash, is_active
         FROM users WHERE username = ? LIMIT 1'
    );
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    if (!$user || !$user['is_active'] || !password_verify($password, $user['password_hash'])) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid credentials']);
        exit;
    }

    $raw       = generate_token();
    $hash      = hash('sha256', $raw);
    $expiresAt = date('Y-m-d H:i:s', strtotime('+30 days'));

    db()->prepare(
        'INSERT INTO auth_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)'
    )->execute([$user['id'], $hash, $expiresAt]);

    echo json_encode([
        'token' => $raw,
        'user'  => [
            'id'       => (int) $user['id'],
            'name'     => $user['name'],
            'username' => $user['username'],
        ],
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/auth/logout') {
    $raw = get_bearer_token();
    if ($raw !== null && $raw !== '') {
        $hash = hash('sha256', $raw);
        db()->prepare('DELETE FROM auth_tokens WHERE token_hash = ?')->execute([$hash]);
    }
    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/auth/me') {
    $user = require_auth();
    echo json_encode([
        'id'       => (int) $user['id'],
        'name'     => $user['name'],
        'username' => $user['username'],
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /bootstrap — option lists for forms (requires auth)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/bootstrap') {
    require_auth();

    $accounts = db()->query(
        'SELECT id, name, type FROM accounts WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    $categories = db()->query(
        'SELECT id, name FROM categories WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    $subcategories = db()->query(
        'SELECT id, category_id, name FROM subcategories WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    $places = db()->query(
        'SELECT id, name FROM places WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    $income_sources = db()->query(
        'SELECT id, name FROM income_sources WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    echo json_encode([
        'accounts'       => array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name'], 'type' => $r['type']], $accounts),
        'categories'     => array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name']], $categories),
        'subcategories'  => array_map(fn($r) => ['id' => (int)$r['id'], 'category_id' => (int)$r['category_id'], 'name' => $r['name']], $subcategories),
        'places'         => array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name']], $places),
        'income_sources' => array_map(fn($r) => ['id' => (int)$r['id'], 'name' => $r['name']], $income_sources),
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /transactions — create expense, income, or transfer (requires auth)
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/transactions') {
    $user = require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $type = $body['type'] ?? '';
    if (!in_array($type, ['expense', 'income', 'transfer'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'type must be expense, income, or transfer']);
        exit;
    }

    $date = trim($body['transaction_date'] ?? '');
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(400);
        echo json_encode(['error' => 'transaction_date is required (YYYY-MM-DD)']);
        exit;
    }

    $amount = $body['amount'] ?? null;
    if ($amount === null || !is_numeric($amount) || (float)$amount <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be a positive number']);
        exit;
    }
    $amount = round((float)$amount, 2);

    $description = trim($body['description'] ?? '') ?: null;

    $account_id       = null;
    $category_id      = null;
    $subcategory_id   = null;
    $place_id         = null;
    $income_source_id = null;
    $from_account_id  = null;
    $to_account_id    = null;
    $transfer_label   = null;

    if ($type === 'expense') {
        $account_id     = intval($body['account_id']     ?? 0) ?: null;
        $category_id    = intval($body['category_id']    ?? 0) ?: null;
        $subcategory_id = intval($body['subcategory_id'] ?? 0) ?: null;
        $place_id       = intval($body['place_id']       ?? 0) ?: null;

        if (!$account_id) {
            http_response_code(400); echo json_encode(['error' => 'account_id is required for expense']); exit;
        }
        if (!$category_id) {
            http_response_code(400); echo json_encode(['error' => 'category_id is required for expense']); exit;
        }
        if (!$subcategory_id) {
            http_response_code(400); echo json_encode(['error' => 'subcategory_id is required for expense']); exit;
        }
    }

    if ($type === 'income') {
        $account_id       = intval($body['account_id']       ?? 0) ?: null;
        $income_source_id = intval($body['income_source_id'] ?? 0) ?: null;

        if (!$account_id) {
            http_response_code(400); echo json_encode(['error' => 'account_id is required for income']); exit;
        }
        if (!$income_source_id) {
            http_response_code(400); echo json_encode(['error' => 'income_source_id is required for income']); exit;
        }
    }

    if ($type === 'transfer') {
        $from_account_id = intval($body['from_account_id'] ?? 0) ?: null;
        $to_account_id   = intval($body['to_account_id']   ?? 0) ?: null;
        $transfer_label  = trim($body['transfer_label']    ?? '') ?: null;

        if (!$from_account_id) {
            http_response_code(400); echo json_encode(['error' => 'from_account_id is required for transfer']); exit;
        }
        if (!$to_account_id) {
            http_response_code(400); echo json_encode(['error' => 'to_account_id is required for transfer']); exit;
        }
        if ($from_account_id === $to_account_id) {
            http_response_code(400); echo json_encode(['error' => 'from_account_id and to_account_id must be different']); exit;
        }
    }

    $stmt = db()->prepare(
        'INSERT INTO transactions
           (transaction_date, type, description, amount,
            account_id, category_id, subcategory_id, place_id,
            income_source_id, from_account_id, to_account_id, transfer_label,
            created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $date, $type, $description, $amount,
        $account_id, $category_id, $subcategory_id, $place_id,
        $income_source_id, $from_account_id, $to_account_id, $transfer_label,
        $user['id'],
    ]);

    $id = (int) db()->lastInsertId();

    http_response_code(201);
    echo json_encode(['id' => $id, 'message' => 'Transaction created']);
    exit;
}

// ---------------------------------------------------------------------------
// GET /transactions — list transactions (requires auth)
// Default: current month, newest first.
// Query params: ?month=YYYY-MM  ?type=expense|income|transfer
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/transactions') {
    require_auth();

    $month = $_GET['month'] ?? date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        $month = date('Y-m');
    }
    $monthStart = $month . '-01';
    $monthEnd   = date('Y-m-t', strtotime($monthStart));

    $filterType  = $_GET['type'] ?? '';
    $validTypes  = ['expense', 'income', 'transfer'];

    $sql = '
        SELECT
            t.id, t.transaction_date, t.type, t.description, t.amount,
            t.account_id,       a.name   AS account_name,
            t.category_id,      c.name   AS category_name,
            t.subcategory_id,   sc.name  AS subcategory_name,
            t.place_id,         p.name   AS place_name,
            t.income_source_id, ins.name AS income_source_name,
            t.from_account_id,  fa.name  AS from_account_name,
            t.to_account_id,    ta.name  AS to_account_name,
            t.transfer_label,
            t.created_by_user_id, u.name AS created_by_name,
            t.created_at
        FROM transactions t
        LEFT JOIN accounts      a   ON a.id   = t.account_id
        LEFT JOIN categories    c   ON c.id   = t.category_id
        LEFT JOIN subcategories sc  ON sc.id  = t.subcategory_id
        LEFT JOIN places        p   ON p.id   = t.place_id
        LEFT JOIN income_sources ins ON ins.id = t.income_source_id
        LEFT JOIN accounts      fa  ON fa.id  = t.from_account_id
        LEFT JOIN accounts      ta  ON ta.id  = t.to_account_id
        LEFT JOIN users         u   ON u.id   = t.created_by_user_id
        WHERE t.deleted_at IS NULL
          AND t.transaction_date >= ?
          AND t.transaction_date <= ?
    ';
    $params = [$monthStart, $monthEnd];

    if (in_array($filterType, $validTypes, true)) {
        $sql    .= ' AND t.type = ?';
        $params[] = $filterType;
    }

    $sql .= ' ORDER BY t.transaction_date DESC, t.id DESC';

    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    $transactions = array_map(function ($r) {
        return [
            'id'                 => (int)$r['id'],
            'transaction_date'   => $r['transaction_date'],
            'type'               => $r['type'],
            'description'        => $r['description'],
            'amount'             => (float)$r['amount'],
            'account_id'         => $r['account_id']       ? (int)$r['account_id']       : null,
            'account_name'       => $r['account_name'],
            'category_id'        => $r['category_id']      ? (int)$r['category_id']      : null,
            'category_name'      => $r['category_name'],
            'subcategory_id'     => $r['subcategory_id']   ? (int)$r['subcategory_id']   : null,
            'subcategory_name'   => $r['subcategory_name'],
            'place_id'           => $r['place_id']         ? (int)$r['place_id']         : null,
            'place_name'         => $r['place_name'],
            'income_source_id'   => $r['income_source_id'] ? (int)$r['income_source_id'] : null,
            'income_source_name' => $r['income_source_name'],
            'from_account_id'    => $r['from_account_id']  ? (int)$r['from_account_id']  : null,
            'from_account_name'  => $r['from_account_name'],
            'to_account_id'      => $r['to_account_id']    ? (int)$r['to_account_id']    : null,
            'to_account_name'    => $r['to_account_name'],
            'transfer_label'     => $r['transfer_label'],
            'created_by_user_id' => (int)$r['created_by_user_id'],
            'created_by_name'    => $r['created_by_name'],
            'created_at'         => $r['created_at'],
        ];
    }, $rows);

    echo json_encode([
        'month'        => $month,
        'count'        => count($transactions),
        'transactions' => $transactions,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// Helper: fetch a single transaction row with all joins (returns array or null)
// ---------------------------------------------------------------------------
function fetch_transaction(int $id): ?array
{
    $sql = '
        SELECT
            t.id, t.transaction_date, t.type, t.description, t.amount,
            t.account_id,       a.name   AS account_name,
            t.category_id,      c.name   AS category_name,
            t.subcategory_id,   sc.name  AS subcategory_name,
            t.place_id,         p.name   AS place_name,
            t.income_source_id, ins.name AS income_source_name,
            t.from_account_id,  fa.name  AS from_account_name,
            t.to_account_id,    ta.name  AS to_account_name,
            t.transfer_label,
            t.created_by_user_id, u.name AS created_by_name,
            t.updated_by_user_id,
            t.created_at, t.updated_at
        FROM transactions t
        LEFT JOIN accounts      a   ON a.id   = t.account_id
        LEFT JOIN categories    c   ON c.id   = t.category_id
        LEFT JOIN subcategories sc  ON sc.id  = t.subcategory_id
        LEFT JOIN places        p   ON p.id   = t.place_id
        LEFT JOIN income_sources ins ON ins.id = t.income_source_id
        LEFT JOIN accounts      fa  ON fa.id  = t.from_account_id
        LEFT JOIN accounts      ta  ON ta.id  = t.to_account_id
        LEFT JOIN users         u   ON u.id   = t.created_by_user_id
        WHERE t.id = ? AND t.deleted_at IS NULL
        LIMIT 1
    ';
    $stmt = db()->prepare($sql);
    $stmt->execute([$id]);
    $r = $stmt->fetch();
    if (!$r) {
        return null;
    }
    return [
        'id'                 => (int)$r['id'],
        'transaction_date'   => $r['transaction_date'],
        'type'               => $r['type'],
        'description'        => $r['description'],
        'amount'             => (float)$r['amount'],
        'account_id'         => $r['account_id']       ? (int)$r['account_id']       : null,
        'account_name'       => $r['account_name'],
        'category_id'        => $r['category_id']      ? (int)$r['category_id']      : null,
        'category_name'      => $r['category_name'],
        'subcategory_id'     => $r['subcategory_id']   ? (int)$r['subcategory_id']   : null,
        'subcategory_name'   => $r['subcategory_name'],
        'place_id'           => $r['place_id']         ? (int)$r['place_id']         : null,
        'place_name'         => $r['place_name'],
        'income_source_id'   => $r['income_source_id'] ? (int)$r['income_source_id'] : null,
        'income_source_name' => $r['income_source_name'],
        'from_account_id'    => $r['from_account_id']  ? (int)$r['from_account_id']  : null,
        'from_account_name'  => $r['from_account_name'],
        'to_account_id'      => $r['to_account_id']    ? (int)$r['to_account_id']    : null,
        'to_account_name'    => $r['to_account_name'],
        'transfer_label'     => $r['transfer_label'],
        'created_by_user_id' => (int)$r['created_by_user_id'],
        'created_by_name'    => $r['created_by_name'],
        'updated_by_user_id' => $r['updated_by_user_id'] ? (int)$r['updated_by_user_id'] : null,
        'created_at'         => $r['created_at'],
        'updated_at'         => $r['updated_at'],
    ];
}

// ---------------------------------------------------------------------------
// Helper: compute balance for one account from the ledger
// ---------------------------------------------------------------------------
function compute_account_balance(int $account_id): ?array
{
    $stmt = db()->prepare(
        'SELECT id, name, opening_balance, currency FROM accounts WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$account_id]);
    $acct = $stmt->fetch();
    if (!$acct) {
        return null;
    }

    $stmt = db()->prepare('
        SELECT
          COALESCE(SUM(CASE WHEN type = "income"   AND account_id      = ? THEN amount ELSE 0 END), 0) AS income_total,
          COALESCE(SUM(CASE WHEN type = "expense"  AND account_id      = ? THEN amount ELSE 0 END), 0) AS expense_total,
          COALESCE(SUM(CASE WHEN type = "transfer" AND to_account_id   = ? THEN amount ELSE 0 END), 0) AS transfers_in,
          COALESCE(SUM(CASE WHEN type = "transfer" AND from_account_id = ? THEN amount ELSE 0 END), 0) AS transfers_out
        FROM transactions
        WHERE deleted_at IS NULL
          AND (account_id = ? OR from_account_id = ? OR to_account_id = ?)
    ');
    $stmt->execute([
        $account_id, $account_id, $account_id, $account_id,
        $account_id, $account_id, $account_id,
    ]);
    $sums = $stmt->fetch();

    $balance = (float)$acct['opening_balance']
             + (float)$sums['income_total']
             - (float)$sums['expense_total']
             + (float)$sums['transfers_in']
             - (float)$sums['transfers_out'];

    return [
        'id'              => (int)$acct['id'],
        'name'            => $acct['name'],
        'currency'        => $acct['currency'],
        'opening_balance' => (float)$acct['opening_balance'],
        'balance'         => round($balance, 2),
    ];
}

// ---------------------------------------------------------------------------
// GET /accounts/balances — computed balances for all active accounts
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/accounts/balances') {
    require_auth();

    $stmt = db()->query(
        'SELECT id FROM accounts WHERE is_active = 1 ORDER BY sort_order, name'
    );
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $balances = array_map('compute_account_balance', $ids);

    echo json_encode(['balances' => $balances]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /accounts/{id}/balance — computed balance for one account
// ---------------------------------------------------------------------------
if ($method === 'GET' && preg_match('#^/accounts/(\d+)/balance$#', $path, $m)) {
    require_auth();
    $result = compute_account_balance((int)$m[1]);
    if (!$result) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }
    echo json_encode($result);
    exit;
}

// ---------------------------------------------------------------------------
// GET /transactions/{id} — single transaction detail
// ---------------------------------------------------------------------------
if ($method === 'GET' && preg_match('#^/transactions/(\d+)$#', $path, $m)) {
    require_auth();
    $txn = fetch_transaction((int)$m[1]);
    if (!$txn) {
        http_response_code(404);
        echo json_encode(['error' => 'Transaction not found']);
        exit;
    }
    echo json_encode($txn);
    exit;
}

// ---------------------------------------------------------------------------
// PUT /transactions/{id} — edit a transaction (requires auth)
// Type cannot be changed; fields are validated per the existing type.
// ---------------------------------------------------------------------------
if ($method === 'PUT' && preg_match('#^/transactions/(\d+)$#', $path, $m)) {
    $user = require_auth();
    $id   = (int)$m[1];

    $existing = fetch_transaction($id);
    if (!$existing) {
        http_response_code(404);
        echo json_encode(['error' => 'Transaction not found']);
        exit;
    }

    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $type = $existing['type']; // type is immutable

    $date = trim($body['transaction_date'] ?? '');
    if ($date === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        http_response_code(400);
        echo json_encode(['error' => 'transaction_date is required (YYYY-MM-DD)']);
        exit;
    }

    $amount = $body['amount'] ?? null;
    if ($amount === null || !is_numeric($amount) || (float)$amount <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be a positive number']);
        exit;
    }
    $amount = round((float)$amount, 2);

    $description = trim($body['description'] ?? '') ?: null;

    $account_id       = null;
    $category_id      = null;
    $subcategory_id   = null;
    $place_id         = null;
    $income_source_id = null;
    $from_account_id  = null;
    $to_account_id    = null;
    $transfer_label   = null;

    if ($type === 'expense') {
        $account_id     = intval($body['account_id']     ?? 0) ?: null;
        $category_id    = intval($body['category_id']    ?? 0) ?: null;
        $subcategory_id = intval($body['subcategory_id'] ?? 0) ?: null;
        $place_id       = intval($body['place_id']       ?? 0) ?: null;

        if (!$account_id) {
            http_response_code(400); echo json_encode(['error' => 'account_id is required for expense']); exit;
        }
        if (!$category_id) {
            http_response_code(400); echo json_encode(['error' => 'category_id is required for expense']); exit;
        }
        if (!$subcategory_id) {
            http_response_code(400); echo json_encode(['error' => 'subcategory_id is required for expense']); exit;
        }
    }

    if ($type === 'income') {
        $account_id       = intval($body['account_id']       ?? 0) ?: null;
        $income_source_id = intval($body['income_source_id'] ?? 0) ?: null;

        if (!$account_id) {
            http_response_code(400); echo json_encode(['error' => 'account_id is required for income']); exit;
        }
        if (!$income_source_id) {
            http_response_code(400); echo json_encode(['error' => 'income_source_id is required for income']); exit;
        }
    }

    if ($type === 'transfer') {
        $from_account_id = intval($body['from_account_id'] ?? 0) ?: null;
        $to_account_id   = intval($body['to_account_id']   ?? 0) ?: null;
        $transfer_label  = trim($body['transfer_label']    ?? '') ?: null;

        if (!$from_account_id) {
            http_response_code(400); echo json_encode(['error' => 'from_account_id is required for transfer']); exit;
        }
        if (!$to_account_id) {
            http_response_code(400); echo json_encode(['error' => 'to_account_id is required for transfer']); exit;
        }
        if ($from_account_id === $to_account_id) {
            http_response_code(400); echo json_encode(['error' => 'from_account_id and to_account_id must be different']); exit;
        }
    }

    db()->prepare('
        UPDATE transactions SET
            transaction_date  = ?,
            description       = ?,
            amount            = ?,
            account_id        = ?,
            category_id       = ?,
            subcategory_id    = ?,
            place_id          = ?,
            income_source_id  = ?,
            from_account_id   = ?,
            to_account_id     = ?,
            transfer_label    = ?,
            updated_by_user_id = ?
        WHERE id = ?
    ')->execute([
        $date, $description, $amount,
        $account_id, $category_id, $subcategory_id, $place_id,
        $income_source_id, $from_account_id, $to_account_id, $transfer_label,
        $user['id'],
        $id,
    ]);

    echo json_encode(fetch_transaction($id));
    exit;
}

// ---------------------------------------------------------------------------
// DELETE /transactions/{id} — soft delete (requires auth)
// ---------------------------------------------------------------------------
if ($method === 'DELETE' && preg_match('#^/transactions/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int)$m[1];

    $stmt = db()->prepare('SELECT id FROM transactions WHERE id = ? AND deleted_at IS NULL LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Transaction not found']);
        exit;
    }

    db()->prepare('UPDATE transactions SET deleted_at = NOW() WHERE id = ?')->execute([$id]);

    http_response_code(204);
    exit;
}

// 404 fallback
http_response_code(404);
echo json_encode(['error' => 'Not found', 'path' => $path]);
