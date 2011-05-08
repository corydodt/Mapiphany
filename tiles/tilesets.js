$.require('base.js');

$.require('util.js');


var TilesetCatalog = Base.extend({
    constructor: function () {
        this._catalog = {};
    },

    register: function (name, tileset) {
        this._catalog[name] = tileset;
        return this;
    },

    get: function (name) {
        return this._catalog[name];
    },

    getNames: function () {
        return sortedKeys(this._catalog);
    }
});


gTilesetCatalog = new TilesetCatalog();
