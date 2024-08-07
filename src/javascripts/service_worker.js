/**
 * Chrome extension to cycle through tabs.
 *
 * @author Benjamin Oakes <hello@benjaminoakes.com>, @benjaminoakes
 * @author Madhur Ahuja, @madhur
 * @author Jim Adamson, @jimadine
 * @seealso https://developer.chrome.com/docs/extensions/develop/concepts/service-workers
 */

import { LS } from './shared.js';
import { defaults } from './shared.js';
import { constants } from './shared.js';

chrome.runtime.onInstalled.addListener(({reason}) => {
    if (reason === 'install') {
        chrome.tabs.create({
            url: 'onboarding.html'
        });
    }
    loadCarousel();
});

/**
 * Carousel class for managing and controlling tab cycling in a Chrome extension.
 *
 * @class
 *
 * @property {number} lastTimeout - The ID of the last timeout set with setTimeout().
 *
 * @method constructor() - Initializes a new instance of the Carousel class.
 * @method _start() - Starts the carousel, cycling through tabs in the current window.
 */
class Carousel {
    constructor() {
        this.lastTimeout = undefined;
    }

    _setTitle(state) {
      const iconPath = state === 'stop' ? 'images/icon_32.png' : 'images/icon_32_exp_1.75_stop_emblem.png';
      const titleText = state === 'stop' ? 'Start Carousel' : 'Stop Carousel';
      chrome.action.setIcon({ path: iconPath });
      chrome.action.setTitle({ title: titleText });
    }

    async _start() {
        this._setTitle('start');
        let flipTabMs = await this._flipWait_ms();
        let flipTabMilliseconds = parseInt(flipTabMs);
        let flipTabMinutes = parseFloat((flipTabMilliseconds / 60000).toFixed(1));
        let flipTabAlarmName = `TabCarouselFlipTabAlarm${flipTabMilliseconds}`;
        let reloadMs = await this._reloadWait_ms();
        let reloadMilliseconds = parseInt(reloadMs);
        let reloadMinutes = parseFloat((reloadMilliseconds / 60000).toFixed(1));
        let reloadAlarmName = `TabCarouselReloadTabsAlarm${reloadMilliseconds}`;

        // Clear any flipTabAlarms & reloadAlarms that might have been created if flipWait_ms / reload_ms were previously set to different values
        let alarms = await chrome.alarms.getAll();
        this._clear_redundant_alarms(alarms, [reloadAlarmName, flipTabAlarmName]);

        // If reloading is enabled ...
        if (reloadMilliseconds > 0) {
            let alarm = await chrome.alarms.get(reloadAlarmName);
            this._create_alarm(alarm, reloadAlarmName, reloadMilliseconds, reloadMinutes);
        }

        // If alarm-based tab switching will be used ...
        if (flipTabMilliseconds > 30000) {
            let alarm = await chrome.alarms.get(flipTabAlarmName);
            this._create_alarm(alarm, flipTabAlarmName, flipTabMilliseconds, flipTabMinutes);
        } else {
            const continuation = () => {
                this._get_window();
                this.lastTimeout = setTimeout(continuation, flipTabMilliseconds);
            };
            continuation();
        }
    }

    async _running() {
        let timeOut = !!this.lastTimeout;
        let alarms = await chrome.alarms.getAll();
        let flipTabsAlarmRegistered = alarms.some(alarm => alarm.name.startsWith('TabCarouselFlipTabAlarm'));
        return timeOut || flipTabsAlarmRegistered;
    }

    async _stop() {
        this._setTitle('stop');
        chrome.alarms.clearAll();
        if (parseInt(await this._flipWait_ms()) <= 30000) {
            clearTimeout(this.lastTimeout);
            this.lastTimeout = undefined;
        }
    }

    async _flipWait_ms() {
        return await LS.getItem(constants.flipWait_ms) || defaults.flipWait_ms;
    }

