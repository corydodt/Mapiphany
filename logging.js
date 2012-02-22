//
// Utility logging functions designed not to interfere when console is
// unavailable
//

"use strict";

console.dir(["logging.js"]);


// wrap console.log so we don't error out when it's missing
window.dir = function dir(o) {
    try {
        return console.dir(o);
    } catch (e) {
    }
}

// wrap console.log so we don't error out when it's missing
window.log = function log(m) {
    try {
        return console.log(m);
    } catch (e) {
    }
}

// use console.log to display error message and traceback
window.err = function err(e) {
    try {
        console.trace();
    } catch (e) {
    }
    log(e);
}

// use console.log and throw an exception if expr is not true
window.assert = function assert(expr, m) {
    if (! expr) {
        log("Assert Failed: " + m);
        throw m;
    }
}

