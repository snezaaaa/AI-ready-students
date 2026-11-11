// Mission 1 puzzle rules. Pure data + logic (no React / three) so it is unit-testable.

export const SLOTS = [
  { id: 'role', label: 'ULOGA', color: '#f472b6', question: 'KO treba da bude AI?' },
  { id: 'task', label: 'ZADATAK', color: '#60a5fa', question: 'ŠTA tačno treba da uradi?' },
  { id: 'context', label: 'KONTEKST', color: '#34d399', question: 'ZA KOGA i u kakvoj situaciji?' },
  { id: 'format', label: 'FORMAT', color: '#fbbf24', question: 'KAKO treba da izgleda odgovor?' },
];

// `good` cards must be found in the room first. Decoys are always available (and always wrong).
export const CARDS = {
  role: [
    { id: 'role_good', good: true, text: 'Ti si strpljiv tutor iz biologije koji objašnjava srednjoškolcima.' },
    { id: 'role_toaster', text: 'Ti si toster. Toster koji misli.',
      fail: 'BIP. KAO TOSTER, MOJ PLAN UČENJA JE: 1) Hljeb. 2) Toplota. 3) Tost. Da ti kontrolni bude blago zapečen?' },
    { id: 'role_none', text: '(bez uloge, snaći će se AI sam)',
      fail: 'Zdravo! Ja sam Opšti Asistent. Evo opšteg odgovora o opštim stvarima, napisanog sasvim uopšteno.' },
  ],
  task: [
    { id: 'task_good', good: true, text: 'Napravi mi plan učenja za kontrolni iz fotosinteze.' },
    { id: 'task_vague', text: 'Uradi nešto sa biljkama, valjda.',
      fail: 'Zadatak završen. Pružio sam emotivnu podršku jednom fikusu. Sad mu je mnogo bolje.' },
    { id: 'task_huge', text: 'Objasni mi cijelu biologiju. Sve. Odmah.',
      fail: 'Počinjem „Cijelu biologiju“. Završavam za oko 14.000 godina. Lekcija 1: Ćelija (1. dio od 9.000)...' },
  ],
  context: [
    { id: 'context_good', good: true, text: 'Ja sam učenik 1. razreda gimnazije, kontrolni je za 3 dana, imam 30 min dnevno i slabije razumijem hemijski dio.' },
    { id: 'context_tuesday', text: 'Kontekst: utorak je.',
      fail: 'Pošto je utorak, pretpostavio sam da imaš između 3 i 97 godina i laboratoriju u podrumu.' },
    { id: 'context_vibes', text: 'Bez konteksta. Samo vajb.',
      fail: 'Plan je spreman za doktora botanike sa laboratorijom od 2 miliona eura. Korak 1: kalibriši elektronski mikroskop.' },
  ],
  format: [
    { id: 'format_good', good: true, text: 'Daj tabelu: Dan, Šta učim, Kako se provjerim.' },
    { id: 'format_dance', text: 'Format odgovora: interpretativni ples.',
      fail: '[AI ustaje. Njiše se. Neodređeno pokazuje prema suncu. Duboko se klanja.] ...To je bio plan učenja.' },
    { id: 'format_wall', text: 'Jedan pasus od 47 strana. Bez novog reda.',
      fail: 'Fotosintezajeprocesukojembiljkepomoćusvjetlostipretvarajuvoduiugljendioksidušećerikiseonik... (strana 1 od 47)' },
  ],
};

export const HINTS = {
  role: 'ULOGA kaže AI-ju ko treba da bude. Stručna uloga = stručan odgovor. Toster pravi tost.',
  task: 'ZADATAK mora biti konkretan i izvodljiv: jedna jasna stvar, jasnog obima.',
  context: 'KONTEKST je ko si ti i u kakvoj si situaciji. Bez njega AI nagađa (loše).',
  format: 'FORMAT kaže AI-ju kako odgovor treba da izgleda, da bi mogao stvarno da ga koristiš.',
};

export const SUCCESS_OUTPUT = [
  'PLAN UČENJA: Fotosinteza (3 dana po 30 min, 1. razred)',
  '| Dan | Šta učim                                   | Kako se provjerim                       |',
  '| 1   | Šta je fotosinteza: svjetlost, voda, CO2   | Objasnim drugu u 3 rečenice, bez sveske |',
  '| 2   | Hemijski dio, polako: jednačina, dio po dio | Napišem jednačinu napamet i imenujem sve |',
  '| 3   | Ponavljanje + 10 pitanja kao na kontrolnom | Riješim bez gledanja, pa ispravim greške |',
  'Savjet tutora: hemijski dio ponovi svaki dan po 10 minuta. Malo, ali redovno.',
];

export const cardById = (id) => {
  for (const slot of SLOTS) {
    const c = CARDS[slot.id].find((x) => x.id === id);
    if (c) return { ...c, slot: slot.id };
  }
  return null;
};

/** Is this card selectable given what the player has collected? */
export const isCardAvailable = (card, slotId, inventory) => !card.good || inventory.includes(slotId);

/**
 * selection: { role: cardId|null, task: ..., context: ..., format: ... }
 * inventory: array of collected slot ids, e.g. ['role','task']
 */
export function evaluatePrompt(selection, inventory) {
  const results = {};
  let score = 0;
  const wrong = [];
  const missing = [];
  for (const slot of SLOTS) {
    const id = selection?.[slot.id];
    const card = id ? CARDS[slot.id].find((c) => c.id === id) : null;
    const usable = card && (!card.good || inventory.includes(slot.id));
    if (!usable) {
      results[slot.id] = 'missing';
      missing.push(slot.id);
    } else if (card.good) {
      results[slot.id] = 'ok';
      score += 25;
    } else {
      results[slot.id] = 'wrong';
      wrong.push(slot.id);
    }
  }
  const success = score === 100;
  let output;
  if (success) output = SUCCESS_OUTPUT.join('\n');
  else if (wrong.length) output = CARDS[wrong[0]].find((c) => c.id === selection[wrong[0]]).fail;
  else output = `GREŠKA 418: PROMPT NIJE POTPUN. Prazno je ostalo: ${missing.map((m) => SLOTS.find((s) => s.id === m).label).join(', ')}. Ja sam AI, ne čitam misli. (Probao sam. Bilo je neprijatno.)`;

  return { success, score, results, wrong, missing, output };
}

export const assemblePrompt = (selection) =>
  SLOTS.map((s) => (selection?.[s.id] ? CARDS[s.id].find((c) => c.id === selection[s.id])?.text : `[${s.label}?]`)).join(' ');
