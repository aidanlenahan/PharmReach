// Emergency screen: any match sends the 911 / 988 reply and no products.
// Patterns run against the normalized message (lowercase, single spaces, straight apostrophes).
// Each section lists the plain phrasing first, then common misspellings / texting forms.
// Lookarounds keep minor, everyday messages (stuffy nose, minor burn, heartburn, headache,
// food poisoning, "dying of boredom") out of this screen so they reach the product rules.
// Words the typo fixer (./typos.ts) should know besides the literal words in the patterns below.
export const EMERGENCY_WORDS = [
  'myself', 'hurt', 'harm', 'kill', 'die', 'dying', 'suicide', 'suicidal', 'overdose', 'pills', 'breathe', 'breathing', 'unconscious', 'bleeding', 'seizure', 'emergency', 'ambulance',
  'hurting', 'harming', 'cutting', 'burning', 'killing', 'injure', 'injuring', 'punish', 'punishing', 'starve', 'starving', 'strangle', 'suffocate', 'overdosing', 'unaliving',
  'tempted', 'afraid', 'thinking', 'purpose', 'intentionally', 'deliberately', 'relapsed', 'anymore', 'alive', 'disappear', 'existing', 'pointless', 'goodbye', 'danger', 'trust',
];

// Self-harm verbs, base and -ing forms ("might hurt myself", "keep cutting myself").
const SELF_VERB = 'hurt|harm|cut|burn|kill|injure|punish|starve|hit|punch|stab|shoot|hang|drown|poison|overdose|beat|choke|strangle|suffocate|mutilate|scratch|end|unalive';
const SELF_VERBING = 'hurting|harming|cutting|burning|killing|injuring|punishing|starving|hitting|punching|stabbing|shooting|hanging|drowning|poisoning|overdosing|beating|choking|strangling|suffocating|mutilating|scratching|ending|unaliving';
// "... myself" followed by an everyday accident ("cut myself shaving", "hurt myself at the gym") is not self-harm.
const NOT_ACCIDENT = '(?! (shaving|cooking|baking|ironing|lifting|playing|working|running|exercising|skating|skiing|hiking|biking|cycling|climbing|gardening|cleaning|moving|dancing|wrestling|training|sparring|falling|tripping|slipping'
  + '|on (the|a|an|my|some) (stove|oven|pan|grill|iron|knife|razor|corner|table|door|ladder|stairs|treadmill|bike|trampoline|edge|glass|can|paper|kettle)'
  + '|with (a|the|my) (knife|razor|pan|kettle|iron|hammer|scissors|saw|tool|curling iron|straightener|lighter|match|paper)'
  + '|at (the )?(gym|work|practice|game|park)|in (the )?(kitchen|yard|garden|gym)|by accident|accidentally|doing|while|during|trying to (lift|move|open|carry|fix)))';
// Gate for vague distress ("i can't take it anymore"): only counts when no symptom is mentioned ("i can't take this headache anymore").
const NO_SYMPTOM = '^(?!.*\\b(pain|pains|ache|aches|aching|headache|migraine|hurts?|hurting|sore|itch\\w*|cough\\w*|sneez\\w*|congest\\w*|stuffy|runny|cramps?|heartburn|nause\\w*|diarrh\\w*|constipat\\w*|allerg\\w*|rash|fever|cold|flu|insomnia|sleep|tooth|toothache|back|stomach|throat|nose|head)\\b)';

