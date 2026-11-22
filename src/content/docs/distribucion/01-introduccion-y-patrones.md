---
title: Introducción y patrones de distribución
description: Repaso de concurrencia, particionamiento, sharding, escalabilidad y healthchecks.
sidebar:
  order: 1
---

### Repaso de concurrencia

El ejercicio plantea un servidor que atiende varios pedidos y corre en una máquina de **cuatro núcleos**. Para cada modelo, hay que decidir cuántas instancias de `servidor.sh` hacen falta para poder usar los cuatro núcleos a la vez y si una sola instancia puede seguir atendiendo mientras un pedido usa un **driver bloqueante**.

La tabla cuenta **procesos del sistema operativo que ejecutan el servidor**. Si se usa un balanceador como proceso separado, se cuenta aparte. Para el número mínimo, suponemos que hay suficiente trabajo de CPU independiente y que cada proceso de las primeras tres variantes y de la variante de corrutinas ejecuta código de aplicación en **un solo hilo nativo**.

| Modelo | Procesos servidor para 4 núcleos | Plataforma de ejemplo | ¿Una sola instancia sigue atendiendo ante I/O bloqueante? |
| --- | --- | --- | --- |
| **Sin concurrencia** | 4 | Python o Ruby con un bucle secuencial | No. Ese servidor atiende un pedido por vez. Otras instancias pueden seguir. |
| **Orientado a eventos** | 4 | Node.js con un event loop por instancia y sin workers de CPU | Si el driver bloquea el hilo del bucle, no. Si la llamada se delega a otro hilo y se espera de forma asíncrona, el bucle puede seguir. |
| **Green threads** | 4 en el esquema N:1 | Ruby MRI histórico, con green threads sobre un hilo nativo | No si la llamada bloquea al único hilo nativo del que dependen. Una espera integrada al planificador puede ceder el turno. |
| **Hilos del sistema operativo** | 1 con al menos 4 hilos capaces de ejecutar código en paralelo | JRuby sobre la JVM | Sí, si el driver bloquea solo al hilo que lo invocó y queda otro hilo disponible. |
| **Corrutinas** | 4 con un hilo de ejecución por proceso | Python con un bucle de asyncio por instancia | Si el driver se llama en el hilo del bucle, no. Con I/O asíncrona o con la llamada delegada a un pool, otras corrutinas pueden avanzar. |
| **Paso de mensajes entre actores** | 1 con suficientes actores listos y planificadores de la VM | Elixir sobre la BEAM | Otros actores pueden seguir si hay planificadores disponibles. Una llamada nativa bloqueante necesita gestionarse sin ocupar los planificadores normales durante mucho tiempo. |

La distinción es **qué bloquea el driver**. Con cuatro procesos, tres pueden seguir si el cuarto queda bloqueado, pero eso describe al conjunto. La última columna pregunta por la capacidad de **un solo proceso servidor**. Contar un balanceador como cuarto proceso tampoco aporta un cuarto trabajador que atienda el código del servidor.

[Modelos tradicionales de concurrencia](/introduccion/04-modelos-tradicionales/) · [Green threads, hilos y procesos](/introduccion/06-green-threads-vs-os-threads/)

<details>
<summary>Ver la foto del ejercicio</summary>
<div style="position: relative; aspect-ratio: 16 / 9; overflow: hidden;">
  <img src="/diagramas/ejercicio-arquitectura-cuatro-nucleos.png" alt="Foto girada del ejercicio de arquitectura cliente-servidor y su cuadro de modelos de concurrencia." width="900" height="1600" loading="lazy" style="position: absolute; left: 50%; top: 50%; width: 56.25%; max-width: none; height: auto; margin: 0; transform: translate(-50%, -50%) rotate(-90deg);" />
</div>
</details>

## Conceptos de sistemas distribuidos

Un sistema distribuido está formado por **nodos autónomos que se comunican por red** para ofrecer un servicio. Cada nodo tiene su memoria, su ejecución y su reloj. Una aplicación de pedidos puede tener varios nodos que reciban solicitudes y otros que almacenen datos. Para el cliente, todos forman parte del mismo servicio.

Lo que cambia respecto de una sola máquina es la **falla parcial**. Un nodo puede seguir ejecutándose mientras otro se cae o queda aislado. Cuando A deja de recibir respuestas de B, A sabe que no puede comunicarse con B en ese momento. Por sí solo, el timeout no distingue entre una caída, un enlace roto y una respuesta muy lenta. También aparecen costos de red, colas y coordinación. [Distribución, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/distribucion.adoc) · [Mitos de la distribución, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/mitos_distribucion.adoc)

