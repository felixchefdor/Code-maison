        function getDefaultConstructionSettings() {
            const activePlacement = getSelectedPlacementObject();
            const activePlacementType = getPlacementType(activePlacement);
            return {
                cuveTargetH: 3.75,
                boardThickness: 0.25,
                boardWidth: 0.9,
                boardGap: 0.05,
                lambourdeLong: 0.7,
                lambourdeWide: 0.45,
                floorBattenWidth: 0.35,
                floorBattenHeight: 0.35,
                floorSlatWidth: 0.9,
                floorSlatThickness: 0.18,
                floorMinGap: 0.05,
                floorMaxGap: 0.2,
                floorInset: 0.06
            };
        }

        function getCuveBoardProfileLabel(construction) {
            const c = normalizeConstructionSettings(construction);
            const isDefaultPylaBoard = Math.abs(c.boardThickness - 0.25) < 0.0001
                && Math.abs(c.boardWidth - 0.9) < 0.0001;
            if(isDefaultPylaBoard && typeof DEFAULT_CUVE_BOARD_PRODUCT_NAME !== 'undefined') {
                return DEFAULT_CUVE_BOARD_PRODUCT_NAME;
            }
            return `Planches cuve ${dmToCm(c.boardThickness)} x ${dmToCm(c.boardWidth)} cm`;
        }

        function getLambourdeProfileLabel(construction) {
            const c = normalizeConstructionSettings(construction);
            const isDefaultPineLambourde = Math.abs(c.lambourdeLong - 0.7) < 0.0001
                && Math.abs(c.lambourdeWide - 0.45) < 0.0001;
            if(isDefaultPineLambourde && typeof DEFAULT_LAMBOURDE_PRODUCT_NAME !== 'undefined') {
                return DEFAULT_LAMBOURDE_PRODUCT_NAME;
            }
            return `Lambourdes ${dmToCm(c.lambourdeLong)} x ${dmToCm(c.lambourdeWide)} cm`;
        }

        function normalizeConstructionSettings(settings = {}) {
            return { ...getDefaultConstructionSettings(), ...(settings || {}) };
        }

        function getCuveBoardGap(construction) {
            return 0;
        }

        function trimPlantsList(plants) {
            const safePlants = Array.isArray(plants) ? plants : [];
            if(safePlants.length <= MAX_PLANTS_PER_JARDINIERE) return safePlants;
            return safePlants.slice(0, MAX_PLANTS_PER_JARDINIERE);
        }

        function clampNumber(value, min, max) {
            return Math.max(min, Math.min(max, value));
        }

        function normalizeLayerView(value) {
            return LAYER_VIEW_STEPS.includes(value) ? value : 'mulch';
        }

        function getLayerViewLabel(value) {
            return {
                geotextile: 'Géotextile',
                epdm: 'Bâche EPDM',
                gravel: 'Billes d’argile',
                soil: 'Terreau',
                mulch: 'Paillage'
            }[normalizeLayerView(value)];
        }

        function getPottedPlantBounds(j, inset = 0.9) {
            const halfW = Math.max(0, (j.w || 0) / 2 - inset);
            const halfD = Math.max(0, (j.d || 0) / 2 - inset);
            return { minX: -halfW, maxX: halfW, minZ: -halfD, maxZ: halfD };
        }

        function seededUnit(seed, salt = 0) {
            const x = Math.sin((seed + 1) * 12.9898 + (salt + 1) * 78.233) * 43758.5453;
            return x - Math.floor(x);
        }

        function createDefaultPlantsForJardiniere(j) {
            const plants = [
                { type: 'Clématite', color: 0x6a3fa0, onTreillis: true, x: -j.w * 0.25, z: -j.d / 2 },
                { type: 'Jasmin', color: 0xe8f5c8, onTreillis: true, x: j.w * 0.25, z: -j.d / 2 }
            ];

            DEFAULT_POT_PLANT_COLORS.forEach((color, i) => {
                plants.push({
                    type: 'Plante ' + (i + 1),
                    color,
                    onTreillis: false,
                    scatterSeed: Math.random() * 100000 + i * 97,
                    visualScale: 0.55 + Math.random() * 0.95,
                    x: (Math.random() - 0.5) * (j.w - 2),
                    z: (Math.random() - 0.5) * (j.d - 1.5)
                });
            });

            return plants;
        }

        function redistributePottedPlants(j) {
            if(!j || !Array.isArray(j.plants)) return;
            const potPlants = j.plants.filter(p => !p.onTreillis);
            const count = potPlants.length;
            if(count === 0) return;

            const bounds = getPottedPlantBounds(j);
            const spanX = bounds.maxX - bounds.minX;
            const spanZ = bounds.maxZ - bounds.minZ;
            const area = Math.max(0.1, spanX * spanZ);
            const minDist = Math.max(0.55, Math.min(1.55, Math.sqrt(area / count) * 0.55));
            const placed = [];

            function candidateFor(plant, attempt) {
                const seed = plant.scatterSeed;
                return {
                    x: bounds.minX + spanX * seededUnit(seed, attempt * 2),
                    z: bounds.minZ + spanZ * seededUnit(seed, attempt * 2 + 1)
                };
            }

            potPlants.forEach((plant, idx) => {
                if(typeof plant.scatterSeed !== 'number') {
                    plant.scatterSeed = Math.random() * 100000 + idx * 97;
                }
                if(typeof plant.visualScale !== 'number') {
                    plant.visualScale = 0.55 + seededUnit(plant.scatterSeed, 41) * 0.95;
                }

                let best = null;
                let bestDistance = -Infinity;
                for(let attempt = 0; attempt < 48; attempt++) {
                    const candidate = candidateFor(plant, attempt);
                    const nearest = placed.reduce((min, pos) => {
                        const dx = candidate.x - pos.x;
                        const dz = candidate.z - pos.z;
                        return Math.min(min, Math.sqrt(dx * dx + dz * dz));
                    }, Infinity);
                    if(nearest > bestDistance) {
                        bestDistance = nearest;
                        best = candidate;
                    }
                    if(nearest >= minDist && attempt > 12) break;
                }

                plant.x = best ? best.x : 0;
                plant.z = best ? best.z : 0;
                placed.push({ x: plant.x, z: plant.z });
            });
        }

        function ensureJardConstructionSettings(j) {
            j.construction = normalizeConstructionSettings(j.construction);
            return j.construction;
        }

        function roundToOneDecimal(value) {
            return Math.round(value * 10) / 10;
        }

        function roundToTwoDecimals(value) {
            return Math.round(value * 100) / 100;
        }

        function parseLocaleNumber(value) {
            if(typeof value === 'number') return Number.isFinite(value) ? value : NaN;
            if(typeof value !== 'string') return NaN;
            const normalized = value.trim().replace(',', '.');
            return parseFloat(normalized);
        }

        function snapCuveTargetHeight(construction, rawValue) {
            const minTarget = construction.boardWidth;
            const cuveGap = getCuveBoardGap(construction);
            const stepTarget = construction.boardWidth + cuveGap;
            const maxTarget = minTarget + Math.floor((8 - minTarget) / stepTarget) * stepTarget;
            const safeRaw = Math.max(minTarget, Math.min(maxTarget, rawValue));
            const steps = Math.round((safeRaw - minTarget) / stepTarget);
            return roundToOneDecimal(minTarget + steps * stepTarget);
        }

        function formatCmFromDm(dmValue) {
            const cm = roundToOneDecimal(dmValue * 10);
            return Number.isInteger(cm) ? (cm + 'cm') : (cm.toFixed(1).replace('.', ',') + 'cm');
        }

        function formatCmMmFromDm(dmValue) {
            const cm = roundToOneDecimal(dmValue * 10);
            return cm.toFixed(1).replace('.', ',') + ' cm';
        }

        function populatePlantSelectOptions() {
            const select = document.getElementById('jard-plant-type-2d');
            select.innerHTML = '';
            
            // Get plant types in a specific order: climbing first, then pot plants
            const climbingPlants = [];
            const potPlants = [];
            
            for (const [type, preset] of Object.entries(PLANT_PRESETS)) {
                if (preset.onTreillis) {
                    climbingPlants.push(type);
                } else {
                    potPlants.push(type);
                }
            }
            
            // Sort each group alphabetically
            climbingPlants.sort();
            potPlants.sort();
            
            // Add climbing plants
            for (const type of climbingPlants) {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type + ' (Grimpant)';
                select.appendChild(option);
            }
            
            // Add pot plants
            for (const type of potPlants) {
                const option = document.createElement('option');
                option.value = type;
                option.textContent = type + ' (Bac)';
                select.appendChild(option);
            }
        }

        function computeBoardCourses(targetHeight, boardWidth, boardGap) {
            const safeTarget = Math.max(boardWidth, targetHeight || boardWidth);
            const approxCount = Math.max(1, Math.round((safeTarget + boardGap) / (boardWidth + boardGap)));
            const count = Math.max(1, approxCount);
            return {
                count,
                height: count * boardWidth + Math.max(0, count - 1) * boardGap
            };
        }

        function computeFloorSlatLayout(spanLength, slatWidth, minGap, maxGap) {
            const safeSpan = Math.max(slatWidth, spanLength);
            const maxCount = Math.max(1, Math.floor((safeSpan + minGap) / (slatWidth + minGap)));
            for(let count = maxCount; count >= 1; count--) {
                if(count === 1) {
                    if(safeSpan >= slatWidth) {
                        return { count: 1, gap: 0, usedLength: slatWidth };
                    }
                    continue;
                }
                const gap = (safeSpan - count * slatWidth) / (count - 1);
                if(gap >= minGap && gap <= maxGap) {
                    return { count, gap, usedLength: count * slatWidth + (count - 1) * gap };
                }
            }

            const fallbackCount = Math.max(1, Math.floor(safeSpan / slatWidth));
            if(fallbackCount <= 1) {
                return { count: 1, gap: 0, usedLength: Math.min(slatWidth, safeSpan) };
            }
            return {
                count: fallbackCount,
                gap: Math.max(0, (safeSpan - fallbackCount * slatWidth) / (fallbackCount - 1)),
                usedLength: safeSpan
            };
        }

        function computeJardiniereConstructionMetrics(j) {
            const construction = ensureJardConstructionSettings(j);
            const boardCourses = computeBoardCourses(construction.cuveTargetH, construction.boardWidth, getCuveBoardGap(construction));
            const cuveH = boardCourses.height;
            const outerW = j.w;
            const outerD = j.d;
            const longBoardLen = Math.max(outerW, 0.6);
            const shortBoardLen = Math.max(outerD - 2 * construction.boardThickness, 0.6);
            const lambourdeX = Math.max(outerW / 2 - construction.boardThickness - construction.lambourdeLong / 2, construction.lambourdeLong / 2);
            const lambourdeZ = Math.max(outerD / 2 - construction.boardThickness - construction.lambourdeWide / 2, construction.lambourdeWide / 2);
            const postHeight = j.legH + cuveH;
            const floorSpanX = Math.max(longBoardLen - 2 * construction.lambourdeLong, construction.floorSlatWidth);
            const floorSlats = computeFloorSlatLayout(
                floorSpanX,
                construction.floorSlatWidth,
                construction.floorMinGap,
                construction.floorMaxGap
            );
            const innerDepth = Math.max(outerD - 2 * construction.boardThickness - 2 * construction.floorInset, 0.5);
            const battenLength = Math.max(longBoardLen - 2 * construction.lambourdeLong, 0.5);
            const battenY = j.legH + construction.floorBattenHeight / 2 + 0.06;
            const slatY = battenY + construction.floorBattenHeight / 2 + construction.floorSlatThickness / 2;
            const soilTopY = j.legH + cuveH - 0.18;
            const soilY = Math.max(slatY + construction.floorSlatThickness / 2 + 0.08, soilTopY - 0.12);

            return {
                construction,
                boardCourses,
                cuveH,
                postHeight,
                outerW,
                outerD,
                longBoardLen,
                shortBoardLen,
                lambourdeX,
                lambourdeZ,
                floorSpanX,
                innerDepth,
                battenLength,
                battenY,
                slatY,
                soilY,
                soilTopY,
                floorSlats
            };
        }

        function getTreillisStyle(type) {
            const t = type || 'noisetier';
            let base;
            if(t === 'metal') {
                base = {
                    postSize: { w: 0.22, d: 0.22 },
                    railSize: { w: 0.08, h: 0.08 },
                    railCount: 11,
                    postMat: new THREE.MeshStandardMaterial({ color: 0x7e848f, metalness: 0.75, roughness: 0.35 }),
                    railMat: new THREE.MeshStandardMaterial({ color: 0x9aa0ac, metalness: 0.85, roughness: 0.25 })
                };
            } else if(t === 'bambou') {
                base = {
                    postSize: { w: 0.26, d: 0.26 },
                    railSize: { w: 0.12, h: 0.12 },
                    railCount: 8,
                    postMat: new THREE.MeshStandardMaterial({ color: 0xb38b4e, roughness: 0.72 }),
                    railMat: new THREE.MeshStandardMaterial({ color: 0xc79a57, roughness: 0.68 })
                };
            } else {
                base = {
                    postSize: { w: 0.24, d: 0.24 },
                    railSize: { w: 0.1, h: 0.1 },
                    railCount: 9,
                    postMat: new THREE.MeshStandardMaterial({ color: 0x6a4b2f, roughness: 0.84 }),
                    railMat: new THREE.MeshStandardMaterial({ color: 0x7a5a39, roughness: 0.86 })
                };
            }

            return {
                ...base,
                postSize: {
                    w: treillisDimensionOverrides.postW !== null ? treillisDimensionOverrides.postW : base.postSize.w,
                    d: treillisDimensionOverrides.postD !== null ? treillisDimensionOverrides.postD : base.postSize.d
                },
                railSize: {
                    w: treillisDimensionOverrides.railW !== null ? treillisDimensionOverrides.railW : base.railSize.w,
                    h: treillisDimensionOverrides.railH !== null ? treillisDimensionOverrides.railH : base.railSize.h
                }
            };
        }

        function addScrewPastille(parent, x, y, z, axis = 'z') {
            const screwMat = new THREE.MeshStandardMaterial({ color: 0xc8cdd4, metalness: 0.9, roughness: 0.2 });
            const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.026, 12), screwMat);
            if(axis === 'z') screw.rotation.x = Math.PI / 2;
            if(axis === 'x') screw.rotation.z = Math.PI / 2;
            screw.position.set(x, y, z);
            parent.add(screw);
        }

        function addVerticalScrewPair(parent, x, centerY, z, boardWidth, axis = 'z') {
            const edgeSetback = Math.min(Math.max(boardWidth * 0.22, 0.18), boardWidth * 0.34);
            addScrewPastille(parent, x, centerY - edgeSetback, z, axis);
            addScrewPastille(parent, x, centerY + edgeSetback, z, axis);
        }

        function buildJardiniereFabricationModel(j, metrics = null) {
            const m = metrics || computeJardiniereConstructionMetrics(j);
            const c = m.construction;
            const pieces = [];
            const screws = [];
            let pieceId = 1;

            function addPiece(family, label, L, H, T, pos, rotY = 0, holes2d = []) {
                const id = `${family.slice(0, 1).toUpperCase()}${pieceId++}`;
                const piece = { id, family, label, dim: { L, H, T }, pos, rotY, holes2d };
                pieces.push(piece);
                return piece;
            }

	            function addScrew(pieceIdRef, x, y, z, axis, diaMm = 4, role = 'Assemblage') {
	                screws.push({ pieceId: pieceIdRef, x, y, z, axis, diaMm, role });
	            }

            // Lambourdes verticales (4)
            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx, sz], idx) => {
                addPiece(
                    'Lambourde',
                    `Lambourde ${idx + 1}`,
                    c.lambourdeLong,
                    m.postHeight,
                    c.lambourdeWide,
                    { x: m.lambourdeX * sx, y: m.postHeight / 2, z: m.lambourdeZ * sz },
                    0,
                    []
                );
            });

            const boardEdge = Math.min(Math.max(c.boardWidth * 0.22, 0.18), c.boardWidth * 0.34);

            // Planches de cuve + vis associées.
            const cuveBoardGap = getCuveBoardGap(c);
            for(let index = 0; index < m.boardCourses.count; index++) {
                const boardY = j.legH + c.boardWidth / 2 + index * (c.boardWidth + cuveBoardGap);

                // Façade/arrière (rotation 0)
                [-1, 1].forEach(side => {
                    const board = addPiece(
                        'Planche',
                        side > 0 ? `Planche façade R${index + 1}` : `Planche arrière R${index + 1}`,
                        m.longBoardLen,
                        c.boardWidth,
                        c.boardThickness,
                        { x: 0, y: boardY, z: (m.outerD / 2 - c.boardThickness / 2) * side },
                        0,
                        [
                            { x: m.longBoardLen / 2 - m.lambourdeX, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                            { x: m.longBoardLen / 2 - m.lambourdeX, y: c.boardWidth / 2 + boardEdge, diaMm: 4 },
                            { x: m.longBoardLen / 2 + m.lambourdeX, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                            { x: m.longBoardLen / 2 + m.lambourdeX, y: c.boardWidth / 2 + boardEdge, diaMm: 4 }
                        ]
                    );

                    const zScrew = (m.outerD / 2 + 0.018) * side;
	                    addScrew(board.id, -m.lambourdeX, boardY - boardEdge, zScrew, 'z', 4, 'Planches cuve');
	                    addScrew(board.id, -m.lambourdeX, boardY + boardEdge, zScrew, 'z', 4, 'Planches cuve');
	                    addScrew(board.id, m.lambourdeX, boardY - boardEdge, zScrew, 'z', 4, 'Planches cuve');
	                    addScrew(board.id, m.lambourdeX, boardY + boardEdge, zScrew, 'z', 4, 'Planches cuve');
                });

                // Côtés (rotation PI/2)
                [-1, 1].forEach(side => {
                    const board = addPiece(
                        'Planche',
                        side < 0 ? `Planche gauche R${index + 1}` : `Planche droite R${index + 1}`,
                        m.shortBoardLen,
                        c.boardWidth,
                        c.boardThickness,
                        { x: (m.outerW / 2 - c.boardThickness / 2) * side, y: boardY, z: 0 },
                        Math.PI / 2,
                        [
                            { x: m.shortBoardLen / 2 - m.lambourdeZ, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                            { x: m.shortBoardLen / 2 - m.lambourdeZ, y: c.boardWidth / 2 + boardEdge, diaMm: 4 },
                            { x: m.shortBoardLen / 2 + m.lambourdeZ, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                            { x: m.shortBoardLen / 2 + m.lambourdeZ, y: c.boardWidth / 2 + boardEdge, diaMm: 4 }
                        ]
                    );

                    const xScrew = (m.outerW / 2 + 0.018) * side;
	                    addScrew(board.id, xScrew, boardY - boardEdge, -m.lambourdeZ, 'x', 4, 'Planches cuve');
	                    addScrew(board.id, xScrew, boardY + boardEdge, -m.lambourdeZ, 'x', 4, 'Planches cuve');
	                    addScrew(board.id, xScrew, boardY - boardEdge, m.lambourdeZ, 'x', 4, 'Planches cuve');
	                    addScrew(board.id, xScrew, boardY + boardEdge, m.lambourdeZ, 'x', 4, 'Planches cuve');
                });
            }

            // Tasseaux bas intérieurs (2) + vis
            [-1, 1].forEach(side => {
                const batten = addPiece(
                    'Tasseau',
                    side < 0 ? 'Tasseau bas arrière' : 'Tasseau bas façade',
                    m.battenLength,
                    c.floorBattenHeight,
                    c.floorBattenWidth,
                    {
                        x: 0,
                        y: m.battenY,
                        z: (m.outerD / 2 - c.boardThickness - c.floorBattenWidth / 2) * side
                    },
                    0,
                    []
                );

                const battenScrewZ = batten.pos.z - side * (c.floorBattenWidth / 2 + 0.016);
                const firstX = -m.battenLength / 2 + c.floorSlatWidth / 2;
                const lastX = m.battenLength / 2 - c.floorSlatWidth / 2;
                const battenScrewStep = 3.0;
                const screwXs = [firstX];
                for(let sx = firstX + battenScrewStep; sx < lastX - 0.01; sx += battenScrewStep) {
                    screwXs.push(sx);
                }
                screwXs.push(lastX);
	                screwXs.forEach(xi => addScrew(batten.id, xi, m.battenY, battenScrewZ, 'z', 4, 'Tasseaux sommier'));
            });

            // Lattes de fond (sommier)
            const slatCount = m.floorSlats.count;
            const slatGap = m.floorSlats.gap;
            const leftStartX = -m.floorSpanX / 2;
            for(let index = 0; index < slatCount; index++) {
                const centerX = leftStartX + c.floorSlatWidth / 2 + index * (c.floorSlatWidth + slatGap);
                addPiece(
                    'LatteFond',
                    `Latte fond ${index + 1}`,
                    c.floorSlatWidth,
                    c.floorSlatThickness,
                    m.innerDepth,
                    { x: centerX, y: m.slatY, z: 0 },
                    0,
                    []
                );
            }

            // Treillis : montants + rails + vis
            const treillisStyle = getTreillisStyle(j.treillisType || 'noisetier');
            const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
            const hasLeft = !!j.treillisLeft;
            const hasRight = !!j.treillisRight;
            if(hasBack || hasLeft || hasRight) {
                const postBase = m.slatY + c.floorSlatThickness / 2;
                const postH = j.treillisH + m.postHeight - postBase;
                const screwBotY = postBase + 0.3;
                const screwTopY = m.postHeight - 0.3;
                const railBottomY = m.postHeight + 1.0;
                const railTopY = j.treillisH + m.postHeight - 1.0;
                const railSpan = Math.max(0, railTopY - railBottomY);
                const railLayout = computeFloorSlatLayout(railSpan, treillisStyle.railSize.h, 1.5, 2.0);
                const trlRailCount = railLayout.count;
                const trlRailGap = railLayout.gap;

                if(hasBack) {
                    const rearBoardInnerZ = -m.outerD / 2 + c.boardThickness;
                    const rearFeetInnerFaceX = m.lambourdeX - c.lambourdeLong / 2;
                    [1, -1].forEach(px => {
                        const postX = px * (rearFeetInnerFaceX - treillisStyle.postSize.w * 0.5);
                        const postZ = rearBoardInnerZ + treillisStyle.postSize.d / 2;
                        const post = addPiece(
                            'TreillisPost',
                            `Poste treillis arrière ${px > 0 ? 'D' : 'G'}`,
                            treillisStyle.postSize.w,
                            postH,
                            treillisStyle.postSize.d,
                            { x: postX, y: postBase + postH / 2, z: postZ },
                            0,
                            []
                        );

                        const zFace = postZ + treillisStyle.postSize.d / 2 + 0.016;
                        const xFaceIn = postX - px * (treillisStyle.postSize.w / 2 + 0.016);
	                        addScrew(post.id, postX, screwBotY, zFace, 'z', 4, 'Poteaux treillis');
	                        addScrew(post.id, xFaceIn, screwBotY, postZ, 'x', 4, 'Poteaux treillis');
	                        addScrew(post.id, postX, screwTopY, zFace, 'z', 4, 'Poteaux treillis');
	                        addScrew(post.id, xFaceIn, screwTopY, postZ, 'x', 4, 'Poteaux treillis');
                    });

                    const backRailLen = Math.max(j.w - 2 * c.boardThickness, 0.1);
                    for(let i = 0; i < trlRailCount; i++) {
                        const railY = railBottomY + treillisStyle.railSize.h / 2 + i * (treillisStyle.railSize.h + trlRailGap);
	                        const rail = addPiece(
	                            'TreillisRail',
	                            `Latte treillis arrière ${i + 1}`,
	                            backRailLen,
                            treillisStyle.railSize.h,
                            treillisStyle.railSize.w,
                            { x: 0, y: railY, z: -j.d / 2 + c.boardThickness + treillisStyle.railSize.w * 0.6 },
                            0,
	                            []
	                        );
	                        const railZ = -j.d / 2 + c.boardThickness + treillisStyle.railSize.w * 0.6;
	                        const railScrewSetback = Math.min(0.35, backRailLen * 0.18);
	                        addScrew(rail.id, -backRailLen / 2 + railScrewSetback, railY, railZ, 'z', 4, 'Lattes treillis');
	                        addScrew(rail.id, backRailLen / 2 - railScrewSetback, railY, railZ, 'z', 4, 'Lattes treillis');
                    }
                }

                const sideSpanZ = Math.max(0.35, 2 * m.lambourdeZ - c.lambourdeWide - treillisStyle.postSize.d);
                [['left', hasLeft, -1], ['right', hasRight, 1]].forEach(([side, active, sideSign]) => {
                    if(!active) return;
                    const sideX = sideSign * (j.w / 2 - c.boardThickness - treillisStyle.postSize.w / 2);
                    const backZ = -m.lambourdeZ + c.lambourdeWide / 2 + treillisStyle.postSize.d / 2;
                    const frontZ = m.lambourdeZ - c.lambourdeWide / 2 - treillisStyle.postSize.d / 2;

                    [backZ, frontZ].forEach((postZ, postIdx) => {
                        const post = addPiece(
                            'TreillisPost',
                            `Poste treillis ${side} ${postIdx + 1}`,
                            treillisStyle.postSize.w,
                            postH,
                            treillisStyle.postSize.d,
                            { x: sideX, y: postBase + postH / 2, z: postZ },
                            0,
                            []
                        );

                        const xFace = sideX - sideSign * (treillisStyle.postSize.w / 2 + 0.016);
                        const zInwardSign = postZ < 0 ? 1 : -1;
                        const zFaceLat = postZ + zInwardSign * (treillisStyle.postSize.d / 2 + 0.016);
	                        addScrew(post.id, xFace, screwBotY, postZ, 'x', 4, 'Poteaux treillis');
	                        addScrew(post.id, sideX, screwBotY, zFaceLat, 'z', 4, 'Poteaux treillis');
	                        addScrew(post.id, xFace, screwTopY, postZ, 'x', 4, 'Poteaux treillis');
	                        addScrew(post.id, sideX, screwTopY, zFaceLat, 'z', 4, 'Poteaux treillis');
                    });

                    for(let i = 0; i < trlRailCount; i++) {
                        const railY = railBottomY + treillisStyle.railSize.h / 2 + i * (treillisStyle.railSize.h + trlRailGap);
	                        const rail = addPiece(
	                            'TreillisRail',
	                            `Latte treillis ${side} ${i + 1}`,
	                            sideSpanZ,
                            treillisStyle.railSize.h,
                            treillisStyle.railSize.w,
                            { x: sideX, y: railY, z: backZ + sideSpanZ / 2 },
                            Math.PI / 2,
	                            []
	                        );
	                        const railScrewSetback = Math.min(0.35, sideSpanZ * 0.18);
	                        addScrew(rail.id, sideX, railY, backZ + railScrewSetback, 'x', 4, 'Lattes treillis');
	                        addScrew(rail.id, sideX, railY, backZ + sideSpanZ - railScrewSetback, 'x', 4, 'Lattes treillis');
                    }
                });
            }

            return {
                pieces,
                screws,
                metrics: m
            };
        }
