# Network connections

A browser built on Firefox contacts some services on its own. For a privacy browser every one of these has to be known, then kept, replaced or removed. This list is the starting point. It is filled in from a real audit of the first build (run it behind a logging proxy on a fresh profile and record every host).

| Connection | Purpose | Plan |
| --- | --- | --- |
| Google Search | The only search engine | Kept, by request. Google sees searches. Suggestions are off by default so keystrokes are not sent |
| Google Safe Browsing | Warns about dangerous sites | Kept for safety. Uses hash prefixes, not full addresses |
| Mozilla add-ons service | Installing and updating add-ons | Kept for now, to be reviewed |
| Mozilla settings service (Remote Settings) | Blocklists, search configuration, certificate data | To be reviewed. Some data is needed for security |
| Captive portal check | Detects Wi-Fi login pages | Off |
| Telemetry, studies, experiments | Usage reporting | Off. Not compiled in because Glyde is not an official Mozilla build |
| Sponsored suggestions and new tab content | Adverts | Off |
| Location service | Approximate location for websites | Off |
| Firefox update service | Automatic updates | Off. Glyde has no update server of its own |
| Glyde update check (GitHub releases API) | Tells the person a newer Glyde exists, with a download link | On by default, once a day at most, no personal data sent beyond what any web request reveals (IP address). Switch off on the home page |

Rule: nothing is added to the browser that contacts a server before this table says what it is for.
