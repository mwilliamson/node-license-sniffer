var path = require("path");
var fs = require("fs");

var natural = require("natural");
var _ = require("underscore");
var q = require("q");


exports.sniff = toCallbackStyle(sniff);
exports.sniffRecursive = toCallbackStyle(sniffRecursive);
exports.sniffPackageJson = toCallbackStyle(sniffPackageJson);


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


function sniffRecursive(initialModulePath) {
    var remainingModulePaths = [initialModulePath];
    var result = [];
    return processNext();
    
    function processNext() {
        if (remainingModulePaths.length > 0) {
            var modulePath = remainingModulePaths.pop();
            return sniff(modulePath)
                .then(function(license) {
                    result.push({
                        modulePath: modulePath,
                        names: license.names
                    });
                })
                .then(function() {
                    return readdirIfExists(path.join(modulePath, "node_modules"));
                })
                .then(function(moduleNames) {
                    moduleNames.forEach(function(moduleName) {
                        remainingModulePaths.push(path.join(modulePath, "node_modules", moduleName));
                    });
                })
                .then(processNext);
        } else {
            return result;
        }
    }
}


function readdirIfExists(dirPath) {
    return q.nfcall(fs.readdir, dirPath)
        .fail(function(err) {
            if (err.code === "ENOENT") {
                return [];
            } else {
                return q.reject(err);
            }
        });
}


function sniff(projectPath) {
    var packageJsonPath = path.join(projectPath, "package.json");
    return q.nfcall(fs.readFile, packageJsonPath, "utf8")
        .then(sniffPackageJson)
        .then(function(license) {
            if (license.names.length) {
                return license;
            } else {
                return sniffLicenseFile(projectPath);
            }
        });
}

function sniffPackageJson(packageJson) {
    if (typeof packageJson === "string") {
        try {
            packageJson = JSON.parse(packageJson);
        } catch (err) {
            return q.reject(err);
        }
    }
    if (packageJson.license) {
        return {names: [packageJson.license]};
    } else if (packageJson.licenses) {
        var licenseNames = packageJson.licenses.map(function(license) {
            return license.type;
        });
        
        return {names: licenseNames};
    } else {
        return {names: []};
    }
}

function sniffLicenseFile(modulePath) {
    return q.nfcall(sniffFile, path.join(modulePath, "LICENSE"))
        .then(function(name) {
            if (name) {
                return name;
            } else {
                return q.nfcall(sniffFile, path.join(modulePath, "UNLICENSE"));
            }
        })
        .then(function(name) {
            var names = name ? [name] : [];
            return {
                names: names
            };
        });
}

function sniffFile(filePath, callback) {
    fs.exists(filePath, function(exists) {
        if (exists) {
            fs.readFile(filePath, "utf8", function(err, licenseText) {
                if (err) {
                    callback(err);
                } else {
                    var license = detectLicenseFromText(licenseText);
                    callback(null, license);
                }
            });
        } else {
            callback(null, null);
        }
    });
}

var licenseTexts = [];
(function() {
    var licenseDir = path.join(__dirname, "../licenses");
    var licensesJson = JSON.parse(fs.readFileSync(path.join(licenseDir, "licenses.json"),"utf8"));
    
    licensesJson.forEach(function(license) {
        var licensePath = path.join(licenseDir, license.path);
        licenseTexts.push({
            name: license.name,
            text: fs.readFileSync(licensePath, "utf8")
        });
    });
})();

function detectLicenseFromText(text) {
    var distances = licenseTexts.map(function(license) {
        return {
            distance: natural.LevenshteinDistance(license.text, text) / Math.max(license.text.length, text.length),
            license: license
        };
    });
    var closest = _.min(distances, function(distance) {
        return distance.distance;
    });
    if (closest.distance < 0.2) {
        return closest.license.name;
    } else {
        return null;
    }
}
