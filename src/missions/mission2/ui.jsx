import React, { useEffect, useState } from 'react';
import { useGame } from '../../game/store.js';
import { sfx } from '../../game/audio.js';
import { CLAIMS, SOURCES, sourcesFor } from './factCheck.js';
import { submitFactCheck, startGroundedSequence } from './logic.js';

// ---------------------------------------------------------------- energy meter (HUD)
export function CaffeineMeter() {
  const caffeine = useGame((s) => Math.round(s.ms.caffeine ?? 100));
  const doorOpen = useGame((s) => s.doorOpen);
  const level = doorOpen ? 100 : caffeine;
  const low = level < 25;
  const color = level > 50 ? '#22c55e' : level > 25 ? '#facc15' : '#ef4444';
  return (
    <div className={`caffeine ${low ? 'low' : ''}`} data-testid="caffeine">
      <span>⚡ ENERGIJA</span>
      <div className="caffeine-bar"><div style={{ width: `${level}%`, background: color }} /></div>
      <b>{level}%</b>
      {low && <em>SPAVA TI SE… pojedi nešto!</em>}
    </div>
  );
}

// ---------------------------------------------------------------- nap overlay (failure state)
export function NapOverlay() {
  const napping = useGame((s) => s.ms.napping);
  if (!napping) return null;
  return (
    <div className="nap-overlay" data-testid="nap-overlay">
      <div className="zzz"><span>Z</span><span>z</span><span>z</span></div>
      <div className="nap-text">ZASPALI STE NA ČASU</div>
    </div>
  );
}

// ---------------------------------------------------------------- fact-check station
const VERDICTS = [[true, '✔ TAČNO'], [false, '✖ NETAČNO (halucinacija)']];
const NONE = {};

const STATUS_TEXT = {
  ok: '✔ provjereno',
  lucky: '⚠ tačan odgovor, ali nepouzdan izvor',
  unreliable: '✖ nepouzdan izvor',
  wrong: '✖ izvor kaže suprotno',
  missing: '✖ nije odgovoreno',
};

/**
 * One claim at a time, two explicit steps:
 *   STEP 1  pick ONE source you trust   (radio-style)
 *   STEP 2  decide TRUE or FALSE         (unlocks after step 1)
 * A progress bar shows all five claims; SUBMIT unlocks when every claim is answered.
 */
