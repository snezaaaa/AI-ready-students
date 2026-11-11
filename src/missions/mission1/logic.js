// Mission 1 — NEMOGUĆI PROMPT (the classroom): interactables, dialogue, objectives and win flow.
import { useGame } from '../../game/store.js';
import { world, emote, placeCharacters } from '../../game/world.js';
import { sfx } from '../../game/audio.js';
import { ROSTER } from '../../characters/roster.js';
import { PROPS, DESKS, EXIT_ZONE, VICTORY_SPOTS, SPAWNS } from './layout.js';
import { inRect } from '../../game/collision.js';
import { evaluatePrompt, HINTS, SLOTS, CARDS } from './promptPuzzle.js';

const G = () => useGame.getState();
const say = (lines, opts) => G().say(lines, opts);
const activeId = () => ROSTER[G().active].id;

// ---------------------------------------------------------------- component pickups
const COMPONENT_INFO = {
  role: { title: 'ULOGA', color: '#f472b6', tip: 'Reci AI-ju KO treba da bude, npr. „Ti si strpljiv tutor iz biologije...“' },
  task: { title: 'ZADATAK', color: '#60a5fa', tip: 'Reci AI-ju tačno ŠTA da uradi: jedna jasna, konkretna stvar.' },
  context: { title: 'KONTEKST', color: '#34d399', tip: 'Objasni ko si, kakva je situacija i šta te ograničava.' },
  format: { title: 'FORMAT', color: '#fbbf24', tip: 'Opiši KAKO odgovor treba da izgleda: tabela, lista, dužina...' },
};

function collect(slot, lines) {
  if (!G().collect(slot)) return;
  sfx.pickup();
  emote(G().active, 'cheer', 2);
  const info = COMPONENT_INFO[slot];
  const card = CARDS[slot].find((c) => c.good);
  G().showToast({ title: `PRONAĐEN DIO PROMPTA: ${info.title}`, body: `„${card.text}“`, tip: info.tip, color: info.color });
  say(lines);
  const n = G().inventory.length;
  if (n === 4) {
    say([
      { who: 'commentator', mood: 'excited', text: 'Sva četiri dijela su tu: Uloga, Zadatak, Kontekst i Format. Bravo, ekipa!' },
      G().flags.terminalOn
        ? { who: 'mastermind', text: 'Na katedru, do terminala. Vrijeme je da složimo savršen prompt.' }
        : { who: 'mastermind', text: 'Sad treba probuditi PROMPTOTRONA. Mikrofon sluša samo jasan glas. Claude, tvoj trenutak. (Taster 4)' },
    ]);
  } else {
    say({ who: 'ai', text: `Dio ${n} od 4 pronađen. Blago sam impresioniran. Blago.` });
  }
}

