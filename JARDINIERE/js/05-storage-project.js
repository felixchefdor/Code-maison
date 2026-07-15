        function updateSketchLockUI() {
            const btn = document.getElementById('btn-close-sketch');
            const alertBox = document.getElementById('sketch-alert');
            const editorTabs = document.getElementById('editor-tabs');
            const btn2d = document.getElementById('btn-view-2d');
            const btn3d = document.getElementById('btn-view-3d');
            const btnMixte = document.getElementById('btn-view-mixte');
            const splitter = document.getElementById('view-splitter');
            const viewport = document.getElementById('viewport');
            const pane2d = getPane2D();
            const needsClosure = doesSketchNeedClosure() || doesDetachedSketchNeedClosure();

            btn.style.display = needsClosure ? 'block' : 'none';
            if(alertBox && !needsClosure) {
                alertBox.style.display = 'none';
                alertBox.textContent = '';
            }
            if(viewport && pane2d) {
                const viewportWidth = viewport.clientWidth;
                const paneRight = renderStageLeftPx + pane2d.clientWidth;
                const rightInset = Math.max(16, viewportWidth - paneRight + 16);
                btn.style.right = rightInset + 'px';
                if(alertBox) alertBox.style.right = rightInset + 'px';
            }
            editorTabs.style.pointerEvents = 'auto';
            btn2d.disabled = false;
            btn3d.disabled = false;
            btnMixte.disabled = false;
            splitter.style.pointerEvents = 'auto';

            if(renderer && renderer.domElement) {
                renderer.domElement.style.pointerEvents = 'auto';
            }
            if(controls) {
                controls.enabled = activeMainView !== '2d';
            }
        }

        function doesSketchNeedClosure() {
            return sketchLockActive && !isSketchValidated && getPrimaryContourSegments().length >= 2 && !isContourClosed;
        }

        function canAutoFinalizeSketch() {
            return sketchLockActive && !isSketchValidated && getPrimaryContourSegments().length >= 2 && isContourClosed;
        }

        function showSketchClosureAlert(message) {
            const alertBox = document.getElementById('sketch-alert');
            if(alertBox) {
                alertBox.textContent = message;
                alertBox.style.display = 'block';
            }
            flashSketchCloseButton();
        }

        function markSketchDirtyAndLocked() {
            isSketchValidated = false;
            sketchLockActive = true;
            updateSketchLockUI();
        }

        function finalizeSketchClosure(options = {}) {
            const { silent = false } = options;
            if(doesDetachedSketchNeedClosure()) {
                saveState();
                closeDetachedContourAutomatically();
                currentPoint = null;
                detachedDrawingMode = false;
                activeDetachedSketchId = null;
                isSketchValidated = true;
                sketchLockActive = false;
                if(typeof clearActiveDrawingTool === 'function') clearActiveDrawingTool({ redraw: false });
                updateSketchLockUI();
                build3DArch();
                saveState();
                return;
            }
            if(getPrimaryContourSegments().length < 2) {
                return;
            }
            saveState();
            closeContourAutomatically();
            currentPoint = null;
            detachedDrawingMode = false;
            isSketchValidated = true;
            sketchLockActive = false;
            if(typeof clearActiveDrawingTool === 'function') clearActiveDrawingTool({ redraw: false });
            updateSketchLockUI();
            build3DArch();
            saveState();
        }

        function flashSketchCloseButton() {
            const btn = document.getElementById('btn-close-sketch');
            if(!btn || btn.style.display === 'none') return;
            btn.classList.remove('flash-alert');
            void btn.offsetWidth;
            btn.classList.add('flash-alert');
            setTimeout(() => btn.classList.remove('flash-alert'), 1300);
        }

        function exportProjectState() {
            const activePlacement = getSelectedPlacementObject();
            const activePlacementType = getPlacementType(activePlacement);
            return {
                segments: JSON.parse(JSON.stringify(segments)),
                constraints: JSON.parse(JSON.stringify(constraints)),
                currentPoint: currentPoint ? { ...currentPoint } : null,
                sunHour2d,
                balconyOrientationDeg,
                balconyWorldOrientationDeg,
                screenRotation2DDeg,
                sunSeason,
                solarMapPeriod,
                sunDateISO,
                balconyOffsetX,
                balconyOffsetZ,
                horizonSettings: JSON.parse(JSON.stringify(horizonSettings)),
                guidedNeighborhoodPick: {
                    myBuildingPickArmed: !!myBuildingPickArmed,
                    neighborhoodGridAlignmentPickArmed: !!neighborhoodGridAlignmentPickArmed,
                    neighborhoodHeightEditPickArmed: !!neighborhoodHeightEditPickArmed,
                    balconyBuildingPlacementPickArmed: !!balconyBuildingPlacementPickArmed,
                    buildingAlignedGridActive: !!buildingAlignedGridActive
                },
                alignedBuildingWallNormal: alignedBuildingWallNormal ? JSON.parse(JSON.stringify(alignedBuildingWallNormal)) : null,
                visAVisSettings: JSON.parse(JSON.stringify(visAVisSettings)),
                archHeights: { ...archHeights },
                archColors: { ...archColors },
                slabZoneColors: { ...slabZoneColors },
                archOptions: { ...archOptions },
                balconyDesignMode,
                surfaceMaterial,
                surfaceHeightCm,
                surfaces: JSON.parse(JSON.stringify(surfaces)),
                ceilingShapePoints: JSON.parse(JSON.stringify(ceilingShapePoints)),
                isContourClosed,
                sketchLockActive,
                isSketchValidated,
                scale,
                offsetX,
                offsetY,
                currentEditorMode,
                activeMainView,
	                splitPosition,
	                mixedVisibleRatio,
	                cutStockLengthByProfile: { ...cutStockLengthByProfile },
	                cutStockInventoryByProfile: { ...cutStockInventoryByProfile },
	                workshopFreeStock: JSON.parse(JSON.stringify(workshopFreeStock)),
	                cutSawKerfMm,
	                devisUnitPriceByProfile: { ...devisUnitPriceByProfile },
	                treillisDimensionOverrides: { ...treillisDimensionOverrides },
                selectedConstruction: activePlacement && activePlacement.id ? { type: activePlacementType, id: activePlacement.id } : null,
                selected2dJardId: selected2dJardiniere ? selected2dJardiniere.id : null,
                selected2dBenchId: selected2dBench ? selected2dBench.id : null,
                selected2dPottedTreeId: selected2dPottedTree ? selected2dPottedTree.id : null,
                selected2dCubeId: selected2dCube ? selected2dCube.id : null,
                selected2dCornerFillId: selected2dCornerFill ? selected2dCornerFill.id : null,
                jardinières: jardinières.map(j => ({
                    constructionType: 'jardiniere',
                    id: j.id,
                    w: j.w,
                    d: j.d,
                    legH: j.legH,
                    construction: JSON.parse(JSON.stringify(ensureJardConstructionSettings(j))),
                    woodColor: j.woodColor,
                    treillisBack: j.treillisBack,
                    treillisLeft: j.treillisLeft,
                    treillisRight: j.treillisRight,
                    hasTreillis: j.hasTreillis,
                    treillisH: j.treillisH,
                    treillisType: j.treillisType || 'noisetier',
                    treillisLights: !!j.treillisLights,
                    treillisSpotLights: hasTreillisSpots(j),
                    treillisWhiteGarland: hasTreillisWhiteGarland(j),
                    treillisGinguette: !!j.treillisGinguette,
                    garlandPosts: JSON.parse(JSON.stringify(normalizeGarlandPosts(j.garlandPosts))),
                    garlandLinks: JSON.parse(JSON.stringify(normalizeGarlandLinks(j.garlandLinks))),
                    birdhouse: !!j.birdhouse,
                    layerView: normalizeLayerView(j.layerView),
                    showSoil: j.showSoil !== false,
                    showGeotextile: j.showGeotextile !== false,
                    showEpdm: j.showEpdm !== false,
                    showGravel: j.showGravel !== false,
                    showMulch: j.showMulch !== false,
                    includeInQuote: shouldIncludeConstructionInCalculations(j, 'jardiniere'),
                    pos: { x: j.pos.x, y: j.pos.y, z: j.pos.z },
                    rot: j.rot,
                    plants: JSON.parse(JSON.stringify(j.plants || []))
                })),
                bancs: bancs.map(b => ({
                    constructionType: 'banc',
                    id: b.id,
                    w: b.w,
                    d: b.d,
                    h: b.h,
                    woodColor: b.woodColor,
                    includeInQuote: shouldIncludeConstructionInCalculations(b, 'banc'),
                    pos: { x: b.pos.x, y: b.pos.y, z: b.pos.z },
                    rot: b.rot
                })),
                pottedTrees: pottedTrees.map(t => ({
                    constructionType: 'pottedTree',
                    id: t.id,
                    diameter: t.diameter,
                    w: t.w,
                    d: t.d,
                    h: t.h,
                    ageYears: t.ageYears || 5,
                    shape: t.shape,
                    includeInQuote: shouldIncludeConstructionInCalculations(t, 'pottedTree'),
                    pos: { x: t.pos.x, y: t.pos.y, z: t.pos.z },
                    rot: t.rot
                })),
                cubes: cubes.map(c => ({
                    constructionType: 'cube',
                    id: c.id,
                    w: c.w,
                    d: c.d,
                    h: c.h,
                    color: c.color,
                    armBack: c.armBack !== false,
                    armSide: c.armSide !== false,
                    mattress: c.mattress !== false,
                    cushions: c.cushions !== false,
                    fabricColor: c.fabricColor || '#d8d1bd',
                    mattressColor: c.mattressColor || c.fabricColor || '#d8d1bd',
                    cushionColor: c.cushionColor || '#c8bfa8',
                    includeInQuote: shouldIncludeConstructionInCalculations(c, 'cube'),
                    pos: { x: c.pos.x, y: c.pos.y, z: c.pos.z },
                    rot: c.rot
                })),
                tables: tables.map(t => ({
                    constructionType: 'table',
                    id: t.id,
                    w: t.w,
                    d: t.d,
                    h: t.h,
                    woodColor: t.woodColor,
                    includeInQuote: shouldIncludeConstructionInCalculations(t, 'table'),
                    pos: { x: t.pos.x, y: t.pos.y, z: t.pos.z },
                    rot: t.rot
                })),
                chairs: chairs.map(c => ({
                    constructionType: 'chair',
                    id: c.id,
                    w: c.w,
                    d: c.d,
                    h: c.h,
                    woodColor: c.woodColor,
                    includeInQuote: shouldIncludeConstructionInCalculations(c, 'chair'),
                    pos: { x: c.pos.x, y: c.pos.y, z: c.pos.z },
                    rot: c.rot
                })),
                hangingPlanters: hangingPlanters.map(p => ({
                    constructionType: 'hangingPlanter',
                    id: p.id,
                    w: p.w,
                    d: p.d,
                    h: p.h,
                    woodColor: p.woodColor,
                    bracketType: p.bracketType === 'wood' ? 'wood' : 'steel',
                    includeInQuote: shouldIncludeConstructionInCalculations(p, 'hangingPlanter'),
                    pos: { x: p.pos.x, y: p.pos.y, z: p.pos.z },
                    rot: p.rot,
                    plants: JSON.parse(JSON.stringify(trimPlantsList(p.plants || [])))
                })),
                railShelves: railShelves.map(s => ({
                    constructionType: 'railShelf',
                    id: s.id,
                    w: s.w,
                    d: s.d,
                    h: s.h,
                    woodColor: s.woodColor,
                    bracketType: s.bracketType === 'wood' ? 'wood' : 'steel',
                    includeInQuote: shouldIncludeConstructionInCalculations(s, 'railShelf'),
                    pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
                    rot: s.rot
                })),
                cornerFills: cornerFills.map(f => ({
                    constructionType: 'cornerFill',
                    id: f.id,
                    w: f.w,
                    d: f.d,
                    h: f.h,
                    angleDeg: f.angleDeg,
                    faceStyle: f.faceStyle || 'straight',
                    purpose: f.purpose || 'fill',
                    sourceCorner: f.sourceCorner || null,
                    shapePoints: Array.isArray(f.shapePoints) ? f.shapePoints.map(p => ({ x: p.x, z: p.z })) : null,
                    woodColor: f.woodColor,
                    includeInQuote: shouldIncludeConstructionInCalculations(f, 'cornerFill'),
                    pos: { x: f.pos.x, y: f.pos.y, z: f.pos.z },
                    rot: f.rot
                })),
                compressionShelves: compressionShelves.map(s => ({
                    constructionType: 'compressionShelf',
                    id: s.id,
                    w: s.w,
                    d: s.d,
                    boardWidth: typeof s.boardWidth === 'number' ? s.boardWidth : s.d,
                    h: s.h,
                    shelfCount: s.shelfCount,
                    woodColor: s.woodColor,
                    includeInQuote: shouldIncludeConstructionInCalculations(s, 'compressionShelf'),
                    pos: { x: s.pos.x, y: s.pos.y, z: s.pos.z },
                    rot: s.rot
                }))
            };
        }

        function applyProjectState(state, options = {}) {
            isApplyingHistory = true;

            segments = JSON.parse(JSON.stringify(state.segments || [])).map((s, idx) => ({
                ...s,
                detached: !!s.detached,
                sketchId: s.detached ? (s.sketchId || ('detached-loaded-' + idx)) : null
            }));
            constraints = JSON.parse(JSON.stringify(state.constraints || []));
            currentPoint = state.currentPoint ? { ...state.currentPoint } : null;
            detachedDrawingMode = false;
            activeDetachedSketchId = null;
            nextDetachedSketchId = 1 + segments.reduce((max, s) => {
                const match = String(s.sketchId || '').match(/detached-(\d+)$/);
                return match ? Math.max(max, parseInt(match[1], 10) || 0) : max;
            }, 0);
            sunHour2d = typeof state.sunHour2d === 'number' ? Math.max(0, Math.min(24, state.sunHour2d)) : sunHour2d;
            sunSeason = ['today', 'spring', 'summer', 'autumn', 'winter'].includes(state.sunSeason) ? state.sunSeason : 'summer';
            solarMapPeriod = ['annual', 'spring', 'summer', 'autumn', 'winter'].includes(state.solarMapPeriod) ? state.solarMapPeriod : 'annual';
            if(solarMapPeriod !== 'annual') sunSeason = solarMapPeriod;
            sunDateISO = typeof state.sunDateISO === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(state.sunDateISO) ? state.sunDateISO : sunDateISO;
            balconyOffsetX = typeof state.balconyOffsetX === 'number' ? state.balconyOffsetX : 0;
            balconyOffsetZ = typeof state.balconyOffsetZ === 'number' ? state.balconyOffsetZ : 0;
            const savedBalconyOrientationDeg = typeof state.balconyOrientationDeg === 'number'
                ? state.balconyOrientationDeg
                : state.sunOrientationDeg;
            if(typeof savedBalconyOrientationDeg === 'number') {
                balconyOrientationDeg = Math.max(0, Math.min(380, savedBalconyOrientationDeg));
            } else if(['bottom', 'right', 'top', 'left'].includes(state.sunSouthOrientation)) {
                const legacyMap = { bottom: 0, right: 270, top: 180, left: 90 };
                balconyOrientationDeg = legacyMap[state.sunSouthOrientation] ?? 0;
            }
            const savedBalconyWorldOrientationDeg = typeof state.balconyWorldOrientationDeg === 'number'
                ? state.balconyWorldOrientationDeg
                : state.viewOrientationDeg;
            balconyWorldOrientationDeg = typeof savedBalconyWorldOrientationDeg === 'number'
                ? Math.max(0, Math.min(380, savedBalconyWorldOrientationDeg))
                : balconyOrientationDeg;
            const savedScreenRotation2DDeg = typeof state.screenRotation2DDeg === 'number'
                ? state.screenRotation2DDeg
                : state.view2DAngleDeg;
            screenRotation2DDeg = typeof savedScreenRotation2DDeg === 'number'
                ? Math.max(-180, Math.min(180, savedScreenRotation2DDeg))
                : 0;
            horizonSettings = normalizeHorizonSettings(state.horizonSettings || horizonSettings);
            const guidedNeighborhoodPick = state.guidedNeighborhoodPick || {};
            const restoredNeighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const canRestoreNeighborhoodPick = !!(restoredNeighborhood.enabled && restoredNeighborhood.buildings.length);
            myBuildingPickArmed = canRestoreNeighborhoodPick && !!guidedNeighborhoodPick.myBuildingPickArmed;
            neighborhoodGridAlignmentPickArmed = canRestoreNeighborhoodPick && !!guidedNeighborhoodPick.neighborhoodGridAlignmentPickArmed;
            neighborhoodHeightEditPickArmed = canRestoreNeighborhoodPick && !!guidedNeighborhoodPick.neighborhoodHeightEditPickArmed;
            balconyBuildingPlacementPickArmed = canRestoreNeighborhoodPick && !!guidedNeighborhoodPick.balconyBuildingPlacementPickArmed;
            buildingAlignedGridActive = canRestoreNeighborhoodPick && !!guidedNeighborhoodPick.buildingAlignedGridActive;
            alignedBuildingWallNormal = canRestoreNeighborhoodPick && state.alignedBuildingWallNormal ? JSON.parse(JSON.stringify(state.alignedBuildingWallNormal)) : null;
            if(state.visAVisSettings && Array.isArray(state.visAVisSettings.zones)) {
                visAVisSettings = JSON.parse(JSON.stringify(state.visAVisSettings));
            }
            archHeights = { ...archHeights, ...(state.archHeights || {}) };
            archColors = { ...archColors, ...(state.archColors || {}) };
            slabZoneColors = { ...(state.slabZoneColors || {}) };
            selectedSlabZoneId = null;
            archOptions = { ...archOptions, ...(state.archOptions || {}) };
            if(!archOptions.railType) archOptions.railType = archOptions.railBars ? 'bars' : 'low-wall';
            archOptions.railBarSpacing = typeof archOptions.railBarSpacing === 'number' ? archOptions.railBarSpacing : 12;
            archOptions.ceiling = !!archOptions.ceiling;
            balconyDesignMode = 'balcon';
            surfaceMaterial = surfaceMaterials[state.surfaceMaterial] ? state.surfaceMaterial : 'herbe';
            surfaceHeightCm = typeof state.surfaceHeightCm === 'number' ? Math.max(1, state.surfaceHeightCm) : surfaceHeightCm;
            surfaces = [];
            currentSurfacePoints = [];
            ceilingShapePoints = Array.isArray(state.ceilingShapePoints) ? JSON.parse(JSON.stringify(state.ceilingShapePoints)) : [];
            currentCeilingPoints = [];
            hoveredSegmentIndex = -1;
            hoveredSketchSegmentIndex = -1;
            selectedSketchSegmentIndex = -1;
            selectedSketchVertexKey = null;
            hoveredSketchVertex = null;
            draggingSketchVertex = null;
            isContourClosed = !!state.isContourClosed;
            sketchLockActive = !!state.sketchLockActive;
            isSketchValidated = typeof state.isSketchValidated === 'boolean'
                ? state.isSketchValidated
                : ((state.segments && state.segments.length > 0) ? !!state.isContourClosed : true);
            if((state.segments || []).length === 0) sketchLockActive = false;
            if(!options.preserveView) {
                scale = typeof state.scale === 'number' ? state.scale : scale;
                offsetX = typeof state.offsetX === 'number' ? state.offsetX : offsetX;
                offsetY = typeof state.offsetY === 'number' ? state.offsetY : offsetY;
                currentEditorMode = state.currentEditorMode || currentEditorMode;
            }
	            splitPosition = typeof state.splitPosition === 'number' ? state.splitPosition : splitPosition;
	            mixedVisibleRatio = typeof state.mixedVisibleRatio === 'number' ? state.mixedVisibleRatio : mixedVisibleRatio;
	            cutStockLengthByProfile = { ...(state.cutStockLengthByProfile || {}) };
	            cutStockInventoryByProfile = { ...(state.cutStockInventoryByProfile || {}) };
	            workshopFreeStock = Array.isArray(state.workshopFreeStock) ? JSON.parse(JSON.stringify(state.workshopFreeStock)) : [];
	            cutSawKerfMm = Math.max(0, Math.min(20, parseLocaleNumber(state.cutSawKerfMm) || 3));
	            devisUnitPriceByProfile = { ...(state.devisUnitPriceByProfile || {}) };
	            treillisDimensionOverrides = {
                postW: state.treillisDimensionOverrides && state.treillisDimensionOverrides.postW !== undefined ? state.treillisDimensionOverrides.postW : null,
                postD: state.treillisDimensionOverrides && state.treillisDimensionOverrides.postD !== undefined ? state.treillisDimensionOverrides.postD : null,
                railW: state.treillisDimensionOverrides && state.treillisDimensionOverrides.railW !== undefined ? state.treillisDimensionOverrides.railW : null,
                railH: state.treillisDimensionOverrides && state.treillisDimensionOverrides.railH !== undefined ? state.treillisDimensionOverrides.railH : null
            };

            const _bp = balconySceneGroup || scene;
            jardinières.forEach(j => _bp.remove(j.group));
            bancs.forEach(b => _bp.remove(b.group));
            pottedTrees.forEach(t => _bp.remove(t.group));
            cubes.forEach(c => _bp.remove(c.group));
            tables.forEach(t => _bp.remove(t.group));
            chairs.forEach(c => _bp.remove(c.group));
            hangingPlanters.forEach(p => _bp.remove(p.group));
            railShelves.forEach(s => _bp.remove(s.group));
            cornerFills.forEach(f => _bp.remove(f.group));
            compressionShelves.forEach(s => _bp.remove(s.group));
            jardinières = [];
            bancs = [];
            pottedTrees = [];
            cubes = [];
            tables = [];
            chairs = [];
            hangingPlanters = [];
            railShelves = [];
            cornerFills = [];
            compressionShelves = [];
            const sourceJardinieres = Array.isArray(state.jardinières) ? state.jardinières.slice(0, MAX_JARDINIERES) : [];
            sourceJardinieres.forEach(jd => {
                const j = {
                    constructionType: jd.constructionType || 'jardiniere',
                    id: jd.id || ('j-' + Date.now() + Math.random()),
                    w: jd.w,
                    d: jd.d,
                    legH: jd.legH,
                    construction: normalizeConstructionSettings(jd.construction),
                    woodColor: jd.woodColor,
                    treillisBack: jd.treillisBack,
                    treillisLeft: jd.treillisLeft,
                    treillisRight: jd.treillisRight,
                    hasTreillis: jd.hasTreillis,
                    treillisH: jd.treillisH,
                    treillisType: jd.treillisType || 'noisetier',
                    treillisLights: !!jd.treillisLights,
                    treillisSpotLights: jd.treillisSpotLights !== undefined ? !!jd.treillisSpotLights : !!jd.treillisLights,
                    treillisWhiteGarland: jd.treillisWhiteGarland !== undefined ? !!jd.treillisWhiteGarland : (!!jd.treillisLights && !jd.treillisGinguette),
                    treillisGinguette: !!jd.treillisGinguette,
                    garlandPosts: normalizeGarlandPosts(jd.garlandPosts),
                    garlandLinks: normalizeGarlandLinks(jd.garlandLinks),
                    birdhouse: jd.birdhouse !== false,
                    layerView: normalizeLayerView(jd.layerView),
                    showSoil: jd.showSoil !== false,
                    showGeotextile: jd.showGeotextile !== false,
                    showEpdm: jd.showEpdm !== false,
                    showGravel: jd.showGravel !== false,
                    showMulch: jd.showMulch !== false,
                    includeInQuote: jd.includeInQuote !== undefined ? !!jd.includeInQuote : getDefaultConstructionInclusion('jardiniere'),
                    pos: new THREE.Vector3(jd.pos.x, jd.pos.y, jd.pos.z),
                    rot: jd.rot,
                    group: new THREE.Group(),
                    plants: JSON.parse(JSON.stringify(trimPlantsList(jd.plants || [])))
                };
                jardinières.push(j);
            });
            jardinières.forEach(j => rebuildJardiniere(j));
            const sourceBancs = Array.isArray(state.bancs) ? state.bancs : [];
            sourceBancs.forEach(bd => {
                const bench = {
                    constructionType: 'banc',
                    id: bd.id || ('b-' + Date.now() + Math.random()),
                    w: typeof bd.w === 'number' ? bd.w : 15,
                    d: typeof bd.d === 'number' ? bd.d : 3.85,
                    h: typeof bd.h === 'number' ? bd.h : 5,
                    woodColor: bd.woodColor || '#4a3228',
                    includeInQuote: bd.includeInQuote !== undefined ? !!bd.includeInQuote : getDefaultConstructionInclusion('banc'),
                    pos: new THREE.Vector3(bd.pos && typeof bd.pos.x === 'number' ? bd.pos.x : 0, 0, bd.pos && typeof bd.pos.z === 'number' ? bd.pos.z : 7),
                    rot: typeof bd.rot === 'number' ? bd.rot : 0,
                    group: new THREE.Group()
                };
                bancs.push(bench);
                rebuildBench(bench);
            });
            const sourcePottedTrees = Array.isArray(state.pottedTrees) ? state.pottedTrees : [];
            sourcePottedTrees.forEach(td => {
                const diameter = typeof td.diameter === 'number' ? td.diameter : (typeof td.w === 'number' ? td.w : 5);
                const tree = {
                    constructionType: 'pottedTree',
                    id: td.id || ('t-' + Date.now() + Math.random()),
                    diameter,
                    w: diameter,
                    d: diameter,
                    h: typeof td.h === 'number' ? td.h : 12,
                    ageYears: Math.max(1, Math.min(12, Math.round(typeof td.ageYears === 'number' ? td.ageYears : 5))),
                    shape: td.shape === 'square' ? 'square' : 'round',
                    includeInQuote: td.includeInQuote !== undefined ? !!td.includeInQuote : getDefaultConstructionInclusion('pottedTree'),
                    pos: new THREE.Vector3(td.pos && typeof td.pos.x === 'number' ? td.pos.x : 0, 0, td.pos && typeof td.pos.z === 'number' ? td.pos.z : 12),
                    rot: typeof td.rot === 'number' ? td.rot : 0,
                    group: new THREE.Group()
                };
                pottedTrees.push(tree);
                rebuildPottedTree(tree);
            });
            const sourceCubes = Array.isArray(state.cubes) ? state.cubes : [];
            sourceCubes.forEach(cd => {
                const cube = {
                    constructionType: 'cube',
                    id: cd.id || ('c-' + Date.now() + Math.random()),
                    w: typeof cd.w === 'number' ? cd.w : 19,
                    d: typeof cd.d === 'number' ? cd.d : 8,
                    h: typeof cd.h === 'number' ? cd.h : 7.2,
                    color: cd.color || '#b9793f',
                    armBack: cd.armBack !== false,
                    armSide: cd.armSide !== false,
                    mattress: cd.mattress !== false,
                    cushions: cd.cushions !== false,
                    fabricColor: cd.fabricColor || '#d8d1bd',
                    mattressColor: cd.mattressColor || cd.fabricColor || '#d8d1bd',
                    cushionColor: cd.cushionColor || '#c8bfa8',
                    includeInQuote: cd.includeInQuote !== undefined ? !!cd.includeInQuote : getDefaultConstructionInclusion('cube'),
                    pos: new THREE.Vector3(cd.pos && typeof cd.pos.x === 'number' ? cd.pos.x : 0, 0, cd.pos && typeof cd.pos.z === 'number' ? cd.pos.z : 10),
                    rot: typeof cd.rot === 'number' ? cd.rot : 0,
                    group: new THREE.Group()
                };
                cubes.push(cube);
                rebuildCube(cube);
            });
            const sourceTables = Array.isArray(state.tables) ? state.tables : [];
            sourceTables.forEach(td => {
                const table = {
                    constructionType: 'table',
                    id: td.id || ('ta-' + Date.now() + Math.random()),
                    w: typeof td.w === 'number' ? td.w : 8,
                    d: typeof td.d === 'number' ? td.d : 8,
                    h: typeof td.h === 'number' ? td.h : 7.4,
                    woodColor: td.woodColor || '#72513d',
                    includeInQuote: td.includeInQuote !== undefined ? !!td.includeInQuote : getDefaultConstructionInclusion('table'),
                    pos: new THREE.Vector3(td.pos && typeof td.pos.x === 'number' ? td.pos.x : 0, 0, td.pos && typeof td.pos.z === 'number' ? td.pos.z : 16),
                    rot: typeof td.rot === 'number' ? td.rot : 0,
                    group: new THREE.Group()
                };
                tables.push(table);
                rebuildTable(table);
            });
            const sourceChairs = Array.isArray(state.chairs) ? state.chairs : [];
            sourceChairs.forEach(cd => {
                const chair = {
                    constructionType: 'chair',
                    id: cd.id || ('ch-' + Date.now() + Math.random()),
                    w: typeof cd.w === 'number' ? cd.w : 4.6,
                    d: typeof cd.d === 'number' ? cd.d : 5.2,
                    h: typeof cd.h === 'number' ? cd.h : 8.5,
                    woodColor: cd.woodColor || '#72513d',
                    includeInQuote: cd.includeInQuote !== undefined ? !!cd.includeInQuote : getDefaultConstructionInclusion('chair'),
                    pos: new THREE.Vector3(cd.pos && typeof cd.pos.x === 'number' ? cd.pos.x : 0, 0, cd.pos && typeof cd.pos.z === 'number' ? cd.pos.z : 20),
                    rot: typeof cd.rot === 'number' ? cd.rot : 0,
                    group: new THREE.Group()
                };
                chairs.push(chair);
                rebuildChair(chair);
            });
            const sourceHangingPlanters = Array.isArray(state.hangingPlanters) ? state.hangingPlanters : [];
            sourceHangingPlanters.forEach(pd => {
                const planter = {
                    constructionType: 'hangingPlanter',
                    id: pd.id || ('hp-' + Date.now() + Math.random()),
                    w: typeof pd.w === 'number' ? pd.w : 12,
                    d: typeof pd.d === 'number' ? pd.d : 3.2,
                    h: typeof pd.h === 'number' ? pd.h : 3.6,
                    woodColor: pd.woodColor || '#9b5f31',
                    bracketType: pd.bracketType === 'wood' ? 'wood' : 'steel',
                    includeInQuote: pd.includeInQuote !== undefined ? !!pd.includeInQuote : getDefaultConstructionInclusion('hangingPlanter'),
                    pos: new THREE.Vector3(pd.pos && typeof pd.pos.x === 'number' ? pd.pos.x : 0, 0, pd.pos && typeof pd.pos.z === 'number' ? pd.pos.z : 9),
                    rot: typeof pd.rot === 'number' ? pd.rot : Math.PI,
                    group: new THREE.Group(),
                    plants: JSON.parse(JSON.stringify(trimPlantsList(pd.plants || [])))
                };
                hangingPlanters.push(planter);
                rebuildHangingPlanter(planter);
            });
            const sourceRailShelves = Array.isArray(state.railShelves) ? state.railShelves : [];
            sourceRailShelves.forEach(sd => {
                const shelf = {
                    constructionType: 'railShelf',
                    id: sd.id || ('rs-' + Date.now() + Math.random()),
                    w: typeof sd.w === 'number' ? sd.w : 10,
                    d: typeof sd.d === 'number' ? sd.d : 5.2,
                    h: typeof sd.h === 'number' ? sd.h : 8.6,
                    woodColor: sd.woodColor || '#b7773c',
                    bracketType: sd.bracketType === 'wood' ? 'wood' : 'steel',
                    includeInQuote: sd.includeInQuote !== undefined ? !!sd.includeInQuote : getDefaultConstructionInclusion('railShelf'),
                    pos: new THREE.Vector3(sd.pos && typeof sd.pos.x === 'number' ? sd.pos.x : 0, 0, sd.pos && typeof sd.pos.z === 'number' ? sd.pos.z : 13),
                    rot: typeof sd.rot === 'number' ? sd.rot : Math.PI,
                    group: new THREE.Group()
                };
                railShelves.push(shelf);
                rebuildRailShelf(shelf);
            });
            const sourceCornerFills = Array.isArray(state.cornerFills) ? state.cornerFills : [];
            sourceCornerFills.forEach(fd => {
                const fill = {
                    constructionType: 'cornerFill',
                    id: fd.id || ('cf-' + Date.now() + Math.random()),
                    w: typeof fd.w === 'number' ? fd.w : 8,
                    d: typeof fd.d === 'number' ? fd.d : 5.5,
                    h: typeof fd.h === 'number' ? fd.h : 5.5,
                    angleDeg: typeof fd.angleDeg === 'number' ? Math.max(45, Math.min(135, fd.angleDeg)) : 75,
                    faceStyle: fd.faceStyle || 'straight',
                    purpose: fd.purpose || 'fill',
                    sourceCorner: fd.sourceCorner || null,
                    shapePoints: Array.isArray(fd.shapePoints) ? fd.shapePoints.map(p => ({ x: p.x, z: p.z })) : null,
                    woodColor: fd.woodColor || '#6a4b38',
                    includeInQuote: fd.includeInQuote !== undefined ? !!fd.includeInQuote : getDefaultConstructionInclusion('cornerFill'),
                    pos: new THREE.Vector3(fd.pos && typeof fd.pos.x === 'number' ? fd.pos.x : 0, 0, fd.pos && typeof fd.pos.z === 'number' ? fd.pos.z : 12),
                    rot: typeof fd.rot === 'number' ? fd.rot : 0,
                    group: new THREE.Group()
                };
                cornerFills.push(fill);
                rebuildCornerFill(fill);
            });
            const sourceCompressionShelves = Array.isArray(state.compressionShelves) ? state.compressionShelves : [];
            sourceCompressionShelves.forEach(sd => {
                const settings = getDefaultConstructionSettings();
                const boardWidth = Math.max(0.9, Math.min(3.0, typeof sd.boardWidth === 'number' ? sd.boardWidth : (typeof sd.d === 'number' ? sd.d : (settings.boardWidth || 1.45))));
                const shelf = {
                    constructionType: 'compressionShelf',
                    id: sd.id || ('cs-' + Date.now() + Math.random()),
                    w: typeof sd.w === 'number' ? sd.w : 18,
                    d: Math.max(0.9, Math.min(3.0, typeof sd.d === 'number' ? sd.d : boardWidth)),
                    boardWidth,
                    h: typeof sd.h === 'number' ? sd.h : 25,
                    shelfCount: Math.max(2, Math.min(4, Math.round(typeof sd.shelfCount === 'number' ? sd.shelfCount : 4))),
                    woodColor: sd.woodColor || '#5a3824',
                    includeInQuote: sd.includeInQuote !== undefined ? !!sd.includeInQuote : getDefaultConstructionInclusion('compressionShelf'),
                    pos: new THREE.Vector3(sd.pos && typeof sd.pos.x === 'number' ? sd.pos.x : 0, 0, sd.pos && typeof sd.pos.z === 'number' ? sd.pos.z : 14),
                    rot: typeof sd.rot === 'number' ? sd.rot : 0,
                    group: new THREE.Group()
                };
                compressionShelves.push(shelf);
                rebuildCompressionShelf(shelf);
            });
            clearJardiniereSelection({ redraw: false });
            if(state.selected2dJardId) {
                const matched = jardinières.find(j => j.id === state.selected2dJardId) || null;
                if(matched) selectJardiniere(matched, { openEditor: false, redraw: false });
            }
            if(state.selected2dBenchId) {
                selected2dBench = bancs.find(b => b.id === state.selected2dBenchId) || null;
                selectedPlacementObject = selected2dBench;
            }
            if(state.selected2dPottedTreeId) {
                selected2dPottedTree = pottedTrees.find(t => t.id === state.selected2dPottedTreeId) || null;
                selectedPlacementObject = selected2dPottedTree;
            }
            if(state.selected2dCubeId) {
                selected2dCube = cubes.find(c => c.id === state.selected2dCubeId) || null;
                selectedPlacementObject = selected2dCube;
            }
            if(state.selected2dCornerFillId) {
                selected2dCornerFill = cornerFills.find(f => f.id === state.selected2dCornerFillId) || null;
                selectedPlacementObject = selected2dCornerFill;
            }
            if(state.selectedConstruction && state.selectedConstruction.id) {
                const matchedEntry = getConstructionItems(state.selectedConstruction.type || null)
                    .find(entry => entry.item && entry.item.id === state.selectedConstruction.id);
                if(matchedEntry) selectPlacementObject(matchedEntry.item, { openEditor: false, redraw: false });
            }

            document.getElementById('input-wall').value = archHeights.wall;
            document.getElementById('input-window-bot').value = archHeights.windowBot;
            document.getElementById('input-window-top').value = archHeights.windowTop;
            document.getElementById('input-glass-bot').value = archHeights.glassBot;
            document.getElementById('input-glass-top').value = archHeights.glassTop;
            document.getElementById('input-rail').value = archHeights.rail;
            const wallColorInput = document.getElementById('input-wall-color');
            if(wallColorInput) wallColorInput.value = archColors.wall;
            const slabColorInput = document.getElementById('input-slab-color');
            if(slabColorInput) slabColorInput.value = typeof getSlabZoneColor === 'function' ? getSlabZoneColor(selectedSlabZoneId || 'primary') : archColors.slab;
            const ceilingColorInput = document.getElementById('input-ceiling-color');
            if(ceilingColorInput) ceilingColorInput.value = archColors.ceiling || '#d8d2c4';
            const railColorInput = document.getElementById('input-rail-color');
            if(railColorInput) railColorInput.value = archColors.rail;
            updateArchPalettesUI();
            const railTypeSelect = document.getElementById('input-rail-type');
            if(railTypeSelect) railTypeSelect.value = archOptions.railType || 'low-wall';
            const railSpacingInput = document.getElementById('input-rail-spacing');
            if(railSpacingInput) railSpacingInput.value = archOptions.railBarSpacing || 12;
            const ceilingInput = document.getElementById('input-ceiling');
            if(ceilingInput) ceilingInput.checked = !!archOptions.ceiling;
            const ceilingBtn = document.getElementById('btn-ceiling');
            if(ceilingBtn) ceilingBtn.classList.toggle('active', !!archOptions.ceiling);
            syncSun2dControls();
            updateSun(sunHour2d);
            rebuildHorizonWall();
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();

            build3DArch();
            updateOutdoorModeUI();
            updateModeToolbarUI();
            // No exterior surfaces in balcony-only mode, ignore legacy surface state.
            updateSurfaceMaterialUI();
            if(!options.preserveView) {
                switchEditor(currentEditorMode);
                if(state.activeMainView) setMainView(state.activeMainView, { skipValidation: true });
                if(activeMainView === 'mixte') applySplitPosition({ animate: true });
                fit2DViewToScene();
            }
            updateJardPanel();
            if(typeof updateMyBuildingPickHud === 'function') updateMyBuildingPickHud();
            if(typeof updateBalconyPlacementHud === 'function') updateBalconyPlacementHud();
            updateSketchLockUI();
            updateCollisionBanner();
            draw2D();

            isApplyingHistory = false;
            if(!options.skipDirty) hasUnsavedChanges = true;
        }

        function setDownloadProgressVisible(visible) {
            const box = document.getElementById('download-progress');
            const spinner = document.getElementById('fluidity-spinner');
            if(box) {
                box.classList.toggle('visible', !!visible);
                box.setAttribute('aria-hidden', visible ? 'false' : 'true');
            }
            if(spinner) {
                spinner.classList.toggle('visible', !!visible);
            }
        }

        function normalizeDownloadProgressPercent(percent, fallback = downloadProgressPercent) {
            const raw = Number(percent);
            const base = Number.isFinite(raw) ? raw : Number(fallback);
            return Math.max(0, Math.min(100, Math.round(Number.isFinite(base) ? base : 0)));
        }

        function updateDownloadProgress(percent, status, label) {
            const box = document.getElementById('download-progress');
            if(!box) return;
            const pct = normalizeDownloadProgressPercent(percent);
            downloadProgressPercent = pct;
            const bar = document.getElementById('download-progress-bar');
            const pctEl = document.getElementById('download-progress-percent');
            const statusEl = document.getElementById('download-progress-status');
            const labelEl = document.getElementById('download-progress-label');
            box.dataset.progress = String(pct);
            box.style.setProperty('--download-progress-pct', pct + '%');
            if(label && labelEl) labelEl.textContent = label;
            if(bar) {
                bar.style.width = pct + '%';
                bar.setAttribute('role', 'progressbar');
                bar.setAttribute('aria-valuemin', '0');
                bar.setAttribute('aria-valuemax', '100');
                bar.setAttribute('aria-valuenow', String(pct));
            }
            if(pctEl) pctEl.textContent = pct + '%';
            if(statusEl && status) statusEl.textContent = status;
        }

        async function startDownloadProgress(label, status = 'Préparation du fichier...', percent = 4) {
            if(downloadProgressHideTimer) {
                clearTimeout(downloadProgressHideTimer);
                downloadProgressHideTimer = null;
            }
            updateDownloadProgress(percent, status, label);
            setDownloadProgressVisible(true);
            await waitAnimationFrame();
        }

        function finishDownloadProgress(status = 'Téléchargement lancé.') {
            updateDownloadProgress(100, status);
            downloadProgressHideTimer = setTimeout(() => {
                setDownloadProgressVisible(false);
                downloadProgressHideTimer = null;
            }, 1200);
        }

        function failDownloadProgress(status = 'Export interrompu.') {
            updateDownloadProgress(downloadProgressPercent, status);
            downloadProgressHideTimer = setTimeout(() => {
                setDownloadProgressVisible(false);
                downloadProgressHideTimer = null;
            }, 1800);
        }

        function getStoredColorMode() {
            try {
                return localStorage.getItem(COLOR_MODE_STORAGE_KEY) === 'light' ? 'light' : 'dark';
            } catch(err) {
                return 'dark';
            }
        }

        function isLightMode() {
            return document.body && document.body.classList.contains('light-mode');
        }

        function applyColorMode(mode, options = {}) {
            const useLight = mode === 'light';
            document.body.classList.toggle('light-mode', useLight);
            const btn = document.getElementById('btn-theme-toggle');
            const label = document.getElementById('theme-toggle-label');
            if(btn) {
                btn.classList.toggle('active', useLight);
                btn.title = useLight ? 'Mode sombre' : 'Mode clair extérieur';
                btn.setAttribute('aria-pressed', useLight ? 'true' : 'false');
            }
            if(label) label.textContent = useLight ? 'Sombre' : 'Clair';
            const themeMeta = document.querySelector('meta[name="theme-color"]');
            if(themeMeta) themeMeta.setAttribute('content', useLight ? '#f8f7ef' : '#1e1e1e');
            if(!options.skipPersist) {
                try {
                    localStorage.setItem(COLOR_MODE_STORAGE_KEY, useLight ? 'light' : 'dark');
                } catch(err) {}
            }
            if(activeMainView === '2d' || activeMainView === 'mixte') draw2D();
        }

        function toggleColorMode() {
            applyColorMode(isLightMode() ? 'dark' : 'light');
        }

        async function downloadBlobFile(filename, blob, label = 'Téléchargement') {
            if(downloadProgressHideTimer) {
                clearTimeout(downloadProgressHideTimer);
                downloadProgressHideTimer = null;
            }
            updateDownloadProgress(62, 'Préparation du téléchargement...', label);
            setDownloadProgressVisible(true);
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            updateDownloadProgress(88, 'Ouverture de la boîte de téléchargement...');
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 1200);
            finishDownloadProgress();
        }

        async function saveProjectToFile() {
            if(!currentProjectName || currentProjectName.trim() === '') {
                currentProjectName = 'Projet Balcon Bleu';
            }
            const payload = {
                projectName: currentProjectName,
                savedAt: new Date().toISOString(),
                state: exportProjectState()
            };
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
            await downloadBlobFile((currentProjectName || 'projet').replace(/[^a-z0-9-_]+/gi, '_') + '.json', blob, 'Enregistrement du projet');
            hasUnsavedChanges = false;
        }

        async function saveProjectAsToFile() {
            const proposed = prompt('Nom du projet (enregistrer sous) :', currentProjectName || 'Projet Balcon Bleu');
            if(proposed === null) return;
            const cleaned = proposed.trim();
            if(!cleaned) {
                alert('Nom de projet invalide.');
                return;
            }
            currentProjectName = cleaned;
            document.getElementById('project-name').textContent = currentProjectName;
            
            const payload = {
                projectName: currentProjectName,
                savedAt: new Date().toISOString(),
                state: exportProjectState()
            };
            const jsonStr = JSON.stringify(payload, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });
            await downloadBlobFile((currentProjectName || 'projet').replace(/[^a-z0-9-_]+/gi, '_') + '.json', blob, 'Enregistrement du projet');
            hasUnsavedChanges = false;
        }

        function confirmCanCloseCurrentProject(actionLabel) {
            if(!hasUnsavedChanges) return true;
            const shouldSave = confirm('Le projet actuel contient des modifications non enregistrées.\n\nVoulez-vous l\'enregistrer avant de ' + actionLabel + ' ?');
            if(shouldSave) {
                saveProjectToFile();
                return true;
            }
            return confirm('Continuer sans enregistrer ?');
        }

        function requestLoadProject() {
            if(canAutoFinalizeSketch()) {
                finalizeSketchClosure({ silent: true });
            } else if(doesSketchNeedClosure()) {
                showSketchClosureAlert("Contour encore ouvert: terminez-le avant de charger un autre projet.");
                return;
            }
            if(!confirmCanCloseCurrentProject('charger un autre projet')) return;
            document.getElementById('project-file-input').click();
        }

        function handleProjectFile(event) {
            const file = event.target.files && event.target.files[0];
            if(!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const raw = JSON.parse(e.target.result);
                    const state = raw.state || raw;
                    currentProjectName = (raw.projectName || file.name.replace(/\.json$/i, '') || 'Projet Balcon Bleu');
                    document.getElementById('project-name').textContent = currentProjectName;
                    applyProjectState(state, { skipDirty: true });
                    appHistory = [];
                    historyIndex = -1;
                    saveState();
                    hasUnsavedChanges = false;
                    updateSketchLockUI();
                } catch (err) {
                    alert('Fichier projet invalide.');
                }
            };
            reader.readAsText(file);
            event.target.value = '';
        }
