---
title: Fundamentos
description: Repaso de Haskell, functores, aplicativos, mónadas y sus leyes.
---

## Repaso de Haskell

Una función pura produce el mismo resultado para los mismos argumentos y no tiene efectos observables. 
Haskell representa acciones con efectos mediante tipos como `IO a`. 
En el ejemplo de código, `main :: IO ()` imprime resultados y `mitadExacta :: Int -> Maybe Int` es una función pura.

- **Tipos.** `Int -> Int` describe una función que recibe y devuelve un entero. `a -> a` es polimórfica. `Num a => a -> a` requiere que ese tipo tenga una instancia de `Num`.
- **Currificación.** `Int -> Int -> Int` se lee `Int -> (Int -> Int)`. Al aplicar `(+)` a un argumento obtenés una función que espera el otro, como `(+ 1)`.
- **Constructores y patrones.** `Maybe a` representa un valor que puede faltar. `Just x` contiene el valor y `Nothing` representa su ausencia. Con patrones podés tratar cada caso.
- **Typeclasses.** Definen operaciones comunes que distintos tipos implementan. `Functor`, `Applicative` y `Monad` describen distintas maneras de trabajar con un constructor de tipos como `Maybe`.

## Functores

`fmap :: Functor f => (a -> b) -> f a -> f b`

Aplica una función a los valores dentro de un contexto. Para `Maybe`, `fmap (+ 1) (Just 4)` da `Just 5` y `fmap (+ 1) Nothing` da `Nothing`. El operador `<$>` es la forma infija de `fmap`.

## Functores aplicativos

`pure :: Applicative f => a -> f a` introduce un valor en el contexto. Para `Maybe`, da `Just` de ese valor.

`(<*>) :: Applicative f => f (a -> b) -> f a -> f b` aplica una función en contexto a un argumento en contexto. Por ejemplo, `(+) <$> Just 4 <*> Just 2` da `Just 6`. El primer paso produce `Just (4 +)` y el segundo le aplica el `2`. Si falta uno de los números, el resultado es `Nothing`.

Usá esta forma cuando las operaciones que producen los argumentos se pueden especificar desde el principio. En el ejemplo, leer el segundo número no depende del valor que salió de la primera lectura.

## Mónadas

`(>>=) :: Monad m => m a -> (a -> m b) -> m b`

Este operador, llamado **bind**, pasa el resultado de un paso a una función que elige el paso siguiente. Para `Maybe`, si el primer paso da `Nothing`, la función siguiente queda sin ejecutar. Si da `Just 4`, `Just 4 >>= mitadExacta` ejecuta `mitadExacta 4` y devuelve `Just 2`.

La notación `do` permite escribir esa misma secuencia como un bloque. En `n <- valor`, el resto del bloque puede usar `n`. Elegí bind cuando el próximo paso depende del valor obtenido, como decidir si existe una mitad entera después de leer un número.

## Leyes

Las leyes describen qué expresiones deben dar el mismo resultado. Sirven para reordenar o simplificar código preservando su comportamiento. En la tabla, `x` es un valor, `v` y `w` son valores en contexto, `u` es una función en contexto, `f` y `g` son funciones puras, y `k` y `h` son funciones que devuelven resultados monádicos.

| Clase | Ley | Igualdad |
| --- | --- | --- |
| Functor | Identidad | `fmap id v == v` |
| Functor | Composición | `fmap (f . g) v == fmap f (fmap g v)` |
| Applicative | Identidad | `pure id <*> v == v` |
| Applicative | Composición | `pure (.) <*> u <*> v <*> w == u <*> (v <*> w)` |
| Applicative | Homomorfismo | `pure f <*> pure x == pure (f x)` |
| Applicative | Intercambio | `u <*> pure x == pure (\f -> f x) <*> u` |
| Monad | Identidad izquierda | `pure x >>= k == k x` |
| Monad | Identidad derecha | `v >>= pure == v` |
| Monad | Asociatividad | `(v >>= k) >>= h == v >>= (\a -> k a >>= h)` |

Por ejemplo, `fmap id (Just 4)` da `Just 4`. En la identidad izquierda de Monad, `pure 4 >>= mitadExacta` y `mitadExacta 4` dan `Just 2`. El símbolo `==` expresa igualdad de comportamiento en las leyes. Para probar una ley escribiendo un `==` real en Haskell, los resultados deben tener una instancia de `Eq`.

[Ejemplo de código con Maybe](/ejemplos/funcional-maybe/) · [Estructuras funcionales, IASC Book](https://github.com/arquitecturas-concurrentes/iasc-book/blob/source/src/adocs/estructuras_funcionales.adoc)
