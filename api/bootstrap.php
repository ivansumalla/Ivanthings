<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

function respond_json(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function get_connection(): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $config = require __DIR__ . '/config.php';

    try {
        $pdo = new PDO(
            sprintf('sqlsrv:Server=%s;Database=%s', $config['server'], $config['database']),
            $config['username'],
            $config['password'],
            $config['options'] ?? []
        );
        return $pdo;
    } catch (PDOException $exception) {
        respond_json(500, [
            'error' => 'No se pudo establecer la conexión con la base de datos.',
            'details' => $exception->getMessage(),
        ]);
    }
}

function normalise_bool($value): int
{
    if (is_bool($value)) {
        return $value ? 1 : 0;
    }

    if (is_numeric($value)) {
        return (int) ((int) $value !== 0);
    }

    $normalised = strtolower((string) $value);
    return in_array($normalised, ['1', 'true', 'si', 'sí', 'yes'], true) ? 1 : 0;
}

function normalise_date(?string $value): ?string
{
    if (!$value) {
        return null;
    }

    $timestamp = strtotime($value);
    if ($timestamp === false) {
        return null;
    }

    return date('Y-m-d', $timestamp);
}

function normalise_time(?string $value): ?string
{
    if (!$value) {
        return null;
    }

    $value = substr($value, 0, 8);
    if (!preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $value)) {
        return null;
    }

    return strlen($value) === 5 ? $value . ':00' : $value;
}

