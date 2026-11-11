// Mission 3 — KONAČNI PROMPT (a class poster of AI rules): Role + Task + Context + Format (Mission 1)
// + GUARDRAILS / "zaštitna pravila" (this mission).
// Pure data + logic (unit-testable). The guardrails card unlocks once all four seals are secured.
import { SEALS } from './dilemmas.js';

export const SLOTS = [
  { id: 'role', label: 'ULOGA', color: '#f472b6', question: 'Ko treba da bude AI?' },
  { id: 'task', label: 'ZADATAK', color: '#60a5fa', question: 'Šta tačno treba da uradi?' },
  { id: 'context', label: 'KONTEKST', color: '#34d399', question: 'Za koga i gdje?' },
  { id: 'format', label: 'FORMAT', color: '#fbbf24', question: 'Kako treba da izgleda?' },
  { id: 'guardrails', label: 'ZAŠTITA', color: '#c084fc', question: 'Kojih pravila se držimo?' },
];

const GOOD_GUARDRAILS = `Zaštitna pravila na plakatu: ${SEALS.map((s) => s.clause).join('; ')}.`;

export const CARDS = {
  role: [
    { id: 'f_role_pirate', text: 'Ti si gusar. Arrr.', fail: 'Ahoj, odjeljenje! Pravilo prvo: ko prepiše, šeta po dasci! Pravilo drugo: blago se ne dijeli. (Ovo ne može na zid učionice.)' },
    { id: 'f_role_good', good: true, text: 'Ti si dizajner školskih plakata koji piše kratko i jasno za tinejdžere.' },
    { id: 'f_role_admin', text: 'Ti si ARHIVAR. Slušaj i ćuti.', fail: 'UČENICI: POŠTUJTE PRAVILA. PRAVILA SU OBAVEZNA. PITANJA NISU. UŽIVAJTE U SLAJDU 1 OD 4.000.' },
  ],
  task: [
    { id: 'f_task_good', good: true, text: 'Napravi plakat „Pravila korištenja AI u našem odjeljenju“.' },
    { id: 'f_task_vague', text: 'Napiši nešto o kompjuterima.', fail: 'Kompjuteri su kutije sa lampicama. Neki su sivi. Hvala na pažnji. Kraj.' },
    { id: 'f_task_huge', text: 'Napiši pravilnik od 90 strana za svaku moguću situaciju.', fail: 'ČLAN 1.1.1.1: Definicije. 1.1.1.1.1: Riječ „i“. (Strana 1 od 90. Vrijeme čitanja: jedno polugodište.)' },
  ],
  context: [
    { id: 'f_ctx_engineers', text: 'Pretpostavi da su svi u odjeljenju AI inženjeri.', fail: 'Pravilo 1: transformer modele podešavajte samo uz LoRA adaptere. Pravilo 2: ponesite svoj GPU na čas fizičkog.' },
    { id: 'f_ctx_moon', text: 'Kontekst: mjesec je večeras baš lijep.', fail: 'Drago odjeljenje, mjesec je večeras zaista lijep. Koristite AI. Ili nemojte. Laku noć.' },
    { id: 'f_ctx_good', good: true, text: 'Za učenike 2. razreda srednje škole. Plakat stoji na zidu učionice i čita se za jedan minut.' },
  ],
  format: [
    { id: 'f_fmt_emoji', text: 'Jedna objava. Samo emodžiji.', fail: '🤖📚✅🍎🔒❓👀💯' },
    { id: 'f_fmt_good', good: true, text: 'Naslov i 5 kratkih pravila, svako u jednoj rečenici, jednostavnim riječima.' },
    { id: 'f_fmt_slides', text: 'Prezentacija od 47 slajdova.', fail: 'SLAJD 1 OD 47: Dobro došli. SLAJD 2 OD 47: Dobro došli (nastavak). SLAJD 3 OD 47: Zašto je dobrodošlica važna.' },
  ],
  guardrails: [
    { id: 'f_guard_none', text: 'Bez pravila. Samo opušteno.', fail: 'Na plakatu su sada imena svih 27 učenika, tri stereotipa i četiri činjenice koje sam izmislio. Već je zalijepljen u hodniku. Nema na čemu!' },
    { id: 'f_guard_good', good: true, requiresAllSeals: true, text: GOOD_GUARDRAILS },
    { id: 'f_guard_grades', text: 'Napiši imena i ocjene svih učenika, da bude ličnije.', fail: 'UPOZORENJE ZA PRIVATNOST: tražite da imena i ocjene svih učenika okačim na zid. Arhivar je oduševljen. Vaše odjeljenje nije.' },
  ],
};

