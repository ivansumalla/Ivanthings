<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond_json(405, ['error' => 'Método no permitido']);
}

$payload = json_decode(file_get_contents('php://input'), true);

if (!is_array($payload) || !isset($payload['loads']) || !is_array($payload['loads'])) {
    respond_json(400, ['error' => 'Formato de carga inválido']);
}

$pdo = get_connection();

$sql = <<<SQL
MERGE lip_cargas_excel AS target
USING (SELECT :numenvio AS numenvio) AS source
    ON target.numenvio = source.numenvio
WHEN MATCHED THEN
    UPDATE SET
        HoraCarga = :horaCarga,
        EnviarCorreo = :enviarCorreo,
        HoraPropuesta = :horasPropuestas,
        Confirmado = :confirmado,
        EnviadoEmail = :enviadoMail,
        FechaCarga = :fechaCarga,
        ClienteId = :clienteId,
        Produccion = :produccion,
        Poblacion = :poblacion,
        Transportista = :transportista,
        sus_nuestros = :susNuestros
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
        :horaCarga,
        :enviarCorreo,
        :horasPropuestas,
        :confirmado,
        :enviadoMail,
        :fechaCarga,
        :clienteId,
        :produccion,
        :poblacion,
        :transportista,
        :susNuestros
    );
SQL;

$stmt = $pdo->prepare($sql);

$result = [];

foreach ($payload['loads'] as $item) {
    if (empty($item['numEnvio'])) {
        continue;
    }

    $params = [
        ':numenvio' => $item['numEnvio'],
        ':horaCarga' => normalise_time($item['horaCarga'] ?? null),
        ':enviarCorreo' => normalise_bool($item['enviarCorreo'] ?? 0),
        ':horasPropuestas' => is_array($item['horasPropuestas'] ?? null)
            ? implode(',', $item['horasPropuestas'])
            : ($item['horasPropuestas'] ?? null),
        ':confirmado' => $item['confirmado'] ?? null,
        ':enviadoMail' => $item['enviadoMail'] ?? null,
        ':fechaCarga' => normalise_date($item['fechaCarga'] ?? null),
        ':clienteId' => $item['clienteId'] ?? null,
        ':produccion' => $item['produccion'] ?? null,
        ':poblacion' => $item['poblacion'] ?? null,
        ':transportista' => $item['transportista'] ?? null,
        ':susNuestros' => $item['susNuestros'] ?? null,
    ];

    $stmt->execute($params);
    $result[] = $item['numEnvio'];
}

respond_json(200, [
    'updated' => $result,
]);
