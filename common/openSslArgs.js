"use strict"

const OpenSslArgs = {
    createCsr: function createCsr(config_path,
                                  key_length,
                                  key_path,
                                  csr_path)
    {
        return ["-new",
                "-config", config_path,
                "-newkey", `rsa:${key_length}`,
                "-keyout", key_path,
                "-out",    csr_path];
    }
};

module.exports = OpenSslArgs;
