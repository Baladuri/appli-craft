import { Octokit } from '@octokit/rest';
import { config } from '../config/index';
import { GitHubRepo } from './types';

/**
 * A thin wrapper around the GitHub REST API using Octokit.
 * Handles fetching repository data for the configured user.
 */
export class GitHubClient {
  private octokit: Octokit;
  private username: string;

  constructor() {
    this.octokit = new Octokit({
      auth: config.githubToken,
    });
    this.username = config.githubUsername;
  }

  /**
   * Fetches the public repositories for the configured GitHub username.
   * Limits the result to the first 30 repositories sorted by last update.
   * Transforms the Octokit response into the internal GitHubRepo structure.
   * 
   * @returns A promise that resolves to an array of GitHubRepo objects.
   * @throws Error if the GitHub API call fails.
   */
  async getUserRepos(): Promise<GitHubRepo[]> {
    if (config.mockMode) {
      return [
        {
          name: 'mock-repo-1',
          description: 'A mock repository for testing the AppliCraft project.',
          language: 'TypeScript',
          stars: 12,
          url: 'https://github.com/example/mock-repo-1',
          topics: ['typescript', 'automation', 'testing']
        },
        {
          name: 'mock-repo-2',
          description: 'A second mock repository to verify list handling.',
          language: 'JavaScript',
          stars: 5,
          url: 'https://github.com/example/mock-repo-2',
          topics: ['javascript', 'example']
        },
        {
          name: 'mock-repo-3',
          description: null,
          language: 'Python',
          stars: 0,
          url: 'https://github.com/example/mock-repo-3',
          topics: []
        }
      ];
    }

    try {
      const { data } = await this.octokit.rest.repos.listForUser({
        username: this.username,
        type: 'owner',
        per_page: 30,
        sort: 'updated'
      });

      return data.map((repo: any) => ({
        name: repo.name,
        description: repo.description || null,
        language: repo.language || null,
        stars: repo.stargazers_count || 0,
        url: repo.html_url,
        topics: repo.topics || []
      }));
    } catch (error: any) {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }
}
