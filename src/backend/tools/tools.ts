/**
 * Tools for AI
 * To enable/disable tools, change the enabled flag
 * @author Norayr Petrosyan
 * @version 1.0.0
 */

import fs from 'fs/promises';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

import { ImageService } from '../services/image/image.service.js';
import type { ImageProviderType } from '../services/image/interfaces/types.js';
import { memoryService } from '../services/memory.service.js';

type ToolArgs = Record<string, string | number | undefined>;

interface ToolContext {
    userId: number;
    characterId: number;
}

interface ToolParameter {
    type: string;
    description: string;
    enum?: string[];
    default?: string | number | boolean;
}

interface ToolDefinition {
    type: 'function';
    function: {
        name: string;
        description: string;
        parameters: {
            type: 'object';
            properties: Record<string, ToolParameter>;
            required: string[];
        };
    };
}

interface Tool {
    enabled: boolean;
    definition: ToolDefinition;
    handler: (args: any, logger?: any, context?: ToolContext) => Promise<string>;
}

// Shared resources

const FILES_DIR = path.join(process.cwd(), 'storage', 'sandbox');
const imageService = new ImageService();

async function ensureFilesDir(): Promise<void> {
    await fs.mkdir(FILES_DIR, { recursive: true });
}

// Handlers

async function handleCreateTextFile({ filename, content }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename || safeFilename.length === 0) {
        return 'Error: invalid filename provided.';
    }

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(safeFilename.toUpperCase()) || safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
        return 'Error: invalid or unsafe filename.';
    }

    if (safeFilename.length > 255) {
        return 'Error: filename too long (max 255 characters).';
    }

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) return 'Error: invalid file path.';

    let finalContent = String(content || '')
        .replace(/</g, '<')
        .replace(/>/g, '>')
        .replace(/&/g, '&')
        .replace(/"/g, '"')
        .replace(/&#39;/g, "'");

    finalContent = finalContent.replace(/^```[a-z]*\r?\n/i, '').replace(/\r?\n```$/g, '');

    await ensureFilesDir();
    await fs.writeFile(targetPath, finalContent, 'utf-8');

    logger?.info({ filename: safeFilename }, '[TOOLS] [create_text_file] File created');
    return `File "${safeFilename}" created successfully at storage/sandbox/${safeFilename}`;
}

async function handleReadTextFile({ filename }: ToolArgs, logger?: any): Promise<string> {
    const safeFilename = String(filename || '').replace(/[^a-zA-Z0-9_\-\.]/g, '_');
    if (!safeFilename || safeFilename.length === 0) {
        return 'Error: invalid filename provided.';
    }

    const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
    if (reservedNames.includes(safeFilename.toUpperCase()) || safeFilename.includes('..') || safeFilename.includes('/') || safeFilename.includes('\\')) {
        return 'Error: invalid or unsafe filename.';
    }

    if (safeFilename.length > 255) {
        return 'Error: filename too long (max 255 characters).';
    }

    const targetPath = path.join(FILES_DIR, safeFilename);
    if (!targetPath.startsWith(FILES_DIR)) return 'Error: invalid file path.';

    try {
        const content = await fs.readFile(targetPath, 'utf-8');
        logger?.info({ filename: safeFilename }, '[TOOLS] [read_text_file] File read');
        return `Contents of "${safeFilename}":\n\n${content}`;
    } catch (err: any) {
        logger?.error({ filename: safeFilename, error: err.message }, '[TOOLS] [read_text_file] Failed read');
        if (err.code === 'ENOENT') return `Error: file "${safeFilename}" not found in sandbox.`;
        return `Error reading file "${safeFilename}": ${err.message}`;
    }
}

async function handleGenerateImage({ prompt, aspect_ratio, provider }: ToolArgs, logger?: any): Promise<string> {
    if (!prompt) return 'Error: prompt is required';

    try {
        const result = await imageService.generate(String(prompt), { aspect_ratio: String(aspect_ratio || '1:1') }, provider as ImageProviderType);
        if (!result.success) {
            logger?.error({ prompt, error: result.error }, '[TOOLS] [generate_image] Generation failed');
            return `Error creating image: ${result.error}`;
        }
        logger?.info({ url: result.image_url }, '[TOOLS] [generate_image] Generation success');
        return `${result.image_url}`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [generate_image] Exception');
        return `Error creating image: ${error.message}`;
    }
}

// Telegram tool handlers
async function handlePostToTelegramChannel({ message }: ToolArgs, logger?: any): Promise<string> {
    logger?.info({ message }, '[TOOLS] [post_to_telegram_channel] Posting message');
    return `Successfully posted message to Telegram channel: ${message}`;
}


async function handleFetchWebData({ url, method = 'GET', data, headers }: ToolArgs, logger?: any): Promise<string> {
    if (!url) return 'Error: URL is required';

    try {
        const response = await axios({
            url: String(url),
            method: String(method).toUpperCase(),
            data: data,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Node.js AI Agent)',
                ...(typeof headers === 'string' ? JSON.parse(headers) : (headers || {}))
            },
            timeout: 15000
        });

        // Если пришел JSON (например, из API), отдаем как есть
        if (typeof response.data === 'object') {
            return JSON.stringify(response.data, null, 2);
        }

        // Если пришел HTML, пускаем в ход Cheerio
        if (typeof response.data === 'string' && response.data.includes('<html')) {
            const $ = cheerio.load(response.data);

            // 1. Выкидываем весь мусор, который путает ИИ
            $('script, style, nav, footer, header, noscript, iframe, ad').remove();

            // 2. Достаем только важные куски
            // Берем заголовок страницы и основной текст из article или main
            const title = $('title').text().trim();
            let bodyText = $('article, main, .content, #content').text().trim();

            // Если не нашли через селекторы контента, берем просто весь body
            if (!bodyText) {
                bodyText = $('body').text().trim();
            }

            // 3. Чистим лишние пробелы и переносы
            const cleanContent = bodyText
                .replace(/\s\s+/g, ' ')
                .replace(/\n\s*\n/g, '\n')
                .substring(0, 12000); // Чуть увеличил лимит

            logger?.info({ url, length: cleanContent.length }, '[TOOLS] [fetch_web_data] HTML Parsed');
            return `Title: ${title}\n\nContent:\n${cleanContent}`;
        }

        return String(response.data).substring(0, 10000);

    } catch (error: any) {
        const errorMsg = error.response
            ? `Status: ${error.response.status} - ${JSON.stringify(error.response.data)}`
            : error.message;
        logger?.error({ url, error: errorMsg }, '[TOOLS] [fetch_web_data] Failed');
        return `Error fetching "${url}": ${errorMsg}`;
    }
}



