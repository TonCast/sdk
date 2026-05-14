export interface HttpTransportRequest {
  method: "GET" | "POST" | "PUT" | "DELETE";
  url: string;
  headers: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal | undefined;
}

export interface HttpTransportResponse {
  status: number;
  statusText?: string | undefined;
  headers: Record<string, string>;
  body: unknown;
}

export interface HttpTransport {
  request(req: HttpTransportRequest): Promise<HttpTransportResponse>;
}

export class FetchHttpTransport implements HttpTransport {
  async request(req: HttpTransportRequest): Promise<HttpTransportResponse> {
    const init: RequestInit = {
      method: req.method,
      headers: req.headers,
    };
    if (req.body !== undefined) init.body = JSON.stringify(req.body);
    if (req.signal) init.signal = req.signal;
    const response = await fetch(req.url, init);
    const text = await response.text().catch(() => "");
    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: parseBody(text),
    };
  }
}

function parseBody(text: string): unknown {
  if (text.length === 0) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
