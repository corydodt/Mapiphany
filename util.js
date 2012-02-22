// util.js
//
// utility functions for mapiphany
//
console.log(["util.js"]);
window.sortObject = function sortObject(obj, order) { // return an array of the key/value pairs in obj, sorted by key
    // if 'order' is given, it is an array that specifies the order by names
    // of keys, instead of using the natural sort order
    var arr = [], loop = obj;
    if (order !== undefined) {
        loop = order;
    }
    $.each(loop, function (item) {
        if (order) {
            item = loop[item];
        }
        if (obj.hasOwnProperty(item)) {
            arr.push([item, obj[item]]);
        }
    });
    if (order === undefined) {
        arr.sort();
    }
    return arr;
};


window.sortedKeys = function sortedKeys(obj) { // all the keys in object in sorted order
    var arr = [], loop = obj;
    $.each(loop, function (item) {
        if (obj.hasOwnProperty(item)) {
            arr.push(item);
        }
    });
    arr.sort();
    return arr;
}
