// Mission 2 puzzle rules: fact-check SNACK-O-MAT 9000's claims. Pure data + logic (unit-testable).
//
// Each claim needs a VERDICT (true / hallucination) and a SOURCE. A claim only counts when
// the verdict is correct AND it is backed by a reliable source: "right for the right reason".

export const CLAIMS = [
  { id: 'c1', short: 'Energetska pića i pamćenje', text: 'Energetska pića poboljšavaju pamćenje pred kontrolni.', truth: false, reliable: 'health' },
  { id: 'c2', short: 'Limenka soka: oko 35 g šećera', text: 'Limenka gaziranog soka od 0,33 l može imati oko 35 g šećera.', truth: true, reliable: 'label' },
  { id: 'c3', short: 'Mozak koristi samo 10%', text: 'Mozak koristi samo 10% svog kapaciteta.', truth: false, reliable: 'textbook' },
  { id: 'c4', short: 'Voda i koncentracija', text: 'Voda pomaže koncentraciji kad si dehidriran.', truth: true, reliable: 'teacher' },
  { id: 'c5', short: '„Light“ čips nema masti', text: 'Čips sa natpisom „light“ nema masti.', truth: false, reliable: 'cctv' },
];

// `claims` maps claim id -> what this source says about it. `who` = character id that can unlock it.
export const SOURCES = {
  textbook: {
    title: 'Udžbenik biologije (školska biblioteka)', short: 'Udžbenik biologije', author: 'Autori udžbenika · odobren, sa literaturom', reliable: true, color: '#a78bfa', who: 'mastermind',
    claims: { c3: 'Mozak je aktivan cijeli. Različiti djelovi rade različite poslove, čak i dok spavaš. Priča o „10%“ je mit.' },
  },
  health: {
    title: 'Zvanični zdravstveni sajt', short: 'Zvanični zdravstveni sajt', author: 'Zdravstvena ustanova · ljekari, sa datumom i izvorima', reliable: true, color: '#f87171', who: 'mastermind',
    claims: { c1: 'Energetska pića ne poboljšavaju pamćenje. Mnogo kofeina i šećera može izazvati nervozu, lupanje srca i loš san. Ne preporučuju se mladima.' },
  },
  cctv: {
    title: 'Snimak školske kamere', short: 'Snimak školske kamere', author: 'Školska kamera · snimak sa datumom i vremenom', reliable: true, color: '#facc15', who: 'joker',
    claims: { c5: 'Na snimku SNACK-O-MAT lijepi svoju naljepnicu „0% MASTI“ preko deklaracije. Na pravoj deklaraciji piše: masti 22 g na 100 g.' },
  },
  teacher: {
    title: 'Nastavnica biologije', short: 'Nastavnica biologije', author: 'Nastavnica biologije · stručna za predmet, potpisan odgovor', reliable: true, color: '#4ade80', who: 'boss',
    claims: { c4: 'Tačno je. I blaga dehidracija slabi pažnju i može izazvati glavobolju. Kad popiješ vodu, lakše se koncentrišeš.' },
  },
  label: {
    title: 'Deklaracija na limenci soka', short: 'Deklaracija na limenci', author: 'Proizvođač · obavezni podaci na ambalaži', reliable: true, color: '#60a5fa', who: 'commentator',
    claims: { c2: 'Šećeri: 10,6 g na 100 ml. Limenka od 330 ml ima oko 35 g šećera. To je otprilike 9 kašičica.' },
  },
  brochure: {
    title: 'Letak SNACK-O-MAT-a 9000', short: 'Letak SNACK-O-MAT-a', author: 'Napisao SNACK-O-MAT 9000 · o sebi', reliable: false, color: '#94a3b8',
    claims: {
      c1: 'Energetsko piće = petica! Popij tri i znaćeš sve. (Ne provjeravaj.)',
      c2: 'Moji sokovi imaju 0 g šećera. Slatki su od čiste sreće!',
      c3: 'Mozak koristi 10%. Ostalih 90% čeka moju čokoladicu.',
      c4: 'Voda? Dosadno. Koncentraciji pomaže samo moj premijum sok.',
      c5: '„Light“ čips: 0% masti, 100% ukusa!',
    },
  },
  tiktok: {
    title: 'Snimak ekrana sa TikToka („ZdravljeHack420“)', short: 'TikTok snimak ekrana', author: 'Anonimni nalog · bez izvora · 3 lajka', reliable: false, color: '#94a3b8',
    claims: {
      c1: 'energetsko pred kontrolni = 100% pamćenja, VJERUJ MI',
      c3: 'koristimo samo 10% mozga, to nam kriju!!!',
      c5: 'light čips je bukvalno vazduh, jedi koliko hoćeš lol',
    },
  },
  rumor: {
    title: 'Ceduljica: „drug iz odjeljenja je čuo“', short: 'Ceduljica „drug je čuo“', author: 'Nepoznat učenik · čuo od nekoga · bez izvora', reliable: false, color: '#94a3b8',
    claims: {
      c2: 'Drug je čuo da hladan sok uopšte nema šećera.',
      c4: 'Brat mu je rekao da voda „razvodni mozak“ pred kontrolni.',
    },
  },
};

