// Singura paletă din joc. Nicio altă culoare nu se folosește în cod, UI sau text.
// Primele 16 culori sunt pentru interfață, text, obstacole și personajele-rezervă; restul sunt nuanțele peisajelor.
const PALETTE = {
  // --- interfață și obiecte
  black:  "#000000", navy:   "#1D2B53", plum:   "#7E2553", dgreen: "#008751",
  brown:  "#AB5236", dgray:  "#5F574F", lgray:  "#C2C3C7", white:  "#FFF1E8",
  red:    "#FF004D", orange: "#FFA300", yellow: "#FFEC27", green:  "#00E436",
  blue:   "#29ADFF", lav:    "#83769C", pink:   "#FF77A8", peach:  "#FFCCAA",

  // --- cer: zi, amurg, dimineață, noapte
  skyA: "#1AA3DB", skyB: "#33B6E5", skyC: "#58C7EE", skyD: "#8ADBF4",
  cloud: "#FFFFFF", cloudShade: "#C6E4F1",
  duskA: "#3B2A6B", duskB: "#7A3E7E", duskC: "#C9587A", duskD: "#F08A5D", duskE: "#FFC27A",
  mornA: "#7EC6E6", mornB: "#B6DBEA", mornC: "#F3D6C2", mornD: "#FFE7C8",
  nightA: "#100C26", nightB: "#1F1746", nightC: "#372564", nightD: "#553276",
  moon: "#FFF6D8", star: "#FFE9A8",

  // --- munți
  mtnFarLit: "#6CAEDB", mtnFar: "#4A91C5", mtnFarShade: "#326DA1",
  snow: "#F2F8FC", snowShade: "#B5D2E9",
  rockLit: "#B2ACDF", rock: "#8680BE", rockShade: "#5D5795", rockDeep: "#423D72",
  mtnDuskLit: "#B0708E", mtnDusk: "#6E4C8C", mtnDuskShade: "#43356E",
  mtnMornLit: "#C4C2E3", mtnMorn: "#9D9BC9", mtnMornShade: "#7774A8",
  mtnNightLit: "#5D72A8", mtnNight: "#3B4B7B", mtnNightShade: "#26335A",
  snowNight: "#C8D5EF", snowNightShade: "#8A9BC7",

  // --- păduri, brazi, iarbă, pietre, pământ
  forestFar: "#2A6A8C", forestFarDark: "#1E4F6E",
  forestDusk: "#2B2D52", forestDuskDark: "#1A1C38", forestNight: "#11182F",
  pineLit: "#6CB34D", pine: "#3F8E3A", pineShade: "#25632F", pineDeep: "#163F26", trunk: "#6E4128",
  grassLit: "#C8E25A", grass: "#9BCA3E", grassShade: "#68A133", grassDeep: "#3F7329",
  grassNightLit: "#4C7F5F", grassNight: "#2F5B4B", grassNightShade: "#1E3D34",
  haze: "#9EC2D8", hazeDark: "#7DA5C1",
  stoneLit: "#BAB8CD", stone: "#8C8AA6", stoneShade: "#5E5C79",
  dirt: "#7A4B2E", dirtDark: "#55331F",

  // --- obstacole: ciuperci, cai, mânere de sabie
  creamLit: "#FFF4E0", cream: "#EBDCC2", creamShade: "#C9B597", creamDeep: "#9C8466",
  capLit: "#FF6B5E", capRed: "#D9283A", capShade: "#A0182E", capDeep: "#6B1022",
  horseLit: "#B8743F", horse: "#8E5530", horseShade: "#633A20", horseMane: "#2A1A12",
  goldLit: "#FFE680", gold: "#E0A93A", goldShade: "#9A6A1E"
};
