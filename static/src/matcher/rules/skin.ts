import { P, has, type Picks } from '../shared';

// Itching, rashes, bites, cuts, scrapes and minor burns.
export function skinRules(t: string, picks: Picks) {
  // Serious injuries need a doctor, not a cream: skip the skin rules entirely for these.
  // (Animal bites, deep cuts, stitches, and large / chemical / electrical / 2nd-3rd degree burns.)
  if (/\b(dog|cat|animal|human|raccoon|bat|snake|rat) (bite|bit|scratch)|bitten by (a |an |the |my )?(dog|cat|animal|raccoon|bat|snake|rat|person)|(dog|cat|animal) bit me|deep (cut|gash|wound|laceration)|stitches|(chemical|electrical|electric|acid|severe|serious|huge|large|big) burns?|(2nd|second|3rd|third)[\s-]+degree|burn (is|looks) (infected|black|white|charred)|(face|eye) (got |is )?burn(ed|t)/.test(t)) return;

  // Itch words about eyes, nose, throat, ears or mouth belong to the allergy / respiratory rules.
  t = t.replace(/\b(itch\w*|ich\w*|scratch\w*|irritat\w*|burn\w*|rash\w*) (in |on |inside )?(my |the )?(eyes?|eyelids?|nose|nostrils?|throat|ears?|tongue|mouth|roof of my mouth)\b|\b(eyes?|eyelids?|nose|throat|ears?|tongue|mouth) (is |are |feels? |keeps? )?(so |really |very |super )?(itch\w*|scratch\w*|irritat\w*|burn\w*)|scratched my (eye|cornea)\w*|burn(ed|t)? my (tongue|mouth|throat|eyes?|lips?)/g, ' ');

  // ---- Itching (general) ----
  if (has(t, 'itch*', 'ichy', 'ichey', 'itchey', 'itchie', 'itchyness', 'ichyness', 'ichiness', 'iching', 'ichting', 'ichin', 'itcing', 'itcy', 'icthy', 'icthing', 'icthiness', 'ithcy', 'ithcing', 'ithchy', 'itshy', 'itchhy', 'itchyy', 'itchin', 'itchiest', 'pruritus', 'pruritis', 'puritis')) {
    picks.add(3, P.hydrocortisone, P.diphenhydramine);
  }
  // Can't stop scratching / skin crawling (lay phrasing).
  if (has(t, "can't stop scratching", 'cant stop scratching', 'cannot stop scratching', 'keep scratching', 'keeps scratching', 'scratching myself', 'scratching all night', 'scratching all day', 'scratching my skin', 'scratching my arm*', 'scratching my leg*', 'scratching it raw', 'scratched it raw', 'scratched raw', 'want to scratch', 'need to scratch', 'urge to scratch', 'scratching like crazy', 'scraching', 'scrathing', 'scracthing', 'scratchin', 'skin is crawling', 'skin crawling', 'skin crawls', 'crawly skin', 'crawling feeling on my skin', 'feels like bugs on my skin', 'tingly itchy', 'prickly skin', 'prickly heat', 'pins and needles on my skin')) {
    picks.add(3, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Rashes ----
  if (has(t, 'rash*', 'rach', 'rachs', 'rassh', 'raash', 'rahs', 'rsah', 'rashs', 'rashy skin', 'red bumps', 'bumps on my skin', 'bumpy skin', 'red spots on my skin', 'red patch*', 'red blotch*', 'splotchy skin', 'skin is red and', 'breakout on my skin', 'skin broke out', 'skin breakout', 'heat bumps', 'sweat bumps', 'swimmers itch', "swimmer's itch")) {
    picks.add(3, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Eczema / dermatitis / psoriasis (minor flare itch) ----
  if (has(t, 'eczema', 'ecxema', 'exzema', 'eczma', 'exema', 'excema', 'eczemma', 'ezcema', 'eczama', 'ekzema', 'egzema', 'ecsema', 'eczeema', 'ecezma', 'eczmea', 'exzma', 'eksema', 'eczema flare*', 'dermatitis', 'dermatitus', 'dermititis', 'dermatits', 'dermatites', 'dermatitis flare', 'atopic', 'psoriasis', 'psorasis', 'psoriosis', 'soriasis', 'sorisis', 'psoraisis', 'psoriasus', 'sorasis', 'psoriatic', 'dry itchy skin', 'dry scaly skin', 'scaly skin', 'flaky itchy', 'scaly patch*', 'dry patch*', 'rough patch*', 'cracked itchy skin', 'inflamed skin', 'skin inflammation', 'skin flare*', 'skin flaring up')) {
    picks.add(4, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Poison ivy / oak / sumac and other plants ----
  if (has(t, 'poison ivy', 'poison oak', 'poison sumac', 'poision ivy', 'posion ivy', 'poisen ivy', 'poisin ivy', 'poison ivey', 'posion ivey', 'poisonivy', 'poision oak', 'posion oak', 'poisen oak', 'poisin oak', 'poison sumak', 'poision sumac', 'posion sumac', 'poisen sumac', 'urushiol', 'touched poison*', 'ivy rash', 'oak rash', 'sumac', 'nettle*', 'stinging nettle*', 'stung by nettles', 'giant hogweed', 'plant rash', 'weeds gave me', 'pulling weeds', 'gardening rash')) {
    picks.add(4, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Bug, mosquito and insect bites / stings ----
  if (has(t, 'bug bite*', 'insect bite*', 'mosquito*', 'misquito*', 'mosqito*', 'mosquitto*', 'mesquito*', 'musquito*', 'mosquto*', 'mosqutio*', 'moskito*', 'mozzie*', 'mozzy bite*', 'skeeter*', 'skeeter bite*', 'skeeto*', 'bug bit me', 'bugs bit me', 'bit by a bug', 'bit by bugs', 'bitten by bugs', 'bitten by a bug', 'eaten alive', 'bugbite*', 'insectbite*', 'insect sting*', 'bug sting*', 'bee sting*', 'wasp sting*', 'hornet sting*', 'yellow jacket sting*', 'stung by a bee', 'stung by a wasp', 'got stung', 'chigger*', 'jigger bite*', 'flea bite*', 'fleabite*', 'bed bug*', 'bedbug*', 'gnat bite*', 'gnats', 'midge bite*', 'midges', 'no see um*', 'noseeum*', 'sand fly bite*', 'sandfly bite*', 'sand flea*', 'horse fly bite*', 'horsefly bite*', 'deer fly bite*', 'black fly bite*', 'ant bite*', 'fire ant*', 'spider bite*', 'bit by a spider', 'bitten by a spider', 'bitten by mosquitoes', 'bit up', 'bitten up', 'eaten up by bugs', 'eaten up by mosquitoes', 'bit by mosquitoes', 'bit by mosquitos', 'bites on my', 'bites all over', 'itchy bites', 'itchy bumps')) {
    picks.add(4, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Minor skin irritation / contact rash (jewelry, detergent, soap, shaving) ----
  if (has(t, 'irritated skin', 'skin irritation', 'skin is irritated', 'skin irritated', 'skin irritaion', 'skin iritation', 'irritaded skin', 'iritated skin', 'sensitive skin flare', 'jewelry rash', 'jewellery rash', 'nickel rash', 'reaction to my necklace', 'reaction to my earrings', 'reaction to my ring', 'reaction to my watch', 'green skin under my ring', 'detergent rash', 'laundry detergent', 'new detergent', 'new soap', 'soap irritat*', 'lotion irritat*', 'fragrance irritat*', 'perfume irritat*', 'latex glove*', 'band aid adhesive', 'adhesive rash', 'tape rash', 'watch band', 'wool irritat*', 'sweater made me', 'razor burn*', 'razor bump*', 'razer burn*', 'shaving rash', 'shaving irritation', 'irritation from shaving', 'after shaving', 'waxing irritation', 'irritation after waxing', 'ingrown hair irritation', 'contact rash', 'contact derm')) {
    picks.add(3, P.hydrocortisone, P.diphenhydramine);
  }

  // Itchy scalp (dandruff shampoo is not in the catalog; hydrocortisone for the itch).
  if (has(t, 'itchy scalp', 'scalp itch*', 'scalp is itchy', 'scalp is so itchy', 'itchy head', 'scalp keeps itching', 'scalp irritat*')) {
    picks.add(4, P.hydrocortisone, P.diphenhydramine);
  }
  // Jellyfish stings (rinse with vinegar or sea water first; hydrocortisone for the itch afterwards).
  if (has(t, 'jellyfish*', 'jelly fish*', 'man of war', 'sea lice', 'stung by a jelly*')) {
    picks.add(4, P.hydrocortisone, P.diphenhydramine);
  }
  // Bumps on the skin (not the face: acne is not a hydrocortisone job).
  if (has(t, 'bumps on my arm*', 'bumps on my leg*', 'bumps on my skin', 'bumps on my hand*', 'bumps on my chest', 'bumps on my back', 'bumps on my neck', 'bumps on my stomach', 'bumps on my thigh*', 'bumps on my feet', 'bumps on my foot', 'bumps on my body', 'skin bumps', 'red bumps', 'itchy bumps', 'little bumps on my', 'small bumps on my')) {
    picks.add(3, P.hydrocortisone, P.diphenhydramine);
  }

  // ---- Chafing ----
  if (has(t, 'chafe*', 'chafing', 'chaff*', 'chaif*', 'chaffing', 'chafin', 'chafeing', 'thigh rub', 'thighs rubbing', 'inner thigh irritation', 'rubbed raw', 'skin rubbed raw', 'runners chafe', 'jogger nipple*', 'monkey butt')) {
    picks.add(3, P.hydrocortisone);
  }

  // ---- Minor cuts (no bare 'cut' / 'cuts': "budget cuts", "cut back", "haircut") ----
  if (has(t, 'a cut', 'small cut*', 'minor cut*', 'little cut*', 'tiny cut*', 'shallow cut*', 'superficial cut*', 'cut on my', 'cuts on my', 'got a cut', 'have a cut', 'has a cut', 'cut my finger', 'cut my thumb', 'cut my hand', 'cut my palm', 'cut my arm', 'cut my leg', 'cut my knee', 'cut my foot', 'cut my toe', 'cut my shin', 'cut my ankle', 'cut my elbow', 'cut my chin', 'cut my face', 'cut finger', 'finger cut', 'cut thumb', 'knife cut', 'cut while cooking', 'cut while chopping', 'cut it on', 'cut with a knife', 'cut on glass', 'cut from glass', 'sliced my finger', 'sliced my thumb', 'sliced my hand', 'slice on my finger', 'nicked myself', 'nicked my*', 'nick from shaving', 'shaving cut*', 'shaving nick*', 'cut while shaving', 'cut myself shaving', 'cutting myself shaving', 'cutting myself while shaving', 'cut myself while shaving', 'razor cut*', 'razor nick*', 'paper cut*', 'papercut*', 'paper-cut', 'papper cut*', 'cuts and scrapes', 'cuts and scratches', 'cuts and burns', 'cutt on my', 'cutted my', 'cuted my', 'small gash', 'little gash', 'minor laceration', 'small laceration', 'small puncture', 'stepped on a tack', 'splinter*', 'sliver in my')) {
    picks.add(5, P.tripleAntibiotic);
  }

  // ---- Scrapes, grazes, scratches, road rash, rug burn ----
  if (has(t, 'scrape*', 'scrapped my', 'scrapped knee', 'scrapped elbow', 'scraped', 'scrap my knee', 'scrapt', 'scaped', 'scaped my', 'scarped my', 'scratched', 'scratches', 'scrached', 'scraches', 'scrathed', 'scratchs', 'scraped up', 'graze*', 'grazed my', 'abrasion*', 'abraision*', 'skinned', 'skined', 'skinned my knee', 'skint my knee', 'skinned knee', 'skinned elbow', 'skin came off', 'took the skin off', 'peeled the skin off', 'road rash', 'roadrash', 'rug burn*', 'carpet burn*', 'mat burn*', 'turf burn*', 'friction burn*', 'brush burn*', 'rope burn*', 'fell off my bike', 'fell off my skateboard', 'fell on the sidewalk', 'fell on concrete', 'fell and scraped', 'scuffed my knee', 'scuffed my elbow', 'busted my knee', 'small scratch*', 'minor scratch*', 'little scratch*', 'tiny scratch*', 'cat scratch*', 'thorn scratch*', 'scratched by a thorn', 'rose thorn', 'bramble*', 'blackberry bush*')) {
    picks.add(5, P.tripleAntibiotic);
  }

  // ---- Minor burns (stove, oven, curling iron, hot pan) ----
  if (has(t, 'minor burn*', 'small burn*', 'little burn*', 'tiny burn*', 'first degree burn*', '1st degree burn*', 'burned my', 'burnt my', 'burnd', 'burnd my', 'burend my', 'brunt my', 'burnded', 'burnned', 'burned myself', 'burnt myself', 'burned finger*', 'burnt finger*', 'burned hand', 'burnt hand', 'burned on the stove', 'burnt on the stove', 'touched the stove', 'touched a stove', 'stove burn*', 'stovetop burn*', 'touched the hot pan', 'touched a hot pan', 'touched the hot pot', 'grabbed a hot pan', 'grabbed the hot pan', 'grabbed a hot', 'touched something hot', 'touched the oven', 'oven burn*', 'oven rack', 'baking sheet burn*', 'pan burn*', 'kitchen burn*', 'cooking burn*', 'curling iron', 'curlin iron', 'curling wand', 'hair straightener', 'flat iron', 'clothes iron burn*', 'iron burn*', 'glue gun', 'hot glue', 'steam burn*', 'burned by steam', 'grease burn*', 'oil burn*', 'hot oil', 'oil splatter*', 'grease splatter*', 'splattered grease', 'splattered oil', 'scald*', 'scaulded', 'scolded my hand', 'hot coffee spilled', 'spilled hot', 'spilt hot', 'muffler burn*', 'exhaust burn*', 'burn blister*', 'burn on my', 'burns on my', 'got burned', 'got burnt', 'burnt skin', 'burned skin', 'burn cream', 'burn ointment')) {
    picks.add(5, P.tripleAntibiotic);
  }

  // ---- Friction blisters ('blister*' runs after cold sores have been stripped) ----
  if (has(t, 'blister*', 'blistr*', 'bliser*', 'blistter*', 'blisster*', 'blistor*', 'bilster*', 'blsiter*', 'blisterd', 'popped blister', 'blister popped', 'heel blister*', 'new shoes rubbed', 'shoes rubbed', 'shoes gave me', 'hot spot on my heel', 'rubbed my heel', 'hiking blister*', 'running blister*', 'hand blister*', 'water blister*')) {
    picks.add(5, P.tripleAntibiotic);
  }

  // A single first-aid word as the whole message ("cut", "scratch", "burn").
  if (/^(a |small |minor |little )?(cuts?|scratch(es)?|scrapes?|burns?|grazes?|nicks?|papercut|paper cut)[.!?]*$/.test(t)) {
    picks.add(5, P.tripleAntibiotic);
  }
  // ---- Minor wound care / first aid ----
  if (has(t, 'wound*', 'woond*', 'wond on my', 'first aid', 'firstaid', 'frist aid', 'first aide', 'first aid kit', 'antibiotic ointment', 'antibiotic cream', 'antibacterial ointment', 'antibacterial cream', 'triple antibiotic', 'tripple antibiotic', 'neosporin', 'band aid*', 'bandaid*', 'bandage*', 'boo boo*', 'booboo*', 'keep it from getting infected', 'prevent infection', 'so it doesnt get infected', "so it doesn't get infected", 'infection on my skin', 'clean a cut', 'scab', 'scabs', 'scabbed', 'open sore on my', 'raw skin', 'skin is raw', 'bleeding a little', 'little bit of blood', 'minor bleeding')) {
    picks.add(5, P.tripleAntibiotic);
  }
}

/** Runs before every other rule. Returns the text with cold-sore phrases removed. */
export function coldSoreRules(t: string, picks: Picks) {
  // Cold sores first; the phrase is then removed so the "cold" and "sore" rules below don't fire on it.
  // Keep the strip regex below in sync with every phrase / typo in this list.
  // "a cold, sore throat" is a cold plus a sore throat, not a cold sore.
  if (!/cold[\s-]+sore[\s-]+throat/.test(t) && has(t, 'cold sore*', 'coldsore*', 'cold soar*', 'coldsoar*', 'colde sore*', 'cold sor', 'cold sorre*', 'cold sour*', 'cole sore*', 'fever blister*', 'fever blistr*', 'fever bliser*', 'fever blistter*', 'feaver blister*', 'fevr blister*', 'fevor blister*', 'feverblister*', 'lip blister*', 'blister on my lip', 'blister on lip', 'blister on the lip', 'blisters on my lip*', 'blister on my mouth', 'blisters on my mouth', 'blister by my lip', 'blister near my lip', 'sore on my lip', 'sore on lip', 'sores on my lip*', 'sore on my mouth', 'herpes labialis', 'oral herpes', 'herpes simplex', 'herpes on my lip', 'lip herpes', 'hsv 1', 'hsv1', 'tingling lip', 'lip tingling', 'lip is tingling', 'lips are tingling', 'tingly lip*')) {
    picks.add(5, P.docosanol);
    t = t.replace(/cold[\s-]*so(?:re|ar|r|rre|ur)s?|colde[\s-]+sores?|cole[\s-]+sores?|(?:fever|feaver|fevr|fevor)[\s-]*(?:blister|blistr|bliser|blistter)\w*|lip[\s-]+blisters?|blisters? (?:on|by|near) (?:my |the )?(?:lips?|mouth)|sores? on (?:my )?(?:lips?|mouth)|herpes labialis|oral herpes|herpes simplex|herpes on my lip|lip herpes|hsv[\s-]*1|tingling lip|lips? (?:is |are )?tingling|tingly lips?/g, ' ');
  }
  return t;
}
