////////////////////////////////////////////////////////////
// thing.js
////////////////////////////////////////////////////////////
"use strict";

load_scripts(['basething.js'], function () {

window.Thing = BaseThing.extend({
    constructor: function () { 
        console.log("Thing goin' on here" + this);
    }
});

var thing = new Thing();
thing.countList();

});
