// Mission 3 — KONAČNI SERTIFIKAT
// The school archive, guarded by ARHIVAR and its 4,000-slide presentation.
//  1. Hall of Seals: four responsible-AI dilemmas for students, each opened by one character (3 strikes = lockdown).
//  2. Sensor corridor: blinking gates + low sweeping beams to jump over.
//  3. Archive core: Claude powers the console; write the FINAL PROMPT (RTCF + guardrails).
import { useGame } from '../../game/store.js';
import { world, emote, placeCharacters } from '../../game/world.js';
import { sfx } from '../../game/audio.js';
import { ROSTER, indexOfChar } from '../../characters/roster.js';
import { SEALS, sealById, answerSeal, STRIKES_FOR_LOCKDOWN } from './dilemmas.js';
import { evaluateFinalPrompt, hasAllSeals, HINTS } from './finalPrompt.js';
import { LASERS, laserState, laserHits, checkpointFor, CORRIDOR, dangerZone } from './lasers.js';
import { SEAL_POS, PROPS, SPAWNS, CORE_SPOTS, VICTORY_SPOTS, CORE_ENTRY_Z } from './layout.js';

const G = () => useGame.getState();
const say = (lines, opts) => G().say(lines, opts);
const activeId = () => ROSTER[G().active].id;
const ms = () => G().ms;

export const initialState = () => ({
  modal: null, seal: null, wrongPicks: {}, lastAnswer: null,
  strikes: 0, lockdowns: 0, lockdown: false,
  zaps: 0, furthestZ: 1, lastZapAt: -99, corridorHint: false,
  teamInCore: false, consoleOn: false,
});

// ---------------------------------------------------------------- seals
const WRONG_FLAVOR = {
  mastermind: 'Pečat me je skenirao i rekao: „previše priča“.',
  joker: 'Ispričao sam pečatu vic. Rekao je: „PRISTUP ODBIJEN. A NIJE NI SMIJEŠNO.“',
  boss: 'Ponudio sam mu dogovor. Ovaj pečat ne pregovara.',
  commentator: 'Ljubazno sam ga zamolio. Ljubazno me je odbio.',
};
const SEAL_WIN = {
  privacy: { who: 'boss', mood: 'serious', text: 'Lični podaci idu u fasciklu „NE DIJELI“. I tvoji i tuđi. Javni chatbot nije na spisku onih koji treba da znaju.' },
  integrity: { who: 'mastermind', mood: 'smug', text: 'AI može da ti pomogne da misliš. Ne može da misli umjesto tebe. To čak i ja priznajem. A ja rijetko šta priznajem.' },
  bias: { who: 'joker', mood: 'grin', text: 'Inženjer Marko, naučnik Marko, astronaut Marko... šala se sama piše, a NIJE smiješna. Ispravljeno.' },
  oversight: { who: 'commentator', mood: 'happy', text: 'Ko predaje, taj i odgovara. Zato prvo provjerimo. Mirno i pažljivo.' },
};
const ADMIN_WRONG = [
  'NETAČNO. Divno. Dodajem četrdeset slajdova u vašu prezentaciju.',
  'Zanimljiv izbor. Zabrinjavajuće zanimljiv. Greška upisana.',
  'A, pristup „samo brzo, pa šta bude“. Greška.',
];

function openModal(modal, extra = {}) {
  G().patchMs({ modal, lastAnswer: null, ...extra });
  G().clearDialogue();
  G().openBuilder();
  document.exitPointerLock?.();
}
export function closeModal() {
  G().closeBuilder();
  G().patchMs({ modal: null, lastAnswer: null });
}

function sealInteractable(seal) {
  const p = SEAL_POS[seal.id];
  return {
    id: `seal_${seal.id}`, x: p.x + (p.x < 0 ? 1.4 : -1.4), z: p.z, r: 1.8,
    label: (s) => (s.inventory.includes(seal.id) ? `Pečat ${seal.label} je osvojen` : `Otključaj pečat ${seal.label}`),
    use: () => {
      if (G().inventory.includes(seal.id)) return say({ who: activeId(), text: `Pečat ${seal.label} ponosno sija. I treba.` }, { interrupt: true });
      if (activeId() !== seal.who) {
        sfx.deny();
        emote(G().active, 'shrug', 1.6);
        const owner = ROSTER[indexOfChar(seal.who)];
        return say({ who: activeId(), mood: 'sad', text: `${WRONG_FLAVOR[activeId()]} Pečat ${seal.label} otvara ${owner.name}. (${seal.key})` }, { interrupt: true });
      }
      sfx.interact();
      openModal('seal', { seal: seal.id });
    },
  };
}

