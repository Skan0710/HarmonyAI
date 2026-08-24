import { AssistantTool, AssistantToolContext, ToolExecutionResult, ToolParameterSchema } from './toolTypes.js';
import { MusicSearchTool } from './musicSearchTool.js';
import { SemanticSearchTool } from './semanticSearchTool.js';
import { RecommendationsTool } from './recommendationsTool.js';
import { PersonalizedRecommendationsTool } from './personalizedRecommendationsTool.js';
import { ContextualRecommendationsTool } from './contextualRecommendationsTool.js';
import { PlaylistCreationTool } from './playlistCreationTool.js';
import { PlaylistModificationTool } from './playlistModificationTool.js';
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
    // 1. Keyword Music Search
    const musicSearch = new MusicSearchTool();
    this.registerTool(musicSearch);
    this.registerAlias('keyword_music_search', musicSearch);

    // 2. Semantic Music Search
    const semanticSearch = new SemanticSearchTool();
    this.registerTool(semanticSearch);
    this.registerAlias('semantic_music_search', semanticSearch);

    // 3. Personalized Recommendations
    const personalizedRecs = new PersonalizedRecommendationsTool();
    this.registerTool(personalizedRecs);

    // 4. Contextual Recommendations
    const contextualRecs = new ContextualRecommendationsTool();
    this.registerTool(contextualRecs);
    this.registerTool(new RecommendationsTool());

    // 5. User Taste / Preference Retrieval
    const userPrefTool = new UserPreferenceRetrievalTool();
    this.registerTool(userPrefTool);
    this.registerAlias('user_taste_retrieval', userPrefTool);

    // 6. Playlist Creation
    const playlistCreate = new PlaylistCreationTool();
    this.registerTool(playlistCreate);
    this.registerAlias('playlist_creation', playlistCreate);

    // 7. Playlist Modification (consolidated: add_songs, remove_songs, update_metadata)
    const playlistMod = new PlaylistModificationTool();
    this.registerTool(playlistMod);
    this.registerAlias('playlist_modification', playlistMod);
    this.registerAlias('add_to_playlist', playlistMod);
    this.registerAlias('remove_from_playlist', playlistMod);

    // 8. Queue Management (consolidated: add, add_next, remove, clear, list)
    const queueMgmt = new QueueManagementTool();
    this.registerTool(queueMgmt);
    this.registerAlias('add_to_queue', queueMgmt);
    this.registerAlias('remove_from_queue', queueMgmt);
    this.registerAlias('clear_queue', queueMgmt);
  }

  static registerTool(tool: AssistantTool): void {
    this.tools.set(tool.name, tool);
  }

  static registerAlias(aliasName: string, tool: AssistantTool): void {
    const aliasWrapper: AssistantTool = {
      name: aliasName,
      description: tool.description,
      parameters: tool.parameters,
      validate: (input: unknown) => tool.validate(input),
      execute: (input: any, context: AssistantToolContext) => tool.execute(input, context),
    };
    this.tools.set(aliasName, aliasWrapper);
  }

  static getTool(name: string): AssistantTool | undefined {
    return this.tools.get(name);
  }

  static getAllTools(): AssistantTool[] {
    return Array.from(this.tools.values());
  }

  static getToolDefinitions(): ToolDefinitionDTO[] {
    // Return unique definitions by primary tool name
    const uniqueDefs = new Map<string, ToolDefinitionDTO>();
    for (const tool of this.tools.values()) {
      if (!uniqueDefs.has(tool.name)) {
        uniqueDefs.set(tool.name, {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        });
      }
    }
    return Array.from(uniqueDefs.values());
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
