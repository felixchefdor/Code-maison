        // --- ÉTAT GLOBAL ---
        let scene, camera, renderer, controls;
        let webglAvailable = true;
        let cameraInsideBalconyVolume = false;
        let jardinières = [];
        let bancs = [];
        let cubes = [];
        let pottedTrees = [];
        let tables = [];
        let chairs = [];
        let hangingPlanters = [];
        let railShelves = [];
        let cornerFills = [];
        let compressionShelves = [];
        let selected2dBench = null;
        let selected2dCube = null;
        let selected2dPottedTree = null;
        let selected2dCornerFill = null;
        let copiedPlacementBlueprint = null;
        let placementAlignmentGuides = [];
        let drawingSnapGuides = [];
        let sun;
        let sunFar;
        let ambientLight;
        let sunHour2d = 16;
        let balconyOrientationDeg = 180;
        let balconyWorldOrientationDeg = 180;
        let sunSeason = 'summer';
        let solarMapPeriod = 'annual';
        let solarMapDisplayMode = 'usage';
        let sunDateISO = '';
        let balconyOffsetX = 0; // décalage horizontal en unités Three.js (5 unités = 1 m)
        let balconyOffsetZ = 0;
        let lightPanelOpen = false;
        let horizonPanelOpen = false;
        let horizonGroup = null;
        let balconySceneGroup = null;
        let horizonDrawCanvas = null;
        let horizonDrawCtx = null;
        let horizonDrawOpen = false;
        let horizonDrawActive = false;
        let horizonTraceMode = false;
        let horizonLookDragActive = false;
        let horizonLookDragLastX = 0;
        let horizonLookDragLastY = 0;
        let horizonDraftPoints = [];
        let horizonCurrentStrokePoints = [];
        let horizonDraftMesh = null;
        let horizonCameraStream = null;
        let horizonCameraActive = false;
        let horizonSensorsActive = false;
        let horizonCompassHeadingDeg = null;
        let horizonDevicePitchDeg = null;
        let horizonDeviceRollDeg = 0;
        let horizonScreenAngleDeg = 0;
        let horizonPitchZeroDeg = 0;
        let horizonManualAzimuthDeg = 0;
        let horizonManualElevationDeg = 0;
        let horizonActiveDistanceM = 20;
        let horizonActiveSilhouetteIndex = 0;
        let horizonSensorRedrawPending = false;
        let solarMapGroup = null;
        let solarMapEnabled = false;
        let solarMapVisible = false;
        let solarMapDirty = true;
        let solarMapData = null;
        let solarMapPath2DCache = null;
        const SOLAR_MAP_CELL_DM = 1; // 10 cm
        const SOLAR_MAP_STEP_HOURS = 0.5;
        const SOLAR_MAP_SAMPLE_Y_OFFSET = 0.12;
        const HORIZON_CAMERA_FOV_DEG = 70;
        const HORIZON_CAMERA_VERTICAL_FOV_DEG = 52;
        let horizonSettings = {
            enabled: false,
            radiusM: 20,
            eyeHeightM: 1.7,
            activeDistanceM: 20,
            activeSilhouetteIndex: 0,
            silhouettes: [],
            points: [],
            neighborhood: {
                enabled: false,
                address: '',
                lat: null,
                lon: null,
                mapOriginX: null,
                mapOriginY: null,
                radiusM: 160,
                floor: 0,
                floorHeightM: 3,
                showFootprints: false,
                showSatellite: false,
                satelliteOptIn: false,
                showUrbanFeatures: true,
                supportBuildingId: null,
                supportSide: 'outside',
                supportWidthM: 3,
                supportDepthM: 1.4,
                buildings: [],
                features: []
            }
        };
        let balconyBuildingPlacementActive = false;
        let balconyBuildingPlacementDragActive = false;
        let balconyBuildingPlacementDragOffsetX = 0;
        let balconyBuildingPlacementDragOffsetY = 0;
        let balconyBuildingPlacementRotating = false;
        let balconyBuildingPlacementRotationStartAngle = 0;
        let balconyBuildingPlacementRotationStartDeg = 180;
        let balconyBuildingPlacementRotationAnchorLocal = null;
        let balconyBuildingPlacementRotationAnchorFixed = null;
        let balconyBuildingPlacementSnapshot = null;
        let balconyBuildingPlacementSnapPreview = null;
        let balconyBuildingPlacementPickArmed = false;
        let neighborhoodGridAlignmentPickArmed = false;
        let neighborhoodHeightEditPickArmed = false;
        let buildingAlignedGridActive = false;
        let hoveredNeighborhoodBuildingId = null;
        let hoveredNeighborhoodEdgeFootprintIndex = -1;
        let pendingTouchNeighborhoodPick = null;
        let alignedBuildingWallNormal = null;
        let myBuildingPickArmed = false;
        const SUN_ORBIT_RADIUS = 600;
        const SUN_FORWARD_OFFSET = 200;
        
        // Hauteurs de l'architecture (en cm)
        let archHeights = {
            wall: 250,
            windowBot: 120,
            windowTop: 225,
            glassBot: 0,
            glassTop: 225,
            rail: 100
        };

        let archColors = {
            wall: '#ffffff',
            slab: '#9a9a9a',
            rail: '#c8b89a',
            ceiling: '#d8d2c4'
        };
        let slabZoneColors = {};
        let selectedSlabZoneId = null;

        let archOptions = {
            railBars: false,
            railType: 'low-wall',
            railBarSpacing: 12,
            ceiling: false
        };

        let balconyDesignMode = 'balcon'; // 'balcon' or 'exterieur'
        let surfaceMaterial = 'herbe';
        let surfaceHeightCm = 15;
        let downloadProgressHideTimer = null;
        let downloadProgressPercent = 0;
        const COLOR_MODE_STORAGE_KEY = 'jardiniere-color-mode';
        const surfaceMaterials = {
            herbe: { label: 'Herbe', color: '#87b858', line: '#5e8c3f' },
            brique: { label: 'Brique', color: '#b75f3f', line: '#8c442f' },
            beton: { label: 'Béton', color: '#9a9a9a', line: '#6d6d6d' },
            bois: { label: 'Bois', color: '#d0ab78', line: '#a97b4c' }
        };
        let surfaces = [];
        let currentSurfacePoints = [];
        let ceilingShapePoints = [];
        let currentCeilingPoints = [];

        // --- 2D CANVAS STATE (ZOOM & PAN) ---
        let canvas2d, ctx2d;
        let scale = 0.4, offsetX = 0, offsetY = 0;
        let screenRotation2DDeg = 0;
        let magicDust2DBursts = [];
        let magicDust2DFrame = null;
        let lastPane2DWidth = 0, lastPane2DHeight = 0;
        let lastViewportOrientationKey = null;
        let viewportRecenterTimer = null;
        let isDragging2d = false, lastX, lastY;
        let isPinching2d = false;
        let pinchStartDistance = 0;
        let pinchStartScale = 1;
        let pinchStartOffsetX = 0;
        let pinchStartOffsetY = 0;
        let pinchCenterX = 0;
        let pinchCenterY = 0;
        let activeSingleTouch2d = false;
        let pendingSingleTouch2d = false;
        let touchStartClientX = 0;
        let touchStartClientY = 0;
        let isDispatchingTouchAsMouse = false;
        let touchDraftActive = false;
        let touchDraftMagnifierVisible = false;
        let touchDraftMagnifierTimer = null;
        let touchDraftClientX = 0;
        let touchDraftClientY = 0;
        let touchDraftMagnifierEl = null;
        let touchDraftMagnifierCanvas = null;
        let touchDraftMagnifierLabel = null;
        const TOUCH_DRAFT_MAGNIFIER_DELAY_MS = 380;
        const IS_IOS_DEVICE = /iPad|iPhone|iPod/.test(navigator.userAgent)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
        const IS_TOUCH_DEVICE = navigator.maxTouchPoints > 0 || IS_IOS_DEVICE;
        const MAX_2D_DPR = navigator.maxTouchPoints > 0 ? 1 : 1.5;
        let lightweight2DEnvironmentUntil = 0;
        function requestLightweight2DEnvironment(durationMs = 220) {
            if(!IS_TOUCH_DEVICE) return;
            lightweight2DEnvironmentUntil = Math.max(lightweight2DEnvironmentUntil, Date.now() + durationMs);
        }
        function clearLightweight2DEnvironment() {
            lightweight2DEnvironmentUntil = 0;
        }
        function shouldUseLightweight2DEnvironment() {
            return !!(IS_TOUCH_DEVICE && (
                Date.now() < lightweight2DEnvironmentUntil
                || isPinching2d
                || activeSingleTouch2d
                || isDragging2d
                || isDispatchingTouchAsMouse
            ));
        }
        const DEFAULT_CAMERA_FOV_DEG = 58;
        const INTERIOR_CAMERA_FOV_DEG = 58;
        let drawingMode = 'wall';
        let isDrawingToolActive = true;
        let garlandToolMode = null; // 'post' | 'link'
        let pendingGarlandLinkFrom = null;
        let currentEditorMode = 'overview'; // 'overview', 'balcon', 'jardinieres', 'devis', 'chantier'
        let showDevisBesideJardinieres = false;
        let showFabricationBesideJardinieres = false;
        let segments = [];
        let currentPoint = null;
        let mousePos2d = null;
        let activeMainView = '2d';
        let splitPosition = 0.5; // Mixte: fraction de la largeur du viewport pour le 2D
        let mixedVisibleRatio = 0.5; // Ratio 2D/3D dans la zone visible hors panneaux
        let isDraggingSplitter = false;
        let splitPixelX = 0;
        let renderStageLeftPx = 0;
        let layoutAnimationFrame = null;
        let currentProjectName = 'Projet Extérieur';
        let hasUnsavedChanges = false;
        let appAllowsPageUnload = false;
        let pwaUpdateRegistration = null;
        let pwaUpdatePromptOpen = false;
        let pwaUpdatePromptShownFor = null;
        let pwaReloadAfterUpdate = false;
        let appHistory = [];
        let historyIndex = -1;
        let isApplyingHistory = false;
        let sketchLockActive = false;
        let isSketchValidated = true;
        let groundGrid = null;
        const default3DCameraPos = new THREE.Vector3(65, 48, 65);
        const default3DTarget = new THREE.Vector3(0, 3, 0);
        let measureAreas = [];
        let hoveredSegmentIndex = -1;
        let hoveredSketchSegmentIndex = -1;
        let selectedSketchSegmentIndex = -1;
        let selectedSketchVertexKey = null;
        let editingSegmentIndex = -1;
        let isContourClosed = false;
        let detachedDrawingMode = false;
        let activeDetachedSketchId = null;
        let nextDetachedSketchId = 1;
        let hoveredSketchVertex = null;
        let draggingSketchVertex = null;
        let draggedJardiniere = null; // Jardinière actuellement en déplacement sur le plan 2D
        let draggedBench = null;
        let draggedPlacementObject = null;
        let dragOriginalRot = null;
        let activeWallSnapPlacement = null;
        let activeWallSnapSegmentIndex = null;
        let pendingDraggedJardiniere = null; // Jardinière cliquée, en attente d'un vrai mouvement avant drag
        let pendingDraggedBench = null;
        let pendingDraggedPlacementObject = null;
        let pendingSlabZoneSelection = null; // Dalle cliquée, sélectionnée sur mouseup seulement (pan possible)
        let placementSliderRebuildTimer = null;
        let cornerArrangementMode = false;
        let pendingCornerArrangement = null;
        let activeCornerArrangementResize = null;
        const PLACEMENT_ALIGNMENT_GUIDE_THRESHOLD_SCREEN_PX = 8;
        const DRAWING_EDGE_PAN_MARGIN_PX = 76;
        const DRAWING_EDGE_PAN_STEP_PX = 18;
        const ORTHOGONAL_DRAWING_SNAP_DEG = 12;
        const constructionTypes = {};

        function getDefaultConstructionInclusion(type) {
            return ['jardiniere', 'banc', 'cube', 'table', 'chair', 'hangingPlanter', 'railShelf', 'cornerFill', 'compressionShelf'].includes(type);
        }

        function normalizeConstructionCalculationInclusion(item, type = null) {
            if(!item) return false;
            const itemType = type || item.constructionType || 'jardiniere';
            if(typeof item.includeInQuote !== 'boolean') {
                item.includeInQuote = getDefaultConstructionInclusion(itemType);
            }
            return item.includeInQuote;
        }

        function shouldIncludeConstructionInCalculations(item, type = null) {
            return normalizeConstructionCalculationInclusion(item, type);
        }

        function updateSelectedConstructionCalculationInclusion(included) {
            if(typeof getSelectedPlacementObject !== 'function') return;
            const item = getSelectedPlacementObject();
            if(!item) return;
            saveState();
            item.includeInQuote = !!included;
            if(typeof refreshFabricationAndPricing === 'function') refreshFabricationAndPricing();
            if(typeof updateJardPanel === 'function') updateJardPanel();
            if(typeof draw2D === 'function') draw2D();
        }

        function getConstructionType(type) {
            return constructionTypes[type] || null;
        }

        function getConstructionItems(type = null) {
            const legacyCollections = {
                jardiniere: () => jardinières,
                banc: () => bancs,
                pottedTree: () => pottedTrees,
                cube: () => cubes,
                table: () => tables,
                chair: () => chairs,
                hangingPlanter: () => hangingPlanters,
                railShelf: () => railShelves,
                cornerFill: () => cornerFills,
                compressionShelf: () => compressionShelves
            };
            const items = [];
            Object.entries(constructionTypes).forEach(([entryType, def]) => {
                let list = null;
                if(def && typeof def.getItems === 'function') list = def.getItems();
                else if(legacyCollections[entryType]) list = legacyCollections[entryType]();
                if(!Array.isArray(list)) return;
                list.forEach(item => {
                    if(item) items.push({ type: entryType, item });
                });
            });
            return type ? items.filter(entry => entry.type === type) : items;
        }

        function getBalconyDefaultPlacementCenterScene() {
            if(typeof getPrimaryContourPolygon2D !== 'function') return null;
            const polygon = getPrimaryContourPolygon2D();
            if(!Array.isArray(polygon) || polygon.length < 3) return null;
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
            const avg = polygon.reduce((acc, p) => {
                acc.x += p.x;
                acc.y += p.y;
                return acc;
            }, { x: 0, y: 0 });
            avg.x /= polygon.length;
            avg.y /= polygon.length;
            const candidates = [center, avg];
            if(typeof pointInPolygon === 'function' && !pointInPolygon(center, polygon)) {
                const step = Math.max(20, GRID_SIZE || 20);
                for(let radius = step; radius <= step * 8; radius += step) {
                    for(const dir of [[1,0], [-1,0], [0,1], [0,-1], [1,1], [-1,1], [1,-1], [-1,-1]]) {
                        candidates.push({ x: center.x + dir[0] * radius, y: center.y + dir[1] * radius });
                    }
                }
            }
            const chosen = candidates.find(point => typeof pointInPolygon !== 'function' || pointInPolygon(point, polygon)) || center;
            return { x: chosen.x / 20, z: chosen.y / 20 };
        }

        function withDefaultConstructionPosition(options = {}) {
            if(options.skipDefaultBalconyCenter) return options;
            const hasX = Number.isFinite(Number(options.x));
            const hasZ = Number.isFinite(Number(options.z));
            if(hasX && hasZ) return options;
            const center = getBalconyDefaultPlacementCenterScene();
            if(!center) return options;
            return {
                ...options,
                x: hasX ? Number(options.x) : center.x,
                z: hasZ ? Number(options.z) : center.z
            };
        }

        function alignConstructionsToBalconyCenterIfFar() {
            const center = getBalconyDefaultPlacementCenterScene();
            if(!center || typeof getPrimaryContourPolygon2D !== 'function') return false;
            const items = getConstructionItems().map(entry => entry.item).filter(item => item && item.pos);
            if(!items.length) return false;
            const polygon = getPrimaryContourPolygon2D();
            const bounds = polygon.reduce((acc, p) => ({
                minX: Math.min(acc.minX, p.x),
                maxX: Math.max(acc.maxX, p.x),
                minY: Math.min(acc.minY, p.y),
                maxY: Math.max(acc.maxY, p.y)
            }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });
            const layout = items.reduce((acc, item) => {
                acc.x += item.pos.x;
                acc.z += item.pos.z;
                return acc;
            }, { x: 0, z: 0 });
            layout.x /= items.length;
            layout.z /= items.length;
            const layoutCanvas = { x: layout.x * 20, y: layout.z * 20 };
            const margin = Math.max(80, GRID_SIZE * 4);
            const insideBounds = layoutCanvas.x >= bounds.minX - margin
                && layoutCanvas.x <= bounds.maxX + margin
                && layoutCanvas.y >= bounds.minY - margin
                && layoutCanvas.y <= bounds.maxY + margin;
            const insidePolygon = typeof pointInPolygon === 'function' && pointInPolygon(layoutCanvas, polygon);
            if(insideBounds || insidePolygon) return false;
            const dx = center.x - layout.x;
            const dz = center.z - layout.z;
            if(Math.hypot(dx, dz) < 0.5) return false;
            items.forEach(item => {
                item.pos.x += dx;
                item.pos.z += dz;
                if(item.group) item.group.position.copy(item.pos);
            });
            return true;
        }

        function createConstruction(type, options = {}) {
            const def = getConstructionType(type);
            if(!def || typeof def.create !== 'function') {
                console.warn('Type de construction inconnu:', type);
                return null;
            }
            const created = def.create(withDefaultConstructionPosition(options));
            if(created && !options.skipMagicEffect && typeof triggerMagicDustForPlacement === 'function') {
                triggerMagicDustForPlacement(created, { intensity: 'create' });
            }
            return created;
        }

        function collectCutPiecesAllConstructions() {
            const groups = new Map();
            Object.entries(constructionTypes).forEach(([type, def]) => {
                if(!def || typeof def.collectCutGroups !== 'function') return;
                const entries = getConstructionItems(type)
                    .map(entry => entry.item)
                    .filter(item => shouldIncludeConstructionInCalculations(item, type));
                const typeGroups = def.collectCutGroups(entries);
                if(!typeGroups) return;
                typeGroups.forEach((group, key) => {
                    if(!groups.has(key)) groups.set(key, group);
                    else mergeCutPieceGroup(groups.get(key), group);
                });
            });
            return Array.from(groups.values());
        }

        function mergeCutPieceGroup(target, source) {
            if(!target || !source) return target;
            if(source.labels) {
                source.labels.forEach(label => target.labels.add(label));
            }
            if(Array.isArray(source.lengths)) {
                target.lengths.push(...source.lengths);
            }
            if(!target.label && source.label) target.label = source.label;
            if(!target.meta && source.meta) target.meta = source.meta;
            if(target.meta && source.meta && target.meta.unitType && source.meta.unitType && target.meta.unitType === source.meta.unitType) {
                target.meta.qty = (target.meta.qty || 0) + (source.meta.qty || 0);
                if(Array.isArray(target.meta.sheets) && Array.isArray(source.meta.sheets)) {
                    target.meta.sheets.push(...source.meta.sheets);
                }
            }
            return target;
        }
        let dragStartX, dragStartY; // Position souris au début du drag
        let dragOffsetWorldX = 0, dragOffsetWorldY = 0; // Décalage souris-coin HG en pixels monde
        const JARD_DRAG_THRESHOLD_PX = 10;
        let selected2dJardiniere = null; // Jardinière sélectionnée dans le plan 2D
        let selectedPlacementObject = null;
        let rotatingJardiniere = null; // Jardinière en cours de rotation via la poignée
        let rotatingBench = null;
        let rotatingPlacementObject = null;
        let resizingJardiniere = null; // Jardinière en cours de resize via poignées largeur/longueur
        let resizingBench = null;
        let resizingPlacementObject = null;
        let resizeMode = null; // 'w' | 'd' | corner arrangement dimension key
        let resizeAnchorWorldX = 0, resizeAnchorWorldY = 0; // Point monde figé pendant le resize
        let resizeAnchorLocalX = 0, resizeAnchorLocalY = 0; // Point local correspondant à l'ancre figée
        let rotStartMouseAngle = 0; // Angle souris au début de la rotation
        let rotStartRot = 0;        // Rotation initiale de la jardinière
        let rotPivotX = 0, rotPivotY = 0; // Pivot monde (coin HG = pastille) pour la rotation
        let hadJardInteraction = false;
        let constraints = [];
        let raycaster = new THREE.Raycaster();
        let solarMapRaycaster = new THREE.Raycaster();
        let visAVisRaycaster = new THREE.Raycaster();
        let visAVisGroup = null;
        let visAVisGuideGroup = null;
        let visAVisGuidesVisible = true;
        let visAVisEnabled = false;
        let visAVisDirty = true;
        let visAVisData = null;
        let visAVisSettings = {
            zones: [{
                id: 'zone-1',
                label: 'Voisin',
                distanceM: 15,
                azimuthDeg: 180,
                widthDeg: 90,
                floors: 3,
                floorHeightM: 3.0,
                eyeOffsetM: 1.5
            }]
        };
        let mouse3d = new THREE.Vector2();
        let last3DTouchEndAt = 0;
        let ghostGroup = new THREE.Group();
        let garlandSnapMarkerGroup = new THREE.Group();
        let magicDustGroup = null;
        let magicDustBursts = [];
        let live3DPreviewFrame = null;
        let liveGarlandRebuildFrame = null;
        let liveGarlandRebuildPending = new Set();
        let jardFloatingOpenButton = null;
        let isLiveJardSliderEditing = false;
        let jardSliderRebuildTimer = null;
        let cutStockLengthByProfile = {};
        let cutStockInventoryByProfile = {};
        let workshopFreeStock = [];
        let cutSawKerfMm = 3;
        let devisUnitPriceByProfile = {};
        const MAX_BUTTERFLIES_SCENE = 4;
        const OPTIMIZED_LIGHTING_JARDINIERE_COUNT = 2;
        const DEFAULT_VIEW_MARGIN_DM = 20;
        const DEFAULT_VIEW_MARGIN_2D_PX = DEFAULT_VIEW_MARGIN_DM * 20;
        const LAYER_VIEW_STEPS = ['geotextile', 'epdm', 'gravel', 'soil', 'mulch'];
        const DEFAULT_CUVE_BOARD_PRODUCT_NAME = 'Lame de terrasse douglas marron classe 3 Pyla - 25x90 - L=4m';
        const DEFAULT_CUVE_BOARD_STOCK_CM = 400;
        const DEFAULT_LAMBOURDE_PRODUCT_NAME = 'Lambourde pin marron classe 4 - 45x70 - L=3m';
	        const DEFAULT_DEVIS_UNIT_PRICES = {
	            cuveBoards: 10,
	            lambourdes: 11.5,
	            floorBattens: 4.5,
	            meridienneFabric: 24,
	            treillisPosts: 6.5,
	            treillisRails: 3,
	            treillisSpots: 18,
	            treillisGarlandWhite: 38,
	            treillisGarlandGinguette: 45,
	            epdmLiner: 14,
	            geotextile: 2.5,
	            screws: 8,
	            soilLiter: 0.25,
	            topsoilLiter: 0.14,
	            clayPebblesLiter: 0.45,
	            mulchLiter: 0.18,
	            plant: 6
	        };
        const PLANTING_MIX_RATIOS = {
            topsoil: 0.5,
            pottingSoil: 0.5
        };
        const MATERIAL_LAYER_THICKNESS_DM = {
            clayPebbles: 0.3,
            mulch: 0.3
        };
        const MATERIAL_DENSITY_KG_M3 = {
            wood: 550,
            bamboo: 650,
            steel: 7850,
            soil: 650,
            topsoil: 1200,
            clayPebbles: 350,
            mulch: 120,
            epdm: 1200,
            plantPot: 0.6,
            plantClimber: 1
        };
        const MATERIAL_SHEET_SPECS = {
            epdmThicknessM: 0.0012,
            geotextileKgM2: 0.2
        };
        let chantierTechSelectedJardId = 'auto';
        let chantierTechSelectedTypeKey = null;
        let techPlanModalKind = null;
        let techPlanModalCutProfile = null;
        let techPlanModalIsoId = null;
        let techPlanModalZoom = 1;
        let treillisDimensionOverrides = {
            postW: null,
            postD: null,
            railW: null,
            railH: null
        };
        const windParams = {
            bushAmp: 0.006,
            bushFreq: 0.62,
            leafYawAmp: 0.072,
            leafYawFreq: 6.8,
            leafTiltAmp: 0.018,
            leafTiltFreq: 5.2,
            gustEveryMin: 1.6,
            gustEveryMax: 5.2,
            gustHoldMin: 0.18,
            gustHoldMax: 0.55,
            gustStrengthMin: 0.25,
            gustStrengthMax: 1.0,
            gustResponse: 3.6
        };
        let windLastTime = 0;
        let windThrottleLastUpdate = 0;
        let lastCameraChangeTime3D = 0;
        const WIND_FRAME_INTERVAL_MS = 1000 / 20; // vent à 20 FPS max
        const NAV_WIND_PAUSE_MS = 280; // pause vent pendant 280ms après navigation
        let butterflies = [];
        const proceduralTextureCache = {};

        function makeWoodTexture(baseColor = '#6a4b2f') {
            const key = 'wood-' + baseColor;
            if(proceduralTextureCache[key]) return proceduralTextureCache[key];
            const canvas = document.createElement('canvas');
            canvas.width = 256;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const base = new THREE.Color(baseColor);
            ctx.fillStyle = baseColor;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            for(let y = 0; y < canvas.height; y++) {
                const wave = Math.sin(y * 0.18) * 10 + Math.sin(y * 0.043) * 18;
                const tone = 0.82 + Math.sin(y * 0.12) * 0.08 + Math.random() * 0.04;
                const c = base.clone().multiplyScalar(tone);
                ctx.strokeStyle = `rgb(${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)})`;
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(0, y);
                for(let x = 0; x <= canvas.width; x += 8) {
                    ctx.lineTo(x, y + Math.sin((x + wave) * 0.045) * 2.5);
                }
                ctx.stroke();
            }
            for(let i = 0; i < 18; i++) {
                const x = Math.random() * canvas.width;
                const y = Math.random() * canvas.height;
                ctx.strokeStyle = 'rgba(40,22,12,0.16)';
                ctx.beginPath();
                ctx.ellipse(x, y, 16 + Math.random() * 26, 3 + Math.random() * 7, Math.random() * 0.4, 0, Math.PI * 2);
                ctx.stroke();
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.RepeatWrapping;
            texture.wrapT = THREE.RepeatWrapping;
            texture.repeat.set(2.2, 1);
            texture.colorSpace = THREE.SRGBColorSpace;
            proceduralTextureCache[key] = texture;
            return texture;
        }

        function makeLeafTexture(baseColor = '#4f8f42') {
            const key = 'leaf-' + baseColor;
            if(proceduralTextureCache[key]) return proceduralTextureCache[key];
            const canvas = document.createElement('canvas');
            canvas.width = 128;
            canvas.height = 128;
            const ctx = canvas.getContext('2d');
            const base = new THREE.Color(baseColor);
            const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
            const light = base.clone().lerp(new THREE.Color('#d8f0b0'), 0.35);
            const dark = base.clone().multiplyScalar(0.55);
            grad.addColorStop(0, `rgb(${Math.round(light.r * 255)},${Math.round(light.g * 255)},${Math.round(light.b * 255)})`);
            grad.addColorStop(1, `rgb(${Math.round(dark.r * 255)},${Math.round(dark.g * 255)},${Math.round(dark.b * 255)})`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.strokeStyle = 'rgba(235,255,205,0.55)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(canvas.width / 2, 10);
            ctx.lineTo(canvas.width / 2, canvas.height - 12);
            ctx.stroke();
            ctx.lineWidth = 1;
            for(let i = 0; i < 9; i++) {
                const y = 22 + i * 10;
                ctx.beginPath();
                ctx.moveTo(canvas.width / 2, y);
                ctx.lineTo(18 + Math.random() * 12, y + 12 + Math.random() * 8);
                ctx.moveTo(canvas.width / 2, y);
                ctx.lineTo(canvas.width - 18 - Math.random() * 12, y + 12 + Math.random() * 8);
                ctx.stroke();
            }
            const texture = new THREE.CanvasTexture(canvas);
            texture.wrapS = THREE.ClampToEdgeWrapping;
            texture.wrapT = THREE.ClampToEdgeWrapping;
            texture.colorSpace = THREE.SRGBColorSpace;
            proceduralTextureCache[key] = texture;
            return texture;
        }
        
        const GRID_SIZE = 20;
        const JARD_RESIZE_LIMITS = {
            wMin: 8,
            wMax: 25,
            dMin: 4,
            dMax: 10
        };
        const MAX_HISTORY_ENTRIES = 120;

        function disposeGroup(group) {
            if(!group) return;
            group.traverse(obj => {
                if(obj.geometry) obj.geometry.dispose();
                if(obj.material) {
                    if(Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
                    else obj.material.dispose();
                }
            });
        }
        const MAX_JARDINIERES = 80;
        const MAX_PLANTS_PER_JARDINIERE = 150;
	        const WORLD_GRID_METERS = 100;
        const GRID_FADE_DISTANCE_M = 15;
        const GRID_FADE_DISTANCE_UNITS = GRID_FADE_DISTANCE_M * 10;
        const GRID_FADE_DISTANCE_PX = GRID_FADE_DISTANCE_UNITS * GRID_SIZE;
        const WORLD_GRID_HALF_UNITS = (WORLD_GRID_METERS * 10) / 2; // 1 unite = 10 cm
        const WORLD_GRID_HALF_PX = WORLD_GRID_HALF_UNITS * GRID_SIZE; // 20 px = 10 cm
        
        // Épaisseurs des éléments (en pixels, 20px = 10cm)
        const ELEMENT_THICKNESS = {
            'wall': 4,      // 20cm
            'window': 1.6,  // 8cm
            'glass': 1.6,   // 8cm
            'rail': 1.6     // 8cm
        };

        const PLANT_PRESETS = {
            'Clématite': { color: 0x6a3fa0, onTreillis: true },
            'Jasmin': { color: 0xe8f5c8, onTreillis: true },
            'Fougère': { color: 0x1a3300, onTreillis: false },
            'Plante 1': { color: 0x2d6a2d, onTreillis: false },
            'Plante 2': { color: 0x3a8f3a, onTreillis: false }
        };
        const DEFAULT_POT_PLANT_COLORS = [0x2d6a2d, 0x3a8f3a, 0x4aad4a, 0x1f5c1f, 0x558b2f, 0x33691e, 0x7cb342, 0x388e3c, 0x1b5e20, 0x66bb6a, 0x43a047, 0x81c784, 0x2e7d32, 0xa5d6a7, 0xc8e6c9];
