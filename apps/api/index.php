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
        'version' => '0.6.0',
        'phase'   => 6,
        'status'  => 'Phase 6 — settings management',
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

function subcategory_payload(array $row): array
{
    return [
        'id' => (int) $row['id'],
        'category_id' => (int) $row['category_id'],
        'category_name' => $row['category_name'] ?? null,
        'name' => $row['name'],
        'is_active' => (bool) $row['is_active'],
        'sort_order' => (int) $row['sort_order'],
    ];
}

function monthly_budget_summary(string $month, int $categoryId): array
{
    $budgetMonth = normalize_budget_month($month);
    if ($budgetMonth === null) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM or YYYY-MM-DD']);
        exit;
    }

    $stmt = db()->prepare('SELECT id, name FROM categories WHERE id = ? LIMIT 1');
    $stmt->execute([$categoryId]);
    $category = $stmt->fetch();
    if (!$category) {
        http_response_code(404);
        echo json_encode(['error' => 'Category not found']);
        exit;
    }

    $stmt = db()->prepare(
        'SELECT id, amount
         FROM monthly_budgets
         WHERE budget_month = ? AND category_id = ?
         LIMIT 1'
    );
    $stmt->execute([$budgetMonth, $categoryId]);
    $budget = $stmt->fetch();

    $monthStart = $budgetMonth;
    $monthEnd = date('Y-m-t', strtotime($budgetMonth));

    $stmt = db()->prepare(
        'SELECT COALESCE(SUM(amount), 0) AS spent
         FROM transactions
         WHERE deleted_at IS NULL
           AND type = "expense"
           AND category_id = ?
           AND transaction_date >= ?
           AND transaction_date <= ?'
    );
    $stmt->execute([$categoryId, $monthStart, $monthEnd]);
    $spent = (float) ($stmt->fetch()['spent'] ?? 0);

    $budgetAmount = $budget ? (float) $budget['amount'] : 0.0;

    return [
        'month'            => substr($budgetMonth, 0, 7),
        'budget_month'     => $budgetMonth,
        'category_id'      => (int) $category['id'],
        'category_name'    => $category['name'],
        'budget_id'        => $budget ? (int) $budget['id'] : null,
        'budget_amount'    => round($budgetAmount, 2),
        'spent_amount'     => round($spent, 2),
        'remaining_amount' => round($budgetAmount - $spent, 2),
        'has_budget'       => $budget ? true : false,
    ];
}

