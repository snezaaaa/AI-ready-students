import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAIMS, SOURCES, evaluateFactCheck, sourcesFor, RELIABLE_IDS } from '../../src/missions/mission2/factCheck.js';
import { ROSTER } from '../../src/characters/roster.js';

const ALL = Object.keys(SOURCES);
const perfect = Object.fromEntries(CLAIMS.map((c) => [c.id, { verdict: c.truth, source: c.reliable }]));

test('perfect fact-check succeeds at 100%', () => {
  const r = evaluateFactCheck(perfect, ALL);
  assert.equal(r.success, true);
  assert.equal(r.score, 100);
  assert.match(r.output, /se oslanjam na izvore/i);
});

test('mix of true and hallucinated claims (AI is not always wrong)', () => {
  assert.ok(CLAIMS.some((c) => c.truth) && CLAIMS.some((c) => !c.truth));
});

test('citing the machine\'s own brochure is rejected even with the right verdict', () => {
  const r = evaluateFactCheck({ ...perfect, c1: { verdict: false, source: 'brochure' } }, ALL);
  assert.equal(r.success, false);
  assert.equal(r.results.c1, 'lucky');
  assert.equal(r.score, 80);
});

test('unreliable source with wrong verdict is flagged as unreliable and taunted', () => {
  const r = evaluateFactCheck({ ...perfect, c3: { verdict: true, source: 'brochure' } }, ALL);
  assert.equal(r.results.c3, 'unreliable');
  assert.match(r.output, /MOJ letak/);
});

test('reliable source but wrong verdict is "wrong"', () => {
  const r = evaluateFactCheck({ ...perfect, c2: { verdict: false, source: 'label' } }, ALL);
  assert.equal(r.results.c2, 'wrong');
});

test('a source that was not collected counts as missing', () => {
  const r = evaluateFactCheck(perfect, ALL.filter((k) => k !== 'cctv'));
  assert.equal(r.results.c5, 'missing');
  assert.equal(r.score, 80);
});

test('a source cannot be cited for a claim it says nothing about', () => {
  const r = evaluateFactCheck({ ...perfect, c1: { verdict: false, source: 'label' } }, ALL);
  assert.equal(r.results.c1, 'missing');
});

test('every claim has exactly one reliable source and at least one decoy', () => {
  for (const c of CLAIMS) {
    const opts = sourcesFor(c.id, ALL);
    assert.equal(opts.filter((k) => SOURCES[k].reliable).length, 1, c.id);
    assert.ok(opts.some((k) => !SOURCES[k].reliable), c.id);
    assert.equal(opts.find((k) => SOURCES[k].reliable), c.reliable);
  }
  assert.equal(RELIABLE_IDS.length, 5);
});

test('two claims are true and three are hallucinations', () => {
  assert.equal(CLAIMS.filter((c) => c.truth).length, 2);
  assert.equal(CLAIMS.filter((c) => !c.truth).length, 3);
});

test('three unreliable decoys: the machine\'s leaflet, a TikTok screenshot and a rumour', () => {
  assert.deepEqual(Object.keys(SOURCES).filter((k) => !SOURCES[k].reliable).sort(), ['brochure', 'rumor', 'tiktok']);
});

test('every reliable source needs one of the four characters; everyone has 1-2 tasks', () => {
  const ids = ROSTER.map((c) => c.id);
  const count = Object.fromEntries(ids.map((id) => [id, 0]));
  for (const k of RELIABLE_IDS) {
    assert.ok(ids.includes(SOURCES[k].who), `${k} -> ${SOURCES[k].who}`);
    count[SOURCES[k].who]++;
  }
  for (const id of ids) assert.ok(count[id] >= 1 && count[id] <= 2, `${id}: ${count[id]}`);
});
