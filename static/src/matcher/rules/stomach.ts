import { P, has, type Picks } from '../shared';

// Heartburn, indigestion, nausea, diarrhea and constipation.
// Plain keyword checks: each if-statement looks for phrases and adds products (earlier = ranked higher).
export function stomachRules(t: string, picks: Picks) {
  // ---- Heartburn and acid reflux ----
  if (has(t, 'heartburn*', 'heart burn*', 'hartburn*', 'hart burn*', 'heartbern', 'heart bern', 'heartbrun', 'heartburm', 'heatburn', 'hearburn', 'heartbun', 'heartbirn', 'hartbern', 'haertburn', 'heartbrn', 'heartburnn', 'pyrosis')) {
    picks.add(3, P.tums, P.famotidine, P.omeprazole);
  }
  if (has(t, 'acid reflux', 'reflux', 'refluks', 'reflucks', 'refulx', 'refux', 'reflux disease', 'acid reflex', 'acid refux', 'acid relux', 'acid reflx', 'acid refluxx', 'gerd', 'gord', 'gastroesophageal', 'gastro esophageal', 'gastro oesophageal', 'gastroesophogeal', 'gastroesofageal',
    'acid coming up', 'acid comes up', 'acid keeps coming up', 'acid in my throat', 'acid in my mouth', 'acid backing up', 'food coming back up', 'food comes back up', 'regurgitat*', 'sour taste in my mouth', 'bitter taste in my mouth after eating', 'water brash')) {
    picks.add(3, P.famotidine, P.tums, P.omeprazole);
  }
  if (has(t, 'burning in my chest', 'burning chest', 'burning sensation in my chest', 'burning feeling in my chest', 'chest is burning', 'chest burning', 'chest burns after eating', 'burning behind my breastbone', 'burning behind my sternum', 'burn in my chest')) {
    picks.add(3, P.tums, P.famotidine, P.omeprazole);
  }
  if (has(t, 'burning stomach', 'stomach burning', 'stomach burns', 'burning in my stomach', 'burning feeling in my stomach', 'stomach is burning', 'burning tummy', 'tummy burning', 'burning belly', 'burning gut', 'gnawing stomach', 'gnawing in my stomach')) {
    picks.add(3, P.tums, P.famotidine, P.pepto);
  }
  // Heartburn on 2 or more days a week: the omeprazole (PPI) label.
  if (has(t, 'frequent heartburn', 'heartburn every day', 'heartburn everyday', 'daily heartburn', 'heartburn daily', 'heartburn most days', 'heartburn often', 'heartburn all the time', 'heartburn constantly', 'constant heartburn',
    'chronic heartburn', 'chronic reflux', 'chronic acid reflux', 'reflux every day', 'reflux everyday', 'reflux all the time', 'reflux most days', 'daily reflux', 'frequent reflux', 'frequent acid reflux',
    'heartburn 2 or more days a week', 'heartburn two or more days a week', 'heartburn twice a week', 'heartburn several times a week', 'heartburn a few times a week', 'heartburn every week', 'heartburn for weeks',
    'heartburn every night', 'nightly heartburn', 'heartburn at night', 'night time heartburn', 'nighttime heartburn', 'persistent heartburn', 'recurring heartburn', 'recurrent heartburn',
    'heartburn keeps coming back', 'heartburn wont go away', "heartburn won't go away", 'heartburn that wont go away', "heartburn that won't go away", 'all day heartburn', '24 hour heartburn', '24hr heartburn', '14 day heartburn', '14 day treatment')) {
    picks.add(5, P.omeprazole, P.famotidine);
  }
  // Preventing heartburn before a meal: the famotidine label.
  if (has(t, 'prevent heartburn', 'preventing heartburn', 'heartburn prevention', 'avoid heartburn', 'stop heartburn before', 'prevent acid reflux', 'prevent reflux', 'prevent indigestion', 'before a spicy meal', 'before a big meal', 'before eating spicy')) {
    picks.add(4, P.famotidine, P.omeprazole, P.tums);
  }
  // Fast relief and acid-reducer requests.
  if (has(t, 'fast heartburn relief', 'quick heartburn relief', 'instant heartburn relief', 'chewable antacid*', 'antacid*', 'antiacid*', 'anti acid*', 'antiacids', 'antacd', 'antiacide')) {
    picks.add(4, P.tums, P.famotidine, P.pepto);
  }
  if (has(t, 'acid reducer*', 'acid blocker*', 'acid controller', 'acid control', 'reduce stomach acid', 'lower stomach acid', 'h2 blocker*', 'ppi', 'ppis', 'proton pump inhibitor*', 'proton pump')) {
    picks.add(4, P.famotidine, P.omeprazole, P.tums);
  }

  // ---- Sour / acid stomach and indigestion ----
  if (has(t, 'sour stomach', 'acid stomach', 'acidy stomach', 'acidic stomach', 'stomach acid', 'too much acid', 'excess acid', 'excess stomach acid', 'hyperacidity', 'acid indigestion', 'acidy', 'acidity', 'acidic', 'sour tummy', 'sour belly', 'sour gut')) {
    picks.add(4, P.tums, P.famotidine, P.pepto);
  }
  if (has(t, 'indigestion', 'indegestion', 'indigestoin', 'indigestian', 'indijestion', 'indigeston', 'indigestin', 'indegestoin', 'indigesion', 'indigesiton', 'indigetion', 'indigstion', 'indiegestion', 'indigestoion', 'indagestion',
    'dyspepsia', 'dispepsia', 'dyspepsea', 'dyspeptic', 'upset digestion', 'digestive upset', 'digestive issue*', 'digestive problem*', 'digestion problem*', 'digestion issue*', 'bad digestion', 'poor digestion', 'trouble digesting', 'not digesting', 'cant digest', "can't digest")) {
    picks.add(3, P.tums, P.pepto, P.famotidine);
  }
  // Overeating and rich / spicy food (Pepto and Tums labels: overindulgence in food).
  if (has(t, 'ate too much', 'overate', 'over ate', 'overeat*', 'over eat*', 'ate way too much', 'ate so much', 'eaten too much', 'eating too much', 'stuffed myself', 'pigged out', 'pig out', 'too much food', 'too full', 'way too full', 'so full it hurts', 'full stomach', 'stomach is full', 'stomach feels full', 'food baby', 'binged on food', 'all you can eat', 'buffet',
    'big meal', 'heavy meal', 'huge meal', 'rich food*', 'spicy food*', 'something spicy', 'too much spicy', 'hot wings', 'too much pizza', 'greasy food*', 'something greasy', 'fatty food*', 'fried food*', 'junk food', 'fast food', 'overindulg*', 'over indulg*', 'thanksgiving dinner', 'after thanksgiving', 'holiday meal')) {
    picks.add(3, P.tums, P.pepto, P.famotidine);
  }

  // ---- Upset stomach, stomach ache ----
  if (has(t, 'upset stomach*', 'stomach upset', 'tummie ache*', 'tummie hurt*', 'tummies hurt', 'tumy ache*', 'stummy ache*', 'stummy hurt*', 'stomach is upset', 'stomachs upset', "stomach's upset", 'upset tummy', 'tummy upset', 'tummy is upset', 'upset belly', 'belly upset', 'upset gut', 'gut is upset', 'upsetting my stomach', 'upset my stomach', 'unsettled stomach', 'stomach unsettled', 'unsettled tummy',
    'stomach feels off', 'stomach feels weird', 'stomach feels funny', 'stomach feels bad', 'stomach feels awful', 'stomach feels gross', 'stomach is off', 'stomach is acting up', 'stomach acting up', 'tummy acting up', 'tummy trouble*', 'stomach trouble*', 'stomach issue*', 'stomach problem*', 'tummy issue*', 'tummy problem*', 'gut issue*', 'gut problem*',
    'gi issue*', 'gi upset', 'gi distress', 'gastric upset', 'gastric distress', 'stomach distress', 'gastrointestinal', 'dodgy stomach', 'dodgy tummy', 'iffy stomach', 'gippy tummy', 'collywobbles', 'stomach churning', 'stomach is churning', 'churning stomach', 'stomach in knots', 'stomach is in knots', 'knot in my stomach',
    'stomach gurgling', 'stomach is gurgling', 'gurgling stomach', 'stomach rumbling', 'rumbly tummy', 'tummy rumbling', 'grumbly tummy', 'sick stomach', 'stomach sick', 'stomach is killing me', 'stomach killing me', 'tummy is killing me', 'belly is killing me')) {
    picks.add(3, P.pepto, P.tums);
  }
  if (has(t, 'stomach ache*', 'stomachache*', 'stomache*', 'stomache ache*', 'stomach ake*', 'stomach aik*', 'stomach ach', 'stomack*', 'stomac', 'stomch*', 'stomahc*', 'stumach*', 'stomick*', 'stummy', 'stomachake', 'stomachacke',
    'tummy ache*', 'tummyache*', 'tummy ake*', 'tummy hurt*', 'tummy pain*', 'tummy discomfort', 'belly ache*', 'bellyache*', 'belly ake*', 'belly hurt*', 'belly pain*', 'gut ache*', 'gutache', 'gut hurts', 'gut pain*',
    'stomach hurt*', 'stomach pain*', 'stomach is hurting', 'stomach discomfort', 'stomach soreness', 'sore stomach', 'sore tummy', 'pain in my stomach', 'pain in my tummy', 'pain in my belly', 'my stomach aches', 'abdominal pain', 'abdominal discomfort', 'abdomen hurts', 'abdomen pain', 'abdominal ache', 'tummy pains')) {
    picks.add(3, P.pepto, P.tums);
  }
  if (has(t, 'stomach cramp*', 'tummy cramp*', 'belly cramp*', 'gut cramp*', 'intestinal cramp*', 'abdominal cramp*', 'cramping stomach', 'crampy stomach', 'crampy tummy', 'stomach spasm*')) {
    picks.add(4, P.pepto, P.loperamide);
  }

  // ---- Gas, bloating, burping, fullness (Pepto label: gas, belching, fullness from overindulgence) ----
  if (has(t, 'bloat*', 'blaoted', 'bloted', 'bloting', 'bloteing', 'blotted', 'gassy', 'gas pain*', 'gas pains', 'trapped gas', 'bad gas', 'lots of gas', 'lot of gas', 'so much gas', 'have gas', 'got gas', 'having gas', 'gas is bad', 'too much gas', 'excess gas', 'stomach gas', 'gas in my stomach', 'fart', 'farts', 'farting', 'farted', 'farty', 'flatulen*',
    'burp', 'burps', 'burping', 'burped', 'burpy', 'belch*', 'swollen stomach', 'swollen belly', 'distended stomach', 'distended belly', 'puffy stomach', 'stomach feels tight', 'stomach is tight')) {
    picks.add(2, P.pepto, P.tums);
  }

  // ---- Nausea and queasiness ----
  if (has(t, 'nause*', 'nausi*', 'nausou*', 'nausus', 'nausua', 'nautious', 'nautius', 'nautous', 'nauscious', 'naucious', 'naseous', 'naseus', 'nasea', 'naseau*', 'nasua', 'nashus', 'nawsea', 'nasious', 'nausha', 'nuasea', 'nuaseous', 'neausea', 'neaseous', 'nasuea', 'nauesa', 'naueseous',
    'queas*', 'quesy', 'queezy', 'queesy', 'quezy', 'quesey', 'queazy', 'qweasy', 'qeasy', 'queasey',
    'sick to my stomach', 'sick to my tummy', 'sick to the stomach', 'sick in the stomach', 'sick in my stomach', 'sick feeling in my stomach', 'sick to my stomache', 'sick to my stomack',
    'stomach doing flips', 'stomach is doing flips', 'stomach doing backflips', 'stomach flips', 'stomach flipping', 'stomach is flipping', 'stomach turning', 'stomach is turning', 'turning my stomach', 'green around the gills', 'feeling green', 'feel green', 'feel pukey', 'pukey', 'pukish', 'barfy', 'urpy')) {
    picks.add(3, P.pepto);
  }
  // Vomiting (mild) and feeling like vomiting.
  if (has(t, 'vomit*', 'vommit*', 'vomet*', 'vomt*', 'vomitt*', 'vomitting', 'vom', 'vomming', 'emesis', 'throwing up', 'throw up', 'threw up', 'thrown up', 'throwin up', 'throwup', 'trowing up', 'thowing up', 'throughing up', 'throwning up', 'throwed up', 'throws up',
    'puke*', 'puking', 'puked', 'barf*', 'upchuck*', 'up chuck*', 'retch*', 'dry heav*', 'tossing my cookies', 'toss my cookies', 'tossed my cookies', 'blowing chunks', 'hurled', 'hurling my guts',
    'like throwing up', 'like i might throw up', 'want to throw up', 'wanna throw up', 'gonna throw up', 'going to throw up', 'about to throw up', 'wanna puke', 'want to puke', 'gonna puke', 'going to puke', 'about to puke', 'gonna hurl', 'going to hurl', 'about to hurl', 'might hurl', 'like hurling', 'feel like hurling', 'gonna be sick', 'going to be sick', 'about to be sick', 'urge to vomit')) {
    picks.add(3, P.pepto);
  }

  // ---- Stomach bug and food poisoning ----
  if (has(t, 'stomach bug', 'stomach flu', 'stomach virus', 'tummy bug', 'tummy flu', 'belly bug', 'gut bug', 'gastro', 'gastroenteritis', 'gastroenteritus', 'gastro enteritis', 'norovirus', 'noro', 'noro virus', 'winter vomiting bug', 'food poisoning', 'food poisoned', 'food poisening', 'food posioning', 'food poisonging',
    'ate something bad', 'ate something weird', 'ate something off', 'something i ate', 'bad food', 'spoiled food', 'expired food', 'undercooked', 'bad sushi', 'bad chicken', 'bad seafood', 'bad shrimp', 'bad burrito', 'sketchy food', 'questionable food', 'gas station sushi')) {
    picks.add(3, P.pepto, P.loperamide);
  }

  // ---- Diarrhea ----
  if (has(t, 'diarrh*', 'diarea', 'diarrea', 'diahrea', 'diarhea', 'diahrrea', 'diarreah', 'diareah', 'diarhhea', 'diarreha', 'diarrae', 'diharrea', 'diharea', 'dihrrea', 'dirrhea', 'dirrea', 'diaherra', 'diaherea', 'diahreah', 'diaria', 'diarria',
    'diaharia', 'diarhia', 'diarhoea', 'diorrhea', 'dioreah', 'diorea', 'direah', 'dyerea', 'diahrrhea', 'diarhorea', 'diahorrea', 'diahorea', 'diaherria', 'diarehea', 'diarheaa', 'diareha', 'diahhrea', 'diarhoe', 'diarreea', 'diereah', 'diherea')) {
    picks.add(4, P.loperamide, P.pepto);
  }
  if (has(t, 'the runs', 'the squirts', 'squirts', 'hershey squirts', 'the trots', 'the shits', 'got the shits', 'bubble guts', 'bubbleguts', 'disaster pants', 'shart*', 'the poops',
    'loose stool*', 'loose bowel*', 'loose poop*', 'loose motion*', 'watery stool*', 'watery poop*', 'liquid poop*', 'liquidy poop', 'liquid stool*', 'runny poop*', 'runny stool*', 'soupy poop', 'mushy poop', 'explosive poop', 'poop is water', 'poop is liquid', 'poop is watery', 'poop is runny', 'poop is loose', 'stool is watery', 'stool is loose', 'stools are loose', 'stools are watery', 'poops are watery', 'poops are runny', 'pooping water', 'pooping liquid', 'shitting water',
    'peeing out my butt', 'peeing out of my butt', 'water coming out my butt', 'frequent bowel movement*', 'frequent stools', 'frequent pooping', 'pooping too much', 'pooping all day', 'poop all day', 'pooping a lot', 'pooping alot', 'poop a lot', 'poop alot', 'pooping constantly', 'pooping nonstop',
    "can't stop pooping", 'cant stop pooping', 'cannot stop pooping', 'keep pooping', 'keep having to poop', 'keep having to go', 'keep running to the bathroom', 'running to the bathroom', 'running to the toilet', 'bathroom a lot', 'toilet a lot', 'on the toilet all day', 'stuck on the toilet', 'living on the toilet', 'urgent bowel*', 'urgency to poop', 'have to poop urgently')) {
    picks.add(4, P.loperamide, P.pepto);
  }
  // Traveler's diarrhea: Pepto's label names it.
  if (has(t, "traveler's diarrhea", 'travelers diarrhea', "travelers' diarrhea", "traveller's diarrhoea", 'travellers diarrhoea', "traveller's diarrhea", 'travellers diarrhea', 'travelers diarrhoea', 'travel diarrhea', 'diarrhea while traveling', 'diarrhea from traveling', 'diarrhea on vacation', 'diarrhea abroad',
    'delhi belly', 'bali belly', 'tourist tummy', "montezuma's revenge", 'montezumas revenge', 'montezuma revenge', 'drank the water in mexico', 'drinking the water abroad', 'traveling and my stomach', 'travelling and my stomach')) {
    picks.add(5, P.pepto, P.loperamide);
  }
  if (has(t, 'anti diarrheal*', 'antidiarrheal*', 'anti diarrhoeal*', 'antidiarrhoeal*', 'stop diarrhea', 'stop the runs', 'firm up my stool')) {
    picks.add(5, P.loperamide, P.pepto);
  }

  // ---- Constipation ----
  if (has(t, 'constipat*', 'constapat*', 'constpat*', 'consipat*', 'consitpat*', 'contipat*', 'constipt*', 'constopat*', 'consapat*', 'constiapt*', 'constapait*', 'constipait*', 'conspiated', 'constiptaed', 'cinstipated', 'constiapted', 'constepated', 'constepation', 'constupated', 'constapted', 'constapaited', 'conistpated', 'constipatd', 'constpiated',
    "can't poop", 'cant poop', 'cannot poop', 'can not poop', "can't go poop", 'cant go poop', "can't go number two", 'cant go number two', "can't go number 2", 'cant go number 2', "can't go to the bathroom", 'cant go to the bathroom', "can't have a bowel movement", 'cant have a bowel movement', "can't take a dump", 'cant take a dump', "can't shit", 'cant shit', 'unable to poop', 'trouble going to the bathroom',
    "haven't pooped", 'havent pooped', 'have not pooped', 'not pooping', 'no poop', 'no bowel movement*', "haven't gone in days", 'havent gone in days', "haven't gone in a few days", 'havent gone in a few days', "haven't gone in a week", 'havent gone in a week', "haven't gone in a while", 'havent gone in a while', "haven't gone number two", 'havent gone number two',
    "haven't been to the bathroom in days", 'havent been to the bathroom in days', "haven't had a bm", 'havent had a bm', "haven't had a bowel movement", 'havent had a bowel movement', "haven't shit", 'havent shit', "haven't taken a dump", 'havent taken a dump', 'backed up down there', "i'm backed up", "i'm all backed up", 'feel backed up', 'feeling backed up', 'so backed up', 'all backed up down there', 'bowels are backed up', 'bowels are blocked', 'blocked bowels',
    'irregularity', 'occasional irregularity', 'irregular bowel*', 'stay regular', 'staying regular', 'regularity')) {
    picks.add(4, P.miralax, P.docusate, P.magnesiumCitrate);
  }
  // Hard stools and straining: a stool softener first.
  if (has(t, 'hard stool*', 'hard poop*', 'hard to poop', 'hard to go to the bathroom', 'painful to poop', 'painful bowel movement*', 'pooping hurts', 'poop hurts', 'hurts to poop', 'hurts when i poop', 'hurts when i go poop', 'hurts when i go to the bathroom', 'pain when i poop', 'painful when i poop', 'hurts to go number 2', 'rock hard poop', 'pebble poop', 'pebbly poop', 'small hard poop*', 'dry stool*', 'dry poop', 'difficult bowel movement*', 'difficulty pooping', 'trouble pooping', 'struggling to poop',
    'hard bowel movement*', 'straining to poop', 'strain to poop', 'straining on the toilet', 'straining when i poop', 'incomplete evacuation', 'stool softener*', 'stool softner*', 'stoolsoftener', 'stool sofener', 'poop softener', 'softener for stool', 'soften my stool', 'soften stool*', 'softer stool*')) {
    picks.add(5, P.docusate, P.miralax);
  }
  // Laxatives by type.
  if (has(t, 'laxative*', 'laxitive*', 'laxetive*', 'laxtive*', 'laxatve*', 'lacksative*', 'laxitives', 'laxatif', 'osmotic laxative', 'saline laxative', 'gentle laxative', 'something to help me poop', 'help me poop', 'make me poop', 'something to make me go', 'help me go to the bathroom', 'poop pill*', 'poop medicine', 'poop meds')) {
    picks.add(4, P.miralax, P.magnesiumCitrate, P.docusate);
  }

  // ---- Bowel prep ----
  if (has(t, 'colonoscop*', 'colonscopy', 'colonoscapy', 'colonoskopy', 'colon prep', 'bowel prep', 'bowel preparation', 'bowel cleanse', 'colon cleanse', 'colon cleansing', 'clean out my colon', 'clean out my bowels', 'clean me out', 'prep for my colonoscopy', 'prep for a colonoscopy')) {
    picks.add(4, P.magnesiumCitrate, P.miralax);
  }

  // ---- Generic gut words (weak signal; specific rules above win) ----
  // Bare bowel words point to constipation products only, so a constipation message never surfaces an anti-diarrheal.
  if (has(t, 'stomach', 'stomachs', 'tummy', 'tummies', 'tummie', 'belly', 'bellies', 'gut', 'guts', 'abdomen', 'abdominal', 'digestion', 'digestive', 'gi tract', 'stomach medicine', 'stomach meds', 'tummy medicine', 'something for my stomach', 'something for my tummy')) {
    picks.add(1, P.pepto, P.tums);
  }
  if (has(t, 'bowel*', 'intestin*', 'colon', 'poop*', 'pooping', 'poo', 'poos', 'stool', 'stools', 'feces', 'faeces', 'fecal', 'bm', 'bms', 'number two', 'number 2', 'pooped')) {
    picks.add(1, P.miralax, P.docusate);
  }
}
