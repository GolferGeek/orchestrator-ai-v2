#!/usr/bin/env node
/**
 * File System Helper Functions for Notebook Document Creation
 * 
 * Creates actual markdown files on disk for Notebook documents
 */

const fs = require('fs').promises;
const path = require('path');

/**
 * Get the base upload folder path
 */
function getBaseUploadFolder() {
  // Default to Notebook's data folder structure
  const dataFolder = process.env.NOTEBOOK_DATA_FOLDER || './apps/open-notebook/data';
  return path.join(dataFolder, 'uploads');
}

/**
 * Get team upload folder path
 */
function getTeamUploadFolder(teamId) {
  const baseFolder = getBaseUploadFolder();
  return path.join(baseFolder, 'teams', teamId);
}

/**
 * Get personal upload folder path
 */
function getPersonalUploadFolder(userId) {
  const baseFolder = getBaseUploadFolder();
  return path.join(baseFolder, 'personal', userId);
}

/**
 * Ensure directory exists
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    return true;
  } catch (error) {
    console.error(`❌ Failed to create directory ${dirPath}:`, error.message);
    throw error;
  }
}

/**
 * Create a markdown file with content
 * Returns the full file path
 */
async function createMarkdownFile(folderPath, filename, content) {
  // Ensure filename ends with .md
  const finalFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
  const filePath = path.join(folderPath, finalFilename);

  // Ensure directory exists
  await ensureDirectory(folderPath);

  // Write file
  try {
    await fs.writeFile(filePath, content, 'utf8');
    console.log(`  ✅ Created file: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error(`❌ Failed to write file ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Create a source-specific folder and file
 * Structure: {baseFolder}/teams/{teamId}/{sourceId}/{filename}.md
 */
async function createSourceFile(teamId, sourceId, filename, content) {
  const teamFolder = getTeamUploadFolder(teamId);
  const sourceFolder = path.join(teamFolder, sourceId);
  return await createMarkdownFile(sourceFolder, filename, content);
}

/**
 * Create a personal source file
 * Structure: {baseFolder}/personal/{userId}/{sourceId}/{filename}.md
 */
async function createPersonalSourceFile(userId, sourceId, filename, content) {
  const personalFolder = getPersonalUploadFolder(userId);
  const sourceFolder = path.join(personalFolder, sourceId);
  return await createMarkdownFile(sourceFolder, filename, content);
}

/**
 * Delete a file
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, that's okay
      return false;
    }
    console.error(`❌ Failed to delete file ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Delete a directory and all its contents
 */
async function deleteDirectory(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') {
      // Directory doesn't exist, that's okay
      return false;
    }
    console.error(`❌ Failed to delete directory ${dirPath}:`, error.message);
    throw error;
  }
}

/**
 * Find all files in a directory recursively
 */
async function findAllFiles(dirPath, extensions = ['.md', '.txt', '.pdf']) {
  const files = [];

  async function walkDir(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await walkDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (extensions.length === 0 || extensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      if (error.code !== 'ENOENT') {
        console.warn(`⚠️  Could not read directory ${currentPath}:`, error.message);
      }
    }
  }

  try {
    await walkDir(dirPath);
  } catch (error) {
    // Directory doesn't exist, return empty array
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  return files;
}

/**
 * Get file size in bytes
 */
async function getFileSize(filePath) {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

module.exports = {
  getBaseUploadFolder,
  getTeamUploadFolder,
  getPersonalUploadFolder,
  ensureDirectory,
  createMarkdownFile,
  createSourceFile,
  createPersonalSourceFile,
  deleteFile,
  deleteDirectory,
  findAllFiles,
  getFileSize,
};
