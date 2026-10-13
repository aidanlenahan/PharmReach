import { P, has, type Picks } from '../shared';

// Cough, chest congestion, colds, flu and sore throat.
// Note: coldSoreRules runs first and strips "cold sore" phrases, so "cold" here never sees them.
export function respiratoryRules(t: string, picks: Picks) {
  // ---- Cough (any kind) ----
  if (has(t, 'cough*', 'hacking', 'hacking up', 'hack up', 'hocking up', 'tickle in my throat', 'tickly throat', 'tickle in throat', 'throat tickle', 'ticklish throat', 'tickle in the back of my throat')) {
    picks.add(3, P.coughSyrup, P.mucinexDm, P.mucinex);
  }
  // Cough misspellings and keyboard typos ("caugh*" is avoided because it would match "caught").
  if (has(t, 'cogh*', 'couf', 'coufs', 'coufing', 'coufh*', 'caugh', 'caughs', 'caughing', 'cuogh*', 'coff', 'coffs', 'coffing', 'cofing', 'couhg*', 'cougj*', 'cought', 'coughign', 'cougn', 'couging', 'cughing', 'cugh', 'cughs', 'coigh*', 'cpugh*', 'xough*', 'vough*', 'cohgh*', 'cpough*', 'couph*', 'cauf', 'caufing', 'kough*', 'koff', 'koffing', 'kof', 'kofs', 'kofing', 'cowgh*', 'coughh*', 'cooough', 'coughinh', 'cougth*', 'couh', 'couhing', 'coughting')) {
    picks.add(3, P.coughSyrup, P.mucinexDm, P.mucinex);
  }
  if (has(t, 'cough syrup', 'cough medicine', 'cough med', 'cough meds', 'cough suppressant*', 'suppress my cough', 'suppress cough', 'cough relief', 'cough liquid', 'cough remedy', 'cough remedies', 'antitussive', 'dextromethorphan', 'dextromethorphan hbr', 'dm syrup', 'dm cough')) {
    picks.add(4, P.coughSyrup, P.mucinexDm);
  }

  // ---- Dry, tickly, hacking, nighttime and nagging coughs ----
  if (has(t, 'dry cough*', 'dry hacking', 'tickly cough*', 'tickle cough', 'tickling cough', 'tickly', 'hacking cough*', 'nagging cough*', 'irritating cough*', 'annoying cough', 'unproductive cough', 'non productive cough', 'nonproductive cough', 'barky cough', 'scratchy cough', 'smoker\'s cough', 'smokers cough', 'smoker cough')) {
    picks.add(4, P.coughSyrup, P.mucinexDm);
  }
  if (has(t, 'nonstop cough*', 'non stop cough*', 'constant cough*', 'constantly cough*', "can't stop coughing", 'cant stop coughing', 'cannot stop coughing', 'can not stop coughing', 'wont stop coughing', "won't stop coughing", 'keep coughing', 'keeps coughing', 'been coughing', 'coughing fit*', 'coughing spell*', 'coughing attack*', 'cough attack*', 'coughing my lungs out', 'cough my lungs out', 'coughing up a lung', 'cough up a lung', 'coughing my head off', 'coughing like crazy', 'coughing all day', 'coughing nonstop', 'coughing so much', 'coughing a lot')) {
    picks.add(3, P.coughSyrup, P.mucinexDm);
  }
  if (has(t, 'coughing at night', 'cough at night', 'night cough*', 'nighttime cough*', 'night time cough*', 'nightime cough*', 'coughing all night', 'coughing in bed', 'cough keeps me up', 'coughing keeps me up', 'cough keeping me up', 'coughing keeping me up', 'cough wakes me up', 'coughing wakes me up', 'nocturnal cough')) {
    picks.add(3, P.coughSyrup, P.mucinexDm);
  }
  if (has(t, 'persistent cough*', 'lingering cough*', 'cough that wont go away', "cough that won't go away", 'cough wont go away', "cough won't go away", 'cough that will not go away', 'leftover cough', 'cough after a cold', 'cough after my cold', 'cough after the flu', 'post viral cough', 'post cold cough', 'stubborn cough*', 'cough hanging on')) {
    picks.add(3, P.coughSyrup, P.mucinexDm, P.mucinex);
  }

  // ---- Chest congestion, mucus and phlegm (productive cough) ----
  if (has(t, 'chest congest*', 'chest conges*', 'congested chest', 'congested in my chest', 'congested in the chest', 'chest feels gunky', 'chest is gunky', 'congestion in chest', 'congestion in my chest', 'congestion in the chest', 'chest is congested', 'chest feels congested', 'chest is all congested', 'chest is so congested', 'chest is really congested', 'chest feels all congested', 'chest is full of mucus', 'chest is full of phlegm', 'chest congestoin', 'chest congestin', 'chest congeston', 'chest congetion', 'chest conjestion', 'conjested chest', 'chest conjested', 'chest congeshun', 'chesty', 'chesty cough*', 'chest cough*', 'tight chest from mucus', 'chest full of mucus', 'chest full of phlegm', 'chest full of gunk', 'chest feels heavy with gunk', 'chest feels heavy with mucus', 'chest feels heavy with phlegm', 'heavy with gunk', 'rattly chest', 'rattling chest', 'chest rattl*', 'rattly cough*', 'rattling cough*', 'loose cough*', 'gurgly chest', 'gurgling chest', 'wet cough*', 'productive cough*', 'mucusy cough', 'phlegmy cough', 'phlegmy', 'mucusy', 'mucousy')) {
    picks.add(4, P.mucinex, P.mucinexDm, P.coughSyrup);
  }
  if (has(t, 'mucus', 'mucous', 'mucas', 'mucos', 'mucuss', 'muccus', 'mucuous', 'mocus', 'snot in my chest', 'snot going down my throat', 'snot down my throat', 'snot dripping down my throat', 'snot in my throat', 'drainage down my throat', 'drainage in my throat', 'mucus down my throat', 'drip down my throat', 'dripping down my throat', 'phlegm*', 'flem', 'flemm', 'flemy', 'phlem', 'phlemm', 'phelgm', 'fleghm', 'flegm', 'flegum', 'phleghm', 'phlegh', 'plegm', 'phlegem', 'phlgm', 'phelm', 'sputum', 'catarrh', 'catarh', 'gunk in my chest', 'gunk in my lungs', 'junk in my chest', 'junk in my lungs', 'crud in my chest', 'crap in my chest', 'stuff in my chest', 'goo in my chest', 'gunky chest', 'loogie*', 'lugie*')) {
    picks.add(4, P.mucinex, P.mucinexDm, P.coughSyrup);
  }
  if (has(t, 'coughing stuff up', 'coughing up stuff', 'coughing up mucus', 'coughing up phlegm', 'coughing up gunk', 'coughing up junk', 'coughing up green', 'coughing up yellow', 'coughing up crud', 'coughing up snot', 'coughing up booger*', 'hacking up snot', 'bringing up phlegm', 'bringing up mucus', 'hacking up phlegm', 'hacking up mucus', 'cough stuff up', 'cant cough it up', "can't cough it up", 'loosen mucus', 'loosen phlegm', 'loosen the mucus', 'break up mucus', 'break up phlegm', 'thin mucus', 'thin out mucus', 'thick mucus', 'expectorant*', 'guaifenesin', 'guaifenisin', 'guafenesin', 'guaifenasin', 'guiafenesin')) {
    picks.add(4, P.mucinex, P.mucinexDm, P.coughSyrup);
  }
  if (has(t, 'chest cold', 'chest colds', 'cold in my chest', 'cold went to my chest', 'cold moved to my chest', 'cold settled in my chest', 'bronchitis', 'bronchial', 'bronkitis', 'bronchitus', 'chest infection')) {
    picks.add(4, P.mucinex, P.mucinexDm, P.coughSyrup);
  }

  // ---- Common cold (bare "cold" is skipped: "I'm cold", "cold weather", "cold compress") ----
  if (has(t, 'colds', 'common cold', 'comon cold', 'commen cold', 'commom cold', 'head cold', 'head colds', 'a bad cold', 'bad cold', 'nasty cold', 'terrible cold', 'awful cold', 'horrible cold', 'heavy cold', 'stinking cold', 'stinkin cold', 'mild cold', 'slight cold', 'little cold', 'summer cold', 'winter cold',
    'have a cold', 'having a cold', 'has a cold', 'had a cold', 'got a cold', 'gotten a cold', 'get a cold', 'getting a cold', 'caught a cold', 'catch a cold', 'catching a cold', 'catched a cold', 'coming down with a cold', 'coming down with the cold', 'fighting a cold', 'fighting off a cold', 'fight off a cold', 'fighting this cold', 'getting over a cold', 'getting over my cold', 'recovering from a cold', 'sick with a cold', 'down with a cold', 'cold coming on', 'a cold coming on', 'feel a cold coming', 'feel like i have a cold', 'think i have a cold', 'think its a cold', "think it's a cold", 'just a cold', 'with a cold', 'from a cold', 'from my cold', 'for a cold', 'for my cold', 'for colds', 'my cold is', 'this cold is', 'cold is killing me', 'cold wont go away', "cold won't go away", 'got the cold', 'have the cold', 'caught the cold',
    'cold symptom*', 'cold medicine', 'cold medicines', 'cold meds', 'cold medication', 'cold remedy', 'cold remedies', 'cold relief', 'cold pills', 'cold tablets', 'cold virus', 'cold season', 'cold and flu', 'cold n flu', 'cold & flu', 'cold/flu', 'cold or flu', 'flu or cold', 'flu or a cold', 'cold or the flu', 'colds and flu', 'coldd', 'a coldd', 'sniffles', 'the sniffles', 'sniffly', 'snuffles', 'rhinovirus', 'the cold that is going around')) {
    picks.add(2, P.mucinexDm, P.acetaminophen, P.oxymetazoline);
  }
  // Just "cold" (or "a cold") as the whole message.
  if (/^(a |the |my )?colds?[.!?]*$/.test(t)) {
    picks.add(2, P.mucinexDm, P.acetaminophen, P.oxymetazoline);
  }
  // Head cold specifically comes with a blocked head; the nasal decongestant ranks a bit higher there.
  if (has(t, 'stuffy head cold', 'cold in my head', 'cold in my nose', 'cold with a runny nose', 'cold with a stuffy nose', 'cold and runny nose', 'cold and stuffy nose', 'cold and congestion', 'cold congestion', 'congestion from my cold', 'congested from my cold', 'blocked up with a cold', 'bunged up', 'full of cold')) {
    picks.add(2, P.oxymetazoline, P.mucinexDm, P.acetaminophen);
  }

  // ---- Flu and flu-like ----
  if (has(t, 'flu', 'the flu', 'flus', 'flue', 'fluu', 'flew symptoms', 'flu bug', 'flu symptom*', 'flu like', 'flulike', 'flu ish', 'fluish', 'flu season', 'flu virus', 'flu medicine', 'flu meds', 'flu medication', 'flu relief', 'man flu', 'manflu', 'got the flu', 'have the flu', 'caught the flu', 'think i have the flu', 'influenza', 'influensa', 'influenze', 'infuenza', 'inflenza', 'influenzia', 'influnza', 'enfluenza', 'influanza', 'grippe', 'la grippe')) {
    picks.add(2, P.acetaminophen, P.mucinexDm, P.ibuprofen);
  }
  if (has(t, 'covid', 'covid 19', 'covid19', 'corona', 'coronavirus', 'rsv', 'respiratory virus', 'respiratory infection', 'upper respiratory', 'chest bug', 'cold bug')) {
    picks.add(2, P.acetaminophen, P.mucinexDm, P.ibuprofen);
  }

  // ---- "Under the weather" and caught-a-bug talk ----
  if (has(t, 'under the weather', 'coming down with something', 'coming down with a bug', 'coming down with', 'caught a bug', 'caught something', 'caught some bug', 'got a bug', 'picked up a bug', 'picked up something', 'some bug', 'a bug going around', 'bug going around', 'something going around', 'whatever is going around', "whatever's going around", 'feel sick', 'feeling sick', 'feel ill', 'feeling ill', 'feel unwell', 'feeling unwell', 'feel crappy', 'feeling crappy', 'feel like crap', 'feel like garbage', 'feel like death', 'feel rough', 'feeling rough', 'feel run down', 'feeling run down', 'feeling poorly', 'the lurgy', 'lurgy', 'lurgi', 'a virus', 'got a virus', 'caught a virus', 'some virus', 'viral infection', 'sick with something', 'sick day', 'im sick', "i'm sick", 'i am sick', 'getting sick', 'got sick', 'feel sickly', 'feeling sickly')) {
    picks.add(1, P.acetaminophen, P.mucinexDm, P.ibuprofen);
  }

  // ---- Sore, scratchy, raw throat ----
  if (has(t, 'sore throat*', 'sorethroat', 'soar throat', 'sore throught', 'sore thoat', 'sore throte', 'sore throut', 'sore throatt', 'sore troat', 'sore thraot', 'sore throath', 'sore thorat', 'sore trhoat', 'sore throad', 'sore throaght', 'sore throta', 'sore thrat', 'sore throt', 'sor throat', 'soer throat', 'sore froat', 'throat is sore', 'throat sore', 'throat feels sore', 'throat hurts', 'throat hurt', 'throat hurting', 'throat is hurting', 'throat kills', 'throat is killing me', 'throat killing me', 'throat pain', 'throat ache', 'throat aches', 'achy throat', 'painful throat', 'pain in my throat', 'pain in throat')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }
  if (has(t, 'scratchy throat', 'throat is scratchy', 'throat feels scratchy', 'raw throat', 'throat is raw', 'throat feels raw', 'rough throat', 'throat feels rough', 'irritated throat', 'throat irritation', 'throat is irritated', 'throat feels irritated', 'dry throat', 'throat is dry', 'throat feels dry', 'itchy throat', 'throat itches', 'throat is itchy', 'throat feels itchy', 'throat feels like sandpaper', 'sandpaper throat', 'throat like sandpaper', 'throat on fire', 'throat is on fire', 'throat burns', 'throat is burning', 'burning throat', 'swallowing glass', 'swallowing razor blades', 'swallowing razors', 'swallowing knives', 'razor blade throat', 'swollen throat', 'throat is swollen', 'swollen glands', 'swollen tonsils', 'tonsils', 'tonsillitis', 'tonsilitis', 'strep', 'strep throat', 'throat infection', 'pharyngitis', 'throat')) {
    picks.add(2, P.acetaminophen, P.ibuprofen);
  }
  // Throat misspellings on their own.
  if (has(t, 'throught', 'thoat', 'throte', 'throut', 'throatt', 'troat', 'thraot', 'throath', 'thorat', 'trhoat', 'throad', 'throaght', 'throta', 'throats', 'thrat', 'throt', 'thraat', 'throaht', 'throar', 'thraught')) {
    picks.add(2, P.acetaminophen, P.ibuprofen);
  }
  if (has(t, 'painful swallowing', 'hurts to swallow', 'hurts when i swallow', 'it hurts to swallow', 'pain when swallowing', 'pain when i swallow', 'pain swallowing', 'swallowing hurts', 'swallowing is painful', 'painful to swallow', 'sore to swallow', 'swallowing is sore', 'hurts to eat and drink', 'hurts to drink', 'hurt to swallow', 'hurts swallowing', 'painfull swallowing', 'swalowing hurts', 'hurts to swalow')) {
    picks.add(3, P.acetaminophen, P.ibuprofen);
  }

  // ---- Losing voice / hoarse (pain relievers for the sore throat that usually comes with it) ----
  if (has(t, 'lost my voice', 'losing my voice', 'lost voice', 'lose my voice', 'no voice', 'voice is gone', 'voice gone', 'my voice is shot', 'voice is shot', 'voice went', 'voice is going', 'voice cracking', 'hoarse', 'hoarseness', 'hoarse voice', 'horse voice', 'voice is horse', 'voice horse', 'hoarce', 'horce voice', 'whorse voice', 'raspy', 'raspy voice', 'croaky', 'croaky voice', 'croaking', 'gravelly voice', 'laryngitis', 'larangitis', 'laryngytis', 'can barely talk', 'can barely speak', 'hurts to talk', 'hurts to speak')) {
    picks.add(2, P.acetaminophen, P.ibuprofen);
  }
}
