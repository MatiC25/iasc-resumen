---
title: Comunicación, coordinación y consistencia
description: Fallas parciales, consenso con Raft, transacciones distribuidas, CAP y CRDTs.
sidebar:
  order: 2
---

## Comunicación en sistemas distribuidos

Un **pedido–respuesta**, como HTTP o RPC, permite que un cliente espere el resultado de un servicio. Con **mensajería asíncrona** puede publicar un pedido o evento y continuar. Un intermediario puede conservar mensajes, aplicar límites o reenviar cuando un consumidor vuelve. Las garantías dependen del protocolo y de cuándo se confirma el mensaje.

Un ACK de transporte, la confirmación de una cola y el éxito de una operación de negocio son tres cosas distintas. Si el servicio registra el pedido y se pierde la respuesta, el cliente puede volver a enviarlo. Usar un **ID de operación** y asociar ese ID al resultado en el servicio permite detectar el duplicado. Para que funcione ante una caída, el efecto y la deduplicación deben tener una frontera durable coherente.

## Coordinación

Coordinamos cuando varios nodos necesitan acordar quién toma una decisión, a quién pertenece un recurso o en qué orden se aplican comandos. Un nodo aislado carece de la información que está en el otro lado. Elegir cómo reaccionar ante ese caso es parte del diseño.

- **Dos generales.** Si cualquier mensaje o confirmación puede perderse, ningún intercambio finito garantiza que ambos sepan con certeza que el otro actuará. En sistemas reales se usan acuses, reintentos y reglas de recuperación con supuestos explícitos.
- **Fallos por caída y fallos bizantinos.** Un nodo que se detiene deja de responder. Un nodo bizantino puede enviar versiones incompatibles o comportarse de manera arbitraria. El algoritmo y el tamaño de los quórums dependen del modelo de fallas.

## Algoritmos de consenso

El **consenso** permite que los participantes acuerden un valor propuesto. Dos propiedades clave son **acuerdo** (los nodos correctos no deciden valores distintos) y **validez** (lo decidido cumple la regla de propuestas del protocolo). La **terminación** depende de condiciones de progreso, como que haya suficientes nodos accesibles y la red se estabilice. Para replicar un log, se acuerda una secuencia de comandos.

### Raft

1. **Elección.** Un seguidor que deja de oír al líder puede iniciar una elección como candidato. Cada nodo concede como máximo un voto por término. Hace falta una mayoría y las reglas de voto protegen las entradas ya comprometidas.
2. **Replicación.** El líder agrega el comando al log y envía entradas a los seguidores, que chequean la compatibilidad con su prefijo.
3. **Commit.** En el caso simple, una entrada del término actual queda comprometida cuando está almacenada en una mayoría. El líder aplica al estado las entradas comprometidas, informa a los seguidores qué pueden aplicar y devuelve al cliente el resultado cuando corresponde.

![En un clúster de cinco nodos aislado en grupos de tres y dos, solo el grupo de tres puede reunir una mayoría para comprometer nuevas entradas. El grupo de dos no alcanza el quórum.](/diagramas/distribucion-raft.png)