// Per-object "wrong character" reactions. Each points to who CAN do it.
const WRONG = {
  whiteboard: {
    joker: 'Ovo je zagonetka. Ja više volim viceve. Zagonetke rješava GPT. (1)',
    boss: 'Mogu da je unesem u tabelu, ali ne i da je riješim. Zagonetke su za GPT-a. (1)',
    commentator: 'Mogu lijepo da je pročitam naglas, ali rješenje će brže naći GPT. (1)',
  },
  printer: {
    mastermind: 'Greška „PAPIR SE ZAGLAVIO“. Logika ovdje ne pomaže. Štampači reaguju samo na... humor. Gemi? (2)',
    boss: 'Ponudio sam mu dogovor. Rekao je „ne“. Štampači ne pregovaraju. Probaj sa Gemijem. (2)',
    commentator: 'Ljubazno sam ga zamolio. Samo je tužno zazujao. Treba ga nasmijati. Gemi? (2)',
  },
  cabinet: {
    mastermind: 'Šifra je navodno „na slici“. Ja radim sa riječima, slike mi malo bježe. Gemi vidi slike. (2)',
    boss: 'Mogu da sredim fascikle kad se otvori. Ali šifra je na fotografiji, a slike vidi Gemi. (2)',
    commentator: 'Na ormaru piše: „Šifra je na slici odjeljenja.“ Sitne detalje na slikama najbolje vidi Gemi. (2)',
  },
  vending: {
    mastermind: 'Objasnio sam mu sve. Detaljno. Dvadeset minuta. Traži „dogovor“, a ne predavanje. Copilot? (3)',
    joker: 'Ispričao sam mu vic. Odgovorio je: „PONUDA NIJE DOVOLJNO OZBILJNA.“ Bezobrazno. Copilot! (3)',
    commentator: 'Automat želi da pregovara, a ja sam previše pristojan da se cjenkam. Copilot je za to. (3)',
  },
  lectern: {
    mastermind: '„GLAS NIJE DOVOLJNO JASAN.“ Rekao sam samo sedamnaest rečenica! Treba nam Claude. (4)',
    joker: 'Probao sam glasom voditelja kviza. Zamolio me da prestanem. Zauvijek. Claude? (4)',
    boss: 'Diktirao sam mu dnevni red. Zaspao je kod tačke 2. Mikrofon traži jasan glas: Claude. (4)',
  },
};

function wrongChar(obj) {
  sfx.deny();
  emote(G().active, 'shrug', 1.6);
  say({ who: activeId(), mood: 'sad', text: WRONG[obj][activeId()] }, { interrupt: true });
}

// ---------------------------------------------------------------- desks / computers
// One per desk in layout.js: the first four belong to the characters, the fifth is neutral.
const COMPUTERS = [
  { owner: 'mastermind', text: '47 otvorenih kartica. Sve se zovu „kako izgledati skromno“. Papirić: „SAVJET: AI ne čita misli. Budi konkretan.“' },
  { owner: 'joker', text: 'Folder „OZBILJAN RAD“ sa 9.000 mimova. Poruka na ekranu: „Nejasan prompt = nejasan odgovor.“' },
  { owner: 'boss', text: 'Tabela „Raspored svega“. Ima 14 listova. Bilješka: „Daj AI-ju ULOGU, kao kad dijeliš zadatke u timu.“' },
  { owner: 'commentator', text: 'Otvoren dokument „Ljubazni odgovori, 3. izdanje“. Na margini: „Uvijek reci u kom FORMATU želiš odgovor.“' },
  { owner: null, name: 'DEŽURNI UČENIK', text: 'Na ekranu piše: „e-Dnevnik je zaključan. Lijep pokušaj.“ Pored tastature: pola kifle i spisak ko je brisao tablu.' },
];
const deskName = (i) => (ROSTER[i] ? ROSTER[i].name : COMPUTERS[i].name);

function inspectComputer(i) {
  const pc = COMPUTERS[i];
  sfx.interact();
  const me = activeId();
  const lines = [{ who: 'narrator', text: `RAČUNAR (${deskName(i).toUpperCase()}): ${pc.text}` }];
  if (me === pc.owner) lines.push({ who: me, mood: 'shock', text: 'Hej! To je moj računar. Nemoj da gledaš moje... dobro, već si pogledao.' });
  else lines.push({ who: me, mood: 'grin', text: ['Zanimljivo. I pomalo zabrinjavajuće.', 'Ovo ću svima ispričati.', 'Vidio sam stvari koje ne mogu da zaboravim.', 'Ovo mnogo toga objašnjava.'][(i + G().active) % 4] });
  say(lines, { interrupt: true });
}

