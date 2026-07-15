        // --- CONSEILLER D'AMENAGEMENT ---

        function runLayoutAdvisor() {
            const target = document.getElementById('layout-advisor-results');
            if(!target) return;
            const button = document.getElementById('btn-layout-advisor');

            if(target.innerHTML.trim()) {
                target.innerHTML = '';
                if(button) button.setAttribute('aria-expanded', 'false');
                return;
            }

            const analysis = analyzeBalconyLayoutWellbeing();
            target.innerHTML = renderLayoutAdvisorResults(analysis);
            if(button) button.setAttribute('aria-expanded', 'true');
        }

        function analyzeBalconyLayoutWellbeing() {
            const sources = getLayoutAdvisorSources();
            const plan = summarizeLayoutAdvisorPlan(sources);
            const objects = summarizeLayoutAdvisorObjects();
            const sunlight = summarizeLayoutAdvisorSunlight();
            const privacy = summarizeLayoutAdvisorPrivacy();
            const advice = buildLayoutAdvisorAdvice(plan, objects, sunlight, privacy);
            const proposals = buildLayoutAdvisorProposals(plan, objects, sunlight, privacy);
            const nextSteps = buildLayoutAdvisorNextSteps(sunlight, privacy);

            return { plan, objects, sunlight, privacy, advice, proposals, nextSteps };
        }

        function getLayoutAdvisorSources() {
            if(typeof getSolarMapSourcePolygons === 'function') {
                try {
                    const sources = getSolarMapSourcePolygons();
                    if(Array.isArray(sources) && sources.length) return sources;
                } catch(e) {}
            }
            if(typeof getPrimaryContourPolygon2D === 'function') {
                const polygon = getPrimaryContourPolygon2D();
                if(Array.isArray(polygon) && polygon.length >= 3) return [{ id: 'primary', polygon }];
            }
            return [];
        }

        function summarizeLayoutAdvisorPlan(sources) {
            const polygons = sources
                .map(source => source && source.polygon)
                .filter(poly => Array.isArray(poly) && poly.length >= 3);
            const areaM2 = polygons.reduce((sum, poly) => sum + Math.abs(getLayoutAdvisorPolygonArea(poly)) / 40000, 0);
            const bounds = getLayoutAdvisorCombinedBounds(polygons);
            const widthM = bounds ? bounds.width / 200 : 0;
            const depthM = bounds ? bounds.height / 200 : 0;
            const center = bounds ? { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 } : null;
            return {
                hasPlan: polygons.length > 0,
                surfaceCount: polygons.length,
                areaM2,
                widthM,
                depthM,
                center
            };
        }

        function summarizeLayoutAdvisorObjects() {
            const groups = [
                { key: 'jardinieres', label: 'jardinières', items: typeof jardinières !== 'undefined' ? jardinières : [], plantLike: true },
                { key: 'trees', label: 'arbres en pot', items: typeof pottedTrees !== 'undefined' ? pottedTrees : [], plantLike: true },
                { key: 'benches', label: 'bancs', items: typeof bancs !== 'undefined' ? bancs : [], seating: true },
                { key: 'loungers', label: 'méridiennes', items: typeof cubes !== 'undefined' ? cubes : [], seating: true },
                { key: 'tables', label: 'tables', items: typeof tables !== 'undefined' ? tables : [], table: true },
                { key: 'chairs', label: 'chaises', items: typeof chairs !== 'undefined' ? chairs : [], seating: true }
            ];
            let occupiedM2 = 0;
            let plantCount = 0;
            let seatingCount = 0;
            let tableCount = 0;

            groups.forEach(group => {
                group.items.forEach(item => {
                    if(!item) return;
                    occupiedM2 += Math.max(0, Number(item.w) || 0) * Math.max(0, Number(item.d) || 0) / 100;
                    if(group.plantLike) plantCount += 1;
                    if(group.seating) seatingCount += 1;
                    if(group.table) tableCount += 1;
                });
            });

            return {
                occupiedM2,
                plantCount,
                seatingCount,
                tableCount,
                totalCount: plantCount + seatingCount + tableCount + (typeof cornerFills !== 'undefined' ? cornerFills.length : 0)
            };
        }

        function summarizeLayoutAdvisorSunlight() {
            if(!solarMapData || !Array.isArray(solarMapData.cells) || !solarMapData.cells.length) {
                return { available: false };
            }
            const cells = solarMapData.cells;
            const total = cells.reduce((sum, cell) => sum + (Number(cell.sunHours) || 0), 0);
            const avg = total / cells.length;
            const high = cells.filter(cell => (Number(cell.sunHours) || 0) >= 5).length / cells.length;
            const shade = cells.filter(cell => (Number(cell.sunHours) || 0) <= 2).length / cells.length;
            const exposureCounts = cells.reduce((acc, cell) => {
                const exposure = cell.exposure || (typeof classifySolarMapPlantExposure === 'function' ? classifySolarMapPlantExposure(cell) : null);
                const key = exposure && exposure.plantDbSunlight ? exposure.plantDbSunlight : 'part_shade';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const plantDbKeys = ['full_sun', 'sun-part_shade', 'part_shade', 'full_shade'].filter(key => exposureCounts[key] > 0);
            const bestRestCell = getLayoutAdvisorBestCell(cells, cell => {
                const sun = Number(cell.sunHours) || 0;
                const exposure = cell.exposure || (typeof classifySolarMapPlantExposure === 'function' ? classifySolarMapPlantExposure(cell) : null);
                const privacyPenalty = getLayoutAdvisorNearestVisibility(cell);
                const restScore = exposure && Number.isFinite(exposure.restScore) ? exposure.restScore : 1 - Math.abs(sun - 3.5) / 5;
                const hotPenalty = Math.min(0.45, (Number(cell.hotSunHours) || 0) * 0.11);
                return restScore - hotPenalty - privacyPenalty * 0.45;
            });
            const bestPlantCell = getLayoutAdvisorBestCell(cells, cell => (Number(cell.sunHours) || 0) - getLayoutAdvisorNearestVisibility(cell));
            const bestSoftPlantCell = getLayoutAdvisorBestCell(cells, cell => {
                const exposure = cell.exposure || (typeof classifySolarMapPlantExposure === 'function' ? classifySolarMapPlantExposure(cell) : null);
                const isPartShade = exposure && (exposure.plantDbSunlight === 'part_shade' || exposure.plantDbSunlight === 'sun-part_shade');
                return (isPartShade ? 2 : 0) + (Number(cell.morningSunHours) || 0) - (Number(cell.hotSunHours) || 0) * 0.6;
            });
            return {
                available: true,
                avg,
                max: Number(solarMapData.maxHours) || Math.max(...cells.map(cell => Number(cell.sunHours) || 0)),
                min: Number.isFinite(solarMapData.minHours) ? solarMapData.minHours : Math.min(...cells.map(cell => Number(cell.sunHours) || 0)),
                highRatio: high,
                shadeRatio: shade,
                bestRestCell,
                bestPlantCell,
                bestSoftPlantCell,
                exposureCounts,
                plantDbKeys
            };
        }

        function summarizeLayoutAdvisorPrivacy() {
            if(!visAVisData || !Array.isArray(visAVisData.cells) || !visAVisData.cells.length) {
                return { available: false };
            }
            const cells = visAVisData.cells;
            const avg = cells.reduce((sum, cell) => sum + (Number(cell.visibility) || 0), 0) / cells.length;
            const exposed = cells.filter(cell => (Number(cell.visibility) || 0) >= 0.55).length / cells.length;
            const privateRatio = cells.filter(cell => (Number(cell.visibility) || 0) <= 0.25).length / cells.length;
            const mostPrivateCell = getLayoutAdvisorBestCell(cells, cell => 1 - (Number(cell.visibility) || 0));
            return {
                available: true,
                avg,
                max: Number(visAVisData.maxVis) || Math.max(...cells.map(cell => Number(cell.visibility) || 0)),
                exposedRatio: exposed,
                privateRatio,
                mostPrivateCell
            };
        }

        function buildLayoutAdvisorAdvice(plan, objects, sunlight, privacy) {
            const advice = [];
            if(!plan.hasPlan) {
                advice.push({
                    level: 'warn',
                    title: 'Tracer le balcon',
                    text: "Ferme d'abord le contour du balcon ou crée une surface extérieure pour obtenir des conseils d'aménagement."
                });
                return advice;
            }

            const freeRatio = plan.areaM2 > 0 ? Math.max(0, 1 - objects.occupiedM2 / plan.areaM2) : 0;
            if(plan.areaM2 < 3.2) {
                advice.push({
                    level: 'info',
                    title: 'Petit balcon: une intention forte',
                    text: "Garde un usage principal net: assise seule, coin repas compact ou mur végétal. Trop d'objets rendront vite la circulation confuse."
                });
            }
            if(freeRatio < 0.48) {
                advice.push({
                    level: 'warn',
                    title: 'Circulation à alléger',
                    text: "Les objets occupent beaucoup de surface. Vise un passage lisible porte-fenêtre -> bord du balcon et regroupe les volumes lourds sur un côté."
                });
            } else {
                advice.push({
                    level: 'ok',
                    title: 'Flux respirant',
                    text: "La proportion libre semble correcte. Conserve une bande de passage simple avant d'ajouter de nouvelles jardinières ou une table plus grande."
                });
            }

            if(objects.seatingCount === 0) {
                advice.push({
                    level: 'info',
                    title: 'Créer un vrai point de repos',
                    text: getLayoutAdvisorCellSentence(sunlight.bestRestCell || privacy.mostPrivateCell, plan, "Place l'assise dans la zone la plus calme du plan") + "."
                });
            } else {
                advice.push({
                    level: 'ok',
                    title: 'Assise existante',
                    text: "Oriente le banc, la chaise ou la méridienne avec le dos protégé par un mur, une jardinière haute ou un angle plutôt qu'en plein axe de passage."
                });
            }

            if(objects.plantCount < 2) {
                advice.push({
                    level: 'info',
                    title: 'Renforcer la biophilie',
                    text: "Ajoute au moins deux masses végétales: une proche de l'assise pour l'effet cocon, une en bordure pour cadrer la vue."
                });
            } else {
                advice.push({
                    level: 'ok',
                    title: 'Présence végétale utile',
                    text: "Les plantes peuvent devenir l'outil principal: écran visuel, filtre solaire léger, et transition douce entre intérieur et extérieur."
                });
            }

            if(sunlight.available) {
                const plantDbText = sunlight.plantDbKeys && sunlight.plantDbKeys.length ? ` Catégories plantes disponibles: ${sunlight.plantDbKeys.join(', ')}.` : '';
                if(sunlight.highRatio > 0.45) {
                    advice.push({
                        level: 'warn',
                        title: 'Soleil fort à apprivoiser',
                        text: getLayoutAdvisorCellSentence(sunlight.bestPlantCell, plan, "Réserve la zone la plus ensoleillée aux plantes sobres et aux écrans végétaux") + ". Garde l'assise en soleil modéré et place les plantes de mi-ombre " + getLayoutAdvisorCellSentence(sunlight.bestSoftPlantCell, plan, "dans la zone de soleil doux").toLowerCase() + "." + plantDbText
                    });
                } else if(sunlight.shadeRatio > 0.55) {
                    advice.push({
                        level: 'info',
                        title: 'Ambiance plutôt ombragée',
                        text: "Privilégie fougères, plantes de mi-ombre, assise et matières claires. Évite de promettre un potager productif sur les zones les plus sombres." + plantDbText
                    });
                } else {
                    advice.push({
                        level: 'ok',
                        title: 'Lumière équilibrée',
                        text: getLayoutAdvisorCellSentence(sunlight.bestRestCell, plan, "La meilleure zone de repos semble être") + ", avec assez de lumière sans être la zone la plus brûlante." + plantDbText
                    });
                }
            } else {
                advice.push({
                    level: 'info',
                    title: 'Calculer le soleil direct',
                    text: "Lance la carte Soleil direct pour que le conseil distingue plantes de plein soleil, zone de repos et coins ombragés."
                });
            }

            if(privacy.available) {
                if(privacy.exposedRatio > 0.35) {
                    advice.push({
                        level: 'warn',
                        title: 'Vis-à-vis marqué',
                        text: "Place les plantes hautes, treillis ou claustras sur les zones rouges/orange de vis-à-vis, puis installe l'assise derrière ce filtre plutôt que devant."
                    });
                } else {
                    advice.push({
                        level: 'ok',
                        title: 'Intimité exploitable',
                        text: getLayoutAdvisorCellSentence(privacy.mostPrivateCell, plan, "La zone la plus intime semble être") + ". C'est une bonne candidate pour l'assise principale."
                    });
                }
            } else {
                advice.push({
                    level: 'info',
                    title: "Tester l'intimité",
                    text: "Lance la carte Vis-à-vis pour placer automatiquement les écrans végétaux là où ils protègent vraiment."
                });
            }

            return advice.slice(0, 7);
        }

        function buildLayoutAdvisorProposals(plan, objects, sunlight, privacy) {
            if(!plan.hasPlan) return [];

            const restZone = getLayoutAdvisorCellSentence(sunlight.bestRestCell || privacy.mostPrivateCell, plan, '').replace(/^ côté /, 'côté ') || 'dans la zone la plus calme';
            const plantZone = getLayoutAdvisorCellSentence(sunlight.bestPlantCell, plan, '').replace(/^ côté /, 'côté ') || 'sur le côté le plus lumineux';
            const softPlantZone = getLayoutAdvisorCellSentence(sunlight.bestSoftPlantCell, plan, '').replace(/^ côté /, 'côté ') || 'dans une zone de soleil doux';
            const privateZone = getLayoutAdvisorCellSentence(privacy.mostPrivateCell, plan, '').replace(/^ côté /, 'côté ') || restZone;
            const compact = plan.areaM2 < 3.5;
            const longBalcony = plan.widthM > plan.depthM * 1.6 || plan.depthM > plan.widthM * 1.6;

            const proposals = [
                {
                    key: 'lounge',
                    title: compact ? 'Option 1: assise compacte' : 'Option 1: salon intime',
                    intent: 'Repos, lecture, café du matin',
                    actions: [
                        `Installer l'assise ${privateZone}.`,
                        compact ? "Remplacer la table fixe par une tablette rabattable ou un petit guéridon." : "Ajouter une table basse légère près de l'assise.",
                        `Placer deux jardinières hautes ${privacy.available && privacy.exposedRatio > 0.25 ? 'du côté le plus exposé au vis-à-vis' : "derrière ou sur le côté de l'assise"} pour créer un dos protégé.`,
                        sunlight.available ? `Garder les plantes de plein soleil ${plantZone} et les plantes de mi-ombre ${softPlantZone}.` : "Réserver le bord le plus lumineux aux plantes, à confirmer avec Soleil direct."
                    ],
                    why: "C'est l'option la plus bien-être: elle protège le dos, garde une vue devant soi et limite l'encombrement."
                },
                {
                    key: 'dining',
                    title: 'Option 2: repas simple',
                    intent: compact ? 'Deux personnes sans bloquer le passage' : 'Coin repas + végétation en bordure',
                    actions: [
                        longBalcony ? "Aligner table et chaises dans la longueur pour conserver une bande de circulation." : "Mettre la table proche du centre, puis libérer un côté complet pour le passage.",
                        "Regrouper les jardinières sur un bord plutôt que de les disperser partout.",
                        privacy.available ? "Ajouter l'écran végétal entre le coin repas et la zone de vis-à-vis la plus forte." : "Prévoir un écran végétal mobile tant que le vis-à-vis n'est pas calculé.",
                        sunlight.available && sunlight.highRatio > 0.45 ? "Prévoir une ombre légère sur la table aux heures chaudes." : "Garder la table dans une zone lumineuse mais pas forcément la plus ensoleillée."
                    ],
                    why: "Cette option maximise l'usage quotidien sans transformer le balcon en stockage d'objets."
                },
                {
                    key: 'green',
                    title: 'Option 3: balcon végétal',
                    intent: 'Intimité, fraîcheur, effet jardin',
                    actions: [
                        `Créer une ligne végétale ${plantZone}.`,
                        "Mettre les plantes hautes en fond ou sur les côtés, les plantes basses devant pour garder la profondeur visuelle.",
                        "Conserver un seul meuble confortable plutôt qu'une accumulation table + chaises + banc.",
                        privacy.available && privacy.exposedRatio > 0.35 ? "Densifier les plantes exactement sur les zones visibles depuis le voisinage." : "Utiliser les plantes comme cadre de vue, pas seulement comme bordure."
                    ],
                    why: "C'est la meilleure option si l'objectif principal est l'intimité et la sensation de nature."
                }
            ];

            if(objects.seatingCount > 0 && objects.tableCount > 0 && objects.plantCount >= 2) {
                proposals.unshift({
                    key: 'optimize',
                    title: "Option 0: optimiser l'existant",
                    intent: 'Garder les objets actuels, mieux les organiser',
                    actions: [
                        "Regrouper les objets lourds sur un seul côté pour retrouver une circulation claire.",
                        `Tourner l'assise vers ${restZone} plutôt que vers le passage.`,
                        "Utiliser les jardinières existantes comme écran et non comme simples décorations.",
                        sunlight.available ? "Déplacer les plantes exigeantes vers les cellules full_sun et les plantes sensibles vers part_shade." : "Calculer Soleil direct avant de déplacer les plantes sensibles."
                    ],
                    why: "C'est la proposition la moins invasive: elle améliore le confort sans repartir de zéro."
                });
            }

            return proposals.slice(0, 4);
        }

        function buildLayoutAdvisorNextSteps(sunlight, privacy) {
            const missing = [];
            if(!sunlight.available) missing.push('Soleil direct');
            if(!privacy.available) missing.push('Vis-à-vis');
            if(!missing.length) {
                return [{
                    title: 'Pour aller plus loin',
                    text: "Les cartes principales sont disponibles. Le conseil peut maintenant être affiné en ajoutant l'environnement réel: immeubles voisins, étage, hauteur de garde-corps et obstacles proches."
                }];
            }
            return [{
                title: 'Pour aller plus loin',
                text: `Ajoute l'environnement du balcon puis lance ${missing.join(' et ')}: adresse, étage, bâtiments voisins, horizon et façade en face. Le logiciel pourra alors calculer le soleil réel, les ombres et le vis-à-vis avant de choisir l'aménagement le plus pertinent.`
            }];
        }

        function renderLayoutAdvisorResults(analysis) {
            const { plan, objects, sunlight, privacy, advice, proposals, nextSteps } = analysis;
            const meta = plan.hasPlan
                ? `${formatLayoutAdvisorNumber(plan.areaM2, 1)} m2 · ${objects.totalCount} objet(s) · ${objects.plantCount} végétal(aux)`
                : 'Plan incomplet';
            const solarText = sunlight.available ? `soleil ${formatLayoutAdvisorNumber(sunlight.min, 1)}-${formatLayoutAdvisorNumber(sunlight.max, 1)} h/j` : 'soleil non calculé';
            const privacyText = privacy.available ? `vis-à-vis max ${Math.round(privacy.max * 100)}%` : 'vis-à-vis non calculé';
            const proposalCards = proposals.map(proposal => `
                <div class="layout-advisor-proposal">
                    <div class="layout-advisor-proposal-title">${escapeLayoutAdvisorHtml(proposal.title)}</div>
                    <div class="layout-advisor-proposal-intent">${escapeLayoutAdvisorHtml(proposal.intent)}</div>
                    <ul>${proposal.actions.map(action => `<li>${escapeLayoutAdvisorHtml(action)}</li>`).join('')}</ul>
                    <div class="layout-advisor-proposal-why">${escapeLayoutAdvisorHtml(proposal.why)}</div>
                    <button type="button" class="layout-advisor-apply" onclick="applyLayoutAdvisorProposal('${escapeLayoutAdvisorHtml(proposal.key)}')">Poser ce projet fini</button>
                </div>
            `).join('');
            const cards = advice.map(item => `
                <div class="layout-advisor-card ${item.level}">
                    <div class="layout-advisor-card-title">${escapeLayoutAdvisorHtml(item.title)}</div>
                    <div class="layout-advisor-card-text">${escapeLayoutAdvisorHtml(item.text)}</div>
                </div>
            `).join('');
            const nextStepCards = nextSteps.map(item => `
                <div class="layout-advisor-card info layout-advisor-next">
                    <div class="layout-advisor-card-title">${escapeLayoutAdvisorHtml(item.title)}</div>
                    <div class="layout-advisor-card-text">${escapeLayoutAdvisorHtml(item.text)}</div>
                </div>
            `).join('');
            return `
                <div class="layout-advisor-summary">
                    <strong>Diagnostic bien-être</strong>
                    <span>${escapeLayoutAdvisorHtml(meta)} · ${escapeLayoutAdvisorHtml(solarText)} · ${escapeLayoutAdvisorHtml(privacyText)}</span>
                </div>
                ${proposalCards ? '<div class="layout-advisor-section-title">Propositions automatiques</div>' + proposalCards : ''}
                <div class="layout-advisor-section-title">Points à vérifier</div>
                ${cards}
                ${nextStepCards}
            `;
        }

        function applyLayoutAdvisorProposal(key) {
            const target = document.getElementById('layout-advisor-results');
            const analysis = analyzeBalconyLayoutWellbeing();
            if(!analysis.plan.hasPlan) {
                if(target) target.innerHTML = renderLayoutAdvisorResults(analysis);
                return;
            }

            const layout = getLayoutAdvisorPlacementLayout(analysis.plan, analysis.sunlight, analysis.privacy);
            if(!layout) return;

            if(typeof saveState === 'function') saveState();
            clearLayoutAdvisorGeneratedObjects();
            const created = [];
            const make = (type, options) => {
                const item = typeof createConstruction === 'function' ? createConstruction(type, options) : null;
                if(item) {
                    applyLayoutAdvisorObjectOptions(item, options);
                    created.push(item);
                }
                return item;
            };

            if(key === 'optimize') {
                applyLayoutAdvisorOptimizeExisting(layout);
            } else if(key === 'dining') {
                make('table', { ...layout.diningTable, w: layout.compact ? 6 : 8, d: layout.compact ? 5 : 7, rot: layout.mainRot });
                make('chair', { ...layout.diningSeatA, rot: layout.faceInRotA });
                make('chair', { ...layout.diningSeatB, rot: layout.faceInRotB });
                make('jardiniere', { ...layout.screenA, w: layout.compact ? 9 : 12, d: 4, rot: layout.edgeRot });
                make('jardiniere', { ...layout.screenC, w: layout.compact ? 9 : 12, d: 4, rot: layout.edgeRot });
                make('pottedTree', { ...layout.plantCorner, diameter: 4.5, h: 11 });
            } else if(key === 'green') {
                make('jardiniere', { ...layout.screenA, w: layout.compact ? 9 : 13, d: 5, rot: layout.edgeRot });
                make('jardiniere', { ...layout.screenB, w: layout.compact ? 10 : 14, d: 5, rot: layout.edgeRot });
                make('jardiniere', { ...layout.screenC, w: layout.compact ? 9 : 13, d: 5, rot: layout.edgeRot });
                make('pottedTree', { ...layout.plantCorner, diameter: 5.5, h: 14 });
                make('pottedTree', { ...layout.softCorner, diameter: 4.5, h: 11 });
                make('banc', { ...layout.loungeSeat, w: layout.compact ? 8.5 : 12, d: 3.8, rot: layout.mainRot });
            } else {
                make('banc', { ...layout.loungeSeat, w: layout.compact ? 8.5 : 13, d: 3.8, rot: layout.mainRot });
                make('jardiniere', { ...layout.screenA, w: layout.compact ? 9 : 12, d: 5, rot: layout.edgeRot });
                make('jardiniere', { ...layout.screenB, w: layout.compact ? 9 : 11, d: 5, rot: layout.edgeRot });
                make('pottedTree', { ...layout.plantCorner, diameter: 4.8, h: 12 });
                if(!layout.compact) make('table', { ...layout.sideTable, w: 5.5, d: 4.8, rot: layout.mainRot });
            }

            if(created.length) {
                const last = created[created.length - 1];
                if(typeof selectPlacementObject === 'function') selectPlacementObject(last, { openEditor: true, redraw: false });
            }
            if(typeof refreshFabricationAndPricing === 'function') refreshFabricationAndPricing();
            if(typeof updateJardPanel === 'function') updateJardPanel();
            if(typeof draw2D === 'function') draw2D();
            if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();

            const refreshed = analyzeBalconyLayoutWellbeing();
            if(target) {
                target.innerHTML = renderLayoutAdvisorResults(refreshed) +
                    `<div class="layout-advisor-card ok"><div class="layout-advisor-card-title">Projet posé</div><div class="layout-advisor-card-text">${created.length ? created.length + ' objet(s) placés comme un aménagement complet. Ajuste ensuite les détails comme les autres objets.' : 'Les objets existants ont été réorganisés automatiquement.'}</div></div>`;
            }
        }

        function applyLayoutAdvisorObjectOptions(item, options = {}) {
            if(!item) return;
            item.layoutAdvisorGenerated = options.layoutAdvisorGenerated !== false;
            if(item.pos && typeof item.pos.set === 'function' && Number.isFinite(options.x) && Number.isFinite(options.z)) {
                item.pos.set(options.x, 0, options.z);
            }
            ['w', 'd', 'h'].forEach(prop => {
                if(Number.isFinite(options[prop])) item[prop] = options[prop];
            });
            if(Number.isFinite(options.rot)) item.rot = options.rot;
            if(typeof rebuildPlacementObject === 'function') rebuildPlacementObject(item);
        }

        function clearLayoutAdvisorGeneratedObjects() {
            const groups = [
                typeof bancs !== 'undefined' ? bancs : null,
                typeof cubes !== 'undefined' ? cubes : null,
                typeof tables !== 'undefined' ? tables : null,
                typeof chairs !== 'undefined' ? chairs : null,
                typeof jardinières !== 'undefined' ? jardinières : null,
                typeof pottedTrees !== 'undefined' ? pottedTrees : null,
                typeof cornerFills !== 'undefined' ? cornerFills : null
            ].filter(Array.isArray);
            groups.forEach(list => {
                for(let i = list.length - 1; i >= 0; i--) {
                    const item = list[i];
                    if(!item || !item.layoutAdvisorGenerated) continue;
                    if(item.group && (balconySceneGroup || scene)) (balconySceneGroup || scene).remove(item.group);
                    list.splice(i, 1);
                }
            });
            if(typeof clearPlacementSelection === 'function') clearPlacementSelection({ redraw: false });
        }

        function applyLayoutAdvisorOptimizeExisting(layout) {
            const existing = [
                ...(typeof bancs !== 'undefined' ? bancs : []),
                ...(typeof cubes !== 'undefined' ? cubes : []),
                ...(typeof tables !== 'undefined' ? tables : []),
                ...(typeof chairs !== 'undefined' ? chairs : []),
                ...(typeof jardinières !== 'undefined' ? jardinières : []),
                ...(typeof pottedTrees !== 'undefined' ? pottedTrees : [])
            ].filter(Boolean);
            const targets = [layout.rest, layout.center, layout.leftOfCenter, layout.screenA, layout.screenB, layout.plantA, layout.plantB];
            existing.slice(0, targets.length).forEach((item, index) => {
                const target = targets[index];
                if(item.pos && typeof item.pos.set === 'function') item.pos.set(target.x, 0, target.z);
                item.rot = index < 3 ? layout.mainRot : layout.edgeRot;
                if(typeof rebuildPlacementObject === 'function') rebuildPlacementObject(item);
            });
        }

        function getLayoutAdvisorPlacementLayout(plan, sunlight, privacy) {
            if(!plan || !plan.hasPlan) return null;
            const polygons = getLayoutAdvisorSources().map(source => source.polygon).filter(Boolean);
            const bounds = getLayoutAdvisorCombinedBounds(polygons);
            if(!bounds) return null;
            const compact = plan.areaM2 < 3.5;
            const restCell = sunlight.bestRestCell || privacy.mostPrivateCell;
            const plantCell = sunlight.bestPlantCell;
            const privateCell = privacy.mostPrivateCell || sunlight.bestRestCell;
            const horizontal = bounds.width >= bounds.height;
            const slot = (u, v) => getLayoutAdvisorWorldPoint(bounds, polygons, u, v, horizontal);
            const cellSlot = (cell, u, v) => getLayoutAdvisorWorldPointFromCellOrRatio(cell, bounds, polygons, u, v, horizontal);
            const base = {
                loungeSeat: cellSlot(restCell || privateCell, 0.26, 0.22),
                sideTable: slot(0.48, 0.26),
                diningTable: slot(compact ? 0.56 : 0.60, 0.52),
                diningSeatA: slot(compact ? 0.30 : 0.38, 0.52),
                diningSeatB: slot(compact ? 0.82 : 0.78, 0.52),
                screenA: cellSlot(privateCell, 0.16, 0.82),
                screenB: slot(0.50, 0.84),
                screenC: slot(0.84, 0.82),
                plantCorner: cellSlot(plantCell, 0.92, 0.24),
                softCorner: slot(0.08, 0.24),
                compact
            };
            base.mainRot = horizontal ? 0 : Math.PI / 2;
            base.edgeRot = horizontal ? 0 : Math.PI / 2;
            base.faceInRotA = horizontal ? Math.PI / 2 : 0;
            base.faceInRotB = horizontal ? -Math.PI / 2 : Math.PI;
            base.center = base.diningTable;
            base.rest = base.loungeSeat;
            base.leftOfCenter = base.diningSeatA;
            base.rightOfCenter = base.diningSeatB;
            base.plantA = base.plantCorner;
            base.plantB = base.softCorner;
            return base;
        }

        function getLayoutAdvisorWorldPointFromCellOrRatio(cell, bounds, polygons, rx, ry, horizontal = true) {
            if(cell && Number.isFinite(cell.worldX) && Number.isFinite(cell.worldZ)) {
                return { x: cell.worldX, z: cell.worldZ };
            }
            return getLayoutAdvisorWorldPoint(bounds, polygons, rx, ry, horizontal);
        }

        function getLayoutAdvisorWorldPoint(bounds, polygons, u, v, horizontal = true) {
            const x = horizontal
                ? bounds.minX + bounds.width * u
                : bounds.minX + bounds.width * v;
            const y = horizontal
                ? bounds.minY + bounds.height * v
                : bounds.minY + bounds.height * u;
            const point = getLayoutAdvisorSafePlanPoint({ x, y }, bounds, polygons);
            return { x: point.x / 20, z: point.y / 20 };
        }

        function getLayoutAdvisorSafePlanPoint(point, bounds, polygons) {
            if(getLayoutAdvisorPointInPolygons(point, polygons)) return point;
            const steps = [0.5, 0.25, 0.75, 0.15, 0.85, 0.35, 0.65];
            let best = null;
            let bestDist = Infinity;
            steps.forEach(rx => {
                steps.forEach(ry => {
                    const candidate = {
                        x: bounds.minX + bounds.width * rx,
                        y: bounds.minY + bounds.height * ry
                    };
                    if(!getLayoutAdvisorPointInPolygons(candidate, polygons)) return;
                    const dx = candidate.x - point.x;
                    const dy = candidate.y - point.y;
                    const dist = dx * dx + dy * dy;
                    if(dist < bestDist) {
                        bestDist = dist;
                        best = candidate;
                    }
                });
            });
            return best || { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
        }

        function getLayoutAdvisorPointInPolygons(point, polygons) {
            return polygons.some(poly => typeof pointInPolygon === 'function'
                ? pointInPolygon(point, poly)
                : getLayoutAdvisorPointInPolygon(point, poly));
        }

        function getLayoutAdvisorPointInPolygon(point, polygon) {
            if(!Array.isArray(polygon) || polygon.length < 3) return false;
            let inside = false;
            for(let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].x;
                const yi = polygon[i].y;
                const xj = polygon[j].x;
                const yj = polygon[j].y;
                const intersect = ((yi > point.y) !== (yj > point.y)) &&
                    (point.x < (xj - xi) * (point.y - yi) / (yj - yi + 1e-12) + xi);
                if(intersect) inside = !inside;
            }
            return inside;
        }

        function getLayoutAdvisorCellSentence(cell, plan, prefix) {
            if(!cell || !plan.center) return prefix;
            return `${prefix} côté ${getLayoutAdvisorDirectionLabel(cell.center || cell, plan.center)}`;
        }

        function getLayoutAdvisorDirectionLabel(point, center) {
            const dx = point.x - center.x;
            const dy = point.y - center.y;
            const horizontal = Math.abs(dx) > Math.abs(dy) * 0.75 ? (dx > 0 ? 'est' : 'ouest') : '';
            const vertical = Math.abs(dy) > Math.abs(dx) * 0.75 ? (dy > 0 ? 'sud' : 'nord') : '';
            if(horizontal && vertical) return `${vertical}-${horizontal}`;
            return horizontal || vertical || 'central';
        }

        function getLayoutAdvisorBestCell(cells, scoreFn) {
            let best = null;
            let bestScore = -Infinity;
            cells.forEach(cell => {
                const score = scoreFn(cell);
                if(score > bestScore) {
                    bestScore = score;
                    best = cell;
                }
            });
            return best;
        }

        function getLayoutAdvisorNearestVisibility(cell) {
            if(!cell || !visAVisData || !Array.isArray(visAVisData.cells) || !visAVisData.cells.length) return 0;
            let bestDist = Infinity;
            let visibility = 0;
            visAVisData.cells.forEach(vCell => {
                const dx = (vCell.worldX || 0) - (cell.worldX || 0);
                const dz = (vCell.worldZ || 0) - (cell.worldZ || 0);
                const dist = dx * dx + dz * dz;
                if(dist < bestDist) {
                    bestDist = dist;
                    visibility = Number(vCell.visibility) || 0;
                }
            });
            return visibility;
        }

        function getLayoutAdvisorPolygonArea(poly) {
            let area = 0;
            for(let i = 0; i < poly.length; i++) {
                const a = poly[i];
                const b = poly[(i + 1) % poly.length];
                area += ((a.x || 0) * (b.y || 0)) - ((b.x || 0) * (a.y || 0));
            }
            return area / 2;
        }

        function getLayoutAdvisorCombinedBounds(polygons) {
            if(!polygons.length) return null;
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            polygons.forEach(poly => {
                poly.forEach(pt => {
                    minX = Math.min(minX, pt.x);
                    minY = Math.min(minY, pt.y);
                    maxX = Math.max(maxX, pt.x);
                    maxY = Math.max(maxY, pt.y);
                });
            });
            return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
        }

        function formatLayoutAdvisorNumber(value, digits = 0) {
            if(!Number.isFinite(value)) return '0';
            return value.toLocaleString('fr-FR', { maximumFractionDigits: digits, minimumFractionDigits: digits });
        }

        function escapeLayoutAdvisorHtml(value) {
            return String(value)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        }
