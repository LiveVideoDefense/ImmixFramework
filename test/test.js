#!/usr/bin/env node
const logFileName = genLogName();
console.log('\x1b[38;2;255;165;0m%s\x1b[0m', 'Running ImmixFramework test...');
const fs = require('fs');
const config = require('./testconf.json');

if (!fs.existsSync('./test/logs/'))
    fs.mkdirSync('./test/logs/');


const logStream = fs.createWriteStream("./test/logs/" + logFileName, { flags: 'a' });
const log = console.log;
const err = console.log;

console.log = (...args) => {
    const msg = `${args.join(' ')}\n`;
    logStream.write(msg);
    log(...args);
};

console.error = (...args) => {
    const msg = `\x1b[31m[ERROR]\x1b[0m ${args.join(' ')}\n`;
    logStream.write(msg);
    err(msg);
};

const args = process.argv.slice(2);
const params = {};

args.forEach(arg => {
    const [key, val] = arg.split('=');
    if (key && val) {
        params[key.replace(/^--/, '')] = val;
    }
});

config.immixConfig.username = params.username ? params.username : config.immixConfig.username ? config.immixConfig.username : "NOT_PROVIDED";
config.immixConfig.password = params.password  ? params.password : config.immixConfig.password ? config.immixConfig.password : "NOT_PROVIDED";
config.immixConfig.immixUri = params.uri ? params.uri : config.immixConfig.immixUri ? config.immixConfig.immixUri : "NOT_PROVIDED";
const showResults = args.includes('--results');
const useInternalLogs = args.includes('--intlogs');
const doAudit = args.includes('--doaudit');
const doStationSwitch = args.includes('--stationswitch');

console.log('\x1b[32m%s\x1b[0m', `\nShowResults: ${showResults}\nLogs: ${useInternalLogs}\nAudits: ${doAudit}\nStationSwitch: ${doStationSwitch}\nUsername: ${config.immixConfig.username}\nPassword: ${config.immixConfig.password.replaceAll(/./g, '*')}\nURI: ${config.immixConfig.immixUri}\n`)

const IMMIX = require('../immixFramework')();




IMMIX.Config.immixSettings.auditAuthSite = 'FrameworkAccess';
IMMIX.Config.debug.useLogs = useInternalLogs;
IMMIX.Config.proxySettings.port = 3001;
if (doAudit)
    IMMIX.Session.getAuditAuth = true;


(async () => {
    try {
        await IMMIX.Session.open(config.immixConfig);
        await testAllAsync(showResults);
    } catch (error) {
        console.error(error);
        console.log('\x1b[32m%s\x1b[0m', '\n\nLog piped to ./logs/' + logFileName)
        process.exit(1);
    }
})()

/*
Running the framework syncronously is not recommended and may produce errors.
This test is no longer used, and we no longer encourge heavy usage of the framework this way.
*/
function testAllSync(doInvalids = true) {

    //valid logon
    IMMIX.Proxy.tryLogon('', '').then(() => {
    }).catch(error => {
        console.error(error);
    });

    //invalid logon
    if (doInvalids)
        IMMIX.Proxy.tryLogon('', '').then(() => {
        }).catch(error => {
            console.error(error);
        });

    //valid
    if (doAudit)
        IMMIX.Audit.getMediaFromEventID().then(medias => {
            console.log("Fetched audit media: ", medias);
        }).catch(error => {
            console.error(error);
        });


    //invalid
    if (doInvalids && doAudit)
        IMMIX.Audit.getMediaFromEventID(0).then(medias => {
            console.log("Fetched audit media: ", medias);
        }).catch(error => {
            console.error(error);
        });


    IMMIX.Events.getWholeEventQueue().then(queue => {
        console.log("Feteched whole queue ", queue);
    })

    IMMIX.Events.getEventQueue().then(queue => {
        console.log("Feteched queue ", queue);
    })

    IMMIX.Events.getSystemEventQueue().then(queue => {
        console.log("Feteched system queue ", queue);
    })

    IMMIX.Sites.getSites().then(sites => {
        console.log("Feteched sites ", sites);
    })

    //valid
    IMMIX.Users.searchForUserByName("").then(user => {
        console.log("Feteched user ", user);
    }).catch(error => {
        console.error(error);
    });

    //invalid
    if (doInvalids)
        IMMIX.Users.searchForUserByName("").then(user => {
            console.log("Feteched user ", user);
        }).catch(error => {
            console.error(error);
        });

    IMMIX.Users.getAllUsernames().then(users => {
        console.log("Feteched users ", users);
    })

    //valid
    IMMIX.Users.getUserInfo("").then(user => {
        console.log("Feteched user info ", user)
    }).catch(error => {
        console.error(error);
    });

    //invalid
    if (doInvalids)
        IMMIX.Users.getUserInfo("").then(user => {
            console.log("Feteched user info ", user)
        }).catch(error => {
            console.error(error);
        });
}

//recomended
async function testAllAsync(showResults) {

    try {
        await testProxy(false, showResults);

        if (doAudit)
            await testAudit(false, showResults);

        await testEvents(showResults);

        await testSites(showResults);

        await testUsers(false, showResults);

        if (doStationSwitch)
            await testStationSwitch(false);

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));
        console.error(error);
    } finally {
        console.log('\x1b[32m%s\x1b[0m', 'ALL_TESTS_COMPLETED');
        console.log('\x1b[32m%s\x1b[0m', '\n\nLog piped to ./logs/' + logFileName)
    }

}

