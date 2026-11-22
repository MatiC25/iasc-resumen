---
title: Green Threads vs. OS Threads vs. OS Processes
description: Quién planifica cada unidad de ejecución, qué memoria comparte y cuándo hay paralelismo.
sidebar:
  order: 6
---

Un **proceso** contiene recursos y un espacio de direcciones. Dentro de él hay uno o más **hilos nativos** que el sistema operativo puede planificar. Un runtime puede crear otra capa encima y repartir esos hilos nativos entre varias unidades de ejecución más livianas.

## Green threads

Los **green threads** se planifican en el runtime. El sistema operativo planifica los hilos nativos sobre los que corren. En el esquema **N:1** del dibujo, tres green threads se turnan en un solo hilo nativo. Pueden progresar concurrentemente, pero solo uno ejecuta código en cada instante. En un esquema **M:N**, el runtime reparte los green threads entre varios hilos nativos y puede haber paralelismo.

![Tres green threads llegan al planificador del runtime, que reparte los turnos sobre un único hilo nativo.](/diagramas/green-threads.png)

Si una operación compatible suspende solo al green thread, el runtime puede darle el turno a otro. Si la llamada bloquea el único hilo nativo, todos los green threads que dependen de él tienen que esperar. Los fibers de Ruby ilustran cómo se puede suspender una unidad liviana y reanudarla más tarde. Las reglas de planificación dependen del runtime. [Fibers en Ruby, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/fibers.adoc)

## OS threads

Los **hilos nativos** los planifica el sistema operativo. Cada hilo tiene su propia pila y su contexto de ejecución, pero los hilos de un mismo proceso comparten el espacio de direcciones. Pueden acceder a los mismos objetos, así que las actualizaciones concurrentes necesitan coordinación.

![Dos hilos nativos comparten la memoria del proceso A. El sistema operativo puede ejecutar cada hilo en un núcleo diferente.](/diagramas/os-threads.png)

Si un hilo espera una lectura bloqueante, otro hilo listo puede avanzar. Si hay varios núcleos disponibles, el kernel puede ejecutar distintos hilos al mismo tiempo, siempre que el programa y su runtime permitan ese paralelismo.

### Ejemplo histórico en Ruby

![Ruby 1.8.7 agrupa varios hilos de Ruby en un solo hilo nativo. Ruby 2.0.0 los asigna a varios hilos nativos, con un bloqueo global para ejecutar código Ruby. JRuby permite que varios hilos ejecuten código Ruby en paralelo.](/diagramas/ruby-green-vs-native-threads.png)

El dibujo muestra tres casos para un mismo proceso. **Ruby 1.8.7 (MRI)** usa green threads sobre un hilo nativo. **Ruby 2.0.0 (MRI)** usa hilos nativos, pero el bloqueo global limita la ejecución simultánea de código Ruby. **JRuby** puede ejecutar código Ruby de varios hilos en paralelo si hay núcleos disponibles. Los núcleos en verde ilustran el paralelismo de ese código en cada caso.

## OS processes

Cada **proceso del sistema operativo** tiene su propio espacio de direcciones. Para intercambiar datos con otro proceso usa mecanismos de comunicación entre procesos (**IPC**), como sockets o pipes. También se puede configurar una región de memoria compartida de forma explícita.

![Los procesos A y B tienen cada uno memoria propia y un hilo nativo. A envía datos a B por un canal IPC, como un socket.](/diagramas/os-processes.png)

El aislamiento ayuda a contener fallas y separar recursos. Por ejemplo, un servidor puede repartir solicitudes entre procesos trabajadores y reiniciar uno si falla. El kernel planifica los hilos de cada proceso y puede ejecutarlos en distintos núcleos.

## Comparación

| Unidad | Quién le da turno | Qué memoria comparte | Ejemplo |
| --- | --- | --- | --- |
| **Green thread** | El runtime, sobre hilos nativos | El espacio de direcciones de su proceso | Muchas tareas que esperan I/O compatible con el runtime |
| **OS thread** | El kernel | El espacio de direcciones con los demás hilos del proceso | Un pool de hilos que comparte una cola de trabajo |
| **OS process** | El kernel planifica sus hilos | Tiene su propio espacio de direcciones | Trabajadores aislados que se comunican por mensajes |

Para elegir, preguntate qué querés conseguir: **reutilizar hilos durante la espera**, **compartir datos dentro de un proceso** o **aislar a los trabajadores**. Los tres enfoques pueden combinarse. Un servidor puede tener varios procesos, cada proceso varios hilos nativos y cada hilo ejecutar unidades livianas gestionadas por el runtime.

[Concurrencia y paralelismo, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/concurrencia_paralelismo.adoc)

## Cuadro comparativo de MRI y JRuby

![Comparación de cargas de I/O y CPU en MRI y JRuby para distintas cantidades de hilos por worker y de procesos worker.](/diagramas/mri-jruby-hilos-y-workers.png)

En el cuadro, **t** es la cantidad de hilos por worker y **w** es la cantidad de procesos worker. Las filas con varios workers de JRuby figuran como «No aplica» para el esquema basado en `fork`. Se pueden iniciar procesos de JRuby de forma independiente.
