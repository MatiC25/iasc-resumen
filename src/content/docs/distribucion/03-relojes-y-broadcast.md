---
title: Sincronización de relojes y broadcast
description: Relojes físicos y lógicos, causalidad y garantías de entrega de mensajes.
sidebar:
  order: 3
---

## Sincronización de relojes físicos

Dos relojes físicos pueden tener distinta hora (**desfase**) y avanzar a ritmos ligeramente diferentes (**deriva**). Se pueden sincronizar periódicamente, pero la red introduce demora y esa demora puede ser distinta en cada sentido. Por eso dos timestamps muy cercanos de máquinas distintas pueden dar un orden engañoso.

**NTP** estima el desfase intercambiando cuatro timestamps. El cliente anota cuándo envía y recibe; el servidor anota cuándo recibe y responde. Si `t1`, `t2`, `t3` y `t4` corresponden a esos cuatro eventos, la demora estimada de ida y vuelta es `(t4 − t1) − (t3 − t2)` y el desfase estimado del servidor respecto del cliente es `((t2 − t1) + (t3 − t4)) / 2`. El cálculo de desfase supone demoras similares de ida y vuelta. NTP organiza sus fuentes en estratos y usa varias muestras para ajustar el reloj. [Especificación de NTP](https://www.rfc-editor.org/rfc/rfc5905)

| Necesidad | Reloj apropiado |
| --- | --- |
| Registrar a qué hora ocurrió algo | Reloj de pared sincronizado. Puede ajustarse y la precisión es finita. |
| Medir latencia o un timeout local | Reloj monotónico. Se restan lecturas del mismo reloj. |
| Identificar dependencias entre eventos | Relojes lógicos. Sus marcas representan orden, no segundos. |

## Causalidad

Decimos que **A sucedió antes que B** si ambos ocurrieron en el mismo proceso y A fue primero, si A fue el envío del mensaje que B recibió, o si existe una cadena de relaciones así entre ambos. Dos eventos sin una cadena causal en ninguno de los sentidos son **concurrentes**. Pueden haber ocurrido en momentos físicos distintos.

### Relojes de Lamport

Cada nodo empieza con un contador. Al ejecutar un evento local o enviar un mensaje lo incrementa. El mensaje lleva esa marca. Al recibirlo, el nodo calcula `max(reloj_local, marca_del_mensaje) + 1`. Si A ocurrió causalmente antes que B, la marca de A es menor. Tener una marca menor por sí sola no prueba causalidad. Agregar el ID del nodo como desempate da un orden total compatible con la causalidad, aunque todavía hace falta un mecanismo de entrega que aplique ese orden. [Artículo de Lamport](https://lamport.azurewebsites.net/pubs/time-clocks.pdf)

### Relojes vectoriales

Cada proceso mantiene un vector con un componente por participante. Incrementa el propio en cada evento local o envío. Al recibir, toma el máximo componente por componente entre su vector y el del mensaje, y luego incrementa su propio componente.

- `[1,0] < [2,1]` porque ningún componente baja y al menos uno sube. El primer evento precede causalmente al segundo.
- `[1,0]` y `[0,1]` son **incomparables**. Ninguno contiene el avance del otro.
- La representación crece con el número de participantes y hay que decidir cómo gestionar cambios de membresía.

![A envía un mensaje con Lamport 1 y vector 1,0. B realiza primero un evento local con Lamport 1 y vector 0,1. Al recibir el mensaje, B pasa a Lamport 2 y vector 1,2.](/diagramas/distribucion-relojes.png)

En el dibujo, los primeros eventos de A y B tienen la misma marca de Lamport. Sus vectores muestran que son concurrentes. La recepción en B sí depende de ambos.

## Broadcast

**Broadcast** difunde un mensaje a un grupo. Conviene separar **recibir** un paquete de **entregar** su contenido a la aplicación. Un nodo puede haber recibido un mensaje y guardarlo hasta que llegue otro del que depende.

Un broadcast confiable suele definir estas propiedades para un grupo conocido y bajo un modelo de fallas explícito:

- **Validez.** Si un emisor correcto difunde un mensaje, lo entrega.
- **Acuerdo.** Si un proceso correcto entrega un mensaje, todos los procesos correctos terminan entregándolo. La variante uniforme exige el acuerdo incluso si quien lo entregó después falla.
- **Integridad.** Cada mensaje se entrega como máximo una vez y solo si alguien lo difundió.

La confiabilidad responde **quién termina recibiendo**. El orden responde **en qué secuencia puede entregarlo**.

| Orden | Garantía | Ejemplo |
| --- | --- | --- |
| **FIFO por emisor** | Si A difunde X antes de Y, quien entrega ambos entrega X primero. | Dos cambios consecutivos enviados por A. |
| **Causal** | Si X pudo causar Y, quien entrega ambos entrega X primero, incluso si salieron de nodos distintos. | B responde a un mensaje que publicó A. El lector debe ver primero el original. |
| **Total** | Todos los que entregan X e Y los entregan en el mismo orden. | Réplicas que aplican los mismos comandos a una máquina de estados. |

El orden total por sí solo no exige causalidad ni FIFO. Un protocolo puede combinar ambas garantías. Si el grupo cambia, también debe definir si un nodo nuevo recupera el historial y desde qué punto empieza a entregar.

![C recibe una respuesta antes que su mensaje original. Con entrega causal, guarda la respuesta, entrega el original cuando llega y luego entrega la respuesta.](/diagramas/distribucion-broadcast.png)

### Algoritmos de broadcast

1. **Envío directo a todos.** El emisor manda una copia a cada participante. Si cae después de enviar a algunos, una parte del grupo puede quedarse sin el mensaje. Es el punto de partida de un broadcast de mejor esfuerzo.
2. **Eager reliable broadcast.** Al ver por primera vez un ID, cada nodo lo reenvía al grupo y evita procesar duplicados. En el modelo de caídas y con canales confiables entre nodos correctos, si uno de ellos ya recibió el mensaje, puede propagarlo al resto. Con todos reenviando, el costo por difusión puede crecer cuadráticamente con el grupo.
3. **Gossip.** Cada nodo reenvía a un subconjunto de pares. Reduce la carga por ronda y la información se dispersa gradualmente. El protocolo necesita una regla adicional si requiere una confirmación estricta de entrega, acuerdo o un orden específico.
4. **Entrega causal con dependencias.** El receptor compara las dependencias, por ejemplo con un vector de mensajes entregados. Si falta alguna, guarda el mensaje. En la imagen, C retiene la respuesta hasta poder entregar el original.
5. **Orden total con un secuenciador o un log acordado.** Se asigna una posición común a cada mensaje y se entregan posiciones consecutivas. Un secuenciador único requiere una estrategia de recuperación si cae. Un log replicado por consenso permite elegir un reemplazo y continuar desde las entradas comprometidas.

[Heartbeats y gossip, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/heartbeat_gossip.adoc) · [Repaso de Raft y consenso](/distribucion/02-comunicacion-y-consistencia/#raft)

### Para repasar

- **A tiene Lamport 4 y B tiene Lamport 7. ¿A causó B?** El número solo no alcanza. Puede haber una cadena causal o pueden ser concurrentes.
- **¿Podés medir un timeout restando timestamps de pared?** Un ajuste del reloj puede alterar el resultado. Usá un reloj monotónico local.
- **¿FIFO garantiza que se vea el original antes de una respuesta de otro emisor?** Para esa dependencia entre emisores necesitás orden causal o una garantía que lo incluya.
- **Si todos eligen el mismo orden, ¿todos reciben seguro?** Son propiedades distintas. El protocolo de entrega necesita una garantía de confiabilidad además del orden.

