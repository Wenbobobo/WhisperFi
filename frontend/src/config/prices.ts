// src/config/prices.ts
// Demo price configuration - easily adjustable before presentations

export const DEMO_PRICES = {
  ETH: 4770.4,    // Adjustable ETH price  
  USDC: 1.00,      // Stable at $1
  DAI: 0.997,      // Slightly below $1
  WBTC: 115434.7,  // Bitcoin price
};

// Price update interval (in milliseconds)
export const PRICE_UPDATE_INTERVAL = 30000; // 30 seconds

// Enable/disable real API calls
export const USE_REAL_API = false; // Set to false for demo with fixed prices
