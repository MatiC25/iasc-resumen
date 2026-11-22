export const TICK = 50;
const QUANTUM = 200;
export const scenarios = {
  concurrent: 'Concurrencia',
  parallel: 'Paralelismo',
  async: 'Asincronía',
  blocking: 'I/O bloqueante',
  nonblocking: 'I/O no bloqueante',
};

export function simulate({ mode, count, cores, cpu, io, workload, switchCost }) {
  const lanes = Array.from({ length: mode === 'parallel' ? cores : 1 }, () => ({
    task: null, last: null, change: 0, slice: 0, segments: [],
  }));
  const tasks = Array.from({ length: count }, (_, id) => {
    const hasIO = workload === 'io' || (workload === 'mixed' && id % 2 === 0);
    return { id, hasIO, remaining: cpu, ioAt: cpu - TICK, readyAt: 0, wait: 0, state: 'ready' };
  });
  const ready = [...tasks];
  const frames = [];
  let busy = 0;
  let idle = 0;
  let switches = 0;
  let done = 0;
  let time = 0;

  while (true) {
    const notices = [];
    for (const task of tasks) {
      if (!['io', 'blocked'].includes(task.state) || task.readyAt !== time) continue;
      notices.push(`I/O de T${task.id + 1} completada`);
      if (task.state === 'blocked') {
        task.state = 'running';
      } else {
        task.state = 'ready';
        ready.push(task);
      }
    }

    for (const lane of lanes) {
      if (lane.task || ready.length === 0) continue;
      const task = ready.shift();
      if (lane.last !== null && lane.last !== task.id) {
        switches++;
        lane.change = switchCost;
      }
      lane.last = task.id;
      lane.task = task;
      lane.slice = 0;
      task.state = lane.change > 0 ? 'switch' : 'running';
    }

    const slots = lanes.map(({ task }) => task ? { id: task.id, state: task.state } : { state: 'idle' });
    frames.push({ time, busy, idle, switches, done, notices, slots, tasks: tasks.map(({ state, wait }) => ({ state, wait })) });
    if (done === count) break;

    for (const task of tasks) {
      if (['ready', 'io', 'blocked', 'switch'].includes(task.state)) task.wait += TICK;
    }

    for (const lane of lanes) {
      const task = lane.task;
      const state = task?.state ?? 'idle';
      const previous = lane.segments.at(-1);
      if (previous?.state === state && previous.id === task?.id) {
        previous.end += TICK;
      } else {
        lane.segments.push({ start: time, end: time + TICK, id: task?.id, state });
      }
      if (state === 'idle' || state === 'blocked') {
        idle += TICK;
        continue;
      }
      busy += TICK;
      if (lane.change > 0) {
        lane.change -= TICK;
        if (lane.change === 0) task.state = 'running';
        continue;
      }

      task.remaining -= TICK;
      lane.slice += TICK;
      if (task.remaining === 0) {
        task.state = 'done';
        lane.task = null;
        done++;
      } else if (task.hasIO && task.remaining === task.ioAt) {
        task.readyAt = time + TICK + io;
        task.state = mode === 'blocking' ? 'blocked' : 'io';
        if (mode !== 'blocking') lane.task = null;
      } else if (lane.slice >= QUANTUM && ready.length > 0) {
        task.state = 'ready';
        ready.push(task);
        lane.task = null;
      }
    }
    time += TICK;
  }

  return { frames, lanes: lanes.map(({ segments }) => segments), total: time };
}

