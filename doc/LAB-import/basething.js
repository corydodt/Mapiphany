////////////////////////////////////////////////////////////
// basething.js
////////////////////////////////////////////////////////////
"use strict";

load_scripts(['static/support/base.js'], function () {

window.BaseThing = Base.extend({
    countList: function method() {
        console.log(document.getElementsByTagName('li').length);
    }
});

});
