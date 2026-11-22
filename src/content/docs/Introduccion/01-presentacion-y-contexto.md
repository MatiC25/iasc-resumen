---
title: Presentación de la materia
description: Objetivos de IASC y criterios para diseñar arquitecturas de software concurrente.
sidebar:
  order: 1
---

## ¿Qué se estudia en IASC?

La materia combina dos objetivos: conocer tecnologías que se usan en el desarrollo de software y aprender ideas de concurrencia y arquitectura que siguen sirviendo cuando cambian las herramientas. Se organiza alrededor de dos ejes: el manejo práctico de la concurrencia y el diseño de sistemas distribuidos.

En concurrencia, el orden en que avanzan distintas tareas puede cambiar el resultado. Por ejemplo, dos tareas que leen y actualizan el mismo contador pueden perder un incremento si ambas leen el valor anterior antes de escribir. Esto puede ocurrir incluso con un solo hilo cuando las operaciones se intercalan. En sistemas distribuidos, además, los nodos se comunican por red y pueden fallar de forma independiente. En ambos casos, hay que bajar el diseño a una implementación para ver qué supuestos se cumplen. [Nociones fundamentales](/introduccion/03-nociones-fundamentales/)

## Qué abarca la arquitectura de software

- **Diseño lógico:** Cómo se divide el sistema en módulos o servicios, qué responsabilidad tiene cada uno y cómo se comunican.
- **Decisiones difíciles de revertir:** Qué tecnologías o lenguajes se adoptan y qué costo tendría cambiarlos.
- **Diseño físico:** En qué máquinas o entornos corre cada parte y cómo se despliega.

## Cómo se construye una arquitectura

| Característica | Qué implica |
| --- | --- |
| **Iterativa** | Empezar con lo necesario y ajustar el diseño cuando aparece evidencia. Por ejemplo, pasar de SQLite a una base de datos cliente-servidor cuando la aplicación lo requiera. |
| **Constructiva** | Implementar, desplegar, medir y probar las decisiones para entender sus efectos. Los diagramas ayudan a comunicarlas. |
| **Verificable** | Buscar resultados temprano. Una prueba de carga acotada puede mostrar si un cambio resuelve el cuello de botella que lo motivó. |
| **Holística** | Tener en cuenta el presupuesto, el equipo, su experiencia y las restricciones de la organización. |
| **Potenciada por la tecnología** | Aprovechar herramientas probadas que resuelvan el problema identificado y encajen con los requisitos. |
| **Enriquecida por la historia** | Estudiar las decisiones de otros sistemas y comprobar si sus condiciones se parecen a las propias antes de adoptarlas. |


## Simplicidad, escalabilidad y YAGNI

Una arquitectura simple conserva las abstracciones que el sistema necesita, reduce la duplicación y el código repetitivo, y facilita las pruebas y el mantenimiento. El principio **KISS** propone limitar la complejidad a la que exige el problema.

Para un producto nuevo con demanda incierta, un **monolito** puede alcanzar para validar la idea. La decisión depende de la carga esperada, los requisitos conocidos, la experiencia del equipo y las bibliotecas disponibles. Distribuir componentes, sumar réplicas o automatizar el escalado implica más trabajo de desarrollo, pruebas y operación. Si un requisito ya exige tolerancia a fallos o presencia en varias regiones, ese costo forma parte del diseño inicial.

**YAGNI** (*You Aren’t Gonna Need It*) propone posponer soluciones a necesidades hipotéticas. Por ejemplo, si las mediciones muestran que el despliegue actual ya no soporta la carga prevista, primero se identifica el cuello de botella y después se evalúa si conviene ampliar recursos, replicar o separar componentes. Así, la arquitectura evoluciona a partir de decisiones que se pueden justificar y verificar.

Fuente principal: [Introducción del IASC Book](https://arquitecturas-concurrentes.github.io/iasc-book/tema/introduccion)
