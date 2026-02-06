#!/usr/bin/env node
/**
 * Content Loader - Reads content from markdown files
 * 
 * Loads Flow and Notebook content templates from markdown files
 * instead of hardcoded JavaScript objects
 */

const fs = require('fs').promises;
const path = require('path');

const CONTENT_DIR = path.join(__dirname, '../content');

/**
 * Parse markdown file into Flow structure (efforts/projects/tasks)
 */
function parseFlowMarkdown(content) {
  const efforts = [];
  let currentEffort = null;
  let currentProject = null;
  let currentTask = null;
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Effort (H1)
    if (line.startsWith('# ')) {
      if (currentEffort) efforts.push(currentEffort);
      currentEffort = {
        name: line.substring(2),
        description: '',
        icon: null,
        color: null,
        estimatedDays: null,
        projects: [],
      };
      currentProject = null;
    }
    // Project (H2)
    else if (line.startsWith('## ')) {
      if (currentProject && currentEffort) {
        currentEffort.projects.push(currentProject);
      }
      currentProject = {
        name: line.substring(3),
        description: '',
        tasks: [],
      };
      currentTask = null;
    }
    // Task (H3 or bullet)
    else if (line.startsWith('### ') || line.startsWith('- ')) {
      if (currentTask && currentProject) {
        currentProject.tasks.push(currentTask);
      }
      const title = line.startsWith('### ') 
        ? line.substring(4) 
        : line.substring(2);
      currentTask = {
        title: title.trim(),
        description: '',
        isMilestone: title.includes('⭐') || title.includes('Milestone'),
      };
    }
    // Description (paragraph after heading)
    else if (line && currentTask) {
      if (currentTask.description) {
        currentTask.description += ' ' + line;
      } else {
        currentTask.description = line;
      }
    }
    // Metadata (key: value format, e.g., "**Icon:** rocket")
    else if (line.includes('**') && line.includes(':')) {
      const match = line.match(/\*\*(\w+):\*\*\s*(.+)/);
      if (match && currentEffort) {
        const key = match[1].toLowerCase();
        const value = match[2].trim();
        if (key === 'icon') {
          currentEffort.icon = value;
        } else if (key === 'color') {
          currentEffort.color = value;
        } else if (key === 'estimateddays' || key === 'estimated days') {
          currentEffort.estimatedDays = parseInt(value) || null;
        }
      }
    }
    // Description for effort/project (paragraph text)
    else if (line && !line.startsWith('#') && !line.startsWith('-') && !line.startsWith('*')) {
      if (currentEffort && !currentProject && !currentTask) {
        if (currentEffort.description) {
          currentEffort.description += ' ' + line;
        } else {
          currentEffort.description = line;
        }
      } else if (currentProject && !currentTask) {
        if (currentProject.description) {
          currentProject.description += ' ' + line;
        } else {
          currentProject.description = line;
        }
      }
    }
  }
  
  // Push last items
  if (currentTask && currentProject) {
    currentProject.tasks.push(currentTask);
  }
  if (currentProject && currentEffort) {
    currentEffort.projects.push(currentProject);
  }
  if (currentEffort) {
    efforts.push(currentEffort);
  }
  
  return { efforts };
}

/**
 * Parse markdown file into Notebook structure (notebooks/documents)
 * 
 * Format:
 * # Notebook Name
 * Notebook description (optional)
 * 
 * ## Document Title
 * Full markdown content for document (can include nested headings)
 * 
 * ## Another Document Title (at same level, after blank line)
 * More content...
 * 
 * Strategy: 
 * - First H2 after notebook H1 = First document
 * - If an H2 is preceded by a blank line AND followed by an H1, it's likely a new document
 * - Otherwise, if we're inside a document that has an H1, H2s are sections
 */
