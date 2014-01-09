var pollIntervalMin = 5;  // 5 minutes
var notification;
var selectedText = "";

/**
 * Init global variables
 */
config = new Config();

/**
 * Loading Redmine API
 * 
 * @type {redmine.Api}
 */
redmineApi = null;

//Load configs on init
config.load(function() {
    //handle loading complete
    //fetch config
    updateRedmineApi(); 
});

/**
 * Loading issues
 */
com.rdHelper.Issues.loadFromStorage();

/**
 * 
 * @returns {@exp;redmine@call;Api}
 */
function updateRedmineApi() {
    //clear errors first
    chrome.browserAction.setBadgeText({text: ""});
    redmineApi = new redmine.Api({
        host: getConfig().profile.host,
        useHttpAuth: getConfig().profile.useHttpAuth,
        httpUser: getConfig().profile.httpUser,
        httpPassword: getConfig().profile.httpPass,
        chiliProject: getConfig().profile.chiliProject,
        apiAccessKey: getConfig().profile.apiAccessKey
    });
}

/**
 * Get selected text from context menu event
 *
 * @returns {String} selected text
 */
function getSelectedText() {
    return selectedText;
}

/**
 * Clear selected in context menu text
 */
function clearSelectedText() {
    selectedText = "";
}

/**
 * Overwrites obj1's values with obj2's and adds obj2's if non existent in obj1
 * @param obj1
 * @param obj2
 * @returns obj3 a new object based on obj1 and obj2
 */
function merge(obj1,obj2){
    var obj3 = {};
    for (var attrname in obj1) { obj3[attrname] = obj1[attrname]; }
    for (var attrname in obj2) { obj3[attrname] = obj2[attrname]; }
    return obj3;
}

/**
 * Trim string 
 * @param {Strin} string
 */
function trim(string) {
    return string.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}

/**
 * Get Config 
 * 
 * @returns {Config}
 */
function getConfig() {
    config.load();
    return config;
}

/**
 * Set amount of unread issues
 * 
 * @param {int} count
 * @returns {void}
 */
function setUnreadIssuesCount(count) {
    //clear text
    if (count <= 0) {
        chrome.browserAction.setBadgeText({text: ""});
        return;
    }
    if (count > 99) {
        count = "99+";
    }
    chrome.browserAction.setBadgeText({text: ""+count});
}

/**
 * Remove all stored Redmine items from memory
 * 
 * @returns {void}
 */
function updateItems() {
    if (!config.isEmpty()) {
        startRequest({scheduleRequest:true});
    }
}

/**
 * Check if given URL is from Extension Main page
 * 
 * @param {String} url
 * @returns {Boolean}
 */
function isMainUrl(url) {
    var mainUrl = getMainUrl(true);
    if (url.indexOf(mainUrl) === 0) {
        return true;
    }
    return false;
}

/**
 * Get Extension Main page URL.
 * 
 * If absolute set to true function will return absolute URL :<br/> 
 * chrome-extension://extension-id/html/main.html 
 * 
 * @param {boolean} absolute
 * @returns {String}
 */
function getMainUrl(absolute) {
    if (!absolute) {
        return "html/main.html";
    } else {
        return chrome.extension.getURL("/html/main.html");
    }
}

/**
 * Will open new Extension Main page or set selected page that already open
 * 
 * @param {Object} page
 * @returns {void}
 */
function openMainPage(page) {
    var urlToOpen = page ? getMainUrl()+"#"+page : getMainUrl() ;
    chrome.tabs.getAllInWindow(undefined, function(tabs) {
        for (var i = 0, tab; tab = tabs[i]; i++) {
            if (tab.url && isMainUrl(tab.url)) {
                chrome.tabs.update(tab.id, {
                    selected: true,
                    url: urlToOpen
                });
                return;
            }
        }
        chrome.tabs.create({url: urlToOpen});
    });
}

/**
 * Shedule next request to Redmine
 */
function scheduleRequest() {
    try {
        chrome.alarms.get("issues", function(alarm) {
            if (alarm) {
                chrome.alarms.clear("issues");
            }
            chrome.alarms.create("issues", {'delayInMinutes': pollIntervalMin});        
        });
    } catch(err) {
        chrome.alarms.create("issues", {'delayInMinutes': pollIntervalMin});
    }
}

/**
 * Load current user details

 * @param {function()=} onSuccess function that will be called after success loading of user details
 * @returns {void}
 */
function getCurrentUser(onSuccess) {
    redmineApi.users.me(function(error, json) {
        if (error) {
            fireError("Couldn't load user details", true);
        }
        if (json.user) {
            getConfig().getProfile().currentUserName = json.user.firstname + ' ' + json.user.lastname;
            getConfig().getProfile().currentUserId = json.user.id;
            getConfig().store(getConfig().getProfile());
            onSuccess();
        }
    });
    
}

/**
 * Upload file to redmine
 * 
 * @param {?} file
 * @param {function(?Object, ?Object)} callback Callback function
 */
function uploadFile(file, callback) {
    redmineApi.upload(file, callback);
}

/**
 * Start requesting of issues
 * 
 * @param {Object} params
 * @returns {void}
 */
function startRequest(params) {
    chrome.browserAction.setBadgeText({text: ""});
    if (params.scheduleRequest) {
        scheduleRequest();
    }
    if (getConfig().getHost() != "") {
        //check user
        if (!getConfig().getProfile().currentUserId || !getConfig().getProfile().currentUserName) {
            getCurrentUser(function() {
                startRequest({scheduleRequest: false});
            });
        } else {
            /**
             * Load list of issues
             */
            com.rdHelper.Issues.load();
        }
    } else {
         fireError("Couldn't connect to server.", true);
    }
}

/**
 * Shows new Global error message
 * 
 * @param {string=} message 
 * @param {boolean} global
 */
function fireError(message, global) {
    if (global) {
        chrome.browserAction.setBadgeText({text: "Err"});
    }
    //send error
    chrome.extension.sendMessage({
        action: "globalError", params: {
            "error": {
                'message': message
            }
        }
    });
};

/**
 * handler for click on context menu
 */
function handleContextMenu(info, tab) {
    //store selected text
    selectedText = info.selectionText;
    //open new tab to create issue 
    openMainPage("/new_issue");
}

/**
 * Handle settings update
 * 
 * @param {Object} changes
 * @param {Object} namespace
 */
chrome.storage.onChanged.addListener(function(changes, namespace) {
    //handle only profile update
    if (!changes.profile) {
        return;
    }
    //Update settings
    updateRedmineApi();
    updateItems();
});

/**
 * Add handler to context menu click
 */
chrome.contextMenus.onClicked.addListener(handleContextMenu);


/**
 * Bind actions on extension is installed
 */
chrome.runtime.onInstalled.addListener(function() {
    localStorage.clear();
    startRequest({scheduleRequest:true});
});

/**
 * sRun actions on timer
 * 
 * @param {Alarm} alarm
 */
chrome.alarms.onAlarm.addListener(function(alarm) {
    if (alarm.name && alarm.name == "issues") {
        startRequest({scheduleRequest:true});
    }
    if (alarm.name && alarm.name == "notifications") {
        if (notification) {
            notification.cancel();
        }
    }
});


/**
 * Bind click action to icon
 */
chrome.browserAction.onClicked.addListener(function() {
    openMainPage(); 
});

/**
 * Remove all context menues first
 */
chrome.contextMenus.removeAll(function() {
    /**
     * Create context menu to create new issues from selected text
     */ 
     chrome.contextMenus.create({
        'id': "newIssueContextMenu",
        'title': "Create new Redmine issue",
        'contexts': ["selection"]
     });
});