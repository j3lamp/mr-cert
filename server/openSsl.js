"use strict"

const fs     = require("fs").promises;
const path   = require("path");

const child_process = require("mz/child_process");
const crypto        = require("mz/crypto");

const Config = require("./openSslConfig.js");
const File   = require("./file.js");


function makeOpenSslFunction(subcommand)
{
    return (...args) => {
        return child_process.execFile("openssl", [subcommand].concat(args));
    }
}

const ca     = makeOpenSslFunction("ca");
const genrsa = makeOpenSslFunction("genrsa");
const req    = makeOpenSslFunction("req");
const verify = makeOpenSslFunction("verify");
const x509   = makeOpenSslFunction("x509");


/**
 * A class for working with and using the `openssl` command.
 */
class OpenSsl
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

    /**
     * Creates a temporary directory, which is passed to the @a action function.
     *
     * This function creates a temporary scratch directory and then provides the
     * path to the passed in @a action function. Once the @action function has
     * completed the scratch directory is deleted.
     *
     * This is typically called as `withScratchDir((dir) => { doStuff; });`,
     * however you can pass a boolean value as the first argument to controll
     * whether or not the directory is delete afterwards:
     * `withScratchDir(true, (dir) => { doStuff; });`.
     */
    async withScratchDir(action_or_keep, action=null)
    {
        let keep = action_or_keep;
        if (null == action)
        {
            keep = false;
            action = action_or_keep
        }

        let result = null;

        let scratch_dir = null
        try
        {
            scratch_dir = await fs.mkdtemp(this._scratch_dir + "/");

            result = await action(scratch_dir);
        }
        finally
        {
            if (scratch_dir && !keep)
            {
                await fs.rmdir(scratch_dir, {recursive: true});
            }
        }

        return result;
    }

    async makeRootCert(name,
                       key_length,
                       digest_algorithm,
                       lifetime,
                       common_name,
                       country,
                       state,
                       locality,
                       organization,
                       organizational_unit,
                       email_address,
                       intermediate_only,
                       storage)
    {
        try
        {
            return await this.withScratchDir(async (scratch_dir) => {
                const csr_conf_path    = path.join(scratch_dir, "csr.conf");
                const key_path         = path.join(scratch_dir, "key");
                const certificate_path = path.join(scratch_dir, "certificate");
                const index_path       = path.join(scratch_dir, "index");
                const serial_path      = path.join(scratch_dir, "serial");

                await Promise.all([
                    File.writeFile(csr_conf_path,
                                   Config.getCertificateSigningRequest(
                                       digest_algorithm,
                                       common_name,
                                       country,
                                       state,
                                       locality,
                                       organization,
                                       organizational_unit,
                                       email_address,
                                       true,
                                       [])),

                    // Create key pair
                    genrsa("-out", key_path, key_length)
                ]);

                await Promise.all([
                    // Create self-signed certificate
                    req("-x509",
                        "-new",
                        "-config", csr_conf_path,
                        "-days", lifetime,
                        "-key", key_path,
                        "-out", certificate_path),

                    // Create empty index file
                    File.writeFile(index_path, ""),

                    // Randomly initialize the serial number
                    (crypto.randomBytes(2).then((serial) => {
                        File.writeFile(serial_path, serial.toString('hex'));
                    })),
                ]);

                return await storage.storeCert(name,
                                               {certificate:       certificate_path,
                                                key:               key_path,
                                                index:             index_path,
                                                serial:            serial_path},
                                               {intermediate_only: intermediate_only});
            });
        }
        catch (error)
        {
            console.error(error);
            return false;
        }
    }

    async makeIntermediateCert(name,
                               signer,
                               signer_type,
                               key_length,
                               digest_algorithm,
                               lifetime,
                               common_name,
                               country,
                               state,
                               locality,
                               organization,
                               organizational_unit,
                               email_address,
                               storage)
    {
        const signer_valid = signer.hasFiles("certificate",
                                             "key",
                                             "index",
                                             "serial");
        if (!signer_valid)
        {
            return false;
        }

        try
        {
            return await this.withScratchDir(async (scratch_dir) => {
                const csr_conf_path    = path.join(scratch_dir, "csr.conf");
                const csr_path         = path.join(scratch_dir, "csr");
                const key_path         = path.join(scratch_dir, "key");
                const ca_config_path   = path.join(scratch_dir, "ca.conf");
                const certificate_path = path.join(scratch_dir, "certificate");
                const chain_path       = path.join(scratch_dir, "chain");
                const index_path       = path.join(scratch_dir, "index");
                const serial_path      = path.join(scratch_dir, "serial");

                await File.writeFile(csr_conf_path,
                                     Config.getCertificateSigningRequest(
                                         digest_algorithm,
                                         common_name,
                                         country,
                                         state,
                                         locality,
                                         organization,
                                         organizational_unit,
                                         email_address,
                                         false,
                                         []));

                await Promise.all([
                    req("-new",
                        "-config", csr_conf_path,
                        "-newkey", `rsa:${key_length}`,
                        "-keyout", key_path,
                        "-out", csr_path),

                    File.writeFile(ca_config_path,
                                   Config.getStrictCaConfig(
                                       signer.getFilePath("index"),
                                       signer.getFilePath("serial"),
                                       signer.getFilePath("random"),
                                       signer.getFilePath("key"),
                                       signer.getFilePath("certificate"),
                                       scratch_dir))
                ]);

                await Promise.all([
                    ca("-batch",
                       "-config", ca_config_path,
                       "-extensions", "v3_intermediate_ca",
                       "-days", lifetime,
                       "-notext",
                       "-md", digest_algorithm,
                       "-in", csr_path,
                       "-out", certificate_path),

                    // Create empty index file
                    File.writeFile(index_path, ""),

                    // Randomly initialize the serial number
                    (crypto.randomBytes(2).then((serial) => {
                        File.writeFile(serial_path, serial.toString('hex'));
                    }))
                ]);

                await Promise.all([
                    File.readFile(certificate_path,                  null),
                    File.readFile(signer.getFilePath("certificate"), null)
                ])
                    .then(async (certs) => {
                        const chain = Buffer.concat(certs);
                        await File.writeFile(chain_path, chain);
                    });

                return await storage.storeCert(name,
                                               {certificate: certificate_path,
                                                key:         key_path,
                                                index:       index_path,
                                                serial:      serial_path,
                                                chain:       chain_path},
                                               {signer_type: signer_type,
                                                signer_name: signer.name});
            });
        }
        catch (error)
        {
            console.error(error);
            return false;
        }
    }

    async makeServerCert(name,
                         signer,
                         signer_type,
                         key_length,
                         digest_algorithm,
                         lifetime,
                         common_name,
                         country,
                         state,
                         locality,
                         organization,
                         organizational_unit,
                         email_address,
                         alternate_domain_names,
                         storage)
    {
        const signer_valid = (!signer.intermediate_only &&
                              signer.hasFiles("certificate",
                                              "key",
                                              "index",
                                              "serial"));
        if (!signer_valid)
        {
            return false;
        }

        try
        {
            return await this.withScratchDir(true, async (scratch_dir) => {
                const csr_conf_path    = path.join(scratch_dir, "csr.conf");
                const csr_path         = path.join(scratch_dir, "csr");
                const key_path         = path.join(scratch_dir, "key");
                const ca_config_path   = path.join(scratch_dir, "ca.conf");
                const certificate_path = path.join(scratch_dir, "certificate");
                const chain_path       = path.join(scratch_dir, "chain");

                await File.writeFile(csr_conf_path,
                                     Config.getCertificateSigningRequest(
                                         digest_algorithm,
                                         common_name,
                                         country,
                                         state,
                                         locality,
                                         organization,
                                         organizational_unit,
                                         email_address,
                                         false,
                                         alternate_domain_names));

                await Promise.all([
                    req("-new",
                        "-config", csr_conf_path,
                        "-newkey", `rsa:${key_length}`,
                        "-keyout", key_path,
                        "-out", csr_path),

                    File.writeFile(ca_config_path,
                                   Config.getLooseCaConfig(
                                       signer.getFilePath("index"),
                                       signer.getFilePath("serial"),
                                       signer.getFilePath("random"),
                                       signer.getFilePath("key"),
                                       signer.getFilePath("certificate"),
                                       scratch_dir,
                                       digest_algorithm,
                                       lifetime,
                                       Config.SignedType.SERVER))
                ]);

                await ca("-batch",
                         "-config", ca_config_path,
                         "-notext",
                         "-in", csr_path,
                         "-out", certificate_path);

                await Promise.all([
                    File.readFile(certificate_path,                  null),
                    File.readFile(signer.getFilePath("certificate"), null)
                ])
                    .then(async (certs) => {
                        const chain = Buffer.concat(certs);
                        await File.writeFile(chain_path, chain);
                    });

                return await storage.storeCert(name,
                                               {certificate: certificate_path,
                                                key:         key_path,
                                                chain:       chain_path},
                                               {signer_type: signer_type,
                                                signer_name: signer.name});
            });
        }
        catch (error)
        {
            console.error(error);
            return false;
        }
    }

    /** @todo Implement this one properly. */
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
            console.error(error);
            return false;
        }
    }
};

module.exports = OpenSsl;
