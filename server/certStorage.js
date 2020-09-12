"use strict"

const fs   = require("fs").promises;
const path = require("path");

const Mutex = require("async-mutex").Mutex;

const AppError = require("./appError");
const File     = require("./file");


const CERTIFICATE_EXTENSION = ".crt";
const KEY_EXTENSION         = ".key";
const ATTRIBUTES_FILE_NAME  = "_attributes_";


/**
 * A class that provides access to a certificate for signing. Use
 * {@link CertStorage#withCert} to obtain one of these.
 */
class Certificate
{
    /**
     * @private
     */
    constructor(storage, name, certificate_entry)
    {
        if (certificate_entry)
        {
            for (const key in certificate_entry)
            {
                this[key] = certificate_entry[key];
            }
        }
        this.name = name;

        this._storage = storage;
    }

    /**
     * Determine if this certificate has the desired files.
     *
     * @param {string} files  The names of the desired files.
     *
     * @returns {bool}
     *     `true` if the certificate has all of the desired files, `false`
     *     otherwise.
     */
    hasFiles(...files)
    {
        if (!this.files)
        {
            return false;
        }

        return files.reduce(
            (valid, required_file) => {
                if (valid)
                {
                    const entry_valid = this.files.includes(required_file);
                    valid = entry_valid;
                }

                return valid;
            },
            true);
    }

    /**
     * Get the path to a particular file for this certificate.
     *
     * *Note:* This function does not check that the file actually exists.
     *
     * @param {string} file  The name of the desired file.
     *
     * @returns {string}
     *     The path to the requested file.
     */
    getFilePath(file)
    {
        return this._storage.getFilePath(this.name, file);
    }
};


/**
 * A class that handles the storage of certificates and their associated files.
 */
class CertStorage
{/**
     * Create an object to manage certificate storage.
     *
     * @param {string} storage_dir       The directory containing the
     *                                   certificates.
     * @param {string[]} required_files  The files aeach certificate entry must
     *                                   contain to be considered valid.
     */
    constructor(storage_dir, required_files=["certificate"])
    {
        this.storage_dir    = storage_dir;
        this._required_files = required_files;

        this._mutex = {};
    }

    /**
     * Get the path to a particular file for a particular certificate.
     *
     * *Note:* This function does not check that the file actually exists.
     *
     * @param {string} name  The name of the certificate.
     * @param {string} file  The name of the desired file.
     *
     * @returns {string}
     *     The path to the requested file.
     */
    getFilePath(name, file)
    {
        return path.join(this.storage_dir, name, file);
    }

    /**
     * An object containing a certificates attributes. The `file` entry is
     * guranteed.
     *
     * @typedef {Object} CertStorage~CertificateEntry
     * @property {string[]} files  The files in this certificate entry. Will
     *                             contain at least those listed in
     *                             `required_files`.
     */

    /**
     * Get all certificates
     *
     * Get the attributes and associated files for all certificates stored. The
     * files are listed in the 'files' attribute. If a certificate is missing
     * any of the required files it will not be listed.
     *
     * @returns {CertStorage~CertificateEntry[]}
     */
    async getCerts(max=Infinity)
    {
        let certs      = {};
        let cert_count = 0;

        const storage = await fs.opendir(this.storage_dir);

        let entry;
        while (cert_count < max && (entry = await storage.read()))
        {
            if (entry.isDirectory())
            {
                const entry_path = path.join(this.storage_dir, entry.name);
                const cert = await this._loadCert(entry_path);
                if (cert)
                {
                    certs[entry.name] = cert;
                    cert_count += 1;
                }
            }
        }

        await storage.close();

        return certs;
    }

    /**
     * Get a particular certificate.
     *
     * @param {string} name  The name of the desired certificate.
     *
     * @returns {CertStorage~CertificateEntry|null}
     *     If there is no certificate with `name` or the certificate does not
     *     contain all of the `required_files` then `null` will be returned.
     */
    async getCert(name)
    {
        return this._loadCert(path.join(this.storage_dir, name));
    }

