// Catalog that tracks all the global tilesets
//

"use strict";

console.log(["tilesets.js"]);


loadScript('static/support/base.js');

loadScript('util.js');

var CATEGORY_ORDER = ['Tools', 'Flat Land', 'Forests', 'Mountains and Hills', 'Arid Land', 'Water', 'Settlement', 'Symbol', 'Hex Background'];

var TOOLS_CATEGORY = {'Tools': 
    ['Blank_FG', 'Blank_BG', 'Blank_Both']
};

var TOOLS = {
    'Blank_Both': {
        categories: "Tools",
        iconfilename: "blankboth.png",
        set: "."
    },
    'Blank_BG': {
        categories: "Tools",
        iconfilename: "blankbg.png",
        set: "."
    },
    'Blank_FG': {
        categories: "Tools",
        iconfilename: "blankfg.png",
        set: "."
    },
    'UNKNOWN': {
        categories: "Tools",
        iconfilename: "unknown.png",
        set: ".",
        scalefactor: 1.0
    }
};


window.TilesetCatalog = Base.extend({
    constructor: function () {
        this._catalog = {};
        this._categoryCache = {};
    },

    get: function (name) { // the tileset that goes by this name
        return this._catalog[name];
    },

    getCategories: function (name) { // generate the grouped categories by parsing the tiles in this tileset
        if (this._categoryCache[name] !== undefined) {
            return this._categoryCache[name];
        }
        var cats = {}, ts, _thisCats;
        ts = this.get(name);
        for (var tileName in ts) {
            if (tileName == '__default__') {
                continue;
            }
            if (ts.hasOwnProperty(tileName)) {
                _thisCats = ts[tileName].categories.split(':');
                $.each(_thisCats, function () {
                    var cat = this;
                    if (cats[cat] === undefined) {
                        cats[cat] = [];
                    }
                    cats[cat].push(tileName);
                });
            }
        }
        $.each(cats, function () {
            this.sort();
        });
        this._categoryCache[name] = cats;
        return cats;
    },

    getNames: function () { // names of the tilesets in this catalog
        return sortedKeys(this._catalog);
    }
}, { // classmethods

    register: function (name, description, tileset) { // put a tileset into the catalog
        if (!window.gTilesetCatalog) {
            window.gTilesetCatalog = new TilesetCatalog();
        }
        var _catalog = window.gTilesetCatalog._catalog;

        _catalog[name] = tileset;
        $.extend(tileset, {__default__: {description: description}});
        $.extend(tileset, TOOLS);
        var categories = window.gTilesetCatalog.getCategories(name);
        $.extend(categories, TOOLS_CATEGORY);
        return _catalog;
    }

});


