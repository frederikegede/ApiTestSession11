// The browser reaches the published backend port, outside Docker's network.
const BACKEND_URL = "http://10.136.138.88:3000";
const $ = (id) => document.getElementById(id);
const state = { people: [], loading: false, error: false };
const collator = new Intl.Collator('da', { sensitivity: 'base' });
const palettes = [['#edf2e5', '#617d45'], ['#e8edf6', '#667fa4'], ['#f6ece6', '#b2876e'], ['#eee9f5', '#8973a5']];

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}
function name(person) { return [person.firstName, person.lastName].filter(Boolean).join(' ') || person.username || 'Ukendt kontakt'; }
function avatar(person, index) {
  const initials = [person.firstName, person.lastName].filter(Boolean).map((part) => String(part).slice(0, 1)).join('') || '?';
  const node = element('span', 'avatar', initials.toUpperCase());
  const palette = palettes[index % palettes.length];
  node.style.setProperty('--avatar-bg', palette[0]);
  node.style.setProperty('--avatar-color', palette[1]);
  node.setAttribute('aria-hidden', 'true');
  return node;
}
function contactLink(value, type) {
  if (!value) return document.createTextNode('Ikke oplyst');
  const link = element('a', '', value);
  link.href = type === 'email' ? `mailto:${encodeURIComponent(value)}` : `tel:${String(value).replace(/[^+\d]/g, '')}`;
  return link;
}
function card(person, index) {
  const node = element('article', 'contact-card');
  const top = element('div', 'card-top');
  const heading = element('div');
  heading.append(element('h3', 'person-name', name(person)), element('p', 'role', person.company?.jobTitle || 'Stilling ikke oplyst'));
  top.append(avatar(person, index), heading);
  const company = element('p', 'card-company');
  company.append(element('span', '', '▥'), document.createTextNode(person.company?.name || 'Virksomhed ikke oplyst'));
  node.append(top, company);
  for (const [symbol, value, type] of [['✉', person.email, 'email'], ['↗', person.phone, 'phone']]) {
    const line = element('p', 'card-contact');
    line.append(element('span', '', symbol), contactLink(value, type));
    node.append(line);
  }
  const bottom = element('div', 'card-bottom');
  const button = element('button', 'detail-button', 'Se kontakt ↗');
  button.setAttribute('aria-label', `Se kontakt: ${name(person)}`);
  button.addEventListener('click', () => showDetail(person, index));
  bottom.append(element('span', 'country-chip', person.address?.country || 'Land ikke oplyst'), button);
  node.append(bottom);
  return node;
}
function showDetail(person, index) {
  const content = $('detail-content');
  const header = element('div', 'detail-header');
  const text = element('div');
  const title = element('h2', '', name(person));
  title.id = 'detail-name';
  text.append(title, element('p', 'role', person.company?.jobTitle || 'Stilling ikke oplyst'));
  header.append(avatar(person, index), text);
  content.replaceChildren(header);
  const address = person.address || {};
  const sections = [
    ['Kontaktoplysninger', [['Email', contactLink(person.email, 'email')], ['Telefon', contactLink(person.phone, 'phone')], ['Brugernavn', person.username]]],
    ['Arbejde', [['Virksomhed', person.company?.name], ['Stilling', person.company?.jobTitle]]],
    ['Adresse', [['Gade', address.street], ['By', [address.zipcode, address.city].filter(Boolean).join(' ')], ['Region', address.state], ['Land', address.country]]],
    ['Om kontakten', [['Alder', person.age != null ? `${person.age} år` : null], ['Fødselsdato', person.dateOfBirth], ['Kontakt-ID', person.id]]]
  ];
  for (const [label, rows] of sections) {
    const section = element('section', 'detail-section');
    const list = element('dl');
    for (const [key, value] of rows) {
      const description = element('dd');
      if (value instanceof Node) description.append(value);
      else description.textContent = value == null || value === '' ? 'Ikke oplyst' : String(value);
      list.append(element('dt', '', key), description);
    }
    section.append(element('h3', '', label), list);
    content.append(section);
  }
  $('detail').showModal();
}
function visiblePeople() {
  const query = $('search').value.trim().toLocaleLowerCase('da');
  const country = $('country').value;
  return state.people.filter((person) => {
    const haystack = [name(person), person.username, person.email, person.phone, person.company?.name, person.company?.jobTitle, person.address?.city, person.address?.country].filter(Boolean).join(' ').toLocaleLowerCase('da');
    return (!country || person.address?.country === country) && (!query || haystack.includes(query));
  }).sort((a, b) => {
    const sort = $('sort').value;
    if (sort === 'company') return collator.compare(a.company?.name || '', b.company?.name || '') || collator.compare(name(a), name(b));
    if (sort === 'country') return collator.compare(a.address?.country || '', b.address?.country || '') || collator.compare(name(a), name(b));
    return collator.compare(name(a), name(b)) * (sort === 'name-desc' ? -1 : 1);
  });
}
function render() {
  const people = visiblePeople();
  $('contacts').replaceChildren(...people.map((person) => card(person, state.people.indexOf(person))));
  $('result-count').textContent = `Viser ${people.length} af ${state.people.length} kontakter`;
  $('clear').hidden = !$('search').value && !$('country').value;
  $('status').classList.toggle('error', state.error);
  $('status').hidden = people.length > 0 && !state.error;
  if (state.error) $('status').textContent = `Kunne ikke hente kontakter. Prøv “Opdater data” igen.${state.people.length ? ' De tidligere hentede kontakter vises nedenfor.' : ''}`;
  else if (state.loading) $('status').textContent = 'Henter dit kontaktbibliotek…';
  else $('status').textContent = state.people.length ? 'Ingen kontakter matcher din søgning. Prøv et andet navn eller nulstil filtrene.' : 'Dit kontaktbibliotek er tomt.';
}
async function loadPeople() {
  state.loading = true;
  state.error = false;
  $('refresh').disabled = true;
  $('contacts').setAttribute('aria-busy', 'true');
  render();
  try {
    const response = await fetch(`${BACKEND_URL}/v1/notes`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data) || !data.every((item) => item && typeof item === 'object' && !Array.isArray(item))) throw new Error('Uventet dataformat');
    state.people = data;
    const countries = [...new Set(data.map((person) => person.address?.country).filter(Boolean))].sort(collator.compare);
    const selected = $('country').value;
    $('country').replaceChildren(new Option('Alle lande', ''), ...countries.map((country) => new Option(country, country)));
    $('country').value = countries.includes(selected) ? selected : '';
    $('total').textContent = $('nav-count').textContent = $('contact-count').textContent = data.length;
    $('countries').textContent = countries.length;
    $('companies').textContent = new Set(data.map((person) => person.company?.name).filter(Boolean)).size;
  } catch (error) {
    state.error = true;
    console.error('Kunne ikke hente kontakter:', error);
  } finally {
    state.loading = false;
    $('refresh').disabled = false;
    $('contacts').setAttribute('aria-busy', 'false');
    render();
  }
}
$('search').addEventListener('input', render);
$('country').addEventListener('change', render);
$('sort').addEventListener('change', render);
$('refresh').addEventListener('click', loadPeople);
$('clear').addEventListener('click', () => { $('search').value = ''; $('country').value = ''; render(); $('search').focus(); });
$('close-detail').addEventListener('click', () => $('detail').close());
$('detail').addEventListener('click', (event) => {
  const bounds = $('detail').getBoundingClientRect();
  if (event.target === $('detail') && (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom)) $('detail').close();
});
loadPeople();
