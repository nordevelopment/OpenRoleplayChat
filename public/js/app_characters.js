document.addEventListener('alpine:init', () => {
    Alpine.data('characterManager', () => ({
        characters: [],
        async init() {
            if (typeof this.checkAuth === 'function') {
                if (!(await this.checkAuth())) return;
            }

            this.loadCharacters();
        },

        async loadCharacters() {
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            try {
                const res = await fetch(`${apiBase}/characters`);
                if (res.status === 401) {
                    if (typeof this.logout === 'function') this.logout();
                    return;
                }
                if (!res.ok) {
                    console.error('Error loading characters:', res.status, res.statusText);
                    return;
                }
                this.characters = await res.json();
                console.log('Loaded characters:', this.characters);
            } catch (error) {
                console.error('Network error loading characters:', error);
            }
        },

        async deleteCharacter(slug) {
            if (!confirm('Delete this character and all their history?')) return;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            await fetch(`${apiBase}/characters/${slug}`, { method: 'DELETE' });
            await fetch(`${apiBase}/history/${slug}`, { method: 'DELETE' });
            this.loadCharacters();
        },

        async clearAllHistory() {
            if (!confirm('DANGER: Clear ALL chat history?')) return;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            await fetch(`${apiBase}/history/all`, { method: 'DELETE' });
            alert('History cleared');
        }
    }));
});