//only works on testing immix - aiden (async)
async function testStationSwitch(doInvalid = true) {
    //example of switch stations
    try {
        await IMMIX.Session.switchToStation(config.immixStationConfigOne);
        await IMMIX.Users.getAllUsernames(); //make a request to station to test results
        console.log(stamp() + "Station 1 Test Valid:  ", "\x1b[32mTEST_COMPLETED\x1b[0m")

        await IMMIX.Session.switchToStation(config.immixStationConfigTwo);
        await IMMIX.Users.getAllUsernames(); //make a request to station to test results
        console.log(stamp() + "Station 2 Test Valid:  ", "\x1b[32mTEST_COMPLETED\x1b[0m")

        //invalid
        if (doInvalid) {
            await IMMIX.Session.switchToStation({ username: "test", password: "test", stationId: 0 });
        }

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));
        console.error(error);
    }
}

async function testProxy(doInvalid = true, showResults = true) {
    try {
        //valid
        const logonTestValid = await IMMIX.Proxy.tryLogon(config.immixConfig.username, config.immixConfig.password);
        console.log(stamp() + "Logon Test Valid: ", (showResults ? logonTestValid.valid : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        //invalid
        const logonTestInvalid = doInvalid ? await IMMIX.Proxy.tryLogon('test', 'test') : "TEST_OMITTED";
        console.log(stamp() + "Logon Test Invalid: ", (showResults && logonTestInvalid.valid !== undefined ? logonTestInvalid.valid : "\x1b[32mTEST_COMPLETED\x1b[0m"))

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));

        console.error(error);
    }
}

async function testAudit(doInvalid = true, showResults = true) {
    try {
        //valid
        const validMediasTest = await IMMIX.Audit.getMediaFromEventID(config.immixConfig.mediaEventID);
        console.log(stamp() + "Audit Media Valid: ", (showResults ? validMediasTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        //invalid
        const invalidMediasTest = doInvalid ? await IMMIX.Audit.getMediaFromEventID(0) : "TEST_OMITTED";
        console.log(stamp() + "Audit Media Invalid: ", (showResults ? invalidMediasTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));

        console.error(error);
    }
}

async function testEvents(showResults = true) {
    try {
        const eventWholeQueueTest = await IMMIX.Events.getWholeEventQueue();
        console.log(stamp() + "Whole Event Queue: ", (showResults ? eventWholeQueueTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        const eventQueueTest = await IMMIX.Events.getEventQueue();
        console.log(stamp() + "Event Queue: ", (showResults ? eventQueueTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        const systemEventQueueTest = await IMMIX.Events.getSystemEventQueue();
        console.log(stamp() + "System Event Queue: ", (showResults ? systemEventQueueTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));

        console.error(error);
    }
}

async function testSites(showResults = true) {
    try {
        const allSitesTest = await IMMIX.Sites.getSites();
        console.log(stamp() + "All Sites: ", (showResults ? allSitesTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));

        console.error(error);
    }
}

async function testUsers(doInvalid = true, showResults = true) {
    try {
        //valid
        const searchUserTestValid = await IMMIX.Users.searchForUserByName(config.immixConfig.searchForUser);
        console.log(stamp() + "Search Users Valid: ", (showResults ? searchUserTestValid : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        //invalid
        const searchUserTestInalid = doInvalid ? await IMMIX.Users.searchForUserByName("jack") : "TEST_OMITTED";
        console.log(stamp() + "Search Users Invalid: ", (showResults ? searchUserTestInalid : "\x1b[32mTEST_COMPLETED\x1b[0m"))


        const allUsernamesTest = await IMMIX.Users.getAllUsernames();
        console.log(stamp() + "All Usernames: ", (showResults ? allUsernamesTest : "\x1b[32mTEST_COMPLETED\x1b[0m"))


        //valid
        const userInfoTestValid = await IMMIX.Users.getUserInfo(config.immixConfig.searchForUser);
        console.log(stamp() + "User Info Test Valid: ", (showResults ? userInfoTestValid : "\x1b[32mTEST_COMPLETED\x1b[0m"))

        //invalid
        const userInfoTestInvalid = doInvalid ? await IMMIX.Users.getUserInfo("jack") : "TEST_OMITTED";
        console.log(stamp() + "User Info Test Invalid: ", (showResults ? userInfoTestInvalid : "\x1b[32mTEST_COMPLETED\x1b[0m"))

    } catch (error) {
        IMMIX.Session.close(() => process.exit(1));

        console.error(error);
    }
}



function stamp() {
    const now = new Date();

    const pad = (n) => n.toString().padStart(2, '0');

    const yy = pad(now.getFullYear() % 100);
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());

    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    return `[${yy}/${mm}/${dd}|${hh}:${min}:${ss}] `;
}

function genLogName() {
    const now = new Date();

    const pad = (n) => n.toString().padStart(2, '0');

    const yyyy = now.getFullYear();
    const mm = pad(now.getMonth() + 1);
    const dd = pad(now.getDate());
    const hh = pad(now.getHours());
    const min = pad(now.getMinutes());
    const ss = pad(now.getSeconds());

    return `test_log-${yyyy}-${mm}-${dd}T${hh}-${min}-${ss}.log`;
}