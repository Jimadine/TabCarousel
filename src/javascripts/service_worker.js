/**
 * Chrome extension to cycle through tabs.
 *
 * @author Benjamin Oakes <hello@benjaminoakes.com>, @benjaminoakes
 * @author Madhur Ahuja, @madhur
 * @author Jim Adamson, @jimadine
 * @seealso http://code.google.com/chrome/extensions/background_pages.html
 */

import {
  LS
} from './shared.js';
import {
  defaults
} from './shared.js';
import {
  constants
} from './shared.js';

chrome.runtime.onInstalled.addListener(({
  reason
}) => {
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
 * @property {Object} lastReloads_ms - An object to store the last reload time of each tab.
 * @property {number} lastTimeout - The ID of the last timeout set with setTimeout().
 *
 * @method constructor() - Initializes a new instance of the Carousel class.
 * @method _start() - Starts the carousel, cycling through tabs in the current window.
 */
class Carousel {
  constructor() {
    this.lastTimeout = undefined;
  }

  _start(ms) {
    chrome.action.setIcon({
      path: 'images/icon_32_exp_1.75_stop_emblem.png'
    });
    chrome.action.setTitle({
      title: 'Stop Carousel'
    });
    const flip = setInterval(this._get_window.bind(this), ms);
  }

  _running() {
    return !!this.lastTimeout;
  }

  _stop() {
    clearTimeout(this.lastTimeout);
    this.lastTimeout = undefined;
    chrome.action.setIcon({
      path: 'images/icon_32.png'
    });
    chrome.action.setTitle({
      title: 'Start Carousel'
    });
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
    if (!this._running()) {
      await this._start();
    } else {
      this._stop();
    }
  }

  async _load(ms) {
    chrome.action.onClicked.addListener(async () => await this._click());
    chrome.action.setTitle({
      title: 'Start Carousel'
    });

    if (await this._automaticStart()) {
      await this._start(ms);
    }
  }

  async orchestrate() {
    let flipTabMs = await this._flipWait_ms();
    let flipTabMilliseconds = parseInt(flipTabMs);
    let flipTabMinutes = parseFloat((flipTabMilliseconds / 60000).toFixed(1));
    let flipTabAlarmName = `TabCarouselFlipTabAlarm${flipTabMilliseconds}`;
    let reloadMs = await this._reloadWait_ms();
    let reloadMilliseconds = parseInt(reloadMs);
    let reloadMinutes = parseFloat((reloadMilliseconds / 60000).toFixed(1));
    let reloadAlarmName = `TabCarouselReloadTabsAlarm${reloadMilliseconds}`;
    if (await this._automaticStart()) {
      // Clear any reloadAlarms that might have been created if reload_ms was previously set to a different value
      chrome.alarms.getAll(alarms => {
        this._clear_redundant_alarms(alarms, reloadAlarmName);
      });
      // If reloading is enabled ...
      if (reloadMilliseconds > 0) {
        chrome.alarms.get(reloadAlarmName, alarm => {
          this._create_alarm(alarm, reloadAlarmName, reloadMilliseconds, reloadMinutes);
        });
      }
      // If alarm-based tab switching will be used ...
      if (flipTabMilliseconds > 30000) {
        chrome.alarms.getAll(alarms => {
          this._clear_redundant_alarms(alarms, flipTabAlarmName);
        });
        chrome.alarms.get(flipTabAlarmName, alarm => {
          this._create_alarm(alarm, flipTabAlarmName, flipTabMilliseconds, flipTabMinutes);
        });
      } else {
        // If setInterval-based tab switching will be used ...
        // Clear any flipTabAlarms that might have been created if flipWait_ms was previously set to > 3000
        chrome.alarms.getAll(alarms => {
          this._clear_redundant_alarms(alarms, flipTabAlarmName);
        });
        this._start(flipTabMilliseconds);
      }
    }
  }

  _clear_redundant_alarms(alarms, alarmName) {
    if (!alarms || !alarmName) return;
    for (let alarm of alarms) {
      if (alarm.name.startsWith("TabCarouselFlipTabAlarm") && alarmName.startsWith("TabCarouselFlipTabAlarm") && alarm.name != alarmName) {
        chrome.alarms.clear(alarm.name);
      }
      if (alarm.name.startsWith("TabCarouselReloadTabsAlarm") && alarmName.startsWith("TabCarouselReloadTabsAlarm") && alarm.name != alarmName) {
        chrome.alarms.clear(alarm.name);
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

  on_alarm(alarm) {
    let alarmName = alarm.name;
    this._get_window(alarmName);
  }

  _get_window(alarmName) {
    chrome.windows.getCurrent(w => {
      this._get_tabs(w, alarmName);
    });
  }

  _get_tabs(w, alarmName) {
    let windowId = w.id;
    chrome.tabs.query({
      windowId: windowId
    }, tabs => {
      if (alarmName?.startsWith("TabCarouselFlipTabAlarm")) {
        this._get_next_tab(tabs);
      } else if (alarmName?.startsWith("TabCarouselReloadTabsAlarm")) {
        this._reload_tabs(tabs);
      } else {
        this._get_next_tab(tabs);
      }
    });
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
  carousel.orchestrate();
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
