import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { MusicSearchTool } from './musicSearchTool.js';
import { SemanticSearchTool } from './semanticSearchTool.js';
import { RecommendationsTool } from './recommendationsTool.js';
import { PlaylistCreationTool } from './playlistCreationTool.js';
import { AddToPlaylistTool } from './addToPlaylistTool.js';
import { RemoveFromPlaylistTool } from './removeFromPlaylistTool.js';
import { PlaylistModificationTool } from './playlistModificationTool.js';
import { AddToQueueTool } from './addToQueueTool.js';
import { RemoveFromQueueTool } from './removeFromQueueTool.js';
import { ClearQueueTool } from './clearQueueTool.js';
import { QueueManagementTool } from './queueManagementTool.js';
import { UserPreferenceRetrievalTool } from './userPreferenceRetrievalTool.js';

export interface ToolDefinitionDTO {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
}

export class ToolRegistry {
  private static tools: Map<string, AssistantTool> = new Map();

  static {
    // Register Discovery Tools
    this.registerTool(new MusicSearchTool());
    this.registerTool(new SemanticSearchTool());
    this.registerTool(new RecommendationsTool());
    this.registerTool(new UserPreferenceRetrievalTool());

    // Register Playlist Tools
    this.registerTool(new PlaylistCreationTool());
    this.registerTool(new AddToPlaylistTool());
    this.registerTool(new RemoveFromPlaylistTool());
    this.registerTool(new PlaylistModificationTool());

    // Register Queue Tools
    this.registerTool(new AddToQueueTool());
    this.registerTool(new RemoveFromQueueTool());
    this.registerTool(new ClearQueueTool());
    this.registerTool(new QueueManagementTool());
  }

  static registerTool(tool: AssistantTool): void {
    this.tools.set(tool.name, tool);
  }

  static getTool(name: string): AssistantTool | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): AssistantTool[] {
    return Array.from(this.tools.values());
  }

  static getToolDefinitions(): ToolDefinitionDTO[] {
    return Array.from(this.tools.values()).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }

  /**
   * Executes a registered assistant tool by name, handling validation and execution in isolation.
   */
  static async executeTool(
    toolName: string,
    input: unknown,
    context: AssistantToolContext
  ): Promise<ToolExecutionResult> {
    const tool = this.getTool(toolName);
    if (!tool) {
      return {
        success: false,
        toolName,
        error: `Tool "${toolName}" is not registered in the assistant tool architecture.`,
      };
    }

    const validation = tool.validate(input);
    if (!validation.valid || validation.data === undefined) {
      return {
        success: false,
        toolName,
        error: validation.error || `Validation failed for tool "${toolName}".`,
      };
    }

    return await tool.execute(validation.data, context);
  }
}