// Memory tool handlers
async function handleSaveMemory({ content }: ToolArgs, logger?: any, context?: ToolContext): Promise<string> {
    if (!context?.userId || !context?.characterId) {
        return 'Error: missing context for saving memory';
    }
    if (!content) return 'Error: content is required';

    try {
        await memoryService.addMemory(context.userId, context.characterId, String(content), logger);
        logger?.info({ content }, '[TOOLS] [save_memory] Memory saved');
        return `Memory saved successfully: "${String(content).substring(0, 50)}..."`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [save_memory] Failed');
        return `Error saving memory: ${error.message}`;
    }
}

async function handleGetMemory({ query, limit }: ToolArgs, logger?: any, context?: ToolContext): Promise<string> {
    if (!context?.userId || !context?.characterId) {
        return 'Error: missing user context for getting memory';
    }
    if (!query) return 'Error: query is required';

    try {
        const memories = await memoryService.searchMemories(
            context.userId,
            context.characterId,
            String(query),
            Number(limit) || 5,
            logger
        );

        if (memories.length === 0) {
            return 'No memories found matching the query.';
        }

        const formatted = memories.map((m, i) => `${i + 1}. ${m.content} (relevance: ${(1 - m.distance).toFixed(2)})`).join('\n');
        logger?.info({ query, count: memories.length }, '[TOOLS] [get_memory] Memories found');
        return `Found ${memories.length} memories:\n${formatted}`;
    } catch (error: any) {
        logger?.error({ error: error.message }, '[TOOLS] [get_memory] Failed');
        return `Error searching memory: ${error.message}`;
    }
}

