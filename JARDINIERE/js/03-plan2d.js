        // --- LOGIQUE PLAN 2D ---
        function init2D() {
            canvas2d = document.getElementById('canvas-2d');
            ctx2d = canvas2d.getContext('2d');
            canvas2d.width = 4000;
            canvas2d.height = 4000;
            canvas2d.style.touchAction = 'none';
            ensureTouchDraftMagnifier();
            
            const { width: canvasWidth, height: canvasHeight } = getPane2DSize();
            
            offsetX = canvasWidth/2;
            offsetY = canvasHeight/2;
            lastPane2DWidth = canvasWidth;
            lastPane2DHeight = canvasHeight;
            lastViewportOrientationKey = getViewportOrientationKey();

            ['devis-panel-2d', 'chantier-panel-2d'].forEach((panelId) => {
                const panel = document.getElementById(panelId);
                if(!panel) return;
                ['touchstart', 'touchmove', 'touchend', 'pointerdown', 'pointermove', 'wheel'].forEach((eventName) => {
                    panel.addEventListener(eventName, (event) => {
                        event.stopPropagation();
                    }, { passive: true });
                });
            });

            canvas2d.addEventListener('mousedown', (e) => {
    closeCompass2DPopup();

    if(e.button === 2 || e.button === 1) { // Pan
        isDragging2d = true;
        lastX = e.clientX; 
        lastY = e.clientY;

            } else if(e.button === 0) { // Draw or Edit
        
	        const { x: clickX, y: clickY } = screenToWorld2D(e.clientX, e.clientY);
            const fixedClick = screenToFixedWorld2D(e.clientX, e.clientY);
	        const clickXWorld = clickX;
	        const clickYWorld = clickY;
            const placementHitTolerance = isDispatchingTouchAsMouse ? 18 / scale : 0;
	        const clickedPlacementObject = findPlacementAt2D(clickXWorld, clickYWorld, placementHitTolerance);
            const clickedJardiniere = getPlacementType(clickedPlacementObject) === 'jardiniere' ? clickedPlacementObject : null;

            if(typeof handleBalconyBuildingPlacementPointerDown2D === 'function'
                && handleBalconyBuildingPlacementPointerDown2D(fixedClick.x, fixedClick.y, e)) {
                e.preventDefault();
                return;
            }

            if(handleGarlandToolCanvasClick(e, clickXWorld, clickYWorld)) {
                draw2D();
                return;
            }

            const sketchVertexHit = findSketchVertexAt(clickXWorld, clickYWorld, isDispatchingTouchAsMouse ? 26 : 18);
            const selectedPlacementObject = getSelectedPlacementObject();
            const selectedIsLockedCornerArrangement = isLockedCornerArrangementObject(selectedPlacementObject);
            const selectedCornerResizeHit = selectedIsLockedCornerArrangement
                ? getCornerArrangementResizeHandleHitType(clickXWorld, clickYWorld, selectedPlacementObject)
                : null;
	        const selectedResizeHit = selectedPlacementObject && !selectedIsLockedCornerArrangement
	            ? getResizeHandleHitType(clickXWorld, clickYWorld, selectedPlacementObject)
	            : null;
	        const selectedRotationHit = selectedPlacementObject && !selectedIsLockedCornerArrangement
	            ? isOnRotationHandle(clickXWorld, clickYWorld, selectedPlacementObject)
	            : false;
            if(cornerArrangementMode && sketchVertexHit && !clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit) {
                e.preventDefault();
                if(handleCornerArrangementClick(sketchVertexHit)) return;
            }
            if(sketchVertexHit && !currentPoint && !clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit) {
                e.preventDefault();
                clearJardiniereSelection({ redraw: false });
                clearGarlandToolMode({ redraw: false });
                if(canStartSegmentFromExistingVertex()) {
                    clearSketchElementSelection({ redraw: false });
                    beginSegmentDrawingAtPoint(sketchVertexHit);
                    selectSketchVertex(sketchVertexHit, { redraw: false });
                    draw2D();
                    return;
                }
                saveState();
                resetPlacementInteractionState();
                selectSketchVertex(sketchVertexHit, { redraw: false });
                draggingSketchVertex = sketchVertexHit;
                hadJardInteraction = true;
                if(canvas2d) canvas2d.style.cursor = 'grabbing';
                draw2D();
                return;
            }

            if(!isDrawingToolActive && !clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit && typeof handleSolarMapCellClick2D === 'function') {
                if(handleSolarMapCellClick2D(clickXWorld, clickYWorld, e)) {
                    e.preventDefault();
                    return;
                }
            }

	            let clickedMeasure = null;
	        if(!clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit) {
	            for(let i = 0; i < measureAreas.length; i++) {
	                const m = measureAreas[i];
	                if(clickX >= m.x && clickX <= m.x + m.w && clickY >= m.y && clickY <= m.y + m.h) {
	                    clickedMeasure = i;
	                    break;
	                }
	            }
	        }
            const clickedSketchSegment = (!clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit && clickedMeasure === null)
                ? findSketchSegmentAt(clickXWorld, clickYWorld, isDispatchingTouchAsMouse ? 20 : 12)
                : null;
            const clickedSlabZone = (!clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit && clickedMeasure === null && !clickedSketchSegment)
                ? findSlabZoneAt2D(clickXWorld, clickYWorld)
                : null;

	        if(clickedMeasure !== null) {
	            e.preventDefault();
                selectSketchSegment(measureAreas[clickedMeasure].segmentIndex, { redraw: false });
	            editMeasure(clickedMeasure);
	        } else {
                if(clickedSlabZone && shouldSelectSlabZoneFromClick()) {
                    e.preventDefault();
                    clearJardiniereSelection({ redraw: false });
                    clearSketchElementSelection({ redraw: false });
                    pendingSlabZoneSelection = clickedSlabZone;
                    isDragging2d = true;
                    lastX = e.clientX;
                    lastY = e.clientY;
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                    draw2D();
                    return;
                }
                if(!isDrawingToolActive && clickedSketchSegment) {
                    e.preventDefault();
                    clearJardiniereSelection({ redraw: false });
                    selectSketchSegment(clickedSketchSegment.segmentIndex);
                    return;
                }
	            // Mode déplacement: un clic-glissé dans le vide pan la vue, même si une jardinière était sélectionnée.
	            if(!isDrawingToolActive && !clickedPlacementObject && !selectedCornerResizeHit && !selectedResizeHit && !selectedRotationHit) {
                clearJardiniereSelection({ redraw: false });
                clearSketchElementSelection({ redraw: false });
                isDragging2d = true;
                lastX = e.clientX;
                lastY = e.clientY;
                draw2D();
                return;
            }
            
            // Vérifier d'abord si on clique sur une poignée de resize de la jardinière sélectionnée
            let startedResize = false;
	            let startedRotation = false;
	            if (selectedPlacementObject) {
	                if(selectedCornerResizeHit) {
                    e.preventDefault();
                    saveState();
                    resetPlacementInteractionState();
                    activeCornerArrangementResize = { fill: selectedPlacementObject, key: selectedCornerResizeHit };
                    resizeMode = selectedCornerResizeHit;
                    hadJardInteraction = true;
                    startedResize = true;
                    if(canvas2d) canvas2d.style.cursor = 'grabbing';
                    draw2D();
                    return;
                }
	                const resizeHit = selectedResizeHit;
	                if(!startedResize && resizeHit) {
                    saveState();
                    resetPlacementInteractionState();
                    resizingPlacementObject = selectedPlacementObject;
                    resizingJardiniere = getPlacementType(selectedPlacementObject) === 'jardiniere' ? selectedPlacementObject : null;
                    resizingBench = getPlacementType(selectedPlacementObject) === 'banc' ? selectedPlacementObject : null;
                    resizeMode = resizeHit;
                    const anchor = getResizeAnchorForMode(selectedPlacementObject, resizeHit);
                    resizeAnchorWorldX = anchor.world.x;
                    resizeAnchorWorldY = anchor.world.y;
                    resizeAnchorLocalX = anchor.local.x;
                    resizeAnchorLocalY = anchor.local.y;
                    hadJardInteraction = true;
                    startedResize = true;
                }
	            }
	            if (selectedPlacementObject && !startedResize) {
                if (selectedRotationHit && !isRailMountedPlacementType(getPlacementType(selectedPlacementObject))) {
                    saveState();
                    resetPlacementInteractionState();
                    rotatingPlacementObject = selectedPlacementObject;
                    rotatingJardiniere = getPlacementType(selectedPlacementObject) === 'jardiniere' ? selectedPlacementObject : null;
                    rotatingBench = getPlacementType(selectedPlacementObject) === 'banc' ? selectedPlacementObject : null;
                    hadJardInteraction = true;
                    rotPivotX = selectedPlacementObject.pos.x * 20;
                    rotPivotY = selectedPlacementObject.pos.z * 20;
                    rotStartMouseAngle = Math.atan2(clickYWorld - rotPivotY, clickXWorld - rotPivotX);
                    rotStartRot = selectedPlacementObject.rot || 0;
                    startedRotation = true;
                }
            }
            if (!startedResize && !startedRotation) {
                resetPlacementInteractionState();
                if(clickedPlacementObject) {
                    selectPlacementObject(clickedPlacementObject, {
                        openEditor: !shouldUseCompactJardSelection(),
                        redraw: false
                    });
                    if(!isLockedCornerArrangementObject(clickedPlacementObject)) {
                        pendingDraggedPlacementObject = clickedPlacementObject;
                        if(getPlacementType(clickedPlacementObject) === 'jardiniere') pendingDraggedJardiniere = clickedPlacementObject;
                        if(getPlacementType(clickedPlacementObject) === 'banc') pendingDraggedBench = clickedPlacementObject;
                        dragStartX = e.clientX;
                        dragStartY = e.clientY;
                    }
                }

                if(!clickedPlacementObject && !draggedPlacementObject && !pendingDraggedPlacementObject && draggedJardiniere === null && pendingDraggedJardiniere === null && draggedBench === null && pendingDraggedBench === null) {
                    // Désélection uniquement sur vrai clic dans le vide
                    clearJardiniereSelection({ redraw: false });
                    // Dessiner uniquement si l'outil dessin est actif
                    if(isDrawingToolActive) {
                        const prevSegCount = segments.length;
                        const prevSurfaceCount = surfaces.length;
                        const prevConstraintCount = (constraints || []).length;
                        const targetVertex = currentPoint && canStartSegmentFromExistingVertex() && sketchVertexHit ? sketchVertexHit : null;
                        const targetSegmentPoint = !targetVertex && canUseOpeningOverlayPoint(clickedSketchSegment)
                            ? getSketchSegmentProjectedPoint(clickedSketchSegment)
                            : null;
                        const p = targetVertex ? { x: targetVertex.x, y: targetVertex.y } : (targetSegmentPoint || getSnappedPos(e));
                        const forcePrimaryOpeningOverlay = !!targetSegmentPoint && isOpeningOverlayDrawingTool();
                        clearSketchElementSelection({ redraw: false });
                        if(isConstraintTool(drawingMode)) {
                            addConstraintPoint(drawingMode, p);
                            updateCollisionBanner();
                        } else if(drawingMode === 'surface') {
                            if(currentSurfacePoints.length === 0) {
                                currentSurfacePoints = [p];
                                currentPoint = p;
                                markSketchDirtyAndLocked();
                            } else {
                                const firstPoint = currentSurfacePoints[0];
                                const dx = firstPoint.x - p.x;
                                const dy = firstPoint.y - p.y;
                                const dist = Math.sqrt(dx*dx + dy*dy);
                                if(currentSurfacePoints.length >= 3 && dist < 40) {
                                    surfaces.push({
                                        id: 'surface-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                                        points: currentSurfacePoints.map(pt => ({ x: pt.x, y: pt.y })),
                                        material: surfaceMaterial,
                                        heightCm: surfaceHeightCm
                                    });
                                    currentSurfacePoints = [];
                                    currentPoint = null;
                                    markSketchDirtyAndLocked();
                                    build3DArch();
                                } else {
                                    currentSurfacePoints.push(p);
                                    currentPoint = p;
                                    markSketchDirtyAndLocked();
                                }
                            }
                        } else if(drawingMode === 'ceiling-shape') {
                            archOptions.ceiling = true;
                            const ceilingInput = document.getElementById('input-ceiling');
                            if(ceilingInput) ceilingInput.checked = true;
                            const ceilingBtn = document.getElementById('btn-ceiling');
                            if(ceilingBtn) ceilingBtn.classList.add('active');
                            if(currentCeilingPoints.length === 0) {
                                currentCeilingPoints = [p];
                                currentPoint = p;
                            } else {
                                const firstPoint = currentCeilingPoints[0];
                                const dx = firstPoint.x - p.x;
                                const dy = firstPoint.y - p.y;
                                const dist = Math.sqrt(dx * dx + dy * dy);
                                if(currentCeilingPoints.length >= 3 && dist < 40) {
                                    ceilingShapePoints = currentCeilingPoints.map(pt => ({ x: pt.x, y: pt.y }));
                                    currentCeilingPoints = [];
                                    currentPoint = null;
                                    build3DArch();
                                } else {
                                    currentCeilingPoints.push(p);
                                    currentPoint = p;
                                }
                            }
                        } else {
                            if (!currentPoint) {
                                beginSegmentDrawingAtPoint(p, { forcePrimary: forcePrimaryOpeningOverlay, openingOverlay: forcePrimaryOpeningOverlay });
                            } else {
                                // Si les deux extrémités cliquées sont des vertices existants,
                                // chercher un segment reliant currentPoint à p : si trouvé, changer son type.
                                const existingSegIdx = targetVertex ? segments.findIndex(seg => {
                                    if(!seg || !seg.p1 || !seg.p2) return false;
                                    const d1 = Math.abs(seg.p1.x - currentPoint.x) < 1.5 && Math.abs(seg.p1.y - currentPoint.y) < 1.5
                                           && Math.abs(seg.p2.x - p.x) < 1.5 && Math.abs(seg.p2.y - p.y) < 1.5;
                                    const d2 = Math.abs(seg.p2.x - currentPoint.x) < 1.5 && Math.abs(seg.p2.y - currentPoint.y) < 1.5
                                           && Math.abs(seg.p1.x - p.x) < 1.5 && Math.abs(seg.p1.y - p.y) < 1.5;
                                    return d1 || d2;
                                }) : -1;
                                if(existingSegIdx >= 0) {
                                    segments[existingSegIdx].type = drawingMode;
                                    currentPoint = null;
                                    build3DArch();
                                    saveState();
                                } else {
                                const newSegment = {
                                    p1: { x: currentPoint.x, y: currentPoint.y },
                                    p2: p,
                                    type: drawingMode,
                                    detached: detachedDrawingMode,
                                    sketchId: detachedDrawingMode ? activeDetachedSketchId : null,
                                    ...(drawingMode === 'door' ? { swing: 'left' } : {})
                                };
                                if(detachedDrawingMode && typeof findSharedExistingContourSegmentBetween === 'function') {
                                    const sharedSegment = findSharedExistingContourSegmentBetween(newSegment.p1, newSegment.p2, activeDetachedSketchId);
                                    if(sharedSegment) {
                                        // Pilier : garder le type 'post' même sur une arête partagée
                                        if(drawingMode !== 'post') newSegment.type = sharedSegment.type || newSegment.type;
                                        newSegment.sharedContourEdge = true;
                                    }
                                }
                                const insertedOpeningOverlay = insertOpeningOverlaySegment(newSegment);
                                if(!insertedOpeningOverlay) segments.push(newSegment);
                                currentPoint = insertedOpeningOverlay ? null : p;
                                if(insertedOpeningOverlay) {
                                    detachedDrawingMode = false;
                                    activeDetachedSketchId = null;
                                    checkIfContourClosed();
                                    if(isContourClosed) {
                                        isSketchValidated = true;
                                        sketchLockActive = false;
                                        updateSketchLockUI();
                                    } else {
                                        markSketchDirtyAndLocked();
                                    }
                                } else if(detachedDrawingMode) {
                                    isSketchValidated = true;
                                    sketchLockActive = false;
                                    updateSketchLockUI();
                                } else {
                                    checkIfContourClosed(); // Vérifier si le contour se ferme
                                    if(isContourClosed) {
                                        currentPoint = null;
                                        isSketchValidated = true;
                                        sketchLockActive = false;
                                        updateSketchLockUI();
                                    } else {
                                        markSketchDirtyAndLocked();
                                    }
                                }
                                build3DArch();
                                if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
                                } // end else (no existing segment to retype)
                            }
                        }
                        // Sauvegarder seulement si quelque chose de concret a changé (segment/surface/contrainte)
                        if(segments.length !== prevSegCount || surfaces.length !== prevSurfaceCount || (constraints || []).length !== prevConstraintCount) {
                            saveState();
                        }
                    }
                }
            } // end if (!startedResize && !startedRotation)
        }
    }

    draw2D();
});

            canvas2d.addEventListener('mousemove', (e) => {
                if(typeof handleBalconyBuildingPlacementPointerMove2D === 'function'
                    && handleBalconyBuildingPlacementPointerMove2D(e.clientX, e.clientY)) {
                    return;
                }
                if(draggingSketchVertex) {
                    const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                    moveSketchVertexDrag(mouseWorldX, mouseWorldY);
                    hoveredSketchVertex = draggingSketchVertex;
                    draw2D();
                    return;
                } else if(activeCornerArrangementResize && activeCornerArrangementResize.fill) {
                    const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                    updateCornerArrangementResizeFromPointer(activeCornerArrangementResize.fill, activeCornerArrangementResize.key, mouseWorldX, mouseWorldY);
                    draw2D();
                    return;
                } else if(resizingPlacementObject || resizingJardiniere || resizingBench) {
                    const resizingObject = resizingPlacementObject || resizingJardiniere || resizingBench;
                    const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                    const local = worldToJardLocalFromAnchor(
                        resizingObject,
                        mouseWorldX,
                        mouseWorldY,
                        resizeAnchorWorldX,
                        resizeAnchorWorldY
                    );
                    let changed = false;
                    const limits = getPlacementResizeLimits(resizingObject);
                    const resizeThresholdWorld = PLACEMENT_ALIGNMENT_GUIDE_THRESHOLD_SCREEN_PX / Math.max(scale || 1, 0.01);
                    const resizeRot = resizingObject.rot || 0;
                    const isAxisAlignedResize = Math.abs(resizeRot % Math.PI) < 0.15;
                    if(resizeMode === 'w' || resizeMode === 'w-left') {
                        const resizeSign = resizeMode === 'w-left' ? -1 : 1;
                        let nextW = Math.max(limits.wMin, Math.min(limits.wMax, Math.round((resizeSign * local.x) / GRID_SIZE)));
                        if(isAxisAlignedResize) {
                            const candidateRightEdge = resizeAnchorWorldX + resizeSign * Math.round((resizeSign * local.x) / GRID_SIZE) * GRID_SIZE;
                            let bestEdge = null;
                            getConstructionItems().forEach(entry => {
                                const other = entry.item;
                                if(!other || other === resizingObject) return;
                                const ref = getPlacementAlignmentEdgesWorld(other);
                                if(!ref) return;
                                ref.xs.forEach(rx => {
                                    const dist = Math.abs(candidateRightEdge - rx);
                                    if(dist <= resizeThresholdWorld && (!bestEdge || dist < bestEdge.dist)) bestEdge = { dist, x: rx };
                                });
                            });
                            if(bestEdge) nextW = Math.max(limits.wMin, Math.min(limits.wMax, Math.round((resizeSign * (bestEdge.x - resizeAnchorWorldX)) / GRID_SIZE)));
                        }
                        if(nextW !== resizingObject.w) {
                            resizingObject.w = nextW;
                            changed = true;
                        }
                    } else if(resizeMode === 'd') {
                        const resizeSign = 1;
                        let nextD = Math.max(limits.dMin, Math.min(limits.dMax, Math.round((resizeSign * local.y) / GRID_SIZE)));
                        if(isAxisAlignedResize) {
                            const candidateBottomEdge = resizeAnchorWorldY + resizeSign * Math.round((resizeSign * local.y) / GRID_SIZE) * GRID_SIZE;
                            let bestEdge = null;
                            getConstructionItems().forEach(entry => {
                                const other = entry.item;
                                if(!other || other === resizingObject) return;
                                const ref = getPlacementAlignmentEdgesWorld(other);
                                if(!ref) return;
                                ref.ys.forEach(ry => {
                                    const dist = Math.abs(candidateBottomEdge - ry);
                                    if(dist <= resizeThresholdWorld && (!bestEdge || dist < bestEdge.dist)) bestEdge = { dist, y: ry };
                                });
                            });
                            if(bestEdge) nextD = Math.max(limits.dMin, Math.min(limits.dMax, Math.round((resizeSign * (bestEdge.y - resizeAnchorWorldY)) / GRID_SIZE)));
                        }
                        if(nextD !== resizingObject.d) {
                            resizingObject.d = nextD;
                            changed = true;
                        }
                    }

                    if(changed) {
                        const currentAnchorLocal = getResizeAnchorLocalForMode(resizingObject, resizeMode);
                        resizeAnchorLocalX = currentAnchorLocal.x;
                        resizeAnchorLocalY = currentAnchorLocal.y;
                        setJardCenterFromLocalAnchorWorld(resizingObject, resizeAnchorLocalX, resizeAnchorLocalY, resizeAnchorWorldX, resizeAnchorWorldY);
                        rebuildPlacementObject(resizingObject);
                        schedulePlacementSideEffects(resizingObject);
                        updateJardPanel();
                    }
                    updatePlacementAlignmentGuides(resizingObject);
                    draw2D();
                    return;
                } else if(rotatingPlacementObject || rotatingJardiniere || rotatingBench) {
                    const rotatingObject = rotatingPlacementObject || rotatingJardiniere || rotatingBench;
                    const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                    const currentAngle = Math.atan2(mouseWorldY - rotPivotY, mouseWorldX - rotPivotX);
                    const rawRot = rotStartRot - (currentAngle - rotStartMouseAngle);
                    const quantized = Math.round(rawRot / (Math.PI / 8)) * (Math.PI / 8);
                    rotatingObject.rot = quantized;
                    if(rotatingObject.group) {
                        rotatingObject.group.rotation.y = rotatingObject.rot;
                        rotatingObject.group.position.copy(rotatingObject.pos);
                    }
                    schedulePlacementSideEffects(rotatingObject);
                    updateJardPanel();
                    draw2D();
                    return;
                } else if(pendingDraggedPlacementObject || pendingDraggedJardiniere || pendingDraggedBench) {
                    const movedPx = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
                    if(movedPx > JARD_DRAG_THRESHOLD_PX) {
                        saveState();
                        draggedPlacementObject = pendingDraggedPlacementObject || pendingDraggedJardiniere || pendingDraggedBench;
                        draggedJardiniere = getPlacementType(draggedPlacementObject) === 'jardiniere' ? draggedPlacementObject : null;
                        draggedBench = getPlacementType(draggedPlacementObject) === 'banc' ? draggedPlacementObject : null;
                        pendingDraggedPlacementObject = null;
                        pendingDraggedJardiniere = null;
                        pendingDraggedBench = null;
                        hadJardInteraction = true;
                        dragOriginalRot = typeof draggedPlacementObject.rot === 'number' ? draggedPlacementObject.rot : 0;
                        activeWallSnapPlacement = null;
                        activeWallSnapSegmentIndex = null;
                        const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                        const anchor = getJardTopLeftWorld(draggedPlacementObject || draggedJardiniere || draggedBench);
                        dragOffsetWorldX = mouseWorldX - anchor.x;
                        dragOffsetWorldY = mouseWorldY - anchor.y;
                    }
                } else if(draggedPlacementObject || draggedJardiniere || draggedBench) {
                    const draggedObject = draggedPlacementObject || draggedJardiniere || draggedBench;
                    // Déplacer la jardinière en aimantant le coin haut-gauche au quadrillage
                    const { x: mouseWorldX, y: mouseWorldY } = screenToWorld2D(e.clientX, e.clientY);
                    const targetAnchorX = mouseWorldX - dragOffsetWorldX;
                    const targetAnchorY = mouseWorldY - dragOffsetWorldY;

                    const snappedAnchorX = Math.round(targetAnchorX / GRID_SIZE) * GRID_SIZE;
                    const snappedAnchorY = Math.round(targetAnchorY / GRID_SIZE) * GRID_SIZE;

                    const railMountedSnapshot = getPlacementType(draggedObject) === 'hangingPlanter' || getPlacementType(draggedObject) === 'railShelf'
                        ? {
                            x: draggedObject.pos.x,
                            z: draggedObject.pos.z,
                            rot: draggedObject.rot
                        }
                        : null;
                    setJardCenterFromTopLeftWorld(draggedObject, snappedAnchorX, snappedAnchorY);
                    const snappedToSupport = applyWallSnapToPlacement(draggedObject, { x: mouseWorldX, y: mouseWorldY });
                    const lockedRailMountedDrag = railMountedSnapshot && !snappedToSupport;
                    if(lockedRailMountedDrag) {
                        draggedObject.pos.x = railMountedSnapshot.x;
                        draggedObject.pos.z = railMountedSnapshot.z;
                        draggedObject.rot = railMountedSnapshot.rot;
                        if(draggedObject.group) {
                            draggedObject.group.position.copy(draggedObject.pos);
                            draggedObject.group.rotation.y = draggedObject.rot || 0;
                        }
                    }
                    if(!lockedRailMountedDrag && !activeWallSnapPlacement) {
                        const alignSnap = updatePlacementAlignmentGuides(draggedObject);
                        if(alignSnap.dx || alignSnap.dy) {
                            draggedObject.pos.x += alignSnap.dx / 20;
                            draggedObject.pos.z += alignSnap.dy / 20;
                        }
                    } else if(!lockedRailMountedDrag) {
                        updatePlacementAlignmentGuides(draggedObject);
                    }
                    draggedObject.group.position.copy(draggedObject.pos);
                    draggedObject.group.rotation.y = draggedObject.rot || 0;
                    schedulePlacementSideEffects(draggedObject);
                    updateJardFloatingOpenButton();
                    dragStartX = e.clientX;
                    dragStartY = e.clientY;
                } else if(isDragging2d) {
                    if(pendingSlabZoneSelection) {
                        const movedPx = Math.hypot(e.clientX - dragStartX, e.clientY - dragStartY);
                        if(movedPx > JARD_DRAG_THRESHOLD_PX) pendingSlabZoneSelection = null;
                    }
                    const panDx = e.clientX - lastX;
                    const panDy = e.clientY - lastY;
                    if (Math.abs(screenRotation2DDeg) < 1e-6) {
                        offsetX += panDx;
                        offsetY += panDy;
                    } else {
                        const panAngle = -screenRotation2DDeg * Math.PI / 180;
                        const panCos = Math.cos(panAngle);
                        const panSin = Math.sin(panAngle);
                        offsetX += panCos * panDx - panSin * panDy;
                        offsetY += panSin * panDx + panCos * panDy;
                    }
                    lastX = e.clientX; lastY = e.clientY;
                }
                autoPan2DWhileDrawing(e);
                mousePos2d = getSnappedPos(e);
                scheduleLive3DPreviewUpdate();
                
	                // Déterminer si on passe sur une jardinière
	                const { x: clickX, y: clickY } = screenToWorld2D(e.clientX, e.clientY);
	                const hoveredPlacementObject = findPlacementAt2D(clickX, clickY);

	                // Vérifier si on survole les poignées de la jardinière sélectionnée
                const selectedPlacementHoverObject = getSelectedPlacementObject();
	                let onResizeHandle = null;
	                if (selectedPlacementHoverObject) {
	                    onResizeHandle = isLockedCornerArrangementObject(selectedPlacementHoverObject)
                            ? getCornerArrangementResizeHandleHitType(clickX, clickY, selectedPlacementHoverObject)
                            : getResizeHandleHitType(clickX, clickY, selectedPlacementHoverObject);
                }
	                let onRotHandle = false;
	                if (selectedPlacementHoverObject) {
	                    onRotHandle = isOnRotationHandle(clickX, clickY, selectedPlacementHoverObject);
	                }
                hoveredSketchVertex = (!currentPoint || canStartSegmentFromExistingVertex())
                    ? findSketchVertexAt(clickX, clickY, isDispatchingTouchAsMouse ? 26 : 18)
                    : null;
                const hoveredGarlandSnap = findGarlandToolSnapAt(clickX, clickY);

	                hoveredSegmentIndex = -1;
                hoveredSketchSegmentIndex = -1;
	                if(!hoveredPlacementObject && !onResizeHandle && !onRotHandle && !hoveredSketchVertex) {
                    const sketchSegmentHit = findSketchSegmentAt(clickX, clickY, isDispatchingTouchAsMouse ? 20 : 12);
                    if(sketchSegmentHit) {
                        hoveredSketchSegmentIndex = sketchSegmentHit.segmentIndex;
                        if(currentPoint && canUseOpeningOverlayPoint(sketchSegmentHit)) {
                            const projectedPoint = getSketchSegmentProjectedPoint(sketchSegmentHit);
                            if(projectedPoint) mousePos2d = projectedPoint;
                        }
                    }
	                    for(let i = 0; i < measureAreas.length; i++) {
	                        const m = measureAreas[i];
	                        if(clickX >= m.x && clickX <= m.x + m.w && clickY >= m.y && clickY <= m.y + m.h) {
	                            hoveredSegmentIndex = m.segmentIndex;
	                            break;
	                        }
	                    }
	                }
                
                canvas2d.style.cursor = draggingSketchVertex
                    ? 'grabbing'
                    : hoveredSketchVertex
                    ? 'grab'
                    : garlandToolMode
                    ? (hoveredGarlandSnap ? 'pointer' : 'default')
                    : (draggedPlacementObject || draggedJardiniere || draggedBench)
                    ? 'grabbing'
                    : ((activeCornerArrangementResize || resizingPlacementObject || resizingJardiniere || resizingBench)
                        ? 'grabbing'
                        : (onResizeHandle
                            ? 'grab'
                            : (onRotHandle
                                ? 'crosshair'
                                : (hoveredPlacementObject
                                    ? 'grab'
                                    : ((hoveredSegmentIndex >= 0 || hoveredSketchSegmentIndex >= 0) ? 'pointer' : (isDrawingToolActive ? 'crosshair' : 'default'))))));
                draw2D();
            });

            window.addEventListener('mouseup', () => {
                finish2DPointerInteraction();
            });
            canvas2d.addEventListener('contextmenu', e => e.preventDefault());

            canvas2d.addEventListener('wheel', (e) => {
                e.preventDefault();
                if(typeof handleBalconyBuildingPlacementWheel2D === 'function'
                    && handleBalconyBuildingPlacementWheel2D(e)) {
                    return;
                }
                
                // Si Ctrl+Scroll et une jardinière est dragée → tourner
                if(e.ctrlKey && (draggedPlacementObject || draggedJardiniere || draggedBench)) {
                    const draggedObject = draggedPlacementObject || draggedJardiniere || draggedBench;
                    const rotationDelta = e.deltaY > 0 ? -0.05 : 0.05; // En radians
                    draggedObject.rot += rotationDelta;
                    draggedObject.group.rotation.y = draggedObject.rot;
                    schedulePlacementSideEffects(draggedObject);
                    draw2D();
                } else {
                    // Zoom normal
                    const delta = e.deltaY > 0 ? 0.9 : 1.1;
                    const nextScale = Math.min(Math.max(0.01, scale * delta), 5);
                    
                    // Zoom vers la souris (corrigé pour la rotation de la vue)
                    const rect = canvas2d.getBoundingClientRect();
                    const mouseCanvas = unrotateViewCssPoint(e.clientX - rect.left, e.clientY - rect.top);

                    offsetX = mouseCanvas.x - (mouseCanvas.x - offsetX) * (nextScale / scale);
                    offsetY = mouseCanvas.y - (mouseCanvas.y - offsetY) * (nextScale / scale);
                    scale = nextScale;
                    
                    draw2D();
                }
            }, { passive: false });

            canvas2d.addEventListener('touchstart', (e) => {
                if(e.touches.length === 1) {
                    e.preventDefault();
                    activeSingleTouch2d = true;
                    touchStartClientX = e.touches[0].clientX;
                    touchStartClientY = e.touches[0].clientY;
                    pendingSingleTouch2d = true;
                    if(shouldStart2DSingleTouchImmediately(e.touches[0])) {
                        pendingSingleTouch2d = false;
                        dispatch2DTouchAsMouse('mousedown', e.touches[0]);
                    } else {
                        beginTouchDraftPreview(e.touches[0]);
                    }
                } else if(e.touches.length === 2) {
                    e.preventDefault();
                    endTouchDraftPreview();
                    if(activeSingleTouch2d && !pendingSingleTouch2d) finish2DPointerInteraction();
                    activeSingleTouch2d = false;
                    pendingSingleTouch2d = false;
                    begin2DPinch(e);
                }
            }, { passive: false });

            canvas2d.addEventListener('touchmove', (e) => {
                if(typeof requestLightweight2DEnvironment === 'function') requestLightweight2DEnvironment();
                if(isPinching2d && e.touches.length === 2) {
                    e.preventDefault();
                    update2DPinch(e);
                } else if(activeSingleTouch2d && e.touches.length === 1) {
                    e.preventDefault();
                    const touchDraftOnly = pendingSingleTouch2d && canUseTouchDraftPreview();
                    updateTouchDraftPreview(e.touches[0]);
                    if(pendingSingleTouch2d && !isDrawingToolActive) {
                        const dx = e.touches[0].clientX - touchStartClientX;
                        const dy = e.touches[0].clientY - touchStartClientY;
                        if(Math.sqrt(dx * dx + dy * dy) > 8) {
                            pendingSingleTouch2d = false;
                            dispatch2DTouchAsMouse('mousedown', e.touches[0]);
                        }
                    }
                    if(!touchDraftOnly) {
                        dispatch2DTouchAsMouse('mousemove', e.touches[0]);
                        updateTouchDraftMagnifier();
                    }
                }
            }, { passive: false });

            canvas2d.addEventListener('touchend', (e) => {
                if(isPinching2d && e.touches.length < 2) {
                    e.preventDefault();
                    end2DPinch();
                }
                if(activeSingleTouch2d && e.touches.length === 0) {
                    e.preventDefault();
                    if(pendingSingleTouch2d && e.changedTouches.length > 0) {
                        updateTouchDraftPreview(e.changedTouches[0]);
                        dispatch2DTouchAsMouse('mousedown', e.changedTouches[0]);
                    }
                    activeSingleTouch2d = false;
                    pendingSingleTouch2d = false;
                    finish2DPointerInteraction();
                    endTouchDraftPreview();
                    force2DRedrawAfterTouch();
                }
            }, { passive: false });

            canvas2d.addEventListener('touchcancel', () => {
                if(isPinching2d) end2DPinch();
                if(activeSingleTouch2d) {
                    activeSingleTouch2d = false;
                    pendingSingleTouch2d = false;
                    finish2DPointerInteraction();
                    endTouchDraftPreview();
                    force2DRedrawAfterTouch();
                }
            }, { passive: false });

   
        }

        function finish2DPointerInteraction() {
                if(balconyBuildingPlacementDragActive || balconyBuildingPlacementRotating) {
                    balconyBuildingPlacementDragActive = false;
                    balconyBuildingPlacementRotating = false;
                    if(canvas2d) canvas2d.style.cursor = 'grab';
                    draw2D();
                    return;
                }
                const objectToRebuild = (activeCornerArrangementResize && activeCornerArrangementResize.fill) || resizingPlacementObject || draggedPlacementObject || rotatingPlacementObject || resizingJardiniere || draggedJardiniere || rotatingJardiniere || resizingBench || draggedBench || rotatingBench;
                const slabToSelect = pendingSlabZoneSelection;
                pendingSlabZoneSelection = null;
                isDragging2d = false;
                draggingSketchVertex = null;
                mousePos2d = null;
                clearPlacementAlignmentGuides();
                resetPlacementInteractionState();
                if(slabToSelect) {
                    setSelectedSlabZone(slabToSelect.id);
                }
                if(hadJardInteraction) {
                    const hasCrossGarlands = jardinières.some(item => normalizeGarlandLinks(item.garlandLinks).some(link => link.fromJardId || link.toJardId));
                    if(hasCrossGarlands) jardinières.forEach(item => rebuildJardiniere(item));
                    else if(objectToRebuild) rebuildPlacementObject(objectToRebuild);
                    if(objectToRebuild && typeof triggerMagicDustForPlacement === 'function') triggerMagicDustForPlacement(objectToRebuild, { intensity: 'move' });
                    build3DArch();
                    refreshFabricationAndPricing();
                    updateJardPanel();
                    saveState();
                    hadJardInteraction = false;
                } else if(activeMainView === '3d' || activeMainView === 'mixte') {
                    build3DArch();
                }
                draw2D();
        }

        function force2DRedrawAfterTouch() {
            if(typeof clearLightweight2DEnvironment === 'function') clearLightweight2DEnvironment();
            draw2D();
            requestAnimationFrame(() => draw2D());
        }

        function ensureTouchDraftMagnifier() {
            if(touchDraftMagnifierEl) return;
            touchDraftMagnifierEl = document.createElement('div');
            touchDraftMagnifierEl.className = 'touch-draft-magnifier';
            touchDraftMagnifierCanvas = document.createElement('canvas');
            touchDraftMagnifierCanvas.width = 132;
            touchDraftMagnifierCanvas.height = 132;
            touchDraftMagnifierLabel = document.createElement('div');
            touchDraftMagnifierLabel.className = 'length-label';
            touchDraftMagnifierLabel.textContent = '';
            touchDraftMagnifierEl.appendChild(touchDraftMagnifierCanvas);
            touchDraftMagnifierEl.appendChild(touchDraftMagnifierLabel);
            document.body.appendChild(touchDraftMagnifierEl);
        }

        function canUseTouchDraftPreview() {
            return isDrawingToolActive && !isConstraintTool(drawingMode);
        }

        function getTouchDraftStartPoint() {
            if(drawingMode === 'ceiling-shape' && currentCeilingPoints.length > 0) {
                return currentCeilingPoints[currentCeilingPoints.length - 1];
            }
            if(drawingMode === 'surface' && currentSurfacePoints.length > 0) {
                return currentSurfacePoints[currentSurfacePoints.length - 1];
            }
            return currentPoint;
        }

        function getTouchDraftLengthText() {
            const start = getTouchDraftStartPoint();
            if(!start || !mousePos2d) return '';
            const dx = mousePos2d.x - start.x;
            const dy = mousePos2d.y - start.y;
            return Math.round(Math.sqrt(dx * dx + dy * dy) * 0.5) + ' cm';
        }

        function beginTouchDraftPreview(touch) {
            if(!touch || !canUseTouchDraftPreview()) return;
            touchDraftActive = true;
            touchDraftMagnifierVisible = false;
            updateTouchDraftPreview(touch);
            clearTimeout(touchDraftMagnifierTimer);
            touchDraftMagnifierTimer = setTimeout(() => {
                if(!touchDraftActive) return;
                touchDraftMagnifierVisible = true;
                updateTouchDraftMagnifier();
            }, TOUCH_DRAFT_MAGNIFIER_DELAY_MS);
        }

        function updateTouchDraftPreview(touch) {
            if(!touchDraftActive || !touch || !canUseTouchDraftPreview()) return;
            touchDraftClientX = touch.clientX;
            touchDraftClientY = touch.clientY;
            autoPan2DWhileDrawing(touch);
            mousePos2d = getSnappedPos(touch);
            scheduleLive3DPreviewUpdate();
            draw2D();
            updateTouchDraftMagnifier();
        }

        function endTouchDraftPreview() {
            touchDraftActive = false;
            touchDraftMagnifierVisible = false;
            clearTimeout(touchDraftMagnifierTimer);
            touchDraftMagnifierTimer = null;
            if(touchDraftMagnifierEl) touchDraftMagnifierEl.classList.remove('visible');
            mousePos2d = null;
        }

        function updateTouchDraftMagnifier() {
            if(!touchDraftActive || !touchDraftMagnifierVisible || !touchDraftMagnifierEl || !touchDraftMagnifierCanvas) return;
            const viewportMargin = 12;
            const lensW = 132;
            const lensH = 158;
            const x = Math.min(window.innerWidth - viewportMargin - lensW / 2, Math.max(viewportMargin + lensW / 2, touchDraftClientX));
            const y = Math.min(window.innerHeight - viewportMargin, Math.max(viewportMargin + lensH, touchDraftClientY - 34));
            touchDraftMagnifierEl.style.left = x + 'px';
            touchDraftMagnifierEl.style.top = y + 'px';
            touchDraftMagnifierEl.classList.add('visible');
            if(touchDraftMagnifierLabel) {
                touchDraftMagnifierLabel.textContent = getTouchDraftLengthText();
                touchDraftMagnifierLabel.style.display = touchDraftMagnifierLabel.textContent ? 'block' : 'none';
            }

            const rect = canvas2d.getBoundingClientRect();
            const dprX = canvas2d.width / Math.max(1, rect.width);
            const dprY = canvas2d.height / Math.max(1, rect.height);
            const sourceSizeCss = 74;
            const sw = sourceSizeCss * dprX;
            const sh = sourceSizeCss * dprY;
            if(canvas2d.width <= sw || canvas2d.height <= sh) return;
            const sx = Math.min(canvas2d.width - sw, Math.max(0, (touchDraftClientX - rect.left - sourceSizeCss / 2) * dprX));
            const sy = Math.min(canvas2d.height - sh, Math.max(0, (touchDraftClientY - rect.top - sourceSizeCss / 2) * dprY));
            const magCtx = touchDraftMagnifierCanvas.getContext('2d');
            magCtx.clearRect(0, 0, touchDraftMagnifierCanvas.width, touchDraftMagnifierCanvas.height);
            magCtx.save();
            magCtx.beginPath();
            magCtx.arc(66, 66, 64, 0, Math.PI * 2);
            magCtx.clip();
            magCtx.imageSmoothingEnabled = false;
            magCtx.drawImage(canvas2d, sx, sy, sw, sh, 0, 0, 132, 132);
            magCtx.restore();
            magCtx.strokeStyle = 'rgba(255,255,255,0.9)';
            magCtx.lineWidth = 1;
            magCtx.beginPath();
            magCtx.moveTo(66, 52);
            magCtx.lineTo(66, 80);
            magCtx.moveTo(52, 66);
            magCtx.lineTo(80, 66);
            magCtx.stroke();
        }

        function dispatch2DTouchAsMouse(type, touch) {
            if(!touch || !canvas2d) return;
            const event = new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                view: window,
                clientX: touch.clientX,
                clientY: touch.clientY,
                screenX: touch.screenX,
                screenY: touch.screenY,
                button: 0,
                buttons: type === 'mouseup' ? 0 : 1
            });
            isDispatchingTouchAsMouse = true;
            try {
                canvas2d.dispatchEvent(event);
            } finally {
                isDispatchingTouchAsMouse = false;
            }
        }

        function getTouchWorldPos(touch) {
            return screenToWorld2D(touch.clientX, touch.clientY);
        }

        function shouldStart2DSingleTouchImmediately(touch) {
            if(!touch) return false;
            if(!isDrawingToolActive) return true;
            const pos = getTouchWorldPos(touch);
            if(findSketchVertexAt(pos.x, pos.y, 28)) return true;
            const selectedPlacement = getSelectedPlacementObject();
            if(selectedPlacement) {
                if(isLockedCornerArrangementObject(selectedPlacement)) {
                    if(getCornerArrangementResizeHandleHitType(pos.x, pos.y, selectedPlacement)) return true;
                } else {
                    if(getResizeHandleHitType(pos.x, pos.y, selectedPlacement)) return true;
                    if(isOnRotationHandle(pos.x, pos.y, selectedPlacement)) return true;
                }
            }
            if(findPlacementAt2D(pos.x, pos.y, 18 / scale)) return true;
            for(let i = 0; i < measureAreas.length; i++) {
                const m = measureAreas[i];
                if(pos.x >= m.x && pos.x <= m.x + m.w && pos.y >= m.y && pos.y <= m.y + m.h) return true;
            }
            return false;
        }

        function getTouchDistance(touches) {
            const dx = touches[0].clientX - touches[1].clientX;
            const dy = touches[0].clientY - touches[1].clientY;
            return Math.sqrt(dx * dx + dy * dy);
        }

        function getTouchCenterInCanvas(touches) {
            const rect = canvas2d.getBoundingClientRect();
            return {
                x: (touches[0].clientX + touches[1].clientX) / 2 - rect.left,
                y: (touches[0].clientY + touches[1].clientY) / 2 - rect.top
            };
        }

        function begin2DPinch(e) {
            isPinching2d = true;
            isDragging2d = false;
            draggingSketchVertex = null;
            resetPlacementInteractionState();
            pinchStartDistance = Math.max(1, getTouchDistance(e.touches));
            pinchStartScale = scale;
            pinchStartOffsetX = offsetX;
            pinchStartOffsetY = offsetY;
            const center = getTouchCenterInCanvas(e.touches);
            const uCenter = unrotateViewCssPoint(center.x, center.y);
            pinchCenterX = uCenter.x;
            pinchCenterY = uCenter.y;
        }

        function update2DPinch(e) {
            if(typeof requestLightweight2DEnvironment === 'function') requestLightweight2DEnvironment();
            const center = getTouchCenterInCanvas(e.touches);
            const uCenter = unrotateViewCssPoint(center.x, center.y);
            const distance = Math.max(1, getTouchDistance(e.touches));
            const nextScale = Math.min(Math.max(0.01, pinchStartScale * (distance / pinchStartDistance)), 5);
            const ratio = nextScale / pinchStartScale;

            offsetX = uCenter.x - (pinchCenterX - pinchStartOffsetX) * ratio;
            offsetY = uCenter.y - (pinchCenterY - pinchStartOffsetY) * ratio;
            scale = nextScale;
            draw2D();
        }

        function end2DPinch() {
            isPinching2d = false;
            if(typeof clearLightweight2DEnvironment === 'function') clearLightweight2DEnvironment();
            draw2D();
        }

        function unrotateViewCssPoint(cssX, cssY) {
            if (Math.abs(screenRotation2DDeg) < 1e-6) return { x: cssX, y: cssY };
            const rect = canvas2d.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const angle = -screenRotation2DDeg * Math.PI / 180;
            const dx = cssX - cx;
            const dy = cssY - cy;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        }

        function rotateViewCssPoint(cssX, cssY) {
            if (Math.abs(screenRotation2DDeg) < 1e-6) return { x: cssX, y: cssY };
            const rect = canvas2d.getBoundingClientRect();
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const angle = screenRotation2DDeg * Math.PI / 180;
            const dx = cssX - cx;
            const dy = cssY - cy;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return { x: cx + dx * cos - dy * sin, y: cy + dx * sin + dy * cos };
        }

        function rotateView2D(deltaDeg) {
            screenRotation2DDeg += deltaDeg;
            if (typeof syncSun2dControls === 'function') syncSun2dControls();
            draw2D();
        }

        function resetView2DAngle() {
            screenRotation2DDeg = 0;
            if (typeof syncSun2dControls === 'function') syncSun2dControls();
            draw2D();
        }

        function openCompass2DPopup() {
            const popup = document.getElementById('compass-2d-popup');
            if (!popup) return;
            if (popup.style.display === 'block') { popup.style.display = 'none'; return; }
            popup.style.display = 'block';
        }

        function closeCompass2DPopup() {
            const popup = document.getElementById('compass-2d-popup');
            if (popup) popup.style.display = 'none';
        }

        function updateCompass2DPopupUI() {}

        function screenToWorld2D(clientX, clientY) {
            const rect = canvas2d.getBoundingClientRect();
            const cssPos = unrotateViewCssPoint(clientX - rect.left, clientY - rect.top);
            const rawX = (cssPos.x - offsetX) / scale;
            const rawY = (cssPos.y - offsetY) / scale;
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            const shiftedX = rawX - (Number.isFinite(balconyOffsetX) ? balconyOffsetX * 20 : 0) - (pivot.x || 0);
            const shiftedY = rawY - (Number.isFinite(balconyOffsetZ) ? balconyOffsetZ * 20 : 0) - (pivot.y || 0);
            const sceneRot = (balconyOrientationDeg - balconyWorldOrientationDeg) * Math.PI / 180;
            const cosR = Math.cos(-sceneRot);
            const sinR = Math.sin(-sceneRot);
            const unrotated = Math.abs(sceneRot) < 1e-9
                ? { x: shiftedX, y: shiftedY }
                : { x: shiftedX * cosR - shiftedY * sinR, y: shiftedX * sinR + shiftedY * cosR };
            return {
                x: unrotated.x + (pivot.x || 0),
                y: unrotated.y + (pivot.y || 0)
            };
        }

        function screenToFixedWorld2D(clientX, clientY) {
            const rect = canvas2d.getBoundingClientRect();
            const cssPos = unrotateViewCssPoint(clientX - rect.left, clientY - rect.top);
            return {
                x: (cssPos.x - offsetX) / scale,
                y: (cssPos.y - offsetY) / scale
            };
        }

        function worldToScreen2D(worldX, worldY) {
            const sceneRot = (balconyOrientationDeg - balconyWorldOrientationDeg) * Math.PI / 180;
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            const dx = worldX - (pivot.x || 0);
            const dy = worldY - (pivot.y || 0);
            const offsetX2d = Number.isFinite(balconyOffsetX) ? balconyOffsetX * 20 : 0;
            const offsetY2d = Number.isFinite(balconyOffsetZ) ? balconyOffsetZ * 20 : 0;
            if(Math.abs(sceneRot) < 1e-9) return {
                x: worldX + offsetX2d,
                y: worldY + offsetY2d
            };
            const cosR = Math.cos(sceneRot);
            const sinR = Math.sin(sceneRot);
            return {
                x: dx * cosR - dy * sinR + (pivot.x || 0) + offsetX2d,
                y: dx * sinR + dy * cosR + (pivot.y || 0) + offsetY2d
            };
        }

        function worldToClient2D(worldX, worldY) {
            const rect = canvas2d.getBoundingClientRect();
            const transformed = worldToScreen2D(worldX, worldY);
            const css = rotateViewCssPoint(
                transformed.x * scale + offsetX,
                transformed.y * scale + offsetY
            );
            return {
                x: rect.left + css.x,
                y: rect.top + css.y
            };
        }

