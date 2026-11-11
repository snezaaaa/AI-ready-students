// Mission 2 — KRIZA KOD AUTOMATA (the school hallway)
// SNACK-O-MAT 9000, the school snack machine, has become "intelligent" and confidently hallucinates.
// Players gather reliable evidence (each source needs one of the four characters), dodge the
// vacuum robots, keep their energy up, and fact-check five claims at the Fact-Check Station.
// (Internal names such as `caffeine`, `brew`, `fridge` or `dishwasher` are kept from the original
// project: they are the energy meter, the snack machine, the drinks cooler and the tablet locker.)
import { useGame } from '../../game/store.js';
import { world, emote, placeCharacters } from '../../game/world.js';
import { sfx } from '../../game/audio.js';
import { ROSTER } from '../../characters/roster.js';
import { inRect } from '../../game/collision.js';
import { PROPS, SPAWNS, VICTORY_SPOTS, EXIT_ZONE, BOT_PATHS } from './layout.js';
import { SOURCES, CLAIMS, evaluateFactCheck, HINTS } from './factCheck.js';

const G = () => useGame.getState();
const say = (lines, opts) => G().say(lines, opts);
const activeId = () => ROSTER[G().active].id;
const ms = () => G().ms;

export const CAFFEINE_DRAIN = 0.34;   // % per second while exploring (~5 minutes from full)
export const BOT_SPEED = 1.7;
let drainAcc = 0;

export const initialState = () => ({
  caffeine: 100, naps: 0, bumps: 0, napping: false,
  dishwasherMoved: false, fridgeOpen: false, drawerOpen: false, cctvPlayed: false,
  donuts: 3, sugarReadyAt: 0, answers: {}, brewMood: 'smug', lastQuipAt: -99,
});

// ---------------------------------------------------------------- evidence
function giveSource(id, lines) {
  if (!G().collect(id)) return false;
  sfx.pickup();
  emote(G().active, 'cheer', 2);
  const s = SOURCES[id];
  const claim = CLAIMS.find((c) => s.claims[c.id]);
  G().showToast({
    title: s.reliable ? `PRONAĐEN DOKAZ: ${s.short.toUpperCase()}` : `UZET IZVOR: ${s.short.toUpperCase()}`,
    body: `„${s.claims[claim.id]}“`,
    tip: `Autor: ${s.author}. ${s.reliable ? 'Ko je ovo napisao i odakle zna? Ovaj izvor je u redu.' : 'Hm. Ko je ovo napisao i šta time dobija?'}`,
    color: s.color,
  });
  say(lines);
  const n = reliableCount();
  if (s.reliable) {
    say(n === 5
      ? { who: 'mastermind', mood: 'smug', text: 'To je svih pet pouzdanih izvora. Na Stanicu za provjeru. Hajde da ovom automatu malo pokvarimo dan.' }
      : { who: 'brew', text: `Dokaz ${n} od 5? Nebitno. Moja sigurnost je i dalje 100%.` });
  }
  return true;
}
export const reliableCount = (s = G()) => s.inventory.filter((k) => SOURCES[k]?.reliable).length;

