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
function getMediaForEventID(eventId, callback) {
    if (!immixFramework) return console.error(IMMIX.Errors.immixNotStarted + ` : getMediaFromEventID(${eventId})`);

    if (!immixFramework.Session.isAuthorized || !immixFramework.Session.auditAuth) {
        console.error("[ImmixFramework@getMediaForEventID] " + IMMIX.Errors.notAuthorized + " AuditAuth(REQ): " + immixFramework.Session.auditAuth);
        return;
    }
    var media = [];

    //get all alarms for that event id
    immixFramework.fetchFromImmix(`/ajax/EventRecordsGet.ashx?Action=GetSiteMonitorAlarms&EventId=${eventId}`, data => {
        var alarms;
        (async () => {
            try {
                try {
                    JSON.parse(data);
                } catch {
                    console.error(IMMIX.Errors.auditError + ` : getMediaFromEventID(${eventId}) @ eventrecordsget tryparse 1 `, data);
                    callback({ success: false, error: undefined, media: undefined });
                    return;
                }

                alarms = JSON.parse(data);
                const fetchPromises = alarms.map(alarm => {
                    return new Promise(resolve => {
                        immixFramework.fetchFromImmix(
                            `/audit/getmedialist?eventrecord=${alarm.eventRecordId}&auth=${immixFramework.Session.auditAuth}`,
                            data => {
                                try {
                                    JSON.parse(data)
                                } catch {
                                    console.error(IMMIX.Errors.auditError + ` : getMediaFromEventID(${eventId}) @ getmedialist tryparse 2 `, data, alarm.eventRecordId, immixFramework.Session.auditAuth);
                                    callback({ success: false, error: undefined, media: undefined });
                                    return;
                                }
                                var mediaObj = JSON.parse(data);
                                var pre = mediaObj.filter(media => media.MediaType === "PreAlarm Attached");
                                var post = mediaObj.filter(media => media.MediaType === "PostAlarm");
                                mediaObj.preMediaDownload = 'Not Found';
                                mediaObj.postMediaDownload = 'Not Found';

                                if (pre[0]) {
                                    mediaObj.preDownloadQuery = `?eventrecord=${alarm.eventRecordId}&fileid=${pre[0].FileIdentifier}&auth=${immixFramework.Session.auditAuth}`
                                    mediaObj.preMediaDownload = immixFramework.fullImmixURI() + `/audit/getdata?eventrecord=${alarm.eventRecordId}&fileid=${pre[0].FileIdentifier}&auth=${immixFramework.Session.auditAuth}`
                                }

                                if (post[0]) {
                                    mediaObj.postDownloadQuery = `?eventrecord=${alarm.eventRecordId}&fileid=${post[0].FileIdentifier}&auth=${immixFramework.Session.auditAuth}`;
                                    mediaObj.postMediaDownload = immixFramework.fullImmixURI() + `/audit/getdata?eventrecord=${alarm.eventRecordId}&fileid=${post[0].FileIdentifier}&auth=${immixFramework.Session.auditAuth}`
                                }

                                media.push(mediaObj);
                                resolve();
                            }
                        );
                    });
                });
                
                Promise.all(fetchPromises).then(() => {
                    callback({ success: true, error: undefined, media: media })
                });
            } catch {
                callback({ success: false, error: "Immix declined the audit authentication provided" })
            }
        })()


    })
}



module.exports = {
    getMediaForEventID,
    setDefaults
}
