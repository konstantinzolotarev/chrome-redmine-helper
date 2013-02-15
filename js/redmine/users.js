
/**
 * Users representation class
 * 
 * @class 
 * @returns {Users}
 */
function Users() {
    this.loaded = localStorage.users_loaded || false;
    this.users = JSON.parse(localStorage.users || "[]");
}

/**
 * Grab users from issue
 * 
 * @param {Object} issue
 * @returns {undefined}
 */
Users.prototype.grabFromIssue = function(issue) {
    this.push(issue.assigned_to);
    this.push(issue.author);
};

/**
 * Add new user to the list 
 * 
 * @param {Object} user
 * @returns {undefined}
 */
Users.prototype.push = function(user) {
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
Users.prototype.load = function(reload) {
    if (!reload && this.loaded) {
        return;
    }
    (function(obj) {
        getLoader().get("users.json", function(json) {
            console.log(json);
        }, function(e, resp) {
            if (resp.status && resp.status == 401) {
                //Couldn't load users
            }
        });
    })(this);
};

/**
 * Get username by userId
 * 
 * @param {int} userId
 * @returns {String} 
 */
Users.prototype.getNameById = function(userId) {
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
 * @returns {undefined}
 */
Users.prototype.store = function() {
   localStorage['users'] = JSON.stringify(this.users);
   localStorage['users_loaded'] = this.loaded;
};