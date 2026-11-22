---
title: Corrutinas en Python
description: Ejemplos de sockets, generadores, await y ejecución concurrente.
---

## Sockets bloqueantes y no bloqueantes

Estos ejemplos usan un par de sockets conectados entre sí. Podés ejecutarlos sin contactar un servidor externo.

```python
import socket

lector, escritor = socket.socketpair()
with lector, escritor:
    escritor.sendall(b"hola")
    # Si movés el envío debajo de recv, este hilo queda esperando.
    print(lector.recv(1024).decode())
```

En modo no bloqueante, el selector indica cuándo conviene intentar leer. El ejemplo usa un timeout para que la espera esté acotada.

```python
import selectors
import socket

lector, escritor = socket.socketpair()
with lector, escritor, selectors.DefaultSelector() as selector:
    lector.setblocking(False)
    selector.register(lector, selectors.EVENT_READ)
    escritor.sendall(b"hola")

    for evento, _ in selector.select(timeout=1):
        print(evento.fileobj.recv(1024).decode())
```

## Un generador conserva dónde quedó

`yield` devuelve un valor al llamador. La próxima llamada a `next` continúa después de ese punto y conserva el valor de `numero`.

```python
def cuenta_regresiva(numero):
    while numero > 0:
        yield numero
        numero -= 1

numeros = cuenta_regresiva(3)
print(next(numeros))  # 3
print(next(numeros))  # 2
print(list(numeros))  # [1]
```

Un planificador puede usar esa misma suspensión para construir una corrutina basada en generadores. Acá el primer `next` ejecuta el generador hasta `yield` y `send` le entrega el resultado al reanudarlo.

```python
def lectura():
    datos = yield "esperar datos"
    print("Recibí:", datos)

tarea = lectura()
print(next(tarea))
try:
    tarea.send(b"hola")
except StopIteration:
    print("Tarea terminada")
```

## Comparar espera secuencial y concurrente

El mismo trabajo tarda alrededor de tres segundos con esperas secuenciales y uno si las tres esperas se solapan en el bucle. Los tiempos dependen del entorno.

```python
import asyncio
import time

def secuencial():
    for nombre in ("A", "B", "C"):
        time.sleep(1)
        print(nombre)

async def tarea(nombre):
    await asyncio.sleep(1)
    print(nombre)

async def concurrente():
    await asyncio.gather(tarea("A"), tarea("B"), tarea("C"))

inicio = time.perf_counter()
secuencial()
print(f"Secuencial: {time.perf_counter() - inicio:.2f} s")

inicio = time.perf_counter()
asyncio.run(concurrente())
print(f"Concurrente: {time.perf_counter() - inicio:.2f} s")
```

Llamar a `tarea("A")` crea un objeto corrutina. El cuerpo empieza cuando se espera esa corrutina con `await` o cuando se la agenda. Si cambiás `await asyncio.sleep(1)` por `time.sleep(1)`, cada tarea retiene el hilo del bucle mientras espera. Para una función bloqueante existente, podés ceder el hilo del bucle con `await asyncio.to_thread(funcion, argumento)`.

## Lecturas concurrentes y TaskGroup

Este ejemplo local reproduce la parte de I/O de un crawler. Tres lecturas quedan pendientes y un mismo bucle las reanuda cuando llegan datos. En un crawler real, cada conexión recibiría una respuesta HTTP que habría que leer y parsear. El ejemplo requiere Python 3.11 o posterior por `TaskGroup`.

```python
import asyncio
import socket

async def descargar(nombre):
    loop = asyncio.get_running_loop()
    lector, escritor = socket.socketpair()
    with lector, escritor:
        lector.setblocking(False)
        # Simula que la respuesta llega más tarde.
        aviso = loop.call_later(0.2, escritor.sendall, nombre.encode())
        try:
            datos = await loop.sock_recv(lector, 1024)
            return datos.decode()
        finally:
            aviso.cancel()

async def main():
    async with asyncio.TaskGroup() as grupo:
        tareas = [grupo.create_task(descargar(nombre)) for nombre in ("A", "B", "C")]
    print([tarea.result() for tarea in tareas])

asyncio.run(main())  # ['A', 'B', 'C']
```

`gather` devuelve los resultados en el orden de entrada. Por defecto, si una tarea falla, propaga la excepción y las demás pueden seguir. `TaskGroup` espera a todas al salir del bloque y cancela las demás si una falla con una excepción distinta de cancelación.

[Volver a Corrutinas y fibers](/introduccion/04-modelos-tradicionales/#corrutinas-y-fibers)


[Guía de estudio y laboratorio](/corutinas/corrutinas-y-laboratorio/)
