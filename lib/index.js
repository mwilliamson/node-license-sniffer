var path = require("path");
var fs = require("fs");

var natural = require("natural");
var _ = require("underscore");
var q = require("q");
var markdown = require("markdown");

var promises = require("./promises");


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
                    moduleNames
                        .filter(function(moduleName) {
                            return moduleName !== ".bin";
                        })
                        .forEach(function(moduleName) {
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


function sniff(modulePath) {
    return promises.first(sniffers, function(sniffer) {
        return sniffer(modulePath).then(function(license) {
            if (license.isKnown()) {
                return license;
            } else {
                return null;
            }
        });
    }, LicenseResult.unknown);
}

var sniffers = [
    sniffModuleByPackageJson,
    sniffLicenseFile,
    sniffModuleReadme
];

function sniffModuleByPackageJson(modulePath) {
    var packageJsonPath = path.join(modulePath, "package.json");
    return q.nfcall(fs.readFile, packageJsonPath, "utf8")
        .then(function(packageJsonContents) {
            var packageJson = JSON.parse(packageJsonContents);
            return q.all([packageJson, sniffPackageJson(packageJson)]);
        })
        .spread(function(packageJson, license) {
            return readLicenseFileInModule(modulePath)
                .then(function(licenseText) {
                    if (!licenseText && license.isKnown()) {
                        licenseText = generateLicenseText(license.names[0], packageJson.name);
                    }
                    var licenseWithText = Object.create(license);
                    licenseWithText.text = licenseText;
                    return licenseWithText;
                });
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
        return new LicenseResult([packageJson.license]);
    } else if (packageJson.licenses) {
        var licenseNames = packageJson.licenses.map(function(license) {
            return license.type;
        });
        
        return new LicenseResult(licenseNames);
    } else {
        return LicenseResult.unknown;
    }
}

function sniffLicenseFile(modulePath) {
    return readLicenseFileInModule(modulePath)
        .then(function(licenseText) {
            if (licenseText) {
                return detectLicenseFromText(licenseText);
            } else {
                return LicenseResult.unknown;
            }
        });
}

function readLicenseFileInModule(modulePath) {
    var licenseFilenames = ["LICENSE", "UNLICENSE", "LICENSE.txt", "UNLICENSE.txt"];
    return readFirstFile(modulePath, licenseFilenames);
}

function readFirstFile(dirPath, filenames) {
    return promises.first(filenames, function(filename) {
        var filePath = path.join(dirPath, filename);
        return fileExists(filePath)
            .then(function(exists) {
                if (exists) {
                    return q.nfcall(fs.readFile, filePath, "utf8");
                } else {
                    return null;
                }
            });
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


function generateLicenseText(licenseName, copyrightHolders) {
    var license = _.find(licenseTexts, function(license) {
        return license.name === licenseName;
    });
    if (license) {
        return license.text
            .replace("<year>", new Date().getFullYear())
            .replace("<copyright holders>", copyrightHolders);
    } else {
        return null;
    }
}


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
        return new LicenseResult([closest.license.name], text);
    } else {
        return LicenseResult.unknown;
    }
}


function sniffModuleReadme(modulePath) {
    return readdirIfExists(modulePath)
        .then(function(filenames) {
            return _.find(filenames, function(filename) {
                return /^readme\.md$/i.exec(filename);
            });
        })
        .then(function(filename) {
            if (!filename) {
                return LicenseResult.unknown;
            }
    
            var readmePath = path.join(modulePath, filename);
            return fileExists(readmePath)
                .then(function(exists) {
                    if (exists) {
                        return q.nfcall(fs.readFile, readmePath, "utf8")
                            .then(sniffReadmeContents);
                    } else {
                        return LicenseResult.unknown;
                    }
                });
        });
}


function sniffReadmeContents(contents) {
    var licenseText = findTextAfterHeader(contents, /^\s*licen(?:s|c)e\s*$/i);
    return detectLicenseFromText(licenseText);
}

function findTextAfterHeader(contents, headerRegex) {
    var elements = markdown.markdown.parse(contents);
    
    for (var i = 0; i < elements.length && (elements[i][0] !== "header" || !headerRegex.exec(elements[i][2])); i++) {
    }
    i++
    var text = [];
    for (; i < elements.length && elements[i][0] !== "header"; i++) {
        text.push(elements[i][1]);
    }
    return text.join("\n\n");
}


function fileExists(filePath) {
    var deferred = q.defer();
    fs.exists(filePath, function(exists) {
        deferred.resolve(exists);
    });
    return deferred.promise;
}


function LicenseResult(names, text) {
    this.names = names;
    this.text = text;
}

LicenseResult.prototype.isKnown = function() {
    return this.names.length > 0;
};

LicenseResult.prototype.toString = function() {
    if (this.names.length > 0) {
        return this.names.join(", ");
    } else {
        return "Unknown license";
    }
};

LicenseResult.unknown = new LicenseResult([]);
