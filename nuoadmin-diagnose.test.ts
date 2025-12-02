import { describe, test, expect, beforeAll, afterAll } from "bun:test";

describe("NuoAdmin Diagnose API", () => {
  let server: any;
  const PORT = 8081; // Use different port for testing

  beforeAll(async () => {
    // Start the server for testing
    const { Bun } = globalThis as any;
    server = Bun.serve({
      port: PORT,
      fetch: async (req: Request) => {
        const url = new URL(req.url);
        
        if (url.pathname === "/list-tickets") {
          const DASSAULT_PATH = "/support/tickets/dassault";
          try {
            const dirents = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: DASSAULT_PATH, onlyFiles: false }));
            const tickets = (dirents as string[]).filter((d: string) => d.startsWith('zd')).sort();
            return new Response(JSON.stringify({ tickets }), { headers: { "Content-Type": "application/json" } });
          } catch (err) {
            const msg = err && typeof err === "object" && "message" in err ? (err as any).message : String(err);
            return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { "Content-Type": "application/json" } });
          }
        }
        
        return new Response("Not Found", { status: 404 });
      },
    });
  });

  afterAll(() => {
    if (server) {
      server.stop();
    }
  });

  test("GET /list-tickets should return ZD ticket directories", async () => {
    const response = await fetch(`http://localhost:${PORT}/list-tickets`);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty("tickets");
    expect(Array.isArray(data.tickets)).toBe(true);
    expect(data.tickets.length).toBeGreaterThan(0);
    
    // Verify all tickets start with 'zd'
    for (const ticket of data.tickets) {
      expect(ticket).toMatch(/^zd/);
    }
  });

  test("GET /list-tickets should return sorted ticket list", async () => {
    const response = await fetch(`http://localhost:${PORT}/list-tickets`);
    const data = await response.json();
    
    // Verify tickets are sorted
    const sortedTickets = [...data.tickets].sort();
    expect(data.tickets).toEqual(sortedTickets);
  });

  test("ZD tickets directory should exist and be readable", async () => {
    const DASSAULT_PATH = "/support/tickets/dassault";
    const { Bun } = globalThis as any;
    
    try {
      const dirents = await Array.fromAsync(new Bun.Glob("*").scan({ cwd: DASSAULT_PATH, onlyFiles: false }));
      expect(dirents.length).toBeGreaterThan(0);
      
      const zdDirs = (dirents as string[]).filter((d: string) => d.startsWith('zd'));
      expect(zdDirs.length).toBeGreaterThan(0);
      
      console.log(`Found ${zdDirs.length} ZD ticket directories`);
      console.log(`Sample tickets: ${zdDirs.slice(0, 5).join(', ')}`);
    } catch (err) {
      throw new Error(`Failed to read directory: ${err}`);
    }
  });
});
