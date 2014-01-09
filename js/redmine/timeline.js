/**
 * 
 * @type {com.rdHelper.Timeline}
 */
com.rdHelper.Timeline = {
    laoded: false,
    timelines: {
//        'updated': (new Date()).toJSON()
    }
};

/**
 * Clear all timelines
 * 
 * @returns {undefined}
 */
com.rdHelper.Timeline.clear = function() {
    this.timelines = {
//        'updated': (new Date()).toJSON()
    };
    this.loaded = false;
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
 * Get amount of timelines
 *
 * @return {Number}
 */
com.rdHelper.Timeline.size = function() {
    return Object.keys(this.timelines).length;
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
        return;
    })(this);
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
    return thiss.loaded;
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
        throw Error("please provide timeline details.");
    }
    var date = new Date();
    if (!timeline.start) {
        timeline.start = date.toJSON();
    }
    onSuccess = onSuccess || function() {};
    //check for existance
    (function(obj) {
        //Create new timeline array if  it not exist
        if (!obj.timelines[timeline.issueId]) {
            obj.timelines[timeline.issueId] = [];
        }
        obj.getActiveByIssueId(timeline.issueId, function(key, res) {
            if (key !== null) {
                if (!obj.timelines[timeline.issueId][key].end) {
                    obj.timelines[timeline.issueId][key].end = date.toJSON();
                }
            }
            obj.timelines[timeline.issueId].push(timeline);
            obj.store(onSuccess);
        });
    })(this);
};

/**
 * Stop working on issue
 * 
 * @param {(number|string)} issueId
 * @param {?string} comment
 * @param {?function()} callback
 */
com.rdHelper.Timeline.stopPoccess = function(issueId, comment, callback) {
    if (!issueId) {
        return;
    }
    if (arguments.length < 3) {
        if (typeof comment == "function") {
            callback = comment;
            comment = "";
        }
    }
    callback = callback || function() {};
    (function(obj) {
        obj.getActiveByIssueId(issueId, function(key, res) {
            if (key === null) {
                callback();
                return;
            }
            var date = new Date();
            var start = new Date(obj.timelines[issueId][key].start);
            obj.timelines[issueId][key].end = date.toJSON();
            obj.timelines[issueId][key].spent = date.getTime() - start.getTime();
            obj.timelines[issueId][key].comment = comment;
            obj.store();
            /**
             * Send data to Redmiine server
             */
            var hours = obj.timelines[issueId][key].spent / (1000*60*60);
            var time = (hours).toFixed(2);
            redmineApi.time_entry.create({
                issue_id: issueId,
                hours: time,
                comments: comment.length > 255 ? comment.substr(0, 254) : comment
            }, function(err, data) {
                if (!err && data.time_entry) {
                    //update id
                    obj.timelines[issueId][key].redmineId = data.time_entry.id;
                    obj.store();
                }
            });
            //callback
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
com.rdHelper.Timeline.getByIssueId = function(issueId, callback) {
    callback = callback || function() {};
    (function(obj) {
        obj.all(function(timelines) {
            if (!obj.timelines[issueId]) {
                obj.timelines[issueId] = [];
            }
            callback(obj.timelines[issueId]);
            return;
        });
    })(this);
    return;
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
            //Check for timeline existance
            if (!obj.timelines[issueId]) {
                callback(null, null);
            }
            for(var i = 0; i < obj.timelines[issueId].length; i++) {
                if (obj.timelines[issueId][i].issueId == issueId && !obj.timelines[issueId][i].end) {
                    callback(i, obj.timelines[issueId][i]);
                    return;
                }
            }
            callback(null, null);
        });
    })(this);
};

/**
 * Remove timeline entry
 *
 * @param {Object} timeline
 * @param {number} issueId
 * @param {function()=} callback
 */
com.rdHelper.Timeline.remove = function(timeline, issueId, callback) {
    if (arguments.length < 2 || typeof timeline != "object" || typeof issueId == "function") {
       return;
    }
    callback = callback || function() {};
    (function(obj) {
        obj.all(function() {
            if (!obj.timelines[issueId]) {
                callback();
                return;
            }
            for(var i = 0; i < obj.timelines[issueId].length; i++) {
                var tt = obj.timelines[issueId][i];
                if (tt.start == timeline.start && tt.issueId == timeline.issueId) {
                    /**
                     * Check if issue syncked with redmine
                     * If so we have to remove it from redmine too
                     */
                    if (tt.redmineId && tt.redmineId > 0) {
                        redmineApi.time_entry.del(tt.redmineId, function() {});
                    }
                    obj.timelines[issueId].splice(i, 1);
                    break;
                }
            }
            obj.store();
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
            /**
             * Clear items in redmine
             */
            for(var i = 0; i < obj.timelines[issueId].length; i++) {
                var tt = obj.timelines[issueId][i];
                /**
                 * Check if issue syncked with redmine
                 * If so we have to remove it from redmine too
                 */
                if (tt.redmineId && tt.redmineId > 0) {
                    redmineApi.time_entry.del(tt.redmineId, function() {});
                }
            }
            if (obj.timelines[issueId]) {
                delete obj.timelines[issueId];
            }
            callback();
        });
    })(this);
};
