export const EN_MESSAGES: Record<string, string> = {
  basemapLabel: "Basemap:",
  basemapSelectAria: "Select basemap",
  statusBasemapChanged: "Basemap changed to {basemap}.",
  statusBasemapNotFound:
    "Could not find that basemap. Try: satellite, topographic, dark gray, or streets.",
};

export function t(key: string, replacements?: Record<string, string>): string {
  let msg = EN_MESSAGES[key] ?? key;
  if (replacements) {
    for (const [k, v] of Object.entries(replacements)) {
      msg = msg.replace(`{${k}}`, v);
    }
  }
  return msg;
}
