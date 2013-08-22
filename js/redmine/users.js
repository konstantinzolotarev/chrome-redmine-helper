
/**
 * Users representation class
 * 
 * @class 
 * @returns {Users}
 */
com.rdHelper.Users = {

    /**
     * Flag showing that users are already loaded
     *
     * @var {boolean}
     */
    loaded: false,

    /**
     * List of loaded users
     *
     * @var {Object}
     */
    users: {},

    /**
     * Clear list of users and set {@link com.rdHelper.Users#loaded} to false
     */
    clear: function() {
        this.users = {};
        this.loaded = false;
    },

    /**
     * Store users in chrome local storage
     *
     * @param {function()=} [callback]
     */
    store: function(callback) {
        callback = callback || function() {};
        chrome.storage.local.set({'users': this.users}, callback);
    },

    /**
     * Load users from storage
     *
     * @param {boolean=} [reload]
     * @param {function(?Object)=} [callback]
     */
    load: function(reload, callback) {
        if (arguments.length < 2 && typeof reload == "function") {
            callback = reload;
            reload = false;
        }
        callback = callback || function() {};
        if (!reload && this.loaded) {
            callback(this.users);
            return;
        }
        chrome.storage.local.get('users', function(item) {
            if (!item.users) {
                this.users = {};
                callback(null);
                return;
            }
            this.users = item.users;
            this.loaded = true;
            callback(this.users);
        }.bind(this));
    },

    /**
     * Get all users. This is just reference to {@link com.rdHelper.Users#load} method
     *
     * @deprecated
     * @param {boolean|function} [reload]
     * @param {function()=} [callback]
     */
    all: function(reload, callback) {
        this.load(reload, callback);
    },

    /**
     * Add new user to the list
     *
     * @param {Object} user
     * @param {function()=} [callback]
     */
    push: function(user, callback) {
        if (!user || typeof user !== 'object' || !user.id || !user.name) {
            return;
        }
        callback = callback || function() {};
        this.load(function() {
            if (!this.users[user.id]) {
                this.users[user.id] = user;
                this.store();
            }
            callback();
        }.bind(this));
    },

    /**
     * Grab users from issue object
     *
     * @param {Object} issue
     */
    grabFromIssue: function(issue) {
        if (!issue || typeof issue !== 'object') {
            return;
        }
        if (issue.assigned_to && typeof issue.assigned_to === 'object') {
            this.push(issue.assigned_to);
        }
        if (issue.author && typeof issue.author === 'object') {
            this.push(issue.author);
        }
    },

    /**
     * Get username by userId
     *
     * @throws {Error} Error if users not loaded
     * @param {int} userId
     * @returns {String}
     */
    getNameById: function(userId) {
        if (!userId || typeof userId !== 'number') {
            return "";
        }
        if (!this.loaded) {
            throw Error("Users are not loaded !");
        }
        if (!this.users[userId]) {
            return "Unknown user";
        }
        return this.users[userId].name;
    }
};