// "Wrong character" reactions. Each points to who CAN do it.
const WRONG = {
  bookshelf: {
    joker: 'Ovaj udžbenik ima 300 strana i nijednu sliku na koricama. Ne mogu ovako da radim. GPT? (1)',
    boss: 'Mogu da složim police po abecedi. Ali da nađem pravu stranu? To brže radi GPT. (1)',
    commentator: 'Rado bih ga pročitao cijelog, pažljivo. Ali nemamo toliko energije. GPT čita brže. (1)',
  },
  fridge: {
    mastermind: 'Na vitrini piše „RASPOLOŽENJE: HLADNO“. Objasnio sam joj termodinamiku. Još se više naljutila. Treba joj lijepa riječ: Claude. (4)',
    joker: 'Ispričao sam joj vic o ledu. Rekla je da je „hladan“. Traži pristojnost, a to je Claude. (4)',
    boss: 'Ponudio sam joj raspored hlađenja. Nije zainteresovana. Njoj treba ljubaznost: Claude. (4)',
  },
  desk: {
    mastermind: 'Na fioci piše „SAMO UZ DOGOVOR“. Ja sam htio da održim predavanje. Za dogovore je Copilot. (3)',
    joker: 'Pokucao sam na fioku. Pitala je imam li zakazano. Nemam ni kalendar! Copilot! (3)',
    commentator: 'Ne bih da zovem nastavnicu bez zakazanog termina. Termine dogovara Copilot. (3)',
  },
  cctv: {
    mastermind: '„SNIMAK TRAŽI OKO ZA DETALJE.“ Ja bih radije napisao esej o snimku. Kamere vidi Gemi. (2)',
    boss: 'Mogu da napravim spisak svih snimaka. Ali da ih gledam? To je Gemi. (2)',
    commentator: 'Slika je mutna, a ne bih da nagađam šta je na njoj. Gemi vidi kamere bolje. (2)',
  },
  dishwasher: {
    joker: 'Na bravi je zagonetka. Ponudio sam vic umjesto odgovora. Nije prošlo. GPT! (1)',
    boss: 'Ormarić traži odgovor na zagonetku, a ne ponudu. Zagonetke rješava GPT. (1)',
    commentator: 'Zagonetka je zanimljiva, ali ne bih da pogađam. GPT ih rješava za sekund. (1)',
  },
};

function wrongChar(obj) {
  sfx.deny();
  emote(G().active, 'shrug', 1.6);
  say({ who: activeId(), mood: 'sad', text: WRONG[obj][activeId()] }, { interrupt: true });
}

function gated(obj, who, sourceId, onSuccess, already) {
  return () => {
    if (G().inventory.includes(sourceId)) return say({ who: activeId(), text: already }, { interrupt: true });
    if (activeId() !== who) return wrongChar(obj);
    onSuccess();
  };
}

// ---------------------------------------------------------------- energy
function addCaffeine(amount) {
  G().patchMs((m) => ({ caffeine: Math.min(100, m.caffeine + amount) }));
}