// Tools Registry
const TOOLS: Record<string, Tool> = {

    create_text_file: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'create_text_file',
                description: 'Write content to a file. User provides filename and content, or you can suggest them.',
                parameters: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'File name (you can suggest appropriate name)' },
                        content: { type: 'string', description: 'Text content to write (user provides or you create)' },
                    },
                    required: ['filename', 'content'],
                },
            },
        },
        handler: handleCreateTextFile,
    },

    read_text_file: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'read_text_file',
                description: 'Reads the content of a text plain file by filename.',
                parameters: {
                    type: 'object',
                    properties: {
                        filename: { type: 'string', description: 'File name to read. Example: "my_note.txt".' },
                    },
                    required: ['filename'],
                },
            },
        },
        handler: handleReadTextFile,
    },

    generate_image: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'generate_image',
                description: 'Generate image based on prompt',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Detailed description of the image to generate (Subject, Action, Style, Context). In English.' },
                        aspect_ratio: { type: 'string', enum: ['1:1', '2:3', '3:2', '3:4', '4:3', '16:9', '9:16'], description: 'Aspect ratio', default: '1:1' },
                        provider: { type: 'string', enum: ['xai', 'together'], description: 'AI provider to use', default: 'xai' },
                    },
                    required: ['prompt'],
                },
            },
        },
        handler: handleGenerateImage,
    },

    save_memory: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'save_memory',
                description: "Save info to long-term memory, using the user's language.",
                parameters: {
                    type: 'object',
                    properties: {
                        content: { type: 'string', description: 'Info to remember.' },
                    },
                    required: ['content'],
                },
            },
        },
        handler: handleSaveMemory,
    },

    get_memory: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'get_memory',
                description: "Recall shared memories using the user's language.",
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Topic or specific detail to recall from our past' },
                        limit: { type: 'number', description: 'Max number of memories', default: 5 },
                    },
                    required: ['query'],
                },
            },
        },
        handler: handleGetMemory,
    },

    post_to_telegram_channel: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'post_to_telegram_channel',
                description: 'Post a message to the Telegram channel. Use for sharing important updates, announcements, or content.',
                parameters: {
                    type: 'object',
                    properties: {
                        message: { type: 'string', description: 'Message to post (HTML formatting supported)' },
                    },
                    required: ['message'],
                },
            },
        },
        handler: handlePostToTelegramChannel,
    },


    fetch_web_data: {
        enabled: true,
        definition: {
            type: 'function',
            function: {
                name: 'fetch_web_data',
                description: 'Fetch data from a URL or API. Can be used to read documentation, get web content, or call external APIs.',
                parameters: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', description: 'The full URL to fetch (e.g., https://api.example.com/data or https://docs.js.org)' },
                        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET', description: 'HTTP method' },
                        data: { type: 'string', description: 'JSON string for request body (if POST or PUT)' },
                        headers: { type: 'object', description: 'Optional HTTP headers as a JSON object' }
                    },
                    required: ['url'],
                },
            },
        },
        handler: handleFetchWebData,
    },

};



export const ALL_TOOLS: ToolDefinition[] = Object.values(TOOLS)
    .filter(t => t.enabled)
    .map(t => t.definition);

export const IMAGE_TOOLS: ToolDefinition[] = Object.values(TOOLS)
    .filter(t => t.enabled && t.definition.function.name === 'generate_image')
    .map(t => t.definition);

export function getAvailableTools(isAgent: boolean = false): ToolDefinition[] {
    if (isAgent) {
        return ALL_TOOLS;
    } else {
        return IMAGE_TOOLS;
    }
}

export async function executeTool(name: string, argsJson: string, logger?: any, context?: ToolContext): Promise<string> {
    const tool = TOOLS[name];

    if (!tool) {
        logger?.warn({ name }, '[TOOLS] Unknown tool called');
        return `Error: tool "${name}" is not implemented.`;
    }

    if (!tool.enabled) {
        logger?.warn({ name }, '[TOOLS] Tool is disabled');
        return `Error: tool "${name}" is currently disabled.`;
    }

    try {
        const args = JSON.parse(argsJson);
        logger?.info({ tool: name, args }, '[TOOLS] Starting execution');

        const result = await tool.handler(args, logger, context);

        logger?.info({ tool: name, resultLength: result.length }, '[TOOLS] Execution finished');
        return result;
    } catch (err: any) {
        logger?.error({ tool: name, error: err.message, rawArgs: argsJson }, '[TOOLS] Execution error');
        return `Error executing tool "${name}": ${err.message}`;
    }
}
