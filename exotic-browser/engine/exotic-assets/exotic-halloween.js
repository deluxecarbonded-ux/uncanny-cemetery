/* ==========================================================================
   Exotic Browser — Halloween Special Draggable Character Companion & Modal
   8 Iconic Halloween Show & Movie Characters · Browser-Wide Smooth Dragging
   ========================================================================== */

(function initExoticHalloween() {
  const win = window;
  const doc = win.document;
  if (!doc) return;

  const HTML_NS = "http://www.w3.org/1999/xhtml";
  const SVG_NS = "http://www.w3.org/2000/svg";

  const PREF_ENABLED = "exotic.mods.halloweenCompanion";
  const PREF_CHAR = "exotic.mods.halloweenCharacter";
  const PREF_X = "exotic.mods.halloweenX";
  const PREF_Y = "exotic.mods.halloweenY";

  const CHARACTERS = [
    {
      id: "jack-skellington",
      name: "Jack Skellington",
      source: "The Nightmare Before Christmas",
      quote: "What's this? Happy Halloween!",
      svg: `
        <g class="eh-char-float">
          <!-- Pinstriped Tailcoat -->
          <path d="M29 63 L48 58 L67 63 L72 98 L58 94 L53 102 L48 93 L43 102 L38 94 L24 98 Z" fill="#101014" stroke="#2c2c34" stroke-width="1.2"/>
          <path d="M35 64 L32 95 M40 62 L39 94 M56 62 L57 94 M61 64 L64 95" stroke="#e9eaef" stroke-width="1.05" stroke-opacity="0.78" stroke-linecap="round"/>
          <!-- White Shirt V -->
          <polygon points="42,58 54,58 48,76" fill="#f5f5f7"/>
          <!-- Bat Bowtie -->
          <path class="eh-bat-tie" d="M48 60 L33 53 L22 58 L30 62 L25 67 L38 64 L48 63 L58 64 L71 67 L66 62 L74 58 L63 53 Z" fill="#0d0d10" stroke="#f0f0f5" stroke-width="0.9"/>
          <circle cx="46" cy="60.5" r="1" fill="#ff5a36"/>
          <circle cx="50" cy="60.5" r="1" fill="#ff5a36"/>
          <!-- Slender Neck -->
          <rect x="45.2" y="51" width="5.6" height="9" rx="2.5" fill="#f4f3ee"/>
          <!-- Ivory Pumpkin King Skull -->
          <ellipse cx="48" cy="34" rx="22" ry="19.5" fill="#f7f6f1" stroke="#18181d" stroke-width="1.5"/>
          <!-- Hollow Tilted Eye Sockets -->
          <ellipse class="eh-blink" cx="39.5" cy="31.5" rx="6.2" ry="7.2" transform="rotate(-10 39.5 31.5)" fill="#0f0f13"/>
          <ellipse class="eh-blink" cx="56.5" cy="31.5" rx="6.2" ry="7.2" transform="rotate(10 56.5 31.5)" fill="#0f0f13"/>
          <!-- Skeletal Nostrils -->
          <path d="M46.2 38.5 L47.3 41.2 M49.8 38.5 L48.7 41.2" stroke="#141418" stroke-width="1.5" stroke-linecap="round"/>
          <!-- Stitched Grin -->
          <path d="M31.5 41.5 Q48 51.5 64.5 41.5" fill="none" stroke="#141418" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M35 41.2 L34 45.2 M39.5 43.2 L38.8 47.4 M44 44.5 L43.7 48.8 M48 45 L48 49.3 M52 44.5 L52.3 48.8 M56.5 43.2 L57.2 47.4 M61 41.2 L62 45.2" stroke="#141418" stroke-width="1.35" stroke-linecap="round"/>
        </g>
      `,
    },
    {
      id: "ghostface",
      name: "Ghostface",
      source: "Scream",
      quote: "What's your favorite scary movie?",
      svg: `
        <g class="eh-char-float">
          <!-- Flowing Dark Reaper Shroud & Draped Sleeves -->
          <path d="M48 10 C31 10 24 23 23 39 L17 78 L27 73 L29 98 L40 93 L48 101 L56 93 L67 98 L69 73 L79 78 L73 39 C72 23 65 10 48 10 Z" fill="#131318" stroke="#34343f" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M31 62 Q35 80 33 93 M65 62 Q61 80 63 93" fill="none" stroke="#2b2b35" stroke-width="1.3" stroke-linecap="round"/>
          <!-- Inner Hood Shadow -->
          <path d="M48 14 C35 14 30 25 31 38 C32 49 34 61 48 65 C62 61 64 49 65 38 C66 25 61 14 48 14 Z" fill="#08080b"/>
          <!-- Elongated White Scream Mask -->
          <path d="M48 17.5 C37 17.5 33.5 26.5 35 35.5 C36.2 42.5 35 50 40.5 57.5 C43.8 62 52.2 62 55.5 57.5 C61 50 59.8 42.5 61 35.5 C62.5 26.5 59 17.5 48 17.5 Z" fill="#f6f6f9" stroke="#1b1b22" stroke-width="1.3"/>
          <!-- Sad Drooping Hollow Eyes -->
          <path class="eh-blink" d="M37.5 31 C39.5 27.5 44.5 28.5 45 33 C45.4 37.5 40.5 40 38 36.5 C36.8 34.8 36.8 32.5 37.5 31 Z" fill="#101015"/>
          <path class="eh-blink" d="M58.5 31 C56.5 27.5 51.5 28.5 51 33 C50.6 37.5 55.5 40 58 36.5 C59.2 34.8 59.2 32.5 58.5 31 Z" fill="#101015"/>
          <!-- Nostrils -->
          <ellipse cx="46.6" cy="40" rx="0.9" ry="1.6" fill="#15151b"/>
          <ellipse cx="49.4" cy="40" rx="0.9" ry="1.6" fill="#15151b"/>
          <!-- Iconic Howling Oval Mouth -->
          <path d="M48 44 C43.8 44 43 49.5 43.6 54.5 C44.2 58.5 46 60 48 60 C50 60 51.8 58.5 52.4 54.5 C53 49.5 52.2 44 48 44 Z" fill="#0e0e13"/>
        </g>
      `,
    },
    {
      id: "wednesday-addams",
      name: "Wednesday Addams",
      source: "Wednesday",
      quote: "I find social media to be a soul-sucking void.",
      svg: `
        <g class="eh-char-float">
          <!-- Twin Braided Pigtails -->
          <g fill="#111116" stroke="#2c2c36" stroke-width="0.9">
            <circle cx="29" cy="46" r="4.2"/><circle cx="27.5" cy="53" r="4"/><circle cx="26.5" cy="60" r="3.8"/><circle cx="26" cy="67" r="3.5"/><path d="M24 70 L28 70 L26 77 Z"/>
            <circle cx="67" cy="46" r="4.2"/><circle cx="68.5" cy="53" r="4"/><circle cx="69.5" cy="60" r="3.8"/><circle cx="70" cy="67" r="3.5"/><path d="M68 70 L72 70 L70 77 Z"/>
          </g>
          <!-- Black Dress & Polka Texture -->
          <path d="M32 59 L64 59 L70 98 L26 98 Z" fill="#121217" stroke="#2d2d37" stroke-width="1.2"/>
          <circle cx="39" cy="75" r="1.1" fill="#e6e6ec" fill-opacity="0.55"/>
          <circle cx="57" cy="75" r="1.1" fill="#e6e6ec" fill-opacity="0.55"/>
          <circle cx="48" cy="83" r="1.1" fill="#e6e6ec" fill-opacity="0.55"/>
          <circle cx="37" cy="90" r="1.1" fill="#e6e6ec" fill-opacity="0.55"/>
          <circle cx="59" cy="90" r="1.1" fill="#e6e6ec" fill-opacity="0.55"/>
          <!-- Sharp White Pointed Collar -->
          <polygon points="48,59 35,57 41,70" fill="#f7f7fa" stroke="#18181f" stroke-width="1"/>
          <polygon points="48,59 61,57 55,70" fill="#f7f7fa" stroke="#18181f" stroke-width="1"/>
          <!-- Thing Perched on Left Shoulder -->
          <path d="M61 57 C62 51 66 50 67 54 L68.5 49.5 C69.5 49.5 70 52 69 55 L71.5 51.5 C72.5 52 72 54.5 70.5 56.5 L68 59 Z" fill="#ebd5c3" stroke="#2a201c" stroke-width="0.95"/>
          <line x1="63" y1="55.5" x2="67" y2="56.5" stroke="#6e3b3b" stroke-width="0.9"/>
          <!-- Neck & Pale Face -->
          <rect x="44.5" y="51" width="7" height="8" fill="#efe7e1"/>
          <path d="M31 32 C31 20 65 20 65 32 C65 45 58 53 48 53 C38 53 31 45 31 32 Z" fill="#f3ece6" stroke="#1b1b22" stroke-width="1.3"/>
          <!-- Parted Jet-Black Hair -->
          <path d="M48 14 C33 14 28 24 29 38 C32 31 40 26 48 23 C56 26 64 31 67 38 C68 24 63 14 48 14 Z" fill="#101015"/>
          <line x1="48" y1="14.5" x2="48" y2="23" stroke="#dcdce6" stroke-width="1" stroke-opacity="0.5"/>
          <!-- Deadpan Half-Lidded Eyes -->
          <g class="eh-blink">
            <ellipse cx="40.5" cy="36" rx="3.8" ry="3.2" fill="#ffffff"/>
            <circle cx="40.5" cy="36.4" r="2.1" fill="#121217"/>
            <path d="M36.2 35 L44.8 35" stroke="#121217" stroke-width="1.8" stroke-linecap="round"/>
            <ellipse cx="55.5" cy="36" rx="3.8" ry="3.2" fill="#ffffff"/>
            <circle cx="55.5" cy="36.4" r="2.1" fill="#121217"/>
            <path d="M51.2 35 L59.8 35" stroke="#121217" stroke-width="1.8" stroke-linecap="round"/>
          </g>
          <!-- Dark Deadpan Lips -->
          <path d="M44.5 45.5 Q48 44.8 51.5 45.5 Q48 47.2 44.5 45.5 Z" fill="#2c2229"/>
        </g>
      `,
    },
    {
      id: "michael-myers",
      name: "Michael Myers",
      source: "Halloween",
      quote: "... (The Shape watches silently.)",
      svg: `
        <g class="eh-char-float">
          <!-- Dark Mechanic Coveralls -->
          <path d="M26 62 C26 57 35 55 48 55 C61 55 70 57 70 62 L73 98 L23 98 Z" fill="#1d2631" stroke="#374657" stroke-width="1.3"/>
          <!-- Coverall Collar & Zipper -->
          <polygon points="39,55 48,68 34,63" fill="#151c24" stroke="#374657" stroke-width="1"/>
          <polygon points="57,55 48,68 62,63" fill="#151c24" stroke="#374657" stroke-width="1"/>
          <line x1="48" y1="68" x2="48" y2="98" stroke="#10151c" stroke-width="1.8"/>
          <rect x="54" y="73" width="10" height="9" rx="1.2" fill="none" stroke="#374657" stroke-width="1.1"/>
          <!-- Dark Neck Shadow -->
          <rect x="43" y="49" width="10" height="9" fill="#18191f"/>
          <!-- Tousled Dark Brown Hair -->
          <path d="M28 33 C26 20 34 11 48 11 C62 11 70 20 68 33 C69 27 65 18 48 18 C31 18 27 27 28 33 Z" fill="#32231a" stroke="#1c140f" stroke-width="1.2"/>
          <path d="M31 16 L35 11 L40 14 L46 9.5 L52 13.5 L58 10.5 L62 15" fill="none" stroke="#32231a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
          <!-- Pale Shatner Mask -->
          <path d="M31 30 C31 20 65 20 65 30 L64 43 C63 50 56 55 48 55 C40 55 33 50 32 43 Z" fill="#ecebe6" stroke="#22232a" stroke-width="1.35"/>
          <!-- Subtle Mask Cheekbones & Brow Contours -->
          <path d="M36 39 Q38 45 41 48 M60 39 Q58 45 55 48" fill="none" stroke="#c8c6be" stroke-width="1.2" stroke-linecap="round"/>
          <path d="M36 29.5 Q41 28 44.5 30 M51.5 30 Q55 28 60 29.5" fill="none" stroke="#b5b3aa" stroke-width="1.3" stroke-linecap="round"/>
          <!-- Pitch-Dark Eye Sockets -->
          <ellipse class="eh-blink" cx="40.5" cy="34" rx="4.6" ry="3.1" fill="#111217"/>
          <ellipse class="eh-blink" cx="55.5" cy="34" rx="4.6" ry="3.1" fill="#111217"/>
          <!-- Nose & Solemn Neutral Lip Line -->
          <path d="M46.5 40.5 Q48 42 49.5 40.5" fill="none" stroke="#aba9a0" stroke-width="1.3" stroke-linecap="round"/>
          <path d="M42.5 47.2 Q48 46.4 53.5 47.2" fill="none" stroke="#7d7b74" stroke-width="1.5" stroke-linecap="round"/>
        </g>
      `,
    },
    {
      id: "beetlejuice",
      name: "Beetlejuice",
      source: "Beetlejuice",
      quote: "It's showtime!",
      svg: `
        <g class="eh-char-float">
          <!-- Wild Moss-Green Hair Tufts -->
          <path d="M27 38 L19 33 L25 27 L19 20 L29 19 L28 11 L38 15 L44 8 L50 14 L58 9 L62 16 L72 13 L69 22 L77 25 L70 32 L76 38 Z" fill="#6f923a" stroke="#263314" stroke-width="1.2" stroke-linejoin="round"/>
          <!-- Black & White Striped Suit -->
          <path d="M26 60 L48 56 L70 60 L73 98 L23 98 Z" fill="#f5f5f8" stroke="#18181f" stroke-width="1.3"/>
          <path d="M29 60 L27 98 M36 59 L35 98 M43 58 L43 98 M53 58 L53 98 M60 59 L61 98 M67 60 L69 98" stroke="#121217" stroke-width="3.6"/>
          <!-- Shirt Collar & Black Tie -->
          <polygon points="41,56 55,56 48,73" fill="#e9e9ef" stroke="#18181f" stroke-width="1"/>
          <polygon points="46.5,58 49.5,58 51,74 48,78 45,74" fill="#141419"/>
          <!-- Chalk-White Face -->
          <path d="M32 31 C32 20 64 20 64 31 C64 44 58 53 48 53 C38 53 32 44 32 31 Z" fill="#f2f1ed" stroke="#1b1b22" stroke-width="1.3"/>
          <path d="M33 25 Q40 20 48 22 Q56 20 63 25" fill="none" stroke="#6f923a" stroke-width="2" stroke-opacity="0.55" stroke-linecap="round"/>
          <!-- Dark Purple-Charcoal Eye Rings -->
          <ellipse cx="40.5" cy="34.5" rx="5.6" ry="5.2" fill="#352840"/>
          <ellipse cx="55.5" cy="34.5" rx="5.6" ry="5.2" fill="#352840"/>
          <g class="eh-blink">
            <circle cx="40.5" cy="34.5" r="2.7" fill="#ffffff"/>
            <circle cx="40.5" cy="34.5" r="1.3" fill="#111116"/>
            <circle cx="55.5" cy="34.5" r="2.7" fill="#ffffff"/>
            <circle cx="55.5" cy="34.5" r="1.3" fill="#111116"/>
          </g>
          <!-- Mischievous Toothy Grin -->
          <path d="M38.5 43.5 Q48 50 57.5 43.5 Q48 46.5 38.5 43.5 Z" fill="#1b1621" stroke="#1b1621" stroke-width="1.2" stroke-linejoin="round"/>
          <path d="M42 44.8 L42 46.8 M46 45.5 L46 47.7 M50 45.5 L50 47.7 M54 44.8 L54 46.8" stroke="#e8e6dc" stroke-width="1.2"/>
        </g>
      `,
    },
    {
      id: "sam-trickrtreat",
      name: "Sam",
      source: "Trick 'r Treat",
      quote: "Always respect the rules of Halloween.",
      svg: `
        <g class="eh-char-float">
          <!-- Orange Footed Pajama Jumpsuit -->
          <path d="M29 60 C29 56 37 54 48 54 C59 54 67 56 67 60 L69 97 L53 97 L51 84 L45 84 L43 97 L27 97 Z" fill="#dd6818" stroke="#5e2a08" stroke-width="1.3" stroke-linejoin="round"/>
          <!-- Pajama Front Bib & Patch -->
          <rect x="38" y="61" width="20" height="20" rx="3" fill="#eb8234" stroke="#7a380c" stroke-width="1"/>
          <circle cx="48" cy="65.5" r="1.3" fill="#f7d6a8"/>
          <circle cx="48" cy="71.5" r="1.3" fill="#f7d6a8"/>
          <circle cx="48" cy="77.5" r="1.3" fill="#f7d6a8"/>
          <!-- Burlap Neck Tie Rope -->
          <path d="M36 55 Q48 59 60 55" fill="none" stroke="#6b4623" stroke-width="2.2" stroke-linecap="round"/>
          <!-- Round Burlap Sack Head -->
          <ellipse cx="48" cy="34.5" rx="22.5" ry="20.5" fill="#c99655" stroke="#593a18" stroke-width="1.4"/>
          <!-- Burlap Seam & Texture -->
          <path d="M58 16 Q63 34 57 52" fill="none" stroke="#8c6230" stroke-width="1.1" stroke-dasharray="2.5 2.5"/>
          <!-- Button Eyes with White X Stitches -->
          <g class="eh-blink">
            <circle cx="39" cy="33" r="5" fill="#141418" stroke="#3d2914" stroke-width="1"/>
            <path d="M37.2 31.2 L40.8 34.8 M40.8 31.2 L37.2 34.8" stroke="#f4efe6" stroke-width="1.3" stroke-linecap="round"/>
            <circle cx="57" cy="33" r="5" fill="#141418" stroke="#3d2914" stroke-width="1"/>
            <path d="M55.2 31.2 L58.8 34.8 M58.8 31.2 L55.2 34.8" stroke="#f4efe6" stroke-width="1.3" stroke-linecap="round"/>
          </g>
          <!-- Stitched Burlap Smile -->
          <path d="M35.5 42.5 Q48 49.5 60.5 42.5" fill="none" stroke="#472d12" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M38.5 41.8 L37.5 45.8 M43.5 43.8 L43 47.8 M48 44.3 L48 48.5 M52.5 43.8 L53 47.8 M57.5 41.8 L58.5 45.8" stroke="#472d12" stroke-width="1.3" stroke-linecap="round"/>
          <!-- Bitten Pumpkin Lollipop -->
          <line x1="72" y1="77" x2="77" y2="57" stroke="#f2efe9" stroke-width="2.2" stroke-linecap="round"/>
          <path d="M78 44 C84 44 87 49 86 54 C85 59 80 62 74 61 C69 60 67 55 69 50 C71 52 74 50 73 46 C74.5 44.5 76.2 44 78 44 Z" fill="#ff7919" stroke="#5e2a08" stroke-width="1.2"/>
          <polygon points="75,50 77,48 78,51" fill="#2b1404"/>
          <polygon points="81,51 83,49 83.5,52" fill="#2b1404"/>
        </g>
      `,
    },
    {
      id: "zero-ghostdog",
      name: "Zero",
      source: "The Nightmare Before Christmas",
      quote: "Woof! Leading the way through the fog.",
      svg: `
        <g class="eh-char-float">
          <!-- Floating Translucent Sheet-Ghost Body & Wispy Tail -->
          <path d="M44 43 C36 47 30 57 25 69 C21 79 13 84 10 80 C14 89 24 91 31 85 C34 92 41 94 46 87 C51 94 59 93 63 85 C69 90 79 88 83 80 C76 80 71 73 67 63 C63 53 56 45 48 43 Z" fill="#f6f8fc" stroke="#252934" stroke-width="1.3" stroke-linejoin="round"/>
          <path d="M36 62 Q33 74 30 82 M50 60 Q49 74 47 84 M60 61 Q63 73 65 81" fill="none" stroke="#cfd6e6" stroke-width="1.3" stroke-linecap="round"/>
          <!-- Long Floppy Ghost Ears -->
          <path d="M40 28 C31 30 23 41 25 51 C27 56 34 52 38 43 Z" fill="#eef2fa" stroke="#252934" stroke-width="1.25"/>
          <path d="M54 29 C61 34 65 45 61 53 C58 57 52 51 51 42 Z" fill="#eef2fa" stroke="#252934" stroke-width="1.25"/>
          <!-- Collar -->
          <path d="M39 42 Q47 46 55 41.5" fill="none" stroke="#e2532f" stroke-width="2.8" stroke-linecap="round"/>
          <!-- Ghost Pup Head & Snout -->
          <path d="M38 27 C38 18 54 17 57 26 C59 31 66 32 71 33 C73 33.5 73 38 69 39 C63 40.5 56 41 47 42 C40 42 37 35 38 27 Z" fill="#fbfcff" stroke="#252934" stroke-width="1.35"/>
          <!-- Sweet Dark Pup Eyes -->
          <ellipse class="eh-blink" cx="46.5" cy="27.5" rx="2.3" ry="2.9" fill="#14161d"/>
          <ellipse class="eh-blink" cx="53" cy="27.5" rx="2.1" ry="2.7" fill="#14161d"/>
          <!-- Glowing Mini Jack-o'-Lantern Nose -->
          <circle cx="72.5" cy="35" r="6.5" fill="#ff7a1a" fill-opacity="0.28"/>
          <circle cx="72.5" cy="35" r="3.8" fill="#ff7a1a" stroke="#5e2604" stroke-width="1"/>
          <path d="M72.5 30.2 L73.2 31.6" stroke="#4f772d" stroke-width="1.2" stroke-linecap="round"/>
        </g>
      `,
    },
    {
      id: "count-dracula",
      name: "Count Dracula",
      source: "Dracula",
      quote: "Listen to them — the children of the night!",
      svg: `
        <g class="eh-char-float">
          <!-- High Flared Vampire Collar (Outer Black + Crimson Lining) -->
          <polygon points="18,36 48,54 78,36 72,66 24,66" fill="#9c1c2b" stroke="#18181f" stroke-width="1.3" stroke-linejoin="round"/>
          <!-- Sweeping Black Cape -->
          <path d="M24 58 L48 54 L72 58 L78 98 L62 93 L48 100 L34 93 L18 98 Z" fill="#111116" stroke="#2f2f3a" stroke-width="1.3" stroke-linejoin="round"/>
          <!-- White Tuxedo Bib & Medallion -->
          <polygon points="41,56 55,56 48,78" fill="#f5f5f8"/>
          <line x1="41" y1="58" x2="48" y2="66" stroke="#9c1c2b" stroke-width="2"/>
          <line x1="55" y1="58" x2="48" y2="66" stroke="#9c1c2b" stroke-width="2"/>
          <circle cx="48" cy="67" r="3.2" fill="#d9a441" stroke="#3b2608" stroke-width="0.9"/>
          <circle cx="48" cy="67" r="1.5" fill="#9c1c2b"/>
          <!-- Aristocratic Pale Head & Pointed Ears -->
          <polygon points="31,32 26,28 31,39" fill="#e9e4ec" stroke="#1b1b22" stroke-width="1.1"/>
          <polygon points="65,32 70,28 65,39" fill="#e9e4ec" stroke="#1b1b22" stroke-width="1.1"/>
          <path d="M32 29 C32 18 64 18 64 29 C64 43 57 52 48 52 C39 52 32 43 32 29 Z" fill="#eeeaf2" stroke="#1b1b22" stroke-width="1.3"/>
          <!-- Swept-Back Hair with Sharp Widow's Peak -->
          <path d="M31 30 C30 17 38 12 48 12 C58 12 66 17 65 30 C63 23 56 20 52 21 L48 26.5 L44 21 C40 20 33 23 31 30 Z" fill="#101016"/>
          <!-- Arched Brows & Piercing Eyes -->
          <path d="M36 29.5 L44.5 32 M60 29.5 L51.5 32" stroke="#14141b" stroke-width="1.6" stroke-linecap="round"/>
          <g class="eh-blink">
            <ellipse cx="40.5" cy="34.5" rx="3.4" ry="2.3" fill="#ffffff"/>
            <circle cx="40.5" cy="34.5" r="1.5" fill="#9c1c2b"/>
            <ellipse cx="55.5" cy="34.5" rx="3.4" ry="2.3" fill="#ffffff"/>
            <circle cx="55.5" cy="34.5" r="1.5" fill="#9c1c2b"/>
          </g>
          <!-- Smirk & Sharp White Fangs -->
          <path d="M41.5 43.5 Q48 46.2 54.5 43.5" fill="none" stroke="#181820" stroke-width="1.5" stroke-linecap="round"/>
          <polygon points="43.2,44.2 44.8,48.5 46.2,44.6" fill="#ffffff" stroke="#181820" stroke-width="0.8"/>
          <polygon points="52.8,44.2 51.2,48.5 49.8,44.6" fill="#ffffff" stroke="#181820" stroke-width="0.8"/>
        </g>
      `,
    },
  ];

  function getBoolPref(name, fallback = false) {
    try {
      return Services.prefs.getBoolPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setBoolPref(name, val) {
    try {
      Services.prefs.setBoolPref(name, !!val);
    } catch (_) {}
  }

  function getStrPref(name, fallback = "") {
    try {
      return Services.prefs.getCharPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setStrPref(name, val) {
    try {
      Services.prefs.setStringPref(name, String(val));
    } catch (_) {}
  }

  function getIntPref(name, fallback = -1) {
    try {
      return Services.prefs.getIntPref(name, fallback);
    } catch (_) {
      return fallback;
    }
  }

  function setIntPref(name, val) {
    try {
      Services.prefs.setIntPref(name, Math.round(Number(val)));
    } catch (_) {}
  }

  function getCharacterById(id) {
    return CHARACTERS.find((c) => c.id === id) || CHARACTERS[0];
  }

  function getActiveCharacter() {
    return getCharacterById(getStrPref(PREF_CHAR, CHARACTERS[0].id));
  }

  function createCharacterSVGElement(targetDoc, charObj, sizePx = 84) {
    const d = targetDoc || doc;
    const svg = d.createElementNS(SVG_NS, "svg");
    svg.setAttribute("viewBox", "0 0 96 108");
    svg.setAttribute("width", String(sizePx));
    svg.setAttribute("height", String(Math.round((sizePx * 108) / 96)));
    svg.setAttribute("class", "eh-character-svg");
    svg.setAttribute("aria-hidden", "true");
    // Safe static markup authored in CHARACTERS above
    const parser = new d.defaultView.DOMParser();
    const parsed = parser.parseFromString(
      `<svg xmlns="${SVG_NS}" viewBox="0 0 96 108">${charObj.svg}</svg>`,
      "image/svg+xml"
    );
    const root = parsed.documentElement;
    if (root && root.childNodes) {
      for (const node of Array.from(root.childNodes)) {
        svg.appendChild(d.importNode(node, true));
      }
    }
    return svg;
  }

  function h(tag, attrs, ...children) {
    const el = doc.createElementNS(HTML_NS, tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === undefined || v === null || v === false) continue;
        if (k === "className") el.setAttribute("class", v);
        else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
        else if (k.startsWith("on") && typeof v === "function") {
          el.addEventListener(k.slice(2).toLowerCase(), v);
        } else {
          el.setAttribute(k, String(v));
        }
      }
    }
    for (const child of children.flat()) {
      if (child === null || child === undefined || child === false) continue;
      el.appendChild(
        typeof child === "string" || typeof child === "number"
          ? doc.createTextNode(String(child))
          : child
      );
    }
    return el;
  }

  // Expose catalog & SVG factory even if loaded inside internal pages
  const api = {
    CHARACTERS,
    PREF_ENABLED,
    PREF_CHAR,
    getCharacterById,
    getActiveCharacter,
    createCharacterSVGElement,
    openModal: () => {},
    closeModal: () => {},
    selectCharacter: (id) => {
      const ch = getCharacterById(id);
      setStrPref(PREF_CHAR, ch.id);
      if (win.__exoticWindowController && win.__exoticWindowController.syncMods) {
        win.__exoticWindowController.syncMods();
      }
    },
    resetPosition: () => {
      setIntPref(PREF_X, -1);
      setIntPref(PREF_Y, -1);
      if (win.__exoticWindowController && win.__exoticWindowController.syncMods) {
        win.__exoticWindowController.syncMods();
      }
    },
  };

  win.__exoticHalloween = api;

  // Only mount the browser-wide floating companion + chrome modal in browser.xhtml
  const isBrowserChrome =
    doc.location && doc.location.href === "chrome://browser/content/browser.xhtml";
  if (!isBrowserChrome || doc.getElementById("exotic-halloween-companion")) {
    return;
  }

  const COMP_W = 88;
  const COMP_H = 98;
  const MARGIN = 12;

  // Transparent full-window drag shield ONLY active while dragging so fast pointer
  // motions over remote <browser> tabs never drop events or select webpage text.
  const dragShield = h("div", {
    id: "exotic-halloween-drag-shield",
    "data-dragging": "false",
  });

  const bubbleEl = h("div", {
    className: "eh-speech-bubble",
    "data-visible": "false",
  });

  const badgeEl = h("div", { className: "eh-hover-tag" }, "");
  const spriteSlot = h("div", { className: "eh-sprite-wrap" });

  const companionEl = h(
    "div",
    {
      id: "exotic-halloween-companion",
      "data-visible": "false",
      "data-dragging": "false",
      title: "Drag to move anywhere · Click for quote · Double-click to choose character",
    },
    bubbleEl,
    spriteSlot,
    badgeEl
  );

  // Character Selection Modal mounted at browser window root so it works seamlessly
  // from Exotic Mods ("Choose a Character") AND double-clicking the companion!
  const modalGrid = h("div", { className: "eh-modal-grid" });
  const modalActiveSubtitle = h("span", { className: "eh-modal-active-sub" }, "");

  const modalBackdrop = h(
    "div",
    {
      id: "exotic-halloween-modal",
      "data-open": "false",
      onClick: (e) => {
        if (e.target === modalBackdrop) closeModal();
      },
    },
    h(
      "div",
      {
        className: "eh-modal-card",
        role: "dialog",
        "aria-modal": "true",
        "aria-label": "Choose a Halloween Character",
      },
      h(
        "div",
        { className: "eh-modal-head" },
        h(
          "div",
          { className: "eh-modal-title-group" },
          h(
            "div",
            { className: "eh-modal-badge-row" },
            h("span", { className: "eh-special-pill" }, "Halloween Special"),
            modalActiveSubtitle
          ),
          h("h2", { className: "eh-modal-title" }, "Choose a Character"),
          h(
            "p",
            { className: "eh-modal-desc" },
            "Pick an iconic character from Halloween shows and movies. Drag and move them anywhere across Exotic."
          )
        ),
        h(
          "button",
          {
            className: "eh-modal-close",
            type: "button",
            title: "Close (Esc)",
            onClick: () => closeModal(),
          },
          "✕"
        )
      ),
      modalGrid,
      h(
        "div",
        { className: "eh-modal-foot" },
        h(
          "button",
          {
            className: "eh-btn-ghost",
            type: "button",
            onClick: () => {
              resetCompanionPosition();
            },
          },
          "Reset position"
        ),
        h(
          "button",
          {
            className: "eh-btn-primary",
            type: "button",
            onClick: () => closeModal(),
          },
          "Done"
        )
      )
    )
  );

  const hostRoot = doc.documentElement;
  hostRoot.appendChild(dragShield);
  hostRoot.appendChild(companionEl);
  hostRoot.appendChild(modalBackdrop);

  let posX = -1;
  let posY = -1;
  let renderedCharId = "";
  let quoteTimer = null;

  function clampCoords(x, y) {
    const maxW = Math.max(200, win.innerWidth || 1280);
    const maxH = Math.max(200, win.innerHeight || 800);
    const cx = Math.min(Math.max(MARGIN, x), maxW - COMP_W - MARGIN);
    const cy = Math.min(Math.max(38, y), maxH - COMP_H - MARGIN);
    return [Math.round(cx), Math.round(cy)];
  }

  function ensurePositionInitialized() {
    const savedX = getIntPref(PREF_X, -1);
    const savedY = getIntPref(PREF_Y, -1);
    if (savedX >= 0 && savedY >= 0) {
      [posX, posY] = clampCoords(savedX, savedY);
    } else {
      const defX = (win.innerWidth || 1280) - COMP_W - 34;
      const defY = (win.innerHeight || 800) - COMP_H - 34;
      [posX, posY] = clampCoords(defX, defY);
    }
  }

  function applyTransform(tiltDeg = 0) {
    if (posX < 0 || posY < 0) ensurePositionInitialized();
    const rot = tiltDeg ? ` rotate(${tiltDeg.toFixed(1)}deg)` : "";
    companionEl.style.transform = `translate3d(${posX}px, ${posY}px, 0)${rot}`;
    // Flip speech bubble below if near top edge, or align right if near right edge
    const nearTop = posY < 95;
    const nearLeft = posX < 180;
    bubbleEl.setAttribute("data-pos-y", nearTop ? "bottom" : "top");
    bubbleEl.setAttribute("data-pos-x", nearLeft ? "left" : "right");
  }

  function showQuoteBubble(text) {
    if (!text) return;
    bubbleEl.textContent = text;
    bubbleEl.setAttribute("data-visible", "true");
    if (quoteTimer) win.clearTimeout(quoteTimer);
    quoteTimer = win.setTimeout(() => {
      bubbleEl.setAttribute("data-visible", "false");
      quoteTimer = null;
    }, 2600);
  }

  function resetCompanionPosition() {
    setIntPref(PREF_X, -1);
    setIntPref(PREF_Y, -1);
    posX = -1;
    posY = -1;
    ensurePositionInitialized();
    applyTransform(0);
    const ch = getActiveCharacter();
    showQuoteBubble(`${ch.name} is ready!`);
  }

  function renderModalCards() {
    const active = getActiveCharacter();
    modalActiveSubtitle.textContent = `Active: ${active.name}`;
    modalGrid.replaceChildren(
      ...CHARACTERS.map((ch) => {
        const isSelected = ch.id === active.id;
        const artWrap = h("div", { className: "eh-card-art" });
        artWrap.appendChild(createCharacterSVGElement(doc, ch, 68));
        return h(
          "button",
          {
            className: "eh-char-card",
            type: "button",
            "data-selected": isSelected ? "true" : "false",
            onClick: () => {
              setStrPref(PREF_CHAR, ch.id);
              if (!getBoolPref(PREF_ENABLED, false)) {
                setBoolPref(PREF_ENABLED, true);
              }
              syncCompanionUI(true);
              renderModalCards();
              if (win.__exoticWindowController && win.__exoticWindowController.syncMods) {
                win.__exoticWindowController.syncMods();
              }
            },
          },
          artWrap,
          h("div", { className: "eh-card-name" }, ch.name),
          h("div", { className: "eh-card-source" }, ch.source),
          h(
            "span",
            { className: "eh-card-status" },
            isSelected ? "Selected" : "Choose"
          )
        );
      })
    );
  }

  function openModal() {
    renderModalCards();
    modalBackdrop.setAttribute("data-open", "true");
  }

  function closeModal() {
    modalBackdrop.setAttribute("data-open", "false");
  }

  api.openModal = openModal;
  api.closeModal = closeModal;
  api.resetPosition = resetCompanionPosition;

  // Smooth 60fps Pointer Dragging Across Entire Browser
  let dragging = false;
  let dragPointerId = null;
  let startClientX = 0;
  let startClientY = 0;
  let originX = 0;
  let originY = 0;
  let lastClientX = 0;
  let movedDistance = 0;

  companionEl.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    ensurePositionInitialized();
    dragging = true;
    dragPointerId = e.pointerId;
    startClientX = e.clientX;
    startClientY = e.clientY;
    lastClientX = e.clientX;
    originX = posX;
    originY = posY;
    movedDistance = 0;
    companionEl.setAttribute("data-dragging", "true");
    dragShield.setAttribute("data-dragging", "true");
    try {
      companionEl.setPointerCapture(e.pointerId);
    } catch (_) {}
  });

  companionEl.addEventListener("pointermove", (e) => {
    if (!dragging || e.pointerId !== dragPointerId) return;
    e.preventDefault();
    const dx = e.clientX - startClientX;
    const dy = e.clientY - startClientY;
    movedDistance = Math.hypot(dx, dy);
    const vx = e.clientX - lastClientX;
    lastClientX = e.clientX;
    [posX, posY] = clampCoords(originX + dx, originY + dy);
    const tilt = Math.max(-10, Math.min(10, vx * 0.65));
    applyTransform(tilt);
  });

  function finishDrag(e) {
    if (!dragging) return;
    if (e && dragPointerId !== null && e.pointerId !== undefined && e.pointerId !== dragPointerId) {
      return;
    }
    dragging = false;
    companionEl.setAttribute("data-dragging", "false");
    dragShield.setAttribute("data-dragging", "false");
    try {
      if (dragPointerId !== null && companionEl.hasPointerCapture(dragPointerId)) {
        companionEl.releasePointerCapture(dragPointerId);
      }
    } catch (_) {}
    dragPointerId = null;
    applyTransform(0);

    if (movedDistance > 4) {
      setIntPref(PREF_X, posX);
      setIntPref(PREF_Y, posY);
    } else {
      const ch = getActiveCharacter();
      showQuoteBubble(ch.quote);
    }
  }

  companionEl.addEventListener("pointerup", finishDrag);
  companionEl.addEventListener("pointercancel", finishDrag);

  companionEl.addEventListener("dblclick", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  });

  companionEl.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal();
  });

  win.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && modalBackdrop.getAttribute("data-open") === "true") {
        e.preventDefault();
        e.stopPropagation();
        closeModal();
      }
    },
    true
  );

  win.addEventListener("resize", () => {
    if (posX >= 0 && posY >= 0) {
      [posX, posY] = clampCoords(posX, posY);
      applyTransform(0);
    }
  });

  function syncCompanionUI(announceSelection = false) {
    const enabled = getBoolPref(PREF_ENABLED, false);
    const welcomeOpen = !!doc.getElementById("exotic-welcome-overlay");
    if (!enabled || welcomeOpen) {
      companionEl.setAttribute("data-visible", "false");
      return;
    }

    const ch = getActiveCharacter();
    if (renderedCharId !== ch.id) {
      const hadPrev = !!renderedCharId;
      renderedCharId = ch.id;
      spriteSlot.replaceChildren(createCharacterSVGElement(doc, ch, 84));
      badgeEl.textContent = `${ch.name} · Drag`;
      if (announceSelection || hadPrev || bubbleEl.getAttribute("data-visible") === "true") {
        showQuoteBubble(ch.quote);
      }
    }
    ensurePositionInitialized();
    applyTransform(0);
    companionEl.setAttribute("data-visible", "true");
    if (modalBackdrop.getAttribute("data-open") === "true") {
      renderModalCards();
    }
  }

  const prefObserver = {
    observe(_subject, topic, data) {
      if (topic !== "nsPref:changed") return;
      if (
        data === PREF_ENABLED ||
        data === PREF_CHAR ||
        data === PREF_X ||
        data === PREF_Y ||
        data === "exotic.welcome.seen"
      ) {
        if (data === PREF_X || data === PREF_Y) {
          posX = getIntPref(PREF_X, -1);
          posY = getIntPref(PREF_Y, -1);
        }
        syncCompanionUI(data === PREF_CHAR);
      }
    },
  };

  try {
    Services.prefs.addObserver("exotic.mods.halloween", prefObserver);
    Services.prefs.addObserver("exotic.welcome.seen", prefObserver);
  } catch (_) {}

  if (win.__exoticWindowController && win.__exoticWindowController.registerWindowSync) {
    win.__exoticWindowController.registerWindowSync(syncCompanionUI);
  }

  win.addEventListener(
    "unload",
    () => {
      try {
        Services.prefs.removeObserver("exotic.mods.halloween", prefObserver);
        Services.prefs.removeObserver("exotic.welcome.seen", prefObserver);
      } catch (_) {}
      if (win.__exoticWindowController && win.__exoticWindowController.unregisterWindowSync) {
        win.__exoticWindowController.unregisterWindowSync(syncCompanionUI);
      }
    },
    { once: true }
  );

  syncCompanionUI(false);
})();
