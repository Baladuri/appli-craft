import { FileSystemManager } from '../core/fs-manager';
import { ClaudeClient } from '../core/claude-client';
import { ApplicationContext, AgentOutput } from '../core/types';
import * as path from 'path';

/**
 * Abstract base class that defines the core contract for all agents in the AppliCraft project.
 * Enforces a consistent interface for execution and standardized file-based output.
 */
export abstract class BaseAgent {
  public agentName: string;
  protected fs: FileSystemManager;
  protected llm: ClaudeClient;

  /**
   * Initializes the BaseAgent with its name and core infrastructure components.
   * @param agentName - Unique name for the agent (e.g., 'Researcher', 'Analyst')
   * @param fs - Instance of FileSystemManager for disk operations
   * @param llm - Instance of ClaudeClient for AI interactions
   */
  constructor(agentName: string, fs: FileSystemManager, llm: ClaudeClient) {
    this.agentName = agentName;
    this.fs = fs;
    this.llm = llm;
  }

  /**
   * The main workflow execution method for the agent.
   * This must be implemented by all inheriting agents.
   * 
   * @param context - The context of the current job application
   * @param outputDir - The directory where results should be stored
   * @returns A promise resolving to an AgentOutput status object
   */
  abstract execute(context: ApplicationContext, outputDir: string): Promise<AgentOutput>;

  /**
   * Helper method to write agent output content to a specific file.
   * Builds the full path based on the provided output directory.
   * 
   * @param fileName - The name of the file to create
   * @param content - The text content to write to the file
   * @param outputDir - The base directory for output
   * @returns The full absolute path to the written file
   */
  protected writeOutput(fileName: string, content: string, outputDir: string): string {
    const filePath = path.join(outputDir, fileName);
    // Note: fs implementation ensures directory exists if needed
    this.fs.ensureDirectory(filePath);
    this.fs.writeFile(filePath, content);
    return filePath;
  }
}