    /**
     * This function is called once exclusive access to a certificate has been
     * obtained.
     *
     * @callback CertStorage~certificateAction
     * @param {Certificate} certificate  The requested certificate.
     */

    /**
     * Perform an action with exclusive access to a certificate.
     *
     * This should be used whenever a certificate is used in a way that modifies
     * files. The most common example is signing a CSR as that updates several
     * files on disk. This should also be used when revoking certificates.
     *
     * @param {CertStorage~certificateAction} action
     *            This function will be called as soon as the certificate is
     *            available for exclusive access.
     */
    async withCert(name, action)
    {
        if (undefined === this._mutex[name])
        {
            this._mutex[name] = new Mutex();
        }

        return await this._mutex[name].runExclusive(async () => {
            const cert = new Certificate(this, name, await this.getCert(name));
            return await action(cert);
        });
    }

    /**
     * Appropriately stores certificates and associated files.
     *
     * All files provided in `paths` are stored in a directory with `name`, if
     * said directory doesn't already exist. `paths` must be an object in which
     * the keys are the destination file name and the values are their current
     * absolute paths. The `paths` object *must* have a key for every entry in
     * the `required_files` array passed into the constructor.
     *
     * @param {string} name        The name under which to store this
     *                             certificate and its associated files.
     * @param {Object} paths       The paths of the files to be stored, and the
     *                             keys by which to access them them later.
     * @param {Object} attributes  Attributes to store with the files. This must
     *                             be convertable to JSON.
     *
     * @returns {false|string}
     *     The name used to store this certificate, or `false` if unsuccessful.
     */
    async storeCert(name, paths, attributes=null)
    {
        for (const file of this._required_files)
        {
            if (!paths[file])
            {
                return false;
            }
        }

        const cert_dir = path.join(this.storage_dir, name);
        await fs.mkdir(cert_dir);

        let tasks = [];
        for (const file in paths)
        {
            tasks.push(fs.rename(paths[file], path.join(cert_dir, file)));
        }
        if (attributes)
        {
            tasks.push(File.writeFile(path.join(cert_dir, ATTRIBUTES_FILE_NAME),
                                      JSON.stringify(attributes)));
        }
        await Promise.all(tasks);

        return name;
    }


    /**
     * Load a  certificate directory.
     *
     * @param {string} cert_dir_path  The directory containing the desired
     *                                certificate's files.
     *
     * @returns {CertStorage~CertificateEntry|null}
     *     If `cert_dir_path` doesn't exist or the certificate does not contain
     *     all of the `required_files` then `null` will be returned.
     *
     * @private
     */
    async _loadCert(cert_dir_path)
    {
        let cert = null;

        let dir = null;
        try
        {
            dir = await fs.opendir(cert_dir_path);

            let attributes = {};
            let files      = [];
            let file;
            while (file = await dir.read())
            {
                if (file.isFile())
                {
                    if (ATTRIBUTES_FILE_NAME == file.name)
                    {
                        try
                        {
                            const attributes_path = path.join(cert_dir_path,
                                                              file.name);
                            const attributes_json =
                                  await File.readFile(attributes_path);
                            attributes = JSON.parse(attributes_json);
                        }
                        catch (error)
                        {
                            console.error(error);
                        }
                    }
                    else
                    {
                        files.push(file.name);
                    }
                }
            }

            const valid = this._required_files.reduce(
                (valid, required_file) => {
                    if (valid)
                    {
                        const entry_valid = files.includes(required_file);
                        valid = entry_valid;
                    }

                    return valid;
                },
                true);

            if (valid)
            {
                attributes.files = files;

                cert = attributes;
            }
        }
        finally
        {
            if (dir)
            {
                await dir.close();
            }
        }

        return cert;
    }
};

module.exports = CertStorage;