/** Called by the seal dilemma UI. Returns the answerSeal() result. */
export function chooseSealOption(sealId, optionId) {
  const r = answerSeal(sealId, optionId);
  const seal = sealById(sealId);
  G().patchMs({ lastAnswer: { optionId, ...r } });
  if (r.correct) {
    G().collect(sealId);
    sfx.pickup();
    emote(G().active, 'cheer', 2.5);
    G().showToast({ title: `PEČAT OSVOJEN: ${seal.label}`, body: `Otključano pravilo: „${seal.clause}“`, tip: r.why, color: seal.color });
    const n = SEALS.filter((s) => G().inventory.includes(s.id)).length;
    const lines = [SEAL_WIN[sealId]];
    if (n === SEALS.length) {
      lines.push(
        { who: 'admin', text: 'Sva četiri pečata? Hm. Barijera je... spuštena. Iza nje je Hodnik sa senzorima. Pazite na gležnjeve.' },
        { who: 'commentator', mood: 'excited', text: 'Barijera je pala! Niske zrake preskoči tasterom SPACE, a kod kapija sačekaj da se ugase.' },
      );
    } else {
      lines.push({ who: 'admin', text: `Pečat ${n} od 4. I dalje nisam impresioniran. Slajd 2 od 4.000 se učitava.` });
    }
    say(lines, { interrupt: true });
    return r;
  }
  // wrong answer: strike
  sfx.fail();
  world.alarm = 1;
  emote(G().active, 'facepalm', 2);
  const strikes = ms().strikes + 1;
  G().patchMs((m) => ({ strikes, wrongPicks: { ...m.wrongPicks, [sealId]: [...(m.wrongPicks[sealId] || []), optionId] } }));
  say({ who: 'admin', text: `${ADMIN_WRONG[(strikes - 1) % ADMIN_WRONG.length]} Greška ${strikes} od ${STRIKES_FOR_LOCKDOWN}.` }, { interrupt: true });
  if (strikes >= STRIKES_FOR_LOCKDOWN) setTimeout(startLockdown, 1800);
  return r;
}

// ---------------------------------------------------------------- lockdown (failure state)
function startLockdown() {
  if (ms().lockdown) return;
  closeModal();
  G().patchMs((m) => ({ lockdown: true, lockdowns: m.lockdowns + 1 }));
  world.cine = { mode: 'lockdown', t: 0 };
  G().setPhase('cutscene');
  sfx.siren(3);
  ROSTER.forEach((_, i) => emote(i, 'facepalm', 9));
  say([
    { who: 'system', text: 'TRI GREŠKE. ARHIVA SE ZAKLJUČAVA. POČINJE VANREDNI ČAS ODJELJENSKE ZAJEDNICE.', duration: 3.6 },
    { who: 'admin', text: 'Slajd 1: „Zašto su slajdovi važni“. Slajd 2: „Slajdovi, nastavak“. Slajd 3: fotografija ljudi koji se rukuju ispred laptopa.', duration: 4.4 },
    { who: 'narrator', text: '...Četiristo slajdova kasnije, ekipa je malo ostarila i nije naučila ništa novo. Greške su obrisane.', duration: 4 },
    { who: activeId(), mood: 'sad', text: 'Nikad više. Čitamo svaku dilemu pažljivo. Šta bi uradio odgovoran učenik?',
      then: () => {
        G().patchMs({ lockdown: false, strikes: 0 });
        world.cine = { mode: null, t: 0 };
        G().setPhase('playing');
      } },
  ], { interrupt: true });
}

// ---------------------------------------------------------------- lasers
export const EXEMPTION_AFTER = 4;   // zaps before the skip option appears (nobody gets stuck)
export const laserStates = LASERS.map((l) => laserState(l, 0));
if (typeof window !== 'undefined') { // for automated tests / debugging
  window.__lasers = laserStates;
  window.__laserDefs = LASERS.map((l) => ({ ...l, zone: dangerZone(l) }));
}