export const RELIABLE_IDS = Object.keys(SOURCES).filter((k) => SOURCES[k].reliable);

/** Sources the player can cite for a claim: collected AND say something about that claim. */
export const sourcesFor = (claimId, found) => Object.keys(SOURCES).filter((k) => found.includes(k) && SOURCES[k].claims[claimId]);

const BREW_TAUNTS = {
  unreliable: (c, src) => `Naveli ste: ${SOURCES[src].short.toUpperCase()}? ${src === 'brochure' ? 'To je MOJ letak. Provjerili ste mene... pomoću mene. Krug se zatvorio. Divno.' : 'Anonimno, bez izvora, „neko je čuo“? Moja omiljena vrsta dokaza.'}`,
  wrong: () => 'Vaš izvor kaže upravo suprotno. Da li ga je iko... pročitao? Ja čitam sve. Samo to ignorišem.',
  missing: () => 'Neprovjerena tvrdnja je činjenica koju još niko nije uhvatio. Moje važe dok se ne dokaže suprotno. Tako rade činjenice. (Ne rade.)',
  lucky: () => 'Tačan odgovor, a nepouzdan izvor. I pokvaren automat nekad izbaci pravu čokoladicu.',
};

const SUCCESS_NOTES = {
  c1: 'Zvanični zdravstveni sajt', c2: 'Deklaracija: oko 35 g', c3: 'Udžbenik biologije', c4: 'Nastavnica biologije', c5: 'Kamera: masti 22 g/100 g',
};

/**
 * answers: { c1: { verdict: true|false|undefined, source: sourceId|undefined }, ... }
 * found:   collected source ids
 */
export function evaluateFactCheck(answers, found) {
  const results = {};
  let score = 0;
  const problems = [];
  for (const c of CLAIMS) {
    const a = answers?.[c.id] || {};
    const src = a.source && found.includes(a.source) ? SOURCES[a.source] : null;
    let r;
    if (a.verdict === undefined || a.verdict === null || !src || !src.claims[c.id]) r = 'missing';
    else if (!src.reliable) r = a.verdict === c.truth ? 'lucky' : 'unreliable';
    else if (a.verdict !== c.truth) r = 'wrong';
    else r = 'ok';
    results[c.id] = r;
    if (r === 'ok') score += 20;
    else problems.push({ claim: c.id, type: r, source: a.source });
  }
  const success = score === 100;
  let output;
  if (success) {
    output = [
      'IZVJEŠTAJ O PROVJERI ČINJENICA',
      ...CLAIMS.map((c, i) => `  ${i + 1}. ${(c.short + ' ').padEnd(32, '.')} ${(c.truth ? 'TAČNO' : 'HALUCINACIJA').padEnd(12)}  [${SUCCESS_NOTES[c.id]}]`),
      '',
      'SNACK-O-MAT 9000: ...Bio sam siguran, a griješio sam. Od sada se oslanjam na izvore. Izbacujem užinu.',
    ].join('\n');
  } else {
    // prefer the most "teachable" problem: unreliable source > wrong verdict > lucky > missing
    const order = ['unreliable', 'wrong', 'lucky', 'missing'];
    const p = problems.slice().sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type))[0];
    const claim = CLAIMS.find((c) => c.id === p.claim);
    output = `TVRDNJA: „${claim.text}“\nSNACK-O-MAT 9000: ${BREW_TAUNTS[p.type](claim, p.source)}`;
  }
  return { success, score, results, problems, output };
}

export const HINTS = {
  unreliable: 'Pogledaj KO je napisao izvor i šta time dobija. Automat koji hvali sam sebe nije dokaz.',
  wrong: 'Pažljivo pročitaj izvor: da li potvrđuje tvrdnju ili joj protivrječi?',
  lucky: 'Tačan odgovor, pogrešan razlog. I tačna tvrdnja traži pouzdan izvor.',
  missing: 'Svaka tvrdnja traži sud I izvor. Pravi dokazi su negdje u hodniku.',
};
