/**
 * 
 * @type {com.rdHelper.Timeline}
 */
com.rdHelper.Timeline = {
    laoded: false,
    timelines: []
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
        return this.timelines;
    }
    (function(obj) {
        obj.load(function() {
            onLoad(obj.timelines);
        });
    })(this);
    return this.timelines;
};

com.rdHelper.Timeline.allGroupedByIssues = function(onSuccess) {
    
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
            console.log(items);
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
        obj.getActiveByIssueId(timeline.issueId, function(key, res) {
            if (key !== null) {
                if (!obj.timelines[key].end) {
                    obj.timelines[key].end = date.toJSON();
                }
            }
            obj.timelines.push(timeline);
            obj.store(onSuccess);
        });
    })(this);
};

/**
 * Get timeline By id
 * 
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
        });
    })(this);
};

/**
 * Searches Timeline by issue ID 
 * 
 * @param {(number|string)} issueId
 * @param {function(?Array)} callback
 */
com.rdHelper.Timeline.getByIssueId = function(issueId, callback) {
    callback = callback || function() {};
    (function(obj) {
        obj.all(function(timelines) {
            var result = [];
            for(var i in timelines) {
                if (timelines[i].issueId == issueId) {
                    result.push(timelines[i]);
                }
            }
            callback(result);
        });
    })(this);
};

/**
 * Searches Timeline by issue ID 
 * 
 * @param {(number|string)} issueId
 * @param {function(?Array)} callback
 */
com.rdHelper.Timeline.getActiveByIssueId = function(issueId, callback) {
    callback = callback || this.callback;
    (function(obj) {
        obj.all(function(timelines) {
            for(var i in timelines) {
                if (timelines[i].issueId == issueId && !timelines[i].end) {
                    callback(i, timelines[i]);
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
            for(var i in obj.timelines) {
                if (obj.timelines[i].issueId == issueId) {
                    delete obj.timelines[i];
                }
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
    this.timelines = [];
    this.loaded = false;
};
