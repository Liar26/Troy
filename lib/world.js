// Turns the museums' own place/nationality words into one consistent label, and a world region.
// This only normalises spelling ("France" and "French" become "French"); it never adds facts.
const COUNTRY = {
  france: 'French', netherlands: 'Dutch', holland: 'Dutch', italy: 'Italian', spain: 'Spanish', germany: 'German', england: 'British',
  britain: 'British', 'great britain': 'British', 'united kingdom': 'British', scotland: 'Scottish', ireland: 'Irish', belgium: 'Belgian', flanders: 'Flemish',
  austria: 'Austrian', switzerland: 'Swiss', portugal: 'Portuguese', russia: 'Russian', poland: 'Polish', sweden: 'Swedish', norway: 'Norwegian',
  denmark: 'Danish', finland: 'Finnish', greece: 'Greek', hungary: 'Hungarian', 'czech republic': 'Czech', bohemia: 'Czech', ukraine: 'Ukrainian',
  'united states': 'American', usa: 'American', canada: 'Canadian', mexico: 'Mexican', brazil: 'Brazilian', argentina: 'Argentine', peru: 'Peruvian',
  chile: 'Chilean', colombia: 'Colombian', cuba: 'Cuban', china: 'Chinese', japan: 'Japanese', korea: 'Korean', india: 'Indian', iran: 'Iranian',
  persia: 'Persian', iraq: 'Iraqi', turkey: 'Turkish', egypt: 'Egyptian', syria: 'Syrian', nepal: 'Nepalese', tibet: 'Tibetan', thailand: 'Thai',
  vietnam: 'Vietnamese', indonesia: 'Indonesian', cambodia: 'Cambodian', pakistan: 'Pakistani', afghanistan: 'Afghan', uzbekistan: 'Uzbek',
  australia: 'Australian', 'new zealand': 'New Zealander', ethiopia: 'Ethiopian', nigeria: 'Nigerian', 'south africa': 'South African',
};
const REGION = {};
const add = (r, list) => list.split(',').forEach((x) => { REGION[x.trim().toLowerCase()] = r; });
add('Europe', 'French,Dutch,Italian,Spanish,German,British,Scottish,Irish,Belgian,Flemish,Austrian,Swiss,Portuguese,Russian,Polish,Swedish,Norwegian,Danish,Finnish,Greek,Hungarian,Czech,Ukrainian,English,Welsh,Netherlandish,Catalan,Bohemian,Romanian,Croatian,Serbian,Icelandic,Lithuanian,Latvian,Estonian,Bulgarian,Slovak,Slovenian');
add('Americas', 'American,Canadian,Mexican,Brazilian,Argentine,Peruvian,Chilean,Colombian,Cuban,Venezuelan,Ecuadorian,Bolivian,Haitian,Puerto Rican,Native American');
add('Asia', 'Chinese,Japanese,Korean,Indian,Nepalese,Tibetan,Thai,Vietnamese,Indonesian,Cambodian,Pakistani,Afghan,Uzbek,Mongolian,Burmese,Sri Lankan,Bangladeshi,Filipino,Malaysian');
add('Middle East', 'Iranian,Persian,Iraqi,Turkish,Syrian,Egyptian,Lebanese,Israeli,Saudi,Ottoman,Mughal');
add('Africa', 'Ethiopian,Nigerian,South African,Moroccan,Algerian,Tunisian,Kenyan,Ghanaian,Senegalese');
add('Oceania', 'Australian,New Zealander');

const SKIP = /\b(century|dynasty|period|culture|school|style)\b|\d/i;
function nationality(raw) {
  let s = String(raw || '').split(/[,;(\/]/)[0].trim();
  if (!s || s.length > 30 || SKIP.test(s)) return '';
  const k = s.toLowerCase();
  if (COUNTRY[k]) return COUNTRY[k];
  return s.replace(/^\w/, (c) => c.toUpperCase());
}
const region = (nat) => REGION[String(nat || '').toLowerCase()] || '';
module.exports = { nationality, region };
