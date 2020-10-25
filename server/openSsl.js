"use strict"

const child_process = require("mz/child_process");

const OpenSslArgs = require("../common/openSslArgs");


function makeOpenSslFunction(subcommand)
{
    return (...args) => {
        return child_process.execFile("openssl", [subcommand].concat(args));
    }
}

const OpenSsl = {
    ca:      makeOpenSslFunction("ca"),
    genrsa:  makeOpenSslFunction("genrsa"),
    req:     makeOpenSslFunction("req"),
    verify:  makeOpenSslFunction("verify"),
    x509:    makeOpenSslFunction("x509"),

    createCsr: function createCsr(config_path,
                                  key_length,
                                  key_path,
                                  csr_path)
    {
        const args = OpenSslArgs.createCsr(config_path,
                                           key_length,
                                           key_path,
                                           csr_path);
        return child_process.execFile("openssl", args);
    },
};

module.exports = OpenSsl;
