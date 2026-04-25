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
        'version' => '0.7.0',
        'phase'   => 7,
        'status'  => 'Phase 7 — reporting',
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
// Helper: fetch a single transaction row with all joins (returns array or null)
// ---------------------------------------------------------------------------
function fetch_transaction(int $id): ?array
{
    $sql = '
        SELECT
            t.id, t.client_uuid, t.transaction_date, t.type, t.description, t.amount,
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
        'client_uuid'        => $r['client_uuid'],
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
    $client_uuid = trim($body['client_uuid'] ?? '') ?: null;

    if ($client_uuid !== null && !preg_match('/^[0-9a-fA-F-]{36}$/', $client_uuid)) {
        http_response_code(400);
        echo json_encode(['error' => 'client_uuid must be a valid UUID']);
        exit;
    }

    if ($client_uuid !== null) {
        $stmt = db()->prepare(
            'SELECT id FROM transactions WHERE created_by_user_id = ? AND client_uuid = ? AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([$user['id'], $client_uuid]);
        $existing = $stmt->fetch();
        if ($existing) {
            echo json_encode(fetch_transaction((int) $existing['id']));
            exit;
        }
    }

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
           (client_uuid, transaction_date, type, description, amount,
            account_id, category_id, subcategory_id, place_id,
            income_source_id, from_account_id, to_account_id, transfer_label,
            created_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $client_uuid, $date, $type, $description, $amount,
        $account_id, $category_id, $subcategory_id, $place_id,
        $income_source_id, $from_account_id, $to_account_id, $transfer_label,
        $user['id'],
    ]);

    $id = (int) db()->lastInsertId();

    http_response_code(201);
    echo json_encode(fetch_transaction($id));
    exit;
}

// ---------------------------------------------------------------------------
// GET /sync/transactions — incremental transaction pull (requires auth)
// Query params: ?since=YYYY-MM-DDTHH:MM:SS or ISO-like string
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/sync/transactions') {
    require_auth();

    $sinceRaw = trim($_GET['since'] ?? '');
    if ($sinceRaw === '') {
        http_response_code(400);
        echo json_encode(['error' => 'since is required']);
        exit;
    }

    try {
        $since = (new DateTime($sinceRaw))->format('Y-m-d H:i:s');
    } catch (Throwable $e) {
        http_response_code(400);
        echo json_encode(['error' => 'since must be a valid datetime']);
        exit;
    }

    $sql = '
        SELECT
            t.id, t.client_uuid, t.transaction_date, t.type, t.description, t.amount,
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
            t.created_at, t.updated_at, t.deleted_at
        FROM transactions t
        LEFT JOIN accounts      a   ON a.id   = t.account_id
        LEFT JOIN categories    c   ON c.id   = t.category_id
        LEFT JOIN subcategories sc  ON sc.id  = t.subcategory_id
        LEFT JOIN places        p   ON p.id   = t.place_id
        LEFT JOIN income_sources ins ON ins.id = t.income_source_id
        LEFT JOIN accounts      fa  ON fa.id  = t.from_account_id
        LEFT JOIN accounts      ta  ON ta.id  = t.to_account_id
        LEFT JOIN users         u   ON u.id   = t.created_by_user_id
        WHERE (t.updated_at >= ? OR (t.deleted_at IS NOT NULL AND t.deleted_at >= ?))
        ORDER BY t.updated_at ASC, t.id ASC
    ';

    $stmt = db()->prepare($sql);
    $stmt->execute([$since, $since]);
    $rows = $stmt->fetchAll();

    $transactions = array_map(function ($r) {
        return [
            'id'                 => (int)$r['id'],
            'client_uuid'        => $r['client_uuid'],
            'transaction_date'   => $r['transaction_date'],
            'type'               => $r['type'],
            'description'        => $r['description'],
            'amount'             => $r['amount'] !== null ? (float)$r['amount'] : null,
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
            'deleted_at'         => $r['deleted_at'],
        ];
    }, $rows);

    echo json_encode([
        'since' => $sinceRaw,
        'server_time' => date('c'),
        'count' => count($transactions),
        'transactions' => $transactions,
    ]);
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
            t.id, t.client_uuid, t.transaction_date, t.type, t.description, t.amount,
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
            'client_uuid'        => $r['client_uuid'],
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
// Helper: compute balance for one account from the ledger
// ---------------------------------------------------------------------------
function compute_account_balance(int $account_id): ?array
{
    $stmt = db()->prepare(
        'SELECT id, name, type, opening_balance, currency FROM accounts WHERE id = ? LIMIT 1'
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
        'type'            => $acct['type'],
        'currency'        => $acct['currency'],
        'opening_balance' => (float)$acct['opening_balance'],
        'balance'         => round($balance, 2),
    ];
}

