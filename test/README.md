**Edit config to your needs.**



*--results* (shows results of calls)

*--intlogs* (logs all internal logs)

*--doaudit* (does audit media test)

*--stationswitch* (does station switch)



(quick test, still requires conf edit)

*--username=(username)*

*--password=(pass)*

*--uri=(immix uri)*


CONFIG:

"immixStationConfigOne": {

    "username": "", *-username for switch 1*

    "password": "", *-password for switch 1*

    "stationId": 1 *-stationId to switch to*

},

"immixStationConfigTwo": {

    "username": "", *-username for switch 2*

    "password": "",*-password for switch 2*

    "stationId": 2 *-stationId to switch to*

},

"immixConfig": {

    "username": "", *-can be set with param*

    "password": "", *-can be set with param*

    "immixUri": "", -*can be set with param*

    "stationId": 1, *-station to connect to for test*

    "searchForUser": "", *-user to search for (canont be username, must be part of user fullname)*

    "mediaEventID": 0 *-if auditing, event id to get the media from*

}

