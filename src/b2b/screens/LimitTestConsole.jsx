import React, { useEffect, useRef, useState } from 'react';
import { LIMIT_TESTS, runLimitTest } from '../limitTests.js';
import { WALKTHROUGHS, ADMIN_ONLY } from '../walkthrough/scripts.js';
import { LimitWalkthrough } from './LimitWalkthrough.jsx';
import './LimitTestConsole.css';

// Order limit test console (#/b2b/order-limit-tests): every test case with its
// code and a Run button, and a command line. Running a case (its button, or
// typing its code) plays the case's walkthrough — a cursor
// sets it up in the admin and shows the result on the storefront (LimitWalkthrough)
// — then prints what the screens showed and the engine's own checks. A case
// with no walkthrough runs its engine checks only.
export function LimitTestConsole() {
  const [command, setCommand] = useState('');
  const [log, setLog] = useState([]);
  const [walk, setWalk] = useState(null); // { id, test, started } while a walkthrough is on
  const input = useRef(null);
  const logBox = useRef(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    if (logBox.current) logBox.current.scrollTop = logBox.current.scrollHeight;
  }, [log]);

  const busy = !!walk && log.some((x) => x.id === walk.id && x.running);
  const run = (raw) => {
    const code = raw.trim().toUpperCase();
    if (!code) return;
    const id = `${Date.now()}-${log.length}`;
    const test = LIMIT_TESTS.find((t) => t.code === code);
    if (!test) {
      setLog((l) => [...l, { id, code, error: `No test case “${code}”. Codes run from ${LIMIT_TESTS[0].code} to ${LIMIT_TESTS[LIMIT_TESTS.length - 1].code}.` }]);
      return;
    }
    setLog((l) => [...l, { id, code, test, running: true }]);
    if (WALKTHROUGHS[code]) {
      setWalk({ id, test, started: performance.now() });
      return;
    }
    // Show "Running" first: the large-store case takes a few seconds.
    setTimeout(() => {
      const engine = runLimitTest(test);
      const result = { ...engine, groups: [{ title: 'Engine', checks: engine.checks }], note: test.note || 'No walkthrough for this case.' };
      setLog((l) => l.map((e) => (e.id === id ? { ...e, running: false, result } : e)));
    }, 30);
  };
  // A walkthrough ended: what the screens showed, then the engine's checks.
  const finish = ({ checks, stopped, error }) => {
    const engine = runLimitTest(walk.test);
    const onScreen = checks.length > 0 && checks.every((c) => c.pass);
    const result = {
      groups: [{ title: 'On screen', checks }, { title: 'Engine', checks: engine.checks }],
      pass: !stopped && !error && onScreen && engine.pass,
      ms: performance.now() - walk.started,
      error: error || engine.error,
      note: stopped ? 'Stopped before the end.' : null,
    };
    setLog((l) => l.map((e) => (e.id === walk.id ? { ...e, running: false, result } : e)));
  };

  return (
    <s-page heading="Order limit tests">
      <s-stack gap="base">
        <s-paragraph color="subdued">
          Click Run next to a case, or type its code and press Enter. A cursor sets the case up in the admin and shows what the buyer gets on the storefront, both starting from the sample data in their own space (your prototype data isn’t touched). Then the console lists what the screens showed and the engine’s own checks.
        </s-paragraph>

        <div className="ltc-terminal" onClick={() => input.current?.focus()}>
          <div className="ltc-log" ref={logBox} aria-live="polite">
            {log.map((e) => (
              <div className="ltc-entry" key={e.id}>
                <div className="ltc-cmd">› {e.code}</div>
                {e.error ? (
                  <div className="ltc-error">{e.error}</div>
                ) : (
                  <>
                    <div className="ltc-head">
                      <span className={`ltc-badge ${e.running ? 'run' : e.result.pass ? 'pass' : 'fail'}`}>{e.running ? 'RUNNING' : e.result.pass ? 'PASS' : 'FAIL'}</span>
                      <span>{e.test.title}</span>
                      {!e.running && (
                        <span className="ltc-time">
                          {(() => {
                            const all = e.result.groups.flatMap((g) => g.checks);
                            const ms = e.result.ms;
                            return `${all.filter((c) => c.pass).length}/${all.length} checks · ${ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`}`;
                          })()}
                        </span>
                      )}
                    </div>
                    {e.running && walk?.id === e.id && <div className="ltc-detail">Walkthrough playing…</div>}
                    {!e.running && e.result.note && <div className="ltc-detail">{e.result.note}</div>}
                    {!e.running && e.result.error && <div className="ltc-error">{`Error: ${e.result.error}`}</div>}
                    {!e.running &&
                      e.result.groups.map((g) => (
                        <React.Fragment key={g.title}>
                          <div className="ltc-group">{g.title}</div>
                          {g.checks.map((c, i) => (
                            <div className="ltc-check" key={i}>
                              <span className={`mark ${c.pass ? 'pass' : 'fail'}`} aria-label={c.pass ? 'Passed' : 'Failed'}>{c.pass ? '✓' : '✕'}</span>
                              <div>
                                <div>{c.label}</div>
                                {c.pass ? (
                                  <div className="ltc-detail">{c.actual}</div>
                                ) : (
                                  <>
                                    <div className="ltc-detail">expected: <b>{c.expected}</b></div>
                                    <div className="ltc-detail">actual: <b>{c.actual}</b></div>
                                  </>
                                )}
                              </div>
                            </div>
                          ))}
                        </React.Fragment>
                      ))}
                  </>
                )}
              </div>
            ))}
          </div>
          <label className="ltc-prompt">
            <span aria-hidden="true">›</span>
            <input
              ref={input}
              disabled={busy}
              id="limit-test-command"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  run(command);
                  setCommand('');
                }
              }}
              placeholder="Enter a test code, e.g. OL-02"
              aria-label="Test code"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        </div>

        <s-section padding="none">
          <s-table>
            <s-table-header-row>
              <s-table-header listSlot="primary">Code</s-table-header>
              <s-table-header listSlot="labeled">Case</s-table-header>
              <s-table-header listSlot="labeled">Passes when</s-table-header>
              <s-table-header listSlot="secondary">Covers</s-table-header>
            </s-table-header-row>
            <s-table-body>
              {LIMIT_TESTS.map((t) => (
                <s-table-row key={t.code}>
                  <s-table-cell>
                    <span className="ltc-code">{t.code}</span>
                  </s-table-cell>
                  <s-table-cell>
                    <s-stack direction="inline" gap="small-200" alignItems="center">
                      <span>{t.title}</span>
                      <s-button icon="play" variant="tertiary" disabled={busy} onClick={() => run(t.code)} accessibilityLabel={`Run ${t.code}`}>Run</s-button>
                    </s-stack>
                  </s-table-cell>
                  <s-table-cell>
                    <div style={{ whiteSpace: 'normal', maxWidth: 440 }}>{t.expect}</div>
                  </s-table-cell>
                  <s-table-cell>
                    <s-badge>{t.ref}</s-badge>
                  </s-table-cell>
                </s-table-row>
              ))}
            </s-table-body>
          </s-table>
        </s-section>
      </s-stack>
      {walk && (
        <LimitWalkthrough
          key={walk.id}
          test={walk.test}
          script={WALKTHROUGHS[walk.test.code]}
          storefront={!ADMIN_ONLY.has(walk.test.code)}
          onDone={finish}
          onRestart={() => {
            setWalk((w) => ({ ...w, started: performance.now() }));
            setLog((l) => l.map((e) => (e.id === walk.id ? { ...e, running: true, result: null } : e)));
          }}
          onClose={() => {
            setWalk(null);
            setTimeout(() => input.current?.focus(), 0);
          }}
        />
      )}
    </s-page>
  );
}
