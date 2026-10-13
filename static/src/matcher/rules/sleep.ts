import { P, has, type Picks } from '../shared';

// Sleep and heart-health aspirin asked for by name.
export function sleepRules(t: string, picks: Picks) {
  // ---- Sleep: can't fall asleep ----
  if (has(t, "can't sleep", 'cant sleep', 'cannot sleep', 'can not sleep', 'unable to sleep', 'not able to sleep', "couldn't sleep", 'couldnt sleep', 'could not sleep', "can't get to sleep", 'cant get to sleep', "can't go to sleep", 'cant go to sleep', "won't sleep", 'wont sleep', "i don't sleep", 'i dont sleep', 'never sleep', "haven't slept", 'havent slept', 'have not slept', "didn't sleep", 'didnt sleep', 'did not sleep', 'no sleep', 'not sleeping', 'not getting sleep', 'not getting any sleep', 'not enough sleep', 'barely sleep*', 'hardly sleep*', 'barely slept', 'hardly slept', 'zero sleep')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }
  if (has(t, 'trouble sleeping', 'problem sleeping', 'problems sleeping', 'difficulty sleeping', 'difficulty falling asleep', 'struggling to sleep', 'struggle to sleep', 'struggle sleeping', 'hard to sleep', 'hard time sleeping', 'hard time falling asleep', 'issues sleeping', 'issue sleeping', 'sleeping problem*', 'sleep problem*', 'sleep issue*', 'sleep trouble*', 'sleep difficult*', 'sleeping issue*', 'sleeping trouble*', 'poor sleep', 'bad sleep', 'sleeping badly', 'sleeping poorly', 'sleep badly', 'sleep poorly', 'sleep deprived', 'sleep deprivation', 'lack of sleep')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }
  if (has(t, 'fall asleep', 'falling asleep', 'get to sleep', 'getting to sleep', 'drift off', 'nod off', 'doze off', 'go to sleep faster', 'fall asleep faster', 'sleep faster', 'takes forever to fall asleep', 'takes hours to fall asleep', 'lay awake', 'laying awake', 'lie awake', 'lying awake', 'lay in bed awake', 'lie in bed awake', 'lying in bed awake', 'laying in bed awake', 'staring at the ceiling', 'counting sheep', 'tossing and turning', 'toss and turn', 'tossing & turning', 'tossing turning', 'toss n turn', 'tossin and turnin')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }

  // ---- Sleep: waking up at night / can't stay asleep ----
  if (has(t, 'stay asleep', 'staying asleep', 'keep waking up', 'keep waking', 'wake up at night', 'waking up at night', 'wake up in the night', 'waking up in the night', 'wake up during the night', 'waking up during the night', 'wake up all night', 'waking up all night', 'wake up every hour', 'waking up every hour', 'wake up too early', 'waking up too early', 'wake up at 3', 'wake up at 3am', 'wake up at 4am', 'woke up at 3am', 'awake at 3am', 'awake at 3 am', 'awake at 2am', 'awake at 4am', 'wide awake', 'awake for hours', 'been awake all night', 'still awake', 'awake at night', 'awake all night', 'up all night', 'up till 4', 'up until 4am', 'broken sleep', 'interrupted sleep', 'fragmented sleep', 'light sleeper', 'sleep through the night', 'sleeping through the night', "can't stay asleep", 'cant stay asleep')) {
    picks.add(3, P.melatonin, P.melatoninCvs);
  }

  // ---- Sleep: racing thoughts, restlessness at bedtime ----
  if (has(t, 'racing thoughts', 'racing mind', 'mind racing', 'mind is racing', "mind won't shut off", 'mind wont shut off', "brain won't shut off", 'brain wont shut off', "brain won't turn off", 'brain wont turn off', "mind won't turn off", 'mind wont turn off', "can't shut my brain off", 'cant shut my brain off', "can't turn my brain off", 'cant turn my brain off', "can't stop thinking at night", 'overthinking at night', 'overthinking in bed', 'thoughts at bedtime', 'wired at night', 'wired at bedtime', 'too wired to sleep', 'too awake', 'not tired at night', 'never tired at night', 'restless at night', 'restless night*', 'restless sleep*', 'restless in bed', 'restlessness at night', 'night restlessness', 'cant relax at night', "can't relax at night", 'cant wind down', "can't wind down", 'wind down', 'unwind at night')) {
    picks.add(3, P.melatonin, P.melatoninCvs);
  }

  // ---- Sleep: insomnia (with misspellings) ----
  if (has(t, 'insomnia', 'insomniac', 'insomnic', 'insomina', 'insomia', 'insomnea', 'insomnya', 'insomnai', 'insommnia', 'insommia', 'insomnie', 'insominia', 'insonmia', 'insomnua', 'imsomnia', 'innsomnia', 'insumnia', 'insamnia', 'insomniya', 'insomnia*', 'sleepless', 'sleeplessness', 'sleepless night*', 'occasional sleeplessness', 'sleeplesness', 'sleeplessnes', 'sleepness', 'no sleep at all')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }

  // ---- Sleep: typos of "can't sleep" / "sleep" ----
  if (has(t, 'cant slep', "can't slep", 'cant sleap', "can't sleap", 'cant slepe', 'cant seep', 'cant sleeep', 'cant sleeo', 'cant sleepp', 'cnt sleep', 'cnat sleep', 'cnat slep', 'cant sleep at night', "can't sleep at night", 'cant sleepat night', 'cannt sleep', 'canot sleep', 'cannot slep', 'unable to slep', 'trouble sleping', 'trouble slepping', 'trouble sleaping', 'troble sleeping', 'trubble sleeping', 'sleping', 'slepping', 'sleaping', 'sleeeping', 'sleap', 'slepe', 'sleeep', 'sleeeep', 'sleeep*', 'slep', 'aslep', 'asleap', 'asleeep', 'fall aslep', 'fall asleap', 'stay aslep', 'stay asleap', 'falling aslep', 'insomnia pill*')) {
    picks.add(3, P.melatonin, P.melatoninCvs);
  }

  // ---- Sleep aid requests (diphenhydramine is a labeled nighttime sleep aid in some products; ranked low) ----
  if (has(t, 'sleep aid*', 'sleeping aid*', 'sleep aide', 'sleep aides', 'sleep help', 'sleeping help', 'help me sleep', 'help sleeping', 'help with sleep', 'help with sleeping', 'help falling asleep', 'help to sleep', 'help getting to sleep', 'something to sleep', 'something for sleep', 'something to help me sleep', 'something to make me sleep', 'knock me out', 'knock out', 'need to knock out', 'put me to sleep', 'put me out', 'sleeping pill*', 'sleep pill*', 'sleeping pils', 'sleep pils', 'sleeping tablet*', 'sleep tablet*', 'sleep med*', 'sleeping med*', 'sleep medicine', 'sleep remedy', 'sleep remedies', 'sleep supplement*', 'sleep gumm*', 'sleep vitamin*', 'sleep support', 'sleep formula', 'sleep drug*', 'nighttime sleep aid', 'night time sleep aid', 'otc sleep*', 'over the counter sleep*', 'natural sleep*', 'non habit forming sleep*', 'sleepytime', 'sleepy time')) {
    picks.add(3, P.melatonin, P.melatoninCvs);
    picks.add(1, P.diphenhydramine);
  }

  // ---- Melatonin asked for by description / misspelled ----
  if (has(t, 'melatonin', 'melatonen', 'melotonin', 'mellatonin', 'melatonine', 'melatonim', 'melatonon', 'melatinin', 'melatenin', 'melantonin', 'melatoin', 'melatnin', 'meltonin', 'melitonin', 'melatoni', 'melatonin*', 'melotonin*', 'mellotonin', 'melotonen', 'melatoinin', 'malatonin', 'melatonan', 'melatomin', 'melaonin', 'sleep hormone', 'natural sleep hormone')) {
    picks.add(5, P.melatonin, P.melatoninCvs);
  }

  // ---- Jet lag, time zones, travel ----
  if (has(t, 'jet lag', 'jetlag', 'jet lagged', 'jetlagged', 'jet lagd', 'jetlaged', 'jet laged', 'jet-lagged', 'jetleg', 'jet leg', 'jett lag', 'jet lagg', 'jetlagg', 'time zone*', 'time difference', 'adjust to the time*', 'adjusting to the time*', 'time change', 'timezone*', 'time-zone change*', 'timezone change*', 'different time zone', 'changing time zones', 'crossing time zones', 'long flight', 'long haul flight', 'overnight flight', 'international flight', 'flew in from europe', 'flew in from asia', 'flew back from', 'flying to europe', 'flying to asia', 'just landed', 'back from overseas', 'traveling overseas', 'travelling overseas', 'trip overseas', 'body clock', 'internal clock', 'circadian rhythm*', 'circadian', 'daylight saving*', 'daylight savings time', 'clocks change', 'clocks went back', 'clocks went forward')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }

  // ---- Shift work and messed-up sleep schedules ----
  if (has(t, 'night shift*', 'nightshift*', 'night-shift', 'shift work', 'shift worker', 'shiftwork', 'graveyard shift', 'overnight shift*', 'third shift', '3rd shift', 'rotating shift*', 'work nights', 'working nights', 'work overnight', 'working overnight', 'sleep during the day', 'sleeping during the day', 'sleep in the day', 'day sleep', 'sleep schedule', 'sleeping schedule', 'sleep cycle', 'sleep routine', 'sleep pattern*', 'sleeping pattern*', 'sleep is messed up', 'sleep is off', 'sleep is all over the place', 'messed up sleep', 'sleep schedule is messed up', 'reset my sleep', 'fix my sleep', 'fix my sleep schedule', 'reset sleep schedule', 'flipped sleep', 'nocturnal', 'night owl', 'stayed up too late', 'stay up too late', 'all nighter', 'all-nighter', 'allnighter')) {
    picks.add(4, P.melatonin, P.melatoninCvs);
  }

  // ---- Generic sleep words (very generic, weight 1; restless legs needs a doctor) ----
  if (!has(t, 'restless leg*', 'rls') && has(t, 'sleep', 'asleep', 'sleeping', 'slept', 'sleepiness', 'tired but awake', 'restless', 'restlessness')) {
    picks.add(1, P.melatonin, P.melatoninCvs);
  }

  // ---- Heart-health aspirin (the low-dose product is asked for by name) ----
  if (has(t, 'low dose aspirin', 'low-dose aspirin', 'lowdose aspirin', 'low strength aspirin', 'low dose asprin', 'low dose aspirine', 'low dose asperin', 'low dose aspiran', 'low dose aspirn', 'low dose aspin', 'low dose aspririn', 'low-dose asprin', 'lo dose aspirin', 'low dosage aspirin', 'low dose 81', 'baby aspirin', 'baby asprin', 'baby aspirine', 'baby asperin', 'baby aspiran', 'baby aspirn', 'baby aspririn', 'babyaspirin', 'baby aspirins', 'aspirin 81', 'aspirin 81mg', 'aspirin 81 mg', 'asprin 81', 'asprin 81mg', 'aspirine 81', 'asperin 81', 'aspirn 81', 'aspririn 81', '81 aspirin', '81mg aspirin', '81 mg aspirin', '81 asprin', '81mg asprin', '81 mg asprin', '81 mg', '81mg', '81 milligram*', 'eighty one mg', 'daily aspirin', 'daily asprin', 'aspirin a day', 'asprin a day', 'an aspirin a day', 'aspirin every day', 'aspirin regimen', 'aspirin therapy', 'aspirin for my heart', 'aspirin for heart', 'aspirin for the heart', 'heart aspirin', 'heart asprin', 'heart health aspirin', 'heart healthy aspirin', 'cardio aspirin', 'aspirin for blood thinning', 'chewable aspirin', 'chewable asprin', 'enteric coated aspirin', 'ec aspirin', 'safety coated aspirin', 'mini aspirin', 'small aspirin', 'regimen aspirin', 'low dose')) {
    picks.add(5, P.aspirin81);
  }
}
