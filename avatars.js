/* ===== Sing Song – Mii-liknande avatarer (SVG) ===== */
/* 12 färdiga avatarer att välja bland. Ritas som inline-SVG så att de kan
   animeras (hoppa, sjunga, åka ut) med CSS-klasser. */

const AVATARS = [
  { id: 'a1',  skin: '#ffd9b3', hair: 'spiky',    hairColor: '#3b2b1f', shirt: '#ff3ec9' },
  { id: 'a2',  skin: '#f2c29b', hair: 'bob',      hairColor: '#141414', shirt: '#2ff3ff' },
  { id: 'a3',  skin: '#ffe0c2', hair: 'curly',    hairColor: '#b55a1e', shirt: '#ffd166' },
  { id: 'a4',  skin: '#c98e62', hair: 'flat',     hairColor: '#141414', shirt: '#3ddc84' },
  { id: 'a5',  skin: '#ffd9b3', hair: 'ponytail', hairColor: '#e8b93c', shirt: '#7b2ff7' },
  { id: 'a6',  skin: '#a9714b', hair: 'curly',    hairColor: '#141414', shirt: '#ff4d6d' },
  { id: 'a7',  skin: '#ffe0c2', hair: 'bob',      hairColor: '#c0392b', shirt: '#12b3a8' },
  { id: 'a8',  skin: '#f2c29b', hair: 'bald',     hairColor: '#000000', shirt: '#ff9f1c' },
  { id: 'a9',  skin: '#c98e62', hair: 'spiky',    hairColor: '#5d3fd3', shirt: '#f5f5f5' },
  { id: 'a10', skin: '#ffd9b3', hair: 'flat',     hairColor: '#9b9b9b', shirt: '#2f6df6' },
  { id: 'a11', skin: '#a9714b', hair: 'ponytail', hairColor: '#141414', shirt: '#ff3ec9' },
  { id: 'a12', skin: '#ffe0c2', hair: 'spiky',    hairColor: '#e84393', shirt: '#39ff88' },
];

function avatarById(id) {
  return AVATARS.find((a) => a.id === id) || AVATARS[0];
}

function hairSVG(a) {
  const c = a.hairColor;
  switch (a.hair) {
    case 'flat':
      return `<path d="M21 48 A29 29 0 0 1 79 48 Q50 28 21 48 Z" fill="${c}"/>`;
    case 'spiky':
      return `<path d="M22 46 L31 25 L40 35 L50 20 L60 35 L69 25 L78 46 Q50 30 22 46 Z" fill="${c}"/>`;
    case 'bob':
      return `<path d="M21 48 A29 29 0 0 1 79 48 Q50 28 21 48 Z" fill="${c}"/>
              <rect x="16" y="42" width="11" height="26" rx="5" fill="${c}"/>
              <rect x="73" y="42" width="11" height="26" rx="5" fill="${c}"/>`;
    case 'curly':
      return `<circle cx="32" cy="34" r="12" fill="${c}"/>
              <circle cx="50" cy="27" r="13" fill="${c}"/>
              <circle cx="68" cy="34" r="12" fill="${c}"/>`;
    case 'ponytail':
      return `<path d="M21 48 A29 29 0 0 1 79 48 Q50 28 21 48 Z" fill="${c}"/>
              <circle cx="84" cy="40" r="9" fill="${c}"/>
              <circle cx="88" cy="52" r="6" fill="${c}"/>`;
    case 'bald':
    default:
      return '';
  }
}

/* SVG-sträng för en avatar. withMic = håller mikrofon (den som sjunger). */
function avatarSVG(a, { withMic = false } = {}) {
  const mic = withMic
    ? `<g class="mic-hand">
         <line x1="79" y1="112" x2="70" y2="88" stroke="${a.skin}" stroke-width="9" stroke-linecap="round"/>
         <rect x="63" y="70" width="9" height="20" rx="4" transform="rotate(18 68 80)" fill="#444"/>
         <circle cx="66" cy="68" r="9" fill="#ddd"/>
         <circle cx="66" cy="68" r="9" fill="url(#micgrid-${a.id})"/>
       </g>
       <defs>
         <pattern id="micgrid-${a.id}" width="4" height="4" patternUnits="userSpaceOnUse">
           <circle cx="1.4" cy="1.4" r="1" fill="#999"/>
         </pattern>
       </defs>`
    : '';
  return `<svg class="mii-svg" viewBox="0 0 100 150" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M26 148 Q28 100 50 96 Q72 100 74 148 Z" fill="${a.shirt}"/>
    <circle cx="50" cy="52" r="29" fill="${a.skin}"/>
    ${hairSVG(a)}
    <circle cx="40" cy="54" r="3.4" fill="#20242b"/>
    <circle cx="60" cy="54" r="3.4" fill="#20242b"/>
    <circle cx="34" cy="63" r="4" fill="#ff8fa3" opacity=".4"/>
    <circle cx="66" cy="63" r="4" fill="#ff8fa3" opacity=".4"/>
    <path class="mouth" d="M43 68 Q50 75 57 68" stroke="#7a4632" stroke-width="3" stroke-linecap="round" fill="none"/>
    ${mic}
  </svg>`;
}
