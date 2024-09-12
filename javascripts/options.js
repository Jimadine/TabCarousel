/**
 * options.js
 *
 * This script is responsible for managing the options/settings of the extension.
 *
 * @module
 *
 * @requires shared.js - Contains shared constants and default values.
 *
 * @function saveOptions() - Saves the user's options to local storage.
 *
 * @event save.onclick - Triggers the saveOptions function when the save button is clicked.
 *
 * @var flipWait_ms - Retrieves the flipWait_ms value from local storage or uses the default value.
 *
 * @var automaticStart - Retrieves the automaticStart value from local storage or uses the default value.
 */

import { LS } from './shared.js';
import { defaults } from './shared.js';
import { constants } from './shared.js';

function saveOptions() {
    const options = {
        flipWait_ms: document.getElementById(constants.flipWait_ms).value * 1000,
        reloadWait_ms: document.getElementById(constants.reloadWait_ms).value * 60000,
        automaticStart: document.getElementById(constants.automaticStart).checked,
        bypassCache: document.getElementById(constants.bypassCache).checked,
        reloadExcludedDomains: document.getElementById(constants.reloadExcludedDomains).value
    };
    LS.setItem(constants.flipWait_ms, options.flipWait_ms);
    LS.setItem(constants.reloadWait_ms, options.reloadWait_ms);
    LS.setItem(constants.automaticStart, options.automaticStart);
    LS.setItem(constants.bypassCache, options.bypassCache);
    LS.setItem(constants.reloadExcludedDomains, options.reloadExcludedDomains);
    document.getElementById('status').innerHTML = 'Saved.';
    return false;
}

function restoreOptions() {
    document.getElementById(constants.flipWait_ms).value = defaults.flipWait_ms / 1000;
    document.getElementById(constants.reloadWait_ms).value = defaults.reloadWait_ms / 60000;
    document.getElementById(constants.automaticStart).checked = defaults.automaticStart;
    document.getElementById(constants.bypassCache).checked = defaults.bypassCache;
    document.getElementById(constants.reloadExcludedDomains).value = defaults.reloadExcludedDomains;
    saveOptions();
    return false;
}

function validateDomains() {
    const lines = textarea.value.split('\n');
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    let isValid = true;
    lines.forEach(line => {
        if (!domainRegex.test(line.trim())) {
            isValid = false;
        }
    });

    if (!isValid) {
        document.getElementById('save').disabled = true;
        textarea.setCustomValidity('Please enter a valid domain name');
        textarea.reportValidity();
    } else {
        document.getElementById('save').disabled = false;
        textarea.setCustomValidity('');
    }
}

document.getElementById('save').onclick = saveOptions;
document.getElementById('restore').onclick = restoreOptions;
const flipWait_ms = await LS.getItem(constants.flipWait_ms) || defaults.flipWait_ms;
document.getElementById(constants.flipWait_ms).value = flipWait_ms / 1000;

let reloadWait_ms = await LS.getItem(constants.reloadWait_ms);
if (reloadWait_ms === undefined) {
    reloadWait_ms = defaults.reloadWait_ms;
}
document.getElementById(constants.reloadWait_ms).value = reloadWait_ms / 60000;

let automaticStart = await LS.getItem(constants.automaticStart);
if (automaticStart === undefined) {
    automaticStart = defaults.automaticStart;
}
let bypassCache = await LS.getItem(constants.bypassCache);
if (bypassCache === undefined) {
    bypassCache = defaults.bypassCache;
}
let reloadExcludedDomains = await LS.getItem(constants.reloadExcludedDomains);
if (reloadExcludedDomains === undefined) {
    reloadExcludedDomains = defaults.reloadExcludedDomains;
}
document.getElementById(constants.automaticStart).checked = automaticStart;
document.getElementById(constants.bypassCache).checked = bypassCache;
document.getElementById(constants.reloadExcludedDomains).value = reloadExcludedDomains;

const textarea = document.getElementById('reloadExcludedDomains');
textarea.addEventListener('input', validateDomains);
textarea.addEventListener('blur', () => textarea.value === '' && (document.getElementById('save').disabled = false));