function parseNotebookMarkdown(content) {
  const notebooks = [];
  let currentNotebook = null;
  let currentDocument = null;
  let inNotebookDescription = false;
  let documentHasH1 = false; // Track if current document contains an H1
  let previousLineWasBlank = false;
  
  const lines = content.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const isBlank = trimmed === '';
    const nextNonBlankLine = lines.slice(i + 1).find(l => l.trim() !== '');
    const nextLineIsH1 = nextNonBlankLine && nextNonBlankLine.trim().startsWith('# ') && !nextNonBlankLine.trim().startsWith('##');
    
    // Notebook (H1) - only at top level (not inside a document)
    if (trimmed.startsWith('# ') && !trimmed.startsWith('##') && !currentDocument) {
      if (currentNotebook) notebooks.push(currentNotebook);
      currentNotebook = {
        name: trimmed.substring(2),
        description: '',
        documents: [],
      };
      currentDocument = null;
      inNotebookDescription = true;
      documentHasH1 = false;
      previousLineWasBlank = false;
    }
    // Document (H2) - determine if it's a new document or a section
    else if (trimmed.startsWith('## ') && currentNotebook && !inNotebookDescription) {
      // New document if:
      // 1. No current document, OR
      // 2. Previous line was blank AND next line is H1 (pattern: H2 title, then H1 for doc content), OR
      // 3. Current document doesn't have an H1 yet
      const shouldStartNewDocument = !currentDocument || 
                                     (previousLineWasBlank && nextLineIsH1) ||
                                     !documentHasH1;
      
      if (shouldStartNewDocument && currentDocument) {
        // Push previous document and start new one
        currentNotebook.documents.push(currentDocument);
        currentDocument = {
          title: trimmed.substring(3),
          filename: null,
          content: '',
        };
        documentHasH1 = false; // Reset for new document
      } else if (!currentDocument) {
        // First document
        currentDocument = {
          title: trimmed.substring(3),
          filename: null,
          content: '',
        };
        documentHasH1 = false;
      } else {
        // This H2 is a section within the current document
        if (currentDocument.content) {
          currentDocument.content += '\n' + line;
        } else {
          currentDocument.content = line;
        }
      }
    }
    // Notebook description (text after H1, before first H2)
    else if (trimmed && inNotebookDescription) {
      if (trimmed.startsWith('## ')) {
        // First H2 found, description is done
        inNotebookDescription = false;
        // Start first document
        currentDocument = {
          title: trimmed.substring(3),
          filename: null,
          content: '',
        };
        documentHasH1 = false;
      } else if (!trimmed.startsWith('#')) {
        if (currentNotebook.description) {
          currentNotebook.description += ' ' + trimmed;
        } else {
          currentNotebook.description = trimmed;
        }
      }
    }
    // Track H1 inside document (means nested H2s after this are sections)
    else if (trimmed.startsWith('# ') && !trimmed.startsWith('##') && currentDocument) {
      documentHasH1 = true;
      // Include H1 in document content
      if (currentDocument.content) {
        currentDocument.content += '\n' + line;
      } else {
        currentDocument.content = line;
      }
    }
    // Document content (everything else when we have a document)
    else if (currentDocument) {
      // Include the original line (with formatting) in content
      if (currentDocument.content) {
        currentDocument.content += '\n' + line;
      } else {
        currentDocument.content = line;
      }
    }
    
    previousLineWasBlank = isBlank;
  }
  
  // Push last items
  if (currentDocument && currentNotebook) {
    currentNotebook.documents.push(currentDocument);
  }
  if (currentNotebook) {
    notebooks.push(currentNotebook);
  }
  
  // Generate filenames
  notebooks.forEach(notebook => {
    notebook.documents.forEach((doc, idx) => {
      if (!doc.filename) {
        doc.filename = `${doc.title.toLowerCase().replace(/\s+/g, '-')}.md`;
      }
    });
  });
  
  return { notebooks };
}

/**
 * Get Flow template for team type and company size
 * Now supports JSON files (preferred) with markdown fallback
 */
async function getFlowTemplate(teamType, companySize) {
  const sizeDir = companySize === 'solo' ? 'solo' :
                  companySize === 'small-no-devs' ? 'small-no-devs' :
                  'small-with-devs';
  
  // Try JSON first (preferred format)
  const jsonPath = path.join(CONTENT_DIR, 'flow', sizeDir, `${teamType}.json`);
  try {
    const content = await fs.readFile(jsonPath, 'utf8');
    const data = JSON.parse(content);
    // Ensure it has the right structure
    if (data.efforts && Array.isArray(data.efforts)) {
      return { efforts: data.efforts };
    }
    return { efforts: [] };
  } catch (error) {
    if (error.code !== 'ENOENT') {
      // JSON exists but has parse error
      console.warn(`⚠️  Error parsing JSON file ${jsonPath}:`, error.message);
    }
  }
  
  // Fallback to markdown (for backward compatibility)
  const mdPath = path.join(CONTENT_DIR, 'flow', sizeDir, `${teamType}.md`);
  try {
    const content = await fs.readFile(mdPath, 'utf8');
    return parseFlowMarkdown(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty template
      return { efforts: [] };
    }
    throw error;
  }
}

/**
 * Get Notebook template for team type and company size
 */
async function getNotebookTemplate(teamType, companySize) {
  const sizeDir = companySize === 'solo' ? 'solo' :
                  companySize === 'small-no-devs' ? 'small-no-devs' :
                  'small-with-devs';
  
  const filePath = path.join(CONTENT_DIR, 'notebook', sizeDir, `${teamType}.md`);
  
  try {
    const content = await fs.readFile(filePath, 'utf8');
    return parseNotebookMarkdown(content);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty template
      return { notebooks: [] };
    }
    throw error;
  }
}

module.exports = {
  getFlowTemplate,
  getNotebookTemplate,
  parseFlowMarkdown,
  parseNotebookMarkdown,
};
