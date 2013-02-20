
/**
 * Users representation class
 * 
 * @class 
 * @returns {Users}
 */
com.rdHelper.Users = {
    loaded: localStorage.users_loaded || false,
    users: JSON.parse(localStorage.users || "[]")
}

/**
 * Grab users from issue
 * 
 * @param {Object} issue
 * @returns {undefined}
 */
com.rdHelper.Users.grabFromIssue = function(issue) {
    this.push(issue.assigned_to);
    this.push(issue.author);
};

/**
 * Add new user to the list 
 * 
 * @param {Object} user
 * @returns {undefined}
 */
com.rdHelper.Users.push = function(user) {
    if (!user || !user.id || !user.name) {
        return;
    }
    for(var i in this.users) {
        if (this.users[i].id == user.id) {
            return;
        }
    }
    this.users.push(user);
    this.store();
};

/**
 * Load users from server
 * 
 * @param {boolean} reload 
 * @returns {undefined}
 */
com.rdHelper.Users.load = function(reload) {
    if (!reload && this.loaded) {
        return;
    }
    (function(obj) {
      redmineApi.users.all(function(error, json) {
          console.log(json);
      });
    })(this);
};

/**
 * Get username by userId
 * 
 * @param {int} userId
 * @returns {String} 
 */
com.rdHelper.Users.getNameById = function(userId) {
   for (var i in this.users) {
       if (this.users[i].id == userId) {
           return this.users[i].name;
       }
   } 
   return userId;
};

/**
 * Store user data 
 * 
 */
com.rdHelper.Users.store = function() {
   localStorage['users'] = JSON.stringify(this.users);
   localStorage['users_loaded'] = this.loaded;
};