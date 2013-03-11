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
 * @param {Function} success
 * @param {Function} error
 */
com.rdHelper.News.load = function(success, error) {
    if (!success) {
        success = function() {};
    }
    if (!error) {
        error = function() {};
    }
    redmineApi.news.all(function(gerror, json) {
    	if (gerror) {
    		error(error);
    		return;
    	}
    	success(json);
    });
};