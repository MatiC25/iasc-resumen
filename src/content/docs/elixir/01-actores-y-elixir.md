---
title: "Actores: fundamentos y manejo de errores"
description: Clase 7. Modelo de actores, mensajes, estado, fallas y Agents en Elixir.
sidebar:
  order: 1
---

## Clase 7 · 24/09/2026

**Elixir** es un lenguaje funcional que corre sobre la **BEAM**, la máquina virtual de Erlang. Usa datos inmutables y pattern matching. **OTP** reúne bibliotecas y convenciones para escribir procesos con estado, organizar aplicaciones y recuperarse de fallas.

Durante esta clase, **A** y **B** quieren incrementar un contador que vive en **C** y vale 10. La pregunta es quién cambia ese número, cuándo se ve el cambio y qué pasa si C falla.

## Fundamentos

Un actor tiene identidad, su propio flujo de ejecución y un comportamiento para atender mensajes. Al procesar uno puede **enviar mensajes**, **crear otros actores** y **decidir cómo atender el próximo mensaje**, por ejemplo a partir del estado que acaba de calcular.

En Elixir, un actor suele implementarse como un proceso de la BEAM. `spawn/1` devuelve un **PID** que identifica una instancia durante su vida. La BEAM planifica muchos procesos livianos sobre hilos nativos. Otros procesos pueden avanzar mientras C espera. Si su función termina, termina el proceso. Si sigue esperando en `receive`, puede continuar vivo con el buzón vacío.

## Paso de mensajes

El emisor usa un **PID** o un destino identificable y envía un término. El protocolo define los términos que entiende C: `:incrementar` puede modificar el contador y `{:leer, cliente, ref}` puede consultar su valor.

1. A crea una referencia única con `make_ref()` y envía `{:leer, self(), ref}`.
2. C reconoce el pedido, toma su estado y envía `{:valor, ref, n}` al PID de A.
3. A espera un mensaje que coincida con `{:valor, ^ref, n}`. La referencia permite distinguirlo de otras respuestas pendientes.

