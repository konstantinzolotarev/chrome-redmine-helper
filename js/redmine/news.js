/**
 * Projects actions 
 * 
 * @class
 * @returns {com.rdHelper.News}
 */
com.rdHelper.News = {};

/**
 * Load latest news list
 *
 * @param {Function} cb
 */
com.rdHelper.News.load = function(cb) {
    cb = cb || function() {};
    redmineApi.news.all(function(gerror, json) {
    	if (gerror) {
    		return cb(gerror);
    	}
    	return cb(null, json);
    });
};