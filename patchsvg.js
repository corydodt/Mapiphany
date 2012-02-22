//
// jquery.svg.js does an evil thing and pops up a (mostly useless) alert when
// an error occurs during loading of svg.  patch that with a function that
// logs the stack, along with the error.
//

"use strict";

console.log(["patchsvg.js"]);

loadScript('static/support/jquery-svg/jquery.svg.js');

loadScript('logging.js');

var PROP_NAME = 'svgwrapper';


function _afterLoad(container, svg, settings) {
    var settings = settings || this._settings[container.id];
    this._settings[container ? container.id : ''] = null;
    var wrapper = new this._wrapperClass(svg, container);
    $.data(container || svg, PROP_NAME, wrapper);
    try {
        if (settings.loadURL) { // Load URL
            wrapper.load(settings.loadURL, settings);
        }
        if (settings.settings) { // Additional settings
            wrapper.configure(settings.settings);
        }
        if (settings.onLoad && !settings.loadURL) { // Onload callback
            settings.onLoad.apply(container || svg, [wrapper]);
        }
    }
    catch (e) {
        err(e);
    }
} 

$.extend($.svg.__proto__, { _afterLoad: _afterLoad });

