# Bitácora de Sincronización y Caché Offline (Julio 2026)

Este documento resume los retos técnicos, diagnósticos y soluciones implementadas en el módulo de sincronización offline de la aplicación (PWA) de ForceLoan, enfocándose en la integración entre el frontend (React/Dexie.js) y el backend (Payload CMS/MongoDB).

## 1. Rediseño del Módulo de Sincronización (`useSync.ts` y `CloudSync.tsx`)
- **Gestión de Estado Asíncrono:** Se reemplazaron las llamadas nativas de `alert()` (que congelan el hilo principal y causan cierres inesperados en WebViews móviles) por un sistema de estado reactivo y barras de progreso en la interfaz gráfica.
- **Transacciones Controladas (Chunking):** Se detectaron errores de `QuotaExceededError` en Safari (iOS) al intentar insertar miles de registros de golpe en IndexedDB. Se implementó una lógica de inserción por lotes (Chunks de 50 registros) usando `bulkPut` para respetar los límites de transacción de memoria del navegador móvil.

## 2. Solución al Bug de Paginación de Payload CMS (Clones de MongoDB)
- **Problema Detectado:** La base de datos de MongoDB contenía 2369 productos, pero la aplicación móvil solo descargaba y guardaba 1195 productos únicos. El resto de las páginas enviadas por la API contenían productos repetidos.
- **Diagnóstico:** El ordenamiento por defecto en el backend (`args.sort = '-featured,title'`) no era matemáticamente único, causando que el paginador de MongoDB barajara los productos entre páginas.
- **Solución Aplicada:** Se forzó el parámetro de ordenamiento estrictamente por clave primaria desde la petición del frontend:
  ```typescript
  // Se agregó &sort=id a la URL de petición en useSync.ts
  apiClient.get(`/productos?...&sort=id&limit=100&page=${page}`);
  ```
  Esto garantizó una paginación perfecta de los 2369 productos sin duplicados.

## 3. Caché de Miniaturas Offline (Base64)
- **Implementación:** Se desarrolló una rutina secuencial en segundo plano que, tras descargar el catálogo en texto, descarga las imágenes de cada producto, las redimensiona y comprime (JPEG, 150x150 px, 60% calidad) a través de `HTMLCanvasElement`, y guarda la cadena resultante en un nuevo campo `local_image_base64` en IndexedDB.
- **Ventaja:** Permite que los vendedores ruteros visualicen las imágenes de los productos en pleno campo sin usar sus datos móviles, ocupando el mínimo espacio posible en el teléfono.
- **Bloqueo de Seguridad Detectado (CORS):** El motor de `Canvas` arrojó errores al intentar leer los píxeles debido a que las descargas interceptadas por el Service Worker fueron catalogadas como respuestas opacas (`opaque response`).
- **Próximo Paso Requerido en Backend:** Para habilitar la compresión en la app móvil, el servidor (Nginx o Payload CMS) **debe** enviar la cabecera `Access-Control-Allow-Origin: *` en los recursos de la ruta `/media/`. Sin CORS, es imposible procesar imágenes del lado del cliente.

## 4. Manejo de Conflictos de Clientes
- **E11000 Duplicate Key:** Al realizar el envío de clientes creados en modo offline, se presentaban bloqueos si un cliente con la misma cédula (DNI) ya existía en el servidor.
- **Polimorfismo Payload:** Se ajustó la estructura JSON del campo `createdBy` para enviar los datos con el formato relacional exigido por Payload CMS (`{ relationTo: 'vendedores', value: id }`).

## 5. Prevención de Límites de Cuota (Memoria Física)
- Se estandarizó que, si ocurren falsos positivos de `QuotaExceededError`, se deben a que el usuario acumuló caché histórica en el navegador móvil y agotó su límite físico asigado.
- Se instruye a los usuarios usar la opción "Borrar Datos de Sitio Web" en las configuraciones de Safari/Chrome para refrescar el límite y permitir que IndexedDB reconstruya el catálogo.
