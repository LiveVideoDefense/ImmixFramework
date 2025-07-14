const IMMIX = require('../immixFramework');
var immixFramework = undefined;

function setDefaults(proxy, framework) {
  immixFramework = framework;
}

//lower-level get
function getSites(callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getSites()`);
  
  if (!immixFramework.Session.isAuthorized) {
    console.error("[ImmixFramework@getSites] " + IMMIX.Errors.notAuthorized);
    return;
  }
    immixFramework.fetchFromImmix('/ajax/SiteTreeHandler.ashx?Mode=list', async rawData => {
      if (isJsonString(rawData))
        callback(JSON.parse(rawData));
      else return new Error("Not JSON");
    })

};

//optimize
function isJsonString(str) {
  try {
      JSON.parse(str);
  } catch (e) {
      return false;
  }
  return true;
}

module.exports = {
  getSites,
  setDefaults
}