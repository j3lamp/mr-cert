const child_process = require("mz/child_process");


function makeOpenSslFunction(subcommand)
{
    return (args) => {
        return child_process.execFile("openssl", [subcommand].concat(args));
    }
}

const ca     = makeOpenSslFunction("ca");
const req    = makeOpenSslFunction("req");
const verify = makeOpenSslFunction("verify");
const x509   = makeOpenSslFunction("x509");


module.exports = {
    async getText(certificate_file)
    {
        try
        {
            const [stdout, stderr] = await x509(["-text",
                                                 "-noout",
                                                 "-ext", "subjectAltName",
                                                 "-in", certificate_file]);
            return stdout;
        }
        catch(err)
        {
            return false;
        }
    }
};
