const assert = require('assert');

const WorkQueue = require('../workqueue');

describe('WorkQueue', function() {
    describe('#constructor', function() {
        it('should validate that the processor (if specified) is a function', function() {
            let exceptionCaught = false;

            try {
                let q = new WorkQueue({processor: 'thing'});
            }
            catch (ex) {
                exceptionCaught = true;
            }
            assert.strictEqual(exceptionCaught, true, 'constructor did not validate that processor is a function');
        });

        it('should allow the processor function to be specified with arrow notation', function() {
            return new Promise(function (resolve, reject) {
                let processedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: (item) => {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                processedCount++;
                                resolveItem(true);
                            }, 1000);
                        });
                    }
                });

                // add items to queue
                q.add('item 1');
                q.add('item 2');

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

    });

    describe('#add', function() {
        it('should immediately execute first item', function () {
            // initialize WorkQueue
            let q = new WorkQueue();

            // add an item to the queue
            q.add(function () {
                return new Promise(function (resolve, reject) {
                    setTimeout(function () {
                        resolve();
                    }, 1000);
                });
            });

            setTimeout(function() {
                // first item should be pulled off of queue immediately
                assert.strictEqual(q.getQueueSize(), 0, 'unexpected queue size after adding first item');
                assert.strictEqual(q.getInProgressCount(), 1, 'unexpected in-progress count after adding first item');
            }, 0);
        });

        it('should execute all added items', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // add items to queue
                let processedCount = 0;
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both items to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should allow functions to be specified with arrow notation', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // add items to queue
                let processedCount = 0;
                q.add(() => {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(() => {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both items to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should only execute one item at a time (if no concurrency limit is specified)', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // add items to queue
                let processedCount = 0;
                let isAExecuting = false;
                let isBExecuting = false;
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        isAExecuting = true;
                        setTimeout(function () {
                            // verify that only one item is being processed at a time
                            assert.strictEqual(isBExecuting, false, 'B unexpectedly executing while A is executing');
                            isAExecuting = false;
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        isBExecuting = true;
                        setTimeout(function () {
                            // verify that only one item is being processed at a time
                            assert.strictEqual(isAExecuting, false, 'A unexpectedly executing while B is executing');
                            isBExecuting = false;
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both tasks to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function () {
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should execute items in order', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                let results = [];
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            results.push('A');
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            results.push('B');
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both tasks to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(results.length, 2, 'unexpected number of results');

                    // verify that items were processed in the order in which they were added
                    assert.strictEqual('A', results[0], 'unexpected first result');
                    assert.strictEqual('B', results[1], 'unexpected second result');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should execute (options.concurrencyLimit) items at a time', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                // set concurrency limit to 2 (allow for processing up to 2 items at a time)
                let q = new WorkQueue({concurrencyLimit: 2});

                // add items to queue
                let executingCount = 0;
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        executingCount++;
                        setTimeout(function () {
                            executingCount--;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        executingCount++;
                        setTimeout(function () {
                            executingCount--;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        executingCount++;
                        setTimeout(function () {
                            executingCount--;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        executingCount++;
                        setTimeout(function () {
                            executingCount--;
                            resolveItem();
                        }, 1000);
                    });
                });

                // keep monitoring which tasks are executing
                let minExecutingCount = 0;
                let maxExecutingCount = 0;
                let intervalHandle = setInterval(function () {
                    if (executingCount < minExecutingCount) {
                        minExecutingCount = executingCount;
                    }
                    if (executingCount > maxExecutingCount) {
                        maxExecutingCount = executingCount;
                    }
                }, 100);

                // wait for all tasks to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function () {
                    clearInterval(intervalHandle);
                    // verify that at peak, 2 items were executing at a time
                    assert.strictEqual(maxExecutingCount, 2, 'did not reach peak concurrency');
                    // verify that eventually we stopped executing
                    assert.strictEqual(minExecutingCount, 0, 'did not stop executing');
                    resolve();
                }, 5000);
            });
        }).timeout(7000);

        it('should validate that the specified item-to-be-added is a function (if no processor was specified)', function() {
            // initialize WorkQueue
            let q = new WorkQueue();

            // try to add a numeric object to the queue
            let errorCaught = false;
            let errorSource = null;
            try {
                q.add(7);
            }
            catch (ex) {
                errorCaught = true;
            }
            assert.strictEqual(errorCaught, true, 'add API did not throw an exception for a non-function numeric item');

            // try to add a string object to the queue
            errorCaught = false;
            try {
                q.add('bad');
            }
            catch (ex) {
                errorCaught = true;
                errorSource = ex.source;
            }
            assert.strictEqual(errorCaught, true, 'add API did not throw an exception for a non-function string item');
            assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.BADREQUEST, 'add API threw an exception with an incorrect source value');
        });

        it('should call the error callback, if specified, if an enqueued function does not return a Promise', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                });

                // add item to queue that does not return a Promise
                q.add(function() {
                    return true;
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 1000);
            });
        }).timeout(2000);

        it('should stop processing more items from queue if one item returns false', function() {
            return new Promise(function(resolve, reject) {
                let item1Processed = false;
                let item2Processed = false;
                let item3Processed = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item1Processed = true;
                            resolveItem();
                        }, 1000);
                    });
                });
                // add a second item to the queue that resolves to false
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item2Processed = true;
                            resolveItem(false);
                        }, 1000);
                    });
                });
                // add a third item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item3Processed = true;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that the first 2 items were processed
                    assert.strictEqual(item1Processed, true, 'first item was not processed');
                    assert.strictEqual(item2Processed, true, 'second item was not processed');
                    // verify that 3rd enqueued item was not processed
                    assert.strictEqual(item3Processed, false, '3rd queue item was incorrectly processed');
                    resolve();
                }, 4000);
            });
        }).timeout(6000);

        it('should allow the added item to be a non-function that is passed to the processor (if a processor was specified)', function() {
            return new Promise(function (resolve, reject) {
                let processedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                processedCount++;
                                resolveItem(true);
                            }, 1000);
                        });
                    }
                });

                // add items to queue
                q.add('item 1');
                q.add('item 2');

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should NOT allow the added item to be a non-function if no processor was specified', function() {
            // initialize WorkQueue
            let q = new WorkQueue();

            // try to add a non-function item to queue
            let exceptionCaught = false;
            try {
                q.add('item 1');
            }
            catch (ex) {
                exceptionCaught = true;
            }

            assert.strictEqual(exceptionCaught, true, 'add incorrectly allowed a non-function to be added without a processor');
        });

        it('should pass each item to the processor function (if one was specified)', function() {
            return new Promise(function (resolve, reject) {
                let item1Processed = false;
                let item2Processed = false;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                if ('item 1' === item) {
                                    item1Processed = true;
                                }
                                else if ('item 2' === item) {
                                    item2Processed = true;
                                }
                                resolveItem(true);
                            }, 1000);
                        });
                    }
                });

                // add items to queue
                q.add('item 1');
                q.add('item 2');

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(item1Processed, true, '"item 1" was not passed to processor');
                    assert.strictEqual(item2Processed, true, '"item 2" was not passed to processor');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if the processor function returns false for one item', function() {
            return new Promise(function(resolve, reject) {
                let item1Processed = false;
                let item2Processed = false;
                let item3Processed = false;

                // initialize WorkQueue
                let q = new WorkQueue({
                    concurrencyLimit: 1,
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                if ('item2' === item) {
                                    item2Processed = true;
                                    resolveItem(false);
                                }
                                else {
                                    if ('item1' === item) {
                                        item1Processed = true;
                                    }
                                    else if ('item3' === item) {
                                        item3Processed = true;
                                    }
                                    resolveItem(true);
                                }
                            }, 1000);
                        });
                    }
                });

                // add items to the queue
                q.add('item1');
                q.add('item2');
                q.add('item3');

                // allow time for all three tasks to complete
                setTimeout(function() {
                    // verify that the first 2 items were processed
                    assert.strictEqual(item1Processed, true, 'first item was not processed');
                    assert.strictEqual(item2Processed, true, 'second item was not processed');
                    // verify that 3rd enqueued item was not processed
                    assert.strictEqual(item3Processed, false, '3rd queue item was incorrectly processed');
                    resolve();
                }, 4000);
            });
        }).timeout(6000);

        it('should use the function specified in add (if a function was specified), even if a processor was specified in the constructor', function () {
            return new Promise(function (resolve, reject) {
                let processorCalled = false;
                let processedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                processorCalled = true;
                                resolveItem(true);
                            }, 1000);
                        });
                    }
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed using the functions supplied to add (not the processor specified in the constructor)
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    assert.strictEqual(processorCalled, false, 'processor unexpectedly called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

    });

    describe('#addAll', function() {
        it('should execute all added items', function () {
            return new Promise(function (resolve, reject) {
                let processedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // add items to queue
                let items = [
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                processedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                processedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    }
                ];

                q.addAll(items);

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should execute all added items, including those previously added via the "add" API', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                // set concurrencyLimit to 1 so that we can make sure that there are still unprocessed items in the queue before we call addAll
                let q = new WorkQueue({concurrencyLimit: 1});

                let processedCount = 0;
                // add items to queue
                q.add(function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                processedCount++;
                                resolveItem();
                            }, 1000);
                        });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                let items = [
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                processedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                processedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    }
                ];
                q.addAll(items);

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(processedCount, 4, 'unexpected number of processed items');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should allow for addAll items to include functions as well as non-function objects', function () {
            return new Promise(function (resolve, reject) {
                let processorProcessedCount = 0;
                let functionProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                processorProcessedCount++;
                                resolveItem(true);
                            }, 1000);
                        });
                    }
                });

                // add items to queue
                let items = [
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                functionProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                functionProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    'three'
                ];

                q.addAll(items);

                // wait for all items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(functionProcessedCount, 2, 'unexpected number of processed functions');
                    assert.strictEqual(processorProcessedCount, 1, 'unexpected number of items processed via processor function');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should execute all added items in order, including those previously added via the "add" API', function () {
            return new Promise(function (resolve, reject) {
                // initialize WorkQueue
                // set concurrencyLimit to 1 so that we can accurately track dequeueing order
                let q = new WorkQueue({concurrencyLimit: 1});

                let results = [];
                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            results.push('A');
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            results.push('B');
                            resolveItem();
                        }, 1000);
                    });
                });
                let items = [
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                results.push('C');
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                results.push('D');
                                resolveItem();
                            }, 1000);
                        });
                    }
                ];
                q.addAll(items);

                // wait for both items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(results.length, 4, 'unexpected number of processed items');
                    assert.strictEqual(results[0], 'A', 'item #1 processed out of order');
                    assert.strictEqual(results[1], 'B', 'item #2 processed out of order');
                    assert.strictEqual(results[2], 'C', 'item #3 processed out of order');
                    assert.strictEqual(results[3], 'D', 'item #4 processed out of order');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should call the error callback if a non-function is included in the array passed to addAll AND no processor is specified', function () {
            return new Promise(function (resolve, reject) {
                let errorCallbackCalled = false;
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                q.on('error', function(err) {
                    errorCallbackCalled = true;
                    errorSource = err.source;
                    return true;
                });

                // add items to queue
                let items = [
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                resolveItem(true);
                            }, 1000);
                        });
                    },
                    function () {
                        return new Promise(function (resolveItem, rejectItem) {
                            setTimeout(function () {
                                resolveItem(true);
                            }, 1000);
                        });
                    },
                    'three'
                ];

                q.addAll(items);

                // wait for all items to finish
                setTimeout(function () {
                    // verify that both items were processed
                    assert.strictEqual(errorCallbackCalled, true, 'error callback not called');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.BADREQUEST, 'error callback called without the correct error-source');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);
    });

    describe('#on', function() {
        it('should call the error callback, if specified, if an item from the queue results in an error', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass an Error object (including the source of the error) to the error callback, if an item from the queue rejects', function() {
            return new Promise(function(resolve, reject) {
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.PROCESS, 'incorrect error source passed to error handler');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass an Error object (including the source of the error) to the error callback, if an enqueued function throws a synchronous exception', function() {
            return new Promise(function(resolve, reject) {
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    throw "synchronous error happened";
                });

                // wait for task to finish
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.PROCESS, 'incorrect error source passed to error handler');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass an Error object (including the source of the error) to the error callback, if the processor function rejects', function() {
            return new Promise(function(resolve, reject) {
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                rejectItem("forced error");
                            }, 1000);
                        });
                    }
                });

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add item to queue that will result in an error
                q.add('A');

                // wait for task to finish
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.PROCESS, 'incorrect error source passed to error handler');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass an Error object (including the source of the error) to the error callback, if the processor function throws a synchronous exception', function() {
            return new Promise(function(resolve, reject) {
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue({
                    processor: function(item) {
                        throw "something bad happened";
                    }
                });

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add item to queue that will result in an error
                q.add('A');

                // wait for task to finish
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.PROCESS, 'incorrect error source passed to error handler');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should allow the error callback to be specified with arrow notation', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', (err) => {
                    errorHandlerCalled = true;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should call the error callback only once, if specified, if an item from the queue results in an error', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCount = 0;
                q.on('error', function(err) {
                    errorHandlerCount++;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called once
                    assert.strictEqual(errorHandlerCount, 1, 'error handler was called an unexpected number of times');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should not call the error callback, if specified, if no items from the queue result in an error', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                });

                // add an item to the queue (that will not result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that error handler was not called
                    assert.strictEqual(errorHandlerCalled, false, 'error handler incorrectly called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if the error handler returns false', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                q.on('error', function(err) {
                    return false;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should NOT stop processing more items from queue if the error handler returns true', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let errorCallbackCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to NOT halt processing
                q.on('error', function(err) {
                    errorCallbackCalled = true;
                    return true;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that the error callback was called
                    assert.strictEqual(errorCallbackCalled, true, 'error callback not called');
                    // verify that 2nd enqueued item was processed
                    assert.strictEqual(item2Processed, true, '2nd queue item was incorrectly not processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should allow for an error callback to return a Promise', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        errorHandlerCalled = true;
                        resolveHandler();
                    });
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if the error handler returns a Promise that resolves to false', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set error handler callback, set up to halt processing on any error
                q.on('error', function(err) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        resolveHandler(false);
                    });
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if the error handler returns a Promise that results in an error', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set error handler callback, set up to always fail
                q.on('error', function(err) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        rejectHandler("error from error handler");
                    });
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should wait for an asynchronous error handler to complete before proceeding to the next item', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            errorHandlerCalled = true;
                            resolveHandler();
                        }, 1000);
                    });
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        // verify that the error handler was called while processing item #1
                        assert.strictEqual(errorHandlerCalled, true, 'Error handler was not called or did not complete before item #2 was processed');
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was processed
                    assert.strictEqual(item2Processed, true, '2nd queue item was incorrectly processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if a synchronous error handler throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set error handler callback, set up to always fail
                q.on('error', function(err) {
                    throw "error from error handler";
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass a WorkQueueHaltData to the halted handler indicating that processing was halted due to an error from an error callback, if the error handler throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerErrorReason = null;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set error handler callback, set up to always fail
                q.on('error', function(err) {
                    throw "error from error handler";
                }).on('halted', function(reason) {
                    haltedHandlerErrorReason = reason.reason;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that the reason passed to the halted handler indicated that processing was stopped due to an error from an error callback
                    assert.strictEqual(haltedHandlerErrorReason, WorkQueue.HALT_REASONS.ERRORCALLBACKERROR, 'incorrect or missing halt reason');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass a WorkQueueHaltData to the halted handler indicating that processing was halted due to an error from an error callback, if the error handler rejects', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerErrorReason = null;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set error handler callback, set up to always fail
                q.on('error', function(err) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        rejectHandler("error from error handler");
                    });
                }).on('halted', function(reason) {
                    haltedHandlerErrorReason = reason.reason;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that the reason passed to the halted handler indicated that processing was stopped due to an error from a callback
                    assert.strictEqual(haltedHandlerErrorReason, WorkQueue.HALT_REASONS.ERRORCALLBACKERROR, 'incorrect or missing halt reason');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should validate that the error callback is a function', function() {
            // initialize WorkQueue
            let q = new WorkQueue();

            // try to set invalid error handler callback
            let errorCaught = false;
            try {
                q.on('error', 7);
            }
            catch (ex) {
                errorCaught = true;
            }
            assert.strictEqual(errorCaught, true, 'on API did not throw an exception for a non-function numeric callback');

            // try to set another invalid error handler callback
            errorCaught = false;
            try {
                q.on('error', 'bad');
            }
            catch (ex) {
                errorCaught = true;
            }
            assert.strictEqual(errorCaught, true, 'on API did not throw an exception for a non-function string callback');
        });

        it('should call the error callback, if specified, if an enqueued function throws an exception (instead of returning a Promise)', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                let errorHandlerCalled = false;
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    throw "some error";
                });

                // wait for task to finish
                // TODO: use "completed" or "empty" callback
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 1000);
            });
        }).timeout(2000);

        it('should call halted handler after halting', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                q.on('error', function(err) {
                    return false;
                });

                // set up halted handler
                q.on('halted', function(reason) {
                    haltedHandlerCalled = true;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    // verify that the halted handler was called
                    assert.strictEqual(haltedHandlerCalled, true, 'halted handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should decrement the in-progress count even if a synchronous halted callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set up a synchronous halted handler
                q.on('halted', function(reason) {
                    haltedHandlerCalled = true;
                });

                // add an item to the queue (that will return false, triggering a halt)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem(false);
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    // verify that the halted handler was called
                    assert.strictEqual(haltedHandlerCalled, true, 'halted handler not called');
                    // verify that there are 0 items in-progress right now
                    assert.strictEqual(q.getInProgressCount(), 0, 'unexpected in-progress count');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass a WorkQueueHaltData to the halted handler indicating the reason for halting, if the item processor returns false', function() {
            return new Promise(function(resolve, reject) {
                let item1Processed = false;
                let item2Processed = false;
                let item3Processed = false;
                let haltedReason = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                q.on('halted', function(reason) {
                    haltedReason = reason.reason;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item1Processed = true;
                            resolveItem();
                        }, 1000);
                    });
                });
                // add a second item to the queue that resolves to false
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item2Processed = true;
                            resolveItem(false);
                        }, 1000);
                    });
                });
                // add a third item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            item3Processed = true;
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that the first 2 items were processed
                    assert.strictEqual(item1Processed, true, 'first item was not processed');
                    assert.strictEqual(item2Processed, true, 'second item was not processed');
                    // verify that 3rd enqueued item was not processed
                    assert.strictEqual(item3Processed, false, '3rd queue item was incorrectly processed');
                    // verify that the appropriate reason was passed to the halted callback
                    assert.strictEqual(haltedReason, WorkQueue.HALT_REASONS.PROCESSRETVAL, 'incorrect reason passed to halted callback');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should allow the halted callback to use arrow notation', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                q.on('error', function(err) {
                    return false;
                });

                // set up halted handler
                q.on('halted', (reason) => {
                    haltedHandlerCalled = true;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    // verify that the halted handler was called
                    assert.strictEqual(haltedHandlerCalled, true, 'halted handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should call the error callback if the halted callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let haltedHandlerCalled = false;
                let errorHandlerCalled = false;
                let errorHandlerCalledAfterHaltedHandler = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === newCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    haltedHandlerCalled = true;
                    throw "error from halted callback";
                }).on('error', function() {
                    if (true === haltedHandlerCalled) {
                        errorHandlerCalledAfterHaltedHandler = true;
                    }
                    errorHandlerCalled = true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'processing did not stop after queueSizeChange handler returned false');
                    assert.strictEqual(haltedHandlerCalled, true, 'halted callback was not called');
                    assert.strictEqual(errorHandlerCalled, true, 'error callback was not called');
                    assert.strictEqual(errorHandlerCalledAfterHaltedHandler, true, 'error callback was called before halted handler');
                    resolve();
                }, 5000);
            });
        }).timeout(7000);

        it('should avoid an infinite loop if both the halted handler and the error handler throw exceptions', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let errorHandlerCount = 0;
                let haltedHandlerCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === newCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    haltedHandlerCount++;
                    throw "error from halted callback";
                }).on('error', function() {
                    errorHandlerCount++;
                    throw "error from error callback";
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(haltedHandlerCount, 1, 'halted callback was called an unexpected number of times');
                    assert.strictEqual(errorHandlerCount, 1, 'error callback was called an unexpected number of times');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should avoid an infinite loop if the error handler returns false and the halted handler throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let errorHandlerCount = 0;
                let haltedHandlerCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === newCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    haltedHandlerCount++;
                    throw "error from halted callback";
                }).on('error', function() {
                    errorHandlerCount++;
                    return false;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(haltedHandlerCount, 1, 'halted callback was called an unexpected number of times');
                    assert.strictEqual(errorHandlerCount, 1, 'error callback was called an unexpected number of times');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should allow for the halted callback to return a Promise', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                q.on('error', function(err) {
                    return false;
                });

                // set up halted handler
                q.on('halted', function(reason) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        haltedHandlerCalled = true;
                        resolveHandler(true);
                    });
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    // verify that the halted handler was called
                    assert.strictEqual(haltedHandlerCalled, true, 'halted handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should call the error callback with an Error object that specifies a CALLBACK source, if the halted callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let haltedHandlerCalled = false;
                let errorHandlerCalled = false;
                let errorHandlerCalledAfterHaltedHandler = false;
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === newCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    haltedHandlerCalled = true;
                    throw "error from halted callback";
                }).on('error', function(err) {
                    if (true === haltedHandlerCalled) {
                        errorHandlerCalledAfterHaltedHandler = true;
                    }
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'processing did not stop after queueSizeChange handler returned false');
                    assert.strictEqual(haltedHandlerCalled, true, 'halted callback was not called');
                    assert.strictEqual(errorHandlerCalled, true, 'error callback was not called');
                    assert.strictEqual(errorHandlerCalledAfterHaltedHandler, true, 'error callback was called before halted handler');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.CALLBACK, 'error passed to error callback specified incorrect source');
                    resolve();
                }, 5000);
            });
        }).timeout(7000);

        it('should call the error callback with an Error object that specifies a CALLBACK source, if the halted callback rejects', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let haltedHandlerCalled = false;
                let errorHandlerCalled = false;
                let errorHandlerCalledAfterHaltedHandler = false;
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === newCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        haltedHandlerCalled = true;
                        rejectHandler("error from halted callback");
                    });
                }).on('error', function(err) {
                    if (true === haltedHandlerCalled) {
                        errorHandlerCalledAfterHaltedHandler = true;
                    }
                    errorHandlerCalled = true;
                    errorSource = err.source;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'processing did not stop after queueSizeChange handler returned false');
                    assert.strictEqual(haltedHandlerCalled, true, 'halted callback was not called');
                    assert.strictEqual(errorHandlerCalled, true, 'error callback was not called');
                    assert.strictEqual(errorHandlerCalledAfterHaltedHandler, true, 'error callback was called before halted handler');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.CALLBACK, 'error passed to error callback specified incorrect source');
                    resolve();
                }, 5000);
            });
        }).timeout(7000);

        it('should allow for chaining "on" calls', function() {
            return new Promise(function(resolve, reject) {
                let item2Processed = false;
                let haltedHandlerCalled = false;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback, set up to halt processing on any error
                // set up halted handler
                q.on('error', function(err) {
                    errorHandlerCalled = true;
                    return false;
                }).on('halted', function(reason) {
                    haltedHandlerCalled = true;
                });

                // add an item to the queue (that will result in an error)
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });
                // add a second item to the queue that should never be processed
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        item2Processed = true;
                        resolveItem();
                    });
                });

                // wait for first task to finish
                // and allow time for second task
                setTimeout(function() {
                    // verify that 2nd enqueued item was not processed
                    assert.strictEqual(item2Processed, false, '2nd queue item was incorrectly processed');
                    // verify that the error handler was called
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called');
                    // verify that the halted handler was called
                    assert.strictEqual(haltedHandlerCalled, true, 'halted handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should call queueSizeChange handler when an item is added to the queue', function() {
            return new Promise(function(resolve, reject) {
                let queueSizeHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    queueSizeHandlerCalled = true;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(queueSizeHandlerCalled, true, 'handler not called');
                    resolve();
                }, 1000);
            });
        }).timeout(2000);

        it('should call queueSizeChange handler when an item is removed from the queue', function() {
            return new Promise(function(resolve, reject) {
                let itemRemoved = false;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === ready && 0 === newCount) {
                        itemRemoved = true;
                    }
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(itemRemoved, true, 'handler not called after item removed from queue');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should wait for asynchronous queueSizeChange handler before processing next item', function() {
            return new Promise(function(resolve, reject) {
                let handlerCalled = false;
                let ready = false;
                let itemsProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            if (true === ready) {
                                handlerCalled = true;
                            }
                            resolveHandler(true);
                        }, 1000);
                    });
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            ready = true;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            assert.strictEqual(handlerCalled, true, "queueSizeChange handler not called before 2nd item launched");
                            resolveItem();
                        }, 1000);
                    });
                });

                // verify all items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'not all items were processed');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should stop processing more items if queueSizeChange handler returns false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let halted = false;
                let haltedReason = null;
                let expectedFinalProcessedItemCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    if (true === readyFlag && 2 === itemsProcessedCount) {
                        // if we halt now, there may be item(s) already in-progress
                        // how many remaining enqueued items (i.e. items that haven't yet begun processing) will be skipped/ignored?
                        let ignoredCount = newCount;
                        expectedFinalProcessedItemCount = 4 - ignoredCount;
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    halted = true;
                    haltedReason = reason.reason;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(halted, true, 'processing was not artificially halted');
                    assert.strictEqual(haltedReason, WorkQueue.HALT_REASONS.CALLBACKRETVAL, 'halted callback was passed the incorrect reason for halting');
                    assert.strictEqual(itemsProcessedCount, expectedFinalProcessedItemCount, 'processing did not stop after queueSizeChange handler returned false');
                    resolve();
                }, 5000);
            });
        }).timeout(7000);

        it('should stop processing more items if queueSizeChange handler returns a Promise that resolves to false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let halted = false;
                let expectedFinalProcessedItemCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== readyFlag) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            if (2 === itemsProcessedCount) {
                                // if we halt now, there may be item(s) already in-progress
                                // how many remaining enqueued items (i.e. items that haven't yet begun processing) will be skipped/ignored?
                                let ignoredCount = newCount;
                                expectedFinalProcessedItemCount = 4 - ignoredCount;
                                resolveHandler(false);
                            }
                            else {
                                resolveHandler(true);
                            }
                        }, 1000);
                    });
                }).on('halted', function(reason) {
                    halted = true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queue size is reduced to 2
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, expectedFinalProcessedItemCount, 'processing did not stop after queueSizeChange handler returned false');
                    assert.strictEqual(halted, true, 'processing was not artificially halted');
                    resolve();
                }, 9000);
            });
        }).timeout(10000);

        it('should call the error handler if the queueSizeChanged callback returns a Promise that results in an error', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolve, reject) {
                        setTimeout(function() {
                            reject("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueSizeChanged error');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should continue processing items from the queue if the queueSizeChanged callback returns a Promise that results in an error, and the error callback returns true', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let isReady = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== isReady) {
                            resolveHandler();
                            return;
                        }
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                isReady = true;

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'both items were not processed');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should continue processing items from the queue if the queueSizeChanged callback (triggered by add) returns a Promise that results in an error, and the error callback returns true', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'both items were not processed');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should stop processing items from the queue if the queueSizeChanged callback (triggered by add) returns a Promise that results in an error, and the error callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return false;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 0, 'unexpected number of processed items');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should continue processing items from the queue if the queueSizeChanged callback (triggered by addAll) returns a Promise that results in an error, and the error callback returns true', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return true;
                });

                // add items to the queue
                let arrItems = [
                    function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                itemsProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                itemsProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    }
                ];
                q.addAll(arrItems);

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 2, 'both items were not processed');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should stop processing items from the queue if the queueSizeChanged callback (triggered by addAll) returns a Promise that results in an error, and the error callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return false;
                });

                // add items to the queue
                let arrItems = [
                    function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                itemsProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    },
                    function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            setTimeout(function() {
                                itemsProcessedCount++;
                                resolveItem();
                            }, 1000);
                        });
                    }
                ];
                q.addAll(arrItems);

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 0, 'unexpected number of processed items');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should stop processing items from the queue if the queueSizeChanged callback returns a Promise that results in an error, and the error callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let isReady = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== isReady) {
                            resolveHandler();
                            return;
                        }
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(reason) {
                    return false;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                isReady = true;

                // verify that both items were processed
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 1, 'unexpected number of processed items');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should call the error handler only once if the queueSizeChanged callback returns a Promise that results in an error', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCount++;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called only once
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCount, 1, 'error handler called an unexpected number of times after queueSizeChanged error');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should call the error handler if a synchronous queueSizeChanged callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    throw "error during queueSizeChange callback";
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueSizeChanged error');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should pass an Error object (that specifies a CALLBACK source) to the error callback if the queueSizeChange callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    throw "error during queueSizeChange callback";
                }).on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueSizeChanged error');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.CALLBACK, 'error callback not passed the correct error source');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should pass an Error object (that specifies a CALLBACK source) to the error callback if the queueSizeChange callback rejects', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;
                let errorSource = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueSizeChange', function(newCount) {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler("error during queueSizeChange callback");
                        }, 1000);
                    });
                }).on('error', function(err) {
                    errorHandlerCalled = true;
                    errorSource = err.source;
                    return true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        resolveItem();
                    });
                });

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueSizeChanged error');
                    assert.strictEqual(errorSource, WorkQueue.ERROR_SOURCES.CALLBACK, 'error callback not passed the correct error source');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should call queueEmpty handler when the queue runs out of items', function() {
            return new Promise(function(resolve, reject) {
                let handlerCalled = false;
                let handlerQueueSize = -1;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueEmpty', function() {
                    if (true === ready) {
                        handlerCalled = true;
                        handlerQueueSize = q.getQueueSize();
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'handler not called after item removed from queue');
                    assert.strictEqual(handlerQueueSize, 0, 'handler called when queue size was not 0');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should call error handler if the queueEmpty callback returns a Promise that results in an error', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;
                let handlerQueueSize = -1;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueEmpty', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== ready) {
                            resolveHandler();
                            return;
                        }
                        setTimeout(function() {
                            rejectHandler("error during queueEmpty callback");
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueEmpty error');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should call error handler if a synchronous queueEmpty callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let errorHandlerCalled = false;
                let handlerQueueSize = -1;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueEmpty', function() {
                    if (true !== ready) {
                        return true;
                    }
                    throw "error during queueEmpty callback";
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called after queueEmpty error');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should call queueEmpty handler multiple times if appropriate', function() {
            return new Promise(function(resolve, reject) {
                let handlerCallbackCount = 0;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('queueEmpty', function() {
                    if (true === ready) {
                        handlerCallbackCount++;
                        if (1 === handlerCallbackCount) {
                            // add another item to the queue, which should trigger another empty callback after that item is dequeued
                            q.add(function () {
                                return new Promise(function (resolveItem, rejectItem) {
                                    setTimeout(function () {
                                        resolveItem();
                                    }, 1000);
                                });
                            });
                        }
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called twice
                setTimeout(function() {
                    assert.strictEqual(handlerCallbackCount, 2, 'handler not called twice');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should call both the queueSizeChange and queueEmpty handlers when the queue runs out of items', function() {
            return new Promise(function(resolve, reject) {
                let emptyHandlerCalled = false;
                let sizeHandlerCalled = false;
                let handlerQueueSize = -1;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callbacks
                q.on('queueEmpty', function() {
                    if (true === ready) {
                        emptyHandlerCalled = true;
                        handlerQueueSize = q.getQueueSize();
                    }
                    return true;
                }).on('queueSizeChange', function(newSize) {
                    if (true === ready && 0 === newSize) {
                        sizeHandlerCalled = true;
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called
                setTimeout(function() {
                    assert.strictEqual(emptyHandlerCalled, true, 'queueEmpty handler not called after item removed from queue');
                    assert.strictEqual(handlerQueueSize, 0, 'queueEmpty handler called when queue size was not 0');
                    assert.strictEqual(sizeHandlerCalled, true, 'queueSizeChange handler not called after item removed from queue');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should stop processing more items if queueEmpty handler returns false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let halted = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueEmpty', function() {
                    if (true === readyFlag) {
                        // add another item to the queue
                        q.add(function() {
                            return new Promise(function(resolveItem, rejectItem) {
                                setTimeout(function() {
                                    itemsProcessedCount++;
                                    resolveItem();
                                }, 1000);
                            });
                        });
                        return false;
                    }
                    else {
                        return true;
                    }
                }).on('halted', function(reason) {
                    halted = true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queueEmpty callback is called
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 1, 'processing did not stop after queueEmpty handler returned false');
                    assert.strictEqual(halted, true, 'processing was not artificially halted');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should stop processing more items if queueEmpty handler returns a Promise that resolves to false', function() {
            return new Promise(function(resolve, reject) {
                let itemsProcessedCount = 0;
                let readyFlag = false;
                let halted = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set queue size change callback
                q.on('queueEmpty', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== readyFlag) {
                            resolveHandler(true);
                            return;
                        }

                        setTimeout(function() {
                            // add another item to the queue
                            // note: because our concurrencyLimit is set to 1, add() won't trigger another
                            // queue-evaluation until after the first one has finished (i.e. after the queueEmpty
                            // callback completes) - so this 2nd item should never get processed (since we'll have
                            // halted before then)
                            q.add(function() {
                                return new Promise(function(resolveItem, rejectItem) {
                                    setTimeout(function() {
                                        itemsProcessedCount++;
                                        resolveItem();
                                    }, 1000);
                                });
                            });
                            resolveHandler(false);
                        }, 1000);
                    });
                }).on('halted', function(reason) {
                    halted = true;
                });

                // add an item to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemsProcessedCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // verify that processing stops after the queueEmpty callback is called
                setTimeout(function() {
                    assert.strictEqual(itemsProcessedCount, 1, 'processing did not stop after queueEmpty handler returned false');
                    assert.strictEqual(halted, true, 'processing was not artificially halted');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should call the noWork callback after all items have been dequeued AND processed', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let handlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        handlerCalled = true;
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that noWork callback was called after all items finished processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'noWork handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should NOT call the noWork callback after an item has been processed but before the next item has been dequeued (i.e. only when BOTH the queue is empty AND nothing is in-progress)', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let handlerCalled = false;
                let handlerCalledWhileQueueNotEmpty = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // set callback
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        handlerCalled = true;
                    }
                    if (0 < q.getQueueSize()) {
                        handlerCalledWhileQueueNotEmpty = true;
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that noWork callback was called after all items finished processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'noWork handler not called');
                    assert.strictEqual(handlerCalledWhileQueueNotEmpty, false, 'noWork handler called while queue not empty');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should NOT call the noWork callback after dequeuing the last item, but before that item has been processed', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let handlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // set callback
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        handlerCalled = true;
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 5000);
                    });
                });

                // check for callback after all items have been dequeued, but an item is still processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, false, 'noWork callback called while items are still in-progress');
                    resolve();
                }, 2500);
            });
        }).timeout(5000);

        it('should not call the noWork callback after a halt, if pre-halt item(s) are still processing', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let noWorkCallbackCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // set callbacks
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        noWorkCallbackCalled = true;
                    }
                    return true;
                });

                // after the first item has finished processing, but while the 2nd item is still in-progress, halt
                q.on('itemProcessed', function() {
                    return false;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 5000);
                    });
                });
                readyFlag = true;

                // check for callback after all items have been dequeued, but an item is still processing
                setTimeout(function() {
                    assert.strictEqual(noWorkCallbackCalled, false, 'noWork callback called while items are still in-progress');
                    resolve();
                }, 2500);
            });
        }).timeout(5000);

        it('should not call the noWork callback after a pause, if pre-pause item(s) are still processing', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let noWorkCallbackCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // set callbacks
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        noWorkCallbackCalled = true;
                    }
                    return true;
                });

                // after the first item has finished processing, but while the 2nd item is still in-progress, pause
                q.on('itemProcessed', function() {
                    q.pause();
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 5000);
                    });
                });
                readyFlag = true;

                // check for callback after all items have been dequeued, but an item is still processing
                setTimeout(function() {
                    assert.strictEqual(noWorkCallbackCalled, false, 'noWork callback called while items are still in-progress');
                    resolve();
                }, 2500);
            });
        }).timeout(5000);

        it('should call the afterHaltCompleted callback after a halt, after all pre-halt items have finished processing', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let noWorkCallbackCalled = false;
                let afterHaltCompeltedCallbackCalled = false;
                let haltedCallbackCalled = false;
                let itemBProcessed = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // set callbacks
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        noWorkCallbackCalled = true;
                    }
                    return true;
                }).on('afterHaltCompleted', function() {
                    afterHaltCompeltedCallbackCalled = true;
                }).on('halted', function(reason) {
                    haltedCallbackCalled = true;
                });

                // after the first item has finished processing, but while the 2nd item is still in-progress, halt
                q.on('itemProcessed', function() {
                    return false;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemBProcessed = true;
                            resolveItem();
                        }, 5000);
                    });
                });
                readyFlag = true;

                setTimeout(function() {
                    assert.strictEqual(haltedCallbackCalled, true, 'halted callback not called');
                    assert.strictEqual(noWorkCallbackCalled, false, 'noWork callback called while items are still in-progress');
                    // wait until the 2nd item has time to finish
                    setTimeout(function() {
                        assert.strictEqual(itemBProcessed, true, '2nd item did not finish processing');
                        assert.strictEqual(afterHaltCompeltedCallbackCalled, true, 'afterHaltCompleted callback not called');
                        resolve();
                    }, 6000);
                }, 2500);
            });
        }).timeout(10000);

        it('should call the afterPauseCompleted callback after a pause, after all pre-pause items have finished processing', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let noWorkCallbackCalled = false;
                let afterPauseCompeltedCallbackCalled = false;
                let itemBProcessed = false;
                let pausedCallbackCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // set callbacks
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        noWorkCallbackCalled = true;
                    }
                    return true;
                }).on('afterPauseCompleted', function() {
                    afterPauseCompeltedCallbackCalled = true;
                }).on('paused', function() {
                    pausedCallbackCalled = true;
                });

                // after the first item has finished processing, but while the 2nd item is still in-progress, pause
                q.on('itemProcessed', function() {
                    q.pause();
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemBProcessed = true;
                            resolveItem();
                        }, 5000);
                    });
                });
                readyFlag = true;

                setTimeout(function() {
                    assert.strictEqual(pausedCallbackCalled, true, 'paused callback not called');
                    assert.strictEqual(noWorkCallbackCalled, false, 'noWork callback called while items are still in-progress');
                    // wait until the 2nd item has time to finish
                    setTimeout(function() {
                        assert.strictEqual(itemBProcessed, true, '2nd item did not finish processing');
                        assert.strictEqual(afterPauseCompeltedCallbackCalled, true, 'afterPauseCompleted callback not called');
                        resolve();
                    }, 6000);
                }, 2500);
            });
        }).timeout(10000);

        it('should call noWork handler multiple times if appropriate', function() {
            return new Promise(function(resolve, reject) {
                let handlerCallbackCount = 0;
                let ready = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set queue size change callback
                q.on('noWork', function() {
                    if (true === ready) {
                        handlerCallbackCount++;
                        if (1 === handlerCallbackCount) {
                            // add another item to the queue, which should trigger another noWork callback after that item is processed
                            q.add(function () {
                                return new Promise(function (resolveItem, rejectItem) {
                                    setTimeout(function () {
                                        resolveItem();
                                    }, 1000);
                                });
                            });
                        }
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                ready = true;

                // verify the handler was called twice
                setTimeout(function() {
                    assert.strictEqual(handlerCallbackCount, 2, 'handler not called twice');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should permanently stop processing more items if noWork callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let postNoWorkItemProcessed = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        handlerCalled = true;
                    }
                    return false;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that noWork callback was called after all items finished processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'noWork handler not called');

                    // then add another item to the queue
                    // add another item to the queue
                    q.add(function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            postNoWorkItemProcessed = true;
                            setTimeout(function() {
                                resolveItem();
                            }, 1000);
                        });
                    });

                    // wait for new item to (potentially) be processed
                    setTimeout(function() {
                        // verify final item was not processed
                        assert.strictEqual(postNoWorkItemProcessed, false, 'items incorrectly continued processing after noWork callback returned false');
                        resolve();
                    }, 2000);
                }, 3000);
            });
        }).timeout(9000);

        it('should permanently stop processing more items if noWork callback returns a Promise that resolves to false', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let postNoWorkItemProcessed = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== readyFlag) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            handlerCalled = true;
                            resolveHandler(false);
                        }, 1000);
                    });
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that noWork callback was called after all items finished processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'noWork handler not called');

                    // then add another item to the queue
                    // add another item to the queue
                    q.add(function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            postNoWorkItemProcessed = true;
                            setTimeout(function() {
                                resolveItem();
                            }, 1000);
                        });
                    });

                    // wait for new item to (potentially) be processed
                    setTimeout(function() {
                        // verify final item was not processed
                        assert.strictEqual(postNoWorkItemProcessed, false, 'items incorrectly continued processing after noWork callback returned false');
                        resolve();
                    }, 3000);
                }, 4000);
            });
        }).timeout(9000);

        it('should call the error callback if the noWork callback returned a Promise that resulted in an error', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (true !== readyFlag) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            rejectHandler("error from noWork callback");
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that error callback was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should call the error callback if a synchronous noWork callback throws an exception', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    if (true !== readyFlag) {
                        return true;
                    }
                    throw "error from noWork callback";
                }).on('error', function() {
                    errorHandlerCalled = true;
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that error callback was called
                setTimeout(function() {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should continue processing more items if noWork callback returns true', function() {
            return new Promise(function(resolve, reject) {
                let readyFlag = false;
                let postNoWorkItemProcessed = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set callback
                q.on('noWork', function() {
                    if (true === readyFlag) {
                        handlerCalled = true;
                    }
                    return true;
                });

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                readyFlag = true;

                // check that noWork callback was called after all items finished processing
                setTimeout(function() {
                    assert.strictEqual(handlerCalled, true, 'noWork handler not called');

                    // then add another item to the queue
                    // add another item to the queue
                    q.add(function() {
                        return new Promise(function(resolveItem, rejectItem) {
                            postNoWorkItemProcessed = true;
                            setTimeout(function() {
                                resolveItem();
                            }, 1000);
                        });
                    });

                    // wait for new item to (potentially) be processed
                    setTimeout(function() {
                        // verify final item was not processed
                        assert.strictEqual(postNoWorkItemProcessed, true, 'final items incorrectly not processed after noWork callback');
                        resolve();
                    }, 2000);
                }, 3000);
            });
        }).timeout(9000);

        it('should call itemProcessed callback after each item has been processed', function () {
            return new Promise(function (resolve, reject) {
                let processedCallbackCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue();

                // add callback
                q.on('itemProcessed', function() {
                    processedCallbackCount++;
                    return true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                // wait for both items to finish
                setTimeout(function () {
                    // verify that the itemProcessed callback was called for each item
                    assert.strictEqual(processedCallbackCount, 2, 'itemProcessed callback called an unexpected number of times');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should pass result from each item to itemProcessed callback', function () {
            return new Promise(function (resolve, reject) {
                let processedCallbackParameterVal = null;

                // initialize WorkQueue
                let q = new WorkQueue();

                // add callback
                q.on('itemProcessed', function(processResult) {
                    processedCallbackParameterVal = processResult;
                    return true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            resolveItem('seven');
                        }, 1000);
                    });
                });

                // wait for both items to finish
                setTimeout(function () {
                    // verify that the itemProcessed callback was called for each item
                    assert.strictEqual(processedCallbackParameterVal, 'seven', 'itemProcessed callback passed incorrect value');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should stop processing more items if itemProcessed callback returns false', function () {
            return new Promise(function (resolve, reject) {
                let processedItemCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('itemProcessed', function() {
                    return false;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemCount, 1, 'processing did not halt after first callback returned false');
                    resolve();
                }, 3000);
            });
        }).timeout(5000);

        it('should stop processing more items if itemProcessed callback returns a Promise that resolves to false', function () {
            return new Promise(function (resolve, reject) {
                let processedItemCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('itemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            resolveHandler(false);
                        }, 1000);
                    });
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemCount, 1, 'processing did not halt after first callback returned false');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should call the error callback if itemProcessed callback returns a Promise that results in an error', function () {
            return new Promise(function (resolve, reject) {
                let processedItemCount = 0;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('itemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        setTimeout(function() {
                            rejectHandler('error in itemProcessed callback');
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCalled = true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should call the error callback if a synchronous itemProcessed callback throws an exception', function () {
            return new Promise(function (resolve, reject) {
                let processedItemCount = 0;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('itemProcessed', function() {
                    throw 'error in itemProcessed callback';
                }).on('error', function() {
                    errorHandlerCalled = true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        setTimeout(function () {
                            processedItemCount++;
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler was not called');
                    resolve();
                }, 5000);
            });
        }).timeout(6000);

        it('should call beforeItemProcessed callback before each item has been processed (i.e. before the enqueued function has been called)', function () {
            return new Promise(function (resolve, reject) {
                let hasBeenProcessed = false;
                let callbackCalledBeforeProcessing = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    callbackCalledBeforeProcessing = !hasBeenProcessed;
                    return true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        hasBeenProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(callbackCalledBeforeProcessing, true, 'beforeItemProcessed callback called after item was processed');
                    resolve();
                }, 2000);
            });
        }).timeout(3000);

        it('should stop processing more items from queue if beforeItemProcessed returns false', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    if (1 === processedItemsCount) {
                        return false;
                    }
                    else {
                        return true;
                    }
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 1, 'incorrect number of processed items');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if beforeItemProcessed returns a Promise that resolves to false', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (1 !== processedItemsCount) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            resolveHandler(false);
                        }, 1000);
                    });
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 1, 'incorrect number of processed items');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should call error callback if beforeItemProcessed returns a Promise that results in an error', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (1 !== processedItemsCount) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            rejectHandler('error during beforeItemProcessed callback');
                        }, 1000);
                    });
                }).on('error', function() {
                    errorHandlerCalled = true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should call error callback if a synchronous beforeItemProcessed throws an exception', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;
                let errorHandlerCalled = false;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    if (1 !== processedItemsCount) {
                        return true;
                    }
                    throw 'error during beforeItemProcessed callback';
                }).on('error', function() {
                    errorHandlerCalled = true;
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(errorHandlerCalled, true, 'error handler not called');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should stop processing more items from queue if beforeItemProcessed returns HALT', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    if (1 === processedItemsCount) {
                        return WorkQueue.BEFORE_CALLBACK_VALS.HALT;
                    }
                    else {
                        return true;
                    }
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 1, 'incorrect number of processed items');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should stop processing more items from queue if beforeItemProcessed returns a Promise that resolves to HALT', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        if (1 !== processedItemsCount) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            resolveHandler(WorkQueue.BEFORE_CALLBACK_VALS.HALT);
                        }, 1000);
                    });
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 1, 'incorrect number of processed items');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should skip the next item (and only that item) if beforeItemProcessed returns SKIP', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;
                let firstItemProcessed = false;
                let secondItemProcessed = false;
                let thirdItemProcessed = false;
                let beforeItemProcessedCallbackCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    // only skip the 2nd item
                    if (2 === ++beforeItemProcessedCallbackCount) {
                        return WorkQueue.BEFORE_CALLBACK_VALS.SKIP;
                    }
                    else {
                        return true;
                    }
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        firstItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        secondItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        thirdItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 2, 'incorrect number of processed items');
                    assert.strictEqual(firstItemProcessed, true, 'first item incorrectly not processed');
                    assert.strictEqual(secondItemProcessed, false, 'second item incorrectly processed');
                    assert.strictEqual(thirdItemProcessed, true, 'third item incorrectly not processed');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should skip the next item (and only that item) if beforeItemProcessed returns a Promise that resolves to SKIP', function () {
            return new Promise(function (resolve, reject) {
                let processedItemsCount = 0;
                let firstItemProcessed = false;
                let secondItemProcessed = false;
                let thirdItemProcessed = false;
                let beforeItemProcessedCallbackCount = 0;

                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 1});

                // add callback
                q.on('beforeItemProcessed', function() {
                    return new Promise(function(resolveHandler, rejectHandler) {
                        // only skip the 2nd item
                        if (2 !== ++beforeItemProcessedCallbackCount) {
                            resolveHandler(true);
                            return;
                        }
                        setTimeout(function() {
                            resolveHandler(WorkQueue.BEFORE_CALLBACK_VALS.SKIP);
                        }, 1000);
                    });
                });

                // add items to queue
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        firstItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        secondItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function () {
                    return new Promise(function (resolveItem, rejectItem) {
                        processedItemsCount++;
                        thirdItemProcessed = true;
                        setTimeout(function () {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function () {
                    assert.strictEqual(processedItemsCount, 2, 'incorrect number of processed items');
                    assert.strictEqual(firstItemProcessed, true, 'first item incorrectly not processed');
                    assert.strictEqual(secondItemProcessed, false, 'second item incorrectly processed');
                    assert.strictEqual(thirdItemProcessed, true, 'third item incorrectly not processed');
                    resolve();
                }, 7000);
            });
        }).timeout(8000);

        it('should replace the error handler if a new error handler is specified', function() {
            return new Promise(function(resolve, reject) {
                let errorHandler2Called = false;
                let errorHandler1Called = false;

                // initialize WorkQueue
                let q = new WorkQueue();

                // set error handler callback
                q.on('error', function(err) {
                    errorHandler1Called = true;
                });
                q.on('error', function(err) {
                    errorHandler2Called = true;
                });

                // add item to queue that will result in an error
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            rejectItem("forced error");
                        }, 1000);
                    });
                });

                // wait for task to finish
                setTimeout(function() {
                    // verify that the error handler was called
                    assert.strictEqual(errorHandler2Called, true, 'newer error handler was not called');
                    assert.strictEqual(errorHandler1Called, false, 'original error handler was (incorrectly) called');
                    resolve();
                }, 3000);
            });
        }).timeout(4000);

        it('should call the paused callback after pausing', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;
                let pausedCallbackCalled = false;

                let q = new WorkQueue({concurrencyLimit: 1});

                q.on('paused', function() {
                    pausedCallbackCalled = true;
                    return true;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items');
                    assert.strictEqual(pausedCallbackCalled, true, 'paused callback not called');
                    resolve();
                }, 6000);
            });
        }).timeout(7000);

        it('should call the resumed callback when resuming processing items', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;
                let resumedCallbackCalled = false;

                let q = new WorkQueue({concurrencyLimit: 1});
                q.on('resumed', function() {
                    resumedCallbackCalled = true;
                    return true;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items after pause');
                    q.resume();
                    setTimeout(function() {
                        assert.strictEqual(processedItemsCount, 4, 'unexpected number of processed items after resume');
                        assert.strictEqual(resumedCallbackCalled, true, 'resumed callback not called');
                        resolve();
                    }, 3000);
                }, 6000);
            });
        }).timeout(10000);

        it('should not call the resumed callback if not paused', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;
                let resumedCallbackCalled = false;

                let q = new WorkQueue({concurrencyLimit: 1});
                q.on('resumed', function() {
                    resumedCallbackCalled = true;
                    return true;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.resume();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 4, 'unexpected number of processed items');
                    assert.strictEqual(resumedCallbackCalled, false, 'resumed callback unexpectedly called');
                    resolve();
                }, 6000);
            });
        }).timeout(7000);

        it('should stop processing more items if the resumed callback returns false', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;

                let q = new WorkQueue({concurrencyLimit: 1});
                q.on('resumed', function() {
                    return false;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items after pause');
                    q.resume();
                    setTimeout(function() {
                        assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items after resume');
                        resolve();
                    }, 3000);
                }, 6000);
            });
        }).timeout(10000);
    });

    describe('#hasWork', function() {
        it('should return false after all enqueued items have finished processing', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue();

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });

                // check hasWork() after all items have finished processing
                setTimeout(function() {
                    assert.strictEqual(q.hasWork(), false, 'hasWork did not return false after processing completed');
                    resolve();
                }, 3000);
            });
         }).timeout(4000);

        it('should return true if there are no remaining items in the queue, but an item is still processing', function() {
            return new Promise(function(resolve, reject) {
                // initialize WorkQueue
                let q = new WorkQueue({concurrencyLimit: 2});

                // add items to the queue
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 5000);
                    });
                });

                // check hasWork() after all items have been dequeued, but an item is still processing
                setTimeout(function() {
                    assert.strictEqual(q.hasWork(), true, 'hasWork did not return true while items are still in-progress');
                    resolve();
                }, 2500);
            });
        }).timeout(5000);
    });

    describe('#pause', function() {
        it('should stop processing more items from the queue', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;

                let q = new WorkQueue({concurrencyLimit: 1});

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items');
                    resolve();
                }, 6000);
            });
        }).timeout(7000);
    });

    describe('#resume', function() {
        it('should continue processing items after pause', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;

                let q = new WorkQueue({concurrencyLimit: 1});

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items after pause');
                    q.resume();
                    setTimeout(function() {
                        assert.strictEqual(processedItemsCount, 4, 'unexpected number of processed items after resume');
                        resolve();
                    }, 3000);
                }, 6000);
            });
        }).timeout(10000);

        it('should wait to continue processing items until after an asynchronous resumed callback completes', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;
                let callbackProcessedItemsCount = 0;

                let q = new WorkQueue({concurrencyLimit: 1});
                q.on('resumed', function() {
                    return new Promise(function(resolveCallback, rejectCallback) {
                        setTimeout(function() {
                            callbackProcessedItemsCount = processedItemsCount;
                            resolveCallback(true);
                        }, 3000);
                    });
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.pause();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 2, 'unexpected number of processed items after pause');
                    q.resume();
                    setTimeout(function() {
                        assert.strictEqual(processedItemsCount, 4, 'unexpected number of processed items after resume');
                        assert.strictEqual(callbackProcessedItemsCount, 2, 'unexpected number of processed items from resumed callback');
                        resolve();
                    }, 7000);
                }, 6000);
            });
        }).timeout(14000);

        it('should have no effect if not paused', function() {
            return new Promise(function(resolve, reject) {
                let processedItemsCount = 0;
                let errorCallbackCalled = false;

                let q = new WorkQueue({concurrencyLimit: 1});
                q.on('error', function(err) {
                    errorCallbackCalled = true;
                    return true;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            q.resume();
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });
                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            processedItemsCount++;
                            resolveItem(true);
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(processedItemsCount, 4, 'unexpected number of processed items');
                    assert.strictEqual(errorCallbackCalled, false, 'error callback unexpectedly called');
                    resolve();
                }, 6000);
            });
        }).timeout(7000);
    });

    describe("#clear", function() {
        it('should remove all not-yet-in-process and not-yet-processed items from the queue', function() {
            return new Promise(function(resolve, reject) {
                let q = new WorkQueue({concurrencyLimit: 1});

                let itemAProcessed = false;
                let itemBProcessed = false;
                let itemCProcessed = false;

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemAProcessed = true;
                            q.clear();
                            resolveItem();
                        }, 1000);
                    });
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemBProcessed = true;
                            resolveItem();
                        }, 1000);
                    });
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            itemCProcessed = true;
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(itemAProcessed, true, 'did not process first item');
                    assert.strictEqual(itemBProcessed, false, '2nd item incorrectly processed');
                    assert.strictEqual(itemCProcessed, false, '3rd item incorrectly processed');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);

        it('should trigger the queueEmpty callback', function() {
            return new Promise(function(resolve, reject) {
                let q = new WorkQueue({concurrencyLimit: 1});

                let queueEmptyCallbackCalled = false;

                q.on('queueEmpty', function() {
                    queueEmptyCallbackCalled = true;
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            q.clear();
                            resolveItem();
                        }, 1000);
                    });
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });

                q.add(function() {
                    return new Promise(function(resolveItem, rejectItem) {
                        setTimeout(function() {
                            resolveItem();
                        }, 1000);
                    });
                });

                setTimeout(function() {
                    assert.strictEqual(queueEmptyCallbackCalled, true, 'queueEmpty callback not called');
                    resolve();
                }, 4000);
            });
        }).timeout(5000);
    });
});