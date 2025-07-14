const IMMIX = require('../immixFramework');
const puppeteer = require('puppeteer');
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
function searchByName(name, callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : searchForUserByName(${name})`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@searchByName] " + IMMIX.Errors.notAuthorized);
        return;
    }

    immixFramework.fetchFromImmix('/ajax/UserSearchByName.ashx?SearchTerm=' + name, data => {
        var users = JSON.parse(data);
        if (users.length != 0) 
            callback({ success: true, users: users });
        else 
            callback({ success: false, error: "No user found" });

    })
}

//lower-level get
function getAllNames(callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getAllUsernames()`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@getAllNames] " + IMMIX.Errors.notAuthorized);
        return;
    }
    (async () => {
        const browser = await puppeteer.launch({ headless: immixFramework.Config.debug.puppeteerHeadless, executablePath: immixFramework.Config.puppeteerExecutablePath });
        const page = await browser.newPage();

        try {
            await page.setCookie(immixFramework.Session.puppeteerSessionCookie);

            //navigate setup to users
            await page.goto(immixFramework.fullImmixURI() + '/SetupManager/default.aspx', { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.btn-edit-icon');
            immixFramework.Debug.log("[getAllNames] Navigated to setup");
            await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('.btn-edit-icon'));
                const button = buttons.find(btn => btn.textContent.trim() === 'Edit Users');
                button.click();
            });

            await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
            immixFramework.Debug.log("[getAllNames] Navigated to edit users");
            await new Promise(resolve => setTimeout(resolve, immixFramework.Config.proxySettings.proxyReqDelay));

            //site tree picker
            await page.waitForSelector('#siteTree', { visible: true, timeout: 10000 });
            await page.click('.station[id="' + immixFramework.Config.immixSettings.immixMonitoringStationId + '"]');
            await page.evaluate(() => {
                updateSiteClick();
            });

            await new Promise(resolve => setTimeout(resolve, immixFramework.Config.proxySettings.proxyReqDelay));


            await page.click('a#MainContent_MainContent_wizEditUser_StartNavigationTemplateContainerID_StepNextButton');

            //users list
            await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
            immixFramework.Debug.log("[getAllNames] Navigated to user list");

            //fetch users from list
            const users = await page.$eval('#MainContent_MainContent_wizEditUser_lbxUsers', selector => {
                return Array.from(selector.options).map(users => ({
                    username: users.text.trim(),
                }));
            });
            immixFramework.Debug.log("[getAllNames] Success");
            callback(users)
            await browser.close();
        }
        catch (err) {
            console.error("[ImmixFramework@getAllNames] Error: ", err);
        }
    })();
}

