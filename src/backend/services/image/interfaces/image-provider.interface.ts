import type { GenerateOptions, ImageResult, EditOptions, DeleteResult } from './types.js';

export interface IImageProvider {
    generate(prompt: string, options?: GenerateOptions): Promise<ImageResult>;

    editImage(prompt: string, options: EditOptions): Promise<ImageResult>;

    deleteImage(filename: string): Promise<DeleteResult>;

    listImages(): Promise<{ success: boolean; images: any[]; error?: string }>;
}