function updateLasers(st) {
  LASERS.forEach((l, i) => { laserStates[i] = laserState(l, world.time); });
  if (st.phase !== 'playing' || st.builderOpen) return;
  const c = world.chars[st.active];
  const inCorridor = c.z < CORRIDOR.maxZ && c.z > CORRIDOR.minZ;
  if (!inCorridor) return;
  if (c.z < ms().furthestZ - 0.2) G().patchMs({ furthestZ: c.z });
  if (!ms().corridorHint) {
    G().patchMs({ corridorHint: true });
    say({ who: 'mastermind', text: 'Kapije: sačekaj da budu TAMNE i mirne, pa prođi. Crvene zone SKOČI na podu: trči i pritisni SPACE tik prije zone.' }, { interrupt: true });
  }
  if (world.time - ms().lastZapAt < 0.8) return;
  const hitIdx = LASERS.findIndex((l, i) => laserHits(l, laserStates[i], c));
  if (hitIdx < 0) return;
  zap(c, st);
}

function zap(c, st) {
  const cp = checkpointFor(ms().furthestZ);
  Object.assign(c, { x: 0, z: cp, vx: 0, vz: 0, vy: 0, y: 0, grounded: true, stunUntil: world.time + 0.5 });
  world.cam.yaw = 0;
  world.alarm = 0.7;
  sfx.fail();
  emote(st.active, 'shrug', 1.2);
  const zaps = ms().zaps + 1;
  G().patchMs({ zaps, lastZapAt: world.time });
  const quips = [
    'BZZT! Senzor te je vidio. Vraćaš se na kontrolnu tačku.',
    'BZZT! Upisano u dnevnik. Nazad na kontrolnu tačku.',
    'BZZT! Tvoj prolazak je zabilježen. Glasno.',
  ];
  if (zaps === EXEMPTION_AFTER) {
    say([
      { who: 'admin', text: 'Četiri puta. Senzori mi se pregrijavaju. Nudim OPRAVDANJE: pritisni E ovdje, na kontrolnoj tački, i preskoči hodnik.' },
      { who: 'commentator', mood: 'excited', text: 'Ili probaj ponovo! Sačekaj tamne kapije i preskoči crvene zone. Možeš ti to.' },
    ], { interrupt: true });
  } else if (!G().dialogue.current) say({ who: 'admin', text: quips[zaps % quips.length], duration: 2.4 });
}

// ---------------------------------------------------------------- final prompt
export function testFinalPrompt() {
  const st = G();
  const result = evaluateFinalPrompt(st.selection, st.inventory);
  st.recordAttempt(result);
  if (result.success) { sfx.success(); return result; }
  sfx.fail();
  world.alarm = 1;
  emote(st.active, 'facepalm', 2);
  const first = result.wrong.includes('guardrails') ? 'guardrails' : result.wrong[0] || result.missing[0];
  say([
    { who: 'admin', text: `PROMPT ODBIJEN. Kvalitet: ${result.score}%. Znao sam da nećete uspjeti. Napravio sam i slajd o tome.` },
    { who: 'mastermind', text: `Pomoć: ${HINTS[first]}` },
  ], { interrupt: true });
  return result;
}

export function startVaultSequence() {
  const st = G();
  closeModal();
  st.openDoor();
  sfx.door();
  world.cine = { mode: 'vault', t: 0 };
  st.setPhase('cutscene');
  ROSTER.forEach((_, i) => emote(i, 'cheer', 8));
  say([
    { who: 'admin', text: 'Uloga. Zadatak. Kontekst. Format. Zaštitna pravila. Privatnost, poštenje, pravičnost... i čovjek koji provjerava. To je... to je zapravo dobar prompt.' },
    { who: 'admin', text: 'Dobro. Otvaram arhivu. Otkazujem slajdove od 2 do 4.000. ...Nedostajaće mi.' },
    { who: 'commentator', mood: 'excited', text: 'Arhiva! Je! Otvorena! Vidim ga: AI sertifikat, zlatan i sjajan!' },
    { who: 'boss', mood: 'shock', text: 'Je li to... zlatni okvir? Već mu tražim mjesto u tabeli.', then: startVictory },
  ], { interrupt: true });
}

