
/**
 * 
 * @class Config
 * @returns {Config}
 */
function Config() {
    this.profile = {
        chiliProject: false,
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