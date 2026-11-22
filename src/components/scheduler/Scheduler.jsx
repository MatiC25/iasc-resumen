import { useEffect, useMemo, useRef, useState } from 'react';
import Scene, { colors, status } from './Scene.jsx';
import { scenarios, simulate, TICK } from './simulation.mjs';
import { playbackEvents } from './playback.mjs';
import './scheduler.css';

const defaults = { count: 4, cores: 4, cpu: 400, io: 600, workload: 'mixed', switchCost: 50 };
const explanations = {
  concurrent: 'Un núcleo reparte turnos de hasta 200 ms. Las tareas listas esperan en una cola.',
  parallel: 'Cada núcleo puede ejecutar una tarea a la vez. La cola de tareas listas es compartida.',
  async: 'La tarea se suspende durante la I/O. Al llegar la notificación, vuelve a la cola y continúa cuando consigue CPU.',
  blocking: 'La I/O bloquea al único hilo del ejemplo. El núcleo queda ocioso hasta que ese hilo pueda continuar.',
  nonblocking: 'En esta variante, la llamada devuelve el control y la espera se maneja por notificación. Otra tarea lista puede usar la CPU.',
};

function Select({ label, value, onChange, options }) {
  return <label>{label}<select value={value} onChange={(event) => onChange(event.target.value)}>
    {options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
  </select></label>;
}

function Gantt({ result, duration, time, title, show }) {
  return (
    <div className="sim-gantt">
      <strong>{title} · {result.total} ms</strong>
      {result.lanes.map((lane, index) => (
        <div className="sim-lane" key={index}>
          <span>CPU {index + 1}</span>
          <div className="sim-track" aria-label={`Cronología de CPU ${index + 1}`}>
            {lane.map(({ start, end, state, id }) => (
              <span key={start} className={`sim-segment sim-${state}${!show && state === 'switch' ? ' sim-hide-switch' : ''}`}
                style={{ width: `${100 * (end - start) / duration}%`, '--task': colors[id] }}
                title={`${start}–${end} ms: ${id === undefined ? '' : `T${id + 1} · `}${status(state, show)}`}>
                {state === 'running' && `T${id + 1}`}
              </span>
            ))}
            <span className="sim-playhead" style={{ left: `${100 * Math.min(time, duration) / duration}%` }} />
          </div>
        </div>
      ))}
      <div className="sim-axis"><span>0 ms</span><span>{duration} ms</span></div>
    </div>
  );
}

function Comparison({ first, second, mode, other, time, show, cpuOnly }) {
  const delta = second.total - first.total;
  return <>
    <Gantt result={second} title={scenarios[other]} duration={Math.max(first.total, second.total)} time={time} show={show} />
    <p>{delta === 0 ? 'Ambos escenarios tardan lo mismo.' :
      `${scenarios[delta > 0 ? mode : other]} termina ${Math.abs(delta)} ms antes.`}
      {' '}{cpuOnly
        ? 'La diferencia depende de cuántas tareas consiguen CPU al mismo tiempo y del costo de los cambios de contexto.'
        : 'El resultado depende de cuánta espera de I/O puede solaparse con trabajo útil y de cuánto cuesta reasignar la CPU.'}
    </p>
  </>;
}

export default function Scheduler() {
  const [config, setConfig] = useState(defaults);
  const [mode, setMode] = useState('concurrent');
  const [other, setOther] = useState('parallel');
  const [compare, setCompare] = useState(false);
  const [show, setShow] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [view2D, setView2D] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState(false);
  const workspace = useRef(null);

  useEffect(() => {
    const update = () => setFullscreen(document.fullscreenElement === workspace.current);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);

  async function toggleFullscreen() {
    setFullscreenError(false);
    try {
      if (document.fullscreenElement === workspace.current) {
        await document.exitFullscreen();
      } else {
        await workspace.current.requestFullscreen();
      }
    } catch {
      setFullscreenError(true);
    }
  }

  const result = useMemo(() => simulate({ ...config, mode }), [config, mode]);
  const comparison = useMemo(() => compare ? simulate({ ...config, mode: other }) : null, [compare, config, other]);
  const limit = Math.max(result.total, comparison?.total ?? 0);
  const frame = result.frames[Math.min(result.frames.length - 1, Math.floor(elapsed / TICK))];
  const secondFrame = comparison?.frames[Math.min(comparison.frames.length - 1, Math.floor(elapsed / TICK))];
  const time = Math.min(limit, Math.floor(elapsed / TICK) * TICK);
  const events = useMemo(() => playbackEvents(result.frames), [result]);
  const comparisonEvents = useMemo(() => comparison ? playbackEvents(comparison.frames) : [], [comparison]);
  const steps = useMemo(() => [...new Set([...events, ...comparisonEvents].map((event) => event.time))].sort((a, b) => a - b),
    [events, comparisonEvents]);
  const nextTime = steps.find((step) => step > time);
  const previousTime = steps.findLast((step) => step < time);
  const eventHistory = [
    ...events.map((event) => ({ ...event, scenario: mode, column: 0 })),
    ...comparisonEvents.map((event) => ({ ...event, scenario: other, column: 1 })),
  ].filter((event) => event.time <= time).sort((a, b) => b.time - a.time);

  const advancing = playing && elapsed < limit;

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!advancing || nextTime === undefined) return;
    const delay = Math.max(1200, (nextTime - time) * 2) / speed;
    const timer = window.setTimeout(() => setElapsed(nextTime), delay);
    return () => window.clearTimeout(timer);
  }, [advancing, nextTime, speed, time]);

  function goToStep(step) {
    setPlaying(false);
    setElapsed(step);
  }


  function reset() {
    setPlaying(false);
    setElapsed(0);
  }

  function change(key, value) {
    reset();
    setConfig((current) => ({ ...current, [key]: value }));
  }

  const scenarioOptions = Object.entries(scenarios);

  return (
    <section ref={workspace} className="scheduler not-content" aria-label="Simulador de ejecución">
      <div className="sim-workspace">
        <div className="sim-preview">
          <p>{explanations[mode]}</p>
          <div className="sim-clock"><strong>{time} ms</strong><span>Tiempo simulado · {limit} ms en la escala</span></div>
          <Scene frame={frame} reduced={reduced || view2D} show={show} />
          <div className="sim-states">
            {frame.tasks.map(({ state, wait }, id) => (
              <span className="sim-chip" key={id} style={{ '--task': colors[id] }}>
                T{id + 1} · {status(state, show)} · espera {wait} ms
              </span>
            ))}
          </div>
          <div className="sim-events">
            <strong id="sim-event-heading">Historial de eventos</strong>
            <ol aria-labelledby="sim-event-heading" tabIndex={0}>
              {eventHistory.map(({ time: eventTime, scenario, column, messages, changes }) => (
                <li key={`${column}-${eventTime}`}>
                  <strong>{eventTime} ms{compare && ` · ${scenarios[scenario]}`}</strong>
                  <ul>
                    {messages.map((message) => <li key={message}>{message}</li>)}
                    {changes?.map(({ id, state, message }) => (
                      <li key={id}>{state === 'switch' && !show ? `T${id + 1} se prepara para ejecutar.` : message}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <div className="sim-settings" role="group" aria-label="Controles de la simulación">
          <div className="sim-controls">
            <Select label="Escenario" value={mode} options={scenarioOptions} onChange={(value) => { reset(); setMode(value); }} />
            <Select label="Carga" value={config.workload} options={[['mixed', 'Mixta'], ['cpu', 'CPU-bound'], ['io', 'I/O-bound']]}
              onChange={(value) => change('workload', value)} />
            <Select label="Tareas" value={config.count} options={[2, 3, 4, 5, 6].map((n) => [n, n])} onChange={(value) => change('count', Number(value))} />
            <Select label="Núcleos en paralelo" value={config.cores} options={[2, 3, 4].map((n) => [n, n])} onChange={(value) => change('cores', Number(value))} />
            <Select label="CPU por tarea" value={config.cpu} options={[200, 400, 600, 1000].map((n) => [n, `${n} ms`])} onChange={(value) => change('cpu', Number(value))} />
            <Select label="I/O por tarea" value={config.io} options={[200, 400, 600, 1000, 1600].map((n) => [n, `${n} ms`])} onChange={(value) => change('io', Number(value))} />
            <Select label="Costo de cambio" value={config.switchCost} options={[0, 50, 100, 200, 400].map((n) => [n, `${n} ms`])} onChange={(value) => change('switchCost', Number(value))} />
            <Select label="Velocidad de animación" value={speed} options={[[.5, 'Muy lenta'], [1, 'Guiada'], [2, 'Normal'], [4, 'Rápida']]} onChange={(value) => setSpeed(Number(value))} />
          </div>
          <div className="sim-actions">
            <button type="button" disabled={playing && elapsed < limit} onClick={() => {
              if (elapsed >= limit) setElapsed(0);
              setPlaying(true);
            }}>Reproducir</button>
            <button type="button" disabled={!playing || elapsed >= limit} onClick={() => setPlaying(false)}>Pausar</button>
            <button type="button" onClick={reset}>Reiniciar</button>
            <button type="button" disabled={previousTime === undefined} onClick={() => goToStep(previousTime)}>Paso anterior</button>
            <button type="button" disabled={nextTime === undefined} onClick={() => goToStep(nextTime)}>Siguiente evento</button>
          </div>
          <div className="sim-actions">
            <label><input type="checkbox" checked={show} onChange={(event) => setShow(event.target.checked)} /> Mostrar cambios de contexto</label>
            <label><input type="checkbox" checked={view2D || reduced} disabled={reduced} onChange={(event) => setView2D(event.target.checked)} /> Vista 2D</label>
            <label><input type="checkbox" checked={compare} onChange={(event) => { reset(); setCompare(event.target.checked); }} /> Comparar</label>
            {compare && <Select label="Escenario de comparación" value={other} options={scenarioOptions}
              onChange={(value) => { reset(); setOther(value); }} />}
            <button type="button" onClick={toggleFullscreen}>
              {fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            </button>
            {fullscreenError && <span role="status">El navegador no permitió abrir la pantalla completa.</span>}
          </div>
        </div>
      </div>
      <div className="sim-results">
        {[{ name: scenarios[mode], view: frame, total: result.total }, ...(comparison ? [{ name: scenarios[other], view: secondFrame, total: comparison.total }] : [])]
          .map(({ name, view, total }, index) => (
            <dl key={index}>
              <div><dt>{name} · total</dt><dd>{total} ms</dd></div>
              <div><dt>CPU ocupada</dt><dd>{view.busy} ms·núcleo</dd></div>
              <div><dt>CPU ociosa</dt><dd>{view.idle} ms·núcleo</dd></div>
              {show && <div><dt>Cambios de contexto</dt><dd>{view.switches}</dd></div>}
              <div><dt>Tareas completadas</dt><dd>{view.done}/{config.count}</dd></div>
              {index === 1 && <div><dt>Espera por tarea</dt><dd>{view.tasks.map(({wait}, id) => `T${id + 1}: ${wait} ms`).join(' · ')}</dd></div>}
            </dl>
          ))}
      </div>
      <Gantt result={result} title={scenarios[mode]} duration={limit} time={time} show={show} />
      {comparison && <Comparison first={result} second={comparison} mode={mode} other={other}
        time={time} show={show} cpuOnly={config.workload === 'cpu'} />}
      <p className="sim-legend">Gantt: color de tarea = CPU útil · gris = núcleo ocioso · rayado rojo = hilo bloqueado{show && ' · ámbar = cambio de contexto'}.</p>
    </section>
  );
}