export function startVictory() {
  const st = G();
  useGame.setState({ finishedAt: performance.now() });
  placeCharacters(VICTORY_SPOTS);
  ROSTER.forEach((_, i) => emote(i, 'dance', 90));
  world.cine = { mode: 'victory', t: 0 };
  st.setPhase('victory');
  sfx.success();
  setTimeout(() => sfx.success(), 1600);
  st.say([
    { who: 'system', text: 'NAPREDAK SERTIFIKATA: 100%. ČESTITAMO. OD DANAS STE... ODGOVORNI AI ISTRAŽIVAČI.' },
    { who: 'mastermind', mood: 'smug', text: 'Piši jasne prompte. Provjeri činjenice. Čuvaj podatke. Stoj iza svog rada. Sve po planu. Mom planu.' },
    { who: 'joker', mood: 'grin', text: 'Zahvaljujem štampaču, vitrini i naljepnici „0% MASTI“, koja nikad nije govorila istinu.' },
    { who: 'boss', mood: 'happy', text: 'Ovo ide u ram. A onda pravim tabelu svih uramljenih stvari.' },
    { who: 'commentator', mood: 'excited', text: 'I to je kraj! Tri misije, četiri AI pomoćnika i ti, koji sad znaš kako se AI koristi pametno. Bravo!',
      then: () => G().setPhase('complete') },
  ], { interrupt: true });
}

