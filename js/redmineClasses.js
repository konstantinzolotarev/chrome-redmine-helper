
/**
 * Projects actions 
 * 
 * @class
 * @returns {Projects}
 */
function Projects() {
    this.loaded = false;
    this.projects = [];
}

/**
 * Get list of projects
 * 
 * @param {boolean} reload if set to true list will be updated from server
 * @returns {Array}
 */
Projects.prototype.all = function(reload) {
    if (this.loaded && !reload) {
        return this.projects;
    }
    //Try loading from memory
    this.loadFromMemory();
    //If we have no projects there loading from API
    if (this.projects.length < 1 || reload) {
        this.loadFromRedmine();
    }
    return this.projects;
};

/**
 * Get project detailed info 
 * 
 * @param {String} id
 * @param {boolean} reload
 * @returns {Object}
 */
Projects.prototype.get = function(id, reload) {
    var p = this.getById(id);
    if (!p.project) {
        return false;
    }
    if (p.project.fullyLoaded && !reload) {
        //load members if they wa not loaded
        this.getMembers(id);
        return p.project;
    }
    (function(obj) {
        getLoader().get("projects/"+id+".json?include=trackers,issue_categories", function(data) {
            data.project.fullyLoaded = true;
            var key = p.key || false;
            if (key !== false) {
                obj.projects[key] = merge(obj.projects[key], data.project);
                obj.store();
                obj.sendProjectUpdated(id, obj.projects[key]);
            }
        });
    })(this);
    return p.project;
};

/**
 * Get list of project members
 * 
 * @param {int} projectId
 * @param {boolean} reload
 * @returns {Array}
 */
Projects.prototype.getMembers = function(projectId, reload) {
    var proj = this.getById(projectId);
    if (!proj || !proj.project) {
        return [];
    }
    if (!reload && proj.project.membersLoaded) {
        return proj.project.members;
    }
    (function(obj) {
        getLoader().get("projects/"+projectId+"/memberships.json", function(json) {
            console.log(json);
        }, function(e, resp) {
            if (resp.status && resp.status == 403) {
                obj.projects[proj.key].membersLoaded = true;
                obj.projects[proj.key].members = [];
                obj.store();
                console.log(obj.projects[proj.key]);
            }
        });
    })(this);
};

/**
 * Get project from list by identifier
 * 
 * @param {String} ident
 * @returns {Object}
 */
Projects.prototype.getByIdentifier = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return {'key': pid, 'project': this.projects[pid]};
        }
    }
    return false;
};

/**
 * Get project from list by id
 * 
 * @param {String} id
 * @returns {Object}
 */
Projects.prototype.getById = function(id) {
    var project = {
        'key': false,
        'project': false
    };
    for(var pid in this.projects) {
        if (this.projects[pid].id == id) {
            project = {'key': pid, 'project': this.projects[pid]};
        }
    }
    return project;
};

/**
 * Get project id from list by identifier
 * 
 * @param {String} ident
 * @returns {int}
 */
Projects.prototype.getProjectKey = function(ident) {
    for(var pid in this.projects) {
        if (this.projects[pid].identifier == ident) {
            return pid;
        }
    }
    return false;
};

/**
 * Load projects from Redmine API
 * 
 * @returns {void}
 */
Projects.prototype.loadFromRedmine = function() {
    //update process
    this.projects = [];
    (function(obj) {
        getLoader().get("projects.json", function(data) {
            if (data.total_count && data.total_count > 0) {
                obj.projects = data.projects;
                obj.loaded = true;
                obj.store();
                chrome.extension.sendMessage({action: "projectsLoaded", projects: obj.projects});
            }
        });
    })(this);
};

/**
 * Store current projects 
 * 
 * @returns {void}
 */
Projects.prototype.store = function() {
    if (!this.loaded) {
        return;
    }
    localStorage['projects'] = JSON.stringify(this.projects);
};

