/******  Copyright 2016 Tradable ApS; @license MIT; v1.20.3  ******/

// Avoid console errors when not supported
if (typeof console === "undefined" || typeof console.log === "undefined") {
    console = { log: function() {}, warn: function() {} };
}

//Check minimum jQuery version '2.1.4'
if(typeof jQuery === "undefined") {
    console.warn('tradable requires jQuery to run');
} else if(!isGreaterOrEqualMinVersion(jQuery.fn.jquery, '2.1.4')) {
    console.warn('tradable requires jQuery version 2.1.4 or above');
}

// Save jQuery in custom variable
var trEmbJQ = jQuery.noConflict(true);

// Find the JS global object
var jsGlobalObject = (typeof window !== "undefined") ? window :
                     (typeof self !== "undefined") ? self :
                     (typeof global !== "undefined") ? global : this;

// Immediately invoked function expression (IIFE)
(function(global, $) {
    'use strict'; // It's good practice

    global.tradableConfig = initializeTradableConfig();

    var appId = tradableConfig.appId;
    var appKey = tradableConfig.appKey;
    var redirectUrl = getRedirectUrl();
    var oauthEndpoint = formOAuthEndpoint(redirectUrl);
    var tokenObj = getTokenFromStorage();

    var availableEvents = ["embedStarting", "embedReady", "accountUpdated", "accountSwitch", "tokenExpired", "tokenWillExpire", "reLoginRequired", "execution", "error"];
    var callbackHolder = {};
    var accountSwitchCallbacks = [], accountUpdatedCallbacks = [], accountUpdatedCallbackHashes = [], 
        tokenExpirationCallbacks = [], tokenWillExpireCallbacks = [], errorCallbacks = [];

    /**
    * @property {Boolean} tradingEnabled Indicates if the user is authenticated
    * @property {Object} selectedAccount The current user's active trading account. When "onEmbedReady" is called and "tradingEnabled" is true, it is already available and the instruments are initialized for it.
    * @property {Array<Object>} accounts List of accounts for the user, it is automatically initialized when trading is enabled.
    * @property {Object} lastSnapshot Last received account snapshot (may be null).
    * @property {Array<Object>} availableInstruments List of instruments cached in memory for the selected account. If the full instrument list is available for the selected account, all of them. Otherwise, instruments are gradually cached for the requested prices. All instruments related to to the open positions and pending orders are cached since the beginning.
    */
    var tradable = {
        version : '1.20.3',
        app_id: appId,
        app_key: appKey,
        oauth_host: oauthEndpoint.oauthHost,
        auth_loc: oauthEndpoint.oauthURL,
        login_loc : oauthEndpoint.oauthURL + '&showLogin=true',
        approval_page_loc : oauthEndpoint.oauthURL + '&showApproval=true',
        broker_signup_loc : 'https://' + oauthEndpoint.oauthHost + 'brokerSignup?client_id='+appId+'&redirect_uri='+redirectUrl,
        auth_window: null,
        authEndpoint : tokenObj.authEndpoint,
        accessToken : tokenObj.token,
        tradingEnabled : tokenObj.tradingEnabled,
        expirationTimeUTC : tokenObj.expirationTimeUTC,
        notifiedCallbacks : false,
        readyCallbacks : [],
        allAccounts : [],
        accounts : [],
        accountIdsToExclude : [],
        accountMap: {},
        selectedAccount : null,
        selectedAccountId : null,
        availableCategories : [],
        availableInstruments : [],
        availableSymbols : [],
        availableCurrencies : [],
        lastSnapshot: null,
        instrumentKeysForAccountUpdates: [],
        accountUpdateMillis: 700,
        /**
         * Redirect to the Tradable account approval page
         */
        showApprovalPage: function () {
            tradable.openOAuthPage("APPROVAL", true);
        },
        /**
         * Open the Tradable account approval page in a popup window
         */
        showApprovalPageInWindow: function () {
            tradable.openOAuthPage("APPROVAL", false);
        },
        /**
         * Start oauth flow within the page
         * @param      {number} brokerId(optional) If the authentication flow needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        authenticate: function (brokerId) {
            if (!tradable.tradingEnabled){
                tradable.openOAuthPage("AUTHENTICATE", true, brokerId);
            } else {
                validateToken();
            }
        },
        /**
         * @param      {number} brokerId(optional) If the authentication flow needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        authenticateWithWindow: function (brokerId){
            tradable.openOAuthPage("AUTHENTICATE", false, brokerId);
        },
        /**
         * Redirect to the Tradable Login page
         * @param      {number} brokerId(optional) If the login page needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        showLoginPage: function (brokerId) {
            tradable.openOAuthPage("LOGIN", true, brokerId);
        },
        /**
         * Open the Tradable Login page in a popup window
         * @param      {number} brokerId(optional) If the login page needs to be opened for a certain broker, this is the id (v1/brokers)
         */
        showLoginPageInWindow: function (brokerId) {
            tradable.openOAuthPage("LOGIN", false, brokerId);
        },
        /**
         * Redirect to the Tradable Broker sign up page that will allow the user to sign up with a broken
         */
        showBrokerSignUpPage: function () {
            tradable.openOAuthPage("BROKER_SIGNUP", true);
        },
        /**
         * Open the Tradable Broker sign up page that will allow the user to sign up with a broken in a popup window
         */
        showBrokerSignUpPageInWindow: function () {
            tradable.openOAuthPage("BROKER_SIGNUP", false);
        },
        openOAuthPage: function (type, redirect, brokerId) {
            var url = (type.toUpperCase() === "AUTHENTICATE") ? tradable.auth_loc :
                      (type.toUpperCase() === "LOGIN") ? tradable.login_loc :
                      (type.toUpperCase() === "APPROVAL") ? tradable.approval_page_loc : 
                      (type.toUpperCase() === "BROKER_SIGNUP") ? tradable.broker_signup_loc : undefined;
            if(!url) {
                throw "Choose a correct type: AUTHENTICATE, LOGIN, APPROVAL or BROKER_SIGNUP";
            }
            if(typeof brokerId !== "undefined") {
                url = url + "&broker_id=" + brokerId;
            }

            if(type.toUpperCase() === "AUTHENTICATE" || type.toUpperCase() === "LOGIN") {
                resetExcludedAccounts();
            }

            if((typeof redirect !== "undefined" && redirect) || ie()) {
                location.href = url;
            } else {
                var windowName = (type.toUpperCase() === "BROKER_SIGNUP") ? 'osBrokerSignUp' : 'osLaunch';
                tradable.auth_window = popupwindow(url, windowName);
            }
        },
        /**
         * Enables trading for the account corresponding to the given access token
         * @param      {String} accessToken    The authentication token granting access to the account
         * @param      {String} endpoint   The endpoint to send API requests to
         * @param      {String} expiresIn  The expiry date (in milliseconds) of the access token.
         */
        enableWithAccessToken : function(accessToken, endpoint, expiresIn) {
            return tradable.enableTrading(accessToken, endpoint, expiresIn, true);
        },
        /**
         * Drops authentication token and notifies embed callbacks
         */
        signOut: function() {
            internalSignOut();
            if(isLocalStorageSupported()) {
                localStorage.removeItem("accessToken:"+appId);
                localStorage.removeItem("authEndpoint:"+appId);
                localStorage.removeItem("tradingEnabled:"+appId);
                localStorage.removeItem("expirationTimeUTC:"+appId);
            }
            tradable.tradingEnabled = false;
            notifyReadyCallbacks();
        },
        isEventValid : function(eventName) {
            return (typeof eventName === "string" && $.inArray(eventName, availableEvents) !== -1);
        },
        /**
         * Add an event listener with an specific name that can be turned off calling 'off'.
         * @param      {String} namespace    A unique name that will identify your listener and that you will have to use to turn the listener off 
         * @param      {String} eventName   The available events are "embedStarting", "embedReady", "accountUpdated", "accountSwitch", "tokenExpired", "tokenWillExpire", "reLoginRequired", "error"
         * @param      {Function} callback  Event listener callback function
         * @example
         * tradable.on("yourCustomNamespace", "accountUpdated", function(snapshot) {
         *      console.log("Notified with every snapshot..");
         * });
         */
        on : function(namespace, eventName, callback) {
            if(!tradable.isEventValid(eventName)) {
                throw "Please provide a valid eventName: " + availableEvents;
            }

            if(!callbackHolder[eventName]) {
                // Initialize event callbacks
                callbackHolder[eventName] = {};
            }

            // Check namespace validity
            if(typeof namespace !== "string") {
                throw "The given event namespace is invalid (needs to be a string)";
            } else if(typeof callbackHolder[eventName][namespace] !== "undefined") {
                throw "The given event namespace is already taken, 'off' the event first to change it";
            }

            // Check callback validity
            if(typeof callback !== "function") {
                throw "Please provide a valid callback function";
            }

            switch(eventName) {
                case "embedReady": tradable.initEmbedReady(callback); break;
                case "accountUpdated": tradable.initAccountUpdates(); break;
                case "tokenWillExpire": tradable.initTokenWillExpire(); break;
                case "execution": tradable.initExecutions(); break;
            }

            callbackHolder[eventName][namespace] = callback;
        },
        /**
         * Turn off an specific event listener with a namespace
         * @param      {String} namespace    The unique name that identifies your listener 
         * @param      {String} eventName(optional)   The event's name, if not specified all events for the given namespace will be turned off
         * @example
         * tradable.off("yourCustomNamespace", "accountUpdated");         
         */
        off : function(namespace, eventName) {
            if(typeof eventName === "undefined") {
                for(var evtName in callbackHolder) {
                    if(callbackHolder.hasOwnProperty(evtName) &&
                        namespace in callbackHolder[evtName] &&
                        callbackHolder[evtName].hasOwnProperty(namespace)) {
                        delete callbackHolder[evtName][namespace];
                    }
                }
            } else if(tradable.isEventValid(eventName) && !!callbackHolder[eventName] && (namespace in callbackHolder[eventName])) {
                delete callbackHolder[eventName][namespace];
            }
            for(eventName in callbackHolder) {
                if(callbackHolder.hasOwnProperty(eventName) && isEmpty(callbackHolder[eventName])) {
                    delete callbackHolder[eventName];
                    switch(eventName) {
                        case "accountUpdated": tradable.stopAccountUpdates(); break;
                        case "execution": tradable.stopExecutions(); break;
                    }
                }
            }
        },
        initEmbedReady : function(callback) {
            if(tradable.notifiedCallbacks) {
                return executeCallback(callback);
            }
        },
        /**
         * Main library state notifier, called every time the state of tradingEnabled changes
         * @param      {Function} callback Callback function to be notified
         * [exampleiframe-begin]//codepen.io/tradableEmbed/embed/avPzgP/?height=300&theme-id=21042&default-tab=js[exampleiframe-end]
         */
        onEmbedReady : function (callback) {
            if(callback && typeof callback === "function") {
                tradable.readyCallbacks.push(callback);
                tradable.initEmbedReady(callback);
            } else {
                throw "The specified callback is not a function";
            }
        },
        accountUpdateInterval: null,
        initAccountUpdates : function() {
            if(tradable.accountUpdateInterval === null) {
                tradable.accountUpdateInterval = setInterval(processAccountUpdate, tradable.accountUpdateMillis);
            }
        },
        stopAccountUpdates : function() {
            if(!accountUpdatedCallbacks.length) {
                clearInterval(tradable.accountUpdateInterval);
                tradable.accountUpdateInterval = null;
            }
        },
        /**
         * Gets notified with a new account snapshot every certain time (700 millis by default)
         * @param      {Function} callback Callback function to be notified
         * [exampleiframe-begin]//codepen.io/tradableEmbed/embed/rObOqE/?height=300&theme-id=21042&default-tab=js[exampleiframe-end]
         */
        onAccountUpdated : function(callback) {
            if(callback && typeof callback === "function") {
                tradable.initAccountUpdates();
                var callbackHash = hashCode(callback.toString());
                if($.inArray(callbackHash, accountUpdatedCallbackHashes) === -1) {
                    accountUpdatedCallbacks.push(callback);
                    accountUpdatedCallbackHashes.push(callbackHash);
                }
            } else {
                throw "The specified callback is not a function";
            }
        },
        /**
         * Customize the frequency for account snapshot updates (onAccountUpdated)
         * @param      {number} accUpdateMillis Frequency in milliseconds
         */
        setAccountUpdateFrequencyMillis: function(accUpdateMillis) {
            if(!!accUpdateMillis && accUpdateMillis > 0 && typeof accUpdateMillis === "number") {
                tradable.accountUpdateMillis = accUpdateMillis;
                if(tradable.accountUpdateInterval) {
                    clearInterval(tradable.accountUpdateInterval);
                    tradable.accountUpdateInterval = setInterval(processAccountUpdate, tradable.accountUpdateMillis);
                }
            } else {
                throw "Please specify a valid update frequency";
            }
        },
        addSymbolToUpdates: function(updateClientId, instrumentId) {
            console.warn("'addSymbolToUpdates' is now deprecated, 'addInstrumentIdToUpdates' should now be used instead.");
            tradable.addInstrumentIdToUpdates(updateClientId, instrumentId);
        },
        removeSymbolFromUpdates: function(updateClientId, instrumentIdToRemove) {
            console.warn("'removeSymbolFromUpdates' is now deprecated, 'removeInstrumentIdFromUpdates' should now be used instead.");
            tradable.removeInstrumentIdFromUpdates(updateClientId, instrumentIdToRemove);
        },
        /**
         * Subscribe for the given instrument Id's prices on the account snaphot updates (onAccountUpdated)
         * @param      {String} updateClientId Id for the element that is requesting the prices, only when no ids are subscribed to an instrument will the instrument be removed from the updates
         * @param      {String} instrumentId Instrument Id for the prices
         * @example
         * tradable.addInstrumentIdToUpdates("yourCustomId", "401155666");
         * // Now the snapshot retrieved by the "accountUpdated" event
         * // will include prices for the specified instrument 
         */
        addInstrumentIdToUpdates: function(updateClientId, instrumentId) {
            if(updateClientId.indexOf(":") !== -1) {
                throw "It is not allowed to include a colon ':' in the updateClientId";
            }
            var instrumentKey = instrumentId + ":" + updateClientId;
            if($.inArray(instrumentKey, tradable.instrumentKeysForAccountUpdates) === -1) {
                tradable.instrumentKeysForAccountUpdates.push(instrumentKey);
            }
        },
        /**
         * Unsubscribe for the given instrument Id's prices on the account snaphot updates (onAccountUpdated)
         * @param      {String} updateClientId Id for the element that is requesting the prices, only when no ids are subscribed to an instrument will the instrument be removed from the updates
         * @param      {String} instrumentIdToRemove Instrument Id to remove from the prices
         * @example
         * tradable.removeInstrumentIdFromUpdates("yourCustomId", "401155666");         
         */
        removeInstrumentIdFromUpdates: function(updateClientId, instrumentIdToRemove) {
            var instrumentKey = instrumentIdToRemove + ":" + updateClientId;
            tradable.instrumentKeysForAccountUpdates = $.grep(tradable.instrumentKeysForAccountUpdates, function(value) {
                return value !== instrumentKey;
            });
        },
        /**
         * Gets notified every time the selectedAccount is changed (through the setSelectedAccount method)
         * @param      {Function} callback Callback function to be notified
         */
        onAccountSwitch : function(callback) {
            tradable.saveCallback(callback, accountSwitchCallbacks);
        },
        /**
         * Gets called back when the token expires
         * @param      {Function} callback Callback function to be notified
         */
        onTokenExpired: function(callback) {
            tradable.saveCallback(callback, tokenExpirationCallbacks);
        },
        /**
         * Gets called when a general error occurs, for example an account initialization error due to a password change
         * @param      {Function} callback Callback function to be notified
         */
        onError: function(callback) {
            tradable.saveCallback(callback, errorCallbacks);
        },
        saveCallback : function(callback, callbackList) {
            if(callback && $.inArray(callback, callbackList) === -1) {
                callbackList.push(callback);
            }
        },
        tokenWillExpireInterval : null,
        initTokenWillExpire : function() {
            if(tradable.tokenWillExpireInterval === null) {
                tradable.tokenWillExpireInterval = setInterval(processTokenWillExpire, 300000); // 5 minutes
            }
            function processTokenWillExpire() {
                var remainingMillis = tradable.getRemainingTokenMillis();
                if(!!remainingMillis && remainingMillis > 0 && remainingMillis < 1800000) { // 30 minutes
                    $(tokenWillExpireCallbacks).each(function(index, callback){
                        callback(remainingMillis);
                    });
                    notifyNamespaceCallbacks("tokenWillExpire", remainingMillis);
                }
            }
        },
        /**
         * Gets called back every 5 minutes when the remaining token time is less than 30 minutes
         * @param      {Function} callback Callback function to be notified
         */
        onTokenWillExpire: function(callback) {
            tradable.initTokenWillExpire();
            if($.inArray(callback, tokenWillExpireCallbacks) === -1) {
                tokenWillExpireCallbacks.push(callback);
            }
        },
        /**
         * Returns the remaining milliseconds for the token to expire
         * @return     {number} remainingMillis Remaining milliseconds for the token to expire
         */
        getRemainingTokenMillis : function() {
            if(!tradable.expirationTimeUTC) {
                console.log("You need to authenticate before calling this method");
            }
            return (tradable.expirationTimeUTC - new Date().getTime());
        },
        listeningToExecutions: false,
        initExecutions : function () {
            if(!tradable.listeningToExecutions) {
                tradable.on("internalExecutionsListener", "accountUpdated", findAndNotifyExecutions);
                tradable.listeningToExecutions = true;
            }
        },
        stopExecutions : function() {
            tradable.off("internalExecutionsListener", "accountUpdated");
            tradable.listeningToExecutions = false;
        },
        makeOsRequest : function (reqType, type, accountId, method, postData, resolve, reject){
            var version = (reqType === "internal") ? "" : "v1/";
            var endpoint;
            if(reqType !== "user" && reqType !== "accounts") {
                endpoint = 'https://'+tradable.oauth_host;
            } else if(accountId !== undefined && accountId !== null && accountId.length === 0) {
                endpoint = tradable.authEndpoint;
            } else if(tradable.accountMap[accountId]) {
                endpoint = tradable.accountMap[accountId].endpointURL;
            } else {
                console.warn("Please specify a valid accountId or method");
                var wrongRequestDeferred = new $.Deferred().reject("Invalid request: Please specify a valid accountId or method");
                return resolveDeferred(wrongRequestDeferred, resolve, reject);
            }
            var ajaxPromise = $.ajax({
                type: type,
                beforeSend: function (request) {
                    if(reqType !== "internal") {
                        request.setRequestHeader("Authorization", "Bearer " + tradable.accessToken);
                    }
                    request.setRequestHeader("x-tr-embed-sdk", "js-"+tradable.version);
                },
                crossDomain: true,
                xhrFields: {
                    withCredentials: true
                },
                url: (!!accountId && accountId.length > 0) ? (endpoint + version + reqType + "/" + accountId + "/" + method)
                                                           : (endpoint + version + reqType + "/" + method),
                contentType: "application/json; charset=utf-8",
                data: (postData) ? JSON.stringify(postData) : undefined,
                dataType: 'json'
            });

            ajaxPromise.then(function(){},
                function(jqXHR){
                    if(jqXHR.responseJSON) {
                        if(jqXHR.responseJSON.httpStatus === 403 || jqXHR.responseJSON.httpStatus === 502) {
                            if(!tradable.initializingAccount && tradable.isReLoginRequired(jqXHR)) {
                                notifyReloginRequiredCallbacks();
                            } else {
                                notifyTokenExpired();
                            }
                        }
                        notifyErrorCallbacks(jqXHR.responseJSON);
                    }
                });

            return resolveDeferred(ajaxPromise, resolve, reject);
        },
        makeAccountRequest : function (type, accountId, method, postData, resolve, reject){
            return tradable.makeOsRequest("accounts", type, accountId, method, postData, resolve, reject);
        },
        /**
         * Sets the account unique id that will be used for account related API calls
         * @param      {String}   accountId Account uniqueId
         * @param      {Function} resolve Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject Error callback for the API call
         */
        initializingAccount : false,
        setSelectedAccount : function (accountId, resolve, reject){
            if(tradable.accountMap[accountId]) {
                tradable.lastSnapshot = undefined;
                tradable.selectedAccount = tradable.accountMap[accountId];
                tradable.selectedAccountId = accountId;
                console.log('New accountId is set');
                tradable.initializingAccount = true;
                return initializeValuesForCurrentAccount(function() {
                    if(isLocalStorageSupported()) {
                        localStorage.setItem("selectedAccount:"+appId, accountId);
                    }
                    if(resolve) {
                        resolve();
                    }
                    tradable.initializingAccount = false;
                },
                function(err) {
                    if(tradable.isReLoginRequired(err)) {
                        tradable.reLogin().then(function () {
                            tradable.setSelectedAccount(accountId);
                        }, function () {
                            excludeAndValidate(reject, err);
                        });
                    } else {
                        excludeAndValidate(reject, err);
                    }
                    tradable.initializingAccount = false;
                });
            } else {
                console.error("Can't set account id to: " + accountId);
            }
        },
        isReLoginRequired : function (err) {
            return (!!err && !!err.responseJSON && err.responseJSON.httpStatus === 403 && err.responseJSON.code === 1005);
        },
        excludeCurrentAccount : function() {
            var accountId = tradable.selectedAccountId;
            var index = tradable.accounts.indexOf(tradable.selectedAccount);
            if (index > -1) {
                tradable.accounts.splice(index, 1);
                delete tradable.accountMap[accountId];
                tradable.accountIdsToExclude.push(accountId);
            }
        },
        // Get Instrument
        /**
         * Returns the correspondent instrument obj to the symbol if it's in the current account. Beware! getInstrumentFromSymbol is a convenience synchronous method that retrieves the instrument from cache. In accounts in which the FULL_INSTRUMENT_LIST is not supported, you need to subscribe the instrument id to prices, have it in the account snapshot or request it through POST 'getInstrumentsFromIds' for it to be cached.
         * @param      {String}   symbol Instrument symbol
         * @return      {Object} Correspondent instrument obj to the symbol or null if not found
         * @example
         * _object-begin_Instrument_object-end_
         */
        getInstrumentFromSymbol : function(symbol) {
            if(!symbol) {
                return null;
            }
            return tradable.getInstrumentForProperty(tradable.availableInstruments, "symbol", symbol);
        },
        /**
         * Returns the correspondent instrument obj to the instrumentId if it's in the current account. Beware! getInstrumentFromId is a convenience synchronous method that retrieves the instrument from cache. In accounts in which the FULL_INSTRUMENT_LIST is not supported, you need to subscribe the instrument id to prices, have it in the account snapshot or request it through POST 'getInstrumentsFromIds' for it to be cached.
         * @param      {String}   instrumentId Instrument id
         * @return      {Object} Correspondent instrument obj to the id or null if not found
         * @example
         * _object-begin_Instrument_object-end_
         */
        getInstrumentFromId : function(instrumentId) {
            if(!instrumentId || !tradable.tradingEnabled) {
                return null;
            }
            if(isInstrumentCached(instrumentId)) {
                return tradable.getInstrumentForProperty(tradable.availableInstruments, "instrumentId", instrumentId);
            } else {
                console.warn("Instrument Id not found...");
            }
            return null;
        },
        /**
         * Returns the correspondent instrument obj to the brokerageAccountSymbol if it's in the current account. Beware! getInstrumentFromBrokerageAccountSymbol is a convenience synchronous method that retrieves the instrument from cache. In accounts in which the FULL_INSTRUMENT_LIST is not supported, you need to subscribe the instrument id to prices, have it in the account snapshot or request it through POST 'getInstrumentsFromIds' for it to be cached.
         * @param      {String}   brokerageAccountSymbol Instrument Brokerage Account Symbol
         * @return      {Object} Correspondent instrument obj to the Brokerage Account Symbol or null if not found
         * @example
         * _object-begin_Instrument_object-end_
         */
        getInstrumentFromBrokerageAccountSymbol : function(brokerageAccountSymbol) {
            return tradable.getInstrumentForProperty(tradable.availableInstruments, "brokerageAccountSymbol", brokerageAccountSymbol);
        },
        getInstrumentForProperty : function(instrumentList, property, value) {
            var instrument = null;
            $(instrumentList).each(function(index, ins){
                if(ins[property].toUpperCase() === value.toUpperCase()) {
                    instrument = ins;
                    return false;
                }
            });
            return instrument;
        },
        /**
         * Calculates the pip size for an instrument
         * @param instrumentId The instrument id to calculate the pip size
         * @returns {number}
         * @example
         * // In the following example the pip size would be 0.0001
         * var pipSize = tradable.calculatePipDistance("EURUSD");
         */
        calculatePipSize : function(instrumentId) {
            var instrument = tradable.getInstrumentFromId(instrumentId);
            if(!instrument) {
                throw "Instrument not found for the given instrumentId: " + instrumentId;
            }
            var pipPrec = instrument.pipPrecision;
            return (pipPrec > 0) ? (1 / (Math.pow(10, pipPrec))) : 1;
        },
        /**
         * Calculates the distance in Pips/Points between prices.
         * @param {String} instrumentId The instrument id to calculate the distance
         * @param {number} priceFrom Price to calculate the distance from (opening price, 'openPrice' for a position or price for an 'order')
         * @param {number} priceTo Price to calculate the distance to (closing price or protection price)
         * @returns {number} The pip/point distance (can return a negative value if from > to)
         * @example
         * // In the following example the distance result should be 31
         * var pipDistance = tradable.calculatePipDistance("EURUSD", 1.13571, 1.13881);
         */
        calculatePipDistance : function (instrumentId, priceFrom, priceTo) {
            var instrument = tradable.getInstrumentFromId(instrumentId);
            if(!instrument) {
                throw "Instrument not found for the given instrumentId: " + instrumentId;
            }
            var pipPrecision = (instrument.pipPrecision) ? instrument.pipPrecision : 0;
            var change = ((priceTo - priceFrom) * Math.pow(10, pipPrecision));
            return Math.round(change * 10) / 10;
        },
        /**
         * Calculates the resulting equity profit or loss for a position/order if a take profit or stop loss at a Pips/Points distance is hit
         * @param      {number} positionSize The position size, for a Long/Buy position: positive, for a Short/Sell position: negative
         * @param      {number} pipDistance Distance in pips/points. It can be calculated using the method 'tradable.calculatePipDistance'
         * @param      {number} pipValue The current value of one pip for one unit of this instrument converted to the account currency, it is part of the Price object
         * @return      {number} The expected profit or loss in account currency
         * @example
         * // The pipValue for EURUSD is 0.0001 in a USD account, so if a take profit at 25 pips is hit
         * // for a 10000 EURUSD Long (BUY) position the result should be 25
         * var position = {side: 'BUY', openPrice: 1.13250, amount: 10000}; // Fake position
         * var amount = (position.side === "BUY") ? position.amount : (position.amount*-1);
         * var pipDistance = tradable.calculatePipDistance("EURUSD", position.openPrice, 1.13500);
         * var expectedProfit = tradable.calculateExpectedProfitOrLoss(amount, pipDistance, 0.0001);
         *
         * // If the take profit is closing a Short (SELL) order instead, the amount should be negative
         * var order = {side: 'SELL', price: 1.13750, amount: 10000}; // Fake order
         * var amount = (order.side === "BUY") ? order.amount : (order.amount*-1);
         * var pipDistance = tradable.calculatePipDistance("EURUSD", order.price, 1.13500);
         * var expectedProfit = tradable.calculateExpectedProfitOrLoss(amount, pipDistance, 0.0001);
         */
        calculateExpectedProfitOrLoss : function (positionSize, pipDistance, pipValue) {
            return Math.round(positionSize * pipDistance * pipValue * 100) / 100;
        },
        /**
         * Calculates a position size for an instrument out of a given equity percentage willing to risk.
         * @param      {String} instrumentId The instrument id to calculate the position size
         * @param      {number} riskPercentage Percentage of account equity willing to risk
         * @param      {number} stopLossInPips Stop loss value in pips/points. It can be calculated using the method 'tradable.calculatePipDistance'
         * @param      {number} pipValue The current value of one pip for one unit of this instrument converted to the account currency, it is part of the Price object
         * @param      {number} equity(optional) The account equity, if not sent it will be taken from the selected account's last received snapshot
         * @return      {number} Calculated position size
         * @example
         * // Calculate the position size for risking 10% of the account's equity with a 25 pips stop loss
         * var positionSize = tradable.calculatePositionSize("EURUSD", 10, 25, pipValue);
         */
        calculatePositionSizeForRiskPercentage : function(instrumentId, riskPercentage, stopLossInPips, pipValue, equity){
            return tradable.calculatePositionSize(instrumentId, riskPercentage, false, stopLossInPips, pipValue, equity);
        },
        /**
         * Calculates a position size for an instrument out of a given amount willing to risk.
         * @param      {String} instrumentId The instrument id to calculate the position size
         * @param      {number} riskAmount Amount of equity (money in account currency) willing to risk
         * @param      {number} stopLossInPips Stop loss value in pips/points. It can be calculated using the method 'tradable.calculatePipDistance'
         * @param      {number} pipValue The current value of one pip for one unit of this instrument converted to the account currency, it is part of the Price object
         * @param      {number} equity(optional) The account equity, if not sent it will be taken from the selected account's last received snapshot
         * @return      {number} Calculated position size
         * @example
         * // Calculate the position size for risking 10k of the account's equity with a 25 pips stop loss
         * var positionSize = tradable.calculatePositionSizeForRiskAmount("EURUSD", 10000, 25, pipValue);
         */
        calculatePositionSizeForRiskAmount : function(instrumentId, riskAmount, stopLossInPips, pipValue, equity){
            return tradable.calculatePositionSize(instrumentId, riskAmount, true, stopLossInPips, pipValue, equity);
        },
        calculatePositionSize : function(instrumentId, risk, riskIsMoney, stopLossInPips, pipValue, equity){
            // Formula: Position size = ((accountSize x risk %) / stopLossInPips)/ pip value per standard lot
            var curEquity = equity;
            if(!curEquity && tradable.lastSnapshot) {
                curEquity = tradable.lastSnapshot.metrics.equity;
            } else if(!equity) {
                throw "Please provide the equity or subscribe to account updates before calling calculatePositionSizeForAccount.";
            }

            if(!riskIsMoney && risk > 100) {
                throw "Please provide a valid risk value: riskIsMoney is false but the provided risk is not a percentage..";
            }

            var moneyInRisk = riskIsMoney ? risk : curEquity * risk / 100;
            var positionSize = (moneyInRisk / stopLossInPips) / pipValue;

            var instrument = tradable.getInstrumentFromId(instrumentId);
            if(instrument.multipleOfMinAmount) {
                positionSize = Math.floor(positionSize/instrument.minAmount) * instrument.minAmount;
            } else {
                var decimalQty = getDecimalQty(instrument.minAmount);
                var roundTo = Math.pow(10, decimalQty);
                positionSize = Math.floor(positionSize * roundTo) / roundTo;
            }
            return positionSize;
        },
        /**
         * Returns the account object for the given account uniqueId
         * @param      {String}   accountId Account uniqueId
         * @return      {Object} Account object for the given account uniqueId or undefined if not found
         * @example
         * _object-begin_Account_object-end_   
         */
        getAccountById: function(accountId) {
            return tradable.accountMap[accountId];
        },
        //v1/user
        /**
         * Provides information about the end-user
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_User_object-callback-end_
         */
        getUser : function (resolve, reject) {
            return tradable.makeOsRequest("user", "GET", "", "", null, resolve, reject);
        },
        //v1/apps
        /**
         * Provides app information
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_App_object-callback-end_
         */
        getAppInfo : function (resolve, reject) {
            return tradable.makeOsRequest("apps", "GET", "", tradable.app_id, null, resolve, reject);
        },
        //v1/brokers
        /**
         * Provides account id and tokens granting access to the requested account
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Broker_list-callback-end_
         */
        getBrokers : function (resolve, reject) {
            return tradable.makeOsRequest("brokers", "GET", "", "", null, resolve, reject);
        },
        APP_KEY_MISSING : "Please specify your 'appKey' in the tradable config object or the 'data-app-key' attribute in the tradable core script tag.",
        //v1/authenticate
        /**
         * Gets a token granting access to the account(s) associated with the given login and enables trading
         * @param      {number} brokerId  The id of the broker that the account is at
         * @param      {String} login The login for the account
         * @param      {String} password The password for the account
         * @param      {String} externalId 	Allows the caller to provide an id for the user, so it is possible to link the user identity in the caller's system with the Tradable account.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        authenticateWithCredentials : function (brokerId, login, password, externalId, resolve, reject) {
            var deferred = new $.Deferred();

            //Backwards compatibility, externalId was not supported before
            if(typeof externalId === "function") { //externalId would be the old resolve
                if(typeof resolve === "function") { //resolve would be the old reject
                    reject = resolve;
                }
                resolve = externalId;
            }

            resetExcludedAccounts();
            var apiAuthenticationRequest = {"appId": tradable.app_id, "brokerId": brokerId, "login": login, "password": password};
            if(tradable.app_key) {
                apiAuthenticationRequest['appKey'] = tradable.app_key;
            } else {
                throw tradable.APP_KEY_MISSING;
            }
            if(typeof externalId === "string") {
                apiAuthenticationRequest['externalId'] = externalId;
            }
            tradable.makeAuthenticationRequest(deferred, "authenticate", apiAuthenticationRequest);

            return resolveDeferred(deferred, resolve, reject);
        },
        //v1/createDemoAccount
        createDemoAccount : function (type, resolve, reject) {
            var deferred = new $.Deferred();

            var demoAPIAuthenticationRequest = {"appId": tradable.app_id, "type": type};
            if(tradable.app_key) {
                demoAPIAuthenticationRequest['appKey'] = tradable.app_key;
            } else {
                throw tradable.APP_KEY_MISSING;
            }
            tradable.makeAuthenticationRequest(deferred, "createDemoAccount", demoAPIAuthenticationRequest);

            return resolveDeferred(deferred, resolve, reject);
        },
        makeAuthenticationRequest : function(deferred, method, postData) {
            var apiAuthentication;
            return tradable.makeOsRequest(method, "POST", "", "", postData).then(function(auth) {
                apiAuthentication = auth;
                return tradable.enableTrading(auth.apiTokenValue, auth.apiEndpoint, auth.expires);
            }).then(function() {
                deferred.resolve(apiAuthentication);
            }, function(error) {
                deferred.reject(error);
            });
        },
        /**
         * Creates a Forex demo account, gets an authentication token granting access to that account and enables trading for it
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        createForexDemoAccount : function (resolve, reject) {
            return tradable.createDemoAccount("FOREX", resolve, reject);
        },
        /**
         * Creates a Stock demo account, gets an authentication token granting access to that account and enables trading for it
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        createStocksDemoAccount : function (resolve, reject) {
            return tradable.createDemoAccount("STOCKS", resolve, reject);
        },
        /**
         * Refreshes the authentication that was granted when the refresh token was issued
         * @param      {String} refreshTokenValue The value of the refresh token.
         * @param      {String} appSecret   The client secret of the app that is requesting the refresh
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        refreshAuthentication : function (refreshTokenValue, appSecret, resolve, reject) {
            var deferred = new $.Deferred();

            var apiRefreshAuthenticationRequest = { "refreshTokenValue": refreshTokenValue };
            if(appSecret) {
                // Autogenerated demo accounts don't require a secret
                apiRefreshAuthenticationRequest = { "refreshTokenValue": refreshTokenValue, "appSecret": appSecret };
            }
            tradable.makeAuthenticationRequest(deferred, "refreshAuthentication", apiRefreshAuthenticationRequest);

            return resolveDeferred(deferred, resolve, reject);
        },
        //v1/accounts
        /**
         * Initializes the tradable.accountsMap and the tradable.accounts list
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * [exampleiframe-begin]//codepen.io/tradableEmbed/embed/ZbZWbe/?height=300&theme-id=21042&default-tab=js[exampleiframe-end]
         * @example
         * _object-callback-begin_AccountList_object-callback-end_
         */
        getAccounts : function (resolve, reject){
            var accountsPromise = tradable.makeAccountRequest("GET", "", "", null).then(function(data){
                tradable.accounts.splice(0, tradable.accounts.length);
                tradable.allAccounts.splice(0, tradable.allAccounts.length);
                tradable.accountMap = {};
                $(data.accounts).each(function(index, account){
                   if (!!account.uniqueId && account.uniqueId !== "NA" &&
                       tradable.accountIdsToExclude.indexOf(account.uniqueId) <= -1){
                       tradable.accounts.push(account);
                       tradable.accountMap[account.uniqueId] = account;
                   }
                   tradable.allAccounts.push(account);
                });
            });

            return resolveDeferred(accountsPromise, resolve, reject);
        },
        //v1/accounts/{accountId}/candles
        /**
         * Provides candles for the selectedAccount, given instrument Id, aggregation and range (from-to)
         * @param      {String} instrumentId The instrument id for the candles
         * @param      {number} from The start of the candle range. In milliseconds since epoch
         * @param      {number} to The end of the candle range. In milliseconds since epoch
         * @param      {number} aggregation The aggregation interval in minutes. Allowed values: 1,5,15,30,60,1440,21600,40320
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * // Day Candles for last week:
         * var id = "someInsturmentId";
         * var fromDate = new Date();
         * fromDate.setDate(fromDate.getDate() - 7);
         * var dayRes = 60 * 24;
         *
         * tradable.getCandles(id, fromDate.getTime(), Date.now(), dayRes).then(function(data){
         *     console.log("Received candles: " + JSON.stringify(data, null, 2));
         * }, function(jqXHR){
         *     console.error("Error requesting candles: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_Candles_object-callback-end_
         */
        getCandles : function (instrumentId, from, to, aggregation, resolve, reject) {
            return tradable.getCandlesForAccount(tradable.selectedAccountId, instrumentId, from, to, aggregation, resolve, reject);
        },
        /**
         * Provides candles for a specific account, the given instrument Id, aggregation and range (from-to)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} instrumentId The instrument id for the candles
         * @param      {number} from The start of the candle range. In milliseconds since epoch
         * @param      {number} to The end of the candle range. In milliseconds since epoch
         * @param      {number} aggregation The aggregation interval in minutes. Allowed values: 1,5,15,30,60,1440,21600,40320
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * // Hourly Candles for last 2 days:
         * var actId = tradable.selectedAccount.uniqueId;
         * var id = "someInsturmentId";
         * var fromDate = new Date();
         * fromDate.setDate(fromDate.getDate() - 2);
         * var hourRes = 60;
         *
         * tradable.getCandlesForAccount(actId, id, fromDate.getTime(), Date.now(), hourRes).then(function(data){
         *     console.log("Received candles: " + JSON.stringify(data, null, 2));
         * }, function(jqXHR){
         *     console.error("Error requesting candles: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_Candles_object-callback-end_
         */
        getCandlesForAccount : function (accountId, instrumentId, from, to, aggregation, resolve, reject) {
            var candleRequest = {"instrumentId": instrumentId, "from": from, "to": to, "aggregation": aggregation};
            return tradable.makeAccountRequest("POST", accountId, "candles/", candleRequest, resolve, reject);
        },
        subscribedCandleId : undefined,
        lastReceivedCandle : undefined,
        /**
         * Provides candle updates (new prices) with the same frequency as the account update frequency. The provided candle list will be for the selectedAccount, given instrument Id, aggregation and range (from-to current time). It is only possible to start updates for one instrument, range and aggregation at a time.
         * @param      {String} instrumentId The instrument id for the candles
         * @param      {number} from The start of the candle range. In milliseconds since epoch
         * @param      {number} aggregation The aggregation interval in minutes. Allowed values: 1,5,15,30,60,1440,21600,40320
         * @param      {Function} callback Callback function that wiil receive the updates
         * @example
         * // Updates for 30 minute Candles starting 3 hours ago:
         * var from = Date.now() - (1000 * 60 * 60 * 3);
         *
         * tradable.startCandleUpdates("EURUSD", from, 30, function(data) {
         *     console.log("Received candles: " + JSON.stringify(data, null, 2));
         * });
         *
         * _list-callback-begin_Candle_list-callback-end_
         */
        startCandleUpdates : function(instrumentId, from, aggregation, callback) {
            tradable.stopCandleUpdates();

            var aggregationInMillis = aggregation * 60 * 1000;
            tradable.subscribedCandleId = instrumentId;
            tradable.addInstrumentIdToUpdates("internalCandleUpdates", tradable.subscribedCandleId);

            tradable.getCandles(instrumentId, from, Date.now(), aggregation).then(function(data) {
                tradable.lastReceivedCandle = data.candles[data.candles.length - 1];
                startCandleListener();
                return callback(data.candles);
            }, function(jqXHR) {
                notifyErrorCallbacks(jqXHR.responseJSON);
            });

            function startCandleListener() {
                tradable.on("internalCandleUpdates", "accountUpdated", function(snapshot) {
                    var latestPriceObj = getPriceFromList(instrumentId, snapshot.prices);
                    if(!!tradable.lastReceivedCandle && !!latestPriceObj && !!latestPriceObj.bid) {
                        var candleBeforeProcessing = JSON.stringify($.extend({}, tradable.lastReceivedCandle));
                        processCandle(latestPriceObj, aggregationInMillis);

                        if(candleBeforeProcessing !== JSON.stringify(tradable.lastReceivedCandle)) {
                            var candles = [];
                            candles.push(tradable.lastReceivedCandle);
                            return callback(candles);
                        }
                    }
                });
            }
            function processCandle(latestPriceObj, aggregationInMillis) {
                var latestPrice = latestPriceObj.bid;
                // New candle if required
                if(Date.now() - tradable.lastReceivedCandle.timestamp >= aggregationInMillis) {
                    tradable.lastReceivedCandle.timestamp = tradable.lastReceivedCandle.timestamp + aggregationInMillis;
                    var lastClose = tradable.lastReceivedCandle.close;
                    tradable.lastReceivedCandle.open = lastClose;
                    tradable.lastReceivedCandle.high = lastClose;
                    tradable.lastReceivedCandle.low = lastClose;
                }

                tradable.lastReceivedCandle.close = latestPrice;
                if(latestPrice > tradable.lastReceivedCandle.high) {
                    tradable.lastReceivedCandle.high = latestPrice;
                }
                if(latestPrice < tradable.lastReceivedCandle.low) {
                    tradable.lastReceivedCandle.low = latestPrice;
                }
            }
            function getPriceFromList(instrumentId, list) {
                var price = null;
                $(list).each(function(index, priceObj){
                    if(priceObj.instrumentId === instrumentId) {
                        price = priceObj;
                        return false;
                    }
                });
                return price;
            }
        },
        /**
         * Stops the candle updates if any in progress
         */
        stopCandleUpdates : function() {
            if(tradable.subscribedCandleId) {
                tradable.removeInstrumentIdFromUpdates("internalCandleUpdates", tradable.subscribedCandleId);
                tradable.off("internalCandleUpdates");
                tradable.subscribedCandleId = undefined;
                tradable.lastReceivedCandle = undefined;
            }
        },
        //v1/accounts/{accountId}
        /**
         * Provides the account snapshot for the selectedAccount - a full snapshot of all orders, positions, account metrics and prices for the instrument Ids given as input
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_AccountSnapshot_object-callback-end_
         */
        getSnapshot : function (instrumentIds, resolve, reject){
            return tradable.getSnapshotForAccount(tradable.selectedAccountId, instrumentIds, resolve, reject);
        },
        /**
         * Provides the account snapshot for a specific account - a full snapshot of all orders, positions, account metrics and prices for the instrument Ids given as input
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_AccountSnapshot_object-callback-end_
         */
        getSnapshotForAccount : function (accountId, instrumentIds, resolve, reject){
            var instrumentIdsObj = {"instrumentIds": instrumentIds, "includeMarginFactors": false};
            return tradable.makeAccountRequest("POST", accountId, "", instrumentIdsObj, resolve, reject);
        },
        //v1/accounts/{accountId}/instruments
         /**
         * Get the instrument information for a set of instrument Ids for the selectedAccount
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted instruments
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * tradable.getInstrumentsFromIds(["xyz456"]).then(function(instruments) {
         *      console.log(JSON.stringify(instruments, null, 2));
         * }, function(jqXHR) {
         *      console.error("Error trying to retrieve instruments: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_InstrumentList_object-callback-end_
         */
        getInstrumentsFromIds : function (instrumentIds, resolve, reject){
            return tradable.getInstrumentsFromIdsForAccount(tradable.selectedAccountId, instrumentIds, resolve, reject);
        },
         /**
         * Get the instrument information for a set of instrument Ids for for a specific accountId
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted instruments
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * var accountId = tradable.selectedAccount.uniqueId;
         * tradable.getInstrumentsFromIdsForAccount(accountId, ["xyz456"]).then(function(instruments) {
         *      console.log(JSON.stringify(instruments, null, 2));
         * }, function(jqXHR) {
         *      console.error("Error trying to retrieve instruments: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_InstrumentList_object-callback-end_
         */
        getInstrumentsFromIdsForAccount : function (accountId, instrumentIds, resolve, reject){
            var deferred = new $.Deferred();

            var missingIds = [];
            if(!isFullInstrumentListAvailableForAccount(accountId)) {
                missingIds = findMissingInstrumentIds(instrumentIds);
            }

            var instrumentDeferred = new $.Deferred();
            if(missingIds.length) {
                var instrumentIdsObj = {"instrumentIds": missingIds};
                tradable.makeAccountRequest("POST", accountId, "instruments/", instrumentIdsObj).then(function(instruments) {
                    cacheInstruments(instruments.instruments);
                    instrumentDeferred.resolve(tradable.availableInstruments);
                }, function (error) {
                    deferred.reject(error);
                });
            } else {
                tradable.getOrResolveInstrumentsForAccountId(accountId, instrumentDeferred, deferred);
            }

            instrumentDeferred.then(function(instrumentList) {
                var instrumentResult = [];
                $(instrumentIds).each(function(idx, instrumentId) {
                    var instrument = tradable.getInstrumentForProperty(instrumentList, "instrumentId", instrumentId);
                    if(instrument) {
                        instrumentResult.push(instrument);
                    }
                });
                deferred.resolve({"instruments": instrumentResult});
            }, function(error) {
                deferred.reject(error);
            });

            return resolveDeferred(deferred, resolve, reject);
        },
        getOrResolveInstrumentsForAccountId : function(accountId, instrumentDeferred, deferred) {
            if(!tradable.selectedAccount || accountId !== tradable.selectedAccount.uniqueId) {
                getInstrumentsForAccount(accountId).then(function(instruments) {
                    instrumentDeferred.resolve(instruments);
                }, function(error) {
                    deferred.reject(error);
                });
            } else {
                instrumentDeferred.resolve(tradable.availableInstruments);
            }
        },
        /**
         * Search for instruments with a specific String for the selectedAccount.
         * @param      {String} query The query used in an instrument search
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * tradable.searchInstruments("EURUS").then(function(instrumentResults) {
         *      console.log(JSON.stringify(instrumentResults, null, 2));
         * }, function(jqXHR) {
         *      console.error("Error trying to find instruments: " + jqXHR.responseJSON.message);
         * });
         *
         * _list-callback-begin_InstrumentSearchResult_list-callback-end_
         */
        searchInstruments : function (query, resolve, reject){
            return tradable.searchInstrumentsForAccount(tradable.selectedAccountId, query, resolve, reject);
        },
        /**
         * Search for instruments with a specific String for a specific accountId.
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} query The query used in an instrument search
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * var accountId = tradable.selectedAccount.uniqueId;
         * tradable.searchInstrumentsForAccount(accountId, "EURUS").then(function(instrumentResults) {
         *      console.log(JSON.stringify(instrumentResults, null, 2));
         * }, function(jqXHR) {
         *      console.error("Error trying to find instruments: " + jqXHR.responseJSON.message);
         * });
         *
         * _list-callback-begin_InstrumentSearchResult_list-callback-end_
         */
        searchInstrumentsForAccount : function (accountId, query, resolve, reject){
            var deferred = new $.Deferred();

            if(isFullInstrumentListAvailableForAccount(accountId)) {
                var instrumentsDeferred = new $.Deferred();
                tradable.getOrResolveInstrumentsForAccountId(accountId, instrumentsDeferred, deferred);

                instrumentsDeferred.then(function(instrumentList) {
                    var result = matchInstruments(instrumentList, query);
                    var normalizedInstrumentResults = [];
                    $(result).each(function(idx, elem) {
                        normalizedInstrumentResults.push(normalizeInstrumentObject(elem));
                    });
                    deferred.resolve(normalizedInstrumentResults);
                }, function(error) {
                    deferred.reject(error);
                });
            } else {
                var queryObj = {"query": query};
                if(query.length < 2) {
                    deferred.resolve([]);
                } else {
                    tradable.makeAccountRequest("POST", accountId, "instrumentsearch/", queryObj).then(function(searchResult) {
                        deferred.resolve(searchResult.instruments);
                    }, function(error) {
                        deferred.reject(error);
                    });
                }
            }

            return resolveDeferred(deferred, resolve, reject);

            function matchInstruments(instruments, query) {
                var matcher = new RegExp( escRegex( query ), "i" );
                return $.grep(instruments, function(value) {
                    return matcher.test(value.symbol)
                        || matcher.test(value.brokerageAccountSymbol)
                        || matcher.test(value.displayName)
                        || matcher.test(value.type);
                });
            }
            function escRegex(s) {
                return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            }
            // Normalize Instrument object to match the InstrumentSearchResult
            function normalizeInstrumentObject(originalInstrument) {
                var elem = $.extend({}, originalInstrument);
                var instrumentResultProperties = ["instrumentId", "symbol", "brokerageAccountSymbol", "displayName", "shortDescription", "type"];
                var propertiesToRemove = [];
                for(var property in elem) {
                    if(elem.hasOwnProperty(property) && $.inArray(property, instrumentResultProperties) < 0) {
                        propertiesToRemove.push(property);
                    }
                }
                $(propertiesToRemove).each(function(idx, prop) {
                    delete elem[prop];
                });
                return elem;
            }
        },
        //v1/accounts/{accountId}/metrics
         /**
         * The users balance and other account metrics for the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_AccountMetrics_object-callback-end_
         */
        getMetrics : function (resolve, reject){
            return tradable.getMetricsForAccount(tradable.selectedAccountId, resolve, reject);
        },
         /**
         * The users balance and other account metrics for a specific accountId
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_AccountMetrics_object-callback-end_
         */
        getMetricsForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "metrics/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/orders
         /**
         * Returns a list of all the orders divided in pending, recentlyCancelled and recentlyExecuted for the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Orders_object-callback-end_
         */
        getOrders : function (resolve, reject){
            return tradable.getOrdersForAccount(tradable.selectedAccountId, resolve, reject);
        },
         /**
         * Returns a list of all the orders divided in pending, recentlyCancelled and recentlyExecuted for a specific accountId
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Orders_object-callback-end_
         */
        getOrdersForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "orders/", null, resolve, reject);
        },
         /**
         * Place a MARKET order on the selectedAccount
         * @param      {number} amount The order amount
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * tradable.placeMarketOrder(10000, "BUY", "abc123").then(function(order) {
         *      console.log(JSON.stringify(order, null, 2));
         * }, function(jqXHR) {
         *      console.error("Trade rejected: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_Order_object-callback-end_
         */
        placeMarketOrder : function (amount, side, instrumentId, resolve, reject){
            return tradable.placeOrder(amount, 0, side, instrumentId, "MARKET", resolve, reject);
        },
         /**
         * Place a MARKET order on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {number} amount The order amount
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * var accountId = tradable.selectedAccount.uniqueId;
         * tradable.placeMarketOrderForAccount(accountId, 10000, "BUY", "abc123").then(function(order) {
         *      console.log(JSON.stringify(order, null, 2));
         * }, function(jqXHR) {
         *      console.error("Trade rejected: " + jqXHR.responseJSON.message);
         * });
         *
         * _object-callback-begin_Order_object-callback-end_
         */
        placeMarketOrderForAccount : function (accountId, amount, side, instrumentId, resolve, reject){
            return tradable.placeOrderForAccount(accountId, amount, 0, side, instrumentId, "MARKET", resolve, reject);
        },
         /**
         * Place a LIMIT order on the selectedAccount
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeLimitOrder : function (amount, price, side, instrumentId, resolve, reject){
            return tradable.placeOrder(amount, price, side, instrumentId, "LIMIT", resolve, reject);
        },
         /**
         * Place a LIMIT order on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order.
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeLimitOrderForAccount : function (accountId, amount, price, side, instrumentId, resolve, reject){
            return tradable.placeOrderForAccount(accountId, amount, price, side, instrumentId, "LIMIT", resolve, reject);
        },
         /**
         * Place a STOP order on the selectedAccount
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeStopOrder : function (amount, price, side, instrumentId, resolve, reject){
            return tradable.placeOrder(amount, price, side, instrumentId, "STOP", resolve, reject);
        },
         /**
         * Place a STOP order on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order.
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeStopOrderForAccount : function (accountId, amount, price, side, instrumentId, resolve, reject){
            return tradable.placeOrderForAccount(accountId, amount, price, side, instrumentId, "STOP", resolve, reject);
        },
        placeOrder : function (amount, price, side, instrumentId, type, resolve, reject){
            return tradable.placeOrderForAccount(tradable.selectedAccountId, amount, price, side, instrumentId, type, resolve, reject);
        },
        placeOrderForAccount : function (accountId, amount, price, side, instrumentId, type, resolve, reject){
            var order = {"amount": amount, "price": price, "side": side, "instrumentId": instrumentId, "type": type};
            return tradable.makeAccountRequest("POST", accountId, "orders/", order, resolve, reject);
        },
         /**
         * [deprecated] Please use 'placeProtectedOrder'
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order (0 if MARKET order)
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {String} type Order type ('MARKET','LIMIT' or 'STOP')
         * @param      {number} tpDistance The distance from the filled price where the take profit trigger price will be set. This is only supported for some account types, use the API getAccounts call to check if it is supported. (Set to null if not wanted)
         * @param      {number} slDistance The distance from the filled price where the stop loss trigger price will be set. This is only supported for some account types, use the API getAccounts call to check if it is supported. (Set to null if not wanted)
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @deprecated [This method will eventually be removed, please use 'placeProtectedOrder']
         */
        placeOrderWithProtections : function (amount, price, side, instrumentId, type, tpDistance, slDistance, resolve, reject){
            return tradable.placeOrderWithProtectionsForAccount(tradable.selectedAccountId, amount, price, side, instrumentId, type, tpDistance, slDistance, resolve, reject);
        },
         /**
         * [deprecated] Please use 'placeProtectedOrderForAccount'
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order (0 if MARKET order)
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {String} type Order type ('MARKET','LIMIT' or 'STOP')
         * @param      {number} tpDistance The distance from the filled price where the take profit trigger price will be set. This is only supported for some account types, use the API getAccounts call to check if it is supported. (Set to null if not wanted)
         * @param      {number} slDistance The distance from the filled price where the stop loss trigger price will be set. This is only supported for some account types, use the API getAccounts call to check if it is supported. (Set to null if not wanted)
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @deprecated [This method will eventually be removed, please use 'placeProtectedOrderForAccount']
         */
        placeOrderWithProtectionsForAccount : function (accountId, amount, price, side, instrumentId, type, tpDistance, slDistance, resolve, reject){
            console.warn("placeOrderWithProtections is deprecated and will eventually be removed, please use placeProtectedOrder or placeProtectedOrderForAccount instead.");
            var order = {'amount': amount, 'price': price, 'side': side, 'instrumentId': instrumentId, 'type': type};
            if(tpDistance)
                order["takeProfitDistance"] = tpDistance;
            if(slDistance)
                order["stopLossDistance"] = slDistance;
            return tradable.makeAccountRequest("POST", accountId, "orders/", order, resolve, reject);
        },
        /**
         * Place a MARKET, LIMIT or STOP order with Take Profit and/or Stop Loss protections on the selected account. Some accounts require an absolute price for the take profit and others require a price distance (See 'account.protectionEntryTypes'). This method will send the required entry type and value, i.e. it will calculate the distance from the price and send it if the account only supports the 'DISTANCE' entry type or just send the desired take profit or stop loss prices if the 'ABSOLUTE' entry type is supported
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order (0 if MARKET order)
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {String} type Order type ('MARKET','LIMIT' or 'STOP')
         * @param      {number} takeProfitPrice Take profit trigger price (null if not desired)
         * @param      {number} stopLossPrice Stop loss trigger price (null if not desired)
         * @param      {number} currentBidOrAskPrice For 'BUY' MARKET orders the ask price for the instrument, for 'SELL' MARKET orders the bid price. It is only required for MARKET orders with protections, for LIMIT and STOP orders pass 0.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeProtectedOrder : function (amount, price, side, instrumentId, type, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject) {
            return tradable.placeProtectedOrderForAccount(tradable.selectedAccount.uniqueId, amount, price, side, instrumentId, type, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject);
        },
        /**
         * Place a MARKET, LIMIT or STOP order with Take Profit and/or Stop Loss protections on a specific account. Some accounts require an absolute price for the take profit and others require a price distance (See 'account.protectionEntryTypes'). This method will send the required entry type and value, i.e. it will calculate the distance from the price and send it if the account only supports the 'DISTANCE' entry type or just send the desired take profit or stop loss prices if the 'ABSOLUTE' entry type is supported
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {number} amount The order amount
         * @param      {number} price The trigger price for the order (0 if MARKET order)
         * @param      {String} side The order side ('BUY' or 'SELL')
         * @param      {String} instrumentId The instrument id for the order
         * @param      {String} type Order type ('MARKET','LIMIT' or 'STOP')
         * @param      {number} takeProfitPrice Take profit trigger price (null if not desired)
         * @param      {number} stopLossPrice Stop loss trigger price (null if not desired)
         * @param      {number} currentBidOrAskPrice For 'BUY' MARKET orders the ask price for the instrument, for 'SELL' MARKET orders the bid price. It is only required for MARKET orders with protections, for LIMIT and STOP orders pass 0.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        placeProtectedOrderForAccount : function (accountId, amount, price, side, instrumentId, type, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject) {
            tradable.validateOrderParams(type, price, currentBidOrAskPrice, takeProfitPrice, stopLossPrice);

            var orderCommand = {'amount': amount, 'price': price, 'side': side, 'instrumentId': instrumentId, 'type': type};

            var priceForDistance = (type === "MARKET") ? currentBidOrAskPrice : price;
            $.extend(orderCommand, tradable.getOrderProtections(accountId, takeProfitPrice, stopLossPrice, priceForDistance));

            return tradable.makeAccountRequest("POST", accountId, "orders/", orderCommand, resolve, reject);
        },
        validateOrderParams : function (type, price, currentBidOrAskPrice, takeProfitPrice, stopLossPrice) {
            if(type === "MARKET") {
                if((takeProfitPrice || stopLossPrice) && (typeof currentBidOrAskPrice !== "number" || !currentBidOrAskPrice)) {
                    throw "MARKET orders require a valid 'currentBidOrAskPrice'";
                } else if(price !== 0) {
                    throw "The price for MARKET orders must be 0";
                }
            } else if(type !== "MARKET" && (typeof price !== "number" || !price)) {
                throw "LIMIT and STOP orders require a valid order price";
            }
        },
        /**
         * Modify a MARKET, LIMIT or STOP order with Take Profit and/or Stop Loss protections on the selected account. Some accounts require an absolute price for the take profit and others require a price distance (See 'account.protectionEntryTypes'). This method will send the required entry type and value, i.e. it will calculate the distance from the price and send it if the account only supports the 'DISTANCE' entry type or just send the desired take profit or stop loss prices if the 'ABSOLUTE' entry type is supported
         * @param      {Object} order Order object to be modified
         * @param      {number} price The new trigger price (Current order price or undefined if no modification required)
         * @param      {number} takeProfitPrice Take profit trigger price (null to delete take profit | current take profit price or undefined if no modification required)
         * @param      {number} stopLossPrice Stop loss trigger price (null to delete stop loss | current stop loss price or undefined if no modification required)
         * @param      {number} currentBidOrAskPrice For 'BUY' MARKET orders the ask price for the instrument, for 'SELL' MARKET orders the bid price. It is only required for MARKET orders, for LIMIT and STOP orders pass 0.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        modifyProtectedOrder : function (order, price, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject) {
            return tradable.modifyProtectedOrderForAccount(tradable.selectedAccount.uniqueId, order, price, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject);
        },
        /**
         * Modify a MARKET, LIMIT or STOP order with Take Profit and/or Stop Loss protections on a specific account. Some accounts require an absolute price for the take profit and others require a price distance (See 'account.protectionEntryTypes'). This method will send the required entry type and value, i.e. it will calculate the distance from the price and send it if the account only supports the 'DISTANCE' entry type or just send the desired take profit or stop loss prices if the 'ABSOLUTE' entry type is supported
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Object} order Order object to be modified
         * @param      {number} newPrice The new trigger price (Current order price or undefined if no modification required)
         * @param      {number} takeProfitPrice Take profit trigger price (null to delete take profit | current take profit price or undefined if no modification required)
         * @param      {number} stopLossPrice Stop loss trigger price (null to delete stop loss | current stop loss price or undefined if no modification required)
         * @param      {number} currentBidOrAskPrice For 'BUY' MARKET orders the ask price for the instrument, for 'SELL' MARKET orders the bid price. It is only required for MARKET orders, for LIMIT and STOP orders pass 0.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        modifyProtectedOrderForAccount : function (accountId, order, newPrice, takeProfitPrice, stopLossPrice, currentBidOrAskPrice, resolve, reject) {
            var orderPrice = (newPrice && newPrice !== order.price) ? newPrice : order.price;
            var orderModification = (order.price !== orderPrice) ? {'price': orderPrice} : {};

            var priceForDistance = (order.type === "MARKET") ? currentBidOrAskPrice : orderPrice;
            var orderProtections = tradable.getOrderProtections(accountId, takeProfitPrice, stopLossPrice, priceForDistance);

            tradable.verifyProtectionModification(order, orderProtections, "takeProfit");
            tradable.verifyProtectionModification(order, orderProtections, "stopLoss");

            $.extend(orderModification, orderProtections);

            return tradable.makeAccountRequest("PUT", accountId, "orders/"+order.id, orderModification, resolve, reject);
        },
        verifyProtectionModification : function (order, orderProtections, protectionType) {
            if(orderProtections[protectionType] === order[protectionType] ||
                    (order[protectionType] && orderProtections[protectionType] &&
                        orderProtections[protectionType].value === order[protectionType].value &&
                        orderProtections[protectionType].entryType === order[protectionType].entryType)) {
                delete orderProtections[protectionType];
            }
        },
        getOrderProtections : function(accountId, takeProfitPrice, stopLossPrice, priceForDistance) {
            var account = tradable.accountMap[accountId];
            var supportedEntryTypes = account.protectionEntryTypes.entryTypes;

            var orderProtections = {};
            if (supportedEntryTypes.length) {
                var entryType = ($.inArray("ABSOLUTE", supportedEntryTypes) !== -1) ? "ABSOLUTE" : "DISTANCE";

                if(typeof takeProfitPrice !== "undefined") {
                    orderProtections["takeProfit"] = getProtection(takeProfitPrice, priceForDistance, entryType);
                }
                if(typeof stopLossPrice !== "undefined") {
                    orderProtections["stopLoss"] = getProtection(stopLossPrice, priceForDistance, entryType);
                }
            }
            return orderProtections;

            function getProtection(protectionPrice, priceForDistance, entryType) {
                return (protectionPrice === null) ? protectionPrice : {
                    'entryType': entryType,
                    'value': (entryType === "DISTANCE") ? Math.abs(priceForDistance - protectionPrice) : protectionPrice
                };
            }
        },
        /**
         * Cancel a Take Profit protection attached to a MARKET, LIMIT or STOP order on the selected account
         * @param      {String} orderId Id of order to which the Take Profit is attached
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        cancelTakeProfitOnOrder : function (orderId, resolve, reject) {
            return tradable.cancelTakeProfitOnOrderForAccount(tradable.selectedAccount.uniqueId, orderId, resolve, reject);
        },
        /**
         * Cancel a Take Profit protection attached to a MARKET, LIMIT or STOP order on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to which the Take Profit is attached
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        cancelTakeProfitOnOrderForAccount : function (accountId, orderId, resolve, reject) {
            return tradable.makeAccountRequest("PUT", accountId, "orders/"+orderId, {'takeProfit': null}, resolve, reject);
        },
        /**
         * Cancel a Stop Loss protection attached to a MARKET, LIMIT or STOP order on the selected account
         * @param      {String} orderId Id of order to which the Stop Loss is attached
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        cancelStopLossOnOrder : function (orderId, resolve, reject) {
            return tradable.cancelStopLossOnOrderForAccount(tradable.selectedAccount.uniqueId, orderId, resolve, reject);
        },
        /**
         * Cancel a Stop Loss protection attached to a MARKET, LIMIT or STOP order on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to which the Stop Loss is attached
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Empty_object-callback-end_
         */
        cancelStopLossOnOrderForAccount : function (accountId, orderId, resolve, reject) {
            return tradable.makeAccountRequest("PUT", accountId, "orders/"+orderId, {'stopLoss': null}, resolve, reject);
        },
        //v1/accounts/{accountId}/orders/pending
         /**
         * Returns a list of all the pending orders the selectedAccount - This will typically be limit orders but in a market without liquidity it can also contain market orders
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Order_list-callback-end_
         */
        getPendingOrders : function (resolve, reject){
            return tradable.getPendingOrdersForAccount(tradable.selectedAccountId, resolve, reject);
        },
         /**
         * Returns a list of all the pending orders for a specific account - This will typically be limit orders but in a market without liquidity it can also contain market orders
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Order_list-callback-end_
         */
        getPendingOrdersForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "orders/pending", null, resolve, reject);
        },
        //v1/accounts/{accountId}/orders/{orderId}
         /**
         * Returns an order for the provided id and the selectedAccount, without the up-to-date price
         * @param      {String} orderId Id of order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        getOrderById : function (orderId, resolve, reject){
            return tradable.getOrderByIdForAccount(tradable.selectedAccountId, orderId, resolve, reject);
        },
         /**
         * Returns an order for the provided id and a specific account, without the up-to-date price
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} orderId Id of order
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Order_object-callback-end_
         */
        getOrderByIdForAccount : function (accountId, orderId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "orders/"+orderId, null, resolve, reject);
        },
        /**
         * Modifies the price for the order identified with the given id on the selectedAccount
         * @param      {String} orderId Id of order to modify
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        modifyOrderPrice : function (orderId, newPrice, resolve, reject){
            return tradable.modifyOrderPriceForAccount(tradable.selectedAccountId, orderId, newPrice, resolve, reject);
        },
        /**
         * Modifies the price for the order identified with the given id on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to modify
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        modifyOrderPriceForAccount : function (accountId, orderId, newPrice, resolve, reject){
            return tradable.makeAccountRequest("PUT", accountId, "orders/"+orderId, {"price": newPrice}, resolve, reject);
        },
        /**
         * Cancels the order with the given id on the selectedAccount
         * @param      {String} orderId Id of order to cancel
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelOrder : function (orderId, resolve, reject){
            return tradable.cancelOrderForAccount(tradable.selectedAccountId, orderId, resolve, reject);
        },
        /**
         * Cancels the order with the given id on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} orderId Id of order to cancel
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelOrderForAccount : function (accountId, orderId, resolve, reject){
            return tradable.makeAccountRequest("DELETE", accountId, "orders/"+orderId, null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions
        /**
         * Returns a list of all the positions on the selectedAccount. Will return open and recently closed positions
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Positions_object-callback-end_
         */
        getPositions : function (resolve, reject){
            return tradable.getPositionsForAccount(tradable.selectedAccountId, resolve, reject);
        },
        /**
         * Returns a list of all the positions on a specific account. Will return open and recently closed positions
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Positions_object-callback-end_
         */
        getPositionsForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "positions/", null, resolve, reject);
        },
        /**
         * Closes all positions on the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closeAllPositions : function (resolve, reject){
            return tradable.closeAllPositionsForAccount(tradable.selectedAccountId, resolve, reject);
        },
        /**
         * Closes all positions on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closeAllPositionsForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("DELETE", accountId, "positions/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/open
        /**
         * Returns a list of all the open positions on the selectedAccount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Position_list-callback-end_
         */
        getOpenPositions : function (resolve, reject){
            return tradable.getOpenPositionsForAccount(tradable.selectedAccountId, resolve, reject);
        },
        /**
         * Returns a list of all the open positions on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Position_list-callback-end_
         */
        getOpenPositionsForAccount : function (accountId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "positions/open", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}
        /**
         * Returns a position for the provided id, without the up-to-date price and metrics on the selectedAccount
         * @param      {String} positionId Id of position to retrieve
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Position_object-callback-end_
         */
        getPositionById : function (positionId, resolve, reject){
            return tradable.getPositionByIdForAccount(tradable.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Returns a position for the provided id, without the up-to-date price and metrics on a specific account
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to retrieve
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _object-callback-begin_Position_object-callback-end_
         */
        getPositionByIdForAccount : function (accountId, positionId, resolve, reject){
            return tradable.makeAccountRequest("GET", accountId, "positions/"+positionId, null, resolve, reject);
        },
        /**
         * Reduces the position (on the selectedAccount) size, by setting a new quantity
         * @param      {String} positionId Id of position to reduce
         * @param      {String} newAmount the new amount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reducePositionToAmount : function (positionId, newAmount, resolve, reject){
            return tradable.reducePositionToAmountForAccount(tradable.selectedAccountId, positionId, newAmount, resolve, reject);
        },
        /**
         * Reduces the position (on a specific account) size, by setting a new quantity
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to reduce
         * @param      {String} newAmount the new amount
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reducePositionToAmountForAccount : function (accountId, positionId, newAmount, resolve, reject){
            var amountObj = {"amount": newAmount};
            return tradable.makeAccountRequest("PUT", accountId, "positions/"+positionId, amountObj, resolve, reject);
        },
        /**
         * Closes the position (on the selectedAccount) with the given id
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closePosition : function (positionId, resolve, reject){
            return tradable.closePositionForAccount(tradable.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Closes the position (on a specific account) with the given id
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        closePositionForAccount : function (accountId, positionId, resolve, reject){
            return tradable.makeAccountRequest("DELETE", accountId, "positions/"+positionId, null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}/protections
        /**
         * Adds or modifies stoploss AND takeprofit on a position (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {number} takeProfit Take Profit price (Set to null if not wanted)
         * @param      {number} stopLoss Stop Loss price (Set to null if not wanted)
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyProtections : function (positionId, takeProfit, stopLoss, resolve, reject) {
            return tradable.addOrModifyProtectionsForAccount(tradable.selectedAccountId, positionId, takeProfit, stopLoss, resolve, reject);
        },
        /**
         * Adds or modifies stoploss AND takeprofit on a position (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {number} takeProfit Take Profit price (Set to null if not wanted)
         * @param      {number} stopLoss Stop Loss price (Set to null if not wanted)
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyProtectionsForAccount : function (accountId, positionId, takeProfit, stopLoss, resolve, reject) {
            var protection = {};
            if(takeProfit !== null) {
                protection["takeprofit"] = takeProfit;
            }
            if(stopLoss !== null) {
                protection["stoploss"] = stopLoss;
            }
            return tradable.makeAccountRequest("PUT", accountId, "positions/"+positionId+"/protections/", protection, resolve, reject);
        },
        /**
         * Cancel stoploss and takeprofit protections on a position (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelProtections : function (positionId, resolve, reject) {
            return tradable.cancelProtectionsForAccount(tradable.selectedAccountId, positionId, resolve, reject);
        },
        /**
         * Cancel stoploss and takeprofit protections on a position (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelProtectionsForAccount : function (accountId, positionId, resolve, reject) {
            return tradable.makeAccountRequest("DELETE", accountId, "positions/"+positionId+"/protections/", null, resolve, reject);
        },
        //v1/accounts/{accountId}/positions/{positionId}/protections/{sltp}
        /**
         * Adds or modifies the take profit order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyTakeProfit : function (positionId, newPrice, resolve, reject) {
            return tradable.makeProtectionRequest("PUT", positionId, newPrice, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Adds or modifies the take profit order on a position. (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyTakeProfitForAccount : function (accountId, positionId, newPrice, resolve, reject) {
            return tradable.makeProtectionRequestForAccount("PUT", accountId, positionId, newPrice, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Adds or modifies the stop loss order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyStopLoss : function (positionId, newPrice, resolve, reject) {
            return tradable.makeProtectionRequest("PUT", positionId, newPrice, "STOPLOSS", resolve, reject);
        },
        /**
         * Adds or modifies the stop loss order on a position. (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {String} newPrice The new trigger price
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        addOrModifyStopLossForAccount : function (accountId, positionId, newPrice, resolve, reject) {
            return tradable.makeProtectionRequestForAccount("PUT", accountId, positionId, newPrice, "STOPLOSS", resolve, reject);
        },
        /**
         * Cancel the take profit order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelTakeProfit : function (positionId, resolve, reject) {
            return tradable.makeProtectionRequest("DELETE", positionId, 0, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Cancel the take profit order on a position. (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelTakeProfitForAccount : function (accountId, positionId, resolve, reject) {
            return tradable.makeProtectionRequestForAccount("DELETE", accountId, positionId, 0, "TAKEPROFIT", resolve, reject);
        },
        /**
         * Cancel the stop loss order on a position. (on the selectedAccount)
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelStopLoss : function (positionId, resolve, reject) {
            return tradable.makeProtectionRequest("DELETE", positionId, 0, "STOPLOSS", resolve, reject);
        },
        /**
         * Cancel the stop loss order on a position. (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {String} positionId Id of position to close
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        cancelStopLossForAccount : function (accountId, positionId, resolve, reject) {
            return tradable.makeProtectionRequestForAccount("DELETE", accountId, positionId, 0, "STOPLOSS", resolve, reject);
        },
        makeProtectionRequest : function (method, positionId, newPrice, type, resolve, reject) {
            return tradable.makeProtectionRequestForAccount(method, tradable.selectedAccountId, positionId, newPrice, type, resolve, reject);
        },
        makeProtectionRequestForAccount : function (method, accountId, positionId, newPrice, type, resolve, reject) {
            var orderModification = {"price": newPrice};
            if(method === "DELETE") {
                orderModification = null;
            }
            return tradable.makeAccountRequest(method, accountId, "positions/"+positionId+"/protections/"+type, orderModification, resolve, reject);
        },
        //v1/accounts/{accountId}/prices
        /**
         * A list of prices for certain instrument Ids (on the selectedAccount)
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Price_list-callback-end_         
         */
        getPrices : function (instrumentIds, resolve, reject) {
            return tradable.getPricesForAccount(tradable.selectedAccountId, instrumentIds, resolve, reject);
        },
        /**
         * A list of prices for certain instrument Ids (on a specific account)
         * @param      {String} accountId The unique id for the account the request goes to
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         * @example
         * _list-callback-begin_Price_list-callback-end_         
         */
        getPricesForAccount : function (accountId, instrumentIds, resolve, reject) {
            var instrumentIdsObj = {"instrumentIds": instrumentIds};

            if(isFullInstrumentListAvailableForAccount(accountId) || accountId !== tradable.selectedAccount.uniqueId) {
                return tradable.makeAccountRequest("POST", accountId, "prices/", instrumentIdsObj, resolve, reject);
            } else {
                var deferred = new $.Deferred();

                var missingInstrumentIds = findMissingInstrumentIds(instrumentIds);

                var promise;
                if(missingInstrumentIds.length) {
                    promise = tradable.getInstrumentsFromIdsForAccount(accountId, missingInstrumentIds).then(function() {
                        return tradable.makeAccountRequest("POST", accountId, "prices/", instrumentIdsObj);
                    });
                } else {
                    promise = tradable.makeAccountRequest("POST", accountId, "prices/", instrumentIdsObj);
                }

                promise.then(function(data) {
                    deferred.resolve(data);
                }, function(error) {
                    deferred.reject(error);
                });

                return resolveDeferred(deferred, resolve, reject);
            }
        },
        makeCandleRequest : function (method, insIdsArray, resolve, reject, postObject) {
            var postObj = {'instrumentIds': insIdsArray};
            if(method === "getQuotes") {
                postObj = {'symbols': insIdsArray};
            }
            if(postObject) {
                postObj = postObject;
            }
            var ajaxPromise = $.ajax({
                type: "POST",
                crossDomain: true,
                url: "https://candles-api.tradable.com/" + method,
                contentType: "application/json; charset=utf-8",
                data: JSON.stringify(postObj),
                dataType: 'json'
            });

            var d = new $.Deferred();
            ajaxPromise.then(function(data) {
                if(data.dailyClose) {
                    return d.resolve(data.dailyClose);
                } else {
                    return d.resolve(data);
                }
            }, function(jqXHR, message, error) {
                return d.reject(jqXHR, message, error);
            });

            return resolveDeferred(d, resolve, reject);
        },
        /**
         * A list of close prices for the previous day for certain symbols (on a specific account)
         * @param      {Array} instrumentIds Array of instrument Ids for the wanted daily close prices
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        getLastDailyClose : function (instrumentIds, resolve, reject) {
            return tradable.makeCandleRequest("dailyClose", instrumentIds, resolve, reject);
        },
        /**
         * This method will initialize tradable core with the minimum required in order to be able to use the API calls that do not require a selected account. Beware! If you use this method instead of 'enableWithAccessToken', there will not be a selectedAccount and the instruments will not be cached. The on/off listeners will not work either. I.e. you will only be able to use methods that require an 'accountId'
         * @param      {String} access_token    The authentication token granting access to the account
         * @param      {String} end_point   The endpoint to send API requests to
         * @param      {String} expires_in  The expiry date (in seconds) of the access token.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers     
         */
        initializeWithToken : function(access_token, end_point, expires_in, resolve, reject) {
            if(!!access_token && !!end_point) {
                tradable.accessToken = access_token;
                tradable.authEndpoint = end_point;

                if(isLocalStorageSupported()) {
                    localStorage.setItem("accessToken:"+appId, tradable.accessToken);
                    localStorage.setItem("authEndpoint:"+appId, tradable.authEndpoint);

                    if(expires_in) {
                        tradable.expirationTimeUTC = new Date().getTime() + (parseInt(expires_in, 10) * 1000); //expires conversion
                        localStorage.setItem("expirationTimeUTC:"+appId, tradable.expirationTimeUTC);
                    }
                }
            }
            var deferred = tradable.getAccounts();
            return resolveDeferred(deferred, resolve, reject);
        },
        /**
         * Sometimes when the user connects an account from multiple clients at a time, a re-login might be required to continue trading. To solve this issue, you need to listen to the "reLoginRequired" event and call "reLogin()" for the selected account once the user is ready to re-enable trading.
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reLogin : function (resolve, reject) {
            return tradable.reLoginForAccount(tradable.selectedAccount.uniqueId, resolve, reject);
        },
        /**
         * Sometimes when the user connects an account from multiple clients at a time, a re-login might be required to continue trading. To solve this issue, you need to listen to the "reLoginRequired" event and call "reLoginForAccount(accountId)" once the user is ready to re-enable trading.
         * @param      {String} accountId    Account Id that needs to be re-logged in
         * @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
         * @param      {Function} reject(optional) Error callback for the API call
         * @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
         */
        reLoginForAccount : function (accountId, resolve, reject) {
            var empty = {};
            var reloginPromise = tradable.makeAccountRequest("POST", accountId, "reLogin/", empty).then(function () {
                setTradingEnabled(true);
            });

            return resolveDeferred(reloginPromise, resolve, reject);
        },
        enableTrading : function(access_token, end_point, expires_in, set_latest_account){
            var deferred = new $.Deferred();

            console.log("Enabling Trading...");
            notifyNamespaceCallbacks("embedStarting");

            tradable.tradingEnabled = false;
            tradable.lastSnapshot = undefined;

            var accountQty = tradable.accounts.length;
            tradable.initializeWithToken(access_token, end_point, expires_in).then(function() {
                return setSelectedAccountAndNotify(set_latest_account, accountQty);
            }).then(function() {
                deferred.resolve();
            }, function(error) {
                deferred.reject(error);
            });

            return deferred;
        }
    };

    initializeLibrary();

    function initializeLibrary(){
        var success = false;
        var opener = window.opener;
        if(!!opener && window.name === "osBrokerSignUp") {
            window.close();
        } else if(!!opener && window.name === "osLaunch") {
            var hashFragment = window.location.hash;
            if(hashFragment) {
                try {
                    opener.postMessage('replace your location', '*');
                    success = processHashFragment(hashFragment, opener.tradable);
                } catch(err) {
                    success = false;
                }
                if(!success) {
                    success = processHashFragment(hashFragment, tradable);
                }
            }
        } else if(window.location.hash &&
                    window.location.hash.indexOf("access_token") !== -1 &&
                    window.location.hash.indexOf("endpointURL") !== -1 &&
                    window.location.hash.indexOf("expires_in") !== -1) {
            success = processHashFragment(window.location.hash, tradable);
        } else if(tradable.tradingEnabled) {
            validateToken();
            success = true;
        }

        if(!success) {
           console.log('Initiating without authentication...');
           $(document).ready(function() {
               notifyReadyCallbacks();
           });
        }

        function processHashFragment(hashFragment, tradable){
            tradable.tradingEnabled = false;
            if(isLocalStorageSupported()) {
                localStorage.setItem("tradingEnabled:"+appId, false);
            }

            var trToken = getTokenValuesFromHashFragment(hashFragment);

            if(!!trToken.accessToken && !!trToken.endPoint) {
                tradable.enableTrading(trToken.accessToken, trToken.endPoint, trToken.expiresIn);
                if(window.name === "osLaunch") {
                    window.close();
                }
                return true;
            } else {
                return false;
            }
        }
    }

    // Extracts the token values from a url's hash fragment
    function getTokenValuesFromHashFragment(hashFragment) {
        var trToken = {
            'accessToken' : undefined,
            'endPoint' : undefined,
            'expiresIn' : undefined
        };
        var keyValues = hashFragment.replace('#', '').split('&');
        $(keyValues).each(function (index, keyValuePair) {
            var kvPair = keyValuePair.split('=');
            var key = kvPair[0];
            var value = kvPair[1];
            if (key === 'access_token') {
                trToken.accessToken = value;
            } else if (key === 'endpointURL') {
                trToken.endPoint = value;
            } else if (key === 'expires_in') {
                trToken.expiresIn = value;
            }
        });
        return trToken;
    }

    // Initialize tradableConfig object from script attributes or config object
    function initializeTradableConfig() {
        // Initialize tradableConfig object to be backwards compatible with tradableEmbedConfig
        var config = (typeof global.tradableEmbedConfig !== "undefined") ? global.tradableEmbedConfig : global.tradableConfig;

        if(typeof config === "undefined") {
            // Backwards compatibility
            var scriptId = ($("#tradable-embed").length !== 0) ? "#tradable-embed" :
                           ($("#tradable").length !== 0) ? "#tradable" : "#tradable-api";

            config = {
                appId : $(scriptId).attr("data-app-id"),
                appKey : $(scriptId).attr("data-app-key"),
                redirectURI : $(scriptId).attr("data-redirect-uri"),
                customOAuthURL : $(scriptId).attr("data-custom-oauth-url"),
                customOAuthHost : $(scriptId).attr("data-custom-oauth-host")
            };
        }

        return config;
    }

    // Retrieves either the current URL or the specified redirect URL 
    function getRedirectUrl() {
        var redirectUrl = (tradableConfig.redirectURI) ? tradableConfig.redirectURI : location.href;

        return encodeURIComponent(redirectUrl); // URI encode the redirectUrl
    }

    // Forms the correspondent OAuth host and URI according to the config
    function formOAuthEndpoint(redirectUrl) {
        var endpoint = {};
        
        var customOAuthUrl = tradableConfig.customOAuthURL;
        var customOAuthHost = tradableConfig.customOAuthHost;

        var oauthHost = "api.tradable.com/";
        if(appId > 200000) { // Staging app-id
            oauthHost = "api-staging.tradable.com/";
            console.log("Starting in staging mode...");
        }
        if(customOAuthHost) {
            oauthHost = customOAuthHost;
        }

        var defaultOAuthURL = 'https://'+oauthHost+'oauth/authorize?client_id='+appId+'&scope=trade&response_type=token&redirect_uri='+redirectUrl;
        var oauthURL = (!customOAuthUrl) ? defaultOAuthURL : customOAuthUrl;

        endpoint.oauthHost = oauthHost;
        endpoint.oauthURL = oauthURL;

        return endpoint;
    }

    // Initializes the Tradable token values from the storage 
    function getTokenFromStorage() {
        var tokenObj = {};

        tokenObj.token = localStorage.getItem("accessToken:"+appId);
        tokenObj.authEndpoint = localStorage.getItem("authEndpoint:"+appId);
        tokenObj.tradingEnabled = localStorage.getItem("tradingEnabled:"+appId);
        tokenObj.expirationTimeUTC = localStorage.getItem("expirationTimeUTC:"+appId);

        if(tokenObj.tradingEnabled && (!tokenObj.authEndpoint || !tokenObj.token || !tokenObj.expirationTimeUTC)) {
            tokenObj.tradingEnabled = false;
            if(isLocalStorageSupported()) {
                localStorage.setItem("tradingEnabled:"+appId, tokenObj.tradingEnabled);
            }
        }

        return tokenObj;
    }

    function isLocalStorageSupported() {
        var testKey = 'test';
        try {
            localStorage.setItem(testKey, '1');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            return false;
        }
    }

    function popupwindow(url, windowName){
        var wLeft = window.screenLeft ? window.screenLeft : window.screenX;
        var wTop = window.screenTop ? window.screenTop : window.screenY;
        var width = 420;
        var height = 500;
        var left = wLeft + (window.innerWidth / 2) - (width / 2);
        var top = wTop + (window.innerHeight / 2) - (height / 2);
        return window.open(url, windowName, 'toolbar=no, titlebar=no, directories=no, status=no, menubar=no, ' +
            'scrollbars=no, resizable=no, copyhistory=no, width=' + width + ', height=' + height + ', top=' + top + ', left=' + left);
    }

    /*
     * Returns the number of decimal digits in a number
     * @param amount
     * @returns {*}
     */
    function getDecimalQty(amount) {
        if(typeof amount !== "number") {
            return 0;
        }
        var decimalPart = String(amount).replace(",", ".").split(".")[1];
        return (decimalPart) ? decimalPart.length : 0;
    }

    function initializeValuesForCurrentAccount(resolve, reject) {
        var reset = false;
        if(tradable.tradingEnabled) {
            tradable.tradingEnabled = false;
            reset = true;
        }

        resetInstrumentCache();
        return getDefaultInstruments().then(function() {
            console.log('Instruments ready');
            if(reset) {
                tradable.tradingEnabled = true;
                notifyAccountSwitchCallbacks();
            }
            if(!!resolve && typeof resolve === "function") {
                return resolve(tradable.accounts);
            } else {
                return this;
            }
            //return
        }, function(error) {
            if(!!reject && typeof reject === "function") {
                return reject(error);
            } else {
                return this;
            }
        });
    }

     
    // Returns a list of instruments available for the selectedAccount
    // @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
    // @param      {Function} reject(optional) Error callback for the API call
    // @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
    function getInstruments(resolve, reject){
        return getInstrumentsForAccount(tradable.selectedAccountId, resolve, reject);
    }
    // Returns a list of instruments available for a specific accountId
    // @param      {String} uniqueId The unique id for the account the request goes to
    // @param      {Function} resolve(optional) Success callback for the API call, errors don't get called through this callback
    // @param      {Function} reject(optional) Error callback for the API call
    // @return     {Object} If resolve/reject are not specified it returns a Promise for chaining, otherwise it calls the resolve/reject handlers
    function getInstrumentsForAccount(accountId, resolve, reject){
        return tradable.makeAccountRequest("GET", accountId, "instruments/", null, resolve, reject);
    }

    function isFullInstrumentListAvailable() {
        return (tradable.selectedAccount.instrumentRetrieval === "FULL_INSTRUMENT_LIST");
    }
    function isFullInstrumentListAvailableForAccount(accountId) {
        var available = true;
        $(tradable.accounts).each(function(idx, account) {
            if(account.uniqueId === accountId && account.instrumentRetrieval !== "FULL_INSTRUMENT_LIST") {
                available = false;
            }
        });
        return available;
    }
    var idsToRequest = [];
    function getDefaultInstruments() {
        var deferred = new $.Deferred();

        if(isFullInstrumentListAvailable()) {
            getInstruments().then(function(acctInstruments) {
                cacheInstruments(acctInstruments);
                deferred.resolve(tradable.availableInstruments);
            }, function (err) {
                deferred.reject(err);
            });
        } else {
            idsToRequest = [];

            tradable.searchInstruments("EUR").then(function (instrumentResults) {
                gatherForexInstrumentIds(instrumentResults);
                return tradable.searchInstruments("AUD");
            }).then(function (instrumentResults) {
                gatherForexInstrumentIds(instrumentResults);
                return tradable.searchInstruments("USD");
            }).then(function (instrumentResults) {
                gatherForexInstrumentIds(instrumentResults);
                return tradable.getPrices(idsToRequest);
            }).then(function () {
                deferred.resolve(tradable.availableInstruments);
            }, function (error) {
                deferred.reject(error);
            });
        }

        return deferred;
    }
    function gatherForexInstrumentIds(instrumentResults) {
        var results = 0;
        $(instrumentResults).each(function(idx, instrumentResult) {
            if((instrumentResult.symbol.length === 6 || instrumentResult.symbol.length === 7) && results < 16) {
                idsToRequest.push(instrumentResult.instrumentId);
                results++;
            }
        });
    }

    var cachedInstrumentIds = {};
    function resetInstrumentCache() {
        tradable.availableCategories.splice(0, tradable.availableCategories.length);
        tradable.availableInstruments.splice(0, tradable.availableInstruments.length);
        tradable.availableSymbols.splice(0, tradable.availableSymbols.length);
        tradable.availableCurrencies.splice(0, tradable.availableCurrencies.length);
        cachedInstrumentIds = {};
    }
    function isInstrumentCached(instrumentId) {
        return (typeof cachedInstrumentIds[instrumentId] !== "undefined");
    }
    function cacheInstruments(instruments) {
        $(instruments).each(function(index, instrument){
            if(!isInstrumentCached(instrument.instrumentId)) {
                 tradable.availableInstruments.push(instrument);
                 tradable.availableSymbols.push(instrument.symbol);

                 var strippedSymbol = instrument.symbol.replace("/", "");
                 if((instrument.type === "FOREX" || instrument.type === "CFD") && strippedSymbol.length === 6) {
                     var ccy1 = strippedSymbol.toLowerCase().substring(0, 3);
                     var ccy2 = strippedSymbol.toLowerCase().substring(3, 6);
                     cacheCurrency(ccy1);
                     cacheCurrency(ccy2);
                 }

                 if ($.inArray(instrument.type, tradable.availableCategories) === -1){
                     tradable.availableCategories.push(instrument.type);
                 }

                 cachedInstrumentIds[instrument.instrumentId] = true;
            }
        });

        function cacheCurrency(currency) {
            var nonValidCurrencies = ["100", "200", "225", "spx", "h33", "nas", "u30", "e50", "f40", "d30", "e35", "i40", "z30", "s30", "uso", "uko"];
            if ($.inArray(currency, tradable.availableCurrencies) === -1 &&
                $.inArray(currency, nonValidCurrencies) === -1){
               tradable.availableCurrencies.push(currency);
            }
        }
    }

    function findMissingInstrumentIds(instrumentIds) {
        var missingIds = [];
        $(instrumentIds).each(function(idx, instrumentId) {
            if(!isInstrumentCached(instrumentId)) {
                missingIds.push(instrumentId);
            }
        });
        return missingIds;
    }

    function resetUpdates() {
        if(tradable.instrumentKeysForAccountUpdates.length) {
            tradable.instrumentKeysForAccountUpdates.splice(0, tradable.instrumentKeysForAccountUpdates.length);
        }
    }

    function resetExcludedAccounts() {
        tradable.accountIdsToExclude.splice(0, tradable.accountIdsToExclude.length); // Reset excluded accounts
    }

    function excludeAndValidate(reject, err) {
        tradable.excludeCurrentAccount();
        if(tradable.accounts.length > 0) {
            validateToken();
        } else {
            tradable.signOut();
        }
        if(reject) {
            reject(err);
        }
    }

    function validateToken() {
        console.log("Validating token...");
        // Check token validity
        tradable.getAccounts().then(
            function() {
                tradable.enableTrading(tradable.accessToken, tradable.authEndpoint);
            },
            function() {
                setTradingEnabled(false);
            }
        );
    }

    function setSelectedAccountAndNotify(set_latest_account, account_qty) {
        var deferred = new $.Deferred();

        console.log('Accounts initialized');
        var accountId;
        var savedAccId = localStorage.getItem("selectedAccount:"+appId);
        var accIdxToSelect = tradable.accounts.length - 1;
        if(!!set_latest_account && tradable.accounts.length > account_qty) {
            accountId = tradable.accounts[accIdxToSelect].uniqueId;
        } else if(!!savedAccId && !!tradable.accountMap[savedAccId]) {
            accountId = savedAccId;
        } else if(accIdxToSelect >= 0) {
            accountId = tradable.accounts[accIdxToSelect].uniqueId;
        }
        resetUpdates();
        if(accountId) {
            tradable.setSelectedAccount(accountId, function() {
                if(!tradable.tradingEnabled) {
                    setTradingEnabled(true);
                }
                deferred.resolve();
            }, function(error) {
                deferred.reject(error);
            });
        } else {
            tradable.signOut();
            deferred.reject();
        }
        return deferred;
    }

    function setTradingEnabled(value) {
        tradable.tradingEnabled = value;
        if(isLocalStorageSupported()) {
            localStorage.setItem("tradingEnabled:"+appId, tradable.tradingEnabled);
        }
        notifyReadyCallbacks();
    }

    // Notify events

    function notifyReadyCallbacks() {
        $(tradable.readyCallbacks).each(function(index, callback) {
            executeCallback(callback);
        });
        notifyNamespaceCallbacks("embedReady");
        tradable.notifiedCallbacks = true;
    }

    var processingUpdate = false;
    function processAccountUpdate() {
        if(tradable.tradingEnabled && !tradable.initializingAccount && !processingUpdate &&
            (accountUpdatedCallbacks.length > 0 || typeof callbackHolder["accountUpdated"] !== undefined)) {
            processingUpdate = true;
            var instrumentIds = [];
            $(tradable.instrumentKeysForAccountUpdates).each(function(idx, elem) {
                var instrumentId = elem.substring(0, elem.indexOf(":"));
                if($.inArray(instrumentId, instrumentIds) === -1) {
                    instrumentIds.push(instrumentId);
                }
            });
            tradable.getSnapshot(instrumentIds).then(function(account) {
                tradable.lastSnapshot = account;
                return checkInstrumentsToCache(account);
            }).then(function(account) {
                if(tradable.tradingEnabled && !tradable.initializingAccount) {
                    $.each(accountUpdatedCallbacks, function(idx, call) {
                        executeCallback(call, account);
                    });
                    notifyNamespaceCallbacks("accountUpdated", account);
                }
                processingUpdate = false;
            }, function() {
                processingUpdate = false;
            })
        }
    }

    function checkInstrumentsToCache(snapshot) {
        var deferred = new $.Deferred();

        if(isFullInstrumentListAvailable()) {
            deferred.resolve(snapshot);
        } else {
            var missingInstrumentIds = [];
            var addMissing = function(idx, item) {
                if(!isInstrumentCached(item.instrumentId)) {
                    missingInstrumentIds.push(item.instrumentId);
                }
            };
            $(snapshot.positions.open).each(addMissing);
            $(snapshot.orders.pending).each(addMissing);
            if(missingInstrumentIds.length) {
                tradable.getInstrumentsFromIds(missingInstrumentIds).then(function() {
                    deferred.resolve(snapshot);
                });
            } else {
                deferred.resolve(snapshot);
            }
        }

        return deferred;
    }

    function notifyTokenExpired() {
        setTradingEnabled(false);
        $(tokenExpirationCallbacks).each(function(index, callback) {
            executeCallback(callback);
        });
        notifyNamespaceCallbacks("tokenExpired");
    }

    function notifyErrorCallbacks(error) {
        $(errorCallbacks).each(function(index, callback) {
            executeCallback(callback, error);
        });
        notifyNamespaceCallbacks("error", error);
    }

    function notifyAccountSwitchCallbacks() {
        $(accountSwitchCallbacks).each(function(index, callback) {
            executeCallback(callback);
        });
        notifyNamespaceCallbacks("accountSwitch");
    }

    function notifyReloginRequiredCallbacks() {
        setTradingEnabled(false);
        notifyNamespaceCallbacks("reLoginRequired");
    }

    function notifyNamespaceCallbacks(eventName, data) {
        if(tradable.isEventValid(eventName)) {
            if(typeof callbackHolder[eventName] !== undefined) {
                for(var namespace in callbackHolder[eventName]) {
                    if(callbackHolder[eventName].hasOwnProperty(namespace)) {
                        executeCallback(callbackHolder[eventName][namespace], data);
                    }
                }
            }
        } else {
            console.error("Careful, can't notify '" + eventName + "', it's an invalid event name");
        }
    }

    function executeCallback(callback, data) {
        try {
            if(data) {
                return callback(data);
            }
            callback();
        } catch(err) {
            console.error(err);
        }
    }

    /*
     * Notifies about new positions, new orders, closed positions and cancelled orders
     */
    var initializedAccountId;
    var notifiedExecutions;
    function findAndNotifyExecutions(snapshot) {
        if(tradable.selectedAccount.uniqueId !== initializedAccountId) {
            resetNotifiedExecutions();
            initializedAccountId = tradable.selectedAccount.uniqueId;
        }
        if(!notifiedExecutions) {
            notifiedExecutions = new Execution();
            notifiedExecutions.orders = collectNewExecutions(snapshot.orders.pending, "orders", true);
            notifiedExecutions.cancelledOrders = collectNewExecutions(snapshot.orders.recentlyCancelled, "cancelledOrders", true);
            notifiedExecutions.positions = collectNewExecutions(snapshot.positions.open, "positions", true);
            notifiedExecutions.closedPositions = collectNewExecutions(snapshot.positions.recentlyClosed, "closedPositions", true);
            }
        var exec = new Execution(
            collectNewExecutions(snapshot.orders.pending, "orders"),
            collectNewExecutions(snapshot.orders.recentlyCancelled, "cancelledOrders"),
            collectNewExecutions(snapshot.positions.open, "positions"),
            collectNewExecutions(snapshot.positions.recentlyClosed, "closedPositions")
        );

        if(exec.getTotal() > 0) {
            notifyNamespaceCallbacks("execution", exec);
        }

        return exec;
    }

    function resetNotifiedExecutions() {
        notifiedExecutions = undefined;
        }

    function Execution(o, co, p, cp) {
        this.orders = (o) ? o : [];
        this.cancelledOrders = (co) ? co : [];
        this.positions = (p) ? p : [];
        this.closedPositions = (cp) ? cp : [];
        this.getTotal = function() {
            return this.orders.length + this.cancelledOrders.length +
                this.positions.length + this.closedPositions.length;
        }
    }

    function collectNewExecutions(executions, notifiedHolder, needToCollectId) {
        var newExecutions = [];
        for (var i = 0; i < executions.length; i++) {
            var item = executions[i];

            /*
             * We use positionId+amount as id and clear previous Ids that contain the positionId
             * when a new "positionId+amount" key is found
             */
            var itemId = getItemId(item);
            if(needToClearPositions(notifiedHolder, item.id, itemId)) {
                notifiedExecutions.positions = clearPositions(item.id, notifiedExecutions.positions);
            }

            if((!item.type || item.type !== "MARKET") && $.inArray(itemId, notifiedExecutions[notifiedHolder]) < 0) {
                newExecutions.push((needToCollectId) ? itemId : item);
                notifiedExecutions[notifiedHolder].push(itemId);
            }
        }
        return newExecutions;
    }

    function needToClearPositions(notifiedHolder, positionIdFractionToRemove, positionId) {
        var needToRemove = false;
        if((notifiedHolder === "positions" || notifiedHolder === "closedPositions") &&
                $.inArray(positionId, notifiedExecutions[notifiedHolder]) < 0) {
            $(notifiedExecutions.positions).each(function(idx, val) {
                if(val.indexOf(positionIdFractionToRemove) > -1) {
                    needToRemove = true;
                }
            });
        }
        return needToRemove;
    }

    function clearPositions(positionIdFractionToRemove, notified) {
        return $.grep(notified, function(n) {
            return n.indexOf(positionIdFractionToRemove) < 0;
        });
    }

    /*
     * The position id for open positions is 'id+side+amount' / For closed positions 'id+lastModified'
     * For orders it's just the order id
     */
    function getItemId(item) {
        return item.id + ((!item.type) ? ((item.amount !== 0) ? (item.side + item.amount) : item.lastModified) : "");
    }

    function resolveDeferred(deferred, resolve, reject) {
        if(!!resolve || !!reject){
            return deferred.then(function(data){
                if(typeof resolve === "function")
                    return resolve(data);
            }, function(jqXHR, message, error){
                if(typeof reject === "function")
                    return reject(jqXHR, message, error);
            });
        } else {
            return deferred.promise();
        }
    }

    function internalSignOut() {
        var deferred = new $.Deferred();

        if(tradable.selectedAccount.brokerId < 0 && tradable.allAccounts.length === 1) {
            deferred.resolve();
            return deferred;
        }

        var signOutData = {tokenValue: tradable.accessToken};
        tradable.makeOsRequest("internal", "POST", "", "signOut", signOutData).then(function() {
            deferred.resolve();
        }, function() {
            deferred.reject();
        });

        return deferred;
    }

    function hashCode(str){
        var i;
        var char;
        var hash = 0;
        if (str.length === 0) return hash;
        for (i = 0; i < str.length; i++) {
            char = str.charCodeAt(i);
            hash = ((hash<<5)-hash)+char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash;
    }

    function ie() {
        return ((navigator.userAgent.indexOf("MSIE") !== -1) || (/rv:11.0/i.test(navigator.userAgent)));
    }

    // Checks if an object has no properties
    function isEmpty(map) {
        for(var key in map) {
            if (map.hasOwnProperty(key)) {
                return false;
            }
        }
        return true;
    }

    // Global
    global.trEmbJQ = trEmbJQ;
    global.tradable = tradable;
    global.tradableEmbed = tradable;

    if (typeof define === "function" && define && define.amd) {
        // AMD / RequireJS
        define("tradable-core", [], tradable);
    } else if (typeof require === "function" && typeof module === "object" && module && module.exports) {
        // Node / CommonJS
        module.exports = tradable;
    }

}(jsGlobalObject, trEmbJQ));

// Checks if version 'a' if greater or equal version 'b'. Versions need to have format x.y.z
function isGreaterOrEqualMinVersion(a, b) {
    this.toNum = function(n) {
        return parseInt(n, 10);
    };

    this.highest = function(a, b) {
        var aa = a.split('.').map(this.toNum); //call .map to convert string to integer
        var bb = b.split('.').map(this.toNum);

        for (var i = 0; i < aa.length; i++) {
            if (aa[i] === bb[i])
                continue;

            if (aa[i] > bb[i])
                return a;
            else
                return b;
        }

        if (bb.length > aa.length)
            return b;
    };
    
    return !!(typeof highest(a, b) === "undefined" || highest(a, b) !== b);
}