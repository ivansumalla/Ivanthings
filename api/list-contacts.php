<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$pdo = get_connection();

function fetch_table(PDO $pdo, string $table): array
{
    try {
        $stmt = $pdo->query("SELECT codigo, nombre, email, telefono FROM {$table} ORDER BY codigo");
        return $stmt->fetchAll() ?: [];
    } catch (PDOException $exception) {
        if (stripos($exception->getMessage(), 'Invalid object name') !== false) {
            return [];
        }
        throw $exception;
    }
}

try {
    $transportistas = fetch_table($pdo, 'lip_transportistas_contactos');
    $clientes = fetch_table($pdo, 'lip_clientes_contactos');
} catch (PDOException $exception) {
    respond_json(500, [
        'error' => 'No se pudieron recuperar los contactos.',
        'details' => $exception->getMessage(),
    ]);
}

respond_json(200, [
    'transportistas' => $transportistas,
    'clientes' => $clientes,
]);
