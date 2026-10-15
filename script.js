/* ReadySafe — script.js
   Vanilla JavaScript. All user data stays in this browser (localStorage).
   Sections: helpers, storage, data, views, router, init. */
(function () {
'use strict';

/* ---------- Helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);

// Safe DOM builder: text is always added with createTextNode (no innerHTML).
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === false || v == null) continue;
    if (k === 'class') e.className = v;
    else if (k === 'checked') e.checked = !!v;
    else if (k === 'value') e.value = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  kids.flat(Infinity).forEach(c => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c))); });
  return e;
}
const head = (t, s) => h('div', { class: 'head' }, h('h1', { tabindex: '-1' }, t), s ? h('p', { class: 'muted' }, s) : null);
const note = (t, kind) => h('p', { class: 'note ' + (kind || '') }, t);
const card = (...k) => h('div', { class: 'card' }, ...k);
const bar = p => h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(p), 'aria-label': 'Progress' }, h('span', { style: 'width:' + p + '%' }));
const field = (id, label, el) => { el.id = id; return h('div', { class: 'field' }, h('label', { for: id }, label), el); };
const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

let toastTimer;
function toast(msg, isErr) {
  const t = $('#toast'); t.textContent = msg; t.className = 'show' + (isErr ? ' err' : '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.className = ''; }, 3500);
}
function confirmBox(title, msg, okText) {
  return new Promise(res => {
    const d = $('#dlg');
    if (!d || typeof d.showModal !== 'function') { res(window.confirm(msg)); return; }
    $('#dlgT').textContent = title; $('#dlgM').textContent = msg; $('#dlgOk').textContent = okText || 'Confirm';
    d.returnValue = '';
    d.addEventListener('close', () => res(d.returnValue === 'ok'), { once: true });
    d.showModal();
  });
}

/* ---------- Storage (localStorage with safe fallback) ---------- */
const PFX = 'readysafe:';
const KEYS = ['checks', 'custom', 'contacts', 'plan', 'docs', 'theme'];
let canStore = true; const mem = {};
try { localStorage.setItem(PFX + 't', '1'); localStorage.removeItem(PFX + 't'); } catch (e) { canStore = false; }
const store = {
  get(k, fb, ok) {
    try {
      const raw = canStore ? localStorage.getItem(PFX + k) : mem[k];
      if (raw == null) return fb;
      const v = JSON.parse(raw); return ok(v) ? v : fb;
    } catch (e) { return fb; }
  },
  set(k, v) {
    const s = JSON.stringify(v);
    if (!canStore) { mem[k] = s; toast('Browser storage is unavailable. Changes last only until you close this page.', true); return true; }
    try { localStorage.setItem(PFX + k, s); return true; }
    catch (e) { toast('Could not save. Browser storage may be full or blocked.', true); return false; }
  },
  hasAny() { return KEYS.some(k => { try { return (canStore ? localStorage.getItem(PFX + k) : mem[k]) != null; } catch (e) { return false; } }); },
  remove(k) { delete mem[k]; try { localStorage.removeItem(PFX + k); } catch (e) { /* ignore */ } },
  clear() { KEYS.forEach(k => { delete mem[k]; try { localStorage.removeItem(PFX + k); } catch (e) { /* ignore */ } }); }
};

/* ---------- Data ---------- */
const CHECKLIST = [
  { cat: 'Water & Food', items: [
    ['water', 'Drinking water (plan for at least 3 days)'],
    ['food', 'Non-perishable food'],
    ['opener', 'Manual can opener and eating utensils']] },
  { cat: 'Health & Safety', items: [
    ['firstaid', 'First-aid supplies'],
    ['meds', 'Necessary personal medications'],
    ['whistle', 'Whistle (to signal for help)'],
    ['hygiene', 'Hygiene supplies (soap, masks, toiletries)']] },
  { cat: 'Tools & Power', items: [
    ['flash', 'Flashlight'],
    ['batt', 'Extra batteries'],
    ['power', 'Power bank'],
    ['radio', 'Battery-powered radio']] },
  { cat: 'Clothing & Shelter', items: [
    ['clothes', 'Extra clothing'],
    ['blanket', 'Blankets']] },
  { cat: 'Documents & Money', items: [
    ['docs', 'Important documents stored securely (waterproof container)'],
    ['cash', 'Cash in small bills'],
    ['contactlist', 'Written emergency contact information']] }
];
const BUILTIN_IDS = CHECKLIST.flatMap(g => g.items.map(i => i[0]));

const GUIDES = [
  { id: 'typhoon', icon: '🌀', t: 'Typhoon & Severe Weather',
    sum: 'Typhoons bring strong winds, heavy rain, storm surge and flooding. The Philippines is affected by them regularly.',
    b: ['Follow official advisories from PAGASA and your local government.', 'Secure or bring in loose outdoor objects and check your roof and windows.', 'Charge phones and power banks, prepare your kit and know your evacuation route.'],
    d: ['Stay indoors, away from windows, in a sturdy part of the building.', 'Do not go outside during a temporary calm; strong winds can return.', 'If water enters your home, stay away from electrical outlets and appliances.'],
    a: ['Wait for officials to say it is safe before going out.', 'Stay away from fallen power lines, damaged buildings and floodwater.', 'Check on neighbors only if it is safe to do so.'],
    r: ['Act on local warnings early; do not wait for conditions to worsen.', 'Never cross flooded roads or rivers.'],
    e: 'Evacuate if local authorities order it, if you live in a flood, landslide or storm-surge prone area and warnings are issued, or if your home is unsafe. Call your local emergency number for life-threatening situations.' },
  { id: 'flood', icon: '🌊', t: 'Flood',
    sum: 'Floods happen when water rises over normal levels from heavy rain, overflowing rivers or storm surge. They can rise quickly.',
    b: ['Learn whether your area is flood-prone and where your evacuation center is.', 'Keep your kit and important documents ready in a waterproof container.', 'Move valuables to higher places when warnings are issued.'],
    d: ['Move to higher ground early if advised or if water is rising.', 'Do not walk, swim or drive through floodwater.', 'If it is safe and officials advise it, switch off the main power before water enters.'],
    a: ['Return home only when authorities say it is safe.', 'Avoid contact with floodwater; it may be contaminated. Wash hands thoroughly.', 'Have electrical systems checked before using them again.'],
    r: ['Floodwater can hide holes, debris and strong currents.', 'Do not touch electrical equipment while wet or standing in water.'],
    e: 'Evacuate when ordered, when water is rising toward your home, or if you are on the ground floor of a flood-prone area under warning. Call for help if people are trapped.' },
  { id: 'earthquake', icon: '🏚️', t: 'Earthquake',
    sum: 'Earthquakes cause sudden ground shaking without warning and may be followed by aftershocks, fires, landslides or tsunami.',
    b: ['Secure heavy furniture and shelves; keep heavy items low.', 'Identify safe spots (sturdy table) and exits at home, school and work.', 'Practice drop, cover and hold on with your household.'],
    d: ['Drop to the ground, take cover under a sturdy table, and hold on.', 'Stay away from windows, glass and heavy objects that may fall.', 'If outdoors, move to an open area away from buildings, poles and wires.'],
    a: ['Expect aftershocks and be ready to drop, cover and hold on again.', 'Check yourself and others for injuries; give first aid if trained.', 'If you smell gas or see damage, leave the building and report it to authorities.'],
    r: ['Do not use elevators during or right after strong shaking.', 'Do not re-enter damaged buildings.'],
    e: 'Evacuate if the building is damaged, there is fire or a gas leak, or officials advise it. If you are near the coast and shaking is strong or long, move to higher ground right away.' },
  { id: 'fire', icon: '🔥', t: 'Fire',
    sum: 'Fires spread fast and smoke is often the greatest danger. Early escape matters more than property.',
    b: ['Know two ways out of every room and agree on a meeting place.', 'Keep exits clear; install smoke alarms where appropriate and test them.', 'Store matches, lighters and flammable items safely away from children.'],
    d: ['Get out immediately and stay out. Alert others as you leave.', 'Stay low under smoke and feel doors before opening; do not open a hot door.', 'If clothing catches fire: stop, drop and roll.'],
    a: ['Do not go back inside for belongings.', 'Wait for fire officials to say it is safe to re-enter.', 'Seek medical care for burns or smoke inhalation.'],
    r: ['Call fire and rescue services from a safe place.', 'Never use elevators in a building fire.'],
    e: 'Always evacuate a burning building at once. Do not try to fight a fire that is spreading or blocking your exit.' },
  { id: 'landslide', icon: '⛰️', t: 'Landslide',
    sum: 'Landslides are movements of soil, rock or debris down a slope, often triggered by heavy rain or earthquakes.',
    b: ['Find out if you live near steep slopes or past landslide areas.', 'Learn warning signs: new cracks, tilting trees or poles, muddy water, unusual rumbling.', 'Know your evacuation route and leave early during prolonged heavy rain advisories.'],
    d: ['Move away from the slide path to a safer, stable area.', 'Listen for unusual sounds such as cracking or rumbling.', 'Do not stay near slopes, rivers or streams during heavy rain warnings.'],
    a: ['Stay away from the slide area; more slides may follow.', 'Report broken utilities and blocked roads to authorities.', 'Do not return until officials declare the area safe.'],
    r: ['Landslides can happen with very little warning.', 'Do not wait to see a slide before leaving a high-risk area.'],
    e: 'Evacuate promptly when authorities advise it, when you see warning signs, or during intense rain if you live below or on a steep slope.' },
  { id: 'tsunami', icon: '🌅', t: 'Tsunami',
    sum: 'Tsunamis are series of powerful waves, usually caused by undersea earthquakes. They can reach shore within minutes.',
    b: ['Know if you live or work in a coastal hazard zone.', 'Learn the nearest high ground and the way to reach it on foot.', 'Know the natural warnings: strong or long shaking, sudden sea withdrawal, loud ocean roar.'],
    d: ['If you feel strong or long shaking near the coast, move to high ground or inland immediately.', 'Do not wait for an official warning if natural signs appear.', 'Never go to the shore to watch the waves.'],
    a: ['Stay on high ground until officials give the all-clear; waves may continue for hours.', 'Stay away from damaged coastal areas.', 'Check for injuries and listen to official updates.'],
    r: ['The first wave may not be the largest.', 'Move on foot if roads may be jammed.'],
    e: 'Evacuate immediately from coastal areas after strong shaking or a tsunami warning, and follow official evacuation routes.' },
  { id: 'general', icon: '🧰', t: 'General Emergency Preparedness',
    sum: 'Preparing before a disaster helps your household stay safer and recover faster, whatever the hazard.',
    b: ['Prepare an emergency kit (see the Checklist) and review it regularly.', 'Make a household plan with meeting places and a contact person.', 'Learn your local hazards, alert sources and evacuation centers.'],
    d: ['Stay calm and follow instructions from local authorities.', 'Check on household members and use your plan.', 'Use text messages when phone lines are busy.'],
    a: ['Check for injuries and hazards before moving around.', 'Update your plan and restock your kit.', 'Take care of your mental wellbeing and support others.'],
    r: ['Local authorities may give different instructions than general guides; always follow them.', 'Consider basic first-aid and disaster training from accredited groups.'],
    e: 'Evacuate whenever officials order it or you feel unsafe. Call your local emergency number for injuries, fire or people in danger.' }
];

const QUIZ = [
  ['Strong shaking starts while you are inside a building. What should you do first?', ['Run to the nearest elevator', 'Drop, cover under a sturdy table, and hold on', 'Stand in a doorway near the window', 'Run outside immediately'], 1, 'Drop, cover and hold on protects you from falling objects. Elevators and windows are dangerous.'],
  ['Why should you avoid walking through floodwater?', ['It is always shallow', 'It may hide hazards, carry strong currents and be contaminated', 'It is only dangerous at night', 'It is safe if you wear boots'], 1, 'Floodwater can hide holes and debris, knock you off your feet, and carry germs or chemicals.'],
  ['During a typhoon the wind suddenly becomes calm. What is the safest action?', ['Go outside to check damage', 'Stay sheltered until authorities say it is safe', 'Open all windows', 'Start travelling'], 1, 'A calm period may be the eye of the storm; strong winds can return quickly.'],
  ['Which item is most useful for signaling for help if you are trapped?', ['Whistle', 'Blanket', 'Extra clothing', 'Can opener'], 0, 'A whistle carries farther and needs less energy than shouting.'],
  ['In a smoky room during a fire, you should:', ['Stand up and run', 'Stay low and move to the exit', 'Hide in a closet', 'Open windows and wait'], 1, 'Smoke rises, so the air is cleaner near the floor.'],
  ['Authorities order evacuation for your area. What should you do?', ['Wait to see if it gets worse', 'Leave promptly using the advised route', 'Finish all chores first', 'Ask neighbors to decide'], 1, 'Official orders exist because danger is expected. Delay can put you at risk.'],
  ['You feel strong, long shaking while at the beach. What should you do?', ['Wait for a text alert', 'Go toward the water to look', 'Move to high ground or inland immediately', 'Stay in your car at the shore'], 2, 'Strong or long shaking near the coast is a natural tsunami warning; do not wait for an official alert.'],
  ['Which is a warning sign of a possible landslide?', ['New cracks in the ground and tilting trees', 'Clear blue skies', 'Dry weather only', 'A quiet neighborhood'], 0, 'Cracks, tilting trees or poles, and muddy water can indicate unstable slopes.'],
  ['An emergency kit should be planned to last at least:', ['One hour', 'Half a day', 'About 3 days', 'One year'], 2, 'Help may take time to reach you, so a minimum of about 3 days of supplies is commonly advised.'],
  ['How should important documents be stored for emergencies?', ['Loose in a drawer', 'In a waterproof container that is easy to grab', 'Posted online publicly', 'Left in the car'], 1, 'A waterproof, accessible container protects documents from water and keeps them available.'],
  ['After a strong earthquake, what should you expect?', ['No further shaking', 'Aftershocks', 'Guaranteed power restoration', 'Immediate all-clear'], 1, 'Aftershocks are common. Be ready to drop, cover and hold on again.'],
  ['A door feels hot during a fire. What should you do?', ['Open it quickly', 'Do not open it; use another exit', 'Break all windows at once', 'Wait beside it'], 1, 'A hot door suggests fire on the other side. Choose another way out.'],
  ['Why is a battery-powered radio useful in a disaster?', ['Entertainment only', 'It can receive official updates when power or internet fails', 'It replaces a first-aid kit', 'It charges your house'], 1, 'Power and mobile networks may fail, but radio can still deliver official information.'],
  ['What should a household emergency plan include?', ['Only one meeting place', 'A primary and an alternative meeting place', 'No contact person', 'Only phone numbers online'], 1, 'If the primary place is unsafe or unreachable, an alternative keeps everyone able to regroup.'],
  ['Which number is the commonly used national emergency hotline in the Philippines?', ['911', '123', '555', '000'], 0, '911 is the national emergency hotline. Always verify current local arrangements.'],
  ['You see a fallen power line after a storm. What should you do?', ['Move it with a stick', 'Stay away and report it to authorities', 'Walk through the puddle near it', 'Take a photo from close by'], 1, 'Downed lines may be live. Keep a safe distance and report them.']
];

const CONTACT_CATS = ['Barangay / local government', 'Police', 'Fire and rescue', 'Ambulance / medical assistance', 'Nearby hospital', 'Family emergency contact', 'Other'];

const DOCS = [
  ['id', 'Identification documents', 'Photocopies of IDs and records that prove who you are.', 'Keep copies in a waterproof pouch. Do not type ID numbers into this app.'],
  ['medical', 'Medical information', 'A list of conditions, allergies, and prescriptions, plus doctor contacts.', 'Keep it written and in your kit. Do not store medical details in this app.'],
  ['insurance', 'Insurance information', 'Policy names and the contact details of providers.', 'Note the provider and how to reach them. Do not store policy or account numbers here.'],
  ['household', 'Important household records', 'Property records, school records, and other documents hard to replace.', 'Consider a secure, accessible spot and keep a trusted person informed where they are.'],
  ['contacts', 'Emergency contact information', 'A printed list of family, neighbors, and local emergency numbers.', 'Phones can die. Keep a paper copy in your kit and wallet.']
];

const TIPS = [
  'Agree on a family meeting place before an emergency happens.',
  'Charge your phone and power bank when a storm is forecast.',
  'Learn your area\'s hazards and the location of your evacuation center.',
  'Follow instructions from local authorities and leave early when told to.',
  'Review and refresh your emergency kit every few months.'
];

const VIEWS = [
  ['home', 'Home', '🏠', 'Your preparedness overview.'],
  ['checklist', 'Preparedness Checklist', '✅', 'Build and track your emergency kit.'],
  ['guides', 'Safety Guides', '📘', 'Before, during, and after each hazard.'],
  ['contacts', 'Emergency Contacts', '📞', 'Keep important numbers within reach.'],
  ['planner', 'Action Planner', '🗺️', 'Create your household emergency plan.'],
  ['quiz', 'Preparedness Quiz', '🧠', 'Test what you know.'],
  ['documents', 'Documents Checklist', '📁', 'Organize essential documents.'],
  ['settings', 'Settings', '⚙️', 'Theme, data, and about.']
];

/* ---------- State accessors ---------- */
const getChecks = () => store.get('checks', {}, isObj);
const getCustom = () => store.get('custom', [], v => Array.isArray(v) && v.every(i => i && typeof i.id === 'string' && typeof i.text === 'string')).slice(0, 50);
const getContacts = () => store.get('contacts', [], v => Array.isArray(v) && v.every(c => c && ['id', 'name', 'phone', 'cat', 'notes'].every(k => typeof c[k] === 'string'))).slice(0, 100);
const PLAN_FIELDS = [
  ['name', 'Household or plan name', 'input', true], ['members', 'People to account for (first names or roles are enough)', 'textarea'],
  ['meet1', 'Primary meeting place', 'input', true], ['meet2', 'Alternative meeting place', 'input'],
  ['contact', 'Emergency contact person', 'input', true], ['evac', 'Evacuation considerations', 'textarea'],
  ['comms', 'Basic communication plan', 'textarea'], ['notes', 'Important notes', 'textarea']
];
const getPlan = () => store.get('plan', null, v => isObj(v) && PLAN_FIELDS.every(f => typeof v[f[0]] === 'string'));
const getDocs = () => store.get('docs', {}, isObj);

function checkStats() {
  const c = getChecks(); const ids = BUILTIN_IDS.concat(getCustom().map(i => i.id));
  const done = ids.filter(i => c[i] === true).length;
  return { total: ids.length, done, pct: ids.length ? Math.round(done / ids.length * 100) : 0 };
}
function phoneHref(p) {
  const s = (p || '').trim();
  if (!/^\+?[\d\s\-()]+$/.test(s)) return null;
  const d = s.replace(/[^\d+]/g, ''); const n = d.replace('+', '');
  return n.length >= 3 && n.length <= 15 ? 'tel:' + d : null;
}
const callLink = p => { const href = phoneHref(p); return href ? h('a', { class: 'btn small', href, 'aria-label': 'Call ' + p }, '📞 Call ' + p) : null; };

/* ---------- Home ---------- */
function renderHome(root) {
  const st = checkStats(), docs = getDocs(), contacts = getContacts(), plan = getPlan();
  const docsDone = DOCS.filter(d => docs[d[0]] === true).length;
  root.append(
    h('section', { class: 'hero' },
      h('h1', { tabindex: '-1' }, 'Welcome to ReadySafe'),
      h('p', {}, 'Prepare your household for typhoons, floods, earthquakes and other emergencies with checklists, guides, a plan and a quiz.'),
      h('a', { class: 'btn red', href: '#checklist' }, 'Continue your checklist')),
    note('Important: ReadySafe is educational only. It does not contact emergency responders, send alerts, or show live weather. In an emergency, call 911 or your local emergency number and follow local authorities.', 'alert'),
    h('div', { class: 'grid' },
      card(h('p', { class: 'muted' }, 'Checklist progress'), h('div', { class: 'big' }, st.pct + '%'), bar(st.pct), h('small', {}, `${st.done} of ${st.total} items ready`)),
      card(h('p', { class: 'muted' }, 'Documents prepared'), h('div', { class: 'big' }, `${docsDone}/${DOCS.length}`), h('small', {}, 'categories marked prepared')),
      card(h('p', { class: 'muted' }, 'Your saved contacts'), h('div', { class: 'big' }, String(contacts.length)), h('small', {}, 'entered by you')),
      card(h('p', { class: 'muted' }, 'Action plan'), h('div', { class: 'big' }, plan ? 'Created' : 'Not yet'), h('small', {}, plan ? plan.name : 'Make one in the planner'))),
    h('h2', {}, 'Quick access'),
    h('div', { class: 'grid' }, VIEWS.slice(1, 7).map(v => h('a', { class: 'card tile', href: '#' + v[0] }, h('div', { class: 'ico', 'aria-hidden': 'true' }, v[2]), h('h3', {}, v[1]), h('small', { class: 'muted' }, v[3])))),
    card(h('h2', {}, 'Emergency contacts quick access'),
      h('div', { class: 'row' }, h('a', { class: 'btn red', href: 'tel:911' }, '📞 Call 911'), h('span', { class: 'badge warn' }, 'Verify local arrangements')),
      contacts.length ? h('div', { class: 'row', style: 'margin-top:.75rem' }, contacts.filter(c => phoneHref(c.phone)).slice(0, 3).map(c => h('a', { class: 'btn ghost small', href: phoneHref(c.phone) }, '📞 ' + c.name))) : h('p', { class: 'muted', style: 'margin-top:.75rem' }, 'You have not saved any contacts yet.'),
      h('p', {}, h('a', { href: '#contacts' }, 'Manage contacts'))),
    card(h('h2', {}, 'Disaster safety tips'), h('ul', {}, TIPS.map(t => h('li', {}, t))))
  );
}

/* ---------- Checklist ---------- */
function toggleCheck(id, on) { const c = getChecks(); if (on) c[id] = true; else delete c[id]; store.set('checks', c); renderCurrent(); }
function checkGroup(title, items, removable) {
  const c = getChecks();
  return card(h('h3', {}, title), h('ul', { class: 'checks' }, items.map(it => {
    const id = 'chk-' + it.id;
    return h('li', {},
      h('label', { for: id }, h('input', { type: 'checkbox', id, checked: c[it.id] === true, onchange: ev => toggleCheck(it.id, ev.target.checked) }), h('span', { class: c[it.id] ? 'done' : '' }, it.text)),
      removable ? h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Remove ' + it.text, onclick: () => removeCustom(it.id) }, 'Remove') : null);
  })));
}
function removeCustom(id) {
  store.set('custom', getCustom().filter(i => i.id !== id));
  const c = getChecks(); delete c[id]; store.set('checks', c);
  toast('Custom item removed.'); renderCurrent();
}
async function resetChecks() {
  if (!Object.keys(getChecks()).length) { toast('Nothing is checked yet.'); return; }
  if (await confirmBox('Reset checklist?', 'This unchecks every item. Your custom items stay in the list.', 'Reset')) { store.set('checks', {}); toast('Checklist reset.'); renderCurrent(); }
}
function renderChecklist(root) {
  const st = checkStats(), custom = getCustom();
  root.append(head('Preparedness Checklist', 'Build your emergency kit step by step.'),
    note('This is general guidance. Adapt it to your household and to official local recommendations. Never delay evacuation to finish a checklist.', 'warn'),
    card(h('div', { class: 'row between' }, h('strong', {}, `${st.done} completed · ${st.total - st.done} remaining`), h('span', { class: 'badge ' + (st.pct === 100 ? 'ok' : '') }, st.pct + '%')), bar(st.pct),
      h('button', { class: 'btn ghost small', type: 'button', onclick: resetChecks }, 'Reset checklist')));
  CHECKLIST.forEach(g => root.append(checkGroup(g.cat, g.items.map(([id, text]) => ({ id, text })), false)));
  const err = h('p', { class: 'err', role: 'alert' });
  const input = h('input', { type: 'text', maxlength: '80', autocomplete: 'off' });
  const form = h('form', { novalidate: true, onsubmit: ev => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) { err.textContent = 'Please type an item name.'; input.focus(); return; }
    if (custom.length >= 30) { err.textContent = 'You can add up to 30 custom items.'; return; }
    if (custom.some(i => i.text.toLowerCase() === text.toLowerCase())) { err.textContent = 'That item is already in your list.'; return; }
    if (store.set('custom', custom.concat({ id: 'c' + uid(), text }))) { toast('Item added.'); renderCurrent(); }
  } }, field('customText', 'Add a custom item', input), err, h('button', { class: 'btn', type: 'submit' }, 'Add item'));
  root.append(card(h('h3', {}, 'My custom items'), form));
  root.append(custom.length ? checkGroup('Your custom items', custom, true) : h('div', { class: 'empty' }, 'No custom items yet. Add things your household needs, such as baby supplies or pet food.'));
}

/* ---------- Guides ---------- */
const gState = { q: '', cat: 'all' };
function drawGuides(list) {
  const q = gState.q.toLowerCase();
  const found = GUIDES.filter(g => (gState.cat === 'all' || g.id === gState.cat) && [g.t, g.sum, g.e].concat(g.b, g.d, g.a, g.r).join(' ').toLowerCase().includes(q));
  list.replaceChildren();
  if (!found.length) {
    list.append(h('div', { class: 'empty' }, h('p', {}, 'No guides match your search.'), h('button', { class: 'btn ghost small', type: 'button', onclick: () => { gState.q = ''; gState.cat = 'all'; renderCurrent(); } }, 'Clear filters')));
    return;
  }
  found.forEach(g => list.append(card(h('h3', {}, g.icon + ' ' + g.t), h('p', {}, g.sum), h('a', { class: 'btn small', href: '#guides/' + g.id }, 'Read guide'))));
}
function renderGuides(root, sub) {
  const g = GUIDES.find(x => x.id === sub);
  if (g) {
    const sec = (title, arr) => card(h('h2', {}, title), h('ul', {}, arr.map(x => h('li', {}, x))));
    root.append(h('p', {}, h('a', { href: '#guides' }, '← All guides')), head(g.icon + ' ' + g.t, g.sum),
      sec('Before', g.b), sec('During', g.d), sec('After', g.a), sec('Safety reminders', g.r),
      note('When to evacuate or seek help: ' + g.e, 'alert'),
      note('Always follow instructions from local authorities and emergency responders. They may differ from this general guide.', 'warn'));
    return;
  }
  root.append(head('Safety Guides', 'Search or filter the disaster guides.'));
  const list = h('div');
  const search = h('input', { type: 'search', placeholder: 'Search guides…', value: gState.q, 'aria-label': 'Search guides', oninput: ev => { gState.q = ev.target.value; drawGuides(list); } });
  const sel = h('select', { 'aria-label': 'Filter by category', onchange: ev => { gState.cat = ev.target.value; drawGuides(list); } },
    h('option', { value: 'all' }, 'All categories'), GUIDES.map(x => h('option', { value: x.id }, x.t)));
  sel.value = gState.cat;
  root.append(h('div', { class: 'toolbar' }, search, sel), list, note('These guides are general, conservative advice and are not official instructions. Follow local authorities.', 'warn'));
  drawGuides(list);
}

/* ---------- Contacts ---------- */
const cState = { q: '', edit: null, cat: CONTACT_CATS[0] };
function drawContacts(list) {
  const q = cState.q.toLowerCase(), all = getContacts();
  list.replaceChildren();
  const match = c => [c.name, c.phone, c.cat, c.notes].join(' ').toLowerCase().includes(q);
  let shown = 0;
  CONTACT_CATS.forEach(cat => {
    const items = all.filter(c => c.cat === cat && match(c));
    if (q && !items.length) return;
    shown++;
    const box = card(h('h3', {}, cat));
    if (!items.length) box.append(h('p', { class: 'muted' }, 'No contact saved yet. Add the number for your area.'), h('button', { class: 'btn small', type: 'button', onclick: () => { cState.edit = 'new'; cState.cat = cat; renderCurrent(); } }, 'Add ' + cat));
    items.forEach(c => box.append(h('div', { class: 'contact' },
      h('div', {}, h('strong', {}, c.name), ' ', h('span', { class: 'badge warn' }, 'Your entry · not verified'), c.phone ? h('div', {}, c.phone) : null, c.notes ? h('div', { class: 'muted' }, c.notes) : null),
      h('div', { class: 'row' }, callLink(c.phone),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Edit ' + c.name, onclick: () => { cState.edit = c.id; renderCurrent(); } }, 'Edit'),
        h('button', { class: 'btn ghost small', type: 'button', 'aria-label': 'Delete ' + c.name, onclick: () => deleteContact(c) }, 'Delete')))));
    list.append(box);
  });
  if (!shown) list.append(h('div', { class: 'empty' }, 'No contacts match your search.'));
}
async function deleteContact(c) {
  if (await confirmBox('Delete contact?', `Delete "${c.name}" from this browser?`, 'Delete')) { store.set('contacts', getContacts().filter(x => x.id !== c.id)); toast('Contact deleted.'); renderCurrent(); }
}
function contactForm() {
  const existing = cState.edit !== 'new' ? getContacts().find(c => c.id === cState.edit) : null;
  const err = h('p', { class: 'err', role: 'alert' });
  const name = h('input', { type: 'text', maxlength: '60', value: existing ? existing.name : '' });
  const phone = h('input', { type: 'tel', maxlength: '25', inputmode: 'tel', value: existing ? existing.phone : '' });
  const cat = h('select', {}, CONTACT_CATS.map(c => h('option', { value: c }, c)));
  cat.value = existing ? existing.cat : cState.cat;
  const notes = h('input', { type: 'text', maxlength: '120', value: existing ? existing.notes : '' });
  return card(h('h3', {}, existing ? 'Edit contact' : 'Add contact'),
    h('form', { novalidate: true, onsubmit: ev => {
      ev.preventDefault();
      const n = name.value.trim(), p = phone.value.trim();
      if (!n) { err.textContent = 'Please enter a name.'; name.focus(); return; }
      if (p && !phoneHref(p)) { err.textContent = 'Phone numbers may contain digits, spaces, +, - and parentheses (3 to 15 digits).'; phone.focus(); return; }
      const rec = { id: existing ? existing.id : 'k' + uid(), name: n, phone: p, cat: cat.value, notes: notes.value.trim() };
      const list = getContacts();
      const next = existing ? list.map(c => c.id === rec.id ? rec : c) : list.concat(rec);
      if (store.set('contacts', next)) { cState.edit = null; toast('Contact saved on this device.'); renderCurrent(); }
    } },
      field('cName', 'Name (required)', name), field('cPhone', 'Phone number', phone), field('cCat', 'Category', cat), field('cNotes', 'Notes (optional)', notes), err,
      h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Save contact'), h('button', { class: 'btn ghost', type: 'button', onclick: () => { cState.edit = null; renderCurrent(); } }, 'Cancel'))));
}
function renderContacts(root) {
  root.append(head('Emergency Contacts', 'General emergency information and your own local numbers.'),
    card(h('h3', {}, 'National emergency hotline (Philippines)'), h('span', { class: 'badge ok' }, 'General information'),
      h('p', {}, 'The commonly used national emergency hotline is 911. Service availability and local arrangements can vary by area.'),
      h('a', { class: 'btn red', href: 'tel:911' }, '📞 Call 911')),
    note('Verify local numbers and their availability yourself. Contacts below are entered by you and are not verified by ReadySafe. ReadySafe does not place calls for you.', 'warn'));
  const list = h('div');
  const search = h('input', { type: 'search', placeholder: 'Search contacts…', value: cState.q, 'aria-label': 'Search contacts', oninput: ev => { cState.q = ev.target.value; drawContacts(list); } });
  root.append(h('div', { class: 'toolbar' }, search, h('button', { class: 'btn', type: 'button', onclick: () => { cState.edit = 'new'; renderCurrent(); } }, '+ Add contact')));
  if (cState.edit) root.append(contactForm());
  root.append(list); drawContacts(list);
}

/* ---------- Planner ---------- */
let planEdit = false;
function renderPlanner(root) {
  const plan = getPlan();
  root.append(head('Emergency Action Planner', 'Agree on a plan before an emergency happens.'),
    note('Do not enter unnecessary sensitive information (ID numbers, passwords, bank details). Your plan stays in this browser only.', 'warn'));
  if (plan && !planEdit) {
    root.append(card(h('div', { id: 'planSummary' }, h('h2', {}, plan.name), h('dl', {}, PLAN_FIELDS.slice(1).filter(f => plan[f[0]]).map(f => [h('dt', {}, f[1]), h('dd', {}, plan[f[0]])]))),
      h('div', { class: 'row no-print', style: 'margin-top:1rem' },
        h('button', { class: 'btn', type: 'button', onclick: () => window.print() }, '🖨️ Print plan'),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => { planEdit = true; renderCurrent(); } }, 'Edit'),
        h('button', { class: 'btn ghost', type: 'button', onclick: deletePlan }, 'Delete plan'))));
    return;
  }
  const els = {}, err = h('p', { class: 'err', role: 'alert' });
  const form = h('form', { novalidate: true, onsubmit: ev => {
    ev.preventDefault();
    const data = {}; PLAN_FIELDS.forEach(f => { data[f[0]] = els[f[0]].value.trim(); });
    const missing = PLAN_FIELDS.filter(f => f[3] && !data[f[0]]);
    if (missing.length) { err.textContent = 'Please fill in: ' + missing.map(f => f[1]).join(', ') + '.'; els[missing[0][0]].focus(); return; }
    if (store.set('plan', data)) { planEdit = false; toast('Plan saved on this device.'); renderCurrent(); }
  } });
  PLAN_FIELDS.forEach(f => {
    els[f[0]] = f[2] === 'textarea' ? h('textarea', { maxlength: '400' }) : h('input', { type: 'text', maxlength: '120' });
    els[f[0]].value = plan ? plan[f[0]] : '';
    form.append(field('p-' + f[0], f[1] + (f[3] ? ' (required)' : ''), els[f[0]]));
  });
  form.append(err, h('div', { class: 'row' }, h('button', { class: 'btn', type: 'submit' }, 'Save plan'),
    plan ? h('button', { class: 'btn ghost', type: 'button', onclick: () => { planEdit = false; renderCurrent(); } }, 'Cancel') : null));
  root.append(card(h('h2', {}, plan ? 'Edit your plan' : 'Create your plan'), form));
}
async function deletePlan() {
  if (await confirmBox('Delete plan?', 'This removes your saved emergency action plan from this browser.', 'Delete')) { store.remove('plan'); planEdit = false; toast('Plan deleted.'); renderCurrent(); }
}

/* ---------- Quiz ---------- */
let quiz = null;
const newQuiz = () => ({ qs: shuffle(QUIZ.map(([q, o, c, e]) => ({ q, e, o: shuffle(o.map((t, i) => ({ t, ok: i === c }))) }))), i: 0, score: 0, sel: null, locked: false, res: [] });
function renderQuiz(root) {
  root.append(head('Preparedness Quiz', 'Test your emergency knowledge.'), note('This quiz is educational and does not replace official disaster safety training.', 'warn'));
  if (!quiz) {
    root.append(card(h('p', {}, `${QUIZ.length} multiple-choice questions on typhoons, floods, earthquakes, fire, emergency kits and evacuation. Question order and answer order are shuffled each time.`),
      h('button', { class: 'btn', type: 'button', onclick: () => { quiz = newQuiz(); renderCurrent(); } }, 'Start quiz')));
    return;
  }
  if (quiz.i >= quiz.qs.length) { quizResult(root); return; }
  const q = quiz.qs[quiz.i], err = h('p', { class: 'err', role: 'alert' });
  const fs = h('fieldset', { class: 'card' }, h('legend', {}, `Question ${quiz.i + 1} of ${quiz.qs.length}`), bar(Math.round(quiz.i / quiz.qs.length * 100)), h('p', { class: 'qtext' }, q.q));
  q.o.forEach((o, idx) => {
    const cls = 'opt' + (quiz.locked ? (o.ok ? ' good' : (quiz.sel === idx ? ' bad' : '')) : '');
    fs.append(h('label', { class: cls }, h('input', { type: 'radio', name: 'ans', checked: quiz.sel === idx, disabled: quiz.locked, onchange: () => { quiz.sel = idx; } }), h('span', {}, o.t)));
  });
  fs.append(err);
  if (quiz.locked) {
    const ok = q.o[quiz.sel].ok;
    fs.append(note((ok ? 'Correct. ' : 'Not quite. ') + q.e, ok ? '' : 'warn'),
      h('button', { class: 'btn', type: 'button', onclick: () => { quiz.i++; quiz.sel = null; quiz.locked = false; renderCurrent(); } }, quiz.i + 1 === quiz.qs.length ? 'See results' : 'Next question'));
  } else {
    fs.append(h('button', { class: 'btn', type: 'button', onclick: () => {
      if (quiz.sel == null) { err.textContent = 'Please choose an answer first.'; return; }
      const ok = q.o[quiz.sel].ok; if (ok) quiz.score++;
      quiz.res.push({ q: q.q, ok, e: q.e, ans: q.o[quiz.sel].t, right: q.o.find(x => x.ok).t });
      quiz.locked = true; renderCurrent();
    } }, 'Submit answer'));
  }
  root.append(fs);
}
function quizResult(root) {
  const total = quiz.qs.length, pct = Math.round(quiz.score / total * 100);
  const msg = pct >= 80 ? 'Great job! Keep reviewing and practicing.' : pct >= 50 ? 'Good start. Review the guides to strengthen your knowledge.' : 'Keep learning. The safety guides can help.';
  root.append(card(h('h2', {}, 'Your result'), h('div', { class: 'big' }, `${quiz.score} / ${total} (${pct}%)`), bar(pct), h('p', {}, msg),
    h('button', { class: 'btn', type: 'button', onclick: () => { quiz = newQuiz(); renderCurrent(); } }, 'Restart quiz')),
    h('h2', {}, 'Summary'),
    ...quiz.res.map((r, i) => card(h('span', { class: 'badge ' + (r.ok ? 'ok' : 'warn') }, r.ok ? 'Correct' : 'Incorrect'), h('p', { class: 'qtext' }, `${i + 1}. ${r.q}`),
      r.ok ? null : h('p', {}, 'Your answer: ' + r.ans), h('p', {}, 'Correct answer: ' + r.right), h('p', { class: 'muted' }, r.e))));
}

/* ---------- Documents ---------- */
function renderDocuments(root) {
  const docs = getDocs(), done = DOCS.filter(d => docs[d[0]] === true).length, pct = Math.round(done / DOCS.length * 100);
  root.append(head('Documents Checklist', 'Mark each category when you have it organized.'),
    note('Do not enter ID numbers, passwords, financial account details, or copies of documents here. Only your checked status is saved. Keep documents in a secure, waterproof place that you can reach quickly, and tell a trusted household member where they are.', 'warn'),
    card(h('strong', {}, `${done} of ${DOCS.length} prepared`), bar(pct)));
  DOCS.forEach(d => root.append(card(h('label', { class: 'row', for: 'doc-' + d[0], style: 'cursor:pointer' },
    h('input', { type: 'checkbox', id: 'doc-' + d[0], checked: docs[d[0]] === true, onchange: ev => { const c = getDocs(); if (ev.target.checked) c[d[0]] = true; else delete c[d[0]]; store.set('docs', c); renderCurrent(); } }),
    h('h3', { style: 'margin:0' }, d[1])), h('p', {}, d[2]), h('p', { class: 'muted' }, d[3]))));
}

/* ---------- Settings ---------- */
function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
const currentTheme = () => document.documentElement.getAttribute('data-theme') || 'light';
async function clearAll() {
  if (!store.hasAny()) { toast('There is no saved data to clear.'); return; }
  if (await confirmBox('Clear all saved data?', 'This permanently deletes your checklist progress, custom items, contacts, plan, document status and theme from this browser.', 'Clear data')) {
    store.clear(); applyTheme('light'); quiz = null; planEdit = false; cState.edit = null; toast('All saved data was cleared.'); renderCurrent();
  }
}
function renderSettings(root) {
  const dark = currentTheme() === 'dark';
  root.append(head('Settings', 'Appearance, saved data and about.'),
    card(h('h2', {}, 'Theme'), h('p', {}, 'Current theme: ' + (dark ? 'Dark' : 'Light')),
      h('button', { class: 'btn', type: 'button', onclick: () => { const t = dark ? 'light' : 'dark'; applyTheme(t); store.set('theme', t); renderCurrent(); } }, dark ? 'Switch to light theme' : 'Switch to dark theme')),
    card(h('h2', {}, 'Saved data'),
      h('p', {}, canStore ? 'Your information is stored only in this browser on this device. It is not synced to other devices and may be lost if you clear your browser data.' : 'Browser storage is unavailable, so changes will last only while this page stays open.'),
      h('button', { class: 'btn red', type: 'button', onclick: clearAll }, 'Clear saved data')),
    card(h('h2', {}, 'About ReadySafe'), h('p', {}, 'ReadySafe is a student-built educational web app for emergency preparedness, made with HTML, CSS and JavaScript. It is not an official emergency service, and it does not send alerts, contact responders, or show live information. Always follow local authorities.')));
}

/* ---------- Router ---------- */
let cur = { id: 'home', sub: '' };
function renderCurrent() {
  const v = VIEWS.find(x => x[0] === cur.id) || VIEWS[0];
  const main = $('#main'); main.replaceChildren();
  ({ home: renderHome, checklist: renderChecklist, guides: renderGuides, contacts: renderContacts, planner: renderPlanner, quiz: renderQuiz, documents: renderDocuments, settings: renderSettings })[v[0]](main, cur.sub);
  document.title = v[1] + ' — ReadySafe';
}
function closeMenu() { $('#nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded', 'false'); $('#menuBtn').setAttribute('aria-label', 'Open menu'); }
function route() {
  const parts = (location.hash || '#home').slice(1).split('/');
  const id = VIEWS.some(v => v[0] === parts[0]) ? parts[0] : 'home';
  cur = { id, sub: parts[1] || '' };
  planEdit = false; cState.edit = null;
  renderCurrent();
  $('#nav').querySelectorAll('a').forEach(a => { if (a.getAttribute('href') === '#' + id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  closeMenu(); window.scrollTo(0, 0);
  const h1 = $('#main h1'); if (h1) h1.focus({ preventScroll: true });
}

/* ---------- Init ---------- */
function init() {
  const saved = store.get('theme', null, v => v === 'light' || v === 'dark');
  applyTheme(saved || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  const nav = $('#nav');
  VIEWS.forEach(v => nav.append(h('a', { href: '#' + v[0] }, h('span', { 'aria-hidden': 'true' }, v[2]), v[1])));
  $('#menuBtn').addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    $('#menuBtn').setAttribute('aria-expanded', String(open)); $('#menuBtn').setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('hashchange', route);
  route();
}
init();
})();
