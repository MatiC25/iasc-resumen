---
title: Software Transactional Memory
description: Usos, transacciones en memoria y validación optimista en Haskell.
---

## Usos

STM sirve para coordinar **estado mutable compartido** entre tareas concurrentes. Es útil cuando varias operaciones deben verse como una sola: transferir saldo entre dos cuentas, reservar varios recursos juntos o esperar hasta que haya datos en una cola. Si el trabajo usa datos inmutables o cada tarea tiene su propio estado, puede prescindir de una transacción.

## Concepto

Una transacción agrupa lecturas y escrituras. Al confirmarse, sus cambios se vuelven visibles juntos (**atomicidad**). Las transacciones confirmadas se comportan como si se hubieran ejecutado en algún orden secuencial (**aislamiento**). En una transferencia, otro hilo que lea ambos saldos en una transacción ve el estado anterior o posterior, sin observar el débito por separado.

| En Haskell | Qué representa |
| --- | --- |
| `TVar a` | Una variable de memoria compartida gestionada por STM. |
| `STM a` | Una acción transaccional que, si se confirma, devuelve un valor de tipo `a`. Se pueden componer varias con `do`. |
| `atomically :: STM a -> IO a` | Ejecuta la acción como una sola transacción. |

La frontera de la transacción la marca `atomically`. Dos llamadas separadas permiten que otro hilo vea el estado entre ellas. Las acciones ordinarias de `IO`, como imprimir o enviar una petición, se hacen afuera del bloque: una transacción puede volver a ejecutarse.

## Nociones de implementación interna

1. **Lectura.** El runtime anota en un registro privado qué TVars leyó y qué valores observó. Si la transacción ya escribió en una de ellas, lee su propia escritura tentativa.
2. **Escritura tentativa.** Las modificaciones se guardan en ese registro. Las demás transacciones siguen viendo los valores confirmados.
3. **Validación y publicación.** Antes de confirmar, el runtime comprueba que las lecturas sigan siendo válidas. Si puede confirmar, publica los cambios juntos. Si hay conflicto, descarta el intento y lo vuelve a ejecutar con el estado actualizado.

GHC coordina la validación y el commit internamente y puede usar locks breves sobre las TVars que va a modificar. El código de aplicación compone acciones STM sin adquirir esos locks durante todo el bloque.

## Lockeo optimista

Con un mutex, un hilo pide permiso **antes** de entrar a la sección crítica. En STM se ejecuta de forma **optimista** y se verifica si el trabajo sigue siendo válido antes de confirmarlo.

| Paso | Transacción A | Transacción B |
| --- | --- | --- |
| 1 | Lee el contador en 10 | Lee el contador en 10 |
| 2 | Confirma el incremento a 11 | Todavía tiene un 11 tentativo |
| 3 | Termina | Detecta que su lectura quedó desactualizada y reintenta |
| 4 | | Lee 11 y confirma 12 |

Si los conflictos son frecuentes, el trabajo descartado puede salir caro. Las transacciones cortas reducen la cantidad de trabajo perdido en cada intento.

**Reintento por conflicto y `retry`.** Un conflicto puede provocar un nuevo intento automáticamente. `retry` se usa cuando el programa detecta que todavía falta una condición, como saldo suficiente. En ese caso, STM puede suspender la transacción hasta que cambie alguna TVar que leyó. `check condicion` hace `retry` si la condición es falsa.

### Ejemplo de código

```haskell
import Control.Concurrent.STM

transferir :: TVar Int -> TVar Int -> Int -> STM ()
transferir origen destino monto = do
  saldo <- readTVar origen
  check (saldo >= monto)
  writeTVar origen (saldo - monto)
  modifyTVar' destino (+ monto)

main :: IO ()
main = do
  origen <- newTVarIO 100
  destino <- newTVarIO 20
  atomically (transferir origen destino 30)
  saldos <- atomically ((,) <$> readTVar origen <*> readTVar destino)
  print saldos
```

El resultado es `(70,50)`. El débito y el crédito se confirman juntos. Si una transferencia de monto positivo supera el saldo, espera a que otra transacción cambie el saldo de origen. El ejemplo supone cuentas distintas y un monto positivo.

[STM, capítulo enlazado por el IASC Book](https://github.com/arquitecturas-concurrentes/iasc-stm-haskell-2019/blob/master/01_semaphores_and_philosophers/README.adoc) · [Repaso de programación funcional](/funcional/fundamentos/)
