#!/usr/bin/env node
/**
 * API Helper Functions for Notebook Onboarding
 * 
 * Provides HTTP client for Notebook API operations
 */

// Load environment variables
require('dotenv').config();

const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Get authentication token for Notebook API
 * Tries Supabase JWT first, falls back to password if available
 */
async function getNotebookAuthToken() {
  // Try password first (simpler fallback)
  const password = process.env.OPEN_NOTEBOOK_PASSWORD || process.env.NOTEBOOK_PASSWORD;
  if (password) {
    return password;
  }

  // Try to get Supabase JWT token directly
  try {
    const { createClient } = require('@supabase/supabase-js');
    // Try different possible env var names for Supabase URL and key
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl) {
      console.warn('⚠️  SUPABASE_URL not set, trying Notebook API login instead');
      // Fall through to Notebook API login below
    } else if (!supabaseAnonKey) {
      console.warn('⚠️  SUPABASE_ANON_KEY not set, trying Notebook API login instead');
      // Fall through to Notebook API login below
    } else {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const testUser = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
      const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';

      const { data, error } = await supabase.auth.signInWithPassword({
        email: testUser,
        password: testPassword,
      });

      if (error) {
        console.warn('⚠️  Supabase auth failed:', error.message);
      } else if (data?.session?.access_token) {
        return data.session.access_token;
      }
    }
  } catch (error) {
    // If Supabase client not available or fails, try Notebook API login
    console.warn('⚠️  Direct Supabase auth failed, trying Notebook API login:', error.message);

    const testUser = process.env.SUPABASE_TEST_USER || 'demo.user@playground.com';
    const testPassword = process.env.SUPABASE_TEST_PASSWORD || 'demouser';
    const apiPort = process.env.OPEN_NOTEBOOK_API_PORT;
    const baseURL = process.env.NOTEBOOK_API_URL;

    if (!baseURL && !apiPort) {
      console.warn('⚠️  Neither NOTEBOOK_API_URL nor OPEN_NOTEBOOK_API_PORT is set');
      return null;
    }

    const apiUrl = baseURL || `http://127.0.0.1:${apiPort}`;

    try {
      const response = await axios.post(`${apiUrl}/api/login`, {
        email: testUser,
        password: testPassword,
      }, {
        timeout: 10000,
      });

      if (response.data?.access_token) {
        return response.data.access_token;
      }
    } catch (apiError) {
      console.warn('⚠️  Notebook API login also failed:', apiError.message);
    }
  }

  return null;
}

/**
 * Create Notebook API client
 */
async function createNotebookClient() {
  // Use OPEN_NOTEBOOK_API_PORT to construct URL, or fallback to NOTEBOOK_API_URL
  const apiPort = process.env.OPEN_NOTEBOOK_API_PORT;
  const baseURL = process.env.NOTEBOOK_API_URL;

  if (!baseURL && !apiPort) {
    throw new Error('Either NOTEBOOK_API_URL or OPEN_NOTEBOOK_API_PORT environment variable must be set');
  }

  const apiUrl = baseURL || `http://127.0.0.1:${apiPort}`;

  // Get auth token
  const token = await getNotebookAuthToken();

  const client = axios.create({
    baseURL: apiUrl,
    timeout: 300000, // 5 minutes for long operations
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
  });

  return client;
}

/**
 * Create a notebook
 */
async function createNotebook(client, notebookData) {
  try {
    const response = await client.post('/api/notebooks', {
      name: notebookData.name,
      description: notebookData.description || '',
      team_id: notebookData.teamId || null,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Create a source (document) in a notebook
 * Supports both file upload and text content
 */
async function createSource(client, sourceData) {
  try {
    const formData = new FormData();

    // Add form fields
    formData.append('type', sourceData.type || 'text');
    formData.append('notebooks', JSON.stringify([sourceData.notebookId]));
    
    if (sourceData.title) {
      formData.append('title', sourceData.title);
    }

    if (sourceData.type === 'upload' && sourceData.filePath) {
      // File upload - read file and append
      const fileStream = fs.createReadStream(sourceData.filePath);
      const fileName = path.basename(sourceData.filePath);
      formData.append('file', fileStream, fileName);
    } else if (sourceData.type === 'text' && sourceData.content) {
      // Text content
      formData.append('content', sourceData.content);
    } else if (sourceData.type === 'link' && sourceData.url) {
      // URL link
      formData.append('url', sourceData.url);
    }

    if (sourceData.teamId) {
      formData.append('team_id', sourceData.teamId);
    }

    // Use multipart/form-data for file uploads
    const headers = {
      ...formData.getHeaders(),
      ...(client.defaults.headers.common['Authorization'] && {
        'Authorization': client.defaults.headers.common['Authorization'],
      }),
    };

    const response = await client.post('/api/sources', formData, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Create a note in a notebook
 */
async function createNote(client, noteData) {
  try {
    const response = await client.post('/api/notes', {
      title: noteData.title || null,
      content: noteData.content,
      note_type: noteData.noteType || 'human',
      notebook_id: noteData.notebookId || null,
      team_id: noteData.teamId || null,
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Get all notebooks (optionally filtered by team)
 */
async function getNotebooks(client, options = {}) {
  try {
    const params = {};
    if (options.archived !== undefined) {
      params.archived = options.archived;
    }
    if (options.orderBy) {
      params.order_by = options.orderBy;
    }

    const response = await client.get('/api/notebooks', { params });
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Delete a notebook (cascades to sources and notes)
 */
async function deleteNotebook(client, notebookId) {
  try {
    await client.delete(`/api/notebooks/${notebookId}`);
    return true;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Get sources for a notebook
 */
async function getSourcesForNotebook(client, notebookId) {
  try {
    const response = await client.get('/api/sources', {
      params: { notebook_id: notebookId },
    });
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Delete a source
 */
async function deleteSource(client, sourceId) {
  try {
    await client.delete(`/api/sources/${sourceId}`);
    return true;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Get notes for a notebook
 */
async function getNotesForNotebook(client, notebookId) {
  try {
    const response = await client.get('/api/notes', {
      params: { notebook_id: notebookId },
    });
    return Array.isArray(response.data) ? response.data : [response.data];
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

/**
 * Delete a note
 */
async function deleteNote(client, noteId) {
  try {
    await client.delete(`/api/notes/${noteId}`);
    return true;
  } catch (error) {
    if (error.response) {
      throw new Error(`Notebook API error: ${error.response.status} - ${error.response.data?.detail || error.message}`);
    }
    throw error;
  }
}

module.exports = {
  createNotebookClient,
  createNotebook,
  createSource,
  createNote,
  getNotebooks,
  deleteNotebook,
  getSourcesForNotebook,
  deleteSource,
  getNotesForNotebook,
  deleteNote,
};
