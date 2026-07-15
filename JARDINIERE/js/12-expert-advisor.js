        // ── AI REVIEW — Critique des plans de fabrication via Claude API ───────────

        function openAiReview() {
            const modal = document.getElementById('modal-ai-review');
            if(!modal) return;
            modal.style.display = 'flex';
            const keyInput = document.getElementById('ai-review-key-input');
            if(keyInput) {
                const stored = localStorage.getItem('anthropic_api_key') || '';
                keyInput.value = stored;
            }
            const body = document.getElementById('ai-review-body');
            if(body) body.innerHTML = '<span style="color:#666;">Entrez votre clé API puis cliquez sur Analyser.</span>';
        }

        function closeAiReview() {
            const modal = document.getElementById('modal-ai-review');
            if(modal) modal.style.display = 'none';
        }

        // ── Sérialisation des modèles de fabrication ───────────────────────────────

        function serializeModelsForReview() {
            const objects = [];

            function collectObject(label, model) {
                if(!model) return;
                const pieces = (model.pieces || []).filter(p => p && p.dim && p.family !== 'Tissu');
                if(!pieces.length) return;
                const pieceLines = pieces.map(p => {
                    const L = Math.round(p.dim.L * 100);
                    const H = Math.round(p.dim.H * 100);
                    const T = Math.round(p.dim.T * 100);
                    return `  - ${p.label} [${p.family}] : ${L}×${H}×${T} cm (L×H×T)`;
                });
                const screwLines = (model.screws || []).map(sc => {
                    const x = Math.round(sc.x * 100);
                    const y = Math.round(sc.y * 100);
                    const z = Math.round(sc.z * 100);
                    return `  - vis Ø${sc.diaMm}mm axe-${sc.axis} en (${x},${y},${z}) cm sur pièce ${sc.pieceId} — ${sc.role}`;
                });
                objects.push({ label, pieceLines, screwLines });
            }

            (typeof jardinières !== 'undefined' ? jardinières : []).forEach((j, i) => {
                if(!j) return;
                try {
                    const model = buildJardiniereFabricationModel(j, computeJardiniereConstructionMetrics(j));
                    collectObject(`Jardinière ${i + 1} (${Math.round(j.w*10)}×${Math.round(j.d*10)}×${Math.round(j.h*10)} cm)`, model);
                } catch(e) {}
            });

            (typeof bancs !== 'undefined' ? bancs : []).forEach((b, i) => {
                if(!b) return;
                try { collectObject(`Banc ${i + 1} (${Math.round(b.w*10)}×${Math.round(b.d*10)}×${Math.round(b.h*10)} cm)`, buildBancFabricationModel(b)); } catch(e) {}
            });

            (typeof cubes !== 'undefined' ? cubes : []).forEach((c, i) => {
                if(!c) return;
                try { collectObject(`Méridienne ${i + 1} (${Math.round(c.w*10)}×${Math.round(c.d*10)}×${Math.round(c.h*10)} cm)`, buildMeridienneFabricationModel(c)); } catch(e) {}
            });

            (typeof tables !== 'undefined' ? tables : []).forEach((t, i) => {
                if(!t) return;
                try { collectObject(`Table ${i + 1} (${Math.round(t.w*10)}×${Math.round(t.d*10)}×${Math.round(t.h*10)} cm)`, buildTableFabricationModel(t)); } catch(e) {}
            });

            (typeof chairs !== 'undefined' ? chairs : []).forEach((c, i) => {
                if(!c) return;
                try { collectObject(`Chaise ${i + 1} (${Math.round(c.w*10)}×${Math.round(c.d*10)}×${Math.round(c.h*10)} cm)`, buildChairFabricationModel(c)); } catch(e) {}
            });

            return objects;
        }

        function buildReviewPrompt(objects) {
            if(!objects.length) return null;

            const lines = [];
            lines.push(`Tu es un expert en menuiserie, structure bois et mobilier extérieur.`);
            lines.push(`Voici les plans de fabrication de ${objects.length} objet(s) en bois destinés à un balcon ou une terrasse extérieure.`);
            lines.push(`Les dimensions sont en centimètres (L×H×T). Les sections de base utilisées sont : planches 20×145 mm, lambourdes 70×45 mm.`);
            lines.push(``);
            lines.push(`Pour chaque objet, donne une critique concise et directe :`);
            lines.push(`- Ce qui est bien conçu`);
            lines.push(`- Ce qui est structurellement discutable ou fragile`);
            lines.push(`- Des propositions d'amélioration concrètes (sections, assemblages, renforts)`);
            lines.push(`- Toute remarque utile sur la faisabilité en atelier`);
            lines.push(``);
            lines.push(`Sois précis, pas exhaustif. Concentre-toi sur les points qui méritent vraiment attention. Réponds en français.`);
            lines.push(``);

            objects.forEach(obj => {
                lines.push(`=== ${obj.label} ===`);
                lines.push(`Pièces :`);
                obj.pieceLines.forEach(l => lines.push(l));
                if(obj.screwLines.length > 0) {
                    lines.push(`Assemblages (vis) :`);
                    obj.screwLines.forEach(l => lines.push(l));
                }
                lines.push(``);
            });

            return lines.join('\n');
        }

        // ── Appel API Claude ───────────────────────────────────────────────────────

        async function runAiReview() {
            const body = document.getElementById('ai-review-body');
            const keyInput = document.getElementById('ai-review-key-input');
            if(!body || !keyInput) return;

            const apiKey = keyInput.value.trim();
            if(!apiKey || !apiKey.startsWith('sk-')) {
                body.innerHTML = '<span style="color:#e05555;">Clé API invalide. Elle doit commencer par sk-ant-...</span>';
                return;
            }
            localStorage.setItem('anthropic_api_key', apiKey);

            const objects = serializeModelsForReview();
            if(!objects.length) {
                body.innerHTML = '<span style="color:#888;">Aucun objet avec plan de fabrication dans le projet.</span>';
                return;
            }

            const prompt = buildReviewPrompt(objects);
            body.innerHTML = '<span style="color:#888;">Analyse en cours…</span>';

            try {
                const response = await fetch('https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: {
                        'content-type': 'application/json',
                        'x-api-key': apiKey,
                        'anthropic-version': '2023-06-01',
                        'anthropic-dangerous-direct-browser-access': 'true',
                    },
                    body: JSON.stringify({
                        model: 'claude-sonnet-4-6',
                        max_tokens: 1500,
                        messages: [{ role: 'user', content: prompt }],
                    }),
                });

                if(!response.ok) {
                    const err = await response.json().catch(() => ({}));
                    body.innerHTML = `<span style="color:#e05555;">Erreur API (${response.status}) : ${err.error?.message || response.statusText}</span>`;
                    return;
                }

                const data = await response.json();
                const text = (data.content || []).map(b => b.text || '').join('');
                body.innerHTML = renderMarkdownLight(text);

            } catch(e) {
                body.innerHTML = `<span style="color:#e05555;">Erreur réseau : ${e.message}</span>`;
            }
        }

        // ── Rendu markdown minimal (titres, gras, listes) ─────────────────────────

        function renderMarkdownLight(text) {
            const escaped = text
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');

            const html = escaped
                .replace(/^### (.+)$/gm, '<h4 style="color:var(--accent);margin:10px 0 3px;">$1</h4>')
                .replace(/^## (.+)$/gm, '<h3 style="color:var(--accent);margin:12px 0 4px;">$1</h3>')
                .replace(/^=== (.+) ===$\n?/gm, '<div class="air-obj-title">$1</div>')
                .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                .replace(/^- (.+)$/gm, '<li style="margin-left:14px;margin-bottom:2px;">$1</li>')
                .replace(/(<li[^>]*>.*<\/li>\n?)+/g, m => `<ul style="margin:4px 0;padding:0;">${m}</ul>`)
                .replace(/\n{2,}/g, '</p><p style="margin:0 0 8px;">')
                .replace(/\n/g, '<br>');

            return `<p style="margin:0 0 8px;">${html}</p>`;
        }
