var cors = require('cors');
const express = require('express');
const app = express();
const path = require('path');
const puppeteer = require('puppeteer');
const IMMIX = require('../immixFramework');
app.use(express.json());
app.use(cors())
var immixFramework;
var proxy = undefined;

/**
 * Initialize the proxy for Immix
 * @param {immixFramework} framework 
 */
async function start(framework) {
    immixFramework = framework;
    immixFramework.Debug.log("\t\t     Immix API Framework\n\t(C) Aiden C. Desjarlais & Live Video Defense\n\t\t\t    2025");
    immixFramework.Debug.log('[PROXY] Attempting to start the proxy...');
    return new Promise((resolve, reject) => {
        //basicLogon
        app.get(immixFramework.Config.proxySettings.proxyAPI + "basicLogon", (req, res) => {
            res.sendFile(path.join(__dirname, '/endpoints/frontend/basicLogon.html'));
        })

        app.post(immixFramework.Config.proxySettings.proxyEndpoint + 'basicLogon', async (req, res) => {
            const { username, password, proxyRequestID } = req.body;

            //delay proxy so it can create the proxy request
            await new Promise(resolve => setTimeout(resolve, immixFramework.Config.proxySettings.proxyReqDelay));

            var request = proxyQueue.find(r => r.requestID == proxyRequestID);
            try {
                const response = await fetch(immixFramework.fullImmixURI() + '/ajax/controller/login/basic', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json, text/plain, */*',
                        'User-Agent': 'Mozilla/5.0',
                    },
                    body: JSON.stringify({ username, password })
                });

                if (!response.ok) {
                    immixFramework.Debug.log('[PROXY] Immix login failed: ' + response.statusText + "\n(Likley invalid credentials!)");

                    //finish request
                    if (request.reject !== undefined)
                        request.reject({ success: false, error: response.statusText });
                    proxyQueue.splice(proxyQueue.indexOf(request));
                    return res.status(response.status).json({ error: 'PROXY: Immix login failed' });
                }

                //const body = await response.text();
                const cookie = response.headers.getSetCookie();

                //finish request
                if (request.resolve !== undefined)
                    request.resolve({ success: true, error: undefined, cookie: cookie });
                proxyQueue.splice(proxyQueue.indexOf(request));
            } catch (error) {
                if (request.reject !== undefined)
                request.reject({ success: false, error: error });
                res.status(500).json({ error: 'Proxy server error' });
            }
        });

        proxy = app.listen(immixFramework.Config.proxySettings.port, () => {
            immixFramework.endpointsList.forEach(epm => epm.setDefaults(immixFramework.proxyServer, immixFramework));
            immixFramework.Debug.log('[PROXY] Proxy started! (:' + immixFramework.Config.proxySettings.port + ")");
            immixFramework.Debug.log("[FRAMEWORK] Attempting to logon to " + immixFramework.fullImmixURI() + " ...");
            immixFramework.endpoints.basicAuth.authorizeBasic(immixFramework.Config.immixSettings.username, immixFramework.Config.immixSettings.password).then(status => {
                immixFramework.Debug.log("[FRAMEWORK] Immix returned user session authorization, applying to this session...");
                immixFramework.Session.isAuthorized = true;
                immixFramework.Session.sessionCookie = status.cookie[0].split(";")[0];
                immixFramework.Session.puppeteerSessionCookie = formatSessionCookie(status.cookie[0]);

                //immix requires users to visit the alarms page before giving them access to the API where the event queues are stored.
                if (immixFramework.Session.getAuditAuth) {
                    //Here we visit the alarms page, and run a very quick site check on a test site - This allows us to get our audit auth for media.
                    (async () => {


                        let page;
                        try {
                            const browser = await puppeteer.launch({
                                headless: immixFramework.Config.debug.puppeteerHeadless, executablePath: immixFramework.Config.browserExecutablePath,
                                ignoreHTTPSErrors: true
                            });
                            page = await browser.newPage();

                            const url = immixFramework.fullImmixURI() + "/AlarmMonitor.aspx";
                            const auditAuthSite = immixFramework.Config.immixSettings.auditAuthSite;

                            await page.setCookie(immixFramework.Session.puppeteerSessionCookie);
                            await page.goto(url, { waitUntil: 'domcontentloaded' });


                            await page.evaluate(async (siteName, delay) => {
                                siteCheck();
                                // Wait 3 seconds to let GUI appear
                                (async () => {
                                    await new Promise(resolve => setTimeout(resolve, delay));
                                    const match = Array.from(document.querySelectorAll('.siteNode'))
                                        .find(el => el.textContent.includes(siteName));
                                    match.click();
                                })()
                            }, auditAuthSite, immixFramework.Config.proxySettings.proxyPuppeteerDelay);

                            //wait until load page
                            await page.waitForFunction(() =>
                                window.location.href.includes('SiteMonitor.aspx?EventId='),
                                { timeout: 20000 }
                            );

                            // Get auth on page load (wait for btn dom load)
                            await page.waitForSelector('#btnCloseEvent', { timeout: 20000 });

                            const auditAuth = await page.evaluate(() => window.auth);
                            immixFramework.Debug.log("[FRAMEWORK] Immix returned audit authorization, applying to this session...\n"+ auditAuth +"\n");
                            immixFramework.Session.auditAuth = auditAuth;

                            await new Promise(resolve => setTimeout(resolve, immixFramework.Config.proxySettings.proxyPuppeteerDelay));

                            // Close event
                            await page.evaluate(() => {
                                const btn = document.querySelector('#btnCloseEvent');
                                btn.click();
                            });

                            await page.waitForFunction(() =>
                                window.location.href.includes('AlarmMonitor.aspx'),
                                { timeout: 20000 }
                            );
                        } catch (error) {
                            immixFramework.Debug.log("[FRAMEWORK] Failed to Authorize on Immix as " + immixFramework.Config.immixSettings.username + " - " + error)
                                if (immixFramework.Session.isAuthorized)
                                    immixFramework.Session.close();
                                    reject({ success: false, error: new Error(IMMIX.Errors.authFailed + " : " + error) });
                        } finally {
                            try {
                                await page.close();
                                immixFramework.frameworkSession = immixFramework;
                                immixFramework.Debug.log("[FRAMEWORK] Fully Authorized on Immix as " + immixFramework.Config.immixSettings.username)
                                resolve({ success: true, error: undefined })
                            } catch (closeError) {
                                immixFramework.Debug.log("[FRAMEWORK] Failed to Authorize on Immix as " + immixFramework.Config.immixSettings.username + " - " + closeError)
                                if (immixFramework.Session.isAuthorized)
                                    immixFramework.Session.close();
                                reject({ success: false, error: new Error(IMMIX.Errors.cannotClosePuppeteerPage + " : " + closeError) });
                            }
                        }
                    })();
                } else {
                    //skip getting the audit auth
                    puppetPage(immixFramework.fullImmixURI() + "/AlarmMonitor.aspx", immixFramework.Session.puppeteerSessionCookie).then(() => {
                        immixFramework.frameworkSession = immixFramework;
                        immixFramework.Debug.log("[FRAMEWORK] User Authorized on Immix as " + immixFramework.Config.immixSettings.username)
                        resolve({ success: true, error: undefined })
                    }).catch(() => {
                        immixFramework.Debug.log("[FRAMEWORK] Failed to Authorize on Immix as " + immixFramework.Config.immixSettings.username)
                                if (immixFramework.Session.isAuthorized)
                                    immixFramework.Session.close();
                                                        reject({ success: false, error: new Error(IMMIX.Errors.authFailed + " : " + error) });
                    })
                }
            }).catch(status => {
                if (status.error.toString().toLowerCase().includes('fetch failed')) {
                    reject({ success: false, error: new Error(IMMIX.Errors.invalidURI + " : " + status.error) });
                } else {
                    reject({ success: false, error: new Error(IMMIX.Errors.authFailed + " : " + status.error) });
                }
                                if (immixFramework.Session.isAuthorized)
                                    immixFramework.Session.close();            })
        });
    });
}

function formatSessionCookie(cookie) {
    var cookie = cookie.split(";")[0];
    return {
        name: `${cookie.split('=')[0]}`,
        value: `${cookie.split('=')[1]}`,
        domain: `${immixFramework.Config.immixSettings.immixURI}`,
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
    }
}

function shutdown(callback = () => { }) {
    proxy.close(() => {
        immixFramework.Debug.log("[PROXY] Proxy closed");
        proxyLogoutSession(immixFramework.Session.puppeteerSessionCookie, (success, err) => {
            if (err) return;
            immixFramework.Debug.log("[PROXY] Deauthorized with Immix");
            callback();
        })
    })
}


//lower level get for framework
function proxyTryImmixLogon(username, password, callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : tryLogon(${username}, ${password.replaceAll(/./g, '*')})`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@proxyTryImmixLogon] " + IMMIX.Errors.notAuthorized);
        return;
    }

    //try login
    immixFramework.endpoints.basicAuth.authorizeBasic(username, password).then(status => {
        //logout
        proxyLogoutSession(status.cookie, callback);
    }).catch(status => {
        callback(false, "Authorization Error: " + status.error);
    });
}


/**
 * @returns {Promise<{success: (Boolean), error: (String)}>}
 */
function puppetPage(pageURL, cookies = undefined) {
    return new Promise((resolve, reject) => {
        (async () => {
            let browser;
            let response;
            try {
                browser = await puppeteer.launch({
                    headless: immixFramework.Config.debug.puppeteerHeadless,
                    executablePath: immixFramework.Config.browserExecutablePath,
                    ignoreHTTPSErrors: true
                });

                const page = await browser.newPage();

                const url = pageURL;

                if (cookies !== undefined) {
                    await page.setCookie(cookies);
                }

                response = await page.goto(url, { waitUntil: 'domcontentloaded' });
            } catch (error) {
                reject({ success: false, error: new Error(IMMIX.Errors.puppeteerError + " : " + error) });
            } finally {
                try {
                    await browser.close();
                    if (response.status() === 200) {
                        resolve({ success: true, error: undefined });
                    } else {
                        reject({ success: false, error: new Error(IMMIX.Errors.puppeteerInvalidStatus + " : code " + response.status()) });
                    }
                } catch (closeError) {
                    reject({ success: false, error: new Error(IMMIX.Errors.cannotClosePuppeteerPage + " : " + closeError) });
                }
            }
        })()
    });
}

//the queue of provy requests to fullfil
var proxyQueue = [];

//proxy request must be made before a proxy endpoint call
function createProxyRequest(requestID) {
    return new Promise((resolveP, rejectP) => {
        proxyQueue.push({
            requestID: requestID,
            resolve: resolveP,
            reject: rejectP
        });
    });
}

function proxyLogoutSession(sessionCookie, callback) {
    (async () => {
        let browser;
        try {
            browser = await puppeteer.launch({
                headless: immixFramework.Config.debug.puppeteerHeadless, executablePath: immixFramework.Config.browserExecutablePath,
                ignoreHTTPSErrors: true
            });
            const page = await browser.newPage();

            const url = immixFramework.fullImmixURI() + '/AlarmMonitor.aspx';
            if (sessionCookie.length == 1)
                await page.setCookie(formatSessionCookie(sessionCookie[0]));
            else
                await page.setCookie(formatSessionCookie(sessionCookie));

            await page.goto(url, { waitUntil: 'domcontentloaded' });

            await page.evaluate(() => {
                __doPostBack('ctl00$LogoutButton', '');
            });
        } catch (error) {
            callback(false, "Error: " + error);
        } finally {
            if (browser) {
                try {
                    await browser.close();
                    callback(true);
                } catch (closeError) {
                    callback(false, closeError);
                }
            }
        }
    })();
}

module.exports = {
    start,
    createProxyRequest,
    puppetPage,
    proxyTryImmixLogon,
    proxyLogoutSession,
    shutdown
}