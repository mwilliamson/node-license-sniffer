# node-license-sniffer

node-license-sniffer is a tool for detecting the license of node packages.
It will attempt to read the license from `package.json`.
If it cannot find the license in `package.json`,
it will read `LICENSE` and similarly named files and attempt to guess the license in use.

## Installation

    npm install license-sniffer

## Usage

    node-license-sniffer [package-dir] [--js-comment] [--recurse] [--body] [--no-generate-body]
    
Arguments:

* `package-dir` -- the directory of the package. Defaults to the current directory.
* `--js-comment` -- prepend all output with `//`.
  Useful if generating license information for inclusion in JavaScript files.
* `--recurse` -- find the license for the specified package, and its dependencies.
* `--body` -- include the body of each license where possible.
* `--no-generate-body` -- by default, `--body` generates the body of known licenses if the license body is not included in the package.
  Use this option to only include license bodies if they're explicitly included in the package.

## Examples

Running node-license-sniffer in its own directory:
    
    $ node-license-sniffer
    BSD
    
Using `--js-comment` and `--body` (truncated for brevity):

    $ node-license-sniffer --js-comment --body
    // BSD
    // 
    //     Copyright (c) 2013, Michael Williamson
    //     All rights reserved.
    //     
    //     Redistribution and use in source and binary forms...
    
Using `package-dir` and `--recurse`:

    $ node-license-sniffer node_modules/optimist --recurse
    Module: optimist@0.3.7
    License: MIT/X11

    Module: optimist@0.3.7 => wordwrap@0.0.2
    License: MIT/X11