/**
 * Load projects from extension Memory
 * 
 * @returns {void}
 */
Projects.prototype.loadFromMemory = function() {
    if (this.loaded) {
        return;
    }
    this.projects = JSON.parse(localStorage.projects || "[]");
    this.loaded = true;
};

/**
 * Clear stored data & update current projects
 * 
 * @returns {void}
 */
Projects.prototype.clear = function() {
    localStorage.removeItem("projects");
    this.projects = [];
    this.loaded = false;
};

/**
 * Send notification that project was updated
 * 
 * @param {String} id
 * @param {Object} project
 * @returns {void}
 */
Projects.prototype.sendProjectUpdated = function(id, project) {
    chrome.extension.sendMessage({"action": "projectUpdated", "project": project});
};

/**
 * Get list of issues for project
 * 
 * @param {String} id project identifier
 * @returns {Array}
 */
Projects.prototype.getIssues = function(id) {
    var key = this.getProjectKey(id);
    if (this.projects[key].issuesLoaded) {
        return this.projects[key].issues;
    }
    (function(obj) {
        getLoader().get("issues.json?sort=updated_on:desc", function(data) {
            console.log(data);
        });
    })(this);
    return [];
};

/**
 * 
 * @class
 * @returns {Issues}
 */
function Issues() {
    this.lastUpdated = false;
    if (localStorage.lastUpdated) {
        this.lastUpdated = new Date(localStorage.lastUpdated);
    }
    this.issues = JSON.parse(localStorage.issues || "[]");
    this.unread = 0;
    //Global issue statuses
    this.statuses = JSON.parse(localStorage.issueStatuses || "[]");
    this.statusesLoaded = localStorage.statusesLoaded || false;
    //Global issue Priorities
    this.priorities = JSON.parse(localStorage.priorities || "[]");
    this.prioripiesLoaded = localStorage.prioripiesLoaded || false;;
    
    this.updateUnread(true);
}

Issues.prototype.updateUnread = function(updateBadge) {
    this.unread = 0;
    for(var i in this.issues) {
        if(!this.issues[i].read) {
            this.unread += 1;
        }
    }
    if (updateBadge) {
        setUnreadIssuesCount(this.unread);
    }
};

/**
 * Load issues list 
 * 
 * @param {int} offset load result offset
 * @param {int} limit Limit for results
 * @returns {void}
 */
Issues.prototype.load = function(offset, limit) {
    offset = offset || 0;
    offset = parseInt(offset);
    limit = limit || 25;
    (function(obj) {
        getLoader().get("issues.json?sort=updated_on:desc&assigned_to_id="+getConfig().getProfile().currentUserId+"&limit="+limit+"&offset="+offset, 
            function(data) {
                var updated = 0;
                var notifiedIssues = [];
                if (data.total_count && data.total_count > 0) {
                    for(var i in data.issues) {
                        var found = false;
                        if (getConfig().getProjectsSettings().show_for == "selected"
                                && getConfig().getProjectsSettings().list.indexOf(data.issues[i].project.id) == -1) {
                            continue;
                        }
                        for(var key in obj.issues) {
                            //We found this issue
                            if (obj.issues[key].id == data.issues[i].id) {
                                found = true;
                                if (new Date(obj.issues[key].updated_on) < new Date(data.issues[i].updated_on)) {
                                    //mark as unread
                                    data.issues[i].read = false;
                                    obj.issues[key] = data.issues[i];
                                    updated += 1;
                                    //Bind users from issue
                                    getUsers().grabFromIssue(data.issues[i]);
                                    if (getConfig().getNotifications().show == "updated") {
                                        notifiedIssues.push(obj.issues[key]);
                                    }
                                }
                            }
                        }
                        if (!found) {
                            //Bind users from issue
                            getUsers().grabFromIssue(data.issues[i]);
                            //mark as unread
                            data.issues[i].read = false;
//                            data.issues[i].updated = new Date(data.issues[i].updated_on);
                            obj.issues.push(data.issues[i]);
                            updated += 1;
                            if (getConfig().getNotifications().show == "new") {
                                notifiedIssues.push(obj.issues[key]);
                            }
                        }
                    }
                    obj.lastUpdated = new Date();
                    obj.updateUnread(true);
                    obj.store();
                    /**
                     * Update issue statuses
                     */
                    obj.getStatuses();
                    /**
                     * Notify
                     */
                    chrome.extension.sendMessage({"action": "issuesUpdated"});
                    /**
                     * Load rest of issues
                     */
                    if (data.total_count > (offset + limit) && updated >= limit) {
                        obj.load((offset + limit), limit);
                    }
                    /**
                     * Show notifications for issues
                     */
                    if (notifiedIssues.length > 0) {
                        obj.showNotifications(notifiedIssues);
                    }
                }
            }
        );
    })(this);
};

