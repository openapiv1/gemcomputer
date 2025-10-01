import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import type { E2BDesktopServer } from "./e2b-desktop-server";

/**
 * E2B Desktop MCP Client
 * Client for communicating with E2B Desktop MCP Server
 */
export class E2BDesktopClient {
  private client: Client;
  private transport: InMemoryTransport | null = null;

  constructor() {
    this.client = new Client(
      {
        name: "e2b-desktop-client",
        version: "1.0.0",
      },
      {
        capabilities: {},
      }
    );
  }

  /**
   * Connect to the MCP server
   */
  async connect(server: E2BDesktopServer) {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    
    this.transport = clientTransport;
    
    // Connect client to transport
    await this.client.connect(clientTransport);
    
    // Connect server to transport
    await server.getServer().connect(serverTransport);
  }

  /**
   * List available tools
   */
  async listTools() {
    return await this.client.listTools();
  }

  /**
   * Call a tool
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async callTool(name: string, args: any) {
    return await this.client.callTool({
      name,
      arguments: args,
    });
  }

  /**
   * Close the connection
   */
  async close() {
    await this.client.close();
  }
}
