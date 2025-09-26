# Gestor de cargas

Este repositorio contiene el frontal del gestor de cargas de LIPSA y una capa de
API en PHP que conecta con la base de datos AX / Azure mediante PDO SQL Server.
El objetivo es disponer de un flujo completo que recupere las cargas del día
siguiente, permita asignar horas y marcar envíos para correo, así como recoger la
respuesta de los transportistas.

## Estructura

- `index.html`: panel interno para planificadores y logística.
- `response.html`: formulario público que reciben los transportistas.
- `styles.css`: hoja de estilos compartida.
- `js/state.js`: utilidades de formato y autenticación básica.
- `js/api.js`: cliente ligero para consumir la API PHP.
- `js/app.js`: lógica del panel interno (consulta, agenda, contactos).
- `js/response.js`: lógica del formulario de respuesta público.
- `api/`: controladores PHP que ejecutan las queries contra SQL Server.

## Requisitos

1. Servidor web con PHP 8.1+ y la extensión `pdo_sqlsrv` habilitada.
2. Acceso a la instancia `AXSQL` con la base de datos `AX_REAL`.
3. Tablas necesarias en la BBDD:
   ```sql
   CREATE TABLE lip_cargas_excel (
       numenvio NVARCHAR(50) PRIMARY KEY,
       HoraCarga TIME NULL,
       EnviarCorreo BIT NOT NULL DEFAULT 0,
       HoraPropuesta NVARCHAR(255) NULL,
       Confirmado NVARCHAR(30) NULL,
       EnviadoEmail NVARCHAR(30) NULL,
       FechaCarga DATE NULL,
       ClienteId NVARCHAR(50) NULL,
       Produccion NVARCHAR(50) NULL,
       Poblacion NVARCHAR(100) NULL,
       Transportista NVARCHAR(50) NULL,
       sus_nuestros NVARCHAR(100) NULL
   );

   CREATE TABLE lip_cargas_respuestas (
       id INT IDENTITY(1,1) PRIMARY KEY,
       numenvio NVARCHAR(50) NOT NULL,
       estado NVARCHAR(30) NOT NULL,
       comentario NVARCHAR(500) NULL,
       horas_propuestas NVARCHAR(255) NULL,
       transportista_codigo NVARCHAR(50) NULL,
       respondido_en DATETIME2 NOT NULL DEFAULT SYSDATETIME()
   );

   CREATE TABLE lip_transportistas_contactos (
       codigo NVARCHAR(50) PRIMARY KEY,
       nombre NVARCHAR(150) NOT NULL,
       email NVARCHAR(150) NOT NULL,
       telefono NVARCHAR(50) NULL
   );

   CREATE TABLE lip_clientes_contactos (
       codigo NVARCHAR(50) PRIMARY KEY,
       nombre NVARCHAR(150) NOT NULL,
       email NVARCHAR(150) NOT NULL,
       telefono NVARCHAR(50) NULL
   );
   ```

## Configuración

1. Copia el repositorio en el webserver (por ejemplo `/var/www/gestor-cargas`).
2. Asegúrate de que el usuario `www-data` puede leer la carpeta.
3. Ajusta las credenciales en `api/config.php` si fuese necesario.
4. Habilita los módulos de Apache necesarios (`rewrite`, `php`).
5. Comprueba la conectividad a la base de datos:
   ```bash
   php -r "require 'api/bootstrap.php'; get_connection(); echo 'OK';"
   ```

## Uso

1. Accede a `index.html` desde la intranet corporativa.
2. Inicia sesión con los usuarios de demo (`planificador/planificador` o
   `logistica/logistica`).
3. Pulsa **“Listar cargas”** para ejecutar la query real:
   ```sql
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
     AND plc.TIPO <> '1-Qty modificada';
   ```
4. Modifica las horas y marca **Enviar correo** cuando proceda. El botón
   **“Guardar horas”** persiste los cambios usando el `INSERT`/`UPDATE` oficial:
   ```sql
   INSERT INTO lip_cargas_excel (
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
   ) VALUES (...)
   ```
   (el backend aplica `MERGE` para realizar *upsert*).
5. **“Enviar correos”** marca los envíos como enviados en `lip_cargas_excel`.
6. Mantén los contactos de transportistas y clientes desde sus formularios
   dedicados. Los datos se guardan en `lip_transportistas_contactos` y
   `lip_clientes_contactos`.
7. El formulario público `response.html` actualiza `lip_cargas_excel` y registra
   la respuesta detallada en `lip_cargas_respuestas`.

## Desarrollo local

Para desarrollar sin conexión a la BBDD real, se puede levantar un contenedor
Docker con SQL Server Express y crear tablas temporales utilizando los scripts
anteriores. A continuación, actualizar `api/config.php` para apuntar al host
local.

## Seguridad

- Cambia las credenciales por variables de entorno antes de pasar a producción.
- Publica `response.html` en un subdominio público, pero restringe el panel
  interno a la VPN corporativa.
- Sustituye la autenticación de demo por Azure AD / SSO corporativo en una fase
  posterior.
