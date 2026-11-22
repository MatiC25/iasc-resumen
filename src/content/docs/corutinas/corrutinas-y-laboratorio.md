---
title: Corrutinas y laboratorio
description: Guía de estudio para las clases 3 y 4 de IASC.
---

## Corrutinas

Pensá en dos consultas HTTP, A y B, que tardan un segundo cada una. Si esperás A antes de iniciar B, tardás unos dos segundos. Si iniciás ambas y el hilo puede ejecutar otra tarea durante cada espera, tardás cerca de un segundo. Las consultas se solapan, aunque el bucle ejecute un solo fragmento de Python por vez.

### Qué pasa cuando A llega a await

1. **A está ejecutando.** Un hilo del sistema operativo corre el bucle de eventos de Python. El bucle le dio el turno a la tarea A.
2. **A queda suspendida.** Si el resultado que espera todavía está pendiente, se guarda su punto de ejecución y sus variables locales. El bucle puede ejecutar B en el mismo hilo.
3. **A vuelve a estar lista.** Cuando el resultado está disponible, se agenda su reanudación. Cuando recibe un turno, sigue después del `await`.

Si A llama a `time.sleep` o hace cálculo pesado sin ceder el control, el hilo del bucle queda ocupado y B no recibe turno. En cambio, `await asyncio.sleep(...)` suspende A y permite que B avance.

| Concepto | Para qué sirve |
| --- | --- |
| **Corrutina** | Es el objeto que obtenés al llamar una función `async def`. Conserva dónde se suspendió. La llamada sola no ejecuta el cuerpo. |
| **Task** | Agenda una corrutina en el bucle. Con `create_task` podés iniciar A y luego esperar su resultado. |
| **Future** | Representa un resultado pendiente. Cuando se resuelve, el bucle puede agendar la continuación de la tarea que lo estaba esperando. |
| **Selector** | Permite al bucle enterarse de qué sockets están listos para intentar leer o escribir. |

El sistema operativo planifica **el hilo** y puede informar que un socket está listo. El bucle de eventos decide **qué tarea de Python** vuelve a ejecutar. El capítulo del libro muestra cómo un generador con `yield` y `send` puede servir para construir esta suspensión y reanudación a mano. [Corrutinas en el IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/corutinas.adoc)

### Tres formas de esperar

- **Resultado necesario ahora:** `resultado = await consulta()`. Si escribís dos líneas consecutivas así, la segunda consulta empieza cuando termina la primera.
- **Consultas independientes:** `await asyncio.gather(consulta_a(), consulta_b())`. Pueden solaparse y los resultados respetan el orden de entrada.
- **Trabajo que pertenece a una misma operación:** `asyncio.TaskGroup`. Al salir del bloque espera a las tareas. Si una falla con una excepción distinta de cancelación, cancela a las hermanas. Para devolver éxitos parciales, manejá los fallos esperados de cada consulta dentro de su tarea o evaluá `gather(..., return_exceptions=True)`.

Probá primero [la comparación secuencial y concurrente](/ejemplos/corrutinas/#comparar-espera-secuencial-y-concurrente). Después cambiá el sleep de la corrutina por uno bloqueante, predecí el tiempo y volvé a ejecutar.

## Laboratorio Cuando Viene

El servicio **Cuando Viene** consulta una parada y luego pide el detalle de sus líneas. **Monitoreo** consulta el estado de los servicios y lo publica por WebSocket. La práctica usa estas esperas de red para mostrar decisiones que aparecen en un servicio real. [Consigna del laboratorio](https://github.com/arquitecturas-concurrentes/iasc-python-cuando-viene)

| Qué pide la práctica | Qué concepto ensayás | Cómo comprobarlo |
| --- | --- | --- |
| Demorar algunos pedidos de Paradas | Espera no bloqueante con `await asyncio.sleep` | Mientras un pedido espera, `/health` puede responder. |
| Obtener la parada en `arrival_times` | Esperar una corrutina para obtener su resultado | La lógica recibe los datos de la parada en lugar de un objeto corrutina. |
| Consultar varias líneas y tolerar fallos | Ejecutar consultas independientes juntas y manejar errores por línea | Las respuestas conservan la correspondencia con la entrada. Si una línea falla, siguen saliendo las exitosas. |
| Monitorear tres servicios por WebSocket | Ejecutar consultas juntas, esperar entre rondas y cancelar cuando se cierra la conexión | Abrí dos pestañas. Cerrá una y comprobá que la otra siga recibiendo actualizaciones. |
| Registrar una métrica sin demorar la respuesta | Agendar trabajo en segundo plano, gestionar su vida útil y observar errores | La respuesta de la parada llega antes de que termine la métrica. |
| Limitar el número de consultas | Usar `asyncio.Semaphore(4)` para controlar el acceso al servicio | Aunque haya más de cuatro líneas, como máximo cuatro consultas están en curso al mismo tiempo. |

La consulta de la parada **debe terminar antes** de que se conozcan sus líneas. Una vez conocida la lista, las consultas por línea **pueden solaparse**. Separar dependencias de tareas independientes es la decisión central del laboratorio.

### Preguntas para el parcial

- **¿El sistema operativo decide qué corrutina retomar?** En el ejemplo de Python, el bucle agenda las tareas y el sistema operativo planifica el hilo del bucle.
- **¿Puede haber carreras en un único hilo?** Sí. Si A lee un contador y se suspende antes de escribir, B puede leer ese mismo valor y actualizarlo. Al retomar, A puede pisar el cambio de B.
- **¿Qué tarda menos, dos consultas de 1 y 2 segundos en secuencia o juntas?** En el modelo ideal, unos 3 segundos en secuencia y unos 2 al solapar la espera. El límite real depende del servicio y de cuánto trabajo común queda en el hilo.
- **¿Qué ganás al usar un semáforo?** Acotás la carga sobre el servicio. Las consultas adicionales esperan un permiso y pueden aumentar el tiempo total.

[Ejemplos locales de código](/ejemplos/corrutinas/) · [Ejercicios de Python de la cátedra](https://github.com/arquitecturas-concurrentes/iasc-python-coroutines)
