        function ensureFabricationFormReady() {
            const form = document.getElementById('fabrication-form');
            if(!form) return null;
            if(form.dataset.ready === '1') return form;
            form.innerHTML = `
                <div class="dp-section">Plans de coupe</div>
                <div class="dp-help">Calcul global toutes jardinières. Les dimensions des pièces restent celles des plans et de la 3D; le stock et le trait de scie ne servent qu'au débit.</div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
                    <span style="font-size:0.68em;color:#aaa;min-width:86px;">Trait scie</span>
                    <input id="cut-saw-kerf-mm" type="number" min="0" max="20" step="0.1" inputmode="decimal" value="${cutSawKerfMm}" onchange="updateCutSawKerf(this.value)" onkeydown="commitNumberInputOnEnter(event)" style="width:74px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.72em;">
                    <span style="font-size:0.66em;color:#777;">mm entre pièces</span>
                </div>
                <button class="jp-add-btn btn-with-icon" onclick="exportFullWorkshopCsv()" style="width:100%;margin-bottom:6px;"><span class="icon-wire" aria-hidden="true"><svg viewBox="0 0 24 24" role="img" focusable="false"><path d="M6 3.5h9l3 3V20.5H6z"></path><path d="M9 12h6M9 15h6M9 18h4"></path></svg></span><span>Exporter CSV atelier</span></button>
                <div id="cut-plan-live" style="font-size:0.67em;color:#ddd;display:flex;flex-direction:column;gap:6px;"></div>
                <div class="dp-section">Vues isométriques</div>
                <div id="fabrication-iso-live" style="font-size:0.67em;color:#ddd;display:flex;flex-direction:column;gap:6px;"></div>
                <div class="dp-section">Optimisation des chutes</div>
                <div id="waste-optimizer-live" style="font-size:0.67em;color:#ddd;display:flex;flex-direction:column;gap:6px;"></div>
                <div class="dp-section">Poids estimé</div>
                <div id="weight-live" style="font-size:0.67em;color:#ddd;display:flex;flex-direction:column;gap:6px;"></div>
            `;
            form.dataset.ready = '1';
            return form;
        }

        function ensureDevisFormReady() {
            const form = document.getElementById('devis-form');
            if(!form) return null;
            if(form.dataset.ready === '1') return form;
            form.innerHTML = `
                <div id="pricing-live" style="font-size:0.67em;color:#ddd;display:flex;flex-direction:column;gap:6px;"></div>
            `;
            form.dataset.ready = '1';
            return form;
        }

        function dmToCm(valueDm) {
            return Math.round((valueDm || 0) * 10 * 10) / 10;
        }

        function getCutProfileId(profile) {
            return 'cut-' + String(profile || 'default').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
        }

        function getStockLengthForProfile(profile) {
            const value = cutStockLengthByProfile[profile];
            const p = String(profile || '').toLowerCase();
            const fallback = p.includes('lame de terrasse douglas') && p.includes('25x90')
                ? (typeof DEFAULT_CUVE_BOARD_STOCK_CM !== 'undefined' ? DEFAULT_CUVE_BOARD_STOCK_CM : 400)
                : 300;
            return Math.max(100, Math.min(600, parseLocaleNumber(value) || fallback));
        }

        function getSawKerfCm() {
            return Math.max(0, Math.min(20, parseLocaleNumber(cutSawKerfMm) || 0)) / 10;
        }

        function parseStockInventory(value, fallbackLengthCm) {
            const text = String(value || '').trim();
            if(!text) {
                return [{
                    lengthCm: Math.max(100, fallbackLengthCm || 300),
                    qty: Infinity,
                    label: `standard ${Math.round(Math.max(100, fallbackLengthCm || 300))} cm`
                }];
            }

            const entries = [];
            text.split(/[,\n;]+/).forEach(part => {
                const raw = part.trim();
                if(!raw) return;
                const match = raw.match(/^([0-9]+(?:[.,][0-9]+)?)(?:\s*(?:x|\*)\s*([0-9]+))?$/i);
                if(!match) return;
                const lengthCm = Math.max(1, Math.min(1200, parseLocaleNumber(match[1]) || 0));
                const qty = match[2] ? Math.max(1, Math.min(999, parseInt(match[2], 10) || 1)) : 1;
                entries.push({ lengthCm, qty, label: `${formatCmForDoc(lengthCm)} cm x${qty}` });
            });

            if(entries.length) return entries.sort((a, b) => b.lengthCm - a.lengthCm);
            return [{
                lengthCm: Math.max(100, fallbackLengthCm || 300),
                qty: Infinity,
                label: `standard ${Math.round(Math.max(100, fallbackLengthCm || 300))} cm`
            }];
        }

        function commitNumberInputOnEnter(event) {
            if(!event || event.key !== 'Enter') return;
            event.preventDefault();
            if(event.currentTarget && typeof event.currentTarget.blur === 'function') {
                event.currentTarget.blur();
            }
        }

        function getStockEntriesForProfile(profile) {
            return parseStockInventory(cutStockInventoryByProfile[profile], getStockLengthForProfile(profile));
        }

        function getJardiniereLinerCuts(j, metrics = null) {
            const m = metrics || computeJardiniereConstructionMetrics(j);
            const c = m.construction;
            const innerWdm = Math.max(m.outerW - 2 * c.boardThickness - 2 * c.floorInset, 0.5);
            const innerDdm = Math.max(m.innerDepth, 0.5);
            const innerHdm = Math.max(m.cuveH, 0.5);
            const epdmLengthCm = dmToCm(2 * (innerWdm + innerDdm) * 1.15);
            const epdmWidthCm = dmToCm(innerHdm * 1.15);
            const geoLengthCm = dmToCm(innerWdm * 1.3);
            const geoWidthCm = dmToCm(innerDdm * 1.3);
            return {
                innerWdm,
                innerDdm,
                innerHdm,
                epdm: {
                    lengthCm: epdmLengthCm,
                    widthCm: epdmWidthCm,
                    areaM2: Math.round((epdmLengthCm * epdmWidthCm / 10000) * 100) / 100
                },
                geotextile: {
                    lengthCm: geoLengthCm,
                    widthCm: geoWidthCm,
                    areaM2: Math.round((geoLengthCm * geoWidthCm / 10000) * 100) / 100
                }
            };
        }

        function getJardiniereMaterialLayerHeightsDm(j, metrics = null) {
            const m = metrics || computeJardiniereConstructionMetrics(j);
            const linerBottomY = m.slatY + m.construction.floorSlatThickness / 2 + 0.035;
            const linerTopY = j.legH + m.cuveH;
            const fillHdm = Math.max(0.08, linerTopY - linerBottomY);
            const clayPebbles = MATERIAL_LAYER_THICKNESS_DM.clayPebbles;
            const mulch = MATERIAL_LAYER_THICKNESS_DM.mulch;
            const plantingMix = Math.max(0, fillHdm - clayPebbles - mulch);
            const topsoil = plantingMix * PLANTING_MIX_RATIOS.topsoil;
            const pottingSoil = plantingMix * PLANTING_MIX_RATIOS.pottingSoil;
            return { clayPebbles, plantingMix, topsoil, pottingSoil, mulch, fillHdm };
        }

        function getDefaultUnitPriceForProfile(profile) {
            const p = String(profile || '').toLowerCase();
	            if(p.includes('planches cuve')) return DEFAULT_DEVIS_UNIT_PRICES.cuveBoards;
	            if(p.includes('lame de terrasse douglas') && p.includes('25x90')) return DEFAULT_DEVIS_UNIT_PRICES.cuveBoards;
	            if(p.includes('lambourdes')) return DEFAULT_DEVIS_UNIT_PRICES.lambourdes;
	            if(p.includes('lambourde pin marron') && p.includes('45x70')) return DEFAULT_DEVIS_UNIT_PRICES.lambourdes;
	            if(p.includes('tasseaux bas')) return DEFAULT_DEVIS_UNIT_PRICES.floorBattens;
	            if(p.includes('tissu extérieur') || p.includes('tissu exterieur') || p.includes('mousse méridienne') || p.includes('mousse meridienne')) return DEFAULT_DEVIS_UNIT_PRICES.meridienneFabric;
	            if(p.includes('poteaux treillis')) return DEFAULT_DEVIS_UNIT_PRICES.treillisPosts;
	            if(p.includes('lattes treillis')) return DEFAULT_DEVIS_UNIT_PRICES.treillisRails;
	            if(p.includes('spots led treillis')) return DEFAULT_DEVIS_UNIT_PRICES.treillisSpots;
	            if(p.includes('guirlande blanche treillis')) return DEFAULT_DEVIS_UNIT_PRICES.treillisGarlandWhite;
	            if(p.includes('guirlande guinguette treillis')) return DEFAULT_DEVIS_UNIT_PRICES.treillisGarlandGinguette;
	            if(p.includes('bâche epdm') || p.includes('bache epdm')) return DEFAULT_DEVIS_UNIT_PRICES.epdmLiner;
	            if(p.includes('géotextile') || p.includes('geotextile')) return DEFAULT_DEVIS_UNIT_PRICES.geotextile;
	            if(p.includes('vis bois')) return DEFAULT_DEVIS_UNIT_PRICES.screws;
	            if(p.includes('terre végétale') || p.includes('terre vegetale')) return DEFAULT_DEVIS_UNIT_PRICES.topsoilLiter;
	            if(p.includes('terreau')) return DEFAULT_DEVIS_UNIT_PRICES.soilLiter;
	            if(p.includes("billes d'argile") || p.includes('billes d’argile')) return DEFAULT_DEVIS_UNIT_PRICES.clayPebblesLiter;
	            if(p.includes('paillage')) return DEFAULT_DEVIS_UNIT_PRICES.mulchLiter;
	            if(p.includes('plantes')) return DEFAULT_DEVIS_UNIT_PRICES.plant;
	            return 0;
	        }

        function getUnitPriceForProfile(profile) {
            if(Object.prototype.hasOwnProperty.call(devisUnitPriceByProfile, profile)) {
                const value = devisUnitPriceByProfile[profile];
                return Math.max(0, Math.min(9999, parseLocaleNumber(value) || 0));
            }
            return getDefaultUnitPriceForProfile(profile);
        }

        function formatEuro(value) {
            const rounded = Math.round((Number(value) || 0) * 100) / 100;
            return rounded.toLocaleString('fr-FR', {
                minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
                maximumFractionDigits: 2
            }) + ' €';
        }

        function formatKg(value) {
            const rounded = Math.round((Number(value) || 0) * 10) / 10;
            return rounded.toLocaleString('fr-FR', {
                minimumFractionDigits: rounded % 1 === 0 ? 0 : 1,
                maximumFractionDigits: 1
            }) + ' kg';
        }

        function dm3ToM3(valueDm3) {
            return Math.max(0, Number(valueDm3) || 0) / 1000;
        }

        function getPieceVolumeM3(piece) {
            if(!piece || !piece.dim) return 0;
            return dm3ToM3((piece.dim.L || 0) * (piece.dim.H || 0) * (piece.dim.T || 0));
        }

        function getTreillisDensity(j) {
            if((j.treillisType || '').toLowerCase() === 'metal') return MATERIAL_DENSITY_KG_M3.steel;
            if((j.treillisType || '').toLowerCase() === 'bambou') return MATERIAL_DENSITY_KG_M3.bamboo;
            return MATERIAL_DENSITY_KG_M3.wood;
        }

        function computeJardiniereWeightEstimate(j, index = 0) {
            const metrics = computeJardiniereConstructionMetrics(j);
            const model = buildJardiniereFabricationModel(j, metrics);
            const cuts = getJardiniereLinerCuts(j, metrics);
            const rows = [];

            function addRow(label, volumeM3, densityKgM3, weightKg = null, detailLabel = null) {
                const safeVolume = Math.max(0, Number(volumeM3) || 0);
                const safeDensity = Math.max(0, Number(densityKgM3) || 0);
                const computedWeight = weightKg === null ? safeVolume * safeDensity : Math.max(0, Number(weightKg) || 0);
                if(computedWeight <= 0) return;
                rows.push({
                    label,
                    volumeM3: safeVolume,
                    densityKgM3: safeDensity,
                    weightKg: computedWeight,
                    detailLabel
                });
            }

            const families = model.pieces.reduce((acc, piece) => {
                if(!acc[piece.family]) acc[piece.family] = [];
                acc[piece.family].push(piece);
                return acc;
            }, {});

            addRow(
                'Bois - planches cuve et fond',
                [...(families.Planche || []), ...(families.LatteFond || [])].reduce((sum, p) => sum + getPieceVolumeM3(p), 0),
                MATERIAL_DENSITY_KG_M3.wood
            );
            addRow(
                'Bois - lambourdes/pieds',
                (families.Lambourde || []).reduce((sum, p) => sum + getPieceVolumeM3(p), 0),
                MATERIAL_DENSITY_KG_M3.wood
            );
            addRow(
                'Bois - tasseaux sommier',
                (families.Tasseau || []).reduce((sum, p) => sum + getPieceVolumeM3(p), 0),
                MATERIAL_DENSITY_KG_M3.wood
            );

            const treillisPieces = [...(families.TreillisPost || []), ...(families.TreillisRail || [])];
            const treillisDensity = getTreillisDensity(j);
            addRow(
                treillisDensity === MATERIAL_DENSITY_KG_M3.steel ? 'Métal - treillis' : 'Bois/bambou - treillis',
                treillisPieces.reduce((sum, p) => sum + getPieceVolumeM3(p), 0),
                treillisDensity
            );

            const innerVolumeBaseDm2 = Math.max(cuts.innerWdm, 0) * Math.max(cuts.innerDdm, 0);
            const materialLayers = getJardiniereMaterialLayerHeightsDm(j, metrics);
            addRow(
                "Billes d'argile",
                dm3ToM3(innerVolumeBaseDm2 * materialLayers.clayPebbles),
                MATERIAL_DENSITY_KG_M3.clayPebbles
            );
            addRow(
                'Terre végétale',
                dm3ToM3(innerVolumeBaseDm2 * materialLayers.topsoil),
                MATERIAL_DENSITY_KG_M3.topsoil,
                null,
                `${Math.round(PLANTING_MIX_RATIOS.topsoil * 100)}% du mélange de plantation`
            );
            addRow(
                'Terreau',
                dm3ToM3(innerVolumeBaseDm2 * materialLayers.pottingSoil),
                MATERIAL_DENSITY_KG_M3.soil,
                null,
                `${Math.round(PLANTING_MIX_RATIOS.pottingSoil * 100)}% du mélange de plantation`
            );
            addRow(
                'Paillage',
                dm3ToM3(innerVolumeBaseDm2 * materialLayers.mulch),
                MATERIAL_DENSITY_KG_M3.mulch
            );
            addRow(
                'Bâche EPDM',
                cuts.epdm.areaM2 * MATERIAL_SHEET_SPECS.epdmThicknessM,
                MATERIAL_DENSITY_KG_M3.epdm
            );
            addRow(
                'Géotextile',
                0,
                0,
                cuts.geotextile.areaM2 * MATERIAL_SHEET_SPECS.geotextileKgM2,
                `${cuts.geotextile.areaM2.toLocaleString('fr-FR')} m² • ${MATERIAL_SHEET_SPECS.geotextileKgM2} kg/m²`
            );
            const plantWeight = (j.plants || []).reduce((sum, plant) => {
                const preset = PLANT_PRESETS[plant.type] || plant || {};
                return sum + (preset.onTreillis ? MATERIAL_DENSITY_KG_M3.plantClimber : MATERIAL_DENSITY_KG_M3.plantPot);
            }, 0);
            addRow(
                'Plantes',
                0,
                0,
                plantWeight,
                `${(j.plants || []).length} plante(s) • estimation motte/plant`
            );

            const totalKg = rows.reduce((sum, row) => sum + row.weightKg, 0);
            const footCount = Math.max(1, (families.Lambourde || []).length);
            return {
                label: `Jardinière ${index + 1}`,
                rows,
                totalKg,
                footCount,
                kgPerFoot: totalKg / footCount
            };
        }

        function renderLiveWeightSummary() {
            const wrap = document.getElementById('weight-live');
            if(!wrap) return;
            if(!jardinières.length) {
                wrap.innerHTML = '<div class="dp-help">Aucune jardinière à peser.</div>';
                return;
            }

            const estimates = jardinières.map((j, idx) => computeJardiniereWeightEstimate(j, idx));
            const totalKg = estimates.reduce((sum, estimate) => sum + estimate.totalKg, 0);
            const totalFeet = estimates.reduce((sum, estimate) => sum + estimate.footCount, 0);
            const maxPerFoot = Math.max(...estimates.map(estimate => estimate.kgPerFoot));
            const totalClayL = estimates.reduce((sum, estimate) => sum + estimate.rows.filter(row => row.label === "Billes d'argile").reduce((a, row) => a + row.volumeM3 * 1000, 0), 0);
            const totalTopsoilL = estimates.reduce((sum, estimate) => sum + estimate.rows.filter(row => row.label === 'Terre végétale').reduce((a, row) => a + row.volumeM3 * 1000, 0), 0);
            const totalPottingSoilL = estimates.reduce((sum, estimate) => sum + estimate.rows.filter(row => row.label === 'Terreau').reduce((a, row) => a + row.volumeM3 * 1000, 0), 0);
            const totalMulchL = estimates.reduce((sum, estimate) => sum + estimate.rows.filter(row => row.label === 'Paillage').reduce((a, row) => a + row.volumeM3 * 1000, 0), 0);
            const hasAlert = estimates.some(estimate => estimate.kgPerFoot > 200);

            let html = `
                <div style="padding:6px;border:1px solid ${hasAlert ? '#8a3b2c' : '#30402e'};background:${hasAlert ? '#22110f' : '#111a12'};border-radius:6px;color:${hasAlert ? '#ffd0c4' : '#d6efd0'};">
                    Poids total: ${formatKg(totalKg)} • Pieds: ${totalFeet} • Max par pied: ${formatKg(maxPerFoot)}
                    <div style="margin-top:3px;color:#cfe2ca;">Volumes achat: billes ${Math.round(totalClayL).toLocaleString('fr-FR')} L • terre végétale ${Math.round(totalTopsoilL).toLocaleString('fr-FR')} L • terreau ${Math.round(totalPottingSoilL).toLocaleString('fr-FR')} L • paillage ${Math.round(totalMulchL).toLocaleString('fr-FR')} L</div>
                    ${hasAlert ? '<div style="margin-top:3px;font-weight:800;color:#ff9b85;">Alerte: au moins un pied dépasse 200 kg.</div>' : ''}
                </div>
            `;

            estimates.forEach(estimate => {
                const alert = estimate.kgPerFoot > 200;
                const rowsHtml = estimate.rows
                    .map(row => {
                        const densityLabel = row.detailLabel || (row.densityKgM3 > 0 ? `${Math.round(row.densityKgM3)} kg/m³` : 'forfait');
                        const volumeLabel = row.volumeM3 > 0 ? `${Math.round(row.volumeM3 * 1000).toLocaleString('fr-FR')} L • ` : '';
                        return `<div style="display:flex;justify-content:space-between;gap:8px;color:#bbb;"><span>${escapeHtmlForDoc(row.label)} <span style="color:#777;">${volumeLabel}${densityLabel}</span></span><strong style="color:#e8d7be;">${formatKg(row.weightKg)}</strong></div>`;
                    })
                    .join('');

                html += `
                    <div style="border:1px solid ${alert ? '#6a3027' : '#303030'};border-radius:6px;padding:5px;background:#111;">
                        <div style="display:flex;justify-content:space-between;gap:8px;color:#f0dcc1;font-weight:700;">
                            <span>${estimate.label}</span>
                            <span>${formatKg(estimate.totalKg)}</span>
                        </div>
                        <div style="margin-top:2px;color:${alert ? '#ff9b85' : '#ccc'};font-weight:${alert ? '800' : '600'};">
                            ${estimate.footCount} pieds • ${formatKg(estimate.kgPerFoot)} / pied${alert ? ' • dépasse 200 kg' : ''}
                        </div>
                        <div style="margin-top:5px;display:flex;flex-direction:column;gap:2px;">${rowsHtml}</div>
                    </div>
                `;
            });

            wrap.innerHTML = html;
        }

        function getConstructionIsoDimensions(entry) {
            if(!entry || !entry.item) return null;
            const item = entry.item;
            if(entry.type === 'jardiniere') {
                const m = computeJardiniereConstructionMetrics(item);
                const hasTreillis = item.hasTreillis || item.treillisBack || item.treillisLeft || item.treillisRight;
                return {
                    type: 'jardiniere',
                    label: `Jardinière ${jardinières.indexOf(item) + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(hasTreillis ? (item.legH + m.cuveH + (item.treillisH || 0)) : (item.legH + m.cuveH)),
                    color: item.woodColor || '#8a5a36'
                };
            }
            if(entry.type === 'banc') {
                return {
                    type: 'banc',
                    label: `Banc ${bancs.indexOf(item) + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(item.h),
                    color: item.woodColor || '#8a5a36'
                };
            }
            if(entry.type === 'cube') {
                return {
                    type: 'cube',
                    label: `Méridienne ${cubes.indexOf(item) + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(item.h),
                    color: item.color || '#b9793f'
                };
            }
            if(entry.type === 'table') {
                return {
                    type: 'table',
                    label: `Table ${tables.indexOf(item) + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(item.h),
                    color: item.woodColor || '#72513d'
                };
            }
            if(entry.type === 'chair') {
                return {
                    type: 'chair',
                    label: `Chaise ${chairs.indexOf(item) + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(item.h),
                    color: item.woodColor || '#72513d'
                };
            }
            // Fallback générique: tout type enregistré avec w/d/h
            if(Number.isFinite(item.w) && Number.isFinite(item.d) && Number.isFinite(item.h)) {
                const typeDef = typeof getConstructionType === 'function' ? getConstructionType(entry.type) : null;
                const typeLabel = (typeDef && typeDef.label) || entry.type || 'Objet';
                const items = getConstructionItems(entry.type);
                const idx = items.findIndex(e => e.item === item);
                return {
                    type: entry.type,
                    label: `${typeLabel} ${idx + 1}`,
                    wCm: dmToCm(item.w),
                    dCm: dmToCm(item.d),
                    hCm: dmToCm(item.h),
                    color: item.woodColor || item.color || '#8a5a36'
                };
            }
            return null;
        }

        function buildObjectIsoDimensionSvg(spec) {
            if(!spec) return '';
            const vbW = 520;
            const vbH = 330;
            const w = Math.max(20, spec.wCm || 1);
            const d = Math.max(20, spec.dCm || 1);
            const h = Math.max(20, spec.hCm || 1);
            const cos30 = Math.cos(Math.PI / 6);
            const sin30 = 0.5;
            const scale = Math.min(
                2.3,
                300 / Math.max((w + d) * cos30, 1),
                205 / Math.max((w + d) * sin30 + h, 1)
            );
            const cx = 260;
            const baseY = 238;
            const project = (x, z, y) => ({
                x: cx + (x - z) * scale * cos30,
                y: baseY + (x + z) * scale * sin30 - y * scale
            });
            const v = {
                p000: project(-w / 2, -d / 2, 0),
                p100: project(w / 2, -d / 2, 0),
                p110: project(w / 2, d / 2, 0),
                p010: project(-w / 2, d / 2, 0),
                t000: project(-w / 2, -d / 2, h),
                t100: project(w / 2, -d / 2, h),
                t110: project(w / 2, d / 2, h),
                t010: project(-w / 2, d / 2, h)
            };
            const fill = spec.color || '#b9793f';
            const topFill = new THREE.Color(fill).lerp(new THREE.Color(0xffffff), 0.18).getStyle();
            const sideFill = new THREE.Color(fill).multiplyScalar(0.74).getStyle();
            const frontFill = new THREE.Color(fill).multiplyScalar(0.9).getStyle();
            const dim = '#1f1f1f';
            const ext = '#777';
            const cm = v => `${formatCmForDoc(v)} cm`;
            const poly = pts => pts.map(pt => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ');
            const lerpPt = (a, b, t) => ({
                x: a.x + (b.x - a.x) * t,
                y: a.y + (b.y - a.y) * t
            });
            const offsetPt = (pt, ox, oy) => ({ x: pt.x + ox, y: pt.y + oy });
            const dimLine = (a, b, label, ox, oy, rotate = true) => {
                const a2 = offsetPt(a, ox, oy);
                const b2 = offsetPt(b, ox, oy);
                const mx = (a2.x + b2.x) / 2;
                const my = (a2.y + b2.y) / 2 - 4;
                const angle = rotate ? Math.atan2(b2.y - a2.y, b2.x - a2.x) * 180 / Math.PI : 0;
                return `
                    <line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${a2.x.toFixed(1)}" y2="${a2.y.toFixed(1)}" stroke="${ext}" stroke-dasharray="3 2"/>
                    <line x1="${b.x.toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${b2.x.toFixed(1)}" y2="${b2.y.toFixed(1)}" stroke="${ext}" stroke-dasharray="3 2"/>
                    <line x1="${a2.x.toFixed(1)}" y1="${a2.y.toFixed(1)}" x2="${b2.x.toFixed(1)}" y2="${b2.y.toFixed(1)}" stroke="${dim}" stroke-width="1" marker-start="url(#iso-b)" marker-end="url(#iso-a)"/>
                    <text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-size="12.5" fill="${dim}" transform="rotate(${angle.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${label}</text>
                `;
            };

            let detail = '';
            if(spec.type === 'jardiniere') {
                const soil = [
                    lerpPt(lerpPt(v.t000, v.t100, 0.08), lerpPt(v.t010, v.t110, 0.08), 0.12),
                    lerpPt(lerpPt(v.t000, v.t100, 0.92), lerpPt(v.t010, v.t110, 0.92), 0.12),
                    lerpPt(lerpPt(v.t000, v.t100, 0.92), lerpPt(v.t010, v.t110, 0.92), 0.88),
                    lerpPt(lerpPt(v.t000, v.t100, 0.08), lerpPt(v.t010, v.t110, 0.08), 0.88)
                ];
                detail += `<polygon points="${poly(soil)}" fill="#2f2118" opacity="0.92"/>`;
                const backA = lerpPt(v.t000, v.t100, 0.12);
                const backB = lerpPt(v.t000, v.t100, 0.88);
                const trellisH = Math.min(82, h * scale * 0.42);
                detail += `<line x1="${backA.x.toFixed(1)}" y1="${backA.y.toFixed(1)}" x2="${backA.x.toFixed(1)}" y2="${(backA.y - trellisH).toFixed(1)}" stroke="#8a6a3f" stroke-width="4"/><line x1="${backB.x.toFixed(1)}" y1="${backB.y.toFixed(1)}" x2="${backB.x.toFixed(1)}" y2="${(backB.y - trellisH).toFixed(1)}" stroke="#8a6a3f" stroke-width="4"/>`;
                for(let i = 1; i <= 4; i++) {
                    const yRail = backA.y - trellisH * i / 5;
                    detail += `<line x1="${backA.x.toFixed(1)}" y1="${yRail.toFixed(1)}" x2="${backB.x.toFixed(1)}" y2="${yRail.toFixed(1)}" stroke="#b78d54" stroke-width="2"/>`;
                }
            }
            if(['banc', 'cube', 'table', 'chair'].includes(spec.type)) {
                const slatCount = spec.type === 'chair' ? 5 : (spec.type === 'table' ? 4 : 5);
                for(let i = 1; i < slatCount; i++) {
                    const t = i / slatCount;
                    const a = lerpPt(v.t000, v.t010, t);
                    const b = lerpPt(v.t100, v.t110, t);
                    detail += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="#5f3e27" stroke-width="1.2" opacity="0.7"/>`;
                }
            }
            if(spec.type === 'cube') {
                const cushion = [
                    lerpPt(lerpPt(v.t000, v.t100, 0.12), lerpPt(v.t010, v.t110, 0.12), 0.18),
                    lerpPt(lerpPt(v.t000, v.t100, 0.90), lerpPt(v.t010, v.t110, 0.90), 0.18),
                    lerpPt(lerpPt(v.t000, v.t100, 0.90), lerpPt(v.t010, v.t110, 0.90), 0.84),
                    lerpPt(lerpPt(v.t000, v.t100, 0.12), lerpPt(v.t010, v.t110, 0.12), 0.84)
                ];
                detail += `<polygon points="${poly(cushion)}" fill="#ddd5bd" stroke="#bfb69d" stroke-width="1.1"/>`;
            }

            const dimHeightX = v.p110.x + 38;
            const dimHeightMidY = (v.p110.y + v.t110.y) / 2;
            const heightDim = `
                <line x1="${v.p110.x.toFixed(1)}" y1="${v.p110.y.toFixed(1)}" x2="${dimHeightX.toFixed(1)}" y2="${v.p110.y.toFixed(1)}" stroke="${ext}" stroke-dasharray="3 2"/>
                <line x1="${v.t110.x.toFixed(1)}" y1="${v.t110.y.toFixed(1)}" x2="${dimHeightX.toFixed(1)}" y2="${v.t110.y.toFixed(1)}" stroke="${ext}" stroke-dasharray="3 2"/>
                <line x1="${dimHeightX.toFixed(1)}" y1="${v.p110.y.toFixed(1)}" x2="${dimHeightX.toFixed(1)}" y2="${v.t110.y.toFixed(1)}" stroke="${dim}" stroke-width="1" marker-start="url(#iso-b)" marker-end="url(#iso-a)"/>
                <text x="${(dimHeightX + 18).toFixed(1)}" y="${dimHeightMidY.toFixed(1)}" font-size="12.5" fill="${dim}" transform="rotate(-90 ${(dimHeightX + 18).toFixed(1)} ${dimHeightMidY.toFixed(1)})">${cm(h)}</text>
            `;
            const axisLegend = `
                <line x1="32" y1="292" x2="74" y2="316" stroke="#8a6a3f" stroke-width="1.4"/><text x="78" y="320" font-size="10.5" fill="#5a4634">profondeur</text>
                <line x1="32" y1="292" x2="74" y2="268" stroke="#8a6a3f" stroke-width="1.4"/><text x="78" y="270" font-size="10.5" fill="#5a4634">longueur</text>
                <line x1="32" y1="292" x2="32" y2="248" stroke="#8a6a3f" stroke-width="1.4"/><text x="38" y="250" font-size="10.5" fill="#5a4634">hauteur</text>
            `;

            return `<svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block;height:auto;" xmlns="http://www.w3.org/2000/svg"><defs><marker id="iso-a" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="5.3" refY="3" orient="auto"><path d="M0,0.6 L5.3,3 L0,5.4 z" fill="${dim}"/></marker><marker id="iso-b" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M5.3,0.6 L0,3 L5.3,5.4 z" fill="${dim}"/></marker></defs><rect x="8" y="8" width="${vbW - 16}" height="${vbH - 16}" rx="4" fill="#fffefc" stroke="#d8cab8"/><text x="22" y="34" font-size="17" fill="#2f261d">${escapeHtmlForDoc(spec.label)}</text><text x="22" y="52" font-size="11" fill="#6f604f">Projection isométrique 30° - échelle identique sur les 3 axes</text><polygon points="${poly([v.p010, v.p110, v.t110, v.t010])}" fill="${frontFill}" stroke="#5d4634" stroke-width="1.1"/><polygon points="${poly([v.p100, v.p110, v.t110, v.t100])}" fill="${sideFill}" stroke="#5d4634" stroke-width="1.1"/><polygon points="${poly([v.p000, v.p100, v.t100, v.t000])}" fill="${sideFill}" opacity="0.72" stroke="#5d4634" stroke-width="1.1"/><polygon points="${poly([v.t000, v.t100, v.t110, v.t010])}" fill="${topFill}" stroke="#5d4634" stroke-width="1.2"/>${detail}${dimLine(v.p010, v.p110, cm(w), 0, 30)}${dimLine(v.p110, v.p100, cm(d), 34, 18)}${heightDim}${axisLegend}</svg>`;
        }

        function buildWorkshopOverviewSvgFromModel(model, spec) {
            if(!model || !spec) return '';
            const types = computeChantierPieceTypes(model.pieces || []);
            const pieces = (model.pieces || []).filter(piece => piece && piece.pos && piece.dim);
            const vbW = 980;
            const vbH = 680;
            const ink = '#111111';
            const dim = '#171717';
            const guide = '#757575';
            const cos30 = Math.cos(Math.PI / 6);
            const sin30 = 0.5;
            const cm = v => `${formatCmForDoc(v)} cm`;
            const mm = v => `${dmToMm(v)} mm`;
            const escape = escapeHtmlForDoc;

            const rawProject = (x, z, y) => ({
                x: (x - z) * cos30,
                y: (x + z) * sin30 - y
            });
            const getPieceBox = piece => {
                const rotated = Math.abs(piece.rotY || 0) > 0.01;
                const hx = Math.max(0.005, (rotated ? piece.dim.T : piece.dim.L) / 2);
                const hz = Math.max(0.005, (rotated ? piece.dim.L : piece.dim.T) / 2);
                const hy = Math.max(0.005, (piece.dim.H || 0.01) / 2);
                const x = piece.pos.x || 0;
                const z = piece.pos.z || 0;
                const y = piece.pos.y || 0;
                return [
                    { x: x - hx, z: z - hz, y: y - hy },
                    { x: x + hx, z: z - hz, y: y - hy },
                    { x: x + hx, z: z + hz, y: y - hy },
                    { x: x - hx, z: z + hz, y: y - hy },
                    { x: x - hx, z: z - hz, y: y + hy },
                    { x: x + hx, z: z - hz, y: y + hy },
                    { x: x + hx, z: z + hz, y: y + hy },
                    { x: x - hx, z: z + hz, y: y + hy }
                ];
            };

            const allVertices = pieces.flatMap(getPieceBox);
            if(!allVertices.length) return '';
            const rawVertices = allVertices.map(v => rawProject(v.x, v.z, v.y));
            const minRawX = Math.min(...rawVertices.map(p => p.x));
            const maxRawX = Math.max(...rawVertices.map(p => p.x));
            const minRawY = Math.min(...rawVertices.map(p => p.y));
            const maxRawY = Math.max(...rawVertices.map(p => p.y));
            const drawArea = { x: 34, y: 88, w: 520, h: 520 };
            const scale = Math.min(
                drawArea.w / Math.max(maxRawX - minRawX, 0.1),
                drawArea.h / Math.max(maxRawY - minRawY, 0.1)
            );
            const drawingW = (maxRawX - minRawX) * scale;
            const drawingH = (maxRawY - minRawY) * scale;
            const offset = {
                x: drawArea.x + (drawArea.w - drawingW) / 2 - minRawX * scale,
                y: drawArea.y + (drawArea.h - drawingH) / 2 - minRawY * scale
            };
            const project = (x, z, y) => {
                const p = rawProject(x, z, y);
                return { x: offset.x + p.x * scale, y: offset.y + p.y * scale };
            };
            const lineSvg = (a, b, dashed = false, sw = 1) => `
                <line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${ink}" stroke-width="${sw}" fill="none" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 4" opacity="0.72"' : ''}/>
            `;
            const hiddenEdges = [[0, 1], [0, 3], [0, 4]];
            const visibleEdges = [[1, 2], [2, 3], [4, 5], [5, 6], [6, 7], [7, 4], [1, 5], [2, 6], [3, 7]];
            const pieceWeight = piece => {
                const familyWeight = piece.family === 'TreillisRail' ? 4 : piece.family === 'TreillisPost' ? 3 : piece.family === 'LatteFond' ? 1 : 2;
                return (piece.pos.z || 0) + familyWeight;
            };
            const wireframe = [...pieces].sort((a, b) => pieceWeight(a) - pieceWeight(b)).map(piece => {
                const pts = getPieceBox(piece).map(v => project(v.x, v.z, v.y));
                const sw = piece.family === 'TreillisRail' || piece.family === 'LatteFond' ? 0.75 : 1;
                const hidden = hiddenEdges.map(edge => lineSvg(pts[edge[0]], pts[edge[1]], true, sw)).join('');
                const visible = visibleEdges.map(edge => lineSvg(pts[edge[0]], pts[edge[1]], false, sw)).join('');
                return hidden + visible;
            }).join('');
            const outlineMinX = Math.min(...allVertices.map(v => v.x));
            const outlineMaxX = Math.max(...allVertices.map(v => v.x));
            const outlineMinZ = Math.min(...allVertices.map(v => v.z));
            const outlineMaxZ = Math.max(...allVertices.map(v => v.z));
            const outlineMinY = Math.min(...allVertices.map(v => v.y));
            const outlineMaxY = Math.max(...allVertices.map(v => v.y));
            const bottomFrontLeft = project(outlineMinX, outlineMaxZ, outlineMinY);
            const bottomFrontRight = project(outlineMaxX, outlineMaxZ, outlineMinY);
            const bottomBackRight = project(outlineMaxX, outlineMinZ, outlineMinY);
            const topFrontRight = project(outlineMaxX, outlineMaxZ, outlineMaxY);

            const typeRows = types.slice(0, 11).map((type, idx) => {
                const p = type.representative;
                const shortLabel = String(type.baseLabel || '').slice(0, 34);
                return `
                    <g transform="translate(0 ${idx * 31})">
                        <rect x="0" y="0" width="330" height="31" fill="${idx % 2 ? '#fffaf2' : '#f4eadc'}" stroke="#d3c3b2" stroke-width="0.7"/>
                        <text x="8" y="20" font-size="10.5" fill="#1d1712">${idx + 1}</text>
                        <text x="32" y="20" font-size="10.5" fill="#1d1712">${escape(shortLabel)}</text>
                        <text x="218" y="20" font-size="10.5" fill="#1d1712">x${type.count}</text>
                        <text x="252" y="20" font-size="10.2" fill="#1d1712">${mm(p.dim.L)} x ${mm(p.dim.H)} x ${mm(p.dim.T)}</text>
                    </g>
                `;
            }).join('');
            const moreRows = types.length > 11
                ? `<text x="590" y="496" font-size="11" fill="#5f4b3b">+ ${types.length - 11} types dans les plans detailles ci-dessous</text>`
                : '';
            const screwCount = (model.screws || []).length;
            const screwLabel = screwCount ? `${screwCount} vis repérées dans les plans de perçage` : 'Perçages à confirmer';

            const dimLine = (a, b, label, ox, oy, angle = null) => {
                const a2 = { x: a.x + ox, y: a.y + oy };
                const b2 = { x: b.x + ox, y: b.y + oy };
                const mx = (a2.x + b2.x) / 2;
                const my = (a2.y + b2.y) / 2 - 5;
                const rot = angle === null ? Math.atan2(b2.y - a2.y, b2.x - a2.x) * 180 / Math.PI : angle;
                return `
                    <line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${a2.x.toFixed(1)}" y2="${a2.y.toFixed(1)}" stroke="${guide}" stroke-dasharray="3 2"/>
                    <line x1="${b.x.toFixed(1)}" y1="${b.y.toFixed(1)}" x2="${b2.x.toFixed(1)}" y2="${b2.y.toFixed(1)}" stroke="${guide}" stroke-dasharray="3 2"/>
                    <line x1="${a2.x.toFixed(1)}" y1="${a2.y.toFixed(1)}" x2="${b2.x.toFixed(1)}" y2="${b2.y.toFixed(1)}" stroke="${dim}" stroke-width="1.1" marker-start="url(#wa)" marker-end="url(#wb)"/>
                    <text x="${mx.toFixed(1)}" y="${my.toFixed(1)}" text-anchor="middle" font-size="13" fill="${dim}" transform="rotate(${rot.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)})">${label}</text>
                `;
            };
            const legend = `
                <line x1="44" y1="630" x2="88" y2="630" stroke="${ink}" stroke-width="1.2"/>
                <text x="96" y="634" font-size="11" fill="${ink}">arete visible</text>
                <line x1="194" y1="630" x2="238" y2="630" stroke="${ink}" stroke-width="1.1" stroke-dasharray="5 4" opacity="0.72"/>
                <text x="246" y="634" font-size="11" fill="${ink}">arete cachee</text>
            `;

            return `
                <svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block;height:auto;" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                        <marker id="wa" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="0.7" refY="3" orient="auto"><path d="M5.3,0.6 L0,3 L5.3,5.4 z" fill="${dim}"/></marker>
                        <marker id="wb" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="5.3" refY="3" orient="auto"><path d="M0,0.6 L5.3,3 L0,5.4 z" fill="${dim}"/></marker>
                    </defs>
                    <rect x="10" y="10" width="${vbW - 20}" height="${vbH - 20}" rx="4" fill="#fffefc" stroke="#d8cab8"/>
                    <text x="28" y="38" font-size="20" font-weight="700" fill="#201812">${escape(spec.label)} - plan atelier</text>
                    <text x="28" y="60" font-size="12" fill="#4a4a4a">Projection filaire depuis le modele 3D: traits pleins visibles, pointilles pour les aretes cachees.</text>
                    <g>${wireframe}</g>
                    ${dimLine(bottomFrontLeft, bottomFrontRight, cm(spec.wCm), 0, 34)}
                    ${dimLine(bottomFrontRight, bottomBackRight, cm(spec.dCm), 38, 20)}
                    <line x1="${topFrontRight.x.toFixed(1)}" y1="${topFrontRight.y.toFixed(1)}" x2="${(topFrontRight.x + 42).toFixed(1)}" y2="${topFrontRight.y.toFixed(1)}" stroke="${guide}" stroke-dasharray="3 2"/>
                    <line x1="${bottomFrontRight.x.toFixed(1)}" y1="${bottomFrontRight.y.toFixed(1)}" x2="${(bottomFrontRight.x + 42).toFixed(1)}" y2="${bottomFrontRight.y.toFixed(1)}" stroke="${guide}" stroke-dasharray="3 2"/>
                    <line x1="${(bottomFrontRight.x + 42).toFixed(1)}" y1="${bottomFrontRight.y.toFixed(1)}" x2="${(topFrontRight.x + 42).toFixed(1)}" y2="${topFrontRight.y.toFixed(1)}" stroke="${dim}" stroke-width="1.1" marker-start="url(#wa)" marker-end="url(#wb)"/>
                    <text x="${(bottomFrontRight.x + 62).toFixed(1)}" y="${((bottomFrontRight.y + topFrontRight.y) / 2).toFixed(1)}" font-size="13" fill="${dim}" transform="rotate(-90 ${(bottomFrontRight.x + 62).toFixed(1)} ${((bottomFrontRight.y + topFrontRight.y) / 2).toFixed(1)})">${cm(spec.hCm)}</text>
                    ${legend}
                    <g transform="translate(590 88)">
                        <text x="0" y="0" font-size="15" font-weight="700" fill="#1d1712">Nomenclature debit</text>
                        <g transform="translate(0 12)">
                            <rect x="0" y="0" width="330" height="28" fill="#e9dccb" stroke="#d3c3b2"/>
                            <text x="8" y="18" font-size="10.5" font-weight="700" fill="#1d1712">#</text>
                            <text x="32" y="18" font-size="10.5" font-weight="700" fill="#1d1712">Piece</text>
                            <text x="218" y="18" font-size="10.5" font-weight="700" fill="#1d1712">Qte</text>
                            <text x="252" y="18" font-size="10.5" font-weight="700" fill="#1d1712">L x H x Ep</text>
                            <g transform="translate(0 28)">${typeRows}</g>
                        </g>
                    </g>
                    ${moreRows}
                    <line x1="590" y1="518" x2="920" y2="518" stroke="#d3c3b2"/>
                    <text x="590" y="538" font-size="11" fill="#3b2d22">${escape(screwLabel)}</text>
                    <text x="590" y="556" font-size="11" fill="#3b2d22">EPDM, geotextile et substrats: quantites dans le debit global.</text>
                </svg>
            `;
        }

        function buildJardiniereWorkshopOverviewSvg(j, spec) {
            if(!j || !spec) return '';
            const metrics = computeJardiniereConstructionMetrics(j);
            const model = buildJardiniereFabricationModel(j, metrics);
            return buildWorkshopOverviewSvgFromModel(model, spec);
        }

        function extractFabricationModelFromGroup(group) {
            if(!group) return { pieces: [], screws: [] };
            const settings = getDefaultConstructionSettings();
            const boardT = settings.boardThickness;
            const pieces = [];
            let id = 1;
            group.children.forEach(mesh => {
                if(!mesh.isMesh) return;
                const geo = mesh.geometry;
                if(!geo || geo.type !== 'BoxGeometry') return;
                const L = geo.parameters.width;
                const H = geo.parameters.height;
                const T = geo.parameters.depth;
                const family = Math.abs(H - boardT) < boardT * 0.4 ? 'Planche' : 'Lambourde';
                pieces.push({
                    id: `P${id++}`,
                    family,
                    label: `${family} ${id - 1}`,
                    dim: { L, H, T },
                    pos: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
                    rotY: -(mesh.rotation.y || 0),
                    holes2d: []
                });
            });
            return { pieces, screws: [] };
        }

        function getItemWorkshopSvg(entry, spec) {
            if(!entry || !spec) return buildObjectIsoDimensionSvg(spec);
            const { item, type } = entry;
            if(type === 'jardiniere') return buildJardiniereWorkshopOverviewSvg(item, spec);
            if(item && item.group) {
                const model = extractFabricationModelFromGroup(item.group);
                if(model && model.pieces.length > 0)
                    return buildWorkshopOverviewSvgFromModel(model, spec);
            }
            return buildObjectIsoDimensionSvg(spec);
        }

        function renderLiveObjectIsoViews() {
            const wrap = document.getElementById('fabrication-iso-live');
            if(!wrap) return;
            const entries = getConstructionItems()
                .filter(entry => shouldIncludeConstructionInCalculations(entry.item, entry.type));
            const specs = entries.map(getConstructionIsoDimensions).filter(Boolean);
            if(!specs.length) {
                wrap.innerHTML = '<div class="dp-help">Aucun objet avec dimensions à afficher.</div>';
                return;
            }
            wrap.innerHTML = entries.map((entry, idx) => {
                const spec = getConstructionIsoDimensions(entry);
                if(!spec) return '';
                const svg = getItemWorkshopSvg(entry, spec);
                const isoId = `fabrication-iso-live-${idx}`;
                const title = `${spec.label} - vue isométrique`;
                return `<div id="${isoId}" data-title="${escapeHtmlForDoc(title)}" title="Cliquer pour agrandir" onclick="openIsoPlanModal('${isoId}')" style="border:1px solid #303030;border-radius:6px;padding:5px;background:#111;cursor:zoom-in;">${svg}</div>`;
            }).join('');
        }

        function optimizeCutsFFD(lengthsCm, stockEntriesOrLength, kerfCm = 0) {
            const stockEntries = Array.isArray(stockEntriesOrLength)
                ? stockEntriesOrLength
                : parseStockInventory('', Math.max(100, stockEntriesOrLength || 300));
            const availableStocks = [];
            stockEntries.forEach(entry => {
                const qty = entry.qty === Infinity ? Math.max(1, lengthsCm.length || 1) : entry.qty;
                for(let i = 0; i < qty; i++) {
                    availableStocks.push({
                        stockLengthCm: Math.max(1, entry.lengthCm || 0),
                        sourceLabel: entry.label || `${formatCmForDoc(entry.lengthCm)} cm`
                    });
                }
            });
            availableStocks.sort((a, b) => a.stockLengthCm - b.stockLengthCm);

            const sorted = lengthsCm
                .filter(v => v > 0)
                .map((lengthCm, index) => ({ lengthCm, sourceIndex: index + 1 }))
                .sort((a, b) => b.lengthCm - a.lengthCm);
            const bars = [];
            const unableToFit = [];
            const safeKerf = Math.max(0, kerfCm || 0);

            function requiredSpace(bar, pieceLengthCm) {
                return pieceLengthCm + (bar.cuts.length > 0 ? safeKerf : 0);
            }

            sorted.forEach(piece => {
                let bestBar = null;
                let bestWaste = Infinity;
                for(const bar of bars) {
                    const need = requiredSpace(bar, piece.lengthCm);
                    if(bar.remaining + 1e-9 >= need) {
                        const after = bar.remaining - need;
                        if(after < bestWaste) {
                            bestWaste = after;
                            bestBar = bar;
                        }
                    }
                }
                if(bestBar) {
                    const need = requiredSpace(bestBar, piece.lengthCm);
                    if(bestBar.cuts.length > 0) bestBar.cutLossCm += safeKerf;
                    bestBar.cuts.push(piece);
                    bestBar.remaining = Math.round((bestBar.remaining - need) * 10) / 10;
                    return;
                }

                const stockIdx = availableStocks.findIndex(stock => stock.stockLengthCm + 1e-9 >= piece.lengthCm);
                if(stockIdx < 0) {
                    unableToFit.push(piece);
                    return;
                }

                const stock = availableStocks.splice(stockIdx, 1)[0];
                bars.push({
                    cuts: [piece],
                    remaining: Math.round((stock.stockLengthCm - piece.lengthCm) * 10) / 10,
                    stockLengthCm: stock.stockLengthCm,
                    sourceLabel: stock.sourceLabel,
                    cutLossCm: 0,
                    kerfCm: safeKerf
                });
            });

            return { bars, unableToFit, kerfCm: safeKerf };
        }

        function renderCutBarsSvg(cutPlan, fallbackStockLengthCm) {
            const bars = Array.isArray(cutPlan) ? cutPlan : (cutPlan && cutPlan.bars) || [];
            if(!bars || bars.length === 0) return '';
            const barW = 760;
            const barH = 20;
            const rowGap = 30;
            const leftPad = 42;
            const rightPad = 22;
            const topPad = 38;
            const titleH = 22;
            const width = leftPad + barW + rightPad;
            const height = topPad + titleH + bars.length * (barH + rowGap) + 8;
            const maxStock = Math.max(...bars.map(bar => bar.stockLengthCm || fallbackStockLengthCm || 300), fallbackStockLengthCm || 300, 100);
            const scale = barW / maxStock;
            const kerfCm = cutPlan && Number.isFinite(cutPlan.kerfCm) ? cutPlan.kerfCm : getSawKerfCm();
            const palette = ['#dfe6ec', '#d2dbe3', '#c7d0d8', '#bcc6cf', '#b2bdc6', '#aab5be'];

            let shapes = `
                <defs>
                    <marker id="cutDimArrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse">
                        <path d="M0,3 L6,0 L6,6 z" fill="#2a2a2a"></path>
                    </marker>
                    <pattern id="cutWasteHatch" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
                        <line x1="0" y1="0" x2="0" y2="6" stroke="#959595" stroke-width="1"/>
                    </pattern>
                </defs>
                <rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5"/>
                <text x="${leftPad}" y="18" fill="#111" font-size="12" font-weight="700">Plan de coupe atelier - longueurs pièces inchangées</text>
                <text x="${leftPad}" y="32" fill="#555" font-size="9">Trait de scie entre pièces: ${Math.round(kerfCm * 10)} mm</text>
            `;

            bars.forEach((bar, i) => {
                const y = topPad + titleH + i * (barH + rowGap);
                const dimY = y + barH + 10;
                const safeStock = Math.max(1, bar.stockLengthCm || fallbackStockLengthCm || 300);
                shapes += `<text x="6" y="${y + barH - 5}" fill="#222" font-size="10" font-weight="700">B${i + 1}</text>`;
                shapes += `<rect x="${leftPad}" y="${y}" width="${(safeStock * scale).toFixed(2)}" height="${barH}" fill="#ffffff" stroke="#222" stroke-width="1"/>`;

                let cursorCm = 0;
                bar.cuts.forEach((cut, idx) => {
                    if(idx > 0 && kerfCm > 0) {
                        const kerfX = leftPad + cursorCm * scale;
                        const kerfW = Math.max(1, kerfCm * scale);
                        shapes += `<rect x="${kerfX.toFixed(2)}" y="${(y - 3).toFixed(2)}" width="${kerfW.toFixed(2)}" height="${(barH + 6).toFixed(2)}" fill="#c65f4a" opacity="0.78"/>`;
                        cursorCm += kerfCm;
                    }
                    const cutLength = typeof cut === 'number' ? cut : cut.lengthCm;
                    const w = Math.max(1, cutLength * scale);
                    const x = leftPad + cursorCm * scale;
                    const color = palette[idx % palette.length];
                    shapes += `<rect x="${x.toFixed(2)}" y="${(y + 1).toFixed(2)}" width="${w.toFixed(2)}" height="${(barH - 2).toFixed(2)}" fill="${color}" stroke="#3a3a3a" stroke-width="0.5"/>`;

                    if(w > 42) {
                        shapes += `<text x="${(x + w / 2).toFixed(2)}" y="${(y + barH - 6).toFixed(2)}" fill="#111" font-size="9" text-anchor="middle">${formatCmForDoc(cutLength)} cm</text>`;
                    }

                    cursorCm += cutLength;
                    if(idx < bar.cuts.length - 1) {
                        const cutX = leftPad + cursorCm * scale;
                        shapes += `<line x1="${cutX.toFixed(2)}" y1="${(y - 4).toFixed(2)}" x2="${cutX.toFixed(2)}" y2="${(y + barH + 4).toFixed(2)}" stroke="#555" stroke-width="0.9" stroke-dasharray="3 2"/>`;
                    }
                });

                if(bar.remaining > 0.5) {
                    const remX = leftPad + Math.max(0, safeStock - bar.remaining) * scale;
                    const remW = bar.remaining * scale;
                    shapes += `<rect x="${remX.toFixed(2)}" y="${(y + 1).toFixed(2)}" width="${Math.max(1, remW).toFixed(2)}" height="${(barH - 2).toFixed(2)}" fill="url(#cutWasteHatch)" stroke="#666" stroke-width="0.6"/>`;
                    if(remW > 36) {
                        shapes += `<text x="${(remX + remW / 2).toFixed(2)}" y="${(y + barH - 6).toFixed(2)}" fill="#222" font-size="8.5" text-anchor="middle">chute ${formatCmForDoc(bar.remaining)} cm</text>`;
                    }
                }

                // Ligne de cote de la barre (longueur d'achat)
                shapes += `<line x1="${leftPad.toFixed(2)}" y1="${dimY.toFixed(2)}" x2="${(leftPad + safeStock * scale).toFixed(2)}" y2="${dimY.toFixed(2)}" stroke="#2a2a2a" stroke-width="0.9" marker-start="url(#cutDimArrow)" marker-end="url(#cutDimArrow)"/>`;
                shapes += `<line x1="${leftPad.toFixed(2)}" y1="${(y + barH).toFixed(2)}" x2="${leftPad.toFixed(2)}" y2="${dimY.toFixed(2)}" stroke="#7a7a7a" stroke-width="0.7" stroke-dasharray="2 2"/>`;
                shapes += `<line x1="${(leftPad + safeStock * scale).toFixed(2)}" y1="${(y + barH).toFixed(2)}" x2="${(leftPad + safeStock * scale).toFixed(2)}" y2="${dimY.toFixed(2)}" stroke="#7a7a7a" stroke-width="0.7" stroke-dasharray="2 2"/>`;
                shapes += `<text x="${(leftPad + safeStock * scale / 2).toFixed(2)}" y="${(dimY - 3).toFixed(2)}" fill="#161616" font-size="9" text-anchor="middle">${formatCmForDoc(safeStock)} cm</text>`;

                const usage = Math.max(0, Math.min(100, Math.round(((safeStock - bar.remaining) / safeStock) * 100)));
                shapes += `<text x="${(leftPad + safeStock * scale + 6).toFixed(2)}" y="${(y + barH - 5).toFixed(2)}" fill="#222" font-size="8.5">${usage}%</text>`;
                shapes += `<text x="${leftPad.toFixed(2)}" y="${(dimY + 12).toFixed(2)}" fill="#555" font-size="8.5">Pièces: ${bar.cuts.length} | Trait scie cumulé: ${formatCmForDoc(bar.cutLossCm || 0)} cm | ${escapeHtmlForDoc(bar.sourceLabel || '')}</text>`;
            });

            return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="display:block;height:auto;background:#f5f5f5;" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`;
        }

        function renderSheetCutsSvg(sheets, title = 'Plan de découpe textile') {
            if(!sheets || sheets.length === 0) return '';
            const maxLen = Math.max(...sheets.map(s => s.lengthCm || 0), 1);
            const maxWid = Math.max(...sheets.map(s => s.widthCm || 0), 1);
            const leftPad = 54;
            const topPad = 34;
            const rowH = 150;
            const drawW = 620;
            const drawH = 96;
            const width = leftPad + drawW + 34;
            const height = topPad + sheets.length * rowH + 18;
            const scale = Math.min(drawW / maxLen, drawH / maxWid);
            const isEpdm = title.toLowerCase().includes('epdm');
            const fill = isEpdm ? '#111111' : '#bfc7bf';
            const stroke = isEpdm ? '#555555' : '#5e6f61';

            let shapes = `
                <rect x="0" y="0" width="${width}" height="${height}" fill="#f5f5f5"/>
                <text x="${leftPad}" y="20" fill="#111" font-size="12" font-weight="700">${escapeHtmlForDoc(title)}</text>
            `;

            sheets.forEach((sheet, idx) => {
                const y = topPad + idx * rowH;
                const rectW = Math.max(10, (sheet.lengthCm || 1) * scale);
                const rectH = Math.max(10, (sheet.widthCm || 1) * scale);
                const x = leftPad;
                shapes += `<text x="8" y="${y + rectH / 2}" fill="#222" font-size="10" font-weight="700">J${idx + 1}</text>`;
                shapes += `<rect x="${x}" y="${y}" width="${rectW}" height="${rectH}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
                shapes += `<text x="${x}" y="${y + rectH + 16}" fill="#222" font-size="10">${escapeHtmlForDoc(sheet.label || '')}</text>`;
                shapes += `<text x="${x + rectW / 2 - 28}" y="${y - 6}" fill="#222" font-size="10">${formatCmForDoc(sheet.lengthCm)} cm</text>`;
                shapes += `<text x="${x + rectW + 8}" y="${y + rectH / 2 + 3}" fill="#222" font-size="10">${formatCmForDoc(sheet.widthCm)} cm</text>`;
                shapes += `<text x="${x}" y="${y + rectH + 30}" fill="#555" font-size="9">Surface: ${sheet.areaM2.toLocaleString('fr-FR')} m²</text>`;
            });

            return `<svg viewBox="0 0 ${width} ${height}" width="100%" style="display:block;height:auto;background:#f5f5f5;" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`;
        }

        function collectCutPiecesAllJardinieres(items = jardinières) {
            const groups = new Map();
            const sourceJardinieres = (Array.isArray(items) ? items : jardinières)
                .filter(j => shouldIncludeConstructionInCalculations(j, 'jardiniere'));

            function addPiece(profile, label, lengthCm, qty, meta = null) {
                if(qty <= 0 || lengthCm <= 0) return;
                const key = profile;
                if(!groups.has(key)) groups.set(key, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(key);
                entry.labels.add(label);
                if(!entry.meta && meta) entry.meta = meta;
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            }

            sourceJardinieres.forEach(j => {
                const metrics = computeJardiniereConstructionMetrics(j);
                const c = metrics.construction;
                const fabricationModel = buildJardiniereFabricationModel(j, metrics);
                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
                const hasLeft = !!j.treillisLeft;
                const hasRight = !!j.treillisRight;
                const treillisStyle = getTreillisStyle(j.treillisType || 'noisetier');
                const cuveMeta = {
                    familyKey: 'cuveBoards',
                    sectionAcm: dmToCm(c.boardThickness),
                    sectionBcm: dmToCm(c.boardWidth)
                };
                const lambourdeMeta = {
                    familyKey: 'lambourdes',
                    sectionAcm: dmToCm(c.lambourdeLong),
                    sectionBcm: dmToCm(c.lambourdeWide)
                };
                const floorBattenMeta = {
                    familyKey: 'floorBattens',
                    sectionAcm: dmToCm(c.floorBattenHeight),
                    sectionBcm: dmToCm(c.floorBattenWidth)
                };
                const treillisPostMeta = {
                    familyKey: 'treillisPosts',
                    sectionAcm: dmToCm(treillisStyle.postSize.w),
                    sectionBcm: dmToCm(treillisStyle.postSize.d)
                };
                const treillisRailMeta = {
                    familyKey: 'treillisRails',
                    sectionAcm: dmToCm(treillisStyle.railSize.w),
                    sectionBcm: dmToCm(treillisStyle.railSize.h)
                };

                const longBoards = fabricationModel.pieces.filter(p => p.family === 'Planche' && Math.abs(p.rotY) < 0.001);
                const sideBoards = fabricationModel.pieces.filter(p => p.family === 'Planche' && Math.abs(p.rotY) >= 0.001);
                const lambourdes = fabricationModel.pieces.filter(p => p.family === 'Lambourde');

                if(longBoards.length) {
                    addPiece(
                        getCuveBoardProfileLabel(c),
                        `Longueurs (${dmToCm(longBoards[0].dim.L)} cm)`,
                        dmToCm(longBoards[0].dim.L),
                        longBoards.length,
                        cuveMeta
                    );
                }
                if(sideBoards.length) {
                    addPiece(
                        getCuveBoardProfileLabel(c),
                        `Largeurs (${dmToCm(sideBoards[0].dim.L)} cm)`,
                        dmToCm(sideBoards[0].dim.L),
                        sideBoards.length,
                        cuveMeta
                    );
                }
                if(lambourdes.length) {
                    addPiece(
                        getLambourdeProfileLabel(c),
                        `Pieds/cuves (${dmToCm(lambourdes[0].dim.H)} cm)`,
                        dmToCm(lambourdes[0].dim.H),
                        lambourdes.length,
                        lambourdeMeta
                    );
                }

                addPiece(
                    `Tasseaux bas ${dmToCm(c.floorBattenHeight)} x ${dmToCm(c.floorBattenWidth)} cm`,
                    `Porte-lattes (${dmToCm(metrics.battenLength)} cm)`,
                    dmToCm(metrics.battenLength),
                    2,
                    floorBattenMeta
                );

                addPiece(
                    getCuveBoardProfileLabel(c),
                    `Fond (${dmToCm(metrics.innerDepth)} cm)`,
                    dmToCm(metrics.innerDepth),
                    metrics.floorSlats.count,
                    cuveMeta
                );

                const postBase = metrics.slatY + c.floorSlatThickness / 2;
                const postH = j.treillisH + metrics.postHeight - postBase;
                let treillisPostCount = 0;
                if(hasBack) treillisPostCount += 2;
                if(hasLeft) treillisPostCount += 2;
                if(hasRight) treillisPostCount += 2;

                addPiece(
                    `Poteaux treillis ${dmToCm(treillisStyle.postSize.w)} x ${dmToCm(treillisStyle.postSize.d)} cm`,
                    `Montants (${dmToCm(postH)} cm)`,
                    dmToCm(postH),
                    treillisPostCount,
                    treillisPostMeta
                );

                const railBottomY = metrics.postHeight + 1.0;
                const railTopY = j.treillisH + metrics.postHeight - 1.0;
                const railSpan = Math.max(0, railTopY - railBottomY);
                const railLayout = computeFloorSlatLayout(railSpan, treillisStyle.railSize.h, 1.5, 2.0);
                const railCount = railLayout.count;
                const backRailLen = Math.max(j.w - 2 * c.boardThickness, 0.1);
                const sideSpanZ = Math.max(0.35, 2 * metrics.lambourdeZ - c.lambourdeWide - treillisStyle.postSize.d);

                if(hasBack) {
                    addPiece(
                        `Lattes treillis ${dmToCm(treillisStyle.railSize.w)} x ${dmToCm(treillisStyle.railSize.h)} cm`,
                        `Treillis arrière (${dmToCm(backRailLen)} cm)`,
                        dmToCm(backRailLen),
                        railCount,
                        treillisRailMeta
                    );
                }
                if(hasLeft) {
                    addPiece(
                        `Lattes treillis ${dmToCm(treillisStyle.railSize.w)} x ${dmToCm(treillisStyle.railSize.h)} cm`,
                        `Treillis gauche (${dmToCm(sideSpanZ)} cm)`,
                        dmToCm(sideSpanZ),
                        railCount,
                        treillisRailMeta
                    );
                }
	                if(hasRight) {
	                    addPiece(
	                        `Lattes treillis ${dmToCm(treillisStyle.railSize.w)} x ${dmToCm(treillisStyle.railSize.h)} cm`,
	                        `Treillis droite (${dmToCm(sideSpanZ)} cm)`,
	                        dmToCm(sideSpanZ),
	                        railCount,
	                        treillisRailMeta
	                    );
	                }
	            });

	            const epdmSheets = [];
	            const geotextileSheets = [];
	            sourceJardinieres.forEach((j, idx) => {
	                const cuts = getJardiniereLinerCuts(j);
	                epdmSheets.push({
	                    label: `Jardinière ${idx + 1} - circonférence intérieure + 15%, hauteur intérieure + 15%`,
	                    lengthCm: cuts.epdm.lengthCm,
	                    widthCm: cuts.epdm.widthCm,
	                    areaM2: cuts.epdm.areaM2
	                });
	                geotextileSheets.push({
	                    label: `Jardinière ${idx + 1} - fond + 30% sur longueur et largeur`,
	                    lengthCm: cuts.geotextile.lengthCm,
	                    widthCm: cuts.geotextile.widthCm,
	                    areaM2: cuts.geotextile.areaM2
	                });
	            });
	            if(epdmSheets.length) {
	                groups.set('Bâche EPDM bassin noire', {
	                    profile: 'Bâche EPDM bassin noire',
	                    label: 'Parois intérieures: longueur = circonférence intérieure + 15%, largeur = hauteur intérieure + 15%',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'epdmLiner',
	                        unitType: 'sheet',
	                        qty: Math.round(epdmSheets.reduce((sum, s) => sum + s.areaM2, 0) * 100) / 100,
	                        sheets: epdmSheets
	                    }
	                });
	            }
	            if(geotextileSheets.length) {
	                groups.set('Géotextile drainant fond', {
	                    profile: 'Géotextile drainant fond',
	                    label: 'Fond respirant et drainant: longueur et largeur de fond + 30% pour remonter sur les côtés',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'geotextile',
	                        unitType: 'sheet',
	                        qty: Math.round(geotextileSheets.reduce((sum, s) => sum + s.areaM2, 0) * 100) / 100,
	                        sheets: geotextileSheets
	                    }
	                });
	            }

	            const materialVolumes = sourceJardinieres.reduce((acc, j) => {
	                const cuts = getJardiniereLinerCuts(j);
	                const materialLayers = getJardiniereMaterialLayerHeightsDm(j);
	                const baseDm2 = Math.max(cuts.innerWdm, 0) * Math.max(cuts.innerDdm, 0);
	                acc.clayPebblesL += baseDm2 * materialLayers.clayPebbles;
	                acc.topsoilL += baseDm2 * materialLayers.topsoil;
	                acc.soilL += baseDm2 * materialLayers.pottingSoil;
	                acc.mulchL += baseDm2 * materialLayers.mulch;
	                acc.plants += (j.plants || []).length;
	                return acc;
	            }, { clayPebblesL: 0, topsoilL: 0, soilL: 0, mulchL: 0, plants: 0 });

	            const addLiterMaterialGroup = (profile, label, liters, familyKey) => {
	                const qty = Math.round(Math.max(0, liters) * 10) / 10;
	                if(qty <= 0) return;
	                groups.set(profile, {
	                    profile,
	                    label,
	                    lengths: [],
	                    meta: {
	                        familyKey,
	                        unitType: 'liter',
	                        qty
	                    }
	                });
	            };

	            addLiterMaterialGroup(
	                'Billes d’argile',
	                "Couche drainante de 3 cm sur le géotextile",
	                materialVolumes.clayPebblesL,
	                'clayPebblesLiter'
	            );
	            addLiterMaterialGroup(
	                'Terre végétale',
	                `Mélange de plantation: ${Math.round(PLANTING_MIX_RATIOS.topsoil * 100)}% terre végétale`,
	                materialVolumes.topsoilL,
	                'topsoilLiter'
	            );
	            addLiterMaterialGroup(
	                'Terreau',
	                `Mélange de plantation: ${Math.round(PLANTING_MIX_RATIOS.pottingSoil * 100)}% terreau`,
	                materialVolumes.soilL,
	                'soilLiter'
	            );
	            addLiterMaterialGroup(
	                'Paillage',
	                "Couche finale de 3 cm affleurant le bois",
	                materialVolumes.mulchL,
	                'mulchLiter'
	            );
	            if(materialVolumes.plants > 0) {
	                groups.set('Plantes', {
	                    profile: 'Plantes',
	                    label: 'Plantes ajoutées dans les jardinières',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'plant',
	                        unitType: 'item',
	                        qty: materialVolumes.plants
	                    }
	                });
	            }

	            const treillisSpotCount = sourceJardinieres.reduce((sum, j) => {
	                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
	                const hasAnyTreillis = (j.treillisBack !== false && (hasBack || j.hasTreillis)) || j.treillisLeft || j.treillisRight;
	                return sum + (hasTreillisSpots(j) && hasAnyTreillis ? 2 : 0);
	            }, 0);
	            const treillisGarlandCounts = sourceJardinieres.reduce((acc, j) => {
	                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
	                const sideCount = (j.treillisBack !== false && hasBack ? 1 : 0) + (j.treillisLeft ? 1 : 0) + (j.treillisRight ? 1 : 0);
	                if(sideCount <= 0) return acc;
	                if(hasTreillisGinguette(j)) acc.ginguette += sideCount;
	                else if(hasTreillisWhiteGarland(j)) acc.white += sideCount;
	                return acc;
	            }, { white: 0, ginguette: 0 });
	            if(treillisSpotCount > 0) {
	                groups.set('Spots LED treillis extérieur', {
	                    profile: 'Spots LED treillis extérieur',
	                    label: 'Lumière spot: 2 spots par jardinière équipée',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'treillisSpots',
	                        unitType: 'item',
	                        qty: treillisSpotCount
	                    }
	                });
	            }
	            if(treillisGarlandCounts.white > 0) {
	                groups.set('Guirlande blanche treillis extérieur', {
	                    profile: 'Guirlande blanche treillis extérieur',
	                    label: 'Lumière treillis blanche: 1 guirlande par côté de treillis actif',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'treillisGarlandWhite',
	                        unitType: 'item',
	                        qty: treillisGarlandCounts.white
	                    }
	                });
	            }
	            if(treillisGarlandCounts.ginguette > 0) {
	                groups.set('Guirlande guinguette treillis extérieur', {
	                    profile: 'Guirlande guinguette treillis extérieur',
	                    label: 'Option guinguette: 1 guirlande par côté de treillis actif',
	                    lengths: [],
	                    meta: {
	                        familyKey: 'treillisGarlandGinguette',
	                        unitType: 'item',
	                        qty: treillisGarlandCounts.ginguette
	                    }
	                });
	            }

	            const screwBreakdown = {};
	            const screwCount = sourceJardinieres.reduce((sum, j) => {
	                const metrics = computeJardiniereConstructionMetrics(j);
	                const model = buildJardiniereFabricationModel(j, metrics);
	                (model.screws || []).forEach(s => {
	                    const key = s.role || 'Assemblage';
	                    screwBreakdown[key] = (screwBreakdown[key] || 0) + 1;
	                });
	                return sum + (model.screws || []).length;
	            }, 0);
	            const meridienneScrewCount = (cubes || [])
                    .filter(cube => shouldIncludeConstructionInCalculations(cube, 'cube'))
                    .reduce((sum, cube) => {
	                const model = buildMeridienneFabricationModel(cube);
	                (model.screws || []).forEach(s => {
	                    const key = s.role || 'Assemblage méridienne';
	                    screwBreakdown[key] = (screwBreakdown[key] || 0) + 1;
	                });
	                return sum + (model.screws || []).length;
	            }, 0);
	            const totalScrewCount = screwCount + meridienneScrewCount;
	            if(totalScrewCount > 0) {
	                const screwLabel = Object.entries(screwBreakdown)
	                    .map(([label, qty]) => `${label}: ${qty}`)
	                    .join(' • ');
	                groups.set('Vis bois Ø4 mm', {
	                    profile: 'Vis bois Ø4 mm',
	                    label: screwLabel,
	                    lengths: [],
	                    meta: {
	                        familyKey: 'screws',
	                        unitType: 'box',
	                        qty: totalScrewCount,
	                        packSize: 100,
	                        breakdown: screwBreakdown
	                    }
	                });
	            }

	            return Array.from(groups.values()).map(g => ({
	                profile: g.profile,
	                label: g.labels && g.labels.size ? Array.from(g.labels).join(' • ') : (g.label || ''),
	                lengths: g.lengths || [],
	                meta: g.meta || null
	            }));
	        }

        function renderCutGroupDimensionEditor(group, profileInputId) {
            if(!group || !group.meta || !group.meta.familyKey) return '';
            const thicknessId = profileInputId + '-th';
            const widthId = profileInputId + '-wd';
            const familyKeyEncoded = encodeURIComponent(group.meta.familyKey);
            const thicknessCm = Math.max(0.3, parseFloat(group.meta.sectionAcm) || 2);
            const widthCm = Math.max(0.3, parseFloat(group.meta.sectionBcm) || 2);
            return `
                <div class="cut-section-editor">
                    <span class="cut-section-label">Section l × H</span>
                    <input id="${thicknessId}" type="number" min="0.3" max="35" step="0.1" inputmode="decimal" value="${thicknessCm}" onchange="updateFamilySectionDimensions(decodeURIComponent('${familyKeyEncoded}'), this.value, document.getElementById('${widthId}').value)" onkeydown="commitNumberInputOnEnter(event)">
                    <span style="font-size:0.72em;color:#777;">×</span>
                    <input id="${widthId}" type="number" min="0.3" max="35" step="0.1" inputmode="decimal" value="${widthCm}" onchange="updateFamilySectionDimensions(decodeURIComponent('${familyKeyEncoded}'), document.getElementById('${thicknessId}').value, this.value)" onkeydown="commitNumberInputOnEnter(event)">
                    <span style="font-size:0.66em;color:#777;">cm</span>
                </div>
            `;
        }

        function renderLiveCutPlan() {
            const form = ensureFabricationFormReady();
            const wrap = document.getElementById('cut-plan-live');
            if(!form || !wrap) return;

            const groups = collectCutPiecesAllConstructions();
            if(groups.length === 0) {
                wrap.innerHTML = '<div class="dp-help">Aucun objet à découper.</div>';
                renderLiveObjectIsoViews();
                renderLiveWeightSummary();
                return;
            }

	            let totalBars = 0;
	            let totalWaste = 0;
	            let totalSawLoss = 0;
	            let html = '';

	            groups.forEach(group => {
	                const groupStockLengthCm = getStockLengthForProfile(group.profile);
	                const groupStockEntries = getStockEntriesForProfile(group.profile);
	                const profileInputId = getCutProfileId(group.profile);
	                const profileEncoded = encodeURIComponent(group.profile);
	                const profileDisplayName = String(group.profile || '').replace(/\s+\d+(?:[\.,]\d+)?\s*x\s*\d+(?:[\.,]\d+)?\s*cm$/i, '');
	                const unitType = group.meta && group.meta.unitType;
	                const isScrewGroup = unitType === 'box';
	                const isItemGroup = unitType === 'item';
	                const isSheetGroup = unitType === 'sheet';
	                const isLiterGroup = unitType === 'liter';
	                const isAccessoryGroup = isScrewGroup || isItemGroup || isLiterGroup;
	                const cutPlan = (isAccessoryGroup || isSheetGroup) ? { bars: [], unableToFit: [], kerfCm: getSawKerfCm() } : optimizeCutsFFD(group.lengths, groupStockEntries, getSawKerfCm());
	                const bars = cutPlan.bars || [];
	                const waste = bars.reduce((a, b) => a + b.remaining, 0);
	                const sawLoss = bars.reduce((a, b) => a + (b.cutLossCm || 0), 0);
	                const barsSvg = isSheetGroup ? renderSheetCutsSvg(group.meta.sheets || [], group.profile) : (isAccessoryGroup ? '' : renderCutBarsSvg(cutPlan, groupStockLengthCm));
	                const dimEditorHtml = renderCutGroupDimensionEditor(group, profileInputId);
	                const unitsToBuy = isScrewGroup ? Math.ceil((group.meta.qty || 0) / (group.meta.packSize || 100)) : (isItemGroup || isSheetGroup || isLiterGroup ? (group.meta.qty || 0) : bars.length);
	                const groupSummary = isScrewGroup
	                    ? `Vis: ${group.meta.qty} • Boîtes: ${unitsToBuy} × ${group.meta.packSize}<br>${escapeHtmlForDoc(group.label || '')}`
	                    : (isItemGroup
	                        ? `Quantité: ${group.meta.qty}<br>${escapeHtmlForDoc(group.label || '')}`
	                        : (isLiterGroup
	                            ? `Volume: ${unitsToBuy.toLocaleString('fr-FR')} L<br>${escapeHtmlForDoc(group.label || '')}`
	                            : (isSheetGroup
	                            ? `Surface: ${unitsToBuy.toLocaleString('fr-FR')} m² • Découpes: ${(group.meta.sheets || []).length}<br>${escapeHtmlForDoc(group.label || '')}`
	                            : `Pièces: ${group.lengths.length} • Barres: ${bars.length} • Chute: ${formatCmForDoc(waste)} cm • Trait scie cumulé: ${formatCmForDoc(sawLoss)} cm`)));
	                totalBars += unitsToBuy;
	                totalWaste += waste;
	                totalSawLoss += sawLoss;
	                const unableHtml = cutPlan.unableToFit && cutPlan.unableToFit.length
	                    ? `<div style="margin-top:3px;color:#ff9b85;font-weight:800;">Hors stock: ${cutPlan.unableToFit.map(p => formatCmForDoc(p.lengthCm) + ' cm').join(', ')}</div>`
	                    : '';

	                html += `
	                    <div style="border:1px solid #303030;border-radius:6px;padding:5px;background:#111;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:6px;">
                            <div style="color:#f0dcc1;font-weight:600;">${profileDisplayName}</div>
                            ${(isAccessoryGroup && !isSheetGroup) ? '' : `<button class="jp-btn" style="font-size:0.68em;padding:3px 7px;flex:0 0 auto;" onclick="openCutPlanModal(decodeURIComponent('${profileEncoded}'))">Agrandir</button>`}
                        </div>
	                        ${(isAccessoryGroup || isSheetGroup) ? '' : dimEditorHtml}
	                        ${(isAccessoryGroup || isSheetGroup) ? '' : `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
	                            <span style="font-size:0.68em;color:#aaa;min-width:86px;">Long. achat</span>
	                            <input id="${profileInputId}" type="number" min="100" max="600" step="10" inputmode="decimal" value="${Math.round(groupStockLengthCm)}" onchange="updateCutStockLengthForProfile(decodeURIComponent('${profileEncoded}'), this.value)" onkeydown="commitNumberInputOnEnter(event)" style="width:74px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.72em;">
	                            <span style="font-size:0.66em;color:#777;">cm</span>
	                        </div>`}
	                        ${(isAccessoryGroup || isSheetGroup) ? '' : `<div style="display:flex;align-items:center;gap:6px;margin-top:2px;">
	                            <span style="font-size:0.68em;color:#aaa;min-width:86px;">Stock réel</span>
	                            <input id="${profileInputId}-stock" type="text" value="${escapeHtmlForDoc(cutStockInventoryByProfile[group.profile] || '')}" placeholder="300x4, 240x2" onchange="updateCutStockInventoryForProfile(decodeURIComponent('${profileEncoded}'), this.value)" style="flex:1;min-width:110px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.72em;">
	                        </div>`}
	                        <div style="margin-top:2px;color:#ccc;line-height:1.2;">${groupSummary}</div>
	                        ${unableHtml}
	                        ${(isAccessoryGroup && !isSheetGroup) ? '' : `<div id="${profileInputId}-svgwrap" title="Cliquer pour agrandir" onclick="openCutPlanModal(decodeURIComponent('${profileEncoded}'))" style="margin-top:4px;padding:4px;background:#f5f5f5;border:1px solid #d0d0d0;border-radius:4px;overflow-x:auto;cursor:zoom-in;">
	                            ${barsSvg}
	                        </div>`}
	                    </div>
	                `;
	            });

	            html = `
	                <div style="padding:8px;border:1px solid #6a563a;background:#1d1710;border-radius:6px;color:#f4dec1;">
	                    <div style="font-size:1.14em;font-weight:900;">Débit atelier</div>
	                    <div style="margin-top:3px;color:#cdbb9f;">${groups.length} familles • ${totalBars.toLocaleString('fr-FR')} unités à acheter • chute ${formatCmForDoc(totalWaste)} cm • trait scie cumulé ${formatCmForDoc(totalSawLoss)} cm</div>
	                </div>
	            ` + html;

            wrap.innerHTML = html;
            renderLiveObjectIsoViews();
            renderLiveWeightSummary();
            renderWasteOptimizer();
            syncTechPlanModalContent();
        }

        function analyzeWasteOptimization(groups) {
            const WASTE_THRESHOLD = 0.20;
            const CANDIDATE_LENGTHS_CM = [200, 210, 220, 240, 250, 260, 270, 280, 300, 320, 340, 360, 380, 400, 420, 440, 450, 480, 500, 540, 600];
            const kerfCm = getSawKerfCm();
            const suggestions = [];

            groups.forEach(group => {
                if(!group.lengths || group.lengths.length === 0) return;
                if(group.meta && ['sheet', 'liter', 'box', 'item'].includes(group.meta.unitType)) return;

                const currentStockEntries = getStockEntriesForProfile(group.profile);
                const currentPlan = optimizeCutsFFD(group.lengths, currentStockEntries, kerfCm);
                const currentBars = currentPlan.bars || [];
                if(currentBars.length === 0) return;

                const currentTotalStock = currentBars.reduce((s, b) => s + b.stockLengthCm, 0);
                const currentWaste = currentBars.reduce((s, b) => s + b.remaining, 0);
                const currentWasteRatio = currentTotalStock > 0 ? currentWaste / currentTotalStock : 0;

                if(currentWasteRatio < WASTE_THRESHOLD) return;

                const maxPieceLen = Math.max(...group.lengths);
                let bestAlt = null;

                CANDIDATE_LENGTHS_CM.forEach(altLen => {
                    if(altLen < maxPieceLen) return;
                    const altPlan = optimizeCutsFFD(group.lengths, [{ lengthCm: altLen, qty: Infinity, label: `${altLen} cm` }], kerfCm);
                    const altBars = altPlan.bars || [];
                    if(altBars.length === 0) return;
                    const altTotalStock = altBars.reduce((s, b) => s + b.stockLengthCm, 0);
                    const altWaste = altBars.reduce((s, b) => s + b.remaining, 0);
                    const altWasteRatio = altTotalStock > 0 ? altWaste / altTotalStock : 0;
                    if(!bestAlt || altWasteRatio < bestAlt.wasteRatio) {
                        bestAlt = { stockLengthCm: altLen, barsCount: altBars.length, totalStockCm: altTotalStock, waste: altWaste, wasteRatio: altWasteRatio };
                    }
                });

                if(bestAlt && bestAlt.wasteRatio < currentWasteRatio - 0.05) {
                    suggestions.push({
                        profile: group.profile,
                        currentWasteRatio,
                        currentBars: currentBars.length,
                        currentTotalStockCm: currentTotalStock,
                        currentWasteCm: currentWaste,
                        best: bestAlt
                    });
                }
            });

            return suggestions.sort((a, b) => (b.currentWasteRatio - b.best.wasteRatio) - (a.currentWasteRatio - a.best.wasteRatio));
        }

        function renderWasteOptimizer() {
            const wrap = document.getElementById('waste-optimizer-live');
            if(!wrap) return;

            const groups = collectCutPiecesAllConstructions();
            const barGroups = groups.filter(g => g.lengths && g.lengths.length > 0 && !(g.meta && ['sheet', 'liter', 'box', 'item'].includes(g.meta.unitType)));
            if(!barGroups.length) { wrap.innerHTML = ''; return; }

            const kerfCm = getSawKerfCm();
            let hasHighWaste = false;
            const profileRows = barGroups.map(group => {
                const entries = getStockEntriesForProfile(group.profile);
                const plan = optimizeCutsFFD(group.lengths, entries, kerfCm);
                const bars = plan.bars || [];
                if(!bars.length) return null;
                const totalStock = bars.reduce((s, b) => s + b.stockLengthCm, 0);
                const waste = bars.reduce((s, b) => s + b.remaining, 0);
                const ratio = totalStock > 0 ? waste / totalStock : 0;
                if(ratio >= 0.20) hasHighWaste = true;
                return { group, bars, totalStock, waste, ratio };
            }).filter(Boolean);

            if(!hasHighWaste) { wrap.innerHTML = ''; return; }

            const suggestions = analyzeWasteOptimization(barGroups);

            let html = `<div class="dp-section" style="margin-top:4px;">Optimisateur de chutes</div>`;

            const wasteRows = profileRows.filter(r => r.ratio >= 0.20).map(r => {
                const pct = Math.round(r.ratio * 100);
                const profileDisplayName = String(r.group.profile || '').replace(/\s+\d+(?:[\.,]\d+)?\s*x\s*\d+(?:[\.,]\d+)?\s*cm$/i, '');
                const color = pct >= 35 ? '#ff9b85' : '#f5c842';
                return `<div style="display:flex;justify-content:space-between;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid #222;">
                    <span style="color:#ccc;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escapeHtmlForDoc(r.group.profile)}">${escapeHtmlForDoc(profileDisplayName)}</span>
                    <span style="color:${color};font-weight:700;white-space:nowrap;">${pct}% chute</span>
                    <span style="color:#777;white-space:nowrap;">${r.bars.length} barre(s) × ${formatCmForDoc(r.bars[0].stockLengthCm)} cm</span>
                </div>`;
            }).join('');

            html += `<div style="border:1px solid #5a3a1a;background:#1a1008;border-radius:6px;padding:6px;">
                <div style="color:#f5c842;font-weight:700;margin-bottom:4px;">Familles avec chute &gt; 20%</div>
                ${wasteRows}
            </div>`;

            if(suggestions.length > 0) {
                const suggHtml = suggestions.map(s => {
                    const profileEncoded = encodeURIComponent(s.profile);
                    const profileDisplayName = String(s.profile || '').replace(/\s+\d+(?:[\.,]\d+)?\s*x\s*\d+(?:[\.,]\d+)?\s*cm$/i, '');
                    const gainPts = Math.round((s.currentWasteRatio - s.best.wasteRatio) * 100);
                    const currentPct = Math.round(s.currentWasteRatio * 100);
                    const bestPct = Math.round(s.best.wasteRatio * 100);
                    const savedCm = Math.round((s.currentTotalStockCm - s.best.totalStockCm) * 10) / 10;
                    const savedLabel = savedCm > 0 ? ` • économie de ${formatCmForDoc(savedCm)} cm de stock` : '';
                    return `<div style="border:1px solid #2a4a2a;background:#101a10;border-radius:6px;padding:6px;margin-top:5px;">
                        <div style="color:#a8e0a8;font-weight:700;margin-bottom:3px;">${escapeHtmlForDoc(profileDisplayName)}</div>
                        <div style="color:#888;margin-bottom:4px;">Actuellement: <strong style="color:#f5c842;">${currentPct}%</strong> de chute avec barres de <strong style="color:#ddd;">${formatCmForDoc(s.currentBars > 0 ? getStockLengthForProfile(s.profile) : 0)} cm</strong> (${s.currentBars} barre${s.currentBars > 1 ? 's' : ''})</div>
                        <div style="color:#888;margin-bottom:6px;">Suggestion: barres de <strong style="color:#a8e0a8;">${formatCmForDoc(s.best.stockLengthCm)} cm</strong> → <strong style="color:#6ecf6e;">${bestPct}%</strong> de chute (${s.best.barsCount} barre${s.best.barsCount > 1 ? 's' : ''})${savedLabel}</div>
                        <div style="display:flex;align-items:center;gap:4px;">
                            <div style="flex:1;height:6px;background:#333;border-radius:3px;overflow:hidden;">
                                <div style="height:100%;display:flex;">
                                    <div style="width:${Math.round(s.best.wasteRatio * 100)}%;background:#6ecf6e;"></div>
                                    <div style="width:${gainPts}%;background:#2a7a2a;"></div>
                                    <div style="width:${100 - Math.round(s.currentWasteRatio * 100)}%;background:#1a3a1a;"></div>
                                </div>
                            </div>
                            <span style="color:#6ecf6e;font-weight:800;white-space:nowrap;">-${gainPts} pts</span>
                        </div>
                        <button class="jp-btn" style="margin-top:6px;font-size:0.72em;padding:3px 8px;background:#1a3a1a;border-color:#4a8a4a;color:#a8e0a8;" onclick="applyWasteOptimizerSuggestion(decodeURIComponent('${profileEncoded}'), ${s.best.stockLengthCm})">Appliquer ${formatCmForDoc(s.best.stockLengthCm)} cm</button>
                    </div>`;
                }).join('');
                html += `<div style="margin-top:5px;">
                    <div style="color:#6ecf6e;font-weight:700;margin-bottom:2px;">${suggestions.length} suggestion${suggestions.length > 1 ? 's' : ''} d'optimisation</div>
                    ${suggHtml}
                </div>`;
            } else {
                html += `<div style="margin-top:4px;color:#666;font-style:italic;font-size:0.9em;">Aucune longueur de stock standard ne réduit significativement ces chutes — vérifiez le stock réel ou les longueurs de pièces.</div>`;
            }

            wrap.innerHTML = html;
        }

        function applyWasteOptimizerSuggestion(profile, stockLengthCm) {
            cutStockLengthByProfile[profile] = Math.max(100, Math.min(600, stockLengthCm));
            cutStockInventoryByProfile[profile] = '';
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function getActualStockEntries(profile) {
            const raw = cutStockInventoryByProfile[profile] || '';
            if(!raw.trim()) return [];
            return parseStockInventory(raw, getStockLengthForProfile(profile)).filter(e => e.qty !== Infinity);
        }

        function serializeStockEntries(entries) {
            return entries.filter(e => e.qty > 0 && e.lengthCm > 0).map(e => `${Math.round(e.lengthCm)}x${e.qty}`).join(', ');
        }

        function addDefaultStockEntry(profileEncoded) {
            const profile = decodeURIComponent(profileEncoded);
            const entries = getActualStockEntries(profile);
            entries.push({ lengthCm: getStockLengthForProfile(profile), qty: 1 });
            cutStockInventoryByProfile[profile] = serializeStockEntries(entries);
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function updateStockEntryField(profileEncoded, idx, lenInputId, qtyInputId) {
            const profile = decodeURIComponent(profileEncoded);
            const entries = getActualStockEntries(profile);
            const lenEl = document.getElementById(lenInputId);
            const qtyEl = document.getElementById(qtyInputId);
            if(!lenEl || !qtyEl || !entries[idx]) return;
            const lenVal = Math.max(1, Math.min(1200, parseLocaleNumber(lenEl.value) || 300));
            const qtyVal = Math.max(1, Math.min(999, parseInt(qtyEl.value, 10) || 1));
            entries[idx] = { lengthCm: lenVal, qty: qtyVal };
            cutStockInventoryByProfile[profile] = serializeStockEntries(entries);
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function removeStockEntryByIndex(profileEncoded, idx) {
            const profile = decodeURIComponent(profileEncoded);
            const entries = getActualStockEntries(profile);
            entries.splice(idx, 1);
            cutStockInventoryByProfile[profile] = serializeStockEntries(entries);
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function clearProfileStock(profileEncoded) {
            const profile = decodeURIComponent(profileEncoded);
            delete cutStockInventoryByProfile[profile];
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function addFreeStockPiece() {
            workshopFreeStock.push({ id: Date.now() + Math.random(), lengthCm: 300, thicknessCm: 2, widthCm: 14, qty: 1 });
            hasUnsavedChanges = true;
            renderStockAtelierPanel();
        }

        function updateFreeStockPiece(id, field, value) {
            const piece = workshopFreeStock.find(p => p.id == id);
            if(!piece) return;
            const num = parseLocaleNumber(value);
            if(field === 'qty') piece.qty = Math.max(1, Math.min(999, parseInt(value, 10) || 1));
            else piece[field] = Math.max(0.1, Math.min(1200, num || 1));
            hasUnsavedChanges = true;
            renderStockAtelierPanel();
        }

        function removeFreeStockPiece(id) {
            workshopFreeStock = workshopFreeStock.filter(p => p.id != id);
            hasUnsavedChanges = true;
            renderStockAtelierPanel();
        }

        function assignFreeStockToProfile(id, profileEncoded) {
            const piece = workshopFreeStock.find(p => p.id == id);
            const profile = decodeURIComponent(profileEncoded);
            if(!piece) return;
            const entries = getActualStockEntries(profile);
            entries.push({ lengthCm: piece.lengthCm, qty: piece.qty });
            cutStockInventoryByProfile[profile] = serializeStockEntries(entries);
            workshopFreeStock = workshopFreeStock.filter(p => p.id != id);
            hasUnsavedChanges = true;
            refreshFabricationAndPricing();
        }

        function findCompatibleProfiles(piece, barGroups) {
            const TOLERANCE_CM = 0.1;
            return barGroups
                .filter(g => g.meta && g.meta.sectionAcm && g.meta.sectionBcm)
                .map(g => {
                    const reqA = g.meta.sectionAcm;
                    const reqB = g.meta.sectionBcm;
                    const directFit = piece.thicknessCm >= reqA - TOLERANCE_CM && piece.widthCm >= reqB - TOLERANCE_CM;
                    const rotatedFit = piece.thicknessCm >= reqB - TOLERANCE_CM && piece.widthCm >= reqA - TOLERANCE_CM;
                    if(!directFit && !rotatedFit) return null;
                    const useRotated = !directFit && rotatedFit;
                    const effA = useRotated ? reqB : reqA;
                    const effB = useRotated ? reqA : reqB;
                    const deltaA = Math.round((piece.thicknessCm - effA) * 10) / 10;
                    const deltaB = Math.round((piece.widthCm - effB) * 10) / 10;
                    const isExact = deltaA <= TOLERANCE_CM && deltaB <= TOLERANCE_CM;
                    const maxPieceLen = Math.max(...(g.lengths || [1]));
                    const fits = piece.lengthCm >= maxPieceLen;
                    return { group: g, isExact, deltaA, deltaB, useRotated, fits };
                })
                .filter(Boolean);
        }

        function renderStockAtelierPanel() {
            const wrap = document.getElementById('stock-atelier-panel');
            if(!wrap) return;

            const groups = collectCutPiecesAllConstructions();
            const barGroups = groups.filter(g => g.lengths && g.lengths.length > 0 && !(g.meta && ['sheet', 'liter', 'box', 'item'].includes(g.meta.unitType)));

            if(!barGroups.length) {
                wrap.innerHTML = '<div class="dp-help">Ajoutez des jardinières pour voir les profils disponibles.</div>';
                return;
            }

            const kerfCm = getSawKerfCm();

            let html = barGroups.map(group => {
                const profileEncoded = encodeURIComponent(group.profile);
                const profileId = getCutProfileId(group.profile);
                const profileDisplayName = String(group.profile || '').replace(/\s+\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*cm$/i, '');
                const sectionMatch = String(group.profile).match(/(\d+(?:[.,]\d+)?)\s*x\s*(\d+(?:[.,]\d+)?)\s*cm$/i);
                const sectionLabel = sectionMatch ? `${sectionMatch[1]}×${sectionMatch[2]} cm` : '';
                const entries = getActualStockEntries(group.profile);
                const needed = group.lengths.length;

                let coverageHtml = '';
                if(entries.length > 0) {
                    const stockPlan = optimizeCutsFFD(group.lengths, entries, kerfCm);
                    const notCovered = (stockPlan.unableToFit || []).map(p => p.lengthCm);
                    const covered = needed - notCovered.length;
                    if(notCovered.length === 0) {
                        const wastedCm = (stockPlan.bars || []).reduce((s, b) => s + b.remaining, 0);
                        coverageHtml = `<div style="background:#0f1f0f;border:1px solid #2a4a2a;border-radius:4px;padding:4px 6px;margin-top:5px;">
                            <span style="color:#6ecf6e;font-weight:700;">✓ Stock suffisant</span>
                            <span style="color:#888;"> — ${needed} pièce${needed > 1 ? 's' : ''} couvertes</span>
                            ${wastedCm > 0.5 ? `<span style="color:#555;"> · ${formatCmForDoc(wastedCm)} cm de chute restante</span>` : ''}
                        </div>`;
                    } else {
                        const purchasePlan = optimizeCutsFFD(notCovered, [{ lengthCm: getStockLengthForProfile(group.profile), qty: Infinity, label: 'achat' }], kerfCm);
                        const toBuyBars = (purchasePlan.bars || []).length;
                        const stockLen = getStockLengthForProfile(group.profile);
                        coverageHtml = `<div style="background:#1a1008;border:1px solid #4a3a1a;border-radius:4px;padding:4px 6px;margin-top:5px;">
                            <div style="color:#a8e0a8;">✓ ${covered} pièce${covered > 1 ? 's' : ''} depuis votre stock</div>
                            <div style="color:#f5c842;margin-top:1px;">+ ${toBuyBars} barre${toBuyBars > 1 ? 's' : ''} à acheter (${formatCmForDoc(stockLen)} cm) pour ${notCovered.length} pièce${notCovered.length > 1 ? 's' : ''} restante${notCovered.length > 1 ? 's' : ''}</div>
                        </div>`;
                    }
                } else {
                    coverageHtml = `<div style="color:#555;margin-top:3px;">${needed} pièce${needed > 1 ? 's' : ''} nécessaire${needed > 1 ? 's' : ''} — tout à acheter</div>`;
                }

                const entriesHtml = entries.map((entry, idx) => {
                    const lenId = `stock-len-${profileId}-${idx}`;
                    const qtyId = `stock-qty-${profileId}-${idx}`;
                    return `<div style="display:flex;align-items:center;gap:4px;margin-top:4px;">
                        <input id="${lenId}" type="number" min="1" max="1200" step="1" inputmode="decimal" value="${Math.round(entry.lengthCm)}"
                            onchange="updateStockEntryField(decodeURIComponent('${profileEncoded}'), ${idx}, '${lenId}', '${qtyId}')"
                            onkeydown="commitNumberInputOnEnter(event)"
                            style="width:58px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.82em;">
                        <span style="color:#555;font-size:0.85em;">cm ×</span>
                        <input id="${qtyId}" type="number" min="1" max="999" step="1" inputmode="numeric" value="${entry.qty}"
                            onchange="updateStockEntryField(decodeURIComponent('${profileEncoded}'), ${idx}, '${lenId}', '${qtyId}')"
                            onkeydown="commitNumberInputOnEnter(event)"
                            style="width:44px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.82em;">
                        <span style="color:#666;font-size:0.85em;">pce${entry.qty > 1 ? 's' : ''}</span>
                        <button class="jp-btn" style="font-size:0.7em;padding:2px 5px;margin-left:auto;color:#c77;border-color:#622;" onclick="removeStockEntryByIndex(decodeURIComponent('${profileEncoded}'), ${idx})">✕</button>
                    </div>`;
                }).join('');

                return `<div style="border:1px solid #2a2a2a;border-radius:6px;padding:6px;background:#111;">
                    <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:2px;">
                        <span style="color:#f0dcc1;font-weight:600;">${escapeHtmlForDoc(profileDisplayName)}</span>
                        ${sectionLabel ? `<span style="color:#666;font-size:0.9em;">${escapeHtmlForDoc(sectionLabel)}</span>` : ''}
                    </div>
                    ${entriesHtml}
                    <div style="margin-top:5px;display:flex;gap:4px;flex-wrap:wrap;">
                        <button class="jp-btn" style="font-size:0.72em;padding:2px 7px;" onclick="addDefaultStockEntry(decodeURIComponent('${profileEncoded}'))">+ Ajouter des pièces</button>
                        ${entries.length > 0 ? `<button class="jp-btn" style="font-size:0.72em;padding:2px 6px;color:#888;border-color:#333;" onclick="clearProfileStock(decodeURIComponent('${profileEncoded}'))">Vider</button>` : ''}
                    </div>
                    ${coverageHtml}
                </div>`;
            }).join('');

            // Section "Pièces de dimensions différentes"
            const freeHtml = workshopFreeStock.map(piece => {
                const safeId = String(piece.id).replace(/[^a-z0-9]/gi, '_');
                const compatible = findCompatibleProfiles(piece, barGroups);

                const compatHtml = compatible.length > 0
                    ? compatible.map(c => {
                        const profileEncoded = encodeURIComponent(c.group.profile);
                        const profileDisplayName = String(c.group.profile || '').replace(/\s+\d+(?:[.,]\d+)?\s*x\s*\d+(?:[.,]\d+)?\s*cm$/i, '');
                        let statusText = '';
                        if(c.isExact) {
                            statusText = `<span style="color:#6ecf6e;">dimensions exactes ✓</span>`;
                        } else {
                            const parts = [];
                            if(c.deltaA > 0.05) parts.push(`−${formatCmForDoc(c.deltaA * 10)} mm en épaisseur`);
                            if(c.deltaB > 0.05) parts.push(`−${formatCmForDoc(c.deltaB * 10)} mm en largeur`);
                            statusText = `<span style="color:#f5c842;">rabotage: ${parts.join(', ')}</span>`;
                        }
                        const lenNote = !c.fits ? `<span style="color:#f5c842;font-size:0.88em;"> · longueur limite, vérifiez le plan de coupe</span>` : '';
                        return `<div style="display:flex;align-items:center;gap:5px;margin-top:3px;flex-wrap:wrap;">
                            <span style="color:#ccc;">→ ${escapeHtmlForDoc(profileDisplayName)}</span>
                            ${statusText}${lenNote}
                            <button class="jp-btn" style="font-size:0.7em;padding:2px 6px;margin-left:auto;background:#1a2a1a;border-color:#3a6a3a;color:#a8e0a8;" onclick="assignFreeStockToProfile(${piece.id}, decodeURIComponent('${profileEncoded}'))">Utiliser ici</button>
                        </div>`;
                    }).join('')
                    : `<div style="color:#555;margin-top:3px;font-style:italic;">Aucun profil compatible dans la fabrication actuelle</div>`;

                const inputStyle = 'width:52px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.82em;';
                return `<div style="border:1px solid #2a3a2a;border-radius:6px;padding:6px;background:#0e140e;">
                    <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;">
                        <input type="number" min="1" max="1200" step="1" inputmode="decimal" value="${Math.round(piece.lengthCm)}"
                            onchange="updateFreeStockPiece(${piece.id}, 'lengthCm', this.value)" onkeydown="commitNumberInputOnEnter(event)" style="${inputStyle}">
                        <span style="color:#555;font-size:0.85em;">cm ×</span>
                        <input type="number" min="0.1" max="50" step="0.1" inputmode="decimal" value="${piece.thicknessCm}"
                            onchange="updateFreeStockPiece(${piece.id}, 'thicknessCm', this.value)" onkeydown="commitNumberInputOnEnter(event)" style="${inputStyle}">
                        <span style="color:#555;font-size:0.85em;">×</span>
                        <input type="number" min="0.1" max="50" step="0.1" inputmode="decimal" value="${piece.widthCm}"
                            onchange="updateFreeStockPiece(${piece.id}, 'widthCm', this.value)" onkeydown="commitNumberInputOnEnter(event)" style="${inputStyle}">
                        <span style="color:#555;font-size:0.85em;">cm ×</span>
                        <input type="number" min="1" max="999" step="1" inputmode="numeric" value="${piece.qty}"
                            onchange="updateFreeStockPiece(${piece.id}, 'qty', this.value)" onkeydown="commitNumberInputOnEnter(event)" style="width:40px;background:#111;color:#ddd;border:1px solid #444;border-radius:3px;padding:2px 4px;font-size:0.82em;">
                        <span style="color:#666;font-size:0.85em;">pce${piece.qty > 1 ? 's' : ''}</span>
                        <button class="jp-btn" style="font-size:0.7em;padding:2px 5px;margin-left:auto;color:#c77;border-color:#622;" onclick="removeFreeStockPiece(${piece.id})">✕</button>
                    </div>
                    ${compatHtml}
                </div>`;
            }).join('');

            html += `<div style="border:1px solid #1e2e1e;border-radius:6px;padding:6px;margin-top:2px;background:#0a120a;">
                <div style="color:#8ecf8e;font-weight:600;margin-bottom:4px;">Pièces de dimensions différentes</div>
                <div style="color:#555;font-size:0.9em;margin-bottom:5px;">Longueur × épaisseur × largeur · le système cherche les profils compatibles</div>
                ${freeHtml || '<div style="color:#444;font-style:italic;">Aucune pièce libre saisie</div>'}
                <button class="jp-btn" style="font-size:0.72em;padding:2px 7px;margin-top:5px;" onclick="addFreeStockPiece()">+ Ajouter une pièce</button>
            </div>`;

            wrap.innerHTML = html;
        }

        function renderLivePricingSummary() {
            const form = ensureDevisFormReady();
            const wrap = document.getElementById('pricing-live');
            if(!form || !wrap) return;

            const materials = getChantierMaterialsFromDevis();
            if(materials.length === 0) {
                wrap.innerHTML = '<div class="dp-help">Aucune matière à chiffrer. Ajoutez au moins un objet.</div>';
                renderDevisSpreadsheetModalContent(materials, 0);
                return;
            }

            const totalPrice = materials.reduce((sum, row) => sum + (row.totalPrice || 0), 0);
            wrap.innerHTML = buildDevisSpreadsheetHtml(materials, totalPrice);
            renderDevisSpreadsheetModalContent(materials, totalPrice);
        }

        function buildDevisSpreadsheetHtml(materials, totalPrice = null) {
            const safeTotal = totalPrice !== null ? totalPrice : materials.reduce((sum, row) => sum + (row.totalPrice || 0), 0);
            const rows = materials.map(row => {
                const profileEncoded = encodeURIComponent(row.profile);
                const qtyLabel = row.isScrewGroup
                    ? `${row.barsCount} boîte(s) de ${row.packSize}`
                    : `${row.barsCount.toLocaleString('fr-FR')} ${row.unitLabel}`;
                const unitPriceLabel = row.isScrewGroup
                    ? '€/boîte'
                    : (row.isItemGroup ? '€/pièce' : (row.isLiterGroup ? '€/L' : (row.isSheetGroup ? '€/m²' : '€/barre')));
                return `
                    <tr>
                        <td class="devis-sheet-text">${escapeHtmlForDoc(row.profile)}</td>
                        <td class="devis-sheet-detail">${escapeHtmlForDoc(row.label || '')}</td>
                        <td class="devis-sheet-number">${qtyLabel}</td>
                        <td class="devis-sheet-unit">${unitPriceLabel}</td>
                        <td class="devis-sheet-price">
                            <input type="number" min="0" max="9999" step="0.5" inputmode="decimal" value="${row.unitPrice}" onchange="updateDevisUnitPriceForProfile(decodeURIComponent('${profileEncoded}'), this.value)" aria-label="Prix unitaire ${escapeHtmlForDoc(row.profile)}">
                        </td>
                        <td class="devis-sheet-total">${formatEuro(row.totalPrice)}</td>
                    </tr>
                `;
            }).join('');

            return `
                <div class="devis-sheet-summary">
                    <span>${materials.length} lignes</span>
                    <strong>${formatEuro(safeTotal)}</strong>
                </div>
                <div class="devis-sheet-wrap">
                    <table class="devis-sheet">
                        <thead>
                            <tr>
                                <th>Matière</th>
                                <th>Détail</th>
                                <th>Quantité</th>
                                <th>Unité</th>
                                <th>PU</th>
                                <th>Total</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                        <tfoot>
                            <tr>
                                <td colspan="5">Total matière</td>
                                <td>${formatEuro(safeTotal)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            `;
        }

        function ensureDevisSpreadsheetModal() {
            let modal = document.getElementById('devis-spreadsheet-modal');
            if(modal) return modal;
            modal = document.createElement('div');
            modal.id = 'devis-spreadsheet-modal';
            modal.className = 'devis-spreadsheet-modal';
            modal.innerHTML = `
                <div class="devis-spreadsheet-content">
                    <div class="devis-spreadsheet-header">
                        <div class="devis-spreadsheet-title">Chiffrage</div>
                        <div class="devis-spreadsheet-actions">
                            <button class="jp-btn btn-with-icon" type="button" onclick="generateDevisPDF()"><span class="icon-wire" aria-hidden="true"><svg viewBox="0 0 24 24" role="img" focusable="false"><path d="M6 3.5h9l3 3V20.5H6z"></path><path d="M15 3.5v3h3M8.5 14h7M8.5 17h7"></path></svg></span><span>PDF</span></button>
                            <button class="jp-btn btn-with-icon" type="button" onclick="closeDevisSpreadsheetModal()"><span class="icon-wire" aria-hidden="true"><svg viewBox="0 0 24 24" role="img" focusable="false"><path d="M6 6l12 12M18 6L6 18"></path></svg></span><span>Fermer</span></button>
                        </div>
                    </div>
                    <div id="devis-spreadsheet-body" class="devis-spreadsheet-body"></div>
                </div>
            `;
            document.body.appendChild(modal);
            return modal;
        }

        function renderDevisSpreadsheetModalContent(materials = null, totalPrice = null) {
            const modal = document.getElementById('devis-spreadsheet-modal');
            if(!modal || modal.style.display !== 'flex') return;
            const body = document.getElementById('devis-spreadsheet-body');
            if(!body) return;
            const previousWrap = body.querySelector('.devis-sheet-wrap');
            const scrollState = {
                bodyTop: body.scrollTop,
                bodyLeft: body.scrollLeft,
                wrapTop: previousWrap ? previousWrap.scrollTop : 0,
                wrapLeft: previousWrap ? previousWrap.scrollLeft : 0
            };
            const rows = materials || getChantierMaterialsFromDevis();
            if(rows.length === 0) {
                body.innerHTML = '<div class="dp-help">Aucune matière à chiffrer. Ajoutez au moins un objet.</div>';
                return;
            }
            body.innerHTML = buildDevisSpreadsheetHtml(rows, totalPrice);
            body.scrollTop = scrollState.bodyTop;
            body.scrollLeft = scrollState.bodyLeft;
            const nextWrap = body.querySelector('.devis-sheet-wrap');
            if(nextWrap) {
                nextWrap.scrollTop = scrollState.wrapTop;
                nextWrap.scrollLeft = scrollState.wrapLeft;
            }
        }

        function openDevisSpreadsheetModal() {
            const modal = ensureDevisSpreadsheetModal();
            modal.style.display = 'flex';
            renderDevisSpreadsheetModalContent();
        }

        function closeDevisSpreadsheetModal() {
            const modal = document.getElementById('devis-spreadsheet-modal');
            if(modal) modal.style.display = 'none';
        }

        function refreshFabricationAndPricing() {
            renderStockAtelierPanel();
            renderLiveCutPlan();
            renderLivePricingSummary();
        }

	        function updateCutStockLengthForProfile(profile, value) {
	            cutStockLengthByProfile[profile] = Math.max(100, Math.min(600, parseLocaleNumber(value) || 300));
	            hasUnsavedChanges = true;
	            refreshFabricationAndPricing();
	        }

	        function updateCutStockInventoryForProfile(profile, value) {
	            cutStockInventoryByProfile[profile] = String(value || '').trim();
	            hasUnsavedChanges = true;
	            refreshFabricationAndPricing();
	        }

	        function updateCutSawKerf(value) {
	            cutSawKerfMm = Math.max(0, Math.min(20, parseLocaleNumber(value) || 0));
	            hasUnsavedChanges = true;
	            refreshFabricationAndPricing();
	        }

	        function updateDevisUnitPriceForProfile(profile, value) {
	            devisUnitPriceByProfile[profile] = Math.max(0, Math.min(9999, parseLocaleNumber(value) || 0));
	            hasUnsavedChanges = true;
	            refreshFabricationAndPricing();
	        }

        function updateFamilySectionDimensions(familyKey, sectionACmInput, sectionBCmInput) {
            if(!familyKey) return;

            const safeAcm = Math.max(0.3, Math.min(35, parseLocaleNumber(sectionACmInput) || 2));
            const safeBcm = Math.max(0.3, Math.min(35, parseLocaleNumber(sectionBCmInput) || 2));
            const safeAdm = roundToTwoDecimals(safeAcm / 10);
            const safeBdm = roundToTwoDecimals(safeBcm / 10);
            let hasChange = false;

            if(familyKey === 'treillisPosts') {
                const currA = treillisDimensionOverrides.postW === null ? 0.24 : treillisDimensionOverrides.postW;
                const currB = treillisDimensionOverrides.postD === null ? 0.24 : treillisDimensionOverrides.postD;
                hasChange = Math.abs(currA - safeAdm) > 0.0001 || Math.abs(currB - safeBdm) > 0.0001;
            } else if(familyKey === 'treillisRails') {
                const currA = treillisDimensionOverrides.railW === null ? 0.1 : treillisDimensionOverrides.railW;
                const currB = treillisDimensionOverrides.railH === null ? 0.1 : treillisDimensionOverrides.railH;
                hasChange = Math.abs(currA - safeAdm) > 0.0001 || Math.abs(currB - safeBdm) > 0.0001;
            } else {
                jardinières.forEach(j => {
                    const c = ensureJardConstructionSettings(j);
                    if(familyKey === 'cuveBoards' && (Math.abs(c.boardThickness - safeAdm) > 0.0001 || Math.abs(c.boardWidth - safeBdm) > 0.0001)) hasChange = true;
                    if(familyKey === 'lambourdes' && (Math.abs(c.lambourdeLong - safeAdm) > 0.0001 || Math.abs(c.lambourdeWide - safeBdm) > 0.0001)) hasChange = true;
                    if(familyKey === 'floorBattens' && (Math.abs(c.floorBattenHeight - safeAdm) > 0.0001 || Math.abs(c.floorBattenWidth - safeBdm) > 0.0001)) hasChange = true;
                });
            }
            if(!hasChange) return;

            saveState();
            jardinières.forEach(j => {
                const c = ensureJardConstructionSettings(j);
                if(familyKey === 'cuveBoards') {
                    c.boardThickness = safeAdm;
                    c.boardWidth = safeBdm;
                    c.cuveTargetH = snapCuveTargetHeight(c, c.cuveTargetH || c.boardWidth);
                    const metrics = computeJardiniereConstructionMetrics(j);
                    const minTopH = Math.max(metrics.cuveH, c.cuveTargetH);
                    const currentTopH = j.legH + metrics.cuveH;
                    if(currentTopH < minTopH) {
                        j.legH = Math.min(12, Math.max(0, minTopH - metrics.cuveH));
                    }
                } else if(familyKey === 'lambourdes') {
                    c.lambourdeLong = safeAdm;
                    c.lambourdeWide = safeBdm;
                } else if(familyKey === 'floorBattens') {
                    c.floorBattenHeight = safeAdm;
                    c.floorBattenWidth = safeBdm;
                }
            });

            if(familyKey === 'treillisPosts') {
                treillisDimensionOverrides.postW = safeAdm;
                treillisDimensionOverrides.postD = safeBdm;
            }
            if(familyKey === 'treillisRails') {
                treillisDimensionOverrides.railW = safeAdm;
                treillisDimensionOverrides.railH = safeBdm;
            }

            jardinières.forEach(j => rebuildJardiniere(j));
            updateJardPanel();
            draw2D();
        }

        function dmToMm(valueDm) {
            return Math.round((Number(valueDm) || 0) * 100);
        }

        function getHoleDiaMm(hole) {
            if(!hole) return 4;
            if(Number.isFinite(hole.diaMm)) return hole.diaMm;
            if(Number.isFinite(hole.dia)) return dmToMm(hole.dia);
            return 4;
        }

        function getJardFabricationModel(j) {
            if(!j) return { pieces: [], screws: [] };
            const metrics = computeJardiniereConstructionMetrics(j);
            if(!j.fabricationModel || !Array.isArray(j.fabricationModel.pieces)) {
                j.fabricationModel = buildJardiniereFabricationModel(j, metrics);
            }
            return j.fabricationModel;
        }

        function updateChantierTechTarget(value) {
            chantierTechSelectedJardId = value || 'auto';
            chantierTechSelectedTypeKey = null;
            renderLiveTechnicalPlans();
        }

        function updateChantierTechType(value) {
            chantierTechSelectedTypeKey = value || null;
            renderLiveTechnicalPlans();
        }

        function getChantierTargetJardiniere() {
            if(!Array.isArray(jardinières) || jardinières.length === 0) return null;
            if(chantierTechSelectedJardId && chantierTechSelectedJardId !== 'auto') {
                const found = jardinières.find(j => j.id === chantierTechSelectedJardId);
                if(found) return found;
            }
            return selected2dJardiniere || jardinières[0] || null;
        }

        function getProjectedPieceLengthDm(piece) {
            if(!piece || !piece.dim) return 0.01;
            return Math.abs(piece.rotY || 0) > 0.01 ? (piece.dim.T || piece.dim.W || 0.01) : (piece.dim.L || 0.01);
        }

        function buildChantierAssemblySvg(j, model) {
            const pieces = Array.isArray(model && model.pieces) ? model.pieces : [];
            if(!j || pieces.length === 0) {
                return '<div class="dp-help" style="padding:8px;">Aucune pièce à afficher.</div>';
            }

            let minX = Infinity;
            let maxX = -Infinity;
            let minY = Infinity;
            let maxY = -Infinity;
            pieces.forEach(piece => {
                const projL = getProjectedPieceLengthDm(piece);
                const h = piece.dim && piece.dim.H ? piece.dim.H : 0.01;
                minX = Math.min(minX, piece.pos.x - projL / 2);
                maxX = Math.max(maxX, piece.pos.x + projL / 2);
                minY = Math.min(minY, piece.pos.y - h / 2);
                maxY = Math.max(maxY, piece.pos.y + h / 2);
            });

            const spanX = Math.max(0.1, maxX - minX);
            const spanY = Math.max(0.1, maxY - minY);
            const aspect = spanX / spanY;
            let vbW = 1000;
            let vbH = 560;
            if(aspect < 0.7) {
                vbW = 840;
                vbH = 820;
            } else if(aspect < 1.2) {
                vbW = 920;
                vbH = 700;
            }
            const margin = 54;
            const scale = Math.min((vbW - 2 * margin) / spanX, (vbH - 2 * margin) / spanY);
            const drawW = spanX * scale;
            const drawH = spanY * scale;
            const x0 = (vbW - drawW) / 2;
            const y0 = (vbH - drawH) / 2;

            function toSvgX(xDm) {
                return x0 + (xDm - minX) * scale;
            }

            function toSvgY(yDm) {
                return y0 + drawH - (yDm - minY) * scale;
            }

            function pieceStyle(piece) {
                const isRotated = Math.abs(piece.rotY || 0) > 0.01;
                if(piece.family === 'Lambourde') return { fill: 'rgba(121,92,66,0.24)', stroke: '#72563f', sw: 1.2 };
                if(piece.family === 'TreillisPost') return { fill: 'rgba(96,128,138,0.20)', stroke: '#567a85', sw: 1.1 };
                if(piece.family === 'TreillisRail') return { fill: 'rgba(125,156,168,0.18)', stroke: '#6f92a0', sw: 1.0 };
                if(piece.family === 'Tasseau') return { fill: 'rgba(146,107,73,0.22)', stroke: '#815d3f', sw: 1.0 };
                if(piece.family === 'LatteFond') return { fill: 'rgba(163,119,80,0.16)', stroke: '#8d6647', sw: 1.0 };
                if(piece.family === 'Planche' && isRotated) return { fill: 'rgba(164,122,84,0.15)', stroke: '#946f4d', sw: 0.9 };
                return { fill: piece.pos.z > 0 ? 'rgba(182,115,68,0.28)' : 'rgba(182,115,68,0.10)', stroke: piece.pos.z > 0 ? '#7e5233' : '#a48362', sw: piece.pos.z > 0 ? 1.2 : 0.8 };
            }

            const sorted = [...pieces].sort((a, b) => a.pos.z - b.pos.z);
            let pieceMarkup = '';
            let holeIndex = 0;

            sorted.forEach(piece => {
                const projL = getProjectedPieceLengthDm(piece);
                const h = piece.dim && piece.dim.H ? piece.dim.H : 0.01;
                const left = toSvgX(piece.pos.x - projL / 2);
                const top = toSvgY(piece.pos.y + h / 2);
                const svgW = Math.max(1, projL * scale);
                const svgH = Math.max(1, h * scale);
                const style = pieceStyle(piece);
                pieceMarkup += `<rect x="${left.toFixed(1)}" y="${top.toFixed(1)}" width="${svgW.toFixed(1)}" height="${svgH.toFixed(1)}" fill="${style.fill}" stroke="${style.stroke}" stroke-width="${style.sw}"/>`;

                const visibleFaceBoard = piece.family === 'Planche' && Math.abs(piece.rotY || 0) < 0.01 && piece.pos.z > 0;
                if(visibleFaceBoard && Array.isArray(piece.holes2d)) {
                    piece.holes2d.forEach(hole => {
                        const wx = piece.pos.x - piece.dim.L / 2 + (hole.x || 0);
                        const wy = piece.pos.y - piece.dim.H / 2 + (hole.y || 0);
                        const cx = toSvgX(wx);
                        const cy = toSvgY(wy);
                        const holeDiaDm = Math.max(0.01, getHoleDiaMm(hole) / 100);
                        const r = Math.max(1.8, holeDiaDm * 0.5 * scale);
                        holeIndex++;
                        pieceMarkup += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="#eef6fa" stroke="#2d5c6d" stroke-width="1.2"/>`;
                        pieceMarkup += `<text x="${(cx + r + 2).toFixed(1)}" y="${(cy - 3).toFixed(1)}" font-size="9" fill="#2d5c6d">${holeIndex}</text>`;
                    });
                }
            });

            return `<svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block;height:auto;" xmlns="http://www.w3.org/2000/svg"><rect x="10" y="10" width="${vbW - 20}" height="${vbH - 20}" rx="10" fill="#fffefc" stroke="#d8cab8"/><text x="28" y="36" font-size="18" fill="#2f261d">Plan d'ensemble - Jardinière ${escapeHtmlForDoc(String(jardinières.indexOf(j) + 1))}</text>${pieceMarkup}<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${drawW.toFixed(1)}" height="${drawH.toFixed(1)}" fill="none" stroke="#3f3227" stroke-width="1.6"/></svg>`;
        }

        function chantierPieceTypeKey(piece) {
            const holesKey = (Array.isArray(piece.holes2d) ? piece.holes2d : [])
                .map(h => `${dmToMm(h.x || 0)}_${dmToMm(h.y || 0)}_${Math.round(getHoleDiaMm(h))}`)
                .join('|');
            return [piece.family, dmToMm(piece.dim.L), dmToMm(piece.dim.H), dmToMm(piece.dim.T), holesKey].join('__');
        }

        function computeChantierPieceTypes(pieces) {
            const map = new Map();
            (pieces || []).forEach(piece => {
                const key = chantierPieceTypeKey(piece);
                if(!map.has(key)) {
                    map.set(key, {
                        key,
                        representative: piece,
                        count: 0,
                        ids: [],
                        baseLabel: piece.label.replace(/\s+R?\d+$/, '')
                    });
                }
                const entry = map.get(key);
                entry.count += 1;
                entry.ids.push(piece.id);
            });

            return Array.from(map.values()).map(entry => ({
                ...entry,
                displayLabel: `${entry.baseLabel} (x${entry.count}) - ${dmToMm(entry.representative.dim.L)} x ${dmToMm(entry.representative.dim.H)} x ${dmToMm(entry.representative.dim.T)} mm`
            }));
        }

        function getWorkshopFinishNote(piece) {
            if(!piece) return 'A confirmer';
            if(piece.family === 'LatteFond') return 'Non visible: protection simple';
            if(piece.family === 'Tasseau') return 'Non visible: protection simple';
            if(piece.family === 'Planche') return 'Visible: face extérieure à peindre/protéger, face intérieure protégée par bâche';
            if(piece.family === 'Lambourde') return 'Visible partiellement: pieds à peindre/protéger';
            if(piece.family === 'TreillisPost' || piece.family === 'TreillisRail') return 'Visible: treillis à peindre/protéger';
            if(piece.family === 'Tissu') return 'Textile extérieur: housse déperlante, mousse à protéger de l’eau stagnante';
            return 'Finition selon pose';
        }

        function buildChantierPieceSvg(typeGroup) {
            if(!typeGroup) return '<div class="dp-help" style="padding:8px;">Aucun type sélectionné.</div>';
            const piece = typeGroup.representative;
            const finishNote = getWorkshopFinishNote(piece);
            const vbW = 980;
            const vbH = 560;
            const faceArea = { x: 28, y: 90, w: 620, h: 430 };
            const secArea = { x: 670, y: 128, w: 282, h: 360 };

            const faceScale = Math.min((faceArea.w - 40) / Math.max(0.1, piece.dim.L), (faceArea.h - 40) / Math.max(0.1, piece.dim.H));
            const faceW = piece.dim.L * faceScale;
            const faceH = piece.dim.H * faceScale;
            const faceX = faceArea.x + (faceArea.w - faceW) / 2;
            const faceY = faceArea.y + (faceArea.h - faceH) / 2;

            const secScale = Math.min((secArea.w - 50) / Math.max(0.08, piece.dim.T), (secArea.h - 50) / Math.max(0.1, piece.dim.H));
            const secW = Math.max(2, piece.dim.T * secScale);
            const secH = piece.dim.H * secScale;
            const secX = secArea.x + (secArea.w - secW) / 2;
            const secY = secArea.y + (secArea.h - secH) / 2;

            function clamp(v, min, max) {
                return Math.max(min, Math.min(max, v));
            }

            function textWithHalo(x, y, text, anchor = 'middle', size = 10, color = '#1d1d1d') {
                return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}" font-size="${size}" fill="${color}">${escapeHtmlForDoc(text)}</text>`;
            }

            function verticalDimText(x, y, text, size = 10, color = '#1d1d1d') {
                return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="${size}" fill="${color}" transform="rotate(-90 ${x.toFixed(1)} ${y.toFixed(1)})">${escapeHtmlForDoc(text)}</text>`;
            }

            const dimColor = '#202020';
            const extColor = '#6f6f6f';

            const holesMarkup = (piece.holes2d || []).map((hole, idx) => {
                const x = faceX + (hole.x || 0) * faceScale;
                const y = faceY + faceH - (hole.y || 0) * faceScale;
                const r = Math.max(1.8, (getHoleDiaMm(hole) / 100) * 0.5 * faceScale);
                return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="none" stroke="#1c1c1c" stroke-width="1.2"/><line x1="${(x - r - 10).toFixed(1)}" y1="${y.toFixed(1)}" x2="${(x + r + 10).toFixed(1)}" y2="${y.toFixed(1)}" stroke="#7a7a7a" stroke-width="0.85"/><line x1="${x.toFixed(1)}" y1="${(y - r - 10).toFixed(1)}" x2="${x.toFixed(1)}" y2="${(y + r + 10).toFixed(1)}" stroke="#7a7a7a" stroke-width="0.85"/>`;
            }).join('');

            const holes = piece.holes2d || [];
            const refHole = holes.length
                ? [...holes].sort((a, b) => {
                    const scoreA = (a.x || 0) + (a.y || 0);
                    const scoreB = (b.x || 0) + (b.y || 0);
                    if(Math.abs(scoreA - scoreB) > 1e-9) return scoreA - scoreB;
                    if(Math.abs((a.x || 0) - (b.x || 0)) > 1e-9) return (a.x || 0) - (b.x || 0);
                    return (a.y || 0) - (b.y || 0);
                })[0]
                : null;

            const frameLeft = faceArea.x + 8;
            const frameRight = faceArea.x + faceArea.w - 8;
            const frameTop = faceArea.y + 12;
            const frameBottom = faceArea.y + faceArea.h - 10;

            const dimLX1 = faceX;
            const dimLX2 = faceX + faceW;
            const dimLY = clamp(faceY + faceH + 20, frameTop + 18, frameBottom - 18);
            const dimLTextY = clamp(dimLY - 4, frameTop + 12, frameBottom - 6);

            const dimHX = clamp(faceX - 22, frameLeft + 6, frameRight - 6);
            const dimHY1 = faceY;
            const dimHY2 = faceY + faceH;
            const dimHTextX = clamp(dimHX - 18, frameLeft + 10, frameRight - 12);
            const dimHTextY = clamp((dimHY1 + dimHY2) / 2, frameTop + 16, frameBottom - 16);

            let holeDimMarkup = '';
            if(refHole) {
                const hx = faceX + (refHole.x || 0) * faceScale;
                const hy = faceY + faceH - (refHole.y || 0) * faceScale;
                const xRefY = clamp(dimLY + 38, frameTop + 34, frameBottom - 12);
                const xLabelX = clamp((faceX + hx) / 2, frameLeft + 56, frameRight - 56);
                const xLabelY = clamp(xRefY - 4, frameTop + 12, frameBottom - 6);

                const preferredLeftYDimX = faceX - 34;
                let yDimX = preferredLeftYDimX;
                if(yDimX < frameLeft + 12) {
                    // Si manque de place à gauche, rester proche de la face gauche au lieu d'aller à droite.
                    yDimX = clamp(faceX + 18, frameLeft + 12, faceX + Math.min(faceW * 0.22, 120));
                }
                const yLabelX = clamp(yDimX - 9, frameLeft + 16, frameRight - 16);
                const yLabelY = clamp((hy + (faceY + faceH)) / 2, frameTop + 12, frameBottom - 10);

                holeDimMarkup = `
                    <line x1="${faceX.toFixed(1)}" y1="${(faceY + faceH).toFixed(1)}" x2="${faceX.toFixed(1)}" y2="${xRefY.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                    <line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${xRefY.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                    <line x1="${faceX.toFixed(1)}" y1="${xRefY.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${xRefY.toFixed(1)}" stroke="${dimColor}" stroke-width="0.95" marker-start="url(#a3e)" marker-end="url(#a3s)"/>
                    ${textWithHalo(xLabelX, xLabelY, `${dmToMm(refHole.x || 0)} mm`, 'middle', 10)}

                    <line x1="${hx.toFixed(1)}" y1="${(faceY + faceH).toFixed(1)}" x2="${yDimX.toFixed(1)}" y2="${(faceY + faceH).toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                    <line x1="${hx.toFixed(1)}" y1="${hy.toFixed(1)}" x2="${yDimX.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                    <line x1="${yDimX.toFixed(1)}" y1="${(faceY + faceH).toFixed(1)}" x2="${yDimX.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="${dimColor}" stroke-width="0.95" marker-start="url(#a3e)" marker-end="url(#a3s)"/>
                    ${verticalDimText(yLabelX, yLabelY, `${dmToMm(refHole.y || 0)} mm`, 10)}
                `;
            }

            const dimMarkup = `
                <line x1="${dimLX1.toFixed(1)}" y1="${(faceY + faceH).toFixed(1)}" x2="${dimLX1.toFixed(1)}" y2="${dimLY.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${dimLX2.toFixed(1)}" y1="${(faceY + faceH).toFixed(1)}" x2="${dimLX2.toFixed(1)}" y2="${dimLY.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${dimLX1.toFixed(1)}" y1="${dimLY.toFixed(1)}" x2="${dimLX2.toFixed(1)}" y2="${dimLY.toFixed(1)}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a3e)" marker-end="url(#a3s)"/>
                ${textWithHalo((dimLX1 + dimLX2) / 2, dimLTextY, `${dmToMm(piece.dim.L)} mm`, 'middle', 12, dimColor)}

                <line x1="${faceX.toFixed(1)}" y1="${dimHY1.toFixed(1)}" x2="${dimHX.toFixed(1)}" y2="${dimHY1.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${faceX.toFixed(1)}" y1="${dimHY2.toFixed(1)}" x2="${dimHX.toFixed(1)}" y2="${dimHY2.toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${dimHX.toFixed(1)}" y1="${dimHY1.toFixed(1)}" x2="${dimHX.toFixed(1)}" y2="${dimHY2.toFixed(1)}" stroke="${dimColor}" stroke-width="1" marker-start="url(#a3e)" marker-end="url(#a3s)"/>
                ${verticalDimText(dimHTextX, dimHTextY, `${dmToMm(piece.dim.H)} mm`, 12, dimColor)}

                <line x1="${secX.toFixed(1)}" y1="${(secY + secH).toFixed(1)}" x2="${secX.toFixed(1)}" y2="${(secY + secH + 18).toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${(secX + secW).toFixed(1)}" y1="${(secY + secH).toFixed(1)}" x2="${(secX + secW).toFixed(1)}" y2="${(secY + secH + 18).toFixed(1)}" stroke="${extColor}" stroke-width="0.85" stroke-dasharray="3 2"/>
                <line x1="${secX.toFixed(1)}" y1="${(secY + secH + 18).toFixed(1)}" x2="${(secX + secW).toFixed(1)}" y2="${(secY + secH + 18).toFixed(1)}" stroke="${dimColor}" stroke-width="0.95" marker-start="url(#a3e)" marker-end="url(#a3s)"/>
                ${textWithHalo(secX + secW / 2, secY + secH + 34, `${dmToMm(piece.dim.T)} mm`, 'middle', 11, dimColor)}
            `;

            let holeDiaCallout = '';
            if(holes.length > 0) {
                const firstHole = [...holes].sort((a, b) => (a.x || 0) - (b.x || 0) || (b.y || 0) - (a.y || 0))[0];
                const callX = faceX + (firstHole.x || 0) * faceScale;
                const callY = faceY + faceH - (firstHole.y || 0) * faceScale;
                const diaValues = Array.from(new Set(holes.map(h => Math.round(getHoleDiaMm(h)))));
                const diaText = diaValues.length === 1
                    ? `${holes.length}X Ø ${diaValues[0]} THRU`
                    : `${holes.length}X Ø variable THRU`;
                const textX = clamp(faceX + faceW * 0.35, faceArea.x + 70, faceArea.x + faceArea.w - 120);
                const textY = clamp(faceY - 20, 28, faceY + 10);
                holeDiaCallout = `
                    <line x1="${textX.toFixed(1)}" y1="${(textY + 4).toFixed(1)}" x2="${(callX + 4).toFixed(1)}" y2="${(callY - 4).toFixed(1)}" stroke="#3e3e3e" stroke-width="0.95"/>
                    ${textWithHalo(textX, textY, diaText, 'start', 10, '#111')}
                `;
            }

            return `<svg viewBox="0 0 ${vbW} ${vbH}" width="100%" style="display:block;height:auto;" xmlns="http://www.w3.org/2000/svg"><defs><marker id="a3s" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="5.3" refY="3" orient="auto"><path d="M0,0.6 L5.3,3 L0,5.4 z" fill="${dimColor}"></path></marker><marker id="a3e" markerUnits="userSpaceOnUse" markerWidth="6" markerHeight="6" refX="0" refY="3" orient="auto"><path d="M5.3,0.6 L0,3 L5.3,5.4 z" fill="${dimColor}"></path></marker></defs><rect x="10" y="10" width="${vbW - 20}" height="${vbH - 20}" rx="3" fill="#fbfbfb" stroke="#c8c8c8"/><text x="28" y="36" font-size="18" fill="#1b1b1b">Plan type - ${escapeHtmlForDoc(typeGroup.baseLabel)}</text><text x="28" y="56" font-size="12" fill="#333">${dmToMm(piece.dim.L)} x ${dmToMm(piece.dim.H)} x ${dmToMm(piece.dim.T)} mm | exemplaires: ${typeGroup.count}</text><text x="28" y="74" font-size="11" fill="#5a3720">Finition: ${escapeHtmlForDoc(finishNote)}</text><rect x="${faceArea.x}" y="${faceArea.y}" width="${faceArea.w}" height="${faceArea.h}" fill="none" stroke="#d0d0d0"/><rect x="${faceX.toFixed(1)}" y="${faceY.toFixed(1)}" width="${faceW.toFixed(1)}" height="${faceH.toFixed(1)}" fill="none" stroke="#222" stroke-width="1.2"/>${holesMarkup}${holeDiaCallout}<rect x="${secArea.x}" y="${secArea.y}" width="${secArea.w}" height="${secArea.h}" fill="none" stroke="#d0d0d0"/><rect x="${secX.toFixed(1)}" y="${secY.toFixed(1)}" width="${secW.toFixed(1)}" height="${secH.toFixed(1)}" fill="none" stroke="#222" stroke-width="1.1"/>${dimMarkup}${holeDimMarkup}</svg>`;
        }

        function renderChantierDrillTable(types) {
            if(!types || types.length === 0) {
                return '<div class="dp-help">Aucune pièce disponible.</div>';
            }
            const rows = types.map(type => {
                const p = type.representative;
                const holes = p.holes2d || [];
                const holeText = holes.length
                    ? holes.map((h, idx) => `H${idx + 1}: X ${dmToMm(h.x || 0)} / Y ${dmToMm(h.y || 0)} / Dia ${Math.round(getHoleDiaMm(h))} mm`).join('<br>')
                    : '<span style="color:#777;">-</span>';
                return `<tr><td style="border-bottom:1px solid #2a2a2a;padding:4px;vertical-align:top;">${escapeHtmlForDoc(type.baseLabel)}</td><td style="border-bottom:1px solid #2a2a2a;padding:4px;vertical-align:top;">${type.count}</td><td style="border-bottom:1px solid #2a2a2a;padding:4px;vertical-align:top;">${dmToMm(p.dim.L)} x ${dmToMm(p.dim.H)} x ${dmToMm(p.dim.T)}</td><td style="border-bottom:1px solid #2a2a2a;padding:4px;vertical-align:top;">${escapeHtmlForDoc(getWorkshopFinishNote(p))}</td><td style="border-bottom:1px solid #2a2a2a;padding:4px;vertical-align:top;">${holeText}</td></tr>`;
            }).join('');
            return `<div style="max-height:220px;overflow:auto;border:1px solid #252525;border-radius:4px;"><table style="width:100%;border-collapse:collapse;font-size:0.92em;"><thead><tr><th style="text-align:left;padding:4px;border-bottom:1px solid #3a3a3a;color:#d8c6af;">Type</th><th style="text-align:left;padding:4px;border-bottom:1px solid #3a3a3a;color:#d8c6af;">Qté</th><th style="text-align:left;padding:4px;border-bottom:1px solid #3a3a3a;color:#d8c6af;">Dim (mm)</th><th style="text-align:left;padding:4px;border-bottom:1px solid #3a3a3a;color:#d8c6af;">Finition</th><th style="text-align:left;padding:4px;border-bottom:1px solid #3a3a3a;color:#d8c6af;">Perçages</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }

        function renderLiveTechnicalPlans() {
            const targetSelect = document.getElementById('chantier-tech-jard-select');
            const assemblyWrap = document.getElementById('chantier-tech-assembly');
            const typeSelect = document.getElementById('chantier-tech-type-select');
            const pieceWrap = document.getElementById('chantier-tech-piece');
            const drillWrap = document.getElementById('chantier-tech-drills');
            if(!targetSelect || !assemblyWrap || !typeSelect || !pieceWrap || !drillWrap) return;

            if(!Array.isArray(jardinières) || jardinières.length === 0) {
                targetSelect.innerHTML = '<option value="auto">Aucune jardinière</option>';
                assemblyWrap.innerHTML = '<div class="dp-help" style="padding:8px;">Aucune jardinière disponible.</div>';
                typeSelect.innerHTML = '';
                pieceWrap.innerHTML = '';
                drillWrap.innerHTML = '';
                return;
            }

            targetSelect.innerHTML = '<option value="auto">Sélection active</option>' + jardinières.map((j, idx) => `<option value="${escapeHtmlForDoc(j.id)}">Jardinière ${idx + 1}</option>`).join('');
            targetSelect.value = chantierTechSelectedJardId || 'auto';

            const target = getChantierTargetJardiniere();
            const model = getJardFabricationModel(target);
            const types = computeChantierPieceTypes(model.pieces || []);

            assemblyWrap.innerHTML = buildChantierAssemblySvg(target, model);

            if(!types.length) {
                typeSelect.innerHTML = '';
                pieceWrap.innerHTML = '<div class="dp-help" style="padding:8px;">Aucune pièce à détailler.</div>';
                drillWrap.innerHTML = '<div class="dp-help">Aucun perçage.</div>';
                chantierTechSelectedTypeKey = null;
                return;
            }

            if(!chantierTechSelectedTypeKey || !types.find(t => t.key === chantierTechSelectedTypeKey)) {
                chantierTechSelectedTypeKey = types[0].key;
            }

            typeSelect.innerHTML = types.map(t => `<option value="${escapeHtmlForDoc(t.key)}">${escapeHtmlForDoc(t.displayLabel)}</option>`).join('');
            typeSelect.value = chantierTechSelectedTypeKey;
            const selectedType = types.find(t => t.key === chantierTechSelectedTypeKey) || types[0];

            pieceWrap.innerHTML = buildChantierPieceSvg(selectedType);
            drillWrap.innerHTML = renderChantierDrillTable(types);
            syncTechPlanModalContent();
        }

        function getTechPlanSourceElement(kind) {
            if(kind === 'assembly') return document.getElementById('chantier-tech-assembly');
            if(kind === 'piece') return document.getElementById('chantier-tech-piece');
            if(kind === 'cut') {
                if(!techPlanModalCutProfile) return null;
                const profileId = getCutProfileId(techPlanModalCutProfile);
                return document.getElementById(profileId + '-svgwrap');
            }
            if(kind === 'iso') {
                return techPlanModalIsoId ? document.getElementById(techPlanModalIsoId) : null;
            }
            return null;
        }

        function getTechPlanModalTitle(kind) {
            if(kind === 'assembly') {
                const target = getChantierTargetJardiniere();
                const idx = target ? jardinières.indexOf(target) + 1 : null;
                return idx ? `Plan d'ensemble - Jardinière ${idx}` : "Plan d'ensemble";
            }
            if(kind === 'cut') {
                return techPlanModalCutProfile ? `Plan de coupe - ${techPlanModalCutProfile}` : 'Plan de coupe';
            }
            if(kind === 'iso') {
                const source = getTechPlanSourceElement(kind);
                const title = source ? String(source.getAttribute('data-title') || '').trim() : '';
                return title || 'Vue isométrique';
            }
            const select = document.getElementById('chantier-tech-type-select');
            const selectedText = select && select.selectedOptions && select.selectedOptions[0]
                ? String(select.selectedOptions[0].textContent || '').trim()
                : '';
            return selectedText ? `Plan par type - ${selectedText}` : 'Plan par type';
        }

        function applyTechPlanModalZoom() {
            const canvas = document.getElementById('modal-tech-plan-canvas');
            const zoomLabel = document.getElementById('modal-tech-plan-zoom');
            if(!canvas || !zoomLabel) return;
            canvas.style.transform = `scale(${techPlanModalZoom})`;
            zoomLabel.textContent = Math.round(techPlanModalZoom * 100) + '%';
        }

        function syncTechPlanModalContent() {
            const modal = document.getElementById('modal-tech-plan');
            const title = document.getElementById('modal-tech-plan-title');
            const canvas = document.getElementById('modal-tech-plan-canvas');
            if(!modal || !title || !canvas || modal.style.display !== 'flex' || !techPlanModalKind) return;

            const source = getTechPlanSourceElement(techPlanModalKind);
            title.textContent = getTechPlanModalTitle(techPlanModalKind);
            if(!source) {
                canvas.innerHTML = '<div class="dp-help" style="padding:14px;">Aucun plan à afficher.</div>';
                applyTechPlanModalZoom();
                return;
            }

            const svg = source.querySelector('svg');
            if(svg) {
                const clone = svg.cloneNode(true);
                clone.style.width = '100%';
                clone.style.height = 'auto';
                canvas.innerHTML = '';
                canvas.appendChild(clone);
            } else {
                canvas.innerHTML = '<div class="dp-help" style="padding:14px;">Aucun plan à afficher.</div>';
            }
            applyTechPlanModalZoom();
        }

        function openTechPlanModal(kind) {
            const modal = document.getElementById('modal-tech-plan');
            if(!modal) return;
            techPlanModalKind = kind === 'piece' ? 'piece' : 'assembly';
            techPlanModalCutProfile = null;
            techPlanModalIsoId = null;
            techPlanModalZoom = 1;
            modal.style.display = 'flex';
            syncTechPlanModalContent();
        }

        function openIsoPlanModal(isoId) {
            const modal = document.getElementById('modal-tech-plan');
            if(!modal) return;
            techPlanModalKind = 'iso';
            techPlanModalCutProfile = null;
            techPlanModalIsoId = String(isoId || '').trim();
            techPlanModalZoom = 1;
            modal.style.display = 'flex';
            syncTechPlanModalContent();
        }

        function openCutPlanModal(profile) {
            const modal = document.getElementById('modal-tech-plan');
            if(!modal) return;
            techPlanModalKind = 'cut';
            techPlanModalCutProfile = String(profile || '').trim();
            techPlanModalIsoId = null;
            techPlanModalZoom = 1;
            modal.style.display = 'flex';
            syncTechPlanModalContent();
        }

        function closeTechPlanModal() {
            const modal = document.getElementById('modal-tech-plan');
            if(!modal) return;
            modal.style.display = 'none';
            techPlanModalKind = null;
            techPlanModalCutProfile = null;
            techPlanModalIsoId = null;
            techPlanModalZoom = 1;
        }

        function adjustTechPlanZoom(delta) {
            techPlanModalZoom = Math.max(0.6, Math.min(3.2, techPlanModalZoom + (delta || 0)));
            applyTechPlanModalZoom();
        }

        function resetTechPlanZoom() {
            techPlanModalZoom = 1;
            applyTechPlanModalZoom();
        }

        function csvCell(value) {
            const text = String(value ?? '');
            if(/[;"\n\r]/.test(text)) return '"' + text.replace(/"/g, '""') + '"';
            return text;
        }

        async function downloadCsvFile(filename, lines) {
            const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
            await downloadBlobFile(filename, blob, 'Export CSV');
        }

        function exportFullWorkshopCsv() {
            const materials = getChantierMaterialsFromDevis();
            if(materials.length === 0) {
                alert('Aucune donnée atelier disponible. Ajoutez au moins un objet puis réessayez.');
                return;
            }

            const projectName = currentProjectName || 'Projet jardiniere';
            const lines = [];
            const add = (...cells) => lines.push(cells.map(csvCell).join(';'));

            add('SECTION', 'INFO');
            add('Projet', projectName);
            add('Date', new Date().toLocaleDateString('fr-FR'));
            add('Trait de scie mm', Math.round(getSawKerfCm() * 10));
            lines.push('');

            add('SECTION', 'ACHAT_MATIERES');
            add('profil', 'detail', 'unites_a_acheter', 'unite', 'lineaire_cm', 'chute_cm', 'perte_trait_scie_cm', 'stock_reel');
            materials.forEach(row => {
                add(
                    row.profile,
                    row.label || '',
                    row.barsCount,
                    row.unitLabel,
                    formatCmForDoc(row.linearCm || 0),
                    formatCmForDoc(row.wasteCm || 0),
                    formatCmForDoc(row.sawLossCm || 0),
                    row.stockInventory || (row.stockLengthCm ? `${formatCmForDoc(row.stockLengthCm)} cm` : '')
                );
            });
            lines.push('');

            add('SECTION', 'DEBIT_BARRES');
            add('profil', 'barre', 'stock_cm', 'ordre_piece', 'longueur_piece_cm', 'trait_scie_avant_cm', 'chute_barre_cm', 'source_stock');
            materials.forEach(row => {
                if(row.isAccessoryGroup || row.isSheetGroup) return;
                (row.bars || []).forEach((bar, barIdx) => {
                    (bar.cuts || []).forEach((cut, cutIdx) => {
                        add(
                            row.profile,
                            barIdx + 1,
                            formatCmForDoc(bar.stockLengthCm || row.stockLengthCm || 0),
                            cutIdx + 1,
                            formatCmForDoc((typeof cut === 'number' ? cut : cut.lengthCm) || 0),
                            formatCmForDoc(cutIdx > 0 ? (bar.kerfCm || row.kerfMm / 10 || 0) : 0),
                            formatCmForDoc(bar.remaining || 0),
                            bar.sourceLabel || ''
                        );
                    });
                });
                (row.unableToFit || []).forEach(piece => {
                    add(row.profile, 'HORS_STOCK', '', '', formatCmForDoc(piece.lengthCm || 0), '', '', 'Piece trop longue ou stock insuffisant');
                });
            });
            lines.push('');

            add('SECTION', 'PIECES_ET_FINITION');
            add('objet', 'piece_id', 'designation', 'famille', 'longueur_mm', 'hauteur_mm', 'epaisseur_mm', 'finition', 'percages');
            (jardinières || [])
                .filter(j => shouldIncludeConstructionInCalculations(j, 'jardiniere'))
                .forEach((j, idx) => {
                const model = getJardFabricationModel(j);
                (model.pieces || []).forEach(piece => {
                    add(
                        `Jardiniere ${idx + 1}`,
                        piece.id,
                        piece.label,
                        piece.family,
                        dmToMm(piece.dim.L),
                        dmToMm(piece.dim.H),
                        dmToMm(piece.dim.T),
                        getWorkshopFinishNote(piece),
                        (piece.holes2d || []).length
                    );
                });
            });
            (cubes || [])
                .filter(cube => shouldIncludeConstructionInCalculations(cube, 'cube'))
                .forEach((cube, idx) => {
                const model = buildMeridienneFabricationModel(cube);
                (model.pieces || []).forEach(piece => {
                    add(
                        `Meridienne ${idx + 1}`,
                        piece.id,
                        piece.label,
                        piece.family,
                        dmToMm(piece.dim.L),
                        dmToMm(piece.dim.H),
                        dmToMm(piece.dim.T),
                        getWorkshopFinishNote(piece),
                        (piece.holes2d || []).length
                    );
                });
            });
            lines.push('');

            add('SECTION', 'PERCAGES');
            add('objet', 'piece_id', 'designation', 'trou', 'x_mm', 'y_mm', 'diametre_mm');
            (jardinières || [])
                .filter(j => shouldIncludeConstructionInCalculations(j, 'jardiniere'))
                .forEach((j, idx) => {
                const model = getJardFabricationModel(j);
                (model.pieces || []).forEach(piece => {
                    (piece.holes2d || []).forEach((h, holeIdx) => {
                        add(`Jardiniere ${idx + 1}`, piece.id, piece.label, 'H' + (holeIdx + 1), dmToMm(h.x || 0), dmToMm(h.y || 0), Math.round(getHoleDiaMm(h)));
                    });
                });
            });
            (cubes || [])
                .filter(cube => shouldIncludeConstructionInCalculations(cube, 'cube'))
                .forEach((cube, idx) => {
                const model = buildMeridienneFabricationModel(cube);
                (model.pieces || []).forEach(piece => {
                    (piece.holes2d || []).forEach((h, holeIdx) => {
                        add(`Meridienne ${idx + 1}`, piece.id, piece.label, 'H' + (holeIdx + 1), dmToMm(h.x || 0), dmToMm(h.y || 0), Math.round(getHoleDiaMm(h)));
                    });
                });
            });

            const safeName = String(projectName).replace(/[^a-z0-9-_]+/gi, '_');
            downloadCsvFile('atelier_' + safeName + '.csv', lines);
        }

        function exportChantierDrillCsv() {
            const target = getChantierTargetJardiniere();
            if(!target) {
                alert('Aucune jardinière disponible.');
                return;
            }

            const model = getJardFabricationModel(target);
            const lines = ['piece_id;designation;longueur_mm;hauteur_mm;epaisseur_mm;finition;perçages;x_mm;y_mm;diametre_mm'];
            (model.pieces || []).forEach(piece => {
                lines.push([piece.id, piece.label, dmToMm(piece.dim.L), dmToMm(piece.dim.H), dmToMm(piece.dim.T), getWorkshopFinishNote(piece), (piece.holes2d || []).length, '', '', ''].map(csvCell).join(';'));
                (piece.holes2d || []).forEach((h, idx) => {
                    lines.push([piece.id, piece.label, '', '', '', '', 'H' + (idx + 1), dmToMm(h.x || 0), dmToMm(h.y || 0), Math.round(getHoleDiaMm(h))].map(csvCell).join(';'));
                });
            });

            downloadCsvFile('percages_jardiniere_' + String(jardinières.indexOf(target) + 1) + '.csv', lines);
        }

        function initDevisForm() {
            ensureDevisFormReady();
            renderLivePricingSummary();
        }

        function initFabricationForm() {
            ensureFabricationFormReady();
            renderStockAtelierPanel();
            renderLiveCutPlan();
        }

                function escapeHtmlForDoc(value) {
                        return String(value ?? '')
                                .replace(/&/g, '&amp;')
                                .replace(/</g, '&lt;')
                                .replace(/>/g, '&gt;')
                                .replace(/"/g, '&quot;')
                                .replace(/'/g, '&#39;');
                }

                function formatCmForDoc(value) {
                        const rounded = Math.round((Number(value) || 0) * 10) / 10;
                        return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1).replace('.', ',');
                }

	                function getChantierMaterialsFromDevis() {
	                        const groups = collectCutPiecesAllConstructions();
	                        return groups.map(group => {
	                                const unitType = group.meta && group.meta.unitType;
	                                const isScrewGroup = unitType === 'box';
	                                const isItemGroup = unitType === 'item';
	                                const isSheetGroup = unitType === 'sheet';
	                                const isLiterGroup = unitType === 'liter';
	                                const isAccessoryGroup = isScrewGroup || isItemGroup || isLiterGroup;
	                                const stockLengthCm = getStockLengthForProfile(group.profile);
	                                const stockEntries = getStockEntriesForProfile(group.profile);
	                                const cutPlan = (isAccessoryGroup || isSheetGroup) ? { bars: [], unableToFit: [], kerfCm: getSawKerfCm() } : optimizeCutsFFD(group.lengths, stockEntries, getSawKerfCm());
	                                const bars = cutPlan.bars || [];
	                                const linearCm = group.lengths.reduce((a, b) => a + b, 0);
	                                const wasteCm = bars.reduce((a, b) => a + b.remaining, 0);
	                                const sawLossCm = bars.reduce((a, b) => a + (b.cutLossCm || 0), 0);
	                                const barsSvg = isSheetGroup ? renderSheetCutsSvg(group.meta.sheets || [], group.profile) : (isAccessoryGroup ? '' : renderCutBarsSvg(cutPlan, stockLengthCm));
	                                const unitPrice = getUnitPriceForProfile(group.profile);
	                                const unitsToBuy = isScrewGroup ? Math.ceil((group.meta.qty || 0) / (group.meta.packSize || 100)) : ((isItemGroup || isSheetGroup || isLiterGroup) ? (group.meta.qty || 0) : bars.length);
	                                const totalPrice = unitsToBuy * unitPrice;
	                                return {
	                                        profile: group.profile,
	                                        label: group.label || '',
	                                        pieces: (isAccessoryGroup || isSheetGroup) ? (group.meta.qty || 0) : group.lengths.length,
	                                        linearCm,
	                                        stockLengthCm,
	                                        stockInventory: cutStockInventoryByProfile[group.profile] || '',
	                                        stockEntries,
	                                        barsCount: unitsToBuy,
	                                        wasteCm,
	                                        sawLossCm,
	                                        kerfMm: Math.round(getSawKerfCm() * 10),
	                                        unitPrice,
	                                        totalPrice,
	                                        unitLabel: isScrewGroup ? 'boîte(s)' : (isItemGroup ? 'pièce(s)' : (isLiterGroup ? 'L' : (isSheetGroup ? 'm²' : 'barre(s)'))),
	                                        packSize: isScrewGroup ? (group.meta.packSize || 100) : null,
	                                        breakdown: isScrewGroup ? (group.meta.breakdown || {}) : null,
	                                        isScrewGroup,
	                                        isItemGroup,
	                                        isSheetGroup,
	                                        isLiterGroup,
	                                        isAccessoryGroup,
	                                        unableToFit: cutPlan.unableToFit || [],
	                                        sheets: isSheetGroup ? (group.meta.sheets || []) : null,
	                                        bars,
	                                        barsSvg
	                                };
                        });
                }

        function collectTechnicalPlansForPdf() {
            const plans = [];
            getConstructionItems()
                .filter(entry => shouldIncludeConstructionInCalculations(entry.item, entry.type))
                .forEach(entry => {
                    const spec = getConstructionIsoDimensions(entry);
                    if(!spec) return;
                    plans.push({
                        title: `${spec.label} - vue isometrique`,
                        subtitle: `${formatCmForDoc(spec.wCm)} x ${formatCmForDoc(spec.dCm)} x ${formatCmForDoc(spec.hCm)} cm`,
                        svg: getItemWorkshopSvg(entry, spec)
                    });
                });
            (jardinières || [])
                .filter(j => shouldIncludeConstructionInCalculations(j, 'jardiniere'))
                .forEach((j, idx) => {
                const model = getJardFabricationModel(j);
                const pieces = model && Array.isArray(model.pieces) ? model.pieces : [];
                if(!pieces.length) return;

                plans.push({
                    title: `Jardiniere ${idx + 1} - plan d'ensemble`,
                    subtitle: `${pieces.length} pieces`,
                    svg: buildChantierAssemblySvg(j, model)
                });

                const types = computeChantierPieceTypes(pieces);
                types.forEach(type => {
                    const p = type.representative;
                    plans.push({
                        title: `Jardiniere ${idx + 1} - ${type.baseLabel}`,
                        subtitle: `x${type.count} | ${dmToMm(p.dim.L)} x ${dmToMm(p.dim.H)} x ${dmToMm(p.dim.T)} mm`,
                        svg: buildChantierPieceSvg(type)
                    });
                });
            });
            return plans;
        }

        function waitAnimationFrame() {
            return new Promise(resolve => requestAnimationFrame(() => resolve()));
        }

        async function svgMarkupToPngDataUrl(svgMarkup, targetWidthPx = 2000) {
            const viewBoxMatch = String(svgMarkup).match(/viewBox="0 0 ([0-9.]+) ([0-9.]+)"/i);
            const srcW = viewBoxMatch ? parseFloat(viewBoxMatch[1]) : 400;
            const srcH = viewBoxMatch ? parseFloat(viewBoxMatch[2]) : 120;
            const safeSrcW = srcW > 0 ? srcW : 400;
            const safeSrcH = srcH > 0 ? srcH : 120;
            const outW = Math.max(800, Math.round(targetWidthPx));
            const outH = Math.max(200, Math.round(outW * (safeSrcH / safeSrcW)));

            return new Promise((resolve, reject) => {
                const blob = new Blob([svgMarkup], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.onload = () => {
                    try {
                        const c = document.createElement('canvas');
                        c.width = outW;
                        c.height = outH;
                        const ctx = c.getContext('2d');
                        ctx.fillStyle = '#0c0c0c';
                        ctx.fillRect(0, 0, outW, outH);
                        ctx.drawImage(img, 0, 0, outW, outH);
                        URL.revokeObjectURL(url);
                        resolve(c.toDataURL('image/png'));
                    } catch(err) {
                        URL.revokeObjectURL(url);
                        reject(err);
                    }
                };
                img.onerror = (err) => {
                    URL.revokeObjectURL(url);
                    reject(err);
                };
                img.src = url;
            });
        }

        async function capturePlan2DDataUrl() {
            setMainView('2d', { skipValidation: true });
            await waitAnimationFrame();
            draw2D();
            await waitAnimationFrame();
            return canvas2d.toDataURL('image/png');
        }

        async function capture3DViewsDataUrls() {
            setMainView('3d', { skipValidation: true });
            build3DArch();
            await waitAnimationFrame();

            const target = controls.target.clone();
            const distance = Math.max(40, camera.position.distanceTo(target));
            const configs = [
                { label: 'Vue 3D - Angle avant droit', pos: new THREE.Vector3(target.x + distance * 0.95, target.y + distance * 0.5, target.z + distance * 0.95) },
                { label: 'Vue 3D - Angle avant gauche', pos: new THREE.Vector3(target.x - distance * 0.95, target.y + distance * 0.5, target.z + distance * 0.95) },
                { label: 'Vue 3D - Angle plongeant', pos: new THREE.Vector3(target.x + distance * 0.15, target.y + distance * 1.2, target.z + distance * 0.55) }
            ];

            const shots = [];
            for(const cfg of configs) {
                camera.position.copy(cfg.pos);
                controls.target.copy(target);
                controls.update();
                renderer.render(scene, camera);
                await waitAnimationFrame();
                shots.push({ label: cfg.label, dataUrl: renderer.domElement.toDataURL('image/png') });
            }
            return shots;
        }

	        function addImageFitted(doc, dataUrl, x, y, maxW, maxH) {
	            const p = doc.getImageProperties(dataUrl);
	            const ratio = p.width / p.height;
            let w = maxW;
            let h = w / ratio;
            if(h > maxH) {
                h = maxH;
                w = h * ratio;
            }
	            doc.addImage(dataUrl, 'PNG', x, y, w, h, undefined, 'FAST');
	            return { w, h };
	        }

        async function generateDevisPDF() {
            if(!window.jspdf || !window.jspdf.jsPDF) {
                alert('Le moteur PDF est indisponible. Vérifiez votre connexion internet puis rechargez la page.');
                return;
            }

            const materials = getChantierMaterialsFromDevis();
            if(materials.length === 0) {
                alert('Aucune donnée de fabrication disponible. Ajoutez au moins un objet puis réessayez.');
                return;
            }

            await startDownloadProgress('Téléchargement du devis PDF', 'Construction du devis...', 8);

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const pageW = 210;
            const pageH = 297;
            const margin = 14;
            const contentW = pageW - margin * 2;
            let y = margin;

            const projectName = currentProjectName || 'Projet jardiniere';
            const dateLabel = new Date().toLocaleDateString('fr-FR');
            const totalBars = materials.reduce((sum, row) => sum + row.barsCount, 0);
            const totalWaste = materials.reduce((sum, row) => sum + row.wasteCm, 0);
            const totalSawLoss = materials.reduce((sum, row) => sum + (row.sawLossCm || 0), 0);
            const totalPrice = materials.reduce((sum, row) => sum + (row.totalPrice || 0), 0);

            function ensureSpace(needed = 8) {
                if(y + needed > pageH - margin) {
                    doc.addPage();
                    y = margin;
                }
            }

            function addText(text, size = 10, bold = false) {
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setFontSize(size);
                const lines = doc.splitTextToSize(text, contentW);
                ensureSpace(lines.length * 4.5 + 2);
                doc.text(lines, margin, y);
                y += lines.length * 4.5 + 1;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.text('Devis matières premières', margin, y);
            y += 8;
            addText('Prix matière: ' + formatEuro(totalPrice), 14, true);
            addText('Projet: ' + projectName + ' | Date: ' + dateLabel + ' | Objets: ' + getConstructionItems().length, 10);
            addText('Synthese: ' + materials.length + ' familles | unites d achat ' + totalBars.toLocaleString('fr-FR') + ' | chute estimee ' + formatCmForDoc(totalWaste) + ' cm | trait scie cumule ' + formatCmForDoc(totalSawLoss) + ' cm | total ' + formatEuro(totalPrice), 10, true);
            y += 3;

            const col = {
                item: margin,
                qty: 103,
                unit: 124,
                pu: 151,
                total: 176
            };

            function addHeader() {
                ensureSpace(12);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(8.5);
                doc.text('Élément', col.item, y);
                doc.text('Qté', col.qty, y);
                doc.text('Unité', col.unit, y);
                doc.text('PU', col.pu, y);
                doc.text('Total', col.total, y);
                y += 2;
                doc.setDrawColor(120);
                doc.line(margin, y, pageW - margin, y);
                y += 5;
            }

            addHeader();
            updateDownloadProgress(32, 'Ajout des lignes de matière...');
            await waitAnimationFrame();
	            materials.forEach(row => {
	                const itemText = (row.isAccessoryGroup || row.isSheetGroup) && row.label ? (row.profile + ' - ' + row.label) : row.profile;
	                const itemLines = doc.splitTextToSize(itemText, col.qty - col.item - 4);
                const rowH = Math.max(7, itemLines.length * 4);
                if(y + rowH > pageH - margin) {
                    doc.addPage();
                    y = margin;
                    addHeader();
                }
                doc.setFont('helvetica', 'normal');
	                doc.setFontSize(8.5);
		                doc.text(itemLines, col.item, y);
		                doc.text(row.isSheetGroup || row.isLiterGroup ? row.barsCount.toLocaleString('fr-FR') : String(row.barsCount), col.qty, y);
	                const unitText = row.isScrewGroup
	                    ? (row.packSize + ' vis')
	                    : (row.isItemGroup ? 'piece' : (row.isLiterGroup ? 'L' : (row.isSheetGroup ? 'm2' : (row.stockInventory || (formatCmForDoc(row.stockLengthCm) + ' cm')))));
	                doc.text(unitText, col.unit, y);
	                doc.text(formatEuro(row.unitPrice), col.pu, y);
                doc.text(formatEuro(row.totalPrice), col.total, y);
                y += rowH;
                doc.setDrawColor(225);
                doc.line(margin, y - 2, pageW - margin, y - 2);
            });

            ensureSpace(14);
            y += 2;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            doc.text('Total devis: ' + formatEuro(totalPrice), margin, y);

            const safeName = String(projectName).replace(/[^a-z0-9-_]+/gi, '_');
            updateDownloadProgress(88, 'Lancement du téléchargement...');
            await waitAnimationFrame();
            doc.save('devis_' + safeName + '.pdf');
            finishDownloadProgress();
        }
	        
	        async function generateChantierPDF() {
            const materials = getChantierMaterialsFromDevis();
            if(materials.length === 0) {
                alert('Aucune donnée de fabrication disponible. Ajoutez au moins un objet puis réessayez.');
                return;
            }
            if(!window.jspdf || !window.jspdf.jsPDF) {
                alert('Le moteur PDF est indisponible. Vérifiez votre connexion internet puis rechargez la page.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF({ unit: 'mm', format: 'a4' });
            const pageW = 210;
            const pageH = 297;
            const margin = 14;
            const contentW = pageW - margin * 2;
            let y = margin;

	            const totalBars = materials.reduce((sum, row) => sum + row.barsCount, 0);
	            const totalWaste = materials.reduce((sum, row) => sum + row.wasteCm, 0);
	            const totalSawLoss = materials.reduce((sum, row) => sum + (row.sawLossCm || 0), 0);
            const projectName = currentProjectName || 'Projet jardiniere';
            const dateLabel = new Date().toLocaleDateString('fr-FR');

            const previousView = activeMainView;
            const previousCam = camera ? camera.position.clone() : null;
            const previousTarget = controls ? controls.target.clone() : null;

            let plan2DDataUrl = null;
            let view3DShots = [];
            let cutSchemes = [];
            let technicalPlans = [];

            try {
                await startDownloadProgress('Téléchargement du PDF fabrication', 'Capture du plan 2D...', 5);
                plan2DDataUrl = await capturePlan2DDataUrl();
                updateDownloadProgress(14, 'Capture des vues 3D...');
                await waitAnimationFrame();
                view3DShots = await capture3DViewsDataUrls();
                const technicalPlanDefs = collectTechnicalPlansForPdf();
                const schemeRows = materials.filter(row => !row.isAccessoryGroup);
                const totalImageSteps = Math.max(1, technicalPlanDefs.length + schemeRows.length);
                let imageStep = 0;
                for(const planDef of technicalPlanDefs) {
                    const pct = 18 + (imageStep / totalImageSteps) * 46;
                    updateDownloadProgress(pct, 'Conversion des plans techniques...');
                    await waitAnimationFrame();
                    const png = await svgMarkupToPngDataUrl(planDef.svg, 2400);
                    technicalPlans.push({
                        title: planDef.title,
                        subtitle: planDef.subtitle,
                        dataUrl: png
                    });
                    imageStep++;
                }
	                for(const row of schemeRows) {
                    const pct = 18 + (imageStep / totalImageSteps) * 46;
                    updateDownloadProgress(pct, 'Conversion des schémas de découpe...');
                    await waitAnimationFrame();
	                    const png = await svgMarkupToPngDataUrl(row.barsSvg, 2200);
                    cutSchemes.push({
                        title: row.profile,
                        subtitle: row.isSheetGroup
                            ? 'Surface: ' + row.barsCount.toLocaleString('fr-FR') + ' m2 | Decoupes: ' + ((row.sheets || []).length)
                            : 'Pieces: ' + row.pieces + ' | Barres: ' + row.barsCount + ' | Chute: ' + formatCmForDoc(row.wasteCm) + ' cm | Trait scie cumule: ' + formatCmForDoc(row.sawLossCm || 0) + ' cm',
                        dataUrl: png
                    });
                    imageStep++;
                }
            } catch(err) {
                failDownloadProgress('Erreur pendant la génération du PDF.');
                alert('Erreur lors de la capture des vues pour le PDF: ' + (err && err.message ? err.message : err));
                return;
            } finally {
                if(previousView) setMainView(previousView, { skipValidation: true });
                if(previousCam && camera) camera.position.copy(previousCam);
                if(previousTarget && controls) {
                    controls.target.copy(previousTarget);
                    controls.update();
                }
                if(activeMainView === '2d' || activeMainView === 'mixte') draw2D();
            }

            function ensureSpace(needed = 8) {
                if(y + needed > pageH - margin) {
                    doc.addPage();
                    y = margin;
                }
            }

            function addTitle(text) {
                ensureSpace(10);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(16);
                doc.text(text, margin, y);
                y += 7;
            }

            function addHeading(text) {
                ensureSpace(8);
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.text(text, margin, y);
                y += 5;
            }

            function addLines(text, size = 10, bold = false) {
                doc.setFont('helvetica', bold ? 'bold' : 'normal');
                doc.setFontSize(size);
                const lines = doc.splitTextToSize(text, contentW);
                ensureSpace(lines.length * 4 + 2);
                doc.text(lines, margin, y);
                y += lines.length * 4 + 1;
            }

            updateDownloadProgress(68, 'Assemblage des pages du PDF...');
            await waitAnimationFrame();
            addTitle('Fabrication atelier');
            addLines('Projet: ' + projectName + ' | Date: ' + dateLabel + ' | Objets: ' + getConstructionItems().length, 10);
	            addLines('Synthese atelier: ' + materials.length + ' familles materiaux | unites d achat ' + totalBars.toLocaleString('fr-FR') + ' | chute estimee ' + formatCmForDoc(totalWaste) + ' cm | trait scie cumule ' + formatCmForDoc(totalSawLoss) + ' cm', 10, true);
	            addLines('Important: les dimensions indiquees sur les plans techniques sont les dimensions finales des pieces. Le stock reel et le trait de scie servent uniquement au plan de debit.', 9);
            y += 2;

            addHeading('1. Materiel a acheter');
            materials.forEach((row, idx) => {
	                const line = row.isScrewGroup
	                    ? (idx + 1) + '. ' + row.profile + ' | vis: ' + row.pieces + ' | detail: ' + (row.label || 'assemblage') + ' | boites: ' + row.barsCount + ' x ' + row.packSize + ' vis'
	                    : row.isItemGroup
	                        ? (idx + 1) + '. ' + row.profile + ' | quantite: ' + row.pieces + ' piece(s) | detail: ' + (row.label || 'accessoire')
	                        : row.isLiterGroup
	                            ? (idx + 1) + '. ' + row.profile + ' | volume: ' + row.barsCount.toLocaleString('fr-FR') + ' L | detail: ' + (row.label || 'consommable')
	                        : row.isSheetGroup
	                            ? (idx + 1) + '. ' + row.profile + ' | surface: ' + row.barsCount.toLocaleString('fr-FR') + ' m2 | decoupes: ' + ((row.sheets || []).length) + ' | detail: ' + (row.label || 'protection interieure')
	                    : (idx + 1) + '. ' + row.profile + ' | pieces: ' + row.pieces + ' | lineaire: ' + formatCmForDoc(row.linearCm) + ' cm | barres: ' + row.barsCount + ' | stock: ' + (row.stockInventory || (formatCmForDoc(row.stockLengthCm) + ' cm')) + ' | trait scie: ' + row.kerfMm + ' mm | chute: ' + formatCmForDoc(row.wasteCm) + ' cm';
                addLines(line, 9);
                if(row.unableToFit && row.unableToFit.length) {
                    addLines('ALERTE hors stock: ' + row.unableToFit.map(p => formatCmForDoc(p.lengthCm) + ' cm').join(', '), 9, true);
                }
            });

            y += 2;
            addHeading('2. Outils');
            [
                'Scie (circulaire/ou onglet), guide de coupe, serre-joints',
                'Perceuse-visseuse, forets bois, embouts, fraisoir',
                'Metre, equerre, regle, crayon de tracage, niveau',
                'Ponceuse (ou papier abrasif)'
            ].forEach(item => addLines('- ' + item, 10));

            y += 2;
            addHeading('3. Equipements de securite');
            [
                'Lunettes de protection',
                'Protection auditive',
                'Masque anti-poussiere',
                'Gants de manutention',
                'Chaussures fermees antiderapantes'
            ].forEach(item => addLines('- ' + item, 10));

            y += 2;
            addHeading('4. Plan d\'assemblage (grandes etapes)');
            [
                'Etape A: Preparation et coupe des pieces selon longueurs finales, en tenant compte du trait de scie sur le schema de debit.',
                'Etape B: Assemblage des pieds/lambourdes, puis de la cuve.',
                'Etape C: Pose des tasseaux et du sommier (fond).',
                'Etape D: Pose du geotextile au fond, bordage et agrafage de la marge sur les cotes.',
                'Etape E: Pose de la bache EPDM sur les parois interieures, deployee par-dessus le geotextile jusqu en haut.',
                'Etape F: Pose du treillis (si active), puis accessoires.',
                'Etape G: Controles finaux, poncage et protection du bois.'
            ].forEach(step => addLines('- ' + step, 10));

            y += 2;
            addHeading('5. Finitions visibles');
            [
                'Planches de cuve: face exterieure visible a peindre/proteger; face interieure protegee par la bache.',
                'Pieds/lambourdes et treillis visibles: peindre/proteger avant ou apres montage selon acces.',
                'Tasseaux bas et lattes de fond: non visibles; protection simple suffisante sauf exposition directe.'
            ].forEach(item => addLines('- ' + item, 10));

            doc.addPage();
            y = margin;
            addHeading('6. Plan 2D');
            if(plan2DDataUrl) {
                const box2d = addImageFitted(doc, plan2DDataUrl, margin, y + 2, contentW, pageH - y - margin - 2);
                y += box2d.h + 4;
            }

            for(const shot of view3DShots) {
                doc.addPage();
                y = margin;
                addHeading('7. ' + shot.label);
                const box3d = addImageFitted(doc, shot.dataUrl, margin, y + 2, contentW, pageH - y - margin - 2);
                y += box3d.h + 4;
            }

            technicalPlans.forEach((plan, idx) => {
                doc.addPage();
                y = margin;
                addHeading('8. Plan technique ' + (idx + 1));
                addLines(plan.title, 11, true);
                if(plan.subtitle) addLines(plan.subtitle, 9);
                addImageFitted(doc, plan.dataUrl, margin, y + 2, contentW, pageH - y - margin - 2);
            });

            cutSchemes.forEach((scheme, idx) => {
                doc.addPage();
                y = margin;
                addHeading('9. Schema de decoupe ' + (idx + 1));
                addLines(scheme.title, 11, true);
                addLines(scheme.subtitle, 9);
                addImageFitted(doc, scheme.dataUrl, margin, y + 2, contentW, pageH - y - margin - 2);
            });

            const safeName = String(projectName).replace(/[^a-z0-9-_]+/gi, '_');
            updateDownloadProgress(92, 'Lancement du téléchargement...');
            await waitAnimationFrame();
            doc.save('fabrication_' + safeName + '.pdf');
            finishDownloadProgress();
        }
        
