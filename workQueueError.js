(function() {
    "use strict";

    class WorkQueueError extends Error {
        static ERROR_SOURCES = {
            CALLBACK: 'ERROR_SOURCE_CALLBACK',
            PROCESS: 'ERROR_SOURCE_PROCESS',
            INTERNAL: 'ERROR_SOURCE_INTERNAL',
            BADREQUEST: 'ERROR_SOURCE_BADREQUEST'
        };

        constructor(message, source) {
            super(message);

            // if not specified, default the error source to INTERNAL
            if (undefined === source) {
                this.source = WorkQueueError.ERROR_SOURCES.INTERNAL;
            }
            else {
                this.source = source;
            }
        }
    }

    module.exports = WorkQueueError;
}) ()
