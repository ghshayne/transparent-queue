(function() {
    "use strict";

    const WorkQueueError = require('./workQueueError');
    const WorkQueueHaltData = require('./workQueueHaltData');

    const DEFAULT_CONCURRENCY_LIMIT = 1;

    class WorkQueue {
        constructor(options) {
            let self = this;
            self._options = self._validateOptions(options);

            self._queue = [];
            self._inProgressCount = 0;
            self._callbacks = {};
            self._halted = false;
            self._paused = false;
        };

        static BEFORE_CALLBACK_VALS = {
            HALT: 'BEFORE_CALLBACK_VALS_HALT',
            CONTINUE: 'BEFORE_CALLBACK_VALS_CONTINUE',
            SKIP: 'BEFORE_CALLBACK_VALS_SKIP'
        };

        // re-expose enums from child modules, so that callers don't need to separately import those modules
        static ERROR_SOURCES = WorkQueueError.ERROR_SOURCES;
        static HALT_REASONS = WorkQueueHaltData.HALT_REASONS;

        // validate provided options values
        _validateOptions(options) {
            let self = this;

            //set options defaults, if not specified
            if (undefined === options || null === options) {
                options = {};
            }
            if (undefined === options.concurrencyLimit || null === options.concurrencyLimit) {
                options.concurrencyLimit = DEFAULT_CONCURRENCY_LIMIT;
            }

            // validate values
            if (isNaN(options.concurrencyLimit)) {
                throw new WorkQueueError("Invalid concurrency limit: must be numeric", WorkQueueError.ERROR_SOURCES.BADREQUEST);
            }
            if (1 > options.concurrencyLimit) {
                throw new WorkQueueError("Invalid concurrency limit: must be at least 1", WorkQueueError.ERROR_SOURCES.BADREQUEST);
            }

            // if specified, validate that processor is a function
            if (undefined !== options.processor && null !== options.processor) {
                if (typeof options.processor !== 'function') {
                    throw new WorkQueueError("Invalid processor: must be a function", WorkQueueError.ERROR_SOURCES.BADREQUEST);
                }
            }

            return options;
        }

        _halt(reason) {
            let self = this;
            return new Promise(function (resolve, reject) {
                // ignore if we're already in a halted state
                if (true === self._halted) {
                    resolve();
                    return;
                }

                // set a flag to indicate that we should not pull any more items from the queue
                self._halted = true;

                // then call the halted callback (if any)
                self._onHalted(reason).then(function () {
                    resolve();
                }).catch(function (err) {
                    // if the halted callback fails, notify the error handler
                    self._onError(err).then(function () {
                        resolve();
                    }).catch(function (err) {
                        // if the error handler that was called after a halted callback failure failed, give up
                        resolve();
                    }).then(function () {
                        resolve();
                    });
                });
            });
        }

        // add a handler callback
        on(trigger, callback) {
            let self = this;

            if (undefined === callback || null === callback) {
                throw new WorkQueueError("Invalid callback specified", WorkQueueError.ERROR_SOURCES.BADREQUEST);
            }

            // validate that callback is a function
            if (typeof callback !== 'function') {
                throw new WorkQueueError("Callback must be a function", WorkQueueError.ERROR_SOURCES.BADREQUEST);
            }

            if ('error' === trigger) {
                self._callbacks['error'] = callback;
            } else if ('halted' === trigger) {
                self._callbacks['halted'] = callback;
            } else if ('queueSizeChange' === trigger) {
                self._callbacks['queueSizeChange'] = callback;
            } else if ('queueEmpty' === trigger) {
                self._callbacks['queueEmpty'] = callback;
            } else if ('noWork' === trigger) {
                self._callbacks['noWork'] = callback;
            } else if ('itemProcessed' === trigger) {
                self._callbacks['itemProcessed'] = callback;
            } else if ('beforeItemProcessed' === trigger) {
                self._callbacks['beforeItemProcessed'] = callback;
            } else if ('paused' === trigger) {
                self._callbacks['paused'] = callback;
            } else if ('resumed' === trigger) {
                self._callbacks['resumed'] = callback;
            } else if ('afterHaltCompleted' === trigger) {
                self._callbacks['afterHaltCompleted'] = callback;
            } else if ('afterPauseCompleted' === trigger) {
                self._callbacks['afterPauseCompleted'] = callback;
            } else {
                throw new WorkQueueError("Invalid trigger specified", WorkQueueError.ERROR_SOURCES.BADREQUEST);
            }

            return self;
        }

        // process an error during execution
        _onError(err) {
            let self = this;
            return new Promise(function (resolve, reject) {
                if (undefined === self._callbacks['error'] || null === self._callbacks['error']) {
                    // if no error handler was specified, then nothing to do
                    resolve();
                    return;
                }

                // note that the error handler callback may be either:
                // a. a function that returns a true/false value, or
                // b. a function that returns a Promise that resolves to true/false

                // note: Promise.resolve(f()).catch(...) won't catch synchronous exceptions thrown by f() - so we need to do this the long way
                let callbackResult = null;
                try {
                    callbackResult = self._callbacks['error'](err);
                } catch (ex) {
                    // if the error-handler callback failed, halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.ERRORCALLBACKERROR,
                        callback: 'error',
                        error: ex
                    })).then(function () {
                        resolve();
                    }).catch(function (err) {
                        // the only reason the halt operation would fail is an internal error - bubble it up to the caller
                        reject(err);
                    });
                    return;
                }

                // if the error callback returned a Promise, wait for it to resolve (or reject) before proceeding
                Promise.resolve(callbackResult).then(function (errCallbackRetVal) {
                    // if the error handler returns false, halt processing more items from the queue
                    if (false === errCallbackRetVal) {
                        self._halt(new WorkQueueHaltData({
                            reason: WorkQueueHaltData.HALT_REASONS.CALLBACKRETVAL,
                            callback: 'error'
                        })).then(function () {
                            resolve();
                        }).catch(function (err) {
                            // the only reason the halt operation would fail is an internal error - bubble it up to the caller
                            reject(err);
                        });
                    } else {
                        resolve();
                    }
                }).catch(function (err) {
                    // if the error-handler callback failed, also halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.ERRORCALLBACKERROR,
                        callback: 'error',
                        error: err
                    })).then(function () {
                        resolve();
                    }).catch(function (err) {
                        // the only reason the halt operation would fail is an internal error - bubble it up to the caller
                        reject(err);
                    });
                });
            });
        }

        _onHalted(reason) {
            let self = this;
            return new Promise(function (resolve, reject) {
                if (undefined === self._callbacks['halted'] || null === self._callbacks['halted']) {
                    // if no halt handler was specified, then nothing to do
                    resolve();
                    return;
                }

                // note that the halt handler callback may be either:
                // a. a synchronous function, or
                // b. a function that returns a Promise

                // note: Promise.resolve(f()).catch(...) won't catch synchronous exceptions thrown by f()
                // of course, a synchronous exception thrown by the callback will trigger this outer Promise to be rejected
                // - but then we wouldn't be able to distinguish a callback exception vs an internal error
                // so we need to catch the exception (if any) here
                let callbackResult = null;
                try {
                    callbackResult = self._callbacks['halted'](reason);
                } catch (ex) {
                    // if the halted callback threw a synchronous exception, bubble it up to the caller as a Promise rejection
                    if (!(ex instanceof Error)) {
                        ex = new WorkQueueError(ex);
                    }
                    ex.source = WorkQueueError.ERROR_SOURCES.CALLBACK;
                    reject(ex);
                    return;
                }

                if (undefined !== callbackResult && null !== callbackResult && typeof callbackResult.then === 'function') {
                    // if the callback returned a Promise, wait for the Promise to resolve before proceeding
                    callbackResult.then(function () {
                        resolve();
                    }).catch(function (err) {
                        // if the halted callback resulted in a rejected Promise, bubble it up to the caller
                        if (!(err instanceof Error)) {
                            err = new WorkQueueError(err);
                        }
                        err.source = WorkQueueError.ERROR_SOURCES.CALLBACK;
                        reject(err);
                    });
                } else {
                    resolve();
                }
            });
        }

        _onQueueSizeChange() {
            let self = this;

            // if the queue size is now 0, also call the queueEmpty callback
            let queueSize = self.getQueueSize();

            let promises = [self._callHandler('queueSizeChange', queueSize)];
            if (0 === queueSize) {
                promises.push(self._callHandler('queueEmpty'));
            }
            return Promise.all(promises);
        }

        _onNoWork() {
            let self = this;
            return self._callHandler('noWork');
        }

        _onItemProcessed(processResult) {
            let self = this;
            return self._callHandler('itemProcessed', processResult);
        }

        _onBeforeItemProcessed() {
            let self = this;
            return self._callHandler('beforeItemProcessed');
        }

        _onPaused() {
            let self = this;
            return self._callHandler('paused');
        }

        _onResumed() {
            let self = this;
            return self._callHandler('resumed');
        }

        _onAfterHaltCompleted() {
            let self = this;
            return self._callHandler('afterHaltCompleted');
        }

        _onAfterPauseCompleted() {
            let self = this;
            return self._callHandler('afterPauseCompleted');
        }

        _callHandler(handlerName, parameter) {
            let self = this;
            return new Promise(function (resolve, reject) {
                let callback = self._callbacks[handlerName];
                if (undefined === callback || null === callback) {
                    // nothing to do
                    resolve();
                    return;
                }

                // call the callback
                // note that a callback may be either:
                // a. a synchronous function, or
                // b. a function that returns a Promise

                // note: Promise.resolve(f()).catch(...) won't catch synchronous exceptions thrown by f() - so we need to do this the long way
                let callbackResult = null;
                try {
                    callbackResult = callback(parameter);
                } catch (ex) {
                    // if the callback threw a synchronous exception, call the error handler (if any)
                    if (!(ex instanceof Error)) {
                        ex = new WorkQueueError(ex);
                    }
                    ex.source = WorkQueueError.ERROR_SOURCES.CALLBACK;
                    self._onError(ex).then(function () {
                        // note that _onError will trigger a halt if necessary - otherwise, continue as normal
                        resolve();
                    }).catch(function (err2) {
                        // if the error handler itself results in another error, bubble that error up to the caller
                        reject(err2);
                    });
                    return;
                }

                // if the callback returned a Promise, wait for the Promise to resolve (or reject) before proceeding
                Promise.resolve(callbackResult).then(function (callbackRetVal) {
                    // if a callback returns (or resolves to) false, halt (stop processing more items from the queue)
                    if (false === callbackRetVal || WorkQueue.BEFORE_CALLBACK_VALS.HALT === callbackRetVal) {
                        self._halt(new WorkQueueHaltData({
                            reason: WorkQueueHaltData.HALT_REASONS.CALLBACKRETVAL,
                            callback: handlerName
                        })).then(function () {
                            // some callbacks may return additional instructions - if so, pass that along to the caller
                            resolve(callbackRetVal);
                        }).catch(function (err) {
                            // the only reason the halt operation would fail is an internal error - bubble it up to the caller
                            reject(err);
                        });
                    } else {
                        // some callbacks may return additional instructions - if so, pass that along to the caller
                        resolve(callbackRetVal);
                    }
                }).catch(function (err) {
                    // if the callback resulted in a rejected Promise, call the error handler (if any)
                    if (!(err instanceof Error)) {
                        err = new WorkQueueError(err);
                    }
                    err.source = WorkQueueError.ERROR_SOURCES.CALLBACK;
                    self._onError(err).then(function () {
                        // note that _onError will trigger a halt if necessary - otherwise, continue as normal
                        resolve();
                    }).catch(function (err2) {
                        // if the error handler itself results in another error, bubble that error up to the caller
                        reject(err2);
                    });
                });
            });
        }

        // get the next function off of the queue & execute it to kick off the next Promise
        _retrieveNextPromise() {
            let self = this;
            return new Promise(function (resolve, reject) {
                // pop the next item off of the queue
                let nextItem = self._queue.shift();
                // an item is considered "in-progress" from the moment it comes off of the queue until after it has finished (or failed) processing
                self._inProgressCount++;

                // call the queue-size-changed callback (if any) before proceeding
                self._onQueueSizeChange().then(function () {
                    // call the beforeItemProcessed callback (if any) - after dequeueing, but before processing
                    // (i.e. before the enqueued function has been called)
                    self._onBeforeItemProcessed().then(function (beforeItemCallbackResult) {
                        // if the beforeItemProcessed callback specified halt or skip, don't process the next item
                        if (WorkQueue.BEFORE_CALLBACK_VALS.SKIP === beforeItemCallbackResult || WorkQueue.BEFORE_CALLBACK_VALS.HALT === beforeItemCallbackResult || false === beforeItemCallbackResult) {
                            resolve();
                        } else {
                            // launch the next enqueued item
                            let nextItemPromise = null;
                            try {
                                // each enqueued item may be a function or an object to be passed to the processor function
                                // if the item is a function, just call it
                                if (typeof nextItem === 'function') {
                                    try {
                                        nextItemPromise = nextItem();
                                    } catch (ex) {
                                        // if an item results in a synchronous exception, make sure to wrap it in an Error and specify the source
                                        if (!(ex instanceof Error)) {
                                            ex = new WorkQueueError(ex);
                                        }
                                        ex.source = WorkQueueError.ERROR_SOURCES.PROCESS;
                                        // bubble up the error to let the outer error-handler deal with it
                                        throw ex;
                                    }
                                } else {
                                    // if the item is not a function, pass it to the processor function and call that
                                    if (undefined === self._options.processor || null === self._options.processor) {
                                        throw new WorkQueueError("Enqueued item is not a function, and processor was not defined", WorkQueueError.ERROR_SOURCES.BADREQUEST);
                                    }
                                    try {
                                        nextItemPromise = self._options.processor(nextItem);
                                    } catch (ex) {
                                        if (!(ex instanceof Error)) {
                                            ex = new WorkQueueError(ex);
                                        }
                                        ex.source = WorkQueueError.ERROR_SOURCES.PROCESS;
                                        // bubble up the error to let the outer error-handler deal with it
                                        throw ex;
                                    }
                                }

                                // validate that nextItem() returned a Promise
                                if (undefined === nextItemPromise || null === nextItemPromise || typeof nextItemPromise.then !== 'function') {
                                    throw new WorkQueueError('Enqueued function did not return a Promise', WorkQueueError.ERROR_SOURCES.BADREQUEST);
                                }
                                // Note: what we're trying to do here is return a Promise object to the caller.
                                // Syntactically, however, passing a Promise to resolve() will be interpreted as an attempt to
                                // chain (i.e. resolve() will then resolve the Promise and return the result, rather than
                                // returning the Promise). So we'll need to wrap the Promise in another object first.
                                resolve({nextItemPromise: nextItemPromise});
                            } catch (ex) {
                                // if there was an error executing the enqueued function, trigger the error handler, but otherwise
                                // continue as normal
                                self._onError(ex).then(function () {
                                    resolve();
                                }).catch(function (err) {
                                    // if the error handler itself results in an error, bubble up the error to the caller
                                    reject(err);
                                });
                            }
                        }
                    }).catch(function (err) {
                        // if the beforeItemProcessed callback resulted in an error, bubble it up to the caller
                        reject(err);
                    });
                }).catch(function (err) {
                    // if the queue-size-change callback resulted in an error, bubble it up to the caller
                    reject(err);
                });
            });
        }

        // pull the next item from the queue & process it
        _processNextItem() {
            let self = this;
            return new Promise(function (resolve, reject) {
                // get the next function from the queue & execute it to retrieve the next Promise
                self._retrieveNextPromise().then(function (nextItemPromiseWrapper) {
                    if (undefined === nextItemPromiseWrapper || null === nextItemPromiseWrapper) {
                        // if _retrieveNextPromise() didn't return anything, that means that something went wrong
                        // in executing the enqueued function to produce the Promise; in that case, we've already
                        // triggered the error handler - nothing else to do
                        resolve();
                        return;
                    }

                    // wait for the resulting Promise to complete
                    nextItemPromiseWrapper.nextItemPromise.then(function (itemResult) {
                        // call the post-process callback (if any)
                        self._onItemProcessed(itemResult).then(function () {
                            // if the Promise (from processing the original item) resolved to false, halt processing more items
                            if (false === itemResult) {
                                self._halt(new WorkQueueHaltData({reason: WorkQueueHaltData.HALT_REASONS.PROCESSRETVAL})).then(function () {
                                    resolve();
                                }).catch(function (err) {
                                    // if for some reason the halt operation failed, bubble it up to the caller
                                    reject(err);
                                });
                            } else {
                                resolve();
                            }
                        }).catch(function (err) {
                            // if there was an error processing the item-processed callback, bubble it up to the caller
                            reject(err);
                        });
                    }).catch(function (err) {
                        // ensure that any error from processing is an Error object
                        if (!(err instanceof Error)) {
                            err = new WorkQueueError(err);
                        }
                        // store a flag indicating the source of the error, before calling the error handler
                        err.source = WorkQueueError.ERROR_SOURCES.PROCESS;
                        // if an error handler was specified, call it now
                        self._onError(err).then(function () {
                            resolve();
                        }).catch(function (err2) {
                            // if the error handler itself results in an error, bubble it up to the caller
                            reject(err2);
                        });
                    });
                }).catch(function (err) {
                    // if there was some sort of error retrieving the next item from the queue, bubble it up
                    reject(err);
                });
            });
        }

        // process the next item from the queue, update _inProgressCount and trigger the noWork callback (if appropriate)
        _processNextItemWrapper() {
            let self = this;
            return new Promise(function (resolve, reject) {
                self._processNextItem().then(function () {
                    self._inProgressCount--;

                    // if there's nothing in-progress and nothing left in the queue, call the no-work callback (if any)
                    let promises = [];
                    if (0 === self._inProgressCount && 0 === self.getQueueSize()) {
                        promises.push(self._onNoWork());
                    }
                    // if there's nothing in-progress and we're halted, call the afterHaltCompleted callback (if any)
                    if (0 === self._inProgressCount && true === self._halted) {
                        promises.push(self._onAfterHaltCompleted());
                    }
                    // if there's nothing in-progress and we're paused, call the afterPauseCompleted callback (if any)
                    if (0 === self._inProgressCount && true === self._paused) {
                        promises.push(self._onAfterPauseCompleted());
                    }
                    Promise.all(promises).then(function () {
                        resolve();
                    }).catch(function (err) {
                        // any error we get at this point is internal; bubble it up to the caller
                        reject(err);
                    });
                }).catch(function (err) {
                    // any error we get at this point is internal; bubble it up to the caller
                    reject(err);
                });
            });
        }

        // something changed - check if we should execute another item from the queue
        _evaluateQueue() {
            let self = this;
            try {
                // if we're halted or paused, don't process any more items
                if (true === self._halted || true === self._paused) {
                    return;
                }

                // only execute at most (options.concurrencyLimit) items at a time
                if (self._options.concurrencyLimit <= self._inProgressCount) {
                    // we've reached our limit, don't do anything right now
                    return;
                }

                // is there anything in the queue?
                if (0 === self._queue.length) {
                    // nothing to do
                    return;
                }

                // kick off the next item from the queue
                self._processNextItemWrapper().then(function () {
                    // after processing this item, see what's next...
                    setImmediate(function () {
                        self._evaluateQueue();
                    });
                }).catch(function (err) {
                    // if something went unexpectedly wrong while processing an item from the queue, call the error handler
                    self._onError(err).then(function () {
                    }).catch(function (err2) {
                        // if the error handler resulted in an error, not much else we can do
                    }).then(function () {
                        // if somehow we get to this point (i.e. due to an internal error), halt processing
                        self._halt(new WorkQueueHaltData({
                            reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                            error: err
                        })).then(function () {
                        }).catch(function (err3) {
                            // if the halt also fails, nothing else we can do
                        })
                    });
                });

                // now that we've kicked off an item, immediately re-evaluate if there's room for another (don't wait for
                // the just-dequeued item to complete, in case concurrencyLimit is more than 1)
                setImmediate(function () {
                    self._evaluateQueue();
                });
            } catch (ex) {
                // hopefully we'll never get to this point
                self._onError(new WorkQueueError("Internal Error: _evaluateQueue: " + ex)).then(function () {
                }).catch(function (err) {
                }).then(function () {
                    // if somehow we get to this point, halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        error: ex
                    })).then(function () {
                    }).catch(function (err2) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            }
        }

        // add a new item to the queue
        // an "item" may be a function to be called when it's time to process this item - the function is expected to return a Promise
        // or this may be an object which will (when it's time to process this item) be passed to the processor function that was specified in the WorkQueue constructor
        add(item) {
            let self = this;

            // if the constructor options specified a processor function, then added items may be either a function or
            // a non-function (to be passed to the processor).
            // if no processor has been specified, then all added items must be functions.
            if (undefined === self._options.processor || null === self._options.processor) {
                // validate that the specified item to add to the queue is a function
                if (typeof item !== 'function') {
                    throw new WorkQueueError("Only functions may be added to the queue when no processor has been defined", WorkQueueError.ERROR_SOURCES.BADREQUEST);
                }
            }

            // add the item to the queue
            self._queue.push(item);

            // call the queueSizeChange callback (if any)
            self._onQueueSizeChange().then(function () {
                // re-evaluate the queue (i.e. kick off the next item, if we aren't at our concurrency limit)
                self._evaluateQueue();
            }).catch(function (err) {
                // note that _onQueueSizeChange will internally handle any errors from the queueSizeChange callback -
                // so we will only get here if there was some kind of internal error
                self._onError(err).then(function () {
                }).catch(function (err2) {
                    // if the error handler resulted in an error, not much else we can do
                }).then(function () {
                    // if we got here (due to an internal error), halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        callback: 'queueSizeChange'
                    })).then(function () {
                    }).catch(function (err3) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            });
        }

        // add an array of items to the queue
        // like add(), an "item" may be a function to be called when it's time to process this item - the function is expected to return a Promise
        // or this may be an objct which will (when it's time to process this item) be passed to the processor function that was specified in the WorkQueue constructor
        addAll(items) {
            let self = this;

            // add the items to the queue
            self._queue.push(...items);

            // call the queueSizeChange callback (if any)
            self._onQueueSizeChange().then(function () {
                // re-evaluate the queue (i.e. kick off the next item, if we aren't at our concurrency limit)
                self._evaluateQueue();
            }).catch(function (err) {
                // note that _onQueueSizeChange will internally handle any errors from the queueSizeChange callback -
                // so we will only get here if there was some kind of internal error
                self._onError(err).then(function () {
                }).catch(function (err2) {
                    // if the error handler resulted in an error, not much else we can do
                }).then(function () {
                    // if we got here (due to an internal error), halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        callback: 'queueSizeChange'
                    })).then(function () {
                    }).catch(function (err3) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            });
        }

        // remove all outstanding items from the queue
        // note that this will not affect anything already pulled from the queue - i.e. items that have already been processed, nor items that are in-progress
        clear() {
            let self = this;
            self._queue = [];
            self._onQueueSizeChange().then(function () {
            }).catch(function (err) {
                // note that _onQueueSizeChange will internally handle any errors from the queueSizeChange callback -
                // so we will only get here if there was some kind of internal error
                self._onError(err).then(function () {
                }).catch(function (err2) {
                    // if the error handler resulted in an error, not much else we can do
                }).then(function () {
                    // if we got here (due to an internal error), halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        callback: 'queueSizeChange'
                    })).then(function () {
                    }).catch(function (err3) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            });
        }

        getQueueSize() {
            let self = this;
            return self._queue.length;
        }

        getInProgressCount() {
            let self = this;
            return self._inProgressCount;
        }

        // returns true if either:
        // a. there are items remaining in the queue, OR
        // b. there are items currently in-progress
        hasWork() {
            let self = this;
            return (0 < self.getQueueSize() || 0 < self.getInProgressCount());
        };

        // temporarily pause pulling new items from the queue
        // note that this will not affect any items currently in-progress
        pause() {
            let self = this;
            self._paused = true;

            // call the paused callback, but don't wait for it
            self._onPaused().then(function () {
            }).catch(function (err) {
                // note that _onPaused will internally handle any errors from the paused callback -
                // so we will only get here if there was some kind of internal error
                self._onError(err).then(function () {
                }).catch(function (err2) {
                    // if the error handler resulted in an error, not much else we can do
                }).then(function () {
                    // if we got here (due to an internal error), halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        callback: 'paused'
                    })).then(function () {
                    }).catch(function (err3) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            });
        }

        // after pause(), resume pulling items from the queue
        // (note that this call will be ignored if we are not currently paused)
        resume() {
            let self = this;
            // ignore if not paused
            if (true !== self._paused) {
                return;
            }
            self._paused = false;
            self._onResumed().then(function () {
                // _onResumed will internally halt if the callback returns false, so we can safely call _evaluateQueue
                // next regardless
                self._evaluateQueue();
            }).catch(function (err) {
                // note that _onResumed will internally handle any errors from the resumed callback -
                // so we will only get here if there was some kind of internal error
                self._onError(err).then(function () {
                }).catch(function (err2) {
                    // if the error handler resulted in an error, not much else we can do
                }).then(function () {
                    // if we got here (due to an internal error), halt processing
                    self._halt(new WorkQueueHaltData({
                        reason: WorkQueueHaltData.HALT_REASONS.INTERNAL,
                        callback: 'resumed'
                    })).then(function () {
                    }).catch(function (err3) {
                        // if the halt also fails, nothing else we can do
                    });
                });
            });
        }
    }

    module.exports = WorkQueue;
}) ()
