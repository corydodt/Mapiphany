//
// Utility logging functions designed not to interfere when console is
// unavailable
//

$.require('stacktrace.js');

// wrap console.dir so we don't error out when it's missing
function dir(o) {
    try {
        return console.dir(o);
    } catch (e) {
    }
}

// wrap console.log so we don't error out when it's missing
function log(m) {
    try {
        return console.log(m);
    } catch (e) {
    }
}

// use console.log to display error message and traceback
function err(e) {
    var frames = printStackTrace(e);
    for (n=0; n<frames.length; n++) {
        log(frames[n]);
    }
    log(e);
}


