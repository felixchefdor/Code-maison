        function addAndSelectBench() {
            saveState();
            const created = createConstruction('banc');
            if(created) selectBench(created);
        }

        function addNewBench(options = {}) {
            const idx = bancs.length;
            const bench = {
                constructionType: 'banc',
                id: options.id || makeUniquePlacementId('banc'),
                w: options.w || 15,
                d: options.d || 3.85,
                h: options.h || 5,
                woodColor: options.woodColor || '#4a3228',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('banc'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 3 : options.x, 0, options.z === undefined ? 7 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            bancs.push(bench);
            rebuildBench(bench);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return bench;
        }

        function selectBench(bench) {
            if(!bench) return;
            resetPlacementInteractionState();
            selectedPlacementObject = bench;
            selected2dBench = bench;
            selected2dJardiniere = null;
            selected2dPottedTree = null;
            selected2dCube = null;
            selected2dCornerFill = null;
            if(currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
            updateJardPanel();
            updateJard3DHighlight();
            updateJardFloatingOpenButton();
            draw2D();
        }

        function clearBenchSelection() {
            selected2dBench = null;
            if(selectedPlacementObject && getPlacementType(selectedPlacementObject) === 'banc') selectedPlacementObject = null;
        }

        function delete2dBench() {
            if(!selected2dBench) return;
            saveState();
            const idx = bancs.findIndex(b => b.id === selected2dBench.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(bancs[idx].group);
            bancs.splice(idx, 1);
            selected2dBench = null;
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dBenchDimension(prop, value, commit = true) {
            if(!selected2dBench) return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(selected2dBench, prop, val, constructionTypes.banc.resizeLimits);
            } else if(prop === 'h') {
                selected2dBench.h = Math.max(window.manualDimensionEditActive ? 0.1 : 3, Math.min(6.5, val));
            }
            refreshPlacementAfterSlider(selected2dBench, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(prop === 'w' ? 'bench-w-2d-val' : (prop === 'd' ? 'bench-d-2d-val' : 'bench-h-2d-val'));
                const current = prop === 'w' ? selected2dBench.w : (prop === 'd' ? selected2dBench.d : selected2dBench.h);
                if(label) label.textContent = String(roundToOneDecimal(current * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dBenchRotation(value, commit = true) {
            if(!selected2dBench) return;
            const deg = parseFloat(value);
            if(!Number.isFinite(deg)) return;
            if(commit) saveState();
            selected2dBench.rot = deg * Math.PI / 180;
            if(selected2dBench.group) selected2dBench.group.rotation.y = selected2dBench.rot || 0;
            if(commit) {
                rebuildBench(selected2dBench);
                updateJard3DHighlight();
                updateJardPanel();
            } else {
                const label = document.getElementById('bench-rot-2d-val');
                if(label) label.textContent = Math.round(deg) + '°';
                renderCurrent3DFrame();
            }
            draw2D();
        }

        function rebuildBench(bench) {
            if(!bench) return;
            (balconySceneGroup || scene).remove(bench.group);
            disposeGroup(bench.group);
            const group = new THREE.Group();
            bench.group = group;
            group.position.copy(bench.pos);
            group.rotation.y = bench.rot || 0;
            group.userData.bench = bench;
            const settings = getDefaultConstructionSettings();
            const mat = new THREE.MeshStandardMaterial({ color: bench.woodColor || '#4a3228', roughness: 0.72 });
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const legLong = settings.lambourdeLong;
            const legWide = settings.lambourdeWide;
            const treillisPost = getTreillisStyle('noisetier').postSize;
            const seatY = Math.max(bench.h - boardT / 2, boardT / 2);
            const seatLayout = getBenchSeatBoardLayout(bench, settings);
            const boardCount = seatLayout.count;
            const pitch = seatLayout.boardW + seatLayout.gap;
            const firstZ = -seatLayout.totalDepth / 2 + seatLayout.boardW / 2;
            for(let i = 0; i < boardCount; i++) {
                const z = firstZ + i * pitch;
                addOrientedBox(group, bench.w, boardT, seatLayout.boardW, mat, 0, seatY, z, 0, true, true);
            }
            const legH = Math.max(bench.h - boardT, 0.5);
            const xInset = Math.max(bench.w / 2 - legLong / 2 - 0.45, legLong / 2);
            const zInset = Math.max(bench.d / 2 - legWide / 2 - 0.35, legWide / 2);
            [-1, 1].forEach(xs => {
                [-1, 1].forEach(zs => {
                    addOrientedBox(group, legLong, legH, legWide, mat, xs * xInset, legH / 2, zs * zInset, 0, true, true);
                });
            });
            const supportY = Math.max(bench.h - boardT - treillisPost.w / 2, treillisPost.w / 2);
            const frameDepth = Math.min(bench.d, seatLayout.totalDepth);
            const supportXInset = Math.max(xInset - legLong / 2 - treillisPost.d / 2, treillisPost.d / 2);
            const supportZInset = zInset;
            const longSupportLength = Math.max(bench.w - 2 * legLong - 0.9, 0.5);
            const shortSupportLength = Math.max(2 * (zInset - legWide / 2), 0.5);
            addOrientedBox(group, longSupportLength, treillisPost.w, treillisPost.d, mat, 0, supportY, -supportZInset, 0, true, true);
            addOrientedBox(group, longSupportLength, treillisPost.w, treillisPost.d, mat, 0, supportY, supportZInset, 0, true, true);
            addOrientedBox(group, shortSupportLength, treillisPost.w, treillisPost.d, mat, -supportXInset, supportY, 0, Math.PI / 2, true, true);
            addOrientedBox(group, shortSupportLength, treillisPost.w, treillisPost.d, mat, supportXInset, supportY, 0, Math.PI / 2, true, true);
            (balconySceneGroup || scene).add(group);
        }

        function collectBenchCutGroups(items = []) {
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const boardProfile = `Planches cuve ${dmToCm(settings.boardThickness)} x ${dmToCm(settings.boardWidth)} cm`;
            const lambProfile = getLambourdeProfileLabel(settings);
            const treillisPost = getTreillisStyle('noisetier').postSize;
            const postProfile = `Poteaux treillis ${dmToCm(treillisPost.w)} x ${dmToCm(treillisPost.d)} cm`;
            const boardMeta = { familyKey: 'benchSeatBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(settings.boardWidth) };
            const lambMeta = { familyKey: 'benchLambourdes', sectionAcm: dmToCm(settings.lambourdeLong), sectionBcm: dmToCm(settings.lambourdeWide) };
            const postMeta = { familyKey: 'treillisPosts', sectionAcm: dmToCm(treillisPost.w), sectionBcm: dmToCm(treillisPost.d) };
            const addPiece = (profile, label, lengthCm, qty, meta) => {
                if(qty <= 0 || lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            };
            items.forEach((bench, index) => {
                const seatLayout = getBenchSeatBoardLayout(bench, settings);
                const boardCount = seatLayout.count;
                const legLong = settings.lambourdeLong;
                const legWide = settings.lambourdeWide;
                const xInset = Math.max(bench.w / 2 - legLong / 2 - 0.45, legLong / 2);
                const zInset = Math.max(bench.d / 2 - legWide / 2 - 0.35, legWide / 2);
                const longSupportLength = Math.max(bench.w - 2 * legLong - 0.9, 0.5);
                const shortSupportLength = Math.max(2 * (zInset - legWide / 2), 0.5);
                addPiece(boardProfile, `Banc ${index + 1} - assise (${dmToCm(bench.w)} cm)`, dmToCm(bench.w), boardCount, boardMeta);
                addPiece(lambProfile, `Banc ${index + 1} - pieds (${dmToCm(Math.max(bench.h - settings.boardThickness, 0.5))} cm)`, dmToCm(Math.max(bench.h - settings.boardThickness, 0.5)), 4, lambMeta);
                addPiece(postProfile, `Banc ${index + 1} - renforts longs (${dmToCm(longSupportLength)} cm)`, dmToCm(longSupportLength), 2, postMeta);
                addPiece(postProfile, `Banc ${index + 1} - renforts courts (${dmToCm(shortSupportLength)} cm)`, dmToCm(shortSupportLength), 2, postMeta);
            });
            return groups;
        }

        constructionTypes.banc = {
            label: 'Banc simple',
            getItems: () => bancs,
            create: addNewBench,
            rebuild: rebuildBench,
            resizeLimits: { wMin: 8, wMax: 22, dMin: 2.5, dMax: 7 },
            collectCutGroups: collectBenchCutGroups
        };

        function addAndSelectPottedTree() {
            saveState();
            const created = createConstruction('pottedTree');
            if(created) selectPottedTree(created);
        }

        function addNewPottedTree(options = {}) {
            const idx = pottedTrees.length;
            const diameter = typeof options.diameter === 'number' ? options.diameter : 5;
            const tree = {
                constructionType: 'pottedTree',
                id: options.id || makeUniquePlacementId('pottedTree'),
                diameter,
                w: diameter,
                d: diameter,
                h: typeof options.h === 'number' ? options.h : 12,
                ageYears: Math.max(1, Math.min(12, Math.round(typeof options.ageYears === 'number' ? options.ageYears : 5))),
                shape: options.shape === 'square' ? 'square' : 'round',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('pottedTree'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.5 : options.x, 0, options.z === undefined ? 12 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            pottedTrees.push(tree);
            rebuildPottedTree(tree);
            updateJardPanel();
            draw2D();
            return tree;
        }

        function selectPottedTree(tree) {
            if(!tree) return;
            resetPlacementInteractionState();
            selectedPlacementObject = tree;
            selected2dPottedTree = tree;
            selected2dBench = null;
            selected2dCube = null;
            selected2dJardiniere = null;
            selected2dCornerFill = null;
            if(currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
            updateJardPanel();
            updateJard3DHighlight();
            updateJardFloatingOpenButton();
            draw2D();
        }

        function delete2dPottedTree() {
            if(!selected2dPottedTree) return;
            saveState();
            const idx = pottedTrees.findIndex(t => t.id === selected2dPottedTree.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(pottedTrees[idx].group);
            pottedTrees.splice(idx, 1);
            selected2dPottedTree = null;
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dPottedTreeDiameter(value, commit = true) {
            if(!selected2dPottedTree) return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            const diameter = Math.max(window.manualDimensionEditActive ? 0.1 : 3.5, Math.min(12, val));
            const anchor = getJardTopLeftWorld(selected2dPottedTree);
            selected2dPottedTree.diameter = diameter;
            selected2dPottedTree.w = diameter;
            selected2dPottedTree.d = diameter;
            setJardCenterFromTopLeftWorld(selected2dPottedTree, anchor.x, anchor.y);
            refreshPlacementAfterSlider(selected2dPottedTree, commit);
            if(commit) updateJardPanel();
            else {
                const label = document.getElementById('tree-diameter-2d-val');
                if(label) label.textContent = String(roundToOneDecimal(diameter * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dPottedTreeAge(value, commit = true) {
            if(!selected2dPottedTree) return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            const ageYears = Math.max(1, Math.min(12, Math.round(val)));
            selected2dPottedTree.ageYears = ageYears;
            rebuildPottedTree(selected2dPottedTree);
            if(commit) {
                updateJardPanel();
                updateJard3DHighlight();
            } else {
                const label = document.getElementById('tree-age-2d-val');
                if(label) label.textContent = ageYears + ' ans';
                renderCurrent3DFrame();
            }
            draw2D();
        }

        function update2dPottedTreeShape(shape) {
            if(!selected2dPottedTree) return;
            saveState();
            selected2dPottedTree.shape = shape === 'square' ? 'square' : 'round';
            rebuildPottedTree(selected2dPottedTree);
            updateJard3DHighlight();
            draw2D();
        }

        function makeTreeCylinder(radiusTop, radiusBottom, height, color, radialSegments = 24) {
            const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radialSegments, 1);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.82 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        function makeTreeLathe(points, color, radialSegments = 48) {
            const geo = new THREE.LatheGeometry(points.map(p => new THREE.Vector2(p[0], p[1])), radialSegments);
            const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.88 });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            return mesh;
        }

        function rebuildPottedTree(tree) {
            if(!tree) return;
            (balconySceneGroup || scene).remove(tree.group);
            disposeGroup(tree.group);
            const group = new THREE.Group();
            tree.group = group;
            tree.w = tree.d = tree.diameter || tree.w || 5;
            tree.h = 12;
            group.position.copy(tree.pos);
            group.rotation.y = tree.rot || 0;
            group.userData.pottedTree = tree;

            const diameter = tree.diameter || 5;
            const radius = diameter / 2;
            const potMat = new THREE.MeshStandardMaterial({ color: 0xb86f45, roughness: 0.92 });
            const potEdgeMat = new THREE.MeshStandardMaterial({ color: 0xd08b58, roughness: 0.88 });
            const soilMat = new THREE.MeshStandardMaterial({ color: 0x2e2118, roughness: 0.96 });
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.90 });
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x3a5c28, side: THREE.DoubleSide, roughness: 0.82 });
            const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x527a35, side: THREE.DoubleSide, roughness: 0.84 });
            const leafMat3 = new THREE.MeshStandardMaterial({ color: 0x6e9447, side: THREE.DoubleSide, roughness: 0.86 });
            const potH = Math.max(3.15, Math.min(4.9, diameter * 0.8));
            let soilSurfaceY = potH + 0.18;

            if(tree.shape === 'square') {
                addOrientedBox(group, diameter, potH, diameter, potMat, 0, potH / 2, 0, 0, true, true);
                addOrientedBox(group, diameter * 0.88, 0.16, diameter * 0.88, soilMat, 0, potH + 0.10, 0, 0, true, true);
            } else {
                const potProfile = [
                    [radius * 0.67, 0.03],
                    [radius * 0.80, 0.10],
                    [radius * 0.86, 0.24],
                    [radius * 0.75, 0.42],
                    [radius * 0.68, 0.72],
                    [radius * 0.78, potH * 0.50],
                    [radius * 0.90, potH - 0.58],
                    [radius * 1.00, potH - 0.20],
                    [radius * 1.07, potH + 0.02],
                    [radius * 1.04, potH + 0.27],
                    [radius * 0.92, potH + 0.42],
                ];
                const pot = makeTreeLathe(potProfile, 0xb86f45, 64);
                group.add(pot);
                const rimHighlight = makeTreeLathe([
                    [radius * 0.94, potH + 0.28],
                    [radius * 1.04, potH + 0.31],
                    [radius * 1.00, potH + 0.38],
                    [radius * 0.90, potH + 0.42],
                ], 0xd08b58, 64);
                rimHighlight.material = potEdgeMat;
                group.add(rimHighlight);
                const soil = makeTreeCylinder(radius * 0.82, radius * 0.82, 0.12, 0x2e2118, 48);
                soil.position.y = potH + 0.30;
                soilSurfaceY = potH + 0.36;
                group.add(soil);
            }

            function addBranch(from, to, radiusBase, radiusTop) {
                const dir = new THREE.Vector3(to.x - from.x, to.y - from.y, to.z - from.z);
                const len = dir.length();
                if(len <= 0.01) return;
                const branch = new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBase, len, 8), trunkMat);
                branch.position.set((from.x + to.x) / 2, (from.y + to.y) / 2, (from.z + to.z) / 2);
                branch.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
                branch.castShadow = true;
                group.add(branch);
            }

            const wallHeightDm = (typeof archHeights !== 'undefined' ? (archHeights.wall || 250) : 250) / 10;
            const ceilingY = (typeof archOptions !== 'undefined' && archOptions.ceiling)
                ? Math.max(10, wallHeightDm)
                : Math.max(20, Math.min(23.5, wallHeightDm - 1.5));
            const treeRootY = soilSurfaceY + 0.04;
            const maxTreeTopY = Math.max(treeRootY + 8, ceilingY - 0.7);
            const ageYears = Math.max(1, Math.min(12, Math.round(tree.ageYears || 5)));
            const ageT = (ageYears - 1) / 11;
            const treeSize = 5;
            const trunkRadius = 0.24 + ageT * 0.24;
            const trunkBaseY = treeRootY;
            const targetTopY = Math.min(maxTreeTopY, treeRootY + 5.8 + treeSize * 0.18 + ageT * (8.8 + treeSize * 0.42));
            const crownR = Math.max(1.7, Math.min(treeSize * (0.42 + ageT * 0.52), (targetTopY - treeRootY) * (0.30 - ageT * 0.05)));
            const crownH = crownR * (0.78 + ageT * 0.08);
            const trunkH = Math.max(3.0 + ageT * 2.4, (targetTopY - trunkBaseY) * (0.48 + ageT * 0.14));
            const trunkTopY = trunkBaseY + trunkH;
            tree.ageYears = ageYears;
            tree.h = Math.max(potH, targetTopY);

            addBranch({x:0, y:trunkBaseY, z:0}, {x:0.06 + ageT * 0.06, y:trunkTopY, z:0.04 + ageT * 0.04}, trunkRadius, trunkRadius * 0.54);

            const seed = Number(String(tree.id || '').replace(/\D/g, '').slice(-5)) || 12345;
            const allLeafAnchors = [];
            const primaryCount = Math.max(4, Math.round(4 + ageT * 6));
            const secondaryStart = ageYears >= 4 ? 1 : 99;
            for(let i = 0; i < primaryCount; i++) {
                const levelT = primaryCount <= 1 ? 0.5 : i / (primaryCount - 1);
                const heightT = 0.16 + levelT * (0.62 + ageT * 0.08);
                const branchY = trunkBaseY + trunkH * heightT;
                const angle = seed * 0.013 + i * 2.38 + seededUnit(seed, i * 31) * 0.7;
                const spread = crownR * (1.10 - levelT * 0.34) * (0.80 + seededUnit(seed, i * 29) * 0.22);
                const lift = crownH * (0.16 + levelT * 0.32 + seededUnit(seed, i * 37) * 0.12);
                const from = { x: 0.06 * Math.cos(angle + Math.PI), y: branchY, z: 0.06 * Math.sin(angle + Math.PI) };
                const elbow = {
                    x: Math.cos(angle) * spread * 0.46,
                    y: branchY + lift * 0.42,
                    z: Math.sin(angle) * spread * 0.46
                };
                const tip = {
                    x: Math.cos(angle) * spread,
                    y: Math.min(targetTopY - 0.3, branchY + lift),
                    z: Math.sin(angle) * spread
                };
                const baseR = trunkRadius * (0.50 - levelT * 0.16);
                addBranch(from, elbow, baseR, baseR * 0.64);
                addBranch(elbow, tip, baseR * 0.64, Math.max(0.035, baseR * 0.20));
                allLeafAnchors.push({ ...tip, weight: 1.0 - levelT * 0.25 });
                if(i >= secondaryStart) {
                    const sideCount = ageYears >= 8 && i % 2 === 0 ? 2 : 1;
                    for(let sidx = 0; sidx < sideCount; sidx++) {
                        const side = sidx === 0 ? 1 : -1;
                        const sideAngle = angle + side * (0.72 + seededUnit(seed, i * 53 + sidx) * 0.42);
                        const start = {
                            x: elbow.x * (0.72 + 0.10 * sidx),
                            y: elbow.y + lift * 0.10,
                            z: elbow.z * (0.72 + 0.10 * sidx)
                        };
                        const sideLen = spread * (0.28 + seededUnit(seed, i * 59 + sidx) * 0.18) * (0.65 + ageT * 0.35);
                        const sideTip = {
                            x: start.x + Math.cos(sideAngle) * sideLen,
                            y: Math.min(targetTopY - 0.25, start.y + crownH * (0.10 + levelT * 0.12)),
                            z: start.z + Math.sin(sideAngle) * sideLen
                        };
                        addBranch(start, sideTip, baseR * 0.34, Math.max(0.028, baseR * 0.12));
                        allLeafAnchors.push({ ...sideTip, weight: 0.62 });
                    }
                }
            }
            const topCount = Math.max(2, Math.round(2 + ageT * 3));
            for(let i = 0; i < topCount; i++) {
                const angle = seed * 0.017 + i * (Math.PI * 2 / topCount) + seededUnit(seed, 200 + i) * 0.42;
                const start = { x: 0.05, y: trunkTopY - trunkH * (0.18 - ageT * 0.08) + i * 0.08, z: 0.03 };
                const tip = {
                    x: Math.cos(angle) * crownR * (0.25 + seededUnit(seed, 220 + i) * 0.22),
                    y: Math.min(targetTopY, trunkTopY + crownH * (0.42 + seededUnit(seed, 240 + i) * 0.30)),
                    z: Math.sin(angle) * crownR * (0.25 + seededUnit(seed, 260 + i) * 0.22)
                };
                addBranch(start, tip, trunkRadius * 0.24, 0.035);
                allLeafAnchors.push({ ...tip, weight: 0.78 });
            }

            const leafShape = new THREE.Shape();
            const s = 0.44;
            leafShape.moveTo(0, s);
            leafShape.quadraticCurveTo(s * 0.54, s * 0.54, s * 0.36, 0);
            leafShape.quadraticCurveTo(s * 0.16, -s * 0.27, 0, -s * 0.42);
            leafShape.quadraticCurveTo(-s * 0.16, -s * 0.27, -s * 0.36, 0);
            leafShape.quadraticCurveTo(-s * 0.54, s * 0.54, 0, s);
            const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
            const leafMats = [leafMat, leafMat2, leafMat3];
            const clusters = allLeafAnchors.map((tip, ti) => ({
                x: tip.x * 1.05,
                y: Math.min(targetTopY - crownR * 0.10, tip.y + 0.24),
                z: tip.z * 1.05,
                rx: crownR * (0.22 + tip.weight * 0.18 + seededUnit(seed, ti * 13) * 0.12),
                ry: crownR * (0.14 + tip.weight * 0.12 + seededUnit(seed, ti * 17) * 0.08),
                rz: crownR * (0.22 + tip.weight * 0.18 + seededUnit(seed, ti * 19) * 0.12),
            }));
            clusters.forEach((cluster, ci) => {
                const leafCount = Math.round(6 + ageT * 6 + (cluster.ry / Math.max(crownR, 0.1)) * 6);
                for(let i = 0; i < leafCount; i++) {
                    const salt = ci * 100 + i * 7;
                    const a = seededUnit(seed, salt) * Math.PI * 2;
                    const r = Math.sqrt(seededUnit(seed, salt + 1));
                    const leaf = new THREE.Mesh(leafGeo, leafMats[(ci + i) % leafMats.length]);
                    leaf.position.set(
                        cluster.x + Math.cos(a) * r * cluster.rx,
                        cluster.y + (seededUnit(seed, salt + 2) - 0.5) * cluster.ry,
                        cluster.z + Math.sin(a) * r * cluster.rz
                    );
                    leaf.rotation.set(
                        -0.2 + seededUnit(seed, salt + 3) * 0.75,
                        a + Math.PI / 2,
                        -0.55 + seededUnit(seed, salt + 4) * 1.1
                    );
                    leaf.scale.set(0.85 + seededUnit(seed, salt + 5) * 0.70, 1.0 + seededUnit(seed, salt + 6) * 0.55, 1);
                    leaf.castShadow = true;
                    leaf.receiveShadow = true;
                    group.add(leaf);
                }
            });

            (balconySceneGroup || scene).add(group);
        }

        function collectPottedTreeCutGroups() {
            return new Map();
        }

        constructionTypes.pottedTree = {
            label: 'Arbre en pot',
            getItems: () => pottedTrees,
            create: addNewPottedTree,
            rebuild: rebuildPottedTree,
            resizeLimits: { wMin: 4, wMax: 14, dMin: 4, dMax: 14 },
            collectCutGroups: collectPottedTreeCutGroups
        };

        function addAndSelectCubeTest() {
            saveState();
            const created = createConstruction('cube');
            if(created) selectCube(created);
        }

        function addNewCube(options = {}) {
            const idx = cubes.length;
            const cube = {
                constructionType: 'cube',
                id: options.id || makeUniquePlacementId('cube'),
                w: typeof options.w === 'number' ? options.w : 19,
                d: typeof options.d === 'number' ? options.d : 8,
                h: typeof options.h === 'number' ? options.h : 7.2,
                color: options.color || '#b9793f',
                armBack: options.armBack !== false,
                armSide: options.armSide !== false,
                mattress: options.mattress !== false,
                cushions: options.cushions !== false,
                fabricColor: options.fabricColor || '#d8d1bd',
                mattressColor: options.mattressColor || options.fabricColor || '#d8d1bd',
                cushionColor: options.cushionColor || '#c8bfa8',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('cube'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.5 : options.x, 0, options.z === undefined ? 10 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            cubes.push(cube);
            rebuildCube(cube);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return cube;
        }

        function selectCube(cube) {
            if(!cube) return;
            resetPlacementInteractionState();
            selectedPlacementObject = cube;
            selected2dCube = cube;
            selected2dPottedTree = null;
            selected2dBench = null;
            selected2dJardiniere = null;
            selected2dCornerFill = null;
            if(currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
            updateJardPanel();
            updateJard3DHighlight();
            updateJardFloatingOpenButton();
            draw2D();
        }

        function delete2dCube() {
            if(!selected2dCube) return;
            saveState();
            const idx = cubes.findIndex(c => c.id === selected2dCube.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(cubes[idx].group);
            cubes.splice(idx, 1);
            selected2dCube = null;
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dCubeDimension(prop, value, commit = true) {
            if(!selected2dCube) return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(selected2dCube, prop, val, constructionTypes.cube.resizeLimits);
            } else if(prop === 'h') {
                selected2dCube.h = Math.max(window.manualDimensionEditActive ? 0.1 : 4.5, Math.min(9.5, val));
            }
            refreshPlacementAfterSlider(selected2dCube, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(prop === 'w' ? 'cube-w-2d-val' : (prop === 'd' ? 'cube-d-2d-val' : 'cube-h-2d-val'));
                const current = prop === 'w' ? selected2dCube.w : (prop === 'd' ? selected2dCube.d : selected2dCube.h);
                if(label) label.textContent = String(roundToOneDecimal(current * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dCubeColor(color, commit = true) {
            if(!selected2dCube || !color) return;
            if(commit) saveState();
            selected2dCube.color = color;
            rebuildCube(selected2dCube);
            updateCubePaletteUI(color);
            updateJard3DHighlight();
            refreshFabricationAndPricing();
            draw2D();
        }

        function setCubeColorPreset(color) {
            const input = document.getElementById('cube-color-2d');
            if(input) input.value = color;
            update2dCubeColor(color, true);
        }

        function updateMeridienneOption(key, value) {
            if(!selected2dCube) return;
            saveState();
            if(key === 'fabricColor' || key === 'mattressColor') {
                selected2dCube.mattressColor = value || '#d8d1bd';
                selected2dCube.fabricColor = selected2dCube.mattressColor;
            } else if(key === 'cushionColor') {
                selected2dCube.cushionColor = value || '#c8bfa8';
            }
            else selected2dCube[key] = !!value;
            rebuildCube(selected2dCube);
            updateJard3DHighlight();
            updateJardPanel();
            draw2D();
        }

        function rebuildCube(cube) {
            if(!cube) return;
            (balconySceneGroup || scene).remove(cube.group);
            disposeGroup(cube.group);
            const group = new THREE.Group();
            cube.group = group;
            group.position.copy(cube.pos);
            group.rotation.y = cube.rot || 0;
            group.userData.cube = cube;
            buildMeridienneModel(group, cube);
            (balconySceneGroup || scene).add(group);
        }

        function addMeridienneScrews(group, points, axis = 'y') {
            points.forEach(p => addScrewPastille(group, p[0], p[1], p[2], axis));
        }

        function computeMeridienneMetrics(cube, settings = getDefaultConstructionSettings()) {
            const w = Math.max(10, Math.min(26, cube.w || 19));
            const d = Math.max(5.5, Math.min(11, cube.d || 8));
            const h = Math.max(4.5, Math.min(9.5, cube.h || 7.2));
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const lambL = settings.lambourdeLong;
            const lambW = settings.lambourdeWide;
            const battenW = settings.floorBattenWidth;
            const battenH = settings.floorBattenHeight;
            const slatW = settings.floorSlatWidth;
            const slatT = settings.floorSlatThickness;
            const legH = Math.max(2.4, Math.min(3.4, h * 0.42));
            const frameCenterY = legH + boardW / 2;
            const battenY = legH + battenH / 2 + 0.08;
            const slatY = battenY + battenH / 2 + slatT / 2;
            const innerW = Math.max(w - 2 * boardT - 2 * lambL, slatW);
            const innerD = Math.max(d - 2 * boardT - 0.12, 0.6);
            const slatLayout = computeFloorSlatLayout(innerW, slatW, settings.floorMinGap, settings.floorMaxGap);
            const slatStartX = -slatLayout.usedLength / 2 + slatW / 2;
            const battenZ = d / 2 - boardT - battenW / 2;
            const legX = Math.max(w / 2 - boardT - lambL / 2, lambL / 2);
            const legZ = Math.max(d / 2 - boardT - lambW / 2, lambW / 2);
            const armShelfW = 0.82;
            const armTopY = Math.max(h - 0.18, slatY + 1.4);
            const armSupportH = Math.max(0.7, armTopY - frameCenterY);
            return { w, d, h, settings, boardT, boardW, lambL, lambW, battenW, battenH, slatW, slatT, legH, frameCenterY, battenY, slatY, innerW, innerD, slatLayout, slatStartX, battenZ, legX, legZ, armShelfW, armTopY, armSupportH };
        }

        function buildMeridienneFabricationModel(cube, metrics = null) {
            const m = metrics || computeMeridienneMetrics(cube);
            const c = m.settings;
            const pieces = [];
            const screws = [];
            let pieceId = 1;
            const boardEdge = Math.min(Math.max(c.boardWidth * 0.22, 0.18), c.boardWidth * 0.34);

            function addPiece(family, label, L, H, T, pos, rotY = 0, holes2d = []) {
                const id = `${family.slice(0, 1).toUpperCase()}${pieceId++}`;
                const piece = { id, family, label, dim: { L, H, T }, pos, rotY, holes2d };
                pieces.push(piece);
                return piece;
            }
            function addScrew(pieceIdRef, x, y, z, axis, diaMm = 4, role = 'Assemblage méridienne') {
                screws.push({ pieceId: pieceIdRef, x, y, z, axis, diaMm, role });
            }

            [-1, 1].forEach(side => {
                const board = addPiece('Planche', side > 0 ? 'Planche façade' : 'Planche arrière', m.w, c.boardWidth, c.boardThickness, { x: 0, y: m.frameCenterY, z: (m.d / 2 - c.boardThickness / 2) * side }, 0, [
                    { x: c.boardThickness + m.lambL / 2, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                    { x: c.boardThickness + m.lambL / 2, y: c.boardWidth / 2 + boardEdge, diaMm: 4 },
                    { x: m.w - c.boardThickness - m.lambL / 2, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                    { x: m.w - c.boardThickness - m.lambL / 2, y: c.boardWidth / 2 + boardEdge, diaMm: 4 }
                ]);
                [-m.legX, m.legX].forEach(x => {
                    addScrew(board.id, x, m.frameCenterY - boardEdge, side * (m.d / 2 + 0.018), 'z', 4, 'Cadre méridienne');
                    addScrew(board.id, x, m.frameCenterY + boardEdge, side * (m.d / 2 + 0.018), 'z', 4, 'Cadre méridienne');
                });
            });
            [-1, 1].forEach(side => {
                const board = addPiece('Planche', side < 0 ? 'Planche côté gauche' : 'Planche côté droit', m.d - 2 * c.boardThickness, c.boardWidth, c.boardThickness, { x: side * (m.w / 2 - c.boardThickness / 2), y: m.frameCenterY, z: 0 }, Math.PI / 2, [
                    { x: m.lambW / 2, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                    { x: m.lambW / 2, y: c.boardWidth / 2 + boardEdge, diaMm: 4 },
                    { x: m.d - 2 * c.boardThickness - m.lambW / 2, y: c.boardWidth / 2 - boardEdge, diaMm: 4 },
                    { x: m.d - 2 * c.boardThickness - m.lambW / 2, y: c.boardWidth / 2 + boardEdge, diaMm: 4 }
                ]);
                [-m.legZ, m.legZ].forEach(z => {
                    addScrew(board.id, side * (m.w / 2 + 0.018), m.frameCenterY - boardEdge, z, 'x', 4, 'Cadre méridienne');
                    addScrew(board.id, side * (m.w / 2 + 0.018), m.frameCenterY + boardEdge, z, 'x', 4, 'Cadre méridienne');
                });
            });

            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx, sz], idx) => {
                addPiece('Lambourde', `Pied ${idx + 1}`, c.lambourdeLong, m.legH + c.boardWidth, c.lambourdeWide, { x: sx * m.legX, y: (m.legH + c.boardWidth) / 2, z: sz * m.legZ }, 0, []);
            });
            if(m.w > 18) {
                [-1, 1].forEach((side, idx) => addPiece('Lambourde', `Pied central ${idx + 1}`, c.lambourdeLong, m.legH + c.boardWidth, c.lambourdeWide, { x: 0, y: (m.legH + c.boardWidth) / 2, z: side * m.legZ }, 0, []));
            }

            [-1, 1].forEach(side => {
                const batten = addPiece('Tasseau', side > 0 ? 'Tasseau porte-lattes avant' : 'Tasseau porte-lattes arrière', Math.max(m.w - 2 * c.lambourdeLong, 0.5), c.floorBattenHeight, c.floorBattenWidth, { x: 0, y: m.battenY, z: side * m.battenZ }, 0, []);
                [-m.legX, 0, m.legX].forEach(x => addScrew(batten.id, x, m.battenY, side * (m.battenZ + c.floorBattenWidth / 2 + 0.018), 'z', 4, 'Tasseaux méridienne'));
            });

            for(let i = 0; i < m.slatLayout.count; i++) {
                const x = m.slatStartX + i * (c.floorSlatWidth + m.slatLayout.gap);
                const slat = addPiece('LatteFond', `Latte sommier ${i + 1}`, c.floorSlatWidth, c.floorSlatThickness, m.innerD, { x, y: m.slatY, z: 0 }, Math.PI / 2, [
                    { x: m.innerD / 2 - m.battenZ, y: c.floorSlatThickness / 2, diaMm: 4 },
                    { x: m.innerD / 2 + m.battenZ, y: c.floorSlatThickness / 2, diaMm: 4 }
                ]);
                [-m.battenZ, m.battenZ].forEach(z => addScrew(slat.id, x, m.slatY + c.floorSlatThickness / 2 + 0.018, z, 'y', 4, 'Lattes sommier méridienne'));
            }

            const armPanelBottom = m.frameCenterY + c.boardWidth / 2;
            const armPanelH = Math.max(0.4, m.armTopY - armPanelBottom);
            if(cube.armBack !== false) {
                addPiece('Lambourde', 'Tablette accoudoir arrière', m.w, 0.24, m.armShelfW, { x: 0, y: m.armTopY, z: -m.d / 2 - m.armShelfW / 2 + c.boardThickness }, 0, []);
                addPiece('Planche', 'Panneau accoudoir arrière', m.w, armPanelH, c.boardThickness, { x: 0, y: armPanelBottom + armPanelH / 2, z: -m.d / 2 + c.boardThickness / 2 }, 0, []);
            }
            if(cube.armSide !== false) {
                addPiece('Lambourde', 'Tablette accoudoir côté', m.d, 0.24, m.armShelfW, { x: -m.w / 2 - m.armShelfW / 2 + c.boardThickness, y: m.armTopY, z: 0 }, Math.PI / 2, []);
                addPiece('Planche', 'Panneau accoudoir côté', m.d, armPanelH, c.boardThickness, { x: -m.w / 2 + c.boardThickness / 2, y: armPanelBottom + armPanelH / 2, z: 0 }, Math.PI / 2, []);
            }

            const mattressClearance = 0.04;
            const mattressW = Math.max(0.5, m.w - c.boardThickness * 2 - mattressClearance);
            const mattressD = Math.max(0.5, m.d - c.boardThickness * 2 - mattressClearance);
            const mattressWcm = dmToCm(mattressW);
            const mattressDcm = dmToCm(mattressD);
            if(cube.mattress !== false) {
                addPiece('Tissu', `Matelas extérieur ${mattressWcm} x ${mattressDcm} cm`, mattressW, 1.34, mattressD, { x: 0, y: m.slatY + c.floorSlatThickness / 2 + 0.82, z: 0 }, 0, []);
            }
            if(cube.cushions !== false) {
                addPiece('Tissu', 'Coussin dossier', 2.60, 1.70, 0.58, { x: -m.w * 0.22, y: m.slatY + 1.44, z: -m.d / 2 + c.boardThickness + 0.33 }, 0, []);
                addPiece('Tissu', 'Coussin dossier', 2.40, 1.62, 0.56, { x: m.w * 0.06, y: m.slatY + 1.46, z: -m.d / 2 + c.boardThickness + 0.36 }, 0, []);
                addPiece('Tissu', 'Coussin côté', 1.78, 0.92, 0.50, { x: -m.w / 2 + c.boardThickness + 0.38, y: m.slatY + 1.16, z: -m.d * 0.02 }, Math.PI / 2, []);
                addPiece('Tissu', 'Coussin côté', 1.62, 0.86, 0.46, { x: -m.w / 2 + c.boardThickness + 0.42, y: m.slatY + 1.58, z: -m.d * 0.08 }, Math.PI / 2, []);
            }

            return { pieces, screws };
        }

        function buildBancFabricationModel(bench) {
            if(!bench) return null;
            const settings = getDefaultConstructionSettings();
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const gap = settings.boardGap || 0;
            const legLong = settings.lambourdeLong;
            const legWide = settings.lambourdeWide;
            const treillisPost = getTreillisStyle('noisetier').postSize;
            const pieces = [];
            let pieceId = 1;
            function addPiece(family, label, L, H, T, pos, rotY = 0) {
                const id = `B${pieceId++}`;
                pieces.push({ id, family, label, dim: { L, H, T }, pos, rotY, holes2d: [] });
            }

            const seatLayout = getBenchSeatBoardLayout(bench, settings);
            const seatY = Math.max(bench.h - boardT / 2, boardT / 2);
            const firstZ = -seatLayout.totalDepth / 2 + boardW / 2;
            for(let i = 0; i < seatLayout.count; i++) {
                addPiece('Planche', `Latte assise ${i + 1}`, bench.w, boardT, boardW, { x: 0, y: seatY, z: firstZ + i * (boardW + gap) });
            }

            const legH = Math.max(bench.h - boardT, 0.5);
            const xInset = Math.max(bench.w / 2 - legLong / 2 - 0.45, legLong / 2);
            const zInset = Math.max(bench.d / 2 - legWide / 2 - 0.35, legWide / 2);
            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([xs, zs], i) => {
                addPiece('Lambourde', `Pied ${i + 1}`, legLong, legH, legWide, { x: xs * xInset, y: legH / 2, z: zs * zInset });
            });

            const frameDepth = Math.min(bench.d, seatLayout.totalDepth);
            const supportY = Math.max(bench.h - boardT - treillisPost.w / 2, treillisPost.w / 2);
            const supportXInset = Math.max(bench.w / 2 - legLong / 2 - treillisPost.d / 2, treillisPost.d / 2);
            const supportZInset = Math.max(frameDepth / 2 - treillisPost.d / 2, treillisPost.d / 2);
            const longSupportLen = Math.max(bench.w - legLong * 2, 0.5);
            const shortSupportLen = Math.max(frameDepth - treillisPost.d * 2, 0.5);
            addPiece('Tasseau', 'Renfort long avant', longSupportLen, treillisPost.w, treillisPost.d, { x: 0, y: supportY, z: -supportZInset });
            addPiece('Tasseau', 'Renfort long arrière', longSupportLen, treillisPost.w, treillisPost.d, { x: 0, y: supportY, z: supportZInset });
            addPiece('Tasseau', 'Renfort court gauche', shortSupportLen, treillisPost.w, treillisPost.d, { x: -supportXInset, y: supportY, z: 0 }, Math.PI / 2);
            addPiece('Tasseau', 'Renfort court droit', shortSupportLen, treillisPost.w, treillisPost.d, { x: supportXInset, y: supportY, z: 0 }, Math.PI / 2);

            return { pieces, screws: [] };
        }

        function buildTableFabricationModel(table) {
            if(!table) return null;
            const settings = getDefaultConstructionSettings();
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const legLong = settings.lambourdeLong;
            const legWide = settings.lambourdeWide;
            const pieces = [];
            let pieceId = 1;
            function addPiece(family, label, L, H, T, pos, rotY = 0) {
                const id = `T${pieceId++}`;
                pieces.push({ id, family, label, dim: { L, H, T }, pos, rotY, holes2d: [] });
            }

            const topCount = Math.max(2, Math.ceil(table.d / Math.max(boardW + settings.boardGap, 0.1)));
            const topGap = topCount > 1 ? Math.max(0.04, (table.d - topCount * boardW) / (topCount - 1)) : 0;
            const topY = Math.max(boardT / 2, table.h - boardT / 2);
            const firstZ = -table.d / 2 + boardW / 2;
            for(let i = 0; i < topCount; i++) {
                addPiece('Planche', `Latte plateau ${i + 1}`, table.w, boardT, boardW, { x: 0, y: topY, z: firstZ + i * (boardW + topGap) });
            }

            const legH = Math.max(0.8, table.h - boardT);
            const xInset = Math.max(table.w / 2 - legLong / 2 - 0.35, legLong / 2);
            const zInset = Math.max(table.d / 2 - legWide / 2 - 0.35, legWide / 2);
            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([xs, zs], i) => {
                addPiece('Lambourde', `Pied ${i + 1}`, legLong, legH, legWide, { x: xs * xInset, y: legH / 2, z: zs * zInset });
            });

            const braceY = Math.max(table.h - boardT - legLong / 2, legLong / 2);
            const longBrace = Math.max(table.w - legLong * 2, 0.5);
            const shortBrace = Math.max(table.d - legLong * 2, 0.5);
            addPiece('Lambourde', 'Traverse longue avant', longBrace, legLong, legWide, { x: 0, y: braceY, z: zInset });
            addPiece('Lambourde', 'Traverse longue arrière', longBrace, legLong, legWide, { x: 0, y: braceY, z: -zInset });
            addPiece('Lambourde', 'Traverse courte gauche', shortBrace, legLong, legWide, { x: -xInset, y: braceY, z: 0 }, Math.PI / 2);
            addPiece('Lambourde', 'Traverse courte droite', shortBrace, legLong, legWide, { x: xInset, y: braceY, z: 0 }, Math.PI / 2);

            return { pieces, screws: [] };
        }

        function getChairSeatSlatLayout(chair, settings = getDefaultConstructionSettings()) {
            const seatDepth = Math.max(2.8, chair.d * 0.72);
            const targetSlatW = Math.min(settings.boardWidth, 0.82);
            const gap = Math.max(settings.boardGap || 0.05, 0.06);
            const count = Math.max(3, Math.ceil((seatDepth + gap) / Math.max(targetSlatW + gap, 0.1)));
            const slatW = Math.max(0.55, (seatDepth - gap * (count - 1)) / count);
            const totalDepth = count * slatW + Math.max(0, count - 1) * gap;
            const centerZ = Math.min(chair.d * 0.04, 0.18);
            const firstZ = centerZ - totalDepth / 2 + slatW / 2;
            return { count, slatW, gap, totalDepth, firstZ };
        }

        function getChairJoineryMetrics(chair, settings = getDefaultConstructionSettings()) {
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const legLong = settings.lambourdeLong;
            const legWide = settings.lambourdeWide;
            const seatH = Math.max(3.8, Math.min(5, chair.h * 0.54));
            const seatLayout = getChairSeatSlatLayout(chair, settings);
            const legH = Math.max(0.8, seatH - boardT / 2);
            const xInset = Math.max(chair.w / 2 - legLong / 2 - 0.28, legLong / 2);
            const frontZ = chair.d / 2 - legWide / 2 - 0.35;
            const backZ = -chair.d / 2 + legWide / 2 + 0.35;
            const innerW = Math.max(chair.w - 2 * legLong - 0.56, 0.5);
            const innerD = Math.max(frontZ - backZ - legWide, 0.5);
            const sideX = xInset - (legLong - legWide) / 2;
            const apronY = Math.max(seatH - boardT / 2 - legLong / 2, legLong / 2);
            const lowY = Math.max(1.15, Math.min(apronY - legLong * 1.05, seatH * 0.38));
            const cleatH = settings.floorBattenHeight || 0.35;
            const cleatW = settings.floorBattenWidth || 0.35;
            const cleatX = Math.max(xInset - legLong / 2 - cleatW / 2, cleatW / 2);
            const cleatY = Math.max(seatH - boardT / 2 - cleatH / 2 - 0.04, cleatH / 2);
            const backSlatW = Math.max(innerW, Math.min(chair.w, 2 * xInset + legLong));
            const backSlatH = Math.min(Math.max(boardW * 0.55, 0.72), 0.9);
            const backSlatZ = backZ + legWide / 2 + boardT / 2;
            return {
                boardT, boardW, legLong, legWide,
                seatH, seatLayout, legH, xInset, frontZ, backZ,
                innerW, innerD, sideX, apronY, lowY,
                cleatH, cleatW, cleatX, cleatY,
                backSlatW, backSlatH, backSlatZ
            };
        }

        function buildChairFabricationModel(chair) {
            if(!chair) return null;
            const settings = getDefaultConstructionSettings();
            const m = getChairJoineryMetrics(chair, settings);
            const pieces = [];
            let pieceId = 1;
            function addPiece(family, label, L, H, T, pos, rotY = 0) {
                const id = `C${pieceId++}`;
                pieces.push({ id, family, label, dim: { L, H, T }, pos, rotY, holes2d: [] });
            }

            for(let i = 0; i < m.seatLayout.count; i++) {
                addPiece('Planche', `Latte assise ${i + 1}`, chair.w, m.boardT, m.seatLayout.slatW, { x: 0, y: m.seatH, z: m.seatLayout.firstZ + i * (m.seatLayout.slatW + m.seatLayout.gap) });
            }

            [-1, 1].forEach((xs, i) => {
                addPiece('Lambourde', `Pied avant ${i + 1}`, m.legLong, m.legH, m.legWide, { x: xs * m.xInset, y: m.legH / 2, z: m.frontZ });
                addPiece('Lambourde', `Montant arrière ${i + 1}`, m.legLong, Math.max(chair.h, m.legH), m.legWide, { x: xs * m.xInset, y: chair.h / 2, z: m.backZ });
                addPiece('Tasseau', `Tasseau porte-lattes ${i < 1 ? 'gauche' : 'droit'}`, m.innerD, m.cleatH, m.cleatW, { x: xs * m.cleatX, y: m.cleatY, z: (m.frontZ + m.backZ) / 2 }, Math.PI / 2);
            });

            [0.64, 0.78, 0.92].forEach((t, i) => {
                addPiece('Planche', `Latte dossier ${i + 1}`, m.backSlatW, m.backSlatH, m.boardT, { x: 0, y: Math.min(chair.h * t, chair.h - m.backSlatH / 2), z: m.backSlatZ });
            });

            addPiece('Lambourde', 'Ceinture avant', m.innerW, m.legLong, m.legWide, { x: 0, y: m.apronY, z: m.frontZ });
            addPiece('Lambourde', 'Ceinture arrière', m.innerW, m.legLong, m.legWide, { x: 0, y: m.apronY, z: m.backZ });
            addPiece('Lambourde', 'Ceinture latérale gauche', m.innerD, m.legLong, m.legWide, { x: -m.sideX, y: m.apronY, z: (m.frontZ + m.backZ) / 2 }, Math.PI / 2);
            addPiece('Lambourde', 'Ceinture latérale droite', m.innerD, m.legLong, m.legWide, { x: m.sideX, y: m.apronY, z: (m.frontZ + m.backZ) / 2 }, Math.PI / 2);
            addPiece('Lambourde', 'Entretoise basse avant', m.innerW, m.legLong, m.legWide, { x: 0, y: m.lowY, z: m.frontZ });
            addPiece('Lambourde', 'Entretoise basse arrière', m.innerW, m.legLong, m.legWide, { x: 0, y: m.lowY, z: m.backZ });
            addPiece('Lambourde', 'Entretoise basse gauche', m.innerD, m.legLong, m.legWide, { x: -m.sideX, y: m.lowY, z: (m.frontZ + m.backZ) / 2 }, Math.PI / 2);
            addPiece('Lambourde', 'Entretoise basse droite', m.innerD, m.legLong, m.legWide, { x: m.sideX, y: m.lowY, z: (m.frontZ + m.backZ) / 2 }, Math.PI / 2);

            return { pieces, screws: [] };
        }

        function createOutdoorFabricMaterial(color = '#d8d1bd') {
            const canvas = document.createElement('canvas');
            canvas.width = 512;
            canvas.height = 512;
            const ctx = canvas.getContext('2d');
            const base = new THREE.Color(color || '#d8d1bd');
            const highlight = base.clone().lerp(new THREE.Color(0xffffff), 0.16);
            const shade = base.clone().multiplyScalar(0.86);
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height * 0.8);
            grad.addColorStop(0, highlight.getStyle());
            grad.addColorStop(0.55, base.getStyle());
            grad.addColorStop(1, shade.getStyle());
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for(let y = 0; y < canvas.height; y += 18) {
                ctx.globalAlpha = 0.018;
                ctx.strokeStyle = y % 36 === 0 ? '#ffffff' : '#000000';
                ctx.beginPath();
                ctx.moveTo(0, y + 0.5);
                ctx.lineTo(canvas.width, y + 0.5);
                ctx.stroke();
            }
            ctx.globalAlpha = 1;
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(0.24, 0.18);
            texture.colorSpace = THREE.SRGBColorSpace;
            return new THREE.MeshStandardMaterial({ map: texture, color: 0xffffff, roughness: 0.88, metalness: 0.0, side: THREE.FrontSide });
        }

        function createRoundedMattressGeometry(len, h, depth) {
            const geo = new THREE.BoxGeometry(len, h, depth, 64, 16, 44);
            const pos = geo.attributes.position;
            const radiusX = Math.max(0.01, len / 2);
            const radiusY = Math.max(0.01, h / 2);
            const radiusZ = Math.max(0.01, depth / 2);
            const bevel = 0.1; // 1 cm, unités modèle = décimètres.
            for(let i = 0; i < pos.count; i++) {
                const x = pos.getX(i);
                const y = pos.getY(i);
                const z = pos.getZ(i);
                const sx = Math.sign(x);
                const sy = Math.sign(y);
                const sz = Math.sign(z);
                const ax = Math.abs(x);
                const ay = Math.abs(y);
                const az = Math.abs(z);
                const bx = Math.max(0, ax - (radiusX - bevel));
                const by = Math.max(0, ay - (radiusY - bevel));
                const bz = Math.max(0, az - (radiusZ - bevel));
                const cornerLen = Math.hypot(bx, by, bz);
                if(cornerLen > bevel && cornerLen > 0.0001) {
                    const k = bevel / cornerLen;
                    pos.setX(i, sx * ((radiusX - bevel) + bx * k));
                    pos.setY(i, sy * ((radiusY - bevel) + by * k));
                    pos.setZ(i, sz * ((radiusZ - bevel) + bz * k));
                } else {
                    pos.setY(i, y + Math.max(0, y / radiusY) * Math.max(0, 1 - (ax / radiusX) ** 2) * h * 0.025);
                }
            }
            geo.computeVertexNormals();
            return geo;
        }

        function createPillowGeometry(len, h, depth, xSegments = 16, ySegments = 12) {
            const vertices = [];
            const indices = [];
            const frontIndex = [];
            const backIndex = [];
            function addVertex(x, y, z) {
                vertices.push(x, y, z);
                return vertices.length / 3 - 1;
            }
            for(let side = 0; side < 2; side++) {
                const grid = side === 0 ? frontIndex : backIndex;
                const sign = side === 0 ? 1 : -1;
                for(let iy = 0; iy <= ySegments; iy++) {
                    grid[iy] = [];
                    const v = -1 + (iy / ySegments) * 2;
                    for(let ix = 0; ix <= xSegments; ix++) {
                        const u = -1 + (ix / xSegments) * 2;
                        const edgeFalloff = Math.max(0, (1 - Math.pow(Math.abs(u), 2.8)) * (1 - Math.pow(Math.abs(v), 2.8)));
                        const cornerPinch = 0.55 + 0.45 * edgeFalloff;
                        const x = u * len / 2 * (0.985 + 0.015 * edgeFalloff);
                        const y = v * h / 2 * (0.985 + 0.015 * edgeFalloff);
                        const z = sign * depth / 2 * cornerPinch;
                        grid[iy][ix] = addVertex(x, y, z);
                    }
                }
                for(let iy = 0; iy < ySegments; iy++) {
                    for(let ix = 0; ix < xSegments; ix++) {
                        const a = grid[iy][ix];
                        const b = grid[iy][ix + 1];
                        const c = grid[iy + 1][ix + 1];
                        const d = grid[iy + 1][ix];
                        if(side === 0) indices.push(a, b, d, b, c, d);
                        else indices.push(a, d, b, b, d, c);
                    }
                }
            }
            for(let ix = 0; ix < xSegments; ix++) {
                indices.push(frontIndex[0][ix], backIndex[0][ix], frontIndex[0][ix + 1], frontIndex[0][ix + 1], backIndex[0][ix], backIndex[0][ix + 1]);
                indices.push(frontIndex[ySegments][ix], frontIndex[ySegments][ix + 1], backIndex[ySegments][ix], frontIndex[ySegments][ix + 1], backIndex[ySegments][ix + 1], backIndex[ySegments][ix]);
            }
            for(let iy = 0; iy < ySegments; iy++) {
                indices.push(frontIndex[iy][0], frontIndex[iy + 1][0], backIndex[iy][0], frontIndex[iy + 1][0], backIndex[iy + 1][0], backIndex[iy][0]);
                indices.push(frontIndex[iy][xSegments], backIndex[iy][xSegments], frontIndex[iy + 1][xSegments], frontIndex[iy + 1][xSegments], backIndex[iy][xSegments], backIndex[iy + 1][xSegments]);
            }
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();
            return geo;
        }

        function addSoftBox(group, len, h, depth, material, x, y, z, angle = 0) {
            const mesh = makeShadowMesh(createRoundedMattressGeometry(len, h, depth), material, true, true);
            mesh.position.set(x, y, z);
            mesh.rotation.y = -angle;
            group.add(mesh);
            return mesh;
        }

        function addPillow(group, len, h, depth, material, x, y, z, angle = 0) {
            const pillowGroup = new THREE.Group();
            pillowGroup.position.set(x, y, z);
            pillowGroup.rotation.y = -angle;
            group.add(pillowGroup);
            const pillow = makeShadowMesh(createPillowGeometry(len, h, depth, 32, 24), material, true, true);
            pillowGroup.add(pillow);

            const seamMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
            const pts = [
                new THREE.Vector3(-len * 0.48, -h * 0.48, depth * 0.28),
                new THREE.Vector3(len * 0.48, -h * 0.48, depth * 0.28),
                new THREE.Vector3(len * 0.48, h * 0.48, depth * 0.28),
                new THREE.Vector3(-len * 0.48, h * 0.48, depth * 0.28),
                new THREE.Vector3(-len * 0.48, -h * 0.48, depth * 0.28)
            ];
            const seam = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), seamMat);
            pillowGroup.add(seam);
            return pillowGroup;
        }

        function buildMeridienneModel(group, cube) {
            const m = computeMeridienneMetrics(cube);
            const w = m.w;
            const d = m.d;
            const h = m.h;
            cube.w = w;
            cube.d = d;
            cube.h = h;
            cube.armBack = cube.armBack !== false;
            cube.armSide = cube.armSide !== false;
            cube.mattress = true;
            cube.cushions = cube.cushions !== false;
            cube.fabricColor = cube.fabricColor || '#d8d1bd';
            cube.mattressColor = cube.mattressColor || cube.fabricColor || '#d8d1bd';
            cube.cushionColor = cube.cushionColor || '#c8bfa8';
            const woodColor = cube.color || '#b9793f';
            const settings = m.settings;
            const boardMat = new THREE.MeshStandardMaterial({ color: woodColor, roughness: 0.74 });
            const lambMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(woodColor).multiplyScalar(0.74), roughness: 0.82 });
            const slatMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(woodColor).multiplyScalar(1.12), roughness: 0.78 });
            const fabricMat = createOutdoorFabricMaterial(cube.mattressColor);
            const cushionMat = createOutdoorFabricMaterial(cube.cushionColor);

            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const boardGap = settings.boardGap;
            const lambL = settings.lambourdeLong;
            const lambW = settings.lambourdeWide;
            const battenW = settings.floorBattenWidth;
            const battenH = settings.floorBattenHeight;
            const slatW = settings.floorSlatWidth;
            const slatT = settings.floorSlatThickness;
            const legH = m.legH;
            const frameCenterY = m.frameCenterY;
            const battenY = m.battenY;
            const slatY = m.slatY;
            const innerD = m.innerD;
            const battenZ = m.battenZ;

            // Cadre robuste: mêmes planches que la cuve, posées à la verticale.
            addOrientedBox(group, w, boardW, boardT, boardMat, 0, frameCenterY, d / 2 - boardT / 2, 0, true, true);
            addOrientedBox(group, w, boardW, boardT, boardMat, 0, frameCenterY, -d / 2 + boardT / 2, 0, true, true);
            addOrientedBox(group, d - 2 * boardT, boardW, boardT, boardMat, -w / 2 + boardT / 2, frameCenterY, 0, Math.PI / 2, true, true);
            addOrientedBox(group, d - 2 * boardT, boardW, boardT, boardMat, w / 2 - boardT / 2, frameCenterY, 0, Math.PI / 2, true, true);

            // Pieds: traversent le cadre pour que les vis du cadre s'y ancrent.
            const legX = m.legX;
            const legZ = m.legZ;
            const piedH = legH + boardW;
            [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(([sx, sz]) => {
                addOrientedBox(group, lambL, piedH, lambW, lambMat, sx * legX, piedH / 2, sz * legZ, 0, true, true);
            });
            if(w > 18) {
                addOrientedBox(group, lambL, piedH, lambW, lambMat, 0, piedH / 2, legZ, 0, true, true);
                addOrientedBox(group, lambL, piedH, lambW, lambMat, 0, piedH / 2, -legZ, 0, true, true);
            }

            // Tasseaux porte-lattes, mêmes sections que le sommier de jardinière.
            [-1, 1].forEach(side => {
                addOrientedBox(group, Math.max(w - 2 * boardT - 2 * lambL, 0.5), battenH, battenW, lambMat, 0, battenY, side * battenZ, 0, true, true);
            });

            // Lattes de sommier: mêmes lattes et mêmes règles d'espacement que les jardinières.
            for(let i = 0; i < m.slatLayout.count; i++) {
                const x = m.slatStartX + i * (slatW + m.slatLayout.gap);
                addOrientedBox(group, slatW, slatT, innerD, slatMat, x, slatY, 0, 0, true, true);
                if(i % 2 === 0) {
                    addMeridienneScrews(group, [[x, slatY + slatT / 2 + 0.018, battenZ], [x, slatY + slatT / 2 + 0.018, -battenZ]], 'y');
                }
            }

            const armShelfW = m.armShelfW;
            const armTopY = m.armTopY;
            const armSupportH = m.armSupportH;
            const armPanelBottom = frameCenterY + boardW / 2;
            const armPanelH = Math.max(0.4, armTopY - armPanelBottom);
            if(cube.armBack) {
                const z = -d / 2 - armShelfW / 2 + boardT;
                addOrientedBox(group, w, 0.24, armShelfW, lambMat, 0, armTopY, z, 0, true, true);
                addOrientedBox(group, w, armPanelH, boardT, boardMat, 0, armPanelBottom + armPanelH / 2, -d / 2 + boardT / 2, 0, true, true);
            }
            if(cube.armSide) {
                const x = -w / 2 - armShelfW / 2 + boardT;
                addOrientedBox(group, armShelfW, 0.24, d, lambMat, x, armTopY, 0, 0, true, true);
                addOrientedBox(group, boardT, armPanelH, d, boardMat, -w / 2 + boardT / 2, armPanelBottom + armPanelH / 2, 0, 0, true, true);
            }

            const mattressH = 1.34;
            const mattressCenterY = slatY + slatT / 2 + 0.82;
            const mattressTopY = mattressCenterY + mattressH / 2;
            const mattressClearance = 0.04;
            const mattressLen = Math.max(0.5, w - boardT * 2 - mattressClearance);
            const mattressDepth = Math.max(0.5, d - boardT * 2 - mattressClearance);
            const mattress = addSoftBox(group, mattressLen, mattressH, mattressDepth, fabricMat, 0, mattressCenterY, 0);
            if(cube.cushions) {
                const backZ = -d / 2 + boardT + 0.33;
                const backY = mattressTopY + 0.76;
                const backLeft = addPillow(group, 2.60, 1.70, 0.58, cushionMat, -w * 0.22, backY, backZ, 0.02);
                backLeft.rotation.x = -0.20;
                const backRight = addPillow(group, 2.40, 1.62, 0.56, cushionMat, w * 0.06, backY + 0.02, backZ + 0.03, -0.035);
                backRight.rotation.x = -0.18;
                const sideY = mattressTopY + 0.48;
                const sideBase = addPillow(group, 1.78, 0.92, 0.50, cushionMat, -w / 2 + boardT + 0.38, sideY, -d * 0.02, Math.PI / 2 - 0.08);
                sideBase.rotation.z = -0.06;
                const sideTop = addPillow(group, 1.62, 0.86, 0.46, cushionMat, -w / 2 + boardT + 0.42, sideY + 0.42, -d * 0.08, Math.PI / 2 + 0.04);
                sideTop.rotation.z = 0.06;
            }

            const screwEdge = Math.min(Math.max(boardW * 0.22, 0.18), boardW * 0.34);
            addMeridienneScrews(group, [
                [-legX, frameCenterY - screwEdge, d / 2 - boardT - 0.018],
                [-legX, frameCenterY + screwEdge, d / 2 - boardT - 0.018],
                [legX, frameCenterY - screwEdge, d / 2 - boardT - 0.018],
                [legX, frameCenterY + screwEdge, d / 2 - boardT - 0.018],
                [-legX, frameCenterY - screwEdge, -d / 2 + boardT + 0.018],
                [-legX, frameCenterY + screwEdge, -d / 2 + boardT + 0.018],
                [legX, frameCenterY - screwEdge, -d / 2 + boardT + 0.018],
                [legX, frameCenterY + screwEdge, -d / 2 + boardT + 0.018]
            ], 'z');
        }

        function collectCubeCutGroups(items = cubes) {
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const boardProfile = `Planches cuve ${dmToCm(settings.boardThickness)} x ${dmToCm(settings.boardWidth)} cm`;
            const lambProfile = getLambourdeProfileLabel(settings);
            const battenProfile = `Tasseaux bas ${dmToCm(settings.floorBattenHeight)} x ${dmToCm(settings.floorBattenWidth)} cm`;
            const slatProfile = `Lattes fond ${dmToCm(settings.floorSlatThickness)} x ${dmToCm(settings.floorSlatWidth)} cm`;
            const fabricProfile = 'Tissu extérieur / mousse méridienne';
            const boardMeta = { familyKey: 'cuveBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(settings.boardWidth) };
            const lambMeta = { familyKey: 'lambourdes', sectionAcm: dmToCm(settings.lambourdeLong), sectionBcm: dmToCm(settings.lambourdeWide) };
            const battenMeta = { familyKey: 'floorBattens', sectionAcm: dmToCm(settings.floorBattenHeight), sectionBcm: dmToCm(settings.floorBattenWidth) };
            const slatMeta = { familyKey: 'floorSlats', sectionAcm: dmToCm(settings.floorSlatThickness), sectionBcm: dmToCm(settings.floorSlatWidth) };
            const fabricMeta = { familyKey: 'meridienneFabric', unitType: 'item', qty: 0 };
            const addLength = (profile, label, lengthCm, meta) => {
                if(lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                entry.lengths.push(lengthCm);
            };
            const addFabric = (label, qty) => {
                if(qty <= 0) return;
                if(!groups.has(fabricProfile)) groups.set(fabricProfile, { profile: fabricProfile, labels: new Set(), lengths: [], meta: { ...fabricMeta, qty: 0 } });
                const entry = groups.get(fabricProfile);
                entry.labels.add(label);
                entry.meta.qty += qty;
            };
            (items || []).forEach((cube, index) => {
                const model = buildMeridienneFabricationModel(cube);
                (model.pieces || []).forEach(piece => {
                    const label = `Méridienne ${index + 1} - ${piece.label}`;
                    if(piece.family === 'Planche') addLength(boardProfile, label, dmToCm(piece.dim.L), boardMeta);
                    else if(piece.family === 'Lambourde') addLength(lambProfile, label, dmToCm(piece.dim.L), lambMeta);
                    else if(piece.family === 'Tasseau') addLength(battenProfile, label, dmToCm(piece.dim.L), battenMeta);
                    else if(piece.family === 'LatteFond') addLength(slatProfile, label, dmToCm(piece.dim.L), slatMeta);
                    else if(piece.family === 'Tissu') addFabric(label, 1);
                });
            });
            return groups;
        }

        constructionTypes.cube = {
            label: 'Méridienne',
            getItems: () => cubes,
            create: addNewCube,
            rebuild: rebuildCube,
            resizeLimits: { wMin: 10, wMax: 26, dMin: 5.5, dMax: 11 },
            collectCutGroups: collectCubeCutGroups
        };

        function addAndSelectCornerFill() {
            saveState();
            const created = createConstruction('cornerFill');
            if(created) selectPlacementObject(created);
        }

        function getCornerFillAngleDeg(fill) {
            const raw = fill && typeof fill.angleDeg === 'number' ? fill.angleDeg : 75;
            return Math.max(45, Math.min(135, raw));
        }

        function getCornerFillSkew(fill) {
            const angle = getCornerFillAngleDeg(fill);
            const skew = Math.tan((90 - angle) * Math.PI / 180) * (fill.d || 5.5);
            return Math.max(-(fill.w || 8) * 0.65, Math.min((fill.w || 8) * 0.65, skew));
        }

        function getCornerFillLocalPoints(fill) {
            if(fill && Array.isArray(fill.shapePoints) && fill.shapePoints.length >= 3) {
                return fill.shapePoints
                    .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z))
                    .map(p => ({ x: p.x, z: p.z }));
            }
            const w = Math.max(0.1, fill.w || 8);
            const d = Math.max(0.1, fill.d || 5.5);
            const skew = getCornerFillSkew(fill);
            return [
                { x: -w / 2, z: -d / 2 },
                { x: w / 2, z: -d / 2 },
                { x: w / 2 + skew, z: d / 2 },
                { x: -w / 2, z: d / 2 }
            ];
        }

        function getCornerFillEdges(fill) {
            const points = getCornerFillLocalPoints(fill);
            return points.map((a, i) => {
                const b = points[(i + 1) % points.length];
                return {
                    a,
                    b,
                    len: Math.hypot(b.x - a.x, b.z - a.z),
                    angle: Math.atan2(b.z - a.z, b.x - a.x),
                    mid: { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }
                };
            });
        }

        function getCornerFillSpanAtZ(fill, z) {
            const points = getCornerFillLocalPoints(fill);
            const xs = [];
            for(let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                if(Math.abs(a.z - b.z) < 0.0001) continue;
                const minZ = Math.min(a.z, b.z);
                const maxZ = Math.max(a.z, b.z);
                if(z < minZ || z > maxZ) continue;
                const t = (z - a.z) / (b.z - a.z);
                if(t < -0.0001 || t > 1.0001) continue;
                xs.push(a.x + (b.x - a.x) * t);
            }
            if(xs.length < 2) {
                const fallback = points.map(p => p.x);
                return { minX: Math.min(...fallback), maxX: Math.max(...fallback) };
            }
            xs.sort((a, b) => a - b);
            return { minX: xs[0], maxX: xs[xs.length - 1] };
        }

        function addCornerFillDeckSlats(group, fill, material, y, thickness, inset = 0.18) {
            const points = getCornerFillLocalPoints(fill);
            const minZ = Math.min(...points.map(p => p.z));
            const maxZ = Math.max(...points.map(p => p.z));
            const settings = getDefaultConstructionSettings();
            const slatW = Math.max(0.38, settings.floorSlatWidth || 0.9);
            const count = Math.max(2, Math.floor((maxZ - minZ - inset * 2) / Math.max(slatW + settings.boardGap, 0.1)));
            const total = count * slatW + Math.max(0, count - 1) * settings.boardGap;
            const start = -total / 2 + slatW / 2;
            for(let i = 0; i < count; i++) {
                const z = start + i * (slatW + settings.boardGap);
                const span = getCornerFillSpanAtZ(fill, z);
                const len = Math.max(0.35, span.maxX - span.minX - inset * 2);
                addOrientedBox(group, len, thickness, slatW * 0.82, material, (span.minX + span.maxX) / 2, y, z, 0, true, true);
            }
        }

        function addCornerArrangementPolygonSlat(group, fill, worldPoints, material, y, thickness) {
            if(!Array.isArray(worldPoints) || worldPoints.length < 3) return null;
            const local = worldPoints.map(p => ({
                x: (p.x - fill.pos.x * 20) / 20,
                z: (p.y - fill.pos.z * 20) / 20
            }));
            const pts = local.map(p => new THREE.Vector2(p.x, p.z));
            // Calculer l'aire signée pour garantir le sens anti-horaire requis par THREE.Shape (face vers +Y après rotateX)
            let signedArea = 0;
            for(let i = 0; i < pts.length; i++) {
                const a = pts[i], b = pts[(i + 1) % pts.length];
                signedArea += a.x * b.y - b.x * a.y;
            }
            // signedArea < 0 → sens horaire → inverser pour avoir CCW
            const shape = new THREE.Shape(signedArea < 0 ? [...pts].reverse() : pts);
            const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
            // rotateX(PI/2) : XY → XZ, face avant (z=0) monte en topY
            geo.rotateX(Math.PI / 2);
            geo.translate(0, y + thickness / 2, 0);
            const mesh = new THREE.Mesh(geo, material);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            group.add(mesh);
            return mesh;
        }

        function addCornerArrangementBranchDeckSlats(group, fill, material, y, thickness, inset = 0.18) {
            if(!fill || !fill.sourceCorner || typeof getCornerArrangementBasis !== 'function') return false;
            const basis = getCornerArrangementBasis(fill.sourceCorner);
            if(!basis) return false;
            const settings = getDefaultConstructionSettings();
            const slatW = Math.max(0.38, settings.floorSlatWidth || 0.9);
            const gap = Math.max(settings.boardGap || 0.12, 0.05);
            if(typeof getCornerArrangementSlatPolygons2D === 'function') {
                const slats = getCornerArrangementSlatPolygons2D(fill, {
                    spacing: (slatW + gap) * 20,
                    slatWidth: slatW * 20,
                    inset: inset * 20
                });
                if(slats.length) {
                    slats.forEach(slat => addCornerArrangementPolygonSlat(group, fill, slat.points, material, y, thickness));
                    return true;
                }
            }
            const localFromWorld = (p) => ({
                x: (p.x - fill.pos.x * 20) / 20,
                z: (p.y - fill.pos.z * 20) / 20
            });
            const addBranch = (dir, normal, lenCm, depthCm, enabled, startCm = 0) => {
                if(enabled === false) return;
                const lenDm = Math.max(4, lenCm / 10);
                const depthDm = Math.max(2.5, depthCm / 10);
                const startDm = Math.max(0, Math.min(lenDm - 0.4, startCm / 10));
                const usableLen = Math.max(slatW, lenDm - startDm - inset * 2);
                const count = Math.max(1, Math.floor((usableLen + gap) / Math.max(slatW + gap, 0.1)));
                const total = count * slatW + Math.max(0, count - 1) * gap;
                const start = startDm + Math.max(inset + slatW / 2, (lenDm - startDm - total) / 2 + slatW / 2);
                const slatLen = Math.max(0.35, depthDm - inset * 2);
                const angle = Math.atan2(normal.y, normal.x);
                for(let i = 0; i < count; i++) {
                    const alongCm = (start + i * (slatW + gap)) * 10;
                    const centerWorld = add2D(add2D(basis.corner, dir, alongCm * 2), normal, depthCm);
                    const local = localFromWorld(centerWorld);
                    addOrientedBox(group, slatLen, thickness, slatW * 0.82, material, local.x, y, local.z, angle, true, true);
                }
            };
            const layout = basis.layout;
            const hasA = layout.enabledA !== false;
            const hasB = layout.enabledB !== false;
            const primary = !hasA ? 'B' : (!hasB ? 'A' : ((layout.lenA || 0) >= (layout.lenB || 0) ? 'A' : 'B'));
            const depthA = layout.depthA || layout.depth || 55;
            const depthB = layout.depthB || layout.depth || 55;
            addBranch(basis.dirA, basis.nA, layout.lenA || 100, depthA, layout.enabledA, primary === 'B' ? depthB : 0);
            addBranch(basis.dirB, basis.nB, layout.lenB || 100, depthB, layout.enabledB, primary === 'A' ? depthA : 0);
            return true;
        }

        function addCornerFillSidePanels(group, fill, material) {
            const settings = getDefaultConstructionSettings();
            const boardH = settings.boardWidth;
            const boardT = settings.boardThickness;
            const edges = getCornerFillEdges(fill);
            const panelBottom = Math.max(settings.floorBattenHeight + 0.08, 0.35);
            const panelTop = Math.max(panelBottom + boardH, (fill.h || 5.5) - settings.lambourdeWide - 0.08);
            const usableH = Math.max(boardH, panelTop - panelBottom);
            const sideBoardGap = getCuveBoardGap(settings);
            const count = Math.max(1, Math.ceil((usableH + sideBoardGap) / Math.max(boardH + sideBoardGap, 0.1)));
            // Pour les aménagements d'angle : masquer arêtes mur-adjacent et encoches intérieures
            // La structure connue de buildCornerArrangementWorldPoints :
            //   6 pts : [coin, wallA, frontA, inner, frontB, wallB]
            //   → garder E1(wallA→frontA) et E4(frontB→wallB), sauter 0,2,3,5
            //   5 pts (pas d'inner) : [coin, wallA, frontA, frontB, wallB] → sauter 0 et 4
            //   4 pts (un seul bras) : [coin, wall, front, root]          → sauter 0 et 3
            //   rounded (≥12 pts) : [coin, wallA, frontA, arcs..., frontB, wallB] → sauter 0 et n-1
            const skipEdges = new Set();
            const isLockedArr = fill.sourceCorner && typeof isLockedCornerArrangementObject === 'function' && isLockedCornerArrangementObject(fill);
            const n = edges.length;
            if(isLockedArr && n === 6) {
                skipEdges.add(0); skipEdges.add(2); skipEdges.add(3); skipEdges.add(5);
            } else if(isLockedArr && n === 5) {
                skipEdges.add(0); skipEdges.add(4);
            } else if(isLockedArr && n === 4) {
                skipEdges.add(0); skipEdges.add(3);
            } else if(isLockedArr && n >= 4) {
                skipEdges.add(0); skipEdges.add(n - 1);
            }
            edges.forEach((edge, edgeIndex) => {
                if(skipEdges.has(edgeIndex)) return;
                const clearLen = Math.max(0.5, edge.len - settings.lambourdeLong * 0.9);
                const isRoundedFront = fill.faceStyle === 'rounded' && edgeIndex > 0 && edgeIndex < edges.length - 1;
                if(isRoundedFront) {
                    const qty = Math.max(1, Math.ceil(clearLen / Math.max(settings.floorBattenWidth + settings.boardGap, 0.1)));
                    for(let i = 0; i < qty; i++) {
                        const t = qty === 1 ? 0.5 : i / (qty - 1);
                        const x = edge.a.x + (edge.b.x - edge.a.x) * t;
                        const z = edge.a.z + (edge.b.z - edge.a.z) * t;
                        addOrientedBox(group, settings.floorBattenWidth, Math.max(0.6, panelTop - panelBottom), boardT, material, x, (panelTop + panelBottom) / 2, z, edge.angle, true, true);
                    }
                    return;
                }
                const firstY = panelBottom + boardH / 2;
                for(let i = 0; i < count; i++) {
                    const y = firstY + i * (boardH + sideBoardGap);
                    if(y + boardH / 2 > panelTop + 0.08) break;
                    const panel = addOrientedBox(group, clearLen, boardH, boardT, material, edge.mid.x, y, edge.mid.z, edge.angle, true, true);
                    panel.userData.cornerFillPanel = edgeIndex;
                }
            });
        }

        function rebuildCornerFill(fill) {
            if(!fill) return;
            (balconySceneGroup || scene).remove(fill.group);
            disposeGroup(fill.group);
            const group = new THREE.Group();
            fill.group = group;
            group.position.copy(fill.pos);
            group.rotation.y = fill.rot || 0;
            group.userData.cornerFill = fill;
            const base = new THREE.Color(fill.woodColor || '#6a4b38');
            const panelMat = new THREE.MeshStandardMaterial({ color: base, roughness: 0.78, metalness: 0.02 });
            const topMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(1.16), roughness: 0.72 });
            const frameMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.74), roughness: 0.86 });
            const points = getCornerFillLocalPoints(fill);
            const h = Math.max(0.2, fill.h || 5.5);
            const settings = getDefaultConstructionSettings();
            const postX = settings.lambourdeLong;
            const postZ = settings.lambourdeWide;
            const railH = settings.floorBattenHeight;
            const railD = settings.lambourdeWide;
            points.forEach((point, index) => {
                const post = addOrientedBox(group, postX, h, postZ, frameMat, point.x, h / 2, point.z, 0, true, true);
                post.userData.cornerFillPost = index;
            });
            addCornerFillSidePanels(group, fill, panelMat);
            getCornerFillEdges(fill).forEach((edge, edgeIndex) => {
                const railLen = Math.max(0.5, edge.len);
                const bottom = addOrientedBox(group, railLen, railH, railD, frameMat, edge.mid.x, railH / 2, edge.mid.z, edge.angle, true, true);
                const top = addOrientedBox(group, railLen, railH, railD, frameMat, edge.mid.x, Math.max(railH / 2, h - railH / 2), edge.mid.z, edge.angle, true, true);
                bottom.userData.cornerFillRail = `bottom-${edgeIndex}`;
                top.userData.cornerFillRail = `top-${edgeIndex}`;
            });
            if(fill.purpose !== 'planter') {
                if(!addCornerArrangementBranchDeckSlats(group, fill, topMat, h + settings.floorSlatThickness / 2 + 0.03, settings.floorSlatThickness, settings.lambourdeWide * 0.55)) {
                    addCornerFillDeckSlats(group, fill, topMat, h + settings.floorSlatThickness / 2 + 0.03, settings.floorSlatThickness, settings.lambourdeWide * 0.55);
                }
            } else {
                const soilGeo = new THREE.BufferGeometry();
                const topPoints = points.map(p => new THREE.Vector3(p.x * 0.86, h + 0.05, p.z * 0.86));
                soilGeo.setFromPoints(topPoints);
                const vertices = [];
                topPoints.forEach(p => vertices.push(p.x, p.y, p.z));
                const indices = [];
                for(let i = 1; i < topPoints.length - 1; i++) indices.push(0, i, i + 1);
                soilGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                soilGeo.setIndex(indices);
                soilGeo.computeVertexNormals();
                const soil = new THREE.Mesh(soilGeo, new THREE.MeshStandardMaterial({ color: 0x2b1d16, roughness: 0.95 }));
                soil.receiveShadow = true;
                group.add(soil);
            }
            if(!addCornerArrangementBranchDeckSlats(group, fill, frameMat, settings.floorBattenHeight + settings.floorSlatThickness / 2 + 0.05, settings.floorSlatThickness, settings.lambourdeWide * 0.85)) {
                addCornerFillDeckSlats(group, fill, frameMat, settings.floorBattenHeight + settings.floorSlatThickness / 2 + 0.05, settings.floorSlatThickness, settings.lambourdeWide * 0.85);
            }
            (balconySceneGroup || scene).add(group);
        }

        function addNewCornerFill(options = {}) {
            const idx = cornerFills.length;
            const fill = {
                constructionType: 'cornerFill',
                id: options.id || makeUniquePlacementId('cornerFill'),
                w: typeof options.w === 'number' ? options.w : 8,
                d: typeof options.d === 'number' ? options.d : 5.5,
                h: typeof options.h === 'number' ? options.h : 5.5,
                angleDeg: typeof options.angleDeg === 'number' ? Math.max(45, Math.min(135, options.angleDeg)) : 75,
                faceStyle: options.faceStyle || 'straight',
                purpose: options.purpose || 'fill',
                sourceCorner: options.sourceCorner || null,
                shapePoints: Array.isArray(options.shapePoints) ? options.shapePoints.map(p => ({ x: p.x, z: p.z })) : null,
                woodColor: options.woodColor || '#6a4b38',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('cornerFill'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.2 : options.x, 0, options.z === undefined ? 12 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            cornerFills.push(fill);
            rebuildCornerFill(fill);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return fill;
        }

        function delete2dCornerFill() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'cornerFill') return;
            saveState();
            const idx = cornerFills.findIndex(f => f.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(cornerFills[idx].group);
            cornerFills.splice(idx, 1);
            selected2dCornerFill = null;
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dCornerFillDimension(prop, value, commit = true) {
            const fill = getSelectedPlacementObject();
            if(getPlacementType(fill) !== 'cornerFill') return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(fill, prop, val, constructionTypes.cornerFill.resizeLimits);
            } else if(prop === 'h') {
                fill.h = Math.max(window.manualDimensionEditActive ? 0.1 : 2.5, Math.min(9.5, val));
            }
            refreshPlacementAfterSlider(fill, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(`corner-fill-${prop}-2d-val`);
                if(label) label.textContent = String(roundToOneDecimal(fill[prop] * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dCornerFillAngle(value, commit = true) {
            const fill = getSelectedPlacementObject();
            if(getPlacementType(fill) !== 'cornerFill') return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            fill.angleDeg = Math.max(45, Math.min(135, val));
            refreshPlacementAfterSlider(fill, commit);
            const label = document.getElementById('corner-fill-angle-2d-val');
            if(label) label.textContent = Math.round(fill.angleDeg) + '°';
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            }
            draw2D();
        }

        function update2dCornerFillColor(color, commit = true) {
            const fill = getSelectedPlacementObject();
            if(getPlacementType(fill) !== 'cornerFill' || !color) return;
            if(commit) saveState();
            fill.woodColor = color;
            rebuildCornerFill(fill);
            updateCornerFillPaletteUI(color);
            updateJard3DHighlight();
            refreshFabricationAndPricing();
            draw2D();
        }

        function setCornerFillColorPreset(color) {
            const input = document.getElementById('corner-fill-color-2d');
            if(input) input.value = color;
            update2dCornerFillColor(color, true);
        }

        function collectCornerFillCutGroups(items = cornerFills) {
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const boardProfile = `Planches cuve ${dmToCm(settings.boardThickness)} x ${dmToCm(settings.boardWidth)} cm`;
            const lambProfile = getLambourdeProfileLabel(settings);
            const battenProfile = `Tasseaux bas ${dmToCm(settings.floorBattenHeight)} x ${dmToCm(settings.floorBattenWidth)} cm`;
            const boardMeta = { familyKey: 'cuveBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(settings.boardWidth) };
            const lambMeta = { familyKey: 'lambourdes', sectionAcm: dmToCm(settings.lambourdeLong), sectionBcm: dmToCm(settings.lambourdeWide) };
            const battenMeta = { familyKey: 'floorBattens', sectionAcm: dmToCm(settings.floorBattenHeight), sectionBcm: dmToCm(settings.floorBattenWidth) };
            const addPiece = (profile, label, lengthCm, qty, meta) => {
                if(qty <= 0 || lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            };
            (items || []).forEach((fill, index) => {
                const label = `Comble-angle ${index + 1}`;
                const edges = getCornerFillEdges(fill);
                const points = getCornerFillLocalPoints(fill);
                const minZ = Math.min(...points.map(p => p.z));
                const maxZ = Math.max(...points.map(p => p.z));
                const slatW = Math.max(0.38, settings.floorSlatWidth || 0.9);
                const topInset = settings.lambourdeWide * 0.55;
                const topCount = Math.max(2, Math.floor((maxZ - minZ - topInset * 2) / Math.max(slatW + settings.boardGap, 0.1)));
                const topTotal = topCount * slatW + Math.max(0, topCount - 1) * settings.boardGap;
                const topStart = -topTotal / 2 + slatW / 2;
                if(fill.purpose !== 'planter') {
                    for(let i = 0; i < topCount; i++) {
                        const z = topStart + i * (slatW + settings.boardGap);
                        const span = getCornerFillSpanAtZ(fill, z);
                        addPiece(battenProfile, `${label} - latte dessus biais ${i + 1}`, dmToCm(Math.max(0.35, span.maxX - span.minX - topInset * 2)), 1, battenMeta);
                    }
                }
                const floorInset = settings.lambourdeWide * 0.85;
                for(let i = 0; i < topCount; i++) {
                    const z = topStart + i * (slatW + settings.boardGap);
                    const span = getCornerFillSpanAtZ(fill, z);
                    addPiece(battenProfile, `${label} - latte fond biais ${i + 1}`, dmToCm(Math.max(0.35, span.maxX - span.minX - floorInset * 2)), 1, battenMeta);
                }
                const panelBottom = Math.max(settings.floorBattenHeight + 0.08, 0.35);
                const panelTop = Math.max(panelBottom + settings.boardWidth, fill.h - settings.lambourdeWide - 0.08);
                const usableH = Math.max(settings.boardWidth, panelTop - panelBottom);
                const sideBoardGap = getCuveBoardGap(settings);
                const panelRows = Math.max(1, Math.ceil((usableH + sideBoardGap) / Math.max(settings.boardWidth + sideBoardGap, 0.1)));
                edges.forEach((edge, edgeIndex) => {
                    const clearLen = Math.max(0.5, edge.len - settings.lambourdeLong * 0.9);
                    const isRoundedFront = fill.faceStyle === 'rounded' && edgeIndex > 0 && edgeIndex < edges.length - 1;
                    if(isRoundedFront) {
                        const qty = Math.max(1, Math.ceil(clearLen / Math.max(settings.floorBattenWidth + settings.boardGap, 0.1)));
                        addPiece(battenProfile, `${label} - lattes verticales face arrondie ${edgeIndex + 1}`, dmToCm(Math.max(0.6, panelTop - panelBottom)), qty, battenMeta);
                    } else {
                        addPiece(boardProfile, `${label} - panneau face ${edgeIndex + 1}`, dmToCm(clearLen), panelRows, boardMeta);
                    }
                    addPiece(lambProfile, `${label} - cadre bas face ${edgeIndex + 1}`, dmToCm(edge.len), 1, lambMeta);
                    addPiece(lambProfile, `${label} - cadre haut face ${edgeIndex + 1}`, dmToCm(edge.len), 1, lambMeta);
                });
                addPiece(lambProfile, `${label} - montants verticaux`, dmToCm(fill.h), points.length, lambMeta);
            });
            return groups;
        }

        constructionTypes.cornerFill = {
            label: 'Comble-angle',
            getItems: () => cornerFills,
            create: addNewCornerFill,
            rebuild: rebuildCornerFill,
            resizeLimits: { wMin: 4, wMax: 18, dMin: 3, dMax: 12 },
            heightLimits: { min: 2.5, max: 9.5 },
            collectCutGroups: collectCornerFillCutGroups
        };

        function addAndSelectCompressionShelf() {
            saveState();
            const created = createConstruction('compressionShelf');
            if(created) selectPlacementObject(created);
        }

        function addNewCompressionShelf(options = {}) {
            const idx = compressionShelves.length;
            const settings = getDefaultConstructionSettings();
            const defaultBoardWidth = Math.max(0.9, Math.min(3.0, settings.boardWidth || 1.45));
            const boardWidth = Math.max(0.9, Math.min(3.0, typeof options.boardWidth === 'number' ? options.boardWidth : (typeof options.d === 'number' ? options.d : defaultBoardWidth)));
            const shelf = {
                constructionType: 'compressionShelf',
                id: options.id || makeUniquePlacementId('compressionShelf'),
                w: typeof options.w === 'number' ? options.w : 18,
                d: typeof options.d === 'number' ? options.d : boardWidth,
                boardWidth,
                h: typeof options.h === 'number' ? options.h : 25,
                shelfCount: Math.max(2, Math.min(4, Math.round(typeof options.shelfCount === 'number' ? options.shelfCount : 4))),
                woodColor: options.woodColor || '#5a3824',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('compressionShelf'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.6 : options.x, 0, options.z === undefined ? 14 : options.z),
                rot: typeof options.rot === 'number' ? options.rot : Math.PI,
                group: new THREE.Group()
            };
            compressionShelves.push(shelf);
            rebuildCompressionShelf(shelf);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return shelf;
        }

        function delete2dCompressionShelf() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'compressionShelf') return;
            saveState();
            const idx = compressionShelves.findIndex(s => s.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(compressionShelves[idx].group);
            compressionShelves.splice(idx, 1);
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dCompressionShelfDimension(prop, value, commit = true) {
            const shelf = getSelectedPlacementObject();
            if(getPlacementType(shelf) !== 'compressionShelf') return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                if(prop === 'd') {
                    shelf.boardWidth = Math.max(window.manualDimensionEditActive ? 0.1 : 0.9, Math.min(3.0, val));
                } else {
                    setPlacementDimensionFromTopLeft(shelf, prop, val, constructionTypes.compressionShelf.resizeLimits);
                }
            } else if(prop === 'h') {
                shelf.h = Math.max(window.manualDimensionEditActive ? 0.1 : 20, Math.min(30, val));
            }
            refreshPlacementAfterSlider(shelf, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(`compression-shelf-${prop}-2d-val`);
                const current = prop === 'd' ? shelf.boardWidth : shelf[prop];
                if(label) label.textContent = String(roundToOneDecimal(current * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dCompressionShelfShelves(value, commit = true) {
            const shelf = getSelectedPlacementObject();
            if(getPlacementType(shelf) !== 'compressionShelf') return;
            const val = Math.max(2, Math.min(4, Math.round(parseFloat(value))));
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            shelf.shelfCount = val;
            refreshPlacementAfterSlider(shelf, commit);
            const label = document.getElementById('compression-shelf-count-2d-val');
            if(label) label.textContent = val + ' tablettes';
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            }
            draw2D();
        }

        function update2dCompressionShelfRotation(value, commit = true) {
            const shelf = getSelectedPlacementObject();
            if(getPlacementType(shelf) !== 'compressionShelf') return;
            const deg = parseFloat(value);
            if(!Number.isFinite(deg)) return;
            if(commit) saveState();
            shelf.rot = deg * Math.PI / 180;
            if(shelf.group) shelf.group.rotation.y = shelf.rot || 0;
            if(commit) {
                rebuildCompressionShelf(shelf);
                updateJardPanel();
            } else {
                const label = document.getElementById('compression-shelf-rot-2d-val');
                if(label) label.textContent = Math.round(deg) + '°';
                renderCurrent3DFrame();
            }
            draw2D();
        }

        function getCompressionShelfJoineryLayout(shelf, settings = getDefaultConstructionSettings()) {
            const w = Math.max(8, shelf && shelf.w || 18);
            const d = Math.max(0.9, Math.min(3.0, shelf && typeof shelf.boardWidth === 'number' ? shelf.boardWidth : (shelf && typeof shelf.d === 'number' ? shelf.d : (settings.boardWidth || 1.45))));
            const h = Math.max(20, shelf && shelf.h || 25);
            const postX = Math.max(0.16, settings.boardThickness || 0.18);
            const bayCount = Math.max(3, Math.min(8, Math.round(w / 4.2)));
            const postXs = [];
            for(let i = 0; i <= bayCount; i++) postXs.push(-w / 2 + (w / bayCount) * i);
            return { w, d, h, postX, bayCount, postXs };
        }

        function getCompressionShelfSegments(shelfCount, bayCount) {
            const count = Math.max(2, Math.min(4, Math.round(shelfCount || 4)));
            const bays = Math.max(3, Math.round(bayCount || 4));
            const rightShortStart = Math.max(1, Math.min(bays - 1, Math.round(bays * 0.56)));
            const centerStart = bays >= 5 ? 1 : 0;
            const centerEnd = Math.max(centerStart + 1, bays - (bays >= 5 ? 1 : 0));
            const presets = {
                2: [
                    { yRatio: 0.34, startBay: 0, endBay: bays },
                    { yRatio: 0.68, startBay: rightShortStart, endBay: bays }
                ],
                3: [
                    { yRatio: 0.24, startBay: 0, endBay: Math.max(1, bays - 1) },
                    { yRatio: 0.50, startBay: rightShortStart, endBay: bays },
                    { yRatio: 0.75, startBay: 0, endBay: bays }
                ],
                4: [
                    { yRatio: 0.20, startBay: 0, endBay: Math.max(1, bays - 1) },
                    { yRatio: 0.41, startBay: rightShortStart, endBay: bays },
                    { yRatio: 0.62, startBay: 0, endBay: bays },
                    { yRatio: 0.80, startBay: centerStart, endBay: centerEnd }
                ]
            };
            return (presets[count] || presets[4]).map(segment => ({
                yRatio: segment.yRatio,
                startBay: Math.max(0, Math.min(bays - 1, segment.startBay)),
                endBay: Math.max(Math.max(0, Math.min(bays - 1, segment.startBay)) + 1, Math.min(bays, segment.endBay))
            }));
        }

        function getDecorativeSpotExposureFactor() {
            let daylightStrength = 0;
            try {
                const h = typeof sunHour2d === 'number' ? sunHour2d : 16;
                if(typeof getSunStateForHour === 'function') {
                    const sunState = getSunStateForHour(h, null, true);
                    daylightStrength = sunState && sunState.daylight ? Number(sunState.daylightStrength) || 0 : 0;
                }
            } catch(e) {
                daylightStrength = 0;
            }
            daylightStrength = Math.max(0, Math.min(1, daylightStrength));
            const nightPresence = Math.pow(1 - daylightStrength, 1.35);
            return 0.08 + nightPresence * 0.92;
        }

        function updateDecorativeSpotExposure() {
            const factor = getDecorativeSpotExposureFactor();
            const roots = [];
            if(typeof balconySceneGroup !== 'undefined' && balconySceneGroup) roots.push(balconySceneGroup);
            if(typeof scene !== 'undefined' && scene) roots.push(scene);
            const seen = new Set();
            roots.forEach(root => {
                root.traverse(obj => {
                    if(seen.has(obj)) return;
                    seen.add(obj);
                    if(!obj.userData) return;
                    if(obj.userData.decorativeExposureLight) {
                        obj.intensity = (obj.userData.decorBaseIntensity || 1) * factor;
                    }
                    if(obj.userData.decorativeExposureLens && obj.material) {
                        obj.material.emissiveIntensity = (obj.userData.decorBaseEmissiveIntensity || 1) * factor;
                    }
                });
            });
        }

        function rebuildCompressionShelf(shelf) {
            if(!shelf) return;
            (balconySceneGroup || scene).remove(shelf.group);
            disposeGroup(shelf.group);
            const group = new THREE.Group();
            shelf.group = group;
            group.position.copy(shelf.pos);
            group.rotation.y = shelf.rot || 0;
            group.userData.compressionShelf = shelf;
            const settings = getDefaultConstructionSettings();
            const base = new THREE.Color(shelf.woodColor || '#5a3824');
            const boardMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(1.08), roughness: 0.76 });
            const cleatMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.92), roughness: 0.82 });
            const frameMat = new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.72), roughness: 0.84 });
            const steelMat = new THREE.MeshStandardMaterial({ color: 0x23201d, roughness: 0.58, metalness: 0.24 });
            const rubberMat = new THREE.MeshStandardMaterial({ color: 0x12110f, roughness: 0.9 });
            const potMat = new THREE.MeshStandardMaterial({ color: 0xc68155, roughness: 0.9 });
            const soilMat = new THREE.MeshStandardMaterial({ color: 0x2a211a, roughness: 0.96 });
            const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f7f3a, side: THREE.DoubleSide, roughness: 0.84 });
            const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x74a95a, side: THREE.DoubleSide, roughness: 0.86 });
            const spotBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });
            const spotLensMat = new THREE.MeshStandardMaterial({ color: 0xfff8d6, emissive: 0xffcc55, emissiveIntensity: 1.1, roughness: 0.2 });
            const whiteBookMats = [
                new THREE.MeshStandardMaterial({ color: 0xf5f1e8, roughness: 0.8 }),
                new THREE.MeshStandardMaterial({ color: 0xfffcf4, roughness: 0.78 }),
                new THREE.MeshStandardMaterial({ color: 0xe7e1d4, roughness: 0.82 }),
                new THREE.MeshStandardMaterial({ color: 0xf8f8f3, roughness: 0.76 })
            ];
            const darkInkMat = new THREE.MeshStandardMaterial({ color: 0x2b2a27, roughness: 0.72 });
            const mutedInkMat = new THREE.MeshStandardMaterial({ color: 0x9a8772, roughness: 0.76 });
            const driedStemMat = new THREE.MeshStandardMaterial({ color: 0xb99a67, roughness: 0.92 });
            const driedFlowerMat = new THREE.MeshStandardMaterial({ color: 0xd8c08a, roughness: 0.88 });
            const glassMat = new THREE.MeshPhysicalMaterial({ color: 0xd8d1c4, transparent: true, opacity: 0.36, roughness: 0.12, metalness: 0.0, transmission: 0.28 });
            const blueEnamelMat = new THREE.MeshStandardMaterial({ color: 0x1c5f9c, roughness: 0.32, metalness: 0.08 });
            const blueEnamelDarkMat = new THREE.MeshStandardMaterial({ color: 0x0e365f, roughness: 0.42, metalness: 0.08 });
            const flowerCenterMat = new THREE.MeshStandardMaterial({ color: 0xf1c75b, roughness: 0.8, metalness: 0.0 });
            const flowerMats = [0xf5d04f, 0xe46f88, 0xf2a7c0, 0xffffff, 0x9462c9, 0xff8f4f]
                .map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide }));
            const flowerCenterGeo = new THREE.SphereGeometry(0.045, 8, 6);
            const flowerPetalGeo = new THREE.SphereGeometry(0.06, 8, 6);
            const boardT = Math.max(0.16, settings.boardThickness || 0.18);
            const layout = getCompressionShelfJoineryLayout(shelf, settings);
            const w = layout.w;
            const d = layout.d;
            const h = layout.h;
            const boardW = d;
            shelf.boardWidth = d;
            const postX = boardT;
            const postZ = boardW;
            const railT = boardT;
            const shelfDepth = boardW;
            const cleatSize = Math.max(0.24, settings.floorBattenHeight || 0.35, settings.floorBattenWidth || 0.35);
            const sideCleatL = boardW * 0.82;
            const bayCount = layout.bayCount;
            const postXs = layout.postXs;

            const leafShape = new THREE.Shape();
            const leafS = 0.30;
            leafShape.moveTo(0, leafS);
            leafShape.quadraticCurveTo(leafS * 0.54, leafS * 0.54, leafS * 0.375, 0);
            leafShape.quadraticCurveTo(leafS * 0.167, -leafS * 0.29, 0, -leafS * 0.46);
            leafShape.quadraticCurveTo(-leafS * 0.167, -leafS * 0.29, -leafS * 0.375, 0);
            leafShape.quadraticCurveTo(-leafS * 0.54, leafS * 0.54, 0, leafS);
            const decorLeafGeo = new THREE.ShapeGeometry(leafShape, 4);

            const shelfDecorUnit = salt => {
                const value = Math.sin(salt * 12.9898) * 43758.5453;
                return value - Math.floor(value);
            };

            const clampDecorX = (x, left, right, radius = 0.45) => {
                if(right - left <= radius * 2) return (left + right) / 2;
                return Math.max(left + radius, Math.min(right - radius, x));
            };

            const getSeparatedDecorPair = (leftSlot, rightSlot, leftRadius, rightRadius, minGap = 0.18) => {
                if(!leftSlot || !rightSlot) return null;
                const minDistance = leftRadius + rightRadius + minGap;
                if(leftSlot.bay !== rightSlot.bay) {
                    return {
                        leftX: clampDecorX(leftSlot.x, leftSlot.left, leftSlot.right, leftRadius),
                        rightX: clampDecorX(rightSlot.x, rightSlot.left, rightSlot.right, rightRadius)
                    };
                }
                const span = rightSlot.right - rightSlot.left;
                if(span < minDistance + leftRadius + rightRadius) return null;
                const leftX = clampDecorX(rightSlot.left + leftRadius, rightSlot.left, rightSlot.right, leftRadius);
                const rightX = clampDecorX(rightSlot.right - rightRadius, rightSlot.left, rightSlot.right, rightRadius);
                if(Math.abs(rightX - leftX) < minDistance) return null;
                return { leftX, rightX };
            };

            const getDeckBaySlot = (deck, slotIndex = 0, margin = 0.18) => {
                if(!deck) return null;
                const startBay = Math.max(0, deck.startBay || 0);
                const endBay = Math.max(startBay + 1, deck.endBay || startBay + 1);
                const bayTotal = Math.max(1, endBay - startBay);
                const bay = Math.max(startBay, Math.min(endBay - 1, startBay + ((slotIndex % bayTotal) + bayTotal) % bayTotal));
                const left = postXs[bay] + postX / 2 + margin;
                const right = postXs[bay + 1] - postX / 2 - margin;
                return { left, right, x: (left + right) / 2, w: Math.max(0, right - left), bay };
            };

            const addCompressionFoot = (x, z, y, top = false) => {
                const rodR = Math.min(0.08, postX * 0.18);
                const rodH = Math.max(railT * 1.22, 0.24);
                const washerR = Math.max(postX * 1.7, 0.16);
                const rod = new THREE.Mesh(new THREE.CylinderGeometry(rodR, rodR, rodH, 12), steelMat);
                rod.position.set(x, y + (top ? -rodH / 2 : rodH / 2), z);
                rod.castShadow = true;
                group.add(rod);
                const washer = new THREE.Mesh(new THREE.CylinderGeometry(washerR, washerR, 0.045, 18), steelMat);
                washer.position.set(x, y + (top ? -0.075 : 0.075), z);
                washer.castShadow = true;
                washer.receiveShadow = true;
                group.add(washer);
                const nut = new THREE.Mesh(new THREE.CylinderGeometry(washerR * 0.62, washerR * 0.62, 0.16, 6), steelMat);
                nut.position.set(x, y + (top ? -rodH * 0.52 : rodH * 0.52), z);
                nut.castShadow = true;
                group.add(nut);
                const pad = new THREE.Mesh(new THREE.CylinderGeometry(washerR * 0.9, washerR * 0.9, 0.055, 18), rubberMat);
                pad.position.set(x, y + (top ? -rodH - 0.035 : rodH + 0.035), z);
                pad.castShadow = true;
                pad.receiveShadow = true;
                group.add(pad);
            };

            const addDecorLeaf = (x, y, z, sx, sy, angle, mat, pitch = -0.28) => {
                const leaf = new THREE.Mesh(decorLeafGeo, mat);
                leaf.position.set(x, y, z);
                leaf.rotation.set(pitch, angle, (Math.sin(angle * 1.7) * 0.32));
                leaf.scale.set(sx, sy, 1);
                leaf.castShadow = true;
                leaf.receiveShadow = true;
                group.add(leaf);
            };

            const addDecorFlower = (x, y, z, scaleMul = 1, salt = 1) => {
                const flower = new THREE.Group();
                const petalMat = flowerMats[Math.floor(shelfDecorUnit(salt) * flowerMats.length) % flowerMats.length];
                for(let pi = 0; pi < 5; pi++) {
                    const angle = (pi / 5) * Math.PI * 2;
                    const petal = new THREE.Mesh(flowerPetalGeo, petalMat);
                    petal.position.set(Math.cos(angle) * 0.065 * scaleMul, Math.sin(angle) * 0.065 * scaleMul, 0);
                    petal.scale.set(1.05 * scaleMul, 0.48 * scaleMul, 0.18 * scaleMul);
                    petal.rotation.z = angle;
                    petal.castShadow = true;
                    petal.receiveShadow = true;
                    flower.add(petal);
                }
                const center = new THREE.Mesh(flowerCenterGeo, flowerCenterMat);
                center.scale.setScalar(scaleMul);
                center.castShadow = true;
                center.receiveShadow = true;
                flower.add(center);
                flower.position.set(x, y, z);
                flower.rotation.set((shelfDecorUnit(salt + 1) - 0.5) * 0.5, shelfDecorUnit(salt + 2) * Math.PI * 2, (shelfDecorUnit(salt + 3) - 0.5) * 0.5);
                flower.scale.setScalar(0.78 + shelfDecorUnit(salt + 4) * 0.55);
                group.add(flower);
            };

            const addTrailingPlant = (x, y, z, scale = 1) => {
                const potR = 0.40 * scale;
                const potH = 0.62 * scale;
                const pot = new THREE.Mesh(new THREE.CylinderGeometry(potR * 1.05, potR * 0.82, potH, 18), potMat);
                pot.position.set(x, y + potH / 2, z);
                pot.castShadow = true;
                pot.receiveShadow = true;
                group.add(pot);
                const soil = new THREE.Mesh(new THREE.CylinderGeometry(potR * 0.86, potR * 0.86, 0.045 * scale, 18), soilMat);
                soil.position.set(x, y + potH + 0.025 * scale, z);
                soil.receiveShadow = true;
                group.add(soil);
                for(let i = 0; i < 18; i++) {
                    const angle = i * 0.68;
                    const lx = x + Math.cos(angle) * potR * (0.42 + (i % 4) * 0.09);
                    const lz = z + Math.sin(angle) * potR * (0.32 + (i % 3) * 0.08);
                    addDecorLeaf(lx, y + potH + 0.15 * scale + (i % 3) * 0.045 * scale, lz, 0.95 * scale, 1.18 * scale, angle + Math.PI / 2, i % 2 ? leafMat : leafMat2, -0.16);
                }
                const strands = [-0.62, -0.38, -0.15, 0.12, 0.34, 0.56];
                strands.forEach((offset, strandIndex) => {
                    const leafTotal = 6 + ((strandIndex * 5) % 6);
                    const strandFall = (0.95 + ((strandIndex * 7) % 5) * 0.18) * scale;
                    for(let i = 0; i < leafTotal; i++) {
                        const t = leafTotal <= 1 ? 0 : i / (leafTotal - 1);
                        const fall = strandFall * Math.pow(t, 1.08);
                        const sway = Math.sin(t * Math.PI * 2.1 + strandIndex * 1.45) * potR * (0.10 + (strandIndex % 3) * 0.035);
                        const p = {
                            x: x + potR * offset + sway,
                            y: y + potH * 0.96 - fall,
                            z: z - shelfDepth * (0.55 + t * 0.14) + Math.cos(t * 4.2 + strandIndex) * 0.035 * scale
                        };
                        addDecorLeaf(
                            p.x + (i % 2 ? 0.035 : -0.025) * scale,
                            p.y,
                            p.z,
                            (0.54 + (i % 4) * 0.08) * scale,
                            (0.84 + ((i + strandIndex) % 5) * 0.07) * scale,
                            -0.28 + strandIndex * 0.37 + t * 0.42,
                            (i + strandIndex) % 2 ? leafMat2 : leafMat
                        );
                    }
                });
            };

            const addShelfSpot = (x, y, z, targetY) => {
                const targetPos = new THREE.Vector3(0, targetY, shelfDepth * 0.18);
                const target = new THREE.Object3D();
                target.position.copy(targetPos);
                group.add(target);
                const optimized = typeof optimizedLighting !== 'undefined' ? optimizedLighting : false;
                const spotPos = new THREE.Vector3(x, y, z);
                const dir = targetPos.clone().sub(spotPos).normalize();
                const halfLen = 0.12;
                const lensPos = spotPos.clone().addScaledVector(dir, halfLen);
                const exposureFactor = getDecorativeSpotExposureFactor();
                const baseIntensity = optimized ? 0.9 : 2.2;
                const spot = new THREE.SpotLight(0xffefc6, baseIntensity * exposureFactor, optimized ? 18 : 30, 0.74, 0.28, 1.35);
                spot.userData.decorativeExposureLight = true;
                spot.userData.decorBaseIntensity = baseIntensity;
                spot.position.copy(lensPos);
                spot.target = target;
                spot.castShadow = !optimized;
                if(spot.castShadow) {
                    spot.shadow.mapSize.width = 512;
                    spot.shadow.mapSize.height = 512;
                    spot.shadow.bias = -0.0003;
                    spot.shadow.radius = 2;
                }
                group.add(spot);
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.12, 0.24, 14), spotBodyMat);
                body.position.copy(spotPos);
                body.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
                body.castShadow = false;
                group.add(body);
                const backPos = spotPos.clone().addScaledVector(dir, -halfLen);
                const cap = new THREE.Mesh(new THREE.SphereGeometry(0.10, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), spotBodyMat);
                cap.position.copy(backPos);
                cap.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
                group.add(cap);
                const lensMat = spotLensMat.clone();
                lensMat.emissiveIntensity = 1.1 * exposureFactor;
                const lens = new THREE.Mesh(new THREE.CircleGeometry(0.092, 14), lensMat);
                lens.userData.decorativeExposureLens = true;
                lens.userData.decorBaseEmissiveIntensity = 1.1;
                lens.position.copy(lensPos);
                lens.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
                group.add(lens);
            };

            const addBookMarks = (x, y, z, w, h, vertical = true, lean = 0) => {
                const lineCount = vertical ? 4 : 3;
                for(let i = 0; i < lineCount; i++) {
                    const lineW = vertical ? Math.max(0.08, w * (0.34 + (i % 2) * 0.16)) : Math.max(0.28, w * (0.50 + (i % 2) * 0.14));
                    const lineH = vertical ? 0.022 : 0.018;
                    const lx = vertical ? x : x - w * 0.18 + i * w * 0.18;
                    const ly = vertical ? y + h * (0.28 - i * 0.13) : y + h * (0.18 - i * 0.18);
                    const mark = addOrientedBox(group, lineW, lineH, 0.012, i % 2 ? mutedInkMat : darkInkMat, lx, ly, z - 0.456, 0, false, false);
                    mark.rotation.z = lean;
                }
            };

            const addBookStack = (x, y, z, upright = false, supportSide = 1, supportX = null) => {
                if(upright) {
                    const count = 7;
                    const realSupportX = Number.isFinite(supportX) ? supportX : x + supportSide * 0.92;
                    for(let i = 0; i < count; i++) {
                        const bw = 0.23 + (i % 2) * 0.004;
                        const bh = 1.02 + (i % 2) * 0.006;
                        const lean = -supportSide * Math.max(0.045, 0.18 - i * 0.017);
                        const halfY = Math.abs(Math.cos(lean)) * bh / 2 + Math.abs(Math.sin(lean)) * bw / 2;
                        const topContactX = realSupportX - supportSide * 0.035;
                        const firstCenterX = topContactX + Math.sin(lean) * bh / 2;
                        const bx = firstCenterX - supportSide * i * 0.245;
                        const book = addOrientedBox(group, bw, bh, 0.86, whiteBookMats[i % whiteBookMats.length], bx, y + halfY, z, 0, true, true);
                        book.rotation.z = lean;
                        addBookMarks(bx, y + halfY, z, bw, bh, true, lean);
                    }
                } else {
                    for(let i = 0; i < 5; i++) {
                        const bw = 1.42 - i * 0.02;
                        const bh = 0.15 + (i % 2) * 0.007;
                        const bz = z + i * 0.018;
                        addOrientedBox(group, bw, bh, 0.80, whiteBookMats[(i + 1) % whiteBookMats.length], x, y + bh / 2 + i * 0.16, bz, 0, true, true);
                        addBookMarks(x, y + bh / 2 + i * 0.16, bz, bw, bh, false, 0);
                    }
                }
            };

            const addBlueEnamelVase = (x, y, z, scale = 1) => {
                const addDriedStem = (from, to, radius = 0.010 * scale) => {
                    const start = new THREE.Vector3(from.x, from.y, from.z);
                    const end = new THREE.Vector3(to.x, to.y, to.z);
                    const mid = start.clone().add(end).multiplyScalar(0.5);
                    const len = start.distanceTo(end);
                    if(len <= 0.001) return;
                    const stem = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.7, len, 6), driedStemMat);
                    stem.position.copy(mid);
                    stem.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
                    stem.castShadow = true;
                    group.add(stem);
                };
                const body = new THREE.Mesh(new THREE.CylinderGeometry(0.20 * scale, 0.34 * scale, 0.74 * scale, 24), blueEnamelMat);
                body.position.set(x, y + 0.37 * scale, z);
                body.castShadow = true;
                body.receiveShadow = true;
                group.add(body);
                const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.28 * scale, 24, 12), blueEnamelMat);
                shoulder.scale.set(1.05, 0.46, 1.05);
                shoulder.position.set(x, y + 0.72 * scale, z);
                shoulder.castShadow = true;
                shoulder.receiveShadow = true;
                group.add(shoulder);
                const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.11 * scale, 0.15 * scale, 0.34 * scale, 20), blueEnamelDarkMat);
                neck.position.set(x, y + 0.95 * scale, z);
                neck.castShadow = true;
                group.add(neck);
                const rim = new THREE.Mesh(new THREE.TorusGeometry(0.12 * scale, 0.018 * scale, 8, 20), blueEnamelMat);
                rim.position.set(x, y + 1.13 * scale, z);
                rim.rotation.x = Math.PI / 2;
                group.add(rim);
                const neckY = y + 1.02 * scale;
                for(let i = 0; i < 11; i++) {
                    const angle = -0.75 + i * 0.15;
                    const stemH = (0.72 + (i % 4) * 0.12) * scale;
                    const base = {
                        x: x + Math.sin(angle) * 0.035 * scale,
                        y: neckY,
                        z: z + Math.cos(angle) * 0.025 * scale
                    };
                    const tip = {
                        x: x + Math.sin(angle) * 0.30 * scale,
                        y: neckY + stemH,
                        z: z + Math.cos(angle) * 0.13 * scale
                    };
                    addDriedStem(base, tip);
                    const plume = new THREE.Mesh(new THREE.SphereGeometry(0.055 * scale, 8, 6), driedFlowerMat);
                    plume.scale.set(0.62, 1.55 + (i % 3) * 0.22, 0.62);
                    plume.position.set(tip.x, tip.y, tip.z);
                    plume.rotation.z = angle * 0.5;
                    plume.castShadow = true;
                    group.add(plume);
                }
            };

            const addFernPot = (x, y, z, scale = 1) => {
                const potR = 0.34 * scale;
                const potH = 0.48 * scale;
                const pot = new THREE.Mesh(new THREE.CylinderGeometry(potR * 1.04, potR * 0.82, potH, 18), potMat);
                pot.position.set(x, y + potH / 2, z);
                pot.castShadow = true;
                pot.receiveShadow = true;
                group.add(pot);
                const soil = new THREE.Mesh(new THREE.CylinderGeometry(potR * 0.83, potR * 0.83, 0.04 * scale, 18), soilMat);
                soil.position.set(x, y + potH + 0.024 * scale, z);
                group.add(soil);
                const plantScale = 1.32 * scale;
                const leafCount = Math.round(16 + plantScale * 9);
                for(let i = 0; i < leafCount; i++) {
                    const salt = 2200 + i * 17;
                    const angle = shelfDecorUnit(salt) * Math.PI * 2;
                    const radius = Math.sqrt(shelfDecorUnit(salt + 1)) * potR * 0.92;
                    const leafScale = 1.18 + shelfDecorUnit(salt + 6) * 0.70;
                    addDecorLeaf(
                        x + Math.cos(angle) * radius,
                        y + potH + 0.14 * scale + shelfDecorUnit(salt + 2) * (0.85 + plantScale * 0.92),
                        z + Math.sin(angle) * radius,
                        leafScale,
                        1.18 + shelfDecorUnit(salt + 7) * 0.55,
                        angle + Math.PI / 2 + (shelfDecorUnit(salt + 4) - 0.5) * 1.1,
                        i % 2 ? leafMat2 : leafMat,
                        -0.22 + shelfDecorUnit(salt + 3) * 0.75
                    );
                }
                for(let fi = 0; fi < 3; fi++) {
                    const salt = 3100 + fi * 23;
                    const angle = shelfDecorUnit(salt) * Math.PI * 2;
                    const radius = Math.sqrt(shelfDecorUnit(salt + 1)) * potR * 0.70;
                    addDecorFlower(
                        x + Math.cos(angle) * radius,
                        y + potH + 0.55 * scale + shelfDecorUnit(salt + 2) * 0.60 * scale,
                        z + Math.sin(angle) * radius,
                        0.72 + plantScale * 0.18,
                        salt
                    );
                }
            };

            const addGlassJar = (x, y, z, scale = 1) => {
                const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.28 * scale, 0.70 * scale, 20), glassMat);
                jar.position.set(x, y + 0.35 * scale, z);
                jar.castShadow = true;
                jar.receiveShadow = true;
                group.add(jar);
                const rim = new THREE.Mesh(new THREE.TorusGeometry(0.28 * scale, 0.022 * scale, 8, 20), glassMat);
                rim.position.set(x, y + 0.72 * scale, z);
                rim.rotation.x = Math.PI / 2;
                group.add(rim);
            };

            postXs.forEach((x, index) => {
                const z = 0;
                addOrientedBox(group, postX, Math.max(0.5, h - railT * 2.2), postZ, frameMat, x, h / 2, z, 0, true, true);
                addCompressionFoot(x, z, 0.04, false);
                addCompressionFoot(x, z, h - 0.04, true);
            });
            const kickWallH = 3.0;
            addOrientedBox(group, w + postX * 0.9, kickWallH, shelfDepth, frameMat, 0, kickWallH / 2, 0, 0, true, true);
            addOrientedBox(group, w + postX * 0.9, railT, shelfDepth, frameMat, 0, h - railT / 2, 0, 0, true, true);

            const shelfCount = Math.max(2, Math.min(4, Math.round(shelf.shelfCount || 4)));
            const shelfSegments = getCompressionShelfSegments(shelfCount, bayCount);
            const shelfDecks = [];
            shelfSegments.forEach(segment => {
                const y = h * segment.yRatio;
                const startBay = segment.startBay;
                const endBay = segment.endBay;
                const segmentLeft = postXs[startBay] + postX / 2;
                const segmentRight = postXs[endBay] - postX / 2;
                shelfDecks.push({ xMin: segmentLeft, xMax: segmentRight, y, startBay, endBay });
                const sideCleatY = y - boardT * 0.92;
                const sideCleatZ = 0;
                for(let bay = startBay; bay < endBay; bay++) {
                    const left = postXs[bay] + postX / 2;
                    const right = postXs[bay + 1] - postX / 2;
                    const shelfW = Math.max(0.5, right - left);
                    const x = (left + right) / 2;
                    addOrientedBox(group, shelfW, boardT, shelfDepth, boardMat, x, y, 0, 0, true, true);
                    addOrientedBox(group, cleatSize, cleatSize, sideCleatL, cleatMat, left + cleatSize / 2, sideCleatY, sideCleatZ, 0, true, true);
                    addOrientedBox(group, cleatSize, cleatSize, sideCleatL, cleatMat, right - cleatSize / 2, sideCleatY, sideCleatZ, 0, true, true);
                }
            });
            if(shelfDecks[0]) {
                const deck = shelfDecks[0];
                const bookSlot = getDeckBaySlot(deck, 0, 0.24);
                const jarSlot = getDeckBaySlot(deck, 1, 0.24) || bookSlot;
                if(bookSlot) addBookStack(clampDecorX(bookSlot.left + Math.min(1.05, bookSlot.w * 0.34), bookSlot.left, bookSlot.right, 0.82), deck.y + boardT / 2, 0.08, false);
                if(jarSlot) addGlassJar(clampDecorX(jarSlot.x, jarSlot.left, jarSlot.right, 0.32), deck.y + boardT / 2, -0.08, 0.92);
            }
            if(shelfDecks[1]) {
                const deck = shelfDecks[1];
                const plantSlot = getDeckBaySlot(deck, Math.max(0, (deck.endBay || 1) - (deck.startBay || 0) - 1), 0.28);
                const vaseSlot = getDeckBaySlot(deck, 0, 0.28);
                const decorPair = getSeparatedDecorPair(vaseSlot, plantSlot, 0.48, 0.74, 0.28);
                if(decorPair) {
                    addTrailingPlant(decorPair.rightX, deck.y + boardT / 2, 0.05, 1.38);
                    addBlueEnamelVase(decorPair.leftX, deck.y + boardT / 2, 0.02, 1.22);
                } else if(plantSlot) {
                    addTrailingPlant(clampDecorX(plantSlot.x, plantSlot.left, plantSlot.right, 0.74), deck.y + boardT / 2, 0.05, 1.38);
                } else if(vaseSlot) {
                    addBlueEnamelVase(clampDecorX(vaseSlot.x, vaseSlot.left, vaseSlot.right, 0.48), deck.y + boardT / 2, 0.02, 1.22);
                }
            }
            if(shelfDecks[2]) {
                const deck = shelfDecks[2];
                const slot = getDeckBaySlot(deck, Math.max(0, (deck.endBay || 1) - (deck.startBay || 0) - 1), 0.24);
                if(slot) addBookStack(clampDecorX(slot.right - 0.96, slot.left, slot.right, 0.96), deck.y + boardT / 2, 0.03, true, 1, slot.right);
            }
            if(shelfDecks[3]) {
                const deck = shelfDecks[3];
                const fernSlot = getDeckBaySlot(deck, 0, 0.28);
                const bookSlot = getDeckBaySlot(deck, Math.max(0, (deck.endBay || 1) - (deck.startBay || 0) - 1), 0.24);
                if(fernSlot) addFernPot(clampDecorX(fernSlot.x, fernSlot.left, fernSlot.right, 0.54), deck.y + boardT / 2, 0.05, 1.28);
                if(bookSlot) addBookStack(clampDecorX(bookSlot.left + 0.96, bookSlot.left, bookSlot.right, 0.96), deck.y + boardT / 2, 0.04, true, -1, bookSlot.left);
            }
            const spotY = Math.max(railT * 3.2, h - railT - 0.22);
            addShelfSpot(-w * 0.56, spotY, shelfDepth * 1.02, h * 0.46);
            addShelfSpot(w * 0.56, spotY, shelfDepth * 1.02, h * 0.46);
            (balconySceneGroup || scene).add(group);
            updateDecorativeSpotExposure();
        }

        function collectCompressionShelfCutGroups(items = compressionShelves) {
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const cleatSizeCm = dmToCm(Math.max(settings.floorBattenHeight || 0.35, settings.floorBattenWidth || 0.35));
            const cleatProfile = `Tasseaux carrés d'appui ${cleatSizeCm} x ${cleatSizeCm} cm`;
            const hardwareProfile = 'Vis, écrous, rondelles et patins de compression';
            const spotProfile = 'Spots LED claustra extérieur';
            const screwProfile = 'Vis bois Ø4 mm';
            const cleatMeta = { familyKey: 'claustraCleats', sectionAcm: cleatSizeCm, sectionBcm: cleatSizeCm };
            const hardwareMeta = { familyKey: 'claustraLevelingFeet', unitType: 'item', qty: 0 };
            const spotMeta = { familyKey: 'claustraSpots', unitType: 'item', qty: 0 };
            const screwMeta = { familyKey: 'claustraScrews', unitType: 'box', qty: 0, packSize: 100 };
            const addPiece = (profile, label, lengthCm, qty, meta) => {
                if(qty <= 0 || lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            };
            const addItem = (profile, label, qty, meta) => {
                if(qty <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta: { ...meta, qty: 0 } });
                const entry = groups.get(profile);
                entry.labels.add(label);
                entry.meta.qty += qty;
            };
            items.forEach((shelf, localIndex) => {
                const globalIndex = compressionShelves.indexOf(shelf);
                const label = `Étagère claustra ${(globalIndex >= 0 ? globalIndex : localIndex) + 1}`;
                const layout = getCompressionShelfJoineryLayout(shelf, settings);
                const w = layout.w;
                const h = layout.h;
                const boardWidth = layout.d;
                const bayCount = layout.bayCount;
                const shelfCount = Math.max(2, Math.min(4, Math.round(shelf.shelfCount || 4)));
                const plankFaceThickness = Math.max(0.16, settings.boardThickness || 0.18);
                const boardProfile = `Planches claustra ${dmToCm(settings.boardThickness)} x ${dmToCm(boardWidth)} cm`;
                const boardMeta = { familyKey: 'claustraShelfBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(boardWidth) };
                const bayClear = Math.max(0.5, w / bayCount - plankFaceThickness);
                addPiece(boardProfile, `${label} - planches verticales`, dmToCm(Math.max(0.5, h - settings.boardThickness * 2.2)), bayCount + 1, boardMeta);
                addPiece(boardProfile, `${label} - lisse basse`, dmToCm(w + plankFaceThickness * 0.9), 1, boardMeta);
                addPiece(boardProfile, `${label} - lisse haute`, dmToCm(w + plankFaceThickness * 0.9), 1, boardMeta);
                getCompressionShelfSegments(shelfCount, bayCount).forEach((segment, i) => {
                    const bayPieces = Math.max(1, segment.endBay - segment.startBay);
                    addPiece(boardProfile, `${label} - tablettes entre planches ${i + 1}`, dmToCm(bayClear), bayPieces, boardMeta);
                    addPiece(cleatProfile, `${label} - tasseaux vissés faces intérieures tablette ${i + 1}`, dmToCm(boardWidth * 0.82), bayPieces * 2, cleatMeta);
                });
                addItem(hardwareProfile, `${label} - vis, écrous, rondelles et patins de compression`, (bayCount + 1) * 2, hardwareMeta);
                addItem(spotProfile, `${label} - spots sous lisse haute`, 2, spotMeta);
                addItem(screwProfile, `${label} - vissage tablettes sur tasseaux et montants`, shelfCount * 12 + bayCount * 4 + 8, screwMeta);
            });
            return groups;
        }

        constructionTypes.compressionShelf = {
            label: 'Étagère claustra',
            getItems: () => compressionShelves,
            create: addNewCompressionShelf,
            rebuild: rebuildCompressionShelf,
            resizeLimits: { wMin: 8, wMax: 40, dMin: 0.9, dMax: 3.0 },
            heightLimits: { min: 20, max: 30 },
            collectCutGroups: collectCompressionShelfCutGroups
        };

        function addAndSelectHangingPlanter() {
            const created = createConstruction('hangingPlanter');
            if(created) selectPlacementObject(created);
        }

        function addAndSelectRailShelf() {
            const created = createConstruction('railShelf');
            if(created) selectPlacementObject(created);
        }

        function normalizeRailMountedBracketType(value) {
            return value === 'wood' ? 'wood' : 'steel';
        }

        function addNewHangingPlanter(options = {}) {
            const idx = hangingPlanters.length;
            const planter = {
                constructionType: 'hangingPlanter',
                id: options.id || makeUniquePlacementId('hangingPlanter'),
                w: typeof options.w === 'number' ? options.w : 12,
                d: typeof options.d === 'number' ? options.d : 3.2,
                h: typeof options.h === 'number' ? options.h : 8.6,
                woodColor: options.woodColor || '#9b5f31',
                bracketType: normalizeRailMountedBracketType(options.bracketType),
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('hangingPlanter'),
                plants: JSON.parse(JSON.stringify(trimPlantsList(options.plants || []))),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.4 : options.x, 0, options.z === undefined ? 9 : options.z),
                rot: typeof options.rot === 'number' ? options.rot : Math.PI,
                group: new THREE.Group()
            };
            if(typeof placeRailMountedObjectOnGuardrail === 'function' && !placeRailMountedObjectOnGuardrail(planter, options.showNoRailMessage !== false)) return null;
            saveState();
            hangingPlanters.push(planter);
            rebuildHangingPlanter(planter);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return planter;
        }

        function addNewRailShelf(options = {}) {
            const idx = railShelves.length;
            const shelf = {
                constructionType: 'railShelf',
                id: options.id || makeUniquePlacementId('railShelf'),
                w: typeof options.w === 'number' ? options.w : 10,
                d: typeof options.d === 'number' ? options.d : 5.2,
                h: typeof options.h === 'number' ? options.h : 8.6,
                woodColor: options.woodColor || '#b7773c',
                bracketType: normalizeRailMountedBracketType(options.bracketType),
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('railShelf'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.4 : options.x, 0, options.z === undefined ? 13 : options.z),
                rot: typeof options.rot === 'number' ? options.rot : Math.PI,
                group: new THREE.Group()
            };
            if(typeof placeRailMountedObjectOnGuardrail === 'function' && !placeRailMountedObjectOnGuardrail(shelf, options.showNoRailMessage !== false)) return null;
            saveState();
            railShelves.push(shelf);
            rebuildRailShelf(shelf);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return shelf;
        }

        function delete2dHangingPlanter() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'hangingPlanter') return;
            saveState();
            const idx = hangingPlanters.findIndex(p => p.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(hangingPlanters[idx].group);
            disposeGroup(hangingPlanters[idx].group);
            hangingPlanters.splice(idx, 1);
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function delete2dRailShelf() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'railShelf') return;
            saveState();
            const idx = railShelves.findIndex(s => s.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(railShelves[idx].group);
            disposeGroup(railShelves[idx].group);
            railShelves.splice(idx, 1);
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dHangingPlanterDimension(prop, value, commit = true) {
            const planter = getSelectedPlacementObject();
            if(getPlacementType(planter) !== 'hangingPlanter') return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(planter, prop, val, constructionTypes.hangingPlanter.resizeLimits);
            } else if(prop === 'h') {
                planter.h = Math.max(window.manualDimensionEditActive ? 0.1 : 7, Math.min(11, val));
            }
            if(typeof placeRailMountedObjectOnGuardrail === 'function') placeRailMountedObjectOnGuardrail(planter, false);
            refreshPlacementAfterSlider(planter, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(`hanging-planter-${prop}-2d-val`);
                if(label) label.textContent = String(roundToOneDecimal(planter[prop] * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dRailShelfDimension(prop, value, commit = true) {
            const shelf = getSelectedPlacementObject();
            if(getPlacementType(shelf) !== 'railShelf') return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(shelf, prop, val, constructionTypes.railShelf.resizeLimits);
            } else if(prop === 'h') {
                shelf.h = Math.max(window.manualDimensionEditActive ? 0.1 : 7, Math.min(11, val));
            }
            if(typeof placeRailMountedObjectOnGuardrail === 'function') placeRailMountedObjectOnGuardrail(shelf, false);
            refreshPlacementAfterSlider(shelf, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const label = document.getElementById(`rail-shelf-${prop}-2d-val`);
                if(label) label.textContent = String(roundToOneDecimal(shelf[prop] * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dRailMountedBracketType(type, value) {
            const item = getSelectedPlacementObject();
            if(getPlacementType(item) !== type) return;
            const bracketType = normalizeRailMountedBracketType(value);
            if(item.bracketType === bracketType) return;
            saveState();
            item.bracketType = bracketType;
            rebuildPlacementObject(item);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
        }

        function update2dHangingPlanterBracketType(value) {
            update2dRailMountedBracketType('hangingPlanter', value);
        }

        function update2dRailShelfBracketType(value) {
            update2dRailMountedBracketType('railShelf', value);
        }

        function createRailMountedMaterials(color = '#9b5f31') {
            const base = new THREE.Color(color);
            return {
                board: new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(1.08), roughness: 0.74 }),
                frame: new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.72), roughness: 0.84 }),
                metal: new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.58, metalness: 0.32 }),
                soil: new THREE.MeshStandardMaterial({ color: 0x2b2017, roughness: 0.96 }),
                leafA: new THREE.MeshStandardMaterial({ color: 0x456f35, side: THREE.DoubleSide, roughness: 0.84 }),
                leafB: new THREE.MeshStandardMaterial({ color: 0x7a3b78, side: THREE.DoubleSide, roughness: 0.86 })
            };
        }

        function getFoldedFlatIronThickness(strapWidth = 0.22) {
            return Math.max(0.045, strapWidth * 0.28);
        }

        function addFoldedFlatIronRailSupport(group, x, railTopY, undersideY, outerZ, innerZ, objectZ, mat, strapWidth = 0.22) {
            const flatT = getFoldedFlatIronThickness(strapWidth);
            const railGripDepth = Math.max(0.45, Math.abs(innerZ - outerZ));
            const outerReturnDrop = 1.0;
            const lowerClearance = 0.10;
            const trayY = undersideY - lowerClearance - flatT / 2;
            const guardDrop = Math.max(1.45, railTopY - trayY);
            const trayDepth = Math.max(0.9, Math.abs(objectZ - innerZ));
            const bracketDrop = Math.max(1.6, Math.min(2.8, trayDepth * 0.46));
            const footY = trayY - bracketDrop;
            const braceEndZ = objectZ - flatT * 0.5;
            const braceEndY = trayY - flatT * 0.9;
            const braceDy = braceEndY - footY;
            const braceDz = braceEndZ - innerZ;
            const braceLen = Math.hypot(braceDy, braceDz);

            addOrientedBox(group, strapWidth, flatT, railGripDepth + flatT, mat, x, railTopY, (outerZ + innerZ) / 2, 0, true, true);
            addOrientedBox(group, strapWidth, outerReturnDrop, flatT, mat, x, railTopY - outerReturnDrop / 2, outerZ, 0, true, true);
            addOrientedBox(group, strapWidth, guardDrop + bracketDrop, flatT, mat, x, railTopY - (guardDrop + bracketDrop) / 2, innerZ, 0, true, true);
            addOrientedBox(group, strapWidth, flatT, trayDepth + flatT, mat, x, trayY, (innerZ + objectZ) / 2, 0, true, true);
            const brace = addOrientedBox(group, strapWidth * 0.72, braceLen, flatT, mat, x, (footY + braceEndY) / 2, (innerZ + braceEndZ) / 2, 0, true, true);
            brace.rotation.x = Math.atan2(braceDz, braceDy);
        }

        function addWoodRailBracketSupport(group, x, railTopY, undersideY, outerZ, innerZ, objectZ, mats, size = 0.34) {
            const woodSize = Math.max(0.26, size);
            const hookT = getFoldedFlatIronThickness(0.18);
            const railGripDepth = Math.max(0.45, Math.abs(innerZ - outerZ));
            const outerReturnDrop = 1.0;
            const lowerClearance = 0.08;
            const trayY = undersideY - lowerClearance - woodSize / 2;
            const guardDrop = Math.max(1.45, railTopY - trayY);
            const trayDepth = Math.max(0.9, Math.abs(objectZ - innerZ));
            const bracketDrop = Math.max(1.7, Math.min(3.0, trayDepth * 0.48));
            const footY = trayY - bracketDrop;
            const braceEndZ = objectZ - woodSize * 0.18;
            const braceEndY = trayY - woodSize * 0.15;
            const braceDy = braceEndY - footY;
            const braceDz = braceEndZ - innerZ;
            const braceLen = Math.hypot(braceDy, braceDz);

            addOrientedBox(group, 0.18, hookT, railGripDepth + hookT, mats.metal, x, railTopY, (outerZ + innerZ) / 2, 0, true, true);
            addOrientedBox(group, 0.18, outerReturnDrop, hookT, mats.metal, x, railTopY - outerReturnDrop / 2, outerZ, 0, true, true);
            addOrientedBox(group, woodSize, guardDrop + bracketDrop, woodSize, mats.frame, x, railTopY - (guardDrop + bracketDrop) / 2, innerZ, 0, true, true);
            addOrientedBox(group, woodSize, woodSize, trayDepth + woodSize, mats.frame, x, trayY, (innerZ + objectZ) / 2, 0, true, true);
            const brace = addOrientedBox(group, woodSize * 0.82, braceLen, woodSize * 0.82, mats.frame, x, (footY + braceEndY) / 2, (innerZ + braceEndZ) / 2, 0, true, true);
            brace.rotation.x = Math.atan2(braceDz, braceDy);
        }

        function getFoldedFlatIronSupportZ(backFaceZ, frontFaceZ, strapWidth = 0.22) {
            const flatT = getFoldedFlatIronThickness(strapWidth);
            return {
                outerZ: backFaceZ - 0.78,
                innerZ: backFaceZ - 0.12,
                objectZ: frontFaceZ - flatT / 2
            };
        }

        function addRailMountedScrewPair(group, x, y, z, axis = 'z') {
            const offset = 0.22;
            addScrewPastille(group, x - offset, y, z, axis);
            addScrewPastille(group, x + offset, y, z, axis);
        }

        function addRailMountedSupportBracket(group, x, railTopY, baseY, railZ, frontZ, mats, size = 0.22) {
            const bracketMat = mats.metal || mats.frame;
            const plateW = 0.58;
            const plateD = 0.12;
            const plateH = Math.max(0.85, Math.min(1.25, railTopY - baseY + 0.35));
            const plateY = baseY + plateH * 0.42;
            const plateZ = railZ;
            const armY = baseY - size * 0.35;
            const armD = Math.max(0.85, Math.abs(frontZ - plateZ));
            const armZ = (frontZ + plateZ) / 2;
            const braceStartY = plateY - plateH * 0.33;
            const braceStartZ = plateZ + size * 0.35;
            const braceEndY = armY;
            const braceEndZ = frontZ - size * 0.18;
            const braceDy = braceEndY - braceStartY;
            const braceDz = braceEndZ - braceStartZ;
            const braceLen = Math.hypot(braceDy, braceDz);
            addOrientedBox(group, plateW, plateH, plateD, bracketMat, x, plateY, plateZ, 0, true, true);
            addOrientedBox(group, plateW * 0.82, size * 0.62, armD, bracketMat, x, armY, armZ, 0, true, true);
            const brace = addOrientedBox(group, size * 0.62, braceLen, size * 0.62, bracketMat, x, (braceStartY + braceEndY) / 2, (braceStartZ + braceEndZ) / 2, 0, true, true);
            brace.rotation.x = Math.atan2(braceDz, braceDy);
            addRailMountedScrewPair(group, x, plateY + plateH * 0.24, plateZ - plateD * 0.7, 'z');
            addRailMountedScrewPair(group, x, plateY - plateH * 0.24, plateZ - plateD * 0.7, 'z');
        }

        function addMiniClassicPlanterCuve(group, planter, settings, mats, bottomY) {
            const boardT = Math.max(0.16, settings.boardThickness || 0.2);
            const boardW = Math.max(0.9, settings.boardWidth || 0.9);
            const construction = {
                ...settings,
                cuveTargetH: boardW * 2,
                boardGap: 0
            };
            const modelPlanter = {
                ...planter,
                legH: 0,
                construction,
                hasTreillis: false,
                treillisBack: false,
                treillisLeft: false,
                treillisRight: false,
                treillisH: 0
            };
            const metrics = computeJardiniereConstructionMetrics(modelPlanter);
            const fabricationModel = buildJardiniereFabricationModel(modelPlanter, metrics);
            const boardChamfer = Math.min(construction.boardThickness, construction.boardWidth) * 0.25;
            const postChamfer = Math.min(construction.lambourdeLong, construction.lambourdeWide) * 0.15;
            const woodMat = mats.board;
            const frameMat = mats.frame;
            fabricationModel.pieces.forEach(piece => {
                const length = Math.max(0.01, piece.dim.L || 0.01);
                const height = Math.max(0.01, piece.dim.H || 0.01);
                const thickness = Math.max(0.01, piece.dim.T || 0.01);
                let geometry;
                if(piece.family === 'Planche') geometry = createChamferedBoardGeometry(length, height, thickness, boardChamfer);
                else if(piece.family === 'Lambourde') geometry = createChamferedPostGeometry(length, height, thickness, postChamfer);
                else geometry = new THREE.BoxGeometry(length, height, thickness);
                const material = piece.family === 'Planche' || piece.family === 'LatteFond' ? woodMat : frameMat;
                const mesh = makeShadowMesh(geometry, material, true, true);
                mesh.position.set(piece.pos.x, piece.pos.y + bottomY, piece.pos.z);
                mesh.rotation.y = piece.rotY || 0;
                group.add(mesh);
            });
            fabricationModel.screws.forEach(s => addScrewPastille(group, s.x, s.y + bottomY, s.z, s.axis));
            return {
                metrics,
                cuveH: metrics.cuveH,
                topY: bottomY + metrics.cuveH,
                supportY: bottomY + metrics.battenY + construction.floorBattenHeight * 0.5,
                soilY: bottomY + metrics.soilY
            };
        }

        function addRailMountedClassicMulch(group, metrics, topY) {
            const innerW = Math.max(metrics.outerW - 2 * metrics.construction.boardThickness - 0.18, 0.6);
            const innerD = Math.max(metrics.outerD - 2 * metrics.construction.boardThickness - 0.18, 0.6);
            const mulchLayerH = MATERIAL_LAYER_THICKNESS_DM.mulch;
            const mulchCanvas = document.createElement('canvas');
            mulchCanvas.width = 256;
            mulchCanvas.height = 256;
            const mulchCtx = mulchCanvas.getContext('2d');
            const tileSize = 256;
            const baseImage = mulchCtx.createImageData(tileSize, tileSize);
            for(let py = 0; py < tileSize; py++) {
                for(let px = 0; px < tileSize; px++) {
                    const n = Math.sin((px / tileSize) * Math.PI * 2.4) * 0.14
                        + Math.cos((py / tileSize) * Math.PI * 3.1) * 0.12
                        + Math.sin(((px + py) / tileSize) * Math.PI * 3.7) * 0.08;
                    const shade = 0.72 + n;
                    const i = (py * tileSize + px) * 4;
                    baseImage.data[i] = Math.max(18, Math.min(70, 48 * shade));
                    baseImage.data[i + 1] = Math.max(11, Math.min(42, 27 * shade));
                    baseImage.data[i + 2] = Math.max(6, Math.min(25, 13 * shade));
                    baseImage.data[i + 3] = 255;
                }
            }
            mulchCtx.putImageData(baseImage, 0, 0);
            function withTileCopies(x, y, radius, drawFn) {
                [-tileSize, 0, tileSize].forEach(dx => {
                    [-tileSize, 0, tileSize].forEach(dy => {
                        if(x + dx > -radius && x + dx < tileSize + radius && y + dy > -radius && y + dy < tileSize + radius) drawFn(x + dx, y + dy);
                    });
                });
            }
            function drawMulchChip(x, y, len, wid, angle, color) {
                mulchCtx.save();
                mulchCtx.translate(x, y);
                mulchCtx.rotate(angle);
                mulchCtx.fillStyle = color;
                mulchCtx.fillRect(-len / 2, -wid / 2, len, wid);
                mulchCtx.fillStyle = 'rgba(255,210,145,0.08)';
                mulchCtx.fillRect(-len / 2, -wid / 2, len, Math.max(1, wid * 0.22));
                mulchCtx.fillStyle = 'rgba(12,7,4,0.22)';
                mulchCtx.fillRect(-len / 2, wid * 0.18, len, Math.max(1, wid * 0.2));
                mulchCtx.restore();
            }
            for(let mi = 0; mi < 220; mi++) {
                const x = Math.random() * tileSize;
                const y = Math.random() * tileSize;
                const len = 8 + Math.random() * 62;
                const wid = 1.4 + Math.random() * 5.4;
                const angle = Math.random() * Math.PI + Math.sin(x * 0.017 + y * 0.011) * 0.8;
                const color = ['#2b160c', '#3a2113', '#4b2a17', '#1b1009', '#5a331e', '#25150c', '#6a442b'][mi % 7];
                withTileCopies(x, y, len, (tx, ty) => drawMulchChip(tx, ty, len, wid, angle, color));
            }
            const mulchTexture = new THREE.CanvasTexture(mulchCanvas);
            mulchTexture.wrapS = THREE.RepeatWrapping;
            mulchTexture.wrapT = THREE.RepeatWrapping;
            mulchTexture.repeat.set(Math.max(innerW / 3.8, 1), Math.max(innerD / 3.8, 1));
            mulchTexture.offset.set(Math.random(), Math.random());
            mulchTexture.colorSpace = THREE.SRGBColorSpace;
            const mulchMat = new THREE.MeshStandardMaterial({
                map: mulchTexture,
                bumpMap: mulchTexture,
                bumpScale: 0.018,
                color: 0x7a5a42,
                roughness: 0.98,
                metalness: 0.0
            });
            const mulch = new THREE.Mesh(new THREE.BoxGeometry(innerW, mulchLayerH, innerD), mulchMat);
            mulch.position.y = topY - mulchLayerH / 2 - 0.03;
            mulch.receiveShadow = true;
            mulch.castShadow = true;
            mulch.renderOrder = 24;
            group.add(mulch);
            const chipPalette = [0x2b160c, 0x3a2113, 0x4a2a17, 0x1b1009, 0x5b3520, 0x24140b, 0x6a452d];
            const chipMats = chipPalette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.97, metalness: 0.0 }));
            const chipGeo = new THREE.BoxGeometry(0.42, 0.022, 0.055);
            const chipCount = Math.max(28, Math.min(120, Math.round((innerW * innerD) * 2.0)));
            const chipDummy = new THREE.Object3D();
            const chipBuckets = chipMats.map((mat, matIdx) => {
                const count = Math.ceil((chipCount - matIdx) / chipMats.length);
                const mesh = new THREE.InstancedMesh(chipGeo, mat, Math.max(0, count));
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                mesh.renderOrder = 25;
                group.add(mesh);
                return { mesh, index: 0 };
            });
            for(let ci = 0; ci < chipCount; ci++) {
                const bucket = chipBuckets[ci % chipBuckets.length];
                const x = (Math.random() - 0.5) * Math.max(innerW - 0.25, 0.1);
                const z = (Math.random() - 0.5) * Math.max(innerD - 0.25, 0.1);
                chipDummy.position.set(x, mulch.position.y + mulchLayerH / 2 + 0.014 + Math.random() * 0.04, z);
                chipDummy.rotation.set((Math.random() - 0.5) * 0.3, Math.random() * Math.PI, (Math.random() - 0.5) * 0.22);
                chipDummy.scale.set(0.5 + Math.random() * 1.05, 0.45 + Math.random() * 0.5, 0.55 + Math.random() * 0.9);
                chipDummy.updateMatrix();
                bucket.mesh.setMatrixAt(bucket.index++, chipDummy.matrix);
            }
            chipBuckets.forEach(bucket => {
                bucket.mesh.count = bucket.index;
                bucket.mesh.instanceMatrix.needsUpdate = true;
            });
            return mulch.position.y + mulchLayerH / 2;
        }

        function addRailMountedClassicPlants(group, planter, metrics, bottomY, mulchTopY, mats) {
            if(!Array.isArray(planter.plants) || planter.plants.length === 0) {
                planter.plants = createDefaultPlantsForJardiniere(planter).filter(p => !p.onTreillis);
            }
            if(typeof buildPlantMesh !== 'function') {
                addSimplePlanterLeaves(group, planter, mats, mulchTopY);
                return;
            }
            const miniPlanter = {
                ...planter,
                plants: planter.plants.filter(p => !p.onTreillis),
                renderMetrics: {
                    ...metrics,
                    soilY: mulchTopY,
                    postHeight: bottomY + metrics.postHeight
                },
                hasTreillis: false,
                treillisBack: false,
                treillisLeft: false,
                treillisRight: false,
                treillisH: 0
            };
            redistributePottedPlants(miniPlanter);
            miniPlanter.plants.forEach(p => group.add(buildPlantMesh(p, miniPlanter)));
        }

        function addSimplePlanterLeaves(group, planter, mats, soilY) {
            const count = Math.max(8, Math.min(22, Math.round(planter.w * 1.3)));
            for(let i = 0; i < count; i++) {
                const t = count <= 1 ? 0.5 : i / (count - 1);
                const x = -planter.w * 0.43 + t * planter.w * 0.86;
                const z = (i % 5 - 2) * planter.d * 0.07;
                const stemH = 0.55 + (i % 4) * 0.18;
                const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.012, stemH, 6), mats.leafA);
                stem.position.set(x, soilY + stemH / 2, z);
                stem.rotation.z = (i % 2 ? -1 : 1) * 0.18;
                group.add(stem);
                const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.18 + (i % 3) * 0.025, 10, 6), i % 4 === 0 ? mats.leafB : mats.leafA);
                leaf.scale.set(1.0, 0.28, 0.55);
                leaf.position.set(x + (i % 2 ? -0.08 : 0.08), soilY + stemH + 0.05, z);
                leaf.rotation.y = (i * 0.67) % Math.PI;
                leaf.castShadow = true;
                group.add(leaf);
            }
        }

        function rebuildHangingPlanter(planter) {
            if(!planter) return;
            if(typeof placeRailMountedObjectOnGuardrail === 'function') placeRailMountedObjectOnGuardrail(planter, false);
            (balconySceneGroup || scene).remove(planter.group);
            disposeGroup(planter.group);
            const group = new THREE.Group();
            planter.group = group;
            group.position.copy(planter.pos);
            group.rotation.y = planter.rot || 0;
            group.userData.hangingPlanter = planter;
            const settings = getDefaultConstructionSettings();
            const mats = createRailMountedMaterials(planter.woodColor);
            const boardT = Math.max(0.16, settings.boardThickness || 0.2);
            const boardW = Math.max(0.9, settings.boardWidth || 1.45);
            const usedH = boardW * 2;
            const railTopY = (archHeights.rail || 100) / 10 + 0.18;
            const targetTopY = Math.max(6.8, Math.min(planter.h, railTopY + 0.15));
            const bottomY = targetTopY - usedH;
            const backFaceZ = -planter.d / 2;
            const frontFaceZ = planter.d / 2;
            const cuve = addMiniClassicPlanterCuve(group, planter, settings, mats, bottomY);
            const hookInset = Math.max(1.2, Math.min(planter.w * 0.34, planter.w / 2 - 0.45));
            const supportZ = getFoldedFlatIronSupportZ(backFaceZ, frontFaceZ);
            const supportUndersideY = cuve.supportY - Math.max(0.28, settings.floorBattenHeight || 0.35);
            const bracketType = normalizeRailMountedBracketType(planter.bracketType);
            [-hookInset, hookInset].forEach(x => {
                if(bracketType === 'wood') {
                    addWoodRailBracketSupport(group, x, railTopY, supportUndersideY, supportZ.outerZ, supportZ.innerZ, supportZ.objectZ, mats, Math.max(0.3, settings.floorBattenWidth || 0.35));
                } else {
                    addFoldedFlatIronRailSupport(group, x, railTopY, supportUndersideY, supportZ.outerZ, supportZ.innerZ, supportZ.objectZ, mats.metal, 0.22);
                }
            });
            const mulchTopY = addRailMountedClassicMulch(group, cuve.metrics, cuve.topY);
            addRailMountedClassicPlants(group, planter, cuve.metrics, bottomY, mulchTopY, mats);
            (balconySceneGroup || scene).add(group);
        }

        function rebuildRailShelf(shelf) {
            if(!shelf) return;
            if(typeof placeRailMountedObjectOnGuardrail === 'function') placeRailMountedObjectOnGuardrail(shelf, false);
            (balconySceneGroup || scene).remove(shelf.group);
            disposeGroup(shelf.group);
            const group = new THREE.Group();
            shelf.group = group;
            group.position.copy(shelf.pos);
            group.rotation.y = shelf.rot || 0;
            group.userData.railShelf = shelf;
            const settings = getDefaultConstructionSettings();
            const mats = createRailMountedMaterials(shelf.woodColor);
            const boardT = Math.max(0.16, settings.boardThickness || 0.2);
            const boardW = Math.max(0.9, settings.boardWidth || 1.45);
            const battenW = Math.max(0.28, settings.floorBattenWidth || 0.35);
            const battenH = Math.max(0.28, settings.floorBattenHeight || 0.35);
            const railTopY = (archHeights.rail || 100) / 10 + 0.18;
            const topY = Math.max(6.8, Math.min(shelf.h, railTopY + 0.15));
            const slatCount = Math.max(3, Math.floor((shelf.d + settings.boardGap) / Math.max(boardW + settings.boardGap, 0.1)));
            const gap = slatCount > 1 ? Math.max(0.04, (shelf.d - slatCount * boardW) / (slatCount - 1)) : 0;
            const totalD = slatCount * boardW + Math.max(0, slatCount - 1) * gap;
            const firstZ = -totalD / 2 + boardW / 2;
            for(let i = 0; i < slatCount; i++) {
                addOrientedBox(group, shelf.w, boardT, boardW, mats.board, 0, topY, firstZ + i * (boardW + gap), 0, true, true);
                addRailMountedScrewPair(group, -shelf.w / 2 + Math.max(0.55, battenW * 1.8), topY + boardT / 2 + 0.014, firstZ + i * (boardW + gap), 'y');
                addRailMountedScrewPair(group, shelf.w / 2 - Math.max(0.55, battenW * 1.8), topY + boardT / 2 + 0.014, firstZ + i * (boardW + gap), 'y');
            }
            const frameZ = shelf.d / 2 - battenW / 2;
            addOrientedBox(group, shelf.w, battenH, battenW, mats.frame, 0, topY - boardT / 2 - battenH / 2, frameZ, 0, true, true);
            addOrientedBox(group, shelf.w, battenH, battenW, mats.frame, 0, topY - boardT / 2 - battenH / 2, -frameZ, 0, true, true);
            addOrientedBox(group, battenW, battenH, shelf.d, mats.frame, -shelf.w / 2 + battenW / 2, topY - boardT / 2 - battenH / 2, 0, 0, true, true);
            addOrientedBox(group, battenW, battenH, shelf.d, mats.frame, shelf.w / 2 - battenW / 2, topY - boardT / 2 - battenH / 2, 0, 0, true, true);
            const hookInset = Math.max(0.9, Math.min(shelf.w * 0.38, shelf.w / 2 - 0.45));
            const supportZ = getFoldedFlatIronSupportZ(-shelf.d / 2, shelf.d / 2);
            const bracketType = normalizeRailMountedBracketType(shelf.bracketType);
            [-hookInset, hookInset].forEach(x => {
                if(bracketType === 'wood') {
                    addWoodRailBracketSupport(group, x, railTopY, topY - boardT / 2 - battenH, supportZ.outerZ, supportZ.innerZ, supportZ.objectZ, mats, Math.max(0.3, battenW));
                } else {
                    addFoldedFlatIronRailSupport(group, x, railTopY, topY - boardT / 2 - battenH, supportZ.outerZ, supportZ.innerZ, supportZ.objectZ, mats.metal, 0.22);
                }
            });
            (balconySceneGroup || scene).add(group);
        }

        function collectRailMountedCutGroups(items, type) {
            const source = Array.isArray(items) ? items : [];
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const boardProfile = `Planches cuve ${dmToCm(settings.boardThickness)} x ${dmToCm(settings.boardWidth)} cm`;
            const lambProfile = getLambourdeProfileLabel(settings);
            const battenProfile = `Tasseaux bas ${dmToCm(settings.floorBattenHeight)} x ${dmToCm(settings.floorBattenWidth)} cm`;
            const slatProfile = `Lattes fond ${dmToCm(settings.floorSlatThickness)} x ${dmToCm(settings.floorSlatWidth)} cm`;
            const hardwareProfile = 'Fer plat plié garde-corps et visserie inox';
            const boardMeta = { familyKey: 'cuveBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(settings.boardWidth) };
            const lambMeta = { familyKey: 'lambourdes', sectionAcm: dmToCm(settings.lambourdeLong), sectionBcm: dmToCm(settings.lambourdeWide) };
            const battenMeta = { familyKey: 'floorBattens', sectionAcm: dmToCm(settings.floorBattenHeight), sectionBcm: dmToCm(settings.floorBattenWidth) };
            const slatMeta = { familyKey: 'floorSlats', sectionAcm: dmToCm(settings.floorSlatThickness), sectionBcm: dmToCm(settings.floorSlatWidth) };
            const hardwareMeta = { familyKey: 'railHardware', unitType: 'item', qty: 0 };
            const addPiece = (profile, label, lengthCm, qty, meta) => {
                if(qty <= 0 || lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            };
            const addItem = (profile, label, qty, meta) => {
                if(qty <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta: { ...meta, qty: 0 } });
                const entry = groups.get(profile);
                entry.labels.add(label);
                entry.meta.qty += qty;
            };
            source.forEach((item, localIndex) => {
                const globalIndex = type === 'hangingPlanter' ? hangingPlanters.indexOf(item) : railShelves.indexOf(item);
                const label = `${type === 'hangingPlanter' ? 'Jardinière garde-corps' : 'Tablette garde-corps'} ${(globalIndex >= 0 ? globalIndex : localIndex) + 1}`;
                const bracketType = normalizeRailMountedBracketType(item.bracketType);
                if(type === 'hangingPlanter') {
                    const construction = { ...settings, cuveTargetH: settings.boardWidth * 2, boardGap: 0 };
                    const modelPlanter = { ...item, legH: 0, construction };
                    const metrics = computeJardiniereConstructionMetrics(modelPlanter);
                    const rows = metrics.boardCourses.count;
                    addPiece(boardProfile, `${label} - longues faces`, dmToCm(item.w), rows * 2, boardMeta);
                    addPiece(boardProfile, `${label} - joues`, dmToCm(Math.max(0.5, item.d - settings.boardThickness * 2)), rows * 2, boardMeta);
                    addPiece(lambProfile, `${label} - lambourdes d'angle`, dmToCm(metrics.postHeight), 4, lambMeta);
                    addPiece(battenProfile, `${label} - tasseaux de fond standard`, dmToCm(metrics.battenLength), 2, battenMeta);
                    addPiece(slatProfile, `${label} - lattes de fond`, dmToCm(metrics.innerDepth), metrics.floorSlats.count, slatMeta);
                    if(bracketType === 'wood') {
                        addPiece(battenProfile, `${label} - équerres bois verticales`, dmToCm(Math.max(2.4, item.h - settings.boardWidth * 2 + 2.2)), 2, battenMeta);
                        addPiece(battenProfile, `${label} - équerres bois sous cuve`, dmToCm(item.d), 2, battenMeta);
                        addPiece(battenProfile, `${label} - jambes de force bois`, dmToCm(Math.hypot(item.d, 2.4)), 2, battenMeta);
                        addItem('Crochets garde-corps et visserie inox', `${label} - crochets et visserie pour équerres bois`, 6, hardwareMeta);
                    } else {
                        addItem(hardwareProfile, `${label} - supports en fer plat plié et visserie inox`, 6, hardwareMeta);
                    }
                    return;
                }
                const slatCount = Math.max(3, Math.floor((item.d + settings.boardGap) / Math.max(settings.boardWidth + settings.boardGap, 0.1)));
                addPiece(boardProfile, `${label} - lattes plateau`, dmToCm(item.w), slatCount, boardMeta);
                addPiece(battenProfile, `${label} - cadre long`, dmToCm(item.w), 2, battenMeta);
                addPiece(battenProfile, `${label} - cadre court`, dmToCm(item.d), 2, battenMeta);
                if(bracketType === 'wood') {
                    addPiece(battenProfile, `${label} - équerres bois verticales`, dmToCm(Math.max(2.4, item.h - 5.9)), 2, battenMeta);
                    addPiece(battenProfile, `${label} - équerres bois sous plateau`, dmToCm(item.d), 2, battenMeta);
                    addPiece(battenProfile, `${label} - jambes de force bois`, dmToCm(Math.hypot(item.d, 2.4)), 2, battenMeta);
                    addItem('Crochets garde-corps et visserie inox', `${label} - crochets et visserie pour équerres bois`, 6, hardwareMeta);
                } else {
                    addItem(hardwareProfile, `${label} - supports en fer plat plié et visserie inox`, 6, hardwareMeta);
                }
            });
            return groups;
        }

        function collectHangingPlanterCutGroups(items = hangingPlanters) {
            return collectRailMountedCutGroups(items, 'hangingPlanter');
        }

        function collectRailShelfCutGroups(items = railShelves) {
            return collectRailMountedCutGroups(items, 'railShelf');
        }

        constructionTypes.hangingPlanter = {
            label: 'Jardinière garde-corps',
            getItems: () => hangingPlanters,
            create: addNewHangingPlanter,
            rebuild: rebuildHangingPlanter,
            resizeLimits: { wMin: 6, wMax: 20, dMin: 2.2, dMax: 5 },
            heightLimits: { min: 7, max: 11 },
            collectCutGroups: collectHangingPlanterCutGroups
        };

        constructionTypes.railShelf = {
            label: 'Tablette garde-corps',
            getItems: () => railShelves,
            create: addNewRailShelf,
            rebuild: rebuildRailShelf,
            resizeLimits: { wMin: 5, wMax: 16, dMin: 3, dMax: 7 },
            heightLimits: { min: 7, max: 11 },
            collectCutGroups: collectRailShelfCutGroups
        };

        function addAndSelectTable() {
            saveState();
            const created = createConstruction('table');
            if(created) selectPlacementObject(created);
        }

        function addAndSelectChair() {
            saveState();
            const created = createConstruction('chair');
            if(created) selectPlacementObject(created);
        }

        function addNewTable(options = {}) {
            const idx = tables.length;
            const table = {
                constructionType: 'table',
                id: options.id || makeUniquePlacementId('table'),
                w: typeof options.w === 'number' ? options.w : 8,
                d: typeof options.d === 'number' ? options.d : 8,
                h: typeof options.h === 'number' ? options.h : 7.4,
                woodColor: options.woodColor || '#72513d',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('table'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 2.6 : options.x, 0, options.z === undefined ? 16 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            tables.push(table);
            rebuildTable(table);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return table;
        }

        function addNewChair(options = {}) {
            const idx = chairs.length;
            const chair = {
                constructionType: 'chair',
                id: options.id || makeUniquePlacementId('chair'),
                w: typeof options.w === 'number' ? options.w : 4.6,
                d: typeof options.d === 'number' ? options.d : 5.2,
                h: typeof options.h === 'number' ? options.h : 8.5,
                woodColor: options.woodColor || '#72513d',
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('chair'),
                pos: new THREE.Vector3(options.x === undefined ? idx * 1.6 : options.x, 0, options.z === undefined ? 20 : options.z),
                rot: options.rot || 0,
                group: new THREE.Group()
            };
            chairs.push(chair);
            rebuildChair(chair);
            refreshFabricationAndPricing();
            updateJardPanel();
            draw2D();
            return chair;
        }

        function delete2dTable() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'table') return;
            saveState();
            const idx = tables.findIndex(t => t.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(tables[idx].group);
            tables.splice(idx, 1);
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function delete2dChair() {
            const selected = getSelectedPlacementObject();
            if(getPlacementType(selected) !== 'chair') return;
            saveState();
            const idx = chairs.findIndex(c => c.id === selected.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(chairs[idx].group);
            chairs.splice(idx, 1);
            selectedPlacementObject = null;
            refreshFabricationAndPricing();
            updateJardPanel();
            updateJard3DHighlight();
            draw2D();
        }

        function update2dFurnitureDimension(type, prop, value, commit = true) {
            const item = getSelectedPlacementObject();
            if(getPlacementType(item) !== type) return;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return;
            const def = getConstructionType(type);
            if(commit) saveState();
            if(prop === 'w' || prop === 'd') {
                setPlacementDimensionFromTopLeft(item, prop, val, def && def.resizeLimits);
            } else if(prop === 'h') {
                const limits = (def && def.heightLimits) || { min: 3, max: 12 };
                item.h = Math.max(window.manualDimensionEditActive ? 0.1 : limits.min, Math.min(limits.max, val));
            }
            refreshPlacementAfterSlider(item, commit);
            if(commit) {
                refreshFabricationAndPricing();
                updateJardPanel();
            } else {
                const prefix = type === 'table' ? 'table' : 'chair';
                const label = document.getElementById(`${prefix}-${prop}-2d-val`);
                const current = item[prop];
                if(label) label.textContent = String(roundToOneDecimal(current * 10)).replace('.', ',') + ' cm';
            }
            draw2D();
        }

        function update2dTableDimension(prop, value, commit = true) {
            update2dFurnitureDimension('table', prop, value, commit);
        }

        function update2dChairDimension(prop, value, commit = true) {
            update2dFurnitureDimension('chair', prop, value, commit);
        }

        function update2dFurnitureRotation(type, value, commit = true) {
            const item = getSelectedPlacementObject();
            if(getPlacementType(item) !== type) return;
            const deg = parseFloat(value);
            if(!Number.isFinite(deg)) return;
            if(commit) saveState();
            item.rot = deg * Math.PI / 180;
            if(item.group) item.group.rotation.y = item.rot || 0;
            if(commit) {
                rebuildPlacementObject(item);
                updateJardPanel();
            } else {
                const label = document.getElementById(`${type}-rot-2d-val`);
                if(label) label.textContent = Math.round(deg) + '°';
                renderCurrent3DFrame();
            }
            draw2D();
        }

        function update2dTableRotation(value, commit = true) {
            update2dFurnitureRotation('table', value, commit);
        }

        function update2dChairRotation(value, commit = true) {
            update2dFurnitureRotation('chair', value, commit);
        }

        function createFurnitureWoodMaterials(color = '#72513d') {
            const base = new THREE.Color(color);
            return {
                board: new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(1.05), roughness: 0.72 }),
                frame: new THREE.MeshStandardMaterial({ color: base.clone().multiplyScalar(0.78), roughness: 0.82 })
            };
        }

        function rebuildTable(table) {
            if(!table) return;
            (balconySceneGroup || scene).remove(table.group);
            disposeGroup(table.group);
            const group = new THREE.Group();
            table.group = group;
            group.position.copy(table.pos);
            group.rotation.y = table.rot || 0;
            group.userData.table = table;
            const settings = getDefaultConstructionSettings();
            const mats = createFurnitureWoodMaterials(table.woodColor);
            const boardT = settings.boardThickness;
            const boardW = settings.boardWidth;
            const legLong = settings.lambourdeLong;
            const legWide = settings.lambourdeWide;
            const topY = Math.max(boardT / 2, table.h - boardT / 2);
            const topCount = Math.max(2, Math.floor((table.d + settings.boardGap) / Math.max(boardW + settings.boardGap, 0.1)));
            const gap = topCount > 1 ? Math.max(0.04, (table.d - topCount * boardW) / (topCount - 1)) : 0;
            const totalDepth = topCount * boardW + Math.max(0, topCount - 1) * gap;
            const firstZ = -totalDepth / 2 + boardW / 2;
            for(let i = 0; i < topCount; i++) {
                addOrientedBox(group, table.w, boardT, boardW, mats.board, 0, topY, firstZ + i * (boardW + gap), 0, true, true);
            }
            const legH = Math.max(0.8, table.h - boardT);
            const xInset = Math.max(table.w / 2 - legLong / 2 - 0.35, legLong / 2);
            const zInset = Math.max(table.d / 2 - legWide / 2 - 0.35, legWide / 2);
            [-1, 1].forEach(xs => {
                [-1, 1].forEach(zs => {
                    addOrientedBox(group, legLong, legH, legWide, mats.frame, xs * xInset, legH / 2, zs * zInset, 0, true, true);
                });
            });
            const braceY = Math.max(table.h - boardT - legLong / 2, legLong / 2);
            const longBrace = Math.max(table.w - 2 * legLong - 0.7, 0.5);
            const shortBrace = Math.max(table.d - 2 * legWide - 0.7, 0.5);
            const latX = xInset - (legLong - legWide) / 2;
            addOrientedBox(group, longBrace, legLong, legWide, mats.frame, 0, braceY, zInset, 0, true, true);
            addOrientedBox(group, longBrace, legLong, legWide, mats.frame, 0, braceY, -zInset, 0, true, true);
            addOrientedBox(group, shortBrace, legLong, legWide, mats.frame, -latX, braceY, 0, Math.PI / 2, true, true);
            addOrientedBox(group, shortBrace, legLong, legWide, mats.frame, latX, braceY, 0, Math.PI / 2, true, true);
            (balconySceneGroup || scene).add(group);
        }

        function rebuildChair(chair) {
            if(!chair) return;
            (balconySceneGroup || scene).remove(chair.group);
            disposeGroup(chair.group);
            const group = new THREE.Group();
            chair.group = group;
            group.position.copy(chair.pos);
            group.rotation.y = chair.rot || 0;
            group.userData.chair = chair;
            const settings = getDefaultConstructionSettings();
            const mats = createFurnitureWoodMaterials(chair.woodColor);
            const m = getChairJoineryMetrics(chair, settings);
            for(let i = 0; i < m.seatLayout.count; i++) {
                addOrientedBox(group, chair.w, m.boardT, m.seatLayout.slatW, mats.board, 0, m.seatH, m.seatLayout.firstZ + i * (m.seatLayout.slatW + m.seatLayout.gap), 0, true, true);
            }
            [-1, 1].forEach(xs => {
                addOrientedBox(group, m.legLong, m.legH, m.legWide, mats.frame, xs * m.xInset, m.legH / 2, m.frontZ, 0, true, true);
                addOrientedBox(group, m.legLong, Math.max(chair.h, m.legH), m.legWide, mats.frame, xs * m.xInset, chair.h / 2, m.backZ, 0, true, true);
                addOrientedBox(group, m.innerD, m.cleatH, m.cleatW, mats.frame, xs * m.cleatX, m.cleatY, (m.frontZ + m.backZ) / 2, Math.PI / 2, true, true);
            });
            [0.64, 0.78, 0.92].forEach(t => {
                addOrientedBox(group, m.backSlatW, m.backSlatH, m.boardT, mats.board, 0, Math.min(chair.h * t, chair.h - m.backSlatH / 2), m.backSlatZ, 0, true, true);
            });
            addOrientedBox(group, m.innerW, m.legLong, m.legWide, mats.frame, 0, m.apronY, m.frontZ, 0, true, true);
            addOrientedBox(group, m.innerW, m.legLong, m.legWide, mats.frame, 0, m.apronY, m.backZ, 0, true, true);
            addOrientedBox(group, m.innerD, m.legLong, m.legWide, mats.frame, -m.sideX, m.apronY, (m.frontZ + m.backZ) / 2, Math.PI / 2, true, true);
            addOrientedBox(group, m.innerD, m.legLong, m.legWide, mats.frame, m.sideX, m.apronY, (m.frontZ + m.backZ) / 2, Math.PI / 2, true, true);
            addOrientedBox(group, m.innerW, m.legLong, m.legWide, mats.frame, 0, m.lowY, m.frontZ, 0, true, true);
            addOrientedBox(group, m.innerW, m.legLong, m.legWide, mats.frame, 0, m.lowY, m.backZ, 0, true, true);
            addOrientedBox(group, m.innerD, m.legLong, m.legWide, mats.frame, -m.sideX, m.lowY, (m.frontZ + m.backZ) / 2, Math.PI / 2, true, true);
            addOrientedBox(group, m.innerD, m.legLong, m.legWide, mats.frame, m.sideX, m.lowY, (m.frontZ + m.backZ) / 2, Math.PI / 2, true, true);
            (balconySceneGroup || scene).add(group);
        }

        function collectFurnitureCutGroups(items, type) {
            const source = Array.isArray(items) ? items : [];
            const groups = new Map();
            const settings = getDefaultConstructionSettings();
            const boardProfile = `Planches cuve ${dmToCm(settings.boardThickness)} x ${dmToCm(settings.boardWidth)} cm`;
            const lambProfile = getLambourdeProfileLabel(settings);
            const battenProfile = `Tasseaux bas ${dmToCm(settings.floorBattenHeight)} x ${dmToCm(settings.floorBattenWidth)} cm`;
            const boardMeta = { familyKey: 'cuveBoards', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(settings.boardWidth) };
            const lambMeta = { familyKey: 'lambourdes', sectionAcm: dmToCm(settings.lambourdeLong), sectionBcm: dmToCm(settings.lambourdeWide) };
            const battenMeta = { familyKey: 'floorBattens', sectionAcm: dmToCm(settings.floorBattenHeight), sectionBcm: dmToCm(settings.floorBattenWidth) };
            const addPiece = (profile, label, lengthCm, qty, meta) => {
                if(qty <= 0 || lengthCm <= 0) return;
                if(!groups.has(profile)) groups.set(profile, { profile, labels: new Set(), lengths: [], meta });
                const entry = groups.get(profile);
                entry.labels.add(label);
                for(let i = 0; i < qty; i++) entry.lengths.push(lengthCm);
            };

            source.forEach((item, localIndex) => {
                const globalIndex = type === 'table' ? tables.indexOf(item) : chairs.indexOf(item);
                const label = `${type === 'table' ? 'Table' : 'Chaise'} ${(globalIndex >= 0 ? globalIndex : localIndex) + 1}`;
                const legLong = settings.lambourdeLong;
                const legWide = settings.lambourdeWide;
                if(type === 'table') {
                    const topCount = Math.max(2, Math.floor((item.d + settings.boardGap) / Math.max(settings.boardWidth + settings.boardGap, 0.1)));
                    const xInsetT = Math.max(item.w / 2 - legLong / 2 - 0.35, legLong / 2);
                    const zInsetT = Math.max(item.d / 2 - legWide / 2 - 0.35, legWide / 2);
                    const longBrace = Math.max(item.w - 2 * legLong - 0.7, 0.5);
                    const shortBrace = Math.max(item.d - 2 * legWide - 0.7, 0.5);
                    addPiece(boardProfile, `${label} - plateau (${dmToCm(item.w)} cm)`, dmToCm(item.w), topCount, boardMeta);
                    addPiece(lambProfile, `${label} - pieds (${dmToCm(Math.max(item.h - settings.boardThickness, 0.8))} cm)`, dmToCm(Math.max(item.h - settings.boardThickness, 0.8)), 4, lambMeta);
                    addPiece(lambProfile, `${label} - traverses longues`, dmToCm(longBrace), 2, lambMeta);
                    addPiece(lambProfile, `${label} - traverses courtes`, dmToCm(shortBrace), 2, lambMeta);
                    return;
                }
                const m = getChairJoineryMetrics(item, settings);
                const seatProfile = `Lattes assise ${dmToCm(settings.boardThickness)} x ${dmToCm(m.seatLayout.slatW)} cm`;
                const backProfile = `Lattes dossier ${dmToCm(settings.boardThickness)} x ${dmToCm(m.backSlatH)} cm`;
                const seatMeta = { familyKey: 'chairSeatSlats', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(m.seatLayout.slatW) };
                const backMeta = { familyKey: 'chairBackSlats', sectionAcm: dmToCm(settings.boardThickness), sectionBcm: dmToCm(m.backSlatH) };
                addPiece(seatProfile, `${label} - assise (${dmToCm(item.w)} cm)`, dmToCm(item.w), m.seatLayout.count, seatMeta);
                addPiece(backProfile, `${label} - dossier (${dmToCm(m.backSlatW)} cm)`, dmToCm(m.backSlatW), 3, backMeta);
                addPiece(battenProfile, `${label} - porte-lattes`, dmToCm(m.innerD), 2, battenMeta);
                addPiece(lambProfile, `${label} - pieds avant`, dmToCm(m.legH), 2, lambMeta);
                addPiece(lambProfile, `${label} - montants arrière`, dmToCm(Math.max(item.h, m.legH)), 2, lambMeta);
                addPiece(lambProfile, `${label} - ceintures AV/AR`, dmToCm(m.innerW), 2, lambMeta);
                addPiece(lambProfile, `${label} - ceintures latérales`, dmToCm(m.innerD), 2, lambMeta);
                addPiece(lambProfile, `${label} - entretoises basses AV/AR`, dmToCm(m.innerW), 2, lambMeta);
                addPiece(lambProfile, `${label} - entretoises basses latérales`, dmToCm(m.innerD), 2, lambMeta);
            });
            return groups;
        }

        function collectTableCutGroups(items = tables) {
            return collectFurnitureCutGroups(items, 'table');
        }

        function collectChairCutGroups(items = chairs) {
            return collectFurnitureCutGroups(items, 'chair');
        }

        constructionTypes.table = {
            label: 'Table',
            getItems: () => tables,
            create: addNewTable,
            rebuild: rebuildTable,
            resizeLimits: { wMin: 5.5, wMax: 16, dMin: 5.5, dMax: 14 },
            heightLimits: { min: 5.5, max: 9.5 },
            collectCutGroups: collectTableCutGroups
        };

        constructionTypes.chair = {
            label: 'Chaise',
            getItems: () => chairs,
            create: addNewChair,
            rebuild: rebuildChair,
            resizeLimits: { wMin: 3.8, wMax: 7, dMin: 4, dMax: 7.5 },
            heightLimits: { min: 7, max: 10.5 },
            collectCutGroups: collectChairCutGroups
        };
