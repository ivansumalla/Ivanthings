<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_json(405, ['error' => 'Método no permitido']);
}

$payload = json_decode(file_get_contents('php://input'), true);

$numEnvio = trim((string) ($payload['numEnvio'] ?? ''));
$estado = $payload['estado'] ?? null;
$comentario = trim((string) ($payload['comentario'] ?? ''));
$horas = $payload['horasPropuestas'] ?? [];
$transportista = trim((string) ($payload['transportista'] ?? ''));

if ($numEnvio === '' || !in_array($estado, ['Confirmado', 'Rechazado'], true)) {
    respond_json(400, ['error' => 'Datos de respuesta incompletos']);
}

if ($estado === 'Rechazado') {
    $horas = array_filter(array_map('trim', is_array($horas) ? $horas : explode(',', (string) $horas)));
    if (!$horas) {
        respond_json(400, ['error' => 'Debes proponer al menos una hora alternativa.']);
    }
}

$horasSerializadas = is_array($horas) ? implode(',', $horas) : (string) $horas;

$pdo = get_connection();
$pdo->beginTransaction();

try {
    $baseStmt = $pdo->prepare(
        "SELECT TOP 1
            plc.Fecha_Ayer AS fechaCarga,
            plc.cliente AS clienteId,
            plc.NroOF AS produccion
        FROM v_lip_modifica_PV_prevp_ListadoCargas plc
        WHERE plc.NroEnvio = :numenvio"
    );
    $baseStmt->execute([':numenvio' => $numEnvio]);
    $baseData = $baseStmt->fetch() ?: [];

    $merge = $pdo->prepare(
        'MERGE lip_cargas_excel AS target
         USING (SELECT :numenvio AS numenvio) AS source
            ON target.numenvio = source.numenvio
         WHEN MATCHED THEN
            UPDATE SET
                Confirmado = :estado,
                HoraPropuesta = :horas,
                EnviadoEmail = :enviado,
                Transportista = :transportista
         WHEN NOT MATCHED THEN
            INSERT (
                numenvio,
                HoraCarga,
                EnviarCorreo,
                HoraPropuesta,
                Confirmado,
                EnviadoEmail,
                FechaCarga,
                ClienteId,
                Produccion,
                Poblacion,
                Transportista,
                sus_nuestros
            )
            VALUES (
                :numenvio,
                NULL,
                0,
                :horas,
                :estado,
                :enviado,
                :fechaCarga,
                :clienteId,
                :produccion,
                NULL,
                :transportista,
                NULL
            );'
    );

    $merge->execute([
        ':numenvio' => $numEnvio,
        ':estado' => $estado,
        ':horas' => $horasSerializadas !== '' ? $horasSerializadas : null,
        ':enviado' => $estado === 'Confirmado' ? 'enviado' : 'enviado cambio',
        ':fechaCarga' => normalise_date($baseData['fechaCarga'] ?? null),
        ':clienteId' => $baseData['clienteId'] ?? null,
        ':produccion' => $baseData['produccion'] ?? null,
        ':transportista' => $transportista !== '' ? $transportista : null,
    ]);

    $stmt = $pdo->prepare(
        'INSERT INTO lip_cargas_respuestas (numenvio, estado, comentario, horas_propuestas, transportista_codigo, respondido_en)
         VALUES (:numenvio, :estado, :comentario, :horas, :transportista, SYSDATETIME())'
    );
    $stmt->execute([
        ':numenvio' => $numEnvio,
        ':estado' => $estado,
        ':comentario' => $comentario !== '' ? $comentario : null,
        ':horas' => $horasSerializadas !== '' ? $horasSerializadas : null,
        ':transportista' => $transportista !== '' ? $transportista : null,
    ]);

    $pdo->commit();
} catch (PDOException $exception) {
    $pdo->rollBack();

    if (stripos($exception->getMessage(), 'Invalid object name') !== false) {
        respond_json(409, [
            'error' => 'Faltan tablas en la base de datos (lip_cargas_excel o lip_cargas_respuestas).',
        ]);
    }

    respond_json(500, [
        'error' => 'No se pudo registrar la respuesta del transportista.',
        'details' => $exception->getMessage(),
    ]);
}

respond_json(200, [
    'numEnvio' => $numEnvio,
    'estado' => $estado,
    'comentario' => $comentario,
    'horasPropuestas' => $horas,
]);
