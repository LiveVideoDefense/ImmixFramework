# ImmixFramework
A framework that gives access to alarm software Immix from NodeJS!

### THIS PROJECT IS DEVELOPED TO FIT LIVE VIDEO DEFENSE'S NEEDS FIRST AND FOREMOST.
#### This project is in Beta, and is being lead by [Aiden Desjarlais](https://github.com/TOG11)
There is no guarantee of a full version.


# Documentation
Available documentation on this project can be found in test.js in ```/test```
<br> Full documentation *will* be written soon.
<br> to test, set config in ```/test``` then in the main directory run ```npm test```
<br>
<br>
Will not be released on NPM until we feel like its ready, until then link your projects with ```npm link```
<br>
<br>
**PLEASE PUT A CHROME INSTALLATION INTO ```./chrome``` OR SET PATH WITH CONFIG**
## Getting Started
Example:
```js
async...
const IMMIX = require('immixFramework')();
const immixConfig = {
  "username": "John",
  "password": "JohnDoe123",
  "immixUri": "immix.mysecuritysite.com"
}

try {
  await IMMIX.Session.open(immixConfig);
  const allSites = await IMMIX.Sites.getSites();
  //returns. [{armed: (Boolean), groupid: (Number), groupTypeId: (Number), isdisabled : (Boolean), title: (String)}]
  console.log(allSites);
  IMMIX.Session.close(() => process.exit(1));
} catch (err) {
  console.error(err);
}
```
Audit Auth Example **(BETA)**:
```js
/*
Audit authrozation allows the fetching of media from Immix for downloading
*/

async...
const IMMIX = require('immixFramework')();
const immixConfig = {
  "username": "John",
  "password": "JohnDoe123",
  "immixUri": "immix.mysecuritysite.com"
}


//audit config
IMMIX.Config.immixSettings.auditAuthSite = 'FrameworkAccessSiteOfSomeSort'; //a site the framework can use to get auth, preferably make a site meant for it, and put its name here
IMMIX.Session.getAuditAuth = true;

//settings
IMMIX.Config.debug.useLogs = true; //uses logs

//always call above snippets before loading

try {
  await IMMIX.Session.open(immixConfig);
  const allMediaForEvent = await IMMIX.Audit.getMediaFromEventID(1234567)
  console.log(allMediaForEvent);
  IMMIX.Session.close(() => process.exit(1));
} catch (err) {
  console.error(err);
}
```
Framework Configuration:
```js
//CONFIG:
IMMIX.Config.browserExecutablePath // ("./chrome/chrome.exe")
IMMIX.Config.immixSettings.immixURI // (set-by-config)
IMMIX.Config.immixSettings.useHttps // (true) - UNTESTED IF FALSE
IMMIX.Config.immixSettings.username // (set-by-config)
IMMIX.Config.immixSettings.password // (set-by-config)
IMMIX.Config.immixSettings.immixMonitoringStationId // (1)
IMMIX.Config.immixSettings.puppeteerRetryAttempts // (3)
IMMIX.Config.immixSettings.auditAuthSite // (undefined)

//PROXY SETTINGS:
IMMIX.Config.proxySettings.port // (3000)
IMMIX.Config.proxySettings.proxyAPI // ("/proxy/v1/")
IMMIX.Config.proxySettings.proxyEndpoint // ("/proxy/endpoints/")
IMMIX.Config.proxySettings.proxyReqDelay // (3000)
IMMIX.Config.proxySettings.proxyPuppeteerDelay // (3000)

//DEBUG SETTINGS:
IMMIX.Config.debug.puppeteerHeadless // (true)
IMMIX.Config.debug.useLogs // (false)
```
Framework Session Managment:
```js
await IMMIX.Session.open(config);
await IMMIX.Session.reload();
await IMMIX.Session.reload(true); - reloads with audit auth
IMMIX.Session.close(() => {});

IMMIX.Session.switchToStation(stationConfig); - switches stations
/* ex.
stationConfig = {
  "username": "John",
  "password": "JohnDoe123",
  "stationId": 104 //id of station to switch to
}
*/

//OBJECTS:
IMMIX.Session.isAuthorized
IMMIX.Session.sessionCookie
IMMIX.Session.auditAuth
IMMIX.Session.puppeteerSessionCookie
IMMIX.Session.connection
IMMIX.Session.getAuditAuth

```


