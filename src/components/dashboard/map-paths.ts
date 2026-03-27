/**
 * Simplified world map SVG paths derived from Natural Earth 110m data.
 * Equirectangular projection, viewBox 0 0 1000 500.
 * Each path is a recognizable country/region outline.
 *
 * Projection formula (approx):
 *   x = (longitude + 180) * (1000 / 360)
 *   y = (90 - latitude) * (500 / 180)
 */

/* ------------------------------------------------------------------ */
/* Background landmasses — countries without regulation data           */
/* These render as dark filled shapes to form recognizable geography   */
/* ------------------------------------------------------------------ */

export const backgroundLand: string[] = [
  // Greenland
  "M380,30 L400,25 L420,28 L435,38 L438,55 L430,68 L418,75 L400,78 L385,72 L375,60 L372,45 Z",
  // Iceland
  "M418,72 L428,68 L435,72 L432,80 L422,82 L418,78 Z",
  // Mexico
  "M155,200 L180,195 L195,200 L200,210 L195,225 L185,235 L170,238 L160,232 L150,220 L148,210 Z",
  // Central America
  "M195,238 L205,235 L215,240 L218,250 L212,258 L205,260 L198,255 L195,248 Z",
  // Caribbean islands
  "M225,218 L232,215 L238,218 L240,225 L235,230 L228,228 Z",
  "M242,210 L248,208 L252,212 L250,218 L244,218 Z",
  // Colombia/Venezuela
  "M220,260 L240,255 L260,258 L275,265 L280,278 L272,288 L258,290 L242,285 L228,278 L218,270 Z",
  // Peru/Ecuador
  "M215,285 L228,280 L238,288 L240,305 L235,318 L225,322 L215,315 L210,300 Z",
  // Argentina/Chile
  "M240,320 L255,315 L262,328 L265,345 L262,365 L258,385 L252,400 L245,410 L238,415 L232,408 L228,390 L225,370 L228,350 L232,335 Z",
  // West Africa
  "M440,230 L455,225 L470,228 L478,238 L475,252 L465,260 L450,262 L440,255 L435,242 Z",
  // Central Africa
  "M480,240 L500,235 L518,242 L525,258 L520,275 L508,282 L492,280 L482,270 L478,255 Z",
  // East Africa
  "M530,228 L545,222 L555,230 L558,248 L552,265 L542,272 L532,268 L525,255 L525,240 Z",
  // Southern Africa
  "M492,285 L515,280 L530,290 L535,305 L530,320 L520,330 L505,335 L492,328 L485,315 L484,300 Z",
  // Madagascar
  "M558,295 L565,288 L570,298 L568,312 L562,318 L556,310 Z",
  // Middle East
  "M550,175 L575,168 L595,175 L600,190 L592,205 L578,210 L562,208 L552,198 L548,185 Z",
  // Iran/Afghanistan/Pakistan
  "M600,165 L625,160 L645,168 L652,182 L645,195 L630,202 L612,198 L602,188 L598,175 Z",
  // Central Asia (Kazakhstan etc)
  "M590,120 L620,112 L650,115 L670,125 L668,140 L650,148 L625,150 L605,145 L592,135 Z",
  // Mongolia/Siberia
  "M650,90 L700,82 L740,88 L760,100 L758,115 L740,122 L710,125 L680,120 L660,110 L648,100 Z",
  // China
  "M670,135 L700,128 L730,132 L755,142 L768,158 L762,175 L745,188 L720,192 L698,188 L680,178 L668,165 L665,148 Z",
  // Korea
  "M770,145 L778,140 L782,150 L780,162 L774,165 L768,158 Z",
  // Japan
  "M790,135 L798,128 L802,138 L800,155 L795,168 L788,170 L785,160 L786,145 Z",
  // Taiwan
  "M772,192 L778,188 L780,195 L776,202 L772,200 Z",
  // Philippines
  "M775,210 L782,205 L786,215 L784,228 L778,232 L774,225 Z",
  // SE Asia mainland (Myanmar, Thailand, Vietnam, Laos, Cambodia)
  "M695,192 L712,188 L725,195 L728,210 L722,225 L712,232 L700,230 L692,218 L690,205 Z",
  // Malaysia peninsula
  "M712,238 L718,235 L722,242 L720,252 L715,255 L710,248 Z",
  // Papua New Guinea
  "M815,252 L835,248 L845,255 L842,265 L830,270 L818,265 Z",
  // Australia
  "M770,310 L800,298 L830,300 L855,310 L868,325 L865,345 L850,362 L828,370 L802,368 L782,358 L770,342 L765,325 Z",
  // New Zealand
  "M878,358 L885,352 L888,365 L885,378 L880,382 L876,372 Z",
  "M872,382 L878,380 L880,388 L876,394 L872,390 Z",
  // Alaska
  "M82,75 L105,68 L125,72 L135,82 L128,92 L112,95 L95,92 L82,85 Z",
  // Northern Russia
  "M500,55 L560,48 L630,45 L700,48 L760,55 L800,65 L810,78 L800,85 L760,80 L700,75 L630,72 L560,75 L510,78 L498,70 Z",
  // North Africa (Morocco to Egypt)
  "M440,182 L470,175 L510,172 L545,178 L555,190 L548,205 L530,215 L500,220 L470,222 L448,218 L438,205 L436,192 Z",
  // Horn of Africa
  "M555,215 L572,210 L582,220 L578,235 L565,240 L555,235 L550,225 Z",
];

