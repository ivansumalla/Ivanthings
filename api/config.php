<?php
return [
    'server' => 'AXSQL',
    'database' => 'AX_REAL',
    'username' => 'Lipsaquery',
    'password' => 'Lipsa01',
    'options' => [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ],
];
