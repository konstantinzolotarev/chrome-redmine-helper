
/**
 * 
 * @class Config
 * @returns {Config}
 */
function Config() {
    this.profile = {
        host: "",
        apiAccessKey: "",
        useHttpAuth: false,
        httpUser: "",
        httpPass: "",
        selectedProject: false,
        currentUserName: false,
        currentUserId: false,
        //Added into version 0.9
        notifications: {
            show: 'none'
        },
        projects: {
            show_for: 'all',
            list: []
        },
        table: {
            project: true,
            author: true,
            tracker: false,
            status: false
        },
        test: "Test passed"
    };
    this.loaded = false;
}

/**
 * Check if config is empty
 * 
 * @returns {boolean}
 */
Config.prototype.isEmpty = function() {
    return (this.profile.host == "" && this.profile.apiAccessKey == "");
};

/**
 * Create new exmpty config in localstorage
 * 
 * @returns {void}
 */
Config.prototype.initNew = function() {
    this.store(this.profile);
};

/**
 * Check if configs are already loaded
 * 
 * @return {boolean}
 */
Config.prototype.isLoaded = function() {
    return this.loaded;
};

/**
 * Load config from locaStorage
 */
Config.prototype.load = function() {
    if (this.isLoaded()) {
        return;
    }
    var profile = localStorage.profile || false;
    if (!profile) {
        this.initNew();
        this.loaded = true;
        return;
    }
    var loadedProfile = JSON.parse(profile);
    this.profile = merge(this.profile, loadedProfile);
    this.loaded = true;
    return;
};

/**
 * Store given profile into localStorage
 * 
 * @param {Object} profile
 * @returns {void}
 */
Config.prototype.store = function(profile) {
    if (profile.host.lastIndexOf("/") != (profile.host.length - 1)) {
        profile.host += "/";
    }
    localStorage['profile'] = JSON.stringify(profile);
};

/**
 * Get host for Redmine
 * 
 * @returns {String} Host
 */
Config.prototype.getHost = function() {
    return this.profile.host;
};

/**
 * Get user apiAccessKey
 * 
 * @returns {String} apiAccessKey
 */
Config.prototype.getApiAccessKey = function() {
    return this.profile.apiAccessKey;
};

/**
 * Get profile
 * 
 * @returns {Object}
 */
Config.prototype.getProfile = function() {
    this.load();
    return this.profile;
};

/**
 * Get settings for project filters
 * 
 * @returns {Object}
 */
Config.prototype.getProjectsSettings = function() {
    if (!this.getProfile().projects) {
        this.getProfile().projects = {
            show_for: 'all',
            list: []
        };
    }
    return this.getProfile().projects;
};

/**
 * Get notifications options
 * 
 * @returns {Object} 
 */
Config.prototype.getNotifications = function() {
    return this.profile.notifications;
};

/**
 * 
 * @param {string} id
 * @returns {void}
 */
Config.prototype.setSelectedProject = function(id) {
    if (projects.getById(id).project !== false) {
        this.profile.selectedProject = id;
        this.store(this.profile);
    }
};

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
    xhr.setRequestHeader("X-Redmine-API-Key", getConfig().getApiAccessKey());
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
    xhr.onerror = requestError;
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
    xhr.onerror = requestError;
    xhr.send(data);
};
