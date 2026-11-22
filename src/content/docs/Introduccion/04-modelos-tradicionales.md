---
title: Modelos tradicionales de manejo de concurrencia
description: Procesos, hilos del sistema operativo y sincronización de recursos compartidos.
sidebar:
  order: 4
---

## Procesos e hilos

Una forma tradicional de atender varias tareas es repartirlas entre **procesos** o **hilos** que planifica el sistema operativo. En un núcleo, el planificador intercala sus turnos. Con varios núcleos, puede ejecutar más de un hilo a la vez si hay trabajo listo.

| Modelo | Qué comparte | Cómo se coordina |
| --- | --- | --- |
| **Varios procesos** | Cada proceso tiene su propio espacio de direcciones. | Mensajes, pipes, sockets o memoria compartida configurada explícitamente. |
| **Varios hilos de un proceso** | Comparten el espacio de direcciones y recursos del proceso. Cada hilo tiene su propia pila y estado de ejecución. | Pueden acceder a los mismos objetos, por lo que el acceso concurrente a datos mutables requiere coordinación. |
| **Varios procesos con varios hilos** | Cada proceso mantiene su espacio de direcciones y sus hilos comparten los datos de ese proceso. | Se combinan mecanismos entre procesos y sincronización dentro de cada uno. |

Los procesos proporcionan aislamiento. Los hilos facilitan el intercambio de datos dentro de un proceso. En ambos casos, importa cuántas tareas están listas y cuántas quedan esperando CPU o I/O.

## Una solicitud por hilo

Imaginá un servidor con dos hilos. El primero atiende una solicitud y hace una consulta bloqueante a una base de datos. Mientras ese hilo espera, el segundo puede atender otra solicitud. Si los dos quedan bloqueados, la próxima solicitud espera a que alguno se libere, aunque quede capacidad de CPU disponible.

![Línea de tiempo. El hilo 1 atiende A y queda bloqueado durante la consulta. El hilo 2 atiende B y luego toma C, que esperaba en la cola. Cuando llega la respuesta de la base de datos, el hilo 1 retoma A.](/diagramas/hilos-io-bloqueante.png)

Crear un hilo por cada solicitud puede aumentar el consumo de memoria y la cantidad de cambios de contexto. Un **pool** reutiliza un número acotado de hilos. Cuando todos están ocupados, las solicitudes pueden esperar en una cola acotada o recibir una respuesta de sobrecarga. Un pool de procesos aplica la misma idea con trabajadores aislados.

## Estado compartido y sincronización

Si dos hilos incrementan el mismo contador leyendo, sumando y escribiendo por separado, ambos pueden leer 10 y ambos escribir 11. El resultado esperado era 12. La parte del código que debe protegerse se llama **sección crítica**.

![Dos hilos suman uno a un contador que empieza en 10. Sin mutex, ambos leen 10 y escriben 11, así que se pierde un incremento. Con mutex, el segundo hilo espera, lee 11 y escribe 12.](/diagramas/contador-compartido-mutex.png)

- **Mutex.** Permite que un hilo por vez entre a la sección crítica. Para proteger el contador debe abarcar la lectura, la suma y la escritura.
- **Semáforo.** Controla cuántos permisos pueden usarse al mismo tiempo. Por ejemplo, puede limitar a cinco las consultas concurrentes a una base de datos.
- **Variable de condición.** Permite esperar hasta que cambie una condición del estado compartido. Por ejemplo, un consumidor puede esperar a que haya elementos en una cola y comprobar la condición al despertar.
- **Operación atómica.** Para operaciones puntuales, como incrementar un contador, permite hacer la actualización indivisible respecto de otros hilos.

La coordinación también tiene costo. Un mutex muy disputado puede serializar el trabajo. Si dos hilos adquieren los mismos locks en orden inverso, pueden quedar en **interbloqueo**. Por ejemplo, uno conserva A mientras espera B y el otro conserva B mientras espera A. Adquirir los locks en un orden consistente evita ese patrón.

## Cuándo sirven

