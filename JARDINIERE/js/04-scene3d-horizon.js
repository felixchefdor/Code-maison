	        function init3DMouse() {
		            if(!renderer || !renderer.domElement) return;
		            renderer.domElement.style.touchAction = 'none';

            function updateMouse3DFromClient(clientX, clientY) {
                const rect = renderer.domElement.getBoundingClientRect();
                const localX = clientX - rect.left;
                const localY = clientY - rect.top;

                if(rect.width <= 0 || localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
                    return false;
                }

                mouse3d.x = (localX / rect.width) * 2 - 1;
                mouse3d.y = -(localY / rect.height) * 2 + 1;
                return true;
            }

            function sync3DRaycasterLayers() {
                if(raycaster && raycaster.layers && typeof raycaster.layers.enable === 'function') {
                    raycaster.layers.enable(1);
                }
            }

            function getClickedConstruction(clientX, clientY) {
                if(!updateMouse3DFromClient(clientX, clientY)) return null;

                sync3DRaycasterLayers();
                raycaster.setFromCamera(mouse3d, camera);
                const meshesToTest = [];
                const entries = getConstructionItems();
                entries.forEach(entry => {
                    if(!entry.item || !entry.item.group) return;
                    entry.item.group.traverse(child => {
                        if(child.isMesh) meshesToTest.push(child);
                    });
                });

                const intersects = raycaster.intersectObjects(meshesToTest, false);
                if(intersects.length <= 0) return null;

                for(const intersection of intersects) {
                    let obj = intersection.object;
                    while(obj) {
                        const entry = entries.find(candidate => candidate.item && candidate.item.group === obj);
                        if(entry) return entry;
                        obj = obj.parent;
                    }
                }
                return null;
            }

            function getClickedNeighborhoodBuilding(clientX, clientY) {
                if(!updateMouse3DFromClient(clientX, clientY)) return null;
                const neighborhood = horizonSettings && horizonSettings.neighborhood
                    ? normalizeNeighborhoodSettings(horizonSettings.neighborhood)
                    : null;
                if(!neighborhood || !neighborhood.enabled || !Array.isArray(neighborhood.buildings) || !neighborhood.buildings.length) return null;
                if(!horizonGroup) return null;

                sync3DRaycasterLayers();
                raycaster.setFromCamera(mouse3d, camera);
                const meshesToTest = [];
                horizonGroup.traverse(child => {
                    if(child && child.isMesh && child.userData && child.userData.neighborhoodBuilding) {
                        meshesToTest.push(child);
                    }
                });
                const intersects = raycaster.intersectObjects(meshesToTest, false);
                if(!intersects.length) return null;
                const hitMesh = intersects[0].object;
                const buildingId = hitMesh && hitMesh.userData ? hitMesh.userData.neighborhoodBuildingId : null;
                if(buildingId === null || buildingId === undefined) return null;
                const building = neighborhood.buildings.find(item => String(item.id) === String(buildingId)) || null;
                if(!building) return null;
                const point = intersects[0].point;
                return {
                    building,
                    fixedPoint: point && Number.isFinite(point.x) && Number.isFinite(point.z)
                        ? { x: point.x * 20, y: point.z * 20 }
                        : null
                };
            }

	            init3DTouchNavigation(getClickedConstruction);

            const pointerClickState3D = {
                active: false,
                pointerId: null,
                startX: 0,
                startY: 0,
                startTime: 0,
                moved: false
            };

            renderer.domElement.addEventListener('pointerdown', (e) => {
                if(activeMainView === '2d' || e.button !== 0 || e.pointerType === 'touch') return;
                pointerClickState3D.active = true;
                pointerClickState3D.pointerId = e.pointerId;
                pointerClickState3D.startX = e.clientX;
                pointerClickState3D.startY = e.clientY;
                pointerClickState3D.startTime = performance.now();
                pointerClickState3D.moved = false;
            });

            renderer.domElement.addEventListener('pointermove', (e) => {
                if(!pointerClickState3D.active || e.pointerId !== pointerClickState3D.pointerId) return;
                if(Math.hypot(e.clientX - pointerClickState3D.startX, e.clientY - pointerClickState3D.startY) > 5) {
                    pointerClickState3D.moved = true;
                }
            });

            renderer.domElement.addEventListener('pointerup', (e) => {
                if(!pointerClickState3D.active || e.pointerId !== pointerClickState3D.pointerId) return;
                const moved = pointerClickState3D.moved
                    || Math.hypot(e.clientX - pointerClickState3D.startX, e.clientY - pointerClickState3D.startY) > 5;
                const elapsed = performance.now() - pointerClickState3D.startTime;
                pointerClickState3D.active = false;
                pointerClickState3D.pointerId = null;
                if(activeMainView === '2d' || moved || elapsed > 650) return;
                if(performance.now() - last3DTouchEndAt < 450) return;
                if(handleGarlandTool3DClick(e)) return;
                if(typeof handleSolarMapCellClick3D === 'function' && handleSolarMapCellClick3D(e)) return;
                const clicked = getClickedConstruction(e.clientX, e.clientY);
                if(clicked && clicked.item) {
                    selectPlacementObject(clicked.item, { openEditor: !shouldUseCompactJardSelection() });
                    requestAnimationFrame(() => { updateJard3DHighlight(); draw2D(); });
                    return;
                }
                const buildingHit = getClickedNeighborhoodBuilding(e.clientX, e.clientY);
                if(buildingHit && buildingHit.building) {
                    if(myBuildingPickArmed) {
                        if(isTouchNeighborhoodPickEvent(e)) {
                            previewTouchNeighborhoodBuildingPick(buildingHit.building);
                            return;
                        }
                        selectMyBuilding(buildingHit.building);
                    } else if(neighborhoodHeightEditPickArmed) {
                        editNeighborhoodBuildingHeight(buildingHit.building);
                    } else if(neighborhoodGridAlignmentPickArmed && buildingHit.fixedPoint) {
                        if(isTouchNeighborhoodPickEvent(e)) {
                            previewTouchNeighborhoodFacadePick(buildingHit.building, buildingHit.fixedPoint);
                            return;
                        }
                        setNeighborhoodStatus('Alignement de la façade...', true);
                        const _b = buildingHit.building, _p = buildingHit.fixedPoint;
                        requestAnimationFrame(() => alignGridToNeighborhoodBuildingEdge(_b, _p));
                    } else {
                        editNeighborhoodBuildingHeight(buildingHit.building);
                    }
                    return;
                }
                if(getSelectedPlacementObject()) {
                    clearJardiniereSelection();
                }
            });

            renderer.domElement.addEventListener('pointercancel', (e) => {
                if(pointerClickState3D.pointerId !== e.pointerId) return;
                pointerClickState3D.active = false;
                pointerClickState3D.pointerId = null;
            });
	        }

	        function init3DTouchNavigation(getClickedPlacement) {
	            const dom = renderer.domElement;
	            const state = {
	                mode: null,
	                moved: false,
	                startX: 0,
	                startY: 0,
	                lastX: 0,
	                lastY: 0,
	                lastCenterX: 0,
	                lastCenterY: 0,
	                lastDistance: 0,
	                lastAngle: 0
	            };

	            function getTouchCenter(t1, t2) {
	                return {
	                    x: (t1.clientX + t2.clientX) * 0.5,
	                    y: (t1.clientY + t2.clientY) * 0.5
	                };
	            }

	            function getTouchDistance(t1, t2) {
	                const dx = t2.clientX - t1.clientX;
	                const dy = t2.clientY - t1.clientY;
	                return Math.max(1, Math.sqrt(dx * dx + dy * dy));
	            }

	            function getTouchAngle(t1, t2) {
	                return Math.atan2(t2.clientY - t1.clientY, t2.clientX - t1.clientX);
	            }

	            function normalizeAngle(angle) {
	                while(angle > Math.PI) angle -= Math.PI * 2;
	                while(angle < -Math.PI) angle += Math.PI * 2;
	                return angle;
	            }

	            function panCameraByPixels(dx, dy) {
	                if(!camera || !controls) return;
	                const h = Math.max(1, dom.clientHeight);
	                const distance = Math.max(1, camera.position.distanceTo(controls.target));
	                const worldPerPixel = (2 * distance * Math.tan((camera.fov * Math.PI / 180) * 0.5)) / h;
	                const e = camera.matrix.elements;
	                const pan = new THREE.Vector3();
	                pan.add(new THREE.Vector3(e[0], e[1], e[2]).multiplyScalar(-dx * worldPerPixel));
	                pan.add(new THREE.Vector3(e[4], e[5], e[6]).multiplyScalar(dy * worldPerPixel));
	                camera.position.add(pan);
	                controls.target.add(pan);
	                controls.update();
	            }

	            function dollyCameraByRatio(ratio) {
	                if(!camera || !controls || !Number.isFinite(ratio)) return;
	                const offset = camera.position.clone().sub(controls.target);
	                const distance = offset.length();
	                const nextDistance = THREE.MathUtils.clamp(distance * ratio, 8, 420);
	                offset.setLength(nextDistance);
	                camera.position.copy(controls.target).add(offset);
	                controls.update();
	            }

	            function rotateCameraAroundTarget(deltaAngle) {
	                if(!camera || !controls || !Number.isFinite(deltaAngle)) return;
	                const offset = camera.position.clone().sub(controls.target);
	                offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), deltaAngle);
	                camera.position.copy(controls.target).add(offset);
	                camera.lookAt(controls.target);
	                controls.update();
	            }

	            function rotateCameraByDrag(dx, dy) {
	                if(!camera || !controls) return;
                    const navSign = cameraInsideBalconyVolume ? -1 : 1;
	                const offset = camera.position.clone().sub(controls.target);
	                const spherical = new THREE.Spherical().setFromVector3(offset);
	                spherical.theta -= dx * 0.006 * navSign;
	                spherical.phi -= dy * 0.0045 * navSign;
	                spherical.phi = THREE.MathUtils.clamp(spherical.phi, 0.18, Math.PI - 0.18);
	                offset.setFromSpherical(spherical);
	                camera.position.copy(controls.target).add(offset);
	                camera.lookAt(controls.target);
	                controls.update();
	            }

	            function stopTouchEvent(e) {
	                if(activeMainView === '2d') return false;
	                e.preventDefault();
	                e.stopImmediatePropagation();
	                return true;
	            }

	            dom.addEventListener('touchstart', (e) => {
	                if(!stopTouchEvent(e)) return;
	                if(controls) controls.enabled = false;
	                state.moved = false;
	                if(e.touches.length === 1) {
	                    const t = e.touches[0];
	                    state.mode = 'rotate';
	                    state.startX = t.clientX;
	                    state.startY = t.clientY;
	                    state.lastX = t.clientX;
	                    state.lastY = t.clientY;
	                } else if(e.touches.length >= 2) {
	                    const t1 = e.touches[0];
	                    const t2 = e.touches[1];
	                    const center = getTouchCenter(t1, t2);
	                    state.mode = 'orbit';
	                    state.lastCenterX = center.x;
	                    state.lastCenterY = center.y;
	                    state.lastDistance = getTouchDistance(t1, t2);
	                    state.lastAngle = getTouchAngle(t1, t2);
	                }
	            }, { passive: false, capture: true });

	            dom.addEventListener('touchmove', (e) => {
	                if(!stopTouchEvent(e)) return;
	                if(e.touches.length === 1 && state.mode === 'rotate') {
	                    const t = e.touches[0];
	                    const dx = t.clientX - state.lastX;
	                    const dy = t.clientY - state.lastY;
	                    if(Math.abs(t.clientX - state.startX) + Math.abs(t.clientY - state.startY) > 8) state.moved = true;
	                    rotateCameraByDrag(dx, dy);
	                    state.lastX = t.clientX;
	                    state.lastY = t.clientY;
	                } else if(e.touches.length >= 2) {
	                    const t1 = e.touches[0];
	                    const t2 = e.touches[1];
	                    const center = getTouchCenter(t1, t2);
	                    const distance = getTouchDistance(t1, t2);
	                    const angle = getTouchAngle(t1, t2);
	                    if(state.mode !== 'orbit') {
	                        state.mode = 'orbit';
	                        state.lastCenterX = center.x;
	                        state.lastCenterY = center.y;
	                        state.lastDistance = distance;
	                        state.lastAngle = angle;
	                        return;
	                    }
	                    const centerDx = center.x - state.lastCenterX;
	                    const centerDy = center.y - state.lastCenterY;
	                    const distanceRatio = distance / Math.max(1, state.lastDistance);
	                    const angleDelta = normalizeAngle(angle - state.lastAngle);
	                    if(Math.abs(centerDx) + Math.abs(centerDy) > 1) panCameraByPixels(centerDx, centerDy);
	                    if(Math.abs(distanceRatio - 1) > 0.004) dollyCameraByRatio(1 / distanceRatio);
	                    if(Math.abs(angleDelta) > 0.004) rotateCameraAroundTarget(angleDelta);
	                    if(Math.abs(centerDx) + Math.abs(centerDy) > 4 || Math.abs(distanceRatio - 1) > 0.015 || Math.abs(angleDelta) > 0.015) state.moved = true;
	                    state.lastCenterX = center.x;
	                    state.lastCenterY = center.y;
	                    state.lastDistance = distance;
	                    state.lastAngle = angle;
	                }
	            }, { passive: false, capture: true });

	            dom.addEventListener('touchend', (e) => {
	                if(!stopTouchEvent(e)) return;
	                last3DTouchEndAt = performance.now();
	                if(e.touches.length === 0) {
	                    if(controls) controls.enabled = activeMainView !== '2d';
	                    if(state.mode === 'rotate' && !state.moved && e.changedTouches.length > 0) {
	                        const touch = e.changedTouches[0];
	                        const clicked = getClickedPlacement(touch.clientX, touch.clientY);
	                        if(clicked && clicked.item) {
	                            selectPlacementObject(clicked.item, { openEditor: !shouldUseCompactJardSelection() });
	                        } else if(getSelectedPlacementObject()) {
	                            clearJardiniereSelection();
	                        }
	                    }
	                    state.mode = null;
	                } else if(e.touches.length === 1) {
	                    const t = e.touches[0];
	                    state.mode = 'rotate';
	                    state.startX = t.clientX;
	                    state.startY = t.clientY;
	                    state.lastX = t.clientX;
	                    state.lastY = t.clientY;
	                }
	            }, { passive: false, capture: true });

	            dom.addEventListener('touchcancel', (e) => {
	                if(!stopTouchEvent(e)) return;
	                last3DTouchEndAt = performance.now();
	                state.mode = null;
	                if(controls) controls.enabled = activeMainView !== '2d';
	            }, { passive: false, capture: true });
	        }

        function updateJard3DHighlight() {
            const _highlightParent = balconySceneGroup || scene;
            if(_highlightParent) {
                [..._highlightParent.children].forEach(child => {
                    if(child.userData && child.userData.selectionHelper) {
                        _highlightParent.remove(child);
                        if(child.geometry) child.geometry.dispose();
                        if(child.material) child.material.dispose();
                    }
                });
            }

            const getSelectionHelperParentMatrix = (group) => {
                const parent = balconySceneGroup || scene;
                if(parent && parent.updateWorldMatrix) parent.updateWorldMatrix(true, false);
                if(group && group.updateWorldMatrix) group.updateWorldMatrix(true, true);
                if(parent === scene) return group.matrixWorld.clone();
                const inverseParent = new THREE.Matrix4().copy(parent.matrixWorld).invert();
                return inverseParent.multiply(group.matrixWorld);
            };

            const createOrientedSelectionHelper = (group, color = 0xffd65a) => {
                if(!group) return null;
                group.updateWorldMatrix(true, true);
                const inverseGroupMatrix = new THREE.Matrix4().copy(group.matrixWorld).invert();
                const localBox = new THREE.Box3();
                group.traverse(child => {
                    if(!child.isMesh || !child.visible || (child.userData && child.userData.selectionHelper)) return;
                    if(!child.geometry) return;
                    if(!child.geometry.boundingBox) child.geometry.computeBoundingBox();
                    if(!child.geometry.boundingBox) return;
                    const childBox = child.geometry.boundingBox.clone();
                    const childToGroup = new THREE.Matrix4().multiplyMatrices(inverseGroupMatrix, child.matrixWorld);
                    childBox.applyMatrix4(childToGroup);
                    localBox.union(childBox);
                });
                if(localBox.isEmpty()) return null;
                localBox.expandByScalar(0.06);
                const min = localBox.min;
                const max = localBox.max;
                const corners = [
                    new THREE.Vector3(min.x, min.y, min.z),
                    new THREE.Vector3(max.x, min.y, min.z),
                    new THREE.Vector3(min.x, min.y, max.z),
                    new THREE.Vector3(max.x, min.y, max.z),
                    new THREE.Vector3(min.x, max.y, min.z),
                    new THREE.Vector3(max.x, max.y, min.z),
                    new THREE.Vector3(min.x, max.y, max.z),
                    new THREE.Vector3(max.x, max.y, max.z)
                ];
                const edgeIndices = [
                    0, 1, 1, 3, 3, 2, 2, 0,
                    4, 5, 5, 7, 7, 6, 6, 4,
                    0, 4, 1, 5, 2, 6, 3, 7
                ];
                const points = edgeIndices.map(index => corners[index]);
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.94,
                    depthTest: false,
                    depthWrite: false
                });
                const helper = new THREE.LineSegments(geometry, material);
                helper.matrixAutoUpdate = false;
                helper.matrix.copy(getSelectionHelperParentMatrix(group));
                helper.userData.selectionHelper = true;
                helper.renderOrder = 30;
                return helper;
            };

            const createCornerFillSelectionHelper = (item, color = 0xffd65a) => {
                if(!item || !item.group || typeof getCornerFillLocalPoints !== 'function') return null;
                const localPoints = getCornerFillLocalPoints(item);
                if(!localPoints || localPoints.length < 3) return null;
                item.group.updateWorldMatrix(true, true);
                const h = Math.max(0.2, item.h || 5.5) + 0.32;
                const points = [];
                for(let i = 0; i < localPoints.length; i++) {
                    const a = localPoints[i];
                    const b = localPoints[(i + 1) % localPoints.length];
                    points.push(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(b.x, 0, b.z));
                    points.push(new THREE.Vector3(a.x, h, a.z), new THREE.Vector3(b.x, h, b.z));
                    points.push(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(a.x, h, a.z));
                }
                const geometry = new THREE.BufferGeometry().setFromPoints(points);
                const material = new THREE.LineBasicMaterial({
                    color,
                    transparent: true,
                    opacity: 0.94,
                    depthTest: false,
                    depthWrite: false
                });
                const helper = new THREE.LineSegments(geometry, material);
                helper.matrixAutoUpdate = false;
                helper.matrix.copy(getSelectionHelperParentMatrix(item.group));
                helper.userData.selectionHelper = true;
                helper.renderOrder = 30;
                return helper;
            };

            const applyHighlight = (entry, selected, collision) => {
                const group = entry && entry.item ? entry.item.group : null;
                if(!group) return;
                if(!selected && !collision) return;
                let helper = null;
                const helperColor = collision ? 0xff3434 : 0xffd65a;
                if(getPlacementType(entry.item) === 'cornerFill') {
                    try { helper = createCornerFillSelectionHelper(entry.item, helperColor); } catch(e) { helper = null; }
                }
                if(!helper) {
                    try { helper = createOrientedSelectionHelper(group, helperColor); } catch(e) { helper = null; }
                }
                try { if(helper) (balconySceneGroup || scene).add(helper); } catch(e) {}
            };
            const selected = getSelectedPlacementObject();
            getConstructionItems().forEach(entry => {
                if(entry.item && entry.item.group) {
                    let collision = false;
                    if(typeof hasPlacementWarningCollision === 'function') {
                        try { collision = hasPlacementWarningCollision(entry.item); } catch(e) { collision = false; }
                    } else if(typeof hasPlacementBlockingCollision === 'function') {
                        try { collision = hasPlacementBlockingCollision(entry.item); } catch(e) { collision = false; }
                    }
                    try { applyHighlight(entry, entry.item === selected, collision); } catch(e) {}
                }
            });
        }

        function createGroundGrid() {
            const group = new THREE.Group();
            const y = -0.045;

            function getFadePolygonUnits() {
                if(typeof getClosedContourPointsXZ !== 'function') return [];
                const polygon = getClosedContourPointsXZ();
                if(!polygon || polygon.length < 3) return [];
                const alignGrid = typeof buildingAlignedGridActive !== 'undefined' && buildingAlignedGridActive;
                if(alignGrid) return polygon;
                const rot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
                const cosR = Math.cos(rot);
                const sinR = Math.sin(rot);
                return polygon.map(point => ({
                    x: point.x * cosR - point.z * sinR + balconyOffsetX,
                    z: point.x * sinR + point.z * cosR + balconyOffsetZ
                }));
            }

            function distanceToSegmentXZ(point, a, b) {
                const dx = b.x - a.x;
                const dz = b.z - a.z;
                const lenSq = dx * dx + dz * dz;
                if(lenSq <= 0.000001) return Math.hypot(point.x - a.x, point.z - a.z);
                const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / lenSq));
                return Math.hypot(point.x - (a.x + dx * t), point.z - (a.z + dz * t));
            }

            function distanceToFadePolygon(point, polygon) {
                if(!polygon || polygon.length < 3) return 0;
                if(typeof isPointInsidePolygonXZ === 'function' && isPointInsidePolygonXZ(point, polygon)) return 0;
                let best = Infinity;
                for(let i = 0; i < polygon.length; i++) {
                    best = Math.min(best, distanceToSegmentXZ(point, polygon[i], polygon[(i + 1) % polygon.length]));
                }
                return Number.isFinite(best) ? best : 0;
            }

            function getGridStyle(i) {
                if(i % 10 === 0) return { color: 0x6f91c7, baseOpacity: 0.7, bucket: 'major' };
                if(i % 5 === 0) return { color: 0x4f76ad, baseOpacity: 0.56, bucket: 'mid' };
                return { color: 0x355a86, baseOpacity: 0.42, bucket: 'minor' };
            }

            function addLineBucket(buckets, style, opacityFactor, vertices) {
                const level = Math.max(1, Math.min(10, Math.round(opacityFactor * 10)));
                const key = style.bucket + '-' + level;
                if(!buckets.has(key)) buckets.set(key, { color: style.color, opacity: style.baseOpacity * (level / 10), vertices: [] });
                buckets.get(key).vertices.push(...vertices);
            }

            function buildFadedLines() {
                while(group.children.length) {
                    const child = group.children[0];
                    group.remove(child);
                    if(child.geometry && typeof child.geometry.dispose === 'function') child.geometry.dispose();
                    if(child.material && typeof child.material.dispose === 'function') child.material.dispose();
                }
                const fadeDistance = typeof GRID_FADE_DISTANCE_UNITS === 'number' ? GRID_FADE_DISTANCE_UNITS : 150;
                const segmentLength = 5;
                const polygon = getFadePolygonUnits();
                const hasFadePolygon = polygon.length >= 3;
                const alignGrid = typeof buildingAlignedGridActive !== 'undefined' && buildingAlignedGridActive;
                const fallbackCenter = {
                    x: alignGrid ? 0 : (Number.isFinite(balconyOffsetX) ? balconyOffsetX : 0),
                    z: alignGrid ? 0 : (Number.isFinite(balconyOffsetZ) ? balconyOffsetZ : 0)
                };
                const fallbackSolidRadius = 18;
                const fallbackRadius = fallbackSolidRadius + fadeDistance;
                const useBuildingGridFallback = !hasFadePolygon && alignGrid;
                const bounds = hasFadePolygon
                    ? polygon.reduce((acc, point) => ({
                        minX: Math.min(acc.minX, point.x),
                        maxX: Math.max(acc.maxX, point.x),
                        minZ: Math.min(acc.minZ, point.z),
                        maxZ: Math.max(acc.maxZ, point.z)
                    }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity })
                    : useBuildingGridFallback
                    ? {
                        minX: -WORLD_GRID_HALF_UNITS + fadeDistance + 10,
                        maxX: WORLD_GRID_HALF_UNITS - fadeDistance - 10,
                        minZ: -WORLD_GRID_HALF_UNITS + fadeDistance + 10,
                        maxZ: WORLD_GRID_HALF_UNITS - fadeDistance - 10
                    }
                    : {
                        minX: fallbackCenter.x - fallbackRadius,
                        maxX: fallbackCenter.x + fallbackRadius,
                        minZ: fallbackCenter.z - fallbackRadius,
                        maxZ: fallbackCenter.z + fallbackRadius
                    };
                const minX = Math.max(-WORLD_GRID_HALF_UNITS, Math.floor((bounds.minX - fadeDistance - 10) / 1));
                const maxX = Math.min(WORLD_GRID_HALF_UNITS, Math.ceil((bounds.maxX + fadeDistance + 10) / 1));
                const minZ = Math.max(-WORLD_GRID_HALF_UNITS, Math.floor((bounds.minZ - fadeDistance - 10) / 1));
                const maxZ = Math.min(WORLD_GRID_HALF_UNITS, Math.ceil((bounds.maxZ + fadeDistance + 10) / 1));
                const buckets = new Map();

                function addSegment(style, alpha, x1, z1, x2, z2) {
                    if(alpha <= 0.02) return;
                    addLineBucket(buckets, style, alpha, [x1, y, z1, x2, y, z2]);
                }

                if(!hasFadePolygon) {
                    if(useBuildingGridFallback) {
                        for(let x = minX; x <= maxX; x += 1) {
                            addLineBucket(buckets, getGridStyle(x), 1, [x, y, minZ, x, y, maxZ]);
                        }
                        for(let z = minZ; z <= maxZ; z += 1) {
                            addLineBucket(buckets, getGridStyle(z), 1, [minX, y, z, maxX, y, z]);
                        }
                        buckets.forEach(bucket => {
                            if(!bucket.vertices.length) return;
                            const geo = new THREE.BufferGeometry();
                            geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.vertices, 3));
                            const mat = new THREE.LineBasicMaterial({ color: bucket.color, transparent: true, opacity: bucket.opacity, depthTest: true, depthWrite: false });
                            const lines = new THREE.LineSegments(geo, mat);
                            lines.renderOrder = -8;
                            group.add(lines);
                        });
                        return;
                    }
                    for(let x = minX; x <= maxX; x += 1) {
                        const style = getGridStyle(x);
                        for(let z = minZ; z < maxZ; z += segmentLength) {
                            const z2 = Math.min(maxZ, z + segmentLength);
                            const midZ = (z + z2) * 0.5;
                            const distance = Math.hypot(x - fallbackCenter.x, midZ - fallbackCenter.z);
                            const alpha = 1 - Math.max(0, distance - fallbackSolidRadius) / fadeDistance;
                            addSegment(style, alpha, x, z, x, z2);
                        }
                    }
                    for(let z = minZ; z <= maxZ; z += 1) {
                        const style = getGridStyle(z);
                        for(let x = minX; x < maxX; x += segmentLength) {
                            const x2 = Math.min(maxX, x + segmentLength);
                            const midX = (x + x2) * 0.5;
                            const distance = Math.hypot(midX - fallbackCenter.x, z - fallbackCenter.z);
                            const alpha = 1 - Math.max(0, distance - fallbackSolidRadius) / fadeDistance;
                            addSegment(style, alpha, x, z, x2, z);
                        }
                    }
                    buckets.forEach(bucket => {
                        if(!bucket.vertices.length) return;
                        const geo = new THREE.BufferGeometry();
                        geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.vertices, 3));
                        const mat = new THREE.LineBasicMaterial({ color: bucket.color, transparent: true, opacity: bucket.opacity, depthTest: true, depthWrite: false });
                        const lines = new THREE.LineSegments(geo, mat);
                        lines.renderOrder = -8;
                        group.add(lines);
                    });
                    return;
                }

                for(let x = minX; x <= maxX; x += 1) {
                    const style = getGridStyle(x);
                    for(let z = minZ; z < maxZ; z += segmentLength) {
                        const z2 = Math.min(maxZ, z + segmentLength);
                        const distance = distanceToFadePolygon({ x, z: (z + z2) * 0.5 }, polygon);
                        addSegment(style, 1 - distance / fadeDistance, x, z, x, z2);
                    }
                }
                for(let z = minZ; z <= maxZ; z += 1) {
                    const style = getGridStyle(z);
                    for(let x = minX; x < maxX; x += segmentLength) {
                        const x2 = Math.min(maxX, x + segmentLength);
                        const distance = distanceToFadePolygon({ x: (x + x2) * 0.5, z }, polygon);
                        addSegment(style, 1 - distance / fadeDistance, x, z, x2, z);
                    }
                }

                buckets.forEach(bucket => {
                    if(!bucket.vertices.length) return;
                    const geo = new THREE.BufferGeometry();
                    geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.vertices, 3));
                    const mat = new THREE.LineBasicMaterial({ color: bucket.color, transparent: true, opacity: bucket.opacity, depthTest: true, depthWrite: false });
                    const lines = new THREE.LineSegments(geo, mat);
                    lines.renderOrder = -8;
                    group.add(lines);
                });
            }

            group.name = 'Sol balcon - grille dégradée';
            group.renderOrder = -8;
            group.userData.rebuildFadedGrid = buildFadedLines;
            buildFadedLines();
            return group;
        }

        function refreshGroundGrid() {
            if(!groundGrid) return;
            const rot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const alignGrid = typeof buildingAlignedGridActive !== 'undefined' && buildingAlignedGridActive;
            groundGrid.rotation.y = alignGrid ? -rot : 0;
            groundGrid.position.x = alignGrid ? balconyOffsetX : 0;
            groundGrid.position.z = alignGrid ? balconyOffsetZ : 0;
            if(groundGrid.userData && typeof groundGrid.userData.rebuildFadedGrid === 'function') {
                groundGrid.userData.rebuildFadedGrid();
            }
        }

        function isCameraInsideBalconyVolumeNow() {
            return false;
        }

        function updateCameraInteriorNavigationMode() {
            if(!camera || !controls) return;
            cameraInsideBalconyVolume = false;
            controls.rotateSpeed = 1;
            const targetFov = DEFAULT_CAMERA_FOV_DEG;
            if(Math.abs(camera.fov - targetFov) > 0.02) {
                camera.fov += (targetFov - camera.fov) * 0.14;
                camera.updateProjectionMatrix();
            }
        }

        function normalizeHorizonPoint(point) {
            const azimut = Math.max(-180, Math.min(180, Number(point && point.azimut)));
            const elevation = Math.max(0, Math.min(89, Number(point && point.elevation)));
            if(!Number.isFinite(azimut) || !Number.isFinite(elevation)) return null;
            return { azimut, elevation };
        }

        function normalizeHorizonSilhouette(input, index = 0, fallbackDistanceM = 20) {
            const points = Array.isArray(input && input.points)
                ? input.points.map(normalizeHorizonPoint).filter(Boolean).sort((a, b) => a.azimut - b.azimut)
                : [];
            const distanceM = Math.max(2, Math.min(120, Number(input && input.distanceM) || fallbackDistanceM || 20));
            return {
                id: (input && input.id) || ('horizon-' + Date.now().toString(36) + '-' + index),
                name: (input && input.name) || ('Obstacle ' + (index + 1)),
                distanceM,
                points
            };
        }

        const DEFAULT_NEIGHBORHOOD_BUILDING_LEVELS = 2;
        const DEFAULT_NEIGHBORHOOD_BUILDING_HEIGHT_M = DEFAULT_NEIGHBORHOOD_BUILDING_LEVELS * 3;
        const MAX_NEIGHBORHOOD_BUILDING_HEIGHT_M = 600;

        function normalizeNeighborhoodBuilding(input, index = 0) {
            const footprint = Array.isArray(input && input.footprint)
                ? input.footprint.map(point => ({
                    x: Number(point && point.x),
                    z: Number(point && point.z)
                })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.z))
                : [];
            const cleanFootprint = footprint.length > 2 ? footprint : [];
            const heightSource = String(input && input.heightSource || '');
            const isDefaultHeight = !heightSource || heightSource === 'default';
            const heightM = isDefaultHeight
                ? DEFAULT_NEIGHBORHOOD_BUILDING_HEIGHT_M
                : (Number(input && input.heightM) || DEFAULT_NEIGHBORHOOD_BUILDING_HEIGHT_M);
            const levels = isDefaultHeight
                ? DEFAULT_NEIGHBORHOOD_BUILDING_LEVELS
                : (Number.isFinite(Number(input && input.levels)) ? Number(input.levels) : null);
            return {
                id: (input && input.id) || ('building-' + index),
                name: (input && input.name) || ('Immeuble ' + (index + 1)),
                heightM: Math.max(2, Math.min(MAX_NEIGHBORHOOD_BUILDING_HEIGHT_M, heightM)),
                estimated: !!(input && input.estimated),
                levels,
                heightSource,
                footprint: cleanFootprint
            };
        }

        function normalizeNeighborhoodFeature(input, index = 0) {
            const kind = String(input && input.kind || 'feature');
            const points = Array.isArray(input && input.points)
                ? input.points.map(point => ({
                    x: Number(point && point.x),
                    z: Number(point && point.z)
                })).filter(point => Number.isFinite(point.x) && Number.isFinite(point.z))
                : [];
            const point = input && input.point
                ? { x: Number(input.point.x), z: Number(input.point.z) }
                : null;
            return {
                id: (input && input.id) || ('urban-' + index),
                kind,
                subtype: String(input && input.subtype || ''),
                name: String(input && input.name || ''),
                widthM: Math.max(0.4, Math.min(24, Number(input && input.widthM) || (kind === 'road' ? 4 : 1))),
                radiusM: Math.max(0.4, Math.min(8, Number(input && input.radiusM) || 2.2)),
                heightM: Math.max(0.5, Math.min(30, Number(input && input.heightM) || 5)),
                points,
                point: point && Number.isFinite(point.x) && Number.isFinite(point.z) ? point : null
            };
        }

        function formatNeighborhoodBuildingHeight(building, floorHeightM = 3) {
            if(!building) return '';
            const heightM = Math.round((Number(building.heightM) || 0) * 10) / 10;
            const levels = Number.isFinite(Number(building.levels))
                ? Math.max(1, Math.round(Number(building.levels)))
                : Math.max(1, Math.round(heightM / Math.max(0.5, Number(floorHeightM) || 3)));
            return levels + ' niveau(x), ' + heightM + ' m';
        }

        function getNeighborhoodHeightWarningMessage(neighborhoodInput = null, focusBuilding = null) {
            const neighborhood = normalizeNeighborhoodSettings(neighborhoodInput || horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) return '';
            const activeBuilding = focusBuilding || getNeighborhoodSupportBuilding(neighborhood);
            const floorHeightM = Math.round((Number(neighborhood.floorHeightM) || 3) * 10) / 10;
            const floorLabel = Number.isFinite(Number(neighborhood.floor))
                ? 'Ton étage : ' + neighborhood.floor + ', hauteur par étage utilisée : ' + floorHeightM + ' m.'
                : 'Hauteur par étage utilisée : ' + floorHeightM + ' m.';
            const buildingLabel = activeBuilding
                ? ' Bâtiment actif : ' + (activeBuilding.name || activeBuilding.id) + ' · ' + formatNeighborhoodBuildingHeight(activeBuilding, floorHeightM) + '.'
                : '';
            return neighborhood.buildings.length + ' bâtiment(s) importé(s) comme silhouettes.' + buildingLabel + ' ' + floorLabel + ' Les niveaux et hauteurs OSM comportent souvent des erreurs : la hauteur de ce bâtiment est modifiable avec "Corriger hauteur", et les bâtiments alentours peuvent aussi être corrigés.';
        }

        function normalizeNeighborhoodSettings(input = {}) {
            const buildings = Array.isArray(input.buildings)
                ? input.buildings.map(normalizeNeighborhoodBuilding).filter(building => building.footprint.length >= 3)
                : [];
            const features = Array.isArray(input.features)
                ? input.features.map(normalizeNeighborhoodFeature).filter(feature => feature.point || feature.points.length >= 2)
                : [];
            return {
                enabled: !!input.enabled && buildings.length > 0,
                address: String(input.address || ''),
                lat: Number.isFinite(Number(input.lat)) ? Number(input.lat) : null,
                lon: Number.isFinite(Number(input.lon)) ? Number(input.lon) : null,
                mapOriginX: Number.isFinite(Number(input.mapOriginX)) ? Number(input.mapOriginX) : null,
                mapOriginY: Number.isFinite(Number(input.mapOriginY)) ? Number(input.mapOriginY) : null,
                radiusM: Math.max(40, Math.min(500, Number(input.radiusM) || 160)),
                floor: Math.max(0, Math.min(40, Math.round(Number(input.floor) || 0))),
                floorHeightM: Math.max(2.2, Math.min(4.5, Number(input.floorHeightM) || 3)),
                showFootprints: !!input.showFootprints,
                satelliteOptIn: input.satelliteOptIn === true,
                showSatellite: input.satelliteOptIn === true && input.showSatellite === true,
                showUrbanFeatures: input.showUrbanFeatures !== false,
                supportBuildingId: input.supportBuildingId ? String(input.supportBuildingId) : null,
                supportSide: input.supportSide === 'inside' ? 'inside' : 'outside',
                supportWidthM: Math.max(0.8, Math.min(12, Number(input.supportWidthM) || 3)),
                supportDepthM: Math.max(0.4, Math.min(4, Number(input.supportDepthM) || 1.4)),
                buildings,
                features
            };
        }

        function normalizeHorizonSettings(input = horizonSettings) {
            const radiusM = Math.max(5, Math.min(80, Number(input.radiusM) || 20));
            const eyeHeightM = Math.max(0.5, Math.min(3, Number(input.eyeHeightM) || 1.7));
            const legacyPoints = Array.isArray(input.points)
                ? input.points.map(normalizeHorizonPoint).filter(Boolean).sort((a, b) => a.azimut - b.azimut)
                : [];
            let silhouettes = Array.isArray(input.silhouettes)
                ? input.silhouettes.map((shape, index) => normalizeHorizonSilhouette(shape, index, radiusM)).filter(shape => shape.points.length >= 2)
                : [];
            if(!silhouettes.length && legacyPoints.length >= 2) {
                silhouettes = [normalizeHorizonSilhouette({ name: 'Obstacle 1', distanceM: radiusM, points: legacyPoints }, 0, radiusM)];
            }
            const activeSilhouetteIndex = Math.max(0, Math.min(Math.max(0, silhouettes.length - 1), Number(input.activeSilhouetteIndex) || 0));
            const activeDistanceM = Math.max(2, Math.min(120, Number(input.activeDistanceM) || (silhouettes[activeSilhouetteIndex] && silhouettes[activeSilhouetteIndex].distanceM) || radiusM || 20));
            const neighborhood = normalizeNeighborhoodSettings(input.neighborhood || {});
            return {
                enabled: !!input.enabled && (silhouettes.some(shape => shape.points.length >= 2) || neighborhood.enabled),
                radiusM,
                eyeHeightM,
                activeDistanceM,
                activeSilhouetteIndex,
                silhouettes,
                points: legacyPoints,
                neighborhood
            };
        }

        const HORIZON_DOME_RADIUS_M = 20;

        function horizonPointToWorld(point, radiusDm, eyeHeightDm, eye2d = null) {
            const az = point.azimut * Math.PI / 180;
            const el = Math.max(-89, Math.min(89, point.elevation)) * Math.PI / 180;
            const horizontalRadius = Math.cos(el) * radiusDm;
            const localX = -Math.sin(az) * horizontalRadius;
            const localZ = Math.cos(az) * horizontalRadius;
            const southRotation = ((balconyWorldOrientationDeg - 180) % 360) * Math.PI / 180;
            const eyeX = eye2d ? eye2d.x / 20 : 0;
            const eyeZ = eye2d ? eye2d.y / 20 : 0;
            return {
                x: eyeX + localX * Math.cos(southRotation) - localZ * Math.sin(southRotation),
                y: eyeHeightDm + Math.sin(el) * radiusDm,
                z: eyeZ + localX * Math.sin(southRotation) + localZ * Math.cos(southRotation)
            };
        }

        function createHorizonWallMesh(points, options = {}) {
            const normalized = (Array.isArray(points) ? points : []).map(normalizeHorizonPoint).filter(Boolean).sort((a, b) => a.azimut - b.azimut);
            if(normalized.length < 2) return null;

            const radiusDm = HORIZON_DOME_RADIUS_M * 10;
            const eyeHeightDm = Math.max(5, Math.min(30, Number(options.eyeHeightM || horizonSettings.eyeHeightM || 1.7) * 10));
            const eye2d = getHorizonViewpoint2D();
            const groundElevationRad = Math.asin(Math.max(-0.98, Math.min(0, -eyeHeightDm / radiusDm)));
            const vertices = [];
            const indices = [];
            const columns = [];

            for(let i = 0; i < normalized.length - 1; i++) {
                const a = normalized[i];
                const b = normalized[i + 1];
                const span = Math.abs(b.azimut - a.azimut);
                const steps = Math.max(1, Math.ceil(span / 4));
                for(let step = 0; step <= steps; step++) {
                    if(i > 0 && step === 0) continue;
                    const t = step / steps;
                    columns.push({
                        azimut: a.azimut + (b.azimut - a.azimut) * t,
                        elevation: a.elevation + (b.elevation - a.elevation) * t
                    });
                }
            }

            const rowCount = 8;
            columns.forEach(point => {
                const topElevationRad = Math.max(groundElevationRad + 0.001, Math.min(89, point.elevation) * Math.PI / 180);
                for(let row = 0; row <= rowCount; row++) {
                    const t = row / rowCount;
                    const elevation = (groundElevationRad + (topElevationRad - groundElevationRad) * t) * 180 / Math.PI;
                    const p = horizonPointToWorld({ azimut: point.azimut, elevation }, radiusDm, eyeHeightDm, eye2d);
                    vertices.push(p.x, Math.max(0, p.y), p.z);
                }
            });

            for(let col = 0; col < columns.length - 1; col++) {
                for(let row = 0; row < rowCount; row++) {
                    const a = col * (rowCount + 1) + row;
                    const b = a + 1;
                    const c = (col + 1) * (rowCount + 1) + row;
                    const d = c + 1;
                    indices.push(a, b, c, b, d, c);
                }
            }

            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geo.setIndex(indices);
            geo.computeVertexNormals();

            const mat = new THREE.MeshStandardMaterial({
                color: options.color || 0x151515,
                transparent: true,
                opacity: options.opacity || 0.42,
                roughness: 0.9,
                metalness: 0,
                side: THREE.DoubleSide,
                depthWrite: true
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.name = options.name || 'Obstacle horizon';
            mesh.castShadow = true;
            mesh.receiveShadow = false;
            return mesh;
        }

        function disposeObject3D(object) {
            if(!object) return;
            object.traverse(child => {
                if(child.geometry) child.geometry.dispose();
                if(child.material) {
                    if(Array.isArray(child.material)) {
                        child.material.forEach(material => material && material.dispose && material.dispose());
                    } else if(child.material.dispose) {
                        child.material.dispose();
                    }
                }
            });
        }

        function createNeighborhoodBuildingMesh(building, observerHeightM) {
            const footprint = (building.footprint || []).slice();
            if(footprint.length < 3) return null;
            const first = footprint[0];
            const last = footprint[footprint.length - 1];
            if(first && last && Math.abs(first.x - last.x) < 0.01 && Math.abs(first.z - last.z) < 0.01) {
                footprint.pop();
            }
            if(footprint.length < 3) return null;

            // Footprint coordinates are in meters from the observer.
            // The scene uses 1 unit = 10 cm → 10 units/metre (same as U=10 in architecture).
            // The observer sits at (eyeX, 0, eyeZ) in scene space.
            const eye = getNeighborhoodMapOrigin2D();
            const eyeX = eye.x / 20;
            const eyeZ = eye.y / 20;
            const SCALE = 10; // units per metre, matching the rest of the 3D scene (U=10)
            const baseY = -observerHeightM * SCALE;
            const topY = baseY + building.heightM * SCALE;
            const internalCutout = getNeighborhoodSupportInternalCutoutFixed2D(building);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const isSupportBuilding = !!(building && neighborhood.supportBuildingId && String(building.id) === String(neighborhood.supportBuildingId));
            const vertices = [];
            footprint.forEach(point => vertices.push(eyeX + point.x * SCALE, baseY, eyeZ + point.z * SCALE));
            footprint.forEach(point => vertices.push(eyeX + point.x * SCALE, topY, eyeZ + point.z * SCALE));

            const indices = [];
            for(let i = 0; i < footprint.length; i++) {
                const next = (i + 1) % footprint.length;
                const aScene = { x: eyeX + footprint[i].x * SCALE, z: eyeZ + footprint[i].z * SCALE };
                const bScene = { x: eyeX + footprint[next].x * SCALE, z: eyeZ + footprint[next].z * SCALE };
                getNeighborhoodBuildingCutoutIntervalsForSceneSegment(aScene, bScene, internalCutout).forEach(interval => {
                    const p0 = {
                        x: aScene.x + (bScene.x - aScene.x) * interval.t0,
                        z: aScene.z + (bScene.z - aScene.z) * interval.t0
                    };
                    const p1 = {
                        x: aScene.x + (bScene.x - aScene.x) * interval.t1,
                        z: aScene.z + (bScene.z - aScene.z) * interval.t1
                    };
                    const yBands = interval.cut
                        ? getNeighborhoodBuildingVisibleYBandsAboveCutout(baseY, topY, internalCutout)
                        : [{ y0: baseY, y1: topY }];
                    yBands.forEach(band => {
                        if(!band || band.y1 - band.y0 <= 0.01) return;
                        const baseIndex = vertices.length / 3;
                        vertices.push(p0.x, band.y0, p0.z);
                        vertices.push(p1.x, band.y0, p1.z);
                        vertices.push(p0.x, band.y1, p0.z);
                        vertices.push(p1.x, band.y1, p1.z);
                        indices.push(baseIndex, baseIndex + 1, baseIndex + 2);
                        indices.push(baseIndex + 1, baseIndex + 3, baseIndex + 2);
                    });
                });
            }

            const shapePoints = footprint.map(point => new THREE.Vector2(eyeX + point.x * SCALE, eyeZ + point.z * SCALE));
            const triangles = THREE.ShapeUtils.triangulateShape(shapePoints, []);
            triangles.forEach(tri => {
                const p0 = shapePoints[tri[0]];
                const p1 = shapePoints[tri[1]];
                const p2 = shapePoints[tri[2]];
                const cx = (p0.x + p1.x + p2.x) / 3;
                const cz = (p0.y + p1.y + p2.y) / 3;
                if(isSupportBuilding) return;
                if(isSceneXZInsideNeighborhoodInternalCutout(cx, cz, internalCutout)) return;
                indices.push(footprint.length + tri[0], footprint.length + tri[1], footprint.length + tri[2]);
            });

            const geometry = new THREE.BufferGeometry();
            geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
            geometry.setIndex(indices);
            geometry.computeVertexNormals();

            const material = new THREE.MeshStandardMaterial({
                color: isSupportBuilding ? 0x248dff : (building.estimated ? 0x5b6470 : 0x485665),
                emissive: isSupportBuilding ? 0x0b4d8c : 0x000000,
                emissiveIntensity: isSupportBuilding ? 0.42 : 0,
                transparent: true,
                opacity: isSupportBuilding ? 0.82 : (building.estimated ? 0.46 : 0.58),
                roughness: 0.92,
                metalness: 0.02,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.name = building.name + (building.estimated ? ' (hauteur estimee)' : '');
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.neighborhoodBuilding = true;
            mesh.userData.neighborhoodBuildingId = building.id;
            mesh.userData.heightM = building.heightM;
            mesh.userData.estimatedHeight = building.estimated;
            return mesh;
        }

        function getNeighborhoodSupportInternalCutoutFixed2D(building) {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!building || !neighborhood.enabled) return null;
            if(typeof getPrimaryContourPolygon2D !== 'function' || typeof transformBalconyScenePoint2D !== 'function') return null;
            const polygon = getBalconyCutoutSourcePolygon2D();
            if(!polygon || polygon.length < 3) return null;
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

        function isSceneXZInsideNeighborhoodInternalCutout(x, z, cutout) {
            if(!cutout || typeof pointInCanvasPolygon !== 'function') return false;
            const polygons = Array.isArray(cutout)
                ? [cutout]
                : (Array.isArray(cutout.polygons) ? cutout.polygons : []);
            return polygons.some(polygon => polygon && polygon.length >= 3 && pointInCanvasPolygon({ x: x * 20, y: z * 20 }, polygon));
        }

        function getSceneXZDistanceToNeighborhoodInternalCutout(x, z, cutout) {
            if(!cutout) return Infinity;
            if(isSceneXZInsideNeighborhoodInternalCutout(x, z, cutout)) return 0;
            const polygons = Array.isArray(cutout)
                ? [cutout]
                : (Array.isArray(cutout.polygons) ? cutout.polygons : []);
            const point = { x: x * 20, y: z * 20 };
            let minDist = Infinity;
            polygons.forEach(polygon => {
                if(!polygon || polygon.length < 3) return;
                for(let i = 0; i < polygon.length; i++) {
                    const a = polygon[i];
                    const b = polygon[(i + 1) % polygon.length];
                    if(!a || !b) continue;
                    const dist = getDistanceToFixedSegment2D(point, a, b) / 20;
                    if(dist < minDist) minDist = dist;
                }
            });
            return minDist;
        }

        function isSceneXZTouchingNeighborhoodInternalCutout(x, z, cutout) {
            return getSceneXZDistanceToNeighborhoodInternalCutout(x, z, cutout) <= 1.8;
        }

        function fixedSegmentsIntersect2D(a, b, c, d) {
            if(!a || !b || !c || !d) return false;
            const cross = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
            const onSegment = (p, q, r) => {
                const margin = 0.001;
                return Math.min(p.x, r.x) - margin <= q.x && q.x <= Math.max(p.x, r.x) + margin
                    && Math.min(p.y, r.y) - margin <= q.y && q.y <= Math.max(p.y, r.y) + margin
                    && Math.abs(cross(p, q, r)) <= margin;
            };
            const d1 = cross(a, b, c);
            const d2 = cross(a, b, d);
            const d3 = cross(c, d, a);
            const d4 = cross(c, d, b);
            if(((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
            return onSegment(a, c, b) || onSegment(a, d, b) || onSegment(c, a, d) || onSegment(c, b, d);
        }

        function getFixedSegmentIntersectionParam2D(a, b, c, d) {
            if(!a || !b || !c || !d) return null;
            const rx = b.x - a.x;
            const ry = b.y - a.y;
            const sx = d.x - c.x;
            const sy = d.y - c.y;
            const denom = rx * sy - ry * sx;
            if(Math.abs(denom) < 0.000001) return null;
            const qpx = c.x - a.x;
            const qpy = c.y - a.y;
            const t = (qpx * sy - qpy * sx) / denom;
            const u = (qpx * ry - qpy * rx) / denom;
            const margin = 0.000001;
            if(t < -margin || t > 1 + margin || u < -margin || u > 1 + margin) return null;
            return Math.max(0, Math.min(1, t));
        }

        function getFixedPointParamOnSegment2D(point, a, b) {
            if(!point || !a || !b) return null;
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            if(lenSq <= 0.000001) return null;
            return ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq;
        }

        function getNeighborhoodBuildingVisibleYBandsAboveCutout(baseY, topY, cutout) {
            if(!cutout || !Number.isFinite(cutout.maxY)) return [];
            const cutoutTopY = cutout.maxY;
            const cutoutBottomY = Number.isFinite(cutout.minY) ? cutout.minY : cutoutTopY;
            const bands = [];
            if(baseY < cutoutBottomY) {
                bands.push({ y0: baseY, y1: Math.min(topY, cutoutBottomY) });
            }
            if(topY > cutoutTopY) {
                bands.push({ y0: Math.max(baseY, cutoutTopY), y1: topY });
            }
            return bands;
        }

        function getNeighborhoodBuildingCutoutIntervalsForSceneSegment(a, b, cutout) {
            if(!cutout || !a || !b) return [{ t0: 0, t1: 1, cut: false }];
            const polygons = Array.isArray(cutout)
                ? [cutout]
                : (Array.isArray(cutout.polygons) ? cutout.polygons : []);
            if(!polygons.some(polygon => polygon && polygon.length >= 3)) return [{ t0: 0, t1: 1, cut: false }];

            const fixedA = { x: a.x * 20, y: a.z * 20 };
            const fixedB = { x: b.x * 20, y: b.z * 20 };
            const tValues = [0, 1];
            const addT = value => {
                if(!Number.isFinite(value)) return;
                const t = Math.max(0, Math.min(1, value));
                if(!tValues.some(existing => Math.abs(existing - t) < 0.0001)) tValues.push(t);
            };

            polygons.forEach(polygon => {
                if(!polygon || polygon.length < 3) return;
                polygon.forEach((point, index) => {
                    const next = polygon[(index + 1) % polygon.length];
                    const intersectionT = getFixedSegmentIntersectionParam2D(fixedA, fixedB, point, next);
                    if(intersectionT !== null) addT(intersectionT);

                    if(getDistanceToFixedSegment2D(point, fixedA, fixedB) <= 0.5) addT(getFixedPointParamOnSegment2D(point, fixedA, fixedB));
                    if(getDistanceToFixedSegment2D(next, fixedA, fixedB) <= 0.5) addT(getFixedPointParamOnSegment2D(next, fixedA, fixedB));
                });
            });

            tValues.sort((left, right) => left - right);
            const intervals = [];
            for(let i = 0; i < tValues.length - 1; i++) {
                const t0 = tValues[i];
                const t1 = tValues[i + 1];
                if(t1 - t0 <= 0.0001) continue;
                const mid = (t0 + t1) / 2;
                const x = a.x + (b.x - a.x) * mid;
                const z = a.z + (b.z - a.z) * mid;
                intervals.push({
                    t0,
                    t1,
                    cut: isSceneXZTouchingNeighborhoodInternalCutout(x, z, cutout)
                });
            }

            if(!intervals.length) return [{ t0: 0, t1: 1, cut: isSceneXZSegmentTouchingNeighborhoodInternalCutout(a, b, cutout) }];
            return intervals.reduce((merged, interval) => {
                const previous = merged[merged.length - 1];
                if(previous && previous.cut === interval.cut && Math.abs(previous.t1 - interval.t0) < 0.0001) {
                    previous.t1 = interval.t1;
                } else {
                    merged.push({ ...interval });
                }
                return merged;
            }, []);
        }

        function isSceneXZSegmentTouchingNeighborhoodInternalCutout(a, b, cutout) {
            if(!cutout || !a || !b) return false;
            const polygons = Array.isArray(cutout)
                ? [cutout]
                : (Array.isArray(cutout.polygons) ? cutout.polygons : []);
            if(!polygons.some(polygon => polygon && polygon.length >= 3)) return false;
            const fixedA = { x: a.x * 20, y: a.z * 20 };
            const fixedB = { x: b.x * 20, y: b.z * 20 };
            if(polygons.some(polygon => polygon && polygon.length >= 3 && (
                pointInCanvasPolygon(fixedA, polygon)
                || pointInCanvasPolygon(fixedB, polygon)
                || polygon.some((point, index) => fixedSegmentsIntersect2D(fixedA, fixedB, point, polygon[(index + 1) % polygon.length]))
            ))) return true;
            for(let i = 0; i <= 4; i++) {
                const t = i / 4;
                const x = a.x + (b.x - a.x) * t;
                const z = a.z + (b.z - a.z) * t;
                if(isSceneXZTouchingNeighborhoodInternalCutout(x, z, cutout)) return true;
            }
            return false;
        }

        function neighborhoodMetersToScene(point, eye, scaleUnits = 10) {
            return {
                x: eye.x / 20 + point.x * scaleUnits,
                z: eye.y / 20 + point.z * scaleUnits
            };
        }

        function createNeighborhoodRoadMesh(feature, observerHeightM) {
            if(!feature || !Array.isArray(feature.points) || feature.points.length < 2) return null;
            const eye = getNeighborhoodMapOrigin2D();
            const SCALE = 10;
            const y = -observerHeightM * SCALE + 0.035;
            const group = new THREE.Group();
            group.name = feature.name || 'Voie OSM';
            const mat = new THREE.LineBasicMaterial({
                color: feature.subtype === 'footway' || feature.subtype === 'path' ? 0xa7a18f : 0x9a9588,
                transparent: true,
                opacity: 0.72,
                depthWrite: false
            });
            for(let i = 0; i < feature.points.length - 1; i++) {
                const a = neighborhoodMetersToScene(feature.points[i], eye, SCALE);
                const b = neighborhoodMetersToScene(feature.points[i + 1], eye, SCALE);
                const geometry = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(a.x, y, a.z),
                    new THREE.Vector3(b.x, y, b.z)
                ]);
                const line = new THREE.Line(geometry, mat);
                line.userData.urbanFeature = true;
                group.add(line);
            }
            return group.children.length ? group : null;
        }

        function createNeighborhoodTreeMesh(feature, observerHeightM) {
            if(!feature || !feature.point) return null;
            const eye = getNeighborhoodMapOrigin2D();
            const SCALE = 10;
            const p = neighborhoodMetersToScene(feature.point, eye, SCALE);
            const baseY = -observerHeightM * SCALE;
            const group = new THREE.Group();
            group.name = feature.name || 'Arbre OSM';
            const trunkH = Math.max(10, feature.heightM * SCALE * 0.34);
            const crownR = Math.max(4, feature.radiusM * SCALE);
            const trunkGeo = new THREE.CylinderGeometry(Math.max(0.45, crownR * 0.12), Math.max(0.55, crownR * 0.16), trunkH, 8);
            const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6b5541, roughness: 0.9 });
            const trunk = new THREE.Mesh(trunkGeo, trunkMat);
            trunk.position.set(p.x, baseY + trunkH / 2, p.z);
            trunk.castShadow = true;
            trunk.receiveShadow = true;
            group.add(trunk);
            const crownGeo = new THREE.SphereGeometry(crownR, 16, 10);
            const crownMat = new THREE.MeshStandardMaterial({
                color: 0x496f48,
                transparent: true,
                opacity: 0.82,
                roughness: 0.95
            });
            const crown = new THREE.Mesh(crownGeo, crownMat);
            crown.scale.y = 0.72;
            crown.position.set(p.x, baseY + trunkH + crownR * 0.42, p.z);
            crown.castShadow = true;
            crown.receiveShadow = true;
            group.add(crown);
            group.userData.urbanFeature = true;
            return group;
        }

        function createNeighborhoodFeatureMesh(feature, observerHeightM) {
            if(!feature) return null;
            if(feature.kind === 'road') return createNeighborhoodRoadMesh(feature, observerHeightM);
            if(feature.kind === 'tree') return createNeighborhoodTreeMesh(feature, observerHeightM);
            return null;
        }

        function createNeighborhoodSatelliteGroundGroup(neighborhood, observerHeightM) {
            if(!neighborhood || !neighborhood.enabled || !neighborhood.showSatellite) return null;
            const tiles = getSatelliteTileEntries(neighborhood);
            if(!tiles.length) return null;
            const eye = getNeighborhoodMapOrigin2D(neighborhood);
            const SCALE = 10;
            const baseY = -observerHeightM * SCALE + 0.01;
            const group = new THREE.Group();
            group.name = 'Photo satellite';
            tiles.forEach(tile => {
                const image = getSatelliteTileImage(tile);
                const nw = tileToLngLat(tile.x, tile.y, tile.z);
                const se = tileToLngLat(tile.x + 1, tile.y + 1, tile.z);
                const p1 = projectLngLatToNeighborhoodMeters(nw.lon, nw.lat, neighborhood.lon, neighborhood.lat);
                const p2 = projectLngLatToNeighborhoodMeters(se.lon, se.lat, neighborhood.lon, neighborhood.lat);
                const width = Math.abs(p2.x - p1.x) * SCALE;
                const depth = Math.abs(p2.z - p1.z) * SCALE;
                if(width <= 0 || depth <= 0) return;
                const texture = new THREE.CanvasTexture(image);
                if(typeof THREE.SRGBColorSpace !== 'undefined') texture.colorSpace = THREE.SRGBColorSpace;
                else if(typeof THREE.sRGBEncoding !== 'undefined') texture.encoding = THREE.sRGBEncoding;
                texture.needsUpdate = !!(image.complete && image.naturalWidth);
                image.onload = () => {
                    texture.needsUpdate = true;
                    if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
                    if(typeof draw2D === 'function') draw2D();
                };
                const material = new THREE.MeshBasicMaterial({
                    map: texture,
                    transparent: true,
                    opacity: 0.48,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                const geometry = new THREE.PlaneGeometry(width, depth);
                const mesh = new THREE.Mesh(geometry, material);
                mesh.rotation.x = -Math.PI / 2;
                mesh.position.set(
                    eye.x / 20 + ((p1.x + p2.x) / 2) * SCALE,
                    baseY,
                    eye.y / 20 + ((p1.z + p2.z) / 2) * SCALE
                );
                mesh.renderOrder = -5;
                mesh.userData.satelliteTile = true;
                group.add(mesh);
            });
            return group.children.length ? group : null;
        }

        function createNeighborhoodStreetGroundGrid(neighborhood, observerHeightM) {
            if(!neighborhood || !neighborhood.enabled) return null;
            const eye = getNeighborhoodMapOrigin2D(neighborhood);
            const SCALE = 10;
            const atStreetLevel = observerHeightM <= 0.05;
            const streetY = -observerHeightM * SCALE + (atStreetLevel ? -0.018 : 0.018);
            const group = new THREE.Group();
            group.name = 'Niveau rue et bâtiments';
            const importRadiusM = Number(neighborhood.radiusM) || 160;
            const radius = Math.min(650, Math.max(90, importRadiusM * 1.65 + 60)) * SCALE;
            const baseGeo = new THREE.CircleGeometry(radius, 96);
            baseGeo.rotateX(-Math.PI / 2);
            const baseMat = new THREE.MeshBasicMaterial({
                color: 0xb9ad93,
                transparent: true,
                opacity: 0.026,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const basePlane = new THREE.Mesh(baseGeo, baseMat);
            basePlane.position.set(eye.x / 20, streetY, eye.y / 20);
            basePlane.receiveShadow = false;
            basePlane.renderOrder = -43;
            group.add(basePlane);

            const shadowCenterX = Number.isFinite(balconyOffsetX) ? balconyOffsetX : eye.x / 20;
            const shadowCenterZ = Number.isFinite(balconyOffsetZ) ? balconyOffsetZ : eye.y / 20;
            const shadowGeo = new THREE.CircleGeometry(radius, 96);
            shadowGeo.rotateX(-Math.PI / 2);
            const shadowMat = new THREE.ShadowMaterial({
                color: 0x000000,
                transparent: true,
                opacity: 0.34,
                side: THREE.DoubleSide,
                depthWrite: false
            });
            const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
            shadowPlane.position.set(shadowCenterX, streetY + 0.012, shadowCenterZ);
            shadowPlane.castShadow = false;
            shadowPlane.receiveShadow = true;
            shadowPlane.renderOrder = -42;
            shadowPlane.userData.neighborhoodShadowReceiver = true;
            group.add(shadowPlane);

            if(!atStreetLevel) {
                const markerX = Number.isFinite(balconyOffsetX) ? balconyOffsetX : 0;
                const markerZ = Number.isFinite(balconyOffsetZ) ? balconyOffsetZ : 0;
                const markerGeo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(markerX, streetY, markerZ),
                    new THREE.Vector3(markerX, -0.02, markerZ)
                ]);
                const markerMat = new THREE.LineBasicMaterial({ color: 0xb9ad93, transparent: true, opacity: 0.24, depthWrite: false });
                const marker = new THREE.Line(markerGeo, markerMat);
                marker.renderOrder = 12;
                group.add(marker);

                const ringMat = new THREE.MeshBasicMaterial({ color: 0xb9ad93, transparent: true, opacity: 0.18, side: THREE.DoubleSide, depthWrite: false });
                [streetY, -0.02].forEach(y => {
                    const ringGeo = new THREE.RingGeometry(0.75, 0.84, 40);
                    ringGeo.rotateX(-Math.PI / 2);
                    const ring = new THREE.Mesh(ringGeo, ringMat);
                    ring.position.set(markerX, y, markerZ);
                    ring.renderOrder = 11;
                    group.add(ring);
                });
            }
            return group.children.length ? group : null;
        }

        function createNeighborhoodGroup() {
            const neighborhood = ensureNeighborhoodMapOrigin2D();
            if(!neighborhood.enabled || !neighborhood.buildings.length) return null;
            const group = new THREE.Group();
            group.name = 'Voisinage importe';
            group.userData.neighborhoodBuildings = true;
            const observerHeightM = neighborhood.floor * neighborhood.floorHeightM;
            const streetGrid = createNeighborhoodStreetGroundGrid(neighborhood, observerHeightM);
            if(streetGrid) group.add(streetGrid);
            const satelliteGroup = createNeighborhoodSatelliteGroundGroup(neighborhood, observerHeightM);
            if(satelliteGroup) group.add(satelliteGroup);
            neighborhood.buildings.forEach(building => {
                const mesh = createNeighborhoodBuildingMesh(building, observerHeightM);
                if(mesh) group.add(mesh);
            });
            if(neighborhood.showUrbanFeatures) {
                neighborhood.features.forEach(feature => {
                    const mesh = createNeighborhoodFeatureMesh(feature, observerHeightM);
                    if(mesh) group.add(mesh);
                });
            }
            return group.children.length ? group : null;
        }

        function addHorizonGroundGuides(group) {
            const eye = getHorizonViewpoint2D();
            const eyeX = eye.x / 20;
            const eyeZ = eye.y / 20;
            const guideGroup = new THREE.Group();
            guideGroup.name = 'Boussole horizon sol';
            const lineMat = new THREE.LineBasicMaterial({ color: 0xb9ad93, transparent: true, opacity: 0.16 });
            const mutedMat = new THREE.LineBasicMaterial({ color: 0xd8e5ff, transparent: true, opacity: 0.16 });
            const balconyRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            [-90, -60, -30, 0, 30, 60, 90].forEach(deg => {
                const a = deg * Math.PI / 180 - balconyRot;
                const x = eyeX + Math.sin(a) * 80;
                const z = eyeZ + Math.cos(a) * 80;
                const geo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(eyeX, 0.025, eyeZ),
                    new THREE.Vector3(x, 0.025, z)
                ]);
                guideGroup.add(new THREE.Line(geo, deg === 0 ? lineMat : mutedMat));
            });
            const ringGeo = new THREE.RingGeometry(1.1, 1.18, 64);
            ringGeo.rotateX(-Math.PI / 2);
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xb9ad93, transparent: true, opacity: 0.16, side: THREE.DoubleSide });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.set(eyeX, 0.03, eyeZ);
            guideGroup.add(ring);
            group.add(guideGroup);
        }

        function adjustHorizonAzimuthsForRotation(oldDeg, newDeg) {
            const delta = newDeg - oldDeg;
            if(Math.abs(delta) < 1e-6) return;
            function shiftPoints(points) {
                return (points || []).map(p => ({ ...p, azimut: signedAngleDiffDeg(p.azimut + delta, 0) }));
            }
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonSettings.silhouettes = horizonSettings.silhouettes.map(shape => ({ ...shape, points: shiftPoints(shape.points) }));
            if(horizonSettings.points) horizonSettings.points = shiftPoints(horizonSettings.points);
            horizonDraftPoints = shiftPoints(horizonDraftPoints);
        }

        let neighborhoodCutoutRebuildScheduled = false;
        function scheduleNeighborhoodCutoutRebuild() {
            if(neighborhoodCutoutRebuildScheduled || !horizonGroup) return;
            const neighborhood = normalizeNeighborhoodSettings((horizonSettings && horizonSettings.neighborhood) || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) return;
            neighborhoodCutoutRebuildScheduled = true;
            requestAnimationFrame(() => {
                neighborhoodCutoutRebuildScheduled = false;
                if(typeof rebuildHorizonWall === 'function') rebuildHorizonWall();
            });
        }

        function rebuildHorizonWall() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonActiveSilhouetteIndex = horizonSettings.activeSilhouetteIndex || 0;
            horizonActiveDistanceM = horizonSettings.activeDistanceM || 20;
            horizonDraftMesh = null;
            if(!horizonGroup) return;
            while(horizonGroup.children.length) {
                const child = horizonGroup.children.pop();
                disposeObject3D(child);
            }
            addHorizonGroundGuides(horizonGroup);
            if(!horizonSettings.enabled) {
                updateHorizonUI();
                markSolarMapDirty();
                renderCurrent3DFrame();
                return;
            }
            horizonSettings.silhouettes.forEach((shape, index) => {
                const mesh = createHorizonWallMesh(shape.points, {
                    ...horizonSettings,
                    distanceM: shape.distanceM,
                    name: shape.name,
                    color: index === horizonActiveSilhouetteIndex ? 0x1a1a1a : 0x2a2018,
                    opacity: index === horizonActiveSilhouetteIndex ? 0.48 : 0.34
                });
                if(mesh) horizonGroup.add(mesh);
            });
            const neighborhoodGroup = createNeighborhoodGroup();
            if(neighborhoodGroup) horizonGroup.add(neighborhoodGroup);
            updateShadowCamera();
            updateHorizonUI();
            markSolarMapDirty();
            renderCurrent3DFrame();
        }

        function disposeHorizonDraftMesh() {
            if(!horizonDraftMesh) return;
            if(horizonDraftMesh.parent) horizonDraftMesh.parent.remove(horizonDraftMesh);
            if(horizonDraftMesh.geometry) horizonDraftMesh.geometry.dispose();
            if(horizonDraftMesh.material) horizonDraftMesh.material.dispose();
            horizonDraftMesh = null;
        }

        function updateHorizonDraftMesh() {
            if(!horizonGroup) return;
            disposeHorizonDraftMesh();
            if(!horizonTraceMode || horizonDraftPoints.length < 2) return;
            horizonDraftMesh = createHorizonWallMesh(horizonDraftPoints, {
                ...horizonSettings,
                distanceM: HORIZON_DOME_RADIUS_M,
                name: 'Masque solaire en cours',
                color: 0x0b0b0b,
                opacity: 0.56
            });
            if(horizonDraftMesh) horizonGroup.add(horizonDraftMesh);
        }

        function horizonPointsToText(points = horizonSettings.points) {
            const shapes = horizonSettings.silhouettes || [];
            if(shapes.length) {
                return shapes.map(shape => {
                    const body = (shape.points || []).map(p => `${Math.round(p.azimut * 10) / 10}, ${Math.round(p.elevation * 10) / 10}`).join('\n');
                    return `distance ${Math.round(shape.distanceM * 10) / 10}m\n${body}`;
                }).join('\n\n');
            }
            return (points || []).map(p => `${Math.round(p.azimut * 10) / 10}, ${Math.round(p.elevation * 10) / 10}`).join('\n');
        }

        function parseHorizonPointsText(text) {
            return String(text || '').split(/\n+/).map(line => {
                const parts = line.trim().split(/[;,\s]+/).filter(Boolean);
                if(parts.length < 2) return null;
                return normalizeHorizonPoint({
                    azimut: parseFloat(parts[0].replace(',', '.')),
                    elevation: parseFloat(parts[1].replace(',', '.'))
                });
            }).filter(Boolean);
        }

        function parseHorizonSilhouettesText(text) {
            const blocks = String(text || '').split(/\n\s*\n+/).map(block => block.trim()).filter(Boolean);
            const silhouettes = [];
            blocks.forEach((block, index) => {
                const lines = block.split(/\n+/).map(line => line.trim()).filter(Boolean);
                let distanceM = horizonSettings.activeDistanceM || horizonActiveDistanceM || 20;
                if(lines[0] && /^distance/i.test(lines[0])) {
                    const match = lines[0].match(/([-+]?\d+(?:[.,]\d+)?)/);
                    if(match) distanceM = parseFloat(match[1].replace(',', '.'));
                    lines.shift();
                }
                const points = parseHorizonPointsText(lines.join('\n'));
                if(points.length >= 2) silhouettes.push(normalizeHorizonSilhouette({ name: 'Obstacle ' + (index + 1), distanceM, points }, index, distanceM));
            });
            if(!silhouettes.length) {
                const points = parseHorizonPointsText(text);
                if(points.length >= 2) silhouettes.push(normalizeHorizonSilhouette({ name: 'Obstacle 1', distanceM: horizonActiveDistanceM || 20, points }, 0, horizonActiveDistanceM || 20));
            }
            return silhouettes;
        }

        function updateHorizonUI() {
            const panel = document.getElementById('horizon-panel-2d');
            const btn = document.getElementById('btn-horizon');
            const radiusInput = document.getElementById('horizon-radius-input');
            const eyeInput = document.getElementById('horizon-eye-input');
            const textInput = document.getElementById('horizon-points-input');
            const distanceInput = document.getElementById('horizon-active-distance-input');
            const list = document.getElementById('horizon-silhouette-list');
            const addressInput = document.getElementById('horizon-address-input');
            const floorInput = document.getElementById('horizon-floor-input');
            const neighborhoodRadiusInput = document.getElementById('horizon-radius-neighborhood-input');
            const footprintsInput = document.getElementById('horizon-footprints-toggle');
            const satelliteInput = document.getElementById('horizon-satellite-toggle');
            const urbanFeaturesInput = document.getElementById('horizon-urban-features-toggle');
            const supportSelect = document.getElementById('horizon-support-building-select');
            const supportSideSelect = document.getElementById('horizon-support-side-select');
            const supportWidthInput = document.getElementById('horizon-support-width-input');
            const supportDepthInput = document.getElementById('horizon-support-depth-input');
            const supportStatus = document.getElementById('horizon-support-status');
            const neighborhoodStatus = document.getElementById('horizon-neighborhood-status');
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(panel) panel.classList.toggle('visible', horizonPanelOpen);
            if(btn) btn.classList.toggle('active', horizonDrawOpen || horizonPanelOpen || horizonSettings.enabled);
            if(radiusInput) radiusInput.value = horizonSettings.radiusM;
            if(eyeInput) eyeInput.value = horizonSettings.eyeHeightM;
            if(distanceInput && document.activeElement !== distanceInput) distanceInput.value = Math.round((horizonActiveDistanceM || horizonSettings.activeDistanceM || 20) * 10) / 10;
            if(textInput && document.activeElement !== textInput) textInput.value = horizonPointsToText();
            if(addressInput && document.activeElement !== addressInput) addressInput.value = neighborhood.address || '';
            if(floorInput && document.activeElement !== floorInput) floorInput.value = neighborhood.floor;
            if(neighborhoodRadiusInput && document.activeElement !== neighborhoodRadiusInput) neighborhoodRadiusInput.value = neighborhood.radiusM;
            if(footprintsInput) footprintsInput.checked = !!neighborhood.showFootprints;
            if(satelliteInput) satelliteInput.checked = !!neighborhood.showSatellite;
            if(urbanFeaturesInput) urbanFeaturesInput.checked = !!neighborhood.showUrbanFeatures;
            if(supportSelect && document.activeElement !== supportSelect) {
                supportSelect.innerHTML = neighborhood.buildings.length
                    ? neighborhood.buildings.map((building, index) => {
                        const label = (building.name || ('Bâtiment ' + (index + 1))).slice(0, 54);
                        const selected = building.id === neighborhood.supportBuildingId ? ' selected' : '';
                        return '<option value="' + String(building.id).replace(/"/g, '&quot;') + '"' + selected + '>' + label.replace(/</g, '&lt;') + '</option>';
                    }).join('')
                    : '<option value="">Importer d’abord</option>';
            }
            if(supportSideSelect && document.activeElement !== supportSideSelect) supportSideSelect.value = neighborhood.supportSide;
            if(supportWidthInput && document.activeElement !== supportWidthInput) supportWidthInput.value = neighborhood.supportWidthM;
            if(supportDepthInput && document.activeElement !== supportDepthInput) supportDepthInput.value = neighborhood.supportDepthM;
            if(supportStatus) {
                const support = getNeighborhoodSupportBuilding(neighborhood);
                supportStatus.textContent = support
                    ? 'Support actif : ' + (support.name || support.id) + ' · ' + Math.round((support.heightM || 0) * 10) / 10 + ' m. Ce bâtiment masque les vis-à-vis derrière lui.'
                    : (neighborhood.buildings.length ? 'Choisis un bâtiment support.' : '');
            }
            if(neighborhoodStatus && !neighborhoodStatus.dataset.busy) {
                neighborhoodStatus.textContent = neighborhood.buildings.length ? getNeighborhoodHeightWarningMessage(neighborhood) : '';
            }
            if(list) {
                list.innerHTML = '';
                (horizonSettings.silhouettes || []).forEach((shape, index) => {
                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = index === horizonActiveSilhouetteIndex ? 'active' : '';
                    button.textContent = Math.round(shape.distanceM) + ' m';
                    button.onclick = () => selectHorizonSilhouette(index);
                    list.appendChild(button);
                });
            }
        }

        function toggleHorizonPanel(force) {
            horizonPanelOpen = typeof force === 'boolean' ? force : !horizonPanelOpen;
            if(horizonPanelOpen && activeMainView === '2d') setMainView('mixte', { skipValidation: true });
            updateHorizonUI();
        }

        function initHorizonDrawCanvas() {
            if(horizonDrawCanvas) return;
            horizonDrawCanvas = document.getElementById('horizon-draw-canvas');
            if(!horizonDrawCanvas) return;
            horizonDrawCtx = horizonDrawCanvas.getContext('2d');
            horizonDrawCanvas.addEventListener('pointerdown', handleHorizonDrawPointerDown);
            horizonDrawCanvas.addEventListener('pointermove', handleHorizonDrawPointerMove);
            horizonDrawCanvas.addEventListener('pointerup', handleHorizonDrawPointerUp);
            horizonDrawCanvas.addEventListener('pointercancel', handleHorizonDrawPointerUp);
        }

        function handleHorizonKeyDown(event) {
            if(!horizonDrawOpen) return;
            if(event.key === 'Escape') {
                if(horizonTraceMode) {
                    if(horizonDraftPoints.length >= 2) validateHorizonDrawing();
                    horizonTraceMode = false;
                    updateHorizonTraceModeUI();
                    drawHorizonPanorama();
                }
                return;
            }
            if(event.key === 'ArrowLeft') {
                event.preventDefault();
                rotateHorizonManualView(10);
            } else if(event.key === 'ArrowRight') {
                event.preventDefault();
                rotateHorizonManualView(-10);
            }
        }

        function openHorizonDrawView() {
            initHorizonDrawCanvas();
            const view = document.getElementById('horizon-draw-view');
            if(!view || !horizonDrawCanvas) return;
            horizonDrawOpen = true;
            horizonPanelOpen = false;
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonActiveSilhouetteIndex = horizonSettings.activeSilhouetteIndex || 0;
            horizonTraceMode = false;
            horizonManualAzimuthDeg = 0;
            horizonManualElevationDeg = 0;
            const activeShape = horizonSettings.silhouettes[horizonActiveSilhouetteIndex];
            horizonActiveDistanceM = HORIZON_DOME_RADIUS_M;
            horizonSettings.activeDistanceM = HORIZON_DOME_RADIUS_M;
            if(activeShape) activeShape.distanceM = HORIZON_DOME_RADIUS_M;
            horizonDraftPoints = activeShape ? (activeShape.points || []).map(p => ({ ...p })) : [];
            horizonCurrentStrokePoints = [];
            disposeHorizonDraftMesh();
            document.removeEventListener('keydown', handleHorizonKeyDown);
            document.addEventListener('keydown', handleHorizonKeyDown);
            view.classList.add('visible');
            view.setAttribute('aria-hidden', 'false');
            updateHorizonUI();
            updateHorizonTraceModeUI();
            resizeHorizonDrawCanvas();
            drawHorizonPanorama();
        }

        function closeHorizonDrawView() {
            const view = document.getElementById('horizon-draw-view');
            horizonDrawOpen = false;
            horizonDrawActive = false;
            horizonTraceMode = false;
            disposeHorizonDraftMesh();
            stopHorizonCamera();
            stopHorizonSensors();
            document.removeEventListener('keydown', handleHorizonKeyDown);
            if(view) {
                view.classList.remove('visible');
                view.setAttribute('aria-hidden', 'true');
            }
            updateHorizonUI();
            updateHorizonTraceModeUI();
        }

        async function startHorizonCamera() {
            if(horizonCameraStream) return true;
            if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                alert("La caméra n'est pas disponible dans ce navigateur.");
                return false;
            }
            const video = document.getElementById('horizon-camera-video');
            if(!video) return false;
            try {
                const stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: 'environment' },
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    },
                    audio: false
                });
                horizonCameraStream = stream;
                horizonCameraActive = true;
                video.srcObject = stream;
                video.classList.add('visible');
                const btn = document.getElementById('btn-horizon-camera');
                if(btn) btn.classList.add('active');
                drawHorizonPanorama();
                return true;
            } catch(err) {
                alert("Impossible d'activer la caméra. Sur smartphone, ouvre l'app en HTTPS ou localhost et autorise la caméra.");
                horizonCameraActive = false;
                return false;
            }
        }

        function stopHorizonCamera() {
            if(horizonCameraStream) {
                horizonCameraStream.getTracks().forEach(track => track.stop());
            }
            horizonCameraStream = null;
            horizonCameraActive = false;
            const video = document.getElementById('horizon-camera-video');
            if(video) {
                video.srcObject = null;
                video.classList.remove('visible');
            }
            const btn = document.getElementById('btn-horizon-camera');
            if(btn) btn.classList.remove('active');
            if(horizonDrawOpen) drawHorizonPanorama();
        }

        async function toggleHorizonCamera() {
            if(horizonCameraActive) {
                stopHorizonCamera();
                return;
            }
            await startHorizonCamera();
        }

        function normalizeCompassDeg(value) {
            const n = Number(value);
            if(!Number.isFinite(n)) return null;
            return ((n % 360) + 360) % 360;
        }

        function getCurrentScreenAngleDeg() {
            const orientation = screen.orientation || screen.mozOrientation || screen.msOrientation;
            if(orientation && typeof orientation.angle === 'number') return orientation.angle;
            if(typeof window.orientation === 'number') return window.orientation;
            return 0;
        }

        function getDeviceAimFromOrientation(event) {
            if(typeof event.alpha !== 'number' || typeof event.beta !== 'number' || typeof event.gamma !== 'number') return null;
            const deg = Math.PI / 180;
            const zee = new THREE.Vector3(0, 0, 1);
            const euler = new THREE.Euler();
            const q = new THREE.Quaternion();
            const qScreen = new THREE.Quaternion();
            const qCamera = new THREE.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5));
            euler.set(event.beta * deg, event.alpha * deg, -event.gamma * deg, 'YXZ');
            q.setFromEuler(euler);
            q.multiply(qCamera);
            q.multiply(qScreen.setFromAxisAngle(zee, -getCurrentScreenAngleDeg() * deg));
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(q);
            const horizontal = Math.hypot(forward.x, forward.z);
            const pitchDeg = Math.atan2(forward.y, Math.max(0.0001, horizontal)) / deg;
            const headingDeg = normalizeCompassDeg(-Math.atan2(forward.x, -forward.z) / deg);
            const rollDeg = Math.max(-90, Math.min(90, event.gamma || 0));
            return { headingDeg, pitchDeg, rollDeg };
        }

        function signedAngleDiffDeg(angle, origin) {
            return ((((angle - origin) % 360) + 540) % 360) - 180;
        }

        function getHorizonCenterAzimuth() {
            if(horizonSensorsActive && horizonCompassHeadingDeg !== null) {
                return signedAngleDiffDeg(180, horizonCompassHeadingDeg);
            }
            return horizonManualAzimuthDeg;
        }

        function getHorizonVisibleHalfFov() {
            return horizonSensorsActive && horizonCompassHeadingDeg !== null ? HORIZON_CAMERA_FOV_DEG / 2 : 42;
        }

        function getHorizonVisibleHalfVerticalFov() {
            return horizonSensorsActive && horizonDevicePitchDeg !== null ? HORIZON_CAMERA_VERTICAL_FOV_DEG / 2 : 34;
        }

        function getHorizonCenterElevation() {
            if(horizonSensorsActive && horizonDevicePitchDeg !== null) {
                return Math.max(-45, Math.min(75, horizonDevicePitchDeg - horizonPitchZeroDeg));
            }
            return horizonManualElevationDeg;
        }

        function rotateHorizonManualView(deltaDeg) {
            if(horizonSensorsActive) return;
            horizonManualAzimuthDeg = signedAngleDiffDeg(horizonManualAzimuthDeg + deltaDeg, 0);
            drawHorizonPanorama();
        }

        function toggleHorizonTraceMode() {
            horizonTraceMode = !horizonTraceMode;
            if(horizonTraceMode) updateHorizonDraftMesh();
            else disposeHorizonDraftMesh();
            updateHorizonTraceModeUI();
            drawHorizonPanorama();
        }

        function updateHorizonTraceModeUI() {
            const btn = document.getElementById('btn-horizon-trace');
            if(btn) btn.classList.toggle('active', !!horizonTraceMode);
            if(horizonDrawCanvas) horizonDrawCanvas.style.cursor = horizonTraceMode ? 'crosshair' : 'grab';
        }

        function updateHorizonActiveDistance(value) {
            const parsed = HORIZON_DOME_RADIUS_M;
            horizonActiveDistanceM = parsed;
            horizonSettings.activeDistanceM = parsed;
            const activeShape = horizonSettings.silhouettes && horizonSettings.silhouettes[horizonActiveSilhouetteIndex];
            if(activeShape && !horizonDraftPoints.length) activeShape.distanceM = parsed;
            updateHorizonUI();
            drawHorizonPanorama();
        }

        function selectHorizonSilhouette(index) {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            if(index < 0 || index >= horizonSettings.silhouettes.length) return;
            horizonActiveSilhouetteIndex = index;
            horizonSettings.activeSilhouetteIndex = index;
            const shape = horizonSettings.silhouettes[index];
            horizonActiveDistanceM = shape.distanceM;
            horizonSettings.activeDistanceM = shape.distanceM;
            horizonDraftPoints = (shape.points || []).map(p => ({ ...p }));
            horizonCurrentStrokePoints = [];
            disposeHorizonDraftMesh();
            updateHorizonUI();
            drawHorizonPanorama();
            rebuildHorizonWall();
        }

        function addNewHorizonSilhouette() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonActiveSilhouetteIndex = horizonSettings.silhouettes.length;
            horizonSettings.activeSilhouetteIndex = horizonActiveSilhouetteIndex;
            horizonSettings.activeDistanceM = horizonActiveDistanceM || 20;
            horizonDraftPoints = [];
            horizonCurrentStrokePoints = [];
            disposeHorizonDraftMesh();
            updateHorizonUI();
            drawHorizonPanorama();
        }

        function getHorizonSensorLabel() {
            if(!horizonSensorsActive) return 'Vue 3D manuelle - distance active ' + Math.round((horizonActiveDistanceM || 20) * 10) / 10 + ' m';
            if(horizonCompassHeadingDeg === null) return 'Capteurs actifs - cap en attente';
            const az = getHorizonCenterAzimuth();
            const el = horizonDevicePitchDeg === null ? '' : ' | élév. ' + Math.round(getHorizonCenterElevation()) + '°';
            return 'AR balcon | cap ' + Math.round(horizonCompassHeadingDeg) + '° | ' + (az >= 0 ? '+' : '') + Math.round(az) + '° du Sud' + el;
        }

        function updateHorizonSensorUI() {
            const btn = document.getElementById('btn-horizon-sensors');
            if(btn) btn.classList.toggle('active', horizonSensorsActive);
        }

        function scheduleHorizonSensorRedraw() {
            if(horizonSensorRedrawPending) return;
            horizonSensorRedrawPending = true;
            requestAnimationFrame(() => {
                horizonSensorRedrawPending = false;
                updateHorizonSensorUI();
                if(horizonDrawOpen) drawHorizonPanorama();
            });
        }

        function handleHorizonDeviceOrientation(event) {
            let heading = null;
            if(typeof event.webkitCompassHeading === 'number') {
                heading = 360 - event.webkitCompassHeading;
            } else if(typeof event.alpha === 'number') {
                heading = event.alpha - getCurrentScreenAngleDeg();
            }
            const aim = getDeviceAimFromOrientation(event);
            if(aim && typeof event.webkitCompassHeading !== 'number') heading = aim.headingDeg;
            const normalizedHeading = normalizeCompassDeg(heading);
            if(normalizedHeading !== null) horizonCompassHeadingDeg = normalizedHeading;
            if(aim) {
                horizonDevicePitchDeg = Math.max(-90, Math.min(90, aim.pitchDeg));
                horizonDeviceRollDeg = aim.rollDeg || 0;
            } else if(typeof event.beta === 'number') {
                horizonDevicePitchDeg = Math.max(-90, Math.min(90, 90 - event.beta));
                horizonDeviceRollDeg = typeof event.gamma === 'number' ? event.gamma : 0;
            }
            scheduleHorizonSensorRedraw();
        }

        async function startHorizonSensors() {
            if(horizonSensorsActive) return true;
            if(!window.DeviceOrientationEvent) {
                alert("Les capteurs d'orientation ne sont pas disponibles dans ce navigateur.");
                return false;
            }
            try {
                if(typeof DeviceOrientationEvent.requestPermission === 'function') {
                    const permission = await DeviceOrientationEvent.requestPermission();
                    if(permission !== 'granted') {
                        alert("Autorise les capteurs de mouvement pour caler la grille sur le Sud réel.");
                        return false;
                    }
                }
                horizonSensorsActive = true;
                horizonScreenAngleDeg = getCurrentScreenAngleDeg();
                window.addEventListener('deviceorientation', handleHorizonDeviceOrientation, true);
                window.addEventListener('orientationchange', handleHorizonScreenOrientationChange, true);
                if(screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', handleHorizonScreenOrientationChange);
                updateHorizonSensorUI();
                drawHorizonPanorama();
                return true;
            } catch(err) {
                alert("Impossible d'activer les capteurs. Sur iPhone, il faut ouvrir l'app en HTTPS et autoriser mouvement/orientation.");
                horizonSensorsActive = false;
                updateHorizonSensorUI();
                return false;
            }
        }

        function stopHorizonSensors() {
            window.removeEventListener('deviceorientation', handleHorizonDeviceOrientation, true);
            window.removeEventListener('orientationchange', handleHorizonScreenOrientationChange, true);
            if(screen.orientation && screen.orientation.removeEventListener) screen.orientation.removeEventListener('change', handleHorizonScreenOrientationChange);
            horizonSensorsActive = false;
            horizonCompassHeadingDeg = null;
            horizonDevicePitchDeg = null;
            horizonDeviceRollDeg = 0;
            updateHorizonSensorUI();
            if(horizonDrawOpen) drawHorizonPanorama();
        }

        function handleHorizonScreenOrientationChange() {
            horizonScreenAngleDeg = getCurrentScreenAngleDeg();
            scheduleHorizonSensorRedraw();
        }

        async function toggleHorizonSensors() {
            if(horizonSensorsActive) {
                stopHorizonSensors();
                return;
            }
            await startHorizonSensors();
        }

        function calibrateHorizonLevel() {
            if(horizonDevicePitchDeg === null) {
                alert("Active d'abord les capteurs, puis vise l'horizon réel au centre de l'écran.");
                return;
            }
            horizonPitchZeroDeg = horizonDevicePitchDeg;
            updateHorizonSensorUI();
            drawHorizonPanorama();
        }

        function resizeHorizonDrawCanvas() {
            if(!horizonDrawCanvas) return;
            const rect = horizonDrawCanvas.getBoundingClientRect();
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            horizonDrawCanvas.width = Math.max(1, Math.round(rect.width * dpr));
            horizonDrawCanvas.height = Math.max(1, Math.round(rect.height * dpr));
            horizonDrawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        const HORIZON_VIEW_MIN_ELEVATION = -25;
        const HORIZON_VIEW_MAX_ELEVATION = 90;

        function horizonElevationToCanvasY(elevation, height) {
            if(horizonSensorsActive && horizonDevicePitchDeg !== null) {
                const centerElevation = getHorizonCenterElevation();
                const halfVerticalFov = getHorizonVisibleHalfVerticalFov();
                const relativeElevation = (Number(elevation) || 0) - centerElevation;
                return (0.5 - relativeElevation / Math.max(1, halfVerticalFov * 2)) * height;
            }
            const clamped = Math.max(HORIZON_VIEW_MIN_ELEVATION, Math.min(HORIZON_VIEW_MAX_ELEVATION, Number(elevation) || 0));
            return ((HORIZON_VIEW_MAX_ELEVATION - clamped) / (HORIZON_VIEW_MAX_ELEVATION - HORIZON_VIEW_MIN_ELEVATION)) * height;
        }

        function horizonCanvasYToElevation(y, height) {
            if(horizonSensorsActive && horizonDevicePitchDeg !== null) {
                const centerElevation = getHorizonCenterElevation();
                const halfVerticalFov = getHorizonVisibleHalfVerticalFov();
                const t = Math.max(0, Math.min(1, y / Math.max(1, height)));
                return centerElevation + (0.5 - t) * halfVerticalFov * 2;
            }
            const t = Math.max(0, Math.min(1, y / Math.max(1, height)));
            return HORIZON_VIEW_MAX_ELEVATION - t * (HORIZON_VIEW_MAX_ELEVATION - HORIZON_VIEW_MIN_ELEVATION);
        }

        function getHorizonRenderVerticalFovDeg() {
            if(horizonSensorsActive && horizonDevicePitchDeg !== null) {
                return Math.max(35, Math.min(82, getHorizonVisibleHalfVerticalFov() * 2));
            }
            return INTERIOR_CAMERA_FOV_DEG;
        }

        function getHorizonLocalCameraFrame() {
            const az = getHorizonCenterAzimuth() * Math.PI / 180;
            const el = getHorizonCenterElevation() * Math.PI / 180;
            const forward = new THREE.Vector3(
                -Math.sin(az) * Math.cos(el),
                Math.sin(el),
                Math.cos(az) * Math.cos(el)
            ).normalize();
            let right = new THREE.Vector3(forward.z, 0, -forward.x);
            if(right.lengthSq() < 0.0001) right.set(1, 0, 0);
            right.normalize();
            const up = new THREE.Vector3().crossVectors(forward, right).normalize();
            return { forward, right, up };
        }

        function horizonLocalDirectionToWorld(direction) {
            const southRotation = ((balconyWorldOrientationDeg - 180) % 360) * Math.PI / 180;
            return new THREE.Vector3(
                direction.x * Math.cos(southRotation) - direction.z * Math.sin(southRotation),
                direction.y,
                direction.x * Math.sin(southRotation) + direction.z * Math.cos(southRotation)
            ).normalize();
        }

        function horizonCanvasPointToAngles(clientX, clientY) {
            const rect = horizonDrawCanvas.getBoundingClientRect();
            const x = Math.max(0, Math.min(rect.width, clientX - rect.left));
            const y = Math.max(0, Math.min(rect.height, clientY - rect.top));
            const ndcX = 1 - (x / Math.max(1, rect.width)) * 2;
            const ndcY = 1 - (y / Math.max(1, rect.height)) * 2;
            const aspect = Math.max(0.1, rect.width / Math.max(1, rect.height));
            const tanHalfVerticalFov = Math.tan((getHorizonRenderVerticalFovDeg() * Math.PI / 180) * 0.5);
            const frame = getHorizonLocalCameraFrame();
            const direction = frame.forward.clone()
                .add(frame.right.clone().multiplyScalar(ndcX * aspect * tanHalfVerticalFov))
                .add(frame.up.clone().multiplyScalar(ndcY * tanHalfVerticalFov))
                .normalize();
            const horizontal = Math.hypot(direction.x, direction.z);
            return {
                azimut: Math.max(-180, Math.min(180, Math.atan2(-direction.x, direction.z) * 180 / Math.PI)),
                elevation: Math.max(0, Math.min(89, Math.atan2(direction.y, Math.max(0.0001, horizontal)) * 180 / Math.PI))
            };
        }

        function horizonAnglesToCanvasPoint(point) {
            const rect = horizonDrawCanvas.getBoundingClientRect();
            const centerAzimut = getHorizonCenterAzimuth();
            const halfFov = getHorizonVisibleHalfFov();
            const relativeAzimut = signedAngleDiffDeg(point.azimut, centerAzimut);
            return {
                x: ((relativeAzimut + halfFov) / Math.max(1, halfFov * 2)) * rect.width,
                y: horizonElevationToCanvasY(point.elevation, rect.height)
            };
        }

        const HORIZON_TRACE_BIN_DEG = 0.35;
        const HORIZON_TRACE_REPLACE_MARGIN_DEG = 0.75;

        function coalesceHorizonTracePoints(points, latestByAzimuth = false) {
            if(latestByAzimuth) {
                const byBucket = new Map();
                (points || []).forEach(point => {
                    const normalized = normalizeHorizonPoint(point);
                    if(!normalized) return;
                    const key = Math.round(normalized.azimut / HORIZON_TRACE_BIN_DEG);
                    byBucket.set(key, normalized);
                });
                return Array.from(byBucket.values()).sort((a, b) => a.azimut - b.azimut);
            }
            const sorted = (points || [])
                .map(normalizeHorizonPoint)
                .filter(Boolean)
                .sort((a, b) => a.azimut - b.azimut);
            const merged = [];
            sorted.forEach(point => {
                const last = merged[merged.length - 1];
                if(last && Math.abs(last.azimut - point.azimut) <= HORIZON_TRACE_BIN_DEG) {
                    last.azimut = point.azimut;
                    last.elevation = point.elevation;
                } else {
                    merged.push({ ...point });
                }
            });
            return merged;
        }

        function mergeCurrentHorizonStrokeIntoDraft() {
            const stroke = coalesceHorizonTracePoints(horizonCurrentStrokePoints, true);
            if(!stroke.length) return;
            const minAz = Math.min(...stroke.map(point => point.azimut)) - HORIZON_TRACE_REPLACE_MARGIN_DEG;
            const maxAz = Math.max(...stroke.map(point => point.azimut)) + HORIZON_TRACE_REPLACE_MARGIN_DEG;
            const preserved = horizonDraftPoints.filter(point => point.azimut < minAz || point.azimut > maxAz);
            horizonDraftPoints = coalesceHorizonTracePoints([...preserved, ...stroke]);
        }

        function addHorizonDraftPoint(point) {
            const normalized = normalizeHorizonPoint(point);
            if(!normalized) return;
            const last = horizonCurrentStrokePoints[horizonCurrentStrokePoints.length - 1];
            if(last && Math.abs(last.azimut - normalized.azimut) < 0.8) {
                last.elevation = normalized.elevation;
            } else {
                if(last) {
                    const deltaAz = signedAngleDiffDeg(normalized.azimut, last.azimut);
                    const deltaElevation = normalized.elevation - last.elevation;
                    const steps = Math.max(
                        1,
                        Math.ceil(Math.abs(deltaAz) / HORIZON_TRACE_BIN_DEG),
                        Math.ceil(Math.abs(deltaElevation) / HORIZON_TRACE_BIN_DEG)
                    );
                    for(let step = 1; step <= steps; step++) {
                        const t = step / steps;
                        horizonCurrentStrokePoints.push({
                            azimut: signedAngleDiffDeg(last.azimut + deltaAz * t, 0),
                            elevation: Math.max(0, Math.min(89, last.elevation + deltaElevation * t))
                        });
                    }
                } else {
                    horizonCurrentStrokePoints.push(normalized);
                }
            }
            mergeCurrentHorizonStrokeIntoDraft();
            updateHorizonDraftMesh();
        }

        function handleHorizonDrawPointerDown(event) {
            if(!horizonDrawCanvas) return;
            event.preventDefault();
            if(!horizonTraceMode && !horizonSensorsActive) {
                horizonLookDragActive = true;
                horizonLookDragLastX = event.clientX;
                horizonLookDragLastY = event.clientY;
                horizonDrawCanvas.setPointerCapture(event.pointerId);
                horizonDrawCanvas.style.cursor = 'grabbing';
                return;
            }
            horizonDrawActive = true;
            horizonCurrentStrokePoints = [];
            horizonDrawCanvas.setPointerCapture(event.pointerId);
            addHorizonDraftPoint(horizonCanvasPointToAngles(event.clientX, event.clientY));
            drawHorizonPanorama();
        }

        function handleHorizonDrawPointerMove(event) {
            if(horizonLookDragActive && horizonDrawCanvas) {
                event.preventDefault();
                const dx = event.clientX - horizonLookDragLastX;
                const dy = event.clientY - horizonLookDragLastY;
                horizonLookDragLastX = event.clientX;
                horizonLookDragLastY = event.clientY;
                horizonManualAzimuthDeg = signedAngleDiffDeg(horizonManualAzimuthDeg + dx * 0.22, 0);
                horizonManualElevationDeg = Math.max(-25, Math.min(75, horizonManualElevationDeg + dy * 0.12));
                drawHorizonPanorama();
                return;
            }
            if(!horizonDrawActive || !horizonDrawCanvas) return;
            event.preventDefault();
            addHorizonDraftPoint(horizonCanvasPointToAngles(event.clientX, event.clientY));
            drawHorizonPanorama();
        }

        function handleHorizonDrawPointerUp(event) {
            const wasDrawing = horizonDrawActive;
            horizonDrawActive = false;
            horizonLookDragActive = false;
            horizonCurrentStrokePoints = [];
            if(horizonDrawCanvas && horizonDrawCanvas.hasPointerCapture(event.pointerId)) {
                horizonDrawCanvas.releasePointerCapture(event.pointerId);
            }
            if(wasDrawing && horizonTraceMode && horizonDraftPoints.length >= 2) {
                validateHorizonDrawing();
            }
            updateHorizonTraceModeUI();
        }

        function getSingleJardiniereViewpoint2D(options = {}) {
            if(!Array.isArray(jardinières) || jardinières.length !== 1) return null;
            const jard = jardinières[0];
            if(!jard || !jard.pos || !Number.isFinite(jard.pos.x) || !Number.isFinite(jard.pos.z)) return null;
            const transformPoint = typeof transformBalconyScenePoint2D === 'function'
                ? transformBalconyScenePoint2D
                : (point) => point;
            return transformPoint({ x: jard.pos.x * 20, y: jard.pos.z * 20 }, options);
        }

        function hasClosedBalconyContour2D() {
            return isContourClosed
                && isSketchValidated
                && typeof getPrimaryContourPolygon2D === 'function'
                && getPrimaryContourPolygon2D().length >= 3;
        }

        function shouldUseSingleJardiniereViewpoint2D() {
            return Array.isArray(jardinières)
                && jardinières.length === 1
                && !hasClosedBalconyContour2D();
        }

        function getHorizonViewpoint2D(options = {}) {
            const polygon = getPrimaryContourPolygon2D();
            const transformPoint = typeof transformBalconyScenePoint2D === 'function'
                ? transformBalconyScenePoint2D
                : (point) => point;
            if(polygon.length >= 3) {
                const sum = polygon.reduce((acc, point) => {
                    acc.x += point.x;
                    acc.y += point.y;
                    return acc;
                }, { x: 0, y: 0 });
                return transformPoint({ x: sum.x / polygon.length, y: sum.y / polygon.length }, options);
            }
            if(shouldUseSingleJardiniereViewpoint2D()) {
                const jardPoint = getSingleJardiniereViewpoint2D(options);
                if(jardPoint) return jardPoint;
            }
            const source = getPrimaryContourSegments().flatMap(s => [s.p1, s.p2]).filter(Boolean);
            if(!source.length) return transformPoint({ x: 0, y: 0 }, options);
            const sum = source.reduce((acc, point) => {
                acc.x += point.x;
                acc.y += point.y;
                return acc;
            }, { x: 0, y: 0 });
            return transformPoint({ x: sum.x / source.length, y: sum.y / source.length }, options);
        }

        function getNeighborhoodMapOrigin2D(neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {})) {
            if(neighborhood && Number.isFinite(neighborhood.mapOriginX) && Number.isFinite(neighborhood.mapOriginY)) {
                return { x: neighborhood.mapOriginX, y: neighborhood.mapOriginY };
            }
            return typeof getHorizonViewpoint2D === 'function'
                ? getHorizonViewpoint2D({ ignoreBalconyTransform: true })
                : { x: 0, y: 0 };
        }

        function ensureNeighborhoodMapOrigin2D() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || (Number.isFinite(neighborhood.mapOriginX) && Number.isFinite(neighborhood.mapOriginY))) return neighborhood;
            const origin = getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...neighborhood,
                mapOriginX: origin.x,
                mapOriginY: origin.y
            });
            return normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
        }

        function worldPointToHorizonLocal(point, eye) {
            const dx = point.x / 20 - eye.x / 20;
            const dz = point.y / 20 - eye.y / 20;
            const southRotation = ((balconyWorldOrientationDeg - 180) % 360) * Math.PI / 180;
            return {
                x: dx * Math.cos(southRotation) + dz * Math.sin(southRotation),
                z: -dx * Math.sin(southRotation) + dz * Math.cos(southRotation)
            };
        }

        function worldPointToHorizonAzimuth(point, eye) {
            const local = worldPointToHorizonLocal(point, eye);
            const localX = local.x;
            const localZ = local.z;
            return Math.atan2(-localX, localZ) * 180 / Math.PI;
        }

        function horizonAzimuthToCanvasX(azimut, width) {
            const centerAzimut = getHorizonCenterAzimuth();
            const halfFov = getHorizonVisibleHalfFov();
            const relativeAzimut = signedAngleDiffDeg(azimut, centerAzimut);
            return ((relativeAzimut + halfFov) / Math.max(1, halfFov * 2)) * width;
        }

        function getHorizonSegmentStyle(type) {
            if(type === 'rail') return { heightDm: archHeights.rail / 10, fill: 'rgba(70,78,90,0.62)', stroke: 'rgba(255,255,255,0.62)', label: 'Garde-corps' };
            if(type === 'glass') return { heightDm: archHeights.glassTop / 10, fill: 'rgba(156,210,255,0.30)', stroke: 'rgba(220,244,255,0.85)', label: 'Baie' };
            if(type === 'window') return { heightDm: archHeights.windowTop / 10, fill: 'rgba(210,225,245,0.38)', stroke: 'rgba(255,255,255,0.75)', label: 'Fenêtre' };
            if(type === 'bare-edge') return { heightDm: 0.35, fill: 'rgba(255,255,255,0.08)', stroke: 'rgba(255,255,255,0.42)', label: 'Bord' };
            if(type === 'door') return { heightDm: archHeights.wall / 10 * 0.08, fill: 'rgba(200,168,112,0.10)', stroke: 'rgba(200,168,112,0.45)', label: 'Porte' };
            return { heightDm: archHeights.wall / 10, fill: 'rgba(118,118,118,0.54)', stroke: 'rgba(255,255,255,0.62)', label: 'Mur' };
        }

        function projectBalconyPointToHorizonCanvas(point, heightDm, eye, w, h) {
            const local = worldPointToHorizonLocal(point, eye);
            const distance = Math.hypot(local.x, local.z);
            if(distance < 0.05) return null;
            const azimut = Math.atan2(-local.x, local.z) * 180 / Math.PI;
            const relativeAzimut = signedAngleDiffDeg(azimut, getHorizonCenterAzimuth());
            const halfFov = getHorizonVisibleHalfFov();
            if(relativeAzimut < -halfFov - 10 || relativeAzimut > halfFov + 10) return null;
            const eyeHeightDm = Math.max(5, Math.min(30, (horizonSettings.eyeHeightM || 1.7) * 10));
            const elevation = Math.atan2(heightDm - eyeHeightDm, distance) * 180 / Math.PI;
            return {
                x: horizonAzimuthToCanvasX(azimut, w),
                y: horizonElevationToCanvasY(elevation, h),
                azimut,
                elevation
            };
        }

        function drawHorizonFloorProjection(ctx, w, h, eye) {
            const polygon = getPrimaryContourPolygon2D();
            if(polygon.length < 3) return;
            const projected = polygon
                .map(point => projectBalconyPointToHorizonCanvas(point, 0, eye, w, h))
                .filter(Boolean)
                .sort((a, b) => a.x - b.x);
            if(projected.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(projected[0].x, h);
            projected.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.lineTo(projected[projected.length - 1].x, h);
            ctx.closePath();
            ctx.fillStyle = 'rgba(36,32,28,0.42)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.30)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        function drawHorizonCeilingProjection(ctx, w, h, eye) {
            if(!archOptions.ceiling) return;
            const source = ceilingShapePoints.length >= 3 ? ceilingShapePoints : getPrimaryContourPolygon2D();
            if(source.length < 3) return;
            const ceilingHeightDm = Math.max(10, (archHeights.wall || 250) / 10 + 0.2);
            const projected = source
                .map(point => projectBalconyPointToHorizonCanvas(point, ceilingHeightDm, eye, w, h))
                .filter(Boolean)
                .sort((a, b) => a.x - b.x);
            if(projected.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(projected[0].x, 0);
            projected.forEach(point => ctx.lineTo(point.x, point.y));
            ctx.lineTo(projected[projected.length - 1].x, 0);
            ctx.closePath();
            ctx.fillStyle = 'rgba(216,210,196,0.32)';
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.56)';
            ctx.lineWidth = 1.5;
            ctx.stroke();
        }

        function drawHorizonObjectReferences(ctx, w, h, eye) {
            const entries = getConstructionItems().filter(entry => entry.item && entry.item.group);
            entries.forEach((entry, index) => {
                const box = new THREE.Box3().setFromObject(entry.item.group);
                if(box.isEmpty()) return;
                const corners = [
                    { x: box.min.x, z: box.min.z, y: box.min.y },
                    { x: box.max.x, z: box.min.z, y: box.min.y },
                    { x: box.max.x, z: box.max.z, y: box.min.y },
                    { x: box.min.x, z: box.max.z, y: box.min.y },
                    { x: box.min.x, z: box.min.z, y: box.max.y },
                    { x: box.max.x, z: box.min.z, y: box.max.y },
                    { x: box.max.x, z: box.max.z, y: box.max.y },
                    { x: box.min.x, z: box.max.z, y: box.max.y }
                ].map(corner => projectBalconyPointToHorizonCanvas({ x: corner.x * 20, y: corner.z * 20 }, corner.y, eye, w, h)).filter(Boolean);
                if(corners.length < 3) return;
                const xs = corners.map(p => p.x);
                const ys = corners.map(p => p.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                if(maxX - minX < 4 || maxY - minY < 4) return;
                const label = (getConstructionType(entry.type) || {}).label || entry.type || 'Objet';
                ctx.fillStyle = entry.type === 'pottedTree' ? 'rgba(94,124,76,0.42)' : 'rgba(184,126,70,0.38)';
                ctx.strokeStyle = entry.type === 'pottedTree' ? 'rgba(195,226,164,0.78)' : 'rgba(255,220,170,0.76)';
                ctx.lineWidth = 1.7;
                ctx.beginPath();
                if(ctx.roundRect) ctx.roundRect(minX, minY, maxX - minX, maxY - minY, 5);
                else ctx.rect(minX, minY, maxX - minX, maxY - minY);
                ctx.fill();
                ctx.stroke();
                if(maxX - minX > 42) {
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    ctx.font = '800 11px Segoe UI, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(label + ' ' + (index + 1), (minX + maxX) / 2, Math.max(14, minY - 5));
                }
            });
        }

        function drawHorizonBalconyReferences(ctx, w, h) {
            const contour = getPrimaryContourSegments();
            if(!contour.length) return;
            const eye = getHorizonViewpoint2D();

            ctx.save();
            drawHorizonFloorProjection(ctx, w, h, eye);
            drawHorizonCeilingProjection(ctx, w, h, eye);

            contour.forEach(segment => {
                const style = getHorizonSegmentStyle(segment.type);
                const p1Bottom = projectBalconyPointToHorizonCanvas(segment.p1, 0, eye, w, h);
                const p2Bottom = projectBalconyPointToHorizonCanvas(segment.p2, 0, eye, w, h);
                const p2Top = projectBalconyPointToHorizonCanvas(segment.p2, style.heightDm, eye, w, h);
                const p1Top = projectBalconyPointToHorizonCanvas(segment.p1, style.heightDm, eye, w, h);
                if(!p1Bottom || !p2Bottom || !p1Top || !p2Top) return;
                if(Math.abs(p1Top.x - p2Top.x) < 3) return;

                ctx.beginPath();
                ctx.moveTo(p1Bottom.x, p1Bottom.y);
                ctx.lineTo(p2Bottom.x, p2Bottom.y);
                ctx.lineTo(p2Top.x, p2Top.y);
                ctx.lineTo(p1Top.x, p1Top.y);
                ctx.closePath();
                ctx.fillStyle = style.fill;
                ctx.fill();
                ctx.strokeStyle = style.stroke;
                ctx.lineWidth = 2.2;
                ctx.stroke();

                const labelX = (p1Top.x + p2Top.x) / 2;
                const labelY = (p1Top.y + p2Top.y) / 2 + 16;
                if(Math.abs(p1Top.x - p2Top.x) > 48) {
                    ctx.fillStyle = 'rgba(255,255,255,0.88)';
                    ctx.font = '800 11px Segoe UI, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(style.label, labelX, labelY);
                }
            });

            drawHorizonMiniPlan(ctx, w, h, eye);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.font = '800 12px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'left';
            ctx.fillText('Point de vue: centre du balcon, yeux a ' + (horizonSettings.eyeHeightM || 1.7).toLocaleString('fr-FR') + ' m' + (!horizonSensorsActive ? ' - panorama 360°' : ''), 16, 28);
            ctx.restore();
        }

        function drawHorizonMiniPlan(ctx, w, h, eye) {
            const polygon = getPrimaryContourPolygon2D();
            if(polygon.length < 3) return;
            const box = getPolygonBoundingBox(polygon);
            const mapW = Math.min(190, w * 0.28);
            const mapH = Math.min(150, h * 0.22);
            const x0 = 14;
            const y0 = h - mapH - 16;
            const pad = 14;
            const sx = (mapW - pad * 2) / Math.max(1, box.maxX - box.minX);
            const sy = (mapH - pad * 2) / Math.max(1, box.maxY - box.minY);
            const s = Math.min(sx, sy);
            const toMap = p => ({
                x: x0 + mapW / 2 + (p.x - (box.minX + box.maxX) / 2) * s,
                y: y0 + mapH / 2 + (p.y - (box.minY + box.maxY) / 2) * s
            });

            ctx.fillStyle = 'rgba(0,0,0,0.34)';
            ctx.strokeStyle = 'rgba(255,255,255,0.35)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if(ctx.roundRect) ctx.roundRect(x0, y0, mapW, mapH, 8);
            else ctx.rect(x0, y0, mapW, mapH);
            ctx.fill();
            ctx.stroke();

            ctx.beginPath();
            polygon.forEach((p, idx) => {
                const m = toMap(p);
                if(idx === 0) ctx.moveTo(m.x, m.y);
                else ctx.lineTo(m.x, m.y);
            });
            ctx.closePath();
            ctx.fillStyle = 'rgba(255,255,255,0.16)';
            ctx.strokeStyle = 'rgba(255,255,255,0.86)';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();

            // Toujours centrer le point de vue sur le barycentre LOCAL du polygone
            // (le décalage bâtiment de transformBalconyScenePoint2D ne doit pas s'appliquer ici)
            const localCentroid = {
                x: polygon.reduce((acc, p) => acc + p.x, 0) / polygon.length,
                y: polygon.reduce((acc, p) => acc + p.y, 0) / polygon.length
            };
            const e = toMap(localCentroid);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(e.x, e.y, 4.5, 0, Math.PI * 2);
            ctx.fill();

            const southRotation = ((balconyWorldOrientationDeg - 180) % 360) * Math.PI / 180;
            const arrowLen = Math.min(mapW, mapH) * 0.27;
            const ax = e.x + Math.sin(southRotation) * arrowLen;
            const ay = e.y + Math.cos(southRotation) * arrowLen;
            ctx.strokeStyle = '#ffd166';
            ctx.fillStyle = '#ffd166';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(e.x, e.y);
            ctx.lineTo(ax, ay);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(ax, ay, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.font = '800 11px Segoe UI, Arial, sans-serif';
            ctx.fillText('Sud', ax + 14, ay + 4);
        }

        function drawHorizonFirstPersonScene(ctx, w, h) {
            if(horizonCameraActive || !renderer || !camera || !scene) return false;
            const eye = getHorizonViewpoint2D();
            const savedPos = camera.position.clone();
            const savedQuat = camera.quaternion.clone();
            const savedUp = camera.up.clone();
            const savedFov = camera.fov;
            const savedAspect = camera.aspect;
            const savedTarget = controls ? controls.target.clone() : null;
            const savedSize = renderer.getSize(new THREE.Vector2());
            const savedPixelRatio = renderer.getPixelRatio();
            const eyeHeightDm = Math.max(5, Math.min(30, (horizonSettings.eyeHeightM || 1.7) * 10));
            const lookDistance = 24;
            const frame = getHorizonLocalCameraFrame();
            const forwardWorld = horizonLocalDirectionToWorld(frame.forward);
            const upWorld = horizonLocalDirectionToWorld(frame.up);
            const cameraPosition = new THREE.Vector3(eye.x / 20, eyeHeightDm, eye.y / 20);
            const lookTarget = cameraPosition.clone().add(forwardWorld.multiplyScalar(lookDistance));

            try {
                renderer.setPixelRatio(1);
                renderer.setSize(Math.max(1, Math.round(w)), Math.max(1, Math.round(h)), false);
                camera.fov = getHorizonRenderVerticalFovDeg();
                camera.aspect = Math.max(0.1, w / Math.max(1, h));
                camera.up.copy(upWorld);
                camera.position.copy(cameraPosition);
                camera.lookAt(lookTarget);
                camera.updateProjectionMatrix();
                renderer.render(scene, camera);
                ctx.drawImage(renderer.domElement, 0, 0, w, h);
                ctx.fillStyle = 'rgba(0,0,0,0.08)';
                ctx.fillRect(0, 0, w, h);
                return true;
            } catch(err) {
                console.warn('Rendu horizon 3D indisponible', err);
                return false;
            } finally {
                camera.position.copy(savedPos);
                camera.quaternion.copy(savedQuat);
                camera.up.copy(savedUp);
                camera.fov = savedFov;
                camera.aspect = savedAspect;
                camera.updateProjectionMatrix();
                if(controls && savedTarget) {
                    controls.target.copy(savedTarget);
                    controls.update();
                }
                renderer.setPixelRatio(savedPixelRatio);
                renderer.setSize(savedSize.x, savedSize.y, false);
                renderCurrent3DFrame();
            }
        }

        function drawHorizonCompassOverlay(ctx, w, h) {
            const directions = [
                { label: 'S', full: 'Sud', az: 0, color: '#ffd166' },
                { label: 'O', full: 'Ouest', az: 90, color: '#d8e5ff' },
                { label: 'N', full: 'Nord', az: 180, color: '#ff6b6b' },
                { label: 'E', full: 'Est', az: -90, color: '#d8e5ff' }
            ];
            const horizonY = horizonElevationToCanvasY(0, h);
            ctx.save();
            directions.forEach(dir => {
                const x = horizonAzimuthToCanvasX(dir.az, w);
                if(x < -20 || x > w + 20) return;
                ctx.strokeStyle = dir.label === 'S' ? 'rgba(255,209,102,0.58)' : 'rgba(230,238,255,0.38)';
                ctx.lineWidth = dir.label === 'S' ? 2 : 1.4;
                ctx.setLineDash(dir.label === 'S' ? [] : [6, 7]);
                ctx.beginPath();
                ctx.moveTo(x, Math.max(0, horizonY));
                ctx.lineTo(x, h);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = dir.color;
                ctx.font = '900 12px Segoe UI, Arial, sans-serif';
                ctx.fillText(dir.full, Math.min(w - 50, Math.max(8, x + 6)), Math.max(18, horizonY + 28));
            });

            if(getHorizonCenterElevation() > 8 && !horizonSensorsActive) {
                ctx.restore();
                return;
            }

            const r = Math.min(44, Math.max(30, Math.min(w, h) * 0.08));
            const cx = Math.max(r + 18, Math.min(w - r - 18, 74));
            const cy = Math.max(r + 18, h - r - 34);
            ctx.fillStyle = 'rgba(18,18,18,0.46)';
            ctx.strokeStyle = 'rgba(255,255,255,0.52)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            const centerAzimut = getHorizonCenterAzimuth();
            directions.forEach(dir => {
                const a = signedAngleDiffDeg(dir.az, centerAzimut) * Math.PI / 180;
                const px = cx + Math.sin(a) * r * 0.72;
                const py = cy - Math.cos(a) * r * 0.72;
                ctx.fillStyle = dir.color;
                ctx.font = '900 13px Segoe UI, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(dir.label, px, py);
            });
            ctx.textAlign = 'left';
            ctx.textBaseline = 'alphabetic';
            ctx.restore();
        }

        function drawHorizonDistanceGroundOverlay(ctx, w, h) {
            const horizonY = horizonElevationToCanvasY(0, h);
            const baseY = Math.max(horizonY, h * 0.42);
            const centerX = w / 2;
            ctx.save();
            ctx.strokeStyle = 'rgba(255,209,102,0.34)';
            ctx.fillStyle = 'rgba(255,209,102,0.86)';
            ctx.lineWidth = 1.4;
            [-45, -30, -15, 0, 15, 30, 45].forEach(deg => {
                const x = centerX + Math.tan(deg * Math.PI / 180) * w * 0.42;
                ctx.beginPath();
                ctx.moveTo(centerX, h - 22);
                ctx.lineTo(x, baseY);
                ctx.stroke();
            });
            [5, 10, 20, 40, 80].forEach(distance => {
                const t = Math.log(distance + 1) / Math.log(90);
                const y = h - 22 - (h - 22 - baseY) * t;
                const half = 18 + w * 0.38 * t;
                ctx.strokeStyle = distance === Math.round(horizonActiveDistanceM) ? 'rgba(255,209,102,0.78)' : 'rgba(255,255,255,0.20)';
                ctx.beginPath();
                ctx.moveTo(centerX - half, y);
                ctx.lineTo(centerX + half, y);
                ctx.stroke();
                ctx.font = '800 11px Segoe UI, Arial, sans-serif';
                ctx.fillText(distance + ' m', centerX + half + 8, y + 4);
            });
            ctx.fillStyle = 'rgba(20,20,20,0.54)';
            ctx.strokeStyle = 'rgba(255,209,102,0.88)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, h - 28, 24, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#ffd166';
            ctx.font = '900 14px Segoe UI, Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('S', centerX, h - 28);
            ctx.restore();
        }

        function drawHorizonShapeOnCanvas(ctx, points, options = {}) {
            const projected = (points || []).map(horizonAnglesToCanvasPoint);
            if(projected.length < 2) return;
            const h = horizonDrawCanvas.getBoundingClientRect().height;
            ctx.beginPath();
            ctx.moveTo(projected[0].x, h);
            projected.forEach(p => ctx.lineTo(p.x, p.y));
            ctx.lineTo(projected[projected.length - 1].x, h);
            ctx.closePath();
            ctx.fillStyle = options.fill || 'rgba(18,18,18,0.44)';
            ctx.fill();

            ctx.beginPath();
            projected.forEach((p, idx) => idx === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
            ctx.strokeStyle = options.stroke || '#111111';
            ctx.lineWidth = options.width || 4;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.stroke();
            if(options.label) {
                const xs = projected.map(p => p.x);
                const ys = projected.map(p => p.y);
                const x = (Math.min(...xs) + Math.max(...xs)) / 2;
                const y = Math.max(18, Math.min(...ys) - 8);
                ctx.fillStyle = 'rgba(255,255,255,0.92)';
                ctx.font = '900 12px Segoe UI, Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(options.label, x, y);
            }
        }

        function sunPositionToHorizonAngles(position) {
            if(!position) return null;
            const southRotation = ((balconyWorldOrientationDeg - 180) % 360) * Math.PI / 180;
            const localX = position.x * Math.cos(southRotation) + position.z * Math.sin(southRotation);
            const localZ = -position.x * Math.sin(southRotation) + position.z * Math.cos(southRotation);
            const horizontal = Math.hypot(localX, localZ);
            if(horizontal < 0.001) return null;
            return {
                azimut: Math.max(-180, Math.min(180, Math.atan2(-localX, localZ) * 180 / Math.PI)),
                elevation: Math.max(0, Math.min(89, Math.atan2(position.y, horizontal) * 180 / Math.PI))
            };
        }

        function drawHorizonSolarPathOverlay(ctx, w, h) {
            if(typeof getSunStateForHour !== 'function') return;
            const seasons = [
                { key: 'summer', label: 'été', color: 'rgba(255,189,74,0.82)' },
                { key: 'winter', label: 'hiver', color: 'rgba(255,244,190,0.68)' }
            ];
            const centerAzimut = getHorizonCenterAzimuth();
            const halfFov = getHorizonVisibleHalfFov();
            ctx.save();
            seasons.forEach(season => {
                const visible = [];
                for(let hour = 4; hour <= 22.001; hour += 0.25) {
                    const sunState = getSunStateForHour(hour, season.key);
                    if(!sunState || !sunState.daylight || !sunState.position || sunState.position.y <= 0) continue;
                    const angles = sunPositionToHorizonAngles(sunState.position);
                    if(!angles) continue;
                    const rel = signedAngleDiffDeg(angles.azimut, centerAzimut);
                    if(rel < -halfFov - 8 || rel > halfFov + 8) continue;
                    const point = horizonAnglesToCanvasPoint(angles);
                    if(point.y < -40 || point.y > h + 40) continue;
                    visible.push({ ...point, hour, angles });
                }
                if(visible.length < 2) return;
                ctx.beginPath();
                visible.forEach((point, index) => {
                    if(index === 0) ctx.moveTo(point.x, point.y);
                    else ctx.lineTo(point.x, point.y);
                });
                ctx.strokeStyle = season.color;
                ctx.lineWidth = season.key === sunSeason ? 3 : 1.8;
                ctx.setLineDash(season.key === sunSeason ? [] : [6, 6]);
                ctx.stroke();
                ctx.setLineDash([]);

                visible.forEach(point => {
                    const roundedHour = Math.round(point.hour);
                    if(Math.abs(point.hour - roundedHour) > 0.01 || roundedHour % 3 !== 0) return;
                    ctx.fillStyle = season.color;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 3.2, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.font = '800 10px Segoe UI, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(roundedHour + 'h', point.x, point.y - 8);
                });

                const labelPoint = visible[Math.floor(visible.length * 0.55)];
                ctx.font = '900 11px Segoe UI, Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillStyle = season.color;
                ctx.fillText('Course soleil ' + season.label, labelPoint.x + 8, labelPoint.y - 8);
            });

            const current = getSunStateForHour(sunHour2d, sunSeason);
            const currentAngles = current && current.daylight ? sunPositionToHorizonAngles(current.position) : null;
            if(currentAngles) {
                const rel = signedAngleDiffDeg(currentAngles.azimut, centerAzimut);
                if(rel >= -halfFov - 8 && rel <= halfFov + 8) {
                    const p = horizonAnglesToCanvasPoint(currentAngles);
                    const hour = Math.floor(sunHour2d);
                    const minutes = Math.round((sunHour2d - hour) * 60);
                    ctx.fillStyle = 'rgba(255,199,70,0.98)';
                    ctx.strokeStyle = 'rgba(70,42,0,0.72)';
                    ctx.lineWidth = 2;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                    ctx.fillStyle = 'rgba(255,255,255,0.96)';
                    ctx.font = '900 12px Segoe UI, Arial, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText(hour + 'h' + (minutes ? String(minutes).padStart(2, '0') : ''), p.x, p.y - 14);
                }
            }
            ctx.restore();
        }

        function drawHorizonStatusChip(ctx, w, h) {
            const seasonLabel = sunSeason === 'winter' ? 'hiver' : 'été';
            const modeLabel = horizonCameraActive ? 'Caméra AR' : 'Vue 3D';
            const sensorLabel = horizonSensorsActive ? 'boussole active' : 'manuel';
            const text = modeLabel + ' | ' + sensorLabel + ' | dôme ' + HORIZON_DOME_RADIUS_M + ' m | soleil ' + seasonLabel;
            ctx.save();
            ctx.font = '900 12px Segoe UI, Arial, sans-serif';
            const padX = 10;
            const boxW = Math.min(w - 24, ctx.measureText(text).width + padX * 2);
            const x = Math.max(12, w - boxW - 12);
            const y = h - 54;
            ctx.fillStyle = 'rgba(0,0,0,0.48)';
            ctx.strokeStyle = 'rgba(255,255,255,0.32)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            if(ctx.roundRect) ctx.roundRect(x, y, boxW, 30, 15);
            else ctx.rect(x, y, boxW, 30);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,255,255,0.94)';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, x + boxW / 2, y + 15, boxW - padX * 2);
            ctx.restore();
        }

        function drawHorizonPanorama() {
            if(!horizonDrawCanvas || !horizonDrawCtx) return;
            const rect = horizonDrawCanvas.getBoundingClientRect();
            const w = rect.width;
            const h = rect.height;
            const rawCtx = horizonDrawCtx;
            rawCtx.clearRect(0, 0, w, h);
            rawCtx.save();
            if(horizonSensorsActive && Math.abs(horizonDeviceRollDeg || 0) > 0.5) {
                rawCtx.translate(w / 2, h / 2);
                rawCtx.rotate(-(horizonDeviceRollDeg || 0) * Math.PI / 180);
                rawCtx.translate(-w / 2, -h / 2);
            }
            const ctx = rawCtx;

            const has3DBackground = drawHorizonFirstPersonScene(ctx, w, h);
            if(!horizonCameraActive && !has3DBackground) {
                const sky = ctx.createLinearGradient(0, 0, 0, h);
                sky.addColorStop(0, '#8fc8ff');
                sky.addColorStop(0.58, '#d9ecff');
                sky.addColorStop(1, '#efe8d8');
                ctx.fillStyle = sky;
                ctx.fillRect(0, 0, w, h);
            } else if(horizonCameraActive) {
                ctx.fillStyle = 'rgba(0,0,0,0.10)';
                ctx.fillRect(0, 0, w, h);
            }

            rawCtx.restore();
        }

        function resetHorizonDrawing() {
            horizonDraftPoints = [];
            horizonCurrentStrokePoints = [];
            disposeHorizonDraftMesh();
            drawHorizonPanorama();
        }

        function validateHorizonDrawing() {
            if(horizonDraftPoints.length < 2) {
                alert("Dessine au moins deux points pour créer l'obstacle.");
                return;
            }
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const shape = normalizeHorizonSilhouette({
                id: horizonSettings.silhouettes[horizonActiveSilhouetteIndex] && horizonSettings.silhouettes[horizonActiveSilhouetteIndex].id,
                name: 'Obstacle ' + (horizonActiveSilhouetteIndex + 1),
                distanceM: HORIZON_DOME_RADIUS_M,
                points: horizonDraftPoints.map(p => ({ ...p }))
            }, horizonActiveSilhouetteIndex, HORIZON_DOME_RADIUS_M);
            horizonSettings.silhouettes[horizonActiveSilhouetteIndex] = shape;
            horizonSettings.activeSilhouetteIndex = horizonActiveSilhouetteIndex;
            horizonSettings.activeDistanceM = shape.distanceM;
            horizonSettings.points = horizonSettings.silhouettes[0] ? horizonSettings.silhouettes[0].points.map(p => ({ ...p })) : [];
            horizonSettings.enabled = true;
            horizonCurrentStrokePoints = [];
            disposeHorizonDraftMesh();
            rebuildHorizonWall();
            updateHorizonUI();
            drawHorizonPanorama();
        }

        function updateHorizonSetting(key, value) {
            saveState();
            if(key === 'radiusM') horizonSettings.radiusM = Math.max(5, Math.min(80, parseFloat(String(value).replace(',', '.')) || 20));
            if(key === 'eyeHeightM') horizonSettings.eyeHeightM = Math.max(0.5, Math.min(3, parseFloat(String(value).replace(',', '.')) || 1.7));
            rebuildHorizonWall();
        }

        function setNeighborhoodStatus(message, busy = false) {
            const status = document.getElementById('horizon-neighborhood-status');
            if(!status) return;
            status.textContent = message || '';
            if(busy) {
                status.dataset.busy = '1';
            } else {
                delete status.dataset.busy;
            }
        }

        function updateNeighborhoodSetting(key, value) {
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(key === 'floor') neighborhood.floor = Math.max(0, Math.min(40, Math.round(parseFloat(String(value).replace(',', '.')) || 0)));
            if(key === 'radiusM') neighborhood.radiusM = Math.max(40, Math.min(500, parseFloat(String(value).replace(',', '.')) || 160));
            if(key === 'showSatellite') {
                neighborhood.showSatellite = !!value;
                neighborhood.satelliteOptIn = !!value;
            }
            if(key === 'showUrbanFeatures') neighborhood.showUrbanFeatures = !!value;
            if(key === 'supportBuildingId') neighborhood.supportBuildingId = value ? String(value) : null;
            if(key === 'supportSide') neighborhood.supportSide = value === 'inside' ? 'inside' : 'outside';
            if(key === 'supportWidthM') neighborhood.supportWidthM = Math.max(0.8, Math.min(12, parseFloat(String(value).replace(',', '.')) || 3));
            if(key === 'supportDepthM') neighborhood.supportDepthM = Math.max(0.4, Math.min(4, parseFloat(String(value).replace(',', '.')) || 1.4));
            horizonSettings.neighborhood = normalizeNeighborhoodSettings(neighborhood);
            if(horizonSettings.neighborhood.buildings.length) horizonSettings.enabled = true;
            rebuildHorizonWall();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            if(typeof rebuildVisAVisGuideMeshes === 'function') rebuildVisAVisGuideMeshes();
            if(typeof draw2D === 'function') draw2D();
            if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
        }

        function withGuidedNeighborhoodMapView(neighborhood) {
            return normalizeNeighborhoodSettings({
                ...neighborhood,
                showFootprints: true,
                satelliteOptIn: true,
                showSatellite: true
            });
        }

        function toggleNeighborhoodFootprints(show) {
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...horizonSettings.neighborhood,
                showFootprints: !!show
            });
            updateHorizonUI();
            draw2D();
        }

        function neighborhoodPointToCanvas(point) {
            const eye = getNeighborhoodMapOrigin2D();
            return {
                x: eye.x + point.x * 200,
                y: eye.y + point.z * 200
            };
        }

        function getNeighborhoodFootprintCanvasPolygons(neighborhoodInput = null) {
            const neighborhood = neighborhoodInput || normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.showFootprints || !neighborhood.buildings.length) return [];
            const eye = getNeighborhoodMapOrigin2D(neighborhood);
            return neighborhood.buildings
                .map(building => ({
                    building,
                    points: (building.footprint || []).map(point => ({
                        x: eye.x + point.x * 200,
                        y: eye.y + point.z * 200
                    }))
                }))
                .filter(entry => entry.points.length >= 3);
        }

        function getNeighborhoodBuildingFixedFootprint2D(building, neighborhoodInput = null) {
            const neighborhood = neighborhoodInput || normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const origin = getNeighborhoodMapOrigin2D(neighborhood);
            return (building && Array.isArray(building.footprint) ? building.footprint : [])
                .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.z))
                .map(point => ({
                    x: origin.x + point.x * 200,
                    y: origin.y + point.z * 200
                }));
        }

        function renderNeighborhoodFootprints2D() {
            if(!ctx2d) return;
            const neighborhood = ensureNeighborhoodMapOrigin2D();
            const lightEnvironmentDraw = typeof shouldUseLightweight2DEnvironment === 'function' && shouldUseLightweight2DEnvironment();
            const polygons = getNeighborhoodFootprintCanvasPolygons(neighborhood);
            if(!polygons.length && !neighborhood.showSatellite && !neighborhood.showUrbanFeatures) return;

            // Défaire le repère déplacé du balcon : les bâtiments voisins restent géographiques.
            const sceneRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            ctx2d.save();
            ctx2d.translate(pivot.x || 0, pivot.y || 0);
            ctx2d.rotate(-sceneRot);
            ctx2d.translate(-(pivot.x || 0), -(pivot.y || 0));
            ctx2d.translate(-balconyOffsetX * 20, -balconyOffsetZ * 20);
            if(!lightEnvironmentDraw) {
                renderNeighborhoodSatellite2D(neighborhood);
                renderNeighborhoodFeatures2D(neighborhood);
            }
            polygons.forEach(({ building, points }) => {
                const hovered = building && building.id === hoveredNeighborhoodBuildingId;
                ctx2d.beginPath();
                points.forEach((pt, index) => {
                    if(index === 0) ctx2d.moveTo(pt.x, pt.y);
                    else ctx2d.lineTo(pt.x, pt.y);
                });
                ctx2d.closePath();
                ctx2d.fillStyle = lightEnvironmentDraw
                    ? 'rgba(76, 130, 150, 0.08)'
                    : (hovered ? 'rgba(255, 214, 88, 0.24)' : (building.estimated ? 'rgba(88, 126, 160, 0.13)' : 'rgba(76, 130, 150, 0.16)'));
                ctx2d.strokeStyle = hovered
                    ? 'rgba(255, 214, 88, 0.95)'
                    : (lightEnvironmentDraw ? 'rgba(48, 148, 166, 0.42)' : (building.estimated ? 'rgba(88, 126, 160, 0.64)' : 'rgba(48, 148, 166, 0.78)'));
                ctx2d.lineWidth = hovered ? Math.max(2, 2.6 / scale) : Math.max(1, (lightEnvironmentDraw ? 1.1 : 1.6) / scale);
                ctx2d.fill();
                ctx2d.stroke();
                // Surbrillance de la façade la plus proche en mode alignement
                if(hovered && neighborhoodGridAlignmentPickArmed && hoveredNeighborhoodEdgeFootprintIndex >= 0) {
                    const n = points.length;
                    const i = hoveredNeighborhoodEdgeFootprintIndex;
                    if(i < n) {
                        const p1 = points[i];
                        const p2 = points[(i + 1) % n];
                        ctx2d.beginPath();
                        ctx2d.moveTo(p1.x, p1.y);
                        ctx2d.lineTo(p2.x, p2.y);
                        ctx2d.strokeStyle = 'rgba(255, 120, 0, 1.0)';
                        ctx2d.lineWidth = Math.max(4, 5.5 / scale);
                        ctx2d.lineCap = 'round';
                        ctx2d.stroke();
                        ctx2d.lineCap = 'butt';
                    }
                }
            });
            ctx2d.restore();
        }

        function animateZoomToBuilding2D(building) {
            if(!building || !canvas2d) return;
            const pts = (building.footprint || []).map(neighborhoodPointToCanvas)
                .filter(p => p && Number.isFinite(p.x) && Number.isFinite(p.y));
            if(pts.length < 2) return;
            const rect = canvas2d.getBoundingClientRect();
            const pad = 80;
            const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
            const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
            const bW = Math.max(1, Math.max(...pts.map(p => p.x)) - Math.min(...pts.map(p => p.x)));
            const bH = Math.max(1, Math.max(...pts.map(p => p.y)) - Math.min(...pts.map(p => p.y)));
            // Zoom ciblé sur le bâtiment, mais pas plus que ×3 du zoom actuel pour éviter un saut trop brutal
            const fitScale = Math.min(
                (rect.width - pad * 2) / bW,
                (rect.height - pad * 2) / bH
            );
            const tScale = Math.max(0.08, Math.min(fitScale, scale * 3, 3.0));
            const tOffX = rect.width / 2 - cx * tScale;
            const tOffY = rect.height / 2 - cy * tScale;
            const s0 = scale, ox0 = offsetX, oy0 = offsetY;
            const t0 = performance.now(), dur = 320;
            function step(now) {
                const tL = Math.min(1, (now - t0) / dur);
                const e = tL < 0.5 ? 2 * tL * tL : -1 + (4 - 2 * tL) * tL;
                scale = s0 + (tScale - s0) * e;
                offsetX = ox0 + (tOffX - ox0) * e;
                offsetY = oy0 + (tOffY - oy0) * e;
                draw2D();
                if(tL < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        function focusNeighborhoodFootprints2D() {
            const neighborhood = ensureNeighborhoodMapOrigin2D();
            if(!neighborhood.enabled || !neighborhood.buildings.length) {
                setNeighborhoodStatus('Importe d’abord le voisinage pour cadrer la carte au sol.', false);
                return;
            }
            const polygons = neighborhood.buildings
                .map(building => (building.footprint || []).map(neighborhoodPointToCanvas))
                .filter(points => points.length >= 3);
            if(!polygons.length || !canvas2d) return;
            const allPoints = polygons.flat();
            const eye = getNeighborhoodMapOrigin2D(neighborhood);
            if(eye) allPoints.push(eye);
            const bounds = {
                minX: Math.min(...allPoints.map(p => p.x)),
                maxX: Math.max(...allPoints.map(p => p.x)),
                minY: Math.min(...allPoints.map(p => p.y)),
                maxY: Math.max(...allPoints.map(p => p.y))
            };
            const rect = canvas2d.getBoundingClientRect();
            const padding = 48;
            const fitScaleX = (rect.width - padding * 2) / Math.max(1, bounds.maxX - bounds.minX);
            const fitScaleY = (rect.height - padding * 2) / Math.max(1, bounds.maxY - bounds.minY);
            scale = Math.max(0.015, Math.min(1.5, Math.min(fitScaleX, fitScaleY)));
            offsetX = rect.width / 2 - ((bounds.minX + bounds.maxX) / 2) * scale;
            offsetY = rect.height / 2 - ((bounds.minY + bounds.maxY) / 2) * scale;
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...horizonSettings.neighborhood,
                showFootprints: true
            });
            updateHorizonUI();
            draw2D();
        }

        function parseOsmHeightMeters(tags = {}) {
            const parseNumber = (value) => {
                if(value === undefined || value === null) return null;
                const match = String(value).trim().replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/);
                if(!match) return null;
                const parsed = parseFloat(match[0]);
                return Number.isFinite(parsed) ? parsed : null;
            };
            const rawHeight = tags.height || tags['building:height'];
            if(rawHeight !== undefined) {
                const value = parseNumber(rawHeight);
                if(value !== null) {
                    return { heightM: Math.max(2, Math.min(120, value)), estimated: false, levels: null, heightSource: 'height' };
                }
            }
            const levelsRaw = tags['building:levels'] || tags.levels || tags['building:levels:aboveground'];
            if(levelsRaw !== undefined) {
                const levels = parseNumber(levelsRaw);
                if(Number.isFinite(levels) && levels > 0) {
                    const minLevel = Math.max(0, parseNumber(tags['building:min_level'] || tags.min_level) || 0);
                    const roofLevels = Math.max(0, parseNumber(tags['roof:levels']) || 0);
                    const effectiveLevels = Math.max(1, levels - minLevel + roofLevels * 0.55);
                    return {
                        heightM: Math.max(2, Math.min(120, effectiveLevels * 3)),
                        estimated: true,
                        levels,
                        heightSource: 'levels'
                    };
                }
            }
            return {
                heightM: DEFAULT_NEIGHBORHOOD_BUILDING_HEIGHT_M,
                estimated: true,
                levels: DEFAULT_NEIGHBORHOOD_BUILDING_LEVELS,
                heightSource: 'default'
            };
        }

        function projectLngLatToNeighborhoodMeters(lon, lat, originLon, originLat) {
            const metersPerLat = 111320;
            const metersPerLon = Math.max(1, Math.cos(originLat * Math.PI / 180) * 111320);
            const eastM = (lon - originLon) * metersPerLon;
            const northM = (lat - originLat) * metersPerLat;
            // Positions géographiques fixes : est = +X, sud = +Z, indépendant de l'orientation du balcon
            return { x: eastM, z: -northM };
        }

        function normalizeOsmBuildingElement(element, origin) {
            if(!element) return null;
            const tags = element.tags || {};
            // Relations (multipolygone) : géométrie dans le membre outer
            let geometry = element.geometry;
            if(element.type === 'relation') {
                const outer = Array.isArray(element.members) && element.members.find(m => m.role === 'outer' && Array.isArray(m.geometry) && m.geometry.length >= 3);
                geometry = outer ? outer.geometry : null;
            }
            if(!Array.isArray(geometry) || geometry.length < 3) return null;
            const heightInfo = parseOsmHeightMeters(tags);
            const footprint = geometry.map(point => {
                if(!Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return null;
                return projectLngLatToNeighborhoodMeters(point.lon, point.lat, origin.lon, origin.lat);
            }).filter(Boolean);
            if(footprint.length < 3) return null;
            const name = tags.name || tags['addr:housename'] || tags['addr:housenumber'] || (tags['building:part'] ? 'Partie de bâtiment ' : 'Bâtiment OSM ') + element.id;
            return normalizeNeighborhoodBuilding({
                id: String(element.type || 'way') + '-' + element.id,
                name,
                heightM: heightInfo.heightM,
                estimated: heightInfo.estimated,
                levels: heightInfo.levels,
                heightSource: heightInfo.heightSource,
                footprint
            });
        }

        function getOsmRoadWidthM(tags = {}) {
            const widthText = tags.width || tags['est_width'];
            if(widthText !== undefined) {
                const match = String(widthText).replace(',', '.').match(/[-+]?\d+(?:\.\d+)?/);
                if(match) {
                    const width = parseFloat(match[0]);
                    if(Number.isFinite(width)) return Math.max(0.8, Math.min(24, width));
                }
            }
            const highway = tags.highway || '';
            if(highway === 'motorway' || highway === 'trunk') return 12;
            if(highway === 'primary' || highway === 'secondary') return 8;
            if(highway === 'tertiary' || highway === 'residential' || highway === 'service') return 5;
            if(highway === 'footway' || highway === 'path' || highway === 'steps' || highway === 'pedestrian') return 2;
            return 4;
        }

        function normalizeOsmRoadElement(element, origin) {
            if(!element || !Array.isArray(element.geometry) || element.geometry.length < 2) return null;
            const tags = element.tags || {};
            if(!tags.highway) return null;
            const points = element.geometry.map(point => {
                if(!Number.isFinite(point.lon) || !Number.isFinite(point.lat)) return null;
                return projectLngLatToNeighborhoodMeters(point.lon, point.lat, origin.lon, origin.lat);
            }).filter(Boolean);
            if(points.length < 2) return null;
            return normalizeNeighborhoodFeature({
                id: 'road-' + element.id,
                kind: 'road',
                subtype: tags.highway,
                name: tags.name || tags.highway || 'Voie',
                widthM: getOsmRoadWidthM(tags),
                points
            });
        }

        function normalizeOsmTreeElement(element, origin) {
            if(!element || !Number.isFinite(element.lon) || !Number.isFinite(element.lat)) return null;
            const tags = element.tags || {};
            const point = projectLngLatToNeighborhoodMeters(element.lon, element.lat, origin.lon, origin.lat);
            return normalizeNeighborhoodFeature({
                id: 'tree-' + element.id,
                kind: 'tree',
                subtype: tags.natural || 'tree',
                name: tags.name || '',
                point,
                radiusM: tags.diameter_crown ? parseFloat(String(tags.diameter_crown).replace(',', '.')) / 2 : 2.2,
                heightM: tags.height ? parseFloat(String(tags.height).replace(',', '.')) : 5
            });
        }

        const NEIGHBORHOOD_IMPORT_CACHE_TTL_MS = 10 * 60 * 1000;
        const NEIGHBORHOOD_IMPORT_CACHE_PREFIX = 'jardiniere-neighborhood-env-cache-v1:';
        const NEIGHBORHOOD_GEOCODE_CACHE_PREFIX = 'jardiniere-neighborhood-geocode-cache-v1:';
        const neighborhoodEnvironmentMemoryCache = {};
        const neighborhoodGeocodeMemoryCache = {};

        function cloneNeighborhoodCacheValue(value) {
            if(!value) return value;
            try {
                if(typeof structuredClone === 'function') return structuredClone(value);
            } catch(_) {}
            try {
                return JSON.parse(JSON.stringify(value));
            } catch(_) {
                return value;
            }
        }

        function getNeighborhoodCacheStorage() {
            try {
                return window.localStorage || null;
            } catch(_) {
                return null;
            }
        }

        function getNeighborhoodGeocodeCacheKey(address) {
            return String(address || '').trim().toLowerCase().replace(/\s+/g, ' ');
        }

        function getNeighborhoodEnvironmentCacheKey(origin, radiusM) {
            const lat = Number(origin && origin.lat);
            const lon = Number(origin && origin.lon);
            if(!Number.isFinite(lat) || !Number.isFinite(lon)) return '';
            const roundedLat = Math.round(lat * 100000) / 100000;
            const roundedLon = Math.round(lon * 100000) / 100000;
            const roundedRadius = Math.round(Number(radiusM) || 160);
            return roundedLat.toFixed(5) + ',' + roundedLon.toFixed(5) + ':r' + roundedRadius;
        }

        function readTimedNeighborhoodCache(memoryCache, storagePrefix, key) {
            if(!key) return null;
            const now = Date.now();
            const memoryEntry = memoryCache[key];
            if(memoryEntry && memoryEntry.expiresAt > now) {
                return cloneNeighborhoodCacheValue(memoryEntry.value);
            }
            if(memoryEntry) delete memoryCache[key];
            const storage = getNeighborhoodCacheStorage();
            if(!storage) return null;
            try {
                const raw = storage.getItem(storagePrefix + key);
                if(!raw) return null;
                const entry = JSON.parse(raw);
                if(!entry || entry.expiresAt <= now || !entry.value) {
                    storage.removeItem(storagePrefix + key);
                    return null;
                }
                memoryCache[key] = { expiresAt: entry.expiresAt, value: entry.value };
                return cloneNeighborhoodCacheValue(entry.value);
            } catch(_) {
                try { storage.removeItem(storagePrefix + key); } catch(__) {}
                return null;
            }
        }

        function writeTimedNeighborhoodCache(memoryCache, storagePrefix, key, value) {
            if(!key || !value) return;
            const entry = {
                expiresAt: Date.now() + NEIGHBORHOOD_IMPORT_CACHE_TTL_MS,
                value: cloneNeighborhoodCacheValue(value)
            };
            memoryCache[key] = entry;
            const storage = getNeighborhoodCacheStorage();
            if(!storage) return;
            try {
                storage.setItem(storagePrefix + key, JSON.stringify(entry));
            } catch(_) {}
        }

        async function geocodeNeighborhoodAddress(address) {
            const cacheKey = getNeighborhoodGeocodeCacheKey(address);
            const cached = readTimedNeighborhoodCache(neighborhoodGeocodeMemoryCache, NEIGHBORHOOD_GEOCODE_CACHE_PREFIX, cacheKey);
            if(cached) return cached;
            const [banResult, nomResult] = await Promise.allSettled([
                fetch('https://api-adresse.data.gouv.fr/search/?limit=1&q=' + encodeURIComponent(address)).then(r => r.ok ? r.json() : null),
                fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=fr&limit=1&q=' + encodeURIComponent(address), { headers: { 'Accept-Language': 'fr' } }).then(r => r.ok ? r.json() : null)
            ]);
            const banData = banResult.status === 'fulfilled' ? banResult.value : null;
            const banFeature = banData && banData.features && banData.features[0];
            const banScore = banFeature && banFeature.properties ? (banFeature.properties.score || 0) : 0;
            if(banFeature && banScore >= 0.5 && banFeature.geometry && Array.isArray(banFeature.geometry.coordinates)) {
                const result = {
                    lon: Number(banFeature.geometry.coordinates[0]),
                    lat: Number(banFeature.geometry.coordinates[1]),
                    label: banFeature.properties.label || address
                };
                writeTimedNeighborhoodCache(neighborhoodGeocodeMemoryCache, NEIGHBORHOOD_GEOCODE_CACHE_PREFIX, cacheKey, result);
                return cloneNeighborhoodCacheValue(result);
            }
            // BAN absent ou score faible : utiliser Nominatim (POI, lieux nommés, etc.)
            const nomData = nomResult.status === 'fulfilled' ? nomResult.value : null;
            const place = nomData && nomData[0];
            if(place && place.lat && place.lon) {
                const result = {
                    lon: Number(place.lon),
                    lat: Number(place.lat),
                    label: place.display_name ? place.display_name.split(',').slice(0, 2).join(',').trim() : address
                };
                writeTimedNeighborhoodCache(neighborhoodGeocodeMemoryCache, NEIGHBORHOOD_GEOCODE_CACHE_PREFIX, cacheKey, result);
                return cloneNeighborhoodCacheValue(result);
            }
            // Dernier recours : accepter BAN même avec un mauvais score
            if(banFeature && banFeature.geometry && Array.isArray(banFeature.geometry.coordinates)) {
                const result = {
                    lon: Number(banFeature.geometry.coordinates[0]),
                    lat: Number(banFeature.geometry.coordinates[1]),
                    label: banFeature.properties && banFeature.properties.label ? banFeature.properties.label : address
                };
                writeTimedNeighborhoodCache(neighborhoodGeocodeMemoryCache, NEIGHBORHOOD_GEOCODE_CACHE_PREFIX, cacheKey, result);
                return cloneNeighborhoodCacheValue(result);
            }
            throw new Error('Adresse introuvable');
        }

        const DEVICE_CONTEXT_PROMPT_KEY = 'jardiniere-device-context-prompt-v1';
        let neighborhoodEdgeRefreshToken = 0;
        let pendingDeviceLocationContext = null;

        function isUsableNeighborhoodCoordinate(lat, lon) {
            const safeLat = Number(lat);
            const safeLon = Number(lon);
            return Number.isFinite(safeLat)
                && Number.isFinite(safeLon)
                && Math.abs(safeLat) <= 90
                && Math.abs(safeLon) <= 180
                && !(Math.abs(safeLat) < 0.01 && Math.abs(safeLon) < 0.01);
        }

        function formatDeviceCoordinateLabel(lat, lon) {
            const safeLat = Number(lat);
            const safeLon = Number(lon);
            if(!Number.isFinite(safeLat) || !Number.isFinite(safeLon)) return 'Position actuelle';
            return 'Position actuelle (' + safeLat.toFixed(5) + ', ' + safeLon.toFixed(5) + ')';
        }

        async function fetchJsonWithTimeout(url, timeoutMs = 4500) {
            const supportsAbort = typeof AbortController !== 'undefined';
            const controller = supportsAbort ? new AbortController() : null;
            const timer = controller ? window.setTimeout(() => controller.abort(), timeoutMs) : null;
            try {
                const response = await fetch(url, controller ? { signal: controller.signal } : {});
                if(!response.ok) throw new Error('Réponse indisponible (' + response.status + ')');
                return await response.json();
            } finally {
                if(timer) window.clearTimeout(timer);
            }
        }

        async function reverseGeocodeDeviceLocation(lat, lon) {
            const errors = [];
            try {
                const data = await fetchJsonWithTimeout('https://api-adresse.data.gouv.fr/reverse/?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon), 3500);
                const feature = data && data.features && data.features[0];
                const label = feature && feature.properties && feature.properties.label ? String(feature.properties.label).trim() : '';
                if(label) return label;
                errors.push(new Error('Adresse française introuvable'));
            } catch(error) {
                errors.push(error);
            }
            try {
                const data = await fetchJsonWithTimeout('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon), 5000);
                const label = data && data.display_name ? String(data.display_name).trim() : '';
                if(label) return label;
                errors.push(new Error('Adresse OpenStreetMap introuvable'));
            } catch(error) {
                errors.push(error);
            }
            throw errors[0] || new Error('Adresse appareil introuvable');
        }

        function getNeighborhoodSupportBuilding(neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {})) {
            const buildings = Array.isArray(neighborhood.buildings) ? neighborhood.buildings : [];
            if(!buildings.length) return null;
            return buildings.find(building => building.id === neighborhood.supportBuildingId) || buildings[0] || null;
        }

        function getBalconyPlacementSnapshot() {
            return {
                segments: JSON.parse(JSON.stringify(segments || [])),
                constraints: JSON.parse(JSON.stringify(constraints || [])),
                currentPoint: currentPoint ? { ...currentPoint } : null,
                isContourClosed,
                isSketchValidated,
                sketchLockActive,
                balconyOffsetX,
                balconyOffsetZ,
                balconyOrientationDeg,
                balconyWorldOrientationDeg,
                horizonSettings: JSON.parse(JSON.stringify(horizonSettings || {}))
            };
        }

        function restoreBalconyPlacementSnapshot(snapshot) {
            if(!snapshot) return;
            segments = JSON.parse(JSON.stringify(snapshot.segments || []));
            constraints = JSON.parse(JSON.stringify(snapshot.constraints || []));
            currentPoint = snapshot.currentPoint ? { ...snapshot.currentPoint } : null;
            isContourClosed = !!snapshot.isContourClosed;
            isSketchValidated = !!snapshot.isSketchValidated;
            sketchLockActive = !!snapshot.sketchLockActive;
            balconyOffsetX = Number.isFinite(snapshot.balconyOffsetX) ? snapshot.balconyOffsetX : 0;
            balconyOffsetZ = Number.isFinite(snapshot.balconyOffsetZ) ? snapshot.balconyOffsetZ : 0;
            const snapshotBalconyOrientationDeg = Number.isFinite(snapshot.balconyOrientationDeg)
                ? snapshot.balconyOrientationDeg
                : snapshot.sunOrientationDeg;
            balconyOrientationDeg = Number.isFinite(snapshotBalconyOrientationDeg) ? snapshotBalconyOrientationDeg : 180;
            const snapshotBalconyWorldOrientationDeg = Number.isFinite(snapshot.balconyWorldOrientationDeg)
                ? snapshot.balconyWorldOrientationDeg
                : snapshot.viewOrientationDeg;
            balconyWorldOrientationDeg = Number.isFinite(snapshotBalconyWorldOrientationDeg) ? snapshotBalconyWorldOrientationDeg : balconyOrientationDeg;
            horizonSettings = normalizeHorizonSettings(snapshot.horizonSettings || horizonSettings);
            balconyBuildingPlacementActive = false;
            balconyBuildingPlacementDragActive = false;
            balconyBuildingPlacementRotating = false;
            balconyBuildingPlacementPickArmed = false;
            myBuildingPickArmed = false;
            updateBalconyPlacementHud();
            applyBalconySceneTransform();
            if(typeof build3DArch === 'function') build3DArch();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            updateHorizonUI();
            syncSun2dControls();
            draw2D();
        }

        function ensureBalconyPlacementHud() {
            let hud = document.getElementById('balcony-placement-hud');
            if(hud) return hud;
            hud = document.createElement('div');
            hud.id = 'balcony-placement-hud';
            hud.innerHTML = [
                '<strong>Pose du balcon</strong>',
                '<span>Le balcon est verrouillé comme un seul objet. Glisse-le, ou tire la petite flèche pour tourner.</span>',
                '<button type="button" onclick="validateBalconyBuildingPlacement()">Valider</button>',
                '<button type="button" onclick="cancelBalconyBuildingPlacement()">Annuler</button>'
            ].join('');
            document.body.appendChild(hud);
            return hud;
        }

        function updateBalconyPlacementHud() {
            const hud = balconyBuildingPlacementActive ? ensureBalconyPlacementHud() : document.getElementById('balcony-placement-hud');
            if(hud) hud.classList.toggle('visible', !!balconyBuildingPlacementActive);
        }

        function validateBalconyBuildingPlacement() {
            if(!balconyBuildingPlacementActive) return;
            saveState();
            balconyBuildingPlacementActive = false;
            balconyBuildingPlacementDragActive = false;
            balconyBuildingPlacementRotating = false;
            balconyBuildingPlacementSnapshot = null;
            balconyBuildingPlacementSnapPreview = null;
            balconyBuildingPlacementPickArmed = false;
            hoveredNeighborhoodBuildingId = null;
            updateBalconyPlacementHud();
            if(typeof rebuildHorizonWall === 'function') rebuildHorizonWall();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            draw2D();
        }

        function cancelBalconyBuildingPlacement() {
            restoreBalconyPlacementSnapshot(balconyBuildingPlacementSnapshot);
            balconyBuildingPlacementSnapshot = null;
            balconyBuildingPlacementSnapPreview = null;
            balconyBuildingPlacementPickArmed = false;
            hoveredNeighborhoodBuildingId = null;
        }

        function armBalconyBuildingPlacementPick() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) {
                setNeighborhoodStatus('Importe d’abord le voisinage, puis clique un bâtiment sur le plan 2D.', false);
                return;
            }
            neighborhoodGridAlignmentPickArmed = false;
            neighborhoodHeightEditPickArmed = false;
            myBuildingPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            updateMyBuildingPickHud();
            balconyBuildingPlacementPickArmed = true;
            horizonSettings.neighborhood = withGuidedNeighborhoodMapView(neighborhood);
            updateHorizonUI();
            rebuildHorizonWall();
            draw2D();
            setNeighborhoodStatus('Mode replacement actif : clique un bâtiment sur le plan 2D.', false);
        }

        function armNeighborhoodGridAlignmentPick(options = {}) {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) {
                setNeighborhoodStatus('Importe d’abord le voisinage, puis clique une façade sur le plan 2D.', false);
                return;
            }
            balconyBuildingPlacementPickArmed = false;
            neighborhoodHeightEditPickArmed = false;
            myBuildingPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            neighborhoodGridAlignmentPickArmed = true;
            updateMyBuildingPickHud();
            horizonSettings.neighborhood = withGuidedNeighborhoodMapView(neighborhood);
            updateHorizonUI();
            if(!options.skipSceneRebuild) rebuildHorizonWall();
            draw2D();
            setNeighborhoodStatus('Mode orientation actif : clique la façade principale sur laquelle tu veux travailler.', false);
        }

        function armNeighborhoodHeightEditPick() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) {
                setNeighborhoodStatus('Importe d’abord le voisinage, puis clique le bâtiment à corriger.', false);
                return;
            }
            balconyBuildingPlacementPickArmed = false;
            neighborhoodGridAlignmentPickArmed = false;
            myBuildingPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            updateMyBuildingPickHud();
            neighborhoodHeightEditPickArmed = true;
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...neighborhood,
                showFootprints: true
            });
            updateHorizonUI();
            draw2D();
            setNeighborhoodStatus('Mode correction hauteur actif : clique le bâtiment dont la hauteur est fausse.', false);
        }

        function ensureMyBuildingPickHud() {
            let hud = document.getElementById('my-building-pick-hud');
            if(hud) return hud;
            hud = document.createElement('div');
            hud.id = 'my-building-pick-hud';
            document.body.appendChild(hud);
            return hud;
        }

        function isTouchNeighborhoodPickEvent(event) {
            return !!(
                (typeof isDispatchingTouchAsMouse !== 'undefined' && isDispatchingTouchAsMouse)
                || (event && (event.pointerType === 'touch' || event.pointerType === 'pen'))
                || (event && event.sourceCapabilities && event.sourceCapabilities.firesTouchEvents)
            );
        }

        function escapeNeighborhoodHudText(value) {
            return String(value || '').replace(/[&<>"']/g, char => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                '"': '&quot;',
                "'": '&#39;'
            })[char]);
        }

        function getNeighborhoodBuildingById(buildingId) {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : {});
            const id = buildingId === null || buildingId === undefined ? '' : String(buildingId);
            if(!id || !Array.isArray(neighborhood.buildings)) return null;
            return neighborhood.buildings.find(building => String(building.id) === id) || null;
        }

        function getNeighborhoodEdgePreviewIndex(building, edge) {
            if(!building || !edge) return -1;
            const footprint = typeof getNeighborhoodBuildingSceneFootprint === 'function'
                ? getNeighborhoodBuildingSceneFootprint(building) : [];
            return footprint.findIndex(p =>
                Math.abs(p.x - edge.a.x) < 0.001 &&
                Math.abs(p.z - edge.a.z) < 0.001
            );
        }

        function clearPendingTouchNeighborhoodPick(options = {}) {
            pendingTouchNeighborhoodPick = null;
            if(!options.keepHover) {
                hoveredNeighborhoodBuildingId = null;
                hoveredNeighborhoodEdgeFootprintIndex = -1;
            }
            updateMyBuildingPickHud();
            if(typeof draw2D === 'function') draw2D();
        }

        function cancelPendingTouchNeighborhoodPick() {
            clearPendingTouchNeighborhoodPick();
        }

        function confirmPendingTouchNeighborhoodPick() {
            const pending = pendingTouchNeighborhoodPick;
            if(!pending) return false;
            const building = getNeighborhoodBuildingById(pending.buildingId);
            if(!building) {
                clearPendingTouchNeighborhoodPick();
                return false;
            }
            pendingTouchNeighborhoodPick = null;
            updateMyBuildingPickHud();
            if(pending.type === 'building') {
                selectMyBuilding(building);
                return true;
            }
            if(pending.type === 'facade') {
                const point = pending.point || null;
                if(!point) return false;
                setNeighborhoodStatus('Alignement de la façade...', true);
                requestAnimationFrame(() => alignGridToNeighborhoodBuildingEdge(building, point));
                return true;
            }
            return false;
        }

        function previewTouchNeighborhoodBuildingPick(building) {
            if(!building) return false;
            if(pendingTouchNeighborhoodPick
                && pendingTouchNeighborhoodPick.type === 'building'
                && String(pendingTouchNeighborhoodPick.buildingId) === String(building.id)) {
                return confirmPendingTouchNeighborhoodPick();
            }
            pendingTouchNeighborhoodPick = {
                type: 'building',
                buildingId: building.id
            };
            hoveredNeighborhoodBuildingId = building.id || null;
            hoveredNeighborhoodEdgeFootprintIndex = -1;
            setNeighborhoodStatus('Bâtiment préaffiché. Confirme avec Oui, ou touche un autre bâtiment.', false);
            updateMyBuildingPickHud();
            if(typeof draw2D === 'function') draw2D();
            return true;
        }

        function previewTouchNeighborhoodFacadePick(building, point) {
            if(!building || !point) return false;
            const edge = getNearestSupportBuildingEdgeAtFixedPoint(building, point);
            if(!edge) return false;
            const edgeIndex = getNeighborhoodEdgePreviewIndex(building, edge);
            if(pendingTouchNeighborhoodPick
                && pendingTouchNeighborhoodPick.type === 'facade'
                && String(pendingTouchNeighborhoodPick.buildingId) === String(building.id)
                && pendingTouchNeighborhoodPick.edgeIndex === edgeIndex) {
                return confirmPendingTouchNeighborhoodPick();
            }
            pendingTouchNeighborhoodPick = {
                type: 'facade',
                buildingId: building.id,
                edgeIndex,
                point: { x: point.x, y: point.y }
            };
            hoveredNeighborhoodBuildingId = building.id || null;
            hoveredNeighborhoodEdgeFootprintIndex = edgeIndex;
            setNeighborhoodStatus('Façade préaffichée. Confirme avec Oui, ou touche une autre façade.', false);
            updateMyBuildingPickHud();
            if(typeof draw2D === 'function') draw2D();
            return true;
        }

        function updateMyBuildingPickHud() {
            const active = !!(myBuildingPickArmed || neighborhoodGridAlignmentPickArmed || pendingTouchNeighborhoodPick);
            const hud = active ? ensureMyBuildingPickHud() : document.getElementById('my-building-pick-hud');
            if(hud && active) {
                if(pendingTouchNeighborhoodPick) {
                    const pendingBuilding = getNeighborhoodBuildingById(pendingTouchNeighborhoodPick.buildingId);
                    const name = pendingBuilding && pendingBuilding.name ? pendingBuilding.name : 'cet élément';
                    hud.innerHTML = pendingTouchNeighborhoodPick.type === 'building'
                        ? [
                            '<strong>Choisir ce bâtiment ?</strong>',
                            '<span>' + escapeNeighborhoodHudText(name) + '</span>',
                            '<button type="button" class="primary" onclick="confirmPendingTouchNeighborhoodPick()">Oui</button>',
                            '<button type="button" onclick="cancelPendingTouchNeighborhoodPick()">Non</button>'
                        ].join('')
                        : [
                            '<strong>Choisir cette façade ?</strong>',
                            '<span>' + escapeNeighborhoodHudText(name) + '</span>',
                            '<button type="button" class="primary" onclick="confirmPendingTouchNeighborhoodPick()">Oui</button>',
                            '<button type="button" onclick="cancelPendingTouchNeighborhoodPick()">Non</button>'
                        ].join('');
                } else {
                    hud.innerHTML = myBuildingPickArmed
                    ? [
                        '<strong>Quel est ton bâtiment ?</strong>',
                        '<span>Clique dessus sur le plan satellite.</span>',
                        '<button type="button" onclick="cancelMyBuildingPick()">Annuler</button>'
                    ].join('')
                    : [
                        '<strong>Quelle façade principale ?</strong>',
                        '<span>Clique la façade sur laquelle tu veux travailler.</span>',
                        '<button type="button" onclick="cancelMyBuildingPick()">Annuler</button>'
                    ].join('');
                }
            }
            if(hud) hud.classList.toggle('visible', active);
        }

        function cancelMyBuildingPick() {
            myBuildingPickArmed = false;
            neighborhoodGridAlignmentPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            hoveredNeighborhoodBuildingId = null;
            hoveredNeighborhoodEdgeFootprintIndex = -1;
            updateMyBuildingPickHud();
            if(canvas2d) canvas2d.style.cursor = '';
            draw2D();
        }

        function armMyBuildingPick() {
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.buildings.length) {
                setNeighborhoodStatus('Importe d’abord le voisinage, puis clique ton bâtiment.', false);
                return;
            }
            balconyBuildingPlacementPickArmed = false;
            neighborhoodGridAlignmentPickArmed = false;
            neighborhoodHeightEditPickArmed = false;
            myBuildingPickArmed = true;
            pendingTouchNeighborhoodPick = null;
            horizonSettings.neighborhood = withGuidedNeighborhoodMapView(neighborhood);
            if(typeof clearActiveDrawingTool === 'function') clearActiveDrawingTool({ redraw: false });
            updateHorizonUI();
            updateMyBuildingPickHud();
            rebuildHorizonWall();
            draw2D();
            setNeighborhoodStatus('Vue satellite activée. Clique ton bâtiment sur le plan.', false);
        }

        function getNeighborhoodBuildingCenterMeters(building) {
            const footprint = building && Array.isArray(building.footprint) ? building.footprint : [];
            const points = footprint.filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.z));
            if(!points.length) return null;
            return points.reduce((center, point) => {
                center.x += point.x / points.length;
                center.z += point.z / points.length;
                return center;
            }, { x: 0, z: 0 });
        }

        function getNeighborhoodRefreshRadiusForBuilding(building, neighborhood) {
            const center = getNeighborhoodBuildingCenterMeters(building);
            if(!center) return null;
            const radiusM = Math.max(40, Math.min(500, Number(neighborhood && neighborhood.radiusM) || 160));
            if(radiusM >= 500) return null;
            const distanceM = Math.hypot(center.x, center.z);
            const edgeBandM = Math.max(45, radiusM * 0.28);
            if(distanceM < radiusM - edgeBandM) return null;
            const extraM = Math.max(90, Math.min(180, radiusM * 0.62));
            const targetRadiusM = Math.min(500, Math.ceil((distanceM + extraM) / 10) * 10);
            return targetRadiusM > radiusM + 20 ? targetRadiusM : null;
        }

        function mergeNeighborhoodItemsById(existingItems, incomingItems) {
            const merged = Array.isArray(existingItems) ? existingItems.slice() : [];
            const seen = new Set(merged.map(item => item && item.id ? String(item.id) : '').filter(Boolean));
            (Array.isArray(incomingItems) ? incomingItems : []).forEach(item => {
                const id = item && item.id ? String(item.id) : '';
                if(!id || seen.has(id)) return;
                seen.add(id);
                merged.push(item);
            });
            return merged;
        }

        async function refreshNeighborhoodAroundEdgeBuilding(building) {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : {});
            const targetRadiusM = getNeighborhoodRefreshRadiusForBuilding(building, neighborhood);
            if(!targetRadiusM || !isUsableNeighborhoodCoordinate(neighborhood.lat, neighborhood.lon)) return;
            const token = ++neighborhoodEdgeRefreshToken;
            setNeighborhoodStatus('Clique la façade principale. Je complète les bâtiments autour de ce secteur...', true);
            try {
                const environment = await fetchOsmNeighborhoodEnvironment(
                    { lat: neighborhood.lat, lon: neighborhood.lon, label: neighborhood.address || '' },
                    targetRadiusM
                );
                const usedCache = !!(environment && environment.fromCache);
                if(token !== neighborhoodEdgeRefreshToken) return;
                const current = normalizeNeighborhoodSettings(horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : neighborhood);
                const buildings = mergeNeighborhoodItemsById(current.buildings, environment.buildings || []);
                const features = mergeNeighborhoodItemsById(current.features, environment.features || []);
                saveState();
                horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                    ...current,
                    radiusM: targetRadiusM,
                    buildings,
                    features
                });
                const radiusInput = document.getElementById('horizon-radius-neighborhood-input');
                if(radiusInput) radiusInput.value = String(Math.round(targetRadiusM));
                updateHorizonUI();
                rebuildHorizonWall();
                draw2D();
                if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
                if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
                const addedBuildings = Math.max(0, buildings.length - current.buildings.length);
                setNeighborhoodStatus(
                    addedBuildings
                        ? addedBuildings + ' bâtiment(s) proche(s) ajoutés. Clique la façade principale.'
                        : (usedCache ? 'Secteur relu depuis le cache local. Clique la façade principale.' : 'Secteur déjà couvert. Clique la façade principale.'),
                    false
                );
            } catch(error) {
                console.warn('Extension du voisinage impossible', error);
                if(token === neighborhoodEdgeRefreshToken) {
                    setNeighborhoodStatus('Impossible de compléter les bâtiments proches pour le moment. Tu peux quand même cliquer la façade.', false);
                }
            }
        }

        function selectMyBuilding(building) {
            if(!building) return;
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            myBuildingPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            updateMyBuildingPickHud();
            const currentFloor = Number.isFinite(neighborhood.floor) ? neighborhood.floor : 0;
            const floorStr = window.prompt('À quel étage es-tu ?\n(0 = rez-de-chaussée)', String(currentFloor));
            const nextFloor = floorStr !== null
                ? Math.max(0, Math.min(40, Math.round(parseFloat(String(floorStr).replace(',', '.')) || 0)))
                : currentFloor;
            const refreshedNeighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || neighborhood);
            horizonSettings.neighborhood = withGuidedNeighborhoodMapView({
                ...refreshedNeighborhood,
                supportBuildingId: building.id,
                floor: nextFloor
            });
            hoveredNeighborhoodBuildingId = building.id;
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            updateHorizonUI();
            syncSun2dControls();
            armNeighborhoodGridAlignmentPick({ skipSceneRebuild: true });
            setNeighborhoodStatus((building.name || 'Bâtiment') + ' sélectionné. ' + getNeighborhoodHeightWarningMessage(horizonSettings.neighborhood, building) + ' Clique maintenant sur la façade principale sur laquelle tu veux travailler.', false);
            animateZoomToBuilding2D(building);
            requestAnimationFrame(() => {
                if(typeof rebuildHorizonWall === 'function') rebuildHorizonWall();
            });
            refreshNeighborhoodAroundEdgeBuilding(building);
        }

        function parseManualNeighborhoodBuildingHeight(value, floorHeightM = 3) {
            const text = String(value || '').trim().toLowerCase().replace(',', '.');
            if(!text) return null;
            const rMatch = text.match(/^r\s*\+\s*(\d+(?:\.\d+)?)$/);
            if(rMatch) {
                const upperFloors = parseFloat(rMatch[1]);
                if(Number.isFinite(upperFloors)) {
                    const levels = Math.max(1, Math.round(upperFloors + 1));
                    return {
                        levels,
                        heightM: Math.max(2, Math.min(MAX_NEIGHBORHOOD_BUILDING_HEIGHT_M, levels * floorHeightM)),
                        heightSource: 'manual-r'
                    };
                }
            }
            const meterMatch = text.match(/([-+]?\d+(?:\.\d+)?)\s*m/);
            if(meterMatch) {
                const heightM = parseFloat(meterMatch[1]);
                if(Number.isFinite(heightM) && heightM > 0) {
                    return {
                        levels: Math.max(1, Math.round(heightM / Math.max(0.5, floorHeightM))),
                        heightM: Math.max(2, Math.min(MAX_NEIGHBORHOOD_BUILDING_HEIGHT_M, heightM)),
                        heightSource: 'manual-m'
                    };
                }
            }
            const numeric = parseFloat(text);
            if(Number.isFinite(numeric) && numeric > 0) {
                const levels = Math.max(1, Math.round(numeric));
                return {
                    levels,
                    heightM: Math.max(2, Math.min(MAX_NEIGHBORHOOD_BUILDING_HEIGHT_M, levels * floorHeightM)),
                    heightSource: 'manual-levels'
                };
            }
            return null;
        }

        function editNeighborhoodBuildingHeight(building) {
            if(!building) return false;
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const currentLevels = building.levels || Math.round((building.heightM || DEFAULT_NEIGHBORHOOD_BUILDING_HEIGHT_M) / Math.max(0.5, neighborhood.floorHeightM || 3));
            const currentHeightM = Math.round((Number(building.heightM) || currentLevels * (neighborhood.floorHeightM || 3)) * 10) / 10;
            const currentLabel = building.heightSource === 'manual-r'
                ? 'R+' + Math.max(0, currentLevels - 1)
                : String(currentLevels);
            const answer = window.prompt(
                'Hauteur de ' + (building.name || 'ce bâtiment') + ' ?\nActuellement : ' + currentLevels + ' niveau(x), ' + currentHeightM + ' m.\nLes bâtiments importés sont des silhouettes OSM : les niveaux sont souvent faux. Cette hauteur est modifiable, et les bâtiments alentours peuvent aussi être corrigés.\nExemples : R+6, 7, ou 21m.',
                currentLabel
            );
            if(answer === null) {
                neighborhoodHeightEditPickArmed = false;
                setNeighborhoodStatus('Correction hauteur annulée.', false);
                return true;
            }
            const parsed = parseManualNeighborhoodBuildingHeight(answer, neighborhood.floorHeightM || 3);
            if(!parsed) {
                setNeighborhoodStatus('Hauteur non comprise. Utilise par exemple R+6, 7, ou 21m.', false);
                return true;
            }
            saveState();
            const buildings = neighborhood.buildings.map(item => {
                if(String(item.id) !== String(building.id)) return item;
                return normalizeNeighborhoodBuilding({
                    ...item,
                    heightM: parsed.heightM,
                    estimated: false,
                    levels: parsed.levels,
                    heightSource: parsed.heightSource
                });
            });
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...neighborhood,
                buildings
            });
            neighborhoodHeightEditPickArmed = false;
            hoveredNeighborhoodBuildingId = building.id || null;
            horizonSettings.enabled = true;
            rebuildHorizonWall();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            updateHorizonUI();
            draw2D();
            setNeighborhoodStatus((building.name || 'Bâtiment') + ' corrigé : ' + parsed.levels + ' niveau(x), ' + Math.round(parsed.heightM * 10) / 10 + ' m.', false);
            return true;
        }

        function getNeighborhoodBuildingSceneFootprint(building) {
            const eye = getNeighborhoodMapOrigin2D();
            const eyeX = eye.x / 20;
            const eyeZ = eye.y / 20;
            return (building && Array.isArray(building.footprint) ? building.footprint : [])
                .filter(point => point && Number.isFinite(point.x) && Number.isFinite(point.z))
                .map(point => ({ x: eyeX + point.x * 10, z: eyeZ + point.z * 10 }));
        }

        function getMyBuildingLocalSegments() {
            const nb = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!nb.enabled || !nb.supportBuildingId) return [];
            const building = nb.buildings.find(b => String(b.id) === String(nb.supportBuildingId));
            if(!building || !building.footprint || building.footprint.length < 3) return [];
            const eye = getNeighborhoodMapOrigin2D(nb);
            if(!eye || !Number.isFinite(eye.x) || !Number.isFinite(eye.y)) return [];
            const toLocal = (pt) => {
                const fixedPoint = {
                    x: eye.x + pt.x * 200,
                    y: eye.y + pt.z * 200
                };
                return typeof inverseTransformBalconyScenePoint2D === 'function'
                    ? inverseTransformBalconyScenePoint2D(fixedPoint)
                    : fixedPoint;
            };
            const fp = building.footprint;
            const localPts = fp.map(toLocal);
            const cx = localPts.reduce((s, p) => s + p.x, 0) / localPts.length;
            const cy = localPts.reduce((s, p) => s + p.y, 0) / localPts.length;
            const segs = [];
            for(let i = 0; i < localPts.length; i++) {
                const p1 = localPts[i];
                const p2 = localPts[(i + 1) % localPts.length];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const len = Math.hypot(dx, dy);
                if(len < 0.5) continue;
                const mx = (p1.x + p2.x) / 2;
                const my = (p1.y + p2.y) / 2;
                const left = { x: -dy / len, y: dx / len };
                const right = { x: dy / len, y: -dx / len };
                const interior = ((cx - mx) * left.x + (cy - my) * left.y) > 0 ? left : right;
                const exterior = { x: -interior.x, y: -interior.y };
                segs.push({ p1, p2, type: 'wall', virtual: true, inward: exterior, interior, exterior });
            }
            return segs;
        }

        function renderMyBuildingVirtualSegments2D() {
            if(!ctx2d) return;
            const segs = getMyBuildingLocalSegments();
            if(!segs.length) return;
            const lw = Math.max(1.5, 2.2 / Math.max(scale, 0.1));
            ctx2d.save();
            ctx2d.strokeStyle = 'rgba(255, 165, 40, 0.85)';
            ctx2d.lineWidth = lw;
            ctx2d.setLineDash([]);
            ctx2d.beginPath();
            segs.forEach(seg => {
                ctx2d.moveTo(seg.p1.x, seg.p1.y);
                ctx2d.lineTo(seg.p2.x, seg.p2.y);
            });
            ctx2d.stroke();
            ctx2d.fillStyle = 'rgba(255, 165, 40, 0.92)';
            const r = Math.max(2.5, 4 / Math.max(scale, 0.1));
            const seen = new Set();
            segs.forEach(seg => {
                [seg.p1, seg.p2].forEach(pt => {
                    const k = Math.round(pt.x) + ':' + Math.round(pt.y);
                    if(seen.has(k)) return;
                    seen.add(k);
                    ctx2d.beginPath();
                    ctx2d.arc(pt.x, pt.y, r, 0, Math.PI * 2);
                    ctx2d.fill();
                });
            });
            ctx2d.restore();
        }

        function getSupportBuildingEdges(building) {
            const footprint = getNeighborhoodBuildingFixedFootprint2D(building)
                .map(point => ({ x: point.x / 20, z: point.y / 20 }));
            if(footprint.length < 3) return [];
            const n = footprint.length;
            const cx = footprint.reduce((sum, point) => sum + point.x, 0) / n;
            const cz = footprint.reduce((sum, point) => sum + point.z, 0) / n;
            const edges = [];
            for(let i = 0; i < n; i++) {
                const a = footprint[i];
                const b = footprint[(i + 1) % n];
                const dx = b.x - a.x;
                const dz = b.z - a.z;
                const len = Math.hypot(dx, dz);
                if(len < 0.2) continue;
                const mx = (a.x + b.x) / 2;
                const mz = (a.z + b.z) / 2;
                const nxRaw = -dz / len;
                const nzRaw = dx / len;
                const dotToCenter = nxRaw * (cx - mx) + nzRaw * (cz - mz);
                const nx = dotToCenter > 0 ? -nxRaw : nxRaw;
                const nz = dotToCenter > 0 ? -nzRaw : nzRaw;
                const score = Math.hypot(mx, mz) - Math.min(len, 16) * 0.12;
                edges.push({ a, b, mx, mz, dx: dx / len, dz: dz / len, nx, nz, len, score });
            }
            return edges;
        }

        function getBestSupportBuildingEdge(building) {
            const edges = getSupportBuildingEdges(building);
            return edges.reduce((best, edge) => (!best || edge.score < best.score ? edge : best), null);
        }

        function normalizeSignedDeg(value) {
            let deg = Number(value) || 0;
            deg = ((deg + 180) % 360 + 360) % 360 - 180;
            return Math.abs(deg) < 0.000001 ? 0 : deg;
        }

        function normalizePositiveDeg(value) {
            const deg = Number(value) || 0;
            return ((deg % 360) + 360) % 360;
        }

        function getExteriorViewRotationDegForEdge(edge) {
            if(!edge) return 0;
            const dx = Number(edge.dx) || 0;
            const dz = Number(edge.dz) || 0;
            const nx = Number(edge.nx) || 0;
            const nz = Number(edge.nz) || 0;
            const facadeAngleDeg = Math.atan2(dz, dx) * 180 / Math.PI;
            const worldRotDeg = (Number.isFinite(balconyWorldOrientationDeg) ? balconyWorldOrientationDeg : 180) - 180;
            let viewDeg = normalizeSignedDeg(worldRotDeg - facadeAngleDeg);
            const screenMapRotRad = (viewDeg - worldRotDeg) * Math.PI / 180;
            const exteriorScreenY = nx * Math.sin(screenMapRotRad) + nz * Math.cos(screenMapRotRad);
            if(exteriorScreenY < 0) viewDeg = normalizeSignedDeg(viewDeg + 180);
            return viewDeg;
        }

        function getBalconyOrientationDegForExteriorNormal(edge) {
            if(!edge) return balconyOrientationDeg;
            const nx = Number(edge.nx) || 0;
            const nz = Number(edge.nz) || 0;
            const sceneRotDeg = Math.atan2(-nx, nz) * 180 / Math.PI;
            return normalizePositiveDeg(180 + sceneRotDeg);
        }

        function rememberSelectedBuildingFacade(building, edge) {
            if(!edge) return;
            alignedBuildingWallNormal = {
                buildingId: building && building.id ? String(building.id) : null,
                exteriorX: edge.nx,
                exteriorZ: edge.nz,
                interiorX: -edge.nx,
                interiorZ: -edge.nz,
                mx: edge.mx,
                mz: edge.mz,
                ax: edge.a && edge.a.x,
                az: edge.a && edge.a.z,
                bx: edge.b && edge.b.x,
                bz: edge.b && edge.b.z
            };
        }

        function applyExteriorDownViewForBuildingEdge(edge) {
            if(!edge) return;
            screenRotation2DDeg = getExteriorViewRotationDegForEdge(edge);
            if(typeof syncSun2dControls === 'function') syncSun2dControls();
        }

        function focus3DFromExteriorForBuildingEdge(edge) {
            if(!edge || !camera || !controls || typeof THREE === 'undefined') return false;
            const target = typeof getBalconyOrbitCenter3D === 'function'
                ? getBalconyOrbitCenter3D()
                : new THREE.Vector3(edge.mx, 8, edge.mz);
            if(!target) return false;
            const bounds = typeof getBalcony3DFramingBounds === 'function' ? getBalcony3DFramingBounds() : null;
            let distance = 52;
            if(bounds && !bounds.isEmpty()) {
                const size = bounds.getSize(new THREE.Vector3());
                distance = Math.max(36, Math.min(130, Math.max(size.x, size.z, size.y * 1.4) * 2.2));
            }
            const height = Math.max(14, Math.min(44, distance * 0.38));
            camera.position.set(
                target.x + edge.nx * distance,
                target.y + height,
                target.z + edge.nz * distance
            );
            controls.target.copy(target);
            controls.update();
            return true;
        }

        function getProjectedPointOnBuildingEdge(edge, fixedPoint = null, halfWidthM = 0) {
            if(!edge) return null;
            if(!fixedPoint || !Number.isFinite(fixedPoint.x) || !Number.isFinite(fixedPoint.y)) {
                return { x: edge.mx, z: edge.mz };
            }
            const px = fixedPoint.x / 20;
            const pz = fixedPoint.y / 20;
            const len = Math.max(0.001, edge.len || Math.hypot(edge.b.x - edge.a.x, edge.b.z - edge.a.z));
            const rawT = ((px - edge.a.x) * edge.dx + (pz - edge.a.z) * edge.dz) / len;
            const margin = Math.min(0.48, Math.max(0, halfWidthM) / len);
            const t = margin < 0.5
                ? Math.max(margin, Math.min(1 - margin, rawT))
                : 0.5;
            return {
                x: edge.a.x + edge.dx * len * t,
                z: edge.a.z + edge.dz * len * t
            };
        }

        function getJardiniereLocalRotationForFixedBackNormal(edge) {
            if(!edge) return 0;
            const fixedBackX = -(Number(edge.nx) || 0);
            const fixedBackZ = -(Number(edge.nz) || 0);
            const sceneRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const cos = Math.cos(sceneRot);
            const sin = Math.sin(sceneRot);
            const localBackX = fixedBackX * cos + fixedBackZ * sin;
            const localBackZ = -fixedBackX * sin + fixedBackZ * cos;
            return Math.atan2(-localBackX, -localBackZ);
        }

        function placeSelectedJardiniereAgainstBuildingEdge(edge, fixedPoint = null, options = {}) {
            if(!edge || !Array.isArray(jardinières) || !jardinières.length) return false;
            const jard = selected2dJardiniere || (jardinières.length === 1 ? jardinières[0] : null);
            if(!jard || !jard.pos || typeof jard.d !== 'number') return false;
            const gapDm = 1.2;
            const halfDepth = Math.max(0.1, jard.d / 2);
            const anchorPoint = options.centerOnFacade === true ? null : fixedPoint;
            const anchor = getProjectedPointOnBuildingEdge(edge, anchorPoint, (jard.w || 0) / 2) || { x: edge.mx, z: edge.mz };
            const targetFixedCenter = {
                x: (anchor.x + edge.nx * (halfDepth + gapDm)) * 20,
                y: (anchor.z + edge.nz * (halfDepth + gapDm)) * 20
            };
            const localCenter = typeof inverseTransformBalconyScenePoint2D === 'function'
                ? inverseTransformBalconyScenePoint2D(targetFixedCenter)
                : targetFixedCenter;
            jard.pos.x = localCenter.x / 20;
            jard.pos.z = localCenter.y / 20;
            jard.rot = getJardiniereLocalRotationForFixedBackNormal(edge);
            if(jard.group) {
                jard.group.position.copy(jard.pos);
                jard.group.rotation.y = jard.rot || 0;
            }
            if(typeof rebuildJardiniere === 'function') rebuildJardiniere(jard);
            if(typeof selectJardiniere === 'function') selectJardiniere(jard, { openEditor: currentEditorMode === 'jardinieres', redraw: false });
            return true;
        }

        function getDistanceToFixedSegment2D(point, a, b) {
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const lenSq = dx * dx + dy * dy;
            if(lenSq <= 0.000001) return Math.hypot(point.x - a.x, point.y - a.y);
            const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lenSq));
            const px = a.x + dx * t;
            const py = a.y + dy * t;
            return Math.hypot(point.x - px, point.y - py);
        }

        function getNearestSupportBuildingEdgeAtFixedPoint(building, point) {
            const edges = getSupportBuildingEdges(building);
            let best = null;
            edges.forEach(edge => {
                const a = { x: edge.a.x * 20, y: edge.a.z * 20 };
                const b = { x: edge.b.x * 20, y: edge.b.z * 20 };
                const distance = getDistanceToFixedSegment2D(point, a, b);
                if(!best || distance < best.distance) best = { ...edge, distance };
            });
            return best;
        }

        function alignGridToNeighborhoodBuildingEdge(building, point) {
            const edge = getNearestSupportBuildingEdgeAtFixedPoint(building, point);
            if(!edge) return false;
            const angleDeg = getBalconyOrientationDegForExteriorNormal(edge);
            neighborhoodGridAlignmentPickArmed = false;
            balconyBuildingPlacementPickArmed = false;
            pendingTouchNeighborhoodPick = null;
            updateMyBuildingPickHud();
            buildingAlignedGridActive = true;
            hoveredNeighborhoodBuildingId = building.id || null;
            rememberSelectedBuildingFacade(building, edge);
            const hasContour = hasClosedBalconyContour2D();
            if(typeof saveState === 'function') saveState();
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...(horizonSettings.neighborhood || {}),
                supportBuildingId: building.id,
                supportSide: 'outside'
            });
            if(hasContour) {
                placeBalconyOnSupportBuilding(building, { edge, activatePlacement: false, skipSnapshot: true });
            } else {
                const oldDeg = balconyOrientationDeg;
                const newDeg = angleDeg;
                if(typeof adjustHorizonAzimuthsForRotation === 'function') adjustHorizonAzimuthsForRotation(oldDeg, newDeg);
                balconyOrientationDeg = newDeg;
                balconyWorldOrientationDeg = newDeg;
                setBalconyOffsetFromLocalPointToFixedPoint(
                    { x: 0, y: 0 },
                    {
                        x: (edge.mx + edge.nx * 1.2) * 20,
                        y: (edge.mz + edge.nz * 1.2) * 20
                    }
                );
            }
            const jardinierePlaced = placeSelectedJardiniereAgainstBuildingEdge(edge, point, { centerOnFacade: true });
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();
            if(typeof syncSun2dControls === 'function') syncSun2dControls();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            focus3DFromExteriorForBuildingEdge(edge);
            applyExteriorDownViewForBuildingEdge(edge);
            if(jardinierePlaced && typeof center2DOnJardiniere === 'function') {
                const jard = selected2dJardiniere || (Array.isArray(jardinières) && jardinières.length === 1 ? jardinières[0] : null);
                center2DOnJardiniere(jard);
            }
            if(typeof rebuildHorizonWall === 'function') rebuildHorizonWall();
            if(typeof draw2D === 'function') draw2D();
            setNeighborhoodStatus(jardinierePlaced
                ? 'Façade reconnue : jardinière calée pile sur la façade, fond contre le mur, extérieur en bas.'
                : 'Façade reconnue : extérieur en bas, intérieur du bâtiment en haut. Le fond est calé contre le mur, côté extérieur.',
                false);
            return true;
        }

        function getBestSnapCandidateForBalconyEdge(building, polyFixed) {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const preferredSide = neighborhood.supportSide === 'inside' ? -1 : 1;
            const edges = getSupportBuildingEdges(building);
            const balconyEdges = getBalconyPlacementSnapEdgesFixed2D();
            if(!edges.length || !balconyEdges.length) return null;
            const targetGap = 0.12;
            const toleranceM = Math.max(2.8, Math.min(6.5, Math.max(60, 90 / Math.max(scale, 0.2)) / 20));
            let best = null;
            edges.forEach(buildingEdge => {
                balconyEdges.forEach(balconyEdge => {
                    const parallel = Math.abs(balconyEdge.dx * buildingEdge.dx + balconyEdge.dz * buildingEdge.dz);
                    const projectionA = (balconyEdge.a.x / 20 - buildingEdge.mx) * buildingEdge.nx + (balconyEdge.a.y / 20 - buildingEdge.mz) * buildingEdge.nz;
                    const projectionB = (balconyEdge.b.x / 20 - buildingEdge.mx) * buildingEdge.nx + (balconyEdge.b.y / 20 - buildingEdge.mz) * buildingEdge.nz;
                    const currentGap = (projectionA + projectionB) / 2;
                    const tilt = Math.abs(projectionA - projectionB);
                    if(!Number.isFinite(currentGap)) return;
                    const alongA = (balconyEdge.a.x / 20 - buildingEdge.mx) * buildingEdge.dx + (balconyEdge.a.y / 20 - buildingEdge.mz) * buildingEdge.dz;
                    const alongB = (balconyEdge.b.x / 20 - buildingEdge.mx) * buildingEdge.dx + (balconyEdge.b.y / 20 - buildingEdge.mz) * buildingEdge.dz;
                    const edgeHalfLen = Math.max(0.6, balconyEdge.len / 2);
                    const overlap = Math.min(buildingEdge.len / 2, Math.max(alongA, alongB) + edgeHalfLen) - Math.max(-buildingEdge.len / 2, Math.min(alongA, alongB) - edgeHalfLen);
                    if(overlap < -2.5) return;
                    const outsideDistance = Math.abs(currentGap - targetGap);
                    const insideDistance = Math.abs(currentGap + targetGap);
                    const wallBonus = balconyEdge.type === 'wall' ? 0.32 : (balconyEdge.type === 'rail' ? -0.12 : 0);
                    const lengthBonus = Math.min(balconyEdge.len, buildingEdge.len, 20) * 0.015;
                    const outsideCandidate = {
                        edge: buildingEdge,
                        balconyEdge,
                        side: 1,
                        distance: outsideDistance,
                        currentGap,
                        targetGap,
                        parallel
                    };
                    const insideCandidate = {
                        edge: buildingEdge,
                        balconyEdge,
                        side: -1,
                        distance: insideDistance,
                        currentGap,
                        targetGap: -targetGap,
                        parallel
                    };
                    [outsideCandidate, insideCandidate].forEach(candidate => {
                        if(candidate.distance > toleranceM) return;
                        const alignmentPenalty = (1 - candidate.parallel) * 2.4;
                        const sidePenalty = candidate.side === preferredSide ? 0 : 5.5;
                        const score = candidate.distance + sidePenalty + alignmentPenalty + Math.min(tilt, 2.2) * 0.35 - wallBonus - lengthBonus - Math.max(0, overlap) * 0.01;
                        if(!best || score < best.score) best = { ...candidate, score };
                    });
                });
            });
            return best;
        }

        function getBalconyPlacementSnapEdgesFixed2D() {
            const source = typeof getPrimaryContourSegments === 'function' ? getPrimaryContourSegments() : [];
            if(!source || !source.length || typeof transformBalconyScenePoint2D !== 'function') return [];
            return source
                .filter(segment => segment && segment.p1 && segment.p2 && !segment.detached)
                .map(segment => {
                    const a = transformBalconyScenePoint2D(segment.p1);
                    const b = transformBalconyScenePoint2D(segment.p2);
                    const dxPx = b.x - a.x;
                    const dzPx = b.y - a.y;
                    const lenPx = Math.hypot(dxPx, dzPx);
                    if(lenPx < 16) return null;
                    return {
                        a,
                        b,
                        dx: dxPx / lenPx,
                        dz: dzPx / lenPx,
                        len: lenPx / 20,
                        type: segment.type || 'wall',
                        segment
                    };
                })
                .filter(Boolean);
        }

        function getCurrentBalconySceneStats() {
            const polygon = getPrimaryContourPolygon2D();
            if(!isContourClosed || !polygon || polygon.length < 3) return null;
            const points = polygon.map(point => ({ x: point.x / 20, z: point.y / 20 }));
            const bounds = points.reduce((acc, point) => ({
                minX: Math.min(acc.minX, point.x),
                maxX: Math.max(acc.maxX, point.x),
                minZ: Math.min(acc.minZ, point.z),
                maxZ: Math.max(acc.maxZ, point.z)
            }), { minX: Infinity, maxX: -Infinity, minZ: Infinity, maxZ: -Infinity });
            const center = {
                x: (bounds.minX + bounds.maxX) * 0.5,
                z: (bounds.minZ + bounds.maxZ) * 0.5
            };
            return { points, centroid: center, center, bounds };
        }

        function getRotatedBalconyHalfExtentAlongNormal(points, center, rotation, nx, nz) {
            if(!Array.isArray(points) || !points.length || !center) return 7;
            const cosR = Math.cos(rotation);
            const sinR = Math.sin(rotation);
            return points.reduce((max, point) => {
                const dx = point.x - center.x;
                const dz = point.z - center.z;
                const rx = dx * cosR - dz * sinR;
                const rz = dx * sinR + dz * cosR;
                const projection = Math.abs(rx * nx + rz * nz);
                return Math.max(max, projection);
            }, 0);
        }

        function placeBalconyOnSupportBuilding(targetBuilding = null, options = {}) {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const support = targetBuilding || getNeighborhoodSupportBuilding(neighborhood);
            if(!support) {
                alert('Importe le voisinage puis choisis un bâtiment support.');
                return;
            }
            const balconyStats = getCurrentBalconySceneStats();
            if(!balconyStats) {
                alert('Ferme d’abord le contour du balcon actuel, puis clique sur le bâtiment où le placer.');
                return;
            }
            const edge = options.edge || getBestSupportBuildingEdge(support);
            if(!edge) {
                alert('Impossible de trouver une façade utilisable sur ce bâtiment.');
                return;
            }
            if(!options.skipSnapshot) {
                saveState();
                balconyBuildingPlacementSnapshot = getBalconyPlacementSnapshot();
            }
            rememberSelectedBuildingFacade(support, edge);
            balconyOrientationDeg = getBalconyOrientationDegForExteriorNormal(edge);
            balconyWorldOrientationDeg = balconyOrientationDeg;
            applyExteriorDownViewForBuildingEdge(edge);
            const rotation = (balconyOrientationDeg - 180) * Math.PI / 180;
            const localCenter = balconyStats.center || balconyStats.centroid;
            const halfDepth = getRotatedBalconyHalfExtentAlongNormal(balconyStats.points, localCenter, rotation, edge.nx, edge.nz);
            const targetCenter = {
                x: edge.mx + edge.nx * (halfDepth + 1.5),
                z: edge.mz + edge.nz * (halfDepth + 1.5)
            };
            setBalconyOffsetFromLocalPointToFixedPoint(
                { x: localCenter.x * 20, y: localCenter.z * 20 },
                { x: targetCenter.x * 20, y: targetCenter.z * 20 }
            );
            const movedConstructions = typeof alignConstructionsToBalconyCenterIfFar === 'function' && alignConstructionsToBalconyCenterIfFar();
            if(movedConstructions && typeof updateJardPanel === 'function') updateJardPanel();
            currentPoint = null;
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...neighborhood,
                supportBuildingId: support.id,
                supportSide: options.supportSide === 'inside' ? 'inside' : 'outside',
                showFootprints: true
            });
            if(options.activatePlacement !== false) {
                balconyBuildingPlacementActive = true;
                balconyBuildingPlacementPickArmed = false;
                balconyBuildingPlacementDragActive = false;
                balconyBuildingPlacementRotating = false;
                updateBalconyPlacementHud();
                snapBalconyPlacementToSupportBuilding();
            }
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            if(typeof build3DArch === 'function') build3DArch();
            applyBalconySceneTransform();
            focus3DFromExteriorForBuildingEdge(edge);
            updateHorizonUI();
            syncSun2dControls();
            draw2D();
        }

        function getFixedWorldNeighborhoodPolygons2D() {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            if(!neighborhood.enabled || !neighborhood.showFootprints || !neighborhood.buildings.length) return [];
            return neighborhood.buildings
                .map(building => ({
                    building,
                    points: getNeighborhoodBuildingFixedFootprint2D(building, neighborhood)
                }))
                .filter(entry => entry.points.length >= 3);
        }

        const neighborhoodSatelliteTileCache = {};

        function lngLatToTileFraction(lon, lat, zoom) {
            const latRad = lat * Math.PI / 180;
            const n = Math.pow(2, zoom);
            return {
                x: (lon + 180) / 360 * n,
                y: (1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n
            };
        }

        function tileToLngLat(x, y, zoom) {
            const n = Math.pow(2, zoom);
            const lon = x / n * 360 - 180;
            const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n)));
            return { lon, lat: latRad * 180 / Math.PI };
        }

        function isInFranceMetropole(lat, lon) {
            return lat >= 41.3 && lat <= 51.2 && lon >= -5.2 && lon <= 9.7;
        }

        let satelliteRedrawTimer = null;
        function scheduleSatelliteRedraw() {
            if(satelliteRedrawTimer) return;
            satelliteRedrawTimer = setTimeout(() => {
                satelliteRedrawTimer = null;
                if(typeof draw2D === 'function') draw2D();
                if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
            }, 60);
        }

        function getSatelliteTileZoom(radiusM, source) {
            if(source === 'ign') {
                if(radiusM <= 80) return 19;
                if(radiusM <= 220) return 18;
                if(radiusM <= 420) return 17;
                return 16;
            }
            if(radiusM <= 80) return 18;
            if(radiusM <= 220) return 17;
            if(radiusM <= 420) return 16;
            return 15;
        }

        function getSatelliteTileEntries(neighborhood) {
            if(!neighborhood || !Number.isFinite(neighborhood.lat) || !Number.isFinite(neighborhood.lon)) return [];
            const source = isInFranceMetropole(neighborhood.lat, neighborhood.lon) ? 'ign' : 'esri';
            const zoom = getSatelliteTileZoom(neighborhood.radiusM || 160, source);
            const metersPerLon = Math.max(1, Math.cos(neighborhood.lat * Math.PI / 180) * 111320);
            const latDelta = (neighborhood.radiusM || 160) / 111320;
            const lonDelta = (neighborhood.radiusM || 160) / metersPerLon;
            const nw = lngLatToTileFraction(neighborhood.lon - lonDelta, neighborhood.lat + latDelta, zoom);
            const se = lngLatToTileFraction(neighborhood.lon + lonDelta, neighborhood.lat - latDelta, zoom);
            const minX = Math.max(0, Math.floor(Math.min(nw.x, se.x)));
            const maxX = Math.min(Math.pow(2, zoom) - 1, Math.ceil(Math.max(nw.x, se.x)));
            const minY = Math.max(0, Math.floor(Math.min(nw.y, se.y)));
            const maxY = Math.min(Math.pow(2, zoom) - 1, Math.ceil(Math.max(nw.y, se.y)));
            const tiles = [];
            for(let x = minX; x <= maxX; x++) {
                for(let y = minY; y <= maxY; y++) tiles.push({ x, y, z: zoom, source });
            }
            return tiles.slice(0, 64);
        }

        function getSatelliteTileImage(tile) {
            const key = tile.source + '/' + tile.z + '/' + tile.x + '/' + tile.y;
            if(neighborhoodSatelliteTileCache[key]) return neighborhoodSatelliteTileCache[key];
            const image = new Image();
            image.crossOrigin = 'anonymous';
            image.referrerPolicy = 'no-referrer';
            image.onload = scheduleSatelliteRedraw;
            if(tile.source === 'ign') {
                image.src = 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&TILEMATRIXSET=PM&TILEMATRIX=' + tile.z + '&TILEROW=' + tile.y + '&TILECOL=' + tile.x + '&FORMAT=image/jpeg&STYLE=normal';
            } else {
                image.src = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/' + tile.z + '/' + tile.y + '/' + tile.x;
            }
            neighborhoodSatelliteTileCache[key] = image;
            return image;
        }

        function renderNeighborhoodSatellite2D(neighborhood) {
            if(!ctx2d || !neighborhood || !neighborhood.enabled || !neighborhood.showSatellite) return;
            const tiles = getSatelliteTileEntries(neighborhood);
            if(!tiles.length) return;
            const origin = getNeighborhoodMapOrigin2D(neighborhood);
            ctx2d.save();
            tiles.forEach(tile => {
                const image = getSatelliteTileImage(tile);
                if(!image || !image.complete || !image.naturalWidth) return;
                const nw = tileToLngLat(tile.x, tile.y, tile.z);
                const se = tileToLngLat(tile.x + 1, tile.y + 1, tile.z);
                const p1 = projectLngLatToNeighborhoodMeters(nw.lon, nw.lat, neighborhood.lon, neighborhood.lat);
                const p2 = projectLngLatToNeighborhoodMeters(se.lon, se.lat, neighborhood.lon, neighborhood.lat);
                const x = origin.x + p1.x * 200;
                const y = origin.y + p1.z * 200;
                const w = (p2.x - p1.x) * 200;
                const h = (p2.z - p1.z) * 200;
                ctx2d.globalAlpha = 0.62;
                ctx2d.drawImage(image, x, y, w, h);
            });
            ctx2d.globalAlpha = 1;
            ctx2d.restore();
        }

        function renderNeighborhoodFeatures2D(neighborhood) {
            if(!ctx2d || !neighborhood || !neighborhood.showUrbanFeatures || !Array.isArray(neighborhood.features)) return;
            const origin = getNeighborhoodMapOrigin2D(neighborhood);
            neighborhood.features.forEach(feature => {
                if(feature.kind === 'road' && feature.points && feature.points.length >= 2) {
                    ctx2d.save();
                    ctx2d.strokeStyle = feature.subtype === 'footway' || feature.subtype === 'path'
                        ? 'rgba(210, 205, 180, 0.64)'
                        : 'rgba(170, 166, 150, 0.72)';
                    ctx2d.lineWidth = Math.max(1.4 / Math.max(0.1, scale), (feature.widthM || 4) * 200);
                    ctx2d.lineCap = 'round';
                    ctx2d.lineJoin = 'round';
                    ctx2d.beginPath();
                    feature.points.forEach((point, index) => {
                        const x = origin.x + point.x * 200;
                        const y = origin.y + point.z * 200;
                        if(index === 0) ctx2d.moveTo(x, y);
                        else ctx2d.lineTo(x, y);
                    });
                    ctx2d.stroke();
                    ctx2d.restore();
                } else if(feature.kind === 'tree' && feature.point) {
                    ctx2d.save();
                    const x = origin.x + feature.point.x * 200;
                    const y = origin.y + feature.point.z * 200;
                    const r = Math.max(4, (feature.radiusM || 2.2) * 200);
                    ctx2d.fillStyle = 'rgba(65, 112, 70, 0.62)';
                    ctx2d.strokeStyle = 'rgba(34, 70, 42, 0.78)';
                    ctx2d.lineWidth = Math.max(1, 1.2 / scale);
                    ctx2d.beginPath();
                    ctx2d.arc(x, y, r, 0, Math.PI * 2);
                    ctx2d.fill();
                    ctx2d.stroke();
                    ctx2d.restore();
                }
            });
        }

        function pointInCanvasPolygon(point, polygon) {
            if(!point || !Array.isArray(polygon) || polygon.length < 3) return false;
            let inside = false;
            for(let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
                const xi = polygon[i].x, yi = polygon[i].y;
                const xj = polygon[j].x, yj = polygon[j].y;
                const intersect = ((yi > point.y) !== (yj > point.y))
                    && (point.x < (xj - xi) * (point.y - yi) / ((yj - yi) || 1e-9) + xi);
                if(intersect) inside = !inside;
            }
            return inside;
        }

        function getBalconyPlacementPolygonFixed2D() {
            const polygon = getPrimaryContourPolygon2D();
            if(!polygon.length || typeof transformBalconyScenePoint2D !== 'function') return [];
            return polygon.map(point => transformBalconyScenePoint2D(point));
        }

        function getNeighborhoodBuildingHitFixed2D(point) {
            if(!point) return null;
            const polygons = getFixedWorldNeighborhoodPolygons2D();
            for(let i = polygons.length - 1; i >= 0; i--) {
                if(pointInCanvasPolygon(point, polygons[i].points)) return polygons[i];
            }
            return null;
        }

        function getBalconyPlacementLocalStats2D() {
            const polygon = getPrimaryContourPolygon2D();
            if(!polygon || polygon.length < 3) return null;
            const bounds = polygon.reduce((acc, p) => ({
                minX: Math.min(acc.minX, p.x),
                maxX: Math.max(acc.maxX, p.x),
                minY: Math.min(acc.minY, p.y),
                maxY: Math.max(acc.maxY, p.y)
            }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
            const center = {
                x: (bounds.minX + bounds.maxX) * 0.5,
                y: (bounds.minY + bounds.maxY) * 0.5
            };
            return { polygon, bounds, center };
        }

        function getBalconyPlacementRotationHandleFixed2D() {
            const stats = getBalconyPlacementLocalStats2D();
            if(!stats || typeof transformBalconyScenePoint2D !== 'function') return null;
            const local = {
                x: stats.center.x,
                y: stats.bounds.minY - Math.max(70, 44 / Math.max(0.1, scale))
            };
            return {
                local,
                fixed: transformBalconyScenePoint2D(local),
                centerLocal: stats.center,
                centerFixed: transformBalconyScenePoint2D(stats.center)
            };
        }

        function setBalconyOffsetFromLocalPointToFixedPoint(localPoint, fixedPoint) {
            const localX = Number(localPoint && localPoint.x) || 0;
            const localY = Number(localPoint && localPoint.y) || 0;
            const fixedX = Number(fixedPoint && fixedPoint.x) || 0;
            const fixedY = Number(fixedPoint && fixedPoint.y) || 0;
            const sceneRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const cosR = Math.cos(sceneRot);
            const sinR = Math.sin(sceneRot);
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            const px = pivot.x || 0;
            const py = pivot.y || 0;
            const dx = localX - px;
            const dy = localY - py;
            const rotatedX = dx * cosR - dy * sinR + px;
            const rotatedY = dx * sinR + dy * cosR + py;
            balconyOffsetX = (fixedX - rotatedX) / 20;
            balconyOffsetZ = (fixedY - rotatedY) / 20;
        }

        function isOnBalconyPlacementRotationHandle2D(point) {
            const handle = getBalconyPlacementRotationHandleFixed2D();
            if(!handle || !point) return false;
            return Math.hypot(point.x - handle.fixed.x, point.y - handle.fixed.y) <= Math.max(14, 18 / Math.max(0.1, scale));
        }

        function setBalconyPlacementRotationKeepingAnchor(newDeg, anchorLocal, anchorFixed) {
            balconyOrientationDeg = newDeg;
            balconyWorldOrientationDeg = newDeg;
            setBalconyOffsetFromLocalPointToFixedPoint(anchorLocal, anchorFixed);
            applyBalconySceneTransform();
            syncSun2dControls();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
        }

        function snapBalconyPlacementToSupportBuilding() {
            balconyBuildingPlacementSnapPreview = null;
            if(!balconyBuildingPlacementActive || !horizonSettings || !horizonSettings.neighborhood) return false;
            const support = getNeighborhoodSupportBuilding(normalizeNeighborhoodSettings(horizonSettings.neighborhood || {}));
            if(!support) return false;
            const polyFixed = getBalconyPlacementPolygonFixed2D();
            if(polyFixed.length < 3) return false;
            const candidate = getBestSnapCandidateForBalconyEdge(support, polyFixed);
            if(!candidate || !candidate.edge) return false;
            balconyBuildingPlacementSnapPreview = candidate;
            const edge = candidate.edge;

            const handle = getBalconyPlacementRotationHandleFixed2D();
            if(handle) {
                const desiredDeg = getBalconySnapAlignedOrientationDeg(candidate);
                setBalconyPlacementRotationKeepingAnchor(desiredDeg, handle.centerLocal, handle.centerFixed);
            }

            const alignedPoly = getBalconyPlacementPolygonFixed2D();
            const alignedEdge = candidate.balconyEdge && candidate.balconyEdge.segment
                ? getTransformedBalconySegmentProjection(candidate.balconyEdge.segment, edge)
                : null;
            let alignedProjection = alignedEdge && Number.isFinite(alignedEdge.projection)
                ? alignedEdge.projection
                : (candidate.side > 0 ? Infinity : -Infinity);
            if(!alignedEdge) {
                alignedPoly.forEach(point => {
                    const projection = (point.x / 20 - edge.mx) * edge.nx + (point.y / 20 - edge.mz) * edge.nz;
                    alignedProjection = candidate.side > 0
                        ? Math.min(alignedProjection, projection)
                        : Math.max(alignedProjection, projection);
                });
            }
            if(!Number.isFinite(alignedProjection)) return false;
            const deltaM = candidate.targetGap - alignedProjection;
            balconyOffsetX += edge.nx * deltaM;
            balconyOffsetZ += edge.nz * deltaM;
            balconyBuildingPlacementSnapPreview = getBestSnapCandidateForBalconyEdge(support, getBalconyPlacementPolygonFixed2D()) || candidate;
            applyBalconySceneTransform();
            return true;
        }

        function getTransformedBalconySegmentProjection(segment, edge) {
            if(!segment || !segment.p1 || !segment.p2 || !edge || typeof transformBalconyScenePoint2D !== 'function') return null;
            const a = transformBalconyScenePoint2D(segment.p1);
            const b = transformBalconyScenePoint2D(segment.p2);
            const projectionA = (a.x / 20 - edge.mx) * edge.nx + (a.y / 20 - edge.mz) * edge.nz;
            const projectionB = (b.x / 20 - edge.mx) * edge.nx + (b.y / 20 - edge.mz) * edge.nz;
            return {
                projection: (projectionA + projectionB) / 2,
                tilt: Math.abs(projectionA - projectionB)
            };
        }

        function getBalconySnapAlignedOrientationDeg(candidate) {
            if(!candidate || !candidate.edge || !candidate.balconyEdge) return balconyOrientationDeg;
            const balconyEdge = candidate.balconyEdge;
            const buildingEdge = candidate.edge;
            const dot = balconyEdge.dx * buildingEdge.dx + balconyEdge.dz * buildingEdge.dz;
            const targetDx = dot >= 0 ? buildingEdge.dx : -buildingEdge.dx;
            const targetDz = dot >= 0 ? buildingEdge.dz : -buildingEdge.dz;
            const cross = balconyEdge.dx * targetDz - balconyEdge.dz * targetDx;
            const clampedDot = Math.max(-1, Math.min(1, balconyEdge.dx * targetDx + balconyEdge.dz * targetDz));
            const deltaDeg = Math.atan2(cross, clampedDot) * 180 / Math.PI;
            return balconyOrientationDeg + deltaDeg;
        }

        function handleBalconyBuildingPlacementPointerDown2D(fixedX, fixedY, event) {
            if(event && event.button !== 0) return false;
            const point = { x: fixedX, y: fixedY };
            if(balconyBuildingPlacementActive) {
                if(isOnBalconyPlacementRotationHandle2D(point)) {
                    const handle = getBalconyPlacementRotationHandleFixed2D();
                    balconyBuildingPlacementRotating = true;
                    balconyBuildingPlacementRotationStartAngle = Math.atan2(point.y - handle.centerFixed.y, point.x - handle.centerFixed.x);
                    balconyBuildingPlacementRotationStartDeg = balconyWorldOrientationDeg;
                    balconyBuildingPlacementRotationAnchorLocal = handle.centerLocal;
                    balconyBuildingPlacementRotationAnchorFixed = handle.centerFixed;
                    if(canvas2d) canvas2d.style.cursor = 'grabbing';
                    return true;
                }
                const poly = getBalconyPlacementPolygonFixed2D();
                if(pointInCanvasPolygon(point, poly)) {
                    balconyBuildingPlacementDragActive = true;
                    const origin = transformBalconyScenePoint2D({ x: 0, y: 0 });
                    balconyBuildingPlacementDragOffsetX = fixedX - origin.x;
                    balconyBuildingPlacementDragOffsetY = fixedY - origin.y;
                    if(canvas2d) canvas2d.style.cursor = 'grabbing';
                    return true;
                }
                return true;
            }
            if(!horizonSettings || !horizonSettings.neighborhood || !horizonSettings.neighborhood.showFootprints) return false;
            if(typeof isDrawingToolActive !== 'undefined' && isDrawingToolActive) return false;
            if(myBuildingPickArmed) {
                const hit = getNeighborhoodBuildingHitFixed2D(point);
                if(!hit || !hit.building) return false;
                if(isTouchNeighborhoodPickEvent(event)) return previewTouchNeighborhoodBuildingPick(hit.building);
                selectMyBuilding(hit.building);
                return true;
            }
            if(neighborhoodHeightEditPickArmed) {
                const hit = getNeighborhoodBuildingHitFixed2D(point);
                if(!hit || !hit.building) return false;
                editNeighborhoodBuildingHeight(hit.building);
                return true;
            }
            if(neighborhoodGridAlignmentPickArmed) {
                const hit = getNeighborhoodBuildingHitFixed2D(point);
                if(!hit || !hit.building) return false;
                if(isTouchNeighborhoodPickEvent(event)) return previewTouchNeighborhoodFacadePick(hit.building, point);
                setNeighborhoodStatus('Alignement de la façade...', true);
                const _b = hit.building, _p = { x: point.x, y: point.y };
                requestAnimationFrame(() => alignGridToNeighborhoodBuildingEdge(_b, _p));
                return true;
            }
            if(!balconyBuildingPlacementPickArmed) return false;
            const hit = getNeighborhoodBuildingHitFixed2D(point);
            if(!hit || !hit.building) return false;
            const name = hit.building.name || 'ce bâtiment';
            const ok = window.confirm('Placer le balcon actuel dans l’environnement de ' + name + ' ?');
            if(!ok) return true;
            placeBalconyOnSupportBuilding(hit.building, { activatePlacement: true });
            return true;
        }

        function handleBalconyBuildingPlacementPointerMove2D(clientX, clientY) {
            if(!canvas2d) return false;
            const rect = canvas2d.getBoundingClientRect();
            const fixedPoint = typeof screenToFixedWorld2D === 'function'
                ? screenToFixedWorld2D(clientX, clientY)
                : { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
            if(!balconyBuildingPlacementActive) {
                const pickingBuilding = (balconyBuildingPlacementPickArmed || neighborhoodGridAlignmentPickArmed || neighborhoodHeightEditPickArmed || myBuildingPickArmed);
                const hit = pickingBuilding && horizonSettings && horizonSettings.neighborhood && horizonSettings.neighborhood.showFootprints && !(typeof isDrawingToolActive !== 'undefined' && isDrawingToolActive)
                    ? getNeighborhoodBuildingHitFixed2D(fixedPoint)
                    : null;
                const nextHoveredId = hit && hit.building ? hit.building.id : null;
                let nextEdgeIdx = -1;
                if(nextHoveredId && neighborhoodGridAlignmentPickArmed && hit && hit.building) {
                    const nearestEdge = getNearestSupportBuildingEdgeAtFixedPoint(hit.building, fixedPoint);
                    if(nearestEdge) {
                        const footprint = typeof getNeighborhoodBuildingSceneFootprint === 'function'
                            ? getNeighborhoodBuildingSceneFootprint(hit.building) : [];
                        // Comparaison par coordonnées (les objets sont recréés à chaque appel)
                        nextEdgeIdx = footprint.findIndex(p =>
                            Math.abs(p.x - nearestEdge.a.x) < 0.001 &&
                            Math.abs(p.z - nearestEdge.a.z) < 0.001
                        );
                    }
                }
                if(nextHoveredId !== hoveredNeighborhoodBuildingId || nextEdgeIdx !== hoveredNeighborhoodEdgeFootprintIndex) {
                    hoveredNeighborhoodBuildingId = nextHoveredId;
                    hoveredNeighborhoodEdgeFootprintIndex = nextEdgeIdx;
                    draw2D();
                }
                if(hit && canvas2d) canvas2d.style.cursor = 'pointer';
                return !!hit;
            }
            if(balconyBuildingPlacementRotating) {
                const anchorFixed = balconyBuildingPlacementRotationAnchorFixed || fixedPoint;
                const currentAngle = Math.atan2(fixedY - anchorFixed.y, fixedX - anchorFixed.x);
                const deltaDeg = (currentAngle - balconyBuildingPlacementRotationStartAngle) * 180 / Math.PI;
                setBalconyPlacementRotationKeepingAnchor(
                    balconyBuildingPlacementRotationStartDeg + deltaDeg,
                    balconyBuildingPlacementRotationAnchorLocal,
                    anchorFixed
                );
                snapBalconyPlacementToSupportBuilding();
                draw2D();
                return true;
            }
            if(!balconyBuildingPlacementDragActive) {
                const onHandle = isOnBalconyPlacementRotationHandle2D(fixedPoint);
                const onBody = pointInCanvasPolygon(fixedPoint, getBalconyPlacementPolygonFixed2D());
                if(!balconyBuildingPlacementSnapPreview) {
                    const support = getNeighborhoodSupportBuilding(normalizeNeighborhoodSettings(horizonSettings.neighborhood || {}));
                    balconyBuildingPlacementSnapPreview = support
                        ? getBestSnapCandidateForBalconyEdge(support, getBalconyPlacementPolygonFixed2D())
                        : null;
                }
                if(canvas2d) canvas2d.style.cursor = onHandle ? 'grab' : (onBody ? 'move' : 'default');
                return true;
            }
            const targetOriginX = fixedX - balconyBuildingPlacementDragOffsetX;
            const targetOriginY = fixedY - balconyBuildingPlacementDragOffsetY;
            setBalconyOffsetFromLocalPointToFixedPoint(
                { x: 0, y: 0 },
                { x: targetOriginX, y: targetOriginY }
            );
            snapBalconyPlacementToSupportBuilding();
            applyBalconySceneTransform();
            syncSun2dControls();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            draw2D();
            return true;
        }

        function handleBalconyBuildingPlacementWheel2D(event) {
            if(!balconyBuildingPlacementActive || !event || !event.ctrlKey) return false;
            const delta = event.deltaY > 0 ? -5 : 5;
            const handle = getBalconyPlacementRotationHandleFixed2D();
            if(handle) setBalconyPlacementRotationKeepingAnchor(balconyWorldOrientationDeg + delta, handle.centerLocal, handle.centerFixed);
            else updateBalconyOrientation2D((balconyWorldOrientationDeg - 180) + delta, false);
            snapBalconyPlacementToSupportBuilding();
            draw2D();
            return true;
        }

        function renderBalconyPlacementSnapPreview2D() {
            const candidate = balconyBuildingPlacementSnapPreview;
            if(!ctx2d || !candidate || !candidate.edge || !candidate.balconyEdge) return;
            const sceneRot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            const pivot = typeof getBalconyScenePivot2D === 'function' ? getBalconyScenePivot2D() : { x: 0, y: 0 };
            ctx2d.save();
            ctx2d.translate(pivot.x || 0, pivot.y || 0);
            ctx2d.rotate(-sceneRot);
            ctx2d.translate(-(pivot.x || 0), -(pivot.y || 0));
            ctx2d.translate(-balconyOffsetX * 20, -balconyOffsetZ * 20);

            const edge = candidate.edge;
            const bx1 = edge.mx * 20 - edge.dx * edge.len * 10;
            const by1 = edge.mz * 20 - edge.dz * edge.len * 10;
            const bx2 = edge.mx * 20 + edge.dx * edge.len * 10;
            const by2 = edge.mz * 20 + edge.dz * edge.len * 10;
            ctx2d.lineCap = 'round';
            ctx2d.lineWidth = Math.max(3, 5 / scale);
            ctx2d.strokeStyle = 'rgba(42, 210, 230, 0.96)';
            ctx2d.beginPath();
            ctx2d.moveTo(bx1, by1);
            ctx2d.lineTo(bx2, by2);
            ctx2d.stroke();

            const snapX1 = candidate.balconyEdge.a.x;
            const snapY1 = candidate.balconyEdge.a.y;
            const snapX2 = candidate.balconyEdge.b.x;
            const snapY2 = candidate.balconyEdge.b.y;
            ctx2d.lineWidth = Math.max(3, 5 / scale);
            ctx2d.strokeStyle = candidate.balconyEdge.type === 'wall'
                ? 'rgba(255, 220, 72, 0.98)'
                : 'rgba(255, 160, 72, 0.92)';
            ctx2d.beginPath();
            ctx2d.moveTo(snapX1, snapY1);
            ctx2d.lineTo(snapX2, snapY2);
            ctx2d.stroke();

            const midX = (snapX1 + snapX2) / 2;
            const midY = (snapY1 + snapY2) / 2;
            const targetX = midX + edge.nx * (candidate.targetGap - candidate.currentGap) * 20;
            const targetY = midY + edge.nz * (candidate.targetGap - candidate.currentGap) * 20;
            ctx2d.setLineDash([8 / scale, 7 / scale]);
            ctx2d.lineWidth = Math.max(1.4, 2 / scale);
            ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.86)';
            ctx2d.beginPath();
            ctx2d.moveTo(midX, midY);
            ctx2d.lineTo(targetX, targetY);
            ctx2d.stroke();
            ctx2d.setLineDash([]);
            ctx2d.restore();
        }

        function renderBalconyBuildingPlacementOverlay2D() {
            if(!ctx2d || !balconyBuildingPlacementActive) return;
            const poly = getPrimaryContourPolygon2D();
            if(poly.length < 3) return;
            ctx2d.save();
            ctx2d.beginPath();
            poly.forEach((point, index) => {
                if(index === 0) ctx2d.moveTo(point.x, point.y);
                else ctx2d.lineTo(point.x, point.y);
            });
            ctx2d.closePath();
            ctx2d.fillStyle = 'rgba(255, 204, 72, 0.20)';
            ctx2d.strokeStyle = 'rgba(255, 214, 88, 0.95)';
            ctx2d.lineWidth = Math.max(2, 3 / scale);
            ctx2d.fill();
            ctx2d.stroke();
            renderBalconyPlacementSnapPreview2D();
            const cx = poly.reduce((sum, p) => sum + p.x, 0) / poly.length;
            const cy = poly.reduce((sum, p) => sum + p.y, 0) / poly.length;
            const stats = getBalconyPlacementLocalStats2D();
            if(stats) {
                const handle = {
                    x: stats.center.x,
                    y: stats.bounds.minY - Math.max(70, 44 / Math.max(0.1, scale))
                };
                ctx2d.strokeStyle = 'rgba(255, 214, 88, 0.92)';
                ctx2d.lineWidth = Math.max(1, 1.4 / scale);
                ctx2d.beginPath();
                ctx2d.moveTo(stats.center.x, stats.bounds.minY);
                ctx2d.lineTo(handle.x, handle.y);
                ctx2d.stroke();
                ctx2d.beginPath();
                ctx2d.arc(handle.x, handle.y, Math.max(9, 12 / scale), 0, Math.PI * 2);
                ctx2d.fillStyle = 'rgba(30, 20, 8, 0.92)';
                ctx2d.fill();
                ctx2d.stroke();
                ctx2d.beginPath();
                ctx2d.arc(handle.x, handle.y, Math.max(4, 5 / scale), 0.1, Math.PI * 1.55);
                ctx2d.strokeStyle = 'rgba(255, 255, 255, 0.96)';
                ctx2d.stroke();
                const arrowA = Math.PI * 1.55;
                const ar = Math.max(4, 5 / scale);
                const ax = handle.x + Math.cos(arrowA) * ar;
                const ay = handle.y + Math.sin(arrowA) * ar;
                ctx2d.fillStyle = 'rgba(255, 255, 255, 0.96)';
                ctx2d.beginPath();
                ctx2d.moveTo(ax, ay);
                ctx2d.lineTo(ax - Math.cos(arrowA - 0.7) * Math.max(5, 6 / scale), ay - Math.sin(arrowA - 0.7) * Math.max(5, 6 / scale));
                ctx2d.lineTo(ax - Math.cos(arrowA + 0.45) * Math.max(5, 6 / scale), ay - Math.sin(arrowA + 0.45) * Math.max(5, 6 / scale));
                ctx2d.closePath();
                ctx2d.fill();
            }
            ctx2d.fillStyle = 'rgba(30, 20, 8, 0.86)';
            ctx2d.strokeStyle = 'rgba(255, 214, 88, 0.95)';
            ctx2d.lineWidth = Math.max(1, 1.2 / scale);
            ctx2d.beginPath();
            ctx2d.arc(cx, cy, Math.max(8, 12 / scale), 0, Math.PI * 2);
            ctx2d.fill();
            ctx2d.stroke();
            ctx2d.restore();
        }

        let _addressAutocompleteTimer = null;
        function initAddressAutocomplete() {
            const inputs = [
                document.getElementById('horizon-address-input'),
                document.getElementById('device-location-confirm-input')
            ].filter(Boolean);
            const datalist = document.getElementById('horizon-address-suggestions');
            if(!inputs.length || !datalist) return;
            inputs.forEach(input => {
                input.setAttribute('list', 'horizon-address-suggestions');
                input.addEventListener('input', () => {
                    clearTimeout(_addressAutocompleteTimer);
                    const q = input.value.trim();
                    if(q.length < 4) { datalist.innerHTML = ''; return; }
                    _addressAutocompleteTimer = setTimeout(async () => {
                        try {
                            const [banRes, photonRes] = await Promise.allSettled([
                                fetch('https://api-adresse.data.gouv.fr/search/?limit=5&q=' + encodeURIComponent(q)),
                                fetch('https://photon.komoot.io/api/?q=' + encodeURIComponent(q) + '&lang=fr&limit=5&layer=poi&layer=city&layer=street&layer=house')
                            ]);
                            const labels = [];
                            if(banRes.status === 'fulfilled' && banRes.value.ok) {
                                const data = await banRes.value.json();
                                ((data && data.features) || []).forEach(f => {
                                    const l = f.properties && f.properties.label;
                                    if(l) labels.push(l);
                                });
                            }
                            if(photonRes.status === 'fulfilled' && photonRes.value.ok) {
                                const data = await photonRes.value.json();
                                ((data && data.features) || []).forEach(f => {
                                    const p = f.properties || {};
                                    if(p.countrycode && p.countrycode.toUpperCase() !== 'FR') return;
                                    const name = p.name;
                                    const city = p.city || p.locality;
                                    const postcode = p.postcode;
                                    const l = [name, postcode && city ? postcode + ' ' + city : city].filter(Boolean).join(', ');
                                    if(l && !labels.includes(l)) labels.push(l);
                                });
                            }
                            datalist.innerHTML = labels.map(l => '<option value="' + l.replace(/"/g, '&quot;') + '"></option>').join('');
                        } catch(_) {}
                    }, 300);
                });
            });
        }

        async function fetchOsmNeighborhoodEnvironment(origin, radiusM) {
            const cacheKey = getNeighborhoodEnvironmentCacheKey(origin, radiusM);
            const cached = readTimedNeighborhoodCache(neighborhoodEnvironmentMemoryCache, NEIGHBORHOOD_IMPORT_CACHE_PREFIX, cacheKey);
            if(cached) {
                cached.fromCache = true;
                return cached;
            }
            const latDelta = radiusM / 111320;
            const lonDelta = radiusM / Math.max(1, Math.cos(origin.lat * Math.PI / 180) * 111320);
            const south = origin.lat - latDelta;
            const north = origin.lat + latDelta;
            const west = origin.lon - lonDelta;
            const east = origin.lon + lonDelta;
            const overpassTimeout = radiusM > 200 ? 60 : 30;
            const query = `[out:json][timeout:${overpassTimeout}];(
way["building"](${south},${west},${north},${east});
way["building:part"](${south},${west},${north},${east});
relation["building"](${south},${west},${north},${east});
way["highway"](${south},${west},${north},${east});
node["natural"="tree"](${south},${west},${north},${east});
);out tags geom;`;
            const endpoints = [
                'https://overpass-api.de/api/interpreter',
                'https://overpass.kumi.systems/api/interpreter'
            ];
            let data = null;
            let lastError = null;
            for(const endpoint of endpoints) {
                try {
                    const response = await fetch(endpoint + '?data=' + encodeURIComponent(query));
                    if(!response.ok) throw new Error('Bâtiments indisponibles (' + response.status + ')');
                    data = await response.json();
                    break;
                } catch(error) {
                    lastError = error;
                }
            }
            if(!data) throw lastError || new Error('Bâtiments indisponibles');
            const elements = Array.isArray(data.elements) ? data.elements : [];
            const buildings = elements
                .filter(element => element.tags && (element.tags.building || element.tags['building:part']))
                .map(element => normalizeOsmBuildingElement(element, origin))
                .filter(Boolean)
                .filter(building => building.footprint.some(point => Math.hypot(point.x, point.z) <= radiusM));
            const roads = elements
                .filter(element => element.type === 'way' && element.tags && element.tags.highway)
                .map(element => normalizeOsmRoadElement(element, origin))
                .filter(Boolean)
                .filter(feature => feature.points.some(point => Math.hypot(point.x, point.z) <= radiusM));
            const trees = elements
                .filter(element => element.type === 'node' && element.tags && element.tags.natural === 'tree')
                .map(element => normalizeOsmTreeElement(element, origin))
                .filter(Boolean)
                .filter(feature => feature.point && Math.hypot(feature.point.x, feature.point.z) <= radiusM)
                .slice(0, 220);
            const environment = { buildings, features: roads.concat(trees) };
            writeTimedNeighborhoodCache(neighborhoodEnvironmentMemoryCache, NEIGHBORHOOD_IMPORT_CACHE_PREFIX, cacheKey, environment);
            return cloneNeighborhoodCacheValue(environment);
        }

        async function fetchOsmNeighborhoodBuildings(origin, radiusM) {
            const environment = await fetchOsmNeighborhoodEnvironment(origin, radiusM);
            return environment.buildings;
        }

        function extractPvgisHorizonProfile(data) {
            return data && data.outputs && Array.isArray(data.outputs.horizon_profile)
                ? data.outputs.horizon_profile
                : (data && Array.isArray(data.horizon_profile) ? data.horizon_profile : null);
        }

        function pvgisProfileToHorizonPoints(profile) {
            return profile.map(p => {
                // PVGIS uses the same solar convention as the app: 0 = South, -90 = East, 90 = West.
                let az = Number(p.A) % 360;
                if(az > 180) az -= 360;
                if(az <= -180) az += 360;
                return { azimut: Math.round(az * 10) / 10, elevation: Math.round(Number(p.H_hor) * 10) / 10 };
            }).filter(p => Number.isFinite(p.azimut) && Number.isFinite(p.elevation));
        }

        async function fetchPvgisHorizonPoints(lat, lon) {
            const url = 'https://re.jrc.ec.europa.eu/api/v5_2/printhorizon?lat=' + encodeURIComponent(lat) + '&lon=' + encodeURIComponent(lon) + '&outputformat=json';
            const res = await fetch(url);
            if(!res.ok) throw new Error('PVGIS indisponible (' + res.status + ')');
            const data = await res.json();
            const profile = extractPvgisHorizonProfile(data);
            if(!profile || !profile.length) throw new Error('Données horizon absentes dans la réponse PVGIS');
            const points = pvgisProfileToHorizonPoints(profile);
            if(points.length < 2) throw new Error('Profil horizon PVGIS insuffisant');
            return points;
        }

        function offsetLngLatMeters(origin, eastM, northM) {
            const metersPerLat = 111320;
            const metersPerLon = Math.max(1, Math.cos(origin.lat * Math.PI / 180) * 111320);
            return {
                lat: origin.lat + northM / metersPerLat,
                lon: origin.lon + eastM / metersPerLon
            };
        }

        async function fetchOpenElevationSamples(samples) {
            const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    locations: samples.map(sample => ({ latitude: sample.lat, longitude: sample.lon }))
                })
            });
            if(!response.ok) throw new Error('Altitudes indisponibles (' + response.status + ')');
            const data = await response.json();
            const results = data && Array.isArray(data.results) ? data.results : [];
            if(results.length !== samples.length) throw new Error('Réponse altitude incomplète');
            return results.map((result, index) => ({
                ...samples[index],
                elevationM: Number(result.elevation)
            })).filter(sample => Number.isFinite(sample.elevationM));
        }

        async function buildElevationHorizonPoints(lat, lon) {
            const origin = { lat: Number(lat), lon: Number(lon) };
            if(!Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)) throw new Error('Coordonnées invalides');
            const directions = [];
            for(let a = -180; a <= 180; a += 7.5) directions.push(Math.round(a * 10) / 10);
            const distances = [100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000, 60000];
            const samples = [{ ...origin, directionA: null, distanceM: 0 }];
            directions.forEach(directionA => {
                const rad = directionA * Math.PI / 180;
                distances.forEach(distanceM => {
                    const eastM = -Math.sin(rad) * distanceM;
                    const northM = -Math.cos(rad) * distanceM;
                    samples.push({ ...offsetLngLatMeters(origin, eastM, northM), directionA, distanceM });
                });
            });
            const elevations = await fetchOpenElevationSamples(samples);
            const originElevation = elevations[0] && elevations[0].distanceM === 0 ? elevations[0].elevationM : null;
            if(!Number.isFinite(originElevation)) throw new Error('Altitude du point de vue absente');
            const profile = directions.map(directionA => {
                const maxElevation = elevations
                    .filter(sample => sample.directionA === directionA && sample.distanceM > 0)
                    .reduce((maxAngle, sample) => {
                        const angle = Math.atan2(sample.elevationM - originElevation, sample.distanceM) * 180 / Math.PI;
                        return Math.max(maxAngle, angle);
                    }, 0);
                return { A: directionA, H_hor: Math.max(0, maxElevation) };
            });
            const points = pvgisProfileToHorizonPoints(profile);
            if(points.length < 2) throw new Error('Profil horizon par altitude insuffisant');
            return points;
        }

        async function importNeighborhoodFromOrigin(origin, options = {}) {
            const addressInput = document.getElementById('horizon-address-input');
            const floorInput = document.getElementById('horizon-floor-input');
            const radiusInput = document.getElementById('horizon-radius-neighborhood-input');
            const safeLat = Number(origin && origin.lat);
            const safeLon = Number(origin && origin.lon);
            if(!isUsableNeighborhoodCoordinate(safeLat, safeLon)) {
                throw new Error('Coordonnées invalides pour le voisinage.');
            }
            const fallbackFloor = Math.max(0, Math.min(40, Math.round(parseFloat((floorInput && floorInput.value) || '0') || 0)));
            const fallbackRadius = Math.max(40, Math.min(500, parseFloat((radiusInput && radiusInput.value) || '160') || 160));
            const floor = Math.max(0, Math.min(40, Math.round(Number.isFinite(Number(options.floor)) ? Number(options.floor) : fallbackFloor)));
            const radiusM = Math.max(40, Math.min(500, Number.isFinite(Number(options.radiusM)) ? Number(options.radiusM) : fallbackRadius));
            const providedLabel = origin && origin.label ? String(origin.label).trim() : '';
            const label = providedLabel || formatDeviceCoordinateLabel(safeLat, safeLon);
            const cleanOrigin = { lat: safeLat, lon: safeLon, label };
            if(addressInput && label) addressInput.value = label;
            if(floorInput) floorInput.value = String(floor);
            if(radiusInput) radiusInput.value = String(Math.round(radiusM));
            setNeighborhoodStatus('Import des bâtiments, routes et arbres autour de la position...', true);
            if(typeof updateDownloadProgress === 'function') updateDownloadProgress(28, 'Téléchargement OSM...');
            const environment = await fetchOsmNeighborhoodEnvironment(cleanOrigin, radiusM);
            const buildings = environment.buildings || [];
            const features = environment.features || [];
            const usedCache = !!environment.fromCache;
            if(usedCache && typeof updateDownloadProgress === 'function') updateDownloadProgress(68, 'Données locales réutilisées...');
            if(!buildings.length) {
                setNeighborhoodStatus('Aucun bâtiment OSM trouvé dans ce rayon.', false);
                if(typeof failDownloadProgress === 'function') failDownloadProgress('Aucun bâtiment trouvé.');
                return null;
            }
            neighborhoodGridAlignmentPickArmed = false;
            neighborhoodHeightEditPickArmed = false;
            myBuildingPickArmed = false;
            if(!options.preserveBuildingAlignedGrid) buildingAlignedGridActive = false;
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();
            if(typeof updateDownloadProgress === 'function') updateDownloadProgress(82, 'Construction de la scène...');
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const mapOrigin = getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                enabled: true,
                address: cleanOrigin.label,
                lat: cleanOrigin.lat,
                lon: cleanOrigin.lon,
                mapOriginX: mapOrigin.x,
                mapOriginY: mapOrigin.y,
                radiusM,
                floor,
                floorHeightM: 3,
                showFootprints: true,
                satelliteOptIn: true,
                showSatellite: true,
                showUrbanFeatures: neighborhood.showUrbanFeatures,
                supportBuildingId: options.supportBuildingId
                    ? String(options.supportBuildingId)
                    : (buildings[0] ? buildings[0].id : null),
                supportSide: neighborhood.supportSide,
                supportWidthM: neighborhood.supportWidthM,
                supportDepthM: neighborhood.supportDepthM,
                buildings,
                features
            });
            horizonSettings.enabled = true;
            if(typeof syncSun2dControls === 'function') syncSun2dControls();
            if(typeof updateSun === 'function') updateSun(sunHour2d);
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            rebuildHorizonWall();
            if(radiusM > 80) focusNeighborhoodFootprints2D(); else draw2D();
            const statusMsg = getNeighborhoodHeightWarningMessage(horizonSettings.neighborhood)
                + ' ' + features.length + ' élément(s) urbain(s)'
                + (usedCache ? ' relus depuis le cache local' : '')
                + (horizonSettings.neighborhood.showSatellite ? ', photo satellite en fond.' : '.');
            setNeighborhoodStatus(statusMsg, false);
            if(typeof finishDownloadProgress === 'function') finishDownloadProgress((usedCache ? 'Cache local : ' : '') + buildings.length + ' bâtiment(s), ' + features.length + ' élément(s).');
            if(!options.skipMyBuildingPick) armMyBuildingPick();
            return { buildings, features, origin: cleanOrigin, radiusM, floor };
        }

        async function importNeighborhoodBuildings() {
            const addressInput = document.getElementById('horizon-address-input');
            const floorInput = document.getElementById('horizon-floor-input');
            const radiusInput = document.getElementById('horizon-radius-neighborhood-input');
            const address = (addressInput && addressInput.value ? addressInput.value : '').trim();
            if(!address) {
                alert('Entre une adresse avant d’importer le voisinage.');
                return;
            }
            const floor = Math.max(0, Math.min(40, Math.round(parseFloat((floorInput && floorInput.value) || '0') || 0)));
            const radiusM = Math.max(40, Math.min(500, parseFloat((radiusInput && radiusInput.value) || '160') || 160));
            setNeighborhoodStatus("Recherche de l'adresse...", true);
            if(typeof startDownloadProgress === 'function') startDownloadProgress('Environnement urbain', "Recherche de l'adresse...", 8);
            try {
                const origin = await geocodeNeighborhoodAddress(address);
                await importNeighborhoodFromOrigin(origin, { floor, radiusM });
            } catch(error) {
                console.warn('Import voisinage impossible', error);
                const errMsg = error && error.message ? error.message : 'Import impossible pour le moment.';
                setNeighborhoodStatus(errMsg, false);
                if(typeof failDownloadProgress === 'function') failDownloadProgress('Import impossible.');
            }
        }

        function primeNeighborhoodOriginFromDevice(lat, lon, floor, radiusM) {
            const label = formatDeviceCoordinateLabel(lat, lon);
            const addressInput = document.getElementById('horizon-address-input');
            const floorInput = document.getElementById('horizon-floor-input');
            const radiusInput = document.getElementById('horizon-radius-neighborhood-input');
            if(addressInput) addressInput.value = label;
            if(floorInput) floorInput.value = String(floor);
            if(radiusInput) radiusInput.value = String(Math.round(radiusM));
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const mapOrigin = getHorizonViewpoint2D({ ignoreBalconyTransform: true });
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...neighborhood,
                enabled: false,
                address: label,
                lat,
                lon,
                mapOriginX: mapOrigin.x,
                mapOriginY: mapOrigin.y,
                radiusM,
                floor,
                showFootprints: true,
                supportBuildingId: null,
                buildings: [],
                features: []
            });
            horizonSettings.enabled = horizonSettings.silhouettes.some(shape => shape.points.length >= 2);
            if(typeof syncSun2dControls === 'function') syncSun2dControls();
            if(typeof updateSun === 'function') updateSun(sunHour2d);
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            rebuildHorizonWall();
            if(typeof draw2D === 'function') draw2D();
            setNeighborhoodStatus('Position actuelle trouvée. Import de ton environnement urbain...', true);
            return label;
        }

        function updateDeviceOriginLabelIfCurrent(lat, lon, labelPromise) {
            labelPromise.then(label => {
                if(!label) return;
                const neighborhood = normalizeNeighborhoodSettings(horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : {});
                if(Math.abs(Number(neighborhood.lat) - Number(lat)) > 0.00001 || Math.abs(Number(neighborhood.lon) - Number(lon)) > 0.00001) return;
                horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                    ...neighborhood,
                    address: label
                });
                const addressInput = document.getElementById('horizon-address-input');
                if(addressInput) addressInput.value = label;
                saveState();
                if(typeof syncSun2dControls === 'function') syncSun2dControls();
            }).catch(() => {});
        }

        function getDeviceLocationConfirmDialog() {
            return document.getElementById('device-location-confirm-dialog');
        }

        function setDeviceLocationGoButtonPrimary(primary) {
            const goButton = document.getElementById('device-location-confirm-go');
            if(!goButton) return;
            goButton.classList.toggle('pwa-update-primary', !!primary);
            goButton.classList.toggle('pwa-update-secondary', !primary);
        }

        function handleDeviceLocationAddressEdit() {
            const yesButton = document.getElementById('device-location-confirm-yes');
            if(yesButton) yesButton.style.display = 'none';
            setDeviceLocationGoButtonPrimary(true);
        }

        function isDeviceDialogVisible(dialog) {
            return !!(dialog && dialog.classList.contains('visible') && dialog.getAttribute('aria-hidden') !== 'true');
        }

        function getVisibleDeviceDialogPrimaryButton() {
            const dialogs = [
                getDeviceLocationConfirmDialog(),
                getDeviceContextDialog()
            ];
            for(const dialog of dialogs) {
                if(!isDeviceDialogVisible(dialog)) continue;
                const primaryButtons = Array.from(dialog.querySelectorAll('.pwa-update-primary'));
                const button = primaryButtons.find(btn => {
                    if(!btn || btn.disabled) return false;
                    if(btn.style && btn.style.display === 'none') return false;
                    const style = window.getComputedStyle ? window.getComputedStyle(btn) : null;
                    return !style || (style.display !== 'none' && style.visibility !== 'hidden' && style.pointerEvents !== 'none');
                });
                if(button) return button;
            }
            return null;
        }

        function handleDeviceDialogEnterKey(event) {
            if(!event || event.key !== 'Enter' || event.isComposing) return;
            if(event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
            const button = getVisibleDeviceDialogPrimaryButton();
            if(!button) return;
            event.preventDefault();
            button.click();
        }

        document.removeEventListener('keydown', handleDeviceDialogEnterKey);
        document.addEventListener('keydown', handleDeviceDialogEnterKey);

        function setDeviceLocationConfirmDialogVisible(visible) {
            const dialog = getDeviceLocationConfirmDialog();
            if(!dialog) return;
            dialog.classList.toggle('visible', !!visible);
            dialog.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }

        function showDeviceLocationConfirmation(context) {
            pendingDeviceLocationContext = context;
            const title = document.getElementById('device-location-confirm-title');
            const text = document.getElementById('device-location-confirm-text');
            const input = document.getElementById('device-location-confirm-input');
            const yesButton = document.getElementById('device-location-confirm-yes');
            const label = context && context.detectedAddress ? context.detectedAddress : '';
            const searching = !!(context && context.addressLookupPending);
            if(title) {
                title.textContent = label ? 'Adresse détectée' : (searching ? 'Localisation GPS' : 'Adresse à saisir');
            }
            if(text) {
                if(label) {
                    text.textContent = 'Tu es bien localisé au "' + label + '" ?';
                } else if(searching) {
                    text.textContent = 'Position GPS trouvée. Recherche de l’adresse la plus proche...';
                } else if(context && context.manualOnly) {
                    text.textContent = context.manualMessage || 'La position automatique est indisponible. Entre ton adresse pour importer ton environnement urbain.';
                } else {
                    text.textContent = 'Position GPS trouvée, mais aucune adresse proche n’a été reconnue. Entre ton adresse pour importer ton environnement urbain.';
                }
            }
            if(input) {
                input.value = label;
                input.placeholder = label ? 'Corrige si besoin' : (searching ? 'Recherche de l’adresse proche...' : 'Entre ton adresse');
            }
            if(yesButton) {
                yesButton.disabled = !label;
                yesButton.style.display = label ? '' : 'none';
            }
            setDeviceLocationGoButtonPrimary(!label && !searching);
            setDeviceLocationConfirmDialogVisible(true);
            if(input && !label && !searching) input.focus();
        }

        function updateDeviceLocationConfirmationAddress(context, detectedAddress) {
            if(!context || pendingDeviceLocationContext !== context) return;
            context.addressLookupPending = false;
            context.detectedAddress = detectedAddress || '';
            showDeviceLocationConfirmation(context);
        }

        function cancelDeviceLocationConfirmation() {
            pendingDeviceLocationContext = null;
            setDeviceLocationConfirmDialogVisible(false);
            setNeighborhoodStatus('Import annulé. Tu peux entrer ton adresse ou relancer la position actuelle.', false);
            if(typeof failDownloadProgress === 'function') failDownloadProgress('Import annulé.');
        }

        async function importDeviceLocationContext(origin, context) {
            if(!context) throw new Error('Position actuelle absente.');
            setDeviceLocationConfirmDialogVisible(false);
            const addressInput = document.getElementById('horizon-address-input');
            if(addressInput && origin && origin.label) addressInput.value = origin.label;
            if(typeof startDownloadProgress === 'function') startDownloadProgress('Environnement urbain', 'Import de ton environnement...', 16);
            const result = await importNeighborhoodFromOrigin(origin, {
                floor: context.floor,
                radiusM: context.radiusM
            });
            if(result) {
                pendingDeviceLocationContext = null;
                setDeviceContextPromptPreference('accepted');
            }
            return result;
        }

        async function confirmDetectedDeviceLocation() {
            const context = pendingDeviceLocationContext;
            if(!context) return;
            const input = document.getElementById('device-location-confirm-input');
            const floorInput = document.getElementById('device-location-floor-input');
            const label = (input && input.value ? input.value : context.detectedAddress || formatDeviceCoordinateLabel(context.lat, context.lon)).trim();
            const floor = Math.max(0, Math.min(40, Math.round(parseFloat((floorInput && floorInput.value) || '0') || 0)));
            try {
                await importDeviceLocationContext({ lat: context.lat, lon: context.lon, label }, { ...context, floor });
            } catch(error) {
                console.warn('Import position confirmée impossible', error);
                const errMsg = error && error.message ? error.message : 'Import impossible pour le moment.';
                setNeighborhoodStatus(errMsg, false);
                if(typeof failDownloadProgress === 'function') failDownloadProgress('Import impossible.');
            }
        }

        async function importEditedDeviceLocationAddress() {
            const context = pendingDeviceLocationContext;
            const input = document.getElementById('device-location-confirm-input');
            const floorInput = document.getElementById('device-location-floor-input');
            const address = (input && input.value ? input.value : '').trim();
            if(!address) {
                if(input) input.focus();
                setNeighborhoodStatus('Entre une adresse pour corriger la position.', false);
                return;
            }
            const floor = Math.max(0, Math.min(40, Math.round(parseFloat((floorInput && floorInput.value) || '0') || 0)));
            setDeviceLocationConfirmDialogVisible(false);
            setNeighborhoodStatus("Recherche de l'adresse corrigée...", true);
            if(typeof startDownloadProgress === 'function') startDownloadProgress('Environnement urbain', "Recherche de l'adresse corrigée...", 12);
            try {
                const origin = await geocodeNeighborhoodAddress(address);
                await importDeviceLocationContext(origin, context ? { ...context, floor } : {
                    floor,
                    radiusM: 160
                });
            } catch(error) {
                console.warn('Adresse corrigée introuvable', error);
                const errMsg = error && error.message ? error.message : 'Adresse introuvable.';
                setNeighborhoodStatus(errMsg, false);
                if(typeof failDownloadProgress === 'function') failDownloadProgress('Adresse introuvable.');
                setDeviceLocationConfirmDialogVisible(true);
                if(input) input.focus();
            }
        }

        function getDeviceGeolocationPosition(options = {}) {
            return new Promise((resolve, reject) => {
                if(!navigator.geolocation) {
                    reject(new Error('Géolocalisation indisponible dans ce navigateur.'));
                    return;
                }
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    enableHighAccuracy: options.enableHighAccuracy !== false,
                    timeout: Number.isFinite(Number(options.timeout)) ? Number(options.timeout) : 12000,
                    maximumAge: Number.isFinite(Number(options.maximumAge)) ? Number(options.maximumAge) : 300000
                });
            });
        }

        async function getBestDeviceGeolocationPosition() {
            try {
                return await getDeviceGeolocationPosition({
                    enableHighAccuracy: true,
                    timeout: 12000,
                    maximumAge: 300000
                });
            } catch(firstError) {
                console.warn('GPS précis indisponible, seconde tentative plus tolérante', firstError);
                try {
                    return await getDeviceGeolocationPosition({
                        enableHighAccuracy: false,
                        timeout: 18000,
                        maximumAge: 3600000
                    });
                } catch(secondError) {
                    secondError.firstGeolocationError = firstError;
                    throw secondError;
                }
            }
        }

        function getDeviceGeolocationErrorMessage(error) {
            if(error && error.code === 1) return 'Position refusée par le navigateur.';
            if(error && error.code === 2) return 'Position actuelle indisponible.';
            if(error && error.code === 3) return 'Délai dépassé pour la position actuelle.';
            return error && error.message ? error.message : 'Position actuelle indisponible.';
        }

        function showManualDeviceAddressFallback(message, floor, radiusM) {
            pendingDeviceLocationContext = {
                lat: null,
                lon: null,
                floor,
                radiusM,
                coordinateLabel: '',
                detectedAddress: '',
                addressLookupPending: false,
                manualOnly: true,
                manualMessage: message + ' Entre ton adresse pour importer ton environnement urbain.'
            };
            const title = document.getElementById('device-location-confirm-title');
            const text = document.getElementById('device-location-confirm-text');
            const input = document.getElementById('device-location-confirm-input');
            const yesButton = document.getElementById('device-location-confirm-yes');
            if(title) title.textContent = 'Aucune adresse détectée';
            if(text) text.textContent = pendingDeviceLocationContext.manualMessage;
            if(input) {
                input.value = '';
                input.placeholder = 'Entre ton adresse';
            }
            if(yesButton) {
                yesButton.disabled = true;
                yesButton.style.display = 'none';
            }
            setDeviceLocationGoButtonPrimary(true);
            setDeviceLocationConfirmDialogVisible(true);
            if(input) input.focus();
        }

        function getDeviceContextDialog() {
            return document.getElementById('device-context-dialog');
        }

        function setDeviceContextDialogVisible(visible) {
            const dialog = getDeviceContextDialog();
            if(!dialog) return;
            dialog.classList.toggle('visible', !!visible);
            dialog.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }

        function getDeviceContextPromptPreference() {
            try {
                return window.localStorage ? localStorage.getItem(DEVICE_CONTEXT_PROMPT_KEY) : '';
            } catch(_) {
                return '';
            }
        }

        function setDeviceContextPromptPreference(value) {
            try {
                if(window.localStorage) localStorage.setItem(DEVICE_CONTEXT_PROMPT_KEY, value);
            } catch(_) {}
        }

        function hasImportedNeighborhoodDeviceContext() {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings && horizonSettings.neighborhood ? horizonSettings.neighborhood : {});
            return isUsableNeighborhoodCoordinate(neighborhood.lat, neighborhood.lon)
                && neighborhood.enabled
                && Array.isArray(neighborhood.buildings)
                && neighborhood.buildings.length > 0;
        }

        function maybeShowDeviceContextPrompt() {
            if(getDeviceContextPromptPreference() === 'accepted' && hasImportedNeighborhoodDeviceContext()) return;
            if(hasImportedNeighborhoodDeviceContext()) return;
            setDeviceContextDialogVisible(true);
        }

        function dismissDeviceContextPrompt() {
            setDeviceContextDialogVisible(false);
        }

        async function useDeviceContextPrompt() {
            setDeviceContextDialogVisible(false);
            await requestDeviceContextForSolarAndNeighborhood();
        }

        async function requestDeviceContextForSolarAndNeighborhood() {
            if(typeof applyCurrentDeviceSunTime === 'function') {
                applyCurrentDeviceSunTime();
            }
            if(!navigator.geolocation) {
                const message = 'Ce navigateur ne donne pas de position actuelle.';
                setNeighborhoodStatus(message, false);
                alert(message);
                return false;
            }
            const floorInput = document.getElementById('horizon-floor-input');
            const radiusInput = document.getElementById('horizon-radius-neighborhood-input');
            const floor = Math.max(0, Math.min(40, Math.round(parseFloat((floorInput && floorInput.value) || '0') || 0)));
            const radiusM = Math.max(40, Math.min(500, parseFloat((radiusInput && radiusInput.value) || '160') || 160));
            setNeighborhoodStatus('Autorise la position actuelle dans le navigateur...', true);
            if(typeof startDownloadProgress === 'function') startDownloadProgress('Position actuelle', 'Attente de la position...', 5);
            try {
                const position = await getBestDeviceGeolocationPosition();
                const lat = position && position.coords ? Number(position.coords.latitude) : NaN;
                const lon = position && position.coords ? Number(position.coords.longitude) : NaN;
                if(!isUsableNeighborhoodCoordinate(lat, lon)) throw new Error('Coordonnées appareil invalides.');
                if(typeof updateDownloadProgress === 'function') updateDownloadProgress(18, 'Position trouvée...');
                const coordinateLabel = primeNeighborhoodOriginFromDevice(lat, lon, floor, radiusM);
                const context = {
                    lat,
                    lon,
                    floor,
                    radiusM,
                    coordinateLabel,
                    detectedAddress: '',
                    addressLookupPending: true
                };
                showDeviceLocationConfirmation(context);
                setNeighborhoodStatus('GPS trouvé. Recherche de l’adresse proche...', true);
                if(typeof updateDownloadProgress === 'function') updateDownloadProgress(26, 'Recherche de l’adresse proche...');
                reverseGeocodeDeviceLocation(lat, lon).then(detectedAddress => {
                    updateDeviceOriginLabelIfCurrent(lat, lon, Promise.resolve(detectedAddress));
                    updateDeviceLocationConfirmationAddress(context, detectedAddress);
                    setNeighborhoodStatus('Adresse proche détectée. Confirme avant import.', false);
                    if(typeof finishDownloadProgress === 'function') finishDownloadProgress('Adresse à confirmer.');
                }).catch(error => {
                    console.warn('Adresse appareil non résolue, confirmation manuelle demandée', error);
                    updateDeviceLocationConfirmationAddress(context, '');
                    setNeighborhoodStatus('Adresse non reconnue. Corrige ou entre ton adresse.', false);
                    if(typeof finishDownloadProgress === 'function') finishDownloadProgress('Adresse à saisir.');
                });
                return true;
            } catch(error) {
                console.warn('Position actuelle indisponible', error);
                const errMsg = getDeviceGeolocationErrorMessage(error);
                showManualDeviceAddressFallback(errMsg, floor, radiusM);
                setNeighborhoodStatus(errMsg + ' Entre ton adresse pour continuer.', false);
                if(typeof finishDownloadProgress === 'function') finishDownloadProgress('Adresse à saisir.');
                return false;
            }
        }

        function clearNeighborhoodBuildings() {
            saveState();
            horizonSettings = normalizeHorizonSettings(horizonSettings);
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...horizonSettings.neighborhood,
                enabled: false,
                buildings: [],
                features: []
            });
            balconyBuildingPlacementPickArmed = false;
            neighborhoodGridAlignmentPickArmed = false;
            neighborhoodHeightEditPickArmed = false;
            myBuildingPickArmed = false;
            updateMyBuildingPickHud();
            buildingAlignedGridActive = false;
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();
            hoveredNeighborhoodBuildingId = null;
            horizonSettings.enabled = horizonSettings.silhouettes.some(shape => shape.points.length >= 2);
            rebuildHorizonWall();
            setNeighborhoodStatus('', false);
        }

        async function importPvgisHorizon() {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const pvgisStatus = document.getElementById('horizon-pvgis-status');
            function setStatus(msg, loading) {
                if(pvgisStatus) { pvgisStatus.textContent = msg; pvgisStatus.style.opacity = loading ? '0.65' : '1'; }
            }
            let lat = neighborhood.lat;
            let lon = neighborhood.lon;
            let resolvedAddress = neighborhood.address || '';
            if(!lat || !lon) {
                const addressInput = document.getElementById('horizon-address-input');
                const address = (addressInput && addressInput.value ? addressInput.value : '').trim();
                if(!address) {
                    setStatus('Entre une adresse dans la section Voisinage pour importer l\'horizon PVGIS.', false);
                    return;
                }
                setStatus('Géocodage de l\'adresse…', true);
                try {
                    const origin = await geocodeNeighborhoodAddress(address);
                    lat = origin.lat;
                    lon = origin.lon;
                    resolvedAddress = origin.label;
                } catch(e) {
                    setStatus('Adresse introuvable : ' + (e && e.message ? e.message : e), false);
                    return;
                }
            }
            setStatus('Téléchargement horizon PVGIS…', true);
            try {
                let points = [];
                let sourceLabel = 'PVGIS';
                try {
                    points = await fetchPvgisHorizonPoints(lat, lon);
                } catch(pvgisError) {
                    console.warn('PVGIS bloqué ou indisponible, fallback altitude', pvgisError);
                    setStatus('PVGIS bloqué par le navigateur, calcul par altitudes…', true);
                    points = await buildElevationHorizonPoints(lat, lon);
                    sourceLabel = 'altitudes';
                }
                saveState();
                horizonSettings = normalizeHorizonSettings(horizonSettings);
                horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                    ...(horizonSettings.neighborhood || {}),
                    address: resolvedAddress,
                    lat,
                    lon
                });
                // Remplace ou ajoute la silhouette "Horizon naturel"
                const existingIdx = horizonSettings.silhouettes.findIndex(s => s.name === 'Horizon naturel');
                const newShape = { name: 'Horizon naturel', distanceM: 10000, points };
                if(existingIdx >= 0) {
                    horizonSettings.silhouettes[existingIdx] = normalizeHorizonSilhouette(newShape, existingIdx, 10000);
                } else {
                    horizonSettings.silhouettes.push(normalizeHorizonSilhouette(newShape, horizonSettings.silhouettes.length, 10000));
                }
                horizonSettings.enabled = true;
                if(typeof syncSun2dControls === 'function') syncSun2dControls();
                if(typeof updateSun === 'function') updateSun(sunHour2d);
                if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
                rebuildHorizonWall();
                setStatus(points.length + ' directions importées (' + sourceLabel + ').', false);
            } catch(e) {
                console.warn('Import horizon PVGIS impossible', e);
                setStatus('Erreur horizon réel : ' + (e && e.message ? e.message : e), false);
            }
        }

        function autoVisAVisFromNeighborhood() {
            const neighborhood = normalizeNeighborhoodSettings(horizonSettings.neighborhood || {});
            const buildings = neighborhood.buildings || [];
            if(!neighborhood.enabled || !buildings.length) {
                alert('Importe d\'abord le voisinage urbain.');
                return;
            }
            markVisAVisDirty();
            draw2D();
        }

        function updateHorizonPointsFromText(text) {
            const silhouettes = parseHorizonSilhouettesText(text);
            if(!silhouettes.length) {
                alert('Ajoute au moins une silhouette avec deux points.');
                updateHorizonUI();
                return;
            }
            saveState();
            horizonSettings.silhouettes = silhouettes;
            horizonSettings.points = silhouettes[0].points.map(p => ({ ...p }));
            horizonActiveSilhouetteIndex = 0;
            horizonActiveDistanceM = silhouettes[0].distanceM;
            horizonSettings.activeSilhouetteIndex = 0;
            horizonSettings.activeDistanceM = horizonActiveDistanceM;
            horizonSettings.enabled = true;
            rebuildHorizonWall();
        }

        function applyHorizonFromPanel() {
            const textInput = document.getElementById('horizon-points-input');
            updateHorizonPointsFromText(textInput ? textInput.value : horizonPointsToText());
        }

        function setSampleHorizon() {
            saveState();
            horizonSettings.silhouettes = [
                normalizeHorizonSilhouette({
                    name: 'Immeuble loin',
                    distanceM: 38,
                    points: [
                        { azimut: -78, elevation: 8 },
                        { azimut: -46, elevation: 22 },
                        { azimut: -18, elevation: 32 },
                        { azimut: 14, elevation: 26 },
                        { azimut: 52, elevation: 14 },
                        { azimut: 82, elevation: 9 }
                    ]
                }, 0, 38),
                normalizeHorizonSilhouette({
                    name: 'Arbre proche',
                    distanceM: 12,
                    points: [
                        { azimut: -16, elevation: 4 },
                        { azimut: -4, elevation: 24 },
                        { azimut: 12, elevation: 18 },
                        { azimut: 24, elevation: 5 }
                    ]
                }, 1, 12)
            ];
            horizonSettings.points = horizonSettings.silhouettes[0].points.map(p => ({ ...p }));
            horizonSettings.activeSilhouetteIndex = 0;
            horizonSettings.activeDistanceM = horizonSettings.silhouettes[0].distanceM;
            horizonActiveSilhouetteIndex = 0;
            horizonActiveDistanceM = horizonSettings.activeDistanceM;
            horizonSettings.enabled = true;
            rebuildHorizonWall();
        }

        function clearHorizon() {
            saveState();
            horizonSettings.enabled = false;
            horizonSettings.silhouettes = [];
            horizonSettings.points = [];
            horizonSettings.neighborhood = normalizeNeighborhoodSettings({
                ...(horizonSettings.neighborhood || {}),
                enabled: false,
                buildings: []
            });
            horizonDraftPoints = [];
            rebuildHorizonWall();
        }
