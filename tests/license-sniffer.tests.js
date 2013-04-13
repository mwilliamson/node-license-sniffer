var assert = require("assert");
var path = require("path");
var fs = require("fs");

var mkdirp = require("mkdirp");
var temp = require("temp");

var licenseSniffer = require("../");


describe("license-sniffer.sniff", function() {
    this.timeout(5000);
    
    it("detects itself as BSD", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("includes license text from LICENSE if present", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.text, fs.readFileSync(path.join(__dirname, "../LICENSE"), "utf8"));
            done();
        });
    });
    
    it("errors if package.json doesn't exist", function(done) {
        licenseSniffer.sniff(__dirname, function(err, license) {
            assert.ok(err);
            done();
        });
    });
    
    it("detects BSD license using LICENSE file if present", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var bsdLicenseText = licenseText("bsd-2-clause");
            fs.writeFileSync(path.join(moduleDirPath, "LICENSE"), bsdLicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["BSD 2-Clause"]);
                done();
            }); 
        });
    });
    
    it("detects MIT license using LICENSE file if present", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var mitLicenseText = licenseText("mit");
            fs.writeFileSync(path.join(moduleDirPath, "LICENSE"), mitLicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            }); 
        });
    });
    
    it("detects unlicense using UNLICENSE file if present", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var unlicenseText = licenseText("unlicense");
            fs.writeFile(path.join(moduleDirPath, "UNLICENSE"), unlicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["Public domain"]);
                done();
            }); 
        });
    });
    
    it("detects no license if LICENSE is not similar to any known license", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFile(path.join(moduleDirPath, "LICENSE"), "Been Listening");
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, []);
                done();
            });
        });
    });
    
    it("detects license text if included in README.md", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFile(path.join(moduleDirPath, "README.md"), "## License\n\n" + licenseText("mit"));
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            });
        });
    });
    
    it("only considers text in README.md following 'License' header", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var readmeJunk = new Array(1000).join("rabbit ");
            
            var readmeContents = "license\n\n## Introduction\n\n" + readmeJunk + "\n\n## License\n\n" + licenseText("mit");
            fs.writeFile(path.join(moduleDirPath, "README.md"), readmeContents);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            });
        });
    });
    
    it("ignores text after license", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            var readmeJunk = new Array(1000).join("rabbit ");
            
            var readmeContents = "## License\n\n" + licenseText("mit") + "\n\n##The rest\n\n" + readmeJunk;
            fs.writeFile(path.join(moduleDirPath, "README.md"), readmeContents);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            });
        });
    });
    
    it("can find readme.md when not all uppercase", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFile(path.join(moduleDirPath, "Readme.md"), "## License\n\n" + licenseText("mit"));
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.names, ["MIT"]);
                done();
            });
        });
    });
});

function licenseText(name) {
    return fs.readFileSync(path.join(__dirname, "../licenses/" + name), "utf8");
}

function withTemporaryModule(moduleName, callback) {
    var moduleDirPath = temp.mkdirSync();
    fs.writeFileSync(
        path.join(moduleDirPath, "package.json"),
        JSON.stringify({"name": moduleName})
    );
    callback(moduleDirPath);
}


describe("license-sniffer.sniffPackageJson", function() {
    it("reads license names as empty list if package.json is empty", function(done) {
        licenseSniffer.sniffPackageJson({}, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, []);
            done();
        });
    });
    
    it("reads license field", function(done) {
        licenseSniffer.sniffPackageJson({license: "BSD"}, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("packageJson is parsed to JSON object if its a string", function(done) {
        licenseSniffer.sniffPackageJson('{"license": "BSD"}', function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("passes error to callback if JSON is badly formed", function(done) {
        licenseSniffer.sniffPackageJson('{license: "BSD"}', function(err, license) {
            assert.ok(err);
            done();
        });
    });
    
    it("reads licenses field if license field is not present", function(done) {
        var packageJson = {
            licenses: [
                {
                    type: "BSD",
                    url: "http://opensource.org/licenses/BSD-2-Clause"
                }
            ]
        };
        licenseSniffer.sniffPackageJson(packageJson, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });
    
    it("reads multiple licenses if licenses has many elements", function(done) {
        var packageJson = {
            licenses: [{type: "BSD"}, {type: "MIT"}]
        };
        licenseSniffer.sniffPackageJson(packageJson, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD", "MIT"]);
            done();
        });
    });
});

describe("license-sniffer.sniffRecursive", function() {
    it("sniffs licenses of modules in node_modules", function(done) {
        withTemporaryModule("test-module", function(modulePath) {
            writeFileSync(
                path.join(modulePath, "package.json"),
                JSON.stringify({license: "BSD"})
            );
            writeFileSync(
                path.join(modulePath, "node_modules/one/package.json"),
                JSON.stringify({license: "MIT"})
            );
            writeFileSync(
                path.join(modulePath, "node_modules/one/node_modules/one-one/package.json"),
                JSON.stringify({license: "Apache"})
            );
            licenseSniffer.sniffRecursive(modulePath, function(err, result) {
                assert.ifError(err);
                assert.deepEqual(
                    result,
                    [
                        {modulePath: modulePath, names: ["BSD"]},
                        {modulePath: path.join(modulePath, "node_modules/one"), names: ["MIT"]},
                        {modulePath: path.join(modulePath, "node_modules/one/node_modules/one-one"), names: ["Apache"]}
                    ]
                );
                done();
            });
        });
    });
});

function writeFileSync(filePath, contents) {
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, contents);
}