## Patrones de distribución

**Particionar** es dividir el conjunto de datos o trabajo en subconjuntos. **Sharding** suele referirse al particionamiento horizontal de datos repartido entre nodos. Cada shard contiene un subconjunto de registros con el mismo esquema. Una regla de ruteo decide a qué shard va cada clave.

![Un router aplica una regla de partición a cada clave. Envía los pedidos pares al shard A y los impares al shard B. Cada shard guarda un subconjunto de pedidos.](/diagramas/distribucion-sharding.png)

| Regla | Ejemplo | Qué mirar |
| --- | --- | --- |
| **Rango** | Pedidos 1–1000 a A y 1001–2000 a B. | Facilita consultar rangos. Si casi todas las escrituras caen en el rango más reciente, ese shard se vuelve un cuello de botella. |
| **Hash** | Aplicar `hash(id) % N` para elegir entre N shards. | Distribuye muchas claves. Una clave con mucho tráfico sigue concentrada. Cambiar N puede mover muchas claves. |
| **Directorio** | Una tabla indica el shard dueño de cada clave o grupo. | Permite mover grupos de forma explícita. Hay que mantener el directorio disponible y actualizado. |

Al agregar nodos, **rebalancear** implica mover datos y actualizar el ruteo sin perder escrituras. El hashing consistente o el uso de particiones virtuales permiten reducir el conjunto que se mueve frente a un cambio de membresía. Una consulta por clave suele ir a un shard. Un reporte que cruza todos debe consultar varios y combinar resultados.

**Replicar** mantiene copias de los mismos datos. Podés particionar los pedidos entre A y B y, además, tener réplicas independientes de cada shard. Con replicación asíncrona, una réplica puede responder con un valor anterior y una escritura confirmada solo en el líder puede perderse si este falla antes de propagarla. Si el líder espera confirmaciones, ese costo pasa al camino de escritura.

## Escalabilidad

| Forma | Qué cambia | Ejemplo |
| --- | --- | --- |
| **Vertical** | Más CPU, memoria o disco por instancia. | Subir la capacidad de una base de datos. |
| **Horizontal · eje X** | Más instancias equivalentes detrás de un balanceador. | Replicar la API. Si cada instancia tiene sesiones en memoria local, hay que definir cómo se mantiene la sesión entre pedidos. |
| **Horizontal · eje Y** | Separar funciones o dominios que escalan de forma independiente. | Dar a Pedidos y Catálogo sus propios servicios. |
| **Horizontal · eje Z** | Dividir los datos o la carga por una clave. | Repartir pedidos entre shards. |

Podés combinar los ejes. Antes de sumar instancias, medí **throughput**, latencia y saturación. Si todas las copias de la API dependen de la misma base saturada, agregar copias puede aumentar la carga sobre esa base. [Cubo de escalabilidad, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/distribucion.adoc)

## Healthcheck, heartbeat y gossip

| Mecanismo | Quién inicia | Para qué sirve |
| --- | --- | --- |
| **Healthcheck** | Un balanceador u orquestador consulta algo como `/health`. | Decidir si el proceso sigue vivo o si la instancia está lista para recibir tráfico. |
| **Heartbeat** | Un nodo envía señales periódicas. | Si dejan de llegar durante cierto intervalo, los demás pueden sospechar que está caído o incomunicado. |
| **Gossip** | Los nodos eligen pares y les transmiten información. | Propagar estado o membresía gradualmente sin pedir que todos hablen con todos en cada ronda. |

Separá **liveness** de **readiness**. Una instancia puede estar viva y no estar lista para recibir pedidos porque todavía se está inicializando. Si una dependencia compartida tiene una caída breve, hacer que esa caída dispare reinicios de todas las instancias puede empeorar la recuperación. El intervalo, el timeout y el número de fallas consecutivas determinan cuánto demora la detección y cuántos falsos positivos aparecen. [Heartbeats y gossip, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/heartbeat_gossip.adoc)

### Para repasar

- **¿Dos shards son dos copias?** Cada shard contiene un subconjunto distinto. Las copias se logran con replicación.
- **¿Un healthcheck exitoso prueba que todos los pedidos van a funcionar?** Prueba la condición que se chequeó en ese momento.
- **¿Qué pasa si una sola clave concentra casi todo el tráfico?** Puede saturar el shard dueño de esa clave aunque la cantidad de registros esté bien repartida.

[Siguiente: comunicación, coordinación y consistencia](/distribucion/02-comunicacion-y-consistencia/)