// ---------------------------------------------------------------------------
// GET /accounts — list accounts with computed balances
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/accounts') {
    require_auth();

    $rows = db()->query(
        'SELECT id, name, type, opening_balance, currency, is_active, sort_order
         FROM accounts
         ORDER BY sort_order, name'
    )->fetchAll();

    $accounts = array_map(function ($row) {
        $balance = compute_account_balance((int) $row['id']);
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'type' => $row['type'],
            'opening_balance' => (float) $row['opening_balance'],
            'currency' => $row['currency'],
            'is_active' => (bool) $row['is_active'],
            'sort_order' => (int) $row['sort_order'],
            'balance' => $balance ? (float) $balance['balance'] : 0.0,
        ];
    }, $rows);

    echo json_encode(['accounts' => $accounts]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /accounts — create account
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/accounts') {
    require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $name = trim($body['name'] ?? '');
    $type = trim($body['type'] ?? 'checking');
    $openingBalance = $body['opening_balance'] ?? 0;
    $currency = strtoupper(trim($body['currency'] ?? 'PHP'));
    $isActive = array_key_exists('is_active', $body) ? (int) !!$body['is_active'] : 1;
    $sortOrder = (int) ($body['sort_order'] ?? 0);

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }
    if (!is_numeric($openingBalance)) {
        http_response_code(400);
        echo json_encode(['error' => 'opening_balance must be numeric']);
        exit;
    }
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'currency must be a 3-letter code']);
        exit;
    }

    db()->prepare(
        'INSERT INTO accounts (name, type, opening_balance, currency, is_active, sort_order)
         VALUES (?, ?, ?, ?, ?, ?)'
    )->execute([$name, $type, round((float) $openingBalance, 2), $currency, $isActive, $sortOrder]);

    $id = (int) db()->lastInsertId();
    $account = compute_account_balance($id);
    echo json_encode([
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'opening_balance' => round((float) $openingBalance, 2),
        'currency' => $currency,
        'is_active' => (bool) $isActive,
        'sort_order' => $sortOrder,
        'balance' => $account ? (float) $account['balance'] : round((float) $openingBalance, 2),
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// PUT /accounts/{id} — update account
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
    $isActive = array_key_exists('is_active', $body) ? (int) !!$body['is_active'] : 1;
    $sortOrder = (int) ($body['sort_order'] ?? 0);

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['error' => 'name is required']);
        exit;
    }
    if (!is_numeric($openingBalance)) {
        http_response_code(400);
        echo json_encode(['error' => 'opening_balance must be numeric']);
        exit;
    }
    if (!preg_match('/^[A-Z]{3}$/', $currency)) {
        http_response_code(400);
        echo json_encode(['error' => 'currency must be a 3-letter code']);
        exit;
    }

    db()->prepare(
        'UPDATE accounts
         SET name = ?, type = ?, opening_balance = ?, currency = ?, is_active = ?, sort_order = ?
         WHERE id = ?'
    )->execute([$name, $type, round((float) $openingBalance, 2), $currency, $isActive, $sortOrder, $id]);

    $account = compute_account_balance($id);
    echo json_encode([
        'id' => $id,
        'name' => $name,
        'type' => $type,
        'opening_balance' => round((float) $openingBalance, 2),
        'currency' => $currency,
        'is_active' => (bool) $isActive,
        'sort_order' => $sortOrder,
        'balance' => $account ? (float) $account['balance'] : round((float) $openingBalance, 2),
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// DELETE /accounts/{id} — hard delete account and all related transactions
// ---------------------------------------------------------------------------
if ($method === 'DELETE' && preg_match('#^/accounts/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int) $m[1];

    $stmt = db()->prepare('SELECT id FROM accounts WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        http_response_code(404);
        echo json_encode(['error' => 'Account not found']);
        exit;
    }

    $pdo = db();
    $pdo->beginTransaction();
    try {
        $pdo->prepare(
            'DELETE FROM transactions
             WHERE account_id = ? OR from_account_id = ? OR to_account_id = ?'
        )->execute([$id, $id, $id]);

        $pdo->prepare('DELETE FROM accounts WHERE id = ?')->execute([$id]);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        http_response_code(500);
        echo json_encode(['error' => 'Failed to delete account']);
        exit;
    }

    http_response_code(204);
    exit;
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
// GET /budgets?month=YYYY-MM — list monthly budgets with spent/remaining
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/budgets') {
    require_auth();

    $budgetMonth = normalize_budget_month($_GET['month'] ?? date('Y-m'));
    if ($budgetMonth === null) {
        http_response_code(400);
        echo json_encode(['error' => 'month must be YYYY-MM']);
        exit;
    }

    $stmt = db()->prepare(
        'SELECT
            mb.id,
            mb.budget_month,
            mb.category_id,
            c.name AS category_name,
            mb.amount,
            COALESCE(SUM(t.amount), 0) AS spent_amount
         FROM monthly_budgets mb
         JOIN categories c ON c.id = mb.category_id
         LEFT JOIN transactions t
           ON t.category_id = mb.category_id
          AND t.type = "expense"
          AND t.deleted_at IS NULL
          AND t.transaction_date >= mb.budget_month
          AND t.transaction_date <= LAST_DAY(mb.budget_month)
         WHERE mb.budget_month = ?
         GROUP BY mb.id, mb.budget_month, mb.category_id, c.name, mb.amount
         ORDER BY c.sort_order, c.name'
    );
    $stmt->execute([$budgetMonth]);
    $rows = $stmt->fetchAll();

    $budgets = array_map(function ($row) {
        $amount = (float) $row['amount'];
        $spent = (float) $row['spent_amount'];
        return [
            'id'               => (int) $row['id'],
            'budget_month'     => $row['budget_month'],
            'month'            => substr($row['budget_month'], 0, 7),
            'category_id'      => (int) $row['category_id'],
            'category_name'    => $row['category_name'],
            'amount'           => round($amount, 2),
            'spent_amount'     => round($spent, 2),
            'remaining_amount' => round($amount - $spent, 2),
        ];
    }, $rows);

    echo json_encode([
        'month' => substr($budgetMonth, 0, 7),
        'count' => count($budgets),
        'budgets' => $budgets,
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// GET /budgets/summary?month=YYYY-MM&category_id=ID
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/budgets/summary') {
    require_auth();

    $categoryId = (int) ($_GET['category_id'] ?? 0);
    if ($categoryId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }

    echo json_encode(monthly_budget_summary($_GET['month'] ?? date('Y-m'), $categoryId));
    exit;
}

// ---------------------------------------------------------------------------
// POST /budgets — create or upsert a monthly budget for one category
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/budgets') {
    $user = require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $budgetMonth = normalize_budget_month($body['month'] ?? '');
    $categoryId = (int) ($body['category_id'] ?? 0);
    $amount = $body['amount'] ?? null;

    if ($budgetMonth === null) {
        http_response_code(400);
        echo json_encode(['error' => 'month is required (YYYY-MM)']);
        exit;
    }
    if ($categoryId <= 0) {
        http_response_code(400);
        echo json_encode(['error' => 'category_id is required']);
        exit;
    }
    if ($amount === null || !is_numeric($amount) || (float) $amount < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be 0 or greater']);
        exit;
    }
    $amount = round((float) $amount, 2);

    db()->prepare(
        'INSERT INTO monthly_budgets (budget_month, category_id, amount, created_by_user_id)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE amount = VALUES(amount)'
    )->execute([$budgetMonth, $categoryId, $amount, $user['id']]);

    http_response_code(201);
    echo json_encode(monthly_budget_summary($budgetMonth, $categoryId));
    exit;
}

// ---------------------------------------------------------------------------
// PUT /budgets/{id} — update a monthly budget amount
// ---------------------------------------------------------------------------
if ($method === 'PUT' && preg_match('#^/budgets/(\d+)$#', $path, $m)) {
    require_auth();
    $id = (int) $m[1];
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $amount = $body['amount'] ?? null;
    if ($amount === null || !is_numeric($amount) || (float) $amount < 0) {
        http_response_code(400);
        echo json_encode(['error' => 'amount must be 0 or greater']);
        exit;
    }
    $amount = round((float) $amount, 2);

    $stmt = db()->prepare('SELECT id, budget_month, category_id FROM monthly_budgets WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $budget = $stmt->fetch();
    if (!$budget) {
        http_response_code(404);
        echo json_encode(['error' => 'Budget not found']);
        exit;
    }

    db()->prepare('UPDATE monthly_budgets SET amount = ? WHERE id = ?')->execute([$amount, $id]);

    echo json_encode(monthly_budget_summary($budget['budget_month'], (int) $budget['category_id']));
    exit;
}

// ---------------------------------------------------------------------------
// GET /subcategories — list all subcategories with category names
// ---------------------------------------------------------------------------
if ($method === 'GET' && $path === '/subcategories') {
    require_auth();

    $rows = db()->query(
        'SELECT sc.id, sc.category_id, c.name AS category_name, sc.name, sc.is_active, sc.sort_order
         FROM subcategories sc
         JOIN categories c ON c.id = sc.category_id
         ORDER BY c.sort_order, c.name, sc.sort_order, sc.name'
    )->fetchAll();

    echo json_encode([
        'subcategories' => array_map('subcategory_payload', $rows),
    ]);
    exit;
}

// ---------------------------------------------------------------------------
// POST /subcategories — create subcategory
// ---------------------------------------------------------------------------
if ($method === 'POST' && $path === '/subcategories') {
    require_auth();
    $body = json_decode(file_get_contents('php://input'), true) ?? [];

    $categoryId = (int) ($body['category_id'] ?? 0);
    $name = trim($body['name'] ?? '');
    $isActive = array_key_exists('is_active', $body) ? (int) !!$body['is_active'] : 1;
    $sortOrder = (int) ($body['sort_order'] ?? 0);

    if ($categoryId <= 0) {
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

    db()->prepare(
        'INSERT INTO subcategories (category_id, name, is_active, sort_order)
         VALUES (?, ?, ?, ?)'
    )->execute([$categoryId, $name, $isActive, $sortOrder]);

    $id = (int) db()->lastInsertId();
    $stmt = db()->prepare(
        'SELECT sc.id, sc.category_id, c.name AS category_name, sc.name, sc.is_active, sc.sort_order
         FROM subcategories sc
         JOIN categories c ON c.id = sc.category_id
         WHERE sc.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);

    http_response_code(201);
    echo json_encode(subcategory_payload($stmt->fetch()));
    exit;
}

// ---------------------------------------------------------------------------
// PUT /subcategories/{id} — update subcategory
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

    $categoryId = (int) ($body['category_id'] ?? 0);
    $name = trim($body['name'] ?? '');
    $isActive = array_key_exists('is_active', $body) ? (int) !!$body['is_active'] : 1;
    $sortOrder = (int) ($body['sort_order'] ?? 0);

    if ($categoryId <= 0) {
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

    db()->prepare(
        'UPDATE subcategories
         SET category_id = ?, name = ?, is_active = ?, sort_order = ?
         WHERE id = ?'
    )->execute([$categoryId, $name, $isActive, $sortOrder, $id]);

    $stmt = db()->prepare(
        'SELECT sc.id, sc.category_id, c.name AS category_name, sc.name, sc.is_active, sc.sort_order
         FROM subcategories sc
         JOIN categories c ON c.id = sc.category_id
         WHERE sc.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);

    echo json_encode(subcategory_payload($stmt->fetch()));
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
