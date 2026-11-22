const descriptions = {
  running: 'empieza o retoma su turno de CPU',
  ready: 'vuelve a la cola de tareas listas',
  io: 'inicia I/O y libera el hilo',
  blocked: 'inicia I/O y el hilo queda bloqueado',
  switch: 'recibe el próximo turno mientras la CPU cambia de contexto',
  done: 'termina su trabajo',
};

export function playbackEvents(frames) {
  return frames.flatMap((frame, index) => {
    if (index === 0) {
      const running = frame.slots.flatMap(({ id }, core) => id === undefined ? [] : [`CPU ${core + 1} empieza a ejecutar T${id + 1}.`]);
      const waiting = frame.tasks.filter(({ state }) => state === 'ready').length;
      if (waiting > 0) running.push(`Tareas en cola: ${waiting}.`);
      return [{ time: frame.time, messages: running }];
    }

    const previous = frames[index - 1];
    const changes = frame.tasks.flatMap(({ state }, id) => {
      if (state === previous.tasks[id].state) return [];
      return [{ id, state, message: `T${id + 1} ${descriptions[state]}.` }];
    });
    if (!changes.length && !frame.notices.length && frame.switches === previous.switches) return [];
    return [{ time: frame.time, messages: frame.notices, changes }];
  });
}

