//
// Simple command-based undo.  Use:
//
/*
var MyObject = Base.extend({
  do_frobnicate: function (param1, param2) {
      this.param1 = param1;
      this.param2 = param2;
  },
});
var obj = new MyObject();

history = new UndoHistory(obj);
obj.param1 = 'old1';
obj.param2 = 'old2';
history.do('frobnicate', ['NEW1', 'NEW1'], [obj.param1, obj.param2]);
history.undo(); // return to initial state  - old1/old1
history.redo(); // once again frobnicate  - NEW1/NEW1

// obj.history.history is the stack of previous, undo-able commands

// obj.history.future is the stack of commands that can be "redone"
//     after a previous undo has occurred.

history.undo();
                 // history.history == [['old1', 'old1']]
                 // history.future == [['NEW1', 'NEW1']]
history.undo();
                 // history.history == []
                 // history.future == [['old1', 'old1'], ['NEW1', 'NEW1']]

// When a new command is added to the undo stack, any history that follows it
// is discarded and redo has no effect.

history.do('frobnicate', ['New2', 'New2'], [null, null]);
                 // history.history == [[null, null]]
                 // history.future == []
history.redo();   // Nothing Happens.
*/
//

"use strict";

console.log(["undo.js"]);

loadScript('static/support/base.js');

// implement command-based undo, managing the actions that can be applied to
// the object
window.UndoHistory = Base.extend({
    constructor: function (managedObject) {
        this.managedObject = managedObject;
        this.history = [];
        this.future = []; // for redo, remember commands that were undone
    },

    // TODO - isDirty. Not as simple as checking history.length, must take
    // into account where the current map state is wrt future and history.

    do: function (cmd, args, previous) { // apply an action to the managedObject and remember it
        this.managedObject['do_' + cmd].apply(this.managedObject, args);
        this.history.push([cmd, args, previous]);
        this.future = [];
    },

    undo: function () { // un-apply whatever the last action was
        if (this.history.length == 0) {
            return;
        }
        var last = this.history.pop();
        this.managedObject['do_' + last[0]].apply(this.managedObject, last[2]);
        this.future.push(last);
    },

    redo: function () { // distinguished from "do" because it doesn't clear the "future" list
        if (this.future.length == 0) {
            return;
        }
        var future = this.future.pop();
        this.managedObject['do_' + future[0]].apply(this.managedObject, future[1]);
        this.history.push(future);
    }
});

