// KIS Open API types — trimmed to the 국내주식 현재가 endpoint this app uses.
// Ported from investmentdiary's src/lib/kis/types.ts (issue #5 research).

// The payload defaults to `unknown`, not `any`: every caller has to run it through a
// schema in kis/schemas.ts before reading a field.
export interface KISResponse<T = unknown> {
  rt_cd: string // Return code ("0" = success)
  msg_cd: string // Message code
  msg1: string // Message 1
  output?: T // Response data
}

export interface KISTokenRequest {
  grant_type: "client_credentials";
  appkey: string;
  appsecret: string;
}

export interface KISTokenResponse {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;
}

export interface ProcessedStockPrice {
  ticker: string;
  date: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  metadata: {
    /** The raw KIS payload, kept verbatim so a schema can be written from real data. */
    originalData: unknown;
    lastUpdated: string;
  };
}

export interface KISError {
  rt_cd: string;
  msg_cd: string;
  msg1: string;
}

export class KISApiError extends Error {
  constructor(
    public error: KISError,
    public endpoint?: string
  ) {
    super(`KIS API Error [${error.rt_cd}]: ${error.msg1}`);
    this.name = "KISApiError";
  }
}

export interface KISRequestConfig {
  timeout?: number;
}
