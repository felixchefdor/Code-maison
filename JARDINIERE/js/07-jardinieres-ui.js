        function deselect2dJardiniere() {
            clearJardiniereSelection();
        }

        function selectJardiniere(j, options = {}) {
            if(!j) return;
            const { openEditor = true, redraw = true, center = false } = options;
            resetPlacementInteractionState();
            selectedPlacementObject = j;
            selected2dBench = null;
            selected2dPottedTree = null;
            selected2dCube = null;
            selected2dCornerFill = null;
            selected2dJardiniere = j;
            if(openEditor && currentEditorMode !== 'jardinieres') switchEditor('jardinieres');
	            updateJardPanel();
	            updateJard3DHighlight();
	            if(center) center2DOnJardiniere(j);
	            updateJardFloatingOpenButton();
	            if(redraw) draw2D();
        }

        function clearJardiniereSelection(options = {}) {
            const { redraw = true } = options;
            selected2dJardiniere = null;
            selected2dBench = null;
            selected2dPottedTree = null;
            selected2dCube = null;
            selected2dCornerFill = null;
            selectedPlacementObject = null;
            resizingJardiniere = null;
            resizingBench = null;
            resizeMode = null;
            rotatingJardiniere = null;
            rotatingBench = null;
	            updateJardPanel();
	            updateJard3DHighlight();
	            updateJardFloatingOpenButton();
	            if(redraw) draw2D();
	        }

        function shouldUseCompactJardSelection() {
            const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            return activeMainView === 'mixte' && coarse;
        }

        function ensureJardFloatingOpenButton() {
            if(jardFloatingOpenButton) return jardFloatingOpenButton;
            jardFloatingOpenButton = document.createElement('button');
            jardFloatingOpenButton.type = 'button';
            jardFloatingOpenButton.className = 'jard-floating-open';
            jardFloatingOpenButton.textContent = 'Réglages';
            jardFloatingOpenButton.addEventListener('pointerdown', event => event.stopPropagation());
            jardFloatingOpenButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                if(!selected2dJardiniere) return;
                switchEditor('jardinieres');
                updateJardPanel();
                updateJardFloatingOpenButton();
            });
            document.body.appendChild(jardFloatingOpenButton);
            return jardFloatingOpenButton;
        }

        function updateJardFloatingOpenButton() {
            const btn = ensureJardFloatingOpenButton();
            if(!selected2dJardiniere || !shouldUseCompactJardSelection() || currentEditorMode === 'jardinieres' || !canvas2d) {
                btn.classList.remove('visible');
                return;
            }
            const rect = canvas2d.getBoundingClientRect();
            const world = getJardWorldFromLocalCentered(selected2dJardiniere, selected2dJardiniere.w * 10, -selected2dJardiniere.d * 10);
            const screenWorld = worldToScreen2D(world.x, world.y);
            const x = rect.left + offsetX + screenWorld.x * scale + 12;
            const y = rect.top + offsetY + screenWorld.y * scale - 12;
            btn.style.left = Math.min(window.innerWidth - 92, Math.max(8, x)) + 'px';
            btn.style.top = Math.min(window.innerHeight - 42, Math.max(8, y)) + 'px';
            btn.classList.add('visible');
        }

        function switchEditor(mode) {
            if(mode === 'ambiance') mode = activeMainView === '3d' || activeMainView === 'mixte' ? 'overview' : 'jardinieres';
            let toggledBesideJardinieres = false;
            if(mode === 'devis' && currentEditorMode === 'jardinieres') {
                showDevisBesideJardinieres = !showDevisBesideJardinieres;
                if(showDevisBesideJardinieres) showFabricationBesideJardinieres = false;
                mode = 'jardinieres';
                toggledBesideJardinieres = true;
            } else if(mode === 'chantier' && currentEditorMode === 'jardinieres') {
                showFabricationBesideJardinieres = !showFabricationBesideJardinieres;
                if(showFabricationBesideJardinieres) showDevisBesideJardinieres = false;
                mode = 'jardinieres';
                toggledBesideJardinieres = true;
            }
            if(!toggledBesideJardinieres && mode === currentEditorMode && mode !== 'overview') {
                mode = 'overview';
            }
            if(mode !== currentEditorMode && canAutoFinalizeSketch()) {
                finalizeSketchClosure({ silent: true });
            } else if(mode !== currentEditorMode && currentEditorMode === 'balcon' && doesSketchNeedClosure()) {
                showSketchClosureAlert("Contour encore ouvert: terminez-le avant de quitter l'edition du balcon.");
                return;
            }
            currentEditorMode = mode;
            if(currentEditorMode !== 'balcon') closeArchPanel();
            if(currentEditorMode !== 'balcon') toggleHorizonPanel(false);
            if(currentEditorMode !== 'balcon') closeHorizonDrawView();
            if(currentEditorMode !== 'jardinieres') {
                showDevisBesideJardinieres = false;
                showFabricationBesideJardinieres = false;
            }
            const sidebar = document.querySelector('.sidebar-2d');
            const jardPanel = document.getElementById('jard-panel-2d');
            const devisPanel = document.getElementById('devis-panel-2d');
            const chantierPanel = document.getElementById('chantier-panel-2d');
            const editorTabs = document.getElementById('editor-tabs');
            const tabBalcon = document.getElementById('tab-balcon');
            const tabJardinieres = document.getElementById('tab-jardinieres');
            const tabDevis = document.getElementById('tab-devis');
            const tabChantier = document.getElementById('tab-chantier');

            // Réinitialiser tous les états
            [tabBalcon, tabJardinieres, tabDevis, tabChantier].forEach(t => t && t.classList.remove('active'));
            sidebar.classList.remove('active-pane');
            sidebar.classList.add('hidden');
            jardPanel.classList.remove('visible', 'active-pane');
            devisPanel.classList.remove('visible', 'active-pane');
            chantierPanel.classList.remove('visible', 'active-pane');
            devisPanel.style.left = '';
            chantierPanel.style.left = '';
            sidebar.style.zIndex = '10';
            jardPanel.style.zIndex = '10';
            devisPanel.style.zIndex = '10';
            chantierPanel.style.zIndex = '10';

            if (mode === 'jardinieres') {
                sidebar.classList.add('hidden');
                jardPanel.classList.add('visible', 'active-pane');
                jardPanel.style.zIndex = '20';
                if(showDevisBesideJardinieres) {
                    devisPanel.classList.add('visible');
                    devisPanel.style.left = 'calc(var(--activity-bar-w) + var(--left-panel-w))';
                    devisPanel.style.zIndex = '15';
                    tabDevis.classList.add('active');
                    initDevisForm();
                }
                if(showFabricationBesideJardinieres) {
                    chantierPanel.classList.add('visible');
                    chantierPanel.style.left = 'calc(var(--activity-bar-w) + var(--left-panel-w))';
                    chantierPanel.style.zIndex = '15';
                    tabChantier.classList.add('active');
                    initFabricationForm();
                    renderLiveTechnicalPlans();
                }
                tabJardinieres.classList.add('active');
            } else if (mode === 'devis') {
                sidebar.classList.add('hidden');
                devisPanel.classList.add('visible', 'active-pane');
                devisPanel.style.zIndex = '20';
                jardPanel.style.zIndex = '10';
                chantierPanel.style.zIndex = '10';
                tabDevis.classList.add('active');
                initDevisForm();
            } else if (mode === 'chantier') {
                sidebar.classList.add('hidden');
                chantierPanel.classList.add('visible', 'active-pane');
                chantierPanel.style.zIndex = '20';
                jardPanel.style.zIndex = '10';
                devisPanel.style.zIndex = '10';
                tabChantier.classList.add('active');
                initFabricationForm();
                renderLiveTechnicalPlans();
            } else if (mode === 'balcon') {
                // balcon
                sidebar.classList.remove('hidden');
                sidebar.classList.add('active-pane');
                sidebar.style.zIndex = '20';
                tabBalcon.classList.add('active');
            } else {
                currentEditorMode = 'overview';
                clearActiveDrawingTool();
                clearJardiniereSelection({ redraw: false });
            }
            updateRenderStageLayout();
            draw2D();
        }

        function updateSun2d(h) {
            const val = Math.max(0, Math.min(24, parseFloat(h)));
            if(!Number.isFinite(val)) return;
            if(Math.abs(val - sunHour2d) > 1e-6) saveState();
            sunHour2d = val;
            const hh = Math.floor(val);
            const mm = Math.round((val - hh) * 60);
            document.getElementById('sun-hour-2d-val').textContent = hh + 'h' + (mm ? mm.toString().padStart(2,'0') : '');
            updateSun(val);
            refreshSunDependentArchitecture();
        }

        function refreshSunDependentArchitecture() {
            if(typeof build3DArch !== 'function') return;
            build3DArch();
            if(typeof updateJard3DHighlight === 'function') updateJard3DHighlight();
            if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
        }

        function applyBalconySceneTransform() {
            const rot = (balconyWorldOrientationDeg - 180) * Math.PI / 180;
            if(balconySceneGroup) {
                let pivot = { x: 0, y: 0 };
                if(typeof getBalconyScenePivot2D === 'function') pivot = getBalconyScenePivot2D();
                const pivotX = (Number(pivot.x) || 0) / 20;
                const pivotZ = (Number(pivot.y) || 0) / 20;
                const cos = Math.cos(rot);
                const sin = Math.sin(rot);
                balconySceneGroup.rotation.y = -rot;
                balconySceneGroup.position.set(
                    balconyOffsetX + pivotX - (pivotX * cos - pivotZ * sin),
                    0,
                    balconyOffsetZ + pivotZ - (pivotX * sin + pivotZ * cos)
                );
            }
            if(typeof refreshGroundGrid === 'function') refreshGroundGrid();
            if(typeof setCameraTargetToBalconyCenter === 'function' && activeMainView !== '2d') {
                setCameraTargetToBalconyCenter({ preserveCameraOffset: true });
            }
            if(typeof rebuildVisAVisGuideMeshes === 'function') rebuildVisAVisGuideMeshes();
        }

        function updateBalconyOrientation2D(value, commit = false) {
            const balconyRot = Math.max(-180, Math.min(180, parseFloat(value)));
            if(!Number.isFinite(balconyRot)) return;
            const newDeg = 180 + balconyRot;
            if(commit && Math.abs(newDeg - balconyOrientationDeg) > 1e-6) saveState();
            adjustHorizonAzimuthsForRotation(balconyOrientationDeg, newDeg);
            balconyOrientationDeg = newDeg;
            balconyWorldOrientationDeg = newDeg;
            applyBalconySceneTransform();
            if(typeof snapBalconyPlacementToSupportBuilding === 'function'
                && typeof balconyBuildingPlacementActive !== 'undefined'
                && balconyBuildingPlacementActive) {
                snapBalconyPlacementToSupportBuilding();
            }
            syncSun2dControls();
            updateSun(sunHour2d);
            refreshSunDependentArchitecture();
            rebuildHorizonWall();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
            if(typeof draw2D === 'function') draw2D();
        }

        function updateScreenRotation2D(value, commit = false) {
            const screenRot = Math.max(-180, Math.min(180, parseFloat(value)));
            if(!Number.isFinite(screenRot)) return;
            if(commit && Math.abs(screenRot - screenRotation2DDeg) > 1e-6) saveState();
            screenRotation2DDeg = screenRot;
            syncSun2dControls();
            if(typeof draw2D === 'function') draw2D();
        }

        function moveBalcony(dx, dz, reset = false) {
            const STEP = 5; // 0,5 m en unités scène
            if(reset) {
                balconyOffsetX = 0;
                balconyOffsetZ = 0;
            } else {
                balconyOffsetX += dx * STEP;
                balconyOffsetZ += dz * STEP;
            }
            saveState();
            applyBalconySceneTransform();
            if(typeof rebuildHorizonWall === 'function') rebuildHorizonWall();
            syncSun2dControls();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof markVisAVisDirty === 'function') markVisAVisDirty();
        }

        function updateSunSeason(value) {
            const nextSeason = ['today', 'spring', 'summer', 'autumn', 'winter'].includes(value) ? value : 'summer';
            sunSeason = nextSeason;
            if(sunSeason === 'today' && !sunDateISO) {
                sunDateISO = getCurrentSunDateISO();
            }
            saveState();
            syncSun2dControls();
            updateSun(sunHour2d);
            refreshSunDependentArchitecture();
            markSolarMapDirty();
        }

        function updateSolarMapPeriod(value) {
            const nextPeriod = ['annual', 'spring', 'summer', 'autumn', 'winter'].includes(value) ? value : 'annual';
            solarMapPeriod = nextPeriod;
            sunSeason = nextPeriod === 'annual' ? 'summer' : nextPeriod;
            saveState();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
            if(typeof solarMapData !== 'undefined' && solarMapData && typeof clearSolarMapMeshes === 'function') {
                solarMapVisible = false;
                clearSolarMapMeshes();
            }
            updateSun(sunHour2d);
            refreshSunDependentArchitecture();
            syncSun2dControls();
            if(typeof updateSolarMapUI === 'function') updateSolarMapUI();
            if(typeof draw2D === 'function') draw2D();
            if(typeof renderCurrent3DFrame === 'function') renderCurrent3DFrame();
        }

        function getCurrentSunDateISO(now = new Date()) {
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            return year + '-' + month + '-' + day;
        }

        function applyCurrentDeviceSunTime() {
            const now = new Date();
            sunHour2d = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600;
            sunDateISO = getCurrentSunDateISO(now);
            sunSeason = 'today';
            saveState();
            syncSun2dControls();
            updateSun(sunHour2d);
            refreshSunDependentArchitecture();
            if(typeof markSolarMapDirty === 'function') markSolarMapDirty();
        }

        function formatSunClockTime(decimalHour) {
            const safeHour = Math.max(0, Math.min(24, Number(decimalHour) || 0));
            const hh = Math.floor(safeHour);
            const mm = Math.round((safeHour - hh) * 60);
            const carry = mm >= 60 ? 1 : 0;
            const finalHour = Math.min(24, hh + carry);
            const finalMinute = carry ? 0 : mm;
            return finalHour + 'h' + String(finalMinute).padStart(2, '0');
        }

        function formatSunModelDate(date) {
            if(!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
            return String(date.getDate()).padStart(2, '0') + '/' + String(date.getMonth() + 1).padStart(2, '0');
        }

        function getSunAzimuthLabel(azimuthDeg) {
            if(!Number.isFinite(azimuthDeg)) return '';
            const az = ((azimuthDeg + 180) % 360 + 360) % 360 - 180;
            if(Math.abs(az) <= 22.5) return 'Sud';
            if(az > 22.5 && az <= 67.5) return 'Sud-Ouest';
            if(az > 67.5 && az <= 112.5) return 'Ouest';
            if(az > 112.5 && az <= 157.5) return 'Nord-Ouest';
            if(az >= 157.5 || az <= -157.5) return 'Nord';
            if(az < -112.5) return 'Nord-Est';
            if(az < -67.5) return 'Est';
            return 'Sud-Est';
        }

        function updateSunModelInfo() {
            const info = document.getElementById('sun-model-info');
            if(!info || typeof getSunStateForHour !== 'function') return;
            const sunState = getSunStateForHour(sunHour2d);
            if(!sunState || !sunState.seasonConfig) {
                info.textContent = '';
                return;
            }
            const location = sunState.solarLocation || {};
            const sourceLabel = location.source === 'address'
                ? 'adresse importée'
                : (location.source === 'invalid-address' ? 'coord. adresse invalides · Bruz' : 'Bruz par défaut');
            const elevation = Number.isFinite(sunState.elevationDeg)
                ? Math.max(0, Math.round(sunState.elevationDeg))
                : 0;
            const dateLabel = formatSunModelDate(sunState.seasonConfig.date);
            const azimuth = Number.isFinite(sunState.azimuthDeg) ? Math.round(sunState.azimuthDeg) : null;
            const azimuthLabel = azimuth === null ? '' : getSunAzimuthLabel(azimuth);
            const hemisphereLabel = location.hemisphere === 'south' ? 'hém. Sud' : 'hém. Nord';
            const coordsLabel = Number.isFinite(location.lat) && Number.isFinite(location.lon)
                ? 'lat ' + location.lat.toFixed(2) + ' lon ' + location.lon.toFixed(2)
                : '';
            info.textContent = sourceLabel
                + ' · ' + hemisphereLabel
                + (coordsLabel ? ' · ' + coordsLabel : '')
                + (dateLabel ? ' · ' + dateLabel : '')
                + ' · lever ' + formatSunClockTime(sunState.seasonConfig.sunrise)
                + ' · midi solaire ' + formatSunClockTime(sunState.seasonConfig.solarNoon)
                + ' · coucher ' + formatSunClockTime(sunState.seasonConfig.sunset)
                + (azimuth === null ? '' : ' · az ' + azimuth + '° ' + azimuthLabel)
                + ' · hauteur ' + elevation + '°';
        }

        function getMapNorthCompassAngle2D() {
            const importedMapRotationDeg = Number.isFinite(balconyWorldOrientationDeg) ? balconyWorldOrientationDeg - 180 : 0;
            const screenViewRotationDeg = Number.isFinite(screenRotation2DDeg) ? screenRotation2DDeg : 0;
            return screenViewRotationDeg - importedMapRotationDeg;
        }

        function syncSun2dControls() {
            const slider = document.getElementById('sun-hour-2d');
            if(slider) slider.value = sunHour2d;
            const valLabel = document.getElementById('sun-hour-2d-val');
            if(valLabel) {
                const hh = Math.floor(sunHour2d);
                const mm = Math.round((sunHour2d - hh) * 60);
                valLabel.textContent = hh + 'h' + (mm ? mm.toString().padStart(2,'0') : '');
            }
            const balconyRot = Math.round(balconyOrientationDeg - 180);
            const rotSlider = document.getElementById('balcony-orientation-2d');
            if(rotSlider) rotSlider.value = balconyRot;
            const rotVal = document.getElementById('balcony-orientation-2d-val');
            if(rotVal) rotVal.textContent = (balconyRot > 0 ? '+' : '') + balconyRot + '°';
            const screenRot = Math.round(screenRotation2DDeg);
            const viewSlider = document.getElementById('view-rotation-2d');
            if(viewSlider) viewSlider.value = screenRot;
            const viewVal = document.getElementById('view-rotation-2d-val');
            if(viewVal) viewVal.textContent = (screenRot > 0 ? '+' : '') + screenRot + '°';
            const compassNeedle = document.getElementById('compass-2d-needle');
            if(compassNeedle) {
                const compassAngle = getMapNorthCompassAngle2D();
                compassNeedle.setAttribute('transform', `rotate(${compassAngle},27,27)`);
            }
            const offsetLabel = document.getElementById('balcony-offset-val');
            if(offsetLabel) {
                const xM = Math.round((balconyOffsetX / 10) * 10) / 10;
                const zM = Math.round((balconyOffsetZ / 10) * 10) / 10;
                offsetLabel.textContent = (xM >= 0 ? '+' : '') + xM + 'm, ' + (zM >= 0 ? '+' : '') + zM + 'm';
            }
            const seasonSelect = document.getElementById('sun-season-2d');
            if(seasonSelect) seasonSelect.value = sunSeason;
            const solarMapPeriodSelect = document.getElementById('solar-map-period');
            if(solarMapPeriodSelect) solarMapPeriodSelect.value = solarMapPeriod;
            updateSunModelInfo();
        }

        function setSkyPreset(h) {
            const slider = document.getElementById('sun-hour-2d');
            if(slider) { slider.value = h; updateSun2d(h); }
        }

        function setWoodColorPreset(color) {
            const input = document.getElementById('wood-color-2d');
            if(input) input.value = color;
            updateWoodColor2d(color, true);
        }

        function prepareLiveJardSliderEdit(commit) {
            if(commit) {
                if(!isLiveJardSliderEditing) saveState();
                isLiveJardSliderEditing = false;
                return false;
            }
            if(!isLiveJardSliderEditing) {
                saveState();
                isLiveJardSliderEditing = true;
            }
            return true;
        }

        function refreshJardiniereAfterSlider(j, commit = true) {
            if(!j) return;
            clearTimeout(jardSliderRebuildTimer);
            if(commit) {
                rebuildJardiniere(j);
                if(typeof triggerMagicDustForPlacement === 'function') triggerMagicDustForPlacement(j, { intensity: 'move' });
                renderCurrent3DFrame();
                return;
            }
            jardSliderRebuildTimer = setTimeout(() => {
                rebuildJardiniere(j);
                renderCurrent3DFrame();
            }, 90);
        }

        function refreshPlacementAfterSlider(obj, commit = true) {
            if(!obj) return;
            clearTimeout(placementSliderRebuildTimer);
            if(commit) {
                rebuildPlacementObject(obj);
                if(typeof triggerMagicDustForPlacement === 'function') triggerMagicDustForPlacement(obj, { intensity: 'move' });
                renderCurrent3DFrame();
                return;
            }
            placementSliderRebuildTimer = setTimeout(() => {
                rebuildPlacementObject(obj);
                renderCurrent3DFrame();
            }, 130);
        }

        function updateWoodPaletteUI(color) {
            setColorChip('wood-color-toggle-2d', color);
            document.querySelectorAll('#wood-palette-2d .wood-swatch').forEach(btn => {
                const swatchColor = (btn.style.backgroundColor || '').toLowerCase();
                const normalized = document.createElement('span');
                normalized.style.color = color;
                document.body.appendChild(normalized);
                const selectedColor = getComputedStyle(normalized).color.toLowerCase();
                normalized.remove();
                btn.classList.toggle('active', swatchColor === selectedColor);
            });
        }

        function updateWoodColor2d(color, commit = true) {
            const j = selected2dJardiniere;
            if(!j) return;
            const hasChange = j.woodColor !== color;
            updateWoodPaletteUI(color);
            if(!hasChange) return;

            if(!prepareLiveJardSliderEdit(commit)) {
                // The original state was already captured at the start of the slider gesture.
            }
            j.woodColor = color;
            rebuildJardiniere(j);
            renderCurrent3DFrame();
        }

        function addAndSelect2dJardiniere() {
            if(jardinières.length >= MAX_JARDINIERES) {
                alert('Limite atteinte: maximum ' + MAX_JARDINIERES + ' jardinieres.');
                return;
            }
            saveState();
            const created = createConstruction('jardiniere');
            if(created) selectJardiniere(created);
        }

        function duplicate2dJardiniere() {
            duplicateSelectedPlacementObject();
        }

        function delete2dJardiniere() {
            if(!selected2dJardiniere) return;
            saveState();
            const idx = jardinières.findIndex(j => j.id === selected2dJardiniere.id);
            if(idx === -1) return;
            (balconySceneGroup || scene).remove(jardinières[idx].group);
            jardinières.splice(idx, 1);
            clearJardiniereSelection();
            if(jardinières.length === OPTIMIZED_LIGHTING_JARDINIERE_COUNT - 1) {
                jardinières.forEach(item => rebuildJardiniere(item));
            }
            refreshFabricationAndPricing();
            renderLiveTechnicalPlans();
        }

        function update2dJardDimension(prop, value, commit = true) {
            if(!selected2dJardiniere) return;
            if(prop !== 'w' && prop !== 'd') return;
            prepareLiveJardSliderEdit(commit);

            const j = selected2dJardiniere;
            const nextValue = roundToTwoDecimals(parseFloat(value));
            if(!Number.isFinite(nextValue)) return;
            setPlacementDimensionFromTopLeft(j, prop, nextValue, JARD_RESIZE_LIMITS);

            refreshJardiniereAfterSlider(j, commit);
            const label = document.getElementById(prop === 'w' ? 'jard-w-2d-val' : 'jard-d-2d-val');
            if(label) label.textContent = prop === 'w' ? formatCmMmFromDm(j.w) : formatCmMmFromDm(j.d);
            if(commit) updateJardPanel();
            draw2D();
        }

        function parseEditableDimensionValue(text) {
            const match = String(text || '').replace(',', '.').match(/-?\d+(?:\.\d+)?/);
            return match ? parseFloat(match[0]) : NaN;
        }

        function applyEditableDimensionValue(range, value) {
            if(!range) return false;
            const handlerCode = range.getAttribute('onchange') || range.getAttribute('oninput') || '';
            if(!handlerCode) return false;
            const manualCode = handlerCode
                .replace(/this\.value\s*\/\s*10/g, 'manualValue / 10')
                .replace(/this\.value/g, 'manualValue');
            window.manualDimensionEditActive = true;
            try {
                new Function('manualValue', manualCode)(value);
            } catch (error) {
                console.warn('Saisie manuelle de dimension impossible', error);
                return false;
            } finally {
                window.manualDimensionEditActive = false;
            }
            return true;
        }

        function commitEditableDimensionValue(label) {
            if(!label || label.dataset.editingDim !== '1') return;
            const input = label.querySelector('.dim-value-input');
            label.dataset.editingDim = '0';
            const row = label.closest('.jp-row');
            const range = row ? row.querySelector('input[type="range"]') : null;
            if(!range) {
                label.textContent = label.dataset.prevText || label.textContent;
                return;
            }
            const rawValue = input ? input.value : label.textContent;
            const value = parseEditableDimensionValue(rawValue);
            if(!Number.isFinite(value)) {
                label.textContent = label.dataset.prevText || label.textContent;
                return;
            }
            if(input) label.textContent = label.dataset.prevText || '';
            if(!applyEditableDimensionValue(range, value)) {
                label.textContent = label.dataset.prevText || label.textContent;
            }
        }

        function cancelEditableDimensionValue(label) {
            if(!label || label.dataset.editingDim !== '1') return;
            label.dataset.editingDim = '0';
            label.textContent = label.dataset.prevText || label.textContent;
        }

        function getEditableDimensionLabel(target) {
            const label = target && target.closest ? target.closest('.dim-value') : null;
            if(!label || !label.id || !label.id.endsWith('-val')) return null;
            const row = label.closest('.jp-row');
            if(!row || !row.querySelector('input[type="range"]')) return null;
            return label;
        }

        function beginEditableDimensionValue(label) {
            if(!label) return null;
            const existingInput = label.querySelector('.dim-value-input');
            if(existingInput) return existingInput;
            const row = label.closest('.jp-row');
            const range = row ? row.querySelector('input[type="range"]') : null;
            if(!range) return null;

            const prevText = label.textContent;
            const value = parseEditableDimensionValue(prevText);
            label.dataset.prevText = prevText;
            label.dataset.editingDim = '1';

            const input = document.createElement('input');
            input.className = 'dim-value-input';
            input.type = 'number';
            input.inputMode = 'decimal';
            input.pattern = '[0-9]*[.,]?[0-9]*';
            input.autocomplete = 'off';
            input.enterKeyHint = 'done';
            input.step = String(prevText || '').includes(',') || String(range.step || '').includes('.') ? '0.1' : '1';
            if(Number.isFinite(value)) input.value = String(value).replace(',', '.');
            input.setAttribute('aria-label', 'Valeur modifiable');

            label.textContent = '';
            label.appendChild(input);
            window.setTimeout(() => {
                input.focus();
                input.select();
            }, 0);
            return input;
        }

        function initEditableDimensionValues() {
            document.addEventListener('pointerdown', (event) => {
                if(event.target && event.target.classList && event.target.classList.contains('dim-value-input')) return;
                const label = getEditableDimensionLabel(event.target);
                if(!label) return;
                const input = beginEditableDimensionValue(label);
                if(!input) return;
                event.preventDefault();
            }, true);

            document.addEventListener('focusin', (event) => {
                if(event.target && event.target.classList && event.target.classList.contains('dim-value-input')) return;
                const label = getEditableDimensionLabel(event.target);
                if(label) beginEditableDimensionValue(label);
            });

            document.addEventListener('click', (event) => {
                const label = getEditableDimensionLabel(event.target);
                if(label) beginEditableDimensionValue(label);
            });

            document.addEventListener('keydown', (event) => {
                const input = event.target && event.target.classList && event.target.classList.contains('dim-value-input') ? event.target : null;
                const label = input && input.closest ? input.closest('.dim-value') : null;
                if(!label) return;
                if(event.key === 'Enter') {
                    event.preventDefault();
                    commitEditableDimensionValue(label);
                    if(input) input.blur();
                } else if(event.key === 'Escape') {
                    event.preventDefault();
                    cancelEditableDimensionValue(label);
                    if(input) input.blur();
                }
            });

            document.addEventListener('focusout', (event) => {
                const input = event.target && event.target.classList && event.target.classList.contains('dim-value-input') ? event.target : null;
                const label = input && input.closest ? input.closest('.dim-value') : null;
                if(label) window.setTimeout(() => commitEditableDimensionValue(label), 0);
            });

            document.querySelectorAll('.dim-value[id$="-val"]').forEach(label => {
                const row = label.closest('.jp-row');
                if(!row || !row.querySelector('input[type="range"]')) return;
                label.tabIndex = 0;
                label.setAttribute('role', 'textbox');
                label.setAttribute('aria-label', 'Valeur modifiable');
                label.removeAttribute('contenteditable');
            });
        }

        function update2dJardTopHeight(value, commit = true) {
            if(!selected2dJardiniere) return;
            prepareLiveJardSliderEdit(commit);

            const j = selected2dJardiniere;
            const metrics = computeJardiniereConstructionMetrics(j);
            const cuveH = metrics.cuveH;
            const targetCuveH = metrics.construction.cuveTargetH;
            // Autoriser un bac affleurant au sol (sans pieds qui dépassent).
            const minLegH = 0;
            const maxLegH = 12;
            const requestedTopH = parseFloat(value) || (j.legH + cuveH);
            const minTopH = window.manualDimensionEditActive ? 0.1 : Math.max(cuveH, targetCuveH);
            const safeTopH = Math.max(minTopH, requestedTopH);
            const requestedLegH = safeTopH - cuveH;
            const safeLegH = Math.max(minLegH, Math.min(maxLegH, requestedLegH));
            j.legH = safeLegH;

            refreshJardiniereAfterSlider(j, commit);
            const label = document.getElementById('jard-top-h-2d-val');
            if(label) label.textContent = formatCmMmFromDm(safeLegH + cuveH);
            if(commit) updateJardPanel();
            draw2D();
        }

        function update2dJardCuveDepth(value, commit = true) {
            if(!selected2dJardiniere) return;
            prepareLiveJardSliderEdit(commit);

            const j = selected2dJardiniere;
            const construction = ensureJardConstructionSettings(j);
            const requestedCuveTarget = parseFloat(value) || construction.boardWidth;
            construction.cuveTargetH = window.manualDimensionEditActive
                ? Math.max(0.1, requestedCuveTarget)
                : snapCuveTargetHeight(construction, requestedCuveTarget);

            // Garantir la règle UI/métier: H. haut >= Prof. bac (cible), même si la
            // profondeur réelle de cuve est discrète (nb de planches).
            const refreshedMetrics = computeJardiniereConstructionMetrics(j);
            const minTopH = Math.max(refreshedMetrics.cuveH, requestedCuveTarget);
            const currentTopH = j.legH + refreshedMetrics.cuveH;
            if(currentTopH < minTopH) {
                j.legH = Math.min(12, Math.max(0, minTopH - refreshedMetrics.cuveH));
            }

            refreshJardiniereAfterSlider(j, commit);
            const label = document.getElementById('jard-cuve-h-2d-val');
            if(label) label.textContent = formatCmMmFromDm(construction.cuveTargetH);
            if(commit) updateJardPanel();
            draw2D();
        }

        function toggleTreillis2d(side) {
            if(!selected2dJardiniere) return;
            saveState();
            const j = selected2dJardiniere;
            if(side === 'back') {
                j.treillisBack = !j.treillisBack;
                j.hasTreillis = j.treillisBack; // Garder compat
            }
            if(side === 'left') j.treillisLeft = !j.treillisLeft;
            if(side === 'right') j.treillisRight = !j.treillisRight;
            rebuildJardiniere(j);
            updateJardPanel();
            draw2D();
        }

        function toggleTreillisLights2d() {
            toggleTreillisSpots2d();
        }

        function hasTreillisSpots(j) {
            return j && (j.treillisSpotLights !== undefined ? !!j.treillisSpotLights : !!j.treillisLights);
        }

        function hasTreillisWhiteGarland(j) {
            return j && (j.treillisWhiteGarland !== undefined ? !!j.treillisWhiteGarland : (!!j.treillisLights && !j.treillisGinguette));
        }

        function hasTreillisGinguette(j) {
            return !!(j && j.treillisGinguette);
        }

        function normalizeGarlandPosts(posts = []) {
            const validCorners = new Set(['backLeft', 'backRight']);
            const normalized = [];
            const seen = new Set();

            if(Array.isArray(posts)) {
                posts.forEach((post, index) => {
                    const corner = post && validCorners.has(post.corner) ? post.corner : null;
                    if(!corner || seen.has(corner)) return;
                    seen.add(corner);
                    normalized.push({
                        id: (post.id && typeof post.id === 'string') ? post.id : `gp-${corner}-${index}`,
                        corner
                    });
                });
                return normalized;
            }

            if(posts && typeof posts === 'object') {
                ['backLeft', 'backRight'].forEach(corner => {
                    if(posts[corner] && !seen.has(corner)) {
                        seen.add(corner);
                        normalized.push({ id: `gp-${corner}`, corner });
                    }
                });
            }
            return normalized;
        }

        function normalizeGarlandLinks(links = []) {
            if(!Array.isArray(links)) return [];
            return links
                .filter(link => link && typeof link.from === 'string' && typeof link.to === 'string' && link.from !== link.to)
                .map(link => ({
                    from: link.from,
                    to: link.to,
                    fromJardId: typeof link.fromJardId === 'string' ? link.fromJardId : null,
                    toJardId: typeof link.toJardId === 'string' ? link.toJardId : null
                }))
                .slice(0, 12);
        }

        function getJardiniereLabel(j) {
            const index = jardinières.findIndex(item => item === j);
            return index >= 0 ? `Jard. ${index + 1}` : 'Jard.';
        }

        function getGarlandAnchorRef(j, anchorId) {
            if(!j || !anchorId) return null;
            const anchor = getGarlandAnchors(j).find(item => item.id === anchorId);
            if(!anchor) return null;
            return { j, jardId: j.id, anchorId, anchor };
        }

        function getGarlandLinkEndpoint(link, side, ownerJ = null) {
            const isFrom = side === 'from';
            const anchorId = isFrom ? link.from : link.to;
            const jardId = isFrom ? link.fromJardId : link.toJardId;
            const j = jardinières.find(item => item.id === jardId) || ownerJ;
            return getGarlandAnchorRef(j, anchorId);
        }

        function getGarlandEndpoint2D(ref) {
            if(!ref || !ref.j || !ref.anchor) return null;
            return {
                ...getJardWorldFromLocalCentered(ref.j, ref.anchor.x * 20, ref.anchor.z * 20),
                ref
            };
        }

        function getGarlandAnchorWorld3D(ref) {
            if(!ref || !ref.j || !ref.anchor) return null;
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ref.j.rot || 0, 0));
            return new THREE.Vector3(ref.anchor.x, ref.anchor.y, ref.anchor.z).applyQuaternion(q).add(ref.j.pos);
        }

        function worldToJardLocal3D(j, worldPoint) {
            const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -(j.rot || 0), 0));
            return worldPoint.clone().sub(j.pos).applyQuaternion(q);
        }

        function getGarlandAnchors(j, metrics = null) {
            if(!j) return [];
            const m = metrics || computeJardiniereConstructionMetrics(j);
            const posts = normalizeGarlandPosts(j.garlandPosts);
            const topY = m.postHeight + (j.treillisH || 13) + 0.12;
            const postInset = 0.35;
            const anchors = [];
            const add = (id, label, x, y, z, kind = 'post') => anchors.push({ id, label, x, y, z, kind });

            posts.forEach(post => {
                const isLeft = post.corner === 'backLeft';
                add(
                    `post:${post.id}`,
                    isLeft ? 'Piquet arr. gauche' : 'Piquet arr. droit',
                    isLeft ? -j.w / 2 + postInset : j.w / 2 - postInset,
                    topY,
                    -j.d / 2 + postInset
                );
            });

            const trellisY = m.postHeight + (j.treillisH || 13) + 0.08;
            const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
            if(hasBack) {
                add('trellis:backLeft', 'Treillis arr. gauche', -j.w / 2, trellisY, -j.d / 2 + postInset, 'trellis');
                add('trellis:backRight', 'Treillis arr. droit', j.w / 2, trellisY, -j.d / 2 + postInset, 'trellis');
            }
            if(j.treillisLeft) {
                add('trellis:leftBack', 'Treillis gauche arr.', -j.w / 2 + postInset, trellisY, -j.d / 2, 'trellis');
                add('trellis:leftFront', 'Treillis gauche av.', -j.w / 2 + postInset, trellisY, j.d / 2, 'trellis');
            }
            if(j.treillisRight) {
                add('trellis:rightBack', 'Treillis droit arr.', j.w / 2 - postInset, trellisY, -j.d / 2, 'trellis');
                add('trellis:rightFront', 'Treillis droit av.', j.w / 2 - postInset, trellisY, j.d / 2, 'trellis');
            }
            return anchors;
        }

        function getGarlandPostSnapPoints2D() {
            const inset = 7;
            const points = [];
            const source = selected2dJardiniere ? [selected2dJardiniere] : jardinières;
            source.forEach(j => {
                const left = getJardWorldFromLocalCentered(j, -j.w * 10 + inset, -j.d * 10 + inset);
                const right = getJardWorldFromLocalCentered(j, j.w * 10 - inset, -j.d * 10 + inset);
                points.push({ type: 'post', j, corner: 'backLeft', x: left.x, y: left.y, label: 'Arr. gauche' });
                points.push({ type: 'post', j, corner: 'backRight', x: right.x, y: right.y, label: 'Arr. droit' });
            });
            return points;
        }

        function getGarlandLinkSnapPoints2D(j = selected2dJardiniere) {
            if(!j) return [];
            return getGarlandAnchors(j).map(anchor => ({
                type: 'anchor',
                j,
                anchor,
                ...getJardWorldFromLocalCentered(j, anchor.x * 20, anchor.z * 20),
                label: anchor.label
            }));
        }

        function findNearestGarlandSnap(points, worldX, worldY, maxScreenPx = 32) {
            let best = null;
            points.forEach(point => {
                const distScreen = Math.hypot(point.x - worldX, point.y - worldY) * scale;
                if(distScreen <= maxScreenPx && (!best || distScreen < best.distScreen)) {
                    best = { ...point, distScreen };
                }
            });
            return best;
        }

        function updateGarlandToolUI() {
            const postBtn = document.getElementById('btn-add-garland-post');
            const linkBtn = document.getElementById('btn-link-garland');
            const toolbarPostBtn = document.getElementById('btn-garland-post-tool');
            const toolbarLinkBtn = document.getElementById('btn-garland-link-tool');
            const hint = document.getElementById('garland-tool-hint');
            if(postBtn) postBtn.classList.toggle('active', garlandToolMode === 'post');
            if(linkBtn) linkBtn.classList.toggle('active', garlandToolMode === 'link');
            if(toolbarPostBtn) toolbarPostBtn.classList.toggle('active', garlandToolMode === 'post');
            if(toolbarLinkBtn) toolbarLinkBtn.classList.toggle('active', garlandToolMode === 'link');
            if(hint) {
                if(garlandToolMode === 'post') {
                    hint.textContent = selected2dJardiniere
                        ? '1. Cliquez un angle arrière de cette jardinière. Ensuite choisissez où accrocher la guirlande.'
                        : '1. Cliquez un angle arrière. Sélectionnez une jardinière pour limiter la pose.';
                } else if(garlandToolMode === 'link') {
                    const compatibleCount = pendingGarlandLinkFrom
                        ? jardinières.reduce((count, j) => count + getGarlandAnchors(j).filter(anchor => !(j === pendingGarlandLinkFrom.j && anchor.id === pendingGarlandLinkFrom.anchorId)).length, 0)
                        : jardinières.reduce((count, j) => count + getGarlandAnchors(j).length, 0);
                    hint.textContent = pendingGarlandLinkFrom
                        ? (compatibleCount > 0
                            ? '2. Cliquez le point d’arrivée : haut de treillis ou autre piquet.'
                            : 'Ajoutez un autre piquet ou un treillis pour créer une arrivée.')
                        : '1. Cliquez le point de départ : piquet ou haut de treillis.';
                } else {
                    hint.textContent = 'Posez un piquet, puis cliquez le point où accrocher la guirlande.';
                }
            }
            updateGarlandSnapMarkers3D();
        }

        function clearGarlandSnapMarkers3D() {
            if(!garlandSnapMarkerGroup) return;
            while(garlandSnapMarkerGroup.children.length) {
                const child = garlandSnapMarkerGroup.children.pop();
                if(child.geometry) child.geometry.dispose();
                if(child.material) child.material.dispose();
            }
        }

        function updateGarlandSnapMarkers3D() {
            clearGarlandSnapMarkers3D();
            if(!garlandToolMode || !scene || !garlandSnapMarkerGroup) return;
            const geo = new THREE.SphereGeometry(0.16, 14, 14);
            const postMat = new THREE.MeshStandardMaterial({ color: 0xb89b72, roughness: 0.82, metalness: 0.05, transparent: true, opacity: 0.72 });
            const trellisMat = new THREE.MeshStandardMaterial({ color: 0xffc864, roughness: 0.78, metalness: 0.02, transparent: true, opacity: 0.72 });
            if(garlandToolMode === 'post') {
                const source = selected2dJardiniere ? [selected2dJardiniere] : jardinières;
                source.forEach(j => {
                    const metrics = computeJardiniereConstructionMetrics(j);
                    const y = metrics.postHeight + 0.25;
                    [
                        { x: -j.w / 2 + 0.35, z: -j.d / 2 + 0.35 },
                        { x: j.w / 2 - 0.35, z: -j.d / 2 + 0.35 }
                    ].forEach(point => {
                        j.group.updateWorldMatrix(true, true);
                        const marker = new THREE.Mesh(geo.clone(), postMat.clone());
                        const pos = new THREE.Vector3(point.x, y, point.z);
                        j.group.localToWorld(pos);
                        marker.position.copy(pos);
                        marker.renderOrder = 999;
                        garlandSnapMarkerGroup.add(marker);
                    });
                });
            } else if(garlandToolMode === 'link') {
                jardinières.forEach(j => {
                    getGarlandAnchors(j).forEach(anchor => {
                        const isPending = pendingGarlandLinkFrom && pendingGarlandLinkFrom.j === j && pendingGarlandLinkFrom.anchorId === anchor.id;
                        j.group.updateWorldMatrix(true, true);
                        const marker = new THREE.Mesh(geo.clone(), (anchor.kind === 'trellis' ? trellisMat : postMat).clone());
                        const pos = new THREE.Vector3(anchor.x, anchor.y, anchor.z);
                        j.group.localToWorld(pos);
                        marker.position.copy(pos);
                        marker.scale.setScalar(isPending ? 1.35 : 1);
                        marker.renderOrder = 999;
                        garlandSnapMarkerGroup.add(marker);
                    });
                });
            }
        }

        function clearGarlandToolMode(options = {}) {
            const { redraw = false } = options;
            garlandToolMode = null;
            pendingGarlandLinkFrom = null;
            updateGarlandToolUI();
            if(redraw) draw2D();
        }

        function startGarlandPostPlacement() {
            if(activeMainView === '3d') {
                // La pose fonctionne aussi en 3D, on garde la vue courante.
            }
            if(currentEditorMode !== 'balcon' && currentEditorMode !== 'jardinieres') switchEditor('balcon');
            isDrawingToolActive = false;
            currentPoint = null;
            currentCeilingPoints = [];
            garlandToolMode = garlandToolMode === 'post' ? null : 'post';
            pendingGarlandLinkFrom = null;
            updateGarlandToolUI();
            if(canvas2d) canvas2d.style.cursor = 'default';
            draw2D();
        }

        function startGarlandLinkPlacement() {
            if(currentEditorMode !== 'balcon' && currentEditorMode !== 'jardinieres') switchEditor('balcon');
            isDrawingToolActive = false;
            currentPoint = null;
            currentCeilingPoints = [];
            garlandToolMode = garlandToolMode === 'link' ? null : 'link';
            pendingGarlandLinkFrom = null;
            updateGarlandToolUI();
            if(canvas2d) canvas2d.style.cursor = 'default';
            draw2D();
        }

        function cleanupGarlandLinksForJardiniere(j) {
            jardinières.forEach(owner => {
                owner.garlandLinks = normalizeGarlandLinks(owner.garlandLinks).filter(link => {
                    const from = getGarlandLinkEndpoint(link, 'from', owner);
                    const to = getGarlandLinkEndpoint(link, 'to', owner);
                    return !!(from && to);
                });
            });
        }

        function getCrossGarlandOwnersAffectedBy(movedJard) {
            const affected = new Set();
            if(!movedJard) return affected;
            jardinières.forEach(owner => {
                normalizeGarlandLinks(owner.garlandLinks).forEach(link => {
                    const from = getGarlandLinkEndpoint(link, 'from', owner);
                    const to = getGarlandLinkEndpoint(link, 'to', owner);
                    if(!from || !to || from.j === to.j) return;
                    if(owner === movedJard || from.j === movedJard || to.j === movedJard) {
                        affected.add(owner);
                    }
                });
            });
            return affected;
        }

        function scheduleLiveGarlandRebuild(movedJard) {
            const affected = getCrossGarlandOwnersAffectedBy(movedJard);
            if(affected.size <= 0) return;
            affected.forEach(j => liveGarlandRebuildPending.add(j));
            if(liveGarlandRebuildFrame) return;
            liveGarlandRebuildFrame = requestAnimationFrame(() => {
                liveGarlandRebuildFrame = null;
                const pending = Array.from(liveGarlandRebuildPending);
                liveGarlandRebuildPending.clear();
                pending.forEach(j => {
                    if(jardinières.includes(j)) rebuildJardiniere(j);
                });
            });
        }

        function placeGarlandPostAtSnap(snap) {
            if(!snap || !snap.j) return false;
            saveState();
            const j = snap.j;
            j.garlandPosts = normalizeGarlandPosts(j.garlandPosts);
            let post = j.garlandPosts.find(existing => existing.corner === snap.corner);
            if(!post) {
                post = {
                    id: `gp-${snap.corner}-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
                    corner: snap.corner
                };
                j.garlandPosts.push(post);
            }
            cleanupGarlandLinksForJardiniere(j);
            selectJardiniere(j, { openEditor: true, redraw: false });
            rebuildJardiniere(j);
            garlandToolMode = 'link';
            pendingGarlandLinkFrom = { j, anchorId: `post:${post.id}` };
            updateJardPanel();
            updateGarlandToolUI();
            draw2D();
            return true;
        }

        function addGarlandLinkBetweenAnchors(fromRef, toRef) {
            if(!fromRef || !toRef || !fromRef.j || !toRef.j) return false;
            if(fromRef.j === toRef.j && fromRef.anchorId === toRef.anchorId) return false;
            saveState();
            const owner = fromRef.j;
            owner.garlandLinks = normalizeGarlandLinks(owner.garlandLinks);
            const nextLink = {
                from: fromRef.anchorId,
                to: toRef.anchorId,
                fromJardId: fromRef.j.id,
                toJardId: toRef.j.id
            };
            const sameEndpoint = (link, a, b) => {
                const linkFromJ = link.fromJardId || owner.id;
                const linkToJ = link.toJardId || owner.id;
                return link.from === a.anchorId && link.to === b.anchorId && linkFromJ === a.j.id && linkToJ === b.j.id;
            };
            const exists = owner.garlandLinks.some(link => sameEndpoint(link, fromRef, toRef) || sameEndpoint(link, toRef, fromRef));
            if(!exists) owner.garlandLinks.push(nextLink);
            rebuildJardiniere(owner);
            if(toRef.j !== owner) rebuildJardiniere(toRef.j);
            updateJardPanel();
            draw2D();
            return true;
        }

        function handleGarlandLinkSnap(snap) {
            if(!snap || !snap.j || !snap.anchor) return false;
            if(!pendingGarlandLinkFrom) {
                if(selected2dJardiniere !== snap.j) selectJardiniere(snap.j, { openEditor: true, redraw: false });
                pendingGarlandLinkFrom = { j: snap.j, anchorId: snap.anchor.id };
                updateGarlandToolUI();
                draw2D();
                return true;
            }
            const fromRef = getGarlandAnchorRef(pendingGarlandLinkFrom.j, pendingGarlandLinkFrom.anchorId);
            const toRef = getGarlandAnchorRef(snap.j, snap.anchor.id);
            if(fromRef && toRef && (fromRef.j !== toRef.j || fromRef.anchorId !== toRef.anchorId)) {
                addGarlandLinkBetweenAnchors(fromRef, toRef);
                if(selected2dJardiniere !== fromRef.j) selectJardiniere(fromRef.j, { openEditor: true, redraw: false });
            }
            pendingGarlandLinkFrom = null;
            updateGarlandToolUI();
            draw2D();
            return true;
        }

        function handleGarlandToolCanvasClick(e, worldX, worldY) {
            if(!garlandToolMode) return false;
            e.preventDefault();
            e.stopPropagation();
            if(garlandToolMode === 'post') {
                const snap = findNearestGarlandSnap(getGarlandPostSnapPoints2D(), worldX, worldY);
                return snap ? placeGarlandPostAtSnap(snap) : true;
            }
            if(garlandToolMode === 'link') {
                const allAnchors = jardinières.flatMap(j => getGarlandLinkSnapPoints2D(j));
                const snap = findNearestGarlandSnap(allAnchors, worldX, worldY);
                return snap ? handleGarlandLinkSnap(snap) : true;
            }
            return false;
        }

        function findGarlandToolSnapAt(worldX, worldY) {
            if(!garlandToolMode) return null;
            if(garlandToolMode === 'post') {
                return findNearestGarlandSnap(getGarlandPostSnapPoints2D(), worldX, worldY);
            }
            if(garlandToolMode === 'link') {
                return findNearestGarlandSnap(jardinières.flatMap(j => getGarlandLinkSnapPoints2D(j)), worldX, worldY);
            }
            return null;
        }

        function projectJardLocalPointToScreen(j, x, y, z) {
            if(!renderer || !camera || !j || !j.group) return null;
            j.group.updateWorldMatrix(true, true);
            const vector = new THREE.Vector3(x, y, z);
            j.group.localToWorld(vector);
            vector.project(camera);
            if(vector.z < -1 || vector.z > 1) return null;
            const rect = renderer.domElement.getBoundingClientRect();
            return {
                x: rect.left + (vector.x + 1) * rect.width * 0.5,
                y: rect.top + (-vector.y + 1) * rect.height * 0.5
            };
        }

        function findNearestGarlandSnap3D(clientX, clientY, maxPx = 38) {
            if(!garlandToolMode) return null;
            const points = [];
            if(garlandToolMode === 'post') {
                jardinières.forEach(j => {
                    const metrics = computeJardiniereConstructionMetrics(j);
                    const y = metrics.postHeight + 0.25;
                    [
                        { corner: 'backLeft', x: -j.w / 2 + 0.35, z: -j.d / 2 + 0.35, label: 'Arr. gauche' },
                        { corner: 'backRight', x: j.w / 2 - 0.35, z: -j.d / 2 + 0.35, label: 'Arr. droit' }
                    ].forEach(point => {
                        const screen = projectJardLocalPointToScreen(j, point.x, y, point.z);
                        if(screen) points.push({ ...point, type: 'post', j, screen });
                    });
                });
            } else if(garlandToolMode === 'link') {
                jardinières.forEach(j => {
                    getGarlandAnchors(j).forEach(anchor => {
                        const screen = projectJardLocalPointToScreen(j, anchor.x, anchor.y, anchor.z);
                        if(screen) points.push({ type: 'anchor', j, anchor, label: anchor.label, screen });
                    });
                });
            }

            let best = null;
            points.forEach(point => {
                const dist = Math.hypot(point.screen.x - clientX, point.screen.y - clientY);
                if(dist <= maxPx && (!best || dist < best.dist)) best = { ...point, dist };
            });
            return best;
        }

        function handleGarlandTool3DClick(e) {
            if(!garlandToolMode) return false;
            const snap = findNearestGarlandSnap3D(e.clientX, e.clientY);
            if(!snap) return true;
            e.preventDefault();
            e.stopPropagation();
            if(garlandToolMode === 'post') return placeGarlandPostAtSnap(snap);
            if(garlandToolMode === 'link') return handleGarlandLinkSnap(snap);
            return true;
        }

        window.removeGarlandLink2d = function(index) {
            if(!selected2dJardiniere) return;
            saveState();
            selected2dJardiniere.garlandLinks = normalizeGarlandLinks(selected2dJardiniere.garlandLinks);
            selected2dJardiniere.garlandLinks.splice(index, 1);
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        };

        window.removeGarlandPost2d = function(postId) {
            if(!selected2dJardiniere) return;
            saveState();
            selected2dJardiniere.garlandPosts = normalizeGarlandPosts(selected2dJardiniere.garlandPosts)
                .filter(post => post.id !== postId);
            cleanupGarlandLinksForJardiniere(selected2dJardiniere);
            jardinières.forEach(item => rebuildJardiniere(item));
            updateJardPanel();
            draw2D();
        };

        window.startGarlandLinkFromPost2d = function(postId) {
            if(!selected2dJardiniere) return;
            const anchorId = `post:${postId}`;
            const exists = getGarlandAnchors(selected2dJardiniere).some(anchor => anchor.id === anchorId);
            if(!exists) return;
            garlandToolMode = 'link';
            pendingGarlandLinkFrom = { j: selected2dJardiniere, anchorId };
            isDrawingToolActive = false;
            currentPoint = null;
            currentCeilingPoints = [];
            updateGarlandToolUI();
            draw2D();
        };

        function syncLegacyTreillisLights(j) {
            if(!j) return;
            j.treillisLights = hasTreillisSpots(j) || hasTreillisWhiteGarland(j) || hasTreillisGinguette(j);
        }

        function toggleTreillisSpots2d() {
            if(!selected2dJardiniere) return;
            saveState();
            selected2dJardiniere.treillisSpotLights = !hasTreillisSpots(selected2dJardiniere);
            syncLegacyTreillisLights(selected2dJardiniere);
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function toggleTreillisWhiteGarland2d() {
            if(!selected2dJardiniere) return;
            saveState();
            const next = !hasTreillisWhiteGarland(selected2dJardiniere);
            selected2dJardiniere.treillisWhiteGarland = next;
            if(next) selected2dJardiniere.treillisGinguette = false;
            syncLegacyTreillisLights(selected2dJardiniere);
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function toggleTreillisGinguette2d() {
            if(!selected2dJardiniere) return;
            saveState();
            const next = !hasTreillisGinguette(selected2dJardiniere);
            selected2dJardiniere.treillisGinguette = next;
            if(next) selected2dJardiniere.treillisWhiteGarland = false;
            syncLegacyTreillisLights(selected2dJardiniere);
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function toggleBirdhouse2d() {
            if(!selected2dJardiniere) return;
            saveState();
            selected2dJardiniere.birdhouse = !selected2dJardiniere.birdhouse;
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function setJardLayerView(j, layerView) {
            if(!j) return;
            j.layerView = normalizeLayerView(layerView);
            j.showGeotextile = true;
            j.showEpdm = LAYER_VIEW_STEPS.indexOf(j.layerView) >= LAYER_VIEW_STEPS.indexOf('epdm');
            j.showGravel = LAYER_VIEW_STEPS.indexOf(j.layerView) >= LAYER_VIEW_STEPS.indexOf('gravel');
            j.showSoil = LAYER_VIEW_STEPS.indexOf(j.layerView) >= LAYER_VIEW_STEPS.indexOf('soil');
            j.showMulch = LAYER_VIEW_STEPS.indexOf(j.layerView) >= LAYER_VIEW_STEPS.indexOf('mulch');
        }

        function stepJardLayerView(direction) {
            if(!selected2dJardiniere) return;
            saveState();
            const current = normalizeLayerView(selected2dJardiniere.layerView);
            const index = LAYER_VIEW_STEPS.indexOf(current);
            const nextIndex = Math.max(0, Math.min(LAYER_VIEW_STEPS.length - 1, index + direction));
            setJardLayerView(selected2dJardiniere, LAYER_VIEW_STEPS[nextIndex]);
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function update2dTreillisHeight(value, commit = true) {
            if(!selected2dJardiniere) return;
            prepareLiveJardSliderEdit(commit);
            const j = selected2dJardiniere;
            const metrics = computeJardiniereConstructionMetrics(j);
            // UI en hauteur absolue depuis le sol, stockage interne en dépassement au-dessus du bac.
            const requestedFromGround = parseFloat(value) || ((j.treillisH || 13) + metrics.postHeight);
            const relativeTreillis = requestedFromGround - metrics.postHeight;
            j.treillisH = Math.max(window.manualDimensionEditActive ? 0.1 : 6, Math.min(22, relativeTreillis));
            refreshJardiniereAfterSlider(selected2dJardiniere, commit);
            const label = document.getElementById('jard-treillis-h-2d-val');
            if(label) label.textContent = formatCmMmFromDm(metrics.postHeight + j.treillisH);
            if(commit) updateJardPanel();
            draw2D();
        }

        function update2dTreillisType(value) {
            if(!selected2dJardiniere) return;
            saveState();
            selected2dJardiniere.treillisType = value || 'noisetier';
            rebuildJardiniere(selected2dJardiniere);
            updateJardPanel();
            draw2D();
        }

        function updateBenchControls() {
            const wrap = document.getElementById('bench-controls-2d');
            if(!wrap) return;
            wrap.style.display = selected2dBench ? 'block' : 'none';
            if(!selected2dBench) return;
            const b = selected2dBench;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const setChecked = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.checked = !!value;
            };
            const wCm = roundToOneDecimal(b.w * 10);
            const dCm = roundToOneDecimal(b.d * 10);
            const hCm = roundToOneDecimal(b.h * 10);
            setVal('bench-w-2d', wCm);
            setVal('bench-d-2d', dCm);
            setVal('bench-h-2d', hCm);
            const deg = Math.round((b.rot || 0) * 180 / Math.PI);
            setVal('bench-rot-2d', deg);
            setText('bench-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('bench-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('bench-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            setText('bench-rot-2d-val', deg + '°');
        }

        function updateCubePaletteUI(color) {
            setColorChip('cube-color-toggle-2d', color || '#b9793f');
            const palette = document.getElementById('cube-palette-2d');
            if(!palette) return;
            const normalized = document.createElement('span');
            normalized.style.color = color;
            document.body.appendChild(normalized);
            const selectedColor = getComputedStyle(normalized).color.toLowerCase();
            normalized.remove();
            palette.querySelectorAll('.wood-swatch').forEach(swatch => {
                const swatchColor = (swatch.style.backgroundColor || '').toLowerCase();
                swatch.classList.toggle('active', swatchColor === selectedColor);
            });
        }

        function updateCornerFillPaletteUI(color) {
            setColorChip('corner-fill-color-toggle-2d', color || '#6a4b38');
            const palette = document.getElementById('corner-fill-palette-2d');
            if(!palette) return;
            const normalized = document.createElement('span');
            normalized.style.color = color;
            document.body.appendChild(normalized);
            const selectedColor = getComputedStyle(normalized).color.toLowerCase();
            normalized.remove();
            palette.querySelectorAll('.wood-swatch').forEach(swatch => {
                const swatchColor = (swatch.style.backgroundColor || '').toLowerCase();
                swatch.classList.toggle('active', swatchColor === selectedColor);
            });
        }

        function updateCubeControls() {
            const wrap = document.getElementById('cube-controls-2d');
            if(!wrap) return;
            wrap.style.display = selected2dCube ? 'block' : 'none';
            if(!selected2dCube) return;
            const cube = selected2dCube;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(cube.w * 10);
            const dCm = roundToOneDecimal(cube.d * 10);
            const hCm = roundToOneDecimal(cube.h * 10);
            setVal('cube-w-2d', wCm);
            setVal('cube-d-2d', dCm);
            setVal('cube-h-2d', hCm);
            setText('cube-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('cube-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('cube-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            const input = document.getElementById('cube-color-2d');
            if(input) input.value = cube.color || '#b9793f';
            updateCubePaletteUI(cube.color || '#b9793f');
            const armBack = document.getElementById('meridienne-arm-back-2d');
            const armSide = document.getElementById('meridienne-arm-side-2d');
            const mattress = document.getElementById('meridienne-mattress-2d');
            const cushions = document.getElementById('meridienne-cushions-2d');
            const mattressColor = document.getElementById('meridienne-mattress-color-2d');
            const cushionColor = document.getElementById('meridienne-cushion-color-2d');
            if(armBack) armBack.checked = cube.armBack !== false;
            if(armSide) armSide.checked = cube.armSide !== false;
            if(mattress) mattress.checked = cube.mattress !== false;
            if(cushions) cushions.checked = cube.cushions !== false;
            if(mattressColor) mattressColor.value = cube.mattressColor || cube.fabricColor || '#d8d1bd';
            if(cushionColor) cushionColor.value = cube.cushionColor || '#c8bfa8';
        }

        function updateCornerFillControls() {
            const wrap = document.getElementById('corner-fill-controls-2d');
            if(!wrap) return;
            const selected = getSelectedPlacementObject();
            const fill = getPlacementType(selected) === 'cornerFill' ? selected : null;
            wrap.style.display = fill ? 'block' : 'none';
            if(!fill) return;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(fill.w * 10);
            const dCm = roundToOneDecimal(fill.d * 10);
            const hCm = roundToOneDecimal(fill.h * 10);
            const angleDeg = Math.round(typeof fill.angleDeg === 'number' ? fill.angleDeg : 75);
            const isAutoCorner = !!(fill.sourceCorner && fill.sourceCorner.corner && fill.sourceCorner.dirA && fill.sourceCorner.dirB);
            const autoWrap = document.getElementById('corner-fill-auto-controls-2d');
            if(autoWrap) autoWrap.style.display = isAutoCorner ? 'block' : 'none';
            ['corner-fill-manual-w-row', 'corner-fill-manual-d-row', 'corner-fill-manual-angle-row'].forEach(id => {
                const row = document.getElementById(id);
                if(row) row.style.display = isAutoCorner ? 'none' : 'flex';
            });
            if(isAutoCorner) {
                const model = typeof getCornerArrangementModel === 'function' ? getCornerArrangementModel(fill.sourceCorner.model) : null;
                const layout = typeof normalizeCornerArrangementLayout === 'function' ? normalizeCornerArrangementLayout(fill.sourceCorner) : fill.sourceCorner;
                setText('corner-fill-model-2d-val', model && model.title ? model.title : 'Aménagement angle');
                setChecked('corner-fill-enabled-a-2d', !layout || layout.enabledA !== false);
                setChecked('corner-fill-enabled-b-2d', !layout || layout.enabledB !== false);
                ['lenA', 'depthA', 'lenB', 'depthB'].forEach(key => {
                    const value = Math.round(layout && typeof layout[key] === 'number' ? layout[key] : 0);
                    const inputId = key === 'lenA' ? 'corner-fill-len-a-2d'
                        : (key === 'lenB' ? 'corner-fill-len-b-2d'
                        : (key === 'depthA' ? 'corner-fill-depth-a-2d' : 'corner-fill-depth-b-2d'));
                    const labelId = key === 'lenA' ? 'corner-fill-len-a-2d-val'
                        : (key === 'lenB' ? 'corner-fill-len-b-2d-val'
                        : (key === 'depthA' ? 'corner-fill-depth-a-2d-val' : 'corner-fill-depth-b-2d-val'));
                    setVal(inputId, value);
                    setText(labelId, value + ' cm');
                });
            }
            setVal('corner-fill-w-2d', wCm);
            setVal('corner-fill-d-2d', dCm);
            setVal('corner-fill-h-2d', hCm);
            setVal('corner-fill-angle-2d', angleDeg);
            setText('corner-fill-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('corner-fill-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('corner-fill-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            setText('corner-fill-angle-2d-val', angleDeg + '°');
            const input = document.getElementById('corner-fill-color-2d');
            if(input) input.value = fill.woodColor || '#6a4b38';
            updateCornerFillPaletteUI(fill.woodColor || '#6a4b38');
        }

        function updateCornerArrangementDimension2d(key, value, commit = true) {
            if(typeof updateSelectedCornerArrangementDimension !== 'function') return;
            const ok = updateSelectedCornerArrangementDimension(key, value, commit);
            if(ok) updateJardPanel();
        }

        function updatePottedTreeControls() {
            const wrap = document.getElementById('potted-tree-controls-2d');
            if(!wrap) return;
            wrap.style.display = selected2dPottedTree ? 'block' : 'none';
            if(!selected2dPottedTree) return;
            const tree = selected2dPottedTree;
            const diameterCm = roundToOneDecimal((tree.diameter || tree.w || 5) * 10);
            const ageYears = Math.max(1, Math.min(12, Math.round(tree.ageYears || 5)));
            const diameterInput = document.getElementById('tree-diameter-2d');
            const diameterLabel = document.getElementById('tree-diameter-2d-val');
            const ageInput = document.getElementById('tree-age-2d');
            const ageLabel = document.getElementById('tree-age-2d-val');
            const shapeSelect = document.getElementById('tree-shape-2d');
            if(diameterInput) diameterInput.value = diameterCm;
            if(diameterLabel) diameterLabel.textContent = String(diameterCm).replace('.', ',') + ' cm';
            if(ageInput) ageInput.value = ageYears;
            if(ageLabel) ageLabel.textContent = ageYears + ' ans';
            if(shapeSelect) shapeSelect.value = tree.shape === 'square' ? 'square' : 'round';
        }

        function updateCalculationControls() {
            const wrap = document.getElementById('calculation-controls-2d');
            const checkbox = document.getElementById('placement-include-quote-2d');
            const label = document.getElementById('placement-include-label-2d');
            if(!wrap || !checkbox) return;
            const selected = getSelectedPlacementObject();
            const type = getPlacementType(selected);
            wrap.style.display = selected ? 'block' : 'none';
            if(!selected) return;
            checkbox.checked = shouldIncludeConstructionInCalculations(selected, type);
            if(label) {
                const def = getConstructionType(type);
                label.textContent = `Inclure ${def && def.label ? def.label.toLowerCase() : 'objet'} dans devis/fabrication`;
            }
        }

        function updateTableControls() {
            const wrap = document.getElementById('table-controls-2d');
            if(!wrap) return;
            const selected = getSelectedPlacementObject();
            const table = getPlacementType(selected) === 'table' ? selected : null;
            wrap.style.display = table ? 'block' : 'none';
            if(!table) return;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(table.w * 10);
            const dCm = roundToOneDecimal(table.d * 10);
            const hCm = roundToOneDecimal(table.h * 10);
            const rotDeg = Math.round((table.rot || 0) * 180 / Math.PI);
            setVal('table-w-2d', wCm);
            setVal('table-d-2d', dCm);
            setVal('table-h-2d', hCm);
            setVal('table-rot-2d', rotDeg);
            setText('table-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('table-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('table-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            setText('table-rot-2d-val', rotDeg + '°');
        }

        function updateChairControls() {
            const wrap = document.getElementById('chair-controls-2d');
            if(!wrap) return;
            const selected = getSelectedPlacementObject();
            const chair = getPlacementType(selected) === 'chair' ? selected : null;
            wrap.style.display = chair ? 'block' : 'none';
            if(!chair) return;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(chair.w * 10);
            const dCm = roundToOneDecimal(chair.d * 10);
            const hCm = roundToOneDecimal(chair.h * 10);
            const rotDeg = Math.round((chair.rot || 0) * 180 / Math.PI);
            setVal('chair-w-2d', wCm);
            setVal('chair-d-2d', dCm);
            setVal('chair-h-2d', hCm);
            setVal('chair-rot-2d', rotDeg);
            setText('chair-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('chair-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('chair-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            setText('chair-rot-2d-val', rotDeg + '°');
        }

        function updateCompressionShelfControls() {
            const wrap = document.getElementById('compression-shelf-controls-2d');
            if(!wrap) return;
            const selected = getSelectedPlacementObject();
            const shelf = getPlacementType(selected) === 'compressionShelf' ? selected : null;
            wrap.style.display = shelf ? 'block' : 'none';
            if(!shelf) return;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(shelf.w * 10);
            const dCm = roundToOneDecimal((typeof shelf.boardWidth === 'number' ? shelf.boardWidth : shelf.d) * 10);
            const hCm = roundToOneDecimal(shelf.h * 10);
            const shelves = Math.max(2, Math.min(4, Math.round(shelf.shelfCount || 4)));
            const rotDeg = Math.round((shelf.rot || 0) * 180 / Math.PI);
            setVal('compression-shelf-w-2d', wCm);
            setVal('compression-shelf-d-2d', dCm);
            setVal('compression-shelf-h-2d', hCm);
            setVal('compression-shelf-count-2d', shelves);
            setVal('compression-shelf-rot-2d', rotDeg);
            setText('compression-shelf-w-2d-val', String(wCm).replace('.', ',') + ' cm');
            setText('compression-shelf-d-2d-val', String(dCm).replace('.', ',') + ' cm');
            setText('compression-shelf-h-2d-val', String(hCm).replace('.', ',') + ' cm');
            setText('compression-shelf-count-2d-val', shelves + ' tablettes');
            setText('compression-shelf-rot-2d-val', rotDeg + '°');
        }

        function updateRailMountedControls(type, idPrefix) {
            const wrap = document.getElementById(`${idPrefix}-controls-2d`);
            if(!wrap) return;
            const selected = getSelectedPlacementObject();
            const item = getPlacementType(selected) === type ? selected : null;
            wrap.style.display = item ? 'block' : 'none';
            if(!item) return;
            const setVal = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.value = value;
            };
            const setText = (id, value) => {
                const el = document.getElementById(id);
                if(el) el.textContent = value;
            };
            const wCm = roundToOneDecimal(item.w * 10);
            const dCm = roundToOneDecimal(item.d * 10);
            const hCm = roundToOneDecimal(item.h * 10);
            const rotDeg = Math.round((item.rot || 0) * 180 / Math.PI);
            setVal(`${idPrefix}-w-2d`, wCm);
            setVal(`${idPrefix}-d-2d`, dCm);
            setVal(`${idPrefix}-h-2d`, hCm);
            setVal(`${idPrefix}-rot-2d`, rotDeg);
            setVal(`${idPrefix}-bracket-2d`, item.bracketType === 'wood' ? 'wood' : 'steel');
            setText(`${idPrefix}-w-2d-val`, String(wCm).replace('.', ',') + ' cm');
            setText(`${idPrefix}-d-2d-val`, String(dCm).replace('.', ',') + ' cm');
            setText(`${idPrefix}-h-2d-val`, String(hCm).replace('.', ',') + ' cm');
            setText(`${idPrefix}-rot-2d-val`, rotDeg + '°');
        }

        function updateJardPanel() {
            const panel = document.getElementById('jard-panel-2d');
            panel.classList.toggle('visible', currentEditorMode === 'jardinieres');
            updateJardList();
            updateBenchControls();
            updatePottedTreeControls();
            updateCubeControls();
            updateCalculationControls();
            updateTableControls();
            updateChairControls();
            updateCornerFillControls();
            updateCompressionShelfControls();
            updateRailMountedControls('hangingPlanter', 'hanging-planter');
            updateRailMountedControls('railShelf', 'rail-shelf');
            const controlsWrap = document.getElementById('jard-controls-2d');
            const noSelectMsg = document.getElementById('jard-no-select');
            if(!selected2dJardiniere) {
                controlsWrap.style.display = 'none';
                noSelectMsg.style.display = getSelectedPlacementObject() ? 'none' : 'block';
                return;
            }

            controlsWrap.style.display = 'block';
            noSelectMsg.style.display = 'none';
            const j = selected2dJardiniere;
            const metrics = computeJardiniereConstructionMetrics(j);
            const woodInput = document.getElementById('wood-color-2d');
            if(woodInput) woodInput.value = j.woodColor || '#4a3228';
            updateWoodPaletteUI(j.woodColor || '#4a3228');
            const widthCm = Math.round(j.w * 10);
            const depthCm = Math.round(j.d * 10);
            const topHeightCm = Math.round(metrics.postHeight * 10);
            const cuveHeightCm = Math.round(metrics.cuveH * 10);
            const widthLabel = formatCmMmFromDm(j.w);
            const depthLabel = formatCmMmFromDm(j.d);
            const topHeightLabel = formatCmMmFromDm(metrics.postHeight);
            const cuveHeightLabel = formatCmMmFromDm(metrics.cuveH);
            const minLegCm = 0;
            const maxLegCm = 120;
            document.getElementById('jard-w-2d').value = widthCm;
            document.getElementById('jard-d-2d').value = depthCm;
            const cuveSlider = document.getElementById('jard-cuve-h-2d');
            const minCuveTarget = metrics.construction.boardWidth;
            const cuveStep = metrics.construction.boardWidth + getCuveBoardGap(metrics.construction);
            const maxCuveTarget = minCuveTarget + Math.floor((8 - minCuveTarget) / cuveStep) * cuveStep;
            const snappedTargetCuveDm = snapCuveTargetHeight(metrics.construction, metrics.construction.cuveTargetH);
            if(Math.abs(metrics.construction.cuveTargetH - snappedTargetCuveDm) > 0.0001) {
                metrics.construction.cuveTargetH = snappedTargetCuveDm;
            }
            cuveSlider.min = roundToOneDecimal(minCuveTarget * 10);
            cuveSlider.max = roundToOneDecimal(maxCuveTarget * 10);
            cuveSlider.step = roundToOneDecimal(cuveStep * 10);
            cuveSlider.value = roundToOneDecimal(snappedTargetCuveDm * 10);
            const targetCuveCm = roundToOneDecimal(snappedTargetCuveDm * 10);
            const targetCuveLabel = formatCmMmFromDm(snappedTargetCuveDm);
            const topMinCm = Math.max(cuveHeightCm + minLegCm, targetCuveCm);
            const topMaxCm = cuveHeightCm + maxLegCm;
            const topSlider = document.getElementById('jard-top-h-2d');
            topSlider.min = topMinCm;
            topSlider.max = topMaxCm;
            topSlider.value = Math.max(topMinCm, Math.min(topMaxCm, topHeightCm));
            document.getElementById('jard-w-2d-val').textContent = widthLabel;
            document.getElementById('jard-d-2d-val').textContent = depthLabel;
            document.getElementById('jard-cuve-h-2d-val').textContent = targetCuveLabel;
            document.getElementById('jard-top-h-2d-val').textContent = topHeightLabel;
            const hasBack = j.treillisBack !== undefined ? j.treillisBack : j.hasTreillis;
            document.getElementById('btn-trl-back').classList.toggle('active', !!hasBack);
            document.getElementById('btn-trl-left').classList.toggle('active', !!j.treillisLeft);
            document.getElementById('btn-trl-right').classList.toggle('active', !!j.treillisRight);
            const treillisSlider = document.getElementById('jard-treillis-h-2d');
            const treillisMinCm = Math.round((metrics.postHeight + 6) * 10);
            const treillisMaxCm = Math.round((metrics.postHeight + 22) * 10);
            const treillisFromGroundDm = metrics.postHeight + (j.treillisH || 13);
            const treillisFromGroundCm = Math.round(treillisFromGroundDm * 10);
            treillisSlider.min = treillisMinCm;
            treillisSlider.max = treillisMaxCm;
            treillisSlider.value = Math.max(treillisMinCm, Math.min(treillisMaxCm, treillisFromGroundCm));
            document.getElementById('jard-treillis-h-2d-val').textContent = formatCmMmFromDm(treillisFromGroundDm);
            document.getElementById('jard-treillis-type-2d').value = j.treillisType || 'noisetier';
            document.getElementById('btn-trl-spots').classList.toggle('active', hasTreillisSpots(j));
            document.getElementById('btn-trl-white-garland').classList.toggle('active', hasTreillisWhiteGarland(j));
            document.getElementById('btn-trl-ginguette').classList.toggle('active', hasTreillisGinguette(j));
            j.garlandPosts = normalizeGarlandPosts(j.garlandPosts);
            renderGarlandLinkControls(j, metrics);
            updateGarlandToolUI();
            document.getElementById('btn-birdhouse').classList.toggle('active', !!j.birdhouse);
            const layerLabel = document.getElementById('jard-layer-view-label');
            if(layerLabel) layerLabel.textContent = getLayerViewLabel(j.layerView);

            // Liste des plantes
            const plantsList = document.getElementById('jard-plants-list-2d');
            if(plantsList) {
                if(!j.plants || j.plants.length === 0) {
                    plantsList.innerHTML = '<div class="plants-empty">Aucune plante</div>';
                } else {
                    plantsList.innerHTML = j.plants.map((p, idx) => `
                        <div class="plants-row">
                            <span>${p.type}</span>
                            <span onclick="removePlantFrom2dJard(${idx})" class="plant-remove">×</span>
                        </div>`).join('');
                }
            }
        }

        function renderGarlandLinkControls(j, metrics = null) {
            const list = document.getElementById('garland-links-list-2d');
            if(!list) return;

            j.garlandLinks = normalizeGarlandLinks(j.garlandLinks).filter(link => {
                const from = getGarlandLinkEndpoint(link, 'from', j);
                const to = getGarlandLinkEndpoint(link, 'to', j);
                return !!(from && to);
            });

            const posts = normalizeGarlandPosts(j.garlandPosts);
            const rows = [];
            posts.forEach(post => {
                const label = post.corner === 'backLeft' ? 'Piquet arr. gauche' : 'Piquet arr. droit';
                rows.push(`
                    <div class="plants-row">
                        <span>${label}</span>
                        <span class="plants-row-actions">
                            <button class="plant-inline-btn" onclick="startGarlandLinkFromPost2d('${post.id}')">Relier</button>
                            <span onclick="removeGarlandPost2d('${post.id}')" class="plant-remove">×</span>
                        </span>
                    </div>
                `);
            });
            j.garlandLinks.forEach((link, index) => {
                const from = getGarlandLinkEndpoint(link, 'from', j);
                const to = getGarlandLinkEndpoint(link, 'to', j);
                if(!from || !to) return;
                rows.push(`
                    <div class="plants-row">
                        <span>${getJardiniereLabel(from.j)} ${from.anchor.label} → ${getJardiniereLabel(to.j)} ${to.anchor.label}</span>
                        <span onclick="removeGarlandLink2d(${index})" class="plant-remove">×</span>
                    </div>
                `);
            });

            if(!rows.length) {
                list.innerHTML = '<div class="plants-empty">Aucun piquet ni liaison</div>';
                return;
            }
            list.innerHTML = rows.join('');
        }

        function updateJardList() {
            const listDiv = document.getElementById('jard-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            jardinières.forEach((j, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if (selected2dJardiniere === j) btn.classList.add('active');
                btn.textContent = 'Jardinière ' + (idx + 1);
                btn.onclick = () => {
                    selectJardiniere(j);
                };
                listDiv.appendChild(btn);
            });
            updateBenchList();
            updatePottedTreeList();
            updateCubeList();
            updateTableList();
            updateChairList();
            updateCornerFillList();
            updateCompressionShelfList();
        }

        function updateBenchList() {
            const listDiv = document.getElementById('bench-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!bancs.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucun banc</div>';
                return;
            }
            bancs.forEach((bench, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(selected2dBench === bench) btn.classList.add('active');
                btn.textContent = 'Banc ' + (idx + 1);
                btn.onclick = () => selectBench(bench);
                listDiv.appendChild(btn);
            });
        }

        function updatePottedTreeList() {
            const listDiv = document.getElementById('potted-tree-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!pottedTrees.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucun arbre</div>';
                return;
            }
            pottedTrees.forEach((tree, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(selected2dPottedTree === tree) btn.classList.add('active');
                btn.textContent = 'Arbre en pot ' + (idx + 1);
                btn.onclick = () => selectPottedTree(tree);
                listDiv.appendChild(btn);
            });
        }

        function updateCubeList() {
            const listDiv = document.getElementById('cube-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!cubes.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucune méridienne</div>';
                return;
            }
            cubes.forEach((cube, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(selected2dCube === cube) btn.classList.add('active');
                btn.textContent = 'Méridienne ' + (idx + 1);
                btn.onclick = () => selectCube(cube);
                listDiv.appendChild(btn);
            });
        }

        function updateTableList() {
            const listDiv = document.getElementById('table-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!tables.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucune table</div>';
                return;
            }
            tables.forEach((table, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(getSelectedPlacementObject() === table) btn.classList.add('active');
                btn.textContent = 'Table ' + (idx + 1) + (shouldIncludeConstructionInCalculations(table, 'table') ? '' : ' · déco');
                btn.onclick = () => selectPlacementObject(table);
                listDiv.appendChild(btn);
            });
        }

        function updateChairList() {
            const listDiv = document.getElementById('chair-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!chairs.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucune chaise</div>';
                return;
            }
            chairs.forEach((chair, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(getSelectedPlacementObject() === chair) btn.classList.add('active');
                btn.textContent = 'Chaise ' + (idx + 1) + (shouldIncludeConstructionInCalculations(chair, 'chair') ? '' : ' · déco');
                btn.onclick = () => selectPlacementObject(chair);
                listDiv.appendChild(btn);
            });
        }

        function updateCornerFillList() {
            const listDiv = document.getElementById('corner-fill-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!cornerFills.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucun comble-angle</div>';
                return;
            }
            cornerFills.forEach((fill, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(getSelectedPlacementObject() === fill) btn.classList.add('active');
                const label = fill.purpose === 'planter'
                    ? 'Jardinière d’angle'
                    : (fill.faceStyle === 'rounded' ? 'Angle arrondi' : (fill.purpose === 'seat' ? 'Méridienne d’angle' : 'Comble-angle'));
                btn.textContent = label + ' ' + (idx + 1) + (shouldIncludeConstructionInCalculations(fill, 'cornerFill') ? '' : ' · déco');
                btn.onclick = () => selectPlacementObject(fill);
                listDiv.appendChild(btn);
            });
        }

        function updateCompressionShelfList() {
            const listDiv = document.getElementById('compression-shelf-list-2d');
            if(!listDiv) return;
            listDiv.innerHTML = '';
            if(!compressionShelves.length) {
                listDiv.innerHTML = '<div class="plants-empty">Aucune étagère</div>';
                return;
            }
            compressionShelves.forEach((shelf, idx) => {
                const btn = document.createElement('button');
                btn.className = 'jp-btn';
                if(getSelectedPlacementObject() === shelf) btn.classList.add('active');
                btn.textContent = 'Étagère claustra ' + (idx + 1) + (shouldIncludeConstructionInCalculations(shelf, 'compressionShelf') ? '' : ' · déco');
                btn.onclick = () => selectPlacementObject(shelf);
                listDiv.appendChild(btn);
            });
        }

        // --- GESTION JARDINIERES ET PLANTES ---
        function getDefaultJardiniereStartPosition() {
            return { x: 0, z: 2.5 };
        }

        function addNewJardiniere(options = {}) {
            const { selectNew = false, updatePanel = true, x = null, z = null } = options;
            if(jardinières.length >= MAX_JARDINIERES) {
                alert('Limite atteinte: maximum ' + MAX_JARDINIERES + ' jardinieres.');
                return null;
            }
            const id = options.id || makeUniquePlacementId('jardiniere');
            const idx = jardinières.length;
            const startPos = idx === 0 ? getDefaultJardiniereStartPosition() : null;
            const newJard = {
                constructionType: 'jardiniere',
                id, w: 14, d: 5, legH: 2.5, woodColor: '#4a3228',
                construction: getDefaultConstructionSettings(),
                includeInQuote: options.includeInQuote !== undefined ? !!options.includeInQuote : getDefaultConstructionInclusion('jardiniere'),
                treillisBack: true, treillisLeft: true, treillisRight: true,
                hasTreillis: true, treillisH: 13, treillisType: 'noisetier',
                treillisLights: true,
                treillisSpotLights: true,
                treillisWhiteGarland: true,
                treillisGinguette: false,
                garlandPosts: normalizeGarlandPosts(),
                garlandLinks: [],
                birdhouse: true,
                layerView: 'mulch',
                showSoil: true,
                showGeotextile: true,
                showEpdm: true,
                showGravel: true,
                showMulch: true,
                _birdhouseInit: true,
                pos: new THREE.Vector3(x === null ? (startPos ? startPos.x : idx * 4) : x, 0, z === null ? (startPos ? startPos.z : 0) : z), rot: 0,
                group: new THREE.Group(), plants: []
            };
            setJardLayerView(newJard, newJard.layerView);
            newJard.plants = createDefaultPlantsForJardiniere(newJard);
            snapJardiniereToGrid(newJard);
            jardinières.push(newJard);
            const created = jardinières[jardinières.length-1];
            if(jardinières.length === OPTIMIZED_LIGHTING_JARDINIERE_COUNT) {
                jardinières.forEach(item => rebuildJardiniere(item));
            } else {
                rebuildJardiniere(created);
            }
            if(updatePanel) updateJardPanel();
            if(selectNew) selectJardiniere(created);
            if(options.magicEffect && typeof triggerMagicDustForPlacement === 'function') {
                triggerMagicDustForPlacement(created, { intensity: options.magicEffect });
            }
            return created;
        }

        constructionTypes.jardiniere = {
            label: 'Jardinière',
            getItems: () => jardinières,
            create: addNewJardiniere,
            rebuild: (...args) => rebuildJardiniere(...args),
            resizeLimits: JARD_RESIZE_LIMITS,
            collectCutGroups: (items) => collectCutPiecesAllJardinieres(items)
        };