    async _reloadWait_ms() {
        const reloadWait = await LS.getItem(constants.reloadWait_ms);
        // Handle cases where reloadWait is 0 (don't treat as 'false' as || does - treat as '0' [reload disabled])
        if (isNaN(parseInt(reloadWait))) {
            return defaults.reloadWait_ms;
        } else {
            return parseInt(reloadWait);
        }
    }

    async _bypassCache() {
        const bypassCache = await LS.getItem(constants.bypassCache) || defaults.bypassCache;
        if (bypassCache !== undefined) {
            return JSON.parse(bypassCache);
        }
    }

    async _automaticStart() {
        const automaticStart = await LS.getItem(constants.automaticStart);
        if (automaticStart !== undefined) {
            return JSON.parse(automaticStart);
        }
    }

    async _click() {
        await this._running() ? this._stop() : this._start();
    }

    async load() {
        chrome.action.onClicked.addListener(async () => await this._click());
        let isCarouselActive = ((await chrome.action.getTitle({}) || '') === 'Stop Carousel');
        if (await this._automaticStart() || isCarouselActive) {
            await this._start();
        }
    }

    _clear_redundant_alarms(alarms, requiredAlarms) {
        if (!alarms || !requiredAlarms) return;
        for (let alarm of alarms) {
            for (let requiredAlarm of requiredAlarms) {
                if (alarm.name.startsWith('TabCarouselFlipTabAlarm') && requiredAlarm.startsWith('TabCarouselFlipTabAlarm') && alarm.name != requiredAlarm) {
                    chrome.alarms.clear(alarm.name);
                }
                if (alarm.name.startsWith('TabCarouselReloadTabsAlarm') && requiredAlarm.startsWith('TabCarouselReloadTabsAlarm') && alarm.name != requiredAlarm) {
                    chrome.alarms.clear(alarm.name);
                }
            }
        }
    }

    _create_alarm(alarm, alarmName, milliseconds, minutes) {
        if (!alarm) {
            chrome.alarms.create(alarmName, {
                when: Date.now() + milliseconds,
                periodInMinutes: minutes
            });
        }
    }

    async on_alarm(alarm) {
        let isCarouselActive = ((await chrome.action.getTitle({}) || '') === 'Stop Carousel');
        if (await this._automaticStart() || isCarouselActive) {
            let alarmName = alarm.name;
            this._get_window(alarmName);
        }
    }

    async _get_window(alarmName) {
        let w = await new Promise(resolve => chrome.windows.getCurrent(resolve));
        this._get_tabs(w, alarmName);
    }

    async _get_tabs(w, alarmName) {
        let windowId = w.id;
        let tabs = await new Promise(resolve => chrome.tabs.query({ windowId: windowId }, resolve));
        if (alarmName?.startsWith('TabCarouselFlipTabAlarm')) {
            this._get_next_tab(tabs);
        } else if (alarmName?.startsWith('TabCarouselReloadTabsAlarm')) {
            this._reload_tabs(tabs);
        } else {
            this._get_next_tab(tabs);
        }
    }

    _get_next_tab(tabs) {
        if (!tabs) {
            return;
        }
        let activeTab = tabs.find(tab => tab.active);
        if (!activeTab) {
            return;
        }
        let activeIndex = tabs.indexOf(activeTab);
        let nextIndex = (activeIndex + 1) % tabs.length;
        this._set_next_tab(tabs, nextIndex);
    }

    _set_next_tab(tabs, tab) {
        chrome.tabs.update(tabs[tab].id, {
            active: true
        });
    }

    async _reload_tabs(tabs) {
        let bypassCache = await this._bypassCache();
        for (var i = 0; i < tabs.length; i++) {
            chrome.tabs.reload(tabs[i].id, {
                bypassCache: bypassCache
            });
        }
    }

}

let started = false;

function loadCarousel() {
    started = true;
    const carousel = new Carousel();
    carousel.load();
    chrome.alarms.onAlarm.addListener(async alarm => carousel.on_alarm(alarm));
}

chrome.runtime.onStartup.addListener(() => {
    if (!started) {
        loadCarousel();
    }
});

if (!started) {
    loadCarousel();
}
