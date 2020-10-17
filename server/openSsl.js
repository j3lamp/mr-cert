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

    /**
     * Create ancilary files required for certificate authorities.
     *
     * The `openssl` command requires certificate authorities to have an index
     * file, which is used to record what the CA has signed, revoked, etc. Also
     * a serial file to keep track of the serial numbers used when signing
     * certificates. The serial number will be initialized with a random 16-bit
     * number.
     *
     * @param {string} index_path   The path at which the index file should be
     *                              created.
     * @param {string} serial_path  The path at which the serial file should be
     *                              created.
     */
    async createCaFiles(index_path, serial_path)
    {
        const index  = File.writeFile(index_path, "");
        const serial = (crypto.randomBytes(2).then((serial) => {
            File.writeFile(serial_path, serial.toString('hex'));
        }));

        await Promise.all([index, serial]);
    }

    /**
     * Create a certificate chain file.
     *
     * Be sure to order the sources from leaf towards root.
     *
     * @param {string} chain_path    The path at which to write the chain file.
     * @param {string} source_paths  The paths to the certificates to combine
     *                               into the chain file. Be sure to provide
     *                               these in the correct order.
     */
    async createChainFile(chain_path, ...source_paths)
    {
        const certs = await Promise.all(source_paths.map(
            (path) => {return File.readFile(path, null); }));
        const chain = Buffer.concat(certs);
        await File.writeFile(chain_path, chain);
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
            return await this.withScratchDir(false, async (scratch_dir) => {
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
            return await this.withScratchDir(false, async (scratch_dir) => {
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

    async makeClientCert(name,
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
            return await this.withScratchDir(false, async (scratch_dir) => {
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
                                       Config.SignedType.CLIENT))
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

    /**
     * Verify that the provided certificate valid and store it if valid.
     *
     * @param {string} name
     *     The name under which to store the certificate.
     * @param {Certificate|null} signer
     *    The certificate that was used to sign the provideded certificate. This
     *    will be used to verify the certificate.
     * @param {string|null} signer_type
     *    The type of the signing certificate.
     * @param {string} certificate_text
     *    The contents of the new certificate file.
     * @param {string|null} private_key_text
     *     The contents of the new certificates private key. This is only needed
     *     if the certificate will be used to sign certificates.
     * @param {bool} create_ca_files
     *    Whether or not to create files necessary for the certificate to be
     *    used for signing.
     * @param {CertStorage} storage
     *    The storage for the new certificate.
     *
     * @returns {string|false}  The name of the actually stored certificate or
     *                          `false` if it was not valid or couldn't be
     *                          stored.
     */
    async verifyAndStoreCert(name,
                             signer,
                             signer_type,
                             certificate_text,
                             private_key_text,
                             create_ca_files,
                             intermediate_only,
                             storage)
    {
        try
        {
            return await this.withScratchDir(false, async (scratch_dir) => {
                let files      = {certificate:       path.join(scratch_dir, "certificate")};
                let attributes = {intermediate_only: intermediate_only};

                let file_promises = [];
                file_promises.push(File.writeFile(files.certificate, certificate_text));
                if (private_key_text)
                {
                    files.key = path.join(scratch_dir, "key");
                    file_promises.push(File.writeFile(files.key, private_key_text));
                }
                if (create_ca_files)
                {
                    files.index  = path.join(scratch_dir, "index");
                    files.serial = path.join(scratch_dir, "serial");
                    file_promises.push(this.createCaFiles(files.index, files.serial));
                }

                let signing_cert = null;
                if (signer)
                {
                    files.chain  = path.join(scratch_dir, "chain");
                    signing_cert = signer.getFilePath("certificate");
                    attributes   = {signer_type: signer_type,
                                    signer_name: signer.name};

                    file_promises.push(this.createChainFile(files.chain,
                                                            files.certificate,
                                                            signing_cert));
                }
                else
                {
                    // The certificate is self-signed.
                    signing_cert = files.certificate;
                }
                await Promise.all(file_promises);


                await verify("-CAfile", signing_cert, files.certificate);

                return await storage.storeCert(name, files, attributes);
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
