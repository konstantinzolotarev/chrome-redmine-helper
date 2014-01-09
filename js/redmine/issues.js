
/**
 * Issues api
 * 
 * @class
 * @returns {com.rdHelper.Issues}
 */
com.rdHelper.Issues = {
    lastUpdated: false,
    // List of issues
    issues: {},
    // Issues list loaded from storage
    loaded: false,
    // Amount of unread issues
    unread: 0,
    //Global issue statuses
    statuses: [],
    statusesLoaded: false,
    //Global issue Priorities
    priorities: [],
    prioripiesLoaded: false
};

/**
 * Clear issues list
 *
 * @returns {undefined}
 */
com.rdHelper.Issues.clearIssues = function() {
    this.issues = {};
    this.loaded = false;
};

/**
 * Get number of issues
 * 
 * @returns {number}
 */
com.rdHelper.Issues.size = function() {
    return Object.keys(this.issues).length;
};

/**
 * Load data from chrome.storage
 * 
 * @param {function()=} callback
 */
com.rdHelper.Issues.loadFromStorage = function(callback) {
    callback = callback || function() {};
    (function(obj) {
        chrome.storage.local.get('issues', function(items) {
            if (!items.issues) {
                callback();
                return;
            }
            if (items.issues.issues) {
                obj.issues = items.issues.issues;
            }
            if (items.issues.issueStatuses) {
                obj.issueStatuses = items.issues.issueStatuses;
            }
            if (items.issues.lastUpdated) {
                obj.lastUpdated = new Date(items.issues.lastUpdated);
            }
            obj.loaded = true;
            callback();
        });
        return;
    })(this);
};

/**
 * Store data into chrome.storage
 *
 * @param {function()=} callback
 * @returns {void}
 */
com.rdHelper.Issues.store = function(callback) {
    if (!this.lastUpdated) {
        this.lastUpdated = new Date();
    }
    if ("string" == typeof this.lastUpdated) {
        this.lastUpdated = new Date(this.lastUpdated);
    }
    callback = callback || function() {};
    var data = {
        'issues': this.issues,
        'issueStatuses': this.statuses,
        'lastUpdated': this.lastUpdated.toISOString()
    };
    chrome.storage.local.set({'issues': data}, callback);
};

/**
 * Update unread issues count
 * 
 * @param {boolean=} updateBadge
 */
