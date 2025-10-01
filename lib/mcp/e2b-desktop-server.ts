import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import type { Sandbox } from "@e2b/desktop";

// Schema definitions for E2B desktop actions
const computerUseSchema = z.object({
  action: z.enum([
    "screenshot",
    "left_click",
    "double_click",
    "right_click",
    "mouse_move",
    "type",
    "key",
    "scroll",
    "left_click_drag",
    "wait"
  ]),
  coordinate: z.array(z.number()).optional(),
  text: z.string().optional(),
  scroll_direction: z.enum(["up", "down"]).optional(),
  scroll_amount: z.number().optional(),
  start_coordinate: z.array(z.number()).optional(),
  duration: z.number().optional(),
});

const bashCommandSchema = z.object({
  command: z.string(),
});

/**
 * E2B Desktop MCP Server
 * Provides Model Context Protocol server for E2B desktop sandbox operations
 */
export class E2BDesktopServer {
  private server: Server;
  private desktop: Sandbox | null = null;

  constructor() {
    this.server = new Server(
      {
        name: "e2b-desktop-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  /**
   * Set the desktop sandbox instance
   */
  setDesktop(desktop: Sandbox) {
    this.desktop = desktop;
  }

  private setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error("[E2B Desktop MCP Error]", error);
    };
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "computer_use",
          description: "Use the computer to perform actions like clicking, typing, taking screenshots, etc.",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: zodToJsonSchema(computerUseSchema) as any,
        },
        {
          name: "bash_command",
          description: "Execute bash commands on the computer",
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          inputSchema: zodToJsonSchema(bashCommandSchema) as any,
        },
      ],
    }));

    // Handle tool execution
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.desktop) {
        throw new McpError(
          ErrorCode.InternalError,
          "Desktop sandbox not initialized"
        );
      }

      const { name, arguments: args } = request.params;

      if (name === "computer_use") {
        return await this.handleComputerUse(args);
      } else if (name === "bash_command") {
        return await this.handleBashCommand(args);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleComputerUse(args: any) {
    const parsed = computerUseSchema.safeParse(args);
    if (!parsed.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid computer_use arguments"
      );
    }

    const { action, coordinate, text, scroll_direction, scroll_amount, start_coordinate, duration } = parsed.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = { type: "text", text: "" };

    switch (action) {
      case "screenshot": {
        const image = await this.desktop!.screenshot();
        const base64Data = Buffer.from(image).toString("base64");
        result = {
          type: "image",
          data: base64Data,
        };
        break;
      }
      case "wait": {
        const actualDuration = Math.min(duration || 1, 2);
        await new Promise(resolve => setTimeout(resolve, actualDuration * 1000));
        result.text = `Waited for ${actualDuration} seconds`;
        break;
      }
      case "left_click": {
        if (!coordinate || coordinate.length < 2) {
          throw new McpError(ErrorCode.InvalidParams, "coordinate required for left_click");
        }
        const [x, y] = coordinate;
        await this.desktop!.moveMouse(x, y);
        await this.desktop!.leftClick();
        result.text = `Left clicked at ${x}, ${y}`;
        break;
      }
      case "double_click": {
        if (!coordinate || coordinate.length < 2) {
          throw new McpError(ErrorCode.InvalidParams, "coordinate required for double_click");
        }
        const [x, y] = coordinate;
        await this.desktop!.moveMouse(x, y);
        await this.desktop!.doubleClick();
        result.text = `Double clicked at ${x}, ${y}`;
        break;
      }
      case "right_click": {
        if (!coordinate || coordinate.length < 2) {
          throw new McpError(ErrorCode.InvalidParams, "coordinate required for right_click");
        }
        const [x, y] = coordinate;
        await this.desktop!.moveMouse(x, y);
        await this.desktop!.rightClick();
        result.text = `Right clicked at ${x}, ${y}`;
        break;
      }
      case "mouse_move": {
        if (!coordinate || coordinate.length < 2) {
          throw new McpError(ErrorCode.InvalidParams, "coordinate required for mouse_move");
        }
        const [x, y] = coordinate;
        await this.desktop!.moveMouse(x, y);
        result.text = `Moved mouse to ${x}, ${y}`;
        break;
      }
      case "type": {
        if (!text) {
          throw new McpError(ErrorCode.InvalidParams, "text required for type action");
        }
        await this.desktop!.write(text);
        result.text = `Typed: ${text}`;
        break;
      }
      case "key": {
        if (!text) {
          throw new McpError(ErrorCode.InvalidParams, "text required for key action");
        }
        const keyToPress = text === "Return" ? "enter" : text;
        await this.desktop!.press(keyToPress);
        result.text = `Pressed key: ${text}`;
        break;
      }
      case "scroll": {
        if (!scroll_direction) {
          throw new McpError(ErrorCode.InvalidParams, "scroll_direction required for scroll action");
        }
        const amount = scroll_amount || 3;
        await this.desktop!.scroll(scroll_direction, amount);
        result.text = `Scrolled ${scroll_direction} by ${amount} clicks`;
        break;
      }
      case "left_click_drag": {
        if (!start_coordinate || start_coordinate.length < 2 || !coordinate || coordinate.length < 2) {
          throw new McpError(ErrorCode.InvalidParams, "start_coordinate and coordinate required for left_click_drag");
        }
        const [startX, startY] = start_coordinate;
        const [endX, endY] = coordinate;
        await this.desktop!.drag([startX, startY], [endX, endY]);
        result.text = `Dragged from (${startX}, ${startY}) to (${endX}, ${endY})`;
        break;
      }
      default: {
        result.text = `Unknown action: ${action}`;
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async handleBashCommand(args: any) {
    const parsed = bashCommandSchema.safeParse(args);
    if (!parsed.success) {
      throw new McpError(
        ErrorCode.InvalidParams,
        "Invalid bash_command arguments"
      );
    }

    const { command } = parsed.data;
    const result = await this.desktop!.commands.run(command);
    const output = result.stdout || result.stderr || "(Command executed successfully with no output)";

    return {
      content: [
        {
          type: "text",
          text: output,
        },
      ],
    };
  }

  getServer() {
    return this.server;
  }
}