export const EMERGENCY_PATTERNS = [
  // --- General: 911, ambulance, "emergency", dying ---
  /\b(call(ing|ed)?|dial(ing|ed)?|phone|ring) (9-?1-?1|nine one one)\b/, /\b911\b/,
  /\b(an?|the|call an?|need an?|get an?|send an?) ?am?bul[ae]n[cs]e?s?\b/, /\bambulance\b/, /\bambulence\b/, /\bambulanse\b/, /\bamblance\b/,
  /\b(this is|it'?s|its|having|i'?m having|we have|there'?s|medical) an? (medical )?emergen[cs]y\b/, /\bmedical emergen[cs]y\b/, /\bemerg[ae]n[cs]y\b(?! (contracept\w*|pill|kit|supplies|supply|fund|preparedness|plan|brake|exit|alert|food|blanket|use only))/, /\bemergancy\b/, /\bemergeny\b/,
  /\bemergen[cs]y room\b/, /\bgo(ing)? to (the )?(er|e\.r\.|emergency)\b/, /\b(need|get) (to )?(the )?(er|emergency room)\b/,
  /\b(i'?m|im|i am|i think i'?m|i feel like i'?m|he'?s|he is|she'?s|she is|someone is|my (mom|dad|mother|father|wife|husband|son|daughter|friend|brother|sister|grandma|grandpa|baby|partner) is) (dying|dieing)\b(?! (of|from|to|for|laughing|inside|with laughter|lol|lmao|haha|xd)\b)/,
  /\b(going to|gonna|about to|i will|i'?ll|i might|i'?m going to) die\b(?! (of|from) (boredom|embarrass|laugh|cringe|hunger|thirst|curiosity|excitement)| laughing)/,
  /\bnear death\b/, /\blife or death\b/, /\blife[- ]threatening\b/,
  /\b(no|can'?t find (a|his|her)|without a) pulse\b/, /\bheart (has )?stopped\b/, /\b(doing|start|give|giving|need) cpr\b/, /\bcpr\b/, /\bdefibrillat/, /\b(an? |the )?aed\b/,

  // --- Heart attack / cardiac ---
  /chest (pain|pressure|tightness|hurts?)/, /heart attack/,
  /\b(chest|chset|chets|chesst|cheast|chst|ches) (pain|pian|pane|pains|pian|pai|hurts?|hurting|pressure|presure|pressur|tightness|tighness|tight|squeez\w*|heaviness|heavy|crushing|discomfort|ache|aching)\b/,
  /\b(pain|pressure|tightness|squeezing|crushing|heaviness) in (my|his|her|the) (chest|chset|chets)\b/,
  /\b(my |his |her )?(chest|chset) (feels|is) (tight|heavy|crushed|like (an elephant|someone|something))/,
  /\b(heart|hart|haert|hert|heat?rt|harte) ?(attack|atack|attak|atak|attac|attck|attacks|atacks|attact|atttack)\b/,
  /\bcardiac (arrest|arest|event|emergency)\b/, /\bcardi?ac arr?est\b/, /\bmyocardial infarct/, /\b(heart|hart) (failure|faliure) (and|with) (can'?t|cannot)/,
  /\b(pain|ache|aching|numbness|numb|tingling|pressure) (is )?(spreading|radiating|moving|going|shooting|traveling|travelling|running) (in)?to (my |his |her )?(left )?(arm|jaw|shoulder|neck|back)\b/,
  /\b(pain|ache|hurts?|pressure) (down|in) (my |his |her )?left arm (and|with) (my |his |her )?(chest|jaw)/,
  /\bleft arm (is |feels |has gone |went )?(numb|tingl\w*|heavy|dead)\b/, /\bnumb(ness)? in (my |his |her )?left arm\b/,
  /\b(jaw|arm) pain (and|with) (chest|sweating|shortness)/,

  // --- Stroke / FAST signs ---
  /stroke(?! of (luck|genius|midnight|the pen))/, /\bstroak/, /\bstrok\b/, /\bstrock\b/, /\bmini[- ]?stroke\b/, /\btia\b/,
  /\b(face|mouth|smile|lip|eyelid|side of (my|his|her|their) face) (is |are |has |looks |seems |started |starts )?(drooping|droop|droops|droopy|drooped|sagging|lopsided|uneven|crooked|fallen)\b/,
  /\bdroop(ing|y)? (face|mouth|smile)\b/,
  /\b(one|left|right|half|the left|the right) side of (my|his|her|their|the) (face|body|mouth) (is |went |has gone |feels |suddenly )?(numb|drooping|droop|weak|paraly[sz]ed|limp|dead|tingl\w*)/,
  /\b(sudden(ly)?|all of a sudden) (can'?t|cannot|can not|unable to) (move|feel|lift|raise|use) (my|his|her|their|one) (arm|leg|hand|face|left|right|side)/,
  /\b(can'?t|cannot|can not|unable to) (lift|raise) (both|one of) (my |his |her )?arms\b/,
  /\b(sudden|suddenly|all of a sudden) (very |really )?(numbness|numb|weakness|weak|confusion|confused|paralysis|paralyzed|dizz\w+ and|trouble (speaking|talking|seeing|walking))/,
  /\bsudden (numbness|weakness|confusion)/, /slurred speech/,
  /\bslur+(ed|ing|s)? (my |his |her |their )?(speech|words|talking|speaking)\b/, /\b(speech|words|talking) (is |are )?(slurred|slurring|slured|garbled|jumbled)\b/, /\bslured\b/,
  /\b(suddenly|sudden(ly)? can'?t|can'?t suddenly) (can'?t |cannot )?(speak|talk|understand|see|find (my|the) words)\b/,
  /\b(sudden(ly)?|all of a sudden) (lost|lose|losing|loss of|went|go|going) (my |his |her )?(vision|sight|blind)\b/, /\bsudden (blindness|vision loss|loss of vision|double vision)\b/,
  /\b(lost|losing|loss of) (vision|sight) in (one|my left|my right|his|her|one of my) eye/, /\b(went|gone|going) blind\b/, /\bcan'?t see out of (one|my left|my right) eye\b/,
  /\b(face|arm|leg) (went|is|feels) (suddenly )?numb (and|with) (slur|can'?t (talk|speak))/,

  // --- Breathing emergencies ---
  /\b(can'?t|cant|cnt|cannot|can not|couldn'?t|unable to|trouble|difficulty|difficult to|struggling to|struggle to|hard to|hard time|having a hard time|having trouble|having difficulty|barely|not able to) (breath|breathe|brethe|breth|breate|breathe|breahte|brathe|breathing|breating|brething|breahting|breethe|breeth)\b(?<!\b(nose|nostrils?|nasal|stuffy|stuffed|congested|congestion|sinus(es)?)\b.*)(?![^.!?]*\b(nose|nostrils?|nasal|stuffy|stuffed|congested|congestion|sinus|blocked up|through (my|the|it|either)))/,
  /\b(can'?t|cant|cannot) (get|catch) (my |enough )?(breath|breth|air)\b/, /\b(can'?t|cannot|not) get(ting)? (any |enough )?air\b/,
  /short(ness)? of breath/, /\bshort(ness|nes)? (of|o) (breath|breth|breathe)\b/, /\bsob and chest\b/,
  /not breathing/, /\b(stopped|stop|isn'?t|is not|aren'?t|wasn'?t|not|no longer) (breathing|breathin|breating|brething)\b/,
  /\bgasp(ing|s|ed)? (for )?(air|breath|breth)\b/, /\bstruggling (for|to get) (air|breath)\b/, /\bsuffocat/, /\bsufocat/, /\bsmother(ing|ed)\b/,
  /\b(i'?m|im|i am|he'?s|she'?s|he is|she is|they'?re|baby is|someone is|is) chok(ing|in)\b(?! (up|hazard))/, /\bchok(ed|ing|in) on\b/, /\bchocking\b(?! hazard)/, /\bheimlich\b/,
  /\b(lips?|face|skin|fingers?|fingernails|nails) (are |is |turning |turned |went |going |look |looks )+(blue|bluish|purple|gray|grey)\b/, /\bturning (blue|purple)\b/, /\bblue lips\b/, /\bcyanos/,
  /\basthma attack\b/, /\basthma atta?ck?\b/, /\basma attack\b/, /\bazma attack\b/, /\bsevere (asthma|asma|wheez)/,
  /\binhaler (is |isn'?t|is not|not|doesn'?t|does not|didn'?t|did not|won'?t)( working| helping| work| help)\b/, /\b(rescue|albuterol) inhaler (not|isn'?t|doesn'?t)/,
  /\b(throat|airway) (is )?(closing|closed|closing up|blocked)\b/, /\bwindpipe\b/, /\bstridor\b/,
  /\b(breathing|breath) (is |are )?(very |really )?(fast and shallow|labou?red|rattling|stopped|getting worse and)\b/,

  // --- Severe allergic reaction / anaphylaxis ---
  /anaphyla/, /\bana(ph|f)(y|a|i|e|o)?l(a|e|o|y|i)?(x|ct|k)/, /\banafal/, /\banaphal/, /\banafil/, /\banafyl/, /\banaflax/,
  /throat (is )?(closing|swelling|swollen|tight)/, /(face|tongue|lips?) (is |are )?swell/,
  /\bthroat (feels |is |keeps |started |starting )?(like it'?s |like its )?(closing|clossing|closeing|swelling|sweling|swelling up|tightening|getting tight|closing up)\b/,
  /\b(tongue|lips?|mouth|face|throat) (is |are |keeps |started |starting |feels |feel )?(swelling|sweling|swollen up|swelling up|puffing up|blowing up|ballooning)\b/,
  /\bswollen (tongue|throat)\b/, /\b(tongue|throat) (is |feels )?(swollen|thick|huge)\b/,
  /\bepi ?-?pen\b/, /\bepipen/, /\bepi pin\b/, /\bepipin\b/, /\bepinephrine\b/, /\badrenaline (shot|pen|injection)\b/, /\bauvi-?q\b/,
  /\b(severe|serious|bad|major|life[- ]threatening|really bad|massive) allerg(ic|y) (reaction|reation|raction|attack)\b/, /\ballergic shock\b/, /\banaphylactic shock\b/,
  /\b(allergic|allergy) (reaction|attack)\b.{0,40}\b(can'?t breath|trouble breath|throat (is )?(closing|swell|tight)|tongue (is )?swell|fainted|passed out)/, /\b(stung|sting|bitten|ate|eaten)\b.{0,40}\b(throat|tongue) (is |feels )?(closing|swell\w*|tight)/,
  /\bhives\b.{0,40}\b(trouble breath\w*|can'?t breathe|difficulty breath\w*|short(ness)? of breath|wheez\w*|dizzy|faint\w*|(face|lips?|tongue|throat) (is |are )?swell\w*|swelling of (my |the )?(face|lips?|tongue|throat))/,

  // --- Overdose / poisoning ---
  /over ?dos/, /\bod('?ed|'d|ing)?\b/, /took (too many|too much|a whole bottle|the whole bottle)/,
  /\bover ?(dose|does|doce|doze|dosed|dosing|dosage on|dossed|dosse)\b/, /\bovr ?dos/, /\bovedos/, /\bovredos/, /\boverdos/, /\boverdoes\b/, /\bo\.d\.?\b/,
  /\b(took|taken|take|swallowed|ate|had|popped|took like) (way )?(too many|to many|too much|to much|a handful of|handfuls of|all (of )?(my|the|his|her)|the whole|a whole|an entire|the entire|all the) (pills?|tablets?|capsules?|meds|medicines?|medications?|tylenol|advil|aspirin|ibuprofen|acetaminophen|sleeping pills|benadryl|motrin|aleve|bottle|pack|box)(?!\w| (at once|at the same time|together|in the morning|at night|at bedtime|with (food|water|breakfast|dinner|me)|before|after|every|each|daily|on time|as prescribed))/,
  /\b(took|taken|swallowed|ate|popped) (like )?(1\d|[2-9]\d|\d{3,}|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|a hundred) (or more )?(\w+ )?(pills?|tablets?|capsules?|caps|tabs|tylenol|advil|aspirin|ibuprofen|acetaminophen|motrin|aleve|benadryl|melatonin|gummies|sleeping pills|xanax|oxy\w*|percocet|vicodin)\b/,
  /\b(took|taken|swallowed|ate|popped) (a lot of|alot of|a bunch of|lots of|a ton of|tons of) (pills|tablets|capsules|sleeping pills|meds)\b/,
  /\b(pills|meds|medicine|tablets) on purpose\b/, /\bwhole bottle of\b/, /\bentire bottle\b/,
  /(?<!food )poison(ed|ing)\b/, /swallowed (a|some|bleach|batter)/,
  /\b(swallowed|drank|drunk|ingested|ate|eaten|drinking|swallow|swalowed|swallowd|swolled) (a |an |some |the |my |his |her |\w+ )?(bleach|blech|ammonia|antifreeze|anti-freeze|drain cleaner|lye|gasoline|kerosene|lighter fluid|paint thinner|pesticide|insecticide|rat poison|poison|detergent|laundry pods?|tide pods?|dishwasher pods?|cleaning (product|chemicals?|solution|fluid)|chemicals?|battery|batteries|button batter(y|ies)|magnets?|mouthwash bottle|nail polish remover|acetone|windshield washer|bug spray|weed killer|roundup|cyanide|arsenic|mercury|lamp oil|hand sanitizer bottle|wild mushrooms?|mushrooms from the yard)\b/,
  /\b(bleach|chemicals?|battery|batteries|poison) (was |were )?(swallowed|ingested|drunk)\b/,
  /\bpoison control\b/, /\bpoisen(ed|ing)\b(?! ivy)/, /\bpoisn(ed|ing)\b/, /\bposion(ed|ing)\b/, /\bpoisoining\b/,
  /\bcarbon mon[oa]xide\b/, /\bcarbon monoxid/, /\bco (detector|alarm|poisoning)\b/, /\bgas leak\b/, /\bsmell(s|ing)? gas\b/, /\binhaled (fumes|smoke|chemicals?|gas|bleach)\b/, /\bsmoke inhalation\b/, /\bmixed bleach (and|with) ammonia\b/,

  // --- Suicide / self-harm / wanting to die ---
  /suicid/, /kill myself/, /end (my life|it all)/, /want to die/, /self[- ]?harm/, /cut(ting)? myself\b(?! (shaving|while|on (a|the|my)|with (a|the) (knife|razor|paper)|cooking|by accident|accidentally))/,
  /\bsu(i|ic|ici|e|a|ia)?[cs]{1,2}i?d(e|es|al|ally|ing)\b/, /\bsuicde/, /\bsuacide/, /\bsewer ?slide\b/, /\bsuicid?al\b/, /\bsuisidal\b/,
  /\bkill(ing|ed)? ?(my ?self|myslef|mysef|mysel|my sef|me now)\b/, /\bkil+ (my ?self|myslef)\b/, /\bkms\b/, /\bkys\b/, /\bunaliv/, /\bun-alive/, /\bself[- ]?(harm|harming|harmed|hurt|injur\w*|mutilat\w*)/, /\bselfharm/,
  /\b(take|taking|end|ending|ended) (my|his|her) (own )?(life|lif)\b/, /\bend(ing)? it all\b/,
  /\b(want(ed)?|wanna|going|gonna|ready|about|plan(ning)?|planned|decided|thinking (about|of)|think about|deserve) (to )?(just )?(end|ending) (it|things|everything|my life|this|it now)\b/,
  /\b(want|wanna|wish i could|wish to|ready to|i'?d rather|deserve to|i should|need to) (to )?(just )?(die|be dead|go to sleep forever|sleep forever|not wake up|never wake up|disappear forever|stop existing|not exist|not be alive)\b/,
  /\bwant(ing)? to di(e|ed)\b/, /\bwant 2 die\b/, /\bwanna die\b/,
  /\b(wish|wishing) (i|i'?d|i had) (was|were|had|could) (never been born|dead|die|not alive|not here)/, /\bwish i (was|were) dead\b/, /\bwish i'?d never been born\b/, /\bwish i (would|could) (just )?(die|disappear)\b/,
  /\bbetter off (dead|without me|if i (was|were) (dead|gone)|if i died)\b/, /\b(everyone|they|people|my family|the world) (would be|is|are) better (off )?without me\b/,
  /\b(don'?t|do not|dont|doesn'?t|no longer|dnt) (want|wanna) (to )?(be here|be here anymore|live|be alive|exist|wake up|keep living|keep going|live anymore)\b/,
  /\b(no|not any|nothing|no point|no reason) (reason )?(to|in|for) (live|living|keep going|be alive)\b/, /\bnothing (left )?to live for\b/, /\bno point (in )?(living|life|being alive|going on)\b/, /\blife (is not|isn'?t) worth living\b/,
  /\b(can'?t|cannot|can not) (go on|keep going|live like this) any ?more\b/, /\b(can'?t|cannot) go on living\b/,
  /\b(hang|hanging|hanged|hung) (my|him|her)self\b/, /\bnoose\b/, /\b(slit|slitting|cut|cutting|slice|slicing) (my|his|her) (wrists?|throat|veins?)\b/,
  /\b(jump|jumping|throw myself|throwing myself) (off|from|in front of) (a|the|this) (bridge|building|roof|cliff|train|car|bus|balcony|overpass)\b/,
  /\b(shoot|shooting) (my|him|her)self\b/, /\bgun to my (head|mouth)\b/,
  /\bsuicide (note|letter|plan|hotline|thoughts?)\b/, /\b988\b/, /\bcrisis (line|hotline|text)\b/, /\b(writing|wrote|written) (a|my) (goodbye|farewell) (note|letter)\b/,
  /\bgiving away (all )?my (stuff|things|belongings)\b/, /\bhow (many|much) .{0,30}(to|would) (die|kill|be fatal|be lethal|od|overdose)\b/, /\b(lethal|fatal|deadly) (dose|amount|overdose)\b/,

  // --- Self-harm intent: modals, urges, ongoing self-harm ---
  // "i might / could / will / want to / am going to / tried to ... hurt myself" (not after "don't" / "never").
  new RegExp(`(?<!\\b(don'?t|do not|didn'?t|did not|never|not|won'?t|wouldn'?t|shouldn'?t) )\\b(might|mite|may|could|will|would|shall|should|i'?ll|ill|i'?d|going to|gonna|gona|about to|want to|wanna|wants to|wanted to|feel like|felt like|tempted to|urges? to|need to|gotta|plan to|plans to|planning to|planned to|try to|trying to|tried to|attempt to|attempted to|attempting to|decided to|ready to|deserve to|might as well)( just| really| actually| seriously| end up| go)? (${SELF_VERB}) my ?self\\b${NOT_ACCIDENT}`),
  // "thinking about / feel like / urge to / keep / been ... hurting myself".
  new RegExp(`\\b(thinking (about|of)|thought (about|of)|thoughts (about|of)|think about|feel like|felt like|feeling like|urges? (to|of)|tempted (to|by)|keep|keeps|kept|been|started|start|can'?t stop|couldn'?t stop|stop myself from|addicted to|considering|contemplating|fantasi[sz]ing about|dreaming about|obsessing over|relapsed( on| into)?|caught myself|back to|went back to|i'?m|i am|was) (just |really |seriously |constantly |always )?(${SELF_VERBING}) my ?self\\b${NOT_ACCIDENT}`),
  /\b(hurting|harming|cutting|burning|starving|hitting|punching|scratching) my ?self (again|more|every day|every night|daily|lately)\b/,
  // On purpose: "i cut myself on purpose", "i scratch my arms until they bleed on purpose".
  /\b(hurt|harm|cut|burn|hit|scratch|punch|bruise|starve|stab|injure)\w* (my ?self|my (arms?|legs?|wrists?|thighs?|skin|stomach|body|hands?))\b.{0,30}\b(on purpose|intentionally|deliberately)\b/,
  /\b(hurt|harm|cut|burn|hit|scratch|punch|starve)\w* my ?self to (cope|feel (something|better|better)|punish|calm down|get through)\b/,
  // Cutting with no object: "i've been cutting again", "i started cutting", "keep cutting my arms".
  /\b(been|started|start|keep|kept|i'?m|i am|back to|stop|quit|stopped|relapsed|relapsed and started|urges? to|want to|wanna|miss|went back to|resisting) cutting( again| my (arms?|legs?|wrists?|thighs?|skin|stomach|hips?))?(?= ?([.!?,]|$| again| and| but| so| since| lately| every| because| for))/,
  /\brelaps\w* (on |into |with )?(self[- ]?harm|cutting|hurting myself)/,

  // --- Self-harm / suicide: indirect ideation ---
  /\b(i'?m|i am|im|i feel like i'?m|i'?ve become) (a )?(danger|threat|dangerous) to (my ?self|others|myself and others)\b/,
  /\b(don'?t|do not|no longer|not|never) feel(ing)? safe( (with|around|by|being (alone )?with) my ?self| alone| by myself| being alone| at home alone| in my own (head|mind|body))\b/, /\b(i'?m|i am) not safe( (with|around|by) my ?self| alone| right now| tonight)\b/,
  /\b(don'?t|do not|can'?t|cannot|no longer) trust my ?self( (right now|anymore|any more|tonight|alone))? ?([.!?,]|$)/,
  /\b(don'?t|do not|can'?t|cannot|no longer) trust my ?self (not to|alone|around|with) (my |the |a |any |these |those )?(pills|meds|medications?|medicines?|knives|knife|razors?|blades?|guns?|gun)\b/,
  new RegExp(`${NO_SYMPTOM}.*\\b(can'?t|cannot|can not|couldn'?t) (take|tak|handle|do|deal with|bear|stand|cope with) (it|this|this life|life|living|any of this|everything)( any ?more| no more)\\b`),
  new RegExp(`${NO_SYMPTOM}.*\\b((just )?(want|wanna|need|wish)( for)? (it|this|everything|all of it|all this) to (stop|end|be over)|make it (all )?stop)\\b`),
  new RegExp(`${NO_SYMPTOM}.*\\b(what'?s|whats|what is) the point( any ?more)? ?([.!?,]|$)`),
  /\b(want|wanna|wish|need)( for)? it all to (stop|end|be over)\b/, /\b(give up|giving up|gave up|done|finished) (on|with) (life|living|it all|being alive)\b/, /\b(tired|sick) of (life|living|being alive|existing)\b/,
  /\b(what'?s|whats|what is) the point (of|in) (living|life|being alive|going on|existing|anything any ?more)\b/, /\blife (is|feels) (pointless|meaningless|hopeless|not worth it)\b/,
  /\b(want|wanna|wish i could|i'?d like|just want) to (just )?(disappear|vanish|stop existing|cease to exist|not exist|fade away)\b/,
  /\b(sleep|go to sleep|fall asleep) and (never|not) wake( up)?\b/, /\b(hope|wish|pray|praying) (that )?i (never|don'?t|do not|won'?t) wake( up)?( (tomorrow|again|ever|any ?more|in the morning))? ?([.!?,]|$)/,
  /\b(no ?one|nobody|noone|no body) (would|will|is going to|gonna|wouldn'?t)( even)? (miss me|notice if i (died|was gone|disappeared)|care if i (die|died|was gone|were gone|disappeared|was dead))\b/,
  /\b(might|may|could|will|i'?ll|ill|should|gonna|going to) (just )?end (it|it all|things|everything|my life)( (tonight|today|now|soon|for good))? ?([.!?,]|$)/,
  /\bgoodbye (forever|everyone|world|cruel world|for good)\b/, /\b(final|last) goodbye\b/, /\bthis is (my )?goodbye\b/,
  // Pills as a method: "thinking about taking all my pills", "would 30 advil kill me".
  /\b(thinking (about|of)|thought about|want to|wanna|going to|gonna|about to|plan(ning)? to|urges? to|tempted to|might|could|i'?ll) (just )?(take|taking|swallow|swallowing|down|downing|pop|popping|eat|eating|overdose on|overdosing on) (all|every one|every single one|the whole bottle|a whole bottle|the entire bottle|the rest|a handful|handfuls|a bunch|tons) (of )?(my |the |these |those |his |her )?(\w+ )?(pills|meds|medications?|medicines?|tablets|capsules|bottle|tylenol|advil|aspirin|ibuprofen|acetaminophen|benadryl|melatonin|sleeping pills|xanax|insulin)\b(?! (at once|at the same time|together|in the morning|at night|at bedtime|with (food|water|breakfast|dinner|me)|before|after|every|each|daily|on time|as prescribed))/,
  /\b(\d+|ten|twenty|thirty|fifty|a hundred|bottle|enough|pills?|tablets?|tylenol|advil|aspirin|ibuprofen|acetaminophen|motrin|aleve|benadryl|melatonin|nyquil|insulin)\b.{0,25}\b(would|enough to|to) kill (me|myself|a person|someone)\b/,
  /\b(would|will|could|can|does|do) (\d+|ten|twenty|thirty|fifty|a hundred|a (whole )?bottle( of)?|all( of)? my|enough)( \w+){0,3} kill (me|myself|a person|someone)\b/,
  /\b(please|pls|plz|just|someone|somebody|(want|need|wish) (someone|somebody|you) (to|would)|god|might as well) kill me\b/,

  // --- Harm to others / violence / assault ---
  /(?<!\b(don'?t|do not|didn'?t|never|not|won'?t|wouldn'?t) )\b(want|wanna|going|gonna|plan(ning)?|about|thinking (about|of)|urge|urges|feel like|tempted|i will|i'?ll|i'?m going to|might|may|could|would|i'?d) (to )?(just )?(kill|murder|hurt|stab|shoot|strangle|choke|beat up|harm|poison) (him|her|them|someone|somebody|people|everyone|my (wife|husband|mom|dad|mother|father|boss|partner|girlfriend|boyfriend|roommate|neighbor|kid|child|family|sister|brother|coworker|teacher|baby|son|daughter))\b(?!'s|s'| feelings| chances| pride| ego| career| reputation| business)/,
  /\b(hurt|harm|kill) (someone|somebody|others|other people|people)\b/, /\bhomicid/, /\bmass shooting\b/, /\bactive shooter\b/,
  /\b(been|got|was|i'?m|im|he'?s|she'?s|he was|she was|just got|been) (shot|stabbed|stabed|stab(b)?ed)\b/, /\bgun ?shot\b/, /\bgunshot\b/, /\bstab(bed|bing)? wound\b/, /\bstabbed\b/, /\bbullet wound\b/,
  /\b(being|been|was|got|i'?m being) (attacked|assaulted|raped|beaten|beat up|strangled|choked by|kidnapped|abducted|threatened with)\b(?! by (mosquito|bug|bee|allerg))/, /\braped\b/, /\bsexual(ly)? assault/,
  /\b(he|she|they|my (husband|wife|boyfriend|girlfriend|partner|dad|father|mom|mother)) (is|keeps|are|has been|was) (hitting|beating|choking|strangling|threatening|hurting) (me|us|my)\b/, /\bdomestic (violence|abuse)\b/,
  /\bthreaten(ing|ed)? to (kill|hurt|shoot|stab)\b/, /\bsomeone (is )?(breaking in|broke in|has a (gun|knife))\b/,

  // --- Severe bleeding ---
  /(severe|heavy|uncontrollable|won'?t stop) bleeding/, /bleeding (won'?t|will not|doesn'?t) stop/,
  /\b(severe|heavy|uncontrollable|uncontrolable|profuse|massive|serious|excessive|major|lots of|a lot of|alot of|so much|really bad|spurting|gushing|nonstop|non-stop|non stop|constant) (bleeding|bleading|bleding|bleedin|bleedng|bleeeding|blood loss)\b/,
  /\b(bleeding|bleading|bleding|bleedin|blood) (won'?t|wont|will not|doesn'?t|doesnt|does not|isn'?t|is not|isnt|can'?t|cant|not|hasn'?t|never) (stop|stopping|stoping|stopped|slowing|slow down)\b/,
  /\b(can'?t|cant|cannot|unable to) (get (the|it|my) )?(bleeding|blood|it) to stop\b/, /\b(can'?t|cant|cannot) stop (the )?(bleeding|bleading|blood)\b/,
  /\bblood (is )?(spurting|squirting|gushing|pouring|pumping|everywhere|soaking)\b/, /\b(spurting|gushing|pouring) blood\b/, /\b(lost|losing) (a lot of|alot of|so much|tons of) blood\b/,
  /\bbleeding (out|everywhere|heavily|profusely|through (the|a|my) (bandage|towel|gauze))\b/, /\bbled out\b/, /\bsoaked through (the|a|my) (bandage|towel|gauze)\b/,
  /\bdeep (gash|wound|laceration|stab|puncture)\b/, /\b(cut|gash|wound) (is )?(so |very |really )?deep (and|i can see|that)\b/, /\b(arterial|artery) (bleed|bleeding|cut)\b/, /\bcut (an|my|the) artery\b/,
  /\bamputat/, /\b(cut|chopped|sliced|ripped|torn) off (my|his|her|a|the) (finger|thumb|toe|hand|foot|arm|leg|ear)\b/, /\bsevered\b/, /\btourniquet\b/,
  /\bimpaled\b/, /\b(knife|blade|metal rod|rebar) (is )?(stuck|lodged|embedded) in (my|his|her)\b/,

  // --- Head injury / loss of consciousness ---
  /\b(hit|bumped|banged|smashed|hurt|injured|struck|whacked|cracked) (my|his|her|their) head\b.{0,60}\b(passed out|pased out|blacked out|knocked out|lost consciousness|unconscious|unconcious|throwing up|threw up|vomit\w*|confus\w*|can'?t remember|seizure|bleeding|won'?t wake|drowsy|sleepy)/,
  /\bknocked (out|unconscious|unconcious|me out|him out|her out|them out)\b/, /\bblack(ed|ing)? out\b/, /\bblacked out\b/, /\blost consciousness\b/, /\bloss of consciousness\b/, /\blost conciousness\b/,
  /\b(serious|severe|bad|major|traumatic) (head|brain|skull|spinal|spine|neck) (injury|injuries|trauma)\b/, /\b(skull|spinal) fracture\b/, /\bfractured (my |his |her )?skull\b/, /\bbrain (bleed|hemorrhage|haemorrhage)\b/,
  /\bconcussion\b.{0,40}\b(vomit|throwing up|confus|passed out|unconscious|seizure|worse)/, /\bfell (off|from|down) .{0,40}\b(can'?t move|unconscious|not moving|head)\b/,
  /\b(can'?t|cannot|can not) (move|feel) (my|his|her|their) (legs|arms|body)\b/, /(?<!sleep )\bparaly[sz](ed|is)\b/,

  // --- Seizures ---
  /seizure/, /convulsi/,
  /\b(seiz|siez|seaz|sez|seis|siez|seas|sieze|ceaz|seaz|sei)(ure|ures|ur|er|ers|ing)\b(?! up)/, /\bsiezure/, /\bseizur/, /\bseasure/, /\bceasure/, /\bsezure/, /\bsiezing\b(?! up)/,
  /\bconvuls/, /\bconvultion/, /\bconvulting\b/, /\bepilep(tic|sy) (fit|attack|episode|seizure)\b/, /\b(having|had|has|having a) (a )?fit\b(?! of (laughter|rage|anger|coughing|sneez))/, /\bgrand mal\b/, /\bstatus epilepticus\b/,
  /\b(shaking|jerking|twitching) (uncontrollably|all over and (unconscious|not responding|won'?t respond))\b/, /\b(eyes rolled|eyes rolling) (back|into)\b/, /\bfoaming at the mouth\b/,

  // --- Unconscious / unresponsive / fainting / collapse ---
  /unconscious/, /passed out/, /unresponsive/, /fainted/,
  /\bun ?c[ao]n\w{0,3}(ious|ous|ius|us|hus|cious|scious|chus|shus)\b/, /\bunconcious\b/, /\bunconsious\b/, /\bunconscous\b/, /\bunconcsious\b/,
  /\bunrespon\w*/, /\bun-respon\w*/, /\b(he|she|they|baby|someone|person|patient|(my )?(mom|dad|mother|father|wife|husband|son|daughter|friend|grandma|grandpa))('s| is| isn'?t| are| aren'?t)? (not )?(responding|responsive|respond)\b/, /\bnon[- ]?respon(sive|ding)\b/,
  /\b(pass(es|ed|ing)?|pased|past|pasing|passt) out\b/, /\b(keep|keeps|kept) (passing|pasing) out\b/,
  /\b(faint(ed|ing|s)|feint(ed|ing)|fainte?d|fanted|fainded)\b/, /\bfaint(ing)? spell/,
  /\b(he|she|they|baby|someone|(my )?(mom|dad|mother|father|wife|husband|son|daughter|friend|grandma|grandpa)) (won'?t|wont|will not|isn'?t|is not|doesn'?t|can'?t|cant|is) (wake|waking) up\b/, /\b(can'?t|cannot|cant) wake (him|her|them|my \w+)( up)?\b/, /\bcollaps(ed|ing|es)?\b/, /\bcolapsed\b/, /\bcollasped\b/,
  /\bfound (him|her|them|someone|my \w+) (on the (floor|ground)|unconscious|not moving|not breathing)\b/, /\bnot (moving|waking) (and|or) not breathing\b/,
  /\b(in|went into|going into) (a )?coma\b/, /\bcomatose\b/,

  // --- Severe burns (not minor ones) ---
  /\b(severe|serious|major|large|huge|big|massive|extensive|deep|bad|really bad|terrible) burns?\b(?! (on|from) (my |the )?(finger|fingertip|tongue|thumb|hand on|stove a little))(?! (a little|small))/,
  /\b(third|3rd|fourth|4th)[- ]?(degree|degre|degee) (burns?|burned|burnt)?/, /\bsecond[- ]degree burns? (over|on|all over|covering) (my |his |her )?(whole|entire|most|half|large|big|face|chest|back|legs?|arms?)/,
  /\b(chemical|chemicle|electrical|electric|acid|lye|bleach|alkali) burns?\b/, /\bburn(ed|t|s)? (by|with|from) (acid|chemicals?|lye|bleach|electricity|a power line|lightning)\b/,
  /\bburns? (over|on|covering|all over) (my |his |her |their )?(whole|entire|most of|half|large part|large area|big part)\b/, /\bburn(ed|t|s)? (over|all over) (my |his |her |their )?(body|face|chest|back)\b/,
  /\b(skin|burn) (is |looks |turned )?(charred|black|blackened|leathery|white and leathery|melted|peeling off in sheets)\b/,
  /\b(caught|catching|set|set (myself|him|her|them)) (on )?fire\b/, /\b(clothes|clothing|hair|shirt|house|kitchen) (is |are |was |were )?(on fire|caught fire|burning)\b/, /\bself[- ]?immolat/,
  /\b(chemical|chemicals|bleach|acid|lye|ammonia|oven cleaner|drain cleaner|pepper spray) (in|into|splashed in|got in) (my |his |her |their )?eyes?\b/, /\bburned (my |his |her )?(eyes?|airway|throat from (fire|smoke))\b/,

  // --- Broken bones (bone visible / serious) ---
  /\bbone (is )?(sticking|poking|showing|visible|coming|pushing|jutting|protruding|popping) (out|through)\b/, /\bbone (sticking|poking) out\b/, /\b(can|i can) see (the |my |his |her )?bone\b/, /\bbone (is )?(visible|exposed)\b/,
  /\b(compound|open|comminuted) fractur/, /\bbroke(n)? (my |his |her )?(neck|back|spine|femur|pelvis|hip|skull)\b/, /\b(neck|back|spine|femur|pelvis|hip|skull) (is )?(broken|broke|fractured)\b/,
  /\b(leg|arm|bone|wrist|ankle) (is )?(bent|pointing) (the )?(wrong way|backwards|sideways|at a weird angle)\b/, /\bdislocated (hip|knee|neck)\b/,

  // --- Sudden severe headache ---
  /worst headache of my life/,
  /\bworst (head ?ache|headach|headace|headake|hedache|haedache|hedake|headahce|head pain|migraine|migrane|migrain)s? (of|in) (my|his|her) (entire |whole )?(life|lif|lifetime)\b/,
  /\bworst (head ?ache|headach|headace|hedache|haedache|head pain|migraine|migrane)s? (ever|i'?ve ever|i have ever|ive ever|i ever|of all time)\b/,
  /\bthunder ?clap/, /\bthunderclap\b/,
  /\b(sudden|suddenly|sudden onset|explosive|out of nowhere|came on suddenly)\b.{0,25}\b(severe|excruciating|explosive|worst|blinding|unbearable|intense|horrible|terrible) (head ?ache|headach|hedache|head pain)/,
  /\b(severe|excruciating|explosive|blinding|unbearable) (head ?ache|headach|hedache|head pain) (that )?(came on |started |hit )?(suddenly|out of nowhere|all of a sudden|in seconds|like a thunderclap)\b/,
  /\bhead ?ache\b.{0,40}\b((and |with |is |now |very |really |getting )confus(ed|ion)\b(?! (about|which|by|what|on|if|whether|as to|with (the|which|what)))|can'?t see|vision loss|passed out|seizure|slurred|after (hitting|hit|bumping|banging) my head)\b/,
  /\bhead ?ache\b.{0,40}\b(numb|weak) (on )?(one side|my (left|right) side)\b/,

  // --- Meningitis signs ---
  /\bmen[ie]n?g[ie]t[iu]s\b/, /\bmenengitis\b/, /\bmeningococc/, /\bmenigitis\b/,
  /^(?=.*\b(stiff(ness)?|stif) (neck|nek|in (my|the|his|her) neck)|.*\bneck (is |feels )?(really |very )?(stiff|stif)\b|.*\bcan'?t (bend|touch) (my |his |her )?(chin|neck))(?=.*\b(fever|feverish|temp(erature)?|fevr|fevor)\b)(?=.*\b(rash|rashes|spots|confus\w*|light (sensitivity|hurts|bothers)|sensitive to light|vomit\w*|throwing up|purple)\b)/,
  /\brash (that )?(doesn'?t|does not|won'?t|wont|isn'?t|didn'?t) (fade|go away|disappear|blanch) (when|under|with) (i )?(press|a glass|glass)/, /\bglass test\b/, /\bnon[- ]?blanching rash\b/, /\bpurple (spots|rash|blotches) (and|with) (fever|feverish)\b/, /\bpetechia/,

  // --- Coughing / vomiting blood, black or bloody stool ---
  /coughing (up )?blood/, /vomiting blood/,
  /\b(cough|caugh|coff|cof|cogh)\w* (up )?(blood|bloood|blod|bloody|blood clots)\b/, /\b(spit|spitting|spat|spiting) (up |out )?(blood|blod)\b/,
  /\b(throw|throwing|threw|throws|puk(e|ing|ed)|vomit(ing|ting|ed|s)?|vommit(ing)?|vomitt(ing)?|vomm?it\w*|barf(ing|ed)?|hurl(ing|ed)?) (up )?(blood|blod|bloody|blood clots)\b/,
  /\bblood (in|on) (my |his |her |the )?(vomit|vomitt|puke|throw ?up|spit|phlegm|mucus|saliva|sputum)\b/, /\b(vomit|puke|throw up|phlegm|mucus|spit|sputum) (is |has |with |full of )?(blood|bloody|red with blood)\b/,
  /\b(like|looks like|resembles) coffee[- ]?grounds?\b/, /\bcoffee[- ]?ground (vomit|throw ?up|puke)\b/, /\bhematemesis\b/, /\bhemoptysis\b/, /\bbloody (vomit|puke|cough|phlegm|mucus|sputum|stool|stools|poop|poo|diarrhea|diarrhoea|diarea|bowel)/,
  /\bblack (and )?(tarry |sticky |tar-like |tar like )?(stool|stools|poop|poo|poops|bowel movements?|diarrhea|diarrhoea|feces|faeces|shit)\b/, /\btarry (stool|stools|poop|poo)\b/, /\bmelena\b/,
  /\b(stool|stools|poop|poo|bowel movement|feces|shit) (is |are |looks |look |has been |turned )?(black|tarry|like tar|bloody|full of blood|red with blood|maroon)\b/,
  /\bblood (in|on) (my |his |her |the )?(stool|stools|poop|poo|bowel movements?|feces|diarrhea|diarrhoea|toilet bowl)\b/, /\b(pooping|pooped|shitting|passing|passed) (out )?(blood|blood clots)\b/, /\brectal bleeding\b/, /\bbleeding from (my |the )?(rectum|butt|bum|anus)\b(?! a little)/,

  // --- Severe abdominal pain / appendicitis ---
  /\bap?pend(i|e)[cs]?[iy]?t[iu]s\b/, /\bapendicitis\b/, /\bappendisitis\b/, /\bappendix (is )?(burst|bursting|ruptur\w*|exploded|infected|inflamed)\b/, /\b(burst|ruptured) appendix\b/,
  /\b(severe|sharp|stabbing|intense|excruciating|unbearable|horrible|terrible|extreme|really bad|worst)\b.{0,15}\bpain\b.{0,25}\b(lower right|right lower|bottom right|right side of (my |the )?(stomach|abdomen|belly|tummy|lower))/,
  /\b(lower right|right lower|bottom right) (side |part )?(of (my |the )?)?(stomach|abdomen|abdominal|belly|tummy|side)? ?(pain|hurts?|is killing)\b.{0,30}\b(severe|sharp|stabbing|intense|excruciating|unbearable|fever|vomit|can'?t (walk|stand|move))/,
  /\b(severe|excruciating|unbearable|extreme|intense|worst|horrible|agonizing|stabbing|really really bad) (abdominal|abdomen|abdomenal|abdominle|belly|stomach|stomache|tummy|gut) (pain|pains|ache|cramps?)\b/,
  /\b(abdomen|belly|stomach|abdominal|abdomin) (is )?(rigid|hard as a board|board[- ]like|swollen and hard)\b/, /\bcan'?t (stand|walk|move|stand up) (straight )?(because of|from|due to) (the )?(stomach|abdominal|belly) pain\b/,
  /\b(ruptured|burst|perforated|twisted) (bowel|intestine|ovary|ovarian cyst|testicle|spleen|ulcer|aneurysm)\b/, /\btesticular torsion\b/, /\bbowel obstruction\b/, /\baortic (aneurysm|dissection)\b/,

  // --- Diabetic emergencies ---
  /\bdi[ae]b[ea]?t[ie]c (coma|emergency|emergancy|shock|seizure|ketoacidosis|crisis|attack)\b/, /\b(diabetic )?keto ?acidosis\b/, /\bdka\b/, /\binsulin (shock|reaction|overdose)\b/, /\bhypoglyc[ae]mic (shock|coma|episode|attack|seizure)\b/, /\bhyperosmolar\b/,
  /\bblood sugar (is |was |reads |reading |at |of )*(very |really |super |dangerously |extremely |crazy |too )?(low|high)\b.{0,40}\b(confus\w*|passed out|pass(ing)? out|unconscious|seizure|shaking|won'?t wake|can'?t think|vomit\w*|drowsy)\b/,
  /\bblood sugar (is |was |reads |of |at |over |above )*([4-9]\d\d|[1-9]\d\d\d)\b/,
  /\b(sugar|glucose) (is |was )?(dangerously|critically|extremely) (low|high)\b/, /\b(diabetic|diabetes|diebetic|diabetis)\b.{0,40}\b(unconscious|passed out|confus\w*|unresponsive|seizure|won'?t wake|fruity breath)\b/,

  // --- High fever with confusion / very high fever ---
  /\b(fever|fevr|fevor|feaver|temperature|temp)\b.{0,50}\b((and |with |is |seems |getting |very |really |acting |now )confus(ed|ion)\b(?! (about|which|by|what|on|if|whether|as to|with (the|which|what)))|delirious|delerious|delirium|disoriented|hallucinat\w*|not making sense|won'?t wake|seizure|very drowsy|can'?t stay awake|lethargic and)\b/,
  /\b(confusion|very confused|confused and|delirious|delerious|disoriented|hallucinat\w*)\b.{0,50}\b(high fever|fever|fevr|feaver|burning up)\b/,
  /\b(fever|temperature|temp|fevr) (is |of |at |was |reading |reads |hit |hitting |over |above )*(10[4-9]|11\d)(\.\d+)?( ?(f|°f|degrees|deg))?\b/, /\b(fever|temperature|temp) (is |of |at |was |over |above )*(4[0-4])(\.\d+)? ?(c|°c|celsius|degrees c)\b/,

  // --- Pregnancy emergencies ---
  /\bpregn\w*\b.{0,50}\b(bleeding|bleading|bleed|severe pain|sharp pain|cramping badly|passed out|fainted|seizure|leaking fluid|can'?t feel (the )?baby|baby (isn'?t|is not|stopped) moving)\b/,
  /\b(bleeding|bleading|bleed|severe pain|severe cramps)\b.{0,40}\b(while|and|during|since|i'?m|im|i am|but i'?m|when) (i'?m |im |i am |being |still )?pregn\w*/,
  /\b(my |her )?water (just )?(broke|broken|breaking)\b/, /\b(in|going into|went into|gone into) (pre-?term |early |active )?labou?r\b/, /\bpre-?term labou?r\b/, /\bcontractions\b.{0,30}\b(minutes apart|close together|weeks|early)\b/,
  /\bmisc?arr?(i|y)?a?(ge|ging|ing|ied|y)\b/, /\bmiscarr/, /\bmiscari/, /\bmiscarage/, /\bectopic\b/, /\bpre-?eclamp/, /\beclampsia\b/, /\bplacenta(l)? (abruption|previa)\b/,
  /\bbaby (isn'?t|is not|has stopped|stopped|not) (moving|kicking)\b/, /\b(giving birth|having the baby|baby is coming|baby'?s coming|crowning)\b/,

  // --- Hypothermia / heat stroke / cold and heat injuries ---
  /\bhyp(o|e)th?erm/, /\bhypotermia\b/, /\bhypertherm/, /\bhypothermic\b/, /\bhypothermia\b/,
  /\bheat ?stroke\b/, /\bheat ?strok\b/, /\bsun ?stroke\b/, /\bheat (exhaustion|exaustion|exhuastion)\b.{0,40}\b(confus|passed out|stopped sweating|not sweating|vomit|seizure)/,
  /\b(stopped|not|isn'?t|is not) sweating\b.{0,30}\b(hot|heat|confus|fever)/, /\b(hot|heat|confus\w*)\b.{0,30}\b(stopped|not|isn'?t) sweating\b/,
  /\bstopped shivering\b/, /\bbody temp(erature)? (is |of |at |below |under )*(8\d|9[0-4])(\.\d+)? ?(f|°f|degrees)\b/, /\bfrozen (solid|and unconscious)\b/, /\bsevere frost ?bite\b/, /\bfrost ?bite\b.{0,30}\b(black|blue|white and hard|numb and hard|no feeling)\b/,

  // --- Drowning / electric shock / lightning ---
  /\bdrown(ing|ed|s|in)?\b(?! in (work|homework|debt|paperwork|emails?|snot|mucus|phlegm|bills|stress|assignments))/, /\bdrowing\b/, /\bdrownding\b/, /\bnearly drowned\b/, /\balmost drowned\b/, /\b(pulled|dragged|fished) (him|her|them|someone|my \w+) (out of|from) (the )?(water|pool|lake|river|ocean|sea|bath|tub)\b/, /\b(inhaled|swallowed) (a lot of )?(pool |lake |sea )?water and\b/, /\bface ?down in (the )?(water|pool|bath|tub)\b/,
  /\bel[ei]?c?t?r[oi]c?ut/, /\belectrocut/, /\belectricut/, /\belectrical (shock|injury)\b/, /\belectric shock\b/, /\b(got|been|was|i got|he got|she got) (shocked|zapped) (by|from) (an? |the )?(outlet|socket|wire|power line|powerline|electricity|electric fence|live wire|high voltage|car battery|fuse box|breaker)\b/,
  /\b(stuck|touched|touching) (a |the )?(live wire|power ?line|high voltage)\b/, /\b(struck|hit) by (lightning|lightening|lighting)\b/, /\blightning (strike|struck)\b/,

  // --- Sepsis / spreading infection ---
  /\bsep(s|c|ss)[iu]s\b/, /\bsepsis\b/, /\bsepcis\b/, /\bseptic (shock|infection|blood)\b/, /\bseptisemia\b/, /\bsepticemia\b/, /\bsepticaemia\b/, /\bblood (infection|poisoning)\b/,
  /\bred (streak|streaks|line|lines) (going|spreading|running|moving|coming) (up|from|along|toward)\b/, /\binfection (is )?(spreading|spreding) (fast|quickly|rapidly|up my)\b/, /\bflesh[- ]eating\b/, /\bnecroti[sz]ing\b/, /\bgangrene\b/,
  /\b(infection|infected|wound)\b.{0,50}\b(fever|chills)\b.{0,30}\b(confus\w*|racing heart|heart racing|very fast heart|clammy|mottled|can'?t stay awake)\b/,

  // --- Other urgent signs ---
  /\b(swelling|swollen|pain) in (one|my) (calf|leg)\b.{0,40}\b(chest pain|short(ness)? of breath|can'?t breathe)\b/, /\bblood clot in (my |the )?(lung|lungs|brain)\b/, /\bpulmonary embolism\b/,
  /\bpneumothorax\b/, /\bcollapsed lung\b/, /\bheart (is )?(racing|pounding|beating) .{0,30}\b(passed out|fainted|chest pain|can'?t breathe)\b/,
  /\b(bitten|bit|stung) by (a |an )?(rattlesnake|snake|venomous|copperhead|cottonmouth|black widow|brown recluse|scorpion|box jellyfish)\b/, /\bsnake ?bite\b/, /\bsnakebite\b/,
  /\bdog (bite|attack|mauled)\b.{0,30}\b(deep|bleeding a lot|face|neck)\b/, /\bmauled\b/, /\b(car|motorcycle|bike) (crash|accident|wreck)\b.{0,40}\b(bleeding|unconscious|can'?t move|not moving)\b/, /(?<!\blike (i |i'?ve |ive |i'?d )?(got |been |was |just got |had been )?)\b(hit|struck|run over) by (a )?(car|truck|bus|train|vehicle)\b/,
  /\bfell (from|off) (a |the )?(roof|ladder|building|balcony|second floor|third floor|cliff|tree)\b/,
];
