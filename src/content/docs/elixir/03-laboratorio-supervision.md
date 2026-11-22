---
title: Laboratorio de Elixir · Supervisión
description: Clase 9. Procesar descargas concurrentes y observar fallas y reinicios.
sidebar:
  order: 3
---

En **Buscador de Imágenes**, la aplicación lee un archivo de enlaces y descarga las imágenes. La versión inicial hace las descargas de forma bloqueante y secuencial. Un error de descarga puede interrumpir el trabajo completo. El objetivo es separar trabajos, aislar fallas y decidir qué parte del árbol debe recuperarse cuando falla un trabajador. [Consigna de Buscador de Imágenes](https://github.com/arquitecturas-concurrentes/iasc-elixir-image-finder)

## Un diseño para recorrer la práctica

| Capa | Responsabilidad |
| --- | --- |
| Supervisor raíz | Inicia los coordinadores y supervisores que necesita toda la aplicación. |
| Lector por archivo | Lee y entrega enlaces a medida que los encuentra. Un archivo grande puede procesarse como un flujo. |
| Coordinador | Controla la cantidad de descargas en curso, conserva el progreso y decide qué reintentar. |
| Trabajador de descarga | Recibe una URL, descarga una imagen y devuelve éxito o error. Su caída no debería frenar las descargas independientes. |

Una opción es usar `Task.Supervisor` para descargas que terminan cuando producen un resultado. `Task.Supervisor.async_stream_nolink` permite acotar la concurrencia y obtener el resultado de tareas que terminan con error sin vincular su salida al consumidor. Si necesitás un proceso duradero por dominio o archivo, podés iniciarlo bajo `DynamicSupervisor` y resolverlo por una clave con Registry.

## Orden para estudiar y probar

1. **Partí del caso chico.** Procesá tres enlaces y anotá cuándo empieza y termina cada descarga.
2. **Solapá las descargas.** Acotá la cantidad en curso y comprobá que haya períodos donde más de una descarga está activa. Probá también dos archivos a la vez.
3. **Forzá un fallo.** Usá una URL inválida o una respuesta de error controlada. Comprobá que las otras descargas sigan y que el fallo tenga un resultado visible.
4. **Separá reintentos de supervisión.** Para la segunda parte, registrá el número de reintentos por enlace. Si una descarga se reintenta hasta tres veces, verificá el límite incluso cuando vuelve a fallar. El supervisor regula reinicios de procesos. El coordinador regula intentos de descarga.
5. **Cuidá la carga por dominio.** Permití una descarga en curso por dominio y limitá el total. Probá enlaces del mismo dominio mezclados con enlaces de otro. Si un dominio rebasa el umbral de errores de la consigna, registrá cuándo y por qué lo excluís.

### Qué mirar cuando todo parece funcionar

- En IEx, compará los PID devueltos por `Supervisor.which_children/1` antes y después de forzar un fallo. El trabajo que debía sobrevivir conserva sus procesos. Un proceso reiniciado tiene PID nuevo.
- Desde Observer, si está disponible, mirá el árbol y la longitud de los buzones. Si el coordinador acumula mensajes, verificá qué tareas realiza en sus callbacks.
- Si el proceso falla después de crear el archivo pero antes de confirmar el resultado, un reintento puede volver a escribirlo. Pensá qué nombre o regla usarías para que la repetición sea segura.

[Diagrama de estrategias de supervisión](/elixir/02-supervision/#la-misma-falla-con-dos-estrategias) · [Ejemplos locales de Elixir y OTP](/ejemplos/elixir-otp/)
