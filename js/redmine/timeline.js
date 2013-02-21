/**
 * 
 * @type {com.rdHelper.Timeline}
 */
com.rdHelper.Timeline = {
    laoded: false,
    timelines: {}
};

/**
 * Default timeline object
 * 
 * @type Object
 */
com.rdHelper.Timeline.timelineBase = {
    'id': 0,
    'issueId': 0,
    'start': new Date(),
    'end': null
};

/**
 * Default callback for Timeline API
 * @param {number} key
 * @param {Object} timeline
 */
com.rdHelper.Timeline.callback = function(key, timeline) {};

/**
 * Store timelines 
 * 
 * @param {function()} onSuccess
 */
com.rdHelper.Timeline.store = function(onSuccess) {
    chrome.storage.local.set({'timelines': this.timelines}, onSuccess);
};

/**
 * Get all available timelines
 * 
 * @param {boolean} reload
 * @param {function(Object)} onLoad
 */
com.rdHelper.Timeline.all = function(reload, onLoad) {
    if (arguments.length < 2 && typeof reload == "function") {
        onLoad = reload;
        reload = false;
    } 
    if (this.loaded && !reload) {
        onLoad(this.timelines);
        return;
    }
    (function(obj) {
        obj.load(function() {
            onLoad(obj.timelines);
        });
    })(this);
    return;
};

/**
 * Load timelines from storage
 * 
 * @param {function()} onLoad
 */
com.rdHelper.Timeline.load = function(onLoad) {
    onLoad = onLoad || function() {};
    (function(obj) {
        chrome.storage.local.get('timelines', function(items) {
            obj.loaded = true;
            if (items.timelines) {
                obj.timelines = items.timelines;
            }
            onLoad();
        });
    })(this);
};

/**
 * Check if loaded
 * 
 * @returns {boolean}
 */
com.rdHelper.Timeline.isLoaded = function() {
    return this.loaded;
};

/**
 * Add new Timeline
 * 
 * @throws {Error} if no timeline details passed
 * @param {Object} timeline Timeline details
 * @param {function()=} onSuccess success handler
 */
com.rdHelper.Timeline.add = function(timeline, onSuccess) {
    if (arguments.length < 2 && typeof timeline != "object" || !timeline.issueId) {
        throw new Error("please provide timeline details.");
    }
    var date = new Date();
    if (!timeline.start) {
        timeline.start = date.toJSON();
    }
    onSuccess = onSuccess || function() {};
    //check for existance
    (function(obj) {
        //Create new timeline array if  it not exist
        if (!obj.timelines["i"+timeline.issueId]) {
            obj.timelines["i"+timeline.issueId] = [];
        }
        obj.getActiveByIssueId(timeline.issueId, function(key, res) {
            if (key !== null) {
                if (!obj.timelines["i"+timeline.issueId][key].end) {
                    obj.timelines["i"+timeline.issueId][key].end = date.toJSON();
                }
            }
            obj.timelines["i"+timeline.issueId].push(timeline);
            obj.store(onSuccess);
        });
    })(this);
};

/**
 * Stop working on issue
 * 
 * @param {(number|string)} issueId
 * @param {?function()} callback
 */
com.rdHelper.Timeline.stopPoccess = function(issueId, callback) {
    if (!issueId) {
        return;
    }
    callback = callback || function() {};
    (function(obj) {
        obj.getActiveByIssueId(issueId, function(key, res) {
            if (key === null) {
                callback();
                return;
            }
            var date = new Date();
            var start = new Date(obj.timelines["i"+issueId][key].start);
            obj.timelines["i"+issueId][key].end = date.toJSON();
            obj.timelines["i"+issueId][key].spent = date.getTime() - start.getTime();
            obj.store();
            callback();
        });
    })(this);
};

/**
 * Get timeline By id
 * 
 * @depricated
 * @param {type} id
 * @param {function(?number, ?Object)} callback
 */
com.rdHelper.Timeline.get = function(id, callback) {
    callback = callback || this.callback;
    (function(obj) {
        obj.all(function(timelines) {
            for(var i in timelines) {
                if (timelines[i].id == id) {
                    callback(i, timelines[i]);
                    return;
                }
            }
            callback(null, null);
            return;
        });
    })(this);
    return;
};

/**
 * Searches Timeline by issue ID 
 * 
 * @depricated
 * @param {(number|string)} issueId
 * @param {function(?Array)} callback
 */
com.rdHelper.Timeline.getByIssueId = function(issueId, callback) {
    callback = callback || function() {};
    (function(obj) {
        obj.all(function(timelines) {
            if (!obj.timelines["i"+issueId]) {
                obj.timelines["i"+issueId] = [];
            }
            callback(obj.timelines["i"+issueId]);
            return;
        });
    })(this);
    return;
};

/**
 * Searches Timeline by issue ID 
 * 
 * @deprecated
 * @param {(number|string)} issueId
 * @param {function(?Array)} callback
 */
com.rdHelper.Timeline.getActiveByIssueId = function(issueId, callback) {
    callback = callback || this.callback;
    (function(obj) {
        obj.all(function(timelines) {
            //Check for timeline existance
            if (!obj.timelines["i"+issueId]) {
                callback(null, null);
            }
            for(var i in obj.timelines["i"+issueId]) {
                if (obj.timelines["i"+issueId][i].issueId == issueId && !obj.timelines["i"+issueId][i].end) {
                    callback(i, obj.timelines["i"+issueId][i]);
                    return;
                }
            }
            callback(null, null);
        });
    })(this);
};

/**
 * 
 * @param {} key
 * @param {function} callback
 */
com.rdHelper.Timeline.removeByKey = function(key, callback) {
    if(!key) {
        return;
    }
    callback = callback || function() {};
    (function(obj) {
        obj.all(function() {
            if (obj.timelines[key]) {
                delete obj.timelines[key];
            }
            callback();
        });
    })(this);
};

/**
 * Searches Timeline by issue ID 
 * 
 * @param {(number|string)} issueId
 * @param {function(?Array)} callback
 */
com.rdHelper.Timeline.clearByIssueId = function(issueId, callback) {
    callback = callback || function() {};
    (function(obj) {
        obj.all(function(timelines) {
            if (obj.timelines["i"+issueId]) {
                delete obj.timelines["i"+issueId];
            }
            callback();
        });
    })(this);
};

/**
 * Clear all timelines
 * 
 * @returns {undefined}
 */
com.rdHelper.Timeline.clear = function() {
    this.timelines = {};
    this.loaded = false;
};
