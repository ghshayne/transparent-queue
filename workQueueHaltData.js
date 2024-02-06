(function() {
    "use strict";

    class WorkQueueHaltData {
        static HALT_REASONS = {
            CALLBACKRETVAL: 'Callback returned false or HALT',
            ERRORCALLBACKERROR: 'Error callback generated an error',
            PROCESSRETVAL: 'Item processor returned false',
            INTERNAL: 'Internal error'
        };

        constructor(parameters) {
            this.reason = parameters.reason;
            this.error = parameters.error;
            this.callback = parameters.callback;
        }
    }

    module.exports = WorkQueueHaltData;
}) ()
