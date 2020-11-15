"use strict"

const OpenSslArgs = require("../common/openSslArgs");


const OpenSsl = {
    createCsr: function createCsr(config_path,
                                  key_length,
                                  key_path,
                                  csr_path)
    {
        const args = OpenSslArgs.createCsr(config_path,
                                           key_length,
                                           key_path,
                                           csr_path);

        return ["openssl", "req", ...args].join(" ");
    },
};

export default OpenSsl
