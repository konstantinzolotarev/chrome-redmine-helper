/**
 * 
 * @type {com.rdHelper.Timeline}
 */
com.rdHelper.Timeline = {
    laoded: false,
    timelines: []
};

com.rdHelper.Timeline.store = function() {};

com.rdHelper.Timeline.load = function() {};

com.rdHelper.Timeline.add = function() {};

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