Para **CPU-bound**, el paralelismo depende de cuántos núcleos estén disponibles y del trabajo independiente que puedan ejecutar. Para **I/O-bound**, varios trabajadores permiten avanzar unas solicitudes mientras otras esperan. Si muchas solicitudes pasan la mayor parte del tiempo esperando, un modelo que suspenda la tarea y reutilice el hilo puede aprovechar mejor esos recursos.

Podés observar la diferencia en el [simulador de Nociones fundamentales](/introduccion/03-nociones-fundamentales/#simulador-de-ejecución) comparando I/O bloqueante y no bloqueante. El escenario bloqueante tiene un solo hilo. Con varios trabajadores, una llamada bloqueante ocupa el hilo que la hizo y los demás pueden seguir atendiendo tareas.

## Alternativas para manejar la concurrencia

Un pool reparte el trabajo entre un número acotado de hilos. Cuando gran parte del trabajo consiste en esperar I/O, también podemos separar la tarea lógica del hilo que la ejecuta. Si el problema es coordinar estado mutable, otra opción es darle a cada parte del sistema control sobre su propio estado y comunicarla por mensajes.

| Modelo | Cómo avanza el trabajo | Qué conviene tener en cuenta |
| --- | --- | --- |
| **Bucle de eventos** | Una tarea inicia una operación de I/O y registra una continuación. Cuando llega el resultado, el bucle agenda el código que debe ejecutarse después. | Si una continuación hace mucho cálculo o una llamada bloqueante en el hilo del bucle, retrasa los demás eventos. |
| **Corrutinas y fibers** | Una tarea puede suspenderse y luego continuar desde donde quedó. Con una operación compatible, el runtime puede ejecutar otra tarea en el mismo hilo durante la espera. | Suspender una tarea libera el hilo. Una llamada bloqueante dentro de esa tarea puede ocuparlo si el runtime no la delega. |
| **Actores** | Cada actor mantiene su estado, recibe mensajes en un buzón y los procesa de a uno. Actores distintos pueden progresar concurrentemente. | Hay que diseñar la coordinación entre actores y decidir qué hacer si un buzón crece más rápido de lo que se procesa. |

Por ejemplo, un servidor con bucle de eventos puede iniciar la consulta de **A** y seguir atendiendo **B** mientras espera. Una corrutina expresa ese mismo flujo con un punto de suspensión, como `await`. Si lo que importa es evitar actualizaciones simultáneas sobre el contador del ejemplo anterior, un actor puede ser dueño del contador y procesar un mensaje de incremento por vez.

### Bucle de eventos

![El hilo inicia la I/O de A y atiende B durante la espera. Cuando llegan los datos, la continuación de A entra en cola y el bucle la ejecuta.](/diagramas/bucle-de-eventos.png)

### Corrutinas y fibers

![A se suspende en un await y libera el hilo. El runtime ejecuta B durante la espera. Cuando A recupera el turno, continúa después del await.](/diagramas/corrutinas-fibers.png)

Un ejemplo es un **crawler** que descarga páginas. Con sockets bloqueantes, cada descarga en curso ocupa un hilo trabajador mientras espera datos. Con sockets no bloqueantes, un bucle puede vigilar varias conexiones y reanudar la corrutina de cada descarga cuando su socket esté listo. Así se solapan las esperas de red en un solo hilo.

En una corrutina de Python, `await` permite ceder el hilo si el resultado sigue pendiente. Al retomarla, la función conserva sus variables locales y sigue desde ese punto. Si el resultado ya está disponible, puede seguir sin suspenderse. [Ejemplos de código de corrutinas](/ejemplos/corrutinas/)

### Actores

![A y B envían mensajes de incremento al buzón de C, el actor dueño del contador. C los procesa de a uno y actualiza el valor de 10 a 11 y luego a 12.](/diagramas/actores.png)

Estos modelos se pueden combinar. Un servidor puede usar corrutinas para esperar I/O y delegar cálculos largos a un pool de trabajadores. El paralelismo de CPU depende de cómo se distribuye el trabajo entre los hilos y núcleos disponibles.

Fuentes del IASC Book: [Concurrencia y paralelismo](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/concurrencia_paralelismo.adoc) · [Fibers en Ruby](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/fibers.adoc) · [Event loop](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/event_loop.adoc) · [Corrutinas](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/corutinas.adoc) · [Actores](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/actores_intro.adoc)