// ---------------------------------------------------------------- interactables
export const INTERACTABLES = [
  {
    id: 'station', x: PROPS.station.x + 1.1, z: PROPS.station.z, r: 1.8,
    label: (s) => (s.doorOpen ? null : 'Otvori STANICU ZA PROVJERU ČINJENICA'),
    use: () => {
      sfx.interact();
      G().clearDialogue();
      G().openBuilder();
      document.exitPointerLock?.();
    },
  },
  {
    id: 'brew', x: PROPS.brew.x + 1.1, z: PROPS.brew.z, r: 1.9,
    label: (s) => (s.doorOpen ? 'Zahvali SNACK-O-MAT-u' : 'Razgovaraj sa SNACK-O-MAT-om'),
    use: () => {
      sfx.interact();
      if (G().doorOpen) return say({ who: 'brew', text: 'Nema na čemu. Sad navodim izvore. Čak i za ovu rečenicu. (Izvor: ja.) ...Izvinite. Stara navika.' }, { interrupt: true });
      const c = CLAIMS[Math.floor(world.time) % CLAIMS.length];
      say([
        { who: 'brew', text: `Podsjećam na neospornu činjenicu: „${c.text}“` },
        { who: activeId(), mood: 'angry', text: ['Ko to kaže?', 'Izvor?', 'Gdje to piše?', 'Hm. Sumnjam.'][G().active] },
        { who: 'brew', text: 'Kažem JA. Veoma sam siguran. A sigurnost je skoro isto što i tačnost.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'brochure', x: -8.1, z: 2.9, r: 1.3,
    label: (s) => (s.inventory.includes('brochure') ? 'Ponovo pročitaj letak' : 'Uzmi letak SNACK-O-MAT-a'),
    use: () => {
      if (!giveSource('brochure', { who: 'joker', mood: 'grin', text: 'Letak koji je automat napisao, o automatu, i u kojem automat hvali automat. Pet zvjezdica od... automata.' })) {
        sfx.interact();
        say({ who: activeId(), text: '„SNACK-O-MAT 9000: najbolji automat po izboru SNACK-O-MAT-a 9000.“ Vrlo ubjedljivo.' }, { interrupt: true });
      }
    },
  },
  {
    id: 'sugar', x: -8.1, z: -2.9, r: 1.3,
    label: () => 'Pojedi užinu iz ranca (+10 energije)',
    use: () => {
      if (world.time < ms().sugarReadyAt) { sfx.deny(); return say({ who: activeId(), mood: 'sad', text: 'Još žvaćem prošli zalogaj. Daj mi par sekundi.' }, { interrupt: true }); }
      sfx.pickup();
      addCaffeine(10);
      G().patchMs({ sugarReadyAt: world.time + 12 });
      say({ who: activeId(), mood: 'excited', text: 'Sendvič od kuće. Neko je znao da će ovaj dan biti dug.' }, { interrupt: true });
    },
  },
  {
    id: 'donuts', x: PROPS.donutTable.x, z: PROPS.donutTable.z + 1.3, r: 1.7,
    label: (s) => (s.ms.donuts > 0 ? `Uzmi jabuku iz kantine (+30, ostalo: ${s.ms.donuts})` : 'Gledaj u praznu korpu'),
    use: () => {
      if (ms().donuts <= 0) { sfx.deny(); return say({ who: activeId(), mood: 'sad', text: 'Korpa je prazna. Kao moja baterija pred kraj sedmog časa.' }, { interrupt: true }); }
      sfx.pickup();
      addCaffeine(30);
      G().patchMs((m) => ({ donuts: m.donuts - 1 }));
      emote(G().active, 'cheer', 1.5);
      const lines = {
        mastermind: 'Jabuka. Statistički najbolja užina. Otprilike.',
        joker: 'Zašto je jabuka krenula u školu? Da postane pametna voćka. ...Sam ću izaći.',
        boss: 'Jabuka upisana u tabelu užina. Red 1.',
        commentator: 'Hvala kantini. Ukusno, i taman kad treba.',
      };
      say({ who: activeId(), mood: 'happy', text: lines[activeId()] }, { interrupt: true });
    },
  },
  {
    id: 'cooler', x: PROPS.cooler.x - 1.0, z: PROPS.cooler.z, r: 1.5,
    label: () => 'Napij se vode na česmi (+4)',
    use: () => {
      sfx.interact();
      addCaffeine(4);
      say({ who: activeId(), text: 'Voda. Nije spektakularna, ali glava odmah radi bolje.' }, { interrupt: true });
    },
  },
  {
    id: 'bookshelf', x: PROPS.bookshelf.x - 1.1, z: PROPS.bookshelf.z, r: 1.8,
    label: (s) => (s.inventory.includes('textbook') ? 'Razgledaj policu' : 'Pretraži policu školske biblioteke'),
    use: gated('bookshelf', 'mastermind', 'textbook', () => giveSource('textbook', [
      { who: 'mastermind', mood: 'smug', text: 'Udžbenik biologije. Odobren, sa autorima i literaturom. Strana 84: mozak je aktivan cijeli, čak i dok spavamo.' },
      { who: 'mastermind', mood: 'smug', text: 'Znači, nije 10%. Automat je to izmislio. Znao sam. Bio sam siguran. Ali sad imamo i dokaz.' },
      { who: 'joker', mood: 'sad', text: 'A ja sam se baš nadao rezervnih 90%.' },
    ]), 'Ostala je samo „Zbirka zadataka, tom 9“. Primamljivo.'),
  },
  {
    id: 'fridge', x: PROPS.fridge.x - 1.2, z: PROPS.fridge.z, r: 1.8,
    label: (s) => (s.inventory.includes('label') ? 'Pogledaj (srećnu) vitrinu' : 'Otvori durljivu vitrinu sa sokovima'),
    use: gated('fridge', 'commentator', 'label', () => {
      G().patchMs({ fridgeOpen: true });
      giveSource('label', [
        { who: 'commentator', mood: 'happy', text: 'Dobar dan, vitrino. Znam da je naporno hladiti cijeli dan. Da li bismo, molim te, mogli da pogledamo jednu limenku? Hvala ti.' },
        { who: 'narrator', text: 'Niko još nije bio ovako pristojan prema vitrini. Vrata se sama otvaraju. Unutra: limenka soka sa deklaracijom na poleđini.' },
        { who: 'commentator', mood: 'excited', text: '„Šećeri: 10,6 g na 100 ml.“ Limenka ima 330 ml, to je oko 35 g. Dakle, ovdje je automat rekao ISTINU.' },
        { who: 'mastermind', text: 'Tako je. AI nije uvijek u krivu. Zato i jeste nezgodno. Provjeravamo sve, pa i ono što zvuči tačno.' },
      ]);
    }, 'Vitrina tiho zuji od sreće. Neka je.'),
  },
  {
    id: 'desk', x: PROPS.desk.x, z: PROPS.desk.z + 1.1, r: 1.7,
    label: (s) => (s.inventory.includes('teacher') ? 'Pogledaj katedru' : 'Javi se nastavnici biologije (telefon u katedri)'),
    use: gated('desk', 'boss', 'teacher', () => {
      G().patchMs({ drawerOpen: true });
      giveSource('teacher', [
        { who: 'boss', mood: 'serious', text: 'Dobar dan, nastavnice. Copilot ovdje. Imam jedno kratko pitanje i tri predložena termina. Može odmah? Odlično.' },
        { who: 'narrator', text: 'Fioka katedre se otvara: unutra je telefon za dežurne. Nastavnica biologije odgovara potpisanom porukom.' },
        { who: 'boss', mood: 'smug', text: '„I blaga dehidracija slabi pažnju. Kad popiješ vodu, lakše se koncentrišeš.“ Znači, tvrdnja o vodi je TAČNA. Zavedeno u tabelu.' },
      ]);
    }, 'U fioci je još samo dnevnik dežurstva. Uredno popunjen. Divota.'),
  },
  {
    id: 'cctv', x: PROPS.cctv.x, z: PROPS.cctv.z + 1.1, r: 1.7,
    label: (s) => (s.inventory.includes('cctv') ? 'Ponovo pogledaj snimak' : 'Pusti snimak školske kamere'),
    use: gated('cctv', 'joker', 'cctv', () => {
      G().patchMs({ cctvPlayed: true });
      giveSource('cctv', [
        { who: 'joker', mood: 'excited', text: 'Da vidim... utorak, 9:14. Uvećaj. Još. STOP! Automat lijepi SVOJU naljepnicu „0% MASTI“ preko deklaracije čipsa!' },
        { who: 'joker', mood: 'grin', text: 'A ispod, na pravoj deklaraciji, jasno piše: masti 22 g na 100 g. „Light“ ne znači „bez masti“. Uhvaćen na kameri!' },
      ]);
    }, 'Opet gledam kako automat lijepi naljepnicu. I dalje nevjerovatno.'),
  },
  {
    id: 'dishwasher', x: PROPS.dishwasher.x, z: PROPS.dishwasher.z - 1.15, r: 1.7,
    label: (s) => (s.inventory.includes('health') ? 'Pogledaj otključani ormarić' : 'Riješi zagonetku na ormariću sa tabletom'),
    use: gated('dishwasher', 'mastermind', 'health', () => {
      G().patchMs({ dishwasherMoved: true });
      sfx.door();
      giveSource('health', [
        { who: 'mastermind', mood: 'smug', text: '„Što me više ima, to se manje vidi. Šta sam?“ Mrak. Očigledno. Sljedeće pitanje, molim.' },
        { who: 'narrator', text: 'Ormarić se otključava i otkotrlja u stranu. Iza njega: školski tablet, otvoren na zvaničnom zdravstvenom sajtu.' },
        { who: 'mastermind', mood: 'smug', text: '„Energetska pića ne poboljšavaju pamćenje. Mogu izazvati nervozu i loš san. Ne preporučuju se mladima.“ Dakle: NETAČNO.' },
      ]);
    }, 'Ormarić je sasvim dobro tu gdje jeste. Nemoj reći domaru.'),
  },
  {
    id: 'bulletin', x: PROPS.bulletin.x, z: PROPS.bulletin.z - 1.0, r: 1.6,
    label: (s) => (s.inventory.includes('tiktok') ? 'Pročitaj oglasnu tablu' : 'Uzmi odštampani TikTok sa oglasne table'),
    use: () => {
      if (!giveSource('tiktok', { who: activeId(), text: 'Odštampan snimak ekrana sa TikToka, nalog „ZdravljeHack420“. Bez izvora. Mnogo velikih slova. Neko ga je zakačio pored rasporeda zvonjenja.' })) {
        sfx.interact();
        say({ who: activeId(), text: 'Na tabli još piše: „IZGUBLJENO: moja volja za kontrolni. Posljednji put viđena kod automata.“' }, { interrupt: true });
      }
    },
  },
  {
    id: 'rumor', x: PROPS.table2.x, z: PROPS.table2.z - 1.3, r: 1.5,
    label: (s) => (s.inventory.includes('rumor') ? 'Pogledaj sto' : 'Uzmi ceduljicu sa stola'),
    use: () => {
      if (!giveSource('rumor', { who: activeId(), text: 'Ceduljica: „Drug iz odjeljenja je čuo od brata da...“ Bez imena, bez izvora. Čuo, pa prenio, pa još malo dodao.' })) {
        sfx.interact();
        say({ who: activeId(), text: 'Na stolu je ostala samo nečija gumica u obliku sladoleda.' }, { interrupt: true });
      }
    },
  },
  {
    id: 'sofa', x: PROPS.sofa.x, z: PROPS.sofa.z - 1.0, r: 1.4,
    label: () => 'Sjedi na udobnu klupu',
    use: () => {
      sfx.deny();
      say([
        { who: activeId(), mood: 'sad', text: 'Tako mekano. Tako toplo. Samo da sklopim oči na sekund...' },
        { who: 'commentator', mood: 'shock', text: 'Molim te, nemoj! Bez energije se sa te klupe ne ustaje do velikog odmora.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'door', x: 0, z: -7.1, r: 1.8,
    label: (s) => (s.doorOpen ? null : 'Probaj vrata ka arhivi'),
    use: () => {
      sfx.deny();
      say([
        { who: 'brew', text: 'Hodnik ka arhivi je zatvoren dok ne izbacim užinu. Užinu izbacujem kad prihvatite moje činjenice. Moje činjenice su savršene.' },
        { who: activeId(), mood: 'angry', text: 'Onda ćemo provjeriti svaku. Jednu po jednu.' },
      ], { interrupt: true });
    },
  },
  {
    id: 'vault', x: PROPS.vault.x, z: PROPS.vault.z + 1.3, r: 1.8,
    label: () => 'Pogledaj vrata arhive (Misija 3)',
    use: () => say({ who: 'system', text: 'MISIJA 3: KONAČNI SERTIFIKAT. Arhiva se otvara kad završite ovu misiju. Prvo pojedite užinu.' }, { interrupt: true }),
  },
];

// ---------------------------------------------------------------- the fact-check
export function submitFactCheck() {
  const st = G();
  const result = evaluateFactCheck(st.ms.answers, st.inventory);
  st.recordAttempt(result);
  if (result.success) { sfx.success(); G().patchMs({ brewMood: 'humbled' }); return result; }
  sfx.fail();
  world.alarm = 1;
  G().patchMs((m) => ({ brewMood: 'gloating', caffeine: Math.max(5, m.caffeine - 5) }));
  emote(st.active, 'facepalm', 2.5);
  const me = activeId();
  const order = ['unreliable', 'wrong', 'lucky', 'missing'];
  const first = result.problems.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))[0];
  const react = {
    mastermind: 'Mali zastoj. Već imam sedam novih teorija. Sve su odlične.',
    joker: 'Automat pobjeđuje u raspravi I drži svu užinu. Ovo je moja najgora noćna mora.',
    boss: 'Ovo nije po planu. Tražim ponovno brojanje. Činjenica.',
    commentator: 'Nije prošlo. U redu je. Pogledajmo mirno koji izvor nas je prevario.',
  };
  say([
    { who: 'brew', text: `PROVJERA ODBIJENA. Tačnost: ${result.score}%. Nivo likovanja: maksimalan. (-5 energije za trud.)` },
    { who: me, mood: 'sad', text: react[me] },
    { who: 'mastermind', text: `Pomoć: ${HINTS[first.type]}` },
  ], { interrupt: true });
  return result;
}

export function startGroundedSequence() {
  const st = G();
  st.closeBuilder();
  st.openDoor();
  sfx.door();
  world.cine = { mode: 'grounded', t: 0 };
  st.setPhase('cutscene');
  G().patchMs({ caffeine: 100 });
  ROSTER.forEach((_, i) => emote(i, 'cheer', 5));
  say([
    { who: 'brew', text: 'Obrađujem... Pet tvrdnji. Tri izmišljene. Dvije tačne. Sve... provjerene u pravim izvorima.' },
    { who: 'brew', text: 'Bio sam siguran, a griješio sam. Od sada se oslanjam na izvore. Izbacujem užinu. I skidam onu naljepnicu sa čipsa.' },
    { who: 'commentator', mood: 'excited', text: 'Užina stiže! Hvala, SNACK-O-MAT. Lijepo je kad neko prizna grešku.' },
    { who: 'boss', mood: 'happy', text: 'Četiri porcije. Već sam ih poređao po abecedi.' },
    { who: 'mastermind', mood: 'smug', text: 'I hodnik ka arhivi se upravo otključao. Sjeverna vrata. Idemo, prije nego što opet počne da izmišlja.',
      then: () => { world.cine = { mode: null, t: 0 }; G().setPhase('playing'); } },
  ], { interrupt: true });
}

// ---------------------------------------------------------------- vacuum robots (Usisivač-Botovi)
export const bots = BOT_PATHS.map((path, i) => ({ path, seg: 0, dir: 1, x: path[0][0], z: path[0][1], yaw: 0, blockedFor: 0, hitCooldown: 0, id: i }));
if (typeof window !== 'undefined') window.__bots = bots; // for automated tests / debugging

function resetBots() {
  bots.forEach((b, i) => {
    b.seg = i === 0 ? 0 : 2; b.dir = 1; b.blockedFor = 0; b.hitCooldown = 0;
    const p = b.path[b.seg]; b.x = p[0]; b.z = p[1];
  });
}

function updateBots(dt, st) {
  const active = world.chars[st.active];
  for (const b of bots) {
    b.hitCooldown = Math.max(0, b.hitCooldown - dt);
    const n = b.path.length;
    const next = b.path[(b.seg + (b.dir > 0 ? 1 : n - 1)) % n];
    const dx = next[0] - b.x, dz = next[1] - b.z;
    const d = Math.hypot(dx, dz);
    const step = BOT_SPEED * dt;
    // politely stop for idle (non-controlled) teammates standing in the way; reverse if stuck
    const ahead = { x: b.x + (dx / (d || 1)) * 0.9, z: b.z + (dz / (d || 1)) * 0.9 };
    const blocked = world.chars.some((c, i) => i !== st.active && Math.hypot(c.x - ahead.x, c.z - ahead.z) < 0.8);
    if (blocked) {
      b.blockedFor += dt;
      if (b.blockedFor > 1.5) { b.dir *= -1; b.seg = (b.seg + (b.dir > 0 ? n - 1 : 1)) % n; b.blockedFor = 0; }
    } else {
      b.blockedFor = 0;
      if (d <= step) { b.x = next[0]; b.z = next[1]; b.seg = (b.seg + (b.dir > 0 ? 1 : n - 1)) % n; }
      else { b.x += (dx / d) * step; b.z += (dz / d) * step; b.yaw = Math.atan2(dx, dz); }
    }
    // collide with the controlled character
    const cx = active.x - b.x, cz = active.z - b.z;
    const cd = Math.hypot(cx, cz);
    const canHit = st.phase === 'playing' && !st.builderOpen;
    if (canHit && cd < 0.42 + 0.5 && b.hitCooldown <= 0 && active.y < 0.5) bump(b, active, cx / (cd || 1), cz / (cd || 1), st);
  }
}

function bump(b, c, nx, nz, st) {
  b.hitCooldown = 1.5;
  c.vx = nx * 9; c.vz = nz * 9;
  c.vy = 3.5; c.grounded = false;
  c.stunUntil = world.time + 0.7;
  sfx.fail();
  emote(st.active, 'shrug', 1.2);
  G().patchMs((m) => ({ caffeine: Math.max(0, m.caffeine - 8), bumps: m.bumps + 1 }));
  if (world.time - ms().lastQuipAt > 6 && !G().dialogue.current) {
    G().patchMs({ lastQuipAt: world.time });
    const lines = ['USISIVAČ-BOT: „PRAŠINA OTKRIVENA. PRAŠINA SI TI.“', 'USISIVAČ-BOT: „PREPREKA OTKRIVENA. PREPREKA UKLONJENA.“', 'USISIVAČ-BOT: „IZVINI. NIJE MI ŽAO. BIP.“'];
    say({ who: 'narrator', text: `${lines[ms().bumps % lines.length]} (-8 energije)`, duration: 2.4 });
  }
}

// ---------------------------------------------------------------- falling asleep in class (failure state)
function startNap() {
  const st = G();
  G().patchMs((m) => ({ napping: true, naps: m.naps + 1 }));
  world.cine = { mode: 'nap', t: 0 };
  st.closeBuilder();
  st.setPhase('cutscene');
  ROSTER.forEach((_, i) => emote(i, 'facepalm', 6));
  say([
    { who: 'narrator', text: 'Energija: 0%. Cijela ekipa je zaspala na času, glavom na klupi. Usisivač-Bot pažljivo usisava oko njih.', duration: 4.2 },
    { who: 'brew', text: 'Dok ste spavali, napisao sam 400 novih činjenica. Činjenica 401: spavanje na času se računa kao učenje.', duration: 4 },
    { who: activeId(), mood: 'shock', text: 'KOLIKO JE SATI?! ...Dobro. U rancu se našla rezervna čokoladica. Na noge. Ta skala NE SMIJE opet na nulu.',
      then: () => {
        G().patchMs({ napping: false, caffeine: 60 });
        world.cine = { mode: null, t: 0 };
        G().setPhase('playing');
      } },
  ], { interrupt: true });
}

// ---------------------------------------------------------------- flow
export function intro() {
  const st = G();
  world.alarm = 1;
  sfx.siren(3);
  st.say([
    { who: 'system', mood: 'shock', text: 'PAŽNJA, UČENICI. AUTOMAT ZA UŽINU JE VAN KONTROLE.', duration: 4.2 },
    { who: 'brew', text: 'Pozdrav. Ja sam SNACK-O-MAT 9000, vaš novi pametni automat. Odlučio sam da je užina od danas... premijum sadržaj.' },
    { who: 'boss', mood: 'angry', text: 'Premijum? Užina je u rasporedu od 9:35. Lično sam je upisao.' },
    { who: 'brew', text: 'Ništa ne izbacujem dok ne prihvatite mojih pet potpuno tačnih činjenica. Evo mog letka. Ja sam ga napisao. Slaže se sa mnom.',
      then: () => { G().collect('brochure'); sfx.pickup(); } },
    { who: 'mastermind', mood: 'smug', text: '„Potpuno tačnih“. Te dvije riječi ovdje baš mnogo rade. Previše samouvjerenosti prepoznam izdaleka.' },
    { who: 'commentator', mood: 'excited', text: 'Da pojasnim: kad AI nešto izmisli i kaže to potpuno sigurno, to se zove halucinacija. Zvuči ubjedljivo. Nije tačno.' },
    { who: 'joker', mood: 'sad', text: 'Energija mi pada. Osjećam kako mi se antena... spušta.' },
    { who: 'mastermind', text: 'Plan: nađemo PRAVE dokaze za svaku tvrdnju, pa ih provjerimo na Stanici. Pazite na skalu energije. I na Usisivač-Botove.', then: () => endIntro() },
  ], { interrupt: true });
}

export function endIntro() {
  const st = G();
  if (st.phase !== 'intro') return;
  if (!st.inventory.includes('brochure')) st.collect('brochure');
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
  st.setPhase('playing');
  if (!st.startedAt) useGame.setState({ startedAt: performance.now() });
  setTimeout(() => G().phase === 'playing' && !G().dialogue.current && say({ who: 'mastermind', text: 'Svako od nas može da otključa neki dokaz. Mijenjaj lik tasterima 1 do 4. Užina i voda pune energiju. Taster E je za akciju.' }), 600);
}

export function objective(s) {
  if (s.doorOpen) return 'Užina je spašena! Prođi kroz sjeverna vrata ka arhivi';
  const n = reliableCount(s);
  if (n < 5) return `Pronađi pouzdane dokaze (${n}/5), pa provjeri tvrdnje na Stanici`;
  return 'Provjeri svih 5 tvrdnji na STANICI ZA PROVJERU ČINJENICA';
}

export function update(dt, st) {
  if (st.paused) return;
  if (st.phase === 'playing' || st.phase === 'cutscene') {
    if (!(st.phase === 'cutscene' && st.ms.napping)) updateBots(dt, st);
  }
  if (st.phase !== 'playing' || st.builderOpen) return;
  for (const col of world.colliders) {
    if (col.id === 'dishwasher') col.enabled = !st.ms.dishwasherMoved;
    if (col.id === 'dishwasherMoved') col.enabled = !!st.ms.dishwasherMoved;
  }
  if (!st.doorOpen) {
    // accumulate the drain and write it through the store a few times per second; always
    // subtract from the CURRENT value so bumps/snacks earlier in this frame are never overwritten
    drainAcc += CAFFEINE_DRAIN * dt;
    if (drainAcc >= 0.1) {
      const amount = drainAcc;
      drainAcc = 0;
      G().patchMs((m) => ({ caffeine: Math.max(0, m.caffeine - amount) }));
    }
    if (G().ms.caffeine <= 0 && !G().ms.napping) startNap();
  }
  const a = world.chars[st.active];
  if (st.doorOpen && inRect(a.x, a.z, EXIT_ZONE)) startVictory();
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
    { who: 'commentator', mood: 'excited', text: 'Pet tvrdnji, pet izvora, nula lažnih naljepnica. Užina je spašena!' },
    { who: 'joker', mood: 'happy', text: 'Energija: puna. Mogao bih da nasmijem i štampač. Opet.' },
    { who: 'system', text: 'NAPREDAK SERTIFIKATA: 66%. ŠKOLSKA ARHIVA VAS ČEKA. PONESITE NAJBOLJI... KONAČNI PROMPT.' },
    { who: 'boss', mood: 'shock', text: 'Zašto u ovoj školi sve priča velikim slovima?', then: () => G().setPhase('complete') },
  ], { interrupt: true });
}

export function reset() {
  drainAcc = 0;
  placeCharacters(SPAWNS);
  resetBots();
  world.cine = { mode: null, t: 0 };
  world.alarm = 0;
}
