// Stable identity for a driver across feed spellings and car-number changes.
// "#12 Ryan Blaney", "Ryan Blaney" and "Ryan  Blaney (i)" all → "ryanblaney".
// Keyed by NAME (not car number) because numbers get reused/reassigned — e.g.
// #6 is Ryan Preece in 2027 but was Brad Keselowski's number.

export function nameKey(raw) {
  let s = String(raw || "").replace(/^#\S+\s+/, "");
  s = s.split(" / ")[0];                              // "#33 Austin Hill / Jesse Love" → first driver
  s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); // Suárez → Suarez
  s = s.replace(/\([^)]*\)/g, " ");                   // "(i)", "(R)", "(C)"
  return s.toLowerCase().replace(/[^a-z]/g, "");
}