Si un grupo de tres queda separado de uno de dos, el de tres puede elegir un líder válido y avanzar cuando la red de ese grupo se estabiliza. El de dos puede seguir teniendo un nodo que se cree líder, pero no puede confirmar entradas nuevas sin mayoría. Raft presupone fallas por caída, no comportamiento bizantino. [Artículo de Raft](https://raft.github.io/raft.pdf)

### Consenso y commit distribuido

| Protocolo | Qué resuelve | Qué pasa ante una falla |
| --- | --- | --- |
| **2PC** | Decide si una transacción confirma en todos los participantes. Primero se les pide preparar y votar. El coordinador confirma si todos votaron sí. Si alguno rechaza, aborta. | Un participante preparado que perdió contacto con el coordinador puede quedar esperando la decisión. |
| **3PC** | Agrega una etapa de preconfirmación entre preparación y commit. | La etapa permite a los participantes distinguir estados y continuar bajo supuestos de sincronía y fallas que evitan particiones. En una red arbitrariamente particionada, no garantiza que todos progresen conservando la atomicidad. |
| **Raft** | Acuerda y replica entradas de un log entre réplicas. | Puede progresar con una mayoría comunicada y un líder estable. |

En 2PC, los participantes representan partes de una misma transacción. En Raft, los nodos replican el mismo log. Una base de datos puede usar consenso dentro de cada shard y un protocolo de commit para una transacción que cruza varios shards. [Consensus on Transaction Commit](https://lamport.azurewebsites.net/pubs/transaction.pdf)

## Consistencia eventual

Con **consistencia eventual**, si cesan las escrituras y las actualizaciones se propagan, las réplicas terminan convergiendo. Mientras tanto, una lectura puede devolver un valor viejo, incluso después de que el cliente haya visto otro más nuevo desde otra réplica. Garantías como *leer tus propias escrituras* requieren un mecanismo adicional.

| Modelo | Qué promete |
| --- | --- |
| **Linealizable** | Cada operación parece ocurrir en un instante entre su inicio y su fin, respetando el orden temporal observable. |
| **Causal** | Se respeta el orden de las operaciones relacionadas por una dependencia. Operaciones concurrentes pueden verse en orden distinto. |
| **Eventual** | Tras propagar las actualizaciones y dejar de escribir, las réplicas convergen. |

**CAP** se vuelve concreto durante una **partición de red**. Si dos lados no pueden hablar y ambos aceptan lecturas y escrituras sobre el mismo dato, ambos pueden responder pero no pueden garantizar una vista linealizable. Rechazar o demorar operaciones en uno de los lados permite preservar esa garantía bajo el protocolo correspondiente. La decisión puede variar por operación: reservar la última unidad y cargar un «me gusta» tienen consecuencias distintas. [CAP, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/cap.adoc)

## CRDTs

Un **CRDT** es un tipo de dato replicado diseñado para que sus réplicas converjan según reglas definidas. En un CRDT basado en estado, la operación de fusión suele ser **conmutativa**, **asociativa** e **idempotente**. Así puede recibir estados en órdenes distintos o más de una vez. Los CRDTs basados en operaciones tienen requisitos sobre cómo se entregan esas operaciones.

**Ejemplo de G-Counter.** Cada réplica incrementa solo su parte del vector. A incrementa dos veces y queda `[2, 0]`. B incrementa tres y queda `[0, 3]`. Al combinar toman el máximo componente por componente y llegan a `[2, 3]`. El valor es la suma, **5**. Si reciben otra vez el mismo estado remoto, el máximo sigue siendo el mismo.

![A registra dos incrementos y B registra tres. Cada réplica combina tomando el máximo de cada componente. Ambas convergen en el vector 2, 3, cuyo total es 5.](/diagramas/distribucion-crdt.png)

Un G-Counter solo crece. Si el dominio necesita borrar elementos, descontar o reconciliar cambios de texto, se necesita un tipo con reglas adecuadas. Convergencia tampoco garantiza invariantes como «no vender dos veces el último asiento». Ese requisito puede demandar coordinación o permisos preasignados que impidan exceder el total. [Informe sobre CRDTs de Shapiro y colaboradores](https://inria.hal.science/inria-00555588)

### Para repasar

- **¿2PC puede confirmar si un participante vota no?** No. El commit requiere el sí de todos.
- **¿Una minoría de Raft puede confirmar una entrada nueva?** No, necesita una mayoría.
- **¿Un CRDT llega al mismo resultado con mensajes duplicados?** En el G-Counter de estado, sí. La fusión por máximo es idempotente.

[Siguiente: sincronización de relojes y broadcast](/distribucion/03-relojes-y-broadcast/)

