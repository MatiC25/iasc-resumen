---
title: Distribución en Elixir
description: Clase 10. Nodos, mensajes remotos, libcluster, Horde y recuperación.
sidebar:
  order: 4
---

## Clase 10 · 15/10/2026

## Distribución en la BEAM

Un **nodo** es una instancia de la BEAM preparada para comunicarse con otras. Dos nodos pueden correr en una misma computadora o en computadoras distintas. Cada uno tiene sus procesos, supervisores, memoria, nombres locales y tablas ETS.

## Mensajes entre procesos de distintos nodos

### Conectar y enviar mensajes

En una práctica local, iniciá dos consolas con nombres distintos y la misma cookie de prueba. Usá un entorno aislado.

```sh
iex --sname a --cookie iasc_demo
iex --sname b --cookie iasc_demo
```

En B registrá la propia consola como destino de prueba.

```elixir
Process.register(self(), :buzon_demo)
node()
```

En A, reemplazá `b@mi_host` por el valor exacto que imprimió B.

```elixir
destino = :"b@mi_host"
Node.connect(destino)
Node.list()
send({:buzon_demo, destino}, {:hola, node()})
```

En B, `flush()` muestra el mensaje. También podés enviar a un PID remoto si ya lo conocés. Para un GenServer registrado con un nombre local en B, la forma síncrona sería `GenServer.call({:mi_servidor, destino}, :leer)`.

El nombre identifica al nodo. La cookie autentica la conexión, mientras que el transporte requiere configuración adicional si se necesita cifrado. En la configuración clásica, **EPMD** permite resolver el puerto de distribución asociado al nombre del nodo. `Node.list()` indica qué nodos están conectados. `:net_kernel.monitor_nodes(true)` permite recibir avisos de conexión o desconexión. Un aviso de desconexión indica pérdida de comunicación y por sí solo no distingue caída de partición de red.

## Comparación de libcluster y Horde

| Pregunta | Herramienta | Qué resuelve |
| --- | --- | --- |
| ¿Cómo se descubren y se conectan los nodos? | **libcluster** | Ejecuta estrategias de descubrimiento y conexión. Puede partir de una lista de nodos conocidos para el laboratorio o usar descubrimiento del entorno. |
| ¿Dónde está el proceso identificado por una clave lógica? | **Horde.Registry** | Distribuye el registro entre sus miembros. Un cliente puede usar la clave en lugar de guardar un PID efímero. |
| ¿En qué nodo se inicia o recrea un trabajador? | **Horde.DynamicSupervisor** | Distribuye procesos entre miembros y puede arrancar un reemplazo en otro nodo cuando se pierde un miembro, según la estrategia y las condiciones del clúster. |
| ¿De dónde vuelve el estado del trabajador? | **Almacenamiento o replicación de la aplicación** | Permite reconstruir el estado que el negocio necesita conservar. |

### libcluster

Una topología de libcluster combina una estrategia de descubrimiento con su configuración. En el laboratorio podés empezar con nombres conocidos y usar `Node.list()` para verificar qué conexiones se establecieron. Una vez conectados, los nodos pueden enviarse mensajes con los mecanismos de la BEAM.

### Horde

Conectar nodos, configurar miembros de Horde y elegir la ubicación de un proceso son pasos distintos. El registro y la supervisión distribuidos se apoyan en **CRDTs** para converger después de intercambiar cambios. En una partición, la vista de cada lado puede diferir temporalmente. El nombre lógico no equivale a un lock global. Según la estrategia y la situación, dos lados pueden ejecutar instancias del mismo trabajador y los registros pueden resolver conflictos cuando se reúnen.

### Seguimiento de un mensaje y una caída

B envía un incremento a C, que vive en A. Si A se cae y se inicia un reemplazo en B, este recibe un PID nuevo. Como el contador de este ejemplo vivía solo en memoria, el reemplazo vuelve a cero.

![A y B se conectan. B envía un incremento a C en A. Cuando A queda fuera de servicio, un reemplazo arranca en B con otro PID y estado inicial 0.](/diagramas/elixir-distribucion-recuperacion.png)

## Qué cambia al cruzar la red

- **Entrega y respuesta.** `send` no confirma procesamiento. Si un `call` remoto falla o vence el timeout, el servidor podría haber completado la operación antes de que se perdiera la respuesta.
- **Reintentos.** En operaciones que producen efectos, usá una clave de operación o alguna regla de idempotencia si un reintento podría repetirlos.
- **Ubicación y datos.** Particionar distribuye qué claves administra cada nodo. Replicar mantiene copias de esos datos. Supervisar restaura procesos. Un PID nuevo y un nombre estable permiten volver a enviar pedidos, pero el valor anterior solo reaparece si hay una fuente desde la que reconstruirlo.

[Distribución en Elixir, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/distribucion_elixir.adoc) · [libcluster](https://libcluster.hexdocs.pm/readme.html) · [Horde](https://horde.hexdocs.pm/readme.html) · [Laboratorio de distribución](/elixir/05-laboratorio-distribucion/)