function normalize_budget_month(string $value): ?string
{
    $value = trim($value);
    if (preg_match('/^\d{4}-\d{2}$/', $value)) {
        return $value . '-01';
    }
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) {
        return date('Y-m-01', strtotime($value));
    }
    return null;
}

function normalize_report_period(): array
{
    $period = $_GET['period'] ?? 'monthly';
    if (!in_array($period, ['daily', 'monthly'], true)) {
        http_response_code(400);
        echo json_encode(['error' => 'period must be daily or monthly']);
        exit;
    }

    if ($period === 'daily') {
        $date = trim($_GET['date'] ?? date('Y-m-d'));
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
            http_response_code(400);
            echo json_encode(['error' => 'date must be YYYY-MM-DD']);
            exit;
        }

        return [
            'period' => 'daily',
            'date' => $date,
            'month' => substr($date, 0, 7),
            'start' => $date,
            'end' => $date,
        ];
    }

    $month = $_GET['month'] ?? date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM']);
        exit;
    }

    return [
        'period' => 'monthly',
        'date' => null,
        'month' => $month,
        'start' => $month . '-01',
        'end' => date('Y-m-t', strtotime($month . '-01')),
    ];
}

function report_filters_sql(array $period): array
{
    return [
        'where' => 't.deleted_at IS NULL AND t.transaction_date >= ? AND t.transaction_date <= ?',
        'params' => [$period['start'], $period['end']],
    ];
}

// ---------------------------------------------------------------------------
// GET /transactions/{id} — single transaction detail (requires auth)
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
// PUT /transactions/{id} — edit existing transaction (requires auth)
// Type is immutable; validate fields by existing type.
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
    $type = $existing['type'];

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
        'UPDATE transactions
            SET transaction_date = ?,
                description = ?,
                amount = ?,
                account_id = ?,
                category_id = ?,
                subcategory_id = ?,
                place_id = ?,
                income_source_id = ?,
                from_account_id = ?,
                to_account_id = ?,
                transfer_label = ?,
                updated_by_user_id = ?
          WHERE id = ? AND deleted_at IS NULL'
    );
    $stmt->execute([
        $date, $description, $amount,
        $account_id, $category_id, $subcategory_id, $place_id,
        $income_source_id, $from_account_id, $to_account_id, $transfer_label,
        $user['id'], $id,
    ]);

    $txn = fetch_transaction($id);
    echo json_encode($txn);
    exit;
}