La respuesta es un segundo mensaje, con su propio recorrido. Podés seguir el caso en el [ejemplo local de mensajes](/ejemplos/elixir-otp/#mensajes-y-estado-interno).

## Asincronía

`send/2` devuelve el término enviado. Esa devolución **no confirma** que el destinatario haya atendido el mensaje ni cambiado su estado. Si el emisor necesita una respuesta, puede esperarla con `receive` y limitar la espera con `after`. Mientras ese proceso espera, otros pueden ejecutar.

En OTP, `GenServer.cast/2` envía un pedido asíncrono y el cliente sigue. `GenServer.call/3` espera una respuesta. Si vence el timeout, la llamada produce una salida en el cliente. El servidor puede haber ejecutado el pedido o ejecutarlo después. Si una operación tiene efectos, repetirla requiere pensar cómo detectar duplicados.

## Mailbox

Cada proceso tiene su **buzón**. Entre un mismo par emisor–receptor se conserva el orden de las señales que se entregan. Entre A y B, que son emisores distintos, cualquiera puede llegar primero.

`receive` busca el primer mensaje que encaja con sus patrones. Si el buzón contiene `[:aviso, {:valor, ref, 10}]` y se espera `{:valor, ^ref, n}`, el proceso toma el segundo y deja `:aviso` en el buzón. Si no hay coincidencias, se suspende hasta recibir un mensaje que coincida o vencer el `after`. El timeout no vacía el buzón.

![A y B envían incrementos al buzón de C. C procesa el de A y pasa de 10 a 11, luego el de B y llega a 12. Se muestra un orden posible.](/diagramas/elixir-buzon-y-estado.png)

## Estado interno

El actor conserva su estado al pasarlo a su siguiente iteración. Si C ejecutaba `loop(10)` y recibe `:incrementar`, calcula otro valor y sigue en `loop(11)`. En un GenServer, el callback devuelve el nuevo estado. Los clientes consultan o piden cambios a través del protocolo de C.

Cuando C termina, su estado en memoria se pierde. Si un supervisor lo reinicia, la instancia nueva arranca con otro PID y recupera el estado solo si su inicialización tiene una fuente desde la cual reconstruirlo.

## Actores vs. objetos

| Aspecto | Actor | Objeto típico |
| --- | --- | --- |
| Entrada | Recibe un mensaje que puede quedar en el buzón. | Recibe una llamada directa a un método. |
| Ejecución | El comportamiento corre en el flujo del actor. | El método normalmente corre en el hilo del llamador. |
| Estado | El actor decide cuándo y cómo cambia. | Varios hilos pueden invocar el mismo objeto si comparten la referencia. |
| Falla | La muerte del actor puede observarse mediante mensajes o señales. | Una excepción suele propagarse por la pila de llamadas. |

Ambos pueden encapsular estado. Para distinguirlos, fijate **quién ejecuta el comportamiento** y **si la solicitud puede quedar pendiente en un buzón**.

## Cuellos de botella

Un GenServer ejecuta un callback por vez. Si recibe 100 pedidos por segundo y puede procesar 60, su buzón acumula unos 40 pedidos por segundo mientras se mantenga esa diferencia. Un callback largo, por ejemplo una consulta externa lenta, también retrasa los pedidos que quedaron detrás.

Podés inspeccionar `Process.info(pid, :message_queue_len)` en el laboratorio. Si el trabajo pesado es independiente, delegalo a un pool acotado. Si las claves son independientes, distribuí las claves entre varios actores. Mantené corto el tramo que modifica estado y poné un límite a los pedidos admitidos para que el buzón no crezca indefinidamente.

## Condiciones de carrera

Los mensajes se procesan de a uno, pero **un protocolo de varios mensajes puede intercalarse**. Si A y B consultan el contador antes de escribir, ambos pueden leer 10, sumar 1 y pedir que C guarde 11. El último valor queda en 11 aunque los dos clientes hayan completado su operación.

![En la secuencia leer y escribir, A y B leen 10 y cada uno escribe 11. En la secuencia de incrementos, C procesa dos operaciones completas y termina en 12.](/diagramas/elixir-carrera-mensajes.png)

Mandá a C la **operación completa**, como `:incrementar`, para que lea y actualice su propio estado en un solo paso del protocolo. Si una operación requiere comprometer cambios en **dos actores distintos**, hace falta coordinar esos cambios y definir qué sucede si uno falla.

## Manejo de errores

Un rechazo esperado, como saldo insuficiente, puede devolverse como `{:error, :saldo_insuficiente}` y el actor puede seguir. Ante un fallo inesperado, permitir que el proceso termine deja la recuperación a quien pueda decidir cómo reiniciarlo.

| Mecanismo | Qué pasa si falla C |
| --- | --- |
| **Sin vínculo** | A puede seguir ejecutándose. Si esperaba una respuesta, necesita un límite de espera o un mecanismo de detección. |
| **Link** | Vínculo bidireccional. Una salida anormal puede terminar al otro proceso. Con `Process.flag(:trap_exit, true)`, las señales capturables llegan como `{:EXIT, pid, motivo}`. |
| **Monitor** | Observación unidireccional. A recibe `{:DOWN, ref, :process, pid, motivo}` y puede seguir. |
| **Supervisor** | Detecta la salida de un hijo y decide si necesita iniciar un reemplazo. |

![Si C falla, el proceso que lo monitorea recibe DOWN y sigue. Un link puede propagar la salida. Un supervisor puede iniciar otro C con un PID nuevo.](/diagramas/elixir-fallas-y-otp.png)

## Excepciones

- **`raise`** produce una excepción que se puede manejar con `try/rescue`. Una excepción sin manejar termina el proceso.
- **`throw`** sale de una función de forma no local. Se puede manejar con `try/catch` si el código que la llama conoce ese protocolo.
- **`exit`** produce una salida. Algunas salidas se pueden capturar. Una señal `:kill` enviada directamente con `Process.exit(pid, :kill)` termina al destinatario aunque use `trap_exit`.

Un `rescue` en A maneja excepciones que ocurren en A. Para reaccionar a la muerte de C, A puede monitorizarlo o manejar el fallo de comunicación. Atrapar una salida no vuelve a poner en marcha al proceso anterior.

## Elixir y OTP · Agents

Un **Agent** es un proceso OTP que encapsula estado. `Agent.start_link(fn -> 10 end)` arranca el contador. `Agent.get(pid, & &1)` consulta el valor. `Agent.update(pid, &(&1 + 1))` aplica un incremento. Las funciones se ejecutan en el **proceso del Agent**, de modo que una función lenta retrasa las demás solicitudes.

`Agent.get_and_update/2` obtiene un resultado y cambia el estado en una sola operación. Con `fn n -> {n + 1, n + 1} end`, el primer valor se devuelve al cliente y el segundo se guarda en el Agent. Separar el cálculo en un `get` y un `update` permite intercalaciones si el segundo paso depende del primero.

Un **GenServer** sirve cuando querés definir tu propio protocolo. `init/1` construye el estado inicial, `handle_call/3` atiende pedidos con respuesta, `handle_cast/2` atiende pedidos asíncronos, y `handle_info/2` procesa otros mensajes como un `:DOWN`. Los callbacks deciden el estado siguiente.

### Para repasar

- **A imprime «enviado». ¿C ya incrementó?** Solo sabés que A terminó su llamada a `send`.
- **El buzón se vació. ¿C muere?** Si sigue en `receive`, puede esperar el siguiente mensaje.
- **C procesa de a uno. ¿Hay carreras?** Sí, si el protocolo permite que otras solicitudes se intercalen entre pasos que necesitaban quedar juntos.
- **El supervisor reinicia C. ¿Vuelve el contador?** Cambia el PID. El valor anterior solo vuelve si la inicialización puede recuperarlo.

[Ejemplos locales de Elixir y OTP](/ejemplos/elixir-otp/) · [Actores, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/actores_intro.adoc) · [Errores y supervisión, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/errores_supervision.adoc) · [OTP, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/otp.adoc)
