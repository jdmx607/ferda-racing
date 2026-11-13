// Primary paint-scheme colour per car number — drives the 3px accent bar on driver
// cards. Keyed by car number (not driver) so it survives driver swaps. Edit freely;
// anything missing falls back to a neutral grey.
export const PAINT_BY_CAR = {
  "1":  "#38A3E8", "2":  "#D9DCE3", "3":  "#E11D2E", "4":  "#E0A800",
  "5":  "#2F5BD8", "6":  "#1AA6A0", "7":  "#2ECC40", "8":  "#E11D2E",
  "9":  "#3B6FD8", "10": "#9B1B1B", "11": "#1F2A4A", "12": "#F2D100",
  "16": "#E5E7EB", "17": "#F28C28", "19": "#F26B21", "20": "#F5A623",
  "21": "#C62828", "22": "#E53935", "23": "#5B2A9B", "24": "#F0412B",
  "33": "#1E40AF", "34": "#F2C500", "35": "#C6E21C", "38": "#1F4EB4",
  "41": "#9CA3AF", "42": "#1E9E4A", "43": "#2AA0DC", "45": "#D32F2F",
  "47": "#C62828", "48": "#8B2F9B", "51": "#1D4E9E", "54": "#8BC34A",
  "71": "#1B3A8A", "77": "#2C8FE0", "84": "#7CB342", "88": "#16376B",
  "97": "#B3262E",
};
const FALLBACK = "#4B5563";

/** "#24 William Byron" → "24" */
export function carNumber(driverName = "") {
  const m = String(driverName).match(/^#(\S+)/);
  return m ? m[1] : "";
}

export function paintFor(driverName) {
  return PAINT_BY_CAR[carNumber(driverName)] || FALLBACK;
}