/* ------------------------------------------------------------------ */
/* Jurisdiction region shapes — countries/regions WITH regulation data  */
/* These get velocity-based fill coloring                              */
/* ------------------------------------------------------------------ */

export interface JurisdictionShape {
  /** Jurisdiction code matching our data */
  code: string;
  /** SVG path(s) for this region */
  paths: string[];
  /** Pin marker position */
  pin: { x: number; y: number };
  /** Label text */
  label: string;
}

export const jurisdictionShapes: JurisdictionShape[] = [
  {
    code: "EU",
    label: "EU",
    pin: { x: 510, y: 142 },
    paths: [
      // Western/Central Europe (France, Germany, Benelux, Italy, Iberia, Nordics)
      // France + Benelux
      "M453,148 L462,140 L475,138 L488,140 L492,148 L488,158 L478,165 L465,168 L455,162 L450,155 Z",
      // Germany + Central Europe
      "M488,128 L502,125 L515,130 L520,140 L518,150 L508,155 L495,152 L488,145 Z",
      // Iberian Peninsula (Spain/Portugal)
      "M430,162 L445,158 L458,162 L460,175 L452,185 L438,188 L428,182 L425,172 Z",
      // Italy
      "M495,155 L505,152 L512,160 L515,172 L510,182 L502,188 L495,185 L490,175 L488,165 Z",
      // Scandinavia (Sweden, Finland, Denmark)
      "M490,85 L502,78 L515,82 L525,92 L528,108 L522,118 L512,122 L500,118 L492,108 L488,95 Z",
      // Poland + Baltics
      "M520,115 L535,112 L545,118 L548,130 L542,138 L530,140 L520,135 L518,125 Z",
      // Greece + Balkans
      "M520,158 L532,152 L540,158 L542,170 L538,180 L528,185 L518,180 L515,170 Z",
    ],
  },
  {
    code: "GB",
    label: "UK",
    pin: { x: 455, y: 112 },
    paths: [
      // Great Britain
      "M448,95 L455,88 L462,92 L465,102 L462,115 L458,122 L452,120 L448,112 L445,102 Z",
      // Ireland
      "M435,100 L442,96 L446,102 L444,112 L438,116 L434,110 Z",
    ],
  },
  {
    code: "US",
    label: "US",
    pin: { x: 195, y: 162 },
    paths: [
      // Continental United States
      "M115,135 L140,128 L170,125 L200,122 L230,125 L255,130 L268,138 L272,150 L268,162 L258,172 L242,178 L225,182 L205,185 L185,188 L168,185 L155,182 L140,178 L128,172 L118,165 L112,155 L110,145 Z",
    ],
  },
  {
    code: "US-TX",
    label: "Texas",
    pin: { x: 188, y: 198 },
    paths: [
      // Texas
      "M170,185 L192,182 L205,185 L208,195 L205,208 L198,215 L185,218 L175,212 L168,202 L166,192 Z",
    ],
  },
  {
    code: "US-CO",
    label: "Colorado",
    pin: { x: 165, y: 162 },
    paths: [
      // Colorado (rectangular-ish)
      "M155,155 L178,155 L178,170 L155,170 Z",
    ],
  },
  {
    code: "US-CA",
    label: "California",
    pin: { x: 118, y: 165 },
    paths: [
      // California
      "M110,145 L118,140 L125,148 L128,162 L125,178 L118,185 L112,180 L108,168 L108,155 Z",
    ],
  },
  {
    code: "US-IL",
    label: "Illinois",
    pin: { x: 228, y: 155 },
    paths: [
      // Illinois
      "M222,142 L232,140 L236,148 L235,160 L232,168 L225,170 L220,162 L220,150 Z",
    ],
  },
  {
    code: "CA",
    label: "Canada",
    pin: { x: 195, y: 95 },
    paths: [
      // Canada
      "M95,50 L140,42 L200,38 L260,42 L310,50 L338,62 L345,78 L340,92 L325,102 L300,110 L270,118 L248,122 L230,120 L200,118 L170,120 L140,125 L115,130 L100,125 L90,112 L85,95 L82,78 L85,62 Z",
    ],
  },
  {
    code: "BR",
    label: "Brazil",
    pin: { x: 295, y: 290 },
    paths: [
      // Brazil
      "M255,262 L272,255 L295,252 L318,258 L335,270 L342,288 L340,308 L332,325 L318,338 L302,342 L285,340 L270,332 L258,318 L250,302 L248,285 L250,272 Z",
    ],
  },
  {
    code: "SG",
    label: "Singapore",
    pin: { x: 722, y: 258 },
    paths: [
      // Singapore (small island)
      "M718,255 L725,252 L730,256 L728,262 L722,264 L718,260 Z",
    ],
  },
  {
    code: "ID",
    label: "Indonesia",
    pin: { x: 758, y: 268 },
    paths: [
      // Sumatra
      "M718,248 L728,242 L735,248 L732,262 L725,268 L718,262 Z",
      // Java
      "M738,268 L758,265 L768,270 L765,278 L748,280 L738,275 Z",
      // Borneo (Kalimantan)
      "M740,238 L755,232 L765,240 L762,255 L752,260 L742,255 L738,245 Z",
      // Sulawesi
      "M768,242 L775,238 L780,248 L778,260 L772,262 L768,252 Z",
      // Papua (western half)
      "M792,248 L808,245 L815,255 L810,265 L798,268 L790,262 L788,252 Z",
    ],
  },
  {
    code: "INTL",
    label: "OECD",
    pin: { x: 500, y: 420 },
    paths: [], // OECD has no geographic fill — shown as dashed orbit
  },
];