// ---------------------------------------------------------------- the terminal / puzzle
function activateLectern() {
  const st = G();
  if (!st.flags.terminalOn) {
    if (activeId() !== 'commentator') return wrongChar('lectern');
    sfx.success();
    st.setFlag('terminalOn');
    emote(G().active, 'cheer', 2.5);
    say([
      { who: 'commentator', mood: 'excited', text: 'Dobar dan. Govorim polako i razgovijetno: PROMPTOTRON 3000, molim te, probudi se. Hvala unaprijed.' },
      { who: 'ai', text: 'Glas prepoznat. Jasnoća: odlična. Pristojnost: sumnjivo visoka. PROMPTOTRON 3000 je budan.' },
      { who: 'ai', text: 'Dajte mi jedan dobar prompt i otključaću vrata. Dajte mi loš i ocijeniću vas. Naglas.' },
    ], { interrupt: true });
    return;
  }
  if (st.doorOpen) {
    say({ who: 'ai', text: 'Vrata su već otvorena. Izađite, molim vas. Treba mi malo mira.' }, { interrupt: true });
    return;
  }
  sfx.interact();
  st.clearDialogue();
  st.openBuilder();
  document.exitPointerLock?.();
}

const FAIL_REACT = {
  mastermind: ['Po mojoj računici... ovo je bilo loše.', 'Bio sam 97% siguran. Ostalih 3% su bili u pravu.'],
  joker: ['Dobro, bilo je smiješno. Ali na pogrešan način.', 'U moju odbranu, toster je baš želio tu ulogu.'],
  boss: ['Ovo nije po planu. Ko je to složio? ...Ja? Vraćamo se na početak.', 'Bilježim: „ne ponavljati“. Podvučeno.'],
  commentator: ['Nije uspjelo. U redu je, iz ovoga se uči. Pogledajmo šta fali.', 'Polako. Greška nam samo pokazuje gdje da popravimo.'],
};

export function testPrompt() {
  const st = G();
  const result = evaluatePrompt(st.selection, st.inventory);
  st.recordAttempt(result);
  const me = activeId();
  if (result.success) {
    sfx.success();
    return result;
  }
  sfx.fail();
  world.alarm = 1;
  emote(st.active, 'facepalm', 2.5);
  const attempts = G().attempts;
  const firstBad = result.wrong[0] || result.missing[0];
  const lines = [
    { who: 'ai', text: `PROMPT ODBIJEN. Ocjena kvaliteta: ${result.score}%. ${attempts >= 3 ? 'Sad već navijam za vas. Tiho.' : ''}` },
    { who: me, mood: 'sad', text: FAIL_REACT[me][attempts % 2] },
  ];
  if (result.missing.length && !st.inventory.includes(result.missing[0]) && !result.wrong.length) {
    lines.push({ who: 'mastermind', text: `Još nismo ni pronašli dio ${SLOTS.find((s) => s.id === result.missing[0]).label}. Istražujemo dalje!` });
  } else if (firstBad) {
    lines.push({ who: 'mastermind', text: `Pomoć: ${HINTS[firstBad]}` });
  }
  say(lines, { interrupt: true });
  return result;
}

/** Called by the prompt builder after the success output has been shown. */
export function startDoorSequence() {
  const st = G();
  st.closeBuilder();
  st.openDoor();
  sfx.door();
  world.cine = { mode: 'door', t: 0 };
  st.setPhase('cutscene');
  ROSTER.forEach((_, i) => emote(i, 'cheer', 4));
  say([
    { who: 'ai', text: 'PROMPT PRIHVAĆEN. Uloga, zadatak, kontekst, format. Milina. Otključavam vrata.' },
    { who: 'commentator', mood: 'excited', text: 'Vrata se otvaraju! Ponavljam, mirno i jasno: vrata se otvaraju!' },
    { who: 'boss', mood: 'happy', text: 'Odlično, ekipa. Upisujem ovo u tabelu uspjeha. Kolona A.' },
    { who: 'mastermind', mood: 'smug', text: 'Idemo, dok se ne predomisli. Znao sam da će uspjeti. Otprilike.',
      then: () => { world.cine = { mode: null, t: 0 }; G().setPhase('playing'); } },
  ], { interrupt: true });
}

