import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROSTER, SPEAKERS } from '../../src/characters/roster.js';
import { SPAWNS, VICTORY_SPOTS, DESKS } from '../../src/missions/mission1/layout.js';
import { useGame } from '../../src/game/store.js';
import { world } from '../../src/game/world.js';

test('four characters: GPT, Gemi, Copilot, Claude (no fighter)', () => {
  assert.deepEqual(ROSTER.map((c) => c.name), ['GPT', 'Gemi', 'Copilot', 'Claude']);
  assert.deepEqual(ROSTER.map((c) => c.id), ['mastermind', 'joker', 'boss', 'commentator']);
  assert.ok(!ROSTER.some((c) => c.id === 'fighter'));
  for (const c of ROSTER) { assert.ok(c.skill && c.tagline, c.id); assert.equal(SPEAKERS[c.id].name, c.name); }
});

test('the world, spawns and victory spots are sized for four characters', () => {
  assert.equal(world.chars.length, 4);
  assert.equal(SPAWNS.length, 4);
  assert.equal(VICTORY_SPOTS.length, 4);
  assert.ok(DESKS.length >= ROSTER.length, 'every character has a desk');
});

test('only keys 1-4 switch characters', () => {
  const g = useGame.getState();
  assert.equal(g.switchCharacter(3), true);
  assert.equal(useGame.getState().active, 3);
  assert.equal(useGame.getState().switchCharacter(4), false);
  assert.equal(useGame.getState().active, 3);
  useGame.getState().switchCharacter(0);
});

test('player-facing names use Latin script only (no Cyrillic)', () => {
  const text = JSON.stringify([ROSTER, SPEAKERS]);
  assert.ok(!/[\u0400-\u04FF]/.test(text));
});
