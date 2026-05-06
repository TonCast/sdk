export const Endpoints = {
  categories: {
    list: "/v1/categories",
  },
  paris: {
    list: "/v1/paris",
    byId: (id: string) => `/v1/paris/${id}`,
    oddsState: (id: string) => `/v1/paris/${id}/odds-state`,
    coefficientHistory: (id: string) => `/v1/paris/${id}/coefficient-history`,
    winners: (id: string) => `/v1/paris/${id}/winners`,
  },
  bets: {
    forPariByUser: (pariId: string, userAddress: string) =>
      `/v1/bets/${pariId}/user/${userAddress}`,
    forUser: (userAddress: string) => `/v1/bets/user/${userAddress}`,
  },
} as const;
