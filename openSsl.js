const fs   = require("fs").promises;
const path = require("path");

const child_process = require("mz/child_process");


function makeOpenSslFunction(subcommand)
{
    return (...args) => {
        return child_process.execFile("openssl", [subcommand].concat(args));
    }
}

const ca     = makeOpenSslFunction("ca");
const req    = makeOpenSslFunction("req");
const verify = makeOpenSslFunction("verify");
const x509   = makeOpenSslFunction("x509");


module.exports = class OpenSsl
{
    constructor(
        scratch_dir
    )
    {
        this._scratch_dir = scratch_dir;
    }

    async getText(certificate_file)
    {
        try
        {
            const [stdout, stderr] = await x509("-text",
                                                "-noout",
                                                "-in", certificate_file);
            return stdout;
        }
        catch(err)
        {
            return false;
        }
    }

    async withScratchDir(action)
    {
        let result = null;

        let scratch_dir = null
        try
        {
            scratch_dir = await fs.mkdtemp(this._scratch_dir + "/");

            result = await action(scratch_dir);
        }
        finally
        {
            if (scratch_dir)
            {
                await fs.rmdir(scratch_dir, {recursive: true});
            }
        }

        return result;
    }

    async writeFile(file_path, contents)
    {
        let file = null;
        try
        {
            file = await fs.open(file_path, 'w')
            await file.writeFile(contents);
        }
        catch (error)
        {
            console.log(error);
        }
        finally
        {
            if (file)
            {
                await file.close()
            }
        }
    }

    async makeClientCert(name,
                         signing_cert,
                         signing_key,
                         digest_length,
                         digest_algorithm,
                         lifetime,
                         country,
                         state,
                         locality,
                         organization,
                         organizational_unit,
                         email_address,
                         common_name,
                         alternate_domain_names,
                         storage)
    {
        if (organizational_unit)
        {
            organizational_unit = "\nOU = " + organizational_unit;
        }

        let extensions = "";
        let dns_list   = "";
        for (const domain_name of alternate_domain_names)
        {
            if (domain_name)
            {
                if (dns_list)
                {
                    dns_list += ", ";
                }
                dns_list += `DNS: ${domain_name}`;
            }
        }
        if (dns_list)
        {
            dns_list = `subjectAltName = ${dns_list}`;
            extensions = `
req_extensions = req_ext`;
        }

        try
        {
            return await this.withScratchDir(async (scratch_dir) => {
                let csr_conf = `[ req ]
default_bits = ${digest_length}
prompt = no
encrypt_key = no
default_md = ${digest_algorithm}
distinguished_name = dn${extensions}

[ dn ]
CN = ${common_name}
emailAddress = ${email_address}
O = ${organization}${organizational_unit}
L = ${locality}
ST = ${state}
C = ${country}`;
                if (dns_list)
                {
                    csr_conf += `

[ req_ext ]
${dns_list}`;
                }

                const csr_conf_path = path.join(scratch_dir, "csr.conf");
                await this.writeFile(csr_conf_path, csr_conf);

                const key_path = path.join(scratch_dir, `${name}.key`);
                const csr_path = path.join(scratch_dir, `${name}.csr`);
                await req("-new",
                          "-config", csr_conf_path,
                          "-keyout", key_path,
                          "-out", csr_path);

                const ext_path = path.join(scratch_dir, "san.ext");
                await this.writeFile(ext_path, dns_list);

                const cert_path = path.join(scratch_dir, `${name}.crt`);
                await x509("-req",
                           "-in", csr_path,
                           "-extfile", ext_path,
                           "-days", lifetime,
                           "-CA", signing_cert,
                           "-CAkey", signing_key,
                           "-CAcreateserial",
                           "-out", cert_path);

                return await storage.storeCert(name, cert_path, key_path);
            });
        }
        catch (error)
        {
            console.log(error);
            return false;
        }
    }
};
