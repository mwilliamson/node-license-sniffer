var assert = require("assert");
var path = require("path");
var fs = require("fs");
var EOL = require("os").EOL;

var mkdirp = require("mkdirp");
var temp = require("temp");
var duck = require("duck");

var licenseSniffer = require("../");


describe("license-sniffer.sniff", function() {
    this.timeout(5000);

    it("detects itself as BSD", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD-2-Clause"]);
            done();
        });
    });

    it("uses license text from LICENSE when package.json specifies license", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFileSync(
                path.join(moduleDirPath, "package.json"),
                JSON.stringify({name: "test-module", license: "MIT"})
            );
            fs.writeFileSync(path.join(moduleDirPath, "LICENSE"), "The MIT license.");
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.equal(license.text, "The MIT license.");
                done();
            });
        });
    });

    it("uses license template if package.json contains license but LICENSE does not exist", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFileSync(
                path.join(moduleDirPath, "package.json"),
                JSON.stringify({name: "test-module", license: "MIT"})
            );
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                var expectedPrefix =
                    "Copyright (c) 2016 test-module" + EOL + EOL +
                    "Permission is hereby granted";
                assert.equal(license.text.substring(0, expectedPrefix.length), expectedPrefix);
                done();
            });
        });
    });

    it("does not use license template if generate body is false", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFileSync(
                path.join(moduleDirPath, "package.json"),
                JSON.stringify({name: "test-module", license: "MIT"})
            );
            licenseSniffer.sniff(moduleDirPath, {generateBody: false}, function(err, license) {
                assert.ifError(err);
                assert.equal(license.text, null);
                done();
            });
        });
    });

    it("uses license alias to find license template", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFileSync(
                path.join(moduleDirPath, "package.json"),
                JSON.stringify({name: "test-module", license: "BSD"})
            );
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                var expectedPrefix =
                    "Copyright (c) 2016, test-module" + EOL +
                    "All rights reserved.";
                assert.equal(license.text.substring(0, expectedPrefix.length), expectedPrefix);
                done();
            });
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

    it("includes license text when detecting licence using LICENSE file", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            // Add a bit on the end to make sure we're actually reading from the module
            var bsdLicenseText = licenseText("bsd-2-clause") + "\n\n2-clause BSD";
            fs.writeFileSync(path.join(moduleDirPath, "LICENSE"), bsdLicenseText);
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.deepEqual(license.text, bsdLicenseText);
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

    it("uses license text from README.md when package.json specifies license", function(done) {
        withTemporaryModule("test-module", function(moduleDirPath) {
            fs.writeFileSync(
                path.join(moduleDirPath, "package.json"),
                JSON.stringify({name: "test-module", license: "MIT"})
            );
            fs.writeFileSync(path.join(moduleDirPath, "README.md"), "## License\n\nThe MIT license.");
            licenseSniffer.sniff(moduleDirPath, function(err, license) {
                assert.ifError(err);
                assert.equal(license.text, "The MIT license.");
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

    it("reads licenses field as array of strings if license field is not present", function(done) {
        var packageJson = {
            licenses: ["BSD"]
        };
        licenseSniffer.sniffPackageJson(packageJson, function(err, license) {
            assert.ifError(err);
            assert.deepEqual(license.names, ["BSD"]);
            done();
        });
    });

    it("license field can be object", function(done) {
        var packageJson = {
            license: {
                type: "BSD",
                url: "http://opensource.org/licenses/BSD-2-Clause"
            }
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
                JSON.stringify({name: "root", version: "0.1", license: "BSD"})
            );
            writeFileSync(
                path.join(modulePath, "node_modules/one/package.json"),
                JSON.stringify({name: "sub", version: "0.4", license: "MIT"})
            );
            writeFileSync(
                path.join(modulePath, "node_modules/one/node_modules/one-one/package.json"),
                JSON.stringify({name: "sub-sub", version: "1.4.5", license: "Apache"})
            );
            licenseSniffer.sniffRecursive(modulePath, function(err, result) {
                assert.ifError(err);
                assertThat(result, duck.isArray([
                    duck.hasProperties({
                        modulePath: modulePath,
                        names: ["BSD"],
                        dependencyChain: ["root@0.1"]
                    }),
                    duck.hasProperties({
                        modulePath: path.join(modulePath, "node_modules/one"),
                        names: ["MIT"],
                        dependencyChain: ["root@0.1", "sub@0.4"]
                    }),
                    duck.hasProperties({
                        modulePath: path.join(modulePath, "node_modules/one/node_modules/one-one"),
                        names: ["Apache"],
                        dependencyChain: ["root@0.1", "sub@0.4", "sub-sub@1.4.5"]
                    })
                ]));
                done();
            });
        });
    });
});

function writeFileSync(filePath, contents) {
    mkdirp.sync(path.dirname(filePath));
    fs.writeFileSync(filePath, contents);
}

function assertThat(value, matcher) {
    var result = matcher.matchesWithDescription(value);
    assert.ok(result.matches, result.description);
}
