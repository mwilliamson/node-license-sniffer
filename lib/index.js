var path = require("path");
var fs = require("fs");

var natural = require("natural");
var _ = require("underscore");
var q = require("q");
var markdown = require("markdown");

var promises = require("./promises");
var files = require("./files");


exports.sniff = promises.toCallbackStyle(sniff);
exports.sniffRecursive = promises.toCallbackStyle(sniffRecursive);
exports.sniffPackageJson = promises.toCallbackStyle(sniffPackageJson);


function sniffRecursive(initialModulePath, options) {
    var remainingModules = [{
        modulePath: initialModulePath,
        parentDependencyChain: []
    }];
    var result = [];
    return processNext();
    
    function processNext() {
        if (remainingModules.length > 0) {
            var module = remainingModules.pop();
            var modulePath = module.modulePath;
            return q.all([
                    sniff(modulePath, options),
                    readPackageJson(modulePath)
                ])
                .spread(function(license, packageJson) {
                    license = Object.create(license);
                    // HACK for a bug in duck
                    license.names = license.names;
                    license.modulePath = modulePath;
                    license.dependencyChain = module.parentDependencyChain
                        .concat([packageJson.name + "@" + packageJson.version]);
                    result.push(license);
                    return license.dependencyChain;
                })
                .then(function(dependencyChain) {
                    return [
                        files.readdirIfExists(path.join(modulePath, "node_modules")),
                        dependencyChain
                    ];
                })
                .spread(function(moduleNames, dependencyChain) {
                    moduleNames
                        .filter(function(moduleName) {
                            return moduleName !== ".bin";
                        })
                        .forEach(function(moduleName) {
                            remainingModules.push({
                                modulePath: path.join(modulePath, "node_modules", moduleName),
                                parentDependencyChain: dependencyChain
                            });
                        });
                })
                .then(processNext);
        } else {
            return result;
        }
    }
}


function sniff(modulePath, options) {
    options = _.defaults(options || {}, {generateBody: true});
    return promises.first(sniffers, function(sniffer) {
        return sniffer(modulePath, options).then(function(license) {
            if (license.isKnown()) {
                return license;
            } else {
                return null;
            }
        });
    }, LicenseResult.unknown);
}

var sniffers = [
    sniffModuleByPackageJson
];

var licenseExtractors = [
    extractLicenseFile,
    extractLicenseFromReadme
];

_.forEach(licenseExtractors, function(extractor) {
    sniffers.push(createSnifferFromExtractor(extractor));
});

function extractLicenseText(modulePath) {
    return promises.first(licenseExtractors, function(extractor) {
        return extractor(modulePath);
    });
}

function createSnifferFromExtractor(extractor) {
    return function(modulePath) {
        return extractor(modulePath)
            .then(function(licenseText) {
                if (licenseText) {
                    return detectLicenseFromText(licenseText);
                } else {
                    return LicenseResult.unknown;
                }
            });
    };
}

function sniffModuleByPackageJson(modulePath, options) {
    var packageJsonPath = path.join(modulePath, "package.json");
    return files.readFile(packageJsonPath, "utf8")
        .then(function(packageJsonContents) {
            var packageJson = JSON.parse(packageJsonContents);
            return [packageJson, sniffPackageJson(packageJson)];
        })
        .spread(function(packageJson, license) {
            return extractLicenseText(modulePath)
                .then(function(licenseText) {
                    if (!licenseText && license.isKnown() && options.generateBody) {
                        licenseText = generateLicenseText(license.names[0], packageJson.name);
                    }
                    var licenseWithText = Object.create(license);
                    licenseWithText.text = licenseText;
                    return licenseWithText;
                });
        });
}


function readPackageJson(modulePath) {
    var packageJsonPath = path.join(modulePath, "package.json");
    return files.readFile(packageJsonPath, "utf8")
        .then(JSON.parse);
}


function sniffPackageJson(packageJson) {
    if (typeof packageJson === "string") {
        try {
            packageJson = JSON.parse(packageJson);
        } catch (err) {
            return q.reject(err);
        }
    }
    var licenses = readLicenseField(packageJson.license || packageJson.licenses);
    if (licenses) {
        return new LicenseResult(licenses);
    } else {
        return LicenseResult.unknown;
    }
}

function readLicenseField(field) {
    if (!field) {
        return;
    }
    if (_.isString(field)) {
        return [field];
    } else if (_.isString(field.type)) {
        return [field.type];
    } else if (_.isArray(field)) {
        return _.flatten(_.map(field, readLicenseField), true);
    }
}

function extractLicenseFile(modulePath) {
    return readLicenseFileInModule(modulePath)
}

function readLicenseFileInModule(modulePath) {
    var licenseFilenames = ["LICENSE", "UNLICENSE", "LICENSE.txt", "UNLICENSE.txt"];
    return readFirstFile(modulePath, licenseFilenames);
}

function readFirstFile(dirPath, filenames) {
    return promises.first(filenames, function(filename) {
        var filePath = path.join(dirPath, filename);
        return files.exists(filePath)
            .then(function(exists) {
                if (exists) {
                    return files.readFile(filePath, "utf8");
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
        var aliases = license.aliases || [];
        aliases.splice(0, 0, license.name);
        licenseTexts.push({
            name: license.name,
            text: fs.readFileSync(licensePath, "utf8"),
            aliases: aliases
        });
    });
})();


function generateLicenseText(licenseName, copyrightHolders) {
    var license = _.find(licenseTexts, function(license) {
        return license.aliases.indexOf(licenseName) !== -1;
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


function extractLicenseFromReadme(modulePath) {
    return files.readdirIfExists(modulePath)
        .then(function(filenames) {
            return _.find(filenames, function(filename) {
                return /^readme\.md$/i.exec(filename);
            });
        })
        .then(function(filename) {
            if (!filename) {
                return null;
            }
    
            var readmePath = path.join(modulePath, filename);
            return files.exists(readmePath)
                .then(function(exists) {
                    if (exists) {
                        return files.readFile(readmePath, "utf8")
                            .then(extractReadmeContents);
                    } else {
                        return null;
                    }
                });
        });
}


function extractReadmeContents(contents) {
    return findTextAfterHeader(contents, /^\s*licen(?:s|c)e\s*$/i);
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


function LicenseResult(names, text) {
    this.names = names;
    this.text = text;
}

LicenseResult.prototype.isKnown = function() {
    return this.names.length > 0;
};

LicenseResult.prototype.describeLicense = function() {
    if (this.names.length > 0) {
        return this.names.join(", ");
    } else {
        return "Unknown license";
    }
};

LicenseResult.unknown = new LicenseResult([]);
