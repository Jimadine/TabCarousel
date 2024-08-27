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

    #setTitle(state) {
      const iconPath = state === 'stop' ? '../images/icon_32.png' : '../images/icon_32_exp_1.75_stop_emblem.png';
      const titleText = state === 'stop' ? 'Start Carousel' : 'Stop Carousel';
      chrome.action.setIcon({ path: iconPath });
      chrome.action.setTitle({ title: titleText });
    }

    async #start() {
        this.#setTitle('start');
        let flipTabMs = await this.#flipWait_ms();
        let flipTabMilliseconds = parseInt(flipTabMs);
        let flipTabMinutes = parseFloat((flipTabMilliseconds / 60000).toFixed(1));
        let flipTabAlarmName = `TabCarouselFlipTabAlarm${flipTabMilliseconds}`;
        let reloadMs = await this.#reloadWait_ms();
        let reloadMilliseconds = parseInt(reloadMs);
        let reloadMinutes = parseFloat((reloadMilliseconds / 60000).toFixed(1));
        let reloadAlarmName = `TabCarouselReloadTabsAlarm${reloadMilliseconds}`;

        // Clear any flipTabAlarms & reloadAlarms that might have been created if flipWait_ms / reload_ms were previously set to different values
        let alarms = await chrome.alarms.getAll();
        this.#clear_redundant_alarms(alarms, [reloadAlarmName, flipTabAlarmName]);

        // If reloading is enabled ...
        if (reloadMilliseconds > 0) {
            let alarm = await chrome.alarms.get(reloadAlarmName);
            this.#create_alarm(alarm, reloadAlarmName, reloadMilliseconds, reloadMinutes);
        }

        // If alarm-based tab switching will be used ...
        if (flipTabMilliseconds > 30000) {
            let alarm = await chrome.alarms.get(flipTabAlarmName);
            this.#create_alarm(alarm, flipTabAlarmName, flipTabMilliseconds, flipTabMinutes);
        } else {
            const continuation = () => {
                this.#get_window();
                this.lastTimeout = setTimeout(continuation, flipTabMilliseconds);
            };
            continuation();
        }
    }

    async #running() {
        let timeOut = !!this.lastTimeout;
        let alarms = await chrome.alarms.getAll();
        let flipTabsAlarmRegistered = alarms.some(alarm => alarm.name.startsWith('TabCarouselFlipTabAlarm'));
        return timeOut || flipTabsAlarmRegistered;
    }

    async #stop() {
        this.#setTitle('stop');
        chrome.alarms.clearAll();
        if (parseInt(await this.#flipWait_ms()) <= 30000) {
            clearTimeout(this.lastTimeout);
            this.lastTimeout = undefined;
        }
    }

    async #flipWait_ms() {
        return await LS.getItem(constants.flipWait_ms) || defaults.flipWait_ms;
    }

    async #reloadWait_ms() {
        const reloadWait = await LS.getItem(constants.reloadWait_ms);
        // Handle cases where reloadWait is 0 (don't treat as 'false' as || does - treat as '0' [reload disabled])
        if (isNaN(parseInt(reloadWait))) {
            return defaults.reloadWait_ms;
        } else {
            return parseInt(reloadWait);
        }
    }

    async #bypassCache() {
        const bypassCache = await LS.getItem(constants.bypassCache) || defaults.bypassCache;
        if (bypassCache !== undefined) {
            return JSON.parse(bypassCache);
        }
    }

    async #reloadExcludedDomains() {
        const reloadExcludedDomains = await LS.getItem(constants.reloadExcludedDomains) || defaults.reloadExcludedDomains;
        const lines = reloadExcludedDomains.split("\n");
        const arr = lines.filter(line => line.trim() !== ""); // Remove empty lines
        return arr;
    }

    async #automaticStart() {
        const automaticStart = await LS.getItem(constants.automaticStart);
        if (automaticStart !== undefined) {
            return JSON.parse(automaticStart);
        }
    }

    async #click() {
        await this.#running() ? this.#stop() : this.#start();
    }

    async load() {
        chrome.action.onClicked.addListener(async () => await this.#click());
        let isCarouselActive = ((await chrome.action.getTitle({}) || '') === 'Stop Carousel');
        if (await this.#automaticStart() || isCarouselActive) {
            await this.#start();
        }
    }

    #clear_redundant_alarms(alarms, requiredAlarms) {
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

    #create_alarm(alarm, alarmName, milliseconds, minutes) {
        if (!alarm) {
            chrome.alarms.create(alarmName, {
                when: Date.now() + milliseconds,
                periodInMinutes: minutes
            });
        }
    }

    async on_alarm(alarm) {
        let isCarouselActive = ((await chrome.action.getTitle({}) || '') === 'Stop Carousel');
        if (await this.#automaticStart() || isCarouselActive) {
            let alarmName = alarm.name;
            this.#get_window(alarmName);
        }
    }

    async #get_window(alarmName) {
        let w = await new Promise(resolve => chrome.windows.getCurrent(resolve));
        this.#get_tabs(w, alarmName);
    }

    async #get_tabs(w, alarmName) {
        let windowId = w.id;
        let tabs = await new Promise(resolve => chrome.tabs.query({ windowId: windowId }, resolve));
        if (alarmName?.startsWith('TabCarouselFlipTabAlarm')) {
            this.#get_next_tab(tabs);
        } else if (alarmName?.startsWith('TabCarouselReloadTabsAlarm')) {
            this.#reload_tabs(tabs);
        } else {
            this.#get_next_tab(tabs);
        }
    }

    #get_next_tab(tabs) {
        if (!tabs) {
            return;
        }
        let activeTab = tabs.find(tab => tab.active);
        if (!activeTab) {
            return;
        }
        let activeIndex = tabs.indexOf(activeTab);
        let nextIndex = (activeIndex + 1) % tabs.length;
        this.#set_next_tab(tabs, nextIndex);
    }

    #set_next_tab(tabs, tab) {
        chrome.tabs.update(tabs[tab].id, {
            active: true
        });
    }

    async #reload_tabs(tabs) {
        let bypassCache = await this.#bypassCache();
        let reloadExcludedDomains = await this.#reloadExcludedDomains();
        for (var i = 0; i < tabs.length; i++) {
            // Extract the domain from the tab's URL
            let tabDomain = new URL(tabs[i].url).hostname;
            // Check if the tab's domain is not in the reloadExcludedDomains array before reloading
            if (!reloadExcludedDomains.includes(tabDomain)) {
                // Reload the tab if the domain is not excluded
                chrome.tabs.reload(tabs[i].id, {
                    bypassCache: bypassCache
                });
            }
        }
    }

    async on_storage() {
        let isCarouselActive = ((await chrome.action.getTitle({}) || '') === 'Stop Carousel');
        if (await this.#running() || isCarouselActive) {
            this.#stop();
            loadCarousel();
        }
    }
}

let carousel;

function loadCarousel() {
    carousel = new Carousel();
    carousel.load();
    chrome.alarms.onAlarm.addListener(async alarm => carousel.on_alarm(alarm));
}

chrome.runtime.onStartup.addListener(() => {
    loadCarousel();
});

chrome.storage.onChanged.addListener(function (changes, areaName) {
    if (areaName === "local") {
        carousel.on_storage();
    }
});

loadCarousel();