/**
 * Show notifications 
 * 
 * @param {Array} notifications
 * @returns {undefined}
 */
Issues.prototype.showNotifications = function(notifications) {
    var text = "";
    var subject = "";
    if (notifications.length == 1) {
        subject = "You have an update in Redmine";
        text = "Issue: "+notifications[0].subject+" updated !";
    } else if(notifications.length > 1) {
        subject = "You have updates in Redmine";
        text = "You have "+notifications.length+" updated issue into Redmine";
    }
    notification = webkitNotifications.createNotification(
        'icon/icon-48.png', // icon url - can be relative
        subject, // notification title
        text  // notification body text
    );
    notification.show();
    chrome.alarms.create("notifications", {delayInMinutes: 0.2});
};

/**
 * Get detailed issue information 
 * 
 * @param {Object} issue
 * @param {boolean} reload
 * @returns {undefined}
 */
Issues.prototype.get = function(issue, reload) {
    if (issue.detailsLoaded && !reload) {
        return;
    }
    (function(obj) {
        getLoader().get("issues/"+issue.id+".json?include=journals,changesets", function(json) {
            if (json.issue) {
                var is = obj.getById(json.issue.id);
                if (is.issue) {
                    //Grab users from issue
                    getUsers().grabFromIssue(json.issue);
                    //update issue
                    json.issue.detailsLoaded = true;
                    obj.issues[is.key] = merge(obj.issues[is.key], json.issue);
                    obj.store();
                    //notify all listeners
                    chrome.extension.sendMessage({action: "issueDetails", id: issue.id, issue: obj.issues[is.key]});
                }
            }
        });
    })(this);
};

/**
 * Add new Comment to issue
 * 
 * @param {int} id
 * @param {String} comment
 * @returns {undefined}
 */
Issues.prototype.comment = function(id, comment) {
    var issue = this.getById(id);
    if (!issue.issue) {
        return;
    }
    return this.update(id, {'notes': comment});
};

/**
 * Update issue into Redmine
 * 
 * @param {int} id
 * @param {Object} issueData
 * @returns {undefined}
 */
Issues.prototype.update = function(id, issueData) {
    //check input data
    if (issueData === null || typeof issueData != "object") {
        return;
    }
    //Check issue
    var issue = this.getById(id);
    if (!issue.issue) {
        return;
    }
    (function(obj) {
        var data = {
            'issue': issueData
        };
        getLoader().put("issues/"+id+".json", JSON.stringify(data), function(json) {
            obj.get(issue.issue, true);
        });
    })(this);
};

/**
 * Create new Issue on server
 * 
 * @param {Object} issue
 * @returns {undefined}
 */
Issues.prototype.create = function(issue) {
    (function(obj) {
        var data = {
            'issue': issue
        };
        getLoader().post("issues.json", JSON.stringify(data), function(json) {
            var iss = json.issue || issue;
            //notify all listeners
            chrome.extension.sendMessage({action: "issueCreated", issue: iss});
        });
    })(this);
};

