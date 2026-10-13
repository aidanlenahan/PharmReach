import { P, has, type Picks } from '../shared';

// Products asked for by name, brand or a misspelling of either ("tylenol", "tylenal", "advil").
// Exact catalog names and aliases are also matched separately in symptomMatcher.ts; these rules catch the rest.
// Names score 6 so they outrank the symptom rules (1-5). Brands are listed at 6 when they hold the same ingredient;
// brands we do not carry (Sudafed, Flonase, NyQuil) point to the closest product at a lower score.
export function productsRules(t: string, picks: Picks) {
  // Acetaminophen: Tylenol, paracetamol (UK), Panadol, Mapap, Tempra, Feverall.
  if (has(t,
    'acetamin*', 'acetomin*', 'tylen*', 'paracet*', 'apap', 'mapap', 'tempra', 'feverall', 'extra strength tylenol',
    'regular strength tylenol', 'tylenol extra strength', 'tylenol 8 hour', 'tylenol arthritis', 'tylenol\'s',
    'acetamenophen', 'acedaminophen', 'acetamiophen', 'assetaminophen', 'acetamenofen', 'asetaminofen',
    'acetiminophen', 'acitaminophen', 'asetominophen', 'acetometaphin', 'acetomenophen', 'acetaminophen 500',
    'tylenol 500', 'tylinol', 'tilenol', 'tyelnol', 'tylnol', 'tyleonl', 'tyneol', 'tylonal', 'tylinal',
    'parecetamol', 'parcetamol', 'paracitamol', 'panadole', 'aacetaminophen', 'acataminophen', 'accetaminophen',
    'aceaminophen', 'aceatminophen', 'aceetaminophen', 'acetaaminophen', 'acetaimnophen', 'acetainophen',
    'acetamiinophen', 'acetamionphen', 'acetamminophen', 'acetamniophen', 'acetamnophen', 'acetamynophen',
    'aceteminophen', 'acetmainophen', 'acetminophen', 'acettaminophen', 'actaminophen', 'acteaminophen',
    'aectaminophen', 'aetaminophen', 'aketaminophen', 'asetaminophen', 'caetaminophen', 'cetaminophen',
    'ecetaminophen', 'ocetaminophen', 'tielenol', 'tlenol', 'tlyenol', 'ttylenol', 'tyenol', 'tylanol', 'tyleenol',
    'tyleol', 'tyllenol', 'tylneol', 'tyylenol', 'ylenol', 'ytlenol', 'apracetamol', 'aracetamol', 'paacetamol',
    'paaracetamol', 'paarcetamol', 'paraacetamol', 'paracatamol', 'paraccetamol', 'paraceamol', 'paraceatmol',
    'paraceetamol', 'paractamol', 'paracteamol', 'paraectamol', 'paraetamol', 'paraketamol', 'parasetamol',
    'parcaetamol', 'parocetamol', 'parracetamol', 'peracetamol', 'poracetamol', 'pparacetamol', 'praacetamol',
    'pracetamol', 'panadol', 'anadol', 'apnadol', 'paadol', 'paanadol', 'paandol', 'panaadol', 'panadal', 'panaddol',
    'panadl', 'panadlo', 'panado', 'panadoll', 'panadool', 'panadul', 'panaodl', 'panaol', 'pandaol', 'pandol',
    'panedol', 'pannadol', 'panodol', 'penadol', 'pnaadol', 'pnadol', 'ponadol', 'ppanadol', 'aacetaminophin',
    'acataminophin', 'accetaminophin', 'aceaminophin', 'aceatminophin', 'aceetaminophin', 'acetaaminophin',
    'acetaimnophin', 'acetainophin', 'acetamenophin', 'acetamiinophin', 'acetamionphin', 'acetamiophin',
    'acetamminophin', 'acetamniophin', 'acetamnophin', 'acetamynophin', 'aceteminophin', 'acetmainophin',
    'acetminophin', 'acettaminophin', 'acitaminophin', 'actaminophin', 'acteaminophin', 'aectaminophin',
    'aetaminophin', 'aketaminophin', 'asetaminophin', 'caetaminophin', 'cetaminophin', 'ecetaminophin',
    'ocetaminophin', 'aacetominophen', 'acatominophen', 'accetominophen', 'aceetominophen', 'aceominophen',
    'aceotminophen', 'acetmoinophen', 'acetoimnophen', 'acetoinophen', 'acetomiinophen', 'acetomionphen',
    'acetomiophen', 'acetomminophen', 'acetomniophen', 'acetomnophen', 'acetomynophen', 'acetoominophen',
    'acettominophen', 'acetuminophen', 'acitominophen', 'acteominophen', 'actominophen', 'aectominophen',
    'aetominophen', 'aketominophen', 'caetominophen', 'cetominophen', 'ecetominophen', 'ocetominophen',
    'aasetaminophen', 'aestaminophen', 'asataminophen', 'aseaminophen', 'aseatminophen', 'aseetaminophen',
    'asetaaminophen', 'asetaimnophen', 'asetainophen', 'asetamenophen', 'asetamiinophen', 'asetaminaphen',
    'asetaminnophen', 'asetaminohen', 'asetaminohpen', 'asetaminoophen', 'asetaminopehn', 'asetaminopen',
    'asetaminophan', 'asetaminophe', 'asetaminopheen', 'asetaminophenn', 'asetaminophhen', 'asetaminophn',
    'asetaminophne', 'asetaminopphen', 'asetaminphen', 'asetaminpohen', 'asetaminuphen', 'asetamionphen',
    'asetamiophen', 'asetamminophen', 'asetamniophen', 'asetamnophen', 'asetamynophen', 'aseteminophen',
    'asetmainophen', 'asetminophen', 'asettaminophen', 'asitaminophen', 'astaminophen', 'asteaminophen',
    'azetaminophen', 'esetaminophen', 'osetaminophen', 'saetaminophen', 'setaminophen', 'apracetemol', 'aracetemol',
    'paacetemol', 'paaracetemol', 'paarcetemol', 'paraacetemol', 'paracatemol', 'paraccetemol', 'paraceemol',
    'paraceetemol', 'paraceetmol', 'paracitemol', 'paracteemol', 'paractemol', 'paraectemol', 'paraetemol',
    'paraketemol', 'parasetemol', 'parcaetemol', 'parcetemol', 'parecetemol', 'parocetemol', 'parracetemol',
    'peracetemol', 'poracetemol', 'pparacetemol', 'praacetemol', 'pracetemol', 'tylonol', 'tielonol', 'tilonol',
    'tlonol', 'tlyonol', 'ttylonol', 'tyllonol', 'tylnool', 'tylonl', 'tylonlo', 'tylonnol', 'tylono', 'tylonoll',
    'tylonool', 'tylonul', 'tylool', 'tyloonl', 'tyloonol', 'tylunol', 'tyolnol', 'tyonol', 'tyylonol', 'ylonol',
    'ytlonol', 'tielanol', 'tilanol', 'tlanol', 'tlyanol', 'ttylanol', 'tyalnol', 'tyanol', 'tylaanol', 'tylanal',
    'tylanl', 'tylanlo', 'tylannol', 'tylano', 'tylanoll', 'tylanool', 'tylanul', 'tylaol', 'tylaonl', 'tyllanol',
    'tylnaol', 'tyylanol', 'ylanol', 'ytlanol', 'tielenal', 'tilenal', 'tlenal', 'tlyenal', 'ttylenal', 'tyelnal',
    'tyenal', 'tyleal', 'tyleanl', 'tyleenal', 'tyllenal', 'tylnal', 'tylneal', 'tyylenal', 'ylenal', 'ytlenal',
    'aacetaminaphen', 'acataminaphen', 'accetaminaphen', 'aceaminaphen', 'aceatminaphen', 'aceetaminaphen',
    'acetaaminaphen', 'acetaimnaphen', 'acetainaphen', 'acetamenaphen', 'acetamianphen', 'acetamiaphen',
    'acetamiinaphen', 'acetamminaphen', 'acetamnaphen', 'acetamniaphen', 'acetamynaphen', 'aceteminaphen',
    'acetmainaphen', 'acetminaphen', 'acettaminaphen', 'acitaminaphen', 'actaminaphen', 'acteaminaphen',
    'aectaminaphen', 'aetaminaphen', 'aketaminaphen', 'caetaminaphen', 'cetaminaphen', 'ecetaminaphen',
    'ocetaminaphen',
  )) {
    picks.add(6, P.acetaminophen);
  }
  // Ibuprofen: Advil, Motrin, Nuprin, Nurofen (UK), Brufen.
  if (has(t,
    'ibupro*', 'ibuprof*', 'advil*', 'motrin*', 'advl', 'avdil', 'adivl', 'addvil', 'advel', 'advill\'s', 'motren',
    'motrin ib', 'motirn', 'nuprin', 'brufen', 'ibu', 'ibu profen', 'ibuprofen 200', 'advil 200',
    'advil liqui gels', 'advil liquigels', 'advil liqui-gels', 'ibeprofen', 'ibprofen', 'ibuprefen', 'eyebuprofen',
    'ibuprofin\'s', 'iburofen', 'ibupofen', 'biuprofen', 'buprofen', 'ebuprofen', 'ibbuprofen', 'iboprofen',
    'ibpurofen', 'ibuporfen', 'ibupprofen', 'ibuprafen', 'ibuprfen', 'ibuprfoen', 'ibuprrofen', 'ibuprufen',
    'iburpofen', 'ibuuprofen', 'iibuprofen', 'iubprofen', 'iuprofen', 'ybuprofen', 'biuprophen', 'buprophen',
    'ebuprophen', 'ibbuprophen', 'iboprophen', 'ibprophen', 'ibpurophen', 'ibupophen', 'ibuporphen', 'ibupprophen',
    'ibupraphen', 'ibuprphen', 'ibuprpohen', 'ibuprrophen', 'ibupruphen', 'iburophen', 'iburpophen', 'ibuuprophen',
    'iibuprophen', 'iubprophen', 'iuprophen', 'ybuprophen', 'biuprofin', 'buprofin', 'ebuprofin', 'ibbuprofin',
    'iboprofin', 'ibprofin', 'ibpurofin', 'ibupofin', 'ibuporfin', 'ibupprofin', 'ibuprafin', 'ibuprfin', 'ibuprfoin',
    'ibuprrofin', 'ibuprufin', 'iburofin', 'iburpofin', 'ibuuprofin', 'iibuprofin', 'iubprofin', 'iuprofin',
    'ybuprofin', 'bioprofen', 'boprofen', 'eboprofen', 'ibaprofen', 'ibboprofen', 'ibooprofen', 'ibopofen',
    'iboporfen', 'ibopprofen', 'iboprafen', 'iboprfen', 'iboprfoen', 'iboproefn', 'iboproen', 'iboprofan', 'iboprofe',
    'iboprofeen', 'iboprofenn', 'iboproffen', 'iboprofn', 'iboprofne', 'iboproofen', 'iboprrofen', 'iboprufen',
    'iborofen', 'iborpofen', 'ibporofen', 'iiboprofen', 'iobprofen', 'ioprofen', 'yboprofen', 'matrin', 'mmotrin',
    'mootrin', 'motri', 'motriin', 'motrn', 'motrni', 'motrrin', 'motryn', 'mottrin', 'mtorin', 'mtrin', 'mutrin',
    'omtrin', 'otrin', 'nurofen', 'nnurofen', 'norofen', 'nrofen', 'nruofen', 'nuofen', 'nuorfen', 'nurafen',
    'nurfen', 'nurfoen', 'nuroefn', 'nuroen', 'nurofan', 'nurofe', 'nurofeen', 'nurofenn', 'nuroffen', 'nurofin',
    'nurofn', 'nurofne', 'nuroofen', 'nurophen', 'nurrofen', 'nurufen', 'nuurofen', 'unrofen', 'urofen', 'biuprofren',
    'buprofren', 'ebuprofren', 'ibbuprofren', 'iboprofren', 'ibprofren', 'ibpurofren', 'ibupofren', 'ibuporfren',
    'ibupprofren', 'ibuprafren', 'ibuprforen', 'ibuprfren', 'ibuprrofren', 'ibuprufren', 'iburofren', 'iburpofren',
    'ibuuprofren', 'iibuprofren', 'iubprofren', 'iuprofren', 'ybuprofren',
  )) {
    picks.add(6, P.ibuprofen);
  }
  // Naproxen: Aleve, Naprosyn, Anaprox, Flanax.
  if (has(t,
    'naprox*', 'naproxen*', 'aleve', 'alleve', 'aleeve', 'aleve\'s', 'alev', 'allieve', 'aleave', 'alieve', 'aleiv',
    'alleeve', 'aleves', 'aleeves', 'aleve pill', 'flanax', 'naproxen sodium 220', 'aleve 220', 'napraxen',
    'naprocsin', 'naprozen', 'anproxen', 'aproxen', 'naaproxen', 'naporxen', 'napoxen', 'napproxen', 'naprocksen',
    'naproen', 'naproexn', 'naproksen', 'naprooxen', 'naprroxen', 'napruxen', 'naprxen', 'naprxoen', 'naroxen',
    'narpoxen', 'neproxen', 'nnaproxen', 'noproxen', 'nparoxen', 'nproxen', 'anproxin', 'aproxin', 'naaproxin',
    'naporxin', 'napoxin', 'napproxin', 'napraxin', 'naprocksin', 'naproin', 'naproixn', 'naproksin', 'naprooxin',
    'naprroxin', 'napruxin', 'naprxin', 'naprxoin', 'naroxin', 'narpoxin', 'neproxin', 'nnaproxin', 'noproxin',
    'nparoxin', 'nproxin', 'naprosyn', 'anprosyn', 'aprosyn', 'naaprosyn', 'naporsyn', 'naposyn', 'napprosyn',
    'naprasyn', 'naprocyn', 'naproosyn', 'naprosien', 'naprosin', 'naprosn', 'naprosny', 'naprossyn', 'naprosy',
    'naprosynn', 'naprosyyn', 'naproyn', 'naproysn', 'naprozyn', 'naprrosyn', 'naprsoyn', 'naprsyn', 'naprusyn',
    'narosyn', 'narposyn', 'neprosyn', 'nnaprosyn', 'noprosyn', 'nparosyn', 'nprosyn', 'anaprox', 'aanaprox',
    'aanprox', 'aaprox', 'anaaprox', 'anaporx', 'anapox', 'anapprox', 'anaprax', 'anapro', 'anaprocks', 'anaproks',
    'anaproox', 'anaproxx', 'anaprrox', 'anaprux', 'anaprx', 'anaprxo', 'anarox', 'anarpox', 'aneprox', 'annaprox',
    'anoprox', 'anparox', 'anprox', 'enaprox', 'naaprox', 'onaprox', 'anprosin', 'aprosin', 'naaprosin', 'naporsin',
    'naposin', 'napprosin', 'naprasin', 'naprocin', 'naproisn', 'naproosin', 'naprosen', 'naprosi', 'naprosiin',
    'naprosinn', 'naprosni', 'naprossin', 'naprozin', 'naprrosin', 'naprsin', 'naprsoin', 'naprusin', 'narosin',
    'narposin', 'neprosin', 'nnaprosin', 'noprosin', 'nparosin', 'nprosin',
  )) {
    picks.add(6, P.naproxen);
  }
  // Regular aspirin: Bayer, Ecotrin, Bufferin. Baby or low-dose aspirin is handled in sleep.ts.
  if (has(t,
    'aspiri*', 'asprin', 'aspirn', 'asperin', 'aspren', 'asprine', 'aspiran', 'asprins', 'aspirn\'s', 'bayer',
    'bayers', 'bayer\'s', 'bayer aspirin', 'bayer asprin', 'bayer advanced aspirin', 'ecotrin', 'ecotrine', 'ecotren',
    'bufferin', 'buferin', 'bufferin\'s', 'acetylsalicylic acid', 'acetylsalicylic', 'acetyl salicylic acid',
    'acetylsalicilic acid', 'asspirin', 'aspririn', 'aspiren', 'aaspirin', 'acpirin', 'apirin', 'apsirin', 'asiprin',
    'asirin', 'aspiin', 'aspiirin', 'aspiirn', 'aspirni', 'aspirrin', 'aspiryn', 'asppirin', 'aspriin', 'aspyrin',
    'azpirin', 'espirin', 'ospirin', 'sapirin', 'spirin', 'acotrin', 'ceotrin', 'cotrin', 'ecatrin', 'eccotrin',
    'ecootrin', 'ecorin', 'ecortin', 'ecotin', 'ecotirn', 'ecotri', 'ecotriin', 'ecotrinn', 'ecotrn', 'ecotrni',
    'ecotrrin', 'ecotryn', 'ecottrin', 'ectorin', 'ectrin', 'ecutrin', 'eecotrin', 'ekotrin', 'eoctrin', 'eotrin',
    'esotrin', 'icotrin',
  ) && !/baby|low[\s-]?dose|\b81\b/.test(t)) {
    picks.add(6, P.aspirin325, P.aspirin325Large);
  }
  // Pepto-Bismol and bismuth subsalicylate (also Kaopectate).
  if (has(t,
    'peptob*', 'pepto bism*', 'pepto', 'peptos', 'pepto\'s', 'pepta', 'pepeto', 'pebto', 'peppto', 'petpo',
    'pepto bysmol', 'pepto bizmol', 'pepto dismal', 'pepto abysmal', 'pepto bisol', 'pink stuff pepto',
    'bismuth subsalicylate', 'bismuth subsalicilate', 'bismuth sub salicylate', 'bismuth salicylate', 'bizmuth',
    'kaopectate', 'kaopectate\'s', 'kayopectate', 'kaopectat', 'pepto-bismol', 'bismuth', 'bbismuth', 'besmuth',
    'bicmuth', 'biismuth', 'bimsuth', 'bimuth', 'bismmuth', 'bismoth', 'bismth', 'bismtuh', 'bismuh', 'bismuht',
    'bismut', 'bismuthh', 'bismutth', 'bismuuth', 'bissmuth', 'bisumth', 'bisuth', 'bsimuth', 'bsmuth', 'bysmuth',
    'ibsmuth', 'ismuth', 'subsalicylate', 'cubsalicylate', 'sbsalicylate', 'sbusalicylate', 'sobsalicylate',
    'ssubsalicylate', 'subalicylate', 'subaslicylate', 'subbsalicylate', 'subcalicylate', 'subsaalicylate',
    'subsaicylate', 'subsailcylate', 'subsalciylate', 'subsalcylate', 'subsalecylate', 'subsaliccylate',
    'subsalicielate', 'subsalicilate', 'subsaliclate', 'subsaliclyate', 'subsalicyalte', 'subsalicyate',
    'subsalicylaate', 'subsalicylae', 'subsalicylaet', 'subsalicylat', 'subsalicylata', 'subsalicylatee',
    'subsalicylati', 'subsalicylatte', 'subsalicylete', 'subsalicyllate', 'subsalicylote', 'subsalicyltae',
    'subsalicylte', 'subsalicyylate', 'subsaliicylate', 'subsalikylate', 'subsalisylate', 'subsaliyclate',
    'subsaliylate', 'subsallicylate', 'subsalycylate', 'subselicylate', 'subslaicylate', 'subslicylate',
    'subsolicylate', 'subssalicylate', 'subzalicylate', 'susalicylate', 'susbalicylate', 'suubsalicylate',
    'ubsalicylate', 'usbsalicylate', 'zubsalicylate', 'pepto bbismol', 'pepto besmol', 'pepto bicmol',
    'pepto biismol', 'pepto bimol', 'pepto bimsol', 'pepto bisoml', 'pepto bissmol', 'pepto bsimol', 'pepto bsmol',
    'pepto ibsmol', 'pepto ismol', 'peptoibsmol', 'peptoismol',
  )) {
    picks.add(6, P.pepto);
  }
  // Tums (calcium carbonate).
  if (has(t,
    'tumms', 'tumss', 'tums\'', 'tums ultra', 'tums extra strength', 'tumbs', 'tuns antacid', 'tum tums',
    'tums chewables', 'tums chews', 'tumbs antacid', 'calcium carbonate', 'calcium carbonite', 'calcium carbinate',
    'calcium carbanate', 'calcium carbonat', 'calcuim carbonate', 'calsium carbonate', 'calcium carbonates',
    'calcium carb', 'calcium acrbonate', 'calcium arbonate', 'calcium caarbonate', 'calcium cabonate',
    'calcium cabronate', 'calcium carbbonate', 'calcium carbnate', 'calcium carbnoate', 'calcium carboante',
    'calcium carboate', 'calcium carbonaate', 'calcium carbonae', 'calcium carbonaet', 'calcium carbonata',
    'calcium carbonatee', 'calcium carbonati', 'calcium carbonatte', 'calcium carbonete', 'calcium carbonnate',
    'calcium carbonote', 'calcium carbontae', 'calcium carbonte', 'calcium carboonate', 'calcium carbunate',
    'calcium carobnate', 'calcium caronate', 'calcium carrbonate', 'calcium ccarbonate', 'calcium cerbonate',
    'calcium corbonate', 'calcium crabonate', 'calcium crbonate', 'calcium karbonate', 'calcium sarbonate',
  )) {
    picks.add(6, P.tums);
  }
  // Plain "tums" (also matched against the catalog in symptomMatcher.ts).
  if (has(t, 'tums')) {
    picks.add(6, P.tums);
  }
  // Omeprazole: Prilosec, Prilosec OTC.
  if (has(t,
    'omepraz*', 'omeprez*', 'prilos*', 'prilosec otc', 'prilocec', 'prilosek otc', 'prilsec', 'prylosec',
    'prilosek\'s', 'omeprazole 20', 'omeprazole dr', 'omeprozole', 'omiprazole', 'omeprazol\'s', 'omeprasole',
    'omepresol', 'omaprazol', 'ameprazole', 'meprazole', 'moeprazole', 'oemprazole', 'oeprazole', 'omaprazole',
    'omeeprazole', 'omeparzole', 'omepazole', 'omepprazole', 'omepraazole', 'omepraole', 'omepraozle', 'omeprrazole',
    'omeprzaole', 'omeprzole', 'omerazole', 'omerpazole', 'ommeprazole', 'omperazole', 'omprazole', 'oomeprazole',
    'umeprazole', 'pilosec', 'pirlosec', 'pprilosec', 'prelosec', 'priilosec', 'prilasec', 'prillosec', 'priloec',
    'priloesc', 'priloosec', 'prilozec', 'prilsoec', 'prilusec', 'priolsec', 'priosec', 'prliosec', 'prlosec',
    'prrilosec', 'rilosec', 'rpilosec', 'ameprazol', 'meprazol', 'moeprazol', 'oemprazol', 'oeprazol', 'omeeprazol',
    'omeparzol', 'omepazol', 'omepprazol', 'omepraazol', 'omepraol', 'omepraozl', 'omeprasol', 'omeprozol',
    'omeprrazol', 'omeprzaol', 'omeprzol', 'omerazol', 'omerpazol', 'omiprazol', 'ommeprazol', 'omperazol',
    'omprazol', 'oomeprazol', 'umeprazol', 'amaprazole', 'maprazole', 'moaprazole', 'oamprazole', 'oaprazole',
    'omaaprazole', 'omaparzole', 'omapazole', 'omapprazole', 'omapraazole', 'omapraole', 'omapraozle', 'omaprasole',
    'omaprazale', 'omaprazle', 'omaprazloe', 'omaprazoe', 'omaprazoel', 'omaprazola', 'omaprazolee', 'omaprazoli',
    'omaprazolle', 'omaprazoole', 'omaprazule', 'omaprazzole', 'omaprezole', 'omaprozole', 'omaprrazole',
    'omaprzaole', 'omaprzole', 'omarazole', 'omarpazole', 'ommaprazole', 'omoprazole', 'omparazole', 'oomaprazole',
    'umaprazole',
  )) {
    picks.add(6, P.omeprazole);
  }
  // Famotidine: Pepcid, Pepcid AC.
  if (has(t,
    'famotid*', 'famotad*', 'pepcid*', 'pepsid', 'pepcid ac', 'pepsid ac', 'pepcid\'s', 'peptid ac',
    'pepcid complete', 'pepcid maximum strength', 'famotdine', 'famatidine', 'famodidine', 'famotidine 20',
    'famoditine', 'afmotidine', 'amotidine', 'faamotidine', 'fammotidine', 'famoidine', 'famoitdine', 'famootidine',
    'famotdiine', 'famotedine', 'famotiidine', 'famotiidne', 'famotiine', 'famottidine', 'famotydine', 'famtidine',
    'famtoidine', 'famutidine', 'faomtidine', 'faotidine', 'femotidine', 'ffamotidine', 'fmaotidine', 'fmotidine',
    'fomotidine', 'phamotidine', 'afmotadine', 'amotadine', 'faamotadine', 'famatadine', 'fammotadine', 'famoadine',
    'famoatdine', 'famootadine', 'famotaadine', 'famotaidne', 'famotaine', 'famotdaine', 'famotodine', 'famottadine',
    'famtadine', 'famtoadine', 'famutadine', 'faomtadine', 'faotadine', 'femotadine', 'ffamotadine', 'fmaotadine',
    'fmotadine', 'fomotadine', 'phamotadine', 'afmotodine', 'amotodine', 'faamotodine', 'famatodine', 'fammotodine',
    'famoodine', 'famootdine', 'famootodine', 'famotdoine', 'famotoddine', 'famotodene', 'famotodie', 'famotodien',
    'famotodiine', 'famotodin', 'famotodina', 'famotodinee', 'famotodini', 'famotodinne', 'famotodne', 'famotodnie',
    'famotodyne', 'famotoidne', 'famotoine', 'famotoodine', 'famottodine', 'famotudine', 'famtodine', 'famtoodine',
    'famutodine', 'faomtodine', 'faotodine', 'femotodine', 'ffamotodine', 'fmaotodine', 'fmotodine', 'fomotodine',
    'phamotodine', 'epcid', 'eppcid', 'papcid', 'pecid', 'pecpid', 'peepcid', 'pepccid', 'pepcd', 'pepcdi', 'pepced',
    'pepci', 'pepciid', 'pepcyd', 'pepicd', 'pepid', 'pepkid', 'peppcid', 'pipcid', 'ppcid', 'ppecid', 'ppepcid',
  )) {
    picks.add(6, P.famotidine);
  }
  // Zantac 360 is famotidine now (the old ranitidine Zantac was withdrawn).
  if (has(t, 'zantac*', 'zantec', 'zantack', 'ranitidine')) {
    picks.add(6, P.famotidine);
  }
  // Loperamide: Imodium, Imodium A-D, Diamode.
  if (has(t,
    'imodi*', 'loperam*', 'imodium ad', 'imodium a d', 'imodium a-d', 'imodum ad', 'imodium\'s', 'imodeum', 'imoduim',
    'emodium', 'immodiam', 'loperimide', 'loparamide', 'loperomide', 'loperimid', 'lopramide', 'diamode',
    'imodium multi symptom', 'laperamide', 'lloperamide', 'loepramide', 'loeramide', 'looperamide', 'lopeamide',
    'lopearmide', 'lopeeramide', 'loperaamide', 'loperaide', 'loperaimde', 'loperemide', 'lopermaide', 'lopermide',
    'loperramide', 'lopiramide', 'lopperamide', 'lopreamide', 'lperamide', 'lpoeramide', 'luperamide', 'olperamide',
    'operamide', 'iimodium', 'imadium', 'imdium', 'imdoium', 'immodium', 'imoddium', 'imodum', 'imodyum', 'imoidum',
    'imoium', 'imoodium', 'imudium', 'iodium', 'iomdium', 'miodium', 'modium', 'ymodium', 'emodim', 'iimodim',
    'imadim', 'imdim', 'imdoim', 'immodim', 'imoddim', 'imodem', 'imodm', 'imodmi', 'imodym', 'imoidm', 'imoim',
    'imoodim', 'imudim', 'iodim', 'iomdim', 'miodim', 'modim', 'ymodim', 'emmodium', 'iimmodium', 'immadium',
    'immdium', 'immdoium', 'immmodium', 'immoddium', 'immodeum', 'immodiium', 'immodimu', 'immodiom', 'immodiu',
    'immodiumm', 'immodiuum', 'immoduim', 'immodum', 'immodyum', 'immoidum', 'immoium', 'immoodium', 'immudium',
    'imomdium', 'mimodium', 'mmodium', 'ymmodium', 'laperamid', 'lloperamid', 'loepramid', 'loeramid', 'looperamid',
    'loparamid', 'lopeamid', 'lopearmid', 'lopeeramid', 'loperaamid', 'loperaid', 'loperaimd', 'loperemid',
    'lopermaid', 'lopermid', 'loperomid', 'loperramid', 'lopiramid', 'lopperamid', 'lopramid', 'lopreamid',
    'lperamid', 'lpoeramid', 'luperamid', 'olperamid', 'operamid',
  )) {
    picks.add(6, P.loperamide);
  }
  // Polyethylene glycol 3350: MiraLAX, GlycoLax, GaviLAX, ClearLAX, HealthyLAX, PureLAX.
  if (has(t,
    'miral*', 'polyethyl*', 'polyethel*', 'mirilax', 'miralax\'s', 'mirolax', 'meralax', 'mira lax', 'mirralax',
    'miralax powder', 'peg 3350', 'peg3350', 'peg 3350 powder', 'glycol 3350', 'polyethylene glycol 3350',
    'polyethelene glycol', 'polyethylene glycol', 'polyethylyne glycol', 'poly ethylene glycol', 'polyethylen glycol',
    'polyethylene glycole', 'polyethylene glicol', 'polyethelyne glycol', 'polyethlene glycol', 'polyetheline glycol',
    'purelax', 'imralax', 'iralax', 'mialax', 'miarlax', 'miiralax', 'miraalax', 'miraalx', 'miraax', 'mirelax',
    'mirlaax', 'mirlax', 'mmiralax', 'mralax', 'mrialax', 'myralax', 'olyethylene', 'oplyethylene', 'palyethylene',
    'ployethylene', 'plyethylene', 'polethylene', 'poleythylene', 'polieethylene', 'poliethylene', 'pollyethylene',
    'polyathylene', 'polyeethylene', 'polyehtylene', 'polyehylene', 'polyethhylene', 'polyethielene', 'polyethilene',
    'polyethlene', 'polyethlyene', 'polyethyelne', 'polyethyene', 'polyethyylene', 'polyetthylene', 'polyetyhlene',
    'polyetylene', 'polyithylene', 'polytehylene', 'polythylene', 'polyyethylene', 'poolyethylene', 'poyethylene',
    'poylethylene', 'ppolyethylene', 'pulyethylene', 'glycolax', 'gglycolax', 'glcolax', 'glcyolax', 'glicolax',
    'gliecolax', 'gllycolax', 'glycalax', 'glyccolax', 'glyclax', 'glycloax', 'glycoalx', 'glycoax', 'glycola',
    'glycolaax', 'glycolacks', 'glycolaks', 'glycolaxx', 'glycolex', 'glycollax', 'glycolox', 'glycolx', 'glycolxa',
    'glycoolax', 'glyculax', 'glykolax', 'glyoclax', 'glyolax', 'glysolax', 'glyycolax', 'gycolax', 'gylcolax',
    'lgycolax', 'lycolax', 'gavilax', 'agvilax', 'avilax', 'gaavilax', 'gailax', 'gaivlax', 'gavelax', 'gavialx',
    'gaviax', 'gaviilax', 'gavila', 'gavilaax', 'gavilacks', 'gavilaks', 'gavilaxx', 'gavilex', 'gavillax', 'gavilox',
    'gavilx', 'gavilxa', 'gavlax', 'gavliax', 'gavvilax', 'gavylax', 'gevilax', 'ggavilax', 'govilax', 'gvailax',
    'gvilax', 'clearlax', 'cclearlax', 'cearlax', 'celarlax', 'claarlax', 'claerlax', 'clarlax', 'cleaarlax',
    'clealax', 'clealrax', 'clearalx', 'clearax', 'clearla', 'clearlaax', 'clearlacks', 'clearlaks', 'clearlaxx',
    'clearlex', 'clearllax', 'clearlox', 'clearlx', 'clearlxa', 'clearrlax', 'cleearlax', 'cleerlax', 'cleorlax',
    'cleralax', 'clerlax', 'cliarlax', 'cllearlax', 'klearlax', 'lcearlax', 'learlax', 'slearlax', 'healthylax',
    'ealthylax', 'ehalthylax', 'haalthylax', 'haelthylax', 'halthylax', 'heaalthylax', 'healhtylax', 'healhylax',
    'heallthylax', 'healthhylax', 'healthielax', 'healthilax', 'healthlax', 'healthlyax', 'healthyalx', 'healthyax',
    'healthyla', 'healthylaax', 'healthylacks', 'healthylaks', 'healthylaxx', 'healthylex', 'healthyllax',
    'healthylox', 'healthylx', 'healthylxa', 'healthyylax', 'healtthylax', 'healtyhlax', 'healtylax', 'heathylax',
    'heatlhylax', 'heealthylax', 'heelthylax', 'helathylax', 'helthylax', 'heolthylax', 'hhealthylax', 'hialthylax',
  )) {
    picks.add(6, P.miralax);
  }
  // Magnesium citrate (Citroma, citrate of magnesia).
  if (has(t,
    'mag citrate', 'mag citrat', 'citrate of magnesia', 'citrate of magnesium', 'magnesia citrate', 'citroma',
    'magnesium citrate liquid', 'magnesium citrate drink', 'magnisium citrate', 'magnesuim citrate',
    'magnesium citrat', 'magnesium sitrate', 'magnezium citrate', 'magnesium citrate', 'agnesium citrate',
    'amgnesium citrate', 'maagnesium citrate', 'magensium citrate', 'magesium citrate', 'maggnesium citrate',
    'magnasium citrate', 'magnecium citrate', 'magneesium citrate', 'magneisum citrate', 'magneium citrate',
    'magneseum citrate', 'magnesiium citrate', 'magnesim citrate', 'magnesimu citrate', 'magnesiom citrate',
    'magnesiu citrate', 'magnesiumm citrate', 'magnesiuum citrate', 'magnessium citrate', 'magnesum citrate',
    'magnesyum citrate', 'magnnesium citrate', 'magnseium citrate', 'magnsium citrate', 'manesium citrate',
    'mangesium citrate', 'megnesium citrate', 'mganesium citrate', 'mgnesium citrate', 'mmagnesium citrate',
    'mognesium citrate', 'magnesium ccitrate', 'magnesium cetrate', 'magnesium ciitrate', 'magnesium cirate',
    'magnesium cirtate', 'magnesium citarte', 'magnesium citate', 'magnesium citraate', 'magnesium citrae',
    'magnesium citraet', 'magnesium citrata', 'magnesium citratee', 'magnesium citrati', 'magnesium citratte',
    'magnesium citrete', 'magnesium citrote', 'magnesium citrrate', 'magnesium citrtae', 'magnesium citrte',
    'magnesium cittrate', 'magnesium ctirate', 'magnesium ctrate', 'magnesium cytrate', 'magnesium ictrate',
    'magnesium itrate', 'magnesium kitrate',
  )) {
    picks.add(6, P.magnesiumCitrate);
  }
  // Docusate sodium: Colace, DOSS.
  if (has(t,
    'docusat*', 'colace', 'colase', 'collace', 'colace\'s', 'colac', 'colaice', 'kolace', 'calace', 'colace capsules',
    'docusate sodium', 'docusate sodium 100', 'docusite', 'docosate', 'docusate\'s', 'docuset', 'docosaat',
    'dioctyl sulfosuccinate', 'dioctyl sodium sulfosuccinate', 'dacusate', 'dcousate', 'dcusate', 'ddocusate',
    'doccusate', 'docsate', 'docsuate', 'docuaste', 'docuate', 'docucate', 'docusaate', 'docusae', 'docusaet',
    'docusete', 'docusote', 'docussate', 'docustae', 'docuste', 'docuusate', 'docuzate', 'dokusate', 'doocusate',
    'dosusate', 'doucsate', 'dousate', 'ducusate', 'ocusate', 'odcusate', 'dioctyl', 'ddioctyl', 'deoctyl', 'diactyl',
    'dicotyl', 'dictyl', 'diioctyl', 'diocctyl', 'dioctiel', 'dioctil', 'dioctl', 'dioctly', 'diocttyl', 'diocty',
    'dioctyll', 'dioctyyl', 'diocyl', 'diocytl', 'dioktyl', 'diooctyl', 'diostyl', 'diotcyl', 'diotyl', 'diuctyl',
    'doctyl', 'doictyl', 'dyoctyl', 'idoctyl', 'ioctyl',
  )) {
    picks.add(6, P.docusate);
  }
  // Single and double antibiotic ointments: bacitracin, Polysporin. Triple antibiotic is the closest we carry.
  if (has(t, 'bacitracin', 'bacitracin ointment', 'bacitracin zinc', 'bacitrasin', 'bacitracine', 'bacatracin', 'polysporin', 'poly sporin', 'double antibiotic')) {
    picks.add(6, P.tripleAntibiotic);
  }
  // Triple antibiotic ointment: Neosporin and its misspellings (neosporin itself is in skin.ts).
  if (has(t,
    'neosporins', 'neosporin\'s', 'neospirin', 'neosporen', 'neosproin', 'nesporin', 'neosperin', 'neosoporin',
    'neosporan', 'neospoin', 'neoporin', 'neo sporin', 'neo-sporin', 'neospoirn', 'neosporin plus',
    'neosporin original', 'triple antibiotics',
    'triple antibiotic ointment', 'triple-antibiotic', 'bacitracin neomycin polymyxin',
    'neomycin polymyxin bacitracin', 'neomycin', 'polymyxin b', 'enosporin', 'eosporin', 'naosporin', 'neasporin',
    'neeosporin', 'neocporin', 'neoosporin', 'neopsorin', 'neosoprin', 'neosorin', 'neosparin', 'neospoorin',
    'neospori', 'neosporiin', 'neosporinn', 'neosporn', 'neosporni', 'neosporrin', 'neosporyn', 'neospporin',
    'neosprin', 'neospurin', 'neossporin', 'neozporin', 'nesoporin', 'neusporin', 'niosporin', 'nneosporin',
    'noesporin', 'nosporin', 'neosporine', 'enosporine', 'eosporine', 'naosporine', 'neasporine', 'neeosporine',
    'neocporine', 'neoosporine', 'neoporine', 'neopsorine', 'neosoprine', 'neosorine', 'neosparine', 'neospoine',
    'neospoirne', 'neospoorine', 'neosporene', 'neosporie', 'neosporien', 'neosporiine', 'neosporina', 'neosporinee',
    'neosporini', 'neosporinne', 'neosporne', 'neospornie', 'neosporrine', 'neosporyne', 'neospporine', 'neosprine',
    'neosproine', 'neospurine', 'neossporine', 'neozporine', 'nesoporine', 'nesporine', 'neusporine', 'niosporine',
    'nneosporine', 'noesporine', 'nosporine', 'enosprin', 'eosprin', 'naosprin', 'neasprin', 'neeosprin', 'neocprin',
    'neoosprin', 'neoprin', 'neopsrin', 'neospin', 'neospirn', 'neospprin', 'neospren', 'neospri', 'neospriin',
    'neosprinn', 'neosprn', 'neosprni', 'neosprrin', 'neospryn', 'neosrin', 'neosrpin', 'neossprin', 'neozprin',
    'nesoprin', 'nesprin', 'neusprin', 'niosprin', 'nneosprin', 'noesprin', 'nosprin', 'enosparin', 'eosparin',
    'naosparin', 'neasparin', 'neeosparin', 'neocparin', 'neoosparin', 'neoparin', 'neopsarin', 'neosaprin',
    'neosarin', 'neospaarin', 'neospain', 'neospairn', 'neosparen', 'neospari', 'neospariin', 'neosparinn',
    'neosparn', 'neosparni', 'neosparrin', 'neosparyn', 'neospparin', 'neosprain', 'neossparin', 'neozparin',
    'nesoparin', 'nesparin', 'neusparin', 'niosparin', 'nneosparin', 'noesparin', 'nosparin', 'enosporn', 'eosporn',
    'naosporn', 'neasporn', 'neeosporn', 'neocporn', 'neoosporn', 'neoporn', 'neopsorn', 'neosoprn', 'neosorn',
    'neospon', 'neosponr', 'neospoorn', 'neospor', 'neospornn', 'neosporrn', 'neospporn', 'neospron', 'neospurn',
    'neossporn', 'neozporn', 'nesoporn', 'nesporn', 'neusporn', 'niosporn', 'nneosporn', 'noesporn', 'nosporn',
  )) {
    picks.add(6, P.tripleAntibiotic);
  }
  // Hydrocortisone 1%: Cortizone-10, Cortaid.
  if (has(t,
    'hydrocort*', 'hydrocortis*', 'cortizone*', 'hydrocortisone cream', 'hydrocortisone 1', 'hydrocortisone 1%',
    'hydro cortisone', 'hydracortisone', 'hidrocortisone', 'hydrocortisone\'s', 'cortisone cream', 'cortizone cream',
    'cortisone 10', 'cortizone 10', 'cortisone10', 'cortizone-10', 'cortozone', 'cortazone', 'cortisoen', 'cortizon',
    'cortaid', 'cortaide', 'cort aid', 'hdrocortisone', 'hdyrocortisone', 'hhydrocortisone', 'hiedrocortisone',
    'hyddrocortisone', 'hydocortisone', 'hydorcortisone', 'hydrcoortisone', 'hydrcortisone', 'hydrocartisone',
    'hydroccortisone', 'hydrocoortisone', 'hydrocorisone', 'hydrocoritsone', 'hydrocorrtisone', 'hydrocotisone',
    'hydrocotrisone', 'hydrocrotisone', 'hydrocrtisone', 'hydrocurtisone', 'hydrokortisone', 'hydroocortisone',
    'hydroocrtisone', 'hydroortisone', 'hydrosortisone', 'hydrrocortisone', 'hydrucortisone', 'hyrdocortisone',
    'hyrocortisone', 'hyydrocortisone', 'ydrocortisone', 'yhdrocortisone', 'hdrocortizone', 'hdyrocortizone',
    'hhydrocortizone', 'hidrocortizone', 'hiedrocortizone', 'hyddrocortizone', 'hydocortizone', 'hydorcortizone',
    'hydracortizone', 'hydrcoortizone', 'hydrcortizone', 'hydrocartizone', 'hydroccortizone', 'hydrocoortizone',
    'hydrocoritzone', 'hydrocorizone', 'hydrocorrtizone', 'hydrocotizone', 'hydrocotrizone', 'hydrocrotizone',
    'hydrocrtizone', 'hydrocurtizone', 'hydrokortizone', 'hydroocortizone', 'hydroocrtizone', 'hydroortizone',
    'hydrosortizone', 'hydrrocortizone', 'hydrucortizone', 'hyrdocortizone', 'hyrocortizone', 'hyydrocortizone',
    'ydrocortizone', 'yhdrocortizone', 'cortisone', 'cartisone', 'ccortisone', 'coortisone', 'corisone', 'coritsone',
    'corrtisone', 'cortesone', 'corticone', 'cortiisone', 'cortione', 'cortiosne', 'cortisane', 'cortisne',
    'cortisnoe', 'cortisoe', 'cortison', 'cortisona', 'cortisonee', 'cortisoni', 'cortisonne', 'cortisoone',
    'cortissone', 'cortisune', 'cortsione', 'cortsone', 'corttisone', 'cortysone', 'cotisone', 'cotrisone',
    'crotisone', 'crtisone', 'curtisone', 'kortisone', 'ocrtisone', 'ortisone', 'sortisone', 'cartizone',
    'ccortizone', 'coortizone', 'coritzone', 'corizone', 'corrtizone', 'cortezone', 'cortiizone', 'cortiozne',
    'cortizane', 'cortizne', 'cortiznoe', 'cortizoe', 'cortizoen', 'cortizona', 'cortizoni', 'cortizonne',
    'cortizoone', 'cortizune', 'cortizzone', 'corttizone', 'cortyzone', 'cortzione', 'cortzone', 'cotizone',
    'cotrizone', 'crotizone', 'crtizone', 'curtizone', 'kortizone', 'ocrtizone', 'ortizone', 'sortizone',
  )) {
    picks.add(6, P.hydrocortisone);
  }
  // Docosanol 10%: Abreva.
  if (has(t,
    'abrev*', 'docosan*', 'abrava', 'abreeva', 'abriva', 'abreeva\'s', 'abreva\'s', 'abreba', 'aberva',
    'abreva cream', 'abreva pump', 'abreva tube', 'docosonal', 'docosanol 10', 'docosanol cream', 'docasanol',
    'docosonol', 'dokosanol', 'dacosanol', 'dcoosanol', 'dcosanol', 'ddocosanol', 'doccosanol', 'docoanol',
    'docoasnol', 'dococanol', 'docoosanol', 'docosaanol', 'docosaol', 'docosaonl', 'docosenol', 'docosnaol',
    'docosnol', 'docossanol', 'docozanol', 'docsanol', 'docsoanol', 'docusanol', 'doocosanol', 'doocsanol',
    'doosanol', 'dososanol', 'ducosanol', 'ocosanol', 'odcosanol', 'aabreva', 'abbreva', 'abeva', 'abrea', 'abreav',
    'abrreva', 'abrva', 'abrvea', 'arbeva', 'bareva', 'breva', 'ebreva', 'obreva',
  )) {
    picks.add(6, P.docosanol);
  }
  // Budesonide nasal spray: Rhinocort, Rhinocort Allergy.
  if (has(t,
    'rhinocor*', 'budeson*', 'rhinocourt', 'rhinocort allergy', 'rhinocort aqua', 'rinocort', 'rhynocort',
    'rhinocart', 'rhino cort', 'rhinocourt\'s', 'rhinicort', 'budesonide spray', 'budisonide', 'budeasonide',
    'budesenide', 'budezonide', 'budesonide nasal', 'bbudesonide', 'bdesonide', 'bduesonide', 'bodesonide',
    'budasonide', 'buddesonide', 'budeconide', 'budeesonide', 'budeonide', 'budeosnide', 'budesanide', 'budesnide',
    'budesnoide', 'budesoide', 'budesoinde', 'budesoonide', 'budessonide', 'budesunide', 'budseonide', 'budsonide',
    'buedsonide', 'buesonide', 'buudesonide', 'ubdesonide', 'udesonide', 'hinocort', 'hrinocort', 'rhenocort',
    'rhhinocort', 'rhiinocort', 'rhinacort', 'rhincoort', 'rhincort', 'rhinnocort', 'rhinoccort', 'rhinocoort',
    'rhinocot', 'rhinocotr', 'rhinocrot', 'rhinocrt', 'rhinocurt', 'rhinokort', 'rhinoocort', 'rhinoocrt', 'rhinoort',
    'rhinosort', 'rhinucort', 'rhiocort', 'rhioncort', 'rhniocort', 'rhnocort', 'rihnocort', 'rrhinocort',
  )) {
    picks.add(6, P.budesonide);
  }
  // Other nasal steroid sprays (Flonase / fluticasone, Nasacort / triamcinolone): budesonide is the one we carry.
  if (has(t, 'flonase*', 'flonaise', 'flonace', 'flownase', 'fluticasone', 'nasacort*', 'triamcinolone')) {
    picks.add(5, P.budesonide, P.saline);
  }
  // Saline nasal spray: Ocean, Simply Saline, Ayr.
  if (has(t,
    'ocean nasal', 'ocean nasal spray', 'ocean saline', 'ocean spray nasal', 'ocean mist', 'simply saline',
    'simply salene', 'ayr saline', 'ayr nasal', 'ayr spray', 'salene spray', 'saline mist', 'saline nasal mist',
    'sodium chloride nasal', 'nasal saline spray', 'salinee', 'salline', 'sailine', 'saliene', 'asline', 'saaline',
    'sailne', 'salien', 'saliine', 'salne', 'salnie', 'salyne', 'slaine', 'sline', 'soline', 'ssaline', 'zaline',
  )) {
    picks.add(6, P.saline);
  }
  // Oxymetazoline: Afrin, Dristan 12-hour.
  if (has(t,
    'oxymetaz*', 'oxymetoz*', 'afrin*', 'affrin', 'afrin\'s', 'afren', 'afryn', 'arfin', 'afirn', 'aphrin',
    'affrin\'s', 'afrin spray', 'afrin original', 'afrin no drip', 'afrin nasal', 'dristan 12 hour',
    'dristan 12-hour', 'oxymetazaline\'s', 'oxy metazoline', 'axymetazoline', 'ocksymetazoline', 'oksymetazoline',
    'ooxymetazoline', 'oxiemetazoline', 'oxmetazoline', 'oxmyetazoline', 'oxxymetazoline', 'oxyemtazoline',
    'oxyetazoline', 'oxymatazoline', 'oxymeatzoline', 'oxymeazoline', 'oxymeetazoline', 'oxymetaazoline',
    'oxymetaoline', 'oxymetaozline', 'oxymetasoline', 'oxymetezoline', 'oxymettazoline', 'oxymetzaoline',
    'oxymetzoline', 'oxymitazoline', 'oxymmetazoline', 'oxymtazoline', 'oxymteazoline', 'oxyymetazoline',
    'oymetazoline', 'oyxmetazoline', 'uxymetazoline', 'xoymetazoline', 'xymetazoline', 'aafrin', 'afriin', 'afrni',
    'afrrin', 'efrin', 'ofrin',
  )) {
    picks.add(6, P.oxymetazoline);
  }
  // Sudafed (pseudoephedrine / phenylephrine) is a decongestant we do not carry: show the decongestant spray, lower.
  if (has(t, 'sudafed*', 'sudafed pe', 'sudofed', 'sudaphed', 'pseudoephedrine', 'phenylephrine')) {
    picks.add(4, P.oxymetazoline, P.saline);
  }
  // Guaifenesin + dextromethorphan tablets: Mucinex DM, Mucus DM.
  if (has(t,
    'mucinex dm', 'mucinexdm', 'mucinex-dm', 'musinex dm', 'mucenex dm', 'mucinx dm', 'mucinix dm', 'mucinex d m',
    'mucus dm', 'mucus relief dm', 'mucinex dm max', 'mucinex dm maximum strength', 'maximum strength mucinex dm',
    'guaifenesin dm', 'guaifenesin dextromethorphan', 'guaifenesin and dextromethorphan',
    'guaifenesin + dextromethorphan', 'guaifenesin with dextromethorphan', 'dextromethorphan guaifenesin',
    'guaifenesin/dextromethorphan', 'guaifenesin-dm', 'mucinex dm\'s',
  )) {
    picks.add(6, P.mucinexDm, P.coughSyrup);
  }
  // Guaifenesin: Mucinex, Humibid. Mucinex DM is above.
  if (has(t,
    'mucinex*', 'guaifen*', 'guafen*', 'guaifin*', 'mucinx', 'mucinix', 'mucinex\'s', 'mucinax', 'mucenix',
    'muscinex', 'mucinez', 'mucines', 'mucinex 1200', 'mucinex max', 'mucinex maximum strength', 'mucinex 12 hour',
    'mucinex er', 'mucinex extended release', 'mucinex chest', 'guaifenesin er', 'guaifenesin 1200',
    'guaifenesin 600', 'guifenesin', 'gaifenesin', 'gwaifenesin', 'guaiphenesin', 'guaphenesin', 'guiaphenesin',
    'mcinex', 'mcuinex', 'mmucinex', 'mocinex', 'muccinex', 'mucenex', 'mucienx', 'muciex', 'muciinex', 'mucinecks',
    'mucineex', 'mucineks', 'mucinnex', 'mucinxe', 'mucnex', 'mucniex', 'mucynex', 'muicnex', 'muinex', 'mukinex',
    'musinex', 'muucinex', 'ucinex', 'umcinex', 'gauifenesin', 'gguaifenesin', 'goaifenesin', 'guaaifenesin',
    'guaefenesin', 'guafienesin', 'guaiefnesin', 'guaienesin', 'guaifanesin', 'guaifeenesin', 'guaifeensin',
    'guaifeesin', 'guaiffenesin', 'guaifneesin', 'guaifnesin', 'guaiifenesin', 'guayfenesin', 'gueifenesin',
    'guoifenesin', 'guuaifenesin', 'uaifenesin', 'ugaifenesin', 'mmusinex', 'mosinex', 'msinex', 'msuinex', 'muisnex',
    'musenex', 'musienx', 'musiex', 'musiinex', 'musinax', 'musine', 'musinecks', 'musineex', 'musineks', 'musinexx',
    'musinix', 'musinnex', 'musinx', 'musinxe', 'musnex', 'musniex', 'mussinex', 'musynex', 'muusinex', 'muzinex',
    'umsinex', 'usinex', 'mcenex', 'mcuenex', 'mmucenex', 'mocenex', 'mucanex', 'muccenex', 'muceenex', 'muceenx',
    'muceex', 'mucenax', 'mucene', 'mucenecks', 'muceneex', 'muceneks', 'mucenexx', 'mucennex', 'mucenx', 'mucenxe',
    'mucneex', 'muecnex', 'muenex', 'mukenex', 'muucenex', 'ucenex', 'umcenex', 'gaifenisin', 'gauifenisin',
    'gguaifenisin', 'goaifenisin', 'guaaifenisin', 'guaefenisin', 'guafienisin', 'guaiefnisin', 'guaienisin',
    'guaifanisin', 'guaifeenisin', 'guaifeinsin', 'guaifeisin', 'guaiffenisin', 'guaifneisin', 'guaifnisin',
    'guaiifenisin', 'guaiphenisin', 'guayfenisin', 'gueifenisin', 'guiafenisin', 'guifenisin', 'guoifenisin',
    'guuaifenisin', 'uaifenisin', 'ugaifenisin', 'gafenesin', 'gaufenesin', 'gguafenesin', 'goafenesin',
    'guaafenesin', 'guaefnesin', 'guaenesin', 'guafanesin', 'guafeenesin', 'guafeensin', 'guafeesin', 'guaffenesin',
    'guafinesin', 'guafneesin', 'guafnesin', 'guefenesin', 'gufaenesin', 'gufenesin', 'guofenesin', 'guuafenesin',
    'uafenesin', 'ugafenesin', 'humibid', 'hhumibid', 'hmibid', 'hmuibid', 'homibid', 'huibid', 'huimbid', 'humbid',
    'humbiid', 'humebid', 'humibbid', 'humibd', 'humibdi', 'humibed', 'humibi', 'humibidd', 'humibiid', 'humibyd',
    'humiibd', 'humiibid', 'humiid', 'hummibid', 'humybid', 'huumibid', 'uhmibid', 'umibid',
  ) && !/\bdm\b/.test(t)) {
    picks.add(6, P.mucinex, P.mucinexDm);
  }
  // Dextromethorphan + guaifenesin liquid: Robitussin DM, Tussin DM, Delsym, Wal-Tussin.
  if (has(t,
    'robitus*', 'dextrometh*', 'delsym*', 'tussin', 'tussin dm', 'tussin dm max', 'tussin cf', 'robitussin dm',
    'robitussin\'s', 'robotussin', 'robotusin', 'robitissin', 'robitusin dm', 'robitussin max', 'delsim', 'delsym\'s',
    'delcym', 'delsyn', 'delsum', 'dellsym', 'delysm', 'delsym cough', 'wal tussin', 'wal-tussin', 'dextromorphan',
    'dextrometorphan', 'dextro methorphan', 'dxm', 'daxtromethorphan', 'ddextromethorphan', 'deckstromethorphan',
    'deextromethorphan', 'dekstromethorphan', 'detromethorphan', 'detxromethorphan', 'dexromethorphan',
    'dexrtomethorphan', 'dextomethorphan', 'dextormethorphan', 'dextramethorphan', 'dextrmethorphan',
    'dextrmoethorphan', 'dextroemthorphan', 'dextroethorphan', 'dextromathorphan', 'dextromeethorphan',
    'dextromehorphan', 'dextromehtorphan', 'dextrometohrphan', 'dextrometthorphan', 'dextromithorphan',
    'dextrommethorphan', 'dextromtehorphan', 'dextromthorphan', 'dextroomethorphan', 'dextrromethorphan',
    'dextrumethorphan', 'dexttromethorphan', 'dexxtromethorphan', 'dixtromethorphan', 'dxetromethorphan',
    'dxtromethorphan', 'edxtromethorphan', 'extromethorphan', 'obitussin', 'orbitussin', 'rabitussin', 'rbitussin',
    'rboitussin', 'robbitussin', 'robetussin', 'robiitussin', 'robitossin', 'robitssin', 'robitsusin', 'robittussin',
    'robitucsin', 'robituussin', 'robituzsin', 'robiussin', 'robiutssin', 'robtiussin', 'robtussin', 'robytussin',
    'roibtussin', 'roitussin', 'roobitussin', 'rrobitussin', 'rubitussin', 'dalsym', 'ddelsym', 'deelsym', 'delsiem',
    'delsm', 'delsmy', 'delssym', 'delsy', 'delsyym', 'delym', 'delzym', 'deslym', 'desym', 'dilsym', 'dlesym',
    'dlsym', 'edlsym', 'elsym', 'daxtromethorphin', 'ddextromethorphin', 'deckstromethorphin', 'deextromethorphin',
    'dekstromethorphin', 'detromethorphin', 'detxromethorphin', 'dexromethorphin', 'dexrtomethorphin',
    'dextomethorphin', 'dextormethorphin', 'dextramethorphin', 'dextrmethorphin', 'dextrmoethorphin',
    'dextroemthorphin', 'dextroethorphin', 'dextromathorphin', 'dextromeethorphin', 'dextromehorphin',
    'dextromehtorphin', 'dextrometohrphin', 'dextrometorphin', 'dextrometthorphin', 'dextromithorphin',
    'dextrommethorphin', 'dextromtehorphin', 'dextromthorphin', 'dextroomethorphin', 'dextrromethorphin',
    'dextrumethorphin', 'dexttromethorphin', 'dexxtromethorphin', 'dixtromethorphin', 'dxetromethorphin',
    'dxtromethorphin', 'edxtromethorphin', 'extromethorphin',
  )) {
    picks.add(6, P.coughSyrup, P.mucinexDm);
  }
  // NyQuil / DayQuil are cold combos (pain reliever + cough suppressant, plus an antihistamine at night).
  // We carry the pieces separately; show them a bit lower than an exact name.
  if (has(t, 'nyquil*', 'ny quil', 'niquil', 'nyquill', 'nightquil', 'vicks nyquil')) {
    picks.add(4, P.coughSyrup, P.acetaminophen, P.diphenhydramine);
  }
  if (has(t, 'dayquil*', 'day quil', 'dayquill', 'daquil', 'vicks dayquil')) {
    picks.add(4, P.coughSyrup, P.acetaminophen, P.mucinexDm);
  }
  // Loratadine: Claritin, Alavert, Wal-itin. Claritin-D is a different product.
  if (has(t,
    'claritin*', 'lorata*', 'loratid*', 'claritin\'s', 'clariton', 'claritn', 'clarytin', 'clairitin', 'clarityn',
    'claratine', 'clarattin', 'claritin 24 hour', 'claritin reditabs', 'claritin chewables', 'claritin 10',
    'loratadine 10', 'wal itin', 'wal-itin', 'walitin', 'laratadine', 'lloratadine', 'loartadine', 'loatadine',
    'looratadine', 'loraadine', 'loraatadine', 'loraatdine', 'loratdaine', 'loratedine', 'lorattadine', 'loretadine',
    'lortaadine', 'lratadine', 'lroatadine', 'luratadine', 'olratadine', 'oratadine', 'calritin', 'caritin',
    'cclaritin', 'claaritin', 'clairtin', 'claitin', 'claretin', 'clariin', 'clariitin', 'clariitn', 'clariten',
    'clariti', 'claritiin', 'claritni', 'clarittin', 'clarritin', 'clartiin', 'clartin', 'cleritin', 'cllaritin',
    'cloritin', 'clraitin', 'clritin', 'klaritin', 'laritin', 'lcaritin', 'slaritin', 'claratin', 'calratin',
    'caratin', 'cclaratin', 'claaratin', 'claartin', 'claatin', 'claraatin', 'clarain', 'claraitn', 'claraten',
    'clarati', 'claratiin', 'claratinn', 'claratn', 'claratni', 'claratyn', 'clarotin', 'clarratin', 'clartain',
    'cleratin', 'cllaratin', 'cloratin', 'clraatin', 'clratin', 'klaratin', 'laratin', 'lcaratin', 'slaratin',
    'claritan', 'calritan', 'caritan', 'cclaritan', 'claaritan', 'clairtan', 'claitan', 'claretan', 'clarian',
    'clariatn', 'clariitan', 'clarita', 'claritaan', 'claritann', 'claritna', 'clarittan', 'clarritan', 'clartan',
    'clartian', 'clarytan', 'cleritan', 'cllaritan', 'cloritan', 'clraitan', 'clritan', 'klaritan', 'laritan',
    'lcaritan', 'slaritan', 'laratidine', 'lloratidine', 'loartidine', 'loatidine', 'looratidine', 'loraatidine',
    'loraidine', 'loraitdine', 'loratdiine', 'loratiidine', 'loratiidne', 'loratiine', 'lorattidine', 'loratydine',
    'loretidine', 'lorotidine', 'lorratidine', 'lortaidine', 'lortidine', 'lratidine', 'lroatidine', 'luratidine',
    'olratidine', 'oratidine', 'alavert', 'aalavert', 'aalvert', 'aavert', 'alaavert', 'alaert', 'alaevrt', 'alavart',
    'alaveert', 'alaver', 'alaverrt', 'alavertt', 'alavet', 'alavetr', 'alavirt', 'alavret', 'alavrt', 'alavvert',
    'alevert', 'allavert', 'alovert', 'alvaert', 'alvert', 'elavert', 'laavert', 'lavert', 'olavert',
  ) && !/clari(t|tin|ton)?[\s-]?d\b/.test(t)) {
    picks.add(6, P.loratadine);
  }
  // Claritin-D (has a decongestant we do not carry): still show plain loratadine, lower.
  if (has(t,
    'claritin d', 'claritin-d', 'claritind', 'claritin d 12 hour', 'claritin d 24 hour', 'claratin d', 'claritan d',
  )) {
    picks.add(4, P.loratadine);
  }
  // Cetirizine: Zyrtec, Aller-Tec, Wal-Zyr, Reactine. Zyrtec-D is a different product.
  if (has(t,
    'cetiriz*', 'cetriz*', 'zyrte*', 'zertec', 'zirtec', 'zyrtec\'s', 'zytrec', 'zrytec', 'zyrtc', 'zertek', 'zirtek',
    'zirtech', 'zyrtic', 'zertec\'s', 'zytec', 'zyrtek\'s', 'zyyrtec', 'zertic', 'zirtek\'s', 'zyrtec 24 hour',
    'zyrtec 10', 'zyrtec liquid gels', 'cetirizine 10', 'cetirisine', 'ceritizine', 'aller tec', 'aller-tec',
    'allertec', 'wal zyr', 'wal-zyr', 'walzyr', 'catirizine', 'ccetirizine', 'ceetirizine', 'ceirizine', 'ceitrizine',
    'cetiirizine', 'cetiirzine', 'cetiizine', 'cetirezine', 'cetiriine', 'cetiriizine', 'cetiriizne', 'cetirrizine',
    'cetiryzine', 'cetirziine', 'cetriizine', 'cettirizine', 'cetyrizine', 'cteirizine', 'ctirizine', 'ectirizine',
    'etirizine', 'ketirizine', 'catrizine', 'ccetrizine', 'ceetrizine', 'cerizine', 'certizine', 'cetizine',
    'cetrezine', 'cetriine', 'cetriizne', 'cetrisine', 'cetrrizine', 'cetryzine', 'cetrziine', 'cetrzine',
    'cettrizine', 'citrizine', 'cterizine', 'ctrizine', 'ectrizine', 'etrizine', 'ketrizine', 'setrizine',
    'catirizene', 'ccetirizene', 'ceetirizene', 'ceirizene', 'ceitrizene', 'ceterizene', 'cetiirizene', 'cetiirzene',
    'cetiizene', 'cetirezene', 'cetiriene', 'cetiriezne', 'cetiriizene', 'cetirisene', 'cetirrizene', 'cetiryzene',
    'cetirzene', 'cetirziene', 'cetriizene', 'cettirizene', 'cetyrizene', 'citirizene', 'cteirizene', 'ctirizene',
    'ectirizene', 'etirizene', 'ketirizene', 'setirizene', 'reactine', 'eactine', 'eractine', 'raactine', 'ractine',
    'raectine', 'reaactine', 'reacctine', 'reacine', 'reacitne', 'reactene', 'reactie', 'reactien', 'reactiine',
    'reactin', 'reactina', 'reactinee', 'reactini', 'reactinne', 'reactne', 'reactnie', 'reacttine', 'reactyne',
    'reaktine', 'reastine', 'reatcine', 'reatine', 'recatine', 'rectine', 'reeactine', 'reectine', 'reoctine',
    'riactine', 'rreactine',
  ) && !/z(y|i|e)rte(c|k|ch)[\s-]?d\b/.test(t)) {
    picks.add(6, P.cetirizine, P.cetirizineSmall);
  }
  // Zyrtec-D: show plain cetirizine, lower.
  if (has(t,
    'zyrtec d', 'zyrtec-d', 'zyrtecd', 'zyrtec d 12 hour', 'zertec d',
  )) {
    picks.add(4, P.cetirizine, P.cetirizineSmall);
  }
  // Fexofenadine: Allegra, Telfast. Allegra-D is a different product.
  if (has(t,
    'fexofen*', 'fexophen*', 'alegra', 'allergra', 'alegra\'s', 'allegra\'s', 'allegras', 'alleggra', 'allegera',
    'allerga', 'alegrah', 'allegra 24 hour', 'allegra 180', 'allegra 12 hour', 'allegra allergy', 'fexafenadine',
    'fexofenadine 180', 'fexofenadine 60', 'efxofenadine', 'exofenadine', 'faxofenadine', 'fecksofenadine',
    'feexofenadine', 'feksofenadine', 'feofenadine', 'feoxfenadine', 'fexfenadine', 'fexfoenadine', 'fexoefnadine',
    'fexoenadine', 'fexofeadine', 'fexofeandine', 'fexofeenadine', 'fexoffenadine', 'fexofnadine', 'fexofneadine',
    'fexoofenadine', 'fexufenadine', 'fexxofenadine', 'ffexofenadine', 'fixofenadine', 'fxeofenadine', 'fxofenadine',
    'phexofenadine', 'allegra', 'aallegra', 'alelgra', 'allagra', 'alleegra', 'allega', 'allegar', 'allegr',
    'allegraa', 'allegre', 'allegro', 'allegrra', 'allera', 'allgera', 'allgra', 'alligra', 'alllegra', 'ellegra',
    'lalegra', 'llegra', 'ollegra', 'telfast', 'elfast', 'etlfast', 'talfast', 'teelfast', 'tefast', 'teflast',
    'telafst', 'telast', 'telfaast', 'telfact', 'telfas', 'telfasst', 'telfastt', 'telfat', 'telfats', 'telfazt',
    'telfest', 'telffast', 'telfost', 'telfsat', 'telfst', 'tellfast', 'telphast', 'tilfast', 'tlefast', 'tlfast',
    'ttelfast',
  ) && !/al+eg+ra[\s-]?d\b/.test(t)) {
    picks.add(6, P.fexofenadine, P.fexofenadineSmall);
  }
  // Allegra-D: show plain fexofenadine, lower.
  if (has(t,
    'allegra d', 'allegra-d', 'allegrad', 'allegra d 12 hour', 'allegra d 24 hour', 'alegra d',
  )) {
    picks.add(4, P.fexofenadine, P.fexofenadineSmall);
  }
  // Chlorpheniramine: Chlor-Trimeton, Aller-Chlor, Piriton (UK).
  if (has(t,
    'chloropheni*', 'clorphen*', 'chlor trimeton', 'chlor-trimeton', 'chlortrimeton', 'chlor trimaton',
    'chlor trimetron', 'chlortrimiton', 'clor trimeton', 'chlor trimeton\'s', 'aller chlor', 'aller-chlor',
    'allerchlor', 'chlorfeniramine', 'chlorpheniramine 4', 'cchlorpheniramine', 'chhlorpheniramine',
    'chlarpheniramine', 'chllorpheniramine', 'chloorpheniramine', 'chlopheniramine', 'chloprheniramine',
    'chlorheniramine', 'chlorhpeniramine', 'chlorpehniramine', 'chlorpeniramine', 'chlorphaniramine',
    'chlorpheeniramine', 'chlorpheinramine', 'chlorpheiramine', 'chlorphheniramine', 'chlorphiniramine',
    'chlorphneiramine', 'chlorphniramine', 'chlorppheniramine', 'chlorrpheniramine', 'chlropheniramine',
    'chlrpheniramine', 'chlurpheniramine', 'cholrpheniramine', 'chorpheniramine', 'clhorpheniramine',
    'hclorpheniramine', 'hlorpheniramine', 'khlorpheniramine', 'shlorpheniramine', 'cchlorphenamine',
    'chhlorphenamine', 'chlarphenamine', 'chllorphenamine', 'chloorphenamine', 'chlophenamine', 'chloprhenamine',
    'chlorfenamine', 'chlorhenamine', 'chlorhpenamine', 'chlorpehnamine', 'chlorpenamine', 'chlorphanamine',
    'chlorpheamine', 'chlorpheanmine', 'chlorpheenamine', 'chlorphhenamine', 'chlorphinamine', 'chlorphnamine',
    'chlorphneamine', 'chlorpphenamine', 'chlorrphenamine', 'chlrophenamine', 'chlrphenamine', 'chlurphenamine',
    'cholrphenamine', 'chorphenamine', 'clhorphenamine', 'hclorphenamine', 'hlorphenamine', 'khlorphenamine',
    'shlorphenamine', 'trimeton', 'rimeton', 'rtimeton', 'timeton', 'tirmeton', 'tremeton', 'triemton', 'trieton',
    'triimeton', 'trimaton', 'trimeeton', 'trimeon', 'trimeotn', 'trimetan', 'trimetn', 'trimetno', 'trimeto',
    'trimetonn', 'trimetoon', 'trimetton', 'trimetun', 'trimiton', 'trimmeton', 'trimteon', 'trimton', 'trmeton',
    'trmieton', 'trrimeton', 'trymeton', 'ttrimeton', 'piriton', 'ipriton', 'iriton', 'periton', 'piiriton',
    'piirton', 'piiton', 'pireton', 'piriiton', 'pirion', 'piriotn', 'piritan', 'piritn', 'piritno', 'pirito',
    'piritonn', 'piritoon', 'piritton', 'piritun', 'pirriton', 'pirtion', 'pirton', 'piryton', 'ppiriton', 'priiton',
    'priton', 'pyriton',
  )) {
    picks.add(6, P.chlorpheniramine);
  }
  // Diphenhydramine: Benadryl, Banophen, Wal-Dryl, ZzzQuil, Nytol, Sominex, Simply Sleep.
  if (has(t,
    'diphenhyd*', 'diphenhid*', 'benadr*', 'benedr*', 'bendryl', 'benadryl\'s', 'bennadryl', 'benydryl', 'beneadryl',
    'benadyl', 'bendadryl', 'bennedryl', 'benadril\'s', 'benadryl allergy', 'benadryl ultratabs', 'benadryl 25',
    'benedryl\'s', 'diphenhydramine 25', 'diphenhyramine', 'diphenhydramine\'s', 'diphenhydramin hcl',
    'difenhidramina', 'wal dryl', 'wal-dryl', 'waldryl', 'zzzquil', 'zzz quil', 'zquil', 'zzquil', 'zzzquill',
    'nytol', 'nightol', 'sominex', 'simply sleep', 'ddiphenhydramine', 'dephenhydramine', 'difenhydramine',
    'dihenhydramine', 'dihpenhydramine', 'diiphenhydramine', 'dipehnhydramine', 'dipenhydramine', 'diphanhydramine',
    'dipheenhydramine', 'diphehnydramine', 'diphehydramine', 'diphenhdramine', 'diphenhdyramine', 'diphenhhydramine',
    'diphenhiedramine', 'diphenhyrdamine', 'diphenhyydramine', 'diphennhydramine', 'diphenyhdramine',
    'diphhenhydramine', 'diphinhydramine', 'diphnehydramine', 'diphnhydramine', 'dipphenhydramine', 'dphenhydramine',
    'dpihenhydramine', 'idphenhydramine', 'iphenhydramine', 'banadryl', 'bbenadryl', 'beadryl', 'beandryl',
    'beenadryl', 'benaadryl', 'benaddryl', 'benadyrl', 'benardyl', 'benaryl', 'bendaryl', 'benodryl', 'binadryl',
    'bnadryl', 'bneadryl', 'ebnadryl', 'enadryl', 'banadril', 'bbenadril', 'beadril', 'beandril', 'beenadril',
    'benaadril', 'benaddril', 'benadil', 'benadirl', 'benardil', 'benaril', 'bendaril', 'bendril', 'bennadril',
    'benodril', 'binadril', 'bnadril', 'bneadril', 'ebnadril', 'enadril', 'banedryl', 'bbenedryl', 'beedryl',
    'beendryl', 'beenedryl', 'benderyl', 'beneddryl', 'benedyl', 'benedyrl', 'beneedryl', 'benerdyl', 'beneryl',
    'benidryl', 'binedryl', 'bnedryl', 'bneedryl', 'ebnedryl', 'enedryl', 'ddiphenhydramin', 'dephenhydramin',
    'difenhydramin', 'dihenhydramin', 'dihpenhydramin', 'diiphenhydramin', 'dipehnhydramin', 'dipenhydramin',
    'diphanhydramin', 'dipheenhydramin', 'diphehnydramin', 'diphehydramin', 'diphenhdramin', 'diphenhdyramin',
    'diphenhhydramin', 'diphenhiedramin', 'diphenhyramin', 'diphenhyrdamin', 'diphenhyydramin', 'diphennhydramin',
    'diphenydramin', 'diphenyhdramin', 'diphhenhydramin', 'diphinhydramin', 'diphnehydramin', 'diphnhydramin',
    'dipphenhydramin', 'dphenhydramin', 'dpihenhydramin', 'dyphenhydramin', 'idphenhydramin', 'iphenhydramin',
    'ddiphenhidramine', 'dephenhidramine', 'difenhidramine', 'dihenhidramine', 'dihpenhidramine', 'diiphenhidramine',
    'dipehnhidramine', 'dipenhidramine', 'diphanhidramine', 'dipheenhidramine', 'diphehidramine', 'diphehnidramine',
    'diphenhdiramine', 'diphenhedramine', 'diphenhhidramine', 'diphenhiidramine', 'diphenhiramine', 'diphenhirdamine',
    'diphenidramine', 'diphenihdramine', 'diphennhidramine', 'diphhenhidramine', 'diphinhidramine', 'diphnehidramine',
    'diphnhidramine', 'dipphenhidramine', 'dphenhidramine', 'dpihenhidramine', 'dyphenhidramine', 'idphenhidramine',
    'iphenhidramine', 'banophen', 'abnophen', 'anophen', 'baanophen', 'banaphen', 'bannophen', 'banofen', 'banohen',
    'banohpen', 'banoophen', 'banopehn', 'banopen', 'banophan', 'banophe', 'banopheen', 'banophenn', 'banophhen',
    'banophin', 'banophn', 'banophne', 'banopphen', 'banphen', 'banpohen', 'banuphen', 'baonphen', 'baophen',
    'bbanophen', 'benophen', 'bnaophen', 'bnophen', 'bonophen',
  )) {
    picks.add(6, P.diphenhydramine, P.diphenhydramineSmall);
  }
  // Unisom SleepGels and other diphenhydramine sleep aids (Unisom SleepTabs are doxylamine, which we do not carry).
  if (has(t, 'unisom*', 'unisome', 'unisum')) {
    picks.add(4, P.diphenhydramine, P.diphenhydramineSmall, P.melatonin);
  }
  // Motion sickness pills (Dramamine is a form of diphenhydramine; meclizine / Bonine we do not carry).
  if (has(t, 'dramamine*', 'dramamin', 'dimenhydrinate', 'meclizine', 'bonine')) {
    picks.add(4, P.diphenhydramine, P.diphenhydramineSmall);
  }
  // Olopatadine eye drops: Pataday, Patanol, Pazeo.
  if (has(t,
    'olopat*', 'olapat*', 'patad*', 'pataday\'s', 'pataday once daily', 'pataday twice daily',
    'pataday extra strength', 'pataday drops', 'pattaday', 'pateday', 'patiday', 'patteday', 'pata day', 'patanol\'s',
    'pazeo', 'olopatadine 0.2', 'olopatadine 0.2%', 'olopetadine', 'olopatadine hcl', 'alopatadine', 'loopatadine',
    'lopatadine', 'ollopatadine', 'oloaptadine', 'oloatadine', 'oloopatadine', 'olopaadine', 'olopaatadine',
    'olopaatdine', 'olopotadine', 'oloppatadine', 'oloptaadine', 'oloptadine', 'olpatadine', 'olpoatadine',
    'olupatadine', 'oolopatadine', 'oolpatadine', 'oopatadine', 'ulopatadine', 'aptaday', 'ataday', 'paaday',
    'paataday', 'paatday', 'pataaday', 'pataady', 'pataay', 'patdaay', 'patday', 'patoday', 'petaday', 'potaday',
    'ppataday', 'ptaaday', 'ptaday', 'patanol', 'aptanol', 'atanol', 'paanol', 'paatanol', 'paatnol', 'pataanol',
    'patanal', 'patanl', 'patanlo', 'patannol', 'patano', 'patanoll', 'patanool', 'patanul', 'pataol', 'pataonl',
    'patenol', 'patnaol', 'patnol', 'patonol', 'pattanol', 'petanol', 'potanol', 'ppatanol', 'ptaanol', 'ptanol',
    'alopatidine', 'loopatidine', 'lopatidine', 'ollopatidine', 'oloaptidine', 'oloatidine', 'oloopatidine',
    'olopaatidine', 'olopaidine', 'olopaitdine', 'olopetidine', 'olopotidine', 'oloppatidine', 'oloptaidine',
    'oloptidine', 'olpatidine', 'olpoatidine', 'olupatidine', 'oolopatidine', 'oolpatidine', 'oopatidine',
    'ulopatidine',
  )) {
    picks.add(6, P.olopatadine);
  }
  // Melatonin and its misspellings.
  if (has(t,
    'melaton*', 'melatin*', 'meloton*', 'melatonin\'s', 'melatonen\'s', 'meletonin', 'melatonin 5', 'melatonin 5mg',
    'melatonin 5 mg', 'melatonin gummies', 'melatonin tablets', 'melatonin pills', 'elatonin', 'emlatonin',
    'mealtonin', 'meatonin', 'meelatonin', 'melaatonin', 'melaotnin', 'melatanin', 'melatnoin', 'melatoinn',
    'melatoonin', 'melattonin', 'melatunin', 'meltaonin', 'milatonin', 'mlatonin', 'mleatonin', 'mmelatonin',
    'elatonnin', 'emlatonnin', 'malatonnin', 'mealtonnin', 'meatonnin', 'meelatonnin', 'melaatonnin', 'melaonnin',
    'melaotnnin', 'melatannin', 'melatnnin', 'melatnonin', 'melatoonnin', 'melattonnin', 'melatunnin', 'meletonnin',
    'mellatonnin', 'meltaonnin', 'meltonnin', 'milatonnin', 'mlatonnin', 'mleatonnin', 'mmelatonnin', 'elatoning',
    'emlatoning', 'malatoning', 'mealtoning', 'meatoning', 'meelatoning', 'melaatoning', 'melaoning', 'melaotning',
    'melataning', 'melatning', 'melatnoing', 'melatoing', 'melatoinng', 'melatooning', 'melattoning', 'melatuning',
    'meletoning', 'mellatoning', 'meltaoning', 'meltoning', 'milatoning', 'mlatoning', 'mleatoning', 'mmelatoning',
    'elotonin', 'emlotonin', 'malotonin', 'meelotonin', 'meloonin', 'melootnin', 'melootonin', 'melotanin',
    'melotnin', 'melotnoin', 'melotoin', 'melotoinn', 'melotoonin', 'melottonin', 'melotunin', 'meltoonin',
    'melutonin', 'meoltonin', 'meotonin', 'milotonin', 'mleotonin', 'mlotonin', 'mmelotonin', 'elatonine',
    'emlatonine', 'malatonine', 'mealtonine', 'meatonine', 'meelatonine', 'melaatonine', 'melaonine', 'melaotnine',
    'melatanine', 'melatnine', 'melatnoine', 'melatoine', 'melatoinne', 'melatoonine', 'melattonine', 'melatunine',
    'meletonine', 'mellatonine', 'meltaonine', 'meltonine', 'milatonine', 'mlatonine', 'mleatonine', 'mmelatonine',
  )) {
    picks.add(6, P.melatonin, P.melatoninCvs);
  }
}
