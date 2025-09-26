<?php

declare(strict_types=1);

require __DIR__ . '/bootstrap.php';

$pdo = get_connection();

$params = [];
$filters = [];

if (!empty($_GET['numEnvio'])) {
    $filters[] = 'plc.NroEnvio = :numEnvio';
    $params[':numEnvio'] = $_GET['numEnvio'];
}

$where = '';
if ($filters) {
    $where = ' AND ' . implode(' AND ', $filters);
}

$sqlBase = <<<SQL
SELECT
    'Pedido de Venta - ' + plc.TIPO AS tipoPedido,
    plc.NroEnvio AS numEnvio,
    plc.NroOF AS produccion,
    COALESCE(lce.HoraCarga, '') AS horaCarga,
    COALESCE(lce.Confirmado, '') AS confirmado,
    COALESCE(lce.EnviarCorreo, 0) AS enviarCorreo,
    COALESCE(lce.HoraPropuesta, '') AS horasPropuestas,
    COALESCE(lce.EnviadoEmail, '') AS enviadoMail,
    COALESCE(CONVERT(varchar(10), lce.FechaCarga, 23), CONVERT(varchar(10), plc.Fecha_Ayer, 23)) AS fechaCarga,
    plc.cliente AS clienteId,
    plc.Nombre AS clienteNombre,
    COALESCE(lce.Poblacion, '') AS poblacion,
    plc.NroPedVta AS pedidoVenta,
    plc.NroOF AS ordenFabricacion,
    plc.Articulo AS articuloId,
    plc.Descripcion AS articuloNombre,
    CAST(0 AS decimal(18,2)) AS qty,
    COALESCE(lce.Transportista, '') AS transportista,
    COALESCE(lce.sus_nuestros, '') AS susNuestros,
    '' AS observacionesEnvio,
    CAST(NULL AS datetime) AS horarioDescarga,
    CAST(NULL AS datetime) AS fechaDescarga,
    CAST(NULL AS varchar(20)) AS fechaDiff,
    '' AS documento,
    '' AS taxGroup,
    '' AS almacen
FROM v_lip_modifica_PV_prevp_ListadoCargas plc
LEFT JOIN lip_cargas_excel lce ON lce.numenvio = plc.NroEnvio
WHERE plc.TIPO IS NOT NULL
  AND plc.TIPO <> '1-Qty modificada'
  {$where}
SQL;

$sqlWithResponses = <<<SQL
WITH respuestas AS (
    SELECT
        r.numenvio,
        r.estado,
        r.comentario,
        r.horas_propuestas,
        r.transportista_codigo,
        r.respondido_en,
        ROW_NUMBER() OVER (PARTITION BY r.numenvio ORDER BY r.respondido_en DESC) AS rn
    FROM lip_cargas_respuestas r
)
SELECT
    base.*,
    resp.estado AS respuestaEstado,
    resp.comentario AS respuestaComentario,
    resp.horas_propuestas AS respuestaHoras,
    resp.transportista_codigo AS respuestaTransportista,
    resp.respondido_en AS respuestaFecha
FROM ({$sqlBase}) base
LEFT JOIN respuestas resp ON resp.numenvio = base.numEnvio AND resp.rn = 1
ORDER BY base.fechaCarga, base.numEnvio
SQL;

try {
    $stmt = $pdo->prepare($sqlWithResponses);
    $stmt->execute($params);
} catch (PDOException $exception) {
    if (stripos($exception->getMessage(), 'Invalid object name') === false) {
        respond_json(500, [
            'error' => 'No se pudieron recuperar las cargas.',
            'details' => $exception->getMessage(),
        ]);
    }

    $stmt = $pdo->prepare($sqlBase . ' ORDER BY fechaCarga, numEnvio');
    $stmt->execute($params);
}

$rows = $stmt->fetchAll();

$loads = array_map(static function (array $row) {
    return [
        'tipoPedido' => $row['tipoPedido'] ?? null,
        'numEnvio' => $row['numEnvio'] ?? null,
        'produccion' => $row['produccion'] ?? null,
        'horaCarga' => $row['horaCarga'] ?? null,
        'confirmado' => $row['confirmado'] ?? null,
        'enviarCorreo' => normalise_bool($row['enviarCorreo'] ?? 0),
        'horasPropuestas' => $row['horasPropuestas'] ?? null,
        'enviadoMail' => $row['enviadoMail'] ?? null,
        'fechaCarga' => normalise_date($row['fechaCarga'] ?? null),
        'clienteId' => $row['clienteId'] ?? null,
        'clienteNombre' => $row['clienteNombre'] ?? null,
        'poblacion' => $row['poblacion'] ?? null,
        'pedidoVenta' => $row['pedidoVenta'] ?? null,
        'ordenFabricacion' => $row['ordenFabricacion'] ?? null,
        'articuloId' => $row['articuloId'] ?? null,
        'articuloNombre' => $row['articuloNombre'] ?? null,
        'qty' => $row['qty'] ?? null,
        'transportista' => $row['transportista'] ?? null,
        'susNuestros' => $row['susNuestros'] ?? null,
        'observacionesEnvio' => $row['observacionesEnvio'] ?? null,
        'horarioDescarga' => $row['horarioDescarga'] ?? null,
        'fechaDescarga' => $row['fechaDescarga'] ?? null,
        'fechaDiff' => $row['fechaDiff'] ?? null,
        'documento' => $row['documento'] ?? null,
        'taxGroup' => $row['taxGroup'] ?? null,
        'almacen' => $row['almacen'] ?? null,
        'respuesta' => [
            'estado' => $row['respuestaEstado'] ?? null,
            'comentario' => $row['respuestaComentario'] ?? null,
            'horas' => $row['respuestaHoras'] ?? null,
            'transportista' => $row['respuestaTransportista'] ?? null,
            'fecha' => $row['respuestaFecha'] ?? null,
        ],
    ];
}, $rows);

respond_json(200, [
    'data' => $loads,
]);
