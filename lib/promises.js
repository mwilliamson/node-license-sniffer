var q = require("q");


exports.first = first;
exports.toCallbackStyle = toCallbackStyle;
exports.promisify = q.denodeify;
exports.reject = q.reject;
exports.defer = q.defer;


function first(array, func, defaultValue) {
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
            return q.when(defaultValue);
        }
    }
}


function toCallbackStyle(func) {
    return function() {
        var callback = arguments[arguments.length - 1];
        var result = func.apply(this, Array.prototype.slice.call(arguments, 0, arguments.length - 1));
        q.when(
            result,
            function(value) {
                callback(null, value);
            },
            callback
        ).done();
    };
}
