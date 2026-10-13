import { P, has, type Picks } from '../shared';

// Allergies, hay fever, sneezing, runny/stuffy nose, sinuses, itchy/watery eyes, nasal sprays and hives.
// This file owns the "nose", "nasal", "sinus" and "eye" phrases. Brand names live in products.ts,
// colds / coughs / throats in respiratory.ts, generic itch and rashes in skin.ts.
export function allergyRules(t: string, picks: Picks) {
  // ---- Allergies in general ("allerg*" covers allergy, allergies, allergic, allergen, allergys, allergie) ----
  if (has(t, 'allerg*', 'antihistamine*', 'anti histamine*', 'antihistimine*', 'antihistamene*', 'antihistamin', 'antihistamines', 'anithistamine*', 'antihistemine*', 'antihystamine*', 'histamine*', 'allergic rhinitis', 'rhinitis', 'rhinitis*')) {
    picks.add(3, P.cetirizine, P.loratadine, P.fexofenadine);
  }
  // Allergy misspellings and typos ("alleg*" is avoided because it would match "allegedly").
  if (has(t, 'alerg*', 'allegies', 'allegy', 'allegic', 'allegie', 'alllerg*', 'allerhies', 'allerfies', 'allargies', 'allargy', 'allargic', 'allirgies', 'allirgy', 'allirgic', 'allerjies', 'allerjy', 'allerjic', 'alergees', 'allergeez', 'allery', 'alleries', 'allaergies', 'alleriges', 'allegries', 'allegeries', 'algeries', 'allgeries', 'allgergies', 'allregies', 'allregy', 'allregic', 'alrgies', 'alrgy', 'alrgic', 'aallergies', 'allerigic', 'allerigies', 'allerges', 'allersies', 'allercies', 'elergies', 'elergy', 'elergic', 'ellergies', 'ellergy', 'ellergic', 'allurgies', 'allurgy', 'allurgic', 'alurgies', 'alurgy', 'alurgic')) {
    picks.add(3, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Hay fever (and its typos / British wording) ----
  if (has(t, 'hay fever', 'hayfever', 'hay fevers', 'hay fver', 'hayfver', 'hay fevr', 'hayfevr', 'hay feaver', 'hayfeaver', 'hay feever', 'hayfeever', 'hay fiver', 'hey fever', 'heyfever', 'hai fever', 'hay fevor', 'hayfevor', 'hey fver', 'hay feber', 'hay ferver', 'hayfeber', 'pollinosis', 'cedar fever', 'mountain cedar', 'juniper fever', 'summer catarrh', 'rose fever', 'seasonal rhinitis')) {
    picks.add(4, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Seasons ("seasonal" alone is avoided: "seasonal depression", "seasonal job") ----
  if (has(t, 'seasonal sniffl*', 'seasonal sneez*', 'seasonal symptoms', 'seasonal stuffiness', 'change of seasons', 'changing seasons', 'season change*', 'seasons change', 'every spring', 'every fall', 'every autumn', 'every summer', 'in the spring i', 'springtime sneez*', 'spring sneez*', 'this time of year i', 'this time of the year i', 'when the trees bloom', 'trees are blooming', 'everything is blooming', 'flowers are blooming', 'when flowers bloom', 'blooming season')) {
    picks.add(3, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Pollen, trees, grass and weeds ----
  if (has(t, 'pollen*', 'polen*', 'pollin', 'pollon', 'polin', 'pollan', 'pollen count', 'high pollen', 'pollen is bad', 'pollen is high', 'pollen season', 'pollen allergy', 'yellow dust on my car',
    'tree pollen', 'trees', 'oak pollen', 'oak trees', 'birch', 'birch pollen', 'birch trees', 'cedar', 'juniper', 'juniper pollen', 'pine pollen', 'maple pollen', 'elm pollen', 'alder', 'alder pollen', 'olive tree*', 'olive pollen', 'cottonwood', 'cottonwood fluff', 'poplar', 'ash pollen', 'hickory pollen', 'walnut pollen', 'sycamore', 'pecan pollen', 'cypress pollen',
    'grass pollen', 'grasses', 'cut grass', 'freshly cut grass', 'fresh cut grass', 'timothy grass', 'bermuda grass', 'rye grass', 'ryegrass', 'leaf mold',
    'ragweed', 'rag weed', 'ragweeds', 'ragweed season', 'weed pollen', 'goldenrod', 'sagebrush', 'mugwort', 'pigweed', 'lambs quarters', 'tumbleweed', 'flowers make me')) {
    picks.add(3, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Indoor triggers: dust, mold, pets ("cat"/"dog" alone are avoided: "my cat scratched me", "dog bite";
  // so are "new puppy" / "litter box" alone: "i got a new puppy" is not a symptom, and the symptom words catch the rest) ----
  if (has(t, 'dust', 'dusty', 'dusting', 'dust mite*', 'dustmite*', 'dust bunnies', 'dusty room', 'dusty house', 'dusty attic', 'cleaning the attic', 'cleaning the basement', 'feather pillow*', 'down pillow*',
    'mold', 'mould', 'moldy', 'mouldy', 'mold spores', 'mould spores', 'mildew', 'musty', 'damp house', 'damp room', 'damp basement', 'black mold',
    'pet dander', 'dander', 'cat dander', 'dog dander', 'cat hair', 'dog hair', 'pet hair', 'animal hair', 'animal dander', 'cat fur', 'dog fur', 'pet fur', 'cat saliva', 'kitten dander', 'kitten fur', 'puppy dander', 'puppy fur', 'litter box dust', 'cat litter dust', 'dusty litter',
    'around cats', 'around my cat', 'around the cat', 'around dogs', 'around my dog', 'around the dog', 'around animals', 'around pets', 'near cats', 'near my cat', 'near dogs', 'pet my cat', 'petting the cat', 'petting cats', 'petted a cat', 'petting the dog', 'petting dogs', 'cats make me', 'cat makes me', 'my cat makes me', 'dogs make me', 'dog makes me', 'my dog makes me', 'house with cats', 'house with a cat', 'house with dogs', 'horse dander', 'rabbit hair', 'bunny fur')) {
    picks.add(3, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Sneezing (and typos: sneazing, sneezeing, snezing, sneesing) ----
  if (has(t, 'sneez*', 'sneaz*', 'snez*', 'snees*', 'sneex*', 'sneaze*', 'sneize*', 'sneeze*', 'sneexing', 'sneezng', 'sneexe', 'snzeing', 'snezze*', 'sneeeze*', 'sneeezing', 'sneezies', 'achoo', 'ah choo', 'ahchoo', 'atchoo', 'a choo', 'kerchoo')) {
    picks.add(3, P.cetirizine, P.loratadine, P.chlorpheniramine);
  }
  if (has(t, 'sneezing my head off', 'sneezing like crazy', 'sneezing nonstop', 'sneezing non stop', 'cant stop sneezing', "can't stop sneezing", 'cannot stop sneezing', 'wont stop sneezing', "won't stop sneezing", 'keep sneezing', 'keeps sneezing', 'been sneezing', 'sneezing fit*', 'sneezing attack*', 'sneeze attack*', 'sneezing all day', 'sneezing so much', 'sneezing a lot', 'sneezing constantly', 'constantly sneezing', 'sneezing every morning', 'sneezing in the morning')) {
    picks.add(4, P.cetirizine, P.loratadine, P.chlorpheniramine);
  }

  // ---- Runny / drippy nose and post-nasal drip ----
  if (has(t, 'runny nose', 'runny noses', 'runy nose', 'runnny nose', 'runney nose', 'runnie nose', 'runnynose', 'rummy nose', 'runny noes', 'runny nsoe', 'runny nos', 'runy noes', 'running nose', 'nose is running', 'nose running', 'nose runs', 'nose keeps running', 'nose wont stop running', "nose won't stop running", 'nose will not stop running', 'nose is always running', 'nose running constantly', 'nose is runny', 'nose is so runny',
    'drippy nose', 'dripping nose', 'nose dripping', 'nose is dripping', 'nose drips', 'nose is like a faucet', 'nose like a faucet', 'nose is a faucet', 'leaky nose', 'nose is leaking', 'leaking nose', 'streaming nose', 'nose is streaming', 'snotty nose', 'snotty', 'snot everywhere', 'snot running', 'snot dripping', 'blowing my nose', 'blow my nose', 'keep blowing my nose', 'nose blowing', 'going through tissues', 'box of tissues', 'clear snot', 'watery snot', 'clear mucus from my nose', 'watery nose',
    'post nasal drip', 'postnasal drip', 'post nasal', 'postnasal', 'post nasel drip', 'post nazal drip', 'postnasel drip', 'post nasal drop', 'post natal drip', 'nasal drip', 'pnd', 'sinus drip', 'sinus drainage', 'nasal drainage', 'drainage down my throat', 'drip down my throat', 'dripping down my throat', 'dripping down the back of my throat', 'drip in the back of my throat', 'mucus in the back of my throat', 'drainage in my throat', 'keep clearing my throat', 'constantly clearing my throat', 'clearing my throat')) {
    picks.add(3, P.cetirizine, P.loratadine, P.chlorpheniramine);
  }
  // Itchy nose / palate / ears are classic hay fever signs.
  if (has(t, 'itchy nose', 'itchey nose', 'itchie nose', 'nose itch*', 'nose is itchy', 'nose feels itchy', 'tickle in my nose', 'tickly nose', 'nose tickl*', 'tickling in my nose', 'itchy nostril*', 'itchy palate', 'itchy roof of my mouth', 'roof of my mouth itches', 'itchy ears and eyes', 'itchy eyes and nose', 'itchy nose and eyes', 'itchy eyes and runny nose', 'sneezing and itchy eyes', 'sneezing and runny nose', 'runny nose and sneezing', 'allergy symptoms', 'allergy season')) {
    picks.add(4, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Non-drowsy / daytime preference ("for work" / "daytime" alone are avoided: they hijack unrelated messages) ----
  if (has(t, 'non drowsy', 'nondrowsy', 'non drowsey', 'nondrowsey', 'non drowzy', 'non drowsing', 'none drowsy', 'not drowsy', 'no drowsiness', 'without drowsiness', 'less drowsy', 'least drowsy', 'not make me drowsy', 'wont make me drowsy', "won't make me drowsy", 'doesnt make me drowsy', "doesn't make me drowsy", 'wont make me sleepy', "won't make me sleepy", 'doesnt make me sleepy', "doesn't make me sleepy", 'not make me sleepy', 'without making me sleepy', 'without making me drowsy', 'without making me tired', 'wont make me tired', "won't make me tired", 'doesnt make me tired', "doesn't make me tired", 'not knock me out', 'wont knock me out', "won't knock me out", 'without knocking me out', 'non sedating', 'nonsedating', 'non sedative', 'daytime allergy', 'daytime antihistamine', 'allergy pill for work', 'allergy medicine for work', 'allergies at work', 'allergies at school')) {
    picks.add(2, P.fexofenadine, P.loratadine);
  }
  // Wanting the opposite: a drowsy antihistamine at night for allergies.
  if (has(t, 'allergies at night', 'allergies keeping me up', 'allergies keep me up', 'sneezing at night', 'nighttime allergy', 'night time allergy', 'allergy medicine at night', 'drowsy antihistamine', 'sedating antihistamine')) {
    picks.add(3, P.diphenhydramine, P.chlorpheniramine, P.cetirizine);
  }

  // ---- Itchy eyes (and typos: itchey eyes, itchy eys, ichy eyes) ----
  if (has(t, 'itchy eye*', 'itchey eye*', 'itchie eye*', 'ichy eye*', 'itcy eye*', 'itchyeyes', 'itchy eys', 'itchy eyse', 'itchy eyez', 'itchy yees', 'itchy eues', 'itchy wyes', 'itching eye*', 'eyes itch*', 'eye itch*', 'eyes are itchy', 'eyes r itchy', 'eyes are so itchy', 'eyes r so itchy', 'eyes feel itchy', 'eyes keep itching', 'eyeballs itch*', 'itchy eyeball*', 'itchy eyelid*', 'eyelids itch*', 'rubbing my eyes', 'rub my eyes', 'cant stop rubbing my eyes', "can't stop rubbing my eyes", 'want to scratch my eyes', 'scratch my eyes out', 'claw my eyes out', 'scratchy eye*', 'gritty eye*', 'eyes feel gritty', 'eyes feel scratchy', 'sandy eyes', 'eyes feel like sand')) {
    picks.add(4, P.olopatadine, P.cetirizine, P.loratadine);
  }
  // ---- Watery / teary / streaming eyes ----
  if (has(t, 'watery eye*', 'watery eys', 'watery eyse', 'watery eyez', 'watry eye*', 'waterey eye*', 'wattery eye*', 'watterey eye*', 'watering eye*', 'eyes are watering', 'eyes watering', 'eyes water', 'eyes keep watering', 'eyes wont stop watering', "eyes won't stop watering", 'eyes are watery', 'eyes are so watery', 'teary eye*', 'tearing eye*', 'eyes tearing', 'eyes are tearing', 'eyes tear up', 'eyes tearing up', 'eyes keep tearing', 'streaming eye*', 'eyes are streaming', 'eyes streaming', 'runny eye*', 'eyes are running', 'eyes running', 'crying eyes from pollen', 'look like im crying', "look like i'm crying", 'look like i have been crying')) {
    picks.add(4, P.olopatadine, P.cetirizine, P.loratadine);
  }
  // ---- Red / bloodshot / burning / puffy eyes from allergies ----
  if (has(t, 'red eyes', 'reddish eyes', 'eyes are red', 'eyes are so red', 'eyes look red', 'eyes red', 'redness in my eyes', 'eye redness', 'red itchy eye*', 'red watery eye*', 'bloodshot', 'blood shot', 'bloodshot eye*', 'blood shot eye*', 'eyes are bloodshot', 'irritated eye*', 'eye irritation', 'eyes are irritated', 'eyes feel irritated', 'eyes burn*', 'burning eye*', 'eyes are burning', 'eyes are on fire', 'eyes sting*', 'stinging eye*', 'eyes are stinging',
    'puffy eye*', 'puffy eyelid*', 'eyes are puffy', 'eyes puffy', 'puffy under my eyes', 'swollen eyelid*', 'eyelids are swollen', 'eyes are swollen', 'swollen eyes', 'eye swelling', 'allergic shiners', 'dark circles from allergies', 'baggy eyes from allergies')) {
    picks.add(3, P.olopatadine, P.cetirizine, P.loratadine);
  }
  // ---- Eye allergy / eye drops ----
  if (has(t, 'eye allerg*', 'allergy eye*', 'eye alergies', 'eye alergy', 'allergic eye*', 'allergic conjunctivitis', 'allergic conjuctivitis', 'eyes are allergic', 'pollen in my eyes', 'pollen in my eye', 'eyes from pollen', 'eyes from the pollen', 'eye drop*', 'eyedrop*', 'eye drp*', 'eye dropps', 'eyedrps', 'eye drips', 'drops for my eyes', 'drops for itchy eyes', 'antihistamine eye drop*', 'allergy drops', 'itchy eye drops', 'eye wash', 'eyewash', 'contact lenses itch', 'contacts are itchy', 'contacts itch')) {
    picks.add(5, P.olopatadine);
  }

  // ---- Stuffy / blocked nose ("congest*" alone is avoided so "chest congestion" stays with respiratory.ts) ----
  if (has(t, 'stuffy', 'stuffy nose', 'stuffy noes', 'stuffy nos', 'stuffy nsoe', 'stufy nose', 'stufy', 'stuffie nose', 'stuffey nose', 'stuffed nose', 'stufed nose', 'stuff nose', 'stuffynose', 'stuffiness', 'nasal stuffiness', 'stuffed up', 'stuffed up nose', 'all stuffed up', 'nose is stuffed', 'nose is stuffy', 'nose is so stuffy', 'nose feels stuffy',
    'blocked nose', 'nose is blocked', 'blocked up nose', 'nose blocked', 'blocked sinuses', 'plugged nose', 'nose is plugged', 'plugged up nose', 'clogged nose', 'nose is clogged', 'nose is all clogged', 'nose is all stuffed', 'nose is all blocked', 'nose all clogged', 'clogged up nose', 'clogged sinuses', 'clogged nostril*', 'blocked nostril*', 'nostril is blocked', 'nostrils are blocked', 'one nostril', 'stuffy nostril*', 'nose is closed', 'nose closed up', 'nose is shut', 'stopped up nose', 'nose is stopped up', 'full nose', 'nose feels full',
    "can't breathe through my nose", 'cant breathe through my nose', 'cannot breathe through my nose', "can't breath through my nose", 'cant breath through my nose', "can't breathe out of my nose", 'cant breathe out of my nose', "can't breathe out my nose", 'cant breathe out my nose', 'cant breath out of my nose', 'hard to breathe through my nose', 'trouble breathing through my nose', 'breathing through my mouth', 'mouth breathing', 'nose wont let me breathe', 'snoring from congestion')) {
    picks.add(3, P.oxymetazoline, P.saline, P.budesonide);
  }
  // Congestion and its typos (congestoin, congestd, conjestion); chest congestion is left to respiratory.ts.
  if (!has(t, 'chest') && has(t, 'congestion', 'congested', 'nasal congestion', 'nose congestion', 'congested nose', 'nose is congested', 'head congestion', 'congested head', 'congestion in my nose', 'congestion in my head', 'congestion from allergies', 'congestoin', 'congestd', 'congestin', 'congestian', 'congesion', 'congeston', 'congetion', 'congestino', 'congestiom', 'congestioon', 'congeshun', 'conjestion', 'conjested', 'congestef', 'congesterd', 'congersted', 'congensted', 'congestted', 'nasal congestoin', 'nasel congestion', 'nazal congestion', 'decongest', 'decongestant*', 'decongestent', 'decongestint', 'nasal decongestant*', 'decongestant spray', 'unblock my nose', 'unclog my nose', 'unstuff my nose', 'open up my nose', 'open my nose', 'clear my nose', 'clear my sinuses', 'clear up my nose')) {
    picks.add(3, P.oxymetazoline, P.saline, P.budesonide);
  }

  // ---- Sinuses (and typos: sinis, sinsus, synus). Pain/headache phrases belong to pain.ts. ----
  if (has(t, 'sinus*', 'sinis', 'sinuss', 'sinsus', 'sinsuses', 'sinues', 'sinous', 'sinuse', 'synus', 'synuses', 'sinas', 'sinos', 'sinsu', 'siuns', 'snius', 'sinsis', 'sinuces', 'sinueses', 'sinu', 'cynus', 'sianus', 'sinuis', 'sinusis')) {
    picks.add(3, P.oxymetazoline, P.saline, P.budesonide);
  }
  if (has(t, 'pressure in my face', 'face pressure', 'facial pressure', 'pressure in my cheeks', 'cheek pressure', 'pressure around my eyes', 'pressure around my nose', 'pressure in my nose', 'nose pressure', 'nasal pressure', 'stuffy head', 'head feels stuffed', 'head feels full', 'blocked ears from congestion', 'ears feel plugged from congestion')) {
    picks.add(3, P.oxymetazoline, P.saline, P.budesonide);
  }
  // Backed-up nose or sinuses.
  if (has(t, 'nose is backed up', 'nose is all backed up', 'backed up nose', 'nose backed up', 'sinuses are backed up', 'sinuses backed up', 'backed up sinuses')) {
    picks.add(3, P.saline, P.oxymetazoline, P.budesonide);
  }
  // Post-nasal drip and sinus headaches: a saline rinse or decongestant spray alongside the antihistamines / pain relievers.
  if (has(t, 'post nasal drip', 'postnasal drip', 'post nasal', 'postnasal', 'sinus drip', 'sinus drainage', 'drip down my throat', 'dripping down the back of my throat')) {
    picks.add(3, P.saline, P.budesonide);
  }
  if (has(t, 'sinus headache*', 'sinus head ache*', 'sinus pressure headache*', 'headache from my sinus*', 'headache from sinus*')) {
    picks.add(3, P.saline, P.oxymetazoline);
  }
  // A sinus infection may need a doctor; only the gentle saline rinse is ranked first here.
  if (has(t, 'sinus infection*', 'sinus infecton', 'sinus infektion', 'sinus infeccion', 'sinusitis', 'sinusitus', 'sinusites', 'sinisitis', 'sinusitis*', 'synusitis', 'sinus infection again')) {
    picks.add(2, P.saline, P.budesonide);
  }

  // ---- Dry nose, nosebleeds from dry air, saline and rinses ----
  if (has(t, 'dry nose', 'nose is dry', 'nose feels dry', 'nose is so dry', 'dry nostril*', 'nostrils are dry', 'nostrils feel dry', 'dry nasal', 'dry nasal passages', 'nasal dryness', 'dryness in my nose', 'crusty nose', 'nose is crusty', 'crusty nostril*', 'crusts in my nose', 'scabs in my nose', 'scab in my nose', 'nose scab*', 'boogers', 'dry boogers', 'cracked nostril*', 'sore nostril*', 'nostrils are sore', 'raw nostril*', 'irritated nose', 'nose is irritated', 'nasal irritation', 'nose burns', 'burning nose', 'nose is burning',
    'nosebleed*', 'nose bleed*', 'nosebleads', 'nose blead*', 'nosebled', 'nosebleeding', 'nose bled', 'bloody nose', 'bloody noses', 'nose is bleeding', 'nose bleeding', 'nose keeps bleeding', 'blood in my nose', 'blood when i blow my nose', 'bloody snot', 'bloody boogers',
    'dry air', 'dry indoor air', 'air is dry', 'air is so dry', 'dry climate', 'dry winter air')) {
    picks.add(3, P.saline);
  }
  if (has(t, 'salt water spray', 'saltwater spray', 'salt water rinse', 'saltwater rinse', 'salt spray', 'salt water for my nose', 'rinse my nose', 'nose rinse', 'nasal rinse', 'nasal wash', 'nose wash', 'wash out my nose', 'flush my nose', 'flush out my nose', 'nasal flush', 'nasal irrigation', 'nose irrigation', 'neti pot', 'netipot', 'nettie pot', 'neti', 'nasal mist', 'nose mist', 'moisturize my nose', 'moisten my nose', 'drug free nasal spray', 'drug-free nasal spray', 'gentle nasal spray', 'natural nasal spray')) {
    picks.add(4, P.saline);
  }

  // ---- Nasal sprays in general and nasal steroids ----
  if (has(t, 'nasal spray*', 'nose spray*', 'nasel spray*', 'nasal sprai', 'nasal sprey', 'nazal spray', 'nasal sparay', 'nasal sprays', 'nose sprey', 'spray for my nose', 'spray for the nose', 'spray up my nose', 'something to spray', 'nasal inhaler', 'nose drops', 'nasal drops', 'nasal mist spray')) {
    picks.add(2, P.budesonide, P.saline, P.oxymetazoline);
  }
  if (has(t, 'nasal steroid*', 'steroid nasal', 'steroid nasal spray', 'steroid spray', 'steroid nose spray', 'nose steroid', 'corticosteroid spray', 'corticosteroid nasal', 'allergy nasal spray', 'allergy spray', 'nasal allergy spray', 'nose allergy spray', 'long term allergies', 'year round allergies', 'all year allergies', 'every day allergies', 'everyday allergies', 'daily allergies', 'chronic allergies', 'chronic rhinitis', 'chronic congestion', 'chronic stuffy nose', 'always stuffy', 'always congested', 'permanently stuffy', 'nasal polyp*', 'polyps')) {
    picks.add(3, P.budesonide, P.saline, P.cetirizine);
  }
  // Fast short-term decongestant spray (only for a few days).
  if (has(t, 'oxy nasal', 'fast nasal spray', 'quick nasal spray', 'unblock fast', 'need to breathe tonight', 'instant relief for my nose', '12 hour nasal spray', '12 hour spray', 'decongestant nasal spray', 'decongesting spray')) {
    picks.add(4, P.oxymetazoline, P.saline);
  }
  if (has(t, 'rebound congestion', 'rhinitis medicamentosa', 'addicted to nasal spray', 'addicted to my nasal spray', 'hooked on nasal spray', 'nasal spray addiction', 'overused nasal spray', 'cant stop using nasal spray', "can't stop using nasal spray")) {
    picks.add(4, P.saline, P.budesonide);
  }

  // ---- Asking for an allergy pill in general (ingredient names and brands live in products.ts) ----
  if (has(t, 'first generation antihistamine', 'second generation antihistamine', 'generic antihistamine', 'store brand antihistamine', 'allergy pill*', 'allergy tablet*', 'allergy med*', 'allergy relief', 'allergy stuff', 'something for allergies', 'something for my allergies', 'hay fever tablet*', 'hayfever tablet*', 'hay fever pill*')) {
    picks.add(2, P.cetirizine, P.loratadine, P.fexofenadine);
  }

  // ---- Hives, welts and mild allergic reactions (emergency.ts catches throat/face swelling first) ----
  if (has(t, 'hives', 'hivez', 'hievs', 'hivs', 'hiives', 'hives*', 'hiving', 'broke out in hives', 'broken out in hives', 'breaking out in hives', 'welts', 'welt', 'whelps', 'whelts', 'wheals', 'wheal', 'urticaria', 'urticaria*', 'urticara', 'urticuria', 'raised bumps', 'raised red bumps', 'raised itchy bumps', 'itchy welts', 'itchy raised', 'blotchy hives', 'red blotches', 'blotchy skin', 'splotches', 'red splotches',
    'allergic reaction*', 'mild allergic reaction', 'mild reaction', 'had a reaction', 'having a reaction', 'reacted to', 'skin reaction', 'reaction to a food', 'reaction to food', 'food reaction', 'reaction to a new soap', 'reaction to detergent', 'reaction to laundry detergent', 'reaction to makeup', 'reaction to a lotion', 'reaction to perfume', 'reaction to a plant', 'reaction to a bee sting', 'reaction to latex', 'latex', 'contact allergy', 'allergic to something', 'something i ate made me itch', 'ate something and itch*')) {
    picks.add(3, P.diphenhydramine, P.cetirizine, P.hydrocortisone);
  }
}
