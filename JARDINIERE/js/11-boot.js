        function registerPwaServiceWorker() {
            if(!('serviceWorker' in navigator)) return;
            const isLocalDev = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
            if(isLocalDev && !location.search.includes('pwa=1')) {
                navigator.serviceWorker.getRegistrations()
                    .then((registrations) => registrations.forEach((registration) => {
                        if(registration.scope.includes('/JARDINIERE/')) registration.unregister();
                    }))
                    .catch((error) => {
                        console.warn('Service worker local non desactive', error);
                    });
                return;
            }
            const canRegister = location.protocol === 'https:';
            if(!canRegister) return;
            navigator.serviceWorker.register('./service-worker.js')
                .then((registration) => {
                    setupPwaUpdateRegistration(registration);
                })
                .catch((error) => {
                    console.warn('Service worker non enregistre', error);
                });
        }

        function setupPwaUpdateRegistration(registration) {
            if(!registration) return;
            if(registration.waiting && navigator.serviceWorker.controller) {
                showPwaUpdatePrompt(registration);
            }

            registration.addEventListener('updatefound', () => {
                const installingWorker = registration.installing;
                if(!installingWorker) return;
                installingWorker.addEventListener('statechange', () => {
                    if(installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                        showPwaUpdatePrompt(registration);
                    }
                });
            });

            navigator.serviceWorker.addEventListener('controllerchange', () => {
                if(!pwaReloadAfterUpdate) return;
                pwaReloadAfterUpdate = false;
                appAllowsPageUnload = true;
                window.location.replace(location.href);
            });
        }

        function showPwaUpdatePrompt(registration) {
            if(!registration || !registration.waiting) return;
            if(pwaUpdatePromptShownFor === registration.waiting) return;
            pwaUpdateRegistration = registration;
            pwaUpdatePromptShownFor = registration.waiting;
            pwaUpdatePromptOpen = true;
            const dialog = document.getElementById('pwa-update-dialog');
            if(dialog) {
                dialog.classList.add('visible');
                dialog.setAttribute('aria-hidden', 'false');
            }
        }

        function dismissPwaUpdatePrompt() {
            pwaUpdatePromptOpen = false;
            const dialog = document.getElementById('pwa-update-dialog');
            if(dialog) {
                dialog.classList.remove('visible');
                dialog.setAttribute('aria-hidden', 'true');
            }
        }

        async function saveProjectAndApplyPwaUpdate() {
            try {
                await saveProjectToFile();
                applyPendingPwaUpdate();
            } catch (error) {
                console.warn('Enregistrement avant mise a jour impossible', error);
                alert('Enregistrement impossible. La mise a jour est annulee pour eviter une perte de projet.');
            }
        }

        function applyPwaUpdateWithoutSaving() {
            applyPendingPwaUpdate();
        }

        function applyPendingPwaUpdate() {
            const waitingWorker = pwaUpdateRegistration && pwaUpdateRegistration.waiting;
            if(!waitingWorker) {
                dismissPwaUpdatePrompt();
                return;
            }
            dismissPwaUpdatePrompt();
            pwaReloadAfterUpdate = true;
            appAllowsPageUnload = true;
            waitingWorker.postMessage({ type: 'SKIP_WAITING' });
            window.setTimeout(() => {
                if(!pwaReloadAfterUpdate) return;
                pwaReloadAfterUpdate = false;
                window.location.replace(location.href);
            }, 1800);
        }

        const MOBILE_STARTUP_PROMPT_KEY = 'jardiniere-mobile-startup-prompt-shown';

        function isMobileStartupDevice() {
            const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
            const touchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
            return (coarsePointer || touchDevice) && Math.min(window.innerWidth || 0, window.innerHeight || 0) <= 820;
        }

        function shouldSuggestMobileStartupComfort() {
            if(!isMobileStartupDevice()) return false;
            const portrait = (window.innerHeight || 0) > (window.innerWidth || 0);
            return activeMainView !== '2d' || portrait;
        }

        function hasShownMobileStartupPrompt() {
            try {
                return window.sessionStorage && sessionStorage.getItem(MOBILE_STARTUP_PROMPT_KEY) === '1';
            } catch(_) {
                return false;
            }
        }

        function markMobileStartupPromptShown() {
            try {
                if(window.sessionStorage) sessionStorage.setItem(MOBILE_STARTUP_PROMPT_KEY, '1');
            } catch(_) {}
        }

        function setMobileStartupPromptVisible(visible) {
            const dialog = document.getElementById('mobile-startup-dialog');
            if(!dialog) return;
            dialog.classList.toggle('visible', !!visible);
            dialog.setAttribute('aria-hidden', visible ? 'false' : 'true');
        }

        function promptDeviceContextAfterMobileChoice() {
            if(typeof maybeShowDeviceContextPrompt === 'function') {
                window.setTimeout(maybeShowDeviceContextPrompt, 250);
            }
        }

        function maybeShowMobileStartupPrompt() {
            if(hasShownMobileStartupPrompt() || !shouldSuggestMobileStartupComfort()) return false;
            markMobileStartupPromptShown();
            setMobileStartupPromptVisible(true);
            return true;
        }

        function dismissMobileStartupPrompt() {
            setMobileStartupPromptVisible(false);
            promptDeviceContextAfterMobileChoice();
        }

        function useMobileStartup2D() {
            setMobileStartupPromptVisible(false);
            if(typeof setMainView === 'function') setMainView('2d', { skipValidation: true });
            promptDeviceContextAfterMobileChoice();
        }

        window.onload = () => {
            init();
            if(typeof initEditableDimensionValues === 'function') initEditableDimensionValues();
            registerPwaServiceWorker();
            window.setTimeout(() => {
                if(!maybeShowMobileStartupPrompt() && typeof maybeShowDeviceContextPrompt === 'function') {
                    maybeShowDeviceContextPrompt();
                }
            }, 600);
        };