// ---------------------------------------------------------------------------
// DELETE /transactions/{id} — soft delete a transaction (requires auth)
// ---------------------------------------------------------------------------
if ($method === 'DELETE' && preg_match('#^/transactions/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int)$m[1];
    $stmt = db()->prepare('UPDATE transactions SET deleted_at = NOW() WHERE id = ? AND deleted_at IS NULL');
    $stmt->execute([$id]);

    if ($stmt->rowCount() === 0) {
        http_response_code(404);
        echo json_encode(['error' => 'Transaction not found']);
        exit;
    }

    http_response_code(204);
    exit;
}

// ---------------------------------------------------------------------------
// GET /accounts/balances — all active accounts with computed balances (auth)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/accounts/balances') {
    require_auth();

    $accounts = db()->query(
        'SELECT id FROM accounts WHERE is_active = 1 ORDER BY sort_order, name'
    )->fetchAll();

    $rows = array_map(function ($r) {
        return compute_account_balance((int)$r['id']);
    }, $accounts);

    $rows = array_values(array_filter($rows));

    echo json_encode([
        'count'    => count($rows),
        'accounts' => $rows,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /accounts/{id}/balance — one account balance (auth)
// ---------------------------------------------------------------------------
if ($method === 'GET' && preg_match('#^/accounts/(\d+)/balance$#', $path, $m)) {
    require_auth();
    $balance = compute_account_balance((int)$m[1]);
    if (!$balance) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }
    echo json_encode($balance);
    exit;
}

// ---------------------------------------------------------------------------
// GET /budgets — list month budgets with spent/remaining (auth)
// Query: ?month=YYYY-MM
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/budgets') {
    require_auth();

    $monthStart = normalize_budget_month($_GET['month'] ?? date('Y-m'));
    if (!$monthStart) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM']);
        exit;
    }
    $monthLabel = substr($monthStart, 0, 7);
    $monthEnd = date('Y-m-t', strtotime($monthStart));

    $sql = '
        SELECT
            c.id AS category_id,
            c.name AS category_name,
            mb.id,
            mb.amount,
            mb.created_at,
            mb.updated_at,
            COALESCE(SUM(t.amount), 0) AS spent_amount
        FROM categories c
        LEFT JOIN monthly_budgets mb
          ON mb.category_id = c.id AND mb.budget_month = ?
        LEFT JOIN transactions t
          ON t.type = "expense"
         AND t.deleted_at IS NULL
         AND t.category_id = c.id
         AND t.transaction_date >= ?
         AND t.transaction_date <= ?
        WHERE c.is_active = 1
        GROUP BY c.id, c.name, mb.id, mb.amount, mb.created_at, mb.updated_at
        ORDER BY c.sort_order, c.name
    ';

    $stmt = db()->prepare($sql);
    $stmt->execute([$monthStart, $monthStart, $monthEnd]);
    $rows = $stmt->fetchAll();

    $budgets = array_map(function ($r) {
        $amount = $r['amount'] !== null ? (float)$r['amount'] : 0.0;
        $spent = (float)$r['spent_amount'];
        return [
            'id' => $r['id'] ? (int)$r['id'] : null,
            'budget_month' => substr($GLOBALS['monthStart'] ?? $r['budget_month'] ?? date('Y-m-01'), 0, 7),
            'category_id' => (int)$r['category_id'],
            'category_name' => $r['category_name'],
            'amount' => $amount,
            'spent_amount' => $spent,
            'remaining_amount' => round($amount - $spent, 2),
            'has_budget' => $r['id'] !== null,
            'created_at' => $r['created_at'],
            'updated_at' => $r['updated_at'],
        ];
    }, $rows);

    echo json_encode([
        'month' => $monthLabel,
        'count' => count($budgets),
        'budgets' => $budgets,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /budgets/summary — one category summary for a month (auth)
// Query: ?month=YYYY-MM&category_id={id}
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/budgets/summary') {
    require_auth();

    $monthStart = normalize_budget_month($_GET['month'] ?? date('Y-m'));
    $categoryId = intval($_GET['category_id'] ?? 0);
    if (!$monthStart) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM']);
        exit;
    }
    if (!$categoryId) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }

    $monthEnd = date('Y-m-t', strtotime($monthStart));

    $stmt = db()->prepare('SELECT id, name FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$categoryId]);
    $category = $stmt->fetch();
    if (!$category) {
        http_response_code(404);
        echo json_encode(['error' => 'Category not found']);
        exit;
    }

    $stmt = db()->prepare(
        'SELECT id, amount, created_at, updated_at
         FROM monthly_budgets
         WHERE budget_month = ? AND category_id = ?
         LIMIT 1'
    );
    $stmt->execute([$monthStart, $categoryId]);
    $budget = $stmt->fetch();

    $stmt = db()->prepare(
        'SELECT COALESCE(SUM(amount), 0) AS spent_amount
         FROM transactions
         WHERE deleted_at IS NULL
           AND type = "expense"
           AND category_id = ?
           AND transaction_date >= ?
           AND transaction_date <= ?'
    );
    $stmt->execute([$categoryId, $monthStart, $monthEnd]);
    $spent = (float)($stmt->fetch()['spent_amount'] ?? 0);

    $amount = $budget ? (float)$budget['amount'] : 0.0;

    echo json_encode([
        'month' => substr($monthStart, 0, 7),
        'category_id' => (int)$category['id'],
        'category_name' => $category['name'],
        'budget_id' => $budget ? (int)$budget['id'] : null,
        'budget_amount' => $amount,
        'spent_amount' => $spent,
        'remaining_amount' => round($amount - $spent, 2),
        'has_budget' => (bool)$budget,
        'created_at' => $budget['created_at'] ?? null,
        'updated_at' => $budget['updated_at'] ?? null,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /budgets — create or upsert a monthly budget (auth)
// Body: { month: "YYYY-MM", category_id: 1, amount: 5000 }
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/budgets') {
    $user = require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $monthStart = normalize_budget_month($body['month'] ?? '');
    $categoryId = intval($body['category_id'] ?? 0);
    $amount = $body['amount'] ?? null;

    if (!$monthStart) {
        http_response_code(400);
        echo json_encode(['error' => 'month is required (YYYY-MM)']);
        exit;
    }
    if (!$categoryId) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }
    if ($amount === null || !is_numeric($amount) || (float)$amount < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be a number greater than or equal to 0']);
        exit;
    }
    $amount = round((float)$amount, 2);

    $stmt = db()->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$categoryId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Category not found']);
        exit;
    }

    $stmt = db()->prepare(
        'INSERT INTO monthly_budgets (budget_month, category_id, amount, created_by_user_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount), updated_at = CURRENT_TIMESTAMP'
    );
    $stmt->execute([$monthStart, $categoryId, $amount, $user['id']]);

    $stmt = db()->prepare(
        'SELECT id FROM monthly_budgets WHERE budget_month = ? AND category_id = ? LIMIT 1'
    );
    $stmt->execute([$monthStart, $categoryId]);
    $id = (int)$stmt->fetch()['id'];

    http_response_code(201);
    echo json_encode([
        'id' => $id,
        'month' => substr($monthStart, 0, 7),
        'category_id' => $categoryId,
        'amount' => $amount,
        'message' => 'Budget saved',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// PUT /budgets/{id} — update an existing monthly budget (auth)
// Body: { amount: 5000 }
// ---------------------------------------------------------------------------
if ($method === 'PUT' && preg_match('#^/budgets/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int)$m[1];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $amount = $body['amount'] ?? null;

    if ($amount === null || !is_numeric($amount) || (float)$amount < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be a number greater than or equal to 0']);
        exit;
    }
    $amount = round((float)$amount, 2);

    $stmt = db()->prepare(
        'UPDATE monthly_budgets SET amount = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    );
    $stmt->execute([$amount, $id]);

    if ($stmt->rowCount() === 0) {
        $stmt = db()->prepare('SELECT id FROM monthly_budgets WHERE id = ? LIMIT 1');
        $stmt->execute([$id]);
        if (!$stmt->fetch()) {
            http_response_code(404);
            echo json_encode(['error' => 'Budget not found']);
            exit;
        }
    }

    echo json_encode([
        'id' => $id,
        'amount' => $amount,
        'message' => 'Budget updated',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /reports/summary — totals for a day or month (auth)
// Query daily:   ?period=daily&date=YYYY-MM-DD
// Query monthly: ?period=monthly&month=YYYY-MM
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/reports/summary') {
    require_auth();
    $period = normalize_report_period();
    $filters = report_filters_sql($period);

    $stmt = db()->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income_total,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense_total,
            COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0) AS transfer_total
         FROM transactions t
         WHERE {$filters['where']}"
    );
    $stmt->execute($filters['params']);
    $row = $stmt->fetch();

    echo json_encode([
        'period' => $period['period'],
        'date' => $period['date'],
        'month' => $period['month'],
        'start' => $period['start'],
        'end' => $period['end'],
        'income_total' => (float) $row['income_total'],
        'expense_total' => (float) $row['expense_total'],
        'transfer_total' => (float) $row['transfer_total'],
        'net_total' => round((float) $row['income_total'] - (float) $row['expense_total'], 2),
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /reports/category-breakdown — expense totals by category/subcategory (auth)
// Query daily:   ?period=daily&date=YYYY-MM-DD
// Query monthly: ?period=monthly&month=YYYY-MM
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/reports/category-breakdown') {
    require_auth();
    $period = normalize_report_period();
    $filters = report_filters_sql($period);

    $stmt = db()->prepare(
        "SELECT
            c.id AS category_id,
            c.name AS category_name,
            sc.id AS subcategory_id,
            sc.name AS subcategory_name,
            SUM(t.amount) AS total_amount
         FROM transactions t
         LEFT JOIN categories c ON c.id = t.category_id
         LEFT JOIN subcategories sc ON sc.id = t.subcategory_id
         WHERE {$filters['where']}
           AND t.type = 'expense'
         GROUP BY c.id, c.name, sc.id, sc.name
         ORDER BY total_amount DESC, category_name ASC, subcategory_name ASC"
    );
    $stmt->execute($filters['params']);
    $rows = $stmt->fetchAll();

    $breakdown = array_map(function ($row) {
        return [
            'category_id' => $row['category_id'] ? (int) $row['category_id'] : null,
            'category_name' => $row['category_name'] ?: 'Uncategorized',
            'subcategory_id' => $row['subcategory_id'] ? (int) $row['subcategory_id'] : null,
            'subcategory_name' => $row['subcategory_name'],
            'total_amount' => (float) $row['total_amount'],
        ];
    }, $rows);

    echo json_encode([
        'period' => $period['period'],
        'date' => $period['date'],
        'month' => $period['month'],
        'start' => $period['start'],
        'end' => $period['end'],
        'count' => count($breakdown),
        'breakdown' => $breakdown,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /reports/timeseries — per-day income/expense/transfer totals for a month
// Query: ?month=YYYY-MM
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/reports/timeseries') {
    require_auth();

    $month = $_GET['month'] ?? date('Y-m');
    if (!preg_match('/^\d{4}-\d{2}$/', $month)) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM']);
        exit;
    }

    $start = $month . '-01';
    $end = date('Y-m-t', strtotime($start));

    $stmt = db()->prepare(
        "SELECT
            t.transaction_date,
            COALESCE(SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END), 0) AS income_total,
            COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) AS expense_total,
            COALESCE(SUM(CASE WHEN t.type = 'transfer' THEN t.amount ELSE 0 END), 0) AS transfer_total
         FROM transactions t
         WHERE t.deleted_at IS NULL
           AND t.transaction_date >= ?
           AND t.transaction_date <= ?
         GROUP BY t.transaction_date
         ORDER BY t.transaction_date ASC"
    );
    $stmt->execute([$start, $end]);
    $rows = $stmt->fetchAll();

    $series = array_map(function ($row) {
        return [
            'date' => $row['transaction_date'],
            'income_total' => (float) $row['income_total'],
            'expense_total' => (float) $row['expense_total'],
            'transfer_total' => (float) $row['transfer_total'],
        ];
    }, $rows);

    echo json_encode([
        'month' => $month,
        'start' => $start,
        'end' => $end,
        'count' => count($series),
        'series' => $series,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /accounts — list accounts (auth)
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/accounts') {
    require_auth();

    $includeInactive = ($_GET['include_inactive'] ?? '0') === '1';
    $sql = 'SELECT id, name, type, opening_balance, currency, is_active, sort_order, created_at
            FROM accounts';
    if (!$includeInactive) {
        $sql .= ' WHERE is_active = 1';
    }
    $sql .= ' ORDER BY sort_order, name';

    $rows = db()->query($sql)->fetchAll();
    $accounts = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'opening_balance' => (float) $row['opening_balance'],
            'currency' => $row['currency'],
            'is_active' => (int) $row['is_active'] === 1,
            'sort_order' => (int) $row['sort_order'],
            'created_at' => $row['created_at'],
        ];
    }, $rows);

    echo json_encode([
        'count' => count($accounts),
        'accounts' => $accounts,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /accounts — create account (auth)
// Body: { name, type?, opening_balance?, currency?, is_active?, sort_order? }
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/accounts') {
    require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $name = trim($body['name'] ?? '');
    $type = trim($body['type'] ?? 'checking');
    $openingBalance = $body['opening_balance'] ?? 0;
    $currency = strtoupper(trim($body['currency'] ?? 'PHP'));
    $isActive = array_key_exists('is_active', $body) ? ((int) !!$body['is_active']) : 1;
    $sortOrder = isset($body['sort_order']) && is_numeric($body['sort_order']) ? (int) $body['sort_order'] : 0;

    $validTypes = ['checking', 'savings', 'cash', 'credit'];

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }
    if (!in_array($type, $validTypes, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'type must be checking, savings, cash, or credit']);
        exit;
    }
    if (!is_numeric($openingBalance)) {
        http_response_code(400);
        echo json_encode(['error' => 'opening_balance must be numeric']);
        exit;
    }
    $openingBalance = round((float) $openingBalance, 2);
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'currency must be a 3-letter code']);
        exit;
    }

    $stmt = db()->prepare(
        'INSERT INTO accounts (name, type, opening_balance, currency, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([$name, $type, $openingBalance, $currency, $isActive, $sortOrder]);

    $id = (int) db()->lastInsertId();
    echo json_encode([
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'opening_balance' => $openingBalance,
        'currency' => $currency,
        'is_active' => $isActive === 1,
        'sort_order' => $sortOrder,
        'message' => 'Account created',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// PUT /accounts/{id} — update account (auth)
// ---------------------------------------------------------------------------
if ($method === 'PUT' && preg_match('#^/accounts/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int) $m[1];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $stmt = db()->prepare('SELECT id FROM accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }

    $name = trim($body['name'] ?? '');
    $type = trim($body['type'] ?? 'checking');
    $openingBalance = $body['opening_balance'] ?? 0;
    $currency = strtoupper(trim($body['currency'] ?? 'PHP'));
    $isActive = array_key_exists('is_active', $body) ? ((int) !!$body['is_active']) : 1;
    $sortOrder = isset($body['sort_order']) && is_numeric($body['sort_order']) ? (int) $body['sort_order'] : 0;

    $validTypes = ['checking', 'savings', 'cash', 'credit'];

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }
    if (!in_array($type, $validTypes, true)) {
        http_response_code(400);
        echo json_encode(['error' => 'type must be checking, savings, cash, or credit']);
        exit;
    }
    if (!is_numeric($openingBalance)) {
        http_response_code(400);
        echo json_encode(['error' => 'opening_balance must be numeric']);
        exit;
    }
    $openingBalance = round((float) $openingBalance, 2);
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'currency must be a 3-letter code']);
        exit;
    }

    $stmt = db()->prepare(
        'UPDATE accounts
         SET name = ?, type = ?, opening_balance = ?, currency = ?, is_active = ?, sort_order = ?
         WHERE id = ?'
    );
    $stmt->execute([$name, $type, $openingBalance, $currency, $isActive, $sortOrder, $id]);

    echo json_encode([
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'opening_balance' => $openingBalance,
        'currency' => $currency,
        'is_active' => $isActive === 1,
        'sort_order' => $sortOrder,
        'message' => 'Account updated',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// DELETE /accounts/{id} — guarded delete account + related transactions (auth)
// Body: { confirmation: "delete Account Name" }
// ---------------------------------------------------------------------------
if ($method === 'DELETE' && preg_match('#^/accounts/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int) $m[1];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $stmt = db()->prepare('SELECT id, name FROM accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $account = $stmt->fetch();
    if (!$account) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }

    $expected = 'delete ' . $account['name'];
    $confirmation = trim($body['confirmation'] ?? '');
    if ($confirmation !== $expected) {
        http_response_code(400);
        echo json_encode([
            'error' => 'confirmation text does not match',
            'expected' => $expected,
        ]);
        exit;
    }

    db()->beginTransaction();
    try {
        db()->prepare(
            'DELETE FROM transactions
             WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?'
        )->execute([$id, $id, $id]);

        db()->prepare('DELETE FROM accounts WHERE id = ?')->execute([$id]);

        db()->commit();
    } catch (Throwable $e) {
        if (db()->inTransaction()) {
            db()->rollBack();
        }
        throw $e;
    }

    echo json_encode([
        'id' => $id,
        'message' => 'Account and related transactions deleted',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /subcategories — list subcategories (auth)
// Query: ?include_inactive=1 to include inactive rows
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/subcategories') {
    require_auth();

    $includeInactive = ($_GET['include_inactive'] ?? '0') === '1';
    $sql = '
        SELECT
            sc.id,
            sc.category_id,
            c.name AS category_name,
            sc.name,
            sc.is_active,
            sc.sort_order
        FROM subcategories sc
        INNER JOIN categories c ON c.id = sc.category_id
    ';
    if (!$includeInactive) {
        $sql .= ' WHERE sc.is_active = 1';
    }
    $sql .= ' ORDER BY c.sort_order, c.name, sc.sort_order, sc.name';

    $rows = db()->query($sql)->fetchAll();
    $items = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'category_id' => (int) $row['category_id'],
            'category_name' => $row['category_name'],
            'name' => $row['name'],
            'is_active' => (int) $row['is_active'] === 1,
            'sort_order' => (int) $row['sort_order'],
        ];
    }, $rows);

    echo json_encode([
        'count' => count($items),
        'subcategories' => $items,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /subcategories — create subcategory (auth)
// Body: { category_id, name, is_active?, sort_order? }
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/subcategories') {
    require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $categoryId = intval($body['category_id'] ?? 0);
    $name = trim($body['name'] ?? '');
    $isActive = array_key_exists('is_active', $body) ? ((int) !!$body['is_active']) : 1;
    $sortOrder = isset($body['sort_order']) && is_numeric($body['sort_order']) ? (int) $body['sort_order'] : 0;

    if (!$categoryId) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }

    $stmt = db()->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$categoryId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Category not found']);
        exit;
    }

    $stmt = db()->prepare(
        'INSERT INTO subcategories (category_id, name, is_active, sort_order)
         VALUES (?, ?, ?, ?)'
    );
    $stmt->execute([$categoryId, $name, $isActive, $sortOrder]);

    $id = (int) db()->lastInsertId();
    echo json_encode([
        'id' => $id,
        'category_id' => $categoryId,
        'name' => $name,
        'is_active' => $isActive === 1,
        'sort_order' => $sortOrder,
        'message' => 'Subcategory created',
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// PUT /subcategories/{id} — update subcategory (auth)
// ---------------------------------------------------------------------------
if ($method === 'PUT' && preg_match('#^/subcategories/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int) $m[1];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $stmt = db()->prepare('SELECT id FROM subcategories WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Subcategory not found']);
        exit;
    }

    $categoryId = intval($body['category_id'] ?? 0);
    $name = trim($body['name'] ?? '');
    $isActive = array_key_exists('is_active', $body) ? ((int) !!$body['is_active']) : 1;
    $sortOrder = isset($body['sort_order']) && is_numeric($body['sort_order']) ? (int) $body['sort_order'] : 0;

    if (!$categoryId) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }
    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }

    $stmt = db()->prepare('SELECT id FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$categoryId]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Category not found']);
        exit;
    }

    $stmt = db()->prepare(
        'UPDATE subcategories
         SET category_id = ?, name = ?, is_active = ?, sort_order = ?
         WHERE id = ?'
    );
    $stmt->execute([$categoryId, $name, $isActive, $sortOrder, $id]);

    echo json_encode([
        'id' => $id,
        'category_id' => $categoryId,
        'name' => $name,
        'is_active' => $isActive === 1,
        'sort_order' => $sortOrder,
        'message' => 'Subcategory updated',
    ]);
    exit;
}

http_response_code(404);
echo json_encode([
    'error'  => 'Not found',
    'path'   => $path,
    'method' => $method,
]);