// ---------------------------------------------------------------- interactables
export const INTERACTABLES = [
  {
    id: 'whiteboard', x: PROPS.whiteboard.x, z: 7.9, r: 2.0,
    label: (s) => (s.inventory.includes('role') ? 'Pročitaj tablu' : 'Pogledaj zagonetku na tabli'),
    use: () => {
      const s = G();
      if (s.inventory.includes('role')) return say({ who: activeId(), text: 'Sad na tabli piše samo „GPT je bio ovdje“. Klasika.' }, { interrupt: true });
      if (activeId() !== 'mastermind') return wrongChar('whiteboard');
      collect('role', [
        { who: 'mastermind', mood: 'smug', text: '„Stručnjak sam, a nisam osoba. Igram nekoga, a nisam na sceni.“ Prosto. Odgovor je: ULOGA.' },
        { who: 'joker', mood: 'grin', text: 'Ja sam mislio da je odgovor „pantomimičar“.' },
      ]);
    },
  },
  {
    id: 'printer', x: PROPS.printer.x - 1.2, z: PROPS.printer.z, r: 1.9,
    label: (s) => (s.inventory.includes('task') ? 'Pomazi štampač' : 'Popravi zaglavljeni štampač'),
    use: () => {
      const s = G();
      if (s.inventory.includes('task')) return say({ who: activeId(), text: 'Štampač prede. Je li to... normalno?' }, { interrupt: true });
      if (activeId() !== 'joker') return wrongChar('printer');
      collect('task', [
        { who: 'joker', mood: 'grin', text: 'Hej, štampaču. Zašto je sveska otišla kod doktora? Zato što je imala previše listova na leđima!' },
        { who: 'ai', text: 'Štampač se smije. Štampač... štampa. Ovo u školi još niko nije vidio.' },
        { who: 'joker', mood: 'excited', text: 'Odštampao je dio ZADATAK! Humor: 1. Tehnika: 0.' },
      ]);
    },
  },
  {
    id: 'vending', x: PROPS.vending.x - 1.3, z: PROPS.vending.z, r: 1.9,
    label: (s) => (s.inventory.includes('format') ? 'Pogledaj automat' : 'Pregovaraj sa automatom'),
    use: () => {
      const s = G();
      if (s.inventory.includes('format')) return say({ who: activeId(), text: 'Sad prodaje samo „Žvake sa ukusom kontrolnog“. Preskačem.' }, { interrupt: true });
      if (activeId() !== 'boss') return wrongChar('vending');
      collect('format', [
        { who: 'boss', mood: 'serious', text: 'Slušaj, automate. Imam ponudu u tri tačke, sa tabelom. Ti meni FORMAT, ja tebi mir do kraja polugodišta.' },
        { who: 'ai', text: 'Automat je prihvatio dogovor. Uz FORMAT je izbacio i besplatnu čokoladicu.' },
      ]);
    },
  },
  {
    id: 'cabinet', x: PROPS.cabinet.x - 1.2, z: PROPS.cabinet.z, r: 1.8,
    label: (s) => (s.inventory.includes('context') ? 'Pogledaj (otvoreni) ormar' : 'Otvori ormar sa šifrom'),
    use: () => {
      const s = G();
      if (s.inventory.includes('context')) return say({ who: activeId(), text: 'Ormar je otvoren. Unutra su još kreda i jedna patika broj 44.' }, { interrupt: true });
      if (activeId() !== 'joker') return wrongChar('cabinet');
      collect('context', [
        { who: 'joker', mood: 'grin', text: 'Šifra je na slici odjeljenja? Da vidim... treći red, neko drži papir: „2-0-4“. Vidim te, papiru!' },
        { who: 'mastermind', text: 'Fascikla sa natpisom KONTEKST. Ko si, koliko imaš vremena, šta ti ne ide. To je prava stvar.' },
      ]);
    },
  },
  {
    id: 'lectern', x: PROPS.lectern.x + 1.1, z: PROPS.lectern.z, r: 1.9,
    label: (s) => (!s.flags.terminalOn ? 'Probudi PROMPTOTRONA (mikrofon)' : s.doorOpen ? 'Razgovaraj sa PROMPTOTRONOM' : 'Otvori GRADITELJ PROMPTA'),
    use: activateLectern,
  },
  {
    id: 'door', x: 0, z: -8.1, r: 1.8,
    label: (s) => (s.doorOpen ? null : 'Probaj zaključana vrata'),
    use: () => {
      sfx.deny();
      const me = activeId();
      const lines = {
        mastermind: 'Magnetna brava. Ojačan okvir. Plakat „Samo hrabro!“. Ova vrata su mislila na sve.',
        joker: 'Probao sam „molim te“. Probao sam „sezame, otvori se“. Probao sam da kucam ritmično. Ništa.',
        boss: 'Zakazao sam vratima sastanak. Odbila su poziv.',
        commentator: 'Ljubazno sam pokucao. Vrata su ljubazno ostala zaključana.',
      };
      say([{ who: 'ai', text: 'PRISTUP ODBIJEN. Ova vrata otvara samo dobro napisan prompt.' }, { who: me, mood: 'angry', text: lines[me] }], { interrupt: true });
    },
  },
  {
    id: 'coffee', x: PROPS.coffee.x, z: PROPS.coffee.z - 1.2, r: 1.8,
    label: () => 'Pogledaj pult sa užinom',
    use: () => {
      sfx.deny();
      say([
        { who: 'narrator', text: 'Na pultu stoji natpis: „NE RADI. UŽINA JE OTKAZANA DO DALJNJEG.“' },
        { who: 'boss', mood: 'shock', text: 'Nema užine? Ovo više nije čas. Ovo je vanredna situacija.' },
        { who: 'ai', text: 'Pitanje užine rješava se u... Misiji 2: Kriza kod automata.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'plant', x: PROPS.plant.x - 1.0, z: PROPS.plant.z - 0.9, r: 1.6,
    label: () => 'Popričaj sa sumnjivim fikusom',
    use: () => {
      sfx.interact();
      const me = activeId();
      say([
        { who: me, mood: 'smug', text: 'Pst. Fikuse. Znaš li gdje su djelovi prompta?' },
        { who: 'narrator', text: 'Fikus ćuti. Plastičan je. Vidio je previše pismenih zadataka.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'screen', x: -10.4, z: 2.9, r: 1.4,
    label: () => 'Pročitaj pametnu tablu',
    use: () => {
      sfx.interact();
      say([
        { who: 'narrator', text: 'SLAJD 1 od 1: „Dobar prompt = ULOGA + ZADATAK + KONTEKST + FORMAT.“ Slajd 2 je samo slika mačke.' },
        { who: 'mastermind', text: 'Znači, rješenje bukvalno piše na tabli. Ovaj čas je bolji nego što sam mislio.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'clock', x: PROPS.clock.x, z: -8.0, r: 1.5,
    label: () => 'Pogledaj sat',
    use: () => {
      sfx.interact();
      say({ who: activeId(), mood: 'shock', text: 'Pet minuta do zvona. Već tri sata je pet minuta do zvona. Zvono je iluzija.' }, { interrupt: true });
    },
  },
  ...DESKS.map((d, i) => ({
    id: `pc${i}`, x: d.x + 1.05, z: d.z, r: 1.3,
    label: () => `Zaviri u računar (${deskName(i)})`,
    use: () => inspectComputer(i),
  })),
  {
    id: 'exitDoor', x: PROPS.exitDoor.x, z: PROPS.exitDoor.z + 1.2, r: 1.8,
    label: () => 'Vrata Misije 2 (zaključano)',
    use: () => say({ who: 'ai', text: 'MISIJA 2: KRIZA KOD AUTOMATA. Školski hodnik je iza ovih vrata. Prvo proslavite. (Otključava se kad završite ovu misiju.)' }, { interrupt: true }),
  },
];

// ---------------------------------------------------------------- flow
export function intro() {
  const st = G();
  world.alarm = 1;
  sfx.siren(4);
  st.say([
    { who: 'system', mood: 'shock', text: 'PAŽNJA, UČENICI. VAŠ AI SERTIFIKAT JE ZAKLJUČAN.', duration: 4.2 },
    { who: 'system', text: 'DOBIĆE GA SAMO ONAJ KO NAPIŠE... SAVRŠEN PROMPT.', duration: 4 },
    { who: 'boss', mood: 'angry', text: 'Zaključan? To nije bilo u rasporedu. A raspored sam pravio ja.' },
    { who: 'joker', mood: 'grin', text: 'Opušteno. Jednom sam pobjegao sa onlajn časa kroz čet.' },
    { who: 'commentator', mood: 'excited', text: 'Da rezimiram, mirno i jasno: četiri AI pomoćnika, jedna vrata, nula užine.' },
    { who: 'mastermind', mood: 'smug', text: 'Vrata izdržavaju 400 udaraca. Siguran sam. Uglavnom. Treba nam prompt: Uloga, Zadatak, Kontekst i Format. Sakriveni su po učionici.' },
    { who: 'ai', text: 'Zdravo. Ja sam PROMPTOTRON 3000. Srećno. Ocjenjivaću vas. Tiho. Stalno.', then: () => endIntro() },
  ], { interrupt: true });
}

export function endIntro() {
  const st = G();
  if (st.phase !== 'intro') return;
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
  st.setPhase('playing');
  if (!st.startedAt) useGame.setState({ startedAt: performance.now() });
  setTimeout(() => G().phase === 'playing' && !G().dialogue.current && say({ who: 'mastermind', text: 'Savjet: svako od nas ima svoju vještinu. Mijenjaj lik tasterima 1 do 4 i razgledaj. Taster E je za akciju.' }), 600);
}

export function objective(s) {
  if (s.doorOpen) return 'Izađi kroz otvorena vrata!';
  const n = s.inventory.length;
  if (n < 4 && !s.flags.terminalOn) return `Pronađi 4 dijela prompta (${n}/4) — za svaki treba pravi lik`;
  if (n < 4) return `Pronađi preostale djelove prompta (${n}/4)`;
  if (!s.flags.terminalOn) return 'Probudi PROMPTOTRONA na katedri (treba Claude)';
  return 'Složi i TESTIRAJ prompt na terminalu na katedri';
}

/** Per-frame mission update (zone triggers). */
export function update() {
  const s = G();
  if (s.phase !== 'playing' || !s.doorOpen) return;
  const c = world.chars[s.active];
  if (inRect(c.x, c.z, EXIT_ZONE)) startVictory();
}

export function startVictory() {
  const st = G();
  useGame.setState({ finishedAt: performance.now() });
  placeCharacters(VICTORY_SPOTS);
  ROSTER.forEach((_, i) => emote(i, 'dance', 60));
  world.cine = { mode: 'victory', t: 0 };
  st.setPhase('victory');
  sfx.success();
  st.say([
    { who: 'commentator', mood: 'excited', text: 'Uspjeli smo! Jedan prompt, četiri dijela i tabela sa kolonama Dan, Šta učim, Kako se provjerim. Lijepo i jasno.' },
    { who: 'joker', mood: 'grin', text: 'Zahvaljujem štampaču. Imali smo nešto posebno.' },
    { who: 'system', text: 'NAPREDAK SERTIFIKATA: 33%. MOLIMO, NASTAVITE DO... AUTOMATA ZA UŽINU.' },
    { who: 'boss', mood: 'shock', text: 'Zašto je to zvučalo kao prijetnja?', then: () => G().setPhase('complete') },
  ], { interrupt: true });
}

export function reset() {
  placeCharacters(SPAWNS);
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
}
