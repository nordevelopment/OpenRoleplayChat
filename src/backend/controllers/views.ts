import type { FastifyInstance } from 'fastify';

export async function viewsRoutes(server: FastifyInstance) {
    // Login / Index page
    server.get('/', async (request, reply) => {
        if (request.session.user) {
            return reply.redirect('/characters');
        }
        return reply.view('index.ejs');
    });

    // Chat page
    server.get('/chat', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('chat.ejs');
    });

    // Characters catalog page
    server.get('/characters', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('characters.ejs');
    });

    // Image generation page
    server.get('/image-gen', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('image-gen.ejs');
    });

    // User profile settings page
    server.get('/profile', async (request, reply) => {
        if (!request.session.user) {
            return reply.redirect('/');
        }
        return reply.view('profile.ejs');
    });
}
