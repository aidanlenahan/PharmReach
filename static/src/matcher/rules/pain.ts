import { P, has, type Picks } from '../shared';

// Pain, fever, aches and cramps.
export function painRules(t: string, picks: Picks) {
  // ---- Headaches ----

  // Headache, the plain word and spacing variants.
  if (has(t, 'headache*', 'head ache*', 'head pain', 'head pains', 'pain in my head', 'pain in the head', 'ache in my head', 'headachey', 'headachy')) {
    picks.add(3, P.acetaminophen, P.ibuprofen, P.naproxen);
  }
  // Headache misspellings and typos.
  if (has(t, 'hedache*', 'hed ache*', 'hedaik*', 'hed aik*', 'headaik*', 'hedake', 'hed hurts', 'hed hurt', 'hed hurting', 'hed is hurting', 'hed is pounding', 'hed pounding', 'hed is killing me', 'hed is throbbing', 'hed throbbing', 'headake*', 'head ake*', 'hedake*', 'haedache*', 'haed ache*', 'heaache*', 'headace*', 'head ace', 'headach', 'head ach', 'headche*', 'headahce*', 'headachr*', 'headachw*', 'headacje*', 'headacke*', 'headack*', 'head ack*', 'heddache*', 'headdache*', 'headaache*', 'heaadache*', 'headachee*', 'hadache*', 'headeache*', 'headech*', 'hedach', 'heachache*', 'headahe*', 'headcahe*', 'hesdache*', 'jeadache*', 'headachs', 'headachea', 'heaadche*')) {
    picks.add(3, P.acetaminophen, P.ibuprofen, P.naproxen);
  }
  // Lay descriptions of a headache.
  if (has(t, 'head hurts', 'head hurt', 'head hurting', 'head is hurting', 'head is killing me', 'head killing me', 'my head is killing me', 'head is pounding', 'pounding head', 'head pounding', 'head is throbbing', 'throbbing head', 'head throbbing', 'head throbs', 'head is splitting', 'splitting head', 'splitting headache', 'head feels like its going to explode', "head feels like it's going to explode", 'head is exploding', 'head aches', 'head is aching', 'aching head', 'achy head', 'sore head', 'my head is sore', 'head is sore', 'head feels heavy', 'heavy head', 'head is heavy', 'head is spinning with pain', 'my head', 'head is banging', 'banging head', 'banging headache', 'head is thumping', 'thumping head', 'pressure in my head', 'head pressure', 'pressure behind my eyes', 'pressure behind the eyes', 'pressure in my temples', 'pain in my temples', 'temples hurt', 'temples are throbbing', 'temple pain', 'forehead hurts', 'forehead pain', 'pain in my forehead', 'back of my head hurts', 'back of my head', 'base of my skull', 'skull hurts', 'brain hurts', 'my brain hurts', 'brain is pounding', 'brain ache', 'brainache', 'noggin hurts', 'dome hurts', 'skull is pounding', 'band around my head', 'tight band around my head', 'vice on my head', 'hammering head', 'head is hammering')) {
    picks.add(3, P.acetaminophen, P.ibuprofen, P.naproxen);
  }
  // Named headache types.
  if (has(t, 'tension headache*', 'tension head ache*', 'stress headache*', 'cluster headache*', 'sinus headache*', 'caffeine headache*', 'caffeine withdrawal', 'eye strain headache*', 'screen headache*', 'dehydration headache*', 'rebound headache*', 'hormonal headache*', 'menstrual headache*', 'ice cream headache*', 'brain freeze', 'tension head', 'stress head')) {
    picks.add(3, P.acetaminophen, P.ibuprofen, P.naproxen);
  }

  // ---- Migraines ----
  if (has(t, 'migraine*', 'migrane*', 'migrain', 'migrains', 'migranes', 'migrayne*', 'migreine*', 'migrene*', 'migrine*', 'migriane*', 'migarine*', 'migaine*', 'migrainne*', 'miagraine*', 'mygraine*', 'mygrain*', 'megraine*', 'megrain*', 'migrqine*', 'migranie*', 'migraiine*', 'migreign*', 'my grain*', 'mi graine*', 'aura', 'auras', 'visual aura*', 'ocular migraine', 'menstrual migraine', 'migrainous')) {
    picks.add(3, P.ibuprofen, P.acetaminophen, P.naproxen);
  }

  // ---- Fever, temperature, chills ----

  // Fever words.
  if (has(t, 'fever*', 'feverish', 'feverishness', 'febrile', 'pyrexia', 'low grade fever', 'high fever', 'slight fever', 'running a fever', 'got a fever', 'have a fever', 'spiking a fever', 'spiked a fever', 'fever broke')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }
  // Fever misspellings.
  if (has(t, 'fevr*', 'feaver*', 'feever*', 'fevar*', 'fevor*', 'fevere*', 'fevver*', 'fefer*', 'fver*', 'feveer*', 'feverr*', 'fevrish', 'feavor*', 'feverisch', 'feverich', 'fevirish', 'feverisj')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }
  // Temperature and feeling hot, with misspellings.
  if (has(t, 'temperature', 'temperatures', 'temp of 9*', 'temp of 10*', 'temp of 38*', 'temp of 39*', 'temp of 40*', 'temp is high', 'temp is up', 'temp is 10*', 'high temp', 'a temp', 'running a temp', 'have a temp', 'got a temp', 'running a temperature', 'high temperature', 'elevated temperature', 'tempature*', 'temprature*', 'temperture*', 'tempreture*', 'temperatue*', 'temparature*', 'tempurature*', 'temperatur', 'tempeture*', 'temprture*', 'tempertaure*', 'tempratue*', 'temerature*', 'running hot', 'burning up', 'im burning up', 'body is burning up', 'body feels hot', 'feel hot', 'feeling hot', 'i feel hot', 'skin feels hot', 'forehead is hot', 'forehead feels hot', 'hot forehead', 'hot to the touch', 'feel warm', 'feeling warm', 'thermometer', 'thermometer says', 'degrees fahrenheit', '100 degrees', '101 degrees', '102 degrees', '103 degrees', '99 degrees', '38 degrees', '39 degrees', 'hot and cold', 'sweating and shivering')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }
  // Chills and shivers.
  if (has(t, 'chills', 'the chills', 'got chills', 'getting chills', 'chilly and achy', 'chils', 'chillls', 'chlls', 'shivers', 'shivering', 'shivery', 'shiverring', 'shivring', 'shakes and chills', 'cold sweats', 'cold sweat', 'night sweats', 'teeth chattering', 'rigors', 'cant stop shaking', "can't stop shaking", 'goosebumps and achy')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }
  // Flu-like aches with fever.
  if (has(t, 'flu ache*', 'achy and feverish', 'aches and fever', 'fever and aches', 'fever and chills', 'malaise', 'run down and achy')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }

  // ---- Back and neck ----

  // Back pain and misspellings.
  if (has(t, 'back pain*', 'backpain*', 'my bak', 'bak hurts', 'bak hurt', 'bak ache*', 'bak is sore', 'bak is killing me', 'bak is killin me', 'backache*', 'back ache*', 'back hurts', 'back hurt', 'back hurting', 'back is hurting', 'back is killing me', 'back killing me', 'back is sore', 'sore back', 'back soreness', 'back is aching', 'aching back', 'achy back', 'lower back', 'low back', 'lumbar', 'lumbago', 'upper back', 'mid back', 'middle back', 'back spasm*', 'back strain', 'strained my back', 'pulled my back', 'tweaked my back', 'threw out my back', 'threw my back out', 'put my back out', 'hurt my back', 'injured my back', 'messed up my back', 'back went out', 'my back went', 'bad back', 'stiff back', 'back is stiff', 'back stiffness', 'sciatica', 'sciatic*', 'siatica', 'sciatca', 'scyatica', 'pinched nerve', 'slipped disc', 'slipped disk', 'herniated disc', 'herniated disk', 'bulging disc', 'tailbone', 'tail bone', 'coccyx', 'spine hurts', 'spine pain', 'spinal pain', 'between my shoulder blades', 'shoulder blade*', 'bak pain', 'bakc pain', 'backk pain', 'back pian', 'back pane', 'back painn', 'bakache', 'backake', 'back ake', 'backach', 'back ach', 'backahce', 'lowerback', 'lower bak', 'lumbar pain', 'lumber pain', 'lumbar strain', 'kidney area pain')) {
    picks.add(3, P.naproxen, P.ibuprofen, P.acetaminophen);
  }
  // Neck pain and misspellings.
  if (has(t, 'neck pain*', 'neckpain', 'neck ache*', 'neckache*', 'neck hurts', 'neck hurt', 'neck hurting', 'neck is killing me', 'neck is sore', 'sore neck', 'neck soreness', 'stiff neck', 'neck is stiff', 'neck stiffness', 'crick in my neck', 'crick in neck', 'crick neck', 'kink in my neck', 'kinked neck', 'slept wrong', 'slept funny', 'slept on my neck wrong', 'slept on it wrong', 'whiplash', 'neck strain', 'strained my neck', 'pulled my neck', 'tweaked my neck', 'neck spasm*', 'can t turn my head', "can't turn my head", 'cant turn my head', 'nek pain', 'neck pian', 'neck pane', 'necck pain', 'nck pain', 'stif neck', 'stiff nek', 'stiffneck', 'cervical pain', 'trap pain', 'traps hurt', 'trapezius')) {
    picks.add(3, P.naproxen, P.ibuprofen, P.acetaminophen);
  }

  // ---- Muscles, strains, sprains, body aches ----

  // Muscle words and misspellings.
  if (has(t, 'muscle*', 'musle*', 'mussle*', 'muscel*', 'mucsle*', 'muscl', 'musscle*', 'muslce*', 'mucle*', 'muskle*', 'muscule*', 'msucle*', 'muschle*', 'muscular', 'musculer', 'myalgia', 'mialgia', 'myalgias')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }
  // Exercise soreness.
  if (has(t, 'sore from', 'workout', 'worked out', 'working out', 'after the gym', 'gym', 'leg day', 'arm day', 'lifting weights', 'lifted weights', 'overdid it', 'over did it', 'overexerted', 'overexertion', 'doms', 'delayed onset', 'post workout', 'after my run', 'after running', 'ran a marathon', 'marathon', 'half marathon', 'after hiking', 'after soccer', 'after basketball', 'after football', 'after practice', 'sore after', 'so sore', 'really sore', 'super sore', 'sore all over', 'sore everywhere', 'sore legs', 'legs are sore', 'sore arms', 'arms are sore', 'sore calves', 'sore thighs', 'sore quads', 'sore hamstring*', 'sore glutes', 'sore abs', 'sore chest muscles', 'sore shoulders', 'shoulders are sore', 'abs hurt', 'legs hurt', 'legs ache', 'aching legs', 'achy legs', 'arms hurt', 'arms ache', 'calves hurt', 'calf hurts', 'calf pain', 'thigh pain', 'hamstring', 'hamstrings', 'quad pain', 'groin pull', 'groin strain', 'pulled groin', 'shin splint*', 'shinsplint*', 'charley horse', 'charlie horse', 'leg cramp*', 'calf cramp*', 'foot cramp*', 'muscle cramp*', 'knot in my', 'knots in my', 'tight muscles', 'tight hamstrings', 'stiff and sore', 'sore and stiff')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }
  // Strains, sprains, pulls and minor injuries, with misspellings.
  if (has(t, 'pulled', 'pulled a', 'strain*', 'sprain*', 'sprane*', 'sprian*', 'spraned', 'spraind', 'sprainned', 'strane*', 'strayn*', 'strainned', 'twisted my ankle', 'twisted ankle', 'rolled my ankle', 'rolled ankle', 'twisted my knee', 'tweaked', 'tweaked my', 'jammed my finger', 'jammed finger', 'stubbed my toe', 'stubbed toe', 'bruise*', 'bruising', 'bruized', 'brused', 'bumped my', 'banged my', 'fell on my', 'fell and hurt', 'minor injury', 'minor injuries', 'sports injury', 'sports injuries', 'tendonitis', 'tendinitis', 'tendonitus', 'tendinitus', 'tennis elbow', 'golfers elbow', "golfer's elbow", 'runners knee', "runner's knee", 'plantar fasciitis', 'plantar fasciitus', 'plantar faciitis', 'heel pain', 'heel hurts', 'arch pain', 'carpal tunnel', 'repetitive strain', 'rsi', 'rotator cuff', 'frozen shoulder', 'bursitis', 'bursitus')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }
  // Body aches and general achiness.
  if (has(t, 'body ache*', 'body aches', 'bodyache*', 'body pain*', 'body hurts', 'body hurting', 'body is sore', 'body is aching', 'body is killing me', 'whole body hurts', 'whole body aches', 'everything hurts', 'everything aches', 'hurts all over', 'aching all over', 'achy all over', 'aches all over', 'aches and pains', 'aches & pains', 'aching', 'achy', 'achey', 'akey', 'acheing', 'akeing', 'aking', 'achyness', 'achiness', 'achieness', 'body ake*', 'body ach', 'bdy ache*', 'boddy ache*', 'body aces', 'sore body', 'feel beat up', 'feel like i got hit by a truck', 'hit by a truck', 'feel run over', 'bones hurt', 'bones ache', 'my bones', 'bone pain', 'growing pains', 'fibromyalgia', 'fibro', 'fibromyalga')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }

  // ---- Joints, arthritis, stiffness, inflammation ----

  // Joint and arthritis words with misspellings.
  if (has(t, 'joint*', 'jiont*', 'jont*', 'joynt*', 'joitn*', 'arthritis', 'arthritic', 'athritis', 'arthritus', 'arthiritis', 'arthritic pain', 'artheritis', 'arthrites', 'arthritys', 'arthrittis', 'artritis', 'arthirtis', 'athritus', 'arthiritus', 'arthritis pain', 'osteoarthritis', 'osteo arthritis', 'osteoarthritus', 'rheumatoid', 'rheumatism', 'rhuematoid', 'rheumatic', 'rhumatism', 'rhuematism', 'gout', 'gouty', 'arthralgia', 'wear and tear', 'creaky', 'creaky knees', 'creaky joints', 'old injury', 'old injuries')) {
    picks.add(3, P.naproxen, P.ibuprofen, P.acetaminophen);
  }
  // Specific joints and limbs.
  if (has(t, 'knee*', 'kneecap*', 'my nee', 'my nees', 'nee hurts', 'nees hurt', 'nee pain', 'knne*', 'kene pain', 'neee pain', 'shoulder*', 'sholder*', 'shouldr*', 'sholdier*', 'wrist*', 'wirst*', 'ankle*', 'ancle*', 'ankel*', 'elbow*', 'elbo', 'elbo pain', 'hip pain', 'hips hurt', 'hip hurts', 'hip ache*', 'sore hip*', 'hip joint', 'finger joints', 'fingers hurt', 'fingers ache', 'knuckle*', 'thumb hurts', 'thumb pain', 'toe pain', 'big toe', 'toes hurt', 'foot pain', 'feet hurt', 'foot hurts', 'feet ache', 'sore feet', 'sore foot', 'aching feet', 'hand pain', 'hands hurt', 'hand hurts', 'hands ache', 'arm pain', 'arm hurts', 'leg pain', 'leg hurts', 'leg ache*', 'rib pain', 'ribs hurt', 'sore ribs')) {
    picks.add(3, P.naproxen, P.ibuprofen, P.acetaminophen);
  }
  // Stiffness, swelling and inflammation.
  if (has(t, 'stiff', 'stiffness', 'stiffnes', 'stifness', 'stif', 'stiffened', 'stiff joints', 'morning stiffness', 'stiff in the morning', 'cant bend', "can't bend", 'cant move my', "can't move my", 'limited range of motion', 'inflammation', 'inflamation', 'inflammaton', 'inflamed', 'inflammed', 'inflamd', 'inflammatory', 'anti inflammatory', 'antiinflammatory', 'anti inflamatory', 'nsaid*', 'swelling', 'swollen', 'swolen', 'sweling', 'swelled up', 'swollen joint*', 'swollen knee', 'swollen ankle', 'puffy joints')) {
    picks.add(3, P.naproxen, P.ibuprofen, P.acetaminophen);
  }

  // ---- Menstrual cramps and period pain ----
  if (has(t, 'cramp*', 'cramping', 'crampy', 'cramo*', 'cramsp', 'crmaps', 'crmps', 'cramprs', 'krampz', 'kramps')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }
  if (has(t, 'my period*', 'period camps', 'period crams', 'period cram', 'period cramos', 'period cramp*', 'got my period', 'having my period', 'during my period', 'period is', 'periods are', 'bad period*', 'painful period*', 'heavy period*', 'menstrual', 'menstruation', 'menstruating', 'menstrating', 'menstral', 'mentrual', 'menstual', 'menstraul', 'menstural', 'mensural', 'menstruel', 'menustral', 'menstration', 'mestrual', 'menstuation', 'menses', 'menstrual cramp*', 'menstral cramp*', 'period cramp*', 'period pain*', 'period pian', 'period hurts', 'perod*', 'peroid*', 'periud*', 'preiod*', 'piriod*', 'pms', 'pmsing', 'pmdd', 'premenstrual', 'pre menstrual', 'time of the month', 'that time of the month', 'that time of month', 'on my period', 'on my cycle', 'monthly cycle', 'aunt flo', 'auntie flo', 'shark week', 'on the rag', 'red week', 'dysmenorrhea', 'dysmenorrhoea', 'menstrual pain', 'uterus hurts', 'uterine cramp*', 'womb hurts', 'ovaries hurt', 'ovary pain', 'ovulation pain', 'ovulation cramp*', 'mittelschmerz', 'endometriosis', 'endo pain', 'pelvic cramp*', 'lower belly cramp*', 'heavy flow')) {
    picks.add(3, P.ibuprofen, P.naproxen, P.acetaminophen);
  }

  // ---- Toothache, dental and jaw ----
  if (has(t, 'toothache*', 'tooth ache*', 'toothace*', 'tooth ace', 'toothach', 'tooth ach', 'toothake*', 'tooth ake*', 'tothache*', 'toohache*', 'tootache*', 'toothahce*', 'teethache*', 'teeth ache*', 'tooth', 'teeth', 'toof', 'tooth pain', 'teeth hurt', 'tooth hurts', 'tooth is killing me', 'tooth is throbbing', 'throbbing tooth', 'sore tooth', 'sore teeth', 'sensitive teeth', 'sensitive tooth', 'molar*', 'wisdom tooth', 'wisdom teeth', 'wisdom tooth pain', 'wisdon teeth', 'wisdome teeth', 'cavity', 'cavities', 'cavaty', 'cavitie', 'filling fell out', 'lost a filling', 'cracked tooth', 'chipped tooth', 'broken tooth', 'abscess*', 'abcess*', 'absess*', 'root canal', 'tooth extraction', 'tooth pulled', 'teeth pulled', 'dry socket', 'dental', 'dental pain', 'dentist', 'dentists', 'after the dentist', 'dentistry', 'gum pain', 'gums hurt', 'gum hurts', 'sore gums', 'swollen gums', 'gums are sore', 'braces hurt', 'braces tightened', 'teething pain', 'jaw pain', 'jaw hurts', 'jaw ache*', 'jaw is sore', 'sore jaw', 'aching jaw', 'jaw clicking', 'tmj', 'tmd', 'grinding my teeth', 'teeth grinding', 'clenching my jaw', 'bruxism')) {
    picks.add(3, P.ibuprofen, P.acetaminophen, P.naproxen);
  }

  // ---- Hangover ----
  if (has(t, 'hangover*', 'hung over', 'hungover', 'hang over', 'hangvoer', 'hangovr', 'hagnover', 'hangoer', 'hangovver', 'hungovr', 'drank too much', 'drinking last night', 'too much to drink', 'too many drinks', 'partied too hard', 'rough night', 'big night out', 'morning after drinking', 'after drinking', 'out drinking', 'boozy night', 'wine headache*', 'beer headache*')) {
    picks.add(2, P.ibuprofen, P.naproxen);
  }

  // ---- Generic pain words (low weight; specific rules above win) ----
  // Side-effect questions and hypotheticals ("could this hurt my liver", "it might hurt") are not pain: drop them first.
  const g = t.replace(/\bhurts? (my|your|the) (liver|kidneys?)\b/g, ' ').replace(/\b(might|could|would|will|may) (it |this |that )?hurt\b(?! (so|really|a lot|bad))/g, ' ');
  if (has(g, 'pain', 'pains', 'painful', 'paining', 'in pain', 'hurt*', 'ache*', 'sore', 'soreness', 'sorness', 'soar', 'soarness', 'hirts', 'hutrs', 'hurst', 'hrts', 'pian', 'payn', 'painfull', 'painfl', 'paiful', 'ouch', 'ow', 'owie', 'throbbing', 'throbs', 'throbbin', 'throbing', 'stabbing pain', 'sharp pain', 'shooting pain', 'dull pain', 'dull ache', 'nagging pain', 'chronic pain', 'mild pain', 'minor pain', 'moderate pain', 'killing me', 'tender', 'tenderness', 'twinge*', 'discomfort', 'discomfert', 'uncomfortable', 'pain reliever*', 'pain relief', 'pain releif', 'pain releiver*', 'pain med*', 'pain pill*', 'pain tablet*', 'painkiller*', 'pain killer*', 'painkilers', 'pain kilers', 'pain medication', 'pain medicine', 'analgesic*', 'analgesia', 'something for pain', 'something for the pain', 'for the pain', 'take the edge off', 'fever reducer*', 'fever medicine', 'fever reliever*')) {
    picks.add(1, P.acetaminophen, P.ibuprofen, P.naproxen);
  }
  // Regular aspirin is an option for adult aches, ranked below the others.
  if (has(t, 'aspirin for pain', 'regular aspirin', 'regular strength aspirin', 'aspirin 325', '325 aspirin', '325mg aspirin', 'adult aspirin', 'full strength aspirin', 'aspirin for my headache', 'aspirin for headache*')) {
    picks.add(4, P.aspirin325, P.acetaminophen, P.ibuprofen);
  }
}
