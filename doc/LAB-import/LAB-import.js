(function(){
   var q = [], q_idx = 0;
   function next_in_queue() {
      if (q_idx < q.length) {
         if (typeof q[q_idx] == "function") { // a callback found in the queue, so execute it
            q[q_idx++]();
            next_in_queue();
         }
         else {
            $LAB.script(q[q_idx++]).wait(next_in_queue);
         }
      }
   }
   window.import_scripts = function(scripts,cb) {
      var auto_start_queue = (q_idx >= q.length);
      var splice_args = [].slice.call(scripts); // copy the passed in array of scripts
      splice_args.unshift(q_idx,0); // put the first two arguments to `splice()` onto the front of the array
      if (cb) splice_args.push(cb); // put the callback function, if any, on the end of the set of entries to push into the queue
      [].splice.apply(q, splice_args); // send the arguments to `splice()`
      if (auto_start_queue) next_in_queue();
   };
})();
