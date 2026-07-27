// ---------------------------------------------------------------------------
// The HTTP API contract exposed by the PulseBridge showcase server and consumed
// by the webapp. Single source of truth for both sides.
// ---------------------------------------------------------------------------

export type PluginStatus = "enabled" | "disabled" | "degraded" | "error";

export interface PluginInfo {
  pluginId: string;
  status: PluginStatus;
  version?: string;
  lastRunAt?: string;
  lastError?: string;
}

export interface HealthInfo {
  status: string;
  running: boolean;
  version: string;
}

export interface ViewSnapshot {
  view: string;
  generatedAt: string;
  items: unknown[];
}

export interface TickerItem {
  coinId: string;
  name: string;
  symbol: string;
  priceUsd: number;
  change24hPercent: number;
  priceDelta: number;
  direction: "up" | "down" | "flat";
  updatedAt: string;
}

export interface WeatherItem {
  city: string;
  country: string;
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  updatedAt: string;
}

export interface DigestHighlightWeather {
  city: string;
  country: string;
  temp: number;
  description: string;
}

export interface DigestHighlightCrypto {
  symbol: string;
  priceUsd: number;
  change24hPercent: number;
  direction: TickerItem["direction"];
}

export interface DigestItem {
  weather: { locationCount: number; highlights: DigestHighlightWeather[] };
  crypto: { coinCount: number; highlights: DigestHighlightCrypto[] };
  spaceOfTheDay: {
    title: string;
    explanation: string;
    date: string;
    imageUrl?: string;
    copyright?: string;
  };
}

export type SeismicAlert = "green" | "yellow" | "orange" | "red" | null;

export interface SeismicItem {
  id: string;
  magnitude: number;
  magnitudeType: string;
  place: string;
  depth: number;
  latitude: number;
  longitude: number;
  significance: number;
  tsunami: boolean;
  alert: SeismicAlert;
  url: string;
  eventTime: string;
  updatedAt: string;
}

export interface RecordTypeCount {
  type: string;
  count: number;
}

// ---------------------------------------------------------------------------
// Records — the raw envelope every integration emits, plus per-type payloads
// ---------------------------------------------------------------------------

export interface PulseRecord<T = Record<string, unknown>> {
  type: string;
  timestamp: string;
  source: string;
  entityKey: string;
  data: T;
}

export interface AirQualityData {
  locationId: number;
  locationName: string;
  parameter: string;
  value: number;
  unit: string;
  latitude?: number;
  longitude?: number;
  country?: string;
}

export interface InternetAnomalyData {
  anomalyType: "traffic" | "bgp_hijack";
  startDate: string;
  endDate?: string;
  status?: string;
  location?: string;
  asn?: number;
  asnName?: string;
  description?: string;
}

export interface CveData {
  cveId: string;
  description: string;
  published: string;
  lastModified: string;
  severity: string;
  baseScore: number;
  cvssVersion: string;
  references: string[];
}

export interface NewsEventData {
  title: string;
  url: string;
  domain: string;
  language: string;
  sourceCountry: string;
  seenDate: string;
  socialImage?: string;
}

export interface SolarFlareData {
  flrId: string;
  classType: string;
  severity: string;
  beginTime: string;
  peakTime?: string;
  endTime?: string;
  sourceLocation?: string;
  activeRegionNum?: number;
  link: string;
}

export interface EconomicIndicatorData {
  seriesId: string;
  value: number;
  date: string;
}

export interface MarketQuoteData {
  symbol: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  tradeTimestamp: string;
}

export type ConnectionState = "connecting" | "live" | "down";

// ---------------------------------------------------------------------------
// Runtime type guards for narrowing `unknown[]` view items on the client
// ---------------------------------------------------------------------------

export function isPulseRecord(value: unknown): value is PulseRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    "type" in value &&
    "entityKey" in value &&
    "data" in value
  );
}

export function isTickerItem(value: unknown): value is TickerItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "symbol" in value &&
    "priceUsd" in value
  );
}

export function isWeatherItem(value: unknown): value is WeatherItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "city" in value &&
    "temp" in value &&
    "humidity" in value
  );
}

export function isDigestItem(value: unknown): value is DigestItem {
  return (
    typeof value === "object" && value !== null && "spaceOfTheDay" in value
  );
}

export function isSeismicItem(value: unknown): value is SeismicItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "magnitude" in value &&
    "latitude" in value &&
    "longitude" in value
  );
}

export interface NewsFeedItem {
  id: string;
  title: string;
  url: string;
  domain: string;
  language: string;
  sourceCountry: string;
  seenDate: string;
  source: string;
  summary?: string;
  updatedAt: string;
}

export interface WildfireFeedItem {
  id: string;
  latitude: number;
  longitude: number;
  brightness: number;
  frp: number;
  confidence: string;
  instrument: string;
  acquisitionDate: string;
  acquisitionTime: string;
  satellite: string;
  updatedAt: string;
}

export interface FlightFeedItem {
  id: string;
  icao24: string;
  callsign: string | null;
  latitude: number;
  longitude: number;
  altitudeM: number | null;
  speedKt: number | null;
  heading: number | null;
  onGround: boolean;
  source: string;
  updatedAt: string;
}

export function isNewsFeedItem(value: unknown): value is NewsFeedItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "url" in value &&
    "domain" in value &&
    "seenDate" in value
  );
}

export function isWildfireFeedItem(value: unknown): value is WildfireFeedItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "frp" in value &&
    "brightness" in value &&
    "satellite" in value
  );
}

export function isFlightFeedItem(value: unknown): value is FlightFeedItem {
  return (
    typeof value === "object" &&
    value !== null &&
    "icao24" in value &&
    "onGround" in value
  );
}