//lower-level get
function getUserInfo(findName, callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getUserInfo(${findName})`);

    if (!immixFramework.Session.isAuthorized) {
        console.error("[ImmixFramework@getUserInfo] " + IMMIX.Errors.notAuthorized);
        return;
    }

    searchByName(findName, (found) => {
        if (!found.success) return callback({ success: false, error: `Couldnt find user by name of ${findName}`});
        
        //go with closest name, if not exact
        var name = found.users[0].Fullname;
        immixFramework.Utils.puppetWithRetry(async () => {
            const browser = await puppeteer.launch({ headless: immixFramework.Config.debug.puppeteerHeadless, executablePath: immixFramework.Config.puppeteerExecutablePath });
            const page = await browser.newPage();

            try {
                await page.setCookie(immixFramework.Session.puppeteerSessionCookie);

                //navigate setup to users
                await page.goto(immixFramework.fullImmixURI() + '/SetupManager/default.aspx', { waitUntil: 'domcontentloaded' });
                
                immixFramework.Debug.log("[searchByName] Navigated to setup");
                await page.waitForSelector('.btn-edit-icon');
                await page.evaluate(() => {
                    const buttons = Array.from(document.querySelectorAll('.btn-edit-icon'));
                    const button = buttons.find(btn => btn.textContent.trim() === 'Edit Users');
                    button.click();
                });

                await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
                immixFramework.Debug.log("[searchByName] Navigated to edit users");

                //site tree picker
                await page.waitForSelector('#siteTree', { visible: true, timeout: 10000 });
                await page.click('.station[id="' + immixFramework.Config.immixSettings.immixMonitoringStationId + '"]');
                await page.evaluate(() => {
                    updateSiteClick();
                });
                await page.click('a#MainContent_MainContent_wizEditUser_StartNavigationTemplateContainerID_StepNextButton');

                //users list
                await page.waitForSelector('#MainContent_MainContent_wizEditUser_lbxUsers', { visible: true, timeout: 10000 });
                immixFramework.Debug.log("[searchByName] Navigated to user list");

                //get all users
                const users = await page.$eval('#MainContent_MainContent_wizEditUser_lbxUsers', selector => {
                    return Array.from(selector.options).map(users => ({
                        name: users.text.trim(),
                        selector: users.value
                    }));
                });
                await page.select('#MainContent_MainContent_wizEditUser_lbxUsers', users.find(u => u.name == name).selector);
                await page.click('#StepNextButton');
                await page.waitForNavigation({ waitUntil: 'domcontentloaded' })
                const fullName = await page.$eval('#MainContent_MainContent_wizEditUser_txtFullName', el => el.value);
                const username = await page.$eval('#MainContent_MainContent_wizEditUser_txtUserName', el => el.value);
                immixFramework.Debug.log("[searchByName] Navigated to user setup for " + username);
                const pageOnLogon = await page.$eval('#MainContent_MainContent_wizEditUser_ddlDefaultTab', el => el.value);
                const email = await page.$eval('#MainContent_MainContent_wizEditUser_txtEmail', el => el.value);
                const address = await page.$eval('#MainContent_MainContent_wizEditUser_txtAddress', el => el.value);
                const telephone = await page.$eval('#MainContent_MainContent_wizEditUser_txtPhone1', el => el.value);
                const timeZoneSlot = await page.$eval('#MainContent_MainContent_wizEditUser_ddlTimeZone', el => el.value);
                const timeZone = await page.$eval(
                    '#MainContent_MainContent_wizEditUser_ddlTimeZone',
                    (select, value) => {
                        const option = Array.from(select.options).find(opt => opt.value === value);
                        return option ? option.textContent.trim() : null;
                    },
                    timeZoneSlot
                );
                const doesReceiveIncidentNoti = await page.$eval('#MainContent_MainContent_wizEditUser_cbxReceiveIncident', el => el.parentElement.classList.contains('checked') ? true : false);
                const doesReceiveSiteUpdateNoti = await page.$eval('#MainContent_MainContent_wizEditUser_cbxReceiveUpdate', el => el.parentElement.classList.contains('checked') ? true : false);
                const isMaintainer = await page.$eval('#MainContent_MainContent_wizEditUser_cbxIsMaintainer', el => el.parentElement.classList.contains('checked') ? true : false);
                const isStaff = await page.$eval('#MainContent_MainContent_wizEditUser_cbxIsSiteStaff', el => el.parentElement.classList.contains('checked') ? true : false);
                const doesReceiveDisarmNoti = await page.$eval('#MainContent_MainContent_wizEditUser_cbxArmDisarmNotifications', el => el.parentElement.classList.contains('checked') ? true : false);
                const isAdmin = await page.$eval('#MainContent_MainContent_wizEditUser_cbxIsSysAdmin', el => el.parentElement.classList.contains('checked') ? true : false);
                const isDisabled = await page.$eval('#cbxDisableUser', el => el.parentElement.classList.contains('checked') ? true : false);
                const accountInformation = {
                    username: username,
                    fullName: fullName,
                    pageOnLogon: pageOnLogon,
                    email: email,
                    address: address,
                    telephone: telephone,
                    timeZone: timeZone,
                    doesReceiveIncidentNoti: doesReceiveIncidentNoti,
                    doesReceiveSiteUpdateNoti: doesReceiveSiteUpdateNoti,
                    isMaintainer: isMaintainer,
                    isStaff: isStaff,
                    doesReceiveDisarmNoti: doesReceiveDisarmNoti,
                    isAdmin: isAdmin,
                    isDisabled: isDisabled

                }
                immixFramework.Debug.log("[searchByName] Success");
                callback({ success: true, error: undefined, info: accountInformation});
                await browser.close();
            }
            catch (err) {
                callback({ success: false, error: err });
            }
        });
    })
}


module.exports = {
    getAllNames,
    getUserInfo,
    searchByName,
    setDefaults
}