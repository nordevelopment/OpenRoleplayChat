document.addEventListener('alpine:init', () => {
    Alpine.data('characterFormApp', () => ({
        form: {
            slug: null,
            name: '',
            avatar: '',
            system_prompt: '',
            scenario: '',
            first_message: '',
            temperature: 0.8,
            max_tokens: 300,
            is_agent: false,
            reasoning: false
        },
        avatarFile: null,
        formInvalid: false,
        saveLoading: false,

        async init() {
            if (typeof this.checkAuth === 'function') {
                if (!(await this.checkAuth())) return;
            }

            const slug = window.CHARACTER_EDIT_SLUG;
            if (slug) {
                const apiBase = window.APP_CONFIG?.apiBase || '/api';
                try {
                    const res = await fetch(`${apiBase}/characters/${slug}`);
                    if (res.ok) {
                        const char = await res.json();
                        this.form = { ...char };
                        this.form.is_agent = char.is_agent === 1;
                        this.form.reasoning = char.reasoning === 1;
                    } else {
                        console.error('Failed to load character matrix:', res.statusText);
                    }
                } catch (e) {
                    console.error('Error fetching character matrix:', e);
                }
            }
        },

        onAvatarChange(event) {
            this.avatarFile = event.target.files[0];
        },

        async saveCharacter() {
            const formEl = document.getElementById('characterForm');
            if (!formEl.checkValidity()) {
                this.formInvalid = true;
                return;
            }

            this.saveLoading = true;
            const apiBase = window.APP_CONFIG?.apiBase || '/api';
            const url = this.form.slug ? `${apiBase}/characters/${this.form.slug}` : `${apiBase}/characters`;
            const method = this.form.slug ? 'PUT' : 'POST';

            try {
                // Если выбран файл аватара - сначала загружаем его
                if (this.avatarFile) {
                    const avatarFormData = new FormData();
                    avatarFormData.append('file', this.avatarFile);
                    const uploadRes = await fetch(`${apiBase}/characters/upload-avatar`, {
                        method: 'POST',
                        body: avatarFormData
                    });
                    if (uploadRes.ok) {
                        const uploadData = await uploadRes.json();
                        this.form.avatar = uploadData.path;
                    } else {
                        throw new Error('Avatar upload failed');
                    }
                }

                // Преобразуем is_agent и reasoning в число для SQLite
                const formData = { ...this.form };
                formData.is_agent = formData.is_agent ? 1 : 0;
                formData.reasoning = formData.reasoning ? 1 : 0;

                const res = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });
                if (res.ok) {
                    const appPrefix = window.APP_CONFIG?.appPrefix || '';
                    window.location.href = appPrefix + '/characters';
                } else {
                    const data = await res.json();
                    alert('Error: ' + data.error);
                }
            } catch (err) {
                alert('Error saving character');
            } finally {
                this.saveLoading = false;
            }
        }
    }));
});