function getSnappedPos(e) {
    // 1. On trouve la position de la souris "dans le monde" (en tenant compte du pan, zoom et rotation)
    const rawPoint = screenToWorld2D(e.clientX, e.clientY);
    return getSnappedDrawingPoint(rawPoint, e);
}

function getSnappedDrawingPoint(rawPoint, e) {
    let { x, y } = rawPoint;
    const rawX = x, rawY = y;

    drawingSnapGuides = [];
    const geometrySnap = getDrawingGeometrySnap({ x, y }, e);
    const geometryGuides = drawingSnapGuides.slice();
    const geometryGuideOnly = geometryGuides.some(guide => guide && (guide.type === 'vertex-continuation' || guide.type === 'vertex-perpendicular'));

    // 2. On l'aimante sur la grille de 20 pixels (qui correspond à 10cm)
    x = Math.round(x / 20) * 20;
    y = Math.round(y / 20) * 20;

    const ortho = getOrthogonalDrawingSnap({ x, y }, e);
    if(ortho) {
        addCurrentPointContinuationGuideForPoint(ortho, e);
        const axisSnap = getAxisAlignmentSnap({ x: rawX, y: rawY });
        if(axisSnap) {
            // Fusionner: l'ortho verrouille un axe, l'alignement de sommet affine l'autre
            const isVertical = ortho.x === currentPoint.x;
            const isHorizontal = ortho.y === currentPoint.y;
            if(isVertical) return { x: ortho.x, y: axisSnap.y };
            if(isHorizontal) return { x: axisSnap.x, y: ortho.y };
        }
        return { x: ortho.x, y: ortho.y };
    }

    if(geometrySnap) {
        addCurrentPointContinuationGuideForPoint(geometrySnap, e);
        addCurrentPointPerpendicularGuideForPoint(geometrySnap, e);
        if(!geometryGuideOnly) return geometrySnap;
    }

    // Alignement axial avec les sommets existants (même X ou même Y)
    const axisSnap = getAxisAlignmentSnap({ x: rawX, y: rawY });
    if(axisSnap) return axisSnap;

    return { x, y };
}

        function canStartSegmentFromExistingVertex() {
            return (isDrawingToolActive || !!draggingSketchVertex)
                && !isConstraintTool(drawingMode)
                && drawingMode !== 'surface'
                && drawingMode !== 'ceiling-shape';
        }

        function getDrawingReferenceSegmentsAtPoint(point) {
            if(!point) return [];
            const refs = [];
            segments.forEach(seg => {
                if(!seg || !seg.p1 || !seg.p2) return;
                const atP1 = Math.abs(seg.p1.x - point.x) < 2 && Math.abs(seg.p1.y - point.y) < 2;
                const atP2 = Math.abs(seg.p2.x - point.x) < 2 && Math.abs(seg.p2.y - point.y) < 2;
                if(atP1 || atP2) refs.push({ segment: seg, source: 'sketch', atP1, atP2 });
            });
            if(typeof getMyBuildingLocalSegments === 'function') {
                const buildingHitPx = isDispatchingTouchAsMouse ? 18 : 12;
                const buildingTolerance = buildingHitPx / Math.max(scale, 0.001);
                getMyBuildingLocalSegments().forEach(seg => {
                    if(!seg || !seg.p1 || !seg.p2) return;
                    const projection = projectPointToSegment2D(point.x, point.y, seg.p1, seg.p2);
                    if(!projection) return;
                    const dist = Math.hypot(projection.x - point.x, projection.y - point.y);
                    if(dist > buildingTolerance) return;
                    refs.push({
                        segment: seg,
                        source: 'building',
                        atP1: Math.hypot(seg.p1.x - point.x, seg.p1.y - point.y) <= buildingTolerance,
                        atP2: Math.hypot(seg.p2.x - point.x, seg.p2.y - point.y) <= buildingTolerance,
                        projected: projection
                    });
                });
            }
            return refs;
        }

        function getDrawingGeometrySnap(point, e) {
            if(!point || !canStartSegmentFromExistingVertex()) return null;
            const vertexHitPx = isDispatchingTouchAsMouse ? 26 : 18;
            const segmentHitPx = isDispatchingTouchAsMouse ? 20 : 12;
            const vertex = findSketchVertexAt(point.x, point.y, vertexHitPx);
            if(vertex) {
                addEndpointVertexDrawingGuide(vertex);
                return { x: vertex.x, y: vertex.y };
            }
            const segmentHit = findSketchSegmentAt(point.x, point.y, segmentHitPx);
            if(segmentHit && segmentHit.projected) {
                addDrawingSnapGuides({
                    type: 'segment-snap',
                    p1: segmentHit.segment.p1,
                    p2: segmentHit.segment.p2,
                    snap: segmentHit.projected
                });
                return getSketchSegmentProjectedPoint(segmentHit);
            }
            const buildingSnap = findMyBuildingGeometrySnap(point, vertexHitPx, segmentHitPx);
            if(buildingSnap) return buildingSnap;

            // Extension snap: snap to la prolongation d'un segment existant (au-delà de ses extrémités)
            if(currentPoint) {
                const extHitPx = isDispatchingTouchAsMouse ? 14 : 9;
                let bestExt = null;
                segments.forEach(seg => {
                    if(!seg || !seg.p1 || !seg.p2) return;
                    const proj = projectPointToLine2D(point.x, point.y, seg.p1, seg.p2);
                    if(!proj) return;
                    if(proj.t >= 0.01 && proj.t <= 0.99) return; // on segment, already handled above
                    const dist = Math.hypot(proj.x - point.x, proj.y - point.y) * scale;
                    if(dist <= extHitPx && (!bestExt || dist < bestExt.dist)) {
                        bestExt = { x: proj.x, y: proj.y, dist, p1: seg.p1, p2: seg.p2, t: proj.t };
                    }
                });
                if(bestExt) {
                    const snap = { x: bestExt.x, y: bestExt.y };
                    addDrawingSnapGuides({ type: 'segment-continuation', p1: bestExt.p1, p2: bestExt.p2, snap }, { replace: true });
                    return { x: bestExt.x, y: bestExt.y };
                }
            }

            return null;
        }

        function findMyBuildingGeometrySnap(point, vertexHitPx, segmentHitPx) {
            if(!point || typeof getMyBuildingLocalSegments !== 'function') return null;
            const buildingSegs = getMyBuildingLocalSegments();
            if(!buildingSegs || !buildingSegs.length) return null;
            let bestVertex = null;
            let bestSegment = null;
            buildingSegs.forEach(seg => {
                if(!seg || !seg.p1 || !seg.p2) return;
                [seg.p1, seg.p2].forEach(pt => {
                    const dist = Math.hypot(pt.x - point.x, pt.y - point.y) * scale;
                    if(dist <= vertexHitPx && (!bestVertex || dist < bestVertex.dist)) {
                        bestVertex = { x: pt.x, y: pt.y, dist, segment: seg };
                    }
                });
                const proj = projectPointToSegment2D(point.x, point.y, seg.p1, seg.p2);
                if(proj) {
                    const dist = Math.hypot(proj.x - point.x, proj.y - point.y) * scale;
                    if(dist <= segmentHitPx && (!bestSegment || dist < bestSegment.dist)) {
                        bestSegment = { x: proj.x, y: proj.y, dist, segment: seg };
                    }
                }
            });
            if(bestVertex) {
                addEndpointVertexDrawingGuide({
                    x: bestVertex.x,
                    y: bestVertex.y,
                    refs: [{ referenceSegment: bestVertex.segment }]
                });
                addDrawingSnapGuides({
                    type: 'segment-snap',
                    p1: bestVertex.segment.p1,
                    p2: bestVertex.segment.p2,
                    snap: { x: bestVertex.x, y: bestVertex.y }
                });
                return { x: bestVertex.x, y: bestVertex.y };
            }
            if(bestSegment) {
                addDrawingSnapGuides({
                    type: 'segment-snap',
                    p1: bestSegment.segment.p1,
                    p2: bestSegment.segment.p2,
                    snap: { x: bestSegment.x, y: bestSegment.y }
                });
                return { x: bestSegment.x, y: bestSegment.y };
            }
            return null;
        }

        function addEndpointVertexDrawingGuide(vertex) {
            if(!currentPoint || !vertex || !vertex.refs || !vertex.refs.length) return;
            const dx = vertex.x - currentPoint.x;
            const dy = vertex.y - currentPoint.y;
            const drawLen = Math.hypot(dx, dy);
            if(drawLen < GRID_SIZE * 0.5) return;
            const drawUx = dx / drawLen;
            const drawUy = dy / drawLen;
            const tolerance = Math.tan(ORTHOGONAL_DRAWING_SNAP_DEG * Math.PI / 180);
            const guides = [];
            vertex.refs.forEach(ref => {
                const seg = ref.referenceSegment || segments[ref.segmentIndex];
                if(!seg || !seg.p1 || !seg.p2) return;
                const vx = seg.p2.x - seg.p1.x;
                const vy = seg.p2.y - seg.p1.y;
                const len = Math.hypot(vx, vy);
                if(len < 1) return;
                const ux = vx / len;
                const uy = vy / len;
                const parallelOffset = Math.abs(drawUx * uy - drawUy * ux);
                const perpendicularOffset = Math.abs(drawUx * ux + drawUy * uy);
                if(parallelOffset <= tolerance) {
                    guides.push({
                        score: parallelOffset,
                        type: 'vertex-continuation',
                        anchor: { x: vertex.x, y: vertex.y },
                        snap: { x: vertex.x, y: vertex.y },
                        ux,
                        uy
                    });
                }
                if(perpendicularOffset <= tolerance) {
                    guides.push({
                        score: perpendicularOffset,
                        type: 'vertex-perpendicular',
                        anchor: { x: vertex.x, y: vertex.y },
                        snap: { x: vertex.x, y: vertex.y },
                        ux: -uy,
                        uy: ux,
                        wallUx: ux,
                        wallUy: uy
                    });
                }
            });
            if(guides.length) {
                const bestScore = Math.min(...guides.map(guide => guide.score));
                const compatibleGuides = guides
                    .filter(guide => guide.score <= bestScore + tolerance * 0.45)
                    .filter((guide, index, list) => list.findIndex(other =>
                        other.type === guide.type &&
                        Math.abs((other.anchor && other.anchor.x) - (guide.anchor && guide.anchor.x)) < 0.5 &&
                        Math.abs((other.anchor && other.anchor.y) - (guide.anchor && guide.anchor.y)) < 0.5 &&
                        Math.abs((other.ux || 0) - (guide.ux || 0)) < 0.001 &&
                        Math.abs((other.uy || 0) - (guide.uy || 0)) < 0.001
                    ) === index);
                addDrawingSnapGuides(compatibleGuides, { replace: true });
            }
        }

        function areGuidePointsClose(a, b, tolerance = 0.5) {
            if(!a || !b) return false;
            return Math.abs(a.x - b.x) <= tolerance && Math.abs(a.y - b.y) <= tolerance;
        }

        function isSameDrawingGuide(a, b) {
            if(!a || !b || a.type !== b.type) return false;
            if((a.type === 'current-continuation' || a.type === 'vertex-continuation' || a.type === 'vertex-perpendicular') &&
                areGuidePointsClose(a.anchor, b.anchor) &&
                Math.abs((a.ux || 0) - (b.ux || 0)) < 0.001 &&
                Math.abs((a.uy || 0) - (b.uy || 0)) < 0.001) {
                return true;
            }
            if((a.type === 'perpendicular' || a.type === 'segment-continuation' || a.type === 'segment-snap') &&
                areGuidePointsClose(a.snap, b.snap) &&
                Math.abs((a.ux || 0) - (b.ux || 0)) < 0.001 &&
                Math.abs((a.uy || 0) - (b.uy || 0)) < 0.001) {
                return true;
            }
            return false;
        }

        function addDrawingSnapGuides(guides, options = {}) {
            const list = Array.isArray(guides) ? guides : [guides];
            if(options.replace) drawingSnapGuides = [];
            list.forEach(guide => {
                if(!guide) return;
                if(drawingSnapGuides.some(existing => isSameDrawingGuide(existing, guide))) return;
                drawingSnapGuides.push(guide);
            });
        }

        function addCurrentPointContinuationGuideForPoint(point, e) {
            if(!point || !currentPoint || !canStartSegmentFromExistingVertex()) return false;
            if(e && e.altKey) return false;
            const dx = point.x - currentPoint.x;
            const dy = point.y - currentPoint.y;
            const drawLen = Math.hypot(dx, dy);
            if(drawLen < GRID_SIZE * 0.5) return false;
            const drawUx = dx / drawLen;
            const drawUy = dy / drawLen;
            const tolerance = Math.tan(ORTHOGONAL_DRAWING_SNAP_DEG * Math.PI / 180);
            const guides = [];
            for(const ref of getDrawingReferenceSegmentsAtPoint(currentPoint)) {
                const seg = ref.segment;
                if(!seg || !seg.p1 || !seg.p2) continue;
                let vx = seg.p2.x - seg.p1.x;
                let vy = seg.p2.y - seg.p1.y;
                if(ref.source !== 'building') {
                    const other = ref.atP1 ? seg.p2 : seg.p1;
                    vx = currentPoint.x - other.x;
                    vy = currentPoint.y - other.y;
                } else if(vx * drawUx + vy * drawUy < 0) {
                    vx = -vx;
                    vy = -vy;
                }
                const len = Math.hypot(vx, vy);
                if(len < 1) continue;
                const ux = vx / len;
                const uy = vy / len;
                const parallelOffset = Math.abs(drawUx * uy - drawUy * ux);
                const sameDirection = drawUx * ux + drawUy * uy;
                if(parallelOffset <= tolerance && sameDirection > 0) {
                    guides.push({
                        score: parallelOffset,
                        type: 'current-continuation',
                        anchor: { x: currentPoint.x, y: currentPoint.y },
                        snap: { x: point.x, y: point.y },
                        ux,
                        uy
                    });
                }
                const isAxisAlignedWall = ref.source === 'building' || Math.abs(uy) < 0.01 || Math.abs(ux) < 0.01;
                const dotWithWall = Math.abs(drawUx * ux + drawUy * uy);
                const pux = -uy;
                const puy = ux;
                const dotWithPerp = drawUx * pux + drawUy * puy;
                if(isAxisAlignedWall && dotWithWall <= tolerance && Math.abs(dotWithPerp) > 0.5) {
                    const gux = dotWithPerp > 0 ? pux : -pux;
                    const guy = dotWithPerp > 0 ? puy : -puy;
                    guides.push({
                        score: dotWithWall,
                        type: 'current-continuation',
                        anchor: { x: currentPoint.x, y: currentPoint.y },
                        snap: { x: point.x, y: point.y },
                        ux: gux,
                        uy: guy
                    });
                }
            }
            if(!guides.length) return false;
            const bestScore = Math.min(...guides.map(guide => guide.score));
            addDrawingSnapGuides(guides.filter(guide => guide.score <= bestScore + tolerance * 0.45));
            return true;
        }

        function getCurrentPointContinuationSnap(point, e) {
            if(!point || !currentPoint || !canStartSegmentFromExistingVertex()) return null;
            if(e && e.altKey) return null;
            const hitPx = isDispatchingTouchAsMouse ? 16 : 10;
            const toleranceWorld = hitPx / Math.max(scale, 0.001);
            const matches = [];
            for(const ref of getDrawingReferenceSegmentsAtPoint(currentPoint)) {
                const seg = ref.segment;
                if(!seg || !seg.p1 || !seg.p2) continue;
                let vx = seg.p2.x - seg.p1.x;
                let vy = seg.p2.y - seg.p1.y;
                if(ref.source !== 'building') {
                    const other = ref.atP1 ? seg.p2 : seg.p1;
                    vx = currentPoint.x - other.x;
                    vy = currentPoint.y - other.y;
                }
                const len = Math.hypot(vx, vy);
                if(len < 1) continue;
                let ux = vx / len;
                let uy = vy / len;
                const relX = point.x - currentPoint.x;
                const relY = point.y - currentPoint.y;
                let t = relX * ux + relY * uy;
                if(ref.source === 'building' && t < 0) {
                    ux = -ux;
                    uy = -uy;
                    t = -t;
                }
                if(t < GRID_SIZE * 0.5) continue;
                const snap = { x: currentPoint.x + ux * t, y: currentPoint.y + uy * t };
                const dist = Math.hypot(point.x - snap.x, point.y - snap.y);
                if(dist > toleranceWorld) continue;
                matches.push({
                    dist,
                    snap,
                    guide: {
                        type: 'current-continuation',
                        anchor: { x: currentPoint.x, y: currentPoint.y },
                        snap,
                        ux,
                        uy
                    }
                });
            }
            if(!matches.length) return null;
            const best = matches.reduce((acc, match) => !acc || match.dist < acc.dist ? match : acc, null);
            const guides = matches
                .filter(match => Math.hypot(match.snap.x - best.snap.x, match.snap.y - best.snap.y) <= toleranceWorld * 0.5)
                .map(match => match.guide);
            addDrawingSnapGuides(guides);
            return best.snap;
        }

        function addCurrentPointPerpendicularGuideForPoint(point, e) {
            if(!point || !currentPoint || !canStartSegmentFromExistingVertex()) return false;
            if(e && e.altKey) return false;
            const dx = point.x - currentPoint.x;
            const dy = point.y - currentPoint.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if(absDx < GRID_SIZE * 0.25 && absDy < GRID_SIZE * 0.25) return false;
            const tolerance = Math.tan(ORTHOGONAL_DRAWING_SNAP_DEG * Math.PI / 180);
            const guides = [];
            for(const ref of getDrawingReferenceSegmentsAtPoint(currentPoint)) {
                const seg = ref.segment;
                if(!seg || !seg.p1 || !seg.p2) continue;
                const sdx = seg.p2.x - seg.p1.x;
                const sdy = seg.p2.y - seg.p1.y;
                const sLen = Math.hypot(sdx, sdy);
                if(sLen < 1) continue;
                const pux = -sdy / sLen;
                const puy = sdx / sLen;
                const dotSeg = (dx * sdx + dy * sdy) / sLen;
                const dotPerp = (dx * (-sdy) + dy * sdx) / sLen;
                const absDotPerp = Math.abs(dotPerp);
                if(absDotPerp > 1 && Math.abs(dotSeg) / absDotPerp <= tolerance) {
                    const guideUx = dotPerp >= 0 ? pux : -pux;
                    const guideUy = dotPerp >= 0 ? puy : -puy;
                    const guideType = ref.source === 'building' ? 'vertex-perpendicular' : 'perpendicular';
                    const guide = {
                        type: guideType,
                        anchor: { x: currentPoint.x, y: currentPoint.y },
                        snap: { x: point.x, y: point.y },
                        ux: guideUx,
                        uy: guideUy,
                        wallUx: sdx / sLen,
                        wallUy: sdy / sLen
                    };
                    guides.push(guide);
                }
            }
            addDrawingSnapGuides(guides);
            return guides.length > 0;
        }

        function findExistingVertexDrawingAlignmentSnap(point) {
            if(!point || !currentPoint) return null;
            const hitPx = isDispatchingTouchAsMouse ? 15 : 9;
            const toleranceWorld = hitPx / Math.max(scale, 0.001);
            const maxGuideReach = GRID_SIZE * 120; // 12 m de portée pour les guides d'axe/perpendiculaire.
            const matches = [];
            getSketchVertexEntries().forEach(vertex => {
                if(!vertex.refs || !vertex.refs.length) return;
                if(Math.hypot(vertex.x - currentPoint.x, vertex.y - currentPoint.y) < GRID_SIZE * 0.5) return;
                vertex.refs.forEach(ref => {
                    const seg = segments[ref.segmentIndex];
                    if(!seg || !seg.p1 || !seg.p2) return;
                    const vx = seg.p2.x - seg.p1.x;
                    const vy = seg.p2.y - seg.p1.y;
                    const len = Math.hypot(vx, vy);
                    if(len < 1) return;
                    const ux = vx / len;
                    const uy = vy / len;
                    [
                        { type: 'vertex-continuation', ux, uy },
                        { type: 'vertex-perpendicular', ux: -uy, uy: ux, wallUx: ux, wallUy: uy }
                    ].forEach(candidate => {
                        const relX = point.x - vertex.x;
                        const relY = point.y - vertex.y;
                        const t = relX * candidate.ux + relY * candidate.uy;
                        if(Math.abs(t) > maxGuideReach) return;
                        const snap = {
                            x: vertex.x + candidate.ux * t,
                            y: vertex.y + candidate.uy * t
                        };
                        const dist = Math.hypot(point.x - snap.x, point.y - snap.y);
                        if(dist > toleranceWorld) return;
                        const fromCurrent = Math.hypot(snap.x - currentPoint.x, snap.y - currentPoint.y);
                        if(fromCurrent < GRID_SIZE * 0.5) return;
                        matches.push({
                            dist,
                            snap,
                            guide: {
                                type: candidate.type,
                                anchor: { x: vertex.x, y: vertex.y },
                                snap,
                                ux: candidate.ux,
                                uy: candidate.uy,
                                wallUx: candidate.wallUx,
                                wallUy: candidate.wallUy
                            }
                        });
                    });
                });
            });
            if(!matches.length) return null;
            const best = matches.reduce((acc, match) => !acc || match.dist < acc.dist ? match : acc, null);
            const guideMergeTolerance = Math.max(2 / Math.max(scale, 0.001), toleranceWorld * 0.35);
            const guides = matches
                .filter(match => Math.hypot(match.snap.x - best.snap.x, match.snap.y - best.snap.y) <= guideMergeTolerance)
                .map(match => match.guide)
                .filter((guide, index, list) => list.findIndex(other =>
                    other.type === guide.type &&
                    Math.abs(other.anchor.x - guide.anchor.x) < 0.5 &&
                    Math.abs(other.anchor.y - guide.anchor.y) < 0.5 &&
                    Math.abs((other.ux || 0) - (guide.ux || 0)) < 0.001 &&
                    Math.abs((other.uy || 0) - (guide.uy || 0)) < 0.001
                ) === index);
            return { dist: best.dist, snap: best.snap, guide: best.guide, guides };
        }

        function getAxisAlignmentSnap(rawPoint) {
            if(!rawPoint || !currentPoint) return null;
            const hitPx = isDispatchingTouchAsMouse ? 18 : 12;
            const toleranceWorld = hitPx / Math.max(scale, 0.001);
            let bestX = null, bestY = null;
            getSketchVertexEntries().forEach(vertex => {
                if(Math.hypot(vertex.x - currentPoint.x, vertex.y - currentPoint.y) < GRID_SIZE * 0.5) return;
                const distX = Math.abs(vertex.x - rawPoint.x);
                const distY = Math.abs(vertex.y - rawPoint.y);
                if(distX <= toleranceWorld && (!bestX || distX < bestX.dist)) {
                    bestX = { x: vertex.x, y: vertex.y, dist: distX };
                }
                if(distY <= toleranceWorld && (!bestY || distY < bestY.dist)) {
                    bestY = { x: vertex.x, y: vertex.y, dist: distY };
                }
            });
            if(!bestX && !bestY) return null;
            const snapX = bestX ? bestX.x : Math.round(rawPoint.x / GRID_SIZE) * GRID_SIZE;
            const snapY = bestY ? bestY.y : Math.round(rawPoint.y / GRID_SIZE) * GRID_SIZE;
            const snap = { x: snapX, y: snapY };
            if(bestX) {
                addDrawingSnapGuides({ type: 'vertex-continuation', anchor: { x: bestX.x, y: bestX.y }, snap, ux: 0, uy: 1 });
            }
            if(bestY) {
                addDrawingSnapGuides({ type: 'vertex-continuation', anchor: { x: bestY.x, y: bestY.y }, snap, ux: 1, uy: 0 });
            }
            return snap;
        }

        function beginSegmentDrawingAtPoint(point, options = {}) {
            if(!point) return;
            currentPoint = { x: point.x, y: point.y };
            if(options.openingOverlay) currentPoint.openingOverlay = true;
            detachedDrawingMode = !options.forcePrimary && isContourClosed && isSketchValidated && getPrimaryContourSegments().length >= 3;
            if(detachedDrawingMode && !activeDetachedSketchId) {
                activeDetachedSketchId = 'detached-' + (nextDetachedSketchId++);
            }
            if(!detachedDrawingMode) {
                markSketchDirtyAndLocked();
            } else {
                updateSketchLockUI();
            }
        }

        function getOrthogonalDrawingSnap(point, e) {
            if(!point || !currentPoint || !canStartSegmentFromExistingVertex()) return null;
            if(e && e.altKey) return null;
            const dx = point.x - currentPoint.x;
            const dy = point.y - currentPoint.y;
            const absDx = Math.abs(dx);
            const absDy = Math.abs(dy);
            if(absDx < GRID_SIZE * 0.25 && absDy < GRID_SIZE * 0.25) return null;
            if(e && e.shiftKey) {
                return absDx >= absDy
                    ? { x: point.x, y: currentPoint.y }
                    : { x: currentPoint.x, y: point.y };
            }
            const tolerance = Math.tan(ORTHOGONAL_DRAWING_SNAP_DEG * Math.PI / 180);
            if(absDx > 0 && absDy / absDx <= tolerance) return { x: point.x, y: currentPoint.y };
            if(absDy > 0 && absDx / absDy <= tolerance) return { x: currentPoint.x, y: point.y };

            const continuationSnap = getCurrentPointContinuationSnap(point, e);
            if(continuationSnap) return continuationSnap;

            // Snap perpendiculaire aux segments adjacents (pour tracer d'équerre par rapport à une paroi oblique)
            const perpendicularMatches = [];
            for(const ref of getDrawingReferenceSegmentsAtPoint(currentPoint)) {
                const seg = ref.segment;
                if(!seg || !seg.p1 || !seg.p2) continue;
                const sdx = seg.p2.x - seg.p1.x;
                const sdy = seg.p2.y - seg.p1.y;
                const sLen = Math.hypot(sdx, sdy);
                if(sLen < 1) continue;
                // Vecteur perpendiculaire au segment
                const pux = -sdy / sLen;
                const puy = sdx / sLen;
                // Composante de la direction souris le long du segment et de sa perpendiculaire
                const dotSeg = (dx * sdx + dy * sdy) / sLen;
                const dotPerp = (dx * (-sdy) + dy * sdx) / sLen;
                const absDotPerp = Math.abs(dotPerp);
                if(absDotPerp > 1 && Math.abs(dotSeg) / absDotPerp <= tolerance) {
                    const guideUx = dotPerp >= 0 ? pux : -pux;
                    const guideUy = dotPerp >= 0 ? puy : -puy;
                    const t = Math.abs(dotPerp);
                    const snapPt = { x: currentPoint.x + guideUx * t, y: currentPoint.y + guideUy * t };
                    const guideType = ref.source === 'building' ? 'vertex-perpendicular' : 'perpendicular';
                    perpendicularMatches.push({
                        snap: snapPt,
                        guide: {
                            type: guideType,
                            anchor: { x: currentPoint.x, y: currentPoint.y },
                            snap: snapPt,
                            ux: guideUx,
                            uy: guideUy,
                            wallUx: sdx / sLen,
                            wallUy: sdy / sLen
                        }
                    });
                }
            }
            if(perpendicularMatches.length) {
                const best = perpendicularMatches.reduce((acc, match) => {
                    const dist = Math.hypot(point.x - match.snap.x, point.y - match.snap.y);
                    return !acc || dist < acc.dist ? { ...match, dist } : acc;
                }, null);
                perpendicularMatches
                    .filter(match => Math.hypot(match.snap.x - best.snap.x, match.snap.y - best.snap.y) <= GRID_SIZE * 0.15)
                    .forEach(match => addDrawingSnapGuides(match.guide));
                addCurrentPointContinuationGuideForPoint(best.snap, e);
                return best.snap;
            }

            return null;
        }

        function autoPan2DWhileDrawing() {
            return false;
        }

        function getSketchPointKey(point) {
            if(!point) return '';
            return `${Math.round(point.x * 100) / 100}:${Math.round(point.y * 100) / 100}`;
        }

        function clearSketchElementSelection(options = {}) {
            const { redraw = false } = options;
            selectedSketchSegmentIndex = -1;
            selectedSketchVertexKey = null;
            if(redraw) draw2D();
        }

        function selectSketchVertex(vertex, options = {}) {
            const { redraw = true } = options;
            if(typeof setSelectedSlabZone === 'function') setSelectedSlabZone(null, { redraw: false });
            selectedSketchVertexKey = getSketchPointKey(vertex);
            selectedSketchSegmentIndex = -1;
            if(redraw) draw2D();
        }

        function selectSketchSegment(segmentIndex, options = {}) {
            const { redraw = true } = options;
            if(typeof setSelectedSlabZone === 'function') setSelectedSlabZone(null, { redraw: false });
            selectedSketchSegmentIndex = typeof segmentIndex === 'number' ? segmentIndex : -1;
            selectedSketchVertexKey = null;
            if(redraw) draw2D();
        }

        function getSketchVertexEntries() {
            const entries = [];
            segments.forEach((segment, segmentIndex) => {
                if(segment.p1) entries.push({ point: segment.p1, segmentIndex, endpoint: 'p1', key: getSketchPointKey(segment.p1), x: segment.p1.x, y: segment.p1.y });
                if(segment.p2) entries.push({ point: segment.p2, segmentIndex, endpoint: 'p2', key: getSketchPointKey(segment.p2), x: segment.p2.x, y: segment.p2.y });
            });

            const grouped = new Map();
            entries.forEach(entry => {
                if(!grouped.has(entry.key)) {
                    grouped.set(entry.key, { x: entry.x, y: entry.y, refs: [] });
                }
                grouped.get(entry.key).refs.push({ point: entry.point, segmentIndex: entry.segmentIndex, endpoint: entry.endpoint });
            });
            return Array.from(grouped.values());
        }

        function findSketchVertexAt(worldX, worldY, hitPx = 18) {
            let best = null;
            getSketchVertexEntries().forEach(vertex => {
                const distScreen = Math.hypot(vertex.x - worldX, vertex.y - worldY) * scale;
                if(distScreen <= hitPx && (!best || distScreen < best.distScreen)) {
                    best = { ...vertex, distScreen };
                }
            });
            return best;
        }

        function clearCornerArrangementPanel() {
            pendingCornerArrangement = null;
            const target = document.getElementById('corner-arrangement-results');
            if(target) target.innerHTML = '';
        }

        function syncCornerArrangementToolButton() {
            const btn = document.getElementById('btn-corner-arrangement-tool');
            if(btn) btn.classList.toggle('active', !!cornerArrangementMode);
        }

        function startCornerArrangementTool() {
            if(cornerArrangementMode) {
                stopCornerArrangementTool({ clearPanel: true });
                return;
            }
            cornerArrangementMode = true;
            clearCornerArrangementPanel();
            if(currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
            if(activeMainView !== '2d' && activeMainView !== 'mixte') setMainView('2d');
            clearJardiniereSelection({ redraw: false });
            clearSketchElementSelection({ redraw: false });
            const target = document.getElementById('corner-arrangement-results');
            if(target) {
                target.innerHTML = `
                    <div class="layout-advisor-summary">
                        <strong>Aménager un angle</strong>
                        Cliquez un sommet intérieur du balcon.
                    </div>
                `;
            }
            syncCornerArrangementToolButton();
            draw2D();
        }

        function stopCornerArrangementTool(options = {}) {
            cornerArrangementMode = false;
            if(options.clearPanel) clearCornerArrangementPanel();
            syncCornerArrangementToolButton();
            draw2D();
        }

        function getCornerArrangementContext(vertex) {
            if(!vertex || !Array.isArray(vertex.refs) || vertex.refs.length < 2) return null;
            const usableRefs = vertex.refs
                .map(ref => segments[ref.segmentIndex])
                .filter(segment => segment && segment.p1 && segment.p2 && isEditableContourSegmentType(segment.type));
            const unique = [];
            usableRefs.forEach(segment => {
                const other = arePointsClose2D(segment.p1, vertex) ? segment.p2 : segment.p1;
                if(!other || Math.hypot(other.x - vertex.x, other.y - vertex.y) < 10) return;
                if(unique.some(entry => Math.hypot(entry.other.x - other.x, entry.other.y - other.y) < 0.5)) return;
                unique.push({ segment, other });
            });
            if(unique.length < 2) return null;
            const a = unique[0];
            const b = unique[1];
            const dirA = normalize2D({ x: a.other.x - vertex.x, y: a.other.y - vertex.y });
            const dirB = normalize2D({ x: b.other.x - vertex.x, y: b.other.y - vertex.y });
            if(!dirA || !dirB) return null;
            let bisector = normalize2D({ x: dirA.x + dirB.x, y: dirA.y + dirB.y });
            const polygon = getPrimaryContourPolygon2D();
            if(polygon.length >= 3 && bisector && typeof pointInPolygon === 'function') {
                const inside = pointInPolygon({ x: vertex.x + bisector.x * 45, y: vertex.y + bisector.y * 45 }, polygon);
                if(!inside) bisector = normalize2D({ x: -bisector.x, y: -bisector.y });
            }
            return {
                corner: { x: vertex.x, y: vertex.y },
                dirA,
                dirB,
                bisector: bisector || dirA,
                segmentA: a.segment,
                segmentB: b.segment
            };
        }

        function normalize2D(v) {
            const len = Math.hypot(v.x, v.y);
            if(len < 0.0001) return null;
            return { x: v.x / len, y: v.y / len };
        }

        function add2D(a, v, scaleValue = 1) {
            return { x: a.x + v.x * scaleValue, y: a.y + v.y * scaleValue };
        }

        function getInwardNormalForCornerEdge(corner, dir, polygon, towardDir = null) {
            const left = { x: -dir.y, y: dir.x };
            const right = { x: dir.y, y: -dir.x };
            if(towardDir) {
                const leftScore = left.x * towardDir.x + left.y * towardDir.y;
                const rightScore = right.x * towardDir.x + right.y * towardDir.y;
                if(Math.abs(leftScore - rightScore) > 0.0001) return leftScore > rightScore ? left : right;
            }
            if(polygon && polygon.length >= 3 && typeof pointInPolygon === 'function') {
                const mid = add2D(corner, dir, 55);
                const leftInside = pointInPolygon(add2D(mid, left, 35), polygon);
                const rightInside = pointInPolygon(add2D(mid, right, 35), polygon);
                if(leftInside && !rightInside) return left;
                if(rightInside && !leftInside) return right;
            }
            return left;
        }

        function getCornerArrangementBasis(layout) {
            const normalized = normalizeCornerArrangementLayout(layout);
            if(!normalized.corner || !normalized.dirA || !normalized.dirB) return null;
            const polygon = getPrimaryContourPolygon2D();
            const nA = getInwardNormalForCornerEdge(normalized.corner, normalized.dirA, polygon, normalized.dirB);
            const nB = getInwardNormalForCornerEdge(normalized.corner, normalized.dirB, polygon, normalized.dirA);
            return { layout: normalized, corner: normalized.corner, dirA: normalized.dirA, dirB: normalized.dirB, nA, nB };
        }

        function lineIntersectionFromPointDir(a, da, b, db) {
            const denom = da.x * db.y - da.y * db.x;
            if(Math.abs(denom) < 0.000001) return null;
            const qx = b.x - a.x;
            const qy = b.y - a.y;
            const t = (qx * db.y - qy * db.x) / denom;
            return { x: a.x + da.x * t, y: a.y + da.y * t };
        }

        function isLockedCornerArrangementObject(obj) {
            return !!(obj && getPlacementType(obj) === 'cornerFill' && obj.sourceCorner && obj.sourceCorner.corner && obj.sourceCorner.dirA && obj.sourceCorner.dirB);
        }

        function buildCornerArrangementWorldPoints(context, model) {
            const lenA = (model.lenA || 100) * 2;
            const lenB = (model.lenB || model.lenA || 100) * 2;
            const depthA = (model.depthA || model.depth || 55) * 2;
            const depthB = (model.depthB || model.depth || 55) * 2;
            const enabledA = model.enabledA !== false;
            const enabledB = model.enabledB !== false;
            const polygon = getPrimaryContourPolygon2D();
            const nA = getInwardNormalForCornerEdge(context.corner, context.dirA, polygon, context.dirB);
            const nB = getInwardNormalForCornerEdge(context.corner, context.dirB, polygon, context.dirA);
            const wallA = add2D(context.corner, context.dirA, lenA);
            const wallB = add2D(context.corner, context.dirB, lenB);
            const frontA = add2D(wallA, nA, depthA);
            const frontB = add2D(wallB, nB, depthB);
            const rootA = add2D(context.corner, nA, depthA);
            const rootB = add2D(context.corner, nB, depthB);
            if(enabledA && !enabledB) return [context.corner, wallA, frontA, rootA];
            if(!enabledA && enabledB) return [context.corner, wallB, frontB, rootB];
            if(!enabledA && !enabledB) return [];
            const offsetA = rootA;
            const offsetB = rootB;
            const inner = lineIntersectionFromPointDir(offsetA, context.dirA, offsetB, context.dirB);
            if(model.faceStyle === 'rounded') {
                const averageDepth = (depthA + depthB) / 2;
                const control = inner || add2D(context.corner, context.bisector, averageDepth * 1.35);
                const arc = [];
                const steps = 10;
                for(let i = 1; i < steps; i++) {
                    const t = i / steps;
                    const x = (1 - t) * (1 - t) * frontA.x + 2 * (1 - t) * t * control.x + t * t * frontB.x;
                    const y = (1 - t) * (1 - t) * frontA.y + 2 * (1 - t) * t * control.y + t * t * frontB.y;
                    arc.push({ x, y });
                }
                return [context.corner, wallA, frontA, ...arc, frontB, wallB];
            }
            if(inner) return [context.corner, wallA, frontA, inner, frontB, wallB];
            return [context.corner, wallA, frontA, frontB, wallB];
        }

        function getCornerArrangementModel(modelKey) {
            return getCornerArrangementModels().find(entry => entry.key === modelKey) || getCornerArrangementModels()[0];
        }

        function normalizeCornerArrangementLayout(layout, fallbackModelKey = 'fill') {
            const model = getCornerArrangementModel((layout && layout.model) || fallbackModelKey);
            const legacyDepth = typeof (layout && layout.depth) === 'number' ? layout.depth : model.depth;
            let enabledA = !(layout && layout.enabledA === false);
            let enabledB = !(layout && layout.enabledB === false);
            if(!enabledA && !enabledB) enabledA = true;
            return {
                model: model.key,
                corner: layout && layout.corner ? layout.corner : null,
                dirA: layout && layout.dirA ? normalize2D(layout.dirA) : null,
                dirB: layout && layout.dirB ? normalize2D(layout.dirB) : null,
                enabledA,
                enabledB,
                lenA: typeof (layout && layout.lenA) === 'number' ? layout.lenA : model.lenA,
                lenB: typeof (layout && layout.lenB) === 'number' ? layout.lenB : model.lenB,
                depthA: typeof (layout && layout.depthA) === 'number' ? layout.depthA : legacyDepth,
                depthB: typeof (layout && layout.depthB) === 'number' ? layout.depthB : legacyDepth,
                depth: legacyDepth
            };
        }

        function contextToCornerArrangementLayout(context, modelKey) {
            const model = getCornerArrangementModel(modelKey);
            return normalizeCornerArrangementLayout({
                model: model.key,
                corner: { x: context.corner.x, y: context.corner.y },
                dirA: { x: context.dirA.x, y: context.dirA.y },
                dirB: { x: context.dirB.x, y: context.dirB.y },
                enabledA: true,
                enabledB: true,
                lenA: model.lenA,
                lenB: model.lenB,
                depthA: model.depth,
                depthB: model.depth,
                depth: model.depth
            }, model.key);
        }

        function layoutToCornerArrangementContext(layout) {
            const normalized = normalizeCornerArrangementLayout(layout);
            if(!normalized.corner || !normalized.dirA || !normalized.dirB) return null;
            return {
                corner: normalized.corner,
                dirA: normalized.dirA,
                dirB: normalized.dirB,
                bisector: normalize2D({ x: normalized.dirA.x + normalized.dirB.x, y: normalized.dirA.y + normalized.dirB.y }) || normalized.dirA
            };
        }

        function buildCornerArrangementShapeFromLayout(layout) {
            const normalized = normalizeCornerArrangementLayout(layout);
            const model = { ...getCornerArrangementModel(normalized.model), ...normalized };
            const context = layoutToCornerArrangementContext(normalized);
            if(!context) return null;
            const worldPoints = buildCornerArrangementWorldPoints(context, model);
            if(!worldPoints || worldPoints.length < 3) return null;
            const cx = worldPoints.reduce((sum, p) => sum + p.x, 0) / worldPoints.length;
            const cy = worldPoints.reduce((sum, p) => sum + p.y, 0) / worldPoints.length;
            const localDm = worldPoints.map(p => ({ x: (p.x - cx) / 20, z: (p.y - cy) / 20 }));
            const minX = Math.min(...localDm.map(p => p.x));
            const maxX = Math.max(...localDm.map(p => p.x));
            const minZ = Math.min(...localDm.map(p => p.z));
            const maxZ = Math.max(...localDm.map(p => p.z));
            return {
                model,
                layout: normalized,
                x: cx / 20,
                z: cy / 20,
                w: Math.max(4, maxX - minX),
                d: Math.max(3, maxZ - minZ),
                h: model.h / 10,
                shapePoints: localDm
            };
        }

        function applyCornerArrangementLayoutToFill(fill, layout, options = {}) {
            if(!fill) return false;
            const shape = buildCornerArrangementShapeFromLayout(layout);
            if(!shape) return false;
            const model = shape.model;
            if(options.commit) saveState();
            fill.pos.x = shape.x;
            fill.pos.z = shape.z;
            fill.w = shape.w;
            fill.d = shape.d;
            fill.h = shape.h;
            fill.faceStyle = model.faceStyle;
            fill.purpose = model.purpose;
            fill.woodColor = model.color || fill.woodColor;
            fill.shapePoints = shape.shapePoints;
            fill.sourceCorner = {
                ...shape.layout,
                corner: { x: shape.layout.corner.x, y: shape.layout.corner.y },
                dirA: { x: shape.layout.dirA.x, y: shape.layout.dirA.y },
                dirB: { x: shape.layout.dirB.x, y: shape.layout.dirB.y }
            };
            if(options.live2dOnly) {
                if(options.updatePanel !== false) updateJardPanel();
                draw2D();
                return true;
            }
            rebuildPlacementObject(fill);
            updateJardPanel();
            refreshFabricationAndPricing();
            draw2D();
            return true;
        }

        function createCornerArrangementObject(modelKey) {
            if(!pendingCornerArrangement || !pendingCornerArrangement.context) return null;
            const model = getCornerArrangementModel(modelKey);
            if(!model) return null;
            const layout = contextToCornerArrangementLayout(pendingCornerArrangement.context, model.key);
            const shape = buildCornerArrangementShapeFromLayout(layout);
            if(!shape) return null;
            saveState();
            const created = createConstruction('cornerFill', {
                x: shape.x,
                z: shape.z,
                w: shape.w,
                d: shape.d,
                h: shape.h,
                faceStyle: model.faceStyle,
                purpose: model.purpose,
                woodColor: model.color,
                shapePoints: shape.shapePoints,
                sourceCorner: shape.layout
            });
            if(created) {
                selectPlacementObject(created, { openEditor: true, redraw: false });
                refreshFabricationAndPricing();
                build3DArch();
                stopCornerArrangementTool({ clearPanel: true });
                draw2D();
            }
            return created;
        }

        function cycleSelectedCornerArrangementModel(delta = 1) {
            const fill = getSelectedPlacementObject();
            if(getPlacementType(fill) !== 'cornerFill' || !fill.sourceCorner) return false;
            const models = getCornerArrangementModels();
            const currentIndex = Math.max(0, models.findIndex(model => model.key === fill.sourceCorner.model));
            const next = models[(currentIndex + delta + models.length) % models.length];
            const currentLayout = normalizeCornerArrangementLayout(fill.sourceCorner, next.key);
            const nextLayout = normalizeCornerArrangementLayout({
                ...currentLayout,
                model: next.key,
                lenA: currentLayout.lenA,
                lenB: currentLayout.lenB,
                depthA: currentLayout.depthA,
                depthB: currentLayout.depthB
            }, next.key);
            return applyCornerArrangementLayoutToFill(fill, nextLayout, { commit: true });
        }

        function updateSelectedCornerArrangementDimension(key, value, commit = true) {
            const fill = getSelectedPlacementObject();
            if(getPlacementType(fill) !== 'cornerFill' || !fill.sourceCorner) return false;
            const layout = normalizeCornerArrangementLayout(fill.sourceCorner);
            if(key === 'enabledA' || key === 'enabledB') {
                layout[key] = !!value;
                if(!layout.enabledA && !layout.enabledB) layout[key === 'enabledA' ? 'enabledB' : 'enabledA'] = true;
            } else {
                const val = parseFloat(value);
                if(!Number.isFinite(val)) return false;
                const isDepth = key === 'depthA' || key === 'depthB' || key === 'depth';
                const clamped = Math.max(isDepth ? 25 : 40, Math.min(isDepth ? 120 : 260, val));
                if(key === 'depth') {
                    layout.depthA = clamped;
                    layout.depthB = clamped;
                    layout.depth = clamped;
                } else if(key === 'lenA' || key === 'lenB' || key === 'depthA' || key === 'depthB') {
                    layout[key] = clamped;
                    layout.depth = Math.round(((layout.depthA || clamped) + (layout.depthB || clamped)) / 2);
                } else {
                    return false;
                }
            }
            return applyCornerArrangementLayoutToFill(fill, layout, { commit });
        }

        function getCornerArrangementResizeHandles(fill) {
            if(!isLockedCornerArrangementObject(fill)) return [];
            const basis = getCornerArrangementBasis(fill.sourceCorner);
            if(!basis) return [];
            const layout = basis.layout;
            const handles = [];
            const addHandle = (key, label, point, angle, enabled = true) => {
                if(!enabled || !point) return;
                handles.push({ key, label, x: point.x, y: point.y, angle });
            };
            const lenA = (layout.lenA || 100) * 2;
            const lenB = (layout.lenB || 100) * 2;
            const depthA = (layout.depthA || layout.depth || 55) * 2;
            const depthB = (layout.depthB || layout.depth || 55) * 2;
            const hasA = layout.enabledA !== false;
            const hasB = layout.enabledB !== false;
            const freeStartA = hasA && hasB ? Math.min(lenA * 0.72, depthB) : 0;
            const freeStartB = hasA && hasB ? Math.min(lenB * 0.72, depthA) : 0;
            if(layout.enabledA !== false) {
                addHandle(
                    'lenA',
                    'BA',
                    add2D(add2D(basis.corner, basis.dirA, freeStartA + Math.max(0, lenA - freeStartA) * 0.5), basis.nA, depthA * 0.5),
                    Math.atan2(basis.dirA.y, basis.dirA.x)
                );
                addHandle(
                    'depthA',
                    'BA',
                    add2D(add2D(basis.corner, basis.dirA, freeStartA + Math.max(0, lenA - freeStartA) * 0.5), basis.nA, depthA),
                    Math.atan2(basis.nA.y, basis.nA.x)
                );
            }
            if(layout.enabledB !== false) {
                addHandle(
                    'lenB',
                    'BC',
                    add2D(add2D(basis.corner, basis.dirB, freeStartB + Math.max(0, lenB - freeStartB) * 0.5), basis.nB, depthB * 0.5),
                    Math.atan2(basis.dirB.y, basis.dirB.x)
                );
                addHandle(
                    'depthB',
                    'BC',
                    add2D(add2D(basis.corner, basis.dirB, freeStartB + Math.max(0, lenB - freeStartB) * 0.5), basis.nB, depthB),
                    Math.atan2(basis.nB.y, basis.nB.x)
                );
            }
            return handles;
        }

        function getCornerArrangementResizeHandleHitType(clickXWorld, clickYWorld, fill) {
            const hitRadius = 17 / Math.max(scale || 1, 0.01);
            const handles = getCornerArrangementResizeHandles(fill);
            for(let i = handles.length - 1; i >= 0; i--) {
                const h = handles[i];
                if(Math.hypot(clickXWorld - h.x, clickYWorld - h.y) <= hitRadius) return h.key;
            }
            return null;
        }

        function updateCornerArrangementResizeFromPointer(fill, key, worldX, worldY) {
            if(!isLockedCornerArrangementObject(fill)) return false;
            const basis = getCornerArrangementBasis(fill.sourceCorner);
            if(!basis) return false;
            const layout = basis.layout;
            const rel = { x: worldX - basis.corner.x, y: worldY - basis.corner.y };
            const project = (v) => rel.x * v.x + rel.y * v.y;
            if(key === 'lenA') layout.lenA = Math.max(40, Math.min(260, Math.round(project(basis.dirA) / 2)));
            else if(key === 'lenB') layout.lenB = Math.max(40, Math.min(260, Math.round(project(basis.dirB) / 2)));
            else if(key === 'depthA') layout.depthA = Math.max(25, Math.min(120, Math.round(project(basis.nA) / 2)));
            else if(key === 'depthB') layout.depthB = Math.max(25, Math.min(120, Math.round(project(basis.nB) / 2)));
            else return false;
            layout.depth = Math.round(((layout.depthA || layout.depth || 55) + (layout.depthB || layout.depth || 55)) / 2);
            return applyCornerArrangementLayoutToFill(fill, layout, { commit: false, live2dOnly: true, updatePanel: false });
        }

        function getCornerArrangementSlatRuns2D(fill, options = {}) {
            if(!isLockedCornerArrangementObject(fill)) return [];
            const basis = getCornerArrangementBasis(fill.sourceCorner);
            if(!basis) return [];
            const layout = basis.layout;
            const shape = buildCornerArrangementShapeFromLayout(layout);
            if(!shape || !Array.isArray(shape.shapePoints) || shape.shapePoints.length < 3) return [];
            const localToWorld = (p) => ({ x: shape.x * 20 + p.x * 20, y: shape.z * 20 + p.z * 20 });
            const worldPoints = shape.shapePoints.map(localToWorld);
            const lenA = layout.enabledA !== false ? (layout.lenA || 0) : 0;
            const lenB = layout.enabledB !== false ? (layout.lenB || 0) : 0;
            const mainDir = lenB > lenA ? basis.dirB : basis.dirA;
            const crossDir = lenB > lenA ? basis.nB : basis.nA;
            const spacing = options.spacing || 28;
            const inset = options.inset || 8;
            const dot = (p, v) => p.x * v.x + p.y * v.y;
            const projections = worldPoints.map(p => dot(p, mainDir));
            const minT = Math.min(...projections) + inset;
            const maxT = Math.max(...projections) - inset;
            const runs = [];
            if(maxT <= minT) return runs;
            for(let t = minT; t <= maxT + 0.001; t += spacing) {
                const hits = [];
                for(let i = 0; i < worldPoints.length; i++) {
                    const a = worldPoints[i];
                    const b = worldPoints[(i + 1) % worldPoints.length];
                    const da = dot(a, mainDir) - t;
                    const db = dot(b, mainDir) - t;
                    if(Math.abs(da) < 0.0001 && Math.abs(db) < 0.0001) continue;
                    if((da <= 0 && db >= 0) || (da >= 0 && db <= 0)) {
                        const denom = da - db;
                        if(Math.abs(denom) < 0.0001) continue;
                        const u = da / denom;
                        if(u < -0.0001 || u > 1.0001) continue;
                        const x = a.x + (b.x - a.x) * u;
                        const y = a.y + (b.y - a.y) * u;
                        hits.push({ x, y, c: x * crossDir.x + y * crossDir.y });
                    }
                }
                hits.sort((a, b) => a.c - b.c);
                for(let i = 0; i + 1 < hits.length; i += 2) {
                    const start = hits[i];
                    const end = hits[i + 1];
                    const dx = end.x - start.x;
                    const dy = end.y - start.y;
                    const len = Math.hypot(dx, dy);
                    if(len <= inset * 2) continue;
                    const ux = dx / len;
                    const uy = dy / len;
                    runs.push({
                        a: { x: start.x + ux * inset, y: start.y + uy * inset },
                        b: { x: end.x - ux * inset, y: end.y - uy * inset }
                    });
                }
            }
            return runs;
        }

        function clipPolygonByHalfPlane2D(points, normal, limit, keepGreater) {
            if(!Array.isArray(points) || points.length < 3) return [];
            const dot = (p) => p.x * normal.x + p.y * normal.y;
            const inside = (p) => keepGreater ? dot(p) >= limit - 0.0001 : dot(p) <= limit + 0.0001;
            const clipped = [];
            for(let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const aInside = inside(a);
                const bInside = inside(b);
                if(aInside) clipped.push(a);
                if(aInside !== bInside) {
                    const da = dot(a) - limit;
                    const db = dot(b) - limit;
                    const denom = da - db;
                    if(Math.abs(denom) > 0.000001) {
                        const t = da / denom;
                        clipped.push({
                            x: a.x + (b.x - a.x) * t,
                            y: a.y + (b.y - a.y) * t
                        });
                    }
                }
            }
            return clipped;
        }

        function getCornerArrangementSlatPolygons2D(fill, options = {}) {
            if(!isLockedCornerArrangementObject(fill)) return [];
            const basis = getCornerArrangementBasis(fill.sourceCorner);
            if(!basis) return [];
            const layout = basis.layout;
            const shape = buildCornerArrangementShapeFromLayout(layout);
            if(!shape || !Array.isArray(shape.shapePoints) || shape.shapePoints.length < 3) return [];
            const worldPoints = shape.shapePoints.map(p => ({ x: shape.x * 20 + p.x * 20, y: shape.z * 20 + p.z * 20 }));
            const lenA = layout.enabledA !== false ? (layout.lenA || 0) : 0;
            const lenB = layout.enabledB !== false ? (layout.lenB || 0) : 0;
            const alongDir = lenB > lenA ? basis.dirB : basis.dirA;
            const widthDir = lenB > lenA ? basis.nB : basis.nA;
            const spacing = options.spacing || 30;
            const slatWidth = options.slatWidth || 18;
            const inset = options.inset || 7;
            const dot = (p, v) => p.x * v.x + p.y * v.y;
            const alongValues = worldPoints.map(p => dot(p, alongDir));
            const minT = Math.min(...alongValues) + inset;
            const maxT = Math.max(...alongValues) - inset;
            if(maxT <= minT) return [];
            const result = [];
            for(let centerT = minT; centerT <= maxT + 0.001; centerT += spacing) {
                let poly = worldPoints.map(p => ({ x: p.x, y: p.y }));
                poly = clipPolygonByHalfPlane2D(poly, alongDir, centerT - slatWidth / 2, true);
                poly = clipPolygonByHalfPlane2D(poly, alongDir, centerT + slatWidth / 2, false);
                if(poly.length < 3) continue;
                const xs = poly.map(p => p.x);
                const ys = poly.map(p => p.y);
                result.push({
                    points: poly,
                    center: {
                        x: xs.reduce((sum, x) => sum + x, 0) / xs.length,
                        y: ys.reduce((sum, y) => sum + y, 0) / ys.length
                    }
                });
            }
            return result;
        }

        function getCornerArrangementModels() {
            return [
                { key: 'fill', title: 'Comble-angle', intent: 'Tablette ou coffre simple', lenA: 85, lenB: 85, depth: 48, h: 55, faceStyle: 'straight', purpose: 'fill', color: '#6a4b38' },
                { key: 'seat', title: 'Méridienne d’angle', intent: 'Assise qui repart droit sur les deux murs', lenA: 175, lenB: 135, depth: 78, h: 45, faceStyle: 'straight', purpose: 'seat', color: '#72513d' },
                { key: 'rounded', title: 'Angle arrondi à lattes', intent: 'Façade courbe avec lattes verticales', lenA: 155, lenB: 155, depth: 70, h: 45, faceStyle: 'rounded', purpose: 'seat', color: '#6f7f63' },
                { key: 'planter', title: 'Jardinière d’angle', intent: 'Bac polygonal calé sur les deux murs', lenA: 115, lenB: 115, depth: 58, h: 70, faceStyle: 'straight', purpose: 'planter', color: '#4a3228' }
            ];
        }

        function showCornerArrangementProposals(context) {
            pendingCornerArrangement = { context };
            const target = document.getElementById('corner-arrangement-results');
            if(!target) return;
            target.innerHTML = getCornerArrangementModels().map(model => `
                <div class="layout-advisor-proposal">
                    <div class="layout-advisor-proposal-title">${model.title}</div>
                    <div class="layout-advisor-proposal-intent">${model.intent}</div>
                    <button class="jp-btn btn-positive" onclick="createCornerArrangementObject('${model.key}')">Créer</button>
                </div>
            `).join('');
        }

        function handleCornerArrangementClick(vertex) {
            if(!cornerArrangementMode) return false;
            const context = getCornerArrangementContext(vertex);
            const target = document.getElementById('corner-arrangement-results');
            if(!context) {
                if(target) {
                    target.innerHTML = '<div class="layout-advisor-card warn"><div class="layout-advisor-card-title">Angle non utilisable</div><div class="layout-advisor-card-text">Cliquez un sommet relié à deux murs du contour.</div></div>';
                }
                return true;
            }
            selectSketchVertex(vertex, { redraw: false });
            pendingCornerArrangement = { context };
            createCornerArrangementObject('fill');
            return true;
        }

        function findSketchSegmentAt(worldX, worldY, hitPx = 12) {
            let best = null;
            segments.forEach((segment, segmentIndex) => {
                if(!segment || !segment.p1 || !segment.p2) return;
                if(segment.sharedContourEdge) return;
                const projected = projectPointToSegment2D(worldX, worldY, segment.p1, segment.p2);
                if(!projected) return;
                const distScreen = Math.hypot(projected.x - worldX, projected.y - worldY) * scale;
                if(distScreen <= hitPx && (!best || distScreen < best.distScreen)) {
                    best = { segmentIndex, segment, projected, distScreen };
                }
            });
            return best;
        }

        function isOpeningOverlayDrawingTool() {
            return drawingMode === 'wall'
                || drawingMode === 'window'
                || drawingMode === 'glass'
                || drawingMode === 'rail'
                || drawingMode === 'bare-edge'
                || drawingMode === 'door';
        }

        function canUseOpeningOverlayPoint(segmentHit) {
            return isDrawingToolActive
                && isOpeningOverlayDrawingTool()
                && segmentHit
                && segmentHit.segment
                && !segmentHit.segment.detached
                && isEditableContourSegmentType(segmentHit.segment.type);
        }

        function isEditableContourSegmentType(type) {
            return type === 'wall'
                || type === 'window'
                || type === 'glass'
                || type === 'rail'
                || type === 'bare-edge'
                || type === 'door';
        }

        function getSketchSegmentProjectedPoint(segmentHit) {
            if(!segmentHit || !segmentHit.projected) return null;
            return { x: segmentHit.projected.x, y: segmentHit.projected.y };
        }

        function arePointsClose2D(a, b, tolerance = 0.001) {
            return !!a && !!b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance;
        }

        function findOpeningOverlayTarget(segment) {
            if(!segment || !segment.p1 || !segment.p2 || !isOpeningOverlayDrawingTool() || segment.detached) return null;
            const overlayLen = Math.hypot(segment.p2.x - segment.p1.x, segment.p2.y - segment.p1.y);
            if(overlayLen < GRID_SIZE * 0.25) return null;

            const projectionTolerance = Math.max(2, GRID_SIZE * 0.35);
            for(let segmentIndex = 0; segmentIndex < segments.length; segmentIndex++) {
                const targetSegment = segments[segmentIndex];
                if(!targetSegment || targetSegment.detached || !isEditableContourSegmentType(targetSegment.type) || !targetSegment.p1 || !targetSegment.p2) continue;
                const startProjection = projectPointToSegment2D(segment.p1.x, segment.p1.y, targetSegment.p1, targetSegment.p2);
                const endProjection = projectPointToSegment2D(segment.p2.x, segment.p2.y, targetSegment.p1, targetSegment.p2);
                if(!startProjection || !endProjection) continue;

                const startDist = Math.hypot(startProjection.x - segment.p1.x, startProjection.y - segment.p1.y);
                const endDist = Math.hypot(endProjection.x - segment.p2.x, endProjection.y - segment.p2.y);
                if(startDist > projectionTolerance || endDist > projectionTolerance) continue;
                if(Math.abs(startProjection.t - endProjection.t) < 0.01) continue;

                const startT = Math.min(startProjection.t, endProjection.t);
                const endT = Math.max(startProjection.t, endProjection.t);
                if(startT <= 0.001 && endT >= 0.999 && targetSegment.type === segment.type) continue;
                return { segmentIndex, targetSegment, startT, endT };
            }
            return null;
        }

        function interpolateSketchPoint(p1, p2, t) {
            return {
                x: p1.x + (p2.x - p1.x) * t,
                y: p1.y + (p2.y - p1.y) * t
            };
        }

        function insertOpeningOverlaySegment(segment) {
            const target = findOpeningOverlayTarget(segment);
            if(!target) return false;

            const { segmentIndex, targetSegment, startT, endT } = target;
            const startPoint = interpolateSketchPoint(targetSegment.p1, targetSegment.p2, startT);
            const endPoint = interpolateSketchPoint(targetSegment.p1, targetSegment.p2, endT);
            const replacement = [];

            if(!arePointsClose2D(targetSegment.p1, startPoint)) {
                replacement.push({
                    ...targetSegment,
                    p1: { x: targetSegment.p1.x, y: targetSegment.p1.y },
                    p2: startPoint,
                    type: targetSegment.type
                });
            }

            replacement.push({
                p1: startPoint,
                p2: endPoint,
                type: segment.type,
                detached: false,
                sketchId: null
            });

            if(!arePointsClose2D(endPoint, targetSegment.p2)) {
                replacement.push({
                    ...targetSegment,
                    p1: endPoint,
                    p2: { x: targetSegment.p2.x, y: targetSegment.p2.y },
                    type: targetSegment.type
                });
            }

            segments.splice(segmentIndex, 1, ...replacement);
            return true;
        }

        function refreshSketchAfterStructuralEdit() {
            currentPoint = null;
            detachedDrawingMode = false;
            activeDetachedSketchId = null;
            hoveredSegmentIndex = -1;
            hoveredSketchSegmentIndex = -1;
            hoveredSketchVertex = null;
            draggingSketchVertex = null;
            clearSketchElementSelection({ redraw: false });
            checkIfContourClosed();
            const primarySegments = getPrimaryContourSegments();
            if(primarySegments.length === 0 || isContourClosed) {
                isSketchValidated = true;
                sketchLockActive = false;
                updateSketchLockUI();
            } else {
                markSketchDirtyAndLocked();
            }
            build3DArch();
            updateCollisionBanner();
            draw2D();
        }

        function deleteSketchSegmentAt(segmentIndex) {
            if(typeof segmentIndex !== 'number' || segmentIndex < 0 || segmentIndex >= segments.length) return false;
            saveState();
            segments.splice(segmentIndex, 1);
            refreshSketchAfterStructuralEdit();
            return true;
        }

        function deleteSketchVertexByKey(vertexKey) {
            if(!vertexKey) return false;
            const before = segments.length;
            const nextSegments = segments.filter(segment => {
                return getSketchPointKey(segment.p1) !== vertexKey && getSketchPointKey(segment.p2) !== vertexKey;
            });
            if(nextSegments.length === before) return false;
            saveState();
            segments = nextSegments;
            refreshSketchAfterStructuralEdit();
            return true;
        }

        function deleteSelectedSketchElement() {
            const vertexKey = selectedSketchVertexKey || (hoveredSketchVertex ? getSketchPointKey(hoveredSketchVertex) : null);
            if(vertexKey && deleteSketchVertexByKey(vertexKey)) return true;
            const segmentIndex = selectedSketchSegmentIndex >= 0
                ? selectedSketchSegmentIndex
                : (hoveredSketchSegmentIndex >= 0 ? hoveredSketchSegmentIndex : hoveredSegmentIndex);
            return deleteSketchSegmentAt(segmentIndex);
        }

        function getSketchVertexDragAnchors(vertex) {
            if(!vertex || !Array.isArray(vertex.refs)) return [];
            const anchors = [];
            vertex.refs.forEach(ref => {
                const segment = segments[ref.segmentIndex];
                if(!segment || !segment.p1 || !segment.p2) return;
                const other = ref.endpoint === 'p1' ? segment.p2 : segment.p1;
                if(!other) return;
                if(Math.hypot(other.x - vertex.x, other.y - vertex.y) < 1) return;
                if(anchors.some(anchor => Math.abs(anchor.x - other.x) < 0.5 && Math.abs(anchor.y - other.y) < 0.5)) return;
                anchors.push({ x: other.x, y: other.y });
            });
            return anchors;
        }

        function getSketchVertexDragSnap(rawPoint) {
            const anchors = getSketchVertexDragAnchors(draggingSketchVertex);
            if(!anchors.length) {
                drawingSnapGuides = [];
                return {
                    x: Math.round(rawPoint.x / GRID_SIZE) * GRID_SIZE,
                    y: Math.round(rawPoint.y / GRID_SIZE) * GRID_SIZE
                };
            }
            const previousCurrentPoint = currentPoint;
            let best = null;
            anchors.forEach(anchor => {
                currentPoint = { x: anchor.x, y: anchor.y };
                drawingSnapGuides = [];
                const snapped = getSnappedDrawingPoint(rawPoint, null);
                const guides = drawingSnapGuides.slice();
                const dist = Math.hypot(snapped.x - rawPoint.x, snapped.y - rawPoint.y);
                const score = dist + (guides.length ? 0 : GRID_SIZE);
                if(!best || score < best.score) {
                    best = { snapped, guides, score };
                }
            });
            currentPoint = previousCurrentPoint;
            drawingSnapGuides = best ? best.guides : [];
            return best ? best.snapped : {
                x: Math.round(rawPoint.x / GRID_SIZE) * GRID_SIZE,
                y: Math.round(rawPoint.y / GRID_SIZE) * GRID_SIZE
            };
        }

        function moveSketchVertexDrag(worldX, worldY) {
            if(!draggingSketchVertex) return;
            const snapped = getSketchVertexDragSnap({ x: worldX, y: worldY });
            const oldX = draggingSketchVertex.x;
            const oldY = draggingSketchVertex.y;
            draggingSketchVertex.refs.forEach(ref => {
                ref.point.x = snapped.x;
                ref.point.y = snapped.y;
            });
            draggingSketchVertex.x = snapped.x;
            draggingSketchVertex.y = snapped.y;
            selectedSketchVertexKey = getSketchPointKey(draggingSketchVertex);
            currentPoint = null;
            checkIfContourClosed();
            // Mise à jour live des aménagements d'angle liés à ce vertex
            if(typeof cornerFills !== 'undefined' && cornerFills.length > 0 &&
               typeof isLockedCornerArrangementObject === 'function' &&
               typeof getCornerArrangementContext === 'function' &&
               typeof buildCornerArrangementShapeFromLayout === 'function' &&
               typeof rebuildCornerFill === 'function') {
                const newCtx = getCornerArrangementContext(draggingSketchVertex);
                if(newCtx) {
                    cornerFills.forEach(fill => {
                        if(!isLockedCornerArrangementObject(fill)) return;
                        const sc = fill.sourceCorner;
                        if(!sc || !sc.corner) return;
                        if(Math.abs(sc.corner.x - oldX) >= 2 && Math.abs(sc.corner.x - snapped.x) >= 2) return;
                        if(Math.abs(sc.corner.y - oldY) >= 2 && Math.abs(sc.corner.y - snapped.y) >= 2) return;
                        // Conserver le mapping des bras A/B en comparant avec les directions stockées
                        const oldDirA = sc.dirA;
                        const oldDirB = sc.dirB;
                        const dotAA = newCtx.dirA.x * oldDirA.x + newCtx.dirA.y * oldDirA.y;
                        const dotAB = newCtx.dirA.x * oldDirB.x + newCtx.dirA.y * oldDirB.y;
                        const newLayout = {
                            ...sc,
                            corner: { x: newCtx.corner.x, y: newCtx.corner.y },
                            dirA: dotAA >= dotAB
                                ? { x: newCtx.dirA.x, y: newCtx.dirA.y }
                                : { x: newCtx.dirB.x, y: newCtx.dirB.y },
                            dirB: dotAA >= dotAB
                                ? { x: newCtx.dirB.x, y: newCtx.dirB.y }
                                : { x: newCtx.dirA.x, y: newCtx.dirA.y }
                        };
                        const shape = buildCornerArrangementShapeFromLayout(newLayout);
                        if(shape) {
                            fill.sourceCorner = newLayout;
                            fill.pos.x = shape.x;
                            fill.pos.z = shape.z;
                            fill.w = shape.w;
                            fill.d = shape.d;
                            fill.shapePoints = shape.shapePoints;
                            rebuildCornerFill(fill);
                        }
                    });
                }
            }
            // Mise à jour live : vertex adjacent au coin (A ou C bougent → dirA/dirB change)
            if(typeof cornerFills !== 'undefined' && cornerFills.length > 0 &&
               typeof isLockedCornerArrangementObject === 'function' &&
               typeof buildCornerArrangementShapeFromLayout === 'function' &&
               typeof rebuildCornerFill === 'function') {
                cornerFills.forEach(fill => {
                    if(!isLockedCornerArrangementObject(fill)) return;
                    const sc = fill.sourceCorner;
                    if(!sc || !sc.corner) return;
                    // Ignorer si c'est le coin lui-même (déjà géré dans le bloc ci-dessus)
                    if(Math.abs(sc.corner.x - oldX) < 2 && Math.abs(sc.corner.y - oldY) < 2) return;
                    // Vérifier si l'ancien vertex se trouvait dans la direction de l'un des bras
                    const cx = sc.corner.x, cy = sc.corner.y;
                    const dxOld = oldX - cx, dyOld = oldY - cy;
                    const distOld = Math.hypot(dxOld, dyOld);
                    if(distOld < 5) return;
                    const uxOld = dxOld / distOld, uyOld = dyOld / distOld;
                    const dotA = uxOld * sc.dirA.x + uyOld * sc.dirA.y;
                    const dotB = uxOld * sc.dirB.x + uyOld * sc.dirB.y;
                    if(dotA < 0.7 && dotB < 0.7) return; // pas dans la direction d'un bras
                    const dxNew = snapped.x - cx, dyNew = snapped.y - cy;
                    const distNew = Math.hypot(dxNew, dyNew);
                    if(distNew < 1) return;
                    const newU = { x: dxNew / distNew, y: dyNew / distNew };
                    const newLayout = {
                        ...sc,
                        dirA: dotA >= dotB ? newU : sc.dirA,
                        dirB: dotA >= dotB ? sc.dirB : newU
                    };
                    const shape = buildCornerArrangementShapeFromLayout(newLayout);
                    if(shape) {
                        fill.sourceCorner = newLayout;
                        fill.pos.x = shape.x;
                        fill.pos.z = shape.z;
                        fill.w = shape.w;
                        fill.d = shape.d;
                        fill.shapePoints = shape.shapePoints;
                        rebuildCornerFill(fill);
                    }
                });
            }
            scheduleLive3DPreviewUpdate();
            build3DArch();
        }

        function pointInRotatedRect(px, py, j, tolerance = 0) {
            // Convertir pos jardinière (unités THREE) en pixels canvas
            const jx = j.pos.x * 20;
            const jz = j.pos.z * 20;
            
            // Déplacer le point à l'équivalent du centre du rectangle
            let dx = px - jx;
            let dy = py - jz;
            
            // Appliquer la rotation inverse au point
            const cos = Math.cos(j.rot);
            const sin = Math.sin(j.rot);
            const rotX = dx * cos + dy * sin;
            const rotY = -dx * sin + dy * cos;
            
            // Vérifier si le point est dans le rectangle non-rotaté
            const w = j.w * 20 / 2 + tolerance;
            const d = j.d * 20 / 2 + tolerance;

            if(getPlacementType(j) === 'cornerFill' && typeof getCornerFillLocalPoints === 'function') {
                const points = getCornerFillLocalPoints(j).map(p => ({ x: p.x * 20, y: p.z * 20 }));
                const hitTolerance = Math.max(tolerance, 6 / Math.max(scale || 1, 0.01));
                if(hitTolerance > 0 && rotX >= -w - hitTolerance && rotX <= w + Math.abs(getCornerFillSkew(j) * 20) + hitTolerance && rotY >= -d - hitTolerance && rotY <= d + hitTolerance) {
                    for(let i = 0; i < points.length; i++) {
                        const a = points[i];
                        const b = points[(i + 1) % points.length];
                        const projected = projectPointToSegment2D(rotX, rotY, a, b);
                        if(projected && Math.hypot(projected.x - rotX, projected.y - rotY) <= hitTolerance) return true;
                    }
                }
                let inside = false;
                for(let i = 0, k = points.length - 1; i < points.length; k = i++) {
                    const a = points[i];
                    const b = points[k];
                    const intersects = ((a.y > rotY) !== (b.y > rotY)) && (rotX < (b.x - a.x) * (rotY - a.y) / ((b.y - a.y) || 0.0001) + a.x);
                    if(intersects) inside = !inside;
                }
                return inside;
            }
            
            return rotX >= -w && rotX <= w && rotY >= -d && rotY <= d;
        }

        function getPrimaryContourPolygon2D() {
            const contourSegments = getPrimaryContourSegments();
            if(!isContourClosed || contourSegments.length < 3) return [];
            const points = [{ x: contourSegments[0].p1.x, y: contourSegments[0].p1.y }];
            contourSegments.forEach(s => points.push({ x: s.p2.x, y: s.p2.y }));
            const first = points[0];
            const last = points[points.length - 1];
            if(first && last && Math.hypot(first.x - last.x, first.y - last.y) <= GRID_SIZE) points.pop();
            return points.length >= 3 ? points : [];
        }

        function isRailMountedPlacementType(type) {
            return type === 'hangingPlanter' || type === 'railShelf';
        }

        function getRailMountedGuardClearancePx() {
            return 8; // 4 cm: demi-epaisseur du garde-corps + jeu de pose cote balcon.
        }

        function getRailMountedPlacementSegments() {
            const primary = getPrimaryContourSegments()
                .map((segment, index) => ({ segment, index, source: 'primary' }))
                .filter(entry => entry.segment && entry.segment.type === 'rail' && !entry.segment.sharedContourEdge);
            const detached = [];
            if(typeof getDetachedSegmentGroups === 'function') {
                getDetachedSegmentGroups().forEach((group, groupIndex) => {
                    group.forEach((segment, segmentIndex) => {
                        if(segment && segment.type === 'rail' && !segment.sharedContourEdge) {
                            detached.push({ segment, index: 1000 + groupIndex * 100 + segmentIndex, source: 'detached' });
                        }
                    });
                });
            }
            return primary.concat(detached).filter(entry => {
                const p1 = entry.segment && entry.segment.p1;
                const p2 = entry.segment && entry.segment.p2;
                return p1 && p2 && Math.hypot(p2.x - p1.x, p2.y - p1.y) >= GRID_SIZE * 0.5;
            });
        }

        function getRailMountedNoSupportMessage() {
            return "Impossible d'ajouter cet objet: dessine d'abord un segment de garde-corps dans le contour du balcon.";
        }

        function showRailMountedNoSupportMessage() {
            const message = getRailMountedNoSupportMessage();
            if(typeof showSketchClosureAlert === 'function') showSketchClosureAlert(message);
            else alert(message);
        }

        function getBestRailMountedPlacementAnchor(item) {
            if(!item || typeof item.w !== 'number' || typeof item.d !== 'number') return null;
            const candidates = getRailMountedPlacementSegments();
            if(!candidates.length) return null;
            const halfWidth = item.w * 10;
            const halfDepth = item.d * 10;
            const guardClearance = getRailMountedGuardClearancePx();
            const mountDepth = halfDepth + guardClearance;
            const current = item.pos && Number.isFinite(item.pos.x) && Number.isFinite(item.pos.z)
                ? { x: item.pos.x * 20, y: item.pos.z * 20 }
                : null;
            let best = null;
            candidates.forEach(({ segment, index }) => {
                const p1 = segment.p1;
                const p2 = segment.p2;
                const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                const projection = current ? projectPointToSegment2D(current.x, current.y, p1, p2) : null;
                const projected = clampWallSnapProjectionToSegment(projection || { ...mid }, segment, halfWidth);
                const inward = getInwardNormalForWallSegment(segment, projected);
                if(!inward) return;
                const centerX = projected.x + inward.x * mountDepth;
                const centerY = projected.y + inward.y * mountDepth;
                const score = current ? Math.hypot(current.x - centerX, current.y - centerY) : Math.hypot(mid.x, mid.y);
                if(!best || score < best.score) {
                    best = {
                        centerX,
                        centerY,
                        rot: Math.atan2(inward.x, inward.y),
                        segmentIndex: index,
                        segmentInfo: getWallSnapSegmentInfo(segment),
                        score
                    };
                }
            });
            return best;
        }

        function placeRailMountedObjectOnGuardrail(item, showMessage = true) {
            const anchor = getBestRailMountedPlacementAnchor(item);
            if(!anchor) {
                if(showMessage) showRailMountedNoSupportMessage();
                return false;
            }
            item.pos.x = anchor.centerX / 20;
            item.pos.z = anchor.centerY / 20;
            item.rot = anchor.rot;
            setPlacementWallSnapSegmentInfo(item, anchor.segmentInfo);
            if(item.group) {
                item.group.position.copy(item.pos);
                item.group.rotation.y = item.rot || 0;
            }
            return true;
        }

        function getDetachedGroupPolygon2D(group) {
            if(!group || group.length < 3) return [];
            if(typeof isSegmentGroupClosed === 'function' && !isSegmentGroupClosed(group)) return [];
            const points = [{ x: group[0].p1.x, y: group[0].p1.y }];
            group.forEach(s => points.push({ x: s.p2.x, y: s.p2.y }));
            const first = points[0];
            const last = points[points.length - 1];
            if(first && last && Math.hypot(first.x - last.x, first.y - last.y) <= GRID_SIZE) points.pop();
            return points.length >= 3 ? points : [];
        }

        function getSlabZoneEntries2D() {
            const entries = [];
            const primary = getPrimaryContourPolygon2D();
            if(primary.length >= 3) entries.push({ id: 'primary', polygon: primary });
            if(typeof getDetachedSegmentGroups === 'function') {
                getDetachedSegmentGroups().forEach(group => {
                    const polygon = getDetachedGroupPolygon2D(group);
                    const id = group && group[0] && group[0].sketchId;
                    if(id && polygon.length >= 3) entries.push({ id, polygon });
                });
            }
            return entries;
        }

        function findSlabZoneAt2D(worldX, worldY) {
            if(typeof pointInPolygon !== 'function') return null;
            const zones = getSlabZoneEntries2D();
            for(let i = zones.length - 1; i >= 0; i--) {
                if(pointInPolygon({ x: worldX, y: worldY }, zones[i].polygon)) return zones[i];
            }
            return null;
        }

        function shouldSelectSlabZoneFromClick() {
            if(!isDrawingToolActive) return true;
            if(currentPoint) return false;
            const panel = document.getElementById('arch-panel-2d');
            return !!(panel && panel.classList.contains('visible'));
        }

        function getPolygonSignedArea2D(polygon) {
            if(!polygon || polygon.length < 3) return 0;
            let area = 0;
            for(let i = 0; i < polygon.length; i++) {
                const a = polygon[i];
                const b = polygon[(i + 1) % polygon.length];
                area += a.x * b.y - b.x * a.y;
            }
            return area * 0.5;
        }

        function getOutwardUnitNormal2D(a, b, orientationSign) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy);
            if(len < 0.0001) return { x: 0, y: 0 };
            if(orientationSign >= 0) return { x: dy / len, y: -dx / len };
            return { x: -dy / len, y: dx / len };
        }

        function intersectLines2D(a1, a2, b1, b2) {
            const dax = a2.x - a1.x;
            const day = a2.y - a1.y;
            const dbx = b2.x - b1.x;
            const dby = b2.y - b1.y;
            const denom = dax * dby - day * dbx;
            if(Math.abs(denom) < 0.000001) return null;
            const qx = b1.x - a1.x;
            const qy = b1.y - a1.y;
            const t = (qx * dby - qy * dbx) / denom;
            return { x: a1.x + t * dax, y: a1.y + t * day };
        }

        function computeOffsetContour2D(polygon, offsetDistance, edgeModes = []) {
            if(!polygon || polygon.length < 3) return [];
            const orientationSign = Math.sign(getPolygonSignedArea2D(polygon)) || 1;
            const result = [];

            function edgeNormal(edgeIndex) {
                const start = polygon[edgeIndex];
                const end = polygon[(edgeIndex + 1) % polygon.length];
                const outward = getOutwardUnitNormal2D(start, end, orientationSign);
                return edgeModes[edgeIndex] === 'inward'
                    ? { x: -outward.x, y: -outward.y }
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
                const prevLineA = { x: prev.x + prevNormal.x * offsetDistance, y: prev.y + prevNormal.y * offsetDistance };
                const prevLineB = { x: current.x + prevNormal.x * offsetDistance, y: current.y + prevNormal.y * offsetDistance };
                const nextLineA = { x: current.x + nextNormal.x * offsetDistance, y: current.y + nextNormal.y * offsetDistance };
                const nextLineB = { x: next.x + nextNormal.x * offsetDistance, y: next.y + nextNormal.y * offsetDistance };
                const intersection = intersectLines2D(prevLineA, prevLineB, nextLineA, nextLineB);
                result.push(intersection || {
                    x: current.x + (prevNormal.x + nextNormal.x) * offsetDistance * 0.5,
                    y: current.y + (prevNormal.y + nextNormal.y) * offsetDistance * 0.5
                });
            }

            return result;
        }

        function isThickPlanSegment(type) {
            return type === 'wall' || type === 'window' || type === 'glass' || type === 'rail' || type === 'door';
        }

        function projectPointToSegment2D(px, py, p1, p2) {
            const vx = p2.x - p1.x;
            const vy = p2.y - p1.y;
            const lenSq = vx * vx + vy * vy;
            if(lenSq <= 0.0001) return null;
            const t = Math.max(0, Math.min(1, ((px - p1.x) * vx + (py - p1.y) * vy) / lenSq));
            return {
                x: p1.x + vx * t,
                y: p1.y + vy * t,
                t,
                len: Math.sqrt(lenSq)
            };
        }

        function projectPointToLine2D(px, py, p1, p2) {
            const vx = p2.x - p1.x;
            const vy = p2.y - p1.y;
            const lenSq = vx * vx + vy * vy;
            if(lenSq <= 0.0001) return null;
            const t = ((px - p1.x) * vx + (py - p1.y) * vy) / lenSq;
            return { x: p1.x + vx * t, y: p1.y + vy * t, t, len: Math.sqrt(lenSq) };
        }

        function getInwardNormalForWallSegment(segment, projectedPoint) {
            const dx = segment.p2.x - segment.p1.x;
            const dy = segment.p2.y - segment.p1.y;
            const len = Math.hypot(dx, dy);
            if(len <= 0.0001) return null;
            const left = { x: -dy / len, y: dx / len };
            const right = { x: dy / len, y: -dx / len };
            const polygon = getPrimaryContourPolygon2D();
            if(polygon.length >= 3) {
                const testDistance = Math.max(GRID_SIZE * 2, 40);
                const leftInside = pointInPolygon({ x: projectedPoint.x + left.x * testDistance, y: projectedPoint.y + left.y * testDistance }, polygon);
                const rightInside = pointInPolygon({ x: projectedPoint.x + right.x * testDistance, y: projectedPoint.y + right.y * testDistance }, polygon);
                if(leftInside && !rightInside) return left;
                if(rightInside && !leftInside) return right;
            }
            return left;
        }

        function normalizeWallSnapVector(x, y) {
            const len = Math.hypot(x, y);
            return len > 0.0001 ? { x: x / len, y: y / len } : null;
        }

        function areWallSnapPointsClose(a, b, tolerance = GRID_SIZE * 0.25) {
            return !!(a && b && Math.hypot(a.x - b.x, a.y - b.y) <= tolerance);
        }

        function getWallSnapExteriorBisector(segment, adjacent, vertex, inward) {
            if(!segment || !adjacent || !vertex || !inward) return null;
            const adjacentInward = getInwardNormalForWallSegment(adjacent, vertex);
            if(!adjacentInward) return null;
            const outward = { x: -inward.x, y: -inward.y };
            const adjacentOutward = { x: -adjacentInward.x, y: -adjacentInward.y };
            return normalizeWallSnapVector(outward.x + adjacentOutward.x, outward.y + adjacentOutward.y)
                || normalizeWallSnapVector(outward.x, outward.y);
        }

        function isPointInsideWallSnapZoneSide(vertex, ray, point, reference) {
            if(!vertex || !ray || !point || !reference) return true;
            const rayPoint = { x: vertex.x + ray.x, y: vertex.y + ray.y };
            const pointSide = orientation2D(vertex, rayPoint, point);
            const referenceSide = orientation2D(vertex, rayPoint, reference);
            const tolerance = 0.001;
            if(Math.abs(pointSide) <= tolerance || Math.abs(referenceSide) <= tolerance) return true;
            return pointSide * referenceSide > 0;
        }

        function isPointInWallSnapOutsideZone(point, segment, index, primarySegments, inward, tolerance) {
            if(!point || !segment || index < 0 || !Array.isArray(primarySegments) || primarySegments.length < 3 || !inward) return true;
            const count = primarySegments.length;
            const previous = primarySegments[(index - 1 + count) % count];
            const next = primarySegments[(index + 1) % count];
            const vx = segment.p2.x - segment.p1.x;
            const vy = segment.p2.y - segment.p1.y;
            const len = Math.hypot(vx, vy);
            if(len <= 0.0001) return true;
            const along = { x: vx / len, y: vy / len };
            const outward = { x: -inward.x, y: -inward.y };
            const inset = Math.max(20, tolerance);
            const startReference = {
                x: segment.p1.x + along.x * inset + outward.x * inset,
                y: segment.p1.y + along.y * inset + outward.y * inset
            };
            const endReference = {
                x: segment.p2.x - along.x * inset + outward.x * inset,
                y: segment.p2.y - along.y * inset + outward.y * inset
            };
            const startRay = areWallSnapPointsClose(previous && previous.p2, segment.p1)
                ? getWallSnapExteriorBisector(segment, previous, segment.p1, inward)
                : null;
            const endRay = areWallSnapPointsClose(next && next.p1, segment.p2)
                ? getWallSnapExteriorBisector(segment, next, segment.p2, inward)
                : null;
            const insideStart = isPointInsideWallSnapZoneSide(segment.p1, startRay, point, startReference);
            const insideEnd = isPointInsideWallSnapZoneSide(segment.p2, endRay, point, endReference);
            return insideStart && insideEnd;
        }

        function getWallSnapSegmentKey(segment) {
            const source = segment && segment._sourceSegment ? segment._sourceSegment : segment;
            if(!source || !source.p1 || !source.p2) return null;
            return [
                Math.round(source.p1.x * 1000) / 1000,
                Math.round(source.p1.y * 1000) / 1000,
                Math.round(source.p2.x * 1000) / 1000,
                Math.round(source.p2.y * 1000) / 1000
            ].join(':');
        }

        function getWallSnapSegmentInfo(segment) {
            const source = segment && segment._sourceSegment ? segment._sourceSegment : segment;
            if(!source || !source.p1 || !source.p2) return null;
            return {
                key: getWallSnapSegmentKey(source),
                p1: { x: source.p1.x, y: source.p1.y },
                p2: { x: source.p2.x, y: source.p2.y }
            };
        }

        function setPlacementWallSnapSegmentInfo(obj, info) {
            if(!obj) return;
            Object.defineProperty(obj, '_wallSnapSegmentKey', {
                value: info && info.key ? info.key : null,
                writable: true,
                configurable: true,
                enumerable: false
            });
            Object.defineProperty(obj, '_wallSnapSegmentInfo', {
                value: info || null,
                writable: true,
                configurable: true,
                enumerable: false
            });
        }

        function findWallSnapForPlacement(obj, pointerWorld = null) {
            if(!obj || !obj.pos || typeof obj.d !== 'number') return null;
            if(getPlacementType(obj) === 'cornerFill') return null;
            const placementType = getPlacementType(obj);
            const railMountedOnly = isRailMountedPlacementType(placementType);
            const wallTypes = railMountedOnly ? new Set(['rail']) : new Set(['wall', 'window', 'glass', 'rail']);
            const primarySegments = getPrimaryContourSegments();
            const wallSegments = primarySegments
                .map((segment, index) => ({ segment, index }))
                .filter(entry => wallTypes.has(entry.segment.type));
            if(!railMountedOnly && typeof getMyBuildingLocalSegments === 'function') {
                getMyBuildingLocalSegments().forEach((seg, i) => {
                    wallSegments.push({ segment: seg, index: -(i + 1), virtual: true });
                });
            }
            if(!wallSegments.length) return null;
            const center = { x: obj.pos.x * 20, y: obj.pos.z * 20 };
            const trigger = pointerWorld || center;
            const halfDepth = obj.d * 10;
            const halfWidth = typeof obj.w === 'number' ? obj.w * 10 : 0;
            const guardClearance = railMountedOnly ? getRailMountedGuardClearancePx() : 0;
            const mountDepth = halfDepth + guardClearance;
            const snapTolerance = Math.max(18, 18 / Math.max(scale, 0.2));
            const releaseTolerance = snapTolerance * 2.35;
            const outsideSnapDistance = GRID_SIZE;
            const primaryPolygon = getPrimaryContourPolygon2D();
            const isPointerOutsidePrimaryContour = primaryPolygon.length >= 3
                && typeof pointInPolygon === 'function'
                && !pointInPolygon(trigger, primaryPolygon);
            const contactProbe = getJardWorldFromLocalCentered(obj, 0, -mountDepth);
            let best = null;
            wallSegments.forEach(({ segment, index, virtual }) => {
                const projected = projectPointToSegment2D(center.x, center.y, segment.p1, segment.p2);
                const triggerProjected = projectPointToSegment2D(trigger.x, trigger.y, segment.p1, segment.p2);
                const contactProjected = projectPointToSegment2D(contactProbe.x, contactProbe.y, segment.p1, segment.p2);
                const isActiveSegment = activeWallSnapPlacement === obj && activeWallSnapSegmentIndex === index;
                const triggerLineProjected = isActiveSegment || isPointerOutsidePrimaryContour
                    ? projectPointToLine2D(trigger.x, trigger.y, segment.p1, segment.p2)
                    : null;
                const isActiveExtension = !!(triggerLineProjected && (triggerLineProjected.t < 0 || triggerLineProjected.t > 1));
                const distanceProjected = triggerLineProjected || triggerProjected;
                if(!projected || projected.len < GRID_SIZE * 0.5) return;
                if(!triggerProjected || !distanceProjected || !contactProjected) return;
                const dist = Math.hypot(trigger.x - distanceProjected.x, trigger.y - distanceProjected.y);
                const segmentDist = Math.hypot(trigger.x - triggerProjected.x, trigger.y - triggerProjected.y);
                const contactDist = Math.hypot(contactProbe.x - contactProjected.x, contactProbe.y - contactProjected.y);
                if(isPointerOutsidePrimaryContour && !virtual && segmentDist > outsideSnapDistance) return;
                const limit = isActiveSegment ? releaseTolerance : snapTolerance;
                const inward = virtual && segment.inward
                    ? segment.inward
                    : getInwardNormalForWallSegment(segment, triggerProjected);
                if(!inward) return;
                const snappedProjected = clampWallSnapProjectionToSegment(triggerProjected, segment, halfWidth);
                const snappedCenterX = snappedProjected.x + inward.x * mountDepth;
                const snappedCenterY = snappedProjected.y + inward.y * mountDepth;
                const objectSnapMove = Math.hypot(center.x - snappedCenterX, center.y - snappedCenterY);
                const objectSnapLimit = Math.max(snapTolerance * 2.4, halfDepth + snapTolerance);
                const contactSnapLimit = Math.max(snapTolerance * 3.2, halfDepth + snapTolerance);
                const pointerCanSnap = isPointerOutsidePrimaryContour || dist <= limit;
                const objectCanSnap = objectSnapMove <= objectSnapLimit && contactDist <= contactSnapLimit;
                if(!pointerCanSnap && !objectCanSnap) return;
                const stickyBonus = !isPointerOutsidePrimaryContour && isActiveSegment && !isActiveExtension ? -snapTolerance * 0.45 : 0;
                const switchPenalty = !isPointerOutsidePrimaryContour && isActiveExtension ? snapTolerance * 0.2 : 0;
                const outwardSide = triggerLineProjected
                    ? (trigger.x - triggerLineProjected.x) * -inward.x + (trigger.y - triggerLineProjected.y) * -inward.y
                    : 0;
                const isInOutsideZone = !isPointerOutsidePrimaryContour
                    || virtual
                    || (outwardSide >= -snapTolerance * 0.15
                        && isPointInWallSnapOutsideZone(trigger, segment, index, primarySegments, inward, snapTolerance));
                const pointerScore = isPointerOutsidePrimaryContour
                    ? dist
                    : segmentDist;
                const objectScore = objectSnapMove + contactDist * 0.8;
                const scoreBase = isPointerOutsidePrimaryContour
                    ? pointerScore
                    : (objectCanSnap ? Math.min(pointerScore, objectScore) : pointerScore);
                const score = scoreBase + stickyBonus + switchPenalty;
                if(isPointerOutsidePrimaryContour && !isInOutsideZone) return;
                if(!best || score < best.score) best = { projected: triggerProjected, inward, score, index, segment };
            });
            const chosen = best;
            if(!chosen) return null;
            const clampedProjected = clampWallSnapProjectionToSegment(chosen.projected, chosen.segment, halfWidth);
            return {
                centerX: clampedProjected.x + chosen.inward.x * mountDepth,
                centerY: clampedProjected.y + chosen.inward.y * mountDepth,
                rot: Math.atan2(chosen.inward.x, chosen.inward.y),
                segmentIndex: chosen.index,
                segmentInfo: getWallSnapSegmentInfo(chosen.segment)
            };
        }

        function clampWallSnapProjectionToSegment(projected, segment, halfWidth) {
            if(!projected || !segment || !segment.p1 || !segment.p2 || !(halfWidth > 0)) return projected;
            const vx = segment.p2.x - segment.p1.x;
            const vy = segment.p2.y - segment.p1.y;
            const lenSq = vx * vx + vy * vy;
            if(lenSq <= 0.001) return projected;
            const len = Math.sqrt(lenSq);
            const minAlong = Math.min(halfWidth, len * 0.5);
            const maxAlong = Math.max(len - halfWidth, len * 0.5);
            const along = ((projected.x - segment.p1.x) * vx + (projected.y - segment.p1.y) * vy) / len;
            const clampedAlong = Math.max(minAlong, Math.min(maxAlong, along));
            return {
                x: segment.p1.x + (vx / len) * clampedAlong,
                y: segment.p1.y + (vy / len) * clampedAlong
            };
        }

        function applyWallSnapToPlacement(obj, pointerWorld = null) {
            const snap = findWallSnapForPlacement(obj, pointerWorld);
            if(!snap) {
                if(activeWallSnapPlacement === obj && dragOriginalRot !== null) {
                    obj.rot = dragOriginalRot;
                    if(obj.group) obj.group.rotation.y = obj.rot || 0;
                }
                activeWallSnapPlacement = null;
                activeWallSnapSegmentIndex = null;
                setPlacementWallSnapSegmentInfo(obj, null);
                return false;
            }
            obj.pos.x = snap.centerX / 20;
            obj.pos.z = snap.centerY / 20;
            obj.rot = snap.rot;
            activeWallSnapPlacement = obj;
            activeWallSnapSegmentIndex = snap.segmentIndex;
            setPlacementWallSnapSegmentInfo(obj, snap.segmentInfo);
            if(obj.group) {
                obj.group.position.copy(obj.pos);
                obj.group.rotation.y = obj.rot || 0;
            }
            return true;
        }

        function getPlacementFootprintCornersWorld(obj, paddingPx = 0, localBounds = null) {
            if(!obj || !obj.pos || typeof obj.w !== 'number' || typeof obj.d !== 'number') return [];
            if(!localBounds && getPlacementType(obj) === 'cornerFill' && typeof getCornerFillLocalPoints === 'function') {
                const localPoints = getCornerFillLocalPoints(obj);
                if(localPoints.length >= 3) {
                    const center = getPolygonCenter2D(localPoints.map(p => ({ x: p.x * 20, y: p.z * 20 })));
                    return localPoints.map(point => {
                        let x = point.x * 20;
                        let y = point.z * 20;
                        if(paddingPx !== 0) {
                            const vx = x - center.x;
                            const vy = y - center.y;
                            const len = Math.hypot(vx, vy);
                            if(len > 0.001) {
                                x += vx / len * paddingPx;
                                y += vy / len * paddingPx;
                            }
                        }
                        return getJardWorldFromLocalCentered(obj, x, y);
                    });
                }
            }
            const halfW = obj.w * 10 + paddingPx;
            const halfD = obj.d * 10 + paddingPx;
            const bounds = localBounds || { minX: -halfW, maxX: halfW, minY: -halfD, maxY: halfD };
            return [
                getJardWorldFromLocalCentered(obj, bounds.minX - paddingPx, bounds.minY - paddingPx),
                getJardWorldFromLocalCentered(obj, bounds.maxX + paddingPx, bounds.minY - paddingPx),
                getJardWorldFromLocalCentered(obj, bounds.maxX + paddingPx, bounds.maxY + paddingPx),
                getJardWorldFromLocalCentered(obj, bounds.minX - paddingPx, bounds.maxY + paddingPx)
            ];
        }

        function getPlacementBlockingSegments() {
            const blockingTypes = new Set(['wall', 'window', 'glass', 'rail', 'door']);
            return segments.filter(segment => {
                return segment
                    && segment.p1
                    && segment.p2
                    && !segment.sharedContourEdge
                    && blockingTypes.has(segment.type);
            });
        }

        function orientation2D(a, b, c) {
            return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        }

        function pointOnSegment2D(point, a, b, tolerance = 0.001) {
            return Math.abs(orientation2D(a, b, point)) <= tolerance
                && point.x >= Math.min(a.x, b.x) - tolerance
                && point.x <= Math.max(a.x, b.x) + tolerance
                && point.y >= Math.min(a.y, b.y) - tolerance
                && point.y <= Math.max(a.y, b.y) + tolerance;
        }

        function segmentsIntersect2D(a1, a2, b1, b2) {
            const o1 = orientation2D(a1, a2, b1);
            const o2 = orientation2D(a1, a2, b2);
            const o3 = orientation2D(b1, b2, a1);
            const o4 = orientation2D(b1, b2, a2);
            if((o1 > 0 && o2 < 0 || o1 < 0 && o2 > 0) && (o3 > 0 && o4 < 0 || o3 < 0 && o4 > 0)) return true;
            return pointOnSegment2D(b1, a1, a2)
                || pointOnSegment2D(b2, a1, a2)
                || pointOnSegment2D(a1, b1, b2)
                || pointOnSegment2D(a2, b1, b2);
        }

        function pointInConvexPolygon2D(point, polygon) {
            if(!polygon || polygon.length < 3) return false;
            let sign = 0;
            for(let i = 0; i < polygon.length; i++) {
                const edgeSign = orientation2D(polygon[i], polygon[(i + 1) % polygon.length], point);
                if(Math.abs(edgeSign) < 0.001) continue;
                const nextSign = edgeSign > 0 ? 1 : -1;
                if(sign && nextSign !== sign) return false;
                sign = nextSign;
            }
            return true;
        }

        function segmentIntersectsPlacementFootprint(segment, corners) {
            if(!segment || !corners || corners.length < 3) return false;
            if(pointInConvexPolygon2D(segment.p1, corners) || pointInConvexPolygon2D(segment.p2, corners)) return true;
            for(let i = 0; i < corners.length; i++) {
                if(segmentsIntersect2D(segment.p1, segment.p2, corners[i], corners[(i + 1) % corners.length])) return true;
            }
            return false;
        }

        function footprintIsBehindBlockingSegment(segment, corners, inward) {
            if(!segment || !corners || !inward) return false;
            const dx = segment.p2.x - segment.p1.x;
            const dy = segment.p2.y - segment.p1.y;
            const lenSq = dx * dx + dy * dy;
            if(lenSq <= 0.001) return false;
            const projectionPad = 0.08;
            return corners.some(corner => {
                const signedDistance = (corner.x - segment.p1.x) * inward.x + (corner.y - segment.p1.y) * inward.y;
                if(signedDistance >= 0) return false;
                const t = ((corner.x - segment.p1.x) * dx + (corner.y - segment.p1.y) * dy) / lenSq;
                return t >= -projectionPad && t <= 1 + projectionPad;
            });
        }

        function placementFootprintViolatesBlockingSegment(segment, corners, inward) {
            if(!segment || !corners || corners.length < 3 || !inward) return false;
            if(footprintIsBehindBlockingSegment(segment, corners, inward)) return true;
            if(!segmentIntersectsPlacementFootprint(segment, corners)) return false;
            let minSignedDistance = Infinity;
            let maxSignedDistance = -Infinity;
            corners.forEach(corner => {
                const signedDistance = (corner.x - segment.p1.x) * inward.x + (corner.y - segment.p1.y) * inward.y;
                minSignedDistance = Math.min(minSignedDistance, signedDistance);
                maxSignedDistance = Math.max(maxSignedDistance, signedDistance);
            });
            return minSignedDistance < -0.08 && maxSignedDistance > 0.08;
        }

        function placementFootprintWarnsBlockingSegment(segment, corners, inward, options = {}) {
            if(!segment || !corners || corners.length < 3 || !inward) return false;
            const dx = segment.p2.x - segment.p1.x;
            const dy = segment.p2.y - segment.p1.y;
            const lenSq = dx * dx + dy * dy;
            if(lenSq <= 0.001) return false;
            const len = Math.sqrt(lenSq);
            const warningTolerance = Math.max(2, GRID_SIZE * 0.08);
            const sharedEndpoint = options.sharedEndpoint || null;
            const cornerAllowance = sharedEndpoint ? Math.max(GRID_SIZE * 0.85, warningTolerance * 3) : 0;
            const projectionPad = 0.08;
            let minSignedDistance = Infinity;
            let maxSignedDistance = -Infinity;
            let hasProjectedPenetration = false;
            let consideredCorners = 0;
            corners.forEach(corner => {
                const signedDistance = (corner.x - segment.p1.x) * inward.x + (corner.y - segment.p1.y) * inward.y;
                const t = ((corner.x - segment.p1.x) * dx + (corner.y - segment.p1.y) * dy) / lenSq;
                if(sharedEndpoint) {
                    const along = Math.max(0, Math.min(1, t)) * len;
                    const endpointAlong = areWallSnapPointsClose(sharedEndpoint, segment.p1, GRID_SIZE * 0.25) ? 0 : len;
                    if(Math.abs(along - endpointAlong) <= cornerAllowance) return;
                }
                consideredCorners++;
                minSignedDistance = Math.min(minSignedDistance, signedDistance);
                maxSignedDistance = Math.max(maxSignedDistance, signedDistance);
                if(t >= -projectionPad && t <= 1 + projectionPad && signedDistance < -warningTolerance) {
                    hasProjectedPenetration = true;
                }
            });
            if(consideredCorners <= 0) return false;
            if(hasProjectedPenetration) return true;
            if(!segmentIntersectsPlacementFootprint(segment, corners)) return false;
            return minSignedDistance < -warningTolerance && maxSignedDistance > warningTolerance;
        }

        function getSharedWallSnapEndpoint(segment, snapInfo) {
            if(!segment || !snapInfo || !segment.p1 || !segment.p2 || !snapInfo.p1 || !snapInfo.p2) return null;
            const tolerance = GRID_SIZE * 0.25;
            if(areWallSnapPointsClose(segment.p1, snapInfo.p1, tolerance) || areWallSnapPointsClose(segment.p1, snapInfo.p2, tolerance)) return segment.p1;
            if(areWallSnapPointsClose(segment.p2, snapInfo.p1, tolerance) || areWallSnapPointsClose(segment.p2, snapInfo.p2, tolerance)) return segment.p2;
            return null;
        }

        function resolvePlacementWallCollision(obj) {
            if(!obj || !obj.pos) return false;
            const wallSegments = getPlacementBlockingSegments();
            if(!wallSegments.length) return false;

            let moved = false;
            const clearancePx = 0.05;
            for(let pass = 0; pass < 6; pass++) {
                let shiftX = 0;
                let shiftY = 0;
                const corners = getPlacementFootprintCornersWorld(obj);
                if(corners.length < 3) return moved;

                wallSegments.forEach(segment => {
                    const mid = {
                        x: (segment.p1.x + segment.p2.x) / 2,
                        y: (segment.p1.y + segment.p2.y) / 2
                    };
                    const inward = getInwardNormalForWallSegment(segment, mid);
                    if(!inward) return;
                    if(!placementFootprintViolatesBlockingSegment(segment, corners, inward)) return;
                    let minSignedDistance = Infinity;
                    corners.forEach(corner => {
                        const signedDistance = (corner.x - segment.p1.x) * inward.x + (corner.y - segment.p1.y) * inward.y;
                        minSignedDistance = Math.min(minSignedDistance, signedDistance);
                    });
                    if(minSignedDistance < clearancePx) {
                        const push = clearancePx - minSignedDistance;
                        shiftX += inward.x * push;
                        shiftY += inward.y * push;
                    }
                });

                if(Math.hypot(shiftX, shiftY) <= 0.001) break;
                obj.pos.x += shiftX / 20;
                obj.pos.z += shiftY / 20;
                moved = true;
            }
            return moved;
        }

        function getPlacementCollisionFootprints(obj, mode = 'solid') {
            if(!obj || typeof obj.w !== 'number' || typeof obj.d !== 'number') return [];
            const type = getPlacementType(obj);
            if(mode === 'solid' && type === 'cornerFill') {
                const polygon = getPlacementFootprintCornersWorld(obj);
                if(polygon.length === 3) return [{ corners: polygon }];
                if(polygon.length > 3) {
                    const triangles = [];
                    for(let i = 1; i < polygon.length - 1; i++) {
                        triangles.push({ corners: [polygon[0], polygon[i], polygon[i + 1]] });
                    }
                    return triangles;
                }
            }
            if(mode === 'chair-back' && type === 'chair') {
                return [{
                    corners: getPlacementFootprintCornersWorld(obj, 0, {
                        minX: -obj.w * 10,
                        maxX: obj.w * 10,
                        minY: -obj.d * 10,
                        maxY: -obj.d * 10 + obj.d * 20 * 0.38
                    })
                }];
            }
            if(mode === 'chair-seat' && type === 'chair') {
                const seatDepth = Math.max(2.8, obj.d * 0.72);
                const seatCenterZ = Math.min(obj.d * 0.04, 0.18);
                return [{
                    corners: getPlacementFootprintCornersWorld(obj, 0, {
                        minX: -obj.w * 10,
                        maxX: obj.w * 10,
                        minY: (seatCenterZ - seatDepth / 2) * 20,
                        maxY: (seatCenterZ + seatDepth / 2) * 20
                    })
                }];
            }
            if(mode === 'table-legs' && type === 'table') {
                const settings = getDefaultConstructionSettings();
                const legLong = settings.lambourdeLong;
                const legWide = settings.lambourdeWide;
                const xInset = Math.max(obj.w / 2 - legLong / 2 - 0.35, legLong / 2);
                const zInset = Math.max(obj.d / 2 - legWide / 2 - 0.35, legWide / 2);
                const legFootprints = [];
                [-1, 1].forEach(xs => {
                    [-1, 1].forEach(zs => {
                        legFootprints.push({
                            corners: getPlacementFootprintCornersWorld(obj, 0, {
                                minX: (xs * xInset - legLong / 2) * 20,
                                maxX: (xs * xInset + legLong / 2) * 20,
                                minY: (zs * zInset - legWide / 2) * 20,
                                maxY: (zs * zInset + legWide / 2) * 20
                            })
                        });
                    });
                });
                return legFootprints;
            }
            return [{ corners: getPlacementFootprintCornersWorld(obj) }];
        }

        function getProjectionOnAxis(points, axis) {
            let min = Infinity;
            let max = -Infinity;
            points.forEach(point => {
                const projected = point.x * axis.x + point.y * axis.y;
                min = Math.min(min, projected);
                max = Math.max(max, projected);
            });
            return { min, max };
        }

        function getPolygonAxes(points) {
            const axes = [];
            if(!points || points.length < 2) return axes;
            for(let i = 0; i < points.length; i++) {
                const a = points[i];
                const b = points[(i + 1) % points.length];
                const dx = b.x - a.x;
                const dy = b.y - a.y;
                const len = Math.hypot(dx, dy);
                if(len <= 0.001) continue;
                axes.push({ x: -dy / len, y: dx / len });
            }
            return axes;
        }

        function getPolygonCenter2D(points) {
            const sum = points.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
            return { x: sum.x / points.length, y: sum.y / points.length };
        }

        function getOrientedRectOverlapVector(aCorners, bCorners) {
            if(!aCorners || !bCorners || aCorners.length < 3 || bCorners.length < 3) return null;
            let bestOverlap = Infinity;
            let bestAxis = null;
            const axes = getPolygonAxes(aCorners).concat(getPolygonAxes(bCorners));
            for(const axis of axes) {
                const aProj = getProjectionOnAxis(aCorners, axis);
                const bProj = getProjectionOnAxis(bCorners, axis);
                const overlap = Math.min(aProj.max, bProj.max) - Math.max(aProj.min, bProj.min);
                if(overlap <= 0) return null;
                if(overlap < bestOverlap) {
                    bestOverlap = overlap;
                    bestAxis = axis;
                }
            }
            if(!bestAxis) return null;
            const aCenter = getPolygonCenter2D(aCorners);
            const bCenter = getPolygonCenter2D(bCorners);
            const dir = ((aCenter.x - bCenter.x) * bestAxis.x + (aCenter.y - bCenter.y) * bestAxis.y) >= 0 ? 1 : -1;
            return {
                x: bestAxis.x * dir * (bestOverlap + 0.05),
                y: bestAxis.y * dir * (bestOverlap + 0.05),
                depth: bestOverlap
            };
        }

        function getChairSeatTopHeightDm(chair) {
            if(!chair) return Infinity;
            const settings = getDefaultConstructionSettings();
            const boardT = settings.boardThickness || 0.18;
            return Math.max(3.8, Math.min(5, (chair.h || 0) * 0.54)) + boardT;
        }

        function getTableUndersideHeightDm(table) {
            if(!table) return -Infinity;
            const settings = getDefaultConstructionSettings();
            const boardT = settings.boardThickness || 0.18;
            return (table.h || 0) - boardT;
        }

        function canChairSeatPassUnderTable(chair, table) {
            return getChairSeatTopHeightDm(chair) <= getTableUndersideHeightDm(table) - 0.05;
        }

        function getCollisionFootprintModesForPair(active, other) {
            const activeType = getPlacementType(active);
            const otherType = getPlacementType(other);
            if(activeType === 'chair' && otherType === 'table' && canChairSeatPassUnderTable(active, other)) {
                return { activeMode: 'chair-back', otherMode: 'solid' };
            }
            if(activeType === 'table' && otherType === 'chair' && canChairSeatPassUnderTable(other, active)) {
                return { activeMode: 'solid', otherMode: 'chair-back' };
            }
            return { activeMode: 'solid', otherMode: 'solid' };
        }

        function getPlacementObjectCollisionVector(active, other) {
            const modes = getCollisionFootprintModesForPair(active, other);
            let best = null;

            const testFootprintPair = (activeMode, otherMode) => {
                const activeFootprints = getPlacementCollisionFootprints(active, activeMode);
                const otherFootprints = getPlacementCollisionFootprints(other, otherMode);
                activeFootprints.forEach(activeFootprint => {
                    otherFootprints.forEach(otherFootprint => {
                        const overlap = getOrientedRectOverlapVector(activeFootprint.corners, otherFootprint.corners);
                        if(overlap && (!best || overlap.depth < best.depth)) best = overlap;
                    });
                });
            };

            testFootprintPair(modes.activeMode, modes.otherMode);
            if(modes.activeMode === 'chair-back' && modes.otherMode === 'solid') {
                testFootprintPair('chair-seat', 'table-legs');
            } else if(modes.activeMode === 'solid' && modes.otherMode === 'chair-back') {
                testFootprintPair('table-legs', 'chair-seat');
            }
            return best;
        }

        function resolvePlacementObjectCollisions(obj) {
            if(!obj || !obj.pos) return false;
            let moved = false;
            for(let pass = 0; pass < 6; pass++) {
                let bestVector = null;
                getConstructionItems().forEach(entry => {
                    const other = entry.item;
                    if(!other || other === obj) return;
                    const vector = getPlacementObjectCollisionVector(obj, other);
                    if(vector && (!bestVector || vector.depth < bestVector.depth)) bestVector = vector;
                });
                if(!bestVector) break;
                obj.pos.x += bestVector.x / 20;
                obj.pos.z += bestVector.y / 20;
                moved = true;
            }
            return moved;
        }

        function hasPlacementBlockingCollision(obj) {
            if(!obj || !obj.pos) return false;
            if(hasPlacementWallCollision(obj)) return true;
            return hasPlacementObjectCollision(obj);
        }

        function hasPlacementWallCollision(obj) {
            if(!obj || !obj.pos) return false;
            const corners = getPlacementFootprintCornersWorld(obj);
            return getPlacementBlockingSegments().some(segment => {
                const mid = {
                    x: (segment.p1.x + segment.p2.x) / 2,
                    y: (segment.p1.y + segment.p2.y) / 2
                };
                const inward = getInwardNormalForWallSegment(segment, mid);
                return placementFootprintViolatesBlockingSegment(segment, corners, inward);
            });
        }

        function hasPlacementWallWarningCollision(obj) {
            if(!obj || !obj.pos) return false;
            const corners = getPlacementFootprintCornersWorld(obj);
            return getPlacementBlockingSegments().some(segment => {
                if(obj._wallSnapSegmentKey && getWallSnapSegmentKey(segment) === obj._wallSnapSegmentKey) return false;
                const mid = {
                    x: (segment.p1.x + segment.p2.x) / 2,
                    y: (segment.p1.y + segment.p2.y) / 2
                };
                const inward = getInwardNormalForWallSegment(segment, mid);
                const sharedEndpoint = obj._wallSnapSegmentInfo
                    ? getSharedWallSnapEndpoint(segment, obj._wallSnapSegmentInfo)
                    : null;
                return placementFootprintWarnsBlockingSegment(segment, corners, inward, { sharedEndpoint });
            });
        }

        function hasPlacementObjectCollision(obj) {
            if(!obj || !obj.pos) return false;
            return getConstructionItems().some(entry => {
                const other = entry.item;
                return other && other !== obj && !!getPlacementObjectCollisionVector(obj, other);
            });
        }

        function hasPlacementWarningCollision(obj) {
            if(!obj) return false;
            try { return hasPlacementWallWarningCollision(obj) || hasPlacementObjectCollision(obj); } catch(e) { return false; }
        }

        function getJardTopLeftWorld(j) {
            const centerX = j.pos.x * 20;
            const centerY = j.pos.z * 20;
            const localX = -j.w * 10;
            const localY = -j.d * 10;
            const angle = -j.rot;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offX = localX * cos - localY * sin;
            const offY = localX * sin + localY * cos;
            return { x: centerX + offX, y: centerY + offY };
        }

        function setJardCenterFromLocalAnchorWorld(j, anchorLocalX, anchorLocalY, anchorX, anchorY) {
            const angle = -j.rot;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offX = anchorLocalX * cos - anchorLocalY * sin;
            const offY = anchorLocalX * sin + anchorLocalY * cos;
            const centerX = anchorX - offX;
            const centerY = anchorY - offY;
            j.pos.x = centerX / 20;
            j.pos.z = centerY / 20;
        }

        function setJardCenterFromTopLeftWorld(j, anchorX, anchorY) {
            setJardCenterFromLocalAnchorWorld(j, -j.w * 10, -j.d * 10, anchorX, anchorY);
        }

        function snapJardiniereToGrid(j) {
            if(!j) return;
            const anchor = getJardTopLeftWorld(j);
            const snappedX = Math.round(anchor.x / GRID_SIZE) * GRID_SIZE;
            const snappedY = Math.round(anchor.y / GRID_SIZE) * GRID_SIZE;
            setJardCenterFromTopLeftWorld(j, snappedX, snappedY);
        }

        function getJardBottomRightWorld(j) {
            const centerX = j.pos.x * 20;
            const centerY = j.pos.z * 20;
            const localX = j.w * 10;
            const localY = j.d * 10;
            const angle = -j.rot;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offX = localX * cos - localY * sin;
            const offY = localX * sin + localY * cos;
            return { x: centerX + offX, y: centerY + offY };
        }

        function getJardWorldFromLocalCentered(j, localX, localY) {
            const centerX = j.pos.x * 20;
            const centerY = j.pos.z * 20;
            const angle = -j.rot;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const offX = localX * cos - localY * sin;
            const offY = localX * sin + localY * cos;
            return { x: centerX + offX, y: centerY + offY };
        }

        function getJardResizeHandlesWorld(j) {
            return {
                w: getJardWorldFromLocalCentered(j, j.w * 10, 0),
                wLeft: getJardWorldFromLocalCentered(j, -j.w * 10, 0),
                d: getJardWorldFromLocalCentered(j, 0, j.d * 10)
            };
        }

        function getResizeAnchorLocalForMode(j, mode) {
            let local = { x: -j.w * 10, y: -j.d * 10 };
            if(mode === 'w-left') local = { x: j.w * 10, y: -j.d * 10 };
            return local;
        }

        function getResizeAnchorForMode(j, mode) {
            const local = getResizeAnchorLocalForMode(j, mode);
            return {
                local,
                world: getJardWorldFromLocalCentered(j, local.x, local.y)
            };
        }

        function getJardRotationHandleWorld(j) {
            const offsetPx = 34 / scale;
            return getJardWorldFromLocalCentered(j, 0, -j.d * 10 - offsetPx);
        }

        function getResizeHandleHitType(clickXWorld, clickYWorld, j) {
            const handles = getJardResizeHandlesWorld(j);
            const hitRadius = 16 / scale;
            const ordered = [
                { mode: 'w', handle: handles.w },
                { mode: 'w-left', handle: handles.wLeft },
                { mode: 'd', handle: handles.d }
            ];
            for(const entry of ordered) {
                const dx = clickXWorld - entry.handle.x;
                const dy = clickYWorld - entry.handle.y;
                if(Math.sqrt(dx * dx + dy * dy) <= hitRadius) return entry.mode;
            }
            return null;
        }

        function isOnRotationHandle(clickXWorld, clickYWorld, j) {
            const rotHandle = getJardRotationHandleWorld(j);
            const hitRadius = 16 / scale;
            const dx = clickXWorld - rotHandle.x;
            const dy = clickYWorld - rotHandle.y;
            return Math.sqrt(dx * dx + dy * dy) <= hitRadius;
        }

        function worldToJardLocalFromAnchor(j, worldX, worldY, anchorX, anchorY) {
            const dx = worldX - anchorX;
            const dy = worldY - anchorY;
            const cos = Math.cos(j.rot);
            const sin = Math.sin(j.rot);
            return {
                x: dx * cos - dy * sin,
                y: dx * sin + dy * cos
            };
        }

        function worldToJardLocalFromTopLeft(j, worldX, worldY, anchorX, anchorY) {
            return worldToJardLocalFromAnchor(j, worldX, worldY, anchorX, anchorY);
        }

        function getSelectedPlacementObject() {
            return selectedPlacementObject || selected2dJardiniere || selected2dBench || selected2dPottedTree || selected2dCube || selected2dCornerFill || null;
        }

        function getConstructionEntryForItem(item) {
            if(!item) return null;
            return getConstructionItems().find(entry => entry.item === item) || null;
        }

        function getPlacementType(item) {
            if(!item) return null;
            return (getConstructionEntryForItem(item) || {}).type || item.constructionType || 'jardiniere';
        }

        function makeUniquePlacementId(type) {
            const prefix = { jardiniere: 'j', banc: 'b', pottedTree: 't', cube: 'c', table: 'ta', chair: 'ch', hangingPlanter: 'hp', railShelf: 'rs', cornerFill: 'cf', compressionShelf: 'cs' }[type] || 'o';
            return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
        }

        function clonePlacementBlueprint(item) {
            if(!item) return null;
            const type = getPlacementType(item);
            const clean = {};
            for(const key of Object.keys(item)) {
                if(key === 'group' || key === 'renderMetrics') continue;
                const val = item[key];
                if(val === null || val === undefined || typeof val !== 'object') {
                    clean[key] = val;
                } else if(val.isVector3) {
                    clean[key] = { x: val.x, y: val.y, z: val.z };
                } else if(val.isEuler) {
                    clean[key] = { x: val.x, y: val.y, z: val.z, order: val.order };
                } else if(val.isColor) {
                    clean[key] = '#' + val.getHexString();
                } else if(val.isObject3D || val.isMaterial || val.isGeometry || val.isBufferGeometry) {
                    continue;
                } else {
                    try { clean[key] = JSON.parse(JSON.stringify(val)); } catch(_) {}
                }
            }
            return { type, data: JSON.parse(JSON.stringify(clean)) };
        }

        function instantiatePlacementBlueprint(blueprint, options = {}) {
            if(!blueprint || !blueprint.data) return null;
            const type = blueprint.type || blueprint.data.constructionType;
            const data = JSON.parse(JSON.stringify(blueprint.data));
            data.id = makeUniquePlacementId(type);
            const pos = data.pos || {};
            const offset = typeof options.offset === 'number' ? options.offset : 3;
            data.x = (typeof pos.x === 'number' ? pos.x : 0) + offset;
            data.z = (typeof pos.z === 'number' ? pos.z : 0) + offset;
            data.rot = typeof data.rot === 'number' ? data.rot : 0;
            delete data.pos;
            delete data.group;
            if(type === 'jardiniere') {
                const created = addNewJardiniere({
                    selectNew: false,
                    updatePanel: false,
                    x: data.x,
                    z: data.z
                });
                if(!created) return null;
                Object.assign(created, {
                    w: data.w,
                    d: data.d,
                    legH: data.legH,
                    construction: normalizeConstructionSettings(data.construction),
                    woodColor: data.woodColor,
                    treillisBack: data.treillisBack,
                    treillisLeft: data.treillisLeft,
                    treillisRight: data.treillisRight,
                    hasTreillis: data.hasTreillis,
                    treillisH: data.treillisH,
                    treillisType: data.treillisType || 'noisetier',
                    treillisLights: !!data.treillisLights,
                    treillisSpotLights: data.treillisSpotLights !== undefined ? !!data.treillisSpotLights : !!data.treillisLights,
                    treillisWhiteGarland: data.treillisWhiteGarland !== undefined ? !!data.treillisWhiteGarland : (!!data.treillisLights && !data.treillisGinguette),
                    treillisGinguette: !!data.treillisGinguette,
                    garlandPosts: normalizeGarlandPosts(data.garlandPosts),
                    garlandLinks: normalizeGarlandLinks(data.garlandLinks),
                    birdhouse: data.birdhouse !== false,
                    layerView: normalizeLayerView(data.layerView),
                    showSoil: data.showSoil !== false,
                    showGeotextile: data.showGeotextile !== false,
                    showEpdm: data.showEpdm !== false,
                    showGravel: data.showGravel !== false,
                    showMulch: data.showMulch !== false,
                    rot: data.rot,
                    plants: JSON.parse(JSON.stringify(trimPlantsList(data.plants || [])))
                });
                created.pos.set(data.x, 0, data.z);
                rebuildJardiniere(created);
                if(jardinières.length === OPTIMIZED_LIGHTING_JARDINIERE_COUNT) jardinières.forEach(item => rebuildJardiniere(item));
                return created;
            }
            return createConstruction(type, { ...data, skipMagicEffect: true });
        }

        function duplicateSelectedPlacementObject() {
            const selected = getSelectedPlacementObject();
            if(!selected) return null;
            const blueprint = clonePlacementBlueprint(selected);
            if(!blueprint) return null;
            saveState();
            const created = instantiatePlacementBlueprint(blueprint);
            if(created) {
                selectPlacementObject(created, { openEditor: currentEditorMode === 'jardinieres', redraw: false });
                if(typeof triggerMagicDustForPlacement === 'function') triggerMagicDustForPlacement(created, { intensity: 'create' });
                refreshFabricationAndPricing();
                build3DArch();
                draw2D();
            }
            return created;
        }

        function copySelectedPlacementObjectToClipboard() {
            const selected = getSelectedPlacementObject();
            const blueprint = clonePlacementBlueprint(selected);
            if(!blueprint) return false;
            copiedPlacementBlueprint = blueprint;
            return true;
        }

        function pasteCopiedPlacementObject() {
            if(!copiedPlacementBlueprint) return null;
            saveState();
            const created = instantiatePlacementBlueprint(copiedPlacementBlueprint);
            if(!created) return null;
            copiedPlacementBlueprint = clonePlacementBlueprint(created);
            selectPlacementObject(created, { openEditor: currentEditorMode === 'jardinieres', redraw: false });
            if(typeof triggerMagicDustForPlacement === 'function') triggerMagicDustForPlacement(created, { intensity: 'create' });
            refreshFabricationAndPricing();
            build3DArch();
            draw2D();
            return created;
        }

        function deleteSelectedPlacementObject() {
            const selected = getSelectedPlacementObject();
            const type = getPlacementType(selected);
            if(type === 'jardiniere') return delete2dJardiniere();
            if(type === 'banc') return delete2dBench();
            if(type === 'pottedTree') return delete2dPottedTree();
            if(type === 'cube') return delete2dCube();
            if(type === 'table') return delete2dTable();
            if(type === 'chair') return delete2dChair();
            if(type === 'hangingPlanter') return delete2dHangingPlanter();
            if(type === 'railShelf') return delete2dRailShelf();
            if(type === 'cornerFill') return delete2dCornerFill();
            if(type === 'compressionShelf') return delete2dCompressionShelf();
        }

        function getPlacementResizeLimits(item) {
            const type = getPlacementType(item);
            const def = getConstructionType(type);
            if(def && def.resizeLimits) return def.resizeLimits;
            return JARD_RESIZE_LIMITS;
        }

        function setPlacementDimensionFromTopLeft(item, prop, value, limits = null) {
            if(!item || (prop !== 'w' && prop !== 'd')) return false;
            const val = parseFloat(value);
            if(!Number.isFinite(val)) return false;
            const resizeLimits = limits || getPlacementResizeLimits(item);
            const min = window.manualDimensionEditActive ? 0.1 : (prop === 'w' ? resizeLimits.wMin : resizeLimits.dMin);
            const max = prop === 'w' ? resizeLimits.wMax : resizeLimits.dMax;
            const next = Math.max(min, Math.min(max, val));
            const anchor = getJardTopLeftWorld(item);
            item[prop] = next;
            setJardCenterFromTopLeftWorld(item, anchor.x, anchor.y);
            return true;
        }

        function resetPlacementInteractionState() {
            draggedJardiniere = null;
            draggedBench = null;
            draggedPlacementObject = null;
            pendingDraggedJardiniere = null;
            pendingDraggedBench = null;
            pendingDraggedPlacementObject = null;
            rotatingJardiniere = null;
            rotatingBench = null;
            rotatingPlacementObject = null;
            resizingJardiniere = null;
            resizingBench = null;
            resizingPlacementObject = null;
            activeCornerArrangementResize = null;
            dragOriginalRot = null;
            activeWallSnapPlacement = null;
            activeWallSnapSegmentIndex = null;
            clearPlacementAlignmentGuides();
            resizeMode = null;
        }

        function setActivePlacementObject(item) {
            const type = getPlacementType(item);
            selectedPlacementObject = item || null;
            selected2dJardiniere = type === 'jardiniere' ? item : null;
            selected2dBench = type === 'banc' ? item : null;
            selected2dPottedTree = type === 'pottedTree' ? item : null;
            selected2dCube = type === 'cube' ? item : null;
            selected2dCornerFill = type === 'cornerFill' ? item : null;
        }

        function selectPlacementObject(item, options = {}) {
            if(!item) return;
            const { openEditor = true, redraw = true, center = false } = options;
            resetPlacementInteractionState();
            if(typeof setSelectedSlabZone === 'function') setSelectedSlabZone(null, { redraw: false });
            setActivePlacementObject(item);
            if(openEditor && currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
            try { updateJardPanel(); } catch(e) {}
            try { updateJard3DHighlight(); } catch(e) {}
            if(center && getPlacementType(item) === 'jardiniere') center2DOnJardiniere(item);
            updateJardFloatingOpenButton();
            if(redraw) draw2D();
        }

        function clearPlacementSelection(options = {}) {
            const { redraw = true } = options;
            resetPlacementInteractionState();
            selectedPlacementObject = null;
            selected2dJardiniere = null;
            selected2dBench = null;
            selected2dPottedTree = null;
            selected2dCube = null;
            selected2dCornerFill = null;
            updateJardPanel();
            updateJard3DHighlight();
            updateJardFloatingOpenButton();
            if(redraw) draw2D();
        }

        function rebuildPlacementObject(obj) {
            if(!obj) return;
            const type = getPlacementType(obj);
            const def = getConstructionType(type);
            if(def && typeof def.rebuild === 'function') def.rebuild(obj);
            else if(type === 'banc') rebuildBench(obj);
            else rebuildJardiniere(obj);
            updateJard3DHighlight();
        }

        function schedulePlacementSideEffects(obj) {
            if(!obj) return;
            markSolarMapDirty();
            const type = getPlacementType(obj);
            if(type === 'jardiniere') {
                scheduleLiveGarlandRebuild(obj);
            } else {
                refreshFabricationAndPricing();
            }
            try { updateJard3DHighlight(); } catch(e) {}
        }

        function findPlacementAt2D(worldX, worldY, tolerance = 0) {
            const entries = getConstructionItems();
            for(let idx = entries.length - 1; idx >= 0; idx--) {
                const entry = entries[idx];
                if(pointInRotatedRect(worldX, worldY, entry.item, tolerance)) return entry.item;
            }
            return null;
        }

        function getPlacementCenterWorld(item) {
            if(!item || !item.pos) return null;
            return {
                x: item.pos.x * 20,
                y: item.pos.z * 20
            };
        }

        function getPlacementAlignmentEdgesWorld(item) {
            if(!item || !item.pos) return null;
            const cx = item.pos.x * 20;
            const cy = item.pos.z * 20;
            const halfW = item.w * 10;
            const halfD = item.d * 10;
            let rot = (item.rot || 0) % (Math.PI * 2);
            if(rot < 0) rot += Math.PI * 2;
            const nearHoriz = rot < 0.26 || Math.abs(rot - Math.PI) < 0.26 || rot > Math.PI * 2 - 0.26;
            const nearVert = Math.abs(rot - Math.PI / 2) < 0.26 || Math.abs(rot - Math.PI * 3 / 2) < 0.26;
            let xs, ys;
            if(nearHoriz) {
                xs = [cx - halfW, cx, cx + halfW];
                ys = [cy - halfD, cy, cy + halfD];
            } else if(nearVert) {
                xs = [cx - halfD, cx, cx + halfD];
                ys = [cy - halfW, cy, cy + halfW];
            } else {
                xs = [cx];
                ys = [cy];
            }
            return { cx, cy, xs, ys };
        }

        function clearPlacementAlignmentGuides() {
            placementAlignmentGuides = [];
        }

        function updatePlacementAlignmentGuides(activeItem) {
            clearPlacementAlignmentGuides();
            const active = getPlacementAlignmentEdgesWorld(activeItem);
            if(!active) return { dx: 0, dy: 0 };
            const thresholdWorld = PLACEMENT_ALIGNMENT_GUIDE_THRESHOLD_SCREEN_PX / Math.max(scale || 1, 0.01);
            const guidePad = Math.max(90 / Math.max(scale || 1, 0.01), 60);
            let bestX = null;
            let bestY = null;
            getConstructionItems().forEach(entry => {
                const other = entry.item;
                if(!other || other === activeItem) return;
                const ref = getPlacementAlignmentEdgesWorld(other);
                if(!ref) return;
                active.xs.forEach(ax => {
                    ref.xs.forEach(rx => {
                        const dist = Math.abs(ax - rx);
                        if(dist <= thresholdWorld && (!bestX || dist < bestX.dist)) {
                            bestX = { dist, value: rx, snapDx: rx - ax, fromY: Math.min(active.cy, ref.cy) - guidePad, toY: Math.max(active.cy, ref.cy) + guidePad };
                        }
                    });
                });
                active.ys.forEach(ay => {
                    ref.ys.forEach(ry => {
                        const dist = Math.abs(ay - ry);
                        if(dist <= thresholdWorld && (!bestY || dist < bestY.dist)) {
                            bestY = { dist, value: ry, snapDy: ry - ay, fromX: Math.min(active.cx, ref.cx) - guidePad, toX: Math.max(active.cx, ref.cx) + guidePad };
                        }
                    });
                });
            });
            if(bestX) placementAlignmentGuides.push({ axis: 'x', value: bestX.value, from: bestX.fromY, to: bestX.toY });
            if(bestY) placementAlignmentGuides.push({ axis: 'y', value: bestY.value, from: bestY.fromX, to: bestY.toX });
            return { dx: bestX ? bestX.snapDx : 0, dy: bestY ? bestY.snapDy : 0 };
        }

        function drawPlacementAlignmentGuides() {
            if(!placementAlignmentGuides.length) return;
            ctx2d.save();
            ctx2d.strokeStyle = isLightMode() ? 'rgba(25, 120, 145, 0.78)' : 'rgba(110, 235, 255, 0.88)';
            ctx2d.lineWidth = 1.8 / scale;
            ctx2d.setLineDash([10 / scale, 7 / scale]);
            placementAlignmentGuides.forEach(guide => {
                ctx2d.beginPath();
                if(guide.axis === 'x') {
                    ctx2d.moveTo(guide.value, guide.from);
                    ctx2d.lineTo(guide.value, guide.to);
                } else {
                    ctx2d.moveTo(guide.from, guide.value);
                    ctx2d.lineTo(guide.to, guide.value);
                }
                ctx2d.stroke();
            });
            ctx2d.setLineDash([]);
            ctx2d.restore();
        }

        function drawDrawingSnapGuides() {
            if(!drawingSnapGuides.length || (!isDrawingToolActive && !draggingSketchVertex) || (!currentPoint && !draggingSketchVertex)) return;
            ctx2d.save();
            ctx2d.strokeStyle = isLightMode() ? 'rgba(20, 140, 110, 0.72)' : 'rgba(70, 230, 190, 0.82)';
            ctx2d.lineWidth = 1.5 / scale;
            ctx2d.setLineDash([6 / scale, 5 / scale]);
            drawingSnapGuides.forEach(guide => {
                if(guide.type === 'extension' || guide.type === 'segment-continuation' || guide.type === 'segment-snap') {
                    const vx = guide.p2.x - guide.p1.x;
                    const vy = guide.p2.y - guide.p1.y;
                    const len = Math.hypot(vx, vy);
                    if(len < 0.01) return;
                    const ux = vx / len;
                    const uy = vy / len;
                    const snap = guide.snap;
                    const tSnap = guide.type === 'segment-snap'
                        ? Math.max(0, Math.min(1, ((snap.x - guide.p1.x) * vx + (snap.y - guide.p1.y) * vy) / (len * len)))
                        : ((snap.x - guide.p1.x) * vx + (snap.y - guide.p1.y) * vy) / (len * len);
                    const extLen = guide.type === 'segment-snap' ? 0 : 40 / scale;
                    ctx2d.beginPath();
                    if(guide.type === 'segment-snap') {
                        ctx2d.moveTo(guide.p1.x, guide.p1.y);
                        ctx2d.lineTo(guide.p2.x, guide.p2.y);
                    } else if(tSnap > 1) {
                        ctx2d.moveTo(guide.p2.x, guide.p2.y);
                        ctx2d.lineTo(snap.x + ux * extLen, snap.y + uy * extLen);
                    } else {
                        ctx2d.moveTo(guide.p1.x, guide.p1.y);
                        ctx2d.lineTo(snap.x - ux * extLen, snap.y - uy * extLen);
                    }
                    ctx2d.stroke();
                    ctx2d.setLineDash([]);
                    ctx2d.beginPath();
                    ctx2d.arc(snap.x, snap.y, 5 / scale, 0, Math.PI * 2);
                    ctx2d.stroke();
                    ctx2d.setLineDash([6 / scale, 5 / scale]);
                } else if(guide.type === 'perpendicular') {
                    const snap = guide.snap;
                    const pux = guide.ux;
                    const puy = guide.uy;
                    // Segment direction = (puy, -pux)
                    const sex = puy;
                    const sey = -pux;
                    const sq = 8 / scale;
                    ctx2d.setLineDash([]);
                    // Symbole d'équerre au point de snap
                    ctx2d.beginPath();
                    ctx2d.moveTo(snap.x - pux * sq, snap.y - puy * sq);
                    ctx2d.lineTo(snap.x - pux * sq + sex * sq, snap.y - puy * sq + sey * sq);
                    ctx2d.lineTo(snap.x + sex * sq, snap.y + sey * sq);
                    ctx2d.stroke();
                    ctx2d.beginPath();
                    ctx2d.arc(snap.x, snap.y, 4 / scale, 0, Math.PI * 2);
                    ctx2d.stroke();
                } else if(guide.type === 'current-continuation' || guide.type === 'vertex-continuation' || guide.type === 'vertex-perpendicular') {
                    const anchor = guide.anchor;
                    const snap = guide.snap || anchor;
                    const ux = guide.ux ?? 1;
                    const uy = guide.uy ?? 0;
                    const along = (snap.x - anchor.x) * ux + (snap.y - anchor.y) * uy;
                    const guideEnd = Math.abs(along) + 28 / scale;
                    const dir = along < 0 ? -1 : 1;
                    ctx2d.beginPath();
                    ctx2d.moveTo(anchor.x, anchor.y);
                    ctx2d.lineTo(anchor.x + ux * dir * guideEnd, anchor.y + uy * dir * guideEnd);
                    ctx2d.stroke();
                }
            });
            ctx2d.setLineDash([]);
            ctx2d.restore();
        }

        function drawPlacementResizeHandle(pt, obj, axis, active) {
            const handleR = 12 / scale;
            ctx2d.save();
            ctx2d.translate(pt.x, pt.y);
            ctx2d.rotate(-(obj.rot || 0));
            ctx2d.fillStyle = active ? 'rgba(24, 24, 24, 0.82)' : 'rgba(24, 24, 24, 0.68)';
            ctx2d.beginPath();
            ctx2d.arc(0, 0, handleR, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.98)';
            ctx2d.lineWidth = 1.4 / scale;
            ctx2d.beginPath();
            ctx2d.arc(0, 0, handleR, 0, Math.PI * 2);
            ctx2d.stroke();

            const shaft = 6.4 / scale;
            const arrow = 4.8 / scale;
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.lineWidth = 2 / scale;
            const drawTriangle = (x1, y1, x2, y2, x3, y3) => {
                ctx2d.beginPath();
                ctx2d.moveTo(x1, y1);
                ctx2d.lineTo(x2, y2);
                ctx2d.lineTo(x3, y3);
                ctx2d.closePath();
                ctx2d.fill();
            };
            ctx2d.beginPath();
            if(axis === 'w') {
                ctx2d.moveTo(-shaft, 0);
                ctx2d.lineTo(shaft, 0);
            } else {
                ctx2d.moveTo(0, -shaft);
                ctx2d.lineTo(0, shaft);
            }
            ctx2d.stroke();

            if(axis === 'w') {
                drawTriangle(-shaft - arrow, 0, -shaft + 0.2 / scale, -arrow * 0.7, -shaft + 0.2 / scale, arrow * 0.7);
                drawTriangle(shaft + arrow, 0, shaft - 0.2 / scale, -arrow * 0.7, shaft - 0.2 / scale, arrow * 0.7);
            } else {
                drawTriangle(0, -shaft - arrow, -arrow * 0.7, -shaft + 0.2 / scale, arrow * 0.7, -shaft + 0.2 / scale);
                drawTriangle(0, shaft + arrow, -arrow * 0.7, shaft - 0.2 / scale, arrow * 0.7, shaft - 0.2 / scale);
            }
            ctx2d.restore();
        }

        function drawCornerArrangementResizeHandle(handle, active) {
            const handleR = 12 / Math.max(scale || 1, 0.01);
            const shaft = 7 / Math.max(scale || 1, 0.01);
            const arrow = 5 / Math.max(scale || 1, 0.01);
            ctx2d.save();
            ctx2d.translate(handle.x, handle.y);
            ctx2d.rotate(handle.angle || 0);
            ctx2d.fillStyle = active ? 'rgba(28, 28, 28, 0.88)' : 'rgba(28, 28, 28, 0.72)';
            ctx2d.beginPath();
            ctx2d.arc(0, 0, handleR, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.98)';
            ctx2d.lineWidth = 1.4 / scale;
            ctx2d.stroke();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.lineWidth = 2 / scale;
            ctx2d.beginPath();
            ctx2d.moveTo(-shaft, 0);
            ctx2d.lineTo(shaft, 0);
            ctx2d.stroke();
            ctx2d.beginPath();
            ctx2d.moveTo(shaft + arrow, 0);
            ctx2d.lineTo(shaft - arrow * 0.35, -arrow * 0.72);
            ctx2d.lineTo(shaft - arrow * 0.35, arrow * 0.72);
            ctx2d.closePath();
            ctx2d.fill();
            ctx2d.beginPath();
            ctx2d.moveTo(-shaft - arrow, 0);
            ctx2d.lineTo(-shaft + arrow * 0.35, -arrow * 0.72);
            ctx2d.lineTo(-shaft + arrow * 0.35, arrow * 0.72);
            ctx2d.closePath();
            ctx2d.fill();
            ctx2d.restore();
        }

        function drawPlacementRotationHandle(obj, active) {
            const topCenter = getJardWorldFromLocalCentered(obj, 0, -obj.d * 10);
            const rotHandle = getJardRotationHandleWorld(obj);
            ctx2d.save();
            ctx2d.strokeStyle = 'rgba(18, 18, 18, 0.82)';
            ctx2d.lineWidth = 4.2 / scale;
            ctx2d.beginPath();
            ctx2d.moveTo(topCenter.x, topCenter.y);
            ctx2d.lineTo(rotHandle.x, rotHandle.y);
            ctx2d.stroke();
            ctx2d.strokeStyle = 'rgba(245, 245, 245, 0.98)';
            ctx2d.lineWidth = 1.8 / scale;
            ctx2d.beginPath();
            ctx2d.moveTo(topCenter.x, topCenter.y);
            ctx2d.lineTo(rotHandle.x, rotHandle.y);
            ctx2d.stroke();
            ctx2d.restore();

            ctx2d.save();
            ctx2d.translate(rotHandle.x, rotHandle.y);
            ctx2d.rotate(-(obj.rot || 0));
            const hitR = 13 / scale;
            const arcR = 7.6 / scale;
            const arrowSize = 6.8 / scale;
            ctx2d.fillStyle = active ? 'rgba(24, 24, 24, 0.82)' : 'rgba(24, 24, 24, 0.68)';
            ctx2d.beginPath();
            ctx2d.arc(0, 0, hitR, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.98)';
            ctx2d.lineWidth = 1.4 / scale;
            ctx2d.setLineDash([]);
            ctx2d.beginPath();
            ctx2d.arc(0, 0, hitR, 0, Math.PI * 2);
            ctx2d.stroke();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.lineWidth = 2.4 / scale;
            const arcStart = -Math.PI * 0.95;
            const arcEnd = Math.PI * 0.62;
            ctx2d.beginPath();
            ctx2d.arc(0, 0, arcR, arcStart, arcEnd);
            ctx2d.stroke();
            const ax2 = arcR * Math.cos(arcEnd);
            const ay2 = arcR * Math.sin(arcEnd);
            const tangentDir = arcEnd + Math.PI / 2;
            ctx2d.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.beginPath();
            ctx2d.moveTo(ax2, ay2);
            ctx2d.lineTo(ax2 - arrowSize * Math.cos(tangentDir - 0.45), ay2 - arrowSize * Math.sin(tangentDir - 0.45));
            ctx2d.lineTo(ax2 - arrowSize * Math.cos(tangentDir + 0.45), ay2 - arrowSize * Math.sin(tangentDir + 0.45));
            ctx2d.closePath();
            ctx2d.fill();
            ctx2d.restore();
        }

        function getBenchSeatBoardLayout(bench, settings = getDefaultConstructionSettings()) {
            const boardW = settings.boardWidth;
            const gap = settings.boardGap || 0;
            const count = Math.max(2, Math.floor((bench.d + gap) / (boardW + gap)));
            const totalDepth = count * boardW + Math.max(0, count - 1) * gap;
            return { count, boardW, gap, totalDepth };
        }

	       function draw2D() {
                if(!canvas2d) return;
	            canvas2d.style.width = '100%';
	            canvas2d.style.height = '100%';
	    const rect = canvas2d.getBoundingClientRect();
	            if(rect.width <= 0 || rect.height <= 0) return;
	            measureAreas = [];
	            const dpr = Math.min(window.devicePixelRatio || 1, MAX_2D_DPR);
                const nextCanvasW = Math.max(1, Math.round(rect.width * dpr));
                const nextCanvasH = Math.max(1, Math.round(rect.height * dpr));
                if(canvas2d.width !== nextCanvasW || canvas2d.height !== nextCanvasH) {
                    canvas2d.width = nextCanvasW;
                    canvas2d.height = nextCanvasH;
                }
	            canvas2d.style.transform = "none"; 

            ctx2d.setTransform(1, 0, 0, 1, 0, 0);
            ctx2d.clearRect(0, 0, canvas2d.width, canvas2d.height);
            ctx2d.scale(dpr, dpr);
            if (Math.abs(screenRotation2DDeg) > 1e-6) {
                const vcx = rect.width / 2;
                const vcy = rect.height / 2;
                ctx2d.translate(vcx, vcy);
                ctx2d.rotate(screenRotation2DDeg * Math.PI / 180);
                ctx2d.translate(-vcx, -vcy);
            }

    ctx2d.translate(offsetX, offsetY);
    ctx2d.scale(scale, scale);
    const _sceneRot2d = (balconyOrientationDeg - balconyWorldOrientationDeg) * Math.PI / 180;
    const _useBuildingAlignedGrid2d = typeof buildingAlignedGridActive !== 'undefined' && buildingAlignedGridActive;
    const _balconyPivot2d = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
    const _balconySceneOffsetX2d = Number.isFinite(balconyOffsetX) ? balconyOffsetX * 20 : 0;
    const _balconySceneOffsetY2d = Number.isFinite(balconyOffsetZ) ? balconyOffsetZ * 20 : 0;
    function applyBalconySceneCanvasTransform2D() {
        if(Math.abs(_balconySceneOffsetX2d) > 1e-9 || Math.abs(_balconySceneOffsetY2d) > 1e-9) {
            ctx2d.translate(_balconySceneOffsetX2d, _balconySceneOffsetY2d);
        }
        ctx2d.translate(_balconyPivot2d.x || 0, _balconyPivot2d.y || 0);
        if(Math.abs(_sceneRot2d) > 1e-9) ctx2d.rotate(_sceneRot2d);
        ctx2d.translate(-( _balconyPivot2d.x || 0), -( _balconyPivot2d.y || 0));
    }
    if(_useBuildingAlignedGrid2d) {
        applyBalconySceneCanvasTransform2D();
    }

    // --- GRILLE ARCHITECTURALE ---
    const step10 = 20;   // 10cm
    const step50 = 100;  // 50cm
    const step100 = 200; // 1m
    const lightCanvas = isLightMode();
    const gridColor10 = lightCanvas ? '#e2decf' : '#222';
    const gridColor50 = lightCanvas ? '#cfc8b7' : '#333';
    const gridColor100 = lightCanvas ? '#aaa18d' : '#555';
    const canvasLabelColor = lightCanvas ? '#171717' : '#ffffff';
    const canvasLabelMutedColor = lightCanvas ? 'rgba(20,20,20,0.72)' : 'rgba(255,255,255,0.72)';
    const canvasGuideColor = lightCanvas ? 'rgba(30,30,30,0.55)' : 'rgba(255,255,255,0.75)';
    const hasImportedEnvironment2D = !!(horizonSettings && horizonSettings.neighborhood && horizonSettings.neighborhood.enabled && Array.isArray(horizonSettings.neighborhood.buildings) && horizonSettings.neighborhood.buildings.length);
    const lightEnvironmentDraw2D = typeof shouldUseLightweight2DEnvironment === 'function' && shouldUseLightweight2DEnvironment();
    const gridDrawStep = lightEnvironmentDraw2D && hasImportedEnvironment2D ? step50 : step10;

	    // Grille 2D: lisible pres du balcon, puis disparition progressive vers 15 m.
    const gridFadeDistancePx = typeof GRID_FADE_DISTANCE_PX === 'number' ? GRID_FADE_DISTANCE_PX : 3000;
    const gridFadePaddingPx = step100;
    const localGridPolygon = getPrimaryContourPolygon2D();
    const gridFadePolygon = _useBuildingAlignedGrid2d
        ? localGridPolygon
        : (typeof transformBalconyScenePoint2D === 'function' ? localGridPolygon.map(point => transformBalconyScenePoint2D(point)) : localGridPolygon);
    const gridFadeBounds = (() => {
        if(!gridFadePolygon || gridFadePolygon.length < 3) return null;
        return gridFadePolygon.reduce((bounds, point) => ({
            minX: Math.min(bounds.minX, point.x),
            maxX: Math.max(bounds.maxX, point.x),
            minY: Math.min(bounds.minY, point.y),
            maxY: Math.max(bounds.maxY, point.y)
        }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
    })();
	    const viewportPaddingPx = step100;
	    function get2DViewportBoundsInGridSpace() {
	        const screenCorners = [
	            { x: -viewportPaddingPx, y: -viewportPaddingPx },
	            { x: rect.width + viewportPaddingPx, y: -viewportPaddingPx },
	            { x: rect.width + viewportPaddingPx, y: rect.height + viewportPaddingPx },
	            { x: -viewportPaddingPx, y: rect.height + viewportPaddingPx }
	        ];
	        const viewAngleRad = screenRotation2DDeg * Math.PI / 180;
	        const vcx = rect.width / 2;
	        const vcy = rect.height / 2;
	        const cosV = Math.abs(viewAngleRad) < 1e-6 ? 1 : Math.cos(-viewAngleRad);
	        const sinV = Math.abs(viewAngleRad) < 1e-6 ? 0 : Math.sin(-viewAngleRad);
	        const canvasCorners = screenCorners.map(({x, y}) => {
	            if (Math.abs(viewAngleRad) < 1e-6) return { x, y };
	            const dx = x - vcx;
	            const dy = y - vcy;
	            return { x: vcx + dx * cosV - dy * sinV, y: vcy + dx * sinV + dy * cosV };
	        });
	        const cosR = Math.cos(-_sceneRot2d);
	        const sinR = Math.sin(-_sceneRot2d);
	        return canvasCorners.reduce((bounds, corner) => {
	            let x = (corner.x - offsetX) / scale;
	            let y = (corner.y - offsetY) / scale;
	            if(_useBuildingAlignedGrid2d) {
	                x -= _balconySceneOffsetX2d + (_balconyPivot2d.x || 0);
	                y -= _balconySceneOffsetY2d + (_balconyPivot2d.y || 0);
	                const rx = x * cosR - y * sinR;
	                const ry = x * sinR + y * cosR;
	                x = rx + (_balconyPivot2d.x || 0);
	                y = ry + (_balconyPivot2d.y || 0);
	            }
	            return {
	                minX: Math.min(bounds.minX, x),
	                maxX: Math.max(bounds.maxX, x),
	                minY: Math.min(bounds.minY, y),
	                maxY: Math.max(bounds.maxY, y)
	            };
	        }, { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
	    }
	    const viewportGridBounds = get2DViewportBoundsInGridSpace();
	    const viewMinX = Math.floor(viewportGridBounds.minX / step10) * step10;
	    const viewMaxX = Math.ceil(viewportGridBounds.maxX / step10) * step10;
	    const viewMinY = Math.floor(viewportGridBounds.minY / step10) * step10;
	    const viewMaxY = Math.ceil(viewportGridBounds.maxY / step10) * step10;
    const gridLimitMinX = gridFadeBounds ? gridFadeBounds.minX - gridFadeDistancePx - gridFadePaddingPx : -WORLD_GRID_HALF_PX;
    const gridLimitMaxX = gridFadeBounds ? gridFadeBounds.maxX + gridFadeDistancePx + gridFadePaddingPx : WORLD_GRID_HALF_PX;
    const gridLimitMinY = gridFadeBounds ? gridFadeBounds.minY - gridFadeDistancePx - gridFadePaddingPx : -WORLD_GRID_HALF_PX;
    const gridLimitMaxY = gridFadeBounds ? gridFadeBounds.maxY + gridFadeDistancePx + gridFadePaddingPx : WORLD_GRID_HALF_PX;
	    const visibleMinX = Math.max(-WORLD_GRID_HALF_PX, gridLimitMinX, viewMinX);
	    const visibleMaxX = Math.min(WORLD_GRID_HALF_PX, gridLimitMaxX, viewMaxX);
	    const visibleMinY = Math.max(-WORLD_GRID_HALF_PX, gridLimitMinY, viewMinY);
	    const visibleMaxY = Math.min(WORLD_GRID_HALF_PX, gridLimitMaxY, viewMaxY);
    function getGridLineStyle(i) {
        if(i % step100 === 0) return { width: 2 / scale, color: gridColor100, alpha: 1 };
        if(i % step50 === 0) return { width: 1 / scale, color: gridColor50, alpha: 0.86 };
        return { width: 0.5 / scale, color: gridColor10, alpha: 0.66 };
    }
    function distanceToGridFadePolygon(point) {
        if(!gridFadePolygon || gridFadePolygon.length < 3) return 0;
        if(typeof pointInPolygon === 'function' && pointInPolygon(point, gridFadePolygon)) return 0;
        let best = Infinity;
        for(let i = 0; i < gridFadePolygon.length; i++) {
            const a = gridFadePolygon[i];
            const b = gridFadePolygon[(i + 1) % gridFadePolygon.length];
            const projection = projectPointToSegment2D(point.x, point.y, a, b);
            if(!projection) continue;
            best = Math.min(best, Math.hypot(point.x - projection.x, point.y - projection.y));
        }
        return Number.isFinite(best) ? best : 0;
    }
    function gridFadeAlphaAt(x, y) {
        const distance = distanceToGridFadePolygon({ x, y });
        return Math.max(0, Math.min(1, 1 - distance / gridFadeDistancePx));
    }
    function drawFadedGridSegment(x1, y1, x2, y2, style) {
        const mx = (x1 + x2) * 0.5;
        const my = (y1 + y2) * 0.5;
        const alpha = gridFadeAlphaAt(mx, my) * style.alpha;
        if(alpha <= 0.015) return;
        ctx2d.globalAlpha = alpha;
        ctx2d.beginPath();
        ctx2d.lineWidth = style.width;
        ctx2d.strokeStyle = style.color;
        ctx2d.moveTo(x1, y1);
        ctx2d.lineTo(x2, y2);
        ctx2d.stroke();
    }
    const fadeSegmentLength = step50;
    for(let i = Math.floor(visibleMinX / gridDrawStep) * gridDrawStep; i <= visibleMaxX; i += gridDrawStep) {
        const style = getGridLineStyle(i);
        for(let y = visibleMinY; y < visibleMaxY; y += fadeSegmentLength) {
            drawFadedGridSegment(i, y, i, Math.min(visibleMaxY, y + fadeSegmentLength), style);
        }
    }
	    for(let i = Math.floor(visibleMinY / gridDrawStep) * gridDrawStep; i <= visibleMaxY; i += gridDrawStep) {
	        const style = getGridLineStyle(i);
        for(let x = visibleMinX; x < visibleMaxX; x += fadeSegmentLength) {
            drawFadedGridSegment(x, i, Math.min(visibleMaxX, x + fadeSegmentLength), i, style);
        }
	    }
    ctx2d.globalAlpha = 1;

    if(!_useBuildingAlignedGrid2d) applyBalconySceneCanvasTransform2D();

	    // --- SURFACE SOL ---
    const primaryContourSegments = getPrimaryContourSegments();
    if(balconyDesignMode === 'balcon' && isContourClosed && primaryContourSegments.length >= 3) {
        const contour = primaryContourSegments.map(s => ({ x: s.p1.x, y: s.p1.y }));
        if(contour.length >= 3) {
            ctx2d.save();
            ctx2d.beginPath();
            contour.forEach((pt, index) => {
                if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                else ctx2d.lineTo(pt.x, pt.y);
            });
            ctx2d.closePath();
            ctx2d.fillStyle = typeof getSlabZoneColor === 'function' ? getSlabZoneColor('primary') : archColors.slab;
            ctx2d.fill();
            if(selectedSlabZoneId === 'primary') {
                ctx2d.save();
                ctx2d.strokeStyle = 'rgba(255, 210, 98, 0.95)';
                ctx2d.lineWidth = 4 / scale;
                ctx2d.setLineDash([12 / scale, 7 / scale]);
                ctx2d.stroke();
                ctx2d.restore();
            }
            ctx2d.clip();
            ctx2d.strokeStyle = '#777777';
            ctx2d.lineWidth = 1 / scale;
            const bounds = getPolygonBoundingBox(contour);
            const spacing = 40;
            for(let x = bounds.minX - bounds.width; x <= bounds.maxX + bounds.width; x += spacing) {
                ctx2d.beginPath();
                ctx2d.moveTo(x, bounds.minY - bounds.height);
                ctx2d.lineTo(x + bounds.height + bounds.width, bounds.maxY + bounds.height);
                ctx2d.stroke();
            }
            ctx2d.restore();
        }
    }

    if(balconyDesignMode === 'balcon' && typeof getDetachedSegmentGroups === 'function') {
        getDetachedSegmentGroups().forEach(group => {
            if(!group || group.length < 3 || (typeof isSegmentGroupClosed === 'function' && !isSegmentGroupClosed(group))) return;
            const contour = [{ x: group[0].p1.x, y: group[0].p1.y }];
            const zoneId = group[0] && group[0].sketchId;
            group.forEach(s => contour.push({ x: s.p2.x, y: s.p2.y }));
            if(contour.length < 4) return;
            ctx2d.save();
            ctx2d.beginPath();
            contour.forEach((pt, index) => {
                if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                else ctx2d.lineTo(pt.x, pt.y);
            });
            ctx2d.closePath();
            ctx2d.fillStyle = typeof getSlabZoneColor === 'function' ? getSlabZoneColor(zoneId) : 'rgba(184, 155, 114, 0.11)';
            ctx2d.globalAlpha = 0.72;
            ctx2d.fill();
            ctx2d.globalAlpha = 1;
            if(zoneId && selectedSlabZoneId === zoneId) {
                ctx2d.strokeStyle = 'rgba(255, 210, 98, 0.95)';
                ctx2d.lineWidth = 4 / scale;
                ctx2d.setLineDash([12 / scale, 7 / scale]);
                ctx2d.stroke();
            }
            ctx2d.restore();
        });
    }

    if(balconyDesignMode === 'exterieur') {
        surfaces.forEach(surface => {
            if(!surface.points || surface.points.length < 3) return;
            const material = surfaceMaterials[surface.material] || surfaceMaterials.herbe;
            ctx2d.save();
            ctx2d.beginPath();
            surface.points.forEach((pt, index) => {
                if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                else ctx2d.lineTo(pt.x, pt.y);
            });
            ctx2d.closePath();
            ctx2d.fillStyle = material.color;
            ctx2d.fill();
            ctx2d.strokeStyle = material.line;
            ctx2d.lineWidth = 2 / scale;
            ctx2d.stroke();
            ctx2d.restore();
        });

        if(currentSurfacePoints.length > 0 && mousePos2d) {
            ctx2d.save();
            ctx2d.strokeStyle = canvasGuideColor;
            ctx2d.lineWidth = 2 / scale;
            ctx2d.setLineDash([10/scale, 6/scale]);
            ctx2d.beginPath();
            currentSurfacePoints.forEach((pt, index) => {
                if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                else ctx2d.lineTo(pt.x, pt.y);
            });
            ctx2d.lineTo(mousePos2d.x, mousePos2d.y);
            ctx2d.stroke();
            ctx2d.setLineDash([]);
            ctx2d.restore();
        }
    }

    if(typeof renderNeighborhoodFootprints2D === 'function') renderNeighborhoodFootprints2D();
    if(typeof renderMyBuildingVirtualSegments2D === 'function') renderMyBuildingVirtualSegments2D();
    if(typeof renderBalconyBuildingPlacementOverlay2D === 'function') renderBalconyBuildingPlacementOverlay2D();
    renderSolarMap2DOverlay();
    renderVisAVis2DOverlay();
    renderVisAVisZoneIndicator2D();

    if(ceilingShapePoints.length > 0) {
        ctx2d.save();
        ctx2d.beginPath();
        ceilingShapePoints.forEach((pt, index) => {
            if(index === 0) ctx2d.moveTo(pt.x, pt.y);
            else ctx2d.lineTo(pt.x, pt.y);
        });
        ctx2d.closePath();
        ctx2d.fillStyle = 'rgba(216, 210, 196, 0.18)';
        ctx2d.fill();
        ctx2d.strokeStyle = archColors.ceiling || '#d8d2c4';
        ctx2d.lineWidth = 2 / scale;
        ctx2d.setLineDash([12 / scale, 7 / scale]);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
        ctx2d.restore();
    }

    if(drawingMode === 'ceiling-shape' && currentCeilingPoints.length > 0 && mousePos2d) {
        ctx2d.save();
        ctx2d.strokeStyle = archColors.ceiling || '#d8d2c4';
        ctx2d.lineWidth = 2 / scale;
        ctx2d.setLineDash([10 / scale, 6 / scale]);
        ctx2d.beginPath();
        currentCeilingPoints.forEach((pt, index) => {
            if(index === 0) ctx2d.moveTo(pt.x, pt.y);
            else ctx2d.lineTo(pt.x, pt.y);
        });
        ctx2d.lineTo(mousePos2d.x, mousePos2d.y);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
        ctx2d.restore();
    }

    // --- EMPREINTE REELLE DES MURS ---
    const planWallThicknessPx = 8;
    function drawWallFootprintBands(segmentList, polygon, edgeModes = []) {
        if(!segmentList || !segmentList.length || !polygon || polygon.length < 3) return;
        const outer = computeOffsetContour2D(polygon, planWallThicknessPx, edgeModes);
        if(!outer || outer.length !== polygon.length) return;
        ctx2d.save();
        segmentList.forEach((s, index) => {
            if(!s || s.sharedContourEdge || !isThickPlanSegment(s.type)) return;
            const innerStart = polygon[index];
            const innerEnd = polygon[(index + 1) % polygon.length];
            const outerStart = outer[index];
            const outerEnd = outer[(index + 1) % outer.length];
            if(!innerStart || !innerEnd || !outerStart || !outerEnd) return;
            const baseColor = s.type === 'rail'
                ? (archColors.rail || '#c8b89a')
                : (s.type === 'window' || s.type === 'glass' ? '#88ccff' : (s.type === 'door' ? '#c8a870' : (archColors.wall || '#ffffff')));
            ctx2d.beginPath();
            ctx2d.moveTo(innerStart.x, innerStart.y);
            ctx2d.lineTo(innerEnd.x, innerEnd.y);
            ctx2d.lineTo(outerEnd.x, outerEnd.y);
            ctx2d.lineTo(outerStart.x, outerStart.y);
            ctx2d.closePath();
            ctx2d.fillStyle = baseColor;
            ctx2d.globalAlpha = lightCanvas ? 0.28 : 0.36;
            ctx2d.fill();
            ctx2d.globalAlpha = lightCanvas ? 0.42 : 0.46;
            ctx2d.strokeStyle = baseColor;
            ctx2d.lineWidth = 1 / scale;
            ctx2d.stroke();
        });
        ctx2d.restore();
    }

    if(balconyDesignMode === 'balcon' && isContourClosed && primaryContourSegments.length >= 3) {
        drawWallFootprintBands(primaryContourSegments, primaryContourSegments.map(s => ({ x: s.p1.x, y: s.p1.y })));
    }
    if(balconyDesignMode === 'balcon' && typeof getDetachedSegmentGroups === 'function') {
        getDetachedSegmentGroups().forEach(group => {
            const polygon = getDetachedGroupPolygon2D(group);
            if(polygon.length < 3) return;
            const edgeModes = group.map(s => s && s.sharedContourEdge ? 'inward' : 'outward');
            drawWallFootprintBands(group, polygon, edgeModes);
        });
    }

	    // --- MURS ---
	    segments.forEach((s, segmentIndex) => {
	        if(s.sharedContourEdge) return;
	        const isSelectedSketchSegment = selectedSketchSegmentIndex === segmentIndex;
        const isHoveredSketchSegment = hoveredSketchSegmentIndex === segmentIndex || hoveredSegmentIndex === segmentIndex;
        ctx2d.lineWidth = 6 / scale;
        ctx2d.lineCap = 'round';
        ctx2d.lineJoin = 'round';
        if(s.type === 'wall') ctx2d.strokeStyle = archColors.wall;
        else if(s.type === 'post') ctx2d.strokeStyle = '#d7a46f';
        else if(s.type === 'window') ctx2d.strokeStyle = '#4488ff';
        else if(s.type === 'glass') ctx2d.strokeStyle = '#88ccff';
        else if(s.type === 'rail') ctx2d.strokeStyle = archColors.rail;
        else if(s.type === 'bare-edge') ctx2d.strokeStyle = '#999999';
        else if(s.type === 'door') ctx2d.strokeStyle = '#c8a870';
        ctx2d.beginPath(); ctx2d.moveTo(s.p1.x, s.p1.y); ctx2d.lineTo(s.p2.x, s.p2.y); ctx2d.stroke();
        if(s.type === 'door') {
            const ddx = s.p2.x - s.p1.x;
            const ddy = s.p2.y - s.p1.y;
            const doorLen = Math.sqrt(ddx * ddx + ddy * ddy);
            if(doorLen > 0) {
                const baseAngle = Math.atan2(ddy, ddx);
                const ajar = 15 * Math.PI / 180;
                const swingSign = (s.swing === 'right') ? 1 : -1;
                const panelAngle = baseAngle + swingSign * ajar;
                ctx2d.save();
                ctx2d.strokeStyle = '#c8a870';
                ctx2d.lineWidth = 1.5 / scale;
                ctx2d.setLineDash([4 / scale, 3 / scale]);
                ctx2d.beginPath();
                if(swingSign < 0) {
                    ctx2d.arc(s.p1.x, s.p1.y, doorLen, panelAngle, baseAngle, false);
                } else {
                    ctx2d.arc(s.p1.x, s.p1.y, doorLen, baseAngle, panelAngle, false);
                }
                ctx2d.stroke();
                ctx2d.setLineDash([]);
                ctx2d.lineWidth = 3 / scale;
                const panelEndX = s.p1.x + Math.cos(panelAngle) * doorLen;
                const panelEndY = s.p1.y + Math.sin(panelAngle) * doorLen;
                ctx2d.beginPath();
                ctx2d.moveTo(s.p1.x, s.p1.y);
                ctx2d.lineTo(panelEndX, panelEndY);
                ctx2d.stroke();
                ctx2d.restore();
            }
        }
        if(isSelectedSketchSegment || isHoveredSketchSegment) {
            ctx2d.save();
            ctx2d.strokeStyle = isSelectedSketchSegment ? 'rgba(255, 210, 98, 0.98)' : 'rgba(110, 235, 255, 0.82)';
            ctx2d.lineWidth = (isSelectedSketchSegment ? 10 : 8) / scale;
            ctx2d.setLineDash(isSelectedSketchSegment ? [12 / scale, 7 / scale] : [8 / scale, 6 / scale]);
            ctx2d.beginPath();
            ctx2d.moveTo(s.p1.x, s.p1.y);
            ctx2d.lineTo(s.p2.x, s.p2.y);
            ctx2d.stroke();
            ctx2d.restore();
        }
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const totalLen = Math.sqrt(dx*dx + dy*dy);
        
        // Afficher la mesure au centre du segment avec encadré arrondi
        const distCm = Math.round(totalLen * 0.5);
        const centerX = (s.p1.x + s.p2.x) / 2;
        const centerY = (s.p1.y + s.p2.y) / 2;
        ctx2d.font = `bold ${13 / scale}px Arial`;
        ctx2d.textAlign = "center";
        ctx2d.textBaseline = "middle";
        
        // Mesurer la largeur du texte
        const text = (s.type === 'post' ? '' : 'int. ') + distCm + " cm";
        const metrics = ctx2d.measureText(text);
        const textWidth = metrics.width;
        const textHeight = 13 / scale;
        const padding = 3 / scale;
        
        // Dessiner l'encadré arrondi de fond noir
        const x = centerX - textWidth/2 - padding;
        const y = centerY - textHeight/2 - padding;
        const w = textWidth + padding*2;
        const h = textHeight + padding*2;
        const radius = 2.5 / scale;
        
        // Vérifier si cette mesure est survolée
        const isHovered = segmentIndex === hoveredSegmentIndex;
        
        ctx2d.fillStyle = lightCanvas
            ? (isHovered ? "rgba(255, 214, 128, 0.98)" : "rgba(255, 255, 255, 0.92)")
            : (isHovered ? "rgba(184, 155, 114, 0.95)" : "rgba(0, 0, 0, 0.85)");
        
        // Rectangle avec coins arrondis
        ctx2d.beginPath();
        ctx2d.moveTo(x + radius, y);
        ctx2d.lineTo(x + w - radius, y);
        ctx2d.arcTo(x + w, y, x + w, y + radius, radius);
        ctx2d.lineTo(x + w, y + h - radius);
        ctx2d.arcTo(x + w, y + h, x + w - radius, y + h, radius);
        ctx2d.lineTo(x + radius, y + h);
        ctx2d.arcTo(x, y + h, x, y + h - radius, radius);
        ctx2d.lineTo(x, y + radius);
        ctx2d.arcTo(x, y, x + radius, y, radius);
        ctx2d.closePath();
        ctx2d.fill();
        
        // Afficher le texte blanc
        ctx2d.fillStyle = lightCanvas ? "#111111" : (isHovered ? "#000" : canvasLabelColor);
        ctx2d.fillText(text, centerX, centerY);
        
        // Enregistrer la zone cliquable en coordonnées monde
        measureAreas.push({ x: x, y: y, w: w, h: h, segmentIndex: segmentIndex });
    });

    // --- POINTS DU TRACE DEPLACABLES ---
    if(segments.length > 0) {
        ctx2d.save();
        getSketchVertexEntries().forEach(vertex => {
            const vertexKey = getSketchPointKey(vertex);
            const isHovered = hoveredSketchVertex && Math.hypot(hoveredSketchVertex.x - vertex.x, hoveredSketchVertex.y - vertex.y) < 0.1;
            const isDragged = draggingSketchVertex && Math.hypot(draggingSketchVertex.x - vertex.x, draggingSketchVertex.y - vertex.y) < GRID_SIZE * 0.75;
            const isSelected = selectedSketchVertexKey === vertexKey;
            const isArrangementCandidate = cornerArrangementMode && !!getCornerArrangementContext(vertex);
            const r = (isHovered || isDragged || isSelected ? 8 : 6) / scale;
            ctx2d.fillStyle = isDragged || isSelected ? '#ffd278' : (isArrangementCandidate ? '#d7f1dc' : '#ffffff');
            ctx2d.strokeStyle = isSelected ? '#ffcf5a' : (isArrangementCandidate ? '#5bb878' : (isHovered || isDragged ? '#b89b72' : 'rgba(20,20,20,0.9)'));
            ctx2d.lineWidth = 2 / scale;
            ctx2d.beginPath();
            ctx2d.arc(vertex.x, vertex.y, r, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.stroke();
            ctx2d.beginPath();
            ctx2d.arc(vertex.x, vertex.y, (r + (isArrangementCandidate ? 13 : 8) / scale), 0, Math.PI * 2);
            ctx2d.strokeStyle = isArrangementCandidate ? 'rgba(91,184,120,0.38)' : 'rgba(184,155,114,0.28)';
            ctx2d.stroke();
        });
        ctx2d.restore();
    }

    // --- CONTRAINTES TECHNIQUES (évacuation / prise / eau) ---
	    constraints.forEach(c => {
	        const r = 9 / scale;
	        if(c.type === 'drain') {
            ctx2d.strokeStyle = '#66c6ff';
            ctx2d.lineWidth = 2 / scale;
            ctx2d.beginPath();
            ctx2d.arc(c.x, c.y, r, 0, Math.PI * 2);
            ctx2d.stroke();
            ctx2d.beginPath();
            ctx2d.moveTo(c.x - r * 0.6, c.y - r * 0.6);
            ctx2d.lineTo(c.x + r * 0.6, c.y + r * 0.6);
            ctx2d.moveTo(c.x + r * 0.6, c.y - r * 0.6);
            ctx2d.lineTo(c.x - r * 0.6, c.y + r * 0.6);
            ctx2d.stroke();
        } else if(c.type === 'power') {
            ctx2d.strokeStyle = '#f5f5f5';
            ctx2d.lineWidth = 2 / scale;
            ctx2d.beginPath();
            ctx2d.rect(c.x - r, c.y - r, r * 2, r * 2);
            ctx2d.stroke();
            ctx2d.beginPath();
            ctx2d.moveTo(c.x + r * 0.2, c.y - r * 0.75);
            ctx2d.lineTo(c.x - r * 0.15, c.y - r * 0.1);
            ctx2d.lineTo(c.x + r * 0.2, c.y - r * 0.1);
            ctx2d.lineTo(c.x - r * 0.2, c.y + r * 0.75);
            ctx2d.lineTo(c.x + r * 0.15, c.y + r * 0.1);
            ctx2d.lineTo(c.x - r * 0.2, c.y + r * 0.1);
            ctx2d.stroke();
        } else if(c.type === 'water') {
            ctx2d.fillStyle = '#67e3d6';
            ctx2d.beginPath();
            ctx2d.moveTo(c.x, c.y - r);
            ctx2d.bezierCurveTo(c.x + r, c.y - r * 0.2, c.x + r * 0.8, c.y + r, c.x, c.y + r);
            ctx2d.bezierCurveTo(c.x - r * 0.8, c.y + r, c.x - r, c.y - r * 0.2, c.x, c.y - r);
            ctx2d.fill();
	        }
	    });

	    if(isDrawingToolActive && currentPoint && !isConstraintTool(drawingMode)) {
	        let pointColor = archColors.wall;
	        if(drawingMode === 'post') pointColor = '#d7a46f';
	        else if(drawingMode === 'window') pointColor = '#4488ff';
	        else if(drawingMode === 'glass') pointColor = '#88ccff';
	        else if(drawingMode === 'rail') pointColor = archColors.rail;
	        else if(drawingMode === 'bare-edge') pointColor = '#999999';
	        else if(drawingMode === 'door') pointColor = '#c8a870';
	        else if(drawingMode === 'surface') {
	            const material = surfaceMaterials[surfaceMaterial] || surfaceMaterials.herbe;
	            pointColor = material.line;
	        } else if(drawingMode === 'ceiling-shape') {
	            pointColor = archColors.ceiling || '#d8d2c4';
	        }
	        ctx2d.save();
	        ctx2d.fillStyle = pointColor;
	        ctx2d.strokeStyle = 'rgba(0,0,0,0.55)';
	        ctx2d.lineWidth = 1.5 / scale;
	        ctx2d.beginPath();
	        ctx2d.arc(currentPoint.x, currentPoint.y, 5 / scale, 0, Math.PI * 2);
	        ctx2d.fill();
	        ctx2d.stroke();
	        ctx2d.restore();
	    }

	    // --- PASTILLE & FANTOME ---
	    if(isDrawingToolActive && mousePos2d) {
	        ctx2d.fillStyle = "rgba(184, 155, 114, 0.8)";
        ctx2d.beginPath();
        ctx2d.arc(mousePos2d.x, mousePos2d.y, 6 / scale, 0, Math.PI * 2);
        ctx2d.fill();
    }

    if(isDrawingToolActive && currentPoint && mousePos2d) {
        ctx2d.strokeStyle = lightCanvas ? 'rgba(30,30,30,0.42)' : 'rgba(255,255,255,0.4)';
        ctx2d.lineWidth = 3 / scale;
        ctx2d.setLineDash([10/scale, 5/scale]);
        ctx2d.beginPath(); ctx2d.moveTo(currentPoint.x, currentPoint.y); ctx2d.lineTo(mousePos2d.x, mousePos2d.y); ctx2d.stroke();
        ctx2d.setLineDash([]);

        const distCm = Math.round(Math.sqrt(Math.pow(mousePos2d.x-currentPoint.x, 2) + Math.pow(mousePos2d.y-currentPoint.y, 2)) * 0.5);
        ctx2d.font = `bold ${13 / scale}px Arial`;
        ctx2d.fillStyle = canvasLabelColor;
        const liveMeasurePrefix = drawingMode === 'post' ? '' : 'int. ';
        ctx2d.fillText(liveMeasurePrefix + distCm + " cm", (currentPoint.x + mousePos2d.x)/2 + 10/scale, (currentPoint.y + mousePos2d.y)/2 - 10/scale);
    }

    // --- REMPLISSAGE DU SOL FERMÉ ---
    if(isContourClosed && primaryContourSegments.length > 0) {
        // Construire le chemin du contour
        ctx2d.beginPath();
        ctx2d.moveTo(primaryContourSegments[0].p1.x, primaryContourSegments[0].p1.y);
        primaryContourSegments.forEach(s => {
            ctx2d.lineTo(s.p2.x, s.p2.y);
        });
        ctx2d.closePath();
        
        // Remplissage semi-transparent
        ctx2d.fillStyle = 'rgba(184, 155, 114, 0.08)';
        ctx2d.fill();
    }

    // --- JARDINIÈRES ---
    jardinières.forEach(j => {
        const x = j.pos.x * 20;
        const y = j.pos.z * 20;
        const w = j.w * 20;
        const d = j.d * 20;
        const rot = j.rot;
        const isBeingDragged = draggedJardiniere === j;
        const isSelected = selected2dJardiniere === j;
        const hasPlacementCollision = hasPlacementWarningCollision(j);
        const hasConstraintCollision = hasJardCollision(j);
        const hasCollision = hasPlacementCollision || hasConstraintCollision;

        ctx2d.save();
        ctx2d.translate(x, y);
        ctx2d.rotate(-rot);
        
        // Remplissage
        ctx2d.fillStyle = hasCollision
            ? (isBeingDragged ? 'rgba(220, 80, 80, 0.36)' : 'rgba(220, 80, 80, 0.18)')
            : (isBeingDragged ? 'rgba(184, 155, 114, 0.35)' : 'rgba(184, 155, 114, 0.15)');
        ctx2d.fillRect(-w/2, -d/2, w, d);
        
        // Contour principal
        ctx2d.strokeStyle = hasCollision
            ? 'rgba(230, 70, 70, 1)'
            : (isSelected || isBeingDragged ? 'rgba(184, 155, 114, 1)' : 'rgba(184, 155, 114, 0.65)');
        ctx2d.lineWidth = (hasCollision || isSelected || isBeingDragged ? 3 : 1.5) / scale;
        if(isSelected) { ctx2d.setLineDash([8/scale, 3/scale]); }
        ctx2d.strokeRect(-w/2, -d/2, w, d);
        ctx2d.setLineDash([]);
        
        // Indicateur AVANT : triangle pointant vers l'extérieur depuis la face avant (+d/2)
        const triSize = Math.min(w, d) * 0.22;
        ctx2d.fillStyle = 'rgba(184, 155, 114, 0.85)';
        ctx2d.beginPath();
        ctx2d.moveTo(-triSize * 0.6, d/2);
        ctx2d.lineTo(triSize * 0.6, d/2);
        ctx2d.lineTo(0, d/2 + triSize);
        ctx2d.closePath();
        ctx2d.fill();
        
        // Indicateurs treillis sur les côtés actifs
        const treillisMat = 'rgba(255, 200, 100, 0.8)';
        ctx2d.strokeStyle = treillisMat;
        ctx2d.lineWidth = 2.5 / scale;
        const dashStep = 8 / scale;
        ctx2d.setLineDash([dashStep * 0.5, dashStep * 0.5]);
        
        // Treillis arrière (face -d/2 = haut du rect local = "arrière" en 3D)
        if(j.treillisBack !== false && (j.treillisBack || j.hasTreillis)) {
            ctx2d.beginPath(); ctx2d.moveTo(-w/2, -d/2); ctx2d.lineTo(w/2, -d/2); ctx2d.stroke();
        }
        // Treillis gauche (face -w/2)
        if(j.treillisLeft) {
            ctx2d.beginPath(); ctx2d.moveTo(-w/2, -d/2); ctx2d.lineTo(-w/2, d/2); ctx2d.stroke();
        }
        // Treillis droite (face +w/2)
        if(j.treillisRight) {
            ctx2d.beginPath(); ctx2d.moveTo(w/2, -d/2); ctx2d.lineTo(w/2, d/2); ctx2d.stroke();
        }
        ctx2d.setLineDash([]);
        
        // Label
        const jardIdx = jardinières.findIndex(jj => jj === j) + 1;
        ctx2d.font = `bold ${12 / scale}px Arial`;
        ctx2d.fillStyle = isSelected ? canvasLabelColor : canvasLabelMutedColor;
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText('Jard. ' + jardIdx, 0, -d/2 + (14 / scale));

        ctx2d.restore();

        // Contrôles de manipulation positionnés en coords monde mais orientés comme la jardinière
        if (isSelected) {
            // --- Poignées de resize (style éditeur d'image) ---
            const handles = getJardResizeHandlesWorld(j);
            const handleR = 12 / scale;
            const drawResizeHandle = (hx, hy, axis, active) => {
                ctx2d.save();
                ctx2d.translate(hx, hy);
            ctx2d.rotate(-j.rot);
                ctx2d.fillStyle = active ? 'rgba(24, 24, 24, 0.82)' : 'rgba(24, 24, 24, 0.68)';
                ctx2d.beginPath();
                ctx2d.arc(0, 0, handleR, 0, Math.PI * 2);
                ctx2d.fill();
                ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.98)';
                ctx2d.lineWidth = 1.4 / scale;
                ctx2d.beginPath();
                ctx2d.arc(0, 0, handleR, 0, Math.PI * 2);
                ctx2d.stroke();

                const shaft = 6.4 / scale;
                const arrow = 4.8 / scale;
                ctx2d.strokeStyle = 'rgba(255, 255, 255, 1)';
                ctx2d.fillStyle = 'rgba(255, 255, 255, 1)';
                ctx2d.lineWidth = 2 / scale;
                const drawTriangle = (x1, y1, x2, y2, x3, y3) => {
                    ctx2d.beginPath();
                    ctx2d.moveTo(x1, y1);
                    ctx2d.lineTo(x2, y2);
                    ctx2d.lineTo(x3, y3);
                    ctx2d.closePath();
                    ctx2d.fill();
                };
                ctx2d.beginPath();
                if(axis === 'w') {
                    ctx2d.moveTo(-shaft, 0);
                    ctx2d.lineTo(shaft, 0);
                } else {
                    ctx2d.moveTo(0, -shaft);
                    ctx2d.lineTo(0, shaft);
                }
                ctx2d.stroke();

                if(axis === 'w') {
                    drawTriangle(-shaft - arrow, 0, -shaft + 0.2 / scale, -arrow * 0.7, -shaft + 0.2 / scale, arrow * 0.7);
                    drawTriangle(shaft + arrow, 0, shaft - 0.2 / scale, -arrow * 0.7, shaft - 0.2 / scale, arrow * 0.7);
                } else {
                    drawTriangle(0, -shaft - arrow, -arrow * 0.7, -shaft + 0.2 / scale, arrow * 0.7, -shaft + 0.2 / scale);
                    drawTriangle(0, shaft + arrow, -arrow * 0.7, shaft - 0.2 / scale, arrow * 0.7, shaft - 0.2 / scale);
                }
                ctx2d.restore();
            };
            drawResizeHandle(handles.w.x, handles.w.y, 'w', resizingJardiniere === j && resizeMode === 'w');
            drawResizeHandle(handles.wLeft.x, handles.wLeft.y, 'w', resizingJardiniere === j && resizeMode === 'w-left');
            drawResizeHandle(handles.d.x, handles.d.y, 'd', resizingJardiniere === j && resizeMode === 'd');

            // --- Poignée de rotation (style éditeur d'image) ---
            const topCenter = getJardWorldFromLocalCentered(j, 0, -j.d * 10);
            const rotHandle = getJardRotationHandleWorld(j);
            ctx2d.save();
            ctx2d.strokeStyle = 'rgba(18, 18, 18, 0.82)';
            ctx2d.lineWidth = 4.2 / scale;
            ctx2d.beginPath();
            ctx2d.moveTo(topCenter.x, topCenter.y);
            ctx2d.lineTo(rotHandle.x, rotHandle.y);
            ctx2d.stroke();
            ctx2d.strokeStyle = 'rgba(245, 245, 245, 0.98)';
            ctx2d.lineWidth = 1.8 / scale;
            ctx2d.beginPath();
            ctx2d.moveTo(topCenter.x, topCenter.y);
            ctx2d.lineTo(rotHandle.x, rotHandle.y);
            ctx2d.stroke();
            ctx2d.restore();

            ctx2d.save();
            ctx2d.translate(rotHandle.x, rotHandle.y);
            ctx2d.rotate(-j.rot);
            const hitR = 13 / scale;
            const arcR = 7.6 / scale;
            const arrowSize = 6.8 / scale;
            ctx2d.fillStyle = 'rgba(24, 24, 24, 0.68)';
            ctx2d.beginPath();
            ctx2d.arc(0, 0, hitR, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.98)';
            ctx2d.lineWidth = 1.4 / scale;
            ctx2d.setLineDash([]);
            ctx2d.beginPath();
            ctx2d.arc(0, 0, hitR, 0, Math.PI * 2);
            ctx2d.stroke();
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.lineWidth = 2.4 / scale;
            const arcStart = -Math.PI * 0.95;
            const arcEnd = Math.PI * 0.62;
            ctx2d.beginPath();
            ctx2d.arc(0, 0, arcR, arcStart, arcEnd);
            ctx2d.stroke();
            const ax2 = arcR * Math.cos(arcEnd);
            const ay2 = arcR * Math.sin(arcEnd);
            const tangentDir = arcEnd + Math.PI / 2;
            ctx2d.fillStyle = 'rgba(255, 255, 255, 1)';
            ctx2d.beginPath();
            ctx2d.moveTo(ax2, ay2);
            ctx2d.lineTo(ax2 - arrowSize * Math.cos(tangentDir - 0.45), ay2 - arrowSize * Math.sin(tangentDir - 0.45));
            ctx2d.lineTo(ax2 - arrowSize * Math.cos(tangentDir + 0.45), ay2 - arrowSize * Math.sin(tangentDir + 0.45));
            ctx2d.closePath();
            ctx2d.fill();
            ctx2d.restore();

        }
    });

    bancs.forEach((bench, idx) => {
        const x = bench.pos.x * 20;
        const y = bench.pos.z * 20;
        const w = bench.w * 20;
        const d = bench.d * 20;
        const isSelected = selected2dBench === bench;
        const hasCollision = hasPlacementWarningCollision(bench);
        ctx2d.save();
        ctx2d.translate(x, y);
        ctx2d.rotate(-(bench.rot || 0));
        ctx2d.fillStyle = hasCollision
            ? (isSelected ? 'rgba(220, 80, 80, 0.38)' : 'rgba(220, 80, 80, 0.22)')
            : (isSelected ? 'rgba(120, 165, 145, 0.34)' : 'rgba(120, 165, 145, 0.18)');
        ctx2d.strokeStyle = hasCollision
            ? 'rgba(235, 70, 70, 0.98)'
            : (isSelected ? 'rgba(154, 218, 188, 1)' : 'rgba(154, 218, 188, 0.68)');
        ctx2d.lineWidth = (hasCollision || isSelected ? 3 : 1.5) / scale;
        if(isSelected) ctx2d.setLineDash([8 / scale, 3 / scale]);
        ctx2d.fillRect(-w / 2, -d / 2, w, d);
        ctx2d.strokeRect(-w / 2, -d / 2, w, d);
        ctx2d.setLineDash([]);
        ctx2d.font = `bold ${12 / scale}px Arial`;
        ctx2d.fillStyle = isSelected ? canvasLabelColor : canvasLabelMutedColor;
        ctx2d.textAlign = 'center';
        ctx2d.textBaseline = 'middle';
        ctx2d.fillText('Banc ' + (idx + 1), 0, 0);
        ctx2d.restore();

        if(isSelected) {
            const handles = getJardResizeHandlesWorld(bench);
            drawPlacementResizeHandle(handles.w, bench, 'w', resizingBench === bench && resizeMode === 'w');
            drawPlacementResizeHandle(handles.wLeft, bench, 'w', resizingBench === bench && resizeMode === 'w-left');
            drawPlacementResizeHandle(handles.d, bench, 'd', resizingBench === bench && resizeMode === 'd');
            drawPlacementRotationHandle(bench, rotatingBench === bench);
        }
    });

    getConstructionItems()
        .filter(entry => entry.type !== 'jardiniere' && entry.type !== 'banc')
        .forEach((entry, idx) => {
            const obj = entry.item;
            if(!obj || !obj.pos || typeof obj.w !== 'number' || typeof obj.d !== 'number') return;
            const def = getConstructionType(entry.type);
            const x = obj.pos.x * 20;
            const y = obj.pos.z * 20;
            const w = obj.w * 20;
            const d = obj.d * 20;
            const isSelected = getSelectedPlacementObject() === obj;
            const hasCollision = hasPlacementWarningCollision(obj);
            const label = (def && def.label ? def.label : entry.type) + ' ' + (idx + 1);
            ctx2d.save();
            ctx2d.translate(x, y);
            ctx2d.rotate(-(obj.rot || 0));
            const isPottedTree = entry.type === 'pottedTree';
            const isMeridienne = entry.type === 'cube';
            const isWoodFurniture = entry.type === 'table' || entry.type === 'chair';
            const isRailMounted = entry.type === 'hangingPlanter' || entry.type === 'railShelf';
            const isCornerFill = entry.type === 'cornerFill';
            const isCompressionShelf = entry.type === 'compressionShelf';
            ctx2d.fillStyle = hasCollision
                ? (isSelected ? 'rgba(220, 80, 80, 0.40)' : 'rgba(220, 80, 80, 0.22)')
                : (isPottedTree
                    ? (isSelected ? 'rgba(178, 124, 72, 0.38)' : 'rgba(178, 124, 72, 0.24)')
                    : (isRailMounted ? (isSelected ? 'rgba(190, 124, 52, 0.38)' : 'rgba(190, 124, 52, 0.20)') : (isCompressionShelf ? (isSelected ? 'rgba(122, 82, 54, 0.36)' : 'rgba(122, 82, 54, 0.18)') : (isCornerFill ? (isSelected ? 'rgba(176, 137, 88, 0.38)' : 'rgba(176, 137, 88, 0.20)') : (isMeridienne ? (isSelected ? 'rgba(185, 121, 63, 0.34)' : 'rgba(185, 121, 63, 0.18)') : (isWoodFurniture ? (isSelected ? 'rgba(156, 111, 76, 0.34)' : 'rgba(156, 111, 76, 0.2)') : (isSelected ? 'rgba(104, 140, 190, 0.32)' : 'rgba(104, 140, 190, 0.16)')))))));
            ctx2d.strokeStyle = hasCollision
                ? 'rgba(235, 70, 70, 0.98)'
                : (isPottedTree
                    ? (isSelected ? 'rgba(239, 186, 122, 1)' : 'rgba(239, 186, 122, 0.72)')
                    : (isRailMounted ? (isSelected ? 'rgba(242, 190, 122, 1)' : 'rgba(242, 190, 122, 0.70)') : (isCompressionShelf ? (isSelected ? 'rgba(232, 181, 118, 1)' : 'rgba(232, 181, 118, 0.68)') : (isCornerFill ? (isSelected ? 'rgba(236, 195, 124, 1)' : 'rgba(236, 195, 124, 0.70)') : (isMeridienne ? (isSelected ? 'rgba(230, 172, 103, 0.98)' : 'rgba(230, 172, 103, 0.68)') : (isWoodFurniture ? (isSelected ? 'rgba(230, 184, 136, 0.98)' : 'rgba(230, 184, 136, 0.68)') : (isSelected ? 'rgba(184, 214, 255, 0.95)' : 'rgba(184, 214, 255, 0.62)')))))));
            ctx2d.lineWidth = (hasCollision || isSelected ? 3 : 1.5) / scale;
            if(isSelected) ctx2d.setLineDash([8 / scale, 3 / scale]);
            if(isPottedTree && obj.shape !== 'square') {
                ctx2d.beginPath();
                ctx2d.arc(0, 0, Math.max(w, d) / 2, 0, Math.PI * 2);
                ctx2d.fill();
                ctx2d.stroke();
                ctx2d.setLineDash([]);
                ctx2d.fillStyle = 'rgba(98, 134, 72, 0.5)';
                ctx2d.beginPath();
                ctx2d.arc(0, 0, Math.max(w, d) * 0.24, 0, Math.PI * 2);
                ctx2d.fill();
            } else {
                if(isCornerFill && typeof getCornerFillLocalPoints === 'function') {
                    const points = getCornerFillLocalPoints(obj).map(p => ({ x: p.x * 20, y: p.z * 20 }));
                    ctx2d.beginPath();
                    points.forEach((p, pointIndex) => {
                        if(pointIndex === 0) ctx2d.moveTo(p.x, p.y);
                        else ctx2d.lineTo(p.x, p.y);
                    });
                    ctx2d.closePath();
                    ctx2d.fill();
                    ctx2d.stroke();
                } else {
                    ctx2d.fillRect(-w / 2, -d / 2, w, d);
                    ctx2d.strokeRect(-w / 2, -d / 2, w, d);
                }
                if(isPottedTree) {
                    ctx2d.setLineDash([]);
                    ctx2d.fillStyle = 'rgba(98, 134, 72, 0.5)';
                    ctx2d.beginPath();
                    ctx2d.arc(0, 0, Math.max(w, d) * 0.22, 0, Math.PI * 2);
                    ctx2d.fill();
                } else if(isMeridienne) {
                    ctx2d.setLineDash([]);
                    ctx2d.strokeStyle = 'rgba(80, 48, 24, 0.38)';
                    ctx2d.lineWidth = 1 / scale;
                    const slatCount2d = Math.max(6, Math.min(16, Math.round(obj.w / 1.3)));
                    for(let i = 1; i < slatCount2d; i++) {
                        const xLine = -w / 2 + (w / slatCount2d) * i;
                        ctx2d.beginPath();
                        ctx2d.moveTo(xLine, -d / 2 + 5 / scale);
                        ctx2d.lineTo(xLine, d / 2 - 5 / scale);
                        ctx2d.stroke();
                    }
                    ctx2d.fillStyle = 'rgba(90, 58, 35, 0.26)';
                    ctx2d.fillRect(-w / 2, -d / 2, w, Math.min(d * 0.18, 18 / scale));
                } else if(isWoodFurniture) {
                    ctx2d.setLineDash([]);
                    ctx2d.strokeStyle = 'rgba(78, 48, 29, 0.45)';
                    ctx2d.lineWidth = 1 / scale;
                    const lineCount = entry.type === 'chair' ? 3 : 4;
                    for(let i = 1; i < lineCount; i++) {
                        const yLine = -d / 2 + (d / lineCount) * i;
                        ctx2d.beginPath();
                        ctx2d.moveTo(-w / 2 + 5 / scale, yLine);
                        ctx2d.lineTo(w / 2 - 5 / scale, yLine);
                        ctx2d.stroke();
                    }
                    if(entry.type === 'chair') {
                        ctx2d.fillStyle = 'rgba(78, 48, 29, 0.34)';
                        ctx2d.fillRect(-w / 2, -d / 2, w, Math.min(d * 0.22, 12 / scale));
                    }
                } else if(isRailMounted) {
                    ctx2d.setLineDash([]);
                    ctx2d.strokeStyle = 'rgba(74, 45, 24, 0.48)';
                    ctx2d.lineWidth = 1 / scale;
                    const stripeCount = entry.type === 'railShelf' ? Math.max(3, Math.min(7, Math.round(obj.d / 0.9))) : Math.max(2, Math.min(5, Math.round(obj.h / 0.9)));
                    for(let i = 1; i < stripeCount; i++) {
                        const yLine = -d / 2 + (d / stripeCount) * i;
                        ctx2d.beginPath();
                        ctx2d.moveTo(-w / 2 + 5 / scale, yLine);
                        ctx2d.lineTo(w / 2 - 5 / scale, yLine);
                        ctx2d.stroke();
                    }
                    ctx2d.fillStyle = 'rgba(28, 28, 28, 0.38)';
                    const hookW = Math.min(w * 0.14, 12 / scale);
                    ctx2d.fillRect(-w * 0.32 - hookW / 2, -d / 2 - 8 / scale, hookW, 8 / scale);
                    ctx2d.fillRect(w * 0.32 - hookW / 2, -d / 2 - 8 / scale, hookW, 8 / scale);
                } else if(isCornerFill) {
                    ctx2d.setLineDash([]);
                    ctx2d.strokeStyle = 'rgba(82, 53, 31, 0.48)';
                    ctx2d.lineWidth = 1 / scale;
                    if(isLockedCornerArrangementObject(obj)) {
                        getCornerArrangementSlatPolygons2D(obj, { spacing: 30, slatWidth: 18, inset: 7 }).forEach(slat => {
                            if(!slat.points || slat.points.length < 3) return;
                            ctx2d.beginPath();
                            slat.points.forEach((p, pointIndex) => {
                                const xLocal = p.x - obj.pos.x * 20;
                                const yLocal = p.y - obj.pos.z * 20;
                                if(pointIndex === 0) ctx2d.moveTo(xLocal, yLocal);
                                else ctx2d.lineTo(xLocal, yLocal);
                            });
                            ctx2d.closePath();
                            ctx2d.fillStyle = 'rgba(82, 53, 31, 0.18)';
                            ctx2d.fill();
                            ctx2d.stroke();
                        });
                    } else {
                        const lineCount = Math.max(3, Math.min(8, Math.round(obj.d / 0.9)));
                        for(let i = 1; i < lineCount; i++) {
                            const yLine = -d / 2 + (d / lineCount) * i;
                            ctx2d.beginPath();
                            ctx2d.moveTo(-w / 2 + 5 / scale, yLine);
                            ctx2d.lineTo(w / 2 + getCornerFillSkew(obj) * 20 - 5 / scale, yLine);
                            ctx2d.stroke();
                        }
                    }
                } else if(isCompressionShelf) {
                    ctx2d.setLineDash([]);
                    ctx2d.strokeStyle = 'rgba(80, 48, 24, 0.55)';
                    ctx2d.lineWidth = 1 / scale;
                    const bayCount = Math.max(3, Math.min(8, Math.round(obj.w / 4.2)));
                    for(let i = 0; i <= bayCount; i++) {
                        const xLine = -w / 2 + (w / bayCount) * i;
                        ctx2d.beginPath();
                        ctx2d.moveTo(xLine, -d / 2);
                        ctx2d.lineTo(xLine, d / 2);
                        ctx2d.stroke();
                    }
	                    const shelfRows = Math.max(2, Math.min(4, Math.round((obj.shelfCount || 4))));
	                    const rightShortStart = Math.max(1, Math.min(bayCount - 1, Math.round(bayCount * 0.56)));
	                    const centerStart = bayCount >= 5 ? 1 : 0;
	                    const centerEnd = Math.max(centerStart + 1, bayCount - (bayCount >= 5 ? 1 : 0));
	                    const shelfSegments = ({
	                        2: [
	                            { yRatio: 0.34, startBay: 0, endBay: bayCount },
	                            { yRatio: 0.68, startBay: rightShortStart, endBay: bayCount }
	                        ],
	                        3: [
	                            { yRatio: 0.24, startBay: 0, endBay: Math.max(1, bayCount - 1) },
	                            { yRatio: 0.50, startBay: rightShortStart, endBay: bayCount },
	                            { yRatio: 0.75, startBay: 0, endBay: bayCount }
	                        ],
	                        4: [
	                            { yRatio: 0.20, startBay: 0, endBay: Math.max(1, bayCount - 1) },
	                            { yRatio: 0.41, startBay: rightShortStart, endBay: bayCount },
	                            { yRatio: 0.62, startBay: 0, endBay: bayCount },
	                            { yRatio: 0.80, startBay: centerStart, endBay: centerEnd }
	                        ]
	                    })[shelfRows];
	                    shelfSegments.forEach(segment => {
	                        const yLine = -d / 2 + d * segment.yRatio;
	                        const xStart = -w / 2 + (w / bayCount) * Math.max(0, Math.min(bayCount - 1, segment.startBay));
	                        const xEnd = -w / 2 + (w / bayCount) * Math.max(segment.startBay + 1, Math.min(bayCount, segment.endBay));
	                        ctx2d.beginPath();
	                        ctx2d.moveTo(xStart + 4 / scale, yLine);
	                        ctx2d.lineTo(xEnd - 4 / scale, yLine);
	                        ctx2d.stroke();
	                    });
	                }
            }
            ctx2d.setLineDash([]);
            ctx2d.font = `bold ${12 / scale}px Arial`;
            ctx2d.fillStyle = isSelected ? canvasLabelColor : canvasLabelMutedColor;
            ctx2d.textAlign = 'center';
            ctx2d.textBaseline = 'middle';
            ctx2d.fillText(label, 0, 0);
            ctx2d.restore();

            if(isSelected) {
                if(isLockedCornerArrangementObject(obj)) {
                    getCornerArrangementResizeHandles(obj).forEach(handle => {
                        drawCornerArrangementResizeHandle(handle, activeCornerArrangementResize && activeCornerArrangementResize.fill === obj && activeCornerArrangementResize.key === handle.key);
                    });
                } else {
                    const handles = getJardResizeHandlesWorld(obj);
                    drawPlacementResizeHandle(handles.w, obj, 'w', resizingPlacementObject === obj && resizeMode === 'w');
                    drawPlacementResizeHandle(handles.wLeft, obj, 'w', resizingPlacementObject === obj && resizeMode === 'w-left');
                    drawPlacementResizeHandle(handles.d, obj, 'd', resizingPlacementObject === obj && resizeMode === 'd');
                    if(!isRailMounted) drawPlacementRotationHandle(obj, rotatingPlacementObject === obj);
                }
            }
        });

    drawPlacementAlignmentGuides();
    drawDrawingSnapGuides();

    function drawGarlandCurve2D(from, to, options = {}) {
        const {
            color = 'rgba(255, 218, 142, 0.88)',
            width = 2.4,
            bulbs = true,
            dash = [8, 5],
            sag = 12
        } = options;
        ctx2d.strokeStyle = color;
        ctx2d.lineWidth = width / scale;
        if(dash) ctx2d.setLineDash(dash.map(value => value / scale));
        else ctx2d.setLineDash([]);
        ctx2d.beginPath();
        ctx2d.moveTo(from.x, from.y);
        const cx = (from.x + to.x) / 2;
        const cy = (from.y + to.y) / 2 + sag / scale;
        ctx2d.quadraticCurveTo(cx, cy, to.x, to.y);
        ctx2d.stroke();
        ctx2d.setLineDash([]);
        if(!bulbs) return;
        const bulbCount = Math.max(4, Math.min(10, Math.round(Math.hypot(to.x - from.x, to.y - from.y) / 45)));
        for(let i = 1; i < bulbCount; i++) {
            const t = i / bulbCount;
            const x = (1 - t) * (1 - t) * from.x + 2 * (1 - t) * t * cx + t * t * to.x;
            const y = (1 - t) * (1 - t) * from.y + 2 * (1 - t) * t * cy + t * t * to.y;
            ctx2d.fillStyle = '#fff1c9';
            ctx2d.beginPath();
            ctx2d.arc(x, y, 3.4 / scale, 0, Math.PI * 2);
            ctx2d.fill();
        }
    }

    // --- GUIRLANDES EN 2D ---
    ctx2d.save();
    jardinières.forEach(j => {
        const trellisAnchors = new Map(getGarlandLinkSnapPoints2D(j).map(point => [point.anchor.id, point]));
        if(hasTreillisWhiteGarland(j) || hasTreillisGinguette(j)) {
            const standardColor = hasTreillisGinguette(j) ? 'rgba(255, 194, 98, 0.9)' : 'rgba(255, 245, 220, 0.86)';
            [
                ['trellis:backLeft', 'trellis:backRight'],
                ['trellis:leftBack', 'trellis:leftFront'],
                ['trellis:rightBack', 'trellis:rightFront']
            ].forEach(pair => {
                const from = trellisAnchors.get(pair[0]);
                const to = trellisAnchors.get(pair[1]);
                if(from && to) drawGarlandCurve2D(from, to, { color: standardColor, width: 2, dash: [6, 4], sag: 7 });
            });
        }

        normalizeGarlandLinks(j.garlandLinks).forEach(link => {
            const from = getGarlandEndpoint2D(getGarlandLinkEndpoint(link, 'from', j));
            const to = getGarlandEndpoint2D(getGarlandLinkEndpoint(link, 'to', j));
            if(!from || !to) return;
            drawGarlandCurve2D(from, to);
        });
    });
    if(garlandToolMode === 'link' && pendingGarlandLinkFrom && mousePos2d) {
        const from = getGarlandEndpoint2D(getGarlandAnchorRef(pendingGarlandLinkFrom.j, pendingGarlandLinkFrom.anchorId));
        if(from) {
            ctx2d.strokeStyle = 'rgba(255, 210, 120, 0.92)';
            ctx2d.lineWidth = 2.8 / scale;
            ctx2d.setLineDash([10 / scale, 7 / scale]);
            ctx2d.beginPath();
            ctx2d.moveTo(from.x, from.y);
            ctx2d.lineTo(mousePos2d.x, mousePos2d.y);
            ctx2d.stroke();
            ctx2d.setLineDash([]);
        }
    }
    ctx2d.restore();

    if(garlandToolMode) {
        const points = garlandToolMode === 'post'
            ? getGarlandPostSnapPoints2D()
            : jardinières.flatMap(j => getGarlandLinkSnapPoints2D(j));
        ctx2d.save();
        points.forEach(point => {
            const isPending = pendingGarlandLinkFrom && point.anchor && pendingGarlandLinkFrom.anchorId === point.anchor.id && pendingGarlandLinkFrom.j === point.j;
            const isInvalidSame = isPending && garlandToolMode === 'link';
            ctx2d.fillStyle = isPending ? 'rgba(255, 210, 120, 0.95)' : 'rgba(255, 255, 255, 0.92)';
            ctx2d.strokeStyle = point.anchor && point.anchor.kind === 'trellis' ? 'rgba(255, 200, 100, 0.95)' : 'rgba(68, 210, 170, 0.95)';
            ctx2d.lineWidth = 2.4 / scale;
            ctx2d.beginPath();
            ctx2d.arc(point.x, point.y, 8 / scale, 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.stroke();
            ctx2d.beginPath();
            ctx2d.arc(point.x, point.y, 15 / scale, 0, Math.PI * 2);
            ctx2d.stroke();
            if(garlandToolMode === 'link') {
                ctx2d.font = `bold ${12 / scale}px Arial`;
                ctx2d.textAlign = 'center';
                ctx2d.textBaseline = 'middle';
                ctx2d.fillStyle = isInvalidSame ? '#3b2b20' : '#111111';
                ctx2d.fillText(isPending ? '1' : '2', point.x, point.y);
            }
        });
        ctx2d.restore();
    }

    if(typeof renderMagicDust2DOverlay === 'function') renderMagicDust2DOverlay();

    ctx2d.restore(); 
    
    // Si on est en mode édition, afficher un input
    if(editingSegmentIndex >= 0 && editingSegmentIndex < segments.length) {
        const s = segments[editingSegmentIndex];
        const dx = s.p2.x - s.p1.x;
        const dy = s.p2.y - s.p1.y;
        const distCm = Math.round(Math.sqrt(dx*dx + dy*dy) * 0.5);
        const centerX = (s.p1.x + s.p2.x) / 2;
        const centerY = (s.p1.y + s.p2.y) / 2;
        const screenPos = worldToClient2D(centerX, centerY);
        
        // Créer ou mettre à jour l'input
        let input = document.getElementById('measure-edit-input');
        if(!input) {
            input = document.createElement('input');
            input.id = 'measure-edit-input';
            input.type = 'number';
            input.inputMode = 'decimal';
            input.pattern = '[0-9]*[.,]?[0-9]*';
            input.autocomplete = 'off';
            input.enterKeyHint = 'done';
            input.style.position = 'fixed';
            input.style.zIndex = 2500;
            input.style.fontSize = '14px';
            input.style.padding = '4px 8px';
            input.style.border = '2px solid #b89b72';
            input.style.borderRadius = '4px';
            input.style.background = '#000';
            input.style.color = '#fff';
            input.style.textAlign = 'center';
            input.addEventListener('keydown', (e) => {
                if(e.key === 'Enter') {
                    validEditMeasure();
                } else if(e.key === 'Escape') {
                    cancelEditMeasure();
                }
            });
            input.addEventListener('blur', validEditMeasure);
            document.body.appendChild(input);
        }
        
        input.value = distCm;
        input.style.width = '70px';
        const inputW = 70;
        const inputH = input.offsetHeight || 32;
        const margin = 8;
        const left = Math.min(window.innerWidth - inputW - margin, Math.max(margin, screenPos.x - inputW / 2));
        const top = Math.min(window.innerHeight - inputH - margin, Math.max(margin, screenPos.y - inputH / 2));
        input.style.left = left + 'px';
        input.style.top = top + 'px';
        input.focus();
        input.select();
    }
    updateJardFloatingOpenButton();
    if(typeof updateDoorSwingButton === 'function') updateDoorSwingButton();

}

function validEditMeasure() {
    const input = document.getElementById('measure-edit-input');
    if(!input) return;
    
    const newDist = parseFloat(String(input.value).replace(',', '.'));
    if(isNaN(newDist) || newDist <= 0) {
        cancelEditMeasure();
        return;
    }
    
    const segment = segments[editingSegmentIndex];
    const dx = segment.p2.x - segment.p1.x;
    const dy = segment.p2.y - segment.p1.y;
    const angle = Math.atan2(dy, dx);
    const distPixels = newDist / 0.5; // Conversion cm -> pixels
    
    saveState();
    const nextPoint = {
        x: segment.p1.x + Math.cos(angle) * distPixels,
        y: segment.p1.y + Math.sin(angle) * distPixels
    };
    const editedIndex = editingSegmentIndex;
    segment.p2.x = nextPoint.x;
    segment.p2.y = nextPoint.y;

    if(segments.length > 1) {
        const nextSegment = segments[editedIndex + 1];
        if(nextSegment && !!nextSegment.detached === !!segment.detached && (!segment.detached || nextSegment.sketchId === segment.sketchId)) {
            nextSegment.p1.x = nextPoint.x;
            nextSegment.p1.y = nextPoint.y;
        } else if(isContourClosed && !segment.detached) {
            const firstPrimarySegment = getPrimaryContourSegments()[0];
            if(firstPrimarySegment) {
                firstPrimarySegment.p1.x = nextPoint.x;
                firstPrimarySegment.p1.y = nextPoint.y;
            }
        }
    }

    checkIfContourClosed();
    
    editingSegmentIndex = -1;
    if(input.parentNode) input.parentNode.removeChild(input);
    hasUnsavedChanges = true;
    refreshArchitectureNow();
}

function cancelEditMeasure() {
    const input = document.getElementById('measure-edit-input');
    if(input && input.parentNode) input.parentNode.removeChild(input);
    editingSegmentIndex = -1;
    draw2D();
}

function flipDoorSwing() {
    if(selectedSketchSegmentIndex < 0 || selectedSketchSegmentIndex >= segments.length) return;
    const s = segments[selectedSketchSegmentIndex];
    if(s.type !== 'door') return;
    saveState();
    s.swing = (s.swing === 'right') ? 'left' : 'right';
    hasUnsavedChanges = true;
    refreshArchitectureNow();
}

function updateDoorSwingButton() {
    const existing = document.getElementById('door-swing-btn');
    const isDoorSelected = selectedSketchSegmentIndex >= 0
        && selectedSketchSegmentIndex < segments.length
        && segments[selectedSketchSegmentIndex]
        && segments[selectedSketchSegmentIndex].type === 'door';

    if(!isDoorSelected) {
        if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
        return;
    }

    const s = segments[selectedSketchSegmentIndex];
    const centerX = (s.p1.x + s.p2.x) / 2;
    const centerY = (s.p1.y + s.p2.y) / 2;
    const rect = canvas2d ? canvas2d.getBoundingClientRect() : null;
    if(!rect) return;
    const screenX = centerX * scale + offsetX + rect.left;
    const screenY = centerY * scale + offsetY + rect.top;

    let btn = existing;
    if(!btn) {
        btn = document.createElement('button');
        btn.id = 'door-swing-btn';
        btn.style.cssText = 'position:fixed;z-index:2500;padding:4px 10px;font-size:12px;background:#2d2420;color:#c8a870;border:1.5px solid #c8a870;border-radius:5px;cursor:pointer;pointer-events:auto;white-space:nowrap;';
        btn.addEventListener('click', (e) => { e.stopPropagation(); flipDoorSwing(); });
        document.body.appendChild(btn);
    }
    btn.textContent = s.swing === 'right' ? '⟵ Retourner sens' : 'Retourner sens ⟶';
    btn.style.left = (screenX - 60) + 'px';
    btn.style.top = (screenY - 36) + 'px';
}

	        function scheduleVisible2DRedraw(options = {}) {
	            const { recenter = false } = options;
	            requestAnimationFrame(() => {
	                updateRenderStageLayout();
	                if(recenter) {
	                    fit2DViewToScene();
	                }
	                draw2D();
	                if(canvas2d) canvas2d.focus();
	            });
	        }

	        function focus2DView() {
	            const modal = document.getElementById('modal-2d');
	            modal.style.display = 'flex';
	            updateRenderStageLayout();

            if(!recenter2DViewToContent()) {
                const { width: canvasWidth, height: canvasHeight } = getPane2DSize();
                scale = 0.24;
                offsetX = canvasWidth / 2;
                offsetY = canvasHeight / 2;
            }

	            canvas2d.focus();
	            switchEditor(currentEditorMode);
	            updateJardPanel();
            draw2D();
            scheduleVisible2DRedraw();
	        }

        function shouldCenter2DOnPlanterFallback() {
            return !(typeof getBalcony2DFramingBounds === 'function' && getBalcony2DFramingBounds());
        }

        function getFallback2DPlanterTarget() {
            if(!shouldCenter2DOnPlanterFallback()) return null;
            if(selected2dJardiniere && selected2dJardiniere.pos) return selected2dJardiniere;
            return jardinières.find(j => j && j.pos) || null;
        }

        function recenter2DViewToContent() {
            const fitted = fit2DViewToScene();
            const planter = getFallback2DPlanterTarget();
            if(planter) {
                center2DOnJardiniere(planter);
                return true;
            }
            return fitted;
        }

        function fit2DViewToScene() {
            const bounds = get2DFramingBounds();
            if(!bounds) return false;
            const { width: canvasWidth, height: canvasHeight } = getPane2DSize();
            if(canvasWidth <= 0 || canvasHeight <= 0) return false;
            const minX = bounds.minX - DEFAULT_VIEW_MARGIN_2D_PX;
            const maxX = bounds.maxX + DEFAULT_VIEW_MARGIN_2D_PX;
            const minZ = bounds.minZ - DEFAULT_VIEW_MARGIN_2D_PX;
            const maxZ = bounds.maxZ + DEFAULT_VIEW_MARGIN_2D_PX;
            const centerX = (minX + maxX) / 2;
            const centerZ = (minZ + maxZ) / 2;
            const width = Math.max(1, maxX - minX);
            const height = Math.max(1, maxZ - minZ);
            const zoomX = canvasWidth / width;
            const zoomY = canvasHeight / height;
            scale = Math.min(zoomX, zoomY);
            scale = Math.max(0.05, Math.min(scale, 3));
            offsetX = canvasWidth / 2 - centerX * scale;
            offsetY = canvasHeight / 2 - centerZ * scale;
            return true;
        }

        function center2DOnJardiniere(j, desiredScale = null) {
            if(!j) return;
            const pane2d = getPane2D();
            if(!pane2d) return;
            const canvasWidth = pane2d.clientWidth;
            const canvasHeight = pane2d.clientHeight;
            if(typeof desiredScale === 'number' && !Number.isNaN(desiredScale)) {
                scale = desiredScale;
            }
            // Miroir de applyBalconySceneCanvasTransform2D : position canvas réelle de la jardinière
            const lx = j.pos.x * 20;
            const ly = j.pos.z * 20;
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            const ox = Number.isFinite(balconyOffsetX) ? balconyOffsetX * 20 : 0;
            const oy = Number.isFinite(balconyOffsetZ) ? balconyOffsetZ * 20 : 0;
            const theta = ((Number.isFinite(balconyOrientationDeg) ? balconyOrientationDeg : 0)
                          - (Number.isFinite(balconyWorldOrientationDeg) ? balconyWorldOrientationDeg : 0)) * Math.PI / 180;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);
            const dx = lx - (pivot.x || 0);
            const dy = ly - (pivot.y || 0);
            const centerX = dx * cosT - dy * sinT + (pivot.x || 0) + ox;
            const centerZ = dx * sinT + dy * cosT + (pivot.y || 0) + oy;
            offsetX = canvasWidth / 2 - centerX * scale;
            offsetY = canvasHeight / 2 - centerZ * scale;
        }

        function validate2DFor3D() {
            if(canAutoFinalizeSketch()) {
                finalizeSketchClosure({ silent: true });
                return true;
            }
            if(doesSketchNeedClosure()) {
                showSketchClosureAlert("Contour encore ouvert: terminez-le avant de passer en vue 3D.");
                return false;
            }
            return true;
        }

        function setMainView(view, options = {}) {
            if((view === '3d' || view === 'mixte') && (!webglAvailable || !renderer || !controls)) {
                view = '2d';
            }
            if(view === '3d' && view !== activeMainView && canAutoFinalizeSketch()) {
                finalizeSketchClosure({ silent: true });
            }
            if(doesSketchNeedClosure() && view === '3d' && view !== activeMainView) {
                showSketchClosureAlert("Contour encore ouvert: terminez-le avant de passer en vue 3D.");
                return false;
            }
            const modal2d = document.getElementById('modal-2d');
            const devisRing = document.querySelector('.devis-ring');
            const btn2d = document.getElementById('btn-view-2d');
            const btn3d = document.getElementById('btn-view-3d');
            const btnMixte = document.getElementById('btn-view-mixte');
            const btnLight = document.getElementById('btn-light-panel');
            const splitter = document.getElementById('view-splitter');
            const lightTimeControl = document.getElementById('light-time-control');
            const shouldRecenter = options.recenter !== false;

            // Réinitialiser l'état commun
            [btn2d, btn3d, btnMixte].forEach(b => b && b.classList.remove('active'));
            modal2d.classList.remove('mode-3d-overlay');
            modal2d.classList.remove('mode-mixte');
            modal2d.style.right = '';
            modal2d.style.width = '';
            if(splitter) {
                splitter.style.display = 'none';
                splitter.classList.remove('dragging');
            }
            if(lightTimeControl) lightTimeControl.classList.toggle('visible', lightPanelOpen);
            if(btnLight) btnLight.classList.toggle('active', lightPanelOpen);

            if(view === '3d') {
                if(!options.skipValidation && !validate2DFor3D()) return false;
                activeMainView = '3d';
                // Afficher modal-2d en mode overlay transparent (panneaux visibles sur la 3D)
                modal2d.style.display = 'flex';
                modal2d.classList.add('mode-3d-overlay');
                if(renderer && renderer.domElement) renderer.domElement.style.display = 'block';
                if(controls) controls.enabled = true;
                build3DArch();
                if(devisRing) devisRing.style.display = 'none';
                btn3d.classList.add('active');
                syncSun2dControls();
	                switchEditor(currentEditorMode);
	                onResize();
                if(shouldRecenter) fitCameraToScene({ preserveOrientation: true });
	                updateSketchLockUI();
	                return true;
            }

            if(view === 'mixte') {
                if(!options.skipValidation && !sketchLockActive && !validate2DFor3D()) return false;
                activeMainView = 'mixte';
                if(renderer && renderer.domElement) renderer.domElement.style.display = 'block';
                if(controls) controls.enabled = true;
                build3DArch();
                if(devisRing) devisRing.style.display = 'none';
                btnMixte.classList.add('active');
                syncSun2dControls();
                if(splitter) splitter.style.display = 'block';
                modal2d.style.display = 'flex';
                modal2d.classList.add('mode-mixte');
                switchEditor(currentEditorMode);
                mixedVisibleRatio = 0.5;
                const viewportWidth = getRenderStage()?.clientWidth || 0;
                const defaultSplitPx = getMixedSplitPixelFromRatio(mixedVisibleRatio) || getDefaultMixedSplitPixel();
                if(viewportWidth > 0) {
                    splitPosition = defaultSplitPx / viewportWidth;
                }
                applySplitPosition({ animate: true });
                if(shouldRecenter) {
                    recenter2DViewToContent();
                    fitCameraToScene({ preserveOrientation: true });
	                }
	                draw2D();
	                scheduleVisible2DRedraw({ recenter: shouldRecenter });
		                updateSketchLockUI();
		                return true;
	            }

            // Vue 2D
            activeMainView = '2d';
            if(renderer && renderer.domElement) renderer.domElement.style.display = 'none';
            if(controls) controls.enabled = false;
            if(devisRing) devisRing.style.display = 'none';
            syncSun2dControls();
	            btn2d.classList.add('active');
	            updateRenderStageLayout();
	            if(shouldRecenter) focus2DView();
            else {
                modal2d.style.display = 'flex';
                switchEditor(currentEditorMode);
                updateJardPanel();
                draw2D();
            }
	            scheduleVisible2DRedraw({ recenter: false });
		            updateSketchLockUI();
		            return true;
	        }

        function recenter2DView() {
            recenter2DViewToContent();
            draw2D();
        }

        function recenterCurrentView() {
            if(activeMainView === '2d') {
                recenter2DView();
                return;
            }
            if(activeMainView === 'mixte') {
                recenter2DView();
                recenter3DView();
                return;
            }
            recenter3DView();
        }

	        function recenter3DView() {
            fitCameraToScene({ preserveOrientation: true });
	        }

	        function initSplitter() {
            const splitter = document.getElementById('view-splitter');
            splitter.addEventListener('mousedown', (e) => {
                if(activeMainView !== 'mixte') return;
                isDraggingSplitter = true;
                splitter.classList.add('dragging');
                e.preventDefault();
            });
            window.addEventListener('mousemove', (e) => {
                if(!isDraggingSplitter) return;
                const container = document.getElementById('viewport');
                const rect = container.getBoundingClientRect();
                const clampedPx = clampMixedSplitPixel(e.clientX - rect.left - getLeftUiInset());
                const { minSplit, usableWidth } = getMixedVisibleBounds();
                mixedVisibleRatio = usableWidth > 0 ? ((clampedPx - minSplit) / usableWidth) : 0.5;
                const { width: stageWidth } = getRenderStageSize();
                splitPosition = stageWidth > 0 ? (clampedPx / stageWidth) : splitPosition;
                applySplitPosition();
                draw2D();
            });
            window.addEventListener('mouseup', () => {
                if(isDraggingSplitter) {
                    isDraggingSplitter = false;
                    document.getElementById('view-splitter').classList.remove('dragging');
                }
            });
        }
