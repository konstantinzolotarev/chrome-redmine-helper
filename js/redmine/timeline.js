/**
 * 
 * @type {com.rdHelper.Timeline}
 */
com.rdHelper.Timeline = {
    laoded: false,
    timelines: []
};

/**
 * Store timelines 
 * 
 * @param {function()} onSuccess
 */
com.rdHelper.Timeline.store = function(onSuccess) {
    chrome.storage.sync.set({'timelines': this.timelines}, onSuccess);
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

/**
 * Load timelines from storage
 * 
 * @param {function()} onLoad
 */
com.rdHelper.Timeline.load = function(onLoad) {
    onLoad = onLoad || function() {};
    (function(obj) {
        chrome.storage.sync.get('timelines', function(items) {
            console.log(items);
            obj.loaded = true;
            if (items.timelines) {
                obj.timelines = items.timelines;
            }
            onLoad();
        });
    })(this);
};

com.rdHelper.Timeline.add = function(timeline) {};

com.rdHelper.Timeline.get = function() {};

/**
 * Clear all timelines
 * 
 * @returns {undefined}
 */
com.rdHelper.Timeline.clear = function() {
    this.timelines = [];
    this.loaded = false;
};
