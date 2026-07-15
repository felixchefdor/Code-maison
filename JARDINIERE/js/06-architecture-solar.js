        let selectedSolarMapCell = null;
        let solarMapTooltipHideTimer = null;

        function applySplitPosition(options = {}) {
            updateRenderStageLayout(options);
        }

        function addPlantTo2dJard() {
            if(!selected2dJardiniere) return;
            const j = selected2dJardiniere;
            if((j.plants || []).length >= MAX_PLANTS_PER_JARDINIERE) {
                alert('Limite atteinte: maximum ' + MAX_PLANTS_PER_JARDINIERE + ' plantes par jardiniere.');
                return;
            }
            saveState();
            const type = document.getElementById('jard-plant-type-2d').value;
            const preset = PLANT_PRESETS[type];
            j.plants.push({
                type, ...preset,
                scatterSeed: preset.onTreillis ? undefined : Math.random() * 100000 + j.plants.length * 97,
                visualScale: preset.onTreillis ? 1 : 0.55 + Math.random() * 0.95,
                x: (Math.random() - 0.5) * (j.w - 2),
                z: (Math.random() - 0.5) * (j.d - 2)
            });
            rebuildJardiniere(j);
            updateJardPanel();
        }

        function isOptimized3DLightingMode() {
            return Array.isArray(jardinières) && jardinières.length >= OPTIMIZED_LIGHTING_JARDINIERE_COUNT;
        }

        window.removePlantFrom2dJard = function(idx) {
            if(!selected2dJardiniere) return;
            saveState();
            const j = selected2dJardiniere;
            j.plants.splice(idx, 1);
            rebuildJardiniere(j);
            updateJardPanel();
        };

        function open2D() {
            return setMainView('2d', { skipValidation: true });
        }

        function close2D() {
            return setMainView('3d');
        }
       
       function closeContourAutomatically() {
           const contourSegments = getPrimaryContourSegments();
           if(contourSegments.length === 0) return;
           
           // Trouver le premier et dernier point
           const firstPoint = contourSegments[0].p1;
           const lastSegment = contourSegments[contourSegments.length - 1];
           const lastPoint = lastSegment.p2;
           const closingType = drawingMode || lastSegment.type || 'wall';
           
           // Si pas déjà très proches, ajouter un segment de fermeture
           const dx = lastPoint.x - firstPoint.x;
           const dy = lastPoint.y - firstPoint.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           
           if(dist > GRID_SIZE) {
               segments.push({ p1: lastPoint, p2: firstPoint, type: closingType });
           }
           
           isContourClosed = true;
           draw2D();
       }

       function closeDetachedContourAutomatically() {
           const contourSegments = getActiveDetachedSegments();
           if(contourSegments.length === 0) return;

           const firstPoint = contourSegments[0].p1;
           const lastSegment = contourSegments[contourSegments.length - 1];
           const lastPoint = lastSegment.p2;
           const closingType = drawingMode || lastSegment.type || 'wall';
           const dx = lastPoint.x - firstPoint.x;
           const dy = lastPoint.y - firstPoint.y;
           const dist = Math.sqrt(dx * dx + dy * dy);

           if(dist > GRID_SIZE) {
               const sharedContourSegment = findSharedExistingContourSegmentBetween(lastPoint, firstPoint, activeDetachedSketchId);
               if(activeDetachedSketchId && !slabZoneColors[activeDetachedSketchId]) {
                   slabZoneColors[activeDetachedSketchId] = getSlabZoneColor(selectedSlabZoneId || 'primary');
               }
               segments.push({
                   p1: lastPoint,
                   p2: firstPoint,
                   type: sharedContourSegment ? sharedContourSegment.type : closingType,
                   detached: true,
                   sketchId: activeDetachedSketchId,
                   sharedContourEdge: !!sharedContourSegment
               });
           }
           draw2D();
       }
       
       function checkIfContourClosed() {
           const contourSegments = getPrimaryContourSegments();
           if(contourSegments.length < 3) {
               isContourClosed = false;
               return;
           }
           
           const firstPoint = contourSegments[0].p1;
           const lastPoint = contourSegments[contourSegments.length - 1].p2;
           const dx = firstPoint.x - lastPoint.x;
           const dy = firstPoint.y - lastPoint.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           
           // Considérer fermé si à moins de 40 pixels de distance
           isContourClosed = dist < 40;
       }
        function clearPlan() {
            const ok = confirm('Réinitialiser le projet en cours ?');
            if(!ok) return;
            saveState();
            const balconyParent = balconySceneGroup || scene;
            jardinières.forEach(j => { if(j && j.group) balconyParent.remove(j.group); });
            bancs.forEach(b => { if(b && b.group) balconyParent.remove(b.group); });
            pottedTrees.forEach(t => { if(t && t.group) balconyParent.remove(t.group); });
            cubes.forEach(c => { if(c && c.group) balconyParent.remove(c.group); });
            cornerFills.forEach(f => { if(f && f.group) balconyParent.remove(f.group); });
            tables.forEach(t => { if(t && t.group) balconyParent.remove(t.group); });
            chairs.forEach(c => { if(c && c.group) balconyParent.remove(c.group); });
            if(typeof clearMagicDustBursts === 'function') clearMagicDustBursts();
            segments = [];
            constraints = [];
            surfaces = [];
            currentSurfacePoints = [];
            ceilingShapePoints = [];
            currentCeilingPoints = [];
            horizonPanelOpen = false;
            horizonSettings = normalizeHorizonSettings({ enabled: false, radiusM: 20, eyeHeightM: 1.7, points: horizonSettings.points });
            currentPoint = null;
            detachedDrawingMode = false;
            activeDetachedSketchId = null;
            nextDetachedSketchId = 1;
            mousePos2d = null;
            hoveredSegmentIndex = -1;
            hoveredSketchSegmentIndex = -1;
            selectedSketchSegmentIndex = -1;
            selectedSketchVertexKey = null;
            hoveredSketchVertex = null;
            draggingSketchVertex = null;
            jardinières = [];
            bancs = [];
            pottedTrees = [];
            cubes = [];
            cornerFills = [];
            tables = [];
            chairs = [];
            selectedPlacementObject = null;
            selected2dJardiniere = null;
            selected2dBench = null;
            selected2dPottedTree = null;
            selected2dCube = null;
            selected2dCornerFill = null;
            draggedBench = null;
            pendingDraggedBench = null;
            rotatingBench = null;
            resizingBench = null;
            isContourClosed = false;
            isSketchValidated = true;
            sketchLockActive = false;
            slabZoneColors = {};
            selectedSlabZoneId = null;
            const startPos = typeof getDefaultJardiniereStartPosition === 'function' ? getDefaultJardiniereStartPosition() : { x: 0, z: 2.5 };
            addNewJardiniere({ selectNew: false, updatePanel: false, x: startPos.x, z: startPos.z });
            if(jardinières[0]) selectJardiniere(jardinières[0], { openEditor: false, redraw: false });
            updateSketchLockUI();
            updateCollisionBanner();
            rebuildHorizonWall();
            build3DArch();
            updateJardPanel();
            draw2D();
        }

        function undoSegment() {
            if(historyIndex <= 0) return;
            const fromState = appHistory[historyIndex];
            historyIndex -= 1;
            const toState = appHistory[historyIndex];
            applyProjectState(JSON.parse(JSON.stringify(toState)), { skipDirty: true, preserveView: true });
            // Si un segment a été supprimé et l'outil est actif, pointer au début du segment supprimé
            if(isDrawingToolActive && !currentPoint && fromState && toState &&
               (fromState.segments || []).length > (toState.segments || []).length) {
                const firstRemovedSeg = (fromState.segments || [])[(toState.segments || []).length];
                if(firstRemovedSeg && firstRemovedSeg.p1) {
                    currentPoint = { x: firstRemovedSeg.p1.x, y: firstRemovedSeg.p1.y };
                }
            }
            hasUnsavedChanges = true;
            refreshArchitectureNow();
            scheduleVisible2DRedraw({ recenter: false });
        }

        function redoSegment() {
            if(historyIndex >= appHistory.length - 1) return;
            historyIndex += 1;
            applyProjectState(JSON.parse(JSON.stringify(appHistory[historyIndex])), { skipDirty: true, preserveView: true });
            hasUnsavedChanges = true;
            refreshArchitectureNow();
            scheduleVisible2DRedraw({ recenter: false });
        }

        function saveState() {
            if(isApplyingHistory) return;
            const snapshot = exportProjectState();
            if(historyIndex >= 0) {
                const current = JSON.stringify(appHistory[historyIndex]);
                const next = JSON.stringify(snapshot);
                if(current === next) return;
            }
            if(historyIndex < appHistory.length - 1) {
                appHistory = appHistory.slice(0, historyIndex + 1);
            }
            appHistory.push(snapshot);
            if(appHistory.length > MAX_HISTORY_ENTRIES) {
                const overflow = appHistory.length - MAX_HISTORY_ENTRIES;
                appHistory.splice(0, overflow);
            }
            historyIndex = appHistory.length - 1;
            hasUnsavedChanges = true;
        }
        function isKeyboardShortcutEditingText(e) {
            const el = e && e.target;
            if(!el) return false;
            if(el.isContentEditable) return true;
            const tag = (el.tagName || '').toLowerCase();
            if(tag === 'textarea') return true;
            if(tag === 'select') return true;
            if(tag === 'input') {
                const type = (el.type || 'text').toLowerCase();
                return !['range', 'checkbox', 'radio', 'color', 'button', 'submit', 'reset', 'file'].includes(type);
            }
            return false;
        }

       window.addEventListener('keydown', (e) => {
    const modal2d = document.getElementById('modal-2d');
    if (!modal2d || modal2d.style.display === 'none') return;

    const key = e.key.toLowerCase();
    const isCommandShortcut = e.ctrlKey || e.metaKey;
    const isEditingText = isKeyboardShortcutEditingText(e);

    if (isCommandShortcut && key === 's') {
        e.preventDefault();
        saveProjectAsToFile();
        return;
    }

    if (isCommandShortcut && key === 'c' && getSelectedPlacementObject()) {
        if(copySelectedPlacementObjectToClipboard()) e.preventDefault();
        return;
    }

    if (isCommandShortcut && key === 'v' && copiedPlacementBlueprint) {
        if(!e.repeat && pasteCopiedPlacementObject()) e.preventDefault();
        return;
    }

    if(isEditingText) return;

    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && typeof cycleSelectedCornerArrangementModel === 'function') {
        const selectedObject = typeof getSelectedPlacementObject === 'function' ? getSelectedPlacementObject() : null;
        const isAutoCornerArrangement = selectedObject
            && typeof getPlacementType === 'function'
            && getPlacementType(selectedObject) === 'cornerFill'
            && selectedObject.sourceCorner
            && selectedObject.sourceCorner.corner;
        if(isAutoCornerArrangement) {
            e.preventDefault();
            cycleSelectedCornerArrangementModel(e.key === 'ArrowRight' ? 1 : -1);
            return;
        }
    }

    if (isCommandShortcut && key === 'z') {
        e.preventDefault();

        if (e.shiftKey) {
            redoSegment(); // Ctrl+Shift+Z
        } else {
            undoSegment(); // Ctrl+Z
        }
        return;
    }

    if (isCommandShortcut && key === 'y') {
        e.preventDefault();
        redoSegment();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if(deleteSelectedSketchElement()) {
            e.preventDefault();
            return;
        }
        if(getSelectedPlacementObject()) {
            e.preventDefault();
            deleteSelectedPlacementObject();
            return;
        }
    }

    if (e.key === 'Escape') {
        closeHorizonDrawView();
        toggleHorizonPanel(false);
        closeTechPlanModal();
        if(typeof closeCompass2DPopup === 'function') closeCompass2DPopup();
        if(typeof stopCornerArrangementTool === 'function') stopCornerArrangementTool({ clearPanel: true });
        clearSketchElementSelection({ redraw: false });
        clearActiveDrawingTool({ redraw: true });
    }
});
        function clearActiveDrawingTool(options = {}) {
            const { redraw = false } = options;
            currentPoint = null;
            mousePos2d = null;
            currentCeilingPoints = [];
            detachedDrawingMode = false;
            activeDetachedSketchId = null;
            isDrawingToolActive = false;
            clearGarlandToolMode({ redraw: false });
            if(typeof stopCornerArrangementTool === 'function') stopCornerArrangementTool({ clearPanel: true });
            if (canvas2d) canvas2d.style.cursor = 'default';
            document.querySelectorAll('.sidebar-2d .tool-btn').forEach(b => b.classList.remove('active'));
            if(redraw) draw2D();
            if((activeMainView === '3d' || activeMainView === 'mixte') && typeof build3DArch === 'function') {
                build3DArch();
                if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
            }
        }

        function selectDefaultWallTool() {
            currentPoint = null;
            currentCeilingPoints = [];
            detachedDrawingMode = false;
            activeDetachedSketchId = null;
            clearGarlandToolMode({ redraw: false });
            drawingMode = 'wall';
            isDrawingToolActive = true;
            document.querySelectorAll('.sidebar-2d .tool-btn').forEach(b => b.classList.remove('active'));
            const wallBtn = document.getElementById('btn-wall');
            if(wallBtn) wallBtn.classList.add('active');
            if(canvas2d) canvas2d.style.cursor = 'crosshair';
        }

        function setTool(t) {
            if(activeMainView === '3d') {
                setMainView('mixte', { skipValidation: true });
            }
            if(t === 'ceiling-shape' && !archOptions.ceiling) {
                archOptions.ceiling = true;
                const ceilingInput = document.getElementById('input-ceiling');
                if(ceilingInput) ceilingInput.checked = true;
                const ceilingBtn = document.getElementById('btn-ceiling');
                if(ceilingBtn) ceilingBtn.classList.add('active');
                saveState();
            }
            clearGarlandToolMode({ redraw: false });
            drawingMode = t;
            isDrawingToolActive = true;
            if(isConstraintTool(t)) currentPoint = null;
            if(t !== 'ceiling-shape') currentCeilingPoints = [];
            document.querySelectorAll('.sidebar-2d .tool-btn').forEach(b => b.classList.remove('active'));
            document.getElementById('btn-' + t).classList.add('active');
            if (canvas2d) canvas2d.style.cursor = 'crosshair';
        }

        function setOutdoorMode(mode) {
            balconyDesignMode = mode === 'exterieur' ? 'exterieur' : 'balcon';
            updateOutdoorModeUI();
            updateModeToolbarUI();
            if(balconyDesignMode === 'exterieur') {
                setTool('surface');
            } else {
                currentSurfacePoints = [];
                currentPoint = null;
                if(drawingMode === 'surface') {
                    setTool('wall');
                }
            }
            build3DArch();
            draw2D();
        }

        function updateOutdoorModeUI() {
            const balconBtn = document.getElementById('btn-mode-balcon');
            const exterieurBtn = document.getElementById('btn-mode-exterieur');
            if(balconBtn && exterieurBtn) {
                balconBtn.classList.toggle('active', balconyDesignMode === 'balcon');
                exterieurBtn.classList.toggle('active', balconyDesignMode === 'exterieur');
            }
        }

        function updateModeToolbarUI() {
            const balconyOnly = document.querySelectorAll('.balcony-only');
            const gardenOnly = document.querySelectorAll('.garden-only');
            balconyOnly.forEach(el => { el.style.display = balconyDesignMode === 'balcon' ? 'block' : 'none'; });
            gardenOnly.forEach(el => { el.style.display = balconyDesignMode === 'exterieur' ? 'block' : 'none'; });
            const surfaceHeightInput = document.getElementById('surface-height-input');
            if(surfaceHeightInput) surfaceHeightInput.value = surfaceHeightCm;
        }

        function setSurfaceMaterial(type) {
            surfaceMaterial = surfaceMaterials[type] ? type : 'herbe';
            updateSurfaceMaterialUI();
            build3DArch();
            draw2D();
        }

        function setSurfaceHeight(value) {
            if(!Number.isFinite(value) || value <= 0) return;
            surfaceHeightCm = Math.max(1, value);
            const input = document.getElementById('surface-height-input');
            if(input) input.value = surfaceHeightCm;
            build3DArch();
            draw2D();
        }

        function updateSurfaceMaterialUI() {
            Object.keys(surfaceMaterials).forEach(type => {
                const btn = document.getElementById('btn-surface-' + type);
                if(btn) btn.classList.toggle('active', surfaceMaterial === type);
            });
        }

        function pointInPolygon(point, polygon) {
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

        function clipSolarMapPolygonByAxis(points, axis, limit, keepGreater) {
            if(!Array.isArray(points) || points.length < 3) return [];
            const value = (p) => axis === 'x' ? p.x : p.y;
            const inside = (p) => keepGreater ? value(p) >= limit - 0.001 : value(p) <= limit + 0.001;
            const output = [];
            for(let i = 0; i < points.length; i++) {
                const cur = points[i];
                const prev = points[(i + points.length - 1) % points.length];
                const curInside = inside(cur);
                const prevInside = inside(prev);
                if(curInside !== prevInside) {
                    const denom = value(cur) - value(prev);
                    const t = Math.abs(denom) < 1e-9 ? 0 : (limit - value(prev)) / denom;
                    output.push({
                        x: prev.x + (cur.x - prev.x) * t,
                        y: prev.y + (cur.y - prev.y) * t
                    });
                }
                if(curInside) output.push(cur);
            }
            return output;
        }

        function clipSolarMapPolygonToRect(points, minX, minY, maxX, maxY) {
            let output = Array.isArray(points) ? points.map(pt => ({ x: pt.x, y: pt.y })) : [];
            output = clipSolarMapPolygonByAxis(output, 'x', minX, true);
            output = clipSolarMapPolygonByAxis(output, 'x', maxX, false);
            output = clipSolarMapPolygonByAxis(output, 'y', minY, true);
            output = clipSolarMapPolygonByAxis(output, 'y', maxY, false);
            return output;
        }

        function getSolarMapPolygonCentroid(points) {
            if(!Array.isArray(points) || points.length < 3) return null;
            let areaFactor = 0;
            let cx = 0;
            let cy = 0;
            for(let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const cross = a.x * b.y - b.x * a.y;
                areaFactor += cross;
                cx += (a.x + b.x) * cross;
                cy += (a.y + b.y) * cross;
            }
            if(Math.abs(areaFactor) < 1e-6) {
                return points.reduce((acc, pt) => ({ x: acc.x + pt.x / points.length, y: acc.y + pt.y / points.length }), { x: 0, y: 0 });
            }
            return {
                x: cx / (3 * areaFactor),
                y: cy / (3 * areaFactor)
            };
        }

        function getSurfaceHeightAtPosition(x, z) {
            let height = 0;
            surfaces.forEach(surface => {
                if(pointInPolygon({ x, y: z }, surface.points)) {
                    height = Math.max(height, surface.heightCm / 10);
                }
            });
            return height;
        }

        function getPolygonBoundingBox(points) {
            let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
            points.forEach(pt => {
                const x = pt.x;
                const y = pt.z !== undefined ? pt.z : pt.y;
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            });
            return {
                minX,
                minY,
                maxX,
                maxY,
                width: maxX - minX,
                height: maxY - minY
            };
        }

        function getSolarMapSourcePolygons() {
            const objectSurfaces = getSolarMapObjectSurfacePolygons();
            const verticalSurfaces = getSolarMapVerticalSurfacePolygons();
            const exteriorSurfaces = balconyDesignMode === 'exterieur'
                ? surfaces
                    .filter(surface => surface && Array.isArray(surface.points) && surface.points.length >= 3)
                    .map((surface, index) => ({
                        id: surface.id || 'surface-' + index,
                        label: surface.name || 'Surface extérieure',
                        kind: 'ground',
                        polygon: surface.points.map(pt => ({ x: pt.x, y: pt.y })),
                        surfaceY: Math.max(0, (Number(surface.heightCm) || 0) / 10),
                        clipCellsToPolygon: true
                    }))
                : [];
            if(exteriorSurfaces.length) return exteriorSurfaces.concat(objectSurfaces, verticalSurfaces);

            if(typeof getSlabZoneEntries2D === 'function') {
                const slabZones = getSlabZoneEntries2D()
                    .filter(entry => entry && Array.isArray(entry.polygon) && entry.polygon.length >= 3)
                    .map((entry, index) => ({
                        id: entry.id || 'zone-' + index,
                        label: entry.label || 'Zone au sol',
                        kind: 'ground',
                        polygon: entry.polygon.map(pt => ({ x: pt.x, y: pt.y })),
                        clipCellsToPolygon: true
                    }));
                if(slabZones.length) return slabZones.concat(objectSurfaces, verticalSurfaces);
            }

            const primary = getPrimaryContourPolygon2D();
            return primary.length >= 3
                ? [{ id: 'primary', label: 'Sol du balcon', kind: 'ground', polygon: primary, clipCellsToPolygon: true }].concat(objectSurfaces, verticalSurfaces)
                : objectSurfaces.concat(verticalSurfaces);
        }

        function getSolarMapObjectSurfacePolygons() {
            if(typeof getConstructionItems !== 'function') return [];
            const labels = {
                jardiniere: 'Jardinière',
                banc: 'Banc',
                pottedTree: 'Arbre en pot',
                cube: 'Méridienne',
                table: 'Table',
                chair: 'Chaise',
                hangingPlanter: 'Jardinière garde-corps',
                railShelf: 'Tablette garde-corps',
                cornerFill: 'Comble-angle'
            };
            return getConstructionItems()
                .map((entry, index) => createSolarMapObjectSurfaceSource(entry, labels[entry.type] || 'Objet', index))
                .filter(Boolean);
        }

        function createSolarMapObjectSurfaceSource(entry, label, index) {
            const item = entry && entry.item;
            if(!item || !item.pos || !Number.isFinite(item.pos.x) || !Number.isFinite(item.pos.z)) return null;
            const type = entry.type || item.constructionType || 'object';
            const w = Math.max(0, Number(item.w || item.diameter) || 0);
            const d = Math.max(0, Number(item.d || item.diameter) || 0);
            if(w < 0.6 || d < 0.6) return null;
            let surfaceY = Math.max(0.15, Number(item.h) || 0);
            if(type === 'jardiniere') {
                const metrics = item.renderMetrics || (typeof computeJardiniereConstructionMetrics === 'function' ? computeJardiniereConstructionMetrics(item) : null);
                surfaceY = metrics && Number.isFinite(metrics.postHeight) ? metrics.postHeight + 0.01 : Math.max(0.35, Number(item.legH) || 2.5);
            } else if(type === 'cube') {
                const metrics = typeof computeMeridienneMetrics === 'function' ? computeMeridienneMetrics(item, getDefaultConstructionSettings()) : null;
                surfaceY = metrics ? metrics.slatY + metrics.slatT / 2 + 0.82 + 1.34 / 2 + 0.03 : Math.max(0.15, Number(item.h) || 0);
            } else if(type === 'chair') {
                const metrics = typeof getChairJoineryMetrics === 'function' ? getChairJoineryMetrics(item, getDefaultConstructionSettings()) : null;
                surfaceY = metrics && Number.isFinite(metrics.seatH) ? metrics.seatH : Math.max(1.5, (Number(item.h) || 8.5) * 0.42);
            } else if(type === 'pottedTree') {
                surfaceY = getSolarMapPottedTreeSoilSurfaceY(item) + 0.02;
            } else if(type === 'cornerFill') {
                surfaceY = getSolarMapCornerFillSlatSurfaceY(item);
            }
            const polygon = type === 'pottedTree'
                ? createSolarMapLocalCirclePolygon(item, Math.max(w, d) / 2, 24)
                : type === 'chair'
                ? createSolarMapChairSeatPolygon(item)
                : type === 'cornerFill'
                ? createSolarMapCornerFillSurfacePolygon(item, w, d)
                : createSolarMapPlacementRectanglePolygon(item, w, d);
            return {
                id: 'object-' + type + '-' + (item.id || index),
                label,
                kind: 'object',
                objectType: type,
                objectId: item.id || null,
                polygon,
                surfaceY,
                clipCellsToPolygon: true,
                show3DOutline: true
            };
        }

        function getSolarMapCornerFillSlatSurfaceY(fill) {
            const settings = typeof getDefaultConstructionSettings === 'function' ? getDefaultConstructionSettings() : null;
            const slatT = settings && Number.isFinite(settings.floorSlatThickness) ? settings.floorSlatThickness : 0.22;
            const fillH = Number(fill && fill.h);
            const baseH = Number.isFinite(fillH) ? fillH : 0;
            if(fill && fill.purpose === 'planter') return baseH + 0.08;
            return baseH + slatT + 0.07;
        }

        function createSolarMapCornerFillSurfacePolygon(item, fallbackW, fallbackD) {
            if(typeof getCornerFillLocalPoints === 'function') {
                const pts = getCornerFillLocalPoints(item);
                if(Array.isArray(pts) && pts.length >= 3) return createSolarMapLocalPolygon(item, pts);
            }
            return createSolarMapPlacementRectanglePolygon(item, fallbackW, fallbackD);
        }

        function getSolarMapPottedTreeSoilSurfaceY(tree) {
            const diameter = Math.max(0.6, Number(tree.diameter || tree.w || tree.d) || 5);
            const potH = Math.max(3.15, Math.min(4.9, diameter * 0.8));
            return tree.shape === 'square' ? potH + 0.18 : potH + 0.36;
        }

        function createSolarMapChairSeatPolygon(chair) {
            const metrics = typeof getChairJoineryMetrics === 'function' ? getChairJoineryMetrics(chair, getDefaultConstructionSettings()) : null;
            if(!metrics) return createSolarMapPlacementRectanglePolygon(chair, chair.w || 4.6, Math.max(1, (chair.d || 5.2) * 0.7));
            const seatDepth = Math.max(0.8, metrics.seatLayout.totalDepth || (metrics.frontZ - metrics.backZ - metrics.legWide * 1.15));
            const centerZ = Number.isFinite(metrics.seatLayout.firstZ)
                ? metrics.seatLayout.firstZ + seatDepth / 2 - metrics.seatLayout.slatW / 2
                : Math.min((metrics.frontZ + metrics.backZ) / 2 + metrics.legWide * 0.35, metrics.frontZ - seatDepth / 2);
            return createSolarMapLocalRectanglePolygon(chair, 0, centerZ, chair.w || 4.6, Math.max(0.8, seatDepth));
        }

        function createSolarMapLocalPolygon(item, points) {
            const cx = item.pos.x * 20;
            const cy = item.pos.z * 20;
            const angle = -(Number(item.rot) || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return points
                .filter(pt => pt && Number.isFinite(pt.x) && Number.isFinite(pt.z))
                .map(pt => {
                    const x = pt.x * 20;
                    const y = pt.z * 20;
                    return {
                        x: cx + x * cos - y * sin,
                        y: cy + x * sin + y * cos
                    };
                });
        }

        function createSolarMapPlacementRectanglePolygon(item, w, d) {
            return createSolarMapLocalRectanglePolygon(item, 0, 0, w, d);
        }

        function createSolarMapLocalRectanglePolygon(item, localCenterX, localCenterZ, w, d) {
            const cx = item.pos.x * 20;
            const cy = item.pos.z * 20;
            const hw = w * 10;
            const hd = d * 10;
            const angle = -(Number(item.rot) || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return [
                { x: localCenterX * 20 - hw, y: localCenterZ * 20 - hd },
                { x: localCenterX * 20 + hw, y: localCenterZ * 20 - hd },
                { x: localCenterX * 20 + hw, y: localCenterZ * 20 + hd },
                { x: localCenterX * 20 - hw, y: localCenterZ * 20 + hd }
            ].map(pt => ({
                x: cx + pt.x * cos - pt.y * sin,
                y: cy + pt.x * sin + pt.y * cos
            }));
        }

        function createSolarMapLocalCirclePolygon(item, radius, steps = 24) {
            const cx = item.pos.x * 20;
            const cy = item.pos.z * 20;
            const angle = -(Number(item.rot) || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const rPx = Math.max(0.3, radius) * 20;
            const pts = [];
            const count = Math.max(12, steps);
            for(let i = 0; i < count; i++) {
                const a = i / count * Math.PI * 2;
                const x = Math.cos(a) * rPx;
                const y = Math.sin(a) * rPx;
                pts.push({
                    x: cx + x * cos - y * sin,
                    y: cy + x * sin + y * cos
                });
            }
            return pts;
        }

        function getSolarMapVerticalSurfacePolygons() {
            return []
                .concat(getSolarMapArchitectureVerticalSurfaces())
                .concat(getSolarMapObjectVerticalSurfaces())
                .concat(getSolarMapTrellisVerticalSurfaces());
        }

        function getSolarMapTrellisVerticalSurfaces() {
            if(!Array.isArray(jardinières)) return [];
            const sources = [];
            jardinières.forEach((j, index) => {
                if(!j || !j.pos || !j.hasTreillis) return;
                const metrics = j.renderMetrics || (typeof computeJardiniereConstructionMetrics === 'function' ? computeJardiniereConstructionMetrics(j) : null);
                const bottomY = metrics && Number.isFinite(metrics.soilY) ? metrics.soilY + 0.08 : Math.max(0.35, Number(j.legH) || 2.5);
                const topY = bottomY + Math.max(1, Number(j.treillisH) || 8);
                const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
                const trellisOptions = { doubleSidedSolar: true };
                if(hasBack) {
                    sources.push(createSolarMapVerticalSourceForLocalSegment(j, 'vertical-jard-' + (j.id || index) + '-back', 'Treillis jardinière arrière', -j.w / 2, -j.d / 2, j.w / 2, -j.d / 2, bottomY, topY, 'back', 'jardiniere', trellisOptions));
                }
                if(j.treillisLeft) {
                    sources.push(createSolarMapVerticalSourceForLocalSegment(j, 'vertical-jard-' + (j.id || index) + '-left', 'Treillis jardinière gauche', -j.w / 2, -j.d / 2, -j.w / 2, j.d / 2, bottomY, topY, 'left', 'jardiniere', trellisOptions));
                }
                if(j.treillisRight) {
                    sources.push(createSolarMapVerticalSourceForLocalSegment(j, 'vertical-jard-' + (j.id || index) + '-right', 'Treillis jardinière droite', j.w / 2, -j.d / 2, j.w / 2, j.d / 2, bottomY, topY, 'right', 'jardiniere', trellisOptions));
                }
            });
            return sources.filter(Boolean);
        }

        function getSolarMapObjectVerticalSurfaces() {
            if(typeof getConstructionItems !== 'function') return [];
            const labels = {
                jardiniere: 'Faces jardinière',
                banc: 'Faces banc',
                pottedTree: 'Faces pot',
                cube: 'Faces méridienne',
                table: 'Faces table',
                chair: 'Faces chaise',
                cornerFill: 'Faces comble-angle'
            };
            const sources = [];
            getConstructionItems().forEach((entry, index) => {
                const item = entry && entry.item;
                if(!item || !item.pos) return;
                const type = entry.type || item.constructionType || 'object';
                const topY = getSolarMapObjectVerticalTopY(item, type);
                if(topY <= 0.25) return;
                const polygon = getSolarMapObjectLocalFootprint(item, type);
                if(!Array.isArray(polygon) || polygon.length < 3) return;
                for(let i = 0; i < polygon.length; i++) {
                    const a = polygon[i];
                    const b = polygon[(i + 1) % polygon.length];
                    sources.push(createSolarMapVerticalSourceForLocalSegment(
                        item,
                        'vertical-object-' + type + '-' + (item.id || index) + '-' + i,
                        labels[type] || 'Face objet',
                        a.x,
                        a.z,
                        b.x,
                        b.z,
                        0.04,
                        topY,
                        'face-' + i,
                        type
                    ));
                }
            });
            return sources.filter(Boolean);
        }

        function getSolarMapObjectVerticalTopY(item, type) {
            if(type === 'jardiniere') {
                const metrics = item.renderMetrics || (typeof computeJardiniereConstructionMetrics === 'function' ? computeJardiniereConstructionMetrics(item) : null);
                return metrics && Number.isFinite(metrics.postHeight) ? metrics.postHeight : Math.max(0.35, Number(item.legH) || 2.5);
            }
            if(type === 'pottedTree') return getSolarMapPottedTreeSoilSurfaceY(item);
            if(type === 'cube') {
                const metrics = typeof computeMeridienneMetrics === 'function' ? computeMeridienneMetrics(item, getDefaultConstructionSettings()) : null;
                return metrics ? metrics.armTopY : Math.max(0.15, Number(item.h) || 0);
            }
            if(type === 'chair') return Math.max(0.15, Number(item.h) || 0);
            return Math.max(0.15, Number(item.h) || 0);
        }

        function getSolarMapObjectLocalFootprint(item, type) {
            if(type === 'cornerFill' && typeof getCornerFillLocalPoints === 'function') {
                const pts = getCornerFillLocalPoints(item);
                if(Array.isArray(pts) && pts.length >= 3) return pts.map(p => ({ x: p.x, z: p.z }));
            }
            const w = Math.max(0, Number(item.w || item.diameter) || 0);
            const d = Math.max(0, Number(item.d || item.diameter) || 0);
            if(w < 0.6 || d < 0.6) return [];
            if(type === 'pottedTree') {
                const radius = Math.max(w, d) / 2;
                const pts = [];
                const steps = 24;
                for(let i = 0; i < steps; i++) {
                    const a = i / steps * Math.PI * 2;
                    pts.push({ x: Math.cos(a) * radius, z: Math.sin(a) * radius });
                }
                return pts;
            }
            const hw = w / 2;
            const hd = d / 2;
            return [
                { x: -hw, z: -hd },
                { x: hw, z: -hd },
                { x: hw, z: hd },
                { x: -hw, z: hd }
            ];
        }

        function getSolarMapArchitectureVerticalSurfaces() {
            const sources = [];
            const wallTypes = new Set(['wall', 'window', 'glass', 'rail', 'door']);
            const addSegment = (segment, index, prefix, centerPoint = null) => {
                if(!segment || !segment.p1 || !segment.p2 || !wallTypes.has(segment.type)) return;
                const bands = getSolarMapArchitectureBandsForSegment(segment);
                bands.forEach((band, bandIndex) => {
                    sources.push(createSolarMapVerticalSourceFromPlanPoints(
                        'vertical-arch-' + prefix + '-' + index + '-' + bandIndex,
                        band.label,
                        segment.p1,
                        segment.p2,
                        band.bottomY,
                        band.topY,
                        centerPoint,
                        segment.type
                    ));
                });
            };
            const primaryCenter = getSolarMapPrimaryPlanCenter();
            getPrimaryContourSegments().forEach((segment, index) => addSegment(segment, index, 'primary', primaryCenter));
            getDetachedSegmentGroups().forEach((segmentGroup, groupIndex) => {
                const center = getSolarMapSegmentGroupCenter(segmentGroup) || primaryCenter;
                segmentGroup.forEach((segment, segmentIndex) => addSegment(segment, groupIndex + '-' + segmentIndex, 'detached', center));
            });
            return sources.filter(Boolean);
        }

        function getSolarMapArchitectureBandsForSegment(segment) {
            const type = segment.type || 'wall';
            const wallH = Math.max(0.2, (Number(archHeights.wall) || 250) / 10);
            const bands = [];
            const addBand = (bottomY, topY, label, options = {}) => {
                if(topY > bottomY + 0.05) bands.push({
                    bottomY,
                    topY,
                    label,
                    isGlass: options.isGlass === true
                });
            };
            if(type === 'window') {
                const bot = Math.max(0, (Number(archHeights.windowBot) || 0) / 10);
                const top = Math.max(bot, (Number(archHeights.windowTop) || 0) / 10);
                addBand(0, bot, 'Mur sous fenêtre');
                addBand(bot, top, 'Fenêtre', { isGlass: true });
                addBand(top, wallH, 'Mur au-dessus fenêtre');
            } else if(type === 'glass') {
                const bot = Math.max(0, (Number(archHeights.glassBot) || 0) / 10);
                const top = Math.max(bot, (Number(archHeights.glassTop) || 0) / 10);
                addBand(0, bot, 'Soubassement vitrage');
                addBand(bot, top, 'Vitrage', { isGlass: true });
                addBand(top, wallH, 'Mur au-dessus vitrage');
            } else if(type === 'rail') {
                addBand(0, Math.max(0.2, (Number(archHeights.rail) || 100) / 10), 'Garde-corps');
            } else if(type === 'door') {
                const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                addBand(0, doorOpenH, 'Porte');
                addBand(doorOpenH, wallH, 'Linteau porte');
            } else {
                addBand(0, wallH, 'Mur');
            }
            return bands;
        }

        function getSolarMapPrimaryPlanCenter() {
            const poly = getPrimaryContourPolygon2D();
            if(!Array.isArray(poly) || !poly.length) return null;
            return poly.reduce((acc, pt) => ({ x: acc.x + pt.x / poly.length, y: acc.y + pt.y / poly.length }), { x: 0, y: 0 });
        }

        function getSolarMapSegmentGroupCenter(segmentGroup) {
            const pts = [];
            (segmentGroup || []).forEach(segment => {
                if(segment && segment.p1) pts.push(segment.p1);
                if(segment && segment.p2) pts.push(segment.p2);
            });
            if(!pts.length) return null;
            return pts.reduce((acc, pt) => ({ x: acc.x + pt.x / pts.length, y: acc.y + pt.y / pts.length }), { x: 0, y: 0 });
        }

        function createSolarMapVerticalSourceForLocalSegment(item, id, label, x1, z1, x2, z2, bottomY, topY, side, objectType = 'jardiniere', options = {}) {
            const p1 = transformSolarMapLocalPointToPlan(item, x1, z1);
            const p2 = transformSolarMapLocalPointToPlan(item, x2, z2);
            const dx = (p2.x - p1.x) / 20;
            const dz = (p2.y - p1.y) / 20;
            const len = Math.hypot(dx, dz);
            if(len < 0.05 || topY <= bottomY) return null;
            let nx = dz / len;
            let nz = -dx / len;
            const center = transformSolarMapLocalPointToPlan(item, 0, 0);
            const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
            const toCenterX = center.x / 20 - mid.x / 20;
            const toCenterZ = center.y / 20 - mid.y / 20;
            if(nx * toCenterX + nz * toCenterZ > 0) {
                nx *= -1;
                nz *= -1;
            }
            return {
                id,
                label,
                kind: 'vertical',
                plane: 'vertical',
                objectType,
                objectId: item.id || null,
                side,
                p1,
                p2,
                bottomY,
                topY,
                normalX: nx,
                normalZ: nz,
                doubleSidedSolar: options.doubleSidedSolar === true
            };
        }

        function createSolarMapVerticalSourceFromPlanPoints(id, label, p1, p2, bottomY, topY, centerPoint = null, objectType = 'architecture') {
            const dx = (p2.x - p1.x) / 20;
            const dz = (p2.y - p1.y) / 20;
            const len = Math.hypot(dx, dz);
            if(len < 0.05 || topY <= bottomY) return null;
            let nx = dz / len;
            let nz = -dx / len;
            if(centerPoint) {
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const toCenterX = centerPoint.x / 20 - mid.x / 20;
                const toCenterZ = centerPoint.y / 20 - mid.y / 20;
                if(nx * toCenterX + nz * toCenterZ < 0) {
                    nx *= -1;
                    nz *= -1;
                }
            }
            return {
                id,
                label,
                kind: 'vertical',
                plane: 'vertical',
                objectType,
                objectId: null,
                side: null,
                p1: { x: p1.x, y: p1.y },
                p2: { x: p2.x, y: p2.y },
                bottomY,
                topY,
                normalX: nx,
                normalZ: nz
            };
        }

        function transformSolarMapLocalPointToPlan(item, localX, localZ) {
            const cx = item.pos.x * 20;
            const cy = item.pos.z * 20;
            const angle = -(Number(item.rot) || 0);
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const x = localX * 20;
            const y = localZ * 20;
            return {
                x: cx + x * cos - y * sin,
                y: cy + x * sin + y * cos
            };
        }

        function createSolarMapCellsForSource(source, cellPx) {
            if(source && source.plane === 'vertical') return createSolarMapCellsForVerticalSource(source, cellPx);
            const bounds = getPolygonBoundingBox(source.polygon);
            const minX = Math.floor(bounds.minX / cellPx) * cellPx;
            const maxX = Math.ceil(bounds.maxX / cellPx) * cellPx;
            const minY = Math.floor(bounds.minY / cellPx) * cellPx;
            const maxY = Math.ceil(bounds.maxY / cellPx) * cellPx;
            const cells = [];

            for(let y = minY; y < maxY; y += cellPx) {
                for(let x = minX; x < maxX; x += cellPx) {
                    const cellPolygon = source.clipCellsToPolygon === true
                        ? clipSolarMapPolygonToRect(source.polygon, x, y, x + cellPx, y + cellPx)
                        : null;
                    if(source.clipCellsToPolygon === true && (!cellPolygon || cellPolygon.length < 3)) continue;
                    const center = source.clipCellsToPolygon === true
                        ? (getSolarMapPolygonCentroid(cellPolygon) || { x: x + cellPx / 2, y: y + cellPx / 2 })
                        : { x: x + cellPx / 2, y: y + cellPx / 2 };
                    if(source.clipCellsToPolygon !== true && !pointInPolygon(center, source.polygon)) continue;
                    const worldX = center.x / 20;
                    const worldZ = center.y / 20;
                    cells.push({
                        x,
                        y,
                        center,
                        worldX,
                        worldZ,
                        sourceId: source.id,
                        sourceLabel: source.label || '',
                        sourceKind: source.kind || 'ground',
                        objectType: source.objectType || null,
                        objectId: source.objectId || null,
                        clippedPolygon: cellPolygon,
                        surfaceY: Number.isFinite(source.surfaceY) ? source.surfaceY : getSurfaceHeightAtPosition(worldX, worldZ),
                        directLightHours: 0,
                        skyVisibility: 0,
                        skyDiffuseHours: 0,
                        reflectedLightHours: 0,
                        globalLightHours: 0,
                        sunHours: 0,
                        morningSunHours: 0,
                        middaySunHours: 0,
                        afternoonSunHours: 0,
                        hotSunHours: 0,
                        samples: 0
                    });
                }
            }

            return cells;
        }

        function createSolarMapCellsForVerticalSource(source, cellPx) {
            const p1 = source.p1;
            const p2 = source.p2;
            if(!p1 || !p2) return [];
            const dxPx = p2.x - p1.x;
            const dyPx = p2.y - p1.y;
            const lengthPx = Math.hypot(dxPx, dyPx);
            const heightPx = Math.max(0, (source.topY - source.bottomY) * 20);
            if(lengthPx < 1 || heightPx < 1) return [];
            const alongCount = Math.max(1, Math.ceil(lengthPx / cellPx));
            const heightCount = Math.max(1, Math.ceil(heightPx / cellPx));
            const cells = [];
            for(let iy = 0; iy < heightCount; iy++) {
                for(let ix = 0; ix < alongCount; ix++) {
                    const t = (ix + 0.5) / alongCount;
                    const planX = p1.x + dxPx * t;
                    const planY = p1.y + dyPx * t;
                    const sampleY = source.bottomY + (iy + 0.5) / heightCount * (source.topY - source.bottomY);
                    cells.push({
                        x: planX - cellPx / 2,
                        y: planY - cellPx / 2,
                        center: { x: planX, y: planY },
                        worldX: planX / 20,
                        worldZ: planY / 20,
                        sampleY,
                        surfaceY: sampleY,
                        sourceId: source.id,
                        sourceLabel: source.label || 'Surface verticale',
                        sourceKind: 'vertical',
                        sourcePlane: 'vertical',
                        objectType: source.objectType || null,
                        objectId: source.objectId || null,
                        side: source.side || null,
                        normalX: source.normalX || 0,
                        normalZ: source.normalZ || 0,
                        doubleSidedSolar: source.doubleSidedSolar === true,
                        verticalT: t,
                        verticalLevel: iy,
                        verticalLevels: heightCount,
                        verticalCellW: lengthPx / alongCount / 20,
                        verticalCellH: (source.topY - source.bottomY) / heightCount,
                        segmentAngle: Math.atan2(dyPx, dxPx),
                        directLightHours: 0,
                        skyVisibility: 0,
                        skyDiffuseHours: 0,
                        reflectedLightHours: 0,
                        globalLightHours: 0,
                        sunHours: 0,
                        morningSunHours: 0,
                        middaySunHours: 0,
                        afternoonSunHours: 0,
                        hotSunHours: 0,
                        samples: 0
                    });
                }
            }
            return cells;
        }

        function markSolarMapDirty() {
            solarMapDirty = true;
            updateSolarMapUI();
        }

        function clearSolarMapMeshes() {
            if(!solarMapGroup) return;
            while(solarMapGroup.children.length) {
                const child = solarMapGroup.children[solarMapGroup.children.length - 1];
                solarMapGroup.remove(child);
                if(child.geometry) child.geometry.dispose();
                if(child.material) {
                    if(Array.isArray(child.material)) child.material.forEach(mat => mat && mat.dispose && mat.dispose());
                    else child.material.dispose();
                }
            }
        }

        function setSolarMapMeshesVisible(visible) {
            if(!solarMapGroup) return;
            solarMapGroup.visible = !!visible;
            solarMapGroup.traverse(child => {
                child.visible = !!visible;
            });
        }

        function clearSolarMap() {
            solarMapEnabled = false;
            solarMapVisible = false;
            solarMapData = null;
            solarMapPath2DCache = null;
            selectedSolarMapCell = null;
            solarMapDirty = true;
            clearSolarMapMeshes();
            updateSolarMapUI();
            updateSolarMapDetailUI(null);
            hideSolarMapTooltip();
            hideSolarMapInfoButton();
            draw2D();
            renderCurrent3DFrame();
        }

        function getSolarSimulationLocation() {
            const neighborhood = horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : null;
            const rawLat = neighborhood && Number.isFinite(Number(neighborhood.lat)) ? Number(neighborhood.lat) : null;
            const rawLon = neighborhood && Number.isFinite(Number(neighborhood.lon)) ? Number(neighborhood.lon) : null;
            const hasCoordinates = rawLat !== null && rawLon !== null;
            const isNullIsland = hasCoordinates && Math.abs(rawLat) < 0.01 && Math.abs(rawLon) < 0.01;
            const hasUsableCoordinates = hasCoordinates && !isNullIsland;
            const lat = hasUsableCoordinates ? rawLat : 48.0247;
            const lon = hasUsableCoordinates ? rawLon : -1.7459;
            return {
                lat: Math.max(-66, Math.min(66, lat)),
                lon: Math.max(-180, Math.min(180, lon)),
                hemisphere: lat < 0 ? 'south' : 'north',
                source: hasUsableCoordinates ? 'address' : (isNullIsland ? 'invalid-address' : 'fallback')
            };
        }

        function getSolarSeasonDate(seasonKey, latDeg = 48.0247) {
            const year = new Date().getFullYear();
            if(seasonKey === 'today') {
                const today = sunDateISO ? new Date(sunDateISO + 'T12:00:00') : new Date();
                return Number.isNaN(today.getTime()) ? new Date(year, 5, 21, 12, 0, 0) : today;
            }
            const s = Number(latDeg) < 0; // hémisphère sud
            if(seasonKey === 'winter')  return new Date(year, s ? 5 : 11, 21, 12, 0, 0);
            if(seasonKey === 'spring')  return new Date(year, s ? 8 : 2,  21, 12, 0, 0);
            if(seasonKey === 'summer')  return new Date(year, s ? 11 : 5, 21, 12, 0, 0);
            if(seasonKey === 'autumn')  return new Date(year, s ? 2 : 8,  21, 12, 0, 0);
            return new Date(year, s ? 11 : 5, 21, 12, 0, 0);
        }

        function getDayOfYear(date) {
            const start = new Date(date.getFullYear(), 0, 0);
            return Math.floor((date - start) / 86400000);
        }

        function getSolarAstronomyForDate(date) {
            const day = getDayOfYear(date);
            const gamma = 2 * Math.PI / 365 * (day - 1);
            const declination = 0.006918
                - 0.399912 * Math.cos(gamma)
                + 0.070257 * Math.sin(gamma)
                - 0.006758 * Math.cos(2 * gamma)
                + 0.000907 * Math.sin(2 * gamma)
                - 0.002697 * Math.cos(3 * gamma)
                + 0.00148 * Math.sin(3 * gamma);
            const equationOfTime = 229.18 * (
                0.000075
                + 0.001868 * Math.cos(gamma)
                - 0.032077 * Math.sin(gamma)
                - 0.014615 * Math.cos(2 * gamma)
                - 0.040849 * Math.sin(2 * gamma)
            );
            return { declination, equationOfTime };
        }

        function getSolarSeasonConfig(seasonKey, latDeg, lonDeg) {
            const date = getSolarSeasonDate(seasonKey, latDeg);
            const { declination, equationOfTime } = getSolarAstronomyForDate(date);
            const timezoneHours = -date.getTimezoneOffset() / 60;
            const lat = latDeg * Math.PI / 180;
            const zenith = 90.833 * Math.PI / 180;
            const cosHourAngle = (Math.cos(zenith) / (Math.cos(lat) * Math.cos(declination))) - Math.tan(lat) * Math.tan(declination);
            const hourAngleDeg = Math.acos(Math.max(-1, Math.min(1, cosHourAngle))) * 180 / Math.PI;
            const solarNoonMin = 720 - 4 * lonDeg - equationOfTime + timezoneHours * 60;
            const sunrise = Math.max(0, Math.min(24, (solarNoonMin - hourAngleDeg * 4) / 60));
            const sunset = Math.max(0, Math.min(24, (solarNoonMin + hourAngleDeg * 4) / 60));
            const solarNoon = Math.max(0, Math.min(24, solarNoonMin / 60));
            return {
                sunrise,
                sunset,
                solarNoon,
                date,
                declination,
                equationOfTime,
                timezoneHours,
                sunIntensity: seasonKey === 'winter' ? 1.28 : (seasonKey === 'spring' || seasonKey === 'autumn') ? 1.14 : 1.08,
                ambientDay: seasonKey === 'winter' ? 0.42 : (seasonKey === 'spring' || seasonKey === 'autumn') ? 0.38 : 0.36,
                ambientNight: 0.08,
                daySky: seasonKey === 'winter' ? 0x1b3558 : 0x102f5b,
                lowSky: seasonKey === 'winter' ? 0x10203a : 0x0c1a32
            };
        }

        function getSunStateForHour(hour, seasonOverride = null, geographicFixed = false) {
            const safeHour = Math.max(0, Math.min(24, Number(hour)));
            const season = seasonOverride || (['today', 'spring', 'summer', 'autumn', 'winter'].includes(sunSeason) ? sunSeason : 'summer');
            const solarLocation = getSolarSimulationLocation();
            const seasonConfig = getSolarSeasonConfig(season, solarLocation.lat, solarLocation.lon);
            const orientationRotation = geographicFixed ? 0 : ((balconyOrientationDeg - 180) % 360) * Math.PI / 180;
            const localTimeMinutes = safeHour * 60;
            const trueSolarMinutes = ((localTimeMinutes + seasonConfig.equationOfTime + 4 * solarLocation.lon - 60 * seasonConfig.timezoneHours) % 1440 + 1440) % 1440;
            const hourAngle = (trueSolarMinutes / 4 - 180) * Math.PI / 180;
            const lat = solarLocation.lat * Math.PI / 180;
            const declination = seasonConfig.declination;
            const sinElevation = Math.sin(lat) * Math.sin(declination) + Math.cos(lat) * Math.cos(declination) * Math.cos(hourAngle);
            const elevation = Math.asin(Math.max(-1, Math.min(1, sinElevation)));
            const east = -Math.cos(declination) * Math.sin(hourAngle);
            const north = Math.cos(lat) * Math.sin(declination) - Math.sin(lat) * Math.cos(declination) * Math.cos(hourAngle);
            const south = -north;
            const azimuthFromSouth = Math.atan2(-east, south);

            if(elevation <= 0) {
                const beforeSunrise = safeHour < seasonConfig.sunrise;
                const baseAzimuth = beforeSunrise ? -Math.PI / 2 : Math.PI / 2;
                const baseX = -Math.sin(baseAzimuth) * SUN_ORBIT_RADIUS;
                const baseZ = Math.cos(baseAzimuth) * SUN_ORBIT_RADIUS;
                const sunX = baseX * Math.cos(orientationRotation) - baseZ * Math.sin(orientationRotation);
                const sunZ = baseX * Math.sin(orientationRotation) + baseZ * Math.cos(orientationRotation);
                return {
                    daylight: false,
                    position: new THREE.Vector3(sunX, -SUN_ORBIT_RADIUS * 0.18, sunZ),
                    daylightStrength: 0,
                    seasonConfig,
                    solarLocation
                };
            }

            const horizontalRadius = Math.cos(elevation) * SUN_ORBIT_RADIUS;
            const baseX = -Math.sin(azimuthFromSouth) * horizontalRadius;
            const baseZ = Math.cos(azimuthFromSouth) * horizontalRadius;
            const sunX = baseX * Math.cos(orientationRotation) - baseZ * Math.sin(orientationRotation);
            const sunZ = baseX * Math.sin(orientationRotation) + baseZ * Math.cos(orientationRotation);
            const daylightStrength = Math.max(0, Math.sin(elevation));
            return {
                daylight: true,
                position: new THREE.Vector3(sunX, Math.sin(elevation) * SUN_ORBIT_RADIUS, sunZ),
                daylightStrength,
                seasonConfig,
                solarLocation,
                azimuthDeg: azimuthFromSouth * 180 / Math.PI,
                elevationDeg: elevation * 180 / Math.PI
            };
        }

        function getSolarMapDirectEnergyFactor(sunState) {
            if(!sunState || !sunState.daylight) return 0;
            const elevationDeg = Math.max(0, Number(sunState.elevationDeg) || 0);
            const sinElevation = Math.max(0, Number(sunState.daylightStrength) || Math.sin(elevationDeg * Math.PI / 180));
            if(sinElevation <= 0.0001) return 0;
            const airMass = 1 / (sinElevation + 0.50572 * Math.pow(elevationDeg + 6.07995, -1.6364));
            const clearSkyTransmission = Math.exp(-0.14 * Math.max(0, airMass - 1));
            return Math.max(0, Math.min(1, clearSkyTransmission));
        }

        function getSolarMapColor(hours) {
            if(hours < 1.5) return 'rgba(39, 99, 186, 0.48)';
            if(hours < 3) return 'rgba(64, 156, 189, 0.46)';
            if(hours < 6) return 'rgba(238, 198, 73, 0.46)';
            return 'rgba(229, 101, 35, 0.48)';
        }

        function clampSolarMap01(value) {
            return Math.max(0, Math.min(1, Number(value) || 0));
        }

        function getSolarMapLightDurationRatio(cell, data = solarMapData) {
            const directLightHours = Math.max(0, Number(cell && cell.directLightHours) || 0);
            const maxLightHours = Number(data && data.maxLightHours);
            const daylightHours = Math.max(0.1, (Number(data && data.daylightSamples) || 0) * (Number(data && data.stepHours) || SOLAR_MAP_STEP_HOURS));
            const reference = Number.isFinite(maxLightHours) && maxLightHours > 0.2 ? maxLightHours : daylightHours;
            return clampSolarMap01(directLightHours / Math.max(0.1, reference));
        }

        function getSolarMapLightIntensityRatio(cell, data = solarMapData) {
            const energyHours = Math.max(0, Number(cell && cell.sunHours) || 0);
            const globalHours = Math.max(0, Number(cell && cell.globalLightHours) || (energyHours + (Number(cell && cell.skyDiffuseHours) || 0) + (Number(cell && cell.reflectedLightHours) || 0)));
            const maxGlobalHours = Number(data && data.maxGlobalHours);
            const maxEnergyHours = Number(data && data.maxHours);
            const reference = Number.isFinite(maxGlobalHours) && maxGlobalHours > 0.1
                ? maxGlobalHours
                : (Number.isFinite(maxEnergyHours) && maxEnergyHours > 0.1 ? maxEnergyHours : 1);
            return clampSolarMap01(globalHours / Math.max(0.1, reference));
        }

        function getSolarMapOpacityForCell(cell, data = solarMapData) {
            const durationRatio = getSolarMapLightDurationRatio(cell, data);
            const intensityRatio = getSolarMapLightIntensityRatio(cell, data);
            if(solarMapDisplayMode === 'usage') {
                return 0.68 + 0.16 * Math.max(durationRatio, intensityRatio * 0.75);
            }
            if(solarMapDisplayMode === 'hours') {
                if(durationRatio <= 0.001) return 0.44;
                return 0.68 + 0.14 * Math.pow(durationRatio, 0.7);
            }
            if(durationRatio <= 0.001) return 0.62 - 0.22 * intensityRatio;
            return 0.28 + 0.58 * Math.pow(intensityRatio, 0.72);
        }

        function getSolarMapUsageRatio(cell, data = solarMapData) {
            const durationRatio = getSolarMapLightDurationRatio(cell, data);
            const intensityRatio = getSolarMapLightIntensityRatio(cell, data);
            const directHours = Math.max(0, Number(cell && cell.directLightHours) || 0);
            const directEnergy = Math.max(0, Number(cell && cell.sunHours) || 0);
            const indirectHours = Math.max(0, (Number(cell && cell.skyDiffuseHours) || 0) + (Number(cell && cell.reflectedLightHours) || 0));
            const hotHours = Math.max(0, Number(cell && cell.hotSunHours) || 0);
            let ratio = Math.max(durationRatio * 0.62 + intensityRatio * 0.38, intensityRatio * 0.72);
            if(directHours < 0.35 && intensityRatio > 0.08) ratio = Math.max(ratio, 0.18);
            if(indirectHours > 0.35 && directHours < 1.2) ratio = Math.max(ratio, Math.min(0.42, 0.18 + indirectHours * 0.12));
            if((hotHours >= 2.5 || directEnergy >= 6.5) && directHours >= 2.5) ratio = Math.max(ratio, 0.9);
            return clampSolarMap01(ratio);
        }

        function getSolarMapColorForCell(cell, data = solarMapData) {
            const t = getSolarMapLightDurationRatio(cell, data);
            const intensity = getSolarMapLightIntensityRatio(cell, data);
            const usageRatio = getSolarMapUsageRatio(cell, data);
            const stops = solarMapDisplayMode === 'usage'
                ? [
                    { t: 0.00, rgb: [39, 99, 186] },
                    { t: 0.32, rgb: [64, 156, 189] },
                    { t: 0.58, rgb: [238, 198, 73] },
                    { t: 0.82, rgb: [229, 126, 35] },
                    { t: 1.00, rgb: [198, 54, 37] }
                ]
                : solarMapDisplayMode === 'intensity'
                ? [
                    { t: 0.00, rgb: [52, 32, 78] },
                    { t: 0.36, rgb: [97, 54, 151] },
                    { t: 0.72, rgb: [166, 103, 224] },
                    { t: 1.00, rgb: [238, 220, 255] }
                ]
                : [
                    { t: 0.00, rgb: [39, 99, 186] },
                    { t: 0.45, rgb: [64, 156, 189] },
                    { t: 0.76, rgb: [238, 198, 73] },
                    { t: 1.00, rgb: [229, 101, 35] }
                ];
            const colorRatio = solarMapDisplayMode === 'usage'
                ? usageRatio
                : (solarMapDisplayMode === 'intensity' ? intensity : t);
            let low = stops[0];
            let high = stops[stops.length - 1];
            for(let i = 1; i < stops.length; i++) {
                if(colorRatio <= stops[i].t) {
                    low = stops[i - 1];
                    high = stops[i];
                    break;
                }
            }
            const span = Math.max(0.0001, high.t - low.t);
            const k = Math.max(0, Math.min(1, (colorRatio - low.t) / span));
            const neutral = solarMapDisplayMode === 'intensity' ? [170, 150, 196] : [164, 183, 194];
            const saturation = solarMapDisplayMode === 'intensity'
                ? 0.48 + 0.52 * Math.pow(intensity, 0.65)
                : 1;
            const rgb = low.rgb.map((value, index) => {
                const base = value + (high.rgb[index] - value) * k;
                return Math.round(neutral[index] + (base - neutral[index]) * saturation);
            });
            const alpha = getSolarMapOpacityForCell(cell, data);
            return 'rgba(' + rgb[0] + ', ' + rgb[1] + ', ' + rgb[2] + ', ' + alpha.toFixed(2) + ')';
        }

        function getSolarMapHexColor(hours) {
            if(hours < 1.5) return 0x2763ba;
            if(hours < 3) return 0x409cbd;
            if(hours < 6) return 0xeec649;
            return 0xe56523;
        }

        function getSolarMapHexColorForCell(cell, data = solarMapData) {
            const color = getSolarMapColorForCell(cell, data);
            const match = color.match(/rgba\((\d+),\s*(\d+),\s*(\d+)/);
            if(!match) return getSolarMapHexColor(Number(cell && (cell.globalLightHours || cell.sunHours)) || 0);
            return (parseInt(match[1], 10) << 16) | (parseInt(match[2], 10) << 8) | parseInt(match[3], 10);
        }

        function getSolarMapLabel(hours) {
            if(hours < 3) return 'Ombre';
            if(hours < 6) return 'Mi-ombre';
            return 'Plein soleil';
        }

        function classifySolarMapPlantExposure(cell) {
            const directEnergyHours = Math.max(0, Number(cell && cell.sunHours) || 0);
            const globalHours = Math.max(0, Number(cell && cell.globalLightHours) || directEnergyHours);
            const sunHours = Math.max(directEnergyHours, globalHours);
            const morningHours = Math.max(0, Number(cell && cell.morningSunHours) || 0);
            const middayHours = Math.max(0, Number(cell && cell.middaySunHours) || 0);
            const afternoonHours = Math.max(0, Number(cell && cell.afternoonSunHours) || 0);
            const hotHours = Math.max(0, Number(cell && cell.hotSunHours) || 0);
            const hasHardAfternoon = hotHours >= 2.5 || afternoonHours >= 3.2;
            let plantDbSunlight = 'part_shade';
            let plantLabel = 'mi-ombre';
            let comfortLabel = 'soleil doux';
            let restScore = 0.8;

            if(sunHours < 2) {
                plantDbSunlight = 'full_shade';
                plantLabel = globalHours >= 1 ? 'ombre lumineuse' : 'ombre';
                comfortLabel = globalHours >= 1 ? 'ombre claire' : 'ombre fraîche';
                restScore = 0.68;
            } else if(sunHours < 4) {
                plantDbSunlight = 'part_shade';
                plantLabel = morningHours >= afternoonHours ? 'mi-ombre claire' : 'mi-ombre chaude';
                comfortLabel = hasHardAfternoon ? 'mi-ombre chaude' : 'soleil doux';
                restScore = hasHardAfternoon ? 0.72 : 0.92;
            } else if(sunHours < 6.5) {
                plantDbSunlight = hasHardAfternoon ? 'sun-part_shade' : 'part_shade';
                plantLabel = hasHardAfternoon ? 'soleil / mi-ombre' : 'mi-ombre lumineuse';
                comfortLabel = hasHardAfternoon ? 'soleil à filtrer' : 'zone repas/repos idéale';
                restScore = hasHardAfternoon ? 0.62 : 1;
            } else {
                plantDbSunlight = 'full_sun';
                plantLabel = 'plein soleil';
                comfortLabel = hasHardAfternoon ? 'zone brûlante longue durée' : 'plein soleil doux';
                restScore = hasHardAfternoon ? 0.22 : 0.5;
            }

            return {
                plantDbSunlight,
                plantLabel,
                comfortLabel,
                restScore,
                hasHardAfternoon,
                sunHours,
                morningHours,
                middayHours,
                afternoonHours,
                hotHours
            };
        }

        function formatSolarMapHours(value) {
            const n = Math.max(0, Number(value) || 0);
            return (Math.round(n * 10) / 10).toLocaleString('fr-FR', { maximumFractionDigits: 1 });
        }

        function getSolarMapPlantDbLabel(key) {
            if(key === 'full_sun') return 'plein soleil';
            if(key === 'sun-part_shade') return 'soleil / mi-ombre';
            if(key === 'part_shade') return 'mi-ombre';
            if(key === 'full_shade') return 'ombre';
            return 'mi-ombre';
        }

        function getSolarMapCellDetailHtml(cell) {
            if(!cell) return "Clique une case de la carte d'usage pour lire son conseil.";
            const exposure = cell.exposure || classifySolarMapPlantExposure(cell);
            const dbLabel = getSolarMapPlantDbLabel(exposure.plantDbSunlight);
            const hotText = exposure.hasHardAfternoon
                ? "Attention: soleil chaud long, à éviter pour une assise prolongée."
                : "Confort: pas une zone brûlante longue durée.";
            const plantText = exposure.plantDbSunlight === 'full_sun'
                ? "Plantes sobres et exigeantes en lumière."
                : exposure.plantDbSunlight === 'full_shade'
                    ? "Plantes d'ombre, pas de potager productif."
                    : "Plantes de mi-ombre ou soleil doux.";
            const sourceLabel = cell.sourceLabel || (cell.sourceKind === 'object' ? 'Objet' : 'Sol');
            const sourceText = cell.sourceKind === 'vertical'
                ? sourceLabel + ' · surface verticale'
                : cell.sourceKind === 'object'
                ? sourceLabel + ' · surface utile'
                : sourceLabel;
            return '<strong>' + sourceText + ' · ' + exposure.comfortLabel + ' · ' + formatSolarMapHours(cell.globalLightHours || cell.sunHours) + ' h globale/j</strong>'
                + 'Couleur: ' + exposure.plantLabel + '. Base plantes: ' + exposure.plantDbSunlight + ' (' + dbLabel + ').<br>'
                + 'Direct ' + formatSolarMapHours(cell.directLightHours) + ' h/j · énergie directe ' + formatSolarMapHours(cell.sunHours) + ' h équiv./j · ciel diffus ' + formatSolarMapHours(cell.skyDiffuseHours) + ' h · reflets ' + formatSolarMapHours(cell.reflectedLightHours) + ' h.<br>'
                + 'Matin ' + formatSolarMapHours(cell.morningSunHours) + ' h équiv. · midi ' + formatSolarMapHours(cell.middaySunHours) + ' h équiv. · après-midi ' + formatSolarMapHours(cell.afternoonSunHours) + ' h équiv. · heures chaudes ' + formatSolarMapHours(cell.hotSunHours) + ' h équiv.<br>'
                + plantText + ' ' + hotText;
        }

        function updateSolarMapDetailUI(cell = selectedSolarMapCell) {
            const detail = document.getElementById('solar-map-detail');
            if(!detail) return;
            detail.innerHTML = getSolarMapCellDetailHtml(cell);
        }

        function getSolarMapTooltipEl() {
            let el = document.getElementById('solar-map-tooltip');
            if(el) return el;
            el = document.createElement('div');
            el.id = 'solar-map-tooltip';
            el.className = 'solar-map-tooltip';
            document.body.appendChild(el);
            return el;
        }

        function hideSolarMapTooltip() {
            const el = document.getElementById('solar-map-tooltip');
            if(el) el.classList.remove('visible');
        }

        function getSolarMapInfoButtonEl() {
            let el = document.getElementById('solar-map-info-button');
            if(el) return el;
            el = document.createElement('button');
            el.id = 'solar-map-info-button';
            el.className = 'solar-map-info-button';
            el.type = 'button';
            el.title = 'Infos sur cette zone';
            el.textContent = 'i';
            el.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                const cell = el._solarMapCell || selectedSolarMapCell;
                if(!cell) return;
                selectedSolarMapCell = cell;
                updateSolarMapDetailUI(cell);
                showSolarMapTooltip(cell, event.clientX, event.clientY);
            });
            document.body.appendChild(el);
            return el;
        }

        function hideSolarMapInfoButton() {
            const el = document.getElementById('solar-map-info-button');
            if(el) el.classList.remove('visible');
        }

        function showSolarMapInfoButton(cell, clientX, clientY) {
            if(!cell || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
            const el = getSolarMapInfoButtonEl();
            el._solarMapCell = cell;
            el.classList.add('visible');
            const margin = 10;
            const gap = 10;
            const rect = el.getBoundingClientRect();
            let left = clientX + gap;
            let top = clientY + gap;
            if(left + rect.width + margin > window.innerWidth) left = clientX - rect.width - gap;
            if(top + rect.height + margin > window.innerHeight) top = clientY - rect.height - gap;
            left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
            top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
            el.style.left = left + 'px';
            el.style.top = top + 'px';
        }

        function showSolarMapTooltip(cell, clientX, clientY) {
            if(!cell || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return;
            const el = getSolarMapTooltipEl();
            el.innerHTML = getSolarMapCellDetailHtml(cell);
            el.classList.add('visible');
            const margin = 14;
            const gap = 14;
            const rect = el.getBoundingClientRect();
            let left = clientX + gap;
            let top = clientY + gap;
            if(left + rect.width + margin > window.innerWidth) left = clientX - rect.width - gap;
            if(top + rect.height + margin > window.innerHeight) top = clientY - rect.height - gap;
            left = Math.max(margin, Math.min(window.innerWidth - rect.width - margin, left));
            top = Math.max(margin, Math.min(window.innerHeight - rect.height - margin, top));
            el.style.left = left + 'px';
            el.style.top = top + 'px';
            clearTimeout(solarMapTooltipHideTimer);
            solarMapTooltipHideTimer = setTimeout(hideSolarMapTooltip, 6500);
        }

        function findSolarMapCellAt2D(x, y) {
            if(!solarMapVisible || !solarMapData || !Array.isArray(solarMapData.cells)) return null;
            const cellPx = solarMapData.cellPx || 20;
            const hits = solarMapData.cells.filter(cell => {
                if(Array.isArray(cell.clippedPolygon) && cell.clippedPolygon.length >= 3) {
                    return pointInPolygon({ x, y }, cell.clippedPolygon);
                }
                return x >= cell.x && x <= cell.x + cellPx &&
                    y >= cell.y && y <= cell.y + cellPx;
            });
            return hits.find(cell => cell.sourceKind === 'vertical')
                || hits.find(cell => cell.sourceKind === 'object')
                || hits[0]
                || null;
        }

        function handleSolarMapCellClick2D(x, y, event = null) {
            const cell = findSolarMapCellAt2D(x, y);
            if(!cell) {
                hideSolarMapInfoButton();
                hideSolarMapTooltip();
                return false;
            }
            selectedSolarMapCell = cell;
            updateSolarMapDetailUI(cell);
            hideSolarMapTooltip();
            if(event) showSolarMapInfoButton(cell, event.clientX, event.clientY);
            draw2D();
            return true;
        }

        function getSolarMapOccluders() {
            const objects = [];
            const constructionGroups = getConstructionItems()
                .map(entry => entry.item && entry.item.group)
                .filter(Boolean);
            [horizonGroup, ...constructionGroups].forEach(group => {
                if(!group) return;
                if(typeof group.updateWorldMatrix === 'function') group.updateWorldMatrix(true, true);
                group.traverse(child => {
                    if(child.isMesh && child.visible && !shouldIgnoreSolarOccluder(child)) objects.push(child);
                });
            });
            objects.push(...getSolarMapArchitectureOccludersWorld());
            objects.push(...getSolarMapObjectOccludersWorld());
            return objects;
        }

        function shouldIgnoreSolarOccluder(obj) {
            let cur = obj;
            while(cur) {
                const data = cur.userData || {};
                if(data.selectionHelper || data.isPlantBush || data.staticPlantPart) return true;
                cur = cur.parent;
            }
            return false;
        }

        function getBalconyInternalCutoutFixed2D() {
            if(typeof getPrimaryContourPolygon2D !== 'function' || typeof transformBalconyScenePoint2D !== 'function') return [];
            const polygon = getBalconyCutoutSourcePolygon2D();
            if(!polygon || polygon.length < 3) return [];
            const polygons = [];
            const wallThicknessFixed = 8;
            if(typeof computeOffsetContour2D === 'function') {
                const outer = computeOffsetContour2D(polygon, wallThicknessFixed);
                if(outer && outer.length >= 3) polygons.push(outer.map(point => transformBalconyScenePoint2D(point)));
            }
            getBalconyEnvelopeSegmentPolygonsFixed2D(polygon, wallThicknessFixed).forEach(segmentPolygon => {
                polygons.push(segmentPolygon.map(point => transformBalconyScenePoint2D(point)));
            });
            polygons.push(polygon.map(point => transformBalconyScenePoint2D(point)));
            if(archOptions && archOptions.ceiling && Array.isArray(ceilingShapePoints) && ceilingShapePoints.length >= 3) {
                polygons.push(ceilingShapePoints.map(point => transformBalconyScenePoint2D(point)));
            }
            const slabThickness = 1.5;
            const wallTop = Math.max(2, ((archHeights && archHeights.wall) || 250) / 10);
            return {
                polygons,
                minY: -slabThickness,
                maxY: wallTop + ((archOptions && archOptions.ceiling) ? slabThickness : 0)
            };
        }

        function getBalconyCutoutSourcePolygon2D() {
            if(typeof getPrimaryContourPolygon2D === 'function') {
                const strictPolygon = getPrimaryContourPolygon2D();
                if(strictPolygon && strictPolygon.length >= 3) return strictPolygon;
            }
            if(typeof getPrimaryContourSegments !== 'function') return [];
            const contourSegments = getPrimaryContourSegments();
            if(!contourSegments || contourSegments.length < 3) return [];
            const firstPoint = contourSegments[0].p1;
            const lastPoint = contourSegments[contourSegments.length - 1].p2;
            if(!firstPoint || !lastPoint) return [];
            const closesFor3D = isContourClosed
                || Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) < 40;
            if(!closesFor3D) return [];
            const points = [{ x: firstPoint.x, y: firstPoint.y }];
            contourSegments.forEach(segment => {
                if(segment && segment.p2) points.push({ x: segment.p2.x, y: segment.p2.y });
            });
            const first = points[0];
            const last = points[points.length - 1];
            if(first && last && Math.hypot(first.x - last.x, first.y - last.y) < 40) points.pop();
            return points.length >= 3 ? points : [];
        }

        function getBalconyEnvelopeSegmentPolygonsFixed2D(polygon, thicknessPx) {
            if(!polygon || polygon.length < 3 || typeof getPrimaryContourSegments !== 'function') return [];
            const segments = getPrimaryContourSegments();
            if(!segments || !segments.length) return [];
            const wallLikeTypes = new Set(['wall', 'rail', 'bare-edge', 'window', 'glass', 'door']);
            const orientationSign = typeof getPolygonSignedArea2D === 'function'
                ? (Math.sign(getPolygonSignedArea2D(polygon)) || 1)
                : 1;
            const polygons = [];
            const max = Math.min(segments.length, polygon.length);
            for(let i = 0; i < max; i++) {
                const segment = segments[i];
                const type = segment && segment.type ? segment.type : 'wall';
                if(!wallLikeTypes.has(type)) continue;
                const a = polygon[i];
                const b = polygon[(i + 1) % polygon.length];
                if(!a || !b) continue;
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy);
                if(len < 0.001) continue;
                const outward = orientationSign >= 0
                    ? { x: dy / len, y: -dx / len }
                    : { x: -dy / len, y: dx / len };
                const depth = Math.max(8, Number(thicknessPx) || 8);
                polygons.push([
                    { x: a.x, y: a.y },
                    { x: b.x, y: b.y },
                    { x: b.x + outward.x * depth, y: b.y + outward.y * depth },
                    { x: a.x + outward.x * depth, y: a.y + outward.y * depth }
                ]);
            }
            return polygons;
        }

        function isPointInsideBalconyInternalCutout3D(point, cutoutInput = null) {
            if(!point) return false;
            const cutout = cutoutInput || getBalconyInternalCutoutFixed2D();
            const polygons = Array.isArray(cutout)
                ? [cutout]
                : (Array.isArray(cutout.polygons) ? cutout.polygons : []);
            if(!polygons.length) return false;
            const minY = cutout && Number.isFinite(cutout.minY) ? cutout.minY : -1.5;
            const maxY = cutout && Number.isFinite(cutout.maxY)
                ? cutout.maxY
                : Math.max(2, ((archHeights && archHeights.wall) || 250) / 10 + 1.5);
            if(point.y < minY || point.y > maxY) return false;
            const fixedPoint = { x: point.x * 20, y: point.z * 20 };
            if(polygons.some(polygon => polygon && polygon.length >= 3 && pointInPolygon(fixedPoint, polygon))) return true;
            const touchMarginScene = 1.8;
            let minDist = Infinity;
            polygons.forEach(polygon => {
                if(!polygon || polygon.length < 3) return;
                for(let i = 0; i < polygon.length; i++) {
                    const a = polygon[i];
                    const b = polygon[(i + 1) % polygon.length];
                    if(!a || !b) continue;
                    const dx = b.x - a.x;
                    const dy = b.y - a.y;
                    const lenSq = dx * dx + dy * dy;
                    let dist;
                    if(lenSq <= 0.000001) {
                        dist = Math.hypot(fixedPoint.x - a.x, fixedPoint.y - a.y);
                    } else {
                        const t = Math.max(0, Math.min(1, ((fixedPoint.x - a.x) * dx + (fixedPoint.y - a.y) * dy) / lenSq));
                        const px = a.x + dx * t;
                        const py = a.y + dy * t;
                        dist = Math.hypot(fixedPoint.x - px, fixedPoint.y - py);
                    }
                    if(dist < minDist) minDist = dist;
                }
            });
            return minDist / 20 <= touchMarginScene;
        }

        function isSupportBuildingInternalHit(hit, cutout = null) {
            if(!hit || !hit.object) return false;
            const hitBuildingId = hit.object.userData && hit.object.userData.neighborhoodBuildingId
                ? String(hit.object.userData.neighborhoodBuildingId)
                : null;
            if(!hitBuildingId) return false;
            return isPointInsideBalconyInternalCutout3D(hit.point, cutout);
        }

        function getSolarMapLocalPointWorld3D(x, y, z) {
            const point = new THREE.Vector3(x, y, z);
            if(balconySceneGroup && typeof balconySceneGroup.localToWorld === 'function') {
                if(typeof balconySceneGroup.updateWorldMatrix === 'function') balconySceneGroup.updateWorldMatrix(true, false);
                return balconySceneGroup.localToWorld(point);
            }
            return point;
        }

        function getSolarMapLocalDirectionWorldXZ(x, z) {
            const dir = new THREE.Vector3(Number(x) || 0, 0, Number(z) || 0);
            if(dir.lengthSq() <= 0.000001) return dir;
            if(balconySceneGroup && typeof balconySceneGroup.localToWorld === 'function') {
                if(typeof balconySceneGroup.updateWorldMatrix === 'function') balconySceneGroup.updateWorldMatrix(true, false);
                const origin = balconySceneGroup.localToWorld(new THREE.Vector3(0, 0, 0));
                const target = balconySceneGroup.localToWorld(dir.clone());
                return target.sub(origin);
            }
            return dir;
        }

        function getSolarMapArchitectureOccludersWorld() {
            const occluders = createSolarMapArchitectureOccluders();
            if(!balconySceneGroup || typeof balconySceneGroup.updateWorldMatrix !== 'function') {
                occluders.forEach(mesh => mesh.updateMatrixWorld(true));
                return occluders;
            }
            balconySceneGroup.updateWorldMatrix(true, false);
            occluders.forEach(mesh => {
                if(typeof mesh.updateMatrix === 'function') mesh.updateMatrix();
                mesh.applyMatrix4(balconySceneGroup.matrixWorld);
                mesh.updateMatrixWorld(true);
            });
            return occluders;
        }

        function getSolarMapObjectOccludersWorld() {
            const occluders = createSolarMapObjectOccluders();
            if(!balconySceneGroup || typeof balconySceneGroup.updateWorldMatrix !== 'function') {
                occluders.forEach(mesh => mesh.updateMatrixWorld(true));
                return occluders;
            }
            balconySceneGroup.updateWorldMatrix(true, false);
            occluders.forEach(mesh => {
                if(typeof mesh.updateMatrix === 'function') mesh.updateMatrix();
                mesh.applyMatrix4(balconySceneGroup.matrixWorld);
                mesh.updateMatrixWorld(true);
            });
            return occluders;
        }

        function createSolarMapObjectOccluders() {
            if(typeof getConstructionItems !== 'function') return [];
            const occluders = [];
            const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.DoubleSide });
            getConstructionItems().forEach((entry, index) => {
                const item = entry && entry.item;
                if(!item || !item.pos) return;
                const type = entry.type || item.constructionType || 'object';
                const topY = getSolarMapObjectVerticalTopY(item, type);
                if(topY <= 0.25) return;
                const polygon = getSolarMapObjectLocalFootprint(item, type);
                if(!Array.isArray(polygon) || polygon.length < 3) return;
                const planPolygon = createSolarMapLocalPolygon(item, polygon);
                if(!Array.isArray(planPolygon) || planPolygon.length < 3) return;
                const shape = new THREE.Shape();
                planPolygon.forEach((pt, pointIndex) => {
                    const x = pt.x / 20;
                    const z = pt.y / 20;
                    if(pointIndex === 0) shape.moveTo(x, z);
                    else shape.lineTo(x, z);
                });
                shape.closePath();
                const geo = new THREE.ExtrudeGeometry(shape, { depth: topY, bevelEnabled: false, steps: 1 });
                geo.rotateX(Math.PI / 2);
                const mesh = new THREE.Mesh(geo, mat);
                mesh.position.y = topY;
                mesh.updateMatrixWorld(true);
                mesh.userData.solarMapSourceId = 'object-' + type + '-' + (item.id || index);
                occluders.push(mesh);
            });
            return occluders;
        }

        function createSolarMapArchitectureOccluders() {
            const occluders = [];
            const wallTypes = new Set(['wall', 'window', 'glass', 'rail', 'door']);
            const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, side: THREE.DoubleSide });
            const thickness = 0.42;
            const addSegmentOccluders = (segment, index, prefix) => {
                if(!wallTypes.has(segment.type)) return;
                const x1 = segment.p1.x / 20, z1 = segment.p1.y / 20;
                const x2 = segment.p2.x / 20, z2 = segment.p2.y / 20;
                const len = Math.hypot(x2 - x1, z2 - z1);
                if(len < 0.05) return;
                const angle = -Math.atan2(z2 - z1, x2 - x1);
                const cx = (x1 + x2) / 2, cz = (z1 + z2) / 2;
                const addCornerCap = (x, z, yBase, h, sourceId, suffix) => {
                    const cap = new THREE.Mesh(new THREE.BoxGeometry(thickness * 1.25, h, thickness * 1.25), mat);
                    cap.position.set(x, yBase + h / 2, z);
                    cap.updateMatrixWorld(true);
                    cap.userData.solarMapSourceId = sourceId + '-corner-' + suffix;
                    cap.userData.solarMapParentSourceId = sourceId;
                    occluders.push(cap);
                };
                const addBand = (band, bandIndex) => {
                    const yBase = Number(band && band.bottomY) || 0;
                    const h = Math.max(0, (Number(band && band.topY) || 0) - yBase);
                    if(h <= 0) return;
                    const mesh = new THREE.Mesh(new THREE.BoxGeometry(len, h, thickness), mat);
                    mesh.position.set(cx, yBase + h / 2, cz);
                    mesh.rotation.y = angle;
                    mesh.updateMatrixWorld(true);
                    const sourceId = 'vertical-arch-' + prefix + '-' + index + '-' + bandIndex;
                    mesh.userData.solarMapSourceId = sourceId;
                    const railType = archOptions && archOptions.railType ? archOptions.railType : 'low-wall';
                    const isGlass = band && band.isGlass === true;
                    const isRailGlass = segment.type === 'rail' && railType === 'glass';
                    const isTrellis = segment.type === 'rail' && (railType === 'bars' || railType === 'horizontal-rails');
                    if(isGlass || isRailGlass) mesh.userData.isGlass = true;
                    if(isTrellis) mesh.userData.isTrellis = true;
                    occluders.push(mesh);
                    if(!isGlass && !isRailGlass && !isTrellis) {
                        addCornerCap(x1, z1, yBase, h, sourceId, 'start');
                        addCornerCap(x2, z2, yBase, h, sourceId, 'end');
                    }
                };
                getSolarMapArchitectureBandsForSegment(segment).forEach(addBand);
            };
            getPrimaryContourSegments().forEach((segment, index) => addSegmentOccluders(segment, index, 'primary'));
            getDetachedSegmentGroups().forEach((segmentGroup, groupIndex) => {
                if(isPostSegmentGroup(segmentGroup) && isSegmentGroupClosed(segmentGroup)) {
                    const polygon = getSegmentGroupPolygonXZ(segmentGroup);
                    if(polygon.length < 3) return;
                    const shape = new THREE.Shape();
                    polygon.forEach((pt, index) => {
                        if(index === 0) shape.moveTo(pt.x, pt.z);
                        else shape.lineTo(pt.x, pt.z);
                    });
                    shape.closePath();
                    const height = Math.max(0.2, archHeights.wall / 10);
                    const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 });
                    geo.rotateX(Math.PI / 2);
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.position.y = height;
                    mesh.updateMatrixWorld(true);
                    occluders.push(mesh);
                } else {
                    segmentGroup.forEach((segment, segmentIndex) => addSegmentOccluders(segment, groupIndex + '-' + segmentIndex, 'detached'));
                }
            });
            if(archOptions.ceiling) {
                const source = ceilingShapePoints.length >= 3 ? ceilingShapePoints : getPrimaryContourPolygon2D();
                if(source.length >= 3) {
                    const shape = new THREE.Shape(source.map(pt => new THREE.Vector2(pt.x / 20, pt.y / 20)));
                    const geo = new THREE.ShapeGeometry(shape);
                    geo.rotateX(Math.PI / 2);
                    geo.translate(0, Math.max(10, (archHeights.wall || 250) / 10), 0);
                    const mesh = new THREE.Mesh(geo, mat);
                    mesh.updateMatrixWorld(true);
                    occluders.push(mesh);
                }
            }
            return occluders;
        }

        function isBlockedByCeilingForSolarMap(origin, sunPosition) {
            if(!archOptions.ceiling || !origin || !sunPosition) return false;
            const source = ceilingShapePoints.length >= 3 ? ceilingShapePoints : getPrimaryContourPolygon2D();
            if(source.length < 3) return false;
            const ceilingY = Math.max(10, (archHeights.wall || 250) / 10);
            const dy = sunPosition.y - origin.y;
            if(dy <= 0.0001 || origin.y >= ceilingY) return false;
            const t = (ceilingY - origin.y) / dy;
            if(t <= 0 || t >= 1) return false;
            const hitX = origin.x + (sunPosition.x - origin.x) * t;
            const hitZ = origin.z + (sunPosition.z - origin.z) * t;
            return pointInPolygon({ x: hitX * 20, y: hitZ * 20 }, source);
        }

        function isSolarSampleSunlit(point, sunPosition, occluders, ignoreNearDistance = 0, options = {}) {
            if(!sunPosition) return 1;
            const origin = point.clone();
            if(!(options && options.skipLocalCeilingCheck) && isBlockedByCeilingForSolarMap(origin, sunPosition)) return 0;
            if(!occluders.length) return 1;
            const direction = sunPosition.clone().sub(origin);
            const distance = direction.length();
            if(distance <= 0.0001) return 0;
            direction.normalize();
            solarMapRaycaster.set(origin, direction);
            solarMapRaycaster.near = 0.05;
            solarMapRaycaster.far = distance - 0.2;
            const hits = solarMapRaycaster.intersectObjects(occluders, false);
            if(hits.length === 0) return 1;
            let factor = 1;
            const internalCutout = getBalconyInternalCutoutFixed2D();
            const ignoreSourceId = options && options.ignoreSourceId ? String(options.ignoreSourceId) : null;
            for(const hit of hits) {
                if(ignoreNearDistance > 0 && hit.distance <= ignoreNearDistance) continue;
                const hitSourceId = hit.object && hit.object.userData && hit.object.userData.solarMapSourceId
                    ? String(hit.object.userData.solarMapSourceId)
                    : null;
                const hitParentSourceId = hit.object && hit.object.userData && hit.object.userData.solarMapParentSourceId
                    ? String(hit.object.userData.solarMapParentSourceId)
                    : null;
                if(ignoreSourceId && (hitSourceId === ignoreSourceId || hitParentSourceId === ignoreSourceId)) continue;
                if(isSupportBuildingInternalHit(hit, internalCutout)) continue;
                if(hit.object.userData.isGlass) factor *= 0.75;
                else if(hit.object.userData.isTrellis) factor *= 0.5;
                else return 0;
            }
            return factor;
        }

        function getSolarMapCellWorldNormal(cell) {
            if(cell && cell.sourcePlane === 'vertical') {
                const worldNormal = getSolarMapLocalDirectionWorldXZ(cell.normalX, cell.normalZ);
                const normal = new THREE.Vector3(worldNormal.x, 0, worldNormal.z);
                if(normal.lengthSq() > 0.000001) return normal.normalize();
            }
            return new THREE.Vector3(0, 1, 0);
        }

        function getSolarMapSkySampleDirections(cell) {
            const up = new THREE.Vector3(0, 1, 0);
            if(cell && cell.sourcePlane === 'vertical') {
                const normal = getSolarMapCellWorldNormal(cell);
                const tangent = new THREE.Vector3(-normal.z, 0, normal.x);
                return [
                    up.clone(),
                    normal.clone().multiplyScalar(0.45).add(up.clone().multiplyScalar(0.89)).normalize(),
                    normal.clone().multiplyScalar(0.75).add(up.clone().multiplyScalar(0.66)).normalize(),
                    normal.clone().multiplyScalar(0.38).add(tangent.clone().multiplyScalar(0.28)).add(up.clone().multiplyScalar(0.88)).normalize(),
                    normal.clone().multiplyScalar(0.38).add(tangent.clone().multiplyScalar(-0.28)).add(up.clone().multiplyScalar(0.88)).normalize()
                ];
            }
            return [
                up.clone(),
                new THREE.Vector3(0.35, 0.86, 0).normalize(),
                new THREE.Vector3(-0.35, 0.86, 0).normalize(),
                new THREE.Vector3(0, 0.86, 0.35).normalize(),
                new THREE.Vector3(0, 0.86, -0.35).normalize()
            ];
        }

        function getSolarMapSkyRayTransmission(origin, direction, occluders, ignoreSourceId = null) {
            if(!occluders.length) return 1;
            solarMapRaycaster.set(origin, direction);
            solarMapRaycaster.near = 0.06;
            solarMapRaycaster.far = SUN_ORBIT_RADIUS * 1.4;
            const hits = solarMapRaycaster.intersectObjects(occluders, false);
            if(hits.length === 0) return 1;
            let factor = 1;
            for(const hit of hits) {
                const hitSourceId = hit.object && hit.object.userData && hit.object.userData.solarMapSourceId
                    ? String(hit.object.userData.solarMapSourceId)
                    : null;
                const hitParentSourceId = hit.object && hit.object.userData && hit.object.userData.solarMapParentSourceId
                    ? String(hit.object.userData.solarMapParentSourceId)
                    : null;
                if(ignoreSourceId && (hitSourceId === ignoreSourceId || hitParentSourceId === ignoreSourceId)) continue;
                if(hit.object.userData.isGlass) factor *= 0.78;
                else if(hit.object.userData.isTrellis) factor *= 0.55;
                else return 0;
            }
            return factor;
        }

        function getSolarMapSkyVisibility(cell, samplePoint, occluders) {
            const normal = getSolarMapCellWorldNormal(cell);
            const origin = samplePoint.clone().addScaledVector(normal, 0.05);
            if(cell && cell.sourcePlane !== 'vertical') origin.y += 0.04;
            const directions = getSolarMapSkySampleDirections(cell);
            const ignoreSourceId = cell && cell.sourceId && (cell.sourcePlane === 'vertical' || cell.sourceKind === 'object') ? String(cell.sourceId) : null;
            const visible = directions.reduce((sum, direction) => {
                return sum + getSolarMapSkyRayTransmission(origin, direction, occluders, ignoreSourceId);
            }, 0);
            return Math.max(0, Math.min(1, visible / Math.max(1, directions.length)));
        }

        function hasImportedNeighborhoodForSolarMap() {
            const neighborhood = horizonSettings && horizonSettings.neighborhood;
            return !!(neighborhood && neighborhood.enabled && Array.isArray(neighborhood.buildings) && neighborhood.buildings.length > 0);
        }

        function getSolarMapSunStateForHour(hour, seasonKey) {
            const sunState = getSunStateForHour(hour, seasonKey, true);
            if(!sunState || !sunState.position) return sunState;
            return {
                ...sunState,
                mapNorthFixed: true
            };
        }

        function getSolarMapSunTargetForSample(samplePoint, sunState) {
            if(!samplePoint || !sunState || !sunState.position) return sunState ? sunState.position : null;
            const direction = sunState.position.clone();
            if(direction.lengthSq() <= 0.000001) return sunState.position;
            direction.normalize();
            return samplePoint.clone().add(direction.multiplyScalar(SUN_ORBIT_RADIUS * 1.4));
        }

        function getSolarMapPeriodConfig() {
            const period = ['spring', 'summer', 'autumn', 'winter'].includes(solarMapPeriod) ? solarMapPeriod : 'annual';
            const labels = {
                annual: 'année entière',
                spring: 'printemps',
                summer: 'été',
                autumn: 'automne',
                winter: 'hiver'
            };
            const seasons = period === 'annual'
                ? ['winter', 'spring', 'summer', 'autumn']
                : [period];
            return {
                key: period,
                label: labels[period] || labels.annual,
                seasons
            };
        }

        function computeSolarMapData() {
            const sources = getSolarMapSourcePolygons();
            if(sources.length === 0) {
                const message = balconyDesignMode === 'exterieur'
                    ? "Crée au moins une surface extérieure pour calculer la carte d'ensoleillement."
                    : "Ferme d'abord le contour du balcon pour calculer la carte d'ensoleillement.";
                alert(message);
                return null;
            }

            const cellPx = SOLAR_MAP_CELL_DM * 20;
            const cells = [];
            sources.forEach(source => {
                cells.push(...createSolarMapCellsForSource(source, cellPx));
            });

            if(!cells.length) return null;
            const occluders = getSolarMapOccluders();
            let daylightSamples = 0;
            const periodConfig = getSolarMapPeriodConfig();
            const solarMapSeasons = periodConfig.seasons;
            cells.forEach(cell => {
                const sampleY = Number.isFinite(cell.sampleY) ? cell.sampleY : cell.surfaceY + SOLAR_MAP_SAMPLE_Y_OFFSET;
                const samplePoint = getSolarMapLocalPointWorld3D(cell.worldX, sampleY, cell.worldZ);
                cell.skyVisibility = getSolarMapSkyVisibility(cell, samplePoint, occluders);
            });
            solarMapSeasons.forEach(seasonKey => {
                for(let hour = 0; hour <= 24 + 1e-6; hour += SOLAR_MAP_STEP_HOURS) {
                    const sunState = getSolarMapSunStateForHour(hour, seasonKey);
                    if(!sunState.daylight || sunState.position.y <= 0) continue;
                    const directEnergyFactor = getSolarMapDirectEnergyFactor(sunState);
                    if(directEnergyFactor <= 0) continue;
                    daylightSamples++;
                    cells.forEach(cell => {
                        const sampleY = Number.isFinite(cell.sampleY) ? cell.sampleY : cell.surfaceY + SOLAR_MAP_SAMPLE_Y_OFFSET;
                        const samplePointLocal = new THREE.Vector3(
                            cell.worldX,
                            sampleY,
                            cell.worldZ
                        );
                        const samplePoint = getSolarMapLocalPointWorld3D(samplePointLocal.x, samplePointLocal.y, samplePointLocal.z);
                        const sunTarget = getSolarMapSunTargetForSample(samplePoint, sunState);
                        const sunDirX = sunTarget.x - samplePoint.x;
                        const sunDirY = sunTarget.y - samplePoint.y;
                        const sunDirZ = sunTarget.z - samplePoint.z;
                        const sunDirLen = Math.hypot(sunDirX, sunDirZ);
                        const sunDirLen3D = Math.hypot(sunDirX, sunDirY, sunDirZ);
                        const isVerticalSurface = cell.sourcePlane === 'vertical';
                        let surfaceFacing = sunDirLen3D > 0.0001 ? sunDirY / sunDirLen3D : 0;
                        if(isVerticalSurface) {
                            const worldNormal = getSolarMapLocalDirectionWorldXZ(cell.normalX, cell.normalZ);
                            const normalX = worldNormal.x;
                            const normalZ = worldNormal.z;
                            const normalLen = Math.hypot(normalX, normalZ);
                            surfaceFacing = sunDirLen3D > 0.0001 && normalLen > 0.0001
                                ? (sunDirX / sunDirLen3D) * (normalX / normalLen) + (sunDirZ / sunDirLen3D) * (normalZ / normalLen)
                                : 0;
                            if(cell.doubleSidedSolar === true) surfaceFacing = Math.abs(surfaceFacing);
                        }
                        const surfaceNormal = getSolarMapLocalDirectionWorldXZ(cell.normalX, cell.normalZ);
                        const selfOffsetX = surfaceNormal.x * 0.03;
                        const selfOffsetZ = surfaceNormal.z * 0.03;
                        samplePoint.x += selfOffsetX;
                        samplePoint.z += selfOffsetZ;
                        let rayTransmission = 0;
                        if(surfaceFacing > 0.05) {
                            rayTransmission = isSolarSampleSunlit(samplePoint, sunTarget, occluders, 0, {
                                skipLocalCeilingCheck: true,
                                ignoreSourceId: (isVerticalSurface || cell.sourceKind === 'object') ? cell.sourceId : null
                            });
                        }
                        if(rayTransmission > 0) {
                            const visibleHours = SOLAR_MAP_STEP_HOURS / solarMapSeasons.length * rayTransmission;
                            const weightedHours = visibleHours * Math.max(0, Math.min(1, surfaceFacing)) * directEnergyFactor;
                            cell.directLightHours += visibleHours;
                            cell.sunHours += weightedHours;
                            if(hour < 12) cell.morningSunHours += weightedHours;
                            else if(hour < 16) cell.middaySunHours += weightedHours;
                            else cell.afternoonSunHours += weightedHours;
                            if(hour >= 12 && hour < 17) cell.hotSunHours += weightedHours;
                        }
                        const skyDiffuseFactor = (0.14 + directEnergyFactor * 0.30) * Math.max(0.35, Number(sunState.daylightStrength) || 0);
                        cell.skyDiffuseHours += SOLAR_MAP_STEP_HOURS / solarMapSeasons.length * cell.skyVisibility * skyDiffuseFactor;
                        cell.samples++;
                    });
                }
            });

            const averageDirectEnergy = cells.reduce((sum, cell) => sum + (Number(cell.sunHours) || 0), 0) / Math.max(1, cells.length);
            const reflectedBase = Math.min(1.8, averageDirectEnergy * 0.22);
            cells.forEach(cell => {
                cell.reflectedLightHours = reflectedBase * (0.35 + 0.65 * (Number(cell.skyVisibility) || 0));
                cell.globalLightHours = (Number(cell.sunHours) || 0) + (Number(cell.skyDiffuseHours) || 0) + (Number(cell.reflectedLightHours) || 0);
            });

            cells.forEach(cell => {
                cell.exposure = classifySolarMapPlantExposure(cell);
            });
            const exposureCounts = cells.reduce((acc, cell) => {
                const key = cell.exposure && cell.exposure.plantDbSunlight ? cell.exposure.plantDbSunlight : 'part_shade';
                acc[key] = (acc[key] || 0) + 1;
                return acc;
            }, {});
            const sourceOutlines = sources
                .filter(source => source && source.show3DOutline === true && Array.isArray(source.polygon) && source.polygon.length >= 3)
                .map(source => ({
                    id: source.id,
                    label: source.label || '',
                    kind: source.kind || 'object',
                    objectType: source.objectType || null,
                    objectId: source.objectId || null,
                    polygon: source.polygon.map(pt => ({ x: pt.x, y: pt.y })),
                    surfaceY: Number.isFinite(source.surfaceY) ? source.surfaceY : 0
                }));

            return {
                cells,
                sourceOutlines,
                cellPx,
                computedAt: Date.now(),
                stepHours: SOLAR_MAP_STEP_HOURS,
                daylightSamples,
                sourceCount: sources.length,
                solarMapPeriod: periodConfig.key,
                solarMapPeriodLabel: periodConfig.label,
                annualized: periodConfig.key === 'annual',
                exposureCounts,
                plantDatabaseFields: ['sunlight'],
                minLightHours: cells.reduce((min, cell) => Math.min(min, cell.directLightHours), Infinity),
                maxLightHours: cells.reduce((max, cell) => Math.max(max, cell.directLightHours), 0),
                minGlobalHours: cells.reduce((min, cell) => Math.min(min, cell.globalLightHours), Infinity),
                maxGlobalHours: cells.reduce((max, cell) => Math.max(max, cell.globalLightHours), 0),
                minHours: cells.reduce((min, cell) => Math.min(min, cell.sunHours), Infinity),
                maxHours: cells.reduce((max, cell) => Math.max(max, cell.sunHours), 0)
            };
        }

        function rebuildSolarMapMeshes() {
            clearSolarMapMeshes();
            if(!solarMapGroup || !solarMapVisible || !solarMapData || !Array.isArray(solarMapData.cells)) return;
            solarMapGroup.visible = true;
            const size = SOLAR_MAP_CELL_DM;
            const surfaceLift = 0.09;
            const verticalLift = 0.09;
            const geo = new THREE.PlaneGeometry(size * 1.006, size * 1.006);
            geo.rotateX(-Math.PI / 2);
            const createSolarMapTileMaterial = (cell) => new THREE.MeshBasicMaterial({
                color: getSolarMapHexColorForCell(cell, solarMapData),
                transparent: true,
                opacity: getSolarMapOpacityForCell(cell, solarMapData),
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: cell && cell.sourcePlane === 'vertical' ? -3 : -8,
                polygonOffsetUnits: cell && cell.sourcePlane === 'vertical' ? -3 : -8,
                side: cell && cell.sourcePlane === 'vertical' && cell.doubleSidedSolar !== true
                    ? THREE.FrontSide
                    : THREE.DoubleSide
            });
            solarMapData.cells.forEach(cell => {
                const mat = createSolarMapTileMaterial(cell);
                let tile;
                if(cell.sourcePlane === 'vertical') {
                    const verticalGeo = new THREE.PlaneGeometry(
                        Math.max(0.05, (Number(cell.verticalCellW) || size) * 1.006),
                        Math.max(0.05, (Number(cell.verticalCellH) || size) * 1.006)
                    );
                    tile = new THREE.Mesh(verticalGeo, mat);
                    const normalX = Number(cell.normalX) || 0;
                    const normalZ = Number(cell.normalZ) || 0;
                    tile.rotation.y = Math.atan2(normalX, normalZ);
                    tile.position.set(
                        cell.worldX + normalX * verticalLift,
                        Number(cell.sampleY) || cell.surfaceY,
                        cell.worldZ + normalZ * verticalLift
                    );
                } else if(Array.isArray(cell.clippedPolygon) && cell.clippedPolygon.length >= 3) {
                    const vertices = [];
                    cell.clippedPolygon.forEach(pt => {
                        vertices.push(pt.x / 20 - cell.worldX, 0, pt.y / 20 - cell.worldZ);
                    });
                    const indices = [];
                    for(let i = 1; i < cell.clippedPolygon.length - 1; i++) indices.push(0, i, i + 1);
                    const clippedGeo = new THREE.BufferGeometry();
                    clippedGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
                    clippedGeo.setIndex(indices);
                    clippedGeo.computeVertexNormals();
                    tile = new THREE.Mesh(clippedGeo, mat);
                    tile.position.set(cell.worldX, cell.surfaceY + surfaceLift, cell.worldZ);
                } else {
                    tile = new THREE.Mesh(geo.clone(), mat);
                    tile.position.set(cell.worldX, cell.surfaceY + surfaceLift, cell.worldZ);
                }
                tile.renderOrder = 4;
                tile.userData.solarMapCell = cell;
                solarMapGroup.add(tile);
            });
            rebuildSolarMapSurfaceOutlines3D();
        }

        function rebuildSolarMapSurfaceOutlines3D() {
            if(!solarMapGroup || !solarMapData || !Array.isArray(solarMapData.sourceOutlines)) return;
            solarMapData.sourceOutlines.forEach(outline => {
                if(!outline || !Array.isArray(outline.polygon) || outline.polygon.length < 3) return;
                const mat = new THREE.MeshBasicMaterial({
                    color: outline.objectType === 'cornerFill' ? 0xfff3b0 : 0xffffff,
                    transparent: true,
                    opacity: 0.92,
                    depthTest: false,
                    depthWrite: false
                });
                const y = (Number(outline.surfaceY) || 0) + 0.13;
                for(let i = 0; i < outline.polygon.length; i++) {
                    const a = outline.polygon[i];
                    const b = outline.polygon[(i + 1) % outline.polygon.length];
                    const edge = createSolarMapOutlineTube3D(
                        new THREE.Vector3(a.x / 20, y, a.y / 20),
                        new THREE.Vector3(b.x / 20, y, b.y / 20),
                        mat
                    );
                    if(edge) {
                        edge.renderOrder = 7;
                        edge.userData.solarMapOutline = true;
                        solarMapGroup.add(edge);
                    }
                }
                const shadowMat = new THREE.MeshBasicMaterial({
                    color: 0x1b1b1b,
                    transparent: true,
                    opacity: 0.42,
                    depthTest: false,
                    depthWrite: false
                });
                const shadowY = y - 0.028;
                for(let i = 0; i < outline.polygon.length; i++) {
                    const a = outline.polygon[i];
                    const b = outline.polygon[(i + 1) % outline.polygon.length];
                    const edge = createSolarMapOutlineTube3D(
                        new THREE.Vector3(a.x / 20, shadowY, a.y / 20),
                        new THREE.Vector3(b.x / 20, shadowY, b.y / 20),
                        shadowMat,
                        0.034
                    );
                    if(edge) {
                        edge.renderOrder = 6;
                        edge.userData.solarMapOutline = true;
                        solarMapGroup.add(edge);
                    }
                }
            });
        }

        function createSolarMapOutlineTube3D(start, end, material, radius = 0.026) {
            const delta = end.clone().sub(start);
            const length = delta.length();
            if(length < 0.03) return null;
            const geo = new THREE.CylinderGeometry(radius, radius, length, 8, 1, false);
            geo.rotateX(Math.PI / 2);
            const mesh = new THREE.Mesh(geo, material);
            mesh.position.copy(start).add(end).multiplyScalar(0.5);
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), delta.normalize());
            return mesh;
        }

        function handleSolarMapCellClick3D(event) {
            if(!event || !solarMapVisible || !solarMapGroup || !renderer || !camera) return false;
            const rect = renderer.domElement.getBoundingClientRect();
            const localX = event.clientX - rect.left;
            const localY = event.clientY - rect.top;
            if(rect.width <= 0 || localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) return false;
            mouse3d.x = (localX / rect.width) * 2 - 1;
            mouse3d.y = -(localY / rect.height) * 2 + 1;
            raycaster.setFromCamera(mouse3d, camera);
            const hits = raycaster.intersectObjects(solarMapGroup.children, false);
            const hit = hits.find(entry => entry.object && entry.object.userData && entry.object.userData.solarMapCell);
            if(!hit) {
                hideSolarMapInfoButton();
                hideSolarMapTooltip();
                return false;
            }
            selectedSolarMapCell = hit.object.userData.solarMapCell;
            updateSolarMapDetailUI(selectedSolarMapCell);
            hideSolarMapTooltip();
            showSolarMapInfoButton(selectedSolarMapCell, event.clientX, event.clientY);
            draw2D();
            return true;
        }

        function updateSolarMapDisplayMode(mode) {
            const nextMode = mode === 'intensity' ? 'intensity' : 'hours';
            if(solarMapDisplayMode === nextMode) return;
            solarMapDisplayMode = nextMode;
            solarMapPath2DCache = null;
            if(solarMapData && solarMapVisible) rebuildSolarMapMeshes();
            updateSolarMapUI();
            draw2D();
            renderCurrent3DFrame();
        }

        function updateSolarMapUI() {
            const btn = document.getElementById('btn-solar-map');
            const visibilityBtn = document.getElementById('btn-solar-map-visibility');
            const hoursBtn = document.getElementById('btn-solar-map-mode-hours');
            const intensityBtn = document.getElementById('btn-solar-map-mode-intensity');
            const status = document.getElementById('solar-map-status');
            const legend = document.getElementById('solar-map-legend');
            setSolarMapMeshesVisible(!!(solarMapVisible && solarMapData));
            if(legend) legend.style.display = (solarMapVisible && solarMapData) ? 'block' : 'none';
            if(btn) {
                btn.classList.toggle('active', solarMapEnabled);
                btn.textContent = solarMapData ? 'Recalculer' : "Carte d'usage";
            }
            if(visibilityBtn) {
                visibilityBtn.disabled = !solarMapData;
                visibilityBtn.classList.toggle('active', solarMapVisible && !!solarMapData);
                visibilityBtn.textContent = solarMapVisible ? 'Masquer' : 'Afficher';
            }
            if(hoursBtn) hoursBtn.classList.toggle('active', solarMapDisplayMode !== 'intensity');
            if(intensityBtn) intensityBtn.classList.toggle('active', solarMapDisplayMode === 'intensity');
            if(status) {
                if(!solarMapData) status.textContent = 'Carte non calculée';
                else {
                    const maxHours = Math.round((solarMapData.maxGlobalHours || solarMapData.maxHours || 0) * 10) / 10;
                    const minHours = Math.round((Number.isFinite(solarMapData.minGlobalHours) ? solarMapData.minGlobalHours : (Number.isFinite(solarMapData.minHours) ? solarMapData.minHours : 0)) * 10) / 10;
                    const counts = solarMapData.exposureCounts || {};
                    const plantKeys = ['full_sun', 'sun-part_shade', 'part_shade', 'full_shade'].filter(key => counts[key] > 0).join(', ');
                    const objectCells = solarMapData.cells.filter(cell => cell.sourceKind === 'object').length;
                    const verticalCells = solarMapData.cells.filter(cell => cell.sourceKind === 'vertical').length;
                    const periodLabel = solarMapDirty && typeof getSolarMapPeriodConfig === 'function'
                        ? getSolarMapPeriodConfig().label
                        : (solarMapData.solarMapPeriodLabel || 'année entière');
                    status.textContent = solarMapData.cells.length + ' zones analysées' + (objectCells ? ' dont ' + objectCells + ' sur objets' : '') + (verticalCells ? ' · ' + verticalCells + ' verticales' : '') + ' · ' + periodLabel + ' ' + minHours + '-' + maxHours + ' h globale/j · ' + (solarMapDirty ? 'à recalculer' : getSolarMapLabel(maxHours)) + (plantKeys ? ' · plantes: ' + plantKeys : '');
                }
            }
        }

        function renderSolarMap2DOverlay() {
            if(!solarMapVisible || !solarMapData || !Array.isArray(solarMapData.cells)) return;
            const cellPx = solarMapData.cellPx || 20;

            const drawClippedCellPath = (cell) => {
                if(!Array.isArray(cell.clippedPolygon) || cell.clippedPolygon.length < 3) return false;
                ctx2d.beginPath();
                cell.clippedPolygon.forEach((pt, index) => {
                    if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                    else ctx2d.lineTo(pt.x, pt.y);
                });
                ctx2d.closePath();
                return true;
            };

            // Build Path2D cache once per solarMapData instance (4 colors max → 4 paths)
            if(!solarMapPath2DCache || solarMapPath2DCache.dataRef !== solarMapData) {
                const fillPaths = new Map();
                let objectStrokePath = null;
                solarMapData.cells.forEach(cell => {
                    if(cell.sourcePlane === 'vertical') return; // drawn separately as arcs
                    const color = getSolarMapColorForCell(cell, solarMapData);
                    if(!fillPaths.has(color)) fillPaths.set(color, new Path2D());
                    const p = fillPaths.get(color);
                    if(Array.isArray(cell.clippedPolygon) && cell.clippedPolygon.length >= 3) {
                        p.moveTo(cell.clippedPolygon[0].x, cell.clippedPolygon[0].y);
                        for(let i = 1; i < cell.clippedPolygon.length; i++) p.lineTo(cell.clippedPolygon[i].x, cell.clippedPolygon[i].y);
                        p.closePath();
                    } else {
                        p.rect(cell.x, cell.y, cellPx, cellPx);
                    }
                    if(cell.sourceKind === 'object') {
                        if(!objectStrokePath) objectStrokePath = new Path2D();
                        if(Array.isArray(cell.clippedPolygon) && cell.clippedPolygon.length >= 3) {
                            objectStrokePath.moveTo(cell.clippedPolygon[0].x, cell.clippedPolygon[0].y);
                            for(let i = 1; i < cell.clippedPolygon.length; i++) objectStrokePath.lineTo(cell.clippedPolygon[i].x, cell.clippedPolygon[i].y);
                            objectStrokePath.closePath();
                        } else {
                            objectStrokePath.rect(cell.x, cell.y, cellPx, cellPx);
                        }
                    }
                });
                solarMapPath2DCache = { dataRef: solarMapData, fillPaths, objectStrokePath };
            }

            ctx2d.save();

            // Fill: one draw call per color (4 max)
            solarMapPath2DCache.fillPaths.forEach((path, color) => {
                ctx2d.fillStyle = color;
                ctx2d.fill(path);
            });

            // Object borders: one stroke call
            if(solarMapPath2DCache.objectStrokePath) {
                ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.35)';
                ctx2d.lineWidth = 0.9 / scale;
                ctx2d.stroke(solarMapPath2DCache.objectStrokePath);
            }

            // Vertical cells (arcs) — few in number, drawn individually
            solarMapData.cells.forEach(cell => {
                if(cell.sourcePlane !== 'vertical' || cell.verticalLevel !== 0) return;
                ctx2d.strokeStyle = getSolarMapColorForCell(cell, solarMapData).replace(/,\s*0\.\d+\)/, ', 0.82)');
                ctx2d.lineWidth = Math.max(2, 3 / scale);
                ctx2d.beginPath();
                ctx2d.arc(cell.center.x, cell.center.y, Math.max(2, 3 / scale), 0, Math.PI * 2);
                ctx2d.stroke();
            });

            // Selected cell highlight
            if(selectedSolarMapCell) {
                ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.95)';
                ctx2d.lineWidth = 3 / scale;
                ctx2d.setLineDash([]);
                if(selectedSolarMapCell.sourcePlane === 'vertical') {
                    ctx2d.beginPath();
                    ctx2d.arc(selectedSolarMapCell.center.x, selectedSolarMapCell.center.y, Math.max(5, 7 / scale), 0, Math.PI * 2);
                    ctx2d.stroke();
                } else {
                    const hasClippedSelection = drawClippedCellPath(selectedSolarMapCell);
                    if(hasClippedSelection) ctx2d.stroke();
                    else ctx2d.strokeRect(selectedSolarMapCell.x, selectedSolarMapCell.y, cellPx, cellPx);
                    ctx2d.strokeStyle = 'rgba(20, 20, 20, 0.85)';
                    ctx2d.lineWidth = 1.2 / scale;
                    if(hasClippedSelection) {
                        drawClippedCellPath(selectedSolarMapCell);
                        ctx2d.stroke();
                    } else {
                        ctx2d.strokeRect(selectedSolarMapCell.x + 2 / scale, selectedSolarMapCell.y + 2 / scale, cellPx - 4 / scale, cellPx - 4 / scale);
                    }
                }
            }
            ctx2d.restore();
        }

        async function toggleSolarMap() {
            if(!solarMapEnabled) solarMapEnabled = true;
            solarMapVisible = true;
            try {
                await startDownloadProgress('Calcul soleil direct', 'Préparation des zones...', 5);
                updateDownloadProgress(24, 'Analyse du balcon et des obstacles...');
                await waitAnimationFrame();
                const data = computeSolarMapData();
                if(!data) {
                    solarMapEnabled = false;
                    solarMapVisible = false;
                    updateSolarMapUI();
                    failDownloadProgress('Carte impossible à calculer.');
                    return;
                }
                updateDownloadProgress(82, 'Construction de la carte...');
                await waitAnimationFrame();
                solarMapData = data;
                solarMapPath2DCache = null;
                selectedSolarMapCell = null;
                solarMapDirty = false;
                solarMapVisible = true;
                rebuildSolarMapMeshes();
                updateSolarMapUI();
                updateSolarMapDetailUI(null);
                hideSolarMapTooltip();
                hideSolarMapInfoButton();
                draw2D();
                renderCurrent3DFrame();
                finishDownloadProgress('Carte d’ensoleillement calculée.');
            } catch(err) {
                console.warn('Calcul soleil direct interrompu', err);
                solarMapEnabled = false;
                solarMapVisible = false;
                updateSolarMapUI();
                failDownloadProgress('Calcul soleil direct interrompu.');
            }
        }

        function toggleSolarMapVisibility() {
            if(!solarMapData) return;
            solarMapVisible = !solarMapVisible;
            if(solarMapVisible) {
                if(solarMapGroup && solarMapGroup.children.length) setSolarMapMeshesVisible(true);
                else rebuildSolarMapMeshes();
            } else {
                setSolarMapMeshesVisible(false);
                selectedSolarMapCell = null;
                hideSolarMapTooltip();
                hideSolarMapInfoButton();
            }
            updateSolarMapUI();
            draw2D();
            renderCurrent3DFrame();
        }

        function editMeasure(measureIndex) {
            const measure = measureAreas[measureIndex];
            const segmentIndex = measure.segmentIndex;
            editingSegmentIndex = segmentIndex;
            draw2D();
        }

        function getBalconySceneOffset2D(options = {}) {
            if(options && (options.ignoreBalconyOffset || options.ignoreBalconyTransform)) return { x: 0, y: 0 };
            return {
                x: Number.isFinite(balconyOffsetX) ? balconyOffsetX * 20 : 0,
                y: Number.isFinite(balconyOffsetZ) ? balconyOffsetZ * 20 : 0
            };
        }

        function getBalconyScenePivot2D() {
            if(typeof buildingAlignedGridActive !== 'undefined' && buildingAlignedGridActive) return { x: 0, y: 0 };
            if(typeof getPrimaryContourPolygon2D !== 'function') return { x: 0, y: 0 };
            const polygon = getPrimaryContourPolygon2D();
            if(!polygon || polygon.length < 3) return { x: 0, y: 0 };
            const bounds = polygon.reduce((acc, p) => ({
                minX: Math.min(acc.minX, p.x),
                maxX: Math.max(acc.maxX, p.x),
                minY: Math.min(acc.minY, p.y),
                maxY: Math.max(acc.maxY, p.y)
            }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
            return {
                x: (bounds.minX + bounds.maxX) * 0.5,
                y: (bounds.minY + bounds.maxY) * 0.5
            };
        }

        function transformBalconyScenePoint2D(point, options = {}) {
            const x = Number(point && point.x) || 0;
            const y = Number(point && point.y) || 0;
            if(options && (options.ignoreBalconyOffset || options.ignoreBalconyTransform)) return { x, y };
            const rot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const cos = Math.cos(rot);
            const sin = Math.sin(rot);
            const offset = getBalconySceneOffset2D(options);
            const pivot = getBalconyScenePivot2D();
            const dx = x - pivot.x;
            const dy = y - pivot.y;
            return {
                x: dx * cos - dy * sin + pivot.x + offset.x,
                y: dx * sin + dy * cos + pivot.y + offset.y
            };
        }

        function inverseTransformBalconyScenePoint2D(point, options = {}) {
            const x = Number(point && point.x) || 0;
            const y = Number(point && point.y) || 0;
            if(options && (options.ignoreBalconyOffset || options.ignoreBalconyTransform)) return { x, y };
            const rot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const cos = Math.cos(-rot);
            const sin = Math.sin(-rot);
            const offset = getBalconySceneOffset2D(options);
            const pivot = getBalconyScenePivot2D();
            const dx = x - offset.x - pivot.x;
            const dy = y - offset.y - pivot.y;
            return {
                x: dx * cos - dy * sin + pivot.x,
                y: dx * sin + dy * cos + pivot.y
            };
        }

        function makeShadowMesh(geometry, material, castShadow = true, receiveShadow = true) {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.castShadow = castShadow;
            mesh.receiveShadow = receiveShadow;
            return mesh;
        }

        function addOrientedBox(group, len, h, depth, material, x, y, z, angle, castShadow = true, receiveShadow = true) {
            const mesh = makeShadowMesh(new THREE.BoxGeometry(len, h, depth), material, castShadow, receiveShadow);
            mesh.position.set(x, y, z);
            mesh.rotation.y = -angle;
            group.add(mesh);
            return mesh;
        }

        function getLiveDrawingSegment() {
            if(!isDrawingToolActive || !currentPoint || !mousePos2d) return null;
            if(isConstraintTool(drawingMode) || drawingMode === 'surface' || drawingMode === 'bare-edge') return null;
            const dx = mousePos2d.x - currentPoint.x;
            const dy = mousePos2d.y - currentPoint.y;
            if(Math.sqrt(dx * dx + dy * dy) < 2) return null;
            return { p1: currentPoint, p2: mousePos2d, type: drawingMode };
        }

        function renderLiveDrawingWall(group, segment, materials, wallThickness) {
            if(!group || !segment) return;
            const x1 = segment.p1.x / 20;
            const z1 = segment.p1.y / 20;
            const x2 = segment.p2.x / 20;
            const z2 = segment.p2.y / 20;
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 0.01) return;

            const type = segment.type || 'wall';
            const wallH = archHeights.wall / 10;
            const windowBotH = archHeights.windowBot / 10;
            const windowTopH = archHeights.windowTop / 10;
            const glassBotH = archHeights.glassBot / 10;
            const glassTopH = archHeights.glassTop / 10;
            const railH = archHeights.rail / 10;
            const angle = Math.atan2(dz, dx);
            const cx = (x1 + x2) / 2;
            const cz = (z1 + z2) / 2;

            const clonePreviewMat = (base, opacity = 0.58) => {
                const mat = base.clone();
                mat.transparent = true;
                mat.opacity = opacity;
                mat.depthWrite = false;
                return mat;
            };
            const wallMat = clonePreviewMat(materials.wall, 0.48);
            const railMat = clonePreviewMat(materials.rail, 0.58);
            const glassMat = clonePreviewMat(materials.glass, 0.42);
            const doorPreviewMat = materials.door ? clonePreviewMat(materials.door, 0.52) : clonePreviewMat(materials.wall, 0.48);

            if(type === 'window') {
                if(windowBotH > 0) addOrientedBox(group, len, windowBotH, wallThickness, wallMat, cx, windowBotH / 2, cz, angle, false, false);
                const windowGlassH = windowTopH - windowBotH;
                if(windowGlassH > 0) addOrientedBox(group, len, windowGlassH, wallThickness, glassMat, cx, windowBotH + windowGlassH / 2, cz, angle, false, false);
                const topH = wallH - windowTopH;
                if(topH > 0) addOrientedBox(group, len, topH, wallThickness, wallMat, cx, windowTopH + topH / 2, cz, angle, false, false);
                return;
            }

            if(type === 'glass') {
                const glassH = glassTopH - glassBotH;
                if(glassH > 0) addOrientedBox(group, len, glassH, wallThickness, glassMat, cx, glassBotH + glassH / 2, cz, angle, false, false);
                const topH = wallH - glassTopH;
                if(topH > 0) addOrientedBox(group, len, topH, wallThickness, wallMat, cx, glassTopH + topH / 2, cz, angle, false, false);
                return;
            }

            if(type === 'rail') {
                const railType = archOptions.railType || (archOptions.railBars ? 'bars' : 'low-wall');
                renderRailSegment(group, null, null, null, null, railH, wallThickness, railMat, glassMat, railType, len, angle, cx, cz);
                return;
            }

            if(type === 'door') {
                const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                const lintelH = wallH - doorOpenH;
                if(lintelH > 0) addOrientedBox(group, len, lintelH, wallThickness, wallMat, cx, doorOpenH + lintelH / 2, cz, angle, false, false);
                if(len > 0.05) {
                    const ajar = 15 * Math.PI / 180;
                    const swingSign = segment.swing === 'right' ? 1 : -1;
                    const panelAngle = angle + swingSign * ajar;
                    const panelCx = x1 + Math.cos(panelAngle) * len / 2;
                    const panelCz = z1 + Math.sin(panelAngle) * len / 2;
                    addOrientedBox(group, len, doorOpenH, 0.06, doorPreviewMat, panelCx, doorOpenH / 2, panelCz, panelAngle, false, false);
                    const hRadius = 0.20;
                    const handleH = Math.min(10.0, doorOpenH * 0.43);
                    const hDist = len * 0.82;
                    const perpX = -Math.sin(panelAngle), perpZ = Math.cos(panelAngle);
                    const hOff = 0.03 + hRadius;
                    const hMat = clonePreviewMat(materials.door || materials.wall, 0.7);
                    hMat.color.set(0xd4a843);
                    const hGeo = new THREE.SphereGeometry(hRadius, 10, 8);
                    const hMesh = makeShadowMesh(hGeo, hMat, false, false);
                    hMesh.position.set(x1 + Math.cos(panelAngle) * hDist + perpX * hOff, handleH, z1 + Math.sin(panelAngle) * hDist + perpZ * hOff);
                    group.add(hMesh);
                }
                return;
            }

            const h = type === 'rail' ? railH : wallH;
            const mat = type === 'rail' ? railMat : wallMat;
            if(h > 0) addOrientedBox(group, len, h, wallThickness, mat, cx, h / 2, cz, angle, false, false);
        }

        function scheduleLive3DPreviewUpdate() {
            if(activeMainView !== '3d' && activeMainView !== 'mixte') return;
            if(!getLiveDrawingSegment()) return;
            if(live3DPreviewFrame) return;
            live3DPreviewFrame = requestAnimationFrame(() => {
                live3DPreviewFrame = null;
                build3DArch();
                renderCurrent3DFrame();
            });
        }

        function isPrimaryContourClosedFor3D(contourSegments = getPrimaryContourSegments()) {
            if(!contourSegments || contourSegments.length < 3) return false;
            const firstPoint = contourSegments[0].p1;
            const lastPoint = contourSegments[contourSegments.length - 1].p2;
            if(!firstPoint || !lastPoint) return false;
            return Math.hypot(firstPoint.x - lastPoint.x, firstPoint.y - lastPoint.y) < 40;
        }

        function getClosedContourPointsXZ() {
            const contourSegments = getPrimaryContourSegments();
            if(!(isContourClosed || isPrimaryContourClosedFor3D(contourSegments)) || contourSegments.length < 3) return [];
            const points = [
                { x: contourSegments[0].p1.x / 20, z: contourSegments[0].p1.y / 20 }
            ];
            contourSegments.forEach((s) => {
                points.push({ x: s.p2.x / 20, z: s.p2.y / 20 });
            });
            if(points.length > 1) {
                const first = points[0];
                const last = points[points.length - 1];
                if(Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.z - last.z) < 1e-6) {
                    points.pop();
                }
            }
            return points;
        }

        function getSegmentEndpointKey(point) {
            if(!point) return '';
            return Math.round(point.x * 1000) + ':' + Math.round(point.y * 1000);
        }

        function projectPointToSegmentForSharedEdge(point, segment) {
            if(!point || !segment || !segment.p1 || !segment.p2) return null;
            const vx = segment.p2.x - segment.p1.x;
            const vy = segment.p2.y - segment.p1.y;
            const lenSq = vx * vx + vy * vy;
            if(lenSq <= 0.0001) return null;
            const t = ((point.x - segment.p1.x) * vx + (point.y - segment.p1.y) * vy) / lenSq;
            const clampedT = Math.max(0, Math.min(1, t));
            const projected = {
                x: segment.p1.x + vx * clampedT,
                y: segment.p1.y + vy * clampedT
            };
            return {
                t: clampedT,
                dist: Math.hypot(projected.x - point.x, projected.y - point.y)
            };
        }

        function getExistingContourSegmentsForSharing(excludedSketchId = null) {
            const candidates = [...getPrimaryContourSegments()];
            getDetachedSegments().forEach(segment => {
                if(!segment || segment.sharedContourEdge) return;
                if(excludedSketchId && segment.sketchId === excludedSketchId) return;
                candidates.push(segment);
            });
            return candidates;
        }

        function findSharedExistingContourSegmentBetween(a, b, excludedSketchId = null) {
            if(!a || !b) return null;
            const candidates = getExistingContourSegmentsForSharing(excludedSketchId);
            const directMatch = candidates.find(segment => {
                const sameDirection = getSegmentEndpointKey(segment.p1) === getSegmentEndpointKey(a)
                    && getSegmentEndpointKey(segment.p2) === getSegmentEndpointKey(b);
                const reverseDirection = getSegmentEndpointKey(segment.p1) === getSegmentEndpointKey(b)
                    && getSegmentEndpointKey(segment.p2) === getSegmentEndpointKey(a);
                return sameDirection || reverseDirection;
            });
            if(directMatch) return directMatch;

            const tolerance = Math.max(1, GRID_SIZE * 0.2);
            return candidates.find(segment => {
                const projA = projectPointToSegmentForSharedEdge(a, segment);
                const projB = projectPointToSegmentForSharedEdge(b, segment);
                if(!projA || !projB) return false;
                if(projA.dist > tolerance || projB.dist > tolerance) return false;
                return Math.abs(projA.t - projB.t) > 0.01;
            }) || null;
        }

        function reverseSegmentView(segment) {
            const view = { ...segment };
            Object.defineProperties(view, {
                p1: {
                    enumerable: true,
                    configurable: true,
                    get() { return segment.p2; },
                    set(value) { segment.p2 = value; }
                },
                p2: {
                    enumerable: true,
                    configurable: true,
                    get() { return segment.p1; },
                    set(value) { segment.p1 = value; }
                },
                _sourceSegment: {
                    enumerable: false,
                    configurable: true,
                    value: segment
                },
                _reversedView: {
                    enumerable: false,
                    configurable: true,
                    value: true
                }
            });
            return view;
        }

        function orderSegmentGroupByConnectivity(segmentGroup) {
            const source = Array.isArray(segmentGroup) ? segmentGroup.filter(s => s && s.p1 && s.p2) : [];
            if(source.length <= 1) return source.slice();

            const ordered = [source[0]];
            const remaining = source.slice(1);

            while(remaining.length > 0) {
                const startKey = getSegmentEndpointKey(ordered[0].p1);
                const endKey = getSegmentEndpointKey(ordered[ordered.length - 1].p2);
                const nextIndex = remaining.findIndex(segment => {
                    const p1Key = getSegmentEndpointKey(segment.p1);
                    const p2Key = getSegmentEndpointKey(segment.p2);
                    return p1Key === endKey || p2Key === endKey || p2Key === startKey || p1Key === startKey;
                });

                if(nextIndex < 0) {
                    ordered.push(remaining.shift());
                    continue;
                }

                const [segment] = remaining.splice(nextIndex, 1);
                const p1Key = getSegmentEndpointKey(segment.p1);
                const p2Key = getSegmentEndpointKey(segment.p2);

                if(p1Key === endKey) {
                    ordered.push(segment);
                } else if(p2Key === endKey) {
                    ordered.push(reverseSegmentView(segment));
                } else if(p2Key === startKey) {
                    ordered.unshift(segment);
                } else if(p1Key === startKey) {
                    ordered.unshift(reverseSegmentView(segment));
                }
            }

            return ordered;
        }

        function getPrimaryContourSegments() {
            return orderSegmentGroupByConnectivity(segments.filter(s => !s.detached));
        }

        function getDetachedSegments() {
            return segments.filter(s => s.detached);
        }

        function getDetachedSegmentGroups() {
            const groups = new Map();
            getDetachedSegments().forEach(s => {
                const id = s.sketchId || 'detached-ungrouped';
                if(!groups.has(id)) groups.set(id, []);
                groups.get(id).push(s);
            });
            return Array.from(groups.values()).map(group => orderSegmentGroupByConnectivity(group));
        }

        function isSegmentGroupClosed(group) {
            if(!group || group.length < 3) return false;
            const first = group[0].p1;
            const last = group[group.length - 1].p2;
            return Math.hypot(first.x - last.x, first.y - last.y) <= GRID_SIZE;
        }

        function getSegmentGroupPolygonXZ(group) {
            if(!isSegmentGroupClosed(group)) return [];
            const points = [{ x: group[0].p1.x / 20, z: group[0].p1.y / 20 }];
            group.forEach(s => {
                points.push({ x: s.p2.x / 20, z: s.p2.y / 20 });
            });
            const first = points[0];
            const last = points[points.length - 1];
            if(first && last && Math.abs(first.x - last.x) < 1e-6 && Math.abs(first.z - last.z) < 1e-6) {
                points.pop();
            }
            return points.length >= 3 ? points : [];
        }

        function isPostSegmentGroup(group) {
            return Array.isArray(group) && group.length >= 3 && group.every(s => s.type === 'post');
        }

        function getActiveDetachedSegments() {
            if(!activeDetachedSketchId) return [];
            return orderSegmentGroupByConnectivity(segments.filter(s => s.detached && s.sketchId === activeDetachedSketchId));
        }

        function doesDetachedSketchNeedClosure() {
            return detachedDrawingMode && activeDetachedSketchId && getActiveDetachedSegments().length >= 2;
        }

        function isPointInsidePolygonXZ(point, polygon) {
            if(!polygon || polygon.length < 3) return false;
            let inside = false;
            for(let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].x;
                const zi = polygon[i].z;
                const xj = polygon[j].x;
                const zj = polygon[j].z;
                const intersects = ((zi > point.z) !== (zj > point.z)) &&
                    (point.x < ((xj - xi) * (point.z - zi)) / ((zj - zi) || 1e-9) + xi);
                if(intersects) inside = !inside;
            }
            return inside;
        }

        function getOutwardOffsetForSegment(x1, z1, x2, z2, depth, polygon) {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 1e-6) {
                return { x: 0, z: 0 };
            }

            const nx = -dz / len;
            const nz = dx / len;
            const midX = (x1 + x2) / 2;
            const midZ = (z1 + z2) / 2;
            const testDistance = Math.max(depth * 0.75, 0.25);
            const positivePoint = { x: midX + nx * testDistance, z: midZ + nz * testDistance };
            const negativePoint = { x: midX - nx * testDistance, z: midZ - nz * testDistance };
            const positiveInside = isPointInsidePolygonXZ(positivePoint, polygon);
            const negativeInside = isPointInsidePolygonXZ(negativePoint, polygon);

            if(positiveInside && !negativeInside) {
                return { x: -nx * depth / 2, z: -nz * depth / 2 };
            }
            if(!positiveInside && negativeInside) {
                return { x: nx * depth / 2, z: nz * depth / 2 };
            }

            return { x: 0, z: 0 };
        }

        function getPolygonSignedAreaXZ(polygon) {
            if(!polygon || polygon.length < 3) return 0;
            let area = 0;
            for(let i = 0; i < polygon.length; i++) {
                const a = polygon[i];
                const b = polygon[(i + 1) % polygon.length];
                area += a.x * b.z - b.x * a.z;
            }
            return area * 0.5;
        }

        function isConvexVertexXZ(prev, current, next, orientationSign) {
            const ax = current.x - prev.x;
            const az = current.z - prev.z;
            const bx = next.x - current.x;
            const bz = next.z - current.z;
            const cross = ax * bz - az * bx;
            return orientationSign >= 0 ? cross > 1e-6 : cross < -1e-6;
        }

        function intersectLinesXZ(a1, a2, b1, b2) {
            const dax = a2.x - a1.x;
            const daz = a2.z - a1.z;
            const dbx = b2.x - b1.x;
            const dbz = b2.z - b1.z;
            const denom = dax * dbz - daz * dbx;
            if(Math.abs(denom) < 1e-6) return null;
            const qx = b1.x - a1.x;
            const qz = b1.z - a1.z;
            const t = (qx * dbz - qz * dbx) / denom;
            return {
                x: a1.x + t * dax,
                z: a1.z + t * daz
            };
        }

        function getOutwardUnitNormalForSegmentPoints(x1, z1, x2, z2, orientationSign) {
            const dx = x2 - x1;
            const dz = z2 - z1;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 1e-6) return { x: 0, z: 0 };
            if(orientationSign >= 0) {
                return { x: dz / len, z: -dx / len };
            }
            return { x: -dz / len, z: dx / len };
        }

        function computeOffsetContourVertices(polygon, offsetDistance) {
            if(!polygon || polygon.length < 3) return [];
            const orientationSign = Math.sign(getPolygonSignedAreaXZ(polygon)) || 1;
            const result = [];

            for(let i = 0; i < polygon.length; i++) {
                const prev = polygon[(i - 1 + polygon.length) % polygon.length];
                const current = polygon[i];
                const next = polygon[(i + 1) % polygon.length];

                const prevNormal = getOutwardUnitNormalForSegmentPoints(prev.x, prev.z, current.x, current.z, orientationSign);
                const nextNormal = getOutwardUnitNormalForSegmentPoints(current.x, current.z, next.x, next.z, orientationSign);

                const prevLineA = { x: prev.x + prevNormal.x * offsetDistance, z: prev.z + prevNormal.z * offsetDistance };
                const prevLineB = { x: current.x + prevNormal.x * offsetDistance, z: current.z + prevNormal.z * offsetDistance };
                const nextLineA = { x: current.x + nextNormal.x * offsetDistance, z: current.z + nextNormal.z * offsetDistance };
                const nextLineB = { x: next.x + nextNormal.x * offsetDistance, z: next.z + nextNormal.z * offsetDistance };

                const intersection = intersectLinesXZ(prevLineA, prevLineB, nextLineA, nextLineB);
                if(intersection) {
                    result.push(intersection);
                    continue;
                }

                const avgX = prevNormal.x + nextNormal.x;
                const avgZ = prevNormal.z + nextNormal.z;
                const avgLen = Math.sqrt(avgX * avgX + avgZ * avgZ);
                if(avgLen > 1e-6) {
                    result.push({
                        x: current.x + (avgX / avgLen) * offsetDistance,
                        z: current.z + (avgZ / avgLen) * offsetDistance
                    });
                } else {
                    result.push({
                        x: current.x + nextNormal.x * offsetDistance,
                        z: current.z + nextNormal.z * offsetDistance
                    });
                }
            }

            return result;
        }

        function computeOffsetContourVerticesWithEdgeModes(polygon, offsetDistance, edgeModes = []) {
            if(!polygon || polygon.length < 3) return [];
            const orientationSign = Math.sign(getPolygonSignedAreaXZ(polygon)) || 1;
            const result = [];

            function edgeNormal(edgeIndex) {
                const start = polygon[edgeIndex];
                const end = polygon[(edgeIndex + 1) % polygon.length];
                const outward = getOutwardUnitNormalForSegmentPoints(start.x, start.z, end.x, end.z, orientationSign);
                const mode = edgeModes[edgeIndex] || 'outward';
                return mode === 'inward'
                    ? { x: -outward.x, z: -outward.z }
                    : outward;
            }

            for(let i = 0; i < polygon.length; i++) {
                const prevIndex = (i - 1 + polygon.length) % polygon.length;
                const nextIndex = i;
                const prev = polygon[prevIndex];
                const current = polygon[i];
                const next = polygon[(i + 1) % polygon.length];
                const prevNormal = edgeNormal(prevIndex);
                const nextNormal = edgeNormal(nextIndex);

                const prevLineA = { x: prev.x + prevNormal.x * offsetDistance, z: prev.z + prevNormal.z * offsetDistance };
                const prevLineB = { x: current.x + prevNormal.x * offsetDistance, z: current.z + prevNormal.z * offsetDistance };
                const nextLineA = { x: current.x + nextNormal.x * offsetDistance, z: current.z + nextNormal.z * offsetDistance };
                const nextLineB = { x: next.x + nextNormal.x * offsetDistance, z: next.z + nextNormal.z * offsetDistance };

                const intersection = intersectLinesXZ(prevLineA, prevLineB, nextLineA, nextLineB);
                if(intersection) {
                    result.push(intersection);
                    continue;
                }

                result.push({
                    x: current.x + (prevNormal.x + nextNormal.x) * offsetDistance * 0.5,
                    z: current.z + (prevNormal.z + nextNormal.z) * offsetDistance * 0.5
                });
            }

            return result;
        }

        function isFinitePointXZ(point) {
            return !!point && Number.isFinite(point.x) && Number.isFinite(point.z);
        }

        function isUsableContourXZ(points) {
            return Array.isArray(points) && points.length >= 3 && points.every(isFinitePointXZ);
        }

        function buildOuterWallSegment(index, depth, polygon, orientationSign, segmentList = segments) {
            const segment = segmentList[index];
            if(!segment) return null;

            const x1 = segment.p1.x / 20;
            const z1 = segment.p1.y / 20;
            const x2 = segment.p2.x / 20;
            const z2 = segment.p2.y / 20;
            const offset = polygon.length >= 3
                ? getOutwardOffsetForSegment(x1, z1, x2, z2, depth, polygon)
                : { x: 0, z: 0 };

            let start = { x: x1 + offset.x, z: z1 + offset.z };
            let end = { x: x2 + offset.x, z: z2 + offset.z };

            if(polygon.length >= 3 && segmentList.length >= 3) {
                const count = segmentList.length;
                const prevIndex = (index - 1 + count) % count;
                const nextIndex = (index + 1) % count;
                const vertexStart = polygon[index];
                const vertexEnd = polygon[(index + 1) % polygon.length];
                const prevVertex = polygon[(index - 1 + polygon.length) % polygon.length];
                const nextVertex = polygon[(index + 2) % polygon.length];

                if(vertexStart && prevVertex && isConvexVertexXZ(prevVertex, vertexStart, vertexEnd, orientationSign)) {
                    const prevSeg = segmentList[prevIndex];
                    const px1 = prevSeg.p1.x / 20;
                    const pz1 = prevSeg.p1.y / 20;
                    const px2 = prevSeg.p2.x / 20;
                    const pz2 = prevSeg.p2.y / 20;
                    const prevOffset = getOutwardOffsetForSegment(px1, pz1, px2, pz2, depth, polygon);
                    const intersection = intersectLinesXZ(
                        { x: px1 + prevOffset.x, z: pz1 + prevOffset.z },
                        { x: px2 + prevOffset.x, z: pz2 + prevOffset.z },
                        start,
                        end
                    );
                    if(intersection) {
                        start = intersection;
                    }
                }

                if(vertexEnd && nextVertex && isConvexVertexXZ(vertexStart, vertexEnd, nextVertex, orientationSign)) {
                    const nextSeg = segmentList[nextIndex];
                    const nx1 = nextSeg.p1.x / 20;
                    const nz1 = nextSeg.p1.y / 20;
                    const nx2 = nextSeg.p2.x / 20;
                    const nz2 = nextSeg.p2.y / 20;
                    const nextOffset = getOutwardOffsetForSegment(nx1, nz1, nx2, nz2, depth, polygon);
                    const intersection = intersectLinesXZ(
                        start,
                        end,
                        { x: nx1 + nextOffset.x, z: nz1 + nextOffset.z },
                        { x: nx2 + nextOffset.x, z: nz2 + nextOffset.z }
                    );
                    if(intersection) {
                        end = intersection;
                    }
                }
            }

            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 1e-6) return null;

            return {
                x1: start.x,
                z1: start.z,
                x2: end.x,
                z2: end.z,
                len,
                angle: Math.atan2(dz, dx),
                cx: (start.x + end.x) / 2,
                cz: (start.z + end.z) / 2
            };
        }

        function createWallBandMesh(group, innerStart, innerEnd, outerEnd, outerStart, height, material, yBase = 0, castShadow = true, receiveShadow = true) {
            if(!innerStart || !innerEnd || !outerEnd || !outerStart || height <= 0) return null;
            const shape = new THREE.Shape();
            shape.moveTo(innerStart.x, innerStart.z);
            shape.lineTo(innerEnd.x, innerEnd.z);
            shape.lineTo(outerEnd.x, outerEnd.z);
            shape.lineTo(outerStart.x, outerStart.z);
            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                steps: 1,
                bevelEnabled: false,
                curveSegments: 1
            });
            // Meme convention d'orientation que la dalle pour eviter un retournement du contour ferme en 3D.
            geometry.rotateX(Math.PI / 2);
            geometry.computeVertexNormals();

            const mesh = makeShadowMesh(geometry, material, castShadow, receiveShadow);
            mesh.position.y = yBase + height;
            group.add(mesh);
            return mesh;
        }

        function createFilledPostMesh(group, segmentGroup, height, material) {
            const polygon = getSegmentGroupPolygonXZ(segmentGroup);
            if(!polygon || polygon.length < 3 || height <= 0) return null;

            const shape = new THREE.Shape();
            polygon.forEach((pt, index) => {
                if(index === 0) shape.moveTo(pt.x, pt.z);
                else shape.lineTo(pt.x, pt.z);
            });
            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: height,
                steps: 1,
                bevelEnabled: false,
                curveSegments: 1
            });
            geometry.rotateX(Math.PI / 2);
            geometry.computeVertexNormals();

            const mesh = makeShadowMesh(geometry, material, true, true);
            mesh.position.y = height;
            group.add(mesh);
            return mesh;
        }

        function createChamferedBoardGeometry(length, height, thickness, chamferSize) {
            const safeLength = Math.max(0.01, length);
            const safeHeight = Math.max(0.01, height);
            const safeThickness = Math.max(0.01, thickness);
            const maxChamfer = Math.min(safeHeight, safeThickness) * 0.49;
            const chamfer = Math.max(0.001, Math.min(chamferSize, maxChamfer));

            const halfH = safeHeight / 2;
            const halfT = safeThickness / 2;
            const shape = new THREE.Shape();

            shape.moveTo(-halfT + chamfer, -halfH);
            shape.lineTo(halfT - chamfer, -halfH);
            shape.lineTo(halfT, -halfH + chamfer);
            shape.lineTo(halfT, halfH - chamfer);
            shape.lineTo(halfT - chamfer, halfH);
            shape.lineTo(-halfT + chamfer, halfH);
            shape.lineTo(-halfT, halfH - chamfer);
            shape.lineTo(-halfT, -halfH + chamfer);
            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: safeLength,
                steps: 1,
                bevelEnabled: false,
                curveSegments: 1
            });

            geometry.translate(0, 0, -safeLength / 2);
            geometry.rotateY(Math.PI / 2);
            geometry.computeVertexNormals();
            return geometry;
        }

        function createChamferedPostGeometry(width, height, depth, chamferSize) {
            const safeWidth = Math.max(0.01, width);
            const safeHeight = Math.max(0.01, height);
            const safeDepth = Math.max(0.01, depth);
            const maxChamfer = Math.min(safeWidth, safeDepth) * 0.49;
            const chamfer = Math.max(0.001, Math.min(chamferSize, maxChamfer));

            const halfW = safeWidth / 2;
            const halfD = safeDepth / 2;
            const shape = new THREE.Shape();

            shape.moveTo(-halfW + chamfer, -halfD);
            shape.lineTo(halfW - chamfer, -halfD);
            shape.lineTo(halfW, -halfD + chamfer);
            shape.lineTo(halfW, halfD - chamfer);
            shape.lineTo(halfW - chamfer, halfD);
            shape.lineTo(-halfW + chamfer, halfD);
            shape.lineTo(-halfW, halfD - chamfer);
            shape.lineTo(-halfW, -halfD + chamfer);
            shape.closePath();

            const geometry = new THREE.ExtrudeGeometry(shape, {
                depth: safeHeight,
                steps: 1,
                bevelEnabled: false,
                curveSegments: 1
            });

            geometry.translate(0, 0, -safeHeight / 2);
            geometry.rotateX(-Math.PI / 2);
            geometry.computeVertexNormals();
            return geometry;
        }

        let archGroup;
        function build3DArch() {
            if(archGroup) (balconySceneGroup || scene).remove(archGroup);
            archGroup = new THREE.Group();
            const liveDrawingSegment = getLiveDrawingSegment();
            const primarySegments = getPrimaryContourSegments();
            const detachedSegments = getDetachedSegments();
            const contourPolygon = getClosedContourPointsXZ();
            const contourOrientationSign = Math.sign(getPolygonSignedAreaXZ(contourPolygon)) || 1;
            
            // Centrage TOUJOURS basé sur les segments (l'architecture est fixe)
            // Les jardinières se positionnent dans ce même référentiel
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            segments.forEach(s => {
                minX = Math.min(minX, s.p1.x, s.p2.x);
                maxX = Math.max(maxX, s.p1.x, s.p2.x);
                minY = Math.min(minY, s.p1.y, s.p2.y);
                maxY = Math.max(maxY, s.p1.y, s.p2.y);
            });
            if(liveDrawingSegment) {
                minX = Math.min(minX, liveDrawingSegment.p1.x, liveDrawingSegment.p2.x);
                maxX = Math.max(maxX, liveDrawingSegment.p1.x, liveDrawingSegment.p2.x);
                minY = Math.min(minY, liveDrawingSegment.p1.y, liveDrawingSegment.p2.y);
                maxY = Math.max(maxY, liveDrawingSegment.p1.y, liveDrawingSegment.p2.y);
            }
            
            if(!isFinite(minX)) {
                if(typeof refreshGroundGrid === 'function') refreshGroundGrid();
                return;
            }
            
            // Conversion cm vers unités THREE.js (1 unité = 10 cm)
            const wallH = archHeights.wall / 10;
            const windowBotH = archHeights.windowBot / 10;
            const windowTopH = archHeights.windowTop / 10;
            const glassBotH = archHeights.glassBot / 10;
            const glassTopH = archHeights.glassTop / 10;
            const railH = archHeights.rail / 10;
            const slabThickness = 1.5; // 15 cm: dalle béton standard de balcon
            const wallThickness = 0.4;
            const hasPrimaryClosedContour = (isContourClosed || isPrimaryContourClosedFor3D(primarySegments)) && primarySegments.length >= 3 && contourPolygon.length >= 3;
            const rawOuterContour = contourPolygon.length >= 3
                ? computeOffsetContourVertices(contourPolygon, wallThickness)
                : [];
            const outerContour = isUsableContourXZ(rawOuterContour) && rawOuterContour.length === contourPolygon.length
                ? rawOuterContour
                : [];

            // Dalle du balcon: extrusion du contour fermé vers l'axe normal négatif (Y-)
            if(hasPrimaryClosedContour) {
                const slabPoints = [];
                const slabContour = outerContour.length === contourPolygon.length && isUsableContourXZ(outerContour)
                    ? outerContour
                    : contourPolygon;
                slabContour.forEach((point) => {
                    slabPoints.push(new THREE.Vector2(point.x, point.z));
                });

                const slabShape = new THREE.Shape(slabPoints);
                const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
                    depth: slabThickness,
                    bevelEnabled: false
                });

                // Met le contour sur XZ et extrude vers le bas (Y négatif)
                slabGeo.rotateX(Math.PI / 2);
                slabGeo.translate(0, 0.002, 0); // surélève légèrement pour éviter z-fighting avec le sol global

                const slabMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(getSlabZoneColor('primary')),
                    roughness: 0.95,
                    metalness: 0.02,
                    side: THREE.DoubleSide,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2
                });

                const slab = makeShadowMesh(slabGeo, slabMat, true, true);
                archGroup.add(slab);

                if(archOptions.ceiling) {
                    const ceilingPoints = ceilingShapePoints.length >= 3
                        ? ceilingShapePoints.map(pt => new THREE.Vector2(pt.x / 20, pt.y / 20))
                        : slabPoints;
                    const ceilingShape = new THREE.Shape(ceilingPoints);
                    const ceilingGeo = new THREE.ExtrudeGeometry(ceilingShape, {
                        depth: slabThickness,
                        bevelEnabled: false
                    });
                    ceilingGeo.rotateX(Math.PI / 2);
                    ceilingGeo.translate(0, wallH + slabThickness, 0);
                    ceilingGeo.computeVertexNormals();
                    const ceilingMat = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(archColors.ceiling || '#d8d2c4'),
                        roughness: 0.96,
                        metalness: 0.0,
                        side: THREE.DoubleSide
                    });
                    const ceiling = makeShadowMesh(ceilingGeo, ceilingMat, true, true);
                    archGroup.add(ceiling);
                }
            }

            if(surfaces.length > 0) {
                surfaces.forEach(surface => {
                    if(!surface.points || surface.points.length < 3) return;
                    const shapePoints = surface.points.map(pt => new THREE.Vector2(pt.x / 20, pt.y / 20));
                    const shape = new THREE.Shape(shapePoints);
                    const geo = new THREE.ExtrudeGeometry(shape, {
                        depth: Math.max(0.1, surface.heightCm / 10),
                        bevelEnabled: false
                    });
                    geo.rotateX(Math.PI / 2);
                    geo.computeVertexNormals();
                    const mat = new THREE.MeshStandardMaterial({
                        color: new THREE.Color(surfaceMaterials[surface.material]?.color || '#999999'),
                        roughness: 0.8,
                        metalness: 0.1,
                        side: THREE.DoubleSide
                    });
                    const mesh = makeShadowMesh(geo, mat, true, true);
                    archGroup.add(mesh);
                });
            }

            const wallMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(archColors.wall) });
            const railMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(archColors.rail) });
            const glassMat = new THREE.MeshStandardMaterial({ color: 0xaaccff, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
            const windowSunState = getSunStateForHour(sunHour2d);
            const doorMat = new THREE.MeshStandardMaterial({ color: 0xc8a870, roughness: 0.78, metalness: 0.04 });
            const handleMat = new THREE.MeshStandardMaterial({ color: 0xd4a843, roughness: 0.25, metalness: 0.85 });

            function addDoorHandle(x1, z1, panelAngle, doorLen, doorOpenH) {
                const radius = 0.20;
                const handleH = Math.min(10.0, doorOpenH * 0.43);
                const dist = doorLen * 0.82;
                const perpX = -Math.sin(panelAngle);
                const perpZ = Math.cos(panelAngle);
                const off = 0.03 + radius;
                for(const side of [1, -1]) {
                    const geo = new THREE.SphereGeometry(radius, 10, 8);
                    const mesh = makeShadowMesh(geo, handleMat, false, true);
                    mesh.position.set(
                        x1 + Math.cos(panelAngle) * dist + perpX * side * off,
                        handleH,
                        z1 + Math.sin(panelAngle) * dist + perpZ * side * off
                    );
                    archGroup.add(mesh);
                }
            }

            function createBalconySlabMesh(contour, zoneId = 'primary') {
                if(!isUsableContourXZ(contour)) return null;
                const slabPoints = contour.map(point => new THREE.Vector2(point.x, point.z));
                const slabShape = new THREE.Shape(slabPoints);
                const slabGeo = new THREE.ExtrudeGeometry(slabShape, {
                    depth: slabThickness,
                    bevelEnabled: false
                });
                slabGeo.rotateX(Math.PI / 2);
                slabGeo.translate(0, 0.002, 0); // surélève légèrement pour éviter z-fighting avec le sol global
                const slabMat = new THREE.MeshStandardMaterial({
                    color: new THREE.Color(getSlabZoneColor(zoneId)),
                    roughness: 0.95,
                    metalness: 0.02,
                    side: THREE.DoubleSide,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2
                });
                const slab = makeShadowMesh(slabGeo, slabMat, true, true);
                archGroup.add(slab);
                return slab;
            }

            function pointInContourXZ(point, contour) {
                if(!point || !isUsableContourXZ(contour)) return false;
                let inside = false;
                for(let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
                    const a = contour[i];
                    const b = contour[j];
                    if(((a.z > point.z) !== (b.z > point.z)) &&
                        point.x < (b.x - a.x) * (point.z - a.z) / ((b.z - a.z) || 1e-9) + a.x) {
                        inside = !inside;
                    }
                }
                return inside;
            }

            function createWindowLightPatchMesh(points, opacity) {
                if(!Array.isArray(points) || points.length < 3) return null;
                const vertices = [];
                for(let i = 1; i < points.length - 1; i++) {
                    [points[0], points[i], points[i + 1]].forEach(point => {
                        vertices.push(point.x, point.y, point.z);
                    });
                }
                const positions = new Float32Array(vertices);
                const geometry = new THREE.BufferGeometry();
                geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                geometry.computeVertexNormals();
                const material = new THREE.MeshBasicMaterial({
                    color: 0xffedb2,
                    transparent: true,
                    opacity,
                    depthWrite: false,
                    side: THREE.DoubleSide,
                    blending: THREE.NormalBlending
                });
                const mesh = new THREE.Mesh(geometry, material);
                mesh.renderOrder = 8;
                mesh.userData.windowSunPatch = true;
                archGroup.add(mesh);
                return mesh;
            }

            function clipWindowFloorPatchToContour(points, contour, y) {
                if(!Array.isArray(points) || points.length < 3 || !isUsableContourXZ(contour)) return [];
                let clipped = points.map(point => ({ x: point.x, z: point.z }));
                const orientation = Math.sign(getPolygonSignedAreaXZ(contour)) || 1;
                const insideEdge = (point, a, b) => {
                    const cross = (b.x - a.x) * (point.z - a.z) - (b.z - a.z) * (point.x - a.x);
                    return orientation >= 0 ? cross >= -1e-6 : cross <= 1e-6;
                };
                const intersectEdge = (p1, p2, a, b) => {
                    const dx = p2.x - p1.x;
                    const dz = p2.z - p1.z;
                    const sx = b.x - a.x;
                    const sz = b.z - a.z;
                    const denom = dx * sz - dz * sx;
                    if(Math.abs(denom) < 1e-8) return p2;
                    const t = ((a.x - p1.x) * sz - (a.z - p1.z) * sx) / denom;
                    return { x: p1.x + dx * t, z: p1.z + dz * t };
                };

                for(let i = 0; i < contour.length && clipped.length >= 3; i++) {
                    const a = contour[i];
                    const b = contour[(i + 1) % contour.length];
                    const input = clipped;
                    clipped = [];
                    for(let j = 0; j < input.length; j++) {
                        const current = input[j];
                        const previous = input[(j - 1 + input.length) % input.length];
                        const currentInside = insideEdge(current, a, b);
                        const previousInside = insideEdge(previous, a, b);
                        if(currentInside) {
                            if(!previousInside) clipped.push(intersectEdge(previous, current, a, b));
                            clipped.push(current);
                        } else if(previousInside) {
                            clipped.push(intersectEdge(previous, current, a, b));
                        }
                    }
                }

                return clipped.map(point => new THREE.Vector3(point.x, y, point.z));
            }

            function getRaySegmentIntersectionXZ(origin, dir, a, b) {
                const sx = b.x - a.x;
                const sz = b.z - a.z;
                const denom = dir.x * sz - dir.z * sx;
                if(Math.abs(denom) < 1e-8) return null;
                const ax = a.x - origin.x;
                const az = a.z - origin.z;
                const t = (ax * sz - az * sx) / denom;
                const u = (ax * dir.z - az * dir.x) / denom;
                return { t, u };
            }

            function getInteriorNormalForEdge(a, b, contour) {
                const dx = b.x - a.x;
                const dz = b.z - a.z;
                const len = Math.hypot(dx, dz);
                if(len < 0.001) return { x: 0, z: 0 };
                const nx = -dz / len;
                const nz = dx / len;
                const mid = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
                const test = { x: mid.x + nx * 0.15, z: mid.z + nz * 0.15 };
                return pointInContourXZ(test, contour) ? { x: nx, z: nz } : { x: -nx, z: -nz };
            }

            function clipWindowWallPatchToRect(points, minU, maxU, minY, maxY) {
                if(!Array.isArray(points) || points.length < 3) return [];
                const clipAgainst = (input, inside, intersect) => {
                    const output = [];
                    for(let i = 0; i < input.length; i++) {
                        const current = input[i];
                        const previous = input[(i - 1 + input.length) % input.length];
                        const currentInside = inside(current);
                        const previousInside = inside(previous);
                        if(currentInside) {
                            if(!previousInside) output.push(intersect(previous, current));
                            output.push(current);
                        } else if(previousInside) {
                            output.push(intersect(previous, current));
                        }
                    }
                    return output;
                };
                let clipped = points.slice();
                clipped = clipAgainst(
                    clipped,
                    point => point.u >= minU,
                    (a, b) => {
                        const t = (minU - a.u) / ((b.u - a.u) || 1e-9);
                        return { u: minU, y: a.y + (b.y - a.y) * t };
                    }
                );
                clipped = clipAgainst(
                    clipped,
                    point => point.u <= maxU,
                    (a, b) => {
                        const t = (maxU - a.u) / ((b.u - a.u) || 1e-9);
                        return { u: maxU, y: a.y + (b.y - a.y) * t };
                    }
                );
                clipped = clipAgainst(
                    clipped,
                    point => point.y >= minY,
                    (a, b) => {
                        const t = (minY - a.y) / ((b.y - a.y) || 1e-9);
                        return { u: a.u + (b.u - a.u) * t, y: minY };
                    }
                );
                clipped = clipAgainst(
                    clipped,
                    point => point.y <= maxY,
                    (a, b) => {
                        const t = (maxY - a.y) / ((b.y - a.y) || 1e-9);
                        return { u: a.u + (b.u - a.u) * t, y: maxY };
                    }
                );
                return clipped;
            }

            function addWindowSunWallPatch(aperture, lightDir, transmission, floorContour) {
                if(!isUsableContourXZ(floorContour)) return null;
                const created = [];
                for(let i = 0; i < floorContour.length; i++) {
                    const a = floorContour[i];
                    const b = floorContour[(i + 1) % floorContour.length];
                    const projected = [];
                    let hasForwardHit = false;
                    for(const corner of aperture) {
                        const hit = getRaySegmentIntersectionXZ(corner, lightDir, a, b);
                        if(!hit || hit.t <= 0.08) continue;
                        const y = corner.y + lightDir.y * hit.t;
                        projected.push({ u: hit.u, y });
                        if(hit.u >= -0.05 && hit.u <= 1.05 && y >= -0.2 && y <= wallH + 0.2) {
                            hasForwardHit = true;
                        }
                    }
                    if(projected.length < 3 || !hasForwardHit) continue;

                    const clipped = clipWindowWallPatchToRect(projected, 0, 1, 0.04, wallH - 0.04);
                    if(clipped.length < 3) continue;

                    const normal = getInteriorNormalForEdge(a, b, floorContour);
                    const edgeDx = b.x - a.x;
                    const edgeDz = b.z - a.z;
                    const wallPoints = clipped.map(point => new THREE.Vector3(
                        a.x + edgeDx * point.u + normal.x * 0.045,
                        point.y,
                        a.z + edgeDz * point.u + normal.z * 0.045
                    ));
                    const mesh = createWindowLightPatchMesh(
                        wallPoints,
                        Math.max(0.16, Math.min(0.40, transmission * 0.34))
                    );
                    if(mesh) created.push(mesh);
                }
                return created[0] || null;
            }

            function addWindowSunPatch(start, end, bottomY, topY, transmission = 0.75, floorContour = contourPolygon) {
                if(!windowSunState || !windowSunState.daylight || !start || !end || !isUsableContourXZ(floorContour)) return null;
                const height = topY - bottomY;
                const len = Math.hypot(end.x - start.x, end.z - start.z);
                if(height <= 0.05 || len <= 0.05) return null;

                const sunPosition = windowSunState.position;
                const aperture = [
                    new THREE.Vector3(start.x, bottomY, start.z),
                    new THREE.Vector3(end.x, bottomY, end.z),
                    new THREE.Vector3(end.x, topY, end.z),
                    new THREE.Vector3(start.x, topY, start.z)
                ];
                const center = aperture.reduce((acc, pt) => acc.add(pt), new THREE.Vector3()).multiplyScalar(0.25);
                const lightDir = center.clone().sub(sunPosition);
                if(lightDir.lengthSq() <= 0.000001) return null;
                lightDir.normalize();
                if(lightDir.y >= -0.015) return null;

                const floorY = 0.045;
                const projected = [];
                for(const corner of aperture) {
                    const t = (floorY - corner.y) / lightDir.y;
                    if(t <= 0) return null;
                    const pt = corner.clone().addScaledVector(lightDir, t);
                    pt.y = floorY;
                    projected.push(pt);
                }

                const clippedFloorPatch = clipWindowFloorPatchToContour(projected, floorContour, floorY);
                const floorPatch = clippedFloorPatch.length >= 3
                    ? createWindowLightPatchMesh(clippedFloorPatch, Math.max(0.10, Math.min(0.30, transmission * 0.24)))
                    : null;
                const wallPatch = addWindowSunWallPatch(aperture, lightDir, transmission, floorContour);
                return floorPatch || wallPatch;
            }

            function getSegmentEndsFromBox(len, angle, cx, cz) {
                const half = len / 2;
                const dx = Math.cos(angle) * half;
                const dz = Math.sin(angle) * half;
                return {
                    start: { x: cx - dx, z: cz - dz },
                    end: { x: cx + dx, z: cz + dz }
                };
            }

            function renderContourWallSegment(s, innerStart, innerEnd, outerStart, outerEnd, floorContour = contourPolygon) {
                if(!s || s.sharedContourEdge || !innerStart || !innerEnd || !outerStart || !outerEnd) return;

                if(s.type === 'window') {
                    const partH1 = windowBotH;
                    if(partH1 > 0) createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH1, wallMat, 0);
                    const windowGlassH = windowTopH - windowBotH;
                    if(windowGlassH > 0) {
                        createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, windowGlassH, glassMat, windowBotH);
                        addWindowSunPatch(innerStart, innerEnd, windowBotH, windowTopH, 0.75, floorContour);
                    }
                    const partH2 = wallH - windowTopH;
                    if(partH2 > 0) {
                        createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH2, wallMat, windowTopH);
                    }
                    return;
                }

                if(s.type === 'glass') {
                    const glassH = glassTopH - glassBotH;
                    if(glassH > 0) {
                        createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, glassH, glassMat, glassBotH);
                        addWindowSunPatch(innerStart, innerEnd, glassBotH, glassTopH, 0.75, floorContour);
                    }
                    const partH = wallH - glassTopH;
                    if(partH > 0) {
                        createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH, wallMat, glassTopH);
                    }
                    return;
                }

                if(s.type === 'door') {
                    const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                    const lintelH = wallH - doorOpenH;
                    if(lintelH > 0) createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, lintelH, wallMat, doorOpenH);
                    const doorLen = Math.hypot(innerEnd.x - innerStart.x, innerEnd.z - innerStart.z);
                    if(doorLen > 0.05) {
                        const wallAngle = Math.atan2(innerEnd.z - innerStart.z, innerEnd.x - innerStart.x);
                        const ajar = 15 * Math.PI / 180;
                        const swingSign = s.swing === 'right' ? 1 : -1;
                        const panelAngle = wallAngle + swingSign * ajar;
                        const panelCx = innerStart.x + Math.cos(panelAngle) * doorLen / 2;
                        const panelCz = innerStart.z + Math.sin(panelAngle) * doorLen / 2;
                        addOrientedBox(archGroup, doorLen, doorOpenH, 0.06, doorMat, panelCx, doorOpenH / 2, panelCz, panelAngle);
                        addDoorHandle(innerStart.x, innerStart.z, panelAngle, doorLen, doorOpenH);
                    }
                    return;
                }

                const railType = archOptions.railType || (archOptions.railBars ? 'bars' : 'low-wall');
                const h = s.type === 'rail' ? railH : (s.type === 'wall' ? wallH : 0);
                const mat = s.type === 'rail' ? railMat : wallMat;
                if(h <= 0) return;
                if(s.type === 'rail') {
                    renderRailSegment(archGroup, innerStart, innerEnd, outerStart, outerEnd, h, wallThickness, railMat, glassMat, railType);
                } else {
                    createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, h, mat, 0, true, true);
                }
            }

            if(hasPrimaryClosedContour && outerContour.length === contourPolygon.length && isUsableContourXZ(outerContour)) {
                if(balconyDesignMode === 'exterieur') {
                    // En mode extérieur, la dalle est suffisante. Aucune maçonnerie ni garde-corps supplémentaire.
                } else {
                    primarySegments.forEach((s, index) => {
                        const innerStart = contourPolygon[index];
                        const innerEnd = contourPolygon[(index + 1) % contourPolygon.length];
                        const outerStart = outerContour[index];
                        const outerEnd = outerContour[(index + 1) % outerContour.length];

                        if(!innerStart || !innerEnd || !outerStart || !outerEnd) return;

                        if(s.type === 'window') {
                            const partH1 = windowBotH;
                            if(partH1 > 0) createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH1, wallMat, 0);
                            const windowGlassH = windowTopH - windowBotH;
                            if(windowGlassH > 0) {
                                createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, windowGlassH, glassMat, windowBotH);
                                addWindowSunPatch(innerStart, innerEnd, windowBotH, windowTopH, 0.75, contourPolygon);
                            }
                            const partH2 = wallH - windowTopH;
                            if(partH2 > 0) {
                                createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH2, wallMat, windowTopH);
                            }
                            return;
                        }

                        if(s.type === 'glass') {
                            const glassH = glassTopH - glassBotH;
                            if(glassH > 0) {
                                createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, glassH, glassMat, glassBotH);
                                addWindowSunPatch(innerStart, innerEnd, glassBotH, glassTopH, 0.75, contourPolygon);
                            }
                            const partH = wallH - glassTopH;
                            if(partH > 0) {
                                createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, partH, wallMat, glassTopH);
                            }
                            return;
                        }

                        if(s.type === 'door') {
                            const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                            const lintelH = wallH - doorOpenH;
                            if(lintelH > 0) createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, lintelH, wallMat, doorOpenH);
                            const doorLen = Math.hypot(innerEnd.x - innerStart.x, innerEnd.z - innerStart.z);
                            if(doorLen > 0.05) {
                                const wallAngle = Math.atan2(innerEnd.z - innerStart.z, innerEnd.x - innerStart.x);
                                const ajar = 15 * Math.PI / 180;
                                const swingSign = s.swing === 'right' ? 1 : -1;
                                const panelAngle = wallAngle + swingSign * ajar;
                                const panelCx = innerStart.x + Math.cos(panelAngle) * doorLen / 2;
                                const panelCz = innerStart.z + Math.sin(panelAngle) * doorLen / 2;
                                addOrientedBox(archGroup, doorLen, doorOpenH, 0.06, doorMat, panelCx, doorOpenH / 2, panelCz, panelAngle);
                                addDoorHandle(innerStart.x, innerStart.z, panelAngle, doorLen, doorOpenH);
                            }
                            return;
                        }

                        const railType = archOptions.railType || (archOptions.railBars ? 'bars' : 'low-wall');
                        const h = s.type === 'rail' ? railH : (s.type === 'wall' ? wallH : 0);
                        const mat = s.type === 'rail' ? railMat : wallMat;
                        if(h > 0) {
                            if(s.type === 'rail') {
                                renderRailSegment(archGroup, innerStart, innerEnd, outerStart, outerEnd, h, wallThickness, railMat, glassMat, railType);
                            } else {
                                createWallBandMesh(archGroup, innerStart, innerEnd, outerEnd, outerStart, h, mat, 0, true, true);
                            }
                        }
                    });
                }
            } else if(typeof renderArchitecture === 'undefined' || renderArchitecture) {
                primarySegments.forEach((s, index) => {
                    const outerSegment = buildOuterWallSegment(index, wallThickness, contourPolygon, contourOrientationSign, primarySegments);
                    if(!outerSegment) return;
                    const { len, angle, cx: outerCx, cz: outerCz } = outerSegment;

                    if(s.type === 'window') {
                        const partH1 = windowBotH;
                        if(partH1 > 0) addOrientedBox(archGroup, len, partH1, wallThickness, wallMat, outerCx, partH1 / 2, outerCz, angle);
                        const windowGlassH = windowTopH - windowBotH;
                        if(windowGlassH > 0) {
                            addOrientedBox(archGroup, len, windowGlassH, wallThickness, glassMat, outerCx, windowBotH + windowGlassH / 2, outerCz, angle);
                            const ends = getSegmentEndsFromBox(len, angle, outerCx, outerCz);
                            addWindowSunPatch(ends.start, ends.end, windowBotH, windowTopH, 0.75, contourPolygon);
                        }
                        const partH2 = wallH - windowTopH;
                        if(partH2 > 0) {
                            addOrientedBox(archGroup, len, partH2, wallThickness, wallMat, outerCx, windowTopH + partH2 / 2, outerCz, angle);
                        }
                        return;
                    } else if(s.type === 'glass') {
                        const glassH = glassTopH - glassBotH;
                        if(glassH > 0) {
                            addOrientedBox(archGroup, len, glassH, wallThickness, glassMat, outerCx, glassBotH + glassH / 2, outerCz, angle);
                            const ends = getSegmentEndsFromBox(len, angle, outerCx, outerCz);
                            addWindowSunPatch(ends.start, ends.end, glassBotH, glassTopH, 0.75, contourPolygon);
                        }
                        const partH = wallH - glassTopH;
                        if(partH > 0) {
                            addOrientedBox(archGroup, len, partH, wallThickness, wallMat, outerCx, glassTopH + partH / 2, outerCz, angle);
                        }
                        return;
                    } else if(s.type === 'door') {
                        const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                        const lintelH = wallH - doorOpenH;
                        if(lintelH > 0) addOrientedBox(archGroup, len, lintelH, wallThickness, wallMat, outerCx, doorOpenH + lintelH / 2, outerCz, angle);
                        if(len > 0.05) {
                            const x1 = s.p1.x / 20, z1 = s.p1.y / 20;
                            const ajar = 15 * Math.PI / 180;
                            const swingSign = s.swing === 'right' ? 1 : -1;
                            const panelAngle = angle + swingSign * ajar;
                            const panelCx = x1 + Math.cos(panelAngle) * len / 2;
                            const panelCz = z1 + Math.sin(panelAngle) * len / 2;
                            addOrientedBox(archGroup, len, doorOpenH, 0.06, doorMat, panelCx, doorOpenH / 2, panelCz, panelAngle);
                            addDoorHandle(x1, z1, panelAngle, len, doorOpenH);
                        }
                        return;
                    }

                    const railType = archOptions.railType || (archOptions.railBars ? 'bars' : 'low-wall');
                    const h = s.type === 'rail' ? railH : (s.type === 'wall' ? wallH : 0);
                    const mat = s.type === 'rail' ? railMat : wallMat;
                    if(h > 0) {
                        if(s.type === 'rail') {
                            const start = { x: outerCx - Math.cos(angle) * len / 2, z: outerCz - Math.sin(angle) * len / 2 };
                            const end = { x: outerCx + Math.cos(angle) * len / 2, z: outerCz + Math.sin(angle) * len / 2 };
                            renderRailSegment(archGroup, start, end, null, null, h, wallThickness, railMat, glassMat, railType, len, angle, outerCx, outerCz);
                        } else {
                            addOrientedBox(archGroup, len, h, wallThickness, mat, outerCx, h / 2, outerCz, angle, true, true);
                        }
                    }
                });
            }

            if(detachedSegments.length > 0) {
                getDetachedSegmentGroups().forEach((segmentGroup) => {
                    if(isPostSegmentGroup(segmentGroup) && isSegmentGroupClosed(segmentGroup)) {
                        createFilledPostMesh(archGroup, segmentGroup, wallH, wallMat);
                        return;
                    }

                    const detachedPolygon = getSegmentGroupPolygonXZ(segmentGroup);
                    const detachedRawOuter = isUsableContourXZ(detachedPolygon)
                        ? computeOffsetContourVertices(detachedPolygon, wallThickness)
                        : [];
                    const detachedSlabEdgeModes = segmentGroup.map(s => s && s.sharedContourEdge ? 'inward' : 'outward');
                    const detachedRawSlabContour = isUsableContourXZ(detachedPolygon)
                        ? computeOffsetContourVerticesWithEdgeModes(detachedPolygon, wallThickness, detachedSlabEdgeModes)
                        : [];
                    const detachedOuter = isUsableContourXZ(detachedRawOuter) && detachedRawOuter.length === detachedPolygon.length
                        ? detachedRawOuter
                        : [];
                    const detachedSlabContour = isUsableContourXZ(detachedRawSlabContour) && detachedRawSlabContour.length === detachedPolygon.length
                        ? detachedRawSlabContour
                        : [];

                    if(isUsableContourXZ(detachedPolygon)) {
                        const hasUsableDetachedOuter = detachedOuter.length === detachedPolygon.length && isUsableContourXZ(detachedOuter);
                        const hasUsableSlabContour = detachedSlabContour.length === detachedPolygon.length && isUsableContourXZ(detachedSlabContour);
                        const slabContour = hasUsableSlabContour ? detachedSlabContour : (hasUsableDetachedOuter ? detachedOuter : detachedPolygon);
                        createBalconySlabMesh(slabContour, segmentGroup[0] && segmentGroup[0].sketchId);
                        if(hasUsableDetachedOuter || hasUsableSlabContour) {
                            const wallOuter = hasUsableSlabContour ? detachedSlabContour : detachedOuter;
                            segmentGroup.forEach((s, index) => {
                                if(s.sharedContourEdge) return;
                                renderContourWallSegment(
                                    s,
                                    detachedPolygon[index],
                                    detachedPolygon[(index + 1) % detachedPolygon.length],
                                    wallOuter[index],
                                    wallOuter[(index + 1) % wallOuter.length],
                                    slabContour
                                );
                            });
                            return;
                        }
                    }

                    segmentGroup.forEach((s, index) => {
                        if(s.sharedContourEdge) return;
                        const outerSegment = buildOuterWallSegment(index, wallThickness, detachedPolygon, Math.sign(getPolygonSignedAreaXZ(detachedPolygon)) || 1, segmentGroup);
                        if(!outerSegment) return;
                        const { len, angle, cx: outerCx, cz: outerCz } = outerSegment;

                        if(s.type === 'window') {
                            const partH1 = windowBotH;
                            if(partH1 > 0) addOrientedBox(archGroup, len, partH1, wallThickness, wallMat, outerCx, partH1 / 2, outerCz, angle);
                            const windowGlassH = windowTopH - windowBotH;
                            if(windowGlassH > 0) {
                                addOrientedBox(archGroup, len, windowGlassH, wallThickness, glassMat, outerCx, windowBotH + windowGlassH / 2, outerCz, angle);
                                const ends = getSegmentEndsFromBox(len, angle, outerCx, outerCz);
                                addWindowSunPatch(ends.start, ends.end, windowBotH, windowTopH, 0.75, detachedPolygon);
                            }
                            const partH2 = wallH - windowTopH;
                            if(partH2 > 0) {
                                addOrientedBox(archGroup, len, partH2, wallThickness, wallMat, outerCx, windowTopH + partH2 / 2, outerCz, angle);
                            }
                            return;
                        }
                        if(s.type === 'glass') {
                            const glassH = glassTopH - glassBotH;
                            if(glassH > 0) {
                                addOrientedBox(archGroup, len, glassH, wallThickness, glassMat, outerCx, glassBotH + glassH / 2, outerCz, angle);
                                const ends = getSegmentEndsFromBox(len, angle, outerCx, outerCz);
                                addWindowSunPatch(ends.start, ends.end, glassBotH, glassTopH, 0.75, detachedPolygon);
                            }
                            const partH = wallH - glassTopH;
                            if(partH > 0) {
                                addOrientedBox(archGroup, len, partH, wallThickness, wallMat, outerCx, glassTopH + partH / 2, outerCz, angle);
                            }
                            return;
                        }
                        if(s.type === 'door') {
                            const doorOpenH = Math.min(wallH * 0.92, wallH - 0.1);
                            const lintelH = wallH - doorOpenH;
                            if(lintelH > 0) addOrientedBox(archGroup, len, lintelH, wallThickness, wallMat, outerCx, doorOpenH + lintelH / 2, outerCz, angle);
                            if(len > 0.05) {
                                const x1 = s.p1.x / 20, z1 = s.p1.y / 20;
                                const ajar = 15 * Math.PI / 180;
                                const swingSign = s.swing === 'right' ? 1 : -1;
                                const panelAngle = angle + swingSign * ajar;
                                const panelCx = x1 + Math.cos(panelAngle) * len / 2;
                                const panelCz = z1 + Math.sin(panelAngle) * len / 2;
                                addOrientedBox(archGroup, len, doorOpenH, 0.06, doorMat, panelCx, doorOpenH / 2, panelCz, panelAngle);
                                addDoorHandle(x1, z1, panelAngle, len, doorOpenH);
                            }
                            return;
                        }

                        const railType = archOptions.railType || (archOptions.railBars ? 'bars' : 'low-wall');
                        const h = s.type === 'rail' ? railH : (s.type === 'wall' ? wallH : 0);
                        const mat = s.type === 'rail' ? railMat : wallMat;
                        if(h > 0) {
                            if(s.type === 'rail') {
                                const start = { x: outerCx - Math.cos(angle) * len / 2, z: outerCz - Math.sin(angle) * len / 2 };
                                const end = { x: outerCx + Math.cos(angle) * len / 2, z: outerCz + Math.sin(angle) * len / 2 };
                                renderRailSegment(archGroup, start, end, null, null, h, wallThickness, railMat, glassMat, railType, len, angle, outerCx, outerCz);
                            } else {
                                addOrientedBox(archGroup, len, h, wallThickness, mat, outerCx, h / 2, outerCz, angle, true, true);
                            }
                        }
                    });
                });
            }

            if(liveDrawingSegment) {
                renderLiveDrawingWall(archGroup, liveDrawingSegment, {
                    wall: wallMat,
                    rail: railMat,
                    glass: glassMat,
                    door: doorMat
                }, wallThickness);
            }

            jardinières.forEach(j => {
                const y = getSurfaceHeightAtPosition(j.pos.x, j.pos.z);
                j.group.position.set(j.pos.x, y, j.pos.z);
            });
            
            (balconySceneGroup || scene).add(archGroup);
            if(typeof refreshGroundGrid === 'function') refreshGroundGrid();
            markSolarMapDirty();
            markVisAVisDirty();
            if(typeof scheduleNeighborhoodCutoutRebuild === 'function') scheduleNeighborhoodCutoutRebuild();
        }

        function renderCurrent3DFrame() {
            if(!renderer || !scene || !camera) return;
            if(activeMainView !== '3d' && activeMainView !== 'mixte') return;
            if(camera.layers && typeof camera.layers.enable === 'function') camera.layers.enable(1);

            const w = renderer.domElement.clientWidth;
            const h = renderer.domElement.clientHeight;
            if(w <= 0 || h <= 0) return;

            updateCameraInteriorNavigationMode();
            if(controls) controls.update();
            renderer.setViewport(0, 0, w, h);
            renderer.render(scene, camera);
        }

        function refreshArchitectureNow() {
            build3DArch();
            updateJard3DHighlight();
            updateCollisionBanner();
            draw2D();
            const currentView = activeMainView;
            if(currentView === '3d' || currentView === 'mixte') {
                setMainView(currentView, { skipValidation: true });
            } else {
                renderCurrent3DFrame();
            }

            requestAnimationFrame(() => {
                if(currentView === '3d' || currentView === 'mixte') {
                    setMainView(currentView, { skipValidation: true });
                } else {
                    renderCurrent3DFrame();
                }
            });
        }
        
        function updateHeightValue(type, value) {
            saveState();
            if(type === 'wall') archHeights.wall = parseInt(value);
            else if(type === 'window-bot') archHeights.windowBot = parseInt(value);
            else if(type === 'window-top') archHeights.windowTop = parseInt(value);
            else if(type === 'glass-bot') archHeights.glassBot = parseInt(value);
            else if(type === 'glass-top') archHeights.glassTop = parseInt(value);
            else if(type === 'rail') archHeights.rail = parseInt(value);
            build3DArch();
        }

        function normalizeSlabZoneId(zoneId) {
            return zoneId || 'primary';
        }

        function getSlabZoneColor(zoneId) {
            const id = normalizeSlabZoneId(zoneId);
            return slabZoneColors[id] || archColors.slab || '#9a9a9a';
        }

        function updateSlabColorControl(color = getSlabZoneColor(selectedSlabZoneId || 'primary')) {
            const input = document.getElementById('input-slab-color');
            if(input) input.value = color;
            updateArchPaletteUI('slab', color);
        }

        function setSelectedSlabZone(zoneId, options = {}) {
            const { redraw = true } = options;
            selectedSlabZoneId = zoneId ? normalizeSlabZoneId(zoneId) : null;
            updateSlabColorControl(getSlabZoneColor(selectedSlabZoneId || 'primary'));
            if(redraw) draw2D();
        }

        function setSlabZoneColor(zoneId, color) {
            const id = normalizeSlabZoneId(zoneId);
            slabZoneColors[id] = color;
            if(id === 'primary') archColors.slab = color;
        }

        function updateArchColor(type, value) {
            saveState();
            if(type === 'wall' || type === 'slab' || type === 'rail' || type === 'ceiling') {
                if(type === 'slab') {
                    setSlabZoneColor(selectedSlabZoneId || 'primary', value);
                    updateSlabColorControl(value);
                } else {
                    archColors[type] = value;
                    updateArchPaletteUI(type, value);
                }
                build3DArch();
                draw2D();
            }
        }

        function toggleColorPopover(id) {
            const target = document.getElementById(id);
            if(!target) return;
            const willOpen = !target.classList.contains('visible');
            document.querySelectorAll('.color-popover.visible').forEach(pop => {
                if(pop !== target) {
                    pop.classList.remove('visible');
                    pop.style.position = '';
                    pop.style.left = '';
                    pop.style.right = '';
                    pop.style.top = '';
                    pop.style.bottom = '';
                }
            });
            target.classList.toggle('visible', willOpen);
            if(willOpen) {
                const trigger = target.parentElement ? target.parentElement.querySelector('.color-chip-btn') : null;
                const rect = trigger ? trigger.getBoundingClientRect() : target.getBoundingClientRect();
                const width = Math.max(168, target.offsetWidth || 148);
                const height = Math.max(150, target.offsetHeight || 150);
                const preferTop = rect.bottom + height + 8 > window.innerHeight;
                const top = preferTop ? rect.top - height - 8 : rect.bottom + 6;
                target.style.position = 'fixed';
                target.style.left = Math.min(window.innerWidth - width - 8, Math.max(8, rect.left)) + 'px';
                target.style.right = 'auto';
                target.style.top = Math.min(window.innerHeight - height - 8, Math.max(8, top)) + 'px';
                target.style.bottom = 'auto';
            } else if(!willOpen) {
                target.style.position = '';
                target.style.left = '';
                target.style.right = '';
                target.style.top = '';
                target.style.bottom = '';
            }
        }

        document.addEventListener('click', (event) => {
            if(event.target.closest && event.target.closest('.color-popover-wrap')) return;
            document.querySelectorAll('.color-popover.visible').forEach(pop => {
                pop.classList.remove('visible');
                pop.style.position = '';
                pop.style.left = '';
                pop.style.right = '';
                pop.style.top = '';
                pop.style.bottom = '';
            });
        });

        function setColorChip(buttonId, color) {
            const btn = document.getElementById(buttonId);
            if(btn) btn.style.setProperty('--chip-color', color || '#8d7d68');
        }

        function setArchColorPreset(type, color) {
            const inputId = type === 'ceiling' ? 'input-ceiling-color' : `input-${type}-color`;
            const input = document.getElementById(inputId);
            if(input) input.value = color;
            updateArchColor(type, color);
        }

        function updateArchPaletteUI(type, color) {
            setColorChip(`arch-color-toggle-${type}`, color);
            const palette = document.querySelector(`[data-arch-palette="${type}"]`);
            if(!palette) return;
            const normalized = document.createElement('span');
            normalized.style.color = color;
            document.body.appendChild(normalized);
            const selectedColor = getComputedStyle(normalized).color.toLowerCase();
            normalized.remove();
            palette.querySelectorAll('.wood-swatch').forEach(btn => {
                const swatchColor = (btn.style.backgroundColor || '').toLowerCase();
                btn.classList.toggle('active', swatchColor === selectedColor);
            });
        }

        function updateArchPalettesUI() {
            ['wall', 'slab', 'ceiling', 'rail'].forEach(type => {
                updateArchPaletteUI(type, type === 'slab' ? getSlabZoneColor(selectedSlabZoneId || 'primary') : archColors[type]);
            });
        }

        function updateCeilingColor(value) {
            updateArchColor('ceiling', value || '#d8d2c4');
        }

        function updateCeilingEnabled(enabled) {
            saveState();
            archOptions.ceiling = !!enabled;
            const ceilingInput = document.getElementById('input-ceiling');
            if(ceilingInput) ceilingInput.checked = archOptions.ceiling;
            const ceilingBtn = document.getElementById('btn-ceiling');
            if(ceilingBtn) ceilingBtn.classList.toggle('active', archOptions.ceiling);
            if(!archOptions.ceiling) {
                currentCeilingPoints = [];
                currentPoint = drawingMode === 'ceiling-shape' ? null : currentPoint;
            }
            build3DArch();
            renderCurrent3DFrame();
            draw2D();
        }

        function toggleCeilingTool() {
            updateCeilingEnabled(!archOptions.ceiling);
        }

        function setRailBarsEnabled(enabled) {
            saveState();
            archOptions.railBars = !!enabled;
            if(archOptions.railBars) archOptions.railType = 'bars';
            build3DArch();
            draw2D();
            const railTypeSelect = document.getElementById('input-rail-type');
            if(railTypeSelect) railTypeSelect.value = archOptions.railType;
        }

        function updateRailType(value) {
            saveState();
            archOptions.railType = value;
            archOptions.railBars = value === 'bars';
            build3DArch();
            draw2D();
        }

        function updateRailBarSpacing(value) {
            saveState();
            archOptions.railBarSpacing = Math.max(8, Math.min(30, parseInt(value, 10) || 12));
            build3DArch();
            draw2D();
        }

        function renderRailSegment(group, innerStart, innerEnd, outerStart, outerEnd, height, wallThickness, railMat, glassMat, railType, lenOverride, angleOverride, cxOverride, czOverride) {
            const type = railType || 'low-wall';
            if(type === 'low-wall') {
                if(innerStart && innerEnd && outerStart && outerEnd) {
                    createWallBandMesh(group, innerStart, innerEnd, outerEnd, outerStart, height, railMat, 0, true, true);
                } else if(lenOverride !== undefined) {
                    addOrientedBox(group, lenOverride, height, wallThickness, railMat, cxOverride, height / 2, czOverride, angleOverride, true, true);
                }
                return;
            }

            if(type === 'glass') {
                if(innerStart && innerEnd && outerStart && outerEnd) {
                    createWallBandMesh(group, innerStart, innerEnd, outerEnd, outerStart, height, glassMat, 0, true, true);
                } else if(lenOverride !== undefined) {
                    addOrientedBox(group, lenOverride, height, Math.max(0.12, wallThickness * 0.35), glassMat, cxOverride, height / 2, czOverride, angleOverride, true, true);
                }
                return;
            }

            const midStart = innerStart && outerStart ? { x: (innerStart.x + outerStart.x) / 2, z: (innerStart.z + outerStart.z) / 2 } : null;
            const midEnd = innerEnd && outerEnd ? { x: (innerEnd.x + outerEnd.x) / 2, z: (innerEnd.z + outerEnd.z) / 2 } : null;
            const startPoint = midStart || { x: cxOverride - Math.cos(angleOverride) * lenOverride / 2, z: czOverride - Math.sin(angleOverride) * lenOverride / 2 };
            const endPoint = midEnd || { x: cxOverride + Math.cos(angleOverride) * lenOverride / 2, z: czOverride + Math.sin(angleOverride) * lenOverride / 2 };
            const dx = endPoint.x - startPoint.x;
            const dz = endPoint.z - startPoint.z;
            const len = lenOverride !== undefined ? lenOverride : Math.sqrt(dx*dx + dz*dz);
            const angle = angleOverride !== undefined ? angleOverride : Math.atan2(dz, dx);
            const panelDepth = Math.max(0.08, wallThickness * 0.25);
            const centerX = startPoint.x + dx / 2;
            const centerZ = startPoint.z + dz / 2;

            if(type === 'panel') {
                addOrientedBox(group, len, height, panelDepth, railMat, centerX, height / 2, centerZ, angle, true, true);
                return;
            }

            if(type === 'bars') {
                addRailBarsToSegment(group, startPoint, endPoint, height, wallThickness, railMat, archOptions.railBarSpacing);
                return;
            }

            if(type === 'horizontal-rails') {
                addHorizontalRailLinesToSegment(group, startPoint, endPoint, height, railMat);
                return;
            }
        }

        function addHorizontalRailLinesToSegment(group, start, end, railH, railMat) {
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 0.5) return;

            const angle = Math.atan2(dz, dx);
            const scaleH = railH / 11; // Reference dessin: 110 cm.
            const depth = 0.4;
            const topHandrailH = 1.0 * scaleH; // 10 cm
            const thinRailH = 0.2 * scaleH; // 2 cm
            const topGap = 2.7 * scaleH; // 27 cm sous main courante
            const gap = 1.1 * scaleH; // 11 cm entre lisses et au sol
            const postSize = 0.4;
            const postSpacing = 12; // 120 cm
            const centerX = (start.x + end.x) / 2;
            const centerZ = (start.z + end.z) / 2;

            addOrientedBox(group, len, topHandrailH, depth, railMat, centerX, railH - topHandrailH / 2, centerZ, angle, true, true);

            let cursorTop = railH - topHandrailH - topGap;
            for(let i = 0; i < 5; i++) {
                const centerY = cursorTop - thinRailH / 2;
                if(centerY > 0) {
                    addOrientedBox(group, len, thinRailH, depth, railMat, centerX, centerY, centerZ, angle, true, true);
                }
                cursorTop -= thinRailH + gap;
            }

            const postCount = Math.max(2, Math.floor(len / postSpacing) + 2);
            for(let i = 0; i < postCount; i++) {
                const t = postCount === 1 ? 0.5 : i / (postCount - 1);
                const x = start.x + dx * t;
                const z = start.z + dz * t;
                addOrientedBox(group, postSize, railH, postSize, railMat, x, railH / 2, z, angle, true, true);
            }
        }

        function addRailBarsToSegment(group, start, end, railH, wallThickness, railMat, spacingCm = 12) {
            const dx = end.x - start.x;
            const dz = end.z - start.z;
            const len = Math.sqrt(dx * dx + dz * dz);
            if(len < 0.5) return;
            const angle = Math.atan2(dz, dx);
            const barWidth = 0.03;
            const barDepth = Math.max(0.02, wallThickness * 0.45);
            const barHeight = Math.max(0.1, railH);
            const spacing = Math.max(0.12, Math.min(0.35, spacingCm / 100));
            const usableLength = Math.max(0, len - 2 * barWidth);
            const count = Math.max(1, Math.floor(usableLength / spacing));
            for(let i = 0; i < count; i++) {
                const t = (barWidth + (i + 0.5) * spacing) / len;
                if(t <= 0 || t >= 1) continue;
                const bx = start.x + dx * t;
                const bz = start.z + dz * t;
                addOrientedBox(group, barWidth, barHeight, barDepth, railMat, bx, barHeight / 2, bz, angle, true, true);
            }
            const connectorHeight = 0.06;
            const midX = start.x + dx / 2;
            const midZ = start.z + dz / 2;
            addOrientedBox(group, len, connectorHeight, barDepth, railMat, midX, barHeight - connectorHeight / 2, midZ, angle, true, true);
            addOrientedBox(group, len, connectorHeight, barDepth, railMat, midX, connectorHeight / 2, midZ, angle, true, true);
        }
        
        function resetArchHeights() {
            saveState();
            archHeights = {
                wall: 250,
                windowBot: 50,
                windowTop: 225,
                glassBot: 0,
                glassTop: 225,
                rail: 100
            };
            archColors = {
                wall: '#ffffff',
                slab: '#9a9a9a',
                rail: '#c8b89a',
                ceiling: '#d8d2c4'
            };
            slabZoneColors = {};
            selectedSlabZoneId = null;
            archOptions.ceiling = false;
            ceilingShapePoints = [];
            currentCeilingPoints = [];
            document.getElementById('input-wall').value = 250;
            document.getElementById('input-window-bot').value = 50;
            document.getElementById('input-window-top').value = 225;
            document.getElementById('input-glass-bot').value = 0;
            document.getElementById('input-glass-top').value = 225;
            document.getElementById('input-rail').value = 100;
            const wallColorInput = document.getElementById('input-wall-color');
            if(wallColorInput) wallColorInput.value = archColors.wall;
            const slabColorInput = document.getElementById('input-slab-color');
            if(slabColorInput) slabColorInput.value = archColors.slab;
            const railColorInput = document.getElementById('input-rail-color');
            if(railColorInput) railColorInput.value = archColors.rail;
            const ceilingInput = document.getElementById('input-ceiling');
            if(ceilingInput) ceilingInput.checked = false;
            const ceilingBtn = document.getElementById('btn-ceiling');
            if(ceilingBtn) ceilingBtn.classList.remove('active');
            const ceilingColorInput = document.getElementById('input-ceiling-color');
            if(ceilingColorInput) ceilingColorInput.value = archColors.ceiling;
            updateArchPalettesUI();
            build3DArch();
            draw2D();
        }
        
        function toggleArchPanel() {
            const panel = document.getElementById('arch-panel-2d');
            panel.classList.toggle('visible');
            syncFloatingControlsOffset();
            const heightsBtn = document.getElementById('btn-heights');
            if(panel.classList.contains('visible') && heightsBtn) {
                heightsBtn.scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }
        }

        function closeArchPanel() {
            const panel = document.getElementById('arch-panel-2d');
            if(panel && panel.classList.contains('visible')) {
                panel.classList.remove('visible');
            }
            syncFloatingControlsOffset();
        }

        function syncFloatingControlsOffset() {
            const panel = document.getElementById('arch-panel-2d');
            const isOpen = !!(panel && panel.classList.contains('visible'));
            const switcher = document.querySelector('.main-view-switcher');
            const lightPanel = document.getElementById('light-time-control');
            const offset = isOpen ? Math.ceil(panel.getBoundingClientRect().height || 0) + 12 : 0;
            document.documentElement.style.setProperty('--arch-panel-offset', offset + 'px');
            if(switcher) switcher.classList.toggle('arch-panel-open', isOpen);
            if(lightPanel) lightPanel.classList.toggle('arch-panel-open', isOpen);
        }

        function toggleLightPanel() {
            lightPanelOpen = !lightPanelOpen;
            const panel = document.getElementById('light-time-control');
            const btn = document.getElementById('btn-light-panel');
            if(panel) panel.classList.toggle('visible', lightPanelOpen);
            if(btn) btn.classList.toggle('active', lightPanelOpen);
            if(lightPanelOpen) {
                syncSun2dControls();
                syncFloatingControlsOffset();
            }
        }

        function closeLightPanel() {
            lightPanelOpen = false;
            const panel = document.getElementById('light-time-control');
            const btn = document.getElementById('btn-light-panel');
            if(panel) panel.classList.remove('visible');
            if(btn) btn.classList.remove('active');
        }

        document.addEventListener('click', function(event) {
            if(!lightPanelOpen) return;
            const panel = document.getElementById('light-time-control');
            const btn = document.getElementById('btn-light-panel');
            const target = event.target;
            if((panel && panel.contains(target)) || (btn && btn.contains(target))) return;
            closeLightPanel();
        });

        // --- VIS-\u00c0-VIS ---

        function getPlanCentroidWorld() {
            const sources = getSolarMapSourcePolygons();
            if(!sources.length) return { x: 0, z: 0 };
            const poly = sources[0].polygon;
            let cx = 0, cz = 0;
            poly.forEach(pt => { cx += pt.x; cz += pt.y; });
            const transformed = transformBalconyScenePoint2D({ x: cx / poly.length, y: cz / poly.length });
            return { x: transformed.x / 20, z: transformed.y / 20 };
        }

        function generateVisAVisViewpoints() {
            const neighborhood = horizonSettings.neighborhood;
            const buildings = neighborhood && Array.isArray(neighborhood.buildings) ? neighborhood.buildings : [];
            const hasNeighborhood = neighborhood && neighborhood.enabled && buildings.length > 0;
            if(hasNeighborhood) return generateVisAVisViewpointsFromNeighborhood(buildings, neighborhood);
            return [];
        }

        function limitVisAVisViewpoints(viewpoints, maxCount = 650) {
            if(!Array.isArray(viewpoints) || viewpoints.length <= maxCount) return viewpoints;
            const limited = [];
            const step = viewpoints.length / maxCount;
            for(let i = 0; i < maxCount; i++) {
                limited.push(viewpoints[Math.min(viewpoints.length - 1, Math.floor(i * step))]);
            }
            return limited;
        }

        function getVisAVisBalconyTarget3D() {
            const centroid = getPlanCentroidWorld();
            return new THREE.Vector3(centroid.x, 15, centroid.z);
        }

        function clearVisAVisGuideMeshes() {
            if(!visAVisGuideGroup) return;
            const geometries = new Set();
            const materials = new Set();
            const textures = new Set();
            while(visAVisGuideGroup.children.length) {
                const child = visAVisGuideGroup.children.pop();
                child.traverse(obj => {
                    if(obj.geometry) geometries.add(obj.geometry);
                    if(obj.material) {
                        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
                        mats.forEach(mat => {
                            if(mat.map) textures.add(mat.map);
                            materials.add(mat);
                        });
                    }
                });
            }
            geometries.forEach(geo => geo.dispose());
            textures.forEach(texture => texture.dispose());
            materials.forEach(mat => mat.dispose());
        }

        function createVisAVisTextSprite(text) {
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 48;
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = 'rgba(44, 34, 24, 0.66)';
            ctx.fillRect(4, 7, 120, 34);
            ctx.strokeStyle = 'rgba(214, 162, 92, 0.78)';
            ctx.lineWidth = 2;
            ctx.strokeRect(4, 7, 120, 34);
            ctx.font = 'bold 22px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#f5dec0';
            ctx.fillText(text, 64, 25);
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(5.2, 1.95, 1);
            sprite.renderOrder = 60;
            return sprite;
        }

        function getVisAVisFloorLabel(yScene) {
            const neighborhood = horizonSettings && horizonSettings.neighborhood;
            const floorHeightM = (neighborhood && neighborhood.floorHeightM) || 3;
            const observerFloor = (neighborhood && neighborhood.floor) || 0;
            const relativeHeightM = yScene / 10 + observerFloor * floorHeightM;
            const floorIndex = Math.max(0, Math.round((relativeHeightM - 0.75) / Math.max(0.5, floorHeightM)));
            return floorIndex <= 0 ? 'RDC' : 'R+' + floorIndex;
        }

        function rebuildVisAVisGuideMeshes() {
            clearVisAVisGuideMeshes();
            if(!visAVisGuideGroup || !visAVisGuidesVisible) return;
            const neighborhood = horizonSettings && horizonSettings.neighborhood;
            const buildings = neighborhood && Array.isArray(neighborhood.buildings) ? neighborhood.buildings : [];
            if(!neighborhood || !neighborhood.enabled || !buildings.length) return;

            const supportBuildingId = neighborhood.supportBuildingId ? String(neighborhood.supportBuildingId) : null;
            const U = 10;
            const eye = typeof getNeighborhoodMapOrigin2D === 'function'
                ? getNeighborhoodMapOrigin2D(neighborhood)
                : getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            const eyeX = eye.x / 20;
            const eyeZ = eye.y / 20;
            const centroid = getPlanCentroidWorld();
            const balconyOrigin = { x: centroid.x, z: centroid.z };
            const observerFloor = neighborhood.floor || 0;
            const floorHeightM = neighborhood.floorHeightM || 3.0;
            const baseYObserver = -observerFloor * floorHeightM * U;
            const minFacingDot = Math.cos(80 * Math.PI / 180);
            const footprintEntries = buildings.map((building, index) => ({
                index,
                building,
                points: getVisAVisFootprintScenePoints(building, eyeX, eyeZ, U)
            }));
            const group = new THREE.Group();
            group.name = 'Façades vis-à-vis';
            const facadeMat = new THREE.MeshBasicMaterial({
                color: 0xcc924a,
                transparent: true,
                opacity: 0.42,
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: false,
                polygonOffset: true,
                polygonOffsetFactor: -4,
                polygonOffsetUnits: -4
            });
            const edgeMat = new THREE.LineBasicMaterial({
                color: 0xcc924a,
                transparent: true,
                opacity: 0.74,
                depthTest: true,
                depthWrite: false
            });

            footprintEntries.forEach(({ building, points: fp, index: buildingIndex }) => {
                if(supportBuildingId && String(building.id) === supportBuildingId) return;
                if(!fp || fp.length < 3) return;
                const n = fp.length;
                const bcx = fp.reduce((s, p) => s + p.x, 0) / n;
                const bcz = fp.reduce((s, p) => s + p.z, 0) / n;
                const bottomY = baseYObserver;
                const topY = baseYObserver + (building.heightM || 9) * U;
                if(topY <= bottomY + 0.5) return;

                for(let i = 0; i < n; i++) {
                    const a = fp[i], b = fp[(i + 1) % n];
                    const ax = a.x, az = a.z;
                    const bx = b.x, bz = b.z;
                    const edgeDx = bx - ax, edgeDz = bz - az;
                    const edgeLen = Math.hypot(edgeDx, edgeDz);
                    if(edgeLen < 0.5) continue;
                    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
                    const nxRaw = -edgeDz / edgeLen, nzRaw = edgeDx / edgeLen;
                    const dotToCenter = nxRaw * (bcx - mx) + nzRaw * (bcz - mz);
                    const nx = dotToCenter > 0 ? -nxRaw : nxRaw;
                    const nz = dotToCenter > 0 ? -nzRaw : nzRaw;
                    const toBalconyLen = Math.hypot(centroid.x - mx, centroid.z - mz);
                    if(toBalconyLen < 0.5 || (nx * (centroid.x - mx) + nz * (centroid.z - mz)) / toBalconyLen < minFacingDot) continue;

                    const visibleSamples = [];
                    const sampleCount = Math.max(1, Math.round(edgeLen / (3 * U)));
                    for(let si = 0; si <= sampleCount; si++) {
                        const t = si / sampleCount;
                        const px = ax + edgeDx * t + nx * 5;
                        const pz = az + edgeDz * t + nz * 5;
                        const sampleToBalconyX = centroid.x - px;
                        const sampleToBalconyZ = centroid.z - pz;
                        const sampleToBalconyLen = Math.hypot(sampleToBalconyX, sampleToBalconyZ);
                        if(sampleToBalconyLen < 0.5 || (nx * sampleToBalconyX + nz * sampleToBalconyZ) / sampleToBalconyLen < minFacingDot) continue;
                        if(isVisAVisPointHiddenByFootprints(balconyOrigin, { x: px, z: pz }, footprintEntries, buildingIndex, i)) continue;
                        visibleSamples.push(t);
                    }
                    if(!visibleSamples.length) continue;

                    const tMin = Math.min(...visibleSamples);
                    const tMax = Math.max(...visibleSamples);
                    const offset = 0.08;
                    const x1 = ax + edgeDx * tMin + nx * offset;
                    const z1 = az + edgeDz * tMin + nz * offset;
                    const x2 = ax + edgeDx * tMax + nx * offset;
                    const z2 = az + edgeDz * tMax + nz * offset;
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute([
                        x1, bottomY, z1,
                        x2, bottomY, z2,
                        x2, topY, z2,
                        x1, topY, z1
                    ], 3));
                    geo.setIndex([0, 1, 2, 0, 2, 3]);
                    geo.computeVertexNormals();
                    const mesh = new THREE.Mesh(geo, facadeMat.clone());
                    mesh.renderOrder = 55;
                    group.add(mesh);

                    const lineGeo = new THREE.BufferGeometry().setFromPoints([
                        new THREE.Vector3(x1, bottomY, z1),
                        new THREE.Vector3(x2, bottomY, z2),
                        new THREE.Vector3(x2, topY, z2),
                        new THREE.Vector3(x1, topY, z1),
                        new THREE.Vector3(x1, bottomY, z1)
                    ]);
                    const line = new THREE.Line(lineGeo, edgeMat.clone());
                    line.renderOrder = 56;
                    group.add(line);
                }
            });

            if(group.children.length) visAVisGuideGroup.add(group);
        }

        function getVisAVisFootprintScenePoints(building, eyeX, eyeZ, scaleUnits) {
            const raw = Array.isArray(building && building.footprint) ? building.footprint : [];
            const points = raw
                .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.z))
                .map(p => ({ x: eyeX + p.x * scaleUnits, z: eyeZ + p.z * scaleUnits }));
            if(points.length > 2) {
                const first = points[0];
                const last = points[points.length - 1];
                if(Math.hypot(first.x - last.x, first.z - last.z) < 0.01) points.pop();
            }
            return points;
        }

        function getVisAVisRaySegmentIntersection01(origin, target, a, b) {
            const rx = target.x - origin.x;
            const rz = target.z - origin.z;
            const sx = b.x - a.x;
            const sz = b.z - a.z;
            const denom = rx * sz - rz * sx;
            if(Math.abs(denom) < 1e-7) return null;
            const qpx = a.x - origin.x;
            const qpz = a.z - origin.z;
            const t = (qpx * sz - qpz * sx) / denom;
            const u = (qpx * rz - qpz * rx) / denom;
            if(t <= 1e-5 || t >= 0.995 || u < -1e-5 || u > 1 + 1e-5) return null;
            return t;
        }

        function isVisAVisPointHiddenByFootprints(origin, target, footprintEntries, currentBuildingIndex, currentEdgeIndex) {
            for(const entry of footprintEntries) {
                const pts = entry.points;
                if(!Array.isArray(pts) || pts.length < 3) continue;
                for(let i = 0; i < pts.length; i++) {
                    if(entry.index === currentBuildingIndex && i === currentEdgeIndex) continue;
                    const a = pts[i];
                    const b = pts[(i + 1) % pts.length];
                    if(getVisAVisRaySegmentIntersection01(origin, target, a, b) !== null) return true;
                }
            }
            return false;
        }

        function generateVisAVisViewpointsFromNeighborhood(buildings, neighborhood) {
            const supportBuildingId = neighborhood && neighborhood.supportBuildingId ? String(neighborhood.supportBuildingId) : null;
            const U = 10; // 10 scène-unités = 1 m
            const eye = typeof getNeighborhoodMapOrigin2D === 'function'
                ? getNeighborhoodMapOrigin2D(neighborhood)
                : getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            const eyeX = eye.x / 20;
            const eyeZ = eye.y / 20;
            const centroid = getPlanCentroidWorld();
            const balconyOrigin = { x: centroid.x, z: centroid.z };
            const observerFloor = neighborhood.floor || 0;
            const floorHeightM = neighborhood.floorHeightM || 3.0;
            const baseYObserver = -observerFloor * floorHeightM * U;
            const eyeHeightM = 1.5;
            const hStepM = 3.0;
            const minFacingDot = Math.cos(80 * Math.PI / 180);
            const footprintEntries = buildings.map((building, index) => ({
                index,
                building,
                points: getVisAVisFootprintScenePoints(building, eyeX, eyeZ, U)
            }));

            const points = [];

            footprintEntries.forEach(({ building, points: footprint }, buildingIndex) => {
                if(supportBuildingId && String(building.id) === supportBuildingId) return;
                if(!footprint || footprint.length < 3) return;
                const n = footprint.length;
                const buildingHeightM = building.heightM || 9;
                const floors = building.levels
                    ? Math.max(1, Math.round(Number(building.levels)))
                    : Math.max(1, Math.round(buildingHeightM / floorHeightM));

                // Centroïde du bâtiment — oriente les normales indépendamment du sens de parcours
                const bcx = footprint.reduce((s, p) => s + p.x, 0) / n;
                const bcz = footprint.reduce((s, p) => s + p.z, 0) / n;

                for(let i = 0; i < n; i++) {
                    const a = footprint[i];
                    const b = footprint[(i + 1) % n];

                    const ax = a.x, az = a.z;
                    const bx = b.x, bz = b.z;

                    const edgeDx = bx - ax, edgeDz = bz - az;
                    const edgeLen = Math.hypot(edgeDx, edgeDz);
                    if(edgeLen < 0.5) continue;

                    const mx = (ax + bx) / 2, mz = (az + bz) / 2;

                    // Normale sortante : perpendiculaire retournée si elle pointe vers le centroïde
                    const nxRaw = -edgeDz / edgeLen, nzRaw = edgeDx / edgeLen;
                    const dotToCenter = nxRaw * (bcx - mx) + nzRaw * (bcz - mz);
                    const nx = dotToCenter > 0 ? -nxRaw : nxRaw;
                    const nz = dotToCenter > 0 ? -nzRaw : nzRaw;

                    // La façade doit faire face au balcon
                    const toBx = centroid.x - mx, toBz = centroid.z - mz;
                    const toBalconyLen = Math.hypot(toBx, toBz);
                    if(toBalconyLen < 0.5 || (nx * toBx + nz * toBz) / toBalconyLen < minFacingDot) continue;

                    // Points le long de la façade, légèrement devant la face qui regarde le balcon.
                    const inset = 5;
                    const hStep = hStepM * U;
                    const hCount = Math.max(1, Math.round(edgeLen / hStep));

                    for(let hi = 0; hi <= hCount; hi++) {
                        const t = hi / hCount;
                        const px = ax + edgeDx * t + nx * inset;
                        const pz = az + edgeDz * t + nz * inset;
                        const target2D = { x: px, z: pz };
                        const sampleToBalconyX = centroid.x - px;
                        const sampleToBalconyZ = centroid.z - pz;
                        const sampleToBalconyLen = Math.hypot(sampleToBalconyX, sampleToBalconyZ);
                        if(sampleToBalconyLen < 0.5 || (nx * sampleToBalconyX + nz * sampleToBalconyZ) / sampleToBalconyLen < minFacingDot) continue;
                        if(isVisAVisPointHiddenByFootprints(balconyOrigin, target2D, footprintEntries, buildingIndex, i)) continue;

                        for(let f = 0; f < floors; f++) {
                            for(const frac of [0.45, 0.82]) {
                                const vy = baseYObserver + (f * floorHeightM + eyeHeightM * frac) * U;
                                points.push(new THREE.Vector3(px, vy, pz));
                            }
                        }
                    }
                }
            });

            return points;
        }

        function isVisibleFromViewpoint(cellPoint, viewpoint, occluders) {
            const direction = viewpoint.clone().sub(cellPoint);
            const distance = direction.length();
            if(distance < 0.1) return 0;
            direction.normalize();
            visAVisRaycaster.set(cellPoint, direction);
            visAVisRaycaster.near = 0.05;
            visAVisRaycaster.far = distance - 0.15;
            const hits = visAVisRaycaster.intersectObjects(occluders, false);
            if(!hits.length) return 1;
            const supportId = horizonSettings && horizonSettings.neighborhood && horizonSettings.neighborhood.supportBuildingId
                ? String(horizonSettings.neighborhood.supportBuildingId)
                : null;
            let factor = 1;
            const internalCutout = getBalconyInternalCutoutFixed2D();
            for(const hit of hits) {
                const hitBuildingId = hit.object && hit.object.userData && hit.object.userData.neighborhoodBuildingId
                    ? String(hit.object.userData.neighborhoodBuildingId)
                    : null;
                if(hitBuildingId && isSupportBuildingInternalHit(hit, internalCutout)) continue;
                if(supportId && hitBuildingId === supportId && hit.distance < 1.2) continue;
                if(hit.object.userData.isGlass) factor *= 0.55;
                else if(hit.object.userData.isTrellis) factor *= 0.5;
                else return 0;
            }
            return factor;
        }

        function getVisAVisDistanceWeight(cellPoint, viewpoint) {
            const distanceM = cellPoint.distanceTo(viewpoint) / 10;
            if(distanceM <= 8) return 1;
            return 1 / (1 + (distanceM - 8) / 28);
        }

        function computeVisAVisData() {
            const sources = getSolarMapSourcePolygons().filter(source => !source.kind || source.kind === 'ground');
            if(!sources.length) {
                const message = balconyDesignMode === 'exterieur'
                    ? "Cr\u00e9e au moins une surface ext\u00e9rieure pour calculer la visibilit\u00e9."
                    : "Ferme d'abord le contour du balcon pour calculer la visibilit\u00e9.";
                alert(message);
                return null;
            }
            const cellPx = Math.max(SOLAR_MAP_CELL_DM * 20, 80);
            const cells = [];
            sources.forEach(source => cells.push(...createSolarMapCellsForSource(source, cellPx)));
            if(!cells.length) return null;

            const viewpoints = limitVisAVisViewpoints(generateVisAVisViewpoints());
            if(!viewpoints.length) {
                const neighborhood = horizonSettings.neighborhood;
                const hasNeighborhood = neighborhood && neighborhood.enabled && Array.isArray(neighborhood.buildings) && neighborhood.buildings.length > 0;
                if(hasNeighborhood) alert('Aucune façade voisine ne fait face au balcon. Vérifie l\'orientation du voisinage importé.');
                else alert('Importe d\'abord le voisinage urbain pour calculer le vis-\u00e0-vis.');
                return null;
            }

            const occluders = getSolarMapOccluders();
            cells.forEach(cell => {
                const transformed = transformBalconyScenePoint2D({ x: cell.worldX * 20, y: cell.worldZ * 20 });
                const samplePoint = new THREE.Vector3(transformed.x / 20, cell.surfaceY + SOLAR_MAP_SAMPLE_Y_OFFSET, transformed.y / 20);
                let score = 0;
                let totalWeight = 0;
                viewpoints.forEach(vp => {
                    const weight = getVisAVisDistanceWeight(samplePoint, vp);
                    score += isVisibleFromViewpoint(samplePoint, vp, occluders) * weight;
                    totalWeight += weight;
                });
                cell.visibility = totalWeight > 0 ? score / totalWeight : 0;
            });

            return {
                cells,
                cellPx,
                computedAt: Date.now(),
                viewpointCount: viewpoints.length,
                minVis: cells.reduce((m, c) => Math.min(m, c.visibility), Infinity),
                maxVis: cells.reduce((m, c) => Math.max(m, c.visibility), 0)
            };
        }

        function getVisAVisColor2D(visibility) {
            if(visibility < 0.15) return 'rgba(50, 160, 80, 0.52)';
            if(visibility < 0.40) return 'rgba(180, 210, 50, 0.50)';
            if(visibility < 0.70) return 'rgba(230, 140, 35, 0.52)';
            return 'rgba(210, 45, 35, 0.56)';
        }

        function getVisAVisHexColor(visibility) {
            if(visibility < 0.15) return 0x32a050;
            if(visibility < 0.40) return 0xb4d232;
            if(visibility < 0.70) return 0xe68c23;
            return 0xd22d23;
        }

        function clearVisAVisMeshes() {
            if(!visAVisGroup) return;
            while(visAVisGroup.children.length) {
                const child = visAVisGroup.children.pop();
                if(child.geometry) child.geometry.dispose();
                if(child.material) child.material.dispose();
            }
        }

        function clearVisAVisMap() {
            visAVisEnabled = false;
            visAVisData = null;
            visAVisDirty = true;
            clearVisAVisMeshes();
            updateVisAVisUI();
            draw2D();
            renderCurrent3DFrame();
        }

        function rebuildVisAVisMeshes() {
            clearVisAVisMeshes();
            if(!visAVisGroup || !visAVisEnabled || !visAVisData || !Array.isArray(visAVisData.cells)) return;
            const size = (visAVisData.cellPx || SOLAR_MAP_CELL_DM * 20) / 20;
            const geo = new THREE.PlaneGeometry(size * 1.006, size * 1.006);
            geo.rotateX(-Math.PI / 2);
            visAVisData.cells.forEach(cell => {
                const mat = new THREE.MeshBasicMaterial({
                    color: getVisAVisHexColor(cell.visibility),
                    transparent: true,
                    opacity: 0.44,
                    depthWrite: false,
                    polygonOffset: true,
                    polygonOffsetFactor: -2,
                    polygonOffsetUnits: -2,
                    side: THREE.DoubleSide
                });
                const tile = new THREE.Mesh(geo.clone(), mat);
                tile.position.set(cell.worldX, cell.surfaceY + 0.022, cell.worldZ);
                tile.renderOrder = 5;
                visAVisGroup.add(tile);
            });
        }

        function renderVisAVis2DOverlay() {
            if(!visAVisEnabled || !visAVisData || !Array.isArray(visAVisData.cells)) return;
            const cellPx = visAVisData.cellPx || 20;
            ctx2d.save();
            visAVisData.cells.forEach(cell => {
                ctx2d.fillStyle = getVisAVisColor2D(cell.visibility);
                ctx2d.fillRect(cell.x, cell.y, cellPx + 0.5 / Math.max(0.1, scale), cellPx + 0.5 / Math.max(0.1, scale));
            });
            ctx2d.restore();
        }

        function renderVisAVisZoneIndicator2D() {
            if(!visAVisGuidesVisible) return;
            try {
                const neighborhood = horizonSettings && horizonSettings.neighborhood;
                const buildings = neighborhood && Array.isArray(neighborhood.buildings) ? neighborhood.buildings : [];
                const hasNeighborhood = neighborhood && neighborhood.enabled && buildings.length > 0;
                if(hasNeighborhood && typeof shouldUseLightweight2DEnvironment === 'function' && shouldUseLightweight2DEnvironment()) return;
                if(hasNeighborhood) {
                    renderVisAVisNeighborhoodIndicator2D(buildings, neighborhood);
                }
            } catch(e) {
                console.warn('renderVisAVisZoneIndicator2D:', e);
                if(ctx2d) { try { ctx2d.restore(); } catch(_) {} }
            }
        }

        function renderVisAVisNeighborhoodIndicator2D(buildings, neighborhood) {
            if(!ctx2d) return;
            const eye = typeof getNeighborhoodMapOrigin2D === 'function'
                ? getNeighborhoodMapOrigin2D(neighborhood)
                : getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            const centroid = getPlanCentroidWorld();
            const U = 10;
            const eyeX = eye.x / 20, eyeZ = eye.y / 20;
            const sceneRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const minFacingDot = Math.cos(80 * Math.PI / 180);
            const balconyOrigin = { x: centroid.x, z: centroid.z };
            const mobileSimplified = typeof IS_TOUCH_DEVICE !== 'undefined' && IS_TOUCH_DEVICE && buildings.length > 16;
            const footprintEntries = buildings.map((building, index) => ({
                index,
                building,
                points: getVisAVisFootprintScenePoints(building, eyeX, eyeZ, U)
            }));
            const toCanvas = p => ({
                x: eye.x + (p.x - eyeX) * 20,
                y: eye.y + (p.z - eyeZ) * 20
            });

            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            ctx2d.save();
            ctx2d.translate(pivot.x || 0, pivot.y || 0);
            ctx2d.rotate(-sceneRot);
            ctx2d.translate(-(pivot.x || 0), -(pivot.y || 0));
            ctx2d.translate(-balconyOffsetX * 20, -balconyOffsetZ * 20);
            footprintEntries.forEach(({ building, points: fp, index: buildingIndex }) => {
                if(!fp || fp.length < 3) return;
                const n = fp.length;

                // Centro\u00efde du b\u00e2timent en sc\u00e8ne (pour orientation des normales)
                const bcx = fp.reduce((s, p) => s + p.x, 0) / n;
                const bcz = fp.reduce((s, p) => s + p.z, 0) / n;

                // Empreinte du b\u00e2timent
                ctx2d.beginPath();
                fp.forEach((p, i) => {
                    const c = toCanvas(p);
                    if(i === 0) ctx2d.moveTo(c.x, c.y);
                    else ctx2d.lineTo(c.x, c.y);
                });
                ctx2d.closePath();
                ctx2d.fillStyle = 'rgba(186, 134, 72, 0.06)';
                ctx2d.fill();
                ctx2d.strokeStyle = 'rgba(160, 122, 82, 0.24)';
                ctx2d.lineWidth = 1.2 / scale;
                ctx2d.stroke();

                // Fa\u00e7ades face au balcon (normale outward via centro\u00efde du b\u00e2timent)
                for(let i = 0; i < n; i++) {
                    const a = fp[i], b = fp[(i + 1) % n];
                    const ax = a.x, az = a.z;
                    const bx = b.x, bz = b.z;
                    const edgeDx = bx - ax, edgeDz = bz - az;
                    const edgeLen = Math.hypot(edgeDx, edgeDz);
                    if(edgeLen < 0.5) continue;

                    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
                    const nxRaw = -edgeDz / edgeLen, nzRaw = edgeDx / edgeLen;
                    const dotToCenter = nxRaw * (bcx - mx) + nzRaw * (bcz - mz);
                    const nx = dotToCenter > 0 ? -nxRaw : nxRaw;
                    const nz = dotToCenter > 0 ? -nzRaw : nzRaw;

                    const toBalconyLen = Math.hypot(centroid.x - mx, centroid.z - mz);
                    if(toBalconyLen < 0.5 || (nx * (centroid.x - mx) + nz * (centroid.z - mz)) / toBalconyLen < minFacingDot) continue;

                    const visibleSamples = [];
                    const sampleCount = mobileSimplified ? 1 : Math.max(1, Math.round(edgeLen / (3 * U)));
                    for(let si = 0; si <= sampleCount; si++) {
                        const t = si / sampleCount;
                        const px = ax + edgeDx * t + nx * 5;
                        const pz = az + edgeDz * t + nz * 5;
                        const sampleToBalconyX = centroid.x - px;
                        const sampleToBalconyZ = centroid.z - pz;
                        const sampleToBalconyLen = Math.hypot(sampleToBalconyX, sampleToBalconyZ);
                        if(sampleToBalconyLen < 0.5 || (nx * sampleToBalconyX + nz * sampleToBalconyZ) / sampleToBalconyLen < minFacingDot) continue;
                        if(!mobileSimplified && isVisAVisPointHiddenByFootprints(balconyOrigin, { x: px, z: pz }, footprintEntries, buildingIndex, i)) continue;
                        visibleSamples.push(t);
                    }
                    if(!visibleSamples.length) continue;

                    // Façade orientée vers le balcon, indiquée sans rayon d'alerte.
                    const tMin = Math.min(...visibleSamples);
                    const tMax = Math.max(...visibleSamples);
                    const visibleStart = toCanvas({ x: ax + edgeDx * tMin, z: az + edgeDz * tMin });
                    const visibleEnd = toCanvas({ x: ax + edgeDx * tMax, z: az + edgeDz * tMax });
                    ctx2d.beginPath();
                    ctx2d.moveTo(visibleStart.x, visibleStart.y);
                    ctx2d.lineTo(visibleEnd.x, visibleEnd.y);
                    ctx2d.strokeStyle = 'rgba(204, 146, 74, 0.74)';
                    ctx2d.lineWidth = 3 / scale;
                    ctx2d.stroke();
                }

                if(mobileSimplified) return;
                // Label b\u00e2timent centr\u00e9 sur l'empreinte
                const canvasPts = fp.map(toCanvas);
                const labelX = canvasPts.reduce((s, p) => s + p.x, 0) / n;
                const labelY = canvasPts.reduce((s, p) => s + p.y, 0) / n;
                const fs = Math.max(8, 10 / scale);
                ctx2d.font = `bold ${fs}px sans-serif`;
                ctx2d.fillStyle = 'rgba(128, 92, 56, 0.86)';
                ctx2d.textAlign = 'center';
                ctx2d.fillText(building.name || 'Voisin', labelX, labelY);
                if(building.heightM) {
                    ctx2d.font = `${fs * 0.85}px sans-serif`;
                    ctx2d.fillStyle = 'rgba(128, 92, 56, 0.58)';
                    ctx2d.fillText(Math.round(building.heightM) + ' m', labelX, labelY + fs * 1.3);
                }
                ctx2d.textAlign = 'left';
            });
            ctx2d.restore();
        }

        function updateVisAVisUI() {
            const btn = document.getElementById('btn-vis-a-vis');
            const guideBtn = document.getElementById('btn-vis-a-vis-guides');
            const status = document.getElementById('vis-a-vis-status');
            const neighborhood = horizonSettings.neighborhood;
            const hasNeighborhood = neighborhood && neighborhood.enabled && Array.isArray(neighborhood.buildings) && neighborhood.buildings.length > 0;

            if(btn) {
                btn.classList.toggle('active', visAVisEnabled);
                btn.disabled = !hasNeighborhood;
                btn.textContent = visAVisEnabled ? 'Recalculer carte' : 'Calculer carte';
            }
            if(guideBtn) {
                guideBtn.classList.toggle('active', visAVisGuidesVisible);
                guideBtn.disabled = !hasNeighborhood;
                guideBtn.textContent = visAVisGuidesVisible ? 'Masquer façades' : 'Afficher façades';
            }
            if(status) {
                if(!visAVisData) {
                    status.textContent = hasNeighborhood
                        ? neighborhood.buildings.length + ' b\u00e2timent(s) voisin(s) \u00b7 façades vis-à-vis indicatives \u00b7 carte non calcul\u00e9e'
                        : 'Importe le voisinage urbain pour afficher le vis-\u00e0-vis.';
                } else {
                    const pct = Math.round((visAVisData.maxVis || 0) * 100);
                    const source = hasNeighborhood ? neighborhood.buildings.length + ' b\u00e2t.' : 'voisinage absent';
                    status.textContent = source + ' \u00b7 ' + visAVisData.cells.length + ' cases \u00b7 max ' + pct + '%' + (visAVisDirty ? ' \u00b7 \u00e0 recalculer' : '');
                }
            }
        }

        function markVisAVisDirty() {
            visAVisDirty = true;
            updateVisAVisUI();
            rebuildVisAVisGuideMeshes();
        }

        window.toggleVisAVisGuides = function() {
            visAVisGuidesVisible = !visAVisGuidesVisible;
            if(visAVisGuidesVisible) rebuildVisAVisGuideMeshes();
            else clearVisAVisGuideMeshes();
            updateVisAVisUI();
            draw2D();
            renderCurrent3DFrame();
        };

        async function toggleVisAVis() {
            const neighborhood = horizonSettings && horizonSettings.neighborhood;
            const hasNeighborhood = neighborhood && neighborhood.enabled && Array.isArray(neighborhood.buildings) && neighborhood.buildings.length > 0;
            if(!hasNeighborhood) {
                const status = document.getElementById('vis-a-vis-status');
                if(status) status.textContent = 'Importe le voisinage urbain pour calculer le vis-\u00e0-vis.';
                alert('Importe d\'abord le voisinage urbain pour calculer le vis-\u00e0-vis.');
                updateVisAVisUI();
                return;
            }
            if(!visAVisEnabled) visAVisEnabled = true;
            const btn = document.getElementById('btn-vis-a-vis');
            const status = document.getElementById('vis-a-vis-status');
            if(btn) btn.disabled = true;
            if(status) status.textContent = 'Calcul de la carte color\u00e9e en cours...';
            try {
                await startDownloadProgress('Carte vis-\u00e0-vis', 'Analyse des fa\u00e7ades candidates...', 5);
                updateDownloadProgress(30, 'G\u00e9n\u00e9ration des points de vue...');
                await waitAnimationFrame();
                const data = computeVisAVisData();
                if(!data) {
                    visAVisEnabled = false;
                    if(btn) btn.disabled = false;
                    updateVisAVisUI();
                    failDownloadProgress('Calcul impossible.');
                    return;
                }
                updateDownloadProgress(85, 'Construction de la carte...');
                await waitAnimationFrame();
                visAVisData = data;
                visAVisDirty = false;
                rebuildVisAVisMeshes();
                updateVisAVisUI();
                draw2D();
                renderCurrent3DFrame();
                finishDownloadProgress('Carte vis-\u00e0-vis calcul\u00e9e.');
            } catch(err) {
                console.warn('Calcul vis-\u00e0-vis interrompu', err);
                visAVisEnabled = false;
                updateVisAVisUI();
                failDownloadProgress('Calcul vis-\u00e0-vis interrompu.');
            } finally {
                updateVisAVisUI();
            }
        }

        // --- FONCTIONS PANNEAU JARDINI\u00c8RES 2D ---
