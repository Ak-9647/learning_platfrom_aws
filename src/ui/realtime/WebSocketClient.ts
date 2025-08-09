export type Message = { type: string; payload?: unknown };

export class WebSocketClient {
  private url: string;
  private ws: WebSocket | null = null;
  private backoffMs = 500;
  private readonly maxBackoffMs = 5000;
  private readonly queue: string[] = [];

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.backoffMs = 500;
      // flush queue
      while (this.queue.length && this.ws && this.ws.readyState === WebSocket.OPEN) {
        const msg = this.queue.shift();
        if (msg) this.ws.send(msg);
      }
    };
    this.ws.onclose = () => {
      this.ws = null;
      setTimeout(() => this.connect(), this.backoffMs);
      this.backoffMs = Math.min(this.backoffMs * 2, this.maxBackoffMs);
    };
  }

  send(msg: Message) {
    const payload = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    } else {
      this.queue.push(payload);
    }
  }
}