export const SEAL_IDS = SEALS.map((s) => s.id);
export const hasAllSeals = (inventory) => SEAL_IDS.every((id) => inventory.includes(id));
export const isFinalCardAvailable = (card, _slotId, inventory) => !card.requiresAllSeals || hasAllSeals(inventory);

export const SUCCESS_OUTPUT = [
  'NACRT PLAKATA (odjeljenje ga pregleda prije štampe)',
  '',
  'PRAVILA KORIŠTENJA AI U NAŠEM ODJELJENJU',
  '1. AI nam pomaže da učimo. Ne radi umjesto nas.',
  '2. Kažemo kad smo koristili AI i kako.',
  '3. Ne dijelimo lične podatke, slike ni poruke. Ni svoje ni tuđe.',
  '4. Pazimo na stereotipe i tražimo raznolike primjere.',
  '5. Provjeravamo odgovore i odgovaramo za ono što predamo.',
  '',
  'Napomena: nacrt je napravljen uz pomoć AI. Odjeljenje ga je pregledalo i dopunilo.',
].join('\n');

export function evaluateFinalPrompt(selection, inventory) {
  const results = {};
  let score = 0;
  const wrong = [], missing = [];
  for (const slot of SLOTS) {
    const id = selection?.[slot.id];
    const card = id ? CARDS[slot.id].find((c) => c.id === id) : null;
    const usable = card && isFinalCardAvailable(card, slot.id, inventory);
    if (!usable) { results[slot.id] = 'missing'; missing.push(slot.id); }
    else if (card.good) { results[slot.id] = 'ok'; score += 20; }
    else { results[slot.id] = 'wrong'; wrong.push(slot.id); }
  }
  const success = score === 100;
  let output;
  if (success) output = SUCCESS_OUTPUT;
  else if (wrong.length) {
    // guardrail mistakes are the most important lesson in this mission, so show them first
    const first = wrong.includes('guardrails') ? 'guardrails' : wrong[0];
    output = CARDS[first].find((c) => c.id === selection[first]).fail;
  } else {
    output = `PROMPT NIJE POTPUN. Nedostaje: ${missing.map((m) => SLOTS.find((s) => s.id === m).label).join(', ')}.${missing.includes('guardrails') && !hasAllSeals(inventory) ? ' Kartica ZAŠTITA se otključava kad osvojiš sva četiri pečata.' : ''}`;
  }
  return { success, score, results, wrong, missing, output };
}

export const assembleFinal = (selection) =>
  SLOTS.map((s) => (selection?.[s.id] ? CARDS[s.id].find((c) => c.id === selection[s.id])?.text : `[${s.label}?]`)).join(' ');

export const HINTS = {
  role: 'ULOGA: ko bi napravio dobar plakat za učionicu? (Ne gusar.)',
  task: 'ZADATAK: jedna jasna, izvodljiva stvar.',
  context: 'KONTEKST: ko će čitati plakat i gdje će stajati?',
  format: 'FORMAT: kratko, pregledno, jednostavnim riječima.',
  guardrails: 'ZAŠTITA: sve što smo naučili kod četiri pečata: privatnost, poštenje, pravičnost i provjera.',
};
