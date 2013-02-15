
/**
 * 
 * @class
 * @returns {Loader}
 */
function Loader() {
}

/**
 * Create new XMLHttpRequest Object
 * 
 * @param {String} method
 * @param {String} url
 * @param {boolean} async
 */
Loader.prototype.createXhr = function(method, url, async, preventContentType) {
    var xhr = new XMLHttpRequest();
    var fullUrl = getConfig().getHost() + url;
    if (config.getProfile().useHttpAuth) {
        xhr.open(method, fullUrl, (async || true), config.getProfile().httpUser, config.getProfile().httpPass);
    } else {
        xhr.open(method, fullUrl, (async || true));
    }
    if (config.getProfile().chiliProject) {
        //We need another header info for connecting to ChiliProject
        xhr.setRequestHeader("X-ChiliProject-API-Key", getConfig().getApiAccessKey());
    } else {
        xhr.setRequestHeader("X-Redmine-API-Key", getConfig().getApiAccessKey());
    }
    if (!preventContentType) {
        xhr.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    }
    return xhr;
};

/**
 * Send GET request to URL
 * 
 * @param {string} url
 * @param {Function} success
 * @param {Function} error Error handler for invalid status
 * @returns {void}
 */
Loader.prototype.get = function(url, success, error) {
    var xhr = this.createXhr("GET", url);
    //Check input date
    success = success || function(data) {};
    error = error || function() {};
    //success handler
    xhr.onload = function(e) {
        if (this.status == 200) {
            var data = JSON.parse(this.response);
            success(data);
        } else {
            error(e, this);
        }
    };
    //error handler
    xhr.onerror = requestError;
    xhr.send();
};

/**
 * Make POST request with file
 * 
 * @param {String} url
 * @param {mixed} data
 * @param {Function} success
 * @param {Function} error
 * @returns {undefined}
 */
Loader.prototype.upload = function(url, data, success, error) {
    var xhr = this.createXhr("POST", url, true, true);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    //Check input date
    data = data || "";
    success = success || function() {};
    error = error || function() {};
    //success handler
    xhr.onload = function(e) {
        if (this.status == 200 || this.status == 201) {
            success(this);
        } else {
            error(e, this);
        }
    };
    //error handler
    xhr.onerror = error;
    xhr.send(data);
};

/**
 * Make POST request 
 * 
 * @param {String} url
 * @param {mixed} data
 * @param {Function} success
 * @param {Function} error
 * @returns {undefined}
 */
Loader.prototype.post = function(url, data, success, error) {
    var xhr = this.createXhr("POST", url);
    //Check input date
    data = data || "";
    success = success || function() {};
    error = error || function() {};
    //success handler
    xhr.onload = function(e) {
        if (this.status == 200 || this.status == 201) {
            success(this);
        } else {
            error(e, this);
        }
    };
    //error handler
    xhr.onerror = error;
    xhr.send(data);
};

/**
 * Make PUT request 
 * 
 * @param {String} url
 * @param {mixed} data
 * @param {Function} success
 * @param {Function} error
 * @returns {undefined}
 */
Loader.prototype.put = function(url, data, success, error) {
    var xhr = this.createXhr("PUT", url);
    //Check input date
    data = data || "";
    success = success || function() {};
    error = error || function() {};
    //success handler
    xhr.onload = function(e) {
        if (this.status == 200 || this.status == 201) {
            success({});
        } else {
            error(e, this);
        }
    };
    //error handler
    xhr.onerror = error;
    xhr.send(data);
};