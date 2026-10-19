import React, { useEffect, useRef, useState } from 'react';
import { createDriver, STOPPED } from '../walkthrough/driver.js';
import { clearDemoState } from '../../shared/persistence.js';
import { activeVersion } from '../../shared/versions.js';
import './LimitWalkthrough.css';

// A page of this prototype opened in demo mode (its own storage, see persistence.js).
function demoUrl(app) {
  const dev = window.location.pathname.startsWith('/src/');
  const params = new URLSearchParams({ v: activeVersion(), demo: '1' });
  if (app === 'admin') params.set('embed', 'limits');
  const path = app === 'admin' ? (dev ? '/src/b2b/index.html' : '/b2b/') : dev ? '/src/storefront/index.html' : '/storefront/';
  return `${path}?${params}`;
}

// The order-limit walkthrough stage (test console): the admin's Order limits
// (left) and the storefront (right), both live and starting from the sample
// data, with a cursor that sets the case up and shows what the buyer gets.
// `onDone({ checks, stopped, error })` once it ends; `onClose` closes the stage.
// Pause holds it at its next step; Restart reloads both pages from the sample data
// and plays it again (`onRestart` first).
// A case whose result is only in the admin (`storefront` false) shows the admin alone.
export function LimitWalkthrough({ test, script, storefront = true, onDone, onRestart, onClose }) {
  // Empty the demo storage before the two pages load, so both start fresh.
  useState(() => clearDemoState());
  const [caption, setCaption] = useState('Loading the admin and the storefront…');
  const [pane, setPane] = useState('admin');
  const [result, setResult] = useState(null);
  const [paused, setPaused] = useState(false);
  const [attempt, setAttempt] = useState(0); // each Restart reloads the pages (their key)
  const stage = useRef(null);
  const cursor = useRef(null);
  const ring = useRef(null);
  const admin = useRef(null);
  const store = useRef(null);
  const stopAsked = useRef(false);
  const pausedNow = useRef(false);
  const checksNow = useRef([]); // what the screens showed so far, for a Close midway
  const run = useRef(0);

  const togglePause = () => {
    pausedNow.current = !pausedNow.current;
    setPaused(pausedNow.current);
  };
  const restart = () => {
    stopAsked.current = true; // the run on now ends at its next step
    pausedNow.current = false;
    clearDemoState();
    setPaused(false);
    setResult(null);
    setCaption('Loading the admin and the storefront…');
    setPane('admin');
    if (ring.current) ring.current.hidden = true;
    onRestart?.();
    setAttempt((a) => a + 1);
  };

  useEffect(() => {
    const mine = (run.current += 1);
    stopAsked.current = false;
    checksNow.current = [];
    const stopped = () => run.current !== mine || stopAsked.current;
    const ready = (f) => !!f.current?.contentWindow?.__qsDemo;
    (async () => {
      let error = null;
      let checks = [];
      try {
        const until = Date.now() + 25000;
        while (!(ready(admin) && (!storefront || ready(store)))) {
          if (stopped()) throw STOPPED;
          if (Date.now() > until) throw new Error('The admin or the storefront didn’t load.');
          await new Promise((r) => setTimeout(r, 150));
        }
        await new Promise((r) => setTimeout(r, 700));
        const d = createDriver({
          frames: { admin: admin.current, store: storefront ? store.current : null },
          stage: stage.current,
          cursor: cursor.current,
          ring: ring.current,
          say: (t) => !stopped() && setCaption(t),
          showPane: (p) => !stopped() && setPane(p),
          stopped,
          paused: () => pausedNow.current,
        });
        checks = d.checks;
        checksNow.current = d.checks;
        await script(d);
      } catch (e) {
        if (e !== STOPPED) error = e?.message || String(e);
      }
      if (run.current !== mine) return; // replaced (or closed) meanwhile
      const out = { checks, stopped: stopAsked.current, error };
      const pass = !out.stopped && !error && checks.length > 0 && checks.every((c) => c.pass);
      setResult({ ...out, pass });
      setCaption(out.stopped ? 'Stopped.' : error ? `Couldn’t finish: ${error}` : `${pass ? 'PASS' : 'FAIL'} · ${checks.filter((c) => c.pass).length}/${checks.length} checks on screen. The engine checks are in the console.`);
      onDone(out);
    })();
    return () => {
      run.current += 1;
    };
  }, [attempt]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close works any time: one still playing ends here, as stopped, with what the
  // screens showed so far.
  const close = () => {
    if (!result) {
      run.current += 1;
      onDone({ checks: checksNow.current, stopped: true, error: null });
    }
    onClose();
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="lwt" role="dialog" aria-modal="true" aria-label={`Walkthrough ${test.code}: ${test.title}`}>
      <div className="lwt-bar">
        <div className="lwt-title">
          <b>{test.code}</b>
          {test.title}
        </div>
        <div className={`lwt-caption${result ? (result.pass ? ' is-pass' : ' is-fail') : ''}`} aria-live="polite" title={caption}>
          {caption}
        </div>
        <div className="lwt-actions">
          {result ? null : (
            <button type="button" onClick={togglePause} aria-pressed={paused}>{paused ? 'Resume' : 'Pause'}</button>
          )}
          <button type="button" onClick={restart}>Restart</button>
          <button type="button" onClick={close}>Close</button>
        </div>
      </div>
      <div className={`lwt-stage${storefront ? '' : ' lwt-stage--admin-only'}`} ref={stage}>
        <section className={`lwt-pane${pane === 'admin' ? ' is-active' : ''}`}>
          <header>Admin · Order limits</header>
          <iframe key={attempt} ref={admin} title="Admin" src={demoUrl('admin')} />
        </section>
        {storefront && (
          <section className={`lwt-pane${pane === 'store' ? ' is-active' : ''}`}>
            <header>Storefront · John Nguyen, ABC Construction · Hanoi</header>
            <iframe key={attempt} ref={store} title="Storefront" src={demoUrl('store')} />
          </section>
        )}
        <div className="lwt-ring" ref={ring} hidden />
        <div className="lwt-cursor" ref={cursor} aria-hidden="true">
          <svg viewBox="0 0 22 22">
            <path d="M3 2 L3 18 L7.6 13.8 L10.6 20.4 L13.4 19.2 L10.5 12.7 L16.6 12.7 Z" fill="#ffffff" stroke="#111111" strokeWidth="1.4" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
