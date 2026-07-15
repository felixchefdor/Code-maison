        function isUiElementVisible(el) {
            if(!el) return false;
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
        }

        function getOccludingLeftInset(container, selectors, bounds = null) {
            if(!container) return 0;
            const containerRect = container.getBoundingClientRect();
            const activeBounds = bounds || {
                left: containerRect.left,
                right: containerRect.right,
                top: containerRect.top,
                bottom: containerRect.bottom
            };
            const intervals = [];

            selectors.forEach(selector => {
                document.querySelectorAll(selector).forEach(el => {
                    if(!isUiElementVisible(el)) return;
                    const rect = el.getBoundingClientRect();
                    const overlapLeft = Math.max(activeBounds.left, rect.left);
                    const overlapRight = Math.min(activeBounds.right, rect.right);
                    const overlapTop = Math.max(activeBounds.top, rect.top);
                    const overlapBottom = Math.min(activeBounds.bottom, rect.bottom);
                    if(overlapRight <= overlapLeft || overlapBottom <= overlapTop) return;
                    intervals.push([overlapLeft, overlapRight]);
                });
            });

            if(intervals.length === 0) return 0;

            intervals.sort((a, b) => a[0] - b[0]);
            let coveredUntil = activeBounds.left;
            const tolerance = 4;

            for(const [start, end] of intervals) {
                if(start > coveredUntil + tolerance) break;
                coveredUntil = Math.max(coveredUntil, end);
            }

            return Math.max(0, coveredUntil - activeBounds.left);
        }

        function getLeftUiSelectors() {
            return [
                '.editor-tabs',
                '.sidebar-2d:not(.hidden)',
                '#jard-panel-2d.visible',
                '#devis-panel-2d.visible',
                '#chantier-panel-2d.visible'
            ];
        }

        function getRenderStage() {
            return document.getElementById('render-stage');
        }

        function getPane2D() {
            return document.getElementById('pane-2d');
        }

        function getPane3D() {
            return document.getElementById('pane-3d');
        }

        function getRenderStageRect() {
            const stage = getRenderStage();
            return stage ? stage.getBoundingClientRect() : null;
        }

        function getRenderStageSize() {
            const stage = getRenderStage();
            return {
                width: stage ? stage.clientWidth : 0,
                height: stage ? stage.clientHeight : 0
            };
        }

        function getPane2DSize() {
            const pane = getPane2D();
            return {
                width: pane ? pane.clientWidth : 0,
                height: pane ? pane.clientHeight : 0
            };
        }

        function getLeftUiInset() {
            const container = document.getElementById('canvas-container');
            if(!container) return 0;
            return getOccludingLeftInset(container, getLeftUiSelectors());
        }

        function getMixedViewMinSplitPixel() {
            return 0;
        }

        function clampMixedSplitPixel(rawPx) {
            const { width } = getRenderStageSize();
            const minSplit = 0;
            const maxSplit = Math.max(minSplit, width);
            return Math.round(Math.min(maxSplit, Math.max(minSplit, rawPx)));
        }

        function getDefaultMixedSplitPixel() {
            const { width } = getRenderStageSize();
            const minSplit = 0;
            const maxSplit = Math.max(minSplit, width);
            return Math.round((minSplit + maxSplit) / 2);
        }

        function getMixedVisibleBounds() {
            const { width } = getRenderStageSize();
            const minSplit = 0;
            const maxSplit = Math.max(minSplit, width);
            return {
                minSplit,
                maxSplit,
                usableWidth: Math.max(0, maxSplit - minSplit)
            };
        }

        function applyRenderStageLayout(leftInset, splitPx) {
            const container = document.getElementById('canvas-container');
            const viewport = document.getElementById('viewport');
            const stage = getRenderStage();
            const pane2d = getPane2D();
            const pane3d = getPane3D();
            const splitter = document.getElementById('view-splitter');
            if(!container || !stage || !pane2d || !pane3d) return;

            const stageWidth = Math.max(0, container.clientWidth - leftInset);
            const bottomPanel = document.getElementById('arch-panel-2d');
            const bottomInset = bottomPanel && bottomPanel.classList.contains('visible') ? bottomPanel.offsetHeight : 0;
            const stageHeight = Math.max(0, container.clientHeight - bottomInset);
            renderStageLeftPx = leftInset;
	            stage.style.left = leftInset + 'px';
	            stage.style.right = '0px';
	            stage.style.bottom = bottomInset + 'px';
	            stage.style.width = 'auto';

	            if(activeMainView === 'mixte') {
	                let px = clampMixedSplitPixel(splitPx);
	                splitPixelX = px;
	                splitPosition = stageWidth > 0 ? (px / stageWidth) : splitPosition;
	                pane2d.style.display = 'block';
	                pane2d.style.left = '0px';
	                pane2d.style.right = 'auto';
	                pane2d.style.width = px + 'px';
	                pane3d.style.display = 'block';
	                pane3d.style.left = px + 'px';
	                pane3d.style.right = '0px';
	                pane3d.style.width = Math.max(0, stageWidth - px) + 'px';
	                canvas2d.style.display = 'block';
		                splitter.style.left = px + 'px';
                    if(splitter) {
                        splitter.style.top = '0px';
                        splitter.style.bottom = '0px';
                    }
	            } else if(activeMainView === '2d') {
	                splitPixelX = stageWidth;
	                pane2d.style.display = 'block';
	                pane2d.style.left = '0px';
	                pane2d.style.right = '0px';
	                pane2d.style.width = 'auto';
	                pane3d.style.display = 'none';
	                pane3d.style.left = stageWidth + 'px';
	                pane3d.style.right = 'auto';
	                pane3d.style.width = '0px';
	                canvas2d.style.display = 'block';
	            } else {
	                splitPixelX = 0;
	                pane2d.style.display = 'none';
	                pane2d.style.left = '0px';
	                pane2d.style.right = 'auto';
	                pane2d.style.width = '0px';
	                pane3d.style.display = 'block';
	                pane3d.style.left = '0px';
	                pane3d.style.right = '0px';
	                pane3d.style.width = stageWidth + 'px';
	                canvas2d.style.display = 'none';
	            }

            pane2d.style.height = stageHeight + 'px';
            pane3d.style.height = stageHeight + 'px';

            if(renderer && camera) {
                const visible3dWidth = activeMainView === 'mixte'
                    ? Math.max(1, stageWidth - splitPixelX)
                    : Math.max(1, stageWidth);
                renderer.setSize(visible3dWidth, Math.max(1, stageHeight));
                camera.aspect = visible3dWidth / Math.max(1, stageHeight);
                camera.updateProjectionMatrix();
            }

            updateSketchLockUI();
        }

        function updateRenderStageLayout(options = {}) {
            const { animate = false } = options;
            const container = document.getElementById('canvas-container');
            const stage = getRenderStage();
            if(!container || !stage) return;

	            const targetLeftInset = activeMainView === '2d' ? 0 : getLeftUiInset();
            // Calcul basé sur container.clientWidth - targetLeftInset pour éviter
            // de lire stage.clientWidth qui est encore obsolète avant applyRenderStageLayout.
            const newStageWidth = Math.max(0, container.clientWidth - targetLeftInset);
            let targetSplitPx = 0;
            if(activeMainView === 'mixte') {
                targetSplitPx = Math.round(mixedVisibleRatio * newStageWidth);
                if(!(targetSplitPx > 0)) targetSplitPx = Math.round(newStageWidth / 2);
                targetSplitPx = Math.min(newStageWidth, Math.max(0, targetSplitPx));
            } else if(activeMainView === '2d') {
                targetSplitPx = newStageWidth;
            }

            if(layoutAnimationFrame) {
                cancelAnimationFrame(layoutAnimationFrame);
                layoutAnimationFrame = null;
            }

            const shouldAnimate = animate && !isDraggingSplitter;
            if(!shouldAnimate) {
                applyRenderStageLayout(targetLeftInset, targetSplitPx);
                return;
            }

            const startLeft = renderStageLeftPx || targetLeftInset;
            const startSplit = splitPixelX || targetSplitPx;
            const duration = 180;
            const startTime = performance.now();

            const step = (now) => {
                const t = Math.min(1, (now - startTime) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                const currentLeft = startLeft + (targetLeftInset - startLeft) * eased;
                const currentSplit = startSplit + (targetSplitPx - startSplit) * eased;
                applyRenderStageLayout(currentLeft, currentSplit);
                if(activeMainView === '2d' || activeMainView === 'mixte') draw2D();
                if(t < 1) {
                    layoutAnimationFrame = requestAnimationFrame(step);
                } else {
                    layoutAnimationFrame = null;
                }
            };

            layoutAnimationFrame = requestAnimationFrame(step);
        }

        function getMixedSplitPixelFromRatio(ratio = mixedVisibleRatio) {
            const { minSplit, maxSplit, usableWidth } = getMixedVisibleBounds();
            const clampedRatio = Math.max(0, Math.min(1, typeof ratio === 'number' ? ratio : 0.5));
            if(usableWidth <= 0) return maxSplit;
            return Math.round(minSplit + usableWidth * clampedRatio);
        }

        function getScenePlacementItemsForFraming() {
            const entries = getConstructionItems().map(entry => entry.item).filter(Boolean);
            return entries.length ? entries : jardinières;
        }

        function get2DFramingBounds(items = getScenePlacementItemsForFraming()) {
            const balconyBounds = getBalcony2DFramingBounds();
            if(balconyBounds) return balconyBounds;
            if(!items || !items.length) return null;
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            items.forEach(item => {
                if(!item || !item.pos) return;
                const w = (typeof item.w === 'number' ? item.w : 0) * 20;
                const d = (typeof item.d === 'number' ? item.d : 0) * 20;
                const x = item.pos.x * 20;
                const z = item.pos.z * 20;
                minX = Math.min(minX, x - w / 2);
                maxX = Math.max(maxX, x + w / 2);
                minZ = Math.min(minZ, z - d / 2);
                maxZ = Math.max(maxZ, z + d / 2);
            });
            if(!Number.isFinite(minX)) return null;
            return { minX, maxX, minZ, maxZ };
        }

        function getBalcony2DFramingBounds() {
            const polygon = typeof getPrimaryContourPolygon2D === 'function' ? getPrimaryContourPolygon2D() : [];
            if(!polygon || polygon.length < 3 || typeof transformBalconyScenePoint2D !== 'function') return null;
            let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
            polygon.forEach(point => {
                const fixed = transformBalconyScenePoint2D(point);
                minX = Math.min(minX, fixed.x);
                maxX = Math.max(maxX, fixed.x);
                minZ = Math.min(minZ, fixed.y);
                maxZ = Math.max(maxZ, fixed.y);
            });
            if(!Number.isFinite(minX)) return null;
            return { minX, maxX, minZ, maxZ };
        }

        function get3DFramingBounds(items = getScenePlacementItemsForFraming()) {
            if(!items || !items.length) return null;
            const box = new THREE.Box3();
            let hasBox = false;
            items.forEach(item => {
                if(item && item.group) {
                    item.group.updateMatrixWorld(true);
                    box.expandByObject(item.group);
                    hasBox = true;
                }
            });
            if(!hasBox || box.isEmpty()) return null;
            return box;
        }

        function getBalcony3DFramingBounds() {
            if(balconySceneGroup) {
                balconySceneGroup.updateMatrixWorld(true);
                const box = new THREE.Box3().setFromObject(balconySceneGroup);
                if(!box.isEmpty()) return box;
            }
            const polygon = typeof getPrimaryContourPolygon2D === 'function' ? getPrimaryContourPolygon2D() : [];
            if(polygon && polygon.length >= 3 && typeof transformBalconyScenePoint2D === 'function') {
                const box = new THREE.Box3();
                polygon.forEach(point => {
                    const fixed = transformBalconyScenePoint2D(point);
                    box.expandByPoint(new THREE.Vector3(fixed.x / 20, 0, fixed.y / 20));
                });
                const h = Math.max(2, ((archHeights && archHeights.wall) || 250) / 10);
                box.expandByPoint(new THREE.Vector3(box.min.x, h, box.min.z));
                box.expandByPoint(new THREE.Vector3(box.max.x, h, box.max.z));
                return box;
            }
            return null;
        }

        function getBalconyOrbitCenter3D() {
            const box = getBalcony3DFramingBounds();
            if(box && !box.isEmpty()) {
                const center = box.getCenter(new THREE.Vector3());
                const size = box.getSize(new THREE.Vector3());
                center.y = Math.max(center.y, size.y * 0.35);
                return center;
            }
            return new THREE.Vector3(balconyOffsetX || 0, Math.max(1, ((archHeights && archHeights.wall) || 250) / 20), balconyOffsetZ || 0);
        }

        function setCameraTargetToBalconyCenter(options = {}) {
            if(!camera || !controls) return false;
            const target = getBalconyOrbitCenter3D();
            if(!target) return false;
            const preserveCameraOffset = options.preserveCameraOffset !== false;
            const delta = target.clone().sub(controls.target);
            if(delta.lengthSq() < 0.000001 && !options.force) return true;
            const cameraOffset = camera.position.clone().sub(controls.target);
            controls.target.copy(target);
            if(preserveCameraOffset) camera.position.copy(target).add(cameraOffset);
            controls.update();
            return true;
        }

        function fitCameraToScene(options = {}) {
            if(!camera || !controls) return;
            const { preserveOrientation = false } = options;
            const box = getBalcony3DFramingBounds() || get3DFramingBounds();
            if(!box) {
                const direction = preserveOrientation
                    ? camera.position.clone().sub(controls.target).normalize()
                    : default3DCameraPos.clone().sub(default3DTarget).normalize();
                const target = getBalconyOrbitCenter3D() || default3DTarget.clone();
                const distance = Math.max(default3DCameraPos.distanceTo(default3DTarget), DEFAULT_VIEW_MARGIN_DM);
                camera.position.copy(target.clone().add(direction.multiplyScalar(distance)));
                controls.target.copy(target);
                controls.update();
                return;
            }
            const center = box.getCenter(new THREE.Vector3());
            const size = box.getSize(new THREE.Vector3());
            const framedWidth = Math.max(size.x, size.z) + DEFAULT_VIEW_MARGIN_DM * 2;
            const framedHeight = size.y + DEFAULT_VIEW_MARGIN_DM;
            const radius = Math.max(framedWidth, framedHeight, 1) * 0.6;
            const fov = camera.fov * (Math.PI / 180);
            const aspect = camera.aspect || 1;
            const verticalDistance = radius / Math.sin(fov / 2);
            const horizontalDistance = radius / Math.sin(Math.atan(Math.tan(fov / 2) * aspect));
            const distance = Math.max(verticalDistance, horizontalDistance, radius * 1.7);
            const direction = preserveOrientation
                ? camera.position.clone().sub(controls.target).normalize()
                : new THREE.Vector3(1, 0.8, 1).normalize();
            if(direction.lengthSq() < 0.0001) direction.set(1, 0.8, 1).normalize();
            center.y = Math.max(center.y, size.y * 0.35);
            camera.position.copy(center.clone().add(direction.multiplyScalar(distance)));
            controls.target.copy(center);
            controls.update();
        }

        function fitCameraToJardiniere(j, options = {}) {
            if(!j || !camera || !controls) return;
            fitCameraToScene(options);
        }

        function focusCameraOnJardiniere(j, smooth = true) {
            if(!j || !controls || !camera) return;
            const target = j.pos.clone();
            target.y = (j.renderMetrics ? j.renderMetrics.postHeight : (j.legH + 3)) * 0.5;
            if(!smooth) {
                controls.target.copy(target);
                controls.update();
                return;
            }
            const from = controls.target.clone();
            const to = target.clone();
            const duration = 220;
            const start = performance.now();
            function step(now) {
                const t = Math.min(1, (now - start) / duration);
                const eased = 1 - Math.pow(1 - t, 3);
                controls.target.lerpVectors(from, to, eased);
                controls.update();
                if(t < 1) requestAnimationFrame(step);
            }
            requestAnimationFrame(step);
        }

        function init() {
            applyColorMode(getStoredColorMode(), { skipPersist: true });
            const container = document.getElementById('viewport');
            const renderStage = document.getElementById('render-stage');
            const pane3d = document.getElementById('pane-3d');
            container.appendChild(document.getElementById('modal-2d'));
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(DEFAULT_CAMERA_FOV_DEG, Math.max(1, renderStage.clientWidth)/Math.max(1, renderStage.clientHeight), 0.1, 7000);
            camera.position.copy(default3DCameraPos);
            camera.layers.enable(1);

            init2D();

            try {
                renderer = new THREE.WebGLRenderer({ antialias: true });
                renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
                renderer.setSize(Math.max(1, renderStage.clientWidth), Math.max(1, renderStage.clientHeight));
                renderer.shadowMap.enabled = true;
                renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                renderer.domElement.classList.add('viewport-3d');
                pane3d.appendChild(renderer.domElement);

                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.target.copy(default3DTarget);
                controls.enableDamping = true;
                controls.dampingFactor = 0.08;
                controls.screenSpacePanning = true;
                if(THREE.TOUCH) {
                    controls.touches.ONE = THREE.TOUCH.ROTATE;
                    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE !== undefined
                        ? THREE.TOUCH.DOLLY_ROTATE
                        : THREE.TOUCH.DOLLY_PAN;
                }
                controls.addEventListener('change', () => { lastCameraChangeTime3D = performance.now(); });
                controls.update();
                webglAvailable = true;
            } catch(error) {
                console.warn('Vue 3D indisponible, démarrage en 2D uniquement.', error);
                webglAvailable = false;
                renderer = null;
                controls = null;
                pane3d.style.display = 'none';
            }

            groundGrid = createGroundGrid();
            scene.add(groundGrid);
            scene.add(ghostGroup);
            scene.add(garlandSnapMarkerGroup);

            // Groupe balcon : toute la construction pivote avec l'orientation
            balconySceneGroup = new THREE.Group();
            balconySceneGroup.name = 'Balcon3D';
            scene.add(balconySceneGroup);
            magicDustGroup = new THREE.Group();
            magicDustGroup.name = 'Poussiere de lumiere';
            balconySceneGroup.add(magicDustGroup);

            solarMapGroup = new THREE.Group();
            solarMapGroup.name = 'Carte ensoleillement';
            balconySceneGroup.add(solarMapGroup);

            visAVisGroup = new THREE.Group();
            visAVisGroup.name = 'Vis-à-vis';
            balconySceneGroup.add(visAVisGroup);

            visAVisGuideGroup = new THREE.Group();
            visAVisGuideGroup.name = 'Guides vis-à-vis';
            scene.add(visAVisGuideGroup);

            horizonGroup = new THREE.Group();
            horizonGroup.name = 'Masque horizon';
            scene.add(horizonGroup);
            // sun (75 %) : frustum calé sur la vue → ombres nettes pour tout ce qui est visible
            sun = new THREE.DirectionalLight(0xffffff, 0.75);
            sun.castShadow = true;
            sun.shadow.mapSize.width = 2048;
            sun.shadow.mapSize.height = 2048;
            sun.shadow.bias = -0.00008;
            sun.shadow.normalBias = 0.02;
            sun.shadow.camera.near = 10;
            sun.shadow.camera.far = 1500;
            sun.shadow.camera.left = -80;
            sun.shadow.camera.right = 80;
            sun.shadow.camera.top = 80;
            sun.shadow.camera.bottom = -80;
            sun.layers.enable(1);
            scene.add(sun);
            scene.add(sun.target);
            // sunFar (25 %) : frustum fixe couvrant le voisinage → ombres portées des bâtiments lointains
            sunFar = new THREE.DirectionalLight(0xffffff, 0.25);
            sunFar.castShadow = true;
            sunFar.shadow.mapSize.width = 512;
            sunFar.shadow.mapSize.height = 512;
            sunFar.shadow.bias = -0.0003;
            sunFar.shadow.normalBias = 0.05;
            sunFar.shadow.camera.near = 10;
            sunFar.shadow.camera.far = 1500;
            sunFar.shadow.camera.left = -80;
            sunFar.shadow.camera.right = 80;
            sunFar.shadow.camera.top = 80;
            sunFar.shadow.camera.bottom = -80;
            sunFar.layers.set(0);
            scene.add(sunFar);
            scene.add(sunFar.target);
            ambientLight = new THREE.AmbientLight(0xffffff, 0.44);
            scene.add(ambientLight);
            const diffuseSkyLight = new THREE.HemisphereLight(0xf4f8ff, 0x70675d, 0.28);
            scene.add(diffuseSkyLight);
            const balconyFillLight = new THREE.DirectionalLight(0xddeaff, 0.22);
            balconyFillLight.position.set(-45, 55, -35);
            balconyFillLight.castShadow = false;
            scene.add(balconyFillLight);

            updateSun(sunHour2d);
            if(jardinières.length === 0) {
                const startPos = typeof getDefaultJardiniereStartPosition === 'function' ? getDefaultJardiniereStartPosition() : { x: 0, z: 2.5 };
                addNewJardiniere({ selectNew: false, updatePanel: false, x: startPos.x, z: startPos.z });
            }
            populatePlantSelectOptions();
            initSplitter();
            if(webglAvailable) init3DMouse();
            updateOutdoorModeUI();
            updateModeToolbarUI();
            updateSurfaceMaterialUI();
            updateArchPalettesUI();
            rebuildHorizonWall();
            if(typeof applyBalconySceneTransform === 'function') applyBalconySceneTransform();
            initAddressAutocomplete();
            setMainView(activeMainView || '2d', { skipValidation: true });
            if(webglAvailable) animate();
            rebuildButterflies();
            window.addEventListener('resize', onResize);
            window.addEventListener('orientationchange', () => {
                lastViewportOrientationKey = getViewportOrientationKey();
                scheduleViewportRecenter();
            });
            if(window.visualViewport) {
                window.visualViewport.addEventListener('resize', onResize);
            }
            window.addEventListener('resize', () => {
                if(horizonDrawOpen) {
                    resizeHorizonDrawCanvas();
                    drawHorizonPanorama();
                }
            });
            document.getElementById('project-name').textContent = currentProjectName;
            if(jardinières[0]) {
                selectJardiniere(jardinières[0], { openEditor: false, redraw: false });
                if(webglAvailable) fitCameraToJardiniere(jardinières[0]);
            }
            saveState();
            hasUnsavedChanges = false;
            window.addEventListener('beforeunload', (e) => {
                if(appAllowsPageUnload) return;
                if(!hasUnsavedChanges) return;
                e.preventDefault();
                e.returnValue = 'Des modifications non enregistrées seront perdues.';
            });
            setMainView('mixte', { skipValidation: true });
            if(selected2dJardiniere || jardinières[0]) {
                if(typeof recenter2DViewToContent === 'function') recenter2DViewToContent();
                else fit2DViewToScene();
                draw2D();
            }
            selectDefaultWallTool();
            switchEditor('balcon');
            updateSketchLockUI();
            updateCollisionBanner();
        }

        function isConstraintTool(mode) {
            return mode === 'drain' || mode === 'power';
        }

        function addConstraintPoint(type, point) {
            let finalPos = { x: point.x, y: point.y };
            
            // Appliquer l'aimantation aux murs pour les prises électriques
            if(type === 'power') {
                finalPos = snapPowerConstraintToWalls({ x: point.x, y: point.y });
            }
            
            constraints.push({
                id: 'c-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
                type,
                x: finalPos.x,
                y: finalPos.y
            });
        }

        function hasJardCollision(j) {
            // Pour les drains: vérifier collision avec les pieds uniquement
            // Pour les autres contraintes: vérifier collision avec la jardinière entière
            const drainCollision = constraints
                .filter(c => c.type === 'drain')
                .some(c => {
                    // Vérifier si le drain touche un pied
                    const feet = getJardiniereFeetPositions(j);
                    const FOOT_RADIUS = 4;
                    return feet.some(foot => {
                        const dx = c.x - foot.x;
                        const dy = c.y - foot.y;
                        const dist = Math.sqrt(dx*dx + dy*dy);
                        return dist < FOOT_RADIUS + 6;
                    });
                });
            
            // Autres contraintes restent comme avant
            const otherCollision = constraints
                .filter(c => c.type !== 'drain')
                .some(c => pointInRotatedRect(c.x, c.y, j));
            
            return drainCollision || otherCollision;
        }

        function updateCollisionBanner() {
            const banner = document.getElementById('collision-banner');
            if(!banner) return;
            
            let drainCount = 0, otherCount = 0;
            for(let j of jardinières) {
                // Compter collisions drain (pieds)
                if(hasDrainCollisionWithFeet(j)) drainCount++;
                // Compter other collisions
                const otherHitCount = constraints
                    .filter(c => c.type !== 'drain')
                    .filter(c => pointInRotatedRect(c.x, c.y, j)).length > 0 ? 1 : 0;
                otherCount += otherHitCount;
            }
            
            if(drainCount <= 0 && otherCount <= 0) {
                banner.style.display = 'none';
                banner.textContent = '';
                return;
            }
            
            let msg = '';
            if(drainCount > 0) msg += `${drainCount} pied(s) sur évac.`;
            if(otherCount > 0) msg += (msg ? ' + ' : '') + `${otherCount} collision(s)`;
            
            banner.style.display = 'inline-flex';
            banner.textContent = '⚠️ ' + msg;
        }