com.rdHelper.Issues.updateUnread = function(updateBadge) {
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
 * Get number of unread messages

 * @returns {number}
 */
com.rdHelper.Issues.getUnreadCount = function() {
    return this.unread;
};

/**
 * Get issue by it's ID
 *
 * @param {number} id
 * @returns {Boolean}
 */
com.rdHelper.Issues.getById = function(id) {
    if (!this.issues[id]) {
        return false;
    }
    return this.issues[id];
};

/**
 * Load issues list from server
 * 
 * @param {number} offset load result offset
 * @param {number} limit Limit for results
 * @param {boolean} watcher
 */
com.rdHelper.Issues.load = function(offset, limit, watcher) {
    offset = offset || 0;
    offset = parseInt(offset);
    limit = limit || 25;
    if  (typeof watcher == "undefined") {
        watcher = false;
    }
    (function(obj) {
        var filter = "";
        if (!watcher) {
            filter = "sort=updated_on:desc&assigned_to_id="+getConfig().getProfile().currentUserId
                                +"&limit="+limit
                                +"&offset="+offset;
        } else {
            filter = "sort=updated_on:desc&watcher_id="+getConfig().getProfile().currentUserId
                                +"&limit="+limit
                                +"&offset="+offset;
        }
        redmineApi.issues.all(filter, function(error, data) {
            if (error) {
                fireError("Server is unavailable.", true);
                return;
            }
            var updated = 0;
            var notifiedIssues = [];
            if (data.total_count && data.total_count > 0) {
                for(var i in data.issues) {
                    var found = false;
                    var issueId = data.issues[i].id;
                    if (getConfig().getProjectsSettings().show_for == "selected"
                            && getConfig().getProjectsSettings().list.indexOf(data.issues[i].project.id) == -1) {
                        continue;
                    }
                    //We found this issue
                    if (obj.issues[issueId]) {
                        found = true;
                        if (new Date(obj.issues[issueId].updated_on) < new Date(data.issues[i].updated_on)) {
                            //mark as unread
                            data.issues[i].read = false;
                            //mark as watcher issue
                            if (watcher) {
                                if (obj.issues[issueId].assigned_to 
                                        && obj.issues[issueId].assigned_to.id == getConfig().getProfile().currentUserId) {
                                   data.issues[i].watcher = false; 
                                } else {
                                    data.issues[i].watcher = true; 
                                }
                            }
                            obj.issues[issueId] = data.issues[i];
                            updated += 1;
                            //Bind users from issue
                            com.rdHelper.Users.grabFromIssue(data.issues[i]);
                            if (getConfig().getNotifications().show == "updated") {
                                notifiedIssues.push(obj.issues[issueId]);
                            }
                        }
                    }
                    if (!found) {
                        //Bind users from issue
                        com.rdHelper.Users.grabFromIssue(data.issues[i]);
                        //mark as unread
                        data.issues[i].read = false;
                        //mark as watcher issue
                        if (watcher) {
                            if (data.issues[i].assigned_to
                                    && data.issues[i].assigned_to.id == getConfig().getProfile().currentUserId) {
                               data.issues[i].watcher = false; 
                            } else {
                                data.issues[i].watcher = true; 
                            }
                        }
                        obj.issues[issueId] = data.issues[i];
                        updated += 1;
                        if (getConfig().getNotifications().show == "new") {
                            notifiedIssues.push(obj.issues[issueId]);
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
                if (!watcher && data.total_count > (offset + limit) && updated >= limit) {
                    obj.load((offset + limit), limit);
                } else {
                    //load my watcher issues
                    if(!watcher) {
                        obj.load(0, limit, true);
                    }
                }
                if (watcher) {
                    if (data.total_count > (offset + limit) && updated >= limit) {
                        obj.load((offset + limit), limit, true);
                    }
                }
                /**
                 * Show notifications for issues
                 */
                if (notifiedIssues.length > 0) {
                    obj.showNotifications(notifiedIssues);
                }
            }
        });
    })(this);
};

/**
 * Show notifications about issues
 * 
 * @param {Array} notifications
 * @returns {undefined}
 */
com.rdHelper.Issues.showNotifications = function(notifications) {
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
com.rdHelper.Issues.get = function(issue, reload) {
    if (issue.detailsLoaded && !reload) {
        return;
    }
    (function(obj) {
        redmineApi.issues.get(issue.id, "attachments,journals", function(error, json) {
            if (json.issue) {
                var issueId = json.issue.id;
                if (obj.issues[issueId]) {
                    //Grab users from issue
                    com.rdHelper.Users.grabFromIssue(json.issue);
                    //update issue
                    json.issue.detailsLoaded = true;
                    obj.issues[issueId] = merge(obj.issues[issueId], json.issue);
                    obj.store();
                    //notify all listeners
                    chrome.extension.sendMessage({action: "issueDetails", id: issue.id, issue: obj.issues[issueId]});
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
com.rdHelper.Issues.comment = function(id, comment) {
    if (!this.issues[id]) {
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
com.rdHelper.Issues.update = function(id, issueData) {
    //check input data
    if (issueData === null || typeof issueData != "object") {
        return;
    }
    //check issue
    if (!this.issues[id]) {
        return;
    }
    (function(obj) {
        redmineApi.issues.update(id, issueData, function(error, json) {
            if (error) {
                if (error.request && error.request.readyState == 4 && error.request.status == 422) {
                    var err = JSON.parse(error.request.response);
                    chrome.extension.sendMessage({action: "customError", type: "issueUpdate", errors: err});
                }
                return;
            }
            obj.get(obj.issues[id], true);
        });
    })(this);
};

/**
 * Create new Issue on server
 * 
 * @param {Object} issue
 * @returns {undefined}
 */
com.rdHelper.Issues.create = function(issue) {
    (function(obj) {
        redmineApi.issues.create(issue, function(error, json) {
            if (error) {
                if (error.request && error.request.readyState == 4 && error.request.status == 422) {
                    var err = JSON.parse(error.request.response);
                    chrome.extension.sendMessage({action: "customError", type: "issueCreate", errors: err});
                }
                return;
            }
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
com.rdHelper.Issues.markAsUnRead = function(id) {
    if (!this.issues[id]) {
        return;
    }
    this.issues[id].read = false;
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
com.rdHelper.Issues.markAsRead = function(id) {
    if (!this.issues[id]) {
        return;
    }
    this.issues[id].read = true;
    this.unread -= 1;
    setUnreadIssuesCount(this.unread);
    this.store();
};

/**
 * Mark all issues read
 * 
 * @returns {undefined}
 */
com.rdHelper.Issues.markAllAsRead = function() {
    for(var i in this.issues) {
        this.issues[i].read = true;
    }
    this.store();
    this.updateUnread(true);
};

/**
 * Load list of Issue Statuses from API
 * 
 * @param {boolean} reload
 * @returns {Array}
 */
com.rdHelper.Issues.getStatuses = function(reload) {
    if (this.statusesLoaded && !reload) {
        return this.statuses;
    }
    (function(obj) {
        redmineApi.issues.statuses(function(error, json) {
            if (error) {
                return;
            }
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
com.rdHelper.Issues.getPriorities = function(reload) {
    return; //Now not working in Redmine
    if (this.prioripiesLoaded && !reload) {
        return this.priorities;
    }
    (function(obj) {
        redmineApi.issues.statuses(function(error, json) {
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
com.rdHelper.Issues.getStatusNameById = function(id) {
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