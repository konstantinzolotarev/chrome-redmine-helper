
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
 * Get number of unread messages

 * @returns {number}
 */
Issues.prototype.getUnreadCount = function() {
    return this.unread;
};

/**
 * Load issues list 
 * 
 * @param {int} offset load result offset
 * @param {int} limit Limit for results
 * @param {Boolean} watcher
 * @returns {void}
 */
Issues.prototype.load = function(offset, limit, watcher) {
    offset = offset || 0;
    offset = parseInt(offset);
    limit = limit || 25;
    if  (typeof watcher == "undefined") {
        watcher = false;
    }
    (function(obj) {
        var url = "";
        if (!watcher) {
            url = "issues.json?sort=updated_on:desc&assigned_to_id="+getConfig().getProfile().currentUserId
                                // +"&watcher_id="+getConfig().getProfile().currentUserId
                                +"&limit="+limit
                                +"&offset="+offset;
        } else {
            url = "issues.json?sort=updated_on:desc"//&assigned_to_id="+getConfig().getProfile().currentUserId
                                +"&watcher_id="+getConfig().getProfile().currentUserId
                                +"&limit="+limit
                                +"&offset="+offset
        }
        getLoader().get(url, 
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
                                    //mark as watcher issue
                                    if (watcher) {
                                        if (obj.issues[key].assigned_to.id == getConfig().getProfile().currentUserId) {
                                           data.issues[i].watcher = false; 
                                        } else {
                                            data.issues[i].watcher = true; 
                                        }
                                    }
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
                            //mark as watcher issue
                            if (watcher) {
                                if (obj.issues[key].assigned_to.id == getConfig().getProfile().currentUserId) {
                                   data.issues[i].watcher = false; 
                                } else {
                                    data.issues[i].watcher = true; 
                                }
                            }
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
        getLoader().get("issues/"+issue.id+".json?include=journals,changesets,attachments", function(json) {
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
        }, function(e, request) {
            if (request && request.readyState == 4 && request.status == 422) {
                var json = JSON.parse(request.response);
                chrome.extension.sendMessage({action: "customError", type: "issueUpdate", errors: json});
            }
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
        }, function(e, request) {
            if (request && request.readyState == 4 && request.status == 422) {
                var json = JSON.parse(request.response);
                chrome.extension.sendMessage({action: "customError", type: "issueCreate", errors: json});
            }
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
    if (!this.lastUpdated) {
        this.lastUpdated = new Date();
    }
    localStorage['lastUpdated'] = this.lastUpdated.toISOString();
    localStorage['issueStatuses'] = JSON.stringify(this.statuses);
    localStorage['statusesLoaded'] = this.statusesLoaded;
};