/**
 * Mark issue read 
 * 
 * @param {int} id
 * @returns {undefined}
 */
Issues.prototype.markAsUnRead = function(id) {
    var issue = this.getById(id);
    if (!issue.issue) {
        return;
    }
    this.issues[issue.key].read = false;
    this.unread += 1;
    setUnreadIssuesCount(this.unread);
    this.store();
};

/**
 * Mark issue read 
 * 
 * @param {int} id
 * @returns {undefined}
 */
Issues.prototype.markAsRead = function(id) {
    var issue = this.getById(id);
    if (!issue.issue) {
        return;
    }
    this.issues[issue.key].read = true;
    this.unread -= 1;
    setUnreadIssuesCount(this.unread);
    this.store();
};

/**
 * Mark all issues read
 * 
 * @returns {undefined}
 */
Issues.prototype.markAllAsRead = function() {
    for(var i in this.issues) {
        this.issues[i].read = true;
    }
    this.store();
    this.updateUnread(true);
};

/**
 * Get issue by it's ID 
 * 
 * @param {int} id
 * @returns {Boolean}
 */
Issues.prototype.getById = function(id) {
    var issue = {
        'key': false,
        'issue': false
    };
    if (this.issues.length < 1) {
        return false;
    }
    for(var i in this.issues) {
        if (this.issues[i].id == id) {
            issue = {'key': i, 'issue': this.issues[i]};
        }
    }
    return issue;
};

/**
 * Load list of Issue Statuses from API
 * 
 * @param {boolean} reload
 * @returns {Array}
 */
Issues.prototype.getStatuses = function(reload) {
    if (this.statusesLoaded && !reload) {
        return this.statuses;
    }
    (function(obj) {
        getLoader().get("issue_statuses.json", function(json) {
            if (json.issue_statuses && json.issue_statuses.length > 0) {
                obj.statuses = json.issue_statuses;
                obj.statusesLoaded = true;
                obj.store();
                //notify all listeners
                chrome.extension.sendMessage({action: "issueStatusesUpdated", statuses: obj.statuses});
            }
        });
    })(this);
    return this.statuses;
};

/**
 * Load list of Issue Priorities from API
 * 
 * @param {boolean} reload
 * @returns {Array}
 */
Issues.prototype.getPriorities = function(reload) {
    return; //Now not working in Redmine
    if (this.prioripiesLoaded && !reload) {
        return this.priorities;
    }
    (function(obj) {
        getLoader().get("enumerations/issue_priorities.json", function(json) {
            console.log(json);
            return;
            if (json.issue_statuses && json.issue_statuses.length > 0) {
                obj.priorities = json.issue_statuses;
                obj.prioripiesLoaded = true;
                obj.store();
                //notify all listeners
                chrome.extension.sendMessage({action: "issuePrioritiesUpdated", statuses: obj.statuses});
            }
        });
    })(this);
    return this.statuses;
};

/**
 * Get status name by id
 * @param {int} id
 * @returns {String}
 */
Issues.prototype.getStatusNameById = function(id) {
    if (!this.statusesLoaded) {
        this.getStatuses();
        return id;
    }
    for (var key in this.statuses) {
        if (this.statuses[key].id == id) {
            return this.statuses[key].name;
        }
    }
    return id;
};

/**
 * Clear issues list 
 * 
 * @returns {undefined}
 */
Issues.prototype.clearIssues = function() {
    this.issues = [];
    this.store();
    this.load();
};

/**
 * Store data into localStorage
 * 
 * @returns {void}
 */
Issues.prototype.store = function() {
    localStorage['issues'] = JSON.stringify(this.issues);
    localStorage['lastUpdated'] = this.lastUpdated.toISOString();
    localStorage['issueStatuses'] = JSON.stringify(this.statuses);
    localStorage['statusesLoaded'] = this.statusesLoaded;
};

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