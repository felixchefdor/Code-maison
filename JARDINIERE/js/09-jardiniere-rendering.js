        function rebuildJardiniere(j) {
            (balconySceneGroup || scene).remove(j.group);
            disposeGroup(j.group);
            if(j._birdhouseInit !== true) {
                j.birdhouse = true;
                j._birdhouseInit = true;
            }
            j.layerView = normalizeLayerView(j.layerView);
            setJardLayerView(j, j.layerView);
            redistributePottedPlants(j);
            j.group = new THREE.Group();
            const metrics = computeJardiniereConstructionMetrics(j);
            j.renderMetrics = metrics;
            j.treillisType = j.treillisType || 'noisetier';
            const treillisStyle = getTreillisStyle(j.treillisType);
            const woodMat = new THREE.MeshStandardMaterial({ color: j.woodColor });
            const treillisPostMat = treillisStyle.postMat;
            const treillisRailMat = treillisStyle.railMat;
            const boardChamfer = Math.min(metrics.construction.boardThickness, metrics.construction.boardWidth) * 0.25;
            const lambourdeChamfer = Math.min(metrics.construction.lambourdeLong, metrics.construction.lambourdeWide) * 0.15;
            const lambourdeGeometry = createChamferedPostGeometry(
                metrics.construction.lambourdeLong,
                metrics.postHeight,
                metrics.construction.lambourdeWide,
                lambourdeChamfer
            );
            const fabricationModel = buildJardiniereFabricationModel(j, metrics);
            j.fabricationModel = fabricationModel;

            function getPieceGeometry(piece) {
                const L = Math.max(0.01, piece.dim.L || 0.01);
                const H = Math.max(0.01, piece.dim.H || 0.01);
                const W = Math.max(0.01, (piece.dim.W !== undefined ? piece.dim.W : piece.dim.T) || 0.01);
                if(piece.family === 'Lambourde') {
                    if(
                        Math.abs(L - metrics.construction.lambourdeLong) < 0.0001 &&
                        Math.abs(H - metrics.postHeight) < 0.0001 &&
                        Math.abs(W - metrics.construction.lambourdeWide) < 0.0001
                    ) {
                        return lambourdeGeometry;
                    }
                    return createChamferedPostGeometry(L, H, W, lambourdeChamfer);
                }
                if(piece.family === 'Planche') {
                    return createChamferedBoardGeometry(L, H, W, boardChamfer);
                }
                return new THREE.BoxGeometry(L, H, W);
            }

            function getPieceMaterial(piece) {
                if(piece.family === 'TreillisPost') return treillisPostMat;
                if(piece.family === 'TreillisRail') return treillisRailMat;
                return woodMat;
            }

            // Rendu 3D: toutes les pièces viennent du modèle intermédiaire pour éviter les doublons.
            fabricationModel.pieces.forEach(piece => {
                const mesh = makeShadowMesh(getPieceGeometry(piece), getPieceMaterial(piece), true, true);
                mesh.position.set(piece.pos.x, piece.pos.y, piece.pos.z);
                mesh.rotation.y = piece.rotY || 0;
                if(piece.family === 'TreillisPost' || piece.family === 'TreillisRail') {
                    mesh.userData.isTrellis = true;
                }
                j.group.add(mesh);
            });

            fabricationModel.screws.forEach(s => addScrewPastille(j.group, s.x, s.y, s.z, s.axis));

            function addBirdhouseOnTreillis(side) {
                const birdGroup = new THREE.Group();
                const woodLightMat = new THREE.MeshStandardMaterial({ color: 0xb88d62, roughness: 0.82 });
                const woodDarkMat = new THREE.MeshStandardMaterial({ color: 0x6f4c33, roughness: 0.88 });
                const holeMat = new THREE.MeshStandardMaterial({ color: 0x1d1713, roughness: 1.0 });

                const houseW = 1.0;
                const houseD = 1.0;
                const wallH = 1.2;
                const roofPeakH = 2.0;
                const roofRise = roofPeakH - wallH;
                const roofSlopeLen = Math.sqrt((houseW * 0.5) * (houseW * 0.5) + roofRise * roofRise) + 0.06;

                const body = makeShadowMesh(new THREE.BoxGeometry(houseW, wallH, houseD), woodLightMat, true, true);
                body.position.y = wallH / 2;
                birdGroup.add(body);

                const roofLeft = makeShadowMesh(new THREE.BoxGeometry(roofSlopeLen, 0.08, houseD + 0.12), woodDarkMat, true, true);
                roofLeft.position.set(-houseW * 0.26, wallH + roofRise * 0.36, 0);
                roofLeft.rotation.z = Math.atan2(roofRise, houseW * 0.5);
                birdGroup.add(roofLeft);

                const roofRight = makeShadowMesh(new THREE.BoxGeometry(roofSlopeLen, 0.08, houseD + 0.12), woodDarkMat, true, true);
                roofRight.position.set(houseW * 0.26, wallH + roofRise * 0.36, 0);
                roofRight.rotation.z = -Math.atan2(roofRise, houseW * 0.5);
                birdGroup.add(roofRight);

                const backBoard = makeShadowMesh(new THREE.BoxGeometry(0.12, roofPeakH + 0.18, 0.08), woodDarkMat, true, true);
                backBoard.position.set(0, roofPeakH * 0.5 - 0.15, -houseD * 0.5 + 0.02);
                birdGroup.add(backBoard);

                const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 20), holeMat);
                hole.rotation.x = Math.PI / 2;
                hole.position.set(0, wallH * 0.72, houseD * 0.5 + 0.01);
                birdGroup.add(hole);

                const perch = makeShadowMesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 10), woodDarkMat, true, true);
                perch.rotation.z = Math.PI / 2;
                perch.position.set(0, wallH * 0.46, houseD * 0.5 + 0.06);
                birdGroup.add(perch);

                const tH = j.treillisH || 13;
                const railBottomY = metrics.postHeight + 1.0;
                const railTopY = tH + metrics.postHeight - 1.0;
                const railSpan = Math.max(0, railTopY - railBottomY);
                const railLayout = computeFloorSlatLayout(railSpan, treillisStyle.railSize.h, 1.5, 2.0);
                const trlRailCount = railLayout.count;
                const trlRailGap = railLayout.gap;
                const penultimateIndex = Math.max(0, trlRailCount - 2);
                const penultimateRailY = railBottomY + treillisStyle.railSize.h / 2 + penultimateIndex * (treillisStyle.railSize.h + trlRailGap);
                const birdY = penultimateRailY - wallH * 0.42;

                if(side === 'back') {
                    birdGroup.position.set(-j.w / 6, birdY, -j.d / 2 + metrics.construction.boardThickness + 0.34);
                    birdGroup.rotation.y = 0;
                } else if(side === 'left') {
                    birdGroup.position.set(-j.w / 2 + metrics.construction.boardThickness + 0.34, birdY, -j.d / 6);
                    birdGroup.rotation.y = Math.PI / 2;
                } else {
                    birdGroup.position.set(j.w / 2 - metrics.construction.boardThickness - 0.34, birdY, -j.d / 6);
                    birdGroup.rotation.y = -Math.PI / 2;
                }
                j.group.add(birdGroup);
            }

            const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;

            const birdhouseSide = hasBack ? 'back' : (j.treillisLeft ? 'left' : (j.treillisRight ? 'right' : null));
            if(j.birdhouse && birdhouseSide) addBirdhouseOnTreillis(birdhouseSide);

            // Protection intérieure: géotextile au fond, puis EPDM noir sur les parois.
            const boardInnerHalfX = Math.max(metrics.outerW / 2 - metrics.construction.boardThickness, 0.15);
            const boardInnerHalfZ = Math.max(metrics.outerD / 2 - metrics.construction.boardThickness, 0.15);
            const postInnerHalfX = Math.max(metrics.lambourdeX - metrics.construction.lambourdeLong / 2, 0.12);
            const postInnerHalfZ = Math.max(metrics.lambourdeZ - metrics.construction.lambourdeWide / 2, 0.12);
            const innerW = Math.max(boardInnerHalfX * 2, 0.1);
            const innerD = Math.max(boardInnerHalfZ * 2, 0.1);
            const linerBottomY = metrics.slatY + metrics.construction.floorSlatThickness / 2 + 0.035;
            const linerTopY = j.legH + metrics.cuveH;
            const linerH = Math.max(0.08, linerTopY - linerBottomY);
            const linerCenterY = linerBottomY + linerH / 2;
            const epdmMat = new THREE.MeshStandardMaterial({
                color: 0x000000,
                roughness: 0.88,
                metalness: 0.05,
                transparent: false,
                opacity: 1,
                side: THREE.DoubleSide
            });
            const geoMat = new THREE.MeshStandardMaterial({
                color: 0xf2f2ee,
                roughness: 0.95,
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide
            });
            function addLinerPanel(material, size, pos, renderOrder, receiveShadow = false) {
                if(size[1] < 0.045 || Math.max(size[0], size[2]) < 0.045 || Math.min(size[0], size[2]) < 0.006) return;
                const mesh = new THREE.Mesh(new THREE.BoxGeometry(size[0], size[1], size[2]), material);
                mesh.position.set(pos[0], pos[1], pos[2]);
                mesh.receiveShadow = receiveShadow;
                mesh.renderOrder = renderOrder;
                j.group.add(mesh);
            }
            function addLinerWallSet(material, height, centerY, offset, thickness, renderOrder) {
                const zBack = -boardInnerHalfZ + offset;
                const zFront = boardInnerHalfZ - offset;
                const xLeft = -boardInnerHalfX + offset;
                const xRight = boardInnerHalfX - offset;
                const minWallSegment = 0.12;
                const blockPad = renderOrder >= 30 ? 0.04 : 0.025;
                const cornerOverlap = renderOrder >= 30 ? 0.08 : 0.035;
                const narrowGap = renderOrder >= 30 ? 0.22 : 0.16;
                const seamOverlap = renderOrder >= 30 ? 0.018 : 0.012;
                const obstacles = (fabricationModel.pieces || [])
                    .filter(p => p.family === 'Lambourde' || p.family === 'TreillisPost')
                    .map(p => {
                        const halfX = Math.max(0.01, (p.dim.L || 0.01) / 2);
                        const halfZ = Math.max(0.01, ((p.dim.W !== undefined ? p.dim.W : p.dim.T) || 0.01) / 2);
                        return {
                            family: p.family,
                            xMin: p.pos.x - halfX,
                            xMax: p.pos.x + halfX,
                            zMin: p.pos.z - halfZ,
                            zMax: p.pos.z + halfZ,
                            cx: p.pos.x,
                            cz: p.pos.z,
                            w: halfX * 2,
                            d: halfZ * 2
                        };
                    });

                function addSegmentedZWall(z, isBack) {
                    const wallEdge = isBack ? -boardInnerHalfZ : boardInnerHalfZ;
                    const blocks = obstacles
                        .filter(o => isBack ? o.zMin <= wallEdge + 0.08 : o.zMax >= wallEdge - 0.08)
                        .map(o => [Math.max(-boardInnerHalfX - cornerOverlap, o.xMin - blockPad), Math.min(boardInnerHalfX + cornerOverlap, o.xMax + blockPad)])
                        .sort((a, b) => a[0] - b[0]);
                    let cursor = -boardInnerHalfX - cornerOverlap;
                    blocks.forEach(([from, to]) => {
                        if(from > cursor + minWallSegment) {
                            const w = from - cursor;
                            addLinerPanel(material, [w, height, thickness], [cursor + w / 2, centerY, z], renderOrder);
                        }
                        cursor = Math.max(cursor, to);
                    });
                    if(boardInnerHalfX + cornerOverlap > cursor + minWallSegment) {
                        const w = boardInnerHalfX + cornerOverlap - cursor;
                        addLinerPanel(material, [w, height, thickness], [cursor + w / 2, centerY, z], renderOrder);
                    }
                }

                function addSegmentedXWall(x, isLeft) {
                    const wallEdge = isLeft ? -boardInnerHalfX : boardInnerHalfX;
                    const blocks = obstacles
                        .filter(o => isLeft ? o.xMin <= wallEdge + 0.08 : o.xMax >= wallEdge - 0.08)
                        .map(o => [Math.max(-boardInnerHalfZ - cornerOverlap, o.zMin - blockPad), Math.min(boardInnerHalfZ + cornerOverlap, o.zMax + blockPad)])
                        .sort((a, b) => a[0] - b[0]);
                    const merged = [];
                    blocks.forEach(block => {
                        const last = merged[merged.length - 1];
                        if(last && block[0] <= last[1] + 0.04) last[1] = Math.max(last[1], block[1]);
                        else merged.push(block);
                    });
                    let cursor = -boardInnerHalfZ - cornerOverlap;
                    merged.forEach(([from, to]) => {
                        if(from > cursor + minWallSegment) {
                            const d = from - cursor;
                            addLinerPanel(material, [thickness, height, d], [x, centerY, cursor + d / 2], renderOrder);
                        }
                        cursor = Math.max(cursor, to);
                    });
                    if(boardInnerHalfZ + cornerOverlap > cursor + minWallSegment) {
                        const d = boardInnerHalfZ + cornerOverlap - cursor;
                        addLinerPanel(material, [thickness, height, d], [x, centerY, cursor + d / 2], renderOrder);
                    }
                }

                function rangesOverlap(aMin, aMax, bMin, bMax) {
                    return Math.min(aMax, bMax) - Math.max(aMin, bMin) > 0.025;
                }

                function rangesOverlapOrNear(aMin, aMax, bMin, bMax, near = narrowGap) {
                    const overlap = Math.min(aMax, bMax) - Math.max(aMin, bMin);
                    if(overlap > -near) return true;
                    return false;
                }

                function hasCloseObstacle(o, dir) {
                    return obstacles.some(other => {
                        if(other === o) return false;
                        if(dir === 'back') {
                            const gap = o.zMin - other.zMax;
                            return gap > 0 && gap < narrowGap && rangesOverlap(o.xMin, o.xMax, other.xMin, other.xMax);
                        }
                        if(dir === 'front') {
                            const gap = other.zMin - o.zMax;
                            return gap > 0 && gap < narrowGap && rangesOverlap(o.xMin, o.xMax, other.xMin, other.xMax);
                        }
                        if(dir === 'left') {
                            const gap = o.xMin - other.xMax;
                            return gap > 0 && gap < narrowGap && rangesOverlap(o.zMin, o.zMax, other.zMin, other.zMax);
                        }
                        const gap = other.xMin - o.xMax;
                        return gap > 0 && gap < narrowGap && rangesOverlap(o.zMin, o.zMax, other.zMin, other.zMax);
                    });
                }

                function shouldWrapObstacleFace(o, dir) {
                    if(o.family !== 'TreillisPost') return !hasCloseObstacle(o, dir);
                    if(dir === 'back') return o.cz > 0.05;
                    if(dir === 'front') return o.cz < -0.05;
                    if(dir === 'left') return o.cx > 0.05;
                    return o.cx < -0.05;
                }

                function addObstacleZFace(o, z, dir) {
                    const blocks = o.family === 'Lambourde'
                        ? obstacles
                            .filter(other => other.family === 'TreillisPost' && rangesOverlap(o.xMin, o.xMax, other.xMin, other.xMax) && rangesOverlapOrNear(o.zMin, o.zMax, other.zMin, other.zMax))
                            .map(other => [Math.max(o.xMin, other.xMin - blockPad), Math.min(o.xMax, other.xMax + blockPad)])
                            .sort((a, b) => a[0] - b[0])
                        : [];
                    let cursor = o.xMin - seamOverlap / 2;
                    blocks.forEach(([from, to]) => {
                        if(from > cursor + 0.045) {
                            const w = from - cursor;
                            addLinerPanel(material, [w, height, thickness], [cursor + w / 2, centerY, z], renderOrder);
                        }
                        cursor = Math.max(cursor, to);
                    });
                    const end = o.xMax + seamOverlap / 2;
                    if(end > cursor + 0.045) {
                        const w = end - cursor;
                        addLinerPanel(material, [w, height, thickness], [cursor + w / 2, centerY, z], renderOrder);
                    }
                }

                function addObstacleXFace(o, x, dir) {
                    const blocks = o.family === 'Lambourde'
                        ? obstacles
                            .filter(other => other.family === 'TreillisPost' && rangesOverlapOrNear(o.xMin, o.xMax, other.xMin, other.xMax) && rangesOverlap(o.zMin, o.zMax, other.zMin, other.zMax))
                            .map(other => [Math.max(o.zMin, other.zMin - blockPad), Math.min(o.zMax, other.zMax + blockPad)])
                            .sort((a, b) => a[0] - b[0])
                        : [];
                    let cursor = o.zMin - seamOverlap / 2;
                    blocks.forEach(([from, to]) => {
                        if(from > cursor + 0.045) {
                            const d = from - cursor;
                            addLinerPanel(material, [thickness, height, d], [x, centerY, cursor + d / 2], renderOrder);
                        }
                        cursor = Math.max(cursor, to);
                    });
                    const end = o.zMax + seamOverlap / 2;
                    if(end > cursor + 0.045) {
                        const d = end - cursor;
                        addLinerPanel(material, [thickness, height, d], [x, centerY, cursor + d / 2], renderOrder);
                    }
                }

                addSegmentedZWall(zBack, true);
                addSegmentedZWall(zFront, false);
                addSegmentedXWall(xLeft, true);
                addSegmentedXWall(xRight, false);

                obstacles.forEach(o => {
                    const closeToBack = o.zMin <= -boardInnerHalfZ + 0.08;
                    const closeToFront = o.zMax >= boardInnerHalfZ - 0.08;
                    const closeToLeft = o.xMin <= -boardInnerHalfX + 0.08;
                    const closeToRight = o.xMax >= boardInnerHalfX - 0.08;
                    if(!closeToBack && shouldWrapObstacleFace(o, 'back') && o.zMin > -boardInnerHalfZ + minWallSegment) addObstacleZFace(o, o.zMin - offset, 'back');
                    if(!closeToFront && shouldWrapObstacleFace(o, 'front') && o.zMax < boardInnerHalfZ - minWallSegment) addObstacleZFace(o, o.zMax + offset, 'front');
                    if(!closeToLeft && shouldWrapObstacleFace(o, 'left') && o.xMin > -boardInnerHalfX + minWallSegment) addObstacleXFace(o, o.xMin - offset, 'left');
                    if(!closeToRight && shouldWrapObstacleFace(o, 'right') && o.xMax < boardInnerHalfX - minWallSegment) addObstacleXFace(o, o.xMax + offset, 'right');
                });
            }

            const visibleLayer = normalizeLayerView(j.layerView);
            const visibleLayerIndex = LAYER_VIEW_STEPS.indexOf(visibleLayer);
            const renderGeotextile = visibleLayerIndex >= LAYER_VIEW_STEPS.indexOf('geotextile');
            const renderEpdm = visibleLayerIndex >= LAYER_VIEW_STEPS.indexOf('epdm');
            const renderGravel = visibleLayer === 'gravel';
            const renderSoil = visibleLayer === 'soil';
            const renderMulch = visibleLayer === 'mulch';

            if(renderGeotextile) {
                const geoBottom = new THREE.Mesh(new THREE.BoxGeometry(Math.max(innerW, 0.1), 0.018, Math.max(innerD, 0.1)), geoMat);
                geoBottom.position.set(0, linerBottomY, 0);
                geoBottom.receiveShadow = true;
                geoBottom.castShadow = true;
                geoBottom.renderOrder = 20;
                j.group.add(geoBottom);

                const geoReturnH = Math.min(linerH * 0.3, 0.9);
                addLinerWallSet(geoMat, geoReturnH, linerBottomY + geoReturnH / 2, 0.006, 0.014, 20);
            }

            if(renderEpdm) {
                addLinerWallSet(epdmMat, linerH, linerCenterY, 0.028, 0.018, 30);
            }

            if(renderGravel) {
                const gravelGroup = new THREE.Group();
                function drawTileCopies(ctx, tileSize, x, y, radius, drawFn) {
                    [-tileSize, 0, tileSize].forEach(dx => {
                        [-tileSize, 0, tileSize].forEach(dy => {
                            if(x + dx > -radius && x + dx < tileSize + radius && y + dy > -radius && y + dy < tileSize + radius) {
                                drawFn(x + dx, y + dy);
                            }
                        });
                    });
                }
                const clayCanvas = document.createElement('canvas');
                clayCanvas.width = 256;
                clayCanvas.height = 256;
                const clayCtx = clayCanvas.getContext('2d');
                const clayTile = 256;
                const clayImage = clayCtx.createImageData(clayTile, clayTile);
                for(let py = 0; py < clayTile; py++) {
                    for(let px = 0; px < clayTile; px++) {
                        const n =
                            Math.sin((px / clayTile) * Math.PI * 2) * 0.12 +
                            Math.cos((py / clayTile) * Math.PI * 2) * 0.11 +
                            Math.sin(((px - py) / clayTile) * Math.PI * 2) * 0.08;
                        const shade = 0.9 + n;
                        const i = (py * clayTile + px) * 4;
                        clayImage.data[i] = Math.max(90, Math.min(190, 139 * shade));
                        clayImage.data[i + 1] = Math.max(45, Math.min(110, 74 * shade));
                        clayImage.data[i + 2] = Math.max(24, Math.min(70, 40 * shade));
                        clayImage.data[i + 3] = 255;
                    }
                }
                clayCtx.putImageData(clayImage, 0, 0);
                for(let ci = 0; ci < 120; ci++) {
                    const x = Math.random() * clayTile;
                    const y = Math.random() * clayTile;
                    const r = 8 + Math.random() * 15;
                    drawTileCopies(clayCtx, clayTile, x, y, r, (tx, ty) => {
                        const grad = clayCtx.createRadialGradient(tx - r * 0.35, ty - r * 0.35, r * 0.15, tx, ty, r);
                        grad.addColorStop(0, '#d18446');
                        grad.addColorStop(0.55, '#a85b2f');
                        grad.addColorStop(1, '#6d351c');
                        clayCtx.fillStyle = grad;
                        clayCtx.beginPath();
                        clayCtx.arc(tx, ty, r, 0, Math.PI * 2);
                        clayCtx.fill();
                    });
                }
                const clayTexture = new THREE.CanvasTexture(clayCanvas);
                clayTexture.wrapS = THREE.RepeatWrapping;
                clayTexture.wrapT = THREE.RepeatWrapping;
                clayTexture.repeat.set(Math.max(innerW / 3.2, 1), Math.max(innerD / 3.2, 1));
                clayTexture.offset.set(Math.random(), Math.random());
                clayTexture.colorSpace = THREE.SRGBColorSpace;
                const clayMat = new THREE.MeshStandardMaterial({
                    map: clayTexture,
                    color: 0xffffff,
                    roughness: 0.96,
                    metalness: 0.0
                });
                const clayBase = new THREE.Mesh(
                    new THREE.BoxGeometry(Math.max(innerW - 0.12, 0.1), MATERIAL_LAYER_THICKNESS_DM.clayPebbles, Math.max(innerD - 0.12, 0.1)),
                    clayMat
                );
                clayBase.position.set(0, linerBottomY + MATERIAL_LAYER_THICKNESS_DM.clayPebbles / 2, 0);
                clayBase.receiveShadow = true;
                clayBase.castShadow = true;
                clayBase.renderOrder = 22;
                gravelGroup.add(clayBase);

                const gravelPalette = [0x9a4f27, 0xb66432, 0x7d3f20, 0xc0763d, 0x8b4a28];
                const gravelMats = gravelPalette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0.02 }));
                const gravelCount = Math.max(8, Math.min(24, Math.round((innerW * innerD) * 0.35)));
                const gravelGeo = new THREE.SphereGeometry(0.075, 8, 6);
                const dummy = new THREE.Object3D();
                const buckets = gravelMats.map((mat, matIdx) => {
                    const count = Math.ceil((gravelCount - matIdx) / gravelMats.length);
                    const mesh = new THREE.InstancedMesh(gravelGeo, mat, Math.max(0, count));
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.renderOrder = 22;
                    gravelGroup.add(mesh);
                    return { mesh, index: 0 };
                });
                for(let gi = 0; gi < gravelCount; gi++) {
                    const bucket = buckets[gi % buckets.length];
                    const gx = (Math.random() - 0.5) * Math.max(innerW - 0.22, 0.1);
                    const gz = (Math.random() - 0.5) * Math.max(innerD - 0.22, 0.1);
                    dummy.position.set(gx, linerBottomY + 0.25 + Math.random() * 0.08, gz);
                    dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    const clayScale = 0.72 + Math.random() * 0.5;
                    dummy.scale.set(clayScale, clayScale * (0.78 + Math.random() * 0.22), clayScale);
                    dummy.updateMatrix();
                    bucket.mesh.setMatrixAt(bucket.index++, dummy.matrix);
                }
                buckets.forEach(bucket => {
                    bucket.mesh.count = bucket.index;
                    bucket.mesh.instanceMatrix.needsUpdate = true;
                });
                gravelGroup.renderOrder = 22;
                j.group.add(gravelGroup);
            }

            // Terreau: posé au-dessus du sommier, légèrement sous le haut de cuve.
            if(renderSoil) {
                const materialLayers = getJardiniereMaterialLayerHeightsDm(j, metrics);
                const soilLayerH = Math.max(0.08, materialLayers.plantingMix);
                const soilCanvas = document.createElement('canvas');
                soilCanvas.width = 256;
                soilCanvas.height = 256;
                const soilCtx = soilCanvas.getContext('2d');
                const soilTile = 256;
                const soilImage = soilCtx.createImageData(soilTile, soilTile);
                for(let py = 0; py < soilTile; py++) {
                    for(let px = 0; px < soilTile; px++) {
                        const n =
                            Math.sin((px / soilTile) * Math.PI * 2) * 0.1 +
                            Math.cos((py / soilTile) * Math.PI * 2) * 0.09 +
                            Math.sin(((px + py) / soilTile) * Math.PI * 2) * 0.07;
                        const shade = 0.82 + n;
                        const i = (py * soilTile + px) * 4;
                        soilImage.data[i] = Math.max(8, Math.min(42, 22 * shade));
                        soilImage.data[i + 1] = Math.max(7, Math.min(34, 18 * shade));
                        soilImage.data[i + 2] = Math.max(5, Math.min(26, 13 * shade));
                        soilImage.data[i + 3] = 255;
                    }
                }
                soilCtx.putImageData(soilImage, 0, 0);
                const drawSoilCopies = (x, y, radius, drawFn) => {
                    [-soilTile, 0, soilTile].forEach(dx => {
                        [-soilTile, 0, soilTile].forEach(dy => {
                            if(x + dx > -radius && x + dx < soilTile + radius && y + dy > -radius && y + dy < soilTile + radius) {
                                drawFn(x + dx, y + dy);
                            }
                        });
                    });
                };
                for(let si = 0; si < 160; si++) {
                    const x = Math.random() * soilTile;
                    const y = Math.random() * soilTile;
                    const r = 1.5 + Math.random() * 5;
                    drawSoilCopies(x, y, r, (tx, ty) => {
                        soilCtx.fillStyle = ['rgba(70,55,40,0.38)', 'rgba(8,8,7,0.34)', 'rgba(95,78,55,0.24)'][si % 3];
                        soilCtx.beginPath();
                        soilCtx.arc(tx, ty, r, 0, Math.PI * 2);
                        soilCtx.fill();
                    });
                }
                const soilTexture = new THREE.CanvasTexture(soilCanvas);
                soilTexture.wrapS = THREE.RepeatWrapping;
                soilTexture.wrapT = THREE.RepeatWrapping;
                soilTexture.repeat.set(Math.max(innerW / 3.4, 1), Math.max(innerD / 3.4, 1));
                soilTexture.offset.set(Math.random(), Math.random());
                soilTexture.colorSpace = THREE.SRGBColorSpace;
                const soil = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        Math.max(metrics.longBoardLen - 0.14, 0.6),
                        soilLayerH,
                        Math.max(metrics.outerD - 2 * metrics.construction.boardThickness - 0.14, 0.6)
                    ),
                    new THREE.MeshStandardMaterial({ map: soilTexture, color: 0xffffff, roughness: 1 })
                );
                soil.position.y = linerBottomY + materialLayers.clayPebbles + soilLayerH / 2;
                soil.receiveShadow = true;
                soil.castShadow = true;
                j.group.add(soil);

                const soilClodPalette = [0x15110d, 0x21180f, 0x2b2116, 0x100d0b];
                const soilClodMats = soilClodPalette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 1, metalness: 0 }));
                const soilClodGeo = new THREE.DodecahedronGeometry(0.055, 0);
                const soilClodCount = Math.max(8, Math.min(28, Math.round((innerW * innerD) * 0.45)));
                const soilDummy = new THREE.Object3D();
                const soilBuckets = soilClodMats.map((mat, matIdx) => {
                    const count = Math.ceil((soilClodCount - matIdx) / soilClodMats.length);
                    const mesh = new THREE.InstancedMesh(soilClodGeo, mat, Math.max(0, count));
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.renderOrder = 23;
                    j.group.add(mesh);
                    return { mesh, index: 0 };
                });
                for(let si = 0; si < soilClodCount; si++) {
                    const bucket = soilBuckets[si % soilBuckets.length];
                    const x = (Math.random() - 0.5) * Math.max(innerW - 0.28, 0.1);
                    const z = (Math.random() - 0.5) * Math.max(innerD - 0.28, 0.1);
                    soilDummy.position.set(x, soil.position.y + 0.12 + Math.random() * 0.035, z);
                    soilDummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
                    soilDummy.scale.set(0.45 + Math.random() * 0.85, 0.18 + Math.random() * 0.32, 0.45 + Math.random() * 0.85);
                    soilDummy.updateMatrix();
                    bucket.mesh.setMatrixAt(bucket.index++, soilDummy.matrix);
                }
                soilBuckets.forEach(bucket => {
                    bucket.mesh.count = bucket.index;
                    bucket.mesh.instanceMatrix.needsUpdate = true;
                });
            }

            if(renderMulch) {
                const mulchLayerH = MATERIAL_LAYER_THICKNESS_DM.mulch;
                const mulchTopY = metrics.postHeight - 0.03;
                const mulchCanvas = document.createElement('canvas');
                mulchCanvas.width = 256;
                mulchCanvas.height = 256;
                const mulchCtx = mulchCanvas.getContext('2d');
                const tileSize = 256;
                const baseImage = mulchCtx.createImageData(tileSize, tileSize);
                for(let py = 0; py < tileSize; py++) {
                    for(let px = 0; px < tileSize; px++) {
                        const n =
                            Math.sin((px / tileSize) * Math.PI * 2.4) * 0.14 +
                            Math.cos((py / tileSize) * Math.PI * 3.1) * 0.12 +
                            Math.sin(((px + py) / tileSize) * Math.PI * 3.7) * 0.08 +
                            Math.sin(((px * 1.9 - py * 0.7) / tileSize) * Math.PI * 8.0) * 0.035;
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
                            if(x + dx > -radius && x + dx < tileSize + radius && y + dy > -radius && y + dy < tileSize + radius) {
                                drawFn(x + dx, y + dy);
                            }
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

                for(let cloud = 0; cloud < 8; cloud++) {
                    const x = Math.random() * tileSize;
                    const y = Math.random() * tileSize;
                    const r = 35 + Math.random() * 90;
                    withTileCopies(x, y, r, (tx, ty) => {
                        const grad = mulchCtx.createRadialGradient(tx, ty, 0, tx, ty, r);
                        grad.addColorStop(0, 'rgba(95,54,28,0.24)');
                        grad.addColorStop(0.55, 'rgba(45,22,10,0.12)');
                        grad.addColorStop(1, 'rgba(10,5,3,0)');
                        mulchCtx.fillStyle = grad;
                        mulchCtx.beginPath();
                        mulchCtx.arc(tx, ty, r, 0, Math.PI * 2);
                        mulchCtx.fill();
                    });
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
                const mulch = new THREE.Mesh(
                    new THREE.BoxGeometry(
                        Math.max(metrics.longBoardLen - 0.18, 0.6),
                        mulchLayerH,
                        Math.max(metrics.outerD - 2 * metrics.construction.boardThickness - 0.18, 0.6)
                    ),
                    mulchMat
                );
                mulch.position.y = mulchTopY - mulchLayerH / 2;
                mulch.receiveShadow = true;
                mulch.castShadow = true;
                mulch.renderOrder = 24;
                j.group.add(mulch);

                const chipPalette = [0x2b160c, 0x3a2113, 0x4a2a17, 0x1b1009, 0x5b3520, 0x24140b, 0x6a452d];
                const chipMats = chipPalette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.97, metalness: 0.0 }));
                const chipGeo = new THREE.BoxGeometry(0.42, 0.022, 0.055);
                const chipCount = Math.max(44, Math.min(150, Math.round((innerW * innerD) * 2.0)));
                const chipDummy = new THREE.Object3D();
                const chipBuckets = chipMats.map((mat, matIdx) => {
                    const count = Math.ceil((chipCount - matIdx) / chipMats.length);
                    const mesh = new THREE.InstancedMesh(chipGeo, mat, Math.max(0, count));
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    mesh.renderOrder = 25;
                    j.group.add(mesh);
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
            }

            // Spots et guirlandes sur treillis
            const hasAnyTreillis = (j.treillisBack !== false && (j.treillisBack || j.hasTreillis)) || j.treillisLeft || j.treillisRight;
            const showTreillisSpots = hasTreillisSpots(j);
            const showWhiteGarland = hasTreillisWhiteGarland(j);
            const showGinguetteGarland = hasTreillisGinguette(j);
            if((showTreillisSpots || showWhiteGarland || showGinguetteGarland) && hasAnyTreillis) {
                const optimizedLighting = isOptimized3DLightingMode();
                const exposureFactor = typeof getDecorativeSpotExposureFactor === 'function' ? getDecorativeSpotExposureFactor() : 1;
                const target = new THREE.Object3D();
                const lightTargetY = visibleLayer === 'mulch'
                    ? metrics.postHeight - 0.03
                    : (visibleLayer === 'soil' ? metrics.postHeight - 0.18 : metrics.soilY);
                target.position.set(0, lightTargetY, 0);
                j.group.add(target);

                const topY = metrics.postHeight + j.treillisH + 0.25;
                const spotOffset = 0.35; // déport du treillis vers l'intérieur (35 cm)
                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;

                if(showTreillisSpots) {
                    let positions = [];
                    if(hasBack) {
                        positions = [[-j.w * 0.28, topY, -j.d/2 + spotOffset], [j.w * 0.28, topY, -j.d/2 + spotOffset]];
                    } else if(j.treillisLeft && j.treillisRight) {
                        positions = [[-j.w/2 + spotOffset, topY, 0], [j.w/2 - spotOffset, topY, 0]];
                    } else if(j.treillisLeft) {
                        positions = [[-j.w/2 + spotOffset, topY, -j.d * 0.2], [-j.w/2 + spotOffset, topY, j.d * 0.2]];
                    } else if(j.treillisRight) {
                        positions = [[j.w/2 - spotOffset, topY, -j.d * 0.2], [j.w/2 - spotOffset, topY, j.d * 0.2]];
                    }

                    const spotBodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.6, metalness: 0.4 });
                    const spotLensMat = new THREE.MeshStandardMaterial({ color: 0xfff8d6, emissive: 0xffcc55, emissiveIntensity: optimizedLighting ? 0.55 : 1.2, roughness: 0.2 });

                    positions.forEach(([x, y, z]) => {
                        const baseIntensity = optimizedLighting ? 0.85 : 2.1;
                        const spot = new THREE.SpotLight(0xffefc6, baseIntensity * exposureFactor, optimizedLighting ? 22 : 36, 0.88, 0.28, 1.35);
                        spot.userData.decorativeExposureLight = true;
                        spot.userData.decorBaseIntensity = baseIntensity;
                        spot.position.set(x, y, z);
                        spot.target = target;
                        spot.castShadow = !optimizedLighting;
                        if(spot.castShadow) {
                            spot.shadow.mapSize.width = 512;
                            spot.shadow.mapSize.height = 512;
                            spot.shadow.bias = -0.0003;
                            spot.shadow.radius = 2;
                        }
                        j.group.add(spot);

                        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.18, 12), spotBodyMat);
                        body.position.set(x, y, z);
                        body.castShadow = false;
                        j.group.add(body);

                        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), spotBodyMat);
                        cap.position.set(x, y + 0.09, z);
                        j.group.add(cap);

                        const lensBaseEmissive = optimizedLighting ? 0.55 : 1.2;
                        const lensMat = spotLensMat.clone();
                        lensMat.emissiveIntensity = lensBaseEmissive * exposureFactor;
                        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.065, 12), lensMat);
                        lens.userData.decorativeExposureLens = true;
                        lens.userData.decorBaseEmissiveIntensity = lensBaseEmissive;
                        lens.rotation.x = Math.PI / 2;
                        lens.position.set(x, y - 0.09, z);
                        j.group.add(lens);
                    });
                }

                const bulbGeo = new THREE.SphereGeometry(0.09, 10, 10);
                const warmBulbMat = new THREE.MeshStandardMaterial({
                    color: 0xfff1c9,
                    emissive: 0xffcc77,
                    emissiveIntensity: 1.15 * exposureFactor
                });
                const ginguettePalette = [0xff1111, 0xff8800, 0x0088ff, 0x00dd33, 0xff00cc, 0xffdd00];
                const ginguetteMatCache = {};

                function getBulbMaterial(index) {
                    if(!showGinguetteGarland) return warmBulbMat;
                    const color = ginguettePalette[index % ginguettePalette.length];
                    if(!ginguetteMatCache[color]) {
                        ginguetteMatCache[color] = new THREE.MeshStandardMaterial({
                            color,
                            emissive: color,
                            emissiveIntensity: 2.5 * exposureFactor,
                            roughness: 0.1,
                            metalness: 0.0
                        });
                    }
                    return ginguetteMatCache[color];
                }

                function getBulbLightColor(index) {
                    return showGinguetteGarland
                        ? ginguettePalette[index % ginguettePalette.length]
                        : 0xffd98f;
                }

                function addGarland(from, to, count = 8) {
                    const points = [];
                    let bulbIndex = 0;
                    for(let i = 0; i <= count; i++) {
                        const t = i / count;
                        const x = from.x + (to.x - from.x) * t;
                        const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 0.22;
                        const z = from.z + (to.z - from.z) * t;
                        points.push(new THREE.Vector3(x, y, z));

                        if(i % 2 === 0) {
                            const bulb = new THREE.Mesh(bulbGeo, getBulbMaterial(bulbIndex));
                            bulb.userData.decorativeExposureLens = true;
                            bulb.userData.decorBaseEmissiveIntensity = showGinguetteGarland ? 2.5 : 1.15;
                            bulb.position.set(x, y, z);
                            bulb.castShadow = false;
                            bulb.receiveShadow = false;
                            j.group.add(bulb);

                            if(!optimizedLighting) {
                                const baseGlowIntensity = 0.5;
                                const glow = new THREE.PointLight(getBulbLightColor(bulbIndex), baseGlowIntensity * exposureFactor, 4.5);
                                glow.userData.decorativeExposureLight = true;
                                glow.userData.decorBaseIntensity = baseGlowIntensity;
                                glow.position.set(x, y, z);
                                j.group.add(glow);
                            }
                            bulbIndex += 1;
                        }
                    }
                    if(optimizedLighting) {
                        const midX = (from.x + to.x) / 2;
                        const midY = (from.y + to.y) / 2 - 0.18;
                        const midZ = (from.z + to.z) / 2;
                        const baseFillIntensity = 0.24;
                        const fill = new THREE.PointLight(showGinguetteGarland ? 0xffd68a : 0xffd98f, baseFillIntensity * exposureFactor, Math.max(3.2, count * 0.42));
                        fill.userData.decorativeExposureLight = true;
                        fill.userData.decorBaseIntensity = baseFillIntensity;
                        fill.position.set(midX, midY, midZ);
                        j.group.add(fill);
                    }
                    const wire = new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(points),
                        new THREE.LineBasicMaterial({ color: 0x3b2b20 })
                    );
                    j.group.add(wire);
                }

                const yTop = topY - 0.08;
                const backOn = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
                if(showWhiteGarland || showGinguetteGarland) {
                    if(backOn) {
                        addGarland(
                            { x: -j.w / 2, y: yTop, z: -j.d/2 + spotOffset },
                            { x: j.w / 2, y: yTop, z: -j.d/2 + spotOffset },
                            10
                        );
                    }
                    if(j.treillisLeft) {
                        addGarland(
                            { x: -j.w/2 + spotOffset, y: yTop, z: -j.d / 2 },
                            { x: -j.w/2 + spotOffset, y: yTop, z: j.d / 2 },
                            8
                        );
                    }
                    if(j.treillisRight) {
                        addGarland(
                            { x: j.w/2 - spotOffset, y: yTop, z: -j.d / 2 },
                            { x: j.w/2 - spotOffset, y: yTop, z: j.d / 2 },
                            8
                        );
                    }
                }
            }

            const garlandAnchors = getGarlandAnchors(j, metrics);
            const customGarlandLinks = normalizeGarlandLinks(j.garlandLinks).filter(link => {
                const from = getGarlandLinkEndpoint(link, 'from', j);
                const to = getGarlandLinkEndpoint(link, 'to', j);
                return !!(from && to);
            });
            if(garlandAnchors.some(anchor => anchor.kind === 'post') || customGarlandLinks.length > 0) {
                const optimizedLighting = isOptimized3DLightingMode();
                const exposureFactor = typeof getDecorativeSpotExposureFactor === 'function' ? getDecorativeSpotExposureFactor() : 1;
                const postMat = new THREE.MeshStandardMaterial({ color: 0x2a2722, roughness: 0.75, metalness: 0.15 });
                const postGeo = new THREE.BoxGeometry(0.16, 1, 0.16);
                garlandAnchors.filter(anchor => anchor.kind === 'post').forEach(anchor => {
                    const post = new THREE.Mesh(postGeo, postMat);
                    post.scale.y = Math.max(0.5, anchor.y - metrics.postHeight + 0.15);
                    post.position.set(anchor.x, metrics.postHeight + post.scale.y / 2 - 0.04, anchor.z);
                    post.castShadow = true;
                    post.receiveShadow = true;
                    j.group.add(post);
                });

                const bulbGeo = new THREE.SphereGeometry(0.075, 10, 10);
                const bulbMat = new THREE.MeshStandardMaterial({
                    color: 0xfff1c9,
                    emissive: 0xffcc77,
                    emissiveIntensity: (optimizedLighting ? 0.85 : 1.15) * exposureFactor
                });
                function addCustomGarland(from, to, count = 9) {
                    const points = [];
                    const horizontalDistance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.z - from.z, 2));
                    const sag = Math.max(0.38, Math.min(0.95, horizontalDistance * 0.11));
                    const bulbBaseEmissive = optimizedLighting ? 0.85 : 1.15;
                    for(let i = 0; i <= count; i++) {
                        const t = i / count;
                        const x = from.x + (to.x - from.x) * t;
                        const y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * sag;
                        const z = from.z + (to.z - from.z) * t;
                        points.push(new THREE.Vector3(x, y, z));
                        if(i % 2 === 0) {
                            const bulb = new THREE.Mesh(bulbGeo, bulbMat);
                            bulb.userData.decorativeExposureLens = true;
                            bulb.userData.decorBaseEmissiveIntensity = bulbBaseEmissive;
                            bulb.position.set(x, y, z);
                            bulb.castShadow = false;
                            bulb.receiveShadow = false;
                            j.group.add(bulb);
                            if(!optimizedLighting) {
                                const baseGlowIntensity = 0.42;
                                const glow = new THREE.PointLight(0xffd98f, baseGlowIntensity * exposureFactor, 4);
                                glow.userData.decorativeExposureLight = true;
                                glow.userData.decorBaseIntensity = baseGlowIntensity;
                                glow.position.set(x, y, z);
                                j.group.add(glow);
                            }
                        }
                    }
                    if(optimizedLighting) {
                        const mid = points[Math.floor(points.length / 2)];
                        const baseFillIntensity = 0.2;
                        const fill = new THREE.PointLight(0xffd98f, baseFillIntensity * exposureFactor, Math.max(3.2, count * 0.38));
                        fill.userData.decorativeExposureLight = true;
                        fill.userData.decorBaseIntensity = baseFillIntensity;
                        fill.position.copy(mid);
                        j.group.add(fill);
                    }
                    j.group.add(new THREE.Line(
                        new THREE.BufferGeometry().setFromPoints(points),
                        new THREE.LineBasicMaterial({ color: 0x3b2b20 })
                    ));
                }

                customGarlandLinks.forEach(link => {
                    const fromRef = getGarlandLinkEndpoint(link, 'from', j);
                    const toRef = getGarlandLinkEndpoint(link, 'to', j);
                    const fromWorld = getGarlandAnchorWorld3D(fromRef);
                    const toWorld = getGarlandAnchorWorld3D(toRef);
                    if(!fromWorld || !toWorld) return;
                    const from = fromRef.j === j ? fromRef.anchor : worldToJardLocal3D(j, fromWorld);
                    const to = toRef.j === j ? toRef.anchor : worldToJardLocal3D(j, toWorld);
                    const distance = Math.sqrt(Math.pow(to.x - from.x, 2) + Math.pow(to.z - from.z, 2));
                    addCustomGarland(from, to, Math.max(6, Math.min(14, Math.round(distance * 1.4))));
                });
            }

            // Re-ajouter les plantes visuelles
            j.plants.forEach(p => {
                const pView = buildPlantMesh(p, j);
                j.group.add(pView);
            });

            j.group.position.copy(j.pos);
            j.group.rotation.y = j.rot;
            (balconySceneGroup || scene).add(j.group);
            refreshFabricationAndPricing();
            renderLiveTechnicalPlans();
            rebuildButterflies();
        }

        function buildPlantMesh(p, j) {
            const g = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: p.color, side: THREE.DoubleSide, roughness: 0.85 });
            const isDetailedPlant = jardinières.length <= 2 || j === selected2dJardiniere;
            const plantScale = p.onTreillis ? 1 : clampNumber(0.55 + seededUnit(p.scatterSeed || 1, 41) * 0.95, 0.5, 1.6);
            const count = p.onTreillis
                ? (isDetailedPlant ? 38 : 16)
                : (isDetailedPlant ? Math.round(16 + plantScale * 9) : Math.round(7 + plantScale * 4));
            const metrics = j.renderMetrics || computeJardiniereConstructionMetrics(j);
            g.userData.isPlantBush = true;
            g.userData.windPhase = Math.random() * Math.PI * 2;
            g.userData.windScale = 0.85 + Math.random() * 0.35;
            g.userData.baseRotX = 0;
            g.userData.baseRotZ = 0;
            g.userData.gustCurrent = 0;
            g.userData.gustTarget = 0;
            g.userData.gustHoldUntil = 0;
            g.userData.nextGustAt = windParams.gustEveryMin + Math.random() * (windParams.gustEveryMax - windParams.gustEveryMin);

            // Taille des feuilles : modifier leafSize pour agrandir/réduire (en dm)
            const leafSize = 0.3 * plantScale;
            const s = leafSize;

            // Forme de feuille pointue-ovale, réutilisée pour toutes les instances
            const leafShape = new THREE.Shape();
            leafShape.moveTo(0, s);
            leafShape.quadraticCurveTo(s * 0.54, s * 0.54, s * 0.375, 0);
            leafShape.quadraticCurveTo(s * 0.167, -s * 0.29, 0, -s * 0.46);
            leafShape.quadraticCurveTo(-s * 0.167, -s * 0.29, -s * 0.375, 0);
            leafShape.quadraticCurveTo(-s * 0.54, s * 0.54, 0, s);
            const leafGeo = new THREE.ShapeGeometry(leafShape, 4);
            const flowerCenterMat = new THREE.MeshStandardMaterial({ color: 0xf1c75b, roughness: 0.8, metalness: 0.0 });
            const flowerPalette = p.onTreillis
                ? (p.type === 'Jasmin' ? [0xfff7dc, 0xf7efd2, 0xfffbef] : [0x8050b7, 0x9b68d0, 0xc382d8])
                : [0xf5d04f, 0xe46f88, 0xf2a7c0, 0xffffff, 0x9462c9, 0xff8f4f];
            const flowerMats = flowerPalette.map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.72, metalness: 0.0, side: THREE.DoubleSide }));
            const flowerCenterGeo = new THREE.SphereGeometry(0.045, 8, 6);
            const flowerPetalGeo = new THREE.SphereGeometry(0.06, 8, 6);
            const flowerCount = p.onTreillis ? (isDetailedPlant ? 7 : 3) : (isDetailedPlant ? Math.max(2, Math.round(plantScale * 3)) : 1);

            function markStatic(mesh) {
                mesh.userData.staticPlantPart = true;
                return mesh;
            }

            function addFlower(x, y, z, scaleMul = 1) {
                const flower = new THREE.Group();
                flower.userData.staticPlantPart = true;
                const petalMat = flowerMats[Math.floor(Math.random() * flowerMats.length)];
                for(let pi = 0; pi < 5; pi++) {
                    const angle = (pi / 5) * Math.PI * 2;
                    const petal = markStatic(new THREE.Mesh(flowerPetalGeo, petalMat));
                    petal.position.set(Math.cos(angle) * 0.065 * scaleMul, Math.sin(angle) * 0.065 * scaleMul, 0);
                    petal.scale.set(1.05 * scaleMul, 0.48 * scaleMul, 0.18 * scaleMul);
                    petal.rotation.z = angle;
                    petal.castShadow = true;
                    petal.receiveShadow = true;
                    flower.add(petal);
                }
                const center = markStatic(new THREE.Mesh(flowerCenterGeo, flowerCenterMat));
                center.scale.setScalar(scaleMul);
                center.castShadow = true;
                center.receiveShadow = true;
                flower.add(center);
                flower.position.set(x, y, z);
                flower.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI * 2, (Math.random() - 0.5) * 0.5);
                flower.scale.setScalar(0.78 + Math.random() * 0.55);
                g.add(flower);
            }

            for(let i = 0; i < count; i++){
                const leaf = new THREE.Mesh(leafGeo, mat);
                leaf.castShadow = true;
                leaf.receiveShadow = true;
                // Orientation aléatoire complète
                leaf.rotation.set(
                    (Math.random() - 0.5) * Math.PI,
                    Math.random() * Math.PI * 2,
                    (Math.random() - 0.5) * Math.PI
                );
                leaf.userData.baseRotX = leaf.rotation.x;
                leaf.userData.baseRotY = leaf.rotation.y;
                leaf.userData.baseRotZ = leaf.rotation.z;
                leaf.userData.windPhase = Math.random() * Math.PI * 2;
                leaf.userData.windScale = 0.75 + Math.random() * 0.5;
                leaf.userData.gustFreq = 12 + Math.random() * 8;
                // fréquence propre : certaines lentes (0.3x), certaines rapides (2.5x)
                const isStillLeaf = Math.random() < 0.25;
                leaf.userData.leafAmpMult = isStillLeaf ? (Math.random() * 0.07) : (0.35 + Math.random() * 1.3);
                leaf.userData.leafFreqMult = isStillLeaf ? (0.05 + Math.random() * 0.2) : (0.25 + Math.random() * 2.2);
                if(p.onTreillis) {
                    // Distribuer sur tous les treillis actifs
                    const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
                    const activeSides = [];
                    if(hasBack)       activeSides.push('back');
                    if(j.treillisLeft)  activeSides.push('left');
                    if(j.treillisRight) activeSides.push('right');
                    if(activeSides.length === 0) return g;
                    const side = activeSides[i % activeSides.length];
                    const tY = metrics.soilY + 0.15 + Math.random() * j.treillisH;
                    if(side === 'back') {
                        leaf.position.set(
                            (Math.random() - 0.5) * j.w * 0.85,
                            tY,
                            -j.d / 2 + 0.1 + Math.random() * 0.35
                        );
                    } else if(side === 'left') {
                        leaf.position.set(
                            -j.w / 2 + 0.1 + Math.random() * 0.35,
                            tY,
                            (Math.random() - 0.5) * j.d * 0.85
                        );
                    } else {
                        leaf.position.set(
                            j.w / 2 - 0.1 - Math.random() * 0.35,
                            tY,
                            (Math.random() - 0.5) * j.d * 0.85
                        );
                    }
                } else {
                    const bounds = getPottedPlantBounds(j, 0.65);
                    const jitterX = (Math.random() - 0.5) * 0.95 * plantScale;
                    const jitterZ = (Math.random() - 0.5) * 0.95 * plantScale;
                    leaf.position.set(
                        clampNumber((p.x || 0) + jitterX, bounds.minX, bounds.maxX),
                        metrics.soilY + 0.12 + Math.random() * (0.85 + plantScale * 1.15),
                        clampNumber((p.z || 0) + jitterZ, bounds.minZ, bounds.maxZ)
                    );
	                }
	                g.add(leaf);
	            }
            if(p.onTreillis) {
                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
                const activeSides = [];
                if(hasBack) activeSides.push('back');
                if(j.treillisLeft) activeSides.push('left');
                if(j.treillisRight) activeSides.push('right');
                for(let fi = 0; fi < flowerCount && activeSides.length > 0; fi++) {
                    const side = activeSides[fi % activeSides.length];
                    const fy = metrics.soilY + 0.55 + Math.random() * Math.max(1, (j.treillisH || 8) * 0.82);
                    if(side === 'back') {
                        addFlower((Math.random() - 0.5) * j.w * 0.78, fy, -j.d / 2 + 0.18 + Math.random() * 0.26, 0.95);
                    } else if(side === 'left') {
                        addFlower(-j.w / 2 + 0.18 + Math.random() * 0.26, fy, (Math.random() - 0.5) * j.d * 0.78, 0.9);
                    } else {
                        addFlower(j.w / 2 - 0.18 - Math.random() * 0.26, fy, (Math.random() - 0.5) * j.d * 0.78, 0.9);
                    }
                }
            } else {
                const bounds = getPottedPlantBounds(j, 0.65);
                for(let fi = 0; fi < flowerCount; fi++) {
                    const fx = clampNumber((p.x || 0) + (Math.random() - 0.5) * 0.72 * plantScale, bounds.minX, bounds.maxX);
                    const fz = clampNumber((p.z || 0) + (Math.random() - 0.5) * 0.72 * plantScale, bounds.minZ, bounds.maxZ);
                    const fy = metrics.soilY + 0.55 + Math.random() * (0.85 + plantScale * 0.9);
                    addFlower(fx, fy, fz, 0.72 + plantScale * 0.18);
                }
            }
            g.position.y = 0;
            return g;
        }

        // Ajuste sunFar (bâtiments lointains) sur l'étendue du voisinage
        function updateShadowCamera() {
            if(!sunFar) return;
            const neighborhood = horizonSettings && horizonSettings.neighborhood;
            const buildings = (neighborhood && neighborhood.enabled && neighborhood.buildings) ? neighborhood.buildings : [];
            let maxExtent = 80;
            if(buildings.length) {
                const eye = getHorizonViewpoint2D ? getHorizonViewpoint2D() : { x: 0, y: 0 };
                const eyeX = eye.x / 20;
                const eyeZ = eye.y / 20;
                buildings.forEach(b => {
                    (b.footprint || []).forEach(pt => {
                        const wx = eyeX + pt.x * 10;
                        const wz = eyeZ + pt.z * 10;
                        const d = Math.sqrt(wx * wx + wz * wz);
                        if(d > maxExtent) maxExtent = d;
                    });
                });
                maxExtent = Math.ceil(maxExtent * 1.15);
            }
            // Plafond à 320 unités : au-delà, les texels de la shadow map 512×512
            // deviennent trop grands (>1 unité) et provoquent de l'acné de shadow map
            // visible sur la dalle et les façades. Les bâtiments très lointains n'ont
            // pas d'impact significatif sur l'ombrage du balcon.
            const shadowExtent = Math.min(320, maxExtent);
            const biasScale = shadowExtent / 80;
            if(sunFar.shadow.camera.right === shadowExtent) return;
            sunFar.shadow.camera.left = -shadowExtent;
            sunFar.shadow.camera.right = shadowExtent;
            sunFar.shadow.camera.top = shadowExtent;
            sunFar.shadow.camera.bottom = -shadowExtent;
            sunFar.shadow.camera.far = Math.max(1500, SUN_ORBIT_RADIUS + shadowExtent * 1.5);
            sunFar.shadow.normalBias = 0.05 * biasScale;
            sunFar.shadow.bias = -0.0003 * biasScale;
            sunFar.shadow.camera.updateProjectionMatrix();
        }

        // Cale le frustum de sun sur la scène visible, avec un minimum de ±25m garanti
        function fitNearShadowToView() {
            if(!sun || !camera || !sun.castShadow) return;
            const toSun = sun.position.clone().sub(sun.target.position).normalize();
            let lightUp = new THREE.Vector3(0, 1, 0);
            if(Math.abs(toSun.dot(lightUp)) > 0.99) lightUp.set(1, 0, 0);
            const lightRight = new THREE.Vector3().crossVectors(toSun, lightUp).normalize();
            const lightUp2   = new THREE.Vector3().crossVectors(lightRight, toSun).normalize();
            const camDist = controls ? camera.position.distanceTo(controls.target) : 60;
            const far  = Math.min(Math.max(camDist * 2.5, 60), 200);
            const near = camera.near;
            const tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);
            const tanW = tanH * camera.aspect;
            const camFwd = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 2).negate();
            const camR   = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
            const camU   = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1);
            const camPos = camera.position;
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            for(const d of [near, far]) {
                const cx = camPos.clone().addScaledVector(camFwd, d);
                const hw = d * tanW, hh = d * tanH;
                for(const sx of [hw, -hw]) {
                    for(const sy of [hh, -hh]) {
                        const corner = cx.clone().addScaledVector(camR, sx).addScaledVector(camU, sy);
                        const x = corner.dot(lightRight);
                        const y = corner.dot(lightUp2);
                        if(x < minX) minX = x; if(x > maxX) maxX = x;
                        if(y < minY) minY = y; if(y > maxY) maxY = y;
                    }
                }
            }
            // +15 % de marge + minimum garanti ±25 m pour couvrir toujours tout le balcon
            const px = (maxX - minX) * 0.15;
            const py = (maxY - minY) * 0.15;
            sun.shadow.camera.left   = Math.min(minX - px, -25);
            sun.shadow.camera.right  = Math.max(maxX + px,  25);
            sun.shadow.camera.bottom = Math.min(minY - py, -25);
            sun.shadow.camera.top    = Math.max(maxY + py,  25);
            sun.shadow.camera.updateProjectionMatrix();
        }

        function getSunShadowTarget3D() {
            if(typeof getBalconyOrbitCenter3D === 'function') {
                const center = getBalconyOrbitCenter3D();
                if(center) return new THREE.Vector3(center.x, 0, center.z);
            }
            return new THREE.Vector3(
                Number.isFinite(balconyOffsetX) ? balconyOffsetX : 0,
                0,
                Number.isFinite(balconyOffsetZ) ? balconyOffsetZ : 0
            );
        }

        function updateSun(h) {
            const sunState = getSunStateForHour(h, null, true);
            const seasonConfig = sunState.seasonConfig;
            const shadowTarget = getSunShadowTarget3D();

            if(!sunState.daylight) {
                sun.position.copy(shadowTarget).add(sunState.position);
                sun.intensity = 0;
                sun.castShadow = false;
                if(sunFar) { sunFar.position.copy(shadowTarget).add(sunState.position); sunFar.intensity = 0; sunFar.castShadow = false; }
                if(ambientLight) ambientLight.intensity = seasonConfig.ambientNight;
                scene.background = new THREE.Color(0x050d1f);
                sun.target.position.copy(shadowTarget);
                sun.target.updateMatrixWorld();
                if(sunFar) { sunFar.target.position.copy(shadowTarget); sunFar.target.updateMatrixWorld(); }
                if(typeof updateDecorativeSpotExposure === 'function') updateDecorativeSpotExposure();
                return;
            }

            const totalIntensity = Math.max(0.08, sunState.daylightStrength * seasonConfig.sunIntensity);
            sun.position.copy(shadowTarget).add(sunState.position);
            sun.intensity = totalIntensity;
            sun.castShadow = true;
            if(sunFar) {
                sunFar.position.copy(shadowTarget).add(sunState.position);
                sunFar.intensity = totalIntensity * 0.25;
                sunFar.castShadow = true;
                sunFar.target.position.copy(shadowTarget);
                sunFar.target.updateMatrixWorld();
            }
            if(ambientLight) {
                ambientLight.intensity = seasonConfig.ambientNight + sunState.daylightStrength * (seasonConfig.ambientDay - seasonConfig.ambientNight);
            }
            sun.target.position.copy(shadowTarget);
            sun.target.updateMatrixWorld();
            scene.background = new THREE.Color(sunState.daylightStrength < 0.12 ? seasonConfig.lowSky : seasonConfig.daySky);
            updateShadowCamera();
            if(typeof updateDecorativeSpotExposure === 'function') updateDecorativeSpotExposure();
        }

	        window.showDevis = () => {
	            const d = document.getElementById('devis-data');
	            const groups = collectCutPiecesAllConstructions();
	            let total = 0;
	            let h = `<table class="devis-table"><tr><th>Article</th><th>Qté</th><th>PU</th><th>Total</th></tr>`;
	            groups.forEach(group => {
	                const stockLengthCm = getStockLengthForProfile(group.profile);
	                const unitType = group.meta && group.meta.unitType;
	                const isScrewGroup = unitType === 'box';
	                const isItemGroup = unitType === 'item';
	                const isSheetGroup = unitType === 'sheet';
	                const isLiterGroup = unitType === 'liter';
	                const cutPlan = (isScrewGroup || isItemGroup || isSheetGroup || isLiterGroup) ? { bars: [] } : optimizeCutsFFD(group.lengths, getStockEntriesForProfile(group.profile), getSawKerfCm());
	                const bars = cutPlan.bars || [];
	                const unitPrice = getUnitPriceForProfile(group.profile);
	                const unitsToBuy = isScrewGroup ? Math.ceil((group.meta.qty || 0) / (group.meta.packSize || 100)) : ((isItemGroup || isSheetGroup || isLiterGroup) ? (group.meta.qty || 0) : bars.length);
	                const lineTotal = unitsToBuy * unitPrice;
	                const qtyLabel = isScrewGroup
	                    ? `${unitsToBuy} boîte(s) / ${group.meta.qty} vis`
	                    : (isItemGroup ? `${unitsToBuy} pièce(s)` : (isLiterGroup ? `${unitsToBuy.toLocaleString('fr-FR')} L` : (isSheetGroup ? `${unitsToBuy.toLocaleString('fr-FR')} m²` : `${bars.length} barre(s)`)));
	                total += lineTotal;
	                h += `<tr><td>${escapeHtmlForDoc(group.profile)}</td><td>${qtyLabel}</td><td>${formatEuro(unitPrice)}</td><td>${formatEuro(lineTotal)}</td></tr>`;
	            });

	            if(groups.length === 0) {
	                h += `<tr><td colspan="4">Aucune jardinière à chiffrer.</td></tr>`;
	            }
	            h = `<div style="margin-bottom:10px;padding:10px;border:1px solid #6a563a;background:#1d1710;border-radius:6px;color:#f4dec1;font-weight:900;">Prix matière: ${formatEuro(total)}</div>` + h;
	            h += `<tr class="devis-total-row"><td colspan="3">TOTAL</td><td>${formatEuro(total)}</td></tr></table>`;
	            d.innerHTML = h;
	            document.getElementById('modal-devis').style.display='flex';
	        };

        function getViewportOrientationKey() {
            const viewport = window.visualViewport;
            const w = viewport && viewport.width ? viewport.width : window.innerWidth;
            const h = viewport && viewport.height ? viewport.height : window.innerHeight;
            if(!(w > 0) || !(h > 0)) return null;
            return w > h ? 'landscape' : 'portrait';
        }

        function scheduleViewportRecenter() {
            if(viewportRecenterTimer) clearTimeout(viewportRecenterTimer);
            viewportRecenterTimer = setTimeout(() => {
                viewportRecenterTimer = null;
                requestAnimationFrame(() => {
                    updateRenderStageLayout();
                    recenterCurrentView();
                    const nextSize = getPane2DSize();
                    lastPane2DWidth = nextSize.width;
                    lastPane2DHeight = nextSize.height;
                });
            }, 140);
        }

        function onResize() {
            const previousOrientationKey = lastViewportOrientationKey;
            const nextOrientationKey = getViewportOrientationKey();
            const orientationChanged = !!(
                IS_TOUCH_DEVICE
                && previousOrientationKey
                && nextOrientationKey
                && previousOrientationKey !== nextOrientationKey
            );
            if(nextOrientationKey) lastViewportOrientationKey = nextOrientationKey;
            const oldW = lastPane2DWidth;
            const oldH = lastPane2DHeight;
            const oldCenterWorld = oldW > 0 && oldH > 0
                ? { x: (oldW / 2 - offsetX) / scale, y: (oldH / 2 - offsetY) / scale }
                : null;
            updateRenderStageLayout();
            const nextSize = getPane2DSize();
            if(!orientationChanged && oldCenterWorld && nextSize.width > 0 && nextSize.height > 0 && (activeMainView === '2d' || activeMainView === 'mixte')) {
                offsetX = nextSize.width / 2 - oldCenterWorld.x * scale;
                offsetY = nextSize.height / 2 - oldCenterWorld.y * scale;
            }
            lastPane2DWidth = nextSize.width;
            lastPane2DHeight = nextSize.height;
            if(activeMainView === '2d' || activeMainView === 'mixte') draw2D();
            if(orientationChanged) scheduleViewportRecenter();
        }
        function raySegmentDistance2D(originX, originZ, dirX, dirZ, seg) {
            const ax = seg.p1.x / 20;
            const az = seg.p1.y / 20;
            const bx = seg.p2.x / 20;
            const bz = seg.p2.y / 20;
            const sx = bx - ax;
            const sz = bz - az;
            const qpx = ax - originX;
            const qpz = az - originZ;
            const denom = dirX * sz - dirZ * sx;
            if(Math.abs(denom) < 1e-6) return Infinity;
            const t = (qpx * sz - qpz * sx) / denom;
            const u = (qpx * dirZ - qpz * dirX) / denom;
            if(t < 0 || u < 0 || u > 1) return Infinity;
            return t;
        }

        function getButterflyTravelLimits(j) {
            const extraReach = 10; // 1 m autour de la jardinière
            const margin = 0.45;
            const halfW = j.w / 2;
            const halfD = j.d / 2;
            const rot = j.rot || 0;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            const cx = j.group ? j.group.position.x : j.pos.x;
            const cz = j.group ? j.group.position.z : j.pos.z;

            const blockingTypes = new Set(['wall', 'window', 'glass']);
            const getBlockedDistance = (dirX, dirZ) => {
                let best = Infinity;
                segments.forEach(seg => {
                    if(!blockingTypes.has(seg.type)) return;
                    best = Math.min(best, raySegmentDistance2D(cx, cz, dirX, dirZ, seg));
                });
                return best;
            };

            const posXBlock = getBlockedDistance(cos, sin);
            const negXBlock = getBlockedDistance(-cos, -sin);
            const posZBlock = getBlockedDistance(-sin, cos);
            const negZBlock = getBlockedDistance(sin, -cos);

            return {
                posX: Math.max(halfW * 0.45, Math.min(halfW + extraReach, posXBlock - margin)),
                negX: Math.max(halfW * 0.45, Math.min(halfW + extraReach, negXBlock - margin)),
                posZ: Math.max(halfD * 0.45, Math.min(halfD + extraReach, posZBlock - margin)),
                negZ: Math.max(halfD * 0.45, Math.min(halfD + extraReach, negZBlock - margin))
            };
        }

        function createButterfly(jardIndex, butterflyIndex, butterflyCount) {
            const btColors = [0xd8cfbf, 0xcab9a0, 0xbba88d, 0x8b7b6a, 0x9aa3a2, 0x6e6257];
            const wingColor = btColors[Math.floor(Math.random() * btColors.length)];
            const group = new THREE.Group();
            group.userData.isButterfly = true;
            const mat = new THREE.MeshStandardMaterial({ color: wingColor, side: THREE.DoubleSide, roughness: 1.0, metalness: 0.0 });

            // Ailes sobres, plus proches d'un pétale que d'un motif décoratif
            const upShape = new THREE.Shape();
            upShape.moveTo(0, 0.01);
            upShape.bezierCurveTo(0.03, 0.12, 0.15, 0.12, 0.18, 0.03);
            upShape.bezierCurveTo(0.18, -0.02, 0.11, -0.05, 0.01, -0.01);
            upShape.closePath();
            const loShape = new THREE.Shape();
            loShape.moveTo(0, -0.01);
            loShape.bezierCurveTo(0.03, -0.05, 0.13, -0.11, 0.11, -0.15);
            loShape.bezierCurveTo(0.04, -0.18, 0.0, -0.09, 0, -0.01);
            loShape.closePath();

            // Rotation des géométries à l'horizontale (plan XZ)
            const upGeo = new THREE.ShapeGeometry(upShape);
            upGeo.rotateX(-Math.PI / 2);
            const loGeo = new THREE.ShapeGeometry(loShape);
            loGeo.rotateX(-Math.PI / 2);

            // Pivot gauche (s'étend en +X)
            const lp = new THREE.Group();
            lp.add(new THREE.Mesh(upGeo, mat), new THREE.Mesh(loGeo, mat));
            // Pivot droit (miroir : scale.x = -1, s'étend en -X)
            const rp = new THREE.Group();
            rp.scale.x = -1;
            rp.add(new THREE.Mesh(upGeo, mat), new THREE.Mesh(loGeo, mat));
            group.add(lp, rp);
            group.scale.setScalar(1.2);
            group.userData.lp = lp;
            group.userData.rp = rp;
            group.userData.flapAmpCurrent = 0.8;

            // Corps (horizontal, le long de Z)
            const bGeo = new THREE.CylinderGeometry(0.01, 0.007, 0.22, 5);
            bGeo.rotateX(Math.PI / 2);
            group.add(new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ color: 0x2a241f, roughness: 1.0 })));

            // Jardinière d'attache
            group.userData.homeJardIndex = jardIndex;
            group.userData.orbitSpeed = 0.15 + Math.random() * 0.35;
            group.userData.orbitPhase = Math.random() * Math.PI * 2;
            group.userData.widthBias = butterflyCount > 1 ? (-1 + (2 * butterflyIndex) / (butterflyCount - 1)) : 0;
            group.userData.depthBias = (Math.random() - 0.5) * 0.55;
            // Variation de hauteur entre le haut du bac et le haut du treillis
            group.userData.heightBand = 0.15 + Math.random() * 0.8;
            group.userData.bobAmp      = 0.08 + Math.random() * 0.20;
            group.userData.bobFreq     = 0.4  + Math.random() * 0.8;
            group.userData.bobPhase    = Math.random() * Math.PI * 2;
            group.userData.climbFreq   = 0.12 + Math.random() * 0.22;
            group.userData.climbPhase  = Math.random() * Math.PI * 2;
            // Battement des ailes
            group.userData.flapFreq  = 4.5 + Math.random() * 4.5;
            group.userData.flapPhase = Math.random() * Math.PI * 2;
            // Vol plané
            group.userData.glideUntil  = 0;
            group.userData.nextGlideAt = 1.5 + Math.random() * 5;
            // Petite dérive élastique autour de l'orbite
            group.userData.wandX = 0;
            group.userData.wandZ = 0;

            scene.add(group);
            butterflies.push(group);
            return group;
        }

        function rebuildButterflies() {
            butterflies.forEach(bf => scene.remove(bf));
            butterflies = [];
            const activeJards = jardinières
                .map((j, index) => ({ j, index }))
                .filter(item => item.j && item.j.plants && item.j.plants.length > 0);
            const maxForScene = activeJards.length <= 1 ? 2 : MAX_BUTTERFLIES_SCENE;
            const count = activeJards.length > 0 ? maxForScene : 0;
            for(let i = 0; i < count; i++) {
                const home = activeJards[i % activeJards.length];
                const butterfly = createButterfly(home.index, i, count);
                butterfly.userData.nextHomeSwitchAt = performance.now() * 0.001 + 4 + i * 1.7 + Math.random() * 3;
            }
        }

        function getMagicDustAnchor(item) {
            if(!item || !item.pos) return null;
            const h = Math.max(1.6, item.h || item.legH || 3);
            const treillisTop = item.treillisH ? Math.min(item.treillisH + (item.legH || 0), 10) : h;
            const w = Math.max(1.8, item.w || item.diameter || 4);
            const d = Math.max(1.8, item.d || item.diameter || 4);
            const type = (typeof getPlacementType === 'function' ? getPlacementType(item) : item.constructionType) || '';
            return {
                x: item.pos.x || 0,
                y: Math.max(0.7, Math.min(7.5, treillisTop * 0.55)),
                z: item.pos.z || 0,
                height: Math.max(1.0, Math.min(12, treillisTop)),
                w,
                d,
                shape: type === 'pottedTree' ? 'circle' : 'rect',
                rot: item.rot || 0,
                radius: Math.max(1.4, Math.min(5.5, Math.max(w, d) * 0.32))
            };
        }

        function sampleMagicDustEdge3D(anchor) {
            const halfX = Math.max(0.8, anchor.w / 2);
            const halfZ = Math.max(0.8, anchor.d / 2);
            const cornerMode = Math.random() < 0.34;
            const side = Math.floor(Math.random() * 4);
            let lx = 0;
            let lz = 0;
            let nx = 0;
            let nz = 0;
            if(cornerMode) {
                lx = (Math.random() < 0.5 ? -1 : 1) * halfX;
                lz = (Math.random() < 0.5 ? -1 : 1) * halfZ;
                lx += (Math.random() - 0.5) * Math.min(halfX * 0.22, 0.55);
                lz += (Math.random() - 0.5) * Math.min(halfZ * 0.22, 0.55);
                nx = lx / halfX;
                nz = lz / halfZ;
            } else if(side === 0) {
                lx = halfX;
                lz = (Math.random() * 2 - 1) * halfZ;
                nx = 1;
            } else if(side === 1) {
                lx = -halfX;
                lz = (Math.random() * 2 - 1) * halfZ;
                nx = -1;
            } else if(side === 2) {
                lx = (Math.random() * 2 - 1) * halfX;
                lz = halfZ;
                nz = 1;
            } else {
                lx = (Math.random() * 2 - 1) * halfX;
                lz = -halfZ;
                nz = -1;
            }
            const cornerPull = cornerMode ? 0.9 : (Math.random() < 0.38 ? 0.62 : 0.18);
            nx += (lx / halfX) * cornerPull;
            nz += (lz / halfZ) * cornerPull;
            const nLen = Math.max(0.001, Math.hypot(nx, nz));
            nx /= nLen;
            nz /= nLen;
            const rot = anchor.rot || 0;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            return {
                x: lx * cos - lz * sin,
                z: lx * sin + lz * cos,
                nx: nx * cos - nz * sin,
                nz: nx * sin + nz * cos
            };
        }

        function triggerMagicDustForPlacement(item, options = {}) {
            const anchor = getMagicDustAnchor(item);
            if(!anchor) return;
            const isCreate = options.intensity === 'create';
            triggerMagicDust2D(anchor, { intensity: isCreate ? 'create' : 'move' });
            if(!webglAvailable || !scene || !magicDustGroup || !item) return;
            const group = new THREE.Group();
            group.position.set(anchor.x, 0.08, anchor.z);
            group.rotation.y = anchor.rot || 0;
            const halfX = Math.max(0.9, anchor.w / 2);
            const halfZ = Math.max(0.9, anchor.d / 2);
            const count = isCreate ? 4 : 3;
            for(let i = 0; i < count; i++) {
                const inflate = 0.26 + i * 0.13 + Math.random() * 0.06;
                const jitter = 0.035 + Math.random() * 0.06;
                const contours = createSketchySpatialContours3D(anchor, halfX + inflate, halfZ + inflate, anchor.height + inflate * 0.35, jitter, i);
                contours.forEach((contour, contourIndex) => {
                    const lineDelay = Math.random() * 0.16 + contourIndex * 0.035;
                    const color = i % 2 === 0 ? 0xffdc86 : 0xfff1b8;
                    const lineOpacity = (isCreate ? 1.0 : 0.82) * (contourIndex === 0 ? 1 : 0.9);
                    const mainRadius = (isCreate ? 0.034 : 0.03) + contourIndex * 0.002;
                    const line = createSketchyTubeLoop3D(contour.points, mainRadius, color, lineOpacity);
                    if(!line) return;
                    line.renderOrder = 22;
                    line.userData.baseOpacity = lineOpacity;
                    line.userData.delay = lineDelay;
                    group.add(line);
                    const haloOpacity = (isCreate ? 0.82 : 0.62) * (contourIndex === 0 ? 1 : 0.88);
                    const halo = createSketchyTubeLoop3D(contour.points, mainRadius * 2.35, color, haloOpacity);
                    if(!halo) return;
                    halo.renderOrder = 21;
                    halo.scale.set(1.012, 1.012, 1.012);
                    halo.userData.baseOpacity = haloOpacity;
                    halo.userData.delay = lineDelay;
                    group.add(halo);
                });
            }
            magicDustGroup.add(group);
            magicDustBursts.push({
                group,
                createdAt: performance.now() * 0.001,
                lifetime: isCreate ? 0.82 : 0.68
            });
        }

        function createSketchyTubeLoop3D(points, radius, color, opacity) {
            if(!points || points.length < 3) return null;
            const curve = new THREE.CatmullRomCurve3(points.map(pt => pt.clone()), true, 'catmullrom', 0.18);
            const geo = new THREE.TubeGeometry(curve, Math.max(48, points.length * 2), radius, 5, true);
            const mat = new THREE.MeshBasicMaterial({
                color,
                transparent: true,
                opacity,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            return new THREE.Mesh(geo, mat);
        }

        function createSketchyRectPoints3D(halfX, halfZ, y, jitter, seed) {
            const corners = [
                { x: -halfX, z: -halfZ },
                { x:  halfX, z: -halfZ },
                { x:  halfX, z:  halfZ },
                { x: -halfX, z:  halfZ }
            ];
            const points = [];
            const steps = 7;
            for(let edge = 0; edge < 4; edge++) {
                const a = corners[edge];
                const b = corners[(edge + 1) % 4];
                const ex = b.x - a.x;
                const ez = b.z - a.z;
                const len = Math.max(0.001, Math.hypot(ex, ez));
                const nx = -ez / len;
                const nz = ex / len;
                for(let s = 0; s < steps; s++) {
                    const t = s / steps;
                    const wobble = (Math.random() - 0.5) * jitter + Math.sin(seed * 1.7 + edge * 2.2 + s * 1.35) * jitter * 0.72;
                    points.push(new THREE.Vector3(
                        a.x + ex * t + nx * wobble,
                        y,
                        a.z + ez * t + nz * wobble
                    ));
                }
            }
            return points;
        }

        function createSketchyCirclePoints3D(radius, y, jitter, seed) {
            const points = [];
            const steps = 36;
            for(let s = 0; s < steps; s++) {
                const t = s / steps;
                const angle = t * Math.PI * 2;
                const wobble = (Math.random() - 0.5) * jitter + Math.sin(seed * 1.7 + s * 1.11) * jitter * 0.9;
                const r = radius + wobble;
                points.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r));
            }
            return points;
        }

        function createSketchySpatialContours3D(anchor, halfX, halfZ, height, jitter, seed) {
            const contourCount = 3;
            const maxY = Math.max(0.7, height);
            const minY = 0.12;
            const amp = 0.3; // 0.3 unite 3D = 3 cm; double oscillation bornee sous ~5 cm.
            const usedFractions = [];
            return Array.from({ length: contourCount }, (_, idx) => {
                const scaleOffset = 1 + (idx - 1) * 0.035;
                const phase = seed * 1.7 + idx * 2.4;
                let fraction = 0.16 + Math.random() * 0.72;
                const minSpacing = 0.1 + Math.random() * 0.04;
                for(let attempt = 0; attempt < 8 && usedFractions.some(f => Math.abs(f - fraction) < minSpacing); attempt++) {
                    fraction = 0.16 + Math.random() * 0.72;
                }
                usedFractions.push(fraction);
                const baseY = clampSketchY(maxY * fraction, minY + amp, maxY - amp);
                const points = anchor.shape === 'circle'
                    ? createSketchySpatialCirclePoints3D(Math.max(halfX, halfZ) * scaleOffset, minY, maxY, baseY, amp, jitter, phase)
                    : createSketchySpatialRectPoints3D(halfX * scaleOffset, halfZ * scaleOffset, minY, maxY, baseY, amp, jitter, phase);
                return { points };
            });
        }

        function clampSketchY(value, minY, maxY) {
            return Math.max(minY, Math.min(maxY, value));
        }

        function createSketchySpatialRectPoints3D(halfX, halfZ, minY, maxY, centerY, amp, jitter, phase) {
            const corners = [
                { x: -halfX, z: -halfZ },
                { x:  halfX, z: -halfZ },
                { x:  halfX, z:  halfZ },
                { x: -halfX, z:  halfZ }
            ];
            const points = [];
            const steps = 8;
            let cursor = 0;
            for(let edge = 0; edge < 4; edge++) {
                const a = corners[edge];
                const b = corners[(edge + 1) % 4];
                const ex = b.x - a.x;
                const ez = b.z - a.z;
                const len = Math.max(0.001, Math.hypot(ex, ez));
                const nx = -ez / len;
                const nz = ex / len;
                for(let s = 0; s < steps; s++) {
                    const t = s / steps;
                    const wobble = (Math.random() - 0.5) * jitter + Math.sin(phase + edge * 2.2 + s * 1.35) * jitter * 0.72;
                    const yWave = Math.sin(phase + cursor * 0.62) * amp + Math.sin(phase * 0.7 + cursor * 1.17) * amp * 0.38;
                    points.push(new THREE.Vector3(
                        a.x + ex * t + nx * wobble,
                        clampSketchY(centerY + yWave + (Math.random() - 0.5) * amp * 0.16, minY, maxY),
                        a.z + ez * t + nz * wobble
                    ));
                    cursor++;
                }
            }
            return points;
        }

        function createSketchySpatialCirclePoints3D(radius, minY, maxY, centerY, amp, jitter, phase) {
            const points = [];
            const steps = 44;
            for(let s = 0; s < steps; s++) {
                const t = s / steps;
                const angle = t * Math.PI * 2;
                const wobble = (Math.random() - 0.5) * jitter + Math.sin(phase + s * 1.11) * jitter * 0.9;
                const r = radius + wobble;
                const yWave = Math.sin(phase + s * 0.58) * amp + Math.sin(phase * 0.7 + s * 1.03) * amp * 0.36;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * r,
                    clampSketchY(centerY + yWave + (Math.random() - 0.5) * amp * 0.16, minY, maxY),
                    Math.sin(angle) * r
                ));
            }
            return points;
        }

        function createSketchyRectPoints2D(halfX, halfY, jitter, seed, cos, sin) {
            const corners = [
                { x: -halfX, y: -halfY },
                { x:  halfX, y: -halfY },
                { x:  halfX, y:  halfY },
                { x: -halfX, y:  halfY }
            ];
            const points = [];
            const steps = 8;
            for(let edge = 0; edge < 4; edge++) {
                const a = corners[edge];
                const b = corners[(edge + 1) % 4];
                const ex = b.x - a.x;
                const ey = b.y - a.y;
                const len = Math.max(0.001, Math.hypot(ex, ey));
                const nx = -ey / len;
                const ny = ex / len;
                for(let s = 0; s < steps; s++) {
                    const t = s / steps;
                    const wobble = (Math.random() - 0.5) * jitter + Math.sin(seed * 2.1 + edge * 2.4 + s * 1.28) * jitter * 0.78;
                    const x = a.x + ex * t + nx * wobble;
                    const y = a.y + ey * t + ny * wobble;
                    points.push({
                        x: x * cos - y * sin,
                        y: x * sin + y * cos
                    });
                }
            }
            return points;
        }

        function createSketchyCirclePoints2D(radius, jitter, seed, cos, sin) {
            const points = [];
            const steps = 40;
            for(let s = 0; s < steps; s++) {
                const t = s / steps;
                const angle = t * Math.PI * 2;
                const wobble = (Math.random() - 0.5) * jitter + Math.sin(seed * 2.1 + s * 1.07) * jitter * 0.86;
                const r = radius + wobble;
                const x = Math.cos(angle) * r;
                const y = Math.sin(angle) * r;
                points.push({
                    x: x * cos - y * sin,
                    y: x * sin + y * cos
                });
            }
            return points;
        }

        function triggerMagicDust2D(anchor, options = {}) {
            if(!anchor || !canvas2d) return;
            const isCreate = options.intensity === 'create';
            const lifetime = isCreate ? 0.82 : 0.68;
            const centerX = anchor.x * 20;
            const centerY = anchor.z * 20;
            const halfX = Math.max(18, anchor.w * 10);
            const halfY = Math.max(18, anchor.d * 10);
            const outlines = [];
            const rot = -(anchor.rot || 0);
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            const outlineCount = isCreate ? 4 : 3;
            for(let i = 0; i < outlineCount; i++) {
                const inflate = 8 + i * 5.2 + Math.random() * 3;
                const jitter = 1.9 + Math.random() * 2.6;
                const points = anchor.shape === 'circle'
                    ? createSketchyCirclePoints2D(Math.max(halfX, halfY) + inflate, jitter, i, cos, sin)
                    : createSketchyRectPoints2D(halfX + inflate, halfY + inflate, jitter, i, cos, sin);
                outlines.push({
                    points,
                    color: i % 3 === 0 ? '255,238,176' : '205,232,255',
                    lineWidth: 2.15 + Math.random() * 1.25,
                    delay: 0,
                    phase: Math.random() * Math.PI * 2
                });
            }
            magicDust2DBursts.push({
                x: centerX,
                y: centerY,
                outlines,
                createdAt: performance.now(),
                lastAt: performance.now(),
                lifetime
            });
            requestMagicDust2DRedraw();
        }

        function requestMagicDust2DRedraw() {
            if(magicDust2DFrame || !canvas2d) return;
            magicDust2DFrame = requestAnimationFrame(() => {
                magicDust2DFrame = null;
                draw2D();
            });
        }

        function renderMagicDust2DOverlay() {
            if(!ctx2d || !magicDust2DBursts.length) return;
            const now = performance.now();
            ctx2d.save();
            ctx2d.globalCompositeOperation = 'source-over';
            for(let i = magicDust2DBursts.length - 1; i >= 0; i--) {
                const burst = magicDust2DBursts[i];
                const dt = Math.min(0.04, Math.max(0.001, (now - (burst.lastAt || now)) / 1000));
                burst.lastAt = now;
                const age = (now - burst.createdAt) / 1000;
                const ratio = age / Math.max(0.001, burst.lifetime);
                if(ratio >= 1) {
                    magicDust2DBursts.splice(i, 1);
                    continue;
                }
                const fade = Math.pow(1 - ratio, 1.45);
                (burst.outlines || []).forEach((outline, outlineIndex) => {
                    const local = Math.max(0, Math.min(1, (ratio - outline.delay) / Math.max(0.05, 1 - outline.delay)));
                    if(local <= 0) return;
                    const pulse = 1 + local * 0.07 + Math.sin(age * 16 + outline.phase) * 0.012;
                    const alpha = Math.max(0, fade * (0.22 + 0.10 * Math.sin(outline.phase + age * 9)));
                    const rawPoints = outline.points.map(pt => ({
                        x: burst.x + pt.x * pulse + Math.sin(age * 22 + outline.phase + pt.x * 0.01) * 1.8,
                        y: burst.y + pt.y * pulse + Math.cos(age * 19 + outline.phase + pt.y * 0.01) * 1.8
                    }));
                    const points = rawPoints;
                    ctx2d.shadowColor = `rgba(${outline.color},${alpha * 0.38})`;
                    ctx2d.shadowBlur = 3.5 / Math.max(scale || 1, 0.05);
                    ctx2d.strokeStyle = `rgba(${outline.color},${alpha})`;
                    ctx2d.lineWidth = Math.max(1.45 / Math.max(scale || 1, 0.05), outline.lineWidth / Math.max(scale || 1, 0.05));
                    ctx2d.lineCap = 'round';
                    ctx2d.lineJoin = 'round';
                    ctx2d.beginPath();
                    points.forEach((pt, idx) => {
                        if(idx === 0) ctx2d.moveTo(pt.x, pt.y);
                        else ctx2d.lineTo(pt.x, pt.y);
                    });
                    ctx2d.closePath();
                    ctx2d.stroke();
                    ctx2d.shadowBlur = 0;
                    if(outlineIndex % 3 === 0) {
                        ctx2d.strokeStyle = `rgba(255,255,255,${alpha * 0.18})`;
                        ctx2d.lineWidth = Math.max(0.62 / Math.max(scale || 1, 0.05), outline.lineWidth * 0.38 / Math.max(scale || 1, 0.05));
                        ctx2d.beginPath();
                        points.forEach((pt, idx) => {
                            if(idx === 0) ctx2d.moveTo(pt.x, pt.y);
                            else ctx2d.lineTo(pt.x, pt.y);
                        });
                        ctx2d.closePath();
                        ctx2d.stroke();
                    }
                });
            }
            ctx2d.restore();
            if(magicDust2DBursts.length) requestMagicDust2DRedraw();
        }

        function clearMagicDustBursts() {
            if(!magicDustGroup) {
                magicDustBursts = [];
            } else {
                magicDustBursts.forEach(burst => {
                    if(!burst.group) return;
                    magicDustGroup.remove(burst.group);
                    burst.group.traverse(child => {
                        if(child.geometry) child.geometry.dispose();
                        if(child.material) child.material.dispose();
                    });
                });
            }
            magicDustBursts = [];
            magicDust2DBursts = [];
            if(magicDust2DFrame) {
                cancelAnimationFrame(magicDust2DFrame);
                magicDust2DFrame = null;
            }
        }

        function updateMagicDustBursts(t, dt) {
            if(!magicDustBursts.length || !magicDustGroup) return;
            for(let i = magicDustBursts.length - 1; i >= 0; i--) {
                const burst = magicDustBursts[i];
                const age = t - burst.createdAt;
                const life = Math.max(0.001, burst.lifetime);
                const ratio = age / life;
                if(ratio >= 1) {
                    magicDustGroup.remove(burst.group);
                    burst.group.traverse(child => {
                        if(child.geometry) child.geometry.dispose();
                        if(child.material) child.material.dispose();
                    });
                    magicDustBursts.splice(i, 1);
                    continue;
                }
                const fade = Math.max(0, Math.pow(1 - ratio, 1.25));
                const pulse = 1 + ratio * 0.045 + Math.sin(t * 12 + i) * 0.006;
                burst.group.scale.set(pulse, 1, pulse);
                burst.group.children.forEach((line, idx) => {
                    const local = Math.max(0, Math.min(1, (ratio - (line.userData.delay || 0)) / 0.85));
                    line.visible = local > 0;
                    if(line.material) line.material.opacity = (line.userData.baseOpacity || 0.8) * fade * (0.78 + 0.12 * Math.sin(t * 10 + idx));
                    line.position.y = Math.sin(t * 8 + idx) * 0.007;
                });
            }
        }

        function animate() {
            if(!webglAvailable || !renderer || !controls) return;
            requestAnimationFrame(animate);

            const now = performance.now();
            const t = now * 0.001;

            // En vue 2D pure : avancer le temps sans rendre ni calculer le vent
            if(activeMainView === '2d') {
                windLastTime = t;
                return;
            }

            updateCameraInteriorNavigationMode();
            controls.update();

            // dt pour magic dust (toujours calculé)
            const dt = windLastTime > 0 ? Math.min(0.05, Math.max(0.001, t - windLastTime)) : 0.016;
            updateMagicDustBursts(t, dt);

            // Vent + papillons : pause pendant navigation caméra, throttle à WIND_FPS_TARGET sinon
            const navigating = (now - lastCameraChangeTime3D) < NAV_WIND_PAUSE_MS;
            const doWind = !navigating && (now - windThrottleLastUpdate) >= WIND_FRAME_INTERVAL_MS;

            if(doWind) {
                windThrottleLastUpdate = now;
                jardinières.forEach((j, jIndex) => {
                    if(!j || !j.group) return;
                    const jardPhase = (jIndex + 1) * 0.9 + j.pos.x * 0.07 + j.pos.z * 0.05;
                    const sharedYaw = Math.sin(t * windParams.leafYawFreq + jardPhase);
                    const sharedTilt = Math.sin(t * windParams.leafTiltFreq + jardPhase * 1.23);
                    j.group.children.forEach(child => {
                        if(!child.userData || !child.userData.isPlantBush) return;
                        if(t >= (child.userData.nextGustAt || 0)) {
                            child.userData.gustTarget = windParams.gustStrengthMin + Math.random() * (windParams.gustStrengthMax - windParams.gustStrengthMin);
                            child.userData.gustHoldUntil = t + windParams.gustHoldMin + Math.random() * (windParams.gustHoldMax - windParams.gustHoldMin);
                            child.userData.nextGustAt = t + windParams.gustEveryMin + Math.random() * (windParams.gustEveryMax - windParams.gustEveryMin);
                        }
                        if(t > (child.userData.gustHoldUntil || 0)) {
                            child.userData.gustTarget = 0;
                        }
                        child.userData.gustCurrent += (child.userData.gustTarget - child.userData.gustCurrent) * Math.min(1, dt * windParams.gustResponse);

                        const bushPhase = child.userData.windPhase || 0;
                        const bushScale = child.userData.windScale || 1;
                        const bushAmp = windParams.bushAmp * bushScale;
                        // Mouvement de trajectoire désactivé — les feuilles gardent leur rotation individuelle
                        // child.rotation.x = (child.userData.baseRotX || 0) + Math.sin(t * windParams.bushFreq + bushPhase) * bushAmp;
                        // child.rotation.z = (child.userData.baseRotZ || 0) + Math.cos(t * (windParams.bushFreq * 0.87) + bushPhase * 0.6) * bushAmp * 0.9;
                        child.children.forEach(leaf => {
                            if(!leaf.userData || leaf.userData.staticPlantPart) return;
                            const leafPhase = leaf.userData.windPhase || 0;
                            const leafScale = leaf.userData.windScale || 1;
                            const leafAmpMult = leaf.userData.leafAmpMult !== undefined ? leaf.userData.leafAmpMult : 1;
                            const leafFreqMult = leaf.userData.leafFreqMult !== undefined ? leaf.userData.leafFreqMult : 1;
                            const gust = child.userData.gustCurrent || 0;
                            // signal propre à chaque feuille (fréquence individuelle)
                            const leafOwnYaw  = Math.sin(t * windParams.leafYawFreq  * leafFreqMult + leafPhase);
                            const leafOwnTilt = Math.cos(t * windParams.leafTiltFreq * leafFreqMult * 0.9 + leafPhase * 1.1);
                            // 45% signal collectif (cohérence pendant bourrasques) + 55% signal propre
                            const syncYaw  = sharedYaw  * 0.45 + leafOwnYaw  * 0.55;
                            const syncTilt = sharedTilt * 0.45 + leafOwnTilt * 0.55;
                            const gustJitter = Math.sin(t * (leaf.userData.gustFreq || 14) + leafPhase * 0.7) * gust;
                            const totalAmp = leafAmpMult * leafScale;
                            leaf.rotation.y = (leaf.userData.baseRotY || 0) + (syncYaw + gustJitter * 0.28) * windParams.leafYawAmp * totalAmp * (1 + gust * 0.32);
                            leaf.rotation.x = (leaf.userData.baseRotX || 0) + (syncTilt + gustJitter * 0.1) * windParams.leafTiltAmp * totalAmp * (1 + gust * 0.2);
                            leaf.rotation.z = (leaf.userData.baseRotZ || 0) + (syncTilt + gustJitter * 0.08) * windParams.leafTiltAmp * 0.5 * totalAmp * (1 + gust * 0.2);
                        });
                    });
                });

                butterflies.forEach(bf => {
                    if (!bf.userData.isButterfly) return;
                    if(jardinières.length > 1 && t >= (bf.userData.nextHomeSwitchAt || 0)) {
                        const currentIndex = bf.userData.homeJardIndex || 0;
                        const candidates = jardinières
                            .map((j, index) => ({ j, index }))
                            .filter(item => item.j && item.j.group && item.index !== currentIndex);
                        if(candidates.length > 0) {
                            const next = candidates[Math.floor(Math.random() * candidates.length)];
                            bf.userData.transitionFrom = bf.position.clone();
                            bf.userData.transitionUntil = t + 2.8 + Math.random() * 1.2;
                            bf.userData.homeJardIndex = next.index;
                        }
                        bf.userData.nextHomeSwitchAt = t + 6 + Math.random() * 8;
                    }
                    const j = jardinières[bf.userData.homeJardIndex];
                    if (!j || !j.group) return;
                    const metrics = j.renderMetrics || computeJardiniereConstructionMetrics(j);
                    const hasTreillis = (j.treillisBack !== false && (j.treillisBack || j.hasTreillis)) || j.treillisLeft || j.treillisRight;
                    const limits = getButterflyTravelLimits(j);
                    const hx = j.group.position.x;
                    const hz = j.group.position.z;
                    const rot = j.rot || 0;
                    const cos = Math.cos(rot);
                    const sin = Math.sin(rot);
                    // Dérive élastique
                    bf.userData.wandX += (Math.random() - 0.5) * 0.18 * dt;
                    bf.userData.wandZ += (Math.random() - 0.5) * 0.18 * dt;
                    bf.userData.wandX -= bf.userData.wandX * 2.2 * dt;
                    bf.userData.wandZ -= bf.userData.wandZ * 2.2 * dt;
                    // Vol plané
                    if (t >= bf.userData.nextGlideAt && t > bf.userData.glideUntil) {
                        bf.userData.glideUntil  = t + 0.4 + Math.random() * 1.3;
                        bf.userData.nextGlideAt = bf.userData.glideUntil + 2 + Math.random() * 6;
                    }
                    bf.userData.flapAmpCurrent += ((t < bf.userData.glideUntil ? 0.09 : 1.0) - bf.userData.flapAmpCurrent) * Math.min(1, dt * 7);
                    const raw = Math.sin(t * bf.userData.flapFreq * Math.PI * 2 + bf.userData.flapPhase);
                    bf.userData.lp.rotation.z = (raw * 0.5 + 0.5) * 1.15 * bf.userData.flapAmpCurrent;
                    bf.userData.rp.rotation.z = -bf.userData.lp.rotation.z;

                    // Aire de vol dans le repère local de la jardinière, étendue jusqu'à 1 m hors du bac
                    const angle = t * bf.userData.orbitSpeed + bf.userData.orbitPhase;
                    const widthSignal = Math.sin(angle) * 0.58 + (bf.userData.widthBias || 0) * 0.42 + bf.userData.wandX * 0.22;
                    const depthSignal = Math.sin(angle * 0.71 + 0.4) * 0.72 + (bf.userData.depthBias || 0) * 0.28 + bf.userData.wandZ * 0.22;
                    const localX = widthSignal >= 0 ? widthSignal * limits.posX : widthSignal * limits.negX;
                    const localZ = depthSignal >= 0 ? depthSignal * limits.posZ : depthSignal * limits.negZ;
                    const fx = localX * cos - localZ * sin;
                    const fz = localX * sin + localZ * cos;

                    const baseY = metrics.postHeight + 0.15;
                    const topY = hasTreillis ? (metrics.postHeight + (j.treillisH || 0) - 0.2) : (metrics.postHeight + 0.9);
                    const climbWave = Math.sin(t * bf.userData.climbFreq + bf.userData.climbPhase) * 0.5 + 0.5;
                    const verticalMix = Math.min(1, Math.max(0, climbWave * 0.82 + bf.userData.heightBand * 0.18));
                    const by = baseY + (topY - baseY) * verticalMix + Math.sin(t * bf.userData.bobFreq + bf.userData.bobPhase) * bf.userData.bobAmp;
                    const targetX = hx + fx;
                    const targetY = by;
                    const targetZ = hz + fz;
                    if(bf.userData.transitionFrom && t < (bf.userData.transitionUntil || 0)) {
                        const duration = 3.4;
                        const mix = 1 - Math.max(0, Math.min(1, ((bf.userData.transitionUntil || t) - t) / duration));
                        const easedMix = mix * mix * (3 - 2 * mix);
                        bf.position.set(
                            bf.userData.transitionFrom.x + (targetX - bf.userData.transitionFrom.x) * easedMix,
                            bf.userData.transitionFrom.y + (targetY - bf.userData.transitionFrom.y) * easedMix,
                            bf.userData.transitionFrom.z + (targetZ - bf.userData.transitionFrom.z) * easedMix
                        );
                    } else {
                        bf.userData.transitionFrom = null;
                        bf.position.set(targetX, targetY, targetZ);
                    }
                    // Orientation vers la direction de vol
                    const vx = Math.cos(rot) * Math.cos(angle + Math.PI / 2) - Math.sin(rot) * Math.cos(angle * 0.71 + 1.97) * 0.7;
                    const vz = Math.sin(rot) * Math.cos(angle + Math.PI / 2) + Math.cos(rot) * Math.cos(angle * 0.71 + 1.97) * 0.7;
                    if (Math.abs(vx) + Math.abs(vz) > 0.001) bf.rotation.y = Math.atan2(vx, vz);
                });
            }
            windLastTime = t;

            // Mettre à jour les fantômes du curseur et ligne de dessin en 3D
            ghostGroup.clear();
            if(isDrawingToolActive && (currentPoint || mousePos2d)) {
                // Point fantôme à la position du curseur
                if(mousePos2d) {
                    const px = mousePos2d.x / 20;
                    const pz = mousePos2d.y / 20;
                    const dotGeo = new THREE.SphereGeometry(0.15, 8, 8);
                    const dotMat = new THREE.MeshStandardMaterial({ color: 0xb89b72, emissive: 0xb89b72, emissiveIntensity: 0.8 });
                    const dot = new THREE.Mesh(dotGeo, dotMat);
                    dot.position.set(px, 0.02, pz);
                    dot.castShadow = false;
                    dot.receiveShadow = false;
                    ghostGroup.add(dot);
                }

                // Ligne pointillée de currentPoint à mousePos2d
                if(currentPoint && mousePos2d) {
                    const p1x = currentPoint.x / 20;
                    const p1z = currentPoint.y / 20;
                    const p2x = mousePos2d.x / 20;
                    const p2z = mousePos2d.y / 20;

                    const points = [];
                    for(let i = 0; i <= 10; i++) {
                        if(i % 2 === 0) {
                            const tl = i / 10;
                            points.push(new THREE.Vector3(
                                p1x + (p2x - p1x) * tl,
                                0.01,
                                p1z + (p2z - p1z) * tl
                            ));
                        }
                    }

                    if(points.length > 1) {
                        const lineGeo = new THREE.BufferGeometry().setFromPoints(points);
                        const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, linewidth: 2, transparent: true, opacity: 0.5 });
                        const line = new THREE.LineSegments(lineGeo, lineMat);
                        ghostGroup.add(line);
                    }
                }
            }

            // Balcon → layer 1 (invisible à sunFar) pour éviter le z-fighting
            if(balconySceneGroup) balconySceneGroup.traverse(o => { if(o.isMesh) o.layers.set(1); });
            fitNearShadowToView();
            const w = renderer.domElement.clientWidth;
            const h = renderer.domElement.clientHeight;
            renderer.setViewport(0, 0, w, h);
            renderer.render(scene, camera);
        }
        // --- NOUVELLES FONCTIONS NIVEAU 1 ---
        
        function getJardiniereFeetPositions(j) {
            // Retourne les 4 positions des pieds dans un système de coordonnées monde 2D (pixels canvas)
            const feet = [];
            const centerX = j.pos.x * 20;
            const centerZ = j.pos.z * 20;
            const cos = Math.cos(j.rot);
            const sin = Math.sin(j.rot);
            
            // Positions locales des pieds (ils sont à 0.4 unités des coins)
            const localPositions = [
                [-(j.w/2 - 0.4), -(j.d/2 - 0.4)],  // coin haut-gauche
                [(j.w/2 - 0.4), -(j.d/2 - 0.4)],   // coin haut-droit
                [-(j.w/2 - 0.4), (j.d/2 - 0.4)],   // coin bas-gauche
                [(j.w/2 - 0.4), (j.d/2 - 0.4)]     // coin bas-droit
            ];
            
            for(let pos of localPositions) {
                const x = pos[0] * 20;
                const z = pos[1] * 20;
                // Appliquer rotation
                const rotX = x * cos - z * sin;
                const rotZ = x * sin + z * cos;
                // Convertir en coordonnées canvas
                feet.push({
                    x: centerX + rotX,
                    y: centerZ + rotZ
                });
            }
            return feet;
        }
        
        function hasDrainCollisionWithFeet(j) {
            // Vérifie si un pied de jardinière touche un drain (pieds uniquement, pas toute la jardinière)
            const feet = getJardiniereFeetPositions(j);
            const FOOT_RADIUS = 4; // rayon de collision du pied (en pixels)
            
            for(let c of constraints.filter(c => c.type === 'drain')) {
                for(let foot of feet) {
                    const dx = c.x - foot.x;
                    const dy = c.y - foot.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if(dist < FOOT_RADIUS + 6) { // 6px = rayon drain
                        return true;
                    }
                }
            }
            return false;
        }
        
        function updateCollisionBannerAdvanced() {
            // Met à jour la banneau avec les collisions drain-pieds
            const banner = document.getElementById('collision-banner');
            let drainCollisionsCount = 0;
            
            for(let j of jardinières) {
                if(hasDrainCollisionWithFeet(j)) drainCollisionsCount++;
            }
            
            if(drainCollisionsCount > 0) {
                banner.textContent = `⚠️ ${drainCollisionsCount} pied(s) de jardinière sur évac.`;
                banner.style.display = 'block';
            } else {
                banner.style.display = 'none';
            }
        }
        
        function snapPowerConstraintToWalls(constraint) {
            // Aimante une prise électrique aux murs ou bas de fenêtres les plus proches
            const SNAP_DISTANCE = 10; // pixels
            let closestDist = SNAP_DISTANCE;
            let snappedPos = { x: constraint.x, y: constraint.y };
            
            // Vérifier aimantation aux segments (murs, fenêtres)
            for(let seg of segments) {
                // Distance à la ligne du segment
                const p0 = seg.p1;
                const p1 = seg.p2;
                const dx = p1.x - p0.x;
                const dy = p1.y - p0.y;
                const len = Math.sqrt(dx*dx + dy*dy);
                if(len === 0) continue;
                
                const t = Math.max(0, Math.min(1, ((constraint.x - p0.x)*dx + (constraint.y - p0.y)*dy) / (len*len)));
                const closestX = p0.x + t * dx;
                const closestY = p0.y + t * dy;
                const dist = Math.sqrt((constraint.x - closestX)**2 + (constraint.y - closestY)**2);
                
                if(dist < closestDist) {
                    closestDist = dist;
                    // Magnétiser perpendiculairement au segment
                    snappedPos = { x: closestX, y: closestY };
                }
            }
            
            return snappedPos;
        }
        
