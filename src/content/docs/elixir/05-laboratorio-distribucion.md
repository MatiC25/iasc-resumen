---
title: Laboratorio de Elixir · Distribución
description: Clase 11. Acortar URLs, interconectar nodos, particionar claves y recuperar estado.
sidebar:
  order: 5
---

**Url Shortener** genera URLs cortas. La consigna trabaja con procesos que conservan la relación entre una URL original y sus versiones acortadas. La primera parte pide sobrevivir a la caída de un actor, conectar nodos con libcluster y repartir el estado entre ellos. La segunda parte propone replicar datos y recuperar el estado tras la caída de un nodo. [Consigna de Url Shortener](https://github.com/arquitecturas-concurrentes/iasc-elixir-url-shortener)

## Parte 1 · De un actor a varios nodos

1. **Observá el caso local.** Creá dos enlaces cortos para una URL y confirmá que ambos sean consultables. Identificá quién posee la lista y qué clave usa el cliente para recuperarla.
2. **Derribá un trabajador.** Compará el PID anterior y el nuevo, y consultá otra vez la lista. Si desapareció, identificá dónde habría que guardarla y cómo se reconstruiría el nuevo proceso. Una tabla ETS de un dueño que sobrevive puede ayudar ante una caída de trabajador dentro del mismo nodo. Si cae también el nodo, hace falta otra fuente de recuperación.
3. **Conectá dos nodos.** Confirmá la conexión con `Node.list([:this, :visible])` desde ambos. Para estudiar cada capa, podés comparar la [conexión manual](/elixir/04-distribucion/#conectar-y-enviar-mensajes) con el repositorio de ejemplo de libcluster.
4. **Repartí claves.** Creá enlaces para varias URLs y registrá el nodo de los PID con `node(pid)`. Comprobá que se distribuyan y que las consultas lleguen al dueño incluso desde otro nodo. La consigna permite usar Horde o implementar la ubicación explícitamente.

## Parte 2 · Replicación y caída de un nodo

La extensión propone un esquema **primario/secundario**. Identificá qué nodo acepta escrituras para una clave, qué copias se actualizan y cuándo se confirma una escritura al cliente. Si un nodo vuelve con una copia vieja, necesitás una regla para sincronizarlo antes de usarla como si fuera actual.

| Prueba | Qué mirar | Qué demuestra |
| --- | --- | --- |
| Termina un actor, su nodo sigue vivo | El PID cambia y los enlaces anteriores siguen consultables. | Reinicio y recuperación de estado dentro del nodo. |
| Dos nodos conectados reciben claves nuevas | Las claves quedan a cargo de nodos distintos y se resuelven desde ambos. | Ubicación y partición de claves. |
| Cae el nodo dueño después de guardar un enlace | Intentá leer desde el sobreviviente y comprobá si recupera la última escritura que esperabas conservar. | Alcance de la persistencia o replicación implementada. |
| Vuelve el nodo caído | Consultá antes y después de sincronizarlo. | Qué regla decide qué copia recuperar, y cuándo ya se puede usar. |

Usá nombres lógicos para recuperar la ubicación después de una caída. Los PID guardados sirven para observar el cambio, pero apuntan a la instancia anterior. Si probás una pérdida de red en lugar de detener la VM, ambos lados pueden seguir vivos. En ese caso, también hay que resolver qué pasa con las solicitudes aceptadas en cada lado.

## Para repasar antes del parcial

- Si dos nodos se ven, ¿por qué pueden tener un GenServer con el mismo nombre local? Porque cada registro local tiene su propio alcance.
- Si Horde arranca un reemplazo, ¿de dónde viene su estado? De su inicialización o del almacenamiento que la aplicación consulta durante la recuperación.
- Si un pedido vence y reenviás la misma operación, ¿qué debés comprobar? Si el primer intento pudo producir el efecto y si la operación tolera ejecutarse otra vez.

[Ejemplo de libcluster de la cátedra](https://github.com/arquitecturas-concurrentes/iasc-actors-libcluster-example) · [Ejemplo de Horde de la cátedra](https://github.com/arquitecturas-concurrentes/iasc-elixir-horde-minimal-example)
