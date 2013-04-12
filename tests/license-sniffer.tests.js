var assert = require("assert");
var path = require("path");

var licenseSniffer = require("../");


describe("license-sniffer.sniff", function() {
    it("detects itself as BSD", function(done) {
        licenseSniffer.sniff(path.join(__dirname, ".."), function(err, license) {
            assert.ifError(err);
            assert.equal(license, "BSD");
            done();
        });
    });
});
