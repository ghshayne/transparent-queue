## Table of Contents
[Summary](#summary)

[Workflow](#workflow)

[Basic Usage](#basic-usage)

[Processor Promise Return Values](#processor-promise-return-values)

[Event Handlers](#event-handlers)

[itemProcessed Handler](#itemprocessed-handler)

[queueSizeChange Handler](#queuesizechange-handler)

[Error Handling](#error-handling)

[Halting Processing](#halting-processing)

[Pause/Resume](#pauseresume)

[Alternate Usage Patterns](#alternate-usage-patterns)

## Summary
<p>There are many work-queue packages available.</p>
<p>Like most of them, this one allows you to add a bunch of asynchronous activities to a queue, to be processed (at most) _n_ items at a time. This may be useful for situations where, for example, the asynchronous activity may involve file I/O and the application wants to limit the number of file handles open at any given time.</p>
<p>Where this package differs from others is that this API focuses on giving the application as much transparency as possible into the current state of the queue, with the aim that the application can then intelligently control processing based on factors such as how many items are in the queue at any given time, how many items are currently actively running, when items have completed, when the queue is empty, etc.</p>

## Workflow
The general usage is:
1. Create a work queue instance
2. Set up a *processor* function that will be called to asynchronously process each item
3. Set a *concurrencyLimit* on the instance to limit how many items may be processed asynchronously at any given moment 
4. Add any *handler* callback functions
5. Add items to the queue

The work queue instance will keep a backlog (*queue*) of items to be processed, and will call the *processor* function and pass it one item (from the queue) at a time. The *processor* function is expected to return a Promise for processing one item.

The work queue will keep track of how many pending Promises (returned from the *processor* function) are outstanding at any given time. The work queue will wait until there are less than *concurrencyLimit* number of pending Promises before pulling the next item from the queue and passing it to the *processor* function. This ensures that there are at most *concurrencyLimit* number of items being asynchronously processed at any given time.

## Basic Usage
<p>This package can be used in few different ways, but the simplest is probably:</p> 

```javascript
const WorkQueue = require('transparent-work-queue');

let q = new WorkQueue({
    concurrencyLimit: 2,
    processor: (item) => {
        return new Promise(function(resolve, reject) {
            // do something asynchronous with item
        });
    } 
});
q.on('noWork', () => {
    // do something after all enqueued items have been processed
});

q.add('d');
q.addAll([a, b, c]);
```
In the above example, we set up a work queue (*q*) with a processor function that will be called once for every item in the queue. The processor function will be passed one item at a time, and is expected to return a Promise for processing that item (presumably asynchronously). For example, the processor function might write a file for each enqueued item, or it might make a database update for each enqueued item.

This instance has also been set up with a *concurrencyLimit* of 2. This means that no matter how many items are added to the queue, at most only 2 items will be processed at a time.

Then we add items to the queue. 

When all of these items have been processed - meaning, all of the enqueued items have been passed to the *processor* function, and all of the Promises returned from the *processor* function have all resolved - then the *noWork* callback will be called.

(See *Alternate Usage Patterns* below for alternate APIs.)

## Processor Promise Return Values
The WorkQueue does not keep track of the values resolved from each Promise returned from the *processor* function.

However, if one of the Promises resolves to false, this will be interpreted as a command to stop processing more items from the queue. Any other parallel pending Promises will be allowed to complete, but no additional items will be pulled off of the queue, and the *processor* function will not be called to generate any additional Promises.

In this case, the *halted* callback will be called (if any was specified). See "Halting Processing" below for more details about the *halted* callback.

## Event Handlers
The following event handler callbacks are available:

- _queueEmpty_: This is triggered as soon as the last item is pulled off of the queue for processing.
- _noWork_: This is triggered after the queue is empty *and* all items have completed processing.
- _paused_: This is triggered immediately after processing has been *paused* (see *Pause/Resume*, below). 
- _resumed_: This is triggered immediately after processing has *resumed* after a pause (see *Pause/Resume*, below).
- _afterHaltCompleted_: This is triggered after a *halt* (see *Halting Processing* below), after all remaining in-progress Promises have resolved.
- _afterPauseCompleted_: This is triggered after a *pause* (see *Pause/Resume*, below), after all remaining in-progress Promises have resolved.

All event handlers may return a value (synchronously) or may return a Promise. If an event handler returns false, or returns a Promise that resolves to false, that is interpreted as a command to stop processing any more items from the queue, and the *halted* handler will be called (see *Halting Processing*, below).

If an event handler throws an exception, or returns a Promise that rejects, that will trigger the *error* handler callback (see *Error Handling*, below).

Event handlers are specified using the *on* API - for example:

```javascript
q.on('noWork', () => {
    // do something after all enqueued items have been processed
});
```

## beforeItemProcessed Handler
If specified, the *beforeItemProcessed* handler will be triggered before each item in the queue is processed (meaning, before the *processor* function is called with each item).

Unlike other handlers, the *beforeItemProcessed* handler is expected to return one of the following values:
- BEFORE_CALLBACK_VALS.HALT: all processing for this queue will halt
- BEFORE_CALLBACK_VALS.CONTINUE: processing will proceed as normal
- BEFORE_CALLBACK_VALS.SKIP: this particular item will not be processed, but subsequent items from the queue will be processed as normal

As with any other handler, if the *beforeItemProcessed* handler results in an error, then the *error* handler will be called.

For example:
```javascript
q.on('beforeItemProcessed', () => {
    // do something before each item is processed
    return WorkQueue.BEFORE_CALL_BACK_VALS.CONTINUE;
});
```

## itemProcessed Handler
If specified, the *itemProcessed* handler is triggered after an item has been processed - that is, after it has been pulled off of the queue and passed to the *processor* function, and the *processor* function has completed.

This handler behaves similarly to other handlers, but the *itemProcessed* handler will be passed a value representing the result of the *processor* function.

For example:
```javascript
q.on('itemProcessed', (result) => {
    // do something after each item is processed (possibly conditional based on result)
});
```

## queueSizeChange Handler
If specified, the *queueSizeChange* handler is triggered every time an item is added to or pulled off of the queue. Note that this handler is called as soon as an item is pulled off of the queue, before it is processed.

This handler behaves similarly to other handlers, but the *queueSizeChange* handler will be passed a value representing the new current queue size.

For example:
```javascript
q.on('queueSizeChange', (newCount) => {
    // do something when the queue size has changed - for example, the application may pause/resume adding items to the
    // queue depending on queue size
});
```


## Error Handling
It is not technically necessary to specify an *error* handler. If no *error* handler is specified, then any errors encountered during processing or from other handlers will be ignored.

If an *error* handler is specified, it may be called in several situations:

- If the *processor* function throws an exception
- If the Promise returned from the *processor* function rejects
- If any handler callback throws an exception
- If any handler callback returns a Promise that rejects
- If invalid parameters are passed to this module's APIs
- If this package's internal code produces an unexpected error

In any of these scenarios, the *error* callback will be called (if any was specified), and will be passed a WorkQueueError object with more details about what went wrong. A WorkQueueError is a subclass of the standard JavaScript Error - in addition to the stack trace and a message string, this also contains a *source*, which may be any of:

- ERROR_SOURCES.CALLBACK: the error came from a handler callback (or from the Promise it returned)
- ERROR_SOURCES.PROCESS: the error came from the *processor* function (or from the Promise it returned)
- ERROR_SOURCES.BADREQUEST: there was a problem with how the API was used
- ERROR_SOURCES.INTERNAL: the error was something internal to this module (contact support)

The *error* handler (if any) may return a value (synchronously) or may return a Promise. If the *error* handler returns false, or returns a Promise that resolves to false, or throws an exception, or returns a Promise that rejects: then the WorkQueue will stop processing more items from the queue and will call the *halted* handler (if any was specified). Otherwise, the WorkQueue will continue processing other items from the queue as normal.

For example:
```javascript
q.on('error', (err) => {
    // for this example, if a callback handler triggered this error, return false (halt processing);
    // otherwise just ignore it
    if (WorkQueue.ERROR_SOURCES.CALLBACK === err.source) {
        return false;
    }
    else {
        return true;
    }
});
```

## Halting Processing
All work queue processing may be *halted* in any of the following situations:

- The *error* callback threw an exception
- Any callback (including the *error* callback) returned false
- Any callback (including the *error* callback) returned a Promise that resolved to false
- The *processor* function returned a Promise that resolved to false
- This package's internal code produced an unexpected error

In any of these scenarios, processing will be *halted* - this means that any pending Promises will be allowed to complete, but no additional items will be pulled off of the queue, and the *processor* function will not be called to generate any additional Promises. Once processing has *halted*, it cannot be resumed.

A *halted* handler may (optionally) be specified. If no *halted* handler is specified, then any scenario that halts processing will still do so, but the application will not be notified.

The *halted* handler (if specified) will be passed a WorkQueueHaltData object with more details about what caused processing to halt. A WorkQueueHaltData object contains the following:
- *reason*: may be any of the following values:
    - HALT_REASONS.CALLBACKRETVAL: A callback returned false or HALT
    - HALT_REASONS.ERRORCALLBACKERROR: A callback resulted in an error
    - HALT_REASONS.PROCESSRETVAL: The *processor* function returned false
    - HALT_REASONS.INTERNAL: There was an error in this module's code
- *error*: a WorkQueueError object representing the error that triggered the halt (if applicable)
- *callback*: a string indicating which callback triggered the halt (if applicable)

The *halted* handler (if any) may return a value (synchronously) or may return a Promise.
    
Note that if the *halted* handler itself results in an error, the *error* callback will be called - but processing will be halted regardless of the *error* callback return value.

For example:
```javascript
q.on('halted', (haltCause) => {
    console.log("WorkQueue processing halted due to " + haltCause.reason + ": " + haltCause.error);
});
```

## Pause/Resume
Queue processing may be paused at any time - either from within an event handler, or external to queue processing - by calling the *pause* API on the work queue instance.

For example:
```javascript
q.pause();
```

While the work queue is *paused*, no additional items will be pulled off of the queue for processing (until *resume* is called).

As soon as the work queue has been paused, the *paused* event handler will be triggered.

While paused, when all remaining in-progress items have been processed (leaving the work queue idle), the *afterPauseCompleted* event handler will be triggered.

Once paused, normal processing of enqueued items may be resumed by calling the *resume* API (again, this may be called from within an event handler or externally). For example:

For example:
```javascript
q.resume();
```

As soon as the *resume* API is called, the *resumed* event handler is triggered.

## Alternate Usage Patterns
*Basic Usage* described a usage pattern where objects are enqueued, and a single function is specified for processing each item in the queue.

Alternatively, the queue may consist of function calls themselves. For example:

```javascript
q.add(function() {
    return new Promise(function(resolve, reject) {
        // do something asynchronous
    });
});
q.add(function() {
  return new Promise(function(resolve, reject) {
    // do something asynchronous
  });
});
```

In this case, each function will be executed when that item is pulled off of the queue for processing. For these kinds of enqueued items, the *processor* function is ignored.

Note that a mix of item-types may be enqueued at the same time.