export function FactChecker() {
  const inventory = useGame((s) => s.inventory);
  const answers = useGame((s) => s.ms.answers || NONE);
  const attempts = useGame((s) => s.attempts);
  const [current, setCurrent] = useState(0);
  const [result, setResult] = useState(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!result) return;
    let i = 0;
    const id = setInterval(() => {
      i += 3; setTyped(result.output.slice(0, i));
      if (i >= result.output.length) { clearInterval(id); setBusy(false); }
    }, 14);
    return () => clearInterval(id);
  }, [result]);

  const setAnswer = (claimId, patch) => {
    sfx.interact();
    useGame.getState().patchMs((m) => ({ answers: { ...m.answers, [claimId]: { ...(m.answers?.[claimId] || {}), ...patch } } }));
  };
  const isDone = (c) => !!answers[c.id]?.source && typeof answers[c.id]?.verdict === 'boolean';
  const doneCount = CLAIMS.filter(isDone).length;

  const onSubmit = () => {
    if (busy || doneCount < CLAIMS.length) return;
    setBusy(true); setTyped(''); setResult(null);
    setTimeout(() => {
      const r = submitFactCheck();
      setResult(r);
      if (r.success) setTimeout(() => startGroundedSequence(), 5200);
    }, 700);
  };

  const showStatus = result && !result.success && attempts >= 2;
  const reliableFound = inventory.filter((k) => SOURCES[k]?.reliable).length;
  const c = CLAIMS[current];
  const a = answers[c.id] || {};
  const options = sourcesFor(c.id, inventory);
  const status = showStatus ? result.results[c.id] : null;
  const isLast = current === CLAIMS.length - 1;

  return (
    <div className="builder-wrap" data-testid="fact-checker">
      <div className="builder factcheck">
        <div className="builder-head">
          <div>
            <div className="builder-title">STANICA ZA PROVJERU ČINJENICA <span>// prizemljujemo SNACK-O-MAT</span></div>
            <div className="builder-sub how">
              Za svaku od 5 tvrdnji: <b>① izaberi JEDAN izvor kojem vjeruješ</b>, pa <b>② odluči da li je tvrdnja TAČNA ili NETAČNA</b>.
              Odgovori na svih 5, pa pošalji. Pouzdanih dokaza do sada: <b>{reliableFound}/5</b>.
            </div>
          </div>
          <button className="btn small" onClick={() => useGame.getState().closeBuilder()} data-testid="builder-close">✕ Zatvori (Esc)</button>
        </div>

        <div className="claim-tabs" role="tablist" aria-label="Tvrdnje">
          {CLAIMS.map((cl, i) => {
            const st = showStatus ? result.results[cl.id] : null;
            return (
              <button key={cl.id} role="tab" aria-selected={i === current} data-testid={`claim-tab-${cl.id}`}
                className={`claim-tab ${i === current ? 'current' : ''} ${isDone(cl) ? 'done' : ''} ${st ? (st === 'ok' ? 'ok' : 'bad') : ''}`}
                onClick={() => setCurrent(i)}>
                <b>{i + 1}</b>{isDone(cl) ? ' ✓' : ''}
              </button>
            );
          })}
        </div>

        <div className={`claim one ${status ? (status === 'ok' ? 'ok' : 'bad') : ''}`} data-testid={`claim-${c.id}`}>
          <div className="claim-count">Tvrdnja {current + 1} od {CLAIMS.length}{status && <em className="claim-status"> · {STATUS_TEXT[status]}</em>}</div>
          <div className="claim-text big">SNACK-O-MAT kaže: „{c.text}“</div>

          <div className="step">
            <div className="step-title"><span className="step-num">1</span> Kojem <u>jednom</u> izvoru vjeruješ? <small>Pogledaj ko ga je napisao.</small></div>
            <div className="sources" role="radiogroup">
              {options.map((sid) => {
                const src = SOURCES[sid];
                const sel = a.source === sid;
                return (
                  <button key={sid} role="radio" aria-checked={sel} data-testid={`src-${c.id}-${sid}`} disabled={busy}
                    className={`source ${sel ? 'sel' : ''}`} style={{ '--c': src.color }}
                    onClick={() => setAnswer(c.id, { source: sid })}>
                    <span className="radio" aria-hidden="true" />
                    <b>{src.title}</b>
                    <small>Autor: {src.author}</small>
                    <span className="says">„{src.claims[c.id]}“</span>
                  </button>
                );
              })}
            </div>
            {!options.some((sid) => SOURCES[sid].reliable) && (
              <div className="source-missing">🔍 Za ovu tvrdnju imaš samo materijale samog SNACK-O-MAT-a (ili glasine). Prvo nađi pravi dokaz u hodniku: svaki izvor otključava jedan od likova.</div>
            )}
          </div>

          <div className={`step ${a.source ? '' : 'locked'}`}>
            <div className="step-title"><span className="step-num">2</span> Prema tom izvoru, tvrdnja je…{!a.source && <small> prvo izaberi izvor</small>}</div>
            <div className="verdicts">
              {VERDICTS.map(([v, label]) => (
                <button key={label} data-testid={`verdict-${c.id}-${v}`} disabled={busy || !a.source}
                  className={`verdict ${v ? 'true' : 'false'} ${a.verdict === v ? 'sel' : ''}`}
                  onClick={() => setAnswer(c.id, { verdict: v })}>{label}</button>
              ))}
            </div>
          </div>

          <div className="claim-nav">
            <button className="btn small" disabled={current === 0} onClick={() => setCurrent(current - 1)} data-testid="claim-prev">◀ Prethodna</button>
            {!isLast && <button className={`btn ${isDone(c) ? 'primary pulse' : ''}`} onClick={() => setCurrent(current + 1)} data-testid="claim-next">Sljedeća tvrdnja ▶</button>}
          </div>
        </div>

        <div className="builder-foot">
          <button className="btn primary big" onClick={onSubmit} disabled={busy || doneCount < CLAIMS.length} data-testid="submit-factcheck">
            {busy && !result ? 'SNACK-O-MAT PREGLEDA…' : '⚡ POŠALJI PROVJERU'}
          </button>
          <span className="muted">{doneCount < CLAIMS.length ? `Odgovoreno: ${doneCount} od ${CLAIMS.length}` : 'Sve tvrdnje su odgovorene!'} · Pokušaja: {attempts}</span>
        </div>

        {(result || busy) && (
          <div className={`ai-output ${result ? (result.success ? 'success' : 'fail') : ''}`} data-testid="ai-output">
            <div className="ai-head">{!result ? 'ANALIZIRAM…' : result.success ? `✅ SVE TVRDNJE PROVJERENE — TAČNOST ${result.score}%` : `❌ PROVJERA ODBIJENA — TAČNOST ${result.score}%`}</div>
            <pre>{typed}</pre>
            {result?.success && <div className="ai-foot">Izbacujem užinu… otključavam hodnik ka arhivi…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
