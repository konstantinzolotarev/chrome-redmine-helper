
/**
 * Users representation class
 * 
 * @class 
 * @returns {Users}
 */
com.rdHelper.Users = {
    loaded: false,
    users: {}
};

/**
 * Clears list of users
 */
com.rdHelper.Users.clear = function() {
    this.users = {};
    this.loaded = false;
};

/**
 * Store users data
 *
 * @param {?function()} callback
 */
com.rdHelper.Users.store = function(callback) {
    callback = callback || function() {};
    chrome.storage.local.set({'users': this.users}, callback);
};

/**
 * Load users from storage
 *
 * @param {boolean=} reload
 * @param {?function(Object)} callback 
 */
com.rdHelper.Users.load = function(reload, callback) {
    if (arguments.length < 2 && typeof reload == "function") {
        callback = reload;
        reload = false;
    }
    callback = callback || function() {};
    if (!reload && this.loaded) {
        callback(this.users);
    }
    (function(obj) {
        chrome.storage.local.get('users', function(item) {
            if (!item.users) {
                callback({});
            }
            obj.users = item.users;
            obj.loaded = true;
            callback(obj.users);
        });
    })(this);
};

/**
 * Get all projects
 *
 * @param {boolean} reload
 * @param {function()=} callback
 */
com.rdHelper.Users.all = function(reload, callback) {
    if (arguments.length < 2 && typeof reload == "function") {
        callback = reload;
        reload = false;
    }
    if (this.loaded && !reload) {
        callback(this.users);
        return;
    }
    (function(obj) {
        obj.load(function() {
            callback(obj.users);
        });
        return;
    })(this);
};

/**
 * Add new user to the list 
 * 
 * @param {Object} user
 * @param {function()=} callback 
 */
com.rdHelper.Users.push = function(user, callback) {
    if (!user || !user.id || !user.name) {
        return;
    }
    callback = callback || function() {};
    (function(obj) {
        obj.all(function() {
            if (!obj.users[user.id]) {
                obj.users[user.id] = user;
                obj.store();
            }
            callback();
            return;
        });
        return;
    })(this);
};

/**
 * Grab users from issue
 *
 * @param {Object} issue
 */
com.rdHelper.Users.grabFromIssue = function(issue) {
    this.push(issue.assigned_to);
    this.push(issue.author);
};

/**
 * Get username by userId
 *
 * @throws {Error} Error if users not loaded
 * @param {int} userId
 * @returns {String} 
 */
com.rdHelper.Users.getNameById = function(userId) {
    if (!this.loaded) {
        throw Error("Users are not loaded !");
    }
    if (!this.users[userId]) {
        return userId;
    }
    return this.users[userId].name;
};