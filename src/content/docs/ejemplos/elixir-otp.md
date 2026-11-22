---
title: Actores, Agent y supervisión en Elixir
description: Ejemplos ejecutables de mensajes, estado, fallos y nombres estables.
---

Cada bloque es independiente. Guardalo como `demo.exs` y ejecutá `elixir demo.exs`.

## Mensajes y estado interno

El contador pasa el estado a la próxima iteración. El padre manda dos incrementos y después pide una respuesta. Como los tres mensajes salen del mismo proceso hacia el mismo destino y coinciden con los patrones, el contador procesa primero los incrementos.

```elixir
defmodule ContadorBuzon do
  def loop(n) do
    receive do
      :incrementar ->
        loop(n + 1)

      {:leer, cliente} ->
        send(cliente, {:saldo, n})
        loop(n)

      :terminar ->
        :ok
    end
  end
end

actor = spawn(fn -> ContadorBuzon.loop(10) end)
send(actor, :incrementar)
send(actor, :incrementar)
send(actor, {:leer, self()})

receive do
  {:saldo, n} -> IO.puts("Estado: #{n}")
after
  1_000 -> raise "El actor no respondió"
end

send(actor, :terminar)
```

## Estado con Agent

Cada tarea manda una actualización completa. El Agent recibe y resuelve los incrementos de a uno. Si cada tarea leyera el valor y después escribiera un valor calculado afuera, dos lecturas podrían ver el mismo estado.

```elixir
{:ok, contador} = Agent.start_link(fn -> 10 end)

tareas =
  for _ <- 1..2 do
    Task.async(fn -> Agent.update(contador, &(&1 + 1)) end)
  end

Enum.each(tareas, &Task.await/1)
IO.puts("Agent: #{Agent.get(contador, & &1)}")
Agent.stop(contador)
```

## Observar un fallo con un monitor

El trabajador levanta una excepción. El proceso principal recibe `:DOWN` y puede seguir. `spawn_monitor/1` devuelve a la vez el PID y la referencia del monitor.

```elixir
{pid, ref} =
  spawn_monitor(fn ->
    raise "falla de prueba"
  end)

receive do
  {:DOWN, ^ref, :process, ^pid, {%RuntimeError{message: mensaje}, _stacktrace}} ->
    IO.puts("El trabajador terminó: #{mensaje}")
after
  1_000 -> raise "No llegó DOWN"
end
```

## Reinicio con un nombre estable

Un supervisor estático inicia el Registry y un DynamicSupervisor. El contador usa un nombre lógico. Al morir, su reemplazo registra la misma clave y recupera el valor inicial. En una aplicación real, los clientes necesitan manejar la ventana entre la caída y el arranque del nuevo proceso. El sondeo acotado de este script solo espera a que eso se vea en la demostración.

```elixir
defmodule ContadorOTP do
  use GenServer

  def nombre(clave), do: {:via, Registry, {RegistroDemo, clave}}

  def start_link(clave) do
    GenServer.start_link(__MODULE__, 0, name: nombre(clave))
  end

  @impl true
  def init(n), do: {:ok, n}

  @impl true
  def handle_call(:sumar, _cliente, n), do: {:reply, n + 1, n + 1}
  def handle_call(:leer, _cliente, n), do: {:reply, n, n}
end

defmodule EsperaDemo do
  def reemplazo(_clave, _viejo, 0), do: raise("No apareció el reemplazo")

  def reemplazo(clave, viejo, intentos) do
    case Registry.lookup(RegistroDemo, clave) do
      [{pid, _}] when pid != viejo ->
        pid

      _ ->
        Process.sleep(20)
        reemplazo(clave, viejo, intentos - 1)
    end
  end
end

hijos = [
  {Registry, keys: :unique, name: RegistroDemo},
  {DynamicSupervisor, strategy: :one_for_one, name: TrabajadoresDemo}
]

{:ok, raiz} = Supervisor.start_link(hijos, strategy: :one_for_one)
{:ok, viejo} = DynamicSupervisor.start_child(TrabajadoresDemo, {ContadorOTP, :cuenta})
nombre = ContadorOTP.nombre(:cuenta)

1 = GenServer.call(nombre, :sumar)
Process.exit(viejo, :kill)
nuevo = EsperaDemo.reemplazo(:cuenta, viejo, 100)
0 = GenServer.call(nombre, :leer)
IO.puts("PID nuevo: #{nuevo != viejo}; estado: 0")

Supervisor.stop(raiz)
```

[Volver a Actores y Elixir](/elixir/01-actores-y-elixir/) · [Volver a Supervisión](/elixir/02-supervision/)

