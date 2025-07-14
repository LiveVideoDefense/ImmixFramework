const IMMIX = require('../immixFramework');
var immixFramework = undefined;

/**
 * Function called by the startup to set default variables.
 * Do not use unless you know what you are doing.
 * @param {Proxy} proxy 
 * @param {ImmixFramework} framework 
 */
function setDefaults(proxy, framework) {
    immixFramework = framework;
}

//lower-level get
function getWholeEventQueue(callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getWholeEventQueue()`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@getWholeEventQueue] " + IMMIX.Errors.notAuthorized);
        return;
    }

    immixFramework.fetchFromImmix('/ajax/EventQueueGet.ashx', data => {
        callback(JSON.parse(data));
    })
}

//lower-level get
function getEventQueue(callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getEventQueue()`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@getEventQueue] " + IMMIX.Errors.notAuthorized);
        return;
    }

    immixFramework.fetchFromImmix('/ajax/EventQueueGet.ashx', data => {
        callback(JSON.parse(data).EventQueue);
    })
};

//lower-level get
function getSystemEventQueue(callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getSystemEventQueue()`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@getSystemEventQueue] " + IMMIX.Errors.notAuthorized);
        return;
    }

    immixFramework.fetchFromImmix('/ajax/EventQueueGet.ashx', data => {
        callback(JSON.parse(data).SystemEventQueue);
    })
};


module.exports = {
    getEventQueue,
    getSystemEventQueue,
    getWholeEventQueue,
    setDefaults
}