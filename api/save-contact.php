<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_json(405, ['error' => 'Método no permitido']);
}

$payload = json_decode(file_get_contents('php://input'), true);

$type = $payload['type'] ?? null;
if (!in_array($type, ['transportista', 'cliente'], true)) {
    respond_json(400, ['error' => 'Tipo de contacto inválido']);
}

$codigo = trim((string) ($payload['codigo'] ?? ''));
$nombre = trim((string) ($payload['nombre'] ?? ''));
$email = trim((string) ($payload['email'] ?? ''));
$telefono = trim((string) ($payload['telefono'] ?? ''));

if ($codigo === '' || $nombre === '' || $email === '') {
    respond_json(400, ['error' => 'Código, nombre y correo son obligatorios']);
}

$table = $type === 'transportista' ? 'lip_transportistas_contactos' : 'lip_clientes_contactos';

$sql = <<<SQL
MERGE {$table} AS target
USING (SELECT :codigo AS codigo) AS source
    ON target.codigo = source.codigo
WHEN MATCHED THEN
    UPDATE SET
        nombre = :nombre,
        email = :email,
        telefono = :telefono
WHEN NOT MATCHED THEN
    INSERT (codigo, nombre, email, telefono)
    VALUES (:codigo, :nombre, :email, :telefono);
SQL;

try {
    $pdo = get_connection();
    $stmt = $pdo->prepare($sql);
    $stmt->execute([
        ':codigo' => $codigo,
        ':nombre' => $nombre,
        ':email' => $email,
        ':telefono' => $telefono !== '' ? $telefono : null,
    ]);
} catch (PDOException $exception) {
    if (stripos($exception->getMessage(), 'Invalid object name') !== false) {
        respond_json(409, [
            'error' => 'La tabla de contactos no existe en la base de datos. Verifica el despliegue.',
        ]);
    }

    respond_json(500, [
        'error' => 'No se pudo guardar el contacto.',
        'details' => $exception->getMessage(),
    ]);
}

respond_json(200, [
    'codigo' => $codigo,
    'nombre' => $nombre,
    'email' => $email,
    'telefono' => $telefono,
]);
