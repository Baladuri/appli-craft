import * as fs from 'fs';
import * as path from 'path';

export class FileSystemManager {
  private outputBaseDir: string;

  constructor(outputBaseDir: string) {
    this.outputBaseDir = outputBaseDir;
  }

  /**
   * Creates a directory if it does not exist
   * Supports nested directories (recursive: true)
   * @param dirPath - The directory path to create
   * @returns void
   */
  public ensureDirectory(dirPath: string): void {
    const dir = path.dirname(dirPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Creates a folder structure like:
   * /applications/company-role-date/
   * Sanitizes company and role to be filesystem-safe (lowercase, replace spaces with -)
   * @param outputBaseDir - The base directory for applications
   * @param company - The company name
   * @param role - The role name
   * @param date - The date in YYYY-MM-DD format
   * @returns The absolute path of the created folder
   */
  public createApplicationFolder(outputBaseDir: string, company: string, role: string, date: string): string {
    this.ensureDirectory(outputBaseDir);

    const sanitizedCompany = company.toLowerCase().replace(/ /g, '-');
    const sanitizedRole = role.toLowerCase().replace(/ /g, '-');
    const folderPath = path.join(outputBaseDir, 'applications', `${sanitizedCompany}-${sanitizedRole}-${date}`);

    this.ensureDirectory(folderPath);

    return folderPath;
  }

  /**
   * Writes string content to a file
   * Overwrites if file already exists
   * @param filePath - The file path
   * @param content - The content to write
   * @returns void
   */
  public writeFile(filePath: string, content: string): void {
    fs.writeFileSync(filePath, content);
  }

  /**
   * Reads file content as UTF-8 string
   * @param filePath - The file path
   * @returns The content of the file
   */
  public readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  /**
   * Returns true if file exists
   * @param filePath - The file path
   * @returns true if file exists
   */
  public fileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }
}