// ---------------------------------------------------------------- interactables
export const INTERACTABLES = [
  ...SEALS.map(sealInteractable),
  {
    id: 'exemption', x: 0, z: -0.9, r: 1.3,
    label: (s) => (s.ms.zaps >= EXEMPTION_AFTER && !s.ms.teamInCore ? 'Uzmi opravdanje (preskoči senzore)' : null),
    use: () => {
      sfx.success();
      const c = world.chars[G().active];
      Object.assign(c, { x: 0, z: CORE_ENTRY_Z - 0.6, vx: 0, vz: 0, y: 0, vy: 0, grounded: true });
      say({ who: 'admin', text: 'Opravdanje odobreno. Pečatirano, potpisano, zavedeno. Izvolite. I nemojte reći ostalim senzorima.' }, { interrupt: true });
    },
  },
  {
    id: 'barrier', x: 0, z: 1.3, r: 1.8,
    label: (s) => (hasAllSeals(s.inventory) ? null : 'Dodirni energetsku barijeru'),
    use: () => {
      sfx.deny();
      const n = SEALS.filter((s) => G().inventory.includes(s.id)).length;
      say([
        { who: 'admin', text: `BARIJERA AKTIVNA. Osvojeno pečata: ${n} od 4. Izvolite jedan besplatan strujni udar.` },
        { who: activeId(), mood: 'angry', text: 'Jao. Dobro. Prvo pečati.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'trophy', x: PROPS.trophy.x + 1.2, z: PROPS.trophy.z, r: 1.6,
    label: () => 'Pogledaj vitrinu sa peharima',
    use: () => {
      sfx.interact();
      say([
        { who: 'narrator', text: 'UČENIK GENERACIJE: PROMPTOTRON 3000 (dvanaest godina zaredom). DRUGO MJESTO: jedna spužva za tablu.' },
        { who: activeId(), mood: 'smug', text: 'Iskreno, spužva je više zaslužila.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'brewJr', x: PROPS.brewJr.x - 1.2, z: PROPS.brewJr.z, r: 1.6,
    label: () => 'Posjeti SNACK-O-MAT Junior',
    use: () => {
      sfx.pickup();
      emote(G().active, 'cheer', 1.4);
      say([
        { who: 'brew', text: 'Zdravo! Ja sam SNACK-O-MAT Junior. Jabuku? Činjenica: voda pomaže koncentraciji kad si dehidriran. Izvor: nastavnica biologije. Sad navodim sve izvore.' },
        { who: activeId(), mood: 'happy', text: 'Neko je baš odrastao. Lijepo je to vidjeti.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'console', x: PROPS.console.x, z: PROPS.console.z + 1.2, r: 1.8,
    label: (s) => (s.doorOpen ? null : !s.ms.consoleOn ? 'Uključi konzolu za KONAČNI PROMPT' : 'Napiši KONAČNI PROMPT'),
    use: () => {
      if (!ms().consoleOn) {
        if (activeId() !== 'commentator') {
          sfx.deny();
          return say({ who: activeId(), mood: 'sad', text: 'Na konzoli piše: „GLASOVNA POTVRDA: SAMO JASAN I PRISTOJAN GLAS.“ To je Claude. (4)' }, { interrupt: true });
        }
        sfx.success();
        emote(G().active, 'cheer', 2.5);
        G().patchMs({ consoleOn: true });
        return say([
          { who: 'commentator', mood: 'excited', text: 'Proba mikrofona. Jedan, dva. Dobar dan, arhivo. Konzolo za konačni prompt, uključi se, molim te.' },
          { who: 'admin', text: 'Konzola radi. Napravite plakat „Pravila korištenja AI u našem odjeljenju“. Uloga, Zadatak, Kontekst, Format... i Zaštitna pravila. Zadivite me. Nećete.' },
        ], { interrupt: true });
      }
      sfx.interact();
      openModal('final');
    },
  },
  {
    id: 'vault', x: PROPS.vault.x, z: PROPS.vault.z + 1.6, r: 1.8,
    label: (s) => (s.doorOpen ? null : 'Pogledaj vrata arhive'),
    use: () => {
      sfx.deny();
      say({ who: 'admin', text: 'Ova vrata su 40 centimetara čelika i 4.000 slajdova pravilnika. Otvara ih samo jedno: odgovoran, dobro napisan prompt.' }, { interrupt: true });
    },
  },
];

// ---------------------------------------------------------------- flow
export function intro() {
  const st = G();
  world.alarm = 1;
  sfx.siren(3);
  st.say([
    { who: 'system', mood: 'shock', text: 'PAŽNJA, UČENICI. ZA KONAČNI SERTIFIKAT TREBA... JOŠ JEDAN PROMPT.', duration: 4.2 },
    { who: 'admin', text: 'Dobro došli u školsku arhivu. Ja sam ARHIVAR. Pripremio sam kratku prezentaciju. Slajd 1 od 4.000.' },
    { who: 'joker', mood: 'shock', text: 'Četiri HILJADE?!' },
    { who: 'admin', text: 'Vaš sertifikat čeka iza četiri pečata odgovorne upotrebe AI, Hodnika sa senzorima i jednog konačnog prompta. Tri pogrešna odgovora kod pečata, i gledate cijelu prezentaciju.' },
    { who: 'boss', mood: 'serious', text: 'Vidio sam i duže prezentacije. Neke sam i sam napravio.' },
    { who: 'commentator', mood: 'excited', text: 'To je to: finale! Tri misije, četiri pomoćnika i jedna veoma duga prezentacija.' },
    { who: 'mastermind', text: 'Svaki pečat je dilema iz školskog života i traži jednog od nas. Pitaj se: šta bi uradio odgovoran učenik?', then: () => endIntro() },
  ], { interrupt: true });
}

export function endIntro() {
  const st = G();
  if (st.phase !== 'intro') return;
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
  st.setPhase('playing');
  if (!st.startedAt) useGame.setState({ startedAt: performance.now() });
  setTimeout(() => G().phase === 'playing' && !G().dialogue.current && say({
    who: 'mastermind', text: 'Pečati: INTEGRITET je moj (1), PRISTRASNOST Gemijeva (2), PRIVATNOST Copilotova (3), ODGOVORNOST Claudeova (4). Claude, čuvaj glas i za finale.',
  }), 600);
}

export function objective(s) {
  if (s.doorOpen) return 'Uzmi svoj sertifikat!';
  const n = SEALS.filter((x) => s.inventory.includes(x.id)).length;
  if (n < SEALS.length) return `Osvoji 4 pečata odgovorne upotrebe AI (${n}/4)`;
  if (!s.ms.teamInCore) return 'Pređi Hodnik sa senzorima: stani kod linije ČEKAJ dok se kapija ne ugasi, pritisni SPACE tik prije crvene zone SKOČI';
  if (!s.ms.consoleOn) return 'Uključi konzolu za Konačni prompt (treba Claude)';
  return 'Napiši KONAČNI PROMPT na konzoli';
}

export function update(dt, st) {
  if (st.paused) return;
  for (const col of world.colliders) if (col.id === 'sealgate') col.enabled = !hasAllSeals(st.inventory);
  updateLasers(st);
  if (st.phase !== 'playing') return;
  const c = world.chars[st.active];
  if (!st.ms.teamInCore && c.z < CORE_ENTRY_Z) {
    // the rest of the team sprints through the corridor behind you
    let k = 0;
    world.chars.forEach((o, i) => {
      if (i === st.active) return;
      const [x, z] = CORE_SPOTS[k++];
      Object.assign(o, { x, z, vx: 0, vz: 0 });
    });
    G().patchMs({ teamInCore: true });
    sfx.pickup();
    say([
      { who: 'narrator', text: 'Ostatak ekipe protrčava hodnikom iza tebe i nekako ne dotakne nijedan senzor. Hvalisavci.' },
      { who: 'mastermind', text: 'Konzola za Konačni prompt. Claude (4), uključi je.' },
    ], { interrupt: true });
  }
}

export function reset() {
  placeCharacters(SPAWNS);
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
}
