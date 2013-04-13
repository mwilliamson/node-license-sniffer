var q = require("q");


exports.first = first;


function first(array, func) {
    var index = 0;
    
    return tryNext();
    
    function tryNext() {
        if (index < array.length) {
            return func(array[index])
                .then(function(value) {
                    if (value) {
                        return value;
                    } else {
                        index++;
                        return tryNext();
                    }
                });
        } else {
            return q.when(null);
        }
    }
}
