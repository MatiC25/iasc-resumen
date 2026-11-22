---
title: Functor, Applicative y Monad con Maybe
description: Un ejemplo mínimo con números que pueden faltar o ser inválidos.
---

Usamos el mismo tipo en tres situaciones. **Functor** transforma un número, **Applicative** suma dos números leídos por separado y **Monad** decide si el número leído tiene mitad entera.

```haskell
import Text.Read (readMaybe)

mitadExacta :: Int -> Maybe Int
mitadExacta n
  | even n    = Just (n `div` 2)
  | otherwise = Nothing

main :: IO ()
main = do
  print (fmap (+ 1) (readMaybe "4" :: Maybe Int))       -- Just 5
  print ((+) <$> (readMaybe "4" :: Maybe Int) <*> readMaybe "2") -- Just 6
  print (readMaybe "4" >>= mitadExacta)                -- Just 2
  print (readMaybe "5" >>= mitadExacta)                -- Nothing
  print (readMaybe "hola" >>= mitadExacta)             -- Nothing
```

Guardalo como `Main.hs` y ejecutá `runghc Main.hs`. Probá cambiar el segundo número de la suma por `"hola"` y predecí el resultado.

[Volver a Programación funcional](/funcional/fundamentos/)
