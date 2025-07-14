#!/usr/bin/env node

/* 
    (c) Aiden C. Desjarlais 2025 & Live Video Defense
                Immix Framework for NodeJS 
                    LICENSED UNDER MIT  
*/

function immixFramework() {
    const framework = (() => {
        const path = require('path');
        class Debug {
            static log(msg) {
                if (Config.debug.useLogs)
                    console.log(msg);
            }
        }

        //load Configs
        class Config {
            static browserExecutablePath = path.join(__dirname, "chrome/chrome.exe");

            static immixSettings = {
                immixURI: "",
                useHttps: true,
                username: "",
                password: "",
                immixMonitoringStationId: 1,
                puppeteerRetryAttempts: 3,
                auditAuthSite: ''
            }

            static proxySettings = {
                port: 3000,
                proxyAPI: "/proxy/v1/",
                proxyEndpoint: "/proxy/endpoints/",
                proxyReqDelay: 3000,
                proxyPuppeteerDelay: 3000
            }

            static debug = {
                puppeteerHeadless: true,
                useLogs: false
            }
        }


        var isHTTPS = undefined;
        const fullImmixURI = () => {
            return (isHTTPS ? "https://" : "http://") + Config.immixSettings.immixURI.toString()
        }

        //load proxied endpoints
        const proxiedBasicAuthorization = require('./proxy/endpoints/backend/basicAuthorization');

        //set proxy server
        const proxyServer = require('./proxy/proxy');

        //load session authorized endpoints
        const sites = require('./endpoints/sites');
        const eventQueue = require('./endpoints/getEventQueue');
        const users = require('./endpoints/users');
        const audit = require('./endpoints/audit');

        //store session data
        /* DEPRECATED
        const fetchCookie = require('fetch-cookie').default;
        const tough = require('tough-cookie');
        const jar = new tough.CookieJar();
        const fetchWithCookies = fetchCookie(fetch, jar);
        */

        /**
         * Stores session data for Immix and the framework
         */
        class Session {
            static isAuthorized = false;
            static sessionCookie = undefined;
            static auditAuth = undefined;
            static puppeteerSessionCookie = undefined;
            static connection = undefined;
            /**
             * Set this to true if you want to be authorized for audit endpoints.
             * This significantly increases the framework start time, but gives access to audit endpoints.
             * Use only if you need audit endpoints.
             */
            static getAuditAuth = false;

            /**
             * Switches the framework over to a new station
             * @param {{ username: (String), password: (String), stationId: (Number)}} connection stationId Station ID to switch to
            */
            static switchToStation(connection) {
                return new Promise((resolve, reject) => {
                    if (!Session.isAuthorized) {
                        return reject(new Error(Errors.immixNotStarted + " : close()"));
                    }
                    globalThis.immixFrameworkInstance.Debug.log("[FRAMEWORK] Switching sites");
                    Session.connection.stationId = connection.stationId;
                    Session.connection.username = connection.username;
                    Session.connection.password = connection.password;
                    Session.reload().then(() => resolve()).catch((error) => reject(error));
                });
            }

            /**
             * Closes the immix framework
             * @param {Function} callback 
             */
            static close(callback) {

                if (!Session.isAuthorized) {
                    console.error(Errors.immixNotStarted + " : close()");
                    return;
                }

                proxyServer.shutdown(() => {
                    Session.isAuthorized = false;
                    Session.sessionCookie = undefined;
                    Session.puppeteerSessionCookie = undefined;
                    Session.auditAuth = undefined;
                    Session.getAuditAuth = false;
                    globalThis.immixFrameworkInstance.Debug.log("[FRAMEWORK] Immix framework closed");
                    if (callback)
                        callback();
                });
            }

            /**
             * @param {{immixUri: (String), username: (String), password: (String), stationId: 1 }} connection 
             * @returns {Promise<{status: (Boolean), error: (String)}>}
             */
            static open(connection = {}) {
                const {
                    immixUri,
                    username,
                    password,
                    stationId = Config.immixSettings.immixMonitoringStationId
                } = connection;
                return new Promise((resolve, reject) => {
                    Session.connection = connection;
                    Config.immixSettings.immixURI = immixUri;
                    Config.immixSettings.username = username;
                    Config.immixSettings.password = password;
                    Config.immixSettings.immixMonitoringStationId = stationId;
                    isHTTPS = Config.immixSettings.useHttps;
                    proxyServer.start(globalThis.immixFrameworkInstance).then(status => {
                        resolve(status);
                    }).catch(status => {
                        reject(status.error);
                        if (Session.isAuthorized)
                            Session.close();
                    });
                })
            }

            /**
             * @deprecated Use .open() instead
             * @returns {Promise<{status: (Boolean), error: (String)}>} 
             * 
            */
            static openWithOptions(immixUri, username, password, options = { https: true, stationId: 1, puppeteerRetryAttempts: 3, proxyPort: 3000, proxyAPIEndpoint: "/proxy/v1/", proxyEndpoint: "/proxy/endpoints/", puppeteerHeadless: true, useLogs: false }) {
                console.warn("Warning: openWithOptions() is deprecated. Use open() instead");
                return new Promise((resolve) => {
                    Config.immixSettings.immixURI = immixUri;
                    Config.immixSettings.username = username;
                    Config.immixSettings.password = password;

                    //options
                    Config.immixSettings.useHttps = options.https;
                    Config.immixSettings.immixMonitoringStationId = options.stationId;
                    Config.immixSettings.puppeteerRetryAttempts = options.puppeteerRetryAttempts;
                    Config.proxySettings.port = options.proxyPort;
                    Config.proxySettings.proxyAPI = options.proxyAPIEndpoint;
                    Config.proxySettings.proxyEndpoint = options.proxyEndpoint;
                    Config.debug.puppeteerHeadless = options.puppeteerHeadless;
                    Config.debug.useLogs = options.useLogs;
                    isHTTPS = options.https;

                    proxyServer.start(globalThis.immixFrameworkInstance).then(status => {
                        resolve(status);
                    }).catch(status => {
                        reject(status.error);
                        if (Session.isAuthorized)
                            Session.close();
                    });
                })
            }

            /**
             * Reloads the current Immix session, gets new authorization
             */
            static reload(renewAuditAuth = false) {
                return new Promise((resolve, reject) => {
                    Session.close(() => {
                        Session.getAuditAuth = renewAuditAuth;
                        Session.open(Session.connection).then(() => resolve()).catch(error => reject(error));
                    });
                    globalThis.immixFrameworkInstance.Debug.log('[FRAMEWORK] Reloading Immix');
                });
            }
        }


        //fetchers
        const https = require('https');
        const http = require('http');



        /**
         * Fetches a path from the Immix host using the session cookie
         * @param {String} path 
         * @param {() => {}} callback 
         */
        function fetchFromImmix(path, callback) {
            if (!Session.isAuthorized) {
                console.error("[fetchFromImmix] " + errors.notAuthorized);
                return;
            }

            var options = {
                hostname: Config.immixSettings.immixURI,
                path: path,
                method: 'GET',
                headers: {
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed',
                    'Connection': 'keep-alive',
                    'Cache-Control': "max-age=0",
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
                    'Cookie': Session.sessionCookie,  // Include the cookie in the request
                },
            };

            if (Config.immixSettings.useHttps) {
                var fetcher = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        callback(data)
                    });
                });
                fetcher.on('error', (err) => {
                    console.error('[ImmixFramework@fetchFromImmix] Fetch error:', err);
                });
                fetcher.end();
            } else {
                var fetcher = http.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => {
                        data += chunk;
                    });
                    res.on('end', () => {
                        callback(data)
                    });
                });
                fetcher.on('error', (err) => {
                    console.error('[ImmixFramework@fetchFromImmix] Fetch error:', err);
                });
                fetcher.end();
            }
        }


        /**
         * List of framework endpoints
         */
        const endpointsList = [
            proxiedBasicAuthorization,
            sites,
            eventQueue,
            users,
            audit
        ]


        /**
         * JSON of framework endpoints
         */
        const endpoints = {
            basicAuth: proxiedBasicAuthorization,
            sites,
            eventQueue,
            users,
            audit
        }

        class Utils {
            static async puppetWithRetry(puppetOperation, delay = 1500) {
                var maxRetries = Config.immixSettings.puppeteerRetryAttempts;
                let attempt = 0;
                while (attempt < maxRetries) {
                    try {
                        return await puppetOperation();
                    } catch (error) {
                        attempt++;
                        if (attempt === maxRetries) {
                            throw new Error(`Operation failed after ${maxRetries} retries: ${error.message}`);
                        }
                        globalThis.immixFrameworkInstance.Debug.log(`Attempt ${attempt} failed. Retrying in ${delay} ms...`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                        delay *= 2;
                    }
                }
            }
        }


        class Users {

            /**
             * Search for a user by name
             * @param {String} name
             * @returns {Promise<[{"UserID": (Number), "ServerID": (Number), "Fullname": (String), "ExternalID": (String), "Telephone": (String), "Mobile": (String), "Email": (String)}]>} Found users as a JSON array
             */
            static searchForUserByName(name) {
                return new Promise((resolve, reject) => {
                    endpoints.users.searchByName(name, (found) => {
                        if (!found.success) reject(new Error(found.error))
                        resolve(found.users);
                    })
                });
            }

            /**
            * Gets all usernames on Immix. *This uses Puppeteer and is slow*
            * @returns {Promise<[{username: (String)}]>} All users as a JSON array
            */
            static getAllUsernames() {
                return new Promise((resolve) => {
                    endpoints.users.getAllNames((users) => {
                        resolve(users);
                    })
                });
            }

            /**
            * Gets a user and their respective info on Immix. *This uses Puppeteer and is slow*
            * @ **Will try and find the closest user fullname to the fullname provided - if not the exact user fullname**
            * @param {String} name The aprox. name of the user
            * @returns {Promise<{username: (String),fullName: (String),pageOnLogon: (String),email: (String),address: (String),telephone: (String),timeZone: (String),doesReceiveIncidentNoti: (Boolean),doesReceiveSiteUpdateNoti: (Boolean),isMaintainer: (Boolean),isStaff: (Boolean),doesReceiveDisarmNoti: (Boolean),isAdmin: (Boolean),isDisabled: (Boolean)}>} User and their info as JSON
            * @ This is a large operation. It will retry a set ammount of times (Config...puppeteerRetryAttempts) if failed.
            */
            static getUserInfo(name) {
                return new Promise((resolve, reject) => {
                    endpoints.users.getUserInfo(name, (user) => {
                        if (!user.success) return reject(new Error(user.error));
                        resolve(user.info);
                    })
                });
            }
        }

        /**
         * All things to do with Sites for Immix
         */
        class Sites {

            /**
             * Gets all the sites on Immix
             * @returns {Promise<[{armed: (Boolean), groupid: (Number), groupTypeId: (Number), isdisabled : (Boolean), title: (String)}]>} Sites as an array
             */
            static getSites() {
                return new Promise((resolve) => {
                    endpoints.sites.getSites((sites) => {
                        resolve(sites);
                    })
                });
            }
        }

        /**
         * All things to do with Events for Immix
         */
        class Events {

            /**
            * Gets the whole event queue JSON from Immix
            * @param {() => {()}} callback
            * @returns {Promise<{}>} JSON of all queues and settings
            */
            static getWholeEventQueue() {
                return new Promise((resolve) => {
                    endpoints.eventQueue.getWholeEventQueue((wholeEvents) => {
                        resolve(wholeEvents);
                    })
                });
            }

            /**
            * Gets the event queue from Immix
            * @param {() => {()}} callback
            * @returns {Promise<{}>} JSON of all events
            */
            static getEventQueue() {
                return new Promise((resolve) => {
                    endpoints.eventQueue.getEventQueue((wholeEvents) => {
                        resolve(wholeEvents);
                    })
                });
            }

            /**
            * Gets the system event queue from Immix
            * @param {() => {()}} callback
            * @returns {Promise<{}>} JSON of all system events
            */
            static getSystemEventQueue() {
                return new Promise((resolve) => {
                    endpoints.eventQueue.getSystemEventQueue((wholeEvents) => {
                        resolve(wholeEvents);
                    })
                });
            }
        }


        /**
         * All things to do with Auditing for Immix
         */
        class Audit {

            /**
             * Gets all the media on Immix for an event
             * @returns {Promise<[]>} media as an array
             */
            static getMediaFromEventID(eventId) {
                return new Promise((resolve, reject) => {
                    endpoints.audit.getMediaForEventID(eventId, (media) => {
                        if (!media.success) reject(new Error(media.error))
                        resolve(media.media);
                    })
                });
            }
        }

        /**
         * All things to do with the Proxy for the ImmixFramework
         */
        class Proxy {

            /**
             * Trys a logon with immix via the proxy
             * @returns {Promise<{valid: (Boolean), error: (String)}>}
             */
            static tryLogon(username, password) {
                return new Promise((resolve, reject) => {
                    proxyServer.proxyTryImmixLogon(username, password, (valid, error) => {
                        if (error) return reject(new Error(error))
                        resolve({ valid, error });
                    })
                });
            }
        }


        return {
            endpoints,
            endpointsList,
            proxyServer,
            fetchFromImmix,
            fullImmixURI,
            Config,
            Debug,
            Utils,
            Session,
            Sites,
            Events,
            Users,
            Audit,
            Proxy
        }
    })()
    global.immixFrameworkInstance = framework;

    return framework;
}

class Errors {
    static notAuthorized = "ImmixFramework is not authorized"; //tag is appended by each low level module
    static immixNotStarted = "[ImmixFramework] the framework has not been started, cannot complete request";
    static authFailed = "[ImmixFramework@Proxy] unable to authorize with immix - Invalid logon? Audit Site stuck on Site Check?";
    static invalidURI = "[ImmixFramework@Proxy] invalid Immix URI provided";
    static cannotClosePuppeteerPage = "[ImmixFramework@Puppeteer] unable to close puppeteer page";
    static puppeteerInvalidStatus = "[ImmixFramework@Puppeteer] status not 200";
    static puppeteerError = "Puppeteer encountered an error";
    static auditError = "[ImmixFramework@getMediaForEventID] An error occured while contacting the Audit API. Please try again";
}

immixFramework.Errors = Errors;

immixFramework.Version = require('./package.json').version;
module.exports = immixFramework;


