export const OAUTH_APP_ID = import.meta.env.VITE_OAUTH_APP_ID as string;
export const PORTAL_URL =
  (import.meta.env.VITE_PORTAL_URL as string) || "https://www.arcgis.com";
export const GEOCODE_URL =
  "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates";
export const APP_TITLE =
  (import.meta.env.VITE_APP_TITLE as string) || "GeoVoice Assistant";
