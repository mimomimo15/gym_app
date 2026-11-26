/* Journal de gym – petites animations qui montrent comment faire un exercice.
   Un bonhomme en traits (SVG) passe d'une position à l'autre, en aller-retour.
   Chaque mouvement donne quelques positions clés : hanche, épaule, mains, pieds.
   Les coudes et les genoux sont calculés (bras et jambes gardent leur longueur).
   Aucune image externe : tout est dessiné ici. */
(function () {
  'use strict';

  // Longueurs des segments (unités du dessin, cadre 200 × 140, sol à y = 128)
  const L = { torso: 40, neck: 6, head: 7, arm: 20, fore: 18, thigh: 24, shin: 24 };
  const FLOOR = 128;

  /* Positions clés. Pour chaque position :
     hip [x,y] ; sh [x,y] (direction du buste, ramené à sa longueur) ;
     hand / hand2 [x,y] absolus, ou handS [dx,dy] (par rapport à l'épaule), ou handH (par rapport à la hanche) ;
     foot / foot2 [x,y]. Les membres « 2 » sont ceux du côté éloigné (dessinés plus clairs).
     shW / hipW : demi-largeur des épaules / hanches (vue de face, les deux côtés sont dessinés pareil).
     elbow / knee : sens de pliage (1 ou -1).
     props : bar (barre vue de côté, aux mains), db (haltères), bench [x, y, largeur], hbar [x1, y, x2] (barre fixe),
     cable [x, y] (câble de poulie jusqu'aux mains), posts (montants), nofloor. */
  const S = [100, 40], H = [100, 80];   // épaule et hanche d'une personne debout
  const MOVES = {
    squat: {
      title: 'Squat',
      tips: ['Pieds largeur d\'épaules, poids sur tout le pied', 'Descends en poussant les fesses vers l\'arrière, dos droit', 'Genoux dans l\'axe des pieds, remonte en poussant dans le sol'],
      props: { bar: 1 }, elbow: -1, knee: -1,
      frames: [
        { hip: [96, 80], sh: [98, 40], handS: [-4, 2], foot: [104, FLOOR] },
        { hip: [76, 106], sh: [100, 72], handS: [-4, 2], foot: [104, FLOOR] }
      ]
    },
    bench: {
      title: 'Développé couché',
      tips: ['Omoplates serrées, pieds bien à plat au sol', 'Descends la barre doucement jusqu\'au bas des pectoraux', 'Pousse vers le haut sans décoller les fesses du banc'],
      props: { bar: 1, bench: [44, 94, 86] }, elbow: 1, knee: -1,
      frames: [
        { hip: [112, 90], sh: [72, 90], hand: [74, 54], foot: [142, FLOOR] },
        { hip: [112, 90], sh: [72, 90], hand: [78, 80], foot: [142, FLOOR] }
      ]
    },
    deadlift: {
      title: 'Soulevé de terre',
      tips: ['Barre collée aux tibias, dos plat, regard devant', 'Pousse dans le sol avec les jambes, la barre frôle les jambes', 'Debout, serre les fessiers sans te pencher en arrière'],
      props: { bar: 1 }, elbow: 1, knee: -1,
      frames: [
        { hip: [80, 100], sh: [116, 83], hand: [108, 119], foot: [104, FLOOR] },
        { hip: [98, 80], sh: [99, 40], hand: [101, 76], foot: [104, FLOOR] }
      ]
    },
    press: {
      title: 'Développé militaire',
      tips: ['Debout, gainé, fessiers serrés', 'Pousse la barre à la verticale, la tête passe sous la barre', 'Redescends doucement jusqu\'au haut de la poitrine'],
      props: { bar: 1 }, elbow: 1, knee: -1,
      frames: [
        { hip: H, sh: S, hand: [104, 42], foot: [100, FLOOR] },
        { hip: H, sh: S, hand: [102, 4], foot: [100, FLOOR] }
      ]
    },
    lateral: {
      title: 'Élévations latérales',
      tips: ['Coudes légèrement fléchis', 'Monte les bras sur les côtés jusqu\'à hauteur d\'épaules', 'Redescends lentement, sans élan'],
      props: { db: 1 }, elbow: -1, knee: -1,
      frames: [
        { hip: H, sh: S, shW: 12, hipW: 5, hand: [88, 77.5], hand2: [112, 77.5], foot: [94, FLOOR], foot2: [106, FLOOR] },
        { hip: H, sh: S, shW: 12, hipW: 5, hand: [53, 46], hand2: [147, 46], foot: [94, FLOOR], foot2: [106, FLOOR] }
      ]
    },
    curl: {
      title: 'Curl biceps',
      tips: ['Coudes collés au corps, ils ne bougent pas', 'Monte en pliant seulement les coudes', 'Redescends lentement jusqu\'aux bras presque tendus'],
      props: { db: 1 }, elbow: 1, knee: -1,
      frames: [
        { hip: H, sh: S, hand: [103, 77], foot: [100, FLOOR] },
        { hip: H, sh: S, hand: [118, 62], foot: [100, FLOOR] },
        { hip: H, sh: S, hand: [110, 44], foot: [100, FLOOR] }
      ]
    },
    triceps: {
      title: 'Extension triceps à la poulie',
      tips: ['Coudes collés au corps', 'Pousse vers le bas jusqu\'aux bras tendus', 'Remonte lentement jusqu\'à hauteur de poitrine'],
      props: { cable: [118, 0] }, elbow: 1, knee: -1,
      frames: [
        { hip: H, sh: S, hand: [114, 49], foot: [100, FLOOR] },
        { hip: H, sh: S, hand: [105, 77], foot: [100, FLOOR] }
      ]
    },
    row: {
      title: 'Rowing barre',
      tips: ['Penché vers l\'avant, dos plat, genoux un peu fléchis', 'Tire la barre vers le nombril en serrant les omoplates', 'Redescends sans arrondir le dos'],
      props: { bar: 1 }, elbow: 1, knee: -1,
      frames: [
        { hip: [84, 92], sh: [122, 78], hand: [120, 114], foot: [104, FLOOR] },
        { hip: [84, 92], sh: [122, 78], hand: [106, 98], foot: [104, FLOOR] }
      ]
    },
    pullup: {
      title: 'Tractions',
      tips: ['Pars bras tendus, épaules engagées', 'Tire les coudes vers le bas jusqu\'au menton au-dessus de la barre', 'Redescends doucement, sans balancer'],
      props: { hbar: [72, 14, 128], nofloor: 1 }, elbow: 1, knee: 1,
      frames: [
        { hip: [100, 92], sh: [100, 52], hand: [100, 16], foot: [86, 124] },
        { hip: [100, 66], sh: [100, 26], hand: [100, 16], foot: [86, 98] }
      ]
    },
    pulldown: {
      title: 'Tirage vertical',
      tips: ['Assis, cuisses calées, buste un peu en arrière', 'Tire la barre vers le haut de la poitrine', 'Remonte en contrôlant, bras presque tendus'],
      props: { bench: [64, 100, 40], cable: [100, 0] }, elbow: 1, knee: -1,
      frames: [
        { hip: [90, 96], sh: [86, 56], hand: [94, 20], foot: [120, FLOOR] },
        { hip: [90, 96], sh: [86, 56], hand: [92, 61], foot: [120, FLOOR] }
      ]
    },
    dips: {
      title: 'Dips',
      tips: ['Bras tendus, épaules basses', 'Descends jusqu\'aux coudes à 90°', 'Remonte en poussant dans les barres'],
      props: { hbar: [84, 70, 120], posts: 1 }, elbow: 1, knee: 1,
      frames: [
        { hip: [101, 74], sh: [100, 34], hand: [100, 70], foot: [84, 104] },
        { hip: [97, 96], sh: [102, 56], hand: [100, 70], foot: [82, 124] }
      ]
    },
    pushup: {
      title: 'Pompes',
      tips: ['Corps droit de la tête aux pieds, ventre serré', 'Mains un peu plus larges que les épaules', 'Descends la poitrine près du sol, puis pousse'],
      props: {}, elbow: 1, knee: -1,
      frames: [
        { hip: [98, 108], sh: [136, 92], hand: [136, FLOOR], foot: [54, 127] },
        { hip: [101.5, 120], sh: [141, 114], hand: [136, FLOOR], foot: [54, 127] }
      ]
    },
    lunge: {
      title: 'Fentes',
      tips: ['Grand pas, buste droit', 'Descends le genou arrière près du sol', 'Genou avant au-dessus de la cheville, pousse pour remonter'],
      props: {}, elbow: 1, knee: -1, knee2: -1,
      frames: [
        { hip: [98, 88], sh: [98, 48], handH: [8, -6], foot: [122, FLOOR], foot2: [72, 127] },
        { hip: [96, 102], sh: [96, 62], handH: [8, -6], foot: [122, FLOOR], foot2: [72, 127] }
      ]
    },
    hipthrust: {
      title: 'Hip thrust',
      tips: ['Haut du dos appuyé sur le banc, pieds à plat', 'Monte les hanches en serrant les fessiers', 'En haut, le corps est droit des épaules aux genoux'],
      props: { bar: 1, bench: [26, 96, 40] }, elbow: -1, knee: -1,
      frames: [
        { hip: [98, 116], sh: [62, 96], handH: [-4, -6], foot: [126, FLOOR] },
        { hip: [100, 96], sh: [60, 92], handH: [-4, -6], foot: [126, FLOOR] }
      ]
    },
    crunch: {
      title: 'Crunch',
      tips: ['Allongé, genoux pliés, pieds au sol', 'Enroule le haut du dos en soufflant', 'Redescends lentement, sans tirer sur la nuque'],
      props: {}, elbow: -1, knee: -1,
      frames: [
        { hip: [100, 122], sh: [60, 122], hand: [90, 110], foot: [128, 126] },
        { hip: [100, 122], sh: [70, 96], hand: [104, 96], foot: [128, 126] }
      ]
    },
    abduction: {
      title: 'Abduction de hanche couché',
      tips: ['Couché sur le côté, corps bien aligné', 'Élastique au-dessus des genoux', 'Monte la jambe du dessus sans rouler vers l\'arrière, puis redescends lentement'],
      props: { band: 'knees' }, elbow: -1, knee: 1,
      frames: [
        { hip: [100, 120], sh: [60, 120], handH: [-8, -4], foot: [148, 120], foot2: [148, 124] },
        { hip: [100, 120], sh: [60, 120], handH: [-8, -4], foot: [143, 96], foot2: [148, 124] }
      ]
    },
    sidewalk: {
      title: 'Marche latérale avec élastique',
      tips: ['Élastique autour des genoux', 'Genoux légèrement fléchis, buste droit', 'Petits pas de côté, sans laisser les pieds se rapprocher'],
      props: { band: 'knees' }, elbow: 1, knee: -1,
      frames: [
        { hip: [94, 84], sh: [94, 44], shW: 12, hipW: 5, hand: [83, 80], hand2: [105, 80], foot: [88, FLOOR], foot2: [102, FLOOR] },
        { hip: [102, 84], sh: [102, 44], shW: 12, hipW: 5, hand: [91, 80], hand2: [113, 80], foot: [88, FLOOR], foot2: [118, FLOOR] }
      ]
    },
    bridge1: {
      title: 'Pont fessier sur une jambe',
      tips: ['Sur le dos, un pied au sol, l\'autre jambe tendue', 'Monte les hanches en poussant dans le talon', 'Tiens 2 secondes en haut, puis redescends lentement'],
      props: {}, elbow: -1, knee: -1, knee2: -1, period: 3600,
      frames: [
        { hip: [96, 123], sh: [56, 124], hand: [93, 127], foot: [124, FLOOR], foot2: [142, 110] },
        { hip: [98, 104], sh: [58, 122], hand: [97, 127], foot: [124, FLOOR], foot2: [141.8, 84.3] },
        { hip: [98, 104], sh: [58, 122], hand: [97, 127], foot: [124, FLOOR], foot2: [141.8, 84.3] }
      ]
    },
    bridge: {
      title: 'Pont fessier',
      tips: ['Sur le dos, genoux pliés, pieds à plat', 'Monte les hanches en serrant les fessiers', 'Redescends lentement'],
      props: {}, elbow: -1, knee: -1,
      frames: [
        { hip: [96, 123], sh: [56, 124], hand: [93, 127], foot: [124, FLOOR] },
        { hip: [98, 104], sh: [58, 122], hand: [97, 127], foot: [124, FLOOR] }
      ]
    },
    wallsit: {
      title: 'Chaise au mur',
      tips: ['Dos collé au mur, pieds devant toi', 'Descends jusqu\'à environ 60° de flexion aux genoux', 'Tiens la position en respirant normalement'],
      props: { wall: 60 }, elbow: 1, knee: -1, period: 6000,
      frames: [
        { hip: [65, 82], sh: [64, 42], handH: [8, -6], foot: [86, FLOOR] },
        { hip: [65, 100], sh: [64, 60], handH: [10, -6], foot: [86, FLOOR] },
        { hip: [65, 100], sh: [64, 60], handH: [10, -6], foot: [86, FLOOR] }
      ]
    },
    tke: {
      title: 'Extension terminale du genou',
      tips: ['Élastique attaché devant toi, passé derrière le genou', 'Pars genou un peu fléchi', 'Tends complètement la jambe contre l\'élastique, puis relâche doucement'],
      props: { band: [152, 104], post: [152, 96] }, elbow: 1, knee: -1, knee2: -1,
      frames: [
        { hip: [96, 87], sh: [96, 47], handH: [6, -4], foot: [100, FLOOR], foot2: [88, FLOOR] },
        { hip: [99, 81], sh: [99, 41], handH: [6, -4], foot: [100, FLOOR], foot2: [88, FLOOR] }
      ]
    },
    stepdown: {
      title: 'Step-down lent',
      tips: ['Debout sur une marche, sur une jambe', 'Descends en 3 secondes jusqu\'à toucher le sol du talon', 'Genou aligné avec le 2e orteil, il ne rentre pas vers l\'intérieur'],
      props: { step: [64, 112, 46] }, elbow: 1, knee: -1, knee2: -1, period: 4400,
      frames: [
        { hip: [95, 66], sh: [96, 26], handH: [8, -4], foot: [96, 112], foot2: [112, 108] },
        { hip: [86, 86], sh: [93, 47], handH: [8, -4], foot: [96, 112], foot2: [110, FLOOR] }
      ]
    }
  };

  /* ---------- géométrie ---------- */
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const lerp = (a, b, t) => a + (b - a) * t;
  const lerpP = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t)];

  // Genou ou coude : deux segments de longueur l1, l2 entre a et c, pliés du côté s
  function joint(a, c, l1, l2, s) {
    const dx = c[0] - a[0], dy = c[1] - a[1];
    let d = Math.hypot(dx, dy);
    d = Math.max(Math.abs(l1 - l2) + 0.01, Math.min(l1 + l2 - 0.01, d || 0.01));
    const base = Math.atan2(dy, dx);
    const ang = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d));
    const j = [a[0] + l1 * Math.cos(base + s * ang), a[1] + l1 * Math.sin(base + s * ang)];
    const k = Math.atan2(c[1] - j[1], c[0] - j[0]);
    return [j, [j[0] + l2 * Math.cos(k), j[1] + l2 * Math.sin(k)]];
  }

  // Position complète du corps à partir d'une position clé
  function solve(f, mv) {
    const hip = f.hip;
    const dx = f.sh[0] - hip[0], dy = f.sh[1] - hip[1], n = Math.hypot(dx, dy) || 1;
    const dir = [dx / n, dy / n];
    const sh = [hip[0] + dir[0] * L.torso, hip[1] + dir[1] * L.torso];
    const head = [sh[0] + dir[0] * (L.neck + L.head), sh[1] + dir[1] * (L.neck + L.head)];
    const sh2 = f.shW ? [sh[0] + f.shW, sh[1]] : sh;
    const sh1 = f.shW ? [sh[0] - f.shW, sh[1]] : sh;
    const hip1 = f.hipW ? [hip[0] - f.hipW, hip[1]] : hip;
    const hip2 = f.hipW ? [hip[0] + f.hipW, hip[1]] : hip;
    const target = (abs, rs, rh, base) => abs || (rs ? add(base, rs) : rh ? add(hip, rh) : null);
    const body = { hip, sh, head, dir, limbs: [], knees: [] };
    const arm = (from, to, s, far) => { const [e, h] = joint(from, to, L.arm, L.fore, s); body.limbs.push({ pts: [from, e, h], far }); return h; };
    const leg = (from, to, s, far) => { const [k, a] = joint(from, to, L.thigh, L.shin, s); body.limbs.push({ pts: [from, k, a], far }); body.knees.unshift(k); return a; };
    if (f.foot2) leg(hip2, f.foot2, f.knee2 != null ? f.knee2 : (mv.knee2 != null ? mv.knee2 : mv.knee), !f.shW);
    if (f.hand2 || f.hand2S) body.hand2 = arm(sh2, target(f.hand2, f.hand2S, null, sh2), mv.elbow2 != null ? mv.elbow2 : -mv.elbow, !f.shW);
    body.foot = leg(hip1, f.foot, mv.knee, false);
    body.hand = arm(sh1, target(f.hand, f.handS, f.handH, sh1), mv.elbow, false);
    return body;
  }

  // Mélange de deux positions clés (t entre 0 et 1)
  function mix(a, b, t) {
    const o = {};
    for (const k of Object.keys(a)) o[k] = Array.isArray(a[k]) ? lerpP(a[k], b[k], t) : a[k];
    return o;
  }

  // Position clé au temps « phase » (0 → 1 → 0), avec un petit arrêt à chaque bout
  function frameAt(mv, phase) {
    const fr = mv.frames, seg = fr.length - 1;
    const x = Math.min(1, Math.max(0, phase)) * seg, i = Math.min(seg - 1, Math.floor(x));
    const t = x - i, e = (1 - Math.cos(Math.PI * t)) / 2;
    return mix(fr[i], fr[i + 1], e);
  }

  /* ---------- dessin ---------- */
  const r1 = v => Math.round(v * 10) / 10;
  const pl = pts => pts.map(p => r1(p[0]) + ',' + r1(p[1])).join(' ');

  function propsStatic(mv) {
    let s = '';
    const p = mv.props || {};
    if (!p.nofloor) s += '<line class="mv-floor" x1="8" y1="' + FLOOR + '" x2="192" y2="' + FLOOR + '"/>';
    if (p.bench) {
      const [x, y, w] = p.bench;
      s += '<rect class="mv-prop" x="' + x + '" y="' + y + '" width="' + w + '" height="7" rx="2"/>' +
        '<line class="mv-prop-l" x1="' + (x + 10) + '" y1="' + (y + 7) + '" x2="' + (x + 10) + '" y2="' + FLOOR + '"/>' +
        '<line class="mv-prop-l" x1="' + (x + w - 10) + '" y1="' + (y + 7) + '" x2="' + (x + w - 10) + '" y2="' + FLOOR + '"/>';
    }
    if (p.wall != null) s += '<line class="mv-prop-l mv-hbar" x1="' + p.wall + '" y1="0" x2="' + p.wall + '" y2="' + FLOOR + '"/>';
    if (p.step) { const [x, y, w] = p.step; s += '<rect class="mv-prop" x="' + x + '" y="' + y + '" width="' + w + '" height="' + (FLOOR - y) + '" rx="2"/>'; }
    if (p.post) s += '<line class="mv-prop-l mv-hbar" x1="' + p.post[0] + '" y1="' + p.post[1] + '" x2="' + p.post[0] + '" y2="' + FLOOR + '"/>';
    if (p.hbar) {
      const [x1, y, x2] = p.hbar;
      if (p.posts) s += '<line class="mv-prop-l" x1="' + (x2 - 4) + '" y1="' + y + '" x2="' + (x2 - 4) + '" y2="' + FLOOR + '"/>';
      s += '<line class="mv-prop-l mv-hbar" x1="' + x1 + '" y1="' + y + '" x2="' + x2 + '" y2="' + y + '"/>';
    }
    return s;
  }

  function bodySVG(b, mv, cls) {
    const p = mv.props || {};
    let s = '<g class="' + (cls || 'mv-body') + '">';
    if (p.cable) s += '<line class="mv-cable" x1="' + p.cable[0] + '" y1="' + p.cable[1] + '" x2="' + r1(b.hand[0]) + '" y2="' + r1(b.hand[1]) + '"/>';
    b.limbs.filter(l => l.far).forEach(l => { s += '<polyline class="mv-far" points="' + pl(l.pts) + '"/>'; });
    s += '<line x1="' + r1(b.hip[0]) + '" y1="' + r1(b.hip[1]) + '" x2="' + r1(b.sh[0]) + '" y2="' + r1(b.sh[1]) + '"/>';
    b.limbs.filter(l => !l.far).forEach(l => { s += '<polyline points="' + pl(l.pts) + '"/>'; });
    s += '<circle class="mv-head" cx="' + r1(b.head[0]) + '" cy="' + r1(b.head[1]) + '" r="' + L.head + '"/>';
    // Élastique : entre les deux genoux, ou d'un point fixe jusqu'au genou
    const ln = (a, c) => '<line class="mv-band" x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(c[0]) + '" y2="' + r1(c[1]) + '"/>';
    if (p.band === 'knees' && b.knees.length > 1) s += ln(b.knees[0], b.knees[1]);
    if (Array.isArray(p.band)) s += ln(p.band, b.knees[0]);
    const hs = [b.hand].concat(b.hand2 ? [b.hand2] : []);
    if (p.bar) s += '<circle class="mv-plate" cx="' + r1(b.hand[0]) + '" cy="' + r1(b.hand[1]) + '" r="9"/><circle class="mv-axle" cx="' + r1(b.hand[0]) + '" cy="' + r1(b.hand[1]) + '" r="2"/>';
    if (p.db) hs.forEach(h => { s += '<rect class="mv-plate" x="' + r1(h[0] - 6) + '" y="' + r1(h[1] - 4) + '" width="12" height="8" rx="2"/>'; });
    if (p.cable) s += '<rect class="mv-plate" x="' + r1(b.hand[0] - 5) + '" y="' + r1(b.hand[1] - 2) + '" width="10" height="4" rx="2"/>';
    return s + '</g>';
  }

  function frameSVG(mv, phase) { return bodySVG(solve(frameAt(mv, phase), mv), mv); }

  /* ---------- reconnaissance du nom ---------- */
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // Dans l'ordre : le premier qui correspond gagne. « no » = mots qui excluent ce mouvement.
  const RULES = [
    // Programme maison d'abord : « abduction … couché » ne doit pas donner le développé couché, etc.
    ['abduction', /abduction|abducteur/],
    ['sidewalk', /marche laterale|pas (lateraux|chasses?)|monster walk|lateral (band )?walk|band walk/],
    ['bridge1', /pont (fessier )?(sur )?(une|1) jambe|single leg (glute )?bridge|pont unipodal/],
    ['bridge', /pont fessier|glute bridge/, /hip ?thrust|banc/],
    ['wallsit', /chaise|wall ?sit/],
    ['tke', /extension terminale|\btke\b|terminal knee/],
    ['stepdown', /step ?down|descente (de|d une) marche/],
    ['lateral', /elevations? lat|lateral/],
    ['dips', /\bdips?\b/],
    ['pushup', /pompe|push ?ups?\b/],
    ['pulldown', /tirage (vertical|poitrine|nuque|haut|devant)|lat ?pull|pull ?down/],
    ['pullup', /traction|pull ?ups?\b|chin ?ups?\b/],
    ['row', /rowing|\brow\b|tirage (horizontal|barre|haltere|bucheron|assis|bas)|bucheron/],
    ['curl', /curl/, /leg|jambe|ischio|femora/],
    ['triceps', /triceps|push ?down|poulie haute/],
    ['bench', /couche|bench|(developpe|press) (incline|decline)|chest press/],
    ['press', /militaire|overhead|\bohp\b|shoulder press|arnold|epaule|developpe (assis|debout)/],
    ['lunge', /fente|lunge|bulgare/],
    ['squat', /squat|accroupi/],
    ['deadlift', /souleve|deadlift|\bsdt\b|\brdl\b|roumain/],
    ['hipthrust', /hip ?thrust|pont fessier|glute bridge/],
    ['crunch', /crunch|abdo|sit ?ups?\b/]
  ];
  function find(name) {
    const n = norm(name); if (!n) return null;
    for (const [id, re, no] of RULES) if (re.test(n) && !(no && no.test(n))) return id;
    return null;
  }

  /* ---------- animation ---------- */
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const PERIOD = 2800;   // un aller-retour, en millisecondes
  let raf = 0;

  function tick(now) {
    raf = 0;
    // Seulement les animations visibles ; s'il n'y en a plus (éditeur fermé…), la boucle s'arrête d'elle-même
    const svgs = Array.from(document.querySelectorAll('svg.mv-svg[data-mv]')).filter(s => s.getClientRects().length);
    if (!svgs.length || document.hidden || reduce()) return;
    svgs.forEach(svg => {
      const mv = MOVES[svg.dataset.mv], g = svg.querySelector('.mv-live'); if (!mv || !g) return;
      const per = mv.period || PERIOD, ph = (now % per) / per;
      g.innerHTML = frameSVG(mv, ph < 0.5 ? ph * 2 : 2 - ph * 2);
    });
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!raf && !reduce()) raf = requestAnimationFrame(tick); }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });

  // Dessin d'un mouvement (sans animation : position de départ, et la position d'arrivée en clair)
  function svg(id) {
    const mv = MOVES[id]; if (!mv) return '';
    const ghost = reduce() ? bodySVG(solve(mv.frames[mv.frames.length - 1], mv), mv, 'mv-body mv-ghost') : '';
    return '<svg class="mv-svg" data-mv="' + id + '" viewBox="0 0 200 140" role="img" aria-label="' + mv.title + ' : animation du mouvement">' +
      propsStatic(mv) + ghost + '<g class="mv-live">' + frameSVG(mv, 0) + '</g></svg>';
  }

  // Bloc complet : animation + conseils
  function panel(id) {
    const mv = MOVES[id]; if (!mv) return '';
    return '<div class="mv-panel">' + svg(id) +
      '<div class="mv-text"><div class="mv-title">' + mv.title + '</div><ul>' + mv.tips.map(t => '<li>' + t + '</li>').join('') + '</ul></div></div>';
  }

  window.JGMoves = { find, svg, panel, start, stop, list: () => Object.keys(MOVES), title: id => MOVES[id] && MOVES[id].title, _norm: norm,
    _frame: (id, p) => propsStatic(MOVES[id]) + frameSVG(MOVES[id], p) };
})();
