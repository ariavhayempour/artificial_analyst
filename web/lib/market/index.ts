// Barrel for the market-data layer. Importing the provider pulls in
// `server-only` (Polygon needs the secret key); import from `./types` directly
// if you only need the types in client code.
export * from "./types";
export { polygon, createPolygon } from "./polygon";
