---
title: Supervisión de procesos y Registry
description: Clase 8. Árboles, estrategias, intensidad de reinicio y descubrimiento local de procesos.
sidebar:
  order: 2
---


## Clase 8 · 01/10/2026

## Jerarquías de supervisión

Un **supervisor OTP** inicia y vigila procesos hijos. Un hijo puede ser un trabajador u otro supervisor. El conjunto forma un **árbol**: agrupá bajo el mismo supervisor los procesos que deban recuperarse juntos. La aplicación suele arrancar un supervisor raíz desde `Application.start/2`.

Cada hijo tiene una **especificación** que indica cómo iniciarlo y bajo qué condiciones volverlo a iniciar. Si muere, el supervisor evalúa su política de reinicio y, cuando corresponde, lo crea con un PID nuevo. El estado en memoria del hijo se pierde al terminar. `init/1` reconstruye el nuevo estado a partir de sus argumentos o de una fuente externa.

## Estrategias de recuperación

| Estrategia | Si falla B entre A, B y C | Cuándo sirve |
| --- | --- | --- |
| `:one_for_one` | Reinicia B. A y C siguen. | Los hijos son independientes. |
| `:one_for_all` | Detiene A y C y reinicia los tres. | Los hijos necesitan reconstruir su coordinación juntos. |
| `:rest_for_one` | Reinicia B y los hijos iniciados después, aquí C. | Los hijos posteriores dependen de los anteriores. |

La tabla supone hijos con reinicio permanente. La política **del hijo** es una decisión distinta: `:permanent` se reinicia incluso tras una salida normal, `:transient` solo ante salida anormal y `:temporary` jamás se reinicia automáticamente. Si un trabajo es de ejecución única, reiniciarlo por defecto podría repetir efectos.

### La misma falla con dos estrategias

![Si falla B con uno a uno, solo B recibe un PID nuevo. Con uno a todos, A, B y C reciben PID nuevos.](/diagramas/elixir-supervision-estrategias.png)

## Tasa de errores e intensidad de reinicio

`max_restarts` y `max_seconds` limitan cuántos reinicios se permiten dentro de una ventana de tiempo. Con `max_restarts: 2, max_seconds: 5`, si un tercer reinicio es necesario dentro de esa ventana, el supervisor termina junto con sus hijos. Si tiene un padre, este aplica su propia política. Así se evita reiniciar sin fin un proceso que sigue fallando durante el arranque.

Esta intensidad mide **reinicios de procesos**, no cuántos pedidos devolvieron `{:error, motivo}`. Un reintento de descarga o el umbral de fallos por dominio pertenecen al protocolo de aplicación. Se suelen combinar con límites, demoras y una política explícita sobre efectos repetidos.

## Supervisión estática y dinámica

| | Supervisor | DynamicSupervisor |
| --- | --- | --- |
| Hijos | Lista inicial en el orden de dependencias. | Arranca sin hijos y recibe solicitudes en ejecución con `start_child/2`. |
| Estrategias | `:one_for_one`, `:one_for_all` y `:rest_for_one`. | `:one_for_one`. |
| Ejemplo | Registry y supervisor de trabajos creados al iniciar la aplicación. | Un trabajador por archivo, cliente o URL, según la demanda. |

Un árbol puede tener ambos. Un supervisor estático arranca primero los servicios compartidos y luego un supervisor dinámico. Si los hijos son transitorios o finalizan tras ejecutar una tarea, elegí su política pensando qué significa volver a correr ese trabajo.

## OTP Registry

**Registry** relaciona claves de una aplicación con procesos **del mismo nodo**. Con claves únicas podés encontrar a un trabajador con un nombre como `{:via, Registry, {MiRegistry, clave}}`. Si usa claves duplicadas, varios procesos pueden registrarse con una misma clave, por ejemplo para recibir notificaciones.

1. El supervisor raíz inicia Registry.
2. El trabajador registra una clave lógica cuando arranca.
3. El cliente usa la clave para resolver el PID actual.
4. Al terminar el trabajador, Registry limpia su entrada. Un reemplazo puede registrar la misma clave al iniciar.

Puede haber una ventana sin proceso disponible durante el reinicio. Registry permite localizar un proceso, pero **no lo supervisa ni almacena su estado**. Para la versión distribuida, seguí a [Distribución en Elixir](/elixir/04-distribucion/).

[Ejemplo local de supervisor, reinicio y Registry](/ejemplos/elixir-otp/#reinicio-con-un-nombre-estable) · [OTP, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/otp.adoc) · [Supervisor](https://elixir.hexdocs.pm/Supervisor.html) · [DynamicSupervisor](https://elixir.hexdocs.pm/DynamicSupervisor.html) · [Registry](https://elixir.hexdocs.pm/Registry.html)
