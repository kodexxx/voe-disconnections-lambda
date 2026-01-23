/**
 * FlareSolverr API response
 */
export interface FlareSolverrResponse {
  status: string;
  message: string;
  solution: {
    url: string;
    status: number;
    cookies: any[];
    userAgent: string;
    headers: Record<string, string>;
    response: string;
  };
  startTimestamp?: number;
  endTimestamp?: number;
}
