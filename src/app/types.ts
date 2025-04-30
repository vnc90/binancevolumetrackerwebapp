export type CoinData = {
  symbol: string;
  baseAsset: string;
  fullName?: string;
  logoUrl?: string;
  currentPrice: number;
  currentVolume: number;
  marketCap: number;
  changes: {
    price: {
      percent: number;
    };
    volume: {
      percent: number;
    };
  };
  timestamp: number;
};

export type AlertData = CoinData & {
  alertTime: number;
}; 